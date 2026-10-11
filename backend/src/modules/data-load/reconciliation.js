/**
 * Reconciliation of the migration loads (Data Migration & Go-Live > Reconciliation, migration 0443).
 *
 * A reconciliation covers loaded migration batches: every loaded migration batch of the run (all_batches, the default,
 * refreshed on recompute) or the batches chosen (of any run of the cutover date, so a delta load is reconciled with the
 * loads before it). Its lines are counted on the records of those batches, the records their loaded rows created,
 * changed or found unchanged (a re-extract covers what it carries, whichever load created it), never on every migrated
 * record of the database:
 *   measure  counts and totals per object (clients, policies, open items, post-dated cheques, open claims, opening
 *            balances), in total and per group (client type, product, insurer, ageing bucket at the day before the
 *            cutover, cheque month, account), BrokerVerse value against the legacy value
 *   check    trial balance of the opening balances: debits against credits
 *   tieout   the sub-ledger tie-outs of migration.subledger_tieouts (maintained on the Reconciliation tab): the GL
 *            opening balance of the accounts named against the open items loaded (premiums receivable, also per
 *            insurer against the legacy listing), the cheques loaded against the legacy register, the legacy listing
 *            (due to insurers, commission receivable, unapplied collections), the legacy book balance (in total: the
 *            accounts of the tie-out, of the bank accounts or the Cash in Bank accounts; and per bank account) and the
 *            SAP trial balance (in total: the debit total; and per account). Account balances are compared on their
 *            normal side. A total needs its legacy figure before the sign-off, a group line only when one is given.
 * Legacy values come from the Control Totals sheet of the batches (workbook), entry on screen or an upload of a Control
 * Totals sheet or of a trial balance in its own layout (account code, debit, credit); a value entered on screen or
 * uploaded is kept by a recompute. Amounts are compared at two decimals:
 * counts exactly, amounts within the line's tolerance (migration.recon_amount_tolerance, or the tie-out's own); a
 * tolerance other than zero is set by a holder of approve:data-load with a reason.
 *
 * Differences: a line out of tolerance (measure; a tie-out or the trial balance: check), each workbook row of the
 * batches not loaded (not-loaded) and each migrated record outside the batches (extra: an earlier load, a single-object
 * import). Each is explained (write; who and when kept) and accepted (approve, with an acceptance note), the acceptance
 * never by a user who uploaded, submitted or approved one of the batches. A recompute keeps the explanation and the status of a difference found again; one no
 * longer found is fixed (an open one is dropped).
 *
 * Sign-off: the slots of migration.recon_signoffs, each signed with a remark by a holder of approve:data-load who did
 * not upload, submit or approve a batch of the reconciliation and signed no other slot of it (and holds one of the
 * slot's roles when it names some: Finance Head is signed by the finance role), once no difference is
 * open and every total has its legacy figure. The first signature freezes the reconciliation; the last makes it Signed
 * and keeps its PDF in the storage folder go-live-evidence with its SHA-256. The report carries counts, amounts, codes and
 * numbers only (no personal identifier), so the same file serves every reader. A load or an undo of the run afterwards
 * supersedes it: a new reconciliation is computed with the legacy figures entered on screen or uploaded. A load of
 * another run that changes its records supersedes it with no successor (the signed report stays as signed).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { getSetting, setSetting, clearSettingsCache } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { round2 } from '../../lib/money.js';
import { logger } from '../../lib/logger.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { renderPdf } from '../../lib/pdf/index.js';
import { formatAmount, formatDateTime } from '../../lib/pdf/format.js';
import { EVIDENCE_FOLDER, reserveKey, resolveKey, writeObject } from '../uploads/storage.js';
import { GO_LIVE_PREFIX } from '../period-end/opening.js';
import { CONTROL_MEASURES, SIGNED_MEASURES } from './migration.js';
import { readWorkbook } from '../documents/xlsx.js';
import { normKey } from '../documents/tabular.js';
import { readKitWorkbook } from './workbook.js';
import { goLiveState, kitSheets } from './service.js';
import { centavos, isDate } from './common.js';

const APPROVE = 'approve:data-load';
const TIEOUT = 'Tie-out';
const CHECKS = 'Checks';
const COUNT = 'count';
/** Objects of the measure lines, in report order (the Control Totals sheet's objects but the sub-ledger listings). */
export const MEASURE_OBJECTS = Object.keys(CONTROL_MEASURES).filter((o) => o !== 'Sub-ledger');
/** Sources of a tie-out's sub-ledger side and the labels of its two sides (total line; group lines of open-items). */
export const TIEOUT_SOURCES = {
  'open-items': { system: 'GL opening balance', other: 'Open items loaded', groupSystem: 'Open items loaded', groupOther: 'Legacy listing' },
  pdc: { system: 'Cheques loaded', other: 'Legacy register' },
  listing: { system: 'GL opening balance', other: 'Legacy listing' },
  bank: { system: 'GL opening balance', other: 'Legacy book balance' },
  sap: { system: 'BrokerVerse opening balance', other: 'SAP trial balance' },
};
const n2 = (v) => round2(Number(v || 0));
const norm = (v) => String(v ?? '').trim().toLowerCase();
const lineKey = (object, measure, grp) => `${object}|${measure}|${norm(grp)}`;
const COUNT_MEASURES = [COUNT, 'expiring within 90 days'];
/** Objects whose legacy figures some tie-out lines take (mirror). */
const MIRRORED = ['Open Items', 'Post-Dated Cheques'];
const isCount = (measure) => COUNT_MEASURES.includes(measure);

// ------------------------------------------------------------------ tie-out definitions

/** The sub-ledger tie-outs (setting migration.subledger_tieouts): [{ key, label, source, accounts, measure?, tolerance }]. */
export async function tieoutDefinitions() {
  const list = await getSetting('migration.subledger_tieouts', []);
  return (Array.isArray(list) ? list : []).filter((t) => t && t.key && TIEOUT_SOURCES[t.source]).map((t) => ({
    key: String(t.key), label: String(t.label || t.key), source: t.source, accounts: (Array.isArray(t.accounts) ? t.accounts : []).map(String).filter(Boolean),
    measure: t.measure ? String(t.measure).toLowerCase() : null, tolerance: Math.max(0, n2(t.tolerance)),
  }));
}

/** Replace the sub-ledger tie-outs (approve:data-load): each with a unique key, a label, its source, existing GL accounts and a tolerance. */
export async function saveTieouts(list, user, req) {
  if (!Array.isArray(list) || !list.length) throw badRequest('Validation failed', [{ path: 'tieouts', message: 'List the tie-outs' }]);
  const errors = [];
  const keys = new Set();
  const codes = new Set((await many('SELECT code FROM gl_accounts WHERE status = \'active\'')).map((a) => a.code));
  const out = list.map((t, i) => {
    const at = (field, message) => errors.push({ path: `tieouts[${i}].${field}`, message });
    const key = String(t?.key || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(key)) at('key', 'Key: 2 to 40 lowercase letters, digits or -');
    else if (keys.has(key)) at('key', `Key ${key} appears more than once`);
    keys.add(key);
    if (!String(t?.label || '').trim()) at('label', 'Give the label');
    if (!TIEOUT_SOURCES[t?.source]) at('source', `Source must be one of ${Object.keys(TIEOUT_SOURCES).join(', ')}`);
    const measure = t?.source === 'listing' ? String(t?.measure || '').trim().toLowerCase() : null;
    if (t?.source === 'listing' && !CONTROL_MEASURES['Sub-ledger'].includes(measure)) at('measure', `Measure of a legacy listing: one of ${CONTROL_MEASURES['Sub-ledger'].join(', ')}`);
    const accounts = [...new Set((Array.isArray(t?.accounts) ? t.accounts : []).map((a) => String(a).trim()).filter(Boolean))];
    const unknown = accounts.filter((a) => !codes.has(a));
    if (unknown.length) at('accounts', `Not an active GL account: ${unknown.join(', ')}`);
    const tolerance = Number(t?.tolerance ?? 0);
    if (!(tolerance >= 0) || Math.round(tolerance * 100) !== tolerance * 100) at('tolerance', 'Tolerance: zero or more, at most two decimals');
    return { key, label: String(t?.label || '').trim(), source: t?.source, ...(measure ? { measure } : {}), accounts, tolerance };
  });
  if (errors.length) throw badRequest('Validation failed', errors);
  const before = await tieoutDefinitions();
  await setSetting('migration.subledger_tieouts', out, user.id);
  clearSettingsCache();
  await audit(req, { entity: 'golive_setting', entityId: 'migration.subledger_tieouts', action: 'update', before: { tieouts: before }, after: { tieouts: out } });
  return tieoutDefinitions();
}

// ------------------------------------------------------------------ reading

