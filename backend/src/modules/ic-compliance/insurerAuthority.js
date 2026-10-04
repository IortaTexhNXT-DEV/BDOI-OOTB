/**
 * Placement only with insurers authorised by the Insurance Commission. The certificate of authority number and its
 * validity are fields of the insurer master (insurance_companies.attrs: icCertificateNumber, icCertificateValidUntil).
 *
 * assertInsurersAuthorised() is called when a request for quotation goes to an insurer, when the firm order of a
 * placement slip is sent and when a policy is issued; compliance.insurer_authority_check decides what a missing or
 * expired certificate does: block (409 with the reason), warn (allowed; the warning is returned with the answer and
 * recorded in the audit trail, lib/complianceWarnings.js) or off.
 */
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { conflict } from '../../lib/errors.js';
import { addComplianceWarning } from '../../lib/complianceWarnings.js';
import { daysBetween } from './common.js';

export async function authorityMode() {
  const v = String(await getSetting('compliance.insurer_authority_check', 'warn'));
  return ['block', 'warn', 'off'].includes(v) ? v : 'warn';
}
export async function authorityExpiringDays() {
  const n = Number(await getSetting('compliance.insurer_authority_expiring_days', 60));
  return Number.isFinite(n) && n >= 0 ? n : 60;
}

const validDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** Certificate of authority of an insurer row on a date: { certificateNumber, validUntil, state, daysLeft }. */
export function authorityOf(row, now, window) {
  const a = row.attrs || {};
  const certificateNumber = a.icCertificateNumber ? String(a.icCertificateNumber).trim() : '';
  const validUntil = validDate(a.icCertificateValidUntil);
  let state = 'valid';
  if (!certificateNumber) state = 'missing';
  else if (!validUntil) state = 'no-validity';
  else if (validUntil < now) state = 'expired';
  else if (daysBetween(now, validUntil) <= window) state = 'expiring';
  return { certificateNumber: certificateNumber || null, validUntil, state, daysLeft: validUntil ? daysBetween(now, validUntil) : null, licence: a.icLineOfBusiness || null };
}

/** Report: every insurer (active by default) with the state of its certificate; filters state, status=all, search. */
export async function authorityReport(q = {}) {
  const now = await today();
  const window = await authorityExpiringDays();
  const rows = await many(`SELECT id, code, name, short_name, status, attrs FROM insurance_companies
     WHERE ($1::boolean OR status = 'active') AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR code ILIKE '%' || $2 || '%') ORDER BY name`,
  [String(q.status) === 'all', q.search ? String(q.search) : null]);
  const all = rows.map((r) => ({ id: r.id, code: r.code, name: r.name, shortName: r.short_name, status: r.status, ...authorityOf(r, now, window) }));
  const states = q.state ? String(q.state).split(',') : null;
  const summary = { total: all.length, valid: 0, expiring: 0, expired: 0, missing: 0, noValidity: 0 };
  for (const r of all) {
    if (r.state === 'no-validity') summary.noValidity += 1;
    else summary[r.state] += 1;
  }
  return { items: states ? all.filter((r) => states.includes(r.state)) : all, summary, today: now, expiringDays: window, mode: await authorityMode() };
}

const STAGE_LABEL = { rfq: 'send a request for quotation to', order: 'send the firm order to', issue: 'issue a policy with' };

/**
 * Check the insurers of a step. Throws 409 in block mode when one has no certificate in force; in warn mode records a
 * warning per insurer. Returns the problems found ([{ insurerId, name, state, message }]).
 */
export async function assertInsurersAuthorised(insurerIds, stage, { entity = null, entityId = null } = {}) {
  const ids = [...new Set((insurerIds || []).filter((x) => x !== null && x !== undefined && x !== '').map(Number).filter(Number.isFinite))];
  if (!ids.length) return [];
  const mode = await authorityMode();
  if (mode === 'off') return [];
  const now = await today();
  const rows = await many('SELECT id, code, name, attrs FROM insurance_companies WHERE id = ANY($1::int[])', [ids]);
  const problems = [];
  for (const r of rows) {
    const a = authorityOf(r, now, 0);
    if (['valid', 'expiring'].includes(a.state)) continue;
    const why = a.state === 'missing' ? 'has no IC certificate of authority number on the insurer master'
      : a.state === 'no-validity' ? 'has no validity date for its IC certificate of authority on the insurer master'
        : `has an IC certificate of authority (${a.certificateNumber}) that expired on ${a.validUntil}`;
    problems.push({ insurerId: r.id, name: r.name, state: a.state, message: `${r.name} ${why}` });
  }
  if (!problems.length) return [];
  const text = `Cannot ${STAGE_LABEL[stage] || 'place business with'} an insurer without a certificate of authority in force: ${problems.map((p) => p.message).join('; ')}. Update the insurer in Master > Insurance Company.`;
  if (mode === 'block') throw conflict(text);
  for (const p of problems) {
    await addComplianceWarning(`Insurer authority: ${p.message} (${STAGE_LABEL[stage] || stage})`, { kind: 'insurer-authority', entity: entity || 'insurance_company', entityId: entityId || p.insurerId });
  }
  return problems;
}
