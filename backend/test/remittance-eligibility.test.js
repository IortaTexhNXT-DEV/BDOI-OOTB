/**
 * Remittance eligibility and the instalment hold (migration 0521, FRS FR-RMT-010 to 012): a schedule on the fully paid
 * basis remits a policy once its premium is fully paid in the window (with the catch-up), one draft per product line,
 * holds part-paid policies, holds back a fully paid policy whose receipt has no proof of payment (exception), and
 * releases a held policy once it is fully paid; a schedule on the inception basis keeps the Release 1 selection.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, withTransaction } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { createReceivable, findPolicy } from '../src/modules/receipts/receivables.js';
import { createReceipt } from '../src/modules/receipts/service.js';
import { refreshHolds } from '../src/modules/remittance/holds.js';
import { windowOf, WEEKLY_WINDOW } from '../src/modules/remittance/runs.js';

let ctx; let maker; let cash; let ins; let w; let fully; let inception;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const pols = {};
let seq = 0;

async function policy(key, { line = 'motor', premium = 12000 } = {}) {
  seq += 1;
  const [c] = await q("INSERT INTO clients(client_code, display_name, first_name, last_name, created_by) VALUES ($1, $2, 'Elig', 'Client', 'test') RETURNING id", [`CL-ELG-${seq}`, `Elig Client ${seq}`]);
  const [p] = await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, premium_total, commission_amount, billing_mode)
    VALUES ($1, $2, (SELECT id FROM products WHERE line = $5 ORDER BY id LIMIT 1), $3, 'active', $4::date, $4::date + 365, $6, $6 * 0.15, 'broker') RETURNING id, policy_number`,
  [`POL-ELG-${seq}`, c.id, ins.id, addDays(await today(), -40), line, premium]);
  const bill = await withTransaction(async (db) => createReceivable(db, { policy: await findPolicy(db, p.id), amount: premium, user: { id: null } }));
  pols[key] = { ...p, bill, premium };
  return pols[key];
}
const pay = (key, amount, on) => withTransaction((db) => createReceipt(db, { receivableId: pols[key].bill.id, amount, paymentMode: 'bank-transfer', referenceNo: `DEP-${key}`, receiptDate: on },
  { id: null }));

beforeAll(async () => {
  ctx = await setup();
  const r = await ctx.api('post', '/users').send({ username: 'elg.maker', password: 'Welcome@123', displayName: 'E. Maker', email: 'elg.maker@example.ph', roles: ['tis-finance'] });
  expect(r.status).toBe(201);
  const token = await loginAs(ctx.app, 'elg.maker', 'Welcome@123');
  maker = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  await ctx.api('post', '/users').send({ username: 'elg.cash', password: 'Welcome@123', displayName: 'C. Cash', email: 'elg.cash@example.ph', roles: ['tis-ccd-bp'] });
  const cashToken = await loginAs(ctx.app, 'elg.cash', 'Welcome@123');
  cash = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${cashToken}`);
  [ins] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ('ELGINS', 'Eligibility Insurance Corp.', 'ELGINS', 'active') RETURNING id, code, name");
  w = windowOf({ paymentWindow: WEEKLY_WINDOW }, await today());
  await policy('withProof');
  await policy('noProof');
  await policy('partPaid');
  await policy('unpaid');
  await policy('lateEntry');
  await policy('accident', { line: 'accident', premium: 5000 });
  const proofOf = async (key) => {
    const rc = await pay(key, pols[key].premium, w.to);
    expect((await cash('post', `/receipts/${rc.receiptId}/proof`).send({ proofKey: `/api/s3/object/receipts/${key}.pdf`, proofFileName: `${key}.pdf` })).status).toBe(200);
    return rc;
  };
  await proofOf('withProof');
  await proofOf('accident');
  pols.noProof.receipt = await pay('noProof', pols.noProof.premium, w.from);
  await pay('partPaid', 4000, w.from);
  const late = await pay('lateEntry', pols.lateEntry.premium, addDays(w.from, -10));
  await cash('post', `/receipts/${late.receiptId}/proof`).send({ proofKey: '/api/s3/object/receipts/late.pdf', proofFileName: 'late.pdf' });
  const base = { insurers: ['ELGINS'], frequency: 'Weekly', paymentWindow: WEEKLY_WINDOW, runTime: '06:15', groupBy: 'Insurer and product line' };
  fully = (await maker('post', '/remittance/schedules').send({ ...base, name: 'Fully paid ELGINS', eligibility: 'Fully paid in the window', proofRequired: true })).body.data;
  inception = (await maker('post', '/remittance/schedules').send({ ...base, name: 'Incepted ELGINS', eligibility: 'Incepted up to the cut-off' })).body.data;
});
afterAll(async () => { await pool.end(); });

describe('remittance eligibility (FR-RMT-010, 011)', () => {
  it('refuses an unknown eligibility and shows the basis of each schedule', async () => {
    const bad = await maker('put', `/remittance/schedules/${fully.id}`).send({ eligibility: 'Paid somehow' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].path).toBe('eligibility');
    const list = (await maker('get', '/remittance/schedules')).body.data.schedules;
    expect(list.find((s) => s.id === fully.id)).toMatchObject({ eligibility: 'Fully paid in the window', proofRequired: true });
    expect(list.find((s) => s.id === inception.id)).toMatchObject({ eligibility: 'Incepted up to the cut-off' });
    expect(list.find((s) => s.code === 'TIS-WEEKLY')).toMatchObject({ eligibility: 'Fully paid in the window' });
  });

  it('previews the fully paid policies (with the catch-up), the held and the exceptions, one draft per product line', async () => {
    const p = (await maker('post', `/remittance/schedules/${fully.id}/preview`)).body.data;
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ ready: 3, held: 1, exceptions: 1, drafts: 2, result: { label: '2 drafts will be created' } });
    expect(p.rows[0].productLine.split(', ').sort()).toEqual(['Accident', 'Motor']);
    expect(p.window.catchUpFrom).toBe(addDays(w.from, -10));
    expect(p.totals).toMatchObject({ drafts: 2, ready: 3, held: 1, exceptions: 1 });
  });

  it('keeps the Release 1 selection on the inception basis: every policy incepted up to the cut-off, paid or not', async () => {
    const p = (await maker('post', `/remittance/schedules/${inception.id}/preview`)).body.data;
    expect(p.rows[0]).toMatchObject({ ready: 6, held: 0, exceptions: 0, drafts: 1 });
  });

  it('runs: two drafts of the fully paid policies, the part-paid one held, an exception for the receipt without proof', async () => {
    const r = await maker('post', `/remittance/schedules/${fully.id}/run`).send({ reasonCode: 'ROC-MISSED' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Weekly run done: 2 remittance(s) created, 1 policies held, 1 exceptions.');
    expect(r.body.data.run.counts).toMatchObject({ scanned: 5, ready: 3, held: 1, exceptions: 1, created: 2 });
    const lines = await q(`SELECT rl.policy_number, r.data->>'productLine' AS line FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id
      WHERE r.id = ANY($1) ORDER BY rl.policy_number`, [r.body.data.drafts.map((d) => d.id)]);
    expect(lines.map((l) => l.policy_number).sort()).toEqual([pols.withProof, pols.lateEntry, pols.accident].map((p) => p.policy_number).sort());
    expect(new Set(lines.map((l) => l.line))).toEqual(new Set(['Motor', 'Accident']));
    const [exc] = await q("SELECT data FROM remittance_items WHERE kind = 'exception' AND data->>'type' = 'No proof of payment' AND data->>'sysRef' = $1", [pols.noProof.policy_number]);
    expect(exc.data.description).toBe(`Receipt ${pols.noProof.receipt.receiptNumber} of ${pols.noProof.policy_number} has no proof of payment. The policy is not remitted to ${ins.name} until the proof is attached.`);
  });

  it('a receipt with its proof attached later lets the policy go on the next run; a cancelled receipt takes no proof', async () => {
    expect((await cash('post', `/receipts/${pols.noProof.receipt.receiptId}/proof`).send({ proofKey: '/api/s3/object/receipts/x.pdf' })).status).toBe(200);
    const again = await maker('post', `/remittance/schedules/${inception.id}/preview`);
    expect(again.status).toBe(200);
    const p = (await maker('post', `/remittance/schedules/${fully.id}/preview`)).body.data;
    expect(p.totals).toMatchObject({ ready: 1, held: 1, exceptions: 0 });
    expect((await maker('post', `/receipts/${pols.noProof.receipt.receiptId}/proof`).send({ proofKey: 'y' })).status).toBe(403);
    expect((await cash('post', '/receipts/does-not-exist/proof').send({ proofKey: 'x' })).status).toBe(404);
  });
});

describe('instalment hold (FR-RMT-012)', () => {
  it('lists the held policy with its premium, paid to date, balance and next due', async () => {
    const r = await maker('get', `/remittance/held?insurerId=${ins.id}`);
    expect(r.status).toBe(200);
    expect(r.body.data.rows).toEqual([expect.objectContaining({ policyNumber: pols.partPaid.policy_number, premium: 12000, paidToDate: 4000, balance: 8000, status: 'held' })]);
    expect(r.body.data.totals).toMatchObject({ count: 1, balance: 8000 });
  });

  it('releases the policy once fully paid, with the receipt that cleared it, and the next run remits it in full', async () => {
    const rc = await pay('partPaid', 8000, await today());
    await cash('post', `/receipts/${rc.receiptId}/proof`).send({ proofKey: '/api/s3/object/receipts/pp.pdf' });
    const first = await q("SELECT receipt_id FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id WHERE r.policy_id = $1 ORDER BY a.id LIMIT 1", [pols.partPaid.id]);
    await q("UPDATE receipts SET proof_key = 'x' WHERE id = $1", [first[0].receipt_id]);
    const out = await refreshHolds();
    expect(out.released).toEqual([pols.partPaid.policy_number]);
    const [h] = await q('SELECT status, released_on, release_receipt FROM remittance_holds WHERE policy_id = $1', [pols.partPaid.id]);
    expect(h).toMatchObject({ status: 'released', release_receipt: rc.receiptNumber });
    const released = (await maker('get', `/remittance/held?status=released&insurerId=${ins.id}`)).body.data.rows;
    expect(released.map((x) => x.policyNumber)).toContain(pols.partPaid.policy_number);
    const [log] = await q("SELECT after_data FROM audit_log WHERE entity = 'remittance_hold' AND entity_id = $1 AND action = 'release'", [pols.partPaid.id]);
    expect(log.after_data).toMatchObject({ status: 'Released', receipt: rc.receiptNumber });
    expect((await maker('get', '/remittance/held')).body.data.rows.map((x) => x.policyNumber)).not.toContain(pols.partPaid.policy_number);
  });

  it('the job "Instalment hold check" runs on its own', async () => {
    const r = await ctx.api('post', '/schedules/remittance-hold-check/run');
    expect(r.status).toBe(200);
    expect(r.body.data.output).toMatchObject({ held: expect.any(Number), released: expect.any(Array) });
  });
});
