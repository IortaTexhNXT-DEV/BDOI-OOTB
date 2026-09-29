/** Reports: catalogue, on-screen runs, file generation (CSV / XLSX / PDF), history and scheduled delivery. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import { config } from '../../config.js';
import { many, one, query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { queueEmail } from '../../lib/mailer.js';
import { verify } from '../../lib/auth.js';
import { toCsv } from '../../tools/csv.js';
import { writeXlsx } from '../../tools/xlsx.js';
import { writePdf } from '../../tools/pdf.js';
import { startScheduler } from '../../jobs/scheduler.js';
import { execute } from './engine.js';
import { QUERIES } from './queries.js';

export const FORMATS = {
  csv: { ext: 'csv', contentType: 'text/csv; charset=utf-8' },
  xlsx: { ext: 'xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pdf: { ext: 'pdf', contentType: 'application/pdf' },
};
const ADMIN_ROLES = ['it-admin', 'ba'];
const isAdmin = (user) => (user?.roles || []).some((r) => ADMIN_ROLES.includes(r));

/* ---------- filter options ---------- */

/** Active users with the agent role, as drop-down options for the report Agent filter (value = user id). */
export async function agentFilterOptions() {
  const rows = await many(`SELECT u.id, u.display_name, u.username, u.employee_code FROM users u
    WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code = 'agent')
    ORDER BY lower(COALESCE(u.display_name, u.username))`);
  return rows.map((u) => ({ label: u.display_name || u.username, value: u.id, code: u.employee_code || u.username }));
}

/* ---------- catalogue ---------- */

export function canAccess(user, def) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!(user.permissions || []).includes(def.permission)) return false;
  return !def.roles?.length || def.roles.some((r) => (user.roles || []).includes(r));
}

const publicDef = (d) => {
  const q = QUERIES[d.query_name] || {};
  return {
    code: d.code, name: d.name, category: d.category, description: d.description, screen: d.screen,
    parameters: d.parameters, columns: d.default_columns, roles: d.roles, permission: d.permission,
    criteria: Object.keys(q.criteria || {}), filters: q.filters || [], formats: Object.keys(FORMATS),
    aggregate: !!q.aggregate, queryName: d.query_name,
  };
};

export async function listCatalogue(user, { category, search } = {}) {
  const rows = await many(`SELECT * FROM report_definitions WHERE status = 'active' AND ($1::text IS NULL OR category = $1)
    AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR code ILIKE '%' || $2 || '%') ORDER BY category DESC, sort_order, name`, [category || null, search || null]);
  return rows.filter((d) => canAccess(user, d)).map(publicDef);
}

async function loadDef(code) {
  const d = await one('SELECT * FROM report_definitions WHERE code = $1 AND status = \'active\'', [code]);
  if (!d) throw notFound(`Report ${code} not found`);
  return d;
}
export async function getDefinition(code, user) {
  const d = await loadDef(code);
  if (user && !canAccess(user, d)) throw forbidden('You do not have access to this report');
  return d;
}
export const describe = async (code, user) => publicDef(await getDefinition(code, user));

/* ---------- on-screen run ---------- */

export const defaultPageSize = async () => Number(await getSetting('reports.default_page_size', 50)) || 50;


export async function runReport(code, params, { user, page = 1, perPage = 50 } = {}) {
  const def = await getDefinition(code, user);
  const r = await execute(def, params, { page, perPage });
  return { report: { code: def.code, name: def.name, category: def.category }, ...r, generatedAt: new Date().toISOString() };
}

/* ---------- files ---------- */

const signDownload = async (id) => {
  const hours = Number(await getSetting('reports.download_link_ttl_hours', 72)) || 72;
  return jwt.sign({ type: 'report-download', rid: id }, config.jwtSecret, { expiresIn: Math.round(hours * 3600), algorithm: 'HS256' });
};
export function verifyDownloadToken(token, id) {
  try {
    const p = verify(token);
    return p.type === 'report-download' && p.rid === id;
  } catch {
    return false;
  }
}
export const downloadUrl = async (id) => `${config.publicBaseUrl}/api/reports/generated/${id}/download?token=${await signDownload(id)}`;

