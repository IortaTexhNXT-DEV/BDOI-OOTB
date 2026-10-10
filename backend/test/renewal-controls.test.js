import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withoutCommissionTaxes } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { today, addDays } from '../src/lib/dates.js';

let ctx;
let todayStr;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };

async function makeUser(username, roles, displayName = username) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles });
  expect(r.status).toBe(201);
  ids[username] = (await one('SELECT id FROM users WHERE username = $1', [username])).id;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}
/** An active motor policy of `owner` expiring in `days` days, with its client. */
async function policy(id, days, owner = 'rc.sales') {
  await query(`INSERT INTO clients(id, client_code, display_name, email) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`, [`cl_${id}`, `CL-${id}`, `Client ${id}`, `${id}@example.ph`]);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total, commission_amount)
    SELECT $1, $2, $3, (SELECT id FROM products WHERE code = 'MOTOR'), (SELECT id FROM insurance_companies WHERE code = 'MAPFRE'), $4, 'active',
           $5::date - 364, $5::date, 1000000, 30000, 4500`, [id, `POL-${id}`, `cl_${id}`, ids[owner], addDays(todayStr, days)]);
  const r = await as(owner, 'post', `/renewals/policies/${id}`);
  if (r.status !== 201) throw new Error(`renewal of ${id}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data;
}
/** A quoted renewal (re-rated quote) submitted for approval by the maker. */
async function submitted(id, days = 40) {
  const r = await policy(id, days);
  expect((await as('rc.sales', 'post', `/renewals/${r.id}/quote`)).status).toBe(200);
  const s = await as('rc.sales', 'post', `/renewals/${r.id}/submit`).send({ note: 'Standard terms' });
  expect(s.body.data.statusCode).toBe('pending-approval');
  return s.body.data;
}

beforeAll(async () => {
  ctx = await setup();
  await withoutCommissionTaxes();
  todayStr = await today();
  await makeUser('rc.sales', ['tis-sales-associate'], 'Rhea Cruz');
  await makeUser('rc.officer', ['tis-sales-officer'], 'Oscar Dela Rosa');
  await makeUser('rc.unithead', ['tis-sales-unit-head'], 'Uma Santos');
  await makeUser('rc.ops', ['tis-ops-associate'], 'Paolo Reyes');
  await makeUser('rc.gm', ['tis-general-manager'], 'Gloria Manalo');
});
afterAll(async () => { await pool.end(); });

