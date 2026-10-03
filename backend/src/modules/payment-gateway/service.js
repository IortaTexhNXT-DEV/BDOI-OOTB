/**
 * Payment gateways master, payment links and the payments log.
 *
 * A payment link collects the premium of a package quotation, a quotation or a policy's open bills through a gateway.
 * The amount is the premium due; a gateway that passes its fee on to the client adds the fee to the total charged.
 * The checkout is opened with the provider when the link is created (providers.js). The client pays on the gateway's
 * page (or, with the SANDBOX provider, on the platform's /pay page that simulates the gateway) and the gateway notifies
 * the webhook; confirm.js applies the payment.
 */
import crypto from 'node:crypto';
import { baseCurrency } from '../../lib/currency.js';
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { config } from '../../config.js';
import { SCOPE } from '../../lib/scope.js';
import { METHODS, providerOf } from './providers.js';
import { publicWebUrl } from '../../lib/publicWeb.js';

const run = (db) => db || { query };

// ------------------------------------------------------------------ gateways

export function toGateway(g) {
  const creds = providerOf(g).credentials(g);
  return {
    code: g.code, name: g.name, provider: g.provider, enabled: g.enabled, mode: g.mode, methods: g.methods || [], feeHandling: g.fee_handling, feePercent: Number(g.fee_percent),
    feeFixed: Number(g.fee_fixed), credentialsPrefix: g.credentials_prefix, credentialsConfigured: creds.configured, credentials: creds.required, linkValidityHours: g.link_validity_hours,
    autoIssue: g.auto_issue, bankAccountCode: g.bank_account_code, sortOrder: g.sort_order, remarks: g.remarks, updatedBy: g.updated_by, updatedAt: g.updated_at,
  };
}

export async function gatewayRow(code, db = null) {
  const g = (await run(db).query('SELECT * FROM payment_gateways WHERE code = upper($1)', [String(code)])).rows[0];
  if (!g) throw notFound(`Payment gateway ${code} not found`);
  return g;
}

export async function listGateways({ enabled } = {}) {
  const where = enabled === 'true' || enabled === true ? 'WHERE enabled' : '';
  return (await query(`SELECT * FROM payment_gateways ${where} ORDER BY sort_order, code`)).rows.map(toGateway);
}

/**
 * Update a gateway's settings. Going live needs the credentials in the environment and is refused for the sandbox
 * provider; enabling a live gateway checks the credentials again.
 */
export async function updateGateway(code, b, user) {
  const g = await gatewayRow(code);
  const before = toGateway(g);
  const next = {
    name: b.name ?? g.name, enabled: b.enabled ?? g.enabled, mode: b.mode ?? g.mode, methods: b.methods ?? g.methods, fee_handling: b.feeHandling ?? g.fee_handling,
    fee_percent: b.feePercent ?? g.fee_percent, fee_fixed: b.feeFixed ?? g.fee_fixed, credentials_prefix: b.credentialsPrefix ?? g.credentials_prefix,
    link_validity_hours: b.linkValidityHours !== undefined ? b.linkValidityHours : g.link_validity_hours, auto_issue: b.autoIssue ?? g.auto_issue,
    bank_account_code: b.bankAccountCode !== undefined ? b.bankAccountCode : g.bank_account_code, sort_order: b.sortOrder ?? g.sort_order, remarks: b.remarks !== undefined ? b.remarks : g.remarks,
  };
  if (g.provider === 'sandbox' && next.mode === 'live') throw badRequest('The sandbox provider only simulates payments: it cannot be set to live');
  const unknown = (next.methods || []).filter((m) => !METHODS.includes(m));
  if (unknown.length) throw badRequest('Validation failed', [{ path: 'methods', message: `Unknown payment method(s): ${unknown.join(', ')}` }]);
  const creds = providerOf(g).credentials({ ...g, ...next });
  if (next.enabled && next.mode === 'live' && !creds.configured) {
    throw badRequest(`${g.name} cannot be enabled live: set ${creds.required.filter((r) => !r.present).map((r) => r.name).join(', ')} in the environment (secret store) first`);
  }
  const keys = Object.keys(next);
  await query(`UPDATE payment_gateways SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2} WHERE code = $1`, [g.code, ...Object.values(next), user?.id ?? null]);
  return { before, after: toGateway(await gatewayRow(g.code)) };
}

