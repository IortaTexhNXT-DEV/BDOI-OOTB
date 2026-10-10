/**
 * Remittance schedules and their runs (Accounts > Remittance > Setup > Schedules, Remittances > Run now and Run
 * history, the "Remittance schedules" job of Master > Schedules).
 *
 * A schedule (remittance-schedule master) names the insurers (or all active ones), the frequency, the next run date
 * and time, and the payment window: "Previous Monday to Friday" (the week before the run date; it needs a weekly
 * schedule, MSG-RMT-007) or "Cut-off days" (policies incepted up to cutOffDays before the run date). The grouping is
 * stored for Phase 2; a run creates one draft per insurer from the policies incepted up to the end of the window that
 * are not on a remittance yet (service.js eligiblePolicies).
 *
 * Every run is recorded in remittance_runs with its window, counts, drafts, result and message (MSG-RMT-008). A window
 * has one run that did not fail: a second run of it is refused (409 WINDOW_DONE), and off-cycle catch-up goes through
 * Import policy list. Run now is a user's run and needs a remittance_off_cycle reason; its drafts carry the source
 * run-now and the reason, those of the job the source weekly-run, and both the run id and the window. The preview is a
 * dry run: it reads what a run would create and writes nothing. The automation state (the job on or off, its last
 * check) is shown to everyone; its cron only to administrators.
 */
import { many, one, pool, query } from '../../db/pool.js';
import { HttpError, badRequest } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { businessTimeZone, addDays, today as businessToday } from '../../lib/dates.js';
import { printFormat } from '../../lib/pdf/index.js';
import { activityEntries, instant } from '../../lib/auditEvents.js';
import { formatDate } from '../../lib/pdf/format.js';
import { params, round2 } from '../masters/helpers.js';
import * as masters from '../masters/service.js';
import { requiredReason } from '../ops-masters/records.js';
import { buildLines, eligiblePolicies, executeAutomated, executeForInsurers } from './service.js';
import { SCHEDULE_JOB, afterRun, assertScheduleInsurers, cutOffDate, insurerCodes, nextRunOf, scheduleDay } from './items.js';

export const WEEKLY_WINDOW = 'Previous Monday to Friday';
export const CUT_OFF_WINDOW = 'Cut-off days';
export const KINDS = ['Remittance run', 'Billing run', 'Hold check'];
export const GROUP_BY = ['Insurer', 'Insurer and product line'];
export const MSG_RMT_007 = 'The payment window "Previous Monday to Friday" needs a weekly schedule. Choose Weekly, or the window "Cut-off days".';
const RESULTS = { running: 'Running', success: 'Success', nothing: 'Nothing to remit', failed: 'Failed' };
const SYSTEM_USER = { id: null, username: 'system', roles: [], permissions: [] };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PLURAL_DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const SCHEDULE_ENTITY = 'master:remittance-schedule';
const recordLink = (id) => `/finance/remittance/remittances/${id}`;
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const conflictOf = (code, message) => new HttpError(409, message, [{ path: 'schedule', code, message }]);

const scheduleType = () => masters.getType('remittance-schedule');

/** The window a run of schedule `s` on `runDate` covers: { from, to, catchUpFrom, weekly }. */
export function windowOf(s, runDate) {
  if (s.paymentWindow === WEEKLY_WINDOW) {
    const monday = addDays(runDate, -((weekday(runDate) + 6) % 7) - 7);
    return { from: monday, to: addDays(monday, 4), catchUpFrom: null, weekly: true };
  }
  const to = cutOffDate(s, runDate);
  return { from: to, to, catchUpFrom: null, weekly: false };
}

const windowText = (w, fmt) => (w.from === w.to ? `up to ${formatDate(w.from, fmt)}` : `${formatDate(w.from, fmt)} – ${formatDate(w.to, fmt)}`);

/** "Mondays 06:15", "Daily 05:50", "Monthly 06:15" from the frequency, the next run date and the run time. */
function runsLabel(s) {
  const time = s.runTime ? ` ${s.runTime}` : '';
  const day = scheduleDay(s.nextRun);
  if (s.frequency === 'Weekly' && day) return `${PLURAL_DAYS[weekday(day)]}${time}`;
  return `${s.frequency || ''}${time}`.trim();
}

