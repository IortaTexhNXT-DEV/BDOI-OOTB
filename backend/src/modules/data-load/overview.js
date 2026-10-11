/**
 * Overview tab of Data Migration & Go-Live: where the programme stands for the user who opens it.
 *   phases      Templates, Mock 1, Mock 2, Dress rehearsal, Cutover, Go-live, Hypercare, each not started, in progress
 *               or done, from the loads, the runs of each kind, the go-live lock and the hypercare period
 *   run         the current run (runs.js currentRun): checklist progress, latest reconciliation, latest decision
 *   loads       migration and configuration loads by status, rows of the loaded migration loads by result, latest five
 *   defects     open defects of severity 1 and 2 of every run that is not cancelled
 *   forMe       what waits for this user: loads, undos and lock requests to approve (not their own), votes on a decision
 *               in voting, checklist steps they own that are not done
 */
import { many, one, pool } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { lockState } from '../../lib/goLiveLock.js';
import { currentRun } from './runs.js';
import { isDate } from './common.js';

const APPROVE = 'approve:data-load';
const PHASE_KINDS = [['mock-1', 'Mock 1'], ['mock-2', 'Mock 2'], ['dress-rehearsal', 'Dress rehearsal']];

/** Status of a phase from the runs of its kind: done when one completed, in progress when one is planned or running. */
const phaseOf = (runs) => (runs.some((r) => r.status === 'completed') ? 'done' : runs.some((r) => ['planned', 'running', 'failed'].includes(r.status)) ? 'in-progress' : 'not-started');

