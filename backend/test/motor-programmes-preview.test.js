import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { premiumShares, splitLines } from '../src/modules/motor-programmes/service.js';

let ctx;
let sales;
const ids = {};
const HEADER = 'Dealer Branch Code,Sale Date,Sales Invoice No.,Buyer First Name,Buyer Last Name,Buyer Company Name,Buyer Email,Buyer Mobile,Buyer City / Municipality,Buyer Province,Make,Model,Variant,Year Model,Color,Vehicle Type,Conduction Sticker,Chassis Number,Engine Number,Invoice Price,Financing Bank Code,Loan Amount';
const csv = (...rows) => Buffer.from([HEADER, ...rows].join('\r\n'));
const preview = (code, params) => sales('get', `/motor-programmes/${ids[code]}/premium-preview?${new URLSearchParams(params)}`);
const line = (data, code) => data.lines.find((l) => l.code === code);
const figures = (d) => ({
  od: line(d, 'lossAndDamageCoveragePremium').amount, aon: line(d, 'actsOfNaturePremium').amount, bi: line(d, 'bodilyInjuryCoveragePremium').amount,
  pd: line(d, 'propertyDamageCoveragePremium').amount, net: d.netPremium, vat: line(d, 'VAT').amount, dst: line(d, 'DST').amount, lgt: line(d, 'LGT').amount,
  ctpl: line(d, 'CTPL').amount, gross: d.grossPremium, payer: d.payer, buyer: d.buyer, payerType: d.payerType,
});

beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'mpp.sales', password: 'Welcome@123', displayName: 'mpp.sales', roles: ['sales'] });
  const token = await loginAs(ctx.app, 'mpp.sales', 'Welcome@123');
  sales = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  for (const r of (await pool.query('SELECT id, code FROM motor_programmes')).rows) ids[r.code] = r.id;
});
afterAll(async () => { await pool.end(); });

