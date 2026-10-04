import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { premiumShares } from '../src/modules/motor-programmes/service.js';

let ctx;
let sales;
let ops;
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const HEADER = 'Dealer Branch Code,Sale Date,Sales Invoice No.,Buyer First Name,Buyer Last Name,Buyer Company Name,Buyer Email,Buyer Mobile,Buyer City / Municipality,Buyer Province,Make,Model,Variant,Year Model,Color,Vehicle Type,Conduction Sticker,Chassis Number,Engine Number,Invoice Price,Financing Bank Code,Loan Amount';
const csv = (...rows) => Buffer.from([HEADER, ...rows].join('\r\n'));
const sold = '2026-09-15';

let programmeId;
beforeAll(async () => {
  ctx = await setup();
  sales = await persona('mp.sales', ['sales']);
  ops = await persona('mp.ops', ['operations']);
  programmeId = (await pool.query("SELECT id FROM motor_programmes WHERE code = 'MMG-BDO-2026'")).rows[0].id;
});
afterAll(async () => { await pool.end(); });

describe('who pays the premium', () => {
  it('splits the premium between the buyer and the dealer or bank', () => {
    expect(premiumShares({ subsidy_payer: 'none', free_first_year: false }, 1000)).toEqual({ buyer: 1000, payer: 0, payerType: null });
    expect(premiumShares({ subsidy_payer: 'dealer', free_first_year: true }, 1000)).toEqual({ buyer: 0, payer: 1000, payerType: 'dealer' });
    expect(premiumShares({ subsidy_payer: 'none', free_first_year: true }, 1000)).toEqual({ buyer: 0, payer: 1000, payerType: 'dealer' });
    expect(premiumShares({ subsidy_payer: 'bank', subsidy_type: 'percent', subsidy_value: 40 }, 1000)).toEqual({ buyer: 600, payer: 400, payerType: 'bank' });
    expect(premiumShares({ subsidy_payer: 'dealer', subsidy_type: 'amount', subsidy_value: 1500 }, 1000)).toEqual({ buyer: 0, payer: 1000, payerType: 'dealer' });
  });
});

