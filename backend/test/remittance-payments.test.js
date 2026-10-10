/**
 * Accounts > Remittance > Insurer payments: the read model of the insurer vouchers (state from the voucher, its batch
 * line and its cheque; draft vouchers To pay), the payment record and its sections, the audited reveal of the account
 * number, the batching state (no Metrobank layout: no batch, cheque still possible), the legacy transfers (read-only,
 * journal and reversal) and the transfer gate of TISPH (seed 90: remittance.transfers_enabled off).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { paymentExport, EXPORT_HEADER } from '../src/modules/remittance/payments.js';

let ctx;
let insurerId;
const people = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(key, username, displayName, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  const call = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  call.id = r.body.data.userId;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  call.user = { id: call.id, username, roles: claims.roles || roles, permissions: claims.permissions || [] };
  people[key] = call;
  return call;
}

let n = 0;
/** A settled remittance of the test insurer and the voucher its settlement raised (status `status`), made by `maker`. */
async function voucher(amount, status = 'for-approval', maker = 'cruz') {
  n += 1;
  const [rem] = await q(`INSERT INTO remittances(remittance_number, insurance_company_id, kind, status, gross_premium, commission, net_due, policy_count, created_by)
    VALUES ($1, $2, 'direct-bill', 'settled', $3, 0, $3, 1, $4) RETURNING id, remittance_number`, [`REM-PYT-${n}`, insurerId, amount, people[maker].id]);
  const [d] = await q(`INSERT INTO disbursements(voucher_number, payee_type, payee_name, amount, status, source, insurance_company_id, insurer_name, created_by, voucher_date, paid_at)
    VALUES ($1, 'Insurer', 'Payments Test Insurance Corp.', $2, $3, 'insurer-remittance', $4, 'Payments Test Insurance Corp.', $5, CURRENT_DATE, CASE WHEN $3 = 'paid' THEN now() END)
    RETURNING id, voucher_number`, [`PV-PYT-${n}`, amount, status, insurerId, people[maker].id]);
  await q(`INSERT INTO remittance_items(kind, reference_no, insurance_company_id, amount, status, data) VALUES ('settlement', $1, $2, $3, 'Approved', $4)`,
    [`SET-PYT-${n}`, insurerId, amount, JSON.stringify({ remittanceIds: [rem.id], disbursementId: d.id, voucherNumber: d.voucher_number })]);
  return { remittanceId: rem.id, remittanceNo: rem.remittance_number, id: d.id, voucherNo: d.voucher_number, amount };
}
const list = async (who, qs) => {
  const r = await people[who]('get', `/remittance/payments?insurerId=${insurerId}&${qs}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
const rowOf = (body, v) => body.data.find((x) => x.id === v.id);

beforeAll(async () => {
  ctx = await setup();
  [{ id: insurerId }] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ('PYTEST', 'Payments Test Insurance Corp.', 'Payments Test', 'active') RETURNING id");
  await q(`INSERT INTO payee_bank_accounts(payee_type, payee_id, payee_name, bank_code, account_number, account_name, account_type)
    VALUES ('Insurer', $1, 'Payments Test Insurance Corp.', 'MBT', '0071-5566-4821', 'Payments Test Insurance Corp.', 'current')`, [String(insurerId)]);
  await persona('maker', 'pyt.maker', 'M. Reyes', ['tis-finance']);
  await persona('checker', 'pyt.checker', 'A. Tan', ['tis-finance']);
  await persona('cruz', 'pyt.cruz', 'J. Cruz', ['tis-finance']);
  await persona('gm', 'pyt.gm', 'G. Manager', ['tis-general-manager']);
});
afterAll(async () => { await pool.end(); });

describe('payment states, next step and the batching state', () => {
  const v = {};
  beforeAll(async () => {
    v.draft = await voucher(1000, 'draft');
    v.ready = await voucher(2000);
    v.batched = await voucher(3000);
    v.failed = await voucher(4000);
    v.paid = await voucher(5000, 'paid');
    v.cheque = await voucher(6000);
    const b = await people.maker('post', '/bank-payments/batches').send({ layoutCode: 'MBT-BULK', bankAccountCode: 'ACC-MBT-001', channel: 'bulk_credit', disbursementIds: [v.batched.id, v.failed.id] });
    expect(b.status, JSON.stringify(b.body)).toBe(201);
    v.batch = b.body.data;
    // the bank rejected one line of an earlier batch (its result recorded)
    const f = await people.maker('post', '/bank-payments/batches').send({ layoutCode: 'MBT-BULK', bankAccountCode: 'ACC-MBT-001', channel: 'bulk_credit', disbursementIds: [v.cheque.id] });
    expect(f.status).toBe(201);
    await q("UPDATE bank_payment_batch_lines SET status = 'rejected', reason = 'Account closed', result_at = now() WHERE batch_id = $1", [f.body.data.id]);
    await q("UPDATE bank_payment_batches SET status = 'completed', rejected_count = 1, created_at = now() - interval '1 day' WHERE id = $1", [f.body.data.id]);
    await q("UPDATE bank_payment_batch_lines SET status = 'rejected', reason = 'Beneficiary account closed', result_at = now() WHERE disbursement_id = $1", [v.failed.id]);
    await q("INSERT INTO checkbooks(disbursement_id, customer_name, instrument_no, instrument_date, totale_amount, status) VALUES ($1, 'Payments Test Insurance Corp.', 'CHK-PYT-1', CURRENT_DATE, 6000, 'Pending')", [v.cheque.id]);
  });

  it('a draft voucher is To pay with the next step to submit it in Disbursement, and cannot be batched yet', async () => {
    const row = rowOf(await list('maker', 'segment=to-pay'), v.draft);
    expect(row).toMatchObject({ state: 'to-pay', stateLabel: 'To pay', voucherStatus: 'draft', selectable: false,
      nextStep: { code: 'submit-voucher', label: 'Submit voucher (Disbursement)' } });
    expect(row.remittance).toMatchObject({ id: v.draft.remittanceId, remittanceNo: v.draft.remittanceNo });
  });

  it('a submitted voucher with an account on file can be batched; the account is masked', async () => {
    const body = await list('maker', 'segment=to-pay');
    const row = rowOf(body, v.ready);
    expect(row).toMatchObject({ state: 'to-pay', selectable: true, nextStep: { code: 'create-batch', label: 'Create batch' },
      payee: { accountMasked: '···4821', chip: { code: 'on-file', label: 'On file' }, bank: { code: 'MBT' } } });
    expect(JSON.stringify(body)).not.toContain('0071-5566-4821');
    expect(row.actions.map((a) => a.code)).toEqual(['view', 'open-remittance', 'pay-by-cheque']);
    expect(body.batching).toMatchObject({ allowed: true, code: null, layout: { code: 'MBT-BULK' }, chequeAllowed: true });
  });

  it('In payment, Paid and Failed follow the batch line and the cheque', async () => {
    const all = await list('maker', 'segment=all');
    expect(rowOf(all, v.batched)).toMatchObject({ state: 'in-payment', method: { code: 'fund-transfer', label: 'Fund transfer' },
      batch: { id: v.batch.id, number: v.batch.batchNumber, status: 'draft', link: `/accounts/bank-payment-files?batch=${v.batch.id}` },
      nextStep: { code: 'submit-batch', label: `Submit batch ${v.batch.batchNumber}` } });
    expect(rowOf(all, v.failed)).toMatchObject({ state: 'failed', failureReason: 'Beneficiary account closed', selectable: true,
      nextStep: { code: 'repay', label: 'Re-batch or pay by cheque', reason: 'Beneficiary account closed' } });
    expect(rowOf(all, v.failed).actions.map((a) => a.code)).toEqual(expect.arrayContaining(['pay-by-cheque', 'rebatch', 'open-batch']));
    expect(rowOf(all, v.paid)).toMatchObject({ state: 'paid', nextStep: null, selectable: false });
    expect(rowOf(all, v.paid).actions.map((a) => a.code)).toContain('download-advice');
    // a cheque prepared after the bank rejected the line: the cheque is the payment now
    expect(rowOf(all, v.cheque)).toMatchObject({ state: 'in-payment', method: { code: 'cheque' }, nextStep: { code: 'approve-cheque', label: 'Approve cheque' } });
  });

  it('totals, KPI figures and segment counts are computed over the filtered set', async () => {
    const body = await list('maker', 'segment=to-pay');
    expect(body.total).toBe(2);
    expect(body.totals).toEqual({ count: 2, amount: 3000 });
    expect(body.kpis).toMatchObject({ toPay: { count: 2, amount: 3000 }, inPayment: { count: 2, amount: 9000 }, paidThisWeek: { count: 1, amount: 5000 }, failed: { count: 1, amount: 4000 } });
    expect(body.segments).toEqual({ 'to-pay': 2, 'in-payment': 2, paid: 1, failed: 1, all: 6 });
    expect((await list('maker', 'segment=all&method=cheque')).total).toBe(1);
    expect((await list('maker', `segment=all&q=${v.paid.remittanceNo}`)).data.map((x) => x.id)).toEqual([v.paid.id]);
    expect((await list('maker', `segment=all&q=${v.batch.batchNumber}`)).total).toBe(2);
  });

  it('Export XLSX holds every payment of the segment and filters, not one page', async () => {
    const r = await people.maker('get', `/remittance/payments/export.xlsx?segment=all&insurerId=${insurerId}`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/spreadsheetml/);
    expect(r.headers['content-disposition']).toContain('insurer-payments-all.xlsx');
    expect(r.body.subarray(0, 2).toString()).toBe('PK');
    const out = await paymentExport({ segment: 'to-pay', insurerId, perPage: 1 }, people.maker.user);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toHaveLength(EXPORT_HEADER.length);
    const ready = out.rows.find((x) => x[0] === v.ready.voucherNo);
    expect(ready).toEqual(expect.arrayContaining([v.ready.remittanceNo, 2000, 'On file', 'To pay', 'Create batch']));
    expect(ready.join(' ')).not.toContain('5566');
  });

  it('with no Metrobank layout no batch can be made, with the reason, and paying by cheque stays possible', async () => {
    await q("UPDATE bank_file_layouts SET active = false WHERE bank_code = 'MBT'");
    try {
      const body = await list('maker', 'segment=to-pay');
      expect(body.batching).toMatchObject({ allowed: false, code: 'NO_LAYOUT', reason: 'No Metrobank layout configured. Pay by cheque or ask the administrator.', chequeAllowed: true });
      const row = rowOf(body, v.ready);
      expect(row.selectable).toBe(false);
      expect(row.actions.map((a) => a.code)).toContain('pay-by-cheque');
      const admin = (await ctx.api('get', `/remittance/payments?insurerId=${insurerId}`)).body.batching;
      expect(admin.setupLink).toBe('/master/finance/bank-file-layouts');
      expect(body.batching.setupLink).toBeUndefined();
    } finally {
      await q("UPDATE bank_file_layouts SET active = true WHERE bank_code = 'MBT'");
    }
  });

  it('the General Manager views payments but cannot batch or pay them', async () => {
    const body = await list('gm', 'segment=all');
    expect(body.batching).toMatchObject({ allowed: false, code: 'NO_PERMISSION', chequeAllowed: false });
    expect(body.data.every((r) => !r.selectable && !r.actions.some((a) => ['pay-by-cheque', 'rebatch', 'add-account'].includes(a.code)))).toBe(true);
  });

  it('the payment record has the Payee, Payment, Amounts, Links and Approvals sections, for every voucher', async () => {
    for (const x of [v.draft, v.ready, v.batched, v.failed, v.paid, v.cheque]) {
      const r = await people.maker('get', `/remittance/payments/${x.voucherNo}`);
      expect(r.status, x.voucherNo).toBe(200);
      for (const section of ['payee', 'payment', 'amounts', 'links', 'approvals', 'timeline', 'activity']) expect(r.body.data[section], `${x.voucherNo} ${section}`).toBeTruthy();
    }
    const rec = (await people.maker('get', `/remittance/payments/${v.batched.id}`)).body.data;
    expect(rec.payee).toMatchObject({ accountMasked: '···4821', canReveal: true, verification: { label: 'On file' }, insurer: { id: insurerId } });
    expect(rec.amounts).toMatchObject({ dueToInsurer: 3000, refundCredits: 0, voucherAmount: 3000, bankAmount: 3000, check: { code: 'pass', label: 'Pass' } });
    expect(rec.links).toMatchObject({ remittances: [{ remittanceNo: v.batched.remittanceNo, schedule: `/remittance/remittances/${v.batched.remittanceId}/schedule.xlsx` }],
      batch: { number: v.batch.batchNumber }, voucher: { number: v.batched.voucherNo } });
    expect(rec.approvals.voucherMaker.name).toBe('J. Cruz');
    expect(rec.approvals.batchCreatedBy.name).toBe('M. Reyes');
    expect(rec.timeline.map((s) => s.code)).toEqual(['voucher-raised', 'in-batch', 'batch-approved', 'file-generated', 'sent', 'paid']);
    expect(rec.timeline.filter((s) => s.done).map((s) => s.code)).toEqual(['voucher-raised', 'in-batch']);
    const failed = (await people.maker('get', `/remittance/payments/${v.failed.id}`)).body.data;
    expect(failed.payment.failureReason).toBe('Beneficiary account closed');
    expect(failed.timeline.at(-1)).toMatchObject({ code: 'rejected', reason: 'Beneficiary account closed', done: true });
    expect((await people.maker('get', '/remittance/payments/PV-NOPE')).status).toBe(404);
  });

  it('Show full number gives the account number to write:disbursements only, and is audited', async () => {
    expect((await people.gm('get', `/remittance/payments/${v.ready.id}/account`)).status).toBe(403);
    expect((await people.gm('get', `/remittance/payments/${v.ready.id}`)).body.data.payee.canReveal).toBe(false);
    const r = await people.maker('get', `/remittance/payments/${v.ready.id}/account`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ voucherNo: v.ready.voucherNo, accountNumber: '0071-5566-4821', accountName: 'Payments Test Insurance Corp.' });
    const [a] = await q("SELECT user_id, after_data FROM audit_log WHERE entity = 'payee_bank_account' AND action = 'reveal' AND after_data->>'voucherId' = $1", [v.ready.id]);
    expect(a).toMatchObject({ user_id: people.maker.id, after_data: { voucherNo: v.ready.voucherNo, account: '···4821' } });
    expect(JSON.stringify(a.after_data)).not.toContain('5566');
  });

  it('Bank Payment Files tells the batch maker, the submitter and a voucher maker why they cannot decide the batch', async () => {
    expect((await people.checker('post', `/bank-payments/batches/${v.batch.id}/submit`)).status).toBe(200);
    const decision = async (who) => (await people[who]('get', `/bank-payments/batches/${v.batch.id}`)).body.data.decision;
    expect(await decision('maker')).toEqual({ canDecide: false, blockedCode: 'MAKER', blockedReason: 'You prepared this batch. Another user must approve it.' });
    expect(await decision('checker')).toEqual({ canDecide: false, blockedCode: 'SUBMITTER', blockedReason: 'You submitted this batch. Another user must approve it.' });
    expect(await decision('cruz')).toEqual({ canDecide: false, blockedCode: 'VOUCHER_MAKER',
      blockedReason: `You prepared payment voucher ${v.batched.voucherNo} in this batch. Another user must approve it.` });
    expect(await decision('gm')).toMatchObject({ canDecide: false, blockedCode: 'NO_PERMISSION' });
    await persona('low', 'pyt.low', 'L. Limit', ['tis-finance']);
    await q("INSERT INTO authority_limits(transaction_type, user_id, max_amount, status, decided_at) VALUES ('payment_voucher', $1, 1000, 'active', now())", [people.low.id]);
    expect(await decision('low')).toEqual({ canDecide: false, blockedCode: 'ABOVE_LIMIT', blockedReason: 'PHP 7,000.00 is above your approval limit of PHP 1,000.00.' });
    // the rules are those of the approval itself
    for (const who of ['maker', 'checker', 'cruz', 'low']) expect((await people[who]('post', `/bank-payments/batches/${v.batch.id}/approve`)).status, who).toBe(403);
    const listed = (await people.cruz('get', '/bank-payments/batches?status=for-approval')).body.data.find((b) => b.id === v.batch.id);
    expect(listed.decision.blockedCode).toBe('VOUCHER_MAKER');
    expect(rowOf(await list('maker', 'segment=in-payment'), v.batched).nextStep).toMatchObject({ code: 'approve-batch', label: `Approve batch ${v.batch.batchNumber}` });
  });

  it('a user without remittance or disbursement rights sees no payment', async () => {
    await persona('sales', 'pyt.sales', 'S. Sales', ['sales']);
    expect((await people.sales('get', '/remittance/payments')).status).toBe(403);
    expect((await people.sales('get', '/remittance/payments/export.xlsx')).status).toBe(403);
  });
});

describe('legacy electronic transfers and the transfer gate', () => {
  it('creating or executing a transfer is refused for TISPH with the Insurer payments message', async () => {
    const r = await people.maker('post', '/remittance/transfers').send({ beneficiary: 'Payments Test Insurance Corp.', amount: 1000, method: 'PESONet' });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ message: 'Electronic transfers are replaced by Insurer payments.', errors: [{ code: 'TRANSFERS_OFF' }] });
    const [t] = await q("SELECT id FROM remittance_items WHERE kind = 'transfer' AND status = 'Approved' LIMIT 1");
    expect((await people.maker('post', `/remittance/transfers/${t.id}/execute`).send({ status: 'Completed' })).status).toBe(409);
  });

  it('a TRF- item opens read-only with its approval, the journal posted at approval and its reversal status', async () => {
    await q("UPDATE app_settings SET value = 'true' WHERE key = 'remittance.transfers_enabled'");
    clearSettingsCache();
    let t;
    try {
      t = (await people.maker('post', '/remittance/transfers').send({ beneficiary: 'Payments Test Insurance Corp.', amount: 30000, method: 'PESONet', accountNumber: '0071-5566-9911',
        bankName: 'Metrobank', bankAccount: 'ACC-MBT-001', purpose: 'Premium' })).body.data;
      const [a] = await q("SELECT id, version FROM remittance_approvals WHERE entity = 'item' AND entity_id = $1", [t.id]);
      const ap = await people.cruz('post', `/remittance/approvals/${a.id}/approve`).send({ comments: 'ok', version: a.version });
      expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    } finally {
      await q("UPDATE app_settings SET value = 'false' WHERE key = 'remittance.transfers_enabled'");
      clearSettingsCache();
    }
    const legacy = await people.maker('get', '/remittance/transfers?legacy=1&perPage=100');
    expect(legacy.status).toBe(200);
    const row = legacy.body.data.find((x) => x.id === t.id);
    expect(row).toMatchObject({ reference: t.reference, accountMasked: '···9911', status: 'Approved', readOnly: true, creationDisabled: true,
      chip: { label: 'Recorded outside a payment voucher' }, approvedBy: { name: 'J. Cruz' }, reversal: { reversed: false, label: 'Not reversed' } });
    expect(row.journal.number).toMatch(/^JV/);
    expect(legacy.body.total).toBeGreaterThanOrEqual(5);
    expect((await list('maker', 'segment=to-pay')).legacyTransfers).toBe(legacy.body.total);

    const rev = await ctx.api('put', `/accounting/transactions/${row.journal.id}/reverse`);
    expect(rev.status, JSON.stringify(rev.body)).toBe(200);
    const rec = (await people.gm('get', `/remittance/transfers/${t.reference}`)).body.data;
    expect(rec).toMatchObject({ readOnly: true, journal: { id: row.journal.id }, reversal: { reversed: true, number: rev.body.data.reversalNumber },
      approval: { status: 'Approved', decisions: [{ action: 'Approved', by: 'J. Cruz' }] } });
    expect(rec.activity.length).toBeGreaterThan(0);
  });
});
