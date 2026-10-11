/**
 * Telesales incentive (TIS-BRD-COMM-08, FRS COMM-08; test pack TS-TSI-*): the program and its versions approved on
 * Configuration Approvals, callers and disqualification, call-out endorsement, attribution and eligibility of
 * policies, the monthly calculation (trigger, ANC level, base, additional, withholding tax, recovery, exclusion,
 * adjustment), approval with the accrual split, payment, statement, export, the job and the audit trail. The figures
 * are those of Appendix A of the FRS.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import {
  ancOf, bandProblems, cleanBands, cleanTiers, excessIncentive, levelOf, lineTotals, tierProblems, toNextBand, callerProgress, telesalesJob,
} from '../src/modules/incentive/telesales.js';

const TIERS = [{ ancFrom: 2500, nbAmount: 300, renewalAmount: 150 }, { ancFrom: 4000, nbAmount: 500, renewalAmount: 250 }, { ancFrom: 6000, nbAmount: 700, renewalAmount: 350 },
  { ancFrom: 8000, nbAmount: 900, renewalAmount: 450 }, { ancFrom: 10000, nbAmount: 1100, renewalAmount: 550 }];
const BANDS = [{ over: 30, every: 5, amount: 2000 }, { over: 50, every: 5, amount: 3000 }, { over: 75, every: 2, amount: 4000 }, { over: 100, every: 2, amount: 5000 }];
const MOTOR = 2;
const CTPL = 3;
const PA = 6;
const APEX = 9;
const PIONEER = 10;

let ctx;
const tok = {};
const ids = {};
let program;
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const q = (sql, params) => pool.query(sql, params);
let seq = 0;

/**
 * n policies of a caller on endorsed prospects: quoted the day after the endorsement, fully paid and settled on the
 * dates given (an approved remittance), net commission each, NB or renewal.
 */
async function policies(caller, n, { net, kind = 'NB', paid, settled, insurer = APEX, product = MOTOR, endorse = true, quotedAt = '2026-09-02T02:00:00Z', endorsedAt = '2026-09-01T02:00:00Z', status = 'active', payment = 'Completed' }) {
  const out = [];
  const rm = `rm_ts_${(seq += 1)}`;
  await q(`INSERT INTO remittances(id, remittance_number, insurance_company_id, kind, status, approved_at, period) VALUES ($1,$1,$2,'agency-bill',$3,$4,'2026-09')`,
    [rm, insurer, settled ? 'approved' : 'draft', settled ? `${settled}T03:00:00Z` : null]);
  for (let i = 0; i < n; i += 1) {
    seq += 1;
    const lead = `ld_ts_${seq}`;
    await q('INSERT INTO leads(id, lead_number, display_name, owner_user_id, status, lob) VALUES ($1,$2,$3,$4,\'Contacted\',\'MOTOR\')', [lead, `LD-TS-${seq}`, `Prospect ${seq}`, ids[caller]]);
    if (endorse) await q('INSERT INTO callout_endorsements(lead_id, caller_user_id, endorsed_by, endorsed_at) VALUES ($1,$2,$3,$4)', [lead, ids[caller], ids.leader, endorsedAt]);
    await q('INSERT INTO quotes(id, quote_number, lead_id, product_id, insurance_company_id, agent_user_id, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,\'converted\',$7)',
      [`qt_ts_${seq}`, `QT-TS-${seq}`, lead, product, insurer, ids[caller], quotedAt]);
    await q(`INSERT INTO policies(id, policy_number, quote_id, lead_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, premium_total, commission_amount,
        renewed_from, payment_status, paid_at, issued_date, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'2026-09-05','2027-09-05',30000,$9,$10,$11,$12,'2026-09-03',$13)`,
    [`pol_ts_${seq}`, `POL-TS-${String(seq).padStart(4, '0')}`, `qt_ts_${seq}`, lead, product, insurer, ids[caller], status, net, kind === 'Renewal' ? 'pol_crs_01' : null, payment,
      paid ? `${paid}T03:00:00Z` : null, quotedAt]);
    await q('INSERT INTO remittance_lines(remittance_id, policy_id, commission, premium) VALUES ($1,$2,$3,30000)', [rm, `pol_ts_${seq}`, net]);
    out.push(`pol_ts_${seq}`);
  }
  return out;
}

beforeAll(async () => {
  ctx = await setup();
  const users = [['ts.leader', 'Marco Villanueva', ['tis-sales-officer']], ['ts.head', 'Sales Head', ['tis-sales-unit-head']], ['ts.acct', 'Accounting User', ['accounting']],
    ['ts.acct2', 'Second Accountant', ['accounting']], ['ts.writer', 'Incentive Writer', ['inc-writer']], ['ts.geralyn', 'Geralyn Ramos', ['sales']], ['ts.anna', 'Anna Cruz', ['sales']],
    ['ts.novy', 'Novy Castillo', ['sales']], ['ts.vincent', 'Vincent Lim', ['sales']], ['ts.jose', 'Jose Bautista', ['sales']], ['ts.cris', 'Cris Net', ['sales']],
    ['ts.clerk', 'Accounting Only', ['accounting']], ['ts.sales', 'Plain Sales', ['sales']]];
  await ctx.api('post', '/roles').send({ code: 'inc-writer', name: 'Incentive writer (test)', permissions: ['read:incentive', 'write:incentive', 'read:profile'] });
  for (const [username, displayName, roles] of users) {
    const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, roles });
    ids[username.slice(3)] = r.body.data.userId || r.body.data.id;
    tok[username.slice(3)] = await loginAs(ctx.app, username, 'Welcome@123');
  }
  tok.admin = ctx.token;
});
afterAll(async () => { await pool.end(); });

