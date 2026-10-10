/**
 * Accounts > Remittance > Setup > Schedules, Run now and Run history: the TISPH schedules (seed 90: TIS-WEEKLY, SCH-001
 * paused, SCH-002 retired, the job off), the automation state (cron for administrators only), MSG-RMT-007, codes from
 * the SCH- series, audited edits, the dry-run preview, Run now with an off-cycle reason, one run per window
 * (WINDOW_DONE), the run history, job runs and the run entries of the activity logs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';

let ctx;
const people = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const count = async (table) => (await q(`SELECT count(*)::int AS n FROM ${table}`))[0].n;

async function persona(key, username, displayName, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  const call = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  call.id = r.body.data.userId;
  people[key] = call;
  return call;
}

let seq = 0;
/** An insurer with `policies` active broker-billed policies incepted 30 days ago (eligible for a run). */
async function insurerWith(code, policies) {
  const [ins] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ($1, $2, $1, 'active') RETURNING id, code, name", [code, `${code} Insurance Corp.`]);
  const inception = addDays(await today(), -30);
  for (let i = 0; i < policies; i += 1) {
    seq += 1;
    const [c] = await q("INSERT INTO clients(client_code, display_name, first_name, last_name, created_by) VALUES ($1, $2, 'Run', 'Client', 'test') RETURNING id", [`CL-SCT-${seq}`, `Run Client ${seq}`]);
    await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, premium_total, commission_amount, billing_mode)
      VALUES ($1, $2, (SELECT id FROM products ORDER BY id LIMIT 1), $3, 'active', $4::date, $4::date + 365, 12000, 1800, 'broker')`, [`POL-SCT-${seq}`, c.id, ins.id, inception]);
  }
  return ins;
}
const schedules = async (who = 'maker') => (await people[who]('get', '/remittance/schedules')).body.data;
const byCode = (data, code) => data.schedules.find((s) => s.code === code);
/** The Monday of the current business week (a valid next run of a weekly schedule, already due). */
const thisMonday = async () => {
  const d = await today();
  return addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));
};

beforeAll(async () => {
  ctx = await setup();
  await persona('maker', 'sct.maker', 'M. Reyes', ['tis-finance']);
  await persona('gm', 'sct.gm', 'G. Manager', ['tis-general-manager']);
});
afterAll(async () => { await pool.end(); });

describe('TISPH schedules and the automation state', () => {
  it('seeds TIS-WEEKLY (weekly, all active insurers, Mondays 06:15), pauses SCH-001 and retires SCH-002 and the ARM configurations', async () => {
    const data = await schedules();
    const w = byCode(data, 'TIS-WEEKLY');
    expect(w).toMatchObject({ name: 'Weekly remittance', kind: 'Remittance run', frequency: 'Weekly', paymentWindow: 'Previous Monday to Friday', groupBy: 'Insurer and product line',
      runTime: '06:15', allInsurers: true, runs: 'Mondays 06:15', status: 'Active', lastRun: null });
    expect(w.covers.label).toBe(`All active (${w.covers.count})`);
    expect(w.covers.count).toBe((await q("SELECT count(*)::int AS n FROM insurance_companies WHERE status = 'active'"))[0].n);
    expect(new Date(`${w.nextRun}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(w.nextRunText).toMatch(/^Mon \d{2}\/\d{2}\/\d{4} 06:15$/);
    expect(byCode(data, 'SCH-001')).toMatchObject({ status: 'Paused', nextRun: null });
    expect(byCode(data, 'SCH-002')).toBeUndefined();
    expect((await q("SELECT status FROM master_records WHERE type_code = 'remittance-automated' AND code IN ('ARM-001', 'ARM-002')")).map((r) => r.status)).toEqual(['inactive', 'inactive']);
  });

  it('the job is off; its cron is shown to administrators only', async () => {
    const mine = await schedules();
    expect(mine.automation).toMatchObject({ jobEnabled: false, checkedDaily: '06:15', timeZone: 'Asia/Manila', lastCheckAt: null });
    expect(mine.automation.cron).toBeUndefined();
    expect(mine.job.cron).toBeUndefined();
    expect(JSON.stringify(mine)).not.toContain('15 6 * * *');
    const admin = (await ctx.api('get', '/remittance/schedules')).body.data;
    expect(admin.automation).toMatchObject({ jobEnabled: false, cron: '15 6 * * *', jobCode: 'remittance-schedules' });
  });

  it('saving TIS-WEEKLY as Monthly with the Monday to Friday window is refused with MSG-RMT-007', async () => {
    const w = byCode(await schedules(), 'TIS-WEEKLY');
    const r = await people.maker('put', `/remittance/schedules/${w.id}`).send({ frequency: 'Monthly' });
    expect(r.status).toBe(400);
    expect(r.body.errors[0]).toMatchObject({ path: 'frequency', code: 'MSG-RMT-007', message: 'The payment window "Previous Monday to Friday" needs a weekly schedule. Choose Weekly, or the window "Cut-off days".' });
    expect(byCode(await schedules(), 'TIS-WEEKLY').frequency).toBe('Weekly');
    const notMonday = addDays(w.nextRun, 1);
    expect((await people.maker('put', `/remittance/schedules/${w.id}`).send({ nextRun: notMonday })).body.errors[0].path).toBe('nextRun');
    // with the cut-off window a monthly schedule is fine
    const ok = await people.maker('put', `/remittance/schedules/${w.id}`).send({ frequency: 'Monthly', paymentWindow: 'Cut-off days' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const back = await people.maker('put', `/remittance/schedules/${w.id}`).send({ frequency: 'Weekly', paymentWindow: 'Previous Monday to Friday' });
    expect(back.status).toBe(200);
    const audits = await q("SELECT before_data, after_data, user_id FROM audit_log WHERE entity = 'master:remittance-schedule' AND entity_id = $1 AND action = 'update' ORDER BY id", [String(w.id)]);
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({ user_id: people.maker.id, before_data: { frequency: 'Weekly' }, after_data: { frequency: 'Monthly', paymentWindow: 'Cut-off days' } });
  });

  it('a new schedule takes its code from the SCH- series; a read-only user changes nothing', async () => {
    const r = await people.maker('post', '/remittance/schedules').send({ name: 'Weekly SCA', insurers: ['MALAYAN'], frequency: 'Weekly', paymentWindow: 'Previous Monday to Friday',
      groupBy: 'Insurer', runTime: '06:30', nextRun: await thisMonday() });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.code).toMatch(/^SCH-\d{3}$/);
    expect(r.body.data.code).not.toBe('SCH-001');
    expect(r.body.data.kind).toBe('Remittance run');
    expect((await people.maker('post', '/remittance/schedules').send({ name: 'Bad', frequency: 'Monthly', paymentWindow: 'Previous Monday to Friday' })).body.errors[0].code).toBe('MSG-RMT-007');
    expect((await people.gm('post', '/remittance/schedules').send({ name: 'x', frequency: 'Weekly' })).status).toBe(403);
    expect((await people.gm('put', `/remittance/schedules/${r.body.data.id}`).send({ name: 'x' })).status).toBe(403);
    expect((await people.gm('get', '/remittance/schedules')).status).toBe(200);
  });
});

