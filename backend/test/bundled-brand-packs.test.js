/**
 * Bundled brand packs (Master > System Settings > Theme and Branding > Brand packs > Bundled packs): the Toyota
 * Insurance Services pack ships with the product but is never on by default; a System Administrator enables it after
 * acknowledging the client engagement whose contract covers the marks, the enablement is recorded and audited, and Back to default returns
 * the environment to the iorta TechNXT branding. A deployment for the client may name the pack in BRAND_PACK: the API
 * enables it once at start-up, and an administrator's later Back to default stands.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearLetterheadCache, getLetterhead } from '../src/lib/letterhead.js';
import { DEFAULT_THEME } from '../src/modules/branding/presets.js';
import { ACKNOWLEDGEMENT_TEXT, BUNDLED_DIR, DEPLOYMENT_NOTE, bundledPackIds, enableDeploymentPack, loadBundledPack } from '../src/modules/branding/bundled.js';
import { buildConfig } from '../src/config.js';
import { buildBrandPack } from '../scripts/build-brand-pack.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_PACKS = path.join(ROOT, '..', 'docs', 'package', '04_Onboarding_and_Go_Live', 'Brand_Packs');
const TIS = 'toyota-insurance-services';
const binary = (r) => r.buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });

let ctx;
let salesToken;
beforeAll(async () => {
  ctx = await setup();
  const r = await ctx.api('post', '/users').send({ username: 'bp.sales', password: 'Welcome@123', displayName: 'Sales person', email: 'bp.sales@example.ph', roles: ['sales'] });
  expect(r.status).toBe(201);
  salesToken = await loginAs(ctx.app, 'bp.sales', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });

describe('bundled brand pack files', () => {
  it('ships the Toyota Insurance Services pack with the product, identical to the documentation copy, with a manifest', () => {
    expect(bundledPackIds()).toContain(TIS);
    const docsDir = path.join(DOCS_PACKS, TIS);
    const bundledDir = path.join(BUNDLED_DIR, TIS);
    const docFiles = fs.readdirSync(docsDir).sort();
    expect(docFiles).toEqual(expect.arrayContaining(['theme.json', 'logo.png', 'README.md', `${TIS}.brandpack.zip`]));
    for (const f of docFiles) {
      expect(fs.existsSync(path.join(bundledDir, f)), `${f} missing from backend/assets/brand-packs/${TIS}`).toBe(true);
      expect(fs.readFileSync(path.join(bundledDir, f)).equals(fs.readFileSync(path.join(docsDir, f))), `${f} differs between docs and backend/assets`).toBe(true);
    }
    const { manifest, files, bundled } = loadBundledPack(TIS);
    expect(bundled).toMatchObject({ id: TIS, name: 'Toyota Insurance Services', requiresAcknowledgement: true, permissionBasis: expect.stringContaining('Contract between iorta TechNXT'), version: expect.any(String) });
    expect(bundled.trademarkOwner).toMatch(/toyota/i);
    expect(bundled.description.length).toBeGreaterThan(20);
    expect(manifest.format).toBe('brokerverse-brand-pack');
    expect([...files.keys()]).toEqual(['logo.png']);
  });

  it('keeps the built zip in step with the folder (build-brand-pack.js is deterministic)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-'));
    for (const f of ['theme.json', 'logo.png', 'README.md']) fs.copyFileSync(path.join(BUNDLED_DIR, TIS, f), path.join(tmp, f));
    const { out } = buildBrandPack(tmp);
    expect(fs.readFileSync(out).equals(fs.readFileSync(path.join(BUNDLED_DIR, TIS, `${TIS}.brandpack.zip`)))).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('bundled brand packs on the screen', () => {
  it('a fresh database runs the iorta TechNXT default: no pack is enabled', async () => {
    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    expect(pub.theme.preset).toBe('iorta-technxt');
    expect(pub.theme.name).toBe(DEFAULT_THEME.name);
    expect(pub.systemName).toBe('BrokerVerse');
    expect(pub.logoUrl).toBe('/bdoi/iorta-technxt.png');
    expect(Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n)).toBe(0);
    const list = (await ctx.api('get', '/branding/packs/bundled')).body.data;
    expect(list.defaultInForce).toBe(true);
    expect(list.current).toBeNull();
    expect(list.acknowledgementText).toBe(ACKNOWLEDGEMENT_TEXT);
    const tis = list.packs.find((p) => p.id === TIS);
    expect(tis).toMatchObject({ status: 'available', enablement: null, requiresAcknowledgement: true, systemName: 'Toyota Insurance Services' });
    expect(tis.preview).toMatchObject({ primary: '#1a1a1a', accent: '#eb0a1e', headerBg: '#ffffff' });
    expect(tis.theme.colors.primary).toBe('#1a1a1a');
    expect(tis.assets).toEqual(['logo', 'documentLogo']);
    expect(list.history).toEqual([]);
    // settings permission: a sales user sees nothing and enables nothing
    expect((await request(ctx.app).get('/api/branding/packs/bundled').set('Authorization', `Bearer ${salesToken}`)).status).toBe(403);
    expect((await request(ctx.app).post(`/api/branding/packs/bundled/${TIS}/enable`).set('Authorization', `Bearer ${salesToken}`).send({ acknowledgedPermission: true })).status).toBe(403);
    expect((await request(ctx.app).post('/api/branding/packs/reset-default').set('Authorization', `Bearer ${salesToken}`).send({})).status).toBe(403);
  });

  it('checks a pack without applying it, and refuses to enable it without the acknowledgement', async () => {
    const check = await ctx.api('post', `/branding/packs/bundled/${TIS}/check`).send({});
    expect(check.status).toBe(200);
    expect(check.body.data).toMatchObject({ dryRun: true, name: 'Toyota Insurance Services', warnings: [], assets: ['logo', 'documentLogo'], pack: { id: TIS } });
    expect((await ctx.api('post', '/branding/packs/bundled/no-such-pack/check').send({})).status).toBe(404);
    expect((await ctx.api('post', '/branding/packs/bundled/no-such-pack/enable').send({ acknowledgedPermission: true })).status).toBe(404);

    const noBody = await ctx.api('post', `/branding/packs/bundled/${TIS}/enable`).send({});
    expect(noBody.status).toBe(400);
    expect(noBody.body.errors[0].path).toBe('acknowledgedPermission');
    expect((await ctx.api('post', `/branding/packs/bundled/${TIS}/enable`).send({ acknowledgedPermission: false })).status).toBe(400);
    expect((await ctx.api('post', `/branding/packs/bundled/${TIS}/enable`).send({ acknowledgedPermission: 'true' })).status).toBe(400);
    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    expect(pub.theme.preset).toBe('iorta-technxt');
    expect(pub.systemName).toBe('BrokerVerse');
    expect(Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n)).toBe(0);
    expect(await one("SELECT id FROM audit_log WHERE entity = 'branding' AND action = 'enable-pack'")).toBeNull();
  });

  it('enables the pack with the acknowledgement, records who and when, audits it, and goes back to default', async () => {
    await ctx.api('put', '/branding/theme').send({ theme: DEFAULT_THEME, systemName: 'Acme Insurance Brokers' });
    const r = await ctx.api('post', `/branding/packs/bundled/${TIS}/enable`).send({ acknowledgedPermission: true });
    expect(r.status).toBe(200);
    expect(r.body.data.applied).toEqual(expect.arrayContaining(['theme', 'logo', 'documentLogo', 'systemName']));
    expect(r.body.data.enablement).toMatchObject({ packId: TIS, packName: 'Toyota Insurance Services', status: 'enabled', acknowledgedPermission: true, acknowledgementText: ACKNOWLEDGEMENT_TEXT, enabledBy: 'BrokerVerse', applied: expect.arrayContaining(['theme']) });
    expect(r.body.data.enablement.enabledAt).toBeTruthy();
    expect(r.body.data.enablement.enabledByName).toBeTruthy();

    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    expect(pub.theme.colors).toMatchObject({ primary: '#1a1a1a', accent: '#eb0a1e' });
    expect(pub.systemName).toBe('Toyota Insurance Services');
    const logo = new URL(pub.logoUrl);
    const img = await binary(request(ctx.app).get(`${logo.pathname}${logo.search}`));
    const tisLogo = fs.readFileSync(path.join(BUNDLED_DIR, TIS, 'logo.png'));
    expect(img.body.equals(tisLogo)).toBe(true);
    clearLetterheadCache();
    expect((await getLetterhead()).logo.buffer.equals(tisLogo)).toBe(true);

    const list = (await ctx.api('get', '/branding/packs/bundled')).body.data;
    expect(list.defaultInForce).toBe(false);
    expect(list.current.packId).toBe(TIS);
    const tis = list.packs.find((p) => p.id === TIS);
    expect(tis.status).toBe('enabled');
    expect(tis.enablement).toMatchObject({ enabledBy: 'BrokerVerse', acknowledgedPermission: true });
    expect(list.history).toHaveLength(1);
    const audit = await one("SELECT * FROM audit_log WHERE entity = 'branding' AND action = 'enable-pack' ORDER BY id DESC LIMIT 1");
    expect(audit.entity_id).toBe(`bundled-pack:${TIS}`);
    expect(audit.after_data).toMatchObject({ pack: TIS, acknowledgedPermission: true, acknowledgementText: ACKNOWLEDGEMENT_TEXT });
    expect(audit.username).toBe('BrokerVerse');
    const row = await one('SELECT * FROM brand_pack_enablements ORDER BY id DESC LIMIT 1');
    expect(row).toMatchObject({ pack_id: TIS, acknowledged_permission: true, status: 'enabled', enabled_by: 'BrokerVerse' });
    expect(row.previous).toMatchObject({ systemName: 'Acme Insurance Brokers' });
    // the row cannot exist without the acknowledgement (database rule)
    await expect(query("INSERT INTO brand_pack_enablements(pack_id, pack_name, acknowledged_permission, acknowledgement_text) VALUES ('x', 'X', false, 'no')")).rejects.toThrow();

    // enabling again replaces the enablement in force (one row in force at a time)
    const again = await ctx.api('post', `/branding/packs/bundled/${TIS}/enable`).send({ acknowledgedPermission: true, applySystemName: false });
    expect(again.status).toBe(200);
    expect(Number((await one("SELECT count(*)::int AS n FROM brand_pack_enablements WHERE status = 'enabled'")).n)).toBe(1);
    expect((await one("SELECT status FROM brand_pack_enablements WHERE id = $1", [row.id])).status).toBe('replaced');

    // back to default: the iorta TechNXT theme, the default logo, the application name and print logo as before
    const reset = await ctx.api('post', '/branding/packs/reset-default').send({});
    expect(reset.status).toBe(200);
    expect(reset.body.data.restored).toEqual(expect.arrayContaining(['theme', 'logo', 'favicon', 'systemName', 'documentLogo']));
    expect(reset.body.data.enablement.packId).toBe(TIS);
    expect(reset.body.data.theme.preset).toBe('iorta-technxt');
    const after = (await request(ctx.app).get('/api/branding')).body.data;
    expect(after.theme.preset).toBe('iorta-technxt');
    expect(after.theme.colors.primary).toBe(DEFAULT_THEME.colors.primary);
    expect(after.logoUrl).toBe('/bdoi/iorta-technxt.png');
    expect(after.systemName).toBe('Acme Insurance Brokers');
    clearLetterheadCache();
    expect((await getLetterhead()).logo?.buffer?.equals(tisLogo) || false).toBe(false);
    const list2 = (await ctx.api('get', '/branding/packs/bundled')).body.data;
    expect(list2.defaultInForce).toBe(true);
    expect(list2.current).toBeNull();
    expect(list2.packs.find((p) => p.id === TIS).status).toBe('available');
    expect(list2.history.map((h) => h.status)).toEqual(['reverted', 'replaced']);
    expect(list2.history[0].revertedBy).toBe('BrokerVerse');
    const resetAudit = await one("SELECT * FROM audit_log WHERE entity = 'branding' AND action = 'reset-default' ORDER BY id DESC LIMIT 1");
    expect(resetAudit.entity_id).toBe(`bundled-pack:${TIS}`);

    // back to default with nothing enabled still works (a theme saved on screen goes back to the default)
    const plain = await ctx.api('post', '/branding/packs/reset-default').send({});
    expect(plain.status).toBe(200);
    expect(plain.body.data.enablement).toBeNull();
    expect(plain.body.data.restored).toEqual(['theme', 'logo', 'favicon']);
  });
});

describe('brand pack named by the deployment (BRAND_PACK)', () => {
  const logger = () => ({ info: vi.fn(), warn: vi.fn() });

  it('reads BRAND_PACK from the environment, empty when not set', () => {
    expect(buildConfig({}).brandPack).toBe('');
    expect(buildConfig({ BRAND_PACK: ' toyota-insurance-services ' }).brandPack).toBe(TIS);
  });

  it('warns about a pack that is not shipped and changes nothing', async () => {
    const log = logger();
    const before = Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n);
    expect(await enableDeploymentPack('acme-brokers', { log })).toMatchObject({ status: 'unknown', packId: 'acme-brokers' });
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toMatch(/BRAND_PACK=acme-brokers is not a bundled brand pack/);
    expect(log.info).not.toHaveBeenCalled();
    expect(Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n)).toBe(before);
    expect(await enableDeploymentPack('', { log })).toMatchObject({ status: 'skipped' });
  });

  it('enables the pack once at start-up, recorded against "system" with the deployment as the source, then respects Back to default', async () => {
    await ctx.api('post', '/branding/packs/reset-default').send({});
    await query('DELETE FROM brand_pack_enablements');
    const log = logger();
    const first = await enableDeploymentPack(TIS, { log });
    expect(first).toMatchObject({ status: 'enabled', packId: TIS });
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls[0][0]).toMatch(/Brand pack Toyota Insurance Services enabled from BRAND_PACK=toyota-insurance-services/);
    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    expect(pub.theme.colors).toMatchObject({ primary: '#1a1a1a', accent: '#eb0a1e' });
    expect(pub.systemName).toBe('Toyota Insurance Services');
    const row = await one('SELECT * FROM brand_pack_enablements ORDER BY id DESC LIMIT 1');
    expect(row).toMatchObject({ pack_id: TIS, status: 'enabled', acknowledged_permission: true, enabled_by: 'system', enabled_by_user_id: null });
    expect(row.acknowledgement_text).toBe(`${ACKNOWLEDGEMENT_TEXT} ${DEPLOYMENT_NOTE}`);
    const audit = await one("SELECT * FROM audit_log WHERE entity = 'branding' AND action = 'enable-pack' ORDER BY id DESC LIMIT 1");
    expect(audit).toMatchObject({ username: 'system', entity_id: `bundled-pack:${TIS}` });
    expect(audit.after_data).toMatchObject({ pack: TIS, acknowledgedPermission: true, acknowledgementText: expect.stringContaining('BRAND_PACK') });
    expect(audit.source).toMatchObject({ channel: 'job', name: 'BRAND_PACK' });
    const list = (await ctx.api('get', '/branding/packs/bundled')).body.data;
    expect(list.current).toMatchObject({ packId: TIS, enabledBy: 'system', enabledByName: 'system' });

    // a restart with the pack in force records nothing new
    const restart = logger();
    expect(await enableDeploymentPack(TIS, { log: restart })).toMatchObject({ status: 'skipped' });
    expect(restart.info).not.toHaveBeenCalled();
    expect(Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n)).toBe(1);

    // the administrator goes back to the default: later restarts keep it
    expect((await ctx.api('post', '/branding/packs/reset-default').send({})).status).toBe(200);
    expect(await enableDeploymentPack(TIS, { log: logger() })).toMatchObject({ status: 'skipped', reason: 'enabled before in this environment' });
    const after = (await request(ctx.app).get('/api/branding')).body.data;
    expect(after.theme.preset).toBe('iorta-technxt');
    expect(Number((await one("SELECT count(*)::int AS n FROM brand_pack_enablements WHERE status = 'enabled'")).n)).toBe(0);
  });

  it('takes turns when several instances start together: the pack is enabled once', async () => {
    await query('DELETE FROM brand_pack_enablements');
    const results = await Promise.all([enableDeploymentPack(TIS), enableDeploymentPack(TIS)]);
    expect(results.map((r) => r.status).sort()).toEqual(['enabled', 'skipped']);
    expect(Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n)).toBe(1);
    await ctx.api('post', '/branding/packs/reset-default').send({});
  });
});
