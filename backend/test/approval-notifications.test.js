/**
 * Approval notifications of the maker-checker flows: on submission everyone holding the approve permission is told
 * (audience = that permission, link = the approver's screen; a remittance: the eligible approvers by name, with their
 * Authority Matrix limit); on approval or rejection the maker is told; with
 * notification.approval_requests switched off neither is created.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { remittanceBody } from './helpers.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { createReceivable, findPolicy } from '../src/modules/receipts/receivables.js';

let ctx;
let admin;
let maker;
let checker;
const people = {};
const PASSWORD = 'Welcome@123';

beforeAll(async () => {
  ctx = await setupFinance();
  admin = ctx.api;
  maker = ctx.as('maker');
  checker = ctx.as('checker');
  for (const [key, username, role] of [['mgr', 'ap.manager', 'accounting-manager'], ['mgr2', 'ap.manager2', 'accounting-manager'], ['admin2', 'ap.admin2', 'system-admin']]) {
    const u = await admin('post', '/users').send({ username, password: PASSWORD, displayName: username, roles: [role], email: `${username}@example.ph` });
    expect(u.status, JSON.stringify(u.body)).toBe(201);
    const token = (await request(ctx.app).post('/api/auth/login').send({ username, password: PASSWORD })).body.accessToken;
    people[key] = { id: u.body.data.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
  }
});
afterAll(async () => { await pool.end(); });

const adminId = async () => (await query('SELECT id FROM users WHERE username = \'BrokerVerse\'')).rows[0].id;
/** The approval request of a record (to a permission, not to a person). */
const approvalRequests = async (entity, entityId) => (await query('SELECT * FROM notifications WHERE entity = $1 AND entity_id = $2 AND type = \'approval\' ORDER BY created_at, id',
  [entity, String(entityId)])).rows;
/** Personal notifications of a user about a record. */
const personal = async (userId, entity, entityId) => (await query('SELECT * FROM notifications WHERE user_id = $1 AND entity = $2 AND entity_id = $3 ORDER BY created_at, id',
  [userId, entity, String(entityId)])).rows;
const setApprovalNotifications = async (on) => {
  await query('UPDATE app_settings SET value = $1 WHERE key = \'notification.approval_requests\'', [JSON.stringify(on)]);
  clearSettingsCache();
};

describe('month-end close', () => {
  it('a submitted close goes to approve:period-end; the submitter hears of the rejection and the approval', async () => {
    const run = await maker('post', '/period-end/close-runs').send({ period: '2026-07' });
    expect(run.status, JSON.stringify(run.body)).toBe(201);
    const id = run.body.data.id;
    expect((await maker('post', `/period-end/close-runs/${id}/execute`).send({})).status).toBe(200);
    await maker('post', `/period-end/close-runs/${id}/checks/bank_reconciliation_signoff/sign`).send({ remarks: 'Reconciled' });
    const sub = await maker('post', `/period-end/close-runs/${id}/submit`).send({ target: 'closed' });
    expect(sub.status, JSON.stringify(sub.body)).toBe(200);
    expect(sub.body.data.status).toBe('pending-approval');
    const [n] = await approvalRequests('period_close_run', id);
    expect(n).toMatchObject({ audience: 'approve:period-end', user_id: null, link: `/accounts/period-end/close/${id}`, title: `Month-end close ${run.body.data.runNumber} awaiting approval` });
    expect(n.message).toContain('2026-07');
    expect(n.message).toContain('fin.maker');

    expect((await people.mgr.api('post', `/period-end/close-runs/${id}/reject`).send({ reason: 'Attach the bank statements' })).status).toBe(200);
    let mine = await personal(ctx.userIds.maker, 'period_close_run', id);
    expect(mine.map((x) => x.title)).toEqual([`Month-end close ${run.body.data.runNumber} rejected`]);
    expect(mine[0].message).toContain('Attach the bank statements');

    await maker('post', `/period-end/close-runs/${id}/submit`).send({ target: 'closed' });
    expect(await approvalRequests('period_close_run', id)).toHaveLength(2);
    const ap = await people.mgr.api('post', `/period-end/close-runs/${id}/approve`).send({});
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    mine = await personal(ctx.userIds.maker, 'period_close_run', id);
    expect(mine.map((x) => x.title)).toContain(`Month-end close ${run.body.data.runNumber} approved`);
    // the approver is not sent a personal notification
    expect(await personal(people.mgr.id, 'period_close_run', id)).toHaveLength(0);
  });
});

