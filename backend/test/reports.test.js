import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { config } from '../src/config.js';
import { generateReport, scheduledReport } from '../src/modules/reports/service.js';

let ctx;
const tokens = {};
const createdFiles = [];
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`);
const Y = { FromDate: '2025-01-01', ToDate: '2025-12-31', Branch: 'RPT' };

/** Sample data for the shared tables, isolated in branch RPT so other modules' seed data does not affect totals. */
async function seedSample() {
  await query(`INSERT INTO branches(code, name, address) VALUES ('RPT', 'Reports Test Branch', 'Pasig City') ON CONFLICT (code) DO NOTHING`);
  await query(`INSERT INTO users(id, username, password_hash, display_name, branch_code) VALUES
    ('usr_rpt_a1', 'rpt.agent1', 'x', 'Ramon Bautista', 'RPT'), ('usr_rpt_a2', 'rpt.agent2', 'x', 'Liza Mercado', 'RPT'),
    ('usr_rpt_mk', 'rpt.maker', 'x', 'Carmela Ocampo', 'RPT')`);
  await query(`INSERT INTO clients(id, client_code, display_name, client_type) VALUES
    ('cl_rpt1', 'RPT-C1', 'Dela Cruz Trading Corp', 'corporate'), ('cl_rpt2', 'RPT-C2', 'Maria Santos', 'individual')`);
  const ic = async (code) => (await one('SELECT id FROM insurance_companies WHERE code = $1', [code])).id;
  const pr = async (code) => (await one('SELECT id FROM products WHERE code = $1', [code])).id;
  const [mapfre, malayan, pioneer, motor, fire] = [await ic('MAPFRE'), await ic('MALAYAN'), await ic('PIONEER'), await pr('MOTOR'), await pr('FIRE')];
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total, commission_amount, renewed_from) VALUES
    ('pol_rpt0', 'RPT-POL-0', 'cl_rpt2', $3, $5, 'usr_rpt_a2', 'renewed', '2024-03-20', '2025-03-20', 800000, 14000, 2100, NULL),
    ('pol_rpt1', 'RPT-POL-1', 'cl_rpt1', $3, $1, 'usr_rpt_a1', 'active', '2025-02-10', '2026-02-10', 500000, 10000, 1500, NULL),
    ('pol_rpt2', 'RPT-POL-2', 'cl_rpt1', $4, $2, 'usr_rpt_a1', 'active', '2025-03-05', '2026-03-05', 2000000, 20000, 3000, NULL),
    ('pol_rpt3', 'RPT-POL-3', 'cl_rpt2', $3, $1, 'usr_rpt_a2', 'active', '2025-03-20', '2026-03-20', 800000, 15000, 2250, 'pol_rpt0')`, [mapfre, malayan, motor, fire, pioneer]);
  await query(`INSERT INTO receivables(id, bill_number, policy_id, client_id, amount, balance, due_date, status, created_at) VALUES
    ('rcv_rpt1', 'RPT-BILL-1', 'pol_rpt1', 'cl_rpt1', 10000, 0, '2025-03-10', 'paid', '2025-02-10'),
    ('rcv_rpt2', 'RPT-BILL-2', 'pol_rpt2', 'cl_rpt1', 20000, 12000, '2025-04-05', 'partial', '2025-03-05'),
    ('rcv_rpt3', 'RPT-BILL-3', 'pol_rpt3', 'cl_rpt2', 15000, 15000, '2025-04-20', 'open', '2025-03-20')`);
  await query(`INSERT INTO receipts(receipt_number, receivable_id, policy_id, client_id, amount, payment_mode, received_date, status) VALUES
    ('RPT-OR-1', 'rcv_rpt1', 'pol_rpt1', 'cl_rpt1', 10000, 'check', '2025-03-01', 'posted'),
    ('RPT-OR-2', 'rcv_rpt2', 'pol_rpt2', 'cl_rpt1', 8000, 'bank-transfer', '2025-04-01', 'posted'),
    ('RPT-OR-3', 'rcv_rpt2', 'pol_rpt2', 'cl_rpt1', 500, 'cash', '2025-04-02', 'cancelled')`);
  await query(`INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, reported_date, estimate_amount, approved_amount, settled_amount, settled_at) VALUES
    ('RPT-CLM-1', 'pol_rpt1', 'cl_rpt1', 'registered', '2025-03-30', '2025-04-01', 5000, NULL, NULL, NULL),
    ('RPT-CLM-2', 'pol_rpt2', 'cl_rpt1', 'settled', '2025-04-28', '2025-05-01', 8000, 7000, 7000, '2025-06-01'),
    ('RPT-CLM-3', 'pol_rpt3', 'cl_rpt2', 'rejected', '2025-05-30', '2025-06-01', 3000, NULL, NULL, NULL)`);
  await query(`INSERT INTO renewals(policy_id, status, due_date, new_policy_id, premium_old, premium_new) VALUES
    ('pol_rpt0', 'renewed', '2025-03-20', 'pol_rpt3', 14000, 15000), ('pol_rpt1', 'lapsed', '2025-11-01', NULL, 10000, NULL),
    ('pol_rpt2', 'pipeline', '2025-12-01', NULL, 20000, NULL)`);
  await query(`INSERT INTO commissions(policy_id, agent_user_id, basis_amount, rate, amount, withholding, net_amount, status, period, created_at) VALUES
    ('pol_rpt1', 'usr_rpt_a1', 10000, 0.15, 1500, 150, 1350, 'paid', '2025-02', '2025-02-15'),
    ('pol_rpt3', 'usr_rpt_a2', 15000, 0.15, 2250, 225, 2025, 'accrued', '2025-03', '2025-03-25')`);
  await query(`INSERT INTO remittances(id, remittance_number, insurance_company_id, period, gross_premium, commission, net_due, status, created_by, created_at) VALUES
    ('rm_rpt1', 'RPT-RM-1', $1, '2025-03', 25000, 3750, 21250, 'settled', 'rpt.maker', '2025-04-30')`, [mapfre]);
  await query(`INSERT INTO remittance_lines(remittance_id, policy_id, premium, commission, net) VALUES ('rm_rpt1', 'pol_rpt1', 10000, 1500, 8500), ('rm_rpt1', 'pol_rpt3', 15000, 2250, 12750)`);
  await query(`INSERT INTO disbursements(voucher_number, payee_type, payee_id, payee_name, amount, status, purpose, created_by, created_at) VALUES
    ('RPT-PV-1', 'Insurer', $1::text, 'MAPFRE Insurance Corporation', 21250, 'paid', 'Premium remittance', 'usr_rpt_mk', '2025-05-02'),
    ('RPT-PV-2', 'Agent/Referrer', 'usr_rpt_a1', 'Ramon Bautista', 1350, 'paid', 'Commission payout', 'usr_rpt_mk', '2025-05-03')`, [mapfre]);
  await query(`INSERT INTO journal_vouchers(id, jv_number, jv_date, description, status, total_debit, total_credit, created_by) VALUES
    ('jv_rpt1', 'RPT-JV-1', '2024-12-31', 'Opening capital', 'approved', 1000, 1000, 'rpt.maker'),
    ('jv_rpt2', 'RPT-JV-2', '2025-03-01', 'Premium collected', 'posted', 10000, 10000, 'rpt.maker'),
    ('jv_rpt3', 'RPT-JV-3', '2025-04-01', 'Draft expense', 'draft', 999, 999, 'rpt.maker')`);
  await query(`INSERT INTO journal_lines(jv_id, account_code, account_name, debit, credit) VALUES
    ('jv_rpt1', '1010', 'Cash in Bank', 1000, 0), ('jv_rpt1', '3000', 'Capital', 0, 1000),
    ('jv_rpt2', '1010', 'Cash in Bank', 10000, 0), ('jv_rpt2', '1200', 'Premium Receivable', 0, 10000),
    ('jv_rpt3', '5000', 'Office Expense', 999, 0), ('jv_rpt3', '1010', 'Cash in Bank', 0, 999)`);
  await query(`INSERT INTO leads(lead_number, display_name, status, owner_user_id, source, created_at) VALUES
    ('RPT-LD-1', 'Juan Reyes', 'new', 'usr_rpt_a1', 'referral', '2025-02-01'), ('RPT-LD-2', 'Ana Lim', 'new', 'usr_rpt_a1', 'walk-in', '2025-02-02'),
    ('RPT-LD-3', 'Pedro Tan', 'contacted', 'usr_rpt_a2', 'referral', '2025-02-03'), ('RPT-LD-4', 'Maria Santos', 'converted', 'usr_rpt_a2', 'website', '2025-02-04')`);
  const t = await one(`INSERT INTO reinsurance_treaties(name, reinsurer, treaty_type, share) VALUES ('RPT Quota Share 2025', 'Fictional Re', 'quota-share', 0.5) RETURNING id`);
  await query(`INSERT INTO cessions(treaty_id, policy_id, ceded_sum, ceded_premium, created_at) VALUES ($1, 'pol_rpt2', 1000000, 10000, '2025-03-06')`, [t.id]);
  const ip = await one(`INSERT INTO incentive_programs(name, metric, target, period_from, period_to) VALUES ('RPT Q1 Motor Push', 'premium', 100000, '2025-01-01', '2025-03-31') RETURNING id`);
  await query(`INSERT INTO incentive_results(program_id, agent_user_id, achieved, payout, period) VALUES ($1, 'usr_rpt_a1', 30000, 0, '2025-Q1'), ($1, 'usr_rpt_a2', 120000, 5000, '2025-Q1')`, [ip.id]);
}

