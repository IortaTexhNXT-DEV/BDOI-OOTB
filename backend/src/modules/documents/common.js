/** Helpers shared by the sales and policy-administration modules (leads, clients, quotations, policies, endorsements). */
import { getSetting } from '../../lib/settings.js';
import { query } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { num } from '../../lib/money.js';
import { formatAmount } from '../../lib/pdf/format.js';

/**
 * Single-record response. Several screens read the record at the top level (response.leadId, response.quotationId)
 * and others read response.data, so the record is returned in both places.
 */
export const sendEntity = (res, entity, { status = 200, message = 'OK', extra = {} } = {}) => res.status(status)
  .json({ ...entity, ...extra, success: true, message, data: entity });

export { renderTemplate } from '../../lib/template.js';

/** Read an e-mail template ({subject, html}) from app_settings. */
export async function emailTemplate(key) {
  const t = await getSetting(`email.template.${key}`, null);
  if (!t || !t.subject) throw badRequest(`E-mail template email.template.${key} is not configured`);
  return t;
}

export { num, round2 } from '../../lib/money.js';

/** An amount for an e-mail or letter text: thousand separators and two decimals ("1,250.00"); 0.00 when empty. */
export const amountText = (v) => formatAmount(num(v));

/** LOB code from free text used by the screens ("Fire and Allied Perils", "FIRE", "Industrial All Risks", "Motor"). */
export function lobOf(...values) {
  for (const v of values) {
    if (!v) continue;
    const u = String(v).toUpperCase();
    // line codes of the placement journey (products master lines) are kept as they are
    if (['MARINE', 'CASUALTY', 'ENGINEERING', 'ACCIDENT', 'LIFE'].includes(u)) return u;
    if (u === 'IAR' || u.includes('INDUSTRIAL ALL RISK') || u.includes('INDUSTRIAL_ALL_RISK')) return 'IAR';
    if (u.includes('FIRE')) return 'FIRE';
    if (u.includes('EMPLOYEE') || u === 'EB') return 'EB';
    // product names of the non-motor lines (products master): a Travel or Personal Accident product is never priced as
    // motor, and "Comprehensive General Liability" is casualty, not a comprehensive motor cover
    if (u.includes('TRAVEL') || u.includes('PERSONAL ACCIDENT') || u === 'PA' || u === 'GPA' || u.includes('MICRO')) return 'ACCIDENT';
    if (u.includes('LIABILITY') || u.includes('BOND') || u.includes('MONEY') || u.includes('BURGLARY')) return 'CASUALTY';
    if (u.includes('HOUSEHOLD')) return 'FIRE';
    if (u.includes('ALL RISK') || u.includes('MACHINERY') || u === 'CAR' || u === 'EAR') return 'ENGINEERING';
    if (u.includes('CARGO') || u.includes('HULL') || u.includes('PARCEL') || u.includes('COURIER')) return 'MARINE';
    if (u.includes('CREDIT LIFE') || u.includes('GROUP LIFE') || u.startsWith('CL-')) return 'LIFE';
    if (u.includes('MOTOR') || u.includes('CTPL') || u.includes('COMPREHENSIVE')) return 'MOTOR';
  }
  return 'MOTOR';
}

/** Current user identity for created_by / updated_by columns. */
export const actor = (req) => req.user?.id || null;

/** Users holding one of the given role codes (for workflow notifications). */
export async function usersWithRoles(roles) {
  const r = await query(`SELECT DISTINCT u.id, u.email, u.display_name FROM users u
    WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM user_effective_roles(u.id) er WHERE er.code = ANY($1))`, [roles]);
  return r.rows;
}
