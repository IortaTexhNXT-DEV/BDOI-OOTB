/**
 * Currency, exchange rates, premium taxes and commission taxes each come from one place:
 *   1. base currency      Currency master (is_base, exactly one, locked once journals exist); currency.default only
 *                         labels amounts; display currency choices are the active Currency master rows
 *   2. exchange rates     the dated Exchange Rate master, for journal vouchers and month-end revaluation alike
 *   3. premium taxes      the premium tax and charge engine (Premium Taxes & LGU Rates) for quotations, the renewal
 *                         queue quote, the renewal quotation and the product configurator illustration; the flat
 *                         tax.* settings only stand in for a tax kind with no rule
 *   4. commission taxes   tax codes (Master > Finance > Taxation) for broker-billed and direct-bill commission and the
 *                         withholding tax on referrer commission; settings and referrers only name the code
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, withStarterMasters } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache, setSetting } from '../src/lib/settings.js';
import { baseCurrency, currencyChoices, exchangeRateOn, rateToBase } from '../src/lib/currency.js';
import { monthEndRate } from '../src/modules/period-end/steps.js';
import { chargesFor, rulesInForce } from '../src/modules/premium-charges/service.js';
import { premiumBreakdown } from '../src/modules/quotations/premium.js';
import { rate as renewalRate } from '../src/modules/renewals/service.js';
import { commissionTax, ewtRate } from '../src/modules/remittance/directbill.js';
import { commissionTaxSetup } from '../src/modules/accounting/lib/commissionTax.js';
import { whtPctFor } from '../src/modules/commission/service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = (name) => fs.readFileSync(path.join(here, '..', 'src', 'db', 'migrations', name), 'utf8');
const settingValue = async (key) => (await one('SELECT value FROM app_settings WHERE key = $1', [key]))?.value;

let ctx;
beforeAll(async () => {
  ctx = await setup();
  await withStarterMasters();
});
afterAll(async () => { await pool.end(); });

const currencyId = async (code) => (await one('SELECT id FROM currencies WHERE code = $1', [code])).id;
const usdRate = (date, rate, to = null) => ({ EffectiveFrom: date, EffectiveTo: to, CurrencyCode: 'USD', ToCurrencyCode: 'PHP', ExchangeRate: rate });

describe('1. base currency: Currency master, not the display currency', () => {
  it('has exactly one base currency, reported next to the display currency; choices are the active Currency master rows', async () => {
    expect((await one('SELECT count(*)::int AS n FROM currencies WHERE is_base')).n).toBe(1);
    expect(await baseCurrency()).toBe('PHP');
    const s = (await ctx.api('get', '/system-settings')).body.data;
    expect(s).toMatchObject({ baseCurrency: 'PHP', displayCurrency: 'PHP' });
    expect(s.currencies.map((c) => c.code).sort()).toEqual(['EUR', 'JPY', 'PHP', 'SGD', 'USD']);
    expect(s.currencies.find((c) => c.code === 'PHP')).toMatchObject({ isBase: true, locale: 'en-PH', symbol: '₱' });
    // THB is in currency.allowed (locale fallback) but not in the Currency master: not a display choice
    expect((await ctx.api('put', '/system-settings').send({ displayCurrency: 'THB' })).status).toBe(400);
    await query("UPDATE currencies SET status = 'inactive' WHERE code = 'JPY'");
    expect((await currencyChoices()).map((c) => c.code)).not.toContain('JPY');
    await query("UPDATE currencies SET status = 'active' WHERE code = 'JPY'");
  });

  it('a journal voucher is kept in the base currency whatever the display currency is', async () => {
    expect((await ctx.api('put', '/system-settings').send({ displayCurrency: 'USD' })).status).toBe(200);
    clearSettingsCache();
    try {
      const jv = await ctx.api('post', '/journal-vouchers').send({ transactionCode: 'JV01', date: '2026-09-10', entries: [
        { mainAccount: '4401003', entryType: 'Debit', foreignAmount: 1000 }, { mainAccount: '2206001', entryType: 'Credit', foreignAmount: 1000 }] });
      expect(jv.status).toBe(201);
      const lines = (await query('SELECT currency_code, exchange_rate, debit + credit AS amount FROM journal_lines WHERE jv_id = $1', [jv.body.data.id])).rows;
      expect(lines.map((l) => [l.currency_code, l.exchange_rate, l.amount])).toEqual([['PHP', 1, 1000], ['PHP', 1, 1000]]);
      expect((await one('SELECT currency FROM journal_vouchers WHERE id = $1', [jv.body.data.id])).currency).toBe('PHP');
    } finally {
      await ctx.api('put', '/system-settings').send({ displayCurrency: 'PHP' });
      clearSettingsCache();
    }
  });

  it('the Currency form has no rate; the base currency is locked while journals exist, cannot be unflagged or deactivated', async () => {
    const def = (await ctx.api('get', '/masters/currency/definition')).body.data;
    expect(def.fields.map((f) => f.name)).not.toContain('exchangeRate');
    expect(def.fields.find((f) => f.name === 'isBase').label).toBe('Accounting base currency');
    const usd = await currencyId('USD');
    const php = await currencyId('PHP');
    // a rate sent by an old screen is ignored, not stored
    const before = (await one('SELECT exchange_rate FROM currencies WHERE id = $1', [usd])).exchange_rate;
    expect((await ctx.api('put', `/masters/currency/${usd}`).send({ exchangeRate: 99, CurrencyName: 'US Dollar' })).status).toBe(200);
    expect((await one('SELECT exchange_rate FROM currencies WHERE id = $1', [usd])).exchange_rate).toBe(before);
    const move = await ctx.api('put', `/masters/currency/${usd}`).send({ isBase: true });
    expect(move.status).toBe(409);
    expect(move.body.message).toMatch(/base currency \(PHP\) cannot be changed once journals exist/);
    expect((await ctx.api('put', `/masters/currency/${php}`).send({ isBase: false })).status).toBe(400);
    expect((await ctx.api('patch', `/masters/currency/${php}/status`).send({ status: 'Inactive' })).status).toBe(409);
    expect((await ctx.api('delete', `/masters/currency/${php}`)).status).toBe(409);
    expect(await baseCurrency()).toBe('PHP');
    // the database refuses a second base currency even outside the API
    await expect(query("UPDATE currencies SET is_base = true WHERE code = 'USD'")).rejects.toThrow(/currencies_one_base/);
  });
});

describe('2. exchange rates: the dated Exchange Rate master only', () => {
  it('journal vouchers convert at the rate in force on the voucher date, the same rate month-end revaluation reads', async () => {
    const add = await ctx.api('post', '/masters/exchange-rate').send(usdRate('2026-10-01', 57.25));
    expect(add.status).toBe(201);
    expect(await rateToBase(null, 'USD', '2026-09-20')).toBe(56.5);
    expect(await rateToBase(null, 'USD', '2026-10-02')).toBe(57.25);
    expect(await monthEndRate(pool, 'USD', 'PHP', '2026-09-30')).toBe(await rateToBase(null, 'USD', '2026-09-30'));
    expect(await exchangeRateOn(null, 'PHP', 'USD', '2026-10-02')).toBeCloseTo(1 / 57.25, 10);
    const post = async (date) => ctx.api('post', '/journal-vouchers').send({ transactionCode: 'JV05', date, entries: [
      { mainAccount: '4401006', entryType: 'Debit', currencyCode: 'USD', foreignAmount: 100 }, { mainAccount: '2206001', entryType: 'Credit', currencyCode: 'USD', foreignAmount: 100 }] });
    const sep = await post('2026-09-20');
    const oct = await post('2026-10-02');
    expect(sep.body.data.totalDebit).toBe(5650);
    expect(oct.body.data.totalDebit).toBe(5725);
    const line = await one('SELECT currency_code, foreign_amount, exchange_rate FROM journal_lines WHERE jv_id = $1 ORDER BY line_no LIMIT 1', [oct.body.data.id]);
    expect(line).toMatchObject({ currency_code: 'USD', foreign_amount: 100, exchange_rate: 57.25 });
    // the Currency master's own rate column is not read
    await query("UPDATE currencies SET exchange_rate = 0.5 WHERE code = 'USD'");
    expect((await post('2026-10-02')).body.data.totalDebit).toBe(5725);
  });

  it('a foreign-currency voucher dated where no rate is in force is refused with a clear message; a mismatching local amount too', async () => {
    const r = await ctx.api('post', '/journal-vouchers').send({ transactionCode: 'JV05', date: '2026-07-31', entries: [
      { mainAccount: '4401006', entryType: 'Debit', currencyCode: 'EUR', foreignAmount: 10 }, { mainAccount: '2206001', entryType: 'Credit', currencyCode: 'EUR', foreignAmount: 10 }] });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Entry 1: No exchange rate from EUR to PHP in force on 2026-07-31: add one in Master > Finance > Exchange Rate');
    const bad = await ctx.api('post', '/journal-vouchers').send({ transactionCode: 'JV05', date: '2026-09-20', entries: [
      { mainAccount: '4401006', entryType: 'Debit', currencyCode: 'USD', foreignAmount: 100, localAmount: 5000 }, { mainAccount: '2206001', entryType: 'Credit', currencyCode: 'USD', foreignAmount: 100 }] });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/does not match 100 USD at the 2026-09-20 rate 56.5 \(5650\)/);
  });

  it('migration 0235 turns a rate kept on the Currency master into a dated record from the earliest journal date', async () => {
    await query("INSERT INTO currencies(code, name, symbol, decimals, is_base, exchange_rate) VALUES ('HKD', 'Hong Kong Dollar', 'HK$', 2, false, 0.13)");
    await query(migration('0235_base_currency_and_dated_rates.sql'));
    const first = (await one('SELECT min(jv_date)::text AS d FROM journal_vouchers')).d;
    const rec = await one("SELECT data, created_by FROM master_records WHERE type_code = 'exchange-rate' AND data->>'CurrencyCode' = 'HKD'");
    expect(rec.data).toMatchObject({ CurrencyCode: 'HKD', ToCurrencyCode: 'PHP', ExchangeRate: 7.692308, EffectiveFrom: first, EffectiveTo: null });
    expect(await rateToBase(null, 'HKD', '2026-09-30')).toBe(7.692308);
    // run again: nothing more (USD already has dated records, so its old column value is not copied)
    await query(migration('0235_base_currency_and_dated_rates.sql'));
    expect((await one("SELECT count(*)::int AS n FROM master_records WHERE type_code = 'exchange-rate' AND data->>'CurrencyCode' IN ('HKD', 'USD') AND created_by = 'migration'")).n).toBe(1);
    expect((await one('SELECT count(*)::int AS n FROM currencies WHERE is_base')).n).toBe(1);
  });
});

describe('3. premium taxes: the charge engine for every pricer', () => {
  const fireProduct = async () => (await one("SELECT id FROM products WHERE code = 'FIRE'")).id;

  it('the default rules give the rates the flat settings charged; the switch and the per-line list are gone', async () => {
    const c = await chargesFor({ premium: 1001, lob: 'FIRE' });
    expect(c).toMatchObject({ vat: 120.12, dst: 125.5, lgt: 7.51, fst: 20.02, premiumTax: 0, other: 0 });
    const motor = await chargesFor({ premium: 1001, lob: 'MOTOR' });
    expect(motor).toMatchObject({ vat: 120.12, dst: 125.5, lgt: 7.51, fst: 0 });
    expect(await settingValue('tax.charge_engine.quotations')).toBeUndefined();
    expect(await settingValue('premium.taxes_by_lob')).toBeUndefined();
    expect((await one("SELECT label FROM app_settings WHERE key = 'tax.lgt_rate'")).label).toMatch(/^Fallback local government tax rate: used only when/);
  });

  it('renewal queue quote and quotation pricer give the same premium for the same input', async () => {
    const q = await ctx.api('post', '/renewals/rnw_crs_12/quote');
    expect(q.status).toBe(200);
    const quote = q.body.data;
    const net = quote.premiumCalculation.subtotal;
    const policy = await one("SELECT p.product_id FROM renewals r JOIN policies p ON p.id = r.policy_id WHERE r.id = 'rnw_crs_12'");
    const priced = await ctx.api('post', '/quotations/calculate-premium').send({ lob: 'FIRE', productId: policy.product_id, netPremium: net });
    expect(priced.status).toBe(200);
    expect(priced.body.data.netPremium).toBe(net);
    expect(priced.body.data.grossPremium).toBe(quote.quotedPremium);
    expect(quote.premiumCalculation.taxes).toEqual({ vat: priced.body.data.valueAddedTax, dst: priced.body.data.documentaryStampTax,
      lgt: priced.body.data.localGovernmentTax, fst: priced.body.data.fireServiceTax });
    // the same synthetic renewal through both pricers, for a fire and a motor line
    for (const [line, lob, productId] of [['fire', 'FIRE', await fireProduct()], ['motor', 'MOTOR', null]]) {
      const r = await renewalRate({ product_line: line, product_id: productId, sum_insured: 0, premium_old: 12345.67, premium_total: 12345.67, claims_count: 1, loyalty_years: 2 });
      const b = await premiumBreakdown(lob === 'MOTOR' ? { lob, netPremium: r.net, includeCTPL: false, ctplCoveragePremium: 0 } : { lob, productId, netPremium: r.net });
      expect(b.grossPremium, line).toBe(r.total);
    }
  });

  it('a rule change reaches quotations, the renewal quote and the configurator illustration alike', async () => {
    await query("UPDATE premium_charge_rules SET rate = 10 WHERE code = 'VAT'");
    try {
      const b = await premiumBreakdown({ lob: 'FIRE', productId: await fireProduct(), netPremium: 2000 });
      expect(b.valueAddedTax).toBe(200);
      const r = await renewalRate({ product_line: 'fire', product_id: await fireProduct(), sum_insured: 0, premium_old: 2000, claims_count: 0, loyalty_years: 0 });
      expect(r.taxes.vat).toBe(200);
      const t = await one("SELECT id, product_id, line_of_business FROM product_templates WHERE template_code = 'PROP-FIRE-2026' ORDER BY version DESC LIMIT 1");
      const ill = await ctx.api('post', `/product-configurator/products/${t.id}/calculate-premium`).send({ sumInsured: 1000000 });
      expect(ill.status).toBe(200);
      const expected = await chargesFor({ premium: ill.body.data.adjustedPremium, productId: t.product_id, lob: t.line_of_business });
      expect(ill.body.data.taxes.map((x) => [x.code, x.amount])).toEqual(expected.lines.map((l) => [l.code, l.amount]));
      expect(ill.body.data.taxes.find((x) => x.code === 'VAT').rate).toBe(10);
      expect(ill.body.data.totalTax).toBe(expected.totalCharges);
    } finally {
      await query("UPDATE premium_charge_rules SET rate = 12 WHERE code = 'VAT'");
    }
  });

  it('the flat tax.* settings stand in only for a tax kind that has no rule at all', async () => {
    // a rule switched off means the tax is not charged (no fallback)
    await query("UPDATE premium_charge_rules SET active = false WHERE kind = 'lgt'");
    expect((await chargesFor({ premium: 1000, lob: 'MOTOR' })).lgt).toBe(0);
    // no rule of the kind at all: the setting's rate
    const saved = (await query("DELETE FROM premium_charge_rules WHERE kind = 'lgt' RETURNING *")).rows;
    try {
      await setSetting('tax.lgt_rate', 0.005);
      clearSettingsCache();
      const rules = await rulesInForce();
      expect(rules.find((r) => r.kind === 'lgt')).toMatchObject({ code: 'LGT', rate: 0.5, fallback: true });
      expect((await chargesFor({ premium: 1000, lob: 'MOTOR' })).lgt).toBe(5);
    } finally {
      for (const r of saved) {
        await query(`INSERT INTO premium_charge_rules(code, name, kind, method, rate, unit_amount, unit_size, fraction_rule, lines, regimes, minimum_amount, sort_order, active, effective_from, remarks)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14)`, [r.code, r.name, r.kind, r.method, r.rate, r.unit_amount, r.unit_size, r.fraction_rule, r.lines, r.regimes,
          r.minimum_amount, r.sort_order, r.effective_from, r.remarks]);
      }
      await setSetting('tax.lgt_rate', 0.0075);
      clearSettingsCache();
    }
    expect((await chargesFor({ premium: 1000, lob: 'MOTOR' })).lgt).toBe(7.5);
  });
});

describe('4. commission taxes: tax codes for both billing modes and referrer withholding', () => {
  it('direct-bill VAT and insurer EWT come from the tax codes the settings name, as broker-billed commission does', async () => {
    expect(await settingValue('direct_bill.commission_vat_code')).toBe('VAT12-OUT');
    expect(await settingValue('direct_bill.insurer_ewt_code')).toBe('WC139');
    for (const k of ['direct_bill.commission_vat_rate', 'direct_bill.insurer_ewt_rate', 'commission.wht_rate_by_type', 'tax.withholding_rate']) expect(await settingValue(k), k).toBeUndefined();
    expect(await commissionTax(1000)).toMatchObject({ commission: 1000, vat: 120, amount: 1120, vatRate: 0.12 });
    expect(await ewtRate()).toBe(0.1);
    // one code, one rate: changing VAT12-OUT changes broker-billed and direct-bill commission VAT together
    await query("UPDATE tax_codes SET rate = 10 WHERE code = 'VAT12-OUT'");
    try {
      expect((await commissionTax(1000)).vat).toBe(100);
      expect((await commissionTaxSetup(pool)).vat.rate).toBe(0.1);
    } finally {
      await query("UPDATE tax_codes SET rate = 12 WHERE code = 'VAT12-OUT'");
    }
    await setSetting('direct_bill.insurer_ewt_code', 'WC140');
    clearSettingsCache();
    expect(await ewtRate()).toBe(0.15);
    await setSetting('direct_bill.insurer_ewt_code', 'WC139');
    clearSettingsCache();
  });

  it('referrer withholding: the payee\'s code, else the code of its type, rates from the tax codes master', async () => {
    expect(await whtPctFor({ referrer_type: 'Agent' })).toBe(5);
    expect(await whtPctFor({ referrer_type: 'External' })).toBe(10);
    expect(await whtPctFor({ referrer_type: 'Agent', wht_code: 'WI516' })).toBe(10);
    await query("UPDATE tax_codes SET rate = 8 WHERE code = 'WI515'");
    expect(await whtPctFor({ referrer_type: 'Sub-agent' })).toBe(8);
    await query("UPDATE tax_codes SET rate = 5 WHERE code = 'WI515'");
    const bad = await ctx.api('post', '/commission/referrer-accounts').send({ name: 'Rina Lopez', type: 'Sub-agent', whtCode: 'VAT12-OUT' });
    expect(bad.status).toBe(400);
    expect((await ctx.api('post', '/commission/referrer-accounts').send({ name: 'Rina Lopez', type: 'Sub-agent', whtRate: 0.1 })).status).toBe(400);
    const ok = await ctx.api('post', '/commission/referrer-accounts').send({ name: 'Rina Lopez', type: 'Sub-agent', whtCode: 'WI516' });
    expect(ok.status).toBe(201);
    const row = await one("SELECT wht_code, wht_rate FROM commission_referrers WHERE name = 'Rina Lopez'");
    expect(row).toMatchObject({ wht_code: 'WI516', wht_rate: null });
    const list = (await ctx.api('get', '/commission/referrer-accounts')).body.data.referrers.find((r) => r.name === 'Rina Lopez');
    expect(list).toMatchObject({ whtCode: 'WI516', whtPct: 10, whtType: 'Individual 10%' });
  });

  it('migration 0237 turns rate settings and referrer rates into the codes that charge the same rate', async () => {
    await query("DELETE FROM app_settings WHERE key IN ('direct_bill.insurer_ewt_code', 'commission.wht_code_by_type', 'commission.default_wht_code')");
    await query(`INSERT INTO app_settings(key, value, "group", label, type) VALUES
      ('direct_bill.insurer_ewt_rate', '0.15', 'direct_bill', 'old', 'number'),
      ('commission.wht_rate_by_type', '{"Agent": 0.075, "External": 0.10}', 'commission', 'old', 'json'),
      ('tax.withholding_rate', '0.05', 'tax', 'old', 'number')`);
    await query("UPDATE commission_referrers SET wht_rate = 0.02, wht_code = NULL WHERE name = 'Rina Lopez'");
    await query(migration('0237_commission_tax_codes.sql'));
    expect(await settingValue('direct_bill.insurer_ewt_code')).toBe('WC140');
    expect(await settingValue('commission.default_wht_code')).toBe('WI515');
    expect(await settingValue('commission.wht_code_by_type')).toEqual({ Agent: 'MIG-EWT-7.5', External: 'WC515' });
    expect(await one("SELECT tax_type, rate, applies_to, payee_kind, active FROM tax_codes WHERE code = 'MIG-EWT-7.5'"))
      .toMatchObject({ tax_type: 'EWT', rate: 7.5, applies_to: 'purchases', payee_kind: 'individual', active: true });
    expect((await one("SELECT wht_code FROM commission_referrers WHERE name = 'Rina Lopez'")).wht_code).toBe('WI160');
    for (const k of ['direct_bill.insurer_ewt_rate', 'commission.wht_rate_by_type', 'tax.withholding_rate']) expect(await settingValue(k), k).toBeUndefined();
    clearSettingsCache();
    expect(await whtPctFor({ referrer_type: 'Agent' })).toBe(7.5);
  });
});

describe('base currency without journals', () => {
  it('moves to another currency in one step when no journal exists', async () => {
    await query('TRUNCATE journal_vouchers CASCADE');
    const usd = await currencyId('USD');
    const r = await ctx.api('put', `/masters/currency/${usd}`).send({ isBase: true });
    expect(r.status).toBe(200);
    expect(r.body.data.isBase).toBe(true);
    expect((await query('SELECT code FROM currencies WHERE is_base')).rows.map((x) => x.code)).toEqual(['USD']);
    expect((await ctx.api('get', '/system-settings')).body.data.baseCurrency).toBe('USD');
    expect((await ctx.api('put', `/masters/currency/${await currencyId('PHP')}`).send({ isBase: true })).status).toBe(200);
    expect(await baseCurrency()).toBe('PHP');
  });
});
