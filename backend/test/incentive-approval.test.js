/**
 * Approval of incentive calculation batches: the approve:incentive permission (migration 0387), maker-checker on the
 * creator and the submitter, the coded rejection reason, approval remarks and the activity log of a batch; the facts
 * My Programs, the statement and the reports read (tiers, next tier, incentive events, payment history, parameters).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { nextTier, tiersOf } from '../src/modules/incentive/service.js';

let ctx;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, permissions, displayName = username) {
  const role = `${username.replace(/\./g, '-')}-role`;
  expect((await ctx.api('post', '/roles').send({ code: role, name: `Role ${username}`, permissions })).status).toBe(201);
  expect((await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles: [role] })).status).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  const call = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  call.id = (await q('SELECT id FROM users WHERE username = $1', [username]))[0].id;
  return call;
}

let maker;
let submitter;
let checker;
let calculator;
let viewer;
beforeAll(async () => {
  ctx = await setup();
  const base = ['read:profile', 'read:incentive', 'write:incentive'];
  maker = await persona('ia.maker', [...base, 'approve:incentive'], 'Mara Maker');
  submitter = await persona('ia.submitter', [...base, 'approve:incentive'], 'Sid Submitter');
  checker = await persona('ia.checker', [...base, 'approve:incentive'], 'Cora Checker');
  calculator = await persona('ia.calculator', base, 'Cal Culator');
  viewer = await persona('ia.viewer', ['read:profile', 'read:incentive'], 'Vic Viewer');
  // a producer with one new policy in each month the batches below are run for (a batch with no agent line is refused)
  expect((await ctx.api('post', '/users').send({ username: 'ia.agent', password: 'Welcome@123', displayName: 'Ava Agent', email: 'ia.agent@example.ph', roles: ['sales'] })).status).toBe(201);
  const agent = (await q('SELECT id FROM users WHERE username = \'ia.agent\''))[0].id;
  const policies = await q('SELECT id FROM policies WHERE status <> \'cancelled\' ORDER BY policy_number LIMIT 3');
  for (const [i, day] of ['2026-07-15', '2026-06-15', '2026-05-15'].entries()) {
    await q('UPDATE policies SET owner_user_id = $2, inception_date = $3 WHERE id = $1', [policies[i].id, agent, day]);
  }
});
afterAll(async () => { await pool.end(); });

const runBatch = async (period) => {
  const r = await maker('post', '/incentive/calculations').send({ period, selectedPrograms: ['INC-2026-002'], description: `Run ${period}` });
  expect(r.status).toBe(201);
  return r.body.data;
};

describe('the approve:incentive permission (migration 0387)', () => {
  it('exists and is held by every role that holds write:incentive', async () => {
    expect(await q("SELECT code FROM permissions WHERE code = 'approve:incentive'")).toHaveLength(1);
    const missing = await q(`SELECT r.code FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions w ON w.id = rp.permission_id AND w.code = 'write:incentive'
      WHERE r.code IN ('accounting', 'tis-sales-unit-head', 'system-admin')
        AND NOT EXISTS (SELECT 1 FROM role_permissions x JOIN permissions a ON a.id = x.permission_id WHERE x.role_id = r.id AND a.code = 'approve:incentive')`);
    expect(missing).toEqual([]);
    const col = await q("SELECT 1 FROM information_schema.columns WHERE table_name = 'incentive_calculations' AND column_name = 'approval_remarks'");
    expect(col).toHaveLength(1);
  });
});

describe('maker-checker on a batch', () => {
  let batch;
  it('tells the screen who made the batch', async () => {
    batch = await runBatch('2026-07');
    expect((await submitter('post', `/incentive/calculations/${batch.batchId}/submit`)).status).toBe(200);
    const b = (await viewer('get', `/incentive/calculations/${batch.batchId}`)).body.data;
    expect(b).toMatchObject({ status: 'Pending Approval', createdById: maker.id, createdByUsername: 'ia.maker', submittedById: submitter.id, submittedByUsername: 'ia.submitter' });
    expect(b.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('refuses the decision to the creator, the submitter and users without the approval permission', async () => {
    for (const who of [maker, submitter]) {
      const r = await who('post', `/incentive/calculations/${batch.batchId}/approve`).send({});
      expect(r.status).toBe(403);
      expect(r.body.message).toMatch(/Maker-checker/);
      expect((await who('post', `/incentive/calculations/${batch.batchId}/reject`).send({ reasonCode: 'IBR-DATA' })).status).toBe(403);
    }
    for (const who of [calculator, viewer]) {
      expect((await who('post', `/incentive/calculations/${batch.batchId}/approve`).send({})).status).toBe(403);
      expect((await who('post', `/incentive/calculations/${batch.batchId}/reject`).send({ reasonCode: 'IBR-DATA' })).status).toBe(403);
    }
    expect((await viewer('get', `/incentive/calculations/${batch.batchId}`)).body.data.status).toBe('Pending Approval');
  });
  it('rejects with a reason of the incentive_batch_reject context only', async () => {
    const reject = (body) => checker('post', `/incentive/calculations/${batch.batchId}/reject`).send(body);
    let r = await reject({ reason: 'Free text' });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].path).toBe('reasonCode');
    expect((await reject({ reasonCode: 'PCL-MONTHEND' })).status).toBe(400);
    r = await reject({ reasonCode: 'IBR-OTHER' });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].path).toBe('note');
    r = await reject({ reasonCode: 'IBR-RATES', note: 'Tier 2 rate' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'Rejected', rejectedBy: 'Cora Checker', rejectionReasonCode: 'IBR-RATES', rejectionReason: 'Rates or targets to be corrected: Tier 2 rate' });
  });
  it('approves with remarks once submitted again, by another user', async () => {
    const s = await submitter('post', `/incentive/calculations/${batch.batchId}/submit`);
    expect(s.body.data).toMatchObject({ status: 'Pending Approval', rejectionReason: null, rejectionReasonCode: null });
    const r = await checker('post', `/incentive/calculations/${batch.batchId}/approve`).send({ remarks: 'Checked against the production report' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'Approved', approvedBy: 'Cora Checker', approvalRemarks: 'Checked against the production report' });
    // the accrual is dated at the end of the incentive period, which is open
    const jv = (await q('SELECT to_char(jv_date, \'YYYY-MM-DD\') AS d FROM journal_vouchers WHERE reference_id = $1 AND entry_type = \'INCENTIVE_ACCRUAL\'', [batch.batchId]))[0];
    expect(jv).toEqual({ d: '2026-07-31' });
  });
  it('lists the batch on My Work only for approvers who neither ran nor submitted it', async () => {
    const other = await runBatch('2026-06');
    await submitter('post', `/incentive/calculations/${other.batchId}/submit`);
    const onList = async (who) => ((await who('get', `/my-work/items?search=${other.batchId}`)).body.data || []).some((i) => i.ref === other.batchId);
    expect(await onList(checker)).toBe(true);
    expect(await onList(maker)).toBe(false);
    expect(await onList(submitter)).toBe(false);
    expect(await onList(calculator)).toBe(false);
  });
  it('gives the activity log of the batch with users, roles, status moves and remarks', async () => {
    const r = await viewer('get', `/incentive/calculations/${batch.batchId}/activity`);
    expect(r.status).toBe(200);
    const log = r.body.data;
    expect(log.map((e) => e.actionCode)).toEqual(['calculate', 'submit', 'reject', 'submit', 'approve']);
    expect(log[0]).toMatchObject({ remarks: 'Run 2026-07', user: { displayName: 'Mara Maker', username: 'ia.maker' }, changes: [] });
    expect(log[0].user.roles).toEqual(['Role ia.maker']);
    expect(log.map((e) => e.actionLabel)).toEqual(['Calculated', 'Submitted for approval', 'Rejected', 'Submitted for approval', 'Approved']);
    expect(log[0]).toMatchObject({ toStatus: 'Calculated', source: null });
    expect(log[2]).toMatchObject({ fromStatus: 'Pending Approval', toStatus: 'Rejected', remarks: 'Rates or targets to be corrected: Tier 2 rate', user: { displayName: 'Cora Checker' } });
    expect(log[4]).toMatchObject({ fromStatus: 'Pending Approval', toStatus: 'Approved', remarks: 'Checked against the production report' });
    expect(log[4].date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect((await viewer('get', '/incentive/calculations/CALC-NONE/activity')).status).toBe(404);
  });
});

describe('adjusting a batch', () => {
  it('needs a reason of the incentive_adjustment context, and the adjuster may not approve the batch', async () => {
    const b = await runBatch('2026-05');
    const line = b.details[0];
    const adjust = (body) => checker('post', `/incentive/calculations/${b.batchId}/adjust`).send({ lines: [{ id: line.id, adjustments: 200 }], ...body });
    expect((await adjust({ reason: 'Spot bonus' })).body.errors[0].path).toBe('reasonCode');
    expect((await adjust({ reasonCode: 'IBR-DATA' })).status).toBe(400);
    const adj = await adjust({ reasonCode: 'IAD-PRODUCTION' });
    expect(adj.status, JSON.stringify(adj.body)).toBe(200);
    expect(adj.body.data).toMatchObject({ adjustedByUsernames: ['ia.checker'], adjustedBy: ['Cora Checker'], programNames: ['New Business Champion'] });
    expect(adj.body.data.details[0]).toMatchObject({ adjustmentReasonCode: 'IAD-PRODUCTION', adjustmentReason: 'Production corrected after the calculation', status: 'Adjusted' });
    expect((await submitter('post', `/incentive/calculations/${b.batchId}/submit`)).status).toBe(200);
    const refused = await checker('post', `/incentive/calculations/${b.batchId}/approve`).send({});
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/Maker-checker/);
    const log = (await viewer('get', `/incentive/calculations/${b.batchId}/activity`)).body.data;
    expect(log.map((e) => e.actionLabel)).toEqual(['Calculated', 'Adjusted', 'Submitted for approval']);
    expect(log[1].remarks).toBe('Production corrected after the calculation');
  });

  it('calculates a quarterly program over its quarter, in the last month of the quarter only', async () => {
    const early = await maker('post', '/incentive/calculations').send({ period: '2026-08', selectedPrograms: ['INC-2026-001'] });
    expect(early.status).toBe(400);
    expect(early.body.errors[0].message).toMatch(/INC-2026-001 is calculated quarterly: its period ends in September 2026; run it for September 2026/);
  });

  it('refuses a run with no agent line, and the submission of an empty batch', async () => {
    await q('UPDATE policies SET inception_date = inception_date + 31 WHERE inception_date BETWEEN \'2026-01-01\' AND \'2026-01-31\'');
    const r = await maker('post', '/incentive/calculations').send({ period: '2026-01', selectedPrograms: ['INC-2026-002'] });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].message).toMatch(/INC-2026-002 for January 2026; there is nothing to calculate/);
    await q(`INSERT INTO incentive_calculations(batch_id, period, period_from, period_to, programs_included, total_amount, agent_count, status, created_by)
             VALUES ('CALC-EMPTY', 'April 2026', '2026-04-01', '2026-04-30', '["INC-2026-002"]', 0, 0, 'Calculated', $1)`, [maker.id]);
    const s = await maker('post', '/incentive/calculations/CALC-EMPTY/submit');
    expect(s.status).toBe(409);
    expect(s.body.message).toMatch(/no agent lines/);
  });
});

describe('facts of the agent screens', () => {
  const program = { metric: 'premium', structure: [{ level: '80-90%', type: 'Percentage', value: 2, maxPayout: 20000 }, { level: '90-100%', type: 'Percentage', value: 3 }] };
  const count = { metric: 'policies', structure: [{ level: '0-10 policies', type: 'Fixed Amount', value: 500 }, { level: '11-20 policies', type: 'Fixed Amount', value: 750 }] };
  it('says how each tier pays and what the next tier needs', () => {
    expect(tiersOf(program).map((t) => t.basis)).toEqual(['percentOfAchieved', 'percentOfAchieved']);
    expect(tiersOf(count)[0]).toMatchObject({ basis: 'perUnit', value: 500, maxPayout: null });
    expect(nextTier(program, 300000, 500000)).toEqual({ level: '80-90%', needed: 100000 });
    expect(nextTier(program, 420000, 500000)).toEqual({ level: '90-100%', needed: 30000 });
    expect(nextTier(program, 480000, 500000)).toBeNull();
    expect(nextTier(count, 4, 20)).toEqual({ level: '11-20 policies', needed: 7 });
  });
  it('My Programs carries the tiers, the measure and the incentive events of the agent', async () => {
    const agent = (await q("SELECT r.agent_user_id AS id FROM incentive_results r JOIN incentive_calculations c ON c.batch_id = r.calculation_id WHERE c.status = 'Approved' LIMIT 1"))[0].id;
    const r = await ctx.api('get', `/incentive/my-programs?agentId=${agent}`);
    const nbc = r.body.data.assignedPrograms.find((p) => p.programCode === 'INC-2026-002');
    expect(nbc).toMatchObject({ metric: 'policies', programStatus: 'Active', applicableTo: expect.any(Array), ended: expect.any(Boolean) });
    expect(nbc.tiers).toHaveLength(4);
    expect(r.body.data.activity.length).toBeGreaterThan(0);
    expect(r.body.data.activity[0]).toMatchObject({ action: expect.stringMatching(/calculated|approved|rejected|paid/), batchId: expect.any(String), period: expect.any(String) });
    const dates = r.body.data.activity.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
  it('the statement lists the approved and paid batches of the agent', async () => {
    const agent = (await q("SELECT r.agent_user_id AS id FROM incentive_results r JOIN incentive_calculations c ON c.batch_id = r.calculation_id WHERE c.status = 'Paid' LIMIT 1"))[0].id;
    const st = (await ctx.api('get', `/incentive/statement?agentId=${agent}&period=2026-07`)).body.data;
    expect(st.paymentHistory.length).toBeGreaterThan(0);
    expect(st.paymentHistory.find((h) => h.status === 'Paid')).toMatchObject({ batchId: expect.any(String), period: expect.any(String), programs: expect.any(Array), amount: expect.any(Number),
      paymentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });
  it('reports read the agent, branch, period range and minimum achievement', async () => {
    const tpl = (await ctx.api('get', '/incentive/reports/templates')).body.data.find((t) => t.code === 'IRT-003');
    const all = await ctx.api('post', '/incentive/reports/generate').send({ templateId: tpl.id, parameters: {} });
    const high = await ctx.api('post', '/incentive/reports/generate').send({ templateId: tpl.id, parameters: { minAchievement: 100 } });
    expect(high.body.data.rowCount).toBeLessThan(all.body.data.rowCount);
    const [agent] = await q("SELECT DISTINCT agent_user_id AS id FROM incentive_results WHERE status <> 'Rejected' LIMIT 1");
    const mine = await ctx.api('post', '/incentive/reports/generate').send({ templateId: tpl.id, parameters: { agent: agent.id } });
    const [{ n }] = await q("SELECT count(*)::int AS n FROM incentive_results WHERE agent_user_id = $1 AND status <> 'Rejected'", [agent.id]);
    expect(mine.body.data.rowCount).toBe(n);
    const none = await ctx.api('post', '/incentive/reports/generate').send({ templateId: tpl.id, parameters: { from: '2030-01-01', to: '2030-12-31' } });
    expect(none.body.data.rowCount).toBe(0);
  });
});
