/**
 * Premium warranty monitor. A broker-billed policy must be paid within the premium payment warranty of its insurer
 * (insurance_companies.premium_warranty_days, else collections.default_credit_days) from inception. The deadline moves
 * with an approved extension. What must be paid by then is the policy's open premium; on an instalment plan, only the
 * instalments already due.
 *
 * Status: breached (deadline passed, premium due unpaid), at risk (deadline within credit.warranty_warning_days) or
 * within warranty. Actions: reminder to the client (collection e-mail), extension request (approved by another user with
 * approve:credit-control, at most credit.max_warranty_extension_days after inception) and a cancellation request for
 * non-payment, raised as a draft cancellation endorsement for Operations. Nothing is cancelled automatically.
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { round2 } from '../../lib/money.js';
import { notify } from '../notifications/service.js';
import { allocatePaid } from './instalments.js';

const EPS = 0.005;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Open broker-billed policies with their warranty deadline and premium due (all, or the given policy ids). */
async function policiesWithPremiumDue(db, policyIds = null) {
  const defaultDays = Number(await getSetting('collections.default_credit_days', 30)) || 0;
  const rows = (await db.query(`SELECT p.id, p.policy_number, p.inception_date, p.client_id, p.owner_user_id, p.insurance_company_id, c.display_name AS client_name, c.email AS client_email,
      ic.name AS insurer_name, COALESCE(ic.premium_warranty_days, $1::int) AS warranty_days,
      (SELECT max(requested_deadline) FROM premium_warranty_extensions x WHERE x.policy_id = p.id AND x.status = 'approved') AS extended_to,
      (SELECT json_build_object('id', x.id, 'requestedDeadline', x.requested_deadline, 'reason', x.reason, 'requestedBy', x.requested_by) FROM premium_warranty_extensions x
        WHERE x.policy_id = p.id AND x.status = 'pending') AS pending_extension,
      (SELECT e.endorsement_number FROM premium_warranty_actions a JOIN endorsements e ON e.id = a.endorsement_id WHERE a.policy_id = p.id AND a.action = 'cancellation-requested'
        AND e.status NOT IN ('Completed', 'completed', 'Cancelled', 'cancelled') ORDER BY a.created_at DESC LIMIT 1) AS cancellation_request,
      (SELECT max(created_at) FROM premium_warranty_actions a WHERE a.policy_id = p.id AND a.action = 'reminder') AS last_reminder
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE p.billing_mode <> 'direct' AND p.status IN ('issued', 'active', 'renewed') AND p.inception_date IS NOT NULL
      AND EXISTS (SELECT 1 FROM receivables r WHERE r.policy_id = p.id AND r.status IN ('open', 'partial') AND r.balance > 0)
      AND ($2::text[] IS NULL OR p.id = ANY($2))`, [defaultDays, policyIds])).rows;
  if (!rows.length) return [];
  const bills = (await db.query(`SELECT r.id, r.policy_id, r.amount, r.balance, r.due_date, r.parent_receivable_id, pl.id AS plan_id FROM receivables r
    LEFT JOIN premium_instalment_plans pl ON pl.receivable_id = r.id AND pl.status = 'active'
    WHERE r.policy_id = ANY($1) AND r.status IN ('open', 'partial') AND r.balance > 0`, [rows.map((r) => r.id)])).rows;
  const planLines = bills.some((b) => b.plan_id) ? (await db.query('SELECT * FROM premium_instalments WHERE plan_id = ANY($1) ORDER BY plan_id, seq', [bills.filter((b) => b.plan_id).map((b) => b.plan_id)])).rows : [];
  const asOf = await today();
  return rows.map((p) => {
    let outstanding = 0;
    let dueNow = 0;
    let onPlan = false;
    for (const b of bills.filter((x) => x.policy_id === p.id)) {
      outstanding = round2(outstanding + Number(b.balance));
      if (b.plan_id) {
        onPlan = true;
        const alloc = allocatePaid(planLines.filter((l) => l.plan_id === b.plan_id), round2(Number(b.amount) - Number(b.balance)), asOf);
        dueNow = round2(dueNow + alloc.filter((a) => a.dueDate <= asOf).reduce((s, a) => s + a.outstanding, 0));
      } else if (b.parent_receivable_id) {
        // a separate instalment invoice is due on its own due date
        onPlan = true;
        if (isoDate(b.due_date) <= asOf) dueNow = round2(dueNow + Number(b.balance));
      } else dueNow = round2(dueNow + Number(b.balance));
    }
    const warrantyDeadline = addDays(p.inception_date, Number(p.warranty_days) || 0);
    const deadline = p.extended_to && p.extended_to > warrantyDeadline ? p.extended_to : warrantyDeadline;
    return { ...p, outstanding, dueNow, onPlan, warrantyDeadline, deadline };
  });
}

