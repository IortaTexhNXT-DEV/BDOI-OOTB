/**
 * AML/CFT toolkit (migrations 0260 to 0263, module aml): client onboarding before the first policy (individual and
 * juridical with signatories, beneficial owners and documents), risk-based CDD with EDD and KYC refresh, sanctions /
 * PEP / negative list screening with versioned lists, hit decisions and the provider adapter, covered and suspicious
 * transaction monitoring, cases and AMLC report files, the Compliance Officer role and the 5-year record retention.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setup, loginAs, placeAndBook } from './helpers.js';
import { query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { jaroWinkler, nameScore, normalizeName, matchEntry } from '../src/modules/aml/matching.js';
import { parseListXml } from '../src/modules/aml/screening.js';
import { FORMAT_VERSION } from '../src/modules/aml/reports.js';
import { amlTransactionMonitoring, amlKycRefreshDue, amlProviderRetry } from '../src/jobs/handlers.js';

let ctx;
let officer;
let preparer;
let checker;
const q = async (sql, p) => (await query(sql, p)).rows;
const setSetting = async (key, value) => {
  await query('UPDATE app_settings SET value = $2, updated_at = now() WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};
const PASSWORD = 'Compliance#2026';
const as = (token) => (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);

const individual = (over = {}) => ({
  clientType: 'individual', firstName: 'Ramon', middleName: 'Bautista', lastName: 'Villanueva', DOB: '1980-03-15', nationality: 'Filipino', contactNumber: '0917 123 4567',
  taxNumber: '123-456-789-000', idType: 'PhilSys National ID (PhilID / ePhilID)', idNumber: '1234-5678-9012-3456', idExpiry: '2031-03-15', province: 'Metro Manila',
  city: 'Makati City', barangay: 'Poblacion', street: 'J.P. Rizal Avenue', houseNo: '12', zipCode: '1210', occupation: 'Civil engineer', sourceOfFunds: 'Salary',
  expectedLines: ['MOTOR'], expectedPaymentMode: 'bank-transfer', expectedAnnualPremium: 35000, emailId: 'ramon.v@example.ph', ...over,
});

async function issueFor(clientId, number) {
  const [ins] = await q('SELECT id FROM insurance_companies ORDER BY id LIMIT 1');
  return placeAndBook(ctx.api, { clientId, productType: 'Comprehensive General Liability', inceptionDate: '2026-09-01',
    expiryDate: '2027-09-01', sumInsured: 1000000, netPremium: 10000, participants: [{ insuranceCompanyId: ins.id, sharePercent: 100, isLead: true }] }, { policyNumber: number });
}

beforeAll(async () => {
  ctx = await setup();
  for (const [username, roles] of [['co.officer', ['compliance-officer']], ['co.preparer', ['operations']], ['co.checker', ['accounting']]]) {
    const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName: username, roles, email: `${username}@example.ph` });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
  }
  officer = as(await loginAs(ctx.app, 'co.officer', PASSWORD));
  preparer = as(await loginAs(ctx.app, 'co.preparer', PASSWORD));
  checker = as(await loginAs(ctx.app, 'co.checker', PASSWORD));
});

describe('name matching', () => {
  it('normalises names and ignores word order, accents, honorifics and legal forms', () => {
    expect(normalizeName('Atty. José  Dela Cruz, Jr.')).toBe('JOSE DELA CRUZ');
    expect(normalizeName('Acme Trading Corp.')).toBe('ACME TRADING');
    expect(nameScore('DELA CRUZ, JUAN', 'Juan Dela Cruz')).toBe(1);
    expect(nameScore('Juan Dela Cruz', 'Juan D. Cruz')).toBeGreaterThan(0.8);
    expect(nameScore('Juan Dela Cruz', 'Maria Santos')).toBeLessThan(0.6);
    expect(jaroWinkler('MARTHA', 'MARHTA')).toBeCloseTo(0.961, 3);
  });
  it('matches aliases and lowers the score for another year of birth', () => {
    const entry = { full_name: 'Abdul Rahman Khalid', aliases: ['Abu Khalid'], birth_date: '1970-01-01' };
    expect(matchEntry('Abu Khalid', entry).score).toBe(1);
    expect(matchEntry('Abu Khalid', entry, { birthDate: '1990-05-05' }).score).toBe(0.9);
  });
  it('reads the UN consolidated list XML', () => {
    const xml = `<?xml version="1.0"?><CONSOLIDATED_LIST><INDIVIDUALS><INDIVIDUAL><DATAID>1</DATAID><FIRST_NAME>ZORAN</FIRST_NAME><SECOND_NAME>KRAVETS</SECOND_NAME>
      <REFERENCE_NUMBER>QDi.999</REFERENCE_NUMBER><NATIONALITY><VALUE>Testland</VALUE></NATIONALITY><INDIVIDUAL_ALIAS><QUALITY>Good</QUALITY><ALIAS_NAME>Zoran K.</ALIAS_NAME></INDIVIDUAL_ALIAS>
      <INDIVIDUAL_DATE_OF_BIRTH><YEAR>1966</YEAR></INDIVIDUAL_DATE_OF_BIRTH></INDIVIDUAL></INDIVIDUALS><ENTITIES><ENTITY><FIRST_NAME>Blue Harbour Front &amp; Co</FIRST_NAME>
      <REFERENCE_NUMBER>QDe.888</REFERENCE_NUMBER><ENTITY_ALIAS><ALIAS_NAME>BHF</ALIAS_NAME></ENTITY_ALIAS></ENTITY></ENTITIES></CONSOLIDATED_LIST>`;
    expect(parseListXml(xml)).toEqual([
      { entryRef: 'QDi.999', entityType: 'individual', fullName: 'ZORAN KRAVETS', aliases: ['Zoran K.'], birthDate: '1966', nationality: 'Testland', remarks: null },
      { entryRef: 'QDe.888', entityType: 'entity', fullName: 'Blue Harbour Front & Co', aliases: ['BHF'], birthDate: null, nationality: null, remarks: null },
    ]);
  });
});

describe('client onboarding before the first policy (1.01, 1.02, 1.05)', () => {
  it('validates the Philippine mobile number, TIN and the identification of an individual', async () => {
    const bad = await ctx.api('post', '/clients/onboard').send(individual({ contactNumber: '12345', taxNumber: 'ABC', idNumber: '' }));
    expect(bad.status).toBe(400);
    const paths = bad.body.errors.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['contactNumber', 'taxNumber', 'idNumber']));
  });

  it('creates an individual client with its identification, rated and screened, without any policy', async () => {
    const r = await preparer('post', '/clients/onboard').send(individual());
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const c = r.body.data.client;
    expect(c).toMatchObject({ clientType: 'individual', onboardedVia: 'onboarding', nationality: 'Filipino', middleName: 'Bautista', contactNumber: '09171234567', idExpiry: '2031-03-15',
      city: 'Makati City', province: 'Metro Manila', riskRating: 'low', kycStatus: 'complete', policies: [] });
    expect(c.region).toBeTruthy();
    expect(r.body.data.aml.assessment).toMatchObject({ trigger: 'onboarding', rating: 'low', score: 0 });
    expect(r.body.data.aml.screening).toMatchObject({ hits: 0 });
    const [scr] = await q("SELECT event, status FROM aml_screenings WHERE client_id = $1", [c.id]);
    expect(scr).toEqual({ event: 'onboarding', status: 'clear' });
    // the next refresh of a Low client is 36 months away
    expect(c.kycNextReviewOn > '2029-01-01').toBe(true);
  });

  it('keeps the creation at policy issue working (direct placement for a new insured)', async () => {
    const [ins] = await q('SELECT id FROM insurance_companies ORDER BY id LIMIT 1');
    const r = await placeAndBook(ctx.api, { companyName: 'Walk-in Bakery Inc.', productType: 'Comprehensive General Liability',
      inceptionDate: '2026-09-01', netPremium: 5000, participants: [{ insuranceCompanyId: ins.id, sharePercent: 100, isLead: true }] }, { policyNumber: 'AML-WALKIN-1' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const [c] = await q('SELECT c.onboarded_via, c.risk_rating, c.kyc_status FROM clients c JOIN policies p ON p.client_id = c.id WHERE p.policy_number = $1', ['AML-WALKIN-1']);
    expect(c).toEqual({ onboarded_via: 'policy-issue', risk_rating: 'low', kyc_status: 'pending' });
  });

  it('onboards a juridical client with registration, signatories, beneficial owners and the board resolution', async () => {
    const missing = await ctx.api('post', '/clients/onboard').send({ clientType: 'corporate', companyName: 'Northwind Logistics Corp.', contactNumber: '09181234567', city: 'Cebu City', province: 'Cebu' });
    expect(missing.status).toBe(400);
    expect(missing.body.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['registrationAuthority', 'registrationNumber', 'taxNumber']));
    const r = await ctx.api('post', '/clients/onboard').send({
      clientType: 'corporate', customerType: 'CORPORATION', companyName: 'Northwind Logistics Corp.', tradeName: 'Northwind Express', registrationAuthority: 'SEC', registrationNumber: 'CS201912345',
      registrationDate: '2019-06-01', taxNumber: '009-876-543-000', businessNature: 'Freight forwarding', incorporationCountry: 'Philippines', contactNumber: '09181234567',
      province: 'Cebu', city: 'Cebu City', expectedLines: ['MARINE'], expectedPaymentMode: 'check', expectedAnnualPremium: 750000,
      signatories: [{ fullName: 'Liza Mercado', position: 'Treasurer', authorityDocument: 'secretary-certificate', authorityReference: 'SC-2026-014', authorityDate: '2026-08-15' }],
      beneficialOwners: [{ fullName: 'Victor Lim', ownershipPercent: 60, controlType: 'ownership', nationality: 'Filipino' }, { fullName: 'Ana Lim', ownershipPercent: 40, nationality: 'Filipino' }],
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const id = r.body.data.client.id;
    // corporation 2 + Philippines 0 + marine 1 + cheque 1 + premium 500k to 2M 2 = 6: Normal
    expect(r.body.data.aml.assessment).toMatchObject({ rating: 'normal', score: 6 });
    expect(r.body.data.aml.assessment.factors.map((f) => f.factor)).toEqual(['client-type', 'nationality', 'pep', 'line', 'payment-mode', 'premium-size', 'geography']);
    const p = await officer('get', `/aml/clients/${id}/profile`);
    expect(p.status).toBe(200);
    expect(p.body.data.client).toMatchObject({ clientType: 'corporate', kycStatus: 'complete', riskRating: 'normal' });
    expect(p.body.data.signatories).toHaveLength(1);
    expect(p.body.data.beneficialOwners.map((o) => o.fullName)).toEqual(['Victor Lim', 'Ana Lim']);
    expect(p.body.data.ownerWarnings).toEqual([]);
    expect(p.body.data.screenings.length).toBe(5); // registered and trade name, two owners, one signatory
    // board resolution / secretary's certificate of the signatory
    const sig = p.body.data.signatories[0];
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const up = await ctx.api('post', `/aml/clients/${id}/documents`).field('docType', 'secretary-certificate').field('relatedType', 'signatory').field('relatedId', sig.id)
      .attach('file', pdf, 'secretary-certificate.pdf');
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    expect(up.body.data).toMatchObject({ docType: 'secretary-certificate', relatedType: 'signatory', relatedId: sig.id, fileName: 'secretary-certificate.pdf' });
    expect((await ctx.api('post', `/aml/clients/${id}/documents`).field('relatedType', 'signatory').field('relatedId', 'sig_nope').attach('file', pdf, 'x.pdf')).status).toBe(400);
    // a 10% owner below the configurable 25% threshold is flagged
    const small = await ctx.api('post', `/aml/clients/${id}/beneficial-owners`).send({ fullName: 'Paolo Lim', ownershipPercent: 10 });
    expect(small.status).toBe(201);
    const warn = (await officer('get', `/aml/clients/${id}/profile`)).body.data.ownerWarnings;
    expect(warn.join(' ')).toContain('more than 100%');
    expect(warn.join(' ')).toContain('less than 25%');
    await setSetting('aml.beneficial_owner_threshold', 10);
    expect((await officer('get', `/aml/clients/${id}/profile`)).body.data.ownerWarnings.join(' ')).not.toContain('less than');
    await setSetting('aml.beneficial_owner_threshold', 25);
    expect((await ctx.api('put', `/aml/clients/${id}/beneficial-owners/${small.body.data.id}`).send({ status: 'removed' })).status).toBe(200);
    // signatories are for juridical clients only
    const [ind] = await q("SELECT id FROM clients WHERE onboarded_via = 'onboarding' AND client_type = 'individual' LIMIT 1");
    expect((await ctx.api('post', `/aml/clients/${ind.id}/signatories`).send({ fullName: 'Someone Else' })).status).toBe(400);
  });
});

describe('risk-based CDD, EDD and KYC refresh (1.04)', () => {
  let pepId;
  it('rates a PEP High, opens an EDD review and refuses the policy until the compliance officer approves it', async () => {
    const r = await preparer('post', '/clients/onboard').send(individual({ firstName: 'Corazon', lastName: 'Alvarado', idNumber: '9999-0000-1111-2222', isPep: true, pepDetails: 'Municipal mayor', emailId: 'c.alvarado@example.ph' }));
    expect(r.status).toBe(201);
    pepId = r.body.data.client.id;
    expect(r.body.data.aml.assessment).toMatchObject({ rating: 'high' });
    expect(r.body.data.aml.assessment.reasons).toContain('Politically exposed person');
    expect(r.body.data.client.kycStatus).toBe('edd-required');
    const edd = r.body.data.aml.assessment.eddReview;
    expect(edd.reviewNumber).toMatch(/^EDD-\d{4}-\d{5}$/);
    // policy issue refused without an approved EDD review
    const blocked = await issueFor(pepId, 'AML-PEP-1');
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toContain('enhanced due diligence');
    expect((await q("SELECT count(*)::int AS n FROM policies WHERE policy_number = 'AML-PEP-1'"))[0].n).toBe(0);
    // preparer records and submits; incomplete first
    expect((await preparer('post', `/aml/edd-reviews/${edd.id}/submit`)).status).toBe(400);
    expect((await preparer('put', `/aml/edd-reviews/${edd.id}`).send({ sourceOfWealth: 'Inherited farmland and rental income', sourceOfFunds: 'Rental income',
      purpose: 'Motor and home insurance', findings: 'Title deeds and lease contracts seen', seniorManagementApproval: true })).status).toBe(200);
    const pdf = Buffer.from('%PDF-1.4\n%%EOF');
    expect((await preparer('post', `/aml/clients/${pepId}/documents`).field('docType', 'edd-evidence').field('relatedType', 'edd').field('relatedId', edd.id).attach('file', pdf, 'lease.pdf')).status).toBe(201);
    expect((await preparer('post', `/aml/edd-reviews/${edd.id}/submit`)).status).toBe(200);
    // the preparer cannot approve (no approve:aml); the approval is the compliance officer's
    expect((await preparer('post', `/aml/edd-reviews/${edd.id}/decide`).send({ decision: 'approve' })).status).toBe(403);
    const ok = await officer('post', `/aml/edd-reviews/${edd.id}/decide`).send({ decision: 'approve', notes: 'Source of wealth documented' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data).toMatchObject({ status: 'approved', documents: [expect.objectContaining({ fileName: 'lease.pdf' })] });
    expect((await issueFor(pepId, 'AML-PEP-1')).status).toBe(201);
    const [a] = await q("SELECT trigger, rating FROM aml_risk_assessments WHERE client_id = $1 ORDER BY id DESC LIMIT 1", [pepId]);
    expect(a).toEqual({ trigger: 'policy-issue', rating: 'high' });
  });

  it('the officer who submits an EDD review cannot also approve it', async () => {
    const e = await officer('post', '/aml/edd-reviews').send({ clientId: pepId, reason: 'Second review for the test' });
    expect(e.status).toBe(201);
    await officer('put', `/aml/edd-reviews/${e.body.data.id}`).send({ sourceOfWealth: 'Business', sourceOfFunds: 'Business', purpose: 'Insurance', findings: 'Seen' });
    expect((await officer('post', `/aml/edd-reviews/${e.body.data.id}/submit`)).status).toBe(200);
    const self = await officer('post', `/aml/edd-reviews/${e.body.data.id}/decide`).send({ decision: 'approve' });
    expect(self.status).toBe(403);
    expect(self.body.message).toContain('Maker-checker');
  });

  it('scores the configurable factors and thresholds; an override holds until the KYC refresh', async () => {
    const add = await officer('post', '/aml/risk-factors').send({ factor: 'geography', matchValue: 'Makati City', score: 9, description: 'Test geography' });
    expect(add.status).toBe(201);
    const [c] = await q("SELECT id FROM clients WHERE first_name = 'Ramon' AND last_name = 'Villanueva'");
    const high = await officer('post', `/aml/clients/${c.id}/assess`);
    expect(high.body.data).toMatchObject({ rating: 'high', score: 9 });
    expect((await officer('delete', `/aml/risk-factors/${add.body.data.id}`)).status).toBe(200);
    expect((await officer('post', `/aml/clients/${c.id}/assess`)).body.data.rating).toBe('low');
    expect((await preparer('post', `/aml/clients/${c.id}/override`).send({ rating: 'normal', reason: 'Adverse media' })).status).toBe(403);
    const o = await officer('post', `/aml/clients/${c.id}/override`).send({ rating: 'normal', reason: 'Adverse media on the employer' });
    expect(o.body.data).toMatchObject({ trigger: 'override', rating: 'normal', computedRating: 'low' });
    expect((await officer('post', `/aml/clients/${c.id}/assess`)).body.data.rating).toBe('normal');
    const refreshed = await officer('post', `/aml/clients/${c.id}/kyc-refresh`).send({ notes: 'Called the client' });
    expect(refreshed.body.data).toMatchObject({ trigger: 'refresh', rating: 'low' });
    // settings: the low and high limits are validated together
    expect((await officer('put', '/aml/settings').send({ settings: { 'aml.risk_low_max_score': 9 } })).status).toBe(400);
    expect((await officer('put', '/aml/settings').send({ settings: { 'aml.screening_provider': { provider: 'http', apiKey: 'secret' } } })).status).toBe(400);
  });

  it('lists the clients due for KYC refresh per the schedule and the weekly job marks them', async () => {
    const [c] = await q("SELECT id FROM clients WHERE first_name = 'Ramon' AND last_name = 'Villanueva'");
    await query("UPDATE clients SET kyc_next_review_on = CURRENT_DATE - 1 WHERE id = $1", [c.id]);
    const due = await officer('get', '/aml/kyc-refresh');
    expect(due.body.data.find((d) => d.clientId === c.id)).toMatchObject({ overdue: true });
    const job = await amlKycRefreshDue();
    expect(job.markedDue).toBeGreaterThanOrEqual(1);
    expect((await q('SELECT kyc_status FROM clients WHERE id = $1', [c.id]))[0].kyc_status).toBe('refresh-due');
    await officer('post', `/aml/clients/${c.id}/kyc-refresh`).send({});
    expect((await q('SELECT kyc_status FROM clients WHERE id = $1', [c.id]))[0].kyc_status).toBe('complete');
  });
});

describe('sanctions, PEP and negative list screening (1.06)', () => {
  let internalId;
  let clientId;
  it('loads a versioned list from CSV and rescreens every client: a new match is queued', async () => {
    const lists = (await officer('get', '/aml/lists')).body.data;
    expect(lists.map((l) => l.code)).toEqual(['UNSC', 'AMLC', 'PEP', 'INTERNAL']);
    const pep = lists.find((l) => l.code === 'PEP');
    internalId = lists.find((l) => l.code === 'INTERNAL').id;
    const csv = 'Name,Aliases,Type,Birth Date,Nationality,Reference,Remarks\nRamon B. Villanueva,Mon Villanueva,individual,1980,Filipino,PEP-001,Barangay captain\nNobody Atall,,individual,,,PEP-002,\n';
    const r = await officer('post', `/aml/lists/${pep.id}/versions`).field('publicationDate', '2026-10-01').attach('file', Buffer.from(csv), 'pep.csv');
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.version).toMatchObject({ versionNo: 1, entries: 2, format: 'csv' });
    expect(r.body.data.rescreen.newOpenHits).toBe(1);
    const hits = (await officer('get', '/aml/hits?status=open')).body.data;
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ partyName: 'Ramon Bautista Villanueva', listCode: 'PEP', entryRef: 'PEP-001', status: 'open', event: 'rescreen' });
    clientId = hits[0].clientId;
    // a second version keeps the first
    await officer('post', `/aml/lists/${pep.id}/versions`).field('rescreen', 'false').attach('file', Buffer.from(csv), 'pep-v2.csv');
    const versions = (await officer('get', `/aml/lists/${pep.id}/versions`)).body.data;
    expect(versions.map((v) => [v.versionNo, v.current])).toEqual([[2, true], [1, false]]);
    expect(versions[1].rescreen).toMatchObject({ newOpenHits: 1 });
  });

  it('refuses the policy while the hit is open; once cleared the same match is cleared again automatically', async () => {
    const blocked = await issueFor(clientId, 'AML-HIT-1');
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toContain('Compliance > Screening Hits');
    const [hit] = (await officer('get', '/aml/hits?status=open')).body.data;
    expect((await preparer('post', `/aml/hits/${hit.id}/decide`).send({ decision: 'clear', reason: 'Different person' })).status).toBe(403);
    const d = await officer('post', `/aml/hits/${hit.id}/decide`).send({ decision: 'clear', reason: 'Different middle name and place of birth; not the barangay captain' });
    expect(d.status).toBe(200);
    expect(d.body.data.status).toBe('cleared');
    expect((await issueFor(clientId, 'AML-HIT-1')).status).toBe(201);
    const [auto] = await q("SELECT status, decision_reason FROM aml_screening_hits WHERE client_id = $1 ORDER BY id DESC LIMIT 1", [clientId]);
    expect(auto.status).toBe('cleared');
    expect(auto.decision_reason).toContain('Cleared before by');
    const audit = await q("SELECT action FROM audit_log WHERE entity = 'aml_screening_hit' AND entity_id = $1", [String(hit.id)]);
    expect(audit.map((x) => x.action)).toEqual(['clear']);
  });

  it('internal negative list: an entry added on screen makes a version and a confirmed match blocks payouts', async () => {
    const add = await officer('post', `/aml/lists/${internalId}/entries`).send({ fullName: 'Northwind Logistics', entityType: 'entity', reason: 'Staged claims in 2025' });
    expect(add.status, JSON.stringify(add.body)).toBe(201);
    expect(add.body.data.version.format).toBe('manual');
    const [hit] = (await officer('get', '/aml/hits?status=open&listCode=INTERNAL')).body.data;
    expect(hit.partyName).toBe('Northwind Logistics Corp.');
    const esc = await officer('post', `/aml/hits/${hit.id}/decide`).send({ decision: 'escalate', reason: 'Check the 2025 claims file' });
    expect(esc.body.data).toMatchObject({ status: 'escalated', caseNumber: expect.stringMatching(/^AMC-/) });
    const conf = await officer('post', `/aml/hits/${hit.id}/decide`).send({ decision: 'confirm', reason: 'Same SEC registration as the 2025 claimant' });
    expect(conf.body.data.status).toBe('confirmed');
    const [c] = await q('SELECT risk_rating, kyc_status FROM clients WHERE id = $1', [hit.clientId]);
    expect(c).toEqual({ risk_rating: 'high', kyc_status: 'blocked' });
    // a refund cheque to the client is stopped at approval (the screening is recorded, the posting rolled back)
    const [cl] = await q('SELECT client_code, display_name FROM clients WHERE id = $1', [hit.clientId]);
    const v = await ctx.api('post', '/disbursements').send({ voucherDate: '2026-10-01', payeeType: 'Customer', criteria: 'Specific', customerCode: cl.client_code, transactionCode: 'REFUND',
      instrumentCurrency: 'PHP', amount: '1500.00' });
    expect(v.status, JSON.stringify(v.body)).toBe(201);
    const chq = await ctx.api('post', '/disbursements/checkbook').send({ customerCode: cl.client_code, customerName: cl.display_name, mainAccount: '1102001', instrumentBookId: 'BDO-CB-01',
      instrumentNo: '000901', instrumentDate: '2026-10-01', totaleAmount: '1500', status: 'Pending', disbursementId: v.body.data.disbursementId });
    expect(chq.status, JSON.stringify(chq.body)).toBe(201);
    const approve = await checker('put', `/disbursements/checkbook/${chq.body.data.checkbookId}`).send({ status: 'Approved', totaleAmount: '1500' });
    expect(approve.status, JSON.stringify(approve.body)).toBe(409);
    expect(approve.body.message).toContain('confirmed');
    expect((await q('SELECT status FROM checkbooks WHERE id = $1', [chq.body.data.checkbookId]))[0].status).toBe('Pending');
    const [s] = await q("SELECT event, reference_type, reference_id FROM aml_screenings WHERE event = 'payout' ORDER BY id DESC LIMIT 1");
    expect(s).toEqual({ event: 'payout', reference_type: 'disbursement', reference_id: v.body.data.disbursementId });
  });

  it('removing an entry needs a reason and makes a new version', async () => {
    const entries = (await officer('get', `/aml/lists/${internalId}/entries`)).body.data;
    expect((await officer('delete', `/aml/lists/${internalId}/entries/${entries[0].id}`)).status).toBe(400);
    const r = await officer('delete', `/aml/lists/${internalId}/entries/${entries[0].id}?reason=${encodeURIComponent('Entered under the wrong list')}`);
    expect(r.status).toBe(200);
    expect(r.body.data.version.entries).toBe(0);
  });

  it('uploads the UN consolidated list as XML with its checksum and searches its entries', async () => {
    const [un] = await q("SELECT id FROM aml_screening_lists WHERE code = 'UNSC'");
    const xml = '<?xml version="1.0"?><CONSOLIDATED_LIST><INDIVIDUALS><INDIVIDUAL><FIRST_NAME>QUENTIN</FIRST_NAME><SECOND_NAME>OKONKWO-BRAGA</SECOND_NAME><REFERENCE_NUMBER>QDi.901</REFERENCE_NUMBER>'
      + '</INDIVIDUAL></INDIVIDUALS><ENTITIES></ENTITIES></CONSOLIDATED_LIST>';
    const r = await officer('post', `/aml/lists/${un.id}/versions`).attach('file', Buffer.from(xml), 'consolidated.xml');
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.version).toMatchObject({ format: 'xml', entries: 1, checksum: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await officer('get', `/aml/lists/${un.id}/entries?search=okonkwo`)).body.data.map((e) => e.entryRef)).toEqual(['QDi.901']);
    expect((await officer('post', `/aml/lists/${un.id}/versions`).attach('file', Buffer.from('Name\n'), 'empty.csv')).status).toBe(400);
  });

  it('screens through the provider adapter in test mode, logs every request and retries failures', async () => {
    expect((await officer('post', '/aml/provider/test').send({ name: 'x' })).status).toBe(400);
    await setSetting('aml.screening_provider', { provider: 'fake', endpoint: '', apiKeyEnv: 'AML_SCREENING_API_KEY', mode: 'sandbox', timeoutMs: 5000, maxAttempts: 2 });
    const cfg = await officer('get', '/aml/provider');
    expect(cfg.body.data).toMatchObject({ provider: 'fake', mode: 'sandbox', apiKeySet: false });
    expect(JSON.stringify(cfg.body.data)).not.toContain('apiKey"');
    const hit = await officer('post', '/aml/screen').send({ name: 'Sanctioned Trading Example' });
    expect(hit.body.data).toMatchObject({ hits: 1, openHits: 1 });
    const down = await officer('post', '/aml/screen').send({ name: 'Provider Down Example' });
    expect(down.body.data.status).toBe('provider-pending');
    const failed = (await officer('get', '/aml/provider/requests?status=failed')).body.data;
    expect(failed).toHaveLength(1);
    await query("UPDATE aml_provider_requests SET next_attempt_at = now() - interval '1 minute' WHERE id = $1", [failed[0].id]);
    const job = await amlProviderRetry();
    expect(job).toMatchObject({ retried: 1, failed: 1 });
    expect((await q('SELECT status FROM aml_provider_requests WHERE id = $1', [failed[0].id]))[0].status).toBe('abandoned');
    // the http adapter reads the key from the environment variable named in the setting, never a stored value
    await setSetting('aml.screening_provider', { provider: 'http', endpoint: 'http://127.0.0.1:9/screen', apiKeyEnv: 'AML_TEST_KEY_NOT_SET', mode: 'sandbox', timeoutMs: 1000, maxAttempts: 3 });
    const t = await officer('post', '/aml/provider/test').send({ name: 'Anyone' });
    expect(t.body.data.ok).toBe(false);
    expect(t.body.data.error).toContain('AML_TEST_KEY_NOT_SET');
    await setSetting('aml.screening_provider', { provider: 'lists', endpoint: '', apiKeyEnv: 'AML_SCREENING_API_KEY', mode: 'sandbox', timeoutMs: 10000, maxAttempts: 5 });
  });
});

describe('covered and suspicious transactions, cases and AMLC reports (1.07)', () => {
  let client;
  let ctrAlert;
  it('flags cash above PHP 500,000 in one banking day and structured cash below it', async () => {
    [client] = await q("SELECT id, client_code, display_name FROM clients WHERE first_name = 'Ramon' AND last_name = 'Villanueva'");
    const ins = async (amount, date, mode = 'cash', name = null) => query(`INSERT INTO receipts(receipt_number, client_id, amount, payment_mode, received_date, receipt_status, customer_code, customer_name)
      VALUES ('OR-AML-' || substr(md5(random()::text), 1, 8), $1, $2, $3, $4, 'Posted', $5, $6)`, [client.id, amount, mode, date, client.client_code, name || client.display_name]);
    await ins(300000, '2026-09-10');
    await ins(250000, '2026-09-10');
    await ins(450000, '2026-09-11', 'bank-transfer');
    for (const d of ['2026-09-20', '2026-09-22', '2026-09-24']) await ins(150000, d);
    await ins(20000, '2026-09-25', 'check', 'Alberto Uy Trading');
    const r = await officer('post', '/aml/monitoring/run').send({ from: '2026-09-01', to: '2026-09-30' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.added).toMatchObject({ CT_CASH: 1, STR_STRUCTURING: 1, STR_PAYER_DIFFERS: 1 });
    const again = await officer('post', '/aml/monitoring/run').send({ from: '2026-09-01', to: '2026-09-30' });
    expect(again.body.data.total).toBe(0);
    const covered = (await officer('get', '/aml/alerts?kind=covered')).body.data;
    expect(covered).toHaveLength(1);
    ctrAlert = covered[0];
    expect(ctrAlert).toMatchObject({ ruleCode: 'CT_CASH', amount: 550000, transactionDate: '2026-09-10', clientId: client.id, status: 'open' });
    // a covered transaction is reported, not closed
    expect((await officer('post', `/aml/alerts/${ctrAlert.id}/close`).send({ reason: 'Not needed here' })).status).toBe(409);
    // the threshold is a setting: one receipt alone is never above PHP 500,000 here
    await setSetting('aml.covered_aggregation', 'single');
    const single = await officer('post', '/aml/monitoring/run').send({ from: '2026-09-10', to: '2026-09-10' });
    expect(single.body.data.added.CT_CASH).toBe(0);
    await setSetting('aml.covered_aggregation', 'banking-day');
  });

  it('generates the CTR file in the AMLC layout, marks it submitted and keeps the alerts reported', async () => {
    await setSetting('aml.amlc_institution_code', 'IB-0001');
    const r = await officer('post', '/aml/reports/ctr').send({ from: '2026-09-01', to: '2026-09-30' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data).toMatchObject({ reportType: 'CTR', transactions: 2, totalAmount: 550000, formatVersion: FORMAT_VERSION, status: 'generated' });
    const file = await officer('get', `/aml/reports/${r.body.data.id}/download`);
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toContain('_CTR.txt');
    const lines = file.text.trim().split('\r\n');
    expect(lines[0]).toMatch(/^H\|IB-0001\|CTR\|AMR-\d{4}-\d{5}\|\d{4}-\d{2}-\d{2}\|2026-09-01\|2026-09-30\|2\|BV-AMLC-TXN 1\.0$/);
    expect(lines[1].split('|').slice(0, 9)).toEqual(['D', '1', '2026-09-10', expect.stringMatching(/^OR-AML-/), 'PPC', '300000.00', 'PHP', 'cash', 'I']);
    expect(lines[1]).toContain('|Villanueva|Ramon|Bautista|');
    expect(lines[lines.length - 1]).toBe('T|2|550000.00');
    expect((await officer('post', '/aml/reports/ctr').send({ from: '2026-09-01', to: '2026-09-30' })).status).toBe(409);
    const sub = await officer('post', `/aml/reports/${r.body.data.id}/submit`).send({ submittedOn: '2026-10-02', amlcReference: 'AMLC-ACK-778' });
    expect(sub.body.data).toMatchObject({ status: 'submitted', amlcReference: 'AMLC-ACK-778' });
    expect((await officer('get', `/aml/alerts?kind=covered`)).body.data[0].status).toBe('reported');
  });

  it('works an STR case from alerts to the filed report with the due date in working days', async () => {
    const [struct] = (await officer('get', '/aml/alerts?ruleCode=STR_STRUCTURING')).body.data;
    const c = await officer('post', '/aml/cases').send({ caseType: 'STR', alertIds: [struct.id], title: 'Cash split below the threshold', suspicionOn: '2026-10-02' });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    // 2 October 2026 is a Friday: one working day later is Monday 5 October
    expect(c.body.data).toMatchObject({ caseType: 'STR', status: 'open', dueOn: '2026-10-05', clientId: client.id });
    expect((await officer('post', `/aml/cases/${c.body.data.id}/approve`)).status).toBe(400);
    await officer('put', `/aml/cases/${c.body.data.id}`).send({ narrative: 'Three cash payments of PHP 150,000 within five days\nNo business reason given', suspicionReasons: ['structuring'] });
    expect((await preparer('post', `/aml/cases/${c.body.data.id}/approve`)).status).toBe(403);
    expect((await officer('post', `/aml/cases/${c.body.data.id}/approve`)).body.data.status).toBe('for-filing');
    const rep = await officer('post', `/aml/cases/${c.body.data.id}/report`);
    expect(rep.status).toBe(201);
    const text = (await officer('get', `/aml/reports/${rep.body.data.id}/download`)).text;
    expect(text).toContain('|STR|');
    expect(text).toContain('N|Three cash payments of PHP 150,000 within five days');
    expect(text).toContain('|structuring|');
    await officer('post', `/aml/reports/${rep.body.data.id}/submit`).send({ amlcReference: 'STR-ACK-1' });
    expect((await officer('get', `/aml/cases/${c.body.data.id}`)).body.data).toMatchObject({ status: 'filed', amlcReference: 'STR-ACK-1' });
  });

  it('flags a refund to a third party, an overpayment refunded and an early cancellation with return premium', async () => {
    const [pol] = await q("SELECT id, policy_number, inception_date FROM policies WHERE policy_number = 'AML-HIT-1'");
    const [owner] = await q('SELECT c.id, c.client_code, c.display_name FROM clients c JOIN policies p ON p.client_id = c.id WHERE p.id = $1', [pol.id]);
    await query(`INSERT INTO receipts(receipt_number, client_id, policy_id, amount, payment_mode, received_date, receipt_status, customer_code, customer_name)
      VALUES ('OR-AML-OVER', $1, $2, 30000, 'bank-transfer', '2026-09-26', 'Posted', $3, $4)`, [owner.id, pol.id, owner.client_code, owner.display_name]);
    await query(`INSERT INTO disbursements(voucher_number, payee_type, payee_id, payee_name, amount, status, voucher_date, client_id, customer_code, policy_id, policy_number)
      VALUES ('PV-AML-3P', 'Customer', $1, 'Dante Sison', 18000, 'approved', '2026-09-28', $1, $2, $3, $4)`, [owner.id, owner.client_code, pol.id, pol.policy_number]);
    await query(`INSERT INTO endorsements(endorsement_number, policy_id, client_id, endorsement_type, status, premium_delta, effective_date, is_cancel)
      VALUES ('END-AML-CXL', $1, $2, 'Cancellation', 'completed', -18000, '2026-09-27', true)`, [pol.id, owner.id]);
    const r = await officer('post', '/aml/monitoring/run').send({ from: '2026-09-26', to: '2026-09-30' });
    expect(r.body.data.added).toMatchObject({ STR_THIRD_PARTY_PAYOUT: 1, STR_OVERPAYMENT_REFUND: 1, STR_EARLY_CANCEL: 1 });
    const [cxl] = (await officer('get', '/aml/alerts?ruleCode=STR_EARLY_CANCEL')).body.data;
    expect(cxl).toMatchObject({ severity: 'high', details: expect.objectContaining({ thirdPartyRefund: true, daysAfterInception: 26 }) });
    // rule parameters are settings of the compliance officer
    expect((await officer('put', '/aml/rules/STR_EARLY_CANCEL').send({ params: { days: -1 } })).status).toBe(400);
    expect((await officer('put', '/aml/rules/STR_EARLY_CANCEL').send({ params: { days: 30 }, enabled: false })).body.data).toMatchObject({ enabled: false, params: { days: 30 } });
  });

  it('screens the claimant at a claim payment through the same payout check', async () => {
    const { atPayout } = await import('../src/modules/aml/hooks.js');
    const [internal] = await q("SELECT id FROM aml_screening_lists WHERE code = 'INTERNAL'");
    await officer('post', `/aml/lists/${internal.id}/entries`).send({ fullName: 'Rosauro Q. Fakename', reason: 'Known fraudster' });
    await expect(atPayout({ clientId: client.id, payeeName: 'Rosauro Fakename', referenceType: 'claim', referenceId: 'clm_test', userId: null })).rejects.toThrow(/Payment to Rosauro Fakename is stopped/);
    const [s] = await q("SELECT party_type, status FROM aml_screenings WHERE reference_type = 'claim' AND reference_id = 'clm_test'");
    expect(s).toEqual({ party_type: 'payee', status: 'potential-match' });
    await setSetting('aml.screening_block_events', ['policy-issue']);
    await expect(atPayout({ clientId: client.id, payeeName: 'Rosauro Fakename', referenceType: 'claim', referenceId: 'clm_test2', userId: null })).resolves.toBeUndefined();
    await setSetting('aml.screening_block_events', ['policy-issue', 'payout']);
  });

  it('closes a suspicious alert with a reason; the daily job runs the rules', async () => {
    const [payer] = (await officer('get', '/aml/alerts?ruleCode=STR_PAYER_DIFFERS')).body.data;
    expect(payer.summary).toContain('Alberto Uy Trading');
    expect((await officer('post', `/aml/alerts/${payer.id}/close`).send({ reason: 'Employer pays the premium; letter on file' })).body.data.status).toBe('closed');
    const job = await amlTransactionMonitoring({ days: 2 });
    expect(job).toHaveProperty('total');
  });

  it('shows the counts on the AML dashboard and keeps AML records for 5 years', async () => {
    const d = await officer('get', '/aml/dashboard');
    expect(d.status).toBe(200);
    expect(d.body.data.ratings.high).toBeGreaterThanOrEqual(2);
    expect(d.body.data.confirmedHits).toBe(1);
    expect(d.body.data).toHaveProperty('refreshDue');
    expect(d.body.data.casesOpen).toBeGreaterThanOrEqual(1);
    const dry = await ctx.api('get', `/privacy/parties/client/${client.id}/anonymise/dry-run`);
    expect(dry.status).toBe(200);
    expect(dry.body.data.blockers.map((b) => b.code)).toContain('aml-retention');
    expect((await q("SELECT value FROM app_settings WHERE key = 'aml.record_retention_years'"))[0].value).toBe(5);
    expect((await officer('put', '/aml/settings').send({ settings: { 'aml.record_retention_years': 3 } })).status).toBe(400);
  });
});

describe('compliance officer role', () => {
  it('holds the AML permissions and reads clients, but cannot post receipts', async () => {
    const [role] = await q(`SELECT array_agg(p.code ORDER BY p.code) AS perms FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id WHERE r.code = 'compliance-officer'`);
    expect(role.perms).toEqual(expect.arrayContaining(['read:aml', 'write:aml', 'approve:aml', 'read:clients', 'write:clients', 'read:policies', 'read:receipts']));
    expect(role.perms).not.toContain('write:receipts');
    expect((await officer('get', '/clients?page=1&pageSize=5')).status).toBe(200);
    expect((await preparer('get', '/aml/dashboard')).status).toBe(403);
    expect((await preparer('get', '/aml/edd-reviews')).status).toBe(200);
  });
});
