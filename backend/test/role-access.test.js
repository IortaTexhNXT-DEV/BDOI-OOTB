// Each role reaches what its menu shows: menu and API permissions agree, filter look-ups are readable without
// read:users, empty forms are refused with readable messages, claim dates are checked and the own-book dashboard
// counts the same book as the lists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { notify } from '../src/modules/notifications/service.js';
import { nextRunOf } from '../src/modules/remittance/items.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let ctx;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function makeUser(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status).toBe(201);
  ids[username] = r.body.data.userId;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}

beforeAll(async () => {
  ctx = await setup();
  // Account Executives restricted to their own book (security.scoped_roles = sales): the producers of this walk.
  expect((await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': ['sales'] } })).status).toBe(200);
  await makeUser('pw.agent', ['sales']);
  await makeUser('pw.agent2', ['sales']);
  await makeUser('pw.finance', ['accounting']);
  await makeUser('pw.finance2', ['accounting']);
  await makeUser('pw.sales', ['sales']);
  await makeUser('pw.uw', ['processing']);
  await makeUser('pw.claims', ['claims']);
  await makeUser('pw.cs', ['operations']);
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, owner_user_id, created_by) VALUES
    ('cl_pw1','CL-PW-1','Walker Uno','Walker','Uno',$1,$1), ('cl_pw2','CL-PW-2','Walker Dos','Walker','Dos',$2,$2)`, [ids['pw.agent'], ids['pw.agent2']]);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, owner_user_id, created_by, status, inception_date, expiry_date, sum_insured, premium_total, insured_name)
    VALUES ('pol_pw1','POL-PW-0001','cl_pw1',(SELECT id FROM products WHERE code='MOTOR'),$1,$1,'active',current_date - 340,current_date + 25,900000,20000,'Walker Uno'),
           ('pol_pw2','POL-PW-0002','cl_pw2',(SELECT id FROM products WHERE code='MOTOR'),$2,$2,'active',current_date - 340,current_date + 25,900000,20000,'Walker Dos')`, [ids['pw.agent'], ids['pw.agent2']]);
  // POL-PW-0001: 15,000 of its 20,000 premium bill collected; POL-PW-0002 moved to direct bill (premium bill cancelled)
  await query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES
    ('INV-PW-1','pol_pw1','cl_pw1',20000,5000,current_date - 300,'partial'), ('INV-PW-2','pol_pw2','cl_pw2',20000,0,current_date - 300,'cancelled')`);
  await query('UPDATE policies SET billing_mode = \'direct\' WHERE id = \'pol_pw2\'');
  // a fully paid policy for the claim tests (claims on unpaid premium are refused by the acceptance controls)
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, owner_user_id, created_by, status, inception_date, expiry_date, sum_insured, premium_total, insured_name)
    VALUES ('pol_pw3','POL-PW-0003','cl_pw1',(SELECT id FROM products WHERE code='MOTOR'),$1,$1,'active',current_date - 100,current_date + 265,900000,20000,'Walker Uno')`, [ids['pw.agent']]);
  await query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES ('INV-PW-3','pol_pw3','cl_pw1',20000,0,current_date - 70,'paid')`);
});
afterAll(async () => { await new Promise((r) => { setTimeout(r, 50); }); await pool.end(); });

describe('own-book renewals: own policies through the wizard', () => {
  it('prefills and saves the renewal wizard of an own policy; another agent\'s policy answers 404', async () => {
    const pre = await as('pw.agent', 'get', '/policy-renewals/policies/pol_pw1/prefill');
    expect(pre.status).toBe(200);
    expect(pre.body.data.policyNumber).toBe('POL-PW-0001');
    expect((await as('pw.agent', 'get', '/policy-renewals/policies/pol_pw2/prefill')).status).toBe(404);
    const save = await as('pw.agent', 'post', '/policy-renewals/policies/pol_pw1/renewals').send({ coverageDetails: { lossAndDamageCoverage: '900000' } });
    expect([200, 201]).toContain(save.status);
    expect((await as('pw.agent', 'post', '/policy-renewals/policies/pol_pw2/renewals').send({ coverageDetails: {} })).status).toBe(404);
    const list = await as('pw.agent', 'get', '/policy-renewals?clientId=cl_pw1');
    expect(list.status).toBe(200);
    expect(list.body.data.every((r) => r.policyId === 'pol_pw1')).toBe(true);
    // claims officers do not prepare quotations, so they have no renewal wizard either
    expect((await as('pw.claims', 'get', '/policy-renewals/policies/pol_pw1/prefill')).status).toBe(403);
  });
});

describe('finance incentives', () => {
  it('finance reads calculations, approvals and agent programs; program set-up stays with administrators', async () => {
    for (const p of ['/incentive/calculations', '/incentive/approvals', '/incentive/agent-programs', '/incentive/agents']) {
      expect((await as('pw.finance', 'get', p)).status, p).toBe(200);
    }
    expect((await as('pw.finance', 'post', '/incentive/programs').send({ programName: 'Finance made' })).status).toBe(403);
    expect((await as('pw.finance', 'put', '/incentive/programs/1').send({ status: 'Inactive' })).status).toBe(403);
    expect((await ctx.api('post', '/incentive/programs').send({})).status).toBe(400);
  });
  it('finance runs a calculation and a second finance user approves it (maker-checker)', async () => {
    const c = await as('pw.finance', 'post', '/incentive/calculations').send({ period: '2026-08', selectedPrograms: ['INC-2026-002'] });
    expect(c.status).toBe(201);
    expect((await as('pw.finance', 'post', `/incentive/calculations/${c.body.data.batchId}/submit`)).status).toBe(200);
    expect((await as('pw.finance', 'post', `/incentive/calculations/${c.body.data.batchId}/approve`)).status).toBe(403);
    expect((await as('pw.finance2', 'post', `/incentive/calculations/${c.body.data.batchId}/approve`)).body.data.status).toBe('Approved');
  });
  it('GET /incentive/statement answers 200 for a manager who is not an agent (eligible: false) and the chosen agent\'s statement', async () => {
    const mine = await as('pw.finance', 'get', '/incentive/statement?period=2026-09');
    expect(mine.status).toBe(200);
    expect(mine.body.data).toMatchObject({ eligible: false, selectAgent: true, period: 'September 2026', totalEarnings: 0, programBreakdown: [] });
    const agent = (await pool.query('SELECT id FROM users WHERE username = \'agent.msantos\'')).rows[0].id;
    const theirs = await as('pw.finance', 'get', `/incentive/statement?agentId=${agent}&period=2026-07`);
    expect(theirs.status).toBe(200);
    expect(theirs.body.data).toMatchObject({ eligible: true, totalEarnings: 24000 });
    const own = await as('pw.agent', 'get', '/incentive/statement?period=2026-09');
    expect(own.body.data).toMatchObject({ eligible: true, agentId: ids['pw.agent'] });
    expect((await as('pw.agent', 'get', `/incentive/statement?agentId=${agent}`)).status).toBe(403);
  });
  it('migration 0095 grants finance the incentive permissions on existing databases', async () => {
    const sql = fs.readFileSync(path.join(here, '../src/db/migrations/0095_finance_incentive.sql'), 'utf8');
    await query('DELETE FROM role_permissions rp USING roles r, permissions p WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = \'finance\' AND p.module = \'incentive\'');
    await query(sql);
    await query(sql);
    const n = await one(`SELECT count(*)::int AS n FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
      WHERE r.code = 'accounting' AND p.code IN ('read:incentive', 'write:incentive')`);
    expect(n.n).toBe(2);
  });
});

describe('look-ups without read:users', () => {
  it('GET /reports/filters/agents serves the report Agent filter to every report reader', async () => {
    for (const who of ['pw.finance', 'pw.sales', 'pw.uw', 'pw.claims']) {
      expect((await as(who, 'get', '/users?role=agent')).status, who).toBe(403);
      const r = await as(who, 'get', '/reports/filters/agents');
      expect(r.status, who).toBe(200);
      expect(r.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'pw.agent', value: ids['pw.agent'] })]));
      expect(r.body.data.find((o) => o.value === ids['pw.finance'])).toBeUndefined();
    }
  });
  it('GET /reports/filters/clients serves the report Client filter to every report reader, within the record scope', async () => {
    await makeUser('pw.ccd', ['tis-ccd-bp']);
    expect((await as('pw.ccd', 'get', '/clients')).status).toBe(403);
    const r = await as('pw.ccd', 'get', '/reports/filters/clients');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual(expect.arrayContaining([{ label: 'Walker Uno', value: 'cl_pw1', code: 'CL-PW-1' }, { label: 'Walker Dos', value: 'cl_pw2', code: 'CL-PW-2' }]));
    const own = (await as('pw.agent', 'get', '/reports/filters/clients')).body.data.map((o) => o.value);
    expect(own).toContain('cl_pw1');
    expect(own).not.toContain('cl_pw2');
  });
  it('GET /remittance/approvals/approvers lists the other users who may approve remittances', async () => {
    const r = await as('pw.finance', 'get', '/remittance/approvals/approvers');
    expect(r.status).toBe(200);
    const names = r.body.data.map((u) => u.username);
    expect(names).toContain('pw.finance2');
    expect(names).toContain('BrokerVerse');
    expect(names).not.toContain('pw.finance');
    expect(names).not.toContain('pw.sales');
    expect((await as('pw.sales', 'get', '/remittance/approvals/approvers')).status).toBe(403);
  });
});

describe('empty forms are refused with field messages', () => {
  it('every create endpoint of the walk answers 400 "Validation failed" with one readable message per field', async () => {
    const rn = (await one('SELECT id FROM renewals ORDER BY id LIMIT 1')).id;
    const cases = [
      ['/product-configurator/coverages', 'coverageCode'], ['/product-configurator/rating-factors', 'factorCode'], ['/product-configurator/underwriting-rules', 'ruleCode'],
      ['/renewals/campaigns', 'campaignName'], [`/renewals/${rn}/activities`, 'type'], ['/remittance/adjustments', 'adjustmentType'],
      ['/masters/remittance-automated', 'code'], ['/incentive/programs', 'programName'], ['/remittance/exceptions', 'type'],
      ['/remittance/schedules', 'code'],
    ];
    for (const [p, field] of cases) {
      const r = await ctx.api('post', p).send({});
      expect(r.status, p).toBe(400);
      expect(r.body.message, p).toBe('Validation failed');
      const e = r.body.errors.find((x) => x.path === field);
      expect(e?.message, p).toMatch(/required/i);
      expect(e.message, p).not.toBe('Required');
    }
  });
});

describe('claim dates', () => {
  it('refuses a reported date before the date of loss, on registration and on update', async () => {
    const body = { policyRefId: 'pol_pw3', typeOfIncident: 'Collision', estimatedClaimAmount: 40000, lob: 'MOTOR' };
    const bad = await as('pw.claims', 'post', '/claims').send({ ...body, dateOfIncident: daysAgo(5), reportedDate: daysAgo(8) });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0]).toMatchObject({ path: 'reportedDate' });
    const good = await as('pw.claims', 'post', '/claims').send({ ...body, dateOfIncident: daysAgo(5), reportedDate: daysAgo(4) });
    expect(good.status).toBe(201);
    const id = good.body.data.id;
    expect((await as('pw.claims', 'put', `/claims/${id}`).send({ reportedDate: daysAgo(6) })).status).toBe(400);
    expect((await as('pw.claims', 'put', `/claims/${id}`).send({ dateOfIncident: daysAgo(3) })).status).toBe(400);
    expect((await as('pw.claims', 'put', `/claims/${id}`).send({ reportedDate: daysAgo(5) })).status).toBe(200);
  });
  it('no seeded claim is reported before its loss', async () => {
    expect((await one('SELECT count(*)::int AS n FROM claims WHERE reported_date < loss_date')).n).toBe(0);
  });
});

describe('agent dashboard counts the book the lists show', () => {
  it('a quotation another user creates on the agent\'s lead is in both the quotation list and the dashboard funnel', async () => {
    const lead = await as('pw.agent', 'post', '/leads').send({ firstName: 'Funnel', lastName: 'Check', emailId: 'funnel@lead.example.ph', lob: 'MOTOR' });
    expect(lead.status).toBe(201);
    expect((await as('pw.agent', 'post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', netPremium: '5000' })).status).toBe(201);
    expect((await as('pw.uw', 'post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', netPremium: '6000' })).status).toBe(201);
    const list = await as('pw.agent', 'get', '/quotations?pageSize=100');
    const dash = await as('pw.agent', 'get', '/agent/get-dashboard-details?scope=mine');
    expect(dash.status).toBe(200);
    expect(list.body.data.length).toBe(2);
    expect(dash.body.data.funnel.quotations).toBe(list.body.data.length);
    expect(dash.body.data.recentQuotations).toHaveLength(2);
    const leads = await as('pw.agent', 'get', '/leads?pageSize=100');
    expect(dash.body.data.funnel.leads).toBe(leads.body.data.length);
    const policies = await as('pw.agent', 'get', '/policies?pageSize=100');
    expect(dash.body.data.funnel.policies).toBe(policies.body.data.length);
  });
});

describe('agent dashboard premium figures', () => {
  it('collected and receivable premium come from the premium bills of the agent\'s book', async () => {
    const dash = await as('pw.agent', 'get', '/agent/get-dashboard-details?scope=mine');
    // POL-PW-0001 15,000 of 20,000 collected; POL-PW-0003 paid in full
    expect(dash.body.data.premium).toMatchObject({ collected: 35000, receivable: 5000, gross: 40000 });
    expect(dash.body.data.scoped).toBe(true);
    const clients = await as('pw.agent', 'get', '/clients?perPage=100');
    expect(dash.body.data.clients).toBe((clients.body.data.clients || clients.body.data).length);
    // the direct-bill policy of the other agent: nothing collected by the broker
    const other = await as('pw.agent2', 'get', '/agent/get-dashboard-details?scope=mine');
    expect(other.body.data.premium).toMatchObject({ collected: 0, receivable: 0 });
  });
});

describe('payments list labels direct bill', () => {
  it('a premium bill cancelled because the policy is direct bill shows DIRECT BILL under Paid, not PAID', async () => {
    const paid = await ctx.api('get', '/payments?status=PAID&pageSize=200');
    const row = paid.body.data.find((x) => x.policyNumber === 'POL-PW-0002');
    expect(row).toMatchObject({ status: 'DIRECT BILL', billingMode: 'direct' });
    expect(paid.body.data.filter((x) => x.policyNumber !== 'POL-PW-0002').every((x) => x.status === 'PAID')).toBe(true);
    const all = await ctx.api('get', '/payments?pageSize=200');
    expect(all.body.data.find((x) => x.policyNumber === 'POL-PW-0001').status).toBe('REVIEWING');
  });
});

describe('notifications reach only the roles that can act on them', () => {
  it('a finance approval notification is shown to finance, not to customer services or sales', async () => {
    const title = `Journal voucher JV-PW-${Date.now()} awaiting approval`;
    await notify({ audience: 'write:journal-vouchers', type: 'approval', title, message: 'test' });
    const titles = async (who) => (await as(who, 'get', '/notifications?pageSize=100')).body.data.notifications.map((n) => n.title);
    expect(await titles('pw.finance')).toContain(title);
    expect(await titles('pw.cs')).not.toContain(title);
    expect(await titles('pw.sales')).not.toContain(title);
    expect((await ctx.api('get', '/notifications?pageSize=100')).body.data.notifications.map((n) => n.title)).toContain(title);
    // marking all read as customer services does not touch it
    await as('pw.cs', 'put', '/notifications/read-all');
    expect((await one('SELECT is_read FROM notifications WHERE title = $1', [title])).is_read).toBe(false);
  });
  it('the approval notifications of the modules name their audience', async () => {
    const src = (f) => fs.readFileSync(path.join(here, '../src/modules', f), 'utf8');
    expect(src('journal-vouchers/router.js')).toMatch(/audience: 'write:journal-vouchers'/);
    expect(src('payments/pettycash.js')).toMatch(/audience: 'write:disbursements'/);
    expect(src('remittance/service.js')).toMatch(/audience: 'write:remittance'/);
  });
});

describe('remittance schedule next run (upcoming events)', () => {
  it('is a date (the schedules job runs in the business time zone) rolled forward by the frequency when past', () => {
    const asOf = '2026-09-29';
    expect(nextRunOf({ nextRun: '2025-09-27 02:00:00', frequency: 'Daily' }, asOf)).toBe('2026-09-29');
    expect(nextRunOf({ nextRun: '2026-09-27', frequency: 'Weekly' }, asOf)).toBe('2026-10-04');
    expect(nextRunOf({ nextRun: '2026-10-01', frequency: 'Monthly' }, asOf)).toBe('2026-10-01');
    expect(nextRunOf({ nextRun: '2026-01-31', frequency: 'Monthly' }, asOf)).toBe('2026-09-30');
    expect(nextRunOf({ nextRun: null }, asOf)).toBeNull();
  });
});
