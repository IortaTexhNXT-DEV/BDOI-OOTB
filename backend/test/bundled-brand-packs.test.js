/**
 * Bundled brand packs (API /branding/packs/bundled and BRAND_PACK): the Toyota
 * Insurance Services pack ships with the product but is never on by default; a System Administrator enables it after
 * acknowledging the client engagement whose contract covers the marks, the enablement is recorded and audited, and Back to default returns
 * the environment to the iorta TechNXT branding. A deployment for the client names the pack in BRAND_PACK: the API
 * enforces it at every start, applying it again whenever the branding of the screens has drifted from it.
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
import { ACKNOWLEDGEMENT_TEXT, BUNDLED_DIR, DEPLOYMENT_NOTE, bundledPackIds, enforceDeploymentPack, loadBundledPack } from '../src/modules/branding/bundled.js';
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
    expect(docFiles).toEqual(expect.arrayContaining(['theme.json', 'logo.png', 'favicon.png', 'README.md', `${TIS}.brandpack.zip`]));
    for (const f of docFiles) {
      expect(fs.existsSync(path.join(bundledDir, f)), `${f} missing from backend/assets/brand-packs/${TIS}`).toBe(true);
      expect(fs.readFileSync(path.join(bundledDir, f)).equals(fs.readFileSync(path.join(docsDir, f))), `${f} differs between docs and backend/assets`).toBe(true);
    }
    const { manifest, files, bundled } = loadBundledPack(TIS);
    expect(bundled).toMatchObject({ id: TIS, name: 'Toyota Insurance Services', requiresAcknowledgement: true, permissionBasis: expect.stringContaining('Contract between iorta TechNXT'), version: expect.any(String) });
    expect(bundled.trademarkOwner).toMatch(/toyota/i);
    expect(bundled.description.length).toBeGreaterThan(20);
    expect(manifest.format).toBe('brokerverse-brand-pack');
    expect([...files.keys()]).toEqual(['logo.png', 'favicon.png']);
    expect(manifest.theme.logo.showName).toBe(false);
  });

  it('keeps the built zip in step with the folder (build-brand-pack.js is deterministic)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-'));
    for (const f of ['theme.json', 'logo.png', 'favicon.png', 'README.md']) fs.copyFileSync(path.join(BUNDLED_DIR, TIS, f), path.join(tmp, f));
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
    expect(tis.assets).toEqual(['logo', 'favicon', 'documentLogo']);
    expect(list.history).toEqual([]);
    // settings permission: a sales user sees nothing and enables nothing
    expect((await request(ctx.app).get('/api/branding/packs/bundled').set('Authorization', `Bearer ${salesToken}`)).status).toBe(403);
    expect((await request(ctx.app).post(`/api/branding/packs/bundled/${TIS}/enable`).set('Authorization', `Bearer ${salesToken}`).send({ acknowledgedPermission: true })).status).toBe(403);
    expect((await request(ctx.app).post('/api/branding/packs/reset-default').set('Authorization', `Bearer ${salesToken}`).send({})).status).toBe(403);
  });

  it('checks a pack without applying it, and refuses to enable it without the acknowledgement', async () => {
    const check = await ctx.api('post', `/branding/packs/bundled/${TIS}/check`).send({});
    expect(check.status).toBe(200);
    expect(check.body.data).toMatchObject({ dryRun: true, name: 'Toyota Insurance Services', warnings: [], assets: ['logo', 'favicon', 'documentLogo'], pack: { id: TIS } });
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
    expect(r.body.data.applied).toEqual(expect.arrayContaining(['theme', 'logo', 'favicon', 'documentLogo', 'systemName']));
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
  const tisLogo = fs.readFileSync(path.join(BUNDLED_DIR, TIS, 'logo.png'));
  const tisFavicon = fs.readFileSync(path.join(BUNDLED_DIR, TIS, 'favicon.png'));
  const storedFiles = async () => Number((await one("SELECT count(*)::int AS n FROM documents WHERE entity = 'branding'")).n);
  const image = async (url) => { const u = new URL(url); return (await binary(request(ctx.app).get(`${u.pathname}${u.search}`))).body; };
  const packTheme = () => loadBundledPack(TIS).manifest.theme;

  it('reads BRAND_PACK from the environment, empty when not set', () => {
    expect(buildConfig({}).brandPack).toBe('');
    expect(buildConfig({ BRAND_PACK: ' toyota-insurance-services ' }).brandPack).toBe(TIS);
  });

  it('warns about a pack that is not shipped and changes nothing', async () => {
    const log = logger();
    const before = Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n);
    expect(await enforceDeploymentPack('acme-brokers', { log })).toMatchObject({ status: 'unknown', packId: 'acme-brokers' });
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toMatch(/BRAND_PACK=acme-brokers is not a bundled brand pack/);
    expect(log.info).not.toHaveBeenCalled();
    expect(Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n)).toBe(before);
    expect(await enforceDeploymentPack('', { log })).toMatchObject({ status: 'skipped' });
  });

  it('enables the pack at the first start, recorded against "system" with the deployment as the source', async () => {
    await ctx.api('post', '/branding/packs/reset-default').send({});
    await query('DELETE FROM brand_pack_enablements');
    const log = logger();
    const first = await enforceDeploymentPack(TIS, { log });
    expect(first).toMatchObject({ status: 'enabled', packId: TIS, reasons: expect.arrayContaining(['no brand pack was in force']) });
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls[0][0]).toMatch(/Brand pack Toyota Insurance Services enabled from BRAND_PACK=toyota-insurance-services: no brand pack was in force/);
    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    expect(pub.theme.colors).toMatchObject({ primary: '#1a1a1a', accent: '#eb0a1e' });
    expect(pub.theme.logo.showName).toBe(false);
    expect(pub.systemName).toBe('Toyota Insurance Services');
    expect((await image(pub.logoUrl)).equals(tisLogo)).toBe(true);
    expect((await image(pub.faviconUrl)).equals(tisFavicon)).toBe(true);
    const row = await one('SELECT * FROM brand_pack_enablements ORDER BY id DESC LIMIT 1');
    expect(row).toMatchObject({ pack_id: TIS, status: 'enabled', acknowledged_permission: true, enabled_by: 'system', enabled_by_user_id: null });
    expect(row.acknowledgement_text).toBe(`${ACKNOWLEDGEMENT_TEXT} ${DEPLOYMENT_NOTE}`);
    const audit = await one("SELECT * FROM audit_log WHERE entity = 'branding' AND action = 'enable-pack' ORDER BY id DESC LIMIT 1");
    expect(audit).toMatchObject({ username: 'system', entity_id: `bundled-pack:${TIS}` });
    expect(audit.after_data).toMatchObject({ pack: TIS, acknowledgedPermission: true, acknowledgementText: expect.stringContaining('BRAND_PACK'), reasons: expect.any(Array) });
    expect(audit.source).toMatchObject({ channel: 'job', name: 'BRAND_PACK' });
    const list = (await ctx.api('get', '/branding/packs/bundled')).body.data;
    expect(list.current).toMatchObject({ packId: TIS, enabledBy: 'system', enabledByName: 'system' });
  });

  it('a start with nothing drifted records, applies and stores nothing, and says the pack is in force', async () => {
    const files = await storedFiles();
    const audits = Number((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'branding'")).n);
    const settings = await one("SELECT max(updated_at) AS at FROM app_settings WHERE key LIKE 'branding.%' OR key = 'general.system_name'");
    const restart = logger();
    expect(await enforceDeploymentPack(TIS, { log: restart })).toMatchObject({ status: 'in-force' });
    expect(restart.info).toHaveBeenCalledTimes(1);
    expect(restart.info.mock.calls[0][0]).toBe('Brand pack Toyota Insurance Services in force (BRAND_PACK=toyota-insurance-services)');
    expect(await storedFiles()).toBe(files);
    expect(Number((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'branding'")).n)).toBe(audits);
    expect((await one("SELECT max(updated_at) AS at FROM app_settings WHERE key LIKE 'branding.%' OR key = 'general.system_name'")).at).toEqual(settings.at);
    expect(Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n)).toBe(1);
  });

  it('applies the pack again when the screens drifted, keeping the e-mail and document layouts and the signature mapping', async () => {
    // the layouts edited on their screens, a signature slot mapped
    const editor = (await ctx.api('get', '/branding/theme')).body.data.theme;
    const email = { ...editor.email, footerText: 'Toyota Insurance Services | Makati City', accentColor: '#1a1a1a' };
    const documents = { ...editor.documents, footerText: 'TISPH documents footer', headingBg: '#eeeeee' };
    expect((await ctx.api('put', '/branding/theme').send({ theme: { ...editor, email, documents, logo: { ...editor.logo, documentHeight: 52 } } })).status).toBe(200);
    await query('DELETE FROM document_signature_slots');
    expect((await ctx.api('put', '/e-signatures/slots').send({ slots: [{ documentType: 'official-receipt', slot: 'authorized', label: 'Authorized signature', source: 'default-signatory', condition: 'issued' }] })).status).toBe(200);
    const slots = await query('SELECT document_type, slot, label, source FROM document_signature_slots ORDER BY id');
    // what the System Settings screen of earlier releases saved: the default colours, logo, favicon and name
    const old = await ctx.api('put', '/system-settings').send({ systemName: 'BrokerVerse', primaryColor: '#0072d8', secondaryColor: '#004ea8', logoUrl: '/bdoi/iorta-technxt.png', faviconUrl: '/favicon.ico' });
    expect(old.status).toBe(200);
    const drifted = (await request(ctx.app).get('/api/branding')).body.data;
    expect(drifted.theme.colors.primary).toBe('#0072d8');
    expect(drifted.systemName).toBe('BrokerVerse');

    const files = await storedFiles();
    const log = logger();
    const r = await enforceDeploymentPack(TIS, { log });
    expect(r.status).toBe('re-applied');
    expect(r.reasons).toEqual([expect.stringMatching(/^the theme differs \(colors\.primary/), 'the application name is "BrokerVerse"', "the logo is not the pack's", "the favicon is not the pack's"]);
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls[0][0]).toMatch(/^Brand pack Toyota Insurance Services applied again from BRAND_PACK=toyota-insurance-services: the theme differs .*the application name is "BrokerVerse"/);
    // the logo file stored before is still the print logo of the company: only the favicon is stored again
    expect(await storedFiles()).toBe(files + 1);

    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    expect(pub.systemName).toBe('Toyota Insurance Services');
    expect(pub.theme.colors).toMatchObject({ primary: '#1a1a1a', secondary: '#000000', buttonBg: '#1a1a1a', accent: '#eb0a1e' });
    expect(pub.theme).toMatchObject({ preset: 'custom', name: 'Toyota Insurance Services', font: 'inter', layout: packTheme().layout, radius: packTheme().radius });
    expect(pub.theme.email).toMatchObject({ footerText: 'Toyota Insurance Services | Makati City', accentColor: '#1a1a1a' });
    expect(pub.theme.documents).toMatchObject({ footerText: 'TISPH documents footer', headingBg: '#eeeeee' });
    expect(pub.theme.logo).toMatchObject({ documentHeight: 52, appHeight: 40, showName: false });
    expect((await image(pub.logoUrl)).equals(tisLogo)).toBe(true);
    expect((await image(pub.faviconUrl)).equals(tisFavicon)).toBe(true);
    expect((await query('SELECT document_type, slot, label, source FROM document_signature_slots ORDER BY id'))).toEqual(slots);
    const audit = await one("SELECT * FROM audit_log WHERE entity = 'branding' AND action = 'reapply-pack' ORDER BY id DESC LIMIT 1");
    expect(audit).toMatchObject({ username: 'system', entity_id: `bundled-pack:${TIS}` });
    expect(audit.after_data.reasons).toEqual(r.reasons);
    expect(audit.before_data.colors.primary).toBe('#0072d8');
    expect(Number((await one("SELECT count(*)::int AS n FROM brand_pack_enablements WHERE status = 'enabled'")).n)).toBe(1);

    // the next start finds nothing to do
    const files2 = await storedFiles();
    expect(await enforceDeploymentPack(TIS, { log: logger() })).toMatchObject({ status: 'in-force' });
    expect(await storedFiles()).toBe(files2);
  });

  it('applies the pack again after a Back to default, with the pack\'s layouts where they were back at the default', async () => {
    expect((await ctx.api('post', '/branding/packs/reset-default').send({})).status).toBe(200);
    const reset = (await request(ctx.app).get('/api/branding')).body.data;
    expect(reset.theme.preset).toBe('iorta-technxt');
    const log = logger();
    const r = await enforceDeploymentPack(TIS, { log });
    expect(r).toMatchObject({ status: 'enabled', reasons: expect.arrayContaining(['no brand pack was in force', "the logo is not the pack's"]) });
    const pub = (await request(ctx.app).get('/api/branding')).body.data;
    expect(pub.theme.colors.primary).toBe('#1a1a1a');
    expect(pub.systemName).toBe('Toyota Insurance Services');
    expect(pub.theme.email).toMatchObject(packTheme().email);
    expect(pub.theme.documents.footerText).toBe(packTheme().documents.footerText);
    clearLetterheadCache();
    expect((await getLetterhead()).logo.buffer.equals(tisLogo)).toBe(true);
    expect(Number((await one("SELECT count(*)::int AS n FROM brand_pack_enablements WHERE status = 'enabled'")).n)).toBe(1);
    expect(await enforceDeploymentPack(TIS, { log: logger() })).toMatchObject({ status: 'in-force' });
  });

  it('applies the print logo again when the primary company has none', async () => {
    const company = await one("SELECT id FROM master_records WHERE type_code = 'company' AND lower(COALESCE(data->>'IsPrimary', 'false')) IN ('true', 'yes', '1') ORDER BY id LIMIT 1");
    await query("UPDATE master_records SET data = data - 'Logo' WHERE id = $1", [company.id]);
    clearLetterheadCache();
    const files = await storedFiles();
    const r = await enforceDeploymentPack(TIS, { log: logger() });
    expect(r).toMatchObject({ status: 're-applied', reasons: ['the primary company has no print logo'] });
    expect(r.applied).toContain('documentLogo');
    expect(await storedFiles()).toBe(files);
    clearLetterheadCache();
    expect((await getLetterhead()).logo.buffer.equals(tisLogo)).toBe(true);
  });

  it('takes turns when several instances start together: the pack is enabled once', async () => {
    await ctx.api('post', '/branding/packs/reset-default').send({});
    await query('DELETE FROM brand_pack_enablements');
    const results = await Promise.all([enforceDeploymentPack(TIS), enforceDeploymentPack(TIS)]);
    expect(results.map((r) => r.status).sort()).toEqual(['enabled', 'in-force']);
    expect(Number((await one('SELECT count(*)::int AS n FROM brand_pack_enablements')).n)).toBe(1);
    await ctx.api('post', '/branding/packs/reset-default').send({});
  });
});
