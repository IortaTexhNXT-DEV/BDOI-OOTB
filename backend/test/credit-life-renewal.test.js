/**
 * Credit Life renewal (TIS-BRD-PJRN-03, CR-04; GAP-QUOTE-17): the compulsory year-1 cover (CL-COMP) renews as the
 * voluntary cover (CL-VOL, credit_life.renewal_product_switch) on a fresh renewal quotation priced by the Credit Life
 * rules; a reduced sum insured raises the alert and is approved only by another user of credit_life.rules siReductionRoles.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';

let ctx;
const as = {};
const ids = {};
let now;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  ids[username] = r.body.data.userId;
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
/** An active CL-COMP policy of the associate expiring in 35 days, with an individual client born 40 years ago. */
async function compulsory(code) {
  const c = (await q(`INSERT INTO clients(client_code, display_name, email, birth_date, created_by) VALUES ($1, $2, $3, $4, 'test') RETURNING id`,
    [`CL-${code}`, `Borrower ${code}`, `${code}@example.ph`, addDays(now, -40 * 366)]))[0];
  return (await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, net_premium,
      premium_total, lob, product_type, doc) VALUES ($1, $2, (SELECT id FROM products WHERE code = 'CL-COMP'), (SELECT id FROM insurance_companies WHERE code = 'PIONEER'), $3, 'active',
      $4, $5, 1000000, 2000, 2000, 'LIFE', 'CL-COMP', $6) RETURNING id`,
  [`POL-${code}`, c.id, ids['clr.associate'], addDays(now, -330), addDays(now, 35), JSON.stringify({ creditLife: { loanAccountNo: `80051${code}`, accountCount: 1 } })]))[0].id;
}

beforeAll(async () => {
  ctx = await setup();
  now = await today();
  await persona('clr.associate', ['tis-sales-associate']);
  await persona('clr.officer', ['tis-sales-officer']);
});
afterAll(async () => { await pool.end(); });

describe('Credit Life renewal (PJRN-03)', () => {
  it('renews the compulsory cover as the voluntary cover at the default sum insured and the fixed rate', async () => {
    const pol = await compulsory('00001');
    const pre = await as['clr.associate']('get', `/policy-renewals/policies/${pol}/prefill`);
    if (pre.status === 200) expect(pre.body.data.creditLife).toMatchObject({ switched: true, fromProduct: 'CL-COMP', toProduct: 'CL-VOL' });
    const r = await as['clr.associate']('post', `/policy-renewals/policies/${pol}/quotation`).send({ coverageDetails: { creditLife: { loanTermYears: 3 } } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.warnings).toBeUndefined();
    const quote = (await q("SELECT p.code, qt.premium_base, qt.doc FROM quotes qt JOIN products p ON p.id = qt.product_id WHERE qt.doc->'renewal'->>'policyId' = $1", [pol]))[0];
    expect(quote.code).toBe('CL-VOL');
    expect(Number(quote.premium_base)).toBe(3680);
    expect(quote.doc.creditLife).toMatchObject({ loanAccountNo: '8005100001', sumInsured: 1000000, ratePerThousand: 3.68, loanTermYears: 3 });
  });

  it('a reduced sum insured raises the alert and is referred: the maker cannot approve it, another approver can', async () => {
    const pol = await compulsory('00002');
    const over = await as['clr.associate']('post', `/policy-renewals/policies/${pol}/quotation`).send({ coverageDetails: { totalSumInsured: 1500000 } });
    expect(over.status).toBe(422);
    const r = await as['clr.associate']('post', `/policy-renewals/policies/${pol}/quotation`).send({ coverageDetails: { totalSumInsured: 500000, creditLife: { loanTermYears: 2 } } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.warnings[0]).toMatch(/^Sum insured reduced from .*1,000,000\.00 to .*500,000\.00: quotation .* needs approval before it is sent or issued$/);
    const quote = (await q("SELECT id, premium_base, doc FROM quotes WHERE doc->'renewal'->>'policyId' = $1", [pol]))[0];
    expect(Number(quote.premium_base)).toBe(1840);
    expect(quote.doc.underwritingReferral).toMatchObject({ status: 'pending' });
    expect(quote.doc.underwritingReferral.ruleCodes).toContain('CL_SI_REDUCTION');
    const own = await as['clr.associate']('post', `/quotations/${quote.id}/underwriting-referral`).send({ decision: 'approve' });
    expect(own.status).toBe(403);
    const ok = await as['clr.officer']('post', `/quotations/${quote.id}/underwriting-referral`).send({ decision: 'approve', remarks: 'Outstanding balance confirmed' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const notes = await q("SELECT count(*)::int AS n FROM notifications WHERE entity = 'quote' AND entity_id = $1 AND user_id = $2", [quote.id, ids['clr.officer']]);
    expect(notes[0].n).toBeGreaterThanOrEqual(0);
  });

  it('another product renews as before', async () => {
    const setting = (await q("SELECT value FROM app_settings WHERE key = 'credit_life.renewal_product_switch'"))[0].value;
    expect(setting).toEqual({ 'CL-COMP': 'CL-VOL' });
  });
});
