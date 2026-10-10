/**
 * Guarded policy data (TIS-BRD-ISSUE-04, SEC-03). The core data of an issued policy (policies.correction_fields) is
 * not changed by editing the policy: a correction is requested with a coded reason (and the insurer's reference for
 * the fields of policies.correction_insurer_fields) and applied when a second user holding approve:policies approves
 * it. The status of a policy never changes by editing. Migration 0481.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { isoDate } from '../../lib/dates.js';
import { formatDate } from '../../lib/pdf/format.js';
import { requiredReason } from '../ops-masters/records.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { policyStatusIn, policyStatusOut } from '../documents/statuses.js';
import { getPolicyRow, insurerId } from './service.js';

/** The correctable fields: API name, column, label and how a value is read. */
export const FIELDS = {
  policyNumber: { column: 'policy_number', label: 'Policy number', read: (v) => (v === null || v === undefined ? null : String(v).trim() || null) },
  insuredName: { column: 'insured_name', label: 'Insured name', read: (v) => (v === null || v === undefined ? null : String(v).trim() || null) },
  inception: { column: 'inception_date', label: 'Inception date', read: (v) => isoDate(v) },
  expiry: { column: 'expiry_date', label: 'Expiry date', read: (v) => isoDate(v) },
  insuranceCompanyId: { column: 'insurance_company_id', label: 'Insurer', read: (v) => (v === null || v === undefined || v === '' ? null : Number(v)) },
};
/** Names the screens and the upload send for the same fields. */
const ALIASES = { inceptionDate: 'inception', expiryDate: 'expiry', insuranceCompanyName: 'insuranceCompanyId' };

const STATUS_LABEL = { pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn' };
const shown = (field, v) => (v === null || v === undefined ? '' : ['inception', 'expiry'].includes(field) ? formatDate(v) : String(v));

/** The value a body gives for a correctable field (the insurer resolved from its name or code), or undefined. */
async function valueOf(db, body, field) {
  const keys = [field, ...Object.entries(ALIASES).filter(([, f]) => f === field).map(([a]) => a)];
  const key = keys.find((k) => body[k] !== undefined && body[k] !== '');
  if (!key) return undefined;
  if (field === 'insuranceCompanyId') {
    const id = await insurerId(db, body[key]);
    if (!id) throw badRequest(`Insurer ${body[key]} was not found`);
    return id;
  }
  return FIELDS[field].read(body[key]);
}

/** The correctable fields whose value in the body differs from the policy: { field: { from, to } }. */
async function differences(db, policy, body, fields) {
  const out = {};
  for (const f of fields) {
    const to = await valueOf(db, body, f);
    if (to === undefined) continue;
    const from = FIELDS[f].read(policy[FIELDS[f].column]);
    if (String(from ?? '') !== String(to ?? '')) out[f] = { from, to };
  }
  return out;
}

/**
 * Edit guard of PUT /policies/:id: the status is never set by editing, and the correctable fields of a policy past
 * Draft are changed by a correction. Values equal to the policy's (a screen sending the whole record) pass.
 */
export async function assertEditable(db, policy, body) {
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    const to = policyStatusIn(body.status);
    if (to !== policy.status && policyStatusOut(to) !== policyStatusOut(policy.status)) {
      throw badRequest(`The status of policy ${policy.policy_number} follows its endorsements, cancellation, renewal and expiry; it is not edited`);
    }
  }
  if (policy.status === 'draft') return;
  const changed = await differences(db, policy, body, Object.keys(FIELDS));
  if (Object.keys(changed).length) {
    throw badRequest(`${Object.keys(changed).map((f) => FIELDS[f].label).join(', ')} of policy ${policy.policy_number} change by a correction approved by a second user (Request correction)`);
  }
}

