/**
 * Payment gateway providers. Each provider knows how to open a checkout for a payment link and how to verify and read a
 * notification (webhook / postback) from the gateway:
 *
 *   checkout(link, gateway, { returnUrl, notifyUrl, fetchImpl }) -> { providerRef, checkoutUrl }
 *   verify({ rawBody, headers, body, query }, gateway)           -> { valid, reason, event: { reference, providerRef, status, amount, type } }
 *   credentials(gateway)                                          -> { configured, required: [{ name, present }] }
 *
 * status is paid | failed | pending. Credentials come only from the environment (secret store), named
 * <credentials_prefix>_<NAME>; they are never stored in the database or returned by the API.
 *
 * sandbox    simulated payments: the checkout is the platform's own /pay page; notifications are signed with
 *            HMAC-SHA256 (header x-sandbox-signature) with <prefix>_WEBHOOK_SECRET, else a key derived from
 *            DATA_ENCRYPTION_KEY. No network call.
 * paymongo   Checkout Sessions API (POST /v1/checkout_sessions, basic auth with <prefix>_SECRET_KEY); webhook header
 *            Paymongo-Signature "t=<ts>,te=<test sig>,li=<live sig>", HMAC-SHA256 of "<ts>.<raw body>" with
 *            <prefix>_WEBHOOK_SECRET; event checkout_session.payment.paid (paid) or payment.failed (failed).
 * dragonpay  Payment Switch (Pay.aspx with SHA1 digest of merchantid:txnid:amount:ccy:description:email:password);
 *            postback txnid, refno, status (S paid, F / V failed, P / U pending), message, digest =
 *            SHA1(txnid:refno:status:message:password) with <prefix>_MERCHANT_ID and <prefix>_PASSWORD.
 */
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { badRequest, HttpError } from '../../lib/errors.js';

const env = (gateway, name) => process.env[`${gateway.credentials_prefix}_${name}`] || '';
const hmacHex = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex');
const sha1 = (text) => crypto.createHash('sha1').update(text).digest('hex');
const sameText = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};
const header = (headers, name) => {
  const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
};
const bodyText = (rawBody, body) => (rawBody !== undefined && rawBody !== null ? Buffer.from(rawBody).toString('utf8') : JSON.stringify(body ?? {}));
const cents = (v) => Math.round(Number(v) * 100);

// ------------------------------------------------------------------ sandbox

/** Signing key of the sandbox: <prefix>_WEBHOOK_SECRET, else derived from DATA_ENCRYPTION_KEY (never stored). */
const sandboxKey = (gateway) => env(gateway, 'WEBHOOK_SECRET') || crypto.createHmac('sha256', String(config.dataEncryptionKey)).update('brokerverse:payment-sandbox').digest('hex');

/** A signed sandbox notification (what the simulated gateway posts): { rawBody, headers }. */
export function sandboxNotification(gateway, { reference, providerRef, status, amount }) {
  const rawBody = JSON.stringify({ type: `payment.${status}`, reference, providerRef, status, amount, at: new Date().toISOString() });
  return { rawBody, headers: { 'x-sandbox-signature': hmacHex(sandboxKey(gateway), rawBody), 'content-type': 'application/json' } };
}

const sandbox = {
  credentials: () => ({ configured: true, required: [] }),
  checkout: async (link, gateway, { returnUrl }) => ({ providerRef: `SBX-${link.link_number}`, checkoutUrl: returnUrl }),
  verify: ({ rawBody, headers, body }, gateway) => {
    const text = bodyText(rawBody, body);
    const sig = header(headers, 'x-sandbox-signature');
    if (!sig || !sameText(sig, hmacHex(sandboxKey(gateway), text))) return { valid: false, reason: 'Invalid sandbox signature' };
    const p = JSON.parse(text);
    return { valid: true, event: { type: p.type, reference: p.reference, providerRef: p.providerRef, status: ['paid', 'failed'].includes(p.status) ? p.status : 'pending', amount: Number(p.amount) } };
  },
};

// ------------------------------------------------------------------ PayMongo

const PAYMONGO_API = 'https://api.paymongo.com/v1';
const PAYMONGO_METHODS = { gcash: 'gcash', maya: 'paymaya', grabpay: 'grab_pay', card: 'card', online_banking: 'dob', qrph: 'qrph' };

