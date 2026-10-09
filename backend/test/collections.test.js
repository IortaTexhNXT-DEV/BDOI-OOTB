import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

async function overdueReceivable(days, net = 12000) {
  const m = await makePolicy({ net });
  await query('INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date) VALUES ($1,$2,$3,$4,$4,current_date - $5::int)', [`INV-C-${m.policy.id}`, m.policy.id, m.client.id, m.gross, days]);
  return m;
}

describe('collections', () => {
  it('sync builds items from receivables (and books receivables created elsewhere)', async () => {
    const m = await overdueReceivable(40);
    const r = await ctx.as('maker')('post', '/collections/sync').send({});
    expect(r.status).toBe(200);
    expect(r.body.data.booked).toBeGreaterThanOrEqual(1);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
    const list = await ctx.as('maker')('get', `/collections?search=${m.policy.policy_number}`);
    expect(list.body.data).toHaveLength(1);
    const item = list.body.data[0];
    expect(item.collectionStatus).toBe('Overdue');
    expect(item.overdueLevel).toBe(2);
    expect(item.days31to60Amount).toBe(m.gross);
    expect(item.client.lastName).toContain('Client');
  });

  it('filters by status / level, sorts and pages', async () => {
    await overdueReceivable(10);
    await ctx.api('post', '/collections/sync').send({});
    const lvl1 = await ctx.api('get', '/collections?overdueLevel=1&page=1&pageSize=50');
    expect(lvl1.body.data.every((x) => x.overdueLevel === 1)).toBe(true);
    const overdue = await ctx.api('get', '/collections?status=Overdue&sortField=daysPastDue&sortOrder=desc');
    const d = overdue.body.data.map((x) => x.daysPastDue);
    expect(d).toEqual([...d].sort((a, b) => b - a));
    expect(overdue.body.pagination.total).toBeGreaterThan(0);
  });

  it('detail, follow-up, commitment, e-mail and payment history', async () => {
    const m = await overdueReceivable(20);
    const s = await ctx.api('post', '/collections/sync').send({});
    expect(s.status).toBe(200);
    const id = (await ctx.api('get', `/collections?search=${m.policy.policy_number}`)).body.data[0].id;
    const f = await ctx.as('maker')('post', `/collections/${id}/follow-up`).send({ actionType: 'Call', notes: 'Promised Friday', callOutcome: 'Answered' });
    expect(f.status).toBe(200);
    expect(f.body.data.followUpActions[0].actionType).toBe('Call');
    expect(f.body.data.followUpActions[0]).toMatchObject({ actionBy: 'fin.maker', actionByName: 'maker user', actionByRoles: ['Accounting'] });
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const c = await ctx.as('maker')('patch', `/collections/${id}/commitment`).send({ commitmentDate: future, reason: 'Payroll' });
    expect(c.status).toBe(200);
    expect(c.body.data.collectionStatus).toBe('Committed');
    expect((await ctx.as('maker')('patch', `/collections/${id}/commitment`).send({ commitmentDate: '2020-01-01' })).status).toBe(400);
    const e = await ctx.as('maker')('post', `/collections/${id}/send-email`).send({ notes: 'Dear client, please settle.', actionBy: 'fin.maker' });
    expect(e.status).toBe(200);
    const out = (await query('SELECT * FROM email_outbox WHERE id = $1', [e.body.data.emailId])).rows[0];
    expect(out.to_address).toBe(m.client.email);
    const rc = await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: 1000, paymentMode: 'cash' });
    expect(rc.status).toBe(201);
    const d = await ctx.api('get', `/collections/${id}`);
    expect(d.body.data.paymentHistory[0].paymentAmount).toBe(1000);
    expect(d.body.data.paidAmount).toBe(1000);
  });

  it('aging report, dashboard stats and due-date reminders', async () => {
    const a = await ctx.api('get', '/collections/aging-report');
    expect(a.status).toBe(200);
    const sm = a.body.data.summary;
    expect(Math.round((sm.totalCurrent + sm.total1to30 + sm.total31to60 + sm.total61to90 + sm.totalOver90) * 100)).toBe(Math.round(sm.totalOutstanding * 100));
    expect(sm.percentages).toHaveProperty('over90');
    const ds = await ctx.api('get', '/collections/dashboard-stats');
    expect(ds.body.data.overdueCount).toBeGreaterThan(0);
    const r1 = await ctx.as('maker')('post', '/collections/send-due-date-reminders');
    expect(r1.status).toBe(200);
    expect(r1.body.data.emails).toBeGreaterThan(0);
    const r2 = await ctx.as('maker')('post', '/collections/send-due-date-reminders');
    expect(r2.body.data.candidates).toBe(0);
    const n = (await query('SELECT count(*)::int AS n FROM notifications WHERE entity = \'collection\'')).rows[0].n;
    expect(n).toBeGreaterThan(0);
  });

  it('validation and permissions', async () => {
    expect((await ctx.as('maker')('post', '/collections/col_x/follow-up').send({ actionType: 'Fax' })).status).toBe(400);
    expect((await ctx.as('maker')('get', '/collections/col_missing')).status).toBe(404);
    expect((await ctx.as('claims')('get', '/collections')).status).toBe(403);
    expect((await ctx.as('sales')('post', '/collections/send-due-date-reminders')).status).toBe(403);
  });
});
