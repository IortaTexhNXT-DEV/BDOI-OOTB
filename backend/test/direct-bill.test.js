/**
 * Direct bill: the client pays the premium to the insurer; the broker books its commission receivable from the
 * insurer at issue and bills it with a commission debit note (maker-checker), then collects it net of the insurer's EWT.
 *
 * Worked example used below (PHP): net premium 100,000.00, gross premium 125,250.00, commission rate 15%
 *   commission 15,000.00 + output VAT 12% 1,800.00 = 16,800.00 due from the insurer
 *   insurer withholds EWT 10% of the commission 1,500.00 -> cash received 15,300.00
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { issuePolicy } from '../src/modules/policies/service.js';
import { bookDirectBill } from '../src/modules/remittance/directbill.js';
import { eligiblePolicies } from '../src/modules/remittance/service.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

const r2 = (n) => Math.round(n * 100) / 100;
const lines = async (jvId) => (await query('SELECT account_code AS a, debit::float AS d, credit::float AS c FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId])).rows;
const setting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };

let seq = 0;
/** Issue a policy through the real issuance routine (as convert-to-policy does). */
async function issue({ net = 100000, gross = 125250, rate = 0.15, insurer = 'MALAYAN', billingMode = 'direct' } = {}) {
  seq += 1;
  const client = (await query(`INSERT INTO clients(client_code, display_name, first_name, last_name, created_by) VALUES ($1,$2,'Direct','Bill','test') RETURNING *`,
    [`CL-DB-${Date.now().toString(36)}${seq}`, `Direct Bill Client ${seq}`])).rows[0];
  const ic = (await query('SELECT id FROM insurance_companies WHERE code = $1', [insurer])).rows[0];
  const product = (await query('SELECT id FROM products WHERE code = \'MOTOR\'')).rows[0];
  const r = await withTransaction((db) => issuePolicy(db, {
    clientId: client.id, insuranceCompanyId: ic.id, productId: product.id, sumInsured: 1000000, netPremium: net, grossPremium: gross, commissionAmount: r2(net * rate),
    commissionRate: rate, currency: 'PHP', insuredName: client.display_name, productType: 'Private Car Comprehensive', lob: 'MOTOR', agentUserId: ctx.userIds.sales, ownerUserId: ctx.userIds.sales,
  }, { billingMode }, ctx.userIds.maker));
  const policy = (await query('SELECT * FROM policies WHERE id = $1', [r.policyId])).rows[0];
  return { ...r, policy, client };
}