describe('renewal terms: frozen while awaiting approval, approved premium booked, quote validity', () => {
  it('refuses a change of the terms while the renewal awaits approval (wizard save and renewal quotation)', async () => {
    const r = await submitted('rc01');
    const put = await as('rc.sales', 'put', `/policy-renewals/${r.id}`).send({ orderSummary: { grossPremium: 15000 } });
    expect(put.status).toBe(409);
    expect(put.body.message).toMatch(/awaiting approval/);
    const post = await as('rc.sales', 'post', '/policy-renewals/policies/rc01/renewals').send({ orderSummary: { grossPremium: 15000 } });
    expect(post.status).toBe(409);
    const quote = await as('rc.sales', 'post', '/policy-renewals/policies/rc01/quotation').send({ coverageDetails: { lossAndDamageCoverage: '900000' } });
    expect(quote.status).toBe(409);
    const after = await one('SELECT status, premium_new FROM renewals WHERE id = $1', [r.id]);
    expect(after.status).toBe('pending-approval');
    expect(Number(after.premium_new)).toBe(r.renewalPremium);
  });

  it('books the approved premium on completion and refuses another premium in the request', async () => {
    const r = await submitted('rc02');
    expect((await as('rc.officer', 'post', `/renewals/${r.id}/approve`).send({ decision: 'approve' })).status).toBe(200);
    const other = await as('rc.sales', 'post', `/renewals/${r.id}/complete`).send({ premium: 15000 });
    expect(other.status).toBe(409);
    expect(other.body.message).toMatch(/approved premium/);
    expect((await one("SELECT count(*)::int AS n FROM policies WHERE renewed_from = 'rc02'")).n).toBe(0);
    const same = await as('rc.sales', 'post', `/renewals/${r.id}/complete`).send({ premium: r.renewalPremium });
    expect(same.status).toBe(200);
    expect(same.body.data.newPolicy.premium).toBe(r.renewalPremium);
    const rcv = await one('SELECT amount FROM receivables WHERE policy_id = $1', [same.body.data.newPolicy.id]);
    expect(Number(rcv.amount)).toBe(r.renewalPremium);
  });

  it('refuses to submit or complete on an expired renewal quote', async () => {
    const r = await policy('rc03', 40);
    expect((await as('rc.sales', 'post', `/renewals/${r.id}/quote`)).status).toBe(200);
    await query('UPDATE renewal_quotes SET valid_until = $2::date WHERE renewal_id = $1', [r.id, addDays(todayStr, -1)]);
    const s = await as('rc.sales', 'post', `/renewals/${r.id}/submit`).send({});
    expect(s.status).toBe(422);
    expect(s.body.message).toMatch(/expired on \d{2}\/\d{2}\/\d{4}/);
    // a quote valid until today is still good
    await query('UPDATE renewal_quotes SET valid_until = $2::date WHERE renewal_id = $1', [r.id, todayStr]);
    expect((await as('rc.sales', 'post', `/renewals/${r.id}/submit`).send({})).status).toBe(200);
    expect((await as('rc.officer', 'post', `/renewals/${r.id}/approve`).send({ decision: 'approve' })).status).toBe(200);
    await query('UPDATE renewal_quotes SET valid_until = $2::date WHERE renewal_id = $1', [r.id, addDays(todayStr, -2)]);
    expect((await as('rc.sales', 'post', `/renewals/${r.id}/complete`).send({})).status).toBe(422);
  });
});

describe('renewal approval within the Authority Matrix', () => {
  it('approves within the limit, refuses above it and refuses an approver without a renewal terms limit', async () => {
    await setSetting('renewals.require_authority_limit', true);
    const r = await submitted('rc04');
    expect(r.renewalPremium).toBeGreaterThan(20000);
    await query("UPDATE authority_limits SET max_amount = 20000 WHERE transaction_type = 'renewal_terms' AND role_code = 'tis-sales-officer'");
    const over = await as('rc.officer', 'post', `/renewals/${r.id}/approve`).send({ decision: 'approve' });
    expect(over.status).toBe(403);
    expect(over.body.message).toMatch(/above your approval authority of PHP 20,000\.00/);
    // returning the terms is not bound by the amount
    expect((await as('rc.officer', 'post', `/renewals/${r.id}/approve`).send({ decision: 'reject', note: 'Revise' })).body.data.statusCode).toBe('quoted');
    expect((await as('rc.sales', 'post', `/renewals/${r.id}/submit`).send({})).status).toBe(200);
    await query("UPDATE authority_limits SET status = 'retired' WHERE transaction_type = 'renewal_terms' AND role_code = 'tis-sales-unit-head'");
    const none = await as('rc.unithead', 'post', `/renewals/${r.id}/approve`).send({ decision: 'approve' });
    expect(none.status).toBe(403);
    expect(none.body.message).toMatch(/no approval authority for Renewal terms approval/);
    const gm = await as('rc.gm', 'post', `/renewals/${r.id}/approve`).send({ decision: 'approve' });
    expect(gm.status).toBe(200);
    expect(gm.body.data.approvedBy).toBe('Gloria Manalo');
    await query("UPDATE authority_limits SET max_amount = 250000 WHERE transaction_type = 'renewal_terms' AND role_code = 'tis-sales-officer'");
    await query("UPDATE authority_limits SET status = 'active' WHERE transaction_type = 'renewal_terms' AND role_code = 'tis-sales-unit-head'");
    await setSetting('renewals.require_authority_limit', false);
  });
});

