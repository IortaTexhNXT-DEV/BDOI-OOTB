import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withDirectSend } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { ageOn } from '../src/modules/quotations/creditLife.js';

let ctx;
let associate;
let officer;
let lead;
let now;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}
/** A birth date `years` years before today, plus `days` days. */
const bornYearsAgo = (years, days = 0) => addDays(`${Number(now.slice(0, 4)) - years}${now.slice(4)}`, days);
const cl = (creditLife, extra = {}) => ({ leadRefId: lead, productType: 'CL-VOL', participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }],
  creditLife: { loanAccountNo: `TFS-${Math.random().toString(36).slice(2, 10)}`, borrowerBirthDate: bornYearsAgo(40), accountCount: 2, pendingBalance: 0, loanTermYears: 3, ...creditLife }, ...extra });

beforeAll(async () => {
  ctx = await setup();
  await withDirectSend();
  now = await today();
  associate = (await persona('cl.associate', ['tis-sales-associate'])).api;
  officer = (await persona('cl.officer', ['tis-sales-officer'])).api;
  lead = (await associate('post', '/leads').send({ firstName: 'Ramon', lastName: 'Pascual', emailId: 'ramon.pascual@example.ph', contactNumber: '09171112233', leadCategory: 'Retail' })).body.leadId;
});
afterAll(async () => { await pool.end(); });

describe('Credit Life applicability (QUOT-01)', () => {
  it('new business (CL-COMP) takes no quotation', async () => {
    const r = await associate('post', '/quotations').send({ leadRefId: lead, productType: 'CL-COMP', netPremium: 2000 });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('is placed without a quotation');
  });

  it('a renewal quotation on CL-VOL is priced at 3.68 per 1,000 on PHP 1,000,000 by default', async () => {
    const r = await associate('post', '/quotations').send(cl({}));
    expect(r.status).toBe(201);
    expect(r.body.totalSumInsured).toBe(1000000);
    expect(r.body.netPremium).toBe(3680);
    expect(r.body.creditLife).toMatchObject({ borrowerAge: 40, ratePerThousand: 3.68, loanTermYears: 3 });
    expect(r.body.underwritingReferral).toBeUndefined();
  });
});

describe('Credit Life eligibility (QUOT-06, CR-03)', () => {
  it('age: 64 and 65 accepted (65 inclusive, BRD QUOT-06 / PJRN-01), 66 refused', async () => {
    for (const years of [64, 65]) expect((await associate('post', '/quotations').send(cl({ borrowerBirthDate: bornYearsAgo(years) }))).status, String(years)).toBe(201);
    for (const years of [66, 70]) {
      const r = await associate('post', '/quotations').send(cl({ borrowerBirthDate: bornYearsAgo(years) }));
      expect(r.status).toBe(400);
      expect(r.body.errors[0].message).toContain('Credit Life covers borrowers aged up to 65');
    }
    expect(ageOn('1961-10-11', '2026-10-10')).toBe(64);
    expect(ageOn('1961-10-10', '2026-10-10')).toBe(65);
  });

  it('accounts: 6 accepted, 7 refused; a pending balance is refused', async () => {
    expect((await associate('post', '/quotations').send(cl({ accountCount: 6 }))).status).toBe(201);
    expect((await associate('post', '/quotations').send(cl({ accountCount: 7 }))).body.errors[0].message).toContain('more than 6');
    expect((await associate('post', '/quotations').send(cl({ pendingBalance: 1520.5 }))).body.errors[0].message).toContain('pending balance');
  });

  it('one quotation per loan account, individual borrowers only, no agent', async () => {
    await associate('post', '/quotations').send(cl({ loanAccountNo: 'TFS-0098812' }));
    const again = await associate('post', '/quotations').send(cl({ loanAccountNo: 'TFS-0098812' }));
    expect(again.body.errors[0].message).toContain('one quotation per account');
    const corp = (await associate('post', '/leads').send({ companyName: 'Kalayaan Foods Distribution Corp.', emailId: 'admin@kalayaan.example.ph', contactNumber: '0288881234', leadCategory: 'Corporate' })).body.leadId;
    expect((await associate('post', '/quotations').send({ ...cl({}), leadRefId: corp })).body.errors[0].message).toContain('individual borrowers only');
    expect((await associate('post', '/quotations').send(cl({}, { accountCode: 'AG-0012' }))).body.errors[0].message).toContain('no agent');
  });

  it('the rate is fixed and the term follows the loan tenor (1 to 5 years)', async () => {
    expect((await associate('post', '/quotations').send(cl({ ratePerThousand: 3.5 }))).body.errors[0].message).toContain('fixed at 3.68');
    expect((await associate('post', '/quotations').send(cl({ loanTermYears: 5 }))).status).toBe(201);
    for (const t of [0, 6]) expect((await associate('post', '/quotations').send(cl({ loanTermYears: t }))).body.errors[0].message).toContain('1 to 5 years');
  });
});

describe('a reduced sum insured is approved before issuance (PJRN-03, CR-04)', () => {
  let id;
  it('prices the reduced sum insured and refers it', async () => {
    const r = await associate('post', '/quotations').send(cl({ sumInsured: 500000 }));
    expect(r.status).toBe(201);
    id = r.body.quotationId;
    expect(r.body.netPremium).toBe(1840);
    expect(r.body.underwritingReferral).toMatchObject({ status: 'pending', ruleCodes: ['CL_SI_REDUCTION'] });
    expect(r.body.underwritingReferral.authorityRoles).toContain('tis-sales-officer');
    const send = await associate('post', `/quotations/${id}/send-for-approval`).send({});
    expect(send.status).toBe(400);
    expect(send.body.message).toContain('Sum insured reduced');
  });

  it('a user of the approver roles other than the raiser approves it', async () => {
    const own = await associate('post', `/quotations/${id}/underwriting-referral`).send({ decision: 'approve' });
    expect(own.status).toBe(403);
    const ok = await officer('post', `/quotations/${id}/underwriting-referral`).send({ decision: 'approve', remarks: 'Outstanding balance PHP 500,000 confirmed by TFS' });
    expect(ok.status).toBe(200);
    expect((await associate('post', `/quotations/${id}/send-for-approval`).send({})).status).toBe(200);
    expect((await q("SELECT doc->'underwritingReferral'->>'status' AS s FROM quotes WHERE id = $1", [id]))[0].s).toBe('approved');
  });
});
