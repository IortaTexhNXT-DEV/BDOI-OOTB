import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeXlsx, colLetter } from '../src/tools/xlsx.js';
import { writePdf } from '../src/tools/pdf.js';
import { toCsv } from '../src/tools/csv.js';
import { collectRoutes } from '../src/tools/export-api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let tmp;
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-tools-')); });
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const unzipText = (file, entry) => execFileSync('unzip', ['-p', file, entry]).toString('utf8');
/** Parse a worksheet into arrays of cell texts (resolving shared strings). */
function readSheet(file, n) {
  const sst = [...unzipText(file, 'xl/sharedStrings.xml').matchAll(/<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g)].map((m) => m[1]);
  const xml = unzipText(file, `xl/worksheets/sheet${n}.xml`);
  return [...xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map((row) => [...row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)><v>([\s\S]*?)<\/v><\/c>/g)]
    .map(([, , attrs, v]) => (attrs.includes('t="s"') ? sst[Number(v)] : Number(v))));
}

describe('file writers', () => {
  it('writes a valid xlsx with typed cells, frozen styled header and autofilter', () => {
    expect([colLetter(0), colLetter(25), colLetter(26), colLetter(701)]).toEqual(['A', 'Z', 'AA', 'ZZ']);
    const file = path.join(tmp, 'a.xlsx');
    fs.writeFileSync(file, writeXlsx({ sheets: [
      { name: 'Data/1', columns: [{ key: 'a', header: 'Name' }, { key: 'b', header: 'Amount', type: 'money' }, { key: 'c', header: 'Date', type: 'date' }], rows: [{ a: 'Tom & "Jerry" <x>', b: 1234.5, c: '2026-01-31' }, { a: 'Ana\u0001', b: null, c: 'n/a' }] },
      { name: 'Data/1', columns: [{ header: 'X' }], rows: [['y']], autoFilter: false },
    ] }));
    expect(execFileSync('unzip', ['-t', file]).toString()).toContain('No errors detected');
    const rows = readSheet(file, 1);
    expect(rows[0]).toEqual(['Name', 'Amount', 'Date']);
    expect(rows[1]).toEqual(['Tom &amp; &quot;Jerry&quot; &lt;x&gt;', 1234.5, 46053]);
    expect(rows[2]).toEqual(['Ana', 'n/a']);
    const xml = unzipText(file, 'xl/worksheets/sheet1.xml');
    expect(xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('<autoFilter ref="A1:C3"/>');
    expect(xml).toContain('<c r="A1" s="1"');
    const wb = unzipText(file, 'xl/workbook.xml');
    expect(wb).toContain('name="Data 1"');
    expect(wb).toContain('name="Data 1 2"');
  });
  it('writes a multi-page PDF with a valid cross-reference table', () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ no: `POL-${i + 1}`, name: `Client (${i}) \\ ₱`, amt: i * 10.5 }));
    const buf = writePdf({ title: 'Test Report', subtitle: 'Period 2026', columns: [{ key: 'no', label: 'No.' }, { key: 'name', label: 'Name' }, { key: 'amt', label: 'Amount', type: 'money' }], rows, totals: { amt: 74970 } });
    const s = buf.toString('latin1');
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    const pages = Number(/\/Count (\d+)/.exec(s)[1]);
    expect(pages).toBeGreaterThan(1);
    const startxref = Number(/startxref\n(\d+)/.exec(s)[1]);
    expect(s.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...s.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(s.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    expect(s).toContain('(Client \\(5\\) \\\\ PHP )');
    expect(s).toContain('(74,970.00)');
  });
  it('writes CSV with quoting and formula-injection guard', () => {
    const csv = toCsv([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: 'x,"y"', b: -5 }, { a: '=HYPERLINK("h")', b: '-12.5' }], { bom: false });
    expect(csv).toBe('A,B\r\n"x,""y""",-5\r\n"\'=HYPERLINK(""h"")",-12.5\r\n');
  });
});

