/**
 * Undo of a migration load before the go-live lock: requested by one user, approved by another, run as a job in one
 * transaction (reverse load order); everything the load created is removed, the records it changed and the opening
 * balances it replaced get back their values. A load is not undone while business entered since or a later load
 * depends on its records (checked at the request, the approval and inside the undo), nor after the lock.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { many, one, pool, query } from '../src/db/pool.js';
import { addDays } from '../src/lib/dates.js';
import { TRANSACTION_TABLES, SYSTEM_TABLES, MASTER_CONFIG_TABLES } from '../scripts/lib/table-classification.js';
import { undoBatch } from '../src/modules/data-load/undo.js';
import { ensureCalendar } from '../src/modules/period-end/fiscal.js';
import { businessRows, setLock, settle, startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';

let s;
let loader;
let approver;

/**
 * Row count of every table of the classification, except the records of the loads themselves (batches, rows), the
 * audit trail, the jobs, the notifications sent about the load and the number counters (never wound back).
 */
const NOT_COUNTED = new Set(['audit_log', 'job_queue', 'job_runs', 'data_load_batches', 'data_load_rows', 'notifications', 'sequences']);
async function inventory() {
  const present = new Set((await many("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).map((r) => r.tablename));
  const out = {};
  for (const t of [...TRANSACTION_TABLES, ...SYSTEM_TABLES, ...MASTER_CONFIG_TABLES].filter((x) => present.has(x) && !NOT_COUNTED.has(x)).sort()) {
    out[t] = (await one(`SELECT count(*)::int AS n FROM ${t}`)).n;
  }
  return out;
}

/** Upload as the loader, submit, approve as the approver and wait for the load: the batch. */
async function loaded(sheets) {
  const r = await uploadAs(loader.api, workbook(s.kits, sheets));
  expect(r.body.data.errors).toEqual([]);
  expect((await loader.api('post', `/data-load/batches/${r.body.data.batch.id}/submit`).send({})).status).toBe(200);
  expect((await approver.api('post', `/data-load/batches/${r.body.data.batch.id}/approve`)).status).toBe(202);
  const b = await settle(loader.api, r.body.data.batch.id);
  expect(b.status, b.message).toBe('loaded');
  return b;
}
const requestUndo = (id, reason = 'Wrong legacy extract') => loader.api('post', `/data-load/batches/${id}/undo-request`).send({ reason });
async function undone(id) {
  expect((await requestUndo(id)).status).toBe(200);
  const a = await approver.api('post', `/data-load/batches/${id}/undo-approve`);
  expect(a.status, JSON.stringify(a.body)).toBe(202);
  return settle(loader.api, id);
}

beforeAll(async () => {
  s = await startMigrationSuite({ users: { 'undo.loader': 'dl-loader', 'undo.approver': 'dl-approver' } });
  loader = s.users['undo.loader'];
  approver = s.users['undo.approver'];
  // the fiscal calendar of the cutover exists before the loads (it is generated on demand, never removed)
  await ensureCalendar(pool, s.cutover);
});
afterAll(async () => {
  await pool.end();
});

describe('undo of a load', () => {
  it('removes everything the load created: every table has the row count it had before the load', async () => {
    const sheets = {
      ...businessRows(s, 1),
      'Policies - CTPL': [{ 'Policy Number': 'UN-CTPL-1', 'Client Code': 'MJ1-C', Insurer: 'MALAYAN', Product: 'CTPL', 'Inception Date': addDays(s.issue, 1),
        'Expiry Date': addDays(s.cutover, 320), 'Issue Date': s.issue, 'Gross Premium': '610.00', 'Plate Number': 'UN 101', 'Chassis Number': 'CH-UN-101', 'COC Number': 'LEG-COC-UN-1' }],
    };
    const r = await uploadAs(loader.api, workbook(s.kits, sheets));
    expect(r.body.data.errors).toEqual([]);
    const id = r.body.data.batch.id;
    expect((await loader.api('post', `/data-load/batches/${id}/submit`).send({})).status).toBe(200);
    const before = await inventory();
    expect((await approver.api('post', `/data-load/batches/${id}/approve`)).status).toBe(202);
    expect((await settle(loader.api, id)).status).toBe('loaded');
    const after = await inventory();
    for (const t of ['clients', 'policies', 'risk_participants', 'ctpl_authentications', 'receivables', 'collection_items', 'post_dated_cheques', 'claims', 'claim_history', 'opening_balances']) {
      expect(after[t], t).toBeGreaterThan(before[t]);
    }
    const deps = await loader.api('get', `/data-load/batches/${id}/dependents`);
    expect(deps.body.data, JSON.stringify(deps.body)).toEqual([]);
    const b = await undone(id);
    expect(b).toMatchObject({ status: 'undone', undoneBy: 'undo.approver', undoRequestedBy: 'undo.loader', undoReason: 'Wrong legacy extract' });
    expect(b.undoMs).toBeGreaterThan(0);
    expect(await inventory()).toEqual(before);
    expect(await one('SELECT count(*)::int AS n FROM data_load_rows WHERE batch_id = $1 AND status = \'loaded\'', [id])).toEqual({ n: 0 });
    const audit = await many('SELECT entity, count(*)::int AS n FROM audit_log WHERE action = \'migrate-undo\' AND after_data->>\'loadNumber\' = $1 GROUP BY entity ORDER BY entity', [b.loadNumber]);
    expect(audit).toEqual([{ entity: 'claim', n: 1 }, { entity: 'client', n: 1 }, { entity: 'opening_balances', n: 2 }, { entity: 'policy', n: 2 }, { entity: 'post_dated_cheque', n: 1 },
      { entity: 'receivable', n: 1 }]);
    // the same file loads again afterwards (and is undone again, for the next cases)
    const again = await loaded(sheets);
    expect(again.rowsNew).toBe(again.rowsRead);
    expect((await undone(again.id)).status).toBe('undone');
  });

  it('is refused for its requester (403), for a configuration load and for a load not loaded', async () => {
    const b = await loaded({ Clients: [{ 'Client Code': 'UN-REQ-1', 'Client Type': 'corporate', 'Company Name': 'Requester Corp.' }] });
    expect((await requestUndo(b.id, '')).status).toBe(400);
    expect((await requestUndo(b.id)).status).toBe(200);
    expect((await requestUndo(b.id)).status).toBe(409);
    const both = s.admin;
    await query('UPDATE data_load_batches SET undo_requested_by = $2 WHERE id = $1', [b.id, both.id]);
    const self = await both.api('post', `/data-load/batches/${b.id}/undo-approve`);
    expect(self.status).toBe(403);
    expect(self.body.message).toMatch(/Maker-checker/);
    await query('UPDATE data_load_batches SET undo_requested_by = $2 WHERE id = $1', [b.id, loader.id]);
    // rejected: the load stays
    expect((await approver.api('post', `/data-load/batches/${b.id}/undo-reject`).send({ remarks: 'Correct it with a new load' })).body.data).toMatchObject({ status: 'loaded' });
    const conf = await uploadAs(loader.api, workbook(s.kits, { 'Write-off Reasons': [{ 'Reason Code': 'UN-WO', Reason: 'Undo test', 'GL Account': '6999001', Status: 'Active' }] }, 'configuration'),
      'configuration');
    expect((await loader.api('post', `/data-load/batches/${conf.body.data.batch.id}/submit`).send({})).status).toBe(200);
    expect((await approver.api('post', `/data-load/batches/${conf.body.data.batch.id}/approve`)).status).toBe(202);
    await settle(loader.api, conf.body.data.batch.id);
    expect((await requestUndo(conf.body.data.batch.id)).body.message).toMatch(/Only a migration load is undone here/);
  });
});

describe('changed records, opening balances and later loads', () => {
  let first;
  let second;

  it('a later load that changed its records or replaced its opening balances is undone first; then both are undone', async () => {
    first = await loaded(businessRows(s, 2, { balance: '10000' }));
    const rows = businessRows(s, 2, { balance: '20000' });
    second = await loaded({ Clients: [{ ...rows.Clients[0], Email: 'rosa.changed@example.ph' }], 'Opening Balances': rows['Opening Balances'] });
    expect(second.rowsChanged).toBeGreaterThan(0);
    const refused = await requestUndo(first.id);
    expect(refused.status).toBe(409);
    expect(refused.body.errors.map((e) => e.message)).toEqual(expect.arrayContaining([`client MJ2-C: Changed by load ${second.loadNumber} (1)`,
      `opening_balances ${s.cutover}: Replaced by load ${second.loadNumber} (1)`]));
    const b = await undone(second.id);
    expect(b.status).toBe('undone');
    expect(await one('SELECT email FROM clients WHERE client_code = \'MJ2-C\'')).toEqual({ email: 'rosa2@example.ph' });
    expect(await many('SELECT account_code, balance, load_batch_id FROM opening_balances ORDER BY account_code')).toEqual([
      { account_code: '1202001', balance: 10000, load_batch_id: first.id }, { account_code: '2201001', balance: -10000, load_batch_id: first.id }]);
    expect(await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'client\' AND action = \'migrate-undo\' AND after_data->>\'loadNumber\' = $1', [second.loadNumber]))
      .toEqual({ n: 1 });
    expect((await undone(first.id)).status).toBe('undone');
    expect(await one('SELECT count(*)::int AS n FROM opening_balances')).toEqual({ n: 0 });
  });

  it('is refused while a later load holds records that refer to its records', async () => {
    const clients = await loaded({ Clients: businessRows(s, 3).Clients });
    const policies = await loaded({ 'Policies - Motor': businessRows(s, 3)['Policies - Motor'] });
    const r = await requestUndo(clients.id);
    expect(r.status).toBe(409);
    expect(r.body.errors).toEqual([{ path: 'MJ3-C', message: `client MJ3-C: Policies of load ${policies.loadNumber} (1)` }]);
    const xlsx = await loader.api('get', `/data-load/batches/${clients.id}/dependents/workbook`);
    expect(xlsx.status).toBe(200);
    expect((await undone(policies.id)).status).toBe('undone');
    expect((await undone(clients.id)).status).toBe('undone');
  });
});

describe('business entered since the load', () => {
  let b;

  beforeAll(async () => {
    b = await loaded(businessRows(s, 4));
  });

  const refusedFor = async (label) => {
    const r = await requestUndo(b.id);
    expect(r.status).toBe(409);
    expect(r.body.errors.map((e) => e.message).join('; ')).toContain(label);
  };

  it('a deposited cheque', async () => {
    await query('UPDATE post_dated_cheques SET status = \'deposited\' WHERE cheque_number = \'MJ4-CHQ\'');
    await refusedFor('Post-dated cheque deposited');
    await query('UPDATE post_dated_cheques SET status = \'on-hand\' WHERE cheque_number = \'MJ4-CHQ\'');
  });

  it('an endorsement', async () => {
    const p = await one('SELECT id FROM policies WHERE policy_number = \'MJ4-P\'');
    await query('INSERT INTO endorsements(policy_id, endorsement_type) VALUES ($1, \'Change of plate number\')', [p.id]);
    await refusedFor('Endorsements');
    await query('DELETE FROM endorsements WHERE policy_id = $1', [p.id]);
  });

  it('a renewal', async () => {
    const p = await one('SELECT id FROM policies WHERE policy_number = \'MJ4-P\'');
    await query('INSERT INTO renewals(policy_id, due_date) VALUES ($1, $2)', [p.id, addDays(s.cutover, 300)]);
    await refusedFor('Renewals');
    await query('DELETE FROM renewals WHERE policy_id = $1', [p.id]);
  });

  it('a dependent saved after the approval still stops it inside the undo; the load stays loaded', async () => {
    expect((await requestUndo(b.id)).status).toBe(200);
    // approved: the batch is undoing when the claim handler adds a movement to the migrated claim
    await query('UPDATE data_load_batches SET status = \'undoing\' WHERE id = $1', [b.id]);
    const claim = await one('SELECT id FROM claims WHERE claim_number = \'MJ4-CLM\'');
    await query('INSERT INTO claim_history(claim_id, by_user, status, note) VALUES ($1, \'handler\', \'in-review\', \'Survey report received\')', [claim.id]);
    const err = await undoBatch(b.id, { id: approver.id, username: 'undo.approver' }).catch((e) => e);
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/cannot be undone/);
    expect(await one('SELECT status, message FROM data_load_batches WHERE id = $1', [b.id])).toMatchObject({ status: 'loaded', message: expect.stringMatching(/^Not undone: /) });
    expect(await one('SELECT count(*)::int AS n FROM clients WHERE client_code = \'MJ4-C\'')).toEqual({ n: 1 });
  });

  it('is refused after the go-live lock, at the request and at the approval', async () => {
    await query('DELETE FROM claim_history WHERE note = \'Survey report received\'');
    expect((await requestUndo(b.id)).status).toBe(200);
    await setLock(true);
    try {
      const a = await approver.api('post', `/data-load/batches/${b.id}/undo-approve`);
      expect(a.status).toBe(409);
      expect(a.body.message).toMatch(/^Go-live is locked: a migration load can no longer be undone/);
      expect((await loader.api('post', `/data-load/batches/${b.id}/undo-withdraw`)).status).toBe(200);
      expect((await requestUndo(b.id)).status).toBe(409);
      expect(await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'go_live_lock\' AND action = \'refused-locked\' AND entity_id = \'undo\'')).toEqual({ n: 2 });
    } finally {
      await setLock(false);
    }
  });

  it('a receipt on its open item', async () => {
    const bill = await one('SELECT id FROM receivables WHERE reference = \'MJ4-DN\'');
    const rc = await s.admin.api('post', '/receipts').send({ receivableId: bill.id, amount: 1000 });
    expect(rc.status, JSON.stringify(rc.body)).toBe(201);
    await refusedFor('Receipts');
  });
});
