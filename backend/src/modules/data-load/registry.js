/**
 * Registry of the objects loaded from a workbook: one entry per object, the same definitions for the go-live kits, the
 * master data upload and Environment Promotion (REG-1 contract of the master data upload design; this file moves to
 * master-data/registry.js when that module lands, with a re-export here).
 *
 * An entry is the sheet of the object (common.js: key, name, menu, columns, keyColumns, keyOf, sample, exportRows,
 * check, importRow(ctx, v, mode), importSheet, totals) with:
 *   label           the object's name (= the worksheet name)
 *   module          the module that owns the records
 *   dependsOn       keys of the objects its rows refer to: the load order is a topological sort on them (an object
 *                   of another kit, e.g. a migrated policy's branch, is loaded by that kit first)
 *   kit             configuration | migration: which go-live workbook carries it
 *   channels        where it may be used: setup, upload, promotion (configuration objects), migration
 *   promotable      false for the migration objects: an Environment Promotion package never carries business records
 *   origin          migration objects: { table, legacyNumberColumn } the records it creates are tagged in (lib/origin.js)
 *   duplicateRules  migration objects: duplicate checks that apply to it (setting migration.duplicate_rules)
 * Objects of the same kit with no dependency between them keep the order they are declared in below.
 */
import { badRequest } from '../../lib/errors.js';
import { CONFIGURATION_SHEETS, masterSheet } from './configuration.js';
import { MIGRATION_SHEETS } from './migration.js';

const CONFIGURATION_CHANNELS = ['setup', 'upload', 'promotion'];
const MIGRATION_CHANNELS = ['migration'];

const master = (code, dependsOn = []) => ({ key: `master:${code}`, module: 'masters', dependsOn, build: () => masterSheet(code) });
const own = (key, module, dependsOn = []) => ({ key, module, dependsOn, build: async () => CONFIGURATION_SHEETS[key]() });

/** Configuration kit: everything needed to run new business. */
const CONFIGURATION = [
  master('company'), own('settings', 'settings', ['master:company']),
  master('country'), master('region', ['master:country']), master('state', ['master:region']), master('city', ['master:state']), master('barangay', ['master:city']),
  master('branch', ['master:company', 'master:city']), master('department', ['master:branch']), master('hierarchy'), master('designation', ['master:hierarchy']),
  own('users', 'users', ['master:branch', 'master:department', 'master:designation']),
  master('currency'), master('exchange-rate', ['master:currency']), own('chart-of-accounts', 'accounting', ['master:currency']),
  master('bank'), master('bank-account', ['master:bank', 'master:currency', 'chart-of-accounts']), master('signatory', ['users']),
  master('transaction-code', ['chart-of-accounts']), master('write-off-reason', ['chart-of-accounts']),
  master('insurance-company', ['chart-of-accounts']), master('line-of-business'), master('product', ['master:line-of-business', 'master:insurance-company']),
  master('policy-type', ['master:product']), master('cover', ['master:product']),
  master('vehicle-brand'), master('vehicle-model', ['master:vehicle-brand']), master('vehicle-variant', ['master:vehicle-model']), master('vehicle', ['master:vehicle-variant']),
  master('supplier'), master('asset-class', ['chart-of-accounts']), master('short-period-rate'), master('cancellation-reason'),
  master('claim-document-requirement', ['master:product']), master('repair-shop'), master('lead-source'), master('reason-code'),
  own('commission-rates', 'commission', ['master:insurance-company', 'master:product']), own('premium-charges', 'premium-charges', ['master:product', 'chart-of-accounts']),
  own('lgu-rates', 'premium-charges', ['master:city']), own('authority-limits', 'access-control', ['users']), own('numbering', 'document-numbering', ['master:branch']),
  // integrations: bank accounts of the payees paid by bank file, COC number series of the insurers
  own('payee-bank-accounts', 'integrations', ['master:bank', 'master:insurance-company', 'master:supplier']),
  own('coc-series', 'integrations', ['master:insurance-company', 'master:branch']),
].map((e) => ({ ...e, kit: 'configuration', channels: CONFIGURATION_CHANNELS, promotable: true }));

const migrated = (key, module, dependsOn, origin, duplicateRules = []) => ({
  key, module, dependsOn, origin, duplicateRules, kit: 'migration', channels: MIGRATION_CHANNELS, promotable: false, build: async () => MIGRATION_SHEETS[key](),
});

/** Migration kit: the open business of the legacy system at cutover. */
const MIGRATION = [
  migrated('clients', 'clients', ['master:branch', 'users'], { table: 'clients', legacyNumberColumn: 'client_code' }, ['tin', 'name-birth-date', 'company-name']),
  migrated('policies', 'policies', ['clients', 'master:insurance-company', 'master:product', 'users', 'master:branch'], { table: 'policies', legacyNumberColumn: 'policy_number' },
    ['vehicle', 'coc', 'policy-number', 'insurer-variant']),
  migrated('open-items', 'receipts', ['policies'], { table: 'receivables', legacyNumberColumn: 'reference' }),
  migrated('claims', 'claims', ['policies', 'users'], { table: 'claims', legacyNumberColumn: 'claim_number' }),
  migrated('opening-balances', 'period-end', ['chart-of-accounts'], { table: 'opening_balances', legacyNumberColumn: null }),
];

const ENTRIES = [...CONFIGURATION, ...MIGRATION];

/** Registry entries without their sheets (key, module, dependsOn, kit, channels, promotable, origin, duplicateRules). */
export const registryEntries = () => ENTRIES.map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'build')));

/**
 * Keys in load order: a topological sort on dependsOn inside the given entries (dependencies outside them are loaded
 * by another kit first); among the objects ready to load, the one declared first. A cycle is a programming error.
 */
export function loadOrder(entries) {
  const index = new Map(entries.map((e, i) => [e.key, i]));
  const waiting = new Map(entries.map((e) => [e.key, new Set(e.dependsOn.filter((d) => index.has(d) && d !== e.key))]));
  const out = [];
  while (waiting.size) {
    const ready = [...waiting].filter(([, deps]) => !deps.size).map(([k]) => k).sort((a, b) => index.get(a) - index.get(b));
    if (!ready.length) throw new Error(`Registry dependency cycle among ${[...waiting.keys()].join(', ')}`);
    const next = ready[0];
    out.push(next);
    waiting.delete(next);
    for (const deps of waiting.values()) deps.delete(next);
  }
  return out;
}

/** The objects of a kit (or of a channel), with their sheets, in load order. */
export async function objects({ kit = null, channel = null } = {}) {
  const chosen = ENTRIES.filter((e) => (!kit || e.kit === kit) && (!channel || e.channels.includes(channel)));
  const byKey = new Map(chosen.map((e) => [e.key, e]));
  const out = [];
  for (const key of loadOrder(chosen)) {
    const entry = byKey.get(key);
    const sheet = await entry.build();
    const meta = Object.fromEntries(Object.entries(entry).filter(([k]) => k !== 'build'));
    out.push({ ...sheet, ...meta, label: sheet.name });
  }
  return out;
}

/** Sheets of a go-live kit, in load order. */
export async function kitObjects(kit) {
  if (!['configuration', 'migration'].includes(kit)) throw badRequest('kit must be configuration or migration');
  return objects({ kit });
}
