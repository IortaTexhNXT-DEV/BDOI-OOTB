/**
 * Mock Runs of Data Migration & Go-Live (migration 0444): Mock 1, Mock 2, the dress rehearsal, an extra mock and the
 * production run (one at a time that is not cancelled). A run is the frame of a migration attempt: its loads
 * (data_load_batches.run_id), reconciliations, checklist (cutover.js), defects, Go / No-Go decisions (decisions.js) and
 * evidence (evidence.js) belong to it.
 *
 * Creating a run copies the active steps of the runbook template into its checklist. A run is planned, then running
 * (Start), then completed or failed (Complete, with its result, whether the exit criteria were met and a summary) or
 * cancelled. A run that used a production extract records the DPO approval. The restore point noted before the load
 * (cutover step CO-3) and the SHA-256 of the evidence pack with its archive reference (criterion G11) are recorded on
 * the run; the hash must be the hash of a pack of this run downloaded from the workspace.
 *
 * Timings: elapsed time of each checklist step, validate / load / undo time of each load with its rows per second,
 * elapsed time of the run. Report: XLSX or PDF of the timings, loads, results and defects.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { getSetting } from '../../lib/settings.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { renderPdf } from '../../lib/pdf/index.js';
import { isDate } from './common.js';

export const RUN_KINDS = { 'mock-1': 'Mock 1', 'mock-2': 'Mock 2', 'dress-rehearsal': 'Dress rehearsal', 'extra-mock': 'Extra mock', production: 'Production' };
export const RUN_STATUSES = { planned: 'Planned', running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' };
export const RUN_RESULTS = { passed: 'Passed', 'passed-with-issues': 'Passed with issues', failed: 'Failed' };
export const PERSONAL_DATA = { synthetic: 'Synthetic', 'masked-copy': 'Masked copy', 'production-extract': 'Production extract' };
/** Statuses of a run that still takes loads, checklist updates and evidence. */
export const OPEN_RUN = ['planned', 'running'];
const IN_PROGRESS_BATCH = ['validating', 'pending-approval', 'running', 'undo-pending', 'undoing'];
const SHA256 = /^[0-9a-f]{64}$/;

/** A step is late when it ended after its planned end, or is still open past it. */
export const isLate = (s) => !!(s.planned_end && (s.actual_end ? new Date(s.actual_end) > new Date(s.planned_end)
  : !['done', 'skipped'].includes(s.status) && new Date(s.planned_end) < new Date()));
const ms = (a, b) => (a && b ? new Date(b).getTime() - new Date(a).getTime() : null);
const text = (v, max = 2000) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
/** A timestamp of the body: null, or an ISO date-time (400 otherwise). */
function timeOf(v, path) {
  if (v === null || v === undefined || v === '') return null;
  const t = Date.parse(String(v));
  if (Number.isNaN(t)) throw badRequest('Validation failed', [{ path, message: 'Give a date and time' }]);
  return new Date(t).toISOString();
}