const RECON_SELECT = `SELECT r.*, cu.display_name AS created_by_name FROM migration_reconciliations r LEFT JOIN users cu ON cu.id = r.created_by`;
const asAtOf = (cutover) => (isDate(cutover) ? new Date(Date.parse(`${cutover}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : null);

async function reconRow(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Reconciliation not found');
  const r = await one(`${RECON_SELECT} WHERE r.id = $1`, [Number(id)]);
  if (!r) throw notFound('Reconciliation not found');
  return r;
}

/**
 * Status of a line: matched, difference, or no-legacy (no legacy figure) / missing (a total with business and no legacy
 * figure: the sign-off waits for it).
 */
function lineStatus(l) {
  const system = n2(l.system_value);
  if (l.legacy_value === null || l.legacy_value === undefined) {
    if (system === 0) return 'matched';
    // a total needs its legacy figure before the sign-off; a group line (per insurer, per account) only when given
    return l.grp === '' && (l.kind === 'tieout' || (l.kind === 'measure' && (CONTROL_MEASURES[l.object] || []).includes(l.measure))) ? 'missing' : 'no-legacy';
  }
  return Math.abs(round2(system - n2(l.legacy_value))) <= n2(l.tolerance) + 0.004 ? 'matched' : 'difference';
}

/** Labels of the two sides of a line. */
function sidesOf(l, defs) {
  if (l.kind === 'check') return { system: 'Debits', other: 'Credits' };
  if (l.kind === 'measure') return { system: 'BrokerVerse', other: 'Legacy' };
  const s = TIEOUT_SOURCES[defs.find((d) => d.key === l.measure)?.source] || TIEOUT_SOURCES.listing;
  return l.grp && s.groupSystem ? { system: s.groupSystem, other: s.groupOther } : { system: s.system, other: s.other };
}

/** Measure as printed: "Gross premium"; a client type group: "Corporate". */
const capital = (s) => (s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s);
const groupLabel = (l) => (l.grp && l.object === 'Clients' ? capital(l.grp) : l.grp || null);

/** A line; accepted: the status of its difference (a difference accepted shows as such, not as an open difference). */
const lineOut = (l, defs, accepted = new Set()) => ({
  id: Number(l.id), kind: l.kind, object: l.object, measure: l.measure, group: l.grp || null,
  measureLabel: l.kind === 'tieout' ? null : capital(l.measure), groupLabel: groupLabel(l),
  label: l.kind === 'tieout' ? defs.find((d) => d.key === l.measure)?.label || l.measure : null, sides: sidesOf(l, defs),
  systemValue: n2(l.system_value), legacyValue: l.legacy_value === null ? null : n2(l.legacy_value), legacySource: l.legacy_source,
  difference: l.legacy_value === null ? null : round2(n2(l.system_value) - n2(l.legacy_value)), tolerance: n2(l.tolerance), toleranceReason: l.tolerance_reason,
  accounts: l.accounts || [], status: lineStatus(l) === 'difference' && accepted.has(Number(l.id)) ? 'accepted' : lineStatus(l),
  updatedBy: l.updated_by_name || l.updated_by, updatedAt: l.updated_at,
});
const differenceOut = (d) => ({
  id: Number(d.id), kind: d.kind, lineId: d.line_id === null ? null : Number(d.line_id), batchId: d.batch_id === null ? null : Number(d.batch_id), loadNumber: d.load_number || null,
  sheet: d.sheet, row: d.row_number, recordKey: d.record_key, description: d.description, amount: d.amount === null ? null : n2(d.amount), status: d.status,
  explanation: d.explanation, action: d.action, owner: d.owner, explainedBy: d.explained_by_name || d.explained_by, explainedById: d.explained_by, explainedAt: d.explained_at,
  acceptedBy: d.accepted_by_name || d.accepted_by, acceptedAt: d.accepted_at, acceptanceNote: d.acceptance_note,
});
const signoffOut = (s) => ({ slot: s.slot, label: s.label, roles: s.roles || [], signedBy: s.signed_by_name || s.signed_by, signedById: s.signed_by, signedAt: s.signed_at,
  remarks: s.remarks });

/** A reconciliation with its loads, lines, differences, sign-offs, the users who may not accept or sign it (makers) and summary. */
export async function getReconciliation(id) {
  const r = await reconRow(id);
  const defs = await tieoutDefinitions();
  const lines = await many(`SELECT l.*, u.display_name AS updated_by_name FROM migration_recon_lines l LEFT JOIN users u ON u.id = l.updated_by
    WHERE l.recon_id = $1 ORDER BY l.sort, l.object, l.measure, l.grp`, [r.id]);
  const diffs = await many(`SELECT d.*, b.load_number, u.display_name AS accepted_by_name, e.display_name AS explained_by_name FROM migration_recon_differences d
    LEFT JOIN data_load_batches b ON b.id = d.batch_id LEFT JOIN users u ON u.id = d.accepted_by LEFT JOIN users e ON e.id = d.explained_by WHERE d.recon_id = $1 ORDER BY CASE d.kind WHEN 'check' THEN 1 WHEN 'measure' THEN 2 WHEN 'not-loaded' THEN 3 ELSE 4 END, d.id`, [r.id]);
  const signoffs = await many(`SELECT s.*, u.display_name AS signed_by_name FROM migration_recon_signoffs s LEFT JOIN users u ON u.id = s.signed_by WHERE s.recon_id = $1 ORDER BY s.id`, [r.id]);
  const batches = await many('SELECT id, load_number, legacy_system, loaded_at, status FROM data_load_batches WHERE id = ANY($1) ORDER BY loaded_at NULLS LAST, id', [r.batch_ids || []]);
  const accepted = new Set(diffs.filter((d) => d.status === 'accepted' && d.line_id !== null).map((d) => Number(d.line_id)));
  const shown = lines.map((l) => lineOut(l, defs, accepted));
  return {
    id: Number(r.id), reconNumber: r.recon_number, runId: r.run_id === null ? null : Number(r.run_id), allBatches: r.all_batches, cutoverDate: r.cutover_date,
    openingBalancesAsAt: asAtOf(r.cutover_date), status: r.status, computedAt: r.computed_at, createdBy: r.created_by_name || r.created_by, createdById: r.created_by, createdAt: r.created_at,
    signedAt: r.signed_at, supersededAt: r.superseded_at, supersededBy: r.superseded_by === null ? null : Number(r.superseded_by), signedReport: !!r.report_file_key, reportSha256: r.report_sha256,
    batches: batches.map((b) => ({ id: Number(b.id), loadNumber: b.load_number, legacySystem: b.legacy_system, loadedAt: b.loaded_at, status: b.status })),
    lines: shown, differences: diffs.map(differenceOut), signoffs: signoffs.map(signoffOut), makers: await loaders(r),
    summary: {
      lines: shown.length, matched: shown.filter((l) => l.status === 'matched').length, differences: diffs.length,
      openDifferences: diffs.filter((d) => d.status === 'open').length, acceptedDifferences: diffs.filter((d) => d.status === 'accepted').length,
      missingLegacy: shown.filter((l) => l.status === 'missing').map((l) => ({ id: l.id, object: l.object, measure: l.label || l.measure, group: l.group })),
      signed: signoffs.filter((s) => s.signed_at).length, slots: signoffs.length,
    },
  };
}

/** Reconciliations, newest first: filters runId, status. */
export async function listReconciliations({ runId = null, status = null } = {}, pg = { limit: 50, offset: 0 }) {
  const where = `WHERE ($1::bigint IS NULL OR r.run_id = $1) AND ($2::text IS NULL OR r.status = $2)`;
  const params = [/^\d+$/.test(String(runId || '')) ? Number(runId) : null, status || null];
  const total = (await one(`SELECT count(*)::int AS n FROM migration_reconciliations r ${where}`, params)).n;
  const rows = await many(`${RECON_SELECT.replace('FROM migration_reconciliations r', `,
      (SELECT array_agg(b.load_number ORDER BY b.id) FROM data_load_batches b WHERE b.id = ANY(r.batch_ids)) AS load_numbers,
      (SELECT count(*)::int FROM migration_recon_differences d WHERE d.recon_id = r.id AND d.status = 'open') AS open_differences,
      (SELECT string_agg(COALESCE(u.display_name, s.signed_by), ', ' ORDER BY s.signed_at) FROM migration_recon_signoffs s LEFT JOIN users u ON u.id = s.signed_by
        WHERE s.recon_id = r.id AND s.signed_at IS NOT NULL) AS signed_by_names
    FROM migration_reconciliations r`)} ${where} ORDER BY r.id DESC LIMIT $3 OFFSET $4`, [...params, pg.limit, pg.offset]);
  return {
    total,
    rows: rows.map((r) => ({ id: Number(r.id), reconNumber: r.recon_number, runId: r.run_id === null ? null : Number(r.run_id), loads: r.load_numbers || [], cutoverDate: r.cutover_date,
      status: r.status, openDifferences: r.open_differences, signedBy: r.signed_by_names || null, createdBy: r.created_by_name || r.created_by, createdAt: r.created_at })),
  };
}

// ------------------------------------------------------------------ figures

/** Loaded migration batches of a run (runId null: the batches of no run). */
const runBatches = async (runId) => (await many(`SELECT id FROM data_load_batches WHERE kit = 'migration' AND status = 'loaded' AND run_id IS NOT DISTINCT FROM $1 ORDER BY id`,
  [runId])).map((b) => Number(b.id));

/**
 * The records of the batches: every record a loaded row created, changed or found unchanged (a re-extract loaded over
 * an earlier load covers the records it carries, whichever load created them). alias: the table's alias in the query.
 */
const ofBatches = (table, alias) => `${alias}.id::text IN (SELECT record_id FROM data_load_rows WHERE batch_id = ANY($1) AND record_table = '${table}' AND status = 'loaded')`;

/** Natural balance of an account: debit-positive for assets and expenses, credit-positive for the others. */
const NATURAL = `CASE WHEN a.account_type IN ('asset', 'expense') THEN o.balance ELSE -o.balance END`;

/** The BrokerVerse side of every measure, check and tie-out line: Map key -> { object, measure, grp, kind, value, other?, accounts, sort }. */
async function systemFigures(ids, cutover, defs) {
  const out = new Map();
  let sort = 0;
  const put = (object, measure, grp, value, extra = {}) => {
    const k = lineKey(object, measure, grp);
    if (!out.has(k)) out.set(k, { object, measure, grp: grp || '', kind: 'measure', value: 0, accounts: [], sort: sort += 1, ...extra });
    out.get(k).value = round2(out.get(k).value + n2(value));
    return out.get(k);
  };
  const totals = (object, measures, rows, groupOf) => {
    for (const m of measures) put(object, m.measure, '', 0);
    for (const r of rows) for (const m of measures) put(object, m.measure, '', r[m.column]);
    for (const [, by] of groupOf) {
      for (const r of rows) for (const m of measures) if (r[by] !== null && r[by] !== undefined) put(object, m.measure, String(r[by]), r[m.column]);
    }
  };

  const clients = await many(`SELECT client_type, count(*)::int AS n FROM clients c WHERE c.origin = 'migrated' AND ${ofBatches('clients', 'c')} GROUP BY 1 ORDER BY 1`, [ids]);
  totals('Clients', [{ measure: COUNT, column: 'n' }], clients, [['type', 'client_type']]);

  const policies = await many(`SELECT COALESCE(pr.code, p.product_type, p.lob, 'OTHER') AS product, ic.code AS insurer, count(*)::int AS n, COALESCE(sum(p.premium_total), 0) AS gross,
      COALESCE(sum(p.net_premium), 0) AS net, COALESCE(sum(p.sum_insured), 0) AS si, count(*) FILTER (WHERE p.expiry_date < $2::date + 90)::int AS expiring
    FROM policies p LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE p.origin = 'migrated' AND ${ofBatches('policies', 'p')} GROUP BY 1, 2 ORDER BY 1, 2`, [ids, cutover]);
  const products = new Set(policies.map((p) => norm(p.product)));
  const insurerGroup = (code) => (code && products.has(norm(code)) ? `Insurer ${code}` : code);
  totals('Policies', [{ measure: COUNT, column: 'n' }, { measure: 'gross premium', column: 'gross' }, { measure: 'net premium', column: 'net' }, { measure: 'sum insured', column: 'si' }],
    policies.map((p) => ({ ...p, insurer: insurerGroup(p.insurer) })), [['product', 'product'], ['insurer', 'insurer']]);
  put('Policies', 'expiring within 90 days', '', policies.reduce((s, p) => s + p.expiring, 0));

  const buckets = await getSetting('limits.receivable_ageing_buckets', [30, 60, 90, 120]);
  const items = await many(`SELECT ic.code AS insurer, rpt_age_bucket(($2::date - 1) - rv.due_date, $3::int[]) AS bucket, count(*)::int AS n,
      COALESCE(sum(rv.amount), 0) AS amount, COALESCE(sum(rv.balance), 0) AS balance
    FROM receivables rv LEFT JOIN policies p ON p.id = rv.policy_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE rv.origin = 'migrated' AND ${ofBatches('receivables', 'rv')} GROUP BY 1, 2 ORDER BY 1, 2`, [ids, cutover, Array.isArray(buckets) ? buckets.map(Number) : [30, 60, 90, 120]]);
  totals('Open Items', [{ measure: COUNT, column: 'n' }, { measure: 'original amount', column: 'amount' }, { measure: 'open balance', column: 'balance' }], items,
    [['insurer', 'insurer'], ['bucket', 'bucket']]);

  const cheques = await many(`SELECT to_char(d.cheque_date, 'YYYY-MM') AS month, count(*)::int AS n, COALESCE(sum(d.amount), 0) AS amount FROM post_dated_cheques d
    WHERE d.origin = 'migrated' AND ${ofBatches('post_dated_cheques', 'd')} AND d.status <> 'cancelled' GROUP BY 1 ORDER BY 1`, [ids]);
  totals('Post-Dated Cheques', [{ measure: COUNT, column: 'n' }, { measure: 'amount', column: 'amount' }], cheques, [['month', 'month']]);

  const claims = await many(`SELECT COALESCE(pr.code, p.product_type, c.lob, 'OTHER') AS product, count(*)::int AS n, COALESCE(sum(c.estimate_amount), 0) AS estimate
    FROM claims c LEFT JOIN policies p ON p.id = c.policy_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE c.origin = 'migrated' AND ${ofBatches('claims', 'c')} GROUP BY 1 ORDER BY 1`, [ids]);
  totals('Open Claims', [{ measure: COUNT, column: 'n' }, { measure: 'outstanding estimate', column: 'estimate' }], claims, [['product', 'product']]);

  const run = `${GO_LIVE_PREFIX}${cutover}`;
  const set = await many(`SELECT o.account_code, a.name AS account_name, o.balance, ${NATURAL} AS natural, o.load_batch_id FROM opening_balances o JOIN gl_accounts a ON a.code = o.account_code
    WHERE o.source_run = $1 ORDER BY o.account_code`, [run]);
  const loaded = set.filter((o) => ids.includes(Number(o.load_batch_id)));
  put('Opening Balances', 'debit', '', loaded.filter((o) => o.balance > 0).reduce((s, o) => s + n2(o.balance), 0));
  put('Opening Balances', 'credit', '', loaded.filter((o) => o.balance < 0).reduce((s, o) => s - n2(o.balance), 0));
  for (const o of loaded) put('Opening Balances', 'balance', o.account_code, o.natural);

  // checks and tie-outs read the whole opening balances set of the cutover (the GL side), whichever load carries it
  const debit = set.filter((o) => o.balance > 0).reduce((s, o) => s + n2(o.balance), 0);
  const credit = set.filter((o) => o.balance < 0).reduce((s, o) => s - n2(o.balance), 0);
  put(CHECKS, 'trial balance', '', debit, { kind: 'check', other: round2(credit) });
  const natural = new Map(set.map((o) => [o.account_code, n2(o.natural)]));
  const glOf = (accounts) => round2(accounts.reduce((s, a) => s + (natural.get(a) || 0), 0));
  const openTotal = round2(items.reduce((s, r) => s + n2(r.balance), 0));
  const openByInsurer = new Map();
  for (const r of items) if (r.insurer) openByInsurer.set(r.insurer, round2((openByInsurer.get(r.insurer) || 0) + n2(r.balance)));
  const chequesTotal = round2(cheques.reduce((s, r) => s + n2(r.amount), 0));
  for (const d of defs) {
    const tie = (grp, value, extra = {}) => put(TIEOUT, d.key, grp, value, { kind: 'tieout', accounts: d.accounts, tolerance: d.tolerance, ...extra });
    if (d.source === 'open-items') {
      tie('', glOf(d.accounts), { other: openTotal });
      // per insurer: the open items loaded against the legacy figure of the Open Items line of the insurer
      for (const [code, v] of openByInsurer) tie(code, v, { accounts: [], mirror: lineKey('Open Items', 'open balance', code) });
    } else if (d.source === 'pdc') {
      tie('', chequesTotal, { accounts: [], mirror: lineKey('Post-Dated Cheques', 'amount', '') });
    } else if (d.source === 'listing') {
      if (d.accounts.length) tie('', glOf(d.accounts));
    } else if (d.source === 'bank') {
      // the total: the accounts of the tie-out, else the accounts of the bank accounts, else the cash in bank accounts
      // of the chart; per bank account when they are linked to their GL account
      const links = await many('SELECT bank_account_code, gl_account_code FROM bank_account_links WHERE gl_account_code IS NOT NULL AND status <> \'deleted\' ORDER BY bank_account_code');
      const accounts = d.accounts.length ? d.accounts : links.length ? [...new Set(links.map((b) => b.gl_account_code))]
        : set.filter((o) => /^cash in bank/i.test(o.account_name || '')).map((o) => o.account_code);
      tie('', glOf(accounts), { accounts });
      for (const b of links) if (natural.has(b.gl_account_code)) tie(b.bank_account_code, natural.get(b.gl_account_code), { accounts: [b.gl_account_code] });
    } else if (d.source === 'sap') {
      // the total of a trial balance is its debit total (equal to its credit total)
      tie('', round2(debit), { accounts: [] });
      for (const [code, v] of natural) tie(code, v, { accounts: [code] });
    }
  }
  return out;
}

/**
 * Line key of a legacy figure ({ object, measure, group, legacyValue } of a Control Totals row), or null when no line
 * takes it: a measure of an object, or a sub-ledger listing of a tie-out (its total, the bank account, the account).
 */
function legacyKeyOf(row, defs) {
  const object = Object.keys(CONTROL_MEASURES).find((o) => norm(o) === norm(row.object));
  const measure = norm(row.measure);
  if (!object || !(CONTROL_MEASURES[object] || []).includes(measure)) return null;
  const grp = String(row.group ?? '').trim();
  if (object !== 'Sub-ledger') return { object, measure, grp };
  if (measure === 'cash in bank') {
    const d = defs.find((x) => x.source === 'bank');
    return d ? { object: TIEOUT, measure: d.key, grp } : null;
  }
  if (measure === 'sap trial balance') {
    const d = defs.find((x) => x.source === 'sap');
    return d ? { object: TIEOUT, measure: d.key, grp } : null;
  }
  const d = defs.find((x) => x.source === 'listing' && x.measure === measure);
  return d ? { object: TIEOUT, measure: d.key, grp: '' } : null;
}

/** Legacy figures of the Control Totals rows of the batches, summed per line key: Map key -> { object, measure, grp, value }. */
async function workbookFigures(ids, defs) {
  const rows = await many(`SELECT data FROM data_load_rows WHERE batch_id = ANY($1) AND sheet = 'control-totals' AND status <> 'error' ORDER BY batch_id, row_number`, [ids]);
  const out = new Map();
  for (const r of rows) {
    const k = legacyKeyOf(r.data || {}, defs);
    const v = Number(String(r.data?.legacyValue ?? '').replace(/,/g, ''));
    if (!k || !Number.isFinite(v)) continue;
    const key = lineKey(k.object, k.measure, k.grp);
    if (!out.has(key)) out.set(key, { ...k, value: 0 });
    out.get(key).value = round2(out.get(key).value + v);
  }
  return out;
}

/** Workbook rows of the batches that were not loaded (error, duplicate, skipped), the Control Totals rows aside. */
async function notLoaded(ids) {
  const sheets = Object.fromEntries((await kitSheets('migration')).map((s) => [s.key, s]));
  const rows = await many(`SELECT d.batch_id, d.sheet, d.row_number, d.record_key, d.data, d.errors, d.status FROM data_load_rows d
    WHERE d.batch_id = ANY($1) AND d.status IN ('error', 'duplicate', 'skipped') AND d.sheet <> 'control-totals' ORDER BY d.batch_id, d.sheet, d.row_number`, [ids]);
  return rows.map((r) => {
    const s = sheets[r.sheet];
    const key = r.record_key || (s ? s.keyColumns.map((k) => r.data?.[k] || '-').join(' / ') : null);
    const why = r.status === 'duplicate' ? 'duplicate not resolved' : r.status === 'skipped' ? 'skipped' : ((r.errors || []).find((e) => !e.held)?.message || 'held with its sheet');
    return { kind: 'not-loaded', batch_id: Number(r.batch_id), sheet: s?.name || r.sheet, row_number: r.row_number, record_key: key,
      description: `${s?.name || r.sheet} row ${r.row_number} (${key}) not loaded: ${why}`, amount: null };
  });
}

/** Migrated records outside the batches (an earlier load, another run, a single-object import). */
async function extraRecords(ids, cutover) {
  const label = (b) => (b ? `load ${b}` : 'no load: single-object import');
  const rows = await many(`
    SELECT 'Clients' AS sheet, c.client_code AS key, b.load_number FROM clients c LEFT JOIN data_load_batches b ON b.id = c.load_batch_id
      WHERE c.origin = 'migrated' AND NOT ${ofBatches('clients', 'c')}
    UNION ALL SELECT 'Policies', p.policy_number, b.load_number FROM policies p LEFT JOIN data_load_batches b ON b.id = p.load_batch_id
      WHERE p.origin = 'migrated' AND NOT ${ofBatches('policies', 'p')}
    UNION ALL SELECT 'Open Items', COALESCE(r.legacy_number, r.bill_number), b.load_number FROM receivables r LEFT JOIN data_load_batches b ON b.id = r.load_batch_id
      WHERE r.origin = 'migrated' AND NOT ${ofBatches('receivables', 'r')}
    UNION ALL SELECT 'Post-Dated Cheques', COALESCE(d.legacy_number, d.cheque_number), b.load_number FROM post_dated_cheques d LEFT JOIN data_load_batches b ON b.id = d.load_batch_id
      WHERE d.origin = 'migrated' AND d.status <> 'cancelled' AND NOT ${ofBatches('post_dated_cheques', 'd')}
    UNION ALL SELECT 'Open Claims', c.claim_number, b.load_number FROM claims c LEFT JOIN data_load_batches b ON b.id = c.load_batch_id
      WHERE c.origin = 'migrated' AND NOT ${ofBatches('claims', 'c')}
    UNION ALL SELECT 'Opening Balances', o.account_code, b.load_number FROM opening_balances o LEFT JOIN data_load_batches b ON b.id = o.load_batch_id
      WHERE o.source_run = $2 AND (o.load_batch_id IS NULL OR NOT (o.load_batch_id = ANY($1)))
    ORDER BY 1, 2`, [ids, `${GO_LIVE_PREFIX}${cutover}`]);
  return rows.map((r) => ({ kind: 'extra', batch_id: null, sheet: r.sheet, row_number: null, record_key: r.key,
    description: `${r.sheet} ${r.key}: migrated outside the loads of this reconciliation (${label(r.load_number)})`, amount: null }));
}

/** Differences of the lines: a measure out of tolerance, a check or a tie-out that does not agree. */
function lineDifferences(lines) {
  return lines.filter((l) => lineStatus(l) === 'difference').map((l) => {
    const diff = round2(n2(l.system_value) - n2(l.legacy_value));
    const what = l.kind === 'measure' ? `${l.object} ${l.measure}${l.grp ? ` (${l.grp})` : ''}` : l.kind === 'check' ? 'Trial balance: debits and credits'
      : `Tie-out ${l.measure}${l.grp ? ` (${l.grp})` : ''}`;
    return { kind: l.kind === 'measure' ? 'measure' : 'check', line_id: Number(l.id), batch_id: null, sheet: null, row_number: null, record_key: null,
      description: `${what}: ${n2(l.system_value)} against ${n2(l.legacy_value)}`, amount: diff };
  });
}

const identity = (d) => (d.line_id ? `line:${d.line_id}` : d.kind === 'not-loaded' ? `row:${d.batch_id}:${d.sheet}:${d.row_number}` : `${d.kind}:${d.sheet}:${d.record_key}`);

/**
 * Write the differences found (generated) over the stored ones: one found again keeps its explanation and status (a
 * fixed one is open again); one no longer found is fixed when it was explained or accepted, else dropped.
 */
async function syncDifferences(db, reconId, generated) {
  const stored = (await db.query('SELECT * FROM migration_recon_differences WHERE recon_id = $1', [reconId])).rows;
  const byId = new Map(stored.map((d) => [identity(d), d]));
  const seen = new Set();
  for (const g of generated) {
    const id = identity(g);
    if (seen.has(id)) continue;
    seen.add(id);
    const s = byId.get(id);
    if (s) {
      await db.query(`UPDATE migration_recon_differences SET description = $2, amount = $3, status = CASE WHEN status = 'fixed' THEN 'open' ELSE status END WHERE id = $1`,
        [s.id, g.description, g.amount]);
    } else {
      await db.query(`INSERT INTO migration_recon_differences(recon_id, kind, line_id, batch_id, sheet, row_number, record_key, description, amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [reconId, g.kind, g.line_id, g.batch_id, g.sheet, g.row_number, g.record_key, g.description.slice(0, 1000), g.amount]);
    }
  }
  for (const s of stored) {
    if (seen.has(identity(s))) continue;
    if (s.status === 'open') await db.query('DELETE FROM migration_recon_differences WHERE id = $1', [s.id]);
    else if (s.status !== 'fixed') await db.query('UPDATE migration_recon_differences SET status = \'fixed\' WHERE id = $1', [s.id]);
  }
}

