import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { actionText, actionTitle, entityLabel, fieldLabel, pathLabel, sentenceCase } from '../src/lib/auditLabels.js';
import { MASK, diffFields, flatten, formatValue, groupFieldChanges, instant, sourceOf, userOf, exportRows } from '../src/lib/auditEvents.js';
import { auditSource } from '../src/lib/audit.js';

const FMT = { dateFormat: 'DD/MM/YYYY', decimals: 2, currency: 'PHP', timeZone: 'Asia/Manila' };
const ctx = (extra = {}) => ({ fmt: FMT, canSeePersonal: false, statusLabels: {}, refs: new Map(), fieldLabels: {}, masterLabels: {}, anonymised: false, ...extra });

describe('audit labels', () => {
  it('maps field keys to business labels per record type, with a sentence-case fallback', () => {
    expect(fieldLabel('claim', 'insuranceCompanyClaimNumber')).toBe('Insurer claim number');
    expect(fieldLabel('claim', 'dateOfIncident')).toBe('Date of loss');
    expect(fieldLabel('claim', 'ClaimStatus')).toBe('Claim status');
    expect(fieldLabel('policy', 'grossPremium')).toBe('Gross premium');
    expect(fieldLabel('client', 'tin')).toBe('TIN');
    expect(fieldLabel('policy', 'someOddFieldKey')).toBe('Some odd field key');
    expect(fieldLabel('policy', 'loss_reserve_amount')).toBe('Loss reserve amount');
    expect(fieldLabel('master:insurance-company', 'InsuranceCompanyName', { InsuranceCompanyName: 'Insurer name' })).toBe('Insurer name');
    expect(sentenceCase('vatRegistered')).toBe('VAT registered');
  });
  it('labels nested keys without repeating the parent', () => {
    expect(pathLabel('claim', 'adjuster.adjusterName')).toBe('Adjuster');
    expect(pathLabel('claim', 'thirdPartyDetails.plateNumber')).toBe('Third party – plate number');
    expect(pathLabel('claim', 'driverDetails.driverName')).toBe('Driver name');
  });
  it('turns actions into event headlines', () => {
    expect(actionTitle('policy', 'create')).toBe('Policy created');
    expect(actionTitle('policy', 'payment-capture')).toBe('Policy payment captured');
    expect(actionTitle('claim', 'Settlement Submitted')).toBe('Settlement submitted');
    expect(actionTitle('master:insurance-company', 'status:inactive', { 'insurance-company': 'Insurance company' })).toBe('Insurance company deactivated');
    expect(actionTitle('quotation', 'send-to-customer')).toBe('Quotation: send to customer');
    expect(actionText('status:active')).toBe('Activated');
    expect(entityLabel('journal_voucher')).toBe('Journal voucher');
  });
});

