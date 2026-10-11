/**
 * Approval of the data loads by a second user: submit, approve (the load runs as a job), reject with a coded reason,
 * withdraw, expiry; the approver is never the uploader, the submitter or a user who resolved one of the load's
 * duplicates, whatever finance.maker_checker_enabled says; what is approved is the batch as validated (file, value maps,
 * cutover date); the direct load is refused while approval is required and approval stays on in production;
 * notifications and the My Work item; the load numbers; the uploaded workbook kept and released only to write:data-load
 * with view:pii.
 */
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache, getSetting } from '../src/lib/settings.js';
import { resolveKey } from '../src/modules/uploads/storage.js';
import { settle, startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';

let s;
let u;

const client = (code, extra = {}) => ({ 'Client Code': code, 'Client Type': 'individual', 'First Name': 'Ana', 'Last Name': code, ...extra });
const decide = (who, id, action, body = {}) => who.api('post', `/data-load/batches/${id}/${action}`).send(body);

/** Upload as one user, submit as another (default the same): the batch waiting for approval. */
async function pending(wb, uploader, submitter = uploader) {
  const r = await uploadAs(uploader.api, wb);
  expect(r.body.data.errors).toEqual([]);
  const sub = await decide(submitter, r.body.data.batch.id, 'submit');
  expect(sub.status, JSON.stringify(sub.body)).toBe(200);
  return sub.body.data;
}

beforeAll(async () => {
  s = await startMigrationSuite({ users: { 'ap.loader': 'dl-loader', 'ap.approver': 'dl-approver', 'ap.resolver': 'dl-both', 'ap.submitter': 'dl-both' } });
  u = { ...s.users, admin: s.admin };
  // switching maker-checker off for finance changes nothing here
  await query('UPDATE app_settings SET value = \'false\' WHERE key = \'finance.maker_checker_enabled\'');
  clearSettingsCache();
  const base = await pending(workbook(s.kits, { Clients: [client('AP-C-1', { TIN: '111-222-333-000' })] }), u['ap.loader']);
  expect((await decide(u['ap.approver'], base.id, 'approve')).status).toBe(202);
  expect((await settle(u.admin.api, base.id)).status).toBe('loaded');
});
afterAll(async () => {
  await pool.end();
});

describe('submit and approve', () => {
  let batch;

  it('submits a validated load, numbered MIG-, and notifies the approvers', async () => {
    const r = await uploadAs(u.admin.api, workbook(s.kits, { Clients: [client('AP-C-2', { TIN: '111222333000' }), client('AP-C-3')] }));
    batch = r.body.data.batch;
    expect(batch.loadNumber).toBe(`MIG-${String(batch.id).padStart(6, '0')}`);
    expect(batch.rowsDuplicate).toBe(1);
    // an unresolved duplicate blocks the submit
    const blocked = await decide(u['ap.submitter'], batch.id, 'submit');
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/duplicates/);
    const res = await u['ap.resolver'].api('post', `/data-load/batches/${batch.id}/resolutions`).send({ rule: 'tin', resolution: 'load-as-new', reason: 'Two persons share the legacy TIN' });
    expect(res.status).toBe(202);
    expect((await settle(u.admin.api, batch.id)).status).toBe('validated');
    const sub = await decide(u['ap.submitter'], batch.id, 'submit');
    expect(sub.status).toBe(200);
    expect(sub.body.data).toMatchObject({ status: 'pending-approval', submittedBy: 'ap.submitter', createdBy: 'BrokerVerse Administrator' });
    expect(await one('SELECT count(*)::int AS n FROM notifications WHERE audience = \'approve:data-load\' AND title = $1', [`Data load ${batch.loadNumber} awaiting approval`])).toEqual({ n: 1 });
    expect((await u['ap.approver'].api('get', '/notifications')).body.data.notifications.some((n) => n.title === `Data load ${batch.loadNumber} awaiting approval`)).toBe(true);
  });

  it('shows the load in the approver\'s My Work, not in the makers\'', async () => {
    const items = async (who) => (await who.api('get', '/my-work/items?category=approvals&scope=me&pageSize=100')).body.data.filter((x) => x.ref === batch.loadNumber);
    expect(await items(u['ap.approver'])).toEqual([expect.objectContaining({ kind: 'Data load', link: `/master/configuration/go-live/loads/${batch.id}` })]);
    expect(await items(u['ap.submitter'])).toEqual([]);
    expect(await items(u['ap.resolver'])).toEqual([]);
  });

  it('refuses the approval by the uploader, the submitter and a user who resolved one of its duplicates (403), and by a user without approve:data-load', async () => {
    for (const who of [u.admin, u['ap.submitter'], u['ap.resolver']]) {
      const r = await decide(who, batch.id, 'approve');
      expect(r.status).toBe(403);
      expect(r.body.message).toMatch(/Maker-checker/);
    }
    expect((await decide(u['ap.loader'], batch.id, 'approve')).status).toBe(403);
    expect((await decide(u.admin, batch.id, 'reject', { reasonCode: 'DLR-FILE' })).status).toBe(403);
    expect((await one('SELECT status FROM data_load_batches WHERE id = $1', [batch.id])).status).toBe('pending-approval');
  });

  it('approves: the load runs as the approver and the submitter is told', async () => {
    const r = await decide(u['ap.approver'], batch.id, 'approve');
    expect(r.status).toBe(202);
    const b = await settle(u.admin.api, batch.id);
    expect(b).toMatchObject({ status: 'loaded', decidedBy: 'ap.approver', loadedBy: 'ap.approver' });
    expect(await one('SELECT count(*)::int AS n FROM clients WHERE client_code IN (\'AP-C-2\', \'AP-C-3\')')).toEqual({ n: 2 });
    const notes = (await query('SELECT title FROM notifications WHERE user_id = $1 AND entity = \'data_load_batch\' AND entity_id = $2 ORDER BY id', [u['ap.submitter'].id, String(batch.id)])).rows;
    expect(notes.map((n) => n.title).sort()).toEqual([`Data load ${batch.loadNumber} approved`, `Data load ${batch.loadNumber} loaded`]);
    expect((await query('SELECT action FROM audit_log WHERE entity = \'data_load_batch\' AND entity_id = $1 ORDER BY id', [String(batch.id)])).rows.map((x) => x.action))
      .toEqual(['upload', 'resolve-duplicate', 'submit', 'approve', 'load']);
  });
});

