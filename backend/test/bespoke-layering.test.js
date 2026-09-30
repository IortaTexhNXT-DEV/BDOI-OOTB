/**
 * Bespoke placements, part 3: layered co-insurance. Layer validation (shares per layer, one lead, contiguous layers,
 * premium), allocation of premium, taxes and commission per participant per layer, the consolidated shares written to
 * risk_participants (existing co-insurance keeps working through issuance), remittance and statement reconciliation
 * per participant, and the claim split with recoveries and the outstanding recoveries report.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let proc;
let acct;
let sales;
let ic;
let placement;
let policyId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const sum = (list, k) => Math.round(list.reduce((s, x) => s + Number(x[k]), 0) * 100) / 100;

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const LAYERS = () => [
  { name: 'Primary', limit: 300000000, attachmentPoint: 0, premium: 1200000, participants: [{ insuranceCompanyId: 'MALAYAN', sharePercent: 40, isLead: true }, { insuranceCompanyId: 'PIONEER', sharePercent: 30 }, { insuranceCompanyId: 'FPG', sharePercent: 30 }] },
  { name: 'First excess', limit: 700000000, attachmentPoint: 300000000, premium: 800000, participants: [{ insuranceCompanyId: 'PIONEER', sharePercent: 60, isLead: true }, { insuranceCompanyId: 'MAPFRE', sharePercent: 40 }] },
];

beforeAll(async () => {
  ctx = await setup();
  proc = await persona('l.proc', ['processing']);
  acct = await persona('l.acct', ['accounting']);
  sales = await persona('l.sales', ['sales']);
  ic = Object.fromEntries((await q('SELECT code, id FROM insurance_companies')).map((r) => [r.code, r.id]));
  const r = await proc('post', '/placements').send({ companyName: 'Cavite Semiconductor Assembly Corp.', productType: 'Industrial All Risks', sumInsured: 1000000000, netPremium: 2000000,
    inceptionDate: '2026-11-01', participants: [{ insuranceCompanyId: ic.MALAYAN, sharePercent: 100, isLead: true }] });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  placement = r.body;
});
afterAll(async () => { await pool.end(); });

describe('layers', () => {
  it('validates shares per layer, leads, contiguity and the premium', async () => {
    const bad = (mutate) => { const l = LAYERS(); mutate(l); return proc('put', `/bespoke/layers/placement/${placement.id}`).send({ layers: l }); };
    expect((await bad((l) => { l[0].participants[2].sharePercent = 20; })).body.message).toBe('Layer 1: shares must total exactly 100% (they total 90%)');
    expect((await bad((l) => { l[1].participants[1].isLead = true; })).body.message).toBe('Layer 2: exactly one participant must lead the layer');
    expect((await bad((l) => { l[1].attachmentPoint = 250000000; })).body.message).toBe('Layer 2 must attach at 300000000, where layer 1 ends');
    expect((await bad((l) => { l[1].premium = 700000; })).body.message).toMatch(/must add up to the net premium 2000000/);
    expect((await bad((l) => { l[0].participants[1].insuranceCompanyId = 'NOWHERE'; })).status).toBe(400);
    expect((await sales('put', `/bespoke/layers/placement/${placement.id}`).send({ layers: LAYERS() })).status).toBe(403);
  });

  it('allocates premium, taxes and commission per participant per layer and writes the consolidated shares', async () => {
    const r = await proc('put', `/bespoke/layers/placement/${placement.id}`).send({ layers: LAYERS() });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const { layers, participants } = r.body.data;
    expect(layers.map((l) => [l.layerNo, l.layerType, l.attachmentPoint, l.exhaustionPoint])).toEqual([[1, 'primary', 0, 300000000], [2, 'excess', 300000000, 1000000000]]);
    const [pl] = await q('SELECT * FROM placements WHERE id = $1', [placement.id]);
    const taxes = Math.round((Number(pl.vat) + Number(pl.dst) + Number(pl.lgt) + Number(pl.fst)) * 100) / 100;
    expect(sum(layers, 'taxes')).toBe(taxes);
    for (const l of layers) {
      expect(sum(l.participants, 'premium')).toBe(l.premium);
      expect(sum(l.participants, 'taxes')).toBe(l.taxes);
      expect(l.shareTotal).toBe(100);
      for (const p of l.participants) expect(p.netDue).toBe(Math.round((p.premiumTotal - p.commissionAmount) * 100) / 100);
    }
    expect(layers[0].participants.find((p) => p.insuranceCompanyId === ic.MALAYAN)).toMatchObject({ premium: 480000, isLead: true });
    expect(sum(layers.flatMap((l) => l.participants), 'commissionAmount')).toBe(Number(pl.commission_amount));
    expect(participants.map((p) => [p.insuranceCompanyId, p.sharePercent]).sort((a, b) => a[0] - b[0]))
      .toEqual([[ic.MALAYAN, 24], [ic.PIONEER, 42], [ic.FPG, 18], [ic.MAPFRE, 16]].sort((a, b) => a[0] - b[0]));
    const rows = await q("SELECT * FROM risk_participants WHERE entity_type = 'placement' AND entity_id = $1", [placement.id]);
    expect(rows).toHaveLength(4);
    expect(rows.every((x) => x.layered)).toBe(true);
    expect(rows.find((x) => x.is_lead).insurance_company_id).toBe(ic.MALAYAN);
    expect(sum(rows, 'premium')).toBe(2000000);
    expect(sum(rows, 'share_percent')).toBe(100);
    const list = await acct('get', '/bespoke/layers');
    expect(list.body.data[0]).toMatchObject({ entityType: 'placement', number: placement.placementNumber, layers: 2, insurers: 4, topLimit: 1000000000 });
  });

  it('keeps the co-insurance journey working: the policy gets the consolidated participants and reads the placement layers', async () => {
    expect((await proc('post', `/placements/${placement.id}/send`).send({})).status).toBe(200);
    const conf = await proc('post', `/placements/${placement.id}/confirm`).send({ confirmations: ['MALAYAN', 'PIONEER', 'FPG', 'MAPFRE'].map((c) => ({ insuranceCompanyId: ic[c], insurerReference: `${c}-IAR-1` })) });
    expect(conf.body.status).toBe('bound');
    const iss = await proc('post', `/placements/${placement.id}/issue-policy`).send({ additionalPolicyData: { insuredName: 'Cavite Semiconductor Assembly Corp.' } });
    expect(iss.status, JSON.stringify(iss.body)).toBe(201);
    policyId = iss.body.policyId;
    const parts = await q("SELECT insurance_company_id, share_percent FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1", [policyId]);
    expect(parts.map((p) => Number(p.share_percent)).sort((a, b) => a - b)).toEqual([16, 18, 24, 42]);
    const v = await proc('get', `/bespoke/layers/policy/${policyId}`);
    expect(v.body.data).toMatchObject({ source: 'placement', entity: { type: 'policy', editable: false } });
    expect(v.body.data.layers).toHaveLength(2);
    expect((await proc('put', `/bespoke/layers/policy/${policyId}`).send({ layers: LAYERS() })).status).toBe(409);
  });
});

describe('remittance and reconciliation per participant', () => {
  it('shows due, remitted and outstanding per layer and reconciles an insurer statement', async () => {
    const [bill] = await q('SELECT id, amount FROM receivables WHERE policy_id = $1 ORDER BY created_at LIMIT 1', [policyId]);
    expect(bill).toBeTruthy();
    const [app] = await q("INSERT INTO receipt_applications(receivable_id, amount, status) VALUES ($1, 1000, 'applied') RETURNING id", [bill.id]);
    await q('INSERT INTO remittance_allocations(receipt_application_id, insurance_company_id, share_percent, gross, commission, net) VALUES ($1,$2,42,420000,50000,370000)', [app.id, ic.PIONEER]);
    const v = await acct('get', `/bespoke/layers/policy/${policyId}/remittance`);
    expect(v.status).toBe(200);
    const pioneer = v.body.data.insurers.find((i) => i.insuranceCompanyId === ic.PIONEER);
    expect(pioneer.remitted).toBe(370000);
    expect(pioneer.outstanding).toBe(Math.round((pioneer.netDue - 370000) * 100) / 100);
    const rows = v.body.data.rows.filter((r) => r.insuranceCompanyId === ic.PIONEER);
    expect(rows.map((r) => r.layerNo)).toEqual([1, 2]);
    expect(sum(rows, 'remitted')).toBe(370000);
    const m = await acct('post', `/bespoke/layers/policy/${policyId}/reconcile`).send({ insuranceCompanyId: ic.PIONEER, statementRef: 'SOA-PIO-10', statementAmount: 370000.5 });
    expect(m.body.data).toMatchObject({ status: 'matched', difference: 0.5 });
    const d = await acct('post', `/bespoke/layers/policy/${policyId}/reconcile`).send({ insuranceCompanyId: ic.PIONEER, layerNo: 2, statementAmount: 1000 });
    expect(d.body.data.status).toBe('difference');
    expect((await proc('post', `/bespoke/layers/policy/${policyId}/reconcile`).send({ insuranceCompanyId: ic.PIONEER, statementAmount: 1 })).status).toBe(403);
    const after = await acct('get', `/bespoke/layers/policy/${policyId}/remittance`);
    expect(after.body.data.reconciliations).toHaveLength(2);
  });
});

describe('claim split', () => {
  let claimId;
  beforeAll(async () => {
    const [c] = await q("INSERT INTO claims(claim_number, policy_id, loss_date, loss_type, estimate_amount) VALUES ('CLM-T-LAYER-1', $1, '2026-12-01', 'Typhoon', 400000000) RETURNING id", [policyId]);
    claimId = c.id;
  });

  it('splits reserve and payments per layer (ground up) and participant', async () => {
    const r = await proc('post', `/bespoke/layers/claims/${claimId}/movements`).send({ kind: 'reserve', amount: 400000000, date: '2026-12-05' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.layers.map((l) => [l.layerNo, l.incurred, l.paid, l.reserve])).toEqual([[1, 300000000, 0, 300000000], [2, 100000000, 0, 100000000]]);
    const p = await proc('post', `/bespoke/layers/claims/${claimId}/movements`).send({ kind: 'payment', amount: 350000000, date: '2026-12-20', reference: 'CV-1' });
    const s = p.body.data;
    expect(s.totals).toMatchObject({ reserve: 50000000, paid: 350000000, incurred: 400000000 });
    expect(s.layers[1]).toMatchObject({ paid: 50000000, reserve: 50000000 });
    const pioneer = s.insurers.find((i) => i.insuranceCompanyId === ic.PIONEER);
    expect(pioneer.paid).toBe(90000000 + 30000000);
    expect(s.layers[0].participants.find((x) => x.insuranceCompanyId === ic.MALAYAN).paid).toBe(120000000);
  });

  it('records recoveries from participants, never above their outstanding share, and reports what is outstanding', async () => {
    expect((await acct('post', `/bespoke/layers/claims/${claimId}/recoveries`).send({ insuranceCompanyId: ic.FPG, amount: 90000001 })).status).toBe(400);
    const r = await acct('post', `/bespoke/layers/claims/${claimId}/recoveries`).send({ insuranceCompanyId: ic.PIONEER, amount: 100000000, reference: 'OR-1' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const pio = r.body.data.layers.map((l) => l.participants.find((x) => x.insuranceCompanyId === ic.PIONEER));
    expect(pio[0]).toMatchObject({ paid: 90000000, recovered: 90000000, outstandingRecovery: 0 });
    expect(pio[1]).toMatchObject({ paid: 30000000, recovered: 10000000, outstandingRecovery: 20000000 });
    const rep = await acct('get', '/bespoke/layers/reports/outstanding-recoveries?asOf=2026-12-30');
    expect(rep.status).toBe(200);
    expect(rep.body.data.rows.find((x) => x.insuranceCompanyId === ic.PIONEER && x.layerNo === 2)).toMatchObject({ outstanding: 20000000, daysSinceLastPayment: 10 });
    expect(rep.body.data.outstanding).toBe(350000000 - 100000000);
    const one = await acct('get', `/bespoke/layers/reports/outstanding-recoveries?insurerId=${ic.MAPFRE}`);
    expect(one.body.data.rows.map((x) => x.insurer)).toEqual(['MAPFRE Insurance Corporation']);
    const xlsx = await acct('get', '/bespoke/layers/reports/outstanding-recoveries?format=xlsx');
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
  });

  it('splits a claim of a policy without layers by its co-insurance shares', async () => {
    const [pol] = await q("SELECT id FROM policies WHERE id <> $1 AND status IN ('issued','active') ORDER BY created_at LIMIT 1", [policyId]);
    const [c] = await q("INSERT INTO claims(claim_number, policy_id, loss_date, estimate_amount) VALUES ('CLM-T-LAYER-2', $1, '2026-12-01', 1000) RETURNING id", [pol.id]);
    const r = await proc('post', `/bespoke/layers/claims/${c.id}/movements`).send({ kind: 'payment', amount: 1000 });
    expect(r.body.data.source).toBe('participants');
    expect(sum(r.body.data.insurers, 'paid')).toBe(1000);
  });
});
