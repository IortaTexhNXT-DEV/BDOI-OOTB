import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { createReceivable, findPolicy } from '../src/modules/receipts/receivables.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

const line = (policyNumber, gross, net, status = 'Pending') => ({ policies: policyNumber, netPremium: String(net), paid: status === 'Paid' ? String(gross) : '0.00', unPaid: status === 'Paid' ? '0.00' : String(gross),
  discounts: '0.00', dst: '0.00', lgt: '0.00', vat: '0.00', ewt: '0.00', fcAmount: '0.00', lcAmount: String(gross), other: '0.00', status });

describe('receipts', () => {
  it('lists seeded receipts with pagination', async () => {
    const r = await ctx.api('get', '/receipts?page=1&pageSize=5');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBe(5);
    expect(r.body.pagination.total).toBeGreaterThan(5);
    expect(r.body.data[0]).toHaveProperty('receiptsList');
  });

  it('pay-later draft receipt bills the policy, then approval (PUT) collects it and posts Dr Cash / Cr Premium Receivable', async () => {
    const { policy, client, gross, net } = await makePolicy({ net: 20000 });
    const draft = { receiptType: 'Payment', receiptDate: new Date().toISOString(), customerCode: client.client_code, currencyCode: 'PHP',
      transactionCode: 'PAYMENT', policyRefId: policy.id, receiptStatus: 'Draft', receiptsList: [line(policy.policy_number, gross, net)] };
    // official receipts are finance-only (D61): an agent records the payment on the policy payment screen instead
    expect((await ctx.as('agent')('post', '/receipts').send(draft)).status).toBe(403);
    const c = await ctx.as('maker')('post', '/receipts').send(draft);
    expect(c.status).toBe(201);
    expect(c.body.data.id).toBeTruthy();
    expect(c.body.data.receiptStatus).toBe('Draft');
    expect(c.body.data.name).toBe(client.display_name);
    const rcv = (await query('SELECT * FROM receivables WHERE policy_id = $1', [policy.id])).rows;
    expect(rcv).toHaveLength(1);
    expect(Number(rcv[0].balance)).toBe(gross);
    expect(rcv[0].booking_jv_id).toBeTruthy();

    const id = c.body.data.receiptId;
    const drafts = await ctx.as('maker')('get', `/receipts?receiptStatus=Draft&customerCode=${client.client_code}`);
    expect(drafts.body.data.map((x) => x.receiptId)).toContain(id);

    const u = await ctx.as('maker')('put', `/receipts/${id}`).send({ customerCode: client.client_code, receiptsList: [line(policy.policy_number, gross, net, 'Paid')] });
    expect(u.status).toBe(200);
    expect(u.body.data.receiptStatus).toBe('Converted');
    expect(u.body.data.receiptsList[0].status).toBe('Paid');
    const after = (await query('SELECT * FROM receivables WHERE policy_id = $1', [policy.id])).rows[0];
    expect(Number(after.balance)).toBe(0);
    expect(after.status).toBe('paid');
    const again = await ctx.as('maker')('put', `/receipts/${id}`).send({ receiptsList: [line(policy.policy_number, gross, net, 'Paid')] });
    expect(again.status).toBe(200);
    const apps = (await query('SELECT count(*)::int AS n FROM receipt_applications WHERE receipt_id = $1', [id])).rows[0].n;
    expect(apps).toBe(1);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });

    const byNumber = await ctx.api('get', `/receipts/${u.body.data.receiptNumber}`);
    expect(byNumber.body.data.receiptId).toBe(id);
  });

  it('official receipt against a receivable: partial then full payment, overpayment rejected', async () => {
    const { policy, gross } = await makePolicy({ net: 8000 });
    await query('INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date) VALUES ($1,$2,$3,$4,$4,current_date + 10)', [`INV-T-${policy.id}`, policy.id, policy.client_id, gross]);
    const rcv = (await query('SELECT id FROM receivables WHERE policy_id = $1', [policy.id])).rows[0];
    const half = Math.round(gross * 50) / 100;
    const p1 = await ctx.as('maker')('post', '/receipts').send({ receivableId: rcv.id, amount: half, paymentMode: 'gcash', referenceNo: 'GC-1' });
    expect(p1.status).toBe(201);
    expect(p1.body.data.receiptStatus).toBe('Converted');
    let r = (await query('SELECT balance, status FROM receivables WHERE id = $1', [rcv.id])).rows[0];
    expect(r.status).toBe('partial');
    expect((await ctx.as('maker')('post', '/receipts').send({ receivableId: rcv.id, amount: gross })).status).toBe(400);
    const p2 = await ctx.as('maker')('post', '/receipts').send({ receivableId: rcv.id, amount: Number(r.balance), paymentMode: 'check' });
    expect(p2.status).toBe(201);
    r = (await query('SELECT balance, status FROM receivables WHERE id = $1', [rcv.id])).rows[0];
    expect(r.status).toBe('paid');
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });

    const cancel = await ctx.as('maker')('post', `/receipts/${p2.body.data.receiptId}/cancel`).send({ reason: 'Cheque bounced' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.receiptStatus).toBe('Cancelled');
    r = (await query('SELECT balance, status FROM receivables WHERE id = $1', [rcv.id])).rows[0];
    expect(r.status).toBe('partial');
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('add-payment appends a paid line; search, print and bulk upload work', async () => {
    const { policy, client, gross, net } = await makePolicy({ net: 5000 });
    const c = await ctx.api('post', '/receipts').send({ customerCode: client.client_code, policyRefId: policy.id, receiptsList: [line(policy.policy_number, gross, net)] });
    const add = await ctx.as('maker')('post', `/receipts/${c.body.data.receiptId}/add-payment`).send({ amount: 1000, paymentMode: 'cash' });
    expect(add.status).toBe(200);
    expect(add.body.data.receiptsList).toHaveLength(2);
    expect(add.body.data.amount).toBe(1000);

    const s = await ctx.api('get', `/receipts/search?customerCode=${client.client_code}&page=1&pageSize=10`);
    expect(s.body.data.length).toBe(1);

    const pr = await ctx.api('get', `/receipts/printReceipt?receiptId=${c.body.data.receiptId}&customerCode=${client.client_code}`);
    expect(pr.status).toBe(200);
    expect(pr.body.data.url).toMatch(/\/api\/s3\/object\/print\/.+\.pdf\?exp=\d+&sig=/);
    // the signed link opens without a bearer header (new browser tab), as a PDF
    const pdf = await request(ctx.app).get(new URL(pr.body.data.url).pathname + new URL(pr.body.data.url).search);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    const none = await ctx.api('get', '/receipts/printReceipt?customerCodeFrom=ZZZ&customerCodeTo=ZZZ&createdAtFrom=2020-01-01&createdAtTo=2020-01-02');
    expect(none.status).toBe(404);
    expect(none.body.error.code).toBe('NO_DATA_FOUND');

    const other = await makePolicy({ net: 3000 });
    const csv = `policyNumber,amount,paymentMode,referenceNo\n${other.policy.policy_number},${other.gross},GCash,GC-77\nPOL-NOPE,100,cash,X\n`;
    const up = await ctx.as('maker')('post', '/receipts/bulk-upload').attach('file', Buffer.from(csv), 'receipts.csv');
    expect(up.status).toBe(200);
    expect(up.body.data.created).toBe(1);
    expect(up.body.data.failed).toBe(1);
    expect(up.body.data.errors[0].row).toBe(3);
  });

  it('add receipt against an open endorsement bill: open-receivables lists it, partial 2,000 then 3,010, excess refused, journals balanced', async () => {
    const { policy, client, gross } = await makePolicy({ net: 8000 });
    const pol = await findPolicy(pool, policy.id);
    const first = await createReceivable(pool, { policy: pol, amount: gross, source: 'policy' });
    const bill = await createReceivable(pool, { policy: pol, amount: 5010, breakdown: { netPremium: 4000 }, source: 'endorsement', reference: 'END-T' });

    const open = await ctx.as('maker')('get', `/receipts/open-receivables?customerCode=${client.client_code}`);
    expect(open.status).toBe(200);
    expect(open.body.data.map((x) => x.billNumber)).toEqual(expect.arrayContaining([first.bill_number, bill.bill_number]));
    const row = open.body.data.find((x) => x.billNumber === bill.bill_number);
    expect(row).toMatchObject({ receivableId: bill.id, customerCode: client.client_code, policyNumber: policy.policy_number, amount: 5010, balance: 5010, status: 'Open' });
    const all = await ctx.as('maker')('get', '/receipts/open-receivables');
    expect(all.body.data.some((x) => x.customerCode === client.client_code)).toBe(true);
    expect((await ctx.as('claims')('get', '/receipts/open-receivables')).status).toBe(403);

    const pay = (amount, extra = {}) => ctx.as('maker')('post', '/receipts').send({ receivableId: bill.id, amount, customerCode: client.client_code, policyRefId: policy.id,
      receiptType: 'Payment', transactionCode: 'OR', currencyCode: 'PHP', branchCode: 'HO', departmentCode: 'FIN', paymentMode: 'cash', ...extra });
    expect((await pay(0)).status).toBe(400);
    expect((await pay(-5)).status).toBe(400);
    expect((await pay(5010.01)).status).toBe(400);
    const other = await makePolicy({ net: 1000 });
    expect((await pay(100, { customerCode: other.client.client_code })).status).toBe(400);
    expect((await pay(100, { policyRefId: other.policy.id })).status).toBe(400);

    const p1 = await pay(2000);
    expect(p1.status).toBe(201);
    expect(p1.body.data.receiptNumber).toMatch(/^OR/);
    expect(p1.body.data.amount).toBe(2000);
    expect(p1.body.data.receivableId).toBe(bill.id);
    expect(p1.body.data.branchCode).toBe('HO');
    expect(p1.body.data.receiptsList[0]).toMatchObject({ paid: '2000.00', unPaid: '3010.00', lcAmount: '5010.00' });
    let r = (await query('SELECT balance, status FROM receivables WHERE id = $1', [bill.id])).rows[0];
    expect(r).toEqual({ balance: 3010, status: 'partial' });
    // the older policy bill is untouched: the payment went to the chosen bill only
    expect((await query('SELECT balance FROM receivables WHERE id = $1', [first.id])).rows[0].balance).toBe(gross);
    const jl = (await query(`SELECT l.account_code, l.debit, l.credit FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      WHERE j.reference_id = $1 ORDER BY l.line_no`, [p1.body.data.receiptId])).rows;
    expect(jl).toHaveLength(2);
    expect(jl.reduce((s, l) => s + Number(l.debit), 0)).toBe(2000);
    expect(jl.reduce((s, l) => s + Number(l.credit), 0)).toBe(2000);
    expect(jl.find((l) => Number(l.credit) > 0).account_code).toBe('1202001');
    const partial = await ctx.as('maker')('get', `/receipts/open-receivables?customerCode=${client.client_code}&policyNumber=${policy.policy_number}`);
    expect(partial.body.data.find((x) => x.billNumber === bill.bill_number)).toMatchObject({ balance: 3010, paidAmount: 2000, status: 'Partial' });

    const excess = await pay(4000);
    expect(excess.status).toBe(400);
    expect(excess.body.message || excess.body.error?.message).toMatch(/exceeds the outstanding balance/);
    expect((await query('SELECT balance FROM receivables WHERE id = $1', [bill.id])).rows[0].balance).toBe(3010);

    const p2 = await pay(3010);
    expect(p2.status).toBe(201);
    r = (await query('SELECT balance, status FROM receivables WHERE id = $1', [bill.id])).rows[0];
    expect(r).toEqual({ balance: 0, status: 'paid' });
    expect((await query('SELECT closed_at FROM collection_items WHERE receivable_id = $1', [bill.id])).rows[0].closed_at).toBeTruthy();
    expect((await pay(1)).status).toBe(409);
    const after = await ctx.as('maker')('get', `/receipts/open-receivables?customerCode=${client.client_code}`);
    expect(after.body.data.map((x) => x.billNumber)).toEqual([first.bill_number]);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });

    // cancelling the balance receipt re-opens the bill and its collection item
    expect((await ctx.as('maker')('post', `/receipts/${p2.body.data.receiptId}/cancel`).send({ reason: 'Cheque bounced' })).status).toBe(200);
    r = (await query('SELECT balance, status FROM receivables WHERE id = $1', [bill.id])).rows[0];
    expect(r).toEqual({ balance: 3010, status: 'partial' });
    expect((await query('SELECT closed_at FROM collection_items WHERE receivable_id = $1', [bill.id])).rows[0].closed_at).toBeNull();
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('billing statement PDF for a policy', async () => {
    const { policy } = await makePolicy();
    const r = await ctx.api('get', `/billing-statement/policy/${policy.id}/generate`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/pdf/);
    const prev = await ctx.api('get', `/billing-statement/endorsement/${policy.id}/preview`);
    expect(prev.body.data.policyNumber).toBe(policy.policy_number);
  });

  it('validates input and enforces permissions', async () => {
    expect((await ctx.api('post', '/receipts').send({ amount: 10 })).status).toBe(400);
    expect((await ctx.api('post', '/receipts').send({ paymentMode: 'barter', policyId: 'x', amount: 1 })).status).toBe(400);
    expect((await ctx.as('claims')('get', '/receipts')).status).toBe(403);
    expect((await ctx.as('agent')('put', '/receipts/x').send({})).status).toBe(403);
    expect((await ctx.api('get', '/receipts/or_missing')).status).toBe(404);
  });
});
