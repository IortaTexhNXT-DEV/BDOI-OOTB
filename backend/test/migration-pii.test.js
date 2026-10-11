/**
 * Personal data in Data Migration & Go-Live: every download and review that carries record values is masked for a
 * user without view:pii and full for a holder (with the X-Unmask-PII header when identifiers are shown on request,
 * audited); every GET route of the workspace is listed here as masked (and tested) or as carrying no personal
 * identifier, with the reason; the uploaded workbook is released only with write:data-load and view:pii; identifiers
 * of the load rows are encrypted at rest.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { one, pool, query } from '../src/db/pool.js';
import { ROUTES } from '../src/lib/registry.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { loginAs, validatedBatch } from './helpers.js';
import { binary, businessRows, startMigrationSuite, textOf, workbook } from './migration.fixtures.js';

const TIN = '123-456-101-000';
const EMAIL = 'pii.compare@example.ph';

let s;
let reader;
let viewer;
let loader;
let runId;
let loaded;
let duplicate;
let comparison;

/** Masked routes: how each is fetched (path with the ids of this suite) and the identifier it carries. */
const MASKED = {
  '/data-load/kits/:kit/template': () => ({ path: '/data-load/kits/migration/template?prefill=true', value: TIN }),
  '/data-load/batches/:id/rows': () => ({ path: `/data-load/batches/${duplicate}/rows`, value: TIN }),
  '/data-load/batches/:id/duplicates': () => ({ path: `/data-load/batches/${duplicate}/duplicates`, value: TIN }),
  '/data-load/batches/:id/errors': () => ({ path: `/data-load/batches/${duplicate}/errors`, value: TIN }),
  '/data-load/runs/:id/evidence-pack': () => ({ path: `/data-load/runs/${runId}/evidence-pack`, value: TIN }),
  '/data-load/compare/:id/rows': () => ({ path: `/data-load/compare/${comparison}/rows?status=only-in-file`, value: EMAIL }),
  '/data-load/compare/:id/workbook': () => ({ path: `/data-load/compare/${comparison}/workbook`, value: EMAIL }),
};
/** GET routes that carry no personal identifier, or are released otherwise, with the reason. */
const NO_PII = {
  '/data-load/kits': 'kit definitions and settings',
  '/data-load/value-maps': 'legacy code tables (codes and names of masters)',
  '/data-load/value-maps/workbook': 'legacy code tables (codes and names of masters)',
  '/data-load/value-maps/:id': 'legacy code tables (codes and names of masters)',
  '/data-load/document-names/check/:token/workbook': 'file names of documents, only for the user who ran the check',
  '/data-load/compare': 'comparison counts per sheet',
  '/data-load/compare/:id': 'comparison counts and environment-specific settings',
  '/data-load/batches': 'load history: counts, users, timings',
  '/data-load/batches/:id': 'load record and error messages (no cell values)',
  '/data-load/batches/:id/file': 'released only with write:data-load and view:pii (tested below)',
  '/data-load/batches/:id/reconciliation': 'counts and totals per sheet',
  '/data-load/batches/:id/dependents': 'record numbers and counts of what stops an undo',
  '/data-load/batches/:id/dependents/workbook': 'record numbers and counts of what stops an undo',
  '/data-load/golive': 'cutover date, lock and settings',
  '/data-load/golive/lock-requests': 'lock and unlock requests',
  '/data-load/golive/sap-opening-file': 'opening balance journal by account',
  '/data-load/golive/sap-opening-file/files/:kind': 'GL lines by account',
  '/data-load/reconciliations': 'counts, amounts, codes and numbers',
  '/data-load/reconciliations/:id': 'counts, amounts, codes and numbers',
  '/data-load/reconciliations/:id/tieouts': 'GL accounts and amounts',
  '/data-load/reconciliations/:id/report': 'counts, amounts, codes and numbers; the signed PDF is masked for everyone',
  '/data-load/overview': 'counts and statuses',
  '/data-load/hypercare': 'counts and amounts',
  '/data-load/runs': 'run records',
  '/data-load/runs/:id': 'run record, timings and counts',
  '/data-load/runs/:id/report': 'timings, load counts, results and defects',
  '/data-load/runs/:id/steps': 'checklist',
  '/data-load/runs/:id/defects': 'defect records',
  '/data-load/runbook': 'runbook template',
  '/data-load/evidence': 'evidence file names and hashes',
  '/data-load/evidence/:id': 'an evidence file as attached by the cutover team (cutover log, minutes), read:data-load',
  '/data-load/criteria': 'criteria template',
  '/data-load/decisions': 'decisions, criteria and votes',
  '/data-load/decisions/:id': 'decision, criteria and votes',
  '/data-load/users': 'names and roles of the users of the workspace',
};

