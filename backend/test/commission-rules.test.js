/**
 * Commission rules register, sharing schemes, the commission basis of a policy and the commission controls
 * (migrations 0570 and 0571; TIS-BRD-PROD-16, COMM-02, COMM-05, COMM-06; FRS FR-CMR-001 to 025, FR-RMT-001 to 005,
 * FR-RMT-030): rules with issuing, TIS remitting and insurer net rates per peril approved on Configuration Approvals,
 * the Excel upload, the per-peril commission and variance share of a Motor policy, the shares of a scheme, the
 * requests on commission lines and the eligibility after remittance.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query, one, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { writeXlsx } from '../src/modules/documents/xlsx.js';
import { resolveCommissionRate } from '../src/modules/commission-rates/resolve.js';
import { computeBasis, policyForBasis, storeBasis } from '../src/modules/commission/breakdown.js';
import { accrueForPolicy, onPoliciesRemitted, revertEligibility } from '../src/modules/commission/service.js';
import { schemeFor, schemesJob } from '../src/modules/commission/schemes.js';

let ctx;
let manager;
let ins;
let pioneer;
let motor;
const PASSWORD = 'Welcome@123';
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const as = (token) => (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);

const perils = (net = 0.95, aon = 0.25) => [
  { peril: 'OD', basis: 'issuing-remitting', issuing: 2, tisRemitting: 1.7, insurerNet: net },
  { peril: 'AON', basis: 'issuing-remitting', issuing: 0.5, tisRemitting: 0.4, insurerNet: aon },
  { peril: 'BI', basis: 'premium-pct', commissionPct: 25 }, { peril: 'PD', basis: 'premium-pct', commissionPct: 25 }, { peril: 'APPA', basis: 'premium-pct', commissionPct: 25 },
  { peril: 'RSA', basis: 'none' }];
// the Fortuner of the FRS: OD 1,200,000 at 2% and 0.5%, BI and PD 1,000, APPA 125, CTPL 610.40
const fortuner = { lossAndDamageCoverage: 1200000, lossAndDamageCoverageRate: 2, lossAndDamageCoveragePremium: 24000, actsOfNatureRate: 0.5, actsOfNaturePremium: 6000,
  bodilyInjury: 100000, bodilyInjuryCoveragePremium: 1000, propertyDamage: 100000, propertyDamageCoveragePremium: 1000, APPAtotalCoverage: 100000, APPAcoveragePremium: 125,
  ctplCoveragePremium: 610.4, netPremium: 32125, vehicleType: 'suv' };

beforeAll(async () => {
  ctx = await setupFinance();
  const r = await ctx.api('post', '/users').send({ username: 'fin.manager', password: PASSWORD, displayName: 'Finance manager', roles: ['accounting-manager'], email: 'fin.manager@example.ph' });
  expect(r.status).toBe(201);
  const login = await request(ctx.app).post('/api/auth/login').send({ username: 'fin.manager', password: PASSWORD });
  manager = as(login.body.accessToken);
  ins = await one("SELECT id, name FROM insurance_companies WHERE code = 'MALAYAN'");
  pioneer = await one("SELECT id, name FROM insurance_companies WHERE code = 'PIONEER'");
  motor = await one("SELECT id FROM products WHERE code = 'MOTOR'");
  await query('DELETE FROM commission_rates');
  await setSetting('commission.rules_approval_required', true);
  await setSetting('commission.peril_based_motor', true);
});
afterAll(async () => { await pool.end(); });

describe('commission rules register', () => {
  let ruleId;
  let changeId;
  it('keeps a per-peril rule as a draft, submits it and refuses the maker on Configuration Approvals', async () => {
    const bad = await ctx.as('maker')('post', '/commission-rates').send({ insuranceCompanyId: ins.id, productId: motor.id, policyType: 'new', motorType: 'PC-OTHER', rateBasis: 'issuing-remitting',
      effectiveFrom: '2030-01-01', perilRates: perils(1.8) });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/insurer net <= TIS remitting <= issuing/);
    const fire = await ctx.as('maker')('post', '/commission-rates').send({ insuranceCompanyId: ins.id, lineOfBusiness: 'fire', rateBasis: 'issuing-remitting', effectiveFrom: '2030-01-01', perilRates: perils() });
    expect(fire.status).toBe(400);
    expect(fire.body.message).toMatch(/Motor products only/);
    const c = await ctx.as('maker')('post', '/commission-rates').send({ insuranceCompanyId: ins.id, productId: motor.id, policyType: 'new', motorType: 'PC-OTHER', rateBasis: 'issuing-remitting',
      effectiveFrom: '2030-01-01', perilRates: perils() });
    expect(c.status).toBe(201);
    ruleId = c.body.data.id;
    expect(c.body.data).toMatchObject({ approvalStatus: 'draft', rateBasis: 'issuing-remitting', level: 'insurer + product + motor type' });
    expect(c.body.data.perilRates.find((p) => p.peril === 'OD')).toMatchObject({ commissionPct: 1.05, variance: 0.3 });
    // a draft never applies
    expect((await resolveCommissionRate({ insurerId: ins.id, productId: motor.id, lob: 'motor', motorType: 'PC-OTHER', date: '2030-06-01', perPeril: true })).source).not.toBe('matrix');
    const s = await ctx.as('maker')('post', `/commission-rates/${ruleId}/submit`).send({ changeNote: 'November schedule' });
    expect(s.status).toBe(200);
    expect(s.body.data.approvalStatus).toBe('pending');
    changeId = s.body.data.pendingChangeId;
    expect(changeId).toBeTruthy();
    expect((await ctx.as('maker')('post', `/commission-rates/${ruleId}/submit`)).status).toBe(409);
    const changes = await manager('get', '/posting-rules/changes');
    expect(changes.body.data.find((x) => x.id === changeId)).toMatchObject({ kind: 'commission-rule', permission: 'approve:commission-rules' });
    expect((await ctx.as('maker')('post', `/posting-rules/changes/${changeId}/approve`).send({})).status).toBe(403);
    expect((await ctx.as('checker')('post', `/posting-rules/changes/${changeId}/approve`).send({})).status).toBe(403);
  });

  it('approves the rule, which then applies with its peril rates; the same keys cannot overlap', async () => {
    const a = await manager('post', `/posting-rules/changes/${changeId}/approve`).send({ remarks: 'Checked against the insurer schedule' });
    expect(a.status).toBe(200);
    const rule = (await ctx.as('maker')('get', `/commission-rates/${ruleId}`)).body.data;
    expect(rule).toMatchObject({ approvalStatus: 'approved', active: true, approvedBy: 'Finance manager' });
    const r = await resolveCommissionRate({ insurerId: ins.id, productId: motor.id, lob: 'motor', motorType: 'PC-OTHER', date: '2030-06-01', perPeril: true });
    expect(r).toMatchObject({ source: 'matrix', ruleId, rateBasis: 'issuing-remitting', level: 'insurer + product + motor type' });
    expect(r.perilRates.find((p) => p.peril === 'OD')).toMatchObject({ insurerNet: 0.95, tisRemitting: 1.7 });
    // another motor type does not match the rule
    expect((await resolveCommissionRate({ insurerId: ins.id, productId: motor.id, lob: 'motor', motorType: 'PC-SEDAN', date: '2030-06-01', perPeril: true })).source).not.toBe('matrix');
    const dup = await ctx.as('maker')('post', '/commission-rates').send({ insuranceCompanyId: ins.id, productId: motor.id, policyType: 'new', motorType: 'PC-OTHER', rateBasis: 'issuing-remitting',
      effectiveFrom: '2030-12-01', perilRates: perils() });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/is in force on these dates/);
    expect((await ctx.as('maker')('delete', `/commission-rates/${ruleId}`)).status).toBe(409);
  });

  it('amends an approved rule as a new version that end-dates the old one on approval, and keeps the history', async () => {
    const amend = await ctx.as('maker')('put', `/commission-rates/${ruleId}`).send({ effectiveFrom: '2031-01-01', perilRates: perils(1.1), submit: true, changeNote: 'Renewal net rate' });
    expect(amend.status).toBe(200);
    expect(amend.body.data).toMatchObject({ approvalStatus: 'pending', version: 2, replacesId: ruleId });
    const v2 = amend.body.data.id;
    const ok = await manager('post', `/posting-rules/changes/${amend.body.data.pendingChangeId}/approve`).send({});
    expect(ok.status).toBe(200);
    expect(String((await one('SELECT effective_to FROM commission_rates WHERE id = $1', [ruleId])).effective_to).slice(0, 10)).toBe('2030-12-31');
    expect((await resolveCommissionRate({ insurerId: ins.id, productId: motor.id, lob: 'motor', motorType: 'PC-OTHER', date: '2031-02-01', perPeril: true })).ruleId).toBe(v2);
    expect((await resolveCommissionRate({ insurerId: ins.id, productId: motor.id, lob: 'motor', motorType: 'PC-OTHER', date: '2030-06-01', perPeril: true })).ruleId).toBe(ruleId);
    const history = (await ctx.as('maker')('get', `/commission-rates/${ruleId}/history`)).body.data;
    expect(history.map((h) => h.version)).toEqual([1, 2]);
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'commission_rate' AND action IN ('submit', 'amend')")).n).toBeGreaterThanOrEqual(2);
  });

  it('returns a rule with a remark and withdraws a pending one; an effective date in the past is refused on submit', async () => {
    const c = await ctx.as('maker')('post', '/commission-rates').send({ insuranceCompanyId: pioneer.id, productId: motor.id, rateBasis: 'issuing-remitting', effectiveFrom: '2030-01-01', perilRates: perils(), submit: true });
    expect(c.status).toBe(201);
    const noRemark = await manager('post', `/posting-rules/changes/${c.body.data.pendingChangeId}/reject`).send({});
    expect(noRemark.status).toBe(400);
    expect((await manager('post', `/posting-rules/changes/${c.body.data.pendingChangeId}/reject`).send({ remarks: 'Use the sedan rate' })).status).toBe(200);
    expect((await ctx.as('maker')('get', `/commission-rates/${c.body.data.id}`)).body.data.approvalStatus).toBe('returned');
    const again = await ctx.as('maker')('post', `/commission-rates/${c.body.data.id}/submit`);
    expect(again.status).toBe(200);
    expect((await ctx.as('checker')('post', `/commission-rates/${c.body.data.id}/withdraw`)).status).toBe(409);
    expect((await ctx.as('maker')('post', `/commission-rates/${c.body.data.id}/withdraw`)).body.data.approvalStatus).toBe('withdrawn');
    const past = await ctx.as('maker')('post', '/commission-rates').send({ insuranceCompanyId: pioneer.id, lineOfBusiness: 'fire', rate: 0.25, effectiveFrom: '2020-01-01', submit: true });
    expect(past.status).toBe(400);
    expect(past.body.message).toMatch(/Effective from cannot be before today/);
  });

  it('loads rules from an Excel file: rows with the same keys form one rule, a bad row fails its whole rule', async () => {
    const tpl = await ctx.as('maker')('get', '/commission-rates/upload/template');
    expect(tpl.status).toBe(200);
    expect(tpl.headers['content-type']).toMatch(/spreadsheetml/);
    const header = ['Insurer', 'Product', 'Policy Type', 'Motor Type', 'Effective From', 'Peril', 'Basis', 'Issuing %', 'TIS Remitting %', 'Insurer Net %', 'Commission %'];
    const rows = [
      ['PIONEER', 'MOTOR', 'new', 'PC-SEDAN', '2032-01-01', 'OD', 'issuing-remitting', '2', '1.7', '1.1', ''],
      ['PIONEER', 'MOTOR', 'new', 'PC-SEDAN', '2032-01-01', 'AON', 'issuing-remitting', '0.5', '0.4', '0.25', ''],
      ['PIONEER', 'MOTOR', 'new', 'PC-SEDAN', '2032-01-01', 'BI', 'premium-pct', '', '', '', '25'],
      ['PIONEER', 'MOTOR', 'renewal', 'PC-SEDAN', '2032-01-01', 'OD', 'issuing-remitting', '2', '1.7', '2.5', ''],
      ['PIONEER', 'MOTOR', 'renewal', 'PC-SEDAN', '2032-01-01', 'AON', 'issuing-remitting', '0.5', '0.4', '0.25', ''],
    ];
    const file = writeXlsx(header, rows, 'Data');
    const up = await ctx.as('maker')('post', '/commission-rates/upload').attach('file', file, 'rules.xlsx');
    expect(up.status).toBe(200);
    expect(up.body.data).toMatchObject({ processed: 5, created: 3, failed: 2 });
    expect(up.body.data.errors.map((e) => e.message)).toEqual([expect.stringMatching(/^Row 5: .*insurer net <= TIS remitting/), 'Row 6: Another row of the same rule failed']);
    const made = (await ctx.as('maker')('get', '/commission-rates').query({ uploadId: up.body.data.uploadId })).body.data;
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ approvalStatus: 'pending', motorType: 'PC-SEDAN' });
    expect(made[0].perilRates.filter((p) => p.basis !== 'none').map((p) => p.peril)).toEqual(['OD', 'AON', 'BI']);
    const csv = await ctx.as('maker')('post', '/commission-rates/upload').attach('file', Buffer.from('a,b\n1,2'), 'rules.csv');
    expect(csv.status).toBe(400);
    expect(csv.body.message).toMatch(/Excel/);
  });

  it('saves a rule in force at once while rule changes are not reviewed (other tenants)', async () => {
    await setSetting('commission.rules_approval_required', false);
    const c = await ctx.as('maker')('post', '/commission-rates').send({ insuranceCompanyId: pioneer.id, lineOfBusiness: 'fire', rate: 0.25, effectiveFrom: '2030-01-01' });
    expect(c.status).toBe(201);
    expect(c.body.data.approvalStatus).toBe('approved');
    expect((await resolveCommissionRate({ insurerId: pioneer.id, lob: 'fire', date: '2030-06-01' })).rate).toBe(0.25);
    expect((await ctx.as('maker')('delete', `/commission-rates/${c.body.data.id}`)).status).toBe(200);
    await setSetting('commission.rules_approval_required', true);
  });
});

describe('commission basis of a policy', () => {
  let agent;
  let pol;
  beforeAll(async () => {
    const c = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Ramon Fortuner', type: 'Agent', level: 'L1', bankName: 'BPI', bankAccountNo: '3179048830' });
    agent = c.body.data.referrer.id;
    pol = await makePolicy({ net: 32125, insurer: 'MALAYAN', product: 'MOTOR', details: { commissionDetails: { primary: { referrerId: agent, level: 'L1' }, chain: [] } }, inceptionOffset: 0 });
    await query('UPDATE policies SET doc = $2, net_premium = 32125, inception_date = $3 WHERE id = $1', [pol.policy.id, JSON.stringify(fortuner), '2030-06-01']);
  });

  it('computes insurer remitting, commission and the variance share per peril (FRS Fortuner example)', async () => {
    const basis = await computeBasis(pool, await policyForBasis(pool, pol.policy.id));
    expect(basis).toMatchObject({ rateBasis: 'issuing-remitting', status: 'ok', businessType: 'NEW', motorType: 'PC-OTHER', channelType: 'agent' });
    const od = basis.perils.find((p) => p.code === 'OD');
    expect(od).toMatchObject({ sumInsured: 1200000, premium: 24000, issuing: 2, insurerNet: 0.95, tisRemitting: 1.7, insurerRemitting: 11400, commission: 12600, variance: 0.3, varianceShare: 3600 });
    expect(basis.perils.find((p) => p.code === 'AON')).toMatchObject({ insurerRemitting: 3000, commission: 3000, varianceShare: 1200 });
    expect(basis.perils.find((p) => p.code === 'BI')).toMatchObject({ commission: 250, insurerRemitting: 750 });
    expect(basis.perils.find((p) => p.code === 'APPA')).toMatchObject({ commission: 31.25, insurerRemitting: 93.75 });
    expect(basis.perils.find((p) => p.code === 'CTPL')).toMatchObject({ insurerRemitting: 610.4, commission: 0 });
    expect(basis.grossCommission).toBe(16131.25);
    expect(basis.insurerRemitting).toBe(15993.75);
    expect(basis.fullRemit).toBe(610.4);
    expect(basis.varianceShare).toBe(4800);
    expect(basis.shares).toEqual([expect.objectContaining({ referrerId: agent, basis: 'variance', amount: 4800, note: 'OD 2 - 1.7 / AON 0.5 - 0.4' })]);
    expect(basis.retained).toBe(11331.25);
    // a walk-in policy has no share
    const walkIn = await makePolicy({ net: 32125, insurer: 'MALAYAN', product: 'MOTOR', inceptionOffset: 0 });
    await query('UPDATE policies SET doc = $2, net_premium = 32125, inception_date = $3 WHERE id = $1', [walkIn.policy.id, JSON.stringify(fortuner), '2030-06-01']);
    const b2 = await computeBasis(pool, await policyForBasis(pool, walkIn.policy.id));
    expect(b2.shares).toEqual([]);
    expect(b2.retained).toBe(16131.25);
  });

  it('flags a policy without rates on the register and falls back to the rate of the insurer', async () => {
    const sedan = await makePolicy({ net: 20000, insurer: 'MALAYAN', product: 'MOTOR', inceptionOffset: 0 });
    await query('UPDATE policies SET doc = $2, net_premium = 20000, inception_date = $3 WHERE id = $1', [sedan.policy.id, JSON.stringify({ ...fortuner, vehicleType: 'private_car' }), '2030-06-01']);
    const basis = await computeBasis(pool, await policyForBasis(pool, sedan.policy.id));
    expect(basis).toMatchObject({ status: 'rates-missing', motorType: 'PC-SEDAN', rateBasis: 'net-premium' });
    expect(basis.warnings[0]).toMatch(/No commission rates found/);
  });

  it('accrues the variance share as the referrer line, eligible only once fully paid and remitted; recompute is refused after remittance', async () => {
    const basis = await computeBasis(pool, await policyForBasis(pool, pol.policy.id));
    await withTransaction((db) => storeBasis(db, pol.policy.id, basis));
    expect(Number((await one('SELECT commission_amount FROM policies WHERE id = $1', [pol.policy.id])).commission_amount)).toBe(16131.25);
    const ids = await withTransaction((db) => accrueForPolicy(db, pol.policy.id, null));
    expect(ids).toHaveLength(1);
    const line = await one('SELECT * FROM commissions WHERE id = $1', [ids[0]]);
    expect(line).toMatchObject({ referrer_id: agent, status: 'Accrued', share_basis: 'variance', share_note: 'OD 2 - 1.7 / AON 0.5 - 0.4' });
    expect(Number(line.amount)).toBe(4800);
    expect(Number(line.withholding)).toBe(240);
    expect(Number(line.net_amount)).toBe(4560);
    await setSetting('commission.eligible_requires_remittance', true);
    const r = await ctx.as('maker')('post', '/receipts').send({ policyId: pol.policy.id, amount: pol.gross });
    expect(r.status).toBe(201);
    expect((await one('SELECT status FROM commissions WHERE id = $1', [ids[0]])).status).toBe('Accrued');
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${ids[0]}/mark-eligible`)).status).toBe(409);
    const breakdown = await ctx.as('maker')('get', `/commission/policies/${pol.policy.id}/breakdown`);
    expect(breakdown.status).toBe(200);
    expect(breakdown.body.data).toMatchObject({ stored: true, recompute: { allowed: true } });
    // approved remittance of the policy: the share becomes Eligible and the basis is frozen
    const rem = await one(`INSERT INTO remittances(remittance_number, insurance_company_id, kind, gross_premium, commission, tax, net_due, status, approved_at, remittance_date)
      VALUES ('REM-T-1', $1, 'direct-bill', $2, 16131.25, 0, $3, 'approved', now(), current_date) RETURNING id`, [ins.id, pol.gross, pol.gross - 16131.25]);
    await query('INSERT INTO remittance_lines(remittance_id, policy_id, premium, commission, net, policy_number) VALUES ($1,$2,$3,16131.25,$4,$5)', [rem.id, pol.policy.id, pol.gross, pol.gross - 16131.25, pol.policy.policy_number]);
    expect(await withTransaction((db) => onPoliciesRemitted(db, [pol.policy.id]))).toEqual([agent]);
    expect((await one('SELECT status FROM commissions WHERE id = $1', [ids[0]])).status).toBe('Eligible');
    const rc = await ctx.as('maker')('post', `/commission/policies/${pol.policy.id}/recompute`);
    expect(rc.status).toBe(409);
    expect(rc.body.message).toMatch(/cannot be recomputed: it is on approved remittance REM-T-1/);
    // the receipt reversed: the premium is no longer fully paid, so the line goes back to Accrued
    expect(await withTransaction(async (db) => { await db.query('UPDATE receivables SET balance = amount, status = \'open\' WHERE policy_id = $1', [pol.policy.id]); return revertEligibility(db, pol.policy.id); })).toBe(1);
    expect((await one('SELECT status FROM commissions WHERE id = $1', [ids[0]])).status).toBe('Accrued');
    await setSetting('commission.eligible_requires_remittance', false);
  });

  it('recomputes a policy booked without rates once the rates are added', async () => {
    const sedan = await makePolicy({ net: 32125, insurer: 'MALAYAN', product: 'MOTOR', inceptionOffset: 0 });
    await query('UPDATE policies SET doc = $2, net_premium = 32125, inception_date = $3 WHERE id = $1', [sedan.policy.id, JSON.stringify({ ...fortuner, vehicleType: 'private_car' }), '2030-06-01']);
    await withTransaction(async (db) => storeBasis(db, sedan.policy.id, await computeBasis(db, await policyForBasis(db, sedan.policy.id))));
    expect((await one("SELECT details->'commissionBasis'->>'status' AS s FROM policies WHERE id = $1", [sedan.policy.id])).s).toBe('rates-missing');
    await setSetting('commission.rules_approval_required', false);
    expect((await ctx.as('maker')('post', '/commission-rates').send({ insuranceCompanyId: ins.id, productId: motor.id, motorType: 'PC-SEDAN', rateBasis: 'issuing-remitting', effectiveFrom: '2030-01-01', perilRates: perils(1.1) })).status).toBe(201);
    await setSetting('commission.rules_approval_required', true);
    expect((await ctx.as('sales')('post', `/commission/policies/${sedan.policy.id}/recompute`)).status).toBe(403);
    const rc = await ctx.as('maker')('post', `/commission/policies/${sedan.policy.id}/recompute`);
    expect(rc.status).toBe(200);
    expect(rc.body.message).toMatch(/^Commission recomputed: [\d,.]+ to 14,331\.25\.$/);
    expect(rc.body.data.breakdown.basis.status).toBe('ok');
  });
});

describe('sharing schemes', () => {
  let dealerGroup;
  let changeId;
  it('keeps a scheme as a draft, checks its lines and submits it for approval', async () => {
    const bad = await ctx.as('maker')('post', '/commission/sharing-schemes').send({ code: 'dlr std', name: 'Dealer', partyTypes: ['Dealer'], productIds: [motor.id], effectiveFrom: '2030-01-01', lines: [] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/capital letters, digits and hyphens/);
    const range = await ctx.as('maker')('post', '/commission/sharing-schemes').send({ code: 'DLR-TEST', name: 'Dealer standard share', partyTypes: ['Dealer'], productIds: [motor.id], effectiveFrom: '2030-01-01',
      lines: [{ paidTo: 'channel', basis: 'commission-pct', defaultValue: 55, min: 30, max: 50 }] });
    expect(range.status).toBe(400);
    expect(range.body.message).toMatch(/between the minimum and the maximum/);
    const c = await ctx.as('maker')('post', '/commission/sharing-schemes').send({ code: 'DLR-TEST', name: 'Dealer standard share', partyTypes: ['Dealer'], productIds: [motor.id], effectiveFrom: '2030-01-01',
      lines: [{ paidTo: 'channel', basis: 'commission-pct', perils: ['OD', 'AON'], defaultValue: 40, min: 30, max: 50 }] });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ code: 'DLR-TEST', status: 'draft', lines: [expect.objectContaining({ lineNo: 1, basisLabel: '% of commission' })] });
    expect((await ctx.as('maker')('post', '/commission/sharing-schemes').send({ code: 'dlr-test', name: 'Again', partyTypes: ['Dealer'], productIds: [motor.id], effectiveFrom: '2030-01-01' })).status).toBe(409);
    const example = await ctx.as('maker')('post', '/commission/sharing-schemes/example').send({ lines: c.body.data.lines, sumInsured: 800000, netPremium: 20000, commission: 7200 });
    expect(example.body.data).toMatchObject({ shared: 2880, retained: 4320 });
    const s = await ctx.as('maker')('post', '/commission/sharing-schemes/DLR-TEST/submit').send({});
    expect(s.status).toBe(200);
    expect(s.body.data.status).toBe('pending');
    changeId = s.body.data.pendingChangeId;
    expect((await ctx.as('maker')('post', `/posting-rules/changes/${changeId}/approve`).send({})).status).toBe(403);
    expect((await manager('post', `/posting-rules/changes/${changeId}/approve`).send({})).status).toBe(200);
    expect((await ctx.as('maker')('get', '/commission/sharing-schemes/DLR-TEST')).body.data.status).toBe('scheduled');
    expect((await schemesJob({ asOf: '2030-01-02' })).activated).toContain('DLR-TEST');
  });

  it('assigns the scheme to a dealer group with an override inside the limits, approved by a second user; branches use it', async () => {
    const g = await ctx.api('post', '/channels').send({ code: 'TDG', name: 'Toyota Dealer Group', channelType: 'dealer_group' });
    expect(g.status).toBe(201);
    dealerGroup = g.body.data.id;
    const branch = await ctx.api('post', '/channels').send({ code: 'TDG-ALA', name: 'Toyota Alabang', channelType: 'dealer_branch', parentId: dealerGroup });
    expect(branch.status).toBe(201);
    const high = await ctx.as('maker')('post', '/commission/sharing-schemes/assign').send({ channelId: dealerGroup, schemeCode: 'DLR-TEST', override: 55 });
    expect(high.status).toBe(400);
    expect(high.body.message).toMatch(/between 30 and 50/);
    const wrongParty = await ctx.as('maker')('post', '/commission/sharing-schemes/assign').send({ referrerId: 'ref-amendoza', schemeCode: 'DLR-TEST' });
    expect(wrongParty.status).toBe(400);
    expect(wrongParty.body.message).toMatch(/not for party type Agent/);
    const a = await ctx.as('maker')('post', '/commission/sharing-schemes/assign').send({ channelId: dealerGroup, schemeCode: 'DLR-TEST', override: 45 });
    expect(a.status).toBe(200);
    expect(a.body.data.pending).toBe(true);
    expect((await schemeFor(pool, { channelId: branch.body.data.id, productId: motor.id, date: '2030-06-01' })).scheme).toBeNull();
    expect((await manager('post', `/posting-rules/changes/${a.body.data.change.id}/approve`).send({})).status).toBe(200);
    const found = await schemeFor(pool, { channelId: branch.body.data.id, productId: motor.id, date: '2030-06-01' });
    expect(found).toMatchObject({ source: 'channel', override: 45 });
    expect(found.scheme.code).toBe('DLR-TEST');
    const asg = (await ctx.as('maker')('get', '/commission/sharing-schemes/DLR-TEST/assignments')).body.data;
    expect(asg.channels).toEqual([expect.objectContaining({ code: 'TDG', override: 45 })]);
    // a dealer policy of the branch: 45% of the Own Damage and Acts of Nature commission goes to the channel
    const p = await makePolicy({ net: 32125, insurer: 'MALAYAN', product: 'MOTOR', inceptionOffset: 0 });
    await query('UPDATE policies SET doc = $2, net_premium = 32125, inception_date = $3, channel_id = $4 WHERE id = $1', [p.policy.id, JSON.stringify(fortuner), '2030-06-01', branch.body.data.id]);
    const basis = await computeBasis(pool, await policyForBasis(pool, p.policy.id));
    expect(basis.scheme).toMatchObject({ code: 'DLR-TEST', source: 'channel', override: 45 });
    expect(basis.shares).toEqual([expect.objectContaining({ paidTo: 'channel', basis: 'commission-pct', value: 45, amount: 7020 })]);
    expect(basis.retained).toBe(16131.25 - 7020);
  });

  it('suspends, resumes and ends a scheme; ending one with assignments needs a replacement', async () => {
    expect((await ctx.as('maker')('post', '/commission/sharing-schemes/DLR-TEST/suspend').send({ note: 'Review' })).status).toBe(403);
    expect((await manager('post', '/commission/sharing-schemes/DLR-TEST/suspend').send({})).status).toBe(400);
    expect((await manager('post', '/commission/sharing-schemes/DLR-TEST/suspend').send({ note: 'Terms under review' })).body.data.status).toBe('suspended');
    expect((await schemeFor(pool, { channelId: dealerGroup, productId: motor.id, date: '2030-06-01' })).scheme).toBeNull();
    // resumed on the business date: in force again from its effective date (still ahead), so scheduled
    expect((await manager('post', '/commission/sharing-schemes/DLR-TEST/resume').send({})).body.data.status).toBe('scheduled');
    const end = await manager('post', '/commission/sharing-schemes/DLR-TEST/end').send({ reasonCode: 'SEN-NO-SHARING' });
    expect(end.status).toBe(409);
    expect(end.body.message).toMatch(/assigned to 1 referrers and channels/);
    const ended = await manager('post', '/commission/sharing-schemes/DLR-TEST/end').send({ reasonCode: 'SEN-NO-SHARING', confirmNoSharing: true });
    expect(ended.status).toBe(200);
    expect(ended.body.data.status).toBe('ended');
    expect((await one('SELECT scheme_code FROM distribution_channels WHERE id = $1', [dealerGroup])).scheme_code).toBeNull();
  });
});

describe('commission line controls', () => {
  let agent;
  let lineId;
  beforeAll(async () => {
    await setSetting('commission.adjustment_approval_required', true);
    const c = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Pia Request', type: 'TFS team member', bankName: 'BDO', bankAccountNo: '001122334466' });
    expect(c.status).toBe(201);
    agent = c.body.data.referrer.id;
    const pol = await makePolicy({ net: 50000, details: { commissionDetails: { brokeragePct: 18, primary: { referrerId: agent, level: 'L1', comsubPct: 8 }, chain: [] } } });
    lineId = (await withTransaction((db) => accrueForPolicy(db, pol.policy.id, null)))[0];
  });

  it('refuses a direct rate change or reversal and takes a request instead, approved by a second user', async () => {
    const direct = await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${lineId}/rate`).send({ comsubPct: 5 });
    expect(direct.status).toBe(409);
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${lineId}/reverse`).send({ reason: 'Wrong payee' })).status).toBe(409);
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/wht`).send({ whtApplicable: false, reason: 'Certificate' })).status).toBe(409);
    const noReason = await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${lineId}/requests`).send({ kind: 'rate', comsubPct: 5, reasonCode: 'NO-SUCH' });
    expect(noReason.status).toBe(400);
    const req = await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${lineId}/requests`).send({ kind: 'rate', comsubPct: 5, reasonCode: 'CRT-SPECIAL' });
    expect([req.status, req.body.message]).toEqual([200, 'Request sent for approval']);
    expect(req.body.data.request).toMatchObject({ kind: 'rate', status: 'pending', reason: 'Agreed special rate' });
    expect(req.body.data.line.pendingRequest).toMatchObject({ kind: 'rate' });
    expect(req.body.data.line.comsubPct).toBe(8);
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${lineId}/requests`).send({ kind: 'reversal', reasonCode: 'CMR-DUPLICATE' })).status).toBe(409);
    const id = req.body.data.request.id;
    expect((await ctx.as('maker')('post', `/commission/requests/${id}/approve`).send({})).status).toBe(403);
    expect((await ctx.as('checker')('post', `/commission/requests/${id}/approve`).send({})).status).toBe(403);
    expect((await manager('post', `/commission/requests/${id}/reject`).send({})).status).toBe(400);
    const ok = await manager('post', `/commission/requests/${id}/approve`).send({ note: 'Agreed with the dealer' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.request.status).toBe('approved');
    const line = (await ctx.as('maker')('get', `/commission/referrer-accounts/${agent}/lines/${lineId}`)).body.data;
    expect(line.comsubPct).toBe(5);
    expect(line.comsub).toBe(2500);
    expect((await manager('get', '/commission/requests').query({ status: 'approved' })).body.data.map((x) => x.id)).toContain(id);
    const rev = await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${lineId}/requests`).send({ kind: 'reversal', reasonCode: 'CMR-OTHER' });
    expect(rev.status).toBe(400);
    const rev2 = await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${lineId}/requests`).send({ kind: 'reversal', reasonCode: 'CMR-OTHER', note: 'Policy re-keyed' });
    expect(rev2.status).toBe(200);
    expect((await manager('post', `/commission/requests/${rev2.body.data.request.id}/approve`).send({})).body.data.request.status).toBe('approved');
    expect((await one('SELECT status FROM commissions WHERE id = $1', [lineId])).status).toBe('Reversed');
    await setSetting('commission.adjustment_approval_required', false);
  });

  it('changes a share inside the limits of its scheme with the share right and a reason', async () => {
    const pol = await makePolicy({ net: 32125, insurer: 'MALAYAN', product: 'MOTOR', details: { commissionDetails: { primary: { referrerId: agent, level: 'L1' }, chain: [] } }, inceptionOffset: 0 });
    await query('UPDATE policies SET doc = $2, net_premium = 32125, inception_date = $3 WHERE id = $1', [pol.policy.id, JSON.stringify(fortuner), '2030-06-01']);
    await withTransaction(async (db) => storeBasis(db, pol.policy.id, await computeBasis(db, await policyForBasis(db, pol.policy.id))));
    const [id] = await withTransaction((db) => accrueForPolicy(db, pol.policy.id, null));
    const line = (await ctx.as('maker')('get', `/commission/referrer-accounts/${agent}/lines/${id}`)).body.data;
    expect(line.share).toMatchObject({ basis: 'variance', value: 0.3, min: 0, max: 0.3 });
    expect((await ctx.as('sales')('post', `/commission/referrer-accounts/${agent}/lines/${id}/share`).send({ value: 0.2, reasonCode: 'CSH-NEGOTIATED' })).status).toBe(403);
    const above = await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${id}/share`).send({ value: 0.35, reasonCode: 'CSH-NEGOTIATED' });
    expect(above.status).toBe(400);
    expect(above.body.message).toMatch(/between 0 and 0.3/);
    expect((await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${id}/share`).send({ value: 0.2 })).status).toBe(400);
    const ok = await ctx.as('maker')('post', `/commission/referrer-accounts/${agent}/lines/${id}/share`).send({ value: 0.2, reasonCode: 'CSH-NEGOTIATED' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.line.comsub).toBe(3600);
    expect(ok.body.data.line.share.value).toBe(0.2);
    const stored = (await one("SELECT details->'commissionBasis' AS b FROM policies WHERE id = $1", [pol.policy.id])).b;
    expect(stored.shares[0]).toMatchObject({ value: 0.2, amount: 3600, reason: 'Negotiated with agent' });
    expect(stored.retained).toBe(16131.25 - 3600);
  });
});
