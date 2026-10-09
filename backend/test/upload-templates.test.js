/**
 * Upload templates and go-live imports: every route that receives a data file has a template and every template is in
 * the delivered folder (docs/package/05_Delivery/Upload_Templates) with its README coverage table; every generated
 * template (scripts/build-upload-templates.js) is read back by its importer's own parser and column list, and the master
 * and insurer statement samples are loaded through the API; retired master types have no template; the master upload,
 * the chart of accounts upload, the GL opening balances import (with the year-end carry forward), the open items import
 * and the go-live policy upload.
 * Reference data only (no sample ledger), so the current fiscal year has no journals before the go-live date.
 */
import { KITS } from '../src/modules/data-load/service.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { withCalendarFiscalYear } from './helpers.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { cancelJournal, createJournal } from '../src/modules/accounting/lib/ledger.js';
import { readXlsx } from '../src/modules/documents/xlsx.js';
import { mapColumns, normKey, parseUploadedRows } from '../src/modules/documents/tabular.js';
import { camel, readSheet } from '../src/modules/accounting/lib/sheet.js';
import { parseRows, readTable } from '../src/modules/bank-reconciliation/statements.js';
import { parseRows as parseInsurerRows } from '../src/modules/insurer-reconciliation/statements.js';
import * as masters from '../src/modules/masters/service.js';
import { bulkConfig } from '../src/modules/remittance/items.js';
import { MASTER_TEMPLATES } from '../src/modules/masters/uploadSamples.js';
import { DEFAULT_OUT, FILE_ROUTES, buildTemplates, coverageTable, uploadDefinitions } from '../scripts/build-upload-templates.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const CAMEL_IMPORTERS = new Set(['receipts', 'disbursements', 'open-items']);
let app;
let api;
let outDir;
let defs;
let built;

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  await withCalendarFiscalYear();
  app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-templates-'));
  built = await buildTemplates(outDir);
  defs = await uploadDefinitions();
});
afterAll(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  await pool.end();
});

const file = (name) => ({ buffer: fs.readFileSync(path.join(outDir, name)), originalname: name });
const upload = (route, name, fields = {}, buffer = null) => {
  const req = api('post', route);
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  return req.attach('file', buffer || fs.readFileSync(path.join(outDir, name)), name);
};
const csvBuffer = (rows) => Buffer.from(rows.map((r) => r.join(',')).join('\r\n'));