beforeAll(async () => {
  ctx = await setup();
  tokens.admin = ctx.token;
  for (const [u, role] of [['rpt.sales', 'sales'], ['rpt.finance', 'finance'], ['rpt.agentrole', 'agent']]) {
    const r = await ctx.api('post', '/users').send({ username: u, password: 'Welcome@123', displayName: u, roles: [role] });
    expect(r.status).toBe(201);
    tokens[role] = await loginAs(ctx.app, u, 'Welcome@123');
  }
  await seedSample();
});
afterAll(async () => {
  for (const f of createdFiles) if (fs.existsSync(f)) fs.unlinkSync(f);
  await pool.end();
});

const run = async (code, body, who = 'admin') => {
  const r = await as(who, 'post', `/reports/${code}/run`).send(body);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};

describe('report catalogue', () => {
  it('lists every report for admins and filters by role for personas', async () => {
    const all = await as('admin', 'get', '/reports');
    expect(all.status).toBe(200);
    const codes = all.body.data.map((d) => d.code);
    for (const c of ['production-register', 'claims-position', 'renewal-retention', 'remittance-summary', 'commission-statement', 'premium-receivable-soa', 'collections-summary', 'disbursement-register', 'journal-register', 'trial-balance']) expect(codes).toContain(c);
    expect(codes.length).toBeGreaterThanOrEqual(18);
    const sales = (await as('sales', 'get', '/reports')).body.data.map((d) => d.code);
    expect(sales).toContain('production-register');
    expect(sales).not.toContain('trial-balance');
    const fin = (await as('finance', 'get', '/reports?category=financial')).body.data;
    expect(fin.map((d) => d.code)).toContain('trial-balance');
    expect(fin.every((d) => d.category === 'financial')).toBe(true);
    expect((await as('agent', 'get', '/reports')).status).toBe(403);
  });
  it('returns a definition with the screen filter schema', async () => {
    const r = await as('admin', 'get', '/reports/production-register');
    expect(r.body.data.parameters.properties.ReportCriteria.enum).toEqual(['Overall', 'Agent', 'Principle Insurance', 'Branch']);
    expect(r.body.data.parameters.properties.Agent['x-enabledWhen']).toEqual({ ReportCriteria: ['Agent'] });
    expect(r.body.data.columns.find((c) => c.key === 'premium').type).toBe('money');
    expect((await as('admin', 'get', '/reports/nope')).status).toBe(404);
  });
});