describe('brand-new vehicle programme', () => {
  it('programmes are maintained by sales and processing, read by operations; a bank subsidy needs the bank', async () => {
    expect((await ops('get', '/motor-programmes')).status).toBe(200);
    expect((await ops('post', '/motor-programmes').send({ code: 'X', name: 'X', dealerChannelId: 'ch_seed_mmg', ownDamageRate: 1 })).status).toBe(403);
    const noBank = await sales('post', '/motor-programmes').send({ code: 'MMG-BANKSUB', name: 'Bank subsidy without bank', dealerChannelId: 'ch_seed_mmg', ownDamageRate: 1.5, subsidyPayer: 'bank' });
    expect(noBank.status).toBe(400);
    const wrongDealer = await sales('post', '/motor-programmes').send({ code: 'X2', name: 'Dealer is a bank', dealerChannelId: 'ch_seed_bdo', ownDamageRate: 1.5 });
    expect(wrongDealer.status).toBe(400);
  });

  it('previews the premium of a car and who pays it', async () => {
    const r = await sales('get', `/motor-programmes/${programmeId}/premium-preview?invoicePrice=1015000`);
    expect(r.status).toBe(200);
    expect(r.body.data.ctplPremium).toBe(1660.4); // 3-year CTPL of a private car (tariff)
    expect(r.body.data.netPremium).toBeGreaterThan(20000);
    expect(r.body.data).toMatchObject({ buyer: 0, payerType: 'dealer' });
    expect(r.body.data.payer).toBe(r.body.data.grossPremium);
  });

  it('downloads the Dealer Sales template', async () => {
    const t = await sales('get', '/motor-programmes/upload-template').buffer(true).parse(binary);
    expect(t.status).toBe(200);
    expect(t.headers['content-disposition']).toMatch(/Dealer_Sales_Upload_Template\.xlsx/);
  });

  let financedSaleId;
  let cashSaleId;
  let batchId;
  it('an upload creates prospect, quotation and policy per sale, billed to the dealer for a free first year; a bad row is reported', async () => {
    const file = csv(
      `MMG-MKT,${sold},SI-1001,Ramon,Villanueva,,ramon.v@example.ph,09175550123,Makati City,Metro Manila,Toyota,Vios,1.3 XLE CVT,2026,Silver,private_cars,A1B234,MR2B29F30R1123456,2NR-F123456,"1,015,000",BDO-AUTO-MKT,812000`,
      `MMG-ALB,${sold},SI-1002,Teresa,Lim,,teresa.lim@example.ph,09175550199,Muntinlupa City,Metro Manila,Toyota,Innova,2.8 E AT,2026,White,private_cars,C7D881,MHFJW8EM5R4044455,1GD-5512277,1520000,,`,
      `MMG-MKT,${sold},SI-1003,Nestor,Cruz,,,,,,Toyota,Wigo,1.0 G,2026,Red,private_cars,E9F001,,1KR-0001,698000,,`,
    );
    const r = await sales('post', `/motor-programmes/${programmeId}/sales/upload`).attach('file', file, 'sales.csv');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ total: 3, created: 2, failed: 1, issueMode: 'policy' });
    expect(r.body.data.errors[0]).toMatchObject({ row: 4 });
    expect(r.body.data.errors[0].message).toMatch(/Chassis Number is required/);
    batchId = r.body.data.batchId;
    const list = await sales('get', `/motor-programmes/sales?batchId=${batchId}`);
    const financed = list.body.data.find((s) => s.invoiceNumber === 'SI-1001');
    const cash = list.body.data.find((s) => s.invoiceNumber === 'SI-1002');
    financedSaleId = financed.id;
    cashSaleId = cash.id;
    expect(financed).toMatchObject({ status: 'created', dealerName: 'Makati Motors Makati', bankName: 'BDO Auto Loans Makati Center', buyerShare: 0 });
    expect(financed.policyNumber).toBeTruthy();
    expect(cash.bankChannelId).toBeNull();
    // policy: channel, mortgagee, inception on the sale date; the bill goes to the dealer's billing account
    const p = (await pool.query(`SELECT p.*, l.channel_id AS lead_channel FROM policies p JOIN dealer_sales s ON s.policy_id = p.id JOIN leads l ON l.id = p.lead_id WHERE s.id = $1`, [financedSaleId])).rows[0];
    expect(p.channel_id).toBe('ch_seed_mmg_mkt');
    expect(p.lead_channel).toBe('ch_seed_mmg_mkt');
    expect(p.inception_date).toBe(sold);
    expect(p.doc.mortgage).toBe('BDO Unibank, Inc. (Auto Loans)');
    expect(p.doc.mortgageeClause).toMatch(/payable to BDO Unibank, Inc\. \(Auto Loans\) as mortgagee/);
    const bills = (await pool.query('SELECT r.amount, c.display_name FROM receivables r JOIN clients c ON c.id = r.client_id WHERE r.policy_id = $1', [p.id])).rows;
    expect(bills).toEqual([{ amount: Number(p.premium_total), display_name: 'Makati Motors Group' }]);
    expect((await pool.query('SELECT count(*)::int AS n FROM channel_billing_accounts')).rows[0].n).toBe(1);
    // the dealer's referrer earns the comsub on the policy (channel referral)
    expect(p.details.commissionDetails.primary.referrerId).toBe('ref-makatimotors');
  });

  it('refuses the same car twice', async () => {
    const again = csv(`MMG-MKT,${sold},SI-1004,Ramon,Villanueva,,,,,,Toyota,Vios,,2026,,private_cars,,MR2B29F30R1123456,2NR-F123456,1015000,,`);
    const r = await sales('post', `/motor-programmes/${programmeId}/sales/upload`).attach('file', again, 'again.csv');
    expect(r.body.data.failed).toBe(1);
    expect(r.body.data.errors[0].message).toMatch(/already uploaded/);
  });

  it('prints the bank endorsement letter of a financed sale (one or a batch) and e-mails it to the bank', async () => {
    const pdf = await sales('get', `/motor-programmes/sales/${financedSaleId}/bank-letter`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/pdf/);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await sales('get', `/motor-programmes/sales/${cashSaleId}/bank-letter`)).status).toBe(400);
    const batch = await sales('get', `/motor-programmes/batches/${batchId}/bank-letters`).buffer(true).parse(binary);
    expect(batch.status).toBe(200);
    const mail = await sales('post', `/motor-programmes/sales/${financedSaleId}/bank-letter/email`).send({});
    expect(mail.status).toBe(200);
    expect(mail.body.data.to).toBe('autoloans.makati@bdo.example.ph');
    const outbox = (await pool.query('SELECT attachments FROM email_outbox WHERE id = $1', [mail.body.data.outboxId])).rows[0];
    expect(outbox.attachments[0]).toMatchObject({ kind: 'document', document: 'bank-endorsement-letter' });
    const { generateDocument } = await import('../src/modules/documents/emailDocuments.js');
    const doc = await generateDocument('bank-endorsement-letter', { saleId: financedSaleId });
    expect(doc.content.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('a subsidised programme bills the dealer its share and the buyer the rest', async () => {
    const p = await sales('post', '/motor-programmes').send({ code: 'MMG-SUB40', name: 'Forty percent dealer subsidy', dealerChannelId: 'ch_seed_mmg', insuranceCompanyId: 2, ownDamageRate: 1.5,
      includeCtpl: false, subsidyPayer: 'dealer', subsidyType: 'percent', subsidyValue: 40, issueMode: 'policy' });
    expect(p.status).toBe(201);
    const r = await sales('post', `/motor-programmes/${p.body.data.id}/sales/upload`)
      .attach('file', csv(`MMG-MKT,${sold},SI-2001,Joy,Santos,,joy@example.ph,,,,Toyota,Raize,,2026,Blue,private_cars,,JTDKB3FU0R3123999,1KR-9001,950000,,`), 's.csv');
    expect(r.body.data.created).toBe(1);
    const sale = (await pool.query("SELECT * FROM dealer_sales WHERE invoice_number = 'SI-2001'")).rows[0];
    expect(Number(sale.payer_share)).toBeCloseTo(Number(sale.gross_premium) * 0.4, 1);
    const bills = (await pool.query('SELECT r.amount, r.commission_amount, c.display_name FROM receivables r JOIN clients c ON c.id = r.client_id WHERE r.policy_id = $1 ORDER BY r.amount', [sale.policy_id])).rows;
    expect(bills.map((b) => b.display_name).sort()).toEqual(['Joy Santos', 'Makati Motors Group']);
    expect(bills.reduce((s, b) => s + Number(b.amount), 0)).toBeCloseTo(Number(sale.gross_premium), 2);
    const pol = (await pool.query('SELECT commission_amount FROM policies WHERE id = $1', [sale.policy_id])).rows[0];
    expect(bills.reduce((s, b) => s + Number(b.commission_amount), 0)).toBeCloseTo(Number(pol.commission_amount), 2);
    // each bill is booked: the ledger balances
    const jv = (await pool.query(`SELECT sum(jl.debit) AS d, sum(jl.credit) AS c FROM journal_lines jl JOIN journal_vouchers j ON j.id = jl.jv_id WHERE j.policy_id = $1`, [sale.policy_id])).rows[0];
    expect(Number(jv.d)).toBeCloseTo(Number(jv.c), 2);
  });

  it('a programme in quotation mode creates draft quotations to follow up, no policy', async () => {
    const q = (await pool.query("SELECT id FROM motor_programmes WHERE code = 'MMG-CASH-2026'")).rows[0];
    const r = await sales('post', `/motor-programmes/${q.id}/sales/upload`)
      .attach('file', csv(`MMG-ALB,${sold},SI-3001,Ben,Reyes,,ben@example.ph,,,,Toyota,Hilux,,2026,Gray,private_cars,,MR0HA3CD5R0123456,1GD-7001,1650000,,`), 'q.csv');
    expect(r.body.data).toMatchObject({ created: 1, issueMode: 'quotation' });
    const sale = (await pool.query("SELECT s.policy_id, q.status, q.channel_id FROM dealer_sales s JOIN quotes q ON q.id = s.quote_id WHERE s.invoice_number = 'SI-3001'")).rows[0];
    expect(sale).toEqual({ policy_id: null, status: 'draft', channel_id: 'ch_seed_mmg_alb' });
  });

  it('with motor_programmes.email_bank_letter on, the upload queues the bank letter of each financed policy', async () => {
    const { setSetting } = await import('../src/lib/settings.js');
    await setSetting('motor_programmes.email_bank_letter', true);
    try {
      const r = await sales('post', `/motor-programmes/${programmeId}/sales/upload`)
        .attach('file', csv(`MMG-MKT,${sold},SI-4001,Carla,Mendoza,,carla@example.ph,,,,Toyota,Corolla Cross,,2026,Black,private_cars,,JTDKB3FU0R3124001,2ZR-4001,1650000,BDO-AUTO-MKT,1200000`), 'e.csv');
      expect(r.body.data.created).toBe(1);
      const sale = (await pool.query("SELECT id, letter_sent_at FROM dealer_sales WHERE invoice_number = 'SI-4001'")).rows[0];
      expect(sale.letter_sent_at).not.toBeNull();
      const mail = (await pool.query("SELECT to_address FROM email_outbox WHERE entity = 'dealer_sale' AND entity_id = $1", [sale.id])).rows;
      expect(mail.map((m) => m.to_address)).toEqual(['autoloans.makati@bdo.example.ph']);
    } finally {
      await setSetting('motor_programmes.email_bank_letter', false);
    }
  });
});
