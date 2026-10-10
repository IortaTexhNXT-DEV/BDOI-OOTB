import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withoutConfigurationApproval, remittanceBody } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { activityEntries } from '../src/lib/auditEvents.js';

let ctx;
let fin;
let sales;
beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'al.finance', password: 'Welcome@123', displayName: 'Alma Finance', roles: ['accounting'] });
  await ctx.api('post', '/users').send({ username: 'al.sales', password: 'Welcome@123', displayName: 'Alvin Sales', roles: ['sales'] });
  fin = await loginAs(ctx.app, 'al.finance', 'Welcome@123');
  sales = await loginAs(ctx.app, 'al.sales', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });
const as = (tok, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);

describe('activity log entries from the audit trail', () => {
  it('labels the action, names the user with roles, moves the status and keeps the remarks apart from the changes', async () => {
    const at = new Date('2026-10-10T01:03:00Z');
    const rows = [
      { id: 1, at, user_id: null, username: 'BrokerVerse', entity: 'remittance', entity_id: 'rm_x', action: 'submit', before_data: { status: 'draft' },
        after_data: { status: 'for-approval', batchId: 'BLK-1', remarks: 'Month end' }, source: { channel: 'screen', name: 'Accounts > Remittance > Tracking' } },
      { id: 2, at, user_id: null, username: null, entity: 'remittance', entity_id: 'rm_x', action: 'update', before_data: { status: 'draft', remarks: null },
        after_data: { status: 'draft', remarks: null, dueDate: '2026-10-31' }, source: null },
    ];
    const [submit, update] = await activityEntries(rows, { statusLabels: { draft: 'Draft', 'for-approval': 'Pending Approval' } });
    expect(submit).toMatchObject({ actionCode: 'submit', actionLabel: 'Remittance submitted', fromStatus: 'Draft', toStatus: 'Pending Approval', remarks: 'Month end',
      user: { username: 'BrokerVerse', displayName: 'BrokerVerse Administrator' }, source: { channel: 'screen', name: 'Accounts > Remittance > Tracking' } });
    expect(submit.user.roles.length).toBeGreaterThan(0);
    expect(submit.user.role).toBe(submit.user.roles.join(', '));
    expect(submit.changes).toEqual([{ field: 'batchId', label: 'Batch ID', before: null, after: 'BLK-1' }]);
    expect(submit.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(submit.day).toBe('2026-10-10');
    // no status move when the status stays, and a job without a user is the system
    expect(update).toMatchObject({ fromStatus: null, toStatus: null, user: { displayName: 'System' } });
    expect(update.changes.map((c) => c.label)).toEqual(['Due date']);
  });
});

describe('remittance activity log', () => {
  let remId;
  let remNo;
  it('tells the whole life of a remittance: created, submitted, approved on the approval screen and settled by a settlement', async () => {
    const c = await ctx.api('post', '/remittance/remittances').send(await remittanceBody({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo: 'EXT-ACT-1', premium: 10000, commission: 1500, tax: 0 }] }));
    expect(c.status).toBe(201);
    remId = c.body.data.id;
    remNo = c.body.data.remittanceNo;
    expect((await ctx.api('post', '/remittance/remittances/process').send({ ids: [remId] })).status).toBe(200);
    const approval = (await ctx.api('get', '/remittance/approvals')).body.data.find((x) => x.entityId === remId);
    expect((await as(fin, 'post', `/remittance/approvals/${approval.id}/approve`).send({ comments: 'Checked against the statement' })).status).toBe(200);
    const line = (await ctx.api('get', '/remittance/settlements/available-policies?insurerCode=MALAYAN')).body.data.find((l) => l.remittanceId === remId);
    const s = await ctx.api('post', '/remittance/settlements').send({ insurerCode: 'MALAYAN', settlementPeriod: ['2026-09-01', '2026-09-30'], lineIds: [line.id] });
    await ctx.api('post', `/remittance/settlements/${s.body.data.id}/submit`).send({ paymentMethod: 'bank_transfer', bankAccount: 'ACC-BDO-001' });
    const settlementApproval = (await ctx.api('get', '/remittance/approvals?transactionType=Settlement')).body.data.find((x) => x.referenceNo === s.body.data.settlementNo || x.entityId === s.body.data.id);
    expect((await as(fin, 'post', `/remittance/approvals/${settlementApproval.id}/approve`).send({ comments: 'Paid' })).status).toBe(200);

    const d = await ctx.api('get', `/remittance/remittances/${remId}`);
    expect(d.status).toBe(200);
    const log = d.body.data.activityLog;
    expect(log.map((e) => e.actionCode)).toEqual(['create', 'submit', 'approve', 'settle']);
    const [created, submitted, approved, settled] = log;
    // the fields of earlier releases are kept
    expect(created).toMatchObject({ action: 'create', by: 'BrokerVerse', toStatus: 'Draft' });
    expect(new Date(created.at).getTime()).not.toBeNaN();
    expect(submitted).toMatchObject({ fromStatus: null, toStatus: 'Pending approval', user: { displayName: 'BrokerVerse Administrator' } });
    expect(approved).toMatchObject({ action: 'approve', by: 'al.finance', notes: 'Checked against the statement', remarks: 'Checked against the statement',
      fromStatus: 'Pending approval', toStatus: 'Approved', user: { displayName: 'Alma Finance', roles: ['Accounting'] } });
    // a decision shows its level, the limit at decision and its source; the bookkeeping fields of the approval are not changes
    expect(approved.changes.every((c) => ['level', 'limitAtDecision', 'limitSource'].includes(c.field))).toBe(true);
    expect(approved.approval).toMatchObject({ limitSourceLabel: 'Role limit: Accounting' });
    expect(settled).toMatchObject({ action: 'settle', fromStatus: 'Approved', toStatus: 'Settled (voucher raised)', user: { displayName: 'Alma Finance' } });
    expect(settled.changes[0]).toMatchObject({ label: 'Settlement', after: settlementApproval.referenceNo });
  });

  it('gives the remittance audit trail rows the display name, roles, action label and instant', async () => {
    const au = await ctx.api('get', `/remittance/history/audit?referenceNo=${remNo}`);
    expect(au.status).toBe(200);
    const submit = au.body.data.find((x) => x.actionType === 'submit');
    expect(submit).toMatchObject({ changedBy: 'BrokerVerse', changedByName: 'BrokerVerse Administrator', actionLabel: 'Submitted' });
    expect(submit.changeDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(new Date(submit.changedAt).toISOString().slice(0, 16).replace('T', ' ')).toBe(submit.changeDate);
    expect(submit.changedByRoles.length).toBeGreaterThan(0);
  });

  it('opens the history of a remittance work item to its readers only', async () => {
    const item = (await pool.query("SELECT entity_id FROM audit_log WHERE entity = 'remittance_item' AND entity_id IS NOT NULL LIMIT 1")).rows[0];
    expect((await as(fin, 'get', `/audit/records/remittance_item/${item.entity_id}`)).status).toBe(200);
    expect((await as(sales, 'get', `/audit/records/remittance_item/${item.entity_id}`)).status).toBe(403);
  });
});

