/**
 * Master > Environment Promotion > Promotion Path: where this environment stands on the promotion path, the release it
 * runs, and the last export, load and comparison of the configuration workbook. The marker of the environment
 * (system.environment) is set here only (lib/settingOwners.js); the workbook never carries it.
 */
import { query, one } from '../../db/pool.js';
import { getSetting, setSetting } from '../../lib/settings.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { buildIdentity, releaseIdentity } from '../system/router.js';
import { goLiveState } from '../data-load/service.js';

const DEFAULT_PATH = ['dev', 'sit', 'uat', 'preprod', 'production'];
const DEFAULT_LABELS = { dev: 'Development', sit: 'System Integration Testing', uat: 'User Acceptance Testing', preprod: 'Pre-Production', training: 'Training', production: 'Production' };
const code = (v) => String(v || '').trim().toLowerCase();

async function pathSettings() {
  const path = await getSetting('promotion.path', DEFAULT_PATH);
  const labels = await getSetting('promotion.environment_labels', DEFAULT_LABELS);
  const codes = (Array.isArray(path) && path.length ? path : DEFAULT_PATH).map(code).filter(Boolean);
  return { codes, labels: { ...DEFAULT_LABELS, ...(labels && typeof labels === 'object' ? labels : {}) } };
}

/** The codes an environment may be marked as: the path and the environments outside it (training). */
export async function environmentCodes() {
  const { codes, labels } = await pathSettings();
  return [...new Set([...codes, ...Object.keys(labels)])];
}

async function schemaVersion() {
  const r = await one("SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1").catch(() => null);
  return r?.name || null;
}

export async function promotionPath() {
  const { codes, labels } = await pathSettings();
  const environment = code(await getSetting('system.environment', 'dev')) || 'dev';
  const at = codes.indexOf(environment);
  const path = codes.map((c, i) => ({ code: c, label: labels[c] || c, position: i + 1, current: c === environment, done: at >= 0 && i < at }));
  const [release, state, lastExport, lastLoad, lastComparison] = await Promise.all([
    releaseIdentity({ signedIn: true }),
    goLiveState(),
    one("SELECT at, username FROM audit_log WHERE entity = 'data_load' AND action = 'export-current-data' ORDER BY at DESC LIMIT 1"),
    one(`SELECT b.id, b.file_name, b.loaded_at, b.created_at, u.display_name FROM data_load_batches b LEFT JOIN users u ON u.id = b.created_by
         WHERE b.kit = 'configuration' AND b.status = 'loaded' ORDER BY b.created_at DESC LIMIT 1`),
    one(`SELECT c.id, c.file_name, c.verdict, c.created_at, u.display_name FROM data_load_comparisons c LEFT JOIN users u ON u.id = c.created_by
         ORDER BY c.created_at DESC LIMIT 1`),
  ]);
  const build = buildIdentity();
  return {
    environment, label: labels[environment] || environment, onPath: at >= 0,
    previous: at > 0 ? path[at - 1] : null, next: at >= 0 && at < path.length - 1 ? path[at + 1] : null,
    path, choices: (await environmentCodes()).map((c) => ({ code: c, label: labels[c] || c })),
    release: { ...release, commit: build.commit, ref: build.ref, buildTime: build.buildTime, schema: await schemaVersion() },
    cutoverDate: state.cutoverDate, locked: state.locked,
    lastExport: lastExport ? { at: lastExport.at, by: lastExport.username } : null,
    lastLoad: lastLoad ? { batchId: lastLoad.id, fileName: lastLoad.file_name, at: lastLoad.loaded_at || lastLoad.created_at, by: lastLoad.display_name } : null,
    lastComparison: lastComparison ? { id: lastComparison.id, fileName: lastComparison.file_name, verdict: lastComparison.verdict, at: lastComparison.created_at, by: lastComparison.display_name } : null,
  };
}

/** Mark this database as an environment of the path. A locked (live) database is production and stays so. */
export async function setEnvironment(value, user) {
  const next = code(value);
  const choices = await environmentCodes();
  if (!choices.includes(next)) throw badRequest(`Unknown environment "${value}"; choose one of ${choices.join(', ')}`, [{ path: 'environment', message: 'Unknown environment' }]);
  const before = code(await getSetting('system.environment', 'dev'));
  const { locked } = await goLiveState();
  if (locked && next !== 'production') throw conflict('Go-live is locked on this database: it is the production environment and cannot be marked as another one');
  if (before !== next) await setSetting('system.environment', next, user?.id || null);
  return { before, after: next };
}

/** The loads of the configuration workbook and the exports made from here, newest first (the promotion history). */
export async function history({ limit = 20 } = {}) {
  const r = await query(`SELECT b.id, b.file_name AS "fileName", b.status, b.rows_read AS "rowsRead", b.rows_error AS "rowsError", b.created_at AS "createdAt", b.loaded_at AS "loadedAt", u.display_name AS "createdBy"
    FROM data_load_batches b LEFT JOIN users u ON u.id = b.created_by WHERE b.kit = 'configuration' ORDER BY b.created_at DESC LIMIT $1`, [limit]);
  return r.rows;
}
