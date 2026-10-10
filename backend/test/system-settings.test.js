import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withStarterMasters } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let claimsToken;
// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

beforeAll(async () => {
  ctx = await setup();
  await withStarterMasters();
  await ctx.api('post', '/users').send({ username: 'ss.claims', password: 'Welcome@123', displayName: 'SS Claims', roles: ['claims'] });
  claimsToken = await loginAs(ctx.app, 'ss.claims', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });

describe('system settings', () => {
  it('GET is public and returns the front-end shape backed by app_settings', async () => {
    const r = await request(ctx.app).get('/api/system-settings');
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d).toMatchObject({ displayCurrency: 'PHP', defaultLanguage: 'en', systemName: 'BrokerVerse', faviconUrl: '/favicon.ico' });
    expect(d.logoPresets.find((p) => p.id === 'iorta-technxt').builtIn).toBe(true);
    expect(d.logoPresets.find((p) => p.id === 'bdo')).toBeUndefined(); // not a built-in of the OOTB product
    expect(d.currencies.find((c) => c.code === 'PHP').locale).toBe('en-PH');
    expect(d.logoUrl).toBeTruthy();
    // Locale and form options the front end applies app-wide (date format, mobile numbers, quote options)
    expect(d).toMatchObject({ dateFormat: 'DD/MM/YYYY', phoneCountryCode: '+63', mobilePattern: '^9\\d{9}$', modelYearSpan: 20 });
    expect(d.mobileExample).toBeTruthy();
    expect(d.vehicleColours.length).toBeGreaterThan(0);
    // Coverage limit dropdowns of the motor quote / endorsement screens come from configuration (quote.*_limits)
    expect(d.bodilyInjuryLimits).toEqual([100000, 200000, 300000, 400000, 500000]);
    expect(d.propertyDamageLimits).toEqual([100000, 200000, 300000, 400000, 500000]);
  });

  it('PUT saves fields and /settings (key-value) stays consistent', async () => {
    const r = await ctx.api('put', '/system-settings').send({ systemName: 'BrokerVerse PH', primaryColor: '#123abc', secondaryColor: '#004ea8', displayCurrency: 'SGD', defaultLanguage: 'en', logoUrl: '/iorta.png', ignored: 1 });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ systemName: 'BrokerVerse PH', primaryColor: '#123abc', displayCurrency: 'SGD', logoUrl: '/iorta.png' });
    const kv = await ctx.api('get', '/settings?group=branding');
    expect(kv.body.data.find((s) => s.key === 'branding.primary_color').value).toBe('#123abc');
    await ctx.api('put', '/system-settings').send({ displayCurrency: 'PHP', systemName: 'BrokerVerse' });
  });

  it('rejects invalid values and unauthorised users', async () => {
    const bad = await ctx.api('put', '/system-settings').send({ primaryColor: 'blue', displayCurrency: 'XXX' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['primaryColor', 'displayCurrency']));
    const denied = await request(ctx.app).put('/api/system-settings').set('Authorization', `Bearer ${claimsToken}`).send({ systemName: 'x' });
    expect(denied.status).toBe(403);
    expect((await request(ctx.app).put('/api/system-settings').send({ systemName: 'x' })).status).toBe(401);
  });

  it('adds a logo preset by URL and by file upload, then removes it', async () => {
    const byUrl = await ctx.api('post', '/system-settings/logo-presets').send({ label: 'Sample Bank', url: 'https://example.com/logo.png', setActive: true });
    expect(byUrl.status).toBe(200);
    const preset = byUrl.body.data.logoPresets.find((p) => p.label === 'Sample Bank');
    expect(preset.builtIn).toBe(false);
    expect(byUrl.body.data.logoUrl).toBe('https://example.com/logo.png');
    const byFile = await ctx.api('post', '/system-settings/logo-presets').field('label', 'Uploaded Co').field('setActive', 'false').attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' });
    expect(byFile.status).toBe(200);
    const up = byFile.body.data.logoPresets.find((p) => p.label === 'Uploaded Co');
    expect(up.url).toMatch(/\/api\/s3\/object\/logo\//);
    const file = await request(ctx.app).get(up.url.replace(/^https?:\/\/[^/]+/, ''));
    expect(file.status).toBe(200);
    const builtIn = await ctx.api('delete', '/system-settings/logo-presets/iorta-technxt');
    expect(builtIn.status).toBe(400);
    const del = await ctx.api('delete', `/system-settings/logo-presets/${preset.id}`);
    expect(del.status).toBe(200);
    expect(del.body.data.logoPresets.some((p) => p.id === preset.id)).toBe(false);
  });

  it('uploads a favicon and rejects a disallowed type', async () => {
    const r = await ctx.api('post', '/system-settings/upload/favicon').attach('file', PNG, { filename: 'fav.png', contentType: 'image/png' });
    expect(r.status).toBe(200);
    expect(r.body.data.faviconUrl).toMatch(/\/api\/s3\/object\/favicon\//);
    const bad = await ctx.api('post', '/system-settings/upload/logo').attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(bad.status).toBe(400);
    expect((await ctx.api('post', '/system-settings/upload/banner').attach('file', PNG, 'b.png')).status).toBe(400);
  });

  it('configuration catalogue lists and updates typed keys', async () => {
    const cat = await ctx.api('get', '/system-settings/configuration');
    expect(cat.status).toBe(200);
    const tax = cat.body.data.groups.find((g) => g.group === 'tax');
    expect(tax.label).toBe('Taxes');
    expect(tax.items.find((i) => i.key === 'tax.vat_rate').type).toBe('number');
    const put = await ctx.api('put', '/system-settings/configuration').send({ settings: { 'tax.vat_rate': '0.12', 'remittance.default_due_days': 45, 'notification.email_enabled': true } });
    expect(put.status).toBe(200);
    expect(put.body.data.items.find((i) => i.key === 'remittance.default_due_days').value).toBe(45);
    // numbering prefixes are a read-only mirror of Master > Document Numbering
    const prefix = await ctx.api('put', '/system-settings/configuration').send({ settings: { 'numbering.remittance.prefix': 'RMT' } });
    expect(prefix.status).toBe(400);
    expect(prefix.body.errors[0]).toMatchObject({ path: 'numbering.remittance.prefix', message: 'Setting is read-only' });
    expect(put.body.data.items.find((i) => i.key === 'tax.vat_rate').value).toBe(0.12);
    const bad = await ctx.api('put', '/system-settings/configuration').send({ items: [{ key: 'tax.vat_rate', value: 'abc' }, { key: 'nope.key', value: 1 }, { key: 'product.component_kinds', value: [] }] });
    expect(bad.status).toBe(400);
    expect(bad.body.errors).toHaveLength(3);
    const denied = await request(ctx.app).get('/api/system-settings/configuration').set('Authorization', `Bearer ${claimsToken}`);
    expect(denied.status).toBe(403);
  });
});
