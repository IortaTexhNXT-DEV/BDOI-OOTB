/**
 * Import policy list (Accounts > Remittance > Remittances > Import policy list): off-cycle draft remittances from a list
 * of policies (go-live opening remittances, catch-up, an insurer's list, a correction).
 *
 * The file selects policies and BrokerVerse computes every amount: an amount in the file (Expected Due to Insurer) is
 * only compared with the system amount, and a difference above PHP 1.00 is a variance warning. Validating a file
 * stores it, its SHA-256 hash and one result per row under an import record IMP-yyyy-nnnn (status validated) and
 * creates nothing. Committing it creates one draft per insurer and product line from the ready rows only, at the
 * system amounts of today's engine (service.js#buildLines), with data.source 'import', the import and the off-cycle
 * reason (the purpose, a remittance_off_cycle reason); each line keeps the expected amount, the variance, the
 * insurer's reference and the remark. A policy remitted meanwhile is skipped ("Skipped: already on REM-..."), a file
 * whose hash was already committed is refused, and a validated import not committed within 7 days counts as
 * discarded. The drafts still need Submit for approval and the approval of another user.
 *
 * Row results of R1: ready, ready-variance, already-on-rem, not-found, not-issued, insurer-differs,
 * product-line-differs, direct-bill, duplicate (and skipped at commit). Held and Exception arrive with the Phase 2
 * collections engine.
 */
import crypto from 'node:crypto';
import { many, one, pool, withTransaction } from '../../db/pool.js';
import { HttpError, badRequest, notFound } from '../../lib/errors.js';
import { config } from '../../config.js';
import { getSetting } from '../../lib/settings.js';
import { today as businessToday } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { formatDate } from '../../lib/pdf/format.js';
import { printFormat } from '../../lib/pdf/index.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { audit } from '../../lib/audit.js';
import { requiredReason } from '../ops-masters/records.js';
import { readXlsx } from '../documents/xlsx.js';
import { normKey, parseCsv } from '../documents/tabular.js';
import { fileSize, round2, saveFile } from '../masters/helpers.js';
import { objectExists, resolveKey } from '../uploads/storage.js';
import { buildLines, defaultDueDate, eligiblePolicies, insertRemittance, statusLabels } from './service.js';

export const PRODUCT_LINES = ['Motor', 'Personal Accident', 'Credit Life', 'Marine'];
// product line codes of the product master read as the four TISPH product lines
const LINE_ALIASES = { motor: 'motor', accident: 'personalaccident', pa: 'personalaccident', personalaccident: 'personalaccident', life: 'creditlife', creditlife: 'creditlife', marine: 'marine' };
const lineKey = (v) => LINE_ALIASES[normKey(v)] || normKey(v);
const lineName = (v) => PRODUCT_LINES.find((l) => normKey(l) === lineKey(v)) || (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : null);

/** The columns of the policy list (the template is built from them, documents/uploadTemplates.js#remittancePolicyList). */
export const IMPORT_COLUMNS = [
  { key: 'policyNo', header: 'Policy No', required: true, aliases: ['Policy Number', 'PolicyNo', 'Policy #'], format: 'Text, e.g. TISPH-PC-0001234. The policy must exist, be issued and not be cancelled.' },
  { key: 'insurerCode', header: 'Insurer Code', required: true, aliases: ['Insurer', 'Insurance Company'], format: 'Code of an active insurer (Allowed values). Must be the policy\'s insurer.' },
  { key: 'productLine', header: 'Product Line', aliases: ['Line', 'Line of Business'], format: 'Optional. Must be the policy\'s product line.' },
  { key: 'expectedDue', header: 'Expected Due to Insurer', aliases: ['Expected Due', 'Due to Insurer', 'Expected Amount'],
    format: 'Optional number, 2 decimals, no currency sign. Compared only, never used: a difference above PHP 1.00 is a variance warning.' },
  { key: 'insurerReference', header: 'Insurer Reference', aliases: ['Reference', 'Insurer Ref'], format: 'Optional text, at most 50 characters. Stored on the line.' },
  { key: 'remark', header: 'Remark', aliases: ['Remarks'], format: 'Optional text, at most 100 characters. Stored on the line.' },
];

