/**
 * Bank reconciliation: statement formats and import (preview, balance check, duplicate detection), automatic matching
 * (reference, amount + date window, one-to-many, many-to-one, book contra), manual match / unmatch with audit,
 * adjustments from the bank side (balanced journals, direction check, returned cheque), the Bank Reconciliation
 * Statement arithmetic with maker-checker approval, stale cheques, the month-end close check and the reports.
 * Uses its own bank account ACC-TEST-001 on GL 1102009 with June 2026 activity (independent of the sample data).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { createJournal, reverseJournal } from '../src/modules/accounting/lib/ledger.js';
import { parseAmount, parseDate } from '../src/modules/bank-reconciliation/statements.js';
import { bankAutoMatch } from '../src/modules/bank-reconciliation/jobs.js';

let ctx; let admin; let maker; let fm;
const GL = '1102009';
const ACCT = 'ACC-TEST-001';
const system = { id: null };
const jv = (date, amount, ref, other = '1202001', extra = {}) => withTransaction((db) => createJournal(db, {
  date, description: `Test ${ref}`, transactionCode: ref, source: extra.source || 'manual',
  lines: amount > 0 ? [{ accountCode: GL, debit: amount, credit: 0, memo: ref }, { accountCode: other, debit: 0, credit: amount }]
    : [{ accountCode: other, debit: -amount, credit: 0 }, { accountCode: GL, debit: 0, credit: -amount, memo: ref }],
}, system));
const csv = (rows) => Buffer.from(['Date,Description,Reference,Debit,Credit,Balance', ...rows.map((r) => r.join(','))].join('\n'));
const upload = (who, path, fields, buf, name = 'statement.csv') => {
  let r = who('post', path);
  for (const [k, v] of Object.entries(fields)) r = r.field(k, String(v));
  return r.attach('file', buf, name);
};
const auditCount = async (entity, action) => Number((await query('SELECT count(*) FROM audit_log WHERE entity = $1 AND action = $2', [entity, action])).rows[0].count);

// June 2026 statement of ACC-TEST-001 (GENERIC format); running balance from an opening balance of 0
const JUNE = [
  ['2026-06-04', 'DEPOSIT', 'OR-T-1001', '', '10000.00'],
  ['2026-06-07', 'CHECK ENCASHMENT', '555', '2500.00', ''],
  ['2026-06-12', 'CASH DEPOSIT', '', '', '7300.00'],
  ['2026-06-16', 'DEPOSIT BATCH', '', '', '3500.00'],
  ['2026-06-21', 'BILLS PAYMENT BATCH 1', '', '1500.00', ''],
  ['2026-06-21', 'BILLS PAYMENT BATCH 2', '', '2500.00', ''],
  ['2026-06-26', 'CASH DEPOSIT', '', '', '1234.50'],
  ['2026-06-30', 'SERVICE CHARGE', '', '150.00', ''],
  ['2026-06-30', 'INTEREST CREDIT', '', '', '80.00'],
];
const withBalance = (rows, opening = 0) => {
  let b = opening;
  return rows.map((r) => { b = Math.round((b + Number(r[4] || 0) - Number(r[3] || 0)) * 100) / 100; return [...r, b.toFixed(2)]; });
};
const JUNE_CLOSING = 15464.5;
let juneFile;

beforeAll(async () => {
  ctx = await setupFinance();
  admin = ctx.api;
  maker = ctx.as('maker');
  await admin('post', '/users').send({ username: 'fin.manager', password: 'Welcome@123', displayName: 'Finance Manager', roles: ['accounting-manager'], email: 'fin.manager@example.ph' });
  const tok = (await request(ctx.app).post('/api/auth/login').send({ username: 'fin.manager', password: 'Welcome@123' })).body.accessToken;
  fm = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);
  await query(`INSERT INTO gl_accounts(code, name, account_type, category, is_open_item, allow_manual, fs_group, normal_balance) VALUES ($1, 'Cash in Bank - Test Account', 'asset', 'Cash and Cash Equivalents', false, true, 'Current Assets', 'debit')
    ON CONFLICT (code) DO NOTHING`, [GL]);
  await query(`INSERT INTO master_records(type_code, code, name, data, status, created_by) VALUES ('bank-account', $1, 'Test Current Account',
    '{"accountCode":"ACC-TEST-001","accountName":"Test Current Account","bankCode":"UBP","bankName":"UnionBank","accountNumber":"0001-2345-6789","accountType":"Current Account","currency":"PHP"}', 'active', 'test')`, [ACCT]);
  // stale cheque (printed in January, never presented)
  const old = await jv('2026-01-15', -3200, '000777', '2201001', { source: 'disbursement' });
  await query('INSERT INTO checkbooks(customer_name, instrument_no, instrument_date, totale_amount, status, journal_id) VALUES (\'Stale Payee Inc.\', \'000777\', \'2026-01-15\', 3200, \'Printed\', $1)', [old.id]);
  // June book entries
  await jv('2026-06-03', 10000, 'OR-T-1001');
  await jv('2026-06-05', -2500, '000555', '2201001');
  await jv('2026-06-10', 7300, 'X-7300');
  await jv('2026-06-15', 1000, 'OR-T-2001');
  await jv('2026-06-15', 2500, 'OR-T-2002');
  await jv('2026-06-20', -4000, 'PV-T-9', '2201001');
  await jv('2026-06-28', -6000, '000556', '2201001');
  await jv('2026-06-29', 8000, 'OR-T-3001');
  await jv('2026-06-25', 1234.5, 'MISC-1');
  await jv('2026-06-27', 1234.5, 'MISC-3');
  await jv('2026-07-02', 1510, 'OR-T-4001');
  const b10 = await jv('2026-06-24', 1234.5, 'MISC-2');
  await withTransaction((db) => reverseJournal(db, b10.id, system, { date: '2026-06-27' }));
  juneFile = csv(withBalance(JUNE));
});
afterAll(async () => { await pool.end(); });

describe('parsing helpers', () => {
  it('reads Philippine bank date and amount formats', () => {
    expect(parseDate('09/15/2026', 'MM/DD/YYYY')).toBe('2026-09-15');
    expect(parseDate('15/09/2026', 'DD/MM/YYYY')).toBe('2026-09-15');
    expect(parseDate('Sep 15, 2026', 'MMM DD, YYYY')).toBe('2026-09-15');
    expect(parseDate('15-Sep-2026', 'DD-MMM-YYYY')).toBe('2026-09-15');
    expect(parseDate('2026-02-30', 'YYYY-MM-DD')).toBeNull();
    expect(parseDate('46280', 'MM/DD/YYYY')).toBe('2026-09-15');
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('(250.00)')).toBe(-250);
    expect(parseAmount('PHP 1,000.00 DR')).toBe(-1000);
    expect(parseAmount('-')).toBe(0);
    expect(Number.isNaN(parseAmount('abc'))).toBe(true);
  });
});

describe('bank account set-up and masters', () => {
  it('links the bank account to its GL cash account; finance reads, agents may not', async () => {
    expect((await admin('put', `/bank-reconciliation/bank-accounts/${ACCT}`).send({ glAccountCode: '3201001' })).status).toBe(400);
    expect((await admin('put', `/bank-reconciliation/bank-accounts/${ACCT}`).send({ glAccountCode: '1102001' })).status).toBe(409); // linked to ACC-BDO-001 by the sample data
    // reconcile from January: the stale January cheque is an opening outstanding item (default: the first statement's start)
    const r = await maker('put', `/bank-reconciliation/bank-accounts/${ACCT}`).send({ glAccountCode: GL, statementFormat: 'GENERIC', reconcileFrom: '2026-01-01' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ code: ACCT, glAccountCode: GL, statementFormat: 'GENERIC', reconcileFrom: '2026-01-01' });
    const list = await maker('get', '/bank-reconciliation/bank-accounts');
    expect(list.body.data.find((a) => a.code === ACCT).glAccountCode).toBe(GL);
    expect((await ctx.as('agent')('get', '/bank-reconciliation/bank-accounts')).status).toBe(403);
    const types = (await maker('get', '/bank-reconciliation/transaction-types')).body.data.items;
    expect(types.map((t) => t.code)).toEqual(expect.arrayContaining(['BCHG', 'INT', 'FTAX', 'RCHQ', 'DCR-INS', 'DCR-CLI']));
    const formats = (await maker('get', '/bank-reconciliation/formats')).body.data.items;
    expect(formats.find((f) => f.code === 'GENERIC').isExample).toBe(false);
    expect(formats.filter((f) => ['BDO-SAMPLE', 'BPI-SAMPLE', 'MBT-SAMPLE'].includes(f.code) && !f.isExample).length).toBe(3);
  });
});

describe('statement import', () => {
  it('previews a file: lines, totals, balance check and suggested transaction types', async () => {
    const p = await upload(maker, '/bank-reconciliation/statements/preview', { bankAccount: ACCT, format: 'GENERIC', statementRef: 'SOA JUN 2026' }, juneFile);
    expect(p.status, JSON.stringify(p.body)).toBe(200);
    expect(p.body.data).toMatchObject({ lineCount: 9, openingBalance: 0, closingBalance: JUNE_CLOSING, balanced: true, duplicates: 0, periodFrom: '2026-06-04', periodTo: '2026-06-30' });
    expect(p.body.data.lines.find((l) => l.description === 'SERVICE CHARGE').suggestedType).toBe('BCHG');
    expect(p.body.data.lines.find((l) => l.description === 'INTEREST CREDIT').suggestedType).toBe('INT');
  });

  it('refuses a statement that does not balance', async () => {
    const r = await upload(maker, '/bank-reconciliation/statements/import', { bankAccount: ACCT, format: 'GENERIC', openingBalance: 0, closingBalance: 99999 }, juneFile);
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/does not balance/);
  });

  it('imports the statement and auto-matches: reference, amount + date window, 1:many, many:1 and book contra', async () => {
    const r = await upload(maker, '/bank-reconciliation/statements/import', { bankAccount: ACCT, format: 'GENERIC', statementRef: 'SOA JUN 2026' }, juneFile);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.statement).toMatchObject({ lineCount: 9, openingBalance: 0, closingBalance: JUNE_CLOSING });
    expect(r.body.data.statement.statementNumber).toMatch(/^BST-\d{4}-\d{5}$/);
    const byRule = r.body.data.autoMatch.byRule;
    expect(byRule).toMatchObject({ REFERENCE: 2, AMOUNT_DATE: 1, ONE_TO_MANY: 1, MANY_TO_ONE: 1, CONTRA: 1 });
    const ws = (await maker('get', `/bank-reconciliation/workspace?bankAccount=${ACCT}&period=2026-06`)).body.data;
    const bank = (d) => ws.bankLines.find((l) => l.description === d);
    expect(bank('DEPOSIT').matchId).toBeTruthy();
    expect(bank('CASH DEPOSIT') && ws.bankLines.filter((l) => l.description === 'CASH DEPOSIT' && !l.matchId).map((l) => l.amount)).toEqual([1234.5]); // ambiguous: two book entries of 1,234.50
    expect(ws.summary.unmatchedBank).toBe(3);
  });

  it('detects a file imported twice and duplicate lines of an overlapping statement (custom format with title rows)', async () => {
    const again = await upload(maker, '/bank-reconciliation/statements/import', { bankAccount: ACCT, format: 'GENERIC' }, juneFile);
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already imported/);
    const fmt = await maker('post', '/bank-reconciliation/formats').send({ code: 'TEST-SIGNED', name: 'Test signed amount', skipRows: 2, dateFormat: 'DD/MM/YYYY', amountSign: 'credit-positive',
      columns: { date: 'Txn Date', description: 'Particulars', reference: 'Ref No', amount: 'Amount', balance: 'Balance' }, skipPattern: '^total' });
    expect(fmt.status, JSON.stringify(fmt.body)).toBe(201);
    // the last June line again, and a July deposit
    const file = Buffer.from(['UNIONBANK OF THE PHILIPPINES', 'Account 0001-2345-6789', 'Txn Date,Particulars,Ref No,Amount,Balance',
      `30/06/2026,INTEREST CREDIT,,80.00,${JUNE_CLOSING.toFixed(2)}`, `02/07/2026,DEPOSIT,OR-T-4001,"1,500.00",${(JUNE_CLOSING + 1500).toFixed(2)}`, 'TOTAL,,,1580.00,'].join('\n'));
    const pv = await upload(maker, '/bank-reconciliation/statements/preview', { bankAccount: ACCT, format: 'TEST-SIGNED' }, file, 'ub.csv');
    expect(pv.status, JSON.stringify(pv.body)).toBe(200);
    expect(pv.body.data).toMatchObject({ lineCount: 2, duplicates: 1, balanced: true, skippedRows: 1 });
    expect(pv.body.data.lines[0].duplicate).toBe(true);
    const refused = await upload(maker, '/bank-reconciliation/statements/import', { bankAccount: ACCT, format: 'TEST-SIGNED' }, file, 'ub.csv');
    expect(refused.status).toBe(409);
    expect(refused.body.message).toMatch(/duplicate/);
    const ok = await upload(maker, '/bank-reconciliation/statements/import', { bankAccount: ACCT, format: 'TEST-SIGNED', skipDuplicates: 'true' }, file, 'ub.csv');
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.data.statement).toMatchObject({ lineCount: 1, openingBalance: JUNE_CLOSING, closingBalance: JUNE_CLOSING + 1500, periodFrom: '2026-07-02' });
  });
});

describe('matching', () => {
  it('manual match and unmatch are recorded and audited', async () => {
    const ws = (await maker('get', `/bank-reconciliation/workspace?bankAccount=${ACCT}&period=2026-06`)).body.data;
    const line = ws.bankLines.find((l) => l.description === 'CASH DEPOSIT' && !l.matchId);
    const books = ws.bookLines.filter((v) => v.amount === 1234.5 && !v.matchId);
    expect(books.map((v) => v.date)).toEqual(['2026-06-25', '2026-06-27']); // MISC-2 was reversed (contra); two candidates: not auto-matched
    const bad = await maker('post', '/bank-reconciliation/matches').send({ bankAccount: ACCT, bankLineIds: [line.id], bookLineIds: [ws.bookLines.find((v) => v.amount === 8000).id] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/differ/);
    const m = await maker('post', '/bank-reconciliation/matches').send({ bankAccount: ACCT, bankLineIds: [line.id], bookLineIds: [books[0].id], remarks: 'Cash deposit of MISC-1' });
    expect(m.status, JSON.stringify(m.body)).toBe(201);
    expect(m.body.data).toMatchObject({ matchType: 'manual', bankTotal: 1234.5, bookTotal: 1234.5, difference: 0, status: 'active' });
    expect((await maker('post', '/bank-reconciliation/matches').send({ bankAccount: ACCT, bankLineIds: [line.id], bookLineIds: [books[0].id] })).status).toBe(409);
    const un = await maker('post', `/bank-reconciliation/matches/${m.body.data.id}/unmatch`).send({ reason: 'check the deposit slip' });
    expect(un.status).toBe(200);
    expect(un.body.data).toMatchObject({ status: 'unmatched', unmatchReason: 'check the deposit slip' });
    expect(un.body.data.unmatchedBy).toBe('maker user');
    expect(await auditCount('bank_rec_match', 'unmatch')).toBe(1);
    expect(await auditCount('bank_rec_match', 'match')).toBe(1);
    const all = (await maker('get', `/bank-reconciliation/matches?bankAccount=${ACCT}&status=all`)).body.data;
    expect(all.find((x) => x.id === m.body.data.id).status).toBe('unmatched');
    expect((await maker('post', '/bank-reconciliation/matches').send({ bankAccount: ACCT, bankLineIds: [line.id], bookLineIds: [books[0].id] })).status).toBe(201);
  });

  it('a difference is explained by an adjustment journal of a bank transaction type', async () => {
    const ws = (await maker('get', `/bank-reconciliation/workspace?bankAccount=${ACCT}&period=2026-07`)).body.data;
    const line = ws.bankLines.find((l) => l.reference === 'OR-T-4001');
    const book = ws.bookLines.find((v) => v.documentNumber === 'OR-T-4001');
    expect(line.matchId).toBeNull();
    const r = await maker('post', '/bank-reconciliation/matches').send({ bankAccount: ACCT, bankLineIds: [line.id], bookLineIds: [book.id], difference: { treatment: 'adjustment', typeCode: 'BCHG', remarks: 'Deposit fee deducted' } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data).toMatchObject({ bankTotal: 1500, bookTotal: 1500, difference: 0 });
    expect(r.body.data.items.filter((i) => i.side === 'book')).toHaveLength(2);
    const fee = (await query('SELECT l.account_code, l.debit FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE j.source = \'bank-reconciliation\' AND l.debit = 10')).rows;
    expect(fee).toEqual([{ account_code: '650010', debit: 10 }]);
  });
});

describe('adjustments', () => {
  it('posts a balanced bank charge journal from the bank line and matches it; the direction must fit the type', async () => {
    const ws = (await maker('get', `/bank-reconciliation/workspace?bankAccount=${ACCT}&period=2026-06`)).body.data;
    const charge = ws.bankLines.find((l) => l.description === 'SERVICE CHARGE');
    expect((await maker('post', `/bank-reconciliation/bank-lines/${charge.id}/adjustment`).send({ typeCode: 'INT' })).status).toBe(400);
    const r = await maker('post', `/bank-reconciliation/bank-lines/${charge.id}/adjustment`).send({ typeCode: 'BCHG', remarks: 'June service charge' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.status).toBe('posted');
    expect(r.body.data.matchId).toBeTruthy();
    const lines = (await query('SELECT l.account_code, l.debit, l.credit, j.source, j.jv_date FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE j.id = $1 ORDER BY l.line_no', [r.body.data.journal.id])).rows;
    expect(lines.map((l) => [l.account_code, Number(l.debit), Number(l.credit)])).toEqual([['650010', 150, 0], [GL, 0, 150]]);
    expect(lines[0].source).toBe('bank-reconciliation');
    expect(lines[0].jv_date).toBe('2026-06-30');
    expect((await maker('post', `/bank-reconciliation/bank-lines/${charge.id}/adjustment`).send({ typeCode: 'BCHG' })).status).toBe(409);
  });

  it('a type that requires approval creates the journal for approval; a second user posts it and it is matched', async () => {
    await query('UPDATE bank_transaction_types SET requires_approval = true WHERE code = \'INT\'');
    const ws = (await maker('get', `/bank-reconciliation/workspace?bankAccount=${ACCT}&period=2026-06`)).body.data;
    const interest = ws.bankLines.find((l) => l.description === 'INTEREST CREDIT');
    const r = await maker('post', `/bank-reconciliation/bank-lines/${interest.id}/adjustment`).send({ typeCode: 'INT' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.status).toBe('for-approval');
    expect(r.body.data.matchId).toBeNull();
    expect((await maker('post', `/bank-reconciliation/bank-lines/${interest.id}/adjustment/approve`)).status).toBe(403); // maker-checker
    const ap = await ctx.as('checker')('post', `/bank-reconciliation/bank-lines/${interest.id}/adjustment/approve`);
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect(ap.body.data).toMatchObject({ journal: { status: 'posted' }, matched: 1 });
    await query('UPDATE bank_transaction_types SET requires_approval = false WHERE code = \'INT\'');
  });
});

describe('reconciliation statement and approval', () => {
  let rec;
  it('computes the Bank Reconciliation Statement: deposits in transit, outstanding cheques, balances agree', async () => {
    const c = await maker('post', '/bank-reconciliation/reconciliations').send({ bankAccount: ACCT, period: '2026-06' });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    rec = c.body.data;
    expect(rec.recNumber).toMatch(/^BRC-\d{4}-\d{5}$/);
    const s = rec.statement;
    // bank: 14,184.50; books: all June entries + January stale cheque + bank charge + interest
    expect(s.bankBalance).toBe(JUNE_CLOSING);
    expect(s.depositsInTransit).toBe(9234.5); // OR-T-3001 and MISC-3
    expect(s.outstandingCheques).toBe(9200); // 6,000 (June) + 3,200 (stale, January)
    expect(s.bookBalance).toBe(Math.round((10000 - 2500 + 7300 + 1000 + 2500 - 4000 - 6000 + 8000 + 1234.5 + 1234.5 - 3200 - 150 + 80) * 100) / 100);
    expect(s.unbookedCredits).toBe(0);
    expect(s.unbookedDebits).toBe(0);
    expect(s.adjustedBankBalance).toBe(Math.round((JUNE_CLOSING + 9234.5 - 9200) * 100) / 100);
    expect(s.adjustedBankBalance).toBe(s.adjustedBookBalance);
    expect(s.difference).toBe(0);
    expect(s.items.outstandingCheques.map((x) => x.chequeNumber || x.documentNumber).sort()).toEqual(['000556', '000777']);
    expect((await maker('post', '/bank-reconciliation/reconciliations').send({ bankAccount: ACCT, period: '2026-06' })).status).toBe(409);
  });

  it('bank errors and unbooked items are reconciling items; the difference must be zero to prepare', async () => {
    const ws = (await maker('get', `/bank-reconciliation/workspace?bankAccount=${ACCT}&period=2026-06`)).body.data;
    const deposit = ws.bankLines.find((l) => l.description === 'DEPOSIT' && l.date === '2026-06-04');
    // unmatch the OR-T-1001 deposit: bank 10,000 becomes an unbooked credit and the book entry a deposit in transit
    const un = await maker('post', `/bank-reconciliation/matches/${deposit.matchId}/unmatch`).send({ reason: 'test' });
    expect(un.status).toBe(200);
    let s = (await maker('get', `/bank-reconciliation/reconciliations/${rec.id}`)).body.data.statement;
    expect(s).toMatchObject({ unbookedCredits: 10000, depositsInTransit: 19234.5, difference: 0 });
    const flagged = await maker('post', `/bank-reconciliation/bank-lines/${deposit.id}/flag`).send({ flag: 'bank-error', remarks: 'test flag' });
    expect(flagged.status).toBe(200);
    s = (await maker('get', `/bank-reconciliation/reconciliations/${rec.id}`)).body.data.statement;
    expect(s.bankErrors).toBe(-10000);
    expect(s.unbookedCredits).toBe(0);
    expect(s.difference).toBe(0); // a bank error is taken out of the bank balance instead of being booked
    // an unexplained difference (opening balance not agreeing with the books) blocks the preparation
    await query('UPDATE bank_statements SET opening_balance = opening_balance + 1 WHERE bank_account_id = (SELECT id FROM master_records WHERE code = $1) AND period_from = \'2026-06-04\'', [ACCT]);
    const blocked = await maker('post', `/bank-reconciliation/reconciliations/${rec.id}/prepare`).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/differ by 1/);
    await query('UPDATE bank_statements SET opening_balance = opening_balance - 1 WHERE bank_account_id = (SELECT id FROM master_records WHERE code = $1) AND period_from = \'2026-06-04\'', [ACCT]);
    await maker('post', `/bank-reconciliation/bank-lines/${deposit.id}/flag`).send({ flag: null });
    expect((await maker('post', '/bank-reconciliation/auto-match').send({ bankAccount: ACCT })).body.data.byRule.REFERENCE).toBe(1);
    s = (await maker('get', `/bank-reconciliation/reconciliations/${rec.id}`)).body.data.statement;
    expect(s.difference).toBe(0);
  });

  it('prepare -> approve with maker-checker; approval locks the matches; reopen needs an approver and remarks', async () => {
    const prep = await maker('post', `/bank-reconciliation/reconciliations/${rec.id}/prepare`).send({ remarks: 'All items explained' });
    expect(prep.status, JSON.stringify(prep.body)).toBe(200);
    expect(prep.body.data.status).toBe('prepared');
    expect((await maker('post', `/bank-reconciliation/reconciliations/${rec.id}/approve`).send({})).status).toBe(403); // finance lacks approve:bank-reconciliation
    const ap = await fm('post', `/bank-reconciliation/reconciliations/${rec.id}/approve`).send({ remarks: 'Reviewed' });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect(ap.body.data).toMatchObject({ status: 'approved', approvedByName: 'Finance Manager' });
    const locked = (await query('SELECT count(*)::int AS n FROM bank_rec_matches WHERE locked_by_rec = $1', [rec.id])).rows[0].n;
    expect(locked).toBeGreaterThanOrEqual(7);
    const ws = (await maker('get', `/bank-reconciliation/workspace?bankAccount=${ACCT}&period=2026-06`)).body.data;
    const m = ws.bankLines.find((l) => l.description === 'DEPOSIT BATCH');
    expect(m.locked).toBe(true);
    const un = await maker('post', `/bank-reconciliation/matches/${m.matchId}/unmatch`).send({});
    expect(un.status).toBe(409);
    expect(un.body.message).toMatch(/approved reconciliation/);
    // posting an adjustment dated in the approved period is refused
    expect((await maker('post', '/bank-reconciliation/statements').send({ bankAccount: ACCT, openingBalance: 0, closingBalance: -10, lines: [{ date: '2026-06-15', description: 'LATE', debit: 10 }] })).status).toBe(409);

    expect((await fm('post', `/bank-reconciliation/reconciliations/${rec.id}/reopen`).send({})).status).toBe(400);
    const re = await fm('post', `/bank-reconciliation/reconciliations/${rec.id}/reopen`).send({ remarks: 'Late debit memo' });
    expect(re.status, JSON.stringify(re.body)).toBe(200);
    expect(re.body.data.status).toBe('draft');
    expect(re.body.data.history.map((h) => h.to)).toEqual(['draft', 'approved', 'prepared', 'draft']);
    expect(await auditCount('bank_reconciliation', 'reopen')).toBe(1);
    // the preparer may not approve their own reconciliation
    expect((await fm('post', `/bank-reconciliation/reconciliations/${rec.id}/prepare`).send({})).status).toBe(200);
    const self = await fm('post', `/bank-reconciliation/reconciliations/${rec.id}/approve`).send({});
    expect(self.status).toBe(403);
    expect(self.body.message).toMatch(/Maker-checker/);
    expect((await admin('post', `/bank-reconciliation/reconciliations/${rec.id}/approve`).send({})).status).toBe(200);
  });

  it('prints the statement as PDF', async () => {
    const r = await maker('get', `/bank-reconciliation/reconciliations/${rec.id}/pdf`).buffer(true).parse((res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/pdf/);
    expect(r.body.slice(0, 5).toString()).toBe('%PDF-');
    expect(r.body.toString('latin1')).toMatch(/Bank Reconciliation Statement/);
  });
});

describe('month-end close integration', () => {
  it('the unreconciled_bank check fails for accounts with activity and no approved reconciliation; blocking stops the close', async () => {
    expect((await maker('get', '/period-end/fiscal-years')).status).toBe(200);
    let checks = (await maker('get', '/period-end/periods/2026-07/checks')).body.data;
    let bank = checks.find((c) => c.code === 'unreconciled_bank');
    expect(bank.status).toBe('warning'); // seeded severity: warning
    expect(bank.detail.map((d) => d.bankAccount)).toContain(ACCT);
    checks = (await maker('get', '/period-end/periods/2026-06/checks')).body.data;
    bank = checks.find((c) => c.code === 'unreconciled_bank');
    expect(bank.detail.map((d) => d.bankAccount)).not.toContain(ACCT);
    expect((await admin('put', '/period-end/checklist/unreconciled_bank').send({ severity: 'blocking' })).status).toBe(200);
    const close = await admin('post', '/period-end/periods/2026-07/status').send({ status: 'closed', remarks: 'try' });
    expect(close.status).toBe(409);
    expect(close.body.message).toMatch(/no approved bank reconciliation.*ACC-TEST-001/);
    await query('UPDATE app_settings SET value = \'"2026-08"\' WHERE key = \'bank_reconciliation.check_from_period\'');
    clearSettingsCache();
    const na = (await maker('get', '/period-end/periods/2026-07/checks')).body.data.find((c) => c.code === 'unreconciled_bank');
    expect(na.status).toBe('not-applicable');
    await query('UPDATE app_settings SET value = \'""\' WHERE key = \'bank_reconciliation.check_from_period\'');
    clearSettingsCache();
    await admin('put', '/period-end/checklist/unreconciled_bank').send({ severity: 'warning' });
    const rep = await admin('post', '/reports/month-end-close-status/run').send({ FromDate: '2026-06-01', ToDate: '2026-06-30' });
    expect(rep.status, JSON.stringify(rep.body)).toBe(200);
    expect(rep.body.data.rows[0].bankReconciliations).toMatch(/^1 \/ \d+$/);
  });
});

describe('returned cheques and stale cheques', () => {
  it('a returned cheque cancels the official receipt, re-opens the receivable and matches the reversal to the bank debit', async () => {
    await query('UPDATE app_settings SET value = value || $1::jsonb WHERE key = \'accounting.cash_account_by_payment_mode\'', [JSON.stringify({ check: GL })]);
    clearSettingsCache();
    const p = await makePolicy({ net: 4000 });
    const rc = await maker('post', '/receipts').send({ policyId: p.policy.id, amount: p.gross, paymentMode: 'check', referenceNo: 'CHQ-889911' });
    expect(rc.status, JSON.stringify(rc.body)).toBe(201);
    const receipt = rc.body.data;
    const rcv = (await query('SELECT id, balance FROM receivables WHERE policy_id = $1', [p.policy.id])).rows[0];
    expect(Number(rcv.balance)).toBe(0);
    const day = receipt.receiptDate;
    const s = await maker('post', '/bank-reconciliation/statements').send({ bankAccount: ACCT, statementRef: 'Current month', lines: [
      { date: day, description: 'CHECK DEPOSIT', reference: 'CHQ-889911', credit: p.gross },
      { date: day, description: 'RETURNED CHECK - DAIF', reference: 'CHQ-889911', debit: p.gross }] });
    expect(s.status, JSON.stringify(s.body)).toBe(201);
    expect(s.body.data.statement.openingBalance).toBe(JUNE_CLOSING + 1500);
    const ws = (await maker('get', `/bank-reconciliation/workspace?bankAccount=${ACCT}&period=${day.slice(0, 7)}`)).body.data;
    expect(ws.bankLines.find((l) => l.description === 'CHECK DEPOSIT').matchId).toBeTruthy();
    const ret = ws.bankLines.find((l) => l.description === 'RETURNED CHECK - DAIF');
    expect(ret.typeCode).toBe('RCHQ');
    const r = await maker('post', `/bank-reconciliation/bank-lines/${ret.id}/adjustment`).send({ typeCode: 'RCHQ', receiptId: receipt.receiptNumber, remarks: 'DAIF' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.matchId).toBeTruthy();
    const after = (await query('SELECT balance, status FROM receivables WHERE id = $1', [rcv.id])).rows[0];
    expect(Number(after.balance)).toBe(p.gross);
    expect((await query('SELECT receipt_status FROM receipts WHERE id = $1', [receipt.receiptId])).rows[0].receipt_status).toBe('Cancelled');
  });

  it('flags cheques outstanding beyond the stale period and cancels them (reversal, contra match)', async () => {
    const list = await maker('get', `/bank-reconciliation/stale-cheques?bankAccount=${ACCT}`);
    expect(list.status).toBe(200);
    expect(list.body.data.staleDays).toBe(180);
    const stale = list.body.data.rows.find((x) => x.chequeNumber === '000777');
    expect(stale).toMatchObject({ amount: -3200 });
    expect(list.body.data.rows.find((x) => x.chequeNumber === '000556')).toBeUndefined();
    const c = await maker('post', `/bank-reconciliation/stale-cheques/${stale.id}/cancel`).send({ bankAccount: ACCT, reason: 'Not presented' });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body.data.reversal.jvNumber).toBeTruthy();
    expect(c.body.data.matchId).toBeTruthy();
    expect((await query('SELECT status FROM checkbooks WHERE instrument_no = \'000777\'')).rows[0].status).toBe('Cancelled');
    expect((await maker('get', `/bank-reconciliation/stale-cheques?bankAccount=${ACCT}`)).body.data.rows.find((x) => x.chequeNumber === '000777')).toBeUndefined();
  });
});

describe('reports, remittance view and job', () => {
  it('runs the bank reconciliation reports', async () => {
    const run = async (code, params) => {
      const r = await admin('post', `/reports/${code}/run`).send({ ...params, perPage: 500 });
      expect(r.status, `${code} ${JSON.stringify(r.body)}`).toBe(200);
      return r.body.data;
    };
    const brs = await run('bank-reconciliation-statement', { FromDate: '2026-06-01', ToDate: '2026-06-30', BankAccount: ACCT });
    expect(brs.rows).toHaveLength(1);
    expect(brs.rows[0]).toMatchObject({ status: 'approved', difference: 0 });
    const oc = await run('bank-outstanding-cheques', { FromDate: '2026-06-01', ToDate: '2026-06-30', BankAccount: ACCT });
    expect(oc.rows.map((x) => x.amount).sort()).toEqual([3200, 6000]);
    expect(oc.rows.find((x) => x.amount === 3200).status).toBe('Outstanding'); // 166 days on 30 June
    const dit = await run('bank-deposits-in-transit', { FromDate: '2026-06-01', ToDate: '2026-06-30', BankAccount: ACCT });
    expect(dit.rows.map((x) => x.amount)).toEqual([1234.5, 8000]);
    const um = await run('bank-unmatched-lines', { FromDate: '2026-06-01', ToDate: '2026-12-31', BankAccount: ACCT });
    expect(um.rows).toEqual([]);
    const book = await run('bank-book', { FromDate: '2026-06-01', ToDate: '2026-06-30', BankAccount: ACCT });
    expect(book.rows[0]).toMatchObject({ description: 'Opening balance', openingBalance: -3200 });
    expect(book.rows.at(-1).runningBalance).toBe(book.summary.closingBalance);
  });

  it('the remittance reconciliation reads the bank statement line table and keeps its API', async () => {
    const r = await admin('get', '/remittance/reconciliation');
    expect(r.status).toBe(200);
    expect(r.body.data.bankTransactions.length).toBe(5);
    const imp = await admin('post', '/remittance/reconciliation/bank-transactions').send({ transactions: [{ transDate: '2026-09-27', reference: 'PSN-BR-1', amount: 1000 }] });
    expect(imp.body.data).toHaveLength(1);
    expect((await query('SELECT source, bank_account_id FROM bank_statement_lines WHERE reference = \'PSN-BR-1\'')).rows[0]).toEqual({ source: 'remittance', bank_account_id: null });
    expect((await query('SELECT count(*)::int AS n FROM remittance_items WHERE kind = \'bank-txn\'')).rows[0].n).toBe(0);
  });

  it('the scheduled auto-match job runs over the linked accounts', async () => {
    const r = await bankAutoMatch();
    expect(r.results.find((x) => x.bankAccount === ACCT)).toBeUndefined(); // nothing left to match
    const bdo = r.results.find((x) => x.bankAccount === 'ACC-BDO-001'); // sample statement of last month
    expect(bdo.error).toBeUndefined();
    expect(bdo.matched).toBeGreaterThanOrEqual(0);
  });
});
