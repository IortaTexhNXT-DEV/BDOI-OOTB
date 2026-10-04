// Home (My Work with a role preset): the sources of the compliance officer (EDD reviews, compliance deadlines, breach
// register), the system administrator (users and access, system health) and the accounting manager (bank
// reconciliations, period close), permission-filtered on the server, and the role figures of GET /my-work/figures.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { today, addDays } from '../src/lib/dates.js';
import { presetOf, PRESETS } from '../src/modules/my-work/figures.js';

let ctx;
let now;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);

async function makeUser(username, roles, { signIn = true, reportingTo = null } = {}) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, firstName: username.split('.')[1], email: `${username}@example.ph`, roles,
    ...(reportingTo ? { reportingTo: ids[reportingTo] } : {}) });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = r.body.data.userId;
  if (signIn) tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}
const items = async (who, qs = '') => {
  const r = who === 'admin' ? await ctx.api('get', `/my-work/items?${qs}`) : await as(who, 'get', `/my-work/items?${qs}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
const refs = (body) => body.data.map((i) => i.ref);
const figures = async (who) => {
  const r = who === 'admin' ? await ctx.api('get', '/my-work/figures') : await as(who, 'get', '/my-work/figures');
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
};

beforeAll(async () => {
  ctx = await setup();
  now = await today();
  await makeUser('mw.officer', ['compliance-officer']);
  await makeUser('mw.ops', ['operations']);
  await makeUser('mw.acctmgr', ['accounting-manager']);
  await makeUser('mw.acct', ['accounting'], { reportingTo: 'mw.acctmgr' });
  await makeUser('mw.sales', ['sales']);
  await makeUser('mw.claims', ['claims']);
  await makeUser('mw.newbie', ['sales'], { signIn: false });
  const admin = await one("SELECT id FROM users WHERE username = 'BrokerVerse'");

  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, owner_user_id, created_by)
    VALUES ('cl_home1', 'CL-HOME-0001', 'Home Client', 'Home', 'Client', $1, $1)`, [ids['mw.sales']]);
  // EDD reviews: one being prepared by Operations, one submitted by Operations and waiting for the compliance officer
  await query(`INSERT INTO aml_edd_reviews(id, review_number, client_id, status, reason, created_by)
    VALUES ('edd_home1', 'EDD-HOME-0001', 'cl_home1', 'open', 'High-risk rating', $1)`, [ids['mw.ops']]);
  await query(`INSERT INTO aml_edd_reviews(id, review_number, client_id, status, reason, created_by, submitted_by, submitted_at)
    VALUES ('edd_home2', 'EDD-HOME-0002', 'cl_home1', 'submitted', 'Politically exposed person', $1, $1, now())`, [ids['mw.ops']]);
  // compliance deadlines: a licence expiring in 20 days, a renewed one (not listed), a fit and proper review due in 10 days,
  // an insurer whose certificate of authority runs out in 12 days
  await query(`INSERT INTO compliance_licences(id, holder_type, holder_name, licence_type, licence_number, expiry_date, renewal_status)
    VALUES ('lic_home1', 'firm', 'Home Brokers Inc.', 'Insurance broker licence', 'IB-HOME-1', $1::date + 20, 'due'),
           ('lic_home2', 'firm', 'Home Brokers Inc.', 'Reinsurance broker licence', 'RB-HOME-1', $1::date + 20, 'renewed')`, [now]);
  await query(`INSERT INTO compliance_fit_proper(id, person_name, role_category, position, next_review_on)
    VALUES ('fp_home1', 'Jose Reyes', 'officer', 'Chief Operating Officer', $1::date + 10)`, [now]);
  await query(`UPDATE insurance_companies SET attrs = COALESCE(attrs, '{}'::jsonb) || jsonb_build_object('icCertificateNumber', 'CA-HOME-1', 'icCertificateValidUntil', ($1::date + 12)::text)
    WHERE code = 'MAPFRE'`, [now]);
  // a personal data breach discovered today, not yet assessed, no data protection officer assigned
  await query(`INSERT INTO personal_data_breaches(id, breach_number, title, discovered_at, npc_due_at, created_by)
    VALUES ('pdb_home1', 'PDB-HOME-0001', 'Laptop with client schedules lost', now(), now() + interval '72 hours', $1)`, [ids['mw.ops']]);
  // a bank reconciliation of the accountant still in draft with unmatched lines; a period close run with a manual item and a failed check
  await query(`INSERT INTO bank_reconciliations(id, rec_number, bank_account_id, bank_account_code, gl_account_code, period, as_of_date, status, unmatched_bank_lines, unmatched_book_lines, difference, created_by)
    VALUES ('brc_home1', 'BRC-HOME-0001', 1, 'BPI-001', '1010', '2026-09', '2026-09-30', 'draft', 3, 1, 1250.00, $1)`, [ids['mw.acct']]);
  await query("INSERT INTO accounting_periods(period) VALUES ('2026-09') ON CONFLICT (period) DO NOTHING");
  await query(`INSERT INTO period_close_runs(id, run_number, period, status, created_by) VALUES ('pcr_home1', 'PCR-HOME-0001', '2026-09', 'in-progress', $1)`, [ids['mw.acct']]);
  await query(`INSERT INTO period_close_run_checks(run_id, code, label, item_type, severity, status, message)
    VALUES ('pcr_home1', 'bank_reconciliation_signoff', 'Bank reconciliations reviewed and signed off', 'manual', 'blocking', 'pending', NULL),
           ('pcr_home1', 'unapplied_receipts', 'No unapplied receipts', 'auto', 'warning', 'failed', '2 receipt lines not applied'),
           ('pcr_home1', 'trial_balance', 'Trial balance balances', 'auto', 'blocking', 'passed', NULL)`);
  // an access review due in 3 days with one user still to decide; a scheduled job whose last run failed; a failed integration message
  const review = await one("INSERT INTO access_reviews(name, due_date, created_by) VALUES ('Q4 access recertification', $1::date + 3, $2) RETURNING id", [now, admin.id]);
  await query("INSERT INTO access_review_items(review_id, user_id, roles) VALUES ($1, $2, '{sales}')", [review.id, ids['mw.sales']]);
  ids.review = review.id;
  await query("UPDATE scheduled_jobs SET last_status = 'failed', last_run_at = now() WHERE code = 'my-work-reminders'");
  await query("INSERT INTO job_runs(job_id, status, finished_at, error) SELECT id, 'failed', now(), 'boom' FROM scheduled_jobs WHERE code = 'my-work-reminders'");
  await query(`INSERT INTO integration_connectors(code, name, kind, adapter) VALUES ('HOME_SMS', 'Home SMS gateway', 'sms', 'http_sms') ON CONFLICT (code) DO NOTHING`);
  await query(`INSERT INTO integration_outbox(connector_code, message_type, reference, status, attempts, last_error) VALUES ('HOME_SMS', 'sms.send', '+639170000001', 'failed', 5, 'Gateway timed out')`);
});

