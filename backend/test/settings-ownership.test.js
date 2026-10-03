/**
 * One screen per setting: System Settings owns the branding, display currency, language and application name; the
 * Company master owns the legal identity (name, TIN, registered address, print logo) and the BIR forms read it from
 * the primary company; Premium Taxes & LGU Rates owns the premium tax rates. The generic configuration endpoints
 * refuse those keys, and the retired taxation master can no longer write tax.* settings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache, getSetting } from '../src/lib/settings.js';
import { clearLetterheadCache } from '../src/lib/letterhead.js';
import { settingOwner } from '../src/lib/settingOwners.js';

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'db', 'migrations');
let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

const value = async (key) => (await one('SELECT value FROM app_settings WHERE key = $1', [key]))?.value;

describe('settings owned by another screen', () => {
  it('names the owning screen of each key', () => {
    expect(settingOwner('branding.primary_color').screen).toBe('Master > System Settings');
    expect(settingOwner('general.system_name').screen).toBe('Master > System Settings');
    expect(settingOwner('currency.default').screen).toBe('Master > System Settings');
    expect(settingOwner('bir.withholding_agent_tin').screen).toBe('Master > Company');
    expect(settingOwner('documents.default_logo_path').screen).toBe('Master > Company');
    expect(settingOwner('premium.taxes_by_lob').screen).toBe('Master > Finance > Premium Taxes & LGU Rates');
    expect(settingOwner('notification.email_enabled')).toBeNull();
  });

  it('PUT /settings refuses owned keys with the owning screen, and saves nothing of the request', async () => {
    const cases = [
      ['branding.primary_color', '#123456', 'Master > System Settings'],
      ['general.default_language', 'fil', 'Master > System Settings'],
      ['general.system_name', 'Other name', 'Master > System Settings'],
      ['general.company_name', 'Another Corp.', 'Master > Company'],
      ['bir.withholding_agent_tin', '111-222-333-000', 'Master > Company'],
      ['tax.vat_rate', 0.1, 'Master > Finance > Premium Taxes & LGU Rates'],
      ['premium.taxes_by_lob', {}, 'Master > Finance > Premium Taxes & LGU Rates'],
    ];
    const rows = await value('limits.bulk_upload_max_rows');
    for (const [key, v, screen] of cases) {
      const before = await value(key);
      const r = await ctx.api('put', '/settings').send({ settings: { [key]: v, 'limits.bulk_upload_max_rows': 777 } });
      expect(r.status, key).toBe(400);
      expect(r.body.message).toContain(screen);
      expect(r.body.errors).toEqual([{ path: key, message: `${key} is managed in ${screen}` }]);
      expect(await value(key)).toEqual(before);
      expect(await value('limits.bulk_upload_max_rows')).toBe(rows);
    }
    // the generic configuration endpoint of System Settings applies the same rule
    const cfg = await ctx.api('put', '/system-settings/configuration').send({ settings: { 'tax.dst_rate': 0.2 } });
    expect(cfg.status).toBe(400);
    expect(cfg.body.message).toContain('Premium Taxes & LGU Rates');
  });

  it('a key sent back with its current value is not a change; other settings still save', async () => {
    const vat = await value('tax.vat_rate');
    const rows = await value('limits.bulk_upload_max_rows');
    const r = await ctx.api('put', '/settings').send({ settings: { 'tax.vat_rate': vat, 'limits.bulk_upload_max_rows': 777 } });
    expect(r.status).toBe(200);
    expect(await value('limits.bulk_upload_max_rows')).toBe(777);
    await ctx.api('put', '/settings').send({ settings: { 'limits.bulk_upload_max_rows': rows } });
  });

  it('GET /settings and the configuration catalogue tell the screen where an owned key is changed', async () => {
    const rows = (await ctx.api('get', '/settings?group=branding')).body.data;
    expect(rows.find((s) => s.key === 'branding.logo_url')).toMatchObject({
      label: 'Application logo (screen)', managedBy: { screen: 'Master > System Settings', path: '/master/configuration/system-settings' },
    });
    const general = (await ctx.api('get', '/settings?group=general')).body.data;
    expect(general.find((s) => s.key === 'general.company_name').managedBy.path).toBe('/master/generals/organization/companymaster');
    expect(general.find((s) => s.key === 'general.timezone').managedBy).toBeNull();
    const cat = (await ctx.api('get', '/system-settings/configuration?group=tax')).body.data;
    expect(cat.items.find((i) => i.key === 'tax.lgt_rate').managedBy.path).toBe('/master/finance/premium-taxes');
  });

  it('System Settings still saves its keys, with its own validation', async () => {
    const r = await ctx.api('put', '/system-settings').send({ systemName: 'Acme Brokers', primaryColor: '#123abc', displayCurrency: 'PHP', defaultLanguage: 'en' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ systemName: 'Acme Brokers', primaryColor: '#123abc' });
    expect(r.body.data.appTitle).toBeUndefined();
    expect(await value('general.system_name')).toBe('Acme Brokers');
    expect(await value('branding.primary_color')).toBe('#123abc');
    expect((await ctx.api('put', '/system-settings').send({ systemName: '' })).status).toBe(400);
    await ctx.api('put', '/system-settings').send({ systemName: 'BrokerVerse', primaryColor: '#0072d8' });
  });
});

describe('one application name', () => {
  it('general.app_title is deprecated and read-only; a changed title moves to general.system_name (migration 0231)', async () => {
    const appTitle = async () => one('SELECT value, "group", editable FROM app_settings WHERE key = \'general.app_title\'');
    expect(await appTitle()).toMatchObject({ group: 'system', editable: false });
    expect(await getSetting('general.system_name')).toBe('BrokerVerse');
    expect((await ctx.api('put', '/system-settings/configuration').send({ settings: { 'general.app_title': 'X' } })).status).toBe(400);
    const sql = fs.readFileSync(path.join(MIGRATIONS, '0231_application_name.sql'), 'utf8');
    const reset = (title) => query(`UPDATE app_settings SET value = $1, "group" = 'general', editable = true WHERE key = 'general.app_title'`, [JSON.stringify(title)]);
    // an installation that still has the default title keeps its system name
    await reset('Brokerverse');
    await query(sql);
    expect(await value('general.system_name')).toBe('BrokerVerse');
    expect(await appTitle()).toMatchObject({ group: 'system', editable: false });
    // a title the customer changed becomes the application name
    await reset('Acme Insurance Brokers');
    await query(sql);
    expect(await value('general.system_name')).toBe('Acme Insurance Brokers');
    await query(`UPDATE app_settings SET value = '"BrokerVerse"' WHERE key = 'general.system_name'`);
    clearSettingsCache();
  });
});

describe('company identity on BIR Form 2307', () => {
  const quarterOf = async () => {
    const d = (await one(`SELECT to_char(voucher_date, 'YYYY-MM-DD') AS d FROM disbursements WHERE wht_amount > 0 AND status IN ('approved','paid') ORDER BY voucher_date LIMIT 1`)).d;
    return { year: Number(d.slice(0, 4)), quarter: Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1 };
  };
  const certificatePayor = async () => {
    const { year, quarter } = await quarterOf();
    const list = await ctx.api('get', `/period-end/bir/2307?year=${year}&quarter=${quarter}`);
    expect(list.status).toBe(200);
    const payee = list.body.data.payees[0];
    const cert = await ctx.api('get', `/period-end/bir/2307/certificate?year=${year}&quarter=${quarter}&payeeKey=${encodeURIComponent(payee.payeeKey)}`);
    expect(cert.status).toBe(200);
    return cert.body.data.payor;
  };

  it('the company form has TIN, RDO code and the registered address', async () => {
    const def = (await ctx.api('get', '/masters/company/definition')).body.data;
    const names = def.fields.map((f) => f.name);
    for (const f of ['CompanyName', 'TIN', 'RDOCode', 'AddressLine1', 'City', 'PinCode', 'Logo']) expect(names).toContain(f);
  });

  it('the primary company supplies the legal name, TIN, registered address and RDO code; the bir.* settings do not', async () => {
    const company = await one(`SELECT id FROM master_records WHERE type_code = 'company' AND status = 'active'
      AND lower(COALESCE(data->>'IsPrimary', 'false')) = 'true'`);
    expect(company).toBeTruthy();
    const u = await ctx.api('put', `/masters/company/${company.id}`).send({
      CompanyName: 'Acme Insurance Brokers Inc.', TIN: '123-456-789-000', RDOCode: '047', AddressLine1: '18F Ayala Tower One', AddressLine2: 'Ayala Avenue',
      AddressLine3: '', City: 'Makati', State: 'Metro Manila', Country: 'Philippines', PinCode: '1226',
    });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    // a value left in the settings is only the fallback
    await query(`UPDATE app_settings SET value = '"999-999-999-000"' WHERE key = 'bir.withholding_agent_tin'`);
    await query(`UPDATE app_settings SET value = '"Old Registered Name"' WHERE key = 'bir.registered_name'`);
    clearSettingsCache();
    expect(await certificatePayor()).toEqual({
      name: 'Acme Insurance Brokers Inc.', tin: '123-456-789-000', address: '18F Ayala Tower One, Ayala Avenue, Makati, Metro Manila, Philippines', zip: '1226', rdoCode: '047',
    });
    // saving the company keeps general.company_name in step (the fallback of documents)
    expect(await value('general.company_name')).toBe('Acme Insurance Brokers Inc.');
  });

  it('falls back to the bir.* settings only when no company exists', async () => {
    const active = (await query(`UPDATE master_records SET status = 'inactive' WHERE type_code = 'company' AND status = 'active' RETURNING id`)).rows.map((r) => r.id);
    clearLetterheadCache();
    try {
      expect(await certificatePayor()).toMatchObject({ name: 'Old Registered Name', tin: '999-999-999-000', rdoCode: '' });
    } finally {
      await query('UPDATE master_records SET status = \'active\' WHERE id = ANY($1)', [active]);
      clearLetterheadCache();
    }
  });
});

describe('legacy taxation master', () => {
  it('is retired: its records can no longer change tax.* settings', async () => {
    const types = (await ctx.api('get', '/masters?category=finance')).body.data;
    expect(types.find((t) => t.code === 'taxation')).toMatchObject({ status: 'Inactive' });
    const before = await value('tax.vat_rate');
    const vat = (await ctx.api('get', '/masters/taxation?taxCode=VAT')).body.data[0];
    const upd = await ctx.api('put', `/masters/taxation/${vat.id}`).send({ taxRate: 15, settingKey: 'tax.vat_rate', status: 'Active' });
    expect(upd.status).toBe(400);
    expect(upd.body.message).toMatch(/retired/);
    const add = await ctx.api('post', '/masters/taxation').send({ taxCode: 'VAT2', taxName: 'VAT', taxRate: 20, basis: 'Premium', effectiveFrom: '2026-01-01', settingKey: 'tax.vat_rate' });
    expect(add.status).toBe(400);
    expect((await ctx.api('patch', `/masters/taxation/${vat.id}/status`).send({ status: 'Active' })).status).toBe(400);
    expect(await value('tax.vat_rate')).toEqual(before);
    expect(await one(`SELECT 1 FROM master_records WHERE type_code = 'taxation' AND (data ? 'settingKey' OR status = 'active')`)).toBeNull();
  });
});
