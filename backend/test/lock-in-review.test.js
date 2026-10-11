import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one, many } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { today, addDays } from '../src/lib/dates.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { lockInReview } from '../src/modules/lock-in/review.js';
import { runNoticeSchedule } from '../src/modules/renewals/notices.js';

// TIS-BRD-SCHM-03 (FRS SCHM-03) remaining parts: TFS loan status upload and manual status, notices held, 60-day Lock-in
// Review with maker-checker, Change lock-in with approval; TIS-BRD-RPT-SLS-05 Lock-in / Scheme 2 expiry report.
let ctx;
let now;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };

async function makeUser(username, roles) {
  expect((await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles })).status).toBe(201);
  ids[username] = (await one('SELECT id FROM users WHERE username = $1', [username])).id;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}
/** An active policy expiring in `days` days with its lock-in. */
async function policy(id, days, lock) {
  await query('INSERT INTO clients(id, client_code, display_name, email) VALUES ($1, $2, $3, $4)', [`cl_${id}`, `CL-${id}`, `Client ${id}`, `${id}@example.ph`]);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total, commission_amount)
    SELECT $1, $2, $3, (SELECT id FROM products WHERE code = 'MOTOR'), (SELECT id FROM insurance_companies WHERE code = 'MAPFRE'), $4, 'active', $5::date - 364, $5::date, 1000000, 30000, 4500`,
  [id, `POL-${id}`, `cl_${id}`, ids['lk.sales'], addDays(now, days)]);
  if (lock) {
    await query(`INSERT INTO policy_lock_ins(policy_id, source, reference, start_date, years, end_date, tfs_loan_account, loan_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, lock.source, lock.reference || null, lock.start, lock.years || null, lock.end || null, lock.loan || null, lock.loanStatus || 'current']);
  }
}
const statusFile = (rows) => writeXlsx({ sheets: [{ name: 'Data', columns: ['LOAN_ACCOUNT_NO', 'LOAN_STATUS', 'STATUS_DATE', 'DAYS_PAST_DUE', 'SCHEME', 'REMARKS'].map((header) => ({ header })), rows }] });
const dmy = (d) => d.split('-').reverse().join('/');
const reviewOf = (policyId) => one('SELECT * FROM lock_in_reviews WHERE policy_id = $1', [policyId]);

beforeAll(async () => {
  ctx = await setup();
  now = await today();
  await setSetting('calendar.working_weekdays', [1, 2, 3, 4, 5, 6, 7]);
  await makeUser('lk.sales', ['tis-sales-officer']);
  await makeUser('lk.ops', ['operations']);
  await makeUser('lk.head', ['tis-sales-unit-head']);
  await makeUser('lk.claims', ['claims']);
  // S1 ARA in year 2 of 5, S2 in year 2, an ARA whose lock-in ends with this term, a promotion not touched by the loan file
  await policy('lka', 30, { source: 'scheme1-ara', reference: 'S1-STD-2024', start: addDays(now, -700), years: 5, end: addDays(now, 1125), loan: '8003000001' });
  await policy('lkb', 25, { source: 'scheme2', reference: 'S2-STD-2025', start: addDays(now, -340), years: 3, end: addDays(now, 750), loan: '8003000002' });
  await policy('lkc', 20, { source: 'scheme1-ara', reference: 'S1-STD-2022', start: addDays(now, -1440), years: 4, end: addDays(now, 20), loan: '8003000003' });
  await policy('lkd', 40, { source: 'scheme1-ara', reference: 'S1-STD-2025', start: addDays(now, -320), years: 5, end: addDays(now, 1500), loan: '8003000004' });
  await policy('lke', 200, null);
  expect((await ctx.api('post', '/renewals/pipeline/refresh')).status).toBe(200);
});
afterAll(async () => { await pool.end(); });

