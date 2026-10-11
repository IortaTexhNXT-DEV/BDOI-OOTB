/**
 * TISPH lead rules (TIS-BRD-LEAD-01 to LEAD-08): the TFS account import with the TFS detail set, the lists a prospect's
 * values come from, the four-key duplicate check with the Loan ID, the delete permission, the bulk status update by
 * re-upload, assignment by insurance provider and bandwidth with reassignment inside the insurer group, the assignment
 * SLA on working time, the retention of prospects not converted, and marketing consent by the account executives.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, enableFeatures } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { actionTitle } from '../src/lib/auditLabels.js';
import { leadAssignmentSla, leadRetention } from '../src/modules/leads/assignment.js';

const PASSWORD = 'Welcome@123';
let ctx;
const as = {};
const ids = {};
const setting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const sheet = (header, rows) => writeXlsx({ sheets: [{ name: 'Data', columns: header.map((h) => ({ header: h })), rows }] });

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName: username, roles, email: `${username}@example.ph` });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = (await one('SELECT id FROM users WHERE username = $1', [username])).id;
  const token = await loginAs(ctx.app, username, PASSWORD);
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

const TFS = ['Reference No.', 'Loan ID', 'First Name', 'Last Name', 'Birthday', 'Mobile', 'Email', 'Address', 'Barangay', 'City / Municipality', 'Province', 'ZIP Code',
  'Vehicle Make', 'Vehicle Model', 'Vehicle Variant', 'Model Year', 'Plate No.', 'Insurance Provider', 'Policy Expiry Date', 'Loan Start Date', 'Loan Booking Date',
  'Loan Maturity Date', 'Product Group', 'SRP', 'Status'];
const tfsRow = (o) => [o.ref || 'TFS-1', o.loan, o.first || 'Andrea', o.last || 'Villanueva', '1987-06-21', o.mobile || '09173047105', 'andrea@example.ph', '12 Mabini St.',
  'San Antonio', 'Pasig City', 'Metro Manila', '1600', 'Toyota', 'Raize', '1.0 Turbo CVT', '2023', 'NAB 1234', o.insurer ?? 'MALAYAN', o.expiry ?? '2026-12-15',
  '2023-12-15', '2023-12-10', '2028-12-15', 'Motor', '1078000', o.status || ''];

beforeAll(async () => {
  ctx = await setup();
  await persona('tf.assoc', ['tis-sales-associate']);
  await persona('tf.officer', ['tis-sales-officer']);
  await persona('tf.ae1', ['tis-sales-associate']);
  await persona('tf.ae2', ['tis-sales-associate']);
  await query('DELETE FROM lead_assignment_rules');
});
afterAll(async () => { await pool.end(); });

describe('TFS account import', () => {
  it('creates one prospect per loan with the TFS detail set and stamps the batch', async () => {
    const file = sheet(TFS, [tfsRow({ loan: 'LN-1' }), tfsRow({ loan: 'LN-2', expiry: '' }), tfsRow({ loan: 'LN-3', insurer: 'Nowhere Insurance' }), tfsRow({ loan: 'LN-1', first: 'Again' }),
      tfsRow({ loan: 'LN-4', first: 'Fleet', mobile: '09175550001' })]);
    const r = await as['tf.officer']('post', '/leads/tfs-import').attach('file', file, 'TFS_accounts.xlsx');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ total: 5, created: 2, updated: 0, failed: 3 });
    expect(r.body.message).toMatch(/^Processed 5 rows: 2 created, 0 updated, 3 failed \(batch LIB-\d{4}-\d{5}\)$/);
    expect(r.body.data.errors.map((e) => e.message)).toEqual(['Row 3: No policy expiry date: no prospect is created for this account',
      'Row 4: Insurance Provider Nowhere Insurance is not an insurer of Master > Insurance Company', 'Row 5: Loan ID LN-1 appears twice in the file']);
    const lead = (await ctx.api('get', '/leads?query=Andrea')).body.data.find((l) => l.loanId === 'LN-1');
    expect(lead).toMatchObject({ customerType: 'TFS', source: 'TFS', tfsReference: 'TFS-1', insuranceProviderName: 'Malayan Insurance Co., Inc.', policyExpiryDate: '2026-12-15',
      loanMaturityDate: '2028-12-15', productGroup: 'Motor', srp: 1078000, lob: 'MOTOR', productName: 'Motor Vehicle Insurance', vehicle: { make: 'Toyota', model: 'Raize', variant: '1.0 Turbo CVT', modelYear: '2023', plateNumber: 'NAB 1234' } });
    expect(lead.importBatchNumber).toMatch(/^LIB-/);
  });

  it('updates the prospect of a loan already loaded (bulk status update) instead of creating another', async () => {
    const r = await as['tf.officer']('post', '/leads/tfs-import').attach('file', sheet(TFS, [tfsRow({ loan: 'LN-1', status: 'Contacted' })]), 'TFS_again.xlsx');
    expect(r.body.data).toMatchObject({ created: 0, updated: 1, failed: 0 });
    expect((await one("SELECT count(*)::int AS n, max(status) AS status FROM leads WHERE loan_id = 'LN-1'"))).toEqual({ n: 1, status: 'Contacted' });
    const bad = await as['tf.officer']('post', '/leads/tfs-import').attach('file', sheet(TFS, [tfsRow({ loan: 'LN-1', status: 'Foo' })]), 'TFS_bad.xlsx');
    expect(bad.body.data.errors[0].message).toMatch(/Status must be one of New, Contacted/);
  });
  it('names the import and the update in the history of the prospect', () => {
    expect(actionTitle('lead', 'tfs-import')).toBe('Prospect created from the TFS account file');
    expect(actionTitle('lead', 'tfs-update')).toBe('Prospect updated from the TFS account file');
    expect(actionTitle('lead', 'bulk-update')).toBe('Prospect updated by bulk upload');
  });

  it('downloads the TFS account template', async () => {
    const r = await as['tf.officer']('get', '/leads/tfs-import/template');
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toContain('TFS_Accounts_Upload_Template.xlsx');
  });
});

describe('TFS column map (leads.tfs_column_map, GAP-SALES-06)', () => {
  const MAP = 'leads.tfs_column_map';
  it('is delivered with the current columns and is changed by IT AppSupport only, checked and audited', async () => {
    const { TFS_COLUMNS, defaultTfsColumnMap } = await import('../src/modules/leads/tfsColumns.js');
    const delivered = (await one('SELECT value FROM app_settings WHERE key = $1', [MAP])).value;
    expect(delivered).toEqual(defaultTfsColumnMap());
    expect(Object.keys(delivered).sort()).toEqual(TFS_COLUMNS.map((c) => c.key).sort());
    await persona('tf.it', ['tis-it-admin']);
    const map = { ...delivered, loanId: { header: 'TFS Loan Account No.', aliases: ['loan acct'] } };
    expect((await as['tf.officer']('put', '/settings').send({ settings: { [MAP]: map } })).status).toBe(403);
    const unknown = await as['tf.it']('put', '/settings').send({ settings: { [MAP]: { ...map, colour: { header: 'Colour' } } } });
    expect(unknown.status).toBe(400);
    expect(unknown.body.errors[0].message).toMatch(/^colour is not a field of the TFS account file/);
    const twice = await as['tf.it']('put', '/settings').send({ settings: { [MAP]: { ...map, tfsReference: { header: 'Loan Acct' } } } });
    expect(twice.status).toBe(400);
    expect(twice.body.errors.map((e) => e.message).join()).toMatch(/Column name "(Loan Acct|loan acct)" is given to both (loanId|tfsReference) and (loanId|tfsReference)/);
    const noHeader = await as['tf.it']('put', '/settings').send({ settings: { [MAP]: { loanId: { header: ' ' } } } });
    expect(noHeader.body.errors[0].message).toBe('loanId: header is required (up to 80 characters)');
    const saved = await as['tf.it']('put', '/settings').send({ settings: { [MAP]: map } });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const trail = await one("SELECT after_data FROM audit_log WHERE entity = 'settings' AND action = 'update' ORDER BY id DESC LIMIT 1");
    expect(trail.after_data[MAP].loanId.header).toBe('TFS Loan Account No.');
  });

  it('reads the file and builds the template by the configured headers', async () => {
    clearSettingsCache();
    const header = TFS.map((h) => (h === 'Loan ID' ? 'TFS Loan Account No.' : h));
    const r = await as['tf.officer']('post', '/leads/tfs-import').attach('file', sheet(header, [tfsRow({ loan: 'LN-MAP-1', first: 'Mapped' })]), 'TFS_mapped.xlsx');
    expect(r.body.data, JSON.stringify(r.body)).toMatchObject({ created: 1, failed: 0 });
    // a delivered alias the map no longer lists is no longer read: the row has no loan
    const old = await as['tf.officer']('post', '/leads/tfs-import').attach('file', sheet(TFS.map((h) => (h === 'Loan ID' ? 'Loan Number' : h)), [tfsRow({ loan: 'LN-MAP-2' })]), 'TFS_old.xlsx');
    expect(old.body.data.errors[0].message).toMatch(/Loan ID is required/);
    const { readXlsx } = await import('../src/modules/documents/xlsx.js');
    const t = await as['tf.officer']('get', '/leads/tfs-import/template').buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
    expect(readXlsx(t.body)[0]).toContain('TFS Loan Account No.');
    await setting(MAP, (await import('../src/modules/leads/tfsColumns.js')).defaultTfsColumnMap());
  });
});

describe('prospect values', () => {
  it('takes the lead category, customer type and status from their lists', async () => {
    const leasing = await as['tf.assoc']('post', '/leads').send({ firstName: 'Lea', leadCategory: 'Leasing' });
    expect(leasing.status).toBe(400);
    expect(leasing.body.message).toBe('Lead Category must be one of Retail, Corporate');
    const type = await as['tf.assoc']('post', '/leads').send({ firstName: 'Lea', customerType: 'Walk-in' });
    expect(type.body.message).toBe('Customer Type must be one of TFS, Non-TFS, Direct Customer');
    const ok = await as['tf.assoc']('post', '/leads').send({ firstName: 'Lea', lastName: 'Ramos', customerType: 'direct customer', loanId: 'LN-9' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.data.customerType).toBe('Direct Customer');
    const foo = await as['tf.assoc']('put', `/leads/${ok.body.data.id}`).send({ status: 'Foo' });
    expect(foo.status).toBe(400);
    const sameLoan = await as['tf.assoc']('post', '/leads').send({ firstName: 'Other', loanId: 'ln-9' });
    expect(sameLoan.body.message).toBe(`Loan ID ln-9 is already on prospect ${ok.body.data.leadNumber}`);
    await query("UPDATE leads SET status = 'Converted' WHERE id = $1", [ok.body.data.id]);
    const back = await as['tf.assoc']('put', `/leads/${ok.body.data.id}`).send({ status: 'New' });
    expect(back.body.message).toBe(`Prospect ${ok.body.data.leadNumber} is converted; its status cannot change`);
    const opts = (await as['tf.assoc']('get', '/leads/options')).body.data;
    expect(opts.customerTypes).toEqual(['TFS', 'Non-TFS', 'Direct Customer']);
    expect(opts.dispositions).toContain('Not Interested');
  });

  it('checks duplicates on the four keys; another Loan ID of the same customer is not a duplicate', async () => {
    expect((await one("SELECT value FROM app_settings WHERE key = 'leads.duplicate_rule'")).value).toBe('four-key');
    const q = (extra) => as['tf.assoc']('get', `/leads/duplicates?firstName=Andrea&lastName=Villanueva&contactNumber=%2B639173047105&DOB=1987-06-21${extra}`);
    expect((await q('')).body.data.map((m) => m.matchedOn)).toContainEqual(expect.arrayContaining(['mobile', 'name', 'birthDate']));
    expect((await q('&loanId=LN-77')).body.data).toEqual([]);
    expect((await q('&loanId=LN-1')).body.data[0].matchedOn).toContain('loanId');
    // the same mobile alone is no longer a duplicate
    expect((await as['tf.assoc']('get', '/leads/duplicates?firstName=Somebody&lastName=Else&contactNumber=09173047105')).body.data).toEqual([]);
  });

  it('lets the Sales Officer delete a prospect but not the Sales Associate', async () => {
    const l = (await as['tf.assoc']('post', '/leads').send({ firstName: 'Delia', lastName: 'Cruz' })).body.data;
    expect((await as['tf.assoc']('delete', `/leads/${l.id}`)).status).toBe(403);
    expect((await as['tf.officer']('delete', `/leads/${l.id}`)).status).toBe(200);
  });

  it('updates the status of prospects already loaded by re-uploading the prospects file', async () => {
    const l = (await as['tf.assoc']('post', '/leads').send({ firstName: 'Upd', lastName: 'Ate' })).body.data;
    const file = sheet(['Lead Number', 'Status', 'Disposition'], [[l.leadNumber, 'Contacted', 'Interested'], ['LD-1900-00001', 'Contacted', '']]);
    const r = await as['tf.assoc']('post', '/leads/bulk-upload').attach('file', file, 'status.xlsx');
    expect(r.body.data).toMatchObject({ created: 0, updated: 1, failed: 1 });
    expect(await one('SELECT status, disposition FROM leads WHERE id = $1', [l.id])).toEqual({ status: 'Contacted', disposition: 'Interested' });
  });
});

describe('assignment by insurance provider', () => {
  let malayan;
  let pioneer;
  it('assigns a TFS prospect to the insurer group and respects its bandwidth', async () => {
    malayan = (await one("SELECT id FROM insurance_companies WHERE code = 'MALAYAN'")).id;
    pioneer = (await one("SELECT id FROM insurance_companies WHERE code = 'PIONEER'")).id;
    const rule = await as['tf.officer']('post', '/lead-assignment/rules').send({ name: 'Malayan group', priority: 10, method: 'load', maxOpen: 1,
      conditions: { insuranceProviderId: malayan }, assignees: [ids['tf.ae1'], ids['tf.ae2']] });
    expect(rule.status, JSON.stringify(rule.body)).toBe(201);
    expect(rule.body.data).toMatchObject({ maxOpen: 1, insuranceProviderName: 'Malayan Insurance Co., Inc.' });
    await as['tf.officer']('post', '/lead-assignment/rules').send({ name: 'Pioneer group', priority: 20, conditions: { insuranceProviderId: pioneer }, assignees: [ids['tf.officer']] });
    const a = await as['tf.assoc']('post', '/leads').send({ firstName: 'Mal1', insuranceProviderId: malayan });
    const b = await as['tf.assoc']('post', '/leads').send({ firstName: 'Mal2', insuranceProviderId: malayan });
    expect([a.body.data.ownerUserId, b.body.data.ownerUserId].sort()).toEqual([ids['tf.ae1'], ids['tf.ae2']].sort());
    const c = await as['tf.assoc']('post', '/leads').send({ firstName: 'Mal3', insuranceProviderId: malayan });
    expect(c.body.data).toMatchObject({ assignmentStatus: 'queued', queueReason: 'Every account executive of rule "Malayan group" holds 1 open prospects' });
    ids.malLead = a.body.data.id;
  });
  it('reassigns a prospect only inside its insurer group', async () => {
    const out = await as['tf.officer']('post', '/lead-assignment/reassign').send({ leadIds: [ids.malLead], toUserId: ids['tf.officer'], reasonCode: 'REA-WORKLOAD' });
    expect(out.status).toBe(400);
    expect(out.body.errors[0].message).toBe('tf.officer is not in the Malayan Insurance Co., Inc. group: choose an account executive of the Malayan Insurance Co., Inc. rules');
    const owner = (await one('SELECT owner_user_id FROM leads WHERE id = $1', [ids.malLead])).owner_user_id;
    const other = owner === ids['tf.ae1'] ? ids['tf.ae2'] : ids['tf.ae1'];
    expect((await as['tf.officer']('post', '/lead-assignment/reassign').send({ leadIds: [ids.malLead], toUserId: other, reasonCode: 'REA-WORKLOAD' })).status).toBe(200);
  });
});

describe('jobs', () => {
  it('queues a prospect not worked within 72 hours of working time', async () => {
    expect((await one("SELECT value FROM app_settings WHERE key = 'leads.assignment_sla_hours'")).value).toBe(72);
    // assigned Friday 09:00 Manila: Saturday and Sunday do not count
    const l = (await as['tf.assoc']('post', '/leads').send({ firstName: 'Weekend' })).body.data;
    await query("UPDATE leads SET assigned_at = '2026-10-09T01:00:00Z', status = 'New', assignment_status = 'assigned' WHERE id = $1", [l.id]);
    await leadAssignmentSla({ now: new Date('2026-10-13T01:00:00Z') });
    expect((await one('SELECT assignment_status FROM leads WHERE id = $1', [l.id])).assignment_status).toBe('assigned');
    await leadAssignmentSla({ now: new Date('2026-10-14T02:00:00Z') });
    expect((await one('SELECT assignment_status FROM leads WHERE id = $1', [l.id])).assignment_status).toBe('queued');
  });
  it('closes as Lost the prospects not converted within leads.retention_days', async () => {
    const l = (await as['tf.assoc']('post', '/leads').send({ firstName: 'Old' })).body.data;
    await query("UPDATE leads SET updated_at = now() - interval '91 days' WHERE id = $1", [l.id]);
    expect((await leadRetention()).closed).toBeGreaterThanOrEqual(1);
    expect((await one('SELECT status FROM leads WHERE id = $1', [l.id])).status).toBe('Lost');
    await setting('leads.retention_days', 0);
    expect((await leadRetention()).skipped).toMatch(/0/);
  });
});

describe('marketing consent', () => {
  it('is recorded by the Sales Associate who keeps the prospect', async () => {
    // the consents are kept on the Campaigns screen, a future-release feature in TISPH
    await enableFeatures(ctx.app, ['campaigns']);
    const l = (await as['tf.assoc']('post', '/leads').send({ firstName: 'Consenting' })).body.data;
    const r = await as['tf.assoc']('post', '/campaigns/consents').send({ partyType: 'lead', partyId: l.id, granted: false, channel: 'Phone', evidence: 'Asked not to be called' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.status).toBe('refused');
  });
});
