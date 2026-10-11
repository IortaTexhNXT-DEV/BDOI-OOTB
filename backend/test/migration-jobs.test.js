/**
 * Jobs of the data loads: upload, approval and undo answer 202 and run as jobs of the job queue with their progress; a
 * batch is loaded at most once (compare-and-set of its status); a load stopped in the middle saves nothing and is
 * marked interrupted; the sweep finds the batches whose job stopped with its process and the loads waiting for
 * approval too long; the job's transaction has its statement and idle limits.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { one, pool, query } from '../src/db/pool.js';
import { sweep } from '../src/modules/data-load/jobs.js';
import { businessRows, settle, startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';

let s;
let loader;
let approver;

beforeAll(async () => {
  s = await startMigrationSuite({ users: { 'jobs.loader': 'dl-loader', 'jobs.approver': 'dl-approver' } });
  loader = s.users['jobs.loader'];
  approver = s.users['jobs.approver'];
});
afterEach(async () => {
  await query('DROP TRIGGER IF EXISTS jobs_probe ON clients');
  await query('DROP FUNCTION IF EXISTS jobs_probe()');
});
afterAll(async () => {
  await pool.end();
});

const submitted = async (wb) => {
  const r = await uploadAs(loader.api, wb);
  expect(r.body.data.errors).toEqual([]);
  const sub = await loader.api('post', `/data-load/batches/${r.body.data.batch.id}/submit`).send({});
  expect(sub.status, JSON.stringify(sub.body)).toBe(200);
  return sub.body.data;
};

describe('upload and validation', () => {
  it('answers 202 with the batch validating and its job; the job validates it and writes its progress', async () => {
    const clients = Array.from({ length: 600 }, (_, i) => ({ 'Client Code': `JOB-V-${i}`, 'Client Type': 'corporate', 'Company Name': `Job Volume ${i} Corp.` }));
    const res = await loader.api('post', '/data-load/batches').field('kit', 'migration').attach('file', workbook(s.kits, { Clients: clients }), 'volume.xlsx');
    expect(res.status).toBe(202);
    expect(res.body.data.batch).toMatchObject({ status: 'validating', rowsRead: 600, fileStored: true });
    expect(res.body.data.job).toMatchObject({ queue: 'data-load', type: 'data-load.validate' });
    expect(res.body.data.batch.jobId).toBe(res.body.data.job.id);
    const b = await settle(loader.api, res.body.data.batch.id);
    expect(b).toMatchObject({ status: 'validated', rowsNew: 600, progress: null });
    expect(b.validateMs).toBeGreaterThan(0);
    // the job row is completed once the handler returns, just after the batch
    let job = await one('SELECT status, progress, attempts FROM job_queue WHERE id = $1', [b.jobId]);
    for (let i = 0; job.status === 'processing' && i < 100; i += 1) {
      await new Promise((resolve) => { setTimeout(resolve, 50); });
      job = await one('SELECT status, progress, attempts FROM job_queue WHERE id = $1', [b.jobId]);
    }
    expect(job).toMatchObject({ status: 'completed', attempts: 1 });
    expect(job.progress).toMatchObject({ total: 600, processed: 500 });
    expect(await one('SELECT count(*)::int AS n FROM clients WHERE client_code LIKE \'JOB-V-%\'')).toEqual({ n: 0 });
  });

  it('a validation again also runs as a job, and the batch is refused while it is not in a state to validate', async () => {
    const r = await uploadAs(loader.api, workbook(s.kits, { Clients: [{ 'Client Code': 'JOB-A-1', 'Client Type': 'corporate', 'Company Name': 'Again Corp.' }] }));
    const again = await loader.api('post', `/data-load/batches/${r.body.data.batch.id}/validate`);
    expect(again.status).toBe(202);
    expect(again.body.data.job.type).toBe('data-load.validate');
    expect((await settle(loader.api, r.body.data.batch.id)).status).toBe('validated');
    await loader.api('post', `/data-load/batches/${r.body.data.batch.id}/submit`).send({});
    const refused = await loader.api('post', `/data-load/batches/${r.body.data.batch.id}/validate`);
    expect(refused.status).toBe(409);
    expect(refused.body.message).toMatch(/is waiting for approval/);
  });
});

describe('approval and load', () => {
  it('approve answers 202 and the load runs as a job as the approver; a second approval is refused and nothing is loaded twice', async () => {
    const batch = await submitted(workbook(s.kits, businessRows(s, 1)));
    const [first, second] = await Promise.all([
      approver.api('post', `/data-load/batches/${batch.id}/approve`),
      approver.api('post', `/data-load/batches/${batch.id}/approve`),
    ]);
    expect([first.status, second.status].sort()).toEqual([202, 409]);
    const ok = first.status === 202 ? first : second;
    const refused = first.status === 202 ? second : first;
    expect(ok.body.data.batch.status).toBe('running');
    expect(ok.body.data.job.type).toBe('data-load.load');
    expect(refused.body.message).toMatch(/already running|already loaded/);
    const b = await settle(loader.api, batch.id);
    expect(b).toMatchObject({ status: 'loaded', loadedBy: 'jobs.approver', decidedBy: 'jobs.approver', decision: 'approved' });
    expect(b.loadMs).toBeGreaterThan(0);
    const third = await approver.api('post', `/data-load/batches/${batch.id}/approve`);
    expect(third.status).toBe(409);
    expect(third.body.message).toBe(`Load ${b.loadNumber} is already loaded`);
    expect(await one('SELECT count(*)::int AS n FROM clients WHERE client_code = \'MJ1-C\'')).toEqual({ n: 1 });
    expect(await one('SELECT count(*)::int AS n FROM audit_log WHERE action = \'migrate-create\' AND entity = \'client\' AND after_data->>\'loadNumber\' = $1', [b.loadNumber])).toEqual({ n: 1 });
    expect(await one('SELECT user_id FROM audit_log WHERE action = \'load\' AND entity = \'data_load_batch\' AND entity_id = $1', [String(b.id)])).toEqual({ user_id: approver.id });
  });

  it('sets the statement and idle limits of migration.job_statement_timeout_minutes inside the job transaction', async () => {
    await query('CREATE TABLE IF NOT EXISTS jobs_limits (statement text, idle text)');
    await query(`CREATE FUNCTION jobs_probe() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO jobs_limits VALUES (current_setting('statement_timeout'), current_setting('idle_in_transaction_session_timeout')); RETURN NEW; END $$`);
    await query('CREATE TRIGGER jobs_probe AFTER INSERT ON clients FOR EACH ROW EXECUTE FUNCTION jobs_probe()');
    const batch = await submitted(workbook(s.kits, { Clients: [{ 'Client Code': 'JOB-T-1', 'Client Type': 'corporate', 'Company Name': 'Timeout Corp.' }] }));
    expect((await approver.api('post', `/data-load/batches/${batch.id}/approve`)).status).toBe(202);
    expect((await settle(loader.api, batch.id)).status).toBe('loaded');
    expect((await query('SELECT * FROM jobs_limits')).rows).toEqual([{ statement: '1h', idle: '1h' }]);
    // outside the job the session keeps its own limits
    expect((await one('SHOW statement_timeout')).statement_timeout).toBe('0');
    await query('DROP TABLE jobs_limits');
  });

  it('a load stopped in the middle (the server ends the session) saves nothing and the batch is failed, interrupted', async () => {
    const batch = await submitted(workbook(s.kits, { Clients: [
      { 'Client Code': 'JOB-K-1', 'Client Type': 'corporate', 'Company Name': 'Killed One Corp.' },
      { 'Client Code': 'JOB-K-2', 'Client Type': 'corporate', 'Company Name': 'Killed Two Corp.' },
    ] }));
    // the second client of the load: the server ends the session (after the validation, which ran clean)
    await query(`CREATE FUNCTION jobs_probe() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.client_code = 'JOB-K-2' THEN RAISE EXCEPTION 'terminating connection due to administrator command' USING ERRCODE = 'admin_shutdown'; END IF; RETURN NEW; END $$`);
    await query('CREATE TRIGGER jobs_probe BEFORE INSERT ON clients FOR EACH ROW EXECUTE FUNCTION jobs_probe()');
    expect((await approver.api('post', `/data-load/batches/${batch.id}/approve`)).status).toBe(202);
    const b = await settle(loader.api, batch.id);
    expect(b).toMatchObject({ status: 'failed', message: 'Interrupted: nothing was saved', validatedAt: null });
    expect(await one('SELECT count(*)::int AS n FROM clients WHERE client_code LIKE \'JOB-K-%\'')).toEqual({ n: 0 });
    await expect.poll(async () => (await one('SELECT status FROM job_queue WHERE id = $1', [b.jobId])).status).toBe('failed');
    // resume: validate again, submit, approve
    const resubmit = await loader.api('post', `/data-load/batches/${batch.id}/submit`).send({});
    expect(resubmit.status).toBe(409);
    expect(resubmit.body.message).toMatch(/failed/);
  });
});

describe('sweep', () => {
  it('marks a batch whose job stopped with its process as failed, interrupted, and fails the job; an undo goes back to loaded', async () => {
    const r = await uploadAs(loader.api, workbook(s.kits, { Clients: [{ 'Client Code': 'JOB-S-1', 'Client Type': 'corporate', 'Company Name': 'Swept Corp.' }] }));
    const id = r.body.data.batch.id;
    // the process died while the job was running: the job stays processing, the progress stops
    const job = await one(`INSERT INTO job_queue(queue, job_type, payload, status, attempts, started_at) VALUES ('data-load', 'data-load.load', $1, 'processing', 1, now() - interval '40 minutes')
      RETURNING id`, [JSON.stringify({ batchId: id })]);
    await query('UPDATE data_load_batches SET status = \'running\', job_id = $2, progress = $3 WHERE id = $1', [id, job.id, JSON.stringify({ stage: 'running', at: new Date(Date.now() - 30 * 60000).toISOString() })]);
    const fresh = await one(`INSERT INTO job_queue(queue, job_type, payload, status, attempts, started_at) VALUES ('data-load', 'data-load.undo', '{}', 'processing', 1, now()) RETURNING id`);
    const busy = await uploadAs(loader.api, workbook(s.kits, { Clients: [{ 'Client Code': 'JOB-S-2', 'Client Type': 'corporate', 'Company Name': 'Busy Corp.' }] }));
    await query('UPDATE data_load_batches SET status = \'running\', job_id = $2, progress = $3 WHERE id = $1', [busy.body.data.batch.id, fresh.id, JSON.stringify({ stage: 'running', at: new Date().toISOString() })]);
    const out = await sweep();
    expect(out.interrupted).toBe(1);
    expect((await settle(loader.api, id))).toMatchObject({ status: 'failed', message: 'Interrupted: nothing was saved' });
    expect(await one('SELECT status, error FROM job_queue WHERE id = $1', [job.id])).toEqual({ status: 'failed', error: 'Interrupted: nothing was saved' });
    expect(await one('SELECT action FROM audit_log WHERE entity = \'data_load_batch\' AND entity_id = $1 ORDER BY id DESC LIMIT 1', [String(id)])).toEqual({ action: 'interrupted' });
    // a job that still writes its progress is left alone
    expect((await one('SELECT status FROM data_load_batches WHERE id = $1', [busy.body.data.batch.id])).status).toBe('running');
    // its job ended without moving it (a crash between the commit and the status): an undo goes back to loaded
    await query('UPDATE job_queue SET status = \'completed\' WHERE id = $1', [fresh.id]);
    await query('UPDATE data_load_batches SET status = \'undoing\' WHERE id = $1', [busy.body.data.batch.id]);
    await sweep();
    expect(await one('SELECT status, message FROM data_load_batches WHERE id = $1', [busy.body.data.batch.id])).toEqual({ status: 'loaded', message: 'Interrupted: nothing was saved' });
  });

  it('a second attempt of a job never runs it again: the batch is marked interrupted', async () => {
    const batch = await submitted(workbook(s.kits, { Clients: [{ 'Client Code': 'JOB-R-1', 'Client Type': 'corporate', 'Company Name': 'Retried Corp.' }] }));
    await query('UPDATE data_load_batches SET status = \'running\' WHERE id = $1', [batch.id]);
    const job = await one(`INSERT INTO job_queue(queue, job_type, payload, status, attempts) VALUES ('data-load', 'data-load.load', $1, 'waiting', 1) RETURNING id`,
      [JSON.stringify({ batchId: batch.id, user: { id: approver.id, username: 'jobs.approver' } })]);
    await query('UPDATE data_load_batches SET job_id = $2 WHERE id = $1', [batch.id, job.id]);
    const { processQueue } = await import('../src/modules/renewals/queue.js');
    await processQueue();
    expect(await settle(loader.api, batch.id)).toMatchObject({ status: 'failed', message: 'Interrupted: nothing was saved' });
    expect(await one('SELECT count(*)::int AS n FROM clients WHERE client_code = \'JOB-R-1\'')).toEqual({ n: 0 });
  });

  it('expires a load waiting for approval longer than migration.approval_expiry_hours and tells the submitter', async () => {
    const batch = await submitted(workbook(s.kits, { Clients: [{ 'Client Code': 'JOB-E-1', 'Client Type': 'corporate', 'Company Name': 'Expired Corp.' }] }));
    expect(new Date(batch.expiresAt).getTime() - new Date(batch.submittedAt).getTime()).toBe(72 * 3600000);
    await query('UPDATE data_load_batches SET expires_at = now() - interval \'1 minute\' WHERE id = $1', [batch.id]);
    expect((await sweep()).expired).toBe(1);
    const b = await settle(loader.api, batch.id);
    expect(b.status).toBe('expired');
    expect(await one('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND entity = \'data_load_batch\' AND entity_id = $2 AND title LIKE \'%expired\'', [loader.id, String(batch.id)]))
      .toEqual({ n: 1 });
    expect((await approver.api('post', `/data-load/batches/${batch.id}/approve`)).status).toBe(409);
  });
});

describe('queue', () => {
  it('shows a waiting job its place in the queue', async () => {
    const r = await uploadAs(loader.api, workbook(s.kits, { Clients: [{ 'Client Code': 'JOB-Q-1', 'Client Type': 'corporate', 'Company Name': 'Queued Corp.' }] }));
    const id = r.body.data.batch.id;
    const ahead = await one(`INSERT INTO job_queue(queue, job_type, payload, status) VALUES ('other', 'no-such-type', '{}', 'processing') RETURNING id`);
    const job = await one(`INSERT INTO job_queue(queue, job_type, payload, status) VALUES ('data-load', 'data-load.validate', '{}', 'held') RETURNING id`);
    await query('UPDATE job_queue SET status = \'waiting\' WHERE id = $1', [job.id]);
    await query('UPDATE data_load_batches SET status = \'validating\', job_id = $2 WHERE id = $1', [id, job.id]);
    const g = await loader.api('get', `/data-load/batches/${id}`);
    expect(g.body.data.queue).toMatchObject({ jobStatus: 'waiting', ahead: 1 });
    await query('UPDATE job_queue SET status = \'completed\' WHERE id = ANY($1)', [[ahead.id, job.id]]);
    await query('UPDATE data_load_batches SET status = \'failed\' WHERE id = $1', [id]);
  });
});
