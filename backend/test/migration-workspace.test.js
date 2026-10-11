/**
 * What the Data Migration & Go-Live screens read to show the rules before the click, and what a read-only user meets
 * on the server: the makers of a load and of its undo, the makers of a reconciliation, the users of the workspace with
 * what they may do, the document file naming convention, the history of the workspace records, the reasons of a load
 * rejection, and the refusal of every change to a holder of read:data-load only (the auditor).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { ensureCalendar } from '../src/modules/period-end/fiscal.js';
import { settle, startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';

let s;
let loader;
let approver;
let resolver;
let auditor;
let batch;

const client = (code, extra = {}) => ({ 'Client Code': code, 'Client Type': 'individual', 'First Name': 'Ana', 'Last Name': code, ...extra });

beforeAll(async () => {
  s = await startMigrationSuite({ users: { 'ws.loader': 'dl-loader', 'ws.approver': 'dl-approver', 'ws.resolver': 'dl-both', 'ws.auditor': 'dl-reader' } });
  ({ 'ws.loader': loader, 'ws.approver': approver, 'ws.resolver': resolver, 'ws.auditor': auditor } = s.users);
  await ensureCalendar(pool, s.cutover);
});
afterAll(async () => {
  await pool.end();
});

describe('makers shown before the decision', () => {
  it('names the uploader, the submitter and the users who resolved a duplicate as makers of the load', async () => {
    const r = await uploadAs(loader.api, workbook(s.kits, { Clients: [client('WS-C-1', { TIN: '555-111-222-000' }), client('WS-C-2', { TIN: '555111222000' })] }));
    batch = r.body.data.batch;
    expect((await loader.api('get', `/data-load/batches/${batch.id}`)).body.data.makers).toEqual({ load: [loader.id], undo: [] });
    const res = await resolver.api('post', `/data-load/batches/${batch.id}/resolutions`).send({ rule: 'tin', resolution: 'load-as-new', reason: 'Two persons share the legacy TIN' });
    expect(res.status).toBe(202);
    expect((await settle(loader.api, batch.id)).status).toBe('validated');
    expect((await loader.api('post', `/data-load/batches/${batch.id}/submit`).send({})).status).toBe(200);
    const { makers } = (await approver.api('get', `/data-load/batches/${batch.id}`)).body.data;
    expect(makers.load.sort()).toEqual([loader.id, resolver.id].sort());
    // the server keeps the same rule
    expect((await resolver.api('post', `/data-load/batches/${batch.id}/approve`)).status).toBe(403);
    expect((await approver.api('post', `/data-load/batches/${batch.id}/approve`)).status).toBe(202);
    expect((await settle(loader.api, batch.id)).status).toBe('loaded');
  });

  it('names the requester of an undo, and the loaders of a reconciliation', async () => {
    expect((await loader.api('post', `/data-load/batches/${batch.id}/undo-request`).send({ reason: 'Wrong extract' })).status).toBe(200);
    expect((await approver.api('get', `/data-load/batches/${batch.id}`)).body.data.makers.undo).toEqual([loader.id]);
    expect((await loader.api('post', `/data-load/batches/${batch.id}/undo-withdraw`)).status).toBe(200);
    const c = await loader.api('post', '/data-load/reconciliations').send({ batchIds: [batch.id] });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    expect(c.body.data.makers.sort()).toEqual([loader.id, approver.id].sort());
  });
});

describe('reference data of the screens', () => {
  it('lists the users of the workspace with what they may do', async () => {
    const users = (await auditor.api('get', '/data-load/users')).body.data;
    const of = (id) => users.find((x) => x.userId === id);
    expect(of(approver.id)).toMatchObject({ name: 'ws.approver', canWrite: false, canApprove: true });
    expect(of(loader.id)).toMatchObject({ canWrite: true, canApprove: false });
    expect(of(auditor.id)).toMatchObject({ canWrite: false, canApprove: false });
    expect(of(s.admin.id)).toMatchObject({ canWrite: true, canApprove: true });
    expect(users.every((x) => Array.isArray(x.roles))).toBe(true);
  });

  it('gives the document file naming convention with the kits', async () => {
    const { naming } = (await auditor.api('get', '/data-load/kits')).body.data;
    expect(naming.pattern).toBe('<RecordType>_<RecordNumber>_<DocumentType>_<YYYYMMDD>[_<n>].<ext>');
    expect(naming.recordTypes).toEqual(expect.arrayContaining([{ code: 'POL', label: 'Policy' }]));
    expect(naming.extensions).toContain('pdf');
    expect(Array.isArray(naming.documentTypes)).toBe(true);
  });

  it('opens the history of a load and the reasons of a rejection to the users of the workspace', async () => {
    const h = await auditor.api('get', `/audit/records/data_load_batch/${batch.id}`);
    expect(h.status, JSON.stringify(h.body)).toBe(200);
    expect(h.body.data.map((e) => e.entity)).toContain('data_load_batch');
    expect((await approver.api('get', '/ops-masters/reason-code?context=data_load_reject&status=Active')).status).toBe(200);
  });
});

describe('read only', () => {
  it('refuses every change to a holder of read:data-load only', async () => {
    const calls = [
      ['post', `/data-load/batches/${batch.id}/submit`], ['post', `/data-load/batches/${batch.id}/approve`], ['post', `/data-load/batches/${batch.id}/undo-request`],
      ['post', '/data-load/reconciliations'], ['post', '/data-load/runs'], ['post', '/data-load/decisions'], ['post', '/data-load/golive/lock-requests'],
      ['put', '/data-load/golive/cutover-date'], ['post', '/data-load/value-maps'],
    ];
    for (const [method, path] of calls) {
      const r = await auditor.api(method, path).send({});
      expect(r.status, `${method} ${path}`).toBe(403);
    }
    expect((await auditor.api('get', '/data-load/overview')).status).toBe(200);
  });
});