export const RESULTS = {
  ready: { label: 'Ready', kind: 'ok' }, 'ready-variance': { label: 'Ready · Variance', kind: 'warning' },
  'already-on-rem': { label: 'Already on REM', kind: 'error' }, 'not-found': { label: 'Not found', kind: 'error' }, 'not-issued': { label: 'Not issued', kind: 'error' },
  'insurer-differs': { label: 'Insurer differs', kind: 'error' }, 'product-line-differs': { label: 'Product line differs', kind: 'error' },
  'direct-bill': { label: 'Direct bill', kind: 'error' }, duplicate: { label: 'Duplicate in file', kind: 'error' }, skipped: { label: 'Skipped', kind: 'error' },
};
const READY = ['ready', 'ready-variance'];
const STATUS_LABELS = { validated: 'Validated', committed: 'Committed', discarded: 'Discarded' };
const EXPIRY_DAYS = 7;
const VARIANCE_LIMIT = 1;
const LIMITS = { insurerReference: 50, remark: 100 };

/** The size and type message of the dialog and the server ("Choose an .xlsx or .csv file of at most 10 MB."). */
export const fileRule = () => `Choose an .xlsx or .csv file of at most ${Math.round(config.importMaxBytes / 1048576)} MB.`;

const fileError = (code) => new HttpError(400, fileRule(), [{ path: 'file', code, message: fileRule() }]);
const conflictOf = (code, message) => new HttpError(409, message, [{ path: 'import', code, message }]);

/** The error of the multipart upload as the API answers it: a file above IMPORT_MAX_MB gets the dialog's message. */
export const uploadError = (e) => (e?.code === 'LIMIT_FILE_SIZE' ? fileError('FILE_TOO_LARGE') : badRequest(e.message));

/** GET /remittance/imports/limits: the file and row limits of the dialog. */
export async function importLimits() {
  return { maxBytes: config.importMaxBytes, maxMb: Math.round(config.importMaxBytes / 1048576), maxRows: Number(await getSetting('remittance.import_max_rows', 5000)) || 5000,
    fileTypes: ['.xlsx', '.csv'], message: fileRule() };
}

/** Header row and data rows of an uploaded .xlsx (first sheet) or .csv file. */
function readTable(file) {
  const name = String(file.originalname || '').toLowerCase();
  const zip = file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;
  if (!(name.endsWith('.xlsx') || name.endsWith('.csv')) || (name.endsWith('.xlsx') && !zip)) throw fileError('FILE_TYPE');
  let table;
  try {
    table = zip ? readXlsx(file.buffer) : parseCsv(file.buffer.toString('utf8'));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw badRequest(`Could not read the file: ${e.message}`);
  }
  const rows = table.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (!rows.length) throw badRequest('The file is empty');
  return { header: rows[0].map((h) => String(h ?? '').trim()), rows: rows.slice(1) };
}

/** Column index of each import column in the header; refuses a file without a required column. */
function columnIndex(header) {
  const keys = header.map(normKey);
  const idx = {};
  for (const c of IMPORT_COLUMNS) {
    const names = new Set([c.header, c.key, ...(c.aliases || [])].map(normKey));
    idx[c.key] = keys.findIndex((k) => names.has(k));
  }
  const missing = IMPORT_COLUMNS.find((c) => c.required && idx[c.key] < 0);
  if (missing) {
    const message = `Column ${missing.header} not found.`;
    throw new HttpError(400, message, [{ path: 'file', code: 'HEADER_MISSING', message }]);
  }
  return idx;
}

