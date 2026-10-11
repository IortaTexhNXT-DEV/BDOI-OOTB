/**
 * Motor issuance checklist (GAP-QUOTE-23, migration 0688): the Motor Issuance Checklist master with its delivered
 * records and conditions, the checklist of a Motor placement slip, receipt by file or remark, waivers under
 * maker-checker, and the gate at booking (placement.issuance_checklist_mode block, warn, off).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { applicableRecords } from '../src/modules/placement/issuanceChecklist.js';

let ctx;
let ic;
const as = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const setting = async (key, value) => { await q('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const KYC = { idType: 'PhilSys ID', idCardNumber: '1234-5678-9012-3456', idCardImage: 'id-cards/p.jpg' };

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const upload = async (api, name, folder = 'placement-epolicies') => (await api('post', '/s3/upload').field('folder', folder).attach('file', PDF, name)).body.data;

/** A CTPL placement slip of an individual client taken to Checked against slip (approval to send switched off here). */
async function checkedCtpl(plate) {
  const maker = as['mc.maker'];
  const lto = await upload(maker, 'lto-or-cr.pdf', 'placement-documents');
  const r = await maker('post', '/placements').send({ clientId: 'cl_sls_91', productType: 'Compulsory Third Party Liability', netPremium: 560, sumInsured: 200000, inceptionDate: '2026-11-01',
    riskDetails: { plateNumber: plate }, participants: [{ insuranceCompanyId: ic.MALAYAN, sharePercent: 100 }], doc: { ltoDocumentKey: lto.key, ltoDocumentName: 'lto-or-cr.pdf' } });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const p = r.body;
  expect((await maker('post', `/placements/${p.id}/send`).send({})).status).toBe(200);
  const file = await upload(maker, `e-${p.placementNumber}.pdf`);
  const ep = await maker('post', `/placements/${p.id}/epolicy`).send({ documentKey: file.key, insurerPolicyNumber: `INS-${p.placementNumber}`, participantName: p.insuredName,
    sumInsured: p.sumInsured, netPremium: p.netPremium, grossPremium: p.grossPremium, commissionAmount: p.commissionAmount, issueDate: p.inceptionDate, effectiveDate: p.inceptionDate,
    expiryDate: p.expiryDate, vehicle: { plateNumber: plate, chassisNumber: `CH${plate.replace(/\W/g, '')}`, motorNumber: `MN${plate.replace(/\W/g, '')}` } });
  expect(ep.status, JSON.stringify(ep.body)).toBe(200);
  const chk = await as['mc.checker']('post', `/placements/${p.id}/check`).send({ decision: 'confirm' });
  expect(chk.status, JSON.stringify(chk.body)).toBe(200);
  return p;
}

beforeAll(async () => {
  ctx = await setup();
  ic = Object.fromEntries((await q('SELECT code, id FROM insurance_companies')).map((r) => [r.code, r.id]));
  await persona('mc.maker', ['processing']);
  await persona('mc.checker', ['operations']);
  await setting('placement.send_requires_approval', false);
  await q("UPDATE authority_limits SET max_amount = NULL WHERE transaction_type = 'policy_issue'");
});
afterAll(async () => { await pool.end(); });

describe('Motor Issuance Checklist master (delivered per Philippine broking practice)', () => {
  it('is delivered with the documents and conditions, mode block', async () => {
    const codes = (await q("SELECT code FROM master_records WHERE type_code = 'motor-issuance-checklist' AND status = 'active' ORDER BY code")).map((r) => r.code);
    expect(codes).toEqual(['MIC-COC', 'MIC-DR', 'MIC-GOVID', 'MIC-INSPECT', 'MIC-LOAN', 'MIC-ORCR', 'MIC-PREVPOL', 'MIC-PROPOSAL', 'MIC-SECDTI', 'MIC-SI', 'MIC-SIGNATORY', 'MIC-TIN']);
    expect((await q("SELECT value FROM app_settings WHERE key = 'placement.issuance_checklist_mode'"))[0].value).toBe('block');
    const listed = await ctx.api('get', '/masters/motor-issuance-checklist?perPage=50');
    expect(listed.status, JSON.stringify(listed.body)).toBe(200);
    expect(listed.body.data.length).toBe(12);
  });
  it('applies by vehicle, insured, financing and condition', async () => {
    const db = { query: (sql, params) => pool.query(sql, params) };
    const of = async (facts) => (await applicableRecords(db, { brandNew: false, vehicleAge: null, corporate: false, financed: false, transfer: false, ctpl: false, ...facts })).map((r) => r.code);
    const newIndividual = await of({ brandNew: true, vehicleAge: 0, financed: true });
    expect(newIndividual).toEqual(['MIC-SI', 'MIC-DR', 'MIC-GOVID', 'MIC-PROPOSAL', 'MIC-LOAN', 'MIC-TIN']);
    const usedCorporate = await of({ vehicleAge: 5, corporate: true, transfer: true });
    expect(usedCorporate).toEqual(['MIC-ORCR', 'MIC-INSPECT', 'MIC-PROPOSAL', 'MIC-SECDTI', 'MIC-SIGNATORY', 'MIC-PREVPOL', 'MIC-TIN']);
    expect(await of({ vehicleAge: 2 })).not.toContain('MIC-INSPECT');
    expect(await of({ brandNew: true, ctpl: true })).toContain('MIC-COC');
  });
});

