/**
 * Environment comparison of the Go-Live Data Workbench (POST /data-load/comparisons): the
 * configuration workbook exported from another environment compared with this one, or two exports with each other,
 * never loaded. Identical environment (Mirrored), exact field difference, rows only in the file / only here,
 * environment-specific fields set apart (numbering counters with the toggle), file A vs file B without reading or
 * changing this environment, the comparison workbook, the permission and the release pipeline script.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { pool, one } from '../src/db/pool.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { readWorkbook, readZip } from '../src/modules/documents/xlsx.js';
import { catalogueOf, compareWorkbooks } from '../src/modules/data-load/compare.js';
import { compareEnvironments } from '../scripts/compare-environments.js';
import { loginAs } from './helpers.js';

let app;
let api;
let current;
let kit;

const bin = (req) => req.buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});

/**
 * Edit an exported workbook: fn receives { set(sheet, match, header, value), remove(sheet, match), append(sheet, values) }
 * where match(row) gets the row as { header: value } (headers without the " *" of required columns).
 */
function edit(buffer, fn) {
  const sheets = readWorkbook(buffer).map((s) => ({ name: s.name, rows: s.rows.map((r) => [...r]) }));
  const sheetOf = (name) => sheets.find((s) => s.name === name);
  const headers = (s) => s.rows[0].map((h) => String(h ?? '').replace(/ \*$/, ''));
  const asObject = (s, r) => Object.fromEntries(headers(s).map((h, i) => [h, r[i] ?? '']));
  const find = (name, match) => {
    const s = sheetOf(name);
    const i = s.rows.findIndex((r, ri) => ri >= 2 && match(asObject(s, r)));
    if (i < 0) throw new Error(`no matching row in ${name}`);
    return { s, i };
  };
  fn({
    set(name, match, header, value) {
      const { s, i } = find(name, match);
      s.rows[i][headers(s).indexOf(header)] = value;
    },
    remove(name, match) {
      const { s, i } = find(name, match);
      s.rows.splice(i, 1);
    },
    append(name, values) {
      const s = sheetOf(name);
      s.rows.push(headers(s).map((h) => values[h] ?? ''));
    },
  });
  return writeXlsx({ sheets: sheets.map((s) => ({ name: s.name, columns: (s.rows[0] || []).map((h) => ({ header: String(h ?? '') })), rows: s.rows.slice(1) })) });
}

const exportNow = async () => (await bin(api('get', '/data-load/kits/configuration/template?prefill=true'))).body;
const compare = (file, { fileB = null, includeNumbering = false, as = api } = {}) => {
  let r = as('post', '/data-load/compare').field('includeNumbering', String(includeNumbering)).attach('file', file, 'Other_configuration.xlsx');
  if (fileB) r = r.attach('fileB', fileB, 'File_B_configuration.xlsx');
  return r;
};
const rowsOf = async (id, query = '') => (await api('get', `/data-load/compare/${id}/rows${query}`)).body;

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
  kit = (await api('get', '/data-load/kits')).body.data.kits.find((k) => k.kit === 'configuration');
  current = await exportNow();
});
afterAll(async () => {
  await pool.end();
});