const amountOf = (v) => {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (!s) return { value: null, invalid: false };
  const n = Number(s);
  return Number.isFinite(n) ? { value: round2(n), invalid: false } : { value: null, invalid: true };
};
const money = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The policies, insurers, participations and live remittance lines the rows name, read once. */
async function lookups(numbers) {
  const policies = numbers.length ? await many(`SELECT p.id, p.policy_number, p.status, p.billing_mode, p.insurance_company_id, ic.code AS insurer_code, ic.name AS insurer_name,
      ic.short_name AS insurer_short_name, pr.line AS product_line
    FROM policies p LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE lower(p.policy_number) = ANY($1)`, [numbers]) : [];
  const ids = policies.map((p) => p.id);
  const parts = ids.length ? await many(`SELECT entity_id, insurance_company_id FROM risk_participants WHERE entity_type = 'policy' AND status = 'active' AND entity_id = ANY($1)`, [ids]) : [];
  const live = ids.length ? await many(`SELECT rl.policy_id, rl.insurance_company_id, r.insurance_company_id AS remittance_insurer, r.remittance_number, r.status FROM remittance_lines rl
    JOIN remittances r ON r.id = rl.remittance_id WHERE r.kind = 'direct-bill' AND r.status NOT IN ('rejected', 'cancelled') AND rl.policy_id = ANY($1) ORDER BY r.created_at`, [ids]) : [];
  const insurers = await many("SELECT id, code, name, short_name FROM insurance_companies WHERE status = 'active'");
  return {
    policy: new Map(policies.map((p) => [p.policy_number.toLowerCase(), p])),
    participants: parts.reduce((m, x) => m.set(x.entity_id, [...(m.get(x.entity_id) || []), x.insurance_company_id]), new Map()),
    live: live.reduce((m, x) => m.set(x.policy_id, [...(m.get(x.policy_id) || []), x]), new Map()),
    insurer: new Map(insurers.map((i) => [String(i.code).toLowerCase(), i])),
  };
}

/** The result of every row of a file: { rowNo, values, policy, insurer, result, message, systemDue, variance }. */
async function evaluate(rows, idx, labels) {
  const get = (r, key) => (idx[key] >= 0 ? String(r[idx[key]] ?? '').trim() : '');
  const look = await lookups([...new Set(rows.map((r) => get(r, 'policyNo').toLowerCase()).filter(Boolean))]);
  const seen = new Map();
  const out = [];
  for (const [i, r] of rows.entries()) {
    const rowNo = i + 2;
    const v = { policyNo: get(r, 'policyNo'), insurerCode: get(r, 'insurerCode'), productLine: get(r, 'productLine'), expected: amountOf(get(r, 'expectedDue')),
      insurerReference: get(r, 'insurerReference').slice(0, LIMITS.insurerReference) || null, remark: get(r, 'remark').slice(0, LIMITS.remark) || null };
    const row = { rowNo, cells: r.map((c) => String(c ?? '')), values: v, policy: null, insurer: null, result: null, message: null, systemDue: null, variance: null };
    out.push(row);
    const done = (result, message) => Object.assign(row, { result, message });
    if (!v.policyNo) { done('not-found', 'Policy No is empty'); continue; }
    const key = `${v.policyNo.toLowerCase()}|${v.insurerCode.toLowerCase()}`;
    if (seen.has(key)) { done('duplicate', `Also on row ${seen.get(key)}`); continue; }
    seen.set(key, rowNo);
    const p = look.policy.get(v.policyNo.toLowerCase());
    if (!p) { done('not-found', 'Policy not found'); continue; }
    row.policy = p;
    if (p.status === 'cancelled') { done('not-issued', 'Policy is cancelled'); continue; }
    if (!['issued', 'active', 'renewed'].includes(p.status)) { done('not-issued', 'Policy not issued'); continue; }
    if (p.billing_mode === 'direct') { done('direct-bill', 'Direct-bill policy: the client paid the insurer'); continue; }
    const ins = look.insurer.get(v.insurerCode.toLowerCase());
    const allowed = new Set([p.insurance_company_id, ...(look.participants.get(p.id) || [])].filter(Boolean).map(Number));
    if (!ins || !allowed.has(Number(ins.id))) {
      done('insurer-differs', `Policy insurer is ${p.insurer_short_name || p.insurer_name || 'not set'}`);
      continue;
    }
    row.insurer = ins;
    if (v.productLine && lineKey(v.productLine) !== lineKey(p.product_line)) { done('product-line-differs', `Policy product line is ${lineName(p.product_line) || 'not set'}`); continue; }
    const on = (look.live.get(p.id) || []).find((x) => !x.insurance_company_id || Number(x.insurance_company_id) === Number(ins.id));
    if (on) { done('already-on-rem', `Already on ${on.remittance_number} (${labels[on.status] || on.status})`); continue; }
    const [line] = await buildLines([{ policyId: p.id }], ins.id);
    row.systemDue = round2(line.net);
    if (v.expected.value !== null) row.variance = round2(row.systemDue - v.expected.value);
    if (row.variance !== null && Math.abs(row.variance) > VARIANCE_LIMIT) {
      done('ready-variance', `File ${money(v.expected.value)}, system ${money(row.systemDue)}, difference ${row.variance > 0 ? '+' : ''}${money(row.variance)}`);
    } else done('ready', v.expected.invalid ? 'Expected Due to Insurer is not a number and is ignored' : null);
  }
  return out;
}

