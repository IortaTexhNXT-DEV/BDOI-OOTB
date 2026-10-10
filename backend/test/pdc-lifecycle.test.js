/**
 * PDC lifecycle (TIS-BRD-COLL-05, migration 0520): sets encoded against the instalment plan of a bill, forwarding to
 * the Insurance Partner with a transmittal, the partner's receipt, Partner cleared (AR on the collection date, posting
 * rule pdc.partner_collected) and Partner bounced, cancellation approved by a second user with a pull-out, replacement,
 * return to the client, ageing, follow-up, the closing of a set and the permissions of the log.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ledgerIntegrity, makePolicy, setupFinance } from './accounting.fixtures.js';
import { one, pool, query, withTransaction } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { createReceivable, findPolicy } from '../src/modules/receipts/receivables.js';
import { savePlan } from '../src/modules/credit-control/instalments.js';
import { ageingOf } from '../src/modules/pdc/service.js';
import { followUpList } from '../src/modules/pdc/lifecycle.js';
import { pdcFollowUp } from '../src/modules/pdc/jobs.js';

let ctx; let head; let ops; let asOf;
const r2 = (n) => Math.round(n * 100) / 100;
const as = (token) => (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
const balance = async (id) => Number((await one('SELECT balance FROM receivables WHERE id = $1', [id])).balance);
const setting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };

/** A broker-billed policy with a bill split into `count` monthly instalments, the first due in 10 days. */
async function planned(count = 4, net = 40000) {
  const m = await makePolicy({ net, insurer: 'STANDARD' });
  const bill = await withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, m.policy.id), amount: m.gross, user: { id: ctx.userIds.maker } }));
  await withTransaction((db) => savePlan(db, m.policy.id, { receivableId: bill.id, frequency: 'monthly', count, firstDueDate: addDays(asOf, 10) }, { id: ctx.userIds.maker }));
  return { ...m, bill };
}
const rowsOf = (enc, from = 1) => enc.rows.map((r, i) => ({ seq: r.seq, draweeBank: 'BPI', branch: 'Ayala Avenue', accountNumber: '3159-0456-21', brstn: '010040018',
  chequeNumber: String(45120 + from + i).padStart(7, '0'), chequeDate: r.dueDate }));

beforeAll(async () => {
  ctx = await setupFinance();
  const user = async (username, role) => {
    await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles: [role], email: `${username}@example.ph` });
    return as((await request(ctx.app).post('/api/auth/login').send({ username, password: 'Welcome@123' })).body.accessToken);
  };
  head = await user('ccd.head', 'accounting-manager');
  ops = await user('ops.reader', 'operations');
  asOf = await today();
  await setting('pdc.default_deposit_account', 'ACC-MBT-001');
});
afterAll(async () => { await pool.end(); });