afterAll(async () => {
  await pool.end();
});

describe('role sources', () => {
  it('the compliance officer sees the EDD reviews: the submitted one in their queue, the one in preparation with everyone', async () => {
    const mine = await items('mw.officer', 'category=edd');
    expect(refs(mine)).toEqual(['EDD-HOME-0002']);
    expect(mine.data[0]).toMatchObject({ queue: true, kind: 'EDD review awaiting decision', clientName: 'Home Client', link: '/compliance/aml/edd', priority: 'high' });
    const all = await items('mw.officer', 'category=edd&scope=all');
    expect(refs(all).sort()).toEqual(['EDD-HOME-0001', 'EDD-HOME-0002']);
    expect(all.data.find((i) => i.ref === 'EDD-HOME-0001')).toMatchObject({ ownerId: ids['mw.ops'], kind: 'EDD review in preparation' });
    // the categories of the officer's summary are the compliance ones, not the sales ones
    const s = await as('mw.officer', 'get', '/my-work/summary');
    const codes = s.body.data.categories.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(['edd', 'compliance', 'breaches', 'approvals', 'tasks']));
    expect(codes).not.toContain('quotes');
    expect(s.body.data.categories.find((c) => c.code === 'edd').count).toBe(1);
  });

  it('compliance deadlines: licence expiring, fit and proper review due, insurer certificate of authority expiring', async () => {
    const body = await items('mw.officer', 'category=compliance&pageSize=50');
    const kinds = Object.fromEntries(body.data.map((i) => [i.ref, i]));
    expect(kinds['IB-HOME-1']).toMatchObject({ kind: 'Licence expiring', clientName: 'Home Brokers Inc.', dueDate: addDays(now, 20), queue: true, link: '/compliance/licences',
      nextAction: 'File the licence renewal with the Insurance Commission' });
    expect(kinds['RB-HOME-1']).toBeUndefined();
    expect(kinds['Jose Reyes']).toMatchObject({ kind: 'Fit and proper review', dueDate: addDays(now, 10), link: '/compliance/fit-and-proper' });
    expect(kinds.MAPFRE).toMatchObject({ kind: 'Insurer certificate of authority expiring', dueDate: addDays(now, 12), priority: 'high', link: '/compliance/insurer-authority' });
    // Sales holds no compliance permission: the category is not theirs
    expect((await items('mw.sales', 'category=compliance')).total).toBe(0);
    expect((await as('mw.sales', 'get', '/my-work/summary')).body.data.categories.map((c) => c.code)).not.toContain('compliance');
  });

  it('breach register: an unassigned breach waits in the queue of the privacy team, with the NPC deadline as due date', async () => {
    const body = await items('mw.officer', 'category=breaches');
    expect(body.data[0]).toMatchObject({ ref: 'PDB-HOME-0001', kind: 'Personal data breach', priority: 'urgent', queue: true, link: '/compliance/breaches', nextAction: 'Assess the breach: is it notifiable to the NPC?' });
    expect(body.data[0].dueDate >= now).toBe(true);
    // Operations (write:privacy) has the same queue; once a data protection officer is assigned it is theirs alone
    expect(refs(await items('mw.ops', 'category=breaches'))).toEqual(['PDB-HOME-0001']);
    await query("UPDATE personal_data_breaches SET dpo_user_id = $1 WHERE id = 'pdb_home1'", [ids['mw.officer']]);
    expect((await items('mw.ops', 'category=breaches')).total).toBe(0);
    expect(refs(await items('mw.officer', 'category=breaches'))).toEqual(['PDB-HOME-0001']);
  });

  it('the accounting manager sees the bank reconciliations in progress and the period close items of the team', async () => {
    const recs = await items('mw.acctmgr', 'category=bankrec&scope=all');
    expect(recs.data[0]).toMatchObject({ ref: 'BRC-HOME-0001', ownerId: ids['mw.acct'], amount: 1250, dueDate: '2026-10-10', link: '/accounts/bank-reconciliation/reconciliations/brc_home1',
      nextAction: 'Match 3 bank and 1 book lines, then prepare the statement' });
    // the accountant who prepares it owns it; it is in the manager's team view too
    expect(refs(await items('mw.acct', 'category=bankrec'))).toEqual(['BRC-HOME-0001']);
    expect(refs(await items('mw.acctmgr', 'category=bankrec&scope=team'))).toEqual(['BRC-HOME-0001']);
    const close = await items('mw.acctmgr', 'category=periodClose&scope=all');
    expect(close.data.map((i) => i.nextAction).sort()).toEqual(['Resolve: No unapplied receipts (2 receipt lines not applied)', 'Sign off: Bank reconciliations reviewed and signed off']);
    expect(close.data.find((i) => i.kind === 'Close checklist item')).toMatchObject({ ref: 'PCR-HOME-0001', dueDate: '2026-10-05', priority: 'high', link: '/accounts/period-end/close/pcr_home1' });
    // a sales user has no accounting categories
    expect((await as('mw.sales', 'get', '/my-work/summary')).body.data.categories.map((c) => c.code)).not.toContain('periodClose');
  });

  it('the administrator sees the access reviews, the users awaiting their first sign-in and the failed jobs and messages', async () => {
    const access = await items('admin', 'category=access&pageSize=50');
    expect(access.data.find((i) => i.ref === `AR-${ids.review}`)).toMatchObject({ kind: 'Access review', dueDate: addDays(now, 3), queue: true, nextAction: 'Decide 1 of 1 users (keep or revoke)',
      link: '/master/generals/usermanagement/access-reviews' });
    expect(access.data.find((i) => i.ref === 'mw.newbie')).toMatchObject({ kind: 'User awaiting first sign-in', clientName: 'mw.newbie', dueDate: addDays(now, 7), link: `/master/generals/usermanagement/user/view/${ids['mw.newbie']}` });
    expect(access.data.find((i) => i.ref === 'mw.sales')).toBeUndefined();
    const systems = await items('admin', 'category=systems&pageSize=50');
    expect(systems.data.find((i) => i.ref === 'my-work-reminders')).toMatchObject({ kind: 'Failed scheduled job', priority: 'high', dueDate: now, link: '/master/configuration/schedules' });
    expect(systems.data.find((i) => i.ref === '+639170000001')).toMatchObject({ kind: 'Failed integration message', title: 'Home SMS gateway - sms.send', nextAction: 'Resend or cancel the message: Gateway timed out' });
    // Accounting reads the schedules but does not run them: no system health for them
    const acct = await as('mw.acct', 'get', '/my-work/summary');
    expect(acct.body.data.categories.map((c) => c.code)).not.toContain('systems');
    expect(acct.body.data.categories.map((c) => c.code)).not.toContain('access');
  });

  it('a user limited to their own book gets nothing from the sources that are not part of a book', async () => {
    const r = await ctx.api('post', '/roles').send({ code: 'mw-home-own', name: 'Own book compliance (test)', permissions: ['read:compliance', 'read:privacy', 'read:profile'] });
    expect(r.status).toBe(201);
    await makeUser('mw.scoped', ['mw-home-own']);
    await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': ['mw-home-own'] } });
    expect((await items('mw.scoped', 'scope=all&category=compliance,breaches&pageSize=50')).total).toBe(0);
    await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': [] } });
    expect((await items('mw.scoped', 'scope=all&category=compliance,breaches&pageSize=50')).total).toBeGreaterThan(0);
  });
});

