/**
 * Chart of accounts: Philippine insurance-broker chart, every account the system posts to exists and is active,
 * statement grouping is consistent, and re-seeding an existing database is idempotent (adds new accounts, keeps edits,
 * retires the insurer-only accounts of the earlier chart, keeps journals balanced).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup } from './helpers.js';
import { seed } from '../src/db/seed.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { FS_GROUPS } from '../src/modules/accounting/service.js';

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

const here = path.dirname(fileURLToPath(import.meta.url));
const accounts = async () => (await query('SELECT * FROM gl_accounts ORDER BY code')).rows;
const balanced = async () => (await query('SELECT count(*)::int AS n FROM (SELECT jv_id FROM journal_lines GROUP BY jv_id HAVING sum(debit) <> sum(credit)) x')).rows[0].n;

describe('chart of accounts', () => {
  it('every GL account the system posts to (settings, payee and payment-mode maps) exists and is active', async () => {
    const rows = (await query(`SELECT key, value FROM app_settings WHERE key LIKE 'accounting.account.%'
      OR key IN ('accounting.payable_account_by_payee', 'accounting.cash_account_by_payment_mode')`)).rows;
    const codes = new Set();
    for (const r of rows) {
      if (typeof r.value === 'string') codes.add(r.value);
      else Object.values(r.value).forEach((c) => codes.add(String(c)));
    }
    for (const role of ['cash_on_hand', 'cash_in_bank', 'petty_cash_fund', 'premium_receivable', 'commission_receivable', 'agent_receivable', 'employee_advances', 'input_vat',
      'creditable_wht', 'due_to_insurer', 'commission_payable', 'wht_payable', 'output_vat', 'client_refund_payable', 'supplier_payable', 'commission_income', 'commission_expense', 'write_off']) {
      expect(rows.some((r) => r.key === `accounting.account.${role}`), role).toBe(true);
    }
    // codes hard-wired in the sample ledger seed and the petty-cash samples
    const seedSql = fs.readFileSync(path.join(here, '../src/db/seeds/sample/40_finance.sql'), 'utf8');
    for (const m of seedSql.matchAll(/'([1-5]\d{6})'/g)) codes.add(m[1]);
    const chart = new Map((await accounts()).map((a) => [a.code, a]));
    for (const c of codes) {
      expect(chart.has(c), `account ${c}`).toBe(true);
      expect(chart.get(c).status, `account ${c}`).toBe('active');
    }
  });

  it('is a complete Philippine broker chart, grouped for the statements', async () => {
    const all = await accounts();
    const byCode = new Map(all.map((a) => [a.code, a]));
    const expected = {
      '1101001': 'Cash on Hand', '1103001': 'Petty Cash Fund', '1102003': 'Premium Trust', '1202001': 'Premiums Receivable', '1203001': 'Commission Receivable',
      '1203002': 'Due from Insurers', '1204002': 'Advances to Agents', '1301001': 'Input VAT', '1302001': 'Creditable Withholding Tax', '1303001': 'Prepaid',
      '1401001': 'Office Equipment', '1402001': 'Accumulated Depreciation', '1501001': 'Security Deposits', '2201001': 'Premiums Payable', '2203001': 'Commission Payable',
      '2204001': 'Expanded Withholding Tax', '2204002': 'Withholding Tax on Compensation', '2204003': 'Output VAT', '2207001': 'SSS', '2207002': 'PhilHealth', '2207003': 'Pag-IBIG',
      '2208001': 'Accrued Expenses', '2209001': 'Unearned Commission', '2202001': 'Unapplied Collections', '5100001': 'Capital Stock', '5101001': 'Retained Earnings',
      '5102001': 'Current Year Profit', '3201001': 'Brokerage Commission Income', '3202001': 'Service Fees', '3301001': 'Interest Income', '3302001': 'Other Income',
      '4401010': 'Commission Expense', '4301001': 'Salaries and Wages', '4301002': '13th Month', '4301003': 'SSS', '4301004': 'PhilHealth', '4301005': 'Pag-IBIG',
      '4402001': 'Rent', '4402002': 'Light and Water', '4401007': 'Communication', '4403001': 'Transportation and Travel', '4401006': 'Professional Fees', '4405001': 'Taxes and Licenses',
      '4405002': 'Insurance', '4406001': 'Depreciation', '4401008': 'Office Supplies', '4407001': 'Repairs and Maintenance', '4403002': 'Representation and Entertainment',
      '4401002': 'Advertising', '4408001': 'Training', '4401004': 'Bank Charges', '4407002': 'IT and Software', '4409001': 'Miscellaneous',
    };
    for (const [code, name] of Object.entries(expected)) {
      expect(byCode.get(code)?.name, code).toContain(name);
      expect(byCode.get(code).status, code).toBe('active');
    }
    const groupType = new Map(FS_GROUPS);
    for (const a of all) {
      expect(a.fs_group, a.code).toBeTruthy();
      expect(groupType.get(a.fs_group), `${a.code} ${a.fs_group}`).toBe(a.account_type);
      expect(String(a.code)[0], a.code).toBe({ asset: '1', liability: '2', income: '3', expense: '4', equity: '5' }[a.account_type]);
    }
    // contra accounts carry a credit balance, the income summary is not for manual vouchers
    expect(byCode.get('1402001').normal_balance).toBe('credit');
    expect(byCode.get('1202020').normal_balance).toBe('credit');
    expect(byCode.get('5102001').allow_manual).toBe(false);
    // insurer-only accounts of the earlier chart are not part of a broker chart
    expect(all.filter((a) => /^(3101001|4101001)/.test(a.code) && a.status === 'active')).toEqual([]);
  });

  it('re-seeding is idempotent: new accounts added, edits kept, legacy labels upgraded, legacy insurer accounts retired', async () => {
    const before = await accounts();
    const jvSig = async () => (await query(`SELECT j.id, j.status, string_agg(l.account_code || ':' || l.debit || ':' || l.credit, ',' ORDER BY l.line_no) AS sig
      FROM journal_vouchers j JOIN journal_lines l ON l.jv_id = j.id GROUP BY j.id, j.status ORDER BY j.id`)).rows;
    const jvsBefore = await jvSig();
    // an administrator's edit is kept
    await query('UPDATE gl_accounts SET name = \'Office Supplies Expense\' WHERE code = \'4401008\'');
    // an account from the earlier seed that was never classified is renamed and grouped
    await query('UPDATE gl_accounts SET name = \'Cash in Bank – BDO Current\', fs_group = NULL, category = \'Cash\' WHERE code = \'1102001\'');
    // an insurer-only account of the earlier chart, never posted to, is retired; one with postings stays
    await query(`INSERT INTO gl_accounts(code, name, account_type, category) VALUES ('3101001', 'Gross Written Premium', 'income', 'Premium'),
      ('4101001', 'Gross Claims Paid', 'expense', 'Claims') ON CONFLICT (code) DO UPDATE SET status = 'active', fs_group = NULL`);
    // an account missing from an older database is added back
    await query('DELETE FROM master_records WHERE type_code = \'main-account\' AND code = \'4409001\'');
    await query('DELETE FROM gl_accounts WHERE code = \'4409001\'');
    await seed({ log: () => {} });
    clearSettingsCache();
    const after = await accounts();
    const byCode = new Map(after.map((a) => [a.code, a]));
    expect(after.length).toBe(before.length + 2);
    expect(byCode.get('4409001').name).toBe('Miscellaneous Expense');
    expect(byCode.get('4401008').name).toBe('Office Supplies Expense');
    expect(byCode.get('1102001')).toMatchObject({ name: 'Cash in Bank – Operating Account', fs_group: 'Current Assets', category: 'Cash and Cash Equivalents' });
    expect(byCode.get('3101001').status).toBe('inactive');
    expect(byCode.get('4101001').status).toBe('inactive');
    // a second run changes nothing
    await seed({ log: () => {} });
    expect((await accounts()).map((a) => `${a.code}|${a.name}|${a.status}|${a.fs_group}`)).toEqual(after.map((a) => `${a.code}|${a.name}|${a.status}|${a.fs_group}`));
    // existing journals untouched (same accounts and amounts) and every journal balanced; the trial balance still balances
    const jvsAfter = new Map((await jvSig()).map((j) => [j.id, j]));
    for (const j of jvsBefore) expect(jvsAfter.get(j.id), j.id).toEqual(j);
    expect(await balanced()).toBe(0);
    const tb = await ctx.api('get', '/accounting/trial-balance');
    expect(tb.body.data.totals.balanced).toBe(true);
    expect(tb.body.data.byType.map((t) => t.accountType)).toEqual(['asset', 'liability', 'equity', 'income', 'expense']);
    const types = tb.body.data.rows.map((r) => r.accountType);
    expect(types).toEqual([...types].sort((a, b) => ['asset', 'liability', 'equity', 'income', 'expense'].indexOf(a) - ['asset', 'liability', 'equity', 'income', 'expense'].indexOf(b)));
    expect(tb.body.data.rows.find((r) => r.accountCode === '1102001').accountName).toBe('Cash in Bank – Operating Account');
  });

  it('the Main / Sub Account masters list the GL chart', async () => {
    const main = await ctx.api('get', '/masters/main-account/options?limit=1000');
    expect(main.status).toBe(200);
    const codes = main.body.data.map((o) => o.code);
    expect(codes).toEqual(expect.arrayContaining(['1203001', '1302001', '2204003', '4402001']));
    expect(codes).not.toContain('1010');
    const sub = await ctx.api('get', '/masters/sub-account/options?limit=1000');
    expect(sub.body.data.map((o) => o.code)).toEqual(expect.arrayContaining(['4401003001']));
  });

  it('is maintained from the chart of accounts screen (type grouping, statement group, system accounts protected)', async () => {
    const groups = await ctx.api('get', '/accounting/account-groups');
    expect(groups.body.data.groups).toEqual(expect.arrayContaining([{ group: 'Operating Expenses', accountType: 'expense' }]));
    const list = await ctx.api('get', '/accounting/accounts?type=expense');
    expect(list.body.data.every((a) => a.accountType === 'expense')).toBe(true);
    expect(list.body.data.find((a) => a.code === '4401010')).toMatchObject({ fsGroup: 'Cost of Services', isSystem: true, systemRoles: ['commission_expense'] });
    const bad = await ctx.api('post', '/accounting/accounts').send({ code: '4409101', name: 'Donations', accountType: 'expense', fsGroup: 'Current Assets' });
    expect(bad.status).toBe(400);
    const c = await ctx.api('post', '/accounting/accounts').send({ code: '4409101', name: 'Donations and Contributions', accountType: 'expense', fsGroup: 'Operating Expenses', category: 'Operating Expenses' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ fsGroup: 'Operating Expenses', normalBalance: 'debit', isSystem: false });
    const sub = await ctx.api('post', '/accounting/accounts').send({ code: '4409101001', name: 'Donations – Typhoon Relief', accountType: 'expense', parentCode: '4409101' });
    expect(sub.status).toBe(201);
    expect((await ctx.api('post', '/accounting/accounts').send({ code: '4409101002', name: 'Wrong parent type', accountType: 'expense', parentCode: '1101001' })).status).toBe(400);
    const opts = (await ctx.api('get', '/masters/main-account/options?limit=1000')).body.data.map((o) => o.code);
    expect(opts).toContain('4409101');
    expect((await ctx.api('get', '/masters/sub-account/options?limit=1000')).body.data.map((o) => o.code)).toContain('4409101001');
    expect((await ctx.api('get', '/accounting/accounts?level=sub&search=4409101')).body.data.map((a) => a.code)).toEqual(['4409101001']);
    // a system account cannot be deactivated
    const off = await ctx.api('put', '/accounting/accounts/2204003').send({ status: 'inactive' });
    expect(off.status).toBe(409);
    expect(off.body.message).toMatch(/output_vat/);
  });
});