describe('reject and withdraw', () => {
  it('rejects with a reason of the Reason Codes master (a note when the reason needs one) and tells the submitter', async () => {
    const b = await pending(workbook(s.kits, { Clients: [client('AP-R-1')] }), u['ap.loader']);
    expect((await decide(u['ap.approver'], b.id, 'reject', {})).body.errors).toEqual([{ path: 'reasonCode', message: 'Choose the reason' }]);
    expect((await decide(u['ap.approver'], b.id, 'reject', { reasonCode: 'PCL-OTHER' })).status).toBe(400);
    expect((await decide(u['ap.approver'], b.id, 'reject', { reasonCode: 'DLR-TOTALS' })).body.errors).toEqual([{ path: 'note', message: 'Reason Control totals differ needs a note' }]);
    const r = await decide(u['ap.approver'], b.id, 'reject', { reasonCode: 'DLR-TOTALS', remarks: 'Motor gross premium differs from the legacy listing' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'rejected', decision: 'rejected', decisionReasonCode: 'DLR-TOTALS', decisionRemarks: 'Control totals differ: Motor gross premium differs from the legacy listing' });
    expect(await one('SELECT message FROM notifications WHERE user_id = $1 AND title = $2', [u['ap.loader'].id, `Data load ${b.loadNumber} rejected`]))
      .toEqual({ message: 'Rejected by ap.approver: Control totals differ: Motor gross premium differs from the legacy listing' });
    // a rejected load is validated again, then submitted again
    expect((await decide(u['ap.approver'], b.id, 'approve')).status).toBe(409);
    expect((await u['ap.loader'].api('post', `/data-load/batches/${b.id}/validate`)).status).toBe(202);
    expect(await settle(u.admin.api, b.id)).toMatchObject({ status: 'validated', decision: null, submittedBy: null });
  });

  it('is withdrawn by its submitter only', async () => {
    const b = await pending(workbook(s.kits, { Clients: [client('AP-W-1')] }), u['ap.loader']);
    expect((await decide(u['ap.submitter'], b.id, 'withdraw')).status).toBe(403);
    const w = await decide(u['ap.loader'], b.id, 'withdraw');
    expect(w.status).toBe(200);
    expect(w.body.data.status).toBe('withdrawn');
    expect((await decide(u['ap.approver'], b.id, 'approve')).status).toBe(409);
  });
});

