/**
 * The go-live lock: switched on by two users once the production run has its Go decision, its reconciliation signed,
 * its restore point and no load in progress; owned by Data Migration & Go-Live > Go-Live (refused by PUT /settings,
 * the system configuration and the Settings sheet). Once locked every migration import answers 409: the migration
 * workbook, the policies go-live upload and the legacy-dated rows of the ordinary upload, the open items and opening
 * balances imports, the undo and the transaction reset. An unlock reopens only the imports it names, for its hours,
 * and relocks by itself; after the window it needs a steering committee reference. Every route that loads legacy data
 * is guarded or listed as exempt with the reason.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { one, pool, query } from '../src/db/pool.js';
import { ROUTES } from '../src/lib/registry.js';
import { clearSettingsCache, getSetting } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { addDays } from '../src/lib/dates.js';
import { isGoLiveLocked } from '../src/lib/goLiveLock.js';
import { relock } from '../src/modules/data-load/golive.js';
import { loginAs } from './helpers.js';
import { productionRun, startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';

let s;
let requester;
let approver;
let validated;

const sheet = (rows) => writeXlsx({ sheets: [{ name: 'Data', columns: Object.keys(rows[0]).map((h) => ({ header: h })), rows: rows.map((r) => Object.values(r)) }] });
const lockRequest = (who, body) => who.api('post', '/data-load/golive/lock-requests').send(body);
const decide = (who, id, action, body = {}) => who.api('post', `/data-load/golive/lock-requests/${id}/${action}`).send(body);
const migrationUpload = (who = s.admin) => uploadAs(who.api, workbook(s.kits, { Clients: [{ 'Client Code': `LK-${Date.now()}`, 'Client Type': 'corporate', 'Company Name': 'Lock Corp.' }] }));
const openItems = (who = s.admin) => who.api('post', '/receipts/opening-items/import').field('goLiveDate', s.cutover)
  .attach('file', sheet([{ 'Policy Number': 'LK-P-1', 'Bill Reference': 'LK-DN-1', 'Due Date': addDays(s.cutover, 10), 'Open Balance': '100' }]), 'items.xlsx');
const openingBalances = (path) => s.admin.api('post', `/period-end/opening-balances/${path}`).field('goLiveDate', s.cutover)
  .attach('file', sheet([{ 'Account Code': '1202001', Debit: '100' }, { 'Account Code': '2201001', Credit: '100' }]), 'tb.xlsx');
const policyRow = (number, issued) => ({ 'Policy Number': number, 'Insured Name': 'Lito Garcia', 'Insurance Company': 'MALAYAN', 'Inception Date': issued,
  'Expiry Date': addDays(issued, 365), 'Issue Date': issued, 'Gross Premium': '12000' });
const bulk = (rows, mode = null) => {
  const r = s.admin.api('post', '/policies/bulk-upload');
  return (mode ? r.field('mode', mode) : r).attach('file', sheet(rows), 'policies.xlsx');
};

beforeAll(async () => {
  s = await startMigrationSuite({ users: { 'lk.requester': 'dl-both', 'lk.approver': 'dl-approver' } });
  requester = s.users['lk.requester'];
  approver = s.users['lk.approver'];
});
afterAll(async () => {
  await pool.end();
});

describe('owned settings', () => {
  it('the go-live settings are refused by PUT /settings, the system configuration and the Settings sheet', async () => {
    for (const [key, value] of [['golive.locked', true], ['golive.cutover_date', '2027-01-01'], ['golive.locked_at', 'x'], ['migration.load_approval_required', false],
      ['migration.kpi_include_migrated', true]]) {
      const r = await s.admin.api('put', '/settings').send({ settings: { [key]: value } });
      expect(r.status, key).toBe(400);
      expect(r.body.message).toMatch(/managed in Master > System Configuration > Data Migration & Go-Live > Go-Live/);
    }
    expect((await s.admin.api('put', '/system-settings/configuration').send({ settings: { 'golive.locked': true } })).status).toBe(400);
    const wb = workbook(s.kits, { Settings: [{ 'Setting Key': 'golive.locked', Value: 'true' }, { 'Setting Key': 'migration.sap_gl_include_opening', Value: 'true' }] }, 'configuration');
    const r = await uploadAs(s.admin.api, wb, 'configuration');
    expect(r.body.data.errors.map((e) => [e.row, e.column])).toEqual([[2, 'Setting Key'], [3, 'Setting Key']]);
    expect(await getSetting('golive.locked')).toBe(false);
  });

  it('the cutover date is set on the Go-Live tab, audited', async () => {
    const r = await requester.api('put', '/data-load/golive/cutover-date').send({ cutoverDate: 'next monday' });
    expect(r.status).toBe(400);
    const ok = await requester.api('put', '/data-load/golive/cutover-date').send({ cutoverDate: s.cutover });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ cutoverDate: s.cutover, locked: false });
  });
});

describe('single-object go-live imports before the lock', () => {
  it('need write:data-load besides their own permission', async () => {
    const role = await s.admin.api('post', '/roles').send({ code: 'lk-finance', name: 'lk-finance', permissions: ['read:profile', 'read:receipts', 'write:receipts', 'read:period-end', 'write:period-end',
      'read:policies', 'write:policies'] });
    expect(role.status).toBe(201);
    expect((await s.admin.api('post', '/users').send({ username: 'lk.finance', password: 'Welcome@123', displayName: 'lk.finance', email: 'lk.finance@example.ph', roles: ['lk-finance'],
      mustChangePassword: false })).status).toBe(201);
    const token = await loginAs(s.app, 'lk.finance', 'Welcome@123');
    const as = (m, p) => request(s.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
    expect((await as('post', '/receipts/opening-items/import').field('goLiveDate', s.cutover).attach('file', sheet([{ 'Policy Number': 'x' }]), 'i.xlsx')).status).toBe(403);
    expect((await as('post', '/period-end/opening-balances/validate').field('goLiveDate', s.cutover).attach('file', sheet([{ 'Account Code': 'x' }]), 'tb.xlsx')).status).toBe(403);
    const p = await as('post', '/policies/bulk-upload').field('mode', 'go-live').attach('file', sheet([policyRow('LK-X-1', addDays(s.cutover, -30))]), 'p.xlsx');
    expect(p.status).toBe(403);
    expect(p.body.message).toMatch(/write:data-load/);
  });
});

describe('the lock', () => {
  it('is refused without a Go decision of the production run, a signed reconciliation, a restore point, or with a load in progress', async () => {
    const none = await lockRequest(requester, { action: 'lock', reason: 'Cutover complete' });
    expect(none.status).toBe(409);
    expect(none.body.errors.map((e) => e.path)).toEqual(['go-decision', 'reconciliation', 'restore-point']);
    await productionRun({ decision: 'no-go' });
    expect((await lockRequest(requester, { action: 'lock', reason: 'Cutover complete' })).body.errors.map((e) => e.path)).toEqual(['go-decision']);
    await productionRun({ reconciliation: 'open' });
    expect((await lockRequest(requester, { action: 'lock', reason: 'Cutover complete' })).body.errors.map((e) => e.path)).toEqual(['reconciliation']);
    await productionRun();
    const r = await migrationUpload(requester);
    expect((await requester.api('post', `/data-load/batches/${r.body.data.batch.id}/submit`).send({})).status).toBe(200);
    const pending = await lockRequest(requester, { action: 'lock', reason: 'Cutover complete' });
    expect(pending.status).toBe(409);
    expect(pending.body.message).toMatch(new RegExp(`no load waiting for approval, running or being undone \\(${r.body.data.batch.loadNumber}\\)`));
    expect((await requester.api('post', `/data-load/batches/${r.body.data.batch.id}/withdraw`)).status).toBe(200);
  });

  it('is requested by one user and approved by another; the requester cannot approve it', async () => {
    validated = (await migrationUpload(requester)).body.data.batch;
    const r = await lockRequest(requester, { action: 'lock', reason: 'Cutover complete; Go decision of the steering committee' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ action: 'lock', status: 'pending', requestedBy: 'lk.requester' });
    expect(r.body.data.decisionId).toBeGreaterThan(0);
    expect((await lockRequest(requester, { action: 'lock', reason: 'again' })).status).toBe(409);
    const self = await decide(requester, r.body.data.id, 'approve');
    expect(self.status).toBe(403);
    expect(self.body.message).toMatch(/Maker-checker/);
    const ok = await decide(approver, r.body.data.id, 'approve');
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ status: 'approved', decidedBy: 'lk.approver' });
    clearSettingsCache();
    expect(await getSetting('golive.locked')).toBe(true);
    expect(await getSetting('golive.locked_by')).toBe(String(r.body.data.id));
    const g = (await requester.api('get', '/data-load/golive')).body.data;
    expect(g).toMatchObject({ locked: true, lockRequestId: r.body.data.id, unlock: null });
    expect(new Date(g.lockedAt).getTime()).toBeGreaterThan(Date.now() - 60000);
    expect((await query('SELECT action FROM audit_log WHERE entity = \'go_live_lock\' AND entity_id = $1 ORDER BY id', [String(r.body.data.id)])).rows.map((x) => x.action))
      .toEqual(['request', 'approve']);
    expect((await lockRequest(requester, { action: 'lock', reason: 'again' })).body.message).toBe('Go-live is already locked');
  });

  it('closes every migration import (409) and keeps the configuration workbook open', async () => {
    const refusals = [
      await requester.api('post', '/data-load/batches').field('kit', 'migration').attach('file', workbook(s.kits, { Clients: [{ 'Client Code': 'LK-A', 'Client Type': 'corporate', 'Company Name': 'A' }] }), 'm.xlsx'),
      await requester.api('post', `/data-load/batches/${validated.id}/validate`),
      await requester.api('post', `/data-load/batches/${validated.id}/submit`).send({}),
      await bulk([policyRow('LK-GL-1', addDays(s.cutover, -30))], 'go-live'),
      await openItems(),
      await openingBalances('validate'),
      await openingBalances('import'),
    ];
    for (const r of refusals) {
      expect(r.status, JSON.stringify(r.body)).toBe(409);
      expect(r.body.message).toMatch(/^Go-live is locked: migration imports are closed \(locked on \d{2}\/\d{2}\/\d{4}\)$/);
    }
    expect((await uploadAs(requester.api, workbook(s.kits, { 'Write-off Reasons': [{ 'Reason Code': 'LK-WO', Reason: 'After go-live', 'GL Account': '6999001', Status: 'Active' }] }, 'configuration'),
      'configuration')).status).toBe(202);
    expect(await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'go_live_lock\' AND action = \'refused-locked\'')).toEqual({ n: 7 });
    expect(await isGoLiveLocked(pool)).toBe(true);
  });

  it('refuses a file of the ordinary policy upload with rows issued before the cutover date; business issued after it still loads', async () => {
    const legacy = await bulk([policyRow('LK-NEW-1', addDays(s.cutover, 1)), policyRow('LK-OLD-1', addDays(s.cutover, -20))]);
    expect(legacy.status).toBe(409);
    expect(legacy.body.errors).toEqual([{ path: 'row 3', message: 'Row 3: Issue date before go-live: legacy business is loaded by the migration workbook' }]);
    const issued = await bulk([policyRow('LK-NEW-2', addDays(s.cutover, 1))]);
    expect(issued.status).toBe(200);
    expect(issued.body.data.created).toBe(1);
  });
});

describe('unlock', () => {
  let unlock;

  it('needs the imports it reopens and hours up to migration.unlock_max_hours', async () => {
    expect((await lockRequest(requester, { action: 'unlock', reason: 'Late legacy claim', hours: 2 })).body.errors[0].path).toBe('scope');
    expect((await lockRequest(requester, { action: 'unlock', reason: 'Late legacy claim', scope: ['everything'], hours: 2 })).status).toBe(400);
    expect((await lockRequest(requester, { action: 'unlock', reason: 'Late legacy claim', scope: ['migration'], hours: 5 })).body.errors[0]).toEqual({ path: 'hours', message: 'Hours must be a whole number from 1 to 4' });
    const r = await lockRequest(requester, { action: 'unlock', reason: 'Late legacy claim found on day 2', scope: ['migration'], hours: 2 });
    expect(r.status).toBe(201);
    unlock = r.body.data;
    expect(unlock).toMatchObject({ scope: ['migration'], scopeLabels: ['Migration workbook'], hours: 2, expiresAt: null });
  });

  it('reopens only the named imports for its hours; undo and the reset stay refused', async () => {
    expect((await decide(requester, unlock.id, 'approve')).status).toBe(403);
    const ok = await decide(approver, unlock.id, 'approve');
    expect(ok.status).toBe(200);
    const hours = (new Date(ok.body.data.expiresAt).getTime() - new Date(ok.body.data.decidedAt).getTime()) / 3600000;
    expect(hours).toBeCloseTo(2, 3);
    expect((await requester.api('get', '/data-load/golive')).body.data.unlock).toMatchObject({ id: unlock.id, scope: ['migration'] });
    const r = await migrationUpload(requester);
    expect(r.status).toBe(202);
    expect(r.body.data.batch.status).toBe('validated');
    expect((await openItems()).status).toBe(409);
    expect((await bulk([policyRow('LK-GL-2', addDays(s.cutover, -30))], 'go-live')).status).toBe(409);
    expect(await isGoLiveLocked(pool)).toBe(true);
    expect((await lockRequest(requester, { action: 'unlock', reason: 'another', scope: ['opening-items'], hours: 1 })).body.message).toMatch(/^An unlock is in force until/);
  });

  it('relocks by itself after its hours (job golive-relock)', async () => {
    expect((await relock()).relocked).toBe(0);
    await query('UPDATE go_live_lock_requests SET expires_at = now() - interval \'1 minute\' WHERE id = $1', [unlock.id]);
    expect((await relock()).relocked).toBe(1);
    expect(await one('SELECT relocked_at IS NOT NULL AS done FROM go_live_lock_requests WHERE id = $1', [unlock.id])).toEqual({ done: true });
    expect(await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'go_live_lock\' AND action = \'relock\' AND entity_id = $1', [String(unlock.id)])).toEqual({ n: 1 });
    expect((await migrationUpload(requester)).status).toBe(409);
    expect((await requester.api('get', '/data-load/golive')).body.data.unlock).toBeNull();
  });

  it('after migration.unlock_window_days from the lock it needs a steering committee decision reference', async () => {
    await query('UPDATE app_settings SET value = $1::jsonb WHERE key = \'golive.locked_at\'', [JSON.stringify(new Date(Date.now() - 10 * 86400000).toISOString())]);
    clearSettingsCache();
    const r = await lockRequest(requester, { action: 'unlock', reason: 'Bounced legacy cheque', scope: ['opening-items'], hours: 1 });
    expect(r.status).toBe(400);
    expect(r.body.errors[0]).toEqual({ path: 'decisionRef', message: 'The lock is older than 7 days: give the reference of the steering committee decision' });
    const ok = await lockRequest(requester, { action: 'unlock', reason: 'Bounced legacy cheque', scope: ['opening-items'], hours: 1, decisionRef: 'SC-2026-11-14' });
    expect(ok.status).toBe(201);
    expect((await decide(approver, ok.body.data.id, 'withdraw')).status).toBe(403);
    expect((await decide(requester, ok.body.data.id, 'withdraw')).body.data.status).toBe('withdrawn');
    const rej = await lockRequest(requester, { action: 'unlock', reason: 'Bounced legacy cheque', scope: ['opening-items'], hours: 1, decisionRef: 'SC-2026-11-14' });
    expect((await decide(approver, rej.body.data.id, 'reject', {})).status).toBe(400);
    expect((await decide(approver, rej.body.data.id, 'reject', { remarks: 'Book it as a new receivable' })).body.data).toMatchObject({ status: 'rejected', decisionRemarks: 'Book it as a new receivable' });
  });
});

describe('route inventory', () => {
  // every route that writes and whose path or summary speaks of go-live, legacy, opening or migration data, and every
  // route of the load batches: guarded by the lock (the kind it checks) or exempt, with the reason
  const GUARDED = {
    'POST /data-load/batches': 'migration (migration kit)',
    'POST /data-load/batches/:id/validate': 'migration',
    'POST /data-load/batches/:id/resolutions': 'migration',
    'POST /data-load/batches/:id/submit': 'migration',
    'POST /data-load/batches/:id/approve': 'migration',
    'POST /data-load/batches/:id/load': 'migration',
    'POST /data-load/batches/:id/undo-request': 'undo',
    'POST /data-load/batches/:id/undo-approve': 'undo',
    'POST /policies/bulk-upload': 'policies-go-live (mode go-live, and the rows issued before the cutover date)',
    'POST /receipts/opening-items/import': 'opening-items',
    'POST /period-end/opening-balances/validate': 'opening-balances',
    'POST /period-end/opening-balances/import': 'opening-balances',
  };
  const EXEMPT = {
    'POST /data-load/batches/:id/withdraw': 'withdraws a request: loads nothing',
    'POST /data-load/batches/:id/reject': 'a decision that loads nothing',
    'POST /data-load/batches/:id/undo-reject': 'the load stays',
    'POST /data-load/batches/:id/undo-withdraw': 'the load stays',
    'PUT /data-load/golive/cutover-date': 'refused once locked by its own rule',
    'PUT /data-load/golive/settings': 'settings of the workspace, no data',
    'POST /data-load/golive/lock-requests': 'the lock and the unlock themselves',
    'POST /data-load/golive/lock-requests/:id/approve': 'the lock and the unlock themselves',
    'POST /data-load/golive/lock-requests/:id/reject': 'the lock and the unlock themselves',
    'POST /data-load/golive/lock-requests/:id/withdraw': 'the lock and the unlock themselves',
    'POST /data-load/value-maps': 'translation of legacy codes, creates no business record',
    'POST /data-load/value-maps/upload': 'translation of legacy codes, creates no business record',
    'POST /data-load/document-names/check': 'checks file names, loads nothing',
    'POST /access-control/authority-limits': 'a configuration master, also loaded by the configuration workbook',
    'PUT /bank-reconciliation/bank-accounts/:code': 'bank reconciliation set-up of the live book (reconcile-from date and opening statement balance)',
    'POST /fixed-assets/assets': 'an asset registered on screen (its accumulated depreciation at registration), not a migration import',
    'POST /period-end/periods/:period/status': 'period management of the live book',
    'POST /period-end/year-end/:id/close': 'the year-end close carries the balances forward in the live book',
    'POST /period-end/year-end/:id/reverse': 'reverses a year-end close of the live book',
    'POST /quote/calculate-premium-quote': 'premium calculation, writes nothing',
    'POST /data-load/reconciliations': 'reconciles what was loaded, loads nothing',
    'POST /data-load/reconciliations/:id/recompute': 'reconciles what was loaded, loads nothing',
    'PUT /data-load/reconciliations/:id/lines/:lineId': 'legacy figures of the reconciliation, no business record',
    'POST /data-load/reconciliations/:id/legacy': 'legacy figures of the reconciliation, no business record',
    'PUT /data-load/reconciliations/:id/differences/:diffId': 'explanation of a difference, no business record',
    'POST /data-load/reconciliations/:id/differences/:diffId/accept': 'acceptance of a difference, no business record',
    'POST /data-load/reconciliations/:id/signoffs/:slot': 'sign-off of the reconciliation, no business record',
    'PUT /data-load/settings/tieouts': 'settings of the reconciliation, no data',
    'POST /data-load/golive/sap-opening-file': 'sends the opening balances to SAP once, loads nothing into BrokerVerse',
    'POST /data-load/golive/sap-opening-file/approve': 'sends the opening balances to SAP once, loads nothing into BrokerVerse',
    'POST /data-load/golive/sap-opening-file/reject': 'a decision that loads nothing',
    'POST /data-load/golive/sap-opening-file/withdraw': 'withdraws a request: loads nothing',
  };

  it('every import-like route is guarded by the lock or listed as exempt with a reason', () => {
    const found = ROUTES.filter((r) => r.method !== 'GET' && (/go-?live|legacy|opening|migration/i.test(`${r.path} ${r.summary}`) || r.path.startsWith('/data-load/batches')))
      .map((r) => `${r.method} ${r.path}`);
    const unclassified = found.filter((k) => !GUARDED[k] && !EXEMPT[k]);
    expect(unclassified).toEqual([]);
    for (const k of Object.keys(GUARDED)) expect(found, k).toContain(k);
  });
});
