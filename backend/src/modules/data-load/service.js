/**
 * Go-live data workbench: load batches of the configuration and migration workbooks.
 *
 * Validation (dry run): every sheet of the batch runs through its importer in load order inside ONE ambient
 * transaction (db/pool.js runInTransaction) that is rolled back at the end, so a row may refer to a record created by
 * an earlier row or sheet of the same workbook. Each row runs in its own savepoint: a failing row is undone alone and
 * reported, the next rows carry on. The load does the same and commits, unless a row fails (then nothing is saved).
 */
import { many, one, query, runInTransaction, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { clearSettingsCache, getSetting } from '../../lib/settings.js';
import { clearLetterheadCache } from '../../lib/letterhead.js';
import { today } from '../../lib/dates.js';
import { configurationSheets } from './configuration.js';
import { migrationSheets, reconciliation } from './migration.js';
import { KITS, kitWorkbook, readKitWorkbook } from './workbook.js';
import { comparable, isDate } from './common.js';
import { assertFeature } from '../features/service.js';

export { KITS };
const LOCK = "hashtext('brokerverse.data-load'), hashtext('data_load_batches')";

/** Sheets of a kit, in load order. */
export async function kitSheets(kit) {
  if (kit === 'configuration') return configurationSheets();
  if (kit === 'migration') return migrationSheets();
  throw badRequest('kit must be configuration or migration');
}

/** golive.* settings: { cutoverDate, locked }. */
export async function goLiveState() {
  const cutover = String((await getSetting('golive.cutover_date', '')) || '').trim();
  return { cutoverDate: isDate(cutover) ? cutover : null, locked: (await getSetting('golive.locked', false)) === true };
}

/** Kit catalogue for the screen: sheets with their columns and keys. */
export async function kits() {
  const out = [];
  for (const kit of Object.keys(KITS)) {
    const sheets = await kitSheets(kit);
    out.push({ kit, title: KITS[kit].title, file: KITS[kit].file, sheets: sheets.map((s) => ({ key: s.key, name: s.name, menu: s.menu, keyColumns: s.keyColumns,
      keyDefaults: s.keyDefaults || {},
      columns: s.columns.map((c) => ({ key: c.key, header: c.header, required: !!c.required, format: c.format || null, list: c.list || null, type: c.type || 'text' })) })) });
  }
  return { kits: out, ...(await goLiveState()) };
}

/** Template of a kit: blank, or (prefill) with the current data of this environment. */
export async function template(kit, { prefill = false, user = null } = {}) {
  const sheets = await kitSheets(kit);
  const { cutoverDate } = await goLiveState();
  const data = {};
  if (prefill) {
    const ctx = { cutover: cutoverDate, user };
    for (const s of sheets) if (s.exportRows) data[s.key] = await s.exportRows(ctx);
  }
  const day = await today();
  return { fileName: prefill ? KITS[kit].file.replace('.xlsx', `_${day}.xlsx`) : KITS[kit].file,
    buffer: await kitWorkbook(kit, sheets, { data, prefill, cutover: cutoverDate, day }) };
}

// ------------------------------------------------------------------ batches

const toBatch = (b) => b && ({
  id: b.id, kit: b.kit, fileName: b.file_name, status: b.status, cutoverDate: b.cutover_date, rowsRead: b.rows_read, rowsValid: b.rows_valid, rowsError: b.rows_error,
  sheets: b.sheets, loadedCounts: b.loaded_counts, reconciliation: b.reconciliation, validRowsOnly: b.valid_rows_only, message: b.message,
  createdBy: b.created_by_name || b.created_by, createdAt: b.created_at, validatedAt: b.validated_at, loadedBy: b.loaded_by_name || b.loaded_by, loadedAt: b.loaded_at,
});
const BATCH_SELECT = `SELECT b.*, cu.display_name AS created_by_name, lu.display_name AS loaded_by_name FROM data_load_batches b
  LEFT JOIN users cu ON cu.id = b.created_by LEFT JOIN users lu ON lu.id = b.loaded_by`;

export async function getBatch(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Load batch not found');
  const b = await one(`${BATCH_SELECT} WHERE b.id = $1`, [Number(id)]);
  if (!b) throw notFound('Load batch not found');
  return toBatch(b);
}

export async function listBatches({ kit = null, status = null } = {}, pg = { limit: 50, offset: 0 }) {
  const where = 'WHERE ($1::text IS NULL OR b.kit = $1) AND ($2::text IS NULL OR b.status = $2)';
  const total = (await one(`SELECT count(*)::int AS n FROM data_load_batches b ${where}`, [kit || null, status || null])).n;
  const rows = await many(`${BATCH_SELECT} ${where} ORDER BY b.created_at DESC, b.id DESC LIMIT $3 OFFSET $4`, [kit || null, status || null, pg.limit, pg.offset]);
  return { total, rows: rows.map(toBatch) };
}

/** Errors of a batch, flattened: [{ sheet, sheetName, row, column, message }]. */
export async function batchErrors(id, { limit = 2000 } = {}) {
  const batch = await getBatch(id);
  const sheets = await kitSheets(batch.kit);
  const names = Object.fromEntries(sheets.map((s) => [s.key, s]));
  const order = Object.fromEntries(sheets.map((s, i) => [s.key, i]));
  const rows = (await many('SELECT sheet, row_number, errors FROM data_load_rows WHERE batch_id = $1 AND status = \'error\'', [batch.id]))
    .sort((a, b) => (order[a.sheet] ?? 99) - (order[b.sheet] ?? 99) || a.row_number - b.row_number);
  const out = [];
  for (const r of rows) {
    // a row held by an all-or-nothing sheet has no error of its own: the sheet message below says why
    for (const e of (r.errors || []).filter((x) => !x.held)) {
      const s = names[r.sheet];
      const col = s?.columns.find((c) => c.key === e.column);
      out.push({ sheet: r.sheet, sheetName: s?.name || r.sheet, row: r.row_number, column: col ? col.header : e.column || null, message: e.message });
    }
  }
  // one message per sheet that failed as a whole, after the errors of its rows
  for (const s of batch.sheets || []) {
    if (!s.message || !rows.some((r) => r.sheet === s.sheet)) continue;
    const at = out.findLastIndex((e) => (order[e.sheet] ?? 99) <= (order[s.sheet] ?? 99));
    out.splice(at + 1, 0, { sheet: s.sheet, sheetName: names[s.sheet]?.name || s.name, row: null, column: null, message: s.message });
  }
  return { total: out.length, errors: out.slice(0, limit) };
}

const HELD = 'Not loaded: the sheet loads all or nothing (see the rows in error)';
/** Rows that cannot be loaded: rows in error and rows held by an all-or-nothing sheet. */
const unloadable = (sheets) => sheets.reduce((s, x) => s + x.errors + (x.held || 0), 0);

/** Errors of a row-level exception: [{ column, message }] with column = column key (or null). */
function rowErrors(e, sheet) {
  const known = (p) => (sheet.columns.some((c) => c.key === p) ? p : null);
  if (e?.name === 'ZodError') return e.issues.map((i) => ({ column: known(String(i.path[0] ?? '')), message: `${i.path.join('.') || 'value'}: ${i.message}` }));
  if (Array.isArray(e?.details) && e.details.length) {
    return e.details.map((d) => {
      const col = sheet.columns.find((c) => c.key === d.path) || null;
      return { column: col ? col.key : null, message: d.message || e.message };
    });
  }
  if (!e?.status) return [{ column: null, message: `Unexpected error: ${e?.message || e}` }];
  return [{ column: null, message: e.message }];
}

/**
 * Run the sheets in load order (inside the caller's ambient transaction). rowsBySheet: { key: [{ id, rowNumber,
 * values, status }] }; skip: row ids not to run (load of valid rows only). Returns { results: Map(row id ->
 * { status, action, errors }), sheets: summary[] }.
 */
async function runSheets(ctx, sheets, rowsBySheet, { skip = new Set() } = {}) {
  const results = new Map();
  const summary = [];
  for (const sheet of sheets) {
    const rows = rowsBySheet[sheet.key] || [];
    // errors: rows with an error of their own; held: rows of an all-or-nothing sheet not loaded because of other rows
    // (message: why the sheet as a whole was not loaded); ignored: rows accepted with nothing to load (zero balance)
    const sum = { sheet: sheet.key, name: sheet.name, read: rows.length, valid: 0, errors: 0, held: 0, created: 0, updated: 0, unchanged: 0, proposed: 0, ignored: 0, skipped: 0, message: null };
    summary.push(sum);
    if (!rows.length) continue;
    const done = (row, r) => {
      results.set(row.id, r);
      if (r.status === 'skipped') sum.skipped += 1;
      else if (r.held) sum.held += 1;
      else if (r.errors?.length) sum.errors += 1;
      else { sum.valid += 1; if (r.action) sum[r.action] = (sum[r.action] || 0) + 1; }
    };
    // a held row is not loadable (status error, so the load and the errors workbook treat it as such) but carries no
    // error of its own: the error list shows the real errors and one message for the sheet
    const held = { status: 'error', action: null, held: true, errors: [{ column: null, message: HELD, held: true }] };
    // stored data by natural key, for the unchanged check (loaded lazily, once per sheet)
    let stored = null;
    const storedFor = async () => {
      if (stored || !sheet.exportRows) return stored;
      stored = new Map();
      for (const r of await sheet.exportRows(ctx)) {
        const k = sheet.keyOf(r);
        stored.set(k, [...(stored.get(k) || []), r]);
      }
      return stored;
    };
    const unchanged = async (values) => {
      const list = (await storedFor())?.get(sheet.keyOf(values)) || [];
      return list.some((r) => sheet.columns.every((c) => values[c.key] === undefined || comparable(c, values[c.key]) === comparable(c, r[c.key])));
    };
    const seen = new Map();
    const pending = [];
    for (const row of rows) {
      if (skip.has(row.id)) { done(row, { status: 'skipped', action: null, errors: [] }); continue; }
      const v = row.values;
      try {
        if (sheet.check) await sheet.check(ctx, v);
        const key = sheet.keyOf(v);
        const blankKey = sheet.keyColumns.every((k) => !v[k]);
        // a whole-sheet import (opening balances) compares the sheet as a whole
        if (!sheet.importSheet && !blankKey && await unchanged(v)) {
          if (seen.has(key)) throw badRequest(`Same key as row ${seen.get(key)} of this sheet`, [{ path: sheet.keyColumns[0], message: `Same key as row ${seen.get(key)} of this sheet` }]);
          seen.set(key, row.rowNumber);
          done(row, { status: 'valid', action: 'unchanged', errors: [] });
          continue;
        }
        const missing = sheet.columns.filter((c) => c.required && (v[c.key] === undefined || v[c.key] === ''));
        if (missing.length) throw badRequest('Required', missing.map((c) => ({ path: c.key, message: `${c.header} is required` })));
        if (seen.has(key)) throw badRequest('Duplicate', [{ path: sheet.keyColumns[0], message: `Same key as row ${seen.get(key)} of this sheet` }]);
        seen.set(key, row.rowNumber);
        if (sheet.importSheet) { pending.push(row); continue; }
        ctx.rowWarnings = [];
        // each row in its own savepoint: a failing row is undone alone
        const action = await withTransaction(() => sheet.importRow(ctx, v));
        done(row, { status: 'valid', action, errors: [], warnings: ctx.rowWarnings });
      } catch (e) {
        done(row, { status: 'error', action: null, errors: rowErrors(e, sheet) });
      }
    }
    if (sheet.importSheet && pending.length && pending.length < rows.length - sum.skipped) {
      // all or nothing: rows in error hold the rest of the sheet
      for (const row of pending) done(row, held);
      sum.message = `Nothing was loaded: the sheet loads all or nothing and ${sum.errors} row(s) are in error; the other ${pending.length} row(s) are held until they are fixed`;
    } else if (sheet.importSheet && pending.length) {
      const out = await withTransaction(async () => {
        const r = await sheet.importSheet(ctx, pending);
        if (r.sheetError || r.rows.some((x) => x.errors || x.held)) throw Object.assign(new Error('sheet rejected'), { sheetResult: r });
        return r;
      }).catch((e) => {
        if (e.sheetResult) return e.sheetResult;
        throw e;
      });
      pending.forEach((row, i) => {
        const x = out.rows[i];
        if (x.held) done(row, held);
        else if (x.errors) done(row, { status: 'error', action: null, errors: x.errors });
        else done(row, { status: 'valid', action: x.action, errors: [] });
      });
      if (out.sheetError) sum.message = out.sheetError;
      // informational note (rows accepted with nothing to load), once for the sheet
      const notes = pending.filter((_, i) => out.rows[i].note);
      if (notes.length) {
        const which = notes.length > 20 ? '' : ` (row${notes.length > 1 ? 's' : ''} ${notes.map((r) => r.rowNumber).join(', ')})`;
        ctx.warn(`${sheet.name}: ${notes.length} row(s) with ${out.rows.find((x) => x.note).note}${which}`);
      }
    }
  }
  return { results, sheets: summary };
}

async function loadRows(batchId) {
  const rows = await many('SELECT id, sheet, row_number, data, status FROM data_load_rows WHERE batch_id = $1 ORDER BY sheet, row_number, id', [batchId]);
  const bySheet = {};
  for (const r of rows) (bySheet[r.sheet] ||= []).push({ id: r.id, rowNumber: r.row_number, values: r.data, status: r.status });
  return bySheet;
}

async function saveResults(batchId, results, statusOf) {
  const ids = [];
  const statuses = [];
  const actions = [];
  const errors = [];
  for (const [id, r] of results) {
    ids.push(id);
    statuses.push(statusOf(r));
    actions.push(r.action || null);
    errors.push(JSON.stringify(r.errors || []));
  }
  if (!ids.length) return;
  await query(`UPDATE data_load_rows d SET status = x.status, action = x.action, errors = x.errors::jsonb
    FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[]) AS x(id, status, action, errors) WHERE d.id = x.id AND d.batch_id = $5`,
  [ids, statuses, actions, errors, batchId]);
}

/** Guards of a kit: the migration kit needs a cutover date and is refused once go-live is locked. */
async function assertKitAllowed(kit) {
  // the legacy book migration is a Phase 2 feature (modules/features)
  if (kit === 'migration') await assertFeature('legacy-migration', { write: true });
  const state = await goLiveState();
  if (kit === 'migration') {
    if (state.locked) throw conflict('Go-live is locked (golive.locked): the migration workbook can no longer be loaded. The configuration workbook stays available');
    if (!state.cutoverDate) throw badRequest('Set the cutover date first (golive.cutover_date: Settings sheet of the configuration workbook, or Master > Configuration)');
  }
  return state;
}

const newCtx = (batch, user, state, dryRun) => ({
  kit: batch.kit, batchId: batch.id, user: { id: user.id, username: user.username, roles: user.roles || [], permissions: user.permissions || [] },
  cutover: state.cutoverDate, dryRun, temporaryPasswords: [], warnings: [], rowWarnings: [],
  warn(message) { this.rowWarnings.push(message); this.warnings.push(message); },
});

/** Create a batch from an uploaded workbook and validate it. */
export async function createBatch({ kit, file, user }) {
  if (!KITS[kit]) throw badRequest('kit must be configuration or migration');
  if (!file?.buffer?.length) throw badRequest('Upload the workbook (.xlsx) in the "file" field');
  await assertKitAllowed(kit);
  const sheets = await kitSheets(kit);
  const parsed = readKitWorkbook(file.buffer, sheets);
  const total = Object.values(parsed).reduce((s, r) => s + r.length, 0);
  if (!total) throw badRequest('The workbook has no data rows (data starts on row 3 of each sheet; the sample row is never loaded)');
  const batch = await withTransaction(async (db) => {
    const b = (await db.query('INSERT INTO data_load_batches(kit, file_name, status, rows_read, created_by) VALUES ($1,$2,\'failed\',$3,$4) RETURNING *',
      [kit, file.originalname || null, total, user.id])).rows[0];
    for (const [sheet, rows] of Object.entries(parsed)) {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        await db.query(`INSERT INTO data_load_rows(batch_id, sheet, row_number, data) SELECT $1, $2, x.n, x.d::jsonb FROM unnest($3::int[], $4::text[]) AS x(n, d)`,
          [b.id, sheet, chunk.map((r) => r.rowNumber), chunk.map((r) => JSON.stringify(r.values))]);
      }
    }
    return b;
  });
  return validateBatch(batch.id, user);
}