describe('renewal term dates and the reinstatement window', () => {
  it('starts a regular renewal term the day after the expiring term ends', async () => {
    const r = await policy('rc05', 30);
    const expiry = addDays(todayStr, 30);
    const bad = await as('rc.sales', 'put', `/policy-renewals/${r.id}`).send({ effectiveDate: addDays(expiry, 10), expiryDate: addDays(expiry, 375) });
    expect(bad.status).toBe(422);
    expect(bad.body.errors[0]).toMatchObject({ path: 'effectiveDate' });
    const v = await as('rc.sales', 'post', '/policy-renewals/policies/rc05/validate').send({ effectiveDate: addDays(expiry, -5) });
    expect(v.body.data.errors.map((e) => e.path)).toContain('effectiveDate');
    const reversed = await as('rc.sales', 'put', `/policy-renewals/${r.id}`).send({ effectiveDate: addDays(expiry, 1), expiryDate: addDays(expiry, 1) });
    expect(reversed.body.errors.map((e) => e.path)).toEqual(['expiryDate']);
    const ok = await as('rc.sales', 'put', `/policy-renewals/${r.id}`).send({ effectiveDate: addDays(expiry, 1), expiryDate: addDays(expiry, 365) });
    expect(ok.status).toBe(200);
    expect(ok.body.data.effectiveDate).toBe(addDays(expiry, 1));
  });

  it('counts the reinstatement window in business days of the calendar, or in working days', async () => {
    const r = await policy('rc06', 20);
    expect((await as('rc.sales', 'post', `/renewals/${r.id}/lapse`).send({ reasonCode: 'LAP-COV', reason: 'Sold the car' })).status).toBe(200);
    await query("UPDATE renewals SET lapsed_at = ($2::date - 91)::timestamp + interval '12 hours' WHERE id = $1", [r.id, todayStr]);
    const late = await as('rc.sales', 'post', `/renewals/${r.id}/reinstate`).send({});
    expect(late.status).toBe(422);
    expect(late.body.message).toBe('Reinstatement window of 90 days has passed');
    const list = (await as('rc.sales', 'get', '/renewals/lapsed')).body.data.find((x) => x.renewalId === r.id);
    expect(list).toMatchObject({ reinstatementEligible: false, lapseDate: addDays(todayStr, -91) });
    await setSetting('renewals.reinstatement_day_basis', 'working');
    expect((await as('rc.sales', 'post', `/renewals/${r.id}/reinstate`).send({})).status).toBe(200);
    await setSetting('renewals.reinstatement_day_basis', 'calendar');
  });
});

