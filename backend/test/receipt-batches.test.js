/**
 * Receipt voucher batches (migration 0528; TIS-BRD-COLL-08): each bulk upload is a batch; on a combined
 * premium-and-commission row the premium is receipted and the commission kept apart on the batch for Accounting, or the
 * row refused (receipts.batch_commission_handling).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { await pool.end(); });
const upload = (csv) => ctx.as('maker')('post', '/receipts/bulk-upload').attach('file', Buffer.from(csv), 'rv-batch.csv');

describe('receipt voucher batches', () => {
  it('receipts the premium and keeps the commission of a combined row apart on the batch', async () => {
    const a = await makePolicy({ net: 3000 });
    const b = await makePolicy({ net: 5000 });
    const csv = `Policy Number,Amount,Commission Amount,Payment Mode,Reference No\n${a.policy.policy_number},${a.gross},,bank-transfer,BDO-1\n`
      + `${b.policy.policy_number},${b.gross + 750},750,bank-transfer,BDO-2\nPOL-NOPE,100,,cash,X\n${b.policy.policy_number},500,500,cash,Y\n`;
    const up = await upload(csv);
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    const data = up.body.data;
    expect(data).toMatchObject({ created: 2, failed: 2 });
    expect(data.batch).toMatchObject({ batchNumber: expect.stringMatching(/^RVB-/), premiumTotal: a.gross + b.gross, commissionTotal: 750, commissionRows: 1 });
    expect(data.message).toMatch(/; commission of .*750\.00 on 1 row\(s\) kept apart in batch RVB-/);
    expect(data.errors.map((e) => e.row)).toEqual([4, 5]);
    expect(data.errors[1].message).toBe('Commission Amount must be less than the Amount of the row');
    const receipt = (await query('SELECT amount, batch_id FROM receipts WHERE policy_id = $1', [b.policy.id])).rows[0];
    expect(Number(receipt.amount)).toBe(b.gross);
    expect(receipt.batch_id).toBe(data.batch.id);
    expect(await ledgerIntegrity()).toEqual({ unbalanced: 0, diff: 0 });

    const list = await ctx.as('maker')('get', '/receipts/batches');
    expect(list.body.data[0]).toMatchObject({ batchNumber: data.batch.batchNumber, commissionRows: 1 });
    const one = await ctx.as('maker')('get', `/receipts/batches/${data.batch.id}`);
    expect(one.body.data.commissionLines).toEqual([expect.objectContaining({ row: 3, policyNumber: b.policy.policy_number, amount: 750, premium: b.gross })]);
    const file = await ctx.as('maker')('get', `/receipts/batches/${data.batch.id}?format=csv`);
    expect(file.status).toBe(200);
    expect(file.text).toContain(b.policy.policy_number);
    expect((await ctx.as('agent')('get', '/receipts/batches')).status).toBe(403);
  });

  it('refuses a combined row when the batch must carry premium only', async () => {
    await query("UPDATE app_settings SET value = '\"refuse\"' WHERE key = 'receipts.batch_commission_handling'");
    clearSettingsCache();
    const c = await makePolicy({ net: 2000 });
    const up = await upload(`Policy Number,Amount,Commission Amount\n${c.policy.policy_number},${c.gross + 100},100\n`);
    expect(up.body.data).toMatchObject({ created: 0, failed: 1 });
    expect(up.body.data.errors[0].message).toBe('The row carries a commission amount; upload the premium receipts only');
    await query("UPDATE app_settings SET value = '\"separate\"' WHERE key = 'receipts.batch_commission_handling'");
    clearSettingsCache();
  });
});
