/**
 * Overview and Hypercare of Data Migration & Go-Live (data-load/overview.js, hypercare.js): the phases, the current run
 * and what waits for the user; after the go-live lock the business issued since go-live apart from the migrated
 * business, the migrated open items collected, renewals, endorsements and cancellations on migrated policies, edits to
 * migrated records, the daily checks, imports refused while locked and the open defects of the production run.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { one, pool, query } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { ensureCalendar } from '../src/modules/period-end/fiscal.js';
import { validatedBatch } from './helpers.js';
import { businessRows, setLock, startMigrationSuite, workbook } from './migration.fixtures.js';

let s;
let approver;
let run;
let policy;

beforeAll(async () => {
  s = await startMigrationSuite({ approval: false, users: { 'hc.approver': 'dl-approver' } });
  approver = s.users['hc.approver'];
  await ensureCalendar(pool, s.cutover);
  run = (await s.admin.api('post', '/data-load/runs').send({ kind: 'production', title: 'Production cutover' })).body.data;
  const up = await validatedBatch(s.admin.api, s.admin.api('post', '/data-load/batches').field('kit', 'migration').field('runId', String(run.id))
    .attach('file', workbook(s.kits, businessRows(s, 1)), 'mig.xlsx'));
  expect(up.body.data.errors).toEqual([]);
  expect((await s.admin.api('post', `/data-load/batches/${up.body.data.batch.id}/load`).send({})).status).toBe(200);
  policy = await one('SELECT id, client_id FROM policies WHERE origin = \'migrated\'');
});
afterAll(async () => {
  await pool.end();
});

describe('overview', () => {
  it('shows the phases, the current run, the loads and what waits for the user', async () => {
    await query('INSERT INTO data_load_batches(kit, status, created_by, submitted_by) VALUES (\'migration\', \'pending-approval\', $1, $1)', [s.admin.id]);
    const r = await approver.api('get', '/data-load/overview');
    expect(r.status).toBe(200);
    const o = r.body.data;
    expect(o.phases.map((p) => [p.key, p.status])).toEqual([['templates', 'done'], ['mock-1', 'not-started'], ['mock-2', 'not-started'], ['dress-rehearsal', 'not-started'],
      ['cutover', 'in-progress'], ['go-live', 'not-started'], ['hypercare', 'not-started']]);
    expect(o.run).toMatchObject({ id: run.id, kind: 'production', checklist: { done: 0, total: 21 }, reconciliation: null, decision: null });
    expect(o.loads).toMatchObject({ loaded: 1, pendingApproval: 1 });
    expect(o.loads.rows.new).toBeGreaterThanOrEqual(6);
    expect(o.forMe.approvals).toEqual([expect.objectContaining({ type: 'load' })]);
    expect((await s.admin.api('get', '/data-load/overview')).body.data.forMe.approvals).toEqual([]);
    await query('DELETE FROM data_load_batches WHERE status = \'pending-approval\'');
  });
});

describe('hypercare', () => {
  it('starts at the go-live lock', async () => {
    expect((await approver.api('get', '/data-load/hypercare')).body.data).toMatchObject({ started: false, hypercareDays: 28, cutoverDate: s.cutover });
  });

  it('tells the business issued since go-live apart from the migrated business', async () => {
    const day = await today();
    await query(`INSERT INTO policies(policy_number, client_id, status, inception_date, expiry_date, premium_total, issued_date, origin)
      VALUES ('HC-NEW-1', $1, 'issued', $2, $3, 12000, $2, 'issued'), ('HC-OLD-1', $1, 'issued', $4, $3, 9000, $4, 'issued')`, [policy.client_id, s.cutover, addDays(s.cutover, 365), addDays(s.cutover, -5)]);
    await query('UPDATE policies SET expiry_date = $2 WHERE id = $1', [policy.id, addDays(day, 30)]);
    await query(`INSERT INTO endorsements(policy_id, endorsement_type, status, premium_delta, is_cancel, created_at) VALUES
      ($1, 'change', 'completed', 0, false, $2), ($1, 'cancellation', 'completed', -2500, true, $2)`, [policy.id, s.cutover]);
    const receivable = await one('SELECT id FROM receivables WHERE origin = \'migrated\'');
    await query('INSERT INTO receipt_applications(receivable_id, amount) VALUES ($1, 4000)', [receivable.id]);
    await setLock(true);
    // an edit of a migrated record after the lock counts; the migration's own entries do not
    await query(`INSERT INTO audit_log(username, entity, entity_id, action, at) VALUES ('ops', 'policy', $1, 'update', now()), ('ops', 'policy', $1, 'migrate-update', now()),
      ('ops', 'client', 'not-migrated', 'update', now())`, [policy.id]);
    const refused = await s.admin.api('post', '/data-load/batches').field('kit', 'migration').attach('file', workbook(s.kits, { Clients: businessRows(s, 2).Clients }), 'late.xlsx');
    expect(refused.status).toBe(409);
    await s.admin.api('post', `/data-load/runs/${run.id}/defects`).send({ title: 'Ageing of two bills wrong', severity: 2 });

    const h = (await approver.api('get', '/data-load/hypercare')).body.data;
    expect(h).toMatchObject({ started: true, cutoverDate: s.cutover, daysSinceGoLive: 0, hypercareDays: 28, ended: false });
    expect(h.issued).toMatchObject({ policies: 1, grossPremium: 12000, endorsements: 0, claims: 0 });
    expect(h.migratedPolicies).toEqual({ endorsements: 2, claims: 0, cancellations: 1, cancelledPremium: -2500 });
    expect(h.migratedItems).toMatchObject({ count: 1, collected: 4000 });
    expect(h.migratedItems.openingBalance).toBe(h.migratedItems.openBalance + 4000);
    expect(h.renewals).toEqual({ due: 1, renewed: 0 });
    expect(h.edits.total).toBe(1);
    expect(h.edits.byEntity.find((e) => e.entity === 'policy').count).toBe(1);
    expect(h.lock.refused).toBe(1);
    expect(h.defects.find((d) => d.severity === 2).open).toBe(1);
    expect(h.checks.map((c) => c.code)).toEqual(['trial-balance', 'subledger-tieout', 'sap-gl-file', 'numbering', 'lock']);
    expect(h.checks.find((c) => c.code === 'lock').ok).toBe(true);
    expect(h.checks.find((c) => c.code === 'numbering').ok).toBe(true);
    expect(h.checks.find((c) => c.code === 'sap-gl-file')).toMatchObject({ ok: false, detail: 'No run' });
  });
});
