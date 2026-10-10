/**
 * Feature entitlements of this environment: the state of every feature of the catalogue (catalogue.js), the checks the
 * rest of the system makes (API gate, scheduler, connectors, settings), and the changes made by the iorta TechNXT
 * platform administrators with maker-checker.
 *
 * State of a feature: 'on', 'read-only' (disabled while records exist: view and export only) or 'off'. Phase 1 and
 * platform features are always 'on'. The others are 'on' or 'read-only' only while feature_entitlements holds a row with
 * a valid signature (HMAC-SHA256 with ENTITLEMENT_SIGNING_KEY) whose effective date has come; a row with a wrong
 * signature counts as off and is reported once on the audit trail and to the platform administrators.
 *
 * The state is cached per API instance for FEATURE_STATE_TTL_SECONDS (default 15) and dropped at once when a change is
 * applied here. Scheduled changes whose date has come are applied when the state is read again.
 */
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound, refused } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { queueEmail } from '../../lib/mailer.js';
import { logger } from '../../lib/logger.js';
import { notify } from '../notifications/service.js';
import { requiredReason } from '../ops-masters/records.js';
import { MANAGE_FEATURES, PLATFORM_ROLE } from '../../lib/platform.js';
import { FEATURES, TIERS, alwaysOn, featureOf, switchable } from './catalogue.js';

export const ON = 'on';
export const READ_ONLY = 'read-only';
export const OFF = 'off';
export const VENDOR_NAME = 'iorta TechNXT';
const STATUS_OF_ROW = { enabled: ON, read_only: READ_ONLY };
const ROW_STATUS = { [ON]: 'enabled', [READ_ONLY]: 'read_only' };

// ---------------------------------------------------------------- signature

const iso = (d) => new Date(d).toISOString();
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
/** Signature of an entitlement row: key, status, effective date and the change that set it. */
export const signRow = (r, key = config.entitlementSigningKey) => crypto.createHmac('sha256', key)
  .update([r.feature_key, r.status, iso(r.effective_from), r.change_id ?? ''].join('|')).digest('hex');