const monitorRow = (p, asOf, warningDays) => {
  const daysToDeadline = daysBetween(asOf, p.deadline);
  let status = 'within';
  if (p.dueNow > EPS && daysToDeadline < 0) status = 'breached';
  else if (p.dueNow > EPS && daysToDeadline <= warningDays) status = 'at-risk';
  return {
    policyId: p.id, policyNumber: p.policy_number, clientId: p.client_id, clientName: p.client_name, clientEmail: p.client_email, insurerName: p.insurer_name,
    inceptionDate: p.inception_date, warrantyDays: Number(p.warranty_days), warrantyDeadline: p.warrantyDeadline, extendedTo: p.extended_to, deadline: p.deadline,
    daysPastDeadline: daysToDeadline < 0 ? -daysToDeadline : 0, daysToDeadline: daysToDeadline >= 0 ? daysToDeadline : 0,
    outstanding: p.outstanding, premiumDue: p.dueNow, onInstalmentPlan: p.onPlan, status,
    pendingExtension: p.pending_extension, cancellationRequest: p.cancellation_request, lastReminder: p.last_reminder,
  };
};

/** Policies breached or at risk (status = breached | at-risk | all; search on policy / client). */
export async function warrantyMonitor(db, qs = {}) {
  const asOf = await today();
  const warningDays = Number(await getSetting('credit.warranty_warning_days', 7)) || 0;
  let rows = (await policiesWithPremiumDue(db)).map((p) => monitorRow(p, asOf, warningDays));
  const want = qs.status || 'attention';
  if (want === 'attention') rows = rows.filter((r) => r.status !== 'within');
  else if (want !== 'all') rows = rows.filter((r) => r.status === want);
  if (qs.search) {
    const s = String(qs.search).toLowerCase();
    rows = rows.filter((r) => `${r.policyNumber} ${r.clientName || ''}`.toLowerCase().includes(s));
  }
  rows.sort((a, b) => b.daysPastDeadline - a.daysPastDeadline || a.daysToDeadline - b.daysToDeadline);
  const sum = (st) => round2(rows.filter((r) => r.status === st).reduce((t, r) => t + r.premiumDue, 0));
  return { asOf, warningDays, summary: { breached: rows.filter((r) => r.status === 'breached').length, atRisk: rows.filter((r) => r.status === 'at-risk').length,
    breachedAmount: sum('breached'), atRiskAmount: sum('at-risk'), pendingExtensions: rows.filter((r) => r.pendingExtension).length }, rows };
}

async function monitorPolicy(db, policyRef) {
  const p = (await db.query('SELECT id FROM policies WHERE id = $1 OR policy_number = $1', [String(policyRef)])).rows[0];
  if (!p) throw notFound(`Policy ${policyRef} not found`);
  const [row] = await policiesWithPremiumDue(db, [p.id]);
  if (!row) throw conflict('The policy has no open broker-billed premium');
  return monitorRow(row, await today(), Number(await getSetting('credit.warranty_warning_days', 7)) || 0);
}

const logAction = (db, policyId, action, { notes = null, extensionId = null, endorsementId = null, emailId = null, user = null } = {}) => db.query(
  'INSERT INTO premium_warranty_actions(policy_id, action, notes, extension_id, endorsement_id, email_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
  [policyId, action, notes, extensionId, endorsementId, emailId, user?.id ?? null]);

