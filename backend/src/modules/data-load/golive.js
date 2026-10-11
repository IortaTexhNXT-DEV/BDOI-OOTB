/**
 * Go-Live tab of Data Migration & Go-Live: the cutover date, the go-live lock and its unlocks, and the settings of the
 * workspace that no other screen changes (lib/settingOwners.js: PUT /settings, the system configuration and the
 * Settings sheet of the configuration workbook refuse them).
 *
 * Lock: requested by one user (write:data-load) with a reason, approved by another (approve:data-load). It needs the
 * Go decision of the production run, its reconciliation signed, its restore point recorded and no load waiting for
 * approval, running or being undone; the conditions are checked at the request and again at the approval. The approval
 * switches golive.locked on and records golive.locked_at and golive.locked_by (the request).
 *
 * Unlock: the same two steps, with the imports it reopens (scope), its hours (at most migration.unlock_max_hours) and,
 * after migration.unlock_window_days from the lock, the reference of a steering committee decision. The lock stays on:
 * only the named imports open again, until expires_at, when the job golive-relock (every 5 minutes) ends the unlock.
 * The undo of a load and the transaction reset stay refused.
 *
 * Settings (GO_LIVE_SETTINGS): changed the same way, by a request (write or approve:data-load) with a reason that
 * another user approves (approve:data-load); one request of the tab waits at a time. Approval of each load, the opening
 * balances sent to SAP and the duplicate checks only change before the lock; the others also after it.
 */
import { many, one, pool, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { audit, auditMany } from '../../lib/audit.js';
import { clearSettingsCache, getSetting, setSetting } from '../../lib/settings.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { IMPORT_SCOPES, lockState } from '../../lib/goLiveLock.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { DUPLICATE_RULES } from './duplicates.js';
import { isDate } from './common.js';

const APPROVE = 'approve:data-load';
const LINK = '/master/configuration/go-live/decision';
const ACTION_LABELS = { lock: 'Go-live lock', unlock: 'Go-live unlock', settings: 'Go-live settings change' };

/**
 * The owned settings changed on the Go-Live tab: key, field of the API, label, type (boolean, choice, list of choices,
 * whole number between min and max, list of codes), default, and beforeLock: changed only before the go-live lock.
 */
export const GO_LIVE_SETTINGS = [
  { key: 'migration.load_approval_required', field: 'loadApprovalRequired', label: 'Approval of each load by a second user', type: 'boolean', fallback: true, beforeLock: true },
  { key: 'migration.kpi_include_migrated', field: 'kpiIncludeMigrated', label: 'Migrated policies in dashboards and KPIs', type: 'boolean', fallback: false },
  { key: 'migration.commission_include_migrated', field: 'commissionIncludeMigrated', label: 'Migrated policies in commission figures', type: 'boolean', fallback: false },
  { key: 'migration.incentive_include_migrated', field: 'incentiveIncludeMigrated', label: 'Migrated policies in incentives', type: 'boolean', fallback: false },
  { key: 'migration.sap_gl_include_opening', field: 'sapGlIncludeOpening', label: 'Opening balances sent to SAP once', type: 'boolean', fallback: false, beforeLock: true },
  { key: 'dashboard.default_origin', field: 'dashboardDefaultOrigin', label: 'Business the dashboards open on', type: 'choice', choices: ['issued', 'all'], fallback: 'issued' },
  { key: 'migration.duplicate_rules', field: 'duplicateRules', label: 'Duplicate checks of each load', type: 'list', choices: DUPLICATE_RULES, fallback: DUPLICATE_RULES, beforeLock: true },
  { key: 'migration.unlock_max_hours', field: 'unlockMaxHours', label: 'Hours an unlock lasts at most', type: 'integer', min: 1, max: 24, fallback: 4 },
  { key: 'migration.unlock_window_days', field: 'unlockWindowDays', label: 'Days after the lock an unlock needs no steering committee decision', type: 'integer', min: 0, max: 90,
    fallback: 7 },
  { key: 'migration.evidence_retention_years', field: 'evidenceRetentionYears', label: 'Years the production load files and rows are kept after the lock (0: for ever)',
    type: 'integer', min: 0, max: 50, floor: 10, fallback: 10 },
  { key: 'migration.document_types', field: 'documentTypes', label: 'Document types of the file naming convention', type: 'codes', fallback: [] },
  { key: 'migration.numbering_mask_series', field: 'numberingMaskSeries', label: 'Numbering series of new business that follow the numbering mask', type: 'series', fallback: [] },
];

/** A requested value checked against its setting: the value to store, or an error message. */
function settingValue(s, v) {
  if (s.type === 'boolean') return typeof v === 'boolean' ? { value: v } : { error: `${s.label}: true or false` };
  if (s.type === 'choice') return s.choices.includes(v) ? { value: v } : { error: `${s.label}: one of ${s.choices.join(', ')}` };
  if (s.type === 'list') {
    const list = Array.isArray(v) ? [...new Set(v.map(String))] : null;
    return list && list.every((x) => s.choices.includes(x)) ? { value: s.choices.filter((x) => list.includes(x)) } : { error: `${s.label}: some of ${s.choices.join(', ')}` };
  }
  if (s.type === 'integer') {
    const ok = Number.isInteger(v) && v >= s.min && v <= s.max && (!s.floor || v === 0 || v >= s.floor);
    return ok ? { value: v } : { error: `${s.label}: a whole number from ${s.floor ? `${s.floor}` : s.min} to ${s.max}${s.floor ? ', or 0' : ''}` };
  }
  if (s.type === 'series') {
    const series = Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim().toLowerCase()).filter(Boolean))] : null;
    return series && series.length ? { value: series } : { error: `${s.label}: one or more numbering series` };
  }
  const codes = Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim().toUpperCase()).filter(Boolean))] : null;
  return codes && codes.length && codes.every((c) => /^[A-Z0-9]{2,12}$/.test(c)) ? { value: codes } : { error: `${s.label}: codes of 2 to 12 letters or digits` };
}

