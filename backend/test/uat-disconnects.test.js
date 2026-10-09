/**
 * Disconnects found by the UAT data scenario (scripts/uat-scenario.js), which runs six months of broking business
 * through the API with document dates in the past:
 * - journals of a document keyed in late are dated with the document (issue date, endorsement date, cheque date,
 *   settlement date), and the registers and dashboards read the same business dates;
 * - a quotation keeps its product (and its line of business), a discount never reduces the CTPL tariff;
 * - a bank account posts to the GL cash account it is reconciled on;
 * - a renewal completed in the renewal workspace is a complete policy term with its bill and commission;
 * - a renewal quotation of a non-motor line carries a premium, and a quotation without premium is not sent;
 * - premium is collected on the receipt's date (remittance ageing, settlement voucher period);
 * - a cheque drawn on a whole insurer voucher pays the voucher's payables;
 * - migrated in-force policies are not "policies without accounting" at month end.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { issuePolicy, importPolicy } from '../src/modules/policies/service.js';
import { createReceivable, findPolicy } from '../src/modules/receipts/receivables.js';
import { AUTO_CHECKS } from '../src/modules/period-end/checks.js';

let ctx;
let now;
let processing;
let claims2;
const q = (sql, params) => query(sql, params).then((r) => r.rows);
const one = async (sql, params) => (await q(sql, params))[0];
const PDF = Buffer.from('%PDF-1.4 test');

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = (await request(ctx.app).post('/api/auth/login').send({ username, password: 'Welcome@123' })).body.accessToken;
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const idOf = async (table, code) => (await one(`SELECT id FROM ${table} WHERE code = $1`, [code])).id;

beforeAll(async () => {
  ctx = await setupFinance();
  now = await today();
  processing = await persona('uat.proc2', ['processing']);
  claims2 = await persona('uat.claims2', ['claims']);
});
afterAll(async () => { await pool.end(); });

/** Issue a broker- or direct-billed policy through the issuance routine with an issue date in the past. */
async function issueBackdated({ issuedDate, inception = issuedDate, billingMode = 'broker', insurer = 'MALAYAN', owner = null }) {
  const client = await one(`INSERT INTO clients(client_code, display_name, first_name, last_name, created_by) VALUES ($1, 'Late Keyed Client', 'Late', 'Keyed', 'test') RETURNING *`,
    [`CL-UAT-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`]);
  const r = await withTransaction((db) => issuePolicy(db, {
    clientId: client.id, insuranceCompanyId: null, sumInsured: 1000000, netPremium: 10000, grossPremium: 12525, commissionAmount: 1500, commissionRate: 0.15, currency: 'PHP',
    insuredName: client.display_name, productType: 'Motor', lob: 'MOTOR', ownerUserId: owner, agentUserId: owner,
  }, { billingMode, issuedDate, inception, insuranceCompanyName: insurer }, ctx.userIds.maker));
  return { ...r, client, policy: await one('SELECT * FROM policies WHERE id = $1', [r.policyId]) };
}