/** Counts of the chips: rows, ready (with variance), warnings, errors; held and exceptions arrive with Phase 2. */
const countsOf = (rows) => ({
  rows: rows.length, ready: rows.filter((r) => READY.includes(r.result)).length, warnings: rows.filter((r) => r.result === 'ready-variance').length,
  errors: rows.filter((r) => !READY.includes(r.result)).length, held: 0, exceptions: 0,
});

const expired = (imp, now = Date.now()) => imp.status === 'validated' && new Date(imp.uploaded_at).getTime() < now - EXPIRY_DAYS * 86400000;

/** The committed import of the same file (hash), other than `id`; null when there is none. */
async function committedTwin(hash, id = null) {
  return one(`SELECT id, import_no, committed_at, jsonb_array_length(created_remittance_ids) AS drafts FROM remittance_imports
    WHERE file_hash = $1 AND status = 'committed' AND id IS DISTINCT FROM $2 ORDER BY committed_at LIMIT 1`, [hash, id]);
}

async function sameFileText(twin) {
  const fmt = await printFormat();
  return `This file was imported on ${formatDate(twin.committed_at, fmt)} as ${twin.import_no} (${twin.drafts} draft${Number(twin.drafts) === 1 ? '' : 's'}).`;
}

/** The remittances to create, one per insurer and product line of the ready rows, with their basis (as the register reads it). */
async function toCreate(importId) {
  const rows = await many(`SELECT ic.id AS insurer_id, ic.name AS insurer_name, pr.line AS product_line, count(*)::int AS policies, COALESCE(sum(x.system_due), 0) AS due,
      count(*) FILTER (WHERE x.result = 'ready-variance')::int AS variance_rows,
      bool_or(EXISTS (SELECT 1 FROM receivables rv WHERE rv.policy_id = x.policy_id AND rv.status <> 'cancelled' AND rv.remittance_basis = 'gross')) AS gross
    FROM remittance_import_rows x JOIN insurance_companies ic ON ic.id = x.insurance_company_id JOIN policies p ON p.id = x.policy_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE x.import_id = $1 AND x.result = ANY($2) GROUP BY ic.id, ic.name, pr.line`, [importId, READY]);
  return rows.map((r) => ({ insurer: { id: r.insurer_id, name: r.insurer_name }, productLine: lineName(r.product_line), basis: r.gross ? 'gross' : 'net',
    basisLabel: r.gross ? 'Gross' : 'Net', policies: r.policies, dueToInsurer: round2(r.due), varianceRows: r.variance_rows }))
    .sort((a, b) => a.insurer.name.localeCompare(b.insurer.name) || String(a.productLine).localeCompare(String(b.productLine)));
}

