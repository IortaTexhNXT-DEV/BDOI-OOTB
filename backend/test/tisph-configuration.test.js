/**
 * TISPH configuration (seeds 80_tisph_configuration.sql and 81_tisph_finance.sql): a new database carries the company,
 * fiscal year, departments, insurer panel, policy types, claim checklist and causes of loss, cancellation reasons and
 * payment modes of the Pre-BSM workbook, and the chart of accounts, account determination and tax codes of the Finance
 * & General Accounting workbook. Seeding again changes nothing and keeps administrator changes. On a database already
 * in use, the document logo of a brand pack in force moves to TISPH and a January fiscal calendar is rebuilt on April
 * while nothing has been closed in it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool, withTransaction } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { clearLetterheadCache, getLetterhead, resolveLogo } from '../src/lib/letterhead.js';
import { ensureCalendar, fiscalStartFor } from '../src/modules/period-end/fiscal.js';
import { enforceDeploymentPack } from '../src/modules/branding/bundled.js';

let ctx;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const setting = async (key) => (await q('SELECT value FROM app_settings WHERE key = $1', [key]))[0]?.value;

beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('TISPH configuration of a new database', () => {
  it('prints TISPH as the letterhead company and runs the fiscal year from April', async () => {
    const [company] = await q("SELECT name, data FROM master_records WHERE type_code = 'company' AND code = 'TISPH'");
    expect(company.name).toBe('Toyota Insurance Services Philippines Corporation');
    expect(company.data).toMatchObject({ TIN: '685-442-861-00000', City: 'Makati City', IsPrimary: true });
    expect(await q("SELECT code FROM master_records WHERE type_code = 'company' AND data->>'IsPrimary' = 'true'")).toEqual([{ code: 'TISPH' }]);
    clearLetterheadCache();
    expect(await getLetterhead({ fresh: true })).toMatchObject({ code: 'TISPH', tin: '685-442-861-00000' });
    expect(await setting('general.company_name')).toBe('Toyota Insurance Services Philippines Corporation');
    expect(await setting('accounting.fiscal_year_start_month')).toBe(4);
    clearSettingsCache();
    expect(await fiscalStartFor('2027-02-15')).toBe('2026-04-01');
    const [ho] = await q("SELECT address, attrs FROM branches WHERE code = 'HO'");
    expect(ho.address).toBe('27F GT TOWER INTERNATIONAL');
    expect(ho.attrs.AddressLine3).toBe('SALCEDO VILLAGE');
  });

  it('has the TISPH departments, insurer panel and the policy types of the Phase 1 sub-classes', async () => {
    const depts = await q("SELECT code, name FROM master_records WHERE type_code = 'department' AND code ~ '^[0-9]+$' ORDER BY code");
    expect(depts.map((d) => d.code)).toEqual(['10', '20', '30', '40', '50']);
    expect(depts[2].name).toBe('Finance and General Accounting');
    const panel = await q("SELECT code, name FROM insurance_companies WHERE code IN ('AXA', 'MALAYAN', 'STANDARD', 'STRONGHOLD', 'PIONEER', 'MAAGAP') AND status = 'active' ORDER BY code");
    expect(panel.map((r) => r.code)).toEqual(['AXA', 'MAAGAP', 'MALAYAN', 'PIONEER', 'STANDARD', 'STRONGHOLD']);
    expect(panel[0].name).toBe('AXA Philippines Life and General Insurance Corporation');
    const types = await q(`SELECT p.code AS product, t.code, t.name FROM policy_types t JOIN products p ON p.id = t.product_id
      WHERE p.code IN ('GPA', 'CL-VOL', 'PARCEL') AND t.status = 'active' ORDER BY p.code`);
    expect(types).toEqual([
      { product: 'CL-VOL', code: 'DT-SP', name: 'Single Premium' },
      { product: 'GPA', code: 'GRP-STD', name: 'Standard' },
      { product: 'PARCEL', code: 'PCL-OPN', name: 'Open Policy' },
    ]);
  });

  it('offers the TISPH claim checklist and causes of loss, cancellation reasons and payment modes', async () => {
    const docs = await q("SELECT code, data FROM master_records WHERE type_code = 'claim-document-requirement' AND status = 'active'");
    const tisph = docs.filter((d) => d.code.startsWith('M14-'));
    expect(tisph).toHaveLength(52);
    expect(tisph.filter((d) => d.data.lineOfBusiness === 'LIFE').map((d) => d.data.documentName)).toContain('Claim Statement Form - Beneficiary');
    expect(tisph.filter((d) => d.data.documentName === 'Proof of Ownership')).toHaveLength(1);
    // the reference rows of Motor and of every line are replaced; Fire keeps its own
    expect(docs.filter((d) => !d.code.startsWith('M14-')).every((d) => d.data.lineOfBusiness === 'FIRE')).toBe(true);
    const causes = await setting('claims.loss_causes');
    expect(causes.MOTOR).toHaveLength(7);
    expect(causes.MOTOR[0]).toBe('Own Damage - Collision / Accident');
    expect(causes.LIFE).toEqual(['Death - Natural Causes / Illness']);
    expect(causes.FIRE).toContain('Fire');
    const r = await ctx.api('get', '/claims/config');
    expect(r.status).toBe(200);
    expect(r.body.data.lossCauses.ACCIDENT).toContain('Travel Inconvenience');
    const reasons = await q("SELECT code, data->>'initiatedBy' AS by FROM master_records WHERE type_code = 'cancellation-reason' AND code LIKE 'CAN-%' ORDER BY code");
    expect(reasons).toHaveLength(7);
    expect(reasons.find((x) => x.code === 'CAN-INS').by).toBe('insurer');
    const modes = await q("SELECT code, data->>'channel' AS channel FROM master_records WHERE type_code = 'payment-mode' AND code IN ('EFT', 'CHCK', 'E-WALLET', 'ADA') ORDER BY code");
    expect(modes).toEqual([{ code: 'ADA', channel: 'bank-transfer' }, { code: 'CHCK', channel: 'check' }, { code: 'E-WALLET', channel: 'online' }, { code: 'EFT', channel: 'bank-transfer' }]);
  });

  it('loads the 319 accounts of the TISPH chart and points the clear account roles to them', async () => {
    // 319 FGA.01 accounts and the placeholder 210245 for the FGA.09 Accounts Payable - Insurance Company
    expect((await q("SELECT count(*)::int AS n FROM gl_accounts WHERE code ~ '^[0-9]{6}$' AND code <> '210245'"))[0].n).toBe(319);
    const accounts = await q("SELECT code, name, account_type, fs_group, normal_balance, is_open_item FROM gl_accounts WHERE code IN ('106010', '110032', '170070', '800000') ORDER BY code");
    expect(accounts).toEqual([
      { code: '106010', name: 'MBT Bank Balance Php_561', account_type: 'asset', fs_group: 'Current Assets', normal_balance: 'debit', is_open_item: false },
      { code: '110032', name: 'Accounts Receivable-Clients', account_type: 'asset', fs_group: 'Current Assets', normal_balance: 'debit', is_open_item: true },
      { code: '170070', name: 'Accum Depr-FFE', account_type: 'asset', fs_group: 'Non-current Assets', normal_balance: 'credit', is_open_item: true },
      { code: '800000', name: 'Provision for Income Tax', account_type: 'expense', fs_group: 'Income Tax', normal_balance: 'debit', is_open_item: false },
    ]);
    expect(await q("SELECT 1 FROM master_records WHERE type_code = 'main-account' AND code = '410050'")).toHaveLength(1);
    expect(await setting('accounting.account.cash_in_bank')).toBe('106010');
    expect(await setting('accounting.account.output_vat')).toBe('235000');
    expect(await setting('accounting.account.retained_earnings')).toBe('340000');
    expect(await setting('accounting.account.due_to_insurer')).toBe('210245');
    // roles waiting for Finance keep the starter accounts
    expect(await setting('accounting.account.premium_receivable')).toBe('1202001');
    expect(await setting('accounting.cash_account_by_payment_mode')).toMatchObject({ cash: '100000', check: '106010', gcash: '1102002' });
  });

  it('adds the TISPH VAT and withholding codes once per ATC and keeps the WC140 rate', async () => {
    const vat = await q("SELECT code, rate::float AS rate, gl_account FROM tax_codes WHERE code IN ('O1', 'I1') ORDER BY code");
    expect(vat).toEqual([{ code: 'I1', rate: 12, gl_account: '135000' }, { code: 'O1', rate: 12, gl_account: '235000' }]);
    expect((await q("SELECT gl_account FROM tax_codes WHERE code = 'VAT12-OUT'"))[0].gl_account).toBe('235000');
    const [wc140] = await q("SELECT rate::float AS rate, remarks FROM tax_codes WHERE atc = 'WC140'");
    expect(wc140.rate).toBe(15);
    expect(wc140.remarks).toMatch(/^TISPH tax code 05/);
    expect(await q("SELECT code FROM tax_codes WHERE atc IN ('WI150', 'WC160') ORDER BY code")).toEqual([{ code: 'WC160' }, { code: 'WI150' }]);
    expect((await q("SELECT count(*)::int AS n FROM tax_codes WHERE remarks LIKE 'TISPH tax code %'"))[0].n).toBe(28);
  });

  it('changes nothing when seeded again and keeps what an administrator changed', async () => {
    await q("UPDATE insurance_companies SET name = 'AXA Philippines', updated_by = 'admin' WHERE code = 'AXA'");
    await q("UPDATE app_settings SET value = '\"1102001\"', updated_by = 'admin' WHERE key = 'accounting.account.cash_in_bank'");
    const count = async () => (await q(`SELECT (SELECT count(*) FROM gl_accounts) + (SELECT count(*) FROM master_records) + (SELECT count(*) FROM tax_codes)
      + (SELECT count(*) FROM policy_types) AS n`))[0].n;
    const before = await count();
    await seed({ log: () => {} });
    expect(await count()).toBe(before);
    expect((await q("SELECT name FROM insurance_companies WHERE code = 'AXA'"))[0].name).toBe('AXA Philippines');
    expect(await setting('accounting.account.cash_in_bank')).toBe('1102001');
  });
});

describe('TISPH configuration of a database already in use', () => {
  const company = async (code) => (await q("SELECT id, data FROM master_records WHERE type_code = 'company' AND code = $1", [code]))[0];
  const startMonths = async () => (await q('SELECT DISTINCT extract(month FROM start_date)::int AS m FROM fiscal_years')).map((r) => r.m);
  const januaryCalendar = async () => {
    await q("UPDATE app_settings SET value = '1', updated_by = NULL WHERE key = 'accounting.fiscal_year_start_month'");
    await q('UPDATE accounting_periods SET fiscal_year = NULL');
    await q('DELETE FROM accounting_periods WHERE is_adjustment');
    await q('DELETE FROM fiscal_years');
    clearSettingsCache();
    await withTransaction((db) => ensureCalendar(db));
    expect(await startMonths()).toEqual([1]);
  };

  it('moves the document logo of the brand pack enabled on the earlier letterhead company to TISPH', async () => {
    // as before the TISPH seeds: the out-of-the-box company is the letterhead and BRAND_PACK puts its logo on it
    await q("UPDATE master_records SET data = data || jsonb_build_object('IsPrimary', code = 'ITX') WHERE type_code = 'company' AND code IN ('ITX', 'TISPH')");
    const ownLogo = (await company('ITX')).data.Logo;
    expect(await enforceDeploymentPack('toyota-insurance-services')).toMatchObject({ status: 'enabled' });
    const packLogo = (await company('ITX')).data.Logo;
    expect(packLogo).not.toBe(ownLogo);

    await seed({ log: () => {} });
    const tisph = await company('TISPH');
    expect(tisph.data).toMatchObject({ IsPrimary: true, Logo: packLogo });
    expect((await company('ITX')).data).toMatchObject({ IsPrimary: false, Logo: ownLogo });
    expect((await q("SELECT previous->>'companyId' AS id FROM brand_pack_enablements WHERE status = 'enabled'"))[0].id).toBe(String(tisph.id));
    clearLetterheadCache();
    const lh = await getLetterhead({ fresh: true });
    expect(lh.code).toBe('TISPH');
    expect(lh.logo.buffer.equals((await resolveLogo(packLogo)).buffer)).toBe(true);

    // Back to default takes the pack logo off TISPH, the company it is now on
    expect((await ctx.api('post', '/branding/packs/reset-default').send({})).status).toBe(200);
    expect((await company('TISPH')).data.Logo).toBeUndefined();
    expect((await company('ITX')).data.Logo).toBe(ownLogo);
  });

  it('rebuilds a January fiscal calendar on April while no period has been closed; a soft close stays', async () => {
    await januaryCalendar();
    await q("UPDATE accounting_periods SET status = 'soft_closed' WHERE period = '2026-01'");
    await seed({ log: () => {} });
    clearSettingsCache();
    expect(await setting('accounting.fiscal_year_start_month')).toBe(4);
    expect(await q('SELECT code FROM fiscal_years')).toEqual([]);
    await withTransaction((db) => ensureCalendar(db));
    expect(await startMonths()).toEqual([4]);
    expect((await q("SELECT fiscal_year, period_no, status FROM accounting_periods WHERE period = '2026-01'"))[0]).toEqual({ fiscal_year: 'FY2026', period_no: 10, status: 'soft_closed' });
    expect(await q("SELECT period FROM accounting_periods WHERE is_adjustment AND period = '2025-13'")).toEqual([]);
  });

  it('leaves a January fiscal calendar with a closed period as it is and logs a warning', async () => {
    await januaryCalendar();
    await q("UPDATE accounting_periods SET status = 'closed' WHERE period = '2026-02'");
    const messages = [];
    await seed({ log: (m) => messages.push(m) });
    clearSettingsCache();
    expect(messages.filter((m) => m.startsWith('WARNING: TISPH fiscal year April to March not applied'))).toEqual([
      'WARNING: TISPH fiscal year April to March not applied: the fiscal calendar starts in January and a period is closed or locked (accounting.fiscal_year_start_month stays 1)']);
    expect(await setting('accounting.fiscal_year_start_month')).toBe(1);
    expect(await startMonths()).toEqual([1]);
  });
});
