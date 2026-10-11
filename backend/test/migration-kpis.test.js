/**
 * Migrated business in the figures (spec 7.5): dashboards open on "Issued since go-live" and count only the policies
 * issued in BrokerVerse unless the setting includes the migrated ones (origin=all counts every policy); migrated
 * policies stay renewal opportunities; incentive premium and policy counts leave them out while the renewal rate counts
 * them in its denominator; full collection of a migrated open item accrues no referrer commission and the commission
 * dashboard leaves migrated policies out (unless the setting includes them); the production register and the dealer
 * production report carry the Origin.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { many, one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { achievement } from '../src/modules/incentive/service.js';
import { ensureCalendar } from '../src/modules/period-end/fiscal.js';
import { businessRows, startMigrationSuite, uploadAs, workbook } from './migration.fixtures.js';
import { enableFeatures, withReferenceCommissionControls } from './helpers.js';

let s;
let day;
let from;
let migrated;
let issued;

/** Two migrated clients with a motor policy and an open item each (no cheques), one opening balances set. */
function rows() {
  const a = businessRows(s, 1);
  const b = businessRows(s, 2);
  return Object.fromEntries(['Clients', 'Policies - Motor', 'Open Items', 'Open Claims'].map((k) => [k, [...a[k], ...b[k]]]).concat([['Opening Balances', a['Opening Balances']]]));
}
const setting = async (key, value) => {
  await query('UPDATE app_settings SET value = $2::jsonb WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};
const overview = (origin) => s.api('get', `/dashboard/sales/overview?from=${from}&to=${day}${origin ? `&origin=${origin}` : ''}`);

beforeAll(async () => {
  s = await startMigrationSuite({ approval: false });
  // the sales dashboard is a Phase 2 feature; the commission figures assume the reference commission controls
  await enableFeatures(s.app, ['sales-dashboard']);
  await withReferenceCommissionControls();
  day = await today();
  from = addDays(day, -400);
  await ensureCalendar(pool, day);
  await ensureCalendar(pool, s.cutover);
  const r = await uploadAs(s.api, workbook(s.kits, rows()));
  expect(r.body.data.errors).toEqual([]);
  expect((await s.api('post', `/data-load/batches/${r.body.data.batch.id}/load`).send({})).status).toBe(200);
  // both migrated policies are the administrator's book; the first expires within the renewal window
  await query('UPDATE policies SET owner_user_id = $1 WHERE origin = \'migrated\'', [s.admin.id]);
  await query('UPDATE policies SET expiry_date = $1 WHERE policy_number = \'MJ1-P\'', [addDays(day, 20)]);
  migrated = await one('SELECT * FROM policies WHERE policy_number = \'MJ1-P\'');
  // a policy issued in BrokerVerse today, with its own premium, expiring next year
  await query(`INSERT INTO policies SELECT (jsonb_populate_record(NULL::policies, to_jsonb(p) || jsonb_build_object('id', 'pol_kpi_issued', 'policy_number', 'KPI-ISS-1',
      'payment_reference', NULL, 'origin', 'issued', 'legacy_system', NULL, 'legacy_number', NULL, 'migrated_at', NULL, 'migrated_by', NULL, 'load_batch_id', NULL, 'doc', p.doc - 'source',
      'issued_date', $1::date, 'inception_date', $1::date, 'expiry_date', $1::date + 365, 'premium_total', 40000, 'renewed_from', NULL))).*
    FROM policies p WHERE p.policy_number = 'MJ1-P'`, [day]);
  issued = await one('SELECT * FROM policies WHERE id = \'pol_kpi_issued\'');
});
afterAll(async () => {
  await pool.end();
});

describe('dashboards', () => {
  it('open on the business issued in BrokerVerse; origin=all counts the migrated policies too', async () => {
    const def = await overview(null);
    expect(def.status).toBe(200);
    expect(def.body.data.origin).toBe('issued');
    expect(def.body.data.kpis).toMatchObject({ policies: 1, premium: 40000 });
    expect((await overview('issued')).body.data.kpis).toMatchObject({ policies: 1, premium: 40000 });
    expect((await overview('all')).body.data.kpis).toMatchObject({ policies: 3, premium: 90000 });
    expect((await overview('all')).body.data.premiumByProduct.policies.reduce((a, b) => a + b, 0)).toBe(3);
    expect((await overview('migrated')).status).toBe(400);
    const exec = (origin) => s.api('get', `/dashboard/executive?origin=${origin}`);
    expect((await exec('issued')).body.data.executiveKPIs.activePolicies.value).toBe(1);
    expect((await exec('all')).body.data.executiveKPIs.activePolicies.value).toBe(3);
    expect((await exec('issued')).body.data.issuedSinceGoLive).toMatchObject({ cutoverDate: s.cutover, policies: 0 });
  });

  it('follow the settings: default origin and migrated policies counted', async () => {
    await setting('dashboard.default_origin', 'all');
    expect((await overview(null)).body.data).toMatchObject({ origin: 'all', kpis: { policies: 3 } });
    await setting('dashboard.default_origin', 'issued');
    await setting('migration.kpi_include_migrated', true);
    expect((await overview('issued')).body.data.kpis).toMatchObject({ policies: 3, premium: 90000 });
    await setting('migration.kpi_include_migrated', false);
    expect((await overview('issued')).body.data.kpis.policies).toBe(1);
  });

  it('count migrated policies as renewal opportunities in every view', async () => {
    const sales = await s.api('get', '/dashboard/sales?origin=issued');
    expect(sales.body.data).toMatchObject({ origin: 'issued', renewalsDueIn60Days: 1, funnel: { policies: 1 } });
    const home = await s.api('get', '/agent/get-dashboard-details?origin=issued');
    expect(home.body.data.expiringPolicies.map((p) => p.policyNumber)).toEqual(['MJ1-P']);
    expect(home.body.data.premium.gross).toBe(40000);
  });
});

describe('incentives', () => {
  it('premium and policy count leave migrated policies out unless the setting counts them', async () => {
    expect(await achievement('premium', s.admin.id, from, day)).toBe(40000);
    expect(await achievement('policies', s.admin.id, from, day)).toBe(1);
    await setting('migration.incentive_include_migrated', true);
    expect(await achievement('premium', s.admin.id, from, day)).toBe(90000);
    await setting('migration.incentive_include_migrated', false);
  });

  it('the renewal rate counts migrated expiring policies in its denominator and their renewals in BrokerVerse', async () => {
    expect(await achievement('renewal-rate', s.admin.id, day, addDays(day, 30))).toBe(0);
    await query('UPDATE policies SET renewed_to = $2 WHERE id = $1', [migrated.id, issued.id]);
    expect(await achievement('renewal-rate', s.admin.id, day, addDays(day, 30))).toBe(100);
    await query('UPDATE policies SET renewed_to = NULL WHERE id = $1', [migrated.id]);
  });
});

describe('commission', () => {
  let referrer;
  const commissionDetails = (ref) => ({ commissionDetails: { brokeragePct: 18, productLabel: 'Motor', primary: { referrerId: ref, level: 'L1', comsubPct: 8, comsubFixed: 0 }, chain: [] } });
  const collect = async (policyNumber) => {
    const p = await one('SELECT id FROM policies WHERE policy_number = $1', [policyNumber]);
    const bill = await one('SELECT balance FROM receivables WHERE policy_id = $1', [p.id]);
    const r = await s.api('post', '/receipts').send({ policyId: p.id, amount: Number(bill.balance) });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(await one('SELECT balance FROM receivables WHERE policy_id = $1', [p.id])).toEqual({ balance: 0 });
    return (await many('SELECT * FROM commissions WHERE policy_id = $1', [p.id]));
  };

  it('full collection of a migrated open item accrues no referrer commission', async () => {
    const c = await s.api('post', '/commission/referrer-accounts').send({ name: 'Lorna Bautista', type: 'Agent', level: 'L1', bankName: 'BDO', bankAccountNo: '001122334466' });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    referrer = c.body.data.referrer.id;
    await query('UPDATE policies SET details = COALESCE(details, \'{}\'::jsonb) || $1::jsonb WHERE policy_number IN (\'MJ1-P\', \'MJ2-P\')', [JSON.stringify(commissionDetails(referrer))]);
    expect(await collect('MJ1-P')).toEqual([]);
  });

  it('accrues it when the setting includes migrated policies; the commission dashboard leaves them out otherwise', async () => {
    await setting('migration.commission_include_migrated', true);
    const lines = await collect('MJ2-P');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ referrer_id: referrer, status: 'Eligible' });
    const withMigrated = (await s.api('get', '/commission/dashboard')).body.data.kpis.comsubGross;
    await setting('migration.commission_include_migrated', false);
    const issuedOnly = (await s.api('get', '/commission/dashboard')).body.data.kpis.comsubGross;
    expect(withMigrated - issuedOnly).toBeCloseTo(Number(lines[0].amount), 2);
  });
});