describe('audit value formatting', () => {
  it('formats values by type', () => {
    expect(formatValue('grossPremium', '12500', ctx())).toBe('PHP 12,500.00');
    expect(formatValue('estimatedClaimAmount', 85000, ctx(), 'USD')).toBe('USD 85,000.00');
    expect(formatValue('commissionRate', '0.15', ctx())).toBe('0.15');
    expect(formatValue('dateOfIncident', '2026-09-28', ctx())).toBe('28/09/2026');
    expect(formatValue('submittedOn', '2026-10-02T01:49:37.774Z', ctx())).toBe('02/10/2026 09:49');
    expect(formatValue('inceptionDate', '2026-09-30T16:00:00.000Z', ctx())).toBe('01/10/2026');
    expect(formatValue('claimStatus', 'in-review', ctx({ statusLabels: { 'in-review': 'Processing' } }))).toBe('Processing');
    expect(formatValue('status', 'pending-approval', ctx())).toBe('Pending approval');
    expect(formatValue('paymentMethod', 'bank-transfer', ctx())).toBe('Bank transfer');
    expect(formatValue('isActive', true, ctx())).toBe('Yes');
    expect(formatValue('vatRegistered', false, ctx())).toBe('No');
    expect(formatValue('remarks', '', ctx())).toBeNull();
    expect(formatValue('remarks', null, ctx())).toBeNull();
    expect(formatValue('remarks', 'Approved 2026-10-02T01:49:37.774Z by finance', ctx())).toBe('Approved 02/10/2026 09:49 by finance');
    expect(formatValue('handlerUserId', 'usr_0123456789abcdef', ctx({ refs: new Map([['usr_0123456789abcdef', 'Jasmine Cruz']]) }))).toBe('Jasmine Cruz');
    expect(formatValue('tags', ['a', 'b'], ctx())).toBe('a, b');
  });
  it('never shows secrets and masks ID numbers without read:privacy', () => {
    expect(formatValue('password', 'Secret#123', ctx())).toBe(MASK);
    expect(formatValue('password_hash', '$2a$10$abc', ctx())).toBe(MASK);
    expect(formatValue('totpSecret', 'JBSWY3DPEHPK3PXP', ctx())).toBe(MASK);
    expect(formatValue('refreshToken', 'abc.def', ctx())).toBe(MASK);
    expect(formatValue('tin', '123-456-789-000', ctx())).toBe(`${MASK}-000`);
    expect(formatValue('tin', '123-456-789-000', ctx({ canSeePersonal: true }))).toBe('123-456-789-000');
    expect(formatValue('email', 'olivia@example.ph', ctx({ anonymised: true }))).toBe('Anonymised');
  });
  it('flattens nested objects into labelled fields and skips bookkeeping keys', () => {
    expect(flatten({ adjuster: '{"adjusterName":"A. Santos","submittedAt":"2026-10-02T01:49:37.774Z"}' })).toEqual({ 'adjuster.adjusterName': 'A. Santos', 'adjuster.submittedAt': '2026-10-02T01:49:37.774Z' });
    const changes = diffFields('claim', { adjuster: { adjusterName: 'A. Santos', adjusterStatus: 'pending', submittedBy: 'x' }, updatedAt: '2026-01-01' },
      { adjuster: { adjusterName: 'B. Reyes', adjusterStatus: 'submitted', submittedBy: 'y', submittedAt: '2026-10-02T01:49:37.774Z' }, updatedAt: '2026-10-02' }, ctx());
    expect(changes).toEqual([
      { key: 'adjuster.adjusterName', label: 'Adjuster', from: 'A. Santos', to: 'B. Reyes' },
      { key: 'adjuster.adjusterStatus', label: 'Adjuster report status', from: 'Pending', to: 'Submitted' },
    ]);
  });
  it('lists the values set on creation and ignores values that only changed form', () => {
    expect(diffFields('policy', null, { policyNumber: 'MC-1', grossPremium: 100, remarks: '' }, ctx()).map((c) => [c.label, c.from, c.to]))
      .toEqual([['Policy number', null, 'MC-1'], ['Gross premium', null, 'PHP 100.00']]);
    expect(diffFields('policy', { grossPremium: '100.00' }, { grossPremium: 100 }, ctx())).toEqual([]);
    const pw = diffFields('user', { password_hash: 'a' }, { password_hash: 'b' }, ctx());
    expect(pw).toEqual([{ key: 'password_hash', label: 'Password hash', from: MASK, to: MASK, masked: true }]);
  });
  it('gives instants in the business time zone and configured date format', () => {
    expect(instant('2026-10-01T17:30:00Z', FMT)).toEqual({ day: '2026-10-02', date: '02/10/2026', time: '01:30', text: '02/10/2026 01:30' });
  });
});