const tableExists = async (t) => (await one('SELECT to_regclass($1) IS NOT NULL AS ok', [t])).ok;

/**
 * Conditions of the lock: [{ code, label, met, detail }] and the Go decision it rests on (decisionId). The production
 * run, its Go decision, reconciliation and restore point are recorded on the Runs, Reconciliation and Go-Live tabs.
 */
export async function lockConditions() {
  const run = await tableExists('migration_runs')
    ? await one('SELECT id, run_number, restore_point FROM migration_runs WHERE kind = \'production\' AND status <> \'cancelled\' ORDER BY id DESC LIMIT 1') : null;
  const decision = run && await tableExists('go_live_decisions')
    ? await one('SELECT id FROM go_live_decisions WHERE run_id = $1 AND status = \'go\' ORDER BY decided_at DESC NULLS LAST, id DESC LIMIT 1', [run.id]) : null;
  const signed = run && await tableExists('migration_reconciliations')
    ? await one('SELECT id FROM migration_reconciliations WHERE run_id = $1 AND status = \'signed\' ORDER BY id DESC LIMIT 1', [run.id]) : null;
  const open = await many(`SELECT load_number, status FROM data_load_batches WHERE status IN ('validating', 'pending-approval', 'running', 'undo-pending', 'undoing') ORDER BY id`);
  return {
    decisionId: decision ? Number(decision.id) : null,
    conditions: [
      { code: 'go-decision', label: 'Go decision of the production run', met: !!decision, detail: run ? null : 'No production run' },
      { code: 'reconciliation', label: 'Reconciliation of the production run signed', met: !!signed, detail: null },
      { code: 'restore-point', label: 'Restore point recorded', met: !!run?.restore_point, detail: null },
      { code: 'nothing-pending', label: 'No load waiting for approval, running or being undone', met: !open.length,
        detail: open.length ? open.map((b) => b.load_number).join(', ') : null },
    ],
  };
}

/** The settings of a settings request, as label, value before and value requested. */
const settingChanges = (r) => (r.action !== 'settings' ? [] : GO_LIVE_SETTINGS.filter((s) => r.settings && r.settings[s.field] !== undefined)
  .map((s) => ({ field: s.field, label: s.label, before: r.settings_before?.[s.field] ?? null, after: r.settings[s.field] })));

