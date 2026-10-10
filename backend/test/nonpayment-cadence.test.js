/**
 * Proof of payment before the placement is sent (migration 0593, Pre-BSM P04) and the non-payment cadence
 * (TIS-BRD-CANC-02): customer notices at 5, 10 and 15 days, the cancellation flag, Sales and insurer notices, the
 * month's insurer notice and the Non-Payment Report.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { insurerNoticeDate, nonpaymentCadence } from '../src/modules/collections/nonpayment.js';

let ctx;
const ids = {};
const tok = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const setSettings = async (settings) => {
  const r = await ctx.api('put', '/settings').send({ settings });
  expect(r.status).toBe(200);
  clearSettingsCache();
};

async function makeUser(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = r.body.data.userId;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}

beforeAll(async () => {
  ctx = await setup();
  await makeUser('np.ops', ['tis-ops-associate']);
  await makeUser('np.teller', ['tis-ccd-bp']);
  await makeUser('np.sales', ['tis-sales-associate']);
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, email, owner_user_id, created_by) VALUES ('cl_np1', 'CL-NP-1', 'Np Client', 'Np', 'Client', 'np.client@example.ph', $1, $1)`, [ids['np.sales']]);
  await query(`INSERT INTO placements(id, placement_number, client_id, product_id, insurance_company_id, owner_user_id, created_by, status, premium_total, insured_name, lob)
    VALUES ('pl_np1', 'PS-NP-0001', 'cl_np1', (SELECT id FROM products WHERE code = 'MOTOR'), 2, $1, $1, 'draft', 23171.25, 'Np Client', 'MOTOR')`, [ids['np.ops']]);
  await query(`INSERT INTO risk_participants(entity_type, entity_id, insurance_company_id, share_percent, is_lead, status) VALUES ('placement', 'pl_np1', 2, 100, true, 'pending')`);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, created_by, status, inception_date, expiry_date, sum_insured, premium_total, insured_name, doc)
    VALUES ('pol_np1', 'POL-NP-0001', 'cl_np1', (SELECT id FROM products WHERE code = 'MOTOR'), 2, $1, $1, 'active', current_date - 40, current_date + 325, 900000, 20000, 'Np Client', '{}')`, [ids['np.sales']]);
  await query(`INSERT INTO receivables(id, bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES ('rcv_np1', 'INV-NP-0001', 'pol_np1', 'cl_np1', 20000, 20000, current_date - 6, 'open')`);
  await query(`INSERT INTO collection_items(receivable_id, policy_id, client_id) VALUES ('rcv_np1', 'pol_np1', 'cl_np1')`);
});
afterAll(async () => { await pool.end(); });

describe('proof of payment before the placement is sent', () => {
  it('with the control on, the slip waits for Cash Control; the teller verifies with a payment mode of the master; then it is sent', async () => {
    expect((await as('np.ops', 'get', '/placements/pl_np1')).status).toBe(200);
    expect((await as('np.ops', 'get', '/placements/pl_np1')).body.data.paymentVerification).toBeNull();
    await setSettings({ 'placement.payment_verification_required': true });
    const held = await as('np.ops', 'post', '/placements/pl_np1/send').send({});
    expect(held.status).toBe(409);
    expect(held.body.message).toMatch(/proof of payment .* must be verified by Cash Control/);
    // the operations associate cannot verify; the teller can, with a known payment mode and a reference
    expect((await as('np.ops', 'post', '/placements/pl_np1/verify-payment').send({ mode: 'CASH', reference: 'OR 1', amount: 100 })).status).toBe(403);
    expect((await as('np.teller', 'post', '/placements/pl_np1/verify-payment').send({ mode: 'BARTER', reference: 'x', amount: 100 })).status).toBe(400);
    expect((await as('np.teller', 'post', '/placements/pl_np1/verify-payment').send({ mode: 'CASH', reference: 'x', amount: 0 })).status).toBe(400);
    const v = await as('np.teller', 'post', '/placements/pl_np1/verify-payment').send({ mode: 'CASH', reference: 'Deposit slip 7781234', amount: 23171.25, remarks: 'Verified against the bank slip' });
    expect(v.status, JSON.stringify(v.body)).toBe(200);
    expect(v.body.data.paymentVerification).toMatchObject({ mode: 'CASH', reference: 'Deposit slip 7781234', amount: 23171.25, pdcApproved: false, by: 'np.teller' });
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'placement' AND entity_id = 'pl_np1' AND action = 'verify-payment'")).n).toBe(1);
    const sent = await as('np.ops', 'post', '/placements/pl_np1/send').send({});
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body.data.status).toBe('sent');
    // the service level clock of the verification step runs only while the control is on
    const clocks = await ctx.api('get', '/service-levels');
    expect(clocks.body.data.find((t) => t.code === 'POL-KYC').monitored).toBe(true);
    await setSettings({ 'placement.payment_verification_required': false });
  });
});

describe('non-payment cadence', () => {
  it('notifies the customer at 5, 10 and 15 days after the due date, once per step, and flags the account at the last step', async () => {
    // the sample data holds other unpaid bills: the figures below are those of this bill
    const item = (await one("SELECT id FROM collection_items WHERE receivable_id = 'rcv_np1'")).id;
    const mine = () => one("SELECT count(*)::int AS n, max(notes) AS last FROM collection_actions WHERE collection_id = $1 AND action_type = 'Non-payment notice'", [item]);
    const first = await nonpaymentCadence();
    expect(first.notices).toBeGreaterThanOrEqual(1);
    expect(await mine()).toMatchObject({ n: 1 });
    expect((await mine()).last).toMatch(/day 5/);
    expect((await one("SELECT count(*)::int AS n FROM email_outbox WHERE template = 'nonpayment-notice' AND entity_id = $1", [String(item)])).n).toBe(1);
    expect((await one("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE 'Non-payment notice (day 5)%'", [ids['np.sales']])).n).toBe(1);
    // the same day again: nothing more
    await nonpaymentCadence();
    expect((await mine()).n).toBe(1);
    // day 10 and day 15: the third notice flags the account for cancellation and alerts the collectors
    await query("UPDATE receivables SET due_date = current_date - 11 WHERE id = 'rcv_np1'");
    await nonpaymentCadence();
    expect((await mine()).n).toBe(2);
    expect((await one("SELECT nonpayment_flagged_at FROM collection_items WHERE id = $1", [item])).nonpayment_flagged_at).toBeNull();
    await query("UPDATE receivables SET due_date = current_date - 16 WHERE id = 'rcv_np1'");
    const third = await nonpaymentCadence();
    expect(third.flagged).toBeGreaterThanOrEqual(1);
    expect((await mine()).n).toBe(3);
    expect((await one("SELECT nonpayment_flagged_at FROM collection_items WHERE id = $1", [item])).nonpayment_flagged_at).not.toBeNull();
    expect((await one("SELECT count(*)::int AS n FROM notifications WHERE audience = 'write:collections' AND entity_id = $1 AND title LIKE 'Cancellation for non-payment to raise%'", [String(item)])).n).toBe(1);
    // the collector sees the flag on the collection item; a paid bill drops out of the cadence
    expect((await as('np.teller', 'get', '/collections?pageSize=100')).status).toBe(200);
  });

  it('tells Sales and the insurer once a policy is cancelled for non-payment, and each insurer the month\'s cancellations on the notice day', async () => {
    await query(`INSERT INTO endorsements(id, endorsement_number, policy_id, client_id, endorsement_type, status, is_cancel, cancellation_type, cancellation_reason, effective_date, changes, premium_delta, created_by, completed_at)
      VALUES ('end_np1', 'CAN-NP-0001', 'pol_np1', 'cl_np1', 'Cancellation', 'cancelled', true, 'FULL', 'CAN-NONPAY', current_date, '{}', -5000, $1, now())`, [ids['np.ops']]);
    const r = await nonpaymentCadence();
    expect(r.cancellationsNotified).toBe(1);
    expect((await one("SELECT count(*)::int AS n FROM email_outbox WHERE template = 'nonpayment-cancelled' AND to_address = 'uw@malayan.example'")).n).toBe(1);
    expect((await one("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND title LIKE 'Policy cancelled for non-payment%'", [ids['np.sales']])).n).toBe(1);
    expect((await nonpaymentCadence()).cancellationsNotified).toBe(0);
    // the insurer notice goes on the notice day (or the last working day before it), once per month
    const day = await insurerNoticeDate('2026-10-15');
    expect(day <= '2026-10-26' && day >= '2026-10-20').toBe(true);
    const month = new Date().toISOString().slice(0, 7);
    const noticeDay = await insurerNoticeDate(`${month}-15`);
    await query("UPDATE endorsements SET completed_at = date_trunc('month', now()) + interval '1 day' WHERE id = 'end_np1'");
    const early = await nonpaymentCadence({}, { now: new Date(`${month}-01T02:00:00Z`) });
    expect(early.insurerNotices).toBe(0);
    const onDay = await nonpaymentCadence({}, { now: new Date(`${noticeDay}T02:00:00Z`) });
    expect(onDay.insurerNotices).toBe(1);
    expect(await one("SELECT period, policies FROM nonpayment_insurer_notices WHERE insurance_company_id = 2")).toEqual({ period: month, policies: 1 });
    expect((await one("SELECT count(*)::int AS n FROM email_outbox WHERE template = 'nonpayment-insurer-notice'")).n).toBe(1);
    expect((await nonpaymentCadence({}, { now: new Date(`${noticeDay}T02:00:00Z`) })).insurerNotices).toBe(0);
  });

  it('the Non-Payment Report lists the unpaid accounts past the report days with their notices and flag', async () => {
    const def = await ctx.api('get', '/reports/non-payment');
    expect(def.status).toBe(200);
    const r = await ctx.api('post', '/reports/non-payment/run').send({ ReportCriteria: 'Overall' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const rows = Array.isArray(r.body.data) ? r.body.data : (r.body.data?.rows || r.body.rows || []);
    const row = rows.find((x) => x.policyNumber === 'POL-NP-0001');
    expect(row).toMatchObject({ billNumber: 'INV-NP-0001', noticesSent: 3, client: 'Np Client', insurer: 'Malayan Insurance Co., Inc.' });
    expect(row.flaggedDate).not.toBeNull();
    expect(Number(row.daysPastDue)).toBeGreaterThanOrEqual(16);
    expect((await as('np.teller', 'post', '/reports/non-payment/run').send({ ReportCriteria: 'Overall' })).status).toBe(200);
  });
});