describe('configuration histories', () => {
  it('names the user and labels the action of a posting rule and a product template change', async () => {
    await withoutConfigurationApproval();
    const rule = (await ctx.api('get', '/posting-rules?eventCode=receipt.apply')).body.data[0];
    const lines = rule.lines.map(({ id: _id, lineNo: _n, ...l }) => l);
    const v2 = await ctx.api('post', '/posting-rules/events/receipt.apply/versions').send({ lines, changeNote: 'Same lines as a new version' });
    expect(v2.status).toBe(201);
    const h = await ctx.api('get', `/posting-rules/${v2.body.data.id}/history`);
    expect(h.status).toBe(200);
    const v = h.body.data[0].version;
    expect(h.body.data[0]).toMatchObject({ action: 'create-version', actionLabel: `Version ${v} replaced version ${v - 1}`, username: 'BrokerVerse', displayName: 'BrokerVerse Administrator',
      changeNote: 'Same lines as a new version' });
    // the same lines: only the version moves
    expect(h.body.data[0].changes).toEqual([{ field: 'version', label: 'Version', from: String(v - 1), to: String(v) }]);
    expect(h.body.data[0].roles.length).toBeGreaterThan(0);

    const tpl = (await ctx.api('get', '/product-configurator/products')).body.data[0];
    const t = await ctx.api('get', `/product-configurator/products/${tpl.id}/history`);
    expect(t.status).toBe(200);
    for (const e of t.body.data) {
      expect(e).toHaveProperty('userName');
      expect(e).toHaveProperty('actionLabel');
      for (const c of e.changes) expect(typeof c.label).toBe('string');
    }
  });
});