/** Validate (dry run) a batch again: every sheet in one transaction that is rolled back. */
export async function validateBatch(id, user) {
  const batch = await getBatch(id);
  if (batch.status === 'loaded') throw conflict(`Batch ${batch.id} is already loaded`);
  const state = await assertKitAllowed(batch.kit);
  const sheets = await kitSheets(batch.kit);
  const rowsBySheet = await loadRows(batch.id);
  let outcome;
  try {
    outcome = await runInTransaction(async () => {
      await query(`SELECT pg_advisory_xact_lock(${LOCK})`);
      const ctx = newCtx(batch, user, state, true);
      const run = await runSheets(ctx, sheets, rowsBySheet);
      const recon = batch.kit === 'migration' ? await reconciliation(ctx, withStatus(rowsBySheet, run.results)) : null;
      return { ...run, reconciliation: recon, warnings: ctx.warnings };
    }, { rollback: true });
  } finally {
    // values read inside the rolled-back transaction must not survive in a cache
    clearSettingsCache();
    clearLetterheadCache();
  }
  await saveResults(batch.id, outcome.results, (r) => r.status);
  const errors = unloadable(outcome.sheets);
  const valid = outcome.sheets.reduce((s, x) => s + x.valid, 0);
  await query(`UPDATE data_load_batches SET status = $2, rows_valid = $3, rows_error = $4, sheets = $5, reconciliation = $6, cutover_date = $7, validated_at = now(),
    message = $8 WHERE id = $1`, [batch.id, errors ? 'failed' : 'validated', valid, errors, JSON.stringify(outcome.sheets), outcome.reconciliation ? JSON.stringify(outcome.reconciliation) : null,
    state.cutoverDate, outcome.warnings.length ? [...new Set(outcome.warnings)].slice(0, 20).join('\n') : null]);
  return { batch: await getBatch(batch.id), errors: (await batchErrors(batch.id, { limit: 500 })).errors };
}