describe('what is approved is the batch as validated', () => {
  it('refuses the approval when a value map changed since the validation: validate again', async () => {
    const b = await pending(workbook(s.kits, { Clients: [client('AP-M-1')] }), u['ap.loader']);
    expect((await u['ap.loader'].api('post', '/data-load/value-maps').send({ object: 'insurer', legacyValue: 'Malayan Ins. Co.', targetCode: 'MALAYAN' })).status).toBe(201);
    const r = await decide(u['ap.approver'], b.id, 'approve');
    expect(r.status).toBe(409);
    expect(r.body.message).toBe('Value maps changed since the validation: validate the batch again');
    expect((await one('SELECT status FROM data_load_batches WHERE id = $1', [b.id])).status).toBe('pending-approval');
  });

  it('refuses the approval when the stored file is not the file validated', async () => {
    const b = await pending(workbook(s.kits, { Clients: [client('AP-F-1')] }), u['ap.loader']);
    const { file_key: key } = await one('SELECT file_key FROM data_load_batches WHERE id = $1', [b.id]);
    fs.writeFileSync(resolveKey(key), Buffer.concat([fs.readFileSync(resolveKey(key)), Buffer.from('x')]));
    const r = await decide(u['ap.approver'], b.id, 'approve');
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/SHA-256 differs/);
  });

  it('the cutover date cannot change while a load waits for approval', async () => {
    const r = await u['ap.loader'].api('put', '/data-load/golive/cutover-date').send({ cutoverDate: '2027-01-01' });
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/undo it or let it finish/);
  });
});

