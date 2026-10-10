/**
 * Amounts of a migration load: pesos with at most two decimals, never rounded on loading (more is an error on every
 * sheet), so the workbook totals (per-cell sums) and the BrokerVerse totals agree to the centavo; open items are in
 * PHP only; a foreign-currency policy keeps its original currency, sum insured and rate as reference.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { one, pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { addDays, today } from '../src/lib/dates.js';
import { centavos, pesoSum } from '../src/modules/data-load/common.js';

let api;
let kits;
let cutover;

function book(sheets) {
  const defs = kits.find((k) => k.kit === 'migration').sheets;
  return writeXlsx({
    sheets: Object.entries(sheets).map(([name, rows]) => {
      const headers = defs.find((s) => s.name === name).columns.map((c) => c.header);
      return { name, columns: headers.map((h) => ({ header: h })), rows: rows.map((r) => headers.map((h) => (r[h] === undefined ? '' : String(r[h])))) };
    }),
  });
}
const upload = (wb) => api('post', '/data-load/batches').field('kit', 'migration').attach('file', wb, 'migration.xlsx');
const policy = (number, gross, extra = {}) => ({ 'Policy Number': number, 'Client Code': 'AM-C-1', Insurer: 'MALAYAN', Product: 'PARCEL', 'Inception Date': addDays(cutover, -30),
  'Expiry Date': addDays(cutover, 335), 'Issue Date': addDays(cutover, -31), 'Gross Premium': gross, ...extra });

/** Deterministic pseudo-random amounts with two decimals (0.01 to 99,999.99). */
function amounts(n, seedValue = 20261010) {
  let x = seedValue;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out.push((1 + (x % 9999999)) / 100);
  }
  return out;
}

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  const app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
  kits = (await api('get', '/data-load/kits')).body.data.kits;
  const now = await today();
  const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  cutover = d.toISOString().slice(0, 10);
  expect((await api('put', '/settings').send({ settings: { 'golive.cutover_date': cutover } })).status).toBe(200);
  clearSettingsCache();
});
afterAll(async () => {
  await pool.end();
});

describe('two decimals at most', () => {
  it('reads the centavos of an amount, the binary noise of a spreadsheet aside', () => {
    expect(centavos(35946.88)).toBe(3594688);
    expect(centavos(3.3000000000000003)).toBe(330);
    expect(centavos(12.5)).toBe(1250);
    expect(centavos(12.505)).toBeNull();
    expect(centavos(0.001)).toBeNull();
  });

  it('three decimals is an error on every sheet, never rounded', async () => {
    const r = await upload(book({
      Clients: [{ 'Client Code': 'AM-C-1', 'Client Type': 'corporate', 'Company Name': 'Amounts Corp.' }],
      'Policies - Other Lines': [policy('AM-P-1', '1250.005'), policy('AM-P-2', '1250.00', { 'Sum Insured': '50000.125' })],
      'Open Items': [{ 'Policy Number': 'AM-P-2', 'Bill Reference': 'AM-DN-1', 'Due Date': addDays(cutover, 10), 'Open Balance': '99.999' }],
      'Open Claims': [{ 'Claim Number': 'AM-CL-1', 'Policy Number': 'AM-P-2', 'Loss Date': addDays(cutover, -5), 'Outstanding Estimate': '10.101' }],
      'Opening Balances': [{ 'Account Code': '1102001', Debit: '100.001' }, { 'Account Code': '2201001', Credit: '100.001' }],
      'Control Totals': [{ Object: 'Policies', Measure: 'gross premium', 'Legacy Value': '1.234' }],
    }));
    const errors = r.body.data.errors.filter((e) => e.row !== null).map((e) => [e.sheetName, e.column, e.message]);
    expect(errors).toEqual([
      ['Policies - Other Lines', 'Gross Premium', 'Gross Premium has more than two decimals'],
      ['Policies - Other Lines', 'Sum Insured', 'Sum Insured has more than two decimals'],
      ['Open Items', 'Open Balance', 'Open Balance has more than two decimals'],
      ['Open Claims', 'Outstanding Estimate', 'Outstanding Estimate has more than two decimals'],
      ['Opening Balances', 'Debit', 'Debit has more than two decimals'],
      ['Opening Balances', 'Credit', 'Credit has more than two decimals'],
      ['Control Totals', 'Legacy Value', 'Legacy Value has more than two decimals'],
    ]);
  });
});

