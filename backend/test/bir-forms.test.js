/**
 * BIR forms and invoicing (modules/bir): 0619-E and 1601-EQ per ATC reconciled with the QAP and the ledger, filing
 * records, 1604-E alphalist, DAT files (fixed expected files in test/fixtures/bir), 2551Q percentage tax, sales
 * invoices under the EOPT Act with payment acknowledgements, the EIS outbox with the fake provider, and the CAS pack
 * (loose-leaf books with running page numbers, system description, backup procedure, audit trail extract).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache, getSetting } from '../src/lib/settings.js';
import { alphalist1604EDat, qapDat, sawtDat, slspPurchasesDat, slspSalesDat, splitRecord, txt, validateDat, DAT_LAYOUT } from '../src/modules/bir/dat.js';
import { invoicingSetup } from '../src/modules/bir/invoices.js';
import { buildPayload, canonical, signPayload } from '../src/modules/bir/eis.js';
import { splitTin } from '../src/modules/bir/common.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, 'fixtures', 'bir', name), 'latin1');

let ctx;
let maker;
beforeAll(async () => {
  ctx = await setupFinance();
  maker = ctx.as('maker');
});
afterAll(async () => { await pool.end(); });

const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const bal = async (code, jvId) => Number((await query('SELECT COALESCE(sum(debit - credit), 0) AS b FROM journal_lines WHERE account_code = $1 AND jv_id = $2', [code, jvId])).rows[0].b);
const binary = (res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); };
const file = (m, p) => maker(m, p).buffer(true).parse(binary);

/** The quarter of the first payment voucher with tax withheld (sample data). */
async function sampleQuarter() {
  const v = (await query('SELECT voucher_date FROM disbursements WHERE wht_amount > 0 AND status IN (\'approved\', \'paid\') ORDER BY voucher_date LIMIT 1')).rows[0];
  const d = v.voucher_date instanceof Date ? v.voucher_date.toISOString().slice(0, 10) : String(v.voucher_date);
  const year = Number(d.slice(0, 4)); const month = Number(d.slice(5, 7));
  return { year, quarter: Math.floor((month - 1) / 3) + 1, month };
}
const whtBetween = async (from, to) => Number((await query(`SELECT COALESCE(sum(wht_amount), 0) AS s FROM disbursements WHERE wht_amount > 0 AND status IN ('approved','paid')
  AND voucher_date BETWEEN $1 AND $2`, [from, to])).rows[0].s);

