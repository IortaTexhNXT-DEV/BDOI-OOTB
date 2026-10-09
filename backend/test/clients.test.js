import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, createOwnBookRole } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
let sales;
let finance;
let agent;

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('c.sales', ['sales']);
  finance = await persona('c.finance', ['accounting']);
  agent = await persona('c.agent', [await createOwnBookRole(ctx.api)]);
});
afterAll(async () => { await pool.end(); });

describe('clients', () => {
  let clientId;
  it('lists clients in the { data: { clients, pagination } } shape', async () => {
    const r = await sales('get', '/clients?page=1&pageSize=5');
    expect(r.body.data.clients.length).toBe(5);
    expect(r.body.data.pagination).toMatchObject({ page: 1, pageSize: 5 });
    expect(r.body.data.pagination.totalCount).toBeGreaterThanOrEqual(10);
    const s = await sales('get', '/clients?search=Kalayaan');
    expect(s.body.data.clients[0].companyName).toBe('Kalayaan Foods Distribution Corp.');
  });
  it('filters the list by client type on the server (the Individual / Company tabs page through all clients)', async () => {
    const all = (await sales('get', '/clients?page=1&pageSize=500')).body.data;
    const corporate = (await sales('get', '/clients?clientType=corporate&page=1&pageSize=2')).body.data;
    const individual = (await sales('get', '/clients?clientType=Individual&page=1&pageSize=500')).body.data;
    expect(corporate.clients.length).toBeLessThanOrEqual(2);
    expect(corporate.clients.every((c) => c.clientType === 'corporate')).toBe(true);
    expect(individual.clients.every((c) => c.clientType === 'individual')).toBe(true);
    expect(corporate.pagination.totalCount).toBe(all.clients.filter((c) => c.clientType === 'corporate').length);
    expect(corporate.pagination.totalCount + individual.pagination.totalCount).toBe(all.pagination.totalCount);
  });
  it('returns a client with its policies (by id or code)', async () => {
    const r = await sales('get', '/clients/cl_sls_01');
    expect(r.body.clientId).toBe('cl_sls_01');
    expect(r.body.generatedClientId).toMatch(/^CL-/);
    expect(r.body.policies[0].policyNumber).toMatch(/^POL-/);
    expect(r.body.data.firstName).toBe('Miguel');
    expect((await sales('get', `/clients/${r.body.generatedClientId}`)).body.clientId).toBe('cl_sls_01');
    expect((await sales('get', '/clients/cl_missing')).status).toBe(404);
  });
  it('creates and updates a client', async () => {
    const c = await sales('post', '/clients').send({ firstName: 'Olivia', lastName: 'Chua', emailId: 'olivia@example.ph', leadCategory: 'Retail', city: 'Taguig' });
    expect(c.status).toBe(201);
    clientId = c.body.clientId;
    expect(c.body.generatedClientId).toMatch(/^CL-\d{4}-\d{5}$/);
    const u = await sales('put', `/clients/${clientId}`).send({ contactNumber: '09175550000', lastName: 'Chua-Tan' });
    expect(u.body.contactNumber).toBe('09175550000');
    expect(u.body.displayName).toBe('Olivia Chua-Tan');
    expect((await sales('post', '/clients').send({ lastName: 'x' })).status).toBe(400);
    expect((await sales('post', '/clients').send({ firstName: 'x', emailId: 'nope' })).status).toBe(400);
  });
  it('refuses an implausible date of birth', async () => {
    const young = await sales('post', '/clients').send({ firstName: 'Baby', lastName: 'Chua', DOB: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10) });
    expect(young.status).toBe(400);
    expect(young.body.message).toMatch(/the age must be between 18 and 100 years/);
    expect((await sales('put', `/clients/${clientId}`).send({ DOB: '1890-01-01' })).status).toBe(400);
    const ok = await sales('put', `/clients/${clientId}`).send({ DOB: '1985-06-30' });
    expect(ok.status).toBe(200);
    expect(ok.body.DOB).toBe('1985-06-30');
  });
  it('converts a lead into a client once', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Iris', lastName: 'Macaraeg', emailId: 'iris@example.ph' });
    const a = await sales('post', `/clients/from-lead/${lead.body.leadId}`).send({});
    expect(a.status).toBe(201);
    expect(a.body.leadId).toBe(lead.body.leadId);
    const b = await sales('post', `/clients/from-lead/${lead.body.leadId}`).send({});
    expect(b.body.clientId).toBe(a.body.clientId);
    expect((await sales('get', `/leads/${lead.body.leadId}`)).body.status).toBe('Converted');
  });
  it('serves the figures of the client view from its policies, claims, renewals and bills', async () => {
    const c = (await sales('post', '/clients').send({ firstName: 'Summary', lastName: 'Client', emailId: 'summary@example.ph' })).body.data;
    await query(`INSERT INTO policies(id, policy_number, client_id, status, inception_date, expiry_date, premium_total) VALUES
      ('pol_cs1', 'POL-CS-1', $1, 'active', current_date - 30, current_date + 335, 12000), ('pol_cs2', 'POL-CS-2', $1, 'active', current_date - 400, current_date - 35, 8000)`, [c.id]);
    await query(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, estimate_amount) VALUES
      ('CLM-CS-1', 'pol_cs1', $1, 'in-review', current_date - 5, 5000), ('CLM-CS-2', 'pol_cs1', $1, 'settled', current_date - 50, 2000)`, [c.id]);
    await query(`INSERT INTO renewals(renewal_number, policy_id, client_id, status, due_date, premium_old) VALUES ('RN-CS-1', 'pol_cs2', $1, 'quoted', current_date - 35, 8000)`, [c.id]);
    await query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES
      ('BL-CS-1', 'pol_cs1', $1, 12000, 4500, current_date - 1, 'partial'), ('BL-CS-2', 'pol_cs2', $1, 8000, 0, current_date - 300, 'paid')`, [c.id]);
    const r = await sales('get', `/clients/${c.clientCode}/summary`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ clientId: c.id, activePolicies: 1, activePremium: 12000, openClaims: 1, openRenewals: 1, outstanding: 4500, overdueBills: 1 });
    expect(r.body.data.counts).toMatchObject({ policies: 2, claims: 2, renewals: 1, quotations: 0 });
    expect((await sales('get', '/clients/CL-NOPE/summary')).status).toBe(404);
    const noClients = await persona('c.nosummary', ['tis-ccd-pdu']);
    expect((await noClients('get', `/clients/${c.id}/summary`)).status).toBe(403);
  });
  it('serves customer codes and enforces permissions', async () => {
    const codes = await finance('get', '/customers/codes');
    expect(codes.body.data.length).toBeGreaterThanOrEqual(10);
    // Cash Control picks the customer codes of a bulk print without reading the client register
    const ccd = await persona('c.ccd', ['tis-ccd-pdu']);
    expect((await ccd('get', '/clients')).status).toBe(403);
    const ccdCodes = await ccd('get', '/customers/codes');
    expect(ccdCodes.status).toBe(200);
    expect(ccdCodes.body.data.length).toBe(codes.body.data.length);
    expect((await sales('get', '/customers/codes')).status).toBe(200);
    expect((await finance('post', '/clients').send({ firstName: 'x' })).status).toBe(403);
    // Agents see Clients in their menu: read allowed, create refused.
    expect((await agent('get', '/clients')).status).toBe(200);
    expect((await agent('post', '/clients').send({ firstName: 'x' })).status).toBe(403);
  });
});