describe('compare an export with this environment', () => {
  it('an export of this same environment is Mirrored: every row identical, nothing loaded', async () => {
    const batches = (await one('SELECT count(*)::int AS n FROM data_load_batches')).n;
    const r = await compare(current);
    expect(r.status).toBe(201);
    const c = r.body.data;
    expect(c.mode).toBe('environment');
    expect(c.verdict).toBe('mirrored');
    expect(r.body.message).toBe('Mirrored');
    expect(c.totals.different + c.totals.onlyInFile + c.totals.onlyHere).toBe(0);
    expect(c.totals.identical).toBeGreaterThan(100);
    expect(c.totals.identical).toBe(c.totals.inFile);
    expect(c.sheets.find((s) => s.sheet === 'users').identical).toBe(1);
    // the result is kept and audited; no load batch is created
    expect((await one('SELECT count(*)::int AS n FROM data_load_batches')).n).toBe(batches);
    const audit = await one("SELECT action, after_data FROM audit_log WHERE entity = 'data_load_comparison' AND entity_id = $1", [String(c.id)]);
    expect(audit.action).toBe('compare');
    expect(audit.after_data.verdict).toBe('mirrored');
    const got = (await api('get', `/data-load/compare/${c.id}`)).body.data;
    expect(got.verdictText).toBe('Mirrored');
    expect(got.rules.map((x) => x.id)).toEqual(expect.arrayContaining(['cutover-date', 'urls-hosts', 'email-sender', 'payment-gateway-mode', 'numbering-counters']));
    expect((await rowsOf(c.id)).total).toBe(0);
    expect((await rowsOf(c.id, '?status=identical&sheet=users')).data[0].key).toBe('BrokerVerse');
  });

  it('a changed field is reported with the exact column, value in the file and value here', async () => {
    const file = edit(current, (b) => b.set('Write-off Reasons', () => true, 'Reason', 'Changed in UAT'));
    const reason = readWorkbook(current).find((s) => s.name === 'Write-off Reasons').rows[2];
    const r = await compare(file);
    const c = r.body.data;
    expect(c.verdict).toBe('differences');
    expect(c.totals).toMatchObject({ different: 1, onlyInFile: 0, onlyHere: 0 });
    expect(c.sheets.find((s) => s.sheet === 'master:write-off-reason')).toMatchObject({ different: 1 });
    const rows = await rowsOf(c.id);
    expect(rows.total).toBe(1);
    expect(rows.data[0]).toMatchObject({ sheet: 'master:write-off-reason', sheetName: 'Write-off Reasons', key: reason[0], status: 'different', rowFile: 3 });
    expect(rows.data[0].differences).toEqual([{ column: 'name', header: 'Reason', file: 'Changed in UAT', here: reason[1] }]);
  });

  it('rows only in the file (would be new here) and only here (missing from the file)', async () => {
    const lob = readWorkbook(current).find((s) => s.name === 'Lines of Business').rows[2];
    const file = edit(current, (b) => {
      b.append('Write-off Reasons', { 'Reason Code': 'ZZ-UAT', Reason: 'Only in UAT', 'GL Account': '6999001', Status: 'Active' });
      b.remove('Lines of Business', (row) => row['Line of Business Code'] === lob[0]);
    });
    const c = (await compare(file)).body.data;
    expect(c.verdict).toBe('differences');
    expect(c.totals).toMatchObject({ different: 0, onlyInFile: 1, onlyHere: 1 });
    const onlyFile = (await rowsOf(c.id, '?status=only-in-file')).data;
    expect(onlyFile).toHaveLength(1);
    expect(onlyFile[0]).toMatchObject({ sheetName: 'Write-off Reasons', key: 'ZZ-UAT', status: 'only-in-file' });
    expect(onlyFile[0].file).toMatchObject({ code: 'ZZ-UAT', name: 'Only in UAT' });
    const onlyHere = (await rowsOf(c.id, '?status=only-here')).data;
    expect(onlyHere).toHaveLength(1);
    expect(onlyHere[0]).toMatchObject({ sheetName: 'Lines of Business', key: lob[0], status: 'only-here' });
    // filters: sheet and search
    expect((await rowsOf(c.id, '?sheet=master:line-of-business')).total).toBe(1);
    expect((await rowsOf(c.id, '?search=only%20in%20uat')).data.map((x) => x.key)).toEqual(['ZZ-UAT']);
  });

  it('environment-specific fields are listed apart, not as differences; numbering counters with the toggle', async () => {
    const file = edit(current, (b) => {
      b.set('Settings', (row) => row['Setting Key'] === 'golive.cutover_date', 'Value', '2026-12-01');
      b.set('Settings', (row) => row['Setting Key'] === 'general.frontend_url', 'Value', 'https://uat.broker.example');
      b.set('Settings', (row) => row['Setting Key'] === 'notification.from_address', 'Value', 'BrokerVerse UAT <uat@broker.example>');
      b.set('Settings', (row) => row['Setting Key'] === 'policy.payment_gateway_url', 'Value', 'https://sandbox.gateway.example');
      b.set('Numbering', (row) => row['Series Code'] === 'policy', 'Next Number', '4321');
    });
    const c = (await compare(file)).body.data;
    expect(c.verdict).toBe('mirrored');
    expect(c.totals.different).toBe(0);
    expect(c.totals.environmentSpecific).toBe(5);
    const env = (await api('get', `/data-load/compare/${c.id}`)).body.data.environmentSpecific;
    const byKey = Object.fromEntries(env.map((e) => [e.key, e]));
    expect(byKey['golive.cutover_date']).toMatchObject({ sheetName: 'Settings', header: 'Value', file: '2026-12-01', here: '', rule: 'cutover-date' });
    expect(byKey['general.frontend_url']).toMatchObject({ file: 'https://uat.broker.example', rule: 'urls-hosts' });
    expect(byKey['notification.from_address'].rule).toBe('email-sender');
    expect(byKey['policy.payment_gateway_url'].rule).toBe('urls-hosts');
    expect(byKey.policy).toMatchObject({ sheetName: 'Numbering', header: 'Next Number', file: '4321', rule: 'numbering-counters' });

    // "include numbering counters": the next number is a difference
    const withCounters = (await compare(file, { includeNumbering: true })).body.data;
    expect(withCounters.verdict).toBe('differences');
    expect(withCounters.totals).toMatchObject({ different: 1, environmentSpecific: 4 });
    const d = (await rowsOf(withCounters.id)).data[0];
    expect(d).toMatchObject({ sheetName: 'Numbering', key: 'policy' });
    expect(d.differences).toEqual([expect.objectContaining({ header: 'Next Number', file: '4321' })]);
    expect((await api('get', `/data-load/compare/${withCounters.id}`)).body.data.rules.find((x) => x.id === 'numbering-counters').applied).toBe(false);
  });
});