/** Reminder to the client: the collection e-mail of the policy's oldest open bill (collections.email_template). */
export async function remind(db, policyRef, b, user) {
  const m = await monitorPolicy(db, policyRef);
  const item = (await db.query(`SELECT ci.id FROM collection_items ci JOIN receivables r ON r.id = ci.receivable_id WHERE r.policy_id = $1 AND r.balance > 0 AND r.status IN ('open', 'partial')
    ORDER BY r.due_date, r.created_at LIMIT 1`, [m.policyId])).rows[0];
  if (!item) throw conflict(`${m.policyNumber} has no open collection item`);
  const { sendEmail } = await import('../collections/service.js');
  const sent = await sendEmail(db, item.id, { notes: b?.notes || null, to: b?.to || undefined, actionBy: user?.username }, user);
  await logAction(db, m.policyId, 'reminder', { notes: b?.notes || sent.subject, emailId: sent.emailId, user });
  return { ...sent, policyNumber: m.policyNumber };
}

/** Request an extension of the warranty deadline to a date (reason required); another user approves it. */
export async function requestExtension(db, policyRef, b, user) {
  const m = await monitorPolicy(db, policyRef);
  if (m.pendingExtension) throw conflict(`${m.policyNumber} already has an extension awaiting approval`);
  const until = String(b.requestedDeadline || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until <= m.deadline) throw badRequest('Validation failed', [{ path: 'requestedDeadline', message: `The new deadline must be after ${m.deadline}` }]);
  const maxDays = Number(await getSetting('credit.max_warranty_extension_days', 90)) || 0;
  if (maxDays && until > addDays(m.inceptionDate, maxDays)) throw badRequest('Validation failed', [{ path: 'requestedDeadline', message: `At most ${maxDays} days after inception (${addDays(m.inceptionDate, maxDays)}), credit.max_warranty_extension_days` }]);
  if (String(b.reason || '').trim().length < 3) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required' }]);
  const x = (await db.query(`INSERT INTO premium_warranty_extensions(policy_id, current_deadline, requested_deadline, reason, requested_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [m.policyId, m.deadline, until, String(b.reason).trim(), user?.id ?? null])).rows[0];
  await logAction(db, m.policyId, 'extension-requested', { notes: `Until ${until}: ${String(b.reason).trim()}`, extensionId: x.id, user });
  return { id: Number(x.id), policyNumber: m.policyNumber, clientName: m.clientName || null, currentDeadline: m.deadline, requestedDeadline: until, status: 'pending' };
}

/** Approve or reject a pending extension (approve:credit-control; not the requester). */
export async function decideExtension(db, id, action, remarks, user) {
  const x = (await db.query('SELECT x.*, p.policy_number FROM premium_warranty_extensions x JOIN policies p ON p.id = x.policy_id WHERE x.id = $1 FOR UPDATE OF x', [Number(id) || 0])).rows[0];
  if (!x) throw notFound('Extension request not found');
  if (x.status !== 'pending') throw conflict(`The extension request is already ${x.status}`);
  await assertChecker(user, x.requested_by, 'warranty extension');
  if (action === 'reject' && !String(remarks || '').trim()) throw badRequest('Validation failed', [{ path: 'remarks', message: 'A reason is required to reject' }]);
  const status = action === 'approve' ? 'approved' : 'rejected';
  await db.query('UPDATE premium_warranty_extensions SET status = $2, decided_by = $3, decided_at = now(), decision_remarks = $4 WHERE id = $1', [x.id, status, user?.id ?? null, remarks || null]);
  await logAction(db, x.policy_id, action === 'approve' ? 'extension-approved' : 'extension-rejected', { notes: remarks || null, extensionId: x.id, user });
  return { id: Number(x.id), policyNumber: x.policy_number, requestedDeadline: x.requested_deadline, status, requestedBy: x.requested_by };
}

/** Pending extension requests (approval queue). */
export async function pendingExtensions(db) {
  return (await db.query(`SELECT x.*, p.policy_number, c.display_name AS client_name, (SELECT display_name FROM users u WHERE u.id = x.requested_by) AS requested_by_name
    FROM premium_warranty_extensions x JOIN policies p ON p.id = x.policy_id LEFT JOIN clients c ON c.id = p.client_id WHERE x.status = 'pending' ORDER BY x.requested_at`)).rows
    .map((x) => ({ id: Number(x.id), policyId: x.policy_id, policyNumber: x.policy_number, clientName: x.client_name, currentDeadline: x.current_deadline, requestedDeadline: x.requested_deadline,
      reason: x.reason, requestedBy: x.requested_by_name || x.requested_by, requestedById: x.requested_by, requestedAt: x.requested_at }));
}

/**
 * Request the cancellation of a breached policy for non-payment: a draft cancellation endorsement for Operations to
 * process (with the client, the insurer and the return premium). The policy is not cancelled here.
 */
export async function requestCancellation(db, policyRef, b, user) {
  const m = await monitorPolicy(db, policyRef);
  if (m.status !== 'breached') throw conflict(`${m.policyNumber} is not past its premium warranty (deadline ${m.deadline})`);
  if (m.cancellationRequest) throw conflict(`${m.policyNumber} already has an open cancellation request (${m.cancellationRequest})`);
  const { createEndorsement } = await import('../endorsements/service.js');
  const remarks = `Cancellation requested by Accounting for non-payment of premium: ${m.premiumDue.toFixed(2)} unpaid, premium warranty ended ${m.deadline}.${b?.notes ? ` ${b.notes}` : ''}`;
  const e = await createEndorsement({ policyId: m.policyId, isCancelPolicy: true, cancellationType: 'FULL', effectiveDate: await today(), remarks }, user?.id ?? null);
  await logAction(db, m.policyId, 'cancellation-requested', { notes: remarks, endorsementId: e.id, user });
  await notify({ audience: 'write:endorsements', type: 'action', title: 'Cancellation for non-payment requested', message: `${m.policyNumber} (${m.clientName || ''}): ${e.endorsementNumber || e.endorsement_number || ''}`,
    link: '/endorsement', entity: 'endorsement', entityId: e.id });
  return { policyNumber: m.policyNumber, endorsementId: e.id, endorsementNumber: e.endorsementNumber || e.endorsement_number || null, remarks };
}

/** Role names of a user, for the activity log (u is the users row joined in the query). */
const ROLE_NAMES = '(SELECT array_agg(r.name ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id)';

/** Actions taken on a policy from the monitor (most recent first), each with the display name and roles of its user. */
export async function policyActions(db, policyRef) {
  const own = (await db.query(`SELECT a.*, e.endorsement_number, u.display_name AS created_by_name, ${ROLE_NAMES} AS created_by_roles FROM premium_warranty_actions a
    JOIN policies p ON p.id = a.policy_id LEFT JOIN endorsements e ON e.id = a.endorsement_id LEFT JOIN users u ON u.id = a.created_by
    WHERE p.id = $1 OR p.policy_number = $1 ORDER BY a.created_at DESC, a.id DESC`, [String(policyRef)])).rows
    .map((a) => ({ id: Number(a.id), action: a.action, notes: a.notes, endorsementNumber: a.endorsement_number, createdBy: a.created_by_name || a.created_by,
      createdByRoles: a.created_by_roles || [], createdAt: a.created_at }));
  // the reminders, calls and commitments logged on the policy's collection belong to the same chase for the premium
  const followUps = (await db.query(`SELECT ca.id, ca.action_type, ca.action_date, ca.notes, ca.commitment_date, ca.call_outcome,
      COALESCE(u.display_name, ca.action_by) AS by_name, ${ROLE_NAMES} AS by_roles
    FROM collection_actions ca JOIN collection_items ci ON ci.id = ca.collection_id JOIN policies p ON p.id = ci.policy_id
    LEFT JOIN users u ON u.username = ca.action_by OR u.id = ca.action_by
    WHERE p.id = $1 OR p.policy_number = $1`, [String(policyRef)])).rows
    .map((a) => ({ id: `col-${a.id}`, action: `collection-${String(a.action_type || 'note').toLowerCase()}`, notes: a.notes, commitmentDate: a.commitment_date,
      callOutcome: a.call_outcome, createdBy: a.by_name, createdByRoles: a.by_roles || [], createdAt: a.action_date, source: 'collection' }));
  return [...own, ...followUps].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