describe('audit grouping, user and source', () => {
  it('groups the field rows of one claim action into one event', () => {
    const at = new Date('2026-10-02T01:49:37.774Z');
    const rows = [
      { id: 1, at, username: 'j.claims', claim_id: 'clm_1', action: 'Claim Registered', field_name: 'claimStatus', old_value: null, new_value: 'registered' },
      { id: 2, at, username: 'j.claims', claim_id: 'clm_1', action: 'Claim Registered', field_name: 'policyNumber', old_value: null, new_value: 'MC-1' },
      { id: 3, at: new Date(at.getTime() + 60000), username: 'j.claims', claim_id: 'clm_1', action: 'Status Changed', field_name: 'claimStatus', old_value: 'registered', new_value: 'in-review' },
    ];
    const g = groupFieldChanges(rows);
    expect(g).toHaveLength(2);
    expect(g[0].changes).toEqual([['claimStatus', null, 'registered'], ['policyNumber', null, 'MC-1']]);
    expect(g[1]).toMatchObject({ action: 'Status Changed', entity: 'claim', entity_id: 'clm_1' });
  });
  it('names the source and the user of an event', () => {
    expect(sourceOf({ source: { channel: 'screen', name: 'Operations > Claims > Request approval' } })).toEqual({ channel: 'screen', label: 'Screen', name: 'Operations > Claims > Request approval' });
    expect(sourceOf({ source: { channel: 'screen', name: 'Master > (any master screen)' } }).name).toBe('Master');
    expect(sourceOf({ source: { channel: 'api', name: 'PUT /claims/:id' } }).label).toBe('API');
    expect(sourceOf({ user_id: null, username: null, action: 'run' })).toMatchObject({ channel: 'job', label: 'System job' });
    expect(sourceOf({ user_id: null, username: 'customer:a@b.ph', action: 'respond' }).label).toBe('Customer portal');
    expect(userOf({ user_id: 'usr_1', username: 'j.claims', display_name: 'Jasmine Cruz', role_names: ['Claims Officer'] }))
      .toEqual({ id: 'usr_1', username: 'j.claims', displayName: 'Jasmine Cruz', roles: ['Claims Officer'] });
    expect(userOf({ user_id: null, username: 'customer:a@b.ph' }).displayName).toBe('Customer');
    expect(auditSource({ headers: { origin: 'https://app' }, get: (h) => ({ origin: 'https://app' })[h], routeInfo: { screen: 'Operations > Policies', method: 'PUT', path: '/policies/:id' } }))
      .toEqual({ channel: 'screen', name: 'Operations > Policies' });
    expect(auditSource({ headers: {}, get: () => undefined, routeInfo: { screen: 'X', method: 'PUT', path: '/policies/:id' } })).toEqual({ channel: 'api', name: 'PUT /policies/:id' });
  });
  it('exports one row per changed field', () => {
    const rows = exportRows([{ date: '02/10/2026', time: '09:49', user: { displayName: 'A', roles: ['R'] }, entityLabel: 'Policy', reference: 'MC-1', title: 'Policy updated',
      note: null, source: { label: 'Screen', name: 'Operations > Policies' }, changes: [{ label: 'Gross premium', from: 'PHP 1.00', to: 'PHP 2.00' }, { label: 'Remarks', from: null, to: 'x' }] }]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ field: 'Remarks', from: '', to: 'x', source: 'Screen: Operations > Policies', role: 'R' });
  });
});