describe('premium preview of the sample programmes (default LGT rule rate, no location)', () => {
  // TCB-TFS-2026: light / medium truck, OD/theft 1.15%, AON 0.5%, BI 100,000 and PD 200,000 at 1%, 1-year CTPL, the buyer pays
  it.each([
    [1000000, { od: 11500, aon: 5000, bi: 1000, pd: 2000, net: 19500, vat: 2340, dst: 2437.5, lgt: 146.25, ctpl: 660.4, gross: 25084.15, payer: 0, buyer: 25084.15, payerType: null }],
    [1015000, { od: 11672.5, aon: 5075, bi: 1000, pd: 2000, net: 19747.5, vat: 2369.7, dst: 2468.5, lgt: 148.11, ctpl: 660.4, gross: 25394.21, payer: 0, buyer: 25394.21, payerType: null }],
    [2500000, { od: 28750, aon: 12500, bi: 1000, pd: 2000, net: 44250, vat: 5310, dst: 5531.5, lgt: 331.88, ctpl: 660.4, gross: 56083.78, payer: 0, buyer: 56083.78, payerType: null }],
  ])('TCB-TFS-2026 at %d', async (price, expected) => {
    const r = await preview('TCB-TFS-2026', { invoicePrice: price });
    expect(r.status).toBe(200);
    expect(figures(r.body.data)).toEqual(expected);
    expect(r.body.data.basis).toMatchObject({ programmeCode: 'TCB-TFS-2026', sumInsured: price, ownDamageRate: 1.15, vehicleType: 'light_medium_trucks', ctplTermYears: 1, lgu: null, lgtRate: 0.75 });
  });

  // TAL-CASH-2026: private car, OD/theft 2%, AON 0.5%, BI and PD 200,000, 3-year CTPL, the dealer pays half
  it.each([
    [1000000, { od: 20000, aon: 5000, bi: 2000, pd: 2000, net: 29000, vat: 3480, dst: 3625, lgt: 217.5, ctpl: 1660.4, gross: 37982.9, payer: 18991.45, buyer: 18991.45, payerType: 'dealer' }],
    [1015000, { od: 20300, aon: 5075, bi: 2000, pd: 2000, net: 29375, vat: 3525, dst: 3672, lgt: 220.31, ctpl: 1660.4, gross: 38452.71, payer: 19226.36, buyer: 19226.35, payerType: 'dealer' }],
    [2500000, { od: 50000, aon: 12500, bi: 2000, pd: 2000, net: 66500, vat: 7980, dst: 8312.5, lgt: 498.75, ctpl: 1660.4, gross: 84951.65, payer: 42475.83, buyer: 42475.82, payerType: 'dealer' }],
  ])('TAL-CASH-2026 at %d', async (price, expected) => {
    const r = await preview('TAL-CASH-2026', { invoicePrice: price });
    expect(r.status).toBe(200);
    expect(figures(r.body.data)).toEqual(expected);
    expect(r.body.data.basis).toMatchObject({ ctplTermYears: 3, payerName: 'Toyota Alabang, Inc.', subsidyType: 'percent', subsidyValue: 50 });
  });

  // TMK-TFS-2026: as TAL-CASH-2026 but the first year is free, paid in full by the dealer
  it.each([
    [1000000, { od: 20000, aon: 5000, bi: 2000, pd: 2000, net: 29000, vat: 3480, dst: 3625, lgt: 217.5, ctpl: 1660.4, gross: 37982.9, payer: 37982.9, buyer: 0, payerType: 'dealer' }],
    [1015000, { od: 20300, aon: 5075, bi: 2000, pd: 2000, net: 29375, vat: 3525, dst: 3672, lgt: 220.31, ctpl: 1660.4, gross: 38452.71, payer: 38452.71, buyer: 0, payerType: 'dealer' }],
  ])('TMK-TFS-2026 at %d', async (price, expected) => {
    const r = await preview('TMK-TFS-2026', { invoicePrice: price });
    expect(r.status).toBe(200);
    expect(figures(r.body.data)).toEqual(expected);
  });

  it('each line shows what the payer and the buyer pay of it; the lines add up to the gross and the shares', async () => {
    for (const code of ['TAL-CASH-2026', 'TCB-TFS-2026', 'TMK-TFS-2026']) {
      const d = (await preview(code, { invoicePrice: 1234567 })).body.data;
      const sum = (k) => Math.round(d.lines.reduce((s, l) => s + l[k], 0) * 100) / 100;
      expect(sum('amount')).toBe(d.grossPremium);
      expect(sum('payer')).toBe(d.payer);
      expect(sum('buyer')).toBe(d.buyer);
      expect(d.taxes).toBe(Math.round((line(d, 'VAT').amount + line(d, 'DST').amount + line(d, 'LGT').amount) * 100) / 100);
    }
  });
});