describe('preview, Run now and the run history', () => {
  let sch;
  let ins;
  beforeAll(async () => {
    ins = await insurerWith('SCTEST', 2);
    const r = await people.maker('post', '/remittance/schedules').send({ name: 'Weekly SCTEST', insurers: ['SCTEST'], frequency: 'Weekly', paymentWindow: 'Previous Monday to Friday',
      runTime: '06:15', nextRun: addDays(await thisMonday(), 7) });
    expect(r.status).toBe(201);
    sch = r.body.data;
  });

  it('the preview is a dry run: per insurer what would be created, and nothing is written', async () => {
    const before = await Promise.all(['remittances', 'remittance_runs', 'remittance_items', 'audit_log', 'remittance_lines'].map(count));
    const p = await people.maker('post', `/remittance/schedules/${sch.id}/preview`);
    expect(p.status, JSON.stringify(p.body)).toBe(200);
    const runDate = await today();
    const monday = addDays(runDate, -((new Date(`${runDate}T00:00:00Z`).getUTCDay() + 6) % 7) - 7);
    expect(p.body.data.window).toMatchObject({ from: monday, to: addDays(monday, 4) });
    expect(p.body.data.windowDone).toEqual({ done: false });
    expect(p.body.data.rows).toEqual([expect.objectContaining({ insurer: expect.objectContaining({ code: 'SCTEST' }), ready: 2, held: 0, exceptions: 0, dueToInsurer: 20400,
      result: { code: 'draft', label: 'Draft will be created' } })]);
    expect(p.body.data.totals).toMatchObject({ drafts: 1, ready: 2, dueToInsurer: 20400 });
    expect(p.body.data.verb).toBe('Create 1 draft remittance');
    expect(await Promise.all(['remittances', 'remittance_runs', 'remittance_items', 'audit_log', 'remittance_lines'].map(count))).toEqual(before);
    // the seeded weekly schedule previews every active insurer, without writing either
    const w = byCode(await schedules(), 'TIS-WEEKLY');
    const pw = await people.maker('post', `/remittance/schedules/${w.id}/preview`);
    expect(pw.body.data.rows.length).toBe(w.covers.count);
    expect(pw.body.data.totals.dueToInsurer).toBe(Math.round(pw.body.data.rows.reduce((s, x) => s + x.dueToInsurer, 0) * 100) / 100);
    expect(await count('remittances')).toBe(before[0]);
  });

  it('Run now needs an off-cycle reason and write:remittance', async () => {
    const r = await people.maker('post', `/remittance/schedules/${sch.id}/run`).send({});
    expect(r.status).toBe(400);
    expect(r.body.errors[0].path).toBe('reasonCode');
    expect((await people.maker('post', `/remittance/schedules/${sch.id}/run`).send({ reasonCode: 'RRJ-OTHER' })).status).toBe(400);
    expect((await people.gm('post', `/remittance/schedules/${sch.id}/run`).send({ reasonCode: 'ROC-MISSED' })).status).toBe(403);
    expect((await people.gm('post', `/remittance/schedules/${sch.id}/preview`)).status).toBe(403);
    expect(await count('remittance_runs')).toBe(0);
  });

  it('Run now creates the drafts, records the run and answers MSG-RMT-008; the window cannot be run twice', async () => {
    const r = await people.maker('post', `/remittance/schedules/${sch.id}/run`).send({ reasonCode: 'ROC-MISSED' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Weekly run done: 1 remittance(s) created, 0 policies held, 0 exceptions.');
    const { run, drafts } = r.body.data;
    expect(run).toMatchObject({ scheduleCode: sch.code, trigger: { code: 'user', label: 'Run now · M. Reyes' }, reason: { code: 'ROC-MISSED', text: 'Missed run' },
      counts: { scanned: 2, ready: 2, held: 0, exceptions: 0, created: 1 }, result: { code: 'success', label: 'Success' }, dueToInsurer: 20400 });
    expect(drafts).toHaveLength(1);
    const [rem] = await q('SELECT status, data, created_by, insurance_company_id FROM remittances WHERE id = $1', [drafts[0].id]);
    expect(rem).toMatchObject({ status: 'draft', insurance_company_id: ins.id, created_by: people.maker.id,
      data: { source: 'run-now', runId: run.id, scheduleCode: sch.code, windowFrom: run.window.from, windowTo: run.window.to, offCycleReason: { code: 'ROC-MISSED', text: 'Missed run' } } });
    // the register reads the source and the off-cycle reason, the record's activity the run
    const row = (await people.maker('get', `/remittance/remittances?segment=drafts&insurerId=${ins.id}`)).body.data[0];
    expect(row).toMatchObject({ source: { code: 'run-now', label: 'Run now' }, flags: { offCycle: true, offCycleReason: 'Missed run' }, coverageWeek: { from: run.window.from, to: run.window.to } });
    const act = (await people.maker('get', `/remittance/remittances/${drafts[0].id}/activity`)).body.data;
    expect(act.find((e) => e.actionCode === 'run')).toMatchObject({ actionLabel: `Created by Run now (${sch.code})`, remarks: 'Off-cycle: Missed run', toStatus: 'Draft' });

    const again = await people.maker('post', `/remittance/schedules/${sch.id}/run`).send({ reasonCode: 'ROC-MISSED' });
    expect(again.status).toBe(409);
    expect(again.body.errors[0].code).toBe('WINDOW_DONE');
    expect(again.body.message).toMatch(/^This week's run is done \(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\)\. Next run Mon \d{2}\/\d{2}\/\d{4} 06:15\.$/);
    expect(await count('remittance_runs')).toBe(1);
    const p = (await people.maker('post', `/remittance/schedules/${sch.id}/preview`)).body.data;
    expect(p.windowDone).toMatchObject({ done: true, runId: run.id, message: again.body.message });
  });

  it('the run history and the schedule row show the run; the schedule activity logs it', async () => {
    const h = await people.gm('get', `/remittance/schedules/${sch.id}/runs`);
    expect(h.status).toBe(200);
    expect(h.body.total).toBe(1);
    expect(h.body.data[0]).toMatchObject({ trigger: { label: 'Run now · M. Reyes' }, reason: { text: 'Missed run' }, counts: { created: 1 }, result: { label: 'Success' },
      drafts: [expect.objectContaining({ remittanceNo: expect.stringMatching(/^REM-/), link: expect.stringMatching(/^\/finance\/remittance\/remittances\//) })] });
    expect(h.body.data[0].window.text).toMatch(/^\d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4}$/);
    const row = byCode(await schedules(), sch.code);
    expect(row.lastRun).toMatchObject({ result: 'success', resultLabel: 'Success', counts: { created: 1 }, trigger: { code: 'user' } });
    const act = (await people.maker('get', `/remittance/schedules/${sch.id}/activity`)).body.data;
    expect(act.map((e) => e.actionCode)).toEqual(expect.arrayContaining(['create', 'run']));
    expect(act.find((e) => e.actionCode === 'run')).toMatchObject({ remarks: 'Off-cycle: Missed run', actionLabel: expect.stringMatching(/^Run now: Weekly run done/) });
  });

  it('a paused schedule is not run', async () => {
    expect((await people.maker('patch', `/remittance/schedules/${sch.id}/status`).send({ status: 'Paused' })).status).toBe(200);
    const r = await people.maker('post', `/remittance/schedules/${sch.id}/run`).send({ reasonCode: 'ROC-MISSED' });
    expect(r.status).toBe(409);
    expect(r.body.errors[0].code).toBe('PAUSED');
    expect(byCode(await schedules(), sch.code)).toMatchObject({ status: 'Paused', nextRun: null });
    const audit = await q("SELECT action FROM audit_log WHERE entity = 'master:remittance-schedule' AND entity_id = $1 AND action LIKE 'status:%'", [String(sch.id)]);
    expect(audit.map((a) => a.action)).toEqual(['status:inactive']);
  });
});

describe('the job records its runs', () => {
  it('runs a due schedule as the job, skips a window already run, and moves the next run on', async () => {
    const ins = await insurerWith('SCJOB', 1);
    const monday = await thisMonday();
    const r = await people.maker('post', '/remittance/schedules').send({ name: 'Weekly SCJOB', insurers: ['SCJOB'], frequency: 'Weekly', paymentWindow: 'Previous Monday to Friday',
      runTime: '06:15', nextRun: monday });
    const sch = r.body.data;
    const job = await ctx.api('post', '/schedules/remittance-schedules/run');
    expect(job.status).toBe(200);
    const out = job.body.data.output;
    expect(out.ran.map((x) => x.schedule)).toContain(sch.code);
    const [run] = await q('SELECT * FROM remittance_runs WHERE schedule_code = $1', [sch.code]);
    expect(run).toMatchObject({ trigger: 'job', user_id: null, reason_code: null, result: 'success', created: 1 });
    const [rem] = await q('SELECT data FROM remittances WHERE insurance_company_id = $1', [ins.id]);
    expect(rem.data).toMatchObject({ source: 'weekly-run', runId: run.id });
    const rec = (await q('SELECT data FROM master_records WHERE id = $1', [sch.id]))[0].data;
    expect(rec.nextRun).toBe(addDays(monday, 7));
    const row = byCode(await schedules(), sch.code);
    expect(row.lastRun.trigger).toMatchObject({ code: 'job', label: 'Job' });
    // Run now on the same window is refused; a job finding a window already run skips it and moves on
    expect((await people.maker('post', `/remittance/schedules/${sch.id}/run`).send({ reasonCode: 'ROC-CATCHUP' })).body.errors[0].code).toBe('WINDOW_DONE');
    await q("UPDATE master_records SET data = data || jsonb_build_object('nextRun', $2::text) WHERE id = $1", [sch.id, monday]);
    const second = (await ctx.api('post', '/schedules/remittance-schedules/run')).body.data.output;
    expect(second.skipped.map((x) => x.schedule)).toContain(sch.code);
    expect((await q('SELECT count(*)::int AS n FROM remittance_runs WHERE schedule_code = $1', [sch.code]))[0].n).toBe(1);
    expect((await q('SELECT data FROM master_records WHERE id = $1', [sch.id]))[0].data.nextRun).toBe(addDays(monday, 7));
  });
});
