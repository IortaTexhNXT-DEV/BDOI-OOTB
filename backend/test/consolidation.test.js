/**
 * One place per value: the Authority Matrix owns remittance approval limits (remittance.approval_levels is only the
 * fallback), Master > Schedules runs the remittance schedules (job remittance-schedules), and the duplicate or unread
 * masters are retired (they refuse writes). Also: Petty Cash > Initiate issues the fund code, the user form takes its
 * designation and reporting line from the masters, and product templates name their line of business by master code.
 */
import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import cron from 'node-cron';
import request from 'supertest';
import { setupFinance } from './accounting.fixtures.js';
import { one, pool, query } from '../src/db/pool.js';
import * as handlers from '../src/jobs/handlers.js';
import { today } from '../src/lib/dates.js';
import { RETIRED_TYPES } from '../src/modules/masters/service.js';

let ctx;
let manager;
const PASSWORD = 'Welcome@123';

beforeAll(async () => {
  ctx = await setupFinance();
  await ctx.api('post', '/users').send({ username: 'cs.manager', password: PASSWORD, displayName: 'Consolidation manager', roles: ['accounting-manager'], email: 'cs.manager@example.ph' });
  const token = (await request(ctx.app).post('/api/auth/login').send({ username: 'cs.manager', password: PASSWORD })).body.accessToken;
  manager = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
});
afterAll(async () => { await pool.end(); });