describe('renewal dispositions: reassignment and not for renewal', () => {
  it('reassigns an open renewal with a coded reason; the new owner is notified', async () => {
    const r = await policy('rc07', 45);
    expect((await as('rc.sales', 'post', `/renewals/${r.id}/reassign`).send({ toUserId: ids['rc.ops'], reasonCode: 'RRA-LEAVE', note: 'On leave' })).status).toBe(403);
    expect((await as('rc.officer', 'post', `/renewals/${r.id}/reassign`).send({ toUserId: ids['rc.ops'] })).status).toBe(400);
    const noNote = await as('rc.officer', 'post', `/renewals/${r.id}/reassign`).send({ toUserId: ids['rc.ops'], reasonCode: 'RRA-LEAVE' });
    expect(noNote.status).toBe(400);
    expect(noNote.body.errors[0].path).toBe('note');
    const a = await as('rc.officer', 'post', `/renewals/${r.id}/reassign`).send({ toUserId: ids['rc.ops'], reasonCode: 'RRA-LEAVE', note: 'Rhea on leave until 20/10/2026' });
    expect(a.status).toBe(200);
    expect(a.body.data.assignedAgent).toBe('Paolo Reyes');
    expect((await as('rc.officer', 'post', `/renewals/${r.id}/reassign`).send({ toUserId: ids['rc.ops'], reasonCode: 'RRA-LEAVE', note: 'again' })).status).toBe(409);
    const n = await one("SELECT link FROM notifications WHERE user_id = $1 AND entity = 'renewal' AND entity_id = $2", [ids['rc.ops'], r.id]);
    expect(n.link).toBe(`/renewal/queue?renewal=${r.id}`);
    const detail = (await as('rc.officer', 'get', `/renewals/${r.id}`)).body.data;
    const act = detail.activities.find((x) => x.type === 'Reassigned');
    expect(act).toMatchObject({ by: 'Oscar Dela Rosa', reasonCode: 'RRA-LEAVE' });
    expect(act.description).toMatch(/Owner on leave: Rhea on leave/);
    const audit = await one("SELECT after_data AS after FROM audit_log WHERE entity = 'renewal' AND entity_id = $1 AND action = 'reassign'", [r.id]);
    expect(audit.after).toMatchObject({ ownerTo: ids['rc.ops'], reasonCode: 'RRA-LEAVE' });
    const users = await as('rc.officer', 'get', '/renewals/assignees');
    expect(users.body.data.map((u) => u.name)).toEqual(expect.arrayContaining(['Paolo Reyes', 'Rhea Cruz']));
    expect((await as('rc.sales', 'get', '/renewals/assignees')).status).toBe(403);
  });

  it('marks a renewal not for renewal, keeps the policy out of renewal and reinstates it', async () => {
    const r = await policy('rc08', 25);
    const bad = await as('rc.officer', 'post', `/renewals/${r.id}/not-for-renewal`).send({ reasonCode: 'LAP-COV', note: 'x' });
    expect(bad.status).toBe(400);
    const n = await as('rc.officer', 'post', `/renewals/${r.id}/not-for-renewal`).send({ reasonCode: 'NFR-LOANCLOSED', note: 'Loan paid off in September' });
    expect(n.status).toBe(200);
    expect(n.body.data).toMatchObject({ statusCode: 'not-renewed', status: 'Not for renewal', disposition: 'not-for-renewal' });
    expect(n.body.data.lapseReason).toBe('Loan fully paid or account closed: Loan paid off in September');
    expect((await as('rc.sales', 'post', '/renewals/policies/rc08')).status).toBe(409);
    const st = (await as('rc.sales', 'get', '/policy-renewals/renewable-policies?search=POL-rc08')).body.data[0];
    expect(st).toMatchObject({ renewalState: 'not-renewed', canRenew: false });
    expect((await as('rc.sales', 'post', `/renewals/${r.id}/lapse`).send({ reason: 'Client gone' })).status).toBe(409);
    const lapsed = (await as('rc.sales', 'get', '/renewals/lapsed')).body.data.find((x) => x.renewalId === r.id);
    expect(lapsed).toMatchObject({ disposition: 'not-for-renewal', status: 'Not for renewal' });
    const q = (await as('rc.sales', 'get', '/renewals/queue')).body.data.map((x) => x.id);
    expect(q).not.toContain(r.id);
    const back = await as('rc.sales', 'post', `/renewals/${r.id}/reinstate`).send({ note: 'Client changed mind' });
    expect(back.body.data).toMatchObject({ statusCode: 'pipeline', disposition: null });
  });
});

describe('record scope on the renewal registers', () => {
  it('shows a scoped user only the renewals of their own book on at-risk, negotiations, approvals and lapse', async () => {
    const role = await ctx.api('post', '/roles').send({ code: 'renew-own', name: 'Renewals own book (test)', permissions: ['read:profile', 'read:renewals', 'write:renewals', 'read:policies'] });
    expect(role.status).toBe(201);
    await makeUser('rc.own', ['renew-own']);
    await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': ['renew-own'] } });
    const mine = await policy('rc09', 5, 'rc.own');
    await as('rc.own', 'post', `/renewals/${mine.id}/quote`);
    await as('rc.own', 'post', `/renewals/${mine.id}/submit`).send({});
    const theirs = await submitted('rc10', 6);
    for (const path of ['/renewals/at-risk', '/renewals/negotiations', '/renewals/approvals']) {
      const got = (await as('rc.own', 'get', path)).body.data.map((x) => x.renewalId || x.id);
      expect(got).toContain(mine.id);
      expect(got).not.toContain(theirs.id);
    }
    expect((await as('rc.officer', 'get', '/renewals/approvals')).body.data.map((x) => x.renewalId)).toEqual(expect.arrayContaining([mine.id, theirs.id]));
    expect((await as('rc.own', 'get', '/renewals/lapsed')).body.data.every((x) => x.renewalId === mine.id)).toBe(true);
    await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': [] } });
  });
});
