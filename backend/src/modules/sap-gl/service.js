/**
 * SAP GL text files (TIS-BRD-INTG-04 item 1): the GL entries posted in a day's window (after the previous day's cut-off,
 * up to this day's, sap_gl.cut_off in the business time zone) are written as a header file and a line file in the
 * layout of sap_gl.layout (layout.js) to the SAP pick-up folder: SAP_GL_EXPORT_DIR when set, else sap_gl.folder in the
 * storage area. One SAP document per posting date. Every run is recorded with its files (sap_gl_exports,
 * sap_gl_export_files); a re-generation writes the day's files again as a new run.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { many, one, query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { businessTimeZone, isoDate, today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { resolveKey, safeKey } from '../uploads/storage.js';
import { defaultCostCentre } from '../accounting/lib/costCentre.js';
import { checkLayout, renderFiles } from './layout.js';

const POSTED = 'j.status IN (\'posted\', \'reversed\')';

/** The folder the files are written to and the name shown for it. */
async function targetFolder() {
  if (config.sapGlExportDir) return { dir: path.resolve(config.sapGlExportDir), label: config.sapGlExportDir };
  const folder = safeKey(await getSetting('sap_gl.folder', 'sap-outbound')) || 'sap-outbound';
  return { dir: path.dirname(resolveKey(`${folder}/x`)), label: folder };
}

/** Layout in force, refused with its problems when it cannot be used. */
export async function currentLayout() {
  const layout = await getSetting('sap_gl.layout', null);
  const errors = checkLayout(layout);
  if (errors.length) throw badRequest('The SAP GL layout (setting sap_gl.layout) cannot be used', errors.map((message) => ({ path: 'sap_gl.layout', message })));
  return layout;
}

/** Start and end of a day's window: (previous day's cut-off, this day's cut-off] in the business time zone. */
export async function windowOf(date) {
  const cut = String(await getSetting('sap_gl.cut_off', '23:59'));
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cut)) throw badRequest(`sap_gl.cut_off must be a time HH:MM (is ${cut})`);
  return one('SELECT (($1::date - 1) + $2::time) AT TIME ZONE $3 AS "from", ($1::date + $2::time) AT TIME ZONE $3 AS "to"', [date, cut, await businessTimeZone()]);
}

/** Lines of the journals posted in the window, grouped into one SAP document per posting date. */
async function documentsFor(window, date) {
  const rows = await many(`SELECT j.id AS jv_id, j.jv_number, j.jv_date, j.description, j.transaction_code, j.currency, l.line_no, l.account_code, a.name AS account_name,
      l.debit, l.credit, l.memo, l.cost_centre, c.client_code, ic.code AS insurer_code
    FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id LEFT JOIN gl_accounts a ON a.code = l.account_code
    LEFT JOIN clients c ON c.id = COALESCE(l.client_id, j.client_id) LEFT JOIN insurance_companies ic ON ic.id = l.insurance_company_id
    WHERE ${POSTED} AND j.posted_at > $1 AND j.posted_at <= $2 AND (l.debit <> 0 OR l.credit <> 0)
    ORDER BY j.jv_date, j.posted_at, j.jv_number, l.line_no`, [window.from, window.to]);
  const fallback = await defaultCostCentre({ query }, date);
  const docs = [];
  for (const r of rows) {
    const postingDate = isoDate(r.jv_date);
    let d = docs.at(-1);
    if (!d || d.postingDate !== postingDate) {
      d = { docNo: docs.length + 1, postingDate, currency: r.currency, lines: [] };
      docs.push(d);
    }
    d.lines.push({ glCode: r.account_code, accountName: r.account_name || '', debit: Number(r.debit), credit: Number(r.credit), text: r.memo || r.description || '',
      costCentre: r.cost_centre || fallback || '', valueDate: postingDate, assignment: r.client_code || r.insurer_code || '', clientCode: r.client_code || '',
      insurerCode: r.insurer_code || '', journalNumber: r.jv_number, journalLine: `${r.jv_number}-${r.line_no}`, sourceDocument: r.transaction_code || r.jv_number, jvId: r.jv_id });
  }
  return docs;
}

/** Accounts SAP will not accept (sap_gl.account_pattern) and lines without a cost centre. */
async function warningsFor(docs) {
  const lines = docs.flatMap((d) => d.lines);
  let pattern = null;
  try { pattern = new RegExp(String(await getSetting('sap_gl.account_pattern', '^[0-9]{6}$') || '')); } catch { pattern = null; }
  const out = [];
  const odd = [...new Set(lines.map((l) => l.glCode).filter((c) => pattern && !pattern.test(c)))];
  if (odd.length) out.push(`Accounts outside the SAP chart (sap_gl.account_pattern): ${odd.join(', ')}`);
  const noCentre = lines.filter((l) => !l.costCentre).length;
  if (noCentre) out.push(`${noCentre} line(s) without a cost centre (no default cost centre on Master > Finance > Cost Centres)`);
  return out;
}

const runOut = (r, files = []) => ({
  id: Number(r.id), exportDate: isoDate(r.export_date), runNo: r.run_no, windowFrom: r.window_from, windowTo: r.window_to, trigger: r.trigger, status: r.status,
  folder: r.folder, journalCount: r.journal_count, lineCount: r.line_count, documentCount: r.document_count, totalDebit: Number(r.total_debit), totalCredit: Number(r.total_credit),
  warnings: r.warnings || [], error: r.error, createdBy: r.created_by_name || r.created_by, startedAt: r.started_at, finishedAt: r.finished_at,
  files: files.map((f) => ({ kind: f.kind, fileName: f.file_name, records: f.records, bytes: f.bytes, sha256: f.sha256 })),
});

