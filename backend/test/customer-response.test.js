import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, enableFeatures } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { today } from '../src/lib/dates.js';

let ctx;
let sales;
let claims;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const PDF = Buffer.from('%PDF-1.4 signed quotation acceptance');

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

/** A Draft Fire quotation for a new lead (with or without an e-mail address). */
async function draftQuote(email = 'resp.customer@example.ph') {
  const lead = await sales('post', '/leads').send({ firstName: 'Rosa', lastName: 'Villanueva', ...(email ? { emailId: email } : {}), contactNumber: '09170000077', leadCategory: 'Retail' });
  expect(lead.status).toBe(201);
  const r = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Fire and Allied Perils', totalSumInsured: 2000000, netPremium: 5000 });
  expect(r.status).toBe(201);
  return r.body.quotationId;
}

beforeAll(async () => {
  ctx = await setup();
  // the online approval of a quotation by the client is a later release (modules/features), enabled as the platform administrators do
  await enableFeatures(ctx.app, ['quote-online-approval']);
  sales = await persona('cr.sales', ['sales']);
  claims = await persona('cr.claims', ['claims']);
});
afterAll(async () => { await pool.end(); });

describe('send for customer approval without e-mail', () => {
  it('moves to PendingCustomer and says plainly that e-mail is not configured', async () => {
    const id = await draftQuote();
    const r = await sales('post', `/quotations/${id}/send-for-approval`).send({});
    expect(r.status).toBe(200);
    expect(r.body.data.quotationStatus).toBe('PendingCustomer');
    expect(r.body.emailSending).toBe(false);
    expect(r.body.emailQueued).toBe(true);
    expect(r.body.message).toMatch(/not configured/);
    expect(r.body.approvalUrl).toContain('/approve-quote?token=');
  });

  it('accepts a customer without an e-mail address while sending is off', async () => {
    const id = await draftQuote(null);
    const r = await sales('post', `/quotations/${id}/send-for-approval`).send({});
    expect(r.status).toBe(200);
    expect(r.body.sentTo).toBeNull();
    expect(r.body.emailQueued).toBe(false);
    expect((await q("SELECT count(*)::int AS n FROM email_outbox WHERE entity_id = $1", [id]))[0].n).toBe(0);
  });
});

describe('approval link', () => {
  it('returns the current link again, so the e-mailed one keeps working', async () => {
    const id = await draftQuote();
    const sent = await sales('post', `/quotations/${id}/send-for-approval`).send({});
    const link = await sales('get', `/quotations/${id}/approval-link`);
    expect(link.status).toBe(200);
    expect(link.body.data.approvalUrl).toBe(sent.body.approvalUrl);
    expect(link.body.data.reissued).toBe(false);
    const token = new URL(link.body.data.approvalUrl).searchParams.get('token');
    const ok = await request(ctx.app).post('/api/quotations/approve-by-customer').send({ token });
    expect(ok.body.quotationStatus).toBe('CustomerAccepted');
  });

  it('issues a new link when the stored one is gone and refuses a quotation that is not pending', async () => {
    const id = await draftQuote();
    expect((await sales('get', `/quotations/${id}/approval-link`)).status).toBe(400);
    await sales('post', `/quotations/${id}/send-for-approval`).send({});
    await q('UPDATE quotes SET approval_token = NULL WHERE id = $1', [id]);
    const link = await sales('get', `/quotations/${id}/approval-link`);
    expect(link.body.data.reissued).toBe(true);
    const audit = await q("SELECT 1 FROM audit_log WHERE entity = 'quotation' AND entity_id = $1 AND action = 'approval-link'", [id]);
    expect(audit.length).toBe(1);
  });
});