const validSignature = (r) => {
  const expected = Buffer.from(signRow(r));
  const given = Buffer.from(String(r.signature || ''));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

// ---------------------------------------------------------------- state

const ttlMs = () => {
  const v = Number(process.env.FEATURE_STATE_TTL_SECONDS ?? 15);
  return Number.isFinite(v) && v >= 0 ? v * 1000 : 15000;
};
const cache = { at: 0, state: null, pending: null };
const alerted = new Set();

/** Drop the cached state (after a change, or in tests after a row was changed directly). */
export const clearFeatureCache = () => { cache.at = 0; cache.state = null; };

async function raiseTamperAlert(r) {
  if (alerted.has(r.signature)) return;
  alerted.add(r.signature);
  logger.warn?.({ feature: r.feature_key }, 'feature entitlement with an invalid signature: treated as off');
  await query(`INSERT INTO audit_log(user_id, username, entity, entity_id, action, after_data, source) VALUES (NULL, NULL, 'feature', $1, 'signature-invalid', $2, $3)`,
    [r.feature_key, JSON.stringify({ status: r.status, effectiveFrom: r.effective_from, changeId: r.change_id }), JSON.stringify({ channel: 'job', name: 'feature entitlements' })]);
  await notify({ audience: MANAGE_FEATURES, type: 'alert', priority: 'high', title: 'Feature entitlement not trusted',
    message: `The entitlement of ${featureOf(r.feature_key)?.name || r.feature_key} was changed outside an approved change and is treated as off`,
    link: '/master/platform/features', entity: 'feature', entityId: r.feature_key });
}

async function loadState({ applyDue = true } = {}) {
  if (applyDue) await applyDueChanges();
  const rows = await many('SELECT * FROM feature_entitlements');
  const now = Date.now();
  const byKey = new Map();
  for (const r of rows) {
    const f = featureOf(r.feature_key);
    if (!f || alwaysOn(f)) continue;
    if (!validSignature(r)) {
      await raiseTamperAlert(r).catch((e) => logger.warn?.(`feature alert not recorded: ${e.message}`));
      byKey.set(r.feature_key, { status: OFF, row: r, tampered: true });
      continue;
    }
    byKey.set(r.feature_key, { status: new Date(r.effective_from).getTime() <= now ? STATUS_OF_ROW[r.status] : OFF, row: r });
  }
  const status = (key) => {
    const f = featureOf(key);
    if (!f) return ON;
    if (alwaysOn(f)) return ON;
    return byKey.get(key)?.status || OFF;
  };
  return { status, rows: byKey, loadedAt: now };
}

/** The state of the environment: { status(key), rows }. */
export async function featureState() {
  if (cache.state && Date.now() - cache.at < ttlMs()) return cache.state;
  if (!cache.pending) {
    cache.pending = loadState().then((s) => { cache.state = s; cache.at = Date.now(); return s; }).finally(() => { cache.pending = null; });
  }
  return cache.pending;
}

export const featureStatus = async (key) => (await featureState()).status(key);
export const isFeatureOn = async (key) => (await featureStatus(key)) === ON;

/** Refuse when the feature is off (403 FEATURE_NOT_ENABLED); `write` also refuses a read-only feature (FEATURE_READ_ONLY). */
export async function assertFeature(key, { write = false } = {}) {
  const status = await featureStatus(key);
  const name = featureOf(key)?.name || key;
  if (status === OFF) throw refused('FEATURE_NOT_ENABLED', `${name} is not available in this edition`);
  if (write && status === READ_ONLY) throw refused('FEATURE_READ_ONLY', `${name} is read-only in this edition: records can be viewed and exported`);
}

// ---------------------------------------------------------------- what the features control

/** API path pattern to a matcher: whole segments, `*` = one segment, trailing `$` = exact. */
function apiMatcher(pattern) {
  const exact = pattern.endsWith('$');
  const body = (exact ? pattern.slice(0, -1) : pattern).replace(/\/+$/, '');
  const re = body.split('/').map((seg) => (seg === '*' ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/');
  return new RegExp(`^${re}${exact ? '/?$' : '(/|$)'}`);
}
const API_RULES = switchable().flatMap((f) => f.controls.api.map((p) => ({ key: f.key, re: apiMatcher(p) })));
/** The switchable feature an API path belongs to (the first that matches), or null. */
export const featureOfApiPath = (path) => API_RULES.find((r) => r.re.test(path))?.key || null;

const ownerOf = (control) => {
  const map = new Map();
  for (const f of switchable()) for (const v of f.controls[control]) map.set(v, f.key);
  return map;
};
const JOB_OWNER = ownerOf('jobs');
const CONNECTOR_OWNER = ownerOf('connectors');
const SETTING_OWNER = ownerOf('settings');
const REPORT_OWNER = ownerOf('reports');

export const featureOfJob = (code) => JOB_OWNER.get(code) || null;
export const featureOfConnector = (code) => CONNECTOR_OWNER.get(String(code || '').toUpperCase()) || null;
export const featureOfSetting = (key) => SETTING_OWNER.get(key) || null;
export const featureOfReport = (code) => REPORT_OWNER.get(code) || null;

/** Is the job of a feature that is on (a job of no feature always runs)? */
export async function jobAllowed(code) {
  const key = featureOfJob(code);
  return !key || (await featureStatus(key)) === ON;
}
/** Can the connector run (no feature, or its feature on)? */
export async function connectorAllowed(code) {
  const key = featureOfConnector(code);
  return !key || (await featureStatus(key)) === ON;
}
/** Is the report in the edition (no feature, or its feature on or read-only)? */
export async function reportAllowed(code) {
  const key = featureOfReport(code);
  return !key || (await featureStatus(key)) !== OFF;
}
/** Refuse a change of settings of features that are off or read-only. */
export async function assertSettingsAllowed(keys) {
  for (const k of keys) {
    const key = featureOfSetting(k);
    if (key) await assertFeature(key, { write: true });
  }
}

// ---------------------------------------------------------------- views

const STATUS_NAME = { [ON]: 'Enabled', [READ_ONLY]: 'Read-only', [OFF]: 'Not enabled' };

/** The catalogue with the state of this environment. `full` adds what each feature controls (platform administrators). */
export async function catalogueView({ full = false } = {}) {
  const state = await featureState();
  const names = new Map((await many('SELECT id, display_name FROM users WHERE id IN (SELECT approved_by FROM feature_entitlements)')).map((u) => [u.id, u.display_name]));
  // Phase 1, platform, Phase 2, future releases; the catalogue order inside a tier
  const ordered = [...FEATURES].sort((a, b) => TIERS[a.tier].order - TIERS[b.tier].order);
  return ordered.map((f) => {
    const status = state.status(f.key);
    const entry = state.rows.get(f.key);
    const row = entry?.row;
    const on = !alwaysOn(f) && row && !entry.tampered;
    return {
      key: f.key, name: f.name, description: f.description, module: f.module, tier: f.tier, tierName: TIERS[f.tier].name, alwaysOn: alwaysOn(f),
      requirements: f.requirements, dependsOn: f.dependsOn, status, statusName: STATUS_NAME[status],
      decisionPending: !!f.decision, decision: f.decision,
      enabledAt: on ? row.effective_from : null, enabledBy: on ? VENDOR_NAME : null, releaseRef: on ? row.release_ref : null,
      scheduled: !!(on && status === OFF && new Date(row.effective_from) > new Date()),
      ...(full ? { controls: f.controls, approvedBy: on ? names.get(row.approved_by) || null : null, tampered: !!entry?.tampered } : {}),
    };
  });
}

/** What the front end needs to shape menus, routes and sections: the features that are not plainly on. */
export async function clientState() {
  const state = await featureState();
  return FEATURES.filter((f) => state.status(f.key) !== ON).map((f) => ({
    key: f.key, status: state.status(f.key), menus: f.controls.menus, routes: f.controls.routes,
  }));
}

// ---------------------------------------------------------------- planning a change

/**
 * The features a change touches: the requested ones and, for an enable, the switchable features they depend on that
 * are off (enabled with them); for a disable, the features on that depend on them (disabled with them).
 */
function resolve(action, requested, state) {
  const out = new Map();
  const add = (key, why) => { if (!out.has(key)) out.set(key, why); };
  const queue = requested.map((k) => [k, { reason: 'requested' }]);
  while (queue.length) {
    const [key, why] = queue.shift();
    const f = featureOf(key);
    if (!f || alwaysOn(f) || out.has(key)) continue;
    add(key, why);
    if (action === 'enable') {
      for (const d of f.dependsOn) {
        const dep = featureOf(d);
        if (dep && !alwaysOn(dep) && state.status(d) !== ON) queue.push([d, { reason: 'dependency', of: key }]);
      }
    } else {
      for (const other of switchable()) {
        if (other.dependsOn.includes(key) && state.status(other.key) !== OFF) queue.push([other.key, { reason: 'dependent', of: key }]);
      }
    }
  }
  return out;
}

const tableExists = async (table) => !!(await one('SELECT to_regclass($1) AS t', [`public.${table}`]))?.t;
/** Records of a feature (its `data` tables): a disable keeps the feature read-only while there are any. */
async function recordsOf(f) {
  let n = 0;
  for (const table of f.controls.data) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table) || !(await tableExists(table))) continue;
    n += (await one(`SELECT count(*)::int AS n FROM ${table}`)).n;
  }
  return n;
}

