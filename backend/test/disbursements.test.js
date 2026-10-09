import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { withoutCommissionTaxes } from './helpers.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); await withoutCommissionTaxes(); });
afterAll(async () => { await pool.end(); });

describe('disbursements / payment vouchers', () => {
  let d; let inv; let client;
  it('lists seeded vouchers with filters', async () => {
    const r = await ctx.as('maker')('get', '/disbursements?page=1&pageSize=5');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBe(5);
    expect(r.body.data[0]).toHaveProperty('disbursementId');
    const v = r.body.data[0].voucherNumber;
    const f = await ctx.as('maker')('get', `/disbursements?voucherNumber=${v}`);
    expect(f.body.data[0].voucherNumber).toBe(v);
  });

  it('creates a voucher, records a payable (invoice list) and reads them back', async () => {
    const m = await makePolicy({ net: 30000 });
    client = m.client;
    const c = await ctx.as('maker')('post', '/disbursements').send({ voucherDate: new Date().toISOString().slice(0, 10), departmentCode: 'FI', branchCode: 'PHP', payeeType: 'Customer',
      criteria: 'Specific', customerCode: client.client_code, policyNumber: m.policy.policy_number, transactionCode: 'REFUND', transactionDescription: 'Cancellation refund', instrumentCurrency: 'PHP', amount: '0.00' });
    expect(c.status).toBe(201);
    d = c.body.data;
    expect(d.voucherNumber).toMatch(/^PV-/);
    expect(d.payeeName).toBe(client.display_name);
    const il = await ctx.as('sales')('post', '/disbursements/invoice-list').send({ customerCode: client.client_code, payables: '5000.00', outstanding: '0.00', fcAmount: '0.00', lcAmount: '5000.00',
      excess: '0.00', balAmount: '0.00', vat: '0.00', wht: '0.00', totalAmount: '5000.00', bankCode: 'BDO', bankAmount: '5000.00', isInvoicePaid: true, payeeType: 'Customer' });
    expect(il.status).toBe(201);
    inv = il.body.data;
    const byCustomer = await ctx.as('maker')('get', `/disbursements/invoice-list?page=1&pageSize=10&customerCode=${client.client_code}`);
    expect(byCustomer.body.data.map((x) => x.invoiceListId)).toContain(inv.invoiceListId);
    const detail = await ctx.as('maker')('get', `/disbursements/${d.disbursementId}`);
    expect(detail.body.data.invoiceList.map((x) => x.invoiceListId)).toContain(inv.invoiceListId);
    const u = await ctx.as('maker')('put', `/disbursements/${d.disbursementId}`).send({ amount: '5000.00', remarks: 'Refund per endorsement' });
    expect(u.body.data.amount).toBe(5000);
  });

  it('cheque: maker cannot approve own cheque; checker approval posts Dr Refund Payable / Cr Cash; printing pays the voucher', async () => {
    const cb = await ctx.as('maker')('post', '/disbursements/checkbook').send({ customerCode: client.client_code, customerName: client.display_name, mainAccount: '1102001', instrumentBookId: 'BDO-CB-01',
      instrumentNo: '000777', instrumentDate: new Date().toISOString().slice(0, 10), totaleAmount: '5000', status: 'Pending', invoiceListRefId: inv.invoiceListId, disbursementId: d.disbursementId });
    expect(cb.status).toBe(201);
    const id = cb.body.data.checkbookId;
    expect((await ctx.as('maker')('put', `/disbursements/checkbook/${id}`).send({ status: 'Approved', totaleAmount: '5000' })).status).toBe(403);
    expect((await ctx.as('checker')('put', `/disbursements/checkbook/${id}`).send({ status: 'Printed' })).status).toBe(409);
    const ap = await ctx.as('checker')('put', `/disbursements/checkbook/${id}`).send({ status: 'Approved', totaleAmount: '5000' });
    expect(ap.status).toBe(200);
    expect(ap.body.data.journalId).toBeTruthy();
    const lines = (await query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [ap.body.data.journalId])).rows;
    expect(lines.map((l) => l.account_code)).toEqual(['210230', '1102001']);
    const pr = await ctx.as('checker')('put', `/disbursements/checkbook/${id}`).send({ status: 'Printed' });
    expect(pr.body.data.status).toBe('Printed');
    const v = await ctx.as('maker')('get', `/disbursements/${d.disbursementId}`);
    expect(v.body.data.status).toBe('paid');
    const il = await ctx.as('maker')('get', `/disbursements/invoice-list/${inv.invoiceListId}`);
    expect(il.body.data.status).toBe('paid');
    expect(il.body.data.checkbooks[0].status).toBe('Printed');
    expect((await ctx.as('maker')('put', `/disbursements/${d.disbursementId}`).send({ amount: 1 })).status).toBe(409);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });

  it('insurer remittance voucher from collected premium (net of commission)', async () => {
    const m = await makePolicy({ net: 40000, insurer: 'PIONEER' });
    await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: m.gross });
    const r = await ctx.as('maker')('post', '/disbursements/insurer-remittance').send({ insurerName: 'PIONEER' });
    expect(r.status).toBe(201);
    const row = r.body.data.invoiceList.find((x) => x.policyNumber === m.policy.policy_number);
    const rcv = (await query('SELECT commission_amount FROM receivables WHERE policy_id = $1', [m.policy.id])).rows[0];
    expect(row.totalAmount).toBe(Math.round((m.gross - Number(rcv.commission_amount)) * 100) / 100);
    expect((await ctx.as('maker')('post', '/disbursements/insurer-remittance').send({ insurerName: 'PIONEER' })).status).toBe(409);
  });

  it('print and bulk upload', async () => {
    const p = await ctx.as('maker')('get', `/disbursements/printDisbursement?customerCodeFrom=${client.client_code}&customerCodeTo=${client.client_code}&createdAtFrom=2020-01-01&createdAtTo=2099-12-31`);
    expect(p.status).toBe(200);
    expect(p.body.data.url).toContain('/api/s3/object/print/');
    const none = await ctx.as('maker')('get', '/disbursements/printDisbursement?customerCodeFrom=ZZZ&customerCodeTo=ZZZ&createdAtFrom=2020-01-01&createdAtTo=2020-01-02');
    expect(none.status).toBe(404);
    const csv = 'Voucher Date,Payee Type,Customer Code,Insurer Name,Amount,Transaction Code,Remarks\n2026-09-01,Supplier,,,"1,250.00",SUPP,Office rent\n2026-09-01,Martian,,,10,X,bad\n';
    const up = await ctx.as('maker')('post', '/disbursements/bulk-upload').attach('file', Buffer.from(csv), 'vouchers.csv');
    expect(up.status).toBe(200);
    expect(up.body.data.created).toBe(1);
    expect(up.body.data.errors[0].row).toBe(3);
    const created = await ctx.as('maker')('get', `/disbursements/${up.body.data.ids[0]}`);
    expect(created.body.data.amount).toBe(1250);
  });

  it('validation and permissions', async () => {
    expect((await ctx.as('maker')('post', '/disbursements').send({ payeeType: 'Martian' })).status).toBe(400);
    expect((await ctx.as('maker')('post', '/disbursements/checkbook').send({ totaleAmount: 0 })).status).toBe(400);
    expect((await ctx.as('sales')('get', '/disbursements')).status).toBe(403);
    expect((await ctx.as('claims')('post', '/disbursements').send({ payeeType: 'Supplier' })).status).toBe(403);
    expect((await ctx.as('maker')('get', '/disbursements/pv_missing')).status).toBe(404);
  });
});
