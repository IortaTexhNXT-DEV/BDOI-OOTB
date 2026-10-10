/**
 * Go / No-Go decisions of Data Migration & Go-Live > Go-Live (migration 0444).
 *
 * A decision belongs to a run (the production run's Go decision is a condition of the go-live lock; a dress rehearsal
 * rehearses it). It is created (write:data-load) with its approvers: users holding approve:data-load, each with the role
 * they vote for, at least migration.go_live_min_approvers, one of them as Finance Head, never its creator. The criteria
 * are copied from the template (go_live_criteria). Automatic criteria are computed on the records (refresh):
 *   G2  production-load        a migration load of the run is loaded; no loaded migration load of the run has a row in
 *                              error or an unresolved duplicate, or was loaded with its valid rows only
 *   G3  reconciliation-checks  the latest reconciliation of the run (not superseded): every check and sub-ledger tie-out
 *                              line agrees, or each of its differences is accepted
 *   G4  reconciliation-signed  that reconciliation is signed
 *   G6  environment-mirrored   the latest environment comparison is Mirrored
 *   G7  users-ready            no active demo or sample account, no active user with role SUPERID (tis-superid), user ID
 *                              and password sign-in off
 *   G8  numbering              no number of a client, policy, bill or claim that a numbering series would issue again,
 *                              in any period from the cutover year to the next and any branch or line form, and no
 *                              migrated COC number inside the unused range of a COC series (numbering.js)
 *   G9  restore-point          cutover step CO-3 done with an evidence file and the restore point of the run recorded
 *   G11 evidence-archived      the SHA-256 of a downloaded evidence pack of the run and its archive reference recorded
 * Manual criteria (G1, G5, G10) are set Met or Not met with their evidence (write:data-load). A waivable criterion that is
 * not met may be waived (approve:data-load, a reason, not the creator of the decision); G2 to G5 are never waived.
 *
 * Voting opens (write:data-load) once every criterion is met or waived. Each named approver votes Go or No-Go once
 * (approve:data-load; nobody else): all Go makes the decision Go; one No-Go makes it No-Go at once, with the reason, the
 * actions and the new date given by that approver. A draft or voting decision can be withdrawn; one open decision per run.
 */
