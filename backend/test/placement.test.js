/**
 * Placement journey and broker-mediated issuance (TIS-BRD-ISSUE-01 to 03): Broker Slip -> Quotation Slip -> Placement
 * raised (automatically on acceptance, slip PDF stored) -> Sent to insurer (slip attached) -> Acknowledged -> e-Policy
 * received -> Checked against slip (second user, tolerance) -> Insurer issued (Booked: the only point where a policy,
 * bill and commission exist; the schedule is e-mailed to the client). Also the journey configuration (placement.journey),
 * direct placement (CTPL with its LTO document) and co-insurance participants (risk_participants).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { splitParticipants } from '../src/modules/placement/participants.js';
import { autoRaisePlacement } from '../src/modules/placement/placements.js';
import { importPolicy } from '../src/modules/policies/service.js';
import { objectExists } from '../src/modules/uploads/storage.js';

let ctx;
let sales;
let uw;
let ic;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const KYC = { idType: 'PhilSys ID', idCardNumber: '1234-5678-9012-3456', idCardImage: 'id-cards/p.jpg', chassisNumber: 'MHFXW42G5P0077777', motorNumber: '2NRX777777', plateNumber: 'PLC 1234' };
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
async function setSettings(values) {
  const saved = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = (await q('SELECT value FROM app_settings WHERE key = $1', [key]))[0].value;
    await q('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]);
  }
  clearSettingsCache();
  return saved;
}
async function setJourney(patch) {
  const [row] = await q("SELECT value FROM app_settings WHERE key = 'placement.journey'");
  const next = { ...row.value };
  for (const [k, v] of Object.entries(patch)) next[k] = { ...(next[k] || next.default), ...v };
  await setSettings({ 'placement.journey': next });
  return row.value;
}
/** Draft -> PendingCustomer -> CustomerAccepted through the configured transitions (the placement is raised on acceptance). */
async function accept(quoteId) {
  expect((await sales('put', `/quotations/${quoteId}/status`).send({ status: 'PendingCustomer' })).status).toBe(200);
  const r = await sales('put', `/quotations/${quoteId}/status`).send({ status: 'CustomerAccepted' });
  expect(r.body.quotationStatus).toBe('CustomerAccepted');
  return r.body;
}
/** A file uploaded through the uploads endpoint, as the e-policy screen does. */
async function upload(api, fileName, folder = 'placement-epolicies') {
  const r = await api('post', '/s3/upload').field('folder', folder).attach('file', PDF, fileName);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
}
/** The e-policy exactly as on the slip (ISSUE-02 fields). */
async function epolicyOf(api, p, extra = {}) {
  const file = await upload(api, `e-policy-${p.placementNumber}.pdf`);
  return { documentKey: file.key, documentName: file.fileName, insurerPolicyNumber: `INS-${p.placementNumber}`, participantName: p.insuredName, sumInsured: p.sumInsured,
    netPremium: p.netPremium, grossPremium: p.grossPremium, commissionAmount: p.commissionAmount, issueDate: p.inceptionDate, effectiveDate: p.inceptionDate, expiryDate: p.expiryDate, ...extra };
}
const policiesOf = async (placementId) => (await q('SELECT count(*)::int AS n FROM policies WHERE placement_id = $1', [placementId]))[0].n;
const sumOf = (rows, k) => Math.round(rows.reduce((s, r) => s + Number(r[k]), 0) * 100) / 100;

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('p.sales', ['sales']);
  uw = await persona('p.uw', ['processing']);
  ic = Object.fromEntries((await q('SELECT code, id FROM insurance_companies')).map((r) => [r.code, r.id]));
});
afterAll(async () => { await pool.end(); });