describe('encoding a set against the instalment plan (FR-PDC-001 to 004)', () => {
  let m; let enc; let set;
  it('lists one row per unpaid instalment of the plan, with its due date and amount', async () => {
    m = await planned(4);
    const r = await ctx.as('maker')('get', `/pdc/encode?policy=${m.policy.policy_number}`);
    expect(r.status).toBe(200);
    enc = r.body.data;
    expect(enc).toMatchObject({ planned: true, instalmentCount: 4, billNumber: m.bill.bill_number, defaultPayee: 'insurance-partner', insurerName: expect.any(String) });
    expect(enc.rows).toHaveLength(4);
    expect(r2(enc.rows.reduce((s, x) => s + x.amount, 0))).toBe(m.gross);
    expect(enc.rows[0].dueDate).toBe(addDays(asOf, 10));
  });
  it('refuses rows in error with one message per field, and nothing is saved', async () => {
    const rows = rowsOf(enc);
    const bad = await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: m.policy.policy_number, billId: m.bill.id, rows: [
      { ...rows[0], chequeNumber: '45121' }, { ...rows[1], chequeNumber: rows[2].chequeNumber }, { ...rows[2], brstn: '1234' },
      { ...rows[3], chequeDate: addDays(rows[3].chequeDate, 10) }] });
    expect(bad.status).toBe(400);
    const msgs = bad.body.errors.map((e) => e.message);
    expect(msgs).toContain('Row 1: cheque number must be 6 to 10 digits');
    expect(msgs).toContain(`Row 3: cheque ${rows[2].chequeNumber} is already on row 2`);
    expect(msgs).toContain('Row 3: BRSTN must be 9 digits');
    expect(msgs.some((x) => /^Row 4: cheque date .* is more than 5 days from the instalment due date/.test(x))).toBe(true);
    const early = await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: m.policy.policy_number, billId: m.bill.id, rows: [{ ...rows[0], chequeDate: asOf }] });
    expect(early.body.errors[0].message).toMatch(/not after the received date. Receipt it as a cheque payment$/);
    expect((await one('SELECT count(*)::int AS n FROM pdc_sets WHERE policy_id = $1', [m.policy.id])).n).toBe(0);
  });
  it('saves the set: one cheque per row, Received at TIS with the Insurance Partner as payee, no journal', async () => {
    const journals = (await one('SELECT count(*)::int AS n FROM journal_vouchers')).n;
    const r = await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: m.policy.policy_number, billId: m.bill.id, storageLocation: 'Vault A-12', rows: rowsOf(enc) });
    expect(r.status).toBe(201);
    set = r.body.data.set;
    expect(set.setNumber).toMatch(/^PCS-\d{4}-\d{5}$/);
    expect(r.body.message).toMatch(new RegExp(`^Set ${set.setNumber} saved with 4 cheques, `));
    expect(r.body.data.cheques.map((c) => [c.status, c.payee, c.instalmentText, c.custody])).toEqual([1, 2, 3, 4].map((n) => ['on-hand', 'insurance-partner', `${n} of 4`, 'tis-vault']));
    expect(set).toMatchObject({ status: 'open', chequeCount: 4, total: m.gross, lastChequeDate: enc.rows[3].dueDate });
    expect((await one('SELECT count(*)::int AS n FROM journal_vouchers')).n).toBe(journals);
    const again = await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: m.policy.policy_number, billId: m.bill.id, rows: rowsOf(enc, 20).slice(0, 1) });
    expect(again.status).toBe(400);
    expect((await ctx.as('maker')('get', `/pdc/encode?policy=${m.policy.policy_number}`)).body.data.rows).toHaveLength(0);
    const p = await planned(1);
    const pe = (await ctx.as('maker')('get', `/pdc/encode?policy=${p.policy.policy_number}`)).body.data;
    const dup = await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: p.policy.policy_number, billId: pe.billId, rows: [{ ...rowsOf(enc)[0], seq: 1, chequeDate: pe.rows[0].dueDate }] });
    expect(dup.body.errors[0].message).toBe(`Row 1: cheque ${rowsOf(enc)[0].chequeNumber} of BPI is already encoded as ${r.body.data.cheques[0].pdcNumber}`);
  });
  it('leaves out a row paid another way, and a bill without a plan takes one cheque for its balance', async () => {
    const p = await planned(4);
    const e = (await ctx.as('maker')('get', `/pdc/encode?policy=${p.policy.policy_number}`)).body.data;
    const r = await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: p.policy.policy_number, billId: e.billId, rows: rowsOf(e, 40).slice(1) });
    expect(r.status).toBe(201);
    expect(r.body.data.set.chequeCount).toBe(3);
    expect(r.body.data.set.total).toBe(r2(e.rows.slice(1).reduce((s, x) => s + x.amount, 0)));
    const single = await makePolicy({ net: 9000, insurer: 'STANDARD' });
    await withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, single.policy.id), amount: single.gross, dueDate: addDays(asOf, 15), user: { id: ctx.userIds.maker } }));
    const one1 = (await ctx.as('maker')('get', `/pdc/encode?policy=${single.policy.policy_number}`)).body.data;
    expect(one1).toMatchObject({ planned: false, rows: [{ seq: null, amount: single.gross }] });
  });
  it('refuses a direct-billed policy, and payee TISPH without the collection account', async () => {
    const d = await makePolicy({ net: 5000, insurer: 'STANDARD' });
    await query("UPDATE policies SET billing_mode = 'direct' WHERE id = $1", [d.policy.id]);
    const r = await ctx.as('maker')('get', `/pdc/encode?policy=${d.policy.policy_number}`);
    expect(r.status).toBe(409);
    expect(r.body.message).toBe(`Policy ${d.policy.policy_number} is direct billed: the client pays the insurer, not TISPH`);
    const p = await planned(2);
    const e = (await ctx.as('maker')('get', `/pdc/encode?policy=${p.policy.policy_number}`)).body.data;
    await setting('pdc.default_deposit_account', '');
    const t = await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: p.policy.policy_number, billId: e.billId, payee: 'tisph', rows: rowsOf(e, 60) });
    expect(t.status).toBe(400);
    expect(t.body.errors[0].message).toBe('No TISPH collection bank account is set up for deposits');
    await setting('pdc.default_deposit_account', 'ACC-MBT-001');
  });
});