describe('0619-E and 1601-EQ (13.07)', () => {
  it('computes the quarterly return per ATC from the vouchers and reconciles it with the QAP and the ledger', async () => {
    const q = await sampleQuarter();
    const r = await maker('get', `/bir/returns/1601-EQ?year=${q.year}&quarter=${q.quarter}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const ret = r.body.data;
    const expected = await whtBetween(ret.period.from, ret.period.to);
    expect(ret.items.find((i) => i.no === '19').amount).toBeCloseTo(expected, 2);
    const atc = ret.schedules.find((s) => s.code === 'atc');
    expect(atc.rows.length).toBeGreaterThan(0);
    expect(atc.rows.every((x) => x.atc && x.rate > 0)).toBe(true);
    expect(ret.schedules.find((s) => s.code === 'qap').totals.taxWithheld).toBeCloseTo(expected, 2);
    expect(ret.reconciliation.checks.map((c) => c.code)).toEqual(['qap', 'ledger']);
    expect(ret.reconciliation.reconciled).toBe(true);
    expect(ret.header.find(([k]) => k === 'TIN')[1]).toMatch(/^\d{3}-\d{3}-\d{3}-\d{5}$/);
  });

  it('refuses a 0619-E for the third month of a quarter and records filings that the 1601-EQ deducts', async () => {
    const q = await sampleQuarter();
    const m1 = (q.quarter - 1) * 3 + 1; const m2 = m1 + 1;
    expect((await maker('get', `/bir/returns/0619-E?year=${q.year}&month=${m1 + 2}`)).status).toBe(400);
    const r1 = (await maker('get', `/bir/returns/0619-E?year=${q.year}&month=${m1}`)).body.data;
    const r2 = (await maker('get', `/bir/returns/0619-E?year=${q.year}&month=${m2}`)).body.data;
    expect(r1.items.find((i) => i.no === '14').amount).toBeCloseTo(await whtBetween(r1.period.from, r1.period.to), 2);
    expect(r1.header.find(([k]) => k === 'Due date')[1]).toBe(`${r1.period.to.slice(0, 4) === String(q.year) && m1 === 12 ? q.year + 1 : q.year}-${String(m1 + 1).padStart(2, '0')}-10`);

    const f1 = await maker('post', '/bir/returns/0619-E/filings').send({ year: q.year, month: m1, dateFiled: r1.period.to, filingReference: 'EFPS-0001', amountPaid: r1.taxDue, paymentReference: 'LBP-1' });
    expect(f1.status, JSON.stringify(f1.body)).toBe(201);
    expect(f1.body.data).toMatchObject({ form: '0619-E', periodKey: r1.period.key, status: 'filed', taxDue: r1.taxDue });
    expect((await maker('post', '/bir/returns/0619-E/filings').send({ year: q.year, month: m1, dateFiled: r1.period.to, amountPaid: 1 })).status).toBe(409);
    await maker('post', '/bir/returns/0619-E/filings').send({ year: q.year, month: m2, dateFiled: r2.period.to, filingReference: 'EFPS-0002', amountPaid: r2.taxDue + 25, penalties: 25 });

    const eq = (await maker('get', `/bir/returns/1601-EQ?year=${q.year}&quarter=${q.quarter}`)).body.data;
    const item = (no) => eq.items.find((i) => i.no === no).amount;
    expect(item('20')).toBeCloseTo(r1.taxDue, 2);
    expect(item('21')).toBeCloseTo(r2.taxDue, 2);
    expect(item('25')).toBeCloseTo(item('19') - r1.taxDue - r2.taxDue, 2);

    // amended filing supersedes; a cancelled filing no longer counts
    const amend = await maker('post', '/bir/returns/0619-E/filings').send({ year: q.year, month: m1, dateFiled: r1.period.to, filingReference: 'EFPS-0001A', amountPaid: r1.taxDue, amended: true });
    expect(amend.status).toBe(201);
    const hist = (await maker('get', `/bir/filings?year=${q.year}&form=0619-E`)).body.data.filter((f) => f.periodKey === r1.period.key);
    expect(hist.map((f) => f.status).sort()).toEqual(['filed', 'superseded']);
    const upd = await maker('put', `/bir/filings/${amend.body.data.id}`).send({ paymentReference: 'LBP-1A' });
    expect(upd.body.data.paymentReference).toBe('LBP-1A');
    const cal = (await maker('get', `/bir/returns/calendar?year=${q.year}`)).body.data;
    expect(cal.find((c) => c.form === '0619-E' && c.periodKey === r1.period.key).status).toBe('filed');
    expect(cal.filter((c) => c.form === '1601-EQ')).toHaveLength(4);
    expect(cal.some((c) => c.form === '2551Q')).toBe(false);
    const audit = (await query('SELECT action FROM audit_log WHERE entity = \'bir_return_filing\'')).rows.map((a) => a.action);
    expect(audit).toEqual(expect.arrayContaining(['create', 'amend', 'update']));
  });

  it('prints the return as PDF and exports it to Excel; only Accounting may record filings', async () => {
    const q = await sampleQuarter();
    const pdf = await file('get', `/bir/returns/1601-EQ/pdf?year=${q.year}&quarter=${q.quarter}`);
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    const x = await file('get', `/bir/returns/1601-EQ/xlsx?year=${q.year}&quarter=${q.quarter}`);
    expect(x.status).toBe(200);
    expect(x.headers['content-disposition']).toContain(`BIR-1601-EQ-${q.year}-Q${q.quarter}.xlsx`);
    expect(x.body.subarray(0, 2).toString()).toBe('PK');
    expect((await ctx.as('sales')('get', `/bir/returns/1601-EQ?year=${q.year}&quarter=${q.quarter}`)).status).toBe(403);
    expect((await ctx.as('claims')('post', '/bir/returns/0619-E/filings').send({ year: q.year, month: 1, dateFiled: '2026-02-10', amountPaid: 0 })).status).toBe(403);
  });
});

describe('1604-E annual information return and alphalist (13.08)', () => {
  it('lists every payee of the year per ATC with the tax withheld, and the remittances per month', async () => {
    const { year } = await sampleQuarter();
    const r = (await maker('get', `/bir/returns/1604-E?year=${year}`)).body.data;
    const s3 = r.schedules.find((s) => s.code === 'schedule3');
    expect(s3.rows.length).toBeGreaterThan(0);
    expect(s3.totals.taxWithheld).toBeCloseTo(await whtBetween(`${year}-01-01`, `${year}-12-31`), 2);
    expect(s3.rows[0]).toMatchObject({ seqNo: 1 });
    expect(r.schedules.find((s) => s.code === 'remittances').rows).toHaveLength(12);
    const x = await file('get', `/bir/returns/1604-E/xlsx?year=${year}`);
    expect(x.body.subarray(0, 2).toString()).toBe('PK');
    expect((await file('get', `/bir/returns/1604-E/pdf?year=${year}`)).body.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('BIR DAT files (13.13)', () => {
  const id = { tin: '123456789', branch: '00000', name: 'Sample Insurance Brokers, Inc.', tradeName: 'Sample Brokers', address: '12 Ayala Avenue, Makati City, Metro Manila', rdoCode: '047' };
  it('writes the QAP, SAWT, 1604-E and SLSP files exactly as the documented layout (fixed expected files)', () => {
    const qap = [
      { tin: '111-222-333-000', registeredName: null, lastName: 'Dela Cruz', firstName: 'Juan', middleName: 'Santos', atc: 'WI515', taxRate: 5, incomePayment: 10000, taxWithheld: 500 },
      { tin: '444555666', registeredName: 'Makati Motors, Inc.', lastName: null, firstName: null, middleName: null, atc: 'WC515', taxRate: 10, incomePayment: 25000.5, taxWithheld: 2500.05 },
    ];
    const q = qapDat(id, qap, '2026-09-30');
    expect(q.fileName).toBe('12345678900000920261601EQ.DAT');
    expect(q.content).toBe(fixture('qap-1601eq.DAT'));
    const sawt = sawtDat(id, [{ tin: '000-111-222-000', registeredName: 'Peñafrancia "Mutual" Insurance', atc: 'WC139', taxRate: 10, incomePayment: 15000, taxWithheld: 1500 }], '2026-09-30', '1702Q');
    expect(sawt.fileName).toBe('12345678900000920261702Q.DAT');
    expect(sawt.content).toBe(fixture('sawt-1702q.DAT'));
    const al = alphalist1604EDat(id, 2026, qap.map((r, i) => ({ ...r, seqNo: i + 1, tin: splitTin(r.tin).tin, branch: '0000', natureOfPayment: 'Commission of sales representatives' })));
    expect(al.fileName).toBe('123456789000012312026' + '1604E.DAT');
    expect(al.content).toBe(fixture('alphalist-1604e.DAT'));
    const sales = slspSalesDat(id, [{ tin: '000-111-222', registeredName: 'Malayan Insurance Co., Inc.', address: 'Yuchengco Tower, Binondo, Manila', exemptSales: 0, zeroRatedSales: 0, taxableSales: 50000, outputTax: 6000 },
      { tin: '', registeredName: null, customerName: 'Maria Clara Reyes', address: 'Quezon City', exemptSales: 1000, zeroRatedSales: 0, taxableSales: 0, outputTax: 0 }], '2026-09-30');
    expect(sales.fileName).toBe('123456789S092026.DAT');
    expect(sales.content).toBe(fixture('slsp-sales.DAT'));
    expect(sales.warnings).toEqual(['Customer Maria Clara Reyes has no TIN']);
    const purchases = slspPurchasesDat(id, [{ tin: '999888777', registeredName: 'Office Supplies Corp.', address: 'Pasig City', exemptPurchases: 0, zeroRatedPurchases: 0,
      purchaseOfServices: 2000, purchaseOfCapitalGoods: 0, purchaseOfOtherGoods: 0, inputTax: 240 }], '2026-09-30');
    expect(purchases.content).toBe(fixture('slsp-purchases.DAT'));
    expect(q.content.endsWith('\r\n')).toBe(true);
    expect(txt('Ñiño "Q" Sto. Niño')).toBe('"NINO Q STO. NINO"');
    expect(DAT_LAYOUT.version).toMatch(/Alphalist Data Entry and Validation Module v7/);
  });

  it('builds the files from the alphalist reports and the 1604-E schedules', async () => {
    const q = await sampleQuarter();
    const r = await maker('get', `/bir/dat-files/qap?year=${q.year}&quarter=${q.quarter}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.totals.taxWithheld).toBeCloseTo(await whtBetween(...(await (async () => { const x = (await maker('get', `/bir/returns/1601-EQ?year=${q.year}&quarter=${q.quarter}`)).body.data.period; return [x.from, x.to]; })())), 2);
    expect(r.body.data.content.split('\r\n')[0]).toMatch(/^HQAP,H1601EQ,\d{9},\d{4},"/);
    const d = await file('get', `/bir/dat-files/1604e/download?year=${q.year}`);
    expect(d.status).toBe(200);
    expect(d.headers['content-disposition']).toMatch(/1231\d{4}1604E\.DAT/);
    for (const t of ['sawt', 'slspSales', 'slspPurchases']) expect((await maker('get', `/bir/dat-files/${t}?year=${q.year}&quarter=${q.quarter}`)).status).toBe(200);
    expect((await maker('get', `/bir/dat-files/qap?year=${q.year}`)).status).toBe(400);
    expect((await maker('get', '/bir/dat-files/layout')).body.data.files.qap.records).toHaveLength(3);
  });
});

describe('register of generated DAT files', () => {
  it('generates a file, validates it against its report and downloads it again unchanged', async () => {
    const q = await sampleQuarter();
    const g = await maker('post', '/bir/dat-files/qap/generate').send({ year: q.year, quarter: q.quarter });
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    const f = g.body.data;
    expect(f).toMatchObject({ type: 'qap', year: q.year, quarter: q.quarter, periodKey: `${q.year}-Q${q.quarter}`, generatedBy: expect.any(String), generatedByName: 'maker user' });
    expect(f.fileName).toMatch(/1601EQ\.DAT$/);
    expect(f.checks.map((c) => c.code)).toEqual(['records', 'incomePayment', 'taxWithheld']);
    expect(f.checks.every((c) => c.agrees)).toBe(true);
    expect(f.checks[0].report).toBe(f.rows);
    expect(f.checks.find((c) => c.code === 'taxWithheld').report).toBeCloseTo(f.totals.taxWithheld, 2);
    expect(f.valid).toBe(f.errors.length === 0);
    expect(f.content.split('\r\n')[0]).toMatch(/^HQAP,H1601EQ,/);
    expect(f.layout.records).toHaveLength(3);

    const list = (await maker('get', `/bir/dat-files?year=${q.year}`)).body.data;
    expect(list[0]).toMatchObject({ id: f.id, fileName: f.fileName, valid: f.valid });
    expect(list[0].content).toBeUndefined();
    const d = await file('get', `/bir/dat-files/generated/${f.id}/download`);
    expect(d.status).toBe(200);
    expect(d.body.toString('latin1')).toBe(f.content);
    expect((await query('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'bir_dat_file\' AND entity_id = $1', [f.id])).rows[0].n).toBe(2);

    const sawt = (await maker('post', '/bir/dat-files/sawt/generate').send({ year: q.year, quarter: q.quarter, form: '2551Q' })).body.data;
    expect(sawt).toMatchObject({ type: 'sawt', form: '2551Q' });
    expect(sawt.fileName).toMatch(/2551Q\.DAT$/);
    const annual = await maker('post', '/bir/dat-files/1604e/generate').send({ year: q.year });
    expect(annual.status).toBe(201);
    expect(annual.body.data).toMatchObject({ quarter: null, periodKey: String(q.year) });
    expect((await maker('post', '/bir/dat-files/qap/generate').send({ year: q.year })).status).toBe(400);
    expect((await maker('get', '/bir/dat-files/generated/bdf_missing')).status).toBe(404);
  });

  it('lists the records and totals that do not agree and the fields the BIR module refuses', () => {
    const id = { tin: '123456789', branch: '00000', name: 'Broker', rdoCode: '047' };
    const rows = [{ tin: '', registeredName: 'No TIN Corp.', atc: 'WC515', taxRate: 10, incomePayment: 1000, taxWithheld: 100 },
      { tin: '444555666', registeredName: null, lastName: null, firstName: null, atc: '', taxRate: 5, incomePayment: 200, taxWithheld: 10 }];
    const out = qapDat(id, rows, '2026-09-30');
    const ok = validateDat('qap', out.content, rows);
    expect(ok.checks.every((c) => c.agrees)).toBe(true);
    expect(ok.errors).toEqual([{ record: 2, name: 'NO TIN CORP.', code: 'tinMissing' }, { record: 3, name: null, code: 'nameMissing' }, { record: 3, name: null, code: 'atcMissing' }]);
    expect(ok.valid).toBe(false);
    // a report that no longer matches the file: one row more, a different total
    const off = validateDat('qap', out.content, [...rows, { tin: '777888999', registeredName: 'Late Payee', atc: 'WC515', incomePayment: 50, taxWithheld: 5 }]);
    expect(off.checks.filter((c) => !c.agrees).map((c) => [c.code, c.report, c.file, c.difference])).toEqual([['records', 3, 2, -1], ['incomePayment', 1250, 1200, -50], ['taxWithheld', 115, 110, -5]]);
    const sales = slspSalesDat(id, [{ tin: '000-111-222', registeredName: 'Malayan', address: 'Manila', exemptSales: 0, zeroRatedSales: 0, taxableSales: 50000, outputTax: 6000 }], '2026-09-30');
    const v = validateDat('slspSales', sales.content, [{ exemptSales: 0, zeroRatedSales: 0, taxableSales: 50000, outputTax: 6000 }]);
    expect(v).toMatchObject({ valid: true, errors: [] });
    expect(v.checks.map((c) => c.code)).toEqual(['records', 'exemptSales', 'zeroRatedSales', 'taxableSales', 'outputTax']);
    expect(splitRecord('D1,"A, B",3')).toEqual(['D1', 'A, B', '3']);
  });

  it('opens the register to period-end users and the generation to Accounting only', async () => {
    const q = await sampleQuarter();
    expect((await ctx.as('sales')('get', '/bir/dat-files')).status).toBe(403);
    expect((await ctx.as('sales')('post', '/bir/dat-files/qap/generate').send({ year: q.year, quarter: q.quarter })).status).toBe(403);
    expect((await ctx.as('sales')('get', '/bir/dat-files/generated/bdf_missing/download')).status).toBe(403);
  });
});

describe('invoicing setup', () => {
  it('says what is missing before invoices can carry the permit details, in codes the screen translates', async () => {
    await setSetting('invoice.atp_number', '');
    await setSetting('invoice.cas_permit_number', '');
    const s = (await maker('get', '/bir/invoices/seller')).body.data;
    expect(s.setup.state).toBe('incomplete');
    expect(s.setup.missing).toContain('permit');
    expect(s.setup.missing.every((m) => ['tin', 'address', 'permit', 'permitDate', 'serialRange'].includes(m))).toBe(true);
    await setSetting('invoice.cas_permit_number', 'AC-123-2026');
    expect((await maker('get', '/bir/invoices/seller')).body.data.setup.missing).toContain('permitDate');
    await setSetting('invoice.cas_permit_date', '2026-01-15');
    expect((await maker('get', '/bir/invoices/seller')).body.data.setup.missing).not.toContain('permitDate');
    expect(invoicingSetup({ tin: '123456789', address: 'Makati', atpNumber: 'ATP-1', atpDateIssued: '2026-01-02', serialFrom: 1, serialTo: 1 })).toEqual({ state: 'incomplete', missing: ['serialRange'] });
    expect(invoicingSetup({ tin: '123456789', address: 'Makati', atpNumber: 'ATP-1', atpDateIssued: '2026-01-02', serialFrom: 1, serialTo: 99999 })).toEqual({ state: 'ready', missing: [] });
    await setSetting('invoice.cas_permit_number', '');
    await setSetting('invoice.cas_permit_date', '');
  });
});

describe('2551Q percentage tax working paper (13.04)', () => {
  it('computes the percentage tax of a non-VAT broker on the ledger revenue at the configured rate', async () => {
    const q = await sampleQuarter();
    await setSetting('direct_bill.broker_vat_registered', false);
    const r = (await maker('get', `/bir/returns/2551Q?year=${q.year}&quarter=${q.quarter}`)).body.data;
    const gross = Number((await query(`SELECT COALESCE(sum(l.credit - l.debit), 0) AS s FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
      WHERE j.status IN ('posted','reversed') AND j.jv_date BETWEEN $1 AND $2 AND j.source NOT IN ('period-close','year-end-close') AND a.account_type = 'income' AND a.fs_group = 'Revenue'`,
    [r.period.from, r.period.to])).rows[0].s);
    expect(r.rate).toBe(3);
    expect(r.schedules[0].totals.grossSales).toBeCloseTo(gross, 2);
    expect(r.taxDue).toBeCloseTo(Math.round(gross * 3) / 100, 2);
    await setSetting('bir.percentage_tax_rate', 1);
    const r1 = (await maker('get', `/bir/returns/2551Q?year=${q.year}&quarter=${q.quarter}`)).body.data;
    expect(r1.taxDue).toBeCloseTo(Math.round(gross) / 100, 2);
    expect((await maker('get', `/bir/returns/calendar?year=${q.year}`)).body.data.filter((c) => c.form === '2551Q')).toHaveLength(4);
    expect((await file('get', `/bir/returns/2551Q/xlsx?year=${q.year}&quarter=${q.quarter}`)).body.subarray(0, 2).toString()).toBe('PK');
    await setSetting('bir.percentage_tax_rate', 3);
    await setSetting('direct_bill.broker_vat_registered', true);
  });
});

describe('sales invoices under the EOPT Act (13.10)', () => {
  const manual = (extra = {}) => ({ sourceType: 'manual', buyer: { buyerType: 'client', buyerName: 'Acme Logistics Corp.', buyerTin: '222-333-444-000', buyerAddress: 'Pasig City', buyerBusinessStyle: 'Acme' },
    lines: [{ description: 'Risk management consultancy', quantity: 1, unitPrice: 10000, vatClass: 'vatable' }, { description: 'Exempt service', amount: 500, vatClass: 'exempt' }], ...extra });

  it('issues numbered invoices with the required fields, posts a manual invoice and acknowledges its payments', async () => {
    const a = await maker('post', '/bir/invoices').send(manual());
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    const inv = a.body.data;
    expect(inv.invoiceNumber).toMatch(/^SI-\d{10}$/);
    expect(inv).toMatchObject({ vatableSales: 10000, vatExemptSales: 500, zeroRatedSales: 0, vatAmount: 1200, totalSales: 10500, totalAmount: 11700, status: 'issued', balance: 11700 });
    expect(inv.seller).toMatchObject({ registeredName: expect.any(String), tin: expect.stringMatching(/^\d{9}$/), branchCode: expect.stringMatching(/^\d{5}$/), vatRegistered: true });
    expect(await bal('1205003', inv.journalId)).toBe(11700);
    expect(await bal('235000', inv.journalId)).toBe(-1200);
    // TISPH parks the service invoice journal (accounting.parked_events) until a user other than the maker approves it
    expect((await query('SELECT status FROM journal_vouchers WHERE id = $1', [inv.journalId])).rows[0].status).toBe('for-approval');
    const b = (await maker('post', '/bir/invoices').send(manual())).body.data;
    expect(Number(b.invoiceNumber.slice(3))).toBe(Number(inv.invoiceNumber.slice(3)) + 1);

    // buyer TIN and address are required for a business buyer / from the threshold
    expect((await maker('post', '/bir/invoices').send(manual({ buyer: { buyerName: 'Walk-in', buyerBusinessStyle: 'Shop' } }))).status).toBe(400);
    const small = await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Certificate copy', amount: 100 }] });
    expect(small.status).toBe(201);

    const pay = await maker('post', `/bir/invoices/${inv.id}/payments`).send({ amount: 10700, ewtAmount: 1000, form2307No: 'CWT-ACME-1', referenceNo: 'BDO-1' });
    expect(pay.status, JSON.stringify(pay.body)).toBe(201);
    expect(pay.body.data.ackNumber).toMatch(/^PAR-\d{4}-\d{5}$/);
    expect(await bal('1302001', pay.body.data.journalId)).toBe(1000);
    expect(await bal('1205003', pay.body.data.journalId)).toBe(-11700);
    expect((await maker('post', `/bir/invoices/${inv.id}/payments`).send({ amount: 1 })).status).toBe(400);
    expect((await maker('post', `/bir/invoices/${inv.id}/cancel`).send({ reasonCode: 'SIC-WRONGBUYER' })).status).toBe(409);
    const ack = await file('get', `/bir/invoices/payments/${pay.body.data.id}/pdf`);
    expect(ack.body.subarray(0, 4).toString()).toBe('%PDF');
    // a payment acknowledgement is cancelled with a reason of its own list; a reason of another list is refused
    expect((await maker('post', `/bir/invoices/payments/${pay.body.data.id}/cancel`).send({ reasonCode: 'SIC-WRONGBUYER' })).status).toBe(400);
    expect((await maker('post', `/bir/invoices/payments/${pay.body.data.id}/cancel`).send({ reason: 'Cheque returned' })).status).toBe(400);
    const pc = await maker('post', `/bir/invoices/payments/${pay.body.data.id}/cancel`).send({ reasonCode: 'IPC-RETURNED' });
    expect(pc.status, JSON.stringify(pc.body)).toBe(200);
    expect(pc.body.data).toMatchObject({ status: 'cancelled', cancelReasonCode: 'IPC-RETURNED', cancelReason: 'Cheque returned or payment reversed by the bank' });
    // Other needs a note
    const noNote = await maker('post', `/bir/invoices/${inv.id}/cancel`).send({ reasonCode: 'SIC-OTHER' });
    expect(noNote.status).toBe(400);
    expect(noNote.body.errors[0].path).toBe('note');
    expect((await ctx.as('sales')('post', `/bir/invoices/${inv.id}/cancel`).send({ reasonCode: 'SIC-WRONGBUYER' })).status).toBe(403);
    const c = await maker('post', `/bir/invoices/${inv.id}/cancel`).send({ reasonCode: 'SIC-WRONGBUYER', note: 'Billed to the dealer instead of the fleet owner' });
    expect(c.status).toBe(200);
    expect(c.body.data).toMatchObject({ status: 'cancelled', cancelReasonCode: 'SIC-WRONGBUYER', cancelReason: 'Wrong buyer or buyer details: Billed to the dealer instead of the fleet owner', balance: 0 });
    // the journal was still parked: it is cancelled with the invoice instead of reversed
    const j = (await query('SELECT status FROM journal_vouchers WHERE id = $1', [inv.journalId])).rows[0];
    expect(j.status).toBe('cancelled');
    const pdf = await file('get', `/bir/invoices/${inv.id}/pdf`);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await maker('get', `/bir/invoices?search=${inv.invoiceNumber}`)).body.data[0].printCount).toBe(1);
  });

  it('invoices a commission debit note once, keeps numbers without gaps and stops at the registered serial range', async () => {
    const ic = (await query('SELECT id FROM insurance_companies WHERE code = \'MALAYAN\'')).rows[0];
    await query('UPDATE insurance_companies SET tin = \'000-123-456-000\', address = \'Binondo, Manila\' WHERE id = $1', [ic.id]);
    const dn = (await query(`INSERT INTO commission_debit_notes(dn_number, insurance_company_id, period_from, period_to, dn_date, commission, vat, amount, ewt_rate, balance, status)
      VALUES ('DN-TEST-0001', $1, '2026-08-01', '2026-08-31', '2026-09-01', 5000, 600, 5600, 0.1, 5600, 'open') RETURNING id`, [ic.id])).rows[0];
    const cand = (await maker('get', '/bir/invoices/candidates?type=debit_note')).body.data;
    expect(cand.map((x) => x.reference)).toContain('DN-TEST-0001');
    const r = await maker('post', '/bir/invoices').send({ sourceType: 'debit_note', sourceId: 'DN-TEST-0001' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data).toMatchObject({ buyerType: 'insurer', buyerTin: '000-123-456', vatableSales: 5000, vatAmount: 600, totalAmount: 5600, withholdingTax: 500, journalId: null, balance: 0 });
    expect((await maker('post', '/bir/invoices').send({ sourceType: 'debit_note', sourceId: String(dn.id) })).status).toBe(409);

    const last = Number(r.body.data.invoiceNumber.slice(3));
    await setSetting('invoice.serial_to', last + 1);
    expect((await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 50 }] })).status).toBe(201);
    expect((await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 50 }] })).status).toBe(409);
    await setSetting('invoice.serial_to', 9999999999);
    const next = (await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 50 }] })).body.data;
    expect(Number(next.invoiceNumber.slice(3))).toBe(last + 2);

    await setSetting('direct_bill.broker_vat_registered', false);
    const nv = (await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 300, vatClass: 'vatable' }] })).body.data;
    expect(nv).toMatchObject({ vatRegistered: false, vatableSales: 0, vatAmount: 0, totalSales: 300, totalAmount: 300 });
    await setSetting('direct_bill.broker_vat_registered', true);
  });
});