describe('generated upload templates', () => {
  it('builds one workbook per upload, Data sheet first, with the importer headers and no duplicate header', () => {
    // commission, employee and petty cash masters are retired (Commission Rate Matrix, User Management > User, Petty Cash > Initiate)
    expect(defs.length).toBeGreaterThanOrEqual(52);
    for (const id of ['leads', 'quotations', 'policies', 'receipts', 'disbursements', 'chart-of-accounts', 'opening-balances', 'open-items', 'bank-statement', 'insurer-statement', 'remittance-bulk',
      'remittance-bank-transactions', 'users', 'master:insurance-company', 'master:branch', 'master:product', 'master:cover', 'master:vehicle-brand', 'master:vehicle-model',
      'master:vehicle-variant', 'master:city', 'master:bank', 'master:bank-account', 'master:remittance-bulk-processing']) expect(defs.map((d) => d.id)).toContain(id);
    // retired masters (migration 0241, taxation 0233) and masters without an upload have no template
    for (const code of [...masters.RETIRED_TYPES.keys(), ...masters.NOT_UPLOADABLE.keys()]) expect(defs.map((d) => d.id)).not.toContain(`master:${code}`);
    expect(new Set(defs.map((d) => d.file)).size).toBe(defs.length);
    for (const d of defs) {
      const table = readXlsx(fs.readFileSync(path.join(outDir, d.file)));
      expect(table[0], d.file).toEqual(d.columns.map((c) => c.header));
      expect(new Set(table[0].map(normKey)).size, `${d.file} duplicate header`).toBe(table[0].length);
      expect(table.length - 1, `${d.file} sample rows`).toBe((d.samples || []).length);
      if (d.csv) expect(fs.readFileSync(path.join(outDir, d.csv), 'utf8').split('\r\n')[0]).toBe(d.columns.map((c) => c.header).join(','));
    }
  });

  it('every sample value is read back by the importer\'s own parser and column list', async () => {
    for (const d of defs.filter((x) => x.samples?.length && !['bank-statement', 'insurer-statement', 'remittance-bulk', 'remittance-bank-transactions', 'users'].includes(x.id))) {
      const rows = CAMEL_IMPORTERS.has(d.id) ? readSheet(file(d.file).buffer, d.file) : parseUploadedRows(file(d.file));
      let mapped;
      if (d.id.startsWith('master:')) {
        const t = await masters.getType(d.id.slice(7));
        mapped = rows.map((r) => masters.bodyFromRow(t, r, (row, ...names) => { for (const n of names) { const v = row[normKey(n)]; if (v !== undefined && v !== '') return v; } return undefined; }));
      } else mapped = rows.map((r) => mapColumns(r, d.columns, CAMEL_IMPORTERS.has(d.id) ? camel : normKey));
      d.samples.forEach((s, i) => {
        for (const [k, v] of Object.entries(s)) {
          if (v === '' || v === undefined) continue;
          // JSON columns of a master are parsed by the importer
          if (/^JSON/.test(d.columns.find((c) => c.key === k)?.format || '')) expect(mapped[i][k], `${d.file} ${k}`).toEqual(JSON.parse(v));
          else expect(String(mapped[i][k]), `${d.file} ${k}`).toBe(String(v));
        }
      });
    }
  });

  it('master templates list the fields of the type definition (audit fields left out) and the bank statement template parses with GENERIC', async () => {
    const t = await masters.getType('insurance-company');
    const d = defs.find((x) => x.id === 'master:insurance-company');
    expect(d.columns.map((c) => c.key)).toEqual([...t.fields.filter((f) => !f.type.startsWith('audit')).map((f) => f.name), 'status']);
    expect(d.columns.filter((c) => c.required).map((c) => c.key)).toEqual(t.fields.filter((f) => f.required).map((f) => f.name));
    const fmt = (await query('SELECT * FROM bank_statement_formats WHERE code = \'GENERIC\'')).rows[0];
    const st = defs.find((x) => x.id === 'bank-statement');
    const parsed = parseRows(readXlsx(file(st.file).buffer), fmt);
    expect(parsed.errors).toEqual([]);
    expect(parsed.lines).toHaveLength(st.samples.length);
    expect(parsed.lines[1]).toMatchObject({ debit: 28120.5, credit: 0, reference: 'CHK 000123' });
    const { maps } = await bulkConfig();
    expect(defs.find((x) => x.id === 'remittance-bulk').columns.map((c) => c.header)).toEqual(maps.map((m) => m.sourceField));
  });

  it('the CSV-only templates match the readers outside the API (provisioning script, reconciliation screen)', () => {
    const script = fs.readFileSync(path.join(here, '..', 'scripts', 'provision-users.js'), 'utf8');
    for (const c of defs.find((x) => x.id === 'users').columns) expect(script).toContain(`col('${c.header}')`);
    const screen = fs.readFileSync(path.join(repo, 'brokerverse', 'src', 'module', 'Remittance', 'Reconciliation', 'index.js'), 'utf8');
    for (const c of defs.find((x) => x.id === 'remittance-bank-transactions').columns) expect(screen).toContain(`"${c.header.toLowerCase()}"`);
  });
});