const toRun = (r) => r && ({
  id: Number(r.id), runNumber: r.run_number, kind: r.kind, kindLabel: RUN_KINDS[r.kind], title: r.title, environment: r.environment, cutoverDate: r.cutover_date,
  plannedStart: r.planned_start, plannedEnd: r.planned_end, actualStart: r.actual_start, actualEnd: r.actual_end, durationMs: ms(r.actual_start, r.actual_end),
  status: r.status, statusLabel: RUN_STATUSES[r.status], result: r.result, resultLabel: RUN_RESULTS[r.result] || null, exitCriteria: r.exit_criteria,
  exitCriteriaMet: r.exit_criteria_met, summary: r.summary, personalData: r.personal_data, personalDataLabel: PERSONAL_DATA[r.personal_data] || null,
  dpoApprovalRef: r.dpo_approval_ref, restorePoint: r.restore_point, evidencePackSha256: r.evidence_pack_sha256, archiveRef: r.archive_ref,
  loads: r.loads === undefined ? undefined : Number(r.loads), defectsOpen: r.defects_open === undefined ? undefined : Number(r.defects_open),
  defectsTotal: r.defects_total === undefined ? undefined : Number(r.defects_total),
  createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, closedBy: r.closed_by_name || r.closed_by, closedAt: r.closed_at,
});
const RUN_SELECT = `SELECT r.*, cu.display_name AS created_by_name, xu.display_name AS closed_by_name,
    (SELECT count(*) FROM data_load_batches b WHERE b.run_id = r.id) AS loads,
    (SELECT count(*) FROM migration_run_defects d WHERE d.run_id = r.id AND d.status IN ('open', 'fixed', 'retest')) AS defects_open,
    (SELECT count(*) FROM migration_run_defects d WHERE d.run_id = r.id) AS defects_total
  FROM migration_runs r LEFT JOIN users cu ON cu.id = r.created_by LEFT JOIN users xu ON xu.id = r.closed_by`;

/** The run row (404 when missing). */
export async function runRow(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Run not found');
  const r = await one('SELECT * FROM migration_runs WHERE id = $1', [Number(id)]);
  if (!r) throw notFound('Run not found');
  return r;
}
/** The run row, refused (409) once it is completed, failed or cancelled. */
export async function openRunRow(id) {
  const r = await runRow(id);
  if (!OPEN_RUN.includes(r.status)) throw conflict(`Run ${r.run_number} is ${RUN_STATUSES[r.status].toLowerCase()}`);
  return r;
}

/** The run a load is uploaded to: an open run (planned or running), or null when none is named. */
export async function runForLoad(runId) {
  if (runId === null || runId === undefined || runId === '') return null;
  if (!/^\d+$/.test(String(runId))) throw badRequest('Validation failed', [{ path: 'runId', message: 'Run must be the id of a run' }]);
  return Number((await openRunRow(runId)).id);
}

/** The run the workspace shows by default: the production run, else the latest planned or running run, else the latest. */
export async function currentRun() {
  const r = await one(`SELECT id FROM migration_runs WHERE status <> 'cancelled'
    ORDER BY (kind = 'production') DESC, (status IN ('planned', 'running')) DESC, id DESC LIMIT 1`);
  return r ? Number(r.id) : null;
}

/** Runs, newest first: filters kind, status. */
export async function listRuns({ kind = null, status = null } = {}, pg = { limit: 50, offset: 0 }) {
  const where = 'WHERE ($1::text IS NULL OR r.kind = $1) AND ($2::text IS NULL OR r.status = $2)';
  const params = [kind || null, status || null];
  const total = (await one(`SELECT count(*)::int AS n FROM migration_runs r ${where}`, params)).n;
  const rows = await many(`${RUN_SELECT} ${where} ORDER BY r.id DESC LIMIT $3 OFFSET $4`, [...params, pg.limit, pg.offset]);
  return { total, rows: rows.map(toRun) };
}

/** Loads of a run with their timings and rows per second. */
async function runLoads(runId) {
  const rows = await many(`SELECT id, load_number, kit, file_name, status, rows_read, rows_new, rows_changed, rows_unchanged, rows_duplicate, rows_error, valid_rows_only,
      validate_ms, load_ms, undo_ms, loaded_at, undone_at, file_sha256 FROM data_load_batches WHERE run_id = $1 ORDER BY id`, [runId]);
  return rows.map((b) => ({
    id: Number(b.id), loadNumber: b.load_number, kit: b.kit, fileName: b.file_name, status: b.status, rowsRead: b.rows_read, rowsNew: b.rows_new, rowsChanged: b.rows_changed,
    rowsUnchanged: b.rows_unchanged, rowsDuplicate: b.rows_duplicate, rowsError: b.rows_error, validRowsOnly: b.valid_rows_only, validateMs: b.validate_ms, loadMs: b.load_ms,
    undoMs: b.undo_ms, rowsPerSecond: b.load_ms ? Math.round((b.rows_read * 1000) / b.load_ms) : null, loadedAt: b.loaded_at, undoneAt: b.undone_at, fileSha256: b.file_sha256,
  }));
}

