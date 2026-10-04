// Operations > My Work: open items per role and scope (sales sees its own book, a manager their team, accounting the
// approval queues within its authority), paging and sorting, reassignment, the work diary (tasks) with its permissions,
// automatic follow-up tasks and the reminder job.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { today, addDays } from '../src/lib/dates.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { myWorkReminders } from '../src/jobs/handlers.js';
import { syncAutoTasks } from '../src/modules/my-work/tasks.js';

let ctx;
let now;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);

async function makeUser(username, roles, reportingTo) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles,
    ...(reportingTo ? { reportingTo: ids[reportingTo] } : {}) });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = r.body.data.userId;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}
const items = async (who, qs = '') => {
  const r = await as(who, 'get', `/my-work/items?${qs}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
const refs = (body) => body.data.map((i) => i.ref);

beforeAll(async () => {
  ctx = await setup();
  now = await today();
  // a sales team (manager + one account executive), an account executive of another team, accounting with its manager, claims
  await makeUser('mw.salesmgr', ['sales']);
  await makeUser('mw.sales1', ['sales'], 'mw.salesmgr');
  await makeUser('mw.sales2', ['sales']);
  await makeUser('mw.acctmgr', ['accounting-manager']);
  await makeUser('mw.acct1', ['accounting'], 'mw.acctmgr');
  await makeUser('mw.acct2', ['accounting'], 'mw.acctmgr');
  await makeUser('mw.claimslead', ['claims']);
  await makeUser('mw.claims1', ['claims'], 'mw.claimslead');
  await makeUser('mw.claims2', ['claims'], 'mw.claimslead');
  await makeUser('mw.ops', ['operations']);

  const motor = "(SELECT id FROM products WHERE code = 'MOTOR')";
  for (const [n, owner] of [[1, 'mw.sales1'], [2, 'mw.sales2']]) {
    await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, owner_user_id, created_by)
      VALUES ($1, $2, $3, 'Client', $4, $5, $5)`, [`cl_mw${n}`, `CL-MW-000${n}`, `Mw Client ${n}`, String(n), ids[owner]]);
    await query(`INSERT INTO quotes(id, quote_number, client_id, product_id, agent_user_id, status, premium_total, valid_until, created_by)
      VALUES ($1, $2, $3, ${motor}, $4, 'sent', 15000, $5::date + 3, $4)`, [`qt_mw${n}`, `QT-MW-000${n}`, `cl_mw${n}`, ids[owner], now]);
    await query(`INSERT INTO policies(id, policy_number, client_id, product_id, owner_user_id, status, inception_date, expiry_date, premium_total, insured_name, lob, details)
      VALUES ($1, $2, $3, ${motor}, $4, 'active', $5::date - 300, $5::date + 20, 21000, $6, 'MOTOR', '{"idType":"UMID","idCardNumber":"0111-2222","idCardImage":"id-cards/x.png"}')`,
    [`pol_mw${n}`, `POL-MW-000${n}`, `cl_mw${n}`, ids[owner], now, `Mw Client ${n}`]);
    await query(`INSERT INTO receivables(id, bill_number, policy_id, client_id, amount, balance, due_date, status)
      VALUES ($1, $2, $3, $4, 21000, 21000, $5::date - 10, 'open')`, [`rcv_mw${n}`, `INV-MW-000${n}`, `pol_mw${n}`, `cl_mw${n}`, now]);
  }
  // a policy of sales1 without the customer's ID on file (Missing documents)
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, owner_user_id, status, inception_date, expiry_date, premium_total, insured_name, lob)
    VALUES ('pol_mw3', 'POL-MW-0003', 'cl_mw1', ${motor}, $1, 'active', $2::date - 30, $2::date + 335, 9000, 'Mw Client 1', 'MOTOR')`, [ids['mw.sales1'], now]);
  // maker-checker queues: a journal voucher of acct2, a payment voucher of acct1
  await query(`INSERT INTO journal_vouchers(id, jv_number, jv_date, description, status, total_debit, total_credit, created_by)
    VALUES ('jv_mw1', 'JV-MW-0001', $1, 'Accrual of September rent', 'for-approval', 5000, 5000, $2)`, [now, ids['mw.acct2']]);
  await query(`INSERT INTO disbursements(id, voucher_number, payee_type, payee_name, amount, status, created_by)
    VALUES ('dv_mw1', 'PV-MW-0001', 'supplier', 'Makati Office Supplies', 1200, 'for-approval', $1)`, [ids['mw.acct1']]);
  // claims: one handled by claims1, overdue for follow-up
  await query(`INSERT INTO claims(id, claim_number, policy_id, client_id, status, loss_date, reported_date, estimate_amount, handler_user_id, due_date, priority)
    VALUES ('clm_mw1', 'CLM-MW-0001', 'pol_mw1', 'cl_mw1', 'in-review', $1::date - 20, $1::date - 18, 45000, $2, $1::date - 1, 'High')`, [now, ids['mw.claims1']]);
});

afterAll(async () => {
  await pool.end();
});

describe('open items per role and scope', () => {
  it('sales sees its own book: quotation, premium due, expiring policy, missing ID', async () => {
    const body = await items('mw.sales1', 'pageSize=50');
    const mine = refs(body);
    expect(body.data.every((i) => i.category !== 'tasks')).toBe(true);
    expect(mine).toEqual(expect.arrayContaining(['QT-MW-0001', 'INV-MW-0001', 'POL-MW-0001', 'POL-MW-0003']));
    expect(mine).not.toContain('QT-MW-0002');
    expect(mine).not.toContain('JV-MW-0001');
    const rcv = body.data.find((i) => i.ref === 'INV-MW-0001');
    expect(rcv).toMatchObject({ category: 'receivables', overdue: true, priority: 'high', link: '/agent/payments/detail/rcv_mw1', ownerId: ids['mw.sales1'] });
    expect(body.data.find((i) => i.ref === 'POL-MW-0003')).toMatchObject({ category: 'documents', kind: 'Customer ID (KYC)' });
    expect(body.data.find((i) => i.ref === 'POL-MW-0001')).toMatchObject({ category: 'renewals', kind: 'Expiring policy' });
  });

  it('summary counts by category and the header figures, only categories the role may read', async () => {
    const r = await as('mw.sales1', 'get', '/my-work/summary');
    expect(r.status).toBe(200);
    const cats = Object.fromEntries(r.body.data.categories.map((c) => [c.code, c]));
    expect(cats.quotes.count).toBe(1);
    expect(cats.receivables).toMatchObject({ count: 1, overdue: 1 });
    expect(cats.collections).toBeUndefined(); // no read:collections
    expect(r.body.data.totals.overdue).toBeGreaterThanOrEqual(1);
    expect(r.body.data.team).toMatchObject({ size: 0, isManager: false });
  });

  it('a manager sees the team (users reporting to them), not their own scope nor other teams', async () => {
    const me = await items('mw.salesmgr', 'pageSize=50');
    expect(refs(me)).not.toContain('QT-MW-0001');
    const team = await items('mw.salesmgr', 'scope=team&pageSize=50');
    expect(refs(team)).toContain('QT-MW-0001');
    expect(refs(team)).not.toContain('QT-MW-0002');
    expect(team.data.find((i) => i.ref === 'QT-MW-0001').ownerName).toBe('mw.sales1');
    const b = await as('mw.salesmgr', 'get', '/my-work/team');
    expect(b.status).toBe(200);
    expect(b.body.data.members).toHaveLength(1);
    expect(b.body.data.members[0]).toMatchObject({ userId: ids['mw.sales1'], overdue: expect.any(Number) });
    expect(b.body.data.members[0].byCategory.quotes.count).toBe(1);
    const s = await as('mw.salesmgr', 'get', '/my-work/summary?scope=team');
    expect(s.body.data.team).toMatchObject({ size: 1, isManager: true });
  });

  it('team scope refuses a user outside the team; a user without a team has an empty team view', async () => {
    expect((await as('mw.salesmgr', 'get', `/my-work/items?scope=team&assignee=${ids['mw.sales2']}`)).status).toBe(403);
    expect((await items('mw.sales2', 'scope=team')).total).toBe(0);
  });

  it('accounting sees the approvals of others, never its own submission', async () => {
    const a1 = await items('mw.acct1', 'category=approvals');
    expect(refs(a1)).toContain('JV-MW-0001');
    expect(refs(a1)).not.toContain('PV-MW-0001');
    const a2 = await items('mw.acct2', 'category=approvals');
    expect(refs(a2)).toContain('PV-MW-0001');
    expect(refs(a2)).not.toContain('JV-MW-0001');
    expect(a1.data.find((i) => i.ref === 'JV-MW-0001')).toMatchObject({ queue: true, link: '/accounts/journalvoucher/detailsjournalvocture/jv_mw1' });
    // sales holds no approval permission
    expect((await items('mw.sales1', 'category=approvals')).total).toBe(0);
  });

  it('approvals above the user\'s authority limit (Authority Matrix) are left out', async () => {
    // a limit of the user's own wins over the limits of their roles
    await query(`INSERT INTO authority_limits(transaction_type, user_id, max_amount, status, effective_from, requested_by, remarks)
      VALUES ('journal_voucher', $3, 1000, 'active', $1::date - 1, $2, 'mw-test')`, [now, ids['mw.ops'], ids['mw.acct1']]);
    expect(refs(await items('mw.acct1', 'category=approvals'))).not.toContain('JV-MW-0001');
    // a higher limit lets it through
    await query(`INSERT INTO authority_limits(transaction_type, user_id, max_amount, status, effective_from, requested_by, remarks)
      VALUES ('journal_voucher', $1, 100000, 'active', $2::date - 1, $3, 'mw-test')`, [ids['mw.acctmgr'], now, ids['mw.ops']]);
    expect(refs(await items('mw.acctmgr', 'category=approvals'))).toContain('JV-MW-0001');
    await query("DELETE FROM authority_limits WHERE remarks = 'mw-test'");
  });

  it('claims: the handler sees the claim, the claims lead sees it in the team view', async () => {
    const c1 = await items('mw.claims1', 'category=claims');
    expect(c1.data.find((i) => i.ref === 'CLM-MW-0001')).toMatchObject({ overdue: true, priority: 'high', reassign: 'claim' });
    expect((await items('mw.claims2', 'category=claims')).total).toBe(0);
    expect(refs(await items('mw.claimslead', 'scope=team&category=claims'))).toContain('CLM-MW-0001');
  });

  it('pages, sorts and filters on the server', async () => {
    for (let i = 0; i < 25; i += 1) {
      await query(`INSERT INTO quotes(id, quote_number, client_id, agent_user_id, status, premium_total, valid_until, created_by)
        VALUES ($1, $2, 'cl_mw1', $3, 'draft', $4, $5::date + $6::int, $3)`, [`qt_mwp${i}`, `QT-MWP-${String(i).padStart(4, '0')}`, ids['mw.sales1'], 1000 + i, now, 30 - i]);
    }
    const p1 = await items('mw.sales1', 'category=quotes&pageSize=10&page=1');
    expect(p1).toMatchObject({ total: 26, page: 1, perPage: 10, totalPages: 3 });
    expect(p1.data).toHaveLength(10);
    const dates = p1.data.map((i) => i.dueDate);
    expect([...dates].sort()).toEqual(dates);
    const p3 = await items('mw.sales1', 'category=quotes&pageSize=10&page=3');
    expect(p3.data).toHaveLength(6);
    const seen = new Set([...refs(p1), ...refs(await items('mw.sales1', 'category=quotes&pageSize=10&page=2')), ...refs(p3)]);
    expect(seen.size).toBe(26);
    const desc = await items('mw.sales1', 'category=quotes&sort=amount&order=desc&pageSize=1');
    expect(desc.data[0].ref).toBe('QT-MW-0001');
    expect((await items('mw.sales1', 'search=QT-MWP-0007')).data.map((i) => i.ref)).toEqual(['QT-MWP-0007']);
    expect((await items('mw.sales1', 'due=overdue')).data.every((i) => i.overdue)).toBe(true);
    expect((await as('mw.sales1', 'get', '/my-work/items?due=someday')).status).toBe(400);
    expect((await as('mw.sales1', 'get', '/my-work/items?category=nothing')).status).toBe(400);
  });

  it('a user limited to their own book never sees another book, even with scope all', async () => {
    const r = await ctx.api('post', '/roles').send({ code: 'mw-own-book', name: 'Own book (my work test)', permissions: ['read:quotations', 'read:policies', 'read:profile'] });
    expect(r.status).toBe(201);
    await makeUser('mw.agent', ['mw-own-book']);
    await query("UPDATE quotes SET agent_user_id = $1, created_by = $1 WHERE id = 'qt_mwp0'", [ids['mw.agent']]);
    await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': ['mw-own-book'] } });
    const all = await items('mw.agent', 'scope=all&pageSize=100');
    expect(refs(all)).toEqual(['QT-MWP-0000']);
    await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': [] } });
  });
});

describe('reassignment', () => {
  it('the claims lead hands a claim of their team to another team member', async () => {
    const r = await as('mw.claimslead', 'post', '/my-work/items/reassign').send({ category: 'claims', id: 'clm_mw1', assignTo: ids['mw.claims2'] });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await one("SELECT handler_user_id FROM claims WHERE id = 'clm_mw1'")).handler_user_id).toBe(ids['mw.claims2']);
    expect(await one("SELECT 1 FROM notifications WHERE user_id = $1 AND entity = 'claim' AND entity_id = 'clm_mw1'", [ids['mw.claims2']])).toBeTruthy();
    expect(refs(await items('mw.claims2', 'category=claims'))).toContain('CLM-MW-0001');
  });

  it('refuses a reassignment outside one\'s team or without the module permission', async () => {
    expect((await as('mw.claims1', 'post', '/my-work/items/reassign').send({ category: 'claims', id: 'clm_mw1', assignTo: ids['mw.claims1'] })).status).toBe(403);
    expect((await as('mw.claimslead', 'post', '/my-work/items/reassign').send({ category: 'claims', id: 'clm_mw1', assignTo: ids['mw.sales1'] })).status).toBe(403);
    expect((await as('mw.salesmgr', 'post', '/my-work/items/reassign').send({ category: 'claims', id: 'clm_mw1', assignTo: ids['mw.sales1'] })).status).toBe(403);
  });
});

describe('tasks', () => {
  let own;
  let assigned;
  it('a user creates their own task with a reminder; a manager assigns one to their team member', async () => {
    const r = await as('mw.sales1', 'post', '/my-work/tasks').send({ title: 'Call Mw Client 1 about the renewal', dueDate: addDays(now, 1), dueTime: '10:30', priority: 'high',
      entity: 'policy', entityId: 'pol_mw1', reminderMinutes: 30 });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    own = r.body.data;
    expect(own).toMatchObject({ source: 'manual', assignedTo: ids['mw.sales1'], entityRef: 'POL-MW-0001', link: '/agent/policydetail/pol_mw1', reminderMinutes: 30, dueTime: '10:30', canDelete: true });
    const m = await as('mw.salesmgr', 'post', '/my-work/tasks').send({ title: 'Prepare the fleet proposal', dueDate: now, assignedTo: ids['mw.sales1'] });
    expect(m.status).toBe(201);
    assigned = m.body.data;
    expect(assigned).toMatchObject({ source: 'manager', createdBy: ids['mw.salesmgr'], dueToday: true });
    expect(await one("SELECT 1 FROM notifications WHERE user_id = $1 AND entity = 'task' AND entity_id = $2", [ids['mw.sales1'], assigned.id])).toBeTruthy();
    const list = await as('mw.sales1', 'get', '/my-work/tasks');
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.data.map((t) => t.id)).toEqual([assigned.id, own.id]);
    expect(list.body.counts).toMatchObject({ open: 2, today: 1 });
    const team = await as('mw.salesmgr', 'get', '/my-work/tasks?scope=team');
    expect(team.body.data.map((t) => t.id)).toEqual(expect.arrayContaining([own.id, assigned.id]));
  });

  it('refuses tasks for people outside one\'s team and related records the user cannot read', async () => {
    expect((await as('mw.salesmgr', 'post', '/my-work/tasks').send({ title: 'Not my team', dueDate: now, assignedTo: ids['mw.sales2'] })).status).toBe(403);
    expect((await as('mw.sales1', 'post', '/my-work/tasks').send({ title: 'Upwards', dueDate: now, assignedTo: ids['mw.salesmgr'] })).status).toBe(403);
    expect((await as('mw.claims1', 'post', '/my-work/tasks').send({ title: 'Quote', dueDate: now, entity: 'quote', entityId: 'qt_mw1' })).status).toBe(403);
    expect((await as('mw.sales1', 'post', '/my-work/tasks').send({ title: 'Ghost', dueDate: now, entity: 'policy', entityId: 'pol_none' })).status).toBe(400);
    expect((await as('mw.sales1', 'post', '/my-work/tasks').send({ title: 'x', dueDate: '04/10/2026' })).status).toBe(400);
  });

  it('only the people concerned see or change a task', async () => {
    expect((await as('mw.sales2', 'get', `/my-work/tasks/${own.id}`)).status).toBe(404);
    expect((await as('mw.sales2', 'put', `/my-work/tasks/${own.id}`).send({ title: 'Hijack' })).status).toBe(404);
    expect((await as('mw.salesmgr', 'get', `/my-work/tasks/${own.id}`)).status).toBe(200);
    // the assignee may not delete a task their manager gave them, nor pass it on; the manager may
    expect((await as('mw.sales1', 'delete', `/my-work/tasks/${assigned.id}`)).status).toBe(403);
    expect((await as('mw.sales1', 'put', `/my-work/tasks/${assigned.id}`).send({ assignedTo: ids['mw.salesmgr'] })).status).toBe(403);
    const moved = await as('mw.salesmgr', 'put', `/my-work/tasks/${assigned.id}`).send({ assignedTo: ids['mw.salesmgr'], dueTime: '15:00' });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.data).toMatchObject({ assignedTo: ids['mw.salesmgr'], dueTime: '15:00' });
    const del = await as('mw.salesmgr', 'delete', `/my-work/tasks/${assigned.id}`);
    expect(del.body.data.status).toBe('cancelled');
  });

  it('completes and reopens a task, with the audit trail', async () => {
    const done = await as('mw.sales1', 'post', `/my-work/tasks/${own.id}/complete`).send({ note: 'Client confirmed' });
    expect(done.body.data).toMatchObject({ status: 'done', completionNote: 'Client confirmed' });
    expect((await as('mw.sales1', 'post', `/my-work/tasks/${own.id}/complete`).send({})).status).toBe(409);
    expect((await as('mw.sales1', 'get', '/my-work/tasks?status=done')).body.data.map((t) => t.id)).toContain(own.id);
    const re = await as('mw.sales1', 'post', `/my-work/tasks/${own.id}/reopen`).send({});
    expect(re.body.data.status).toBe('open');
    const audits = (await query("SELECT action FROM audit_log WHERE entity = 'task' AND entity_id = $1 ORDER BY id", [own.id])).rows.map((r) => r.action);
    expect(audits).toEqual(['create', 'complete', 'reopen']);
  });

  it('open tasks count in My Work: header figures and the team breakdown', async () => {
    const s = await as('mw.sales1', 'get', '/my-work/summary');
    expect(s.body.data.categories.find((c) => c.code === 'tasks').count).toBe(1);
    const t = await as('mw.salesmgr', 'get', '/my-work/team');
    expect(t.body.data.members[0].byCategory.tasks.count).toBe(1);
    // the open tasks are listed with the other items, and alone with category=tasks
    expect((await items('mw.sales1', 'pageSize=100')).data.filter((i) => i.category === 'tasks').map((i) => i.id)).toEqual([own.id]);
    const only = await items('mw.sales1', 'category=tasks');
    expect(only.data[0]).toMatchObject({ id: own.id, link: `/operations/my-work?tab=tasks&task=${own.id}`, reassign: 'task', clientName: 'Mw Client 1', title: 'POL-MW-0001' });
  });

  it('records a task can be related to follow the permissions', async () => {
    const r = await as('mw.sales1', 'get', '/my-work/records?type=policy&search=POL-MW-0001');
    expect(r.body.data[0]).toMatchObject({ entity: 'policy', id: 'pol_mw1', ref: 'POL-MW-0001', label: 'Mw Client 1' });
    expect((await as('mw.claims1', 'get', '/my-work/records?type=quote&search=QT')).body.data).toEqual([]);
    const a = await as('mw.salesmgr', 'get', '/my-work/assignees');
    expect(a.body.data.map((u) => u.id)).toEqual([ids['mw.salesmgr'], ids['mw.sales1']]);
  });
});

describe('automatic follow-ups and the reminder job', () => {
  it('a promise to pay, a renewal next step and a claim follow-up date become tasks; closing the record closes them', async () => {
    const ci = await one("INSERT INTO collection_items(receivable_id, policy_id, client_id) VALUES ('rcv_mw2', 'pol_mw2', 'cl_mw2') RETURNING id");
    const c = await as('mw.acct1', 'patch', `/collections/${ci.id}/commitment`).send({ commitmentDate: addDays(now, 2), reason: 'Salary on Friday' });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    const task = await one("SELECT * FROM work_tasks WHERE source = 'collection' AND entity_id = $1", [ci.id]);
    expect(task).toMatchObject({ assigned_to: ids['mw.acct1'], status: 'open', due_date: addDays(now, 2) });
    // the promise is listed once, as the collector's task (not again as a collection item of the queue)
    expect((await items('mw.acct1', 'category=collections')).data.find((i) => i.id === ci.id)).toBeUndefined();
    expect((await items('mw.acct2', 'category=collections')).data.find((i) => i.id === ci.id)).toBeUndefined();
    expect((await items('mw.acct1', 'category=tasks')).data.find((i) => i.nextAction === task.title)).toMatchObject({ clientName: 'Mw Client 2', title: 'INV-MW-0002' });

    await query(`INSERT INTO renewals(id, renewal_number, policy_id, client_id, owner_user_id, status, due_date)
      VALUES ('rn_mw1', 'RN-MW-0001', 'pol_mw1', 'cl_mw1', $1, 'notice-1', $2::date + 20)`, [ids['mw.sales1'], now]);
    await query(`INSERT INTO renewal_activities(renewal_id, by_user, activity_type, next_action, follow_up_date)
      VALUES ('rn_mw1', 'mw.sales1', 'Call', 'Send the revised quotation', $1::date + 3)`, [now]);
    const out = await syncAutoTasks();
    expect(out.created).toBe(1); // the renewal (the claim follow-up, due yesterday, came with the synchronisation after the commitment)
    const rn = await one("SELECT * FROM work_tasks WHERE source = 'renewal' AND entity_id = 'rn_mw1'");
    expect(rn).toMatchObject({ assigned_to: ids['mw.sales1'], title: 'Renewal RN-MW-0001: Send the revised quotation' });
    const cl = await one("SELECT * FROM work_tasks WHERE source = 'claim' AND entity_id = 'clm_mw1'");
    expect(cl.assigned_to).toBe(ids['mw.claims2']);
    expect((await syncAutoTasks()).created).toBe(0); // idempotent

    await query("UPDATE renewals SET status = 'renewed' WHERE id = 'rn_mw1'");
    await query('UPDATE collection_items SET closed_at = now() WHERE id = $1', [ci.id]);
    await syncAutoTasks();
    expect((await one("SELECT status, completed_by FROM work_tasks WHERE source = 'renewal' AND entity_id = 'rn_mw1'"))).toEqual({ status: 'done', completed_by: 'system' });
    expect((await one("SELECT status FROM work_tasks WHERE source = 'collection' AND entity_id = $1", [ci.id])).status).toBe('done');
    // a follow-up task is completed, never deleted
    const auto = await as('mw.claims2', 'get', `/my-work/tasks?source=claim`);
    expect(auto.body.data[0]).toMatchObject({ automatic: true, canDelete: false });
    expect((await as('mw.claims2', 'delete', `/my-work/tasks/${auto.body.data[0].id}`)).status).toBe(403);
  });

  it('notifies reminders when they come and an overdue task once', async () => {
    await query('DELETE FROM notifications');
    const t = await as('mw.ops', 'post', '/my-work/tasks').send({ title: 'Send the endorsement to the insurer', dueDate: now, dueTime: '23:59', reminderMinutes: 60 });
    await query("UPDATE work_tasks SET remind_at = now() - interval '1 minute' WHERE id = $1", [t.body.data.id]);
    const late = await as('mw.ops', 'post', '/my-work/tasks').send({ title: 'Return the client\'s call', dueDate: addDays(now, -2), reminderMinutes: null });
    const r1 = await myWorkReminders();
    expect(r1.reminders).toBeGreaterThanOrEqual(1);
    expect(r1.overdue).toBeGreaterThanOrEqual(1);
    const mine = (await query('SELECT title FROM notifications WHERE user_id = $1 ORDER BY title', [ids['mw.ops']])).rows.map((r) => r.title);
    expect(mine).toEqual(expect.arrayContaining(['Task due: Send the endorsement to the insurer', "Task overdue: Return the client's call"]));
    const again = await myWorkReminders();
    expect(again).toMatchObject({ reminders: 0, overdue: 0 });
    expect(late.body.data.remindAt).toBeNull();
    // switched off: no overdue alert
    await query("UPDATE app_settings SET value = 'false' WHERE key = 'myWork.overdue_task_alert'");
    clearSettingsCache();
    await as('mw.ops', 'post', '/my-work/tasks').send({ title: 'Old follow-up', dueDate: addDays(now, -5), reminderMinutes: null });
    expect((await myWorkReminders()).overdue).toBe(0);
    await query("UPDATE app_settings SET value = 'true' WHERE key = 'myWork.overdue_task_alert'");
    clearSettingsCache();
  });

  it('the job is registered and seeded', async () => {
    expect(await one("SELECT handler, enabled FROM scheduled_jobs WHERE code = 'my-work-reminders'")).toEqual({ handler: 'myWorkReminders', enabled: true });
    expect((await one("SELECT value FROM app_settings WHERE key = 'myWork.due_soon_days'")).value).toBe(7);
  });

  it('agenda: items due in a date range for the calendar', async () => {
    const r = await as('mw.sales1', 'get', `/my-work/agenda?from=${addDays(now, -15)}&to=${addDays(now, 5)}`);
    expect(r.status).toBe(200);
    expect(r.body.data.items.map((i) => i.ref)).toContain('INV-MW-0001');
    expect((await as('mw.sales1', 'get', `/my-work/agenda?from=${now}&to=${addDays(now, 90)}`)).status).toBe(400);
  });
});