const toRequest = (r) => r && ({
  id: Number(r.id), action: r.action, actionLabel: ACTION_LABELS[r.action], status: r.status, reason: r.reason, decisionRef: r.decision_ref, settings: settingChanges(r),
  scope: r.scope || [], scopeLabels: (r.scope || []).map((s) => IMPORT_SCOPES[s] || s), hours: r.hours, expiresAt: r.expires_at, relockedAt: r.relocked_at, decisionId: r.decision_id,
  requestedBy: r.requested_by_name || r.requested_by, requestedById: r.requested_by, requestedAt: r.requested_at,
  decidedBy: r.decided_by_name || r.decided_by, decidedById: r.decided_by, decidedAt: r.decided_at, decisionRemarks: r.decision_remarks,
});
const REQUEST_SELECT = `SELECT r.*, ru.display_name AS requested_by_name, du.display_name AS decided_by_name FROM go_live_lock_requests r
  LEFT JOIN users ru ON ru.id = r.requested_by LEFT JOIN users du ON du.id = r.decided_by`;

export async function getLockRequest(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Lock request not found');
  const r = await one(`${REQUEST_SELECT} WHERE r.id = $1`, [Number(id)]);
  if (!r) throw notFound('Lock request not found');
  return toRequest(r);
}
export async function listLockRequests({ status = null } = {}) {
  return (await many(`${REQUEST_SELECT} WHERE ($1::text IS NULL OR r.status = $1) ORDER BY r.id DESC LIMIT 200`, [status || null])).map(toRequest);
}

/** Owned settings of the workspace as the Go-Live tab shows them. */
async function ownedSettings() {
  const out = {};
  for (const s of GO_LIVE_SETTINGS) {
    const v = await getSetting(s.key, s.fallback);
    out[s.field] = s.type === 'boolean' ? v === true : s.type === 'integer' ? Number(v) : v ?? s.fallback;
  }
  return out;
}

/**
 * The settings as the Go-Live tab lists them: field, label, type, choices (series: the numbering series with their
 * names), bounds and whether the lock freezes them.
 */
async function settingDefinitions() {
  const series = (await many('SELECT code, name FROM document_numbering ORDER BY name')).map((r) => ({ value: r.code, label: r.name }));
  return GO_LIVE_SETTINGS.map((s) => ({ field: s.field, label: s.label, type: s.type, ...(s.choices ? { choices: s.choices } : {}), ...(s.type === 'series' ? { choices: series } : {}),
    ...(s.type === 'integer' ? { min: s.floor || s.min, max: s.max, allowZero: !!s.floor } : {}), beforeLock: !!s.beforeLock }));
}

/** The Go-Live tab: cutover date, lock, unlock in force, waiting request, lock conditions, windows and the owned settings. */
export async function goLive() {
  const cutover = String((await getSetting('golive.cutover_date', '')) || '').trim();
  const state = await lockState(pool);
  const { conditions } = await lockConditions();
  const windowDays = Number(await getSetting('migration.unlock_window_days', 7));
  return {
    cutoverDate: isDate(cutover) ? cutover : null, locked: state.locked, lockedAt: state.lockedAt, lockRequestId: state.lockedBy ? Number(state.lockedBy) : null,
    unlock: state.unlock, unlockWindowEndsAt: state.lockedAt ? new Date(new Date(state.lockedAt).getTime() + windowDays * 86400000).toISOString() : null,
    unlockMaxHours: Number(await getSetting('migration.unlock_max_hours', 4)), pendingRequest: (await listLockRequests({ status: 'pending' }))[0] || null,
    conditions, scopes: Object.entries(IMPORT_SCOPES).map(([key, label]) => ({ key, label })), settings: await ownedSettings(), settingDefinitions: await settingDefinitions(),
  };
}

/** Set the cutover date: refused once go-live is locked and while a migration load is loaded or in progress (undo it first). */
export async function setCutoverDate(value, user, req) {
  const date = String(value || '').trim();
  if (!isDate(date)) throw badRequest('Validation failed', [{ path: 'cutoverDate', message: 'Cutover date must be a date YYYY-MM-DD' }]);
  if ((await lockState(pool)).locked) throw conflict('Go-live is locked: the cutover date can no longer change');
  const loaded = await one(`SELECT load_number, status FROM data_load_batches WHERE kit = 'migration' AND status IN ('loaded', 'running', 'pending-approval', 'undo-pending', 'undoing')
    ORDER BY id LIMIT 1`);
  if (loaded) throw conflict(`Load ${loaded.load_number} is ${loaded.status === 'loaded' ? 'loaded' : 'in progress'} for the current cutover date: undo it or let it finish first`);
  const before = String((await getSetting('golive.cutover_date', '')) || '');
  if (before !== date) {
    await setSetting('golive.cutover_date', date, user.id);
    await audit(req, { entity: 'golive_setting', entityId: 'golive.cutover_date', action: 'cutover-date', before: { cutoverDate: before || null }, after: { cutoverDate: date } });
  }
  clearSettingsCache();
  return goLive();
}

