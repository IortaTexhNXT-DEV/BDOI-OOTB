/**
 * BIR Form 2307 for the expanded withholding tax withheld from suppliers in accounts payable (one certificate per
 * supplier and quarter from the 2307 generator of the commission payees; supplier EWT in the QAP, the 0619-E /
 * 1601-EQ, the 1604-E alphalist and the DAT files), and the disposal of fixed assets (sale or write-off: posting rule
 * fa.disposal with the gain or loss and the output VAT of a sale, the sales invoice of the sale, the disposal register,
 * the voucher, cancellation).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ledgerIntegrity, setupFinance } from './accounting.fixtures.js';
import { one, pool, query } from '../src/db/pool.js';
import { today } from '../src/lib/dates.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { alphalistRows } from '../src/modules/bir/common.js';

let ctx; let maker; let asOf; let year; let quarter; let month;
const jvLines = (jvId) => query('SELECT account_code, debit, credit FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId]).then((r) => r.rows.map((l) => ({ a: l.account_code, d: Number(l.debit), c: Number(l.credit) })));
const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });

beforeAll(async () => {
  ctx = await setupFinance();
  maker = ctx.as('maker');
  // supplier invoices post when submitted (no second approver), so the figures are in the books at once
  await query("UPDATE app_settings SET value = 'false' WHERE key = 'payables.maker_checker'");
  clearSettingsCache();
  asOf = await today();
  year = Number(asOf.slice(0, 4)); month = Number(asOf.slice(5, 7)); quarter = Math.floor((month - 1) / 3) + 1;
});
afterAll(async () => { await pool.end(); });

describe('BIR 2307 and the returns for supplier EWT (accounts payable)', () => {
  let supplierKey;
  it('lists every supplier with EWT in the quarter, per ATC of the invoice\'s tax code', async () => {
    const s = await maker('post', '/ops-masters/supplier').send({ code: 'SUP-EWT1', name: 'Makati Office Services Inc.', tin: '201-555-777-00000', address: '12 Ayala Ave, Makati City',
      vatRegistered: true, ewtCode: 'WC160', expenseAccount: '4401008' });
    expect(s.status).toBe(201);
    supplierKey = `Supplier:${s.body.data.id}`;
    const p = await maker('post', '/ops-masters/supplier').send({ code: 'SUP-EWT2', name: 'Liza Ramos Mendoza', tin: '301-222-333-00000', address: 'Quezon City', vatRegistered: false,
      ewtCode: 'WI010', expenseAccount: '4401006' });
    expect(p.status).toBe(201);
    const a = await maker('post', '/payables/invoices').send({ supplierId: 'SUP-EWT1', supplierInvoiceNo: 'SI-7001', invoiceDate: asOf, submit: true, lines: [{ description: 'Janitorial services', amount: 50000 }] });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ status: 'approved', ewtAmount: 1000 });
    const b = await maker('post', '/payables/invoices').send({ supplierId: 'SUP-EWT2', supplierInvoiceNo: 'OR-15', invoiceDate: asOf, submit: true, lines: [{ description: 'Legal opinion', amount: 20000 }] });
    expect(b.body.data).toMatchObject({ status: 'approved', inputVat: 0, ewtAmount: 1000 });
    // a cancelled invoice does not count
    const c = await maker('post', '/payables/invoices').send({ supplierId: 'SUP-EWT1', supplierInvoiceNo: 'SI-7002', invoiceDate: asOf, submit: true, lines: [{ amount: 10000 }] });
    expect((await maker('post', `/payables/invoices/${c.body.data.id}/cancel`).send({ reason: 'Duplicate' })).status).toBe(200);

    const r = await maker('get', `/period-end/bir/2307?year=${year}&quarter=${quarter}&payeeType=Supplier`);
    expect(r.status).toBe(200);
    expect(r.body.data.payees.map((x) => x.payeeType)).toEqual(['Supplier', 'Supplier']);
    expect(r.body.data.payees.find((x) => x.payeeKey === supplierKey)).toMatchObject({ payeeName: 'Makati Office Services Inc.', tin: '201-555-777-00000', transactions: 1,
      totalIncome: 50000, totalTax: 1000, atcs: ['WC160'], certificateNumber: null });
    const all = (await maker('get', `/period-end/bir/2307?year=${year}&quarter=${quarter}`)).body.data.payees;
    expect(all.some((x) => x.payeeKey === supplierKey)).toBe(true);
  });

  it('builds the certificate with the 2307 generator of the commission payees and issues it per supplier and quarter', async () => {
    const c = (await maker('get', `/period-end/bir/2307/certificate?year=${year}&quarter=${quarter}&payeeKey=${encodeURIComponent(supplierKey)}`)).body.data;
    const idx = (month - 1) % 3;
    expect(c.lines).toEqual([expect.objectContaining({ atc: 'WC160', nature: 'Purchase of services', total: 50000, tax: 1000, [`month${idx + 1}`]: 50000 })]);
    expect(c.payee).toMatchObject({ name: 'Makati Office Services Inc.', tin: '201-555-777-00000' });
    expect(c.transactions[0].reference).toMatch(/^APV-.+\(SI-7001\)$/);
    const r = await maker('post', '/period-end/bir/2307/issue-all').send({ year, quarter, payeeType: 'Supplier' });
    expect(r.status).toBe(200);
    expect(r.body.data.issued).toHaveLength(2);
    expect(r.body.data.issued.every((x) => /^CWT-/.test(x.certificateNumber))).toBe(true);
    const again = (await maker('post', '/period-end/bir/2307/issue-all').send({ year, quarter, payeeType: 'Supplier' })).body.data;
    expect(again).toMatchObject({ issued: [], alreadyIssued: 2 });
    expect((await ctx.as('sales')('post', '/period-end/bir/2307/issue-all').send({ year, quarter, payeeType: 'Supplier' })).status).toBe(403);
  });

  it('includes the supplier EWT in the QAP, the 1601-EQ (reconciled with the ledger) and the 0619-E', async () => {
    const p = { from: `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01` };
    const qap = await alphalistRows('qap', p.from, `${year}-12-31`);
    const row = qap.find((x) => x.registeredName === 'Makati Office Services Inc.');
    expect(row).toMatchObject({ atc: 'WC160', incomePayment: 50000, taxWithheld: 1000, tin: '201-555-777-00000' });
    expect(qap.find((x) => x.tin === '301-222-333-00000')).toMatchObject({ firstName: 'Liza', atc: 'WI010', taxWithheld: 1000 });
    const eq = (await maker('get', `/bir/returns/1601-EQ?year=${year}&quarter=${quarter}`)).body.data;
    const atc = eq.schedules.find((s) => s.code === 'atc').rows;
    expect(atc.find((x) => x.atc === 'WC160')).toMatchObject({ taxBase: 50000, tax: 1000 });
    expect(eq.reconciliation.checks.find((x) => x.code === 'qap').reconciled).toBe(true);
    expect(eq.reconciliation.checks.find((x) => x.code === 'ledger').reconciled).toBe(true);
    if (month % 3 !== 0) {
      const e = (await maker('get', `/bir/returns/0619-E?year=${year}&month=${month}`)).body.data;
      expect(e.schedules[0].rows.find((x) => x.atc === 'WC160').tax).toBe(1000);
      expect(e.reconciliation.reconciled).toBe(true);
    }
  });

  it('lists the suppliers in the 1604-E alphalist (individual by name parts) and in the QAP and 1604-E DAT files', async () => {
    const al = (await maker('get', `/bir/returns/1604-E?year=${year}`)).body.data.schedules.find((s) => s.code === 'schedule3').rows;
    expect(al.find((x) => x.registeredName === 'Makati Office Services Inc.')).toMatchObject({ tin: '201555777', atc: 'WC160', taxWithheld: 1000 });
    expect(al.find((x) => x.tin === '301222333')).toMatchObject({ firstName: 'Liza', middleName: 'Ramos', registeredName: null, atc: 'WI010' });
    const dat = (await maker('get', `/bir/dat-files/1604e?year=${year}`)).body.data;
    expect(dat.content).toMatch(/D3,1604E,\d{9},\d{4},12\/31\/\d{4},\d+,201555777,0000,"MAKATI OFFICE SERVICES INC.","","","",WC160,"PURCHASE OF SERVICES",50000\.00,2\.00,1000\.00/);
    const q = (await maker('get', `/bir/dat-files/qap?year=${year}&quarter=${quarter}`)).body.data;
    expect(q.content).toContain('"MAKATI OFFICE SERVICES INC."');
    expect(q.content).toMatch(/,301222333,0000,"","MENDOZA","LIZA","RAMOS",\d{2}\/\d{4},WI010,5\.00,20000\.00,1000\.00/);
  });
});

describe('fixed asset disposal', () => {
  let sold; let writeOff; let laptop;
  const register = async (b) => {
    const r = await maker('post', '/fixed-assets/assets').send({ classCode: 'COMPUTER', acquisitionDate: `${asOf.slice(0, 7)}-01`, depreciateFrom: asOf.slice(0, 7), ...b });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body.data;
  };

  it('previews a sale: book value, output VAT, gain or loss', async () => {
    laptop = await register({ name: 'Laptops (go-live)', cost: 120000, openingAccumulated: 60000 });
    const p = (await maker('get', `/fixed-assets/assets/${laptop.id}/disposal-preview?disposalType=sale&disposalDate=${asOf}&proceeds=50000`)).body.data;
    expect(p).toMatchObject({ cost: 120000, accumulatedDepreciation: 60000, bookValue: 60000, proceeds: 50000, vatCode: 'VAT12-OUT', outputVat: 6000, grossProceeds: 56000, gainLoss: -10000,
      unpostedPeriods: [] });
  });

  it('sells an asset for cash: fa.disposal removes cost and accumulated depreciation, books the loss and the output VAT, and issues the sales invoice', async () => {
    expect((await maker('post', `/fixed-assets/assets/${laptop.id}/dispose`).send({ disposalType: 'sale', disposalDate: asOf, proceeds: 50000 })).status).toBe(400);
    const r = await maker('post', `/fixed-assets/assets/${laptop.id}/dispose`).send({ disposalType: 'sale', disposalDate: asOf, proceeds: 50000, buyerName: 'Juan dela Cruz Trading Inc.',
      buyerTin: '401-555-666-00000', buyerAddress: '1 Rizal St, Pasig City', bankAccount: 'ACC-BDO-001' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    sold = r.body.data;
    expect(sold).toMatchObject({ disposalNumber: expect.stringMatching(/^FAD-/), status: 'posted', gainLoss: -10000, outputVat: 6000, grossProceeds: 56000, salesInvoiceNumber: expect.any(String) });
    expect(await jvLines(sold.journalId)).toEqual([{ a: '1402003', d: 60000, c: 0 }, { a: '1102001', d: 56000, c: 0 }, { a: '4501004', d: 10000, c: 0 },
      { a: '1401003', d: 0, c: 120000 }, { a: '235000', d: 0, c: 6000 }]);
    const inv = (await maker('get', `/bir/invoices/${sold.salesInvoiceId}`)).body.data;
    expect(inv).toMatchObject({ sourceType: 'asset_disposal', sourceReference: sold.disposalNumber, buyerName: 'Juan dela Cruz Trading Inc.', vatableSales: 50000, vatAmount: 6000,
      totalAmount: 56000, balance: 0 });
    const asset = (await maker('get', `/fixed-assets/assets/${laptop.id}`)).body.data;
    expect(asset).toMatchObject({ status: 'disposed', disposedOn: asOf, disposalId: sold.id });
    expect((await maker('post', `/fixed-assets/assets/${laptop.id}/dispose`).send({ disposalType: 'write-off', disposalDate: asOf, reason: 'x' })).status).toBe(409);
    const run = (await maker('get', `/fixed-assets/depreciation/${asOf.slice(0, 7)}`)).body.data;
    expect(run.due.some((d) => d.assetId === laptop.id)).toBe(false);
  });

  it('sells a fully depreciated asset on credit at a gain: the receivable is collected on its sales invoice', async () => {
    const old = await register({ name: 'Old printer', cost: 10000, openingAccumulated: 10000 });
    expect(old.status).toBe('fully-depreciated');
    const r = await maker('post', `/fixed-assets/assets/${old.id}/dispose`).send({ disposalType: 'sale', disposalDate: asOf, proceeds: 2000, buyerName: 'Ana Santos', buyerTin: '501-111-222-00000',
      buyerAddress: 'Taguig City' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data).toMatchObject({ gainLoss: 2000, amountDue: 2240 });
    expect(await jvLines(r.body.data.journalId)).toEqual([{ a: '1402003', d: 10000, c: 0 }, { a: '1205003', d: 2240, c: 0 }, { a: '1401003', d: 0, c: 10000 },
      { a: '235000', d: 0, c: 240 }, { a: '3301004', d: 0, c: 2000 }]);
    const pay = await maker('post', `/bir/invoices/${r.body.data.salesInvoiceId}/payments`).send({ amount: 2240, paymentDate: asOf, paymentMode: 'bank-transfer', bankAccount: 'ACC-BDO-001' });
    expect(pay.status, JSON.stringify(pay.body)).toBe(201);
    expect((await maker('get', `/fixed-assets/disposals/${r.body.data.id}`)).body.data.amountDue).toBe(0);
    // the paid invoice cannot be cancelled, so neither can the disposal
    expect((await maker('post', `/fixed-assets/disposals/${r.body.data.id}/cancel`).send({ reason: 'Buyer withdrew' })).status).toBe(409);
  });

  it('writes off an asset (reason required): the book value is a loss', async () => {
    const lost = await register({ name: 'Projector', cost: 30000, openingAccumulated: 10000 });
    expect((await maker('post', `/fixed-assets/assets/${lost.id}/dispose`).send({ disposalType: 'write-off', disposalDate: asOf })).status).toBe(400);
    const r = await maker('post', `/fixed-assets/assets/${lost.id}/dispose`).send({ disposalType: 'write-off', disposalDate: asOf, reason: 'Stolen from the Cebu branch (police report 123)' });
    expect(r.status).toBe(201);
    writeOff = r.body.data;
    expect(writeOff).toMatchObject({ disposalType: 'write-off', proceeds: 0, outputVat: 0, gainLoss: -20000, salesInvoiceId: null });
    expect(await jvLines(writeOff.journalId)).toEqual([{ a: '1402003', d: 10000, c: 0 }, { a: '4501004', d: 20000, c: 0 }, { a: '1401003', d: 0, c: 30000 }]);
  });

  it('refuses a disposal while depreciation of earlier months is not posted', async () => {
    const d = new Date(`${asOf}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 2);
    const earlier = d.toISOString().slice(0, 7);
    const a = await register({ name: 'Monitor', cost: 36000, acquisitionDate: `${earlier}-01`, depreciateFrom: earlier });
    const r = await maker('post', `/fixed-assets/assets/${a.id}/dispose`).send({ disposalType: 'write-off', disposalDate: asOf, reason: 'Broken' });
    expect(r.status).toBe(409);
    expect(r.body.message).toContain(`Post the depreciation of ${earlier}`);
  });

  it('cancels a disposal: journal reversed, the asset restored; the register, its export and the voucher', async () => {
    const c = await maker('post', `/fixed-assets/disposals/${writeOff.id}/cancel`).send({ reason: 'Projector recovered' });
    expect(c.status).toBe(200);
    expect(c.body.data).toMatchObject({ status: 'cancelled', reversalJournalNumber: expect.any(String) });
    expect((await maker('get', `/fixed-assets/assets/${writeOff.assetId}`)).body.data).toMatchObject({ status: 'active', disposalId: null });
    const reg = (await maker('get', `/fixed-assets/disposals?from=${asOf}&to=${asOf}`)).body.data;
    expect(reg.rows.map((x) => x.status).sort()).toEqual(['cancelled', 'posted', 'posted']);
    expect(reg.summary).toMatchObject({ disposals: 2, proceeds: 52000, outputVat: 6240, gain: 2000, loss: 10000 });
    const x = await binary(maker('get', `/fixed-assets/disposals?from=${asOf}&to=${asOf}&format=xlsx`));
    expect(x.status).toBe(200);
    expect(x.body.subarray(0, 2).toString()).toBe('PK');
    const pdf = await binary(maker('get', `/fixed-assets/disposals/${sold.id}/pdf`));
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await ctx.as('sales')('get', '/fixed-assets/disposals')).status).toBe(403);
    expect((await one("SELECT count(*)::int AS n FROM posting_rules WHERE event_code = 'fa.disposal'")).n).toBe(1);
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
  });
});
