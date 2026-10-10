/**
 * Sales reports of TISPH (TIS-BRD-RPT-SLS-01..04, RPT-02, CR-13): the APR Operation Report per business category month
 * to date and year to date, Production per Product Line, Agent Policy Conversion with the incentive tier and payout,
 * and the Renewal Notice Listing in 30/60/90 day buckets with the lock-in treatment; who may run them.
 * The policies of the tests are written with their own insurer (RPTEST) and agent so that the sample data stays out.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

const PASSWORD = 'Welcome@123';
let ctx;
const as = {};
const run = (code, params, who = null) => (who ? as[who] : ctx.api)('post', `/reports/${code}/run`).send({ Company: 'RPTEST', ...params });
const byKey = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName: username, roles, email: `${username}@example.ph` });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = await loginAs(ctx.app, username, PASSWORD);
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  await persona('rp.sales', ['tis-sales-unit-head']);
  await persona('rp.finance', ['tis-finance']);
  await persona('rp.pdu', ['tis-ccd-pdu']);
  await query("INSERT INTO insurance_companies(code, name) VALUES ('RPTEST', 'Report Test Insurance Corp.')");
  await query("INSERT INTO clients(id, client_code, display_name, email, phone) VALUES ('cl_rp1', 'CL-RP-1', 'Andrea M. Villanueva', 'andrea@example.ph', '09173047105')");
  const motor = "(SELECT id FROM products WHERE code = 'MOTOR')";
  const pa = "(SELECT id FROM products WHERE code = 'PA')";
  const toyota = JSON.stringify({ vehicleBrand: 'Toyota', modelYear: '2024', vehicleModel: 'Raize', plateNumber: 'NAB 1234', chassisNumber: 'MHKA1BA1JPK000001', motorNumber: '1KRA000001' });
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total,
      commission_amount, lob, details, renewed_from)
    SELECT v.id, v.num, 'cl_rp1', v.product, (SELECT id FROM insurance_companies WHERE code = 'RPTEST'), (SELECT id FROM users WHERE username = 'rp.sales'), v.status,
           v.inc::date, v.inc::date + 365, 1000000, v.prem, v.prem / 10, v.lob, v.details::jsonb, v.prev
    FROM (VALUES ('pol_rp0', 'POL-RP-0', ${motor}, 'active', '2024-02-10', 20000, 'MOTOR', '${toyota}', NULL),
                 ('pol_rp1', 'POL-RP-1', ${motor}, 'active', '2025-03-05', 30000, 'MOTOR', '${toyota}', NULL),
                 ('pol_rp2', 'POL-RP-2', ${motor}, 'active', '2025-03-07', 25000, 'MOTOR', '{"vehicleBrand": "Hino"}', NULL),
                 ('pol_rp3', 'POL-RP-3', ${motor}, 'active', '2025-02-10', 21000, 'MOTOR', '${toyota}', 'pol_rp0'),
                 ('pol_rp4', 'POL-RP-4', ${motor}, 'active', '2025-03-08', 18000, 'MOTOR', '{"vehicleBrand": "Toyota", "aprCategory": "ROPA"}', NULL),
                 ('pol_rp5', 'POL-RP-5', ${motor}, 'cancelled', '2025-03-09', 27000, 'MOTOR', '${toyota}', NULL),
                 ('pol_rp6', 'POL-RP-6', ${motor}, 'active', '2025-03-10', 15000, 'MOTOR', '{}', NULL),
                 ('pol_rp7', 'POL-RP-7', ${pa}, 'active', '2025-03-11', 2000, 'ACCIDENT', '{}', NULL),
                 ('pol_rn1', 'POL-RN-1', ${motor}, 'active', '2024-03-30', 22000, 'MOTOR', '${toyota}', NULL),
                 ('pol_rn2', 'POL-RN-2', ${motor}, 'active', '2024-05-01', 22000, 'MOTOR', '{"vehicleBrand": "Toyota", "lockIn": true}', NULL),
                 ('pol_rn3', 'POL-RN-3', ${motor}, 'active', '2024-06-10', 22000, 'MOTOR', '${toyota}', NULL),
                 ('pol_rn4', 'POL-RN-4', ${motor}, 'active', '2024-07-01', 22000, 'MOTOR', '${toyota}', NULL),
                 ('pol_rn5', 'POL-RN-5', ${motor}, 'cancelled', '2024-04-01', 22000, 'MOTOR', '${toyota}', NULL))
         AS v(id, num, product, status, inc, prem, lob, details, prev)`);
  await query("UPDATE policies SET renewed_to = 'pol_rp3' WHERE id = 'pol_rp0'");
  await query(`INSERT INTO leads(display_name, owner_user_id, status, created_at) VALUES
    ('Converted Prospect', (SELECT id FROM users WHERE username = 'rp.sales'), 'converted', '2025-03-02T02:00:00Z'),
    ('Open Prospect', (SELECT id FROM users WHERE username = 'rp.sales'), 'new', '2025-03-03T02:00:00Z')`);
  await query(`INSERT INTO quotes(agent_user_id, insurance_company_id, created_at) VALUES
    ((SELECT id FROM users WHERE username = 'rp.sales'), (SELECT id FROM insurance_companies WHERE code = 'RPTEST'), '2025-03-03T02:00:00Z')`);
  const program = await one("INSERT INTO incentive_programs(name, metric, target) VALUES ('Report Test Programme', 'policies', 5) RETURNING id");
  await query(`INSERT INTO incentive_results(program_id, agent_user_id, achieved, payout, status, period, tier)
    VALUES ($1, (SELECT id FROM users WHERE username = 'rp.sales'), 4, 1500, 'approved', '2025-03', 'Tier 2')`, [program.id]);
});
afterAll(async () => { await pool.end(); });

describe('APR Operation Report', () => {
  it('totals the policies of the month to date per business category, listing a policy without one as Unclassified', async () => {
    const r = await run('apr-operation', { ReportCriteria: 'Month to Date', ToDate: '2025-03-15' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const rows = r.body.data.rows;
    expect(rows.map((x) => x.category)).toEqual(['New Car', 'ROPA', 'OEM', 'Cancelled', 'Unclassified']);
    expect(byKey(rows, 'category')['New Car']).toMatchObject({ policies: 1, premium: 30000, commission: 3000 });
    expect(byKey(rows, 'category').Unclassified).toMatchObject({ policies: 2, premium: 17000 });
  });

  it('adds the earlier months of the year to date, the renewal counting as Existing UIO', async () => {
    const r = await run('apr-operation', { ReportCriteria: 'Year to Date', FromDate: '2025-03-01', ToDate: '2025-03-15' });
    const rows = byKey(r.body.data.rows, 'category');
    expect(rows['Existing UIO']).toMatchObject({ policies: 1, premium: 21000 });
    expect(Object.keys(rows)).not.toContain(undefined);
    expect(r.body.data.rows.reduce((s, x) => s + x.policies, 0)).toBe(7);
  });

  it('splits the categories per product line and follows the brands of reports.apr_home_brands', async () => {
    const r = await run('apr-operation', { ReportCriteria: 'Month to Date by Product Line', ToDate: '2025-03-15' });
    expect(r.body.data.rows.find((x) => x.productLine === 'ACCIDENT')).toMatchObject({ category: 'Unclassified', policies: 1 });
    await query("UPDATE app_settings SET value = '[\"Toyota\", \"Lexus\", \"Hino\"]' WHERE key = 'reports.apr_home_brands'");
    clearSettingsCache();
    try {
      const again = byKey((await run('apr-operation', { ReportCriteria: 'Month to Date', ToDate: '2025-03-15' })).body.data.rows, 'category');
      expect(again.OEM).toBeUndefined();
      expect(again['New Car'].policies).toBe(2);
    } finally {
      await query("UPDATE app_settings SET value = '[\"Toyota\", \"Lexus\"]' WHERE key = 'reports.apr_home_brands'");
      clearSettingsCache();
    }
  });

  it('refuses a To date before the From date', async () => {
    const r = await run('apr-operation', { ReportCriteria: 'Month to Date', FromDate: '2025-03-15', ToDate: '2025-03-01' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/From date must be on or before To date/);
  });
});

describe('Production per Product Line', () => {
  it('counts the policies, sum insured, premium and commission per product line and month, leaving out cancelled policies', async () => {
    const r = await run('production-by-line', { ReportCriteria: 'Product Line by Month', FromDate: '2025-01-01', ToDate: '2025-03-31' });
    expect(r.status).toBe(200);
    expect(r.body.data.rows).toEqual([
      expect.objectContaining({ month: '2025-02', productLine: 'MOTOR', policies: 1, premium: 21000 }),
      expect.objectContaining({ month: '2025-03', productLine: 'ACCIDENT', policies: 1, premium: 2000, commission: 200 }),
      expect.objectContaining({ month: '2025-03', productLine: 'MOTOR', policies: 4, sumInsured: 4000000, premium: 88000 }),
    ]);
  });
});

describe('Agent Policy Conversion', () => {
  it('gives each agent per month the prospects, quotations, policies, accounts, premium, commission and incentive', async () => {
    const r = await run('agent-conversion', { ReportCriteria: 'Agent by Month', Agent: 'rp.sales', FromDate: '2025-03-01', ToDate: '2025-03-31' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.rows).toEqual([expect.objectContaining({ agent: 'rp.sales', month: '2025-03', prospects: 2, converted: 1, quotations: 1, policies: 5, accounts: 1,
      premium: 90000, tier: 'Tier 2', incentive: 1500 })]);
  });
  it('answers a month without business with no rows and no error', async () => {
    const r = await run('agent-conversion', { ReportCriteria: 'Agent by Month', Agent: 'rp.sales', FromDate: '2025-05-01', ToDate: '2025-05-31' });
    expect(r.status).toBe(200);
    expect(r.body.data.rows).toEqual([]);
  });
});

describe('Renewal Notice Listing', () => {
  it('lists the policies expiring within 90 days of the as-of date in 30/60/90 day buckets with the calling template fields', async () => {
    const r = await run('renewal-notice-listing', { ReportCriteria: 'All', ToDate: '2025-03-15' });
    expect(r.status).toBe(200);
    const rows = r.body.data.rows;
    expect(rows.map((x) => [x.policyNumber, x.bucket])).toEqual([['POL-RN-1', '30 days'], ['POL-RN-2', '60 days'], ['POL-RN-3', '90 days']]);
    expect(rows[0]).toMatchObject({ daysToExpiry: 15, coordinator: 'rp.sales', client: 'Andrea M. Villanueva', vehicle: '2024 TOYOTA Raize', plateNumber: 'NAB 1234',
      chassisNumber: 'MHKA1BA1JPK000001', engineNumber: '1KRA000001', insurer: 'Report Test Insurance Corp.', noticeTreatment: 'Notice' });
    expect(r.body.data.groups.map((g) => [g.group, g.count])).toEqual([['30 days', 1], ['60 days', 1], ['90 days', 1]]);
  });
  it('marks a lock-in policy as suppressed in its bucket', async () => {
    const r = await run('renewal-notice-listing', { ReportCriteria: '60 Days', ToDate: '2025-03-15' });
    expect(r.body.data.rows).toEqual([expect.objectContaining({ policyNumber: 'POL-RN-2', noticeTreatment: 'Suppressed: Lock-in' })]);
    expect(r.body.data.summary.suppressed).toBe(1);
  });
});

describe('Who runs the sales reports', () => {
  it('lets the Sales Unit Head and Finance run them and refuses Cash Control', async () => {
    expect((await run('production-by-line', { ReportCriteria: 'Product Line', FromDate: '2025-03-01', ToDate: '2025-03-31' }, 'rp.sales')).status).toBe(200);
    expect((await run('apr-operation', { ReportCriteria: 'Year to Date', ToDate: '2025-03-15' }, 'rp.finance')).status).toBe(200);
    const denied = await run('apr-operation', { ReportCriteria: 'Year to Date', ToDate: '2025-03-15' }, 'rp.pdu');
    expect([403, 404]).toContain(denied.status);
  });
});
