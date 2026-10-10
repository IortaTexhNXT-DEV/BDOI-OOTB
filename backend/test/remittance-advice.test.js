import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, remittanceBody } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
let sales;
beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'ad.sales', password: 'Welcome@123', displayName: 'Adela Sales', roles: ['sales'] });
  sales = await loginAs(ctx.app, 'ad.sales', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });
const as = (tok, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);
const binary = (r) => r.buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });

describe('remittance advice (Accounts > Remittance > Tracking > Print)', () => {
  it('prints the remittance on the letterhead with its policies and signatures; the agency bill keeps its own title', async () => {
    const c = await ctx.api('post', '/remittance/remittances').send(await remittanceBody({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo: 'EXT-ADV-1', premium: 12000, commission: 1800, tax: 0 }] }));
    expect(c.status).toBe(201);
    const { id, remittanceNo } = c.body.data;
    const r = await binary(ctx.api('get', `/remittance/remittances/${id}/pdf`));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/application\/pdf/);
    expect(r.headers['content-disposition']).toMatch(/^inline/);
    const text = r.body.toString('latin1');
    expect(text.slice(0, 5)).toBe('%PDF-');
    for (const s of ['Remittance Advice', `No. ${remittanceNo}`, 'EXT-ADV-1', 'Malayan Insurance Co., Inc.', 'Prepared by', 'Approved by']) expect(text).toContain(`(${s}`);

    const agency = (await pool.query("SELECT id FROM remittances WHERE kind = 'agency-bill' LIMIT 1")).rows[0];
    const a = await binary(ctx.api('get', `/remittance/remittances/${agency.id}/pdf?download=1`));
    expect(a.headers['content-disposition']).toMatch(/^attachment/);
    expect(a.body.toString('latin1')).toContain('(Agency Bill');

    await pool.query("UPDATE app_settings SET value = '\"Insurer Remittance Advice\"' WHERE key = 'remittance.advice_title'");
    clearSettingsCache();
    expect((await binary(ctx.api('get', `/remittance/remittances/${id}/pdf`))).body.toString('latin1')).toContain('(Insurer Remittance Advice');
    expect((await ctx.api('get', '/remittance/remittances/rm_missing/pdf')).status).toBe(404);
    expect((await as(sales, 'get', `/remittance/remittances/${id}/pdf`)).status).toBe(403);
  });
});

describe('remittance advice letter (Remittances > Download advice)', () => {
  it('prints the portrait letter beside the print of earlier releases; before payment the amount paid is empty', async () => {
    const c = await ctx.api('post', '/remittance/remittances').send(await remittanceBody({ insurerCode: 'MALAYAN', period: '2026-10', lines: [{ policyNo: 'EXT-ADV-2', premium: 15000, commission: 2250, tax: 0 }] }));
    const { id, remittanceNo } = c.body.data;
    const r = await binary(ctx.api('get', `/remittance/remittances/${id}/advice.pdf`));
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(new RegExp(`^attachment; filename="${remittanceNo}_Advice_\\d{8}\\.pdf"`));
    const text = r.body.toString('latin1');
    for (const s of ['Insurer Remittance Advice', `No. ${remittanceNo}`, 'Malayan Insurance Co., Inc.', 'Reference', 'Total premium', 'Due to insurer', '12,750.00', 'Amount paid', 'Schedule attached.']) {
      expect(text).toContain(`(${s}`);
    }
    // the letter has no policy list and no payment block before a voucher is raised
    expect(text).not.toContain('(EXT-ADV-2');
    expect(text).not.toContain('(Voucher no.');
    expect((await binary(ctx.api('get', `/remittance/remittances/${id}/advice.pdf?download=0`))).headers['content-disposition']).toMatch(/^inline/);
    expect((await as(sales, 'get', `/remittance/remittances/${id}/advice.pdf`)).status).toBe(403);
  });
});

describe('letterhead for pages printed from the browser', () => {
  it('returns the company, the document colours and the logo as a data URL to any signed-in user', async () => {
    const r = await as(sales, 'get', '/document-templates/letterhead');
    expect(r.status).toBe(200);
    expect(r.body.data.name).toBeTruthy();
    expect(Array.isArray(r.body.data.addressLines)).toBe(true);
    expect(r.body.data.documents.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(r.body.data.generatedBy).toBe('Adela Sales');
    if (r.body.data.logo) expect(r.body.data.logo).toMatch(/^data:image\/(png|jpeg);base64,/);
    expect((await request(ctx.app).get('/api/document-templates/letterhead')).status).toBe(401);
  });
});
