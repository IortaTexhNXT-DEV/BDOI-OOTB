import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one, many } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { today, addDays } from '../src/lib/dates.js';
import { renewalNoticeRun, renewalNotices } from '../src/jobs/handlers.js';
import { dueStage, noticeSchedule } from '../src/modules/renewals/notices.js';
import { workingCalendar } from '../src/lib/workingCalendar.js';

let ctx;
let todayStr;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };

async function makeUser(username, roles, displayName = username) {
  expect((await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles })).status).toBe(201);
  ids[username] = (await one('SELECT id FROM users WHERE username = $1', [username])).id;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}
/** An active policy expiring in `days` days (product code), its client (with or without e-mail) and, optionally, a lock-in. */
async function policy(id, days, { product = 'MOTOR', email = true, lock = null } = {}) {
  await query('INSERT INTO clients(id, client_code, display_name, email) VALUES ($1, $2, $3, $4)', [`cl_${id}`, `CL-${id}`, `Client ${id}`, email ? `${id}@example.ph` : null]);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total, commission_amount)
    SELECT $1, $2, $3, (SELECT id FROM products WHERE code = $4), (SELECT id FROM insurance_companies WHERE code = 'MAPFRE'), $5, 'active', $6::date - 364, $6::date, 1000000, 30000, 4500`,
  [id, `POL-${id}`, `cl_${id}`, product, ids['rn.sales'], addDays(todayStr, days)]);
  if (lock) {
    await query(`INSERT INTO policy_lock_ins(policy_id, source, reference, start_date, years, end_date, tfs_loan_account, loan_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, lock.source, lock.reference || null, lock.start, lock.years || null, lock.end || null, lock.loan || `TFS-${id}`, lock.loanStatus || 'current']);
  }
}
const renewalOf = (policyId) => one('SELECT * FROM renewals WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1', [policyId]);
const noticesOf = async (policyId) => (await many('SELECT n.stage FROM renewal_notices n JOIN renewals r ON r.id = n.renewal_id WHERE r.policy_id = $1 ORDER BY n.stage', [policyId])).map((n) => n.stage);

beforeAll(async () => {
  ctx = await setup();
  todayStr = await today();
  // every day of the week works in this suite; the holiday case adds a holiday on today
  await setSetting('calendar.working_weekdays', [1, 2, 3, 4, 5, 6, 7]);
  await makeUser('rn.sales', ['tis-sales-associate'], 'Rina Santos');
  await policy('n90', 90);
  await policy('n85', 85);
  await policy('n55', 55);
  await policy('n25', 25);
  await policy('n120', 120);
  await policy('nnomail', 28, { email: false });
  await policy('cl30', 30, { product: 'CL-VOL' });
  await policy('cl14', 14, { product: 'CL-VOL' });
  await policy('lk60', 60, { lock: { source: 'promotion', reference: 'TOYOTA-3YR', start: addDays(todayStr, -305), years: 3, end: addDays(todayStr, 790) } });
  await policy('s2m', 30, { lock: { source: 'scheme2', start: addDays(todayStr, -700) } });
  await policy('s2c', 30, { lock: { source: 'scheme2', start: addDays(todayStr, -700), loanStatus: 'closed' } });
  await policy('hld', 30, { lock: { source: 'scheme1-ara', start: addDays(todayStr, -1000), years: 1, end: addDays(todayStr, -600), loanStatus: 'past-due' } });
  expect((await ctx.api('post', '/renewals/pipeline/refresh')).status).toBe(200);
});
afterAll(async () => { await sleep(100); await pool.end(); });

