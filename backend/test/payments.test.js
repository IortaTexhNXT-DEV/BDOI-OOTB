import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { PROVIDERS, dragonpayPostbackDigest, dragonpayRequestDigest } from '../src/modules/payment-gateway/providers.js';
import { createLink } from '../src/modules/payment-gateway/service.js';

// Test credentials only (the real ones live in the secret store, never in the repository)
process.env.PAYMONGO_SECRET_KEY = 'sk_test_brokerverse_unit';
process.env.PAYMONGO_WEBHOOK_SECRET = 'whsk_test_brokerverse_unit';
process.env.DRAGONPAY_MERCHANT_ID = 'BVTEST';
process.env.DRAGONPAY_PASSWORD = 'dp-test-password';

const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex');
const paymongoGateway = { code: 'PAYMONGO', name: 'PayMongo', provider: 'paymongo', mode: 'sandbox', methods: ['gcash', 'card'], credentials_prefix: 'PAYMONGO' };
const dragonpayGateway = { code: 'DRAGONPAY', name: 'Dragonpay', provider: 'dragonpay', mode: 'sandbox', methods: ['online_banking'], credentials_prefix: 'DRAGONPAY' };

function paymongoEvent(reference, amount, type = 'checkout_session.payment.paid', { live = false, secret = process.env.PAYMONGO_WEBHOOK_SECRET } = {}) {
  const rawBody = JSON.stringify({ data: { id: 'evt_1', type: 'event', attributes: { type, livemode: live, data: { id: 'cs_test_1', type: 'checkout_session',
    attributes: { reference_number: reference, payments: [{ id: 'pay_1', attributes: { amount: Math.round(amount * 100), status: 'paid' } }] } } } } });
  const t = Math.floor(Date.now() / 1000);
  const sig = hmac(secret, `${t}.${rawBody}`);
  return { rawBody, header: live ? `t=${t},te=,li=${sig}` : `t=${t},te=${sig},li=` };
}

describe('gateway providers (no network)', () => {
  it('verifies PayMongo signatures on the raw body, test or live key by mode', () => {
    const e = paymongoEvent('PL-2026-00009', 1500.5);
    const ok = PROVIDERS.paymongo.verify({ rawBody: Buffer.from(e.rawBody), headers: { 'Paymongo-Signature': e.header } }, paymongoGateway);
    expect(ok).toMatchObject({ valid: true, event: { reference: 'PL-2026-00009', providerRef: 'cs_test_1', status: 'paid', amount: 1500.5 } });
    expect(PROVIDERS.paymongo.verify({ rawBody: Buffer.from(`${e.rawBody} `), headers: { 'paymongo-signature': e.header } }, paymongoGateway).valid).toBe(false);
    expect(PROVIDERS.paymongo.verify({ rawBody: Buffer.from(e.rawBody), headers: { 'paymongo-signature': e.header } }, { ...paymongoGateway, mode: 'live' }).valid).toBe(false);
    const live = paymongoEvent('PL-2026-00009', 10, 'payment.failed', { live: true });
    expect(PROVIDERS.paymongo.verify({ rawBody: live.rawBody, headers: { 'paymongo-signature': live.header } }, { ...paymongoGateway, mode: 'live' }).event.status).toBe('failed');
    const forged = paymongoEvent('PL-2026-00009', 10, undefined, { secret: 'not-the-secret' });
    expect(PROVIDERS.paymongo.verify({ rawBody: forged.rawBody, headers: { 'paymongo-signature': forged.header } }, paymongoGateway).valid).toBe(false);
  });

  it('opens a PayMongo checkout session with the amount in centavos and the link number as reference', async () => {
    let sent = null;
    const fetchImpl = async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      return { ok: true, json: async () => ({ data: { id: 'cs_test_abc', attributes: { checkout_url: 'https://checkout.paymongo.com/cs_test_abc' } } }) };
    };
    const link = { link_number: 'PL-2026-00010', description: 'Home Protect package', total: 3167.5, currency: 'PHP', method: 'gcash', payer_email: 'nina@example.ph', payer_name: 'Nina' };
    const out = await PROVIDERS.paymongo.checkout(link, paymongoGateway, { returnUrl: 'http://localhost:3000/pay/tok', fetchImpl });
    expect(out).toEqual({ providerRef: 'cs_test_abc', checkoutUrl: 'https://checkout.paymongo.com/cs_test_abc' });
    expect(sent.url).toBe('https://api.paymongo.com/v1/checkout_sessions');
    expect(sent.init.headers.Authorization).toBe(`Basic ${Buffer.from('sk_test_brokerverse_unit:').toString('base64')}`);
    expect(sent.body.data.attributes).toMatchObject({ reference_number: 'PL-2026-00010', payment_method_types: ['gcash'], line_items: [{ amount: 316750, currency: 'PHP', quantity: 1 }] });
  });

  it('builds the Dragonpay request with its digest and verifies postbacks', async () => {
    const out = await PROVIDERS.dragonpay.checkout({ link_number: 'PL-2026-00011', total: 1000, currency: 'PHP', description: 'Premium', payer_email: 'a@example.ph' }, dragonpayGateway, {});
    const u = new URL(out.checkoutUrl);
    expect(u.origin + u.pathname).toBe('https://test.dragonpay.ph/Pay.aspx');
    expect(u.searchParams.get('amount')).toBe('1000.00');
    expect(u.searchParams.get('digest')).toBe(dragonpayRequestDigest({ merchantid: 'BVTEST', txnid: 'PL-2026-00011', amount: '1000.00', ccy: 'PHP', description: 'Premium', email: 'a@example.ph' }, 'dp-test-password'));
    const f = { txnid: 'PL-2026-00011', refno: 'REF1', status: 'S', message: 'Paid' };
    expect(PROVIDERS.dragonpay.verify({ query: { ...f, digest: dragonpayPostbackDigest(f, 'dp-test-password') } }, dragonpayGateway)).toMatchObject({ valid: true, event: { status: 'paid', reference: 'PL-2026-00011' } });
    expect(PROVIDERS.dragonpay.verify({ query: { ...f, status: 'F', digest: dragonpayPostbackDigest(f, 'dp-test-password') } }, dragonpayGateway).valid).toBe(false);
  });
});