/** Fee of a gateway on an amount (percent + fixed, 2 decimals). */
export const gatewayFee = (g, amount) => round2((Number(amount) * Number(g.fee_percent)) / 100 + Number(g.fee_fixed));

// ------------------------------------------------------------------ targets

/**
 * What a link collects: { targetId, targetNumber, clientId, payerName, payerEmail, payerMobile, amount, description }.
 * package_quote: the package total; quote: the quotation's gross premium; policy: the open balance of its bills (the
 * gross premium when it was never billed).
 */
export async function targetOf(db, type, ref) {
  const c = run(db);
  if (type === 'package_quote') {
    const r = (await c.query(`SELECT pq.*, b.name AS bundle_name, cl.display_name AS client_name, cl.email AS client_email, cl.phone AS client_phone,
        l.display_name AS lead_name, l.email AS lead_email, l.phone AS lead_phone
      FROM package_quotes pq JOIN package_bundles b ON b.id = pq.bundle_id LEFT JOIN clients cl ON cl.id = pq.client_id LEFT JOIN leads l ON l.id = pq.lead_id
      WHERE pq.id = $1 OR pq.quote_number = $1`, [String(ref)])).rows[0];
    if (!r) throw notFound('Package quotation not found');
    if (['cancelled', 'expired'].includes(r.status)) throw badRequest(`Package quotation ${r.quote_number} is ${r.status}`);
    if (r.status === 'issued') return targetOf(db, 'policy', r.policy_id);
    return { type, targetId: r.id, targetNumber: r.quote_number, clientId: r.client_id, payerName: r.insured_name || r.client_name || r.lead_name, payerEmail: r.client_email || r.lead_email,
      payerMobile: r.client_phone || r.lead_phone, amount: round2(r.total_amount), description: `${r.bundle_name} package ${r.quote_number}`, ownerId: r.owner_user_id || r.created_by };
  }
  if (type === 'quote') {
    const r = (await c.query(`SELECT q.*, cl.display_name AS client_name, cl.email AS client_email, cl.phone AS client_phone, l.display_name AS lead_name, l.email AS lead_email, l.phone AS lead_phone
      FROM quotes q LEFT JOIN clients cl ON cl.id = q.client_id LEFT JOIN leads l ON l.id = q.lead_id WHERE (q.id = $1 OR q.quote_number = $1) AND q.deleted_at IS NULL`, [String(ref)])).rows[0];
    if (!r) throw notFound('Quotation not found');
    if (r.status === 'converted' && r.policy_id) return targetOf(db, 'policy', r.policy_id);
    if (['rejected', 'expired', 'dropped'].includes(r.status)) throw badRequest(`Quotation ${r.quote_number} can no longer be paid (status ${r.status})`);
    return { type, targetId: r.id, targetNumber: r.quote_number, clientId: r.client_id, payerName: r.client_name || r.lead_name, payerEmail: r.client_email || r.lead_email,
      payerMobile: r.client_phone || r.lead_phone, amount: round2(r.premium_total), description: `${r.product_type || r.lob} quotation ${r.quote_number}`, ownerId: r.agent_user_id || r.created_by };
  }
  if (type === 'policy') {
    const r = (await c.query(`SELECT p.*, cl.display_name AS client_name, cl.email AS client_email, cl.phone AS client_phone,
        (SELECT COALESCE(sum(balance), 0) FROM receivables rv WHERE rv.policy_id = p.id AND rv.status IN ('open', 'partial')) AS open_balance,
        EXISTS (SELECT 1 FROM receivables rv WHERE rv.policy_id = p.id) AS billed
      FROM policies p LEFT JOIN clients cl ON cl.id = p.client_id WHERE p.id = $1 OR p.policy_number = $1`, [String(ref)])).rows[0];
    if (!r) throw notFound('Policy not found');
    if (r.billing_mode === 'direct') throw badRequest(`Policy ${r.policy_number} is direct billed: the client pays the insurer`);
    const amount = round2(r.billed ? r.open_balance : r.premium_total);
    if (!(amount > 0)) throw badRequest(`Policy ${r.policy_number} has no premium left to pay`);
    return { type: 'policy', targetId: r.id, targetNumber: r.policy_number, clientId: r.client_id, payerName: r.insured_name || r.client_name, payerEmail: r.client_email,
      payerMobile: r.client_phone, amount, description: `Premium of policy ${r.policy_number}`, ownerId: r.owner_user_id || r.created_by, policyId: r.id };
  }
  throw badRequest(`Unknown payment target ${type}`);
}