/**
 * The changes of a settings request checked now (at the request and again at the approval): { field: value } of the
 * settings that change. Refused: a value out of its bounds, a setting the lock freezes once locked, the approval of
 * loads switched off in production and pre-production.
 */
async function checkedSettings(requested) {
  const current = await ownedSettings();
  const errors = [];
  const out = {};
  for (const s of GO_LIVE_SETTINGS) {
    if (requested?.[s.field] === undefined) continue;
    const r = settingValue(s, requested[s.field]);
    if (r.error) errors.push({ path: s.field, message: r.error });
    else if (JSON.stringify(r.value) !== JSON.stringify(current[s.field])) out[s.field] = r.value;
  }
  if (out.numberingMaskSeries) {
    const known = new Set((await many('SELECT code FROM document_numbering WHERE code = ANY($1::text[])', [out.numberingMaskSeries])).map((r) => r.code));
    const unknown = out.numberingMaskSeries.filter((c) => !known.has(c));
    if (unknown.length) errors.push({ path: 'numberingMaskSeries', message: `Not a numbering series: ${unknown.join(', ')}` });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  if (!Object.keys(out).length) throw badRequest('Nothing to change: the settings already have these values');
  if ((await lockState(pool)).locked) {
    const frozen = GO_LIVE_SETTINGS.filter((s) => s.beforeLock && out[s.field] !== undefined);
    if (frozen.length) throw conflict(`Go-live is locked: ${frozen.map((s) => s.label.toLowerCase()).join(', ')} no longer change`);
  }
  const env = String(await getSetting('system.environment', 'dev') || '').toLowerCase();
  if (out.loadApprovalRequired === false && ['production', 'preprod'].includes(env)) {
    throw conflict('Each load is approved by a second user in production and pre-production');
  }
  return { changes: out, before: Object.fromEntries(Object.keys(out).map((f) => [f, current[f]])) };
}

/** Request a change of the owned settings, with a reason (write or approve:data-load); another user approves it. */
export async function requestSettings(body, user, req) {
  const reason = String(body?.reason || '').trim();
  if (!reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason' }]);
  const { changes, before } = await checkedSettings(body?.settings || body);
  let r;
  try {
    r = await one(`INSERT INTO go_live_lock_requests(action, reason, settings, settings_before, requested_by) VALUES ('settings', $1, $2, $3, $4) RETURNING id`,
      [reason.slice(0, 1000), JSON.stringify(changes), JSON.stringify(before), user.id]);
  } catch (e) {
    if (e.code === '23505') throw conflict('A request of the Go-Live tab is already waiting for approval');
    throw e;
  }
  const request = await getLockRequest(r.id);
  await audit(req, { entity: 'go_live_lock', entityId: request.id, action: 'request', after: request });
  await notifyApprovers({ audience: APPROVE, document: ACTION_LABELS.settings, number: `#${request.id}`, by: user.username,
    detail: request.settings.map((x) => x.label).join(', '), link: LINK, entity: 'go_live_lock', entityId: request.id });
  return request;
}

/** Hours of an unlock: a whole number from 1 to migration.unlock_max_hours. */
async function unlockHours(v) {
  const max = Math.max(1, Number(await getSetting('migration.unlock_max_hours', 4)) || 4);
  const h = Number(v);
  if (!Number.isInteger(h) || h < 1 || h > max) throw badRequest('Validation failed', [{ path: 'hours', message: `Hours must be a whole number from 1 to ${max}` }]);
  return h;
}

/** Why a lock or an unlock cannot be requested or approved now (409); the Go decision of a lock. */
async function assertActionAllowed(action, { decisionRef = null } = {}) {
  const state = await lockState(pool);
  if (action === 'lock') {
    if (state.locked) throw conflict('Go-live is already locked');
    const { decisionId, conditions } = await lockConditions();
    const unmet = conditions.filter((c) => !c.met);
    if (unmet.length) {
      throw Object.assign(conflict(`Go-live cannot be locked yet: ${unmet.map((c) => `${c.label.toLowerCase()}${c.detail ? ` (${c.detail})` : ''}`).join('; ')}`),
        { details: unmet.map((c) => ({ path: c.code, message: c.label })) });
    }
    return { decisionId };
  }
  if (!state.locked) throw conflict('Go-live is not locked');
  if (state.unlock) throw conflict(`An unlock is in force until ${new Date(state.unlock.expiresAt).toISOString()}`);
  const days = Number(await getSetting('migration.unlock_window_days', 7));
  const windowEnd = state.lockedAt ? new Date(state.lockedAt).getTime() + days * 86400000 : null;
  if (windowEnd && Date.now() > windowEnd && !decisionRef) {
    throw badRequest('Validation failed', [{ path: 'decisionRef', message: `The lock is older than ${days} days: give the reference of the steering committee decision` }]);
  }
  return { decisionId: null };
}

/** Request a lock or an unlock: { action, reason, decisionRef?, scope? (unlock), hours? (unlock) }. */
export async function requestLock(body, user, req) {
  const action = String(body?.action || '');
  if (!['lock', 'unlock'].includes(action)) throw badRequest('Validation failed', [{ path: 'action', message: 'Action must be lock or unlock' }]);
  const reason = String(body?.reason || '').trim();
  if (!reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason' }]);
  const decisionRef = String(body?.decisionRef || '').trim().slice(0, 200) || null;
  let scope = [];
  let hours = null;
  if (action === 'unlock') {
    scope = [...new Set(Array.isArray(body?.scope) ? body.scope.map(String) : [])];
    const unknown = scope.filter((s) => !IMPORT_SCOPES[s]);
    if (!scope.length || unknown.length) {
      throw badRequest('Validation failed', [{ path: 'scope', message: `Choose the imports to reopen: ${Object.keys(IMPORT_SCOPES).join(', ')}` }]);
    }
    hours = await unlockHours(body?.hours);
  }
  const { decisionId } = await assertActionAllowed(action, { decisionRef });
  let r;
  try {
    r = await one(`INSERT INTO go_live_lock_requests(action, reason, decision_ref, scope, hours, decision_id, requested_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [action, reason.slice(0, 1000), decisionRef, scope, hours, decisionId, user.id]);
  } catch (e) {
    if (e.code === '23505') throw conflict('A request of the Go-Live tab is already waiting for approval');
    throw e;
  }
  const request = await getLockRequest(r.id);
  await audit(req, { entity: 'go_live_lock', entityId: request.id, action: 'request', after: request });
  await notifyApprovers({ audience: APPROVE, document: ACTION_LABELS[action], number: `#${request.id}`, by: user.username,
    detail: action === 'unlock' ? `${request.scopeLabels.join(', ')}, ${hours} h` : null, link: LINK, entity: 'go_live_lock', entityId: request.id });
  return request;
}

async function pendingRequest(id) {
  const request = await getLockRequest(id);
  if (request.status !== 'pending') throw conflict(`The request is ${request.status}`);
  return request;
}

/** Approve a lock or unlock request (another user than the requester): the lock goes on, or the unlock starts for its hours. */
export async function approveLock(id, user, req) {
  const request = await pendingRequest(id);
  await assertChecker(user, request.requestedById, 'lock request', { configurable: false });
  if (request.action === 'settings') return approveSettings(request, user, req);
  const { decisionId } = await assertActionAllowed(request.action, { decisionRef: request.decisionRef });
  await withTransaction(async (db) => {
    const moved = (await db.query(`UPDATE go_live_lock_requests SET status = 'approved', decided_by = $2, decided_at = now(), decision_id = COALESCE($3, decision_id),
        expires_at = CASE WHEN action = 'unlock' THEN now() + make_interval(hours => hours) END
      WHERE id = $1 AND status = 'pending' RETURNING id`, [request.id, user.id, decisionId])).rows[0];
    if (!moved) throw conflict('The request was decided by another user');
    if (request.action === 'lock') {
      for (const [key, value] of [['golive.locked', true], ['golive.locked_at', new Date().toISOString()], ['golive.locked_by', String(request.id)]]) {
        await db.query('UPDATE app_settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1', [key, JSON.stringify(value), user.id]);
      }
    }
  });
  clearSettingsCache();
  const done = await getLockRequest(id);
  await audit(req, { entity: 'go_live_lock', entityId: done.id, action: 'approve', before: request, after: done });
  await notifyDecision({ userId: done.requestedById, decidedBy: user.id, document: ACTION_LABELS[done.action], number: `#${done.id}`, approved: true, by: user.username,
    link: LINK, entity: 'go_live_lock', entityId: done.id });
  return done;
}

/** Approve a settings request: the values are checked again and written with the decision, in one transaction. */
async function approveSettings(request, user, req) {
  const requested = Object.fromEntries(request.settings.map((x) => [x.field, x.after]));
  const { changes } = await checkedSettings(requested);
  const before = await ownedSettings();
  await withTransaction(async (db) => {
    const moved = (await db.query('UPDATE go_live_lock_requests SET status = \'approved\', decided_by = $2, decided_at = now() WHERE id = $1 AND status = \'pending\' RETURNING id',
      [request.id, user.id])).rows[0];
    if (!moved) throw conflict('The request was decided by another user');
    for (const s of GO_LIVE_SETTINGS.filter((x) => changes[x.field] !== undefined)) {
      await db.query('UPDATE app_settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1', [s.key, JSON.stringify(changes[s.field]), user.id]);
    }
  });
  clearSettingsCache();
  const done = await getLockRequest(request.id);
  await audit(req, { entity: 'golive_setting', entityId: 'workspace', action: 'update', before, after: await ownedSettings() });
  await audit(req, { entity: 'go_live_lock', entityId: done.id, action: 'approve', before: request, after: done });
  await notifyDecision({ userId: done.requestedById, decidedBy: user.id, document: ACTION_LABELS.settings, number: `#${done.id}`, approved: true, by: user.username,
    link: LINK, entity: 'go_live_lock', entityId: done.id });
  return done;
}

/** Reject a lock or unlock request (another user than the requester), with remarks. */
export async function rejectLock(id, user, { remarks }, req) {
  const note = String(remarks || '').trim();
  if (!note) throw badRequest('Validation failed', [{ path: 'remarks', message: 'Give the reason of the rejection' }]);
  const request = await pendingRequest(id);
  await assertChecker(user, request.requestedById, 'lock request', { configurable: false });
  const moved = await one(`UPDATE go_live_lock_requests SET status = 'rejected', decided_by = $2, decided_at = now(), decision_remarks = $3 WHERE id = $1 AND status = 'pending' RETURNING id`,
    [request.id, user.id, note.slice(0, 1000)]);
  if (!moved) throw conflict('The request was decided by another user');
  const done = await getLockRequest(id);
  await audit(req, { entity: 'go_live_lock', entityId: done.id, action: 'reject', before: request, after: done });
  await notifyDecision({ userId: done.requestedById, decidedBy: user.id, document: ACTION_LABELS[done.action], number: `#${done.id}`, approved: false, by: user.username,
    reason: note, link: LINK, entity: 'go_live_lock', entityId: done.id });
  return done;
}

/** Withdraw a lock or unlock request (its requester). */
export async function withdrawLock(id, user, req) {
  const request = await pendingRequest(id);
  if (request.requestedById !== user.id) throw forbidden('Only the user who made the request can withdraw it');
  const moved = await one('UPDATE go_live_lock_requests SET status = \'withdrawn\' WHERE id = $1 AND status = \'pending\' RETURNING id', [request.id]);
  if (!moved) throw conflict('The request was decided by another user');
  const done = await getLockRequest(id);
  await audit(req, { entity: 'go_live_lock', entityId: done.id, action: 'withdraw', before: request, after: done });
  return done;
}

/** End the unlocks whose hours have run out (job golive-relock): the imports they reopened close again. */
export async function relock() {
  const ended = await many(`UPDATE go_live_lock_requests SET relocked_at = now() WHERE action = 'unlock' AND status = 'approved' AND relocked_at IS NULL AND expires_at <= now()
    RETURNING id, scope, expires_at`);
  await auditMany(null, ended.map((r) => ({ entity: 'go_live_lock', entityId: r.id, action: 'relock', after: { scope: r.scope, expiresAt: r.expires_at } })));
  return { relocked: ended.length };
}