const fetchText = async (who, path, headers = {}) => {
  let r = who.api('get', path);
  for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
  const res = await binary(r);
  expect(res.status, `${path} ${res.body?.toString?.().slice(0, 200)}`).toBe(200);
  return textOf(res.body);
};

beforeAll(async () => {
  s = await startMigrationSuite({ approval: false, users: { 'pii.reader': 'dl-reader', 'pii.loader': 'dl-loader' } });
  ({ 'pii.reader': reader, 'pii.loader': loader } = s.users);
  const role = await s.admin.api('post', '/roles').send({ code: 'dl-viewer', name: 'dl-viewer', permissions: ['read:profile', 'read:notifications', 'read:data-load', 'view:pii'] });
  expect(role.status).toBe(201);
  expect((await s.admin.api('post', '/users').send({ username: 'pii.viewer', password: 'Welcome@123', displayName: 'pii.viewer', email: 'pii.viewer@example.ph', roles: ['dl-viewer'],
    mustChangePassword: false })).status).toBe(201);
  const token = await loginAs(s.app, 'pii.viewer', 'Welcome@123');
  viewer = { api: (m, p) => request(s.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };

  runId = (await s.admin.api('post', '/data-load/runs').send({ kind: 'mock-1', title: 'Mock 1' })).body.data.id;
  const upload = (wb) => validatedBatch(s.admin.api, s.admin.api('post', '/data-load/batches').field('kit', 'migration').field('runId', String(runId)).attach('file', wb, 'pii.xlsx'));
  const first = await upload(workbook(s.kits, { Clients: businessRows(s, 1).Clients }));
  loaded = first.body.data.batch.id;
  expect((await s.admin.api('post', `/data-load/batches/${loaded}/load`).send({})).status).toBe(200);
  // the same TIN under another client code: a duplicate of the client just loaded
  const again = await upload(workbook(s.kits, { Clients: [{ ...businessRows(s, 1).Clients[0], 'Client Code': 'MJ1-OTHER', 'Last Name': 'Other' }] }));
  duplicate = again.body.data.batch.id;
  expect(again.body.data.batch.rowsDuplicate).toBe(1);

  const config = workbook(s.kits, { Users: [{ Username: 'pii.compare', 'Display Name': 'Compare User', Email: EMAIL, Roles: 'sales', Status: 'active' }] }, 'configuration');
  const c = await s.admin.api('post', '/data-load/compare').attach('file', config, 'Other.xlsx');
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  comparison = c.body.data.id;
});
afterAll(async () => {
  await pool.end();
});

describe('route inventory', () => {
  it('every GET route of the workspace is masked and tested here, or carries no personal identifier', () => {
    const gets = ROUTES.filter((r) => r.method === 'GET' && r.path.startsWith('/data-load')).map((r) => r.path);
    expect(gets.filter((p) => !MASKED[p] && !NO_PII[p])).toEqual([]);
    for (const p of [...Object.keys(MASKED), ...Object.keys(NO_PII)]) expect(gets, p).toContain(p);
  });
});

describe('masking', () => {
  for (const route of Object.keys(MASKED)) {
    it(`${route}: masked without view:pii, full with it`, async () => {
      const { path, value } = MASKED[route]();
      const masked = await fetchText(reader, path);
      expect(masked).not.toContain(value);
      expect(masked).toMatch(/\*{2,}/);
      expect(await fetchText(viewer, path)).toContain(value);
    });
  }

  it('when identifiers are shown on request, a holder gets them only with the header, audited', async () => {
    await query('UPDATE app_settings SET value = \'"on-request"\' WHERE key = \'privacy.pii_reveal_mode\'');
    clearSettingsCache();
    try {
      const path = `/data-load/runs/${runId}/evidence-pack`;
      expect(await fetchText(viewer, path)).not.toContain(TIN);
      expect(await fetchText(viewer, path, { 'X-Unmask-PII': '1' })).toContain(TIN);
      const audited = await one(`SELECT count(*)::int AS n FROM audit_log WHERE entity = 'personal_data' AND action = 'unmask' AND entity_id = $1`, [`/api${path}`]);
      expect(audited.n).toBeGreaterThan(0);
    } finally {
      await query('UPDATE app_settings SET value = \'"always"\' WHERE key = \'privacy.pii_reveal_mode\'');
      clearSettingsCache();
    }
  });

  it('the uploaded workbook needs write:data-load and view:pii; never the read-only or the loader without view:pii', async () => {
    expect((await reader.api('get', `/data-load/batches/${loaded}/file`)).status).toBe(403);
    expect((await viewer.api('get', `/data-load/batches/${loaded}/file`)).status).toBe(403);
    expect((await loader.api('get', `/data-load/batches/${loaded}/file`)).status).toBe(403);
    const full = await binary(s.admin.api('get', `/data-load/batches/${loaded}/file`));
    expect(full.status).toBe(200);
    expect(textOf(full.body)).toContain(TIN);
  });

  it('identifiers of the load rows are encrypted at rest', async () => {
    const row = await one('SELECT data->>\'tin\' AS tin FROM data_load_rows WHERE batch_id = $1 AND sheet = \'clients\'', [loaded]);
    expect(row.tin).toMatch(/^pii:1:/);
  });
});

describe('the audit trail of migrated records', () => {
  it('is masked for the read-only auditor: the record images and the business events of a migrated client', async () => {
    expect((await s.admin.api('post', '/users').send({ username: 'pii.auditor', password: 'Welcome@123', displayName: 'pii.auditor', email: 'pii.auditor@example.ph',
      roles: ['tis-auditor'], mustChangePassword: false })).status).toBe(201);
    const token = await loginAs(s.app, 'pii.auditor', 'Welcome@123');
    const auditor = (m, p) => request(s.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
    const client = await one('SELECT id FROM clients WHERE client_code = \'MJ1-C\'');
    const raw = await auditor('get', `/settings/audit?entity=client&entityId=${client.id}`);
    expect(raw.status).toBe(200);
    const text = JSON.stringify(raw.body);
    expect(raw.body.data.some((e) => e.action === 'migrate-create')).toBe(true);
    expect(text).not.toContain(TIN);
    expect(text).not.toContain('rosa1@example.ph');
    const events = await auditor('get', `/settings/audit/events?entity=client&entityRef=${client.id}`);
    expect(events.status).toBe(200);
    expect(JSON.stringify(events.body)).not.toContain('rosa1@example.ph');
    const history = await auditor('get', `/audit/records/client/${client.id}`);
    expect(history.status).toBe(200);
    expect(JSON.stringify(history.body)).not.toContain('rosa1@example.ph');
    // the administrator, who holds view:pii, reads them in full
    expect(JSON.stringify((await s.admin.api('get', `/settings/audit?entity=client&entityId=${client.id}`)).body)).toContain('rosa1@example.ph');
    // and the auditor reads the records it reconciles, masked
    const clients = await auditor('get', '/clients?origin=migrated');
    expect(clients.status).toBe(200);
    expect(JSON.stringify(clients.body)).not.toContain(TIN);
  });
});
