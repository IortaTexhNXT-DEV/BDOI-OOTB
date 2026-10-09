/**
 * Placement journey: Broker Slip -> Quotation Slip -> Placement Slip -> Policy, its shortcuts (direct quote, direct
 * placement, direct policy entry), the journey configuration (placement.journey) and co-insurance participants
 * (risk_participants): validation, splitting with the rounding remainder on the lead, and the backfill.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withProducts } from './helpers.js';
import { pool, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { splitParticipants } from '../src/modules/placement/participants.js';
import { importPolicy } from '../src/modules/policies/service.js';

let ctx;
let sales;
let uw;
let ic;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const KYC = { idType: 'PhilSys ID', idCardNumber: '1234-5678-9012-3456', idCardImage: 'id-cards/p.jpg', chassisNumber: 'MHFXW42G5P0077777', motorNumber: '2NRX777777', plateNumber: 'PLC 1234' };

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
async function setJourney(patch) {
  const [row] = await q("SELECT value FROM app_settings WHERE key = 'placement.journey'");
  const next = { ...row.value };
  for (const [k, v] of Object.entries(patch)) next[k] = { ...(next[k] || next.default), ...v };
  await q("UPDATE app_settings SET value = $1 WHERE key = 'placement.journey'", [JSON.stringify(next)]);
  clearSettingsCache();
  return row.value;
}
async function restoreJourney(value) {
  await q("UPDATE app_settings SET value = $1 WHERE key = 'placement.journey'", [JSON.stringify(value)]);
  clearSettingsCache();
}
/** Draft -> PendingCustomer -> CustomerAccepted through the configured transitions. */
async function accept(quoteId) {
  expect((await sales('put', `/quotations/${quoteId}/status`).send({ status: 'PendingCustomer' })).status).toBe(200);
  const r = await sales('put', `/quotations/${quoteId}/status`).send({ status: 'CustomerAccepted' });
  expect(r.body.quotationStatus).toBe('CustomerAccepted');
}
const sumOf = (rows, k) => Math.round(rows.reduce((s, r) => s + Number(r[k]), 0) * 100) / 100;

beforeAll(async () => {
  ctx = await setup();
  await withProducts();
  sales = await persona('p.sales', ['sales']);
  uw = await persona('p.uw', ['processing']);
  ic = Object.fromEntries((await q('SELECT code, id FROM insurance_companies')).map((r) => [r.code, r.id]));
});
afterAll(async () => { await pool.end(); });

describe('journey configuration', () => {
  it('resolves the journey per LOB and product type from placement.journey', async () => {
    const motor = await sales('get', '/placements/journey?lob=MOTOR');
    expect(motor.body.data).toMatchObject({ brokerSlip: 'optional', quotationSlip: 'required', placementSlip: 'optional', lob: 'MOTOR' });
    const fire = await sales('get', '/placements/journey?productType=Fire%20and%20Allied%20Perils');
    expect(fire.body.data).toMatchObject({ placementSlip: 'required', lob: 'FIRE' });
    const marine = await sales('get', '/placements/journey?productType=Marine%20Cargo');
    expect(marine.body.data).toMatchObject({ placementSlip: 'required', lob: 'MARINE' });
    const cgl = await sales('get', '/placements/journey?productType=Comprehensive%20General%20Liability');
    expect(cgl.body.data.lob).toBe('CASUALTY');
    const opts = await sales('get', '/placements/options');
    expect(opts.body.data.insurers.map((i) => i.code)).toContain('MALAYAN');
    expect(opts.body.data.products.find((p) => p.code === 'MARINE')).toMatchObject({ lob: 'MARINE', journey: { placementSlip: 'required' } });
    expect(opts.body.data.products.find((p) => p.code === 'MOTOR').journey.placementSlip).toBe('optional');
  });
});