describe('payment voucher and cheque', () => {
  let d; let client;
  it('a voucher submitted for approval goes to write:disbursements; sending it back is a rejection for the maker', async () => {
    const m = await makePolicy({ net: 30000 });
    client = m.client;
    const c = await maker('post', '/disbursements').send({ payeeType: 'Customer', criteria: 'Specific', customerCode: client.client_code, transactionCode: 'REFUND', amount: '5000.00' });
    expect(c.status).toBe(201);
    d = c.body.data;
    expect(await approvalRequests('disbursement', d.disbursementId)).toHaveLength(0);
    const sub = await maker('put', `/disbursements/${d.disbursementId}`).send({ status: 'for-approval' });
    expect(sub.status).toBe(200);
    const [n] = await approvalRequests('disbursement', d.disbursementId);
    expect(n).toMatchObject({ audience: 'write:disbursements', link: `/accounts/paymentvoucher/detailview/${d.disbursementId}`, title: `Payment voucher ${d.voucherNumber} awaiting approval` });
    // the maker by display name, the amount formatted
    expect(n.message).toMatch(/maker user submitted .*5,000\.00/);
    expect(await personal(ctx.userIds.checker, 'disbursement', d.disbursementId)).toHaveLength(0);

    expect((await checker('put', `/disbursements/${d.disbursementId}`).send({ status: 'draft', reason: 'Wrong payee' })).status).toBe(200);
    const mine = await personal(ctx.userIds.maker, 'disbursement', d.disbursementId);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: `Payment voucher ${d.voucherNumber} rejected`, link: `/accounts/paymentvoucher/detailview/${d.disbursementId}` });
    expect(mine[0].message).toContain('Wrong payee');
  });

  it('a cheque goes to write:disbursements; its approval is reported to the maker', async () => {
    const cb = await maker('post', '/disbursements/checkbook').send({ customerCode: client.client_code, customerName: client.display_name, mainAccount: '1102001', instrumentBookId: 'BDO-CB-01',
      instrumentNo: '000901', instrumentDate: await today(), totaleAmount: '5000', disbursementId: d.disbursementId });
    expect(cb.status).toBe(201);
    const id = cb.body.data.checkbookId;
    const [n] = await approvalRequests('checkbook', id);
    expect(n).toMatchObject({ audience: 'write:disbursements', link: `/accounts/paymentvoucher/detailview/${d.disbursementId}`, title: 'Cheque 000901 awaiting approval' });
    const ap = await checker('put', `/disbursements/checkbook/${id}`).send({ status: 'Approved', totaleAmount: '5000' });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect((await personal(ctx.userIds.maker, 'checkbook', id)).map((x) => x.title)).toEqual(['Cheque 000901 approved']);
  });
});

