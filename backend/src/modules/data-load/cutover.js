/**
 * Cutover checklist and defects of a run (Data Migration & Go-Live > Cutover and Runs, migration 0444).
 *
 * The checklist is the runbook template copied when the run was created (runs.js). Each step has an owner (a user or a
 * role), planned and actual start and end, a status and notes:
 *   start    a step of a running run that is not started or blocked; every step it depends on is done or skipped
 *   done     a step in progress; when the runbook names evidence for it, an evidence file is attached (evidence.js) or a
 *            note says why there is none. CO-3 (pre-load checks) also needs the restore point of the run
 *   block    a step not started or in progress, with a note
 *   skip     a step not started or blocked, with a note (a mock skips the pre-cutover steps of production)
 * Every change is audited (migration_run_step). The template itself (GET / PUT /runbook) is kept by administrators.
 *
 * Defects of a run: title, object, severity 1 (critical) to 4, status (open, fixed, retest, closed, deferred), owner,
 * the load and step they were found in, description and resolution.
 */
import { many, one } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { isLate, openRunRow, runDefects, runElapsedMs, runPlannedMs, runRow } from './runs.js';

export const STEP_STATUSES = { 'not-started': 'Not started', 'in-progress': 'In progress', done: 'Done', blocked: 'Blocked', skipped: 'Skipped', failed: 'Failed' };
export const PHASES = { 'pre-cutover': 'Pre-cutover', cutover: 'Cutover', 'go-live': 'Go-live', hypercare: 'Hypercare' };
export const DEFECT_STATUSES = { open: 'Open', fixed: 'Fixed', retest: 'Retest', closed: 'Closed', deferred: 'Deferred' };
/** Step whose completion records the restore point (pre-load checks). */
export const RESTORE_POINT_STEP = 'CO-3';
const FINISHED = ['done', 'skipped'];

const text = (v, max = 2000) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

const toStep = (s) => s && ({
  id: Number(s.id), runId: Number(s.run_id), code: s.code, title: s.title, phase: s.phase, phaseLabel: PHASES[s.phase] || s.phase, sort: s.sort,
  ownerUserId: s.owner_user_id, ownerName: s.owner_name || null, ownerRole: s.owner_role, offsetLabel: s.offset_label, durationMinutes: s.duration_minutes,
  evidenceHint: s.evidence_hint, evidenceRequired: !!s.evidence_hint, evidenceCount: Number(s.evidence_count || 0),
  plannedStart: s.planned_start, plannedEnd: s.planned_end, actualStart: s.actual_start, actualEnd: s.actual_end,
  elapsedMs: s.actual_start && s.actual_end ? new Date(s.actual_end).getTime() - new Date(s.actual_start).getTime() : null,
  late: isLate(s),
  status: s.status, statusLabel: STEP_STATUSES[s.status], notes: s.notes, dependsOn: s.depends_on || [], waitingFor: s.waiting_for || [],
  updatedBy: s.updated_by_name || s.updated_by, updatedAt: s.updated_at,
});
const STEP_SELECT = `SELECT s.*, ou.display_name AS owner_name, uu.display_name AS updated_by_name,
    (SELECT count(*) FROM migration_evidence e WHERE e.owner_type = 'step' AND e.owner_id = s.id) AS evidence_count,
    ARRAY(SELECT d FROM unnest(s.depends_on) d WHERE NOT EXISTS (SELECT 1 FROM migration_run_steps x WHERE x.run_id = s.run_id AND x.code = d AND x.status IN ('done', 'skipped'))
          ORDER BY d) AS waiting_for
  FROM migration_run_steps s LEFT JOIN users ou ON ou.id = s.owner_user_id LEFT JOIN users uu ON uu.id = s.updated_by`;

