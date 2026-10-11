/**
 * Environment Promotion (migration 0595): the promotion path, the environment marker set on screen only and kept out
 * of the Setup Workbook, and the permissions of the IT administrator.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { settingOwner } from '../src/lib/settingOwners.js';

let ctx;
const tok = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);

beforeAll(async () => {
  ctx = await setup();
  for (const [u, role] of [['prom.it', 'tis-it-admin'], ['prom.ops', 'tis-ops-associate']]) {
    const r = await ctx.api('post', '/users').send({ username: u, password: 'Welcome@123', displayName: u, email: `${u}@example.ph`, roles: [role] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    tok[u] = await loginAs(ctx.app, u, 'Welcome@123');
  }
});
afterAll(async () => { await pool.end(); });

describe('promotion path', () => {
  it('shows the path with the position of this environment, the release and the workbook activity; the IT administrator reads it, operations does not', async () => {
    const r = await as('prom.it', 'get', '/environment-promotion');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.path.map((p) => p.code)).toEqual(['dev', 'sit', 'uat', 'preprod', 'production']);
    expect(r.body.data).toMatchObject({ environment: 'dev', label: 'Development', onPath: true, previous: null, next: { code: 'sit' }, locked: false });
    expect(r.body.data.release.apiVersion).toBeTruthy();
    expect(r.body.data.release.schema).toMatch(/^\d{4}$/);
    expect(r.body.data.choices.map((c) => c.code)).toContain('training');
    expect((await as('prom.ops', 'get', '/environment-promotion')).status).toBe(403);
    expect((await as('prom.it', 'get', '/environment-promotion/history')).status).toBe(200);
    // the IT administrator also downloads the Setup Workbook with the current data; the export is then the last one
    const wb = await as('prom.it', 'get', '/data-load/kits/configuration/template?prefill=true');
    expect(wb.status).toBe(200);
    expect((await as('prom.it', 'get', '/environment-promotion')).body.data.lastExport).toMatchObject({ by: 'prom.it' });
  });

  it('marks the environment on screen only, audited; the marker is owned by the screen and never travels in a workbook', async () => {
    expect((await as('prom.it', 'put', '/environment-promotion/environment').send({ environment: 'moon' })).status).toBe(400);
    expect((await as('prom.ops', 'put', '/environment-promotion/environment').send({ environment: 'uat' })).status).toBe(403);
    const r = await as('prom.it', 'put', '/environment-promotion/environment').send({ environment: 'uat' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Environment marked as User Acceptance Testing');
    expect(r.body.data).toMatchObject({ environment: 'uat', previous: { code: 'sit' }, next: { code: 'preprod' } });
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'environment' AND action = 'mark'")).n).toBe(1);
    expect(settingOwner('system.environment').path).toBe('/master/promotion/path');
    // Master > Configuration refuses it
    const generic = await ctx.api('put', '/settings').send({ settings: { 'system.environment': 'sit' } });
    expect(generic.status).toBe(400);
    expect(generic.body.message).toMatch(/Promotion Path/);
    // the workbook leaves it out
    const kits = await as('prom.it', 'get', '/data-load/kits');
    const settings = kits.body.data.kits.find((k) => k.kit === 'configuration').sheets.find((s) => s.key === 'settings');
    expect(settings).toBeTruthy();
    const { configurationSheets } = await import('../src/modules/data-load/configuration.js');
    const sheet = (await configurationSheets()).find((s) => s.key === 'settings');
    const keys = (await sheet.exportRows()).map((row) => row.key);
    expect(keys).not.toContain('system.environment');
    expect(keys).toContain('general.timezone');
    // a locked database is production and stays so
    await ctx.api('put', '/settings').send({ settings: { 'system.environment': 'production' } }).catch(() => {});
    await (await import('../src/db/pool.js')).query("UPDATE app_settings SET value = 'true'::jsonb WHERE key = 'golive.locked'");
    clearSettingsCache();
    expect((await as('prom.it', 'put', '/environment-promotion/environment').send({ environment: 'uat' })).status).toBe(409);
    expect((await as('prom.it', 'put', '/environment-promotion/environment').send({ environment: 'production' })).status).toBe(200);
    await (await import('../src/db/pool.js')).query("UPDATE app_settings SET value = 'false'::jsonb WHERE key = 'golive.locked'");
    await (await import('../src/db/pool.js')).query("UPDATE app_settings SET value = '\"dev\"'::jsonb WHERE key = 'system.environment'");
    clearSettingsCache();
  });
});