describe('co-insurance capture on quotations', () => {
  let leadId;
  beforeAll(async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Nora', lastName: 'Buenaventura', emailId: 'nora.b@example.ph', contactNumber: '09170000101', leadCategory: 'Retail' });
    leadId = lead.body.leadId;
  });
  const fireQuote = (participantDetails, extra = {}) => ({ leadRefId: leadId, productType: 'Fire and Allied Perils', isCoInsurance: true,
    firePremiumDetails: { totalCoverPremium: 100000.01 }, totalSumInsured: 50000000, insuranceCompanyName: 'Malayan Insurance Co., Inc.', participantDetails, ...extra });

  it('rejects shares that do not total 100%, two leads and unknown insurers with a clear message', async () => {
    const short = await sales('post', '/quotations').send(fireQuote([{ insuranceCompanyName: 'Malayan Insurance Co., Inc.', sharePercentage: '60' }, { insuranceCompanyName: 'FPG Insurance Co., Inc.', Sharepercentage: '30' }]));
    expect(short.status).toBe(400);
    expect(short.body.message).toBe('Co-insurance shares must total exactly 100% (they total 90%)');
    const twoLeads = await sales('post', '/quotations').send(fireQuote([], { participants: [{ insuranceCompanyId: ic.MALAYAN, sharePercent: 50, isLead: true }, { insuranceCompanyId: ic.FPG, sharePercent: 50, isLead: true }] }));
    expect(twoLeads.status).toBe(400);
    expect(twoLeads.body.message).toBe('Exactly one participant must be the lead insurer');
    const dup = await sales('post', '/quotations').send(fireQuote([{ insuranceCompanyName: 'MALAYAN', sharePercentage: 50 }, { insuranceCompanyName: 'Malayan Insurance Co., Inc.', sharePercentage: 50 }]));
    expect(dup.body.message).toBe('An insurer can take part only once in the same risk');
    const unknown = await sales('post', '/quotations').send(fireQuote([{ insuranceCompanyName: 'Malayan Insurance Co., Inc.', sharePercentage: 50 }, { insuranceCompanyName: 'Nowhere Mutual', sharePercentage: 50 }]));
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toContain('Nowhere Mutual');
  });

  it('writes participants by insurer id, splits by share with the remainder on the lead and keeps the legacy participantDetails', async () => {
    const r = await sales('post', '/quotations').send(fireQuote([
      { insuranceCompanyName: 'Malayan Insurance Co., Inc.', sharePercentage: '33.3333' },
      { insuranceCompanyName: 'FPG', Sharepercentage: '33.3333' },
      { participantName: 'Pioneer Insurance & Surety Corp.', sharePercentage: '33.3334' }]));
    expect(r.status).toBe(201);
    const id = r.body.quotationId;
    expect(r.body.insuranceCompanyId).toBe(ic.MALAYAN);
    const rows = await q("SELECT * FROM risk_participants WHERE entity_type = 'quote' AND entity_id = $1 ORDER BY is_lead DESC", [id]);
    expect(rows).toHaveLength(3);
    expect(rows.filter((x) => x.is_lead).map((x) => x.insurance_company_id)).toEqual([ic.MALAYAN]);
    const [quote] = await q('SELECT * FROM quotes WHERE id = $1', [id]);
    expect(sumOf(rows, 'premium')).toBe(Number(quote.premium_base));
    expect(sumOf(rows, 'premium_total')).toBe(Number(quote.premium_total));
    expect(sumOf(rows, 'sum_insured')).toBe(Number(quote.sum_insured));
    expect(sumOf(rows, 'commission_amount')).toBe(Number(quote.commission_amount));
    const fpg = rows.find((x) => x.insurance_company_id === ic.FPG);
    expect(Number(fpg.premium)).toBe(Math.round(100000.01 * 0.333333 * 100) / 100);
    const one = await sales('get', `/quotations/${id}`);
    expect(one.body.participants.map((p) => [p.insuranceCompanyName, p.sharePercent, p.isLead])).toEqual([
      ['Malayan Insurance Co., Inc.', 33.3333, true], ['Pioneer Insurance & Surety Corp.', 33.3334, false], ['FPG Insurance Co., Inc.', 33.3333, false]]);
    expect(one.body.participantDetails.every((p) => p.sharePercentage && p.insuranceCompanyId && p.Sharepercentage === undefined)).toBe(true);
    expect(one.body.isCoInsurance).toBe(true);
    // editing the premium re-splits the shares
    const upd = await sales('put', `/quotations/${id}`).send({ discount: '1000' });
    expect(upd.status).toBe(200);
    const after = await q("SELECT premium_total FROM risk_participants WHERE entity_type = 'quote' AND entity_id = $1", [id]);
    expect(sumOf(after, 'premium_total')).toBe(upd.body.grossPremium);
  });

  it('splits with round2 and puts the remainder on the lead (unit)', () => {
    const rows = splitParticipants([{ insuranceCompanyId: 1, sharePercent: 33.3333, isLead: true }, { insuranceCompanyId: 2, sharePercent: 33.3333, isLead: false }, { insuranceCompanyId: 3, sharePercent: 33.3334, isLead: false }],
      { sumInsured: 1000, premium: 100.01, taxes: 0.05, premiumTotal: 100.06, commissionAmount: 15 });
    expect(rows.map((r) => r.premium)).toEqual([33.33, 33.34, 33.34]);
    expect(rows.map((r) => r.taxes)).toEqual([0.01, 0.02, 0.02]);
    expect(rows.reduce((s, r) => s + r.premiumTotal, 0)).toBeCloseTo(100.06, 10);
    expect(rows[0].commissionAmount + rows[1].commissionAmount + rows[2].commissionAmount).toBeCloseTo(15, 10);
  });

  it('a single insurer is 100% of the insurer named on the quotation', async () => {
    const r = await sales('post', '/quotations').send({ leadRefId: leadId, productType: 'Motor', lossAndDamageCoverage: '800000', lossAndDamageCoverageRate: '1.5', participantDetails: [{ insuranceCompanyName: 'Standard Insurance Co., Inc.' }] });
    const rows = await q("SELECT * FROM risk_participants WHERE entity_type = 'quote' AND entity_id = $1", [r.body.quotationId]);
    expect(rows.map((x) => [x.insurance_company_id, Number(x.share_percent), x.is_lead])).toEqual([[ic.STANDARD, 100, true]]);
    expect(Number(rows[0].premium_total)).toBe(r.body.grossPremium);
  });
});

