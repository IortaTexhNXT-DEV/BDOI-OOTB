/**
 * KYC by source, the onboarding checklist, the second ID, duplicate-account control, the KYC form and the KYC
 * documents sent to the insurer (migration 0594; TIS-BRD-KYC-02 to KYC-05, FR-SIS-012, Pre-BSM M14).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withoutPlacementControls } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { KYC_MODES, kycChecklist, kycModeFor, missingKyc } from '../src/modules/policies/kyc.js';

let ctx;
const ids = {};
const tok = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const setSettings = async (settings) => {
  const r = await ctx.api('put', '/settings').send({ settings });
  expect(r.status).toBe(200);
  clearSettingsCache();
};
const motorId = { idType: 'PhilSys ID', idNumber: '1234-5678-9012-3456', idCardImage: 'id-cards/lara.jpg', chassisNumber: 'MHFXW42G5P0012345', motorNumber: '2NRX123456', plateNumber: 'NQQ 2025' };

beforeAll(async () => {
  ctx = await setup();
  // the approval to send and the Motor issuance checklist are covered by test/placement-send-approval.test.js and test/motor-issuance-checklist.test.js
  await withoutPlacementControls();
  const r = await ctx.api('post', '/users').send({ username: 'kyc.ops', password: 'Welcome@123', displayName: 'kyc.ops', email: 'kyc.ops@example.ph', roles: ['tis-ops-associate'] });
  expect(r.status).toBe(201);
  ids['kyc.ops'] = r.body.data.userId;
  tok['kyc.ops'] = await loginAs(ctx.app, 'kyc.ops', 'Welcome@123');
  const s = await ctx.api('post', '/users').send({ username: 'kyc.sales', password: 'Welcome@123', displayName: 'kyc.sales', email: 'kyc.sales@example.ph', roles: ['tis-sales-associate'] });
  expect(s.status).toBe(201);
  tok['kyc.sales'] = await loginAs(ctx.app, 'kyc.sales', 'Welcome@123');
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, email, phone, source, birth_date, nationality, owner_user_id, created_by) VALUES
    ('cl_tfs', 'CL-KYC-TFS', 'Tfs Customer', 'Tfs', 'Customer', 'tfs.customer@example.ph', '09170000011', 'CLI', '1990-05-14', 'Filipino', $1, $1),
    ('cl_walk', 'CL-KYC-WALK', 'Walk In', 'Walk', 'In', 'walk.in@example.ph', '09170000012', 'WI', '1990-05-14', 'Filipino', $1, $1),
    ('cl_young', 'CL-KYC-YOUNG', 'Young Foreign', 'Young', 'Foreign', 'young@example.ph', '09170000013', 'WI', (current_date - interval '19 years')::date, 'American', $1, $1)`, [ids['kyc.ops']]);
});
afterAll(async () => { await pool.end(); });

describe('KYC by source', () => {
  it('the KYC mode follows the lead source of the client: TFS-sourced deals rely on the TFS confirmation, walk-in needs the full KYC', async () => {
    expect(await kycModeFor({ clientId: 'cl_tfs' })).toEqual({ mode: KYC_MODES.tfs, source: 'CLI' });
    expect(await kycModeFor({ clientId: 'cl_walk' })).toEqual({ mode: KYC_MODES.full, source: 'WI' });
    expect((await kycModeFor({})).mode).toBe(KYC_MODES.full);
    // a source listed in policy.kyc_tfs_sources counts as TFS whatever the master says
    await setSettings({ 'policy.kyc_tfs_sources': ['WI'] });
    expect((await kycModeFor({ clientId: 'cl_walk' })).mode).toBe(KYC_MODES.tfs);
    await setSettings({ 'policy.kyc_tfs_sources': [] });
  });

  it('a TFS-sourced Motor booking needs the TFS confirmation, not the ID; a walk-in Motor booking needs the ID', async () => {
    const vehicle = { chassisNumber: 'MHFXW42G5P0012345', motorNumber: '2NRX123456', plateNumber: 'NQQ 2025' };
    expect(await missingKyc({ lob: 'MOTOR', sources: [vehicle], clientId: 'cl_tfs' })).toEqual(['TFS KYC confirmation']);
    expect(await missingKyc({ lob: 'MOTOR', sources: [vehicle, { tfsKycReference: 'TFS-KYC-2026-0001' }], clientId: 'cl_tfs' })).toEqual([]);
    // a full government ID on file satisfies a TFS-sourced deal too
    expect(await missingKyc({ lob: 'MOTOR', sources: [motorId], clientId: 'cl_tfs' })).toEqual([]);
    expect(await missingKyc({ lob: 'MOTOR', sources: [vehicle], clientId: 'cl_walk' })).toEqual(['ID type', 'ID number', 'ID card image']);
    expect(await missingKyc({ lob: 'MOTOR', sources: [motorId], clientId: 'cl_walk' })).toEqual([]);
    // one primary ID or two secondary IDs: a secondary ID alone is not enough
    const secondary = await missingKyc({ lob: 'MOTOR', sources: [{ ...motorId, idType: 'Postal ID' }], clientId: 'cl_walk' });
    expect(secondary).toEqual([expect.stringContaining('A second ID is needed with the secondary ID "Postal ID"')]);
    expect(await missingKyc({ lob: 'MOTOR', sources: [{ ...motorId, idType: 'Postal ID', idType2: 'UMID', idNumber2: 'CRN-0111-2222333-4' }], clientId: 'cl_walk' })).toEqual([]);
    expect(await missingKyc({ lob: 'MOTOR', sources: [{ ...motorId, idType: 'Postal ID', idType2: 'Library card', idNumber2: '1' }], clientId: 'cl_walk' })).toEqual([expect.stringContaining('"Library card" is not an accepted ID')]);
    // the TISPH accepted list has no Voter's ID
    expect(await missingKyc({ lob: 'MOTOR', sources: [{ ...motorId, idType: "Voter's ID" }], clientId: 'cl_walk' })).toEqual([expect.stringContaining('not an accepted ID')]);
  });

  it('the onboarding checklist (per line, mode and customer) is enforced at booking with policy.kyc_checklist_enforced', async () => {
    const walk = await kycChecklist({ lob: 'MOTOR', mode: KYC_MODES.full, sources: [motorId], clientId: 'cl_walk' });
    expect(walk.map((c) => [c.code, c.satisfied])).toEqual([['GOV-ID', true], ['OR-CR', false], ['PROPOSAL', false], ['PHOTOS', false]]);
    const tfs = await kycChecklist({ lob: 'PA', mode: KYC_MODES.tfs, sources: [], clientId: 'cl_tfs' });
    expect(tfs.map((c) => c.code)).toEqual(['TFS-CONF', 'PROPOSAL']);
    const young = await kycChecklist({ lob: 'PA', mode: KYC_MODES.full, sources: [], clientId: 'cl_young' });
    expect(young.map((c) => c.code)).toEqual(['GOV-ID', 'PROPOSAL', 'BIRTH-CERT', 'ACR-SRRV']);
    // off by default: a walk-in Motor booking with the ID and vehicle identifiers passes
    expect(await missingKyc({ lob: 'MOTOR', sources: [motorId], clientId: 'cl_walk' })).toEqual([]);
    await setSettings({ 'policy.kyc_checklist_enforced': true });
    expect(await missingKyc({ lob: 'MOTOR', sources: [motorId], clientId: 'cl_walk' })).toEqual(['Vehicle OR/CR (LTO registration)', 'Signed proposal form', 'Vehicle photos (four sides)']);
    // the files of the booking or the documents of the client record satisfy the items
    const photos = { vehicleLeftSidePhoto: 'p/1.jpg', vehicleRightSidePhoto: 'p/2.jpg', vehicleFrontSidePhoto: 'p/3.jpg', vehicleRearSidePhoto: 'p/4.jpg' };
    await query("INSERT INTO client_kyc_documents(client_id, doc_type, related_type, storage_key, file_name, uploaded_by) VALUES ('cl_walk', 'signed-proposal', 'client', 'kyc/cl_walk/proposal.pdf', 'proposal.pdf', $1)", [ids['kyc.ops']]);
    expect(await missingKyc({ lob: 'MOTOR', sources: [motorId, photos, { ltoDocumentKey: 'lto/orcr.pdf' }], clientId: 'cl_walk' })).toEqual([]);
    expect(await missingKyc({ lob: 'PA', sources: [], clientId: 'cl_young' })).toEqual(['Valid government ID', 'Signed proposal form', 'Birth certificate', 'ACR I-Card or SRRV']);
    await setSettings({ 'policy.kyc_checklist_enforced': false });
  });

  it('the client profile shows the KYC source and checklist, and the KYC form prints', async () => {
    const p = await as('kyc.ops', 'get', '/clients/cl_walk/profile');
    expect(p.status).toBe(200);
    expect(p.body.data.kyc).toMatchObject({ mode: KYC_MODES.full, source: 'WI', tfsConfirmation: false });
    expect(p.body.data.kyc.checklist.find((c) => c.code === 'PROPOSAL')).toMatchObject({ satisfied: true });
    const tfs = await as('kyc.ops', 'get', '/clients/cl_tfs/profile');
    expect(tfs.body.data.kyc).toMatchObject({ mode: KYC_MODES.tfs, tfsConfirmation: true });
    const pdf = await as('kyc.ops', 'get', '/clients/cl_walk/kyc-form.pdf');
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'client' AND entity_id = 'cl_walk' AND action = 'print'")).n).toBe(1);
  });
});

describe('duplicate-account control', () => {
  it('refuses a client that duplicates an existing one by e-mail, mobile or name with birth date, unless confirmed or switched off', async () => {
    const body = { firstName: 'Walk', lastName: 'In', emailId: 'walk.in@example.ph', leadCategory: 'Retail' };
    const dup = await as('kyc.sales', 'post', '/clients').send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/same email already exists: Walk In \(CL-KYC-WALK\)/);
    expect(dup.body.errors[0]).toMatchObject({ path: 'duplicate', clientCode: 'CL-KYC-WALK' });
    expect((await as('kyc.sales', 'post', '/clients').send({ firstName: 'Other', lastName: 'Person', contactNumber: '+63 917 000 0012', leadCategory: 'Retail' })).status).toBe(409);
    expect((await as('kyc.sales', 'post', '/clients').send({ firstName: 'Walk', lastName: 'In', DOB: '1990-05-14', leadCategory: 'Retail' })).status).toBe(409);
    // the same name with another birth date, or no birth date, is not a duplicate
    expect((await as('kyc.sales', 'post', '/clients').send({ firstName: 'Walk', lastName: 'In', DOB: '1991-01-01', leadCategory: 'Retail' })).status).toBe(201);
    const check = await as('kyc.sales', 'get', '/clients/duplicates?emailId=WALK.IN@example.ph');
    expect(check.status).toBe(200);
    expect(check.body.data).toEqual([expect.objectContaining({ clientCode: 'CL-KYC-WALK', matchedOn: ['email'] })]);
    const confirmed = await as('kyc.sales', 'post', '/clients').send({ ...body, allowDuplicate: true });
    expect(confirmed.status).toBe(201);
    // onboarding before the first policy is controlled the same way
    const onboard = { clientType: 'individual', firstName: 'Walk', lastName: 'In', emailId: 'walk.in@example.ph', contactNumber: '09170000099', DOB: '1990-05-14', nationality: 'Filipino', idType: 'PhilSys National ID (PhilID / ePhilID)', idNumber: '1234-5678-9012-3457', province: 'Metro Manila', city: 'Makati City' };
    const dupOnboard = await as('kyc.sales', 'post', '/clients/onboard').send(onboard);
    expect(dupOnboard.status, JSON.stringify(dupOnboard.body)).toBe(409);
    expect(dupOnboard.body.errors[0]).toMatchObject({ path: 'duplicate' });
    expect((await as('kyc.sales', 'post', '/clients/onboard').send({ ...onboard, allowDuplicate: true })).status).toBe(201);
    await setSettings({ 'clients.duplicate_control': 'off' });
    expect((await as('kyc.sales', 'post', '/clients').send(body)).status).toBe(201);
    await setSettings({ 'clients.duplicate_control': 'block' });
  });
});

describe('KYC documents to the insurer', () => {
  it('the placement order carries the government ID of a walk-in customer and the TFS confirmation of a TFS-sourced one', async () => {
    for (const [id, client] of [['pl_kyc_walk', 'cl_walk'], ['pl_kyc_tfs', 'cl_tfs']]) {
      await query(`INSERT INTO placements(id, placement_number, client_id, product_id, insurance_company_id, owner_user_id, created_by, status, premium_total, insured_name, lob)
        VALUES ($1, $2, $3, (SELECT id FROM products WHERE code = 'MOTOR'), 2, $4, $4, 'draft', 20000, 'Kyc', 'MOTOR')`, [id, `PS-${id.toUpperCase()}`, client, ids['kyc.ops']]);
      await query("INSERT INTO risk_participants(entity_type, entity_id, insurance_company_id, share_percent, is_lead, status) VALUES ('placement', $1, 2, 100, true, 'pending')", [id]);
    }
    await query("INSERT INTO client_kyc_documents(client_id, doc_type, related_type, storage_key, file_name, uploaded_by) VALUES ('cl_walk', 'government-id', 'client', 'kyc/cl_walk/philsys.pdf', 'philsys.pdf', $1), ('cl_tfs', 'tfs-kyc-confirmation', 'client', 'kyc/cl_tfs/tfs.pdf', 'tfs-kyc-confirmation.pdf', $1)", [ids['kyc.ops']]);
    for (const [id, file] of [['pl_kyc_walk', 'philsys.pdf'], ['pl_kyc_tfs', 'tfs-kyc-confirmation.pdf']]) {
      const r = await as('kyc.ops', 'post', `/placements/${id}/send`).send({});
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      const mail = await one("SELECT attachments FROM email_outbox WHERE template = 'placement_order' AND entity_id = $1 ORDER BY id DESC LIMIT 1", [id]);
      expect(JSON.stringify(mail.attachments)).toContain(file);
    }
    await setSettings({ 'placement.attach_kyc_documents': false });
    const again = await as('kyc.ops', 'post', '/placements/pl_kyc_walk/send').send({});
    expect(again.status).toBe(200);
    expect(JSON.stringify((await one("SELECT attachments FROM email_outbox WHERE template = 'placement_order' AND entity_id = 'pl_kyc_walk' ORDER BY id DESC LIMIT 1")).attachments)).not.toContain('philsys.pdf');
    await setSettings({ 'placement.attach_kyc_documents': true });
  });
});
