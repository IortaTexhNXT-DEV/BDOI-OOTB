/**
 * Go / No-Go (migration 0444, data-load/decisions.js): the decision of a run names its approvers, copies the criteria
 * and computes the automatic ones on the records (G2 load, G3 checks and tie-outs, G4 sign-off, G6 environment
 * comparison, G7 users, G8 numbering over every period and COC series, G9 restore point, G11 evidence pack); G2 to G5
 * are never waived and a waiver is never by the creator; voting opens once every criterion is met or waived; only the
 * named approvers vote; all Go makes it Go, one No-Go makes it No-Go with the reason, the actions and the new date.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays } from '../src/lib/dates.js';
import { ensureCalendar } from '../src/modules/period-end/fiscal.js';
import { validatedBatch } from './helpers.js';
import { businessRows, settle, startMigrationSuite, workbook } from './migration.fixtures.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const control = (object, measure, group, value) => ({ Object: object, Measure: measure, Group: group, 'Legacy Value': value });
const CONTROL_TOTALS = [
  control('Clients', 'count', '', '1'),
  control('Policies', 'count', '', '1'), control('Policies', 'gross premium', '', '25000'), control('Policies', 'gross premium', 'motor', '25000'),
  control('Policies', 'net premium', '', '20000'),
  control('Open Items', 'count', '', '1'), control('Open Items', 'original amount', '', '25000'), control('Open Items', 'open balance', '', '10000'),
  control('Open Items', 'open balance', 'MALAYAN', '10000'),
  control('Post-Dated Cheques', 'count', '', '1'), control('Post-Dated Cheques', 'amount', '', '5000'),
  control('Open Claims', 'count', '', '1'), control('Open Claims', 'outstanding estimate', '', '45000'),
  control('Opening Balances', 'debit', '', '10000'), control('Opening Balances', 'credit', '', '10000'),
  control('Sub-ledger', 'due to insurers', 'MALAYAN', '10000'),
  control('Sub-ledger', 'sap trial balance', '1202001', '10000'), control('Sub-ledger', 'sap trial balance', '210245', '10000'),
];

let s;
let lead;
let loader;
let approver;
let owner;
let finance;
let run;
let decision;
let recon;

const criterion = (d, code) => d.criteria.find((c) => c.code === code);
const refresh = async () => {
  const r = await lead.api('post', `/data-load/decisions/${decision.id}/refresh`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  decision = r.body.data;
  return decision;
};
const setCriterion = (who, code, body) => who.api('put', `/data-load/decisions/${decision.id}/criteria/${code}`).send(body);

beforeAll(async () => {
  s = await startMigrationSuite({ approval: true, users: { 'dec.lead': 'dl-both', 'dec.loader': 'dl-loader', 'dec.approver': 'dl-approver', 'dec.owner': 'dl-approver', 'dec.finance': 'dl-approver' } });
  ({ 'dec.lead': lead, 'dec.loader': loader, 'dec.approver': approver, 'dec.owner': owner, 'dec.finance': finance } = s.users);
  await ensureCalendar(pool, s.cutover);
  run = (await lead.api('post', '/data-load/runs').send({ kind: 'production', title: 'Production cutover' })).body.data;
  await lead.api('post', `/data-load/runs/${run.id}/start`);
});
afterAll(async () => {
  await pool.end();
});

describe('decision and approvers', () => {
  it('names at least the minimum of approvers, one as Finance Head, each able to approve, never the creator', async () => {
    const make = (approvers) => lead.api('post', '/data-load/decisions').send({ runId: run.id, approvers });
    const paths = async (approvers) => (await make(approvers)).body.errors.map((e) => e.message);
    expect(await paths([{ userId: owner.id, roleLabel: 'Finance Head' }])).toContain('Name at least 2 approvers');
    expect(await paths([{ userId: owner.id, roleLabel: 'Data owner' }, { userId: finance.id, roleLabel: 'General Manager' }])).toContain('One approver votes as Finance Head');
    expect(await paths([{ userId: loader.id, roleLabel: 'Finance Head' }, { userId: finance.id, roleLabel: 'General Manager' }]))
      .toContain('Approver must be an active user who may approve go-live');
    expect(await paths([{ userId: lead.id, roleLabel: 'Finance Head' }, { userId: finance.id, roleLabel: 'General Manager' }]))
      .toContain('The creator of the decision does not vote on it');
    const r = await make([{ userId: finance.id, roleLabel: 'Finance Head' }, { userId: owner.id, roleLabel: 'General Manager' }]);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    decision = r.body.data;
    expect(decision).toMatchObject({ status: 'draft', runNumber: run.runNumber });
    expect(decision.criteria.map((c) => c.code)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11']);
    expect(decision.criteria.filter((c) => !c.waivable).map((c) => c.code)).toEqual(['G2', 'G3', 'G4', 'G5']);
    expect(decision.approvers.map((a) => a.roleLabel)).toEqual(['Finance Head', 'General Manager']);
    expect((await make([{ userId: finance.id, roleLabel: 'Finance Head' }, { userId: owner.id, roleLabel: 'GM' }])).status).toBe(409);
  });
});

describe('automatic criteria', () => {
  it('G2: a migration load of the run loaded in full', async () => {
    expect(criterion(decision, 'G2')).toMatchObject({ status: 'not-met', autoResult: { met: false, detail: 'No migration load of the run is loaded' } });
    const wb = workbook(s.kits, { ...businessRows(s, 1), 'Opening Balances': [{ 'Account Code': '1202001', Debit: '10000' }, { 'Account Code': '210245', Credit: '10000' }],
      'Control Totals': CONTROL_TOTALS });
    const up = await validatedBatch(loader.api, loader.api('post', '/data-load/batches').field('kit', 'migration').field('runId', String(run.id)).attach('file', wb, 'mig.xlsx'));
    expect(up.body.data.errors).toEqual([]);
    const id = up.body.data.batch.id;
    expect((await loader.api('post', `/data-load/batches/${id}/submit`).send({})).status).toBe(200);
    expect((await approver.api('post', `/data-load/batches/${id}/approve`)).status).toBe(202);
    expect((await settle(loader.api, id)).status).toBe('loaded');
    expect(criterion(await refresh(), 'G2')).toMatchObject({ status: 'met' });
    await query('UPDATE data_load_batches SET valid_rows_only = true WHERE id = $1', [id]);
    const g2 = criterion(await refresh(), 'G2');
    expect(g2.status).toBe('not-met');
    expect(g2.autoResult.items).toEqual([{ loadNumber: `MIG-${String(id).padStart(6, '0')}`, validRowsOnly: true, rowsInError: 0 }]);
    await query('UPDATE data_load_batches SET valid_rows_only = false WHERE id = $1', [id]);
  });

  it('G3 and G4: checks and tie-outs agree or their differences are accepted; the reconciliation is signed', async () => {
    expect(criterion(await refresh(), 'G3').autoResult.detail).toBe('No reconciliation of the run');
    const c = await loader.api('post', '/data-load/reconciliations').send({ runId: run.id });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    recon = c.body.data;
    const d = await refresh();
    expect(criterion(d, 'G3'), JSON.stringify(criterion(d, 'G3').autoResult)).toMatchObject({ status: 'met' });
    expect(criterion(d, 'G4').status).toBe('not-met');
    const due = recon.lines.find((l) => l.kind === 'tieout' && l.measure === 'due-to-insurers' && !l.group);
    const r = await loader.api('put', `/data-load/reconciliations/${recon.id}/lines/${due.id}`).send({ legacyValue: 10400 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const g3 = criterion(await refresh(), 'G3');
    expect(g3.status).toBe('not-met');
    expect(g3.autoResult.items[0]).toMatchObject({ reconNumber: recon.reconNumber, status: 'difference' });
    const diff = r.body.data.differences.find((x) => x.lineId === due.id);
    expect((await approver.api('post', `/data-load/reconciliations/${recon.id}/differences/${diff.id}/accept`).send({ explanation: 'x' })).status).toBe(403);
    expect((await owner.api('post', `/data-load/reconciliations/${recon.id}/differences/${diff.id}/accept`).send({ explanation: 'Legacy listing includes a cancelled bill' })).status).toBe(200);
    expect(criterion(await refresh(), 'G3').status).toBe('met');
    expect((await owner.api('post', `/data-load/reconciliations/${recon.id}/signoffs/data-owner`).send({ remarks: 'Agrees' })).status).toBe(200);
    expect(criterion(await refresh(), 'G4').autoResult.detail).toMatch(/is not signed \(1 of 2 sign-offs\)/);
    expect((await finance.api('post', `/data-load/reconciliations/${recon.id}/signoffs/finance-head`).send({ remarks: 'Agrees' })).status).toBe(200);
    expect(criterion(await refresh(), 'G4').status).toBe('met');
  });

  it('G6: the latest environment comparison is mirrored', async () => {
    const comparison = (verdict) => query(`INSERT INTO data_load_comparisons(kit, mode, file_name, verdict, totals, sheets, rows, environment_specific)
      VALUES ('configuration', 'environment', 'uat.xlsx', $1, '{}', '[]', '[]', '[]')`, [verdict]);
    expect(criterion(decision, 'G6').autoResult.detail).toBe('No environment comparison');
    await comparison('differences');
    expect(criterion(await refresh(), 'G6').status).toBe('not-met');
    await comparison('mirrored');
    expect(criterion(await refresh(), 'G6').status).toBe('met');
  });

  it('G7: demo accounts and SUPERID inactive, password sign-in off', async () => {
    await query(`INSERT INTO users(username, password_hash, display_name, email, status, created_by) VALUES ('agent.demo', 'x', 'Demo', 'demo@example.ph', 'active', 'seed')`);
    const superid = await one(`INSERT INTO users(username, password_hash, display_name, email, status, created_by) VALUES ('uat.super', 'x', 'UAT', 'uat@example.ph', 'active', 'admin') RETURNING id`);
    await query('INSERT INTO user_roles(user_id, role_id) SELECT $1, id FROM roles WHERE code = \'tis-superid\'', [superid.id]);
    const g7 = criterion(await refresh(), 'G7');
    expect(g7.status).toBe('not-met');
    expect(g7.autoResult.items).toEqual([{ issue: 'Demo or sample account active', username: 'agent.demo' }, { issue: 'SUPERID user active', username: 'uat.super' },
      { issue: 'User ID and password sign-in on', username: null }]);
    await query('UPDATE users SET status = \'inactive\' WHERE username IN (\'agent.demo\', \'uat.super\')');
    await query('UPDATE app_settings SET value = \'false\' WHERE key = \'security.password_sign_in_enabled\'');
    clearSettingsCache();
    expect(criterion(await refresh(), 'G7').status).toBe('met');
  });

  it('G8: lists a legacy number of next year\'s series form and a migrated COC inside an unused COC range', async () => {
    expect(criterion(decision, 'G8').status).toBe('met');
    const next = Number(s.cutover.slice(0, 4)) + 1;
    const p = await one('SELECT id FROM policies WHERE origin = \'migrated\' LIMIT 1');
    await query('UPDATE policies SET policy_number = $2 WHERE id = $1', [p.id, `POL-${next}-00005`]);
    const g8 = criterion(await refresh(), 'G8');
    expect(g8.status).toBe('not-met');
    expect(g8.autoResult.items).toEqual([expect.objectContaining({ series: 'policy', number: `POL-${next}-00005`, periods: [String(next)] })]);
    const insurer = await one('SELECT id FROM insurance_companies WHERE code = \'MALAYAN\'');
    await query(`INSERT INTO coc_series(insurance_company_id, prefix, series_from, series_to, next_number, status, created_by) VALUES ($1, 'DC', 1000, 1999, 1000, 'active', 'test')`, [insurer.id]);
    await query('UPDATE policies SET insurance_company_id = $2, doc = jsonb_set(COALESCE(doc, \'{}\'), \'{certNumber}\', \'"DC1500"\') WHERE id = $1', [p.id, insurer.id]);
    const coc = criterion(await refresh(), 'G8');
    expect(coc.autoResult.items.map((i) => [i.series, i.number])).toEqual(expect.arrayContaining([['policy', `POL-${next}-00005`], ['coc', 'DC1500']]));
  });

  it('G9: CO-3 done with its evidence and the restore point recorded', async () => {
    const co3 = (await lead.api('get', `/data-load/runs/${run.id}/steps`)).body.data.steps.find((x) => x.code === 'CO-3');
    expect(criterion(await refresh(), 'G9').autoResult.items.map((i) => i.issue)).toEqual(['CO-3 not done', 'Restore point not recorded']);
    await query('UPDATE migration_run_steps SET status = \'done\' WHERE id = $1', [co3.id]);
    expect(criterion(await refresh(), 'G9').autoResult.items.map((i) => i.issue)).toEqual(['CO-3 has no evidence file', 'Restore point not recorded']);
    expect((await lead.api('post', '/data-load/evidence').field('ownerType', 'step').field('ownerId', String(co3.id)).attach('file', PDF, 'cutover-log.pdf')).status).toBe(201);
    expect((await lead.api('put', `/data-load/runs/${run.id}`).send({ restorePoint: new Date().toISOString() })).status).toBe(200);
    expect(criterion(await refresh(), 'G9').status).toBe('met');
  });

  it('G11: met only with the SHA-256 of a downloaded evidence pack of the run and the archive reference', async () => {
    expect(criterion(await refresh(), 'G11').status).toBe('not-met');
    const fake = 'a'.repeat(64);
    const refused = await lead.api('put', `/data-load/runs/${run.id}`).send({ evidencePackSha256: fake, archiveRef: 'ARCH-1' });
    expect(refused.status).toBe(400);
    const pack = await lead.api('get', `/data-load/runs/${run.id}/evidence-pack`).buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(pack.status).toBe(200);
    const sha = pack.headers['x-content-sha256'];
    expect((await lead.api('put', `/data-load/runs/${run.id}`).send({ evidencePackSha256: sha })).status).toBe(200);
    expect(criterion(await refresh(), 'G11').autoResult.items.map((i) => i.issue)).toEqual(['Archive reference not recorded']);
    expect((await lead.api('put', `/data-load/runs/${run.id}`).send({ archiveRef: 'TISPH-ARCH-2026-0042' })).status).toBe(200);
    expect(criterion(await refresh(), 'G11').status).toBe('met');
  });
});

describe('waivers, voting and the outcome', () => {
  it('G2 to G5 are never waived; a waiver needs approval, a reason and another user than the creator', async () => {
    for (const code of ['G2', 'G3', 'G4', 'G5']) {
      const r = await setCriterion(owner, code, { status: 'waived', waiverReason: 'Sponsor approval' });
      expect(r.status, code).toBe(409);
      expect(r.body.message).toBe(`${code} may not be waived`);
    }
    expect((await setCriterion(loader, 'G8', { status: 'waived', waiverReason: 'x' })).status).toBe(403);
    expect((await setCriterion(lead, 'G8', { status: 'waived', waiverReason: 'x' })).status).toBe(403);
    expect((await setCriterion(owner, 'G8', { status: 'waived' })).status).toBe(400);
    expect((await setCriterion(owner, 'G8', { status: 'met' })).status).toBe(403);
    expect((await setCriterion(lead, 'G8', { status: 'met' })).status).toBe(409);
    const w = await setCriterion(owner, 'G8', { status: 'waived', waiverReason: 'Policy series moves to POL-2028 by the Numbering sheet before go-live' });
    expect(w.status).toBe(200);
    expect(criterion(w.body.data, 'G8')).toMatchObject({ status: 'waived', waivedBy: 'dec.owner' });
    expect(criterion(await refresh(), 'G8').status).toBe('waived');
  });

  it('voting opens only once every criterion is met or waived', async () => {
    const early = await lead.api('post', `/data-load/decisions/${decision.id}/open-voting`);
    expect(early.status).toBe(409);
    expect(early.body.message).toMatch(/G1, G5, G10/);
    for (const code of ['G1', 'G5', 'G10']) expect((await setCriterion(lead, code, { status: 'met', evidence: `Signed sheet ${code}` })).status).toBe(200);
    const open = await lead.api('post', `/data-load/decisions/${decision.id}/open-voting`);
    expect(open.status, JSON.stringify(open.body)).toBe(200);
    expect(open.body.data.status).toBe('voting');
    expect((await setCriterion(lead, 'G1', { status: 'not-met' })).status).toBe(409);
    const note = await one('SELECT count(*)::int AS n FROM notifications WHERE entity = \'go_live_decision\' AND entity_id = $1 AND user_id = ANY($2)', [String(decision.id), [finance.id, owner.id]]);
    expect(note.n).toBe(2);
  });

  it('only the named approvers vote, once; all Go makes the decision Go and the lock may be requested', async () => {
    expect((await approver.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'go' })).status).toBe(403);
    expect((await lead.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'go' })).status).toBe(403);
    expect((await finance.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'maybe' })).status).toBe(400);
    const one1 = await finance.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'go', remarks: 'Trial balance agrees' });
    expect(one1.status).toBe(200);
    expect(one1.body.data.status).toBe('voting');
    expect((await finance.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'go' })).status).toBe(409);
    const two = await owner.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'go' });
    expect(two.status).toBe(200);
    expect(two.body).toMatchObject({ message: 'Decision: Go', data: { status: 'go', decidedAt: expect.any(String) } });
    const goLive = (await lead.api('get', '/data-load/golive')).body.data;
    expect(goLive.conditions.find((c) => c.code === 'go-decision').met).toBe(true);
    const actions = (await query('SELECT action FROM audit_log WHERE entity = \'go_live_decision\' AND entity_id = $1 ORDER BY id', [String(decision.id)])).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['create', 'waive', 'criterion', 'open-voting', 'vote', 'go']));
  });

  it('a No-Go gives the reason, the actions and the new date and ends the decision at once', async () => {
    const d = await lead.api('post', '/data-load/decisions').send({ runId: run.id, approvers: [{ userId: finance.id, roleLabel: 'Finance Head' }, { userId: owner.id, roleLabel: 'Sponsor' }] });
    expect(d.status).toBe(201);
    decision = d.body.data;
    expect(criterion(decision, 'G8').status).toBe('not-met');
    await setCriterion(owner, 'G8', { status: 'waived', waiverReason: 'Series moved' });
    for (const code of ['G1', 'G5', 'G10']) await setCriterion(lead, code, { status: 'met' });
    expect((await lead.api('post', `/data-load/decisions/${decision.id}/open-voting`)).status).toBe(200);
    const bad = await owner.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'no-go' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((e) => e.path)).toEqual(['reason', 'actions', 'newDate']);
    const nogo = await owner.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'no-go', reason: 'Due to insurers differ', actions: 'Explain with the Finance Head',
      newDate: addDays(s.cutover, 7) });
    expect(nogo.status).toBe(200);
    expect(nogo.body.data).toMatchObject({ status: 'no-go', reason: 'Due to insurers differ', actions: 'Explain with the Finance Head', newDate: addDays(s.cutover, 7) });
    expect((await finance.api('post', `/data-load/decisions/${decision.id}/vote`).send({ vote: 'go' })).status).toBe(409);
    expect((await lead.api('post', `/data-load/decisions/${decision.id}/withdraw`).send({ reason: 'x' })).status).toBe(409);
  });
});
