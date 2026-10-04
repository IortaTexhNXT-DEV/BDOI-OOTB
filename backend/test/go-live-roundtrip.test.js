/**
 * Go-Live Data Workbench, promotion round trip: the configuration workbook downloaded with the current data and
 * uploaded unchanged into the same environment reports every row unchanged (0 new, 0 changed), on a database whose
 * masters were entered through the screens with the values screens store: numbers sent as numbers or as text, text with
 * surrounding or doubled spaces and line breaks, lower / upper case codes, empty versus missing values, dates, JSON
 * settings, booleans, cities keyed by state, sub accounts, inactive records. Also the Numbering sheet across the
 * transaction reset: the series restart at the next numbers it set.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { readWorkbook, readZip } from '../src/modules/documents/xlsx.js';
import { createZip } from '../src/lib/zip.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { nextDocumentNumber } from '../src/lib/numbering.js';
import { resetTransactions } from '../scripts/reset-transactions.js';

let api;
const bin = (req) => req.buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});
const ok = async (req, status = [200, 201]) => {
  const r = await req;
  if (![].concat(status).includes(r.status)) throw new Error(`${r.req?.method} ${r.req?.path}: ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
  return r.body.data;
};
const withClient = async (fn) => {
  const c = await pool.connect();
  try { return await fn(c); } finally { c.release(); }
};
const upload = (buffer) => api('post', '/data-load/batches').field('kit', 'configuration').attach('file', buffer, 'current.xlsx');

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {} });
  const app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
});
afterAll(async () => {
  await pool.end();
});

/** Masters across every sheet of the kit, entered on the screens (API) with the value shapes the screens send. */
async function enterMasters() {
  // Settings of every type, values as a screen sends them (numbers as text, lists, objects, text with spaces)
  const settings = await ok(api('get', '/settings'));
  const editable = (type) => settings.filter((s) => s.editable !== false && s.type === type && /^(claims|collections|limits|leads|renewals|quotations)\./.test(s.key));
  const num = editable('number')[0];
  const json = editable('json')[0];
  const bool = editable('boolean')[0];
  const text = editable('string')[0];
  await ok(api('put', '/settings').send({ settings: { [num.key]: '45', [json.key]: Array.isArray(json.value) ? [...json.value] : json.value, [bool.key]: !bool.value, [text.key]: `  ${text.value || 'Text'}  value ` } }));
  clearSettingsCache();

  // Location masters: a country, a state of the same name as a Philippine state, cities keyed by state (given by code)
  await ok(api('post', '/masters/country').send({ CountryName: 'Vietnam', ISOCode: 'VN', Description: 'South East Asia', PhoneCode: '+84' }));
  const ph = await ok(api('get', '/masters/state?search=Cebu'));
  const cebu = ph.find((s) => /cebu/i.test(s.StateName));
  await ok(api('post', '/masters/state').send({ StateCode: 'VN-CEB', StateName: cebu.StateName, Description: 'Same name as a Philippine province', Country: 'Vietnam' }));
  await ok(api('post', '/masters/city').send({ CityCode: 'VN-CEB-1', CityName: 'Tan Binh', Description: 'Line one\nLine two', State: 'VN-CEB', PostalCode: 70000 }));
  await ok(api('post', '/masters/city').send({ CityCode: 'TGY', CityName: 'Tagaytay  City', Description: ' Ridge city ', State: 'CAV', PostalCode: '4120' }).catch(() => null));
  await ok(api('post', '/masters/city').send({ CityCode: 'PH-CEB-X', CityName: 'Talisay', Description: 'Cebu province', State: cebu.StateName, PostalCode: '6045' }));
  await ok(api('post', '/masters/city').send({ CityCode: 'VN-CEB-2', CityName: 'Talisay', Description: 'Same name, other state', State: 'VN-CEB' }));

  // Currency with numbers sent as numbers, an exchange rate with many decimals
  await ok(api('post', '/masters/currency').send({ CurrencyCode: 'AUD', ISOcode: 'AUD', SmallestUnit: 0.01, UnitDescription: 'Cent', CurrencyName: 'Australian Dollar',
    Description: 'Line one\r\nLine two', CurrencyFormat: 'AUD #,##0.00', NumberofDecimals: '2', symbol: 'A$', isBase: false }));
  await ok(api('post', '/masters/exchange-rate').send({ CurrencyCode: 'USD', ToCurrencyCode: 'PHP', ExchangeRate: 57.123456, EffectiveFrom: '2026-01-01', CurrencyDescription: 'US Dollar', ToCurrencyDescription: 'Philippine Peso' }));

  // Chart of accounts: main and sub account, open item, no manual JV, inactive, multi-line description, mixed case
  await ok(api('post', '/accounting/accounts').send({ code: '4409201', name: 'Donations  and Gifts', accountType: 'expense', fsGroup: 'Operating Expenses', category: 'operating expenses', description: 'First line\r\nSecond line ' }));
  await ok(api('post', '/accounting/accounts').send({ code: '4409201001', name: 'Donations - Relief', accountType: 'expense', parentCode: '4409201', isOpenItem: true, allowManual: false }));
  await ok(api('post', '/accounting/accounts').send({ code: '1109901', name: 'Old Clearing', accountType: 'asset', status: 'inactive', description: '' }));

  // Users: several roles, a manager, inactive
  await ok(api('post', '/users').send({ username: 'rt.manager', password: 'Round-Trip#2026', displayName: 'Round Trip Manager', roles: ['accounting-manager'], email: 'rt.manager@example.ph', branchCode: 'HO' }));
  const u = await ok(api('post', '/users').send({ username: 'rt.clerk', password: 'Round-Trip#2026', displayName: 'Round Trip Clerk', firstName: 'Round', lastName: 'Trip',
    roles: ['sales', 'processing'], email: 'rt.clerk@example.ph', phone: '+63 917 000 0000' }));
  await ok(api('patch', `/users/${u.id || u.userId}/status`).send({ status: 'inactive' }));

  // Commission rates: line of business code in upper case, open ended and dated, inactive
  const lob = (await ok(api('get', '/masters/line-of-business')))[0];
  await ok(api('post', '/commission-rates').send({ lineOfBusiness: String(lob.lineofBusinessCode).toUpperCase(), policyType: 'renewal', rate: 0.125, effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', remarks: 'Renewal  rate ' }));
  await ok(api('post', '/commission-rates').send({ lineOfBusiness: lob.lineofBusinessCode, policyType: 'new', rate: '0.1', effectiveFrom: '2025-01-01', active: false }));

  // Premium charges and LGU rates
  await ok(api('post', '/premium-charges/rules').send({ code: 'stamps', name: 'Policy stamps', kind: 'other', method: 'flat', unitAmount: 30, lines: ['Motor', 'fire'], effectiveFrom: '2026-01-01' }));
  await ok(api('post', '/premium-charges/lgu-rates').send({ code: 'tgy', name: 'Tagaytay', province: 'Cavite', rate: '0.25', effectiveFrom: '2026-01-01' }));

  // Numbering: a series edited on the screen
  await ok(api('put', '/document-numbering/claim').send({ prefix: 'CLM', pattern: '{PREFIX}-{YY}{MM}-{SEQ}', seqWidth: 6 }));
}

describe('configuration workbook round trip', () => {
  it('downloads the current data and uploads it unchanged into the same environment: every row unchanged, 0 new, 0 changed', async () => {
    await enterMasters();
    const t = await bin(api('get', '/data-load/kits/configuration/template?prefill=true'));
    expect(t.status).toBe(200);
    const sheets = readWorkbook(t.body);
    const objects = sheets.filter((s) => !['Instructions', 'Lists'].includes(s.name));
    // every sheet holds data (masters across all sheets)
    const empty = objects.filter((s) => s.rows.length <= 2).map((s) => s.name);
    expect(empty.filter((n) => !['Signatories', 'Exchange Rates'].includes(n))).toEqual([]);
    const r = await upload(t.body);
    expect(r.status).toBe(201);
    const batch = r.body.data.batch;
    expect(r.body.data.errors).toEqual([]);
    const notUnchanged = batch.sheets.filter((s) => s.unchanged !== s.read).map((s) => `${s.name}: ${s.created} new, ${s.updated} changed, ${s.proposed} proposed, ${s.errors} errors`);
    expect(notUnchanged).toEqual([]);
  });

  it('the same file saved by another spreadsheet program is still unchanged: characters as &#NNNN; references, line breaks as _x000D_', async () => {
    const t = await bin(api('get', '/data-load/kits/configuration/template?prefill=true'));
    // what openpyxl does when it saves the file: every character outside ASCII written as a numeric character
    // reference (the en dash of 48 account names, ñ of Parañaque, ₱ of the peso); Excel writes \r as _x000D_
    const zip = readZip(t.body);
    const files = zip.names.map((name) => {
      let data = zip.get(name);
      if (name === 'xl/sharedStrings.xml') {
        expect(data).toMatch(/–/);
        data = data.replace(/[^\t\n\r\x20-\x7e]/gu, (ch) => `&#${ch.codePointAt(0)};`).replace(/\r/g, '_x000D_');
      }
      return { name, data };
    });
    const resaved = createZip(files);
    expect(readWorkbook(resaved).find((s) => s.name === 'Chart of Accounts').rows.some((r) => /–/.test(r[1]))).toBe(true);
    const r = await upload(resaved);
    expect(r.status).toBe(201);
    expect(r.body.data.errors).toEqual([]);
    const notUnchanged = r.body.data.batch.sheets.filter((s) => s.unchanged !== s.read).map((s) => `${s.name}: ${s.created} new, ${s.updated} changed`);
    expect(notUnchanged).toEqual([]);
  });

  it('counts only real differences: a changed value is one changed row, nothing else moves', async () => {
    await query("UPDATE gl_accounts SET name = 'Donations and Gifts (renamed)' WHERE code = '4409201'");
    const t = await bin(api('get', '/data-load/kits/configuration/template?prefill=true'));
    await query("UPDATE gl_accounts SET name = 'Donations  and Gifts' WHERE code = '4409201'");
    const r = await upload(t.body);
    const changed = r.body.data.batch.sheets.filter((s) => s.unchanged !== s.read).map((s) => [s.name, s.created, s.updated]);
    expect(changed).toEqual([['Chart of Accounts', 0, 1]]);
  });
});

describe('Numbering sheet and the transaction reset', () => {
  it('the next number of the Numbering sheet survives the reset: the series restarts there and loading the sheet again changes nothing', async () => {
    const numbering = writeXlsx({ sheets: [{ name: 'Numbering', columns: [{ header: 'Series Code' }, { header: 'Next Number' }], rows: [['receipt', '1201']] }] });
    const r = await upload(numbering);
    expect(r.body.data.batch.sheets.find((s) => s.sheet === 'numbering')).toMatchObject({ updated: 1 });
    expect((await api('post', `/data-load/batches/${r.body.data.batch.id}/load`).send({})).status).toBe(200);
    expect((await api('get', '/document-numbering/receipt')).body.data).toMatchObject({ nextNumber: 1201, periodStartNumber: 1201 });
    // smoke test, then the reset
    expect(await nextDocumentNumber('receipt')).toMatch(/01201$/);
    const plan = await withClient((c) => resetTransactions(c, { execute: true }));
    expect(plan.series.restart.find((x) => x.series === 'receipt')).toMatchObject({ restartAt: 1201, configured: true });
    // the workbook with the current data shows 1201 again, and the Numbering sheet loaded again is unchanged
    const t = await bin(api('get', '/data-load/kits/configuration/template?prefill=true'));
    const sheet = readWorkbook(t.body).find((s) => s.name === 'Numbering');
    const col = sheet.rows[0].indexOf('Next Number');
    expect(sheet.rows.find((row) => row[0] === 'receipt')[col]).toBe('1201');
    const again = await upload(numbering);
    expect(again.body.data.batch.sheets.find((s) => s.sheet === 'numbering')).toMatchObject({ read: 1, unchanged: 1, updated: 0 });
    expect(await nextDocumentNumber('receipt')).toMatch(/01201$/);
  });
});