/** The checklist of a run, by phase and runbook order, with its progress, elapsed time against the plan and next step. */
export async function listSteps(runId) {
  const run = await runRow(runId);
  const steps = (await many(`${STEP_SELECT} WHERE s.run_id = $1 ORDER BY s.sort, s.code`, [run.id])).map(toStep);
  const finished = steps.filter((s) => FINISHED.includes(s.status)).length;
  const next = steps.find((s) => !FINISHED.includes(s.status) && !s.waitingFor.length) || null;
  // the run's own elapsed and planned time, as its timings show them
  const plannedMs = runPlannedMs(run, steps.map((s) => ({ plannedMs: s.plannedStart && s.plannedEnd ? new Date(s.plannedEnd) - new Date(s.plannedStart) : 0 })));
  const elapsedMs = runElapsedMs(run);
  return {
    runId: Number(run.id), runNumber: run.run_number, runStatus: run.status, steps,
    progress: { done: finished, total: steps.length, percent: steps.length ? Math.round((finished * 100) / steps.length) : 0, plannedMs, elapsedMs,
      next: next ? { id: next.id, code: next.code, title: next.title } : null, late: steps.filter((s) => s.late).map((s) => s.code) },
  };
}

/** One step of a run (404 when it is not a step of that run). */
export async function getStep(runId, stepId) {
  if (!/^\d+$/.test(String(stepId))) throw notFound('Checklist step not found');
  const s = await one(`${STEP_SELECT} WHERE s.run_id = $1 AND s.id = $2`, [Number(runId), Number(stepId)]);
  if (!s) throw notFound('Checklist step not found');
  return toStep(s);
}

/** Move a step from one of `from` to `to` with the columns given (compare-and-set); 409 when another user moved it first. */
async function moveStep(step, from, to, cols, user) {
  const keys = Object.keys(cols);
  const set = keys.map((k, i) => `${k} = $${i + 5}`).join(', ');
  const moved = await one(`UPDATE migration_run_steps SET status = $3, updated_by = $4, updated_at = now()${set ? `, ${set}` : ''}
    WHERE id = $1 AND status = ANY($2) RETURNING id`, [step.id, from, to, user.id, ...keys.map((k) => cols[k])]);
  if (!moved) throw conflict(`Step ${step.code} is ${STEP_STATUSES[step.status].toLowerCase()}`);
}

async function stepAction(runId, stepId, action, req, fn) {
  const run = await openRunRow(runId);
  const step = await getStep(run.id, stepId);
  await fn(run, step);
  const after = await getStep(run.id, step.id);
  await audit(req, { entity: 'migration_run_step', entityId: step.id, action, before: { status: step.status, actualStart: step.actualStart, actualEnd: step.actualEnd, notes: step.notes },
    after: { runNumber: run.run_number, code: step.code, status: after.status, actualStart: after.actualStart, actualEnd: after.actualEnd, notes: after.notes } });
  return after;
}

/** Start a step (actual start now): the run is running and the steps it depends on are done or skipped. */
export async function startStep(runId, stepId, user, req) {
  return stepAction(runId, stepId, 'start', req, async (run, step) => {
    if (run.status !== 'running') throw conflict(`Start run ${run.run_number} first`);
    if (step.waitingFor.length) {
      throw Object.assign(conflict(`Step ${step.code} waits for ${step.waitingFor.join(', ')}: done or skipped first`), { details: step.waitingFor.map((c) => ({ path: c, message: `${c} not done` })) });
    }
    if (!['not-started', 'blocked'].includes(step.status)) throw conflict(`Step ${step.code} is ${STEP_STATUSES[step.status].toLowerCase()}`);
    await moveStep(step, ['not-started', 'blocked'], 'in-progress', { actual_start: new Date().toISOString(), actual_end: null }, user);
  });
}

/**
 * Finish a step (actual end now): { note, restorePoint }. A step whose runbook names evidence needs an evidence file or
 * a note saying why there is none; CO-3 records or needs the restore point of the run.
 */
