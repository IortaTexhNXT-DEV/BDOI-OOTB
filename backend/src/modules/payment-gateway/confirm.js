/**
 * Gateway notifications and what a confirmed payment does.
 *
 * handleNotification(): verifies the signature with the gateway's provider, logs the event (payments log), finds the
 * payment link by its number or the provider reference, then:
 *   paid    the link becomes paid (the amount must match the total charged, else it goes to review) and the payment is
 *           applied (applyPayment);
 *   failed  a pending link is marked failed (the client can try again: a later paid notification still counts);
 *   pending nothing changes.
 * Notifications are idempotent: a link already paid is not applied twice.
 *
 * applyPayment(): the policy to receipt against is the target policy, the policy already issued from the quotation,
 * or, when payments.auto_issue_package_policies, the gateway and the bundle allow it, a policy issued now from the paid
 * package quotation (or package-product quotation). The official receipt (receipts module) is then created for the
 * premium amount (payments.auto_receipt) and the link records the receipt and policy. A payment that cannot be applied
 * (no policy yet, closed period ...) stays paid with apply_status awaiting_issue / error for Accounting to finish
 * (POST /payment-links/:id/apply), and the notify roles are told.
 */
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, HttpError } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { logger } from '../../lib/logger.js';
import { notify } from '../notifications/service.js';
import { usersWithRoles } from '../documents/common.js';
import { createReceipt } from '../receipts/service.js';
import { issuePackageQuote } from '../packages/issue.js';
import { convertToPolicy } from '../quotations/service.js';
import { gatewayRow, linkRow, logEvent } from './service.js';
import { providerOf, sandboxNotification } from './providers.js';

const actorOf = (link) => (link.created_by ? { id: link.created_by, username: 'payment-gateway', roles: [], permissions: [] } : null);

async function tellStaff(link, title, message) {
  const roles = (await getSetting('payments.notify_roles_on_error', ['accounting'])) || [];
  const users = new Set([link.created_by, ...(await usersWithRoles(roles)).map((u) => u.id)].filter(Boolean));
  for (const userId of users) await notify({ userId, type: 'task', title, message, link: '/sales/payment-links', entity: 'payment_link', entityId: link.id });
}

async function auditSystem(link, action, after) {
  await query(`INSERT INTO audit_log(user_id, username, entity, entity_id, action, after_data) VALUES ($1, 'payment-gateway', 'payment_link', $2, $3, $4)`,
    [link.created_by || null, link.id, action, JSON.stringify(after)]);
}

/** Receipt payment mode of a gateway payment method (payments.payment_modes). */
async function paymentModeOf(method) {
  const map = (await getSetting('payments.payment_modes', {})) || {};
  return map[method] || map.default || 'online';
}

/** Is the product of a quotation a package product (Product master business type)? */
async function isPackageProduct(db, productId) {
  if (!productId) return false;
  return (await db.query("SELECT 1 FROM products WHERE id = $1 AND business_type = 'package'", [productId])).rowCount > 0;
}

/**
 * The policy a paid link pays for, issuing it when allowed. Returns { policyId, issued } or { policyId: null, reason }.
 */
async function policyFor(link, gateway, user) {
  if (link.target_type === 'policy') return { policyId: link.target_id, issued: false };
  const autoIssue = (await getSetting('payments.auto_issue_package_policies', true)) !== false && gateway.auto_issue;
  if (link.target_type === 'package_quote') {
    const pq = (await query('SELECT pq.id, pq.status, pq.policy_id, b.auto_issue FROM package_quotes pq JOIN package_bundles b ON b.id = pq.bundle_id WHERE pq.id = $1', [link.target_id])).rows[0];
    if (pq?.policy_id) return { policyId: pq.policy_id, issued: false };
    if (!autoIssue || !pq?.auto_issue) return { policyId: null, reason: 'Paid: the package policy is to be issued by the Processing Team (automatic issuance is off)' };
    const r = await issuePackageQuote(pq.id, { allowExpired: true }, user);
    return { policyId: r.policyId, issued: true, policyNumber: r.policyNumber };
  }
  const q = (await query('SELECT id, status, policy_id, product_id FROM quotes WHERE id = $1', [link.target_id])).rows[0];
  if (q?.policy_id) return { policyId: q.policy_id, issued: false };
  if (!autoIssue || !(await isPackageProduct({ query }, q?.product_id))) return { policyId: null, reason: 'Paid: the policy is to be issued from the quotation by the Processing Team' };
  const r = await convertToPolicy(q.id, {}, user);
  return { policyId: r.policyId, issued: true };
}