describe('forwarding, warehousing and the maturity advices (FR-PDC-010 to 032, 050, 051)', () => {
  let m; let cheques; let transmittal;
  beforeAll(async () => {
    m = await planned(4);
    const e = (await ctx.as('maker')('get', `/pdc/encode?policy=${m.policy.policy_number}`)).body.data;
    cheques = (await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: m.policy.policy_number, billId: e.billId, rows: rowsOf(e, 100) })).body.data.cheques;
  });
  it('forwards the cheques of one partner on a transmittal; a future date or a retained cheque is refused', async () => {
    expect((await ctx.as('maker')('post', '/pdc/transmittals').send({ pdcIds: [cheques[0].id], sentBy: 'courier', forwardedOn: addDays(asOf, 1) })).body.errors[0].message)
      .toBe('Forwarded date cannot be in the future');
    expect((await ctx.as('maker')('post', `/pdc/${cheques[0].id}/deposit`).send({})).status).toBe(409);
    const r = await ctx.as('maker')('post', '/pdc/transmittals').send({ pdcIds: cheques.map((c) => c.id), sentBy: 'courier', courierReference: 'LBC-778812' });
    expect(r.status).toBe(201);
    transmittal = r.body.data.transmittal;
    expect(transmittal).toMatchObject({ status: 'sent', count: 4, total: m.gross });
    expect(transmittal.transmittalNumber).toMatch(/^PT-\d{4}-\d{5}$/);
    expect(r.body.message).toBe(`4 cheques forwarded to ${transmittal.insurerName} on transmittal ${transmittal.transmittalNumber}`);
    expect(transmittal.cheques.every((c) => c.status === 'forwarded' && c.custody === 'in-transit')).toBe(true);
    const again = await ctx.as('maker')('post', '/pdc/transmittals').send({ pdcIds: [cheques[0].id], sentBy: 'courier' });
    expect(again.status).toBe(409);
    const other = await planned(1);
    await query("UPDATE policies SET insurance_company_id = (SELECT id FROM insurance_companies WHERE code = 'MALAYAN') WHERE id = $1", [other.policy.id]);
    const oe = (await ctx.as('maker')('get', `/pdc/encode?policy=${other.policy.policy_number}`)).body.data;
    const oc = (await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: other.policy.policy_number, billId: oe.billId, rows: rowsOf(oe, 140) })).body.data.cheques;
    const p = await planned(1);
    const pe = (await ctx.as('maker')('get', `/pdc/encode?policy=${p.policy.policy_number}`)).body.data;
    const pc = (await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: p.policy.policy_number, billId: pe.billId, rows: rowsOf(pe, 150) })).body.data.cheques;
    const mixed = await ctx.as('maker')('post', '/pdc/transmittals').send({ pdcIds: [oc[0].id, pc[0].id], sentBy: 'messenger' });
    expect(mixed.status).toBe(409);
    expect(mixed.body.message).toBe('The ticked cheques belong to 2 Insurance Partners. Forward one partner at a time');
    const x = await ctx.as('maker')('get', `/pdc/transmittals/${transmittal.id}?format=xlsx`);
    expect(x.status).toBe(200);
  });
  it('records the partner\'s receipt: a date before forwarding or no name is refused; part of the cheques leaves it partly received', async () => {
    expect((await ctx.as('maker')('post', `/pdc/transmittals/${transmittal.id}/received`).send({ receivedBy: 'J. Dizon', receivedOn: addDays(asOf, -1) })).body.errors[0].message)
      .toMatch(/^Received on cannot be before the forwarded date/);
    expect((await ctx.as('maker')('post', `/pdc/transmittals/${transmittal.id}/received`).send({ receivedBy: '' })).status).toBe(400);
    const part = await ctx.as('maker')('post', `/pdc/transmittals/${transmittal.id}/received`).send({ receivedBy: 'J. Dizon', partnerReference: 'SICI-TR-1045', pdcIds: cheques.slice(0, 3).map((c) => c.id) });
    expect(part.status).toBe(200);
    expect(part.body.data.transmittal.status).toBe('partly-received');
    expect((await ctx.as('maker')('get', `/pdc/${cheques[3].id}`)).body.data.status).toBe('forwarded');
    expect((await ctx.as('maker')('get', `/pdc/${cheques[0].id}`)).body.data).toMatchObject({ status: 'warehoused', custody: 'partner', partnerReceivedBy: 'J. Dizon' });
  });
  it('lists matured cheques awaiting the advice, ages them and follows them up after the grace days', async () => {
    await query('UPDATE post_dated_cheques SET cheque_date = $2::date WHERE id = $1', [cheques[0].id, addDays(asOf, -4)]);
    const tab = (await ctx.as('maker')('get', '/pdc?tab=awaiting')).body.data;
    expect(tab.rows.map((r) => r.id)).toContain(cheques[0].id);
    expect(tab.rows.find((r) => r.id === cheques[0].id).ageing).toMatchObject({ code: 'b1', label: '1-30', days: 4 });
    const f = await followUpList(pool);
    expect(f.rows.find((r) => r.id === cheques[0].id).followUpReason).toBe('4 days past date, no maturity advice');
    expect((await pdcFollowUp()).followUp).toBeGreaterThanOrEqual(1);
    expect((await one("SELECT count(*)::int AS n FROM notifications WHERE audience = 'write:pdc' AND title LIKE '%need follow-up'")).n).toBeGreaterThanOrEqual(1);
  });
  it('Partner cleared raises the AR on the collection date: Dr Premium Payable to the partner / Cr Premiums Receivable', async () => {
    const c = cheques[0];
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/partner-cleared`).send({ collectedOn: addDays(asOf, -5), partnerReference: '7781204' })).body.errors[0].message)
      .toMatch(/^Collection date cannot be before the cheque date/);
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/partner-cleared`).send({ collectedOn: addDays(asOf, 1), partnerReference: '7781204' })).body.errors[0].message)
      .toBe('Collection date cannot be in the future');
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/partner-cleared`).send({ collectedOn: asOf, partnerReference: ' ' })).body.errors[0].message).toBe('Enter the Insurance Partner\'s reference');
    expect((await ops('post', `/pdc/${c.id}/partner-cleared`).send({ collectedOn: asOf, partnerReference: '7781204' })).status).toBe(403);
    const before = await balance(m.bill.id);
    const r = await ctx.as('maker')('post', `/pdc/${c.id}/partner-cleared`).send({ collectedOn: asOf, partnerReference: '7781204' });
    expect(r.status).toBe(200);
    expect(r.body.message).toBe(`Cheque ${c.pdcNumber} cleared; AR ${r.body.data.receiptNumber} raised`);
    expect(r.body.data.pdc).toMatchObject({ status: 'cleared', collectedOn: asOf, partnerReference: '7781204' });
    expect(await balance(m.bill.id)).toBe(r2(before - c.amount));
    const rc = await one('SELECT * FROM receipts WHERE receipt_number = $1', [r.body.data.receiptNumber]);
    expect(rc).toMatchObject({ payment_mode: 'check', partner_reference: '7781204', received_date: expect.anything() });
    expect(rc.collected_by_insurer_id).toBe(m.policy.insurance_company_id);
    const jv = await one(`SELECT j.id FROM journal_vouchers j JOIN posting_rules r ON r.id = j.posting_rule_id WHERE r.event_code = 'pdc.partner_collected' AND j.policy_id = $1`, [m.policy.id]);
    const lines = (await query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY debit DESC', [jv.id])).rows;
    expect(lines.map((l) => [l.account_code, Number(l.debit), Number(l.credit)])).toEqual([[expect.any(String), c.amount, 0], ['1202001', 0, c.amount]]);
    expect(lines[0].account_code).not.toBe('1202001');
    expect((await one('SELECT payment_status FROM policies WHERE id = $1', [m.policy.id])).payment_status).toBe('Partial');
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
  });
  it('a Forwarded cheque never recorded as received is warehoused and cleared in one step', async () => {
    const c = cheques[3];
    await query('UPDATE post_dated_cheques SET cheque_date = $2::date WHERE id = $1', [c.id, asOf]);
    const r = await ctx.as('maker')('post', `/pdc/${c.id}/partner-cleared`).send({ collectedOn: asOf, partnerReference: '7781299' });
    expect(r.status).toBe(200);
    expect(r.body.data.pdc).toMatchObject({ status: 'cleared', warehousedOn: asOf });
    expect((await ctx.as('maker')('get', `/pdc/transmittals/${transmittal.id}`)).body.data.status).toBe('received');
  });
  it('Partner bounced on a cleared cheque cancels its AR and opens the instalment again; a reason is required', async () => {
    const c = cheques[0];
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/partner-bounced`).send({})).body.errors[0].message).toBe('Choose the reason given by the Insurance Partner');
    const before = await balance(m.bill.id);
    const r = await ctx.as('maker')('post', `/pdc/${c.id}/partner-bounced`).send({ reasonCode: 'PDC-BNC-DAIF' });
    expect(r.status).toBe(200);
    expect(r.body.data.pdc).toMatchObject({ status: 'bounced', bounceReasonCode: 'PDC-BNC-DAIF', receiptCancelled: true });
    expect(r.body.data.emailedTo).toBe(m.client.email);
    expect(await balance(m.bill.id)).toBe(r2(before + c.amount));
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/partner-cleared`).send({ collectedOn: asOf, partnerReference: 'x' })).body.message)
      .toBe(`Cheque ${c.pdcNumber} is Bounced; only a cheque with the Insurance Partner is cleared here`);
  });
  it('replaces the bounced cheque in the same set for the same instalment', async () => {
    const c = cheques[0];
    const r = await ctx.as('maker')('post', `/pdc/${c.id}/replace`).send({ draweeBank: 'Metrobank', chequeNumber: '2000000113', chequeDate: c.instalmentDueDate || c.chequeDate });
    expect(r.status).toBe(201);
    expect(r.body.data.replaced.status).toBe('replaced');
    expect(r.body.data.pdc).toMatchObject({ status: 'on-hand', setId: c.setId, instalmentSeq: c.instalmentSeq, replacesNumber: c.pdcNumber, payee: 'insurance-partner' });
    expect(r.body.message).toMatch(/^Replacement cheque PDC-\d{4}-\d{5} encoded in set PCS-/);
    expect((await ctx.as('maker')('post', `/pdc/${cheques[1].id}/replace`).send({ draweeBank: 'BPI', chequeNumber: '2000000114', chequeDate: asOf })).status).toBe(409);
  });
});

describe('cancellation with a second user, pull-out and return (FR-PDC-040 to 042)', () => {
  let m; let cheques;
  beforeAll(async () => {
    m = await planned(3);
    const e = (await ctx.as('maker')('get', `/pdc/encode?policy=${m.policy.policy_number}`)).body.data;
    cheques = (await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: m.policy.policy_number, billId: e.billId, storageLocation: 'Vault B-3', rows: rowsOf(e, 200) })).body.data.cheques;
    const t = (await ctx.as('maker')('post', '/pdc/transmittals').send({ pdcIds: cheques.slice(1).map((c) => c.id), sentBy: 'courier' })).body.data.transmittal;
    await ctx.as('maker')('post', `/pdc/transmittals/${t.id}/received`).send({ receivedBy: 'R. Santos' });
  });
  it('needs a reason; the requester cannot decide it; a return needs a remark and restores the status', async () => {
    const c = cheques[1];
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/cancellation`).send({})).body.errors[0].message).toBe('Choose the reason for the cancellation');
    const r = await ctx.as('maker')('post', `/pdc/${c.id}/cancellation`).send({ reasonCode: 'PDC-CXL-CHEQUE', note: 'Client changed bank' });
    expect(r.status).toBe(200);
    expect(r.body.message).toBe(`Cancellation of cheque ${c.pdcNumber} sent for approval`);
    expect(r.body.data.pdc.cancellation).toMatchObject({ reasonCode: 'PDC-CXL-CHEQUE', replacementFollows: 'cheque', priorStatus: 'warehoused' });
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/cancellation`).send({ reasonCode: 'PDC-CXL-CASH' })).body.message).toBe(`A cancellation of cheque ${c.pdcNumber} is already pending`);
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/cancellation/decision`).send({ action: 'approve' })).status).toBe(403);
    const work = await head('get', '/my-work/items?category=approvals&scope=all');
    expect(JSON.stringify(work.body)).toContain(c.pdcNumber);
    expect((await head('post', `/pdc/${c.id}/cancellation/decision`).send({ action: 'return' })).body.errors[0].message).toBe('Remark is required');
    const back = await head('post', `/pdc/${c.id}/cancellation/decision`).send({ action: 'return', remark: 'Wait for the new cheque first' });
    expect(back.body.data.pdc.status).toBe('warehoused');
  });
  it('approval of a cheque the partner holds requests the pull-out, carried on the next transmittal; the return cancels it', async () => {
    const c = cheques[1];
    await ctx.as('maker')('post', `/pdc/${c.id}/cancellation`).send({ reasonCode: 'PDC-CXL-CHEQUE' });
    const self = await ctx.api('post', '/users').send({ username: 'ccd.self', password: 'Welcome@123', displayName: 'Self approver', roles: ['accounting-manager'], email: 'ccd.self@example.ph' });
    expect(self.status).toBe(201);
    const a = await head('post', `/pdc/${c.id}/cancellation/decision`).send({ action: 'approve' });
    expect(a.status).toBe(200);
    expect(a.body.data.pullOut).toBe(true);
    expect(a.body.message).toMatch(/^Cancellation approved. Pull-out requested from /);
    expect(a.body.data.pdc).toMatchObject({ status: 'cancellation-pending', cancellation: { pullOutRequested: true } });
    const p = await planned(1);
    const pe = (await ctx.as('maker')('get', `/pdc/encode?policy=${p.policy.policy_number}`)).body.data;
    const pc = (await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: p.policy.policy_number, billId: pe.billId, rows: rowsOf(pe, 260) })).body.data.cheques;
    const t2 = (await ctx.as('maker')('post', '/pdc/transmittals').send({ pdcIds: [pc[0].id], sentBy: 'courier' })).body.data.transmittal;
    expect(t2.pullOuts.map((x) => x.id)).toEqual([c.id]);
    expect((await ctx.as('maker')('post', `/pdc/${c.id}/partner-returned`).send({ returnedOn: addDays(asOf, -1) })).body.errors[0].message)
      .toBe('Returned on cannot be before the request was approved');
    const ret = await ctx.as('maker')('post', `/pdc/${c.id}/partner-returned`).send({ returnedOn: asOf, partnerReference: 'SICI-PO-0091' });
    expect(ret.body.data.pdc).toMatchObject({ status: 'cancelled', custody: 'tis-vault' });
    expect((await ctx.as('maker')('get', `/pdc/encode?policy=${m.policy.policy_number}`)).body.data.rows.map((r) => r.seq)).toEqual([c.instalmentSeq]);
  });
  it('a cheque cancelled for a cheque replacement is replaced and stays cancelled; then it is returned to the client', async () => {
    const c = cheques[1];
    const r = await ctx.as('maker')('post', `/pdc/${c.id}/replace`).send({ bankId: null, draweeBank: 'Metrobank', chequeNumber: '2000000200', chequeDate: c.chequeDate });
    expect(r.status).toBe(201);
    expect(r.body.data.replaced).toMatchObject({ status: 'cancelled', replacedByNumber: r.body.data.pdc.pdcNumber });
    expect((await ctx.as('maker')('post', `/pdc/${cheques[2].id}/return`).send({ reason: 'Not needed' })).body.message).toMatch(/only a cheque in the TIS vault can be returned to the client$/);
    const back = await ctx.as('maker')('post', `/pdc/${c.id}/return`).send({ reason: 'Cancelled cheque handed back', returnedTo: 'The client' });
    expect(back.body.data).toMatchObject({ status: 'returned', custody: 'returned', returnedTo: 'The client' });
  });
  it('a cheque at TIS is cancelled on approval, without a pull-out; a cleared cheque cannot be cancelled', async () => {
    const c = cheques[0];
    await ctx.as('maker')('post', `/pdc/${c.id}/cancellation`).send({ reasonCode: 'PDC-CXL-CASH' });
    const a = await head('post', `/pdc/${c.id}/cancellation/decision`).send({ action: 'approve' });
    expect(a.body.data.pdc).toMatchObject({ status: 'cancelled', cancellation: { replacementFollows: 'cash' } });
    expect(a.body.message).toBe(`Cheque ${c.pdcNumber} cancelled`);
    const c3 = cheques[2];
    await query('UPDATE post_dated_cheques SET cheque_date = $2::date WHERE id = $1', [c3.id, asOf]);
    const cleared = await ctx.as('maker')('post', `/pdc/${c3.id}/partner-cleared`).send({ collectedOn: asOf, partnerReference: 'R-1' });
    const no = await ctx.as('maker')('post', `/pdc/${c3.id}/cancellation`).send({ reasonCode: 'PDC-CXL-ERROR' });
    expect(no.status).toBe(409);
    expect(no.body.message).toBe(`Cheque ${c3.pdcNumber} has AR ${cleared.body.data.receiptNumber}. Cancel the AR on Accounts > Receipts first`);
  });
  it('keeps the history of every action on the cheque', async () => {
    const h = await ctx.as('maker')('get', `/audit/records/post_dated_cheque/${cheques[1].id}`);
    expect(h.status).toBe(200);
    const actions = h.body.data.map((e) => e.action);
    for (const a of ['Encode', 'Forward', 'Partner Received', 'Cancellation Requested', 'Cancellation Returned', 'Cancellation Approved', 'Partner Returned', 'Return']) {
      expect(actions.map((x) => x.toLowerCase().replace(/-/g, ' '))).toContain(a.toLowerCase());
    }
  });
});

