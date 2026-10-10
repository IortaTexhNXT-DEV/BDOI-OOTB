/**
 * Access control: the authority matrix (defaults, maker-checker on limits, the check used by approvals, delegation),
 * segregation of duties on role assignment, the user and role matrices, access reviews, ending sessions and dormant
 * accounts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { assertAuthority, deactivateDormant, effectiveAuthority } from '../src/modules/access-control/service.js';
import { addDays, today } from '../src/lib/dates.js';

let ctx;
let admin2;
const PASSWORD = 'Welcome@123';
const login = async (username) => (await request(ctx.app).post('/api/auth/login').send({ username, password: PASSWORD })).body.accessToken;

beforeAll(async () => {
  ctx = await setupFinance();
  await ctx.api('post', '/users').send({ username: 'ac.admin2', password: PASSWORD, displayName: 'Second administrator', roles: ['system-admin'], email: 'ac.admin2@example.ph' });
  const token = await login('ac.admin2');
  admin2 = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
});
afterAll(async () => { await pool.end(); });

describe('authority matrix', () => {
  it('ships default limits per role and shows them types down, roles across', async () => {
    const r = await ctx.api('get', '/access-control/authority-matrix');
    expect(r.status).toBe(200);
    const pv = r.body.data.rows.find((x) => x.code === 'payment_voucher');
    expect(pv.cells.accounting).toMatchObject({ set: true, maxAmount: 2000000 });
    expect(pv.cells['accounting-manager']).toMatchObject({ set: true, unlimited: true });
    expect(pv.cells['system-admin'].set).toBe(false);
  });

  it('a new limit applies only after another administrator approves it', async () => {
    const proposed = await ctx.api('post', '/access-control/authority-limits').send({ transactionType: 'write_off', roleCode: 'accounting', maxAmount: 2500, referenceNo: 'BR-2026-014', referenceDate: '2026-01-15', remarks: 'Raised for small differences' });
    expect(proposed.status).toBe(201);
    expect(proposed.body.data.status).toBe('pending');
    expect((await ctx.api('post', `/access-control/authority-limits/${proposed.body.data.id}/decision`).send({ decision: 'approve' })).status).toBe(403);
    const approved = await admin2('post', `/access-control/authority-limits/${proposed.body.data.id}/decision`).send({ decision: 'approve' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('active');
    const history = (await ctx.api('get', '/access-control/authority-limits?transactionType=write_off')).body.data.filter((l) => l.roleCode === 'accounting');
    expect(history.map((l) => l.status).sort()).toEqual(['active', 'retired']);
    expect(await effectiveAuthority(pool, ctx.userIds.checker, 'write_off')).toMatchObject({ found: true, limit: 2500 });
  });

  it('refuses an approval above the approver\'s limit and allows it within', async () => {
    const checker = { id: ctx.userIds.checker };
    await expect(assertAuthority(pool, checker, 'journal_voucher', 1500000)).rejects.toThrow(/above your approval authority of PHP 1,000,000.00/);
    await expect(assertAuthority(pool, checker, 'journal_voucher', 250000)).resolves.toMatchObject({ found: true, limit: 1000000 });
    // no row for the role: allowed by default, refused when the setting says so
    await expect(assertAuthority(pool, { id: ctx.userIds.sales }, 'journal_voucher', 10)).resolves.toMatchObject({ found: false });
    await query("UPDATE app_settings SET value = '\"refuse\"' WHERE key = 'access.authority_without_limit'");
    const { clearSettingsCache } = await import('../src/lib/settings.js');
    clearSettingsCache();
    await expect(assertAuthority(pool, { id: ctx.userIds.sales }, 'journal_voucher', 10)).rejects.toThrow(/no approval authority/);
    await query("UPDATE app_settings SET value = '\"allow\"' WHERE key = 'access.authority_without_limit'");
    clearSettingsCache();
  });

  it('a delegation lends the delegator\'s authority for its types and dates once another administrator approves it', async () => {
    const manager = await ctx.api('post', '/users').send({ username: 'ac.manager', password: PASSWORD, displayName: 'Accounting manager', roles: ['accounting-manager'], email: 'ac.manager@example.ph' });
    const day = await today();
    const d = await ctx.api('post', '/access-control/delegations').send({ delegatorId: manager.body.data.userId, delegateId: ctx.userIds.checker,
      transactionTypes: ['journal_voucher'], dateFrom: day, dateTo: addDays(day, 30), reasonCode: 'DLG-LEAVE' });
    expect(d.status, JSON.stringify(d.body)).toBe(201);
    expect(await effectiveAuthority(pool, ctx.userIds.checker, 'journal_voucher')).toMatchObject({ limit: 1000000 });
    expect((await ctx.api('post', `/access-control/changes/${d.body.data.change.id}/decision`).send({ decision: 'approve' })).status).toBe(403);
    expect((await admin2('post', `/access-control/changes/${d.body.data.change.id}/decision`).send({ decision: 'approve' })).status).toBe(200);
    expect(await effectiveAuthority(pool, ctx.userIds.checker, 'journal_voucher')).toMatchObject({ unlimited: true, source: expect.stringMatching(/delegated by Accounting manager/) });
    expect(await effectiveAuthority(pool, ctx.userIds.checker, 'payment_voucher')).toMatchObject({ limit: 2000000 });
    const current = (await ctx.api('get', '/access-control/delegations')).body.data.rows.find((x) => x.delegateId === ctx.userIds.checker);
    expect(current).toMatchObject({ status: 'in-effect', transactionNames: ['Journal voucher approval'], reason: 'Vacation or annual leave', approvedBy: 'Second administrator' });
    expect((await ctx.api('post', `/access-control/delegations/${current.id}/end`).send({})).status).toBe(400);
    expect((await ctx.api('post', `/access-control/delegations/${current.id}/end`).send({ reasonCode: 'DLE-RETURNED' })).status).toBe(200);
    expect(await effectiveAuthority(pool, ctx.userIds.checker, 'journal_voucher')).toMatchObject({ limit: 1000000 });
  });
});

describe('segregation of duties', () => {
  it('blocks roles one person may not hold together and warns on the others', async () => {
    const blocked = await ctx.api('post', '/users').send({ username: 'ac.sod1', password: PASSWORD, displayName: 'Sod one', roles: ['processing', 'accounting'], email: 'ac.sod1@example.ph' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/Segregation of duties/);
    const warned = await ctx.api('post', '/users').send({ username: 'ac.sod2', password: PASSWORD, displayName: 'Sod two', roles: ['sales', 'accounting'], email: 'ac.sod2@example.ph' });
    expect(warned.status).toBe(201);
    expect(warned.body.message).toMatch(/Segregation of duties/);
    const check = await ctx.api('post', '/access-control/sod-check').send({ roles: ['claims', 'accounting'] });
    expect(check.body.data.filter((r) => r.kind === 'roles').map((r) => r.action)).toEqual(['block']);
    // and the access the two roles combine: registering claims with preparing payments (seed 91_role_access.sql)
    expect(check.body.data.filter((r) => r.kind === 'access').map((r) => [r.code, r.action])).toEqual([['SOD-ACC-CLAIM-PAY', 'warn']]);
  });
});

describe('matrices', () => {
  it('lists every user with roles and sign-in facts, and downloads it', async () => {
    const m = await ctx.api('get', '/access-control/user-matrix');
    const row = m.body.data.rows.find((u) => u.username === 'ac.sod2');
    expect(row.roles).toEqual(['accounting', 'sales']);
    expect(row.sodConflicts.filter((c) => c.kind === 'roles').map((c) => c.action)).toEqual(['warn']);
    expect(row.sodConflicts.filter((c) => c.kind === 'access').map((c) => c.name).sort()).toEqual(['Placing and paying insurers', 'Receipting and selling']);
    const file = await ctx.api('get', '/access-control/user-matrix?format=xlsx');
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/spreadsheetml/);
    const roles = await ctx.api('get', '/access-control/role-matrix');
    expect(roles.body.data.rows.find((p) => p.code === 'approve:access-control').grants['system-admin']).toBe(true);
  });
});

describe('access reviews and sessions', () => {
  it('reviews every active user; a removal applies when another administrator signs the review off', async () => {
    const started = await ctx.api('post', '/access-control/reviews').send({ name: 'Quarterly access review', dueDate: '2099-12-15' });
    expect(started.status).toBe(201);
    const id = started.body.data.id;
    const items = started.body.data.items;
    const target = items.find((i) => i.username === 'ac.sod2');
    expect((await ctx.api('post', `/access-control/reviews/${id}/items/${target.id}`).send({ decision: 'revoke' })).status).toBe(400);
    expect((await ctx.api('post', `/access-control/reviews/${id}/items/${target.id}`).send({ decision: 'revoke', reasonCode: 'ARV-LEFT' })).status).toBe(200);
    // the account stays as it is until the sign-off
    expect((await query('SELECT status FROM users WHERE username = $1', ['ac.sod2'])).rows[0].status).toBe('active');
    expect((await ctx.api('post', `/access-control/reviews/${id}/submit`)).status).toBe(409);
    const own = items.find((i) => i.username === 'BrokerVerse');
    expect((await ctx.api('post', `/access-control/reviews/${id}/items/${own.id}`).send({ outcome: 'keep' })).status).toBe(403);
    await admin2('post', `/access-control/reviews/${id}/items/${own.id}`).send({ outcome: 'keep', note: 'Built-in administrator' });
    const rest = items.filter((i) => ![target.id, own.id].includes(i.id)).map((i) => i.id);
    const kept = await ctx.api('post', `/access-control/reviews/${id}/items/keep`).send({ itemIds: rest, note: 'Confirmed with the department heads' });
    expect(kept.status).toBe(200);
    expect(kept.body.data.skipped).toEqual([]);
    expect((await ctx.api('post', `/access-control/reviews/${id}/close`)).status).toBe(409);
    const submitted = await ctx.api('post', `/access-control/reviews/${id}/submit`);
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
    expect(submitted.body.data.review.status).toBe('awaiting-signoff');
    // the administrator who decided the removal does not sign it off
    expect((await ctx.api('post', `/access-control/changes/${submitted.body.data.change.id}/decision`).send({ decision: 'approve' })).status).toBe(403);
    expect((await admin2('post', `/access-control/changes/${submitted.body.data.change.id}/decision`).send({ decision: 'approve' })).status).toBe(200);
    expect((await query('SELECT status FROM users WHERE username = $1', ['ac.sod2'])).rows[0].status).toBe('inactive');
    const closed = (await ctx.api('get', `/access-control/reviews/${id}`)).body.data;
    expect(closed).toMatchObject({ status: 'closed', deactivate: 1, pending: 0, applied: 1, signedOffBy: 'Second administrator' });
  });

  it('ends every session of a user', async () => {
    const token = await login('fin.maker');
    const before = await request(ctx.app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect((await ctx.api('post', `/access-control/users/${ctx.userIds.maker}/sign-out`)).status).toBe(200);
    expect((await request(ctx.app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('deactivates accounts with no sign-in for the dormant period, never the built-in administrator', async () => {
    await query("UPDATE users SET last_login_at = now() - interval '200 days' WHERE username IN ('fin.checker', 'BrokerVerse')");
    const r = await deactivateDormant(pool);
    expect(r.users).toContain('fin.checker');
    expect(r.users).not.toContain('BrokerVerse');
    await query("UPDATE users SET status = 'active', last_login_at = now() WHERE username = 'fin.checker'");
  });
});