/** Default tolerance of a new line: counts 0, a tie-out its own, amounts migration.recon_amount_tolerance. */
const defaultTolerance = async (f) => {
  if (isCount(f.measure)) return 0;
  if (f.kind === 'tieout') return n2(f.tolerance);
  if (f.kind === 'check') return 0;
  return Math.max(0, n2(await getSetting('migration.recon_amount_tolerance', 0)));
};

/**
 * Compute a reconciliation in a transaction: its batches (all loaded migration batches of the run when all_batches),
 * the BrokerVerse side of every line, the legacy figures of the workbook (a value entered on screen or uploaded is kept),
 * the lines no longer computed and without such a value removed, and the differences.
 */
async function compute(db, recon) {
  const ids = recon.all_batches ? await runBatches(recon.run_id) : (recon.batch_ids || []).map(Number);
  const defs = await tieoutDefinitions();
  const system = await systemFigures(ids, recon.cutover_date, defs);
  const workbook = await workbookFigures(ids, defs);
  const existing = (await db.query('SELECT * FROM migration_recon_lines WHERE recon_id = $1', [recon.id])).rows;
  const kept = new Map(existing.filter((l) => ['screen', 'upload'].includes(l.legacy_source)).map((l) => [lineKey(l.object, l.measure, l.grp), l]));
  // a legacy group written another way than the BrokerVerse group ('motor' and 'MOTOR') is the same line
  const groups = new Map([...system.values()].map((f) => [lineKey(f.object, f.measure, f.grp), f.grp]));
  const keys = new Map();
  for (const [k, f] of system) keys.set(k, { ...f });
  for (const [k, f] of workbook) if (!keys.has(k)) keys.set(k, { object: f.object, measure: f.measure, grp: groups.get(k) ?? f.grp, kind: f.object === TIEOUT ? 'tieout' : 'measure', value: 0, accounts: [], sort: 9000 });
  for (const [k, l] of kept) if (!keys.has(k)) keys.set(k, { object: l.object, measure: l.measure, grp: l.grp, kind: l.kind, value: 0, accounts: l.accounts || [], sort: l.sort });
  for (const [k, f] of keys) {
    // a mirror line (a tie-out of the open items per insurer, of the cheques) takes the legacy figure of its measure line
    const from = f.mirror || k;
    const keep = kept.get(from);
    const computedOther = f.other !== undefined;
    const legacy = computedOther ? f.other : keep ? Number(keep.legacy_value) : workbook.has(from) ? workbook.get(from).value : null;
    const source = computedOther ? null : keep ? keep.legacy_source : workbook.has(from) ? 'workbook' : null;
    await db.query(`INSERT INTO migration_recon_lines(recon_id, object, measure, grp, legacy_value, legacy_source, system_value, tolerance, kind, accounts, sort)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (recon_id, object, measure, grp) DO UPDATE SET legacy_value = EXCLUDED.legacy_value, legacy_source = EXCLUDED.legacy_source, system_value = EXCLUDED.system_value,
        kind = EXCLUDED.kind, accounts = EXCLUDED.accounts, sort = EXCLUDED.sort`,
    [recon.id, f.object, f.measure, f.grp || '', legacy, source, n2(f.value), await defaultTolerance(f), f.kind, f.accounts || [], f.sort || 0]);
  }
  // lines no longer computed and without a legacy figure of their own, and a group kept under another spelling
  const wanted = new Set([...keys.values()].map((f) => `${f.object}|${f.measure}|${f.grp || ''}`));
  for (const l of existing) {
    if (!wanted.has(`${l.object}|${l.measure}|${l.grp}`)) await db.query('DELETE FROM migration_recon_lines WHERE id = $1', [l.id]);
  }
  const lines = (await db.query('SELECT * FROM migration_recon_lines WHERE recon_id = $1', [recon.id])).rows;
  await syncDifferences(db, recon.id, [...lineDifferences(lines), ...(await notLoaded(ids)), ...(await extraRecords(ids, recon.cutover_date))]);
  await db.query('UPDATE migration_reconciliations SET batch_ids = $2, computed_at = now() WHERE id = $1', [recon.id, ids]);
}