/** An import as the API answers it, with what can be done with it (commit, discard) and why not. */
export async function importOut(imp, { withGroups = true } = {}) {
  const status = expired(imp) ? 'discarded' : imp.status;
  const twin = imp.status === 'validated' ? await committedTwin(imp.file_hash, imp.id) : null;
  const drafts = (imp.created_remittance_ids || []).length
    ? await many('SELECT id, remittance_number FROM remittances WHERE id = ANY($1) ORDER BY remittance_number', [imp.created_remittance_ids]) : [];
  const counts = imp.counts || {};
  let blocked = null;
  if (status !== 'validated') blocked = status === 'committed' ? 'This file was imported already.' : 'This import was discarded.';
  else if (twin) blocked = await sameFileText(twin);
  else if (!counts.ready) blocked = 'No row is ready to remit.';
  const groups = withGroups ? await toCreate(imp.id) : [];
  return {
    id: imp.id, importNo: imp.import_no, status, statusLabel: STATUS_LABELS[status], expired: expired(imp), version: imp.version,
    purpose: { code: imp.purpose_code, name: imp.purpose_name, note: imp.purpose_note, text: imp.purpose_text },
    file: { name: imp.file_name, size: Number(imp.file_size), sizeText: fileSize(Number(imp.file_size)), hash: imp.file_hash, key: imp.file_key },
    counts, uploadedBy: { id: imp.uploaded_by, name: imp.uploaded_by_name || null }, uploadedAt: new Date(imp.uploaded_at).toISOString(),
    committedBy: imp.committed_by ? { id: imp.committed_by, name: imp.committed_by_name || null } : null, committedAt: imp.committed_at ? new Date(imp.committed_at).toISOString() : null,
    discardedAt: imp.discarded_at ? new Date(imp.discarded_at).toISOString() : null,
    drafts: drafts.map((d) => ({ id: d.id, remittanceNo: d.remittance_number, link: `/finance/remittance/remittances/${d.id}` })),
    sameFile: twin ? { id: twin.id, importNo: twin.import_no, committedAt: new Date(twin.committed_at).toISOString(), drafts: Number(twin.drafts) } : null,
    toCreate: groups, totals: { remittances: groups.length, policies: groups.reduce((s, g) => s + g.policies, 0), dueToInsurer: round2(groups.reduce((s, g) => s + g.dueToInsurer, 0)) },
    canCommit: !blocked, commitBlockedReason: blocked, canDiscard: status === 'validated',
  };
}

const IMPORT_SELECT = `SELECT m.*, (SELECT display_name FROM users u WHERE u.id = m.uploaded_by) AS uploaded_by_name,
  (SELECT display_name FROM users u WHERE u.id = m.committed_by) AS committed_by_name FROM remittance_imports m`;

export async function getImportRow(id) {
  const imp = await one(`${IMPORT_SELECT} WHERE m.id = $1 OR m.import_no = $1`, [String(id)]);
  if (!imp) throw notFound('Import not found');
  return imp;
}

export const getImport = async (id) => importOut(await getImportRow(id));

/**
 * POST /remittance/imports/validate (multipart file, purposeCode, note): read the file, check each row and keep the
 * results under a new import (validated). Nothing is created.
 */
export async function validateImport(file, b, user, req) {
  if (!file?.buffer?.length) throw fileError('FILE_MISSING');
  if (file.size > config.importMaxBytes) throw fileError('FILE_TOO_LARGE');
  const purpose = await requiredReason(pool, 'remittance_off_cycle', { reasonCode: b.purposeCode ?? b.reasonCode, note: b.note });
  const { header, rows } = readTable(file);
  const idx = columnIndex(header);
  const max = Number(await getSetting('remittance.import_max_rows', 5000)) || 5000;
  if (rows.length > max) {
    const message = `The file has ${rows.length.toLocaleString('en-US')} rows; at most ${max.toLocaleString('en-US')} rows are accepted.`;
    throw new HttpError(400, message, [{ path: 'file', code: 'TOO_MANY_ROWS', message }]);
  }
  if (!rows.length) throw badRequest('The file has no data rows (first row must be the column headers)');
  const results = await evaluate(rows, idx, await statusLabels());
  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const saved = await saveFile({ category: 'remittance-imports', fileName: file.originalname, content: file.buffer, contentType: file.mimetype, entity: 'remittance_import', userId: user.id });
  const importNo = await nextDocumentNumber('remittance_import');
  const counts = countsOf(results);
  const id = await withTransaction(async (c) => {
    const m = (await c.query(`INSERT INTO remittance_imports(import_no, purpose_code, purpose_name, purpose_note, purpose_text, file_key, file_name, file_size, file_hash, header, counts, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [importNo, purpose.code, purpose.name, purpose.note, purpose.text, saved.key, file.originalname, file.size, hash,
      JSON.stringify(header), JSON.stringify(counts), user.id])).rows[0];
    for (const r of results) {
      await c.query(`INSERT INTO remittance_import_rows(import_id, row_no, policy_no, policy_id, insurer_code, insurance_company_id, product_line, expected_due, insurer_reference, remark,
          result, message, system_due, variance, cells) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [m.id, r.rowNo, r.values.policyNo || null, r.policy?.id || null, r.values.insurerCode || null, r.insurer?.id || null, r.values.productLine || null, r.values.expected.value,
        r.values.insurerReference, r.values.remark, r.result, r.message, r.systemDue, r.variance, JSON.stringify(r.cells)]);
    }
    return m.id;
  });
  const out = await getImport(id);
  await audit(req, { entity: 'remittance_import', entityId: id, action: 'validate', after: { importNo, fileName: file.originalname, purpose: purpose.text, counts } });
  return out;
}