describe('rules of the program tables (FR-TSI-002, 003, 022, 032 to 034)', () => {
  const tiers = cleanTiers(TIERS);
  const bands = cleanBands(BANDS);
  it('finds the level of an ANC on the boundaries and below level 1', () => {
    expect(levelOf(tiers, 4000)).toBe(2);
    expect(levelOf(tiers, 3999.99)).toBe(1);
    expect(levelOf(tiers, 10250)).toBe(5);
    expect(levelOf(tiers, 2180)).toBeNull();
    expect(ancOf(62481.60, 16)).toBe(3905.10);
    expect(ancOf(0, 0)).toBe(0);
  });
  it('pays the production excess banded or on the highest band only (Appendix A.5)', () => {
    const rows = [[30, 0, 0], [35, 2000, 2000], [37, 2000, 2000], [50, 8000, 8000], [52, 8000, 0], [58, 11000, 3000], [76, 23000, 0], [104, 81000, 10000]];
    for (const [n, banded, highest] of rows) {
      expect(excessIncentive(bands, n, 'banded')).toBe(banded);
      expect(excessIncentive(bands, n, 'highest_band')).toBe(highest);
    }
    expect(excessIncentive([], 104)).toBe(0);
    expect(toNextBand(bands, 31)).toBe(4);
  });
  it('deducts withholding tax on a positive gross and carries a negative gross', () => {
    expect(lineTotals({ base: 48600, additional: 11000, whtPct: 5 })).toEqual({ gross: 59600, tax: 2980, total: 56620, carried: 0 });
    expect(lineTotals({ base: 4200, recovery: -300, whtPct: 5 })).toEqual({ gross: 3900, tax: 195, total: 3705, carried: 0 });
    expect(lineTotals({ recovery: -1100, whtPct: 5 })).toEqual({ gross: -1100, tax: 0, total: 0, carried: 1100 });
  });
  it('checks the tier table with the FRS messages', () => {
    expect(tierProblems([]).errors[0]).toMatchObject({ message: 'Add at least one ANC level', code: 'MSG-TSI-010' });
    const bad = cleanTiers([TIERS[0], TIERS[1], { ancFrom: 6000, nbAmount: 700, renewalAmount: 800 }]);
    expect(tierProblems(bad).errors[0].message).toBe('Level 3: the renewal amount cannot be higher than the new-business amount');
    expect(tierProblems(cleanTiers([{ ancFrom: 4000, nbAmount: 300 }, { ancFrom: 3500, nbAmount: 500 }])).errors[0].message).toBe('Level 2: ANC from must be higher than level 1');
    expect(tierProblems(cleanTiers([{ ancFrom: 4000, nbAmount: 0 }])).errors[0].code).toBe('MSG-TSI-012');
    expect(tierProblems(cleanTiers([{ ancFrom: 4000, nbAmount: 300, renewalAmount: 300 }])).warnings[0].code).toBe('MSG-TSI-014');
    expect(tierProblems(cleanTiers(Array.from({ length: 11 }, (_, i) => ({ ancFrom: 1000 * (i + 1), nbAmount: 100 })))).errors[0].code).toBe('MSG-TSI-015');
    expect(tierProblems(cleanTiers(TIERS)).errors).toEqual([]);
  });
  it('checks the production-excess table', () => {
    expect(bandProblems(cleanBands([{ over: 10, every: 5, amount: 2000 }]), 15).errors[0].message).toBe('The first band must start at or above the minimum of 15 policies');
    expect(bandProblems(cleanBands([{ over: 30, every: 0, amount: 2000 }]), 15).errors[0].code).toBe('MSG-TSI-018');
    expect(bandProblems(cleanBands([{ over: 30, every: 5, amount: 2000 }, { over: 30, every: 5, amount: 1 }]), 15).errors[0].code).toBe('MSG-TSI-016');
    expect(bandProblems(cleanBands([{ over: 30, every: 5, amount: 0 }]), 15).errors[0].code).toBe('MSG-TSI-019');
    expect(bandProblems([], 15).errors).toEqual([]);
  });
});