/** "Mon 19/10/2026 06:15" */
const nextRunText = (s, day, fmt) => (day ? `${WEEKDAYS[weekday(day)]} ${formatDate(day, fmt)}${s.runTime ? ` ${s.runTime}` : ''}` : null);

/** The automation chip: the job on or off, when it checks, its last check; the cron and the job's link for administrators. */
async function automationOf(user) {
  const job = await one('SELECT code, name, cron, enabled, last_run_at, last_status FROM scheduled_jobs WHERE code = $1', [SCHEDULE_JOB]);
  if (!job) return { jobEnabled: false, checkedDaily: null, timeZone: await businessTimeZone(), lastCheckAt: null, lastStatus: null };
  const daily = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(String(job.cron || '').trim());
  return {
    jobEnabled: !!job.enabled, checkedDaily: daily ? `${daily[2].padStart(2, '0')}:${daily[1].padStart(2, '0')}` : null, timeZone: await businessTimeZone(),
    lastCheckAt: job.last_run_at ? new Date(job.last_run_at).toISOString() : null, lastStatus: job.last_status || null,
    ...(isAdmin(user) ? { cron: job.cron, jobCode: job.code, link: '/master/configuration/schedules' } : {}),
  };
}

/** A remittance_runs row as the screens read it. */
function runOut(r, fmt) {
  const started = instant(r.started_at, fmt);
  const w = { from: r.window_from instanceof Date ? r.window_from.toISOString().slice(0, 10) : String(r.window_from).slice(0, 10),
    to: r.window_to instanceof Date ? r.window_to.toISOString().slice(0, 10) : String(r.window_to).slice(0, 10) };
  return {
    id: r.id, scheduleCode: r.schedule_code, startedAt: new Date(r.started_at).toISOString(), startedText: started?.text || null,
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    trigger: { code: r.trigger, label: r.trigger === 'job' ? 'Job' : `Run now · ${r.user_name || 'a user'}`, user: r.user_id ? { id: r.user_id, name: r.user_name || null } : null },
    reason: r.reason_code ? { code: r.reason_code, text: r.reason_text } : null,
    window: { ...w, catchUpFrom: r.catch_up_from || null, text: windowText(w, fmt) },
    counts: { scanned: r.scanned, ready: r.ready, held: r.held, exceptions: r.exceptions, created: r.created },
    dueToInsurer: round2(r.due_to_insurer), drafts: r.drafts || [], executionRef: r.execution_ref || null,
    result: { code: r.result, label: RESULTS[r.result] || r.result }, message: r.message || null,
  };
}

const RUN_SELECT = `SELECT x.*, (SELECT display_name FROM users u WHERE u.id = x.user_id) AS user_name,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'remittanceNo', r.remittance_number, 'link', '/finance/remittance/remittances/' || r.id) ORDER BY r.remittance_number), '[]'::jsonb)
       FROM remittances r WHERE x.created_remittance_ids ? r.id) AS drafts
  FROM remittance_runs x`;

/** The last run of each schedule code (the newest one). */
async function lastRuns(codes) {
  if (!codes.length) return new Map();
  const rows = await many(`${RUN_SELECT} WHERE x.id IN (SELECT DISTINCT ON (schedule_code) id FROM remittance_runs WHERE schedule_code = ANY($1) ORDER BY schedule_code, started_at DESC)`, [codes]);
  return new Map(rows.map((r) => [r.schedule_code, r]));
}

/** The active insurers a schedule covers: every active insurer, or the ones it names. */
async function coveredInsurers(s) {
  if (s.allInsurers) return many("SELECT id, code, name FROM insurance_companies WHERE status = 'active' ORDER BY name");
  const codes = insurerCodes(s);
  if (!codes.length) return [];
  return many("SELECT id, code, name FROM insurance_companies WHERE (code = ANY($1) OR id::text = ANY($1)) AND status = 'active' ORDER BY name", [codes]);
}

/**
 * The row menu of a schedule for `user` (§3.2 actions): View for everyone; with write:remittance Edit, Preview run,
 * Run now and Pause or Resume. Run now stays in the menu, disabled with its reason, while the schedule is paused or its
 * current window already has a run (WINDOW_DONE, the text of the refusal with the next run).
 */
