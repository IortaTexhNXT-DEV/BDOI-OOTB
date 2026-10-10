/**
 * Product Configurator configuration takes effect in the business flow: acceptance rules (auto-accept / refer /
 * decline / loading) on quotations, broker slips and placements, rating factors in the premium, insurer-specific
 * rules, the referral approved by the rule's authority role, the market mapping filtering insurers on a Request for
 * Quotation, and an uploaded document layout used for the printed policy schedule.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withProducts, enableFeatures } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { parseCondition, bandOf, test as testCondition, adjustNet } from '../src/modules/product-configurator/underwriting.js';
import { layoutErrors, placeholders } from '../src/modules/documents/productDocuments.js';

let ctx;
let sales;
let proc;
let ic;
let leadId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const year = new Date().getFullYear();
const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

/** A motor quotation body: Own damage 1,000,000 at 1.5% (net 15,000) on a private car of the given model year. */
const motor = (extra = {}, vehicle = {}) => ({
  leadRefId: leadId, productType: 'Motor', insurancePolicyType: 'PC', lossAndDamageCoverage: '1000000', lossAndDamageCoverageRate: '1.5',
  participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }],
  insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelYear: String(year - 3), vehicleType: 'private_cars', seatingCapacity: '5', ...vehicle }],
  vehicleType: vehicle.vehicleType || 'private_cars', ...extra,
});
const ruleId = async (code) => (await q("SELECT c.id FROM product_components c JOIN product_templates t ON t.id = c.template_id WHERE t.template_code = 'MOT-003-2025' AND c.kind = 'underwriting-rules' AND c.code = $1", [code]))[0].id;

beforeAll(async () => {
  ctx = await setup();
  // requests for quotation to several insurers are a later release (modules/features), enabled as the platform administrators do
  await enableFeatures(ctx.app, ['rfq-multi-insurer']);
  await withProducts();
  sales = await persona('r.sales', ['sales']);
  proc = await persona('r.proc', ['tis-ops-unit-head']);
  ic = Object.fromEntries((await q('SELECT code, id FROM insurance_companies')).map((r) => [r.code, r.id]));
  const lead = await sales('post', '/leads').send({ firstName: 'Rico', lastName: 'Villanueva', emailId: 'rico.v@example.ph', contactNumber: '09170000777', leadCategory: 'Retail' });
  leadId = lead.body.leadId;
});
afterAll(async () => { await pool.end(); });

describe('rule engine', () => {
  it('reads the earlier free-text conditions and rating bands', () => {
    expect(parseCondition('Vehicle Age <= 15 years')).toEqual({ field: 'vehicleAge', operator: '<=', value: 15 });
    expect(parseCondition('Vehicle Use = PUV')).toEqual({ field: 'vehicleUse', operator: '=', value: 'PUV' });
    expect(parseCondition('Sum Insured <= Fair Market Value * 1.1')).toEqual({ field: 'sumInsured', operator: '<=', valueField: 'fairMarketValue', valueFactor: 1.1 });
    expect(parseCondition('Vehicle has modifications')).toEqual({ field: 'modified', operator: '=', value: true });
    expect(parseCondition('SI < 1M')).toBeNull();
    expect(bandOf({ condition: '2-5 years' })).toEqual({ from: 2, to: 5 });
    expect(bandOf({ condition: '> 10 years' })).toEqual({ op: '>', n: 10 });
    expect(bandOf({ condition: '3+ years' })).toEqual({ op: '>=', n: 3 });
    expect(bandOf({ condition: 'Standard' })).toEqual({ always: true });
    expect(testCondition({ field: 'sumInsured', operator: '>', valueField: 'fairMarketValue', valueFactor: 1.1 }, { sumInsured: 1200000, fairMarketValue: 1000000 })).toBe(true);
    expect(testCondition({ field: 'vehicleAge', operator: '<=', value: 15 }, {})).toBeNull();
    expect(adjustNet(10000, { factors: [{ factor: 1.2, type: 'Multiplicative' }], loadingPercent: 10 })).toEqual({ net: 13200, ratingAdjustment: 2000, loadingAmount: 1200 });
  });

  it('validates layouts: text files only, known merge fields, at least one field', () => {
    expect(layoutErrors('# Title\nPolicy: {{PolicyNumber}}\n{{#Premium}}', 'schedule.txt')).toEqual([]);
    expect(layoutErrors('Hello {{Nonsense}}', 'x.txt')[0].message).toContain('Unknown merge field(s): Nonsense');
    expect(layoutErrors('Hello {{#NoBlock}}', 'x.txt')[0].message).toContain('#NoBlock');
    expect(layoutErrors('Static text only', 'x.txt')[0].message).toContain('no merge field');
    expect(layoutErrors('{{PolicyNumber}}', 'schedule.docx')[0].message).toContain('text file');
    expect(placeholders('{{PolicyNumber}} {{#Premium}} {{InsuredName}}')).toEqual({ fields: ['PolicyNumber', 'InsuredName'], blocks: ['Premium'], unknown: [] });
  });
});

