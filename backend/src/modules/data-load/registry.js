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
 *   duplicateRules  duplicate checks that apply to it (duplicates.js; setting migration.duplicate_rules)
 *   productLines    policy sheets: the lines of business of the products it holds (products.js)
 *   present         when given: whether the object is in this environment's workbook (the Fire sheet only with an
 *                   active fire product)
 * Objects of the same kit with no dependency between them keep the order they are declared in below. The single
 * Policies sheet of the earlier layout stays readable (legacyLayout): it is never in a downloaded template.
 */
import { badRequest } from '../../lib/errors.js';
import { CONFIGURATION_SHEETS, masterSheet } from './configuration.js';
import { MIGRATION_SHEETS } from './migration.js';
import { POLICY_KINDS, presentKinds } from './products.js';

const CONFIGURATION_CHANNELS = ['setup', 'upload', 'promotion'];
const MIGRATION_CHANNELS = ['migration'];

const master = (code, dependsOn = []) => ({ key: `master:${code}`, module: 'masters', dependsOn, duplicateRules: ['master-name'], build: () => masterSheet(code) });
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
  // the releases this environment runs: compared, never loaded
  own('features', 'features'),
].map((e) => ({ ...e, kit: 'configuration', channels: CONFIGURATION_CHANNELS, promotable: true }));

const migrated = (key, module, dependsOn, origin, duplicateRules = [], extra = {}) => ({
  key, module, dependsOn, origin, duplicateRules, kit: 'migration', channels: MIGRATION_CHANNELS, promotable: false, build: async () => MIGRATION_SHEETS[key](), ...extra,
});

const POLICY_ORIGIN = { table: 'policies', legacyNumberColumn: 'policy_number' };
const POLICY_DEPENDS = ['clients', 'master:insurance-company', 'master:product', 'users', 'master:branch'];
const POLICY_RULES = { motor: ['vehicle'], ctpl: ['vehicle', 'coc'] };
const POLICY_KEYS = [...POLICY_KINDS.map((k) => k.key), 'policies'];

/** Migration kit: the open business of the legacy system at cutover. */
const MIGRATION = [
  migrated('clients', 'clients', ['master:branch', 'users'], { table: 'clients', legacyNumberColumn: 'client_code' }, ['tin', 'name-birth-date', 'company-name']),
  ...POLICY_KINDS.map((k) => migrated(k.key, 'policies', POLICY_DEPENDS, POLICY_ORIGIN, [...(POLICY_RULES[k.kind] || []), 'policy-number', 'insurer-variant'],
    { productLines: k.lines, ...(k.activeOnly ? { present: async () => (await presentKinds()).includes(k.kind) } : {}) })),
  migrated('policies', 'policies', POLICY_DEPENDS, POLICY_ORIGIN, ['policy-number', 'insurer-variant'], { productLines: [], legacyLayout: true }),
  migrated('open-items', 'receipts', POLICY_KEYS, { table: 'receivables', legacyNumberColumn: 'reference' }),
  migrated('post-dated-cheques', 'pdc', ['open-items', 'master:bank'], { table: 'post_dated_cheques', legacyNumberColumn: 'cheque_number' }),
  migrated('claims', 'claims', [...POLICY_KEYS, 'users'], { table: 'claims', legacyNumberColumn: 'claim_number' }),
  migrated('opening-balances', 'period-end', ['chart-of-accounts'], { table: 'opening_balances', legacyNumberColumn: null }),
  // never loaded: the legacy figures of the reconciliation
  migrated('control-totals', 'data-load', [], null),
];

const ENTRIES = [...CONFIGURATION, ...MIGRATION];

const FUNCTIONS = new Set(['build', 'present']);
/** Registry entries without their sheets (key, module, dependsOn, kit, channels, promotable, origin, duplicateRules ...). */
export const registryEntries = () => ENTRIES.map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !FUNCTIONS.has(k))));

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

/**
 * The objects of a kit (or of a channel), with their sheets, in load order; objects not present here are left out, and
 * so are they from the dependsOn of the others (no sheet names a sheet this workbook does not have).
 */
export async function objects({ kit = null, channel = null } = {}) {
  const chosen = [];
  const absent = new Set();
  for (const e of ENTRIES) {
    if ((kit && e.kit !== kit) || (channel && !e.channels.includes(channel))) continue;
    if (e.present && !(await e.present())) { absent.add(e.key); continue; }
    chosen.push(e);
  }
  if (absent.size) chosen.splice(0, chosen.length, ...chosen.map((e) => ({ ...e, dependsOn: e.dependsOn.filter((d) => !absent.has(d)) })));
  const byKey = new Map(chosen.map((e) => [e.key, e]));
  const out = [];
  for (const key of loadOrder(chosen)) {
    const entry = byKey.get(key);
    const sheet = await entry.build();
    const meta = Object.fromEntries(Object.entries(entry).filter(([k]) => !FUNCTIONS.has(k)));
    out.push({ ...sheet, ...meta, label: sheet.name });
  }
  return out;
}

/** Sheets of a go-live kit, in load order. */
export async function kitObjects(kit) {
  if (!['configuration', 'migration'].includes(kit)) throw badRequest('kit must be configuration or migration');
  return objects({ kit });
}