/** Validate a request body: action, features or a tier bundle; returns the requested keys. */
function requestedKeys({ action, features = [], tier = null }) {
  if (!['enable', 'disable'].includes(action)) throw badRequest('Validation failed', [{ path: 'action', message: 'Action must be enable or disable' }]);
  if (tier) {
    if (!['PHASE_2', 'FUTURE'].includes(tier)) throw badRequest('Validation failed', [{ path: 'tier', message: 'Only Phase 2 or the future releases are enabled as a bundle' }]);
    return switchable().filter((f) => f.tier === tier).map((f) => f.key);
  }
  const keys = [...new Set(features)];
  if (!keys.length) throw badRequest('Validation failed', [{ path: 'features', message: 'Choose at least one feature' }]);
  const unknown = keys.filter((k) => !featureOf(k));
  if (unknown.length) throw badRequest('Validation failed', [{ path: 'features', message: `Unknown feature: ${unknown.join(', ')}` }]);
  const fixed = keys.filter((k) => alwaysOn(featureOf(k)));
  if (fixed.length) throw badRequest('Validation failed', [{ path: 'features', message: `${fixed.map((k) => featureOf(k).name).join(', ')} is always on (${TIERS[featureOf(fixed[0]).tier].name})` }]);
  return keys;
}

/** Roles of the tenant that hold one of the permissions (directly or through an included role), by name. */
async function rolesHolding(permissions) {
  if (!permissions.length) return [];
  const { rows } = await query(`WITH RECURSIVE holders(id, code) AS (
      SELECT DISTINCT r.id, r.code FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id WHERE p.code = ANY($1)
      UNION SELECT r.id, r.code FROM roles r JOIN holders h ON h.code = ANY(r.inherits))
    SELECT DISTINCT r.code, r.name FROM holders h JOIN roles r ON r.id = h.id
    WHERE r.status = 'active' AND r.code <> $2 AND r.code = ANY(SELECT jsonb_array_elements(g->'roles')->>'code' FROM app_settings s, jsonb_array_elements(s.value) g WHERE s.key = 'access.role_groups')
    ORDER BY r.name`, [permissions, PLATFORM_ROLE]);
  return rows.map((r) => ({ code: r.code, name: r.name }));
}