describe('reports', () => {
  it('the production register has the Origin column, view and filter', async () => {
    const run = async (body) => {
      const r = await s.api('post', '/reports/production-register/run').send({ FromDate: from, ToDate: addDays(day, 1), ...body });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      return r.body.data;
    };
    const all = await run({ ReportCriteria: 'Overall' });
    expect(all.rows.map((x) => [x.policyNumber, x.origin]).sort()).toEqual([['KPI-ISS-1', 'Issued in BrokerVerse'], ['MJ1-P', 'Migrated'], ['MJ2-P', 'Migrated']]);
    expect(all.summary.migrated).toBe(2);
    expect(all.rows[0]._origin).toBeUndefined();
    const byOrigin = await run({ ReportCriteria: 'Origin' });
    expect(byOrigin.groups.map((g) => [g.group, g.count])).toEqual([['Issued in BrokerVerse', 1], ['Migrated', 2]]);
    // the earlier name of the view is still accepted (saved schedules)
    expect((await run({ ReportCriteria: 'Source' })).groups).toHaveLength(2);
    expect((await run({ ReportCriteria: 'Overall', Origin: 'issued' })).rows.map((x) => x.policyNumber)).toEqual(['KPI-ISS-1']);
    expect((await run({ ReportCriteria: 'Overall', Origin: 'Migrated' })).rows).toHaveLength(2);
    const def = (await s.api('get', '/reports/production-register')).body.data;
    expect(def.parameters.properties.ReportCriteria.enum).toContain('Origin');
    expect(def.parameters.properties.ReportCriteria.enum).not.toContain('Source');
    expect(def.parameters.properties.Origin.enum).toEqual(['Issued in BrokerVerse', 'Migrated']);
    expect(def.columns.map((c) => c.key)).toContain('origin');
  });

  it('the claims, receivables, collections, receipts, commission and renewal reports split migrated and issued business too', async () => {
    for (const code of ['claims-position', 'claims-ageing', 'premium-receivable-soa', 'collections-ageing', 'collections-summary', 'commission-statement', 'receipts-register',
      'renewal-retention']) {
      const def = (await s.api('get', `/reports/${code}`)).body.data;
      expect(def.parameters.properties.Origin, code).toMatchObject({ enum: ['Issued in BrokerVerse', 'Migrated'] });
      expect(def.parameters.properties.ReportCriteria.enum, code).toContain('Origin');
    }
    const run = async (code, body) => {
      const r = await s.api('post', `/reports/${code}/run`).send({ FromDate: addDays(from, -400), ToDate: addDays(day, 400), ...body });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      return r.body.data;
    };
    const claims = await run('claims-position', { ReportCriteria: 'All' });
    expect(claims.rows.length).toBeGreaterThan(0);
    expect(claims.rows.every((x) => x.origin === 'Migrated')).toBe(true);
    expect((await run('claims-position', { ReportCriteria: 'All', Origin: 'issued' })).rows).toHaveLength(0);
    const soa = await run('premium-receivable-soa', { ReportCriteria: 'Origin' });
    expect(soa.groups.map((g) => g.group)).toContain('Migrated');
    const migrated = await run('premium-receivable-soa', { ReportCriteria: 'Overall', Origin: 'Migrated' });
    expect(migrated.rows.length).toBeGreaterThan(0);
    expect(migrated.rows.every((x) => x.origin === 'Migrated')).toBe(true);
  });

  it('the report builder offers the Origin of policies, clients, bills and claims', async () => {
    const d = (await s.api('get', '/report-builder/datasets')).body.data;
    for (const key of ['policies', 'clients', 'bills', 'claims']) {
      expect(d.find((x) => x.key === key).columns.map((c) => c.key), key).toContain('origin');
    }
  });
});
