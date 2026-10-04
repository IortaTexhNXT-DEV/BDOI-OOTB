import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
let token;
let userId;
let managerId;
const me = (m) => request(ctx.app)[m]('/api/auth/profile').set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ctx = await setup();
  const mgr = await ctx.api('post', '/users').send({ username: 'mp.manager', password: 'Welcome@123', displayName: 'Maria Reyes', roles: ['processing'] });
  managerId = mgr.body.data.userId;
  const r = await ctx.api('post', '/users').send({
    username: 'mp.staff', password: 'Welcome@123', displayName: 'Juan Santos', firstName: 'Juan', lastName: 'Santos', email: 'mp.staff@example.ph',
    branchCode: 'HO', designation: 'Underwriter', reportingTo: managerId, roles: ['processing'], mustChangePassword: false,
  });
  expect(r.status).toBe(201);
  userId = r.body.data.userId;
  token = await loginAs(ctx.app, 'mp.staff', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });

describe('My Profile (GET / PUT /auth/profile)', () => {
  it('shows identity and access read-only: roles by name, branch, designation, reporting line', async () => {
    const r = await me('get');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      userId, username: 'mp.staff', displayName: 'Juan Santos', branchCode: 'HO', designation: 'Underwriter', reportingTo: managerId,
      reportingToName: 'Maria Reyes', roles: ['processing'], roleCodes: ['processing'], status: 'active', emailEditable: false, country: null,
    });
    expect(r.body.data.roleNames[0]).toMatch(/Processing/);
    expect(r.body.data.branchName).toBeTruthy();
    expect(r.body.data.permissions.length).toBeGreaterThan(0);
  });

  it('saves the personal, contact and address details (audited) and ignores identity fields', async () => {
    const r = await me('put').send({
      phone: '0917 123 4567', dateOfBirth: '1988-03-21', gender: 'male', addressLine: 'Unit 1204, 88 Ayala Avenue', barangay: 'Bel-Air',
      city: 'Makati', province: 'Metro Manila', zipCode: '1226', country: 'Philippines',
      username: 'hacker', roles: ['system-admin'], branchCode: 'CEB', designation: 'Accountant', reportingTo: null, status: 'inactive',
    });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      username: 'mp.staff', roles: ['processing'], branchCode: 'HO', designation: 'Underwriter', reportingTo: managerId, status: 'active',
      phone: '09171234567', dateOfBirth: '1988-03-21', gender: 'male', city: 'Makati', zipCode: '1226', country: 'Philippines',
    });
    const a = (await query("SELECT before_data AS before, after_data AS after FROM audit_log WHERE entity = 'user' AND entity_id = $1 AND action = 'update-profile' ORDER BY id DESC LIMIT 1", [userId])).rows[0];
    expect(a.after).toMatchObject({ phone: '09171234567', city: 'Makati' });
    expect(a.before).toMatchObject({ phone: null, city: null });
  });

  it('clears an optional field with an empty value', async () => {
    const r = await me('put').send({ barangay: '', gender: '' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ barangay: null, gender: null, city: 'Makati' });
  });

  it('validates the Philippine contact number, ZIP code and date of birth', async () => {
    const r = await me('put').send({ phone: '12345', zipCode: '12', dateOfBirth: '2999-01-01', gender: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.errors.map((e) => e.path).sort()).toEqual(['dateOfBirth', 'gender', 'phone', 'zipCode']);
    expect((await me('put').send({ country: 'Singapore', zipCode: '018989' })).status).toBe(200);
    expect((await me('put').send({ phone: '+63 2 8123 4567' })).status).toBe(200);
  });

  it('changes the e-mail address only when security.profile_email_editable is on', async () => {
    const refused = await me('put').send({ email: 'other@example.ph' });
    expect(refused.status).toBe(403);
    expect((await me('put').send({ email: 'mp.staff@example.ph' })).status).toBe(200);
    await query("UPDATE app_settings SET value = 'true' WHERE key = 'security.profile_email_editable'");
    clearSettingsCache();
    const ok = await me('put').send({ email: 'juan.santos@example.ph' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ email: 'juan.santos@example.ph', emailEditable: true });
    await query("UPDATE app_settings SET value = 'false' WHERE key = 'security.profile_email_editable'");
    clearSettingsCache();
  });
});