/**
 * Write the files of a day (date: YYYY-MM-DD, default today in the business time zone). trigger: schedule | manual.
 * Returns the run. A day with nothing posted is recorded as empty and writes no files.
 */
export async function exportDay({ date = null, trigger = 'manual', userId = null } = {}) {
  const day = isoDate(date) || (await today());
  if (day > (await today())) throw badRequest('The SAP GL file cannot be made for a future date');
  const layout = await currentLayout();
  const window = await windowOf(day);
  const { dir, label } = await targetFolder();
  let run;
  try {
    run = await one(`INSERT INTO sap_gl_exports(export_date, run_no, window_from, window_to, trigger, folder, created_by)
      SELECT $1, COALESCE(max(run_no), 0) + 1, $2, $3, $4, $5, $6 FROM sap_gl_exports WHERE export_date = $1 RETURNING *`, [day, window.from, window.to, trigger, label, userId]);
  } catch (e) {
    if (e.code === '23505') throw conflict(`The SAP GL file of ${day} is being made by another run; try again`);
    throw e;
  }
  try {
    const docs = await documentsFor(window, day);
    const lines = docs.flatMap((d) => d.lines);
    const totals = { debit: round2(lines.reduce((s, l) => s + l.debit, 0)), credit: round2(lines.reduce((s, l) => s + l.credit, 0)) };
    const summary = [new Set(lines.map((l) => l.jvId)).size, lines.length, docs.length, totals.debit, totals.credit, JSON.stringify(await warningsFor(docs))];
    if (!lines.length) {
      await query(`UPDATE sap_gl_exports SET status = 'empty', journal_count = $2, line_count = $3, document_count = $4, total_debit = $5, total_credit = $6, warnings = $7,
        finished_at = now() WHERE id = $1`, [run.id, ...summary]);
      return getRun(run.id);
    }
    const files = renderFiles(layout, { exportDate: day, runNo: run.run_no, docs });
    fs.mkdirSync(dir, { recursive: true });
    for (const [kind, f] of Object.entries(files)) {
      const buffer = Buffer.from(f.content, layout.encoding === 'latin1' ? 'latin1' : 'utf8');
      fs.writeFileSync(path.join(dir, path.basename(f.fileName)), buffer);
      await query('INSERT INTO sap_gl_export_files(export_id, kind, file_name, records, bytes, sha256, content) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [run.id, kind, path.basename(f.fileName), f.records, buffer.length, crypto.createHash('sha256').update(buffer).digest('hex'), f.content]);
    }
    await query(`UPDATE sap_gl_exports SET status = 'done', journal_count = $2, line_count = $3, document_count = $4, total_debit = $5, total_credit = $6, warnings = $7,
      finished_at = now() WHERE id = $1`, [run.id, ...summary]);
  } catch (e) {
    await query('UPDATE sap_gl_exports SET status = \'failed\', error = $2, finished_at = now() WHERE id = $1', [run.id, e.message]);
    throw e;
  }
  return getRun(run.id);
}

export async function getRun(id) {
  const r = await one('SELECT x.*, (SELECT display_name FROM users u WHERE u.id = x.created_by) AS created_by_name FROM sap_gl_exports x WHERE x.id = $1', [Number(id) || 0]);
  if (!r) throw notFound('SAP GL export run not found');
  return runOut(r, await many('SELECT kind, file_name, records, bytes, sha256 FROM sap_gl_export_files WHERE export_id = $1 ORDER BY kind', [r.id]));
}

/** Runs, newest first (from / to on the export date). */
export async function listRuns(qs, pg) {
  const where = []; const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replaceAll('?', `$${p.length}`)); };
  if (isoDate(qs.from)) add('x.export_date >= ?::date', isoDate(qs.from));
  if (isoDate(qs.to)) add('x.export_date <= ?::date', isoDate(qs.to));
  if (qs.status) add('x.status = ?', String(qs.status));
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await one(`SELECT count(*)::int AS n FROM sap_gl_exports x ${w}`, p)).n;
  const rows = await many(`SELECT x.*, (SELECT display_name FROM users u WHERE u.id = x.created_by) AS created_by_name FROM sap_gl_exports x ${w}
    ORDER BY x.export_date DESC, x.run_no DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, pg.limit, pg.offset]);
  const files = await many('SELECT export_id, kind, file_name, records, bytes, sha256 FROM sap_gl_export_files WHERE export_id = ANY($1) ORDER BY kind', [rows.map((r) => r.id)]);
  return { rows: rows.map((r) => runOut(r, files.filter((f) => Number(f.export_id) === Number(r.id)))), total };
}

/** One file of a run as written: { fileName, content, encoding }. */
export async function runFile(id, kind) {
  const f = await one('SELECT file_name, content FROM sap_gl_export_files WHERE export_id = $1 AND kind = $2', [Number(id) || 0, String(kind)]);
  if (!f) throw notFound('File not found for this run');
  const layout = await getSetting('sap_gl.layout', null);
  return { fileName: f.file_name, content: f.content, encoding: layout?.encoding === 'latin1' ? 'latin1' : 'utf8' };
}

/** Job sap-gl-export (Master > Schedules): the file of the business day whose cut-off has come. */
export async function scheduledExport() {
  const run = await exportDay({ trigger: 'schedule' });
  return { exportDate: run.exportDate, runNo: run.runNo, status: run.status, lines: run.lineCount, files: run.files.map((f) => f.fileName), warnings: run.warnings.length };
}