const describeParams = (np) => [
  `Period ${np.from} to ${np.to}`,
  np.criteria ? `Criteria: ${np.criteria}` : null,
  ...Object.entries(np.filters).map(([k, v]) => `${k}: ${v}`),
].filter(Boolean).join(' | ');

async function renderFile(format, def, result, meta) {
  const { columns, rows, totals } = result;
  const totalRow = Object.keys(totals).length ? { ...Object.fromEntries(columns.map((c) => [c.key, null])), ...totals, [columns[0]?.key]: 'TOTAL' } : null;
  if (format === 'csv') return Buffer.from(toCsv(columns, totalRow ? [...rows, totalRow] : rows), 'utf8');
  if (format === 'pdf') {
    return writePdf({ title: `${meta.companyName} - ${def.name}`, subtitle: `${describeParams(result.params)} | Generated ${meta.generatedAt} by ${meta.by} | Currency ${meta.currency}`, columns, rows, totals: Object.keys(totals).length ? totals : null, pageSize: meta.pageSize });
  }
  const width = (c) => ({ money: 16, number: 12, integer: 10, date: 12 }[c.type] || Math.min(40, Math.max(12, String(c.label).length + 4)));
  const xcols = columns.map((c) => ({ key: c.key, header: c.label, type: c.type === 'number' ? 'number' : c.type, width: width(c) }));
  const sheets = [{ name: def.name, columns: xcols, rows: totalRow ? [...rows, totalRow] : rows }];
  if (result.groups?.length) {
    const sums = xcols.filter((c) => Object.hasOwn(totals, c.key));
    sheets.push({ name: 'Summary', columns: [{ key: 'group', header: columns.find((c) => c.key === result.groupBy)?.label || result.groupBy, width: 30 }, { key: 'count', header: 'Count', type: 'integer', width: 10 }, ...sums], rows: result.groups });
  }
  const info = [['Report', def.name], ['Company', meta.companyName], ['From', result.params.from], ['To', result.params.to], ['Criteria', result.params.criteria || ''],
    ...Object.entries(result.params.filters), ['Rows', result.total], ['Currency', meta.currency], ['Generated at', meta.generatedAt], ['Generated by', meta.by],
    ...Object.entries(result.summary || {}).map(([k, v]) => [k, v])];
  sheets.push({ name: 'Parameters', columns: [{ header: 'Parameter', width: 24 }, { header: 'Value', width: 50 }], rows: info.map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]), autoFilter: false });
  return writeXlsx({ sheets, title: def.name });
}

const genRow = async (r, withLink = true) => ({
  id: r.id, code: r.code, name: r.name, params: r.params, format: r.format, fileName: r.file_name, contentType: r.content_type,
  rowCount: r.row_count, sizeBytes: r.size_bytes, totals: r.totals, status: r.status, error: r.error,
  generatedBy: r.generated_by, triggeredBy: r.triggered_by, scheduleId: r.schedule_id, createdAt: r.created_at,
  downloadUrl: withLink && r.status === 'done' ? await downloadUrl(r.id) : null,
});

/** Delete generated files older than reports.retention_days. */
export async function purgeExpiredReports() {
  const days = Number(await getSetting('reports.retention_days', 90)) || 90;
  const old = await many('DELETE FROM generated_reports WHERE created_at < now() - ($1 || \' days\')::interval RETURNING storage_key', [String(days)]);
  for (const r of old) {
    const p = r.storage_key && path.resolve(config.uploadDir, r.storage_key);
    if (p && p.startsWith(path.resolve(config.uploadDir)) && fs.existsSync(p)) fs.unlinkSync(p);
  }
  return old.length;
}

