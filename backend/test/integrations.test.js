/**
 * Integration framework and connectors (migrations 0310 to 0314): connectors and credentials by environment variable
 * name, the outbox with retry and backoff, resend and cancel, the inbox and signed inbound messages, the fake provider
 * of test mode and a live call through a mocked fetch; SMS templates with the consent check and the reminder jobs; CTPL
 * COC series, authentication at issue, manual fallback, LTO feed and the unauthenticated report; insurer API requests and
 * the claim status file; bank payment files from layout to status file and the payment journal.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query, one, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { config } from '../src/config.js';
import { withoutCommissionTaxes } from './helpers.js';

let ctx; let admin; let maker; let checker;
let outbox; let messaging; let layouts;
const setConnector = (code, b) => admin('put', `/integrations/connectors/${code}`).send(b);
const msgRow = (id) => one('SELECT * FROM integration_outbox WHERE id = $1', [id]);

beforeAll(async () => {
  ctx = await setupFinance();
  await withoutCommissionTaxes();
  admin = ctx.api; maker = ctx.as('maker'); checker = ctx.as('checker');
  outbox = await import('../src/modules/integrations/framework/outbox.js');
  messaging = await import('../src/modules/integrations/messaging.js');
  layouts = await import('../src/modules/integrations/bankfiles/layouts.js');
});
afterAll(async () => {
  delete process.env.PKGF_TEST_SMS_KEY;
  await pool.end();
});

async function clientWith(phone) {
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return one(`INSERT INTO clients(client_code, display_name, first_name, last_name, email, phone, created_by) VALUES ($1,$2,'Ana','Reyes',$3,$4,'test') RETURNING *`,
    [`CL-I-${tag}`, `Ana Reyes ${tag}`, `ana.${tag}@example.ph`, phone]);
}

describe('connectors', () => {
  it('lists connectors with the credential variable names and whether they are set, never the values', async () => {
    process.env.PKGF_TEST_SMS_KEY = 'secret-value-123';
    expect((await setConnector('SMS_SEMAPHORE', { credentialEnv: { apiKey: 'PKGF_TEST_SMS_KEY' } })).status).toBe(200);
    const r = await admin('get', '/integrations/connectors');
    expect(r.status).toBe(200);
    const sms = r.body.data.find((c) => c.code === 'SMS_SEMAPHORE');
    expect(sms).toMatchObject({ kind: 'sms', adapter: 'http_sms', mode: 'test', enabled: true, credentialsConfigured: true });
    expect(sms.credentials).toEqual([{ key: 'apiKey', envName: 'PKGF_TEST_SMS_KEY', present: true, required: true }]);
    expect(JSON.stringify(r.body)).not.toContain('secret-value-123');
    // other roles do not see the integrations
    expect((await maker('get', '/integrations/connectors')).status).toBe(403);
  });

  it('refuses a credential value instead of a variable name, and live mode while something is missing', async () => {
    expect((await setConnector('CTPL_AUTH', { credentialEnv: { apiKey: 'abc-123-secret' } })).status).toBe(400);
    const live = await setConnector('CTPL_AUTH', { mode: 'live' });
    expect(live.status).toBe(400);
    expect(live.body.message).toMatch(/endpoint is empty/);
    expect(live.body.message).toMatch(/CTPL_AUTH_API_KEY/);
    const t = await admin('post', '/integrations/connectors/SMS_SEMAPHORE/test');
    expect(t.body.data).toMatchObject({ ok: true, mode: 'test' });
    const audit = await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'integration_connector' AND entity_id = 'SMS_SEMAPHORE'");
    expect(audit.n).toBeGreaterThanOrEqual(2);
  });
});

describe('outbox: retry with backoff, failure, resend, cancel', () => {
  it('retries a failing provider with growing waits, then sends', async () => {
    await setConnector('SMS_SEMAPHORE', { options: { preset: 'semaphore', fakeFailFirst: 2 }, retryBaseSeconds: 30 });
    const t = await admin('post', '/messaging/templates/RENEWAL_NOTICE/test').send({ to: '0917 123 4567' });
    expect(t.status).toBe(200);
    const id = t.body.data.id;
    let m = await msgRow(id);
    expect(m).toMatchObject({ status: 'retry', attempts: 1, mode: 'test' });
    const wait1 = (new Date(m.next_attempt_at) - Date.now()) / 1000;
    expect(wait1).toBeGreaterThan(20);
    expect(wait1).toBeLessThanOrEqual(31);
    // not due yet: the job leaves it
    await outbox.processOutbox({ connectorCode: 'SMS_SEMAPHORE' });
    expect((await msgRow(id)).attempts).toBe(1);
    await outbox.processOutbox({ ids: [id] });
    m = await msgRow(id);
    expect(m).toMatchObject({ status: 'retry', attempts: 2 });
    const wait2 = (new Date(m.next_attempt_at) - Date.now()) / 1000;
    expect(wait2).toBeGreaterThan(50);
    await outbox.processOutbox({ ids: [id] });
    m = await msgRow(id);
    expect(m).toMatchObject({ status: 'sent', attempts: 3 });
    expect(m.payload).toMatchObject({ to: '+639171234567' });
    const d = await admin('get', `/integrations/outbox/${id}`);
    expect(d.body.data.attemptLog.map((a) => a.ok)).toEqual([false, false, true]);
  });

  it('a refused request fails at once; resend after the fix sends it; a queued message can be cancelled', async () => {
    await setConnector('SMS_SEMAPHORE', { options: { preset: 'semaphore', fakeReject: true } });
    const t = await admin('post', '/messaging/templates/CLAIM_UPDATE/test').send({ to: '09181234567' });
    const id = t.body.data.id;
    expect(await msgRow(id)).toMatchObject({ status: 'failed', attempts: 1 });
    expect((await admin('get', '/integrations/outbox?status=failed')).body.data.map((x) => x.id)).toContain(id);
    await setConnector('SMS_SEMAPHORE', { options: { preset: 'semaphore' } });
    const r = await admin('post', `/integrations/outbox/${id}/resend`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'sent', attempts: 1 });
    expect((await admin('post', `/integrations/outbox/${id}/resend`)).status).toBe(409);
    expect(await one("SELECT action FROM audit_log WHERE entity = 'integration_message' AND entity_id = $1", [String(id)])).toMatchObject({ action: 'resend' });

    await setConnector('SMS_SEMAPHORE', { enabled: false });
    const held = await admin('post', '/messaging/templates/CLAIM_UPDATE/test').send({ to: '09181234567' });
    const hm = await msgRow(held.body.data.id);
    expect(hm).toMatchObject({ status: 'queued', attempts: 0 });
    expect(hm.last_error).toMatch(/switched off/);
    const c = await admin('post', `/integrations/outbox/${hm.id}/cancel`).send({ reason: 'Not needed' });
    expect(c.body.data.status).toBe('cancelled');
    await setConnector('SMS_SEMAPHORE', { enabled: true });
  });

  it('live mode calls the provider with the credential from the environment (Semaphore-style form post)', async () => {
    await setConnector('SMS_SEMAPHORE', { mode: 'live', options: { preset: 'semaphore', senderName: 'BROKER' } });
    const client = await clientWith('+63 917 555 0101');
    const m = await messaging.queueClientMessage(null, { templateCode: 'PAYMENT_REMINDER', clientId: client.id, vars: { amountDue: '1,000.00', dueDate: '2026-10-10', billNumber: 'B-1', policyNumber: 'P-1' } });
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify([{ message_id: 991, status: 'Queued' }]), { status: 200 }); };
    await outbox.processOutbox({ ids: [m.id], fetchImpl });
    const row = await msgRow(m.id);
    expect(row).toMatchObject({ status: 'sent', mode: 'live', external_ref: '991' });
    expect(calls[0].url).toBe('https://api.semaphore.co/api/v4/messages');
    const form = new URLSearchParams(calls[0].init.body);
    expect(form.get('apikey')).toBe('secret-value-123');
    expect(form.get('number')).toBe('09175550101');
    expect(form.get('sendername')).toBe('BROKER');
    expect(form.get('message')).toContain('PHP 1,000.00');
    // a 503 is retried, a 400 is not
    const m2 = await messaging.queueClientMessage(null, { templateCode: 'PAYMENT_REMINDER', clientId: client.id, vars: {} });
    await outbox.processOutbox({ ids: [m2.id], fetchImpl: async () => new Response('busy', { status: 503 }) });
    expect((await msgRow(m2.id)).status).toBe('retry');
    await outbox.processOutbox({ ids: [m2.id], fetchImpl: async () => new Response(JSON.stringify({ message: 'invalid number' }), { status: 400 }) });
    expect(await msgRow(m2.id)).toMatchObject({ status: 'failed', last_error: 'HTTP 400: invalid number' });
    await setConnector('SMS_SEMAPHORE', { mode: 'test' });
  });
});

describe('messaging: templates, consent, reminders and claim updates', () => {
  it('checks consent: refused processing consent and marketing without consent are skipped with the reason', async () => {
    const client = await clientWith('09170000001');
    await query("INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel) VALUES ('client', $1, 'processing', false, 'Form')", [client.id]);
    const m = await messaging.queueClientMessage(null, { templateCode: 'RENEWAL_NOTICE', clientId: client.id, vars: {} });
    expect(m).toMatchObject({ status: 'skipped' });
    expect(m.lastError).toMatch(/refused consent/);
    const promo = await admin('post', '/messaging/templates').send({ code: 'PROMO', name: 'Promo', event: 'general', body: 'Hi {{clientName}}, ask about our new cover.', consentPurpose: 'marketing' });
    expect(promo.status).toBe(201);
    const other = await clientWith('09170000002');
    const p = await messaging.queueClientMessage(null, { templateCode: 'PROMO', clientId: other.id });
    expect(p.lastError).toMatch(/No marketing consent/);
    await query("INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel) VALUES ('client', $1, 'marketing', true, 'Form')", [other.id]);
    expect((await messaging.queueClientMessage(null, { templateCode: 'PROMO', clientId: other.id })).status).toBe('queued');
    // no mobile number
    const none = await clientWith(null);
    expect((await messaging.queueClientMessage(null, { templateCode: 'RENEWAL_NOTICE', clientId: none.id })).lastError).toMatch(/No valid mobile number/);
    // opt-in rule: a client without a recorded consent is skipped
    await admin('put', '/settings').send({ settings: { 'messaging.service_consent': 'opt-in' } });
    clearSettingsCache();
    expect((await messaging.queueClientMessage(null, { templateCode: 'RENEWAL_NOTICE', clientId: (await clientWith('09170000003')).id })).status).toBe('skipped');
    await admin('put', '/settings').send({ settings: { 'messaging.service_consent': 'opt-out' } });
    clearSettingsCache();
  });

  it('renewal notice and payment reminder jobs queue one message per event and send it', async () => {
    const client = await clientWith('09171112222');
    const now = await today();
    const pol = (await makePolicy({ net: 10000 })).policy;
    await query('UPDATE policies SET client_id = $2, expiry_date = $3 WHERE id = $1', [pol.id, client.id, addDays(now, 30)]);
    const rcv = await one(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES ($1,$2,$3,5000,5000,$4,'open') RETURNING id`,
      [`B-I-${Date.now()}`, pol.id, client.id, addDays(now, 3)]);
    const handlers = await import('../src/jobs/handlers.js');
    const r1 = await handlers.smsRenewalNotices();
    expect(r1.queued).toBeGreaterThanOrEqual(1);
    const r2 = await handlers.smsRenewalNotices();
    expect(r2.queued).toBe(0);
    const sent = await one("SELECT * FROM integration_outbox WHERE idempotency_key LIKE $1", [`sms:renewal:${pol.id}:%`]);
    expect(sent).toMatchObject({ status: 'sent', entity: 'policy' });
    expect(sent.payload.text).toContain(pol.policy_number);
    const p1 = await handlers.smsPaymentReminders();
    expect(p1.queued).toBeGreaterThanOrEqual(1);
    const pm = await one("SELECT * FROM integration_outbox WHERE idempotency_key LIKE $1", [`sms:payment:${rcv.id}:%`]);
    expect(pm.payload.text).toContain('5,000.00');
    const log = await maker('get', `/messaging/messages?clientId=${client.id}`);
    expect(log.status).toBe(200);
    expect(log.body.data.length).toBe(2);
    // the bill was inserted without its journal: settle it so the ledger checks of the suite stay meaningful
    await query("UPDATE receivables SET balance = 0, status = 'paid' WHERE id = $1", [rcv.id]);
  });

  it('a claim moving to a configured status sends the claim update; an ad hoc message goes to the client', async () => {
    const client = await clientWith('09173334444');
    const pol = (await makePolicy({ net: 10000 })).policy;
    await query('UPDATE policies SET client_id = $2 WHERE id = $1', [pol.id, client.id]);
    const claim = await one(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date) VALUES ($1,$2,$3,'registered', current_date) RETURNING *`, [`CLM-I-${Date.now()}`, pol.id, client.id]);
    const svc = await import('../src/modules/claims/service.js');
    await svc.updateStatus(claim.id, 'in-review', { id: ctx.userIds.claims, username: 'clm.user' }, 'Documents complete');
    const m = await one("SELECT * FROM integration_outbox WHERE idempotency_key = $1", [`sms:claim:${claim.id}:in-review`]);
    expect(m).toBeTruthy();
    expect(m.payload.text).toContain(claim.claim_number);
    const s = await ctx.as('sales')('post', '/messaging/send').send({ clientId: client.id, templateCode: 'RENEWAL_NOTICE', policyId: pol.policy_number });
    expect(s.status).toBe(200);
    expect(s.body.data.status).toBe('sent');
    expect(s.body.data.payload.text).toContain(pol.policy_number);
  });
});

describe('CTPL authentication', () => {
  let issued;
  async function issueCtpl(insurer, doc) {
    const { issuePolicy } = await import('../src/modules/policies/service.js');
    const client = await clientWith('09175556666');
    const ins = await one('SELECT id FROM insurance_companies WHERE code = $1', [insurer]);
    const r = await withTransaction((db) => issuePolicy(db, { clientId: client.id, insuranceCompanyId: ins.id, lob: 'MOTOR', productType: 'Motor', sumInsured: 800000, netPremium: 12000,
      grossPremium: 15600, commissionAmount: 1800, commissionRate: 0.15, currency: 'PHP', doc: { ctplCoveragePremium: 560, ...doc } }, {}, ctx.userIds.maker));
    return one('SELECT * FROM policies WHERE id = $1', [r.policyId]);
  }

  it('a CTPL cover issued gets the next COC number and is authenticated through the provider; the code is printed', async () => {
    issued = await issueCtpl('MALAYAN', { plateNumber: 'NCA 4521', chassisNumber: 'MHFXR41G5J0012345', engineNumber: 'ENG-1' });
    const a = await one('SELECT * FROM ctpl_authentications WHERE policy_id = $1', [issued.id]);
    expect(a).toMatchObject({ coc_number: 'MIC00010000', status: 'requested' });
    await outbox.processOutbox({ ids: [Number(a.outbox_id)] });
    const after = (await ctx.as('sales')('get', `/ctpl/authentications/${a.id}`)).body.data;
    expect(after).toMatchObject({ status: 'authenticated', method: 'api' });
    expect(after.authCode).toMatch(/^[0-9A-F]{12}$/);
    const pol = await one('SELECT doc FROM policies WHERE id = $1', [issued.id]);
    expect(pol.doc).toMatchObject({ cocNumber: 'MIC00010000', ctplAuthenticationCode: after.authCode });
    const { toPolicy } = await import('../src/modules/policies/service.js');
    const { policyScheduleDoc } = await import('../src/modules/documents/templates.js');
    const spec = await policyScheduleDoc(toPolicy({ ...issued, doc: pol.doc }));
    expect(spec.meta).toEqual(expect.arrayContaining([['COC no.', 'MIC00010000'], ['CTPL authentication code', after.authCode]]));
    const series = (await ctx.as('sales')('get', '/ctpl/coc-series')).body.data.find((s) => s.prefix === 'MIC');
    expect(series).toMatchObject({ nextNumber: 10001, used: 1, remaining: 499 });
  });

  it('missing vehicle details hold the request; the provider refusing it leaves a failure; the code is keyed in by hand', async () => {
    const p = await issueCtpl('PIONEER', {});
    const a = (await ctx.as('sales')('get', `/ctpl/authentications?search=${p.policy_number}`)).body.data[0];
    expect(a).toMatchObject({ status: 'pending', cocNumber: 'PIS00020000' });
    const r = await ctx.as('sales')('post', `/ctpl/authentications/${a.id}/authenticate`);
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/plate number or MV file number/);
    expect((await ctx.as('sales')('put', `/ctpl/authentications/${a.id}`).send({ mvFileNumber: '1301-00000123456', chassisNumber: 'CH-998' })).status).toBe(200);
    await setConnector('CTPL_AUTH', { options: { fakeReject: true } });
    const f = await ctx.as('sales')('post', `/ctpl/authentications/${a.id}/authenticate`);
    expect(f.body.data).toMatchObject({ status: 'failed' });
    const rep = await ctx.as('sales')('get', '/ctpl/authentications?unauthenticated=true');
    expect(rep.body.data.map((x) => x.id)).toContain(a.id);
    const xl = await ctx.as('sales')('get', '/ctpl/authentications/report?format=csv');
    expect(xl.status).toBe(200);
    expect(xl.text).toContain(p.policy_number);
    const man = await ctx.as('sales')('post', `/ctpl/authentications/${a.id}/manual`).send({ authCode: 'PORTAL-77AB', providerReference: 'PRT-1' });
    expect(man.body.data).toMatchObject({ status: 'authenticated', method: 'manual', authCode: 'PORTAL-77AB' });
    expect((await ctx.as('sales')('post', `/ctpl/authentications/${a.id}/manual`).send({ authCode: 'AGAIN-1' })).status).toBe(409);
    await setConnector('CTPL_AUTH', { options: {} });
  });

  it('COC series: overlap refused, exhaustion closes the series, a policy without numbers waits for one; LTO feed when switched on', async () => {
    const ins = await one("SELECT id FROM insurance_companies WHERE code = 'FPG'");
    expect((await ctx.as('sales')('post', '/ctpl/coc-series').send({ insuranceCompanyId: ins.id, prefix: 'FPG', seriesFrom: 1, seriesTo: 1, numberWidth: 6 })).status).toBe(201);
    expect((await ctx.as('sales')('post', '/ctpl/coc-series').send({ insuranceCompanyId: ins.id, prefix: 'FPG', seriesFrom: 1, seriesTo: 5 })).status).toBe(409);
    await admin('put', '/settings').send({ settings: { 'ctpl.lto_feed': true } });
    await setConnector('LTO_FEED', { enabled: true });
    clearSettingsCache();
    const p1 = await issueCtpl('FPG', { plateNumber: 'ABC 123', chassisNumber: 'CH-1' });
    const a1 = await one('SELECT * FROM ctpl_authentications WHERE policy_id = $1', [p1.id]);
    expect(a1.coc_number).toBe('FPG000001');
    expect((await one("SELECT status FROM coc_series WHERE prefix = 'FPG'")).status).toBe('exhausted');
    await outbox.processOutbox({ ids: [Number(a1.outbox_id)] });
    const lto = await one("SELECT * FROM integration_outbox WHERE message_type = 'ctpl.lto_feed' AND entity_id = $1", [a1.id]);
    await outbox.processOutbox({ ids: [Number(lto.id)] });
    expect(await one('SELECT status, lto_status FROM ctpl_authentications WHERE id = $1', [a1.id])).toEqual({ status: 'authenticated', lto_status: 'sent' });
    const p2 = await issueCtpl('FPG', { plateNumber: 'ABC 124', chassisNumber: 'CH-2' });
    const a2 = await one('SELECT * FROM ctpl_authentications WHERE policy_id = $1', [p2.id]);
    expect(a2).toMatchObject({ coc_number: null, status: 'pending' });
    expect(a2.last_error).toMatch(/No active COC series/);
    const fix = await ctx.as('sales')('put', `/ctpl/authentications/${a2.id}`).send({ cocNumber: 'FPG000099' });
    expect(fix.body.data.cocNumber).toBe('FPG000099');
    expect((await ctx.as('sales')('post', `/ctpl/authentications/${a2.id}/authenticate`)).body.data.status).toBe('authenticated');
    await admin('put', '/settings').send({ settings: { 'ctpl.lto_feed': false } });
    clearSettingsCache();
  });

  it('an authentication result pushed by the provider is verified and applied through the inbox', async () => {
    const p = await issueCtpl('MALAYAN', { plateNumber: 'XYZ 9', chassisNumber: 'CH-9' });
    const a = await one('SELECT * FROM ctpl_authentications WHERE policy_id = $1', [p.id]);
    await query("UPDATE integration_outbox SET status = 'cancelled' WHERE id = $1", [a.outbox_id]);
    const c = await one("SELECT * FROM integration_connectors WHERE code = 'CTPL_AUTH'");
    const body = JSON.stringify({ type: 'ctpl.authentication_result', cocNumber: a.coc_number, authCode: 'PUSH-12345', reference: 'R-1', status: 'authenticated' });
    const sig = outbox.signInbound(outbox.inboundKey(c, config), body);
    const request = (await import('supertest')).default;
    const bad = await request(ctx.app).post('/api/public/integrations/inbound/CTPL_AUTH').set('Content-Type', 'application/json').set('x-signature', 'deadbeef').send(body);
    expect(bad.status).toBe(401);
    const good = await request(ctx.app).post('/api/public/integrations/inbound/CTPL_AUTH').set('Content-Type', 'application/json').set('x-signature', sig).send(body);
    expect(good.status).toBe(200);
    expect(good.body.data.status).toBe('processed');
    expect(await one('SELECT status, auth_code FROM ctpl_authentications WHERE id = $1', [a.id])).toEqual({ status: 'authenticated', auth_code: 'PUSH-12345' });
    const inbox = (await admin('get', '/integrations/inbox?messageType=ctpl.authentication_result')).body.data;
    expect(inbox.map((i) => i.status).sort()).toEqual(['ignored', 'processed']);
  });
});

describe('insurer system integration', () => {
  it('policy issuance request, policy data and claim status through the mapping; claim status file as fallback', async () => {
    const ins = await one("SELECT id FROM insurance_companies WHERE code = 'MALAYAN'");
    const map = await admin('put', `/insurer-integration/mappings/${ins.id}`).send({ connectorCode: 'INSURER_API', brokerCode: 'BRK-77', productMap: { MOTOR: 'PC' },
      claimStatusMap: { 'UNDER EVALUATION': 'In review', APPROVED: 'Approved' } });
    expect(map.status).toBe(200);
    expect((await admin('put', `/insurer-integration/mappings/${ins.id}`).send({ connectorCode: 'SMS_SEMAPHORE' })).status).toBe(400);
    const { policy } = await makePolicy({ net: 20000, insurer: 'MALAYAN' });
    await query("UPDATE policies SET lob = 'MOTOR', insured_name = 'Ramon Cruz' WHERE id = $1", [policy.id]);
    const pv = await admin('post', `/insurer-integration/mappings/${ins.id}/preview`).send({ policyNumber: policy.policy_number });
    expect(pv.body.data.request).toMatchObject({ brokerCode: 'BRK-77', productCode: 'PC', brokerPolicyNumber: policy.policy_number, insuredName: 'Ramon Cruz' });
    const r = await ctx.as('sales')('post', '/insurer-integration/requests').send({ type: 'insurer.policy_issue', policyId: policy.policy_number });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('sent');
    const doc = (await one('SELECT doc FROM policies WHERE id = $1', [policy.id])).doc;
    expect(doc.insurerPolicyNumber).toMatch(/^FAKE-/);
    expect((await ctx.as('sales')('post', '/insurer-integration/requests').send({ type: 'insurer.policy_issue', policyId: policy.policy_number })).status).toBe(409);
    await ctx.as('sales')('post', '/insurer-integration/requests').send({ type: 'insurer.policy_data', policyId: policy.id });
    const det = (await one('SELECT details FROM policies WHERE id = $1', [policy.id])).details;
    expect(det.insurerPolicyData).toMatchObject({ status: 'IN FORCE', difference: 0, flagged: false });

    const claim = await one(`INSERT INTO claims(claim_number, policy_id, status, loss_date) VALUES ($1,$2,'in-review', current_date) RETURNING *`, [`CLM-INS-${Date.now()}`, policy.id]);
    const cs = await ctx.as('claims')('post', '/insurer-integration/requests').send({ type: 'insurer.claim_status', claimId: claim.claim_number });
    expect(cs.body.data.status).toBe('sent');
    expect((await one('SELECT details FROM claims WHERE id = $1', [claim.id])).details).toMatchObject({ insurerStatus: 'In review', insurerStatusSource: 'api' });
    const csv = `Claim Number,Status,Remarks\r\n${claim.claim_number},APPROVED,For payment\r\nCLM-NOPE,APPROVED,\r\n`;
    const imp = await ctx.as('claims')('post', '/insurer-integration/claim-status/import').attach('file', Buffer.from(csv), 'claims.csv');
    expect(imp.status).toBe(200);
    expect(imp.body.data).toMatchObject({ rows: 2, processed: 1, failed: 1 });
    expect((await one('SELECT details FROM claims WHERE id = $1', [claim.id])).details).toMatchObject({ insurerStatus: 'Approved', insurerRemarks: 'For payment', insurerStatusSource: 'file' });
    const reqs = await admin('get', '/insurer-integration/requests');
    expect(reqs.body.data.map((m) => m.messageType)).toEqual(expect.arrayContaining(['insurer.policy_issue', 'insurer.policy_data', 'insurer.claim_status']));
  });
});

describe('bank payment files', () => {
  it('the layout engine writes fixed-width and delimited files and reads status files', async () => {
    const bpi = await one("SELECT * FROM bank_file_layouts WHERE code = 'BPI-BULK'");
    const f = layouts.renderFile(bpi, layouts.SAMPLE.batch, layouts.SAMPLE.lines);
    const rows = f.content.split('\r\n').filter(Boolean);
    expect(rows).toHaveLength(4);
    expect(rows[0].slice(0, 1)).toBe('1');
    expect(rows[1]).toHaveLength(1 + 16 + 15 + 40 + 10 + 20);
    expect(rows[1].slice(17, 32)).toBe('000000012500000');
    expect(rows[3]).toBe('3000002000000015325050');
    expect(f.fileName).toBe('BPI100526_BPB-2026-00001.txt');
    const st = layouts.parseStatusFile(bpi, `${'PV-2026-00011'.padEnd(20)}${'OK'.padEnd(10)}${'BPI-REF-1'.padEnd(20)}\n${'PV-2026-00012'.padEnd(20)}${'REJ'.padEnd(10)}${''.padEnd(20)}Account closed\n`);
    expect(st.map((r) => [r.reference, r.status, r.bankReference, r.reason])).toEqual([['PV-2026-00011', 'paid', 'BPI-REF-1', null], ['PV-2026-00012', 'rejected', null, 'Account closed']]);
    const ubp = layouts.renderFile(await one("SELECT * FROM bank_file_layouts WHERE code = 'UBP-BULK'"), { ...layouts.SAMPLE.batch, channel: 'instapay' }, layouts.SAMPLE.lines);
    expect(ubp.content.split('\n')[1]).toBe('INSTAPAY,MBT,0012345678,"Malayan Insurance Co., Inc.",125000.00,PV-2026-00011,remittance@malayan.example.ph');
    const bad = await maker('post', '/bank-payments/layouts').send({ code: 'X-FIXED', name: 'x', channels: ['bulk_credit'], format: 'fixed', detailFields: [{ name: 'A', source: 'line.amount' }] });
    expect(bad.status).toBe(400);
    const pv = await maker('post', '/bank-payments/layouts/preview').send({ format: 'delimited', delimiter: ';', detailFields: [{ name: 'A', source: 'line.accountNumber', format: 'digits' }, { name: 'B', source: 'line.amount', format: 'amount_cents' }] });
    expect(pv.body.data.content).toBe('0012345678;12500000\r\n1234567890;2825050\r\n');
  });

  it('pays an insurer remittance and a referrer payout by file: approval, file, status file, journals; a rejected payment frees its voucher', async () => {
    // insurer remittance voucher (MALAYAN has a bank account in the sample payee accounts)
    const m = await makePolicy({ net: 40000, insurer: 'MALAYAN' });
    expect((await maker('post', '/receipts').send({ policyId: m.policy.id, amount: m.gross })).status).toBe(201);
    const rem = (await maker('post', '/disbursements/insurer-remittance').send({ insurerName: 'MALAYAN' })).body.data;
    expect((await maker('put', `/disbursements/${rem.disbursementId}`).send({ status: 'for-approval' })).status).toBe(200);
    // referrer payout voucher (bank account on the referrer record)
    const c = await maker('post', '/commission/referrer-accounts').send({ name: 'Bank File Referrer', type: 'Agent', level: 'L1', bankName: 'BDO', bankAccountNo: '009988776655' });
    const ref = c.body.data.referrer.id;
    await admin('put', '/settings').send({ settings: { 'commission.auto_eligible_on_full_payment': false } });
    const pol = await makePolicy({ net: 40000, details: { commissionDetails: { brokeragePct: 18, primary: { referrerId: ref, level: 'L1', comsubPct: 8, comsubFixed: 0 }, chain: [] } } });
    expect((await maker('post', '/commission/accrue').send({ policyId: pol.policy.id })).status).toBe(201);
    expect((await maker('post', '/receipts').send({ policyId: pol.policy.id, amount: pol.gross })).status).toBe(201);
    expect((await maker('post', `/commission/referrer-accounts/${ref}/mark-eligible`)).status).toBe(200);
    expect((await checker('post', `/commission/referrer-accounts/${ref}/approve`)).status).toBe(200);
    const payout = (await maker('post', '/disbursements/bulk-agent-disburse').send({ referrerIds: [ref], transactionCode: 'COMSUB', instrumentCurrency: 'PHP' })).body.data.vouchers[0];
    await admin('put', '/settings').send({ settings: { 'commission.auto_eligible_on_full_payment': true } });
    // a client refund without a bank account cannot go on a batch
    const refund = (await maker('post', '/disbursements').send({ payeeType: 'Customer', customerCode: m.client.client_code, amount: '1500.00', transactionDescription: 'Refund' })).body.data;
    await maker('put', `/disbursements/${refund.disbursementId}`).send({ status: 'for-approval' });

    const eligible = (await maker('get', '/bank-payments/eligible-vouchers')).body.data;
    expect(eligible.find((v) => v.disbursementId === rem.disbursementId)).toMatchObject({ ready: true, bankCode: 'MBT' });
    expect(eligible.find((v) => v.disbursementId === payout.disbursementId)).toMatchObject({ ready: true, bankCode: 'BDO', accountNumber: '009988776655' });
    expect(eligible.find((v) => v.disbursementId === refund.disbursementId)).toMatchObject({ ready: false });
    const refused = await maker('post', '/bank-payments/batches').send({ layoutCode: 'BDO-BULK', bankAccountCode: 'ACC-BDO-001', channel: 'pesonet', disbursementIds: [refund.disbursementId] });
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body.errors)).toMatch(/no bank account on file/);
    const insta = await maker('post', '/bank-payments/batches').send({ layoutCode: 'BDO-BULK', bankAccountCode: 'ACC-BDO-001', channel: 'instapay', disbursementIds: [rem.disbursementId] });
    expect(insta.status).toBe(400);
    expect(JSON.stringify(insta.body.errors)).toMatch(/InstaPay limit/);

    const valueDate = await today();
    const cr = await maker('post', '/bank-payments/batches').send({ layoutCode: 'BDO-BULK', bankAccountCode: 'ACC-BDO-001', channel: 'pesonet', valueDate, disbursementIds: [rem.disbursementId, payout.disbursementId] });
    expect(cr.status).toBe(201);
    const batch = cr.body.data;
    expect(batch).toMatchObject({ status: 'draft', lineCount: 2 });
    expect((await maker('post', '/bank-payments/batches').send({ layoutCode: 'BDO-BULK', bankAccountCode: 'ACC-BDO-001', channel: 'pesonet', disbursementIds: [rem.disbursementId] })).status).toBe(400);
    expect((await maker('post', `/bank-payments/batches/${batch.id}/generate`)).status).toBe(409);
    expect((await maker('post', `/bank-payments/batches/${batch.id}/submit`)).status).toBe(200);
    expect((await maker('post', `/bank-payments/batches/${batch.id}/approve`)).status).toBe(403);
    expect((await checker('post', `/bank-payments/batches/${batch.id}/approve`)).body.data.status).toBe('approved');
    const gen = await maker('post', `/bank-payments/batches/${batch.id}/generate`);
    expect(gen.body.data.status).toBe('file-generated');
    const file = await maker('get', `/bank-payments/batches/${batch.id}/file`);
    expect(file.status).toBe(200);
    const lines = file.text.split('\r\n').filter(Boolean);
    expect(lines[0]).toMatch(/^H,/);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain(rem.voucherNumber);
    expect((await msgRow(gen.body.data.outboxId)).status).toBe('sent');
    expect((await maker('post', `/bank-payments/batches/${batch.id}/sent`)).body.data.status).toBe('sent');

    const remAmount = gen.body.data.lines.find((l) => l.voucherNumber === rem.voucherNumber).amount;
    const status = `Reference,Status,Bank Reference,Remarks,Amount\r\n${rem.voucherNumber},SUCCESS,PN-REF-1,,${remAmount.toFixed(2)}\r\n${payout.voucherNumber},RETURNED,,Account closed,\r\nPV-UNKNOWN,SUCCESS,,,\r\n`;
    const imp = await maker('post', `/bank-payments/batches/${batch.id}/status-file`).attach('file', Buffer.from(status), 'status.csv');
    expect(imp.status, JSON.stringify(imp.body)).toBe(200);
    expect(imp.body.data.outcome).toMatchObject({ applied: 2, paid: 1, rejected: 1 });
    expect(imp.body.data.outcome.skipped).toEqual([{ reference: 'PV-UNKNOWN', reason: 'not on this batch' }]);
    expect(imp.body.data.batch.status).toBe('completed');
    const paidLine = imp.body.data.batch.lines.find((l) => l.voucherNumber === rem.voucherNumber);
    expect(paidLine).toMatchObject({ status: 'paid', bankReference: 'PN-REF-1', resultSource: 'file' });
    const jl = (await query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [paidLine.journalId])).rows;
    expect(jl.find((l) => Number(l.credit) > 0).account_code).toBe('1102001');
    expect(await one('SELECT status FROM disbursements WHERE id = $1', [rem.disbursementId])).toEqual({ status: 'paid' });
    expect(await one('SELECT status FROM disbursements WHERE id = $1', [payout.disbursementId])).toEqual({ status: 'for-approval' });
    expect((await one("SELECT * FROM integration_inbox WHERE message_type = 'bank.status_file' ORDER BY id DESC LIMIT 1")).status).toBe('processed');

    // the rejected payout goes on a new batch; its result is entered by hand
    const b2 = (await maker('post', '/bank-payments/batches').send({ layoutCode: 'GENERIC-CSV', bankAccountCode: 'ACC-BDO-001', channel: 'instapay', disbursementIds: [payout.disbursementId] })).body.data;
    await maker('post', `/bank-payments/batches/${b2.id}/submit`);
    await checker('post', `/bank-payments/batches/${b2.id}/approve`);
    await maker('post', `/bank-payments/batches/${b2.id}/generate`);
    const line = b2.lines[0];
    expect((await maker('post', `/bank-payments/batches/${b2.id}/lines/${line.id}/result`).send({ status: 'rejected' })).status).toBe(400);
    const res = await maker('post', `/bank-payments/batches/${b2.id}/lines/${line.id}/result`).send({ status: 'paid', bankReference: 'IP-998' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.batch.status).toBe('completed');
    expect(await one('SELECT status FROM disbursements WHERE id = $1', [payout.disbursementId])).toEqual({ status: 'paid' });
    expect((await one("SELECT count(*)::int AS n FROM commissions WHERE disbursement_id = $1 AND status = 'Paid'", [payout.disbursementId])).n).toBeGreaterThan(0);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
    const audits = (await query("SELECT action FROM audit_log WHERE entity = 'bank_payment_batch' AND entity_id = $1", [batch.id])).rows.map((r) => r.action);
    expect(audits).toEqual(expect.arrayContaining(['create', 'submit', 'approve', 'generate', 'download-file', 'sent', 'status-file']));
  });

  it('payee bank accounts: one default per payee, unknown bank refused', async () => {
    const ins = await one("SELECT id FROM insurance_companies WHERE code = 'STANDARD'");
    expect((await maker('post', '/bank-payments/payee-accounts').send({ payeeType: 'Insurer', payeeId: String(ins.id), bankCode: 'NOPE', accountNumber: '1234567', accountName: 'Standard' })).status).toBe(400);
    const a = await maker('post', '/bank-payments/payee-accounts').send({ payeeType: 'Insurer', payeeId: 'STANDARD', bankCode: 'BPI', accountNumber: '1234 5678 90', accountName: 'Standard Insurance' });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ payeeId: String(ins.id), payeeName: 'Standard Insurance Co., Inc.', isDefault: true });
    const b = await maker('post', '/bank-payments/payee-accounts').send({ payeeType: 'Insurer', payeeId: String(ins.id), bankCode: 'BDO', accountNumber: '99887766', accountName: 'Standard Insurance' });
    const list = (await maker('get', '/bank-payments/payee-accounts?payeeType=Insurer')).body.data.filter((x) => x.payeeId === String(ins.id));
    expect(list.filter((x) => x.isDefault).map((x) => x.id)).toEqual([b.body.data.id]);
  });
});