describe('journals of a document keyed in late are dated with the document', () => {
  it('books a policy on its issue date; its credit days run from the issue (or later inception)', async () => {
    const issued = addDays(now, -20);
    const r = await issueBackdated({ issuedDate: issued });
    const jv = await one('SELECT j.jv_date FROM receivables rv JOIN journal_vouchers j ON j.id = rv.booking_jv_id WHERE rv.policy_id = $1', [r.policyId]);
    expect(jv.jv_date).toBe(issued);
    const terms = await one("SELECT COALESCE(premium_warranty_days, (SELECT (value #>> '{}')::int FROM app_settings WHERE key = 'collections.default_credit_days')) AS d FROM insurance_companies WHERE code = 'MALAYAN'");
    expect((await one('SELECT due_date FROM receivables WHERE policy_id = $1', [r.policyId])).due_date).toBe(addDays(issued, Number(terms.d)));
    // a future issue date is booked today
    const later = await issueBackdated({ issuedDate: addDays(now, 5) });
    expect((await one('SELECT j.jv_date FROM receivables rv JOIN journal_vouchers j ON j.id = rv.booking_jv_id WHERE rv.policy_id = $1', [later.policyId])).jv_date).toBe(now);
  });

  it('books the commission of a direct-bill policy on its issue date', async () => {
    const issued = addDays(now, -15);
    const r = await issueBackdated({ issuedDate: issued, billingMode: 'direct' });
    const item = await one('SELECT i.booked_on, j.jv_date FROM direct_bill_items i JOIN journal_vouchers j ON j.id = i.booking_jv_id WHERE i.policy_id = $1', [r.policyId]);
    expect(item).toEqual({ booked_on: issued, jv_date: issued });
  });

  it('books an endorsement premium on the endorsement issue date', async () => {
    const r = await issueBackdated({ issuedDate: addDays(now, -40) });
    const e = await ctx.api('post', '/endorsements/create-endorsement').send({ policyId: r.policyId, endorsementTypeIds: [3], premiumDelta: 2505, remarks: 'Accessories added' });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    const date = addDays(now, -10);
    const c = await ctx.api('post', '/endorsements/complete-endorsement').send({ endorsementId: e.body.endorsementId, endorsementNumber: 'INS-E-1', issuedDate: date });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    const jv = await one('SELECT j.jv_date FROM receivables rv JOIN journal_vouchers j ON j.id = rv.booking_jv_id WHERE rv.id = $1', [c.body.receivableId]);
    expect(jv.jv_date).toBe(date);
  });
});

describe('a quotation keeps its product', () => {
  it('a Householder quotation prepared from a broker slip stays a package product through its placement to the booked policy', async () => {
    const sales = ctx.as('sales');
    const lead = await sales('post', '/leads').send({ firstName: 'Rosario', lastName: 'Lacson', emailId: 'rosario.l@example.ph', contactNumber: '09170001111', leadCategory: 'Retail' });
    const home = await idOf('products', 'HOME');
    const slip = await sales('post', '/broker-slips').send({ leadRefId: lead.body.leadId, productId: home, productType: 'Householder Insurance', sumInsured: 3000000,
      requestedCovers: [{ cover: 'Dwelling', sumInsured: 3000000 }], insurers: ['MALAYAN'] });
    expect(slip.status, JSON.stringify(slip.body)).toBe(201);
    await sales('post', `/broker-slips/${slip.body.id}/submit`).send({});
    const offer = slip.body.offers[0];
    await sales('put', `/broker-slips/${slip.body.id}/offers/${offer.id}`).send({ status: 'offered', premium: 6000, offeredShare: 100 });
    const prepared = await sales('post', `/broker-slips/${slip.body.id}/prepare-quotation`).send({ offerIds: [offer.id] });
    expect(prepared.status, JSON.stringify(prepared.body)).toBe(201);
    const quote = await one('SELECT product_id, lob FROM quotes WHERE id = $1', [prepared.body.quotationId]);
    expect(quote.product_id).toBe(home);
    const detail = await sales('get', `/quotations/${prepared.body.quotationId}`);
    expect(detail.body.journey).toMatchObject({ businessType: 'package', placementSlip: 'required' });
    await sales('put', `/quotations/${prepared.body.quotationId}/status`).send({ status: 'PendingCustomer' });
    const accepted = await sales('put', `/quotations/${prepared.body.quotationId}/status`).send({ status: 'CustomerAccepted' });
    const placement = (await sales('get', `/placements/${accepted.body.placementId}`)).body;
    expect(placement.productId).toBe(home);
    await sales('post', `/placements/${placement.id}/send`).send({});
    const file = await sales('post', '/s3/upload').field('folder', 'placement-epolicies').attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), 'home-e-policy.pdf');
    await sales('post', `/placements/${placement.id}/epolicy`).send({ documentKey: file.body.data.key, insurerPolicyNumber: 'MAL-HH-0001', participantName: 'Rosario Lacson',
      sumInsured: placement.sumInsured, netPremium: placement.netPremium, issueDate: placement.inceptionDate, effectiveDate: placement.inceptionDate, expiryDate: placement.expiryDate });
    expect((await ctx.api('post', `/placements/${placement.id}/check`).send({ decision: 'confirm' })).status).toBe(200);
    const booked = await ctx.api('post', `/placements/${placement.id}/book`).send({});
    expect(booked.status, JSON.stringify(booked.body)).toBe(201);
    expect((await one('SELECT product_id FROM policies WHERE id = $1', [booked.body.policyId])).product_id).toBe(home);
  });

  it('a CTPL quotation is linked to the CTPL product; a quotation given only a product is priced on its line', async () => {
    const sales = ctx.as('sales');
    const lead = await sales('post', '/leads').send({ firstName: 'Nestor', lastName: 'Ilagan', emailId: 'nestor.i@example.ph', contactNumber: '09170002222', leadCategory: 'Retail' });
    const ctpl = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'CTPL', vehicleType: 'private_cars', includeCTPL: true });
    expect(ctpl.status, JSON.stringify(ctpl.body)).toBe(201);
    expect((await one('SELECT product_id FROM quotes WHERE id = $1', [ctpl.body.quotationId])).product_id).toBe(await idOf('products', 'CTPL'));
    const pa = await sales('post', '/quotations').send({ leadRefId: lead.body.leadId, productId: await idOf('products', 'PA'), productType: 'Personal Accident', netPremium: 3000 });
    expect(pa.status, JSON.stringify(pa.body)).toBe(201);
    expect(await one('SELECT lob, premium_base FROM quotes WHERE id = $1', [pa.body.quotationId])).toEqual({ lob: 'ACCIDENT', premium_base: 3000 });
  });

  it('a discount never reduces the CTPL tariff premium', async () => {
    const tariff = (await ctx.api('get', '/quotations/motor-tariff')).body.data.vehicleTypes.find((v) => v.value === 'private_cars').ctplPremium;
    const r = await ctx.api('post', '/quotations/calculate-premium').send({ productType: 'CTPL', vehicleType: 'private_cars', includeCTPL: true, discount: 500 });
    expect(r.body.data).toMatchObject({ grossPremium: tariff, discount: 0 });
    const motor = await ctx.api('post', '/quotations/calculate-premium').send({ productType: 'Motor', vehicleType: 'private_cars', includeCTPL: true, lossAndDamageCoverage: 800000,
      lossAndDamageCoverageRate: 1.5, discount: 500 });
    expect(motor.body.data.discount).toBe(500);
  });
});