describe('API documentation export', () => {
  let out;
  let result;
  beforeAll(() => {
    out = path.join(tmp, 'api');
    result = JSON.parse(execFileSync(process.execPath, ['src/tools/export-api.js', '--out', out], { cwd: ROOT, env: { ...process.env, PUBLIC_BASE_URL: 'https://api.broker.example' } }).toString());
  }, 60000);

  it('writes every artefact for the modules that exist now', () => {
    expect(result.routes).toBeGreaterThan(10);
    for (const f of ['openapi.json', 'BrokerVerse.postman_collection.json', 'BrokerVerse.postman_environment.json', 'BrokerVerse_API_Touchpoints.xlsx', 'BrokerVerse_API_Touchpoints.csv']) expect(fs.existsSync(path.join(out, f))).toBe(true);
  });
  it('produces an OpenAPI 3.1 document with bearer auth and one operation per route', () => {
    const doc = JSON.parse(fs.readFileSync(path.join(out, 'openapi.json'), 'utf8'));
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers[0].url).toBe('https://api.broker.example/api');
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    const ops = Object.values(doc.paths).flatMap((p) => Object.values(p));
    expect(ops).toHaveLength(result.routes);
    expect(new Set(ops.map((o) => o.operationId)).size).toBe(ops.length);
    const gen = doc.paths['/reports/{code}/generate'].post;
    expect(gen.tags).toEqual(['Reports']);
    expect(gen.parameters[0]).toMatchObject({ name: 'code', in: 'path', required: true });
    expect(gen.requestBody.content['application/json'].example.format).toBe('xlsx');
    expect(gen.responses[200].content['application/json'].example.success).toBe(true);
    expect(doc.paths['/auth/login'].post.security).toEqual([]);
  });
  it('produces a Postman v2.1 collection with a token-storing Login and example responses', () => {
    const col = JSON.parse(fs.readFileSync(path.join(out, 'BrokerVerse.postman_collection.json'), 'utf8'));
    expect(col.info.schema).toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
    expect(col.info._postman_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(col.variable.map((v) => v.key)).toEqual(['baseUrl', 'token']);
    expect(col.auth).toMatchObject({ type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] });
    const [login, ...folders] = col.item;
    expect(login.request.method).toBe('POST');
    expect(JSON.parse(login.request.body.raw)).toMatchObject({ username: '{{username}}', password: '{{password}}' });
    expect(login.event[0].script.exec.join('\n')).toContain("pm.collectionVariables.set('token'");
    const requests = folders.flatMap((f) => f.item);
    expect(requests).toHaveLength(result.routes);
    expect(folders.map((f) => f.name)).toContain('Reports');
    for (const r of requests) {
      expect(r.request.url.raw.startsWith('{{baseUrl}}/')).toBe(true);
      expect(Array.isArray(r.response)).toBe(true);
    }
    const run = folders.find((f) => f.name === 'Reports').item.find((i) => i.request.url.raw.endsWith('/run'));
    expect(run.request.url.variable[0].key).toBe('code');
    expect(run.response[0]).toMatchObject({ code: 200, status: 'OK' });
    const env = JSON.parse(fs.readFileSync(path.join(out, 'BrokerVerse.postman_environment.json'), 'utf8'));
    expect(Object.fromEntries(env.values.map((v) => [v.key, v.value]))).toEqual({ baseUrl: 'https://api.broker.example/api', username: '', password: '', token: '' });
  });
  it('produces a real xlsx: API List, By Screen and Modules sheets, plus a CSV copy', () => {
    const file = path.join(out, 'BrokerVerse_API_Touchpoints.xlsx');
    expect(execFileSync('unzip', ['-t', file]).toString()).toContain('No errors detected');
    const wb = unzipText(file, 'xl/workbook.xml');
    expect([...wb.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]).slice(0, 3)).toEqual(['API List', 'By Screen', 'Modules']);
    const list = readSheet(file, 1);
    expect(list[0]).toEqual(['#', 'Module', 'Method', 'Endpoint', 'Summary', 'Front-end screen (touchpoint)', 'Auth', 'Roles/Permissions', 'Request example', 'Response example']);
    expect(list).toHaveLength(result.routes + 1);
    expect(list.some((r) => r[3] === '/api/reports/:code/generate' && r[2] === 'POST')).toBe(true);
    const sheet1 = unzipText(file, 'xl/worksheets/sheet1.xml');
    expect(sheet1).toContain('state="frozen"');
    expect(sheet1).toContain(`<autoFilter ref="A1:J${result.routes + 1}"/>`);
    expect(sheet1).toMatch(/<col min="4" max="4" width="45"/);
    const mods = readSheet(file, 3);
    expect(mods[mods.length - 1][0]).toBe('TOTAL');
    expect(mods[mods.length - 1][1]).toBe(result.routes);
    const csv = fs.readFileSync(path.join(out, 'BrokerVerse_API_Touchpoints.csv'), 'utf8');
    expect(csv.startsWith('﻿#,Module,Method,Endpoint')).toBe(true);
  });
  it('skips a module that fails to load and still exports the others', async () => {
    const dir = path.join(tmp, 'modules');
    const reg = pathToFileURL(path.join(ROOT, 'src/lib/registry.js')).href;
    fs.mkdirSync(path.join(dir, 'good'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'broken'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'good', 'router.js'), `import { moduleRouter } from '${reg}';\nconst { router, define } = moduleRouter('Good');\ndefine({ method: 'GET', path: '/ping', summary: 'Ping', handler: (q, s) => s.json({}) });\nexport default router;\nexport const mount = '/good';\n`);
    fs.writeFileSync(path.join(dir, 'broken', 'router.js'), 'import { nothing } from "./missing.js";\nexport default nothing;\n');
    const r = await collectRoutes(dir);
    expect(r.routes.map((x) => `${x.method} ${x.path}`)).toContain('GET /good/ping');
    expect(r.skipped.map((s) => s.module)).toContain('broken');
  });
});