describe('direct load and the setting', () => {
  it('refuses the direct load while approval is required', async () => {
    const r = await uploadAs(u['ap.loader'].api, workbook(s.kits, { Clients: [client('AP-D-1')] }));
    const l = await u['ap.loader'].api('post', `/data-load/batches/${r.body.data.batch.id}/load`).send({});
    expect(l.status).toBe(409);
    expect(l.body.message).toBe('Each load is approved by a second user: submit the load for approval');
  });

  it('approval cannot be switched off in production, nor by PUT /settings; the direct load stays refused there', async () => {
    expect((await u.admin.api('put', '/settings').send({ settings: { 'migration.load_approval_required': false } })).status).toBe(400);
    await query('UPDATE app_settings SET value = \'"production"\' WHERE key = \'system.environment\'');
    clearSettingsCache();
    try {
      const r = await u.admin.api('put', '/data-load/golive/settings').send({ settings: { loadApprovalRequired: false }, reason: 'Rehearsal' });
      expect(r.status).toBe(409);
      await query('UPDATE app_settings SET value = \'false\' WHERE key = \'migration.load_approval_required\'');
      clearSettingsCache();
      const b = await uploadAs(u['ap.loader'].api, workbook(s.kits, { Clients: [client('AP-D-2')] }));
      expect((await u['ap.loader'].api('post', `/data-load/batches/${b.body.data.batch.id}/load`).send({})).status).toBe(409);
    } finally {
      await query('UPDATE app_settings SET value = \'"dev"\' WHERE key = \'system.environment\'');
      await query('UPDATE app_settings SET value = \'true\' WHERE key = \'migration.load_approval_required\'');
      clearSettingsCache();
    }
    // outside production it may be switched off for a rehearsal: requested with a reason, approved by another user
    // (audited); never by the requester
    expect((await u['ap.loader'].api('put', '/data-load/golive/settings').send({ settings: { loadApprovalRequired: false } })).status).toBe(400);
    const r = await u['ap.loader'].api('put', '/data-load/golive/settings').send({ settings: { loadApprovalRequired: false }, reason: 'Rehearsal of the cutover' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ action: 'settings', status: 'pending', settings: [{ field: 'loadApprovalRequired', before: true, after: false }] });
    expect((await u['ap.loader'].api('post', `/data-load/golive/lock-requests/${r.body.data.id}/approve`).send({})).status).toBe(403);
    expect((await u['ap.approver'].api('post', `/data-load/golive/lock-requests/${r.body.data.id}/approve`).send({})).status).toBe(200);
    expect(await one('SELECT before_data->>\'loadApprovalRequired\' AS b, after_data->>\'loadApprovalRequired\' AS a FROM audit_log WHERE entity = \'golive_setting\' ORDER BY id DESC LIMIT 1'))
      .toEqual({ b: 'true', a: 'false' });
    const back = await u['ap.approver'].api('put', '/data-load/golive/settings').send({ settings: { loadApprovalRequired: true }, reason: 'Rehearsal done' });
    expect(back.status).toBe(201);
    expect((await u['ap.loader'].api('post', `/data-load/golive/lock-requests/${back.body.data.id}/approve`).send({})).status).toBe(403);
    expect((await u.admin.api('post', `/data-load/golive/lock-requests/${back.body.data.id}/approve`).send({})).status).toBe(200);
    expect(await getSetting('migration.load_approval_required', null)).toBe(true);
  });

  it('a configuration load is approved the same way and numbered CFG-; it returns no temporary password', async () => {
    const wb = workbook(s.kits, { 'Write-off Reasons': [{ 'Reason Code': 'AP-WO', Reason: 'Approval test', 'GL Account': '6999001', Status: 'Active' }] }, 'configuration');
    const r = await uploadAs(u['ap.loader'].api, wb, 'configuration');
    expect(r.body.data.batch.loadNumber).toMatch(/^CFG-\d{6}$/);
    expect((await decide(u['ap.loader'], r.body.data.batch.id, 'submit')).status).toBe(200);
    const a = await decide(u['ap.approver'], r.body.data.batch.id, 'approve');
    expect(a.status).toBe(202);
    expect(a.body.data.temporaryPasswords).toBeUndefined();
    expect((await settle(u.admin.api, r.body.data.batch.id)).status).toBe('loaded');
  });
});

describe('the uploaded workbook', () => {
  it('is kept with its SHA-256 and released only to write:data-load with view:pii, each download audited; never through a file link', async () => {
    const wb = workbook(s.kits, { Clients: [client('AP-U-1', { TIN: '999-888-777-000' })] });
    const r = await uploadAs(u['ap.loader'].api, wb);
    const b = r.body.data.batch;
    expect(b.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await u['ap.loader'].api('get', `/data-load/batches/${b.id}/file`)).status).toBe(403);
    expect((await u['ap.approver'].api('get', `/data-load/batches/${b.id}/file`)).status).toBe(403);
    const f = await u.admin.api('get', `/data-load/batches/${b.id}/file`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(f.status).toBe(200);
    expect(Buffer.compare(f.body, wb)).toBe(0);
    expect(f.headers['cache-control']).toBe('no-store');
    expect(await one('SELECT user_id, after_data->>\'fileSha256\' AS sha FROM audit_log WHERE entity = \'data_load_batch\' AND action = \'download-file\' AND entity_id = $1', [String(b.id)]))
      .toEqual({ user_id: s.admin.id, sha: b.fileSha256 });
    const { file_key: key } = await one('SELECT file_key FROM data_load_batches WHERE id = $1', [b.id]);
    expect(key).toMatch(/^go-live-loads\//);
    expect((await u.admin.api('get', `/s3/object/${key}`)).status).toBe(403);
    expect((await u.admin.api('delete', `/s3/file/${key}`)).status).toBe(403);
  });
});
