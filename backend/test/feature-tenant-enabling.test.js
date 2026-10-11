/**
 * Enabling of Phase 2 by TISPH (modules/features/tenant.js, migration 0597; decisions FT-D01 and FT-D02): SUPERID
 * requests and a second SUPERID or a platform administrator approves on Master > System Configuration > Features &
 * Releases; the future releases stay with the platform administrator; the requester never approves (but in the
 * 'single' mode of a development environment); the other roles, the System Administrator included, are refused.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, platformAdmins, loginAs } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { decisionPending, featureOf } from '../src/modules/features/catalogue.js';
import { TENANT_ENABLE, assertTenantTiers, tenantPolicy, tenantSettingErrors } from '../src/modules/features/tenant.js';

let app;
let api;
let admins;
let s1;
let s2;
let itAdmin;
let gm;
let sysAdmin;
const PASSWORD = 'Superid#Test2026';
const as = (token) => (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
const body = (extra) => ({ reasonCode: 'FTR-DECISION', releaseRef: 'TISPH-FT-D01', effective: 'immediate', ...extra });
const setSetting = async (key, value) => {
  await query('UPDATE app_settings SET value = $2, updated_at = now() WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};

beforeAll(async () => {
  ({ app, api } = await setup());
  admins = await platformAdmins(app);
  const users = [['sid.one', 'tis-superid'], ['sid.two', 'tis-superid'], ['sid.it', 'tis-it-admin'], ['sid.gm', 'tis-general-manager'], ['sid.admin', 'system-admin']];
  for (const [username, role] of users) {
    const r = await api('post', '/users').send({ username, displayName: username, email: `${username}@tisph.test`, password: PASSWORD, roles: [role] });
    expect(r.status, `${username}: ${JSON.stringify(r.body)}`).toBe(201);
  }
  [s1, s2, itAdmin, gm, sysAdmin] = await Promise.all(users.map(([u]) => loginAs(app, u, PASSWORD).then(as)));
}, 180000);
afterAll(async () => { await pool.end(); });

describe('decisions FT-D01 and FT-D02', () => {
  it('records both as decided by TISPH: Phase 2, no longer pending; the asset master goes with fixed assets', async () => {
    for (const [key, id] of [['fixed-assets', 'FT-D01'], ['sales-dashboard', 'FT-D02']]) {
      const f = featureOf(key);
      expect(f.tier).toBe('PHASE_2');
      expect(f.decision).toMatchObject({ id, decided: { answer: 'Phase 2 (enable with Phase 2)', by: 'TISPH', on: '2026-10-11' } });
      expect(decisionPending(f)).toBe(false);
    }
    expect(featureOf('fixed-assets').requirements).toContain('MOM-S5-AP-ASSET-MASTER');
    // the other decisions stay open
    expect(decisionPending(featureOf('campaigns'))).toBe(true);
    const rows = (await itAdmin('get', '/features/catalogue')).body.data;
    expect(rows.find((r) => r.key === 'fixed-assets')).toMatchObject({ decisionPending: false, status: 'off' });
    expect(rows.find((r) => r.key === 'sales-dashboard').decisionPending).toBe(false);
    expect(rows.find((r) => r.key === 'campaigns').decisionPending).toBe(true);
  });
});

describe('who enables Phase 2 for the tenant', () => {
  it('grants enable:phase2-features to SUPERID with the delivered settings', async () => {
    const holders = (await query(`SELECT r.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE p.code = $1`, [TENANT_ENABLE])).rows.map((r) => r.code);
    expect(holders).toEqual(expect.arrayContaining(['tis-superid']));
    expect(holders).not.toContain('iorta-platform-admin');
    expect(await tenantPolicy()).toMatchObject({ roles: ['tis-superid'], tiers: ['PHASE_2'], approval: 'four-eyes' });
    expect((await s1('get', '/features/enabling')).body.data).toMatchObject({ canEnable: true, tiers: ['PHASE_2'], approval: 'four-eyes' });
    expect((await api('get', '/roles/permissions')).body.data.map((p) => p.code)).toContain(TENANT_ENABLE);
  });

  it('refuses the other roles, the System Administrator (permission without a role of the setting) and the platform administrator on the tenant routes', async () => {
    for (const who of [api, sysAdmin, itAdmin, gm]) {
      if (who !== gm) expect((await who('get', '/features/enabling')).body.data.canEnable).toBe(false);
      const r = await who('post', '/features/changes').send(body({ action: 'enable', features: ['fixed-assets'] }));
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('NOT_TENANT_ENABLER');
      expect((await who('post', '/features/preview').send({ action: 'enable', tier: 'PHASE_2' })).status).toBe(403);
      expect((await who('get', '/features/changes')).status).toBe(403);
    }
    expect((await admins.maker.api('post', '/features/changes').send(body({ action: 'enable', features: ['fixed-assets'] }))).status).toBe(403);
    // SUPERID stays out of the platform screen
    expect((await s1('get', '/platform/features')).status).toBe(403);
    expect((await s1('post', '/platform/features/changes').send(body({ action: 'enable', features: ['fixed-assets'] }))).status).toBe(403);
  });

  it('never touches a future release', async () => {
    const bundle = await s1('post', '/features/changes').send(body({ action: 'enable', tier: 'FUTURE' }));
    expect(bundle.status).toBe(403);
    expect(bundle.body.code).toBe('FEATURE_TIER_NOT_ALLOWED');
    const one = await s1('post', '/features/changes').send(body({ action: 'enable', features: ['campaigns'] }));
    expect(one.body.code).toBe('FEATURE_TIER_NOT_ALLOWED');
    expect((await s1('post', '/features/preview').send({ action: 'enable', features: ['petty-cash'] })).body.code).toBe('FEATURE_TIER_NOT_ALLOWED');
    // a plan that reaches a future release through a dependency or a dependent is refused as a whole
    expect(() => assertTenantTiers([{ key: 'payables', name: 'Accounts payable', tier: 'PHASE_2', tierName: 'Phase 2' },
      { key: 'campaigns', name: 'Marketing campaigns', tier: 'FUTURE', tierName: 'Future release' }], { tiers: ['PHASE_2'] })).toThrow(/Marketing campaigns/);
    expect((await query("SELECT count(*)::int AS n FROM feature_changes WHERE channel = 'tenant'")).rows[0].n).toBe(0);
  });
});

describe('four-eyes enabling by TISPH', () => {
  it('previews the Phase 2 bundle with the same impact as the platform screen', async () => {
    const mine = await s1('post', '/features/preview').send({ action: 'enable', tier: 'PHASE_2' });
    const vendor = await admins.maker.api('post', '/platform/features/preview').send({ action: 'enable', tier: 'PHASE_2' });
    expect(mine.status).toBe(200);
    expect(mine.body.data).toEqual(vendor.body.data);
  });

  it('SUPERID requests, cannot approve its own request, a second SUPERID approves: signed, audited and notified', async () => {
    const bad = await s1('post', '/features/changes').send({ action: 'enable', features: ['fixed-assets'] });
    expect(bad.status).toBe(400);
    const r = await s1('post', '/features/changes').send(body({ action: 'enable', features: ['fixed-assets', 'sales-dashboard'] }));
    expect(r.status).toBe(201);
    expect(r.body.data.change).toMatchObject({ status: 'pending', channel: 'tenant', approval: 'four-eyes' });
    const id = r.body.data.change.id;
    expect((await api('get', '/fixed-assets/assets')).body.code).toBe('FEATURE_NOT_ENABLED');
    // the second SUPERID is told
    const told = (await query(`SELECT u.username FROM notifications n JOIN users u ON u.id = n.user_id WHERE n.entity = 'feature_change' AND n.entity_id = $1`, [String(id)])).rows.map((x) => x.username);
    expect(told).toEqual(['sid.two']);
    const own = await s1('post', `/features/changes/${id}/decision`).send({ decision: 'approve' });
    expect(own.status).toBe(403);
    const ok = await s2('post', `/features/changes/${id}/decision`).send({ decision: 'approve', remarks: 'TISPH decision of 11 October 2026' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.change).toMatchObject({ status: 'applied', decidedByName: 'sid.two' });
    expect(ok.body.data.applied.map((a) => a.key).sort()).toEqual(['fixed-assets', 'sales-dashboard']);
    expect((await api('get', '/fixed-assets/assets')).status).toBe(200);
    expect((await api('get', '/dashboard/sales')).body.code).toBeUndefined();
    const row = (await itAdmin('get', '/features/catalogue')).body.data.find((f) => f.key === 'fixed-assets');
    expect(row).toMatchObject({ status: 'on', enabledBy: 'sid.two', releaseRef: 'TISPH-FT-D01' });
    const ent = (await query("SELECT signature, change_id FROM feature_entitlements WHERE feature_key = 'fixed-assets'")).rows[0];
    expect(ent.signature).toMatch(/^[0-9a-f]{64}$/);
    const trail = (await query("SELECT action, after_data, source FROM audit_log WHERE entity = 'feature' AND entity_id = 'fixed-assets'")).rows;
    expect(trail[0]).toMatchObject({ action: 'enable', after_data: expect.objectContaining({ by: 'tenant', approval: 'four-eyes' }) });
    expect(trail[0].source.name).toBe('Master > System Configuration > Features & Releases');
    expect((await query("SELECT action FROM audit_log WHERE entity = 'feature_change' AND entity_id = $1 ORDER BY id", [String(id)])).rows.map((a) => a.action)).toEqual(['request', 'approve']);
    const mail = (await query("SELECT to_address FROM email_outbox WHERE template = 'feature_change'")).rows.map((m) => m.to_address);
    expect(mail).toEqual(expect.arrayContaining(['sid.it@tisph.test', 'sid.gm@tisph.test']));
  });

  it('a platform administrator approves a request of SUPERID; SUPERID never decides a change of the platform', async () => {
    const r = await s1('post', '/features/changes').send(body({ action: 'enable', features: ['payables'] }));
    expect(r.status).toBe(201);
    const told = (await query(`SELECT count(*)::int AS n FROM notifications WHERE entity = 'feature_change' AND entity_id = $1 AND audience = 'manage:feature-entitlements'`, [String(r.body.data.change.id)])).rows[0].n;
    expect(told).toBe(1);
    const ok = await admins.checker.api('post', `/platform/features/changes/${r.body.data.change.id}/decision`).send({ decision: 'approve' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.change.status).toBe('applied');
    expect((await api('get', '/payables/invoices')).status).toBe(200);

    const vendor = await admins.maker.api('post', '/platform/features/changes').send(body({ action: 'enable', features: ['recurring-journals'] }));
    expect(vendor.status).toBe(201);
    const refusedDecision = await s2('post', `/features/changes/${vendor.body.data.change.id}/decision`).send({ decision: 'approve' });
    expect(refusedDecision.status).toBe(403);
    expect(refusedDecision.body.code).toBe('PLATFORM_CHANGE');
    expect((await s2('post', `/features/changes/${vendor.body.data.change.id}/withdraw`)).body.code).toBe('PLATFORM_CHANGE');
    // the list shows both, with who raised them
    const list = (await s1('get', '/features/changes')).body.data;
    expect(list.find((c) => c.id === vendor.body.data.change.id).channel).toBe('platform');
    expect((await admins.maker.api('post', `/platform/features/changes/${vendor.body.data.change.id}/withdraw`)).status).toBe(200);
  });

  it('rejects with a reason and withdraws; disables with the same rules', async () => {
    const r = await s1('post', '/features/changes').send(body({ action: 'disable', features: ['sales-dashboard'] }));
    expect(r.status).toBe(201);
    expect((await s2('post', `/features/changes/${r.body.data.change.id}/decision`).send({ decision: 'reject' })).status).toBe(400);
    const rej = await s2('post', `/features/changes/${r.body.data.change.id}/decision`).send({ decision: 'reject', reasonCode: 'FTR-REJ-OTHER', note: 'Not now' });
    expect(rej.status).toBe(200);
    expect(rej.body.data.change).toMatchObject({ status: 'rejected', remarks: expect.stringMatching(/Not now/) });
    const w = await s1('post', '/features/changes').send(body({ action: 'disable', features: ['sales-dashboard'] }));
    expect((await s2('post', `/features/changes/${w.body.data.change.id}/withdraw`)).status).toBe(403);
    expect((await s1('post', `/features/changes/${w.body.data.change.id}/withdraw`)).status).toBe(200);
    const d = await s1('post', '/features/changes').send(body({ action: 'disable', features: ['sales-dashboard'] }));
    expect((await s2('post', `/features/changes/${d.body.data.change.id}/decision`).send({ decision: 'approve' })).body.data.applied).toEqual([
      expect.objectContaining({ key: 'sales-dashboard', from: 'on', to: 'off' })]);
    expect((await api('get', '/dashboard/sales')).body.code).toBe('FEATURE_NOT_ENABLED');
  });
});

describe('settings of the enabling by TISPH', () => {
  it('validates the settings: no future tier, never the platform role, a known approval mode', async () => {
    for (const settings of [{ 'features.tenant_enable_tiers': ['PHASE_2', 'FUTURE'] }, { 'features.tenant_enable_roles': ['iorta-platform-admin'] },
      { 'features.tenant_enable_approval': 'nobody' }]) {
      expect((await api('put', '/settings').send({ settings })).status, JSON.stringify(settings)).toBe(400);
    }
    expect(tenantSettingErrors([['features.tenant_enable_tiers', []], ['features.tenant_enable_approval', 'single']])).toEqual([]);
  });

  it("'single' applies the request of SUPERID at once, except on a database marked production", async () => {
    expect((await api('put', '/settings').send({ settings: { 'features.tenant_enable_approval': 'single' } })).status).toBe(200);
    clearSettingsCache();
    const r = await s1('post', '/features/changes').send(body({ action: 'enable', features: ['sales-dashboard'] }));
    expect(r.status).toBe(201);
    expect(r.body.data.change).toMatchObject({ status: 'applied', approval: 'single', decidedByName: 'sid.one' });
    expect((await api('get', '/dashboard/sales')).body.code).toBeUndefined();
    expect((await query("SELECT action FROM audit_log WHERE entity = 'feature_change' AND entity_id = $1 ORDER BY id", [String(r.body.data.change.id)])).rows.map((a) => a.action)).toEqual(['request', 'approve']);

    const env = (await query("SELECT value FROM app_settings WHERE key = 'system.environment'")).rows[0].value;
    await setSetting('system.environment', 'production');
    try {
      expect((await s1('get', '/features/enabling')).body.data).toMatchObject({ approval: 'four-eyes', configuredApproval: 'single' });
      const p = await s1('post', '/features/changes').send(body({ action: 'disable', features: ['sales-dashboard'] }));
      expect(p.body.data.change).toMatchObject({ status: 'pending', approval: 'four-eyes' });
      expect((await s1('post', `/features/changes/${p.body.data.change.id}/decision`).send({ decision: 'approve' })).status).toBe(403);
      await s1('post', `/features/changes/${p.body.data.change.id}/withdraw`);
    } finally {
      await setSetting('system.environment', env);
      await setSetting('features.tenant_enable_approval', 'four-eyes');
    }
  });

  it('follows the roles and tiers of the settings', async () => {
    await setSetting('features.tenant_enable_roles', ['tis-it-admin']);
    try {
      // SUPERID is no longer an enabler; IT AppSupport is named but does not hold the permission
      expect((await s1('post', '/features/changes').send(body({ action: 'disable', features: ['sales-dashboard'] }))).body.code).toBe('NOT_TENANT_ENABLER');
      expect((await itAdmin('post', '/features/changes').send(body({ action: 'disable', features: ['sales-dashboard'] }))).body.code).toBe('NOT_TENANT_ENABLER');
    } finally {
      await setSetting('features.tenant_enable_roles', ['tis-superid']);
    }
    await setSetting('features.tenant_enable_tiers', []);
    try {
      expect((await s1('get', '/features/enabling')).body.data.canEnable).toBe(false);
      expect((await s1('post', '/features/changes').send(body({ action: 'disable', features: ['sales-dashboard'] }))).body.code).toBe('TENANT_ENABLING_OFF');
    } finally {
      await setSetting('features.tenant_enable_tiers', ['PHASE_2']);
    }
    expect((await s1('get', '/features/enabling')).body.data.canEnable).toBe(true);
  });
});