describe('posting rule and account determination changes', () => {
  it('a change goes to approve:posting-rules; the requester hears of the approval and the rejection', async () => {
    const r = await people.mgr.api('put', '/account-determination/roles/premium_receivable').send({ glCode: '1202002' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const id = r.body.data.change.id;
    const [n] = await approvalRequests('accounting_config_change', id);
    expect(n).toMatchObject({ audience: 'approve:posting-rules', link: '/master/finance/configuration-approvals', title: `Configuration change ${id} awaiting approval` });
    expect(n.message).toContain('premium_receivable');
    expect((await people.mgr2.api('post', `/posting-rules/changes/${id}/approve`).send({})).status).toBe(200);
    expect((await personal(people.mgr.id, 'accounting_config_change', id)).map((x) => x.title)).toEqual([`Configuration change ${id} approved`]);

    const back = await people.mgr.api('put', '/account-determination/roles/premium_receivable').send({ glCode: '1202001' });
    const id2 = back.body.data.change.id;
    expect(await approvalRequests('accounting_config_change', id2)).toHaveLength(1);
    expect((await people.mgr2.api('post', `/posting-rules/changes/${id2}/reject`).send({ remarks: 'Keep the corporate account' })).status).toBe(200);
    const [rej] = await personal(people.mgr.id, 'accounting_config_change', id2);
    expect(rej).toMatchObject({ title: `Configuration change ${id2} rejected`, type: 'alert' });
    expect(rej.message).toContain('Keep the corporate account');
  });
});

describe('bank reconciliation', () => {
  const GL = '1102019';
  const ACCT = 'ACC-APPR-001';
  it('a prepared reconciliation goes to approve:bank-reconciliation; the preparer hears of the approval and of a reopening', async () => {
    await query(`INSERT INTO gl_accounts(code, name, account_type, category, is_open_item, allow_manual, fs_group, normal_balance) VALUES ($1, 'Cash in Bank - Approval Test', 'asset', 'Cash and Cash Equivalents', false, true, 'Current Assets', 'debit')
      ON CONFLICT (code) DO NOTHING`, [GL]);
    await query(`INSERT INTO master_records(type_code, code, name, data, status, created_by) VALUES ('bank-account', $1, 'Approval Test Account',
      '{"accountCode":"ACC-APPR-001","accountName":"Approval Test Account","bankCode":"UBP","bankName":"UnionBank","accountNumber":"0009-0000-0001","accountType":"Current Account","currency":"PHP"}', 'active', 'test')`, [ACCT]);
    const link = await maker('put', `/bank-reconciliation/bank-accounts/${ACCT}`).send({ glAccountCode: GL, statementFormat: 'GENERIC', reconcileFrom: '2026-05-01' });
    expect(link.status, JSON.stringify(link.body)).toBe(200);
    const s = await maker('post', '/bank-reconciliation/statements').send({ bankAccount: ACCT, statementRef: 'MAY', periodFrom: '2026-05-01', periodTo: '2026-05-31', openingBalance: 0, closingBalance: 0,
      lines: [{ date: '2026-05-10', description: 'DEPOSIT', credit: 100 }, { date: '2026-05-20', description: 'DEBIT MEMO', debit: 100 }] });
    expect(s.status, JSON.stringify(s.body)).toBe(201);
    const rec = (await maker('post', '/bank-reconciliation/reconciliations').send({ bankAccount: ACCT, period: '2026-05' })).body.data;
    const prep = await maker('post', `/bank-reconciliation/reconciliations/${rec.id}/prepare`).send({});
    expect(prep.status, JSON.stringify(prep.body)).toBe(200);
    const [n] = await approvalRequests('bank_reconciliation', rec.id);
    expect(n).toMatchObject({ audience: 'approve:bank-reconciliation', link: `/accounts/bank-reconciliation/reconciliations/${rec.id}`, title: `Bank reconciliation ${rec.recNumber} awaiting approval` });
    expect(n.message).toContain('2026-05');

    expect((await people.mgr.api('post', `/bank-reconciliation/reconciliations/${rec.id}/reopen`).send({ remarks: 'Explain the debit memo' })).status).toBe(200);
    const [rej] = await personal(ctx.userIds.maker, 'bank_reconciliation', rec.id);
    expect(rej.title).toBe(`Bank reconciliation ${rec.recNumber} rejected`);
    expect(rej.message).toContain('Explain the debit memo');

    await maker('post', `/bank-reconciliation/reconciliations/${rec.id}/prepare`).send({});
    expect(await approvalRequests('bank_reconciliation', rec.id)).toHaveLength(2);
    expect((await people.mgr.api('post', `/bank-reconciliation/reconciliations/${rec.id}/approve`).send({})).status).toBe(200);
    expect((await personal(ctx.userIds.maker, 'bank_reconciliation', rec.id)).map((x) => x.title)).toContain(`Bank reconciliation ${rec.recNumber} approved`);
  });
});

describe('insurer reconciliation', () => {
  it('a submitted reconciliation goes to approve:insurer-reconciliation; the submitter hears of the rejection and the approval', async () => {
    const st = (await query(`INSERT INTO insurer_statements(statement_number, insurance_company_id, statement_type, statement_ref, period_from, period_to, total_paid, created_by)
      VALUES ('ISR-APPR-0001', (SELECT id FROM insurance_companies WHERE code = 'MALAYAN'), 'premium', 'SOA-1', '2001-01-01', '2001-01-31', 12500, $1) RETURNING id`, [ctx.userIds.maker])).rows[0];
    const sub = await maker('post', `/insurer-reconciliation/statements/${st.id}/submit`).send({});
    expect(sub.status, JSON.stringify(sub.body)).toBe(200);
    const [n] = await approvalRequests('insurer_statement', st.id);
    expect(n).toMatchObject({ audience: 'approve:insurer-reconciliation', link: `/accounts/insurer-reconciliation/statements/${st.id}`, title: 'Insurer reconciliation ISR-APPR-0001 awaiting approval' });
    expect(n.message).toMatch(/2001-01-01 to 2001-01-31.*12,500\.00/);

    expect((await people.mgr.api('post', `/insurer-reconciliation/statements/${st.id}/reject`).send({ remarks: 'Line 4 needs the endorsement' })).status).toBe(200);
    const [rej] = await personal(ctx.userIds.maker, 'insurer_statement', st.id);
    expect(rej.title).toBe('Insurer reconciliation ISR-APPR-0001 rejected');
    expect(rej.message).toContain('Line 4 needs the endorsement');
    await maker('post', `/insurer-reconciliation/statements/${st.id}/submit`).send({});
    expect((await people.mgr.api('post', `/insurer-reconciliation/statements/${st.id}/approve`).send({})).status).toBe(200);
    expect((await personal(ctx.userIds.maker, 'insurer_statement', st.id)).map((x) => x.title)).toContain('Insurer reconciliation ISR-APPR-0001 approved');
  });
});

describe('remittance', () => {
  it('a submitted remittance goes to its eligible approvers by name, never to a role; the maker hears of the return with a link to the record', async () => {
    const recon = await admin('post', '/users').send({ username: 'ap.recon', password: PASSWORD, displayName: 'ap.recon', roles: ['tis-ccd-recon'], email: 'ap.recon@example.ph' });
    expect(recon.status).toBe(201);
    const c = await maker('post', '/remittance/remittances').send(await remittanceBody({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo: 'EXT-NTF-1', premium: 9000, commission: 1000, tax: 0 }] }));
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const remId = c.body.data.id;
    expect((await maker('post', '/remittance/remittances/process').send({ ids: [remId] })).status).toBe(200);
    const approval = (await query("SELECT id FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1", [remId])).rows[0];
    const requests = await approvalRequests('remittance', remId);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((n) => n.user_id && n.audience === null && n.link === `/finance/remittance/approvals?approval=${approval.id}`)).toBe(true);
    const to = requests.map((n) => n.user_id);
    expect(to).toContain(ctx.userIds.checker);
    expect(to).not.toContain(ctx.userIds.maker);
    expect(to).not.toContain(recon.body.data.userId);
    expect(requests.find((n) => n.user_id === ctx.userIds.checker)).toMatchObject({ title: `Remittance ${c.body.data.remittanceNo} awaiting approval` });

    expect((await checker('post', `/remittance/approvals/${approval.id}/reject`).send({ reasonCode: 'RRJ-DUPLICATE' })).status).toBe(200);
    const [back] = await personal(ctx.userIds.maker, 'remittance', remId);
    expect(back).toMatchObject({ title: `Insurer Remittance ${c.body.data.remittanceNo} returned`, link: `/finance/remittance/remittances/${remId}`, type: 'alert' });
    expect(back.message).toMatch(/^Returned by .+: Duplicate$/);
  });
});