/**
 * Apply a paid link: policy (issued when allowed) and official receipt. Safe to call again: an applied link is left
 * as it is. Returns the link row.
 */
export async function applyPayment(linkId, { user = null, force = false } = {}) {
  const link = await linkRow(linkId);
  if (link.status !== 'paid') throw conflict(`Payment link ${link.link_number} is ${link.status}: only a paid link is applied`);
  if (link.apply_status === 'applied' && !force) return link;
  const gateway = await gatewayRow(link.gateway_code);
  const actor = user || actorOf(link);
  try {
    const target = await policyFor(link, gateway, actor);
    if (!target.policyId) {
      await query("UPDATE payment_links SET apply_status = 'awaiting_issue', apply_error = $2, outcome = outcome || $3::jsonb WHERE id = $1",
        [link.id, target.reason, JSON.stringify({ awaitingIssue: true })]);
      await tellStaff(link, 'Online payment received', `${link.link_number}: ${link.payer_name || 'client'} paid ${link.currency} ${Number(link.amount).toFixed(2)} for ${link.target_number}. ${target.reason}; then apply the payment on Payment Links.`);
      return linkRow(link.id);
    }
    let receipt = null;
    if ((await getSetting('payments.auto_receipt', true)) !== false) {
      receipt = await withTransaction(async (db) => createReceipt(db, {
        policyId: target.policyId, amount: Number(link.amount), paymentMode: await paymentModeOf(link.method), referenceNo: link.provider_ref || link.link_number,
        remarks: `Online payment ${link.link_number} (${gateway.name})`, bankAccountCode: gateway.bank_account_code || undefined, receiptNumber: link.provider_ref || undefined,
      }, actor, { source: 'payment-gateway' }));
    }
    await query(`UPDATE payment_links SET apply_status = 'applied', apply_error = NULL, policy_id = $2, receipt_id = $3, outcome = outcome || $4::jsonb WHERE id = $1`,
      [link.id, target.policyId, receipt?.receiptId || null, JSON.stringify({ policyIssued: target.issued, receiptNumber: receipt?.receiptNumber || null, appliedAt: new Date().toISOString() })]);
    await auditSystem(link, 'apply', { policyId: target.policyId, policyIssued: target.issued, receiptNumber: receipt?.receiptNumber || null });
  } catch (e) {
    logger.warn({ err: e, link: link.link_number }, 'payment could not be applied');
    await query("UPDATE payment_links SET apply_status = 'error', apply_error = $2 WHERE id = $1", [link.id, String(e.message).slice(0, 1000)]);
    await tellStaff(link, 'Online payment not applied', `${link.link_number}: the payment of ${link.currency} ${Number(link.amount).toFixed(2)} for ${link.target_number} was confirmed but could not be applied: ${e.message}`);
  }
  return linkRow(link.id);
}

/** Find the link of a notification: by link number (reference) or provider reference. */
async function findLink(gatewayCode, event) {
  const r = (await query(`SELECT id FROM payment_links WHERE gateway_code = $1 AND (($2::text IS NOT NULL AND link_number = $2) OR ($3::text IS NOT NULL AND provider_ref = $3))
    ORDER BY created_at DESC LIMIT 1`, [gatewayCode, event.reference || null, event.providerRef || null])).rows[0];
  return r ? linkRow(r.id) : null;
}