/**
 * Generate a report file into UPLOAD_DIR/reports and record it in generated_reports.
 * @param {string} code report code
 * @param {object} params screen parameters (FromDate, ToDate, ReportCriteria, Agent, ...) and optional format
 * @param {string} triggeredBy 'user' | 'schedule' | ...
 * @param {{user?: object, format?: string, scheduleId?: string}} opts
 */
export async function generateReport(code, params = {}, triggeredBy = 'user', opts = {}) {
  const def = await getDefinition(code, triggeredBy === 'schedule' ? null : opts.user);
  const format = String(opts.format || params.format || (await getSetting('reports.default_format', 'xlsx')) || 'xlsx').toLowerCase();
  if (!FORMATS[format]) throw badRequest(`Format must be one of ${Object.keys(FORMATS).join(', ')}`);
  const by = opts.user?.username || triggeredBy;
  const cleanParams = { ...params };
  delete cleanParams.format;
  try {
    const result = await execute(def, cleanParams, { all: true, maxRows: await getSetting('reports.max_rows', 50000) });
    const generatedAt = new Date().toISOString();
    const meta = {
      generatedAt, by, companyName: ((await getSetting('general.company_name')) ?? ''),
      currency: await getSetting('currency.default', 'PHP'), pageSize: await getSetting('reports.pdf_page_size', 'A4'),
    };
    const buf = await renderFile(format, def, result, meta);
    const stamp = generatedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const fileName = `${def.code}_${result.params.from}_${result.params.to}_${stamp}.${FORMATS[format].ext}`;
    const key = `reports/${def.code}-${stamp}-${crypto.randomBytes(4).toString('hex')}.${FORMATS[format].ext}`;
    fs.mkdirSync(path.join(config.uploadDir, 'reports'), { recursive: true });
    fs.writeFileSync(path.join(config.uploadDir, key), buf);
    const row = await one(`INSERT INTO generated_reports(code, name, params, format, storage_key, row_count, generated_by, status, file_name, content_type, size_bytes, totals, triggered_by, schedule_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'done',$8,$9,$10,$11,$12,$13) RETURNING *`,
    [def.code, def.name, JSON.stringify(result.params), format, key, result.rows.length, opts.user?.id || triggeredBy, fileName, FORMATS[format].contentType, buf.length,
      JSON.stringify({ ...result.totals, ...result.summary }), triggeredBy, opts.scheduleId || null]);
    if (triggeredBy === 'schedule') await purgeExpiredReports();
    return { ...(await genRow(row)), truncated: result.total > result.rows.length, totalRows: result.total };
  } catch (e) {
    await query(`INSERT INTO generated_reports(code, name, params, format, generated_by, status, error, triggered_by, schedule_id)
      VALUES ($1,$2,$3,$4,$5,'failed',$6,$7,$8)`, [def.code, def.name, JSON.stringify(cleanParams), format, opts.user?.id || triggeredBy, e.message, triggeredBy, opts.scheduleId || null]);
    throw e;
  }
}

export async function listGenerated(user, { code, page, perPage, offset }) {
  const codes = isAdmin(user) ? null : (await many('SELECT * FROM report_definitions')).filter((d) => canAccess(user, d)).map((d) => d.code);
  const where = 'WHERE ($1::text IS NULL OR code = $1) AND ($2::text[] IS NULL OR code = ANY($2))';
  const total = (await one(`SELECT count(*)::int AS n FROM generated_reports ${where}`, [code || null, codes])).n;
  const rows = await many(`SELECT * FROM generated_reports ${where} ORDER BY created_at DESC LIMIT $3 OFFSET $4`, [code || null, codes, perPage, offset]);
  return { rows: await Promise.all(rows.map((r) => genRow(r))), total, page, perPage };
}