describe('workbook and BrokerVerse totals', () => {
  it('agree to the centavo on 10,000 random amounts: per-cell sums of the workbook equal the sum of the stored amounts', async () => {
    const values = amounts(10000);
    const cells = values.map((v) => v.toFixed(2));
    const workbook = pesoSum(cells);
    const stored = (await one('SELECT sum(x)::numeric(16,2)::text AS s FROM unnest($1::numeric(14,2)[]) x', [cells])).s;
    expect(workbook.toFixed(2)).toBe(stored);
    // the plain floating-point sum is not to be trusted at this size; the centavo sum is
    expect(Number.isInteger(Math.round(workbook * 100))).toBe(true);
  });

  it('agree on a loaded workbook: the reconciliation totals of the workbook equal those of BrokerVerse', async () => {
    const values = amounts(60, 7);
    const r = await upload(book({
      Clients: [{ 'Client Code': 'AM-C-1', 'Client Type': 'corporate', 'Company Name': 'Amounts Corp.' }],
      'Policies - Other Lines': values.map((v, i) => policy(`AM-T-${i}`, v.toFixed(2), { 'Net Premium': (Math.round(v * 80) / 100).toFixed(2), 'Sum Insured': (v * 10).toFixed(2) })),
    }));
    expect(r.body.data.errors).toEqual([]);
    const l = await api('post', `/data-load/batches/${r.body.data.batch.id}/load`).send({});
    expect(l.status).toBe(200);
    const line = l.body.data.reconciliation.sheets.find((s) => s.sheet === 'Policies');
    expect(line.workbook.grossPremium).toBe(line.detail.grossPremium);
    expect(line.workbook.netPremium).toBe(line.detail.netPremium);
    expect(line.workbook.sumInsured).toBe(line.detail.sumInsured);
    const db = await one("SELECT sum(premium_total)::text AS g FROM policies WHERE policy_number LIKE 'AM-T-%'");
    expect(line.workbook.grossPremium.toFixed(2)).toBe(db.g);
  });
});

describe('currency', () => {
  it('an open item of another currency is an error', async () => {
    const r = await upload(book({ 'Open Items': [{ 'Policy Number': 'AM-T-1', 'Bill Reference': 'AM-USD-1', 'Due Date': addDays(cutover, 10), 'Open Balance': '100.00', Currency: 'USD' }] }));
    expect(r.body.data.errors).toEqual([expect.objectContaining({ column: 'Currency', message: expect.stringMatching(/^Currency USD: open items are loaded in PHP/) })]);
    const php = await upload(book({ 'Open Items': [{ 'Policy Number': 'AM-T-1', 'Bill Reference': 'AM-PHP-1', 'Due Date': addDays(cutover, 10), 'Open Balance': '100.00', Currency: 'php' }] }));
    expect(php.body.data.errors).toEqual([]);
  });

  it('a travel policy in dollars is loaded in pesos and keeps its original currency, sum insured and rate as reference', async () => {
    const r = await upload(book({ 'Policies - Travel': [{ 'Policy Number': 'AM-TRV-1', 'Client Code': 'AM-C-1', Insurer: 'MALAYAN', Product: 'TRAVEL',
      'Inception Date': addDays(cutover, -10), 'Expiry Date': addDays(cutover, 355), 'Issue Date': addDays(cutover, -11), 'Gross Premium': '1890.00', 'Sum Insured': '2810000.00',
      'Plan / Policy Type': 'TRV-ANN', 'Original Currency': 'USD', 'Original Sum Insured': '50000.00', 'Exchange Rate': '56.20' }] }));
    expect(r.body.data.errors).toEqual([]);
    expect((await api('post', `/data-load/batches/${r.body.data.batch.id}/load`).send({})).status).toBe(200);
    const p = await one("SELECT currency, sum_insured, doc FROM policies WHERE policy_number = 'AM-TRV-1'");
    expect(p.currency).toBe('PHP');
    expect(Number(p.sum_insured)).toBe(2810000);
    expect(p.doc).toMatchObject({ originalCurrency: 'USD', originalSumInsured: 50000, exchangeRate: 56.2 });
    const noCurrency = await upload(book({ 'Policies - Travel': [{ 'Policy Number': 'AM-TRV-2', 'Client Code': 'AM-C-1', Insurer: 'MALAYAN', Product: 'TRAVEL',
      'Inception Date': addDays(cutover, -10), 'Expiry Date': addDays(cutover, 355), 'Issue Date': addDays(cutover, -11), 'Gross Premium': '1890.00', 'Exchange Rate': '56.20' }] }));
    expect(noCurrency.body.data.errors).toEqual([expect.objectContaining({ column: 'Original Currency' })]);
  });
});