describe('a bank account posts to the GL cash account it is reconciled on', () => {
  it('a receipt deposited to a bank account linked for reconciliation debits that GL account', async () => {
    const m = await ctx.api('post', '/masters/bank-account').send({ accountCode: 'UAT-TRUST-1', accountName: 'Premium trust account', bankCode: 'MBT', accountNumber: '152-7-000111-2',
      accountType: 'Trust Account', currency: 'PHP' });
    expect(m.status, JSON.stringify(m.body)).toBe(201);
    const gl = (await one(`SELECT code FROM gl_accounts WHERE account_type = 'asset' AND status = 'active' AND code LIKE '1102%' AND code <> '1102001'
      AND code NOT IN (SELECT gl_account_code FROM bank_account_links WHERE gl_account_code IS NOT NULL) ORDER BY code`)).code;
    const link = await ctx.as('maker')('put', '/bank-reconciliation/bank-accounts/UAT-TRUST-1').send({ glAccountCode: gl });
    expect(link.status, JSON.stringify(link.body)).toBe(200);
    const p = await makePolicy({ net: 4000 });
    await withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, p.policy.id), amount: p.gross, user: { id: ctx.userIds.maker } }));
    const rc = await ctx.as('maker')('post', '/receipts').send({ policyId: p.policy.id, amount: p.gross, paymentMode: 'bank-transfer', referenceNo: 'MBT-1', bankAccountCode: 'UAT-TRUST-1' });
    expect(rc.status, JSON.stringify(rc.body)).toBe(201);
    const debit = await q(`SELECT l.account_code FROM receipt_applications a JOIN journal_lines l ON l.jv_id = a.journal_id WHERE a.receipt_id = $1 AND l.debit > 0`, [rc.body.data.receiptId]);
    expect(debit.map((d) => d.account_code)).toEqual([gl]);
  });
});