async function scheduleActions(s, user, { asOf, fmt }) {
  const out = [{ code: 'view', label: 'View', allowed: true }];
  if (!hasPermission(user, 'write:remittance')) return out;
  out.push({ code: 'edit', label: 'Edit', allowed: true }, { code: 'preview', label: 'Preview run', allowed: true });
  const active = s.status === 'Active';
  const done = active ? await doneRun(s.code, windowOf(s, asOf)) : null;
  let block = null;
  if (!active) block = { blockedCode: 'PAUSED', blockedReason: `${s.code} is paused. Resume it to run it.` };
  else if (done) block = { blockedCode: 'WINDOW_DONE', blockedReason: await windowDoneText(s, done, asOf, fmt) };
  out.push({ code: 'run-now', label: 'Run now…', allowed: !block, ...(block || {}) });
  out.push(active ? { code: 'pause', label: 'Pause', allowed: true } : { code: 'resume', label: 'Resume', allowed: true });
  return out;
}

async function scheduleOut(s, { last, asOf, fmt, user }) {
  const insurers = await coveredInsurers(s);
  const active = s.status === 'Active';
  const next = active ? nextRunOf(s, asOf) : null;
  const run = last ? runOut(last, fmt) : null;
  const linked = Array.isArray(s.linkedProcesses) ? s.linkedProcesses.filter((x) => /^ARM-/.test(String(x))) : [];
  return {
    id: s.id, code: s.code, name: s.name, kind: s.kind || KINDS[0], frequency: s.frequency || null, paymentWindow: s.paymentWindow || CUT_OFF_WINDOW,
    cutOffDays: s.cutOffDays ?? 0, groupBy: s.groupBy || GROUP_BY[0], runTime: s.runTime || null, allInsurers: !!s.allInsurers, insurers: insurerCodes(s),
    covers: { allActive: !!s.allInsurers, count: insurers.length, insurers: insurers.map((i) => ({ id: i.id, code: i.code, name: i.name })),
      label: s.allInsurers ? `All active (${insurers.length})` : insurers.length ? insurers.map((i) => i.name).join(', ') : linked.length ? `Automated remittance ${linked.join(', ')}` : 'No insurer' },
    runs: runsLabel(s), nextRun: next, nextRunText: nextRunText(s, next, fmt),
    lastRun: run ? { id: run.id, at: run.startedAt, text: run.startedText, result: run.result.code, resultLabel: run.result.label, counts: run.counts, message: run.message, trigger: run.trigger }
      : null,
    status: active ? 'Active' : 'Paused', isActive: active, timeZone: s.timezone || null,
    actions: await scheduleActions(s, user, { asOf, fmt }),
  };
}

/**
 * GET /remittance/schedules: { automation, schedules (the Setup > Schedules table) } and, for the Scheduling screen of
 * earlier releases, scheduledJobs, upcomingEvents, timeZone and job (its cron only for administrators).
 */
export async function listSchedules(user) {
  const asOf = await businessToday();
  const fmt = await printFormat();
  const t = await scheduleType();
  const { rows } = await masters.listRecords(t, {}, { limit: 500, offset: 0 });
  const last = await lastRuns(rows.map((r) => r.code));
  const schedules = [];
  for (const s of rows) schedules.push(await scheduleOut(s, { last: last.get(s.code), asOf, fmt, user }));
  const legacy = await many('SELECT data->>\'scheduleId\' AS sid, max(created_at) AS last FROM remittance_items WHERE kind = \'execution\' AND data ? \'scheduleId\' GROUP BY 1');
  const scheduledJobs = rows.map((r) => ({ ...r, insurers: insurerCodes(r), cutOffDays: r.cutOffDays ?? 0, nextRun: nextRunOf(r, asOf),
    lastRun: legacy.find((x) => Number(x.sid) === r.id)?.last || r.lastRun || null, status: r.status === 'Active' ? 'Active' : 'Paused' }));
  const upcomingEvents = scheduledJobs.filter((j) => j.status === 'Active' && j.nextRun).sort((a, b) => String(a.nextRun).localeCompare(String(b.nextRun)))
    .slice(0, 10).map((j) => ({ status: j.nextRun, date: j.nextRun, content: j.name, scheduleId: j.id }));
  const automation = await automationOf(user);
  const job = await one('SELECT code, name, cron, enabled, last_run_at, last_status FROM scheduled_jobs WHERE code = $1', [SCHEDULE_JOB]);
  return {
    automation, schedules, scheduledJobs, upcomingEvents, timeZone: await businessTimeZone(),
    job: job ? { code: job.code, name: job.name, ...(isAdmin(user) ? { cron: job.cron, link: '/master/configuration/schedules' } : {}), enabled: job.enabled,
      lastRunAt: job.last_run_at, lastStatus: job.last_status } : null,
  };
}

