import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { importPolicy } from '../src/modules/policies/service.js';
import { quotationCharges } from '../src/modules/premium-charges/service.js';
import { programPeriodOn } from '../src/modules/incentive/service.js';
import { today } from '../src/lib/dates.js';
import { round2 } from '../src/lib/money.js';

// Data the screens need that they could not get: the people picker of petty cash, the tax breakdown of a policy without
// a quotation, every cheque of a payment voucher, and incentive progress per calculation period up to today.
let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });

describe('users lookup (petty cash requester / custodian picker)', () => {
  it('serves active users as id, name and branch to accounting, without user administration rights', async () => {
    expect((await ctx.as('maker')('get', '/users')).status).toBe(403);
    await query('UPDATE users SET status = \'inactive\', branch_code = \'MKT\' WHERE id = $1', [ctx.userIds.agent]);
    await query('UPDATE users SET branch_code = \'CEB\' WHERE id = $1', [ctx.userIds.claims]);
    const r = await ctx.as('maker')('get', '/users/lookup');
    expect(r.status).toBe(200);
    const claims = r.body.data.find((u) => u.userId === ctx.userIds.claims);
    expect(claims).toEqual({ userId: ctx.userIds.claims, name: 'claims user', branchCode: 'CEB' });
    expect(r.body.data.find((u) => u.userId === ctx.userIds.agent)).toBeUndefined();
    expect(Object.keys(r.body.data[0]).sort()).toEqual(['branchCode', 'name', 'userId']);
    const s = await ctx.as('maker')('get', '/users/lookup?search=claims');
    expect(s.body.data.map((u) => u.userId)).toEqual([ctx.userIds.claims]);
  });
  it('is closed to roles without petty cash or user rights', async () => {
    expect((await ctx.as('sales')('get', '/users/lookup')).status).toBe(403);
  });
});

describe('premium taxes of a policy without a quotation', () => {
  const issue = (row) => withTransaction((db) => importPolicy(db, { insuredName: 'Paolo Pascual', productType: 'Fire', sumInsured: 1000000, ...row }, null, { migration: true }));
  it('derives VAT, DST, LGT and FST of a migrated policy from the tax engine when they make up its gross premium', async () => {
    const net = 12760;
    const c = await quotationCharges({}, net, 'FIRE');
    const taxes = round2(c.tax.valueAddedTax + c.tax.documentaryStampTax + c.tax.localGovernmentTax + c.tax.fireServiceTax + c.others);
    expect(taxes).toBeGreaterThan(0);
    const { policyId } = await issue({ netPremium: net, grossPremium: round2(net + taxes), sumInsured: 2000000 });
    const p = (await ctx.api('get', `/policies/${policyId}`)).body.data;
    expect(p.quotationId).toBeNull();
    expect(p).toMatchObject({ netPremium: net, valueAddedTax: c.tax.valueAddedTax, documentaryStampTax: c.tax.documentaryStampTax,
      localGovernmentTax: c.tax.localGovernmentTax, fireServiceTax: c.tax.fireServiceTax });
    expect(c.tax.fireServiceTax).toBeGreaterThan(0);
    // stored on the policy at import
    const doc = (await query('SELECT doc FROM policies WHERE id = $1', [policyId])).rows[0].doc;
    expect(doc.documentaryStampTax).toBe(c.tax.documentaryStampTax);
  });
  it('derives the breakdown on read for a policy loaded without one, and never invents figures that do not add up', async () => {
    const net = 12760;
    const c = await quotationCharges({}, net, 'FIRE');
    const gross = round2(net + c.tax.valueAddedTax + c.tax.documentaryStampTax + c.tax.localGovernmentTax + c.tax.fireServiceTax + c.others);
    const { policyId } = await issue({ netPremium: net, grossPremium: gross });
    await query('UPDATE policies SET doc = jsonb_build_object(\'source\', \'go-live-migration\') WHERE id = $1', [policyId]);
    const p = (await ctx.api('get', `/policies/${policyId}`)).body.data;
    expect(p).toMatchObject({ valueAddedTax: c.tax.valueAddedTax, documentaryStampTax: c.tax.documentaryStampTax, premiumTaxesDerived: true });
    const odd = await issue({ netPremium: 10000, grossPremium: 10500 });
    const q = (await ctx.api('get', `/policies/${odd.policyId}`)).body.data;
    expect(q.valueAddedTax ?? null).toBeNull();
    expect(q.premiumTaxesDerived).toBeUndefined();
  });
  it('shows the taxes stored on a policy issued without a quotation (placement, package)', async () => {
    const m = await makePolicy({ net: 20000 });
    await query(`UPDATE policies SET quote_id = NULL, doc = doc || '{"valueAddedTax": 2400, "documentaryStampTax": 2500, "localGovernmentTax": 150, "fireServiceTax": 0}'::jsonb
      WHERE id = $1`, [m.policy.id]);
    const p = (await ctx.api('get', `/policies/${m.policy.id}`)).body.data;
    expect(p).toMatchObject({ valueAddedTax: 2400, documentaryStampTax: 2500, localGovernmentTax: 150 });
    expect(p.premiumTaxesDerived).toBeUndefined();
  });
});

