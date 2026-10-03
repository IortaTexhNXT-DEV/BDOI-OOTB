/**
 * Controls: maker-checker on posting rules and account determination (a change waits for a different user with
 * approve:posting-rules) and the month-end sub-ledger vs GL tie-out.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { buildJournal } from '../src/modules/accounting/lib/posting.js';
import { createJournal } from '../src/modules/accounting/lib/ledger.js';
import { subledgerTieOut, tieOutCheck } from '../src/modules/period-end/tieout.js';
import { today } from '../src/lib/dates.js';

let ctx;
const managers = {};
beforeAll(async () => {
  ctx = await setupFinance();
  for (const name of ['cfg.one', 'cfg.two']) {
    await ctx.api('post', '/users').send({ username: name, password: 'Welcome@123', displayName: name, roles: ['accounting-manager'], email: `${name}@example.ph` });
    const token = (await request(ctx.app).post('/api/auth/login').send({ username: name, password: 'Welcome@123' })).body.accessToken;
    managers[name] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  }
});
afterAll(async () => { await pool.end(); });

const one = (m, p) => managers['cfg.one'](m, p);
const two = (m, p) => managers['cfg.two'](m, p);
const roleGl = async (role) => { clearSettingsCache(); return (await query('SELECT value #>> \'{}\' AS v FROM app_settings WHERE key = $1', [`accounting.account.${role}`])).rows[0].v; };

describe('maker-checker on account determination', () => {
  it('a role change waits for a different approver', async () => {
    const r = await one('put', '/account-determination/roles/premium_receivable').send({ glCode: '1202002' });
    expect(r.status).toBe(200);
    expect(r.body.data.change).toMatchObject({ kind: 'account-role', target: 'premium_receivable', status: 'pending', payload: { glCode: '1202002' } });
    expect(await roleGl('premium_receivable')).toBe('1202001');
    expect((await two('put', '/account-determination/roles/premium_receivable').send({ glCode: '1202002' })).status).toBe(409);
    const id = r.body.data.change.id;
    expect((await one('post', `/posting-rules/changes/${id}/approve`).send({})).status).toBe(403);
    expect((await ctx.as('checker')('post', `/posting-rules/changes/${id}/approve`).send({})).status).toBe(403);
    const pending = await ctx.as('maker')('get', '/posting-rules/changes');
    expect(pending.body.data.map((c) => c.id)).toContain(id);
    const ok = await two('post', `/posting-rules/changes/${id}/approve`).send({ remarks: 'Corporate receivables account' });
    expect(ok.body.data.status).toBe('approved');
    expect(await roleGl('premium_receivable')).toBe('1202002');
    const back = await two('put', '/account-determination/roles/premium_receivable').send({ glCode: '1202001' });
    await one('post', `/posting-rules/changes/${back.body.data.change.id}/approve`).send({});
    expect(await roleGl('premium_receivable')).toBe('1202001');
  });

  it('maps and commission taxes too; the generic settings screens cannot bypass it', async () => {
    const m = await one('put', '/account-determination/maps/cash-by-payment-mode').send({ map: { cash: '1101001', check: '1102002' } });
    expect(m.body.data.change.status).toBe('pending');
    expect((await two('post', `/posting-rules/changes/${m.body.data.change.id}/reject`).send({})).status).toBe(400);
    expect((await two('post', `/posting-rules/changes/${m.body.data.change.id}/reject`).send({ remarks: 'Cheques go to the operating account' })).body.data.status).toBe('rejected');
    const t = await one('put', '/account-determination/commission-taxes').send({ ewtCode: 'WC140' });
    expect((await one('post', `/posting-rules/changes/${t.body.data.change.id}/withdraw`).send({})).body.data.status).toBe('withdrawn');
    const blocked = await ctx.api('put', '/settings').send({ settings: { 'accounting.account.premium_receivable': '1202003' } });
    expect(blocked.status).toBe(409);
    expect((await ctx.api('put', '/settings').send({ settings: { 'accounting.account.premium_receivable': '1202001' } })).status).toBe(200);
    expect((await ctx.api('put', '/system-settings/configuration').send({ settings: { 'accounting.account.output_vat': '2204001' } })).status).toBe(409);
  });
});

describe('maker-checker on posting rules', () => {
  it('a new version is pending and never posts until approved; rejecting leaves the version in force', async () => {
    const rule = (await ctx.as('maker')('get', '/posting-rules?eventCode=receipt.apply')).body.data[0];
    const lines = rule.lines.map(({ id: _id, lineNo: _n, ...l }) => l);
    const date = await today();
    const memo = async () => (await buildJournal(pool, 'receipt.apply', { branchCode: null, date, amounts: { amount: 100 }, paymentMode: 'cash', vars: { billNumber: 'INV-X', memoRef: 'M' } })).lines[1].memo;
    const v = await one('post', '/posting-rules/events/receipt.apply/versions').send({ lines: [lines[0], { ...lines[1], narration: 'Paid {{billNumber}}' }], changeNote: 'shorter memo' });
    expect(v.status).toBe(201);
    expect(v.body.data).toMatchObject({ approvalStatus: 'pending', active: false });
    const ev = (await ctx.as('maker')('get', '/posting-rules/events')).body.data.find((e) => e.eventCode === 'receipt.apply');
    expect(ev.pending).toMatchObject({ version: v.body.data.version });
    expect(await memo()).toBe('Settles INV-X');
    await two('post', `/posting-rules/changes/${v.body.data.change.id}/reject`).send({ remarks: 'Keep the settlement wording' });
    expect(await memo()).toBe('Settles INV-X');
    const v2 = await one('post', '/posting-rules/events/receipt.apply/versions').send({ lines: [lines[0], { ...lines[1], narration: 'Paid {{billNumber}}' }] });
    await two('post', `/posting-rules/changes/${v2.body.data.change.id}/approve`).send({});
    expect(await memo()).toBe('Paid INV-X');
    // switching back to the earlier version is itself a change to approve
    const act = await one('put', `/posting-rules/${v2.body.data.id}/status`).send({ active: false });
    expect(act.body.data.change.kind).toBe('posting-rule-status');
    expect(await memo()).toBe('Paid INV-X');
    await two('post', `/posting-rules/changes/${act.body.data.change.id}/approve`).send({});
    expect(await memo()).toBe('Settles INV-X');
    expect((await one('put', `/posting-rules/${v.body.data.id}/status`).send({ active: true })).status).toBe(409);
  });
});

describe('month-end sub-ledger vs GL tie-out', () => {
  it('ties out after operations and reports a manual journal on a control account', async () => {
    const m = await makePolicy({ net: 10000 });
    await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: 5000 });
    const before = Object.fromEntries((await subledgerTieOut(pool)).map((r) => [r.ledger, r.difference]));
    await withTransaction((db) => createJournal(db, { date: undefined, description: 'Manual reclass', source: 'manual', status: 'posted',
      lines: [{ accountCode: '1202001', debit: 250, credit: 0 }, { accountCode: '1102001', debit: 0, credit: 250 }] }, { id: ctx.userIds.maker }));
    const after = await tieOutCheck(pool);
    const row = after.detail.find((r) => r.ledger === 'Premium receivable');
    expect(row.difference).toBe(Math.round((before['Premium receivable'] - 250) * 100) / 100);
    expect(row.manualJournals.map((j) => j.description)).toContain('Manual reclass');
    expect(after.status).toBe('failed');
    const item = (await query('SELECT * FROM period_close_checklist WHERE code = \'subledger_tieout\'')).rows[0];
    expect(item).toMatchObject({ item_type: 'auto', severity: 'warning', active: true });
  });
});
