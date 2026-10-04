import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { migrate } from '../src/db/migrate.js';
import { seed, ROLES, RETIRED_ROLES } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/pool.js';
import { loginAs } from './helpers.js';

/**
 * Migration 0140 (broker role model) on a database of the previous release: the old role codes with their permissions,
 * users assigned to them, and the old codes in settings, the report catalogue, role inheritance and master data.
 */
const OLD_ROLES = {
  'it-admin': null, ba: null,
  sales: ['read:leads', 'write:leads', 'read:clients', 'write:clients', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies', 'read:profile', 'write:profile'],
  underwriting: ['read:profile', 'write:profile', 'read:leads', 'read:clients', 'write:clients', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies',
    'read:endorsements', 'write:endorsements', 'read:renewals', 'write:renewals', 'read:reinsurance', 'write:reinsurance', 'read:products', 'write:products',
    'read:reports', 'write:reports', 'read:notifications', 'write:notifications', 'read:masters', 'read:claims'],
  'customer-services': ['read:profile', 'write:profile', 'read:leads', 'write:leads', 'read:clients', 'write:clients', 'read:quotations', 'write:quotations'],
  claims: ['read:profile', 'write:profile', 'read:claims', 'write:claims'],
  finance: ['read:profile', 'write:profile', 'read:receipts', 'write:receipts', 'read:period-end', 'write:period-end', 'read:reports'],
  'finance-manager': ['approve:period-end'],
  agent: ['read:profile', 'write:profile', 'read:leads', 'write:leads', 'read:quotations', 'write:quotations'],
  'user-access-admin': ['read:profile', 'write:profile', 'read:users', 'write:users', 'read:roles', 'write:roles', 'read:audit'],
};
const OLD_USERS = [['old.uw', ['underwriting']], ['old.cs', ['customer-services']], ['old.fin', ['finance']], ['old.finmgr', ['finance-manager']],
  ['old.agent', ['agent']], ['old.agentsales', ['agent', 'sales']], ['old.ba', ['ba']], ['old.uaa', ['user-access-admin']], ['old.itba', ['it-admin', 'ba']]];
const PW = 'Old-Roles#2026';
const OLD_CODE_RE = /"(underwriting|customer-services|finance|finance-manager|it-admin|ba|user-access-admin|agent)"/;
const MIGRATION = fs.readFileSync(new URL('../src/db/migrations/0140_broker_roles.sql', import.meta.url), 'utf8');

const permsOf = async (username) => (await query(`SELECT DISTINCT p.code FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id WHERE u.username = $1 ORDER BY 1`, [username])).rows.map((r) => r.code);
const rolesOf = async (username) => (await query(`SELECT r.code FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
  WHERE u.username = $1 ORDER BY 1`, [username])).rows.map((r) => r.code);

let before;
beforeAll(async () => {
  // The schema of this release, then the data as the previous release left it.
  await migrate({ reset: true, log: () => {} });
  for (const m of ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'claims', 'renewals', 'receipts', 'reinsurance', 'products', 'reports', 'notifications', 'masters', 'period-end', 'users', 'roles', 'audit']) {
    for (const a of ['read', 'write', 'approve']) await query('INSERT INTO permissions(code, module) VALUES ($1,$2) ON CONFLICT DO NOTHING', [`${a}:${m}`, m]);
  }
  for (const [code, perms] of Object.entries(OLD_ROLES)) {
    const r = await query('INSERT INTO roles(code, name, is_system, inherits) VALUES ($1,$2,$3,$4) RETURNING id',
      [code, `Old ${code}`, ['it-admin', 'ba', 'user-access-admin'].includes(code), code === 'finance-manager' ? ['finance'] : []]);
    await query(`INSERT INTO role_permissions(role_id, permission_id) SELECT $1, id FROM permissions ${perms ? 'WHERE code = ANY($2)' : ''}`, perms ? [r.rows[0].id, perms] : [r.rows[0].id]);
  }
  for (const [username, roles] of OLD_USERS) {
    await query("INSERT INTO users(username, password_hash, display_name, status) VALUES ($1, crypt($2, gen_salt('bf', 8)), $1, 'active')", [username, PW]);
    await query('INSERT INTO user_roles(user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.username = $1 AND r.code = ANY($2)', [username, roles]);
  }
  const settings = { 'security.scoped_roles': ['agent'], 'security.require_2fa_roles': ['it-admin', 'ba', 'finance'], 'quotations.approval_notify_roles': ['underwriting'],
    'renewals.approver_roles': ['underwriting', 'customer-services'], 'incentive.eligible_roles': ['agent', 'sales'], 'commission.eligible_roles': ['agent', 'sales'] };
  for (const [key, value] of Object.entries(settings)) {
    await query(`INSERT INTO app_settings(key, value, "group", label, type) VALUES ($1, $2, 'x', $1, 'json')`, [key, JSON.stringify(value)]);
  }
  await query("UPDATE report_definitions SET roles = ARRAY['finance','underwriting','sales','agent','customer-services']");
  await query("INSERT INTO master_types(code, label, category) VALUES ('transaction-code', 'Transaction Code', 'finance') ON CONFLICT DO NOTHING");
  await query(`INSERT INTO master_records(type_code, code, name, data, status) VALUES ('transaction-code', 'OR', 'Official Receipt',
    '{"TransactionCode":"OR","userGroupAccess":[{"UserRole":"finance","MaximumTransaction":1000},{"UserRole":"agent"},{"UserRole":"claims"}]}', 'active')`);
  before = { uwPerms: await permsOf('old.uw'), finPerms: await permsOf('old.fin'), csPerms: await permsOf('old.cs') };
  await query(MIGRATION);
});
afterAll(async () => { await pool.end(); });

