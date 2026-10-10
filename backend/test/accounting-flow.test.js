/**
 * Accounting Flow, the Finance accounting reference: built from the posting rules and accounts in force, with business
 * wording, approvals worded from the settings, mapping state, pending and scheduled changes, worked examples and the
 * Excel / PDF exports.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { EVENTS, postEvent } from '../src/modules/accounting/lib/posting.js';
import { AMOUNT_WORDING, AREAS, EVENT_FLOW, SYSTEM_JOURNALS } from '../src/modules/posting-rules/flow.js';
import { flowHandbookSpec, flowWorkbook } from '../src/modules/posting-rules/flowExport.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { formatDate } from '../src/lib/pdf/format.js';
import { withoutConfigurationApproval } from './helpers.js';

let ctx;
const finance = {};
beforeAll(async () => {
  ctx = await setupFinance();
  await withoutConfigurationApproval();
  for (const name of ['ref.one', 'ref.two']) {
    await ctx.api('post', '/users').send({ username: name, password: 'Welcome@123', displayName: name, roles: ['tis-finance'], email: `${name}@example.ph` });
    const token = (await request(ctx.app).post('/api/auth/login').send({ username: name, password: 'Welcome@123' })).body.accessToken;
    finance[name] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  }
});
afterAll(async () => { await pool.end(); });

const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const flow = async (as = ctx.as('maker')) => {
  const r = await as('get', '/posting-rules/flow');
  expect(r.status).toBe(200);
  return r.body.data;
};
const eventOf = (f, code) => f.events.find((e) => e.eventCode === code);
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
const CODES = /\b[a-z]+:[a-z-]+\b|\b[a-z_]+\.[a-z_]+\b/;

describe('accounting flow: wording and grouping', () => {
  it('documents every event in business words and places it in one module', () => {
    const grouped = AREAS.flatMap((a) => a.events);
    for (const code of Object.keys(EVENTS)) {
      const f = EVENT_FLOW[code];
      expect(f, code).toBeTruthy();
      expect(f.when && f.screen && f.where && f.approval, code).toBeTruthy();
      expect(grouped.filter((c) => c === code), code).toHaveLength(1);
      const texts = [f.when, f.where, f.approval.text, f.approval.on, f.approval.off, f.approval.name, ...Object.values(f.amounts || {}), ...Object.values(f.formulas || {})].filter(Boolean);
      for (const t of texts) expect(t, `${code}: ${t}`).not.toMatch(CODES);
    }
    for (const t of Object.values(AMOUNT_WORDING)) expect(t).not.toMatch(CODES);
    expect(AREAS.at(-1).events).toEqual(SYSTEM_JOURNALS.map((s) => s.eventCode));
  });

  it('lists the events by module in the order of the accounting cycle, with the lines in force and their accounts', async () => {
    const f = await flow();
    expect(f.areas.map((a) => a.code)).toEqual(AREAS.map((a) => a.code));
    expect(f.areas[0]).toEqual({ code: 'premium', name: 'Premium billing', count: 5 });
    expect(f.events.map((e) => e.eventCode).sort()).toEqual(Object.keys(EVENTS).sort());
    expect(f.events.slice(0, 2).map((e) => e.eventCode)).toEqual(['policy.issue.broker_billed', 'policy.renewal.broker_billed']);
    const issue = eventOf(f, 'policy.issue.broker_billed');
    expect(issue).toMatchObject({ version: 2, area: 'premium', trigger: expect.stringContaining('policy is issued'), screen: '/agent/policy', posting: 'posted', postingText: 'Posted at once' });
    expect(issue.debits.map((l) => [l.amountKey, l.account.glCode])).toEqual(expect.arrayContaining([['gross', '1202001'], ['commission_ewt', '1302001']]));
    expect(issue.credits.map((l) => l.account.glCode)).toEqual(expect.arrayContaining(['210245', '3201001', '235000']));
    // debits first, then credits
    const sides = issue.lines.map((l) => l.side);
    expect(sides.lastIndexOf('Dr')).toBeLessThan(sides.indexOf('Cr'));
    const due = issue.lines.find((l) => l.amountKey === 'due_to_insurer');
    expect(due).toMatchObject({ amount: 'Premium due to the insurer', perParticipant: true, formula: expect.stringContaining('Gross premium') });
    expect(due.account).toMatchObject({ kind: 'role', source: 'Premium payable to insurers (Account Determination › Premium)', configure: '/master/finance/premium-account-setup' });
    expect(issue.lines.find((l) => l.amountKey === 'vat').condition).toEqual({ name: 'Premium taxes booked separately', on: true });
    expect(eventOf(f, 'receipt.apply').debits[0].account).toMatchObject({ kind: 'resolver', resolver: 'bank_account', source: expect.stringContaining('Bank account of the receipt') });
    // insurer events resolve the payable of the payee type Insurer
    expect(eventOf(f, 'remittance.transfer').debits[0].account).toMatchObject({ glCode: '210245', options: [expect.objectContaining({ name: 'Insurer', glCode: '210245' })] });
    expect(eventOf(f, 'disbursement.payment').authority).toEqual({ type: 'payment_voucher', name: 'Payment voucher and cheque release' });
    expect(eventOf(f, 'ap.payment')).toMatchObject({ posting: 'parked', postingText: 'Waits for approval', authority: { type: 'journal_voucher' } });
  });

  it('lists the journals built without a posting rule with their role accounts', async () => {
    const f = await flow();
    expect(f.systemJournals.map((s) => s.eventCode)).toEqual(['bank.adjustment', 'period_close.commission_deferral', 'period_close.fx_revaluation', 'year_end.closing']);
    const deferral = f.systemJournals[1];
    expect(deferral).toMatchObject({ fixed: true, area: 'system' });
    expect(deferral.lines.map((l) => [l.side, l.account.glCode])).toEqual([['Dr', '3201001'], ['Cr', '2209001']]);
    expect(f.systemJournals[3].lines.map((l) => l.account.glCode).filter(Boolean)).toEqual(['340020', '340020', '340000']);
  });

  it('refuses a user without the finance read permissions', async () => {
    expect((await ctx.as('agent')('get', '/posting-rules/flow')).status).toBe(403);
    expect((await ctx.as('agent')('get', '/posting-rules/flow?format=xlsx')).status).toBe(403);
    expect((await ctx.as('agent')('get', '/posting-rules/flow/receipt.apply/example')).status).toBe(403);
  });
});

describe('accounting flow: settings in force', () => {
  it('words the approval from its setting', async () => {
    expect(eventOf(await flow(), 'ap.invoice')).toMatchObject({ approval: 'Approved by a second user', approvalControl: { name: 'Approval of supplier invoices', on: true } });
    await setSetting('payables.maker_checker', false);
    expect(eventOf(await flow(), 'ap.invoice')).toMatchObject({ approval: expect.stringMatching(/^None/), approvalControl: { on: false } });
    await setSetting('payables.maker_checker', true);
  });

  it('shows system journals saved as pending when auto-post is off', async () => {
    await setSetting('accounting.auto_post_system_entries', false);
    const f = await flow();
    expect(eventOf(f, 'commission.approve')).toMatchObject({ posting: 'pending', postingText: 'Saved as pending' });
    expect(eventOf(f, 'receipt.apply').posting).toBe('posted');
    expect(eventOf(f, 'ap.payment').posting).toBe('parked');
    await setSetting('accounting.auto_post_system_entries', true);
  });

  it('marks the commission withholding tax line as not posted when the tax is switched off', async () => {
    await setSetting('accounting.broker_billed_commission_ewt', false);
    const line = eventOf(await flow(), 'policy.issue.broker_billed').lines.find((l) => l.amountKey === 'commission_ewt');
    expect(line.condition).toEqual({ name: 'Withholding tax on brokerage commission', on: false });
    expect(line.account.glCode).toBe('1302001');
    await setSetting('accounting.broker_billed_commission_ewt', true);
  });
});

describe('accounting flow: mapping pending', () => {
  it('flags provisional, outside-chart and inactive accounts and lists each item once', async () => {
    expect((await query("SELECT value FROM app_settings WHERE key = 'accounting.provisional_accounts'")).rows[0].value).toEqual(['210245']);
    await query("UPDATE gl_accounts SET status = 'inactive' WHERE code = '2203007'");
    try {
      const f = await flow();
      expect(f.mapping.state).toBe('incomplete');
      const issue = eventOf(f, 'policy.issue.broker_billed');
      expect(issue.mappingPending).toBe(true);
      expect(issue.lines.find((l) => l.amountKey === 'due_to_insurer').account.mapping).toBe('provisional');
      expect(issue.lines.find((l) => l.amountKey === 'gross').account.mapping).toBe('outside-chart');
      expect(issue.lines.find((l) => l.amountKey === 'commission_vat').account).toMatchObject({ glCode: '235000', mapping: null });
      expect(eventOf(f, 'incentive.accrual').credits[0].account).toMatchObject({ glCode: '2203007', mapping: 'inactive', glActive: false });
      const options = eventOf(f, 'receipt.apply').debits[0].account.options;
      expect(options.find((o) => o.name === 'GCash')).toMatchObject({ glCode: '1102002', mapping: 'outside-chart' });
      expect(options.find((o) => o.name === 'Cash')).toMatchObject({ glCode: '100000', mapping: null });
      const items = f.mapping.pending.map((p) => `${p.kind}|${p.item}|${p.glCode}`);
      expect(new Set(items).size).toBe(items.length);
      const payable = f.mapping.pending.find((p) => p.item === 'Premium payable to insurers');
      expect(payable).toMatchObject({ kind: 'role', glCode: '210245', reason: 'provisional', configure: '/master/finance/premium-account-setup' });
      expect(payable.events.map((e) => e.eventCode)).toEqual(expect.arrayContaining(['policy.issue.broker_billed', 'policy.cancel', 'insurer.refund_due']));
      expect(f.mapping.pending.find((p) => p.item === 'Payment mode GCash')).toMatchObject({ kind: 'payment-mode', configure: '/master/finance/account-determination' });
      expect(f.mapping.pending.find((p) => p.glCode === '2203007')).toMatchObject({ reason: 'inactive' });
    } finally {
      await query("UPDATE gl_accounts SET status = 'active' WHERE code = '2203007'");
    }
  });
});

describe('accounting flow: pending and scheduled changes', () => {
  it('shows a rule version waiting for approval, which its requester cannot approve', async () => {
    await setSetting('accounting.configuration_maker_checker', true);
    try {
      const before = await flow();
      const rule = (await ctx.api('get', '/posting-rules?eventCode=incentive.payout')).body.data[0];
      const lines = rule.lines.map(({ id: _id, lineNo: _n, ...l }) => l);
      const r = await finance['ref.one']('post', '/posting-rules/events/incentive.payout/versions').send({ lines, changeNote: 'Same lines' });
      expect(r.status).toBe(201);
      const changeId = r.body.data.change.id;
      const f = await flow();
      expect(eventOf(f, 'incentive.payout')).toMatchObject({ version: rule.version, pending: { changeId, kind: 'posting-rule-version', requestedBy: 'ref.one' } });
      expect(f.pendingChanges).toEqual([expect.objectContaining({ changeId, eventCode: 'incentive.payout', target: 'Incentives paid', requestedBy: 'ref.one' })]);
      expect(f.edition).toBe(before.edition);
      expect((await finance['ref.one']('post', `/posting-rules/changes/${changeId}/approve`).send({})).status).toBe(403);
      expect((await ctx.as('maker')('post', `/posting-rules/changes/${changeId}/approve`).send({})).status).toBe(403);
      expect((await finance['ref.two']('post', `/posting-rules/changes/${changeId}/approve`).send({})).status).toBe(200);
      const after = await flow();
      expect(eventOf(after, 'incentive.payout')).toMatchObject({ version: rule.version + 1, pending: null });
      expect(after.pendingChanges).toEqual([]);
      expect(after.edition).not.toBe(before.edition);
    } finally {
      await setSetting('accounting.configuration_maker_checker', false);
    }
  });

  it('shows an account role change waiting for approval on the lines that use the role', async () => {
    await setSetting('accounting.configuration_maker_checker', true);
    try {
      const r = await finance['ref.one']('put', '/account-determination/roles/incentive_expense').send({ glCode: '4401010' });
      expect(r.status).toBe(200);
      const line = eventOf(await flow(), 'incentive.accrual').debits[0];
      expect(line.account).toMatchObject({ glCode: '4401020', pendingChange: { changeId: r.body.data.change.id, glCode: '4401010' } });
      expect((await finance['ref.one']('post', `/posting-rules/changes/${r.body.data.change.id}/withdraw`).send({})).status).toBe(200);
    } finally {
      await setSetting('accounting.configuration_maker_checker', false);
    }
  });

  it('shows an approved version that starts later as scheduled', async () => {
    const rule = (await ctx.api('get', '/posting-rules?eventCode=claim.funds_received')).body.data[0];
    const lines = rule.lines.map(({ id: _id, lineNo: _n, ...l }) => l);
    const from = addDays(await today(), 5);
    expect((await ctx.api('post', '/posting-rules/events/claim.funds_received/versions').send({ lines, effectiveFrom: from })).status).toBe(201);
    expect(eventOf(await flow(), 'claim.funds_received')).toMatchObject({ version: rule.version, scheduled: { version: rule.version + 1, effectiveFrom: from } });
  });

  it('keeps the edition while nothing changes and follows a rule change', async () => {
    const a = await flow();
    expect((await flow()).edition).toBe(a.edition);
    expect(a.edition).toMatch(/^[0-9A-F]{8}$/);
    const rule = (await ctx.api('get', '/posting-rules?eventCode=commission.approve')).body.data[0];
    const lines = rule.lines.map(({ id: _id, lineNo: _n, ...l }) => l);
    await ctx.api('post', '/posting-rules/events/commission.approve/versions').send({ lines: [{ ...lines[0], accountType: 'gl', account: '4401020' }, lines[1]] });
    const b = await flow();
    expect(b.edition).not.toBe(a.edition);
    expect(eventOf(b, 'commission.approve').debits[0].account).toMatchObject({ kind: 'gl', glCode: '4401020', source: 'Fixed account of the rule' });
  });

  it('gives the date an event last posted', async () => {
    expect(eventOf(await flow(), 'incentive.accrual').lastPosted).toBeNull();
    const date = await today();
    await withTransaction((db) => postEvent('incentive.accrual', { ...EVENTS['incentive.accrual'].sample, date }, { db, user: { id: ctx.userIds.maker } }));
    expect(eventOf(await flow(), 'incentive.accrual').lastPosted).toBe(date);
  });
});

describe('accounting flow: examples and exports', () => {
  it('builds a balanced example with the accounts this configuration uses', async () => {
    const ap = (await ctx.as('maker')('get', '/posting-rules/flow/ap.invoice/example')).body.data;
    expect(ap.balanced).toBe(true);
    expect(ap.lines.map((l) => l.accountCode)).toContain('135000');
    expect(ap.lines.map((l) => l.accountCode)).not.toContain('1301001');
    expect(ap.lines.find((l) => l.accountCode === '4401008')).toMatchObject({ example: true });
    const co = (await ctx.as('maker')('get', '/posting-rules/flow/policy.issue.broker_billed/example?coInsurance=true')).body.data;
    expect(co).toMatchObject({ coInsurance: true, balanced: true });
    expect(co.lines.filter((l) => l.accountCode === '210245').map((l) => l.credit)).toEqual([5802, 3868]);
    expect(co.omitted).toContain('VAT on the premium');
    expect((await ctx.as('maker')('get', '/posting-rules/flow/no.such.event/example')).status).toBe(404);
  });

  it('exports the accounting reference to Excel, with the technical sheet for finance administrators only', async () => {
    const before = Number((await query("SELECT count(*) FROM audit_log WHERE entity = 'accounting_flow' AND action = 'export'")).rows[0].count);
    const reader = await ctx.as('maker')('get', '/posting-rules/flow?format=xlsx').buffer(true).parse(binary);
    expect(reader.status).toBe(200);
    expect(reader.headers['content-disposition']).toMatch(/accounting-reference-\d{8}\.xlsx/);
    const sheets = readWorkbook(reader.body);
    expect(sheets.map((s) => s.name)).toEqual(['Entries', 'Events', 'Mapping pending', 'Examples']);
    expect(sheets[0].rows.flat().join(' ')).toContain('Premium due to the insurer');
    const admin = readWorkbook((await finance['ref.one']('get', '/posting-rules/flow?format=xlsx').buffer(true).parse(binary)).body);
    expect(admin.map((s) => s.name)).toContain('Technical');
    expect(admin.find((s) => s.name === 'Technical').rows.flat()).toContain('policy.issue.broker_billed');
    const after = Number((await query("SELECT count(*) FROM audit_log WHERE entity = 'accounting_flow' AND action = 'export'")).rows[0].count);
    expect(after).toBe(before + 2);
  });

  it('prints the Accounting Entries Handbook', async () => {
    const r = await ctx.as('maker')('get', '/posting-rules/flow?format=pdf&download=1').buffer(true).parse(binary);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.headers['content-disposition']).toMatch(/^attachment; filename="accounting-entries-handbook-\d{8}\.pdf"/);
    expect(r.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('builds the workbook and the handbook from the read model', async () => {
    const f = await flow();
    const rows = f.events.reduce((n, e) => n + e.lines.length, 0) + f.systemJournals.reduce((n, e) => n + e.lines.length, 0);
    const sheets = flowWorkbook(f, { technical: false });
    expect(sheets[0].rows).toHaveLength(rows);
    expect(sheets[1].rows).toHaveLength(f.events.length + f.systemJournals.length);
    expect(sheets[2].rows).toHaveLength(f.mapping.pending.length);
    const spec = flowHandbookSpec(f, []);
    expect(spec).toMatchObject({ title: 'Accounting Entries Handbook', params: `Rules in force on ${formatDate(f.asOf)}` });
    expect(spec.sections.at(-1).signatures).toEqual(['Prepared by', 'Reviewed by', 'Approved by']);
    expect(JSON.stringify(spec)).not.toContain('policy.issue.broker_billed');
  });
});