describe('compare two files (file A vs file B)', () => {
  it('compares two exports without reading or changing this environment', async () => {
    const fileB = edit(current, (b) => {
      b.set('Write-off Reasons', () => true, 'Reason', 'Production wording');
      b.append('Write-off Reasons', { 'Reason Code': 'ZZ-PROD', Reason: 'Production only', 'GL Account': '6999001', Status: 'Active' });
    });
    // this environment differs from both files: a file vs file comparison must not see it
    await api('put', '/settings').send({ settings: { 'general.frontend_url': 'http://this-environment.example' } });
    const before = await one(`SELECT (SELECT count(*) FROM master_records)::int AS masters, (SELECT md5(string_agg(key || value::text, ',' ORDER BY key)) FROM app_settings) AS settings,
      (SELECT count(*) FROM data_load_batches)::int AS batches`);
    const r = await compare(current, { fileB });
    expect(r.status).toBe(201);
    const c = r.body.data;
    expect(c).toMatchObject({ mode: 'files', fileName: 'Other_configuration.xlsx', fileBName: 'File_B_configuration.xlsx', verdict: 'differences' });
    expect(c.labels).toEqual({ file: 'File A', here: 'File B' });
    expect(c.totals).toMatchObject({ different: 1, onlyInFile: 0, onlyHere: 1, environmentSpecific: 0 });
    const after = await one(`SELECT (SELECT count(*) FROM master_records)::int AS masters, (SELECT md5(string_agg(key || value::text, ',' ORDER BY key)) FROM app_settings) AS settings,
      (SELECT count(*) FROM data_load_batches)::int AS batches`);
    expect(after).toEqual(before);
    // the engine alone (as the pipeline script runs it): same result, no database
    const offline = compareWorkbooks(current, fileB, catalogueOf(kit.sheets));
    expect(offline.verdict).toBe('differences');
    expect(offline.totals).toMatchObject({ different: 1, onlyHere: 1, onlyInFile: 0 });
    expect(offline.rows.find((x) => x.status === 'only-here').key).toBe('ZZ-PROD');
    expect(compareWorkbooks(current, current, catalogueOf(kit.sheets)).verdict).toBe('mirrored');
    await api('put', '/settings').send({ settings: { 'general.frontend_url': 'http://localhost:3000' } });
  });

  it('refuses a file that is not a configuration workbook', async () => {
    const r = await compare(writeXlsx({ sheets: [{ name: 'Something', columns: [{ header: 'A' }], rows: [['1']] }] }));
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/none of the sheets/);
    expect((await api('post', '/data-load/compare')).status).toBe(400);
  });
});