describe('program and versions (FR-TSI-001, 002, 003, 005)', () => {
  it('offers the delivered defaults and creates version 1 in Draft with the fixed metric and frequency', async () => {
    const d = await as('admin', 'get', '/incentive/telesales/defaults');
    expect(d.status).toBe(200);
    expect(d.body.data).toMatchObject({ minPolicies: 15, whtPct: 5, excessMethod: 'banded' });
    expect(d.body.data.tiers.map((t) => t.ancTo)).toEqual([3999.99, 5999.99, 7999.99, 9999.99, null]);
    expect(d.body.data.bands.map((b) => b.upTo)).toEqual([50, 75, 100, null]);
    const r = await as('admin', 'post', '/incentive/programs').send({ programType: 'Telesales', programCode: 'TSI-2026-001', programName: 'Telesales Incentive Program',
      products: [MOTOR, CTPL], effectiveFrom: '2026-04-01' });
    expect(r.status).toBe(201);
    program = r.body.data;
    expect(program).toMatchObject({ programType: 'Telesales', targetMetric: 'Average Net Commission (ANC)', calculationFrequency: 'Monthly', applicableTo: ['Telesales caller'], status: 'Draft' });
    expect(program.open).toMatchObject({ version: 1, status: 'Draft', minPolicies: 15, whtPct: 5, effectiveFrom: '2026-04-01' });
    expect(program.open.tiers).toHaveLength(5);
    const list = await as('admin', 'get', '/incentive/programs');
    expect(list.body.data.find((p) => p.programCode === 'TSI-2026-001')).toMatchObject({ isTelesales: true, minPolicies: 15, versionLabel: 'v1 Draft' });
  });
  it('refuses a missing name, a product that is not Motor, a minimum, a tax and a month out of range', async () => {
    const bad = async (body) => (await as('admin', 'post', '/incentive/telesales/programs').send({ programName: 'X', products: [MOTOR], effectiveFrom: '2027-01-01', ...body })).body.errors;
    expect((await bad({ programName: ' ' }))[0]).toMatchObject({ code: 'MSG-TSI-001' });
    expect((await bad({ products: [PA] }))[0]).toMatchObject({ path: 'products', message: 'Telesales programs apply to Motor products only' });
    expect((await bad({ products: [] }))[0].code).toBe('MSG-TSI-002');
    expect((await bad({ minPolicies: 0 }))[0].message).toBe('Minimum policies to qualify must be a whole number from 1 to 999');
    expect((await bad({ minPolicies: 15.5 }))[0].code).toBe('MSG-TSI-004');
    expect((await bad({ whtPct: 100.5 }))[0].message).toBe('Withholding tax % must be between 0.00 and 100.00');
    expect((await bad({ effectiveFrom: '2027-01-15' }))[0].message).toBe('Effective from must be the first day of a month');
    expect((await bad({ tiers: [TIERS[0], TIERS[1], { ancFrom: 6000, nbAmount: 700, renewalAmount: 800 }] })).map((e) => e.message))
      .toContain('Level 3: the renewal amount cannot be higher than the new-business amount');
    expect((await bad({ bands: [{ over: 10, every: 5, amount: 2000 }] }))[0].message).toBe('The first band must start at or above the minimum of 15 policies');
    // a sales user cannot keep programs
    expect((await as('geralyn', 'post', '/incentive/telesales/programs').send({ programName: 'X' })).status).toBe(403);
  });
  it('saves the Draft and submits it to Configuration Approvals, where its maker cannot approve it', async () => {
    const s = await as('admin', 'put', `/incentive/telesales/programs/${program.id}`).send({ tiers: TIERS, bands: BANDS });
    expect(s.status).toBe(200);
    expect(s.body.data.open.tiers[2]).toMatchObject({ level: 3, ancFrom: 6000, ancTo: 7999.99, nbAmount: 700, renewalAmount: 350 });
    const sub = await as('admin', 'post', `/incentive/telesales/programs/${program.id}/submit`).send({});
    expect(sub.status).toBe(200);
    expect(sub.body.message).toBe('Program version submitted for approval');
    expect(sub.body.data.open.status).toBe('Pending approval');
    // a version pending approval is not edited
    expect((await as('admin', 'put', `/incentive/telesales/programs/${program.id}`).send({ minPolicies: 20 })).body.message).toBe('Version 1 of TSI-2026-001 is already in Draft or Pending approval');
    const changes = await as('head', 'get', '/posting-rules/changes');
    const change = changes.body.data.find((c) => c.kind === 'incentive-program');
    expect(change).toMatchObject({ kindLabel: 'Incentive program version', target: 'Incentive program TSI-2026-001 version 1', permission: 'approve:incentive' });
    expect(change.payload.tiers[0]).toBe('Level 1: ANC 2,500.00 to 3,999.99, NB 300.00, renewal 150.00');
    expect((await as('admin', 'post', `/posting-rules/changes/${change.id}/approve`).send({})).status).toBe(403);
    // Return: back to Draft with the remark; then submitted again and approved by the Sales Head
    const ret = await as('head', 'post', `/posting-rules/changes/${change.id}/reject`).send({ remarks: 'Check the renewal amounts' });
    expect(ret.status).toBe(200);
    let p = (await as('admin', 'get', `/incentive/telesales/programs/${program.id}`)).body.data;
    expect(p.open).toMatchObject({ status: 'Draft', returnRemark: 'Check the renewal amounts' });
    await as('admin', 'post', `/incentive/telesales/programs/${program.id}/submit`).send({});
    const id2 = (await as('head', 'get', '/posting-rules/changes')).body.data.find((c) => c.kind === 'incentive-program').id;
    const ok = await as('head', 'post', `/posting-rules/changes/${id2}/approve`).send({ remarks: 'Approved per ExCom' });
    expect(ok.status).toBe(200);
    p = (await as('admin', 'get', `/incentive/telesales/programs/${program.id}`)).body.data;
    expect(p.status).toBe('Active');
    expect(p.current).toMatchObject({ version: 1, displayStatus: 'In force', approvedBy: 'Sales Head' });
    expect(p.open).toBeNull();
  });
  it('refuses a second Telesales program in force in the same month', async () => {
    const r = await as('admin', 'post', '/incentive/telesales/programs').send({ programName: 'Second', products: [MOTOR], effectiveFrom: '2026-10-01' });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].message).toBe('Telesales program TSI-2026-001 is already in force for October 2026');
  });
});