describe('full journey: Broker Slip -> Quotation Slip -> Placement Slip -> Policy (fire, co-insurance)', () => {
  let leadId;
  let slip;
  let quoteId;
  let placement;
  let policyId;

  it('creates a broker slip with the market and submits it (one queued request per insurer)', async () => {
    const lead = await sales('post', '/leads').send({ companyName: 'Tarlac Rice Mills Corp.', emailId: 'ops@tarlacrice.example.ph', contactNumber: '0288000101', leadCategory: 'Corporate' });
    leadId = lead.body.leadId;
    const r = await sales('post', '/broker-slips').send({ leadRefId: leadId, productType: 'Fire and Allied Perils', riskDetails: { location: 'Tarlac City', occupancy: 'Rice mill' },
      requestedCovers: [{ cover: 'Fire and lightning', sumInsured: 60000000 }, { cover: 'Typhoon and flood', sumInsured: 60000000, deductible: 'PHP 100,000' }], insurers: ['MALAYAN', 'PIONEER', 'FPG'] });
    expect(r.status).toBe(201);
    slip = r.body;
    expect(slip.slipNumber).toMatch(/^BS-\d{4}-\d{5}$/);
    expect(slip.lob).toBe('FIRE');
    expect(slip.insuredName).toBe('Tarlac Rice Mills Corp.');
    expect(slip.sumInsured).toBe(120000000);
    expect(slip.offers.map((o) => o.offerNumber).every((n) => /^OFR-\d{4}-\d{5}$/.test(n))).toBe(true);
    expect((await sales('post', `/broker-slips/${slip.id}/prepare-quotation`).send({ offerIds: [slip.offers[0].id] })).status).toBe(409);
    const s = await sales('post', `/broker-slips/${slip.id}/submit`).send({});
    expect(s.status).toBe(200);
    expect(s.body.sent).toHaveLength(3);
    expect(s.body.data.status).toBe('submitted');
    expect(s.body.data.responseDueDate).toBeTruthy();
    const mails = await q("SELECT to_address FROM email_outbox WHERE entity = 'broker_slip' AND entity_id = $1 AND template = 'broker_slip_request'", [slip.id]);
    expect(mails.map((m) => m.to_address).sort()).toEqual(['uw@fpg.example', 'uw@malayan.example', 'uw@pioneer.example']);
    const pdf = await sales('get', `/broker-slips/${slip.id}/documents/broker-slip?insurerId=${ic.MALAYAN}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('records the offers and declines, compares them and prepares a co-insurance Quotation Slip from two lines', async () => {
    const offer = (code) => slip.offers.find((o) => o.insuranceCompanyId === ic[code]);
    const a = await sales('put', `/broker-slips/${slip.id}/offers/${offer('MALAYAN').id}`).send({ status: 'offered', premium: 150000, offeredShare: 60, deductibles: 'PHP 100,000', terms: 'Sprinklers warranted', insurerReference: 'MAL-Q-1' });
    expect(a.status).toBe(200);
    expect(a.body.offer).toMatchObject({ status: 'offered', premium: 150000, rate: 0.125, offeredShare: 60 });
    expect(a.body.offer.taxes).toBeGreaterThan(0);
    expect(a.body.offer.premiumTotal).toBe(150000 + a.body.offer.taxes);
    expect((await sales('put', `/broker-slips/${slip.id}/offers/${offer('PIONEER').id}`).send({ status: 'offered', premium: 0 })).status).toBe(400);
    await sales('put', `/broker-slips/${slip.id}/offers/${offer('PIONEER').id}`).send({ status: 'offered', premium: 162000, offeredShare: 40 });
    const d = await sales('put', `/broker-slips/${slip.id}/offers/${offer('FPG').id}`).send({ status: 'declined', declineReason: 'Outside appetite' });
    expect(d.body.slip.status).toBe('responses-in');
    const cmp = await sales('get', `/broker-slips/${slip.id}/comparison`);
    expect(cmp.body.data.summary).toMatchObject({ approached: 3, offered: 2, declined: 1, pending: 0, capacityPercent: 100 });
    expect(cmp.body.data.rows.find((r) => r.isBest).insuranceCompanyId).toBe(ic.MALAYAN);
    // one 60% line alone does not place the whole risk
    const partial = await sales('post', `/broker-slips/${slip.id}/prepare-quotation`).send({ offerIds: [offer('MALAYAN').id] });
    expect(partial.status).toBe(400);
    expect(partial.body.message).toContain('total 60%');
    const r = await sales('post', `/broker-slips/${slip.id}/prepare-quotation`).send({ offerIds: [offer('MALAYAN').id, offer('PIONEER').id] });
    expect(r.status).toBe(201);
    quoteId = r.body.quotationId;
    expect(r.body.data).toMatchObject({ brokerSlipId: slip.id, lob: 'FIRE', netPremium: 150000, insuranceCompanyId: ic.MALAYAN, isCoInsurance: true });
    expect(r.body.data.participants.map((p) => [p.insuranceCompanyId, p.sharePercent, p.isLead])).toEqual([[ic.MALAYAN, 60, true], [ic.PIONEER, 40, false]]);
    expect(r.body.slip.status).toBe('closed');
    expect(r.body.slip.quotationNumber).toBe(r.body.data.quotationNumber);
    const pdf = await sales('get', `/document-templates/quote-template-fire/${quoteId}`).buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
    const text = pdf.body.toString('latin1');
    expect(text).toContain('Quotation Slip');
    expect(text).toContain('Market comparison');
  });

  it('refuses the direct conversion when the journey requires a Placement Slip', async () => {
    await accept(quoteId);
    const conv = await sales('post', `/quotations/${quoteId}/convert-to-policy`).send({ additionalPolicyData: { inception: '2026-10-01' } });
    expect(conv.status).toBe(400);
    expect(conv.body.message).toContain('requires a Placement Slip');
    expect(conv.body.errors[0]).toMatchObject({ code: 'PLACEMENT_JOURNEY', path: 'placementSlip', mode: 'required' });
  });

  it('creates the Placement Slip from the quotation, sends it and records each insurer\'s binding', async () => {
    const r = await sales('post', '/placements').send({ quoteId, inceptionDate: '2026-10-01' });
    expect(r.status).toBe(201);
    placement = r.body;
    expect(placement.placementNumber).toMatch(/^PS-\d{4}-\d{5}$/);
    expect(placement).toMatchObject({ source: 'quote', status: 'draft', quoteId, brokerSlipId: slip.id, inceptionDate: '2026-10-01', expiryDate: '2027-10-01' });
    expect(placement.participants.map((p) => [p.insuranceCompanyId, p.sharePercent, p.status])).toEqual([[ic.MALAYAN, 60, 'pending'], [ic.PIONEER, 40, 'pending']]);
    expect(sumOf(placement.participants, 'premiumTotal')).toBe(placement.grossPremium);
    expect(placement.timeline.map((t) => [t.key, t.done])).toEqual([['brokerSlip', true], ['quotationSlip', true], ['placementSlip', true], ['sent', false], ['bound', false], ['policy', false]]);
    expect((await sales('post', '/placements').send({ quoteId })).status).toBe(409);
    expect((await sales('get', `/quotations/${quoteId}`)).body.placementId).toBe(placement.id);
    const pdf = await sales('get', `/placements/${placement.id}/documents/placement-slip?insurerId=${ic.PIONEER}`).buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
    const text = pdf.body.toString('latin1');
    expect(text).toContain('Your share \\(40%');
    expect(text).not.toContain('100% share');
    const early = await sales('post', `/placements/${placement.id}/issue-policy`).send({});
    expect(early.status).toBe(409);
  });

  it('sends the firm order per participant and binds when every insurer confirms', async () => {
    const s = await sales('post', `/placements/${placement.id}/send`).send({});
    expect(s.status).toBe(200);
    expect(s.body.sent).toHaveLength(2);
    expect(s.body.data.status).toBe('sent');
    const mails = await q("SELECT to_address, body_html FROM email_outbox WHERE entity = 'placement' AND entity_id = $1", [placement.id]);
    expect(mails.find((m) => m.to_address === 'uw@pioneer.example').body_html).toContain('<b>40%</b>');
    expect((await sales('get', `/quotations/${quoteId}`)).body.quotationStatus).toBe('SubmittedToInsurer');
    expect((await sales('post', `/placements/${placement.id}/confirm`).send({ confirmations: [{ insuranceCompanyId: ic.MALAYAN, insurerReference: ' ' }] })).status).toBe(400);
    const one = await sales('post', `/placements/${placement.id}/confirm`).send({ confirmations: [{ insuranceCompanyId: ic.MALAYAN, insurerReference: 'MAL-FI-2026-0001' }] });
    expect(one.body.status).toBe('sent');
    const issueEarly = await uw('post', `/placements/${placement.id}/issue-policy`).send({});
    expect(issueEarly.status).toBe(409);
    const two = await sales('post', `/placements/${placement.id}/confirm`).send({ confirmations: [{ insuranceCompanyId: ic.PIONEER, insurerReference: 'PIO-FI-2026-0002' }] });
    expect(two.body.status).toBe('bound');
    expect(two.body.participants.every((p) => p.status === 'confirmed' && p.confirmedAt)).toBe(true);
  });

  it('issues the policy from the bound placement: participants copied, lead insurer on the policy, quotation converted', async () => {
    const r = await uw('post', `/placements/${placement.id}/issue-policy`).send({ additionalPolicyData: { insuredName: 'Tarlac Rice Mills Corp.' } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    policyId = r.body.policyId;
    const [pol] = await q('SELECT * FROM policies WHERE id = $1', [policyId]);
    expect(pol.insurance_company_id).toBe(ic.MALAYAN);
    expect(pol.placement_id).toBe(placement.id);
    expect(pol.quote_id).toBe(quoteId);
    expect(Number(pol.premium_total)).toBe(placement.grossPremium);
    const rows = await q("SELECT * FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1 ORDER BY is_lead DESC", [policyId]);
    expect(rows.map((x) => [x.insurance_company_id, Number(x.share_percent), x.insurer_reference, x.status])).toEqual([
      [ic.MALAYAN, 60, 'MAL-FI-2026-0001', 'active'], [ic.PIONEER, 40, 'PIO-FI-2026-0002', 'active']]);
    expect(sumOf(rows, 'premium_total')).toBe(Number(pol.premium_total));
    expect(sumOf(rows, 'premium')).toBe(Number(pol.net_premium));
    expect((await q('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [policyId]))[0].n).toBe(1);
    const got = await uw('get', `/policies/${policyId}`);
    expect(got.body.participants.map((p) => p.sharePercent)).toEqual([60, 40]);
    expect(got.body.placementId).toBe(placement.id);
    const quote = await uw('get', `/quotations/${quoteId}`);
    expect(quote.body.quotationStatus).toBe('ConvertedToPolicy');
    expect(quote.body.policyId).toBe(policyId);
    const p = await uw('get', `/placements/${placement.id}`);
    expect(p.body.status).toBe('issued');
    expect(p.body.timeline.every((t) => t.done)).toBe(true);
    expect((await uw('post', `/placements/${placement.id}/issue-policy`).send({})).status).toBe(409);
    const slipAfter = await uw('get', `/broker-slips/${slip.id}`);
    expect(slipAfter.body.policyNumber).toBe(pol.policy_number);
    const placing = await uw('get', `/policies/${policyId}/documents/insurance-placing-slip-fire`).buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
    const text = placing.body.toString('latin1');
    expect(text).toContain('Pioneer Insurance');
    expect(text).not.toContain('100% share');
  });
});

describe('direct quote (motor): the quotation converts directly', () => {
  it('converts an accepted motor quotation without a placement slip and writes the 100% participant', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Ramil', lastName: 'Ocampo', emailId: 'ramil.o@example.ph', contactNumber: '09170000202', leadCategory: 'Retail' });
    const r = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', lossAndDamageCoverage: '900000', lossAndDamageCoverageRate: '1.5', participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }] });
    const id = r.body.quotationId;
    await accept(id);
    const detail = await sales('get', `/quotations/${id}`);
    expect(detail.body.journey.placementSlip).toBe('optional');
    const conv = await sales('post', `/quotations/${id}/convert-to-policy`).send({ additionalPolicyData: { insuredName: 'Ramil Ocampo', ...KYC } });
    expect(conv.status, JSON.stringify(conv.body)).toBe(201);
    const rows = await q("SELECT * FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1", [conv.body.policyId]);
    expect(rows.map((x) => [x.insurance_company_id, Number(x.share_percent), x.is_lead])).toEqual([[ic.MALAYAN, 100, true]]);
    expect(Number(rows[0].premium_total)).toBe(conv.body.data.policy.grossPremium);
  });

  it('a motor quotation can still go through an optional placement slip', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Liza', lastName: 'Mercado', emailId: 'liza.m@example.ph', contactNumber: '09170000203', leadCategory: 'Retail' });
    const r = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', lossAndDamageCoverage: '700000', lossAndDamageCoverageRate: '1.5', participantDetails: [{ insuranceCompanyName: 'FPG' }] });
    await accept(r.body.quotationId);
    await sales('patch', `/quotations/${r.body.quotationId}/vehicle-info`).send(KYC);
    const p = await sales('post', '/placements').send({ quoteId: r.body.quotationId });
    expect(p.status).toBe(201);
    await sales('post', `/placements/${p.body.id}/confirm`).send({ confirmations: [{ insuranceCompanyId: ic.FPG, insurerReference: 'FPG-MC-1' }] });
    const issued = await uw('post', `/placements/${p.body.id}/issue-policy`).send({});
    expect(issued.status, JSON.stringify(issued.body)).toBe(201);
    expect(issued.body.data.policy.insuranceCompanyId).toBe(ic.FPG);
  });
});

describe('direct placement (client instructs a named insurer)', () => {
  it('places a marine cargo risk directly with co-insurers, binds and issues', async () => {
    const [client] = await q("SELECT id FROM clients WHERE id = 'cl_sls_92'");
    const r = await sales('post', '/placements').send({ clientId: client.id, productType: 'Marine Cargo', riskDetails: { voyage: 'Manila to Cebu', cargo: 'Appliances' }, sumInsured: 10000000,
      netPremium: 25000.05, inceptionDate: '2026-11-01', participants: [{ insuranceCompanyId: ic.SECUREGUARD, sharePercent: 70, isLead: true }, { insuranceCompanyName: 'Apex Assurance', sharePercentage: '30' }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ source: 'direct', lob: 'MARINE', netPremium: 25000.05, insuranceCompanyId: ic.SECUREGUARD });
    const [lead, apex] = r.body.participants;
    expect(apex.premium).toBe(7500.02);
    expect(lead.premium).toBe(17500.03);
    expect(r.body.timeline.slice(0, 2).map((t) => t.done)).toEqual([false, false]);
    // re-arranging the participants is validated server-side
    const bad = await sales('put', `/placements/${r.body.id}`).send({ participants: [{ insuranceCompanyId: ic.SECUREGUARD, sharePercent: 70, isLead: true }, { insuranceCompanyId: ic.APEX, sharePercent: 20 }] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toContain('total exactly 100%');
    await sales('post', `/placements/${r.body.id}/send`).send({});
    const decl = await sales('post', `/placements/${r.body.id}/decline`).send({ insuranceCompanyId: ic.APEX, reason: 'No capacity' });
    expect(decl.body.status).toBe('declined');
    const re = await sales('put', `/placements/${r.body.id}`).send({ participants: [{ insuranceCompanyId: ic.SECUREGUARD, sharePercent: 70, isLead: true }, { insuranceCompanyId: ic.SENTINEL, sharePercent: 30 }] });
    expect(re.status, JSON.stringify(re.body)).toBe(200);
    expect(re.body.status).toBe('draft');
    await sales('post', `/placements/${r.body.id}/confirm`).send({ confirmations: [{ insuranceCompanyId: ic.SECUREGUARD, insurerReference: 'SG-MC-77' }, { insuranceCompanyId: ic.SENTINEL, insurerReference: 'SEN-MC-12' }] });
    const issued = await uw('post', `/placements/${r.body.id}/issue-policy`).send({});
    expect(issued.status, JSON.stringify(issued.body)).toBe(201);
    const rows = await q("SELECT insurance_company_id, share_percent, premium FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1 ORDER BY is_lead DESC", [issued.body.policyId]);
    expect(rows.map((x) => [x.insurance_company_id, Number(x.share_percent), Number(x.premium)])).toEqual([[ic.SECUREGUARD, 70, 17500.03], [ic.SENTINEL, 30, 7500.02]]);
  });

  it('refuses a direct motor placement (the motor journey requires a Quotation Slip)', async () => {
    const r = await sales('post', '/placements').send({ clientId: 'cl_sls_91', productType: 'Motor', netPremium: 12000, participants: [{ insuranceCompanyId: ic.MALAYAN, sharePercent: 100 }] });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('requires a Quotation Slip');
  });
});

describe('direct policy entry (Record Issued Policy)', () => {
  it('records a policy the insurer already issued, with a new insured, in one step', async () => {
    const r = await uw('post', '/placements/record-issued-policy').send({ companyName: 'Iloilo Port Services Inc.', productType: 'Comprehensive General Liability', policyNumber: 'PIO-CGL-2026-0415',
      inceptionDate: '2026-09-01', expiryDate: '2027-09-01', sumInsured: 20000000, netPremium: 85000,
      participants: [{ insuranceCompanyId: ic.PIONEER, sharePercent: 50, isLead: true, insurerReference: 'PIO-CGL-2026-0415' }, { insuranceCompanyId: ic.STANDARD, sharePercent: 50, insurerReference: 'STD-CGL-88' }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.policyNumber).toBe('PIO-CGL-2026-0415');
    expect(r.body.data.placement).toMatchObject({ source: 'direct-policy', status: 'issued', lob: 'CASUALTY' });
    const pol = r.body.data.policy;
    expect(pol.insuredName).toBe('Iloilo Port Services Inc.');
    expect(pol.inception).toBe('2026-09-01');
    const rows = await q("SELECT insurance_company_id, insurer_reference FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1 ORDER BY is_lead DESC", [pol.id]);
    expect(rows.map((x) => x.insurer_reference)).toEqual(['PIO-CGL-2026-0415', 'STD-CGL-88']);
    expect((await sales('post', '/placements/record-issued-policy').send({ companyName: 'X Corp', productType: 'Marine Cargo', inceptionDate: '2026-09-01', netPremium: 1000,
      participants: [{ insuranceCompanyId: ic.PIONEER, sharePercent: 100 }], policyNumber: 'PIO-CGL-2026-0415' })).status).toBe(409);
  });
});

describe('journey enforcement from the configuration', () => {
  it('placementSlip skip / brokerSlip required / directPolicy skip are enforced', async () => {
    const saved = await setJourney({ MOTOR: { placementSlip: 'skip', brokerSlip: 'required' }, CASUALTY: { directPolicy: 'skip' }, FIRE: { placementSlip: 'optional' } });
    try {
      const lead = await sales('post', '/leads').send({ firstName: 'Noel', lastName: 'Garcia', emailId: 'noel.g@example.ph', contactNumber: '09170000304', leadCategory: 'Retail' });
      const blocked = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', lossAndDamageCoverage: '500000', lossAndDamageCoverageRate: '1.5' });
      expect(blocked.status).toBe(400);
      expect(blocked.body.message).toContain('starts with a Broker Slip');
      const [mq] = await q("SELECT id FROM quotes WHERE lob = 'MOTOR' AND status = 'accepted' AND deleted_at IS NULL LIMIT 1");
      if (mq) expect((await sales('post', '/placements').send({ quoteId: mq.id })).status).toBe(400);
      const direct = await uw('post', '/placements/record-issued-policy').send({ companyName: 'Y Corp', productType: 'Comprehensive General Liability', inceptionDate: '2026-09-01', netPremium: 1000,
        participants: [{ insuranceCompanyId: ic.PIONEER, sharePercent: 100 }] });
      expect(direct.status).toBe(400);
      expect(direct.body.message).toContain('Direct policy entry is not allowed');
      // fire with placement optional converts directly again
      const fl = await sales('post', '/leads').send({ companyName: 'Optional Fire Co.', emailId: 'of@example.ph', contactNumber: '0288000305', leadCategory: 'Corporate' });
      const fq = await sales('post', '/quotations').send({ leadRefId: fl.body.leadId, productType: 'Fire and Allied Perils', firePremiumDetails: { totalCoverPremium: 20000 }, participantDetails: [{ insuranceCompanyName: 'FPG' }] });
      await accept(fq.body.quotationId);
      expect((await sales('post', `/quotations/${fq.body.quotationId}/convert-to-policy`).send({})).status).toBe(201);
    } finally {
      await restoreJourney(saved);
    }
  });
});

describe('participants are written on every issuance path and backfilled for older rows', () => {
  it('bulk import writes 100% of the insurer', async () => {
    const [admin] = await q("SELECT id FROM users WHERE username = 'BrokerVerse'");
    const r = await withTransaction((db) => importPolicy(db, { insuredName: 'Imported Person', productType: 'Motor', insuranceCompanyName: 'MAPFRE', grossPremium: 11000, netPremium: 9000, sumInsured: 500000 }, admin.id));
    const rows = await q("SELECT * FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1", [r.policyId]);
    expect(rows.map((x) => [x.insurance_company_id, Number(x.share_percent), Number(x.premium_total)])).toEqual([[ic.MAPFRE, 100, 11000]]);
  });

  it('the backfill creates participants from doc.participantDetails (any casing) or 100% of the insurer', async () => {
    const [lead] = await q("SELECT id FROM leads WHERE deleted_at IS NULL LIMIT 1");
    await q(`INSERT INTO quotes(id, quote_number, lead_id, insurance_company_id, status, sum_insured, premium_base, vat, dst, lgt, premium_total, commission_amount, doc) VALUES
      ('qt_bf_1', 'QT-BF-1', $1, $2, 'draft', 1000000, 10000.01, 1200, 1250, 75, 12525.01, 1500,
        '{"isCoInsurance": true, "participantDetails": [{"insuranceCompanyName": "Malayan Insurance Co., Inc.", "sharePercentage": "33.3333"}, {"InsuranceCompanyName": "FPG", "Sharepercentage": "33.3333"}, {"participantName": "Pioneer Insurance & Surety Corp.", "sharePercentage": "33.3334%"}]}'),
      ('qt_bf_2', 'QT-BF-2', $1, $3, 'draft', 1000, 100, 0, 0, 0, 100, 10, '{"isCoInsurance": true, "participantDetails": [{"insuranceCompanyName": "MAPFRE", "sharePercentage": "50"}, {"insuranceCompanyName": "FPG", "Sharepercentage": "40"}]}'),
      ('qt_bf_3', 'QT-BF-3', $1, NULL, 'draft', 0, 0, 0, 0, 0, 0, 0, '{}')`, [lead.id, ic.MALAYAN, ic.MAPFRE]);
    const [n] = await q('SELECT backfill_risk_participants() AS n');
    expect(n.n).toBeGreaterThanOrEqual(2);
    const co = await q("SELECT * FROM risk_participants WHERE entity_type = 'quote' AND entity_id = 'qt_bf_1' ORDER BY is_lead DESC, insurance_company_id");
    expect(co.map((x) => [x.insurance_company_id, Number(x.share_percent), x.is_lead])).toEqual([[ic.MALAYAN, 33.3333, true], [ic.PIONEER, 33.3334, false], [ic.FPG, 33.3333, false]]
      .sort((a, b) => (b[2] - a[2]) || (a[0] - b[0])));
    expect(sumOf(co, 'premium')).toBe(10000.01);
    expect(sumOf(co, 'taxes')).toBe(2525);
    expect(sumOf(co, 'premium_total')).toBe(12525.01);
    expect(Number(co.find((x) => x.insurance_company_id === ic.FPG).premium)).toBe(3333.33);
    expect(Number(co.find((x) => x.is_lead).premium)).toBe(3333.34);
    // incomplete co-insurance (90%) falls back to 100% of the quotation's insurer
    const bad = await q("SELECT insurance_company_id, share_percent FROM risk_participants WHERE entity_type = 'quote' AND entity_id = 'qt_bf_2'");
    expect(bad.map((x) => [x.insurance_company_id, Number(x.share_percent)])).toEqual([[ic.MAPFRE, 100]]);
    expect(await q("SELECT 1 FROM risk_participants WHERE entity_id = 'qt_bf_3'")).toHaveLength(0);
    // every sample / earlier policy has participants, and a second run changes nothing
    expect((await q("SELECT count(*)::int AS n FROM policies p WHERE p.insurance_company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM risk_participants rp WHERE rp.entity_type = 'policy' AND rp.entity_id = p.id)"))[0].n).toBe(0);
    expect((await q('SELECT backfill_risk_participants() AS n'))[0].n).toBe(0);
  });
});

describe('placement reports and access', () => {
  it('runs the Placement Pipeline and Market Response reports', async () => {
    const pipe = await uw('post', '/reports/placement-pipeline/run').send({ ReportCriteria: 'Slip Type', FromDate: '2020-01-01' });
    expect(pipe.status, JSON.stringify(pipe.body)).toBe(200);
    const body = pipe.body.data || pipe.body;
    expect(body.rows.some((r) => r.slipType === 'Broker Slip')).toBe(true);
    expect(body.rows.some((r) => r.slipType === 'Placement Slip')).toBe(true);
    const mkt = await uw('post', '/reports/market-response/run').send({ ReportCriteria: 'Overall', FromDate: '2020-01-01' });
    expect(mkt.status, JSON.stringify(mkt.body)).toBe(200);
    const rows = (mkt.body.data || mkt.body).rows;
    const pioneer = rows.find((r) => r.insurer === 'Pioneer Insurance & Surety Corp.');
    expect(Number(pioneer.selected)).toBeGreaterThanOrEqual(1);
    expect(Number(pioneer.hitRatio)).toBeGreaterThan(0);
  });

  it('lists slips with counts and keeps persona permissions', async () => {
    const list = await sales('get', '/placements?status=issued');
    expect(list.body.data.every((p) => p.status === 'issued')).toBe(true);
    expect(list.body.counts.issued).toBeGreaterThanOrEqual(1);
    const slips = await sales('get', '/broker-slips?search=Tarlac');
    expect(slips.body.total).toBe(1);
    const claims = await persona('p.claims', ['claims']);
    expect((await claims('get', '/broker-slips')).status).toBe(403);
    expect((await claims('get', '/placements')).status).toBe(403);
  });
});
