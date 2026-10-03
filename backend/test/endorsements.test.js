import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withoutCommissionTaxes } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let cs;
let finance;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Gross premium for a net premium with the configured motor taxes (tax.*_rate in app_settings), each tax rounded to cents. */
async function grossOf(net) {
  const rows = await q("SELECT key, (value#>>'{}')::numeric AS v FROM app_settings WHERE key IN ('tax.vat_rate', 'tax.dst_rate', 'tax.lgt_rate')");
  const rate = Object.fromEntries(rows.map((r) => [r.key, Number(r.v)]));
  return r2(net + r2(net * rate['tax.vat_rate']) + r2(net * rate['tax.dst_rate']) + r2(net * rate['tax.lgt_rate']));
}

/** Taxes of an additional premium on its own: VAT and LGT at the rates, DST P0.50 on each P4.00 or fractional part. */
async function apGross(net) {
  const rows = await q("SELECT key, (value#>>'{}')::numeric AS v FROM app_settings WHERE key IN ('tax.vat_rate', 'tax.lgt_rate')");
  const rate = Object.fromEntries(rows.map((r) => [r.key, Number(r.v)]));
  return r2(net + r2(net * rate['tax.vat_rate']) + Math.ceil(net / 4 - 1e-9) * 0.5 + r2(net * rate['tax.lgt_rate']));
}

/** The booking journal of a receivable balances and hits premium receivable for the billed amount. */
async function expectBooked(receivableId, amount) {
  const [rcv] = await q('SELECT amount, booking_jv_id, source FROM receivables WHERE id = $1', [receivableId]);
  expect(Number(rcv.amount)).toBeCloseTo(amount, 2);
  expect(rcv.source).toBe('endorsement');
  expect(rcv.booking_jv_id).toBeTruthy();
  const [jv] = await q('SELECT sum(debit)::numeric AS dr, sum(credit)::numeric AS cr, max(debit)::numeric AS maxdr FROM journal_lines WHERE jv_id = $1', [rcv.booking_jv_id]);
  expect(Number(jv.dr)).toBeCloseTo(Number(jv.cr), 2);
  expect(Number(jv.dr)).toBeCloseTo(amount, 2);
  expect((await q('SELECT count(*)::int AS n FROM collection_items WHERE receivable_id = $1', [receivableId]))[0].n).toBe(1);
}

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  await withoutCommissionTaxes();
  cs = await persona('e.cs', ['operations']);
  finance = await persona('e.finance', ['accounting']);
});
afterAll(async () => { await pool.end(); });

