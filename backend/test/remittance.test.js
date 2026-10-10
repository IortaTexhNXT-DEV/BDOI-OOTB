import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
let fin;
let sales;
beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'r.finance', password: 'Welcome@123', displayName: 'R Finance', roles: ['accounting'] });
  await ctx.api('post', '/users').send({ username: 'r.sales', password: 'Welcome@123', displayName: 'R Sales', roles: ['sales'] });
  fin = await loginAs(ctx.app, 'r.finance', 'Welcome@123');
  sales = await loginAs(ctx.app, 'r.sales', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });
const as = (tok, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);
const policyFor = async (code) => (await pool.query(`SELECT p.id, p.policy_number FROM policies p JOIN insurance_companies i ON i.id = p.insurance_company_id
  WHERE i.code = $1 AND p.status = 'active' ORDER BY p.inception_date DESC`, [code])).rows;

describe('remittances and approvals', () => {
  let remId;
  it('lists seeded remittances with labels and details', async () => {
    const r = await ctx.api('get', '/remittance/remittances?kind=direct-bill&perPage=5');
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThanOrEqual(10);
    expect(r.body.summary.count).toBe(r.body.total);
    const labels = new Set((await ctx.api('get', '/remittance/remittances?perPage=100')).body.data.map((x) => x.status));
    // TISPH names (seed 90): a settled remittance has its voucher raised
    expect([...labels]).toEqual(expect.arrayContaining(['Draft', 'Approved', 'Settled (voucher raised)']));
    const pend = await ctx.api('get', '/remittance/remittances?status=Pending%20Approval');
    expect(pend.body.data.every((x) => x.statusCode === 'for-approval')).toBe(true);
    const d = await ctx.api('get', `/remittance/remittances/${r.body.data[0].id}`);
    expect(d.body.data.insurerDetails.code).toBeTruthy();
    expect(d.body.data.policies.length).toBe(d.body.data.policyCount);
  });
  it('every seeded remittance has an insurer, and a seeded agency bill carries one insurer\'s policies', async () => {
    const rows = (await pool.query(`SELECT r.remittance_number, r.kind, r.insurance_company_id AS ins,
        (SELECT array_agg(DISTINCT p.insurance_company_id) FROM remittance_lines l JOIN policies p ON p.id = l.policy_id WHERE l.remittance_id = r.id) AS line_ins
      FROM remittances r WHERE r.data->>'seed' = 'remittance-v1'`)).rows;
    expect(rows.filter((r) => r.kind === 'agency-bill').length).toBe(3);
    expect(rows.filter((r) => !r.ins)).toEqual([]);
    for (const r of rows.filter((x) => x.kind === 'agency-bill')) expect(r.line_ins).toEqual([r.ins]);
    // databases seeded before the fix: the migration fills the insurer from the bill's lines, and only for seeded rows
    const fs = await import('node:fs');
    const sql = fs.readFileSync(new URL('../src/db/migrations/0085_seeded_agency_bill_insurer.sql', import.meta.url), 'utf8');
    await pool.query("UPDATE remittances SET insurance_company_id = NULL WHERE kind = 'agency-bill' AND data->>'seed' = 'remittance-v1'");
    await pool.query(sql);
    const after = (await pool.query("SELECT remittance_number, insurance_company_id AS ins FROM remittances WHERE kind = 'agency-bill' AND data->>'seed' = 'remittance-v1' ORDER BY 1")).rows;
    expect(after.map((r) => r.ins)).toEqual(rows.filter((r) => r.kind === 'agency-bill').sort((a, b) => a.remittance_number.localeCompare(b.remittance_number)).map((r) => r.ins));
  });

  it('creates a remittance, validates and processes it, and enforces maker-checker', async () => {
    const bad = await ctx.api('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', lines: [] });
    expect(bad.status).toBe(400);
    const c = await ctx.api('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo: 'EXT-100', premium: 20000, commission: 3000, tax: 0 }] });
    expect(c.status).toBe(201);
    remId = c.body.data.id;
    expect(c.body.data).toMatchObject({ netAmount: 17000, status: 'Draft', policyCount: 1 });
    const v = await ctx.api('post', '/remittance/remittances/validate').send({ ids: [remId, 'nope'] });
    expect(v.body.data).toMatchObject({ totalValidated: 2, validCount: 1, invalidCount: 1 });
    const p = await ctx.api('post', '/remittance/remittances/process').send({ ids: [remId] });
    expect(p.status).toBe(200);
    expect(p.body.data.batchId).toMatch(/^BLK-/);
    const q = await ctx.api('get', '/remittance/approvals');
    const a = q.body.data.find((x) => x.entityId === remId);
    expect(a).toMatchObject({ transactionType: 'Insurer Remittance', amount: 17000, initiator: 'BrokerVerse Administrator', status: 'Pending' });
    const self = await ctx.api('post', `/remittance/approvals/${a.id}/approve`).send({ comments: 'ok' });
    expect(self.status).toBe(403);
    const noReason = await as(fin, 'post', `/remittance/approvals/${a.id}/reject`).send({});
    expect(noReason.status).toBe(400);
    const ok = await as(fin, 'post', `/remittance/approvals/${a.id}/approve`).send({ comments: 'Verified' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('Approved');
    expect((await ctx.api('get', `/remittance/remittances/${remId}`)).body.data.statusCode).toBe('approved');
    const hist = await ctx.api('get', '/remittance/approvals/history');
    expect(hist.body.data.some((h) => h.action === 'Approved' && h.remarks === 'Verified')).toBe(true);
    const again = await as(fin, 'post', `/remittance/approvals/${a.id}/approve`).send({});
    expect(again.status).toBe(409);
    expect(again.body.errors[0].code).toBe('ALREADY_DECIDED');
    expect(again.body.message).toMatch(/^Approved by R Finance at \d{2}:\d{2}\.$/);
    // the record answers its version and the decision block of its approval
    const rec = (await ctx.api('get', `/remittance/remittances/${remId}`)).body.data;
    expect(rec.version).toBeGreaterThan(1);
    expect(rec.decision).toMatchObject({ canDecide: false, blockedCode: 'ALREADY_DECIDED' });
    expect(rec.nextStep).toMatchObject({ code: 'settle', label: 'Include in a settlement' });
    expect((await ctx.api('get', '/remittance/processing-history')).body.data[0].batchId).toBe(p.body.data.batchId);
  });
  it('settles through a settlement approved by a second user', async () => {
    const avail = await ctx.api('get', '/remittance/settlements/available-policies?insurerCode=MALAYAN');
    const line = avail.body.data.find((l) => l.remittanceId === remId);
    expect(line).toMatchObject({ premium: 20000, commission: 3000, netAmount: 17000, commissionRate: 15 });
    const calc = await ctx.api('post', '/remittance/settlements/calculate').send({ lineIds: [line.id], adjustments: { creditNotes: 500, debitNotes: 200 } });
    expect(calc.body.data).toMatchObject({ totalPremium: 20000, totalAdjustments: 300, netAmount: 17300 });
    const s = await ctx.api('post', '/remittance/settlements').send({ insurerCode: 'MALAYAN', settlementPeriod: ['2026-09-01', '2026-09-30'], lineIds: [line.id], creditNotes: 500, debitNotes: 200 });
    expect(s.status).toBe(201);
    expect(s.body.data).toMatchObject({ status: 'Draft', netAmount: 17300, insurerName: 'Malayan Insurance Co., Inc.' });
    expect((await ctx.api('post', '/remittance/settlements').send({ insurerCode: 'MALAYAN', settlementPeriod: ['2026-09-01', '2026-09-30'], lineIds: [line.id] })).status).toBe(400);
    expect((await ctx.api('post', `/remittance/settlements/${s.body.data.id}/submit`).send({})).status).toBe(400);
    const sub = await ctx.api('post', `/remittance/settlements/${s.body.data.id}/submit`).send({ paymentMethod: 'bank_transfer', bankAccount: 'ACC-MBT-001' });
    expect(sub.body.data.status).toBe('Pending Approval');
    const ap = await as(fin, 'post', `/remittance/approvals/${(await ctx.api('get', '/remittance/approvals?transactionType=Settlement')).body.data[0].id}/approve`).send({ comments: 'Paid' });
    expect(ap.body.data.status).toBe('Approved');
    expect((await ctx.api('get', `/remittance/remittances/${remId}`)).body.data).toMatchObject({ status: 'Settled (voucher raised)', statusCode: 'settled' });
  });
});

describe('settlement to money out', () => {
  it('an approved settlement raises the insurer payment voucher for the collected premium', async () => {
    const { rows: [pol] } = await pool.query(`SELECT p.id, p.policy_number FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id JOIN policies p ON p.id = r.policy_id
      JOIN insurance_companies i ON i.id = p.insurance_company_id WHERE a.status = 'applied' AND a.remitted_invoice_id IS NULL AND i.code = 'STANDARD' LIMIT 1`);
    expect(pol).toBeTruthy();
    const rem = await ctx.api('post', '/remittance/remittances').send({ insurerCode: 'STANDARD', period: '2026-09', lines: [{ policyId: pol.id }] });
    expect(rem.status).toBe(201);
    await ctx.api('post', '/remittance/remittances/process').send({ ids: [rem.body.data.id] });
    const a = (await ctx.api('get', '/remittance/approvals')).body.data.find((x) => x.entityId === rem.body.data.id);
    expect((await as(fin, 'post', `/remittance/approvals/${a.id}/approve`).send({ comments: 'ok' })).status).toBe(200);
    const line = (await ctx.api('get', '/remittance/settlements/available-policies?insurerCode=STANDARD')).body.data.find((l) => l.remittanceId === rem.body.data.id);
    const s = await ctx.api('post', '/remittance/settlements').send({ insurerCode: 'STANDARD', settlementPeriod: ['2026-09-01', '2026-09-30'], lineIds: [line.id] });
    await ctx.api('post', `/remittance/settlements/${s.body.data.id}/submit`).send({ paymentMethod: 'bank_transfer', bankAccount: 'ACC-MBT-001' });
    const ap = (await ctx.api('get', '/remittance/approvals?transactionType=Settlement')).body.data.find((x) => x.entityId === s.body.data.id);
    expect((await as(fin, 'post', `/remittance/approvals/${ap.id}/approve`).send({ comments: 'Pay' })).status).toBe(200);
    const { rows: [item] } = await pool.query('SELECT data FROM remittance_items WHERE id = $1', [s.body.data.id]);
    expect(item.data.voucherNumber).toMatch(/^PV-/);
    const v = await ctx.api('get', `/disbursements/${item.data.disbursementId}`);
    expect(v.body.data).toMatchObject({ payeeType: 'Insurer', status: 'draft' });
    expect(v.body.data.invoiceList.map((i) => i.policyNumber)).toEqual([pol.policy_number]);
    // collected premium is now on a voucher, so it cannot be paid again
    const again = await ctx.api('post', '/disbursements/insurer-remittance').send({ insurerName: 'Standard Insurance Co., Inc.' });
    expect(again.status === 409 || !again.body.data.invoiceList.some((i) => i.policyNumber === pol.policy_number)).toBe(true);
  });
  it('broker-billed policies are not offered for direct-bill commission debit notes', async () => {
    const { rows: [paid] } = await pool.query(`SELECT p.id, i.code FROM policies p JOIN insurance_companies i ON i.id = p.insurance_company_id
      WHERE p.billing_mode = 'broker' AND EXISTS (SELECT 1 FROM receivables r WHERE r.policy_id = p.id) LIMIT 1`);
    const r = await ctx.api('get', `/remittance/direct-bill/policies?insurerCode=${paid.code}`);
    expect(r.status).toBe(200);
    expect(r.body.data.some((x) => x.policyId === paid.id)).toBe(false);
  });
});

describe('bills', () => {
  it('direct-bill policies are never remitted to the insurer (the client paid the insurer)', async () => {
    const { eligiblePolicies } = await import('../src/modules/remittance/service.js');
    const pols = await policyFor('PIONEER');
    if (!pols.length) return;
    const ids = pols.map((p) => p.id);
    const before = await eligiblePolicies({ policyIds: ids });
    await pool.query('UPDATE policies SET billing_mode = \'direct\' WHERE id = $1', [pols[0].id]);
    const after = await eligiblePolicies({ policyIds: ids });
    expect(after.some((p) => p.id === pols[0].id)).toBe(false);
    expect(after.length).toBe(before.filter((p) => p.id !== pols[0].id).length);
    await pool.query('UPDATE policies SET billing_mode = \'broker\' WHERE id = $1', [pols[0].id]);
  });
  it('agency bills per agent with previous balance', async () => {
    const ag = await ctx.api('get', '/remittance/agency-bill/agencies?billPeriod=2026-09');
    expect(ag.body.data.map((a) => a.agencyCode)).toEqual(expect.arrayContaining(['AG001', 'AG002']));
    const agentId = ag.body.data.find((a) => a.agencyCode === 'AG004').id;
    const [pol] = await policyFor('MALAYAN');
    // the agent's policy incepts in the bill period
    await pool.query('UPDATE policies SET owner_user_id = $1, inception_date = \'2026-09-15\' WHERE id = $2', [agentId, pol.id]);
    const g = await ctx.api('post', '/remittance/agency-bill/generate').send({ billPeriod: '2026-09', billRunDate: '2026-09-28', agencyCodes: ['AG004'] });
    expect(g.status).toBe(201);
    expect(g.body.data.agencyBills[0]).toMatchObject({ agencyCode: 'AG004', billDate: '2026-09-28', dueDate: '2026-10-28', status: 'Generated' });
    expect((await ctx.api('post', '/remittance/agency-bill/generate').send({ billPeriod: '2026-09', agencyCodes: ['AG004'] })).status).toBe(400);
    const list = await ctx.api('get', '/remittance/agency-bill');
    expect(list.body.data.some((b) => b.agencyCode === 'AG002' && b.previousBalance === 5000)).toBe(true);
    const sent = await ctx.api('post', `/remittance/bills/${g.body.data.agencyBills[0].id}/send`).send({ email: 'agency@example.ph' });
    expect(sent.body.data).toMatchObject({ billStatus: 'Sent', emailedTo: 'agency@example.ph' });
  });
});

describe('work items', () => {
  it('adjustments follow the adjustment-type master and approval', async () => {
    expect((await ctx.api('post', '/remittance/adjustments').send({ adjustmentType: 'Unknown', adjustmentAmount: 5, reason: 'x', effectiveDate: '2026-09-30' })).status).toBe(400);
    const a = await ctx.api('post', '/remittance/adjustments').send({ referenceNo: 'ADJ-MEMO-1', adjustmentType: 'Premium Adjustment', adjustmentAmount: -5000, originalAmount: 125000, effectiveDate: '2026-09-30', description: 'Coverage change', reason: 'Correction', policyNo: 'POL-2026-90002' });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ referenceNo: 'ADJ-MEMO-1', status: 'Pending Approval', newAmount: 120000 });
    expect((await ctx.api('post', '/remittance/adjustments').send({ referenceNo: 'ADJ-MEMO-1', adjustmentType: 'Premium Adjustment', adjustmentAmount: 1, effectiveDate: '2026-09-30', reason: 'x' })).status).toBe(409);
    const auto = await ctx.api('post', '/remittance/adjustments').send({ adjustmentType: 'Additional Charge', adjustmentAmount: 2500, effectiveDate: '2026-09-30', reason: 'Late payment charge' });
    expect(auto.body.data.status).toBe('Approved');
    const done = await ctx.api('post', `/remittance/adjustments/${auto.body.data.id}/complete`);
    expect(done.body.data.status).toBe('Completed');
    const h = await ctx.api('get', '/remittance/adjustments/history');
    expect(h.body.data.some((x) => x.referenceNo === auto.body.data.referenceNo && x.processedBy)).toBe(true);
  });
  it('electronic transfers are closed for TISPH: insurers are paid from Insurer payments', async () => {
    const t = await ctx.api('post', '/remittance/transfers').send({ beneficiary: 'Standard Insurance Co., Inc.', amount: 40000, method: 'InstaPay', purpose: 'Premium' });
    expect(t.status).toBe(409);
    expect(t.body.message).toBe('Electronic transfers are replaced by Insurer payments.');
    expect(t.body.errors[0].code).toBe('TRANSFERS_OFF');
    const [approved] = (await pool.query("SELECT id FROM remittance_items WHERE kind = 'transfer' AND status = 'Approved' LIMIT 1")).rows;
    expect((await ctx.api('post', `/remittance/transfers/${approved.id}/execute`).send({ status: 'Completed', bankReference: 'IP-0' })).status).toBe(409);
    expect((await as(sales, 'post', '/remittance/transfers').send({})).status).toBe(403);
  });
  it('electronic transfers check method limits and need approval before execution (transfers on)', async () => {
    await pool.query("UPDATE app_settings SET value = 'true' WHERE key = 'remittance.transfers_enabled'");
    clearSettingsCache();
    const m = await ctx.api('get', '/remittance/transfers/methods');
    expect(m.body.data.find((x) => x.value === 'InstaPay').limit).toBe(50000);
    expect((await ctx.api('post', '/remittance/transfers').send({ beneficiary: 'X', amount: 60000, method: 'InstaPay' })).status).toBe(400);
    const t = await ctx.api('post', '/remittance/transfers').send({ beneficiary: 'Standard Insurance Co., Inc.', amount: 40000, method: 'InstaPay', purpose: 'Premium' });
    expect(t.body.data).toMatchObject({ status: 'Pending', method: 'InstaPay' });
    expect((await ctx.api('post', `/remittance/transfers/${t.body.data.id}/execute`).send({ status: 'Completed' })).status).toBe(409);
    await as(fin, 'post', `/remittance/approvals/${(await ctx.api('get', '/remittance/approvals?transactionType=Electronic%20Transfer')).body.data.find((a) => a.entityId === t.body.data.id).id}/approve`).send({ comments: 'ok' });
    const ex = await ctx.api('post', `/remittance/transfers/${t.body.data.id}/execute`).send({ status: 'Completed', bankReference: 'IP-1' });
    expect(ex.body.data.status).toBe('Completed');
    // a transfer still pending when transfers are switched off cannot be approved (it would post its journal); it can be rejected
    const p1 = await ctx.api('post', '/remittance/transfers').send({ beneficiary: 'Standard Insurance Co., Inc.', amount: 30000, method: 'InstaPay', purpose: 'Premium' });
    const p2 = await ctx.api('post', '/remittance/transfers').send({ beneficiary: 'Standard Insurance Co., Inc.', amount: 20000, method: 'InstaPay', purpose: 'Premium' });
    await pool.query("UPDATE app_settings SET value = 'false' WHERE key = 'remittance.transfers_enabled'");
    clearSettingsCache();
    const pending = (await ctx.api('get', '/remittance/approvals?transactionType=Electronic%20Transfer')).body.data;
    const a1 = pending.find((a) => a.entityId === p1.body.data.id);
    const refused = await as(fin, 'post', `/remittance/approvals/${a1.id}/approve`).send({ comments: 'ok' });
    expect(refused.status).toBe(409);
    expect(refused.body.message).toBe('Electronic transfers are replaced by Insurer payments.');
    expect((await pool.query('SELECT status, journal_id FROM remittance_items WHERE id = $1', [p1.body.data.id])).rows[0]).toMatchObject({ status: 'Pending', journal_id: null });
    const a2 = pending.find((a) => a.entityId === p2.body.data.id);
    const rejected = await as(fin, 'post', `/remittance/approvals/${a2.id}/reject`).send({ reasonCode: 'RRJ-OTHER', note: 'Paid from Insurer payments' });
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);
  });
  it('statements, reports and exceptions', async () => {
    const s = await ctx.api('post', '/remittance/statements/generate').send({ period: '2025-12', selectionType: 'all', templateCode: 'STM-001' });
    expect(s.status).toBe(201);
    expect(s.body.data.rowCount).toBeGreaterThan(0);
    const file = await request(ctx.app).get(s.body.data.downloadUrl.replace(/^https?:\/\/[^/]+/, ''));
    expect(file.status).toBe(200);
    expect(file.text).toContain('Policy Number');
    expect((await ctx.api('post', '/remittance/statements/generate').send({})).status).toBe(400);
    expect((await ctx.api('get', '/remittance/statements')).body.total).toBe(1);
    // the orphan Remittance > Reports screen and its template master are gone: Reports > Remittance summary is the report
    expect((await ctx.api('get', '/remittance/reports/templates')).status).toBe(404);
    expect((await ctx.api('post', '/remittance/reports/generate').send({ templateCode: 'RPT-001' })).status).toBe(404);
    const e = await ctx.api('post', '/remittance/exceptions').send({ type: 'Amount Mismatch', severity: 'High', amount: 800, description: 'Short credit' });
    expect(e.body.data).toMatchObject({ status: 'Open', severity: 'High', age: 0 });
    expect((await ctx.api('post', `/remittance/exceptions/${e.body.data.id}/resolve`).send({})).status).toBe(400);
    const r = await ctx.api('post', `/remittance/exceptions/${e.body.data.id}/resolve`).send({ resolution: 'Insurer credited' });
    expect(r.body.data.status).toBe('Resolved');
    expect((await ctx.api('get', '/remittance/exceptions?status=Open')).body.data.length).toBeGreaterThanOrEqual(2);
  });
  it('notifications and schedules', async () => {
    const n = await ctx.api('post', '/remittance/notifications').send({ type: 'Payment Reminder', subject: 'Payment due', content: 'Please pay', recipients: 'a@x.example; b@x.example', channel: 'Email' });
    expect(n.body.data).toMatchObject({ status: 'Sent', recipients: 'a@x.example, b@x.example', queuedEmails: 2 });
    expect((await ctx.api('get', '/remittance/notifications/inbox')).body.data.length).toBeGreaterThan(0);
    expect((await ctx.api('get', '/remittance/notifications/templates')).body.data.length).toBeGreaterThan(0);
    const s = await ctx.api('get', '/remittance/schedules');
    expect(s.body.data.scheduledJobs.length).toBeGreaterThanOrEqual(2);
    const created = await ctx.api('post', '/remittance/schedules').send({ code: 'SCH-9', name: 'Weekly run', frequency: 'Weekly', nextRun: '2026-10-05', time: '09:00', linkedProcesses: ['ARM-001'] });
    expect(created.status).toBe(201);
    expect((await ctx.api('post', `/remittance/schedules/${created.body.data.id}/run`)).status).toBe(400);
    const run = await ctx.api('post', `/remittance/schedules/${created.body.data.id}/run`).send({ reasonCode: 'ROC-MISSED' });
    expect(run.status, JSON.stringify(run.body)).toBe(200);
    expect(run.body.data.run.executionRef).toMatch(/^BLK-/);
    expect(run.body.data.run).toMatchObject({ scheduleCode: 'SCH-9', reason: { code: 'ROC-MISSED', text: 'Missed run' } });
    expect((await ctx.api('post', `/remittance/schedules/${created.body.data.id}/run`).send({ reasonCode: 'ROC-MISSED' })).body.errors[0].code).toBe('WINDOW_DONE');
    const paused = await ctx.api('patch', `/remittance/schedules/${created.body.data.id}/status`).send({ status: 'Paused' });
    expect(paused.body.data.status).toBe('Inactive');
    const again = await ctx.api('post', `/remittance/schedules/${created.body.data.id}/run`).send({ reasonCode: 'ROC-MISSED' });
    expect(again.status).toBe(409);
    expect(again.body.errors[0].code).toBe('PAUSED');
    // approval cover is given in Master > User Management > Delegations (user_delegations), not on the Remittance screen
    expect((await ctx.api('post', '/remittance/approvals/delegations').send({ delegateTo: 'r.finance', fromDate: '2026-10-01', toDate: '2026-10-07', reason: 'Leave' })).status).toBe(404);
  });
  it('automated candidates and execution', async () => {
    const c = await ctx.api('get', '/remittance/automated/candidates');
    expect(c.status).toBe(200);
    expect(c.body.data.every((x) => x.scheduleCode && x.insurerCode)).toBe(true);
    const e = await ctx.api('post', '/remittance/automated/execute').send({});
    expect(e.status).toBe(200);
    expect((await ctx.api('get', '/remittance/automated/history')).body.data.length).toBeGreaterThanOrEqual(3);
  });
  it('bulk upload is closed for TISPH: Import policy list replaces it', async () => {
    const r = await ctx.api('post', '/remittance/bulk/upload').field('configCode', 'BFM-001').attach('file', Buffer.from('PolicyNo,Premium\nX,1\n'), 'x.csv');
    expect(r.status).toBe(409);
    expect(r.body.errors[0]).toMatchObject({ code: 'USE_IMPORT', link: '/finance/remittance/remittances?import=new' });
    expect((await ctx.api('post', '/remittance/bulk/rmi_x/process')).status).toBe(409);
    expect((await ctx.api('get', '/remittance/bulk/template')).status).toBe(409);
    expect((await ctx.api('get', '/remittance/bulk')).status).toBe(200);
    expect((await pool.query("SELECT status FROM master_records WHERE type_code = 'remittance-bulk-processing' AND code = 'BFM-002'")).rows).toEqual([]);
  });
  it('bulk upload validates rows against the configuration and processes valid ones at the booked amounts', async () => {
    await pool.query("UPDATE app_settings SET value = 'true' WHERE key = 'remittance.bulk_upload_enabled'");
    clearSettingsCache();
    const [pol] = await policyFor('MAAGAP');
    await pool.query('DELETE FROM remittance_lines WHERE policy_id = $1', [pol.id]);
    const booked = (await pool.query('SELECT premium_total, commission_amount FROM policies WHERE id = $1', [pol.id])).rows[0];
    const csv = `PolicyNo,Premium,Commission,InsuredName\n${pol.policy_number},10000,1500,Test\nNOPE-1,500,10,X\n,abc,1,Y\n`;
    const u = await ctx.api('post', '/remittance/bulk/upload').field('configCode', 'BFM-001').attach('file', Buffer.from(csv), { filename: 'sept.csv', contentType: 'text/csv' });
    expect(u.status).toBe(201);
    expect(u.body.data).toMatchObject({ totalRecords: 3, successCount: 1, errorCount: 2, status: 'Validated' });
    expect(u.body.data.validationResults.find((v) => v.field === 'premium_amount')).toMatchObject({ invalid: 1 });
    const p = await ctx.api('post', `/remittance/bulk/${u.body.data.id}/process`);
    expect(p.body.data.remittances).toHaveLength(1);
    expect(p.body.data.upload.status).toBe('Processed');
    // the typed premium and commission are not used
    const [line] = (await pool.query('SELECT premium, commission FROM remittance_lines WHERE remittance_id = $1', [p.body.data.remittances[0].id])).rows;
    expect(line.premium).toBe(Number(booked.premium_total));
    expect(line.premium).not.toBe(10000);
    expect((await ctx.api('post', '/remittance/bulk/upload').attach('file', Buffer.from('A,B\n1,2\n'), 'x.csv')).status).toBe(400);
  });
  it('bank reconciliation: auto-match, manual partial match with exception, unmatch', async () => {
    const before = await ctx.api('get', '/remittance/reconciliation');
    expect(before.body.data.bankTransactions.length).toBe(5);
    const am = await ctx.api('post', '/remittance/reconciliation/auto-match').send({});
    expect(am.body.data.matched).toBeGreaterThanOrEqual(2);
    const rec = (await ctx.api('get', '/remittance/reconciliation')).body.data;
    const bank = rec.bankTransactions.find((b) => b.status === 'unmatched');
    const sys = rec.systemTransactions.find((s) => s.status === 'unmatched');
    const mm = await ctx.api('post', '/remittance/reconciliation/match').send({ bankId: bank.id, remittanceId: sys.reference });
    expect(mm.body.data.status).toBe('partial');
    expect((await ctx.api('get', '/remittance/reconciliation')).body.data.exceptions.length).toBeGreaterThan(0);
    const un = await ctx.api('post', '/remittance/reconciliation/unmatch').send({ bankId: bank.id });
    expect(un.status).toBe(200);
    const imp = await ctx.api('post', '/remittance/reconciliation/bank-transactions').send({ transactions: [{ transDate: '2026-09-27', reference: 'PSN-1', amount: 1000 }] });
    expect(imp.body.data).toHaveLength(1);
    const bad = await ctx.api('post', '/remittance/reconciliation/bank-transactions').send({ transactions: [{ transDate: '2026-09-28', reference: 'PSN-2', amount: '500' }, { transDate: '2026-09-28', reference: 'PSN-3', amount: '' }] });
    expect(bad.status).toBe(400);
    expect(bad.body.errors).toEqual([{ path: 'transactions.1', message: 'Line 2: needs TransDate, Reference and Amount' }]);
    expect((await pool.query("SELECT count(*)::int AS n FROM bank_statement_lines WHERE reference IN ('PSN-2', 'PSN-3')")).rows[0].n).toBe(0);
  });
  it('analytics, history, audit, logs and master overview', async () => {
    const a = await ctx.api('get', '/remittance/analytics?from=2025-01-01&to=2026-12-31');
    expect(a.body.data.kpiData.map((k) => k.name)).toEqual(['Settlement Efficiency', 'Payment Success Rate', 'Average Processing Time', 'Exception Rate']);
    expect(a.body.data.kpiData[0].target).toBe(95);
    expect(a.body.data.topClients.length).toBeGreaterThan(0);
    const h = await ctx.api('get', '/remittance/history?perPage=5');
    expect(h.body.total).toBeGreaterThan(10);
    const au = await ctx.api('get', '/remittance/history/audit');
    expect(au.body.data.length).toBeGreaterThan(0);
    expect((await ctx.api('get', '/remittance/history/system-logs')).body.data.length).toBeGreaterThan(0);
    const m = await ctx.api('get', '/remittance/masters');
    // the configuration types of the Remittance Master; schedules (Scheduling) and the retired types are not listed
    expect([...new Set(m.body.data.map((x) => x.type))].sort()).toEqual(['Adjustment', 'AgencyBill', 'Automated', 'BulkProcessing', 'Exception', 'Notification', 'Settlement', 'Statement']);
    expect((await ctx.api('get', '/remittance/masters?type=Automated')).body.data.every((x) => x.type === 'Automated')).toBe(true);
  });
  it('denies users without remittance permission', async () => {
    expect((await as(sales, 'get', '/remittance/remittances')).status).toBe(403);
    expect((await as(sales, 'post', '/remittance/transfers').send({})).status).toBe(403);
    expect((await as(fin, 'get', '/remittance/remittances')).status).toBe(200);
  });
});
