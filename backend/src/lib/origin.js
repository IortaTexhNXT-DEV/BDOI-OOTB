/**
 * Origin of a business record (migration 0440): 'issued' when it was entered or issued in BrokerVerse, 'migrated' when
 * it was loaded from the legacy system at go-live (Data Migration & Go-Live). Clients, policies, receivables, claims,
 * journal vouchers and post-dated cheques carry origin, legacy_system, legacy_number, migrated_at, migrated_by and
 * load_batch_id. Readers filter and label through these helpers, never through the older flags (clients.source,
 * policies doc.source, claims details.source, receivables source 'opening'), which writers still set for the reports
 * and scripts that read them.
 *
 * API block on every record returned: { kind: 'migrated', label, legacySystem, legacyNumber, loadId, loadNumber,
 * migratedAt, migratedByName } or { kind: 'issued', label }. The origin fields are read-only after the load.
 */
import { badRequest } from './errors.js';
import { getSetting } from './settings.js';

export const ISSUED = 'issued';
export const MIGRATED = 'migrated';
export const ORIGINS = [ISSUED, MIGRATED];
export const ORIGIN_LABELS = { [ISSUED]: 'Issued in BrokerVerse', [MIGRATED]: 'Migrated' };

/** Settings that let migrated policies count in a kind of figures (default: they do not). */
const KPI_SETTINGS = { kpi: 'migration.kpi_include_migrated', commission: 'migration.commission_include_migrated', incentive: 'migration.incentive_include_migrated' };

/** Name of the legacy system shown on migrated records when a load names none. */
export async function legacySystemName() {
  return String((await getSetting('migration.legacy_system_name', 'Legacy')) || '').trim() || 'Legacy';
}

/** Load number of a migration batch (same form as data_load_batches.load_number). */
export const loadNumberOf = (batchId) => (batchId === null || batchId === undefined ? null : `MIG-${String(batchId).padStart(6, '0')}`);

/** The origin asked for by a list filter (?origin=issued|migrated); null for all. */
export function originParam(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v || v === 'all') return null;
  if (!ORIGINS.includes(v)) throw badRequest('origin must be issued, migrated or all');
  return v;
}

/** SQL condition on the origin of `alias` ('' for an unqualified column), or '' for all; the value goes into params. */
export function originWhere(alias, origin, params) {
  const o = originParam(origin);
  if (!o) return '';
  params.push(o);
  return `${alias ? `${alias}.` : ''}origin = $${params.length}`;
}

/**
 * SQL condition that keeps migrated policies out of a kind of figures (kpi, commission, incentive), or '' when the
 * setting of that kind includes them.
 */
export async function kpiOriginWhere(alias, kind) {
  const key = KPI_SETTINGS[kind];
  if (!key) throw new Error(`unknown figure kind ${kind}`);
  if ((await getSetting(key, false)) === true) return '';
  return `${alias ? `${alias}.` : ''}origin = '${ISSUED}'`;
}

/** Select-list column with the display name of the user who migrated the record of `alias` (read by originOf). */
export const originColumns = (alias) => `(SELECT ou.display_name FROM users ou WHERE ou.id = ${alias}.migrated_by) AS origin_migrated_by_name`;

/**
 * API origin block of a row (columns origin, legacy_system, legacy_number, load_batch_id, migrated_at and, when
 * selected, origin_migrated_by_name). batch: { id, loadNumber } of the load when the caller has it.
 */
export function originOf(row, batch = null) {
  if (!row || row.origin !== MIGRATED) return { kind: ISSUED, label: ORIGIN_LABELS[ISSUED] };
  const loadId = batch?.id ?? row.load_batch_id ?? null;
  return {
    kind: MIGRATED, label: ORIGIN_LABELS[MIGRATED], legacySystem: row.legacy_system || null, legacyNumber: row.legacy_number || null,
    loadId, loadNumber: batch?.loadNumber ?? loadNumberOf(loadId), migratedAt: row.migrated_at || null, migratedByName: row.origin_migrated_by_name || null,
  };
}

/** Body keys of the origin fields (the API block and the column names in camel case). */
export const ORIGIN_FIELDS = ['origin', 'legacySystem', 'legacyNumber', 'migratedAt', 'migratedBy', 'migratedByName', 'loadBatchId', 'loadId', 'loadNumber'];

const same = (a, b) => String(a ?? '') === String(b ?? '');
const time = (v) => (v ? new Date(v).getTime() : null);

/**
 * Refuse an update that changes the origin of a record (origin, legacy system and number, migrated at / by, load):
 * they are set by the load and read-only afterwards. A body that sends back the values it read is accepted. Returns the
 * body without these keys.
 */
export function withoutOriginFields(body, row) {
  if (!body || typeof body !== 'object') return body;
  const sent = ORIGIN_FIELDS.filter((k) => body[k] !== undefined);
  if (!sent.length) return body;
  const block = body.origin && typeof body.origin === 'object' ? body.origin : { kind: body.origin };
  const stored = originOf(row);
  const changed = (body.origin !== undefined && !same(block.kind, stored.kind))
    || (block.legacyNumber !== undefined && !same(block.legacyNumber, stored.legacyNumber))
    || (block.legacySystem !== undefined && !same(block.legacySystem, stored.legacySystem))
    || (block.loadId !== undefined && !same(block.loadId, stored.loadId))
    || (body.legacyNumber !== undefined && !same(body.legacyNumber, row?.legacy_number))
    || (body.legacySystem !== undefined && !same(body.legacySystem, row?.legacy_system))
    || (body.migratedBy !== undefined && !same(body.migratedBy, row?.migrated_by))
    || (body.migratedAt !== undefined && time(body.migratedAt) !== time(row?.migrated_at))
    || (body.loadBatchId !== undefined && !same(body.loadBatchId, row?.load_batch_id))
    || (body.loadId !== undefined && !same(body.loadId, row?.load_batch_id));
  if (changed) {
    throw badRequest('The origin of a record cannot be changed: origin, legacy number, legacy system, migration date and user and load are set by the migration load',
      sent.map((k) => ({ path: k, message: 'Read-only' })));
  }
  return Object.fromEntries(Object.entries(body).filter(([k]) => !ORIGIN_FIELDS.includes(k)));
}