/**
 * Handle a gateway notification: { rawBody, headers, body, query }. Returns { status, link } or throws 401 for an
 * invalid signature (logged first).
 */
export async function handleNotification(gatewayCode, input) {
  const gateway = await gatewayRow(gatewayCode);
  let v;
  try { v = providerOf(gateway).verify(input, gateway); } catch (e) { v = { valid: false, reason: `Unreadable notification: ${e.message}` }; }
  if (!v.valid) {
    await logEvent(null, { gatewayCode: gateway.code, eventType: 'rejected', valid: false, status: 'rejected', error: v.reason });
    throw new HttpError(401, v.reason || 'Invalid signature');
  }
  const e = v.event;
  const link = await findLink(gateway.code, e);
  const summary = { type: e.type, reference: e.reference, providerRef: e.providerRef, status: e.status, amount: e.amount, refno: e.refno };
  if (!link) {
    await logEvent(null, { gatewayCode: gateway.code, eventType: e.type, providerRef: e.providerRef, valid: true, status: 'ignored', amount: e.amount, payload: summary, error: 'No payment link with this reference' });
    return { status: 'ignored', link: null };
  }
  await logEvent(null, { linkId: link.id, gatewayCode: gateway.code, eventType: e.type, providerRef: e.providerRef, valid: true, status: e.status, amount: e.amount, payload: summary });
  if (e.status === 'failed') {
    await query("UPDATE payment_links SET status = 'failed' WHERE id = $1 AND status = 'pending'", [link.id]);
    return { status: 'failed', link: await linkRow(link.id) };
  }
  if (e.status !== 'paid') return { status: e.status, link };
  if (['paid', 'review'].includes(link.status)) return { status: link.status, link };
  if (e.amount !== null && e.amount !== undefined && Math.abs(round2(e.amount) - Number(link.total)) > 0.005) {
    await query("UPDATE payment_links SET status = 'review', paid_at = now(), paid_amount = $2, apply_error = $3 WHERE id = $1",
      [link.id, round2(e.amount), `Paid ${round2(e.amount).toFixed(2)} but the link asked for ${Number(link.total).toFixed(2)}: check with the gateway before applying`]);
    await tellStaff(link, 'Online payment to review', `${link.link_number}: the gateway confirmed ${round2(e.amount).toFixed(2)} instead of ${Number(link.total).toFixed(2)}.`);
    return { status: 'review', link: await linkRow(link.id) };
  }
  // the update is conditional, so two notifications of the same payment apply it once
  const upd = await query(`UPDATE payment_links SET status = 'paid', paid_at = now(), paid_amount = $2, provider_ref = COALESCE(provider_ref, $3)
    WHERE id = $1 AND status IN ('pending', 'failed', 'expired') RETURNING id`, [link.id, e.amount ?? link.total, e.providerRef || null]);
  if (!upd.rowCount) return { status: link.status, link };
  await auditSystem(link, 'paid', { amount: e.amount ?? Number(link.total), providerRef: e.providerRef || link.provider_ref });
  return { status: 'paid', link: await applyPayment(link.id) };
}

/** The sandbox gateway's "pay" / "fail" buttons: a signed notification processed like a real one. */
export async function simulateSandbox(token, outcome) {
  const link = (await query('SELECT pl.*, g.provider FROM payment_links pl JOIN payment_gateways g ON g.code = pl.gateway_code WHERE pl.token = $1', [String(token || '')])).rows[0];
  if (!link) throw badRequest('Payment link not found');
  if (link.provider !== 'sandbox') throw badRequest('Only a sandbox payment link can be simulated');
  if (link.status !== 'pending' && link.status !== 'failed') throw conflict(`This payment link is ${link.status}`);
  const gateway = await gatewayRow(link.gateway_code);
  const n = sandboxNotification(gateway, { reference: link.link_number, providerRef: link.provider_ref, status: outcome === 'paid' ? 'paid' : 'failed', amount: Number(link.total) });
  return handleNotification(gateway.code, n);
}
