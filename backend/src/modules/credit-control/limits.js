/**
 * Client credit limits. clients.credit_limit caps the client's exposure: the open broker-billed premium of all its
 * policies (receivable balances). The limit is set by a user with approve:credit-control; a client without a limit is
 * not checked. When a new broker-billed policy takes the client over its limit the issue goes ahead (the broker does not
 * refuse cover over it) but Accounting is warned: the case is kept in client_credit_exceptions and notified.
 */
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { notify } from '../notifications/service.js';

/** Open broker-billed premium of a client. */
export async function clientExposure(db, clientId) {
  return round2((await db.query(`SELECT COALESCE(sum(r.balance), 0) AS b FROM receivables r JOIN policies p ON p.id = r.policy_id
    WHERE r.client_id = $1 AND r.status IN ('open', 'partial') AND r.balance > 0 AND p.billing_mode <> 'direct'`, [clientId])).rows[0].b);
}

const limitOut = (c, exposure) => {
  const limit = c.credit_limit === null ? null : Number(c.credit_limit);
  return { clientId: c.id, clientCode: c.client_code, clientName: c.display_name, creditLimit: limit, exposure, available: limit === null ? null : round2(limit - exposure),
    overLimit: limit !== null && exposure > limit, updatedBy: c.updated_by_name || c.credit_limit_updated_by || null, updatedAt: c.credit_limit_updated_at || null };
};

/** Clients with a limit or an exposure (search on name / code; overOnly). */
export async function listLimits(db, qs = {}) {
  const rows = (await db.query(`SELECT c.*, (SELECT display_name FROM users u WHERE u.id = c.credit_limit_updated_by) AS updated_by_name,
      (SELECT COALESCE(sum(r.balance), 0) FROM receivables r JOIN policies p ON p.id = r.policy_id
        WHERE r.client_id = c.id AND r.status IN ('open', 'partial') AND r.balance > 0 AND p.billing_mode <> 'direct') AS exposure
    FROM clients c WHERE c.status <> 'deleted' AND ($1::text IS NULL OR c.display_name ILIKE '%' || $1 || '%' OR c.client_code ILIKE '%' || $1 || '%')
    ORDER BY c.credit_limit IS NULL, c.display_name LIMIT 300`, [qs.search || null])).rows;
  let out = rows.map((c) => limitOut(c, round2(c.exposure)));
  if (!qs.search) out = out.filter((c) => c.creditLimit !== null || c.exposure > 0);
  if (qs.overOnly === 'true') out = out.filter((c) => c.overLimit);
  return out;
}

export async function getLimit(db, clientRef) {
  const c = (await db.query('SELECT * FROM clients WHERE id = $1 OR client_code = $1', [String(clientRef)])).rows[0];
  if (!c) throw notFound(`Client ${clientRef} not found`);
  return limitOut(c, await clientExposure(db, c.id));
}

/** Set (or remove with null) a client's credit limit. Returns { before, after }. */
export async function setLimit(db, clientRef, value, user) {
  const before = await getLimit(db, clientRef);
  const limit = value === null || value === '' || value === undefined ? null : round2(Number(value));
  if (limit !== null && !(limit >= 0)) throw badRequest('Validation failed', [{ path: 'creditLimit', message: 'The credit limit must be zero or more (empty for no limit)' }]);
  await db.query('UPDATE clients SET credit_limit = $2, credit_limit_updated_by = $3, credit_limit_updated_at = now() WHERE id = $1', [before.clientId, limit, user?.id ?? null]);
  return { before, after: await getLimit(db, before.clientId) };
}

/** What a new premium would do to the client's exposure (for a warning before a policy is issued). */
export async function creditCheck(db, clientRef, amount) {
  const l = await getLimit(db, clientRef);
  const after = round2(l.exposure + round2(Number(amount) || 0));
  return { ...l, newAmount: round2(Number(amount) || 0), exposureAfter: after, exceeds: l.creditLimit !== null && after > l.creditLimit,
    exceededBy: l.creditLimit !== null && after > l.creditLimit ? round2(after - l.creditLimit) : 0 };
}

/**
 * After a broker-billed policy is billed (policy issue): when the client's exposure, the new bill included, is over its
 * limit, record the exception and notify Accounting. Returns the warning, or null. Never blocks the issue.
 */
export async function warnIfOverLimit(db, { clientId, policyId, amount, user = null }) {
  if (!clientId || (await getSetting('credit.check_credit_limit', true)) === false) return null;
  const c = (await db.query('SELECT id, display_name, credit_limit FROM clients WHERE id = $1', [clientId])).rows[0];
  if (!c || c.credit_limit === null) return null;
  const exposure = await clientExposure(db, c.id);
  const limit = Number(c.credit_limit);
  if (!(exposure > limit)) return null;
  const newAmount = round2(amount);
  await db.query(`INSERT INTO client_credit_exceptions(client_id, policy_id, credit_limit, exposure_before, new_amount, exposure_after, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [c.id, policyId, limit, round2(exposure - newAmount), newAmount, exposure, user?.id ?? null]);
  const policy = policyId ? (await db.query('SELECT policy_number FROM policies WHERE id = $1', [policyId])).rows[0] : null;
  const message = `${c.display_name}: open premium ${exposure.toFixed(2)} is over the credit limit ${limit.toFixed(2)} by ${(exposure - limit).toFixed(2)} after ${policy?.policy_number || 'the new policy'}`;
  await notify({ audience: 'write:collections', type: 'warning', title: 'Client credit limit exceeded', message, link: '/accounts/credit-control/limits', entity: 'client', entityId: c.id });
  return { creditLimit: limit, exposure, exceededBy: round2(exposure - limit), message };
}

/** Policies issued over a client's credit limit (acknowledged or not). */
export async function listExceptions(db, qs = {}) {
  return (await db.query(`SELECT x.*, c.display_name AS client_name, c.client_code, p.policy_number, (SELECT display_name FROM users u WHERE u.id = x.acknowledged_by) AS acknowledged_by_name
    FROM client_credit_exceptions x JOIN clients c ON c.id = x.client_id LEFT JOIN policies p ON p.id = x.policy_id
    WHERE ($1::boolean IS NOT TRUE OR x.acknowledged_at IS NULL) ORDER BY x.created_at DESC LIMIT 300`, [qs.openOnly === 'true'])).rows
    .map((x) => ({ id: Number(x.id), clientId: x.client_id, clientCode: x.client_code, clientName: x.client_name, policyId: x.policy_id, policyNumber: x.policy_number,
      creditLimit: Number(x.credit_limit), exposureBefore: Number(x.exposure_before), newAmount: Number(x.new_amount), exposureAfter: Number(x.exposure_after),
      exceededBy: round2(Number(x.exposure_after) - Number(x.credit_limit)), createdAt: x.created_at, acknowledgedBy: x.acknowledged_by_name, acknowledgedAt: x.acknowledged_at, remarks: x.remarks }));
}

export async function acknowledgeException(db, id, remarks, user) {
  const r = await db.query('UPDATE client_credit_exceptions SET acknowledged_by = $2, acknowledged_at = now(), remarks = $3 WHERE id = $1 AND acknowledged_at IS NULL RETURNING id', [Number(id) || 0, user?.id ?? null, remarks || null]);
  if (!r.rowCount) throw notFound('Open credit limit exception not found');
  return { id: Number(id), acknowledged: true };
}