describe('EIS connector (13.12)', () => {
  it('builds a signed payload; switched off nothing is queued', async () => {
    const inv = { invoice_number: 'SI-0000000009', invoice_date: '2026-10-01', seller: { tin: '123456789', branchCode: '00000', registeredName: 'B', vatRegistered: true }, buyer_name: 'X', buyer_tin: '111222333000',
      currency: 'PHP', total_sales: 100, vatable_sales: 100, vat_exempt_sales: 0, zero_rated_sales: 0, vat_amount: 12, total_amount: 112, withholding_tax: 0 };
    const p = buildPayload(inv, [{ line_no: 1, description: 'Fee', quantity: 1, unit_price: 100, amount: 100, vat_class: 'vatable', vat_amount: 12 }]);
    expect(p).toMatchObject({ CompInvoiceId: 'SI-0000000009', Seller: { Tin: '123456789' }, Buyer: { Tin: '111222333', BranchCd: '000' }, VATableSales: 100, VATAmt: 12, TotAmt: 112 });
    expect(canonical({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    expect(signPayload(p, 'EIS_KEY', {})).toEqual({ signature: null, alg: 'none' });
    expect(signPayload(p, 'EIS_KEY', { EIS_KEY: 'k' }).alg).toBe('HS256-PLACEHOLDER');
    const r = (await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 50 }] })).body.data;
    expect((await query('SELECT count(*)::int AS n FROM eis_submissions WHERE invoice_id = $1', [r.id])).rows[0].n).toBe(0);
    const st = (await maker('get', '/bir/eis/status')).body.data;
    expect(st).toMatchObject({ enabled: false, mode: 'test', credentialsPresent: false, clientIdEnv: 'BIR_EIS_CLIENT_ID', setup: { state: 'off', missing: ['accreditationId'] } });
    expect(st.remainingWithBir).toBeUndefined();
    expect((await maker('post', '/bir/eis/process')).body.data.skipped).toBe('the e-invoicing connection is switched off');
  });

  it('queues invoices and cancellations, sends them to the fake provider, retries failures and supports the manual fallback', async () => {
    await setSetting('eis.enabled', true);
    const ok1 = (await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 80 }] })).body.data;
    const bad = (await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, remarks: 'EIS-TEST-UNAVAILABLE', lines: [{ description: 'Fee', amount: 90 }] })).body.data;
    expect(ok1.eisStatus).toBe('queued');
    const run = (await maker('post', '/bir/eis/process')).body.data;
    expect(run).toMatchObject({ accepted: 1, failed: 1 });
    const subs = (await maker('get', '/bir/eis/submissions')).body.data;
    const okSub = subs.find((s) => s.invoiceNumber === ok1.invoiceNumber);
    expect(okSub).toMatchObject({ status: 'accepted', mode: 'test', provider: 'fake', attempts: 1 });
    expect(okSub.eisReference).toMatch(/^TEST-/);
    const badSub = subs.find((s) => s.invoiceNumber === bad.invoiceNumber);
    expect(badSub).toMatchObject({ status: 'failed', attempts: 1 });
    expect(new Date(badSub.nextAttemptAt).getTime()).toBeGreaterThan(Date.now());
    expect((await maker('post', '/bir/eis/process')).body.data.sent).toBe(0); // not due yet

    const exp = await file('get', '/bir/eis/export');
    const json = JSON.parse(exp.body.toString());
    expect(json.invoices.map((x) => x.payload.CompInvoiceId)).toEqual([bad.invoiceNumber]);
    expect((await maker('post', `/bir/eis/submissions/${badSub.id}/retry`)).body.data).toMatchObject({ status: 'queued', attempts: 0 });
    const man = await maker('post', `/bir/eis/submissions/${badSub.id}/manual`).send({ reference: 'EIS-PORTAL-123' });
    expect(man.body.data).toMatchObject({ status: 'manual', eisReference: 'EIS-PORTAL-123' });

    // a cancellation of an invoice sent to the EIS is queued too
    await maker('post', `/bir/invoices/${ok1.id}/cancel`).send({ reasonCode: 'SIC-DUPLICATE' });
    const cancelSub = (await query('SELECT kind, status, payload FROM eis_submissions WHERE invoice_id = $1 AND kind = \'cancellation\'', [ok1.id])).rows[0];
    expect(cancelSub).toMatchObject({ kind: 'cancellation', status: 'queued' });
    expect(cancelSub.payload).toMatchObject({ DocType: 'SI-CANCEL', CancelReason: 'Duplicate invoice' });

    // live mode without credentials fails with the variable names and is retried later; nothing is sent
    await setSetting('eis.mode', 'live');
    await setSetting('eis.endpoint', 'https://eis.example.invalid/api/invoices');
    const live = (await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 70 }] })).body.data;
    await maker('post', '/bir/eis/process');
    const ls = (await query('SELECT status, last_error, mode, provider FROM eis_submissions WHERE invoice_id = $1', [live.id])).rows[0];
    expect(ls).toMatchObject({ status: 'failed', mode: 'live', provider: 'http' });
    expect(ls.last_error).toMatch(/BIR_EIS_CLIENT_ID/);
    const liveStatus = (await maker('get', '/bir/eis/status')).body.data;
    expect(liveStatus.setup).toEqual({ state: 'incomplete', missing: ['accreditationId', 'credentials', 'signingKey'] });
    expect(liveStatus.lastSentAt).toBeTruthy();
    await setSetting('eis.mode', 'test');
    await setSetting('eis.enabled', false);
  });

  it('retries a submission left in sending longer than eis.sending_stale_minutes (server stopped during the call)', async () => {
    await setSetting('eis.enabled', true);
    expect(await getSetting('eis.sending_stale_minutes')).toBe(15);
    const stuck = (await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 60 }] })).body.data;
    const fresh = (await maker('post', '/bir/invoices').send({ buyer: { buyerName: 'Walk-in customer' }, lines: [{ description: 'Fee', amount: 65 }] })).body.data;
    // a crash 20 minutes ago left one row in sending; another call is in flight right now
    await query("UPDATE eis_submissions SET status = 'sending', attempts = 1, updated_at = now() - interval '20 minutes' WHERE invoice_id = $1", [stuck.id]);
    await query("UPDATE eis_submissions SET status = 'sending', attempts = 1, updated_at = now() - interval '1 minute' WHERE invoice_id = $1", [fresh.id]);
    const run = (await maker('post', '/bir/eis/process')).body.data;
    expect(run).toMatchObject({ released: 1, sent: 1, accepted: 1 });
    const s = (await query('SELECT status, attempts, eis_reference, last_error FROM eis_submissions WHERE invoice_id = $1', [stuck.id])).rows[0];
    expect(s).toMatchObject({ status: 'accepted', attempts: 2, last_error: null });
    expect(s.eis_reference).toMatch(/^TEST-/);
    expect((await query('SELECT status FROM eis_submissions WHERE invoice_id = $1', [fresh.id])).rows[0].status).toBe('sending');
    // a stale row that has used up its attempts is released as failed and waits for Retry
    await query("UPDATE eis_submissions SET status = 'sending', attempts = 5, updated_at = now() - interval '20 minutes' WHERE invoice_id = $1", [fresh.id]);
    expect((await maker('post', '/bir/eis/process')).body.data).toMatchObject({ released: 1, sent: 0 });
    const f = (await query('SELECT status, last_error FROM eis_submissions WHERE invoice_id = $1', [fresh.id])).rows[0];
    expect(f.status).toBe('failed');
    expect(f.last_error).toMatch(/interrupted/);
    await setSetting('eis.enabled', false);
  });
});

