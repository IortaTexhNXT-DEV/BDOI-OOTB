/**
 * Accounts > Remittance controls: a policy is on one remittance at a time (a returned one holds its policies until it
 * is cancelled), the system amounts of the policies only, an expired policy on an imported catch-up, the approval of a
 * remittance as it is now (a remittance changed after its submission is not approved; the limit covers its current
 * amount), no adjustment on a submitted or approved remittance, no remittance marked settled without its voucher
 * (TISPH), the payment vouchers kept for Disbursement users, a refused settlement submission that saves nothing, the
 * In payment segment and the weekly payment window.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { windowOf } from '../src/modules/remittance/runs.js';
import { voucherDifferences } from '../src/modules/remittance/payments.js';

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

/** An issued policy of the test insurer: premium 10,000, commission 1,500, so 8,500 is due to the insurer. */
async function policy(no, { status = 'issued' } = {}) {
  const [p] = await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, premium_total, commission_amount, sum_insured)
    VALUES ($1, (SELECT id FROM clients ORDER BY id LIMIT 1), (SELECT id FROM products WHERE code = 'MOTOR'), $2, $3, DATE '2026-09-01', DATE '2027-09-01', 10000, 1500, 850000) RETURNING id`,
  [no, insurer.id, status]);
  return p.id;
}
const draft = async (lines) => {
  const r = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'CTLINS', lines });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data;
};
const submit = (id) => people.maker('post', '/remittance/remittances/submit').send({ items: [{ id }] });
const pendingOf = async (remId) => (await q("SELECT id, version FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1 AND status = 'Pending'", [remId]))[0];

beforeAll(async () => {
  ctx = await setup();
  [insurer] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ('CTLINS', 'Control Test Insurance Corp.', 'Control Test', 'active') RETURNING id");
  await persona('maker', 'ctl.maker', 'M. Reyes', ['tis-finance']);
  await persona('checker', 'ctl.checker', 'J. Cruz', ['tis-finance']);
  await persona('recon', 'ctl.recon', 'C. Recon', ['tis-ccd-recon']);
  await persona('ops', 'ctl.ops', 'O. Santos', ['tis-ops-officer']);
});
afterAll(async () => { await pool.end(); });

describe('a policy is on one remittance at a time', () => {
  it('builds the lines from the policies at the system amounts: amounts sent are ignored, unknown and repeated policies refused', async () => {
    await policy('CTL-1');
    const rem = await draft([{ policyNo: 'CTL-1', premium: 999999, commission: 0, tax: 0 }]);
    expect(Number(rem.grossAmount)).toBe(10000);
    expect(Number(rem.netAmount)).toBe(8500);
    const unknown = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'CTLINS', lines: [{ policyNo: 'CTL-NONE', premium: 6000000 }] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.errors[0].message).toBe('Policy CTL-NONE was not found');
    await policy('CTL-2');
    const twice = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'CTLINS', lines: [{ policyNo: 'CTL-2' }, { policyNo: 'CTL-2' }] });
    expect(twice.body.errors[0].message).toBe('Policy CTL-2 is on the remittance twice');
    const again = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'CTLINS', lines: [{ policyNo: 'CTL-1' }] });
    expect(again.body.errors[0].message).toBe(`Policy CTL-1 is already on ${rem.remittanceNo}`);
  });

  it('a returned remittance keeps its policies: the import reads them as already on it, and a second remittance holding one is not submitted', async () => {
    await policy('CTL-3');
    const rem = await draft([{ policyNo: 'CTL-3' }]);
    expect((await submit(rem.id)).body.data.submitted).toBe(1);
    const a = await pendingOf(rem.id);
    const back = await people.checker('post', `/remittance/approvals/${a.id}/reject`).send({ version: a.version, reasonCode: 'RRJ-OTHER', note: 'Check the lines' });
    expect(back.status, JSON.stringify(back.body)).toBe(200);
    const file = Buffer.from(['Policy No,Insurer Code', 'CTL-3,CTLINS'].join('\r\n'));
    const v = await people.maker('post', '/remittance/imports/validate').field('purposeCode', 'ROC-GOLIVE').attach('file', file, 'list.csv');
    expect(v.status, JSON.stringify(v.body)).toBe(201);
    const rows = (await people.maker('get', `/remittance/imports/${v.body.data.id}/rows`)).body.data;
    expect(rows[0]).toMatchObject({ result: 'already-on-rem', message: `Already on ${rem.remittanceNo} (Returned)` });
    // a duplicate made before this rule: both hold the policy, neither is submitted while the other holds it
    const [other] = await q(`INSERT INTO remittances(remittance_number, insurance_company_id, kind, gross_premium, commission, tax, net_due, status, created_by, policy_count)
      VALUES ('REM-CTL-DUP', $1, 'direct-bill', 10000, 1500, 0, 8500, 'draft', (SELECT id FROM users WHERE username = 'ctl.maker'), 1) RETURNING id`, [insurer.id]);
    await q(`INSERT INTO remittance_lines(remittance_id, policy_id, premium, commission, net, policy_number) SELECT $1, id, 10000, 1500, 8500, policy_number FROM policies WHERE policy_number = 'CTL-3'`, [other.id]);
    const refused = (await submit(other.id)).body.data.results[0];
    expect(refused).toMatchObject({ ok: false, code: 'INVALID', message: `Not submitted: CTL-3 is also on ${rem.remittanceNo}` });
  });

  it('an expired policy is imported for a catch-up remittance', async () => {
    await policy('CTL-EXP', { status: 'expired' });
    const file = Buffer.from(['Policy No,Insurer Code', 'CTL-EXP,CTLINS'].join('\r\n'));
    const v = await people.maker('post', '/remittance/imports/validate').field('purposeCode', 'ROC-CATCHUP').attach('file', file, 'expired.csv');
    expect(v.status, JSON.stringify(v.body)).toBe(201);
    const rows = (await people.maker('get', `/remittance/imports/${v.body.data.id}/rows`)).body.data;
    expect(rows[0]).toMatchObject({ result: 'ready', systemDue: 8500 });
    const c = await people.maker('post', `/remittance/imports/${v.body.data.id}/commit`).send({ version: v.body.data.version });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body.data.drafts).toHaveLength(1);
  });
});

describe('the approval decides the remittance as it is now', () => {
  it('a remittance changed after its submission is not approved, and an adjustment waits for a draft or returned remittance', async () => {
    await policy('CTL-4');
    const rem = await draft([{ policyNo: 'CTL-4' }]);
    await submit(rem.id);
    const adj = await people.recon('post', '/remittance/adjustments').send({ adjustmentType: 'ADJ-009', adjustmentAmount: 5000, remittanceNo: rem.remittanceNo, reason: 'Rate', effectiveDate: '2026-10-01' });
    expect(adj.status).toBe(409);
    expect(adj.body.message).toBe(`${rem.remittanceNo} is Pending approval. Only a draft or returned remittance can be adjusted.`);
    // the amount moved by other means after the submission
    await q('UPDATE remittances SET net_due = net_due + 5000 WHERE id = $1', [rem.id]);
    const a = await pendingOf(rem.id);
    const row = (await people.checker('get', `/remittance/approvals/${a.id}`)).body.data;
    expect(row.decision).toMatchObject({ canDecide: false, blockedCode: 'CONTENT_CHANGED', amount: 13500 });
    expect(row.actions.find((x) => x.code === 'reject').allowed).toBe(true);
    const r = await people.checker('post', `/remittance/approvals/${a.id}/approve`).send({ version: a.version });
    expect(r.status).toBe(409);
    expect(r.body.errors[0].code).toBe('CONTENT_CHANGED');
    expect((await q('SELECT status FROM remittances WHERE id = $1', [rem.id]))[0].status).toBe('for-approval');
  });

  it('the limit covers the amount as it is now; a decided approval answers no checks', async () => {
    await policy('CTL-5');
    const rem = await draft([{ policyNo: 'CTL-5' }]);
    await submit(rem.id);
    const a = await pendingOf(rem.id);
    expect((await people.checker('post', `/remittance/approvals/${a.id}/approve`).send({ version: a.version })).status).toBe(200);
    const done = (await people.checker('get', `/remittance/approvals/${a.id}`)).body.data;
    expect(done.status).toBe('Approved');
    expect(done.checks).toEqual([]);
  });
});

describe('one payment path', () => {
  it('an approved remittance is not marked settled by hand (TISPH)', async () => {
    const [rem] = await q("SELECT id FROM remittances WHERE status = 'approved' AND kind = 'direct-bill' LIMIT 1");
    const r = await people.recon('post', `/remittance/remittances/${rem.id}/settle`).send({ referenceNo: 'FAKE' });
    expect(r.status).toBe(409);
    expect(r.body.errors[0].code).toBe('SETTLE_OFF');
    expect((await q('SELECT status FROM remittances WHERE id = $1', [rem.id]))[0].status).toBe('approved');
  });

  it('payment vouchers are read with the Disbursement permissions, not with read:remittance alone', async () => {
    expect((await people.ops('get', '/remittance/payments?segment=all')).status).toBe(403);
    expect((await people.recon('get', '/remittance/payments?segment=all')).status).toBe(200);
  });

  it('a settlement submission refused for its bank account saves nothing', async () => {
    const lines = (await people.maker('get', '/remittance/settlements/available-policies?insurerCode=CTLINS')).body.data;
    expect(lines.length).toBeGreaterThan(0);
    const before = (await q("SELECT count(*)::int AS n FROM remittance_items WHERE kind = 'settlement'"))[0].n;
    const r = await people.maker('post', '/remittance/settlements').send({ insurerCode: 'CTLINS', settlementPeriod: ['2026-10-01', '2026-10-31'], lineIds: [lines[0].id], submit: true,
      paymentMethod: 'bank_transfer' });
    expect(r.status).toBe(400);
    expect(r.body.errors).toEqual([expect.objectContaining({ path: 'bankAccount', message: 'Bank account is required' })]);
    expect((await q("SELECT count(*)::int AS n FROM remittance_items WHERE kind = 'settlement'"))[0].n).toBe(before);
  });

  it('In payment holds the approved remittances and those whose voucher is not paid, as the KPI Approved, not paid', async () => {
    const r = (await people.maker('get', '/remittance/remittances?segment=in-payment&perPage=200')).body;
    expect(r.segments['in-payment']).toBe(r.kpis.approvedNotPaid.count);
    expect(r.data.every((x) => x.status === 'approved' || (x.status === 'settled' && x.voucher))).toBe(true);
  });
});

describe('the voucher of a remittance', () => {
  it('a voucher that does not pay what its remittance owes is named, and not offered for a batch', async () => {
    await policy('CTL-PV');
    const rem = await draft([{ policyNo: 'CTL-PV' }]);
    const [d] = await q(`INSERT INTO disbursements(voucher_number, payee_type, payee_name, amount, status, payment_mode, insurance_company_id, voucher_date, source)
      VALUES ('PV-CTL-0001', 'Insurer', 'Control Test Insurance Corp.', 6000, 'for-approval', 'bank-transfer', $1, DATE '2026-10-09', 'insurer-remittance') RETURNING id`, [insurer.id]);
    await q(`INSERT INTO remittance_items(kind, reference_no, amount, status, insurance_company_id, data) VALUES ('settlement', 'SET-CTL-0001', 8500, 'Approved', $1, $2)`,
      [insurer.id, JSON.stringify({ remittanceIds: [rem.id], disbursementId: d.id, voucherNumber: 'PV-CTL-0001' })]);
    const diff = (await voucherDifferences([d.id])).get(d.id);
    expect(diff).toMatchObject({ voucherAmount: 6000, dueToInsurer: 8500, difference: -2500, text: 'Voucher PHP 6,000.00 is PHP 2,500.00 less than the PHP 8,500.00 due to the insurer.' });
    const row = (await people.recon('get', '/remittance/payments?segment=all&q=PV-CTL-0001')).body.data[0];
    expect(row).toMatchObject({ selectable: false, amountDifference: { amount: -2500 }, nextStep: { code: 'amount-difference', reason: diff.text } });
  });
});

describe('the previous remittance of the insurer', () => {
  it('is the latest one dated before, also among remittances created together', async () => {
    const [older] = await q(`INSERT INTO remittances(remittance_number, insurance_company_id, kind, gross_premium, commission, tax, net_due, status, created_by, policy_count, remittance_date, created_at)
      VALUES ('REM-CTL-OLD', $1, 'direct-bill', 1000, 0, 0, 1000, 'settled', 'system', 1, DATE '2025-12-09', now() + interval '1 hour') RETURNING id`, [insurer.id]);
    await policy('CTL-PREV');
    const rem = await draft([{ policyNo: 'CTL-PREV' }]);
    // loaded together: the same creation time as the older one, a later remittance date
    await q("UPDATE remittances SET created_at = (SELECT created_at FROM remittances WHERE id = $2), remittance_date = DATE '2025-12-16' WHERE id = $1", [rem.id, older.id]);
    await submit(rem.id);
    const a = await pendingOf(rem.id);
    const panel = (await people.checker('get', `/remittance/approvals/${a.id}`)).body.data;
    expect(panel.previous).toMatchObject({ id: older.id, remittanceNo: 'REM-CTL-OLD' });
  });
});

describe('the weekly payment window', () => {
  it('is the last Monday to Friday that ended before the run date', () => {
    const s = { paymentWindow: 'Previous Monday to Friday' };
    expect(windowOf(s, '2026-10-10')).toMatchObject({ from: '2026-10-05', to: '2026-10-09' });
    expect(windowOf(s, '2026-10-12')).toMatchObject({ from: '2026-10-05', to: '2026-10-09' });
    expect(windowOf(s, '2026-10-09')).toMatchObject({ from: '2026-09-28', to: '2026-10-02' });
  });
});