// ------------------------------------------------------------------ links

const LINK_SELECT = `SELECT pl.*, g.name AS gateway_name, g.provider, g.mode, r.receipt_number, p.policy_number,
    (SELECT u.display_name FROM users u WHERE u.id = pl.created_by) AS created_by_name
  FROM payment_links pl JOIN payment_gateways g ON g.code = pl.gateway_code LEFT JOIN receipts r ON r.id = pl.receipt_id LEFT JOIN policies p ON p.id = pl.policy_id`;

export const publicUrlOf = async (token) => `${await publicWebUrl()}/pay/${encodeURIComponent(token)}`;

export async function linkOut(r) {
  return {
    id: r.id, linkNumber: r.link_number, targetType: r.target_type, targetId: r.target_id, targetNumber: r.target_number, clientId: r.client_id, payerName: r.payer_name,
    payerEmail: r.payer_email, payerMobile: r.payer_mobile, description: r.description, amount: Number(r.amount), fee: Number(r.fee), total: Number(r.total), currency: r.currency,
    gatewayCode: r.gateway_code, gatewayName: r.gateway_name, provider: r.provider, mode: r.mode, method: r.method, status: r.status, providerRef: r.provider_ref,
    checkoutUrl: r.checkout_url, payUrl: await publicUrlOf(r.token), expiresAt: r.expires_at, paidAt: r.paid_at, paidAmount: r.paid_amount === null ? null : Number(r.paid_amount),
    applyStatus: r.apply_status, applyError: r.apply_error, receiptId: r.receipt_id, receiptNumber: r.receipt_number || null, policyId: r.policy_id, policyNumber: r.policy_number || null,
    outcome: r.outcome || {}, createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function linkRow(ref, db = null) {
  const r = (await run(db).query(`${LINK_SELECT} WHERE pl.id = $1 OR pl.link_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Payment link not found');
  return r;
}
export const linkByToken = async (token, db = null) => {
  const r = (await run(db).query(`${LINK_SELECT} WHERE pl.token = $1`, [String(token || '')])).rows[0];
  if (!r) throw notFound('Payment link not found');
  return r;
};

/** Pending links past their expiry become expired (called before reads). */
export async function expireLinks(db = null) {
  await run(db).query("UPDATE payment_links SET status = 'expired' WHERE status = 'pending' AND expires_at < now()");
}

export async function listLinks(q, pg) {
  await expireLinks();
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('pl.status = ANY(?)', String(q.status).split(',').map((s) => s.trim()));
  if (q.applyStatus) add('pl.apply_status = ?', q.applyStatus);
  if (q.gatewayCode) add('pl.gateway_code = upper(?)', q.gatewayCode);
  if (q.targetType) add('pl.target_type = ?', q.targetType);
  if (q.targetId) add('(pl.target_id = ? OR pl.target_number = ?)', String(q.targetId));
  if (q.search) add("(pl.link_number ILIKE '%' || ? || '%' OR pl.target_number ILIKE '%' || ? || '%' OR pl.payer_name ILIKE '%' || ? || '%' OR pl.provider_ref ILIKE '%' || ? || '%')", q.search);
  if (q[SCOPE]) add('pl.created_by = ANY(?)', q[SCOPE].ids);
  const w = where.join(' AND ');
  const total = (await query(`SELECT count(*)::int AS n FROM payment_links pl WHERE ${w}`, params)).rows[0].n;
  const rows = (await query(`${LINK_SELECT} WHERE ${w} ORDER BY pl.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset])).rows;
  return { total, rows: await Promise.all(rows.map(linkOut)) };
}

/**
 * Create a payment link: { targetType, targetId, gatewayCode, method, payerEmail }. The link is refused when the
 * gateway is off, the method is not offered, or a pending link already exists for the same target (it is returned
 * instead). The provider's checkout is opened at once; `opts.fetchImpl` replaces fetch (tests).
 */
export async function createLink(b, user, opts = {}) {
  await expireLinks();
  const g = await gatewayRow(b.gatewayCode);
  if (!g.enabled) throw badRequest(`${g.name} is not enabled (Master > Packaged Products > Payment Gateways)`);
  if (b.method && !(g.methods || []).includes(b.method)) throw badRequest('Validation failed', [{ path: 'method', message: `${g.name} does not offer ${b.method}` }]);
  const creds = providerOf(g).credentials(g);
  if (!creds.configured) throw badRequest(`${g.name}: set ${creds.required.filter((r) => !r.present).map((r) => r.name).join(', ')} in the environment first`);
  const target = await targetOf(null, b.targetType, b.targetId);
  const open = (await query("SELECT id FROM payment_links WHERE target_type = $1 AND target_id = $2 AND status = 'pending' LIMIT 1", [target.type, target.targetId])).rows[0];
  if (open) throw conflict(`A pending payment link already exists for ${target.targetNumber}: cancel it first to send a new one`, { linkId: open.id });
  const fee = gatewayFee(g, target.amount);
  const total = g.fee_handling === 'pass_on' ? round2(target.amount + fee) : target.amount;
  const hours = Number(g.link_validity_hours || (await getSetting('payments.link_validity_hours', 72))) || 72;
  const token = crypto.randomBytes(24).toString('base64url');
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('payment_link', { db, unique: { table: 'payment_links', column: 'link_number' } });
    const r = await db.query(`INSERT INTO payment_links(link_number, token, target_type, target_id, target_number, client_id, payer_name, payer_email, payer_mobile, description,
        amount, fee, total, currency, gateway_code, method, expires_at, policy_id, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now() + make_interval(hours => $17), $18, $19, $19) RETURNING id`,
    [number, token, target.type, target.targetId, target.targetNumber, target.clientId || null, b.payerName || target.payerName || null, b.payerEmail || target.payerEmail || null,
      target.payerMobile || null, target.description, target.amount, fee, total, await baseCurrency(), g.code, b.method || null, hours, target.policyId || null, user?.id ?? null]);
    return r.rows[0].id;
  });
  const row = await linkRow(id);
  try {
    const out = await providerOf(g).checkout(row, g, { returnUrl: await publicUrlOf(token), notifyUrl: `${config.publicBaseUrl}/api/public/payments/webhooks/${g.code}`, fetchImpl: opts.fetchImpl });
    await query('UPDATE payment_links SET provider_ref = $2, checkout_url = $3 WHERE id = $1', [id, out.providerRef, out.checkoutUrl]);
  } catch (e) {
    await query("UPDATE payment_links SET status = 'cancelled', apply_error = $2 WHERE id = $1", [id, String(e.message).slice(0, 500)]);
    throw e;
  }
  return linkOut(await linkRow(id));
}