describe('what the preview takes into account', () => {
  it('LGT at the rate of the LGU chosen', async () => {
    const d = (await preview('TAL-CASH-2026', { invoicePrice: 1015000, lguCode: 'MKT' })).body.data;
    expect(figures(d)).toMatchObject({ lgt: 58.75, gross: 38291.15, payer: 19145.58, buyer: 19145.57 });
    expect(d.basis.lgu).toMatchObject({ code: 'MKT', rate: 0.2 });
    expect((await preview('TAL-CASH-2026', { invoicePrice: 1015000, lguCode: 'NOPE' })).status).toBe(400);
  });

  it('CTPL of the vehicle class chosen, for the programme\'s CTPL term', async () => {
    const d = (await preview('TCB-TFS-2026', { invoicePrice: 1000000, vehicleType: 'private_cars' })).body.data;
    expect(line(d, 'CTPL')).toMatchObject({ amount: 610.4, years: 1 });
    expect(d.grossPremium).toBe(25034.15);
    expect((await preview('TCB-TFS-2026', { invoicePrice: 1000000, vehicleType: 'spaceship' })).status).toBe(400);
  });

  it('no CTPL line when the programme leaves CTPL out', async () => {
    const r = await sales('post', '/motor-programmes').send({ code: 'TMK-NOCTPL', name: 'Without CTPL', dealerChannelId: 'ch_seed_tmk', insuranceCompanyId: 3, vehicleType: 'private_cars',
      ownDamageRate: 2, includeCtpl: false });
    expect(r.status).toBe(201);
    ids['TMK-NOCTPL'] = r.body.data.id;
    const d = (await preview('TMK-NOCTPL', { invoicePrice: 1000000 })).body.data;
    expect(line(d, 'CTPL')).toBeUndefined();
    expect(d.ctplPremium).toBe(0);
    expect(d.grossPremium).toBe(25050); // own damage / theft 20,000 + VAT 2,400 + DST 2,500 + LGT 150
  });

  it('a bank subsidy applies to a financed car only', async () => {
    const r = await sales('post', '/motor-programmes').send({ code: 'TMK-BANK30', name: 'TFS pays 30%', dealerChannelId: 'ch_seed_tmk', bankChannelId: 'ch_seed_tfs', insuranceCompanyId: 3,
      vehicleType: 'private_cars', ownDamageRate: 2, includeCtpl: false, subsidyPayer: 'bank', subsidyType: 'percent', subsidyValue: 30 });
    expect(r.status).toBe(201);
    ids['TMK-BANK30'] = r.body.data.id;
    const financed = (await preview('TMK-BANK30', { invoicePrice: 1000000 })).body.data;
    expect(financed).toMatchObject({ grossPremium: 25050, payer: 7515, buyer: 17535, payerType: 'bank' });
    const cash = (await preview('TMK-BANK30', { invoicePrice: 1000000, financed: 'false' })).body.data;
    expect(cash).toMatchObject({ grossPremium: 25050, payer: 0, buyer: 25050, payerType: null });
  });

  it('refuses a missing or non-positive invoice price', async () => {
    expect((await preview('TCB-TFS-2026', { invoicePrice: 0 })).status).toBe(400);
    expect((await sales('get', `/motor-programmes/${ids['TCB-TFS-2026']}/premium-preview`)).status).toBe(400);
  });

  it('lists the vehicle classes and LGUs to choose from', async () => {
    const r = await sales('get', '/motor-programmes/preview-options');
    expect(r.status).toBe(200);
    expect(r.body.data.vehicleTypes.find((v) => v.value === 'private_cars')).toMatchObject({ ctplPremium: 610.4, ctplPremium3Year: 1660.4 });
    expect(r.body.data.lgus.find((l) => l.code === 'MKT')).toMatchObject({ rate: 0.2 });
  });
});

describe('the preview equals the quotation of an uploaded sale', () => {
  const sold = '2026-09-15';
  it('same vehicle, price and buyer city: same premium, taxes and shares', async () => {
    const tcb = await sales('post', `/motor-programmes/${ids['TCB-TFS-2026']}/sales/upload`)
      .attach('file', csv(`,${sold},SI-P1,Rosa,Tan,,,,Cebu City,Cebu,Toyota,Hilux,2.4 E,2026,White,,CS9001,MR0HA3CD5R0999001,2GD-9001,1015000,,`), 'a.csv');
    expect(tcb.body.data.created).toBe(1);
    const tal = await sales('post', `/motor-programmes/${ids['TAL-CASH-2026']}/sales/upload`)
      .attach('file', csv(`TAL-ALB,${sold},SI-P2,Lito,Garcia,,,,Makati,Metro Manila,Toyota,Vios,1.3 XLE,2026,Red,private_cars,CS9002,MR2B29F30R0999002,2NR-9002,1015000,,`), 'b.csv');
    expect(tal.body.data.created).toBe(1);
    const q = async (inv) => (await pool.query(`SELECT s.gross_premium, s.payer_share, s.buyer_share, q.premium_base, q.vat, q.dst, q.lgt FROM dealer_sales s JOIN quotes q ON q.id = s.quote_id
      WHERE s.invoice_number = $1`, [inv])).rows[0];
    const asNumbers = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)]));
    const pTcb = (await preview('TCB-TFS-2026', { invoicePrice: 1015000 })).body.data;
    expect(asNumbers(await q('SI-P1'))).toEqual({ gross_premium: pTcb.grossPremium, payer_share: pTcb.payer, buyer_share: pTcb.buyer, premium_base: pTcb.netPremium,
      vat: line(pTcb, 'VAT').amount, dst: line(pTcb, 'DST').amount, lgt: line(pTcb, 'LGT').amount });
    // the buyer lives in Makati: LGT at the Makati rate, as the preview for the Makati LGU
    const pTal = (await preview('TAL-CASH-2026', { invoicePrice: 1015000, lguCode: 'MKT' })).body.data;
    expect(asNumbers(await q('SI-P2'))).toEqual({ gross_premium: pTal.grossPremium, payer_share: pTal.payer, buyer_share: pTal.buyer, premium_base: pTal.netPremium,
      vat: line(pTal, 'VAT').amount, dst: line(pTal, 'DST').amount, lgt: 58.75 });
  });

  it('a cash sale under a bank-subsidised programme is billed to the buyer alone', async () => {
    await sales('put', `/motor-programmes/${ids['TMK-BANK30']}`).send({ issueMode: 'policy' });
    const r = await sales('post', `/motor-programmes/${ids['TMK-BANK30']}/sales/upload`)
      .attach('file', csv(`TMK-MKT,${sold},SI-P3,Ana,Lopez,,ana@example.ph,,,,Toyota,Wigo,1.0 G,2026,Red,private_cars,CS9003,MR2B29F30R0999003,1KR-9003,1000000,,`,
        `TMK-MKT,${sold},SI-P4,Ben,Lopez,,ben@example.ph,,,,Toyota,Wigo,1.0 G,2026,Red,private_cars,CS9004,MR2B29F30R0999004,1KR-9004,1000000,TFS-HQ,700000`), 'c.csv');
    expect(r.body.data.created).toBe(2);
    const rows = (await pool.query("SELECT invoice_number, payer_share, buyer_share FROM dealer_sales WHERE invoice_number IN ('SI-P3', 'SI-P4') ORDER BY invoice_number")).rows;
    expect(rows.map((x) => [x.invoice_number, Number(x.payer_share), Number(x.buyer_share)])).toEqual([['SI-P3', 0, 25050], ['SI-P4', 7515, 17535]]);
  });
});

