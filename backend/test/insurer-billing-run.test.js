/**
 * Insurer billing run (migration 0522, FRS FR-RMT-020 to 023): billing dates on the 15th and 26th moved off
 * non-working days, statements drafted per insurer, product line and basis from the remittances approved before the
 * billing date, each line billed once, the TISPH amounts (Gross = commission + VAT, EWT, Net payable, due + 15 days),
 * approval by approve:insurer-billing (not the maker, insurer TIN required), net basis settled by retention, cancel
 * releasing the lines, the export and the job.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { billingDates, billingJob, isBillingDate } from '../src/modules/remittance/billing.js';
import { commissionTax, ewtRate } from '../src/modules/remittance/directbill.js';

let ctx; let finance; let finance2; let ops; let ins; let rem; let day;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const r2 = (n) => Math.round(n * 100) / 100;

async function person(username, role) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles: [role] });
  expect(r.status).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

/** An approved remittance of the insurer, approved yesterday, with a motor and an accident policy line. */
async function approvedRemittance() {
  const lines = [];
  for (const [n, line, premium, commission] of [[1, 'motor', 64159.68, 24022.5], [2, 'accident', 18807.35, 0]]) {
    const [c] = await q("INSERT INTO clients(client_code, display_name, first_name, last_name, created_by) VALUES ($1, $2, 'Bill', 'Client', 'test') RETURNING id", [`CL-IBR-${n}`, `Bill Client ${n}`]);
    const [p] = await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, premium_total, commission_amount, billing_mode)
      VALUES ($1, $2, (SELECT id FROM products WHERE line = $4 ORDER BY id LIMIT 1), $3, 'active', $5::date, $5::date + 365, $6, $7, 'broker') RETURNING id, policy_number`,
    [`POL-IBR-${n}`, c.id, ins.id, line, addDays(day, -20), premium, commission]);
    lines.push({ ...p, premium, commission });
  }
  const [r] = await q(`INSERT INTO remittances(remittance_number, insurance_company_id, kind, period, gross_premium, commission, tax, net_due, status, remittance_date, policy_count, currency,
      approved_at, created_by) VALUES ('REM-IBR-0001', $1, 'direct-bill', $2, 82966.03, 24022.5, 0, 58943.53, 'approved', $3, 2, 'PHP', now() - interval '1 day', NULL) RETURNING id`,
  [ins.id, day.slice(0, 7), addDays(day, -1)]);
  for (const l of lines) {
    await q(`INSERT INTO remittance_lines(remittance_id, policy_id, premium, commission, net, policy_number, insured_name, product) VALUES ($1,$2,$3,$4,$5,$6,'Bill Client','Motor')`,
      [r.id, l.id, l.premium, l.commission, r2(l.premium - l.commission), l.policy_number]);
  }
  return { ...r, lines };
}

beforeAll(async () => {
  ctx = await setup();
  finance = await person('ibr.finance', 'tis-finance');
  finance2 = await person('ibr.finance2', 'tis-finance');
  ops = await person('ibr.ops', 'tis-ops-officer');
  day = await today();
  [ins] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ('IBRINS', 'Billing Run Insurance Corp.', 'IBRINS', 'active') RETURNING id, code, name");
  rem = await approvedRemittance();
});
afterAll(async () => { await pool.end(); });

describe('billing dates (FR-RMT-020)', () => {
  it('runs on the 15th and the 26th, the working day before a Saturday, Sunday or holiday', async () => {
    expect(await billingDates('2026-09-03')).toEqual(['2026-09-15', '2026-09-25']);
    expect(await isBillingDate('2026-09-25')).toBe(true);
    expect(await isBillingDate('2026-09-26')).toBe(false);
    await q("UPDATE app_settings SET value = '\"next\"' WHERE key = 'insurer_billing.non_working_day'");
    clearSettingsCache();
    expect(await billingDates('2026-09-03')).toEqual(['2026-09-15', '2026-09-28']);
    await q("UPDATE app_settings SET value = '\"previous\"' WHERE key = 'insurer_billing.non_working_day'");
    clearSettingsCache();
  });
  it('the job does nothing on another day', async () => {
    expect(await billingJob({ asOf: '2026-09-16' })).toMatchObject({ skipped: expect.stringMatching(/^Not a billing date/) });
  });
});

describe('billing run and statements (FR-RMT-020 to 023)', () => {
  let statement;
  it('drafts one statement per insurer, product line and basis with the TISPH amounts; a line is billed once', async () => {
    expect((await ops('post', '/remittance/billing-runs').send({})).status).toBe(403);
    expect((await finance('post', '/remittance/billing-runs').send({ billingDate: addDays(day, 1) })).status).toBe(400);
    const r = await finance('post', '/remittance/billing-runs').send({ billingDate: day, insurerId: ins.id });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Billing run done: 1 billing statement(s) drafted.');
    expect(r.body.data.notes).toEqual([expect.objectContaining({ basis: 'net', productLine: 'Motor', insurer: ins.name })]);
    statement = (await finance('get', `/remittance/direct-bill/${r.body.data.notes[0].id}`)).body.data;
    const tax = await commissionTax(24022.5);
    const ewt = r2(24022.5 * (await ewtRate()));
    expect(statement).toMatchObject({ documentType: 'Billing Statement', basis: 'net', statusCode: 'draft', commission: 24022.5, vat: tax.vat, amount: r2(24022.5 + tax.vat),
      expectedEwt: ewt, netPayable: r2(24022.5 + tax.vat - ewt), dueDate: addDays(day, 15), remarks: '1 booked account/s', settlement: 'Retention' });
    expect(statement.lines).toEqual([expect.objectContaining({ policyNo: rem.lines[0].policy_number, remittanceNumber: 'REM-IBR-0001' })]);
    const again = await finance('post', '/remittance/billing-runs').send({ billingDate: day, insurerId: ins.id });
    expect(again.body.message).toMatch(/^Nothing to bill for Billing Run Insurance Corp\. up to \d{2}\/\d{2}\/\d{4}\.$/);
    const runs = (await ops('get', '/remittance/billing-runs')).body.data;
    expect(runs.runs[0]).toMatchObject({ result: 'nothing', trigger: 'user' });
    expect(runs.nextBillingDates.length).toBe(2);
  });

  it('exports the statement and its schedule as Excel and CSV', async () => {
    expect((await ops('get', `/remittance/direct-bill/${statement.id}/export?format=xlsx`)).status).toBe(200);
    const csv = await ops('get', `/remittance/direct-bill/${statement.id}/export?format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Net Amount Payable');
  });

  it('is approved by another holder of approve:insurer-billing once the insurer has a TIN, and is then settled by retention', async () => {
    await finance('post', `/remittance/direct-bill/${statement.id}/submit`).send({});
    const self = await finance('post', `/remittance/direct-bill/${statement.id}/approve`).send({});
    expect(self.status).toBe(403);
    expect((await ops('post', `/remittance/direct-bill/${statement.id}/approve`).send({})).status).toBe(403);
    const view = (await finance2('get', `/remittance/direct-bill/${statement.id}`)).body.data.decision;
    expect(view).toMatchObject({ canDecide: false, blockedCode: 'NO_TIN', blockedReason: `Insurance Company ${ins.name} has no TIN. Add it on Master > Insurance > Insurance Company before you approve.` });
    expect((await finance2('post', `/remittance/direct-bill/${statement.id}/approve`).send({})).status).toBe(409);
    await q("UPDATE insurance_companies SET tin = '009-876-543-000' WHERE id = $1", [ins.id]);
    const ok = await finance2('post', `/remittance/direct-bill/${statement.id}/approve`).send({});
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data).toMatchObject({ statusCode: 'settled', status: 'Settled by retention', balance: 0, journalNumber: null });
  });

  it('a cancelled statement releases its lines for the next run', async () => {
    const c = await finance('post', `/remittance/direct-bill/${statement.id}/cancel`).send({ reasonCode: 'BCN-INSURER', note: 'Wrong insurer' });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect((await q('SELECT billing_note_id FROM remittance_lines WHERE remittance_id = $1 AND commission > 0', [rem.id]))[0].billing_note_id).toBeNull();
    const r = await finance('post', '/remittance/billing-runs').send({ billingDate: day, insurerId: ins.id });
    expect(r.body.data.notes).toHaveLength(1);
  });

  it('bills the gross-remittance commission of a remitted policy on a gross-basis statement', async () => {
    const p = rem.lines[1];
    await q(`INSERT INTO direct_bill_items(policy_id, insurance_company_id, gross_premium, commission_rate, commission, vat, amount, basis, status, booked_on, source)
      VALUES ($1, $2, 18807.35, 0.2410, 4551.83, 546.22, 5098.05, 'gross', 'unbilled', $3, 'policy')`, [p.id, ins.id, addDays(day, -10)]);
    const r = await finance('post', '/remittance/billing-runs').send({ billingDate: day, insurerId: ins.id });
    expect(r.body.data.notes).toEqual([expect.objectContaining({ basis: 'gross', productLine: 'Accident', amount: 5098.05 })]);
    const s = (await finance('get', `/remittance/direct-bill/${r.body.data.notes[0].id}`)).body.data;
    expect(s).toMatchObject({ settlement: 'Collection', expectedEwt: r2(4551.83 * (await ewtRate())) });
    await finance('post', `/remittance/direct-bill/${s.id}/submit`).send({});
    const work = await finance2('get', '/my-work/items?category=approvals&scope=all');
    expect(JSON.stringify(work.body)).toContain(s.dnNumber);
  });
});