describe('TFS loan status (FR-LCK-020 to 023)', () => {
  it('uploads the TFS file row by row: a blocking status holds the notices, a newer date wins, errors per row', async () => {
    const file = statusFile([
      ['8003000004', 'PAST DUE', dmy(now), '32', 'SCHEME 1', 'Two amortisations unpaid'],
      ['8003000002', 'CURRENT', dmy(now), '', 'SCHEME 1', ''],
      ['8003000001', 'CURRENT', dmy(addDays(now, -1)), '', '', ''],
      ['8003999999', 'CURRENT', dmy(now), '', '', ''],
      ['12', 'CURRENT', dmy(now), '', '', ''],
      ['8003000001', 'ON VACATION', dmy(now), '', '', ''],
      ['8003000001', 'CURRENT', dmy(addDays(now, 2)), '', '', ''],
    ]);
    const r = await as('lk.ops', 'post', '/lock-in/uploads').attach('file', file, 'tfs-status.xlsx');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Processed 7 rows: 3 loaded, 4 failed');
    expect(r.body.data.errors.map((e) => e.message)).toEqual([
      'Row 5: no policy is linked to loan account 8003999999', 'Row 6: loan account 12 must have 10 digits',
      'Row 7: loan status ON VACATION is not a known TFS status', 'Row 8: the status date cannot be in the future']);
    expect(r.body.data.warnings.map((w) => w.message)).toEqual(['Row 3: the file says SCHEME 1 but the lock-in of loan 8003000002 is scheme2']);
    const lkd = await one('SELECT loan_status, days_past_due, loan_status_batch_id FROM policy_lock_ins WHERE policy_id = $1', ['lkd']);
    expect(lkd).toMatchObject({ loan_status: 'past-due', days_past_due: 32 });
    const ren = await one('SELECT id, notice_treatment FROM renewals WHERE policy_id = $1', ['lkd']);
    expect(ren.notice_treatment).toBe('held');
    expect((await many('SELECT activity_type FROM renewal_activities WHERE renewal_id = $1', [ren.id])).map((a) => a.activity_type)).toContain('Notices withheld');
    expect((await one("SELECT count(*)::int AS n FROM work_tasks WHERE source_key LIKE 'loan-held:lkd:%'")).n).toBe(1);
    // an older status date does not overwrite
    const older = await as('lk.ops', 'post', '/lock-in/uploads').attach('file', statusFile([['8003000004', 'CURRENT', dmy(addDays(now, -5)), '', '', '']]), 'older.xlsx');
    expect(older.body.data.notChangedRows[0].message).toContain('is newer)');
    expect((await one('SELECT loan_status FROM policy_lock_ins WHERE policy_id = $1', ['lkd'])).loan_status).toBe('past-due');
    // .csv, missing columns, no permission
    expect((await as('lk.ops', 'post', '/lock-in/uploads').attach('file', Buffer.from('a'), 'x.csv')).body.message).toBe('Upload an Excel (.xlsx) file');
    const nocol = writeXlsx({ sheets: [{ name: 'Data', columns: [{ header: 'LOAN_ACCOUNT_NO' }], rows: [['8003000001']] }] });
    expect((await as('lk.ops', 'post', '/lock-in/uploads').attach('file', nocol, 'x.xlsx')).body.message).toBe('The file must have the columns LOAN_ACCOUNT_NO, LOAN_STATUS and STATUS_DATE');
    expect((await as('lk.sales', 'post', '/lock-in/uploads').attach('file', file, 'x.xlsx')).status).toBe(403);
    const list = (await as('lk.ops', 'get', '/lock-in/uploads')).body.data;
    expect(list.length).toBeGreaterThan(1);
    expect((await as('lk.ops', 'get', '/lock-in/uploads/template')).status).toBe(200);
  });

  it('a manual status needs a 10-character remark and is kept against the TFS file (FR-LCK-021)', async () => {
    expect((await as('lk.ops', 'put', '/lock-in/policies/lkb/loan-status').send({ loanStatus: 'fraud', remark: 'short' })).body.message)
      .toBe('Enter the reason for the loan status (at least 10 characters)');
    expect((await as('lk.ops', 'put', '/lock-in/policies/lkb/loan-status').send({ loanStatus: 'fraud', remark: 'Fraud case reported by TFS', statusDate: addDays(now, 1) })).body.message)
      .toBe('The status date cannot be in the future');
    const r = await as('lk.ops', 'put', '/lock-in/policies/lkb/loan-status').send({ loanStatus: 'fraud', remark: 'Fraud case FC-2026-014 reported by TFS Legal' });
    expect(r.body.message).toBe('Loan status of 8003000002 set to Fraud; notices are held');
    const up = await as('lk.ops', 'post', '/lock-in/uploads').attach('file', statusFile([['8003000002', 'CURRENT', dmy(now), '', 'SCHEME 2', '']]), 'tfs.xlsx');
    expect(up.body.data.notChangedRows[0].message).toContain('Not changed (manual status)');
    const panel = (await as('lk.sales', 'get', '/lock-in/policies/lkb')).body.data;
    expect(panel).toMatchObject({ loanStatus: 'fraud', loanStatusManual: true });
  });
});

