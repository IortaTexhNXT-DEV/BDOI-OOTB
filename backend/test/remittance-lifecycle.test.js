/**
 * Withdraw, cancel and revoke a remittance (GAP-REMIT-23, FR-RMT-014, migration 0646, remittance/lifecycle.js): each
 * with a reason of its context; a cancelled remittance frees its policies; a revoked approval returns the remittance to
 * its preparer and its policies no longer read remitted; a policy cancelled since the draft stops the submission.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let insurer;
const people = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(key, username, displayName, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  people[key] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
async function policy(no) {
  const [p] = await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, premium_total, commission_amount, sum_insured)
    VALUES ($1, (SELECT id FROM clients ORDER BY id LIMIT 1), (SELECT id FROM products WHERE code = 'MOTOR'), $2, 'issued', DATE '2026-09-01', DATE '2027-09-01', 10000, 1500, 850000) RETURNING id`,
  [no, insurer.id]);
  return p.id;
}
const draft = async (lines) => {
  const r = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'LCYINS', lines });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data;
};
const submit = (id) => people.maker('post', '/remittance/remittances/submit').send({ items: [{ id }] });
const pendingOf = async (remId) => (await q("SELECT id, version FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1 AND status = 'Pending'", [remId]))[0];
const statusOf = async (remId) => (await q('SELECT status FROM remittances WHERE id = $1', [remId]))[0].status;
const actionsOf = async (who, remId) => (await people[who]('get', '/remittance/remittances?segment=all&perPage=500&q=REM')).body.data.find((x) => x.id === remId).actions.map((a) => a.code);

beforeAll(async () => {
  ctx = await setup();
  [insurer] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ('LCYINS', 'Lifecycle Test Insurance Corp.', 'Lifecycle Test', 'active') RETURNING id");
  await persona('maker', 'lcy.maker', 'M. Reyes', ['tis-finance']);
  await persona('other', 'lcy.other', 'O. Lim', ['tis-finance']);
  await persona('checker', 'lcy.checker', 'J. Cruz', ['tis-finance']);
});
afterAll(async () => { await pool.end(); });

describe('withdraw a remittance from approval', () => {
  it('its submitter withdraws it to Draft with a reason; the approval closes Withdrawn and it can be submitted again', async () => {
    await policy('LCY-1');
    const rem = await draft([{ policyNo: 'LCY-1' }]);
    await submit(rem.id);
    expect(await actionsOf('maker', rem.id)).toContain('withdraw');
    expect(await actionsOf('other', rem.id)).not.toContain('withdraw');
    const noReason = await people.maker('post', `/remittance/remittances/${rem.id}/withdraw`).send({});
    expect(noReason.status).toBe(400);
    expect(noReason.body.errors[0].path).toBe('reasonCode');
    const stranger = await people.other('post', `/remittance/remittances/${rem.id}/withdraw`).send({ reasonCode: 'RWD-CORRECT' });
    expect(stranger.status).toBe(403);
    const w = await people.maker('post', `/remittance/remittances/${rem.id}/withdraw`).send({ reasonCode: 'RWD-WEEK' });
    expect(w.status, JSON.stringify(w.body)).toBe(200);
    expect(w.body.message).toBe(`${rem.remittanceNo} withdrawn to Draft`);
    expect(await statusOf(rem.id)).toBe('draft');
    expect(await pendingOf(rem.id)).toBeUndefined();
    expect((await q("SELECT status FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1", [rem.id]))[0].status).toBe('Withdrawn');
    expect((await people.maker('post', `/remittance/remittances/${rem.id}/withdraw`).send({ reasonCode: 'RWD-WEEK' })).status).toBe(409);
    expect((await submit(rem.id)).body.data.submitted).toBe(1);
    const audit = await q("SELECT action FROM audit_log WHERE entity = 'remittance' AND entity_id = $1 AND action = 'withdraw'", [rem.id]);
    expect(audit).toHaveLength(1);
  });
});

describe('cancel a remittance', () => {
  it('a draft is cancelled with a reason and its policy goes on a new remittance; a pending one is not cancelled', async () => {
    await policy('LCY-2');
    const rem = await draft([{ policyNo: 'LCY-2' }]);
    expect(await actionsOf('maker', rem.id)).toContain('cancel');
    const c = await people.maker('post', `/remittance/remittances/${rem.id}/cancel`).send({ reasonCode: 'RCN-DUPLICATE' });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body.message).toContain('1 policy is free for the next run');
    expect(await statusOf(rem.id)).toBe('cancelled');
    const again = await draft([{ policyNo: 'LCY-2' }]);
    expect(again.remittanceNo).not.toBe(rem.remittanceNo);
    await submit(again.id);
    const refused = await people.maker('post', `/remittance/remittances/${again.id}/cancel`).send({ reasonCode: 'RCN-DUPLICATE' });
    expect(refused.status).toBe(409);
    expect(refused.body.message).toContain('only a Draft or Returned remittance can be cancelled');
  });

  it('a remittance holding a policy cancelled since the draft is not submitted', async () => {
    const id = await policy('LCY-3');
    const rem = await draft([{ policyNo: 'LCY-3' }]);
    await q("UPDATE policies SET status = 'cancelled' WHERE id = $1", [id]);
    const v = await people.maker('post', '/remittance/remittances/validate').send({ ids: [rem.id] });
    expect(v.body.data.results[0].errors).toContain('LCY-3 is cancelled: cancel this remittance and remit the other policies again');
    expect((await submit(rem.id)).body.data.submitted).toBe(0);
  });
});

describe('revoke the approval of a remittance', () => {
  it('an approver revokes an approval not yet paid: the remittance is returned and its policies no longer read remitted', async () => {
    const pid = await policy('LCY-4');
    const rem = await draft([{ policyNo: 'LCY-4' }]);
    await submit(rem.id);
    const a = await pendingOf(rem.id);
    expect((await people.checker('post', `/remittance/approvals/${a.id}/approve`).send({ version: a.version })).status).toBe(200);
    expect((await q('SELECT details FROM policies WHERE id = $1', [pid]))[0].details.remittance.number).toBe(rem.remittanceNo);
    expect(await actionsOf('checker', rem.id)).toContain('revoke');
    // a revocation needs its reason
    expect((await people.checker('post', `/remittance/remittances/${rem.id}/revoke`).send({})).status).toBe(400);
    const r = await people.checker('post', `/remittance/remittances/${rem.id}/revoke`).send({ reasonCode: 'RRV-AMOUNT' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await statusOf(rem.id)).toBe('rejected');
    expect((await q('SELECT details FROM policies WHERE id = $1', [pid]))[0].details.remittance).toBeUndefined();
    expect((await q('SELECT DISTINCT status FROM remittance_lines WHERE remittance_id = $1', [rem.id])).map((x) => x.status)).toEqual(['Active']);
    // returned: corrected and submitted again by the preparer
    expect((await submit(rem.id)).body.data.submitted).toBe(1);
  });

  it('is refused once the remittance is on a settlement, and while switched off', async () => {
    await policy('LCY-5');
    const rem = await draft([{ policyNo: 'LCY-5' }]);
    await submit(rem.id);
    const a = await pendingOf(rem.id);
    await people.checker('post', `/remittance/approvals/${a.id}/approve`).send({ version: a.version });
    await q(`INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by, updated_by) VALUES ('settlement', 'SET-LCY-1', 8500, 'Pending Approval', $1, $2, $2)`,
      [JSON.stringify({ remittanceIds: [rem.id], lineIds: [] }), (await q("SELECT id FROM users WHERE username = 'lcy.maker'"))[0].id]);
    const r = await people.checker('post', `/remittance/remittances/${rem.id}/revoke`).send({ reasonCode: 'RRV-ERROR' });
    expect(r.status).toBe(409);
    expect(r.body.message).toContain('is on settlement SET-LCY-1');
    await q("UPDATE app_settings SET value = 'false' WHERE key = 'remittance.revoke_enabled'");
    const { clearSettingsCache } = await import('../src/lib/settings.js');
    clearSettingsCache();
    expect((await people.checker('post', `/remittance/remittances/${rem.id}/revoke`).send({ reasonCode: 'RRV-ERROR' })).status).toBe(409);
    await q("UPDATE app_settings SET value = 'true' WHERE key = 'remittance.revoke_enabled'");
    clearSettingsCache();
  });
});
