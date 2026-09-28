import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';

let ctx;
const tok = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const binary = (res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); };
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function makeUser(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status).toBe(201);
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}
async function waitForJob(jobId) {
  for (let i = 0; i < 100; i += 1) {
    const j = await ctx.api('get', `/policy-renewals/queue/${jobId}`);
    if (['completed', 'failed'].includes(j.body.data.status)) return j.body.data;
    await sleep(50);
  }
  throw new Error('job did not finish');
}

beforeAll(async () => {
  ctx = await setup();
  await makeUser('u.maker', ['underwriting']);
  await makeUser('u.checker', ['underwriting']);
  await makeUser('f.finance', ['finance']);
  await query(`INSERT INTO clients(id, client_code, display_name, email) VALUES ('cl_r1','CL-R-1','Renewal Client','renew@example.ph'), ('cl_r2','CL-R-2','No Mail Client',NULL)`);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total, commission_amount)
    SELECT v.id, v.num, v.client, (SELECT id FROM products WHERE code = 'MOTOR'), (SELECT id FROM insurance_companies WHERE code = 'MAPFRE'),
           (SELECT id FROM users WHERE username = 'u.maker'), 'active', current_date + v.exp - 364, current_date + v.exp, 1000000, 30000, 4500
    FROM (VALUES ('pol_r1','POL-R-0001','cl_r1',30), ('pol_r2','POL-R-0002','cl_r2',20), ('pol_r3','POL-R-0003','cl_r1',40), ('pol_r4','POL-R-0004','cl_r1',50)) AS v(id, num, client, exp)`);
  await query(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, estimate_amount) VALUES ('CLM-R-1','pol_r1','cl_r1','settled',current_date - 60, 20000)`);
});
afterAll(async () => { await sleep(100); await pool.end(); });