export async function doneStep(runId, stepId, body, user, req) {
  const note = text(body?.note);
  return stepAction(runId, stepId, 'done', req, async (run, step) => {
    if (step.status !== 'in-progress') throw conflict(`Step ${step.code} is ${STEP_STATUSES[step.status].toLowerCase()}: start it first`);
    if (step.evidenceRequired && !step.evidenceCount && !note) {
      throw badRequest('Validation failed', [{ path: 'evidence', message: `Attach the evidence of ${step.code} (${step.evidenceHint}) or give a note saying why there is none` }]);
    }
    if (step.code === RESTORE_POINT_STEP) {
      const value = body?.restorePoint ? Date.parse(String(body.restorePoint)) : null;
      if (body?.restorePoint && Number.isNaN(value)) throw badRequest('Validation failed', [{ path: 'restorePoint', message: 'Give the restore point as a date and time' }]);
      if (value) await one('UPDATE migration_runs SET restore_point = $2 WHERE id = $1 RETURNING id', [run.id, new Date(value).toISOString()]);
      else if (!run.restore_point) throw badRequest('Validation failed', [{ path: 'restorePoint', message: 'Give the restore point noted before the load' }]);
    }
    await moveStep(step, ['in-progress'], 'done', { actual_end: new Date().toISOString(), ...(note ? { notes: note } : {}) }, user);
  });
}

/** Block a step not started or in progress, with a note. */
export async function blockStep(runId, stepId, body, user, req) {
  const note = text(body?.note);
  if (!note) throw badRequest('Validation failed', [{ path: 'note', message: 'Say what blocks the step' }]);
  return stepAction(runId, stepId, 'block', req, (_run, step) => moveStep(step, ['not-started', 'in-progress'], 'blocked', { notes: note }, user));
}

/** Skip a step not started or blocked, with a note. */
export async function skipStep(runId, stepId, body, user, req) {
  const note = text(body?.note);
  if (!note) throw badRequest('Validation failed', [{ path: 'note', message: 'Say why the step is skipped' }]);
  return stepAction(runId, stepId, 'skip', req, (_run, step) => moveStep(step, ['not-started', 'blocked'], 'skipped', { notes: note }, user));
}

/** Change the owner, planned times or notes of a step: { ownerUserId, ownerRole, plannedStart, plannedEnd, notes }. */
export async function updateStep(runId, stepId, body, user, req) {
  const run = await openRunRow(runId);
  const step = await getStep(run.id, stepId);
  const b = body || {};
  const cols = {};
  const errors = [];
  if (b.ownerUserId !== undefined) {
    if (b.ownerUserId && !(await one('SELECT id FROM users WHERE id = $1 AND status = \'active\'', [String(b.ownerUserId)]))) errors.push({ path: 'ownerUserId', message: 'Owner must be an active user' });
    else cols.owner_user_id = b.ownerUserId || null;
  }
  if (b.ownerRole !== undefined) cols.owner_role = text(b.ownerRole, 100);
  if (b.notes !== undefined) cols.notes = text(b.notes);
  for (const [field, column] of [['plannedStart', 'planned_start'], ['plannedEnd', 'planned_end']]) {
    if (b[field] === undefined) continue;
    const t = b[field] ? Date.parse(String(b[field])) : null;
    if (b[field] && Number.isNaN(t)) errors.push({ path: field, message: 'Give a date and time' });
    else cols[column] = t ? new Date(t).toISOString() : null;
  }
  const start = cols.planned_start !== undefined ? cols.planned_start : step.plannedStart && new Date(step.plannedStart).toISOString();
  const end = cols.planned_end !== undefined ? cols.planned_end : step.plannedEnd && new Date(step.plannedEnd).toISOString();
  if (start && end && end < start) errors.push({ path: 'plannedEnd', message: 'Planned end is before the planned start' });
  if (errors.length) throw badRequest('Validation failed', errors);
  const keys = Object.keys(cols);
  if (!keys.length) throw badRequest('Nothing to change');
  await one(`UPDATE migration_run_steps SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_by = $2, updated_at = now() WHERE id = $1 RETURNING id`,
    [step.id, user.id, ...keys.map((k) => cols[k])]);
  const after = await getStep(run.id, step.id);
  await audit(req, { entity: 'migration_run_step', entityId: step.id, action: 'update',
    before: { ownerUserId: step.ownerUserId, ownerRole: step.ownerRole, plannedStart: step.plannedStart, plannedEnd: step.plannedEnd, notes: step.notes },
    after: { runNumber: run.run_number, code: step.code, ownerUserId: after.ownerUserId, ownerRole: after.ownerRole, plannedStart: after.plannedStart, plannedEnd: after.plannedEnd, notes: after.notes } });
  return after;
}

