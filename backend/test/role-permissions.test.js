/**
 * Role Permissions (Master > Users and Access): the access catalogue in business words, the roles by department with
 * their own and included access, changes of a role's access through the approval of another administrator
 * (approve:access-control, never the requester), segregation-of-duties access rules, the Role form's permission list
 * as a change waiting for approval, the export for audit, My Work, and migrations 0391-0393 run twice.
 */
import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { PERMISSIONS, describe as describeCode } from '../src/modules/access-control/catalogue.js';

const PW = 'Welcome@123';
let ctx;
const as = {};
const ids = {};
const tokens = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
const own = async (role) => (await q(`SELECT p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
  WHERE r.code = $1 ORDER BY p.code`, [role])).map((r) => r.code);
const setApproval = async (on) => { await q("UPDATE app_settings SET value = $1 WHERE key = 'access.change_approval'", [JSON.stringify(on)]); clearSettingsCache(); };
const REASON = { reasonCode: 'ACC-REDESIGN' };

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: PW, displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = r.body.data.userId;
  tokens[username] = await loginAs(ctx.app, username, PW);
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tokens[username]}`);
}
const submit = (who, role, body) => as[who]('post', `/access-control/role-access/${role}/changes`).send({ ...REASON, ...body });
const overview = async (who = 'ra.it') => {
  const r = await as[who]('get', '/access-control/role-access');
  expect(r.status).toBe(200);
  return r.body.data;
};

beforeAll(async () => {
  ctx = await setup();
  for (const [u, roles] of [['ra.it', ['tis-it-admin']], ['ra.it2', ['tis-it-admin']], ['ra.fin', ['tis-finance']], ['ra.gm', ['tis-general-manager']],
    ['ra.mgr', ['accounting-manager']], ['ra.pdu', ['tis-ccd-pdu', 'tis-finance']]]) await persona(u, roles);
});
afterAll(async () => { await pool.end(); });

describe('access catalogue and overview', () => {
  it('describes every permission of the database in business words', async () => {
    const codes = (await q('SELECT code FROM permissions ORDER BY code')).map((r) => r.code);
    expect(codes.filter((c) => describeCode(c).area === 'other')).toEqual([]);
    expect(PERMISSIONS.map((p) => p.code).sort()).toEqual(codes);
    const o = await overview();
    const modules = new Map(o.catalogue.modules.map((m) => [m.code, m]));
    expect(o.catalogue.areas.map((a) => a.name)).toEqual(['Sales & Marketing', 'Operations', 'Accounts', 'Commission', 'Reports', 'Product Configurator',
      'Master data and configuration', 'Users and access', 'Basic and special access']);
    expect(modules.get('bank-reconciliation')).toMatchObject({ area: 'accounts', name: 'Bank reconciliation', levels: ['view', 'edit', 'approve'] });
    expect(modules.get('posting-rules').levels).toEqual(['edit', 'approve']);
    // the codes no route checks are not offered as levels
    expect(modules.get('audit').levels).toEqual(['view']);
    expect(modules.has('notifications')).toBe(true);
    expect(modules.get('notifications').levels).toEqual([]);
    expect(modules.get('pii').levels).toEqual(['special']);
  });

  it('lists the TISPH roles by department in the brief\'s order, the base roles as platform roles, with users and included access', async () => {
    const o = await overview();
    expect(o.departments.map((d) => d.name)).toEqual(['Sales', 'Operations', 'Cash Control', 'Finance and Accounting', 'IT', 'Management']);
    const tis = o.roles.filter((r) => r.department);
    expect(tis.map((r) => r.code)).toEqual(['tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head',
      'tis-ccd-pdu', 'tis-ccd-pdc', 'tis-ccd-bp', 'tis-ccd-recon', 'tis-finance', 'tis-it-admin', 'tis-superid', 'tis-general-manager']);
    const role = (code) => o.roles.find((r) => r.code === code);
    expect(o.roles.filter((r) => r.platform).map((r) => r.code)).toEqual(['system-admin', 'sales', 'processing', 'operations', 'claims', 'accounting', 'accounting-manager']);
    expect(role('tis-it-admin').users).toEqual({ active: 2, inactive: 0 });
    expect(role('tis-finance').users.active).toBe(2);
    expect(role('tis-superid')).toMatchObject({ fullAccess: true, included: {} });
    expect(role('system-admin').fullAccess).toBe(true);
    expect(role('accounting-manager').included['write:receipts']).toBe('accounting');
    expect(role('accounting-manager').own).not.toContain('write:receipts');
    expect(role('accounting').includedBy).toEqual(['accounting-manager']);
    expect(o.abilities).toEqual({ edit: true, approve: true });
    // what this user may change: not a full-access role, not a role they hold
    expect(role('tis-it-admin').editBlocked).toBe('own-role');
    expect(role('tis-superid').editBlocked).toBe('full-access');
    expect(role('tis-finance').editBlocked).toBeNull();
    const gm = await overview('ra.gm');
    expect(gm.roles.find((r) => r.code === 'tis-finance').editBlocked).toBe('no-permission');
    expect(gm.abilities).toEqual({ edit: false, approve: false });
  });

  it('is refused without read:access-control', async () => {
    expect((await as['ra.fin']('get', '/access-control/role-access')).status).toBe(403);
    expect((await as['ra.fin']('get', '/access-control/role-access/export')).status).toBe(403);
  });
});

describe('a change of a role\'s access', () => {
  let changeId;
  let before;

  it('waits for approval and changes nothing yet', async () => {
    before = await own('tis-finance');
    const r = await submit('ra.it', 'tis-finance', { grant: ['read:campaigns'], revoke: ['write:fixed-assets'], note: 'Campaign results for the budget' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const c = r.body.data.change;
    changeId = c.id;
    expect(c).toMatchObject({ kind: 'role-access', target: 'tis-finance', targetLabel: 'TIS Finance & General Accounting', status: 'pending', ref: `CFG-${c.id}`,
      canDecide: false, canWithdraw: true, summary: ['Added: Sales & Marketing › Marketing campaigns › View', 'Removed: Accounts › Fixed assets › Create and edit'] });
    expect(c.payload).toMatchObject({ grant: ['read:campaigns'], revoke: ['write:fixed-assets'], reasonCode: 'ACC-REDESIGN', reason: 'Role redesign: Campaign results for the budget' });
    expect(await own('tis-finance')).toEqual(before);
    const fin = (await overview()).roles.find((x) => x.code === 'tis-finance');
    expect(fin.pending.id).toBe(c.id);
    expect(fin.editBlocked).toBe('pending');
    const listed = await as['ra.it2']('get', '/access-control/changes?kind=role-access');
    expect(listed.body.data.find((x) => x.id === c.id)).toMatchObject({ canDecide: true, canWithdraw: true });
  });

  it('allows one change per role at a time', async () => {
    expect((await submit('ra.it2', 'tis-finance', { grant: ['read:sales-activities'] })).status).toBe(409);
  });

  it('is never approved by the requester, nor through the accounting approvals', async () => {
    const own1 = await as['ra.it']('post', `/access-control/changes/${changeId}/decision`).send({ decision: 'approve' });
    expect(own1.status).toBe(403);
    expect(own1.body.message).toMatch(/Maker-checker/);
    // Finance approves posting rules (approve:posting-rules), not changes of access
    expect((await as['ra.fin']('post', `/access-control/changes/${changeId}/decision`).send({ decision: 'approve' })).status).toBe(403);
    expect((await as['ra.fin']('post', `/posting-rules/changes/${changeId}/approve`).send({})).status).toBe(404);
    expect((await as['ra.fin']('get', '/posting-rules/changes')).body.data.map((x) => x.id)).not.toContain(changeId);
  });

  it('is on the My Work of the access approvers only', async () => {
    const it2 = await as['ra.it2']('get', '/my-work/items?category=approvals');
    expect(it2.status, JSON.stringify(it2.body)).toBe(200);
    expect(it2.body.data.find((i) => i.ref === `CFG-${changeId}`)).toMatchObject({ kind: 'Role access change', title: 'TIS Finance & General Accounting',
      link: `/master/generals/usermanagement/role-permissions?view=pending&change=${changeId}` });
    expect((await as['ra.it']('get', '/my-work/items?category=approvals')).body.data.map((i) => i.ref)).not.toContain(`CFG-${changeId}`);
    expect((await as['ra.mgr']('get', '/my-work/items?category=approvals')).body.data.map((i) => i.ref)).not.toContain(`CFG-${changeId}`);
  });

  it('is applied as a delta by another administrator and renews the sessions of the role\'s users', async () => {
    expect((await as['ra.fin']('get', '/journal-vouchers')).status).not.toBe(401);
    expect((await as['ra.it2']('post', `/access-control/changes/${changeId}/decision`).send({ decision: 'reject' })).status).toBe(400);
    const r = await as['ra.it2']('post', `/access-control/changes/${changeId}/decision`).send({ decision: 'approve' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.status).toBe('approved');
    expect(await own('tis-finance')).toEqual([...before.filter((c) => c !== 'write:fixed-assets'), 'read:campaigns'].sort());
    expect((await as['ra.fin']('get', '/journal-vouchers')).status).toBe(401);
    const audit = await q("SELECT before_data, after_data FROM audit_log WHERE entity = 'role' AND action = 'access-change' ORDER BY id DESC LIMIT 1");
    expect(audit[0].after_data).toMatchObject({ added: ['read:campaigns'], removed: ['write:fixed-assets'], change: `CFG-${changeId}` });
    expect(audit[0].before_data.permissions).toContain('write:fixed-assets');
    expect((await as['ra.it2']('post', `/access-control/changes/${changeId}/decision`).send({ decision: 'approve' })).status).toBe(409);
  });

  it('renews the sessions of the users of a role that includes the changed one', async () => {
    const r = await submit('ra.it', 'accounting', { grant: ['read:campaigns'] });
    expect(r.status).toBe(201);
    expect((await as['ra.mgr']('get', '/journal-vouchers')).status).toBe(200);
    expect((await as['ra.it2']('post', `/access-control/changes/${r.body.data.change.id}/decision`).send({ decision: 'approve' })).status).toBe(200);
    expect((await as['ra.mgr']('get', '/journal-vouchers')).status).toBe(401);
    tokens['ra.mgr'] = await loginAs(ctx.app, 'ra.mgr', PW);
    const me = await as['ra.mgr']('get', '/auth/profile');
    expect(me.body.data.permissions).toContain('read:campaigns');
  });

  it('is withdrawn by the requester and rejected with a reason', async () => {
    const a = await submit('ra.it', 'tis-ccd-pdu', { grant: ['read:collections'] });
    expect(a.status).toBe(201);
    const w = await as['ra.it']('post', `/access-control/changes/${a.body.data.change.id}/withdraw`);
    expect(w.status).toBe(200);
    expect(w.body.data.status).toBe('withdrawn');
    expect((await as['ra.it']('post', `/access-control/changes/${a.body.data.change.id}/withdraw`)).status).toBe(409);
    const b = await submit('ra.it', 'tis-ccd-pdu', { grant: ['read:collections'] });
    const rej = await as['ra.it2']('post', `/access-control/changes/${b.body.data.change.id}/decision`).send({ decision: 'reject', remarks: 'Not part of the PDU duties' });
    expect(rej.status).toBe(200);
    expect(rej.body.data).toMatchObject({ status: 'rejected', decisionRemarks: 'Not part of the PDU duties' });
    expect(await own('tis-ccd-pdu')).not.toContain('read:collections');
    const history = await as['ra.it']('get', '/access-control/changes?status=all&target=tis-ccd-pdu');
    expect(history.body.data.map((c) => c.status)).toEqual(['rejected', 'withdrawn']);
  });

  it('refuses what may not be asked', async () => {
    const status = async (who, role, body) => (await submit(who, role, body)).status;
    expect(await status('ra.it', 'system-admin', { grant: ['read:leads'] })).toBe(403);
    expect(await status('ra.it', 'tis-superid', { grant: ['read:leads'] })).toBe(403);
    expect(await status('ra.it', 'tis-it-admin', { grant: ['read:leads'] })).toBe(403);
    expect(await status('ra.gm', 'tis-finance', { grant: ['read:leads'] })).toBe(403);
    expect(await status('ra.it', 'tis-finance', { revoke: ['read:profile'] })).toBe(400);
    expect(await status('ra.it', 'tis-finance', { grant: ['read:everything'] })).toBe(400);
    expect(await status('ra.it', 'tis-finance', { grant: ['read:audit'] })).toBe(400);
    expect(await status('ra.it', 'tis-finance', { grant: ['read:leads'], reasonCode: 'PCL-OTHER' })).toBe(400);
    expect(await status('ra.it', 'tis-finance', { grant: ['read:leads'], reasonCode: 'ACC-OTHER' })).toBe(400);
    expect((await as['ra.it']('post', '/access-control/role-access/tis-finance/changes').send({ grant: ['read:leads'] })).status).toBe(400);
    // a grant the role has only through an included role is changed on that role
    const through = await submit('ra.it', 'accounting-manager', { revoke: ['write:receipts'] });
    expect(through.status).toBe(400);
    expect(through.body.errors[0].message).toMatch(/comes from Accounting/);
    expect(await status('ra.it', 'nobody', { grant: ['read:leads'] })).toBe(404);
    // the reasons of seed 91, readable by whoever may change a role's access
    const desk = await ctx.api('post', '/roles').send({ code: 'ra-desk', name: 'Role desk (test)', permissions: ['read:profile', 'write:roles'] });
    expect(desk.status).toBe(201);
    await persona('ra.desk', ['ra-desk']);
    const reasons = await as['ra.desk']('get', '/ops-masters/reason-code?status=Active&context=access_change');
    expect(reasons.status).toBe(200);
    expect(reasons.body.data.map((r) => r.code).sort()).toEqual(['ACC-AUDIT', 'ACC-CORRECT', 'ACC-DUTIES', 'ACC-OTHER', 'ACC-PROCESS', 'ACC-REDESIGN']);
    expect((await q("SELECT count(*)::int AS n FROM accounting_config_changes WHERE kind = 'role-access' AND status = 'pending'"))[0].n).toBe(0);
  });

  it('applies at once when the approval is switched off', async () => {
    await setApproval(false);
    try {
      const r = await submit('ra.it', 'tis-ccd-pdu', { grant: ['read:collections'] });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data).toMatchObject({ change: null, applied: { role: 'tis-ccd-pdu', grant: ['read:collections'] } });
      expect(await own('tis-ccd-pdu')).toContain('read:collections');
      expect((await q("SELECT count(*)::int AS n FROM accounting_config_changes WHERE kind = 'role-access' AND target = 'tis-ccd-pdu' AND status = 'pending'"))[0].n).toBe(0);
      const audit = await q("SELECT after_data FROM audit_log WHERE entity = 'role' AND action = 'access-change' ORDER BY id DESC LIMIT 1");
      expect(audit[0].after_data).toMatchObject({ added: ['read:collections'], change: null });
    } finally {
      await setApproval(true);
    }
  });
});

describe('segregation of duties on access', () => {
  it('warns for the role and for the users who would combine the access, and stores the warnings on the change', async () => {
    const check = await as['ra.it']('post', '/access-control/role-access/check').send({ role: 'tis-finance', grant: ['write:policies'] });
    expect(check.status).toBe(200);
    const byCode = Object.fromEntries(check.body.data.warnings.map((w) => [w.code, w]));
    // Finance prepares payments to insurers: issuing policies as well breaks the rule for the role itself
    expect(byCode['SOD-ACC-PLACE-PAY']).toMatchObject({ scope: 'role', action: 'warn', sideA: ['write:policies'] });
    // the user who also issues receipts (CCD-PDU) would combine receipting and selling
    expect(byCode['SOD-ACC-RCPT-SELL']).toMatchObject({ scope: 'users', users: ['ra.pdu'], more: 0 });
    expect(check.body.data).toMatchObject({ blocked: false, added: ['Operations › Policies › Create and edit'], affected: { users: 2, throughUsers: 0, throughRoles: [] } });
    const r = await submit('ra.it', 'tis-finance', { grant: ['write:policies'] });
    expect(r.status).toBe(201);
    expect(r.body.data.change.payload.warnings.map((w) => w.code).sort()).toEqual(['SOD-ACC-PLACE-PAY', 'SOD-ACC-RCPT-SELL']);
    // a rule switched to Block before the approval refuses it then
    await q("UPDATE sod_rules SET action = 'block' WHERE code = 'SOD-ACC-PLACE-PAY'");
    const d = await as['ra.it2']('post', `/access-control/changes/${r.body.data.change.id}/decision`).send({ decision: 'approve' });
    expect(d.status).toBe(409);
    expect(d.body.message).toMatch(/Placing and paying insurers/);
    expect((await submit('ra.it2', 'tis-sales-officer', { grant: ['write:remittance'] })).status).toBe(409);
    await as['ra.it']('post', `/access-control/changes/${r.body.data.change.id}/withdraw`);
    await q("UPDATE sod_rules SET action = 'warn' WHERE code = 'SOD-ACC-PLACE-PAY'");
  });

  it('keeps the rules on two roles and adds access rules on the Segregation of Duties screen', async () => {
    const rules = (await ctx.api('get', '/access-control/sod-rules')).body.data;
    expect(rules.find((s) => s.code === 'SOD-TIS-BP-RECON')).toMatchObject({ kind: 'roles', roleA: 'tis-ccd-bp', roleB: 'tis-ccd-recon' });
    expect(rules.find((s) => s.code === 'SOD-ACC-CLAIM-PAY')).toMatchObject({ kind: 'access', accessA: ['write:claims'],
      accessANames: ['Operations › Claims › Create and edit'], accessBNames: ['Accounts › Disbursements and petty cash › Create and edit'] });
    const added = await ctx.api('post', '/access-control/sod-rules').send({ code: 'SOD-ACC-TEST', name: 'Payables and payments', kind: 'access',
      accessA: ['approve:payables'], accessB: ['write:disbursements'], action: 'warn' });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect((await ctx.api('post', '/access-control/sod-rules').send({ code: 'SOD-ACC-BAD', name: 'Same on both sides', kind: 'access',
      accessA: ['write:claims'], accessB: ['write:claims'], action: 'warn' })).status).toBe(400);
    expect((await ctx.api('post', '/access-control/sod-rules').send({ code: 'SOD-ACC-BAD', name: 'One side', kind: 'access', accessA: ['write:claims'], accessB: [], action: 'warn' })).status).toBe(400);
    // Finance approves supplier invoices and prepares payments: the user matrix shows it
    const m = (await ctx.api('get', '/access-control/user-matrix')).body.data.rows.find((u) => u.username === 'ra.fin');
    expect(m.sodConflicts).toEqual(expect.arrayContaining([{ name: 'Payables and payments', action: 'warn', kind: 'access' }]));
    await ctx.api('delete', `/access-control/sod-rules/${added.body.data.id}`);
  });

  it('no TISPH role breaks a default access rule on its own', async () => {
    for (const code of ['tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head',
      'tis-ccd-pdu', 'tis-ccd-pdc', 'tis-ccd-bp', 'tis-ccd-recon', 'tis-it-admin', 'tis-general-manager']) {
      expect((await ctx.api('post', '/access-control/sod-check').send({ roles: [code] })).body.data.filter((s) => s.kind === 'access'), code).toEqual([]);
    }
  });
});

describe('the Role form', () => {
  it('sends a new permission list for approval while the approval is on, keeping Basic access', async () => {
    const before = await own('tis-ccd-pdc');
    const r = await as['ra.it']('put', '/roles/tis-ccd-pdc').send({ name: 'CCD-PDC / CCD-ADA', permissions: ['read:receipts', 'write:receipts'] });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toMatch(/waits for approval \(request CFG-\d+\)/);
    expect(r.body.data.change).toMatchObject({ changeNote: 'Changed on the Role form', payload: { grant: [] } });
    expect(r.body.data.change.payload.revoke).not.toContain('read:profile');
    expect(await own('tis-ccd-pdc')).toEqual(before);
    await as['ra.it']('post', `/access-control/changes/${r.body.data.change.id}/withdraw`);
    // the name alone is saved at once
    expect((await as['ra.it']('put', '/roles/tis-ccd-pdc').send({ name: 'CCD-PDC / CCD-ADA' })).body.message).toBe('Role updated');
  });
});

describe('export for audit', () => {
  it('downloads the workbook of the chosen roles and the first sheet as CSV', async () => {
    const r = await binary(as['ra.gm']('get', '/access-control/role-access/export?roles=tis-sales-associate,tis-sales-officer'));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/spreadsheetml/);
    const sheets = readWorkbook(r.body);
    expect(sheets.map((s) => s.name)).toEqual(['Access by role', 'Matrix', 'Waiting for approval', 'Permission codes']);
    const byRole = sheets[0].rows.filter((x) => x.length);
    const header = byRole.findIndex((x) => x[0] === 'Role');
    expect(byRole[header]).toEqual(['Role', 'Department', 'Role status', 'Area', 'Module', 'Level', 'Granted', 'How', 'Pending', 'Active users']);
    expect(byRole.slice(header + 1).find((x) => x[0] === 'TIS Sales Officer' && x[4] === 'Quotations and placement' && x[5] === 'Approve').slice(6, 8)).toEqual(['Yes', 'Own']);
    expect(new Set(byRole.slice(header + 1).map((x) => x[0]))).toEqual(new Set(['TIS Sales Associate', 'TIS Sales Officer']));
    expect(sheets[1].rows[0]).toEqual(['Area', 'Module', 'TIS Sales Associate', 'TIS Sales Officer']);
    expect(sheets[3].rows.find((x) => x[0] === 'write:audit').slice(-1)).toEqual(['No']);
    const csv = await as['ra.gm']('get', '/access-control/role-access/export?format=csv&base=1');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('Role,Department,Role status,Area,Module,Level,Granted,How,Pending,Active users');
    expect(csv.text).toContain('Accounting Manager,Base platform roles,Active,Accounts,Receipts,Create and edit,Yes,Through Accounting');
  });
});

describe('migrations 0391-0393 on a database in use', () => {
  it('change nothing when run again', async () => {
    const state = async () => ({
      settings: await q("SELECT key, value FROM app_settings WHERE key IN ('access.role_groups', 'access.platform_roles', 'access.change_approval') ORDER BY key"),
      rules: await q('SELECT code, kind, role_a, role_b, access_a, access_b FROM sod_rules ORDER BY code'),
      perm: await q("SELECT description FROM permissions WHERE code = 'approve:access-control'"),
    });
    const first = await state();
    for (const f of ['0391_role_directory.sql', '0392_access_change_approval.sql', '0393_sod_access_rules.sql']) {
      await pool.query(fs.readFileSync(new URL(`../src/db/migrations/${f}`, import.meta.url), 'utf8'));
    }
    expect(await state()).toEqual(first);
    expect(first.perm[0].description).toBe('Approve role access changes and authority limits proposed by another administrator');
  });
});