describe('direct-bill policy issue', () => {
  let d;
  it('books commission receivable / commission income / output VAT and no premium receivable or payable', async () => {
    d = await issue();
    expect(d.policy.billing_mode).toBe('direct');
    expect(d.policy.bill_number).toBeNull();
    expect((await query('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [d.policyId])).rows[0].n).toBe(0);
    expect((await query('SELECT count(*)::int AS n FROM collection_items WHERE policy_id = $1', [d.policyId])).rows[0].n).toBe(0);
    const item = (await query('SELECT * FROM direct_bill_items WHERE policy_id = $1', [d.policyId])).rows[0];
    expect(Number(item.commission)).toBe(15000);
    expect(Number(item.vat)).toBe(1800);
    expect(Number(item.amount)).toBe(16800);
    expect(item.status).toBe('unbilled');
    const jv = (await query('SELECT * FROM journal_vouchers WHERE id = $1', [item.booking_jv_id])).rows[0];
    expect(jv).toMatchObject({ entry_type: 'DIRECT_BILLED', status: 'posted', policy_id: d.policyId });
    expect(await lines(jv.id)).toEqual([{ a: '110400', d: 16800, c: 0 }, { a: '3201001', d: 0, c: 15000 }, { a: '235000', d: 0, c: 1800 }]);
    // nothing on premium receivable (1202001) or premium payable to the insurer (2201001) for this policy
    const premium = (await query(`SELECT count(*)::int AS n FROM journal_lines WHERE policy_id = $1 AND account_code IN ('1202001', '2201001')`, [d.policyId])).rows[0].n;
    expect(premium).toBe(0);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
    // the Account Executive's commission accrues as for a broker-billed policy
    expect((await query('SELECT status FROM commissions WHERE policy_id = $1', [d.policyId])).rows.map((x) => x.status)).toEqual(['Accrued']);
  });

  it('shows no premium to collect, refuses premium capture and is never remitted to the insurer', async () => {
    const p = await ctx.api('get', `/policies/${d.policyId}/payments`);
    expect(p.body.data).toMatchObject({ billingMode: 'direct', outstanding: 0, receivables: [], directBill: { commissionDue: 16800, unbilled: 16800 } });
    const pol = await ctx.api('get', `/policies/${d.policyId}`);
    expect(pol.body.data || pol.body).toMatchObject({ billingMode: 'direct', isDirectBilled: true });
    const cap = await ctx.api('post', `/policies/${d.policyId}/payments`).send({ option: 'payment', paymentMode: 'bank-transfer', referenceNo: 'X-1', amount: 100, paymentDate: '2026-01-05' });
    expect(cap.status).toBe(409);
    expect((await eligiblePolicies({ policyIds: [d.policyId] })).length).toBe(0);
    // receipts cannot bill premium on it either
    const pe = await ctx.as('maker')('post', '/accounting/payment-entries').send({ amount: 125250, clientId: d.client.id, referenceType: 'Policy', referenceId: d.policyId, policyId: d.policyId });
    expect(pe.status).toBe(201);
    expect(pe.body.data).toMatchObject({ directBilled: true, applied: 0, alreadyApplied: true });
    expect((await query('SELECT count(*)::int AS n FROM direct_bill_items WHERE policy_id = $1', [d.policyId])).rows[0].n).toBe(1);
  });

  it('dashboards count it as commission receivable from the insurer, not premium receivable from the client', async () => {
    const col = await ctx.api('get', '/collections/dashboard-stats');
    const before = col.body.data.totalOutstanding;
    const x = await issue({ net: 20000, gross: 25050 });
    expect((await ctx.api('get', '/collections/dashboard-stats')).body.data.totalOutstanding).toBe(before);
    const ex = await ctx.api('get', '/dashboard/executive');
    expect(ex.status).toBe(200);
    expect(ex.body.data.receivables.commissionFromInsurers).toBeGreaterThanOrEqual(16800 + 3360);
    const premiumFromDirect = (await query('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [x.policyId])).rows[0].n;
    expect(premiumFromDirect).toBe(0);
  });

  it('VAT follows the settings: inclusive commission, broker not VAT-registered', async () => {
    await setting('direct_bill.commission_vat_inclusive', true);
    const inc = await issue({ net: 10000, gross: 12525 });
    const i1 = (await query('SELECT * FROM direct_bill_items WHERE policy_id = $1', [inc.policyId])).rows[0];
    expect([Number(i1.commission), Number(i1.vat), Number(i1.amount)]).toEqual([1339.29, 160.71, 1500]);
    await setting('direct_bill.commission_vat_inclusive', false);
    await setting('direct_bill.broker_vat_registered', false);
    const nv = await issue({ net: 10000, gross: 12525 });
    const i2 = (await query('SELECT * FROM direct_bill_items WHERE policy_id = $1', [nv.policyId])).rows[0];
    expect([Number(i2.commission), Number(i2.vat), Number(i2.amount)]).toEqual([1500, 0, 1500]);
    expect((await lines(i2.booking_jv_id)).map((l) => l.a)).toEqual(['110400', '3201001']);
    await setting('direct_bill.broker_vat_registered', true);
    // these two stay out of the debit-note tests below
    await query('UPDATE direct_bill_items SET status = \'cancelled\' WHERE policy_id = ANY($1)', [[inc.policyId, nv.policyId]]);
  });

  it('a return premium on a direct-bill policy returns the commission (reverse booking)', async () => {
    const x = await issue({ net: 20000, gross: 25050, insurer: 'PIONEER' });
    const it = await withTransaction((db) => bookDirectBill(db, { policy: { id: x.policyId }, amount: -2505, breakdown: { netPremium: -2000, commissionAmount: -300 }, source: 'endorsement', reference: 'END-TEST-1', user: { id: ctx.userIds.maker } }));
    expect([Number(it.commission), Number(it.vat), Number(it.amount)]).toEqual([-300, -36, -336]);
    expect(await lines(it.booking_jv_id)).toEqual([{ a: '3201001', d: 300, c: 0 }, { a: '235000', d: 36, c: 0 }, { a: '110400', d: 0, c: 336 }]);
    await query('UPDATE direct_bill_items SET status = \'cancelled\' WHERE policy_id = $1', [x.policyId]);
  });
});

describe('commission debit note', () => {
  let d;
  let dn;
  it('lists unbilled commission insurer-wise with product, commission, VAT, total due and EWT', async () => {
    d = await issue({ insurer: 'FPG' });
    const r = await ctx.as('maker')('get', '/remittance/direct-bill/policies?insurerCode=FPG');
    expect(r.status).toBe(200);
    const row = r.body.data.find((x) => x.policyId === d.policyId);
    expect(row).toMatchObject({ policyNo: d.policy.policy_number, reference: 'New business', insuredName: d.client.display_name, product: 'Private Car Comprehensive', lineOfBusiness: 'MOTOR', insurerCode: 'FPG',
      grossPremium: 125250, commissionRate: 15, commission: 15000, vat: 1800, totalDue: 16800, expectedEwt: 1500, netReceivable: 15300 });
    expect(r.body.summary.ewtRate).toBe(0.1);
    expect((await ctx.as('agent')('get', '/remittance/direct-bill/policies')).status).toBe(403);
  });

  it('raise, maker-checker, reject (items released) and approve without a second posting', async () => {
    const item = (await ctx.as('maker')('get', `/remittance/direct-bill/policies?insurerCode=FPG&search=${d.policy.policy_number}`)).body.data[0];
    const raised = await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'FPG', itemIds: [item.id], periodFrom: '2026-01-01', periodTo: '2026-12-31', submit: true });
    expect(raised.status).toBe(201);
    expect(raised.body.data.dnNumber).toMatch(/^DN-\d{4}-\d{5}$/);
    expect(raised.body.data).toMatchObject({ statusCode: 'for-approval', status: 'Pending Approval', insurerCode: 'FPG', policyCount: 1, commission: 15000, vat: 1800, amount: 16800,
      ewtRate: 0.1, expectedEwt: 1500, netPayable: 15300, balance: 16800 });
    expect(raised.body.data.lines[0]).toMatchObject({ policyNo: d.policy.policy_number, product: 'Private Car Comprehensive', commissionRate: 15, amount: 16800 });
    // the item is billed: not offered again, and cannot be put on a second note
    expect((await ctx.as('maker')('get', '/remittance/direct-bill/policies?insurerCode=FPG')).body.data.some((x) => x.id === item.id)).toBe(false);
    expect((await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'FPG', itemIds: [item.id] })).status).toBe(400);
    // maker-checker
    expect((await ctx.as('maker')('post', `/remittance/direct-bill/${raised.body.data.id}/approve`).send({})).status).toBe(403);
    expect((await ctx.as('checker')('post', `/remittance/direct-bill/${raised.body.data.id}/reject`).send({})).status).toBe(400);
    const rej = await ctx.as('checker')('post', `/remittance/direct-bill/${raised.body.data.id}/reject`).send({ reason: 'Wrong period' });
    expect(rej.body.data).toMatchObject({ statusCode: 'rejected', rejectionReason: 'Wrong period' });
    expect((await ctx.as('maker')('get', '/remittance/direct-bill/policies?insurerCode=FPG')).body.data.some((x) => x.id === item.id)).toBe(true);
    // raise again as a draft, submit, approve
    const again = await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'FPG', itemIds: [item.id], dnDate: '2026-02-01' });
    expect(again.body.data).toMatchObject({ statusCode: 'draft', dnDate: '2026-02-01', dueDate: '2026-03-03' });
    expect((await ctx.as('checker')('post', `/remittance/direct-bill/${again.body.data.id}/approve`).send({})).status).toBe(409);
    expect((await ctx.as('maker')('post', `/remittance/direct-bill/${again.body.data.id}/submit`)).body.data.statusCode).toBe('for-approval');
    const journals = (await query('SELECT count(*)::int AS n FROM journal_vouchers')).rows[0].n;
    const ap = await ctx.as('checker')('post', `/remittance/direct-bill/${again.body.data.id}/approve`).send({ remarks: 'Checked' });
    expect(ap.status).toBe(200);
    expect(ap.body.data).toMatchObject({ statusCode: 'open', status: 'Open' });
    expect((await query('SELECT count(*)::int AS n FROM journal_vouchers')).rows[0].n).toBe(journals);
    dn = ap.body.data;
    const list = await ctx.as('maker')('get', '/remittance/direct-bill?status=Open&insurerCode=FPG');
    expect(list.body.data.map((x) => x.dnNumber)).toContain(dn.dnNumber);
    expect(list.body.summary.outstanding).toBeGreaterThanOrEqual(16800);
  });

  it('prints and sends the debit note', async () => {
    const pdf = await ctx.as('maker')('get', `/remittance/direct-bill/${dn.id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    expect(pdf.body.toString('latin1', 0, 5)).toBe('%PDF-');
    const sent = await ctx.as('maker')('post', `/remittance/direct-bill/${dn.id}/send`).send({});
    expect(sent.body.data).toMatchObject({ emailedTo: 'uw@fpg.example' });
  });

  it('partial and full collection from the insurer with creditable withholding tax', async () => {
    // insurer pays half: cash 7,650.00 -> EWT 750.00 withheld (pro rata), 8,400.00 applied
    const c1 = await ctx.as('maker')('post', `/remittance/direct-bill/${dn.id}/collections`).send({ receivedDate: '2026-02-10', cashAmount: 7650, paymentMode: 'bank-transfer', referenceNo: 'FPG-PAY-1' });
    expect(c1.status).toBe(201);
    expect(c1.body.data).toMatchObject({ statusCode: 'partial', status: 'Partially Collected', collectedCash: 7650, collectedEwt: 750, balance: 8400 });
    expect(c1.body.data.collection.collectionNumber).toMatch(/^DNC-\d{4}-\d{5}$/);
    expect(await lines(c1.body.data.collection.journalId)).toEqual([{ a: '106010', d: 7650, c: 0 }, { a: '1302001', d: 750, c: 0 }, { a: '110400', d: 0, c: 8400 }]);
    // TISPH parks the collection journal (accounting.parked_events): a user other than the one who recorded it posts it
    const post = async (jvId) => {
      expect((await query('SELECT status FROM journal_vouchers WHERE id = $1', [jvId])).rows[0].status).toBe('for-approval');
      expect((await ctx.as('maker')('post', `/journal-vouchers/${jvId}/approve`)).status).toBe(403);
      expect((await ctx.as('checker')('post', `/journal-vouchers/${jvId}/approve`)).body.data.status).toBe('posted');
    };
    await post(c1.body.data.collection.journalId);
    // cannot collect more than the balance
    expect((await ctx.as('maker')('post', `/remittance/direct-bill/${dn.id}/collections`).send({ cashAmount: 9000, ewtAmount: 0 })).status).toBe(400);
    // the Account Executive's commission waits for the insurer's payment
    expect((await query('SELECT status FROM commissions WHERE policy_id = $1', [d.policyId])).rows[0].status).toBe('Accrued');
    // the rest, with the EWT as certified on BIR 2307
    const c2 = await ctx.as('maker')('post', `/remittance/direct-bill/${dn.id}/collections`).send({ receivedDate: '2026-02-20', cashAmount: 7650, ewtAmount: 750, paymentMode: 'check', referenceNo: 'FPG-PAY-2', form2307No: '2307-001' });
    expect(c2.body.data).toMatchObject({ statusCode: 'collected', status: 'Collected', collectedCash: 15300, collectedEwt: 1500, balance: 0 });
    expect(c2.body.data.collections).toHaveLength(2);
    await post(c2.body.data.collection.journalId);
    expect((await query('SELECT status FROM direct_bill_items WHERE policy_id = $1', [d.policyId])).rows[0].status).toBe('collected');
    expect((await query('SELECT status FROM commissions WHERE policy_id = $1', [d.policyId])).rows[0].status).toBe('Eligible');
    // commission receivable of the policy is cleared: 16,800 booked, 8,400 + 8,400 collected
    const bal = (await query(`SELECT COALESCE(sum(l.debit - l.credit), 0)::float AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      WHERE l.account_code = '110400' AND (j.policy_id = $1 OR (j.reference_type = 'CommissionDebitNote' AND j.reference_id = $2))`, [d.policyId, dn.id])).rows[0].b;
    expect(bal).toBe(0);
    expect((await ctx.as('maker')('post', `/remittance/direct-bill/${dn.id}/collections`).send({ cashAmount: 1 })).status).toBe(409);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('a collection entered in error is reversed and the note reopens', async () => {
    const col = (await ctx.as('maker')('get', `/remittance/direct-bill/${dn.id}`)).body.data.collections[1];
    const r = await ctx.as('maker')('post', `/remittance/direct-bill/${dn.id}/collections/${col.id}/reverse`).send({ reason: 'Cheque bounced' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ statusCode: 'partial', balance: 8400, collectedCash: 7650, collectedEwt: 750 });
    expect((await query('SELECT status FROM direct_bill_items WHERE policy_id = $1', [d.policyId])).rows[0].status).toBe('billed');
    expect((await ctx.as('maker')('post', `/remittance/direct-bill/${dn.id}/cancel`).send({ reason: 'x' })).status).toBe(409);
  });

  it('commission receivable report and trial balance show it as due from the insurer', async () => {
    const rep = await ctx.api('post', '/reports/direct-bill-commission/run').send({ ReportCriteria: 'Outstanding', FromDate: '2020-01-01', ToDate: '2030-12-31', perPage: 500 });
    expect(rep.status).toBe(200);
    const row = rep.body.data.rows.find((x) => x.policyNumber === d.policy.policy_number);
    expect(row).toMatchObject({ insurer: 'FPG Insurance Co., Inc.', debitNoteNo: dn.dnNumber, totalDue: 16800, balance: 8400, status: 'Partially collected' });
    const tb = await ctx.as('maker')('get', '/accounting/trial-balance');
    expect(tb.body.data.totals.balanced).toBe(true);
    const acct = tb.body.data.rows.find((x) => x.accountCode === '110400');
    expect(acct).toMatchObject({ accountType: 'asset', fsGroup: 'Current Assets', accountName: 'Receivable from Insurance Company' });
    expect(tb.body.data.rows.find((x) => x.accountCode === '1302001').debit).toBeGreaterThanOrEqual(750);
    const prod = await ctx.api('post', '/reports/production-register/run').send({ ReportCriteria: 'Billing Mode', FromDate: '2020-01-01', ToDate: '2030-12-31', perPage: 500 });
    expect(prod.body.data.rows.find((x) => x.policyNumber === d.policy.policy_number).billingMode).toBe('Direct bill');
  });
});

describe('billing mode change', () => {
  it('a broker-billed policy with nothing collected becomes direct bill and back', async () => {
    const b = await issue({ billingMode: 'broker', insurer: 'STANDARD' });
    expect(b.policy.billing_mode).toBe('broker');
    expect(b.receivable.bill_number).toMatch(/^INV-/);
    const toDirect = await ctx.as('maker')('post', '/remittance/direct-bill/billing-mode').send({ policyNumber: b.policy.policy_number, billingMode: 'direct', reason: 'Client pays Standard directly' });
    expect(toDirect.status).toBe(200);
    expect(toDirect.body.data).toMatchObject({ billingMode: 'direct', billNumber: null, directBill: { commissionDue: 16800 } });
    expect((await query('SELECT status, balance::float AS b FROM receivables WHERE policy_id = $1', [b.policyId])).rows).toEqual([{ status: 'cancelled', b: 0 }]);
    const prem = (await query(`SELECT COALESCE(sum(l.debit - l.credit), 0)::float AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE j.policy_id = $1 AND l.account_code = '1202001'`, [b.policyId])).rows[0].b;
    expect(prem).toBe(0);
    const back = await ctx.as('maker')('post', '/remittance/direct-bill/billing-mode').send({ policyNumber: b.policy.policy_number, billingMode: 'broker' });
    expect(back.body.data.billNumber).toMatch(/^INV-/);
    expect((await query('SELECT count(*)::int AS n FROM direct_bill_items WHERE policy_id = $1 AND status <> \'cancelled\'', [b.policyId])).rows[0].n).toBe(0);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('refuses the change once premium was collected or the commission is on a debit note', async () => {
    const b = await issue({ billingMode: 'broker', insurer: 'STANDARD', net: 1000, gross: 1252.5 });
    const pay = await ctx.as('maker')('post', `/policies/${b.policyId}/payments`).send({ option: 'payment', paymentMode: 'bank-transfer', referenceNo: 'BDO-1', amount: 500, paymentDate: '2026-01-05' });
    expect(pay.status).toBe(201);
    expect((await ctx.as('maker')('post', '/remittance/direct-bill/billing-mode').send({ policyNumber: b.policy.policy_number, billingMode: 'direct' })).status).toBe(409);
    const dnPol = (await query('SELECT policy_id FROM direct_bill_items WHERE debit_note_id IS NOT NULL LIMIT 1')).rows[0];
    expect((await ctx.as('maker')('post', '/remittance/direct-bill/billing-mode').send({ policyId: dnPol.policy_id, billingMode: 'broker' })).status).toBe(409);
    expect((await ctx.as('maker')('post', '/remittance/direct-bill/billing-mode').send({ policyId: dnPol.policy_id, billingMode: 'sideways' })).status).toBe(400);
  });

  it('default billing mode comes from the settings', async () => {
    await setting('direct_bill.default_billing_mode', 'direct');
    const x = await issue({ billingMode: null, net: 1000, gross: 1252.5 });
    expect(x.policy.billing_mode).toBe('direct');
    await setting('direct_bill.default_billing_mode', 'broker');
    const y = await issue({ billingMode: null, net: 1000, gross: 1252.5 });
    expect(y.policy.billing_mode).toBe('broker');
  });
});