describe('acceptance rules on a quotation', () => {
  let referred;

  it('auto-accepts a vehicle within 15 years', async () => {
    const r = await sales('post', '/quotations').send(motor());
    expect(r.status).toBe(201);
    expect(r.body.premiumBreakdown.underwriting.decision).toBe('accepted');
    expect(r.body.premiumBreakdown.underwriting.results.find((x) => x.ruleCode === 'VEH_AGE_LIMIT')).toMatchObject({ outcome: 'accepted' });
    expect(r.body.underwritingReferral).toBeUndefined();
  });

  it('refers a 16-year-old vehicle to the rule\'s authority (Operations Unit Head) and blocks sending, approval and issuance', async () => {
    const r = await sales('post', '/quotations').send(motor({}, { modelYear: String(year - 16) }));
    expect(r.status).toBe(201);
    referred = r.body;
    const uw = r.body.premiumBreakdown.underwriting;
    expect(uw.decision).toBe('referred');
    expect(uw.results.find((x) => x.ruleCode === 'VEH_AGE_LIMIT')).toMatchObject({ outcome: 'referred', authorityRole: 'tis-ops-unit-head', authorityRoleName: expect.stringContaining('Operations Unit Head') });
    expect(r.body.underwritingReferral).toMatchObject({ status: 'pending', ruleCodes: ['VEH_AGE_LIMIT'], authorityRoles: ['tis-ops-unit-head'] });
    // the holders of the authority role are told: nothing else brings the referral to them
    const told = await q("SELECT u.username FROM notifications n JOIN users u ON u.id = n.user_id WHERE n.entity_id = $1 AND n.title = 'Quotation referred for underwriting'", [referred.quotationId]);
    expect(told.map((x) => x.username)).toContain('r.proc');
    const send = await sales('post', `/quotations/${referred.quotationId}/send-for-approval`).send({});
    expect(send.status).toBe(400);
    expect(send.body.message).toContain('is referred');
    expect(send.body.message).toContain('Vehicle older than 15 years');
    const convert = await sales('post', `/quotations/${referred.quotationId}/convert-to-policy`).send({});
    expect(convert.status).toBe(400);
    expect(convert.body.message).toContain('is referred');
    // the client cannot clear the referral by sending it back in the document
    const forged = await sales('put', `/quotations/${referred.quotationId}`).send({ underwritingReferral: { status: 'approved', ruleCodes: ['VEH_AGE_LIMIT'] } });
    expect(forged.body.underwritingReferral.status).toBe('pending');
  });

  it('lets only the authority role approve the referral, within its authority limit', async () => {
    const bySales = await sales('post', `/quotations/${referred.quotationId}/underwriting-referral`).send({ decision: 'approve' });
    expect(bySales.status).toBe(403);
    expect(bySales.body.message).toContain('Operations Unit Head');
    // an Operations Unit Head limit below the sum insured refuses the approval (authority matrix)
    await q("INSERT INTO authority_limits(transaction_type, role_code, max_amount, status) VALUES ('underwriting_referral', 'tis-ops-unit-head', 500000, 'active')");
    const above = await proc('post', `/quotations/${referred.quotationId}/underwriting-referral`).send({ decision: 'approve' });
    expect(above.status).toBe(403);
    expect(above.body.message).toContain('Underwriting referral approval');
    await q("UPDATE authority_limits SET max_amount = 10000000 WHERE transaction_type = 'underwriting_referral' AND role_code = 'tis-ops-unit-head'");
    const ok = await proc('post', `/quotations/${referred.quotationId}/underwriting-referral`).send({ decision: 'approve', remarks: 'Inspection report seen', insurerReference: 'UW-77' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.underwritingReferral).toMatchObject({ status: 'approved', decidedBy: 'r.proc', insurerReference: 'UW-77' });
    const send = await sales('post', `/quotations/${referred.quotationId}/send-for-approval`).send({});
    expect(send.status).toBe(200);
    const audit = await q("SELECT action FROM audit_log WHERE entity = 'quotation' AND entity_id = $1 AND action = 'referral-approved'", [referred.quotationId]);
    expect(audit).toHaveLength(1);
  });

  it('a declined referral rejects the quotation', async () => {
    const r = await sales('post', '/quotations').send(motor({}, { modelYear: String(year - 20) }));
    const d = await proc('post', `/quotations/${r.body.quotationId}/underwriting-referral`).send({ decision: 'decline' });
    expect(d.status).toBe(400);
    const ok = await proc('post', `/quotations/${r.body.quotationId}/underwriting-referral`).send({ decision: 'decline', remarks: 'Insurer will not write a 20-year-old car' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.quotationStatus).toBe('Rejected');
  });

  it('declines a PUV with the rule\'s message (vehicle use stated, or assumed from a PUJ / bus class)', async () => {
    const stated = await sales('post', '/quotations').send(motor({ vehicleUse: 'PUV' }));
    expect(stated.status).toBe(400);
    expect(stated.body.message).toContain('declined by the acceptance rules of MOT-003-2025');
    expect(stated.body.message).toContain('Public utility vehicles (PUV) are not accepted');
    expect(stated.body.errors[0]).toMatchObject({ path: 'underwriting', rule: 'PUV' });
    const byClass = await sales('post', '/quotations').send(motor({}, { vehicleType: 'taxi_puj_and_mini_bus' }));
    expect(byClass.status).toBe(400);
    expect(byClass.body.message).toContain('PUV');
  });

  it('adds the loading of a loading rule to the net premium (driver under 21: 15%)', async () => {
    const base = await sales('post', '/quotations').send(motor());
    const young = await sales('post', '/quotations').send(motor({ driverAge: 19 }));
    expect(base.body.netPremium).toBe(15000);
    expect(young.status).toBe(201);
    expect(young.body.premiumBreakdown.underwritingLoading).toBe(2250);
    expect(young.body.netPremium).toBe(17250);
    expect(young.body.grossPremium).toBeGreaterThan(base.body.grossPremium);
    expect(young.body.premiumBreakdown.underwriting.results.find((x) => x.ruleCode === 'YOUNG_DRV')).toMatchObject({ outcome: 'loaded', loadingPercent: 15 });
  });

  it('applies a rating factor of the template to the premium (vehicle age band)', async () => {
    const f = await ctx.api('post', '/product-configurator/rating-factors').send({ templateCode: 'MOT-003-2025', factorCode: 'AGE_BAND', factorName: 'Age band', type: 'Multiplicative',
      field: 'vehicleAge', rules: [{ condition: '0-5', factor: 1 }, { condition: '> 5', factor: 1.2 }] });
    expect(f.status).toBe(201);
    const older = await sales('post', '/quotations').send(motor({}, { modelYear: String(year - 8) }));
    expect(older.body.netPremium).toBe(18000);
    expect(older.body.premiumBreakdown.ratingAdjustment).toBe(3000);
    expect(older.body.premiumBreakdown.underwriting.factors).toEqual(expect.arrayContaining([expect.objectContaining({ factorCode: 'AGE_BAND', band: '> 5', factor: 1.2 })]));
    const newer = await sales('post', '/quotations').send(motor());
    expect(newer.body.netPremium).toBe(15000);
    await ctx.api('delete', `/product-configurator/rating-factors/${f.body.data.id}`);
  });

  it('applies an insurer-specific rule only to that insurer', async () => {
    const r = await ctx.api('post', '/product-configurator/underwriting-rules').send({ templateCode: 'MOT-003-2025', ruleCode: 'MAL_SI_CAP', ruleName: 'Malayan sum insured cap',
      type: 'Acceptance', field: 'sumInsured', operator: '>', value: 800000, action: 'Decline', message: 'Malayan writes private cars up to PHP 800,000', insurerName: 'MALAYAN' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ insurerId: ic.MALAYAN, insurerName: 'Malayan Insurance Co., Inc.', condition: 'Sum insured > 800000' });
    const mal = await sales('post', '/quotations').send(motor());
    expect(mal.status).toBe(400);
    expect(mal.body.message).toContain('Malayan writes private cars up to PHP 800,000');
    const pio = await sales('post', '/quotations').send(motor({ participantDetails: [{ insuranceCompanyName: 'Pioneer Insurance & Surety Corp.' }] }));
    expect(pio.status).toBe(201);
    const list = await ctx.api('get', `/product-configurator/underwriting-rules?insurerId=${ic.MALAYAN}&allInsurers=false`);
    expect(list.body.data.map((x) => x.ruleCode)).toEqual(['MAL_SI_CAP']);
    expect(list.body.data[0]).toMatchObject({ templateName: 'Motor Insurance Basic Plan', productMasterCode: 'MOTOR', productMasterName: 'Motor Vehicle Insurance' });
    await ctx.api('delete', `/product-configurator/underwriting-rules/${r.body.data.id}`);
  });

  it('refuses rules that cannot be evaluated and keeps an audit history', async () => {
    const bad = await ctx.api('post', '/product-configurator/underwriting-rules').send({ templateCode: 'MOT-003-2025', ruleCode: 'X1', ruleName: 'Vague', type: 'Acceptance', condition: 'Looks risky', action: 'Refer' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['field', 'authorityRole']));
    const noLoad = await ctx.api('post', '/product-configurator/underwriting-rules').send({ templateCode: 'MOT-003-2025', ruleCode: 'X2', ruleName: 'Load', type: 'Loading', field: 'driverAge', operator: '<', value: 25, action: 'Apply Loading' });
    expect(noLoad.body.errors.map((e) => e.path)).toContain('loadingPercent');
    const id = await ruleId('MODIFIED');
    expect((await ctx.api('put', `/product-configurator/underwriting-rules/${id}`).send({ status: 'Inactive' })).status).toBe(200);
    const h = await ctx.api('get', `/product-configurator/underwriting-rules/${id}/history`);
    expect(h.body.data[0]).toMatchObject({ action: 'update', changes: [expect.objectContaining({ field: 'status', from: 'Active', to: 'Inactive' })] });
    await ctx.api('put', `/product-configurator/underwriting-rules/${id}`).send({ status: 'Active' });
  });

  it('tests a risk against a template from the Acceptance Rules screen', async () => {
    const r = await ctx.api('post', '/product-configurator/underwriting/evaluate').send({ templateCode: 'MOT-003-2025', risk: { modelYear: year - 16, vehicleType: 'private_cars', totalSumInsured: 700000 } });
    expect(r.body.data).toMatchObject({ templateCode: 'MOT-003-2025', decision: 'referred', referredRules: ['VEH_AGE_LIMIT'] });
    expect(r.body.data.results.find((x) => x.ruleCode === 'SI_VALIDATION')).toMatchObject({ outcome: 'not-evaluated', message: 'Fair market value is not on the record' });
  });
});

describe('market mapping filters insurers', () => {
  it('refuses an insurer outside the product market on a Request for Quotation', async () => {
    const lead = await sales('post', '/leads').send({ companyName: 'Bulacan Feeds Inc.', emailId: 'ops@bulacanfeeds.example.ph', contactNumber: '0288000777', leadCategory: 'Corporate' });
    const body = { leadRefId: lead.body.leadId, productType: 'Fire and Allied Perils', riskDetails: { location: 'Malolos' }, requestedCovers: [{ cover: 'Fire', sumInsured: 20000000 }] };
    const off = await sales('post', '/broker-slips').send({ ...body, insurers: ['MALAYAN', 'MAPFRE'] });
    expect(off.status).toBe(400);
    expect(off.body.message).toContain('MAPFRE Insurance Corporation is not on the insurer market of this product');
    const on = await sales('post', '/broker-slips').send({ ...body, insurers: ['MALAYAN', 'PIONEER'] });
    expect(on.status).toBe(201);
    const add = await sales('post', `/broker-slips/${on.body.id}/insurers`).send({ insurer: 'STANDARD' });
    expect(add.status).toBe(400);
    const m = await sales('get', '/product-configurator/market?productId=4');
    expect(m.body.data.restricted).toBe(true);
    expect(m.body.data.insurers.map((i) => i.name)).toEqual(expect.arrayContaining(['Malayan Insurance Co., Inc.', 'Pioneer Insurance & Surety Corp.']));
    await q("UPDATE app_settings SET value = 'false' WHERE key = 'product.market_panel_enforced'");
    clearSettingsCache();
    expect((await sales('post', '/broker-slips').send({ ...body, insurers: ['MAPFRE'] })).status).toBe(201);
    await q("UPDATE app_settings SET value = 'true' WHERE key = 'product.market_panel_enforced'");
    clearSettingsCache();
  });

  it('declines an insurer whose own acceptance rule declines the risk on the slip', async () => {
    const t = (await q("SELECT id FROM product_templates WHERE template_code = 'PROP-FIRE-2026'"))[0];
    const r = await ctx.api('post', '/product-configurator/underwriting-rules').send({ productId: t.id, ruleCode: 'PIO_FIRE_CAP', ruleName: 'Pioneer fire cap', type: 'Acceptance',
      field: 'sumInsured', operator: '>', value: 50000000, action: 'Decline', message: 'Pioneer fire capacity is PHP 50M', insurerName: 'PIONEER' });
    expect(r.status).toBe(201);
    const lead = await sales('post', '/leads').send({ companyName: 'Pampanga Steel Corp.', emailId: 'ops@pampangasteel.example.ph', contactNumber: '0288000778', leadCategory: 'Corporate' });
    const s = await sales('post', '/broker-slips').send({ leadRefId: lead.body.leadId, productType: 'Fire and Allied Perils', requestedCovers: [{ cover: 'Fire', sumInsured: 80000000 }], insurers: ['MALAYAN', 'PIONEER'] });
    expect(s.status).toBe(400);
    expect(s.body.message).toContain('for Pioneer Insurance & Surety Corp.');
    expect(s.body.message).toContain('Pioneer fire capacity is PHP 50M');
    await ctx.api('delete', `/product-configurator/underwriting-rules/${r.body.data.id}`);
  });

  it('computes the year-to-date production of a market mapping from the policies issued', async () => {
    const l = await ctx.api('get', '/product-configurator/market-mappings?templateCode=MOT-003-2025');
    const m = l.body.data.find((x) => x.insurerName === 'Malayan Insurance Co., Inc.');
    const [{ premium }] = await q(`SELECT COALESCE(sum(premium_total), 0)::float AS premium FROM policies p JOIN insurance_companies i ON i.id = p.insurance_company_id
      WHERE p.product_id = 2 AND i.code = 'MALAYAN' AND p.status <> 'cancelled' AND to_char(COALESCE(p.issued_date, p.inception_date), 'YYYY') = $1`, [String(year)]);
    expect(m.ytdPremium).toBeCloseTo(premium, 2);
    expect(m.productMasterName).toBe('Motor Vehicle Insurance');
    expect(m.productCode).toBe('MAL-MOTOR-BASIC');
  });
});

describe('document templates in printing', () => {
  let policyId;
  let schedId;

  beforeAll(async () => {
    [{ id: policyId }] = await q("SELECT id FROM policies WHERE product_id = 2 AND lob = 'MOTOR' ORDER BY created_at LIMIT 1");
    [{ id: schedId }] = await q("SELECT c.id FROM product_components c JOIN product_templates t ON t.id = c.template_id WHERE t.template_code = 'MOT-003-2025' AND c.code = 'MOTOR_SCHED'");
  });

  it('prints the standard schedule with the product cover terms until a layout is uploaded', async () => {
    const pdf = await binary(ctx.api('get', `/document-templates/policy-schedule/${policyId}`));
    expect(pdf.status).toBe(200);
    expect(pdf.body.toString('latin1')).toContain('(Policy Schedule)');
  });

  it('refuses an invalid upload and uses a valid uploaded layout for the printed and e-mailed policy schedule', async () => {
    const wrong = await ctx.api('put', `/product-configurator/documents/${schedId}`).send({ layout: 'Policy {{PolicyNo}}', layoutFileName: 'schedule.txt' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors[0].message).toContain('PolicyNo');
    const docx = await ctx.api('put', `/product-configurator/documents/${schedId}`).send({ layout: 'Policy {{PolicyNumber}}', layoutFileName: 'schedule.docx' });
    expect(docx.status).toBe(400);
    const layout = '= Broker Motor Schedule {{PolicyNumber}}\n# Insured\nName: {{InsuredName}}\nInsurer: {{InsurerName}}\n{{#Premium}}\n# Note\nIssued under the broker agreement.';
    const up = await ctx.api('put', `/product-configurator/documents/${schedId}`).send({ layout, layoutFileName: 'motor-schedule.txt' });
    expect(up.status).toBe(200);
    expect(up.body.data.variables).toEqual(['PolicyNumber', 'InsuredName', 'InsurerName', '#Premium']);
    const pdf = await binary(ctx.api('get', `/document-templates/policy-schedule/${policyId}`));
    const text = pdf.body.toString('latin1');
    expect(text).toContain('(Broker Motor Schedule');
    expect(text).toContain('(Issued under the broker agreement.)');
    const dl = await ctx.api('get', `/product-configurator/documents/${schedId}/layout`);
    expect(dl.text).toBe(layout);
    const preview = await binary(ctx.api('get', `/product-configurator/documents/${schedId}/preview`));
    expect(preview.body.toString('latin1')).toContain('POL-SAMPLE-0001');
    const { generateDocument } = await import('../src/modules/documents/emailDocuments.js');
    const mailed = await generateDocument('policy-schedule', { policyId });
    expect(mailed.content.toString('latin1')).toContain('(Broker Motor Schedule');
    // removing the layout goes back to the standard schedule
    await ctx.api('put', `/product-configurator/documents/${schedId}`).send({ layout: null });
    const back = await binary(ctx.api('get', `/document-templates/policy-schedule/${policyId}`));
    expect(back.body.toString('latin1')).not.toContain('(Broker Motor Schedule');
  });

  it('lists the CTPL certificate among the policy documents and prints it', async () => {
    const docs = await ctx.api('get', `/policies/${policyId}/documents`);
    const cert = docs.body.data.generated.find((g) => g.type === 'ctpl-certificate');
    expect(cert).toBeTruthy();
    const path = cert.url.slice(cert.url.indexOf('/api') + 4);
    const pdf = await binary(ctx.api('get', path));
    expect(pdf.status).toBe(200);
    expect(pdf.body.toString('latin1')).toContain('Compulsory Third Party Liability');
  });
});