describe('upload coverage', () => {
  // Routes that receive a file: a define() block whose middleware takes a multipart upload.
  const FILE_MIDDLEWARE = /\b(uploadFile|singleFile|multerAny|upload\.(single|any|array|fields)\()/;
  function fileRoutes() {
    const dir = path.join(here, '..', 'src', 'modules');
    const out = [];
    for (const m of fs.readdirSync(dir)) {
      const f = path.join(dir, m, 'router.js');
      if (!fs.existsSync(f)) continue;
      for (const block of fs.readFileSync(f, 'utf8').split(/\bdefine\(\{/).slice(1)) {
        const head = block.slice(0, 1500);
        const mw = head.match(/middleware:\s*\[[^\]]*\]|middleware:\s*[A-Za-z]+/);
        if (!mw || !FILE_MIDDLEWARE.test(mw[0])) continue;
        out.push(`${m} ${head.match(/method:\s*'(\w+)'/)[1]} ${head.match(/path:\s*['`]([^'`]+)['`]/)[1]}`);
      }
    }
    return out.sort();
  }

  it('every route that receives a file has a template, or is an attachment', () => {
    expect(fileRoutes()).toEqual(FILE_ROUTES.map((r) => `${r.module} ${r.method} ${r.path}`).sort());
    const ids = new Set(defs.map((d) => d.id));
    for (const r of FILE_ROUTES) {
      expect(r.templates || r.noTemplate, `${r.module} ${r.path}`).toBeTruthy();
      for (const id of r.templates || []) {
        const known = id === 'master:*' ? defs.some((d) => d.id.startsWith('master:')) : id.startsWith('kit:') ? Boolean(KITS[id.slice(4)]) : ids.has(id);
        expect(known, id).toBe(true);
      }
    }
  });

  it('every master type that takes an upload has a template with its menu path and sample rows; retired types have none', async () => {
    const active = (await query("SELECT code FROM master_types WHERE status = 'active' ORDER BY code")).rows.map((r) => r.code);
    const uploadable = active.filter((c) => !masters.NOT_UPLOADABLE.has(c));
    expect(defs.filter((d) => d.id.startsWith('master:')).map((d) => d.id.slice(7)).sort()).toEqual(uploadable.sort());
    for (const code of uploadable) {
      const info = MASTER_TEMPLATES.find((m) => m.type === code);
      expect(info, `uploadSamples.js entry for ${code}`).toBeTruthy();
      expect(info.menu, code).toBeTruthy();
      expect(info.samples?.length, `${code} samples`).toBeGreaterThan(0);
    }
    for (const m of MASTER_TEMPLATES) expect(active, `${m.type} is retired or unknown`).toContain(m.type);
    const inactive = (await query("SELECT code FROM master_types WHERE status = 'inactive'")).rows.map((r) => r.code);
    expect(inactive.sort()).toEqual([...masters.RETIRED_TYPES.keys()].sort());
    for (const code of [...inactive, 'main-account', 'account-setup']) {
      const r = await api('get', `/masters/${code}/template`);
      expect(r.status, code).toBe(400);
      expect((await upload(`/masters/${code}/upload`, 'x.csv', {}, csvBuffer([['Code'], ['X']]))).status, code).toBe(400);
    }
  });

  it('the delivered folder holds exactly the generated templates and the README coverage table is current', () => {
    expect(path.relative(repo, DEFAULT_OUT)).toBe(path.join('docs', 'package', '05_Delivery', 'Upload_Templates'));
    const delivered = fs.readdirSync(DEFAULT_OUT).filter((f) => f !== 'README.md').sort();
    expect(delivered).toEqual(built.flatMap((t) => [t.file, t.csv].filter(Boolean)).sort());
    expect(built.removed).toEqual([]);
    const readme = fs.readFileSync(path.join(DEFAULT_OUT, 'README.md'), 'utf8');
    const section = readme.match(/<!-- coverage:start[^>]*-->\n([\s\S]*?)\n<!-- coverage:end -->/);
    expect(section, 'coverage markers in README.md').toBeTruthy();
    expect(section[1]).toBe(coverageTable(built));
    expect(fs.existsSync(path.join(repo, 'docs', 'templates'))).toBe(false);
  });

  it('the CSV templates the bulk upload screens offer have the importer headers', () => {
    const src = fs.readFileSync(path.join(repo, 'brokerverse', 'src', 'agentModule', 'component', 'bulkUploadTemplate.js'), 'utf8');
    for (const id of ['leads', 'quotations', 'policies', 'receipts', 'disbursements']) {
      const block = src.match(new RegExp(`\\b${id}: \\{[\\s\\S]*?columns: \\[([\\s\\S]*?)\\]`))[1];
      const headers = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      expect(headers, id).toEqual(defs.find((d) => d.id === id).columns.map((c) => c.header));
    }
  });

  it('the sample rows of every master template are accepted by the master upload', async () => {
    for (const d of defs.filter((x) => x.id.startsWith('master:') && x.samples?.length)) {
      const r = await upload(`/masters/${d.id.slice(7)}/upload`, d.file);
      expect(r.status, `${d.file} ${JSON.stringify(r.body)}`).toBe(200);
      expect(r.body.data, `${d.file} ${JSON.stringify(r.body.data?.errors)}`).toMatchObject({ created: d.samples.length, failed: 0 });
    }
  });

  it('the insurer statement template is read by the GENERIC insurer format and imported', async () => {
    const d = defs.find((x) => x.id === 'insurer-statement');
    const fmt = (await query('SELECT * FROM insurer_statement_formats WHERE code = \'GENERIC\'')).rows[0];
    const parsed = parseInsurerRows(readTable(file(d.file)), fmt);
    expect(parsed.errors).toEqual([]);
    expect(parsed.lines).toHaveLength(d.samples.length);
    expect(parsed.lines[1]).toMatchObject({ policyNo: 'FPG-FI-2026-004417', grossPremium: 78437.5, commission: 12500, taxes: 1500, amountPaid: 64437.5, date: '2026-10-15' });
    const insurer = (await query('SELECT id FROM insurance_companies ORDER BY id LIMIT 1')).rows[0].id;
    const r = await upload('/insurer-reconciliation/statements/import', d.file, { insurerId: String(insurer), statementType: 'premium', periodFrom: '2026-10-01', periodTo: '2026-10-31', formatCode: 'GENERIC' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.lineCount).toBe(2);
  });
});

describe('master upload and template download', () => {
  it('downloads a master template and creates the uploaded records, reporting the rows that fail', async () => {
    const tpl = await api('get', '/masters/cover/template').buffer(true).parse((res, cb) => { const b = []; res.on('data', (x) => b.push(x)); res.on('end', () => cb(null, Buffer.concat(b))); });
    expect(tpl.status).toBe(200);
    expect(tpl.headers['content-disposition']).toContain('Cover_Upload_Template.xlsx');
    expect(readXlsx(tpl.body)[0]).toEqual(['Cover Code', 'Cover Name', 'Cover Description', 'Lines of business (blank: every line)', 'Status']);
    const r = await upload('/masters/cover/upload', 'covers.csv', {}, csvBuffer([['Cover Code', 'Cover Name', 'Cover Description', 'Status'], ['TPL-X', 'Test cover', 'Uploaded cover', 'Inactive'], ['', 'No code', 'x', '']]));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ total: 2, created: 1, failed: 1 });
    expect(r.body.data.errors[0]).toMatchObject({ row: 3 });
    expect(r.body.data.errors[0].message).toContain('Cover Code is required');
    const list = (await api('get', '/masters/cover?search=TPL-X')).body.data;
    expect(list[0]).toMatchObject({ coverCode: 'TPL-X', status: 'Inactive' });
    const again = await upload('/masters/cover/upload', 'covers.csv', {}, csvBuffer([['coverCode', 'coverName', 'coverDescription'], ['TPL-X', 'Test cover', 'dup']]));
    expect(again.body.data).toMatchObject({ created: 0, failed: 1 });
    expect((await upload('/masters/main-account/upload', 'x.csv', {}, csvBuffer([['Main Account Code'], ['9']]))).status).toBe(400);
  });

  it('chart of accounts upload adds new accounts and updates existing ones', async () => {
    const r = await upload('/accounting/accounts/upload', 'coa.csv', {}, csvBuffer([
      ['Account Code', 'Account Name', 'Account Type', 'Main Account Code', 'Statement Group', 'Open Item', 'Allow Manual JV'],
      ['4401031', 'Training and Seminars', 'expense', '', 'Operating Expenses', 'No', 'Yes'],
      ['4401031001', 'Training - Compliance', 'expense', '4401031', 'Operating Expenses', 'No', 'Yes'],
      ['4401002', 'Advertising and Promotions', '', '', '', '', ''],
      ['X', 'Bad code', 'expense', '', '', '', ''],
    ]));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ created: 2, updated: 1, failed: 1 });
    const sub = (await query('SELECT parent_code, is_open_item, allow_manual FROM gl_accounts WHERE code = \'4401031001\'')).rows[0];
    expect(sub).toEqual({ parent_code: '4401031', is_open_item: false, allow_manual: true });
    expect((await query('SELECT name FROM gl_accounts WHERE code = \'4401002\'')).rows[0].name).toBe('Advertising and Promotions');
  });
});

