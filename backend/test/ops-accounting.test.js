/**
 * Operations and accounting (migrations 0290 to 0298): cover notes, cancellation return premium (pro-rata,
 * short-period, flat, partial), the post-dated cheque register, separate instalment invoices, the claim document
 * checklist, claims paid through the broker from Accounting, motor claim repairs (estimates, adjuster approval, letter of
 * authority, vehicle release), accounts payable and the fixed asset register with its depreciation run.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ledgerIntegrity, makePolicy, setupFinance } from './accounting.fixtures.js';
import { one, pool, query, withTransaction } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { createReceivable, findPolicy } from '../src/modules/receipts/receivables.js';
import { postBrokerSettlement } from '../src/modules/claims/service.js';
import { shortPeriodRetained } from '../src/modules/cancellations/service.js';
import { straightLine, depreciationStep } from '../src/modules/fixed-assets/service.js';
import { ensureCalendar, getPeriod } from '../src/modules/period-end/fiscal.js';
import { coverNoteExpiry } from '../src/modules/cover-notes/jobs.js';
import { pdcDepositDue } from '../src/modules/pdc/jobs.js';
import { claimDocumentReminders } from '../src/modules/claim-documents/jobs.js';

let ctx; let admin; let manager; let asOf;
const r2 = (n) => Math.round(n * 100) / 100;
const pdfOk = (res) => { expect(res.status).toBe(200); expect(res.headers['content-type']).toMatch(/pdf/); expect(Buffer.from(res.body).subarray(0, 4).toString()).toBe('%PDF'); };
const pdfGet = (api, path) => api('get', path).buffer(true).parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
const jvLines = (jvId) => query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId]).then((r) => r.rows.map((l) => ({ a: l.account_code, d: Number(l.debit), c: Number(l.credit) })));
const bill = async (m, amount = m.gross) => withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, m.policy.id), amount, user: { id: ctx.userIds.maker } }));

beforeAll(async () => {
  ctx = await setupFinance();
  admin = await one("SELECT id, username FROM users WHERE username = 'BrokerVerse'");
  await ctx.api('post', '/users').send({ username: 'ops.manager', password: 'Welcome@123', displayName: 'AP manager', roles: ['accounting-manager'], email: 'ops.manager@example.ph' });
  const token = (await request(ctx.app).post('/api/auth/login').send({ username: 'ops.manager', password: 'Welcome@123' })).body.accessToken;
  manager = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  asOf = await today();
});
afterAll(async () => { await pool.end(); });

// ---------------------------------------------------------------- 4.07 cover notes
describe('cover notes', () => {
  let quoteId; let cn; let m;
  it('issues a cover note from an accepted quotation for the configured validity, once', async () => {
    m = await makePolicy({ net: 20000 });
    quoteId = (await one(`INSERT INTO quotes(quote_number, client_id, insurance_company_id, product_id, status, sum_insured, premium_total, vehicle, lob)
      VALUES ('QT-T-CVN1', $1, $2, $3, 'accepted', 900000, 25050, '{"brand":"Toyota","model":"Vios","year":"2025","plateNo":"NAB 1234"}', 'MOTOR') RETURNING id`,
    [m.client.id, m.policy.insurance_company_id, m.policy.product_id])).id;
    const src = await ctx.as('sales')('get', '/cover-notes/sources');
    expect(src.status).toBe(200);
    expect(src.body.data.some((s) => s.id === quoteId)).toBe(true);
    const r = await ctx.as('sales')('post', '/cover-notes').send({ quoteId, coverFrom: asOf, insurerReference: 'BND-1' });
    expect(r.status).toBe(201);
    cn = r.body.data;
    expect(cn.coverNoteNumber).toMatch(/^CVN-\d{4}-\d{5}$/);
    expect(cn).toMatchObject({ status: 'active', validityDays: 30, coverFrom: asOf, coverTo: addDays(asOf, 30), sumInsured: 900000 });
    expect(cn.riskDescription).toMatch(/Toyota Vios/);
    expect((await ctx.as('sales')('post', '/cover-notes').send({ quoteId })).status).toBe(409);
    expect((await ctx.as('claims')('post', '/cover-notes').send({ quoteId })).status).toBe(403);
  });
  it('refuses a quotation the customer has not accepted', async () => {
    const q = (await one(`INSERT INTO quotes(quote_number, client_id, insurance_company_id, status, premium_total) VALUES ('QT-T-CVN2', $1, $2, 'draft', 1000) RETURNING id`,
      [m.client.id, m.policy.insurance_company_id])).id;
    expect((await ctx.as('sales')('post', '/cover-notes').send({ quoteId: q })).status).toBe(409);
  });
  it('prints the cover note with the letterhead', async () => {
    pdfOk(await pdfGet(ctx.as('sales'), `/cover-notes/${cn.id}/pdf`));
  });
  it('links the policy issued from the quotation and supersedes the cover note', async () => {
    await query('UPDATE policies SET quote_id = $2 WHERE id = $1', [m.policy.id, quoteId]);
    const r = await ctx.as('sales')('get', `/cover-notes/${cn.id}`);
    expect(r.body.data).toMatchObject({ status: 'superseded', policyNumber: m.policy.policy_number });
  });
  it('reminds before expiry and expires a cover note past its end date (daily job)', async () => {
    const q = (await one(`INSERT INTO quotes(quote_number, client_id, insurance_company_id, status, premium_total) VALUES ('QT-T-CVN3', $1, $2, 'approved', 1000) RETURNING id`,
      [m.client.id, m.policy.insurance_company_id])).id;
    const a = (await ctx.as('sales')('post', '/cover-notes').send({ quoteId: q, coverFrom: addDays(asOf, -25), validityDays: 30 })).body.data;
    const job = await coverNoteExpiry();
    expect(job.reminders).toBeGreaterThanOrEqual(1);
    expect((await one("SELECT count(*)::int AS n FROM notifications WHERE entity = 'cover_note' AND entity_id = $1", [a.id])).n).toBe(1);
    await query('UPDATE cover_notes SET cover_to = $2 WHERE id = $1', [a.id, addDays(asOf, -1)]);
    await coverNoteExpiry();
    expect((await ctx.as('sales')('get', `/cover-notes/${a.id}`)).body.data.status).toBe('expired');
    expect((await ctx.as('sales')('post', `/cover-notes/${a.id}/cancel`).send({ reason: 'x' })).status).toBe(409);
  });
});

// ---------------------------------------------------------------- 6.04 / 6.05 cancellation
describe('cancellation return premium', () => {
  it('short-period scale: the band of the days in force, scaled to a year for a shorter term', () => {
    const scale = [{ maxDays: 31, retainedPercent: 20 }, { maxDays: 183, retainedPercent: 70 }, { maxDays: 366, retainedPercent: 100 }];
    expect(shortPeriodRetained(scale, 10, 365).retainedPercent).toBe(20);
    expect(shortPeriodRetained(scale, 100, 365).retainedPercent).toBe(70);
    expect(shortPeriodRetained(scale, 60, 182).annualDays).toBe(121);
  });
  it('computes short-period when the insured cancels, pro-rata when the insurer does and flat from inception', async () => {
    const m = await makePolicy({ net: 10000, inceptionOffset: -10 });
    const q = (body) => ctx.as('sales')('post', '/cancellations/quote').send({ policyId: m.policy.id, effectiveDate: asOf, ...body });
    const sp = (await q({ reason: 'INSURED_REQUEST' })).body.data;
    expect(sp).toMatchObject({ method: 'short-period', daysInForce: 10, daysLeft: 355, returnNetPremium: 8000 });
    expect(sp.taxes.dst).toBe(0);
    expect(sp.grossReturn).toBe(r2(8000 + sp.taxes.vat + sp.taxes.lgt + sp.taxes.fst + sp.taxes.other));
    expect(sp.commissionReversed).toBe(1200);
    // the insurer gives back the return less the commission taken back and its VAT, plus the EWT withheld on it (net basis)
    expect(sp).toMatchObject({ remittanceBasis: 'net', insurerReturn: r2(sp.grossReturn - 1200 - 1200 * 0.12 + 1200 * 0.1) });
    const pr = (await q({ reason: 'NON_PAYMENT' })).body.data;
    expect(pr).toMatchObject({ method: 'pro-rata', returnNetPremium: r2((10000 * 355) / 365) });
    const flat = (await q({ reason: 'NOT_TAKEN_UP' })).body.data;
    expect(flat).toMatchObject({ method: 'flat', returnNetPremium: 10000 });
    expect((await q({ method: 'manual', returnPremium: 100 })).status).toBe(400);
    expect((await q({ cancellationType: 'PARTIAL' })).status).toBe(400);
    expect((await q({ cancellationType: 'PARTIAL', partialPercent: 50, reason: 'INSURER_DECISION' })).body.data.returnNetPremium).toBe(r2((5000 * 355) / 365));
  });
  it('a cancellation endorsement carries the computed return; completing it credits the bill, reverses taxes and commission, and cancels the policy', async () => {
    const m = await makePolicy({ net: 10000, inceptionOffset: -10 });
    const rcv = await bill(m);
    const quote = (await ctx.api('post', '/cancellations/quote').send({ policyId: m.policy.id, effectiveDate: asOf, reason: 'INSURER_DECISION' })).body.data;
    const e = await ctx.api('post', '/endorsements/create-endorsement').send({ policyId: m.policy.id, endorsementTypeIds: [5], isCancelPolicy: true, cancellationType: 'FULL',
      cancellationReason: 'INSURER_DECISION', effectiveDate: asOf, premiumDelta: -m.gross });
    expect(e.status).toBe(201);
    expect(e.body.premiumDelta).toBe(-quote.grossReturn);
    expect(e.body).toMatchObject({ cancellationMethod: 'pro-rata', cancellationReason: 'INSURER_DECISION' });
    const c = await ctx.as('sales')('post', '/endorsements/complete-endorsement').send({ endorsementId: e.body.endorsementId });
    expect(c.status).toBe(200);
    expect((await one('SELECT status FROM policies WHERE id = $1', [m.policy.id])).status).toBe('cancelled');
    const after = await one('SELECT balance FROM receivables WHERE id = $1', [rcv.id]);
    expect(Number(after.balance)).toBe(r2(m.gross - quote.grossReturn));
    const credit = await one(`SELECT j.id FROM receivable_credits rc JOIN journal_vouchers j ON j.id = rc.journal_id WHERE rc.receivable_id = $1`, [rcv.id]);
    const lines = await jvLines(credit.id);
    expect(lines.find((l) => l.a === '1202001').c).toBe(quote.grossReturn);
    expect(lines.find((l) => l.a === '3201001').d).toBe(quote.commissionReversed);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });
  it('a partial cancellation returns the premium of the part and keeps the policy in force', async () => {
    const m = await makePolicy({ net: 10000, inceptionOffset: -10 });
    await bill(m);
    const e = await ctx.api('post', '/endorsements/create-endorsement').send({ policyId: m.policy.id, endorsementTypeIds: [5], isCancelPolicy: true, cancellationType: 'PARTIAL',
      partialPercent: 40, cancellationReason: 'INSURED_REQUEST', effectiveDate: asOf });
    expect(e.status).toBe(201);
    expect(e.body.returnCalculation.returnNetPremium).toBe(3200);
    const c = await ctx.as('sales')('post', '/endorsements/complete-endorsement').send({ endorsementId: e.body.endorsementId });
    expect(c.body.status).toBe('Completed');
    expect((await one('SELECT status FROM policies WHERE id = $1', [m.policy.id])).status).toBe('active');
  });
  it('a CTPL tariff policy (no net premium) is cancelled on the tariff amount, without premium taxes of its own', async () => {
    // the Insurance Commission tariff is booked as the gross premium with its taxes inside: the net premium is 0
    const m = await makePolicy({ net: 0, product: 'CTPL', inceptionOffset: -10 });
    await query("UPDATE policies SET premium_total = 610.40, commission_amount = 0, net_premium = 0, details = '{\"netPremium\":0,\"grossPremium\":610.4}' WHERE id = $1", [m.policy.id]);
    const rcv = await bill(m, 610.4);
    const quote = await ctx.api('post', '/cancellations/quote').send({ policyId: m.policy.id, effectiveDate: asOf, reason: 'NON_PAYMENT' });
    expect(quote.status).toBe(200);
    const expected = r2((610.4 * 355) / 365);
    expect(quote.body.data).toMatchObject({ method: 'pro-rata', tariffOnly: true, policyNetPremium: 610.4, returnNetPremium: expected, grossReturn: expected });
    expect(quote.body.data.taxes).toEqual({ vat: 0, dst: 0, lgt: 0, fst: 0, other: 0 });
    const e = await ctx.api('post', '/endorsements/create-endorsement').send({ policyId: m.policy.id, endorsementTypeIds: [5], isCancelPolicy: true, cancellationType: 'FULL',
      cancellationReason: 'NON_PAYMENT', effectiveDate: asOf });
    expect(e.status).toBe(201);
    expect(e.body.premiumDelta).toBe(-expected);
    const c = await ctx.as('sales')('post', '/endorsements/complete-endorsement').send({ endorsementId: e.body.endorsementId });
    expect(c.status).toBe(200);
    expect((await one('SELECT status FROM policies WHERE id = $1', [m.policy.id])).status).toBe('cancelled');
    expect(Number((await one('SELECT balance FROM receivables WHERE id = $1', [rcv.id])).balance)).toBe(r2(610.4 - expected));
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });
});

// ---------------------------------------------------------------- 8.12 post-dated cheques
describe('post-dated cheque register', () => {
  let m; let rcv; let first; let second;
  it('registers cheques on hand against a bill, never more than the bill', async () => {
    m = await makePolicy({ net: 8000 });
    rcv = await bill(m);
    const half = r2(m.gross / 2);
    const reg = (b) => ctx.as('maker')('post', '/pdc').send({ receivableId: rcv.id, bankId: null, draweeBank: 'BDO Unibank', storageLocation: 'Vault A', ...b });
    const a = await reg({ chequeNumber: '1001', chequeDate: asOf, amount: half });
    expect(a.status).toBe(201);
    first = a.body.data;
    expect(first).toMatchObject({ status: 'on-hand', billNumber: rcv.bill_number, amount: half });
    second = (await reg({ chequeNumber: '1002', chequeDate: addDays(asOf, 30), amount: r2(m.gross - half) })).body.data;
    expect((await reg({ chequeNumber: '1003', chequeDate: asOf, amount: 1 })).status).toBe(409);
    expect((await reg({ chequeNumber: '1001', chequeDate: asOf, amount: 1 })).status).toBeGreaterThanOrEqual(400);
    expect((await ctx.as('sales')('get', '/pdc')).status).toBe(403);
    const due = (await ctx.as('maker')('get', '/pdc/deposit-due')).body.data;
    expect(due.rows.map((r) => r.id)).toContain(first.id);
    expect(due.rows.map((r) => r.id)).not.toContain(second.id);
    expect((await pdcDepositDue()).due).toBeGreaterThanOrEqual(1);
  });
  it('deposits a cheque on its date: the receipt is created and posted; not before its date', async () => {
    expect((await ctx.as('maker')('post', `/pdc/${second.id}/deposit`).send({ depositAccount: 'ACC-BDO-001' })).status).toBe(409);
    const r = await ctx.as('maker')('post', `/pdc/${first.id}/deposit`).send({ depositAccount: 'ACC-BDO-001' });
    expect(r.status).toBe(200);
    expect(r.body.data.pdc.status).toBe('deposited');
    expect(r.body.data.receiptNumber).toMatch(/^OR-/);
    expect(Number((await one('SELECT balance FROM receivables WHERE id = $1', [rcv.id])).balance)).toBe(r2(m.gross - first.amount));
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });
  it('a bounced cheque cancels its receipt (the bill is open again) and is replaced', async () => {
    const b = await ctx.as('maker')('post', `/pdc/${first.id}/bounce`).send({ reason: 'DAIF', bounceCharge: 500 });
    expect(b.status).toBe(200);
    expect(b.body.data.pdc.status).toBe('bounced');
    expect(b.body.data.emailedTo).toBe(m.client.email);
    expect(Number((await one('SELECT balance FROM receivables WHERE id = $1', [rcv.id])).balance)).toBe(m.gross);
    expect((await one('SELECT receipt_status FROM receipts WHERE id = $1', [b.body.data.pdc.receiptId])).receipt_status).toBe('Cancelled');
    const rep = await ctx.as('maker')('post', `/pdc/${first.id}/replace`).send({ draweeBank: 'BPI', chequeNumber: '2001', chequeDate: asOf });
    expect(rep.status).toBe(201);
    expect(rep.body.data.replaced.status).toBe('replaced');
    expect(rep.body.data.pdc).toMatchObject({ status: 'on-hand', replacesNumber: first.pdcNumber, amount: first.amount });
    expect((await ctx.as('maker')('post', `/pdc/${second.id}/return`).send({ reason: 'Client paid by transfer' })).body.data.status).toBe('returned');
    const x = await ctx.as('maker')('get', '/pdc?format=xlsx');
    expect(x.status).toBe(200);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });
});

// ---------------------------------------------------------------- 8.09 instalment invoices
describe('separate instalment invoices', () => {
  let m; let rcv; let plan; let r;
  it('replaces the bill by one bill per instalment with its own due date and booking journal', async () => {
    m = await makePolicy({ net: 12000 });
    rcv = await bill(m);
    plan = (await ctx.as('maker')('post', `/credit-control/policies/${m.policy.id}/instalment-plans`).send({ frequency: 'monthly', count: 3, firstDueDate: addDays(asOf, -40) })).body.data;
    r = await ctx.as('maker')('post', `/credit-control/instalment-plans/${plan.id}/invoice`).send({});
    expect(r.status).toBe(201);
    expect(r.body.data.invoices).toHaveLength(3);
    const kids = (await query('SELECT * FROM receivables WHERE parent_receivable_id = $1 ORDER BY instalment_seq', [rcv.id])).rows;
    expect(kids.map((k) => Number(k.amount))).toEqual(plan.instalments.map((i) => i.amount));
    expect(kids.map((k) => k.due_date)).toEqual(plan.instalments.map((i) => i.dueDate));
    expect(r2(kids.reduce((s, k) => s + Number(k.commission_amount), 0))).toBe(Number(rcv.commission_amount));
    expect(kids.every((k) => k.booking_jv_id)).toBe(true);
    expect((await one('SELECT status, balance FROM receivables WHERE id = $1', [rcv.id]))).toEqual({ status: 'cancelled', balance: 0 });
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
    expect((await ctx.as('maker')('post', `/credit-control/instalment-plans/${plan.id}/invoice`).send({})).status).toBe(409);
    expect((await ctx.as('maker')('post', `/credit-control/instalment-plans/${plan.id}/cancel`).send({})).status).toBe(409);
  });
  it('payments, the plan view, the ageing and the warranty monitor work per instalment', async () => {
    const kids = r.body.data.invoices;
    expect((await ctx.as('maker')('post', '/receipts').send({ receivableId: kids[0].receivableId, amount: kids[0].amount })).status).toBe(201);
    const view = (await ctx.as('maker')('get', `/credit-control/policies/${m.policy.id}/instalment-plans`)).body.data;
    const p = view.plans.find((x) => x.id === plan.id);
    expect(p.invoiced).toBe(true);
    expect(p.instalments.map((i) => [i.billNumber, i.status])).toEqual([[kids[0].billNumber, 'paid'], [kids[1].billNumber, 'overdue'], [kids[2].billNumber, 'due']]);
    const ageing = (await ctx.as('maker')('get', `/credit-control/instalments/ageing?policyId=${m.policy.id}`)).body.data;
    expect(ageing.rows.map((x) => x.billNumber)).toEqual([kids[1].billNumber, kids[2].billNumber]);
    const w = (await ctx.as('maker')('get', '/credit-control/warranty?status=all')).body.data.rows.find((x) => x.policyId === m.policy.id);
    expect(w).toMatchObject({ onInstalmentPlan: true, premiumDue: kids[1].amount, outstanding: r2(kids[1].amount + kids[2].amount) });
  });
});

// ---------------------------------------------------------------- 11.03 claim document checklist
describe('claim document checklist', () => {
  let claimId; let m;
  it('builds the checklist from the master by line of business and claim type', async () => {
    m = await makePolicy({ net: 9000 });
    claimId = (await one(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, lob, claim_type, created_at) VALUES ('CLM-T-DOC1', $1, $2, 'registered', current_date - 3, 'MOTOR', 'Theft', now() - interval '10 days') RETURNING id`,
      [m.policy.id, m.client.id])).id;
    const r = await ctx.as('claims')('get', `/claim-documents/claims/${claimId}`);
    expect(r.status).toBe(200);
    const names = r.body.data.items.map((i) => i.documentName);
    // TISPH checklist (Pre-BSM M14): the Motor documents and those of every line, not those of other lines
    expect(names).toContain('Claim Form');
    expect(names).toContain('Affidavit of Theft');
    expect(names).toContain('Police Report');
    expect(names).not.toContain('Fire investigation report of the Bureau of Fire Protection');
    expect(names).not.toContain('Notice of Default');
    expect(r.body.data.summary.complete).toBe(false);
  });
  it('refuses the submission to the insurer while a required document is missing', async () => {
    const r = await ctx.as('claims')('post', `/claim-documents/claims/${claimId}/submit-to-insurer`).send({});
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/required documents missing/);
  });
  it('reminds the claimant of the missing documents (by hand and by the daily job)', async () => {
    const r = await ctx.as('claims')('post', `/claim-documents/claims/${claimId}/remind`).send({});
    expect(r.status).toBe(200);
    expect(r.body.data.to).toBe(m.client.email);
    const mail = await one('SELECT subject, body_html FROM email_outbox WHERE id = $1', [r.body.data.emailId]);
    expect(mail.subject).toMatch(/CLM-T-DOC1/);
    expect(mail.body_html).toMatch(/<li>Affidavit of Theft/);
    await query('UPDATE claim_document_reminders SET created_at = now() - interval \'5 days\' WHERE claim_id = $1', [claimId]);
    expect((await claimDocumentReminders()).reminders).toBeGreaterThanOrEqual(1);
    expect((await one('SELECT count(*)::int AS n FROM claim_document_reminders WHERE claim_id = $1 AND automatic', [claimId])).n).toBe(1);
  });
  it('submits once every required document is received or waived', async () => {
    const list = (await ctx.as('claims')('get', `/claim-documents/claims/${claimId}`)).body.data;
    const required = list.items.filter((i) => i.required);
    expect((await ctx.as('claims')('patch', `/claim-documents/claims/${claimId}/items/${required[0].id}`).send({ status: 'waived' })).status).toBe(400);
    for (const [k, i] of required.entries()) {
      const body = k === 0 ? { status: 'waived', waiveReason: 'Not applicable' } : { status: 'received', receivedOn: asOf };
      expect((await ctx.as('claims')('patch', `/claim-documents/claims/${claimId}/items/${i.id}`).send(body)).status).toBe(200);
    }
    const s = await ctx.as('claims')('post', `/claim-documents/claims/${claimId}/submit-to-insurer`).send({ reference: 'E-mail to insurer' });
    expect(s.status).toBe(200);
    expect(s.body.data.submittedToInsurerAt).toBeTruthy();
    expect((await ctx.as('sales')('post', `/claim-documents/claims/${claimId}/remind`).send({})).status).toBe(403);
  });
});

// ---------------------------------------------------------------- 11.06 claims paid through the broker (Accounting)
describe('claims settlements from the Accounting menu', () => {
  let claimId;
  it('lists the claim awaiting funds, records the funds and pays the claimant with a payment voucher and a release form', async () => {
    const { policy } = await makePolicy({ net: 30000 });
    claimId = (await one(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, estimate_amount, settled_amount, settlement)
      VALUES ('CLM-T-PAY1', $1, $2, 'settled', current_date - 5, 20000, 20000, '{"paidThroughBroker": true, "payee": "Test Claimant"}') RETURNING id`, [policy.id, policy.client_id])).id;
    await postBrokerSettlement(claimId, admin);
    const list = (await ctx.as('maker')('get', '/claim-payments?status=outstanding')).body.data;
    expect(list.rows.find((r) => r.claimId === claimId)).toMatchObject({ stage: 'awaiting-funds', toReceive: 20000, payableToClaimant: 20000 });
    expect((await ctx.as('maker')('post', `/claim-payments/claims/${claimId}/funds-received`).send({ amount: 20000, bankAccount: 'ACC-BDO-001', reference: 'RA-9' })).status).toBe(200);
    const pay = await ctx.as('maker')('post', `/claim-payments/claims/${claimId}/pay`).send({ amount: 20000, bankAccount: 'ACC-BDO-001', paymentMode: 'check', reference: 'Chq 77', payee: 'Test Claimant' });
    expect(pay.status).toBe(200);
    expect(pay.body.data.voucherNumber).toMatch(/^CPV-\d{4}-\d{5}$/);
    expect(await jvLines(pay.body.data.journalId)).toEqual([{ a: '2205003', d: 20000, c: 0 }, { a: '1102001', d: 0, c: 20000 }]);
    pdfOk(await pdfGet(ctx.as('maker'), `/claim-payments/movements/${pay.body.data.movementId}/voucher`));
    pdfOk(await pdfGet(ctx.as('maker'), `/claim-payments/claims/${claimId}/release-form`));
    const done = (await ctx.as('maker')('get', '/claim-payments?status=completed')).body.data;
    expect(done.rows.find((r) => r.claimId === claimId).stage).toBe('completed');
    expect((await ctx.as('claims')('post', `/claim-payments/claims/${claimId}/pay`).send({ amount: 1, bankAccount: 'ACC-BDO-001' })).status).toBe(403);
  });
});

// ---------------------------------------------------------------- 11.08 motor claim repairs
describe('motor claim repairs', () => {
  let claimId; let est;
  it('records an estimate of an accredited shop (Repair Shop master maintained by Claims) and the adjuster\'s decision', async () => {
    const shop = await ctx.as('claims')('post', '/ops-masters/repair-shop').send({ code: 'RS-T1', name: 'Test Body Shop', accredited: true, city: 'Pasig' });
    expect(shop.status).toBe(201);
    expect((await ctx.as('maker')('post', '/ops-masters/repair-shop').send({ code: 'RS-T2', name: 'No' })).status).toBe(403);
    const { policy } = await makePolicy({ net: 15000 });
    await query('UPDATE policies SET sum_insured = 1000000 WHERE id = $1', [policy.id]);
    claimId = (await one(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, lob, claim_type) VALUES ('CLM-T-MTR1', $1, $2, 'in-review', current_date - 2, 'MOTOR', 'Own Damage') RETURNING id`,
      [policy.id, policy.client_id])).id;
    const e = await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/estimates`).send({ repairShopCode: 'RS-T1', shopReference: 'E-1', parts: 30000, labour: 10000, paint: 5000, vat: 5400 });
    expect(e.status).toBe(201);
    est = e.body.data;
    expect(est).toMatchObject({ kind: 'initial', total: 50400, status: 'submitted' });
    expect((await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/estimates`).send({ repairShopCode: 'RS-T1', parts: 1 })).status).toBe(409);
    expect((await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/loas`).send({})).status).toBe(409);
    expect((await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/estimates/${est.id}/decision`).send({ decision: 'approve', approvedAmount: 60000, adjusterName: 'R. Dizon' })).status).toBe(400);
    const d = await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/estimates/${est.id}/decision`).send({ decision: 'approve', approvedAmount: 48000, adjusterName: 'R. Dizon', approvalReference: 'ADJ-1' });
    expect(d.body.data).toMatchObject({ status: 'approved', approvedAmount: 48000, adjusterName: 'R. Dizon' });
  });
  it('issues the letter of authority with the participation of the insured, then a supplementary one', async () => {
    const l = await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/loas`).send({});
    expect(l.status).toBe(201);
    // participation: the higher of PHP 2,000 and 0.5% of the sum insured (1,000,000 -> 5,000)
    expect(l.body.data).toMatchObject({ kind: 'original', approvedRepairCost: 48000, participation: 5000, payableByInsurer: 43000, payableByInsured: 5000 });
    expect(l.body.data.loaNumber).toMatch(/^LOA-/);
    pdfOk(await pdfGet(ctx.as('claims'), `/motor-claims/claims/${claimId}/loas/${l.body.data.id}/pdf`));
    const s = (await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/estimates`).send({ repairShopCode: 'RS-T1', parts: 4000, labour: 1000 })).body.data;
    expect(s.kind).toBe('supplementary');
    await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/estimates/${s.id}/decision`).send({ decision: 'approve', adjusterName: 'R. Dizon' });
    const l2 = (await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/loas`).send({})).body.data;
    expect(l2).toMatchObject({ kind: 'supplementary', approvedRepairCost: 5000, participation: 0, payableByInsurer: 5000 });
  });
  it('releases the vehicle and prints the acknowledgement', async () => {
    const r = await ctx.as('claims')('post', `/motor-claims/claims/${claimId}/releases`).send({ releasedTo: 'Test Client', repairCompletedOn: asOf });
    expect(r.status).toBe(201);
    pdfOk(await pdfGet(ctx.as('claims'), `/motor-claims/claims/${claimId}/releases/${r.body.data.id}/pdf`));
    const list = (await ctx.as('claims')('get', '/motor-claims?stage=released')).body.data;
    expect(list.map((x) => x.claimId)).toContain(claimId);
    const hist = (await query('SELECT note FROM claim_history WHERE claim_id = $1 ORDER BY id', [claimId])).rows.map((h) => h.note);
    expect(hist.some((n) => /Letter of authority LOA-/.test(n))).toBe(true);
  });
});

// ---------------------------------------------------------------- 12.10 accounts payable and fixed assets
describe('accounts payable', () => {
  let inv;
  it('Accounting maintains suppliers; an invoice computes input VAT and EWT and goes for approval', async () => {
    const s = await ctx.as('maker')('post', '/ops-masters/supplier').send({ code: 'SUP-T1', name: 'Test Supplies Corp.', vatRegistered: true, ewtCode: 'WC158', paymentTermsDays: 30, expenseAccount: '4401008' });
    expect(s.status).toBe(201);
    const r = await ctx.as('maker')('post', '/payables/invoices').send({ supplierId: 'SUP-T1', supplierInvoiceNo: 'SI-1', invoiceDate: asOf, submit: true,
      lines: [{ description: 'Paper', amount: 6000 }, { description: 'Courier', accountCode: '4401007', amount: 4000 }] });
    expect(r.status).toBe(201);
    inv = r.body.data;
    expect(inv).toMatchObject({ status: 'for-approval', netAmount: 10000, inputVat: 1200, grossAmount: 11200, ewtRate: 1, ewtAmount: 100, payableAmount: 11100, dueDate: addDays(asOf, 30) });
    expect((await ctx.as('maker')('post', '/payables/invoices').send({ supplierId: 'SUP-T1', supplierInvoiceNo: 'si-1', invoiceDate: asOf, lines: [{ amount: 1 }] })).status).toBe(409);
  });
  it('is approved by another user holding approve:payables and posts ap.invoice with one line per expense account', async () => {
    expect((await ctx.as('maker')('post', `/payables/invoices/${inv.id}/approve`).send({})).status).toBe(403);
    const a = await manager('post', `/payables/invoices/${inv.id}/approve`).send({});
    expect(a.status).toBe(200);
    expect(a.body.data.status).toBe('approved');
    const lines = await jvLines(a.body.data.journalId);
    expect(lines).toEqual(expect.arrayContaining([{ a: '4401008', d: 6000, c: 0 }, { a: '4401007', d: 4000, c: 0 }, { a: '135000', d: 1200, c: 0 },
      { a: '2204001', d: 0, c: 100 }, { a: '2206001', d: 0, c: 11100 }]));
    pdfOk(await pdfGet(ctx.as('maker'), `/payables/invoices/${inv.id}/pdf`));
  });
  it('pays the invoice (ap.payment), ages what is open and reopens it when the payment is cancelled', async () => {
    const ageing = (await ctx.as('maker')('get', '/payables/ageing')).body.data;
    expect(ageing.rows.find((x) => x.invoiceId === inv.id)).toMatchObject({ balance: 11100, bucket: 'current' });
    const p = await ctx.as('maker')('post', '/payables/payments').send({ supplierId: 'SUP-T1', payFromAccount: 'ACC-BDO-001', chequeNumber: '000781', allocations: [{ invoiceId: inv.id }] });
    expect(p.status).toBe(201);
    expect(await jvLines(p.body.data.journalId)).toEqual([{ a: '2206001', d: 11100, c: 0 }, { a: '1102001', d: 0, c: 11100 }]);
    expect((await ctx.as('maker')('get', `/payables/invoices/${inv.id}`)).body.data).toMatchObject({ status: 'paid', balance: 0 });
    pdfOk(await pdfGet(ctx.as('maker'), `/payables/payments/${p.body.data.id}/pdf`));
    expect((await ctx.as('maker')('post', `/payables/payments/${p.body.data.id}/cancel`).send({ reason: 'Spoiled cheque' })).status).toBe(200);
    expect((await ctx.as('maker')('get', `/payables/invoices/${inv.id}`)).body.data).toMatchObject({ status: 'approved', balance: 11100 });
    expect((await ctx.as('sales')('get', '/payables/invoices')).status).toBe(403);
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });
});

describe('fixed asset register and depreciation', () => {
  let asset; let period;
  it('straight-line schedule ends at the salvage value', () => {
    const s = straightLine({ cost: 1000, salvage: 0, lifeMonths: 3, start: '2026-01' });
    expect(s.map((x) => [x.period, x.amount])).toEqual([['2026-01', 333.33], ['2026-02', 333.33], ['2026-03', 333.34]]);
    expect(s.at(-1).bookValue).toBe(0);
  });
  it('registers an asset with the life and accounts of its class, and an asset line of a supplier invoice is capitalised', async () => {
    period = asOf.slice(0, 7);
    const r = await ctx.as('maker')('post', '/fixed-assets/assets').send({ name: 'Laptops', classCode: 'COMPUTER', acquisitionDate: `${period}-01`, cost: 36000, custodian: 'IT' });
    expect(r.status).toBe(201);
    asset = r.body.data;
    expect(asset).toMatchObject({ usefulLifeMonths: 36, assetAccount: '1401003', accumulatedAccount: '1402003', expenseAccount: '4406001', depreciateFrom: period });
    expect(asset.schedule).toHaveLength(36);
    expect(asset.schedule[0]).toMatchObject({ period, amount: 1000, status: 'planned' });
    const inv = (await ctx.as('maker')('post', '/payables/invoices').send({ supplierId: 'SUP-T1', supplierInvoiceNo: 'SI-ASSET', invoiceDate: asOf, ewtCode: null, submit: true,
      lines: [{ description: 'Office chairs', amount: 12000, assetClass: 'FURNITURE' }] })).body.data;
    const a = (await manager('post', `/payables/invoices/${inv.id}/approve`).send({})).body.data;
    expect(a.lines[0]).toMatchObject({ accountCode: '1401002' });
    expect(a.lines[0].fixedAssetId).toBeTruthy();
    expect((await one('SELECT cost, class_code FROM fixed_assets WHERE id = $1', [a.lines[0].fixedAssetId]))).toEqual({ cost: 12000, class_code: 'FURNITURE' });
  });
  it('the monthly run posts one journal per class, once per period', async () => {
    const preview = (await ctx.as('maker')('get', `/fixed-assets/depreciation/${period}`)).body.data;
    expect(preview.due.find((d) => d.assetNumber === asset.assetNumber).amount).toBe(1000);
    const r = await ctx.as('maker')('post', `/fixed-assets/depreciation/${period}/run`).send({});
    expect(r.status).toBe(200);
    const comp = r.body.data.journals.find((j) => j.classCode === 'COMPUTER');
    expect(await jvLines(comp.journalId)).toEqual([{ a: '4406001', d: 1000, c: 0 }, { a: '1402003', d: 0, c: 1000 }]);
    const again = (await ctx.as('maker')('post', `/fixed-assets/depreciation/${period}/run`).send({})).body.data;
    expect(again.assets).toBe(0);
    const view = (await ctx.as('maker')('get', `/fixed-assets/assets/${asset.id}`)).body.data;
    expect(view).toMatchObject({ accumulatedDepreciation: 1000, bookValue: 35000 });
    expect(view.schedule[0].status).toBe('posted');
    expect((await ctx.as('claims')('get', '/fixed-assets/assets')).status).toBe(403);
  });
  it('is a step of the month-end close (nothing posted twice)', async () => {
    await withTransaction((db) => ensureCalendar(db));
    const p = await getPeriod(pool, period);
    const r = await withTransaction((db) => depreciationStep(db, p, { user: admin }));
    expect(r.status).toBe('done');
    expect(r.message).toMatch(/Nothing left to depreciate|already posted/);
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });
});