/** Resolve a generated file for download: caller is a user (access checked) or holds a signed link token. */
export async function getGeneratedFile(id, { user, token }) {
  const r = await one('SELECT * FROM generated_reports WHERE id = $1', [id]);
  if (!r) throw notFound('Generated report not found');
  if (!(token && verifyDownloadToken(token, id))) {
    if (!user) throw forbidden('Invalid or expired download link');
    const def = await one('SELECT * FROM report_definitions WHERE code = $1', [r.code]);
    if (def && !canAccess(user, def)) throw forbidden('You do not have access to this report');
  }
  if (r.status !== 'done' || !r.storage_key) throw notFound('Report file is not available');
  const p = path.resolve(config.uploadDir, r.storage_key);
  if (!p.startsWith(path.resolve(config.uploadDir)) || !fs.existsSync(p)) throw notFound('Report file has been removed');
  return { path: p, fileName: r.file_name || path.basename(p), contentType: r.content_type || FORMATS[r.format]?.contentType };
}

/* ---------- schedules ---------- */

/** Reload cron tasks after a schedule change (skipped under tests so no timers are left running). */
export async function reloadScheduler(log) {
  if (config.nodeEnv === 'test' || process.env.VITEST) return;
  await startScheduler(log);
}


const schedRow = (s) => ({
  id: s.id, name: s.name, reportCode: s.report_code, reportName: s.report_name, cron: s.cron, params: s.params, format: s.format,
  recipients: s.recipients, enabled: s.enabled, jobId: s.job_id, jobCode: s.job_code, lastRunAt: s.last_run_at, lastStatus: s.last_status,
  lastReportId: s.last_report_id, createdBy: s.created_by, createdAt: s.created_at, updatedAt: s.updated_at,
});
const SCHED_SELECT = `SELECT s.*, d.name AS report_name, j.code AS job_code FROM report_schedules s
  JOIN report_definitions d ON d.code = s.report_code LEFT JOIN scheduled_jobs j ON j.id = s.job_id`;

export async function listSchedules(user, { reportCode } = {}) {
  const rows = await many(`${SCHED_SELECT} WHERE s.status = 'active' AND ($1::text IS NULL OR s.report_code = $1) ORDER BY s.created_at DESC`, [reportCode || null]);
  if (isAdmin(user)) return rows.map(schedRow);
  const defs = Object.fromEntries((await many('SELECT * FROM report_definitions')).map((d) => [d.code, d]));
  return rows.filter((r) => canAccess(user, defs[r.report_code])).map(schedRow);
}
export async function getSchedule(id) {
  const s = await one(`${SCHED_SELECT} WHERE s.id = $1 AND s.status = 'active'`, [id]);
  if (!s) throw notFound('Report schedule not found');
  return s;
}

const jobParams = (s) => ({ scheduleId: s.id, reportCode: s.report_code, params: s.params, format: s.format, recipients: s.recipients });
function checkCron(expr) {
  if (!cron.validate(expr)) throw badRequest(`Invalid cron expression: ${expr}`);
}

export async function createSchedule(user, b) {
  checkCron(b.cron);
  const def = await getDefinition(b.reportCode, user);
  const id = await withTransaction(async (c) => {
    const s = (await c.query(`INSERT INTO report_schedules(name, report_code, cron, params, format, recipients, enabled, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`, [b.name || `${def.name} (${b.format})`, def.code, b.cron, JSON.stringify(b.params || {}), b.format, b.recipients, b.enabled, user.username])).rows[0];
    const job = (await c.query(`INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES ($1,$2,$3,$4,'scheduledReport',$5,$6) RETURNING id`,
      [`report-${s.id}`, `Report: ${s.name}`, `Scheduled ${def.name} (${s.format}) to ${s.recipients.join(', ') || 'no recipients'}`, s.cron, JSON.stringify(jobParams(s)), s.enabled])).rows[0];
    await c.query('UPDATE report_schedules SET job_id = $2 WHERE id = $1', [s.id, job.id]);
    return s.id;
  });
  return getSchedule(id);
}