/** Checklist steps of a run with their elapsed and planned minutes (the Timings tab). */
async function runTimings(runId) {
  const rows = await many(`SELECT code, title, phase, status, planned_start, planned_end, actual_start, actual_end FROM migration_run_steps WHERE run_id = $1 ORDER BY sort, code`, [runId]);
  return rows.map((s) => ({ code: s.code, title: s.title, phase: s.phase, status: s.status, plannedStart: s.planned_start, plannedEnd: s.planned_end, actualStart: s.actual_start,
    actualEnd: s.actual_end, plannedMs: ms(s.planned_start, s.planned_end), elapsedMs: ms(s.actual_start, s.actual_end),
    late: isLate(s) }));
}

/** One run: the record, its loads with timings, the checklist timings, reconciliations, defects by status and decisions. */
export async function getRun(id) {
  const r = await runRow(id);
  const run = toRun(await one(`${RUN_SELECT} WHERE r.id = $1`, [r.id]));
  const loads = await runLoads(r.id);
  const steps = await runTimings(r.id);
  const reconciliations = (await many(`SELECT id, recon_number, status, signed_at, superseded_at, created_at FROM migration_reconciliations WHERE run_id = $1 ORDER BY id DESC`, [r.id]))
    .map((x) => ({ id: Number(x.id), reconNumber: x.recon_number, status: x.status, signedAt: x.signed_at, supersededAt: x.superseded_at, createdAt: x.created_at }));
  const decisions = (await many('SELECT id, status, decided_at, new_date, created_at FROM go_live_decisions WHERE run_id = $1 ORDER BY id DESC', [r.id]))
    .map((d) => ({ id: Number(d.id), status: d.status, decidedAt: d.decided_at, newDate: d.new_date, createdAt: d.created_at }));
  const defects = Object.fromEntries((await many('SELECT status, count(*)::int AS n FROM migration_run_defects WHERE run_id = $1 GROUP BY status', [r.id])).map((x) => [x.status, x.n]));
  const sum = (k) => loads.reduce((s, b) => s + (b[k] || 0), 0);
  return {
    ...run, loadsList: loads, steps, reconciliations, decisions, defectsByStatus: defects,
    timings: { validateMs: sum('validateMs'), loadMs: sum('loadMs'), undoMs: sum('undoMs'), rowsLoaded: loads.filter((b) => b.status === 'loaded').reduce((s, b) => s + b.rowsRead, 0),
      stepsDone: steps.filter((s) => ['done', 'skipped'].includes(s.status)).length, steps: steps.length, lateSteps: steps.filter((s) => s.late).map((s) => s.code), elapsedMs: run.durationMs },
  };
}

