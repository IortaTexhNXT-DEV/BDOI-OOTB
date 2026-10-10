/**
 * CAS registration documents as controlled documents (modules/bir/casDocuments.js): drafts from the standard text,
 * sections with live fields, submit with a coded reason and a change note, approval by another user holding
 * approve:period-end, superseded versions, comparison, PDF with DRAFT mark, activity log; the CAS registration values
 * kept on the CAS screen and the readiness rows in business words.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { diffLines, resolveText, standardSections } from '../src/modules/bir/casDocuments.js';

let ctx;
let admin;
let maker;
let sales;
let mgr;
const PASSWORD = 'Welcome@123';
const binary = (res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); };
const SD = '/bir/cas/documents/system-description';
const BP = '/bir/cas/documents/backup-procedure';

beforeAll(async () => {
  ctx = await setupFinance();
  admin = ctx.api;
  maker = ctx.as('maker');
  sales = ctx.as('sales');
  const u = await admin('post', '/users').send({ username: 'cas.manager', password: PASSWORD, displayName: 'CAS Manager', roles: ['accounting-manager'], email: 'cas.manager@example.ph' });
  expect(u.status, JSON.stringify(u.body)).toBe(201);
  const token = (await request(ctx.app).post('/api/auth/login').send({ username: 'cas.manager', password: PASSWORD })).body.accessToken;
  mgr = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
});
afterAll(async () => { await pool.end(); });

describe('CAS documents: helpers', () => {
  it('resolves live fields and prints "-" for a value not set', () => {
    expect(resolveText('{{taxpayerName}} / {{tin}} / {{custodian}}', { taxpayerName: 'TISPH', tin: '123-456-789-00000', custodian: '' })).toBe('TISPH / 123-456-789-00000 / -');
  });
  it('compares lines', () => {
    expect(diffLines('a\nb\nc', 'a\nc\nd')).toEqual([{ type: 'same', text: 'a' }, { type: 'removed', text: 'b' }, { type: 'same', text: 'c' }, { type: 'added', text: 'd' }]);
  });
  it('keeps the standard text of both documents in sections with keys', () => {
    expect(standardSections('system_description').map((s) => s.heading)).toContain('Controls');
    expect(standardSections('backup_procedure')[1].text).toContain('{{custodian}}');
  });
});

describe('CAS documents: draft, submit, approve', () => {
  let detail;
  it('lists both documents with nothing approved and prints the standard text marked as a draft', async () => {
    const list = await maker('get', '/bir/cas/documents');
    expect(list.status).toBe(200);
    expect(list.body.data.map((d) => d.slug)).toEqual(['system-description', 'backup-procedure']);
    expect(list.body.data.every((d) => !d.approved && !d.open)).toBe(true);
    const pdf = await maker('get', SD).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.headers['content-disposition']).toMatch(/CAS-system-description-draft\.pdf/);
  });

  it('starts a draft from the standard text; one version in progress at a time; read-only users cannot edit', async () => {
    expect((await sales('post', `${SD}/draft`)).status).toBe(403);
    const r = await maker('post', `${SD}/draft`);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    detail = r.body.data;
    expect(detail.open).toMatchObject({ version: 1, status: 'draft', createdByName: 'maker user' });
    expect(detail.open.sections.map((s) => s.key)).toEqual(standardSections('system_description').map((s) => s.key));
    expect(detail.fields.find((f) => f.key === 'taxpayerName').label).toBe('Taxpayer name');
    expect((await maker('post', `${SD}/draft`)).status).toBe(409);
  });

  it('saves sections, refuses an unknown field and a missing heading', async () => {
    const sections = detail.open.sections.map((s) => (s.key === 's1' ? { ...s, text: `${s.text}\nThe TIN is {{tin}}.` } : s));
    const bad = await maker('put', `${SD}/draft`).send({ sections: [...sections, { heading: 'Extra', text: '{{password}}' }] });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].path).toBe(`sections.${sections.length}.text`);
    expect((await maker('put', `${SD}/draft`).send({ sections: [{ heading: ' ', text: 'x' }] })).body.errors[0].path).toBe('sections.0.heading');
    const ok = await maker('put', `${SD}/draft`).send({ sections: [...sections, { heading: 'Document control', text: 'Kept by {{contact}}.' }] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data.open.sections).toHaveLength(sections.length + 1);
    expect(ok.body.data.open.sections.at(-1).key).toMatch(/^s_/);
  });

  it('submits with a coded reason and a change note', async () => {
    expect((await maker('post', `${SD}/draft/submit`).send({ reasonCode: 'CDC-SYSTEM' })).status).toBe(400);
    const wrong = await maker('post', `${SD}/draft/submit`).send({ reasonCode: 'CPV-MISPRINT', changeNote: 'First version' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors[0].path).toBe('reasonCode');
    const r = await maker('post', `${SD}/draft/submit`).send({ reasonCode: 'CDC-SYSTEM', changeNote: 'First version for the registration file' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    // the change note is the note of the reason; the reason keeps its name
    expect(r.body.data.open).toMatchObject({ status: 'submitted', reasonCode: 'CDC-SYSTEM', reason: 'System or software version change', changeNote: 'First version for the registration file' });
    expect((await maker('put', `${SD}/draft`).send({ sections: detail.open.sections })).status).toBe(409);
  });

  it('approval needs approve:period-end; a rejection returns the version as a draft with remarks', async () => {
    expect((await maker('post', `${SD}/draft/approve`).send({})).status).toBe(403);
    expect((await mgr('post', `${SD}/draft/reject`).send({})).status).toBe(400);
    const rej = await mgr('post', `${SD}/draft/reject`).send({ remarks: 'Add the restore test frequency' });
    expect(rej.status).toBe(200);
    expect(rej.body.data.open).toMatchObject({ status: 'draft', rejectionRemarks: 'Add the restore test frequency' });
    expect((await maker('post', `${SD}/draft/submit`).send({ reasonCode: 'CDC-TEXT', changeNote: 'Restore test added' })).status).toBe(200);
    const ap = await mgr('post', `${SD}/draft/approve`).send({ remarks: 'Checked' });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect(ap.body.data.open).toBeNull();
    expect(ap.body.data.approved).toMatchObject({ version: 1, status: 'approved', approvedByName: 'CAS Manager' });
  });

  it('maker-checker: the user who prepared or submitted a version cannot approve it', async () => {
    expect((await mgr('post', `${SD}/draft`)).status).toBe(201);
    const sub = await mgr('post', `${SD}/draft/submit`).send({ reasonCode: 'CDC-CUSTODIAN', changeNote: 'Second version' });
    expect(sub.status).toBe(200);
    const own = await mgr('post', `${SD}/draft/approve`).send({});
    expect(own.status).toBe(403);
    expect(own.body.message).toMatch(/Maker-checker/);
    const ap = await admin('post', `${SD}/draft/approve`).send({});
    expect(ap.status).toBe(200);
    const d = (await maker('get', `${SD}/versions`)).body.data;
    expect(d.versions.map((v) => [v.version, v.status])).toEqual([[2, 'approved'], [1, 'superseded']]);
    expect(d.versions[0].makers).toEqual([d.versions[0].createdBy]);
  });

  it('compares two versions, prints the approved and an earlier version, shows the activity', async () => {
    const c = await maker('get', `${SD}/compare?from=1&to=2`);
    expect(c.status).toBe(200);
    expect(c.body.data.summary).toEqual({ added: 0, removed: 0, changed: 0 });
    const v1 = await maker('get', `${SD}/versions/1`);
    expect(v1.body.data.sections.at(-1).heading).toBe('Document control');
    const pdf = await maker('get', SD).buffer(true).parse(binary);
    expect(pdf.headers['content-disposition']).toMatch(/CAS-system-description-v2\.pdf/);
    const old = await maker('get', `${SD}?version=1`).buffer(true).parse(binary);
    expect(old.headers['content-disposition']).toMatch(/v1-superseded/);
    expect((await maker('get', `${SD}?version=9`)).status).toBe(404);
    const { activity } = (await maker('get', `${SD}/versions`)).body.data;
    const submit = activity.find((a) => a.actionCode === 'submit');
    expect(submit).toMatchObject({ fromStatus: 'Draft', toStatus: 'Submitted', remarks: 'First version for the registration file' });
    expect(submit.user.displayName).toBe('maker user');
    expect(activity.filter((a) => a.actionCode === 'approve')).toHaveLength(2);
    const audit = (await query('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'cas_document\'')).rows[0].n;
    expect(audit).toBeGreaterThanOrEqual(9);
  });

  it('compares a changed and an added section; a discarded draft is cancelled', async () => {
    const d = (await maker('post', `${BP}/draft`)).body.data;
    const sections = d.open.sections.map((s, i) => (i === 0 ? { ...s, text: 'Everything in the database.' } : s));
    await maker('put', `${BP}/draft`).send({ sections: [...sections, { heading: 'Contacts', text: '{{contact}}' }] });
    await maker('post', `${BP}/draft/submit`).send({ reasonCode: 'CDC-BACKUP', changeNote: 'Scope shortened' });
    expect((await admin('post', `${BP}/draft/approve`).send({})).status).toBe(200);
    await maker('post', `${BP}/draft`);
    const two = (await maker('get', `${BP}/versions`)).body.data.open.sections;
    await maker('put', `${BP}/draft`).send({ sections: two.filter((s) => s.heading !== 'Contacts').map((s, i) => (i === 0 ? { ...s, heading: 'Scope', text: 'Everything in the database.\nAnd the files.' } : s)) });
    await maker('post', `${BP}/draft/submit`).send({ reasonCode: 'CDC-BACKUP', changeNote: 'Files added' });
    await admin('post', `${BP}/draft/approve`).send({});
    const c = (await maker('get', `${BP}/compare?from=2&to=1`)).body.data;
    expect(c.from.version).toBe(1);
    expect(c.summary).toEqual({ added: 0, removed: 1, changed: 1 });
    const first = c.sections.find((s) => s.change === 'changed');
    expect(first).toMatchObject({ heading: 'Scope', headingBefore: 'What is backed up' });
    expect(first.lines).toEqual([{ type: 'same', text: 'Everything in the database.' }, { type: 'added', text: 'And the files.' }]);
    expect((await maker('post', `${BP}/draft`)).status).toBe(201);
    const discarded = await maker('post', `${BP}/draft/discard`);
    expect(discarded.status).toBe(200);
    expect(discarded.body.data.versions[0]).toMatchObject({ version: 3, status: 'cancelled' });
    expect((await maker('post', `${BP}/draft/discard`)).status).toBe(409);
  });

  it('the submitter may not return their own version, but withdraws it; only the submitter withdraws', async () => {
    expect((await mgr('post', `${BP}/draft`)).status).toBe(201);
    expect((await mgr('post', `${BP}/draft/submit`).send({ reasonCode: 'CDC-TEXT', changeNote: 'Wording' })).status).toBe(200);
    const own = await mgr('post', `${BP}/draft/reject`).send({ remarks: 'self' });
    expect(own.status).toBe(403);
    expect(own.body.message).toMatch(/Maker-checker/);
    expect((await maker('post', `${BP}/draft/withdraw`)).status).toBe(403);
    const back = await mgr('post', `${BP}/draft/withdraw`);
    expect(back.status, JSON.stringify(back.body)).toBe(200);
    expect(back.body.data.open).toMatchObject({ status: 'draft', submittedBy: null });
    expect((await mgr('post', `${BP}/draft/discard`)).status).toBe(200);
  });

  it('prints the preparer and the custodian it names on the backup procedure, and no number on the document', async () => {
    const pdf = (await maker('get', BP).buffer(true).parse(binary)).body.toString('latin1');
    expect(pdf).toMatch(/Prepared by/);
    expect(pdf).toMatch(/Custodian/);
    expect(pdf).not.toMatch(/No\. iNXT/);
  });
});

describe('CAS registration values and readiness', () => {
  it('shows business names only, Complete / Missing, and an action per row', async () => {
    const c = (await maker('get', '/bir/cas/checklist')).body.data.checklist;
    expect(c.map((r) => r.code)).toEqual(['company', 'rdo', 'permit', 'atp', 'custodian', 'contact', 'systemDescription', 'backupProcedure', 'books']);
    expect(c.every((r) => !/[()]|\w+\.\w+_/.test(r.item))).toBe(true);
    expect(c.every((r) => ['complete', 'missing'].includes(r.status) && r.action)).toBe(true);
    expect(c.find((r) => r.code === 'permit').status).toBe('missing');
    expect(c.find((r) => r.code === 'systemDescription')).toMatchObject({ status: 'complete', value: 'Version 2' });
  });

  it('saves the permit, ATP, custodian and contact with write:period-end only', async () => {
    expect((await sales('put', '/bir/cas/registration').send({ permitNumber: 'X' })).status).toBe(403);
    expect((await maker('put', '/bir/cas/registration').send({ 'cas.permit_number': 'X' })).status).toBe(400);
    expect((await maker('put', '/bir/cas/registration').send({ permitDate: '01/02/2026' })).status).toBe(400);
    expect((await maker('put', '/bir/cas/registration').send({ permitDate: '2026-02-31' })).status).toBe(400);
    expect((await maker('put', '/bir/cas/registration').send({ custodianUserId: 'nobody' })).body.errors[0].path).toBe('custodianUserId');
    const reg = (await maker('get', '/bir/cas/registration')).body.data;
    const person = reg.people.find((p) => p.name === 'checker user');
    const r = await maker('put', '/bir/cas/registration').send({ permitNumber: 'CAS-2026-0001', permitDate: '2026-02-01', atpNumber: 'ACK-0001', atpDateIssued: '2026-01-15',
      custodianUserId: person.userId, custodianPosition: 'IT Officer', contactUserId: person.userId });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ permitNumber: 'CAS-2026-0001', permitDate: '2026-02-01', custodianUserId: person.userId, custodian: 'checker user, IT Officer',
      contact: 'checker user, fin.checker@example.ph' });
    const c = (await maker('get', '/bir/cas/checklist')).body.data.checklist;
    for (const code of ['permit', 'atp', 'custodian', 'contact']) expect(c.find((x) => x.code === code).status).toBe('complete');
    const a = (await query('SELECT after_data FROM audit_log WHERE entity = \'settings\' AND entity_id = \'cas\' ORDER BY id DESC LIMIT 1')).rows[0];
    expect(a.after_data['cas.permit_number']).toBe('CAS-2026-0001');
    const { fields } = (await maker('get', `${SD}/versions`)).body.data;
    expect(fields.find((f) => f.key === 'casPermitNumber').value).toBe('CAS-2026-0001');
    expect(fields.find((f) => f.key === 'casPermitDate').value).toBe('01/02/2026');
  });
});