/** Differences again after a legacy figure or a tolerance changed (the record differences stay as computed). */
async function refreshLineDifferences(db, reconId) {
  const lines = (await db.query('SELECT * FROM migration_recon_lines WHERE recon_id = $1', [reconId])).rows;
  const records = (await db.query('SELECT * FROM migration_recon_differences WHERE recon_id = $1 AND kind IN (\'not-loaded\', \'extra\')', [reconId])).rows;
  await syncDifferences(db, reconId, [...lineDifferences(lines), ...records.map((d) => ({ ...d, batch_id: d.batch_id === null ? null : Number(d.batch_id) }))]);
}

// ------------------------------------------------------------------ changes

/** Users who uploaded, submitted or approved (loaded) a batch of the reconciliation: none of them accepts or signs. */
async function loaders(recon) {
  const rows = await many('SELECT created_by, submitted_by, decided_by, loaded_by FROM data_load_batches WHERE id = ANY($1)', [recon.batch_ids || []]);
  return [...new Set(rows.flatMap((b) => [b.created_by, b.submitted_by, b.decided_by, b.loaded_by]).filter(Boolean))];
}
async function assertNotLoader(user, recon, what) {
  for (const maker of await loaders(recon)) await assertChecker(user, maker, what, { configurable: false });
}

