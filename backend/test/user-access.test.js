import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx; let uaa; let uaaId;
beforeAll(async () => {
  ctx = await setup();
  const r = await ctx.api('post', '/users').send({ username: 'uaa.one', password: 'Technxt@1', displayName: 'UAA One', roles: ['user-access-admin'] });
  uaaId = r.body.data.userId;
  uaa = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${ctx.uaaToken}`);
  ctx.uaaToken = await loginAs(ctx.app, 'uaa.one', 'Technxt@1');
});
afterAll(async () => { await pool.end(); });

describe('User Access Administrator', () => {
  it('lists, creates and locks users, and reads the audit trail', async () => {
    expect((await uaa('get', '/users')).status).toBe(200);
    const c = await uaa('post', '/users').send({ username: 'new.sales', password: 'Technxt@1', displayName: 'New Sales', roles: ['sales'] });
    expect(c.status).toBe(201);
    expect((await uaa('patch', `/users/${c.body.data.userId}/status`).send({ status: 'locked' })).status).toBe(200);
    expect((await uaa('get', '/settings/audit?entity=user')).status).toBe(200);
  });
  it('cannot grant administrator roles', async () => {
    const r = await uaa('post', '/users').send({ username: 'sneaky.admin', password: 'Technxt@1', displayName: 'X', roles: ['it-admin'] });
    expect(r.status).toBe(403);
  });
  it('cannot change its own roles', async () => {
    const r = await uaa('put', `/users/${uaaId}`).send({ roles: ['user-access-admin', 'finance'] });
    expect(r.status).toBe(403);
  });
  it('has no business access', async () => {
    expect((await uaa('get', '/policies')).status).toBe(403);
    expect((await uaa('get', '/receipts')).status).toBe(403);
  });
});