describe('running reports', () => {
  it('production register: rows, totals, summary, criteria groups and filters', async () => {
    const b = await run('production-register', { ...Y, ReportCriteria: 'Overall' });
    expect(b.total).toBe(3);
    expect(b.data.totals.premium).toBe(45000);
    expect(b.data.summary).toMatchObject({ newBusiness: 2, renewals: 1 });
    expect(b.data.rows[0]).toMatchObject({ policyNumber: 'RPT-POL-1', client: 'Dela Cruz Trading Corp', branch: 'Reports Test Branch' });
    expect(b.data.rows[0]._agent_id).toBeUndefined();
    const byAgent = await run('production-register', { ...Y, ReportCriteria: 'Agent' });
    expect(byAgent.data.groups).toEqual([
      expect.objectContaining({ group: 'Liza Mercado', count: 1, premium: 15000 }),
      expect.objectContaining({ group: 'Ramon Bautista', count: 2, premium: 30000 })]);
    expect((await run('production-register', { ...Y, ReportCriteria: 'Agent', Agent: 'rpt.agent1' })).data.totals.premium).toBe(30000);
    expect((await run('production-register', { ...Y, ReportCriteria: 'Principle Insurance', Company: 'MAPFRE' })).data.totals.premium).toBe(25000);
    // the screens list the broker itself under Company: treated as "all insurers"
    const own = (await one('SELECT value FROM app_settings WHERE key = \'general.company_name\'')).value;
    expect((await run('production-register', { ...Y, Company: own })).total).toBe(3);
    const paged = await run('production-register', { ...Y, page: 2, perPage: 2 });
    expect(paged).toMatchObject({ total: 3, page: 2, perPage: 2, totalPages: 2 });
    expect(paged.data.rows).toHaveLength(1);
    // browser Date objects arrive as UTC instants and are read in the business time zone (Asia/Manila)
    const tz = await run('production-register', { FromDate: '2025-02-09T16:00:00.000Z', ToDate: '2025-02-10T15:59:59.000Z', Branch: 'RPT' });
    expect(tz.data.params).toMatchObject({ from: '2025-02-10', to: '2025-02-10' });
    expect(tz.total).toBe(1);
  });
  it('claims position by criteria', async () => {
    expect((await run('claims-position', { ...Y, ReportCriteria: 'All' })).total).toBe(3);
    const open = await run('claims-position', { ...Y, ReportCriteria: 'Open' });
    expect(open.data.rows.map((r) => r.claimNumber)).toEqual(['RPT-CLM-1']);
    expect((await run('claims-position', { ...Y, ReportCriteria: 'Settled' })).data.totals.settledAmount).toBe(7000);
    expect((await run('claims-position', { ...Y, ReportCriteria: 'Rejected' })).total).toBe(1);
    const aging = await run('claims-position', { ...Y, ReportCriteria: 'Aging' });
    expect(aging.data.groups).toHaveLength(1);
    expect(aging.data.groups[0]).toMatchObject({ count: 1, estimateAmount: 5000 });
    const ca = await run('claims-ageing', { ...Y });
    expect(ca.data.rows[0]).toMatchObject({ claims: 1, estimateAmount: 5000 });
  });
  it('renewal retention, commission statement and remittance summary', async () => {
    const r = await run('renewal-retention', { ...Y });
    expect(r.total).toBe(3);
    expect(r.data.summary).toMatchObject({ retained: 1, lost: 1, pending: 1, retentionRate: 50 });
    const c = await run('commission-statement', { ...Y, ReportCriteria: 'Agent' });
    expect(c.data.totals).toMatchObject({ amount: 3750, withholding: 375, netAmount: 3375 });
    expect(c.data.groups).toHaveLength(2);
    const rm = await run('remittance-summary', { ...Y });
    expect(rm.data.rows[0]).toMatchObject({ remittanceNumber: 'RPT-RM-1', policies: 2, netDue: 21250, agent: 'Carmela Ocampo' });
  });
  it('receivables, collections, receipts and disbursements', async () => {
    const soa = await run('premium-receivable-soa', { ...Y });
    expect(soa.data.totals).toMatchObject({ amount: 45000, paid: 18000, balance: 27000 });
    const col = await run('collections-summary', { ...Y });
    expect(col.data.totals).toMatchObject({ billed: 45000, collected: 18000 });
    expect(col.data.summary.collectionEfficiency).toBe(40);
    const age = await run('collections-ageing', { ...Y, ToDate: '2025-05-20' });
    expect(age.data.groups.map((g) => [g.group, g.count, g.balance])).toEqual([['0-30', 1, 15000], ['31-60', 1, 12000]]);
    const rc = await run('receipts-register', { ...Y });
    expect(rc.total).toBe(3);
    expect((await run('receipts-register', { ...Y, status: 'posted' })).data.totals.amount).toBe(18000);
    const pv = await run('disbursement-register', { ...Y, ReportCriteria: 'Payee Type' });
    expect(pv.data.totals.amount).toBe(22600);
    // payee types as the voucher screen stores them
    expect(pv.data.groups.map((g) => g.group)).toEqual(['Agent/Referrer', 'Insurer']);
    expect(pv.data.rows.find((r) => r.voucherNumber === 'RPT-PV-1').insurer).toBe('MAPFRE Insurance Corporation');
    expect((await run('disbursement-register', { ...Y, Company: 'MAPFRE' })).data.totals.amount).toBe(21250);
  });
  it('journal register and a balanced trial balance from approved/posted vouchers only', async () => {
    const j = await run('journal-register', { ...Y });
    expect(j.total).toBe(4);
    expect((await run('journal-register', { ...Y, status: 'posted' })).data.totals.debit).toBe(10000);
    const tb = await run('trial-balance', { ...Y });
    const acc = Object.fromEntries(tb.data.rows.map((r) => [r.accountCode, r]));
    expect(acc['1010']).toMatchObject({ openingBalance: 1000, periodDebit: 10000, closingDebit: 11000, closingCredit: 0 });
    expect(acc['1200']).toMatchObject({ closingCredit: 10000 });
    expect(acc['5000']).toBeUndefined();
    expect(tb.data.totals).toMatchObject({ closingDebit: 11000, closingCredit: 11000 });
    expect(tb.data.summary.balanced).toBe(true);
  });
  it('aggregate reports: premium by product/month, new vs renewal, lead funnel, cessions, incentives', async () => {
    const m = await run('premium-by-product', { ...Y, ReportCriteria: 'Month' });
    expect(m.data.rows).toEqual([expect.objectContaining({ month: '2025-02', premium: 10000 }), expect.objectContaining({ month: '2025-03', premium: 35000, policies: 2 })]);
    expect(m.data.columns.map((c) => c.key)).not.toContain('product');
    const p = await run('premium-by-product', { ...Y, ReportCriteria: 'Product' });
    expect(p.data.rows.find((r) => r.product === 'Motor Vehicle Insurance')).toMatchObject({ policies: 2, premium: 25000 });
    const nr = await run('new-vs-renewal', { ...Y, ReportCriteria: 'Business Type' });
    expect(nr.data.rows).toEqual([expect.objectContaining({ businessType: 'New Business', policies: 2, premium: 30000 }), expect.objectContaining({ businessType: 'Renewal', policies: 1, premium: 15000 })]);
    const f = await run('lead-conversion-funnel', { ...Y });
    expect(f.data.rows.map((r) => [r.stage, r.leads])).toEqual([['new', 2], ['contacted', 1], ['converted', 1]]);
    expect(f.data.summary.conversionRate).toBe(25);
    const cs = await run('cession-register', { ...Y });
    expect(cs.data.rows[0]).toMatchObject({ treaty: 'RPT Quota Share 2025', cededSum: 1000000, cededPct: 50 });
    const inc = await run('incentive-results', { ...Y });
    expect(inc.data.rows.find((r) => r.agent === 'Liza Mercado')).toMatchObject({ achievementPct: 120, payout: 5000 });
  });
  it('validates parameters and access', async () => {
    expect((await as('admin', 'post', '/reports/production-register/run').send({ ReportCriteria: 'Nope' })).status).toBe(400);
    expect((await as('admin', 'post', '/reports/production-register/run').send({ FromDate: '2025-12-31', ToDate: '2025-01-01' })).status).toBe(400);
    expect((await as('admin', 'post', '/reports/production-register/run').send({ FromDate: 'yesterday-ish' })).status).toBe(400);
    expect((await as('sales', 'post', '/reports/trial-balance/run').send(Y)).status).toBe(403);
    expect((await as('finance', 'post', '/reports/trial-balance/run').send(Y)).status).toBe(200);
    expect((await as('agent', 'post', '/reports/production-register/run').send(Y)).status).toBe(403);
    expect((await request(ctx.app).post('/api/reports/production-register/run').send(Y)).status).toBe(401);
  });
});