describe('commission payout', () => {
  it('lines marked eligible go to write:commission; the approval is reported to the maker; the payout voucher follows the voucher flow', async () => {
    const c = await maker('post', '/commission/referrer-accounts').send({ name: 'Approval Referrer', type: 'Agent', level: 'L1', bankName: 'BDO', bankAccountNo: '009988776655' });
    expect(c.status).toBe(201);
    const ref = c.body.data.referrer.id;
    expect((await admin('put', '/settings').send({ settings: { 'commission.auto_eligible_on_full_payment': false } })).status).toBe(200);
    const pol = await makePolicy({ net: 40000, details: { commissionDetails: { brokeragePct: 18, primary: { referrerId: ref, level: 'L1', comsubPct: 8, comsubFixed: 0 }, chain: [] } } });
    expect((await maker('post', '/commission/accrue').send({ policyId: pol.policy.id })).status).toBe(201);
    expect((await maker('post', '/receipts').send({ policyId: pol.policy.id, amount: pol.gross })).status).toBe(201);
    expect((await maker('post', `/commission/referrer-accounts/${ref}/mark-eligible`)).status).toBe(200);
    const [n] = await approvalRequests('commission_referrer', ref);
    expect(n).toMatchObject({ audience: 'write:commission', link: `/commission/referrer-accounts/${ref}`, title: 'Commission payout Approval Referrer awaiting approval' });
    expect(n.message).toMatch(/1 line\(s\) of Approval Referrer awaiting approval \(.*3,200\.00\)/);

    expect((await checker('post', `/commission/referrer-accounts/${ref}/approve`)).status).toBe(200);
    expect((await personal(ctx.userIds.maker, 'commission_referrer', ref)).map((x) => x.title)).toEqual(['Commission payout Approval Referrer approved']);

    const bulk = await maker('post', '/disbursements/bulk-agent-disburse').send({ referrerIds: [ref], transactionCode: 'COMSUB', instrumentCurrency: 'PHP' });
    const v = bulk.body.data.vouchers[0];
    const [pv] = await approvalRequests('disbursement', v.disbursementId);
    expect(pv).toMatchObject({ audience: 'write:disbursements', title: `Payment voucher ${v.voucherNumber} awaiting approval` });
    const ap = await checker('post', `/disbursements/${v.disbursementId}/approve-agent-payout`).send({ lineIds: v.lineIds });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect((await personal(ctx.userIds.maker, 'disbursement', v.disbursementId)).map((x) => x.title)).toEqual([`Payment voucher ${v.voucherNumber} approved`]);
    await admin('put', '/settings').send({ settings: { 'commission.auto_eligible_on_full_payment': true } });
  });

  it('lines made eligible by a full payment also go to the approvers', async () => {
    const c = await maker('post', '/commission/referrer-accounts').send({ name: 'Auto Referrer', type: 'Agent', level: 'L1' });
    const ref = c.body.data.referrer.id;
    const pol = await makePolicy({ net: 10000, details: { commissionDetails: { brokeragePct: 18, primary: { referrerId: ref, level: 'L1', comsubPct: 8, comsubFixed: 0 }, chain: [] } } });
    await maker('post', '/commission/accrue').send({ policyId: pol.policy.id });
    await maker('post', '/receipts').send({ policyId: pol.policy.id, amount: pol.gross });
    const [n] = await approvalRequests('commission_referrer', ref);
    expect(n).toMatchObject({ audience: 'write:commission', title: 'Commission payout Auto Referrer awaiting approval' });
    expect(n.message).toContain(`Premium of ${pol.policy.policy_number} fully collected`);
  });
});