describe('Lock-in Review (FR-LCK-030 to 041)', () => {
  let job;
  it('the daily job raises a review item 60 days before expiry, a Lock-in ends item, a task, and the expiry report', async () => {
    job = await lockInReview({ date: now });
    expect(job.reviewItems).toBeGreaterThanOrEqual(3);
    expect(job.lockinEnds).toBeGreaterThanOrEqual(1);
    expect((await reviewOf('lkc')).status).toBe('lockin-ends');
    expect((await reviewOf('lka')).status).toBe('review-due');
    expect((await one("SELECT count(*)::int AS n FROM work_tasks WHERE entity = 'lock-in-review' AND assigned_to = $1", [ids['lk.sales']])).n).toBeGreaterThan(0);
    expect(job.report?.error).toBeUndefined();
    // run again: nothing raised twice
    expect((await lockInReview({ date: now, report: false })).reviewItems).toBe(0);
    // the renewal notices job raises no second review task for the same account (FR-LCK-014)
    await runNoticeSchedule();
    const rv = await reviewOf('lka');
    const tasks = await one(`SELECT count(*)::int AS n FROM work_tasks WHERE status = 'open' AND ((entity = 'lock-in-review' AND entity_id = $1)
      OR source_key = 'lock-in:' || (SELECT id FROM renewals WHERE policy_id = 'lka' ORDER BY created_at DESC LIMIT 1))`, [rv.id]);
    expect(tasks.n).toBe(1);
    const tabs = (await as('lk.sales', 'get', '/lock-in/reviews?tab=due')).body;
    expect(tabs.data.items.map((a) => a.policyNumber)).toEqual(expect.arrayContaining(['POL-lka', 'POL-lkb', 'POL-lkd']));
    const a = tabs.data.items.find((x) => x.policyNumber === 'POL-lka');
    expect(a).toMatchObject({ source: 'scheme1-ara', year: 2, years: 5, loanAccount: '8003000001', reviewStatus: 'review-due' });
    expect((await as('lk.sales', 'get', '/lock-in/reviews?tab=due&daysTo=999')).body.message).toBe('Days to expiry can be at most 365');
    expect((await as('lk.claims', 'get', '/lock-in/reviews')).status).toBe(403);
  });

  it('renew is refused while the loan blocks; hold needs a re-review date within the limit (MSG-LCK-031, 032)', async () => {
    const d = (await reviewOf('lkd')).id;
    let r = await as('lk.sales', 'post', `/lock-in/reviews/${d}/decision`).send({ decision: 'renew', reasonCode: 'LKR-CONFIRMED', remark: 'Client confirmed the renewal' });
    expect(r.body.message).toBe('The TFS loan is Past due; choose Hold, Release or Not for renewal');
    r = await as('lk.sales', 'post', `/lock-in/reviews/${d}/decision`).send({ decision: 'hold', reasonCode: 'LKH-PAST-DUE', remark: 'short' });
    expect(r.body.message).toBe('Enter a remark of at least 10 characters');
    r = await as('lk.sales', 'post', `/lock-in/reviews/${d}/decision`).send({ decision: 'hold', remark: 'Awaiting the TFS collection update' });
    expect(r.body.message).toBe('Select the reason');
    r = await as('lk.sales', 'post', `/lock-in/reviews/${d}/decision`).send({ decision: 'hold', reasonCode: 'LKH-PAST-DUE', remark: 'Awaiting the TFS collection update', reReviewDate: addDays(now, 45) });
    expect(r.body.message).toContain('The re-review date must be within 30 days');
    r = await as('lk.sales', 'post', `/lock-in/reviews/${d}/decision`).send({ decision: 'hold', reasonCode: 'LKH-PAST-DUE', remark: 'Awaiting the TFS collection update', reReviewDate: addDays(now, 7) });
    expect(r.body).toMatchObject({ message: 'Decision saved: Hold', status: 'on-hold' });
    // the hold comes back on its re-review date
    expect((await lockInReview({ date: addDays(now, 7), report: false })).holdsDue).toBe(1);
    expect((await reviewOf('lkd')).status).toBe('review-due');
  });

  it('renew under lock-in keeps the notices suppressed', async () => {
    const id = (await reviewOf('lka')).id;
    const r = await as('lk.sales', 'post', `/lock-in/reviews/${id}/decision`).send({ decision: 'renew', reasonCode: 'LKR-CONFIRMED', remark: 'ARA in force, client informed' });
    expect(r.body).toMatchObject({ message: 'Decision saved: Renew under lock-in', status: 'renew' });
    expect((await one("SELECT notice_treatment FROM renewals WHERE policy_id = 'lka'")).notice_treatment).not.toBe('send');
  });

  it('release needs another user to approve; then the lock-in is released and notices resume (maker-checker)', async () => {
    const id = (await reviewOf('lkd')).id;
    let r = await as('lk.sales', 'post', `/lock-in/reviews/${id}/decision`).send({ decision: 'release', reasonCode: 'LKL-CLIENT', remark: 'Client will pay the renewal directly' });
    expect(r.body).toMatchObject({ message: 'Decision sent for approval: Release to standard renewal', status: 'pending-approval' });
    expect((await as('lk.sales', 'post', `/lock-in/reviews/${id}/approve`).send({})).status).toBe(403);
    // the maker who holds approve:lock-in still cannot approve their own decision
    await query("UPDATE lock_in_reviews SET decided_by = $2 WHERE id = $1", [id, ids['lk.head']]);
    expect((await as('lk.head', 'post', `/lock-in/reviews/${id}/approve`).send({})).body.message).toBe('You recorded this decision; another user must approve it');
    await query("UPDATE lock_in_reviews SET decided_by = $2 WHERE id = $1", [id, ids['lk.sales']]);
    expect((await as('lk.head', 'post', `/lock-in/reviews/${id}/return`).send({})).body.message).toBe('Enter the reason for returning the decision');
    r = await as('lk.head', 'post', `/lock-in/reviews/${id}/return`).send({ note: 'Check with TFS first' });
    expect(r.body.message).toBe('Decision returned to lk.sales');
    expect((await reviewOf('lkd')).status).toBe('returned');
    await as('lk.sales', 'post', `/lock-in/reviews/${id}/decision`).send({ decision: 'release', reasonCode: 'LKL-CLIENT', remark: 'TFS confirmed, client pays directly' });
    r = await as('lk.head', 'post', `/lock-in/reviews/${id}/approve`).send({ note: 'Agreed' });
    expect(r.body.message).toBe('Decision approved: Release to standard renewal');
    expect((await one("SELECT status FROM policy_lock_ins WHERE policy_id = 'lkd'")).status).toBe('released');
    expect((await one("SELECT notice_treatment FROM renewals WHERE policy_id = 'lkd'")).notice_treatment).toBe('send');
  });

  it('not for renewal lapses the open renewal once approved', async () => {
    const id = (await reviewOf('lkb')).id;
    await as('lk.sales', 'post', `/lock-in/reviews/${id}/decision`).send({ decision: 'not-renewed', reasonCode: 'LKN-FRAUD', remark: 'Fraud confirmed by TFS Legal' });
    expect((await as('lk.head', 'post', `/lock-in/reviews/${id}/approve`).send({})).status).toBe(200);
    expect((await one("SELECT status FROM renewals WHERE policy_id = 'lkb'")).status).toBe('lapsed');
    expect((await one("SELECT status FROM policy_lock_ins WHERE policy_id = 'lkb'")).status).toBe('not-renewed');
  });

  it('exports the Lock-in / Scheme 2 expiry report (TIS-BRD-RPT-SLS-05)', async () => {
    const x = await as('lk.sales', 'get', '/lock-in/reviews/export?tab=in-lock-in').buffer(true)
      .parse((res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(x.status).toBe(200);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    const def = await one("SELECT code FROM report_definitions WHERE code = 'lock-in-expiry'");
    expect(def).toBeTruthy();
  });
});

describe('Change lock-in with approval (FR-LCK-002)', () => {
  it('adds a lock-in to a policy without one, applied only when another user approves', async () => {
    let r = await as('lk.sales', 'post', '/lock-in/policies/lke/changes').send({ action: 'add', source: 'scheme1-ara', reference: 'S1-STD-2025', startDate: addDays(now, -165), years: 3 });
    expect(r.body.message).toBe('Enter the reason for the change');
    r = await as('lk.sales', 'post', '/lock-in/policies/lke/changes').send({ action: 'add', source: 'scheme1-ara', startDate: addDays(now, -165), years: 3, tfsLoanAccount: '123', remark: 'Go-live ARA' });
    expect(r.body.message).toBe('The TFS loan account must have 10 digits');
    r = await as('lk.sales', 'post', '/lock-in/policies/lke/changes').send({ action: 'add', source: 'scheme1-ara', reference: 'S1-STD-2025', startDate: addDays(now, -165), years: 3,
      tfsLoanAccount: '8003000005', remark: 'ARA signed before go-live' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const changeId = r.body.data.id;
    expect(r.body.data.preview.treatment).toBeTruthy();
    expect((await as('lk.sales', 'post', '/lock-in/policies/lke/changes').send({ action: 'add', source: 'scheme2', startDate: now, years: 1, remark: 'again' })).body.message)
      .toBe('A lock-in change for POL-lke is already waiting for approval');
    expect(await one("SELECT 1 FROM policy_lock_ins WHERE policy_id = 'lke'")).toBeNull();
    expect((await as('lk.sales', 'post', `/lock-in/changes/${changeId}/approve`).send({})).status).toBe(403);
    r = await as('lk.head', 'post', `/lock-in/changes/${changeId}/approve`).send({ note: 'ARA deed checked' });
    expect(r.body.message).toBe('Lock-in change approved');
    const lk = await one("SELECT source, years, end_date::text AS e, tfs_loan_account FROM policy_lock_ins WHERE policy_id = 'lke'");
    expect(lk).toMatchObject({ source: 'scheme1-ara', years: 3, tfs_loan_account: '8003000005' });
  });

  it('ends a lock-in with a reason of lockin_end', async () => {
    let r = await as('lk.sales', 'post', '/lock-in/policies/lke/changes').send({ action: 'end', remark: 'Vehicle sold to a new owner' });
    expect(r.status).toBe(400);
    r = await as('lk.sales', 'post', '/lock-in/policies/lke/changes').send({ action: 'end', reasonCode: 'LKE-SOLD', remark: 'Vehicle sold to a new owner' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await as('lk.head', 'post', `/lock-in/changes/${r.body.data.id}/return`).send({})).body.message).toBe('Enter the reason for returning the change');
    expect((await as('lk.head', 'post', `/lock-in/changes/${r.body.data.id}/approve`).send({})).status).toBe(200);
    expect((await one("SELECT status, ended_reason FROM policy_lock_ins WHERE policy_id = 'lke'"))).toMatchObject({ status: 'ended' });
  });
});