describe('sets, retained cheques and access (FR-PDC-003, 004, 020, 021, 060)', () => {
  it('a set closes when every cheque is cleared', async () => {
    const m = await planned(2);
    const e = (await ctx.as('maker')('get', `/pdc/encode?policy=${m.policy.policy_number}`)).body.data;
    const r = (await ctx.as('maker')('post', '/pdc/sets').send({ policyNumber: m.policy.policy_number, billId: e.billId, payee: 'tisph', rows: rowsOf(e, 300) })).body.data;
    for (const c of r.cheques) {
      await query('UPDATE post_dated_cheques SET cheque_date = $2::date WHERE id = $1', [c.id, asOf]);
      const d = await ctx.as('maker')('post', `/pdc/${c.id}/deposit`).send({ depositAccount: 'ACC-OTHER' });
      expect(d.status).toBe(400);
      expect((await ctx.as('maker')('post', `/pdc/${c.id}/deposit`).send({})).status).toBe(200);
      await ctx.as('maker')('post', `/pdc/${c.id}/clear`).send({});
    }
    expect((await ctx.as('maker')('get', `/pdc/sets/${r.set.id}`)).body.data.status).toBe('closed');
    expect((await one('SELECT payment_status FROM policies WHERE id = $1', [m.policy.id])).payment_status).toBe('Completed');
    expect((await ctx.as('maker')('post', '/pdc/transmittals').send({ pdcIds: [r.cheques[0].id], sentBy: 'courier' })).status).toBe(409);
  });
  it('ages a cheque on its date with the receivable buckets; a settled cheque has no ageing', () => {
    expect(ageingOf('warehoused', '2026-10-15', '2026-10-09')).toMatchObject({ code: 'current' });
    expect(ageingOf('warehoused', '2026-11-15', '2026-12-20')).toMatchObject({ code: 'b2', label: '31-60' });
    expect(ageingOf('warehoused', '2026-01-15', '2026-12-20')).toMatchObject({ code: 'b4', label: 'Over 90' });
    expect(ageingOf('cleared', '2026-11-15', '2026-12-20')).toBeNull();
  });
  it('filters the log by Insurance Partner and cheque date, and exports it', async () => {
    const standard = (await one("SELECT id FROM insurance_companies WHERE code = 'STANDARD'")).id;
    const r = (await ctx.as('maker')('get', `/pdc?tab=all&insurerId=${standard}&chequeFrom=${addDays(asOf, 1)}&chequeTo=${addDays(asOf, 400)}`)).body.data;
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.insurerId === standard && x.chequeDate > asOf)).toBe(true);
    expect(r.counts).toMatchObject({ open: expect.any(Number), 'with-partners': expect.any(Number) });
    expect((await ctx.as('maker')('get', '/pdc?tab=open&format=xlsx')).status).toBe(200);
  });
  it('Operations reads the log but cannot act; Sales does not see it; Accounting cannot approve', async () => {
    expect((await ops('get', '/pdc')).status).toBe(200);
    expect((await ops('get', '/pdc/encode?policy=x')).status).toBe(403);
    expect((await ctx.as('sales')('get', '/pdc')).status).toBe(403);
    const anyPending = await one("SELECT id FROM post_dated_cheques WHERE status = 'on-hand' AND set_id IS NOT NULL LIMIT 1");
    await ctx.as('maker')('post', `/pdc/${anyPending.id}/cancellation`).send({ reasonCode: 'PDC-CXL-ERROR' });
    expect((await ctx.as('checker')('post', `/pdc/${anyPending.id}/cancellation/decision`).send({ action: 'approve' })).status).toBe(403);
  });
});