describe('credit control', () => {
  it('a warranty extension goes to approve:credit-control; the requester hears of the decision', async () => {
    await query('UPDATE insurance_companies SET premium_warranty_days = 30 WHERE code = \'FPG\'');
    const late = await makePolicy({ insurer: 'FPG', inceptionOffset: -60 });
    await withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, late.policy.id), amount: late.gross, user: { id: ctx.userIds.maker } }));
    const until = addDays(await today(), 20);
    const x = await maker('post', `/credit-control/warranty/${late.policy.id}/extensions`).send({ requestedDeadline: until, reason: 'Corporate cheque promised' });
    expect(x.status, JSON.stringify(x.body)).toBe(201);
    const [n] = await approvalRequests('premium_warranty_extension', x.body.data.id);
    expect(n).toMatchObject({ audience: 'approve:credit-control', link: '/accounts/credit-control/warranty', title: `Warranty extension ${late.policy.policy_number} awaiting approval` });
    expect(n.message).toContain('Corporate cheque promised');
    expect((await people.mgr.api('post', `/credit-control/warranty/extensions/${x.body.data.id}/reject`).send({ remarks: 'No cheque on file' })).status).toBe(200);
    const [rej] = await personal(ctx.userIds.maker, 'premium_warranty_extension', x.body.data.id);
    expect(rej.title).toBe(`Warranty extension ${late.policy.policy_number} rejected`);
    expect(rej.message).toContain('No cheque on file');

    const y = await maker('post', `/credit-control/warranty/${late.policy.id}/extensions`).send({ requestedDeadline: until, reason: 'Cheque received' });
    expect((await people.mgr.api('post', `/credit-control/warranty/extensions/${y.body.data.id}/approve`).send({})).status).toBe(200);
    expect((await personal(ctx.userIds.maker, 'premium_warranty_extension', y.body.data.id)).map((r) => r.title)).toEqual([`Warranty extension ${late.policy.policy_number} approved`]);
  });
});