describe('renewals', () => {
  let rn;
  it('puts a policy into the pipeline and lists it for the client', async () => {
    const r = await ctx.api('post', '/renewals/policies/POL-R-0001');
    expect(r.status).toBe(201);
    rn = r.body.data;
    expect(rn.renewalNumber).toMatch(/^RN-\d{4}-\d{5}$/);
    expect(rn.statusCode).toBe('pipeline');
    expect(rn.currentPremium).toBe(30000);
    expect((await ctx.api('post', '/renewals/policies/pol_r1')).status).toBe(200);
    const l = await ctx.api('get', '/policy-renewals?clientId=cl_r1&page=1&limit=50');
    expect(l.body.data.map((x) => x.id)).toContain(rn.id);
    expect(l.body.pagination.total).toBeGreaterThanOrEqual(1);
    expect(l.body.data[0].policy.policyNumber).toBeTruthy();
  });
  it('captures the renewal quote wizard data (POST is idempotent per policy, PUT updates)', async () => {
    const c = await ctx.api('post', '/policy-renewals/policies/pol_r1/renewals').send({ coverageDetails: { lossAndDamageCoverage: '1000000', totalSumInsured: '1000000' }, accessories: [] });
    expect(c.status).toBe(200);
    expect(c.body.data.id).toBe(rn.id);
    const u = await ctx.api('put', `/policy-renewals/${rn.id}`).send({ coverageDetails: { lossAndDamageCoverage: '1100000' }, orderSummary: { grossPremium: 33000 } });
    expect(u.body.data.coverageDetails.lossAndDamageCoverage).toBe('1100000');
    expect(u.body.data.renewalPremium).toBe(33000);
    expect(u.body.data.statusCode).toBe('quoted');
    const byPolicy = await ctx.api('get', '/policy-renewals?policyId=pol_r1');
    expect(byPolicy.body.data[0].coverageDetails.lossAndDamageCoverage).toBe('1100000');
    expect((await ctx.api('put', `/policy-renewals/${rn.id}`).send({ remarks: 12 })).status).toBe(400);
  });
  it('sends notices strictly in order and e-mails the client', async () => {
    const skip = await ctx.api('post', `/renewals/${rn.id}/notices`).send({ stage: 2 });
    expect(skip.status).toBe(409);
    const first = await ctx.api('post', `/renewals/${rn.id}/notices`).send({ stage: 1 });
    expect(first.status).toBe(200);
    expect(first.body.data.noticeStage).toBe(1);
    expect(first.body.data.nextNotice.stage).toBe(2);
    const mail = await one('SELECT * FROM email_outbox WHERE entity = \'renewal\' AND entity_id = $1', [rn.id]);
    expect(mail.to_address).toBe('renew@example.ph');
    expect(mail.subject).toContain('First Notice');
    expect((await ctx.api('post', `/renewals/${rn.id}/notices`).send({ stage: 1 })).status).toBe(409);
    expect((await ctx.api('post', `/renewals/${rn.id}/notices`).send({})).body.data.noticeStage).toBe(2);
    const rem = await ctx.api('post', `/renewals/${rn.id}/reminders`).send({ method: 'SMS', note: 'Texted client' });
    expect(rem.body.data.renewalAttempts).toBe(1);
  });
  it('re-rates the renewal at current rates with claims loading, taxes and premium variance', async () => {
    const q = await ctx.api('post', `/renewals/${rn.id}/quote`);
    expect(q.status).toBe(200);
    const d = q.body.data;
    // motor rate 0.0275 x 1,000,000 = 27,500; one claim => 10% loading; taxes VAT 12%, DST 12.5%, LGT 0.75%
    expect(d.premiumCalculation.basePremium).toBe(27500);
    expect(d.premiumCalculation.claimsLoading).toBe(2750);
    const net = 30250;
    expect(d.premiumCalculation.subtotal).toBe(net);
    const total = Math.round((net + net * 0.12 + net * 0.125 + net * 0.0075) * 100) / 100;
    expect(d.quotedPremium).toBeCloseTo(total, 1);
    expect(d.previousPremium).toBe(30000);
    expect(d.premiumVariance).toBeCloseTo(total - 30000, 1);
    expect(d.quoteNumber).toMatch(/^RQ-/);
    const detail = await ctx.api('get', `/renewals/${rn.id}`);
    expect(detail.body.data.quotes).toHaveLength(1);
    expect(detail.body.data.notices).toHaveLength(2);
    expect(detail.body.data.statusCode).toBe('quoted');
  });
  it('requires checker approval by a different user and then renews into a new policy term', async () => {
    expect((await as('u.maker', 'post', `/renewals/${rn.id}/complete`).send({})).status).toBe(409);
    const s = await as('u.maker', 'post', `/renewals/${rn.id}/submit`).send({ note: 'Standard terms' });
    expect(s.body.data.statusCode).toBe('pending-approval');
    const approvals = await ctx.api('get', '/renewals/approvals');
    expect(approvals.body.data.map((a) => a.renewalId)).toContain(rn.id);
    expect((await as('u.maker', 'post', `/renewals/${rn.id}/approve`).send({ decision: 'approve' })).status).toBe(403);
    const a = await as('u.checker', 'post', `/renewals/${rn.id}/approve`).send({ decision: 'approve', note: 'OK' });
    expect(a.body.data.statusCode).toBe('approved');
    const c = await as('u.maker', 'post', `/renewals/${rn.id}/complete`).send({});
    expect(c.status).toBe(200);
    const np = c.body.data.newPolicy;
    const oldP = await one('SELECT status, renewed_to, expiry_date FROM policies WHERE id = \'pol_r1\'');
    expect(oldP.status).toBe('renewed');
    expect(oldP.renewed_to).toBe(np.id);
    const newP = await one('SELECT * FROM policies WHERE id = $1', [np.id]);
    expect(newP.renewed_from).toBe('pol_r1');
    expect(newP.inception_date > oldP.expiry_date).toBe(true);
    expect(Number(newP.premium_total)).toBe(np.premium);
    const rcv = await one('SELECT * FROM receivables WHERE policy_id = $1', [np.id]);
    expect(Number(rcv.balance)).toBe(np.premium);
    expect(c.body.data.renewal.statusCode).toBe('renewed');
    expect((await ctx.api('post', '/renewals/policies/pol_r1')).status).toBe(409);
  });
  it('lapses and reinstates a renewal; validates the lapse reason', async () => {
    const r3 = (await ctx.api('post', '/renewals/policies/pol_r3')).body.data;
    expect((await ctx.api('post', `/renewals/${r3.id}/lapse`).send({})).status).toBe(400);
    const l = await ctx.api('post', `/renewals/${r3.id}/lapse`).send({ reason: 'Client sold the vehicle' });
    expect(l.body.data.statusCode).toBe('lapsed');
    const lapsed = await ctx.api('get', '/renewals/lapsed');
    expect(lapsed.body.data.find((x) => x.renewalId === r3.id).reinstatementEligible).toBe(true);
    const wb = await ctx.api('post', `/renewals/${r3.id}/win-back`).send({ offer: '10% discount', method: 'Phone' });
    expect(wb.status).toBe(201);
    const re = await ctx.api('post', `/renewals/${r3.id}/reinstate`).send({ note: 'Accepted offer' });
    expect(re.body.data.statusCode).toBe('pipeline');
  });
  it('runs a renewal batch through the PostgreSQL job queue (sent, failed, retry, report)', async () => {
    const b = await ctx.api('post', '/policy-renewals/create-batches').send({ criteriaOption: { productType: 'Motor' }, policies: [{ policyId: 'POL-R-0002', isSelected: false }, { policyId: 'POL-R-0004', isSelected: false }], status: 'Draft' });
    expect(b.status).toBe(201);
    const batchId = b.body.data.batchId;
    expect(batchId).toMatch(/^RB-/);
    expect(b.body.data.totalPolicies).toBe(2);
    const list = await ctx.api('get', '/policy-renewals/batches');
    expect(list.body.data.some((x) => x.batchId === batchId)).toBe(true);
    const detail = (await ctx.api('get', `/policy-renewals/batches/${batchId}`)).body.data;
    expect(detail.policies.every((p) => p.noticeStatus === 'NotSent')).toBe(true);
    expect((await ctx.api('post', `/policy-renewals/batches/${batchId}/send-notices`).send({ batchId, selectedPolicyIds: [] })).status).toBe(400);
    const send = await ctx.api('post', `/policy-renewals/batches/${batchId}/send-notices`).send({ batchId, selectedPolicyIds: detail.policies.map((p) => p.policyId) });
    expect(send.status).toBe(200);
    const job = await waitForJob(send.body.data.jobId);
    expect(job.status).toBe('completed');
    expect(job.progress).toMatchObject({ total: 2, processed: 2, succeeded: 1, failed: 1 });
    const after = (await ctx.api('get', `/policy-renewals/batches/${batchId}`)).body.data;
    expect(after.status).toBe('Completed');
    expect(after.processedCount).toBe(1);
    const failed = after.policies.find((p) => p.noticeStatus === 'Failed');
    expect(failed.policy.policyNumber).toBe('POL-R-0002');
    expect(failed.error).toContain('no e-mail');
    await query('UPDATE clients SET email = \'fixed@example.ph\' WHERE id = \'cl_r2\'');
    const retry = await ctx.api('post', `/policy-renewals/batches/${batchId}/retry-failed`);
    expect((await waitForJob(retry.body.data.jobId)).progress.succeeded).toBe(1);
    const ns = await ctx.api('get', `/policy-renewals/batches/${batchId}/notice-status`);
    expect(ns.body.data).toMatchObject({ Sent: 2, Failed: 0, total: 2 });
    const stats = await ctx.api('get', '/policy-renewals/queue-stats');
    expect(stats.body.data.completed).toBeGreaterThanOrEqual(2);
    const rep = await ctx.api('get', `/policy-renewals/batches/${batchId}/report`).buffer(true).parse(binary);
    expect(rep.headers['content-type']).toContain('spreadsheetml');
    expect(rep.body.subarray(0, 2).toString()).toBe('PK');
    expect((await ctx.api('delete', `/policy-renewals/batches/${batchId}`)).status).toBe(409);
    expect((await ctx.api('get', '/policy-renewals/queue/999999')).status).toBe(404);
  });
  it('serves the workspace read models (queue, at-risk, negotiations, performance, campaigns)', async () => {
    const q = await ctx.api('get', '/renewals/queue?page=1&pageSize=100');
    expect(q.body.dashboard.totalPolicies).toBeGreaterThan(0);
    expect(q.body.data[0]).toHaveProperty('daysToExpiry');
    expect((await ctx.api('get', '/renewals/at-risk')).body.data.every((a) => a.riskCategory !== 'Low')).toBe(true);
    const neg = await ctx.api('get', '/renewals/negotiations');
    expect(Array.isArray(neg.body.data)).toBe(true);
    const perf = await ctx.api('get', '/renewals/performance');
    expect(perf.body.data.overall).toHaveProperty('renewalRate');
    const c = await ctx.api('post', '/renewals/campaigns').send({ campaignName: 'Test Win-back', startDate: '2026-01-01', endDate: '2026-12-31', discount: 10 });
    expect(c.status).toBe(201);
    expect((await ctx.api('get', '/renewals/campaigns')).body.data.map((x) => x.id)).toContain(c.body.data.id);
    expect((await ctx.api('post', '/renewals/campaigns').send({ campaignName: 'Bad', startDate: '2026-12-31', endDate: '2026-01-01' })).status).toBe(400);
  });
  it('enforces permissions per persona', async () => {
    expect((await as('f.finance', 'get', '/policy-renewals')).status).toBe(403);
    expect((await as('f.finance', 'post', '/policy-renewals/create-batches').send({ policies: ['POL-R-0004'] })).status).toBe(403);
    expect((await as('u.maker', 'get', '/renewals/queue')).status).toBe(200);
  });
});