/** One schedule of the Setup > Schedules table, with the row menu of `user`. */
export async function getSchedule(id, user) {
  const s = await masters.getRecord(await scheduleType(), id);
  return scheduleOut(s, { last: (await lastRuns([s.code])).get(s.code), asOf: await businessToday(), fmt: await printFormat(), user });
}

/**
 * The fields of a schedule as saved (the record merged with the change): kind, payment window, grouping, run time,
 * and MSG-RMT-007: the Monday to Friday window needs a weekly schedule, whose next run is a Monday.
 */
export function assertScheduleFields(s) {
  const errors = [];
  if (s.kind && !KINDS.includes(s.kind)) errors.push({ path: 'kind', message: `Kind must be one of: ${KINDS.join(', ')}` });
  if (s.paymentWindow && ![WEEKLY_WINDOW, CUT_OFF_WINDOW].includes(s.paymentWindow)) errors.push({ path: 'paymentWindow', message: `Payment window must be ${WEEKLY_WINDOW} or ${CUT_OFF_WINDOW}` });
  if (s.groupBy && !GROUP_BY.includes(s.groupBy)) errors.push({ path: 'groupBy', message: `Group remittances by must be one of: ${GROUP_BY.join(', ')}` });
  if (s.runTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.runTime))) errors.push({ path: 'runTime', message: 'Run time is a time of day such as 06:15' });
  if (s.paymentWindow === WEEKLY_WINDOW && s.frequency !== 'Weekly') errors.push({ path: 'frequency', code: 'MSG-RMT-007', message: MSG_RMT_007 });
  else if (s.paymentWindow === WEEKLY_WINDOW && scheduleDay(s.nextRun) && weekday(scheduleDay(s.nextRun)) !== 1) {
    errors.push({ path: 'nextRun', message: 'The next run of a weekly schedule is a Monday' });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
}

/** POST /remittance/schedules: a new schedule; its code comes from the remittance_schedule series when none is given. */
export async function createSchedule(body, user, req) {
  const t = await scheduleType();
  const b = { kind: KINDS[0], ...(body || {}) };
  await assertScheduleInsurers(b);
  assertScheduleFields(b);
  const s = await masters.createRecord(t, { timezone: await businessTimeZone(), ...b }, user);
  await audit(req, { entity: SCHEDULE_ENTITY, entityId: s.id, action: 'create', after: s });
  return s;
}

/** PUT /remittance/schedules/:id: a change, checked on the schedule as it will be saved, audited with before and after. */
export async function updateSchedule(id, body, user, req) {
  const t = await scheduleType();
  const current = await masters.getRecord(t, id);
  await assertScheduleInsurers(body || {});
  assertScheduleFields({ ...current, ...(body || {}) });
  const { before, after } = await masters.updateRecord(t, id, body || {}, user);
  await audit(req, { entity: SCHEDULE_ENTITY, entityId: String(id), action: 'update', before, after });
  return after;
}

/** The run that did not fail of a schedule's window, if any. */
const doneRun = (code, w) => one(`${RUN_SELECT} WHERE x.schedule_code = $1 AND x.window_from = $2::date AND x.window_to = $3::date AND x.result <> 'failed'
  ORDER BY x.started_at DESC LIMIT 1`, [code, w.from, w.to]);

/** "This week's run is done (12/10/2026 06:15). Next run Mon 19/10/2026 06:15." */
async function windowDoneText(s, done, runDate, fmt) {
  const at = instant(done.started_at, fmt)?.text || '';
  const next = nextRunText(s, s.status === 'Active' ? afterRun(s, runDate) : null, fmt);
  const head = windowOf(s, runDate).weekly ? 'This week\'s run is done' : `The run up to ${formatDate(done.window_to, fmt)} is done`;
  return `${head} (${at}).${next ? ` Next run ${next}.` : ''}`;
}

