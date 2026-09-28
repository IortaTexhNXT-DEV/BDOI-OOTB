import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let sales;
let uw;
let claims;
let finance;
let underwriterId;
let salesId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}

beforeAll(async () => {
  ctx = await setup();
  const s = await persona('t.sales', ['sales']);
  const u = await persona('t.uw', ['underwriting']);
  sales = s.api; salesId = s.id; uw = u.api; underwriterId = u.id;
  claims = (await persona('t.claims', ['claims'])).api;
  finance = (await persona('t.finance', ['finance'])).api;
});
afterAll(async () => { await pool.end(); });

describe('quotations: create, premium, workflow, conversion', () => {
  let leadId;
  let quoteId;
  let token;
  let policyId;

  it('creates a quotation with a server-side premium breakdown from settings', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Lara', lastName: 'Quimpo', emailId: 'lara.quimpo@example.ph', contactNumber: '09170000001', leadCategory: 'Retail' });
    expect(lead.status).toBe(201);
    leadId = lead.body.leadId;
    const r = await sales('post', '/quotations').send({
      leadRefId: leadId, productType: 'Motor', insurancePolicyType: 'PC', lossAndDamageCoverage: '1,000,000', lossAndDamageCoverageRate: '1.5', actsOfNatureRate: '0.5',
      bodilyInjury: '200000', propertyDamage: '200000', APPAtotalCoverage: '250000', participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }],
      insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelYear: '2025' }], quotationStatus: 'Approved',
    });
    expect(r.status).toBe(201);
    expect(r.body.quotationId).toMatch(/^qt_/);
    expect(r.body.quotationNumber).toMatch(/^QT-\d{4}-\d{5}$/);
    expect(r.body.quotationStatus).toBe('Draft');
    // 15,000 + 5,000 + BI 2,000 + PD 2,000 + APPA 1,250 (default rates from settings)
    expect(r.body.netPremium).toBe(25250);
    const [vat, dst, lgt] = await Promise.all(['vat', 'dst', 'lgt'].map(async (k) => Number((await q("SELECT value#>>'{}' AS v FROM app_settings WHERE key = $1", [`tax.${k}_rate`]))[0].v)));
    expect(r.body.grossPremium).toBeCloseTo(25250 * (1 + vat + dst + lgt), 1);
    expect(r.body.insuranceCompanyName).toBe('Malayan Insurance Co., Inc.');
    expect(r.body.commissionAmount).toBeCloseTo(25250 * 0.15, 2);
    quoteId = r.body.quotationId;
    const l = await sales('get', `/leads/${leadId}`);
    expect(l.body.status).toBe('QuoteGenerated');
    expect(l.body.quotationsCount).toBe(1);
  });

  it('rejects a quotation without a lead and blocks personas without the permission', async () => {
    expect((await sales('post', '/quotations').send({ productType: 'Motor' })).status).toBe(400);
    expect((await claims('post', '/quotations').send({ leadRefId: leadId })).status).toBe(403);
    expect((await finance('get', '/quotations')).status).toBe(403);
  });

  it('reads back, lists, searches and updates (premium recalculated)', async () => {
    const one = await sales('get', `/quotations/${quoteId}`);
    expect(one.body.lead.firstName).toBe('Lara');
    expect(one.body.data.quotationId).toBe(quoteId);
    const list = await sales('get', `/quotations?page=1&pageSize=5&leadRefId=${leadId}`);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0].quotationId).toBe(quoteId);
    const search = await sales('get', `/quotations?search=${one.body.quotationNumber}`);
    expect(search.body.data.map((x) => x.quotationId)).toContain(quoteId);
    const upd = await sales('put', `/quotations/${quoteId}`).send({ discount: '1000', remarks: 'Loyalty' });
    expect(upd.status).toBe(200);
    expect(upd.body.grossPremium).toBeCloseTo(one.body.grossPremium - 1000, 2);
    expect(upd.body.remarks).toBe('Loyalty');
    const trail = await sales('get', `/quotations/audit-trail/${quoteId}?sort=asc`);
    expect(trail.body.data.some((x) => x.action === 'update' && x.field === 'discount')).toBe(true);
  });

  it('calculates premiums and serves the quote-wizard masters', async () => {
    const c = await sales('post', '/quotations/calculate-premium').send({ productType: 'Fire and Allied Perils', firePremiumDetails: { totalCoverPremium: 10000 } });
    expect(c.body.data.lob).toBe('FIRE');
    expect(c.body.data.fireServiceTax).toBeGreaterThan(0);
    const brands = await sales('get', '/master/vehicle/get-brands');
    expect(brands.body.data.map((b) => b.name)).toContain('Toyota');
    const models = await sales('get', '/master/vehicle/get-models?brand=Toyota');
    expect(models.body.data.map((m) => m.name)).toContain('Vios');
    const variants = await sales('get', '/master/vehicle/get-variants?model=Vios');
    expect(variants.body.data[0].seatingCapacity).toBe(5);
    const bi = await sales('get', '/biCoverage/get-bi-coverage?PolicyTypeId=COMP');
    expect(bi.body.data.length).toBeGreaterThan(0);
    const ins = await sales('get', '/master/insurancecompany/get-insurance-companies');
    expect(ins.body.data.map((i) => i.name)).toContain('SecureGuard Insurance');
    expect((await sales('get', '/master/banks/get-all-banks')).body.data.length).toBeGreaterThan(0);
    expect((await sales('get', '/master/signatory/get-all-signatory')).body.data.length).toBeGreaterThan(0);
  });

  it('sends for approval: e-mail with signed link, underwriting notified, PendingCustomer', async () => {
    const r = await sales('post', `/quotations/${quoteId}/send-for-approval`).send({ sentBy: 'agent' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.sentTo).toBe('lara.quimpo@example.ph');
    expect(r.body.data.quotationStatus).toBe('PendingCustomer');
    token = new URL(r.body.approvalUrl).searchParams.get('token');
    const mail = await q("SELECT * FROM email_outbox WHERE entity = 'quotation' AND entity_id = $1 AND template = 'quote_approval'", [quoteId]);
    expect(mail[0].to_address).toBe('lara.quimpo@example.ph');
    expect(mail[0].body_html).toContain('/approve-quote?token=');
    const n = await q('SELECT * FROM notifications WHERE user_id = $1 AND entity_id = $2', [underwriterId, quoteId]);
    expect(n.some((x) => x.type === 'approval')).toBe(true);
  });

  it('public approve-by-customer: preview, accept, invalid token', async () => {
    expect((await request(ctx.app).post('/api/quotations/approve-by-customer').send({ token: 'not-a-valid-token' })).status).toBe(400);
    const preview = await request(ctx.app).post('/api/quotations/approve-by-customer').send({ token, preview: true });
    expect(preview.body.success).toBe(true);
    expect(preview.body.quotationStatus).toBe('PendingCustomer');
    expect(preview.body.lead.emailId).toBe('lara.quimpo@example.ph');
    const ok = await request(ctx.app).post('/api/quotations/approve-by-customer').send({ token });
    expect(ok.body.quotationStatus).toBe('CustomerAccepted');
    const owner = await q('SELECT title FROM notifications WHERE user_id = $1 AND entity_id = $2', [salesId, quoteId]);
    expect(owner.some((x) => x.title === 'Customer accepted quotation')).toBe(true);
  });

  it('submits to the insurer, enforces maker-checker on approval and the transition map', async () => {
    const s = await sales('post', `/quotations/${quoteId}/submit-to-insurer`).send({ submittedBy: 'agent' });
    expect(s.body.data.quotationStatus).toBe('SubmittedToInsurer');
    expect((await q("SELECT to_address FROM email_outbox WHERE template = 'insurer_submission' AND entity_id = $1", [quoteId]))[0].to_address).toBe('uw@malayan.example');
    const self = await sales('put', `/quotations/${quoteId}/status`).send({ status: 'Approved', updatedBy: 'agent' });
    expect(self.status).toBe(403);
    const approved = await uw('patch', `/quotations/${quoteId}/status`).send({ status: 'Approved' });
    expect(approved.status).toBe(200);
    expect(approved.body.quotationStatus).toBe('Approved');
    expect(approved.body.approvedBy).toBe(underwriterId);
    expect((await uw('put', `/quotations/${quoteId}/status`).send({ status: 'Draft' })).status).toBe(400);
    expect((await uw('put', `/quotations/${quoteId}/status`).send({ status: 'Nonsense' })).status).toBe(400);
  });

  it('refuses to issue a motor policy without KYC and vehicle identifiers (policy.kyc_required_fields)', async () => {
    const r = await sales('post', `/quotations/${quoteId}/convert-to-policy`).send({ additionalPolicyData: { insuredName: 'Lara Quimpo', inception: '2026-10-01' } });
    expect(r.status).toBe(400);
    const missing = r.body.errors.map((e) => e.message);
    expect(missing).toEqual(['ID type', 'ID number', 'ID card image', 'Chassis number', 'Motor / engine number', 'Plate number or MV file number']);
    expect(r.body.message).toContain('Missing: ID type; ID number');
    // an ID document outside policy.kyc_id_types is refused; an MV file number stands in for a plate (new vehicle)
    await sales('patch', `/quotations/${quoteId}/vehicle-info`).send({ idType: 'Library card', idCardNumber: 'X-1', idCardImage: 'id-cards/lara.jpg', chassisNumber: 'MHFXW42G5P0012345', motorNumber: '2NRX123456', MvFileNumber: '1301-00000012345' });
    const bad = await sales('post', `/quotations/${quoteId}/convert-to-policy`).send({ additionalPolicyData: { insuredName: 'Lara Quimpo' } });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((e) => e.message).join()).toContain('Library card');
    expect((await q('SELECT count(*)::int AS n FROM policies WHERE quote_id = $1', [quoteId]))[0].n).toBe(0);
    // the required set is configuration: an empty list for MOTOR switches the check off
    const { requiredKycFor } = await import('../src/modules/policies/kyc.js');
    expect(await requiredKycFor('FIRE')).toEqual([]);
    await sales('patch', `/quotations/${quoteId}/vehicle-info`).send({ idType: 'PhilSys ID', idCardNumber: '1234-5678-9012-3456' });
  });

  it('converts to policy: client, policy, receivable with bill number, commission accrual, owner notified', async () => {
    const r = await sales('post', `/quotations/${quoteId}/convert-to-policy`).send({ additionalPolicyData: { insuredName: 'Lara Quimpo', plateNumber: 'NQQ 2025', inception: '2026-10-01', paymentStatus: 'Pending', paymentMethod: 'Direct Debit' }, createdBy: 'agent' });
    expect(r.status).toBe(201);
    const { policy, client } = r.body.data;
    policyId = policy.policyId;
    expect(policy.policyNumber).toMatch(/^POL-\d{4}-\d{5}$/);
    expect(policy.billNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(policy.inception).toBe('2026-10-01');
    expect(policy.expiry).toBe('2027-10-01');
    expect(policy.plateNumber).toBe('NQQ 2025');
    expect(policy.quotation.quotationStatus).toBe('ConvertedToPolicy');
    expect(client.clientId).toBe(policy.clientId);
    expect(client.generatedClientId).toMatch(/^CL-/);
    const [rcv] = await q('SELECT * FROM receivables WHERE policy_id = $1', [policyId]);
    expect(Number(rcv.amount)).toBeCloseTo(policy.grossPremium, 2);
    expect(rcv.bill_number).toBe(policy.billNumber);
    // issuance leaves the bill open: no receipt, payment status Pending
    expect(rcv.status).toBe('open');
    expect(Number(rcv.balance)).toBeCloseTo(Number(rcv.amount), 2);
    expect(policy.paymentStatus).toBe('Pending');
    expect((await q('SELECT count(*)::int AS n FROM receipts WHERE policy_id = $1', [policyId]))[0].n).toBe(0);
    expect(policy.chassisNumber).toBe('MHFXW42G5P0012345');
    const [cm] = await q('SELECT * FROM commissions WHERE policy_id = $1', [policyId]);
    expect(Number(cm.amount)).toBeCloseTo(policy.netPremium * 0.15, 2);
    expect(cm.agent_user_id).toBe(salesId);
    expect(Number(cm.withholding)).toBeGreaterThan(0);
    const n = await q('SELECT title FROM notifications WHERE user_id = $1 AND entity_id = $2', [salesId, policyId]);
    expect(n.some((x) => x.title === 'Policy issued')).toBe(true);
    expect((await sales('get', `/leads/${leadId}`)).body.status).toBe('Converted');
    const again = await sales('post', `/quotations/${quoteId}/convert-to-policy`).send({ additionalPolicyData: { paymentStatus: 'Completed' } });
    expect(again.status).toBe(200);
    expect(again.body.data.policy.policyId).toBe(policyId);
    expect(again.body.data.policy.paymentStatus).toBe('Completed');
    expect((await q('SELECT count(*)::int AS n FROM policies WHERE quote_id = $1', [quoteId]))[0].n).toBe(1);
  });

  it('refuses to convert or delete quotations in the wrong status', async () => {
    const draft = await sales('post', '/quotations').send({ leadRefId: leadId, productType: 'Motor', netPremium: '5000' });
    expect((await sales('post', `/quotations/${draft.body.quotationId}/convert-to-policy`).send({})).status).toBe(400);
    expect((await sales('delete', `/quotations/${quoteId}`)).status).toBe(400);
    expect((await sales('put', `/quotations/${quoteId}`).send({ discount: '1' })).status).toBe(400);
    const del = await sales('delete', `/quotations/${draft.body.quotationId}`);
    expect(del.status).toBe(200);
    expect((await sales('get', `/quotations/${draft.body.quotationId}`)).status).toBe(404);
  });

  it('stats, compare, vehicle info, quote PDF and customer e-mail', async () => {
    const stats = await sales('get', '/quotations/stats');
    expect(stats.body.totalQuotations).toBeGreaterThan(10);
    expect(stats.body.quotationsByStatus.find((s) => s.status === 'ConvertedToPolicy').count).toBeGreaterThan(0);
    const compare = await sales('get', `/quotations/compare?quotationId1=${quoteId}&quotationId2=qt_sls_09`);
    expect(compare.body.quotation1.quotationId).toBe(quoteId);
    expect(compare.body.aiInsights.pricingAnalysis.quote2Total).toBeGreaterThan(0);
    const v = await sales('patch', '/quotations/qt_sls_13/vehicle-info').send({ plateNumber: 'NKL 9999', chassisNumber: 'CH-1', updatedBy: 'agent' });
    expect(v.body.plateNumber).toBe('NKL 9999');
    const pdf = await sales('get', `/document-templates/quote-template/${quoteId}`).buffer(true).parse((res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    const mail = await sales('post', `/quotations/${quoteId}/send-mail-policy-quote/customer?policyId=${policyId}`);
    expect(mail.body.data.to).toBe('lara.quimpo@example.ph');
  });

  it('e-mail endpoints: generate, send, share quote, share to insurers (partial)', async () => {
    const g = await sales('post', '/email/generate').send({ template: 'custom', context: { quotationNumber: 'QT-X', productType: 'Motor', grossPremium: 1000 }, recipient: { name: 'Lara' } });
    expect(g.body.data.subject).toContain('QT-X');
    expect(g.body.data.html).toContain('Lara');
    const s = await sales('post', '/email/send').send({ to: 'lara.quimpo@example.ph', subject: 'Hello', html: '<p>Hi</p>', quotationId: quoteId });
    expect(s.body.data.emailId).toBeTruthy();
    expect((await sales('post', '/email/send').send({ to: 'not-an-email', subject: 'x' })).status).toBe(400);
    const share = await sales('post', '/email/share-quote').send({ to: 'friend@example.ph', quotationData: { quotationId: quoteId }, message: 'FYI' });
    expect(share.body.success).toBe(true);
    const ins = await sales('post', '/email/share-quote-to-insurers').send({ quotationId: quoteId, insuranceCompanies: ['SecureGuard Insurance', 'Unknown Mutual'] });
    expect(ins.body.partial).toBe(true);
    expect(ins.body.data.sent[0].email).toBe('placement@secureguard.example');
    expect(ins.body.data.failed[0].insurer).toBe('Unknown Mutual');
  });

  it('bulk uploads quotations from CSV', async () => {
    const csv = 'Lead Id,First Name,Last Name,Email,Product Type,Sum Insured,Own Damage,Rate,Insurance Company\n,Noel,Cabrera,noel@example.ph,Motor,900000,900000,1.8,Pioneer\n,,,,,,,,\nld_missing,,,,Motor,,,,\n';
    const r = await sales('post', '/quotations/bulk-upload').attach('file', Buffer.from(csv), 'quotes.csv');
    expect(r.status).toBe(200);
    expect(r.body.data.created).toBe(1);
    expect(r.body.data.failed).toBe(1);
    const created = await q("SELECT premium_base FROM quotes q JOIN leads l ON l.id = q.lead_id WHERE l.email = 'noel@example.ph'");
    expect(Number(created[0].premium_base)).toBeGreaterThanOrEqual(16200);
  });
});