describe('CAS registration pack (13.11)', () => {
  it('prints the loose-leaf books with page numbers running on through the year, reprints and voids', async () => {
    await setSetting('cas.enforce_print_order', false);
    const { year } = await sampleQuarter();
    const p1 = `${year}-09`; const p2 = `${year}-10`;
    for (const book of ['general_journal', 'general_ledger', 'cash_receipts', 'cash_disbursements', 'sales', 'purchases']) {
      const pv = await maker('get', `/bir/cas/books/${book}/preview?period=${p1}`);
      expect(pv.status, `${book} ${JSON.stringify(pv.body)}`).toBe(200);
      expect(pv.body.data.columns.length).toBeGreaterThan(3);
    }
    const gj = (await maker('get', `/bir/cas/books/general_journal/preview?period=${p1}`)).body.data;
    expect(gj.totals.debit).toBeCloseTo(gj.totals.credit, 2);
    const a = await file('post', '/bir/cas/books/general_journal/print').send({ period: p1 });
    expect(a.status).toBe(200);
    expect(a.body.subarray(0, 4).toString()).toBe('%PDF');
    expect(a.headers['x-book-pages']).toMatch(/^1-\d+$/);
    const last1 = Number(a.headers['x-book-pages'].split('-')[1]);
    const b = await file('post', '/bir/cas/books/general_journal/print').send({ period: p2 });
    expect(b.headers['x-book-pages']).toBe(`${last1 + 1}-${Number(b.headers['x-book-pages'].split('-')[1])}`);
    expect((await maker('post', '/bir/cas/books/general_journal/print').send({ period: p1 })).status).toBe(409);
    const prints = (await maker('get', `/bir/cas/prints?year=${year}&book=general_journal`)).body.data;
    expect(prints).toHaveLength(2);
    const first = prints.find((x) => x.period === p1);
    expect((await file('get', `/bir/cas/prints/${first.id}/pdf`)).status).toBe(200);
    expect((await maker('post', `/bir/cas/prints/${first.id}/void`).send({ reasonCode: 'CPV-MISPRINT' })).status).toBe(409);
    const second = prints.find((x) => x.period === p2);
    expect((await maker('post', `/bir/cas/prints/${second.id}/void`).send({ reason: 'Damaged pages' })).status).toBe(400);
    expect((await maker('post', `/bir/cas/prints/${second.id}/void`).send({ reasonCode: 'CPV-DAMAGED' })).body.errors[0].path).toBe('note');
    const voided = (await maker('post', `/bir/cas/prints/${second.id}/void`).send({ reasonCode: 'CPV-DAMAGED', note: 'Pages torn' })).body.data;
    expect(voided).toMatchObject({ status: 'voided', voidReasonCode: 'CPV-DAMAGED', voidReason: 'Pages damaged or lost: Pages torn' });
    const again = await file('post', '/bir/cas/books/general_journal/print').send({ period: p2 });
    expect(again.headers['x-book-pages'].split('-')[0]).toBe(String(last1 + 1));
    await setSetting('cas.enforce_print_order', true);
    expect((await maker('post', '/bir/cas/books/general_journal/print').send({ period: `${year}-12` })).status).toBe(409);
    expect((await file('get', `/bir/cas/books/sales/xlsx?period=${p1}`)).body.subarray(0, 2).toString()).toBe('PK');
  });

  it('produces the system description, the backup procedure, the audit trail extract and the checklist', async () => {
    for (const d of ['system-description', 'backup-procedure']) expect((await file('get', `/bir/cas/documents/${d}`)).body.subarray(0, 4).toString()).toBe('%PDF');
    const today = new Date().toISOString().slice(0, 10);
    const x = await file('get', `/bir/cas/audit-extract?from=2020-01-01&to=${today}&format=xlsx`);
    expect(x.status).toBe(200);
    expect(x.body.subarray(0, 2).toString()).toBe('PK');
    expect((await file('get', `/bir/cas/audit-extract?from=2020-01-01&to=${today}&format=pdf`)).body.subarray(0, 4).toString()).toBe('%PDF');
    const c = (await maker('get', '/bir/cas/checklist')).body.data;
    expect(c.books).toHaveLength(6);
    expect(c.checklist.find((i) => i.code === 'books')).toMatchObject({ done: true, status: 'complete' });
  });
});