describe('journey configuration (TISPH: every line through a placement slip)', () => {
  it('resolves the journey per LOB, product and business type', async () => {
    const motor = await sales('get', '/placements/journey?lob=MOTOR');
    expect(motor.body.data).toMatchObject({ brokerSlip: 'optional', quotationSlip: 'required', placementSlip: 'required', directPolicy: 'skip', lob: 'MOTOR' });
    const ctpl = await sales('get', '/placements/journey?productType=Compulsory%20Third%20Party%20Liability');
    expect(ctpl.body.data).toMatchObject({ quotationSlip: 'optional', placementSlip: 'required', lob: 'MOTOR', key: 'CTPL' });
    const fire = await sales('get', '/placements/journey?productType=Fire%20and%20Allied%20Perils');
    expect(fire.body.data).toMatchObject({ placementSlip: 'required', lob: 'FIRE' });
    const travel = await sales('get', '/placements/journey?productType=Travel%20Insurance');
    expect(travel.body.data).toMatchObject({ businessType: 'package', placementSlip: 'required' });
    const cgl = await sales('get', '/placements/journey?productType=Comprehensive%20General%20Liability');
    expect(cgl.body.data.lob).toBe('CASUALTY');
    const opts = await sales('get', '/placements/options');
    expect(opts.body.data.insurers.map((i) => i.code)).toContain('MALAYAN');
    expect(opts.body.data.products.find((p) => p.code === 'MOTOR').journey.placementSlip).toBe('required');
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

describe('fire co-insurance: Broker Slip -> Quotation Slip -> placement chain -> Insurer issued', () => {
  let slip;
  let quoteId;
  let placement;
  let policyId;

  it('creates a broker slip with the market and submits it (one queued request per insurer)', async () => {
    const lead = await sales('post', '/leads').send({ companyName: 'Tarlac Rice Mills Corp.', emailId: 'ops@tarlacrice.example.ph', contactNumber: '0288000101', leadCategory: 'Corporate' });
    const r = await sales('post', '/broker-slips').send({ leadRefId: lead.body.leadId, productType: 'Fire and Allied Perils', riskDetails: { location: 'Tarlac City', occupancy: 'Rice mill' },
      requestedCovers: [{ cover: 'Fire and lightning', sumInsured: 60000000 }, { cover: 'Typhoon and flood', sumInsured: 60000000, deductible: 'PHP 100,000' }], insurers: ['MALAYAN', 'PIONEER', 'FPG'] });
    expect(r.status).toBe(201);
    slip = r.body;
    expect(slip.slipNumber).toMatch(/^BS-\d{4}-\d{5}$/);
    expect(slip).toMatchObject({ lob: 'FIRE', insuredName: 'Tarlac Rice Mills Corp.', sumInsured: 120000000 });
    expect((await sales('post', `/broker-slips/${slip.id}/prepare-quotation`).send({ offerIds: [slip.offers[0].id] })).status).toBe(409);
    const s = await sales('post', `/broker-slips/${slip.id}/submit`).send({});
    expect(s.status).toBe(200);
    expect(s.body.sent).toHaveLength(3);
    const mails = await q("SELECT to_address FROM email_outbox WHERE entity = 'broker_slip' AND entity_id = $1 AND template = 'broker_slip_request'", [slip.id]);
    expect(mails.map((m) => m.to_address).sort()).toEqual(['uw@fpg.example', 'uw@malayan.example', 'uw@pioneer.example']);
  });

  it('prepares a co-insurance Quotation Slip from two offers', async () => {
    const offer = (code) => slip.offers.find((o) => o.insuranceCompanyId === ic[code]);
    await sales('put', `/broker-slips/${slip.id}/offers/${offer('MALAYAN').id}`).send({ status: 'offered', premium: 150000, offeredShare: 60, deductibles: 'PHP 100,000', insurerReference: 'MAL-Q-1' });
    await sales('put', `/broker-slips/${slip.id}/offers/${offer('PIONEER').id}`).send({ status: 'offered', premium: 162000, offeredShare: 40 });
    await sales('put', `/broker-slips/${slip.id}/offers/${offer('FPG').id}`).send({ status: 'declined', declineReason: 'Outside appetite' });
    const partial = await sales('post', `/broker-slips/${slip.id}/prepare-quotation`).send({ offerIds: [offer('MALAYAN').id] });
    expect(partial.body.message).toContain('total 60%');
    const r = await sales('post', `/broker-slips/${slip.id}/prepare-quotation`).send({ offerIds: [offer('MALAYAN').id, offer('PIONEER').id] });
    expect(r.status).toBe(201);
    quoteId = r.body.quotationId;
    expect(r.body.data.participants.map((p) => [p.insuranceCompanyId, p.sharePercent, p.isLead])).toEqual([[ic.MALAYAN, 60, true], [ic.PIONEER, 40, false]]);
  });

  it('raises the placement automatically when the client accepts, with the slip PDF stored; no direct conversion', async () => {
    const accepted = await accept(quoteId);
    expect(accepted.placementNumber).toMatch(/^PS-\d{4}-\d{5}$/);
    const quote = await sales('get', `/quotations/${quoteId}`);
    expect(quote.body.placementId).toBe(accepted.placementId);
    placement = (await sales('get', `/placements/${accepted.placementId}`)).body;
    expect(placement).toMatchObject({ source: 'quote', status: 'draft', placementStatus: 'PlacementRaised', quoteId, brokerSlipId: slip.id });
    expect(placement.participants.map((p) => [p.insuranceCompanyId, p.sharePercent, p.status])).toEqual([[ic.MALAYAN, 60, 'pending'], [ic.PIONEER, 40, 'pending']]);
    expect(sumOf(placement.participants, 'premiumTotal')).toBe(placement.grossPremium);
    expect(placement.slipDocument.fileName).toBe(`placement-slip-${placement.placementNumber}.pdf`);
    expect(objectExists(placement.slipDocument.key)).toBe(true);
    const [stored] = await q('SELECT entity, entity_id, content_type FROM documents WHERE storage_key = $1', [placement.slipDocument.key]);
    expect(stored).toMatchObject({ entity: 'placement', entity_id: placement.id, content_type: 'application/pdf' });
    expect(placement.timeline.map((t) => [t.key, t.done])).toEqual([['brokerSlip', true], ['quotationSlip', true], ['placementSlip', true], ['sent', false],
      ['acknowledged', false], ['epolicy', false], ['checked', false], ['policy', false]]);
    // one open placement per quotation, and the acceptance cannot be turned into cover directly
    expect((await sales('post', '/placements').send({ quoteId })).status).toBe(409);
    const conv = await sales('post', `/quotations/${quoteId}/convert-to-policy`).send({ additionalPolicyData: { inception: '2026-10-01' } });
    expect(conv.status).toBe(400);
    expect(conv.body.errors[0]).toMatchObject({ code: 'PLACEMENT_JOURNEY', path: 'placementSlip', mode: 'required' });
    const [audit] = await q("SELECT action FROM audit_log WHERE entity = 'placement' AND entity_id = $1", [placement.id]);
    expect(audit.action).toBe('create-on-acceptance');
  });

  it('sends the firm order per participant with its placement slip attached, then records the acknowledgement', async () => {
    expect((await sales('post', `/placements/${placement.id}/acknowledge`).send({})).status).toBe(409);
    const s = await sales('post', `/placements/${placement.id}/send`).send({});
    expect(s.status).toBe(200);
    expect(s.body.sent).toHaveLength(2);
    expect(s.body.data.status).toBe('sent');
    const mails = await q("SELECT to_address, body_html, attachments FROM email_outbox WHERE entity = 'placement' AND entity_id = $1 AND template = 'placement_order'", [placement.id]);
    const pioneer = mails.find((m) => m.to_address === 'uw@pioneer.example');
    expect(pioneer.body_html).toContain('<b>40%</b>');
    expect(pioneer.attachments).toEqual([expect.objectContaining({ kind: 'document', document: 'placement-slip', params: { placementId: placement.id, insurerId: ic.PIONEER } })]);
    const { buildAttachments } = await import('../src/lib/mailer.js');
    const [pdf] = await buildAttachments(pioneer.attachments);
    expect(pdf.content.subarray(0, 4).toString()).toBe('%PDF');
    expect((await sales('get', `/quotations/${quoteId}`)).body.quotationStatus).toBe('SubmittedToInsurer');
    const ack = await sales('post', `/placements/${placement.id}/acknowledge`).send({ reference: 'MAL-ACK-1', remarks: 'Received by the fire desk' });
    expect(ack.status).toBe(200);
    expect(ack.body).toMatchObject({ status: 'acknowledged', placementStatus: 'Acknowledged', acknowledgement: { reference: 'MAL-ACK-1', remarks: 'Received by the fire desk' } });
    expect(await policiesOf(placement.id)).toBe(0);
    expect((await uw('post', `/placements/${placement.id}/book`).send({})).status).toBe(409);
  });

  it('records the e-policy (maker), checked by another user (checker), then books: the policy exists only now', async () => {
    const body = await epolicyOf(sales, placement, { insurerPolicyNumber: 'MAL-FI-2026-0001', participants: [{ insuranceCompanyId: ic.PIONEER, insurerReference: 'PIO-FI-2026-0002' }] });
    const ep = await sales('post', `/placements/${placement.id}/epolicy`).send(body);
    expect(ep.status, JSON.stringify(ep.body)).toBe(200);
    expect(ep.body).toMatchObject({ status: 'epolicy_received', placementStatus: 'EPolicyReceived', check: { status: 'match', differences: [] } });
    expect(ep.body.epolicy).toMatchObject({ insurerPolicyNumber: 'MAL-FI-2026-0001', documentKey: body.documentKey, participantName: 'Tarlac Rice Mills Corp.' });
    expect(ep.body.participants.map((p) => [p.insurerReference, p.status])).toEqual([['MAL-FI-2026-0001', 'confirmed'], ['PIO-FI-2026-0002', 'confirmed']]);
    expect(await policiesOf(placement.id)).toBe(0);
    // maker-checker: the user who keyed the e-policy cannot confirm the check
    const own = await sales('post', `/placements/${placement.id}/check`).send({ decision: 'confirm' });
    expect(own.status).toBe(403);
    expect(own.body.message).toContain('Maker-checker');
    expect((await uw('post', `/placements/${placement.id}/book`).send({})).status).toBe(409);
    const checked = await uw('post', `/placements/${placement.id}/check`).send({ decision: 'confirm' });
    expect(checked.status, JSON.stringify(checked.body)).toBe(200);
    expect(checked.body).toMatchObject({ status: 'checked', placementStatus: 'CheckedAgainstSlip', check: { decision: 'confirmed', status: 'match' } });
    expect(await policiesOf(placement.id)).toBe(0);
    expect((await q('SELECT count(*)::int AS n FROM receivables r JOIN policies p ON p.id = r.policy_id WHERE p.quote_id = $1', [quoteId]))[0].n).toBe(0);

    const r = await uw('post', `/placements/${placement.id}/book`).send({});
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    policyId = r.body.policyId;
    const [pol] = await q('SELECT * FROM policies WHERE id = $1', [policyId]);
    expect(pol).toMatchObject({ status: 'active', insurance_company_id: ic.MALAYAN, placement_id: placement.id, quote_id: quoteId, inception_date: placement.inceptionDate, issued_date: placement.inceptionDate });
    expect(pol.policy_number).not.toBe('MAL-FI-2026-0001');
    expect(pol.doc).toMatchObject({ insurerPolicyNumber: 'MAL-FI-2026-0001', epolicyDocumentKey: body.documentKey });
    expect(Number(pol.premium_total)).toBe(placement.grossPremium);
    const rows = await q("SELECT * FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1 ORDER BY is_lead DESC", [policyId]);
    expect(rows.map((x) => [x.insurance_company_id, Number(x.share_percent), x.insurer_reference])).toEqual([[ic.MALAYAN, 60, 'MAL-FI-2026-0001'], [ic.PIONEER, 40, 'PIO-FI-2026-0002']]);
    expect((await q('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [policyId]))[0].n).toBe(1);
    const quote = await uw('get', `/quotations/${quoteId}`);
    expect(quote.body).toMatchObject({ quotationStatus: 'ConvertedToPolicy', policyId });
    const p = await uw('get', `/placements/${placement.id}`);
    expect(p.body).toMatchObject({ status: 'issued', placementStatus: 'InsurerIssued', policyId });
    expect(p.body.timeline.every((t) => t.done)).toBe(true);
    expect((await uw('post', `/placements/${placement.id}/book`).send({})).status).toBe(409);
    // ISSUE-03: the schedule goes to the client's registered e-mail with the insurer's e-policy
    const [mail] = await q("SELECT to_address, attachments FROM email_outbox WHERE template = 'policy_schedule' AND entity_id = $1", [policyId]);
    expect(mail.to_address).toBe('ops@tarlacrice.example.ph');
    expect(mail.attachments.map((a) => a.document || a.key)).toEqual(['policy-schedule', body.documentKey]);
    expect(r.body.data.schedule).toMatchObject({ to: 'ops@tarlacrice.example.ph' });
    expect((await uw('get', `/broker-slips/${slip.id}`)).body.policyNumber).toBe(pol.policy_number);
  });
});

describe('motor: TBA identifiers, tolerance and the decision on a mismatch', () => {
  let quoteId;
  let placement;

  it('raises the placement on acceptance once (idempotent) and only when the journey requires it', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Ramil', lastName: 'Ocampo', emailId: 'ramil.o@example.ph', contactNumber: '09170000202', leadCategory: 'Retail' });
    const r = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', lossAndDamageCoverage: '900000', lossAndDamageCoverageRate: '1.5',
      plateNumber: 'TBA', participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }] });
    quoteId = r.body.quotationId;
    await accept(quoteId);
    const [admin] = await q("SELECT id FROM users WHERE username = 'BrokerVerse'");
    expect(await autoRaisePlacement(quoteId, { id: admin.id })).toBeNull();
    const rows = await q('SELECT * FROM placements WHERE quote_id = $1', [quoteId]);
    expect(rows).toHaveLength(1);
    placement = (await sales('get', `/placements/${rows[0].id}`)).body;
    await sales('patch', `/quotations/${quoteId}/vehicle-info`).send({ ...KYC, plateNumber: 'TBA' });

    // switched off, or a journey where the placement is optional: the accepted quotation waits for the user
    const saved = await setSettings({ 'placement.auto_raise': false });
    try {
      const other = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', lossAndDamageCoverage: '500000', lossAndDamageCoverageRate: '1.5', participantDetails: [{ insuranceCompanyName: 'FPG' }] });
      await accept(other.body.quotationId);
      expect(await q('SELECT 1 FROM placements WHERE quote_id = $1', [other.body.quotationId])).toHaveLength(0);
    } finally {
      await setSettings(saved);
    }
    const journey = await setJourney({ MOTOR: { placementSlip: 'optional' } });
    try {
      const other = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', lossAndDamageCoverage: '500000', lossAndDamageCoverageRate: '1.5', participantDetails: [{ insuranceCompanyName: 'FPG' }] });
      await accept(other.body.quotationId);
      expect(await q('SELECT 1 FROM placements WHERE quote_id = $1', [other.body.quotationId])).toHaveLength(0);
    } finally {
      await setSettings({ 'placement.journey': journey });
    }
  });

  it('requires the registration at the e-policy even where the quotation said TBA', async () => {
    expect((await sales('post', `/placements/${placement.id}/epolicy`).send(await epolicyOf(sales, placement))).status).toBe(409);
    await sales('post', `/placements/${placement.id}/send`).send({});
    const noPlate = await sales('post', `/placements/${placement.id}/epolicy`).send(await epolicyOf(sales, placement, { vehicle: { plateNumber: 'TBA' } }));
    expect(noPlate.status).toBe(400);
    expect(noPlate.body.message).toContain('plate number or MV file number');
    const missingFile = await sales('post', `/placements/${placement.id}/epolicy`).send({ ...(await epolicyOf(sales, placement, { vehicle: { plateNumber: 'NCA 4521' } })), documentKey: 'placement-epolicies/none.pdf' });
    expect(missingFile.status).toBe(400);
  });

  it('lists the differences beyond the tolerance; the e-policy goes back to the insurer, then a corrected one is checked', async () => {
    const off = await sales('post', `/placements/${placement.id}/epolicy`).send(await epolicyOf(sales, placement, {
      netPremium: placement.netPremium + 150, vehicle: { plateNumber: 'NCA 4521', chassisNumber: KYC.chassisNumber } }));
    expect(off.status, JSON.stringify(off.body)).toBe(200);
    expect(off.body.check.status).toBe('mismatch');
    expect(off.body.check.differences).toEqual(['netPremium']);
    const items = Object.fromEntries(off.body.check.items.map((i) => [i.key, i]));
    expect(items.netPremium).toMatchObject({ slip: placement.netPremium, epolicy: placement.netPremium + 150, difference: 150, status: 'mismatch' });
    expect(items.plateNumber).toMatchObject({ slip: null, epolicy: 'NCA 4521', status: 'captured' });
    expect(items.sumInsured.status).toBe('match');
    const side = await uw('get', `/placements/${placement.id}/check`);
    expect(side.body.data.result).toBe('mismatch');

    const confirm = await uw('post', `/placements/${placement.id}/check`).send({ decision: 'confirm' });
    expect(confirm.status).toBe(409);
    expect(confirm.body.message).toContain('Net premium');
    expect((await uw('post', `/placements/${placement.id}/check`).send({ decision: 'return' })).status).toBe(400);
    const back = await uw('post', `/placements/${placement.id}/check`).send({ decision: 'return', reason: 'Premium differs from the agreed terms' });
    expect(back.status).toBe(200);
    expect(back.body).toMatchObject({ status: 'acknowledged', check: { decision: 'returned' } });
    expect(back.body.mail.to).toBe('uw@malayan.example');
    const [mail] = await q("SELECT body_html FROM email_outbox WHERE template = 'placement_discrepancy' AND entity_id = $1", [placement.id]);
    expect(mail.body_html).toContain('Net premium');
    expect(await policiesOf(placement.id)).toBe(0);

    // within the tolerance (placement.check_tolerance_amount) the corrected e-policy matches
    const fixed = await sales('post', `/placements/${placement.id}/epolicy`).send(await epolicyOf(sales, placement, { netPremium: placement.netPremium + 0.5, vehicle: { plateNumber: 'NCA 4521' } }));
    expect(fixed.body.check).toMatchObject({ status: 'match', differences: [] });
    // a percentage tolerance widens the band for larger amounts
    const saved = await setSettings({ 'placement.check_tolerance_pct': 1 });
    try {
      const pct = await uw('get', `/placements/${placement.id}/check`);
      expect(pct.body.data.tolerance).toEqual({ amount: 1, percent: 1 });
    } finally {
      await setSettings(saved);
    }
  });

  it('books with the registration from the e-policy; ID checks still apply', async () => {
    expect((await uw('post', `/placements/${placement.id}/check`).send({ decision: 'confirm' })).status).toBe(200);
    const r = await uw('post', `/placements/${placement.id}/book`).send({});
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const [pol] = await q('SELECT doc FROM policies WHERE id = $1', [r.body.policyId]);
    expect(pol.doc).toMatchObject({ plateNumber: 'NCA 4521', chassisNumber: KYC.chassisNumber, insurerPolicyNumber: `INS-${placement.placementNumber}` });
    const [mail] = await q("SELECT to_address FROM email_outbox WHERE template = 'policy_schedule' AND entity_id = $1", [r.body.policyId]);
    expect(mail.to_address).toBe('ramil.o@example.ph');
  });

  it('accepts differences only with a reason, and only by an approver who did not key the e-policy', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Liza', lastName: 'Mercado', emailId: 'liza.m@example.ph', contactNumber: '09170000203', leadCategory: 'Retail' });
    const r = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', lossAndDamageCoverage: '700000', lossAndDamageCoverageRate: '1.5', participantDetails: [{ insuranceCompanyName: 'FPG' }] });
    const accepted = await accept(r.body.quotationId);
    await sales('patch', `/quotations/${r.body.quotationId}/vehicle-info`).send(KYC);
    const p = (await sales('get', `/placements/${accepted.placementId}`)).body;
    await sales('post', `/placements/${p.id}/send`).send({});
    await sales('post', `/placements/${p.id}/acknowledge`).send({ reference: 'FPG-ACK' });
    await uw('post', `/placements/${p.id}/epolicy`).send(await epolicyOf(uw, p, { participantName: 'Liza M. Mercado' }));
    expect((await uw('post', `/placements/${p.id}/check`).send({ decision: 'accept', reason: 'Middle initial added by the insurer' })).status).toBe(403);
    expect((await sales('post', `/placements/${p.id}/check`).send({ decision: 'accept' })).status).toBe(400);
    const ok = await sales('post', `/placements/${p.id}/check`).send({ decision: 'accept', reason: 'Middle initial added by the insurer' });
    expect(ok.status).toBe(200);
    expect(ok.body.check).toMatchObject({ decision: 'accepted', status: 'mismatch', differences: ['insuredName'], reason: 'Middle initial added by the insurer' });
    const booked = await uw('post', `/placements/${p.id}/book`).send({});
    expect(booked.status, JSON.stringify(booked.body)).toBe(201);
    expect(booked.body.data.policy.insuredName).toBe('Liza M. Mercado');
  });
});

describe('direct placement (client instructs a named insurer)', () => {
  it('places a marine cargo risk directly with co-insurers; a declined line is re-arranged before the insurer issues', async () => {
    const r = await sales('post', '/placements').send({ clientId: 'cl_sls_92', productType: 'Marine Cargo', riskDetails: { voyage: 'Manila to Cebu', cargo: 'Appliances' }, sumInsured: 10000000,
      netPremium: 25000.05, inceptionDate: '2026-11-01', participants: [{ insuranceCompanyId: ic.SECUREGUARD, sharePercent: 70, isLead: true }, { insuranceCompanyName: 'Apex Assurance', sharePercentage: '30' }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ source: 'direct', lob: 'MARINE', netPremium: 25000.05, insuranceCompanyId: ic.SECUREGUARD, status: 'draft' });
    expect(r.body.slipDocument.key).toBeTruthy();
    const [lead, apex] = r.body.participants;
    expect(apex.premium).toBe(7500.02);
    expect(lead.premium).toBe(17500.03);
    const bad = await sales('put', `/placements/${r.body.id}`).send({ participants: [{ insuranceCompanyId: ic.SECUREGUARD, sharePercent: 70, isLead: true }, { insuranceCompanyId: ic.APEX, sharePercent: 20 }] });
    expect(bad.body.message).toContain('total exactly 100%');
    await sales('post', `/placements/${r.body.id}/send`).send({});
    expect((await sales('post', `/placements/${r.body.id}/decline`).send({ insuranceCompanyId: ic.APEX, reason: 'No capacity' })).body.status).toBe('declined');
    const re = await sales('put', `/placements/${r.body.id}`).send({ participants: [{ insuranceCompanyId: ic.SECUREGUARD, sharePercent: 70, isLead: true }, { insuranceCompanyId: ic.SENTINEL, sharePercent: 30 }] });
    expect(re.body.status).toBe('draft');
    await sales('post', `/placements/${r.body.id}/send`).send({});
    await sales('post', `/placements/${r.body.id}/epolicy`).send(await epolicyOf(sales, re.body, { participants: [{ insuranceCompanyId: ic.SENTINEL, insurerReference: 'SEN-MC-12' }] }));
    await uw('post', `/placements/${r.body.id}/check`).send({ decision: 'confirm' });
    const issued = await uw('post', `/placements/${r.body.id}/book`).send({});
    expect(issued.status, JSON.stringify(issued.body)).toBe(201);
    const rows = await q("SELECT insurance_company_id, share_percent, premium, insurer_reference FROM risk_participants WHERE entity_type = 'policy' AND entity_id = $1 ORDER BY is_lead DESC", [issued.body.policyId]);
    expect(rows.map((x) => [x.insurance_company_id, Number(x.share_percent), Number(x.premium), x.insurer_reference])).toEqual([
      [ic.SECUREGUARD, 70, 17500.03, `INS-${re.body.placementNumber}`], [ic.SENTINEL, 30, 7500.02, 'SEN-MC-12']]);
  });

  it('a CTPL may be placed without a quotation, with its LTO document sent to the insurer; Motor comprehensive may not', async () => {
    const body = { clientId: 'cl_sls_91', productType: 'Compulsory Third Party Liability', netPremium: 560, sumInsured: 200000, inceptionDate: '2026-11-01',
      riskDetails: { plateNumber: 'NBC 1234' }, participants: [{ insuranceCompanyId: ic.MALAYAN, sharePercent: 100 }] };
    const noDoc = await sales('post', '/placements').send(body);
    expect(noDoc.status).toBe(400);
    expect(noDoc.body.message).toContain('LTO document');
    const lto = await upload(sales, 'lto-or-cr.pdf', 'placement-documents');
    const r = await sales('post', '/placements').send({ ...body, doc: { ltoDocumentKey: lto.key, ltoDocumentName: 'lto-or-cr.pdf' } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    await sales('post', `/placements/${r.body.id}/send`).send({});
    const [mail] = await q("SELECT attachments FROM email_outbox WHERE entity = 'placement' AND entity_id = $1", [r.body.id]);
    expect(mail.attachments.map((a) => a.document || a.key)).toEqual(['placement-slip', lto.key]);
    const motor = await sales('post', '/placements').send({ clientId: 'cl_sls_91', productType: 'Motor', netPremium: 12000, participants: [{ insuranceCompanyId: ic.MALAYAN, sharePercent: 100 }] });
    expect(motor.status).toBe(400);
    expect(motor.body.message).toContain('requires a Quotation Slip');
  });

  it('no path completes cover without the insurer: Record Issued Policy and issue-policy are gone', async () => {
    expect((await uw('post', '/placements/record-issued-policy').send({ companyName: 'Iloilo Port Services Inc.', productType: 'Comprehensive General Liability', inceptionDate: '2026-09-01', netPremium: 85000,
      participants: [{ insuranceCompanyId: ic.PIONEER, sharePercent: 100 }] })).status).toBe(404);
    const [p] = await q("SELECT id FROM placements WHERE status = 'sent' LIMIT 1");
    expect((await uw('post', `/placements/${p.id}/issue-policy`).send({})).status).toBe(404);
    expect((await uw('post', `/placements/${p.id}/confirm`).send({ confirmations: [{ insuranceCompanyId: ic.MALAYAN, insurerReference: 'X' }] })).status).toBe(404);
  });
});

describe('journey enforcement from the configuration', () => {
  it('placementSlip skip / brokerSlip required / optional placement are enforced', async () => {
    const saved = await setJourney({ MOTOR: { placementSlip: 'skip', brokerSlip: 'required' }, FIRE: { placementSlip: 'optional' } });
    try {
      const lead = await sales('post', '/leads').send({ firstName: 'Noel', lastName: 'Garcia', emailId: 'noel.g@example.ph', contactNumber: '09170000304', leadCategory: 'Retail' });
      const blocked = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Motor', lossAndDamageCoverage: '500000', lossAndDamageCoverageRate: '1.5' });
      expect(blocked.status).toBe(400);
      expect(blocked.body.message).toContain('starts with a Broker Slip');
      // fire with the placement optional converts directly
      const fl = await sales('post', '/leads').send({ companyName: 'Optional Fire Co.', emailId: 'of@example.ph', contactNumber: '0288000305', leadCategory: 'Corporate' });
      const fq = await sales('post', '/quotations').send({ leadRefId: fl.body.leadId, productType: 'Fire and Allied Perils', firePremiumDetails: { totalCoverPremium: 20000 }, participantDetails: [{ insuranceCompanyName: 'FPG' }] });
      await accept(fq.body.quotationId);
      expect((await sales('post', `/quotations/${fq.body.quotationId}/convert-to-policy`).send({})).status).toBe(201);
    } finally {
      await setSettings({ 'placement.journey': saved });
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