/**
 * POST /remittance/schedules/:id/preview: what a run today would create, without writing anything: the window, per
 * insurer the policies ready and the amount due, and "Draft will be created" or "Nothing to remit"; windowDone when the
 * window already has a run (Run now is then refused with its reason).
 */
export async function previewRun(id, { asOf = null } = {}) {
  const t = await scheduleType();
  const s = await masters.getRecord(t, id);
  const fmt = await printFormat();
  const runDate = asOf || (await businessToday());
  const w = windowOf(s, runDate);
  const done = await doneRun(s.code, w);
  const rows = [];
  for (const ins of await coveredInsurers(s)) {
    const pols = await eligiblePolicies({ insurerId: ins.id, to: w.to, kind: 'direct-bill' });
    const lines = pols.length ? await buildLines(pols.map((p) => ({ policyId: p.id })), ins.id) : [];
    const lineSet = [...new Set(pols.map((p) => p.product_line).filter(Boolean))].map((l) => l.charAt(0).toUpperCase() + l.slice(1));
    rows.push({ insurer: { id: ins.id, code: ins.code, name: ins.name }, productLine: lineSet.join(', ') || null, basis: pols.some((p) => p.gross_billed) ? 'Gross' : 'Net',
      ready: pols.length, held: 0, exceptions: 0, dueToInsurer: round2(lines.reduce((sum, l) => sum + l.net, 0)),
      result: pols.length ? { code: 'draft', label: 'Draft will be created' } : { code: 'nothing', label: 'Nothing to remit' } });
  }
  const drafts = rows.filter((r) => r.ready).length;
  return {
    schedule: { id: s.id, code: s.code, name: s.name }, runDate,
    window: { from: w.from, to: w.to, catchUpFrom: null, text: windowText(w, fmt) },
    windowDone: done ? { done: true, runId: done.id, at: new Date(done.started_at).toISOString(), message: await windowDoneText(s, done, runDate, fmt) } : { done: false },
    paused: s.status !== 'Active', rows,
    totals: { insurers: rows.length, drafts, ready: rows.reduce((n, r) => n + r.ready, 0), held: 0, exceptions: 0, dueToInsurer: round2(rows.reduce((n, r) => n + r.dueToInsurer, 0)) },
    verb: `Create ${drafts} draft remittance${drafts === 1 ? '' : 's'}`,
  };
}

/** MSG-RMT-008: "Weekly run done: 3 remittance(s) created, 0 policies held, 0 exceptions." */
const runMessage = (s, n) => `${s.frequency === 'Weekly' ? 'Weekly run' : 'Run'} done: ${n} remittance(s) created, 0 policies held, 0 exceptions.`;

/**
 * Run schedule `id` on `asOf` (default the business date): `trigger` job or user (Run now, with `reason` of the
 * remittance_off_cycle context). Refused while paused (409 PAUSED) and when the window already has a run (409
 * WINDOW_DONE). The run is recorded first (one per window, the unique index stops a concurrent second run), the
 * drafts are created per insurer, then the run gets its counts and MSG-RMT-008, the schedule its last and next run
 * dates. A failure is recorded on the run with its message and thrown. Returns { run, drafts, message, schedule }.
 */