describe('callers (FR-TSI-004)', () => {
  it('adds callers of an incentive role with an insurance partner and a Team Leader who can endorse', async () => {
    for (const c of ['geralyn', 'anna', 'novy', 'vincent', 'jose', 'cris']) {
      const r = await as('admin', 'post', `/incentive/telesales/programs/${program.id}/callers`).send({ userId: ids[c], insuranceCompanyId: APEX, teamLeaderId: ids.leader, dateFrom: '2026-04-01' });
      expect(r.status).toBe(201);
      ids[`row_${c}`] = r.body.data.id;
    }
    const p = (await as('admin', 'get', `/incentive/telesales/programs/${program.id}`)).body.data;
    expect(p.callers.find((c) => c.name === 'Geralyn Ramos')).toMatchObject({ insurer: expect.any(String), teamLeader: 'Marco Villanueva', status: 'Active', dateFrom: '2026-04-01' });
  });
  it('refuses a user without an incentive role, a caller twice and a Team Leader without the permission', async () => {
    const add = (body) => as('admin', 'post', `/incentive/telesales/programs/${program.id}/callers`).send({ insuranceCompanyId: APEX, teamLeaderId: ids.leader, dateFrom: '2026-04-01', ...body });
    expect((await add({ userId: ids.clerk })).body.errors[0]).toMatchObject({ code: 'MSG-TSI-020', message: 'Accounting Only does not have a role that takes part in incentives' });
    expect((await add({ userId: ids.geralyn })).body.errors[0].message).toBe('Geralyn Ramos is already an active caller from 01/04/2026');
    expect((await add({ userId: ids.sales, teamLeaderId: ids.novy })).body.errors[0].message).toBe('Novy Castillo cannot endorse call-out leads');
  });
  it('disqualifies with a reason and a remark (approve:incentive); the user who disqualified cannot reinstate', async () => {
    const url = `/incentive/telesales/callers/${ids.row_jose}`;
    expect((await as('admin', 'post', `${url}/disqualify`).send({ date: '2026-08-01', reasonCode: 'TDQ-GRAB' })).body.errors[0].message)
      .toBe('A reason and a remark are required to disqualify a caller');
    expect((await as('leader', 'post', `${url}/disqualify`).send({ date: '2026-08-01', reasonCode: 'TDQ-GRAB', note: 'x' })).status).toBe(403);
    const d = await as('head', 'post', `${url}/disqualify`).send({ date: '2026-08-01', reasonCode: 'TDQ-GRAB', note: 'Took accounts of another caller' });
    expect(d.status).toBe(200);
    expect(d.body.message).toBe('Jose Bautista is disqualified from 01/08/2026');
    expect(d.body.data).toMatchObject({ status: 'Disqualified', disqualifiedFrom: '2026-08-01', disqualifyReason: 'Account grabbing: Took accounts of another caller' });
    expect((await as('head', 'post', `${url}/reinstate`).send({ note: 'Cleared' })).body.message).toBe('The user who disqualified a caller cannot reinstate the same caller');
  });
});

describe('call-out endorsement (FR-TSI-010)', () => {
  let lead;
  it('lets the Team Leader endorse a prospect of a caller of the team; others are skipped', async () => {
    lead = (await q('INSERT INTO leads(lead_number, display_name, owner_user_id, status, lob) VALUES (\'LD-TS-95102\', \'Jonacel Fabro\', $1, \'New\', \'MOTOR\') RETURNING id', [ids.geralyn])).rows[0].id;
    const other = (await q('INSERT INTO leads(lead_number, display_name, owner_user_id, status) VALUES (\'LD-TS-95103\', \'Other Prospect\', $1, \'New\') RETURNING id', [ids.clerk])).rows[0].id;
    expect((await as('sales', 'post', '/lead-assignment/callout/endorse').send({ leadIds: [lead] })).status).toBe(403);
    const r = await as('leader', 'post', '/lead-assignment/callout/endorse').send({ leadIds: [lead, other] });
    expect(r.status).toBe(200);
    expect(r.body.message).toBe('1 prospects endorsed as call-out leads');
    expect(r.body.data.skipped[0].reason).toBe('LD-TS-95103 is not assigned to a caller of your team');
    const team = await as('leader', 'get', `/lead-assignment/team?managerId=${ids.leader}`);
    expect(team.status).toBe(200);
    const hist = (await as('leader', 'get', `/lead-assignment/history/${lead}`)).body.data;
    expect(hist[0]).toMatchObject({ action: 'callout-endorse', reason: 'Endorsed as call-out lead for Geralyn Ramos' });
    const audit = await q('SELECT 1 FROM audit_log WHERE entity = \'callout_endorsement\' AND entity_id = $1 AND action = \'endorse\'', [lead]);
    expect(audit.rowCount).toBe(1);
  });
  it('refuses to withdraw once a quotation exists; withdraws with a reason before', async () => {
    expect((await as('leader', 'post', '/lead-assignment/callout/withdraw').send({ leadIds: [lead] })).status).toBe(400);
    await q('INSERT INTO quotes(quote_number, lead_id, product_id, agent_user_id) VALUES (\'QT-2026-777\', $1, $2, $3)', [lead, MOTOR, ids.geralyn]);
    const r = await as('leader', 'post', '/lead-assignment/callout/withdraw').send({ leadIds: [lead], reason: 'Wrong caller' });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].message).toBe('LD-TS-95102 already has quotation QT-2026-777; the endorsement cannot be withdrawn');
  });
  it('ends the endorsement when someone other than the Team Leader reassigns the prospect; moves it with the Team Leader', async () => {
    const l2 = (await q('INSERT INTO leads(lead_number, display_name, owner_user_id, status) VALUES (\'LD-TS-MOVE\', \'Move Me\', $1, \'New\') RETURNING id', [ids.geralyn])).rows[0].id;
    await as('leader', 'post', '/lead-assignment/callout/endorse').send({ leadIds: [l2] });
    const moved = await as('leader', 'post', '/lead-assignment/reassign').send({ leadIds: [l2], toUserId: ids.anna, reason: 'Balance the list' });
    expect(moved.status).toBe(200);
    let e = (await q('SELECT caller_user_id, status FROM callout_endorsements WHERE lead_id = $1 ORDER BY id', [l2])).rows;
    expect(e).toEqual([{ caller_user_id: ids.geralyn, status: 'moved' }, { caller_user_id: ids.anna, status: 'endorsed' }]);
    const ended = await as('admin', 'post', '/lead-assignment/reassign').send({ leadIds: [l2], toUserId: ids.novy, reason: 'Other' });
    expect(ended.status).toBe(200);
    e = (await q('SELECT status, end_reason FROM callout_endorsements WHERE lead_id = $1 ORDER BY id DESC LIMIT 1', [l2])).rows[0];
    expect(e.status).toBe('ended');
    expect(e.end_reason).toMatch(/not by the caller's Team Leader/);
  });
  it('lets only a Team Leader save a call-out rule; the rule endorses each prospect it assigns to a caller', async () => {
    const body = { name: 'Apex motor renewals to Geralyn', priority: 0, method: 'fixed', conditions: { lob: 'MOTOR' }, assignees: [ids.geralyn], callout: true };
    expect((await as('acct', 'post', '/lead-assignment/rules').send(body)).status).toBe(403);
    expect((await as('admin', 'post', '/lead-assignment/rules').send(body)).status).toBe(201);
    const rule = (await as('leader', 'get', '/lead-assignment/rules')).body.data.find((r) => r.callout);
    expect(rule).toMatchObject({ callout: true });
    const { assignNewLead } = await import('../src/modules/leads/assignment.js');
    const l3 = (await q('INSERT INTO leads(lead_number, display_name, status, lob) VALUES (\'LD-TS-RULE\', \'By Rule\', \'New\', \'MOTOR\') RETURNING id')).rows[0].id;
    await assignNewLead(pool, l3, ids.leader);
    const e = (await q('SELECT caller_user_id, status, rule_id FROM callout_endorsements WHERE lead_id = $1', [l3])).rows[0];
    expect(e).toMatchObject({ caller_user_id: ids.geralyn, status: 'endorsed', rule_id: rule.id });
    await q('UPDATE lead_assignment_rules SET status = \'inactive\' WHERE id = $1', [rule.id]);
  });
});