export async function overview(user) {
  const state = await lockState(pool);
  const cutover = String((await getSetting('golive.cutover_date', '')) || '').trim();
  const hypercareDays = Number(await getSetting('migration.hypercare_days', 28)) || 28;
  const runs = await many('SELECT id, kind, status FROM migration_runs WHERE status <> \'cancelled\' ORDER BY id');
  const anyLoad = await one('SELECT 1 FROM data_load_batches LIMIT 1');
  const production = runs.filter((r) => r.kind === 'production');
  const sinceLock = state.lockedAt ? (Date.now() - new Date(state.lockedAt).getTime()) / 86400000 : null;
  const phases = [
    { key: 'templates', label: 'Templates', status: anyLoad ? 'done' : 'not-started' },
    ...PHASE_KINDS.map(([kind, label]) => ({ key: kind, label, status: phaseOf(runs.filter((r) => r.kind === kind)) })),
    // the cutover is done when its run is completed (the checklist finished), not when the lock goes on
    { key: 'cutover', label: 'Cutover', status: phaseOf(production) },
    { key: 'go-live', label: 'Go-live', status: state.locked ? 'done' : 'not-started' },
    { key: 'hypercare', label: 'Hypercare', status: !state.locked ? 'not-started' : sinceLock >= hypercareDays ? 'done' : 'in-progress' },
  ];

  const runId = await currentRun();
  let run = null;
  if (runId) {
    const r = await one('SELECT id, run_number, kind, title, status FROM migration_runs WHERE id = $1', [runId]);
    const steps = await one(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('done', 'skipped'))::int AS done,
        count(*) FILTER (WHERE status = 'blocked')::int AS blocked FROM migration_run_steps WHERE run_id = $1`, [runId]);
    const recon = await one(`SELECT r.id, r.recon_number, r.status, (SELECT count(*)::int FROM migration_recon_differences d WHERE d.recon_id = r.id AND d.status = 'open') AS open_differences
      FROM migration_reconciliations r WHERE r.run_id = $1 AND r.status <> 'superseded' ORDER BY r.id DESC LIMIT 1`, [runId]);
    const decision = await one('SELECT id, status, decided_at FROM go_live_decisions WHERE run_id = $1 AND status <> \'withdrawn\' ORDER BY id DESC LIMIT 1', [runId]);
    run = {
      id: Number(r.id), runNumber: r.run_number, kind: r.kind, title: r.title, status: r.status,
      checklist: { done: steps.done, total: steps.total, blocked: steps.blocked, percent: steps.total ? Math.round((steps.done * 100) / steps.total) : 0 },
      reconciliation: recon ? { id: Number(recon.id), reconNumber: recon.recon_number, status: recon.status, openDifferences: recon.open_differences } : null,
      decision: decision ? { id: Number(decision.id), status: decision.status, decidedAt: decision.decided_at } : null,
    };
  }

  const byStatus = Object.fromEntries((await many('SELECT status, count(*)::int AS n FROM data_load_batches GROUP BY status')).map((x) => [x.status, x.n]));
  const rows = await one(`SELECT COALESCE(sum(rows_new), 0)::int AS new, COALESCE(sum(rows_changed), 0)::int AS changed, COALESCE(sum(rows_unchanged), 0)::int AS unchanged,
      COALESCE(sum(rows_duplicate), 0)::int AS duplicate FROM data_load_batches WHERE kit = 'migration' AND status = 'loaded'`);
  const latest = (await many(`SELECT id, load_number, kit, file_name, status, created_at, loaded_at FROM data_load_batches ORDER BY id DESC LIMIT 5`))
    .map((b) => ({ id: Number(b.id), loadNumber: b.load_number, kit: b.kit, fileName: b.file_name, status: b.status, createdAt: b.created_at, loadedAt: b.loaded_at }));
  // a defect stays open until closed or deferred, whether its run is open or completed (a Mock 1 defect is still a defect)
  const defects = await one(`SELECT count(*) FILTER (WHERE d.severity = 1)::int AS sev1, count(*) FILTER (WHERE d.severity = 2)::int AS sev2 FROM migration_run_defects d
    JOIN migration_runs r ON r.id = d.run_id WHERE d.status IN ('open', 'fixed', 'retest') AND r.status <> 'cancelled'`);

  const approver = hasPermission(user, APPROVE);
  const toApprove = approver ? (await many(`SELECT id, load_number, status FROM data_load_batches
      WHERE (status = 'pending-approval' AND created_by IS DISTINCT FROM $1 AND submitted_by IS DISTINCT FROM $1)
         OR (status = 'undo-pending' AND undo_requested_by IS DISTINCT FROM $1) ORDER BY id`, [user.id]))
    .map((b) => ({ type: b.status === 'undo-pending' ? 'undo' : 'load', id: Number(b.id), reference: b.load_number })) : [];
  const lockRequests = approver ? (await many('SELECT id, action FROM go_live_lock_requests WHERE status = \'pending\' AND requested_by <> $1', [user.id]))
    .map((l) => ({ type: l.action, id: Number(l.id), reference: `#${l.id}` })) : [];
  const votes = (await many(`SELECT d.id, r.run_number FROM go_live_decision_votes v JOIN go_live_decisions d ON d.id = v.decision_id JOIN migration_runs r ON r.id = d.run_id
    WHERE v.user_id = $1 AND v.vote IS NULL AND d.status = 'voting' ORDER BY d.id`, [user.id])).map((v) => ({ type: 'vote', id: Number(v.id), reference: v.run_number }));
  const steps = (await many(`SELECT s.id, s.run_id, s.code, s.title, s.status, s.planned_end FROM migration_run_steps s JOIN migration_runs r ON r.id = s.run_id
    WHERE s.owner_user_id = $1 AND s.status NOT IN ('done', 'skipped') AND r.status IN ('planned', 'running') ORDER BY s.planned_end NULLS LAST, s.sort`, [user.id]))
    .map((s) => ({ id: Number(s.id), runId: Number(s.run_id), code: s.code, title: s.title, status: s.status, plannedEnd: s.planned_end }));

  return {
    cutoverDate: isDate(cutover) ? cutover : null, locked: state.locked, lockedAt: state.lockedAt, unlock: state.unlock,
    environment: String((await getSetting('system.environment', 'dev')) || 'dev').toLowerCase(), phases, run,
    loads: { loaded: byStatus.loaded || 0, pendingApproval: byStatus['pending-approval'] || 0, failed: byStatus.failed || 0, byStatus, rows, latest },
    defects: { severity1: defects.sev1, severity2: defects.sev2 },
    forMe: { approvals: [...toApprove, ...lockRequests], votes, steps },
  };
}
