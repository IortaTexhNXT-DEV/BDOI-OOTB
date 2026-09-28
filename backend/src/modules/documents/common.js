/** Helpers shared by the sales and policy-administration modules (leads, clients, quotations, policies, endorsements). */
import { getSetting } from '../../lib/settings.js';
import { query } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';

/**
 * Single-record response. Several screens read the record at the top level (response.leadId, response.quotationId)
 * and others read response.data, so the record is returned in both places.
 */
export const sendEntity = (res, entity, { status = 200, message = 'OK', extra = {} } = {}) => res.status(status)
  .json({ ...entity, ...extra, success: true, message, data: entity });

/** Next document number from the numbering sequence, prefix from app_settings (numbering.<entity>.prefix). */
export async function nextNumber(db, seq, entity) {
  const prefix = await getSetting(`numbering.${entity}.prefix`, entity.toUpperCase().slice(0, 3));
  const r = await (db || { query }).query('SELECT next_number($1, $2) AS n', [seq, prefix]);
  return r.rows[0].n;
}

/** Replace {{placeholders}} in an e-mail / document template with values (HTML-escaped). */
export function renderTemplate(tpl, vars) {
  const escape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => escape(vars[k]));
}

/** Read an e-mail template ({subject, html}) from app_settings. */
export async function emailTemplate(key) {
  const t = await getSetting(`email.template.${key}`, null);
  if (!t || !t.subject) throw badRequest(`E-mail template email.template.${key} is not configured`);
  return t;
}

/** Parse a money-like value ("12,345.60", 12345.6, "") to a number. */
export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Parse a date-like value to YYYY-MM-DD (null when empty or invalid). */
export const toDate = (v) => {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** LOB code from free text used by the screens ("Fire and Allied Perils", "FIRE", "Industrial All Risks", "Motor"). */
export function lobOf(...values) {
  for (const v of values) {
    if (!v) continue;
    const u = String(v).toUpperCase();
    if (u === 'IAR' || u.includes('INDUSTRIAL ALL RISK') || u.includes('INDUSTRIAL_ALL_RISK')) return 'IAR';
    if (u.includes('FIRE')) return 'FIRE';
    if (u.includes('EMPLOYEE') || u === 'EB') return 'EB';
    if (u.includes('MOTOR') || u.includes('CTPL') || u.includes('COMPREHENSIVE')) return 'MOTOR';
  }
  return 'MOTOR';
}

/** Current user identity for created_by / updated_by columns. */
export const actor = (req) => req.user?.id || null;

/** Users holding one of the given role codes (for workflow notifications). */
export async function usersWithRoles(roles) {
  const r = await query(`SELECT DISTINCT u.id, u.email, u.display_name FROM users u JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles ro ON ro.id = ur.role_id WHERE ro.code = ANY($1) AND u.status = 'active'`, [roles]);
  return r.rows;
}