describe('payment voucher detail', () => {
  it('lists the cheques issued on the voucher itself as well as on its payable lines', async () => {
    const c = await ctx.as('maker')('post', '/disbursements').send({ payeeType: 'Supplier', payeeName: 'Office Depot', criteria: 'Specific', transactionCode: 'SUPPLIER',
      transactionDescription: 'Office supplies', instrumentCurrency: 'PHP', amount: '1200.00' });
    expect(c.status).toBe(201);
    const id = c.body.data.disbursementId;
    const cb = await ctx.as('maker')('post', '/disbursements/checkbook').send({ disbursementId: id, customerName: 'Office Depot', mainAccount: '1102001', instrumentBookId: 'BDO-CB-01',
      instrumentNo: '000777', instrumentDate: await today(), totaleAmount: '1200.00', status: 'Pending' });
    expect(cb.status).toBe(201);
    const d = (await ctx.as('maker')('get', `/disbursements/${id}`)).body.data;
    expect(d.voucherNumber).toMatch(/^PV-/);
    expect(d.cheques).toHaveLength(1);
    expect(d.cheques[0]).toMatchObject({ instrumentNo: '000777', totaleAmount: 1200, status: 'Pending', disbursementId: id });
  });
});

describe('incentive progress per calculation period, to date', () => {
  it('gives the calendar window of the program frequency within the program dates', () => {
    const p = { period_from: '2026-05-10', period_to: '2026-12-31' };
    expect(programPeriodOn({ ...p, calculation_frequency: 'Monthly' }, '2026-10-04')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(programPeriodOn({ ...p, calculation_frequency: 'Quarterly' }, '2026-05-20')).toEqual({ from: '2026-05-10', to: '2026-06-30' });
    expect(programPeriodOn({ ...p, calculation_frequency: 'Semi-Annual' }, '2026-10-04')).toEqual({ from: '2026-07-01', to: '2026-12-31' });
    expect(programPeriodOn({ ...p, calculation_frequency: 'Annual' }, '2026-10-04')).toEqual({ from: '2026-05-10', to: '2026-12-31' });
    expect(programPeriodOn({ ...p, calculation_frequency: null }, '2026-10-04')).toEqual({ from: '2026-05-10', to: '2026-12-31' });
  });
  it('My Programs, the calculation and the statement count the same policies and leave out future-dated ones', async () => {
    const t = await today();
    const monthStart = `${t.slice(0, 7)}-01`;
    const later = new Date(Date.parse(`${t}T00:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10);
    const yr = t.slice(0, 4);
    await query('UPDATE app_settings SET value = $1 WHERE key = \'incentive.eligible_roles\'', [JSON.stringify(['sales'])]);
    const { clearSettingsCache } = await import('../src/lib/settings.js');
    clearSettingsCache();
    const prog = await ctx.api('post', '/incentive/programs').send({ programName: 'Monthly premium (test)', programType: 'Target Based', applicableTo: ['Individual Agent'],
      startDate: `${yr}-01-01`, endDate: `${yr}-12-31`, targetMetric: 'Premium Volume', calculationFrequency: 'Monthly', baseTarget: 100000,
      structure: [{ level: '0%+', type: 'Percentage', value: 1 }] });
    expect(prog.status).toBe(201);
    const agent = ctx.userIds.sales;
    const own = async (net, inception) => {
      const m = await makePolicy({ net });
      await query('UPDATE policies SET owner_user_id = $1, inception_date = $2::date, premium_total = $3 WHERE id = $4', [agent, inception, net, m.policy.id]);
    };
    await own(1000, monthStart); // this month, to date
    await own(2000, later); // incepts after today: not achieved yet
    await own(4000, `${yr}-01-15`); // an earlier month of the program
    const mine = (await ctx.as('sales')('get', '/incentive/my-programs')).body.data;
    const p = mine.assignedPrograms.find((x) => x.programCode === prog.body.data.programCode);
    expect(p).toMatchObject({ achieved: 1000, periodFrom: monthStart, calculationFrequency: 'Monthly' });
    expect(mine.recentActivities.some((a) => a.date > t)).toBe(false);
    // not calculated yet: the statement shows the same progress
    const st = (await ctx.as('sales')('get', `/incentive/statement?period=${t.slice(0, 7)}`)).body.data;
    expect(st.programBreakdown.find((l) => l.program === 'Monthly premium (test)')).toMatchObject({ achievement: 1000, status: 'In Progress', earnedAmount: 0 });
    const calc = await ctx.api('post', '/incentive/calculations').send({ period: t.slice(0, 7), selectedPrograms: [prog.body.data.programCode] });
    expect(calc.status).toBe(201);
    expect(calc.body.data.details.find((d) => d.agentId === agent)).toMatchObject({ achieved: 1000 });
  });
});