// ------------------------------------------------------------------ runbook template

const toTemplate = (s) => ({ code: s.code, title: s.title, phase: s.phase, phaseLabel: PHASES[s.phase], ownerRole: s.owner_role, offsetLabel: s.offset_label,
  durationMinutes: s.duration_minutes, evidenceHint: s.evidence_hint, dependsOn: s.depends_on || [], sort: s.sort, status: s.status });

/** The runbook template, in order. */
export async function runbook() {
  return (await many('SELECT * FROM go_live_runbook_steps ORDER BY sort, code')).map(toTemplate);
}

/** Change a runbook step (new runs copy it): title, owner role, timetable slot, duration, evidence, dependencies, order, status. */
export async function updateRunbookStep(code, body, user, req) {
  const before = await one('SELECT * FROM go_live_runbook_steps WHERE code = $1', [String(code)]);
  if (!before) throw notFound('Runbook step not found');
  const b = body || {};
  const cols = {};
  const errors = [];
  if (b.title !== undefined) {
    if (!text(b.title, 200)) errors.push({ path: 'title', message: 'Give the title' });
    else cols.title = text(b.title, 200);
  }
  for (const [field, column, max] of [['ownerRole', 'owner_role', 100], ['offsetLabel', 'offset_label', 100], ['evidenceHint', 'evidence_hint', 500]]) {
    if (b[field] !== undefined) cols[column] = text(b[field], max);
  }
  if (b.durationMinutes !== undefined) {
    const n = b.durationMinutes === null || b.durationMinutes === '' ? null : Number(b.durationMinutes);
    if (n !== null && (!Number.isInteger(n) || n < 0)) errors.push({ path: 'durationMinutes', message: 'Duration: whole minutes' });
    else cols.duration_minutes = n;
  }
  if (b.sort !== undefined) {
    if (!Number.isInteger(Number(b.sort))) errors.push({ path: 'sort', message: 'Order: a whole number' });
    else cols.sort = Number(b.sort);
  }
  if (b.status !== undefined) {
    if (!['active', 'inactive'].includes(b.status)) errors.push({ path: 'status', message: 'Status: active or inactive' });
    else cols.status = b.status;
  }
  if (b.dependsOn !== undefined) {
    const deps = [...new Set((Array.isArray(b.dependsOn) ? b.dependsOn : []).map(String))];
    const known = new Set((await many('SELECT code FROM go_live_runbook_steps')).map((x) => x.code));
    const unknown = deps.filter((d) => !known.has(d) || d === before.code);
    if (unknown.length) errors.push({ path: 'dependsOn', message: `Not another runbook step: ${unknown.join(', ')}` });
    else cols.depends_on = deps;
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  const keys = Object.keys(cols);
  if (!keys.length) throw badRequest('Nothing to change');
  await one(`UPDATE go_live_runbook_steps SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE code = $1 RETURNING code`, [before.code, ...keys.map((k) => cols[k])]);
  const after = toTemplate(await one('SELECT * FROM go_live_runbook_steps WHERE code = $1', [before.code]));
  await audit(req, { entity: 'go_live_runbook_step', entityId: before.code, action: 'update', before: toTemplate(before), after });
  return after;
}

// ------------------------------------------------------------------ defects

/** Defects of a run. */
export async function listDefects(runId) {
  const run = await runRow(runId);
  return runDefects(run.id);
}

/** Fields of a defect from a body; load and step must belong to the run. */
async function defectFields(runId, b, { create = false } = {}) {
  const out = {};
  const errors = [];
  if (create || b.title !== undefined) {
    if (!text(b.title, 300)) errors.push({ path: 'title', message: 'Give the title' });
    else out.title = text(b.title, 300);
  }
  if (create || b.severity !== undefined) {
    const s = Number(b.severity);
    if (!Number.isInteger(s) || s < 1 || s > 4) errors.push({ path: 'severity', message: 'Severity: 1 (critical) to 4' });
    else out.severity = s;
  }
  if (b.status !== undefined) {
    if (!DEFECT_STATUSES[b.status]) errors.push({ path: 'status', message: `Status: ${Object.keys(DEFECT_STATUSES).join(', ')}` });
    else out.status = b.status;
  }
  for (const [field, column, max] of [['object', 'object', 100], ['owner', 'owner', 200], ['description', 'description', 4000], ['resolution', 'resolution', 4000]]) {
    if (b[field] !== undefined) out[column] = text(b[field], max);
  }
  if (b.batchId !== undefined) {
    if (b.batchId && !(await one('SELECT id FROM data_load_batches WHERE id = $1 AND run_id = $2', [Number(b.batchId) || 0, runId]))) {
      errors.push({ path: 'batchId', message: 'Load must be a load of this run' });
    } else out.batch_id = b.batchId ? Number(b.batchId) : null;
  }
  if (b.stepId !== undefined) {
    if (b.stepId && !(await one('SELECT id FROM migration_run_steps WHERE id = $1 AND run_id = $2', [Number(b.stepId) || 0, runId]))) {
      errors.push({ path: 'stepId', message: 'Step must be a checklist step of this run' });
    } else out.step_id = b.stepId ? Number(b.stepId) : null;
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  return out;
}

async function getDefect(runId, defectId) {
  const d = (await runDefects(runId)).find((x) => String(x.id) === String(defectId));
  if (!d) throw notFound('Defect not found');
  return d;
}

/** Record a defect of a run (write:data-load). */
export async function createDefect(runId, body, user, req) {
  const run = await runRow(runId);
  if (run.status === 'cancelled') throw conflict(`Run ${run.run_number} is cancelled`);
  const f = await defectFields(run.id, body || {}, { create: true });
  const cols = Object.keys(f);
  const r = await one(`INSERT INTO migration_run_defects(run_id, found_by, ${cols.join(', ')}${f.status === 'closed' ? ', closed_at' : ''})
    VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}${f.status === 'closed' ? ', now()' : ''}) RETURNING id`, [run.id, user.id, ...cols.map((c) => f[c])]);
  const d = await getDefect(run.id, r.id);
  await audit(req, { entity: 'migration_run_defect', entityId: d.id, action: 'create', after: { runNumber: run.run_number, ...d } });
  return d;
}

/** Change a defect (write:data-load); closing it records when. */
export async function updateDefect(runId, defectId, body, user, req) {
  const run = await runRow(runId);
  const before = await getDefect(run.id, defectId);
  const f = await defectFields(run.id, body || {});
  const cols = Object.keys(f);
  if (!cols.length) throw badRequest('Nothing to change');
  await one(`UPDATE migration_run_defects SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')},
      closed_at = CASE WHEN COALESCE($${cols.length + 2}, status) = 'closed' THEN COALESCE(closed_at, now()) ELSE NULL END
    WHERE id = $1 RETURNING id`, [before.id, ...cols.map((c) => f[c]), f.status ?? null]);
  const after = await getDefect(run.id, before.id);
  await audit(req, { entity: 'migration_run_defect', entityId: before.id, action: 'update', before, after });
  return after;
}
