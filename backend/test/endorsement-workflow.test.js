import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withOwnDamageOnly, withoutCommissionTaxes } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let maker;
let checker;
let checkerId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}

beforeAll(async () => {
  ctx = await setup();
  await withoutCommissionTaxes();
  await withOwnDamageOnly('pol_sls_02', 980000, 1.75);
  maker = (await persona('w.maker', ['tis-ops-associate'])).api;
  const c = await persona('w.checker', ['tis-ops-unit-head']);
  checker = c.api; checkerId = c.id;
});
afterAll(async () => { await pool.end(); });

describe('endorsement types (M12, ENDT-01)', () => {
  it('lists the types that apply to the policy line', async () => {
    const motor = (await maker('get', '/endorsements/types?policyId=pol_sls_01')).body.data.map((t) => t.code);
    expect(motor).toEqual(expect.arrayContaining(['CPLT', 'CADR', 'ISI', 'EPER', 'CAN']));
    expect(motor).not.toContain('CBEN');
    const pa = (await maker('get', '/endorsements/types?policyId=pol_sls_08')).body.data.map((t) => t.code);
    expect(pa).toContain('CBEN');
    expect(pa).not.toContain('CPLT');
  });

  it('a Credit Life policy takes no financial endorsement', async () => {
    await q("UPDATE policies SET lob = 'LIFE' WHERE id = 'pol_sls_06'");
    const life = (await maker('get', '/endorsements/types?policyId=pol_sls_06')).body.data;
    expect(life.length).toBeGreaterThan(0);
    expect(life.every((t) => !t.financial && !t.premiumImpact)).toBe(true);
    const r = await maker('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_06', endorsementTypeIds: [1], endorsementTypeCodes: ['ISI'], personalDetails: { City: 'Pasig' } });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].message).toContain('does not apply to a life policy');
    await q("UPDATE policies SET lob = 'ACCIDENT' WHERE id = 'pol_sls_06'");
  });
});

describe('raise, approve, send, insurer confirmed, book (ENDT-02)', () => {
  let id;
  it('a draft is submitted for approval only with its types', async () => {
    const r = await maker('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_01', endorsementTypeIds: [2], motorDetails: { PlateNumber: 'NHX 4471' } });
    expect(r.status).toBe(201);
    id = r.body.endorsementId;
    expect((await maker('post', `/endorsements/${id}/submit-for-approval`).send({})).body.message).toBe('Choose the endorsement types before submitting the endorsement');
    expect((await maker('put', `/endorsements/${id}/types`).send({ endorsementTypeCodes: ['CBEN'] })).status).toBe(400);
    const t = await maker('put', `/endorsements/${id}/types`).send({ endorsementTypeCodes: ['CPLT'] });
    expect(t.body.endorsementTypes).toEqual([expect.objectContaining({ code: 'CPLT', name: 'Change of Plate Number', section: 'vehicle' })]);
    const send = await maker('post', `/endorsements/send-endorsement-to-customer/${id}`).send({});
    expect(send.status).toBe(400);
    expect(send.body.message).toContain('once approved by a second user');
    const s = await maker('post', `/endorsements/${id}/submit-for-approval`).send({});
    expect(s.body.status).toBe('PendingApproval');
    const n = await q("SELECT audience FROM notifications WHERE entity = 'endorsement' AND entity_id = $1 AND type = 'approval'", [id]);
    expect(n.map((x) => x.audience)).toContain('approve:policies');
  });

  it('the raiser cannot approve; a second user approves', async () => {
    const own = await maker('post', `/endorsements/${id}/approve`).send({});
    expect(own.status).toBe(403);
    const view = await checker('get', `/endorsements/${id}`);
    expect(view.body.workflow).toMatchObject({ approvalRequired: true, canApprove: true });
    const ok = await checker('post', `/endorsements/${id}/approve`).send({});
    expect(ok.body).toMatchObject({ status: 'Approved', approvedBy: 'w.checker' });
    expect((await maker('get', `/endorsements/${id}`)).body.workflow).toMatchObject({ canSend: true, canApprove: false });
  });

  it('sent to the insurer, booked only with its endorsement number and by a user other than the raiser', async () => {
    const s = await maker('post', `/endorsements/send-endorsement-to-customer/${id}`).send({});
    expect(s.body.endorsement.status).toBe('PendingCustomer');
    const own = await maker('post', '/endorsements/complete-endorsement').send({ endorsementId: id, endorsementNumber: 'MAL-END-1' });
    expect(own.status).toBe(403);
    expect(own.body.message).toContain('Maker-checker');
    const noNumber = await checker('post', '/endorsements/complete-endorsement').send({ endorsementId: id });
    expect(noNumber.status).toBe(400);
    expect(noNumber.body.errors[0].message).toContain("insurer's endorsement number");
    const c = await checker('post', '/endorsements/complete-endorsement').send({ endorsementId: id, endorsementNumber: 'PGA-END-2026-0101', issuedDate: '2026-10-01' });
    expect(c.status).toBe(200);
    expect(c.body.status).toBe('Completed');
    expect(c.body.completionDetails.policyBefore).toMatchObject({ status: 'active' });
    expect((await q('SELECT updated_by FROM policies WHERE id = $1', ['pol_sls_01']))[0].updated_by).toBe(checkerId);
    const mail = await q("SELECT to_address, attachments FROM email_outbox WHERE template = 'endorsement_booked' AND entity_id = $1", [id]);
    expect(mail).toHaveLength(1);
    expect(mail[0].attachments[0]).toMatchObject({ document: 'endorsement' });
    const versions = (await maker('get', '/policies/pol_sls_01/versions')).body.data;
    expect(versions.map((v) => v.endorsementNumber)).toContain(c.body.endorsementNumber);
  });

  it('a rejection needs a reason code and ends the endorsement', async () => {
    const r = await maker('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_03', endorsementTypeIds: [1], endorsementTypeCodes: ['CADR'], personalDetails: { City: 'Taguig' } });
    await maker('post', `/endorsements/${r.body.endorsementId}/submit-for-approval`).send({});
    expect((await checker('post', `/endorsements/${r.body.endorsementId}/reject`).send({})).status).toBe(400);
    const rej = await checker('post', `/endorsements/${r.body.endorsementId}/reject`).send({ reasonCode: 'ENR-DOCS' });
    expect(rej.body).toMatchObject({ status: 'Rejected', rejectionReason: 'Supporting documents missing' });
    expect((await maker('post', `/endorsements/send-endorsement-to-customer/${r.body.endorsementId}`).send({})).status).toBe(400);
  });
});