describe('go-live imports', () => {
  const tb = (rows) => csvBuffer([['Account Code', 'Account Name', 'Debit', 'Credit'], ...rows]);
  const GOOD = [['1102001', 'Cash in bank', '1000000', ''], ['1202001', 'Premiums receivable', '40000', ''], ['2201001', 'Due to insurers', '', '30000'], ['5101001', 'Retained earnings', '', '1010000']];

  it('refuses an unbalanced or invalid trial balance and loads nothing', async () => {
    const unbalanced = await upload('/period-end/opening-balances/import', 'tb.csv', { goLiveDate: '2026-01-01' }, tb([['1102001', '', '100', ''], ['5101001', '', '', '90']]));
    expect(unbalanced.status).toBe(400);
    expect(unbalanced.body.message).toContain('do not balance');
    const bad = await upload('/period-end/opening-balances/import', 'tb.csv', { goLiveDate: '2026-01-01' }, tb([['9999999', '', '100', ''], ['5101001', '', '50', '50'], ['5101001', '', '', '10']]));
    expect(bad.status).toBe(400);
    expect(bad.body.errors.map((e) => e.message).join(' | ')).toMatch(/9999999 is not in the chart.*not both.*more than once/);
    expect((await upload('/period-end/opening-balances/import', 'tb.csv', {}, tb(GOOD))).status).toBe(400);
    // only zero-balance rows: nothing to load
    expect((await upload('/period-end/opening-balances/import', 'tb.csv', { goLiveDate: '2026-01-01' }, tb([['1102001', '', '', ''], ['5101001', '', '0', '0']]))).body.message).toMatch(/no amounts/);
    expect((await query('SELECT count(*)::int AS n FROM opening_balances')).rows[0].n).toBe(0);
  });

  it('loads a balanced trial balance into the fiscal year of the go-live date; the same date replaces it, another date is refused', async () => {
    const r = await upload('/period-end/opening-balances/import', 'tb.csv', { goLiveDate: '2026-01-01' }, tb(GOOD));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ fiscalYear: 'FY2026', asAt: '2025-12-31', accounts: 4, totalDebit: 1040000, totalCredit: 1040000, replaced: 0 });
    const again = await upload('/period-end/opening-balances/import', 'tb.csv', { goLiveDate: '2026-01-01' }, tb(GOOD));
    expect(again.body.data.replaced).toBe(4);
    expect((await query('SELECT count(*)::int AS n FROM opening_balances WHERE fiscal_year = \'FY2026\'')).rows[0].n).toBe(4);
    expect((await upload('/period-end/opening-balances/import', 'tb.csv', { goLiveDate: '2026-02-01' }, tb(GOOD))).status).toBe(409);
    const list = (await api('get', '/period-end/opening-balances?fiscalYear=FY2026')).body.data;
    expect(list).toMatchObject({ source: 'go-live', goLiveDate: '2026-01-01', totalDebit: 1040000, totalCredit: 1040000 });
    expect((await query('SELECT action FROM audit_log WHERE entity = \'opening_balances\'')).rows.length).toBe(2);
  });

  it('accepts and ignores a row with no debit or credit (an account whose movements net to zero), with a note', async () => {
    const r = await upload('/period-end/opening-balances/import', 'tb.csv', { goLiveDate: '2026-01-01' }, tb([...GOOD, ['1101001', 'Cash on hand', '', ''], ['4401001', 'Administrative expenses', '0', '0.00']]));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ accounts: 4, totalDebit: 1040000, replaced: 4, ignored: [{ row: 6, accountCode: '1101001' }, { row: 7, accountCode: '4401001' }] });
    expect(r.body.message).toMatch(/2 row\(s\) with no debit or credit \(zero balance\) ignored: 1101001, 4401001/);
    expect((await query("SELECT count(*)::int AS n FROM opening_balances WHERE account_code IN ('1101001', '4401001')")).rows[0].n).toBe(0);
  });

  it('the trial balance report starts from the go-live opening balances (they are not journals)', async () => {
    const r = await api('post', '/reports/trial-balance/run').send({ FromDate: '2026-01-01', ToDate: '2026-12-31' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const acc = Object.fromEntries(r.body.data.rows.map((x) => [x.accountCode, x]));
    expect(acc['1102001']).toMatchObject({ openingBalance: 1000000, closingDebit: 1000000 });
    expect(acc['5101001']).toMatchObject({ openingBalance: -1010000, closingCredit: 1010000 });
    expect(r.body.data.summary.balanced).toBe(true);
  });

  it('refuses a go-live date after journals already posted in its fiscal year', async () => {
    expect((await api('post', '/period-end/fiscal-years').send({})).status).toBe(201);
    await withTransaction((db) => createJournal(db, { date: '2027-02-10', description: 'test', status: 'posted',
      lines: [{ accountCode: '1102001', debit: 100, credit: 0 }, { accountCode: '5101001', debit: 0, credit: 100 }] }, { id: null }));
    const r = await upload('/period-end/opening-balances/import', 'tb.csv', { goLiveDate: '2027-03-01' }, tb(GOOD));
    expect(r.status).toBe(409);
    expect(r.body.message).toContain('before the go-live date');
  });

  it('go-live policy upload creates in-force policies without bill, journal or commission; open items load against them once', async () => {
    const pol = await upload('/policies/bulk-upload', 'Policies_Upload_Template.xlsx', { mode: 'go-live' });
    expect(pol.status, JSON.stringify(pol.body)).toBe(200);
    expect(pol.body.data).toMatchObject({ created: 2, failed: 0 });
    const p = (await query('SELECT id, doc->>\'source\' AS source FROM policies WHERE policy_number = \'FPG-FI-2026-004417\'')).rows[0];
    expect(p.source).toBe('go-live-migration');
    expect((await query('SELECT count(*)::int AS n FROM receivables WHERE policy_id = $1', [p.id])).rows[0].n).toBe(0);
    expect((await query('SELECT count(*)::int AS n FROM journal_vouchers WHERE policy_id = $1', [p.id])).rows[0].n).toBe(0);
    expect((await query('SELECT count(*)::int AS n FROM commissions WHERE policy_id = $1', [p.id])).rows[0].n).toBe(0);
    expect((await upload('/policies/bulk-upload', 'x.csv', { mode: 'legacy' }, csvBuffer([['Policy Number'], ['A']]))).status).toBe(400);

    const items = await upload('/receipts/opening-items/import', 'Open_Items_Upload_Template.xlsx', { goLiveDate: '2026-01-01' });
    expect(items.status, JSON.stringify(items.body)).toBe(200);
    expect(items.body.data).toMatchObject({ created: 1, skipped: 0, failed: 0 });
    const rcv = (await query('SELECT * FROM receivables WHERE policy_id = $1', [p.id])).rows[0];
    expect(rcv).toMatchObject({ source: 'opening', reference: 'DN-2026-08812', status: 'partial', booking_jv_id: null });
    expect(Number(rcv.balance)).toBe(40000);
    expect((await query('SELECT count(*)::int AS n FROM collection_items WHERE receivable_id = $1', [rcv.id])).rows[0].n).toBe(1);
    const repeat = await upload('/receipts/opening-items/import', 'Open_Items_Upload_Template.xlsx', { goLiveDate: '2026-01-01' });
    expect(repeat.body.data).toMatchObject({ created: 0, skipped: 1, failed: 0 });
    const otherDate = await upload('/receipts/opening-items/import', 'Open_Items_Upload_Template.xlsx', { goLiveDate: '2026-02-01' });
    expect(otherDate.body.data.errors[0].message).toContain('loaded for go-live date 2026-01-01');
    const unknown = await upload('/receipts/opening-items/import', 'oi.csv', { goLiveDate: '2026-01-01' },
      csvBuffer([['Policy Number', 'Bill Reference', 'Due Date', 'Open Balance'], ['NO-SUCH-POLICY', 'X1', '2026-10-31', '100'], ['FPG-FI-2026-004417', 'X2', '2026-10-31', '0']]));
    expect(unknown.body.data).toMatchObject({ created: 0, failed: 2 });
    expect((await upload('/receipts/opening-items/import', 'Open_Items_Upload_Template.xlsx', {})).status).toBe(400);
  });

  it('a receipt against an open item credits the receivable without booking the bill again', async () => {
    const rcv = (await query('SELECT r.* FROM receivables r WHERE r.source = \'opening\'')).rows[0];
    const r = await api('post', '/receipts').send({ policyId: 'FPG-FI-2026-004417', receivableId: rcv.id, amount: 15000, paymentMode: 'bank-transfer', referenceNo: 'BDO-1' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const after = (await query('SELECT balance, booking_jv_id FROM receivables WHERE id = $1', [rcv.id])).rows[0];
    expect(Number(after.balance)).toBe(25000);
    expect(after.booking_jv_id).toBeNull();
    const sync = await api('post', '/collections/sync').send({});
    expect(sync.status).toBe(200);
    expect((await query('SELECT booking_jv_id FROM receivables WHERE id = $1', [rcv.id])).rows[0].booking_jv_id).toBeNull();
    const booked = (await query(`SELECT count(*)::int AS n FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE j.policy_number = 'FPG-FI-2026-004417' AND l.account_code = '2201001'`)).rows[0].n;
    expect(booked).toBe(0);
  });

  it('the year-end close carries the go-live opening balances forward with the year\'s journals', async () => {
    const income = (await query('SELECT code FROM gl_accounts WHERE account_type = \'income\' AND status = \'active\' ORDER BY code LIMIT 1')).rows[0].code;
    await withTransaction((db) => createJournal(db, { date: '2026-06-30', description: 'fee income', status: 'posted',
      lines: [{ accountCode: '1102001', debit: 5000, credit: 0 }, { accountCode: income, debit: 0, credit: 5000 }] }, { id: null }));
    const cash = Number((await query('SELECT COALESCE(sum(l.debit - l.credit), 0) AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE l.account_code = \'1102001\' AND j.status IN (\'posted\',\'reversed\') AND j.jv_date <= \'2026-12-31\'')).rows[0].b);
    for (const j of (await query('SELECT id FROM journal_vouchers WHERE status IN (\'pending\',\'for-approval\') AND jv_date <= \'2026-12-31\'')).rows) await withTransaction((db) => cancelJournal(db, j.id, { id: null }));
    const ye = (await api('post', '/period-end/year-end').send({ fiscalYear: 'FY2026' })).body.data;
    for (let m = 1; m <= 12; m += 1) {
      const res = await api('post', `/period-end/periods/2026-${String(m).padStart(2, '0')}/status`).send({ status: 'closed', remarks: 'year end' });
      expect(res.status, res.body.message).toBe(200);
    }
    // an Accounting Manager other than the user who started the close closes the year (maker-checker)
    const mgr = await api('post', '/users').send({ username: 'gl.manager', password: 'Welcome@123', displayName: 'GL manager', roles: ['accounting-manager'], email: 'gl.manager@example.ph' });
    expect(mgr.status, JSON.stringify(mgr.body)).toBe(201);
    const token = (await request(app).post('/api/auth/login').send({ username: 'gl.manager', password: 'Welcome@123' })).body.accessToken;
    const closed = await request(app).post(`/api/period-end/year-end/${ye.id}/close`).set('Authorization', `Bearer ${token}`).send({});
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    const ob = Object.fromEntries((await query('SELECT account_code, balance FROM opening_balances WHERE fiscal_year = \'FY2027\'')).rows.map((x) => [x.account_code, Number(x.balance)]));
    expect(ob['1102001']).toBeCloseTo(1000000 + cash, 2);
    expect(ob['2201001']).toBe(-30000);
    const reBooked = Number((await query('SELECT COALESCE(sum(l.debit - l.credit), 0) AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE l.account_code = \'5101001\' AND j.status IN (\'posted\',\'reversed\') AND j.jv_date BETWEEN \'2026-01-01\' AND \'2026-12-31\'')).rows[0].b);
    expect(ob['5101001']).toBeCloseTo(-1010000 + reBooked, 2);
    const total = Object.values(ob).reduce((s, v) => s + v, 0);
    expect(Math.round(total * 100)).toBe(0);
  });
});