describe('checklist of a Motor placement and the gate at booking', () => {
  let p;
  let items;
  const item = (code) => items.find((i) => i.code === code);
  const load = async () => {
    const r = await as['mc.maker']('get', `/placements/${p.id}/issuance-checklist`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    items = r.body.data.items;
    return r.body.data;
  };

  it('blocks the booking while a mandatory document is missing', async () => {
    p = await checkedCtpl('NCK 1001');
    const c = await load();
    expect(c).toMatchObject({ applies: true, mode: 'block' });
    expect(c.facts).toMatchObject({ brandNew: false, ctpl: true, corporate: false });
    expect(items.map((i) => i.code)).toEqual(expect.arrayContaining(['MIC-ORCR', 'MIC-GOVID', 'MIC-PROPOSAL', 'MIC-COC']));
    expect(item('MIC-TIN').required).toBe(false);
    const book = await as['mc.checker']('post', `/placements/${p.id}/book`).send({ additionalPolicyData: KYC });
    expect(book.status).toBe(400);
    expect(book.body.errors[0]).toMatchObject({ code: 'ISSUANCE_CHECKLIST' });
    expect(book.body.message).toMatch(/mandatory document\(s\) of the Motor issuance checklist missing/);
  });

  it('receives by file or remark; a waiver is decided by another approver', async () => {
    const maker = as['mc.maker'];
    expect((await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-ORCR').id}/receive`).send({})).status).toBe(400);
    expect((await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-ORCR').id}/receive`).send({ documentKey: 'nowhere/x.pdf' })).status).toBe(400);
    const orcr = await upload(maker, 'or-cr.pdf', 'placement-documents');
    const got = await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-ORCR').id}/receive`).send({ documentKey: orcr.key, documentName: 'or-cr.pdf' });
    expect(got.status, JSON.stringify(got.body)).toBe(200);
    await load();
    expect(item('MIC-ORCR')).toMatchObject({ status: 'received', fileName: 'or-cr.pdf' });
    expect((await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-PROPOSAL').id}/receive`).send({ remark: 'Signed original in the client folder' })).status).toBe(200);
    // the government ID cannot be waived
    expect((await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-GOVID').id}/waiver`).send({ reason: 'Later' })).status).toBe(400);
    expect((await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-GOVID').id}/receive`).send({ remark: 'PhilSys ID seen and copied' })).status).toBe(200);
    expect((await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-COC').id}/waiver`).send({ reason: '' })).status).toBe(400);
    expect((await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-COC').id}/waiver`).send({ reason: 'COC issued by the insurer on the OR/CR on file' })).status).toBe(200);
    // the requester never decides, nor a user without approve:policies
    expect((await maker('post', `/placements/${p.id}/issuance-checklist/${item('MIC-COC').id}/waiver-decision`).send({ decision: 'approve' })).status).toBe(403);
    const work = await as['mc.checker']('get', '/my-work/items?category=approvals&pageSize=100');
    expect(JSON.stringify(work.body)).toContain('Checklist waiver');
    expect((await as['mc.checker']('post', `/placements/${p.id}/issuance-checklist/${item('MIC-COC').id}/waiver-decision`).send({ decision: 'reject' })).status).toBe(400);
    expect((await as['mc.checker']('post', `/placements/${p.id}/issuance-checklist/${item('MIC-COC').id}/waiver-decision`).send({ decision: 'approve' })).status).toBe(200);
    const c = await load();
    expect(item('MIC-COC').status).toBe('waived');
    expect(c.gate.missing).toBe(0);
    const trail = (await q("SELECT action FROM audit_log WHERE entity = 'placement' AND entity_id = $1", [p.id])).map((r) => r.action);
    expect(trail).toEqual(expect.arrayContaining(['checklist-receive', 'checklist-waiver-request', 'checklist-waiver-decision']));
  });

  it('books once the checklist is complete; the checklist is then read-only', async () => {
    const book = await as['mc.checker']('post', `/placements/${p.id}/book`).send({ additionalPolicyData: KYC });
    expect(book.status, JSON.stringify(book.body)).toBe(201);
    expect(book.body.warnings).toEqual([]);
    expect((await as['mc.maker']('post', `/placements/${p.id}/issuance-checklist/${item('MIC-ORCR').id}/reopen`).send({ remark: 'x' })).status).toBe(409);
  });

  it('warn books and names the missing documents; off skips the checklist', async () => {
    await setting('placement.issuance_checklist_mode', 'warn');
    try {
      const w = await checkedCtpl('NCK 1002');
      const book = await as['mc.checker']('post', `/placements/${w.id}/book`).send({ additionalPolicyData: KYC });
      expect(book.status, JSON.stringify(book.body)).toBe(201);
      expect(book.body.warnings[0]).toMatch(/missing: .*OR\/CR/);
      await setting('placement.issuance_checklist_mode', 'off');
      const o = await checkedCtpl('NCK 1003');
      const off = await as['mc.checker']('post', `/placements/${o.id}/book`).send({ additionalPolicyData: KYC });
      expect(off.status, JSON.stringify(off.body)).toBe(201);
      expect(off.body.warnings).toEqual([]);
    } finally {
      await setting('placement.issuance_checklist_mode', 'block');
    }
  });
});