/**
 * Impact of a change before it is requested: the features with their state before and after (dependencies included,
 * read-only where records exist), and what they bring or take away: menus, roles that gain access, jobs, connectors,
 * settings to configure and sections of screens.
 */
export async function preview(body) {
  const keys = requestedKeys(body);
  const state = await featureState();
  const plan = resolve(body.action, keys, state);
  const features = [];
  for (const [key, why] of plan) {
    const f = featureOf(key);
    const from = state.status(key);
    let to = body.action === 'enable' ? ON : OFF;
    let records = 0;
    if (body.action === 'disable' && from !== OFF) {
      records = await recordsOf(f);
      if (records > 0) to = READ_ONLY;
    }
    features.push({ key, name: f.name, tier: f.tier, tierName: TIERS[f.tier].name, from, to, records, reason: why.reason,
      because: why.of ? featureOf(why.of).name : null, decisionPending: !!f.decision });
  }
  const changing = features.filter((x) => x.from !== x.to);
  const list = (control) => [...new Set(changing.flatMap((x) => featureOf(x.key).controls[control]))];
  const jobs = list('jobs');
  const connectors = list('connectors');
  const settingKeys = list('settings');
  const [jobRows, connectorRows, settingRows, roles] = await Promise.all([
    jobs.length ? many('SELECT code, name FROM scheduled_jobs WHERE code = ANY($1) ORDER BY name', [jobs]) : [],
    connectors.length ? many('SELECT code, name FROM integration_connectors WHERE code = ANY($1) ORDER BY name', [connectors]) : [],
    settingKeys.length ? many('SELECT key, label FROM app_settings WHERE key = ANY($1) ORDER BY label', [settingKeys]) : [],
    body.action === 'enable' ? rolesHolding(list('permissions')) : [],
  ]);
  return {
    action: body.action, tier: body.tier || null, features, changes: changing.length,
    menus: list('menus'), sections: list('sections'), roles,
    jobs: jobRows.map((j) => ({ code: j.code, name: j.name })), connectors: connectorRows.map((c) => ({ code: c.code, name: c.name })),
    settings: settingRows.map((s) => ({ key: s.key, label: s.label })),
    readOnly: changing.filter((x) => x.to === READ_ONLY).map((x) => ({ key: x.key, name: x.name, records: x.records })),
  };
}

// ---------------------------------------------------------------- requests and decisions

const REF = (id) => `FCR-${String(id).padStart(5, '0')}`;
const changeRow = (c, names = new Map()) => ({
  id: Number(c.id), ref: REF(c.id), action: c.action, tier: c.tier, tierName: c.tier ? TIERS[c.tier].name : null, features: c.features, plan: c.plan,
  reason: c.reason, releaseRef: c.release_ref, immediate: c.immediate, effectiveAt: c.effective_at, source: c.source, sourceEnvironment: c.source_environment,
  status: c.status, requestedBy: c.requested_by, requestedByName: names.get(c.requested_by) || null, requestedAt: c.requested_at,
  decidedBy: c.decided_by, decidedByName: names.get(c.decided_by) || null, decidedAt: c.decided_at, remarks: c.remarks, appliedAt: c.applied_at,
});