describe('renewals', () => {
  it('a renewal completed in the renewal workspace is a full policy term with its bill and the producer\'s commission', async () => {
    const r = await issueBackdated({ issuedDate: addDays(now, -340), inception: addDays(now, -330), owner: ctx.userIds.sales });
    await q('UPDATE policies SET expiry_date = $2, insured_name = \'Late Keyed Client\', product_type = \'Motor\' WHERE id = $1', [r.policyId, addDays(now, 35)]);
    const rn = await ctx.api('post', `/renewals/policies/${r.policyId}`);
    expect(rn.status, JSON.stringify(rn.body)).toBe(201);
    await ctx.api('post', `/renewals/${rn.body.data.id}/quote`);
    await ctx.api('post', `/renewals/${rn.body.data.id}/submit`).send({});
    expect((await processing('post', `/renewals/${rn.body.data.id}/approve`).send({ decision: 'approve' })).status).toBe(200);
    const done = await ctx.api('post', `/renewals/${rn.body.data.id}/complete`).send({});
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    const np = await one('SELECT * FROM policies WHERE id = $1', [done.body.data.newPolicy.id]);
    expect(np).toMatchObject({ issued_date: now, lob: 'MOTOR', product_type: 'Motor', insured_name: 'Late Keyed Client', renewed_from: r.policyId });
    expect(Number(np.net_premium)).toBeGreaterThan(0);
    expect(Number(np.net_premium)).toBeLessThan(Number(np.premium_total));
    const bill = await one('SELECT rv.amount, j.jv_date FROM receivables rv JOIN journal_vouchers j ON j.id = rv.booking_jv_id WHERE rv.policy_id = $1', [np.id]);
    expect(Number(bill.amount)).toBe(Number(np.premium_total));
    const line = await one('SELECT agent_user_id, basis_amount FROM commissions WHERE policy_id = $1', [np.id]);
    expect(line).toMatchObject({ agent_user_id: ctx.userIds.sales });
    expect(Number(line.basis_amount)).toBe(Number(np.net_premium));
  });

  it('a renewal quotation of a fire policy is priced on the expiring net premium; a quotation without premium is not sent', async () => {
    const client = await one(`INSERT INTO clients(client_code, display_name, email, created_by) VALUES ('CL-UAT-FIRE', 'Fire Renewal Client', 'fire.renewal@example.ph', 'test') RETURNING id`);
    const pol = await one(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, net_premium, premium_total,
        commission_amount, lob, product_type) VALUES ('OLD-FI-UAT-1', $1, $2, (SELECT id FROM insurance_companies WHERE code = 'PIONEER'), $3, 'active', $4, $5, 5000000, 11000, 14000, 1650, 'FIRE', 'Fire')
      RETURNING id`, [client.id, await idOf('products', 'FIRE'), ctx.userIds.sales, addDays(now, -330), addDays(now, 35)]);
    const r = await ctx.api('post', `/policy-renewals/policies/${pol.id}/quotation`).send({});
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const quote = await one("SELECT premium_base, premium_total FROM quotes WHERE doc->'renewal'->>'policyId' = $1", [pol.id]);
    expect(Number(quote.premium_base)).toBe(11000);
    expect(Number(quote.premium_total)).toBeGreaterThan(11000);
    const lead = await ctx.as('sales')('post', '/leads').send({ firstName: 'Zero', lastName: 'Premium', emailId: 'zero.premium@example.ph', contactNumber: '09170003333', leadCategory: 'Retail' });
    const zero = await ctx.as('sales')('post', '/quotations').send({ leadRefId: lead.body.leadId, productId: await idOf('products', 'PA'), productType: 'Personal Accident' });
    const sent = await ctx.as('sales')('post', `/quotations/${zero.body.quotationId}/send-for-approval`).send({});
    expect(sent.status).toBe(400);
    expect(sent.body.message).toMatch(/no premium/);
  });
});

describe('premium is collected on the receipt date', () => {
  let p;
  let firstNet;
  it('the remittance ageing dates a collection with its receipt, not with the day it was keyed in', async () => {
    p = await makePolicy({ net: 8000, insurer: 'STANDARD', inceptionOffset: -60 });
    await withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, p.policy.id), amount: p.gross, user: { id: ctx.userIds.maker } }));
    const first = addDays(now, -45);
    const half = Math.round(p.gross * 50) / 100;
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: p.policy.id, amount: half, receiptDate: first, paymentMode: 'bank-transfer', referenceNo: 'BDO-A' })).status).toBe(201);
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: p.policy.id, amount: Math.round((p.gross - half) * 100) / 100, receiptDate: addDays(now, -5), paymentMode: 'bank-transfer', referenceNo: 'BDO-B' })).status).toBe(201);
    const ageing = await ctx.as('maker')('get', '/credit-control/remittance-ageing?insurerId=STANDARD');
    const rows = ageing.body.data.rows.filter((x) => x.policyNumber === p.policy.policy_number);
    expect(rows.map((x) => x.collectedOn).sort()).toEqual([first, addDays(now, -5)]);
    const old = rows.find((x) => x.collectedOn === first);
    expect(old.daysOverdue).toBeGreaterThan(0);
    firstNet = old.amountDue;
  });

  it('a settlement voucher pays only what was collected up to the end of the settlement period; its cheque pays the voucher\'s payables', async () => {
    const rem = await ctx.as('maker')('post', '/remittance/remittances').send({ insurerCode: 'STANDARD', remittanceDate: addDays(now, -30), lines: [{ policyId: p.policy.id }] });
    expect(rem.status, JSON.stringify(rem.body)).toBe(201);
    await ctx.as('maker')('post', '/remittance/remittances/process').send({ ids: [rem.body.data.id] });
    const approve = async (entityId) => {
      const a = (await ctx.as('checker')('get', '/remittance/approvals?status=Pending&perPage=200')).body.data.find((x) => x.entityId === entityId);
      expect((await ctx.as('checker')('post', `/remittance/approvals/${a.id}/approve`).send({ comments: 'ok' })).status).toBe(200);
    };
    await approve(rem.body.data.id);
    const line = (await ctx.as('maker')('get', '/remittance/settlements/available-policies?insurerCode=STANDARD')).body.data.find((l) => l.remittanceId === rem.body.data.id);
    const s = await ctx.as('maker')('post', '/remittance/settlements').send({ insurerCode: 'STANDARD', settlementPeriod: [addDays(now, -60), addDays(now, -30)], lineIds: [line.id] });
    expect(s.status, JSON.stringify(s.body)).toBe(201);
    await ctx.as('maker')('post', `/remittance/settlements/${s.body.data.id}/submit`).send({ paymentMethod: 'check', bankAccount: 'ACC-BDO-001' });
    await approve(s.body.data.id);
    const item = await one('SELECT data FROM remittance_items WHERE id = $1', [s.body.data.id]);
    const pv = await ctx.as('maker')('get', `/disbursements/${item.data.disbursementId}`);
    expect(pv.body.data.amount).toBeCloseTo(firstNet, 2);
    // one cheque on the whole voucher, dated in the past: journal on the cheque date, payables paid
    const chequeDate = addDays(now, -25);
    const cb = await ctx.as('maker')('post', '/disbursements/checkbook').send({ disbursementId: item.data.disbursementId, mainAccount: '1102001', instrumentNo: '0099001', instrumentDate: chequeDate,
      totaleAmount: String(pv.body.data.amount) });
    const ap = await ctx.as('checker')('put', `/disbursements/checkbook/${cb.body.data.checkbookId}`).send({ status: 'Approved' });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect((await one('SELECT jv_date FROM journal_vouchers WHERE id = $1', [ap.body.data.journalId])).jv_date).toBe(chequeDate);
    const lists = await q('SELECT status FROM invoice_lists WHERE disbursement_id = $1', [item.data.disbursementId]);
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.every((l) => l.status === 'paid')).toBe(true);
    const aged = await ctx.api('post', '/reports/aged-payables-insurers/run').send({ ReportCriteria: 'Overall', ToDate: now, perPage: 500 });
    expect(aged.body.data.rows.some((x) => x.policyNumber === p.policy.policy_number)).toBe(false);
  });
});

describe('registers and dashboards read the business dates', () => {
  it('the production register and the executive trend show a policy in the month it was issued', async () => {
    const issued = `${addDays(`${now.slice(0, 7)}-01`, -10).slice(0, 7)}-15`;
    const r = await issueBackdated({ issuedDate: issued });
    const reg = await ctx.api('post', '/reports/production-register/run').send({ ReportCriteria: 'Overall', FromDate: addDays(issued, -1), ToDate: now, perPage: 500 });
    expect(reg.body.data.rows.find((x) => x.policyNumber === r.policy.policy_number).issueDate).toBe(issued);
    const ex = await ctx.api('get', '/dashboard/executive');
    const trend = ex.body.data.monthlyTrend;
    const i = trend.months.indexOf(issued.slice(0, 7));
    expect(i).toBeGreaterThanOrEqual(0);
    const inMonth = await one(`SELECT COALESCE(sum(premium_total), 0) AS s FROM policies WHERE to_char(COALESCE(issued_date, created_at::date), 'YYYY-MM') = $1`, [issued.slice(0, 7)]);
    expect(trend.premium[i]).toBeCloseTo(Number(inMonth.s), 2);
  });
});

describe('claims settled with a past settlement date', () => {
  it('the claim is settled on its settlement date and the broker settlement journal is dated with it', async () => {
    const p = await makePolicy({ net: 20000, insurer: 'PIONEER', inceptionOffset: -90 });
    await withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, p.policy.id), amount: p.gross, user: { id: ctx.userIds.maker } }));
    await ctx.as('maker')('post', '/receipts').send({ policyId: p.policy.id, amount: p.gross, receiptDate: addDays(now, -80) });
    const loss = addDays(now, -60);
    let reg = ctx.as('claims')('post', '/claims');
    const fields = { policyNumber: p.policy.policy_number, policyRefId: p.policy.id, lob: 'MOTOR', claimStatus: 'Pending', claimType: 'Motor', dateOfIncident: loss, reportedDate: addDays(loss, 1),
      typeOfIncident: 'Collision', estimatedClaimAmount: 50000 };
    for (const [k, v] of Object.entries(fields)) reg = reg.field(k, String(v));
    const c = await reg.attach('claimDocument', PDF, 'notice.pdf');
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const id = c.body.data.id;
    await ctx.as('claims')('put', `/claims/updatestatus/${id}`).send({ claimStatus: 'Processing' });
    const settleOn = addDays(now, -20);
    const st = await ctx.as('claims')('put', `/claims/settle/${id}`).field('settlementType', 'Paid through broker').field('settlementAmount', '40000')
      .field('settlementDate', settleOn).field('settlementIssueDate', settleOn);
    expect(st.status, JSON.stringify(st.body)).toBe(200);
    const ap = await claims2('put', `/claims/approve-settlement/${id}`).send({ decision: 'approve', approvedAmount: 40000 });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    const row = await one('SELECT settled_at::date AS d, (SELECT jv_date FROM journal_vouchers j WHERE j.id = c.settlement_jv_id) AS jv FROM claims c WHERE id = $1', [id]);
    expect(row).toEqual({ d: settleOn, jv: settleOn });
  });
});

describe('month-end checklist and the go-live migration', () => {
  it('in-force policies migrated at go-live are not reported as policies without accounting', async () => {
    const [admin] = await q("SELECT id FROM users WHERE username = 'BrokerVerse'");
    const check = () => AUTO_CHECKS.policies_without_accounting(pool, { period: now.slice(0, 7) });
    const before = (await check()).count;
    const r = await withTransaction((db) => importPolicy(db, { insuredName: 'Migrated Insured', productType: 'Motor', insuranceCompanyName: 'MAPFRE', grossPremium: 25050, netPremium: 20000,
      sumInsured: 900000, inception: addDays(now, -200), policyNumber: 'OLD-MC-UAT-1' }, admin.id, { migration: true }));
    expect((await one('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [r.policyId])).n).toBe(0);
    expect((await one("SELECT doc->>'source' AS s FROM policies WHERE id = $1", [r.policyId])).s).toBe('go-live-migration');
    expect((await check()).count).toBe(before);
  });
});
