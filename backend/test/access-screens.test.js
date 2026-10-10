/**
 * Delegations, Segregation of Duties, Access Reviews and the User Access Matrix (Master > Users and Access) with the
 * TISPH roles: every change of access goes through the approval of another administrator, the refusals (wrong
 * permission, approving one's own change, the person concerned deciding), and the flows end to end.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { effectiveAuthority } from '../src/modules/access-control/service.js';

const PASSWORD = 'Welcome@123';
let ctx;
let day;
const ids = {};
const as = {};
const setting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
const decide = (who, change, decision = 'approve', remarks) => as[who]('post', `/access-control/changes/${change}/decision`).send({ decision, remarks });

async function persona(username, roles, displayName = username) {
  const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName, roles, email: `${username}@example.ph` });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = r.body.data.userId;
  const token = await loginAs(ctx.app, username, PASSWORD);
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  as.admin = ctx.api;
  ids.admin = (await query("SELECT id FROM users WHERE username = 'BrokerVerse'")).rows[0].id;
  day = await today();
  await persona('it.one', ['tis-it-admin'], 'IT One');
  await persona('it.two', ['tis-it-admin'], 'IT Two');
  await persona('fin.one', ['tis-finance'], 'Mariela Valentino');
  await persona('fin.two', ['tis-finance'], 'Chrystal Malinay');
  await persona('ccd.bp', ['tis-ccd-bp'], 'Marta Dapula');
  await persona('ccd.both', ['tis-ccd-bp', 'tis-ccd-recon'], 'Gene Jaen');
  await persona('gm.one', ['tis-general-manager'], 'General Manager');
  await persona('sales.one', ['tis-sales-associate'], 'Sales One');
});
afterAll(async () => { await pool.end(); });

describe('delegations', () => {
  it('offers the approvers and the transactions each can approve', async () => {
    const o = (await as['it.one']('get', '/access-control/delegations/options')).body.data;
    expect(o.types.map((t) => t.code)).toContain('journal_voucher');
    expect(o.people.find((p) => p.id === ids['fin.one'])).toMatchObject({ department: 'Finance and Accounting', approves: expect.arrayContaining(['journal_voucher']) });
    expect(o.people.find((p) => p.id === ids['sales.one']).approves).not.toContain('journal_voucher');
    expect(o.maxDays).toBe(90);
  });

  it('refuses a wrong request and a user without the permission', async () => {
    const base = { delegatorId: ids['fin.one'], delegateId: ids['fin.two'], transactionTypes: ['journal_voucher'], dateFrom: day, dateTo: addDays(day, 4), reasonCode: 'DLG-LEAVE' };
    const send = (b, who = 'it.one') => as[who]('post', '/access-control/delegations').send({ ...base, ...b });
    expect((await send({ dateFrom: addDays(day, -1) })).body.errors[0].path).toBe('dateFrom');
    expect((await send({ dateTo: addDays(day, 120) })).body.errors[0].path).toBe('dateTo');
    expect((await send({ delegateId: ids['sales.one'] })).body.errors[0]).toMatchObject({ path: 'delegateId', message: expect.stringMatching(/cannot approve Journal voucher/) });
    expect((await send({ reasonCode: undefined })).status).toBe(400);
    expect((await send({ reasonCode: 'DLG-OTHER' })).status).toBe(400);
    expect((await send({ reasonCode: 'ARV-LEFT' })).status).toBe(400);
    expect((await send({}, 'gm.one')).status).toBe(403);
    expect((await as['gm.one']('get', '/access-control/delegations')).status).toBe(200);
  });

  it('applies once another administrator approves it, on its dates, and never lowers authority', async () => {
    // a personal limit for the approver away, approved by another administrator
    const limit = await as['it.one']('post', '/access-control/authority-changes').send({ lines: [{ transactionType: 'journal_voucher', userId: ids['fin.one'], maxAmount: 750000,
      effectiveFrom: day, referenceNo: 'BR-2026-1', referenceDate: day }] });
    expect(limit.status, JSON.stringify(limit.body)).toBe(201);
    expect((await decide('it.two', limit.body.data.id)).status).toBe(200);

    const r = await as['it.one']('post', '/access-control/delegations').send({ delegatorId: ids['fin.one'], delegateId: ids['fin.two'], transactionTypes: ['journal_voucher'],
      dateFrom: day, dateTo: addDays(day, 4), reasonCode: 'DLG-LEAVE', note: 'Annual leave in Cebu' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const change = r.body.data.change;
    expect(change).toMatchObject({ kind: 'delegation', status: 'pending', summary: [expect.stringMatching(/Chrystal Malinay covers Journal voucher approval for Mariela Valentino/), expect.any(String)] });
    const pending = (await as['it.one']('get', '/access-control/delegations?view=pending')).body.data.rows;
    expect(pending.find((d) => d.changeId === change.id)).toMatchObject({ status: 'pending', reason: 'Vacation or annual leave: Annual leave in Cebu' });
    // the same days again, and the person covering away himself
    expect((await as['it.two']('post', '/access-control/delegations').send({ delegatorId: ids['fin.one'], delegateId: ids.admin, transactionTypes: ['journal_voucher'],
      dateFrom: addDays(day, 2), dateTo: addDays(day, 3), reasonCode: 'DLG-LEAVE' })).status).toBe(409);
    expect((await as['it.two']('post', '/access-control/delegations').send({ delegatorId: ids['fin.two'], delegateId: ids['fin.one'], transactionTypes: ['journal_voucher'],
      dateFrom: addDays(day, 1), dateTo: addDays(day, 2), reasonCode: 'DLG-LEAVE' })).status).toBe(409);

    expect((await decide('it.one', change.id)).status).toBe(403);
    // My Work: the other approver sees it, the requester does not
    const work = async (who) => (await as[who]('get', '/my-work/items?category=approvals')).body.data;
    const items = (list) => list.filter((i) => i.ref === change.ref);
    expect(items(await work('it.two'))).toHaveLength(1);
    expect(items(await work('it.one'))).toHaveLength(0);

    // under "allow" a person without a limit of his own is not restricted: the delegation does not restrict him
    expect(await effectiveAuthority(pool, ids['fin.two'], 'journal_voucher')).toMatchObject({ found: false });
    expect((await decide('it.two', change.id)).status).toBe(200);
    expect(await effectiveAuthority(pool, ids['fin.two'], 'journal_voucher')).toMatchObject({ found: false });
    await setting('access.authority_without_limit', 'refuse');
    expect(await effectiveAuthority(pool, ids['fin.two'], 'journal_voucher')).toMatchObject({ found: true, limit: 750000, source: expect.stringMatching(/delegated by Mariela Valentino/) });
    expect(await effectiveAuthority(pool, ids['fin.two'], 'journal_voucher', addDays(day, 10))).toMatchObject({ found: false });
    const seen = (await as['it.one']('get', `/access-control/users/${ids['fin.two']}/authority?date=${addDays(day, 1)}`)).body.data.lines.find((l) => l.transactionType === 'journal_voucher');
    expect(seen).toMatchObject({ canApprove: true, set: true, limit: 750000 });
    await setting('access.authority_without_limit', 'allow');

    const current = (await as['it.one']('get', '/access-control/delegations')).body.data.rows.find((d) => d.changeId === change.id);
    expect(current).toMatchObject({ status: 'in-effect', approvedBy: 'IT Two', delegatorDepartment: 'Finance and Accounting', canEnd: true });
    const notices = (await query('SELECT user_id FROM notifications WHERE entity = $1 AND entity_id = $2', ['user_delegation', `DLG-${current.id}`])).rows.map((n) => n.user_id);
    expect(notices.sort()).toEqual([ids['fin.one'], ids['fin.two']].sort());
    const ended = await as['it.one']('post', `/access-control/delegations/${current.id}/end`).send({ reasonCode: 'DLE-RETURNED' });
    expect(ended.body.data).toMatchObject({ status: 'ended-early', endReason: 'Approver back early', endedBy: 'IT One' });
  });

  it('a delegation starting later is scheduled; with the approval off it applies at once, never to oneself', async () => {
    await setting('access.change_approval', false);
    const self = await as.admin('post', '/access-control/delegations').send({ delegatorId: ids['fin.one'], delegateId: ids.admin, transactionTypes: ['journal_voucher'],
      dateFrom: addDays(day, 20), dateTo: addDays(day, 22), reasonCode: 'DLG-TRAVEL' });
    expect(self.status).toBe(403);
    const later = await as['it.one']('post', '/access-control/delegations').send({ delegatorId: ids['fin.one'], delegateId: ids['fin.two'], transactionTypes: [],
      dateFrom: addDays(day, 20), dateTo: addDays(day, 22), reasonCode: 'DLG-TRAINING' });
    expect(later.status, JSON.stringify(later.body)).toBe(201);
    expect(later.body.data.delegation).toMatchObject({ status: 'scheduled', transactionTypes: expect.arrayContaining(['journal_voucher']) });
    await setting('access.change_approval', true);
    const file = await binary(as['it.one']('get', '/access-control/delegations?view=all&format=xlsx&technical=1'));
    expect(file.headers['content-type']).toMatch(/spreadsheetml/);
    const sheet = readWorkbook(file.body)[0];
    expect(sheet.rows.some((row) => row.includes('Ended early'))).toBe(true);
  });
});

describe('segregation of duties', () => {
  it('lists the conflicts by user and accepts one through an exception approved by another administrator', async () => {
    const conflicts = (await as['it.one']('get', '/access-control/sod-conflicts')).body.data.rows;
    const gene = conflicts.find((c) => c.userId === ids['ccd.both'] && c.ruleCode === 'SOD-TIS-BP-RECON');
    expect(gene).toMatchObject({ state: 'open', department: 'Cash Control', heldTogether: ['CCD-BP / QRPh (Receipting)', 'CCD-Recon (Reconciliation and Reversals)'], canRequest: true });
    const send = (b, who = 'it.one') => as[who]('post', '/access-control/sod-exceptions').send({ ruleId: gene.ruleId, userId: ids['ccd.both'], validUntil: addDays(day, 180),
      reasonCode: 'SXE-REVIEWED', note: 'Reversals reviewed weekly by Finance', ...b });
    expect((await send({ validUntil: day })).status).toBe(400);
    expect((await send({ validUntil: addDays(day, 400) })).status).toBe(400);
    expect((await send({ note: '' })).status).toBe(400);
    expect((await send({}, 'gm.one')).status).toBe(403);
    expect((await send({ userId: ids['it.one'] })).status).toBe(403);
    const r = await send({});
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await send({})).status).toBe(409);
    expect((await as['it.one']('get', '/access-control/sod-conflicts')).body.data.rows.find((c) => c.key === gene.key).state).toBe('pending');
    expect((await decide('it.one', r.body.data.change.id)).status).toBe(403);
    expect((await decide('it.two', r.body.data.change.id)).status).toBe(200);
    const accepted = (await as['it.one']('get', '/access-control/sod-conflicts')).body.data.rows.find((c) => c.key === gene.key);
    expect(accepted).toMatchObject({ state: 'accepted', exception: { validUntil: addDays(day, 180), approvedBy: 'IT Two' }, canEnd: true });
    const m = (await as['it.one']('get', '/access-control/user-matrix')).body.data.rows.find((u) => u.id === ids['ccd.both']);
    expect(m).toMatchObject({ openConflicts: 0, sodConflicts: expect.arrayContaining([expect.objectContaining({ name: 'Receipting and reversals', state: 'accepted' })]) });
    const check = await as['it.one']('post', '/access-control/sod-check').send({ roles: ['tis-ccd-bp', 'tis-ccd-recon'], userId: ids['ccd.both'] });
    expect(check.body.data.find((x) => x.code === 'SOD-TIS-BP-RECON').exceptionUntil).toBe(addDays(day, 180));
    // after its date the conflict is open again, without any job
    await query('UPDATE sod_exceptions SET valid_until = $1 WHERE user_id = $2', [addDays(day, -1), ids['ccd.both']]);
    expect((await as['it.one']('get', '/access-control/sod-conflicts')).body.data.rows.find((c) => c.key === gene.key).state).toBe('expired');
    await query('UPDATE sod_exceptions SET valid_until = $1 WHERE user_id = $2', [addDays(day, 30), ids['ccd.both']]);
    const ex = (await query('SELECT id FROM sod_exceptions WHERE user_id = $1 AND status = $2', [ids['ccd.both'], 'active'])).rows[0];
    expect((await as['it.one']('post', `/access-control/sod-exceptions/${ex.id}/end`)).status).toBe(200);
    expect((await as['it.one']('get', '/access-control/sod-conflicts')).body.data.rows.find((c) => c.key === gene.key).state).toBe('open');
  });

  it('changes, switches off and switches on a rule through the approval, with the code given by the server', async () => {
    const created = await as['it.one']('post', '/access-control/sod-rules').send({ name: 'Cheque encoding and reversals', roleA: 'tis-ccd-pdu', roleB: 'tis-ccd-recon',
      action: 'warn', reason: 'The person who encodes cheques should not reverse them', reasonCode: 'ACC-AUDIT' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.data.change.target).toMatch(/^SOD-\d+$/);
    expect((await as['gm.one']('post', '/access-control/sod-rules').send({ name: 'x', roleA: 'tis-ccd-pdu', roleB: 'tis-ccd-recon', action: 'warn', reasonCode: 'ACC-AUDIT' })).status).toBe(403);
    expect((await decide('it.two', created.body.data.change.id)).status).toBe(200);
    const rule = (await as['it.one']('get', '/access-control/sod-rules')).body.data.rows.find((r) => r.code === created.body.data.change.target);
    expect(rule).toMatchObject({ active: true, roleAName: 'CCD-PDU (Post-Dated Cheques)', updatedBy: 'IT Two' });
    const off = await as['it.one']('delete', `/access-control/sod-rules/${rule.id}`).send({ reasonCode: 'ACC-NOTNEEDED' });
    expect(off.status).toBe(201);
    expect((await as['it.one']('get', '/access-control/sod-rules')).body.data.rows.find((r) => r.id === rule.id)).toMatchObject({ active: true, change: { ref: off.body.data.change.ref }, canEdit: false });
    expect((await decide('it.two', off.body.data.change.id)).status).toBe(200);
    const on = await as['it.two']('put', `/access-control/sod-rules/${rule.id}`).send({ active: true, reasonCode: 'ACC-CORRECT' });
    expect(on.status).toBe(201);
    expect((await decide('it.one', on.body.data.change.id)).status).toBe(200);
    expect((await as['it.one']('get', '/access-control/sod-rules')).body.data.rows.find((r) => r.id === rule.id).active).toBe(true);
    const audit = (await query("SELECT before_data FROM audit_log WHERE entity = 'sod_rule' AND entity_id = $1 AND action = 'update' ORDER BY id DESC LIMIT 1", [String(rule.id)])).rows[0];
    expect(audit.before_data).toMatchObject({ active: false });
    const file = await binary(as['it.one']('get', '/access-control/sod-rules?format=xlsx'));
    expect(readWorkbook(file.body).map((s) => s.name)).toEqual(['Rules', 'Conflicts by user', 'Exceptions', 'Waiting for approval']);
  });
});

describe('access reviews', () => {
  it('reviews a scope; protects administrator accounts; removals apply at sign-off by another administrator', async () => {
    expect((await as['it.one']('post', '/access-control/reviews/preview').send({ kind: 'departments', departments: ['Cash Control'] })).body.data).toMatchObject({ users: 2, scopeText: 'Cash Control' });
    expect((await as['it.one']('post', '/access-control/reviews').send({ name: 'Past review', dueDate: addDays(day, -1) })).status).toBe(400);
    expect((await as['gm.one']('post', '/access-control/reviews').send({ name: 'GM review', dueDate: addDays(day, 14) })).status).toBe(403);
    const all = await as['it.one']('post', '/access-control/reviews').send({ name: 'Access review all', dueDate: addDays(day, 14) });
    expect(all.status).toBe(201);
    const line = (r, username) => r.items.find((i) => i.username === username);
    const builtIn = line(all.body.data, 'BrokerVerse');
    expect(builtIn).toMatchObject({ blocked: 'admin', canDecide: false });
    expect((await as['it.one']('post', `/access-control/reviews/${all.body.data.id}/items/${builtIn.id}`).send({ outcome: 'deactivate', reasonCode: 'ARV-LEFT' })).status).toBe(403);
    expect((await as.admin('post', `/access-control/reviews/${all.body.data.id}/items/${builtIn.id}`).send({ outcome: 'keep' })).status).toBe(403);
    expect((await as['it.one']('post', `/access-control/reviews/${all.body.data.id}/items/${line(all.body.data, 'it.one').id}`).send({ outcome: 'keep' })).status).toBe(403);

    const r = await as['it.one']('post', '/access-control/reviews').send({ name: 'Cash Control review', dueDate: addDays(day, 14), scope: { kind: 'departments', departments: ['Cash Control'] } });
    expect(r.status).toBe(201);
    const review = r.body.data;
    expect(review).toMatchObject({ scopeText: 'Cash Control', users: 2 });
    const both = line(review, 'ccd.both');
    expect(both).toMatchObject({ department: 'Cash Control', roleNamesAtStart: ['CCD-BP / QRPh (Receipting)', 'CCD-Recon (Reconciliation and Reversals)'], openConflicts: 1, needsNote: true });
    // keeping a user with an open conflict needs a note
    expect((await as['it.one']('post', `/access-control/reviews/${review.id}/items/${both.id}`).send({ outcome: 'keep' })).status).toBe(400);
    const removed = await as['it.one']('post', `/access-control/reviews/${review.id}/items/${both.id}`).send({ outcome: 'remove-roles', removeRoles: ['tis-ccd-recon'], reasonCode: 'ARV-SOD' });
    expect(removed.status, JSON.stringify(removed.body)).toBe(200);
    expect(line(removed.body.data, 'ccd.both')).toMatchObject({ decision: 'remove-roles', removeRoleNames: ['CCD-Recon (Reconciliation and Reversals)'], removalState: 'waiting' });
    const kept = await as['it.one']('post', `/access-control/reviews/${review.id}/items/keep`).send({ itemIds: [line(review, 'ccd.bp').id] });
    expect(kept.body.data.kept).toEqual(['Marta Dapula']);
    const submitted = await as['it.one']('post', `/access-control/reviews/${review.id}/submit`);
    expect(submitted.status).toBe(201);
    expect((await as['it.one']('post', `/access-control/reviews/${review.id}/items/${both.id}`).send({ outcome: 'keep', note: 'x' })).status).toBe(409);
    // returned with remarks: open again for changes
    expect((await decide('it.two', submitted.body.data.change.id, 'reject')).status).toBe(400);
    expect((await decide('it.two', submitted.body.data.change.id, 'reject', 'Check the cheque duties first')).status).toBe(200);
    expect((await as['it.one']('get', `/access-control/reviews/${review.id}`)).body.data.status).toBe('open');
    const again = await as['it.one']('post', `/access-control/reviews/${review.id}/submit`);
    expect((await decide('it.one', again.body.data.change.id)).status).toBe(403);
    const signed = await decide('it.two', again.body.data.change.id);
    expect(signed.status, JSON.stringify(signed.body)).toBe(200);
    const roles = (await query('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1', [ids['ccd.both']])).rows.map((x) => x.code);
    expect(roles).toEqual(['tis-ccd-bp']);
    const done = (await as['it.one']('get', `/access-control/reviews/${review.id}`)).body.data;
    expect(done).toMatchObject({ status: 'closed', signedOffBy: 'IT Two', applied: 1 });
    expect(line(done, 'ccd.both')).toMatchObject({ removalState: 'applied', appliedBy: 'IT Two', rolesChanged: true });
    const file = await binary(as['it.one']('get', `/access-control/reviews/${review.id}?format=xlsx`));
    expect(readWorkbook(file.body).map((s) => s.name)).toEqual(['Summary', 'Users']);
  });
});

describe('user access matrix', () => {
  it('shows roles by name, departments, pending changes and the access panel; signs out an administrator only by a System Administrator', async () => {
    await persona('uat.super', ['tis-superid'], 'UAT Super');
    const pending = await as['it.one']('post', '/access-control/delegations').send({ delegatorId: ids['fin.one'], delegateId: ids['fin.two'], transactionTypes: ['journal_voucher'],
      dateFrom: addDays(day, 40), dateTo: addDays(day, 41), reasonCode: 'DLG-LEAVE' });
    const m = (await as['gm.one']('get', '/access-control/user-matrix')).body.data;
    const superid = m.rows.find((u) => u.id === ids['uat.super']);
    expect(superid.included.map((x) => x.code)).toContain('system-admin');
    // a full-access role holds every permission: administration and transactions together
    const superConflicts = (await as['it.one']('get', '/access-control/sod-conflicts')).body.data.rows.filter((c) => c.userId === ids['uat.super']);
    expect(superConflicts.map((c) => c.ruleCode)).toContain('SOD-ACC-ADMIN-TXN');
    expect(m.rows.find((u) => u.id === ids['fin.two'])).toMatchObject({ department: 'Finance and Accounting', roleNames: ['TIS Finance & General Accounting'],
      pending: expect.arrayContaining([expect.objectContaining({ ref: pending.body.data.change.ref, kindLabel: 'Delegation' })]) });
    expect(m.rows.find((u) => u.id === ids['ccd.both']).lastReview).toMatchObject({ outcome: 'Remove roles', name: 'Cash Control review' });
    const panel = (await as['gm.one']('get', `/access-control/users/${ids['fin.one']}/access`)).body.data;
    expect(panel.access.find((a) => a.code === 'accounts').modules.find((x) => x.code === 'journal-vouchers').levels).toEqual(expect.arrayContaining(['view', 'edit']));
    expect(panel.authority.find((a) => a.transactionType === 'journal_voucher')).toMatchObject({ set: true, limit: 750000 });
    expect(panel.delegations.given.map((d) => d.status)).toContain('pending');
    expect((await as['it.one']('post', `/access-control/users/${ids['uat.super']}/sign-out`)).status).toBe(403);
    expect((await as.admin('post', `/access-control/users/${ids['uat.super']}/sign-out`)).status).toBe(200);
    const file = await binary(as['gm.one']('get', '/access-control/user-matrix?format=xlsx'));
    expect(readWorkbook(file.body).map((s) => s.name)).toEqual(['Users', 'Roles of users', 'Segregation of duties', 'Delegations in effect']);
  });
});