describe('generated files', () => {
  const gen = async (code, body, who = 'admin') => {
    const r = await as(who, 'post', `/reports/${code}/generate`).send(body);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    createdFiles.push(path.resolve(config.uploadDir, (await one('SELECT storage_key FROM generated_reports WHERE id = $1', [r.body.data.id])).storage_key));
    return r.body.data;
  };
  it('writes CSV, XLSX and PDF files, records history and serves downloads', async () => {
    const csv = await gen('production-register', { ...Y, format: 'csv' });
    expect(csv).toMatchObject({ format: 'csv', rowCount: 3, status: 'done' });
    const dl = await as('admin', 'get', `/reports/generated/${csv.id}/download`).buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
    expect(dl.status).toBe(200);
    const text = dl.body.toString('utf8');
    expect(text.startsWith('﻿Policy No.,Issue Date')).toBe(true);
    expect(text).toContain('RPT-POL-3');
    expect(text).toMatch(/TOTAL,.*45000/);

    const x = await gen('trial-balance', { ...Y, format: 'xlsx' }, 'finance');
    const xfile = createdFiles[createdFiles.length - 1];
    expect(execFileSync('unzip', ['-t', xfile]).toString()).toContain('No errors detected');
    const sheet = execFileSync('unzip', ['-p', xfile, 'xl/worksheets/sheet1.xml']).toString();
    expect(sheet).toContain('<pane ySplit="1"');
    expect(sheet).toContain('<autoFilter');
    expect((sheet.match(/<row /g) || []).length).toBe(x.rowCount + 2); // header + rows + totals
    expect(execFileSync('unzip', ['-p', xfile, 'xl/sharedStrings.xml']).toString()).toContain('Cash in Bank');

    const pdf = await gen('claims-position', { ...Y, ReportCriteria: 'All', format: 'pdf' });
    const pbuf = fs.readFileSync(createdFiles[createdFiles.length - 1]);
    expect(pbuf.subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(pbuf.toString('latin1')).toContain('RPT-CLM-2');
    expect(pdf.fileName).toMatch(/^claims-position_2025-01-01_2025-12-31_.*\.pdf$/);

    // signed link works without a bearer token; a tampered one does not
    const link = new URL(pdf.downloadUrl);
    const ok = await request(ctx.app).get(`${link.pathname}${link.search}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('application/pdf');
    expect((await request(ctx.app).get(`${link.pathname}?token=bad`)).status).toBe(403);
    expect((await request(ctx.app).get(link.pathname)).status).toBe(403);
    // sales may not download a finance-only report file
    expect((await as('sales', 'get', `/reports/generated/${x.id}/download`)).status).toBe(403);

    const hist = await as('admin', 'get', '/reports/generated?perPage=50');
    expect(hist.body.data.map((h) => h.id)).toEqual(expect.arrayContaining([csv.id, x.id, pdf.id]));
    const salesHist = await as('sales', 'get', '/reports/generated?perPage=50');
    expect(salesHist.body.data.map((h) => h.id)).not.toContain(x.id);
    expect((await as('admin', 'post', '/reports/production-register/generate').send({ format: 'docx' })).status).toBe(400);
    const a = await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'generated_report\' AND action = \'generate\'');
    expect(a.n).toBeGreaterThanOrEqual(3);
  });
  it('generateReport(code, params, "schedule") works for the daily-reports job', async () => {
    const r = await generateReport('production-register', {}, 'schedule');
    createdFiles.push(path.resolve(config.uploadDir, (await one('SELECT storage_key FROM generated_reports WHERE id = $1', [r.id])).storage_key));
    expect(r).toMatchObject({ code: 'production-register', status: 'done', triggeredBy: 'schedule' });
    expect(['csv', 'xlsx', 'pdf']).toContain(r.format);
  });
});

describe('report schedules', () => {
  let id;
  it('creates a schedule backed by a scheduledReport job', async () => {
    expect((await as('finance', 'post', '/reports/schedules').send({ reportCode: 'trial-balance', cron: 'not a cron' })).status).toBe(400);
    expect((await as('finance', 'post', '/reports/schedules').send({ reportCode: 'trial-balance', cron: '0 6 * * *', recipients: 'not-an-email' })).status).toBe(400);
    expect((await as('sales', 'post', '/reports/schedules').send({ reportCode: 'trial-balance', cron: '0 6 * * *' })).status).toBe(403);
    expect((await as('agent', 'post', '/reports/schedules').send({ reportCode: 'production-register', cron: '0 6 * * *' })).status).toBe(403);
    const r = await as('finance', 'post', '/reports/schedules').send({
      name: 'Monthly trial balance', reportCode: 'trial-balance', cron: '0 6 1 * *', format: 'xlsx',
      params: { ...Y, ReportCriteria: 'Overall' }, recipients: 'controller@broker.example; cfo@broker.example',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    id = r.body.data.id;
    expect(r.body.data).toMatchObject({ reportCode: 'trial-balance', recipients: ['controller@broker.example', 'cfo@broker.example'], enabled: true, jobCode: `report-${id}` });
    const job = await one('SELECT * FROM scheduled_jobs WHERE code = $1', [`report-${id}`]);
    expect(job).toMatchObject({ handler: 'scheduledReport', cron: '0 6 1 * *', enabled: true });
    expect(job.params.scheduleId).toBe(id);
    const list = await as('finance', 'get', '/reports/schedules');
    expect(list.body.data.map((s) => s.id)).toContain(id);
    expect((await as('sales', 'get', '/reports/schedules')).body.data.map((s) => s.id)).not.toContain(id);
    expect((await as('finance', 'get', `/reports/schedules/${id}`)).body.data.name).toBe('Monthly trial balance');
  });
  it('updates the schedule and its job', async () => {
    const r = await as('finance', 'put', `/reports/schedules/${id}`).send({ cron: '30 7 * * 1', enabled: false, format: 'pdf' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ cron: '30 7 * * 1', enabled: false, format: 'pdf' });
    const job = await one('SELECT * FROM scheduled_jobs WHERE code = $1', [`report-${id}`]);
    expect(job).toMatchObject({ cron: '30 7 * * 1', enabled: false });
    expect(job.params.format).toBe('pdf');
    expect((await as('finance', 'put', `/reports/schedules/${id}`).send({ format: 'doc' })).status).toBe(400);
  });
  it('runs now: generates the file and queues the e-mail', async () => {
    const r = await as('finance', 'post', `/reports/schedules/${id}/run`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ code: 'trial-balance', format: 'pdf', emailed: 2 });
    createdFiles.push(path.resolve(config.uploadDir, (await one('SELECT storage_key FROM generated_reports WHERE id = $1', [r.body.data.reportId])).storage_key));
    const mail = await one('SELECT * FROM email_outbox WHERE entity = \'generated_report\' AND entity_id = $1', [r.body.data.reportId]);
    expect(mail.to_address).toBe('controller@broker.example,cfo@broker.example');
    expect(mail.subject).toContain('Trial Balance');
    expect(mail.body_html).toContain('/api/reports/generated/');
    const s = await one('SELECT last_status, last_report_id FROM report_schedules WHERE id = $1', [id]);
    expect(s).toMatchObject({ last_status: 'success', last_report_id: r.body.data.reportId });
    const direct = await scheduledReport({ reportCode: 'receipts-register', params: { period: 'year-to-date' }, format: 'csv', recipients: [] });
    createdFiles.push(path.resolve(config.uploadDir, (await one('SELECT storage_key FROM generated_reports WHERE id = $1', [direct.reportId])).storage_key));
    expect(direct).toMatchObject({ code: 'receipts-register', format: 'csv', emailed: 0 });
  });
  it('deletes the schedule and its job', async () => {
    expect((await as('sales', 'delete', `/reports/schedules/${id}`)).status).toBe(403);
    const r = await as('finance', 'delete', `/reports/schedules/${id}`);
    expect(r.status).toBe(200);
    expect(await one('SELECT 1 FROM scheduled_jobs WHERE code = $1', [`report-${id}`])).toBeNull();
    expect((await as('finance', 'get', `/reports/schedules/${id}`)).status).toBe(404);
    expect(await scheduledReport({ scheduleId: id })).toMatchObject({ skipped: expect.any(String) });
    const a = await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'report_schedule\'');
    expect(a.n).toBeGreaterThanOrEqual(4);
  });
});