/** Fields of a run from a body (create and update): only the keys present; 400 on a wrong value. */
function runFields(b, { create = false } = {}) {
  const out = {};
  const errors = [];
  if (create || b.kind !== undefined) {
    if (!RUN_KINDS[b.kind]) errors.push({ path: 'kind', message: `Kind must be one of ${Object.keys(RUN_KINDS).join(', ')}` });
    else out.kind = b.kind;
  }
  if (create || b.title !== undefined) {
    if (!text(b.title, 200)) errors.push({ path: 'title', message: 'Give the title' });
    else out.title = text(b.title, 200);
  }
  if (b.cutoverDate !== undefined) {
    if (b.cutoverDate && !isDate(b.cutoverDate)) errors.push({ path: 'cutoverDate', message: 'Cutover date must be a date YYYY-MM-DD' });
    else out.cutover_date = b.cutoverDate || null;
  }
  for (const [field, column] of [['plannedStart', 'planned_start'], ['plannedEnd', 'planned_end'], ['restorePoint', 'restore_point']]) {
    if (b[field] === undefined) continue;
    try {
      out[column] = timeOf(b[field], field);
    } catch (e) {
      errors.push(...e.details);
    }
  }
  if (b.personalData !== undefined) {
    if (b.personalData && !PERSONAL_DATA[b.personalData]) errors.push({ path: 'personalData', message: `Personal data used: ${Object.keys(PERSONAL_DATA).join(', ')}` });
    else out.personal_data = b.personalData || null;
  }
  for (const [field, column, max] of [['dpoApprovalRef', 'dpo_approval_ref', 200], ['exitCriteria', 'exit_criteria', 4000], ['summary', 'summary', 4000], ['archiveRef', 'archive_ref', 500]]) {
    if (b[field] !== undefined) out[column] = text(b[field], max);
  }
  if (b.evidencePackSha256 !== undefined) {
    const h = String(b.evidencePackSha256 || '').trim().toLowerCase();
    if (h && !SHA256.test(h)) errors.push({ path: 'evidencePackSha256', message: 'SHA-256: 64 hexadecimal characters' });
    else out.evidence_pack_sha256 = h || null;
  }
  if (out.planned_start && out.planned_end && out.planned_end < out.planned_start) errors.push({ path: 'plannedEnd', message: 'Planned end is before the planned start' });
  if (errors.length) throw badRequest('Validation failed', errors);
  return out;
}

/** A run that used a production extract records the DPO approval. */
function assertDpo(run) {
  if (run.personal_data === 'production-extract' && !run.dpo_approval_ref) {
    throw badRequest('Validation failed', [{ path: 'dpoApprovalRef', message: 'A production extract needs the reference of the DPO approval' }]);
  }
}