describe('record customer response', () => {
  it('validates the evidence: channel, date, reference or remarks', async () => {
    const id = await draftQuote();
    await sales('post', `/quotations/${id}/send-for-approval`).send({});
    const base = { outcome: 'accepted', channel: 'Phone', responseDate: await today(), remarks: 'Called back' };
    expect((await sales('post', `/quotations/${id}/customer-response`).send({ ...base, channel: '' })).status).toBe(400);
    expect((await sales('post', `/quotations/${id}/customer-response`).send({ ...base, channel: 'Carrier pigeon' })).status).toBe(400);
    expect((await sales('post', `/quotations/${id}/customer-response`).send({ ...base, remarks: '' })).status).toBe(400);
    expect((await sales('post', `/quotations/${id}/customer-response`).send({ ...base, responseDate: '2999-01-01' })).status).toBe(400);
    expect((await sales('post', `/quotations/${id}/customer-response`).send({ ...base, outcome: 'maybe' })).status).toBe(400);
    expect((await sales('post', `/quotations/${id}/customer-response`).send({ ...base, attachmentKey: 'quotation-responses/missing.pdf' })).status).toBe(400);
    expect((await claims('post', `/quotations/${id}/customer-response`).send(base)).status).toBe(403);
    expect((await q('SELECT status FROM quotes WHERE id = $1', [id]))[0].status).toBe('sent');
  });

  it('accepted: CustomerAccepted with the evidence stored, audited and listed', async () => {
    const id = await draftQuote();
    await sales('post', `/quotations/${id}/send-for-approval`).send({});
    const up = await sales('post', '/s3/upload').field('folder', 'quotation-responses').attach('file', PDF, 'signed-acceptance.pdf');
    expect(up.status).toBe(200);
    const r = await sales('post', `/quotations/${id}/customer-response`).send({
      outcome: 'accepted', channel: 'Signed form', responseDate: await today(), reference: 'SF-0042', attachmentKey: up.body.key, attachmentName: 'signed-acceptance.pdf',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.quotationStatus).toBe('CustomerAccepted');
    expect(r.body.data.customerAcceptedAt).toBeTruthy();
    expect(r.body.response).toMatchObject({ outcome: 'accepted', channel: 'Signed form', reference: 'SF-0042', fromStatus: 'PendingCustomer', toStatus: 'CustomerAccepted', attachmentKey: up.body.key });
    const audit = await q("SELECT after_data FROM audit_log WHERE entity = 'quotation' AND entity_id = $1 AND action = 'customer-response'", [id]);
    expect(audit[0].after_data).toMatchObject({ quotationStatus: 'CustomerAccepted', channel: 'Signed form', reference: 'SF-0042' });
    const list = await sales('get', `/quotations/${id}/customer-responses`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.channels).toContain('Viber/WhatsApp');
    // a second answer is refused: CustomerAccepted -> CustomerAccepted is not a transition
    expect((await sales('post', `/quotations/${id}/customer-response`).send({ outcome: 'accepted', channel: 'Phone', responseDate: await today(), remarks: 'again' })).status).toBe(400);
  });

  it('declined: Rejected; revise: back to Draft and the old link stops working', async () => {
    const declined = await draftQuote();
    await sales('post', `/quotations/${declined}/send-for-approval`).send({});
    const d = await sales('post', `/quotations/${declined}/customer-response`).send({ outcome: 'declined', channel: 'Meeting', responseDate: await today(), remarks: 'Premium too high' });
    expect(d.body.data.quotationStatus).toBe('Rejected');

    const revise = await draftQuote();
    const sent = await sales('post', `/quotations/${revise}/send-for-approval`).send({});
    const v = await sales('post', `/quotations/${revise}/customer-response`).send({ outcome: 'revise', channel: 'Viber/WhatsApp', responseDate: await today(), reference: 'Asked for a higher deductible' });
    expect(v.body.data.quotationStatus).toBe('Draft');
    const token = new URL(sent.body.approvalUrl).searchParams.get('token');
    expect((await request(ctx.app).post('/api/quotations/approve-by-customer').send({ token })).status).toBe(400);
  });

  it('follows the configured outcome status and the transition map', async () => {
    const id = await draftQuote();
    // a Draft quotation cannot be accepted directly (Draft -> CustomerAccepted is not in quotations.transitions)
    expect((await sales('post', `/quotations/${id}/customer-response`).send({ outcome: 'accepted', channel: 'Phone', responseDate: await today(), remarks: 'yes' })).status).toBe(400);
    const saved = (await q("SELECT value FROM app_settings WHERE key = 'quotations.customer_response_status'"))[0].value;
    await ctx.api('put', '/settings').send({ settings: { 'quotations.customer_response_status': { ...saved, declined: 'Dropped' } } });
    await sales('post', `/quotations/${id}/send-for-approval`).send({});
    const r = await sales('post', `/quotations/${id}/customer-response`).send({ outcome: 'declined', channel: 'Phone', responseDate: await today(), remarks: 'Went elsewhere' });
    expect(r.body.data.quotationStatus).toBe('Dropped');
    await ctx.api('put', '/settings').send({ settings: { 'quotations.customer_response_status': saved } });
  });
});
