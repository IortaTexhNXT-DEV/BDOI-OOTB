/**
 * TISPH roles (Pre-BSM M17 RBAC v4, migration 0348 and db/seed.js): the 13 TIS personas and SUPERID with their
 * permission sets, the same on a new database and on one in use; Sales and Operations both make, and the approvals
 * of the front office belong to another user holding approve:quotations / approve:policies / approve:renewals /
 * approve:claims; SUPERID includes the System Administrator and only an administrator grants it; the report catalogue
 * and role-list settings name the TISPH roles.
 */
import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { ROLES, ROLE_PERMISSIONS } from '../src/db/seed.js';

const TIS_ROLES = ['tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-ccd-pdu',
  'tis-ccd-pdc', 'tis-ccd-bp', 'tis-ccd-recon', 'tis-finance', 'tis-it-admin', 'tis-general-manager', 'tis-superid'];
const MIGRATION = fs.readFileSync(new URL('../src/db/migrations/0348_tisph_roles.sql', import.meta.url), 'utf8');

let ctx;
const as = {};
const ids = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const grants = async () => Object.fromEntries((await q(`SELECT r.code, COALESCE(array_agg(p.code ORDER BY p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS perms
  FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id GROUP BY r.code`)).map((r) => [r.code, r.perms]));

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  ids[username] = r.body.data.userId;
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  for (const [u, roles] of [['tis.sa', ['tis-sales-associate']], ['tis.so', ['tis-sales-officer']], ['tis.oa', ['tis-ops-associate']], ['tis.ouh', ['tis-ops-unit-head']],
    ['tis.bp', ['tis-ccd-bp']], ['tis.pdu', ['tis-ccd-pdu']], ['tis.it', ['tis-it-admin']], ['tis.gm', ['tis-general-manager']], ['tis.fin', ['tis-finance']]]) await persona(u, roles);
});
afterAll(async () => { await pool.end(); });

describe('TISPH roles of a new database', () => {
  it('creates the 13 TIS personas and SUPERID with their names; the CCD-PDC / CCD-ADA role carries both labels', async () => {
    const roles = await q('SELECT code, name, description, inherits, status FROM roles WHERE code LIKE \'tis-%\' ORDER BY id');
    expect(roles.map((r) => r.code)).toEqual(TIS_ROLES);
    expect(roles.every((r) => r.status === 'active' && r.name && r.description.startsWith('RBAC v4'))).toBe(true);
    const pdc = roles.find((r) => r.code === 'tis-ccd-pdc');
    expect(pdc.name).toBe('CCD-PDC / CCD-ADA');
    expect(pdc.description).toContain('CCD-PDC');
    expect(pdc.description).toContain('CCD-ADA');
    expect(roles.find((r) => r.code === 'tis-superid').inherits).toEqual(['system-admin']);
    // the base roles come first, as before
    expect((await q('SELECT code FROM roles ORDER BY id LIMIT 7')).map((r) => r.code)).toEqual(ROLES.slice(0, 7).map((r) => r[0]));
  });

  it('grants each role the permission set of the seed, and keeps the approvals off the makers', async () => {
    const g = await grants();
    for (const code of TIS_ROLES.filter((c) => c !== 'tis-superid')) expect(g[code], code).toEqual([...ROLE_PERMISSIONS[code]].sort());
    for (const maker of ['tis-sales-associate', 'tis-ops-associate', 'tis-ops-officer']) {
      expect(g[maker]).toEqual(expect.arrayContaining(['write:quotations', 'write:policies', 'write:endorsements', 'write:renewals']));
      expect(g[maker].filter((p) => ['approve:quotations', 'approve:policies', 'approve:renewals'].includes(p))).toEqual([]);
    }
    for (const approver of ['tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-unit-head', 'tis-general-manager']) {
      expect(g[approver]).toEqual(expect.arrayContaining(['approve:quotations', 'approve:policies', 'approve:renewals']));
    }
    // IT administers and reads: no business write
    expect(g['tis-it-admin'].filter((p) => /^write:(leads|clients|quotations|policies|endorsements|renewals|claims|receipts|collections|remittance|disbursements|journal-vouchers)$/.test(p))).toEqual([]);
    // the broker roles keep the decisions they made before
    for (const role of ['sales', 'processing', 'operations']) expect(g[role]).toEqual(expect.arrayContaining(['approve:quotations', 'approve:policies', 'approve:renewals']));
    expect(g.claims).toContain('approve:claims');
  });

  it('names the TISPH roles in the report catalogue and the role-list settings', async () => {
    const [receipts] = await q("SELECT roles FROM report_definitions WHERE code = 'receipts-register'");
    expect(receipts.roles).toEqual(expect.arrayContaining(['accounting', 'tis-finance', 'tis-ccd-bp', 'tis-general-manager']));
    expect(receipts.roles).not.toContain('tis-sales-associate');
    const [production] = await q("SELECT roles FROM report_definitions WHERE code = 'production-register'");
    expect(production.roles).toEqual(expect.arrayContaining(['sales', 'tis-sales-associate', 'tis-ops-unit-head']));
    const setting = async (key) => (await q('SELECT value FROM app_settings WHERE key = $1', [key]))[0].value;
    expect(await setting('quotations.approval_notify_roles')).toEqual(['processing', 'tis-sales-unit-head', 'tis-ops-unit-head']);
    expect(await setting('renewals.approver_roles')).toEqual(['processing', 'tis-sales-unit-head', 'tis-ops-unit-head']);
    // CCD-BP sees the receipts register; the trial balance needs read:period-end
    const catalogue = (await as['tis.bp']('get', '/reports')).body.data.map((r) => r.code);
    expect(catalogue).toContain('receipts-register');
    expect(catalogue).not.toContain('trial-balance');
    expect((await as['tis.fin']('get', '/reports')).body.data.map((r) => r.code)).toContain('trial-balance');
  });
});