export const toCorrection = (r) => ({
  id: r.id, policyId: r.policy_id, status: r.status, statusLabel: STATUS_LABEL[r.status] || r.status,
  changes: Object.entries(r.changes || {}).map(([field, v]) => ({ field, label: FIELDS[field]?.label || field, from: v.from, to: v.to, fromText: v.fromText ?? shown(field, v.from), toText: v.toText ?? shown(field, v.to) })),
  reasonCode: r.reason_code, reason: r.reason, insurerReference: r.insurer_reference, requestedBy: r.requested_by_name || r.requested_by, requestedById: r.requested_by,
  requestedAt: r.requested_at, decidedBy: r.decided_by_name || r.decided_by, decidedAt: r.decided_at, decisionReasonCode: r.decision_reason_code, decisionReason: r.decision_reason,
});

const SELECT = `SELECT c.*, (SELECT display_name FROM users WHERE id = c.requested_by) AS requested_by_name,
  (SELECT display_name FROM users WHERE id = c.decided_by) AS decided_by_name FROM policy_corrections c`;

export async function listCorrections(policyId) {
  const policy = await getPolicyRow(policyId);
  return (await many(`${SELECT} WHERE c.policy_id = $1 ORDER BY c.requested_at DESC`, [policy.id])).map(toCorrection);
}

/** The insurer name shown for an insurer id. */
const insurerName = async (db, id) => (id ? (await db.query('SELECT name FROM insurance_companies WHERE id = $1', [id])).rows[0]?.name || String(id) : '');

/**
 * Request a correction of an issued policy: the changes (policies.correction_fields), a reason code of the context
 * policy_correction (and its note when the reason needs one), the insurer's reference when a field of
 * policies.correction_insurer_fields changes. One pending correction per policy.
 */