const pendingFor = async (entityId) => (await ctx.api('get', '/remittance/approvals')).body.data.find((a) => a.entityId === entityId);
const remittanceFor = async (net) => {
  const c = await ctx.as('maker')('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo: `EXT-${net}`, premium: net, commission: 0, tax: 0 }] });
  expect(c.status).toBe(201);
  expect((await ctx.as('maker')('post', '/remittance/remittances/process').send({ ids: [c.body.data.id] })).status).toBe(200);
  return c.body.data.id;
};

describe('remittance approval limits come from the Authority Matrix', () => {
  it('has remittance transaction types with default limits, and the levels setting is labelled as the fallback', async () => {
    const types = (await ctx.api('get', '/access-control/authority-matrix')).body.data.rows;
    const rem = types.find((r) => r.code === 'remittance');
    expect(rem.cells.accounting).toMatchObject({ set: true, maxAmount: 1000000 });
    expect(rem.cells['accounting-manager']).toMatchObject({ set: true, unlimited: true });
    expect(types.find((r) => r.code === 'remittance_settlement').cells.accounting).toMatchObject({ set: true, maxAmount: 1000000 });
    expect((await one("SELECT label FROM app_settings WHERE key = 'remittance.approval_levels'")).label).toMatch(/Fallback .* only while the Authority Matrix has no remittance limit/);
  });

  it('refuses an approver above their limit; one approver within the limit decides', async () => {
    const id = await remittanceFor(1500000);
    const a = await pendingFor(id);
    expect(a.requiredLevels).toBe(1);
    const refused = await ctx.as('checker')('post', `/remittance/approvals/${a.id}/approve`).send({ comments: 'ok' });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/Remittance approval of PHP 1,500,000.00 is above your approval authority of PHP 1,000,000.00/);
    const ok = await manager('post', `/remittance/approvals/${a.id}/approve`).send({ comments: 'Within my authority' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('Approved');
    expect((await ctx.api('get', `/remittance/remittances/${id}`)).body.data.statusCode).toBe('approved');
  });

  it('settlements, adjustments and transfers use the remittance_settlement limit (user limits included)', async () => {
    await query(`INSERT INTO authority_limits(transaction_type, user_id, max_amount, status, decided_at) VALUES ('remittance_settlement', $1, 10000, 'active', now())`, [ctx.userIds.checker]);
    try {
      const t = await ctx.as('maker')('post', '/remittance/transfers').send({ beneficiary: 'FPG Insurance Co., Inc.', amount: 40000, method: 'InstaPay', purpose: 'Premium' });
      expect(t.status).toBe(201);
      const a = await pendingFor(t.body.data.id);
      const refused = await ctx.as('checker')('post', `/remittance/approvals/${a.id}/approve`).send({});
      expect(refused.status).toBe(403);
      expect(refused.body.message).toMatch(/above your approval authority of PHP 10,000.00 \(personal limit\)/);
      expect((await manager('post', `/remittance/approvals/${a.id}/approve`).send({})).body.data.status).toBe('Approved');
    } finally {
      await query("DELETE FROM authority_limits WHERE transaction_type = 'remittance_settlement' AND user_id = $1", [ctx.userIds.checker]);
    }
  });

  it('falls back to remittance.approval_levels only while the matrix has no remittance limit', async () => {
    await query("UPDATE authority_limits SET status = 'retired' WHERE transaction_type = 'remittance' AND status = 'active'");
    try {
      const id = await remittanceFor(200000); // levels setting: up to 100,000 one level, up to 1,000,000 two
      const a = await pendingFor(id);
      expect(a.requiredLevels).toBe(2);
      const first = await ctx.as('checker')('post', `/remittance/approvals/${a.id}/approve`).send({});
      expect(first.body.data).toMatchObject({ status: 'Pending', currentLevel: 2 });
      expect((await manager('post', `/remittance/approvals/${a.id}/approve`).send({})).body.data.status).toBe('Approved');
    } finally {
      await query("UPDATE authority_limits SET status = 'active' WHERE transaction_type = 'remittance' AND status = 'retired' AND decision_note = 'Out-of-the-box default'");
    }
  });

  it('Remittance > Approval has no delegation register of its own, and the approval workflow master is retired', async () => {
    expect((await ctx.api('get', '/remittance/approvals/delegations')).status).toBe(404);
    const wf = await ctx.api('post', '/masters/remittance-approval-workflow').send({ code: 'AWF-9', name: 'x' });
    expect(wf.status).toBe(400);
    expect(wf.body.message).toMatch(/retired .* Authority Matrix/);
    const def = (await ctx.api('get', '/masters/remittance-settlement-parameter/definition')).body.data;
    expect(def.fields.map((f) => f.name)).not.toContain('approvalLevels');
    expect(await one("SELECT 1 FROM master_records WHERE type_code = 'remittance-settlement-parameter' AND data ? 'approvalLevels'")).toBeNull();
  });
});

describe('remittance schedules run from Master > Schedules', () => {
  it('seeds the remittance-schedules job, disabled, daily, with a handler', async () => {
    const job = await one("SELECT cron, enabled, handler FROM scheduled_jobs WHERE code = 'remittance-schedules'");
    expect(job).toMatchObject({ enabled: false, handler: 'remittanceSchedules' });
    expect(cron.validate(job.cron)).toBe(true);
    expect(job.cron.split(' ').slice(2)).toEqual(['*', '*', '*']);
    expect(typeof handlers.remittanceSchedules).toBe('function');
    const list = (await ctx.api('get', '/schedules')).body.data;
    expect(list.find((j) => j.code === 'remittance-schedules')).toMatchObject({ enabled: false });
  });

  it('the job runs the due schedules (insurers up to the cut-off date) and moves the next run date on', async () => {
    const asOf = await today();
    const yesterday = new Date(Date.parse(`${asOf}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const later = `${Number(asOf.slice(0, 4)) + 1}${asOf.slice(4)}`;
    const mk = async (code, extra) => {
      const r = await ctx.as('maker')('post', '/remittance/schedules').send({ code, name: `Schedule ${code}`, insurers: ['MALAYAN'], cutOffDays: 0, frequency: 'Monthly', ...extra });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      return r.body.data;
    };
    const due = await mk('SCH-T1', { nextRun: yesterday });
    const future = await mk('SCH-T2', { nextRun: later });
    const paused = await mk('SCH-T3', { nextRun: yesterday });
    await ctx.as('maker')('patch', `/remittance/schedules/${paused.id}/status`).send({ status: 'Paused' });
    expect((await ctx.as('maker')('post', '/remittance/schedules').send({ code: 'SCH-T4', name: 'x', insurers: ['NOPE'], frequency: 'Monthly' })).status).toBe(400);

    const run = await ctx.api('post', '/schedules/remittance-schedules/run');
    expect(run.status).toBe(200);
    expect(run.body.data.status).toBe('success');
    const ran = run.body.data.output.ran.map((r) => r.schedule);
    expect(ran).toContain('SCH-T1');
    expect(ran).not.toContain('SCH-T2');
    expect(ran).not.toContain('SCH-T3');
    const rec = (await one('SELECT data FROM master_records WHERE id = $1', [due.id])).data;
    expect(rec.lastRun).toBe(asOf);
    expect(rec.nextRun > asOf).toBe(true);
    const exec = await one("SELECT data FROM remittance_items WHERE kind = 'execution' AND data->>'scheduleCode' = 'SCH-T1'");
    expect(exec.data).toMatchObject({ triggeredBy: 'job:remittance-schedules', cutOffDate: asOf });
    expect((await one('SELECT data FROM master_records WHERE id = $1', [future.id])).data.nextRun).toBe(later);
    // not due again until the next run date
    expect((await ctx.api('post', '/schedules/remittance-schedules/run')).body.data.output.ran.map((r) => r.schedule)).not.toContain('SCH-T1');
  });

  it('schedules have no timer of their own and run in the business time zone; Remittance Master no longer lists them', async () => {
    const def = (await ctx.api('get', '/masters/remittance-schedule/definition')).body.data;
    expect(def.fields.map((f) => f.name)).toEqual(expect.arrayContaining(['insurers', 'cutOffDays', 'frequency', 'nextRun']));
    expect(def.fields.map((f) => f.name)).not.toContain('time');
    const zones = (await query("SELECT DISTINCT data->>'timezone' AS tz FROM master_records WHERE type_code = 'remittance-schedule' AND data ? 'timezone'")).rows.map((r) => r.tz);
    expect(zones).toEqual(['Asia/Manila']);
    // a database of an earlier release: the seeded EST time zone and the time of day go
    await query(`UPDATE master_records SET data = data || '{"timezone":"EST","time":"02:00","nextRun":"2025-09-27 02:00:00"}' WHERE type_code = 'remittance-schedule' AND code = 'SCH-001'`);
    await query(fs.readFileSync(new URL('../src/db/migrations/0241_retire_duplicate_masters.sql', import.meta.url), 'utf8'));
    const sch = (await one("SELECT data FROM master_records WHERE type_code = 'remittance-schedule' AND code = 'SCH-001'")).data;
    expect(sch).toMatchObject({ timezone: 'Asia/Manila', nextRun: '2025-09-27' });
    expect(sch.time).toBeUndefined();
    const overview = (await ctx.api('get', '/remittance/masters')).body.data;
    expect(overview.some((m) => ['Schedule', 'ApprovalWorkflow', 'Reconciliation', 'Electronic', 'History', 'Analytics', 'DirectBill', 'ReportTemplate'].includes(m.type))).toBe(false);
    expect(overview.some((m) => m.type === 'Automated')).toBe(true);
    const sc = (await ctx.api('get', '/remittance/schedules')).body.data;
    expect(sc).toMatchObject({ timeZone: 'Asia/Manila', job: { code: 'remittance-schedules', enabled: false } });
  });
});

describe('retired master types keep their records but refuse writes', () => {
  const retired = ['remittance-approval-workflow', 'remittance-reconciliation-rule', 'remittance-electronic-transfer', 'remittance-history-config',
    'remittance-analytics-config', 'remittance-direct-bill', 'remittance-report-template', 'commission', 'employee', 'petty-cash'];
  it('each is inactive, without a screen, and refuses create, update and status changes', async () => {
    const all = (await ctx.api('get', '/masters')).body.data;
    for (const code of retired) {
      expect(RETIRED_TYPES.has(code), code).toBe(true);
      expect(all.find((t) => t.code === code), code).toMatchObject({ status: 'Inactive', screen: null });
      const list = await ctx.api('get', `/masters/${code}`);
      expect(list.status, code).toBe(200);
      const add = await ctx.api('post', `/masters/${code}`).send({ code: 'X-1', name: 'x' });
      expect(add.status, code).toBe(400);
      expect(add.body.message, code).toMatch(/retired/);
      const rec = list.body.data[0];
      if (!rec) continue;
      expect(list.body.data.every((r) => r.status === 'Inactive'), code).toBe(true);
      expect((await ctx.api('put', `/masters/${code}/${rec.id}`).send({ name: 'changed' })).status, code).toBe(400);
      expect((await ctx.api('patch', `/masters/${code}/${rec.id}/status`).send({ status: 'Active' })).status, code).toBe(400);
    }
    expect(await one("SELECT 1 FROM master_records WHERE type_code = 'commission'")).toBeTruthy();
  });

  it('the petty cash master is a plain code list; Initiate owns the fund and issues the code', async () => {
    const def = (await ctx.api('get', '/masters/petty-cash/definition')).body.data;
    expect(def.fields.map((f) => f.name)).toEqual(['pettycashcode', 'pettycashname', 'branchCode']);
    const f = await ctx.as('maker')('post', '/petty-cash/funds').send({ description: 'Ortigas office petty cash', fundSize: 8000, maxLimit: 2000, minimumCashbox: 1500 });
    expect(f.status, JSON.stringify(f.body)).toBe(201);
    expect(f.body.data).toMatchObject({ fundSize: 8000, availableCash: 8000, maxLimit: 2000, minimumCashbox: 1500 });
    expect(f.body.data.code).toMatch(/^PCF-\d+/);
    expect((await ctx.as('maker')('post', '/petty-cash/funds').send({ code: 'PCF-ZERO', fundSize: 0 })).status).toBe(400);
  });
});

describe('users are the staff register', () => {
  it('the user form takes the designation from the Designation master and the reporting line from users', async () => {
    const boss = await one("SELECT id FROM users WHERE username = 'BrokerVerse'");
    const ok = await ctx.api('post', '/users').send({ username: 'cs.staff', password: PASSWORD, displayName: 'Staff', roles: ['operations'], email: 'cs.staff@example.ph',
      designation: 'DSG-AE', reportingTo: 'BrokerVerse' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    const designation = (await one("SELECT name FROM master_records WHERE type_code = 'designation' AND code = 'DSG-AE'")).name;
    expect(ok.body.data).toMatchObject({ designation, reportingTo: boss.id });
    expect((await ctx.api('get', `/users/${ok.body.data.userId}`)).body.data).toMatchObject({ designation, reportingTo: boss.id });
    const bad = await ctx.api('post', '/users').send({ username: 'cs.staff2', password: PASSWORD, displayName: 'Staff 2', roles: ['operations'], email: 'cs.staff2@example.ph', designation: 'Chief Wizard', reportingTo: 'nobody.here' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((e) => e.path).sort()).toEqual(['designation', 'reportingTo']);
    expect((await ctx.api('put', `/users/${ok.body.data.userId}`).send({ reportingTo: ok.body.data.userId })).status).toBe(400);
  });
});

describe('product templates use master codes', () => {
  it('stores the Line of Business master code and checks the product', async () => {
    const lob = await ctx.api('post', '/product-configurator/products').send({ templateCode: 'CS-PA-1', name: 'PA test', category: 'Accident', lineOfBusiness: 'Personal Accident', effectiveDate: '2026-01-01', status: 'Draft' });
    expect(lob.status, JSON.stringify(lob.body)).toBe(201);
    expect(lob.body.data.lineOfBusiness).toBe('ACCIDENT');
    const product = await one("SELECT id FROM products WHERE code = 'MOTOR'");
    const fromProduct = await ctx.api('post', '/product-configurator/products').send({ templateCode: 'CS-MOT-1', name: 'Motor test', category: 'Motor', productId: product.id, effectiveDate: '2026-01-01', status: 'Draft' });
    expect(fromProduct.status, JSON.stringify(fromProduct.body)).toBe(400); // lineOfBusiness is required on create
    const both = await ctx.api('post', '/product-configurator/products').send({ templateCode: 'CS-MOT-1', name: 'Motor test', category: 'Motor', productId: product.id, lineOfBusiness: 'MOTOR', effectiveDate: '2026-01-01', status: 'Draft' });
    expect(both.body.data).toMatchObject({ lineOfBusiness: 'MOTOR', productId: product.id });
    const mismatch = await ctx.api('post', '/product-configurator/products').send({ templateCode: 'CS-MOT-2', name: 'x', category: 'Motor', productId: product.id, lineOfBusiness: 'ACCIDENT', effectiveDate: '2026-01-01', status: 'Draft' });
    expect(mismatch.status).toBe(400);
    const unknown = await ctx.api('post', '/product-configurator/products').send({ templateCode: 'CS-X', name: 'x', category: 'Motor', lineOfBusiness: 'Motor Vehicle', effectiveDate: '2026-01-01', status: 'Draft' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.errors[0].path).toBe('lineOfBusiness');
    const seeded = (await query('SELECT DISTINCT line_of_business AS l FROM product_templates')).rows.map((r) => r.l);
    const codes = (await query("SELECT code FROM master_records WHERE type_code = 'line-of-business'")).rows.map((r) => r.code);
    expect(seeded.every((l) => codes.includes(l))).toBe(true);
  });
});
