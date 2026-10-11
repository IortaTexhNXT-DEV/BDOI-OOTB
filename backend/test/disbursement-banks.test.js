/**
 * Disbursing bank of a payment voucher (TIS-BRD-DISB-01, CR-09, migration 0647): the bank chosen on the voucher, else
 * the dedicated bank of the dealer it pays, else disbursements.default_bank_code; a bank outside
 * disbursements.allowed_bank_codes is refused (TISPH: Metrobank only).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
const bankId = async (code) => (await query('SELECT id FROM banks WHERE code = $1', [code])).rows[0].id;
const set = async (key, value) => { await query('UPDATE app_settings SET value = $2::jsonb WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const voucher = (body) => ctx.as('maker')('post', '/disbursements').send({ payeeType: 'Supplier', payeeName: 'Bank test supplier', amount: 1000, transactionCode: 'PRM', ...body });
const bankOf = async (r) => (await query('SELECT bank_id FROM disbursements WHERE id = $1 OR voucher_number = $1', [String(r.body.data.disbursementId || r.body.data.id)])).rows[0].bank_id;

beforeAll(async () => {
  ctx = await setupFinance();
});
afterAll(async () => { await pool.end(); });

describe('disbursing bank of a voucher', () => {
  it('takes the default bank, the dealer bank and a chosen bank; refuses a bank outside the allowed list', async () => {
    await set('disbursements.default_bank_code', 'MBT');
    await set('disbursements.allowed_bank_codes', []);
    const plain = await voucher({});
    expect(plain.status, JSON.stringify(plain.body)).toBe(201);
    expect(await bankOf(plain)).toBe(await bankId('MBT'));

    // a dealer channel paid through its own bank
    const ref = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Dealer Bank Test', type: 'Dealer', bankName: 'BDO', bankAccountNo: '001100220033' });
    await query(`INSERT INTO distribution_channels(code, name, channel_type, referrer_id, bank_id) VALUES ('DLR-BANK', 'Dealer Bank Test', 'dealer_branch', $1, $2)`,
      [ref.body.data.referrer.id, await bankId('BPI')]);
    const dealer = await ctx.as('maker')('post', '/disbursements').send({ payeeType: 'Agent/Referrer', referrerId: ref.body.data.referrer.id, amount: 500, transactionCode: 'COMSUB' });
    expect(dealer.status, JSON.stringify(dealer.body)).toBe(201);
    expect(await bankOf(dealer)).toBe(await bankId('BPI'));

    const chosen = await voucher({ bankId: 'BDO' });
    expect(await bankOf(chosen)).toBe(await bankId('BDO'));

    await set('disbursements.allowed_bank_codes', ['MBT']);
    const refused = await voucher({ bankId: 'BDO' });
    expect(refused.status).toBe(400);
    expect(refused.body.errors[0]).toMatchObject({ path: 'bankId', message: expect.stringContaining('paid from MBT only') });
    const id = plain.body.data.disbursementId || plain.body.data.id;
    expect((await ctx.as('maker')('put', `/disbursements/${id}`).send({ bankId: 'BPI' })).status).toBe(400);
    expect((await ctx.as('maker')('put', `/disbursements/${id}`).send({ bankId: 'MBT' })).status).toBe(200);
    await set('disbursements.allowed_bank_codes', []);
    await set('disbursements.default_bank_code', null);
  });
});