describe('makers and approvers', () => {
  it('lists each role with its department on the user form, marks the platform roles and names who changed a role last', async () => {
    const by = Object.fromEntries((await ctx.api('get', '/roles')).body.data.map((r) => [r.code, r]));
    expect(by['tis-sales-associate']).toMatchObject({ department: 'Sales', platform: false, modifiedBy: null });
    expect(by['tis-sales-associate'].summary).toMatch(/no approvals/);
    expect(by['tis-ccd-recon'].department).toBe('Cash Control');
    expect(by['tis-finance'].department).toBe('Finance and Accounting');
    expect(by['tis-superid'].department).toBe('IT');
    expect(by['tis-general-manager'].department).toBe('Management');
    expect(by['tis-sales-unit-head'].groupOrder).toBeLessThan(by['tis-ops-associate'].groupOrder);
    for (const code of ['system-admin', 'sales', 'processing', 'operations', 'claims', 'accounting', 'accounting-manager']) {
      expect(by[code], code).toMatchObject({ platform: true, department: null });
    }
    const created = await ctx.api('post', '/roles').send({ code: 'tis-test-desk', name: 'Test desk', permissions: ['read:leads'] });
    expect((await ctx.api('put', `/roles/${created.body.data.id}`).send({ name: 'Test desk (renamed)' })).status).toBe(200);
    const desk = (await ctx.api('get', '/roles')).body.data.find((r) => r.code === 'tis-test-desk');
    expect(desk).toMatchObject({ name: 'Test desk (renamed)', department: null, platform: false, modifiedBy: 'BrokerVerse Administrator' });
    expect(desk.modifiedAt).toBeTruthy();
    expect((await q('SELECT status FROM roles WHERE code = $1', ['sales']))[0].status).toBe('active');
  });

  it('Sales and Operations both raise; the approval needs approve:quotations and another user', async () => {
    const lead = await as['tis.sa']('post', '/leads').send({ firstName: 'Maker', lastName: 'Test', emailId: 'maker@example.ph', contactNumber: '09170001111', leadCategory: 'Retail' });
    expect(lead.status).toBe(201);
    // Operations reads prospects but does not create them
    expect((await as['tis.oa']('post', '/leads').send({ firstName: 'X' })).status).toBe(403);
    // qt_sls_11 (sample): accepted by the customer, made by the administrator
    const associate = await as['tis.sa']('patch', '/quotations/qt_sls_11/status').send({ status: 'Approved' });
    expect(associate.status).toBe(403);
    expect(associate.body.message).toContain('approve:quotations');
    expect((await as['tis.oa']('patch', '/quotations/qt_sls_11/status').send({ status: 'Approved' })).status).toBe(403);
    const officer = await as['tis.so']('patch', '/quotations/qt_sls_11/status').send({ status: 'Approved' });
    expect(officer.status).toBe(200);
    expect(officer.body.quotationStatus || officer.body.data?.quotationStatus).toBe('Approved');
  });

  it('the check of a placement against the slip needs approve:policies', async () => {
    expect((await as['tis.oa']('post', '/placements/plc_none/check').send({ decision: 'confirm' })).status).toBe(403);
    expect((await as['tis.ouh']('post', '/placements/plc_none/check').send({ decision: 'confirm' })).status).toBe(404);
  });

  it('renewal terms are approved with approve:renewals', async () => {
    // rnw_crs_15 (sample): pending approval
    const associate = await as['tis.oa']('post', '/renewals/rnw_crs_15/approve').send({ decision: 'approve' });
    expect(associate.status).toBe(403);
    const head = await as['tis.ouh']('post', '/renewals/rnw_crs_15/approve').send({ decision: 'approve' });
    expect(head.status).toBe(200);
  });

  it('claim decisions need approve:claims: the Operations Unit Head decides, the Associate registers and follows up', async () => {
    expect((await as['tis.oa']('put', '/claims/rejectclaim/clm_crs_01').send({ reason: 'Not covered' })).status).toBe(403);
    expect((await as['tis.oa']('get', '/claims/clm_crs_01')).status).toBe(200);
    const r = await as['tis.ouh']('put', '/claims/updatestatus/clm_crs_01').send({ claimStatus: 'in-review', note: 'Documents complete' });
    expect(r.status).toBe(200);
  });

  it('IT administers and reads but enters no business transaction', async () => {
    expect((await as['tis.it']('get', '/leads')).status).toBe(200);
    expect((await as['tis.it']('post', '/leads').send({ firstName: 'X' })).status).toBe(403);
    expect((await as['tis.it']('get', '/users')).status).toBe(200);
    expect((await as['tis.it']('post', '/ops-masters/cancellation-reason').send({ code: 'CAN-TEST', name: 'Test reason', initiatedBy: 'insured', method: 'auto' })).status).toBe(201);
  });
});

