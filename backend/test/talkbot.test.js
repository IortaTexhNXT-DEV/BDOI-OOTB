/**
 * Talkbot call lists and the renewal filter (FRS LEAD-09): the call list and its eligibility rules, the Contact Import
 * file, Mark as sent, the call records upload with the outcome rules, manual outcomes, the renewal timeline, the renewal
 * batch of the confirmed accounts, Generate Renewal Quotes limited to Talkbot-confirmed Motor policies, the Renewal
 * Queue filter, the daily jobs and the access of the TISPH personas.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withoutCommissionTaxes } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { deriveLine, rulesOf } from '../src/modules/talkbot/outcomes.js';
import { carModelOf, closeOldLists, defaultWindow, emailHints, mobileOf, taskNameOf } from '../src/modules/talkbot/service.js';
import { parseCallTime } from '../src/modules/talkbot/results.js';

const PASSWORD = 'Welcome@123';
let ctx;
let day;
/** The panel insurer of the test policies: the criteria name it, so the sample policies stay out. */
let insurerId;
const as = {};
const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
const setting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** Call Time of a call made yesterday (or `days` ago). */
const callAt = (time, days = 1) => `${dmy(addDays(day, -days))} ${time}`;

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName: username, roles, email: `${username}@example.ph` });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = await loginAs(ctx.app, username, PASSWORD);
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

const HEADERS = ['Task Name', 'Contact ID', 'Call ID', 'Contact Name', 'Contact Number', 'Result', 'Call Time', 'Call Duration', 'Tags', 'Call Drop-off Point', 'Call Status', 'Call Result', 'Date of Callback', 'Campaign'];
/** A Call Records workbook: rows [taskName, contactId, callId, number, result, callTime, status, callResult, callback, dropOff]. */
const callRecords = (rows, headers = HEADERS) => writeXlsx({ sheets: [{ name: 'Call Records', columns: headers.map((h) => ({ header: h })),
  rows: rows.map(([task, id, callId, number, result, time, status = '', callResult = '', callback = '', drop = '']) => {
    const v = { 'Task Name': task, 'Contact ID': id, 'Call ID': callId, 'Contact Name': 'X', 'Contact Number': number, Result: result, 'Call Time': time, 'Call Duration': '30',
      Tags: '', 'Call Drop-off Point': drop, 'Call Status': status, 'Call Result': callResult, 'Date of Callback': callback, Campaign: 'ignored' };
    return headers.map((h) => v[h] ?? '');
  }) }] });
const upload = (who, list, buffer, name = 'CallRecords.xlsx', confirm = false) => {
  const r = as[who]('post', `/talkbot/lists/${list}/results`).attach('file', buffer, name);
  return confirm ? r.field('confirmTaskName', 'true') : r;
};