/** Create a run (write:data-load) and its checklist from the runbook template. */
export async function createRun(body, user, req) {
  const f = runFields(body || {}, { create: true });
  assertDpo(f);
  const environment = String((await getSetting('system.environment', 'dev')) || 'dev').toLowerCase();
  const cutover = f.cutover_date ?? (String((await getSetting('golive.cutover_date', '')) || '').trim() || null);
  let id;
  try {
    id = await withTransaction(async (db) => {
      const r = (await db.query(`INSERT INTO migration_runs(kind, title, environment, cutover_date, planned_start, planned_end, personal_data, dpo_approval_ref, exit_criteria, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [f.kind, f.title, environment, isDate(cutover) ? cutover : null, f.planned_start ?? null, f.planned_end ?? null, f.personal_data ?? null, f.dpo_approval_ref ?? null,
        f.exit_criteria ?? null, user.id])).rows[0];
      await db.query(`INSERT INTO migration_run_steps(run_id, code, title, phase, sort, owner_role, offset_label, duration_minutes, evidence_hint, depends_on)
        SELECT $1, code, title, phase, sort, owner_role, offset_label, duration_minutes, evidence_hint, depends_on FROM go_live_runbook_steps WHERE status = 'active'`, [r.id]);
      return r.id;
    });
  } catch (e) {
    if (e.code === '23505') throw conflict('A production run already exists: cancel it before creating another');
    throw e;
  }
  const run = await getRun(id);
  await audit(req, { entity: 'migration_run', entityId: run.id, action: 'create', after: { runNumber: run.runNumber, kind: run.kind, title: run.title, environment, steps: run.steps.length } });
  return run;
}

/**
 * The SHA-256 recorded for a run must be the hash of an evidence pack of that run downloaded from the workspace
 * (audit entries migration_run / evidence-pack).
 */
async function assertPackHash(runId, sha) {
  if (!sha) return;
  const seen = await one(`SELECT 1 FROM audit_log WHERE entity = 'migration_run' AND entity_id = $1 AND action = 'evidence-pack' AND after_data->>'sha256' = $2 LIMIT 1`,
    [String(runId), sha]);
  if (!seen) throw badRequest('Validation failed', [{ path: 'evidencePackSha256', message: 'Not the SHA-256 of an evidence pack of this run downloaded from the workspace' }]);
}

/**
 * Change a run (write:data-load): planning, personal data, exit criteria, summary, restore point, evidence pack hash and
 * archive reference. A completed or failed run keeps only its evidence pack hash and archive reference open; a cancelled
 * one nothing.
 */
export async function updateRun(id, body, user, req) {
  const r = await runRow(id);
  const f = runFields(body || {});
  if (f.kind && f.kind !== r.kind) throw conflict('The kind of a run does not change: cancel it and create another');
  delete f.kind;
  if (!Object.keys(f).length) throw badRequest('Nothing to change');
  if (r.status === 'cancelled') throw conflict(`Run ${r.run_number} is cancelled`);
  if (!OPEN_RUN.includes(r.status) && Object.keys(f).some((k) => !['evidence_pack_sha256', 'archive_ref'].includes(k))) {
    throw conflict(`Run ${r.run_number} is ${RUN_STATUSES[r.status].toLowerCase()}: only the evidence pack and its archive reference can still be recorded`);
  }
  if (f.evidence_pack_sha256 !== undefined) await assertPackHash(r.id, f.evidence_pack_sha256);
  assertDpo({ ...r, ...f });
  const before = await getRun(r.id);
  const cols = Object.keys(f);
  await one(`UPDATE migration_runs SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING id`, [r.id, ...cols.map((c) => f[c])]);
  const after = await getRun(r.id);
  const pick = (x) => Object.fromEntries(Object.keys(body || {}).filter((k) => k in x).map((k) => [k, x[k]]));
  await audit(req, { entity: 'migration_run', entityId: r.id, action: 'update', before: pick(before), after: pick(after) });
  return after;
}

/** Start a planned run (actual start now). */
export async function startRun(id, user, req) {
  const r = await runRow(id);
  const moved = await one(`UPDATE migration_runs SET status = 'running', actual_start = now() WHERE id = $1 AND status = 'planned' RETURNING id`, [r.id]);
  if (!moved) throw conflict(`Run ${r.run_number} is ${RUN_STATUSES[r.status].toLowerCase()}: only a planned run starts`);
  const run = await getRun(r.id);
  await audit(req, { entity: 'migration_run', entityId: r.id, action: 'start', after: { runNumber: run.runNumber, actualStart: run.actualStart } });
  return run;
}

/** Loads of a run still being validated, waiting for approval, running or being undone. */
async function assertNoLoadInProgress(r, what) {
  const busy = await many('SELECT load_number FROM data_load_batches WHERE run_id = $1 AND status = ANY($2) ORDER BY id', [r.id, IN_PROGRESS_BATCH]);
  if (busy.length) throw conflict(`Run ${r.run_number} cannot be ${what}: ${busy.map((b) => b.load_number).join(', ')} in progress`);
}

/** Complete a running run: { result, exitCriteriaMet, summary }; a failed result ends it as failed. */
export async function completeRun(id, body, user, req) {
  const r = await runRow(id);
  const b = body || {};
  const errors = [];
  if (!RUN_RESULTS[b.result]) errors.push({ path: 'result', message: `Result must be one of ${Object.keys(RUN_RESULTS).join(', ')}` });
  if (typeof b.exitCriteriaMet !== 'boolean') errors.push({ path: 'exitCriteriaMet', message: 'Say whether the exit criteria were met' });
  if (!text(b.summary)) errors.push({ path: 'summary', message: 'Give the summary of the run' });
  if (errors.length) throw badRequest('Validation failed', errors);
  if (r.status !== 'running') throw conflict(`Run ${r.run_number} is ${RUN_STATUSES[r.status].toLowerCase()}: only a running run is completed`);
  await assertNoLoadInProgress(r, 'completed');
  const moved = await one(`UPDATE migration_runs SET status = $2, result = $3, exit_criteria_met = $4, summary = $5, actual_end = now(), closed_by = $6, closed_at = now()
    WHERE id = $1 AND status = 'running' RETURNING id`, [r.id, b.result === 'failed' ? 'failed' : 'completed', b.result, b.exitCriteriaMet, text(b.summary, 4000), user.id]);
  if (!moved) throw conflict(`Run ${r.run_number} was changed by another user`);
  const run = await getRun(r.id);
  await audit(req, { entity: 'migration_run', entityId: r.id, action: 'complete', after: { runNumber: run.runNumber, status: run.status, result: run.result, exitCriteriaMet: run.exitCriteriaMet,
    summary: run.summary, durationMs: run.durationMs } });
  return run;
}

/** Cancel a planned or running run with a reason; the production run is never cancelled once go-live is locked. */
export async function cancelRun(id, body, user, req) {
  const r = await runRow(id);
  const reason = text(body?.reason, 2000);
  if (!reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason' }]);
  if (!OPEN_RUN.includes(r.status)) throw conflict(`Run ${r.run_number} is ${RUN_STATUSES[r.status].toLowerCase()}`);
  if (r.kind === 'production' && (await getSetting('golive.locked', false)) === true) throw conflict('Go-live is locked: the production run is not cancelled');
  await assertNoLoadInProgress(r, 'cancelled');
  const moved = await one(`UPDATE migration_runs SET status = 'cancelled', summary = $2, actual_end = COALESCE(actual_end, CASE WHEN actual_start IS NOT NULL THEN now() END),
      closed_by = $3, closed_at = now() WHERE id = $1 AND status IN ('planned', 'running') RETURNING id`, [r.id, reason, user.id]);
  if (!moved) throw conflict(`Run ${r.run_number} was changed by another user`);
  const run = await getRun(r.id);
  await audit(req, { entity: 'migration_run', entityId: r.id, action: 'cancel', after: { runNumber: run.runNumber, reason } });
  return run;
}

// ------------------------------------------------------------------ report

const minutes = (v) => (v === null || v === undefined ? '' : Math.round(v / 60000));
const seconds = (v) => (v === null || v === undefined ? '' : Math.round(v / 100) / 10);
const at = (v) => (v ? new Date(v).toISOString().replace('T', ' ').slice(0, 16) : '');

/** Defects of a run, newest first. */
export async function runDefects(runId) {
  return (await many(`SELECT d.*, b.load_number, s.code AS step_code, fu.display_name AS found_by_name FROM migration_run_defects d
      LEFT JOIN data_load_batches b ON b.id = d.batch_id LEFT JOIN migration_run_steps s ON s.id = d.step_id LEFT JOIN users fu ON fu.id = d.found_by
     WHERE d.run_id = $1 ORDER BY d.id DESC`, [runId])).map((d) => ({
    id: Number(d.id), defectNumber: d.defect_number, runId: Number(d.run_id), title: d.title, object: d.object, severity: d.severity, status: d.status, owner: d.owner,
    batchId: d.batch_id === null ? null : Number(d.batch_id), loadNumber: d.load_number, stepId: d.step_id === null ? null : Number(d.step_id), stepCode: d.step_code,
    description: d.description, resolution: d.resolution, foundBy: d.found_by_name || d.found_by, foundById: d.found_by, foundAt: d.found_at, closedAt: d.closed_at,
  }));
}

/** Sheets of the run report and of the evidence pack's run summary. */
export async function runReportSheets(run) {
  const defects = await runDefects(run.id);
  return [
    { name: 'Summary', columns: [{ header: 'Item', width: 28 }, { header: 'Value', width: 60 }], rows: [
      ['Run', run.runNumber], ['Kind', run.kindLabel], ['Title', run.title], ['Environment', run.environment], ['Cutover date', run.cutoverDate || ''],
      ['Status', run.statusLabel], ['Result', run.resultLabel || ''], ['Exit criteria', run.exitCriteria || ''], ['Exit criteria met', run.exitCriteriaMet === null ? '' : run.exitCriteriaMet ? 'Yes' : 'No'],
      ['Personal data used', run.personalDataLabel || ''], ['DPO approval', run.dpoApprovalRef || ''], ['Planned', `${at(run.plannedStart)} - ${at(run.plannedEnd)}`],
      ['Actual', `${at(run.actualStart)} - ${at(run.actualEnd)}`], ['Elapsed (minutes)', minutes(run.durationMs)], ['Restore point', at(run.restorePoint)],
      ['Archive reference', run.archiveRef || ''], ['Summary', run.summary || '']] },
    { name: 'Timings', columns: ['Step', 'Title', 'Phase', 'Status', 'Planned start', 'Planned end', 'Actual start', 'Actual end', 'Planned (min)', 'Elapsed (min)', 'Late'].map((h) => ({ header: h })),
      rows: run.steps.map((s) => [s.code, s.title, s.phase, s.status, at(s.plannedStart), at(s.plannedEnd), at(s.actualStart), at(s.actualEnd), minutes(s.plannedMs), minutes(s.elapsedMs), s.late ? 'Yes' : ''] ) },
    { name: 'Loads', columns: ['Load No.', 'Kit', 'File', 'Status', 'Rows', 'New', 'Changed', 'Unchanged', 'Duplicate', 'Error', 'Validate (s)', 'Load (s)', 'Undo (s)', 'Rows per second', 'File SHA-256']
      .map((h) => ({ header: h })),
    rows: run.loadsList.map((b) => [b.loadNumber, b.kit, b.fileName || '', b.status, b.rowsRead, b.rowsNew, b.rowsChanged, b.rowsUnchanged, b.rowsDuplicate, b.rowsError,
      seconds(b.validateMs), seconds(b.loadMs), seconds(b.undoMs), b.rowsPerSecond ?? '', b.fileSha256 || '']) },
    { name: 'Results', columns: ['Reconciliation', 'Status', 'Signed at', 'Superseded at'].map((h) => ({ header: h })),
      rows: run.reconciliations.map((x) => [x.reconNumber, x.status, at(x.signedAt), at(x.supersededAt)]) },
    { name: 'Defects', columns: ['Defect No.', 'Title', 'Object', 'Severity', 'Status', 'Owner', 'Load', 'Step', 'Description', 'Resolution', 'Found at', 'Closed at'].map((h) => ({ header: h })),
      rows: defects.map((d) => [d.defectNumber, d.title, d.object || '', d.severity, d.status, d.owner || '', d.loadNumber || '', d.stepCode || '', d.description || '', d.resolution || '',
        at(d.foundAt), at(d.closedAt)]) },
  ];
}

/** The run report: { fileName, contentType, buffer } as XLSX or PDF, built when downloaded. */
export async function runReport(id, format = 'xlsx') {
  const run = await getRun(id);
  const sheets = await runReportSheets(run);
  if (format === 'xlsx') {
    return { fileName: `${run.runNumber}_Run_Report.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: writeXlsx({ sheets, title: `${run.runNumber} run report` }) };
  }
  const [summary, ...tables] = sheets;
  const buffer = await renderPdf({
    title: 'Migration run report', number: run.runNumber, orientation: 'landscape', meta: summary.rows.map(([k, v]) => [k, String(v ?? '') || '-']),
    sections: tables.map((t) => ({ heading: t.name, table: { columns: t.columns.map((c) => c.header), rows: t.rows.length ? t.rows : [t.columns.map((_, i) => (i === 0 ? 'None' : ''))] } })),
  });
  return { fileName: `${run.runNumber}_Run_Report.pdf`, contentType: 'application/pdf', buffer };
}