describe('migration 0140: broker role model on an existing database', () => {
  it('moves each user to the new role with the same permissions', async () => {
    expect(await rolesOf('old.uw')).toEqual(['processing']);
    expect(await permsOf('old.uw')).toEqual(before.uwPerms);
    expect(await rolesOf('old.cs')).toEqual(['operations']);
    expect(await permsOf('old.cs')).toEqual(before.csPerms);
    expect(await rolesOf('old.fin')).toEqual(['accounting']);
    expect(await permsOf('old.fin')).toEqual(before.finPerms);
    expect(await rolesOf('old.finmgr')).toEqual(['accounting-manager']);
    expect((await query("SELECT inherits FROM roles WHERE code = 'accounting-manager'")).rows[0].inherits).toEqual(['accounting']);
  });
  it('merges the three administrator roles into system-admin and the agent role into sales', async () => {
    for (const u of ['old.ba', 'old.uaa', 'old.itba']) expect(await rolesOf(u)).toEqual(['system-admin']);
    const all = Number((await query('SELECT count(*) FROM permissions')).rows[0].count);
    expect((await permsOf('old.uaa')).length).toBe(all);
    expect(await rolesOf('old.agent')).toEqual(['sales']);
    expect(await rolesOf('old.agentsales')).toEqual(['sales']);
    const sa = (await query("SELECT is_system, name FROM roles WHERE code = 'system-admin'")).rows[0];
    expect(sa).toEqual({ is_system: true, name: 'System Administrator (Super Admin Access)' });
  });
  it('rewrites the settings, the report catalogue and the master data', async () => {
    const s = Object.fromEntries((await query("SELECT key, value FROM app_settings WHERE key LIKE '%roles'")).rows.map((r) => [r.key, r.value]));
    expect(s).toEqual({ 'security.scoped_roles': [], 'security.require_2fa_roles': ['system-admin', 'accounting'], 'quotations.approval_notify_roles': ['processing'],
      'renewals.approver_roles': ['processing', 'operations'], 'incentive.eligible_roles': ['sales'], 'commission.eligible_roles': ['sales'] });
    const reports = (await query('SELECT DISTINCT roles FROM report_definitions')).rows.map((r) => r.roles);
    expect(reports).toEqual([['accounting', 'processing', 'sales', 'operations']]);
    const md = (await query("SELECT data FROM master_records WHERE type_code = 'transaction-code' AND code = 'OR'")).rows[0].data;
    expect(md.userGroupAccess).toEqual([{ UserRole: 'accounting', MaximumTransaction: 1000 }, { UserRole: 'sales' }, { UserRole: 'claims' }]);
  });
  it('leaves no old role code anywhere and is idempotent', async () => {
    const check = async () => {
      expect((await query('SELECT code FROM roles WHERE code = ANY($1)', [RETIRED_ROLES])).rows).toEqual([]);
      expect((await query('SELECT key FROM app_settings')).rows.length).toBeGreaterThan(0);
      const settings = (await query('SELECT key, value::text AS v FROM app_settings')).rows.filter((r) => OLD_CODE_RE.test(r.v));
      expect(settings).toEqual([]);
      expect((await query('SELECT code FROM report_definitions WHERE roles && $1', [RETIRED_ROLES])).rows).toEqual([]);
      expect((await query('SELECT code FROM roles WHERE inherits && $1', [RETIRED_ROLES])).rows).toEqual([]);
      expect((await query("SELECT code FROM master_records WHERE data::text ~ '\"UserRole\": \"(finance|agent|underwriting|customer-services|it-admin|ba|user-access-admin|finance-manager)\"'")).rows).toEqual([]);
    };
    await check();
    const snapshot = async () => (await query(`SELECT (SELECT json_agg(r ORDER BY r.id) FROM (SELECT id, code, name, inherits FROM roles) r)::text AS roles,
      (SELECT json_agg(x ORDER BY x.user_id, x.role_id) FROM user_roles x)::text AS ur, (SELECT json_agg(s ORDER BY s.key) FROM (SELECT key, value FROM app_settings) s)::text AS st`)).rows[0];
    const first = await snapshot();
    await query(MIGRATION);
    expect(await snapshot()).toEqual(first);
    await check();
  });
  it('the seed then completes the roles without recreating an old code, and the migrated users sign in with the new roles', async () => {
    await seed({ log: () => {}, sampleData: false });
    const codes = (await query('SELECT code FROM roles ORDER BY code')).rows.map((r) => r.code);
    expect(codes).toEqual(ROLES.map((r) => r[0]).sort());
    const app = await createApp();
    const token = await loginAs(app, 'old.uw', PW);
    const me = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.roles).toEqual(['processing']);
    const mgr = await loginAs(app, 'old.finmgr', PW);
    const p = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${mgr}`);
    expect(p.body.data.roles).toEqual(['accounting', 'accounting-manager']);
  });
});