/** GET /remittance/imports: the import history, newest first. */
export async function listImports(qs, pg) {
  const total = (await one('SELECT count(*)::int AS n FROM remittance_imports')).n;
  const rows = await many(`${IMPORT_SELECT} ORDER BY m.uploaded_at DESC, m.import_no DESC LIMIT $1 OFFSET $2`, [pg.limit, pg.offset]);
  const out = [];
  for (const r of rows) out.push(await importOut(r, { withGroups: false }));
  return { rows: out, total };
}

/** GET /remittance/imports/:id/file: the file as it was uploaded ({ path, fileName, contentType }). */
export async function importFile(id) {
  const imp = await getImportRow(id);
  if (!imp.file_key || !objectExists(imp.file_key)) throw notFound(`The file of ${imp.import_no} is no longer stored`);
  const csv = /\.csv$/i.test(imp.file_name || '');
  return { path: resolveKey(imp.file_key), fileName: imp.file_name,
    contentType: csv ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}

/** The result filter of the rows: a result code, 'ready' (with variance), 'warnings' or 'errors'. */
function resultFilter(result) {
  if (!result || result === 'all') return null;
  if (result === 'ready') return READY;
  if (result === 'warnings') return ['ready-variance'];
  if (result === 'errors') return Object.keys(RESULTS).filter((k) => !READY.includes(k));
  return String(result).split(',').filter((k) => RESULTS[k]);
}

const rowOut = (x) => ({
  rowNo: x.row_no, policyNo: x.policy_no, policyId: x.policy_id, insurerCode: x.insurer_code, insurer: x.insurer_name || null, productLine: x.product_line || lineName(x.policy_line),
  result: x.result, resultLabel: RESULTS[x.result]?.label || x.result, kind: RESULTS[x.result]?.kind || 'error', message: x.message,
  systemDue: x.system_due, expectedDue: x.expected_due, variance: x.variance, insurerReference: x.insurer_reference, remark: x.remark,
  remittance: x.remittance_id ? { id: x.remittance_id, remittanceNo: x.remittance_number } : null,
});

/** GET /remittance/imports/:id/rows?result=&page=: the row results, in file order. */
export async function importRows(id, qs, pg) {
  const imp = await getImportRow(id);
  const filter = resultFilter(qs.result);
  const values = [imp.id];
  const cond = filter ? ` AND x.result = ANY($${values.push(filter)})` : '';
  const total = (await one(`SELECT count(*)::int AS n FROM remittance_import_rows x WHERE x.import_id = $1${cond}`, values)).n;
  const rows = await many(`SELECT x.*, ic.name AS insurer_name, pr.line AS policy_line, r.remittance_number FROM remittance_import_rows x
    LEFT JOIN insurance_companies ic ON ic.id = x.insurance_company_id LEFT JOIN policies p ON p.id = x.policy_id LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN remittances r ON r.id = x.remittance_id WHERE x.import_id = $1${cond} ORDER BY x.row_no LIMIT ${pg.limit} OFFSET ${pg.offset}`, values);
  return { rows: rows.map(rowOut), total };
}

/** GET /remittance/imports/:id/errors.xlsx: the columns of the file plus Result and Message, one row per file row. */
export async function errorReport(id) {
  const imp = await getImportRow(id);
  const rows = await many('SELECT row_no, cells, result, message FROM remittance_import_rows WHERE import_id = $1 ORDER BY row_no', [imp.id]);
  const header = Array.isArray(imp.header) ? imp.header : [];
  const columns = [...header.map((h) => ({ header: h, width: Math.max(14, Math.min(36, String(h).length + 4)) })), { header: 'Result', width: 22 }, { header: 'Message', width: 60, type: 'wrap' }];
  const data = rows.map((r) => [...header.map((_, i) => r.cells?.[i] ?? ''), RESULTS[r.result]?.label || r.result, r.message || '']);
  const buffer = writeXlsx({ sheets: [{ name: 'Result', columns, rows: data, rowStyles: rows.map((r) => (READY.includes(r.result) ? null : 'missing')) }], title: `Import ${imp.import_no} result` });
  return { buffer, fileName: `${imp.import_no}_Errors_${(await businessToday()).replace(/-/g, '')}.xlsx` };
}

/**
 * POST /remittance/imports/:id/commit { version }: one draft remittance per insurer and product line of the ready
 * rows, at the system amounts, with source 'import', the import and the off-cycle reason; a policy remitted since the
 * validation is skipped. Returns { import, drafts, skipped }.
 */
export async function commitImport(id, b, user, req) {
  const imp = await getImportRow(id);
  if (imp.status === 'committed') throw conflictOf('ALREADY_COMMITTED', `${imp.import_no} was imported already.`);
  if (imp.status === 'discarded' || expired(imp)) throw conflictOf('DISCARDED', `${imp.import_no} was discarded. Validate the file again.`);
  if (b?.version !== undefined && b?.version !== null && Number(b.version) !== imp.version) throw conflictOf('STALE', `${imp.import_no} changed since it was shown. Reload.`);
  const twin = await committedTwin(imp.file_hash, imp.id);
  if (twin) throw conflictOf('SAME_FILE', await sameFileText(twin));
  const ready = await many(`SELECT x.*, pr.line AS policy_line FROM remittance_import_rows x JOIN policies p ON p.id = x.policy_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE x.import_id = $1 AND x.result = ANY($2) ORDER BY x.row_no`, [imp.id, READY]);
  if (!ready.length) throw conflictOf('NOTHING_READY', 'No row is ready to remit.');
  const groups = new Map();
  for (const r of ready) {
    const key = `${r.insurance_company_id}|${lineKey(r.policy_line)}`;
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  const today = await businessToday();
  const offCycleReason = { code: imp.purpose_code, name: imp.purpose_name, note: imp.purpose_note, text: imp.purpose_text };
  const planned = [];
  const skipped = [];
  for (const rows of groups.values()) {
    const insurerId = rows[0].insurance_company_id;
    const eligible = new Set((await eligiblePolicies({ insurerId, policyIds: rows.map((r) => r.policy_id) })).map((p) => p.id));
    const use = rows.filter((r) => eligible.has(r.policy_id));
    for (const r of rows.filter((x) => !eligible.has(x.policy_id))) {
      const on = await one(`SELECT r.remittance_number FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id WHERE rl.policy_id = $1 AND r.kind = 'direct-bill'
        AND r.status NOT IN ('rejected', 'cancelled') ORDER BY r.created_at DESC LIMIT 1`, [r.policy_id]);
      skipped.push({ row: r, message: on ? `Skipped: already on ${on.remittance_number}` : 'Skipped: no longer ready to remit' });
    }
    if (!use.length) continue;
    const lines = await buildLines(use.map((r) => ({ policyId: r.policy_id })), insurerId);
    lines.forEach((l, i) => {
      const r = use[i];
      Object.assign(l, { expectedDue: r.expected_due, variance: r.expected_due === null ? null : round2(l.net - Number(r.expected_due)), insurerReference: r.insurer_reference, remark: r.remark });
    });
    planned.push({ insurerId, rows: use, lines, dueDate: await defaultDueDate(today, insurerId) });
  }
  const created = await withTransaction(async (c) => {
    const cur = (await c.query('SELECT status, version FROM remittance_imports WHERE id = $1 FOR UPDATE', [imp.id])).rows[0];
    if (cur.status !== 'validated' || cur.version !== imp.version) throw conflictOf('ALREADY_COMMITTED', `${imp.import_no} was imported already.`);
    const out = [];
    for (const g of planned) {
      const rid = await insertRemittance(c, { kind: 'direct-bill', insurerId: g.insurerId, period: today.slice(0, 7), dueDate: g.dueDate, lines: g.lines, userId: user.id,
        remarks: `Imported from ${imp.import_no}`, data: { source: 'import', importId: imp.id, importNo: imp.import_no, offCycleReason } });
      await c.query('UPDATE remittance_import_rows SET remittance_id = $2 WHERE import_id = $1 AND row_no = ANY($3)', [imp.id, rid, g.rows.map((r) => r.row_no)]);
      out.push({ id: rid, group: g });
    }
    for (const s of skipped) await c.query("UPDATE remittance_import_rows SET result = 'skipped', message = $3 WHERE import_id = $1 AND row_no = $2", [imp.id, s.row.row_no, s.message]);
    const counts = { ...(imp.counts || {}), created: out.length, skipped: skipped.length };
    await c.query(`UPDATE remittance_imports SET status = 'committed', committed_by = $2, committed_at = now(), created_remittance_ids = $3, counts = $4, version = version + 1 WHERE id = $1`,
      [imp.id, user.id, JSON.stringify(out.map((x) => x.id)), JSON.stringify(counts)]);
    return out;
  });
  const drafts = [];
  for (const x of created) {
    const r = await one('SELECT remittance_number, net_due, policy_count FROM remittances WHERE id = $1', [x.id]);
    const draft = { id: x.id, remittanceNo: r.remittance_number, policies: r.policy_count, dueToInsurer: round2(r.net_due), link: `/finance/remittance/remittances/${x.id}` };
    drafts.push(draft);
    await audit(req, { entity: 'remittance', entityId: x.id, action: 'import', after: { status: 'draft', source: 'import', importId: imp.id, importNo: imp.import_no,
      offCycleReason: offCycleReason.text, policyCount: r.policy_count, netDue: round2(r.net_due) } });
  }
  await audit(req, { entity: 'remittance_import', entityId: imp.id, action: 'commit', after: { importNo: imp.import_no, drafts: drafts.map((d) => d.remittanceNo), skipped: skipped.length } });
  const message = drafts.length
    ? `${drafts.length} draft${drafts.length === 1 ? '' : 's'} created: ${drafts.map((d) => d.remittanceNo).join(', ')} · Off-cycle · ${imp.import_no}`
    : 'No draft created: every ready row was remitted meanwhile.';
  return { import: await getImport(imp.id), drafts, skipped: skipped.map((s) => ({ rowNo: s.row.row_no, policyNo: s.row.policy_no, message: s.message })), message };
}

/** POST /remittance/imports/:id/discard: a validated import is set aside; nothing was created from it. */
export async function discardImport(id, user, req) {
  const imp = await getImportRow(id);
  if (imp.status !== 'validated') throw conflictOf(imp.status === 'committed' ? 'ALREADY_COMMITTED' : 'DISCARDED', `${imp.import_no} is ${STATUS_LABELS[imp.status].toLowerCase()}.`);
  await pool.query("UPDATE remittance_imports SET status = 'discarded', discarded_by = $2, discarded_at = now(), version = version + 1 WHERE id = $1 AND status = 'validated'", [imp.id, user.id]);
  await audit(req, { entity: 'remittance_import', entityId: imp.id, action: 'discard', before: { status: 'validated' }, after: { status: 'discarded', importNo: imp.import_no } });
  return getImport(imp.id);
}
