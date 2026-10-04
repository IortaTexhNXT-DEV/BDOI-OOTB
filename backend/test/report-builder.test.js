import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, createOwnBookRole } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { biExtract } from '../src/modules/report-builder/service.js';
import { resolveKey } from '../src/modules/uploads/storage.js';
import { readXlsx } from '../src/modules/documents/xlsx.js';

let ctx;
let sales;
let accounting;
let own;
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('rb.sales', ['sales']);
  accounting = await persona('rb.accounting', ['accounting']);
  await createOwnBookRole(ctx.api);
  await ctx.api('post', '/roles').send({ code: 'rb-own', name: 'Own book reports', permissions: ['read:reports', 'read:policies', 'read:profile'] });
  await ctx.api('put', '/settings').send({ settings: { 'security.scoped_roles': ['own-book', 'rb-own'] } });
  own = await persona('rb.own', ['rb-own']);
});
afterAll(async () => { await pool.end(); });

describe('report builder', () => {
  it('offers the datasets the user may read', async () => {
    const s = (await sales('get', '/report-builder/datasets')).body.data.map((d) => d.key);
    expect(s).toEqual(expect.arrayContaining(['policies', 'clients', 'claims']));
    expect(s).not.toContain('bills');
    const a = (await accounting('get', '/report-builder/datasets')).body.data.map((d) => d.key);
    expect(a).toEqual(expect.arrayContaining(['bills', 'commissions']));
    expect((await sales('post', '/report-builder/run').send({ dataset: 'bills' })).status).toBe(403);
  });

  it('runs columns with filters, and grouping with totals', async () => {
    const all = (await pool.query("SELECT count(*)::int AS n, sum(premium_total) AS p FROM policies WHERE lob = 'MOTOR'")).rows[0];
    const r = await sales('post', '/report-builder/run').send({ dataset: 'policies', columns: ['policyNumber', 'insurer', 'grossPremium'], filters: [{ column: 'lob', op: 'eq', value: 'motor' }],
      sort: [{ column: 'grossPremium', dir: 'desc' }] });
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(all.n);
    expect(r.body.data.totals.grossPremium).toBeCloseTo(Number(all.p), 2);
    expect(r.body.data.rows[0].grossPremium).toBeGreaterThanOrEqual(r.body.data.rows[r.body.data.rows.length - 1].grossPremium);
    const g = await sales('post', '/report-builder/run').send({ dataset: 'policies', columns: ['insurer', 'policies', 'grossPremium', 'policyNumber'], groupBy: ['insurer'] });
    expect(g.body.data.columns.map((c) => c.key)).toEqual(['insurer', 'policies', 'grossPremium']);
    expect(g.body.data.rows.reduce((s, x) => s + x.policies, 0)).toBe((await pool.query('SELECT count(*)::int AS n FROM policies')).rows[0].n);
    const between = await sales('post', '/report-builder/run').send({ dataset: 'policies', columns: ['policyNumber'], filters: [{ column: 'grossPremium', op: 'between', value: 1, value2: 20000 }] });
    expect(between.status).toBe(200);
    expect((await sales('post', '/report-builder/run').send({ dataset: 'policies', columns: ['nope'] })).status).toBe(400);
    expect((await sales('post', '/report-builder/run').send({ dataset: 'policies', filters: [{ column: 'grossPremium', op: 'contains', value: '1' }] })).status).toBe(400);
  });

  it('limits a scoped user to their own book', async () => {
    const r = await own('post', '/report-builder/run').send({ dataset: 'policies', columns: ['policyNumber'] });
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(0);
  });

  it('exports to Excel with a totals row', async () => {
    const x = await sales('post', '/report-builder/export').send({ dataset: 'policies', columns: ['insurer', 'grossPremium'], groupBy: ['insurer'], name: 'Premium by insurer' }).buffer(true).parse(binary);
    expect(x.status).toBe(200);
    expect(x.headers['content-disposition']).toMatch(/Premium-by-insurer\.xlsx/);
    const rows = readXlsx(x.body);
    expect(rows[0]).toEqual(['Insurer', 'Gross Premium']);
    expect(rows[rows.length - 1][0]).toBe('Total');
  });

  it('saves reports private or shared with roles; only the owner changes them', async () => {
    const s = await sales('post', '/report-builder/reports').send({ name: 'My motor book', dataset: 'policies', columns: ['policyNumber', 'grossPremium'], filters: [{ column: 'lob', op: 'eq', value: 'MOTOR' }] });
    expect(s.status).toBe(201);
    const mine = s.body.data.id;
    expect((await accounting('get', '/report-builder/reports')).body.data.some((r) => r.id === mine)).toBe(false);
    await sales('put', `/report-builder/reports/${mine}`).send({ sharedRoles: ['accounting'] });
    expect((await accounting('get', '/report-builder/reports')).body.data.some((r) => r.id === mine)).toBe(true);
    expect((await accounting('put', `/report-builder/reports/${mine}`).send({ name: 'hijack' })).status).toBe(403);
    expect((await sales('put', `/report-builder/reports/${mine}`).send({ sharedRoles: ['no-such-role'] })).status).toBe(400);
    const run = await accounting('post', `/report-builder/reports/${mine}/run`);
    expect(run.status).toBe(200);
    expect(run.body.data.report.name).toBe('My motor book');
    const xl = await accounting('get', `/report-builder/reports/${mine}/export?format=csv`);
    expect(xl.text.split('\r\n')[0]).toMatch(/Policy No\.,Gross Premium/);
    // the sample report is shared with sales
    expect((await sales('get', '/report-builder/reports')).body.data.some((r) => r.name === 'Premium by insurer')).toBe(true);
    expect((await sales('delete', `/report-builder/reports/${mine}`)).status).toBe(200);
  });

  it('the BI extract writes one CSV per dataset to the storage folder', async () => {
    const out = await biExtract();
    expect(out.files).toBe(5);
    const run = await ctx.api('get', '/report-builder/bi-extract/runs');
    const last = run.body.data[0];
    expect(last.status).toBe('done');
    expect(last.folder).toMatch(/^bi-extract\/\d{4}-\d{2}-\d{2}$/);
    const pol = last.files.find((f) => f.dataset === 'policies');
    const text = fs.readFileSync(resolveKey(pol.key), 'utf8');
    expect(text.split('\r\n')[0]).toMatch(/policyNumber,status/);
    expect(text.split('\r\n').length - 1).toBe(pol.rows);
    const manual = await ctx.api('post', '/report-builder/bi-extract/run');
    expect(manual.body.data.trigger).toBe('manual');
    expect((await sales('post', '/report-builder/bi-extract/run')).status).toBe(403);
  });
});