describe('programme terms the tariff cannot price', () => {
  it('refuses an unknown vehicle class and a 3-year CTPL the tariff has no amount for', async () => {
    const base = { name: 'Bad terms', dealerChannelId: 'ch_seed_tcb', ownDamageRate: 1.15 };
    const unknown = await sales('post', '/motor-programmes').send({ ...base, code: 'TCB-X1', vehicleType: 'spaceship' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.errors[0].path).toBe('vehicleType');
    const threeYears = await sales('post', '/motor-programmes').send({ ...base, code: 'TCB-X2', vehicleType: 'light_medium_trucks', ctplTermYears: 3 });
    expect(threeYears.status).toBe(400);
    expect(threeYears.body.errors[0].path).toBe('ctplTermYears');
    const change = await sales('put', `/motor-programmes/${ids['TCB-TFS-2026']}`).send({ ctplTermYears: 3 });
    expect(change.status).toBe(400);
    expect((await sales('post', '/motor-programmes').send({ ...base, code: 'TCB-X3', vehicleType: 'light_medium_trucks', ctplTermYears: 1 })).status).toBe(201);
  });
});

describe('splitting the lines between the payer and the buyer', () => {
  it('spreads the payer share in proportion, the rounding difference on the largest line', () => {
    const lines = [{ code: 'a', amount: 100.01 }, { code: 'b', amount: 33.33 }, { code: 'c', amount: 0.03 }];
    const gross = 133.37;
    const { payer, buyer } = premiumShares({ subsidy_payer: 'dealer', subsidy_type: 'amount', subsidy_value: 50 }, gross);
    const out = splitLines(lines, { payer });
    expect(out.reduce((s, l) => Math.round((s + l.payer) * 100) / 100, 0)).toBe(payer);
    expect(out.reduce((s, l) => Math.round((s + l.buyer) * 100) / 100, 0)).toBe(buyer);
    for (const l of out) expect(Math.round((l.payer + l.buyer) * 100) / 100).toBe(l.amount);
    expect(splitLines(lines, { payer: 0 }).every((l) => l.payer === 0 && l.buyer === l.amount)).toBe(true);
  });

  it('a bank pays only for a financed car', () => {
    const bank = { subsidy_payer: 'bank', subsidy_type: 'full', free_first_year: false };
    expect(premiumShares(bank, 1000)).toEqual({ buyer: 0, payer: 1000, payerType: 'bank' });
    expect(premiumShares(bank, 1000, { financed: false })).toEqual({ buyer: 1000, payer: 0, payerType: null });
    expect(premiumShares({ subsidy_payer: 'dealer', free_first_year: true }, 1000, { financed: false })).toEqual({ buyer: 0, payer: 1000, payerType: 'dealer' });
  });
});
