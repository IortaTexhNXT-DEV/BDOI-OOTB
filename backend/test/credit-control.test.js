/**
 * Credit control: instalment plans (schedule, allocation of payments, the bill's due date, ageing), the premium warranty
 * monitor (reminder, extension with approval, cancellation request for Operations), client credit limits, the ageing of
 * premium not yet remitted and remittance due dates from the insurer's remittance terms.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { createReceivable, findPolicy } from '../src/modules/receipts/receivables.js';
import { issuePolicy } from '../src/modules/policies/service.js';
import { addMonths, allocatePaid, generateSchedule } from '../src/modules/credit-control/instalments.js';
import { enableFeatures } from './helpers.js';

let ctx;
let manager;
let asOf;
beforeAll(async () => {
  ctx = await setupFinance();
  // functions of a later release (modules/features), enabled as the platform administrators do
  await enableFeatures(ctx.app, ['client-credit-limits']);
  await ctx.api('post', '/users').send({ username: 'cc.manager', password: 'Welcome@123', displayName: 'Credit manager', roles: ['accounting-manager'], email: 'cc.manager@example.ph' });
  const token = (await request(ctx.app).post('/api/auth/login').send({ username: 'cc.manager', password: 'Welcome@123' })).body.accessToken;
  manager = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  asOf = await today();
});
afterAll(async () => { await pool.end(); });

const bill = async (m, amount = m.gross) => withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, m.policy.id), amount, user: { id: ctx.userIds.maker } }));
const pay = (m, amount) => ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount });

describe('instalment schedules', () => {
  it('generates even instalments (down payment first, rounding on the first instalment) on month ends', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(generateSchedule({ amount: 12525, count: 4, months: 1, firstDueDate: '2026-01-31' }))
      .toEqual([['2026-01-31', 3131.25], ['2026-02-28', 3131.25], ['2026-03-31', 3131.25], ['2026-04-30', 3131.25]].map(([d, a], i) => ({ seq: i + 1, dueDate: d, amount: a })));
    expect(generateSchedule({ amount: 1000, count: 3, months: 3, firstDueDate: '2026-01-15' }).map((x) => x.amount)).toEqual([333.34, 333.33, 333.33]);
    expect(generateSchedule({ amount: 12525, count: 3, months: 1, firstDueDate: '2026-01-15', downPayment: 2525 }).map((x) => x.amount)).toEqual([2525, 5000, 5000]);
    expect(() => generateSchedule({ amount: 100, count: 1, months: 1, firstDueDate: '2026-01-15', downPayment: 50 })).toThrow();
    expect(allocatePaid([{ seq: 1, due_date: '2026-01-01', amount: 100 }, { seq: 2, due_date: '2026-02-01', amount: 100 }], 150, '2026-03-01').map((x) => [x.paid, x.status, x.daysPastDue]))
      .toEqual([[100, 'paid', 0], [50, 'overdue', 28]]);
  });
});

describe('instalment plans', () => {
  let m; let plan;
  it('saves a generated plan; payments go to the instalments in order and the bill is due on the first unpaid one', async () => {
    m = await makePolicy({ net: 10000 });
    const rcv = await bill(m);
    const view = await ctx.as('maker')('get', `/credit-control/policies/${m.policy.id}/instalment-plans`);
    expect(view.status).toBe(200);
    expect(view.body.data.proposal.instalments).toHaveLength(4);
    const first = addDays(asOf, -40);
    const r = await ctx.as('maker')('post', `/credit-control/policies/${m.policy.id}/instalment-plans`).send({ frequency: 'monthly', count: 4, firstDueDate: first });
    expect(r.status).toBe(201);
    plan = r.body.data;
    expect(plan.instalments.map((i) => i.amount)).toEqual([3131.25, 3131.25, 3131.25, 3131.25]);
    expect((await query('SELECT due_date FROM receivables WHERE id = $1', [rcv.id])).rows[0].due_date).toBe(first);
    expect((await pay(m, 3200)).status).toBe(201);
    const after = await ctx.as('maker')('get', `/credit-control/policies/${m.policy.id}/instalment-plans`);
    const lines = after.body.data.plans[0].instalments;
    expect(lines.map((i) => [i.paid, i.status])).toEqual([[3131.25, 'paid'], [68.75, 'overdue'], [0, 'due'], [0, 'due']]);
    expect((await query('SELECT due_date FROM receivables WHERE id = $1', [rcv.id])).rows[0].due_date).toBe(addMonths(first, 1));
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('edits the schedule (must add up to the bill) and ages the instalments', async () => {
    const bad = await ctx.as('maker')('post', `/credit-control/policies/${m.policy.id}/instalment-plans`).send({ instalments: [{ dueDate: addDays(asOf, -40), amount: 5000 }, { dueDate: addDays(asOf, -10), amount: 5000 }] });
    expect(bad.status).toBe(400);
    const edited = await ctx.as('maker')('post', `/credit-control/policies/${m.policy.id}/instalment-plans`)
      .send({ instalments: [{ dueDate: addDays(asOf, -40), amount: 6525 }, { dueDate: addDays(asOf, -10), amount: 6000 }] });
    expect(edited.status).toBe(201);
    expect(edited.body.data).toMatchObject({ id: plan.id, frequency: 'custom', instalmentCount: 2 });
    const ageing = await ctx.as('maker')('get', `/credit-control/instalments/ageing?policyId=${m.policy.id}`);
    expect(ageing.body.data.rows.map((x) => [x.seq, x.outstanding, x.daysPastDue, x.bucket])).toEqual([[1, 3325, 40, 'b2'], [2, 6000, 10, 'b1']]);
    expect((await ctx.as('sales')('get', `/credit-control/policies/${m.policy.id}/instalment-plans`)).status).toBe(403);
  });
});

describe('premium warranty monitor', () => {
  let late; let other;
  it('lists broker-billed policies past their premium warranty and sends a reminder', async () => {
    await query('UPDATE insurance_companies SET premium_warranty_days = 30 WHERE code = \'FPG\'');
    late = await makePolicy({ insurer: 'FPG', inceptionOffset: -60 });
    other = await makePolicy({ insurer: 'FPG', inceptionOffset: -45 });
    await bill(late);
    await bill(other);
    const mon = await ctx.as('maker')('get', `/credit-control/warranty?status=breached&search=${late.policy.policy_number}`);
    expect(mon.status).toBe(200);
    expect(mon.body.data.rows[0]).toMatchObject({ policyNumber: late.policy.policy_number, status: 'breached', warrantyDays: 30, daysPastDeadline: 30, premiumDue: late.gross });
    const rem = await ctx.as('maker')('post', `/credit-control/warranty/${late.policy.id}/remind`).send({ notes: 'Premium overdue' });
    expect(rem.status).toBe(200);
    expect(rem.body.data.to).toBe(late.client.email);
    const acts = await ctx.as('maker')('get', `/credit-control/warranty/${late.policy.id}/actions`);
    expect(acts.body.data[0].action).toBe('reminder');
  });

  it('extends the warranty only with the approval of another user holding approve:credit-control', async () => {
    const tooFar = await ctx.as('maker')('post', `/credit-control/warranty/${late.policy.id}/extensions`).send({ requestedDeadline: addDays(asOf, 40), reason: 'Corporate cheque' });
    expect(tooFar.status).toBe(400);
    const x = await ctx.as('maker')('post', `/credit-control/warranty/${late.policy.id}/extensions`).send({ requestedDeadline: addDays(asOf, 20), reason: 'Corporate cheque promised' });
    expect(x.status).toBe(201);
    expect((await ctx.as('maker')('post', `/credit-control/warranty/${late.policy.id}/extensions`).send({ requestedDeadline: addDays(asOf, 25), reason: 'again' })).status).toBe(409);
    expect((await ctx.as('checker')('post', `/credit-control/warranty/extensions/${x.body.data.id}/approve`).send({})).status).toBe(403);
    const pending = await ctx.as('maker')('get', '/credit-control/warranty/extensions');
    expect(pending.body.data.map((p) => p.id)).toContain(x.body.data.id);
    const ok = await manager('post', `/credit-control/warranty/extensions/${x.body.data.id}/approve`).send({ remarks: 'Cheque confirmed' });
    expect(ok.status).toBe(200);
    const mon = await ctx.as('maker')('get', `/credit-control/warranty?status=all&search=${late.policy.policy_number}`);
    expect(mon.body.data.rows[0]).toMatchObject({ status: 'within', deadline: addDays(asOf, 20), extendedTo: addDays(asOf, 20) });
  });

  it('raises a cancellation request for Operations without cancelling the policy', async () => {
    const r = await ctx.as('maker')('post', `/credit-control/warranty/${other.policy.id}/cancellation-request`).send({ notes: 'Two reminders unanswered' });
    expect(r.status).toBe(201);
    const e = (await query('SELECT * FROM endorsements WHERE id = $1', [r.body.data.endorsementId])).rows[0];
    expect(e).toMatchObject({ policy_id: other.policy.id, is_cancel: true, status: 'draft' });
    expect(e.remarks).toContain('non-payment');
    expect((await query('SELECT status FROM policies WHERE id = $1', [other.policy.id])).rows[0].status).toBe('active');
    expect((await ctx.as('maker')('post', `/credit-control/warranty/${other.policy.id}/cancellation-request`).send({})).status).toBe(409);
    expect((await ctx.as('maker')('post', `/credit-control/warranty/${late.policy.id}/cancellation-request`).send({})).status).toBe(409);
  });
});

describe('client credit limits', () => {
  it('only an approver sets the limit; a broker-billed policy over it is issued with a warning', async () => {
    const m = await makePolicy({ net: 10000 });
    await bill(m);
    expect((await ctx.as('maker')('put', `/credit-control/clients/${m.client.id}/credit-limit`).send({ creditLimit: 20000 })).status).toBe(403);
    const set = await manager('put', `/credit-control/clients/${m.client.id}/credit-limit`).send({ creditLimit: 20000 });
    expect(set.status).toBe(200);
    expect(set.body.data).toMatchObject({ creditLimit: 20000, exposure: m.gross, available: 20000 - m.gross });
    const check = await ctx.as('maker')('get', `/credit-control/clients/${m.client.id}/credit-check?amount=10000`);
    expect(check.body.data).toMatchObject({ exceeds: true, exceededBy: m.gross + 10000 - 20000 });
    const ic = (await query('SELECT id FROM insurance_companies WHERE code = \'MALAYAN\'')).rows[0].id;
    const issued = await withTransaction((db) => issuePolicy(db, { clientId: m.client.id, insuranceCompanyId: ic, sumInsured: 500000, netPremium: 8000, grossPremium: 10020,
      commissionAmount: 1200, commissionRate: 0.15, currency: 'PHP', insuredName: m.client.display_name, productType: 'Private Car', lob: 'MOTOR' }, { billingMode: 'broker' }, ctx.userIds.maker));
    expect(issued.creditWarning).toMatchObject({ creditLimit: 20000, exposure: m.gross + 10020 });
    expect((await query('SELECT status FROM policies WHERE id = $1', [issued.policyId])).rows[0].status).toBe('active');
    const ex = await ctx.as('maker')('get', '/credit-control/credit-exceptions?openOnly=true');
    const mine = ex.body.data.find((x) => x.policyId === issued.policyId);
    expect(mine).toMatchObject({ creditLimit: 20000, newAmount: 10020 });
    expect((await ctx.as('maker')('post', `/credit-control/credit-exceptions/${mine.id}/acknowledge`).send({ remarks: 'Agreed with the account executive' })).status).toBe(200);
    expect((await ctx.api('get', `/clients/${m.client.id}`)).body.data.creditLimit).toBe(20000);
  });
});

describe('remittance to insurers', () => {
  it('ages collected premium on the insurer remittance terms until the voucher is approved', async () => {
    await query('UPDATE insurance_companies SET remittance_terms_days = 10 WHERE code = \'PIONEER\'');
    const m = await makePolicy({ insurer: 'PIONEER' });
    await pay(m, m.gross);
    const later = addDays(asOf, 30);
    const r = await ctx.as('maker')('get', `/credit-control/remittance-ageing?insurerId=PIONEER&asOf=${later}`);
    const row = r.body.data.rows.find((x) => x.policyNumber === m.policy.policy_number);
    // net of commission 1,500, VAT on it 180, plus EWT 150
    expect(row).toMatchObject({ termsDays: 10, remitBy: addDays(asOf, 10), daysOverdue: 20, bucket: 'b1', amountDue: Math.round((m.gross - 1500 - 180 + 150) * 100) / 100 });
    const x = await ctx.as('maker')('get', `/credit-control/remittance-ageing?insurerId=PIONEER&asOf=${later}&format=xlsx`);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    const v = await ctx.as('maker')('post', '/disbursements/insurer-remittance').send({ insurerName: 'PIONEER' });
    const cb = await ctx.as('maker')('post', '/disbursements/checkbook').send({ mainAccount: '1102001', instrumentNo: '000555', totaleAmount: String(v.body.data.amount), disbursementId: v.body.data.disbursementId });
    expect((await ctx.as('checker')('put', `/disbursements/checkbook/${cb.body.data.checkbookId}`).send({ status: 'Approved' })).status).toBe(200);
    const after = await ctx.as('maker')('get', `/credit-control/remittance-ageing?insurerId=PIONEER&asOf=${later}`);
    expect(after.body.data.rows.find((y) => y.policyNumber === m.policy.policy_number)).toBeUndefined();
  });

  it('dates a new remittance on the insurer remittance terms, else remittance.default_due_days', async () => {
    const m = await makePolicy({ insurer: 'PIONEER' });
    const rem = await ctx.as('maker')('post', '/remittance/remittances').send({ insurerCode: 'PIONEER', remittanceDate: asOf, lines: [{ policyId: m.policy.id }] });
    expect(rem.body.data.dueDate).toBe(addDays(asOf, 10));
    await query('UPDATE insurance_companies SET remittance_terms_days = NULL WHERE code = \'PIONEER\'');
    const days = Number((await query('SELECT value #>> \'{}\' AS v FROM app_settings WHERE key = \'remittance.default_due_days\'')).rows[0].v);
    const m2 = await makePolicy({ insurer: 'PIONEER' });
    const rem2 = await ctx.as('maker')('post', '/remittance/remittances').send({ insurerCode: 'PIONEER', remittanceDate: asOf, lines: [{ policyId: m2.policy.id }] });
    expect(rem2.body.data.dueDate).toBe(addDays(asOf, days));
  });
});