const withStatus = (rowsBySheet, results) => Object.fromEntries(Object.entries(rowsBySheet).map(([k, rows]) => [k, rows.map((r) => ({ ...r, status: results.get(r.id)?.status || r.status }))]));

/**
 * Load (commit) a batch: only when its latest validation has no error, or with validRowsOnly (the rows in error are
 * skipped). Everything in one transaction; a row failing now (the data changed since the validation) saves nothing.
 * Returns the batch, the temporary passwords of new users (shown once, never stored) and the reconciliation.
 */
export async function loadBatch(id, user, { validRowsOnly = false } = {}) {
  const batch = await getBatch(id);
  if (batch.status === 'loaded') throw conflict(`Batch ${batch.id} is already loaded`);
  if (!batch.validatedAt) throw conflict('Validate the batch first');
  if (batch.rowsError && !validRowsOnly) throw conflict(`The latest validation found ${batch.rowsError} row(s) with errors: fix them and upload again, or load the valid rows only`);
  if (!batch.rowsValid) throw conflict('The batch has no valid row to load');
  const state = await assertKitAllowed(batch.kit);
  if ((batch.cutoverDate || null) !== (state.cutoverDate || null) && batch.kit === 'migration') throw conflict(`The cutover date changed since the validation (${batch.cutoverDate} -> ${state.cutoverDate}); validate the batch again`);
  const sheets = await kitSheets(batch.kit);
  const rowsBySheet = await loadRows(batch.id);
  const skip = new Set(Object.values(rowsBySheet).flat().filter((r) => r.status === 'error').map((r) => r.id));
  let outcome;
  const failed = new Error('load failed');
  try {
    outcome = await runInTransaction(async () => {
      await query(`SELECT pg_advisory_xact_lock(${LOCK})`);
      const ctx = newCtx(batch, user, state, false);
      const run = await runSheets(ctx, sheets, rowsBySheet, { skip });
      if (unloadable(run.sheets)) {
        failed.run = run;
        throw failed;
      }
      const recon = batch.kit === 'migration' ? await reconciliation(ctx, withStatus(rowsBySheet, run.results)) : null;
      await query('UPDATE data_load_batches SET status = \'loaded\', loaded_by = $2, loaded_at = now(), valid_rows_only = $3 WHERE id = $1', [batch.id, user.id, !!validRowsOnly && skip.size > 0]);
      return { ...run, reconciliation: recon, temporaryPasswords: ctx.temporaryPasswords };
    });
  } catch (e) {
    if (e !== failed) throw e;
    // nothing was saved: record the errors found now, so they can be downloaded and fixed
    await saveResults(batch.id, failed.run.results, (r) => r.status);
    const errors = unloadable(failed.run.sheets);
    await query('UPDATE data_load_batches SET status = \'failed\', rows_error = $2, rows_valid = $3, sheets = $4, validated_at = now(), message = $5 WHERE id = $1',
      [batch.id, errors, failed.run.sheets.reduce((s, x) => s + x.valid, 0), JSON.stringify(failed.run.sheets), 'The load stopped: rows failed although the validation passed (the data changed since). Nothing was loaded.']);
    throw conflict(`The load stopped: ${errors} row(s) failed although the validation passed (the data changed since). Nothing was loaded; download the errors`);
  } finally {
    clearSettingsCache();
    clearLetterheadCache();
  }
  // rows skipped by "load valid rows only" keep their status and errors: the errors workbook of the batch still lists
  // them, to be fixed and uploaded again
  await saveResults(batch.id, new Map([...outcome.results].filter(([id]) => !skip.has(id))), (r) => (r.status === 'valid' ? 'loaded' : r.status));
  const counts = Object.fromEntries(outcome.sheets.map((s) => [s.sheet, { created: s.created, updated: s.updated, unchanged: s.unchanged, proposed: s.proposed, ignored: s.ignored, skipped: s.skipped }]));
  await query('UPDATE data_load_batches SET loaded_counts = $2, sheets = $3, reconciliation = COALESCE($4, reconciliation) WHERE id = $1',
    [batch.id, JSON.stringify(counts), JSON.stringify(outcome.sheets), outcome.reconciliation ? JSON.stringify(outcome.reconciliation) : null]);
  return { batch: await getBatch(batch.id), temporaryPasswords: outcome.temporaryPasswords, reconciliation: outcome.reconciliation };
}