export async function runSchedule(id, user, { asOf = null, trigger = 'user', reason = null, req = null } = {}) {
  const t = await scheduleType();
  const s = await masters.getRecord(t, id);
  if (s.status !== 'Active') throw conflictOf('PAUSED', `${s.code} is paused. Resume it to run it.`);
  const fmt = await printFormat();
  const runDate = asOf || (await businessToday());
  const w = windowOf(s, runDate);
  const done = await doneRun(s.code, w);
  if (done) throw conflictOf('WINDOW_DONE', await windowDoneText(s, done, runDate, fmt));
  let runId;
  try {
    runId = (await one(`INSERT INTO remittance_runs(schedule_id, schedule_code, trigger, user_id, reason_code, reason_text, window_from, window_to, catch_up_from)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [s.id, s.code, trigger, trigger === 'user' ? user?.id || null : null, reason?.code || null, reason?.text || null,
      w.from, w.to, w.catchUpFrom])).id;
  } catch (e) {
    if (e.code === '23505') throw conflictOf('WINDOW_DONE', await windowDoneText(s, await doneRun(s.code, w), runDate, fmt));
    throw e;
  }
  const data = { source: trigger === 'job' ? 'weekly-run' : 'run-now', runId, scheduleCode: s.code,
    ...(w.weekly ? { windowFrom: w.from, windowTo: w.to } : {}),
    ...(reason ? { offCycleReason: { code: reason.code, name: reason.name, note: reason.note, text: reason.text } } : {}) };
  const by = trigger === 'job' ? `job:${SCHEDULE_JOB}` : `schedule:${s.code}`;
  let execution;
  try {
    const insurers = s.allInsurers ? (await coveredInsurers(s)).map((i) => i.code) : insurerCodes(s);
    if (insurers.length) {
      execution = await executeForInsurers({ insurerCodes: insurers, to: w.to, scheduleCode: s.code, runDate, data }, user, by);
    } else {
      const configCode = (Array.isArray(s.linkedProcesses) ? s.linkedProcesses : []).find((x) => /^ARM-/.test(String(x))) || null;
      if (!configCode) throw badRequest(`Schedule ${s.code} names no insurers and no automated remittance configuration; choose the insurers to remit`);
      execution = await executeAutomated({ configCode }, user, by);
    }
  } catch (e) {
    await query("UPDATE remittance_runs SET result = 'failed', message = $2, finished_at = now() WHERE id = $1", [runId, e.message]);
    throw e;
  }
  const created = execution.remittances;
  const policies = created.reduce((n, r) => n + (Number(r.policyCount) || 0), 0);
  const message = runMessage(s, created.length);
  await query(`UPDATE remittance_runs SET result = $2, message = $3, scanned = $4, ready = $4, created = $5, created_remittance_ids = $6, due_to_insurer = $7, execution_ref = $8,
    finished_at = now() WHERE id = $1`, [runId, created.length ? 'success' : 'nothing', message, policies, created.length, JSON.stringify(created.map((r) => r.id)),
    round2(created.reduce((n, r) => n + Number(r.netAmount || 0), 0)), execution.executionId]);
  await query('UPDATE remittance_items SET data = data || $2 WHERE reference_no = $1', [execution.executionId, JSON.stringify({ scheduleId: String(s.id), scheduleCode: s.code, runId })]);
  const next = afterRun(s, runDate);
  await query(`UPDATE master_records SET data = data || jsonb_build_object('lastRun', $2::text) || CASE WHEN $4::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('nextRun', $4::text) END,
    updated_by = $3, updated_at = now() WHERE id = $1`, [s.id, runDate, user?.id || null, next]);
  const auditReq = req || { user: user?.id ? user : SYSTEM_USER, auditSource: { channel: 'job', name: SCHEDULE_JOB } };
  const run = runOut(await one(`${RUN_SELECT} WHERE x.id = $1`, [runId]), fmt);
  for (const r of created) {
    await audit(auditReq, { entity: 'remittance', entityId: r.id, action: 'run', after: { status: 'draft', source: data.source, runId, scheduleCode: s.code, window: run.window.text,
      offCycleReason: reason?.text || null, policyCount: r.policyCount, netDue: round2(r.netAmount) } });
  }
  await audit(auditReq, { entity: 'remittance_schedule', entityId: String(s.id), action: 'run', after: { runId, scheduleCode: s.code, trigger, window: run.window.text,
    reason: reason?.text || null, result: run.result.code, created: created.map((r) => r.remittanceNo), message } });
  return {
    run, message,
    drafts: created.map((r) => ({ id: r.id, remittanceNo: r.remittanceNo, insurer: r.insurerName || null, policies: r.policyCount, dueToInsurer: round2(r.netAmount), link: recordLink(r.id) })),
    schedule: await getSchedule(s.id, user),
  };
}

/** POST /remittance/schedules/:id/run { reasonCode, note }: Run now, off-cycle, with a remittance_off_cycle reason. */
export async function runNow(id, body, user, req) {
  const reason = await requiredReason(pool, 'remittance_off_cycle', { reasonCode: body?.reasonCode, note: body?.note });
  return runSchedule(id, user, { trigger: 'user', reason, req });
}

/**
 * Scheduled job "Remittance schedules" (Master > Schedules): run every active remittance schedule whose next run date
 * is on or before the business date (a schedule without a next run date is due at once). A schedule whose window was
 * already run (Run now) is skipped and its next run date moved on. One failing schedule does not stop the others; its
 * error is in the job output and on its run.
 */
export async function runDueSchedules({ asOf = null } = {}) {
  const runDate = asOf || (await businessToday());
  const t = await scheduleType();
  const { rows } = await masters.listRecords(t, {}, { limit: 1000, offset: 0 });
  const due = rows.filter((r) => r.status === 'Active' && (!scheduleDay(r.nextRun) || scheduleDay(r.nextRun) <= runDate));
  const ran = [];
  const skipped = [];
  const errors = [];
  for (const r of due) {
    try {
      const out = await runSchedule(r.id, SYSTEM_USER, { asOf: runDate, trigger: 'job' });
      ran.push({ schedule: r.code, runId: out.run.id, executionId: out.run.executionRef, remittances: out.drafts.length, totalAmount: out.run.dueToInsurer, nextRun: out.schedule.nextRun });
    } catch (e) {
      if (e.details?.[0]?.code === 'WINDOW_DONE') {
        const next = afterRun(r, runDate);
        if (next) await query("UPDATE master_records SET data = data || jsonb_build_object('nextRun', $2::text), updated_at = now() WHERE id = $1", [r.id, next]);
        skipped.push({ schedule: r.code, reason: e.message });
      } else errors.push({ schedule: r.code, error: e.message });
    }
  }
  return { asOf: runDate, due: due.length, ran, skipped, errors };
}

/** GET /remittance/schedules/:id/runs: the run history of a schedule, newest first (paging). */
export async function scheduleRuns(id, pg) {
  const s = await masters.getRecord(await scheduleType(), id);
  const fmt = await printFormat();
  const total = (await one('SELECT count(*)::int AS n FROM remittance_runs WHERE schedule_code = $1', [s.code])).n;
  const p = params([s.code]);
  const rows = await many(`${RUN_SELECT} WHERE x.schedule_code = $1 ORDER BY x.started_at DESC LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  return { rows: rows.map((r) => runOut(r, fmt)), total, schedule: { id: s.id, code: s.code, name: s.name } };
}

/** GET /remittance/schedules/:id/activity: the changes and runs of a schedule (audit trail), oldest first. */
export async function scheduleActivity(id, user) {
  const s = await masters.getRecord(await scheduleType(), id);
  const rows = await many(`SELECT a.id, a.at, a.user_id, a.username, a.entity, a.entity_id, a.action, a.before_data, a.after_data, a.source FROM audit_log a
    WHERE a.entity IN ($1, 'remittance_schedule') AND a.entity_id = $2 ORDER BY a.at, a.id`, [SCHEDULE_ENTITY, String(s.id)]);
  const entries = await activityEntries(rows, { viewer: user });
  return entries.map((e, i) => {
    const r = rows[i];
    if (r.entity !== 'remittance_schedule' || r.action !== 'run') return e;
    const a = r.after_data || {};
    return { ...e, actionLabel: `${a.trigger === 'job' ? 'Run by the job' : 'Run now'}: ${a.message || RESULTS[a.result] || ''}`.trim(),
      remarks: a.reason ? `Off-cycle: ${a.reason}` : e.remarks, changes: [{ field: 'window', label: 'Window', before: null, after: a.window || null }] };
  });
}

/** The last run of a schedule code, or null (the run strip of Remittances and the summary). */
export async function latestRun(code = null) {
  const r = await one(`${RUN_SELECT} ${code ? 'WHERE x.schedule_code = $1' : ''} ORDER BY x.started_at DESC LIMIT 1`, code ? [code] : []);
  return r ? runOut(r, await printFormat()) : null;
}

/** Pause or resume a schedule (audited). */
export async function setScheduleStatus(id, paused, user, req) {
  const t = await scheduleType();
  const status = paused ? 'inactive' : 'active';
  const { before, after } = await masters.setRecordStatus(t, id, status, user);
  await audit(req, { entity: SCHEDULE_ENTITY, entityId: String(id), action: `status:${status}`, before, after });
  return after;
}

