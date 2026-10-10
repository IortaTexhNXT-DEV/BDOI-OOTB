/**
 * Go-live data workbench: load batches of the configuration and migration workbooks.
 *
 * Validation (dry run): every sheet of the batch runs through its importer in load order inside ONE ambient
 * transaction (db/pool.js runInTransaction) that is rolled back at the end, so a row may refer to a record created by
 * an earlier row or sheet of the same workbook. Each row runs in its own savepoint: a failing row is undone alone and
 * reported, the next rows carry on. The load does the same and commits, unless a row fails (then nothing is saved).
 *
 * Every row gets one result: New (its key is not stored), Changed (stored with other values: the changed column keys
 * in changes, the stored values in before, the new ones in data), Unchanged (equal to the stored record), Duplicate
 * (it would create a record matching another record by a duplicate rule, duplicates.js: loadable only once resolved)
 * or Error. A duplicate is resolved on the review: Load as new, Use existing (the row creates nothing; for a client or
 * an insurer the legacy value is mapped to the existing record, maps.js) or, for the policy number of another insurer,
 * Load with insurer suffix. A resolution holds while the next validation still finds the duplicate.
 *
 * A masked cell (a value shown with ** to a user without view:pii, sent back in the file) keeps the stored value; in a
 * key or in a column a duplicate rule reads, it is an error. The values of a row are kept in data_load_rows, their
 * identifiers encrypted at rest (migration 0441). A batch keeps the SHA-256 of its file (the same file as a batch
 * loaded or waiting for approval is reported) and the version of the value maps it read: a map changed since the
 * validation, like a changed cutover date, sends the batch back to validation before it is loaded.
 *
 * The objects of each kit and their load order come from the registry (registry.js). A load writes one audit entry per
 * record it creates or changes (migrate-create / migrate-update, values before and after, load number) in the load
 * transaction, and keeps on each row of the batch the record it created or changed.
 */