/** Workbook of the rows in error of a batch (same layout, with an Errors column). */
export async function errorsWorkbook(id) {
  const batch = await getBatch(id);
  const sheets = await kitSheets(batch.kit);
  const rows = await many('SELECT sheet, row_number, data, errors FROM data_load_rows WHERE batch_id = $1 AND status = \'error\' ORDER BY sheet, row_number', [batch.id]);
  if (!rows.length) throw badRequest('This batch has no row in error');
  const data = {};
  const errors = {};
  const byKey = Object.fromEntries(sheets.map((s) => [s.key, s]));
  // the message of a sheet that failed as a whole goes on its first row; held rows (no error of their own) stay in the
  // workbook, since an all-or-nothing sheet is uploaded again as a whole, with an empty Errors cell
  const sheetMessages = Object.fromEntries((batch.sheets || []).filter((s) => s.message).map((s) => [s.sheet, s.message]));
  for (const r of rows) {
    const s = byKey[r.sheet];
    (data[r.sheet] ||= []).push(r.data);
    const text = (r.errors || []).filter((e) => !e.held).map((e) => {
      const col = s?.columns.find((c) => c.key === e.column);
      return `${col ? `${col.header}: ` : ''}${e.message}`;
    }).join(' | ');
    const first = sheetMessages[r.sheet] && !errors[r.sheet] ? `Whole sheet: ${sheetMessages[r.sheet]}` : '';
    (errors[r.sheet] ||= []).push([first, text ? `Row ${r.row_number}: ${text}` : ''].filter(Boolean).join(' | '));
  }
  const { cutoverDate } = await goLiveState();
  return { fileName: `${KITS[batch.kit].file.replace('.xlsx', '')}_Batch${batch.id}_Errors.xlsx`, buffer: await kitWorkbook(batch.kit, sheets, { data, errors, cutover: cutoverDate }) };
}