import { many, one, pool, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { getSetting } from '../../lib/settings.js';
import { ADMIN_ROLES, hasPermission, loadUser } from '../../lib/auth.js';
import { notify } from '../notifications/service.js';
import { notifyDecision } from '../notifications/approvals.js';
import { MIGRATED_NUMBER_TARGETS, cocCollisions, collidingNumbers } from './numbering.js';
import { getReconciliation } from './reconciliation.js';
import { runRow } from './runs.js';
import { RESTORE_POINT_STEP } from './cutover.js';
import { isDate } from './common.js';

const APPROVE = 'approve:data-load';
const WRITE = 'write:data-load';
const LINK = '/master/configuration/go-live/decision';
export const DECISION_STATUSES = { draft: 'Draft', voting: 'Voting', go: 'Go', 'no-go': 'No-Go', withdrawn: 'Withdrawn' };
export const CRITERION_STATUSES = { open: 'Open', met: 'Met', 'not-met': 'Not met', waived: 'Waived' };
const FINANCE_HEAD = /finance head/i;
const OPEN_DECISION = ['draft', 'voting'];
/** Break-glass administrator created by the seed: kept active, every other seeded account is a demo account. */
const FIRST_ADMIN = 'BrokerVerse';

const text = (v, max = 2000) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const result = (met, detail = null, items = []) => ({ met, detail, items, checkedAt: new Date().toISOString() });

// ------------------------------------------------------------------ automatic checks

/** The latest reconciliation of a run that is not superseded, in full, or null. */
async function latestReconciliation(runId) {
  const r = await one('SELECT id FROM migration_reconciliations WHERE run_id = $1 AND status <> \'superseded\' ORDER BY id DESC LIMIT 1', [runId]);
  return r ? getReconciliation(r.id) : null;
}

export const AUTO_CHECKS = {
  async 'production-load'(run) {
    const loads = await many(`SELECT b.load_number, b.valid_rows_only, b.rows_error,
        (SELECT count(*)::int FROM data_load_rows r WHERE r.batch_id = b.id AND (r.status = 'error' OR (r.status = 'duplicate' AND r.resolution IS NULL))) AS bad_rows
      FROM data_load_batches b WHERE b.run_id = $1 AND b.kit = 'migration' AND b.status = 'loaded' ORDER BY b.id`, [run.id]);
    if (!loads.length) return result(false, 'No migration load of the run is loaded');
    const bad = loads.filter((b) => b.valid_rows_only || b.rows_error > 0 || b.bad_rows > 0)
      .map((b) => ({ loadNumber: b.load_number, validRowsOnly: b.valid_rows_only, rowsInError: Math.max(b.rows_error, b.bad_rows) }));
    return result(!bad.length, bad.length ? `${bad.map((b) => b.loadNumber).join(', ')}: rows in error, unresolved duplicates or valid rows only` : `${loads.length} load(s) loaded in full`, bad);
  },
  async 'reconciliation-checks'(run) {
    const r = await latestReconciliation(run.id);
    if (!r) return result(false, 'No reconciliation of the run');
    const items = r.lines.filter((l) => l.kind !== 'measure' && l.status !== 'matched')
      .filter((l) => {
        const diffs = r.differences.filter((d) => d.lineId === l.id);
        return l.status === 'missing' || !diffs.length || diffs.some((d) => d.status !== 'accepted');
      })
      .map((l) => ({ reconNumber: r.reconNumber, check: l.label || l.measure, group: l.group || null, status: l.status, difference: l.difference }));
    return result(!items.length, items.length ? `${items.length} check(s) or tie-out(s) of ${r.reconNumber} differ without an accepted explanation` : `${r.reconNumber}: checks and tie-outs agree`, items);
  },
  async 'reconciliation-signed'(run) {
    const r = await latestReconciliation(run.id);
    if (!r) return result(false, 'No reconciliation of the run');
    return result(r.status === 'signed', r.status === 'signed' ? `${r.reconNumber} signed` : `${r.reconNumber} is not signed (${r.summary.signed} of ${r.summary.slots} sign-offs)`);
  },
  async 'environment-mirrored'() {
    const c = await one('SELECT id, verdict, created_at FROM data_load_comparisons ORDER BY created_at DESC, id DESC LIMIT 1');
    if (!c) return result(false, 'No environment comparison');
    return result(c.verdict === 'mirrored', c.verdict === 'mirrored' ? `Comparison ${c.id} mirrored` : `Comparison ${c.id} found differences`, [{ comparisonId: Number(c.id), verdict: c.verdict }]);
  },
  async 'users-ready'() {
    const demo = await many(`SELECT username FROM users WHERE status = 'active' AND created_by = 'seed' AND username <> $1 ORDER BY username`, [FIRST_ADMIN]);
    const superid = await many(`SELECT DISTINCT u.username FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
      WHERE u.status = 'active' AND r.code = 'tis-superid' ORDER BY u.username`);
    const password = (await getSetting('security.password_sign_in_enabled', true)) !== false;
    const items = [...demo.map((u) => ({ issue: 'Demo or sample account active', username: u.username })), ...superid.map((u) => ({ issue: 'SUPERID user active', username: u.username })),
      ...(password ? [{ issue: 'User ID and password sign-in on', username: null }] : [])];
    return result(!items.length, items.length ? `${items.length} issue(s)` : 'Demo accounts and SUPERID inactive, password sign-in off', items);
  },
  async numbering() {
    const items = [];
    for (const [code, target] of Object.entries(MIGRATED_NUMBER_TARGETS)) {
      for (const n of await collidingNumbers(code, { limit: 50 })) items.push({ series: code, label: target.label, number: n.number, next: n.next, periods: n.periods });
    }
    for (const c of await cocCollisions({ limit: 50 })) items.push({ series: 'coc', label: 'COC number', number: c.number, next: c.next, policyNumber: c.policyNumber });
    return result(!items.length, items.length ? `${items.length} legacy number(s) a series would issue again` : 'Every series continues above the legacy numbers', items);
  },
  async 'restore-point'(run) {
    const step = await one(`SELECT s.status, (SELECT count(*)::int FROM migration_evidence e WHERE e.owner_type = 'step' AND e.owner_id = s.id) AS evidence
      FROM migration_run_steps s WHERE s.run_id = $1 AND s.code = $2`, [run.id, RESTORE_POINT_STEP]);
    const items = [];
    if (!step || step.status !== 'done') items.push({ issue: `${RESTORE_POINT_STEP} not done` });
    else if (!step.evidence) items.push({ issue: `${RESTORE_POINT_STEP} has no evidence file` });
    if (!run.restore_point) items.push({ issue: 'Restore point not recorded' });
    return result(!items.length, items.length ? items.map((i) => i.issue).join('; ') : `Restore point ${new Date(run.restore_point).toISOString()}`, items);
  },
  async 'evidence-archived'(run) {
    const items = [];
    if (!run.evidence_pack_sha256) items.push({ issue: 'SHA-256 of the evidence pack not recorded' });
    else if (!(await one(`SELECT 1 FROM audit_log WHERE entity = 'migration_run' AND entity_id = $1 AND action = 'evidence-pack' AND after_data->>'sha256' = $2 LIMIT 1`,
      [String(run.id), run.evidence_pack_sha256]))) items.push({ issue: 'The SHA-256 recorded is not the hash of a downloaded evidence pack' });
    if (!run.archive_ref) items.push({ issue: 'Archive reference not recorded' });
    return result(!items.length, items.length ? items.map((i) => i.issue).join('; ') : `Archived: ${run.archive_ref}`, items);
  },
};

// ------------------------------------------------------------------ reading

/**
 * Active users of the workspace (holders of read:, write: or approve:data-load, System Administrators included) for the
 * owner of a checklist step and the approvers of a decision: name, role names and whether they may change (write) and
 * approve (approve: the approvers of a decision are chosen among these).
 */
export async function workspaceUsers() {
  const rows = await many(`SELECT u.id, COALESCE(u.display_name, u.username) AS name,
      ARRAY(SELECT DISTINCT r.name FROM user_effective_roles(u.id) er JOIN roles r ON r.id = er.role_id ORDER BY r.name) AS roles,
      bool_or(er.code = ANY($1) OR p.code = $2) AS can_write, bool_or(er.code = ANY($1) OR p.code = $3) AS can_approve
    FROM users u JOIN LATERAL user_effective_roles(u.id) er ON true LEFT JOIN role_permissions rp ON rp.role_id = er.role_id LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE u.status = 'active' AND (er.code = ANY($1) OR p.code = ANY($4))
    GROUP BY u.id ORDER BY lower(COALESCE(u.display_name, u.username))`, [ADMIN_ROLES, WRITE, APPROVE, ['read:data-load', WRITE, APPROVE]]);
  return rows.map((u) => ({ userId: u.id, name: u.name, roles: u.roles, canWrite: !!u.can_write, canApprove: !!u.can_approve }));
}

const toDecision = (d, criteria, votes) => ({
  id: Number(d.id), runId: Number(d.run_id), runNumber: d.run_number, runKind: d.run_kind, status: d.status, statusLabel: DECISION_STATUSES[d.status], meetingAt: d.meeting_at,
  reason: d.reason, actions: d.actions, newDate: d.new_date, minuteRef: d.minute_ref, createdBy: d.created_by_name || d.created_by, createdById: d.created_by, createdAt: d.created_at,
  decidedAt: d.decided_at,
  criteria: criteria.map((c) => ({ code: c.code, title: c.title, waivable: c.waivable, automatic: !!c.auto_check, status: c.status, statusLabel: CRITERION_STATUSES[c.status],
    autoResult: c.auto_result, evidence: c.evidence, waivedBy: c.waived_by_name || c.waived_by, waiverReason: c.waiver_reason, updatedBy: c.updated_by_name || c.updated_by, updatedAt: c.updated_at })),
  approvers: votes.map((v) => ({ userId: v.user_id, name: v.name || v.user_id, roleLabel: v.role_label, vote: v.vote, remarks: v.remarks, votedAt: v.voted_at })),
  summary: { criteria: criteria.length, met: criteria.filter((c) => ['met', 'waived'].includes(c.status)).length, votes: votes.filter((v) => v.vote).length, approvers: votes.length },
});

/** One decision with its criteria and approvers. */
export async function getDecision(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Decision not found');
  const d = await one(`SELECT d.*, r.run_number, r.kind AS run_kind, cu.display_name AS created_by_name FROM go_live_decisions d JOIN migration_runs r ON r.id = d.run_id
    LEFT JOIN users cu ON cu.id = d.created_by WHERE d.id = $1`, [Number(id)]);
  if (!d) throw notFound('Decision not found');
  const criteria = await many(`SELECT c.*, wu.display_name AS waived_by_name, uu.display_name AS updated_by_name FROM go_live_decision_criteria c
    LEFT JOIN users wu ON wu.id = c.waived_by LEFT JOIN users uu ON uu.id = c.updated_by WHERE c.decision_id = $1 ORDER BY c.sort, c.code`, [d.id]);
  const votes = await many(`SELECT v.*, u.display_name AS name FROM go_live_decision_votes v LEFT JOIN users u ON u.id = v.user_id WHERE v.decision_id = $1 ORDER BY v.id`, [d.id]);
  return toDecision(d, criteria, votes);
}

/** Decisions, newest first (filter runId). */
export async function listDecisions({ runId = null } = {}) {
  const ids = await many('SELECT id FROM go_live_decisions WHERE ($1::bigint IS NULL OR run_id = $1) ORDER BY id DESC LIMIT 100', [/^\d+$/.test(String(runId || '')) ? Number(runId) : null]);
  const out = [];
  for (const r of ids) out.push(await getDecision(r.id));
  return out;
}

// ------------------------------------------------------------------ changes

async function decisionRow(id, statuses = OPEN_DECISION) {
  const d = await getDecision(id);
  if (statuses && !statuses.includes(d.status)) throw conflict(`The decision is ${d.statusLabel.toLowerCase()}`);
  return d;
}

/** Compute the automatic criteria of a draft decision: met, or not met with what is missing (a waived one stays waived). */
async function refreshCriteria(db, decision, user) {
  const run = await runRow(decision.runId);
  for (const c of decision.criteria.filter((x) => x.automatic)) {
    const code = (await db.query('SELECT auto_check FROM go_live_decision_criteria WHERE decision_id = $1 AND code = $2', [decision.id, c.code])).rows[0].auto_check;
    const check = AUTO_CHECKS[code];
    const r = check ? await check(run) : result(false, 'Unknown check');
    const status = r.met ? 'met' : c.status === 'waived' ? 'waived' : 'not-met';
    await db.query(`UPDATE go_live_decision_criteria SET auto_result = $3, status = $4, updated_by = $5, updated_at = now() WHERE decision_id = $1 AND code = $2`,
      [decision.id, c.code, JSON.stringify(r), status, user.id]);
  }
}

/**
 * Create a decision (write:data-load): { runId, approvers: [{ userId, roleLabel }], meetingAt? }. The approvers hold
 * approve:data-load, are active, at least migration.go_live_min_approvers, one as Finance Head, not the creator.
 */
export async function createDecision(body, user, req) {
  const b = body || {};
  const run = await runRow(b.runId);
  if (run.status === 'cancelled') throw conflict(`Run ${run.run_number} is cancelled`);
  const min = Math.max(1, Number(await getSetting('migration.go_live_min_approvers', 2)) || 2);
  const list = Array.isArray(b.approvers) ? b.approvers : [];
  const errors = [];
  const seen = new Set();
  const approvers = [];
  for (const [i, a] of list.entries()) {
    const id = String(a?.userId || '');
    const roleLabel = text(a?.roleLabel, 100);
    if (!roleLabel) errors.push({ path: `approvers[${i}].roleLabel`, message: 'Give the role the approver votes for' });
    if (seen.has(id)) { errors.push({ path: `approvers[${i}].userId`, message: 'Each approver once' }); continue; }
    seen.add(id);
    if (id === user.id) { errors.push({ path: `approvers[${i}].userId`, message: 'The creator of the decision does not vote on it' }); continue; }
    const u = id ? await loadUser('u.id = $1', [id]) : null;
    if (!u || u.status !== 'active' || !hasPermission(u, APPROVE)) errors.push({ path: `approvers[${i}].userId`, message: 'Approver must be an active user who may approve go-live' });
    else approvers.push({ userId: u.id, roleLabel });
  }
  if (list.length < min) errors.push({ path: 'approvers', message: `Name at least ${min} approvers` });
  if (!approvers.some((a) => FINANCE_HEAD.test(a.roleLabel))) errors.push({ path: 'approvers', message: 'One approver votes as Finance Head' });
  const meetingAt = b.meetingAt ? Date.parse(String(b.meetingAt)) : null;
  if (b.meetingAt && Number.isNaN(meetingAt)) errors.push({ path: 'meetingAt', message: 'Give the meeting date and time' });
  if (errors.length) throw badRequest('Validation failed', errors);
  let id;
  try {
    id = await withTransaction(async (db) => {
      const d = (await db.query('INSERT INTO go_live_decisions(run_id, meeting_at, created_by) VALUES ($1,$2,$3) RETURNING id',
        [run.id, meetingAt ? new Date(meetingAt).toISOString() : null, user.id])).rows[0];
      await db.query(`INSERT INTO go_live_decision_criteria(decision_id, code, title, waivable, auto_check, sort)
        SELECT $1, code, title, waivable, auto_check, sort FROM go_live_criteria WHERE status = 'active'`, [d.id]);
      for (const a of approvers) await db.query('INSERT INTO go_live_decision_votes(decision_id, user_id, role_label) VALUES ($1,$2,$3)', [d.id, a.userId, a.roleLabel]);
      return d.id;
    });
  } catch (e) {
    if (e.code === '23505') throw conflict(`Run ${run.run_number} already has a decision in draft or voting`);
    throw e;
  }
  await withTransaction(async (db) => refreshCriteria(db, await getDecision(id), user));
  const out = await getDecision(id);
  await audit(req, { entity: 'go_live_decision', entityId: out.id, action: 'create', after: { runNumber: out.runNumber, approvers: out.approvers.map((a) => ({ userId: a.userId, roleLabel: a.roleLabel })) } });
  return out;
}

/** Compute the automatic criteria again (draft only). */
export async function refreshDecision(id, user, req) {
  const d = await decisionRow(id, ['draft']);
  await withTransaction(async (db) => refreshCriteria(db, d, user));
  const out = await getDecision(id);
  await audit(req, { entity: 'go_live_decision', entityId: out.id, action: 'refresh',
    after: { criteria: out.criteria.filter((c) => c.automatic).map((c) => ({ code: c.code, status: c.status })) } });
  return out;
}

/**
 * Set a criterion of a draft decision: { status: met | not-met | waived, evidence, waiverReason }. Met and not met:
 * manual criteria only (write:data-load); evidence on any criterion (write:data-load); waived: a waivable criterion,
 * approve:data-load with a reason, not the creator of the decision.
 */
export async function setCriterion(id, code, body, user, req) {
  const d = await decisionRow(id, ['draft']);
  const c = d.criteria.find((x) => x.code === String(code));
  if (!c) throw notFound('Criterion not found');
  const b = body || {};
  const status = b.status === undefined ? null : String(b.status);
  if (status && !['met', 'not-met', 'waived'].includes(status)) throw badRequest('Validation failed', [{ path: 'status', message: 'Status: met, not-met or waived' }]);
  const evidence = b.evidence === undefined ? undefined : text(b.evidence, 4000);
  if (!status && evidence === undefined) throw badRequest('Nothing to change');
  let action = 'criterion';
  const cols = { updated_by: user.id };
  if (status === 'waived') {
    if (!c.waivable) throw conflict(`${c.code} may not be waived`);
    if (!hasPermission(user, APPROVE)) throw forbidden('Waiving a criterion needs the approval permission of the workspace');
    if (d.createdById === user.id) throw forbidden(`Maker-checker: ${c.code} is waived by another user than the creator of the decision`);
    if (c.status === 'met') throw conflict(`${c.code} is met`);
    const reason = text(b.waiverReason, 2000);
    if (!reason) throw badRequest('Validation failed', [{ path: 'waiverReason', message: 'Give the reason of the waiver' }]);
    Object.assign(cols, { status: 'waived', waived_by: user.id, waiver_reason: reason });
    action = 'waive';
  } else {
    if (!hasPermission(user, WRITE)) throw forbidden('Recording a criterion needs the write permission of the workspace');
    if (status) {
      if (c.automatic) throw conflict(`${c.code} is computed from the records: refresh it`);
      Object.assign(cols, { status, waived_by: null, waiver_reason: null });
    }
  }
  if (evidence !== undefined) cols.evidence = evidence;
  const keys = Object.keys(cols);
  await one(`UPDATE go_live_decision_criteria SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = now() WHERE decision_id = $1 AND code = $2 RETURNING id`,
    [d.id, c.code, ...keys.map((k) => cols[k])]);
  const out = await getDecision(d.id);
  const after = out.criteria.find((x) => x.code === c.code);
  await audit(req, { entity: 'go_live_decision', entityId: d.id, action, before: { code: c.code, status: c.status, evidence: c.evidence },
    after: { code: c.code, status: after.status, evidence: after.evidence, waiverReason: after.waiverReason } });
  return out;
}

/** Open the voting (write:data-load): the automatic criteria are computed again and every criterion is met or waived. */
export async function openVoting(id, user, req) {
  const d = await decisionRow(id, ['draft']);
  await withTransaction(async (db) => refreshCriteria(db, d, user));
  const fresh = await getDecision(id);
  const open = fresh.criteria.filter((c) => !['met', 'waived'].includes(c.status));
  if (open.length) {
    throw Object.assign(conflict(`Voting opens once every criterion is met or waived: ${open.map((c) => c.code).join(', ')}`),
      { details: open.map((c) => ({ path: c.code, message: c.autoResult?.detail || CRITERION_STATUSES[c.status] })) });
  }
  const moved = await one('UPDATE go_live_decisions SET status = \'voting\' WHERE id = $1 AND status = \'draft\' RETURNING id', [d.id]);
  if (!moved) throw conflict('The decision was changed by another user');
  const out = await getDecision(id);
  await audit(req, { entity: 'go_live_decision', entityId: d.id, action: 'open-voting', after: { runNumber: out.runNumber, criteria: out.criteria.map((c) => ({ code: c.code, status: c.status })) } });
  for (const a of out.approvers) {
    await notify({ userId: a.userId, type: 'approval', title: `Go / No-Go of ${out.runNumber} awaiting your vote`, message: `Vote as ${a.roleLabel}`, link: LINK,
      entity: 'go_live_decision', entityId: out.id });
  }
  return out;
}

/**
 * Vote (approve:data-load, a named approver of the decision, once): { vote: go | no-go, remarks, reason, actions, newDate }.
 * A No-Go gives the reason, the actions and the new date and ends the decision as No-Go; the last Go ends it as Go.
 */
export async function vote(id, body, user, req) {
  const d = await decisionRow(id, ['voting']);
  const mine = d.approvers.find((a) => a.userId === user.id);
  if (!mine) throw forbidden('Only the approvers named on the decision vote on it');
  if (mine.vote) throw conflict('You have already voted on this decision');
  const b = body || {};
  const choice = String(b.vote || '');
  const errors = [];
  if (!['go', 'no-go'].includes(choice)) errors.push({ path: 'vote', message: 'Vote go or no-go' });
  const remarks = text(b.remarks);
  const nogo = choice === 'no-go' ? { reason: text(b.reason || b.remarks), actions: text(b.actions, 4000), newDate: b.newDate } : null;
  if (nogo) {
    if (!nogo.reason) errors.push({ path: 'reason', message: 'Give the reason of the No-Go' });
    if (!nogo.actions) errors.push({ path: 'actions', message: 'Give the actions before the next decision' });
    if (!isDate(nogo.newDate)) errors.push({ path: 'newDate', message: 'Give the new date YYYY-MM-DD' });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  const outcome = await withTransaction(async (db) => {
    const cast = (await db.query(`UPDATE go_live_decision_votes SET vote = $3, remarks = $4, voted_at = now() WHERE decision_id = $1 AND user_id = $2 AND vote IS NULL
      AND EXISTS (SELECT 1 FROM go_live_decisions WHERE id = $1 AND status = 'voting') RETURNING id`, [d.id, user.id, choice, remarks])).rows[0];
    if (!cast) throw conflict('The decision was closed or your vote was already recorded');
    if (nogo) {
      await db.query(`UPDATE go_live_decisions SET status = 'no-go', reason = $2, actions = $3, new_date = $4, decided_at = now() WHERE id = $1`, [d.id, nogo.reason, nogo.actions, nogo.newDate]);
      return 'no-go';
    }
    const left = (await db.query('SELECT count(*)::int AS n FROM go_live_decision_votes WHERE decision_id = $1 AND vote IS DISTINCT FROM \'go\'', [d.id])).rows[0].n;
    if (left) return null;
    await db.query('UPDATE go_live_decisions SET status = \'go\', reason = $2, decided_at = now() WHERE id = $1', [d.id, text(b.reason)]);
    return 'go';
  });
  const out = await getDecision(id);
  await audit(req, { entity: 'go_live_decision', entityId: d.id, action: 'vote', after: { runNumber: out.runNumber, vote: choice, roleLabel: mine.roleLabel, remarks } });
  if (outcome) {
    await audit(req, { entity: 'go_live_decision', entityId: d.id, action: outcome, after: { runNumber: out.runNumber, reason: out.reason, actions: out.actions, newDate: out.newDate,
      votes: out.approvers.map((a) => ({ userId: a.userId, roleLabel: a.roleLabel, vote: a.vote })) } });
    await notifyDecision({ userId: out.createdById, decidedBy: user.id, document: 'Go / No-Go of', number: out.runNumber, approved: outcome === 'go', status: DECISION_STATUSES[outcome],
      by: user.username, reason: outcome === 'no-go' ? out.reason : null, link: LINK, entity: 'go_live_decision', entityId: out.id });
  }
  return out;
}

/** Withdraw a decision in draft or voting (write:data-load). */
export async function withdrawDecision(id, body, user, req) {
  const d = await decisionRow(id);
  const reason = text(body?.reason);
  if (!reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason' }]);
  const moved = await one('UPDATE go_live_decisions SET status = \'withdrawn\', reason = $2 WHERE id = $1 AND status IN (\'draft\', \'voting\') RETURNING id', [d.id, reason]);
  if (!moved) throw conflict('The decision was changed by another user');
  const out = await getDecision(id);
  await audit(req, { entity: 'go_live_decision', entityId: d.id, action: 'withdraw', before: { status: d.status }, after: { status: out.status, reason } });
  return out;
}

/** The criteria template. */
export async function criteriaTemplate() {
  return (await many('SELECT * FROM go_live_criteria ORDER BY sort, code')).map((c) => ({ code: c.code, title: c.title, evidenceHint: c.evidence_hint, automatic: !!c.auto_check,
    waivable: c.waivable, sort: c.sort, status: c.status }));
}

/** Change a criterion of the template (new decisions copy it): title, evidence, order, status; G2 to G5 stay not waivable. */
export async function updateCriterionTemplate(code, body, user, req) {
  const before = await one('SELECT * FROM go_live_criteria WHERE code = $1', [String(code)]);
  if (!before) throw notFound('Criterion not found');
  const b = body || {};
  const cols = {};
  const errors = [];
  if (b.title !== undefined) {
    if (!text(b.title, 300)) errors.push({ path: 'title', message: 'Give the criterion' });
    else cols.title = text(b.title, 300);
  }
  if (b.evidenceHint !== undefined) cols.evidence_hint = text(b.evidenceHint, 300);
  if (b.sort !== undefined) {
    if (!Number.isInteger(Number(b.sort))) errors.push({ path: 'sort', message: 'Order: a whole number' });
    else cols.sort = Number(b.sort);
  }
  if (b.status !== undefined) {
    if (!['active', 'inactive'].includes(b.status)) errors.push({ path: 'status', message: 'Status: active or inactive' });
    else if (b.status === 'inactive' && !before.waivable) errors.push({ path: 'status', message: `${before.code} is never waived: it stays active` });
    else cols.status = b.status;
  }
  if (b.waivable !== undefined) {
    if (typeof b.waivable !== 'boolean') errors.push({ path: 'waivable', message: 'Waivable: true or false' });
    else if (b.waivable && !before.waivable) errors.push({ path: 'waivable', message: `${before.code} is never waived` });
    else cols.waivable = b.waivable;
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  const keys = Object.keys(cols);
  if (!keys.length) throw badRequest('Nothing to change');
  await pool.query(`UPDATE go_live_criteria SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE code = $1`, [before.code, ...keys.map((k) => cols[k])]);
  const after = (await criteriaTemplate()).find((c) => c.code === before.code);
  await audit(req, { entity: 'go_live_criterion', entityId: before.code, action: 'update', before: { title: before.title, evidenceHint: before.evidence_hint, sort: before.sort, status: before.status,
    waivable: before.waivable }, after });
  return after;
}
