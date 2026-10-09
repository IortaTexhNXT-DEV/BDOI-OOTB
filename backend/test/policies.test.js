import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let sales;
let claims;
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('p.sales', ['sales']);
  claims = await persona('p.claims', ['claims']);
});
afterAll(async () => { await pool.end(); });

describe('policies', () => {
  it('lists with paging and filters', async () => {
    const r = await sales('get', '/policies?page=1&pageSize=5');
    expect(r.body.data.length).toBe(5);
    expect(r.body.total).toBeGreaterThanOrEqual(8);
    const byQuote = await sales('get', '/policies?quoteRefId=qt_sls_01');
    expect(byQuote.body.data[0].policyId).toBe('pol_sls_01');
    expect(byQuote.body.data[0].client.clientId).toBe('cl_sls_01');
    const paid = await sales('get', '/policies?paymentStatus=Completed&pageSize=50');
    expect(paid.body.data.every((p) => p.paymentStatus === 'Completed')).toBe(true);
    const client = await sales('get', '/policies?clientId=cl_sls_04');
    expect(client.body.data.map((p) => p.policyId)).toEqual(['pol_sls_04']);
    const accident = await sales('get', '/policies?lob=ACCIDENT&pageSize=50');
    expect(accident.body.data.length).toBeGreaterThanOrEqual(2);
    expect(accident.body.data.every((p) => p.lob === 'ACCIDENT')).toBe(true);
    const search = await sales('get', '/policies?query=NBC%201452');
    expect(search.body.data[0].policyId).toBe('pol_sls_01');
    const range = await sales('get', `/policies?expiryDateFrom=${new Date(Date.now() + 400 * 86400000).toISOString()}`);
    expect(range.body.total).toBe(0);
  });
  it('reads one policy with client, lead and quotation', async () => {
    const r = await sales('get', '/policies/pol_sls_01');
    expect(r.body).toMatchObject({ policyId: 'pol_sls_01', status: 'Active', paymentStatus: 'Completed', lob: 'MOTOR' });
    expect(r.body.quotation.quotationNumber).toMatch(/^QT-/);
    expect(r.body.lead.leadId).toBe('ld_sls_01');
    expect(r.body.insuranceCompanyName).toBe('Pioneer Insurance & Surety Corp.');
    expect((await sales('get', '/policies/pol_missing')).status).toBe(404);
  });
  it('updates policy details and payment status', async () => {
    const u = await sales('put', '/policies/pol_sls_05').send({ policyNumber: 'FPG-MC-2026-0005', plateNumber: 'NEF 5511', inception: '2026-06-01', expiry: '2027-06-01', paymentStatus: 'Pending' });
    expect(u.status).toBe(200);
    expect(u.body).toMatchObject({ policyNumber: 'FPG-MC-2026-0005', plateNumber: 'NEF 5511', inception: '2026-06-01', expiry: '2027-06-01' });
    expect((await sales('put', '/policies/pol_sls_07').send({ policyNumber: 'FPG-MC-2026-0005' })).status).toBe(409);
    // a policy editor cannot mark the premium paid: only finance sets the payment status
    expect((await sales('patch', '/policies/pol_sls_05/payment-status').send({ paymentStatus: 'Completed', paymentMethod: 'GCash' })).status).toBe(403);
    expect((await sales('put', '/policies/pol_sls_05').send({ paymentStatus: 'Completed' })).status).toBe(403);
    const p = await ctx.api('patch', '/policies/pol_sls_05/payment-status').send({ paymentStatus: 'Completed', paymentMethod: 'GCash' });
    expect(p.body).toMatchObject({ paymentStatus: 'Completed', paymentMethod: 'GCash' });
    expect(p.body.paidAt).toBeTruthy();
    expect((await ctx.api('patch', '/policies/pol_sls_05/payment-status').send({ paymentStatus: 'Maybe' })).status).toBe(400);
    const audit = await pool.query("SELECT action FROM audit_log WHERE entity = 'policy' AND entity_id = 'pol_sls_05'");
    expect(audit.rows.map((a) => a.action)).toEqual(expect.arrayContaining(['update', 'payment-status']));
  });
  it('lists documents and renders PDFs', async () => {
    const docs = await sales('get', '/policies/pol_sls_06/documents');
    expect(docs.body.data.generated.map((g) => g.type)).toEqual(expect.arrayContaining(['policy-schedule', 'insurance-placing-slip']));
    for (const path of ['/policies/pol_sls_06/documents/insurance-placing-slip-fire', '/document-templates/policy-schedule-fire/pol_sls_06', '/document-templates/policy-schedule/pol_sls_01', '/document-templates/receipt/or_sls_01']) {
      const r = await sales('get', path).buffer(true).parse(binary);
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('application/pdf');
      expect(r.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(r.body.toString('latin1')).toContain('%%EOF');
    }
  });
  it('bulk uploads policies with client, receivable and commission', async () => {
    const csv = 'Policy Number,Insured Name,Email,Product,Insurance Company,Inception Date,Expiry Date,Sum Insured,Net Premium,Gross Premium\n'
      + 'UPL-0001,Rosa Villanueva,rosa@example.ph,Motor,MAPFRE,2026-09-01,2027-09-01,800000,12000,15030\nUPL-0002,No Premium,,Motor,MAPFRE,2026-09-01,2027-09-01,1,,\n';
    const r = await sales('post', '/policies/bulk-upload').attach('file', Buffer.from(csv), 'policies.csv');
    expect(r.body.data).toMatchObject({ created: 1, failed: 1 });
    const p = await sales('get', '/policies?query=UPL-0001');
    expect(p.body.data[0].billNumber).toMatch(/^INV-/);
    const cm = await pool.query('SELECT amount FROM commissions WHERE policy_id = $1', [p.body.data[0].policyId]);
    expect(Number(cm.rows[0].amount)).toBeCloseTo(12000 * 0.15, 2);
  });
  it('enforces permissions', async () => {
    expect((await claims('get', '/policies/pol_sls_01')).status).toBe(200);
    expect((await claims('put', '/policies/pol_sls_01').send({ plateNumber: 'x' })).status).toBe(403);
    expect((await claims('patch', '/policies/pol_sls_01/payment-status').send({ paymentStatus: 'Completed' })).status).toBe(403);
  });
});