const individual = (over = {}) => ({
  clientType: 'individual', firstName: 'Ramon', middleName: 'Bautista', lastName: 'Villanueva', DOB: '1980-03-15', nationality: 'Filipino', contactNumber: '0917 123 4567',
  taxNumber: '123-456-789-000', idType: 'PhilSys National ID (PhilID / ePhilID)', idNumber: '1234-5678-9012-3456', idExpiry: '2031-03-15', province: 'Metro Manila',
  city: 'Makati City', barangay: 'Poblacion', street: 'J.P. Rizal Avenue', houseNo: '12', zipCode: '1210', occupation: 'Civil engineer', sourceOfFunds: 'Salary',
  expectedLines: ['MOTOR'], expectedPaymentMode: 'bank-transfer', expectedAnnualPremium: 35000, emailId: 'ramon.v@example.ph', ...over,
});
const setSetting = async (key, value) => {
  await query('UPDATE app_settings SET value = $2, updated_at = now() WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};

describe('client onboarding before the first policy (customer due diligence)', () => {
  it('validates the Philippine mobile number, TIN and the identification of an individual', async () => {
    const bad = await sales('post', '/clients/onboard').send(individual({ contactNumber: '12345', taxNumber: 'ABC', idNumber: '' }));
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['contactNumber', 'taxNumber', 'idNumber']));
  });

  it('creates an individual client with its identification and a complete KYC status, without any policy', async () => {
    const r = await sales('post', '/clients/onboard').send(individual());
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const c = r.body.data.client;
    expect(c).toMatchObject({ clientType: 'individual', onboardedVia: 'onboarding', nationality: 'Filipino', middleName: 'Bautista', contactNumber: '09171234567', idExpiry: '2031-03-15',
      city: 'Makati City', province: 'Metro Manila', kycStatus: 'complete', policies: [] });
    expect(c.region).toBeTruthy();
    expect(c).not.toHaveProperty('riskRating');
    // the identification is updated on the same screen; the status follows what is missing
    const u = await sales('put', `/clients/${c.id}/kyc`).send({ idNumber: '' });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    expect(u.body.data.client.kycStatus).toBe('pending');
    const p = await sales('get', `/clients/${c.id}/profile`);
    expect(p.body.data.missing).toEqual(['ID number']);
    expect(p.body.data).not.toHaveProperty('screenings');
  });

  it('onboards a juridical client with registration, signatories, beneficial owners and the secretary\'s certificate', async () => {
    const missing = await sales('post', '/clients/onboard').send({ clientType: 'corporate', companyName: 'Northwind Logistics Corp.', contactNumber: '09181234567', city: 'Cebu City', province: 'Cebu' });
    expect(missing.status).toBe(400);
    expect(missing.body.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['registrationAuthority', 'registrationNumber', 'taxNumber']));
    const r = await sales('post', '/clients/onboard').send({
      clientType: 'corporate', customerType: 'CORPORATION', companyName: 'Northwind Logistics Corp.', tradeName: 'Northwind Express', registrationAuthority: 'SEC', registrationNumber: 'CS201912345',
      registrationDate: '2019-06-01', taxNumber: '009-876-543-000', businessNature: 'Freight forwarding', incorporationCountry: 'Philippines', contactNumber: '09181234567',
      province: 'Cebu', city: 'Cebu City', expectedLines: ['MARINE'], expectedPaymentMode: 'check', expectedAnnualPremium: 750000,
      signatories: [{ fullName: 'Liza Mercado', position: 'Treasurer', authorityDocument: 'secretary-certificate', authorityReference: 'SC-2026-014', authorityDate: '2026-08-15' }],
      beneficialOwners: [{ fullName: 'Victor Lim', ownershipPercent: 60, controlType: 'ownership', nationality: 'Filipino' }, { fullName: 'Ana Lim', ownershipPercent: 40, nationality: 'Filipino' }],
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const id = r.body.data.client.id;
    const p = await sales('get', `/clients/${id}/profile`);
    expect(p.status).toBe(200);
    expect(p.body.data.client).toMatchObject({ clientType: 'corporate', kycStatus: 'complete' });
    expect(p.body.data.signatories).toHaveLength(1);
    expect(p.body.data.beneficialOwners.map((o) => o.fullName)).toEqual(['Victor Lim', 'Ana Lim']);
    expect(p.body.data).toMatchObject({ ownerWarnings: [], beneficialOwnerThreshold: 25, missing: [] });
    // secretary's certificate of the signatory
    const sig = p.body.data.signatories[0];
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const up = await sales('post', `/clients/${id}/documents`).field('docType', 'secretary-certificate').field('relatedType', 'signatory').field('relatedId', sig.id)
      .attach('file', pdf, 'secretary-certificate.pdf');
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    expect(up.body.data).toMatchObject({ docType: 'secretary-certificate', relatedType: 'signatory', relatedId: sig.id, fileName: 'secretary-certificate.pdf' });
    expect((await sales('post', `/clients/${id}/documents`).field('relatedType', 'signatory').field('relatedId', 'sig_nope').attach('file', pdf, 'x.pdf')).status).toBe(400);
    expect((await sales('post', `/clients/${id}/documents`).field('relatedType', 'edd').field('relatedId', 'x').attach('file', pdf, 'x.pdf')).status).toBe(400);
    expect((await sales('get', `/clients/${id}/profile`)).body.data.documents).toHaveLength(1);
    // a 10% owner below the configurable 25% threshold is flagged
    const small = await sales('post', `/clients/${id}/beneficial-owners`).send({ fullName: 'Paolo Lim', ownershipPercent: 10 });
    expect(small.status).toBe(201);
    const warn = (await sales('get', `/clients/${id}/profile`)).body.data.ownerWarnings.join(' ');
    expect(warn).toContain('more than 100%');
    expect(warn).toContain('less than 25%');
    await setSetting('clients.beneficial_owner_threshold', 10);
    expect((await sales('get', `/clients/${id}/profile`)).body.data.ownerWarnings.join(' ')).not.toContain('less than');
    await setSetting('clients.beneficial_owner_threshold', 25);
    expect((await sales('put', `/clients/${id}/beneficial-owners/${small.body.data.id}`).send({ status: 'removed' })).status).toBe(200);
    // revoking the only signatory leaves the KYC pending
    expect((await sales('put', `/clients/${id}/signatories/${sig.id}`).send({ status: 'revoked' })).status).toBe(200);
    expect((await sales('get', `/clients/${id}/profile`)).body.data.client.kycStatus).toBe('pending');
    // signatories are for juridical clients only; finance reads clients but does not change them
    const [ind] = (await query("SELECT id FROM clients WHERE onboarded_via = 'onboarding' AND client_type = 'individual' LIMIT 1")).rows;
    expect((await sales('post', `/clients/${ind.id}/signatories`).send({ fullName: 'Someone Else' })).status).toBe(400);
    expect((await finance('get', `/clients/${id}/profile`)).status).toBe(200);
    expect((await finance('post', `/clients/${id}/beneficial-owners`).send({ fullName: 'Not Allowed', ownershipPercent: 5 })).status).toBe(403);
  });
});