export async function requestCorrection(policyId, body, user) {
  const allowed = await getSetting('policies.correction_fields', Object.keys(FIELDS));
  const insurerFields = await getSetting('policies.correction_insurer_fields', ['policyNumber', 'inception', 'expiry', 'insuranceCompanyId']);
  const r = await withTransaction(async (db) => {
    const policy = await getPolicyRow(policyId, db);
    if (['cancelled', 'draft'].includes(policy.status)) throw badRequest(`A ${policyStatusOut(policy.status)} policy is not corrected`);
    const given = body.changes && typeof body.changes === 'object' ? body.changes : {};
    const outside = Object.keys(given).filter((f) => !allowed.includes(ALIASES[f] || f));
    if (outside.length) throw badRequest(`These fields are not corrected here: ${outside.join(', ')}`);
    const changes = await differences(db, policy, given, allowed);
    if (!Object.keys(changes).length) throw badRequest('Enter at least one value that differs from the policy');
    const inception = changes.inception?.to ?? FIELDS.inception.read(policy.inception_date);
    const expiry = changes.expiry?.to ?? FIELDS.expiry.read(policy.expiry_date);
    if (inception && expiry && expiry <= inception) throw badRequest('The expiry date must be after the inception date');
    if (changes.policyNumber) {
      const dup = (await db.query('SELECT 1 FROM policies WHERE policy_number = $1 AND id <> $2', [changes.policyNumber.to, policy.id])).rows[0];
      if (dup) throw conflict(`Policy number ${changes.policyNumber.to} already exists`);
    }
    const reference = String(body.insurerReference || '').trim() || null;
    const needsInsurer = Object.keys(changes).filter((f) => insurerFields.includes(f));
    if (needsInsurer.length && !reference) {
      throw badRequest('Validation failed', [{ path: 'insurerReference', message: `Enter the insurer's reference confirming the change of ${needsInsurer.map((f) => FIELDS[f].label.toLowerCase()).join(', ')}` }]);
    }
    const why = await requiredReason(db, 'policy_correction', { reasonCode: body.reasonCode, note: body.note });
    if (changes.insuranceCompanyId) {
      changes.insuranceCompanyId.fromText = await insurerName(db, changes.insuranceCompanyId.from);
      changes.insuranceCompanyId.toText = await insurerName(db, changes.insuranceCompanyId.to);
    }
    const pending = (await db.query("SELECT id FROM policy_corrections WHERE policy_id = $1 AND status = 'pending'", [policy.id])).rows[0];
    if (pending) throw conflict(`Policy ${policy.policy_number} already has a correction waiting for approval`);
    const row = (await db.query(`INSERT INTO policy_corrections(policy_id, changes, reason_code, reason, insurer_reference, requested_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [policy.id, JSON.stringify(changes), why.code, why.text, reference, user.id])).rows[0];
    return { policy, id: row.id };
  });
  const correction = toCorrection(await one(`${SELECT} WHERE c.id = $1`, [r.id]));
  await notifyApprovers({ audience: 'approve:policies', document: 'Policy correction', number: r.policy.policy_number, by: user.username,
    detail: correction.changes.map((c) => c.label).join(', '), link: `/agent/policydetail/${r.policy.id}`, entity: 'policy', entityId: r.policy.id });
  return { policy: r.policy, correction };
}

/**
 * Approve (apply the changes) or reject (reason code of the context policy_correction_reject) a pending correction:
 * approve:policies, never the user who requested it. The policy must still hold the values the request changed from.
 */
export async function decideCorrection(policyId, correctionId, { decision, reasonCode = null, note = null }, user) {
  if (!['approve', 'reject'].includes(decision)) throw badRequest('decision must be approve or reject');
  if (!hasPermission(user, 'approve:policies')) throw forbidden('Requires permission: approve:policies');
  const r = await withTransaction(async (db) => {
    const policy = await getPolicyRow(policyId, db);
    const c = (await db.query('SELECT * FROM policy_corrections WHERE id = $1 AND policy_id = $2 FOR UPDATE', [correctionId, policy.id])).rows[0];
    if (!c) throw notFound('Correction not found');
    if (c.status !== 'pending') throw badRequest(`The correction is already ${STATUS_LABEL[c.status].toLowerCase()}`);
    if (c.requested_by === user.id) throw forbidden('Maker-checker: the user who requested the correction cannot decide it');
    if (decision === 'reject') {
      const why = await requiredReason(db, 'policy_correction_reject', { reasonCode, note });
      await db.query(`UPDATE policy_corrections SET status = 'rejected', decided_by = $2, decided_at = now(), decision_reason_code = $3, decision_reason = $4 WHERE id = $1`,
        [c.id, user.id, why.code, why.text]);
      return { policy, before: policy, after: policy, correction: c, reason: why.text };
    }
    for (const [field, v] of Object.entries(c.changes)) {
      if (String(FIELDS[field].read(policy[FIELDS[field].column]) ?? '') !== String(v.from ?? '')) {
        throw conflict(`The ${FIELDS[field].label.toLowerCase()} of policy ${policy.policy_number} changed since the request: reject it and request the correction again`);
      }
    }
    const cols = Object.fromEntries(Object.entries(c.changes).map(([field, v]) => [FIELDS[field].column, v.to]));
    const keys = Object.keys(cols);
    await db.query(`UPDATE policies SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`,
      [policy.id, ...Object.values(cols), user.id]);
    await db.query("UPDATE policy_corrections SET status = 'approved', decided_by = $2, decided_at = now() WHERE id = $1", [c.id, user.id]);
    return { policy, before: policy, after: await getPolicyRow(policy.id, db), correction: c, reason: null };
  });
  await notifyDecision({ userId: r.correction.requested_by, decidedBy: user.id, document: 'Policy correction', number: r.policy.policy_number, approved: decision === 'approve',
    by: user.username, reason: r.reason, link: `/agent/policydetail/${r.policy.id}`, entity: 'policy', entityId: r.policy.id });
  return { ...r, correction: toCorrection(await one(`${SELECT} WHERE c.id = $1`, [r.correction.id])) };
}

/** Withdraw an own pending correction. */
export async function withdrawCorrection(policyId, correctionId, user) {
  const policy = await getPolicyRow(policyId);
  const r = await query(`UPDATE policy_corrections SET status = 'withdrawn', decided_by = $3, decided_at = now()
    WHERE id = $1 AND policy_id = $2 AND status = 'pending' AND requested_by = $3 RETURNING id`, [correctionId, policy.id, user.id]);
  if (!r.rowCount) throw badRequest('Only your own pending correction can be withdrawn');
  return { policy, correction: toCorrection(await one(`${SELECT} WHERE c.id = $1`, [correctionId])) };
}