describe('comparison workbook', () => {
  it('Summary with the verdict, one sheet per object with a Difference column, colour coding, navy frozen header', async () => {
    const file = edit(current, (b) => {
      b.set('Write-off Reasons', () => true, 'Reason', 'Changed in UAT');
      b.append('Write-off Reasons', { 'Reason Code': 'ZZ-UAT', Reason: 'Only in UAT', 'GL Account': '6999001', Status: 'Active' });
      b.set('Settings', (row) => row['Setting Key'] === 'golive.cutover_date', 'Value', '2026-12-01');
    });
    const c = (await compare(file)).body.data;
    const res = await bin(api('get', `/data-load/compare/${c.id}/workbook`));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/GoLive_Environment_Comparison_\d+_\d{4}-\d{2}-\d{2}\.xlsx/);
    const book = readWorkbook(res.body);
    const names = book.map((s) => s.name);
    expect(names[0]).toBe('Summary');
    expect(names).toEqual(expect.arrayContaining(['Write-off Reasons', 'Settings', 'Users', 'Environment-specific', 'Rules']));
    const summary = book[0].rows;
    expect(summary.find((r) => r[0] === 'Verdict')[1]).toBe('Differences found');
    const all = summary.find((r) => r[0] === 'All sheets');
    expect(all[8]).toBe('Differences found');
    expect(summary.find((r) => r[0] === 'Write-off Reasons').slice(4, 7).map(Number)).toEqual([1, 1, 0]);
    expect(summary.find((r) => r[0] === 'Users')[8]).toBe('Mirrored');
    const wo = book.find((s) => s.name === 'Write-off Reasons').rows;
    expect(wo[0].at(-1)).toBe('Difference');
    expect(wo[1].at(-1)).toMatch(/^Different: Reason: File "Changed in UAT" \/ This environment "/);
    expect(wo.find((r) => r[0] === 'ZZ-UAT').at(-1)).toBe('Only in File');
    expect(wo.filter((r) => r.at(-1) === 'Identical').length).toBe(3);
    expect(book.find((s) => s.name === 'Environment-specific').rows[1].slice(0, 5)).toEqual(['Settings', 'golive.cutover_date', 'Value', '2026-12-01', '']);
    // styles: navy header (8), frozen first row; changed cell (14), only-in-file row (12)
    const zip = readZip(res.body);
    const sheetXml = zip.get(`xl/worksheets/sheet${names.indexOf('Write-off Reasons') + 1}.xml`);
    expect(sheetXml).toMatch(/<c r="A1" s="8"/);
    expect(sheetXml).toMatch(/state="frozen"/);
    expect(sheetXml).toMatch(/<c r="B2" s="14"/);
    expect(sheetXml).toMatch(/<c r="A\d+" s="12" t="s">/);
    expect(zip.get('xl/styles.xml')).toMatch(/FF0B2A4A/);
  });

  it('lists the comparisons made', async () => {
    const r = await api('get', '/data-load/compare?perPage=2');
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThanOrEqual(5);
    expect(r.body.data).toHaveLength(2);
    expect(r.body.data[0]).toHaveProperty('verdict');
    expect((await api('get', '/data-load/compare/999999')).status).toBe(404);
  });
});

describe('permission', () => {
  it('needs read:data-load (403 otherwise)', async () => {
    const u = await api('post', '/users').send({ username: 'cmp.accounting', password: 'Welcome@123', displayName: 'Compare Accounting', email: 'cmp.acc@example.ph', roles: ['accounting'], mustChangePassword: false });
    expect(u.status).toBe(201);
    const token = await loginAs(app, 'cmp.accounting', 'Welcome@123');
    const as = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
    expect((await compare(current, { as })).status).toBe(403);
    expect((await as('get', '/data-load/compare')).status).toBe(403);
    expect((await as('get', '/data-load/compare/1')).status).toBe(403);
    expect((await as('get', '/data-load/compare/1/rows')).status).toBe(403);
    expect((await as('get', '/data-load/compare/1/workbook')).status).toBe(403);
    await api('delete', `/users/${u.body.data.userId || u.body.data.id}`);
  });
});

describe('release pipeline script (scripts/compare-environments.js)', () => {
  let server;
  let base;
  let dir;
  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((resolve) => { server.once('listening', resolve); });
    base = `http://127.0.0.1:${server.address().port}/api`;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-env-'));
  });
  afterAll(async () => {
    await new Promise((resolve) => { server.close(resolve); });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns 0 when the two environments are mirrored and 1 when they differ, and writes the workbook', async () => {
    const lines = [];
    const env = { SOURCE_API: base, TARGET_API: base, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, COMPARE_OUTPUT: path.join(dir, 'same.xlsx') };
    const same = await compareEnvironments(env, { print: (l) => lines.push(l) });
    expect(same.code).toBe(0);
    expect(lines.join('\n')).toMatch(/^Mirrored: \d+ identical, 0 different/m);
    expect(lines.join('\n')).not.toContain(process.env.ADMIN_PASSWORD);
    expect(readWorkbook(fs.readFileSync(env.COMPARE_OUTPUT))[0].rows.find((r) => r[0] === 'Verdict')[1]).toBe('Mirrored');

    const changed = path.join(dir, 'source.xlsx');
    fs.writeFileSync(changed, edit(current, (b) => b.set('Write-off Reasons', () => true, 'Reason', 'Changed in UAT')));
    const out = [];
    const diff = await compareEnvironments({ SOURCE_FILE: changed, TARGET_API: base, TARGET_ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, COMPARE_OUTPUT: path.join(dir, 'diff.xlsx') }, { print: (l) => out.push(l) });
    expect(diff.code).toBe(1);
    expect(out.join('\n')).toMatch(/Write-off Reasons \S+: Reason: "Changed in UAT"/);
    const summary = readWorkbook(fs.readFileSync(path.join(dir, 'diff.xlsx')))[0].rows;
    expect(summary[0]).toContain('Only in SOURCE');
    expect(summary.find((r) => r[0] === 'Verdict')[1]).toBe('Differences found');

    const bad = await compareEnvironments({ SOURCE_FILE: changed, TARGET_API: base, TARGET_ADMIN_PASSWORD: 'wrong-password' }, { print: () => {} });
    expect(bad.code).toBe(2);
  });
});