describe('audit trail API', () => {
  let app;
  let api;
  let clientId;
  beforeAll(async () => {
    ({ app, api } = await setup());
  });
  afterAll(async () => { await pool.end(); });

  it('records the source of a change and returns the record history as events with labels', async () => {
    const c = await api('post', '/clients').set('Origin', 'http://localhost:3000')
      .send({ firstName: 'Olivia', lastName: 'Chua', emailId: 'olivia@example.ph', leadCategory: 'Retail', city: 'Taguig' });
    expect(c.status).toBe(201);
    clientId = c.body.clientId;
    await api('put', `/clients/${clientId}`).send({ contactNumber: '09175550000', lastName: 'Chua-Tan' });
    const r = await api('get', `/audit/records/client/${clientId}`);
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThanOrEqual(2);
    const [update, create] = r.body.data;
    expect(update).toMatchObject({ entity: 'client', entityLabel: 'Client', title: 'Client updated', source: { channel: 'api', label: 'API' } });
    expect(update.user).toMatchObject({ username: 'BrokerVerse' });
    expect(update.user.roles.length).toBeGreaterThan(0);
    expect(update.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(update.time).toMatch(/^\d{2}:\d{2}$/);
    expect(update.changes.find((x) => x.label === 'Last name')).toMatchObject({ from: 'Chua', to: 'Chua-Tan' });
    expect(update.changes.some((x) => /updated/i.test(x.label))).toBe(false);
    expect(create).toMatchObject({ title: 'Client created', source: { channel: 'screen', label: 'Screen' } });
    expect(create.reference).toMatch(/Olivia/);
    // by record number too
    const code = (await api('get', `/clients/${clientId}`)).body.generatedClientId;
    expect((await api('get', `/audit/records/client/${code}`)).body.data.length).toBe(r.body.data.length);
  });

  it('pages the audit log as events with filters and downloads it', async () => {
    const r = await api('get', '/settings/audit/events?entity=client&page=1&pageSize=1');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.total).toBeGreaterThanOrEqual(2);
    expect(r.body.data[0]).toMatchObject({ entity: 'client', entityLabel: 'Client' });
    const code = (await api('get', `/clients/${clientId}`)).body.generatedClientId;
    const byRef = await api('get', `/settings/audit/events?entityRef=${code}&pageSize=50`);
    expect(byRef.body.data.length).toBeGreaterThanOrEqual(2);
    expect(byRef.body.data.every((e) => e.entityId === clientId)).toBe(true);
    expect((await api('get', '/settings/audit/events?from=2026-13-01')).status).toBe(400);
    const opts = await api('get', '/settings/audit/options');
    expect(opts.body.data.recordTypes.find((t) => t.value === 'client')).toMatchObject({ label: 'Client' });
    expect(opts.body.data.users.find((u) => u.value === 'BrokerVerse')).toBeTruthy();
    const csv = await api('get', `/settings/audit/events?entityRef=${code}&export=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toMatch(/Date,Time,User,Role,Record type,Record,Event,Field,Old value,New value/);
    expect(csv.text).toMatch(/Last name,Chua,Chua-Tan/);
  });

  it('never shows password hashes or secrets in the trail', async () => {
    const u = await api('post', '/users').send({ username: 'a.trail', password: 'Welcome@123', displayName: 'Audit Trail', roles: ['sales'] });
    expect(u.status).toBe(201);
    const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', ['a.trail']);
    await pool.query(`INSERT INTO audit_log(user_id, username, entity, entity_id, action, before_data, after_data)
      VALUES ($1, 'BrokerVerse', 'user', $1, 'update', $2, $3)`, [rows[0].id, JSON.stringify({ password_hash: 'old-hash', totp_secret: 'AAAA', displayName: 'Audit Trail' }),
      JSON.stringify({ password_hash: 'new-hash', totp_secret: 'BBBB', displayName: 'Audit Trail 2' })]);
    const r = await api('get', `/audit/records/user/${rows[0].id}`);
    const text = JSON.stringify(r.body.data);
    expect(text).not.toMatch(/old-hash|new-hash|AAAA|BBBB/);
    expect(r.body.data[0].changes.find((c) => c.key === 'password_hash')).toMatchObject({ from: MASK, to: MASK, masked: true });
  });

  it('opens a record history only to users who may read the record', async () => {
    await api('post', '/roles').send({ code: 'profile-only', name: 'Profile only (test)', permissions: ['read:profile', 'read:policies'] });
    await api('post', '/users').send({ username: 'a.finance', password: 'Welcome@123', displayName: 'A Finance', roles: ['profile-only'] });
    const token = await loginAs(app, 'a.finance', 'Welcome@123');
    const as = (p) => request(app).get(`/api${p}`).set('Authorization', `Bearer ${token}`);
    expect((await as('/audit/records/claim/clm_missing')).status).toBe(403);
    expect((await as(`/audit/records/client/${clientId}`)).status).toBe(403);
    expect((await as('/audit/records/policy/pol_missing')).status).toBe(200);
    expect((await as('/settings/audit/events')).status).toBe(403);
  });
});
