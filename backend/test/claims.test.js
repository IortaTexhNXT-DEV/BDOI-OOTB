import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';

let ctx;
const tok = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);

async function makeUser(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status).toBe(201);
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}

beforeAll(async () => {
  ctx = await setup();
  await makeUser('c.maker', ['claims']);
  await makeUser('c.checker', ['claims']);
  await makeUser('s.sales', ['sales']);
  await makeUser('f.finance', ['accounting']);
  // prerequisite rows inserted directly (policy endpoints belong to another module)
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, email, city, state) VALUES
    ('cl_t1','CL-T-1','Test Insured','Test','Insured','insured@example.ph','Makati','Metro Manila'),
    ('cl_t2','CL-T-2','Unpaid Insured',NULL,NULL,'unpaid@example.ph','Cebu City','Cebu')`);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total)
    VALUES ('pol_t1','POL-T-0001','cl_t1',(SELECT id FROM products WHERE code='MOTOR'),(SELECT id FROM insurance_companies WHERE code='MAPFRE'),
            (SELECT id FROM users WHERE username='s.sales'),'active',current_date - 100,current_date + 265,1000000,30000),
           ('pol_t2','POL-T-0002','cl_t2',(SELECT id FROM products WHERE code='MOTOR'),(SELECT id FROM insurance_companies WHERE code='PIONEER'),
            NULL,'active',current_date - 50,current_date + 315,800000,25000)`);
  await query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES
    ('INV-T-1','pol_t1','cl_t1',30000,0,current_date - 70,'paid'), ('INV-T-2','pol_t2','cl_t2',25000,25000,current_date - 20,'open')`);
});
afterAll(async () => { await new Promise((r) => { setTimeout(r, 50); }); await pool.end(); });

const binary = (res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); };
// UTC dates; the business date (Asia/Manila) can already be tomorrow, so report ranges end at daysAgo(-1)
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const register = (who, fields, file = true) => {
  let r = as(who, 'post', '/claims');
  for (const [k, v] of Object.entries(fields)) r = r.field(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  if (file) r = r.attach('claimDocument', Buffer.from('%PDF-1.4 police report'), 'police-report.pdf');
  return r;
};
const base = {
  policyNumber: 'POL-T-0001', policyRefId: 'pol_t1', leadRefId: 'LEAD-001', lob: 'MOTOR', claimStatus: 'Pending', claimType: 'Motor', claimPriority: 'High',
  dateOfIncident: daysAgo(3), timeOfIncident: '08:30', addressOfIncident: 'EDSA', cityOfIncident: 'Makati', provinceOfIncident: 'Metro Manila',
  typeOfIncident: 'Collision', estimatedClaimAmount: 85000, policyInfo: { policyHolderName: 'Test Insured' }, driverDetails: { driverName: 'Juan Driver' },
  thirdPartyDetails: { thirdPartyName: 'Pedro Cruz', thirdPartyContactNumber: '+639170000001' }, emailData: { mailSubject: 'New Claim Notification', write: 'Please see attached.' },
};

describe('claims', () => {
  let claim;
  it('registers a claim (multipart), sends the Preliminary Loss Advice and notifies the handler and policy owner', async () => {
    const r = await register('c.maker', base);
    expect(r.status).toBe(201);
    claim = r.body.data;
    expect(claim.claimNumber).toMatch(/^CLM-\d{4}-\d{5}$/);
    expect(claim.status).toBe('Pending');
    expect(claim.lifecycleStatus).toBe('registered');
    expect(claim.policy.clientId).toBe('cl_t1');
    expect(claim.driverName).toBe('Juan Driver');
    expect(claim.documents.map((d) => d.documentName)).toContain('Claim Document');
    const mail = await one('SELECT * FROM email_outbox WHERE entity = \'claim\' AND entity_id = $1', [claim.id]);
    expect(mail.template).toBe('claim-pla');
    expect(mail.to_address).toBe('uw@mapfre.example');
    expect(mail.cc).toBe('insured@example.ph');
    const owner = await one('SELECT count(*)::int AS n FROM notifications WHERE user_id = (SELECT id FROM users WHERE username = \'s.sales\') AND entity_id = $1', [claim.id]);
    expect(owner.n).toBe(1);
    const h = await one('SELECT count(*)::int AS n FROM claim_history WHERE claim_id = $1', [claim.id]);
    expect(h.n).toBe(1);
  });
  it('reads the claim back and finds it in the list by search and status', async () => {
    const g = await ctx.api('get', `/claims/${claim.id}`);
    expect(g.body.data.policyNumber).toBe('POL-T-0001');
    expect(g.body.data.thirdPartyWitnessDetails[0].name).toBe('Pedro Cruz');
    const l = await ctx.api('get', `/claims?search=${claim.claimNumber}&page=1&pageSize=10`);
    expect(l.body.data.claims.map((c) => c.id)).toEqual([claim.id]);
    expect(l.body.data.pagination.total).toBe(1);
    const byStatus = await ctx.api('get', '/claims?status=Pending&pageSize=100');
    expect(byStatus.body.data.claims.every((c) => c.status === 'Pending')).toBe(true);
    const byClient = await ctx.api('get', '/claims?clientId=cl_t1');
    expect(byClient.body.data.claims).toHaveLength(1);
  });
  it('rejects invalid registrations (validation, loss date outside the period, unpaid premium) and honours the setting', async () => {
    expect((await register('c.maker', { ...base, dateOfIncident: '' }, false)).status).toBe(400);
    const outside = await register('c.maker', { ...base, dateOfIncident: daysAgo(150) }, false);
    expect(outside.status).toBe(422);
    expect(outside.body.errors[0].code).toBe('LOSS_OUTSIDE_PERIOD');
    const unpaid = await register('c.maker', { ...base, policyNumber: 'POL-T-0002', policyRefId: 'POLICY-001', dateOfIncident: daysAgo(2) }, false);
    expect(unpaid.status).toBe(422);
    expect(unpaid.body.errors[0].code).toBe('UNPAID_PREMIUM');
    await ctx.api('put', '/settings').send({ settings: { 'claims.block_unpaid_premium': false } });
    const allowed = await register('c.maker', { ...base, policyNumber: 'POL-T-0002', policyRefId: 'POLICY-001', dateOfIncident: daysAgo(2) }, false);
    expect(allowed.status).toBe(201);
    await ctx.api('put', '/settings').send({ settings: { 'claims.block_unpaid_premium': true } });
  });
  it('moves through review, adjuster report, settlement maker-checker to settled and closed', async () => {
    const s = await as('c.maker', 'put', `/claims/updatestatus/${claim.id}`).send({ claimStatus: 'Processing' });
    expect(s.body.data.status).toBe('Processing');
    const adj = await as('c.maker', 'put', `/claims/${claim.id}`)
      .field('insuranceCompanyClaimNumber', 'MAPFRE-CL-1').field('adjusterName', 'Cordillera Adjusters').field('adjusterStatus', 'Assigned')
      .field('driverName', 'Juan Driver Jr.').field('thirdPartyDetails[thirdPartyName]', 'Pedro Cruz Jr.')
      .field('driverDetails', JSON.stringify({ driverHouseNo: '14 Jupiter St.', driverBarangay: 'Bel-Air', driverCountry: 'Philippines', driverProvince: 'Metro Manila', driverCity: 'Makati', driverZipCode: '1209' }))
      .attach('file', Buffer.from('FIR CONTENT'), 'fir.pdf');
    expect(adj.status).toBe(200);
    // the adjuster screen sends the driver address as driverDetails; it is kept and read back flat
    expect(adj.body.data).toMatchObject({ driverName: 'Juan Driver Jr.', driverHouseNo: '14 Jupiter St.', driverBarangay: 'Bel-Air', driverCountry: 'Philippines', driverProvince: 'Metro Manila', driverCity: 'Makati', driverZipCode: '1209' });
    expect(adj.body.data.adjusterName).toBe('Cordillera Adjusters');
    expect(adj.body.data.thirdPartyWitnessDetails[0].name).toBe('Pedro Cruz Jr.');
    expect(adj.body.data.insuranceCompanyClaimNumber).toBe('MAPFRE-CL-1');
    expect((await as('c.maker', 'put', `/claims/settle/${claim.id}`).field('settlementType', 'Cash').field('settlementAmount', '0')).status).toBe(400);
    const st = await as('c.maker', 'put', `/claims/settle/${claim.id}`).field('settlementType', 'Bank Transfer').field('settlementAmount', '70000')
      .field('settlementIssueDate', daysAgo(0)).field('settlementDate', daysAgo(0)).attach('settlementDocument', Buffer.from('voucher'), 'voucher.pdf');
    expect(st.body.data.status).toBe('Pending Approval');
    expect((await as('c.maker', 'put', `/claims/approve-settlement/${claim.id}`).send({ decision: 'approve' })).status).toBe(403);
    const ap = await as('c.checker', 'put', `/claims/approve-settlement/${claim.id}`).send({ decision: 'approve', approvedAmount: 65000 });
    expect(ap.status).toBe(200);
    expect(ap.body.data.lifecycleStatus).toBe('settled');
    expect(ap.body.data.approvedAmount).toBe(65000);
    expect(ap.body.data.settledAmount).toBe(65000);
    expect((await as('c.maker', 'put', `/claims/${claim.id}`).send({ description: 'late edit' })).status).toBe(409);
    const cl = await as('c.maker', 'put', `/claims/updatestatus/${claim.id}`).send({ claimStatus: 'Closed' });
    expect(cl.body.data.lifecycleStatus).toBe('closed');
    const hist = (await ctx.api('get', `/claims/${claim.id}`)).body.data.history.map((h) => h.status);
    expect(hist).toEqual(['registered', 'in-review', 'pending-approval', 'approved', 'settled', 'closed']);
    expect((await as('c.maker', 'put', `/claims/updatestatus/${claim.id}`).send({ claimStatus: 'Approved' })).status).toBe(409);
  });
  it('rejects a claim and returns the field-level audit trail', async () => {
    const c2 = (await register('c.maker', { ...base, estimatedClaimAmount: 5000 }, false)).body.data;
    const rj = await as('c.maker', 'put', `/claims/rejectclaim/${c2.id}`).send({ reason: 'Excluded peril' });
    expect(rj.body.data.status).toBe('Rejected');
    expect(rj.body.data.rejectedReason).toBe('Excluded peril');
    const trail = await ctx.api('get', `/claims/audit-trail/${claim.id}?sort=asc`);
    expect(trail.body.data[0].action).toBe('Claim Registered');
    expect(trail.body.data.some((t) => t.fieldName === 'adjuster' || t.fieldName === 'insuranceCompanyClaimNumber')).toBe(true);
    expect(trail.body.data.some((t) => t.action === 'Settlement Approved')).toBe(true);
    const desc = await ctx.api('get', `/claims/audit-trail/${claim.id}?sort=desc`);
    expect(desc.body.sort).toBe('desc');
    expect(new Date(desc.body.data[0].timestamp) >= new Date(desc.body.data.at(-1).timestamp)).toBe(true);
  });
  it('serves generated and uploaded claim documents', async () => {
    const pdf = await ctx.api('get', `/claims/getdocuments/${claim.id}?documentName=${encodeURIComponent('Claims Acknowledgement Letter')}`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.toString('latin1').startsWith('%PDF')).toBe(true);
    const fir = await ctx.api('get', `/claims/getdocuments/${claim.id}?documentName=FIR`).buffer(true).parse(binary);
    expect(fir.body.toString()).toBe('FIR CONTENT');
    expect((await ctx.api('get', `/claims/getdocuments/${claim.id}?documentName=Nope`)).status).toBe(404);
  });
  it('builds the dashboard report and the Excel downloads', async () => {
    const r = await ctx.api('get', `/claims/report?startDate=${daysAgo(365)}&endDate=${daysAgo(-1)}&includeData=true`);
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(Object.keys(d.summary)).toEqual(expect.arrayContaining(['totalOpenClaims', 'totalAgingClaims', 'todaysClaims', 'maxClaimsByState']));
    expect(Object.keys(d.breakdown)).toEqual(expect.arrayContaining(['byType', 'byStatus', 'byLOB', 'byState', 'agingBreakdown']));
    expect(d.detailedClaims.some((c) => c.claimNumber === claim.claimNumber)).toBe(true);
    expect(d.breakdown.byType[0].count).toBeGreaterThanOrEqual(d.breakdown.byType.at(-1).count);
    const x = await ctx.api('get', `/claims/report?startDate=${daysAgo(365)}&endDate=${daysAgo(-1)}&includeData=true&format=excel`).buffer(true).parse(binary);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    expect(x.body.subarray(0, 2).toString()).toBe('PK');
    const c = await ctx.api('get', `/claims/reports/criteria?startDate=${daysAgo(365)}&endDate=${daysAgo(-1)}&criteria=Settled&reportType=json`);
    expect(c.body.data.rows.every((row) => ['Settled', 'Closed'].includes(row.claimStatus))).toBe(true);
    const cx = await ctx.api('get', `/claims/reports/criteria?startDate=${daysAgo(365)}&endDate=${daysAgo(-1)}&criteria=Open&reportType=excel`).buffer(true).parse(binary);
    expect(cx.body.subarray(0, 2).toString()).toBe('PK');
  });
  it('enforces permissions per persona', async () => {
    expect((await as('s.sales', 'get', '/claims')).status).toBe(200);
    expect((await register('s.sales', base, false)).status).toBe(403);
    // Finance reads claims (claim payments, dashboards) but cannot register them.
    expect((await as('f.finance', 'get', '/claims')).status).toBe(200);
    expect((await register('f.finance', base, false)).status).toBe(403);
    expect((await request(ctx.app).get('/api/claims')).status).toBe(401);
  });
});