let ctx;
let admin;
let sales;
let accounting;
let claims;
const q1 = async (sql, params) => (await pool.query(sql, params)).rows[0];
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const anon = (m, p) => request(ctx.app)[m](`/api${p}`);
const tokenOf = (link) => link.payUrl.split('/pay/')[1];

describe('payment links end to end', () => {
  let clientId;
  let salesUser;
  beforeAll(async () => {
    ctx = await setup();
    admin = ctx.api;
    sales = await persona('pay.sales', ['sales']);
    accounting = await persona('pay.accounting', ['accounting']);
    claims = await persona('pay.claims', ['claims']);
    salesUser = await q1("SELECT id FROM users WHERE username = 'pay.sales'");
    const c = await sales('post', '/clients').send({ firstName: 'Carmela', lastName: 'Reyes', emailId: 'carmela.reyes@example.ph', leadCategory: 'Retail', city: 'Makati' });
    clientId = c.body.clientId;
  });
  afterAll(async () => { await pool.end(); });

  const packageQuote = async (extra = {}) => (await sales('post', '/packages/quotes').send({ bundleId: 'HOME-PROTECT', clientId, lguCode: 'MKT', ...extra })).body.data;

  it('lists the gateways without secrets; only the administrator changes them and live needs credentials', async () => {
    const r = await accounting('get', '/payment-gateways');
    expect(r.status).toBe(200);
    const byCode = Object.fromEntries(r.body.data.map((g) => [g.code, g]));
    expect(byCode.SANDBOX).toMatchObject({ enabled: true, mode: 'sandbox', credentialsConfigured: true });
    expect(byCode.PAYMONGO.credentials).toEqual([{ name: 'PAYMONGO_SECRET_KEY', present: true }, { name: 'PAYMONGO_WEBHOOK_SECRET', present: true }]);
    expect(JSON.stringify(r.body)).not.toContain('sk_test_brokerverse_unit');
    expect((await accounting('put', '/payment-gateways/PAYMONGO').send({ enabled: true })).status).toBe(403);
    expect((await admin('put', '/payment-gateways/SANDBOX').send({ mode: 'live' })).status).toBe(400);
    delete process.env.DRAGONPAY_PASSWORD;
    expect((await admin('put', '/payment-gateways/DRAGONPAY').send({ enabled: true, mode: 'live' })).status).toBe(400);
    process.env.DRAGONPAY_PASSWORD = 'dp-test-password';
    const on = await admin('put', '/payment-gateways/PAYMONGO').send({ enabled: true, feeHandling: 'pass_on', feePercent: 2.5 });
    expect(on.body.data).toMatchObject({ enabled: true, feeHandling: 'pass_on', feePercent: 2.5 });
    expect((await admin('put', '/payment-gateways/DRAGONPAY').send({ enabled: true })).status).toBe(200);
  });

  it('pays a package quotation in the sandbox: policy issued, receipt created, policy PDF available', async () => {
    const pq = await packageQuote();
    expect((await claims('post', '/payment-links').send({ targetType: 'package_quote', targetId: pq.id, gatewayCode: 'SANDBOX' })).status).toBe(403);
    const r = await sales('post', '/payment-links').send({ targetType: 'package_quote', targetId: pq.quoteNumber, gatewayCode: 'SANDBOX', method: 'gcash' });
    expect(r.status).toBe(201);
    const link = r.body.data;
    expect(link).toMatchObject({ linkNumber: expect.stringMatching(/^PL-\d{4}-\d{5}$/), amount: pq.totalAmount, fee: 0, total: pq.totalAmount, status: 'pending', providerRef: `SBX-${link.linkNumber}` });
    expect((await sales('post', '/payment-links').send({ targetType: 'package_quote', targetId: pq.id, gatewayCode: 'SANDBOX' })).status).toBe(409);
    const page = await anon('get', `/public/payments/${tokenOf(link)}`);
    expect(page.status).toBe(200);
    expect(page.body.data).toMatchObject({ status: 'pending', total: pq.totalAmount, gateway: { provider: 'sandbox' }, policyPdf: false });
    expect(page.body.data.commissionAmount).toBeUndefined();
    const failed = await anon('post', `/public/payments/${tokenOf(link)}/sandbox`).send({ outcome: 'failed' });
    expect(failed.body.data.status).toBe('failed');
    const paid = await anon('post', `/public/payments/${tokenOf(link)}/sandbox`).send({ outcome: 'paid' });
    expect(paid.status).toBe(200);
    expect(paid.body.data).toMatchObject({ status: 'paid', policyPdf: true, policyNumber: expect.stringMatching(/^PKG-/), receiptNumber: expect.any(String) });
    const row = await q1('SELECT status, apply_status, policy_id, receipt_id FROM payment_links WHERE id = $1', [link.id]);
    expect(row).toMatchObject({ status: 'paid', apply_status: 'applied' });
    const rcv = await q1('SELECT sum(balance) AS balance FROM receivables WHERE policy_id = $1', [row.policy_id]);
    expect(Number(rcv.balance)).toBe(0);
    const receipt = await q1('SELECT amount, payment_mode, source, receipt_status FROM receipts WHERE id = $1', [row.receipt_id]);
    expect(receipt).toMatchObject({ amount: pq.totalAmount, payment_mode: 'gcash', source: 'payment-gateway', receipt_status: 'Converted' });
    expect((await q1('SELECT status FROM package_quotes WHERE id = $1', [pq.id])).status).toBe('issued');
    const pdf = await anon('get', `/public/payments/${tokenOf(link)}/policy.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    const again = await anon('post', `/public/payments/${tokenOf(link)}/sandbox`).send({ outcome: 'paid' });
    expect(again.status).toBe(409);
    expect(Number((await q1('SELECT count(*) AS n FROM receipts WHERE source = $1', ['payment-gateway'])).n)).toBe(1);
    const log = await accounting('get', `/payment-gateways/events?linkId=${link.id}`);
    expect(log.body.data.map((e) => e.status)).toEqual(['paid', 'failed']);
  });

  it('rejects a notification with a bad signature and logs it', async () => {
    const r = await anon('post', '/public/payments/webhooks/SANDBOX').set('x-sandbox-signature', 'deadbeef').send({ reference: 'PL-2026-00001', status: 'paid', amount: 1 });
    expect(r.status).toBe(401);
    const bad = await accounting('get', '/payment-gateways/events?valid=false');
    expect(bad.body.total).toBeGreaterThanOrEqual(1);
    expect((await anon('get', '/public/payments/not-a-token')).status).toBe(404);
  });

  it('collects a policy premium through PayMongo (fee passed on) and applies the signed webhook once', async () => {
    const issued = await sales('post', `/packages/quotes/${(await packageQuote()).id}/issue`).send({});
    const policyId = issued.body.data.policyId;
    const fetchImpl = async () => ({ ok: true, json: async () => ({ data: { id: 'cs_test_xyz', attributes: { checkout_url: 'https://checkout.paymongo.com/cs_test_xyz' } } }) });
    const link = await createLink({ targetType: 'policy', targetId: policyId, gatewayCode: 'PAYMONGO', method: 'card' }, { id: salesUser.id }, { fetchImpl });
    const gross = Number((await q1('SELECT premium_total FROM policies WHERE id = $1', [policyId])).premium_total);
    expect(link).toMatchObject({ amount: gross, fee: Math.round(gross * 2.5) / 100, checkoutUrl: 'https://checkout.paymongo.com/cs_test_xyz', providerRef: 'cs_test_xyz' });
    expect(link.total).toBe(Math.round((link.amount + link.fee) * 100) / 100);
    const e = paymongoEvent(link.linkNumber, link.total);
    const hook = await anon('post', '/public/payments/webhooks/PAYMONGO').set('Content-Type', 'application/json').set('Paymongo-Signature', e.header).send(e.rawBody);
    expect(hook.status).toBe(200);
    expect(hook.body.data).toMatchObject({ status: 'paid', linkNumber: link.linkNumber });
    const row = await q1('SELECT status, apply_status, receipt_id FROM payment_links WHERE id = $1', [link.id]);
    expect(row).toMatchObject({ status: 'paid', apply_status: 'applied' });
    expect((await q1('SELECT amount, payment_mode FROM receipts WHERE id = $1', [row.receipt_id]))).toMatchObject({ amount: gross, payment_mode: 'card' });
    const dup = await anon('post', '/public/payments/webhooks/PAYMONGO').set('Content-Type', 'application/json').set('Paymongo-Signature', e.header).send(e.rawBody);
    expect(dup.body.data.status).toBe('paid');
    expect(Number((await q1('SELECT count(*) AS n FROM receipts WHERE policy_id = $1', [policyId])).n)).toBe(1);
  });

  it('holds a payment whose amount differs for review', async () => {
    const issued = await sales('post', `/packages/quotes/${(await packageQuote()).id}/issue`).send({});
    const link = await createLink({ targetType: 'policy', targetId: issued.body.data.policyId, gatewayCode: 'DRAGONPAY' }, { id: salesUser.id });
    expect(link.checkoutUrl).toMatch(/^https:\/\/test\.dragonpay\.ph\/Pay\.aspx\?/);
    const f = { txnid: link.linkNumber, refno: 'DP123', status: 'S', message: 'Approved' };
    const r = await anon('get', `/public/payments/webhooks/DRAGONPAY?${new URLSearchParams({ ...f, amount: '1.00', digest: dragonpayPostbackDigest(f, 'dp-test-password') })}`);
    expect(r.text).toBe('result=OK');
    expect((await q1('SELECT status, apply_status FROM payment_links WHERE id = $1', [link.id]))).toMatchObject({ status: 'review', apply_status: 'not_applied' });
  });

  it('keeps a paid link awaiting issuance when automatic issuance is off, then applies it on request', async () => {
    await admin('put', '/payment-gateways/SANDBOX').send({ autoIssue: false });
    const pq = await packageQuote();
    const link = (await sales('post', '/payment-links').send({ targetType: 'package_quote', targetId: pq.id, gatewayCode: 'SANDBOX' })).body.data;
    await anon('post', `/public/payments/${tokenOf(link)}/sandbox`).send({ outcome: 'paid' });
    const waiting = await sales('get', `/payment-links/${link.id}`);
    expect(waiting.body.data).toMatchObject({ status: 'paid', applyStatus: 'awaiting_issue', receiptNumber: null });
    expect(waiting.body.data.events).toHaveLength(1);
    const notes = await q1("SELECT count(*) AS n FROM notifications WHERE entity = 'payment_link' AND entity_id = $1", [link.id]);
    expect(Number(notes.n)).toBeGreaterThan(0);
    await sales('post', `/packages/quotes/${pq.id}/issue`).send({});
    const applied = await accounting('post', `/payment-links/${link.id}/apply`);
    expect(applied.status).toBe(200);
    expect(applied.body.data).toMatchObject({ applyStatus: 'applied', receiptNumber: expect.any(String), policyNumber: expect.stringMatching(/^PKG-/) });
    await admin('put', '/payment-gateways/SANDBOX').send({ autoIssue: true });
  });

  it('cancels a pending link and lists links', async () => {
    const pq = await packageQuote();
    const link = (await sales('post', '/payment-links').send({ targetType: 'package_quote', targetId: pq.id, gatewayCode: 'SANDBOX' })).body.data;
    const c = await sales('post', `/payment-links/${link.id}/cancel`);
    expect(c.body.data.status).toBe('cancelled');
    expect((await anon('post', `/public/payments/${tokenOf(link)}/sandbox`).send({ outcome: 'paid' })).status).toBe(409);
    const list = await accounting('get', '/payment-links?status=paid,review');
    expect(list.body.total).toBe(4);
    expect((await sales('post', '/payment-links').send({ targetType: 'package_quote', targetId: pq.id, gatewayCode: 'NOPE' })).status).toBe(404);
  });
});