describe('role figures (GET /my-work/figures)', () => {
  it('picks the most specific preset of the roles a user holds', () => {
    expect(presetOf({ roles: ['sales'] })).toBe('sales');
    expect(presetOf({ roles: ['accounting', 'accounting-manager'] })).toBe('accounting-manager');
    expect(presetOf({ roles: ['operations', 'compliance-officer'] })).toBe('compliance-officer');
    expect(presetOf({ roles: ['mw-home-own'] })).toBe('general');
    expect(PRESETS[0]).toBe('system-admin');
  });

  it('sales: quotes this month, conversion and renewals due over the user\'s own book', async () => {
    await query(`INSERT INTO quotes(id, quote_number, client_id, agent_user_id, status, premium_total, valid_until, created_by)
      VALUES ('qt_home1', 'QT-HOME-0001', 'cl_home1', $1, 'converted', 12000, $2::date + 10, $1), ('qt_home2', 'QT-HOME-0002', 'cl_home1', $1, 'sent', 8000, $2::date + 10, $1)`, [ids['mw.sales'], now]);
    await query(`INSERT INTO policies(id, policy_number, client_id, owner_user_id, status, inception_date, expiry_date, premium_total, insured_name, lob)
      VALUES ('pol_home1', 'POL-HOME-0001', 'cl_home1', $1, 'active', $2::date - 350, $2::date + 15, 12000, 'Home Client', 'MOTOR')`, [ids['mw.sales'], now]);
    const f = await figures('mw.sales');
    expect(f).toMatchObject({ preset: 'sales', roleCode: 'sales', roleName: 'Sales & Marketing (Account Executive)', firstName: 'sales', company: expect.any(String), asOf: now });
    const by = Object.fromEntries(f.figures.map((x) => [x.key, x]));
    expect(by.quotesMonth).toMatchObject({ value: 2, format: 'count' });
    expect(by.conversion).toMatchObject({ value: 50, format: 'percent' });
    expect(by.renewals30).toMatchObject({ value: 1, format: 'count' });
  });

  it('claims, accounting manager, compliance officer and administrator figures', async () => {
    await query(`INSERT INTO claims(id, claim_number, policy_id, client_id, status, loss_date, reported_date, estimate_amount, handler_user_id)
      VALUES ('clm_home1', 'CLM-HOME-0001', 'pol_home1', 'cl_home1', 'in-review', $1::date - 12, $1::date - 10, 30000, $2)`, [now, ids['mw.claims']]);
    // the whole book (the sample seed adds claims): compare with the database
    const claims = Object.fromEntries((await figures('mw.claims')).figures.map((x) => [x.key, x.value]));
    const open = await one("SELECT count(*)::int AS n, round(avg($1::date - reported_date)) AS days FROM claims WHERE status IN ('registered', 'in-review', 'approved', 'pending-approval')", [now]);
    expect(open.n).toBeGreaterThanOrEqual(1);
    expect(claims).toMatchObject({ claimsOpen: open.n, daysOpen: Number(open.days) });
    expect(claims.claimsMonth).toBeGreaterThanOrEqual(1);

    await query(`INSERT INTO receivables(id, bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES ('rcv_home1', 'INV-HOME-0001', 'pol_home1', 'cl_home1', 12000, 4000, $1::date - 5, 'partial')`, [now]);
    await query(`INSERT INTO receipts(id, receipt_number, receivable_id, policy_id, client_id, amount, received_date, status) VALUES ('or_home1', 'OR-HOME-0001', 'rcv_home1', 'pol_home1', 'cl_home1', 8000, $1::date, 'posted')`, [now]);
    await query(`INSERT INTO journal_vouchers(id, jv_number, jv_date, description, status, total_debit, total_credit, created_by) VALUES ('jv_home1', 'JV-HOME-0001', $1, 'Accrual', 'for-approval', 500, 500, $2)`, [now, ids['mw.acct']]);
    const am = await figures('mw.acctmgr');
    expect(am.preset).toBe('accounting-manager');
    const amBy = Object.fromEntries(am.figures.map((x) => [x.key, x]));
    const money = await one(`SELECT (SELECT COALESCE(sum(balance), 0) FROM receivables WHERE status IN ('open', 'partial') AND due_date < $1::date) AS overdue,
      (SELECT COALESCE(sum(amount), 0) FROM receipts WHERE status = 'posted' AND received_date >= date_trunc('month', $1::date)::date) AS collected,
      (SELECT count(*)::int FROM journal_vouchers WHERE status = 'for-approval') + (SELECT count(*)::int FROM disbursements WHERE status = 'for-approval') AS vouchers`, [now]);
    expect(Number(money.overdue)).toBeGreaterThanOrEqual(4000);
    expect(amBy.overdueReceivables).toMatchObject({ value: Number(money.overdue), format: 'amount' });
    expect(amBy.collectedMonth).toMatchObject({ value: Number(money.collected), format: 'amount' });
    expect(amBy.vouchersForApproval).toMatchObject({ value: money.vouchers, format: 'count' });
    expect((await figures('mw.acct')).figures.map((x) => x.key)).toEqual(['overdueReceivables', 'collectedMonth']);

    const co = Object.fromEntries((await figures('mw.officer')).figures.map((x) => [x.key, x.value]));
    expect(co.deadlines30).toBeGreaterThanOrEqual(3);
    expect(co.eddOpen).toBeGreaterThanOrEqual(2);

    const admin = await figures('admin');
    expect(admin.preset).toBe('system-admin');
    const adminBy = Object.fromEntries(admin.figures.map((x) => [x.key, x.value]));
    expect(adminBy.activeUsers).toBeGreaterThanOrEqual(8);
    expect(adminBy.failedJobs24h).toBe(1);
    expect(adminBy.awaitingSignIn).toBeGreaterThanOrEqual(1);
  });
});
