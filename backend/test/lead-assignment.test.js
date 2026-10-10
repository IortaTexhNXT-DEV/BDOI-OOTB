import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { leadAssignmentSla } from '../src/modules/leads/assignment.js';

let ctx;
const ids = {};
const tokens = {};

async function persona(username, roles, reportingTo = null) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles, ...(reportingTo ? { reportingTo } : {}) });
  ids[username] = (await pool.query('SELECT id FROM users WHERE username = $1', [username])).rows[0].id;
  if (reportingTo) await pool.query('UPDATE users SET reporting_to = $2 WHERE id = $1', [ids[username], reportingTo]);
  tokens[username] = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tokens[username]}`);
}
const setting = async (key, value) => {
  await pool.query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};

let manager;
let ae1;

let ops;
beforeAll(async () => {
  ctx = await setup();
  await pool.query('DELETE FROM lead_assignment_rules');
  manager = await persona('la.manager', ['sales']);
  ae1 = await persona('la.ae1', ['sales'], ids['la.manager']);
  await persona('la.ae2', ['sales'], ids['la.manager']);
  ops = await persona('la.ops', ['operations']);
});
afterAll(async () => { await pool.end(); });

describe('lead assignment rules', () => {
  let ruleId;
  it('only the lead assignment team maintains rules; assignees must be active users', async () => {
    const denied = await ae1('post', '/lead-assignment/rules').send({ name: 'x', assignees: [ids['la.ae1']] });
    expect(denied.status).toBe(403);
    const bad = await ops('post', '/lead-assignment/rules').send({ name: 'Bad', assignees: ['usr_nobody'] });
    expect(bad.status).toBe(400);
    const r = await ops('post', '/lead-assignment/rules').send({ name: 'Metro Manila motor', priority: 10, method: 'round_robin',
      conditions: { lob: 'Motor', province: 'Metro Manila' }, assignees: [ids['la.ae1'], ids['la.ae2']] });
    expect(r.status).toBe(201);
    expect(r.body.data.conditions).toEqual({ lob: 'MOTOR', province: 'Metro Manila' });
    expect(r.body.data.assigneeNames).toEqual(['la.ae1', 'la.ae2']);
    ruleId = r.body.data.id;
  });

  it('assigns matching prospects in turn (round robin) and records the history', async () => {
    const owners = [];
    for (const n of [1, 2, 3]) {
      const l = await manager('post', '/leads').send({ firstName: `Robin${n}`, lob: 'MOTOR', province: 'Metro Manila', city: 'Makati City' });
      expect(l.status).toBe(201);
      owners.push(l.body.ownerUserId);
    }
    expect(owners).toEqual([ids['la.ae1'], ids['la.ae2'], ids['la.ae1']]);
    const lead = (await pool.query("SELECT id, assignment_rule_id, assignment_status FROM leads WHERE first_name = 'Robin2'")).rows[0];
    expect(lead.assignment_rule_id).toBe(ruleId);
    const h = await manager('get', `/lead-assignment/history/${lead.id}`);
    expect(h.status).toBe(200);
    expect(h.body.data[0]).toMatchObject({ action: 'auto', toName: 'la.ae2', ruleName: 'Metro Manila motor' });
    // the assignee is told
    const n = (await pool.query("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND title = 'Prospect assigned to you'", [ids['la.ae2']])).rows[0].n;
    expect(n).toBe(1);
  });

  it('a prospect no rule matches stays with its creator, or goes to the queue when leads.assignment_fallback is queue', async () => {
    const kept = await manager('post', '/leads').send({ firstName: 'Cebuano', lob: 'FIRE', province: 'Cebu' });
    expect(kept.body.ownerUserId).toBe(ids['la.manager']);
    expect(kept.body.assignmentStatus).toBe('assigned');
    // with no move recorded, its history is the assignment it has: to whom and by whom
    const kh = await manager('get', `/lead-assignment/history/${kept.body.leadId || kept.body.id}`);
    expect(kh.body.data).toHaveLength(1);
    expect(kh.body.data[0]).toMatchObject({ action: 'manual', toUserId: ids['la.manager'], fromName: null });
    expect(kh.body.data[0].toName).toBeTruthy();
    await setting('leads.assignment_fallback', 'queue');
    const queued = await manager('post', '/leads').send({ firstName: 'Davaoeno', lob: 'FIRE', province: 'Davao del Sur' });
    expect(queued.body.assignmentStatus).toBe('queued');
    expect(queued.body.queueReason).toBe('No assignment rule matched');
    await setting('leads.assignment_fallback', 'creator');
  });

  it('load balancing gives the prospect to the assignee with the fewest open prospects; fixed always to the first', async () => {
    await ops('put', `/lead-assignment/rules/${ruleId}`).send({ method: 'load' });
    // la.ae1 has 2 open prospects, la.ae2 has 1
    const l = await manager('post', '/leads').send({ firstName: 'Loader', lob: 'MOTOR', province: 'Metro Manila' });
    expect(l.body.ownerUserId).toBe(ids['la.ae2']);
    await ops('put', `/lead-assignment/rules/${ruleId}`).send({ method: 'fixed', assignees: [ids['la.ae2'], ids['la.ae1']] });
    const f = await manager('post', '/leads').send({ firstName: 'Fixed', lob: 'MOTOR', province: 'Metro Manila' });
    expect(f.body.ownerUserId).toBe(ids['la.ae2']);
  });

  it('queues a prospect whose rule has no active assignee', async () => {
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = ANY($1)", [[ids['la.ae1'], ids['la.ae2']]]);
    const l = await manager('post', '/leads').send({ firstName: 'Orphan', lob: 'MOTOR', province: 'Metro Manila' });
    expect(l.body.assignmentStatus).toBe('queued');
    expect(l.body.queueReason).toMatch(/No active account executive/);
    await pool.query("UPDATE users SET status = 'active' WHERE id = ANY($1)", [[ids['la.ae1'], ids['la.ae2']]]);
  });
});

describe('reassignment queue, bulk reassignment and team view', () => {
  it('lists the queue and reassigns from it; bulk reassignment moves many prospects with history and audit', async () => {
    const q = await ops('get', '/lead-assignment/queue');
    expect(q.status).toBe(200);
    const names = q.body.data.map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining(['Davaoeno', 'Orphan']));
    const r = await ops('post', '/lead-assignment/reassign').send({ leadIds: q.body.data.map((x) => x.id), toUserId: ids['la.ae1'], reason: 'Queue review' });
    expect(r.status).toBe(200);
    expect(r.body.data.reassigned).toBe(q.body.data.length);
    expect((await ops('get', '/lead-assignment/queue')).body.data).toEqual([]);
    const h = await pool.query("SELECT action FROM lead_assignment_history h JOIN leads l ON l.id = h.lead_id WHERE l.first_name = 'Orphan' ORDER BY h.id DESC LIMIT 1");
    expect(h.rows[0].action).toBe('bulk');
    const audit = (await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'lead' AND action = 'reassign'")).rows[0].n;
    expect(audit).toBe(q.body.data.length);
    const denied = await ae1('post', '/lead-assignment/reassign').send({ leadIds: [q.body.data[0].id], toUserId: ids['la.ae2'] });
    expect(denied.status).toBe(403);
  });

  it('sends prospects to the queue by hand with a reason', async () => {
    const lead = (await pool.query("SELECT id FROM leads WHERE first_name = 'Robin1'")).rows[0];
    const bad = await ops('post', '/lead-assignment/queue').send({ leadIds: [lead.id], reason: '' });
    expect(bad.status).toBe(400);
    const r = await ops('post', '/lead-assignment/queue').send({ leadIds: [lead.id], reason: 'Account executive on leave' });
    expect(r.body.data.queued).toBe(1);
    expect((await ops('get', '/lead-assignment/queue')).body.data[0]).toMatchObject({ name: 'Robin1', queueReason: 'Account executive on leave' });
  });

  it('the team view shows a manager the prospects of everyone reporting to them, and not another team', async () => {
    const t = await manager('get', '/lead-assignment/team');
    expect(t.status).toBe(200);
    expect(t.body.data.members.map((m) => m.username)).toEqual(['la.manager', 'la.ae1', 'la.ae2']);
    const ae1Row = t.body.data.members.find((m) => m.username === 'la.ae1');
    expect(ae1Row.depth).toBe(1);
    expect(ae1Row.open).toBeGreaterThan(0);
    expect(t.body.data.leads.every((l) => [ids['la.manager'], ids['la.ae1'], ids['la.ae2']].includes(l.ownerUserId))).toBe(true);
    const one = await manager('get', `/lead-assignment/team?memberId=${ids['la.ae2']}`);
    expect(one.body.data.leads.every((l) => l.ownerUserId === ids['la.ae2'])).toBe(true);
    // an account executive sees their own team (themselves) only, not their manager's
    const own = await ae1('get', `/lead-assignment/team?managerId=${ids['la.manager']}`);
    expect(own.status).toBe(403);
    // the lead assignment team may open any team
    const any = await ops('get', `/lead-assignment/team?managerId=${ids['la.manager']}`);
    expect(any.status).toBe(200);
  });

  it('the daily job queues prospects still New after leads.assignment_sla_hours', async () => {
    await pool.query("UPDATE leads SET assigned_at = now() - interval '3 days' WHERE first_name = 'Robin3'");
    const out = await leadAssignmentSla();
    expect(out.queued).toBeGreaterThanOrEqual(1);
    const l = (await pool.query("SELECT assignment_status, queue_reason FROM leads WHERE first_name = 'Robin3'")).rows[0];
    expect(l).toEqual({ assignment_status: 'queued', queue_reason: 'Not worked within 48 hours' });
    await setting('leads.assignment_sla_hours', 0);
    expect((await leadAssignmentSla()).skipped).toMatch(/0/);
  });

  it('a rule that assigned prospects is deactivated rather than deleted', async () => {
    const rule = (await pool.query('SELECT id FROM lead_assignment_rules LIMIT 1')).rows[0];
    const r = await ops('delete', `/lead-assignment/rules/${rule.id}`);
    expect(r.body.data.removed).toBe(false);
    expect((await pool.query('SELECT status FROM lead_assignment_rules WHERE id = $1', [rule.id])).rows[0].status).toBe('inactive');
  });
});

describe('reassignment reasons, taking from the queue and running the rules', () => {
  const lead = async (firstName) => (await pool.query('SELECT id, lead_number FROM leads WHERE first_name = $1', [firstName])).rows[0];

  it('a reassignment needs a reason of the Reason Codes master (reassignment) or a note while leads.reassignment_reason_required', async () => {
    const l = await lead('Robin2');
    const none = await ops('post', '/lead-assignment/reassign').send({ leadIds: [l.id], toUserId: ids['la.ae1'] });
    expect(none.status).toBe(400);
    const wrong = await ops('post', '/lead-assignment/reassign').send({ leadIds: [l.id], toUserId: ids['la.ae1'], reasonCode: 'LAP-FUNDS' });
    expect(wrong.status).toBe(400);
    const noNote = await ops('post', '/lead-assignment/reassign').send({ leadIds: [l.id], toUserId: ids['la.ae1'], reasonCode: 'REA-OTHER' });
    expect(noNote.status).toBe(400);
    const r = await ops('post', '/lead-assignment/reassign').send({ leadIds: [l.id], toUserId: ids['la.ae1'], reasonCode: 'REA-TERRITORY', reason: 'Moved to Cebu' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ reasonCode: 'REA-TERRITORY', reason: 'Territory or branch change: Moved to Cebu' });
    const h = await ops('get', `/lead-assignment/history/${l.id}`);
    expect(h.body.data[0]).toMatchObject({ action: 'manual', reasonCode: 'REA-TERRITORY', toName: 'la.ae1' });
    await setting('leads.reassignment_reason_required', false);
    expect((await ops('post', '/lead-assignment/reassign').send({ leadIds: [l.id], toUserId: ids['la.ae2'] })).status).toBe(200);
    await setting('leads.reassignment_reason_required', true);
  });

  it('sends to the queue with a reason code, filters the queue by it, and the team takes a queued prospect', async () => {
    const l = await lead('Robin2');
    const q = await ops('post', '/lead-assignment/queue').send({ leadIds: [l.lead_number], reasonCode: 'REA-LEAVE' });
    expect(q.status).toBe(200);
    expect(q.body.data).toMatchObject({ queued: 1, reasonCode: 'REA-LEAVE', reason: 'Account executive on leave' });
    const list = await ops('get', '/lead-assignment/queue?reasonCode=REA-LEAVE');
    expect(list.body.data.map((x) => x.leadNumber)).toEqual([l.lead_number]);
    expect(list.body.data[0]).toMatchObject({ queueReasonCode: 'REA-LEAVE', lob: 'MOTOR' });
    expect((await ops('get', '/lead-assignment/queue?lob=FIRE&reasonCode=REA-LEAVE')).body.data).toEqual([]);
    const notQueued = await lead('Fixed');
    expect((await ops('post', '/lead-assignment/queue/take').send({ leadIds: [notQueued.id] })).status).toBe(400);
    const taken = await ops('post', '/lead-assignment/queue/take').send({ leadIds: [l.id] });
    expect(taken.status).toBe(200);
    expect(taken.body.data.toUserId).toBe(ids['la.ops']);
    const h = await ops('get', `/lead-assignment/history/${l.id}`);
    expect(h.body.data[0]).toMatchObject({ action: 'taken', toName: 'la.ops' });
    expect((await ae1('post', '/lead-assignment/queue/take').send({ leadIds: [l.id] })).status).toBe(403);
  });

  it('orders the rules; a rule on the line NONE takes prospects without a product, a rule on a product only that product', async () => {
    await pool.query("UPDATE lead_assignment_rules SET status = 'inactive'");
    const untagged = await ops('post', '/lead-assignment/rules').send({ name: 'Untagged', priority: 50, method: 'fixed', conditions: { lob: 'none' }, assignees: [ids['la.ae2']] });
    expect(untagged.body.data.conditions).toEqual({ lob: 'NONE' });
    const product = (await pool.query("SELECT id FROM products WHERE code = 'CTPL'")).rows[0].id;
    const ctpl = await ops('post', '/lead-assignment/rules').send({ name: 'CTPL', priority: 60, method: 'fixed', conditions: { lob: 'MOTOR', productId: product }, assignees: [ids['la.ae1']] });
    const order = await ops('put', '/lead-assignment/rules/order').send({ ids: [ctpl.body.data.id, untagged.body.data.id] });
    expect(order.status).toBe(200);
    expect(order.body.data.filter((r) => r.status === 'active').map((r) => [r.name, r.priority])).toEqual([['CTPL', 10], ['Untagged', 20]]);
    const noProduct = await manager('post', '/leads').send({ firstName: 'Untagged1' });
    expect(noProduct.body.ownerUserId).toBe(ids['la.ae2']);
    const withCtpl = await manager('post', '/leads').send({ firstName: 'Ctpl1', lob: 'MOTOR', productId: product });
    expect(withCtpl.body.ownerUserId).toBe(ids['la.ae1']);
    const motor = await manager('post', '/leads').send({ firstName: 'Motor1', lob: 'MOTOR' });
    expect(motor.body.ownerUserId).toBe(ids['la.manager']);
  });

  it('suggests the assignees of the rule that matches the prospects being reassigned', async () => {
    const l = await lead('Untagged1');
    const r = await ops('get', `/lead-assignment/assignees?leadIds=${l.id}`);
    const ae2 = r.body.data.find((u) => u.id === ids['la.ae2']);
    expect(ae2).toMatchObject({ suggested: true, rules: ['Untagged'] });
    expect(r.body.data.find((u) => u.id === ids['la.ae1']).suggested).toBe(false);
  });

  it('runs the queue through the rules: a preview first, then the matching prospects are assigned', async () => {
    const l = await lead('Untagged1');
    await ops('post', '/lead-assignment/queue').send({ leadIds: [l.id], reason: 'Review' });
    const preview = await ops('post', '/lead-assignment/rules/run').send({ dryRun: true });
    expect(preview.status).toBe(200);
    expect(preview.body.data.assigned).toEqual(expect.arrayContaining([expect.objectContaining({ leadNumber: expect.any(String), name: 'Untagged1', ruleName: 'Untagged', toUserId: ids['la.ae2'] })]));
    expect((await pool.query('SELECT assignment_status FROM leads WHERE id = $1', [l.id])).rows[0].assignment_status).toBe('queued');
    const run = await ops('post', '/lead-assignment/rules/run').send({});
    expect(run.body.data.dryRun).toBe(false);
    expect((await pool.query('SELECT assignment_status, owner_user_id FROM leads WHERE id = $1', [l.id])).rows[0]).toEqual({ assignment_status: 'assigned', owner_user_id: ids['la.ae2'] });
    expect((await ops('get', `/lead-assignment/history/${l.id}`)).body.data[0]).toMatchObject({ action: 'auto', ruleName: 'Untagged' });
    expect((await ae1('post', '/lead-assignment/rules/run').send({})).status).toBe(403);
  });
});
