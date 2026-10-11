/**
 * Enrolment of agents, dealers and vendors for payment (FGA EN-01, EN-02; GAP-REMIT-18, migration 0645): the vendor
 * fields of the enrolment form, the vendor group list and the unique vendor code, and the verification by a second
 * user of a new payee and of a change of its payment details while commission.payee_verification_required is on.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { withReferenceCommissionControls } from './helpers.js';

let ctx;
const setVerification = async (on) => {
  await query("UPDATE app_settings SET value = $1::jsonb WHERE key = 'commission.payee_verification_required'", [JSON.stringify(on)]);
  clearSettingsCache();
};
beforeAll(async () => {
  ctx = await setupFinance();
  await withReferenceCommissionControls();
});
afterAll(async () => { await pool.end(); });

const details = (ref) => ({ commissionDetails: { brokeragePct: 18, productLabel: 'Motor', primary: { referrerId: ref, level: 'L1', comsubPct: 8, comsubFixed: 0 }, chain: [] } });

describe('payee enrolment', () => {
  it('lists the form options with the vendor groups of the setting', async () => {
    const r = await ctx.as('maker')('get', '/commission/referrer-accounts/options');
    expect(r.status).toBe(200);
    expect(r.body.data.vendorGroups).toEqual(['Agents', 'Dealers', 'Referrals', 'TFS team members', 'Vendors']);
    expect(r.body.data.types).toContain('Dealer');
    expect(r.body.data.verificationRequired).toBe(false);
    expect(r.body.data.whtCodes.length).toBeGreaterThan(0);
  });

  it('keeps the vendor group, code, address and contact person; refuses an unknown group and a used code', async () => {
    const c = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Toyota Dealer Alabang', type: 'Dealer', vendorGroup: 'dealers', vendorCode: 'dlr-001',
      address: 'Alabang-Zapote Road, Muntinlupa', contactPerson: 'Ana Reyes', email: 'dealer@example.ph', bankName: 'BDO', bankAccountNo: '009988776655' });
    expect(c.status).toBe(201);
    const ref = c.body.data.referrer;
    expect(ref).toMatchObject({ vendorGroup: 'Dealers', vendorCode: 'DLR-001', address: 'Alabang-Zapote Road, Muntinlupa', contactPerson: 'Ana Reyes', verificationStatus: 'verified' });
    const bad = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Somebody Else', vendorGroup: 'Brokers' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].path).toBe('vendorGroup');
    const dup = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Another Dealer', vendorCode: 'DLR-001' });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toContain('DLR-001');
    const edit = await ctx.as('maker')('put', `/commission/referrer-accounts/${ref.id}`).send({ contactPerson: 'Ben Cruz' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.referrer).toMatchObject({ contactPerson: 'Ben Cruz', vendorCode: 'DLR-001', vendorGroup: 'Dealers' });
  });

  it('a new payee awaits verification by a second user before its commission is approved', async () => {
    await setVerification(true);
    const c = await ctx.api('post', '/commission/referrer-accounts').send({ name: 'Liza Verify', type: 'Agent', level: 'L1', bankName: 'BPI', bankAccountNo: '3179040001' });
    expect(c.status).toBe(201);
    const ref = c.body.data.referrer;
    expect(ref.verificationStatus).toBe('pending');
    expect(ref.payoutBlockedReason).toContain('awaits verification');
    // a line of the payee is not approved meanwhile
    const pol = await makePolicy({ net: 20000, details: details(ref.id) });
    expect((await ctx.as('maker')('post', '/commission/accrue').send({ policyId: pol.policy.id })).status).toBe(201);
    await ctx.as('maker')('post', '/receipts').send({ policyId: pol.policy.id, amount: pol.gross });
    const acct = (await ctx.as('maker')('get', `/commission/referrer-accounts/${ref.id}`)).body.data;
    const line = [...acct.currentCycle.lines, ...acct.futureCycles.lines][0];
    expect(line.status).toBe('Eligible');
    const approve = await ctx.as('checker')('post', `/commission/referrer-accounts/${ref.id}/lines/${line.id}/approve`);
    expect(approve.status).toBe(409);
    expect(approve.body.message).toContain('awaits verification');
    // the user who enrolled the payee does not verify it; nor does a user without approve:commission
    const self = await ctx.api('post', `/commission/referrer-accounts/${ref.id}/verify`).send({});
    expect(self.status).toBe(403);
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${ref.id}/verify`).send({})).status).toBe(403);
    // a second administrator verifies
    const second = await ctx.api('post', '/users').send({ username: 'payee.checker', password: 'Welcome@123', displayName: 'Payee checker', roles: ['system-admin'], email: 'payee.checker@example.ph' });
    expect(second.status).toBe(201);
    const { default: request } = await import('supertest');
    const token = (await request(ctx.app).post('/api/auth/login').send({ username: 'payee.checker', password: 'Welcome@123' })).body.accessToken;
    const v = await request(ctx.app).post(`/api/commission/referrer-accounts/${ref.id}/verify`).set('Authorization', `Bearer ${token}`).send({ note: 'Bank certificate seen' });
    expect(v.status).toBe(200);
    expect(v.body.data.referrer.verificationStatus).toBe('verified');
    expect((await request(ctx.app).post(`/api/commission/referrer-accounts/${ref.id}/verify`).set('Authorization', `Bearer ${token}`).send({})).status).toBe(409);
    expect((await ctx.as('checker')('post', `/commission/referrer-accounts/${ref.id}/lines/${line.id}/approve`)).status).toBe(200);
    const audit = await query("SELECT action FROM audit_log WHERE entity = 'commission_referrer' AND entity_id = $1 ORDER BY id", [ref.id]);
    expect(audit.rows.map((x) => x.action)).toEqual(expect.arrayContaining(['create', 'verify']));

    // a change of the bank account is verified again; a change of the contact person is not
    const contact = await ctx.as('maker')('put', `/commission/referrer-accounts/${ref.id}`).send({ contactPerson: 'Office' });
    expect(contact.body.data.referrer.verificationStatus).toBe('verified');
    const bank = await ctx.as('maker')('put', `/commission/referrer-accounts/${ref.id}`).send({ bankAccountNo: '3179040002' });
    expect(bank.status).toBe(200);
    expect(bank.body.message).toContain('awaits verification');
    expect(bank.body.data.referrer.verificationStatus).toBe('pending');
    expect(bank.body.data.referrer.verificationChanges).toEqual({ bank_account_no: { from: 'on file', to: 'changed' } });
    // the same account number sent again changes nothing more
    const same = await ctx.as('maker')('put', `/commission/referrer-accounts/${ref.id}`).send({ bankAccountNo: '3179040002', whtApplicable: false });
    expect(same.body.data.referrer.verificationChanges).toEqual({ bank_account_no: { from: 'on file', to: 'changed' }, wht_applicable: { from: true, to: false } });
    expect((await ctx.api('post', `/commission/referrer-accounts/${ref.id}/verify`).send({})).status).toBe(200);
    await setVerification(false);
  });

  it('a payee left pending is payable again once the control is switched off', async () => {
    await setVerification(true);
    const c = await ctx.api('post', '/commission/referrer-accounts').send({ name: 'Off Switch', bankName: 'BPI', bankAccountNo: '3179040003' });
    expect(c.body.data.referrer.verificationStatus).toBe('pending');
    await setVerification(false);
    const a = (await ctx.api('get', `/commission/referrer-accounts/${c.body.data.referrer.id}`)).body.data.referrer;
    expect(a.verificationStatus).toBe('verified');
    expect(a.payoutBlockedReason).toBeNull();
  });
});