describe('working calendar', () => {
  it('skips weekends and national non-working holidays; a special working day works', async () => {
    await setSetting('calendar.working_weekdays', [1, 2, 3, 4, 5]);
    const cal = await workingCalendar('2026-12-20', '2027-01-05');
    expect(cal.isWorking('2026-12-26')).toBe(false); // Saturday
    expect(cal.isWorking('2026-12-25')).toBe(false); // Christmas Day (Regular Holiday of the seed)
    expect(cal.onOrAfter('2026-12-24')).toBe('2026-12-28'); // Christmas Eve (special non-working), Christmas, weekend
    expect(cal.add('2026-12-23', 2)).toBe('2026-12-29');
    expect(cal.between('2026-12-23', '2026-12-31')).toBe(2);
    await setSetting('calendar.working_weekdays', [1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('renewal notice schedule', () => {
  it('picks the latest mark reached and not yet sent, per line of business', async () => {
    const motor = await noticeSchedule('MOTOR');
    expect(motor.map((m) => m.daysBefore)).toEqual([30, 60, 90]);
    expect(dueStage(motor, 0, 91)).toBeNull();
    expect(dueStage(motor, 0, 90).stage).toBe(1);
    expect(dueStage(motor, 0, 55).stage).toBe(2);
    expect(dueStage(motor, 2, 55)).toBeNull();
    expect((await noticeSchedule('LIFE')).map((m) => m.daysBefore)).toEqual([15, 30]);
  });

  it('sends the notices due by e-mail, catches up a missed mark and withholds suppressed and held accounts', async () => {
    const r = await renewalNoticeRun();
    // the sample book has other renewals due too: the counts cover at least this suite's policies
    expect(r.sent).toBeGreaterThanOrEqual(8);
    expect(r.caughtUp).toBeGreaterThanOrEqual(2);
    expect(r.withheld).toBeGreaterThanOrEqual(3);
    expect(await noticesOf('n90')).toEqual([1]);
    expect(await noticesOf('n85')).toEqual([1]);
    expect(await noticesOf('n55')).toEqual([2]);
    expect(await noticesOf('n25')).toEqual([3]);
    expect(await noticesOf('cl30')).toEqual([1]);
    expect(await noticesOf('cl14')).toEqual([2]);
    expect(await noticesOf('s2c')).toEqual([3]);
    for (const p of ['lk60', 's2m', 'hld']) expect(await noticesOf(p)).toEqual([]);
    expect(await renewalOf('n120')).toBeNull();
    const mail = await one("SELECT * FROM email_outbox WHERE entity = 'renewal' AND entity_id = $1", [(await renewalOf('n55')).id]);
    expect(mail.to_address).toBe('n55@example.ph');
    expect(mail.subject).toContain('Second Notice');
    const s2m = await renewalOf('s2m');
    expect(s2m.notice_treatment).toBe('scheme2');
    const hld = await renewalOf('hld');
    expect(hld.notice_treatment).toBe('held');
    const owner = await one("SELECT link FROM notifications WHERE user_id = $1 AND entity = 'renewal' AND entity_id = $2", [ids['rn.sales'], (await renewalOf('n90')).id]);
    expect(owner.link).toBe(`/renewal/queue?renewal=${(await renewalOf('n90')).id}`);
  });

  it('tells the owner once when the client has no e-mail, and never sends twice', async () => {
    const nm = await renewalOf('nnomail');
    const told = await many("SELECT * FROM renewal_activities WHERE renewal_id = $1 AND activity_type = 'Notice not sent'", [nm.id]);
    expect(told).toHaveLength(1);
    const again = await renewalNoticeRun();
    expect(again.sent).toBe(0);
    expect(again.failed).toBe(1);
    expect(await many("SELECT * FROM renewal_activities WHERE renewal_id = $1 AND activity_type = 'Notice not sent'", [nm.id])).toHaveLength(1);
  });

  it('does not run on a public holiday', async () => {
    await query(`INSERT INTO master_records(type_code, code, name, data, status, created_by) VALUES ('holiday', 'TEST-TODAY', 'Test holiday',
      jsonb_build_object('code', 'TEST-TODAY', 'name', 'Test holiday', 'date', $1::text, 'holidayType', 'Special Non-working Day', 'scope', 'National'), 'active', 'test')`, [todayStr]);
    expect((await renewalNoticeRun()).skipped).toMatch(/not a working day/);
    await query("DELETE FROM master_records WHERE type_code = 'holiday' AND code = 'TEST-TODAY'");
  });

  it('opens one lock-in review task for the owner of a suppressed account on its review date', async () => {
    const lk = await renewalOf('lk60');
    const tasks = await many("SELECT * FROM work_tasks WHERE source_key = $1", [`lock-in:${lk.id}`]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ assigned_to: ids['rn.sales'], due_date: todayStr, status: 'open' });
    expect(tasks[0].title).toBe('Lock-in review: POL-lk60 (Client lk60)');
    const { syncAutoTasks } = await import('../src/modules/my-work/tasks.js');
    await syncAutoTasks();
    expect((await one('SELECT status FROM work_tasks WHERE id = $1', [tasks[0].id])).status).toBe('open');
  });
});

describe('notice treatment on the renewal screens and the manual paths', () => {
  it('shows the treatment and the lock-in term on the renewal', async () => {
    const lk = (await as('rn.sales', 'get', `/renewals/${(await renewalOf('lk60')).id}`)).body.data;
    expect(lk.noticeTreatment).toMatchObject({ code: 'lock-in', label: 'Suppressed: lock-in', until: addDays(todayStr, 790) });
    expect(lk.lockIn).toMatchObject({ source: 'promotion', sourceLabel: 'Promotion', reference: 'TOYOTA-3YR', year: 1, reviewDate: todayStr });
    const n = (await as('rn.sales', 'get', `/renewals/${(await renewalOf('n25')).id}`)).body.data;
    expect(n.noticeTreatment.code).toBe('send');
    expect(n.lockIn).toBeNull();
  });

  it('refuses a notice or an e-mail reminder by hand on a suppressed or held renewal', async () => {
    const s2m = await renewalOf('s2m');
    const send = await as('rn.sales', 'post', `/renewals/${s2m.id}/notices`).send({ method: 'Email' });
    expect(send.status).toBe(409);
    expect(send.body.message).toBe('Renewal notices of policy POL-s2m are suppressed: Scheme 2 Motor account with the loan still open');
    const lk = await renewalOf('lk60');
    const lkSend = await as('rn.sales', 'post', `/renewals/${lk.id}/notices`).send({ method: 'Email' });
    expect(lkSend.body.message).toMatch(/suppressed: The account is in a lock-in until \d{2}\/\d{2}\/\d{4}/);
    const hld = await renewalOf('hld');
    expect((await as('rn.sales', 'post', `/renewals/${hld.id}/reminders`).send({ method: 'Email' })).status).toBe(409);
    expect((await as('rn.sales', 'post', `/renewals/${hld.id}/reminders`).send({ method: 'Phone', note: 'Called the client' })).status).toBe(200);
  });

  it('skips suppressed and held policies of a renewal batch with the reason', async () => {
    await policy('b1', 70);
    await policy('b2', 70, { lock: { source: 'scheme2', start: addDays(todayStr, -400) } });
    const b = await as('rn.sales', 'post', '/policy-renewals/create-batches').send({ policies: ['POL-b1', 'POL-b2'] });
    expect(b.status).toBe(201);
    const batch = b.body.data;
    expect(batch.policies.find((p) => p.policy.policyNumber === 'POL-b2').noticeTreatment.code).toBe('scheme2');
    const q = await as('rn.sales', 'post', `/policy-renewals/batches/${batch.batchId}/send-notices`).send({ selectedPolicyIds: ['POL-b1', 'POL-b2'] });
    expect(q.body.data).toMatchObject({ queued: 1, skipped: 1 });
    for (let i = 0; i < 100; i += 1) {
      const j = await as('rn.sales', 'get', `/policy-renewals/queue/${q.body.data.jobId}`);
      if (['completed', 'failed'].includes(j.body.data.status)) break;
      await sleep(50);
    }
    const after = (await as('rn.sales', 'get', `/policy-renewals/batches/${batch.batchId}`)).body.data;
    expect(after.policies.find((p) => p.policy.policyNumber === 'POL-b1').noticeStatus).toBe('Sent');
    const skipped = after.policies.find((p) => p.policy.policyNumber === 'POL-b2');
    expect(skipped).toMatchObject({ noticeStatus: 'Skipped', error: 'Suppressed: Scheme 2: Scheme 2 Motor account with the loan still open' });
    expect(after.status).toBe('Completed');
    expect((await as('rn.sales', 'get', `/policy-renewals/batches/${batch.batchId}/notice-status`)).body.data).toMatchObject({ Sent: 1, Skipped: 1 });
  });
});

describe('lock-in accounts and the TFS loan status', () => {
  it('lists the lock-in and Scheme 2 accounts of the review window with the Excel extract', async () => {
    const r = await as('rn.sales', 'get', '/renewals/lock-ins');
    expect(r.status).toBe(200);
    const nums = r.body.data.items.map((x) => x.policyNumber);
    expect(nums).toEqual(expect.arrayContaining(['POL-lk60', 'POL-s2m', 'POL-s2c', 'POL-hld']));
    expect(nums).not.toContain('POL-n25');
    const hld = r.body.data.items.find((x) => x.policyNumber === 'POL-hld');
    expect(hld).toMatchObject({ loanStatus: 'past-due', loanStatusLabel: 'Past due', sourceLabel: 'Scheme 1 ARA' });
    expect(hld.noticeTreatment.code).toBe('held');
    const held = await as('rn.sales', 'get', '/renewals/lock-ins?treatment=held');
    expect(held.body.data.items.map((x) => x.policyNumber)).toContain('POL-hld');
    expect(held.body.data.items.map((x) => x.noticeTreatment.code)).toEqual(held.body.data.items.map(() => 'held'));
    const x = await as('rn.sales', 'get', '/renewals/lock-ins?format=excel').buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(x.headers['content-type']).toContain('spreadsheetml');
  });

  it('holds the notices on a blocking loan status (note required) and skips the queued ones', async () => {
    await policy('ls1', 40, { lock: { source: 'promotion', start: addDays(todayStr, -1000), years: 2, end: addDays(todayStr, -300) } });
    await ctx.api('post', '/renewals/pipeline/refresh');
    const b = (await as('rn.sales', 'post', '/policy-renewals/create-batches').send({ policies: ['POL-ls1'] })).body.data;
    await query("UPDATE renewal_batch_policies SET notice_status = 'Queued' WHERE batch_id = (SELECT id FROM renewal_batches WHERE batch_number = $1)", [b.batchId]);
    expect((await as('rn.sales', 'put', '/renewals/lock-ins/ls1/loan-status').send({ loanStatus: 'fraud' })).status).toBe(400);
    expect((await as('rn.sales', 'put', '/renewals/lock-ins/ls1/loan-status').send({ loanStatus: 'unknown', note: 'x' })).status).toBe(400);
    const u = await as('rn.sales', 'put', '/renewals/lock-ins/ls1/loan-status').send({ loanStatus: 'fraud', note: 'TFS fraud referral 02/10/2026' });
    expect(u.status).toBe(200);
    expect(u.body.data.skippedNotices).toBe(1);
    const line = await one("SELECT notice_status, error FROM renewal_batch_policies WHERE policy_id = 'ls1'");
    expect(line).toMatchObject({ notice_status: 'Skipped', error: 'Held: loan status: the TFS loan is fraud' });
    const rn = (await as('rn.sales', 'get', `/renewals/${(await renewalOf('ls1')).id}`)).body.data;
    expect(rn.noticeTreatment.code).toBe('held');
    expect(rn.activities.some((a) => a.type === 'Loan status' && a.by === 'Rina Santos')).toBe(true);
    expect((await as('rn.sales', 'put', '/renewals/lock-ins/n25/loan-status').send({ loanStatus: 'current' })).status).toBe(404);
    const back = await as('rn.sales', 'put', '/renewals/lock-ins/ls1/loan-status').send({ loanStatus: 'current' });
    expect(back.status).toBe(200);
    expect((await as('rn.sales', 'get', `/renewals/${(await renewalOf('ls1')).id}`)).body.data.noticeTreatment.code).toBe('send');
  });

  it('gives no staff reminder to a suppressed account and titles a held one', async () => {
    await setSetting('limits.renewal_notice_days', [30]);
    const r = await renewalNotices();
    expect(r.suppressed).toBeGreaterThanOrEqual(1);
    const titles = async (pid) => (await many("SELECT title FROM notifications WHERE entity = 'policy' AND entity_id = $1", [pid])).map((n) => n.title);
    expect(await titles('s2m')).toEqual([]);
    expect(await titles('hld')).toEqual(['Renewal due in 30 days - notices held (Past due)']);
    expect(await titles('n25')).toEqual([]);
    expect(await titles('s2c')).toEqual(['Renewal due in 30 days']);
  });

  it('carries the lock-in to the renewal term', async () => {
    await query("INSERT INTO authority_limits(transaction_type, role_code, max_amount, status, decided_at) VALUES ('renewal_terms', 'system-admin', NULL, 'active', now())");
    const lk = await renewalOf('lk60');
    await as('rn.sales', 'post', `/renewals/${lk.id}/quote`);
    expect((await as('rn.sales', 'post', `/renewals/${lk.id}/submit`).send({})).status).toBe(200);
    expect((await ctx.api('post', `/renewals/${lk.id}/approve`).send({ decision: 'approve' })).status).toBe(200);
    const c = await as('rn.sales', 'post', `/renewals/${lk.id}/complete`).send({});
    expect(c.status).toBe(200);
    const carried = await one('SELECT source, reference, end_date, tfs_loan_account FROM policy_lock_ins WHERE policy_id = $1', [c.body.data.newPolicy.id]);
    expect(carried).toMatchObject({ source: 'promotion', reference: 'TOYOTA-3YR', end_date: addDays(todayStr, 790), tfs_loan_account: 'TFS-lk60' });
  });
});
