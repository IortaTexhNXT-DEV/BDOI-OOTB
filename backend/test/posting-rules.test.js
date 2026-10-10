import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { EVENTS, buildJournal } from '../src/modules/accounting/lib/posting.js';
import { allocate, policyParticipants } from '../src/modules/accounting/lib/coinsurance.js';
import { returnPremium, findPolicy } from '../src/modules/receipts/receivables.js';
import { bookDirectBill } from '../src/modules/remittance/directbill.js';
import { eligiblePolicies } from '../src/modules/remittance/service.js';
import { withStarterInsurerAccounts, withoutCommissionTaxes, withoutConfigurationApproval } from './helpers.js';

let ctx;
// these suites check the journals of the original rules; commission taxes (rule version 2) are in commission-taxes.test.js
beforeAll(async () => { ctx = await setupFinance(); await withoutCommissionTaxes(); await withoutConfigurationApproval(); await withStarterInsurerAccounts(); });
afterAll(async () => { await pool.end(); });

const r2 = (n) => Math.round(n * 100) / 100;
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const linesOf = async (jvId) => (await query('SELECT account_code, debit::float AS debit, credit::float AS credit, memo, insurance_company_id FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId])).rows;
const simple = (lines) => lines.map((l) => [l.account_code ?? l.accountCode, r2(l.debit), r2(l.credit), l.memo]);
const bookingOf = async (policyId) => (await query('SELECT r.*, j.entry_sub_type FROM receivables r JOIN journal_vouchers j ON j.id = r.booking_jv_id WHERE r.policy_id = $1 ORDER BY r.created_at', [policyId])).rows;
const pay = (m, amount, extra = {}) => ctx.as('maker')('post', '/accounting/payment-entries').send({ amount, grossPremium: m.gross, netPremium: m.net, referenceType: 'Policy', referenceId: m.policy.id,
  clientId: m.client.id, policyId: m.policy.id, paymentMode: 'cash', referenceNo: 'REF-1', ...extra });
const insurerName = async (code) => (await query('SELECT name FROM insurance_companies WHERE code = $1', [code])).rows[0].name;

/** Three insurers sharing a policy 50 / 30 / 20: the lead at 15%, the second at 12%, the third without a rate (insurer master / default rate). */
async function coInsure(policy, shares = [50, 30, 20], rates = [0.15, 0.12, null]) {
  const ins = (await query('SELECT id, code, name, commission_rate FROM insurance_companies WHERE status = \'active\' ORDER BY (code = \'MALAYAN\') DESC, id LIMIT 3')).rows;
  for (const [i, x] of ins.entries()) {
    await query(`INSERT INTO risk_participants(entity_type, entity_id, insurance_company_id, is_lead, share_percent, commission_rate) VALUES ('policy', $1, $2, $3, $4, $5)`,
      [policy.id, x.id, i === 0, shares[i], rates[i]]);
  }
  await query('UPDATE policies SET insurance_company_id = $2 WHERE id = $1', [policy.id, ins[0].id]);
  return ins;
}

describe('posting rules reproduce the journals posted before they existed', () => {
  it('policy booking and receipt: same accounts, amounts, memos and order (premium taxes not split)', async () => {
    await setSetting('accounting.split_premium_taxes', false);
    const m = await makePolicy({ net: 10000 });
    const r = await pay(m, 5000, { valueAddedTax: 1200, documentaryStampTax: 1250, localGovernmentTax: 75 });
    expect(r.status).toBe(201);
    const [rcv] = await bookingOf(m.policy.id);
    const insurer = await insurerName('MALAYAN');
    expect(simple(await linesOf(rcv.booking_jv_id))).toEqual([
      ['1202001', 12525, 0, `Premium receivable ${rcv.bill_number}`], ['2201001', 0, 11025, `Premium due to ${insurer}`], ['3201001', 0, 1500, 'Brokerage commission']]);
    const app = (await query('SELECT journal_id FROM receipt_applications WHERE receivable_id = $1', [rcv.id])).rows[0];
    expect(simple(await linesOf(app.journal_id))).toEqual([['100000', 5000, 0, 'REF-1'], ['1202001', 0, 5000, `Settles ${rcv.bill_number}`]]);
    const jv = (await query('SELECT j.*, p.event_code FROM journal_vouchers j JOIN posting_rules p ON p.id = j.posting_rule_id WHERE j.id = $1', [rcv.booking_jv_id])).rows[0];
    expect(jv).toMatchObject({ event_code: 'policy.issue.broker_billed', entry_type: 'NEW_BUSINESS', source: 'booking', description: `Premium billed – ${m.policy.policy_number} (${rcv.bill_number})` });
    await setSetting('accounting.split_premium_taxes', true);
  });

  it('every other migrated event builds the legacy lines', async () => {
    const cases = [
      ['directbill.commission', { amounts: { amount: 1680, commission: 1500, vat: 180 }, vars: { insurer: 'FPG' } },
        [['110400', 1680, 0, 'Commission due from FPG'], ['3201001', 0, 1500, 'Brokerage commission (direct bill)'], ['235000', 0, 180, 'Output VAT on commission']]],
      ['directbill.commission_return', { amounts: { amount: 1680, commission: 1500, vat: 180 }, vars: { insurer: 'FPG' } },
        [['3201001', 1500, 0, 'Brokerage commission (direct bill)'], ['235000', 180, 0, 'Output VAT on commission'], ['110400', 0, 1680, 'Commission due from FPG']]],
      ['directbill.collection', { accounts: { bank: '1102002' }, amounts: { cash: 1530, ewt: 150, applied: 1680 }, vars: { insurer: 'FPG', memoRef: 'OR-9', form2307Suffix: ' (BIR 2307 F-1)', dnNumber: 'DN-1' } },
        [['1102002', 1530, 0, 'OR-9'], ['1302001', 150, 0, 'EWT withheld by FPG (BIR 2307 F-1)'], ['110400', 0, 1680, 'Settles DN-1']]],
      ['commission.approve', { amounts: { amount: 800 }, vars: { referrerName: 'Juan' } }, [['4401010', 800, 0, 'Comsub expense'], ['2203001', 0, 800, 'Payable to Juan']]],
      ['commission.payout', { amounts: { gross: 800, net: 760, wht: 40 }, vars: { payeeName: 'Juan' } },
        [['2203001', 800, 0, 'Comsub payable settled'], ['106010', 0, 760, 'Paid to Juan'], ['2204001', 0, 40, 'Withholding tax on commission']]],
      ['commission.clawback', { amounts: { amount: 800 } }, [['1204001', 800, 0, 'Clawback receivable from referrer'], ['4401010', 0, 800, 'Comsub clawback']]],
      ['disbursement.payment', { payeeType: 'Customer', paymentMode: 'check', amounts: { amount: 500, payable: 500 }, vars: { payeeType: 'Customer', instrumentNo: '000123' } },
        [['210230', 500, 0, 'Payable settled (Customer)'], ['106010', 0, 500, 'Cheque 000123']]],
      ['disbursement.payment', { payeeType: 'Insurer', paymentMode: 'check', amounts: { amount: 900, payable: 900 }, vars: { payeeType: 'Insurer', instrumentNo: '' } },
        [['2201001', 900, 0, 'Payable settled (Insurer)'], ['106010', 0, 900, 'Cheque']]],
      ['pettycash.fund', { accounts: { fund: '1103001' }, amounts: { amount: 10000 }, vars: { fundCode: 'PCF-1' } }, [['1103001', 10000, 0, 'Fund PCF-1'], ['106010', 0, 10000, 'Cheque to PCF-1 custodian']]],
      ['pettycash.disbursement', { accounts: { expense: '4401007', vat: '135000', wht: '2204001', fund: '1103001' }, amounts: { net_of_vat: 1785.71, vat: 214.29, net: 1980, wht: 20 }, vars: { remarks: 'Courier', fundCode: 'PCF-1' } },
        [['4401007', 1785.71, 0, 'Courier'], ['135000', 214.29, 0, 'Input VAT'], ['1103001', 0, 1980, 'Paid from PCF-1'], ['2204001', 0, 20, 'Expanded withholding tax']]],
      ['pettycash.receipt', { accounts: { fund: '1103001', credit: '1205001' }, amounts: { amount: 200 }, vars: { remarks: null } }, [['1103001', 200, 0, null], ['1205001', 0, 200, null]]],
      ['pettycash.replenishment', { accounts: { fund: '1103001' }, amounts: { amount: 5000 }, vars: { fundCode: 'PCF-1' } }, [['1103001', 5000, 0, 'Replenishment'], ['106010', 0, 5000, 'Cheque for PCF-1']]],
    ];
    for (const [event, context, expected] of cases) {
      const { lines } = await buildJournal(pool, event, { branchCode: null, ...context });
      expect(simple(lines), event).toEqual(expected);
    }
  });

  it('every event balances on its sample context, single insurer and co-insured', async () => {
    for (const code of Object.keys(EVENTS)) {
      for (const coInsurance of EVENTS[code].participants ? [false, true] : [false]) {
        const s = await ctx.api('post', '/posting-rules/simulate').send({ eventCode: code, coInsurance });
        expect(s.status, code).toBe(200);
        expect(s.body.data.balanced, `${code} ${coInsurance}`).toBe(true);
        expect(s.body.data.invalidAccounts, code).toEqual([]);
      }
    }
  });
});

describe('premium taxes and bank accounts', () => {
  it('splits VAT, DST and LGT into their own accounts when the bill carries them', async () => {
    const m = await makePolicy({ net: 10000 });
    await pay(m, 1000, { valueAddedTax: 1200, documentaryStampTax: 1250, localGovernmentTax: 75 });
    const [rcv] = await bookingOf(m.policy.id);
    expect(simple(await linesOf(rcv.booking_jv_id)).map((l) => l.slice(0, 3))).toEqual([
      ['1202001', 12525, 0], ['2201001', 0, 8500], ['2201002', 0, 1200], ['2201003', 0, 1250], ['2201004', 0, 75], ['3201001', 0, 1500]]);
  });

  it('debits the GL account of the chosen bank account', async () => {
    const m = await makePolicy({ net: 1000 });
    await query(`INSERT INTO master_records(type_code, code, name, data, status, created_by) VALUES ('bank-account', 'ACC-TRUST-T', 'Trust', '{"accountCode":"ACC-TRUST-T","glAccount":"1102003"}', 'active', 'test')`);
    await pay(m, 500, { bankAccountCode: 'ACC-TRUST-T' });
    const [rcv] = await bookingOf(m.policy.id);
    const app = (await query('SELECT journal_id FROM receipt_applications WHERE receivable_id = $1', [rcv.id])).rows[0];
    expect((await linesOf(app.journal_id))[0].account_code).toBe('1102003');
  });
});

describe('co-insurance', () => {
  let m; let ins; let rcv;
  const net = 7777.77; const taxes = { vat: 933.33, dst: 972.22, lgt: 58.33 };
  it('books one receivable at the gross and the premium and commission per insurer (3 insurers, rounding)', async () => {
    m = await makePolicy({ net });
    ins = await coInsure(m.policy);
    m.gross = r2(net + taxes.vat + taxes.dst + taxes.lgt);
    const r = await pay(m, m.gross, { valueAddedTax: taxes.vat, documentaryStampTax: taxes.dst, localGovernmentTax: taxes.lgt });
    expect(r.status).toBe(201);
    [rcv] = await bookingOf(m.policy.id);
    expect(rcv.entry_sub_type).toBe('CO_INSURANCE');
    const lines = await linesOf(rcv.booking_jv_id);
    const netS = allocate(net, [50, 30, 20]);
    const grossS = allocate(m.gross, [50, 30, 20]);
    const def = Number((await query('SELECT value FROM app_settings WHERE key = \'commission.default_rate\'')).rows[0]?.value ?? 0.15);
    const third = Number(ins[2].commission_rate) || def;
    const comm = [r2(netS[0] * 0.15), r2(netS[1] * 0.12), r2(Math.min(netS[2] * third, grossS[2]))];
    const commLines = lines.filter((l) => l.account_code === '3201001');
    expect(commLines.map((l) => [l.insurance_company_id, r2(l.credit)])).toEqual(ins.map((x, i) => [x.id, comm[i]]));
    expect(r2(Number(rcv.commission_amount))).toBe(r2(comm[0] + comm[1] + comm[2]));
    const dueLines = lines.filter((l) => l.account_code === '2201001');
    expect(dueLines).toHaveLength(3);
    for (const code of ['2201002', '2201003', '2201004']) expect(lines.filter((l) => l.account_code === code)).toHaveLength(3);
    for (const [i, x] of ins.entries()) {
      const mine = lines.filter((l) => l.insurance_company_id === x.id && l.credit > 0);
      expect(r2(mine.reduce((s, l) => s + l.credit, 0)), x.code).toBe(grossS[i]);
    }
    expect(Math.abs(r2(lines.reduce((s, l) => s + l.debit - l.credit, 0)))).toBe(0);
    expect(lines.filter((l) => l.debit > 0).map((l) => [l.account_code, r2(l.debit)])).toEqual([['1202001', m.gross]]);
    const e = await ctx.as('maker')('get', `/accounting/policies/${m.policy.id}/entries`);
    expect(e.body.isCoInsurance).toBe(true);
    expect(e.body.participants).toHaveLength(3);
    expect(e.body.data.some((x) => x.entrySubType === 'CO_INSURANCE' && x.insurerName)).toBe(true);
  });

  it('remits to each co-insurer its share of the premium less its own commission', async () => {
    const parts = (await query('SELECT * FROM receivable_participants WHERE receivable_id = $1', [rcv.id])).rows;
    let total = 0;
    for (const x of ins) {
      const v = await ctx.as('maker')('post', '/disbursements/insurer-remittance').send({ insuranceCompanyId: String(x.id), policyIds: [m.policy.id] });
      expect(v.status, x.code).toBe(201);
      const p = parts.find((y) => y.insurance_company_id === x.id);
      expect(Number(v.body.data.amount)).toBe(r2(Number(p.gross) - Number(p.commission)));
      total = r2(total + Number(v.body.data.amount));
      expect((await ctx.as('maker')('post', '/disbursements/insurer-remittance').send({ insuranceCompanyId: String(x.id), policyIds: [m.policy.id] })).status).toBe(409);
    }
    expect(total).toBe(r2(m.gross - Number(rcv.commission_amount)));
    expect((await query('SELECT count(*)::int AS n FROM remittance_allocations')).rows[0].n).toBe(3);
    // remittance statements: each co-insurer's line carries its share
    const eligible = await eligiblePolicies({ insurerId: ins[1].id, policyIds: [m.policy.id] });
    expect(eligible).toHaveLength(1);
    expect(Number(eligible[0].share_percent)).toBe(30);
  });

  it('collections and claims show the participants and their shares', async () => {
    const c = await ctx.as('maker')('get', `/collections/${rcv.id}`);
    expect(c.status).toBe(200);
    expect(c.body.data.isCoInsurancePolicy).toBe(true);
    const rows = c.body.data.coInsuranceCollectionRows;
    expect(rows).toHaveLength(4);
    expect(rows.at(-1)).toMatchObject({ isTotal: true, grossPremium: m.gross, paidAmount: m.gross, outstandingAmount: 0 });
    await setSetting('claims.settlement_maker_checker', false);
    const claim = (await query(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, estimate_amount, created_by) VALUES ('CLM-CO-1', $1, $2, 'in-review', current_date - 2, 50000, 'test') RETURNING id`,
      [m.policy.id, m.client.id])).rows[0];
    const s = await ctx.as('claims')('put', `/claims/settle/${claim.id}`).send({ settlementType: 'Paid through broker', settlementAmount: '33333.33', paidThroughBroker: true });
    expect(s.status).toBe(200);
    const got = await ctx.as('claims')('get', `/claims/${claim.id}`);
    const cl = got.body.data || got.body;
    expect(cl.isCoInsurance).toBe(true);
    expect(cl.participatingInsurersCount).toBe(3);
    const shares = allocate(33333.33, [50, 30, 20]);
    expect(cl.coInsuranceSettlementRows.filter((x) => !x.isTotal).map((x) => x.settlementAmount)).toEqual(shares);
    const jv = (await query('SELECT settlement_jv_id FROM claims WHERE id = $1', [claim.id])).rows[0].settlement_jv_id;
    const lines = await linesOf(jv);
    expect(lines.filter((l) => l.account_code === '1203005').map((l) => r2(l.debit))).toEqual(shares);
    expect(lines.find((l) => l.account_code === '2205003').credit).toBe(33333.33);
  });

  it('books direct-bill commission per co-insurer so each gets its own debit note', async () => {
    const d = await makePolicy({ net: 20000 });
    const dins = await coInsure(d.policy, [60, 25, 15], [0.1, 0.1, 0.1]);
    await query('UPDATE policies SET billing_mode = \'direct\' WHERE id = $1', [d.policy.id]);
    const item = await withTransaction((db) => bookDirectBill(db, { policy: d.policy, amount: d.gross, breakdown: { netPremium: 20000 }, user: { id: ctx.userIds.maker } }));
    expect(item.items.map((i) => i.insurance_company_id)).toEqual(dins.map((x) => x.id));
    expect(item.items.map((i) => Number(i.commission))).toEqual(allocate(20000, [60, 25, 15]).map((x) => r2(x * 0.1)));
    const unbilled = await ctx.as('maker')('get', `/remittance/direct-bill/policies?insurerCode=${dins[1].code}`);
    expect(unbilled.body.data.filter((x) => x.policyId === d.policy.id)).toHaveLength(1);
  });

  it('reports: Co-insurance Register and Due to Insurers by Co-insurer', async () => {
    const reg = await ctx.api('post', '/reports/coinsurance-register/run').send({ ReportCriteria: 'Overall', FromDate: '2020-01-01' });
    expect(reg.status).toBe(200);
    const mine = reg.body.data.rows.filter((x) => x.policyNumber === m.policy.policy_number);
    expect(mine.map((x) => Number(x.sharePercent)).sort((a, b) => b - a)).toEqual([50, 30, 20]);
    const due = await ctx.api('post', '/reports/due-to-insurers-by-coinsurer/run').send({ ReportCriteria: 'Co-insurer and Policy', FromDate: '2020-01-01' });
    expect(due.status).toBe(200);
    const rows = due.body.data.rows.filter((x) => x.policyNumber === m.policy.policy_number);
    expect(rows).toHaveLength(3);
    expect(rows.every((x) => Number(x.outstanding) === 0 && Number(x.remitted) > 0)).toBe(true);
  });
});

describe('return premium, cancellation and write-off', () => {
  it('return premium credits the open bill and makes the paid part a client refund payable', async () => {
    const m = await makePolicy({ net: 10000 });
    await pay(m, 5000, { valueAddedTax: 1200, documentaryStampTax: 1250, localGovernmentTax: 75 });
    const policy = await findPolicy(pool, m.policy.id);
    const out = await withTransaction((db) => returnPremium(db, { policy, amount: 10000, reference: 'END-T-1', user: { id: ctx.userIds.maker } }));
    expect(out).toMatchObject({ amount: 10000, credited: 7525, refund: 2475 });
    const [rcv] = await bookingOf(m.policy.id);
    expect(Number(rcv.balance)).toBe(0);
    expect(rcv.status).toBe('credited');
    const lines = await linesOf(out.journalId);
    const commission = r2(10000 * (1500 / 12525));
    const tax = (x) => r2(10000 * (x / 12525));
    expect(simple(lines).map((l) => l.slice(0, 3))).toEqual([
      ['2201001', r2(10000 - commission - tax(1200) - tax(1250) - tax(75)), 0], ['2201002', tax(1200), 0], ['2201003', tax(1250), 0], ['2201004', tax(75), 0],
      ['3201001', commission, 0], ['1202001', 0, 7525], ['210230', 0, 2475]]);
    const refund = (await query('SELECT * FROM invoice_lists WHERE policy_id = $1 AND payee_type = \'Customer\'', [m.policy.id])).rows[0];
    expect(Number(refund.total_amount)).toBe(2475);
    expect((await query('SELECT entry_type FROM journal_vouchers WHERE id = $1', [out.journalId])).rows[0].entry_type).toBe('ENDORSEMENT_NEGATIVE');
  });

  it('cancellation without a return amount reverses the open bill exactly as booked', async () => {
    const m = await makePolicy({ net: 10000 });
    await pay(m, 1, { valueAddedTax: 1200, documentaryStampTax: 1250, localGovernmentTax: 75 });
    const [rcv] = await bookingOf(m.policy.id);
    const policy = await findPolicy(pool, m.policy.id);
    const out = await withTransaction((db) => returnPremium(db, { policy, amount: 0, kind: 'cancellation', reference: 'CAN-1', user: { id: ctx.userIds.maker } }));
    expect(out).toMatchObject({ amount: 12524, credited: 12524, refund: 0 });
    const booked = await linesOf(rcv.booking_jv_id);
    const rev = await linesOf(out.journalId);
    // the credit reverses each booked insurer / tax / commission line pro rata (12524 of 12525)
    for (const code of ['2201001', '2201002', '2201003', '2201004', '3201001']) {
      const b = booked.find((l) => l.account_code === code).credit;
      expect(rev.find((l) => l.account_code === code).debit, code).toBeCloseTo(b * (12524 / 12525), 1);
    }
    expect((await query('SELECT entry_type FROM journal_vouchers WHERE id = $1', [out.journalId])).rows[0].entry_type).toBe('CANCELLATION');
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('write-off with a reason code posts to the reason account and closes the bill', async () => {
    const m = await makePolicy({ net: 1000 });
    await pay(m, r2(m.gross - 25));
    const debit = (await ctx.as('maker')('get', `/accounting/entries/unmatched?debitCredit=DEBIT&clientId=${m.client.id}&accountCode=1202001`)).body.data[0];
    const credit = (await ctx.as('maker')('get', `/accounting/entries/unmatched?debitCredit=CREDIT&clientId=${m.client.id}&accountCode=1202001`)).body.data[0];
    const reasons = (await ctx.as('maker')('get', '/accounting/write-off-reasons')).body.data;
    expect(reasons.map((x) => x.code)).toContain('SMALL_BALANCE');
    const tooMuch = await ctx.as('maker')('post', '/accounting/entries/match').send({ matchPairs: [{ debitTransactionId: debit.id, creditTransactionId: credit.id, matchedAmount: credit.amount, adjustmentAmount: 25, writeOffCode: 'NOPE' }] });
    expect(tooMuch.status).toBe(400);
    const mt = await ctx.as('maker')('post', '/accounting/entries/match').send({ matchPairs: [{ debitTransactionId: debit.id, creditTransactionId: credit.id, matchedAmount: credit.amount, adjustmentAmount: 25, writeOffCode: 'SMALL_BALANCE' }] });
    expect(mt.status).toBe(200);
    expect(mt.body.data[0].writeOff).toMatchObject({ amount: 25, reasonCode: 'SMALL_BALANCE', glAccount: '4409001', side: 'DEBIT' });
    expect(simple(await linesOf(mt.body.data[0].writeOff.journalId)).map((l) => l.slice(0, 3))).toEqual([['4409001', 25, 0], ['1202001', 0, 25]]);
    const [rcv] = await bookingOf(m.policy.id);
    expect(rcv.status).toBe('written-off');
    expect((await ctx.as('maker')('get', `/accounting/entries/unmatched?debitCredit=DEBIT&clientId=${m.client.id}&accountCode=1202001`)).body.data).toHaveLength(0);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('remittance adjustments, petty cash reversal and the ledger stay balanced', async () => {
    const a = await ctx.api('post', '/remittance/adjustments').send({ adjustmentType: 'Additional Charge', adjustmentAmount: 2500, effectiveDate: '2026-01-15', reason: 'Late payment charge' });
    expect(a.status).toBe(201);
    const item = (await query('SELECT journal_id FROM remittance_items WHERE id = $1', [a.body.data.id])).rows[0];
    expect(simple(await linesOf(item.journal_id)).map((l) => l.slice(0, 3))).toEqual([['4409002', 2500, 0], ['2201001', 0, 2500]]);
    const f = await ctx.as('maker')('post', '/petty-cash/funds').send({ code: 'PCF-REV', fundSize: 5000 });
    expect(f.status).toBe(201);
    expect(f.body.data.status).toBe('pending');
    expect((await ctx.as('maker')('post', '/petty-cash/funds/PCF-REV/approve').send({})).status).toBe(403);
    expect((await ctx.as('checker')('post', '/petty-cash/funds/PCF-REV/approve').send({})).status).toBe(200);
    const pr = await ctx.as('maker')('post', '/petty-cash/receipts').send({ pettyCashCode: 'PCF-REV', amount: 0.01 });
    expect(pr.status).toBe(409);
    const d = await ctx.as('maker')('post', '/petty-cash/disbursements').send({ pettyCashCode: 'PCF-REV', expenseAccount: '4401007', amount: 1000, vat: 107.14, wht: 10, remarks: 'Courier' });
    expect(d.status).toBe(201);
    const rev = await ctx.as('maker')('post', `/petty-cash/disbursements/${d.body.data.id}/reverse`).send({ reason: 'Entered twice' });
    expect(rev.status).toBe(200);
    expect(rev.body.data).toMatchObject({ status: 'reversed', availableCash: 5000 });
    expect((await ctx.as('maker')('post', `/petty-cash/disbursements/${d.body.data.id}/reverse`).send({})).status).toBe(409);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });
});

describe('Posting Rules and Account Determination screens', () => {
  it('lists events and rules, simulates, and validates new versions', async () => {
    const ev = await ctx.as('maker')('get', '/posting-rules/events');
    expect(ev.status).toBe(200);
    expect(ev.body.data.map((e) => e.eventCode)).toEqual(expect.arrayContaining(['policy.issue.broker_billed', 'receipt.apply', 'endorsement.return_premium', 'policy.cancel',
      'claim.settlement.paid_through_broker', 'write_off', 'remittance.transfer', 'incentive.accrual']));
    // premium bookings and returns are on version 2 (commission taxes, migration 0170)
    const taxed = ['policy.issue.broker_billed', 'endorsement.additional_premium', 'policy.renewal.broker_billed', 'endorsement.return_premium', 'policy.cancel'];
    expect(ev.body.data.every((e) => e.activeVersion === (taxed.includes(e.eventCode) ? 2 : 1))).toBe(true);
    const meta = await ctx.as('maker')('get', '/posting-rules/meta');
    expect(meta.body.data.roles.find((r) => r.role === 'premium_receivable').glCode).toBe('1202001');
    // finance reads, configuration writes
    const rule = (await ctx.as('maker')('get', '/posting-rules?eventCode=receipt.apply')).body.data[0];
    const lines = rule.lines.map(({ id: _id, lineNo: _n, ...l }) => l);
    expect((await ctx.as('maker')('post', '/posting-rules/events/receipt.apply/versions').send({ lines })).status).toBe(403);
    const unbalanced = await ctx.api('post', '/posting-rules/events/receipt.apply/versions').send({ lines: [lines[0], { ...lines[1], amountKey: 'amount', side: 'Dr' }] });
    expect(unbalanced.status).toBe(400);
    const badKey = await ctx.api('post', '/posting-rules/events/receipt.apply/versions').send({ lines: [lines[0], { ...lines[1], amountKey: 'gross' }] });
    expect(badKey.status).toBe(400);
    const sim = await ctx.api('post', '/posting-rules/simulate').send({ eventCode: 'receipt.apply', lines: [lines[0], { ...lines[1], narration: 'Paid {{billNumber}}' }] });
    expect(sim.body.data.lines[1].memo).toBe('Paid INV-SAMPLE');
    const v2 = await ctx.api('post', '/posting-rules/events/receipt.apply/versions').send({ lines: [lines[0], { ...lines[1], narration: 'Paid {{billNumber}}' }], changeNote: 'shorter memo' });
    expect(v2.status).toBe(201);
    expect(v2.body.data.version).toBe(2);
    const m = await makePolicy({ net: 1000 });
    await pay(m, 100);
    const [rcv] = await bookingOf(m.policy.id);
    const app = (await query('SELECT journal_id FROM receipt_applications WHERE receivable_id = $1', [rcv.id])).rows[0];
    expect((await linesOf(app.journal_id))[1].memo).toBe(`Paid ${rcv.bill_number}`);
    const hist = await ctx.as('maker')('get', `/posting-rules/${v2.body.data.id}/history`);
    expect(hist.body.data[0]).toMatchObject({ action: 'create-version', version: 2 });
    // version 1 can be deactivated now; version 2 (the only one left in force) cannot
    expect((await ctx.api('put', `/posting-rules/${rule.id}/status`).send({ active: false })).status).toBe(200);
    expect((await ctx.api('put', `/posting-rules/${v2.body.data.id}/status`).send({ active: false })).status).toBe(409);
  });

  it('Account Determination edits the role map posting uses', async () => {
    const a = await ctx.as('maker')('get', '/account-determination');
    expect(a.status).toBe(200);
    const premium = a.body.data.sections.find((s) => s.section === 'premium').roles.find((r) => r.role === 'premium_receivable');
    expect(premium).toMatchObject({ glCode: '1202001' });
    expect(premium.usedBy).toEqual(expect.arrayContaining(['policy.issue.broker_billed', 'receipt.apply']));
    expect((await ctx.api('put', '/account-determination/roles/premium_receivable').send({ glCode: '9999999' })).status).toBe(400);
    expect((await ctx.api('put', '/account-determination/roles/premium_receivable').send({ glCode: '1202002' })).status).toBe(200);
    const m = await makePolicy({ net: 1000 });
    await pay(m, 100);
    const [rcv] = await bookingOf(m.policy.id);
    expect((await linesOf(rcv.booking_jv_id))[0].account_code).toBe('1202002');
    await ctx.api('put', '/account-determination/roles/premium_receivable').send({ glCode: '1202001' });
    const w = await ctx.api('post', '/account-determination/write-off-reasons').send({ code: 'waived_fee', name: 'Fee waived', glAccount: '4409001', maxAmount: 500 });
    expect(w.status).toBe(201);
    expect(w.body.data.code).toBe('WAIVED_FEE');
    expect((await ctx.api('put', '/account-determination/write-off-reasons/WAIVED_FEE').send({ status: 'inactive' })).body.data.status).toBe('inactive');
    expect((await ctx.api('put', '/account-determination/maps/cash-by-payment-mode').send({ map: { cash: '1101001', check: '1102001' } })).status).toBe(200);
    expect(await policyParticipants('nope', pool)).toEqual([]);
  });
});
