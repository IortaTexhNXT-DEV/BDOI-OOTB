/**
 * Retention of the load evidence (jobs/housekeeping.js dataLoadRetention) and the evidence pack (data-load/evidence-pack.js):
 * the rows and the uploaded workbook of the production run's loads are kept migration.evidence_retention_years after the
 * go-live lock, every other finished load's after the housekeeping days, a load in progress never goes, each purge is
 * audited and the load keeps its file hash; the uploaded workbook is released only with write:data-load and view:pii;
 * the manifest of the evidence pack gives the SHA-256 of each of its files.
 */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { many, one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { objectExists } from '../src/modules/uploads/storage.js';
import { dataLoadRetention, housekeeping } from '../src/jobs/housekeeping.js';
import { validatedBatch } from './helpers.js';
import { binary, businessRows, setLock, startMigrationSuite, unzip, workbook } from './migration.fixtures.js';

let s;
let loader;
let reader;
const loads = {};
const YEAR = 365 * 86400000;

/** Upload a workbook into a run and load it at once (no approval in this suite). */
async function loadInto(runId, n) {
  const wb = workbook(s.kits, { Clients: businessRows(s, n).Clients });
  const up = await validatedBatch(s.admin.api, s.admin.api('post', '/data-load/batches').field('kit', 'migration').field('runId', String(runId)).attach('file', wb, `run${n}.xlsx`));
  const id = up.body.data.batch.id;
  const r = await s.admin.api('post', `/data-load/batches/${id}/load`).send({});
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return id;
}
const state = async (id) => one(`SELECT file_key, file_sha256, (SELECT count(*)::int FROM data_load_rows r WHERE r.batch_id = b.id) AS rows FROM data_load_batches b WHERE id = $1`, [id]);
const setting = async (key, value) => {
  await query('UPDATE app_settings SET value = $2::jsonb WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};
const ago = (ms) => new Date(Date.now() - ms).toISOString();

beforeAll(async () => {
  s = await startMigrationSuite({ approval: false, users: { 'ret.loader': 'dl-loader', 'ret.reader': 'dl-reader' } });
  loader = s.users['ret.loader'];
  reader = s.users['ret.reader'];
  const production = (await s.admin.api('post', '/data-load/runs').send({ kind: 'production', title: 'Production cutover' })).body.data;
  const mock = (await s.admin.api('post', '/data-load/runs').send({ kind: 'mock-2', title: 'Mock 2' })).body.data;
  loads.runId = production.id;
  loads.production = await loadInto(production.id, 1);
  loads.mock = await loadInto(mock.id, 2);
  loads.pending = await loadInto(mock.id, 3);
  await query('UPDATE data_load_batches SET status = \'pending-approval\' WHERE id = $1', [loads.pending]);
  // everything was loaded two years ago
  await query('UPDATE data_load_batches SET created_at = $2, validated_at = $2, loaded_at = $2 WHERE id = ANY($1)', [[loads.production, loads.mock, loads.pending], ago(2 * YEAR)]);
});
afterAll(async () => {
  await pool.end();
});

describe('the uploaded workbook', () => {
  it('is released only to a user with write:data-load and view:pii, each download audited', async () => {
    expect((await reader.api('get', `/data-load/batches/${loads.production}/file`)).status).toBe(403);
    expect((await loader.api('get', `/data-load/batches/${loads.production}/file`)).status).toBe(403);
    const r = await binary(s.admin.api('get', `/data-load/batches/${loads.production}/file`));
    expect(r.status).toBe(200);
    const { file_sha256: sha } = await state(loads.production);
    expect(crypto.createHash('sha256').update(r.body).digest('hex')).toBe(sha);
    expect((await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'data_load_batch\' AND entity_id = $1 AND action = \'download-file\'', [String(loads.production)])).n).toBe(1);
  });
});

describe('the evidence pack', () => {
  it('is a ZIP whose manifest gives the SHA-256 of each of its files, recorded in the audit trail', async () => {
    const r = await binary(reader.api('get', `/data-load/runs/${loads.runId}/evidence-pack`));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/zip');
    expect(crypto.createHash('sha256').update(r.body).digest('hex')).toBe(r.headers['x-content-sha256']);
    const files = unzip(r.body);
    const manifest = files.get('manifest.csv').toString('utf8').trim().split(/\r\n/).slice(1).map((l) => l.split(','));
    expect(manifest.length).toBe(files.size - 1);
    for (const [name, bytes, sha] of manifest) {
      expect(files.has(name), name).toBe(true);
      expect(files.get(name).length, name).toBe(Number(bytes));
      expect(crypto.createHash('sha256').update(files.get(name)).digest('hex'), name).toBe(sha);
    }
    const number = `MIG-${String(loads.production).padStart(6, '0')}`;
    expect([...files.keys()]).toEqual(expect.arrayContaining(['run/Run_Report.xlsx', `loads/${number}/Summary.xlsx`, `loads/${number}/Rows.xlsx`, 'decisions/Go_No_Go.xlsx',
      'go-live/Lock_Requests.xlsx', 'audit/Audit_Extract.xlsx']));
    // the uploaded workbook only for a user with write:data-load and view:pii
    expect([...files.keys()].some((k) => k.startsWith(`loads/${number}/${number}_`))).toBe(false);
    const full = unzip((await binary(s.admin.api('get', `/data-load/runs/${loads.runId}/evidence-pack`))).body);
    expect([...full.keys()].some((k) => k.startsWith(`loads/${number}/${number}_`))).toBe(true);
    const audited = await one('SELECT after_data FROM audit_log WHERE entity = \'migration_run\' AND entity_id = $1 AND action = \'evidence-pack\' ORDER BY id LIMIT 1', [String(loads.runId)]);
    expect(audited.after_data).toMatchObject({ sha256: r.headers['x-content-sha256'], uploadedFiles: false });
  });
});

describe('housekeeping of the load rows and workbooks', () => {
  it('before the go-live lock keeps the production run\'s loads and removes the other finished loads after the days setting', async () => {
    const out = await dataLoadRetention();
    expect(out.data_load_rows).toBeGreaterThan(0);
    expect(out.data_load_files).toBe(1);
    const mock = await state(loads.mock);
    expect(mock).toMatchObject({ file_key: null, rows: 0 });
    expect(mock.file_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await state(loads.production)).toMatchObject({ rows: 1, file_key: expect.any(String) });
    expect(await state(loads.pending)).toMatchObject({ rows: 1, file_key: expect.any(String) });
    const purged = await many('SELECT entity_id, action, after_data FROM audit_log WHERE action IN (\'purge-rows\', \'purge-file\') ORDER BY id');
    expect(purged.map((p) => [p.entity_id, p.action])).toEqual([[String(loads.mock), 'purge-rows'], [String(loads.mock), 'purge-file']]);
    expect(purged[1].after_data).toMatchObject({ fileSha256: mock.file_sha256, evidence: false });
  });

  it('keeps the production run\'s loads the retention years after the lock, then removes them with their files', async () => {
    await setLock(true);
    await setting('golive.locked_at', ago(YEAR));
    await dataLoadRetention();
    const kept = await state(loads.production);
    expect(kept.rows).toBe(1);
    expect(objectExists(kept.file_key)).toBe(true);
    await setting('migration.evidence_retention_years', 0);
    await dataLoadRetention(new Date(Date.now() + 50 * YEAR));
    expect((await state(loads.production)).rows).toBe(1);
    await setting('migration.evidence_retention_years', 10);
    await setting('golive.locked_at', ago(11 * YEAR));
    const out = await dataLoadRetention();
    expect(out).toMatchObject({ data_load_rows: 1, data_load_files: 1 });
    expect(await state(loads.production)).toMatchObject({ rows: 0, file_key: null });
    expect(objectExists(kept.file_key)).toBe(false);
    const audit = await one('SELECT after_data FROM audit_log WHERE action = \'purge-file\' AND entity_id = $1', [String(loads.production)]);
    expect(audit.after_data).toMatchObject({ evidence: true });
    expect(await state(loads.pending)).toMatchObject({ rows: 1 });
  });

  it('the days settings of zero keep the other loads for ever; the daily housekeeping reports the load tables', async () => {
    await setting('housekeeping.data_load_rows_days', 0);
    await setting('housekeeping.data_load_files_days', 0);
    const out = await housekeeping();
    expect(out.kept).toEqual(expect.arrayContaining(['data_load_rows', 'data_load_files']));
    await setting('housekeeping.data_load_rows_days', 365);
    await setting('housekeeping.data_load_files_days', 365);
    expect((await housekeeping()).deleted).toMatchObject({ data_load_rows: 0, data_load_files: 0 });
  });
});
