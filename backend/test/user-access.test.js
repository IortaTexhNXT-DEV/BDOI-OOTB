import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

const UAA_PW = 'Uaa-Test#2026';

let ctx; let uaa; let uaaId;
beforeAll(async () => {
  ctx = await setup();
  const r = await ctx.api('post', '/users').send({ username: 'uaa.one', password: UAA_PW, displayName: 'UAA One', roles: ['user-access-admin'] });
  uaaId = r.body.data.userId;
  uaa = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${ctx.uaaToken}`);
  ctx.uaaToken = await loginAs(ctx.app, 'uaa.one', UAA_PW);
});
afterAll(async () => { await pool.end(); });

describe('User Access Administrator', () => {
  it('lists, creates and locks users, and reads the audit trail', async () => {
    const list = await uaa('get', '/users?search=uaa.one');
    expect(list.status).toBe(200);
    const me = list.body.data.find((u) => u.username === 'uaa.one');
    expect(me.roles).toContain('user-access-admin');
    expect(me.roleNames.length).toBe(1);
    expect(me.roleNames[0]).not.toBe('user-access-admin');
    const c =await uaa('post', '/users').send({ username: 'new.sales', password: UAA_PW, displayName: 'New Sales', roles: ['sales'] });
    expect(c.status).toBe(201);
    expect((await uaa('patch', `/users/${c.body.data.userId}/status`).send({ status: 'locked' })).status).toBe(200);
    expect((await uaa('get', '/settings/audit?entity=user')).status).toBe(200);
  });
  it('cannot grant administrator roles', async () => {
    const r = await uaa('post', '/users').send({ username: 'sneaky.admin', password: UAA_PW, displayName: 'X', roles: ['it-admin'] });
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
