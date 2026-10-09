import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { parsePeriod } from '../src/modules/incentive/service.js';

let ctx;
let agentTok;
let agentId;
let checkerTok;
beforeAll(async () => {
  ctx = await setup();
  const a = await ctx.api('post', '/users').send({ username: 'i.agent', password: 'Welcome@123', displayName: 'Ivy Agent', employeeCode: 'AG900', roles: ['sales'] });
  agentId = a.body.data.userId || a.body.data.id;
  await ctx.api('post', '/users').send({ username: 'i.checker', password: 'Welcome@123', displayName: 'Ina Checker', roles: ['system-admin'] });
  agentTok = await loginAs(ctx.app, 'i.agent', 'Welcome@123');
  checkerTok = await loginAs(ctx.app, 'i.checker', 'Welcome@123');
  // two policies of the agent incepting in September 2026, the period calculated below
  await pool.query('UPDATE policies SET owner_user_id = $1, inception_date = \'2026-09-15\' WHERE id IN (\'pol_crs_24\', \'pol_sls_08\')', [agentId]);
});
afterAll(async () => { await pool.end(); });
const as = (tok, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);

describe('periods', () => {
  it('reads a month, a label, and the quarter or half-year key of a semi-annual or quarterly result', () => {
    expect(parsePeriod('2026-09')).toEqual({ label: 'September 2026', from: '2026-09-01', to: '2026-09-30' });
    expect(parsePeriod('September 2026').from).toBe('2026-09-01');
    expect(parsePeriod('2026-H1')).toEqual({ label: 'January to June 2026', from: '2026-01-01', to: '2026-06-30' });
    expect(parsePeriod('2026-h2').to).toBe('2026-12-31');
    expect(parsePeriod('2026-Q3')).toEqual({ label: 'July to September 2026', from: '2026-07-01', to: '2026-09-30' });
    expect(() => parsePeriod('2026-H3')).toThrow();
  });
});

describe('programs', () => {
  it('lists seeded programs in the mock shape', async () => {
    const r = await ctx.api('get', '/incentive/programs');
    const nbc = r.body.data.find((p) => p.programCode === 'INC-2026-002');
    expect(nbc).toMatchObject({ programName: 'New Business Champion', targetMetric: 'Policy Count', baseTarget: 20, Currency: 'PHP', status: 'Active' });
    expect(nbc.structure).toHaveLength(4);
    expect(nbc.participants).toBeGreaterThanOrEqual(5);
  });
  it('creates, validates, updates and deletes a program', async () => {
    const body = { programName: 'Test Program', programType: 'Target Based', applicableTo: ['Individual Agent'], startDate: '2026-10-01', endDate: '2026-12-31', targetMetric: 'Premium Volume', calculationFrequency: 'Monthly', baseTarget: 100000, structure: [{ level: '100%+', type: 'Percentage', value: 1, maxPayout: 5000 }] };
    expect((await ctx.api('post', '/incentive/programs').send({ ...body, targetMetric: 'Smiles' })).status).toBe(400);
    expect((await ctx.api('post', '/incentive/programs').send({ ...body, endDate: '2026-01-01' })).status).toBe(400);
    expect((await ctx.api('post', '/incentive/programs').send({ ...body, structure: [{ level: 'x' }] })).status).toBe(400);
    const c = await ctx.api('post', '/incentive/programs').send(body);
    expect(c.status).toBe(201);
    expect(c.body.data.programCode).toMatch(/^INC-/);
    const u = await ctx.api('put', `/incentive/programs/${c.body.data.id}`).send({ status: 'Inactive', stretchTarget: 150000 });
    expect(u.body.data).toMatchObject({ status: 'Inactive', stretchTarget: 150000 });
    expect((await ctx.api('delete', `/incentive/programs/${c.body.data.id}`)).status).toBe(200);
    expect((await ctx.api('get', `/incentive/programs/${c.body.data.id}`)).status).toBe(404);
  });
});