export async function cancelLink(ref, user) {
  const r = await linkRow(ref);
  if (r.status !== 'pending' && r.status !== 'failed') throw conflict(`A ${r.status} payment link cannot be cancelled`);
  const before = await linkOut(r);
  await query("UPDATE payment_links SET status = 'cancelled', updated_by = $2 WHERE id = $1", [r.id, user?.id ?? null]);
  return { before, after: await linkOut(await linkRow(r.id)) };
}

// ------------------------------------------------------------------ payments log

export const eventOut = (e) => ({
  id: Number(e.id), linkId: e.link_id, linkNumber: e.link_number || null, gatewayCode: e.gateway_code, eventType: e.event_type, providerRef: e.provider_ref,
  signatureValid: e.signature_valid, status: e.status, amount: e.amount === null ? null : Number(e.amount), error: e.error, receivedAt: e.received_at,
});

export async function listEvents(q, pg) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.gatewayCode) add('e.gateway_code = upper(?)', q.gatewayCode);
  if (q.linkId) add('(e.link_id = ? OR pl.link_number = ?)', String(q.linkId));
  if (q.status) add('e.status = ?', q.status);
  if (q.valid === 'false') where.push('NOT e.signature_valid');
  const w = where.join(' AND ');
  const from = `FROM payment_events e LEFT JOIN payment_links pl ON pl.id = e.link_id WHERE ${w}`;
  const total = (await query(`SELECT count(*)::int AS n ${from}`, params)).rows[0].n;
  const rows = (await query(`SELECT e.*, pl.link_number ${from} ORDER BY e.received_at DESC, e.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset])).rows;
  return { total, rows: rows.map(eventOut) };
}

export async function logEvent(db, { linkId = null, gatewayCode, eventType, providerRef = null, valid, status, amount = null, payload = {}, error = null }) {
  const r = await run(db).query(`INSERT INTO payment_events(link_id, gateway_code, event_type, provider_ref, signature_valid, status, amount, payload, error)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [linkId, gatewayCode, String(eventType || 'unknown').slice(0, 100), providerRef, Boolean(valid), status, amount, JSON.stringify(payload || {}), error]);
  return r.rows[0].id;
}