describe('endorsements', () => {
  let endorsementId;
  let grossBefore;
  let expectedDelta;

  it('creates an endorsement with the premium delta priced on the server from the coverage changes', async () => {
    grossBefore = (await cs('get', '/policies/pol_sls_05')).body.grossPremium;
    // pol_sls_05: own damage 1,150,000 at 1.65% = 18,975 net; adding bodily injury 300,000 at the default 1% adds 3,000
    expect(grossBefore).toBeCloseTo(await grossOf(18975), 2);
    expectedDelta = await apGross(3000);
    const r = await cs('post', '/endorsements/create-endorsement').send({
      policyId: 'pol_sls_05', endorsementTypeIds: [1, 2, 3],
      personalDetails: { FirstName: 'Bianca', LastName: 'Lorenzo-Reyes', ContactNumber: '09178881234', City: 'Bacoor', EmailID: 'bianca.lr@example.ph' },
      // a stale gross from the screen does not override the server price
      motorDetails: { PlateNumber: 'NEF 7777', VehicleColor: 'Graphite' }, coverageChanges: { BodilyInjury: '300,000', Grosspremium: String(grossBefore + 2500) },
    });
    expect(r.status).toBe(201);
    expect(r.body.endorsementId).toMatch(/^end_/);
    expect(r.body.endorsementNumber).toMatch(/^END-\d{4}-\d{5}$/);
    expect(r.body).toMatchObject({ status: 'Draft', premiumDelta: expectedDelta, policyNumber: expect.stringMatching(/^POL-/), endorsementTypeIds: [1, 2, 3] });
    expect(r.body.coverageChanges).toMatchObject({ BodilyInjuryCoveragePremium: '3000.00', NETpremium: '21975.00', Grosspremium: (grossBefore + expectedDelta).toFixed(2) });
    expect(r.body.premiumChange.delta).toMatchObject({ grossPremium: expectedDelta, netPremium: 3000 });
    expect(r.body.personalDetails.LastName).toBe('Lorenzo-Reyes');
    endorsementId = r.body.endorsementId;
  });

  it('validates and enforces permissions', async () => {
    expect((await cs('post', '/endorsements/create-endorsement').send({ endorsementTypeIds: [1] })).status).toBe(400);
    expect((await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_missing' })).status).toBe(404);
    expect((await finance('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_05' })).status).toBe(403);
    expect((await finance('get', '/endorsements/get-All-Endorsements')).status).toBe(403);
  });

  it('reads back and lists (by policy and client)', async () => {
    const one = await cs('get', `/endorsements/${endorsementId}`);
    expect(one.body.summary.status).toBe('Draft');
    const byPolicy = await cs('get', '/endorsements/get-All-Endorsements?pageNo=1&perPage=10&policyId=pol_sls_05');
    expect(byPolicy.body.data.items.map((e) => e.endorsementId)).toEqual([endorsementId]);
    const byClient = await cs('get', '/endorsements/get-All-Endorsements?clientId=cl_sls_01');
    expect(byClient.body.data.items[0].policyId).toBe('pol_sls_01');
    expect(byClient.body.data.pagination.total).toBe(1);
    const pol = await cs('get', '/endorsements/get-endorsement/policy-id?policyId=pol_sls_05');
    expect(pol.body.policyNumber).toMatch(/^POL-/);
    expect(pol.body.endorsements.length).toBe(1);
  });

  it('sends to the customer, uploads the document and completes', async () => {
    const s = await cs('post', `/endorsements/send-endorsement-to-customer/${endorsementId}`).send({ sentBy: 'agent' });
    expect(s.body.success).toBe(true);
    expect(s.body.endorsement.status).toBe('PendingCustomer');
    expect((await q("SELECT count(*)::int AS n FROM email_outbox WHERE template = 'endorsement_customer' AND entity_id = $1", [endorsementId]))[0].n).toBe(1);
    const up = await cs('post', '/endorsements/upload-document').field('endorsementId', endorsementId).attach('file', Buffer.from('%PDF-1.4 test'), 'endorsement.pdf');
    expect(up.status).toBe(200);
    expect(up.body.data.documentKey).toBeTruthy();
    const c = await cs('post', '/endorsements/complete-endorsement').send({ endorsementId, policyNumber: 'x', endorsementNumber: 'INS-END-1', issuedDate: '2026-09-28T00:00:00.000Z', expiryDate: '2027-09-28T00:00:00.000Z', documentKey: up.body.data.documentKey });
    expect(c.status).toBe(200);
    expect(c.body.status).toBe('Completed');
    expect(c.body.completionDetails).toMatchObject({ issuedDate: '2026-09-28', insurerEndorsementNumber: 'INS-END-1' });
    const p = (await cs('get', '/policies/pol_sls_05')).body;
    expect(p.grossPremium).toBeCloseTo(grossBefore + expectedDelta, 2);
    expect(p.netPremium).toBeCloseTo(21975, 2);
    expect(p.bodilyInjury).toBe('300,000');
    expect(p.plateNumber).toBe('NEF 7777');
    expect(p.insuredName).toBe('Bianca Lorenzo-Reyes');
    expect(p.client.contactNumber).toBe('09178881234');
    const rcv = await q('SELECT r.id, r.amount FROM receivables r JOIN endorsements e ON e.receivable_id = r.id WHERE e.id = $1', [endorsementId]);
    expect(Number(rcv[0].amount)).toBeCloseTo(expectedDelta, 2);
    await expectBooked(rcv[0].id, expectedDelta);
    const n = await q("SELECT title FROM notifications WHERE entity = 'endorsement' AND entity_id = $1", [endorsementId]);
    expect(n[0].title).toBe('Endorsement completed');
    expect((await cs('post', '/endorsements/complete-endorsement').send({ endorsementId })).status).toBe(400);
  });

  it('cancels a policy through a cancellation endorsement', async () => {
    const e = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_07', endorsementTypeIds: [5], isCancelPolicy: true, cancellationType: 'FULL', premiumDelta: -1000 });
    expect(e.body.endorsementType).toBe('cancellation');
    const s = await cs('post', `/endorsements/initiate-cancel-policy/${e.body.endorsementId}`).send({ sentBy: 'agent' });
    expect(s.body.endorsement.status).toBe('InitiateCancel');
    const c = await cs('post', '/endorsements/complete-endorsement').send({ endorsementId: e.body.endorsementId });
    expect(c.body.status).toBe('Cancelled');
    expect((await cs('get', '/policies/pol_sls_07')).body.status).toBe('Cancelled');
    expect((await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_07', endorsementTypeIds: [1] })).status).toBe(400);
  });
});

describe('coverage change endorsements (premium delta)', () => {
  // pol_sls_02: own damage 980,000 at 1.75% = 17,150 net
  const screen = (od, extra = {}) => ({ LossandDamagecoverage: String(od), LossandDamagecoverageRate: '1.75', BodilyInjury: '', PropertyDamage: '', APPATotalCoverage: '', ...extra });
  const complete = (id) => cs('post', '/endorsements/complete-endorsement').send({ endorsementId: id, endorsementNumber: 'INS-COV-1', issuedDate: '2026-09-28' });
  const receivableCount = async (policyId) => (await q('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [policyId]))[0].n;

  it('refuses a premiumDelta that does not match new gross - current gross', async () => {
    const before = Number((await q("SELECT premium_total FROM policies WHERE id = 'pol_sls_02'"))[0].premium_total);
    const newGross = await grossOf(r2(1180000 * 0.0175));
    const bad = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_02', endorsementTypeIds: [3], coverageChanges: screen(1180000), premiumDelta: r2(newGross - before) + 5 });
    expect(bad.status).toBe(400);
    expect(bad.body.message || bad.body.error?.message || JSON.stringify(bad.body)).toMatch(/does not match/);
  });

  it('bills a positive delta as a new receivable with a balanced journal and a collection item, and updates the policy premium', async () => {
    const before = Number((await q("SELECT premium_total FROM policies WHERE id = 'pol_sls_02'"))[0].premium_total);
    expect(before).toBeCloseTo(await grossOf(17150), 2);
    const net = r2(1180000 * 0.0175);
    const delta = r2((await grossOf(net)) - before);
    const rcvBefore = await receivableCount('pol_sls_02');
    const e = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_02', endorsementTypeIds: [3], coverageChanges: screen(1180000), premiumDelta: delta });
    expect(e.status).toBe(201);
    expect(e.body.premiumDelta).toBeCloseTo(delta, 2);
    expect(e.body.coverageChanges.LossandDamagecoveragepremium).toBe(net.toFixed(2));
    const c = await complete(e.body.endorsementId);
    expect(c.status).toBe(200);
    expect(c.body.receivableId).toBeTruthy();
    await expectBooked(c.body.receivableId, delta);
    expect(await receivableCount('pol_sls_02')).toBe(rcvBefore + 1);
    const [p] = await q("SELECT premium_total, net_premium, doc->>'lossAndDamageCoverage' AS od, doc->>'lossAndDamageCoveragePremium' AS odp FROM policies WHERE id = 'pol_sls_02'");
    expect(Number(p.premium_total)).toBeCloseTo(before + delta, 2);
    expect(Number(p.net_premium)).toBeCloseTo(net, 2);
    expect(p.od).toBe('1180000');
    expect(p.odp).toBe(net.toFixed(2));
  });

  it('prices the screen payload of a motor policy with BI / PD / APPA (own damage 1,200,000 -> 1,400,000 at 2%)', async () => {
    // same figures as the policy the screen was tested on: net 28,005 (OD 24,000 + BI 2,000 + PD 2,000 + APPA 5)
    const doc = { lossAndDamageCoverage: '1200000', lossAndDamageCoverageRate: '2', lossAndDamageCoveragePremium: '24000.00', bodilyInjury: '2,00,000',
      bodilyInjuryCoveragePremium: '2000.00', propertyDamage: '2,00,000', propertyDamageCoveragePremium: '2000.00', APPAtotalCoverage: '1000',
      APPAcoveragePremium: '5.00', autoPassengerPersonalAccident: '50,000', discount: '0.00', accountPremiumOthers: '0.00',
      valueAddedTax: '3360.60', documentaryStampTax: '3500.63', localGovernmentTax: '210.04' };
    await q("UPDATE policies SET doc = doc || $1::jsonb, net_premium = 28005, premium_total = 35076.27 WHERE id = 'pol_sls_01'", [JSON.stringify(doc)]);
    expect(await grossOf(28005)).toBe(35076.27);
    const coverageChanges = { policyId: 'pol_sls_01', LossandDamagecoverage: '1400000', LossandDamagecoverageRate: '2', LossandDamagecoveragepremium: '28000.00',
      BodilyInjury: '2,00,000', PropertyDamage: '200,000', APPATotalCoverage: '1000', AutopassengerpersonalAccident: '50,000', CtplCoverageRate: '',
      NETpremium: '32005.00', ValueAddedTax: '3840.60', DocumentaryStampTax: '4000.63', LocalGovtTax: '240.04', Discount: '0.00', OthersPremium: '0.00', Grosspremium: '40086.27' };
    const e = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_01', endorsementTypeIds: [3], coverageChanges, premiumDelta: 5010 });
    expect(e.status).toBe(201);
    expect(e.body.premiumDelta).toBe(5010);
    expect(e.body.coverageChanges).toMatchObject({ LossandDamagecoveragepremium: '28000.00', NETpremium: '32005.00', Grosspremium: '40086.27' });
    expect(e.body.premiumChange.taxRates).toMatchObject({ valueAddedTax: 0.12, localGovernmentTax: 0.0075 });
    // the effective DST rate of the premium: P0.50 on each P4.00 or fraction, so a little over 12.5% when rounded up
    expect(e.body.premiumChange.taxRates.documentaryStampTax).toBeCloseTo(0.125, 3);
  });

  it('does not bill a zero delta', async () => {
    const [before] = await q("SELECT premium_total, doc->>'lossAndDamageCoverage' AS od FROM policies WHERE id = 'pol_sls_03'");
    const rcvBefore = await receivableCount('pol_sls_03');
    const e = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_03', endorsementTypeIds: [3],
      coverageChanges: { LossandDamagecoverage: before.od, LossandDamagecoverageRate: '1.50' }, premiumDelta: 0 });
    expect(e.status).toBe(201);
    expect(e.body.premiumDelta).toBe(0);
    const c = await complete(e.body.endorsementId);
    expect(c.status).toBe(200);
    expect(c.body.receivableId).toBeNull();
    expect(await receivableCount('pol_sls_03')).toBe(rcvBefore);
    expect(Number((await q("SELECT premium_total FROM policies WHERE id = 'pol_sls_03'"))[0].premium_total)).toBeCloseTo(Number(before.premium_total), 2);
  });

  it('records a negative delta (return premium) without billing it', async () => {
    const before = Number((await q("SELECT premium_total FROM policies WHERE id = 'pol_sls_03'"))[0].premium_total);
    const delta = r2((await grossOf(r2(1400000 * 0.015))) - before);
    expect(delta).toBeLessThan(0);
    const rcvBefore = await receivableCount('pol_sls_03');
    const e = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_03', endorsementTypeIds: [3],
      coverageChanges: { LossandDamagecoverage: '1400000', LossandDamagecoverageRate: '1.50' } });
    expect(e.body.premiumDelta).toBeCloseTo(delta, 2);
    const c = await complete(e.body.endorsementId);
    expect(c.body.receivableId).toBeNull();
    expect(await receivableCount('pol_sls_03')).toBe(rcvBefore);
    expect(Number((await q("SELECT premium_total FROM policies WHERE id = 'pol_sls_03'"))[0].premium_total)).toBeCloseTo(before + delta, 2);
  });

  it('a premium change marked direct bill books the commission due from the insurer instead of a client bill', async () => {
    const rcvBefore = await receivableCount('pol_sls_03');
    const e = await cs('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_03', endorsementTypeIds: [3],
      coverageChanges: { LossandDamagecoverage: '1600000', LossandDamagecoverageRate: '1.50' } });
    expect(e.status).toBe(201);
    const delta = e.body.premiumDelta;
    expect(delta).toBeGreaterThan(0);
    const c = await cs('post', '/endorsements/complete-endorsement').send({ endorsementId: e.body.endorsementId, endorsementNumber: 'INS-COV-DB', issuedDate: '2026-09-28', billingMode: 'direct' });
    expect(c.status).toBe(200);
    expect(c.body.receivableId).toBeNull();
    expect(await receivableCount('pol_sls_03')).toBe(rcvBefore);
    const [item] = await q('SELECT * FROM direct_bill_items WHERE endorsement_id = $1', [e.body.endorsementId]);
    expect(item).toMatchObject({ source: 'endorsement', status: 'unbilled' });
    expect(Number(item.gross_premium)).toBeCloseTo(delta, 2);
    expect(Number(item.amount)).toBeCloseTo(Number(item.commission) + Number(item.vat), 2);
    const lines = await q('SELECT account_code FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [item.booking_jv_id]);
    expect(lines.map((l) => l.account_code)).toEqual(['1203001', '3201001', '2204003']);
    expect((await q('SELECT billing_mode FROM endorsements WHERE id = $1', [e.body.endorsementId]))[0].billing_mode).toBe('direct');
  });
});
