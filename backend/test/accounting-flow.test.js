/** Accounting flow help screen: built from the posting rules in force, so it follows an approved rule change. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { pool } from '../src/db/pool.js';
import { EVENTS } from '../src/modules/accounting/lib/posting.js';
import { EVENT_FLOW } from '../src/modules/posting-rules/flow.js';
import { withoutConfigurationApproval } from './helpers.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); await withoutConfigurationApproval(); });
afterAll(async () => { await pool.end(); });

describe('accounting flow', () => {
  it('documents the trigger and approval of every event', () => {
    expect(Object.keys(EVENTS).filter((code) => !EVENT_FLOW[code])).toEqual([]);
  });

  it('lists every event with the debit and credit lines of the rule in force and their GL accounts', async () => {
    const r = await ctx.as('maker')('get', '/posting-rules/flow');
    expect(r.status).toBe(200);
    const byCode = Object.fromEntries(r.body.data.events.map((e) => [e.eventCode, e]));
    expect(Object.keys(byCode).sort()).toEqual(Object.keys(EVENTS).sort());
    const issue = byCode['policy.issue.broker_billed'];
    expect(issue).toMatchObject({ version: 2, trigger: expect.stringContaining('Policy issued') });
    expect(issue.debits.map((l) => [l.amountKey, l.account.glCode])).toEqual(expect.arrayContaining([['gross', '1202001'], ['commission_ewt', '1302001']]));
    // premiums payable to insurers: Accounts Payable - Insurance Company of the TISPH chart (seed 81_tisph_finance.sql)
    expect(issue.credits.map((l) => l.account.glCode)).toEqual(expect.arrayContaining(['210245', '3201001', '235000']));
    expect(byCode['receipt.apply'].debits[0].account).toMatchObject({ kind: 'resolver', resolver: 'bank_account' });
  });

  it('follows a rule change', async () => {
    const rule = (await ctx.api('get', '/posting-rules?eventCode=commission.approve')).body.data[0];
    const lines = rule.lines.map(({ id: _id, lineNo: _n, ...l }) => l);
    await ctx.api('post', '/posting-rules/events/commission.approve/versions').send({ lines: [{ ...lines[0], accountType: 'gl', account: '4401020' }, lines[1]] });
    const e = (await ctx.as('maker')('get', '/posting-rules/flow')).body.data.events.find((x) => x.eventCode === 'commission.approve');
    expect(e.version).toBe(2);
    expect(e.debits[0].account).toMatchObject({ kind: 'gl', glCode: '4401020' });
  });
});
