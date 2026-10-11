/**
 * Registry of the loadable objects (data-load/registry.js): the go-live kits are built from it. The configuration
 * workbook is the same as before the registry (sheets, columns, order), the migration kit follows the documented load
 * order, migration objects are never promotable, and the load order is a topological sort on dependsOn.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/pool.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { kitObjects, loadOrder, objects, registryEntries } from '../src/modules/data-load/registry.js';
import { enableFeatures } from './helpers.js';

/** The configuration kit as it was built by hand before the registry: sheet keys in load order. */
const CONFIGURATION_ORDER = ['master:company', 'settings', 'master:country', 'master:region', 'master:state', 'master:city', 'master:barangay', 'master:branch',
  'master:department', 'master:hierarchy', 'master:designation', 'users', 'master:currency', 'master:exchange-rate', 'chart-of-accounts', 'master:bank',
  'master:bank-account', 'master:signatory', 'master:transaction-code', 'master:write-off-reason', 'master:insurance-company', 'master:line-of-business',
  'master:product', 'master:policy-type', 'master:cover', 'master:vehicle-brand', 'master:vehicle-model', 'master:vehicle-variant', 'master:vehicle',
  'master:supplier', 'master:asset-class', 'master:short-period-rate', 'master:cancellation-reason', 'master:claim-document-requirement', 'master:repair-shop',
  'master:lead-source', 'master:reason-code', 'commission-rates', 'premium-charges', 'lgu-rates', 'authority-limits', 'numbering', 'payee-bank-accounts', 'coc-series', 'features'];
/**
 * Migration kit (specification 5.2): clients, the policy sheets per product (Fire only with an active fire product), the
 * single Policies sheet of the earlier layout (read, never downloaded), open items, post-dated cheques, open claims,
 * opening balances and the control totals.
 */
const MIGRATION_ORDER = ['clients', 'policies-motor', 'policies-ctpl', 'policies-pa', 'policies-credit-life', 'policies-travel', 'policies-other', 'policies',
  'open-items', 'post-dated-cheques', 'claims', 'opening-balances', 'control-totals'];
const MIGRATION_NAMES = ['Clients', 'Policies - Motor', 'Policies - CTPL', 'Policies - Personal Accident', 'Policies - Credit Life', 'Policies - Travel',
  'Policies - Other Lines', 'Policies', 'Open Items', 'Post-Dated Cheques', 'Open Claims', 'Opening Balances', 'Control Totals'];

let api;
const bin = (req) => req.buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  const app = await createApp();
  await enableFeatures(app, ['legacy-migration']);
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
});
afterAll(async () => {
  await pool.end();
});

describe('object registry', () => {
  it('builds the configuration kit in the order and with the sheets it had: 45 objects', async () => {
    const sheets = await kitObjects('configuration');
    expect(sheets.map((s) => s.key)).toEqual(CONFIGURATION_ORDER);
    for (const s of sheets) {
      expect(s).toMatchObject({ kit: 'configuration', channels: ['setup', 'upload', 'promotion'], promotable: true, label: s.name });
      expect(typeof s.importRow).toBe('function');
    }
  });

  it('the configuration workbook downloaded from the registry has the same sheets, columns and order', async () => {
    const sheets = await kitObjects('configuration');
    const t = await bin(api('get', '/data-load/kits/configuration/template'));
    expect(t.status).toBe(200);
    const book = readWorkbook(t.body);
    expect(book.map((s) => s.name)).toEqual(['Instructions', 'Lists', ...sheets.map((s) => s.name), 'Control']);
    for (const s of sheets) {
      const ws = book.find((x) => x.name === s.name);
      expect(ws.rows[0].map((h) => String(h).replace(/ \*$/, '')), s.name).toEqual(s.columns.map((c) => c.header));
    }
  });

  it('builds the migration kit in the documented load order, as migration-only objects that are never promoted', async () => {
    const sheets = await kitObjects('migration');
    expect(sheets.map((s) => s.key)).toEqual(MIGRATION_ORDER);
    expect(sheets.map((s) => s.name)).toEqual(MIGRATION_NAMES);
    for (const s of sheets) expect(s).toMatchObject({ kit: 'migration', channels: ['migration'], promotable: false });
    expect(sheets.map((s) => s.origin?.table ?? null)).toEqual(['clients', ...Array(7).fill('policies'), 'receivables', 'post_dated_cheques', 'claims', 'opening_balances', null]);
    expect((await objects({ channel: 'promotion' })).some((s) => s.kit === 'migration')).toBe(false);
    const kits = (await api('get', '/data-load/kits')).body.data.kits;
    expect(kits.find((k) => k.kit === 'migration').sheets.map((s) => s.key)).toEqual(MIGRATION_ORDER);
  });

  it('carries the Fire sheet only while an active product of line fire exists; a fire policy goes on Other Lines otherwise', async () => {
    expect((await kitObjects('migration')).some((s) => s.key === 'policies-fire')).toBe(false);
    // and no sheet names it among the sheets it depends on
    for (const sheet of await kitObjects('migration')) expect(sheet.dependsOn, sheet.key).not.toContain('policies-fire');
    const other = (await api('get', '/data-load/kits')).body.data.kits.find((k) => k.kit === 'migration').sheets.find((s) => s.key === 'policies-other');
    expect(other.products).toEqual(['PARCEL']);
    await query("UPDATE products SET status = 'active' WHERE code = 'FIRE'");
    try {
      const sheets = await kitObjects('migration');
      expect(sheets.map((s) => s.key)).toContain('policies-fire');
      expect(sheets.find((s) => s.key === 'policies-fire')).toMatchObject({ name: 'Policies - Fire', productLines: ['fire'], policyKind: 'fire' });
      expect(sheets.find((s) => s.key === 'open-items').dependsOn).toContain('policies-fire');
      const kits = (await api('get', '/data-load/kits')).body.data.kits.find((k) => k.kit === 'migration').sheets;
      expect(kits.find((s) => s.key === 'policies-fire').products).toEqual(['FIRE']);
      expect(kits.find((s) => s.key === 'policies-fire').columns.map((c) => c.header)).toEqual(expect.arrayContaining(['Risk Address', 'Occupancy', 'Construction Class']));
    } finally {
      await query("UPDATE products SET status = 'inactive' WHERE code = 'FIRE'");
    }
  });

  it('every object has one entry, and every dependency names an object of the registry', () => {
    const entries = registryEntries();
    const keys = entries.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of entries) {
      for (const d of e.dependsOn) expect(keys, `${e.key} depends on ${d}`).toContain(d);
      expect(e.build).toBeUndefined();
    }
  });

  it('loads an object after the objects it depends on, keeps the declared order otherwise and refuses a cycle', () => {
    const e = (key, dependsOn = []) => ({ key, dependsOn });
    expect(loadOrder([e('policies', ['clients', 'branch']), e('notes'), e('clients')])).toEqual(['notes', 'clients', 'policies']);
    expect(loadOrder([e('a'), e('b'), e('c')])).toEqual(['a', 'b', 'c']);
    expect(() => loadOrder([e('a', ['b']), e('b', ['a'])])).toThrow(/cycle/);
  });

  it('refuses an unknown kit', async () => {
    await expect(kitObjects('master')).rejects.toThrow(/kit must be/);
    const r = await api('get', '/data-load/kits/master/template');
    expect(r.status).toBe(400);
  });
});