describe('record history from the record itself', () => {
  it('tells the rejection, the conversion, the policy issue and the journal steps a record keeps in its own columns', async () => {
    const q = (sql, params) => pool.query(sql, params);
    const admin = (await q("SELECT id FROM users WHERE username = 'BrokerVerse'")).rows[0].id;
    await q(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, created_by) VALUES ('cl_lc1', 'CL-LC-0001', 'Lc Client', 'Lc', 'Client', $1)`, [admin]);
    await q(`INSERT INTO policies(id, policy_number, client_id, status, inception_date, expiry_date, premium_total, created_by, created_at)
      VALUES ('pol_lc1', 'POL-LC-0001', 'cl_lc1', 'active', current_date, current_date + 365, 1000, $1, now() - interval '1 day')`, [admin]);
    const salesId = (await q("SELECT id FROM users WHERE username = 'al.sales'")).rows[0].id;
    await q(`INSERT INTO quotes(id, quote_number, client_id, status, premium_total, valid_until, created_by, created_at, updated_at, approval_sent_at, updated_by, remarks)
      VALUES ('qt_lc1', 'QT-LC-0001', 'cl_lc1', 'rejected', 1000, current_date + 30, $1, now() - interval '3 days', now() - interval '1 day', now() - interval '2 days', $2,
        'Client renewed with its incumbent insurer'),
             ('qt_lc2', 'QT-LC-0002', 'cl_lc1', 'converted', 1000, current_date + 30, $1, now() - interval '3 days', now() - interval '1 day', NULL, NULL, NULL)`, [admin, salesId]);
    await q("UPDATE quotes SET policy_id = 'pol_lc1' WHERE id = 'qt_lc2'");
    await q(`INSERT INTO journal_vouchers(id, jv_number, jv_date, description, status, total_debit, total_credit, created_by, created_at, posted_by, posted_at)
      VALUES ('jv_lc1', 'JV-LC-0001', current_date, 'Accrual', 'posted', 10, 10, $1, now(), $1, now())`, [admin]);

    const rejected = (await ctx.api('get', '/audit/records/quotation/QT-LC-0001')).body.data;
    expect(rejected.map((e) => e.title)).toEqual(['Quotation rejected', 'Quotation sent for approval', 'Quotation created']);
    // who rejected it, the status it left and the reason given
    expect(rejected[0].changes).toEqual([expect.objectContaining({ label: 'Quotation status', from: 'Pending customer', to: 'Rejected' })]);
    expect(rejected[0]).toMatchObject({ note: 'Client renewed with its incumbent insurer', user: { displayName: 'Alvin Sales' } });
    expect(rejected[0].user.roles.length).toBeGreaterThan(0);
    expect(rejected[0].source.channel).toBe('application');

    // a rejection the trail already holds as a status change is not told twice
    await q(`INSERT INTO audit_log(user_id, entity, entity_id, action, before_data, after_data) VALUES ($1, 'quotation', 'qt_lc1', 'status',
      '{"quotationStatus":"PendingCustomer"}', '{"quotationStatus":"Rejected","reason":"Declined"}')`, [salesId]);
    const told = (await ctx.api('get', '/audit/records/quotation/QT-LC-0001')).body.data;
    expect(told.filter((e) => e.changes.some((c) => c.to === 'Rejected'))).toHaveLength(1);

    const converted = (await ctx.api('get', '/audit/records/quotation/qt_lc2')).body.data;
    expect(converted[0]).toMatchObject({ title: 'Quotation converted to a policy', user: { displayName: 'BrokerVerse Administrator' } });
    expect(converted[0].changes.map((c) => c.to)).toContain('POL-LC-0001');

    const policy = (await ctx.api('get', '/audit/records/policy/POL-LC-0001')).body.data;
    expect(policy.map((e) => e.title)).toEqual(['Policy created']);

    // looked up by its number, and steps taken at the same moment read newest first: posted above created
    const journal = (await ctx.api('get', '/audit/records/journal_voucher/JV-LC-0001')).body.data;
    expect(journal.map((e) => e.action)).toEqual(['post', 'create']);
  });
});
