import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('core', () => {
  it('rejects a wrong password and accepts the admin', async () => {
    expect((await request(ctx.app).post('/api/auth/login').send({ username: 'BrokerVerse', password: 'x' })).status).toBe(401);
    expect(ctx.token).toBeTruthy();
  });
  it('admin creates a persona user who can then sign in with that role', async () => {
    const r = await ctx.api('post', '/users').send({ username: 't.claims', password: 'Welcome@123', displayName: 'T Claims', roles: ['claims'] });
    expect(r.status).toBe(201);
    const tok = await loginAs(ctx.app, 't.claims', 'Welcome@123');
    expect(tok).toBeTruthy();
    const denied = await request(ctx.app).post('/api/users').set('Authorization', `Bearer ${tok}`).send({ username: 'x.y', roles: ['sales'] });
    expect(denied.status).toBe(403);
  });
  it('settings are read from the database and editable by admins', async () => {
    const put = await ctx.api('put', '/settings').send({ settings: { 'tax.vat_rate': 0.12 } });
    expect(put.status).toBe(200);
    const get = await ctx.api('get', '/settings?group=tax');
    expect(get.body.data.find((s) => s.key === 'tax.vat_rate').value).toBe(0.12);
  });
  it('refuses a schedule that is not a valid cron expression', async () => {
    const bad = await ctx.api('put', '/schedules/policy-expiry').send({ cron: 'every morning' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].path).toBe('cron');
    expect((await ctx.api('put', '/schedules/policy-expiry').send({ cron: '15 0 * * *' })).status).toBe(200);
  });

  it('runs a scheduled job and records the run', async () => {
    const r = await ctx.api('post', '/schedules/policy-expiry/run');
    expect(r.body.data.status).toBe('success');
    const runs = await ctx.api('get', '/schedules/policy-expiry/runs');
    expect(runs.body.data.length).toBeGreaterThan(0);
  });
  it('writes an audit trail', async () => {
    const a = await ctx.api('get', '/settings/audit?entity=user');
    expect(a.body.data.some((x) => x.action === 'create')).toBe(true);
  });
});