import crypto from 'node:crypto';
import { many, one, query, runInTransaction, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { clearSettingsCache, getSetting } from '../../lib/settings.js';
import { clearLetterheadCache } from '../../lib/letterhead.js';
import { today } from '../../lib/dates.js';
import { auditMany } from '../../lib/audit.js';
import { legacySystemName } from '../../lib/origin.js';
import { MASK_RE, maskKind, maskValue, protectPayload } from '../../lib/pii.js';
import { currentPiiDecision } from '../../lib/piiPolicy.js';
import { kitObjects } from './registry.js';
import { reconciliation } from './migration.js';
import { presentKinds, productsOfKind, sheetKindOf } from './products.js';
import { RULE_COLUMNS, RULE_LABELS, duplicateDetector, matchText } from './duplicates.js';
import { loadMaps, mapsVersion, saveMap } from './maps.js';
import { KITS, kitWorkbook, readKitWorkbook } from './workbook.js';
import { comparable, fail, isDate } from './common.js';

export { KITS };
const LOCK = "hashtext('brokerverse.data-load'), hashtext('data_load_batches')";

/** Sheets of a kit, in load order (registry.js). */
export const kitSheets = (kit) => kitObjects(kit);

/** Results of a row and what each means (review screen, Instructions sheet). */
export const RESULTS = ['new', 'changed', 'unchanged', 'duplicate', 'error'];
export const RESOLUTIONS = ['load-as-new', 'use-existing', 'insurer-suffix'];

/** Result of a stored row from its status and action. */
export function resultOf(status, action) {
  if (status === 'error') return 'error';
  if (status === 'duplicate') return 'duplicate';
  if (status === 'skipped') return 'skipped';
  if (action === 'created' || action === 'proposed') return 'new';
  if (action === 'updated') return 'changed';
  return 'unchanged';
}
const RESULT_SQL = `CASE WHEN d.status = 'error' THEN 'error' WHEN d.status = 'duplicate' THEN 'duplicate' WHEN d.status = 'skipped' THEN 'skipped'
  WHEN d.action IN ('created', 'proposed') THEN 'new' WHEN d.action = 'updated' THEN 'changed' ELSE 'unchanged' END`;

/** golive.* settings: { cutoverDate, locked }. */
export async function goLiveState() {
  const cutover = String((await getSetting('golive.cutover_date', '')) || '').trim();
  return { cutoverDate: isDate(cutover) ? cutover : null, locked: (await getSetting('golive.locked', false)) === true };
}

/**
 * Settings of the Data Migration & Go-Live workspace (migration 0440), as the workspace reads them: legacy system
 * name, approval of loads, duplicate checks, migrated business in the figures, the go-live lock windows, the job
 * limits, the document types of the file naming convention and the evidence retention.
 */
export async function workspaceSettings() {
  return {
    legacySystemName: await legacySystemName(),
    loadApprovalRequired: (await getSetting('migration.load_approval_required', true)) !== false,
    duplicateRules: await getSetting('migration.duplicate_rules', []),
    kpiIncludeMigrated: (await getSetting('migration.kpi_include_migrated', false)) === true,
    commissionIncludeMigrated: (await getSetting('migration.commission_include_migrated', false)) === true,
    incentiveIncludeMigrated: (await getSetting('migration.incentive_include_migrated', false)) === true,
    sapGlIncludeOpening: (await getSetting('migration.sap_gl_include_opening', false)) === true,
    dashboardDefaultOrigin: (await getSetting('dashboard.default_origin', 'issued')) === 'all' ? 'all' : 'issued',
    unlockWindowDays: Number(await getSetting('migration.unlock_window_days', 7)),
    unlockMaxHours: Number(await getSetting('migration.unlock_max_hours', 4)),
    approvalExpiryHours: Number(await getSetting('migration.approval_expiry_hours', 72)),
    jobStaleMinutes: Number(await getSetting('migration.job_stale_minutes', 15)),
    jobStatementTimeoutMinutes: Number(await getSetting('migration.job_statement_timeout_minutes', 60)),
    documentTypes: await getSetting('migration.document_types', []),
    evidenceRetentionYears: Number(await getSetting('migration.evidence_retention_years', 10)),
  };
}

/**
 * Kit catalogue for the screen: sheets with their columns and keys; the policy sheets with the products they hold. The
 * single Policies sheet of the earlier layout is listed (legacyLayout) for the files that still carry it.
 */
export async function kits() {
  const out = [];
  const kinds = await presentKinds();
  for (const kit of Object.keys(KITS)) {
    const sheets = await kitSheets(kit);
    const rows = [];
    for (const s of sheets) {
      rows.push({ key: s.key, name: s.name, menu: s.menu, keyColumns: s.keyColumns, keyDefaults: s.keyDefaults || {}, dependsOn: s.dependsOn || [],
        duplicateRules: s.duplicateRules || [], ...(s.legacyLayout ? { legacyLayout: true } : {}),
        ...(s.policyKind ? { policyKind: s.policyKind, products: await productsOfKind(s.policyKind, kinds) } : {}),
        columns: s.columns.map((c) => ({ key: c.key, header: c.header, required: !!c.required, format: c.format || null, list: c.list || null, type: c.type || 'text' })) });
    }
    out.push({ kit, title: KITS[kit].title, file: KITS[kit].file, sheets: rows });
  }
  return { kits: out, ...(await goLiveState()), settings: await workspaceSettings() };
}

/**
 * Template of a kit: blank, or (prefill) with the current data of this environment. objects: keys of the objects the
 * workbook carries (the whole kit when empty), with the Instructions and Lists sheets.
 */
export async function template(kit, { prefill = false, user = null, objects = null } = {}) {
  let sheets = (await kitSheets(kit)).filter((s) => !s.legacyLayout);
  if (objects?.length) {
    const unknown = objects.filter((k) => !sheets.some((s) => s.key === k));
    if (unknown.length) throw badRequest(`Not an object of the ${kit} workbook: ${unknown.join(', ')}`);
    sheets = sheets.filter((s) => objects.includes(s.key));
  }
  const { cutoverDate } = await goLiveState();
  const data = {};
  if (prefill) {
    const ctx = { cutover: cutoverDate, user, presentKinds: await presentKinds() };
    for (const s of sheets) if (s.exportRows) data[s.key] = await s.exportRows(ctx);
  }
  const day = await today();
  const base = objects?.length ? KITS[kit].file.replace('.xlsx', `_${objects.length === 1 ? sheets[0].name.replace(/[^A-Za-z0-9]+/g, '_') : 'Selection'}.xlsx`) : KITS[kit].file;
  return { fileName: prefill ? base.replace('.xlsx', `_${day}.xlsx`) : base,
    buffer: await kitWorkbook(kit, sheets, { data, prefill, cutover: cutoverDate, day, user }) };
}

// ------------------------------------------------------------------ batches

const toBatch = (b) => b && ({
  id: b.id, loadNumber: b.load_number, kit: b.kit, legacySystem: b.legacy_system, fileName: b.file_name, status: b.status, cutoverDate: b.cutover_date, rowsRead: b.rows_read, rowsValid: b.rows_valid, rowsError: b.rows_error,
  rowsNew: b.rows_new, rowsChanged: b.rows_changed, rowsUnchanged: b.rows_unchanged, rowsDuplicate: b.rows_duplicate, fileSha256: b.file_sha256, validateMs: b.validate_ms, loadMs: b.load_ms,
  sameFileAs: b.same_file_number ? { loadNumber: b.same_file_number, status: b.same_file_status } : null,
  sheets: b.sheets, loadedCounts: b.loaded_counts, reconciliation: b.reconciliation, validRowsOnly: b.valid_rows_only, message: b.message,
  createdBy: b.created_by_name || b.created_by, createdAt: b.created_at, validatedAt: b.validated_at, loadedBy: b.loaded_by_name || b.loaded_by, loadedAt: b.loaded_at,
});
/** Batches with their uploader, loader and the batch of the same kit loaded or waiting for approval with the same file. */
const BATCH_SELECT = `SELECT b.*, cu.display_name AS created_by_name, lu.display_name AS loaded_by_name, sf.load_number AS same_file_number, sf.status AS same_file_status
  FROM data_load_batches b LEFT JOIN users cu ON cu.id = b.created_by LEFT JOIN users lu ON lu.id = b.loaded_by
  LEFT JOIN LATERAL (SELECT x.load_number, x.status FROM data_load_batches x WHERE b.file_sha256 IS NOT NULL AND x.file_sha256 = b.file_sha256 AND x.kit = b.kit
    AND x.id <> b.id AND x.status IN ('loaded', 'pending-approval') ORDER BY x.id DESC LIMIT 1) sf ON true`;

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

/** Masking kind of a column (personal data): its pii attribute, else the personal data catalogue by key or header. */
const piiKindOf = (c) => c.pii || maskKind(c.key) || maskKind(c.header);
/** Columns a duplicate rule of the sheet reads. */
const ruleColumnsOf = (sheet) => (sheet.duplicateRules || []).flatMap((r) => (r === 'master-name' && sheet.nameColumn ? [sheet.nameColumn] : RULE_COLUMNS[r] || []));

/**
 * Masked cells of a row: in a key or a duplicate-rule column an error; elsewhere the stored value is kept ("not changed
 * (masked)"), or an error when nothing is stored for the row.
 */
async function unmaskCells(sheet, v, storedOf, warnings) {
  const masked = sheet.columns.filter((c) => typeof v[c.key] === 'string' && MASK_RE.test(v[c.key]) && piiKindOf(c));
  if (!masked.length) return;
  const strict = new Set([...sheet.keyColumns, ...ruleColumnsOf(sheet)]);
  for (const c of masked) if (strict.has(c.key)) fail(c.key, `${c.header} is masked: enter the full value`);
  const stored = await storedOf();
  for (const c of masked) {
    if (!stored) fail(c.key, `${c.header} is masked and nothing is stored for this record: enter the full value`);
    v[c.key] = stored[c.key] ?? '';
    warnings.push(`${c.header}: not changed (masked)`);
  }
}

/** Keys of the columns a row changes on its stored record (only the columns the row fills). */
const changedColumns = (sheet, v, before) => sheet.columns.filter((c) => v[c.key] !== undefined && comparable(c, v[c.key]) !== comparable(c, before[c.key])).map((c) => c.key);

/**
 * Run the sheets in load order (inside the caller's ambient transaction). rowsBySheet: { key: [{ id, rowNumber,
 * values, status, resolution }] }; skip: row ids not to run (load of valid rows only). Returns { results: Map(row id ->
 * { status, action, errors, warnings, duplicates, resolution, record, before, changes }), sheets: summary[] }.
 */
async function runSheets(ctx, sheets, rowsBySheet, { skip = new Set() } = {}) {
  const results = new Map();
  const summary = [];
  const detector = await duplicateDetector(ctx);
  // keys already read per key group (the policy sheets share the policy number)
  const groups = new Map();
  for (const sheet of sheets) {
    const rows = rowsBySheet[sheet.key] || [];
    // errors: rows with an error of their own; held: rows of an all-or-nothing sheet not loaded because of other rows
    // (message: why the sheet as a whole was not loaded); ignored: rows accepted with nothing to load (zero balance)
    const sum = { sheet: sheet.key, name: sheet.name, read: rows.length, valid: 0, errors: 0, held: 0, created: 0, updated: 0, unchanged: 0, proposed: 0, ignored: 0, skipped: 0,
      duplicate: 0, message: null };
    summary.push(sum);
    if (!rows.length) continue;
    if (sheet.legacyLayout) ctx.warnings.push(`${sheet.name}: the workbook has the single Policies sheet of the earlier layout; download the template again for the sheets per product`);
    const done = (row, r) => {
      results.set(row.id, r);
      if (r.status === 'skipped') sum.skipped += 1;
      else if (r.held) sum.held += 1;
      else if (r.status === 'error') sum.errors += 1;
      else if (r.status === 'duplicate') sum.duplicate += 1;
      else { sum.valid += 1; if (r.action) sum[r.action] = (sum[r.action] || 0) + 1; }
    };
    // a held row is not loadable (status error, so the load and the errors workbook treat it as such) but carries no
    // error of its own: the error list shows the real errors and one message for the sheet
    const held = { status: 'error', action: null, held: true, errors: [{ column: null, message: HELD, held: true }] };
    // stored data by natural key, for the result of each row (loaded lazily, once per sheet)
    let stored = null;
    let storedRows = null;
    const storedFor = async () => {
      if (stored || !sheet.exportRows) return stored;
      stored = new Map();
      storedRows = await sheet.exportRows(ctx);
      for (const r of storedRows) {
        const k = sheet.keyOf(r);
        stored.set(k, [...(stored.get(k) || []), r]);
      }
      return stored;
    };
    const storedList = async (v) => (await storedFor())?.get(sheet.keyOf(v)) || [];
    const pick = (list, v) => (list.length ? (sheet.pickStored ? sheet.pickStored(list, v) : list[0]) : null);
    const same = (values, r) => sheet.columns.every((c) => values[c.key] === undefined || comparable(c, values[c.key]) === comparable(c, r[c.key]));
    if (!groups.has(sheet.keyGroup || sheet.key)) groups.set(sheet.keyGroup || sheet.key, new Map());
    const seen = groups.get(sheet.keyGroup || sheet.key);
    const seenAt = (key) => {
      const s = seen.get(key);
      if (!s) return null;
      return s.sheet === sheet.name ? `Same key as row ${s.row} of this sheet` : `Same ${sheet.columns.find((c) => c.key === sheet.keyColumns[0])?.header.toLowerCase()} as ${s.sheet} row ${s.row}`;
    };
    const pending = [];
    for (const row of rows) {
      if (skip.has(row.id)) { done(row, { status: 'skipped', action: null, errors: [] }); continue; }
      const v = { ...row.values };
      const warnings = [];
      ctx.rowWarnings = warnings;
      try {
        await unmaskCells(sheet, v, async () => pick(await storedList(v), v), warnings);
        if (sheet.check) await sheet.check(ctx, v);
        const key = sheet.keyOf(v);
        const blankKey = sheet.keyColumns.every((k) => !v[k]);
        const list = blankKey ? [] : await storedList(v);
        // a whole-sheet import (opening balances) compares the sheet as a whole
        if (!sheet.importSheet && list.some((r) => same(v, r))) {
          const at = seenAt(key);
          if (at) throw badRequest(at, [{ path: sheet.keyColumns[0], message: at }]);
          seen.set(key, { row: row.rowNumber, sheet: sheet.name });
          done(row, { status: 'valid', action: 'unchanged', errors: [], warnings });
          continue;
        }
        const missing = sheet.columns.filter((c) => c.required && (v[c.key] === undefined || v[c.key] === ''));
        if (missing.length) throw badRequest('Required', missing.map((c) => ({ path: c.key, message: `${c.header} is required` })));
        const at = seenAt(key);
        if (at) throw badRequest('Duplicate', [{ path: sheet.keyColumns[0], message: at }]);
        seen.set(key, { row: row.rowNumber, sheet: sheet.name });
        if (sheet.importSheet) { pending.push(row); continue; }
        const subject = sheet.duplicateSubject ? await sheet.duplicateSubject(ctx, v) : {};
        const duplicates = await detector.find(sheet, v, { ...subject, rowNumber: row.rowNumber, sheetRows: storedRows });
        // a resolution holds while the duplicate is still found
        let resolution = duplicates.length ? row.resolution || null : null;
        if (resolution === 'insurer-suffix' && !duplicates.some((m) => m.rule === 'policy-number')) resolution = null;
        if (resolution === 'use-existing') {
          const target = duplicates.find((m) => m.kind === 'stored') || duplicates[0];
          const record = sheet.existingRecord ? await sheet.existingRecord(ctx, target.number) : null;
          done(row, { status: 'valid', action: 'unchanged', errors: [], warnings, duplicates, resolution, record });
          continue;
        }
        const unresolved = duplicates.length > 0 && !resolution;
        ctx.rowRecord = null;
        ctx.rowResolution = resolution;
        let action = null;
        let importError = null;
        try {
          // each row in its own savepoint: a failing row is undone alone
          action = await withTransaction(() => sheet.importRow(ctx, v));
        } catch (e) {
          // a duplicate row reports its matches first; what the importer found is kept with it
          if (!unresolved) throw e;
          importError = e;
        } finally {
          ctx.rowResolution = null;
        }
        const before = action === 'updated' ? pick(list, v) : null;
        done(row, { status: unresolved ? 'duplicate' : 'valid', action, errors: importError ? rowErrors(importError, sheet) : [], warnings, duplicates,
          resolution, record: ctx.rowRecord, before, changes: before ? changedColumns(sheet, v, before) : [] });
        detector.remember(sheet, v, { ...subject, rowNumber: row.rowNumber });
      } catch (e) {
        done(row, { status: 'error', action: null, errors: rowErrors(e, sheet), warnings });
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
      for (const [i, row] of pending.entries()) {
        const x = out.rows[i];
        if (x.held) done(row, held);
        else if (x.errors) done(row, { status: 'error', action: null, errors: x.errors });
        else {
          const before = x.action === 'updated' ? pick(await storedList(row.values), row.values) : null;
          done(row, { status: 'valid', action: x.action, errors: [], before, changes: before ? changedColumns(sheet, row.values, before) : [] });
        }
      }
      if (out.sheetError) sum.message = out.sheetError;
      // informational note (rows accepted with nothing to load), once for the sheet
      const notes = pending.filter((_, i) => out.rows[i].note);
      if (notes.length) {
        const which = notes.length > 20 ? '' : ` (row${notes.length > 1 ? 's' : ''} ${notes.map((r) => r.rowNumber).join(', ')})`;
        ctx.warnings.push(`${sheet.name}: ${notes.length} row(s) with ${out.rows.find((x) => x.note).note}${which}`);
      }
    }
  }
  return { results, sheets: summary };
}

/** Rows of a batch by sheet, their values decrypted. */
async function loadRows(batchId) {
  const rows = await many('SELECT id, sheet, row_number, data, status, resolution FROM data_load_rows WHERE batch_id = $1 ORDER BY sheet, row_number, id', [batchId]);
  const bySheet = {};
  for (const r of rows) (bySheet[r.sheet] ||= []).push({ id: r.id, rowNumber: r.row_number, values: protectPayload(r.data), status: r.status, resolution: r.resolution });
  return bySheet;
}

/**
 * Results of the rows: result, errors, warnings, duplicates, the stored values before and the changed columns; record
 * (a load): the record each row created or changed (table, id, key), else cleared. A resolution no longer backed by a
 * duplicate is cleared with its reason and author.
 */
async function saveResults(batchId, results, statusOf) {
  const cols = { ids: [], statuses: [], actions: [], errors: [], tables: [], records: [], keys: [], before: [], changes: [], warnings: [], duplicates: [], keep: [] };
  for (const [id, r] of results) {
    cols.ids.push(id);
    cols.statuses.push(statusOf(r));
    cols.actions.push(r.action || null);
    cols.errors.push(JSON.stringify(r.errors || []));
    cols.tables.push(r.record?.table ?? null);
    cols.records.push(r.record?.id == null ? null : String(r.record.id));
    cols.keys.push(r.record?.key ?? null);
    cols.before.push(r.before ? JSON.stringify(r.before) : null);
    cols.changes.push(r.changes?.length ? JSON.stringify(r.changes) : null);
    cols.warnings.push(r.warnings?.length ? JSON.stringify(r.warnings) : null);
    cols.duplicates.push(r.duplicates?.length ? JSON.stringify(r.duplicates) : null);
    cols.keep.push(!!r.resolution);
  }
  if (!cols.ids.length) return;
  await query(`UPDATE data_load_rows d SET status = x.status, action = x.action, errors = x.errors::jsonb, record_table = x.record_table, record_id = x.record_id, record_key = x.record_key,
      before = x.before::jsonb, changes = x.changes::jsonb, warnings = x.warnings::jsonb, duplicates = x.duplicates::jsonb,
      resolution = CASE WHEN x.keep THEN d.resolution END, resolution_reason = CASE WHEN x.keep THEN d.resolution_reason END,
      resolved_by = CASE WHEN x.keep THEN d.resolved_by END, resolved_at = CASE WHEN x.keep THEN d.resolved_at END
    FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::boolean[])
      AS x(id, status, action, errors, record_table, record_id, record_key, before, changes, warnings, duplicates, keep)
    WHERE d.id = x.id AND d.batch_id = $13`,
  [cols.ids, cols.statuses, cols.actions, cols.errors, cols.tables, cols.records, cols.keys, cols.before, cols.changes, cols.warnings, cols.duplicates, cols.keep, batchId]);
}

/** Counts per result of the rows: { new, changed, unchanged, duplicate, error }. */
function resultCounts(results) {
  const c = { new: 0, changed: 0, unchanged: 0, duplicate: 0, error: 0 };
  for (const r of results.values()) {
    const k = resultOf(r.status, r.action);
    if (k in c) c[k] += 1;
  }
  return c;
}

/** Guards of a kit: the migration kit needs a cutover date and is refused once go-live is locked. */
async function assertKitAllowed(kit) {
  const state = await goLiveState();
  if (kit === 'migration') {
    if (state.locked) throw conflict('Go-live is locked (golive.locked): the migration workbook can no longer be loaded. The configuration workbook stays available');
    if (!state.cutoverDate) throw badRequest('Set the cutover date first (golive.cutover_date: Settings sheet of the configuration workbook, or Master > Configuration)');
  }
  return state;
}

const RECORD_ACTIONS = { created: 'migrate-create', updated: 'migrate-update' };

/**
 * Context of a validation or load. legacySystem and migratedBy (the uploader) tag the migrated records; record() is
 * called by an importer for each record it creates or changes: the row keeps the record and the load writes its audit
 * entry ({ entity, table, id, key, action: created | updated, before, after }). The value maps and the policy sheets
 * present are read once.
 */
async function newCtx(batch, user, state, dryRun, { legacySystem, migratedBy }) {
  const kinds = await presentKinds();
  const ctx = {
    kit: batch.kit, batchId: batch.id, loadNumber: batch.loadNumber, user: { id: user.id, username: user.username, roles: user.roles || [], permissions: user.permissions || [] },
    cutover: state.cutoverDate, dryRun, temporaryPasswords: [], warnings: [], rowWarnings: [], rowRecord: null, rowResolution: null, audits: [], legacySystem, migratedBy,
    presentKinds: kinds, policyKindOf: (p) => sheetKindOf(p, kinds),
    warn(message) { this.rowWarnings.push(message); this.warnings.push(message); },
    async record({ entity, table, id, key, action, before = null, after = null }) {
      this.rowRecord = { table, id, key };
      if (this.dryRun) return;
      this.audits.push({ entity, entityId: id, action: RECORD_ACTIONS[action], before,
        after: { ...(after || {}), batchId: this.batchId, loadNumber: this.loadNumber, legacySystem: this.legacySystem } });
    },
  };
  await loadMaps(ctx);
  return ctx;
}

/** Legacy system and uploader of a batch (the migrated records carry them). */
async function originOfBatch(batch) {
  const b = await one('SELECT legacy_system, created_by FROM data_load_batches WHERE id = $1', [batch.id]);
  return { legacySystem: b?.legacy_system || await legacySystemName(), migratedBy: b?.created_by || null };
}

/** Create a batch from an uploaded workbook and validate it. legacySystem: the source of the migrated records (setting by default). */
export async function createBatch({ kit, file, user, legacySystem = null }) {
  if (!KITS[kit]) throw badRequest('kit must be configuration or migration');
  if (!file?.buffer?.length) throw badRequest('Upload the workbook (.xlsx) in the "file" field');
  await assertKitAllowed(kit);
  const sheets = await kitSheets(kit);
  const parsed = readKitWorkbook(file.buffer, sheets, kit);
  const total = Object.values(parsed).reduce((s, r) => s + r.length, 0);
  if (!total) throw badRequest('The workbook has no data rows (data starts on row 3 of each sheet; the sample row is never loaded)');
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const batch = await withTransaction(async (db) => {
    const b = (await db.query('INSERT INTO data_load_batches(kit, file_name, status, rows_read, created_by, legacy_system, file_sha256) VALUES ($1,$2,\'failed\',$3,$4,$5,$6) RETURNING *',
      [kit, file.originalname || null, total, user.id, kit === 'migration' ? String(legacySystem || '').trim().slice(0, 100) || await legacySystemName() : null, sha256])).rows[0];
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

const STATUS_LABELS = { loaded: 'Loaded', 'pending-approval': 'Pending approval' };

/** Validate (dry run) a batch again: every sheet in one transaction that is rolled back. */
export async function validateBatch(id, user) {
  const batch = await getBatch(id);
  if (batch.status === 'loaded') throw conflict(`Batch ${batch.id} is already loaded`);
  const state = await assertKitAllowed(batch.kit);
  const sheets = await kitSheets(batch.kit);
  const rowsBySheet = await loadRows(batch.id);
  const origin = await originOfBatch(batch);
  const started = Date.now();
  let outcome;
  try {
    outcome = await runInTransaction(async () => {
      await query(`SELECT pg_advisory_xact_lock(${LOCK})`);
      const ctx = await newCtx(batch, user, state, true, origin);
      const run = await runSheets(ctx, sheets, rowsBySheet);
      const recon = batch.kit === 'migration' ? await reconciliation(ctx, withStatus(rowsBySheet, run.results), sheets) : null;
      return { ...run, reconciliation: recon, warnings: ctx.warnings, mapsVersion: ctx.mapsVersion };
    }, { rollback: true });
  } finally {
    // values read inside the rolled-back transaction must not survive in a cache
    clearSettingsCache();
    clearLetterheadCache();
  }
  await saveResults(batch.id, outcome.results, (r) => r.status);
  const errors = unloadable(outcome.sheets);
  const valid = outcome.sheets.reduce((s, x) => s + x.valid, 0);
  const counts = resultCounts(outcome.results);
  const warnings = [...new Set(outcome.warnings)];
  if (batch.sameFileAs) warnings.unshift(`Same file as ${batch.sameFileAs.loadNumber} (${STATUS_LABELS[batch.sameFileAs.status] || batch.sameFileAs.status})`);
  await query(`UPDATE data_load_batches SET status = $2, rows_valid = $3, rows_error = $4, sheets = $5, reconciliation = $6, cutover_date = $7, validated_at = now(),
    message = $8, rows_new = $9, rows_changed = $10, rows_unchanged = $11, rows_duplicate = $12, maps_version = $13, validate_ms = $14 WHERE id = $1`,
  [batch.id, errors ? 'failed' : 'validated', valid, errors, JSON.stringify(outcome.sheets), outcome.reconciliation ? JSON.stringify(outcome.reconciliation) : null,
    state.cutoverDate, warnings.length ? warnings.slice(0, 20).join('\n') : null, counts.new, counts.changed, counts.unchanged, counts.duplicate, outcome.mapsVersion,
    Date.now() - started]);
  return { batch: await getBatch(batch.id), errors: (await batchErrors(batch.id, { limit: 500 })).errors };
}

const withStatus = (rowsBySheet, results) => Object.fromEntries(Object.entries(rowsBySheet).map(([k, rows]) => [k, rows.map((r) => ({ ...r, status: results.get(r.id)?.status || r.status }))]));

/**
 * What stops a validated batch from being submitted or loaded: rows in error (unless validRowsOnly), unresolved
 * duplicates, nothing to load, a cutover date or value maps changed since the validation.
 */
export async function assertLoadable(batch, { validRowsOnly = false } = {}) {
  if (batch.status === 'loaded') throw conflict(`Batch ${batch.id} is already loaded`);
  if (!batch.validatedAt) throw conflict('Validate the batch first');
  if (batch.rowsError && !validRowsOnly) throw conflict(`The latest validation found ${batch.rowsError} row(s) with errors: fix them and upload again, or load the valid rows only`);
  if (batch.rowsDuplicate) throw conflict(`${batch.rowsDuplicate} row(s) are duplicates: resolve them (Load as new, Use existing) or fix the file and upload it again`);
  if (!batch.rowsValid) throw conflict('The batch has no valid row to load');
  const state = await assertKitAllowed(batch.kit);
  if (batch.kit === 'migration') {
    if ((batch.cutoverDate || null) !== (state.cutoverDate || null)) throw conflict(`The cutover date changed since the validation (${batch.cutoverDate} -> ${state.cutoverDate}); validate the batch again`);
    const stamp = (await one('SELECT maps_version FROM data_load_batches WHERE id = $1', [batch.id])).maps_version;
    const now = await mapsVersion();
    if ((stamp ? new Date(stamp).getTime() : null) !== (now ? new Date(now).getTime() : null)) throw conflict('Value maps changed since the validation: validate the batch again');
  }
  return state;
}

/**
 * Load (commit) a batch: only when its latest validation has no error, or with validRowsOnly (the rows in error are
 * skipped), and no unresolved duplicate. Everything in one transaction; a row failing now (the data changed since the
 * validation) saves nothing. Returns the batch, the temporary passwords of new users (shown once, never stored) and the
 * reconciliation.
 */
export async function loadBatch(id, user, { validRowsOnly = false, req = null } = {}) {
  const batch = await getBatch(id);
  const state = await assertLoadable(batch, { validRowsOnly });
  const sheets = await kitSheets(batch.kit);
  const rowsBySheet = await loadRows(batch.id);
  const skip = new Set(Object.values(rowsBySheet).flat().filter((r) => r.status === 'error').map((r) => r.id));
  const origin = await originOfBatch(batch);
  const started = Date.now();
  let outcome;
  const failed = new Error('load failed');
  try {
    outcome = await runInTransaction(async () => {
      await query(`SELECT pg_advisory_xact_lock(${LOCK})`);
      const ctx = await newCtx(batch, user, state, false, origin);
      const run = await runSheets(ctx, sheets, rowsBySheet, { skip });
      if (unloadable(run.sheets) || run.sheets.some((s) => s.duplicate)) {
        failed.run = run;
        throw failed;
      }
      // one audit entry per record created or changed, committed with the records
      await auditMany(req || { user }, ctx.audits);
      const recon = batch.kit === 'migration' ? await reconciliation(ctx, withStatus(rowsBySheet, run.results), sheets) : null;
      await query('UPDATE data_load_batches SET status = \'loaded\', loaded_by = $2, loaded_at = now(), valid_rows_only = $3 WHERE id = $1', [batch.id, user.id, !!validRowsOnly && skip.size > 0]);
      return { ...run, reconciliation: recon, temporaryPasswords: ctx.temporaryPasswords };
    });
  } catch (e) {
    if (e !== failed) throw e;
    // nothing was saved: record the errors found now, so they can be downloaded and fixed
    await saveResults(batch.id, failed.run.results, (r) => r.status);
    const errors = unloadable(failed.run.sheets);
    const counts = resultCounts(failed.run.results);
    await query(`UPDATE data_load_batches SET status = 'failed', rows_error = $2, rows_valid = $3, sheets = $4, validated_at = now(), message = $5, rows_new = $6, rows_changed = $7,
      rows_unchanged = $8, rows_duplicate = $9 WHERE id = $1`,
    [batch.id, errors, failed.run.sheets.reduce((s, x) => s + x.valid, 0), JSON.stringify(failed.run.sheets), 'The load stopped: rows failed although the validation passed (the data changed since). Nothing was loaded.',
      counts.new, counts.changed, counts.unchanged, counts.duplicate]);
    throw conflict(`The load stopped: ${errors + counts.duplicate} row(s) failed although the validation passed (the data changed since). Nothing was loaded; download the errors`);
  } finally {
    clearSettingsCache();
    clearLetterheadCache();
  }
  // rows skipped by "load valid rows only" keep their status and errors: the errors workbook of the batch still lists
  // them, to be fixed and uploaded again
  await saveResults(batch.id, new Map([...outcome.results].filter(([rowId]) => !skip.has(rowId))), (r) => (r.status === 'valid' ? 'loaded' : r.status));
  const counts = Object.fromEntries(outcome.sheets.map((s) => [s.sheet, { created: s.created, updated: s.updated, unchanged: s.unchanged, proposed: s.proposed, ignored: s.ignored, skipped: s.skipped }]));
  await query('UPDATE data_load_batches SET loaded_counts = $2, sheets = $3, reconciliation = COALESCE($4, reconciliation), load_ms = $5 WHERE id = $1',
    [batch.id, JSON.stringify(counts), JSON.stringify(outcome.sheets), outcome.reconciliation ? JSON.stringify(outcome.reconciliation) : null, Date.now() - started]);
  return { batch: await getBatch(batch.id), temporaryPasswords: outcome.temporaryPasswords, reconciliation: outcome.reconciliation };
}

/** Workbook of the rows in error and the unresolved duplicates of a batch (same layout, with an Errors column). */
export async function errorsWorkbook(id, user = null) {
  const batch = await getBatch(id);
  const sheets = await kitSheets(batch.kit);
  const rows = await many('SELECT sheet, row_number, data, errors, duplicates, status FROM data_load_rows WHERE batch_id = $1 AND status IN (\'error\', \'duplicate\') ORDER BY sheet, row_number', [batch.id]);
  if (!rows.length) throw badRequest('This batch has no row in error and no duplicate');
  const data = {};
  const errors = {};
  const byKey = Object.fromEntries(sheets.map((s) => [s.key, s]));
  // the message of a sheet that failed as a whole goes on its first row; held rows (no error of their own) stay in the
  // workbook, since an all-or-nothing sheet is uploaded again as a whole, with an empty Errors cell
  const sheetMessages = Object.fromEntries((batch.sheets || []).filter((s) => s.message).map((s) => [s.sheet, s.message]));
  for (const r of rows) {
    const s = byKey[r.sheet];
    (data[r.sheet] ||= []).push(protectPayload(r.data));
    const text = [...(r.status === 'duplicate' ? (r.duplicates || []).map(matchText) : []), ...(r.errors || []).filter((e) => !e.held).map((e) => {
      const col = s?.columns.find((c) => c.key === e.column);
      return `${col ? `${col.header}: ` : ''}${e.message}`;
    })].join(' | ');
    const first = sheetMessages[r.sheet] && !errors[r.sheet] ? `Whole sheet: ${sheetMessages[r.sheet]}` : '';
    (errors[r.sheet] ||= []).push([first, text ? `Row ${r.row_number}: ${text}` : ''].filter(Boolean).join(' | '));
  }
  const { cutoverDate } = await goLiveState();
  return { fileName: `${KITS[batch.kit].file.replace('.xlsx', '')}_${batch.loadNumber || `Batch${batch.id}`}_Errors.xlsx`,
    buffer: await kitWorkbook(batch.kit, sheets, { data, errors, cutover: cutoverDate, user }) };
}

// ------------------------------------------------------------------ review of a validation

/** A masked copy of a value of a column for the current request (user without view:pii). */
function shown(c, value, mask) {
  if (!mask || value === null || value === undefined || value === '') return value ?? null;
  const kind = c ? piiKindOf(c) : null;
  return kind ? maskValue(kind, String(value)) : value;
}

/**
 * Rows of a batch for the review, with their result, the changed columns (old -> new), duplicates, errors and
 * warnings, masked for a user without view:pii. Filters: sheet, result (new, changed, unchanged, duplicate, error),
 * search (key or values).
 */
export async function batchRows(id, { sheet = null, result = null, search = null } = {}, pg = { limit: 50, offset: 0 }) {
  const batch = await getBatch(id);
  const sheets = await kitSheets(batch.kit);
  const byKey = Object.fromEntries(sheets.map((s) => [s.key, s]));
  if (result && !RESULTS.includes(result)) throw badRequest(`result must be one of ${RESULTS.join(', ')}`);
  const where = `WHERE d.batch_id = $1 AND ($2::text IS NULL OR d.sheet = $2) AND ($3::text IS NULL OR ${RESULT_SQL} = $3)
    AND ($4::text IS NULL OR d.record_key ILIKE '%' || $4 || '%' OR d.data::text ILIKE '%' || $4 || '%')`;
  const params = [batch.id, sheet || null, result || null, search ? String(search).trim() : null];
  const total = (await one(`SELECT count(*)::int AS n FROM data_load_rows d ${where}`, params)).n;
  const rows = await many(`SELECT d.*, ${RESULT_SQL} AS result, u.display_name AS resolved_by_name FROM data_load_rows d LEFT JOIN users u ON u.id = d.resolved_by ${where}
    ORDER BY d.sheet, d.row_number, d.id LIMIT $5 OFFSET $6`, [...params, pg.limit, pg.offset]);
  const { mask } = currentPiiDecision();
  return {
    total,
    rows: rows.map((r) => {
      const s = byKey[r.sheet];
      const data = protectPayload(r.data);
      const before = r.before ? protectPayload(r.before) : null;
      const col = (k) => s?.columns.find((c) => c.key === k) || null;
      const values = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, shown(col(k), v, mask)]));
      return {
        id: Number(r.id), sheet: r.sheet, sheetName: s?.name || r.sheet, row: r.row_number, key: s ? s.keyColumns.map((k) => shown(col(k), data[k], mask) || '-').join(' / ') : r.record_key,
        result: r.result, values,
        changes: (r.changes || []).map((k) => ({ column: k, header: col(k)?.header || k, old: shown(col(k), before?.[k], mask), new: shown(col(k), data[k], mask) })),
        duplicates: (r.duplicates || []).map((m) => ({ ...m, label: RULE_LABELS[m.rule] || m.rule })),
        errors: (r.errors || []).filter((e) => !e.held).map((e) => ({ column: e.column ? col(e.column)?.header || e.column : null, message: e.message })),
        warnings: r.warnings || [], resolution: r.resolution, resolutionReason: r.resolution_reason, resolvedBy: r.resolved_by_name || r.resolved_by, resolvedAt: r.resolved_at,
        record: r.record_id ? { table: r.record_table, id: r.record_id, key: r.record_key } : null,
      };
    }),
  };
}

/** Duplicate rows of a batch (unresolved and resolved), optionally of one rule, with their matches. */
export async function batchDuplicates(id, { rule = null } = {}, pg = { limit: 200, offset: 0 }) {
  const batch = await getBatch(id);
  const where = `WHERE d.batch_id = $1 AND d.duplicates IS NOT NULL AND jsonb_array_length(d.duplicates) > 0
    AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(d.duplicates) m WHERE m->>'rule' = $2))`;
  const ids = await many(`SELECT d.id FROM data_load_rows d ${where} ORDER BY d.sheet, d.row_number LIMIT $3 OFFSET $4`, [batch.id, rule || null, pg.limit, pg.offset]);
  const total = (await one(`SELECT count(*)::int AS n FROM data_load_rows d ${where}`, [batch.id, rule || null])).n;
  if (!ids.length) return { total, rows: [] };
  const all = await batchRows(batch.id, {}, { limit: 100000, offset: 0 });
  const wanted = new Set(ids.map((r) => Number(r.id)));
  return { total, rows: all.rows.filter((r) => wanted.has(r.id)) };
}

/**
 * Resolve duplicate rows of a validated batch: rows (ids) or every row with a match of one rule, resolution
 * load-as-new | use-existing | insurer-suffix | null (cleared: fix the file instead), reason required. Use existing
 * maps the legacy client code or insurer value to the existing record (targetCode, or the one stored match) so later
 * loads resolve the same way. The batch is validated again. Returns { resolved, maps, batch, errors }.
 */
export async function resolveDuplicates(id, { rows = null, rule = null, resolution = null, targetCode = null, reason = null }, user) {
  const batch = await getBatch(id);
  if (!['validated', 'failed'].includes(batch.status)) throw conflict(`Load ${batch.loadNumber} is ${batch.status}: its duplicates can no longer be resolved`);
  await assertKitAllowed(batch.kit);
  if (resolution !== null && !RESOLUTIONS.includes(resolution)) throw badRequest('Validation failed', [{ path: 'resolution', message: `Resolution must be one of ${RESOLUTIONS.join(', ')}` }]);
  const why = String(reason || '').trim();
  if (!why) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason of the resolution' }]);
  if (!(Array.isArray(rows) && rows.length) && !rule) throw badRequest('Validation failed', [{ path: 'rows', message: 'Choose the rows, or a rule for all its rows' }]);
  const chosen = await many(`SELECT id, sheet, row_number, data, duplicates FROM data_load_rows WHERE batch_id = $1 AND duplicates IS NOT NULL AND jsonb_array_length(duplicates) > 0
    AND ($2::bigint[] IS NULL OR id = ANY($2)) AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(duplicates) m WHERE m->>'rule' = $3))`,
  [batch.id, Array.isArray(rows) && rows.length ? rows.map(Number) : null, rule || null]);
  if (!chosen.length) throw badRequest('No duplicate row of this batch matches the choice');
  const sheets = Object.fromEntries((await kitSheets(batch.kit)).map((s) => [s.key, s]));
  const maps = [];
  await withTransaction(async (db) => {
    for (const r of chosen) {
      const matches = r.duplicates || [];
      if (resolution === 'insurer-suffix' && !matches.some((m) => m.rule === 'policy-number')) {
        throw badRequest(`${sheets[r.sheet]?.name || r.sheet} row ${r.row_number}: the insurer suffix applies to a policy number of another insurer only`);
      }
      if (resolution === 'use-existing') {
        const v = protectPayload(r.data);
        const stored = [...new Set(matches.map((m) => m.number))];
        const target = targetCode ? String(targetCode).trim() : stored.length === 1 ? stored[0] : null;
        if (!target) throw badRequest(`${sheets[r.sheet]?.name || r.sheet} row ${r.row_number} matches ${stored.join(', ')}: choose the record to use (targetCode)`);
        if (!stored.includes(target)) throw badRequest(`${target} is not a record the row matches (${stored.join(', ')})`);
        const rules = new Set(matches.filter((m) => m.number === target).map((m) => m.rule));
        if (['tin', 'name-birth-date', 'company-name'].some((x) => rules.has(x)) && v.clientCode) {
          maps.push(await saveMap({ object: 'client', legacyValue: v.clientCode, targetCode: target, note: why }, user, { db }));
        }
        if (rules.has('insurer-variant') && v.insurer) maps.push(await saveMap({ object: 'insurer', legacyValue: v.insurer, targetCode: target, note: why }, user, { db }));
      }
    }
    await db.query(`UPDATE data_load_rows SET resolution = $2, resolution_reason = $3, resolved_by = $4, resolved_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END
      WHERE id = ANY($1::bigint[])`, [chosen.map((r) => r.id), resolution, resolution ? why.slice(0, 500) : null, resolution ? user.id : null]);
  });
  const validated = await validateBatch(batch.id, user);
  return { resolved: chosen.length, maps: maps.length, rows: chosen.map((r) => Number(r.id)), ...validated };
}