describe('monthly calculation (FR-TSI-011, 020 to 022, 030 to 037, 040 to 043)', () => {
  let aug;
  let sep;
  let annaAug;
  let geralynPols;
  it('calculates August: Anna qualifies at level 1, the disqualified caller earns nothing', async () => {
    annaAug = await policies('anna', 15, { net: 3000, paid: '2026-08-10', settled: '2026-08-20', quotedAt: '2026-08-02T02:00:00Z', endorsedAt: '2026-08-01T02:00:00Z' });
    await policies('jose', 16, { net: 5000, paid: '2026-08-10', settled: '2026-08-20', quotedAt: '2026-08-02T02:00:00Z', endorsedAt: '2026-08-01T02:00:00Z' });
    const r = await as('acct', 'post', '/incentive/calculations').send({ period: '2026-08', selectedPrograms: ['TSI-2026-001'] });
    expect(r.status).toBe(201);
    aug = r.body.data;
    expect(aug).toMatchObject({ isTelesales: true, status: 'Calculated', period: 'August 2026' });
    const anna = aug.details.find((d) => d.agentName === 'Anna Cruz');
    expect(anna).toMatchObject({ counted: 15, anc: 3000, level: 1, baseAmount: 4500, result: 'Qualified', taxAmount: 225, finalAmount: 4275 });
    expect(aug.details.find((d) => d.agentName === 'Jose Bautista')).toMatchObject({ result: 'Disqualified', finalAmount: 0, counted: 0 });
    const pols = (await as('acct', 'get', `/incentive/calculations/${aug.batchId}/policies?status=Disqualified`)).body.data;
    expect(pols).toHaveLength(16);
    await as('acct', 'post', `/incentive/calculations/${aug.batchId}/submit`);
    expect((await as('head', 'post', `/incentive/calculations/${aug.batchId}/approve`).send({})).status).toBe(200);
    // the August policy of Anna paid out at level 1 new business is cancelled on 18/09/2026
    await q('UPDATE policies SET status = \'cancelled\', status_changed_at = \'2026-09-18T03:00:00Z\' WHERE id = $1', [annaAug[0]]);
  });
  it('attributes policies quoted on an endorsed prospect and dates them (FR-TSI-011, 020, 021, 022)', async () => {
    geralynPols = [...await policies('geralyn', 31, { net: 6412.50, paid: '2026-09-12', settled: '2026-09-21' }),
      ...await policies('geralyn', 6, { net: 6412.50, kind: 'Renewal', paid: '2026-09-12', settled: '2026-09-21' })];
    await policies('anna', 12, { net: 3905.10, paid: '2026-09-12', settled: '2026-09-21' });
    await policies('anna', 4, { net: 3905.10, kind: 'Renewal', paid: '2026-09-12', settled: '2026-09-21' });
    await policies('novy', 12, { net: 5725.04, paid: '2026-09-12', settled: '2026-09-21' });
    await policies('novy', 2, { net: 5725.04, kind: 'Renewal', paid: '2026-09-12', settled: '2026-09-21' });
    await policies('vincent', 22, { net: 2180, paid: '2026-09-12', settled: '2026-09-21' });
    // late commission: paid 25/09, settled 06/10: October
    const late = await policies('geralyn', 1, { net: 6412.50, paid: '2026-09-25', settled: '2026-10-06' });
    // not fully paid, cancelled before payment, endorsed after the quotation, another insurer
    const partial = await policies('geralyn', 1, { net: 6412.50, payment: 'Partial', settled: '2026-09-21' });
    const cancelled = await policies('geralyn', 1, { net: 6412.50, payment: 'Pending', settled: '2026-09-21', status: 'cancelled' });
    await q('UPDATE policies SET status_changed_at = \'2026-09-10T03:00:00Z\' WHERE id = $1', [cancelled[0]]);
    const tooLate = await policies('geralyn', 1, { net: 6412.50, paid: '2026-09-12', settled: '2026-09-21', endorsedAt: '2026-09-22T02:00:00Z', quotedAt: '2026-09-21T02:00:00Z' });
    const pioneer = await policies('geralyn', 1, { net: 6412.50, paid: '2026-09-12', settled: '2026-09-21', insurer: PIONEER });
    // net commission less the referrer share: 5,600.00 - 560.00 = 5,040.00
    const [shared] = await policies('cris', 1, { net: 5600, paid: '2026-09-12', settled: '2026-09-21' });
    await q('INSERT INTO commissions(id, policy_id, referrer_id, basis_amount, rate, amount, net_amount, status) VALUES (\'com_ts_1\', $1, \'ref-toyotamakati\', 5600, 10, 560, 560, \'Accrued\')', [shared]);
    const { syncTelesalesPolicies, policyLink } = await import('../src/modules/incentive/telesales.js');
    await syncTelesalesPolicies({ asOf: '2026-10-11' });
    expect(await policyLink(geralynPols[0])).toMatchObject({ telesales: true, caller: 'Geralyn Ramos', kind: 'NB', fullyPaidOn: '2026-09-12', commissionSettledOn: '2026-09-21',
      eligibleOn: '2026-09-21', netCommission: 6412.5, label: 'Telesales: Geralyn Ramos, call-out endorsed 01/09/2026' });
    expect((await policyLink(geralynPols[36])).kind).toBe('Renewal');
    expect((await policyLink(late[0])).eligibleOn).toBe('2026-10-06');
    expect((await policyLink(partial[0])).eligibleOn).toBeNull();
    expect((await policyLink(cancelled[0])).eligibleOn).toBeNull();
    expect((await policyLink(tooLate[0])).telesales).toBe(false);
    expect((await policyLink(pioneer[0])).telesales).toBe(false);
    expect((await policyLink(shared)).netCommission).toBe(5040);
    const link = await as('geralyn', 'get', `/incentive/telesales/policies/${geralynPols[0]}`);
    expect(link.status).toBe(200);
  });
  it('refuses a month that has not ended and a program without an approved version (FR-TSI-030)', async () => {
    const now = new Date().toISOString().slice(0, 7);
    const r = await as('acct', 'post', '/incentive/calculations').send({ period: now, selectedPrograms: ['TSI-2026-001'] });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].message).toMatch(/^The month of .* has not ended yet$/);
    const early = await as('acct', 'post', '/incentive/calculations').send({ period: '2026-03', selectedPrograms: ['TSI-2026-001'] });
    expect(early.body.errors[0].message).toBe('TSI-2026-001 has no approved version for March 2026');
    expect((await as('acct', 'post', '/incentive/calculations').send({ period: '2026-08', selectedPrograms: ['TSI-2026-001'] })).body.message)
      .toBe('TSI-2026-001 is already calculated for August 2026 (batch Approved)');
  });
  it('calculates September as Appendix A: trigger, level, base, additional, recovery, tax', async () => {
    const r = await as('acct', 'post', '/incentive/calculations').send({ period: '2026-09', selectedPrograms: ['TSI-2026-001'] });
    expect(r.status).toBe(201);
    expect(r.body.message).toBe('Calculation complete');
    sep = r.body.data;
    const line = (n) => sep.details.find((d) => d.agentName === n);
    expect(line('Geralyn Ramos')).toMatchObject({ counted: 37, nbCount: 31, renewalCount: 6, anc: 6412.5, level: 3, baseAmount: 23800, additionalAmount: 2000, grossAmount: 25800,
      taxAmount: 1290, finalAmount: 24510, result: 'Qualified', tier: 'Level 3' });
    expect(line('Anna Cruz')).toMatchObject({ counted: 16, nbCount: 12, renewalCount: 4, anc: 3905.1, level: 1, baseAmount: 4200, recoveryAmount: -300, grossAmount: 3900, taxAmount: 195, finalAmount: 3705 });
    expect(line('Novy Castillo')).toMatchObject({ counted: 14, result: 'Not qualified (14 < 15)', finalAmount: 0, baseAmount: 0 });
    expect(line('Vincent Lim')).toMatchObject({ counted: 22, anc: 2180, level: null, result: 'Below level 1', baseAmount: 0, additionalAmount: 0, finalAmount: 0 });
    expect(line('Jose Bautista')).toMatchObject({ result: 'Disqualified', finalAmount: 0 });
    const statuses = (await as('acct', 'get', `/incentive/calculations/${sep.batchId}/policies?callerId=${ids.geralyn}`)).body.data.map((p) => p.status);
    expect(statuses.filter((s) => s === 'Counted')).toHaveLength(37);
    expect(statuses).toEqual(expect.arrayContaining(['Not fully paid', 'Cancelled', 'Not a call-out lead']));
    const rec = (await as('acct', 'get', `/incentive/calculations/${sep.batchId}/policies?status=Recovery`)).body.data;
    expect(rec).toHaveLength(1);
    expect(rec[0]).toMatchObject({ caller: 'Anna Cruz', amount: -300, netCommission: -300 });
    expect(sep.executionLog.map((l) => l.step)).toEqual(expect.arrayContaining(['Calculation started', 'Version 1 in force', 'Calculation complete']));
    // a second calculation of the month is refused while the batch is Calculated
    expect((await as('acct', 'post', '/incentive/calculations').send({ period: '2026-09', selectedPrograms: ['TSI-2026-001'] })).status).toBe(409);
  });
  it('excludes a policy with a reason and a remark and recalculates the caller; includes it again (FR-TSI-035)', async () => {
    const url = `/incentive/calculations/${sep.batchId}/policies/${geralynPols[0]}`;
    expect((await as('acct', 'post', `${url}/exclude`).send({ reasonCode: 'TEX-GRAB' })).body.errors[0].message).toBe('A reason and a remark are required to exclude a policy');
    const r = await as('acct', 'post', `${url}/exclude`).send({ reasonCode: 'TEX-GRAB', note: 'Prospect of another caller' });
    expect(r.status).toBe(200);
    expect(r.body.message).toMatch(/^Policy POL-TS-\d+ excluded; Geralyn Ramos recalculated$/);
    let b = (await as('acct', 'get', `/incentive/calculations/${sep.batchId}`)).body.data;
    expect(b.details.find((d) => d.agentName === 'Geralyn Ramos')).toMatchObject({ counted: 36, additionalAmount: 2000, baseAmount: 23100 });
    expect((await q('SELECT 1 FROM audit_log WHERE entity = \'incentive_policy\' AND entity_id = $1 AND action = \'exclude\'', [geralynPols[0]])).rowCount).toBe(1);
    // recalculation keeps the exclusion
    await as('acct', 'post', `/incentive/calculations/${sep.batchId}/recalculate`);
    b = (await as('acct', 'get', `/incentive/calculations/${sep.batchId}`)).body.data;
    expect(b.details.find((d) => d.agentName === 'Geralyn Ramos').counted).toBe(36);
    expect((await as('acct', 'post', `${url}/include`)).status).toBe(200);
    b = (await as('acct', 'get', `/incentive/calculations/${sep.batchId}`)).body.data;
    expect(b.details.find((d) => d.agentName === 'Geralyn Ramos')).toMatchObject({ counted: 37, finalAmount: 24510 });
  });
  it('adjusts a line with a reason: the adjustment is part of the gross and taxed (FR-TSI-037)', async () => {
    const line = (await as('acct', 'get', `/incentive/calculations/${sep.batchId}`)).body.data.details.find((d) => d.agentName === 'Geralyn Ramos');
    expect((await as('acct', 'post', `/incentive/calculations/${sep.batchId}/adjust`).send({ lines: [{ id: line.id, adjustments: 500 }] })).status).toBe(400);
    const r = await as('acct', 'post', `/incentive/calculations/${sep.batchId}/adjust`).send({ lines: [{ id: line.id, adjustments: 500 }], reasonCode: 'IAD-MGMT', note: 'Late commission settlement, agreed by Sales Head' });
    expect(r.status).toBe(200);
    expect(r.body.data.details.find((d) => d.agentName === 'Geralyn Ramos')).toMatchObject({ grossAmount: 26300, taxAmount: 1315, finalAmount: 24985 });
    // kept on recalculation
    await as('acct', 'post', `/incentive/calculations/${sep.batchId}/recalculate`);
    const b = (await as('acct', 'get', `/incentive/calculations/${sep.batchId}`)).body.data;
    expect(b.details.find((d) => d.agentName === 'Geralyn Ramos')).toMatchObject({ adjustments: 500, finalAmount: 24985 });
    // back to the Appendix figures for the approval
    await as('acct2', 'post', `/incentive/calculations/${sep.batchId}/adjust`).send({ lines: [{ id: b.details.find((d) => d.agentName === 'Geralyn Ramos').id, adjustments: 0 }], reasonCode: 'IAD-MGMT', note: 'Reversed' });
  });
  it('is approved only with approve:incentive by another user, posting the accrual with the withholding tax (FR-TSI-040, 041)', async () => {
    expect((await as('acct', 'post', `/incentive/calculations/${sep.batchId}/submit`)).status).toBe(200);
    expect((await as('writer', 'post', `/incentive/calculations/${sep.batchId}/approve`).send({})).status).toBe(403);
    expect((await as('acct', 'post', `/incentive/calculations/${sep.batchId}/approve`).send({})).status).toBe(403);
    // exclusion is refused once the batch is pending approval
    expect((await as('acct', 'post', `/incentive/calculations/${sep.batchId}/policies/${geralynPols[1]}/exclude`).send({ reasonCode: 'TEX-GRAB', note: 'x' })).body.message)
      .toBe(`Batch ${sep.batchId} is Pending Approval; policies can no longer be excluded`);
    const a = await as('head', 'post', `/incentive/calculations/${sep.batchId}/approve`).send({ remarks: 'Checked' });
    expect(a.status).toBe(200);
    expect(a.body.message).toBe('Batch approved');
    const b = (await as('acct', 'get', `/incentive/calculations/${sep.batchId}`)).body.data;
    expect(b).toMatchObject({ status: 'Approved', grossTotal: 29700, taxTotal: 1485, totalAmount: 28215 });
    const jv = (await q(`SELECT l.debit, l.credit, l.account_code FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      WHERE j.reference_id = $1 AND j.entry_type = 'INCENTIVE_ACCRUAL' ORDER BY l.debit DESC, l.credit DESC`, [sep.batchId])).rows;
    expect(jv.map((l) => [Number(l.debit), Number(l.credit)])).toEqual([[29700, 0], [0, 28215], [0, 1485]]);
    const pay = await as('acct', 'post', `/incentive/calculations/${sep.batchId}/pay`).send({ paymentDate: '2026-10-11', paymentReference: 'PV-2026-00412' });
    expect(pay.status).toBe(200);
    expect(pay.body.data.status).toBe('Paid');
  });
  it('shows the caller statement and exports the batch (FR-TSI-042)', async () => {
    const s = await as('anna', 'get', '/incentive/statement?period=2026-09');
    expect(s.status).toBe(200);
    expect(s.body.data.programBreakdown.find((l) => l.isTelesales)).toMatchObject({ counted: 16, nbCount: 12, renewalCount: 4, anc: 3905.1, level: 1, baseAmount: 4200,
      recoveryAmount: -300, taxAmount: 195, earnedAmount: 3705, notApproved: false });
    expect((await as('anna', 'get', `/incentive/statement?period=2026-09&agentId=${ids.geralyn}`)).status).toBe(403);
    const x = await as('acct', 'get', `/incentive/calculations/${sep.batchId}/export`);
    expect(x.status).toBe(200);
    expect(x.headers['content-type']).toMatch(/spreadsheetml/);
  });
  it('shows My Programs month to date and runs the job on the run day, carrying a recovery larger than the gross (FR-TSI-030, 036)', async () => {
    await policies('anna', 11, { net: 3000, paid: '2026-10-02', settled: '2026-10-05', quotedAt: '2026-10-01T02:00:00Z', endorsedAt: '2026-09-30T02:00:00Z' });
    const [mine] = await callerProgress(ids.anna, { asOf: '2026-10-20' });
    expect(mine).toMatchObject({ programCode: 'TSI-2026-001', counted: 11, toMinimum: 4, message: '4 more to qualify', level: 1 });
    // a September policy of Anna, paid out at level 1 new business, is cancelled on 10/10/2026
    const annaSep = (await q(`SELECT policy_id FROM telesales_policies WHERE caller_user_id = $1 AND counted_period = '2026-09' AND kind = 'NB' AND paid_amount = 300 LIMIT 1`, [ids.anna])).rows[0].policy_id;
    await q('UPDATE policies SET status = \'cancelled\', status_changed_at = \'2026-10-10T03:00:00Z\' WHERE id = $1', [annaSep]);
    expect((await telesalesJob({ asOf: '2026-11-04' })).skipped).toBe('Not the run day (5)');
    const run = await telesalesJob({ asOf: '2026-11-05' });
    expect(run.calculated).toHaveLength(1);
    const oct = (await as('acct', 'get', `/incentive/calculations/${run.calculated[0]}`)).body.data;
    expect(oct).toMatchObject({ status: 'Calculated', triggeredBy: 'job', period: 'October 2026' });
    expect(oct.details.find((d) => d.agentName === 'Anna Cruz')).toMatchObject({ counted: 11, result: 'Not qualified (11 < 15)', recoveryAmount: -300, grossAmount: -300, finalAmount: 0, carriedForward: 300 });
    expect(oct.details.find((d) => d.agentName === 'Geralyn Ramos').counted).toBe(1);
    expect((await telesalesJob({ asOf: '2026-11-05' })).skipped[0]).toMatch(/October 2026 already has batch/);
    expect((await q('SELECT 1 FROM audit_log WHERE entity = \'incentive_calculation\' AND entity_id = $1 AND action = \'calculate\'', [run.calculated[0]])).rowCount).toBe(1);
  });
});