/** A reconciliation that may still change: open, no slot signed yet. */
async function openRecon(id) {
  const r = await reconRow(id);
  if (r.status !== 'open') throw conflict(`Reconciliation ${r.recon_number} is ${r.status}: it can no longer change`);
  const signed = await one('SELECT count(*)::int AS n FROM migration_recon_signoffs WHERE recon_id = $1 AND signed_at IS NOT NULL', [r.id]);
  if (signed.n) throw conflict(`Reconciliation ${r.recon_number} is being signed: it can no longer change`);
  return r;
}

/**
 * Create a reconciliation (write:data-load): { runId, batchIds? }; without batchIds, every loaded migration batch of the
 * run (refreshed on recompute). The batches must be loaded migration batches of the cutover date.
 */
export async function createReconciliation(body, user, req, { supersedes = null } = {}) {
  const { cutoverDate } = await goLiveState();
  if (!cutoverDate) throw conflict('Set the cutover date first');
  const runId = body?.runId === undefined || body?.runId === null || body?.runId === '' ? null : Number(body.runId);
  if (runId !== null && !Number.isInteger(runId)) throw badRequest('Validation failed', [{ path: 'runId', message: 'Run must be the id of a run' }]);
  if (runId !== null && (await one('SELECT to_regclass(\'migration_runs\') IS NOT NULL AS ok')).ok && !(await one('SELECT id FROM migration_runs WHERE id = $1', [runId]))) {
    throw notFound('Run not found');
  }
  const chosen = Array.isArray(body?.batchIds) && body.batchIds.length ? [...new Set(body.batchIds.map(Number))] : null;
  if (chosen) {
    // a delta load is reconciled with the loads before it, whichever run loaded them
    const ok = await many(`SELECT id FROM data_load_batches WHERE id = ANY($1) AND kit = 'migration' AND status = 'loaded' AND cutover_date = $2::date`, [chosen, cutoverDate]);
    const bad = chosen.filter((id) => !ok.some((b) => Number(b.id) === id));
    if (bad.length) throw badRequest('Validation failed', [{ path: 'batchIds', message: `Not a loaded migration load of the cutover date: ${bad.join(', ')}` }]);
  } else if (!(await runBatches(runId)).length && !supersedes) {
    throw conflict('No migration load of this run is loaded yet');
  }
  const slots = await getSetting('migration.recon_signoffs', []);
  const list = (Array.isArray(slots) ? slots : []).filter((s) => s?.slot && s?.label)
    .map((s) => ({ ...s, roles: Array.isArray(s.roles) ? s.roles.map(String).filter(Boolean) : [] }));
  if (!list.length) throw conflict('No sign-off is configured for the reconciliation');
  const id = await withTransaction(async (db) => {
    const r = (await db.query(`INSERT INTO migration_reconciliations(run_id, batch_ids, all_batches, cutover_date, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [runId, chosen || [], !chosen, cutoverDate, user.id])).rows[0];
    for (const s of list) {
      await db.query('INSERT INTO migration_recon_signoffs(recon_id, slot, label, roles) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [r.id, String(s.slot), String(s.label), s.roles]);
    }
    if (supersedes) {
      // the legacy figures entered on screen or uploaded on the reconciliation it replaces
      await db.query(`INSERT INTO migration_recon_lines(recon_id, object, measure, grp, legacy_value, legacy_source, tolerance, tolerance_reason, kind, accounts, sort, updated_by, updated_at)
        SELECT $1, object, measure, grp, legacy_value, legacy_source, tolerance, tolerance_reason, kind, accounts, sort, updated_by, updated_at FROM migration_recon_lines
        WHERE recon_id = $2 AND (legacy_source IN ('screen', 'upload') OR tolerance_reason IS NOT NULL)`, [r.id, supersedes]);
    }
    await compute(db, r);
    return r.id;
  });
  const out = await getReconciliation(id);
  await audit(req, { entity: 'migration_reconciliation', entityId: out.id, action: 'create', after: { reconNumber: out.reconNumber, runId, loads: out.batches.map((b) => b.loadNumber),
    lines: out.summary.lines, differences: out.summary.differences, ...(supersedes ? { supersedes } : {}) } });
  return out;
}

/** Recompute an open reconciliation (write:data-load): figures of the records and the workbook again. */
export async function recompute(id, user, req) {
  const r = await openRecon(id);
  await withTransaction((db) => compute(db, r));
  const out = await getReconciliation(r.id);
  await audit(req, { entity: 'migration_reconciliation', entityId: out.id, action: 'recompute', after: { lines: out.summary.lines, differences: out.summary.differences,
    openDifferences: out.summary.openDifferences } });
  return out;
}

/**
 * Change a line: { legacyValue } (write:data-load; a measure, or the legacy side of a tie-out), and { tolerance,
 * toleranceReason }: a tolerance other than zero needs approve:data-load, a reason, and a user who did not load the
 * batches; a count is always exact.
 */
export async function updateLine(id, lineId, body, user, req) {
  const r = await openRecon(id);
  const l = await one('SELECT * FROM migration_recon_lines WHERE id = $1 AND recon_id = $2', [Number(lineId) || 0, r.id]);
  if (!l) throw notFound('Line not found');
  const defs = await tieoutDefinitions();
  const sets = {};
  if (body?.legacyValue !== undefined) {
    if (!hasPermission(user, 'write:data-load')) throw forbidden('Legacy figures are entered by a user who loads data (write:data-load)');
    const source = defs.find((d) => d.key === l.measure)?.source;
    if (l.kind === 'check' || (l.kind === 'tieout' && source === 'open-items' && !l.grp)) throw conflict('Both sides of this line are BrokerVerse figures: there is no legacy figure to enter');
    if (l.kind === 'tieout' && ['open-items', 'pdc'].includes(source)) throw conflict('This tie-out takes the legacy figure of its Open Items or Post-Dated Cheques line: enter it there');
    const v = body.legacyValue === null || body.legacyValue === '' ? null : Number(String(body.legacyValue).replace(/,/g, ''));
    if (v !== null && (!Number.isFinite(v) || centavos(v) === null || (v < 0 && l.kind === 'measure' && !SIGNED_MEASURES.includes(l.measure))
      || (isCount(l.measure) && !Number.isInteger(v)))) {
      throw badRequest('Validation failed', [{ path: 'legacyValue', message: isCount(l.measure) ? 'A count is a whole number' : 'Legacy value: a number with at most two decimals' }]);
    }
    sets.legacy_value = v;
    sets.legacy_source = v === null ? null : 'screen';
  }
  if (body?.tolerance !== undefined) {
    const t = Number(body.tolerance);
    if (!(t >= 0) || Math.round(t * 100) !== t * 100) throw badRequest('Validation failed', [{ path: 'tolerance', message: 'Tolerance: zero or more, at most two decimals' }]);
    if (t !== 0 && isCount(l.measure)) throw badRequest('Validation failed', [{ path: 'tolerance', message: 'A count is always exact' }]);
    const reason = String(body.toleranceReason || '').trim();
    if (t !== 0) {
      if (!hasPermission(user, APPROVE)) throw forbidden('A tolerance other than zero is set by a user who approves data loads (approve:data-load)');
      if (!reason) throw badRequest('Validation failed', [{ path: 'toleranceReason', message: 'Give the reason of the tolerance' }]);
      await assertNotLoader(user, r, 'tolerance');
    }
    sets.tolerance = t;
    sets.tolerance_reason = t === 0 ? null : reason.slice(0, 500);
  }
  if (!Object.keys(sets).length) throw badRequest('Nothing to change');
  const cols = Object.keys(sets);
  await withTransaction(async (db) => {
    await db.query(`UPDATE migration_recon_lines SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2}, updated_at = now() WHERE id = $1`,
      [l.id, ...cols.map((c) => sets[c]), user.id]);
    // the tie-outs that take the legacy figure of this line (open items per insurer, cheques) take the new one at once
    if (sets.legacy_value !== undefined && MIRRORED.includes(l.object)) await compute(db, r);
    else await refreshLineDifferences(db, r.id);
  });
  const after = await one('SELECT * FROM migration_recon_lines WHERE id = $1', [l.id]);
  await audit(req, { entity: 'migration_reconciliation', entityId: Number(r.id), action: sets.tolerance !== undefined ? 'tolerance' : 'legacy-update',
    before: lineOut(l, defs), after: lineOut(after, defs) });
  return getReconciliation(r.id);
}

const TB_CODE = ['accountcode', 'account', 'accountno', 'accountnumber', 'glaccount', 'glaccountcode', 'glcode'];
const TB_DEBIT = ['debit', 'debitbalance', 'debitphp'];
const TB_CREDIT = ['credit', 'creditbalance', 'creditphp'];

/**
 * A legacy trial balance in its own layout (a title above the header is allowed): the first sheet whose header, within
 * its first ten rows, has an account code, a debit and a credit column. Returns [{ rowNumber, accountCode, debit,
 * credit }] or null when no sheet has that layout.
 */
function readTrialBalance(buffer) {
  let book;
  try {
    book = readWorkbook(buffer);
  } catch {
    return null;
  }
  for (const ws of book) {
    for (let h = 0; h < Math.min(10, ws.rows.length); h += 1) {
      const header = (ws.rows[h] || []).map((x) => normKey(x));
      const at = (names) => header.findIndex((x) => names.includes(x));
      const [code, debit, credit] = [at(TB_CODE), at(TB_DEBIT), at(TB_CREDIT)];
      if (code < 0 || debit < 0 || credit < 0) continue;
      const out = [];
      ws.rows.slice(h + 1).forEach((cells, i) => {
        const accountCode = String(cells[code] ?? '').trim();
        if (!accountCode || /^total/i.test(accountCode)) return;
        out.push({ rowNumber: h + i + 2, accountCode, debit: cells[debit], credit: cells[credit] });
      });
      return out;
    }
  }
  return null;
}

/**
 * The legacy figures of a trial balance (SAP or the legacy ledger): each account on its normal side against the SAP
 * trial balance tie-out of the account, and the debit total against its total. All or nothing.
 */
async function trialBalanceFigures(rows, defs) {
  const d = defs.find((x) => x.source === 'sap');
  if (!d) throw badRequest('No tie-out takes a trial balance: add a tie-out with the source SAP trial balance first');
  const accounts = new Map((await many('SELECT code, account_type FROM gl_accounts')).map((a) => [a.code, a.account_type]));
  const errors = [];
  const figures = new Map();
  let debits = 0;
  let credits = 0;
  for (const row of rows) {
    const amount = (v, column) => {
      const n = v === null || v === undefined || String(v).trim() === '' ? 0 : Number(String(v).replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0 || centavos(n) === null) errors.push({ row: row.rowNumber, column, message: `${column}: an amount of zero or more with at most two decimals` });
      return Number.isFinite(n) ? n : 0;
    };
    const debit = amount(row.debit, 'Debit');
    const credit = amount(row.credit, 'Credit');
    const type = accounts.get(row.accountCode);
    if (!type) { errors.push({ row: row.rowNumber, column: 'Account Code', message: `Account ${row.accountCode} is not in the chart of accounts` }); continue; }
    debits += debit;
    credits += credit;
    const natural = ['asset', 'expense'].includes(type) ? debit - credit : credit - debit;
    const key = lineKey(TIEOUT, d.key, row.accountCode);
    if (!figures.has(key)) figures.set(key, { object: TIEOUT, measure: d.key, grp: row.accountCode, value: 0 });
    figures.get(key).value = round2(figures.get(key).value + natural);
  }
  if (!errors.length && Math.abs(round2(debits - credits)) > 0.004) {
    errors.push({ row: null, column: null, message: `The trial balance does not balance: debits ${round2(debits)} against credits ${round2(credits)}` });
  }
  if (errors.length) throw badRequest(`${errors.length} row(s) in error: nothing was loaded`, errors.slice(0, 100).map((e) => ({ path: e.row ? `row ${e.row}` : 'file', ...e })));
  figures.set(lineKey(TIEOUT, d.key, ''), { object: TIEOUT, measure: d.key, grp: '', value: round2(debits) });
  return figures;
}

/**
 * Upload legacy figures (write:data-load), all or nothing: a workbook with a Control Totals sheet (object, measure,
 * group, legacy value), or a trial balance in its own layout (account code, debit, credit) for the SAP trial balance
 * tie-out. Each figure sets the legacy figure of its line (upload), a line created when BrokerVerse has none.
 */
export async function uploadLegacy(id, buffer, user, req) {
  const r = await openRecon(id);
  const sheets = await kitSheets('migration');
  const control = sheets.find((s) => s.key === 'control-totals');
  const defs = await tieoutDefinitions();
  let read;
  try {
    read = readKitWorkbook(buffer, sheets, 'migration')['control-totals'];
  } catch (e) {
    if (e.status !== 400) throw e;
    const tb = readTrialBalance(buffer);
    if (!tb) throw badRequest('The workbook has neither a Control Totals sheet nor a trial balance (columns Account Code, Debit and Credit)');
    if (!tb.length) throw badRequest('The trial balance has no rows');
    return saveLegacyFigures(r, await trialBalanceFigures(tb, defs), user, req, 'trial-balance');
  }
  if (!read?.length) throw badRequest('The workbook has no Control Totals sheet, or the sheet has no rows');
  const errors = [];
  const figures = new Map();
  for (const row of read) {
    try {
      for (const c of control.columns.filter((x) => x.required)) if (row.values[c.key] === undefined || String(row.values[c.key]).trim() === '') throw badRequest(`${c.header} is required`, [{ path: c.key }]);
      await control.importRow({}, row.values);
    } catch (e) {
      errors.push({ row: row.rowNumber, column: e.details?.[0]?.path || null, message: e.message });
      continue;
    }
    const k = legacyKeyOf(row.values, defs);
    if (!k) {
      errors.push({ row: row.rowNumber, column: 'measure', message: `No tie-out takes ${row.values.object} ${row.values.measure}` });
      continue;
    }
    const key = lineKey(k.object, k.measure, k.grp);
    if (!figures.has(key)) figures.set(key, { ...k, value: 0 });
    figures.get(key).value = round2(figures.get(key).value + Number(String(row.values.legacyValue).replace(/,/g, '')));
  }
  if (errors.length) throw badRequest(`${errors.length} row(s) in error: nothing was loaded`, errors.slice(0, 100).map((e) => ({ path: `row ${e.row}`, ...e })));
  return saveLegacyFigures(r, figures, user, req, 'control-totals');
}

/** Write uploaded legacy figures on their lines and compute the reconciliation again. */
async function saveLegacyFigures(r, figures, user, req, layout) {
  await withTransaction(async (db) => {
    const existing = (await db.query('SELECT id, object, measure, grp FROM migration_recon_lines WHERE recon_id = $1', [r.id])).rows;
    for (const f of figures.values()) {
      const line = existing.find((l) => lineKey(l.object, l.measure, l.grp) === lineKey(f.object, f.measure, f.grp));
      if (line) {
        await db.query('UPDATE migration_recon_lines SET legacy_value = $2, legacy_source = \'upload\', updated_by = $3, updated_at = now() WHERE id = $1', [line.id, f.value, user.id]);
      } else {
        await db.query(`INSERT INTO migration_recon_lines(recon_id, object, measure, grp, legacy_value, legacy_source, kind, sort, updated_by, updated_at)
          VALUES ($1,$2,$3,$4,$5,'upload',$6,9000,$7,now())`, [r.id, f.object, f.measure, f.grp, f.value, f.object === TIEOUT ? 'tieout' : 'measure', user.id]);
      }
    }
    await compute(db, await reconRow(r.id));
  });
  await audit(req, { entity: 'migration_reconciliation', entityId: Number(r.id), action: 'legacy-update', after: { upload: true, layout, figures: figures.size } });
  return getReconciliation(r.id);
}

async function differenceOf(r, diffId) {
  const d = await one('SELECT * FROM migration_recon_differences WHERE id = $1 AND recon_id = $2', [Number(diffId) || 0, r.id]);
  if (!d) throw notFound('Difference not found');
  return d;
}

/** Explain a difference (write:data-load): { explanation, action, owner, status: explained | fixed }. */
export async function explainDifference(id, diffId, body, user, req) {
  const r = await openRecon(id);
  const d = await differenceOf(r, diffId);
  const explanation = String(body?.explanation || '').trim();
  if (!explanation) throw badRequest('Validation failed', [{ path: 'explanation', message: 'Give the explanation' }]);
  const status = body?.status || 'explained';
  if (!['explained', 'fixed'].includes(status)) throw badRequest('Validation failed', [{ path: 'status', message: 'Status must be explained or fixed' }]);
  if (d.status === 'accepted') throw conflict('The difference is accepted');
  await query('UPDATE migration_recon_differences SET explanation = $2, action = $3, owner = $4, status = $5, explained_by = $6, explained_at = now() WHERE id = $1',
    [d.id, explanation.slice(0, 2000), String(body?.action || '').trim().slice(0, 1000) || null, String(body?.owner || '').trim().slice(0, 200) || null, status, user.id]);
  const after = await one('SELECT * FROM migration_recon_differences WHERE id = $1', [d.id]);
  await audit(req, { entity: 'migration_reconciliation', entityId: Number(r.id), action: 'explain', before: differenceOut(d), after: differenceOut(after) });
  return getReconciliation(r.id);
}

/**
 * Accept a difference (approve:data-load), never by a user who uploaded, submitted or approved a batch of the
 * reconciliation nor the user who explained it. The explanation and who gave it stay as they are; the acceptor's text is
 * the acceptance note (the explanation too when the difference had none, given then by the acceptor).
 */
export async function acceptDifference(id, diffId, body, user, req) {
  const r = await openRecon(id);
  const d = await differenceOf(r, diffId);
  if (!['open', 'explained'].includes(d.status)) throw conflict(`The difference is ${d.status}`);
  await assertNotLoader(user, r, 'difference');
  if (d.explained_by && d.explained_by === user.id) throw forbidden('You explained this difference: another user accepts it');
  const note = String(body?.explanation || '').trim();
  if (!note && !d.explanation) throw badRequest('Validation failed', [{ path: 'explanation', message: 'Explain the difference before it is accepted' }]);
  const moved = await one(`UPDATE migration_recon_differences SET status = 'accepted', accepted_by = $3, accepted_at = now(), acceptance_note = $2,
      explanation = COALESCE(explanation, $2), explained_by = COALESCE(explained_by, CASE WHEN explanation IS NULL THEN $3 END),
      explained_at = COALESCE(explained_at, CASE WHEN explanation IS NULL THEN now() END)
    WHERE id = $1 AND status IN ('open', 'explained') RETURNING *`, [d.id, note ? note.slice(0, 2000) : null, user.id]);
  if (!moved) throw conflict('The difference was changed by another user');
  await audit(req, { entity: 'migration_reconciliation', entityId: Number(r.id), action: 'accept', before: differenceOut(d), after: differenceOut(moved) });
  return getReconciliation(r.id);
}

/**
 * Sign a slot (approve:data-load) with a remark: not a user who uploaded, submitted or approved a batch, nor one who
 * signed another slot; no open difference and every total with its legacy figure. The last slot makes the
 * reconciliation Signed and freezes its PDF.
 */
export async function signSlot(id, slot, { remarks }, user, req) {
  const r = await reconRow(id);
  if (r.status !== 'open') throw conflict(`Reconciliation ${r.recon_number} is ${r.status}`);
  const s = await one('SELECT * FROM migration_recon_signoffs WHERE recon_id = $1 AND slot = $2', [r.id, String(slot)]);
  if (!s) throw notFound('Sign-off not found');
  if (s.signed_at) throw conflict(`${s.label} is already signed`);
  const note = String(remarks || '').trim();
  if (!note) throw badRequest('Validation failed', [{ path: 'remarks', message: 'Give the remark of the sign-off' }]);
  await assertNotLoader(user, r, 'reconciliation');
  // a slot named for roles (Finance Head: the finance role) is signed by a holder of one of them
  if ((s.roles || []).length && !(user.roles || []).some((x) => s.roles.includes(x))) {
    const names = (await many('SELECT name FROM roles WHERE code = ANY($1) ORDER BY name', [s.roles])).map((x) => x.name);
    throw forbidden(`${s.label} is signed by a user of the role ${(names.length ? names : s.roles).join(' or ')}`);
  }
  const other = await one('SELECT label FROM migration_recon_signoffs WHERE recon_id = $1 AND signed_by = $2', [r.id, user.id]);
  if (other) throw forbidden(`You signed ${other.label}: another user signs ${s.label}`);
  const current = await getReconciliation(r.id);
  if (current.summary.openDifferences) throw conflict(`${current.summary.openDifferences} difference(s) are open: explain, accept or fix them first`);
  if (current.summary.missingLegacy.length) {
    throw conflict(`Enter the legacy figures first: ${current.summary.missingLegacy.slice(0, 10).map((m) => `${m.object} ${m.measure}${m.group ? ` (${m.group})` : ''}`).join(', ')}`);
  }
  const last = await withTransaction(async (db) => {
    const done = (await db.query('UPDATE migration_recon_signoffs SET signed_by = $2, signed_at = now(), remarks = $3 WHERE id = $1 AND signed_at IS NULL RETURNING id', [s.id, user.id, note.slice(0, 1000)])).rows[0];
    if (!done) throw conflict(`${s.label} was signed by another user`);
    const left = (await db.query('SELECT count(*)::int AS n FROM migration_recon_signoffs WHERE recon_id = $1 AND signed_at IS NULL', [r.id])).rows[0].n;
    if (left) return false;
    await db.query('UPDATE migration_reconciliations SET status = \'signed\', signed_at = now() WHERE id = $1 AND status = \'open\'', [r.id]);
    return true;
  });
  if (last) await freezeReport(r.id, user);
  const out = await getReconciliation(r.id);
  await audit(req, { entity: 'migration_reconciliation', entityId: out.id, action: 'sign', after: { slot: s.slot, label: s.label, remarks: note, status: out.status,
    ...(out.reportSha256 ? { reportSha256: out.reportSha256 } : {}) } });
  return out;
}

/** The PDF of a signed reconciliation, kept in go-live-evidence with its SHA-256. */
async function freezeReport(id, user) {
  const r = await getReconciliation(id);
  const buffer = await reportPdf(r, { user: user.id });
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const key = await reserveKey({ folder: EVIDENCE_FOLDER, fileName: `${r.reconNumber}_Signed.pdf`, contentType: 'application/pdf', userId: user.id,
    entity: 'migration_reconciliation', entityId: r.id });
  await writeObject(key, buffer, 'application/pdf');
  await query('UPDATE migration_reconciliations SET report_file_key = $2, report_sha256 = $3 WHERE id = $1', [id, key, sha]);
}

/** The frozen PDF of a signed reconciliation: { fileName, buffer, sha256 }. */
export async function signedReport(id) {
  const r = await reconRow(id);
  if (!r.report_file_key) throw notFound(`Reconciliation ${r.recon_number} has no signed report`);
  let buffer;
  try {
    buffer = await fs.promises.readFile(resolveKey(r.report_file_key));
  } catch {
    throw notFound(`The signed report of ${r.recon_number} is no longer stored`);
  }
  return { fileName: `${r.recon_number}_Signed.pdf`, buffer, sha256: r.report_sha256 };
}

/**
 * After a load or an undo of a migration batch: the reconciliations of its run that are signed become superseded by a
 * new one (with the legacy figures entered on screen or uploaded); those still open are computed again. Never fails the
 * load or the undo: a problem is logged.
 */
export async function afterBatchChange(batch, user) {
  if (batch.kit !== 'migration') return;
  try {
    const recons = await many(`SELECT * FROM migration_reconciliations WHERE run_id IS NOT DISTINCT FROM $1 AND status IN ('open', 'signed')
      AND (all_batches OR $2 = ANY(batch_ids)) ORDER BY id`, [batch.runId ?? null, batch.id]);
    for (const r of recons) {
      if (r.status === 'open') {
        const signing = await one('SELECT count(*)::int AS n FROM migration_recon_signoffs WHERE recon_id = $1 AND signed_at IS NOT NULL', [r.id]);
        if (!signing.n) {
          await withTransaction((db) => compute(db, r));
          continue;
        }
      }
      const req = { user };
      const next = await createReconciliation({ runId: r.run_id, ...(r.all_batches ? {} : { batchIds: (r.batch_ids || []).map(Number).filter((x) => x !== batch.id || batch.status === 'loaded') }) },
        user, req, { supersedes: r.id });
      await query('UPDATE migration_reconciliations SET status = \'superseded\', superseded_at = now(), superseded_by = $2 WHERE id = $1', [r.id, next.id]);
      await audit(req, { entity: 'migration_reconciliation', entityId: Number(r.id), action: 'supersede', after: { by: next.reconNumber, loadNumber: batch.loadNumber, status: batch.status } });
    }
    // a reconciliation of another run whose records this load (or its undo) changed no longer describes them: it is
    // superseded with no successor, its signed report kept as it was signed (the run of the load reconciles them now)
    const stale = await many(`SELECT r.id FROM migration_reconciliations r WHERE r.status IN ('open', 'signed') AND r.run_id IS DISTINCT FROM $1
      AND EXISTS (SELECT 1 FROM data_load_rows x JOIN data_load_rows y ON y.record_table = x.record_table AND y.record_id = x.record_id
        WHERE x.batch_id = $2 AND x.action = 'updated' AND x.status IN ('loaded', 'undone') AND y.batch_id = ANY(r.batch_ids) AND y.batch_id <> $2 AND y.status = 'loaded')`,
    [batch.runId ?? null, batch.id]);
    for (const r of stale) {
      await query('UPDATE migration_reconciliations SET status = \'superseded\', superseded_at = now() WHERE id = $1 AND status IN (\'open\', \'signed\')', [r.id]);
      await audit({ user }, { entity: 'migration_reconciliation', entityId: Number(r.id), action: 'supersede', after: { loadNumber: batch.loadNumber, status: batch.status, changedRecords: true } });
    }
  } catch (e) {
    logger.warn({ err: e, batchId: batch.id }, 'reconciliation not refreshed after the load');
  }
}

// ------------------------------------------------------------------ report

// figures printed by the report itself (counts without decimals): right-aligned text columns
const LINE_COLUMNS = ['Object', 'Measure', 'Group', { label: 'BrokerVerse', align: 'right' }, { label: 'Legacy', align: 'right' }, { label: 'Difference', align: 'right' },
  { label: 'Tolerance', align: 'right' }, 'Status'];
const STATUS_LABELS = { matched: 'Agrees', difference: 'Difference', accepted: 'Difference accepted', 'no-legacy': 'No legacy figure', missing: 'Legacy figure missing' };
const DIFFERENCE_STATUS = { open: 'Open', explained: 'Explained', accepted: 'Accepted', fixed: 'Fixed' };
/** A figure of a line as printed: a count without decimals, an amount with two; empty when there is none. */
const figure = (l, v) => (v === null || v === undefined ? '' : formatAmount(v, isCount(l.measure) ? 0 : 2));
const stamp = (v) => (v ? formatDateTime(v) : '');
const KIND_LABELS = { measure: 'Measure', check: 'Check', 'not-loaded': 'Row not loaded', extra: 'Migrated outside these loads' };

/** The report as a PDF (letterhead): scope, lines, checks and tie-outs, differences, sign-offs. */
export async function reportPdf(r, opts = {}) {
  const measures = r.lines.filter((l) => l.kind === 'measure');
  const checks = r.lines.filter((l) => l.kind !== 'measure');
  const cell = (v) => (v === null || v === undefined ? '' : v);
  return renderPdf({
    title: 'Reconciliation of migration loads', number: r.reconNumber, orientation: 'landscape',
    meta: [['Status', r.status === 'signed' ? 'Signed' : r.status === 'superseded' ? 'Superseded' : 'Open'], ['Cutover date', r.cutoverDate], ['Opening balances as at', r.openingBalancesAsAt],
      ['Loads', r.batches.map((b) => b.loadNumber).join(', ') || '-'], ['Legacy system', [...new Set(r.batches.map((b) => b.legacySystem).filter(Boolean))].join(', ') || '-'],
      ['Computed at', stamp(r.computedAt) || '-']],
    sections: [
      { heading: 'Counts and totals', table: { columns: LINE_COLUMNS, rows: measures.map((l) => [l.object, l.measureLabel || l.measure, l.groupLabel || 'Total', figure(l, l.systemValue),
        figure(l, l.legacyValue), figure(l, l.difference), l.tolerance ? figure(l, l.tolerance) : '', STATUS_LABELS[l.status]]) } },
      { heading: 'Checks and tie-outs', table: { columns: ['Check', 'Group', 'Accounts', { label: 'BrokerVerse', align: 'right' }, 'Compared with', { label: 'Amount', align: 'right' },
        { label: 'Difference', align: 'right' }, 'Status'],
      rows: checks.map((l) => [l.label || l.measure, l.group || 'Total', (l.accounts || []).join(', '), figure(l, l.systemValue), l.sides.other, figure(l, l.legacyValue), figure(l, l.difference),
        STATUS_LABELS[l.status]]) } },
      ...(r.lines.some((l) => l.toleranceReason) ? [{ heading: 'Tolerances', table: { columns: ['Line', { label: 'Tolerance', type: 'money' }, { label: 'Reason', wrap: true }],
        rows: r.lines.filter((l) => l.toleranceReason).map((l) => [`${l.label || l.object} ${l.measure}${l.group ? ` (${l.group})` : ''}`, l.tolerance, l.toleranceReason]) } }] : []),
      { heading: 'Differences', table: { columns: ['Kind', { label: 'Description', wrap: true }, { label: 'Amount', type: 'money' }, 'Status', { label: 'Explanation', wrap: true },
        'Explained by', 'Accepted by', { label: 'Acceptance note', wrap: true }],
        rows: r.differences.length ? r.differences.map((d) => [KIND_LABELS[d.kind], d.description, cell(d.amount), DIFFERENCE_STATUS[d.status] || d.status, d.explanation || '',
          d.explainedBy || '', d.acceptedBy || '', d.acceptanceNote || ''])
          : [['', 'No difference', '', '', '', '', '', '']] } },
      { heading: 'Sign-off', table: { columns: ['Sign-off', 'Signed by', 'Signed at', { label: 'Remarks', wrap: true }],
        rows: r.signoffs.map((s) => [s.label, s.signedBy || '', stamp(s.signedAt), s.remarks || '']) } },
    ],
  }, opts);
}

/** The report as a workbook: Summary, Lines, Checks, Differences, Sign-offs. */
export function reportWorkbook(r) {
  const money = (header) => ({ header, width: 16, type: 'money' });
  return writeXlsx({
    title: `Reconciliation ${r.reconNumber}`, creator: 'BrokerVerse',
    sheets: [
      { name: 'Summary', headerStyle: 'navy', autoFilter: false, columns: [{ header: 'Item', width: 28 }, { header: 'Value', width: 60, type: 'wrap' }],
        rows: [['Reconciliation', r.reconNumber], ['Status', r.status], ['Cutover date', r.cutoverDate], ['Opening balances as at', r.openingBalancesAsAt || ''],
          ['Loads', r.batches.map((b) => b.loadNumber).join(', ')], ['Lines', r.summary.lines], ['Agreeing', r.summary.matched], ['Differences', r.summary.differences],
          ['Open differences', r.summary.openDifferences], ['Signed', `${r.summary.signed} of ${r.summary.slots}`], ['Signed report SHA-256', r.reportSha256 || '']] },
      { name: 'Lines', headerStyle: 'navy', columns: [{ header: 'Object', width: 20 }, { header: 'Measure', width: 24 }, { header: 'Group', width: 18 }, money('BrokerVerse'),
        money('Legacy'), { header: 'Legacy source', width: 14 }, money('Difference'), money('Tolerance'), { header: 'Tolerance reason', width: 30, type: 'wrap' }, { header: 'Status', width: 20 }],
      rows: r.lines.filter((l) => l.kind === 'measure').map((l) => [l.object, l.measureLabel || l.measure, l.groupLabel || 'Total', l.systemValue, l.legacyValue ?? '', l.legacySource || '', l.difference ?? '',
        l.tolerance, l.toleranceReason || '', STATUS_LABELS[l.status]]) },
      { name: 'Checks', headerStyle: 'navy', columns: [{ header: 'Check', width: 34 }, { header: 'Group', width: 18 }, { header: 'Accounts', width: 24 }, { header: 'BrokerVerse side', width: 24 },
        money('Amount'), { header: 'Compared with', width: 24 }, money('Amount compared'), money('Difference'), money('Tolerance'), { header: 'Status', width: 20 }],
      rows: r.lines.filter((l) => l.kind !== 'measure').map((l) => [l.label || l.measure, l.group || 'Total', (l.accounts || []).join(', '), l.sides.system, l.systemValue, l.sides.other,
        l.legacyValue ?? '', l.difference ?? '', l.tolerance, STATUS_LABELS[l.status]]) },
      { name: 'Differences', headerStyle: 'navy', columns: [{ header: 'Kind', width: 26 }, { header: 'Load', width: 14 }, { header: 'Sheet', width: 20 }, { header: 'Row', width: 8, type: 'integer' },
        { header: 'Record', width: 22 }, { header: 'Description', width: 60, type: 'wrap' }, money('Amount'), { header: 'Status', width: 12 }, { header: 'Explanation', width: 40, type: 'wrap' },
        { header: 'Action', width: 30, type: 'wrap' }, { header: 'Owner', width: 18 }, { header: 'Explained by', width: 20 }, { header: 'Accepted by', width: 20 },
        { header: 'Acceptance note', width: 40, type: 'wrap' }],
      rows: r.differences.map((d) => [KIND_LABELS[d.kind], d.loadNumber || '', d.sheet || '', d.row ?? '', d.recordKey || '', d.description, d.amount ?? '',
        DIFFERENCE_STATUS[d.status] || d.status, d.explanation || '', d.action || '', d.owner || '', d.explainedBy || '', d.acceptedBy || '', d.acceptanceNote || '']) },
      { name: 'Sign-offs', headerStyle: 'navy', columns: [{ header: 'Sign-off', width: 22 }, { header: 'Signed by', width: 24 }, { header: 'Signed at', width: 24 }, { header: 'Remarks', width: 50, type: 'wrap' }],
        rows: r.signoffs.map((s) => [s.label, s.signedBy || '', stamp(s.signedAt), s.remarks || '']) },
    ],
  });
}
