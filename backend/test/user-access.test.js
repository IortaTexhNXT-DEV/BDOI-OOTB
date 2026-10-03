import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, createUserDeskRole } from './helpers.js';
import { pool } from '../src/db/pool.js';

// User administration by a role that is not an administrator. The built-in User Access Administrator was merged into
// the System Administrator (system-admin); a customer can still create such a role, and the protections below hold.
const UAA_PW = 'Uaa-Test#2026';

let ctx; let uaa; let uaaId;
beforeAll(async () => {
  ctx = await setup();
  const role = await createUserDeskRole(ctx.api);
  const r = await ctx.api('post', '/users').send({ username: 'uaa.one', password: UAA_PW, displayName: 'UAA One', roles: [role] });
  uaaId = r.body.data.userId;
  uaa = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${ctx.uaaToken}`);
  ctx.uaaToken = await loginAs(ctx.app, 'uaa.one', UAA_PW);
});
afterAll(async () => { await pool.end(); });

describe('user administration without the administrator role', () => {
  it('lists, creates and locks users, and reads the audit trail', async () => {
    const list = await uaa('get', '/users?search=uaa.one');
    expect(list.status).toBe(200);
    const me = list.body.data.find((u) => u.username === 'uaa.one');
    expect(me.roles).toContain('user-desk');
    expect(me.roleNames).toEqual(['User desk (test)']);
    const c = await uaa('post', '/users').send({ username: 'new.sales', password: UAA_PW, displayName: 'New Sales', roles: ['sales'] });
    expect(c.status).toBe(201);
    expect((await uaa('patch', `/users/${c.body.data.userId}/status`).send({ status: 'locked' })).status).toBe(200);
    expect((await uaa('get', '/settings/audit?entity=user')).status).toBe(200);
  });
  it('cannot grant the System Administrator role', async () => {
    const r = await uaa('post', '/users').send({ username: 'sneaky.admin', password: UAA_PW, displayName: 'X', roles: ['system-admin'] });
    expect(r.status).toBe(403);
  });
  it('cannot change its own roles', async () => {
    const r = await uaa('put', `/users/${uaaId}`).send({ roles: ['user-desk', 'accounting'] });
    expect(r.status).toBe(403);
  });
  it('has no business access', async () => {
    expect((await uaa('get', '/policies')).status).toBe(403);
    expect((await uaa('get', '/receipts')).status).toBe(403);
  });
  it('the seeded roles are the broker roles and the System Administrator', async () => {
    const roles = (await ctx.api('get', '/roles')).body.data.map((r) => r.code);
    expect(roles).toEqual(expect.arrayContaining(['system-admin', 'sales', 'processing', 'operations', 'claims', 'accounting', 'accounting-manager']));
    for (const old of ['it-admin', 'ba', 'user-access-admin', 'underwriting', 'customer-services', 'finance', 'finance-manager', 'agent']) expect(roles).not.toContain(old);
  });
});