export async function listChanges({ status = null } = {}) {
  const rows = await many(`SELECT * FROM feature_changes WHERE ($1::text IS NULL OR status = $1) ORDER BY id DESC LIMIT 200`, [status || null]);
  const ids = [...new Set(rows.flatMap((r) => [r.requested_by, r.decided_by]).filter(Boolean))];
  const names = new Map((await many('SELECT id, display_name FROM users WHERE id = ANY($1)', [ids])).map((u) => [u.id, u.display_name]));
  return rows.map((r) => changeRow(r, names));
}

async function getChange(id, db = { query }) {
  const c = (await db.query('SELECT * FROM feature_changes WHERE id = $1 FOR UPDATE', [Number(id) || 0])).rows[0];
  if (!c) throw notFound('Change not found');
  return c;
}

/**
 * Request a change (maker): { action, features | tier, reasonCode, note, releaseRef, effective: 'immediate' | 'scheduled',
 * effectiveAt }. The reason is one of the Reason Codes master (context feature_change).
 * The plan of the preview is kept with it; nothing changes until another platform administrator approves.
 */
export async function requestChange(body, user, { source = 'request', sourceEnvironment = null } = {}) {
  const reason = (await requiredReason({ query }, 'feature_change', body)).text;
  const releaseRef = String(body.releaseRef || '').trim();
  const errors = [];
  if (!releaseRef) errors.push({ path: 'releaseRef', message: 'Contract or change request reference is required' });
  const immediate = body.effective !== 'scheduled';
  let effectiveAt = null;
  if (!immediate) {
    effectiveAt = body.effectiveAt ? new Date(body.effectiveAt) : null;
    if (!effectiveAt || Number.isNaN(effectiveAt.getTime())) errors.push({ path: 'effectiveAt', message: 'Effective date is required for a scheduled change' });
    else if (effectiveAt.getTime() <= Date.now()) errors.push({ path: 'effectiveAt', message: 'A scheduled change takes effect in the future' });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  const p = await preview(body);
  if (!p.changes) throw badRequest('Nothing to change: the features are already in that state');
  const busy = await one(`SELECT id FROM feature_changes WHERE status IN ('pending', 'scheduled') AND features && $1 LIMIT 1`, [p.features.map((x) => x.key)]);
  if (busy) throw conflict(`Change ${REF(busy.id)} for these features is waiting; decide or withdraw it first`);
  const row = await one(`INSERT INTO feature_changes(action, tier, features, plan, reason, release_ref, immediate, effective_at, source, source_environment, requested_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
  [p.action, p.tier, p.features.map((x) => x.key), JSON.stringify(p.features), reason, releaseRef, immediate, effectiveAt, source, sourceEnvironment, user.id]);
  await notify({ audience: MANAGE_FEATURES, type: 'approval', title: `Feature change ${REF(row.id)} awaiting approval`,
    message: `${p.action === 'enable' ? 'Enable' : 'Disable'} ${p.features.length} feature(s): ${reason}`, link: '/master/platform/features?view=changes',
    entity: 'feature_change', entityId: row.id });
  return { change: changeRow(row), preview: p };
}

/**
 * Decide a change (checker): approve (remarks optional) or reject with a reason of the Reason Codes master (context
 * feature_reject). The checker is never the requester.
 */
export async function decideChange(id, { decision, remarks, reasonCode, note }, user) {
  if (!['approve', 'reject'].includes(decision)) throw badRequest('Validation failed', [{ path: 'decision', message: 'Decision must be approve or reject' }]);
  if (decision === 'reject') remarks = (await requiredReason({ query }, 'feature_reject', { reasonCode, note })).text;
  const result = await withTransaction(async (c) => {
    const ch = await getChange(id, c);
    if (ch.status !== 'pending') throw conflict(`Change ${REF(ch.id)} is ${ch.status}`);
    await assertChecker(user, ch.requested_by, 'feature change', { configurable: false });
    if (decision === 'reject') {
      await c.query(`UPDATE feature_changes SET status = 'rejected', decided_by = $2, decided_at = now(), remarks = $3 WHERE id = $1`, [ch.id, user.id, remarks]);
      return { ch, applied: [] };
    }
    if (!ch.immediate && new Date(ch.effective_at) > new Date()) {
      await c.query(`UPDATE feature_changes SET status = 'scheduled', decided_by = $2, decided_at = now(), remarks = $3 WHERE id = $1`, [ch.id, user.id, remarks || null]);
      return { ch, applied: [], scheduled: true };
    }
    await c.query(`UPDATE feature_changes SET decided_by = $2, decided_at = now(), remarks = $3 WHERE id = $1`, [ch.id, user.id, remarks || null]);
    const applied = await applyChange(c, { ...ch, decided_by: user.id });
    return { ch, applied };
  });
  clearFeatureCache();
  const after = (await listChanges()).find((x) => x.id === Number(result.ch.id));
  if (result.applied.length) await announce(after, result.applied);
  return { change: after, applied: result.applied };
}

export async function withdrawChange(id, user) {
  return withTransaction(async (c) => {
    const ch = await getChange(id, c);
    if (!['pending', 'scheduled'].includes(ch.status)) throw conflict(`Change ${REF(ch.id)} is ${ch.status}`);
    if (ch.status === 'pending' && ch.requested_by !== user.id) throw refused('NOT_REQUESTER', 'Only the requester withdraws a change waiting for approval; an approver rejects it');
    await c.query(`UPDATE feature_changes SET status = 'withdrawn', remarks = COALESCE(remarks, 'Withdrawn') WHERE id = $1`, [ch.id]);
    return changeRow({ ...ch, status: 'withdrawn' });
  });
}

/**
 * Apply an approved change inside a transaction: the plan is checked again against the current state (records may have
 * appeared since the request), each entitlement row is written signed (or removed), and every feature changed is
 * recorded on the audit trail.
 */
async function applyChange(c, ch) {
  const state = await loadState({ applyDue: false });
  const applied = [];
  const at = ch.immediate ? new Date() : new Date(ch.effective_at);
  for (const item of ch.plan) {
    const f = featureOf(item.key);
    if (!f || alwaysOn(f)) continue;
    const from = state.status(item.key);
    let to = ch.action === 'enable' ? ON : OFF;
    if (ch.action === 'disable' && (await recordsOf(f)) > 0) to = READ_ONLY;
    if (from === to) continue;
    if (to === OFF) {
      await c.query('DELETE FROM feature_entitlements WHERE feature_key = $1', [item.key]);
    } else {
      const row = { feature_key: item.key, status: ROW_STATUS[to], effective_from: at, change_id: Number(ch.id) };
      await c.query(`INSERT INTO feature_entitlements(feature_key, status, effective_from, change_id, change_ref, release_ref, approved_by, approved_at, signature, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8,now())
        ON CONFLICT (feature_key) DO UPDATE SET status = EXCLUDED.status, effective_from = EXCLUDED.effective_from, change_id = EXCLUDED.change_id,
          change_ref = EXCLUDED.change_ref, release_ref = EXCLUDED.release_ref, approved_by = EXCLUDED.approved_by, approved_at = now(), signature = EXCLUDED.signature, updated_at = now()`,
      [item.key, row.status, at, row.change_id, REF(ch.id), ch.release_ref, ch.decided_by, signRow(row)]);
    }
    await c.query(`INSERT INTO audit_log(user_id, username, entity, entity_id, action, before_data, after_data, source)
      SELECT $1, u.username, 'feature', $2, $3, $4, $5, $6 FROM users u WHERE u.id = $1`,
    [ch.decided_by, item.key, to === ON ? 'enable' : to === READ_ONLY ? 'read-only' : 'disable', JSON.stringify({ status: from }),
      JSON.stringify({ status: to, change: REF(ch.id), releaseRef: ch.release_ref, reason: ch.reason }), JSON.stringify({ channel: 'screen', name: 'Master > Platform > Features & Releases' })]);
    applied.push({ key: item.key, name: f.name, from, to });
  }
  await c.query(`UPDATE feature_changes SET status = 'applied', applied_at = now() WHERE id = $1`, [ch.id]);
  return applied;
}

let applying = null;
/** Apply the scheduled changes whose date has come (one instance at a time; the others skip the locked rows). */
export async function applyDueChanges() {
  if (applying) return applying;
  applying = (async () => {
    const due = await many(`SELECT id FROM feature_changes WHERE status = 'scheduled' AND effective_at <= now() ORDER BY effective_at, id`);
    for (const { id } of due) {
      const done = await withTransaction(async (c) => {
        const ch = (await c.query(`SELECT * FROM feature_changes WHERE id = $1 AND status = 'scheduled' FOR UPDATE SKIP LOCKED`, [id])).rows[0];
        return ch ? { ch, applied: await applyChange(c, ch) } : null;
      });
      if (done?.applied.length) {
        const after = (await listChanges()).find((x) => x.id === Number(id));
        await announce(after, done.applied).catch((e) => logger.warn?.(`feature change ${REF(id)}: notice not sent: ${e.message}`));
      }
    }
  })().finally(() => { applying = null; });
  return applying;
}

const WORDS = { [ON]: 'enabled', [READ_ONLY]: 'set to read-only', [OFF]: 'disabled' };
/** Tell the roles of features.notify_roles (bell and e-mail) and the platform administrators what changed. */
async function announce(change, applied) {
  const lines = applied.map((a) => `${a.name}: ${WORDS[a.to]}`);
  const title = `Platform features changed (${change.ref})`;
  const message = `${lines.join('; ')}. Reference ${change.releaseRef}.`;
  await notify({ audience: 'read:features', type: 'info', title, message, link: '/master/configuration/features', entity: 'feature_change', entityId: change.id });
  await notify({ audience: MANAGE_FEATURES, type: 'info', title, message, link: '/master/platform/features?view=changes', entity: 'feature_change', entityId: change.id });
  const roles = await getSetting('features.notify_roles', []);
  const people = Array.isArray(roles) && roles.length ? await many(`SELECT DISTINCT u.email FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
    WHERE r.code = ANY($1) AND u.status = 'active' AND u.email IS NOT NULL AND u.email <> ''`, [roles]) : [];
  const html = `<p>The following platform features were changed by ${VENDOR_NAME} under ${escapeHtml(change.releaseRef)} (${change.ref}):</p>
    <ul>${applied.map((a) => `<li>${escapeHtml(a.name)}: ${WORDS[a.to]}</li>`).join('')}</ul>
    <p>Master &gt; System Configuration &gt; Features &amp; Releases lists every feature with its status.</p>`;
  for (const p of people) {
    await queueEmail({ to: p.email, subject: title, html, template: 'feature_change', entity: 'feature_change', entityId: change.id });
  }
}

// ---------------------------------------------------------------- promotion between environments

/** Entitlements of this environment for promotion (Phase 2 and future features with their state). */
export async function exportState(environment) {
  const state = await featureState();
  return { environment, exportedAt: new Date().toISOString(),
    features: switchable().map((f) => ({ key: f.key, name: f.name, tier: f.tier, status: state.status(f.key) })) };
}

/**
 * Raise change requests that bring this environment to the state of an export of another one (UAT to Production):
 * one request for the features to enable, one for those to disable. Each waits for a second platform administrator.
 */
export async function promote(file, body, user) {
  const list = Array.isArray(file?.features) ? file.features : null;
  if (!list) throw badRequest('Not an export of the features of an environment');
  const state = await featureState();
  const wanted = new Map(list.filter((x) => featureOf(x?.key) && !alwaysOn(featureOf(x.key))).map((x) => [x.key, x.status === OFF ? OFF : ON]));
  const enable = [...wanted].filter(([k, s]) => s === ON && state.status(k) !== ON).map(([k]) => k);
  const disable = [...wanted].filter(([k, s]) => s === OFF && state.status(k) !== OFF).map(([k]) => k);
  const source = String(file.environment || '').slice(0, 40) || null;
  const out = [];
  if (enable.length) out.push((await requestChange({ ...body, action: 'enable', features: enable }, user, { source: 'promotion', sourceEnvironment: source })).change);
  if (disable.length) out.push((await requestChange({ ...body, action: 'disable', features: disable }, user, { source: 'promotion', sourceEnvironment: source })).change);
  return { changes: out, enable, disable };
}

// ---------------------------------------------------------------- platform administrators

/** Platform administrator accounts (the vendor role), for the platform screen only. */
export async function platformAdmins() {
  return many(`SELECT u.id, u.username, u.display_name AS "displayName", u.email, u.status, u.totp_enabled AS "twoFactorEnabled", u.last_login_at AS "lastLoginAt"
    FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.code = $1 ORDER BY u.display_name`, [PLATFORM_ROLE]);
}