export async function updateSchedule(user, id, b) {
  const before = await getSchedule(id);
  if (b.cron) checkCron(b.cron);
  if (b.reportCode) await getDefinition(b.reportCode, user);
  else await getDefinition(before.report_code, user);
  await withTransaction(async (c) => {
    const s = (await c.query(`UPDATE report_schedules SET name = COALESCE($2, name), report_code = COALESCE($3, report_code), cron = COALESCE($4, cron),
      params = COALESCE($5, params), format = COALESCE($6, format), recipients = COALESCE($7, recipients), enabled = COALESCE($8, enabled),
      updated_by = $9, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, b.name ?? null, b.reportCode ?? null, b.cron ?? null, b.params ? JSON.stringify(b.params) : null, b.format ?? null, b.recipients ?? null, b.enabled ?? null, user.username])).rows[0];
    if (s.job_id) {
      await c.query(`UPDATE scheduled_jobs SET name = $2, cron = $3, params = $4, enabled = $5, updated_at = now() WHERE id = $1`,
        [s.job_id, `Report: ${s.name}`, s.cron, JSON.stringify(jobParams(s)), s.enabled]);
    }
  });
  return { before, after: await getSchedule(id) };
}

export async function deleteSchedule(user, id) {
  const s = await getSchedule(id);
  await getDefinition(s.report_code, user);
  await withTransaction(async (c) => {
    await c.query('UPDATE report_schedules SET status = \'deleted\', enabled = false, job_id = NULL, updated_by = $2, updated_at = now() WHERE id = $1', [id, user.username]);
    if (s.job_id) await c.query('DELETE FROM scheduled_jobs WHERE id = $1', [s.job_id]);
  });
  return s;
}

const fill = (tpl, vars, escape) => String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
  const v = vars[k] ?? '';
  return escape ? String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : String(v);
});

/**
 * Job handler for scheduled reports (scheduled_jobs.handler = 'scheduledReport').
 * params: { scheduleId } (preferred: reads the current schedule) or inline { reportCode, params, format, recipients }.
 */
export async function scheduledReport(params = {}) {
  let s = null;
  if (params.scheduleId) {
    s = await one('SELECT * FROM report_schedules WHERE id = $1 AND status = \'active\'', [params.scheduleId]);
    if (!s) return { skipped: `schedule ${params.scheduleId} not found or deleted` };
  }
  const code = s?.report_code || params.reportCode;
  if (!code) throw new Error('scheduledReport needs scheduleId or reportCode');
  const recipients = s?.recipients || params.recipients || [];
  try {
    const rpt = await generateReport(code, { ...(s?.params || params.params || {}) }, 'schedule', { format: s?.format || params.format, scheduleId: s?.id });
    const vars = {
      reportName: rpt.name, from: rpt.params.from, to: rpt.params.to, rows: rpt.rowCount, format: rpt.format.toUpperCase(), fileName: rpt.fileName,
      downloadUrl: rpt.downloadUrl, companyName: ((await getSetting('general.company_name')) ?? ''), generatedAt: rpt.createdAt instanceof Date ? rpt.createdAt.toISOString() : rpt.createdAt,
    };
    const subject = fill(await getSetting('reports.email_subject'), vars, false);
    const html = fill(await getSetting('reports.email_body'), vars, true);
    let emailed = 0;
    if (recipients.length) {
      await queueEmail({ to: recipients.join(','), subject, html, template: 'scheduled-report', entity: 'generated_report', entityId: rpt.id });
      emailed = recipients.length;
    }
    if (s) await query('UPDATE report_schedules SET last_run_at = now(), last_status = \'success\', last_report_id = $2 WHERE id = $1', [s.id, rpt.id]);
    return { reportId: rpt.id, code, format: rpt.format, rows: rpt.rowCount, emailed };
  } catch (e) {
    if (s) await query('UPDATE report_schedules SET last_run_at = now(), last_status = \'failed\' WHERE id = $1', [s.id]);
    throw e;
  }
}
