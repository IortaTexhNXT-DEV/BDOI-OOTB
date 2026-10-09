/**
 * A deployment that names its brand pack in BRAND_PACK (here the Toyota Insurance Services pack): the API refuses every
 * change to the look of the screens (theme colours, layout, font, sign-in page, logo, favicon, application name,
 * another pack, Back to default), while the layout screens of Master > System Configuration still change the e-mail and
 * document sections of the theme, and the display currency and language still save.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setup } from './helpers.js';
import { one, pool } from '../src/db/pool.js';
import { deploymentPackId, enforceDeploymentPack } from '../src/modules/branding/bundled.js';

vi.mock('../src/config.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, config: { ...mod.config, brandPack: 'toyota-insurance-services' } };
});

const TIS = 'toyota-insurance-services';
// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

let ctx;
beforeAll(async () => {
  ctx = await setup();
  expect(await enforceDeploymentPack(TIS)).toMatchObject({ status: expect.stringMatching(/^(enabled|re-applied|in-force)$/) });
});
afterAll(async () => { await pool.end(); });

const branding = async () => (await request(ctx.app).get('/api/branding')).body.data;

describe('theme save while BRAND_PACK is set', () => {
  it('knows the pack the deployment enforces', () => {
    expect(deploymentPackId()).toBe(TIS);
  });

  it('saves the e-mail and document sections sent by the layout screens (the whole theme in force, edited)', async () => {
    const editor = (await ctx.api('get', '/branding/theme')).body.data;
    expect(editor.systemName).toBe('Toyota Insurance Services');
    const theme = { ...editor.theme, email: { ...editor.theme.email, footerText: 'TIS e-mail footer' }, documents: { ...editor.theme.documents, footerText: 'TIS document footer' }, logo: { ...editor.theme.logo, documentHeight: 50 } };
    const r = await ctx.api('put', '/branding/theme').send({ theme });
    expect(r.status).toBe(200);
    const pub = await branding();
    expect(pub.theme.email.footerText).toBe('TIS e-mail footer');
    expect(pub.theme.documents.footerText).toBe('TIS document footer');
    expect(pub.theme.logo.documentHeight).toBe(50);
    expect(pub.theme.colors.primary).toBe('#1a1a1a');
  });

  it('lays a partial theme over the theme in force', async () => {
    const r = await ctx.api('put', '/branding/theme').send({ theme: { email: { accentColor: '#1a1a1a' } } });
    expect(r.status).toBe(200);
    const pub = await branding();
    expect(pub.theme.email).toMatchObject({ accentColor: '#1a1a1a', footerText: 'TIS e-mail footer' });
    expect(pub.theme).toMatchObject({ preset: 'custom', name: 'Toyota Insurance Services', font: 'inter' });
  });

  it('refuses a change to the colours, the preset, the sign-in page, the logo sizes or the application name, and saves nothing', async () => {
    const before = await branding();
    const editor = (await ctx.api('get', '/branding/theme')).body.data.theme;
    const cases = [
      [{ theme: { ...editor, colors: { ...editor.colors, primary: '#0072d8', buttonBg: '#0072d8' }, email: { ...editor.email, footerText: 'changed' } } }, ['colors.primary', 'colors.buttonBg']],
      [{ theme: { preset: 'iorta-technxt' } }, ['preset']],
      [{ theme: { login: { headline: 'Welcome to BrokerVerse' } } }, ['login.headline']],
      [{ theme: { logo: { showName: true } } }, ['logo.showName']],
      [{ theme: editor, systemName: 'BrokerVerse' }, ['systemName']],
    ];
    for (const [body, paths] of cases) {
      const r = await ctx.api('put', '/branding/theme').send(body);
      expect(r.status, JSON.stringify(paths)).toBe(400);
      expect(r.body.message).toContain(`BRAND_PACK=${TIS}`);
      expect(r.body.errors.map((e) => e.path)).toEqual(paths);
    }
    expect(await branding()).toEqual(before);
  });

  it('still checks and previews a theme, and accepts the application name sent back unchanged', async () => {
    const editor = (await ctx.api('get', '/branding/theme')).body.data.theme;
    expect((await ctx.api('post', '/branding/theme/validate').send({ theme: editor })).body.data.errors).toEqual([]);
    expect((await ctx.api('post', '/branding/preview-email').send({ theme: editor })).status).toBe(200);
    expect((await ctx.api('put', '/branding/theme').send({ theme: editor, systemName: 'Toyota Insurance Services' })).status).toBe(200);
  });
});

describe('other branding changes while BRAND_PACK is set', () => {
  it('refuses images, brand pack import, enabling a pack and Back to default', async () => {
    const before = await branding();
    const refused = [
      await ctx.api('post', '/branding/upload/logo').attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' }),
      await ctx.api('delete', '/branding/upload/favicon'),
      await ctx.api('delete', '/branding/upload/login-panel'),
      await ctx.api('post', '/branding/brand-pack').send((await ctx.api('get', '/branding/brand-pack?format=json')).body),
      await ctx.api('post', `/branding/packs/bundled/${TIS}/enable`).send({ acknowledgedPermission: true }),
      await ctx.api('post', '/branding/packs/reset-default').send({}),
    ];
    for (const r of refused) {
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(/comes from the brand pack of the deployment \(BRAND_PACK=toyota-insurance-services\)/);
    }
    expect(refused[0].body.message).toMatch(/^The application logo /);
    expect(await branding()).toEqual(before);
    expect((await one("SELECT count(*)::int AS n FROM brand_pack_enablements WHERE status = 'enabled'")).n).toBe(1);
    // the dry run of an import and the check of a pack change nothing and stay available
    expect((await ctx.api('post', '/branding/brand-pack?dryRun=true').send((await ctx.api('get', '/branding/brand-pack?format=json')).body)).status).toBe(200);
    expect((await ctx.api('post', `/branding/packs/bundled/${TIS}/check`).send({})).status).toBe(200);
  });

  it('refuses the branding fields of the system settings, and still saves the display currency and language', async () => {
    for (const body of [{ primaryColor: '#0072d8' }, { systemName: 'BrokerVerse' }, { logoUrl: '/bdoi/iorta-technxt.png' }, { faviconUrl: '/favicon.ico' }]) {
      const r = await ctx.api('put', '/system-settings').send({ ...body, displayCurrency: 'PHP' });
      expect(r.status).toBe(400);
      expect(r.body.errors).toEqual([{ path: Object.keys(body)[0], message: expect.stringContaining(`BRAND_PACK=${TIS}`) }]);
    }
    const now = (await request(ctx.app).get('/api/system-settings')).body.data;
    const ok = await ctx.api('put', '/system-settings').send({ systemName: now.systemName, primaryColor: now.primaryColor, displayCurrency: 'PHP', defaultLanguage: 'en' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ systemName: 'Toyota Insurance Services', displayCurrency: 'PHP', defaultLanguage: 'en' });
    expect((await ctx.api('post', '/system-settings/upload/logo').attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' })).status).toBe(400);
    expect((await ctx.api('post', '/system-settings/logo-presets').send({ label: 'Other Co', url: '/iorta.png', setActive: true })).status).toBe(400);
    expect((await ctx.api('put', '/settings').send({ settings: { 'general.system_name': 'BrokerVerse' } })).status).toBe(400);
    expect((await branding()).systemName).toBe('Toyota Insurance Services');
  });
});