const paymongo = {
  credentials: (gateway) => {
    const required = ['SECRET_KEY', 'WEBHOOK_SECRET'].map((n) => ({ name: `${gateway.credentials_prefix}_${n}`, present: Boolean(env(gateway, n)) }));
    return { configured: required.every((r) => r.present), required };
  },
  checkout: async (link, gateway, { returnUrl, fetchImpl = globalThis.fetch }) => {
    const secret = env(gateway, 'SECRET_KEY');
    if (!secret) throw badRequest(`${gateway.name}: ${gateway.credentials_prefix}_SECRET_KEY is not set in the environment`);
    const methods = (link.method ? [link.method] : gateway.methods).map((m) => PAYMONGO_METHODS[m]).filter(Boolean);
    const body = { data: { attributes: {
      line_items: [{ name: link.description.slice(0, 250), amount: cents(link.total), currency: link.currency || 'PHP', quantity: 1 }],
      payment_method_types: methods.length ? methods : ['card'], success_url: `${returnUrl}?result=success`, cancel_url: `${returnUrl}?result=cancelled`,
      reference_number: link.link_number, description: link.description.slice(0, 250), send_email_receipt: false, show_line_items: true,
      ...(link.payer_email ? { billing: { name: link.payer_name || undefined, email: link.payer_email } } : {}),
      metadata: { linkNumber: link.link_number },
    } } };
    const r = await fetchImpl(`${PAYMONGO_API}/checkout_sessions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}` },
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(502, `PayMongo refused the checkout: ${json?.errors?.[0]?.detail || r.status}`);
    return { providerRef: json.data.id, checkoutUrl: json.data.attributes.checkout_url };
  },
  verify: ({ rawBody, headers, body }, gateway) => {
    const secret = env(gateway, 'WEBHOOK_SECRET');
    if (!secret) return { valid: false, reason: `${gateway.credentials_prefix}_WEBHOOK_SECRET is not set` };
    const sigHeader = String(header(headers, 'paymongo-signature') || '');
    const parts = Object.fromEntries(sigHeader.split(',').map((kv) => kv.split('=').map((s) => s.trim())).filter((kv) => kv.length === 2));
    const text = bodyText(rawBody, body);
    const expected = hmacHex(secret, `${parts.t}.${text}`);
    const given = gateway.mode === 'live' ? parts.li : parts.te;
    if (!parts.t || !given || !sameText(given, expected)) return { valid: false, reason: 'Invalid PayMongo signature' };
    const evt = JSON.parse(text)?.data?.attributes || {};
    const obj = evt.data || {};
    const attrs = obj.attributes || {};
    const payment = (attrs.payments || [])[0]?.attributes || attrs;
    const status = evt.type === 'checkout_session.payment.paid' || evt.type === 'payment.paid' ? 'paid' : evt.type === 'payment.failed' ? 'failed' : 'pending';
    return { valid: true, event: { type: evt.type, reference: attrs.reference_number || attrs.metadata?.linkNumber || payment.metadata?.linkNumber || null,
      providerRef: obj.type === 'checkout_session' ? obj.id : (attrs.checkout_session_id || null), status, amount: payment.amount !== undefined ? Number(payment.amount) / 100 : null } };
  },
};

// ------------------------------------------------------------------ Dragonpay

const DRAGONPAY_URL = { sandbox: 'https://test.dragonpay.ph/Pay.aspx', live: 'https://gw.dragonpay.ph/Pay.aspx' };
const DRAGONPAY_PROC = { gcash: 'GCSH', maya: 'PYMY', grabpay: 'GRPY' };
const DRAGONPAY_STATUS = { S: 'paid', F: 'failed', V: 'failed', P: 'pending', U: 'pending' };

/** Digest of a Dragonpay payment request (SHA1 of the colon-joined fields and the password). */
export const dragonpayRequestDigest = (f, password) => sha1([f.merchantid, f.txnid, f.amount, f.ccy, f.description, f.email, password].join(':'));
/** Digest of a Dragonpay postback / return. */
export const dragonpayPostbackDigest = (f, password) => sha1([f.txnid, f.refno, f.status, f.message, password].join(':'));

const dragonpay = {
  credentials: (gateway) => {
    const required = ['MERCHANT_ID', 'PASSWORD'].map((n) => ({ name: `${gateway.credentials_prefix}_${n}`, present: Boolean(env(gateway, n)) }));
    return { configured: required.every((r) => r.present), required };
  },
  checkout: async (link, gateway) => {
    const merchantid = env(gateway, 'MERCHANT_ID');
    const password = env(gateway, 'PASSWORD');
    if (!merchantid || !password) throw badRequest(`${gateway.name}: ${gateway.credentials_prefix}_MERCHANT_ID and ${gateway.credentials_prefix}_PASSWORD must be set in the environment`);
    const f = { merchantid, txnid: link.link_number, amount: Number(link.total).toFixed(2), ccy: link.currency || 'PHP', description: link.description.slice(0, 128),
      email: link.payer_email || '' };
    const qs = new URLSearchParams({ ...f, digest: dragonpayRequestDigest(f, password), ...(DRAGONPAY_PROC[link.method] ? { procid: DRAGONPAY_PROC[link.method] } : {}) });
    return { providerRef: link.link_number, checkoutUrl: `${DRAGONPAY_URL[gateway.mode] || DRAGONPAY_URL.sandbox}?${qs.toString()}` };
  },
  verify: ({ body, query }, gateway) => {
    const password = env(gateway, 'PASSWORD');
    if (!password) return { valid: false, reason: `${gateway.credentials_prefix}_PASSWORD is not set` };
    const f = { ...(query || {}), ...(body && typeof body === 'object' ? body : {}) };
    const fields = { txnid: String(f.txnid || ''), refno: String(f.refno || ''), status: String(f.status || ''), message: String(f.message || '') };
    if (!fields.txnid || !sameText(String(f.digest || '').toLowerCase(), dragonpayPostbackDigest(fields, password))) return { valid: false, reason: 'Invalid Dragonpay digest' };
    return { valid: true, event: { type: `postback.${fields.status}`, reference: fields.txnid, providerRef: fields.txnid, status: DRAGONPAY_STATUS[fields.status] || 'pending', amount: f.amount ? Number(f.amount) : null, refno: fields.refno } };
  },
};

export const PROVIDERS = { sandbox, paymongo, dragonpay };
export const METHODS = ['card', 'gcash', 'maya', 'grabpay', 'online_banking', 'otc', 'qrph'];

export function providerOf(gateway) {
  const p = PROVIDERS[gateway.provider];
  if (!p) throw badRequest(`Unknown payment provider ${gateway.provider}`);
  return p;
}