describe('calculations', () => {
  let batchId;
  it('calculates achievement from policies and payout from tiers', async () => {
    expect((await ctx.api('post', '/incentive/calculations').send({ period: '2026-09', selectedPrograms: [] })).status).toBe(400);
    expect((await ctx.api('post', '/incentive/calculations').send({ period: '2026-09', selectedPrograms: ['INC-2026-004'] })).status).toBe(400);
    const r = await ctx.api('post', '/incentive/calculations').send({ period: 'September 2026', selectedPrograms: ['INC-2026-002', 'INC-2026-001'], description: 'Sept run' });
    expect(r.status).toBe(201);
    batchId = r.body.data.batchId;
    expect(r.body.data).toMatchObject({ period: 'September 2026', periodFrom: '2026-09-01', periodTo: '2026-09-30', status: 'Calculated' });
    const nb = r.body.data.details.find((d) => d.agentId === agentId && d.programCode === 'INC-2026-002');
    expect(nb).toMatchObject({ achieved: 2, baseIncentive: 1000, finalAmount: 1000, tier: '0-10 policies' });
    const pa = r.body.data.details.find((d) => d.agentId === agentId && d.programCode === 'INC-2026-001');
    expect(pa.finalAmount).toBe(0);
    expect((await ctx.api('post', '/incentive/calculations').send({ period: '2026-09', selectedPrograms: ['INC-2026-002'] })).status).toBe(409);
    const adj = await ctx.api('post', `/incentive/calculations/${batchId}/adjust`).send({ lines: [{ id: nb.id, adjustments: 250, reason: 'Spot bonus' }] });
    expect(adj.body.data.details.find((d) => d.id === nb.id)).toMatchObject({ finalAmount: 1250, status: 'Adjusted' });
    expect(adj.body.data.totalAmount).toBe(1250);
  });
  it('maker-checker approval, rejection and payment', async () => {
    expect((await ctx.api('post', `/incentive/calculations/${batchId}/approve`)).status).toBe(409);
    expect((await ctx.api('post', `/incentive/calculations/${batchId}/submit`)).body.data.status).toBe('Pending Approval');
    expect((await ctx.api('post', `/incentive/calculations/${batchId}/approve`)).status).toBe(403);
    expect((await as(checkerTok, 'post', `/incentive/calculations/${batchId}/reject`).send({})).status).toBe(400);
    expect((await as(checkerTok, 'post', `/incentive/calculations/${batchId}/reject`).send({ reason: 'Recheck' })).body.data.status).toBe('Rejected');
    const again = await ctx.api('post', '/incentive/calculations').send({ period: '2026-09', selectedPrograms: ['INC-2026-002'] });
    expect(again.status).toBe(201);
    const b2 = again.body.data.batchId;
    await ctx.api('post', `/incentive/calculations/${b2}/submit`);
    const ap = await as(checkerTok, 'post', `/incentive/calculations/${b2}/approve`);
    expect(ap.body.data).toMatchObject({ status: 'Approved', approvedBy: 'Ina Checker' });
    expect((await ctx.api('post', `/incentive/calculations/${b2}/pay`).send({ paymentDate: '2026-09-30', paymentReference: 'PV-1' })).body.data.status).toBe('Paid');
    const board = await ctx.api('get', '/incentive/approvals');
    expect(board.body.data.summary.pending).toBeGreaterThanOrEqual(1);
    expect(board.body.data.approvals.length).toBeGreaterThanOrEqual(6);
  });
});

describe('agent views and reports', () => {
  it('agents see their own programs and statement, not other agents', async () => {
    const mp = await as(agentTok, 'get', '/incentive/my-programs');
    expect(mp.status).toBe(200);
    expect(mp.body.data).toMatchObject({ agentId, agentCode: 'AG900' });
    // progress of the current calculation period of the monthly program (the target applies per month), to date
    const nbc = mp.body.data.assignedPrograms.find((p) => p.programCode === 'INC-2026-002');
    const { today } = await import('../src/lib/dates.js');
    const t = await today();
    expect(nbc).toMatchObject({ calculationFrequency: 'Monthly', periodFrom: `${t.slice(0, 7)}-01` });
    const inMonth = (await pool.query(`SELECT count(*)::int AS n FROM policies WHERE owner_user_id = $1 AND status <> 'cancelled'
      AND inception_date BETWEEN $2::date AND $3::date`, [agentId, `${t.slice(0, 7)}-01`, t])).rows[0].n;
    expect(nbc.achieved).toBe(inMonth);
    expect(mp.body.data.recentActivities.length).toBe(2);
    const st = await as(agentTok, 'get', '/incentive/statement?period=2026-09');
    expect(st.body.data).toMatchObject({ agentName: 'Ivy Agent', period: 'September 2026', totalEarnings: 1000, lastPayment: 1000 });
    expect(st.body.data.monthlyTrend).toHaveLength(13);
    const other = (await pool.query('SELECT id FROM users WHERE username = \'agent.msantos\'')).rows[0].id;
    expect((await as(agentTok, 'get', `/incentive/statement?agentId=${other}`)).status).toBe(403);
    const adm = await ctx.api('get', `/incentive/statement?agentId=${other}&period=2026-07`);
    expect(adm.body.data.totalEarnings).toBe(24000);
    expect((await as(agentTok, 'get', '/incentive/calculations')).status).toBe(403);
    expect((await as(agentTok, 'post', '/incentive/programs').send({})).status).toBe(403);
  });
  it('agent lists, report templates and report generation', async () => {
    expect((await ctx.api('get', '/incentive/agents')).body.data.length).toBeGreaterThanOrEqual(6);
    expect((await ctx.api('get', '/incentive/branches')).body.data.length).toBeGreaterThanOrEqual(3);
    expect((await ctx.api('get', '/incentive/agent-programs')).body.data.length).toBeGreaterThanOrEqual(6);
    const t = await ctx.api('get', '/incentive/reports/templates');
    expect(t.body.data).toHaveLength(5);
    const g = await ctx.api('post', '/incentive/reports/generate').send({ templateId: t.body.data[0].id, parameters: { period: '2026-07' }, format: 'Excel' });
    expect(g.status).toBe(201);
    expect(g.body.data.rowCount).toBe(5);
    const top = await ctx.api('post', '/incentive/reports/generate').send({ templateId: 'IRT-004', parameters: { 'Top N': 2 } });
    expect(top.body.data.rowCount).toBe(2);
    expect((await ctx.api('get', '/incentive/reports')).body.data).toHaveLength(2);
  });
});