describe('access control', () => {
  it('a proposed authority limit goes to approve:access-control; the proposer hears of the decision', async () => {
    const p = await admin('post', '/access-control/authority-limits').send({ transactionType: 'payment_voucher', roleCode: 'accounting', maxAmount: 1500000, remarks: 'Board resolution 12' });
    expect(p.status, JSON.stringify(p.body)).toBe(201);
    const id = p.body.data.id;
    const [n] = await approvalRequests('authority_limit', id);
    expect(n).toMatchObject({ audience: 'approve:access-control', link: '/master/generals/usermanagement/authority-matrix', title: `Authority limit #${id} awaiting approval` });
    expect(n.message).toMatch(/BrokerVerse proposed .*1,500,000\.00 \(Board resolution 12\)/);
    expect((await people.admin2.api('post', `/access-control/authority-limits/${id}/decision`).send({ decision: 'reject', note: 'Too high' })).status).toBe(200);
    const [rej] = await personal(await adminId(), 'authority_limit', id);
    expect(rej.title).toBe(`Authority limit #${id} rejected`);
    expect(rej.message).toContain('Too high');

    const q = await admin('post', '/access-control/authority-limits').send({ transactionType: 'payment_voucher', roleCode: 'accounting', maxAmount: 1200000 });
    expect((await people.admin2.api('post', `/access-control/authority-limits/${q.body.data.id}/decision`).send({ decision: 'approve' })).status).toBe(200);
    expect((await personal(await adminId(), 'authority_limit', q.body.data.id)).map((x) => x.title)).toEqual([`Authority limit #${q.body.data.id} approved`]);
  });

  it('a new access review asks the reviewers (write:access-control) for their decisions', async () => {
    const r = await admin('post', '/access-control/reviews').send({ name: 'Approval test review', dueDate: '2026-12-15' });
    expect(r.status).toBe(201);
    const [n] = await approvalRequests('access_review', r.body.data.id);
    expect(n).toMatchObject({ audience: 'write:access-control', link: '/master/generals/usermanagement/access-reviews', title: 'Access review Approval test review awaiting decisions' });
  });
});

describe('notification.approval_requests', () => {
  it('switched off, neither the approvers nor the makers are notified', async () => {
    await setApprovalNotifications(false);
    try {
      const before = Number((await query('SELECT count(*) FROM notifications')).rows[0].count);
      // payment voucher submitted and sent back
      const c = await maker('post', '/disbursements').send({ payeeType: 'Supplier', payeeName: 'Office Supplies Inc.', transactionCode: 'SUPP', amount: '1200.00' });
      expect(c.status, JSON.stringify(c.body)).toBe(201);
      expect((await maker('put', `/disbursements/${c.body.data.disbursementId}`).send({ status: 'for-approval' })).status).toBe(200);
      expect((await checker('put', `/disbursements/${c.body.data.disbursementId}`).send({ status: 'draft', reason: 'Attach the invoice' })).status).toBe(200);
      // configuration change requested and approved
      const r = await people.mgr.api('put', '/account-determination/roles/premium_receivable').send({ glCode: '1202002' });
      expect(r.body.data.change.status).toBe('pending');
      expect((await people.mgr2.api('post', `/posting-rules/changes/${r.body.data.change.id}/approve`).send({})).status).toBe(200);
      // insurer reconciliation submitted and approved
      const st = (await query(`INSERT INTO insurer_statements(statement_number, insurance_company_id, statement_type, period_from, period_to, created_by)
        VALUES ('ISR-APPR-0002', (SELECT id FROM insurance_companies WHERE code = 'MALAYAN'), 'premium', '2001-02-01', '2001-02-28', $1) RETURNING id`, [ctx.userIds.maker])).rows[0];
      expect((await maker('post', `/insurer-reconciliation/statements/${st.id}/submit`).send({})).status).toBe(200);
      expect((await people.mgr.api('post', `/insurer-reconciliation/statements/${st.id}/approve`).send({})).status).toBe(200);
      // authority limit proposed and approved
      const p = await admin('post', '/access-control/authority-limits').send({ transactionType: 'payment_voucher', roleCode: 'accounting', maxAmount: 1100000 });
      expect(p.status).toBe(201);
      expect((await people.admin2.api('post', `/access-control/authority-limits/${p.body.data.id}/decision`).send({ decision: 'approve' })).status).toBe(200);
      // a journal voucher for approval
      const jv = await maker('post', '/journal-vouchers').send({ transactionCode: 'JV01', transactionDescription: 'Accrual', entries: [
        { mainAccount: '4401003', entryType: 'Debit', currencyCode: 'PHP', foreignAmount: 1000 }, { mainAccount: '2206001', entryType: 'Credit', currencyCode: 'PHP', foreignAmount: 1000 }] });
      expect(jv.status).toBe(201);
      expect(jv.body.data.status).toBe('for-approval');
      expect(Number((await query('SELECT count(*) FROM notifications')).rows[0].count)).toBe(before);
    } finally {
      await setApprovalNotifications(true);
    }
  });
});
