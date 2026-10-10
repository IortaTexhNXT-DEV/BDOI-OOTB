/**
 * Feature entitlements (modules/features): the catalogue covers every menu entry, Phase 2 and future releases are off
 * in a delivered environment and refused by the API, only the iorta TechNXT platform administrator enables them with
 * maker-checker, a disable with records leaves the feature read-only, and a tampered entitlement counts as off.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, platformAdmins, enableFeatures, loginAs } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { FEATURES, TIERS, alwaysOn, catalogueProblems, featureOf } from '../src/modules/features/catalogue.js';
import { clearFeatureCache, signRow } from '../src/modules/features/service.js';
import { runJob } from '../src/jobs/scheduler.js';
import { loadMenu } from '../src/tools/manual-role-facts.js';
import { MANAGE_FEATURES, PLATFORM_ROLE } from '../src/lib/platform.js';

let app;
let api;
let admins;
let itAdmin;
let gm;
const as = (token) => (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ({ app, api } = await setup());
  admins = await platformAdmins(app);
  for (const [username, role] of [['fe.it', 'tis-it-admin'], ['fe.gm', 'tis-general-manager']]) {
    const r = await api('post', '/users').send({ username, displayName: username, email: `${username}@tisph.test`, password: 'Feature#Test2026', roles: [role] });
    expect(r.status).toBe(201);
  }
  itAdmin = as(await loginAs(app, 'fe.it', 'Feature#Test2026'));
  gm = as(await loginAs(app, 'fe.gm', 'Feature#Test2026'));
}, 180000);
afterAll(async () => { await pool.end(); });

describe('feature catalogue', () => {
  it('is consistent: unique keys and menus, known tiers and dependencies, no cycle', () => {
    expect(catalogueProblems()).toEqual([]);
    expect(Object.keys(TIERS).sort()).toEqual(['FUTURE', 'PHASE_1', 'PHASE_2', 'PLATFORM']);
  });

  it('maps every menu entry of the front end to exactly one feature', async () => {
    const menu = await loadMenu();
    const owners = new Map();
    for (const f of FEATURES) for (const m of f.controls.menus) owners.set(m, [...(owners.get(m) || []), f.key]);
    const leaves = menu.flattenLeaves(menu.menuList).filter((l) => l.item.path).map((l) => [...l.ancestors.map((a) => a.name), l.item.name].join(' > '));
    const unmapped = leaves.filter((name) => !owners.has(name));
    const message = `Menu entries without a feature: ${unmapped.join('; ')}. Add each one to "menus" of the feature of its module in `
      + 'backend/src/modules/features/catalogue.js (a new TISPH screen goes to a PHASE_1 feature; see docs/developer-guide/features.md)';
    expect(unmapped, message).toEqual([]);
    expect([...owners].filter(([, keys]) => keys.length > 1)).toEqual([]);
    const stale = [...owners.keys()].filter((name) => !leaves.includes(name));
    expect(stale, `Feature menus that are no menu entry: ${stale.join('; ')}`).toEqual([]);
    expect(leaves.length).toBeGreaterThanOrEqual(207);
  });

  it('classifies the register: Phase 2 items, future releases, platform functions, decisions to take', () => {
    const tier = (key) => featureOf(key).tier;
    expect(['payables', 'fixed-assets', 'recurring-journals', 'insurer-api', 'sales-dashboard', 'legacy-migration'].map(tier)).toEqual(Array(6).fill('PHASE_2'));
    expect(['campaigns', 'petty-cash', 'insurer-overrides', 'payment-gateways', 'package-bundles', 'sms-messaging', 'coinsurance', 'win-back', 'bir-eis'].map(tier))
      .toEqual(Array(9).fill('FUTURE'));
    expect(['user-management', 'audit-trail', 'system-configuration', 'features-releases'].map(tier)).toEqual(Array(4).fill('PLATFORM'));
    expect(['suppliers', 'quotations', 'receipts', 'remittance', 'period-end'].map(tier)).toEqual(Array(5).fill('PHASE_1'));
    expect(featureOf('fixed-assets').decision.question).toMatch(/asset master/);
    expect(featureOf('sales-dashboard').decision.question).toMatch(/RPT-02/);
    expect(featureOf('payables').dependsOn).toEqual(['suppliers']);
  });
});

describe('delivered edition', () => {
  it('runs Phase 1 and platform functions; Phase 2 and future releases are off', async () => {
    const r = await itAdmin('get', '/features/catalogue');
    expect(r.status).toBe(200);
    const byKey = new Map(r.body.data.map((f) => [f.key, f]));
    for (const f of FEATURES) expect(byKey.get(f.key).status, f.key).toBe(alwaysOn(f) ? 'on' : 'off');
    expect(byKey.get('payables')).toMatchObject({ tier: 'PHASE_2', tierName: 'Phase 2', statusName: 'Not enabled', enabledBy: null, requirements: ['TIS-BRD-NIA-03', 'PBSM-M17v4-NIA'] });
    // the read-only view does not carry what a feature controls
    expect(byKey.get('payables').controls).toBeUndefined();
    expect((await gm('get', '/features/catalogue')).status).toBe(200);
  });

  it('refuses the API of a feature that is off with 403 FEATURE_NOT_ENABLED, whoever asks', async () => {
    for (const path of ['/payables/invoices', '/fixed-assets/assets', '/petty-cash/funds', '/insurer-overrides/agreements', '/campaigns', '/period-end/recurring-journals',
      '/bir/eis/status', '/dashboard/sales', '/renewals/at-risk', '/credit-control/clients', '/reports/coinsurance-register']) {
      const r = await api('get', path);
      expect(r.status, path).toBe(403);
      expect(r.body.code, path).toBe('FEATURE_NOT_ENABLED');
    }
    expect((await request(app).post('/api/public/integrations/inbound/CTPL_AUTH').send({})).body.code).toBe('FEATURE_NOT_ENABLED');
    // Phase 1 functions and their neighbours stay open
    for (const path of ['/receipts', '/credit-control/instalment-plans', '/remittance/remittances', '/reports']) {
      expect((await api('get', path)).body.code, path).toBeUndefined();
    }
    const cat = await api('get', '/reports');
    expect(cat.body.data.map((x) => x.code)).not.toContain('coinsurance-register');
  });

  it('keeps jobs, connectors, settings and co-insurance of features that are off out of use', async () => {
    const job = (await query("SELECT * FROM scheduled_jobs WHERE code = 'campaign-dispatch'")).rows[0];
    expect((await runJob(job, 'test')).status).toBe('skipped');
    expect((await api('post', '/schedules/campaign-dispatch/run')).body.code).toBe('FEATURE_NOT_ENABLED');
    expect((await api('get', '/schedules')).body.data.map((j) => j.code)).not.toContain('recurring-journals');
    expect((await api('put', '/integrations/connectors/CTPL_AUTH').send({ enabled: true })).body.code).toBe('FEATURE_NOT_ENABLED');
    expect((await api('get', '/integrations/connectors')).body.data.map((c) => c.code)).toEqual(['BANK_FILES']);
    expect((await api('put', '/settings').send({ settings: { 'eis.enabled': true } })).body.code).toBe('FEATURE_NOT_ENABLED');
    const { normaliseParticipants } = await import('../src/modules/placement/participants.js');
    const ins = (await query('SELECT id FROM insurance_companies ORDER BY id LIMIT 2')).rows.map((r) => r.id);
    await expect(normaliseParticipants([{ insuranceCompanyId: ins[0], sharePercent: 60, isLead: true }, { insuranceCompanyId: ins[1], sharePercent: 40 }]))
      .rejects.toMatchObject({ reason: 'FEATURE_NOT_ENABLED' });
    await expect(normaliseParticipants([{ insuranceCompanyId: ins[0] }])).resolves.toHaveLength(1);
  });
});

describe('who enables', () => {
  it('only the platform administrator holds manage:feature-entitlements; the tenant can never grant it', async () => {
    const holders = (await query(`SELECT r.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = $1`, [MANAGE_FEATURES])).rows.map((r) => r.code);
    expect(holders).toEqual([PLATFORM_ROLE]);
    // the administrator of the tenant (full access elsewhere) and the TISPH roles are refused
    for (const who of [api, itAdmin, gm]) {
      expect((await who('get', '/platform/features')).status).toBe(403);
      expect((await who('post', '/platform/features/changes').send({ action: 'enable', features: ['payables'] })).status).toBe(403);
    }
    expect((await api('get', '/roles/permissions')).body.data.map((p) => p.code)).not.toContain(MANAGE_FEATURES);
    expect((await api('get', '/roles')).body.data.map((r) => r.code)).not.toContain(PLATFORM_ROLE);
    expect((await api('post', '/roles').send({ code: 'feature-desk', name: 'Feature desk', permissions: ['read:profile', MANAGE_FEATURES] })).status).toBe(403);
    expect((await api('put', '/roles/tis-it-admin').send({ permissions: ['read:profile', MANAGE_FEATURES] })).status).toBe(403);
    const change = await api('post', '/access-control/role-access/check').send({ role: 'tis-it-admin', grant: [MANAGE_FEATURES], revoke: [] });
    expect(change.status).toBe(400);
    expect((await api('put', '/roles/iorta-platform-admin').send({ name: 'Renamed' })).status).toBe(403);
    expect((await api('post', '/users').send({ username: 'fe.vendor', displayName: 'Vendor', password: 'Feature#Test2026', roles: [PLATFORM_ROLE] })).status).toBe(403);
  });

  it('protects the platform accounts from the tenant and keeps them out of business data', async () => {
    expect((await api('post', `/users/${admins.maker.id}/reset-password`).send({})).status).toBe(403);
    expect((await api('patch', `/users/${admins.maker.id}/status`).send({ status: 'inactive' })).status).toBe(403);
    expect((await api('post', `/users/${admins.maker.id}/2fa/reset`)).status).toBe(403);
    for (const path of ['/clients', '/policies', '/receipts', '/users', '/reports']) expect((await admins.maker.api('get', path)).status, path).toBe(403);
    expect((await admins.maker.api('get', '/features/catalogue')).status).toBe(200);
    // two-factor authentication is always required of the platform administrator
    const enrol = await request(app).post('/api/auth/login').send({ username: 'platform.maker@iorta.test', password: 'Platform#Maker2026' });
    expect(enrol.body.twoFactorRequired).toBe(true);
  });
});

describe('enabling with maker-checker', () => {
  it('previews the impact: dependencies, menus, roles that gain access, jobs, connectors and settings', async () => {
    const p = await admins.maker.api('post', '/platform/features/preview').send({ action: 'enable', features: ['comparison-reports'] });
    expect(p.status).toBe(200);
    expect(p.body.data.features.map((f) => [f.key, f.reason])).toEqual([['comparison-reports', 'requested'], ['rfq-multi-insurer', 'dependency']]);
    expect(p.body.data.menus).toEqual(['Operations > Sales & Marketing > Comparison Reports']);
    expect(p.body.data.roles.map((r) => r.code)).toContain('tis-sales-officer');
    const bundle = await admins.maker.api('post', '/platform/features/preview').send({ action: 'enable', tier: 'PHASE_2' });
    expect(bundle.body.data.features.map((f) => f.key).sort()).toEqual(FEATURES.filter((f) => f.tier === 'PHASE_2').map((f) => f.key).sort());
    expect(bundle.body.data.jobs.map((j) => j.code).sort()).toEqual(['accrual-reversal', 'recurring-journals']);
    expect(bundle.body.data.connectors.map((c) => c.code)).toEqual(['INSURER_API']);
    expect(bundle.body.data.menus).toContain('Accounts > Payables > Supplier Invoices');
    const ctpl = await admins.maker.api('post', '/platform/features/preview').send({ action: 'enable', features: ['ctpl-authentication'] });
    expect(ctpl.body.data.settings.map((s) => s.key)).toContain('ctpl.register_on_issue');
  });

  it('asks for a reason, a reference and the effective date; the requester never approves', async () => {
    const bad = await admins.maker.api('post', '/platform/features/changes').send({ action: 'enable', tier: 'PHASE_2' });
    expect(bad.status).toBe(400);
    expect((await admins.maker.api('post', '/platform/features/changes').send({ action: 'enable', tier: 'PHASE_2', reasonCode: 'FTR-CONTRACT' })).body.errors[0].path).toBe('releaseRef');
    expect((await admins.maker.api('post', '/platform/features/changes').send({ action: 'enable', features: ['quotations'], reasonCode: 'FTR-CONTRACT', releaseRef: 'X' })).status).toBe(400);
    const r = await admins.maker.api('post', '/platform/features/changes').send({ action: 'enable', tier: 'PHASE_2', reasonCode: 'FTR-CONTRACT', releaseRef: 'CR-2027-004', effective: 'immediate' });
    expect(r.status).toBe(201);
    const id = r.body.data.change.id;
    expect(r.body.data.change).toMatchObject({ status: 'pending', ref: `FCR-${String(id).padStart(5, '0')}` });
    // nothing changes before the approval
    expect((await api('get', '/payables/invoices')).body.code).toBe('FEATURE_NOT_ENABLED');
    expect((await admins.maker.api('post', `/platform/features/changes/${id}/decision`).send({ decision: 'approve' })).status).toBe(403);
    expect((await admins.checker.api('post', `/platform/features/changes/${id}/decision`).send({ decision: 'reject' })).status).toBe(400);
    const ok = await admins.checker.api('post', `/platform/features/changes/${id}/decision`).send({ decision: 'approve', remarks: 'Signed CR-2027-004' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.change.status).toBe('applied');
    expect(ok.body.data.applied.map((a) => a.key)).toContain('payables');
    expect((await api('get', '/payables/invoices')).status).toBe(200);
    expect((await api('get', '/fixed-assets/assets')).status).toBe(200);
    const row = (await itAdmin('get', '/features/catalogue')).body.data.find((f) => f.key === 'payables');
    expect(row).toMatchObject({ status: 'on', enabledBy: 'iorta TechNXT', releaseRef: 'CR-2027-004' });
    const trail = (await query("SELECT action FROM audit_log WHERE entity = 'feature' AND entity_id = 'payables'")).rows.map((a) => a.action);
    expect(trail).toContain('enable');
    const mail = (await query("SELECT to_address FROM email_outbox WHERE template = 'feature_change'")).rows.map((m) => m.to_address);
    expect(mail).toEqual(expect.arrayContaining(['fe.it@tisph.test', 'fe.gm@tisph.test']));
    expect((await api('get', '/schedules')).body.data.map((j) => j.code)).toContain('recurring-journals');
  });

  it('applies a scheduled change on its date only', async () => {
    const when = new Date(Date.now() + 3600 * 1000).toISOString();
    const r = await admins.maker.api('post', '/platform/features/changes').send({ action: 'enable', features: ['product-analytics'], reasonCode: 'FTR-CHANGE', releaseRef: 'CR-2027-005', effective: 'scheduled', effectiveAt: when });
    expect(r.status).toBe(201);
    const d = await admins.checker.api('post', `/platform/features/changes/${r.body.data.change.id}/decision`).send({ decision: 'approve' });
    expect(d.body.data.change.status).toBe('scheduled');
    expect((await api('get', '/product-configurator/analytics')).body.code).toBe('FEATURE_NOT_ENABLED');
    await query("UPDATE feature_changes SET effective_at = now() - interval '1 minute' WHERE id = $1", [r.body.data.change.id]);
    clearFeatureCache();
    expect((await api('get', '/product-configurator/analytics')).body.code).toBeUndefined();
    expect((await query('SELECT status FROM feature_changes WHERE id = $1', [r.body.data.change.id])).rows[0].status).toBe('applied');
  });
});

describe('disabling', () => {
  it('leaves a feature with records read-only (view and export) and turns one without records off', async () => {
    await enableFeatures(app, ['win-back', 'product-analytics']);
    const p = await admins.maker.api('post', '/platform/features/preview').send({ action: 'disable', features: ['win-back', 'product-analytics'] });
    const to = Object.fromEntries(p.body.data.features.map((f) => [f.key, f.to]));
    expect(to).toEqual({ 'win-back': 'read-only', 'product-analytics': 'off' });
    expect(p.body.data.readOnly.map((f) => f.key)).toEqual(['win-back']);
    const r = await admins.maker.api('post', '/platform/features/changes').send({ action: 'disable', features: ['win-back', 'product-analytics'], reasonCode: 'FTR-WITHDRAWN', releaseRef: 'CR-2027-006' });
    await admins.checker.api('post', `/platform/features/changes/${r.body.data.change.id}/decision`).send({ decision: 'approve' });
    expect((await api('get', '/renewals/campaigns')).status).toBe(200);
    const write = await api('post', '/renewals/campaigns').send({ campaignName: 'Q1 Win-back', startDate: '2027-01-01', endDate: '2027-03-31' });
    expect(write.status).toBe(403);
    expect(write.body.code).toBe('FEATURE_READ_ONLY');
    expect((await api('get', '/product-configurator/analytics')).body.code).toBe('FEATURE_NOT_ENABLED');
    const state = (await api('get', '/features/state')).body.data;
    expect(state.find((f) => f.key === 'win-back')).toMatchObject({ status: 'read-only', menus: [] });
  });

  it('disables the features that depend on the one disabled', async () => {
    await enableFeatures(app, ['comparison-reports']);
    const p = await admins.maker.api('post', '/platform/features/preview').send({ action: 'disable', features: ['rfq-multi-insurer'] });
    expect(p.body.data.features.map((f) => [f.key, f.reason])).toEqual([['rfq-multi-insurer', 'requested'], ['comparison-reports', 'dependent']]);
  });
});

describe('tamper resistance and promotion', () => {
  it('treats an entitlement without a valid signature as off and records an alert', async () => {
    const row = { feature_key: 'petty-cash', status: 'enabled', effective_from: new Date(), change_id: 999 };
    await query(`INSERT INTO feature_entitlements(feature_key, status, effective_from, change_id, signature) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (feature_key) DO UPDATE SET status = EXCLUDED.status, signature = EXCLUDED.signature`, [row.feature_key, row.status, row.effective_from, row.change_id, signRow(row, 'another-key')]);
    clearFeatureCache();
    expect((await api('get', '/petty-cash/funds')).body.code).toBe('FEATURE_NOT_ENABLED');
    const alert = (await query("SELECT action FROM audit_log WHERE entity = 'feature' AND entity_id = 'petty-cash'")).rows.map((a) => a.action);
    expect(alert).toEqual(['signature-invalid']);
    const shown = (await admins.maker.api('get', '/platform/features')).body.data.find((f) => f.key === 'petty-cash');
    expect(shown).toMatchObject({ status: 'off', tampered: true });
    // a row edited after its approval loses its signature too
    await query("UPDATE feature_entitlements SET effective_from = effective_from - interval '1 day' WHERE feature_key = 'payables'");
    clearFeatureCache();
    expect((await api('get', '/payables/invoices')).body.code).toBe('FEATURE_NOT_ENABLED');
  });

  it('exports the state for promotion and raises change requests from an export, still waiting for approval', async () => {
    const exported = await admins.maker.api('get', '/platform/features/export');
    expect(exported.status).toBe(200);
    expect(exported.body.features.find((f) => f.key === 'fixed-assets').status).toBe('on');
    const file = { environment: 'uat', features: [{ key: 'insurer-overrides', status: 'on' }, { key: 'fixed-assets', status: 'off' }] };
    const r = await admins.maker.api('post', '/platform/features/promote').send({ file, reasonCode: 'FTR-PROMOTION', releaseRef: 'UAT-SIGNOFF-01' });
    expect(r.status).toBe(200);
    expect(r.body.data.changes.map((c) => [c.action, c.status, c.source, c.sourceEnvironment])).toEqual([['enable', 'pending', 'promotion', 'uat'], ['disable', 'pending', 'promotion', 'uat']]);
    expect((await api('get', '/insurer-overrides/agreements')).body.code).toBe('FEATURE_NOT_ENABLED');
    // the configuration workbook shows the entitlements but never loads them
    const kit = await api('get', '/data-load/kits');
    expect(kit.body.data.kits.find((k) => k.kit === 'configuration').sheets.map((sh) => sh.key)).toContain('features');
  });
});