describe('SUPERID', () => {
  it('only a System Administrator grants it or changes it; its holder is an administrator while the role is active', async () => {
    const denied = await as['tis.it']('post', '/users').send({ username: 'uat.super', password: 'Welcome@123', displayName: 'UAT', email: 'uat@example.ph', roles: ['tis-superid'] });
    expect(denied.status).toBe(403);
    expect(denied.body.message).toContain('includes it');
    expect((await as['tis.it']('put', '/users/' + ids['tis.gm']).send({ roles: ['tis-superid'] })).status).toBe(403);
    expect((await as['tis.it']('put', '/roles/tis-superid').send({ permissions: [] })).status).toBe(403);
    await persona('uat.super', ['tis-superid']);
    const me = await as['uat.super']('get', '/auth/profile');
    expect(me.body.data.roles).toEqual(expect.arrayContaining(['tis-superid', 'system-admin']));
    expect((await as['uat.super']('put', '/settings').send({ settings: { 'leads.source_list_only': false } })).status).toBe(200);
    await q("UPDATE roles SET status = 'inactive' WHERE code = 'tis-superid'");
    const token = await loginAs(ctx.app, 'uat.super', 'Welcome@123');
    const after = await request(ctx.app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(after.body.data.roles).toEqual([]);
    await q("UPDATE roles SET status = 'active' WHERE code = 'tis-superid'");
  });
});

describe('migration 0348 on a database in use', () => {
  it('adds the roles and grants the seed gives, and changes nothing when run again', async () => {
    const seeded = await grants();
    await q('DELETE FROM roles WHERE code LIKE \'tis-%\' AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role_id = roles.id)');
    await q('DELETE FROM role_permissions rp USING roles r WHERE r.id = rp.role_id AND r.code LIKE \'tis-%\'');
    await q("DELETE FROM permissions WHERE code IN ('approve:quotations', 'approve:policies', 'approve:renewals', 'approve:claims')");
    await q("DELETE FROM schema_migrations WHERE name = '0348_tisph_roles.sql'");
    // later migrations that grant to the holders of a module permission (0387: approve:incentive) run again after it
    await q("DELETE FROM schema_migrations WHERE name = '0387_incentive_approval.sql'");
    await migrate({ log: () => {} });
    const migrated = await grants();
    for (const code of [...TIS_ROLES, 'sales', 'processing', 'operations', 'claims']) expect(migrated[code], code).toEqual(seeded[code]);
    expect((await q("SELECT inherits FROM roles WHERE code = 'tis-superid'"))[0].inherits).toEqual(['system-admin']);
    await pool.query(MIGRATION);
    expect(await grants()).toEqual(migrated);
  });
});