describe('financial endorsements are pro-rated over the unexpired days (ENDT-03)', () => {
  it('prices the annual difference times the unexpired share and keeps the days on the endorsement', async () => {
    const [p] = await q('SELECT inception_date, expiry_date FROM policies WHERE id = $1', ['pol_sls_02']);
    const effective = '2026-11-12';
    const factor = days(effective, p.expiry_date) / days(p.inception_date, p.expiry_date);
    const r = await maker('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_02', endorsementTypeIds: [3], endorsementTypeCodes: ['ISI'], effectiveDate: effective,
      coverageChanges: { LossandDamagecoverage: '1180000', LossandDamagecoverageRate: '1.75', BodilyInjury: '', PropertyDamage: '', APPATotalCoverage: '' } });
    expect(r.status).toBe(201);
    const pr = r.body.premiumChange.prorata;
    expect(pr).toMatchObject({ basis: 'pro-rata', effectiveDate: effective, termDays: days(p.inception_date, p.expiry_date), unexpiredDays: days(effective, p.expiry_date), annualNetDelta: 3500 });
    expect(r.body.premiumChange.delta.netPremium).toBeCloseTo(3500 * factor, 1);
    expect(r.body.premiumDelta).toBeLessThan(3500 * 1.2);
    const outside = await maker('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_02', endorsementTypeIds: [3], effectiveDate: '2028-01-01',
      coverageChanges: { LossandDamagecoverage: '1180000', LossandDamagecoverageRate: '1.75' } });
    expect(outside.status).toBe(400);
    expect(outside.body.errors[0].message).toContain('within the policy period');
    // a premium change needs a type with premium impact
    expect((await maker('put', `/endorsements/${r.body.endorsementId}/types`).send({ endorsementTypeCodes: ['CPLT'] })).body.errors[0].message).toContain('premium impact');
  });
});

describe('cancellation (CANC-03, M24)', () => {
  it('needs a note, returns pro-rata whoever cancels and takes back no commission', async () => {
    const noNote = await maker('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_04', endorsementTypeIds: [5], isCancelPolicy: true, cancellationReason: 'CAN-CLT' });
    expect(noNote.status).toBe(400);
    expect(noNote.body.errors[0].message).toBe('Enter the note of the cancellation');
    const r = await maker('post', '/endorsements/create-endorsement').send({ policyId: 'pol_sls_04', endorsementTypeIds: [5], isCancelPolicy: true, cancellationReason: 'CAN-CLT',
      effectiveDate: '2026-12-22', remarks: 'Client sold the vehicle to a relative' });
    expect(r.status).toBe(201);
    expect(r.body.returnCalculation).toMatchObject({ method: 'pro-rata', commissionReversed: 0 });
    expect(r.body.endorsementTypeCodes).toEqual(['CAN']);
    const reasons = (await q("SELECT code FROM master_records WHERE type_code = 'cancellation-reason' AND code LIKE 'CAN-%'")).map((x) => x.code);
    expect(reasons).toEqual(expect.arrayContaining(['CAN-DUP', 'CAN-NONDISCL', 'CAN-CLAIMRLTD', 'CAN-COMPL', 'CAN-POLDETAILS', 'CAN-OTHER']));
  });
});
