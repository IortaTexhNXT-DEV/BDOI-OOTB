/**
 * Remittance per bill of an open cover (PJRN-09, migration 0651): each monthly bill of an open policy is remitted once,
 * on its own remittance; an ordinary policy is still remitted once.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let maker;
let insurer;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const api = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${maker}`);

async function policy(no, details = {}) {
  const [p] = await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, premium_total, commission_amount, details)
    VALUES ($1, (SELECT id FROM clients ORDER BY id LIMIT 1), (SELECT id FROM products WHERE code = 'MOTOR'), $2, 'issued', DATE '2026-09-01', DATE '2027-09-01', 10000, 1500, $3) RETURNING id`,
  [no, insurer.id, JSON.stringify(details)]);
  return p.id;
}
const bill = (policyId, amount, commission, due) => q(`INSERT INTO receivables(policy_id, amount, balance, due_date, commission_amount, net_premium)
  VALUES ($1, $2, $2, $4::date, $3, $2) RETURNING id`, [policyId, amount, commission, due]).then((r) => r[0].id);
const draft = (no) => api('post', '/remittance/remittances').send({ insurerCode: 'PBLINS', lines: [{ policyNo: no }] });

beforeAll(async () => {
  ctx = await setup();
  [insurer] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ('PBLINS', 'Per Bill Test Insurance Corp.', 'Per Bill', 'active') RETURNING id");
  expect((await ctx.api('post', '/users').send({ username: 'pbl.maker', password: 'Welcome@123', displayName: 'P. Maker', email: 'pbl.maker@example.ph', roles: ['tis-finance'] })).status).toBe(201);
  maker = await loginAs(ctx.app, 'pbl.maker', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });

describe('remittance per bill of an open cover', () => {
  it('remits each monthly bill once, on its own remittance', async () => {
    const id = await policy('PBL-OPEN-1', { openCover: true });
    const october = await bill(id, 2500, 500, '2026-10-31');
    const first = await draft('PBL-OPEN-1');
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(Number(first.body.data.grossAmount)).toBe(2500);
    expect((await q('SELECT receivable_ids FROM remittance_lines WHERE remittance_id = $1', [first.body.data.id]))[0].receivable_ids).toEqual([october]);
    // nothing new to remit until the next declaration is billed
    expect((await draft('PBL-OPEN-1')).status).toBe(400);
    const november = await bill(id, 3100, 620, '2026-11-30');
    const second = await draft('PBL-OPEN-1');
    expect(second.status, JSON.stringify(second.body)).toBe(201);
    expect(Number(second.body.data.grossAmount)).toBe(3100);
    expect(Number(second.body.data.netAmount)).toBe(2480);
    expect((await q('SELECT receivable_ids FROM remittance_lines WHERE remittance_id = $1', [second.body.data.id]))[0].receivable_ids).toEqual([november]);
    // both months go for approval: different bills of the policy are no duplicate
    const v = await api('post', '/remittance/remittances/validate').send({ ids: [first.body.data.id, second.body.data.id] });
    expect(v.body.data.validCount).toBe(2);
  });

  it('keeps an ordinary policy to one remittance', async () => {
    const id = await policy('PBL-PLAIN-1');
    await bill(id, 10000, 1500, '2026-10-31');
    const first = await draft('PBL-PLAIN-1');
    expect(Number(first.body.data.grossAmount)).toBe(10000);
    await bill(id, 500, 75, '2026-11-30');
    const again = await draft('PBL-PLAIN-1');
    expect(again.status).toBe(400);
    expect(again.body.errors[0].message).toBe(`Policy PBL-PLAIN-1 is already on ${first.body.data.remittanceNo}`);
  });
});
