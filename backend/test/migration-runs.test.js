/**
 * Mock runs and the cutover checklist (migration 0444, seeds/92_go_live_workspace.sql, data-load/runs.js, cutover.js,
 * evidence.js): a run copies the runbook into its checklist; a step starts once its dependencies are done or skipped and
 * is done with evidence where the runbook asks for it; defects, timings and the run report; evidence files are served
 * only by the workspace; loads belong to an open run; read-only users change nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { one, pool, query } from '../src/db/pool.js';
import { seedFiles } from '../src/db/seed.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { validatedBatch } from './helpers.js';
import { startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_0444 = path.join(here, '../src/db/migrations/0444_migration_runs_cutover.sql');
const SEED_92 = path.join(here, '../src/db/seeds/92_go_live_workspace.sql');
const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');

let s;
let lead;
let other;
let reader;
let run;

const steps = async (who = lead) => (await who.api('get', `/data-load/runs/${run.id}/steps`)).body.data;
const stepOf = async (code) => (await steps()).steps.find((x) => x.code === code);
const act = (code, action, body = {}, who = lead) => stepOf(code).then((st) => who.api('post', `/data-load/runs/${run.id}/steps/${st.id}/${action}`).send(body));
const attach = (ownerType, ownerId, who = lead, name = 'evidence.pdf') => who.api('post', '/data-load/evidence').field('ownerType', ownerType).field('ownerId', String(ownerId))
  .field('note', 'Cutover log').attach('file', PDF, name);

beforeAll(async () => {
  s = await startMigrationSuite({ users: { 'rn.lead': 'dl-loader', 'rn.other': 'dl-loader', 'rn.reader': 'dl-reader' } });
  lead = s.users['rn.lead'];
  other = s.users['rn.other'];
  reader = s.users['rn.reader'];
});
afterAll(async () => {
  await pool.end();
});

describe('migration 0444 and the reference seed 92', () => {
  it('seed 92 is the only reference 92_ file and runs before the sample incentive seed', () => {
    const names = seedFiles({ sample: true }).map((f) => f.name);
    expect(names).toContain('92_go_live_workspace.sql');
    expect(names.indexOf('92_go_live_workspace.sql')).toBeLessThan(names.indexOf('sample/92_incentive.sql'));
  });

  it('both run twice without change and keep the administrator\'s changes to the templates', async () => {
    await query('UPDATE go_live_runbook_steps SET duration_minutes = 45 WHERE code = \'CO-3\'');
    const count = async () => (await one(`SELECT (SELECT count(*) FROM go_live_runbook_steps)::int AS steps, (SELECT count(*) FROM go_live_criteria)::int AS criteria,
      (SELECT count(*) FROM go_live_criteria WHERE NOT waivable)::int AS fixed`));
    const before = await count();
    for (let i = 0; i < 2; i += 1) {
      await query(fs.readFileSync(MIGRATION_0444, 'utf8'));
      await query(fs.readFileSync(SEED_92, 'utf8'));
    }
    expect(await count()).toEqual(before);
    expect(before).toEqual({ steps: 21, criteria: 11, fixed: 4 });
    expect((await one('SELECT duration_minutes FROM go_live_runbook_steps WHERE code = \'CO-3\'')).duration_minutes).toBe(45);
    expect((await query("SELECT code FROM go_live_criteria WHERE NOT waivable ORDER BY code")).rows.map((r) => r.code)).toEqual(['G2', 'G3', 'G4', 'G5']);
    const fks = (await query(`SELECT conname FROM pg_constraint WHERE conname IN ('data_load_batches_run_fkey', 'migration_reconciliations_run_fkey', 'go_live_lock_requests_decision_fkey')`)).rows;
    expect(fks).toHaveLength(3);
    await query('UPDATE go_live_runbook_steps SET duration_minutes = 30 WHERE code = \'CO-3\'');
  });
});

describe('runs', () => {
  it('creating a run copies the runbook into its checklist; one production run at a time; a production extract needs the DPO approval', async () => {
    const bad = await lead.api('post', '/data-load/runs').send({ kind: 'production', title: 'Production cutover', personalData: 'production-extract' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((d) => d.path)).toContain('dpoApprovalRef');
    const r = await lead.api('post', '/data-load/runs').send({ kind: 'production', title: 'Production cutover', personalData: 'production-extract', dpoApprovalRef: 'DPO-2026-014',
      exitCriteria: 'Reconciliation signed; Go decision' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    run = r.body.data;
    expect(run).toMatchObject({ kind: 'production', status: 'planned', cutoverDate: s.cutover, environment: expect.any(String) });
    expect(run.runNumber).toMatch(/^RUN-\d{6}$/);
    const list = await steps();
    expect(list.steps.map((x) => x.code)).toEqual(['PC-1', 'PC-2', 'PC-3', 'PC-4', 'PC-5', 'PC-6', 'PC-7', 'PC-8', 'CO-1', 'CO-2', 'CO-3', 'CO-4', 'CO-5', 'CO-6', 'CO-7', 'CO-8',
      'CO-9', 'CO-10', 'GL-1', 'HC-1', 'HC-2']);
    expect(list.steps.find((x) => x.code === 'CO-2')).toMatchObject({ dependsOn: ['CO-1'], waitingFor: ['CO-1'], evidenceRequired: true, status: 'not-started' });
    expect(list.progress).toMatchObject({ done: 0, total: 21, next: { code: 'PC-1' } });
    const second = await lead.api('post', '/data-load/runs').send({ kind: 'production', title: 'Second production' });
    expect(second.status).toBe(409);
    const audit = await one('SELECT action FROM audit_log WHERE entity = \'migration_run\' AND entity_id = $1', [String(run.id)]);
    expect(audit.action).toBe('create');
  });

  it('a read-only user sees runs and changes nothing', async () => {
    expect((await reader.api('get', '/data-load/runs')).status).toBe(200);
    expect((await reader.api('get', `/data-load/runs/${run.id}`)).status).toBe(200);
    expect((await reader.api('post', '/data-load/runs').send({ kind: 'mock-1', title: 'x' })).status).toBe(403);
    expect((await reader.api('post', `/data-load/runs/${run.id}/start`)).status).toBe(403);
    expect((await act('PC-1', 'skip', { note: 'x' }, reader)).status).toBe(403);
  });

  it('a load is uploaded to an open run; a run is cancelled with a reason; a cancelled or unknown run takes no load', async () => {
    const mock = (await lead.api('post', '/data-load/runs').send({ kind: 'mock-1', title: 'Mock 1' })).body.data;
    const wb = workbook(s.kits, { Clients: [{ 'Client Code': 'RN-C-1', 'Client Type': 'corporate', 'Company Name': 'Run Corp.' }] });
    expect((await uploadAs(lead.api, wb)).body.data.batch.runId).toBeNull();
    const inRun = await validatedBatch(lead.api, lead.api('post', '/data-load/batches').field('kit', 'migration').field('runId', String(mock.id)).attach('file', wb, 'm.xlsx'));
    expect(inRun.status).toBe(202);
    expect(inRun.body.data.batch.runId).toBe(mock.id);
    expect((await lead.api('get', '/data-load/batches').query({ runId: mock.id })).body.data.map((b) => b.id)).toEqual([inRun.body.data.batch.id]);
    expect((await lead.api('post', `/data-load/runs/${mock.id}/cancel`).send({})).status).toBe(400);
    const cancelled = await lead.api('post', `/data-load/runs/${mock.id}/cancel`).send({ reason: 'Replaced by Mock 2' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled', summary: 'Replaced by Mock 2' });
    expect((await lead.api('post', '/data-load/batches').field('kit', 'migration').field('runId', String(mock.id)).attach('file', wb, 'm.xlsx')).status).toBe(409);
    expect((await lead.api('post', '/data-load/batches').field('kit', 'migration').field('runId', '999999').attach('file', wb, 'm.xlsx')).status).toBe(404);
  });
});

describe('cutover checklist', () => {
  it('a step starts only in a running run and once the steps it depends on are done or skipped', async () => {
    const early = await act('PC-1', 'start');
    expect(early.status).toBe(409);
    expect(early.body.message).toMatch(/Start run RUN-/);
    expect((await lead.api('post', `/data-load/runs/${run.id}/start`)).status).toBe(200);
    const blocked = await act('CO-1', 'start');
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/waits for PC-3, PC-4, PC-6, PC-7, PC-8/);
    expect((await act('PC-1', 'skip', {})).status).toBe(400);
    for (const code of ['PC-1', 'PC-2', 'PC-3', 'PC-4', 'PC-5', 'PC-6', 'PC-7', 'PC-8']) {
      expect((await act(code, 'skip', { note: 'Rehearsed in the dress rehearsal' })).status, code).toBe(200);
    }
    const started = await act('CO-1', 'start');
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ status: 'in-progress', actualStart: expect.any(String) });
    expect((await act('CO-1', 'start')).status).toBe(409);
  });

  it('done needs the evidence the runbook asks for, or a note saying why there is none', async () => {
    const missing = await act('CO-1', 'done');
    expect(missing.status).toBe(400);
    expect(missing.body.errors[0].message).toMatch(/Freeze notice/);
    const co1 = await stepOf('CO-1');
    const file = await attach('step', co1.id);
    expect(file.status, JSON.stringify(file.body)).toBe(201);
    expect(file.body.data.sha256).toMatch(/^[0-9a-f]{64}$/);
    const done = await act('CO-1', 'done');
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ status: 'done', evidenceCount: 1, actualEnd: expect.any(String) });
    expect((await act('CO-2', 'start')).status).toBe(200);
    const withNote = await act('CO-2', 'done', { note: 'Control figures signed on paper, kept by the Finance Head' });
    expect(withNote.status).toBe(200);
    expect(withNote.body.data.notes).toMatch(/signed on paper/);
  });

  it('CO-3 records the restore point of the run', async () => {
    expect((await act('CO-3', 'start')).status).toBe(200);
    await attach('step', (await stepOf('CO-3')).id);
    const none = await act('CO-3', 'done');
    expect(none.status).toBe(400);
    expect(none.body.errors[0].path).toBe('restorePoint');
    const at = new Date(Date.now() - 3600000).toISOString();
    expect((await act('CO-3', 'done', { restorePoint: at })).status).toBe(200);
    expect(new Date((await one('SELECT restore_point FROM migration_runs WHERE id = $1', [run.id])).restore_point).toISOString()).toBe(at);
  });

  it('block and skip need a note; every step change is audited', async () => {
    expect((await act('CO-4', 'block', {})).status).toBe(400);
    expect((await act('CO-4', 'block', { note: 'Value maps of the insurers missing' })).status).toBe(200);
    expect((await act('CO-4', 'start')).status).toBe(200);
    const edit = await stepOf('CO-4');
    const up = await lead.api('put', `/data-load/runs/${run.id}/steps/${edit.id}`).send({ ownerUserId: other.id, plannedStart: '2026-10-31T00:00:00Z', plannedEnd: '2026-10-30T00:00:00Z' });
    expect(up.status).toBe(400);
    const ok = await lead.api('put', `/data-load/runs/${run.id}/steps/${edit.id}`).send({ ownerUserId: other.id, plannedEnd: new Date(Date.now() - 60000).toISOString() });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ ownerUserId: other.id, ownerName: 'rn.other', late: true });
    const actions = (await query(`SELECT action FROM audit_log WHERE entity = 'migration_run_step' AND entity_id = $1 ORDER BY id`, [String(edit.id)])).rows.map((r) => r.action);
    expect(actions).toEqual(['block', 'start', 'update']);
    const list = await steps();
    expect(list.progress).toMatchObject({ done: 11, total: 21, late: ['CO-4'] });
  });
});

describe('defects, evidence and the report', () => {
  it('defects belong to the loads and steps of their run; closing records when', async () => {
    const other = await one('INSERT INTO data_load_batches(kit, status) VALUES (\'migration\', \'failed\') RETURNING id');
    const co4 = await stepOf('CO-4');
    expect((await lead.api('post', `/data-load/runs/${run.id}/defects`).send({ title: 'Wrong', severity: 7 })).status).toBe(400);
    expect((await lead.api('post', `/data-load/runs/${run.id}/defects`).send({ title: 'Wrong', severity: 2, batchId: other.id })).status).toBe(400);
    const d = await lead.api('post', `/data-load/runs/${run.id}/defects`).send({ title: 'Plate number with a trailing space refused', object: 'Policies - Motor', severity: 2, stepId: co4.id });
    expect(d.status).toBe(201);
    expect(d.body.data).toMatchObject({ defectNumber: expect.stringMatching(/^DEF-\d{6}$/), status: 'open', stepCode: 'CO-4', closedAt: null });
    const closed = await lead.api('put', `/data-load/runs/${run.id}/defects/${d.body.data.id}`).send({ status: 'closed', resolution: 'Trimmed in the extract' });
    expect(closed.status).toBe(200);
    expect(closed.body.data.closedAt).not.toBeNull();
    const reopened = await lead.api('put', `/data-load/runs/${run.id}/defects/${d.body.data.id}`).send({ status: 'retest' });
    expect(reopened.body.data.closedAt).toBeNull();
    expect((await lead.api('get', `/data-load/runs/${run.id}`)).body.data).toMatchObject({ defectsOpen: 1, defectsTotal: 1 });
  });

  it('evidence files are served only by the workspace, each download audited; only the uploader removes one while the run is open', async () => {
    const e = (await attach('run', run.id, other, 'restore.pdf')).body.data;
    const key = (await one('SELECT file_key FROM migration_evidence WHERE id = $1', [e.id])).file_key;
    const direct = await request(s.app).get(`/api/s3/object/${key}`).set('Authorization', `Bearer ${(await request(s.app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD })).body.accessToken}`);
    expect(direct.status).toBe(403);
    const dl = await reader.api('get', `/data-load/evidence/${e.id}`);
    expect(dl.status).toBe(200);
    expect(dl.headers['x-content-sha256']).toBe(e.sha256);
    expect((await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'migration_evidence\' AND entity_id = $1 AND action = \'download\'', [String(e.id)])).n).toBe(1);
    const listed = await reader.api('get', '/data-load/evidence').query({ runId: run.id });
    expect(listed.body.data.length).toBeGreaterThanOrEqual(3);
    expect((await lead.api('delete', `/data-load/evidence/${e.id}`)).status).toBe(403);
    expect((await attach('defect', 999999)).status).toBe(404);
    expect((await attach('nothing', 1)).status).toBe(400);
    expect((await other.api('delete', `/data-load/evidence/${e.id}`)).status).toBe(200);
  });

  it('the run carries its timings and its report as XLSX and PDF', async () => {
    const detail = (await lead.api('get', `/data-load/runs/${run.id}`)).body.data;
    expect(detail.steps.find((x) => x.code === 'CO-1').elapsedMs).toBeGreaterThanOrEqual(0);
    expect(detail.timings).toMatchObject({ steps: 21, stepsDone: 11, lateSteps: ['CO-4'] });
    const xlsx = await binary(reader.api('get', `/data-load/runs/${run.id}/report`).query({ format: 'xlsx' }));
    expect(xlsx.status).toBe(200);
    const sheets = readWorkbook(xlsx.body);
    expect(sheets.map((x) => x.name)).toEqual(['Summary', 'Timings', 'Loads', 'Results', 'Defects']);
    expect(sheets[1].rows.map((r) => r[0])).toContain('CO-3');
    const pdf = await reader.api('get', `/data-load/runs/${run.id}/report`).query({ format: 'pdf' });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/pdf/);
    expect((await reader.api('get', `/data-load/runs/${run.id}/report`).query({ format: 'doc' })).status).toBe(400);
  });

  it('completing a run needs the result, the exit criteria and a summary; a closed run keeps its evidence', async () => {
    const mock = (await lead.api('post', '/data-load/runs').send({ kind: 'mock-2', title: 'Mock 2' })).body.data;
    expect((await lead.api('post', `/data-load/runs/${mock.id}/complete`).send({ result: 'passed', exitCriteriaMet: true, summary: 'ok' })).status).toBe(409);
    await lead.api('post', `/data-load/runs/${mock.id}/start`);
    expect((await lead.api('post', `/data-load/runs/${mock.id}/complete`).send({ result: 'great' })).status).toBe(400);
    const e = (await attach('run', mock.id)).body.data;
    const done = await lead.api('post', `/data-load/runs/${mock.id}/complete`).send({ result: 'failed', exitCriteriaMet: false, summary: 'Errors in the policy extract' });
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ status: 'failed', result: 'failed', exitCriteriaMet: false, actualEnd: expect.any(String) });
    expect((await lead.api('delete', `/data-load/evidence/${e.id}`)).status).toBe(409);
    expect((await lead.api('put', `/data-load/runs/${mock.id}`).send({ title: 'Renamed' })).status).toBe(409);
    expect((await lead.api('post', `/data-load/runs/${mock.id}/start`)).status).toBe(409);
  });

  it('the runbook template is kept by administrators and copied into new runs', async () => {
    const tpl = await reader.api('get', '/data-load/runbook');
    expect(tpl.body.data).toHaveLength(21);
    expect((await lead.api('put', '/data-load/runbook/CO-3').send({ dependsOn: ['CO-3'] })).status).toBe(400);
    const r = await lead.api('put', '/data-load/runbook/HC-2').send({ status: 'inactive' });
    expect(r.status).toBe(200);
    const mock = (await lead.api('post', '/data-load/runs').send({ kind: 'extra-mock', title: 'Mock 3' })).body.data;
    expect(mock.steps).toHaveLength(20);
    await lead.api('put', '/data-load/runbook/HC-2').send({ status: 'active' });
  });
});
