/**
 * Payment references and the matched payment uploads (migration 0530): 10-digit payment reference with a check digit;
 * a bank's payment report matched by reference within PHP 1 (matched, overpaid -> On Account, underpaid -> insufficient,
 * not found -> floating); payments made directly to the insurer receipted on channel insurer-direct.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { findPolicy, createReceivable } from '../src/modules/receipts/receivables.js';
import { today } from '../src/lib/dates.js';

let ctx; let day;
beforeAll(async () => { ctx = await setupFinance(); day = await today(); });
afterAll(async () => { await pool.end(); });

async function billed(net = 4000) {
  const made = await makePolicy({ net });
  const pol = await findPolicy(pool, made.policy.id);
  const bill = await createReceivable(pool, { policy: pol, amount: made.gross, source: 'policy' });
  return { ...made, bill, reference: pol.payment_reference };
}
const luhnOk = (s) => [...s].reverse().reduce((sum, ch, i) => { let d = Number(ch); if (i % 2) { d *= 2; if (d > 9) d -= 9; } return sum + d; }, 0) % 10 === 0;
const upload = (path, csv) => ctx.as('maker')('post', path).attach('file', Buffer.from(csv), 'payments.csv');

describe('payment reference', () => {
  it('every policy has a 10-digit reference with a check digit; the receipts search finds it with the vehicle', async () => {
    const a = await billed();
    expect(a.reference).toMatch(/^\d{10}$/);
    expect(luhnOk(a.reference)).toBe(true);
    const open = await ctx.as('maker')('get', `/receipts/open-receivables?search=${a.reference}`);
    expect(open.body.data).toEqual([expect.objectContaining({ policyNumber: a.policy.policy_number, paymentReference: a.reference })]);
    expect(open.body.data[0]).toHaveProperty('vehicle');
  });
});

describe('bank payments', () => {
  it('matches each line by reference within the tolerance and sorts the rest', async () => {
    const [exact, near, over, under] = [await billed(), await billed(), await billed(), await billed()];
    const csv = ['Date,Reference,Amount,Bank Account,Payer',
      `${day},${exact.reference},${exact.gross},ACC-MBT-001,Exact Payer`,
      `${day},${near.policy.policy_number},${(near.gross - 0.5).toFixed(2)},ACC-MBT-001,Near Payer`,
      `${day},${over.reference},${(over.gross + 500).toFixed(2)},ACC-MBT-001,Over Payer`,
      `${day},${under.bill.bill_number},${(under.gross - 1000).toFixed(2)},ACC-MBT-001,Under Payer`,
      `${day},9999999999,750,ACC-MBT-001,Unknown Payer`,
      `${day},${exact.reference},abc,ACC-MBT-001,Bad Amount`].join('\n');
    const up = await upload('/receipts/bank-payments', csv);
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    expect(up.body.data.counts).toEqual({ matched: 2, overpaid: 1, underpaid: 1, unmatched: 1, failed: 1 });
    expect(up.body.data.message).toBe('Processed 6 rows: 2 matched, 1 overpaid, 1 underpaid, 1 not found, 1 failed');
    const status = async (b) => (await query('SELECT status FROM receivables WHERE id = $1', [b.bill.id])).rows[0].status;
    expect(await status(exact)).toBe('paid');
    expect(await status(over)).toBe('paid');
    expect(await status(under)).toBe('partial');
    expect((await query("SELECT kind, balance FROM unapplied_collections WHERE policy_id = $1 AND kind = 'excess'", [over.policy.id])).rows[0]).toMatchObject({ balance: 500 });
    const floating = (await query("SELECT kind, reference_no FROM unapplied_collections WHERE reference_no = '9999999999'")).rows[0];
    expect(floating).toMatchObject({ kind: 'floating' });
    const batch = (await ctx.as('maker')('get', `/receipts/batches/${up.body.data.batch.id}`)).body.data;
    expect(batch.lines.map((l) => l.outcome)).toEqual(['matched', 'matched', 'overpaid', 'underpaid', 'unmatched', 'failed']);
    expect(batch.lines[3]).toMatchObject({ difference: -1000, message: 'Insufficient payment' });
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });

    const insufficient = await ctx.as('maker')('post', '/reports/tisph-insufficient-payments/run').send({ FromDate: day, ToDate: day });
    expect(insufficient.body.data.rows.find((r) => r.policyNumber === under.policy.policy_number)).toMatchObject({ shortfall: 1000 });
    const overpaid = await ctx.as('maker')('post', '/reports/tisph-overpayments/run').send({ FromDate: day, ToDate: day });
    expect(overpaid.body.data.rows.find((r) => r.policyNumber === over.policy.policy_number)).toMatchObject({ excess: 500, heldBalance: 500 });
  });
});

describe('payments made directly to the insurer', () => {
  it('receipts them on channel insurer-direct against the premium payable; refuses more than the policy owes', async () => {
    const a = await billed();
    const csv = `Policy Number,Amount,Date Paid,Insurer Reference\n${a.reference},${a.gross},${day},MIC-OR-1\n${a.policy.policy_number},5,${day},MIC-OR-2\n`;
    const up = await upload('/receipts/insurer-direct', csv);
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    expect(up.body.data).toMatchObject({ created: 1, failed: 1 });
    expect(up.body.data.errors[0].message).toMatch(/owes 0\.00; the amount paid to the insurer is more/);
    const r = (await query('SELECT id, payment_channel, collected_by_insurer_id FROM receipts WHERE policy_id = $1', [a.policy.id])).rows[0];
    expect(r.payment_channel).toBe('insurer-direct');
    const jv = (await query("SELECT l.account_code, l.debit FROM receipt_applications a JOIN journal_lines l ON l.jv_id = a.journal_id WHERE a.receipt_id = $1 AND l.debit > 0", [r.id])).rows[0];
    expect(jv.account_code).toBe('210245');
    expect((await ctx.as('maker')('get', `/receipts/${r.id}`)).body.data.paymentChannel).toBe('insurer-direct');
    expect((await ctx.as('agent')('post', '/receipts/insurer-direct').attach('file', Buffer.from(csv), 'p.csv')).status).toBe(403);
  });
});