beforeAll(async () => {
  ctx = await setup();
  await withoutCommissionTaxes();
  as.admin = ctx.api;
  day = await today();
  await persona('tb.sales', ['tis-sales-associate']);
  await persona('tb.ops', ['tis-ops-associate']);
  await persona('tb.pdu', ['tis-ccd-pdu']);
  await persona('tb.it', ['tis-it-admin']);
  const e = (n) => addDays(day, n);
  insurerId = (await one("INSERT INTO insurance_companies(code, name) VALUES ('TBTEST', 'Talkbot Test Insurance Corp.') RETURNING id")).id;
  await query(`INSERT INTO clients(id, client_code, display_name, email, phone) VALUES
    ('cl_tb1','CL-TB-1','Andrea M. Villanueva','andrea.villanueva@gmail.com','+639173047105'),
    ('cl_tb2','CL-TB-2','Dennis P. Navarro',NULL,'0918 222 3344'),
    ('cl_tb3','CL-TB-3','No Mobile Client','nomobile@example.ph','8812 3456'),
    ('cl_tb4','CL-TB-4','Do Not Call Client','dnc@example.ph','09190000004'),
    ('cl_tb5','CL-TB-5','Lock In Client','lock@example.ph','09190000005'),
    ('cl_tb6','CL-TB-6','Expired Client','exp@example.ph','09190000006'),
    ('cl_tb7','CL-TB-7','Fire Client','fire@example.ph','09190000007'),
    ('cl_tb8','CL-TB-8','Quoted Client','quoted@example.ph','09190000008')`);
  await query(`INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel, evidence) VALUES ('client','cl_tb4','marketing',false,'Phone','Asked not to be called')`);
  const motor = "(SELECT id FROM products WHERE code = 'MOTOR')";
  const pa = "(SELECT id FROM products WHERE code = 'PA')";
  const vehicle = JSON.stringify({ modelYear: '2023', vehicleBrand: 'Toyota', vehicleModel: 'Raize', modelVariant: '1.0 Turbo CVT' });
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total, details)
    SELECT v.id, v.num, v.client, v.product, (SELECT id FROM insurance_companies WHERE code = 'TBTEST'), (SELECT id FROM users WHERE username = 'tb.sales'), 'active',
           v.exp::date - 365, v.exp::date, v.si, 22000, v.details::jsonb
    FROM (VALUES ('pol_tb1','POL-TB-41187','cl_tb1',${motor},'${e(400)}',895860,'${vehicle}'),
                 ('pol_tb2','POL-TB-41188','cl_tb2',${motor},'${e(400)}',700000,'{}'),
                 ('pol_tb3','POL-TB-41189','cl_tb3',${motor},'${e(400)}',600000,'{}'),
                 ('pol_tb4','POL-TB-41190','cl_tb4',${motor},'${e(400)}',600000,'{}'),
                 ('pol_tb5','POL-TB-41191','cl_tb5',${motor},'${e(400)}',600000,'{"lockIn": true}'),
                 ('pol_tb6','POL-TB-41192','cl_tb6',${motor},'${e(-20)}',600000,'{}'),
                 ('pol_tb7','POL-TB-41193','cl_tb7',${pa},'${e(400)}',100000,'{}'),
                 ('pol_tb8','POL-TB-41194','cl_tb8',${motor},'${e(400)}',600000,'{}'),
                 ('pol_tb9','POL-TB-41195','cl_tb6',${motor},'${e(-130)}',600000,'{}')) AS v(id, num, client, product, exp, si, details)`);
  // a renewal already quoted: left out of call lists
  await query(`INSERT INTO renewals(renewal_number, policy_id, client_id, status, due_date, premium_old) VALUES ('RN-TB-0008','pol_tb8','cl_tb8','quoted','${e(400)}',22000)`);
});
afterAll(async () => { await sleep(200); await pool.end(); });

describe('Talkbot rules (pure)', () => {
  it('proposes the expiry dates of the list of the day, covering the days nobody works', async () => {
    expect(await defaultWindow('2026-10-07')).toEqual({ expiryFrom: '2026-10-10', expiryTo: '2026-10-10' });
    expect(await defaultWindow('2026-10-09')).toEqual({ expiryFrom: '2026-10-12', expiryTo: '2026-10-14' });
  });
  it('writes the mobile number, e-mail hints, vehicle and task name as Talkbot reads them', () => {
    expect(mobileOf('+639171234567')).toBe('09171234567');
    expect(mobileOf('0917 123 4567')).toBe('09171234567');
    expect(mobileOf('8812 3456')).toBeNull();
    expect(emailHints('andrea.villanueva@gmail.com')).toEqual({ first: 'a', last: 'a', domain: '@gmail.com' });
    expect(emailHints('')).toEqual({ first: '-', last: '-', domain: '-' });
    expect(carModelOf({ modelYear: '2024', vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelVariant: '1.3 XLE CVT' })).toBe('2024 TOYOTA Vios 1.3 XLE CVT');
    expect(taskNameOf('TIS_MV - MMM DD, YYYY', '2026-10-07')).toBe('TIS_MV - OCT 07, 2026');
  });
  it('derives one outcome per account from all its attempts (rank order)', () => {
    const rules = rulesOf(null);
    const at = (result, extra = {}) => ({ result, callTime: '2026-10-07T01:00:00Z', ...extra });
    const willing = deriveLine([at('Missed Call(19)'), at('Missed Call(19)'), at('Connected(200)', { callResult: 'Will Renew', dropOffPoint: 'Closing' })], rules);
    expect(willing).toMatchObject({ outcome: 'willing', detail: 'Will Renew (Closing)' });
    expect(deriveLine([at('Missed Call(19)'), at('Out of Service(5)'), at('Out of Service(5)')], rules).outcome).toBe('wrong-contact');
    expect(deriveLine([at('Missed Call(19)'), at('Connected(202)', { dropOffPoint: 'Greeting' })], rules).outcome).toBe('uncontacted');
    expect(deriveLine([at('Connected(200)', { callResult: 'Undecided', callbackDate: '2026-10-12' })], rules)).toMatchObject({ outcome: 'call-back', detail: 'Undecided, call back 12/10/2026' });
    expect(deriveLine([at('Connected(200)', { callResult: 'Will Renew', callStatus: 'Already Renewed' })], rules).outcome).toBe('already-renewed');
    // rank 7 applies only when no attempt connected
    expect(deriveLine([at('Invalid Number(1)'), at('Connected(200)')], rules).outcome).toBe('uncontacted');
    expect(deriveLine([], rules).outcome).toBe('not-called');
  });
  it('reads the call time in Manila time and refuses an impossible date', () => {
    expect(parseCallTime('07/10/2026 14:52:10', 'Asia/Manila').toISOString()).toBe('2026-10-07T06:52:10.000Z');
    expect(parseCallTime('31/09/2026 10:02:11', 'Asia/Manila')).toBeNull();
  });
});

describe('call list', () => {
  let list;
  const window = () => ({ expiryFrom: addDays(day, 400), expiryTo: addDays(day, 400), insurerId });
  it('refuses dates the wrong way round and criteria without any account', async () => {
    const r = await as['tb.sales']('post', '/talkbot/lists').send({ expiryFrom: addDays(day, 401), expiryTo: addDays(day, 400), insurerId });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Expiry Date To cannot be before Expiry Date From');
    const none = await as['tb.sales']('post', '/talkbot/lists').send({ expiryFrom: addDays(day, 900), expiryTo: addDays(day, 901), insurerId });
    expect(none.status).toBe(400);
    expect(none.body.message).toMatch(/^No Motor policy due for renewal matches these criteria/);
  });
  it('previews the accounts that can be called and those left out by reason', async () => {
    const p = await as['tb.sales']('post', '/talkbot/preview').send(window());
    expect(p.status, JSON.stringify(p.body)).toBe(200);
    expect(p.body.data.eligible).toBe(2);
    expect(p.body.data.excluded).toEqual({ 'No mobile number': 1, 'Do not call': 1, 'Lock-in or Scheme 2': 1, 'Renewal already being quoted': 1 });
    expect(p.body.data.leftOut).toMatch(/^4 accounts left out: /);
  });
  it('refuses more accounts than talkbot.max_accounts', async () => {
    await setting('talkbot.max_accounts', 1);
    const r = await as['tb.sales']('post', '/talkbot/lists').send(window());
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('The call list would hold 2 accounts; a call list can hold at most 1. Narrow the dates or choose an insurer.');
    await setting('talkbot.max_accounts', 2000);
  });
  it('creates the list in Draft with Motor policies only, expired renewable ones when asked', async () => {
    const r = await as['tb.sales']('post', '/talkbot/lists').send({ ...window(), expiryFrom: addDays(day, -140), includeExpired: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    list = r.body.data;
    expect(list.listNumber).toMatch(/^TCL-\d{4}-\d{5}$/);
    expect(r.body.message).toBe(`Call list ${list.listNumber} created with 3 accounts`);
    expect(list.status).toBe('draft');
    const numbers = list.lines.map((l) => l.policyNumber);
    // expired 20 days ago: in the grace period; 130 days ago: past the grace and lapsed window; the PA policy is not Motor
    expect(numbers).toEqual(['POL-TB-41192', 'POL-TB-41187', 'POL-TB-41188']);
    expect(list.lines[1]).toMatchObject({ mobile: '0917 *** 7105', outcome: 'not-called', vehicle: '2023 TOYOTA Raize 1.0 Turbo CVT' });
    const audit = await one("SELECT action FROM audit_log WHERE entity = 'talkbot_call_list' AND entity_id = $1", [list.id]);
    expect(audit.action).toBe('create');
  });
  it('leaves out a policy already on an open list', async () => {
    const p = await as['tb.sales']('post', '/talkbot/preview').send(window());
    expect(p.body.data.eligible).toBe(0);
    expect(p.body.data.excluded[`Already on call list ${list.listNumber}`]).toBe(2);
  });
  it('removes an account only with a reason and puts it back while Draft', async () => {
    const line = list.lines.find((l) => l.policyNumber === 'POL-TB-41192');
    const bad = await as['tb.sales']('post', `/talkbot/lists/${list.id}/lines/${line.id}/remove`).send({});
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('Enter the reason for removing this account from the call list');
    const ok = await as['tb.sales']('post', `/talkbot/lists/${list.id}/lines/${line.id}/remove`).send({ reasonCode: 'TBR-COMPLAINT' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data).toMatchObject({ lineStatus: 'removed', removedReason: 'Complaint in progress' });
    const back = await as['tb.sales']('post', `/talkbot/lists/${list.id}/lines/${line.id}/restore`);
    expect(back.body.data.lineStatus).toBe('active');
  });
  it('is marked as sent only once downloaded, with a task name', async () => {
    const early = await as['tb.sales']('post', `/talkbot/lists/${list.id}/send`).send({ taskName: 'TIS_MV - OCT 07, 2026' });
    expect(early.status).toBe(400);
    expect(early.body.message).toBe('Download the call list before you mark it as sent');
  });
  it('downloads the Contact Import file; a policy renewed meanwhile is dropped', async () => {
    await query("UPDATE policies SET status = 'renewed' WHERE id = 'pol_tb6'");
    const f = await binary(as['tb.sales']('post', `/talkbot/lists/${list.id}/download`));
    expect(f.status).toBe(200);
    expect(f.headers['content-disposition']).toContain(`${list.listNumber}_Contact_Import.xlsx`);
    const [sheet] = readWorkbook(f.body);
    expect(sheet.name).toBe('Contact Import');
    expect(sheet.rows[0][0]).toMatch(/Required headers are in red/);
    expect(sheet.rows[1]).toEqual(['Contact ID', 'Phone', 'Customer_PERSON_NAME', 'Expiration_DATE', 'Sum_Insured_AMOUNT', 'Premium_AMOUNT', 'First_letter', 'Last_letter',
      'Domain_EMAIL', 'CAR_MODEL', 'Name', 'Insurance Status']);
    expect(sheet.rows).toHaveLength(4);
    const andrea = sheet.rows.find((r) => r[0] === 'POL-TB-41187');
    expect(andrea.slice(0, 4)).toEqual(['POL-TB-41187', '09173047105', 'ANDREA M. VILLANUEVA', addDays(day, 400)]);
    expect(Number(andrea[4])).toBe(806274);
    expect(Number(andrea[5])).toBeGreaterThan(0);
    expect(andrea.slice(6, 12)).toEqual(['a', 'a', '@gmail.com', '2023 TOYOTA Raize 1.0 Turbo CVT', 'ANDREA M. VILLANUEVA', 'EXPIRING INSURANCE']);
    expect(sheet.rows.find((r) => r[0] === 'POL-TB-41188').slice(6, 9)).toEqual(['-', '-', '-']);
    const after = (await as['tb.sales']('get', `/talkbot/lists/${list.id}`)).body.data;
    expect(after.lastDownloadDropped).toEqual(['POL-TB-41192']);
    expect(after.lines.find((l) => l.policyNumber === 'POL-TB-41192')).toMatchObject({ lineStatus: 'removed', removedReason: 'No longer eligible: No longer renewable' });
    const audit = await one("SELECT after_data FROM audit_log WHERE entity = 'talkbot_call_list' AND action = 'download' AND entity_id = $1", [list.id]);
    expect(audit.after_data.rows).toBe(2);
  });
  it('refuses a blank or long task name, then sends the list', async () => {
    expect((await as['tb.sales']('post', `/talkbot/lists/${list.id}/send`).send({ taskName: ' ' })).body.message).toBe('Enter the Talkbot task name');
    expect((await as['tb.sales']('post', `/talkbot/lists/${list.id}/send`).send({ taskName: 'x'.repeat(101) })).status).toBe(400);
    const opt = (await as['tb.sales']('get', '/talkbot/options')).body.data;
    expect(opt.taskName).toMatch(/^TIS_MV - [A-Z]{3} \d{2}, \d{4}$/);
    const r = await as['tb.sales']('post', `/talkbot/lists/${list.id}/send`).send({ taskName: 'TIS_MV - OCT 07, 2026' });
    expect(r.status).toBe(200);
    expect(r.body.message).toBe(`Call list ${list.listNumber} marked as sent to Talkbot`);
    expect(r.body.data.status).toBe('sent');
    expect((await as['tb.sales']('post', `/talkbot/lists/${list.id}/lines/1/remove`).send({ reasonCode: 'TBR-COMPLAINT' })).status).toBe(409);
  });

  describe('results', () => {
    const task = 'TIS_MV - OCT 07, 2026';
    it('refuses a file that is not the Call Records export', async () => {
      const csv = await upload('tb.sales', list.id, Buffer.from('Task Name,Call ID\nx,1'), 'CallRecords.csv');
      expect(csv.status).toBe(400);
      expect(csv.body.message).toBe('Upload the Talkbot Call Records file as Excel (.xlsx)');
      const noCol = await upload('tb.sales', list.id, callRecords([[task, 'POL-TB-41187', 'C1', '09173047105', 'Missed Call(19)', callAt('10:00:00')]], HEADERS.filter((h) => h !== 'Call Result')));
      expect(noCol.status).toBe(400);
      expect(noCol.body.message).toBe('The file has no column Call Result. Upload the Call Records export of the Talkbot platform.');
    });
    it('asks before loading a file of another Talkbot task', async () => {
      const file = callRecords([['TIS_MV - AUG 27, 2026', 'POL-TB-41187', 'C0', '09173047105', 'Missed Call(19)', callAt('10:00:00')]]);
      const r = await upload('tb.sales', list.id, file);
      expect(r.status).toBe(409);
      expect(r.body.message).toBe(`The file is for Talkbot task TIS_MV - AUG 27, 2026 but the call list was sent as ${task}. Load it anyway?`);
      expect(await one('SELECT count(*)::int AS n FROM talkbot_call_attempts')).toEqual({ n: 0 });
    });
    it('loads the calls, matches them and derives the outcome of each account', async () => {
      const file = callRecords([
        [task, 'POL-TB-41187', 'C1', '09173047105', 'Missed Call(19)', callAt('10:00:00')],
        [task, 'POL-TB-41187', 'C2', '09173047105', 'Missed Call(19)', callAt('12:00:00')],
        [task, 'POL-TB-41187', 'C3', '09173047105', 'Connected(200)', callAt('14:52:10'), '', 'Will Renew', '', 'Closing'],
        [task, '', 'C4', '09182223344', 'Connected(200)', callAt('15:00:00'), '', 'Undecided', addDays(day, 2)],
        [task, 'POL-TB-40998', 'C5', '09999999999', 'Missed Call(19)', callAt('15:10:00')],
        [task, 'POL-TB-41188', 'C6', '09182223344', 'Missed Call(19)', '31/09/2026 10:02:11'],
      ]);
      const r = await upload('tb.sales', list.id, file);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.message).toBe('Processed 6 rows: 4 loaded, 2 failed');
      expect(r.body.data.errors.map((e) => e.message)).toEqual([`Row 6: Contact ID POL-TB-40998 is not on call list ${list.listNumber}`,
        'Row 7: Call Time 31/09/2026 10:02:11 is not a valid date and time']);
      expect(r.body.data.outcomeCounts).toEqual({ willing: 1, 'call-back': 1 });
      const l = (await as['tb.sales']('get', `/talkbot/lists/${list.id}`)).body.data;
      expect(l.status).toBe('results-loaded');
      expect(l.lines.find((x) => x.policyNumber === 'POL-TB-41187')).toMatchObject({ outcome: 'willing', outcomeDetail: 'Will Renew (Closing)', calls: 3 });
      expect(l.lines.find((x) => x.policyNumber === 'POL-TB-41188')).toMatchObject({ outcome: 'call-back', callbackDate: addDays(day, 2) });
      // the renewal timeline of the policy
      const act = await one(`SELECT a.description, a.method, a.next_action, a.follow_up_date FROM renewal_activities a JOIN renewals r ON r.id = a.renewal_id
        WHERE r.policy_id = 'pol_tb2' AND a.activity_type = 'Talkbot Call'`);
      expect(act).toMatchObject({ method: 'Phone', next_action: 'Call the client back', follow_up_date: addDays(day, 2) });
      const a1 = await one(`SELECT a.description, r.contact_attempts FROM renewal_activities a JOIN renewals r ON r.id = a.renewal_id WHERE r.policy_id = 'pol_tb1' AND a.activity_type = 'Talkbot Call'`);
      expect(a1).toEqual({ description: `Talkbot Call - Willing to renew - ${list.listNumber} (${task}), 3 attempts`, contact_attempts: 1 });
      const attempts = (await as['tb.sales']('get', `/talkbot/lists/${list.id}/lines/${l.lines.find((x) => x.policyNumber === 'POL-TB-41187').id}/attempts`)).body.data;
      expect(attempts.map((a) => a.callId)).toEqual(['C1', 'C2', 'C3']);
      expect(attempts[0].uploadNumber).toBe(1);
    });
    it('does not load a Call ID twice and adds no timeline entry when nothing changes', async () => {
      const again = await upload('tb.sales', list.id, callRecords([[task, 'POL-TB-41187', 'C1', '09173047105', 'Missed Call(19)', callAt('10:00:00')]]));
      expect(again.body.message).toBe('Processed 1 rows: 0 loaded, 1 failed');
      expect(again.body.data.errors[0].message).toBe('Row 2: Call ID C1 was already loaded');
      const n = await one("SELECT count(*)::int AS n FROM renewal_activities WHERE activity_type = 'Talkbot Call'");
      expect(n.n).toBe(2);
    });
    it('records an outcome by hand with a remark; a lower-ranked call does not override it', async () => {
      const l = (await as['tb.sales']('get', `/talkbot/lists/${list.id}`)).body.data;
      const dennis = l.lines.find((x) => x.policyNumber === 'POL-TB-41188');
      const noRemark = await as['tb.sales']('post', `/talkbot/lists/${list.id}/lines/${dennis.id}/outcome`).send({ outcome: 'not-willing' });
      expect(noRemark.status).toBe(400);
      expect(noRemark.body.message).toBe('Enter a remark for the outcome you record');
      expect((await as['tb.sales']('post', `/talkbot/lists/${list.id}/lines/${dennis.id}/outcome`).send({ outcome: 'not-called', remark: 'x' })).status).toBe(400);
      const r = await as['tb.sales']('post', `/talkbot/lists/${list.id}/lines/${dennis.id}/outcome`).send({ outcome: 'call-back', remark: 'Asked to be called on Monday' });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.message).toBe('Outcome recorded for policy POL-TB-41188');
      await upload('tb.sales', list.id, callRecords([[task, 'POL-TB-41188', 'C9', '09182223344', 'Missed Call(19)', callAt('10:00:00')]]));
      const after = (await as['tb.sales']('get', `/talkbot/lists/${list.id}`)).body.data.lines.find((x) => x.id === dennis.id);
      expect(after).toMatchObject({ outcome: 'call-back', manual: true, calls: 2 });
      const audit = await one("SELECT before_data, after_data FROM audit_log WHERE entity = 'talkbot_call_line' AND action = 'record-outcome'");
      expect(audit.before_data.outcome).toBe('call-back');
      expect(audit.after_data).toMatchObject({ outcome: 'call-back', source: 'manual' });
    });
    it('keeps the uploaded files with the list', async () => {
      const u = (await as['tb.sales']('get', `/talkbot/lists/${list.id}/uploads`)).body.data;
      expect(u.map((x) => x.uploadNumber)).toEqual([3, 2, 1]);
      const f = await binary(as['tb.sales']('get', `/talkbot/lists/${list.id}/uploads/${u[u.length - 1].id}/file`));
      expect(f.status).toBe(200);
    });
  });

  describe('renewal batch and bulk quoting', () => {
    let batch;
    it('creates a renewal batch from the confirmed accounts, once', async () => {
      const r = await as['tb.ops']('post', `/talkbot/lists/${list.id}/renewal-batches`);
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.data.batches).toHaveLength(1);
      batch = r.body.data.batches[0];
      expect(r.body.message).toBe(`Renewal batch ${batch.batchNumber} created with 1 policies`);
      const again = await as['tb.ops']('post', `/talkbot/lists/${list.id}/renewal-batches`);
      expect(again.status).toBe(400);
      expect(again.body.message).toBe('No Talkbot-confirmed account on this list is waiting for a renewal batch');
      const l = (await as['tb.ops']('get', `/talkbot/lists/${list.id}`)).body.data;
      expect(l.batchNumbers).toEqual([batch.batchNumber]);
      expect(l.lines.find((x) => x.policyNumber === 'POL-TB-41187')).toMatchObject({ batchNumber: batch.batchNumber, quoteStatus: 'in-batch' });
    });
    it('quotes only the Talkbot-confirmed Motor policies of a batch', async () => {
      const b = await ctx.api('post', '/policy-renewals/create-batches').send({ policies: [{ policyId: 'pol_tb1', isSelected: true }, { policyId: 'pol_tb2', isSelected: true },
        { policyId: 'pol_tb7', isSelected: true }] });
      expect(b.status, JSON.stringify(b.body)).toBe(201);
      const detail = (await ctx.api('get', `/policy-renewals/batches/${b.body.data.batchId}`)).body.data;
      expect(detail.policies.find((p) => p.policyId === 'pol_tb1')).toMatchObject({ talkbotOutcome: 'willing', talkbotConfirmedOn: expect.any(String) });
      const q = await ctx.api('post', `/policy-renewals/batches/${b.body.data.batchId}/generate-quotes`).send({ selectedPolicyIds: ['pol_tb1', 'pol_tb2', 'pol_tb7'] });
      expect(q.status, JSON.stringify(q.body)).toBe(200);
      expect(q.body.message).toBe('Renewal quotes queued: 2 policies, 1 skipped as not confirmed by Talkbot');
      const skipped = (await ctx.api('get', `/policy-renewals/batches/${b.body.data.batchId}`)).body.data.policies.find((p) => p.policyId === 'pol_tb2');
      expect(skipped).toMatchObject({ quoteStatus: 'Skipped', skipReason: 'Not confirmed by Talkbot' });
    });
    it('quotes every policy when talkbot.bulk_quote_filter is off', async () => {
      await setting('talkbot.bulk_quote_filter', false);
      const b = await ctx.api('post', '/policy-renewals/create-batches').send({ policies: [{ policyId: 'pol_tb2', isSelected: true }] });
      expect(b.status, JSON.stringify(b.body)).toBe(201);
      const q = await ctx.api('post', `/policy-renewals/batches/${b.body.data.batchId}/generate-quotes`).send({ selectedPolicyIds: ['pol_tb2'] });
      expect(q.body.message).toBe('Renewal quotes queued: 1 policies, 0 skipped as not confirmed by Talkbot');
      await setting('talkbot.bulk_quote_filter', true);
    });
    it('skips a confirmation older than talkbot.confirmation_valid_days', async () => {
      await query("UPDATE talkbot_call_lines SET outcome_at = now() - interval '40 days' WHERE policy_id = 'pol_tb1'");
      const s = await one("SELECT to_char((now() - interval '40 days') AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS d");
      const b = await ctx.api('post', '/policy-renewals/create-batches').send({ policies: [{ policyId: 'pol_tb1', isSelected: true }] });
      const q = await ctx.api('post', `/policy-renewals/batches/${b.body.data.batchId}/generate-quotes`).send({ selectedPolicyIds: ['pol_tb1'] });
      expect(q.body.data).toMatchObject({ queued: 0, skipped: 1, jobId: null });
      const p = (await ctx.api('get', `/policy-renewals/batches/${b.body.data.batchId}`)).body.data.policies[0];
      expect(p.skipReason).toBe(`Talkbot confirmation of ${dmy(s.d)} is older than 30 days`);
      await query("UPDATE talkbot_call_lines SET outcome_at = now() WHERE policy_id = 'pol_tb1'");
    });
    it('selects policies by Talkbot outcome on Create Batch Renewal', async () => {
      const r = await ctx.api('get', `/policy-renewals/renewable-policies?expiryFrom=${addDays(day, 400)}&expiryTo=${addDays(day, 400)}&talkbotOutcome=willing&talkbotCallList=${list.listNumber}`);
      expect(r.body.data.map((p) => p.policyNumber)).toEqual(['POL-TB-41187']);
      const o = (await ctx.api('get', '/policy-renewals/options')).body.data;
      expect(o.talkbot).toMatchObject({ bulkQuoteFilter: true, defaultOutcome: 'willing' });
    });
  });

  it('shows the Talkbot outcome on Renewal Queue only to a user who may see it', async () => {
    const r = await as['tb.sales']('get', '/renewals/queue?talkbotOutcome=call-back');
    expect(r.status).toBe(200);
    expect(r.body.data.map((x) => x.policyNumber)).toEqual(['POL-TB-41188']);
    expect(r.body.data[0].talkbot).toMatchObject({ outcome: 'call-back', listNumber: list.listNumber });
    const admin = await ctx.api('post', '/roles').send({ code: 'renewals-only', name: 'Renewals only (test)', permissions: ['read:renewals', 'read:profile'] });
    expect(admin.status).toBe(201);
    await ctx.api('post', '/users').send({ username: 'tb.renewals', password: PASSWORD, displayName: 'tb.renewals', roles: ['renewals-only'], email: 'tb.renewals@example.ph' });
    const token = await loginAs(ctx.app, 'tb.renewals', PASSWORD);
    const plain = await request(ctx.app).get('/api/renewals/queue?talkbotOutcome=call-back').set('Authorization', `Bearer ${token}`);
    expect(plain.status).toBe(200);
    expect(plain.body.data.every((x) => x.talkbot === undefined)).toBe(true);
  });

  it('puts the accounts not reached on the next list', async () => {
    await query("UPDATE talkbot_call_lines SET outcome = 'missed-call', outcome_source = 'file' WHERE policy_id = 'pol_tb2'");
    // the renewal quoted by the batch run above is withdrawn: the policy can be called again
    await query("UPDATE renewals SET status = 'pipeline' WHERE policy_id = 'pol_tb2'");
    const r = await as['tb.sales']('post', '/talkbot/lists').send({ expiryFrom: addDays(day, 900), expiryTo: addDays(day, 900), insurerId, recallOf: list.listNumber });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.lines.map((l) => l.policyNumber)).toEqual(['POL-TB-41188']);
    const cancel = await as['tb.sales']('post', `/talkbot/lists/${r.body.data.id}/cancel`).send({});
    expect(cancel.body.message).toBe('Enter the reason for cancelling the call list');
    const ok = await as['tb.sales']('post', `/talkbot/lists/${r.body.data.id}/cancel`).send({ reasonCode: 'TBC-NOT-RUN' });
    expect(ok.body.data).toMatchObject({ status: 'cancelled', cancelReason: 'Campaign not run' });
  });

  it('leaves out a policy called talkbot.max_lists_per_policy times without being reached', async () => {
    await setting('talkbot.max_lists_per_policy', 1);
    const p = await as['tb.sales']('post', '/talkbot/preview').send({ expiryFrom: addDays(day, 400), expiryTo: addDays(day, 400), insurerId });
    expect(p.body.data.excluded['Called 1 times']).toBe(1);
    await setting('talkbot.max_lists_per_policy', 3);
  });

  it('closes a list by hand or after talkbot.auto_close_days; a closed list takes no upload', async () => {
    await query("UPDATE talkbot_call_lists SET last_upload_at = now() - interval '31 days' WHERE id = $1", [list.id]);
    const r = await closeOldLists();
    expect(r.closed).toContain(list.listNumber);
    const up = await upload('tb.sales', list.id, callRecords([['TIS_MV - OCT 07, 2026', 'POL-TB-41187', 'C77', '09173047105', 'Missed Call(19)', callAt('10:00:00')]]));
    expect(up.status).toBe(409);
    expect((await as['tb.sales']('post', `/talkbot/lists/${list.id}/close`)).status).toBe(409);
  });
});

describe('reasons', () => {
  it('ships the reasons of an account removed from a call list and of a call list cancelled', async () => {
    const r = (await query(`SELECT data->>'context' AS context, count(*)::int AS n FROM master_records WHERE type_code = 'reason-code' AND data->>'context' LIKE 'talkbot_%'
      GROUP BY 1 ORDER BY 1`)).rows;
    expect(r).toEqual([{ context: 'talkbot_line_remove', n: 5 }, { context: 'talkbot_list_cancel', n: 4 }]);
  });
});

describe('access', () => {
  it('lets Operations view call lists but not maintain them, and keeps Cash Control and IT out', async () => {
    expect((await as['tb.ops']('get', '/talkbot/lists')).status).toBe(200);
    expect((await as['tb.ops']('post', '/talkbot/lists').send({ expiryFrom: day, expiryTo: day })).status).toBe(403);
    expect((await as['tb.pdu']('get', '/talkbot/lists')).status).toBe(403);
    expect((await as['tb.it']('get', '/talkbot/lists')).status).toBe(403);
    expect((await as['tb.pdu']('post', '/talkbot/lists/x/renewal-batches')).status).toBe(403);
  });
});

describe('outcome rules', () => {
  it('derives the outcomes of the lists still worked again when talkbot.outcome_rules changes', async () => {
    const l = await one("SELECT id FROM talkbot_call_lists WHERE status = 'closed' ORDER BY created_at LIMIT 1");
    await query("UPDATE talkbot_call_lists SET status = 'results-loaded' WHERE id = $1", [l.id]);
    // Undecided no longer asks for a call back: the account falls back to its other calls (connected, no answer)
    const rules = rulesOf(null).map((r) => (r.outcome === 'call-back' ? { ...r, anyCallResult: false, callbackDate: false } : r));
    const r = await ctx.api('put', '/settings').send({ settings: { 'talkbot.outcome_rules': rules } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const line = await one("SELECT outcome FROM talkbot_call_lines WHERE list_id = $1 AND policy_id = 'pol_tb2'", [l.id]);
    expect(line.outcome).toBe('uncontacted');
  });
});