describe('versions by month (FR-TSI-005, 031)', () => {
  it('opens version 2 from November with minimum 18, needs a change reason, and keeps October on version 1', async () => {
    expect((await as('admin', 'put', `/incentive/telesales/programs/${program.id}`).send({ minPolicies: 18, effectiveFrom: '2026-09-01' })).body.errors[0].message)
      .toBe('Incentives for October 2026 are already calculated; choose November 2026 or later');
    const s = await as('admin', 'put', `/incentive/telesales/programs/${program.id}`).send({ minPolicies: 18, effectiveFrom: '2026-11-01', bands: BANDS });
    expect(s.body.data.open).toMatchObject({ version: 2, status: 'Draft', minPolicies: 18 });
    expect((await as('admin', 'post', `/incentive/telesales/programs/${program.id}/submit`).send({})).body.errors[0].message).toBe('Change reason is required');
    expect((await as('admin', 'post', `/incentive/telesales/programs/${program.id}/submit`).send({ changeReason: 'agreed with management on 30/09/2026' })).status).toBe(200);
    // recall and submit again
    expect((await as('admin', 'post', `/incentive/telesales/programs/${program.id}/recall`)).body.data.open.status).toBe('Draft');
    await as('admin', 'post', `/incentive/telesales/programs/${program.id}/submit`).send({});
    const change = (await as('head', 'get', '/posting-rules/changes')).body.data.find((c) => c.kind === 'incentive-program');
    expect(change.before.minPolicies).toBe(15);
    expect((await as('head', 'post', `/posting-rules/changes/${change.id}/approve`).send({})).status).toBe(200);
    const p = (await as('admin', 'get', `/incentive/telesales/programs/${program.id}`)).body.data;
    expect(p.versions.map((v) => [v.version, v.effectiveFrom, v.status])).toEqual([[2, '2026-11-01', 'Approved'], [1, '2026-04-01', 'Approved']]);
    expect(p.versions[1].supersededFrom).toBe('2026-11-01');
    clearSettingsCache();
  });
});
