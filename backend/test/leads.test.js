import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { writeXlsx, readXlsx } from '../src/modules/documents/xlsx.js';

let ctx;
let sales;
let finance;
let claims;
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('l.sales', ['sales']);
  finance = await persona('l.finance', ['finance']);
  claims = await persona('l.claims', ['claims']);
});
afterAll(async () => { await pool.end(); });

describe('leads', () => {
  let leadId;
  const body = { firstName: 'Nina', lastName: 'Evangelista', preferredName: 'Nina', DOB: '1992-03-14', gender: 'Female', emailId: 'nina.e@example.ph', contactNumber: '09171239876',
    houseNo: '4 Sampaguita St.', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', country: 'Philippines', zipCode: '1210', leadCategory: 'Retail', lob: 'FIRE', createdBy: 'ignored', favouriteColour: 'blue' };

  it('creates a lead and returns it at the top level and in data', async () => {
    const r = await sales('post', '/leads').send(body);
    expect(r.status).toBe(201);
    expect(r.body.leadId).toMatch(/^ld_/);
    expect(r.body.generatedLeadId).toMatch(/^LD-\d{4}-\d{5}$/);
    expect(r.body.data.leadId).toBe(r.body.leadId);
    expect(r.body.lob).toBe('FIRE');
    expect(r.body.status).toBe('New');
    leadId = r.body.leadId;
    const one = await sales('get', `/leads/${leadId}`);
    expect(one.body).toMatchObject({ firstName: 'Nina', emailId: 'nina.e@example.ph', contactNumber: '09171239876', DOB: '1992-03-14', province: 'Metro Manila', zipCode: '1210', favouriteColour: 'blue', quotationsCount: 0 });
    const byNumber = await sales('get', `/leads/${r.body.generatedLeadId}`);
    expect(byNumber.body.leadId).toBe(leadId);
    const audit = await pool.query("SELECT action FROM audit_log WHERE entity = 'lead' AND entity_id = $1", [leadId]);
    expect(audit.rows.map((x) => x.action)).toContain('create');
  });

  it('validates input', async () => {
    expect((await sales('post', '/leads').send({ lastName: 'Only' })).status).toBe(400);
    const bad = await sales('post', '/leads').send({ firstName: 'X', emailId: 'not-an-email' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].path).toBe('emailId');
  });

  it('lists with paging, filters and search', async () => {
    const all = await sales('get', '/leads?page=1&pageSize=5');
    expect(all.body.data.length).toBe(5);
    expect(all.body.total).toBeGreaterThanOrEqual(17);
    expect(all.body.pageSize).toBe(5);
    const fire = await sales('get', '/leads?lob=FIRE&pageSize=50');
    expect(fire.body.data.every((l) => l.lob === 'FIRE')).toBe(true);
    const corp = await sales('get', '/leads?leadCategory=Corporate&pageSize=50');
    expect(corp.body.data.every((l) => l.leadCategory === 'Corporate')).toBe(true);
    const s = await sales('get', '/leads?query=evangelista');
    expect(s.body.data.map((l) => l.leadId)).toEqual([leadId]);
    const city = await sales('get', '/leads/search?city=makati&pageSize=50');
    expect(city.body.data.every((l) => l.city === 'Makati')).toBe(true);
    const legacy = await sales('get', '/lead/get-all-lead?pageSize=2');
    expect(legacy.body.data.length).toBe(2);
  });

  it('updates a lead', async () => {
    const r = await sales('put', `/leads/${leadId}`).send({ ...body, contactNumber: '09170000000', lastName: 'Evangelista-Cruz', updatedBy: 'x' });
    expect(r.status).toBe(200);
    expect(r.body.contactNumber).toBe('09170000000');
    expect(r.body.fullName).toBe('Nina Evangelista-Cruz');
    expect((await sales('put', '/leads/ld_missing').send({ firstName: 'x' })).status).toBe(404);
  });

  it('computes stats', async () => {
    const r = await sales('get', '/leads/stats');
    expect(r.body.totalLeads).toBeGreaterThanOrEqual(17);
    expect(r.body.convertedLeads).toBeGreaterThanOrEqual(8);
    expect(r.body.leadsWithQuotations).toBeGreaterThanOrEqual(14);
    expect(r.body.conversionRate).toBeGreaterThan(0);
    expect(r.body.leadsByStatus.find((s) => s.status === 'Converted').count).toBeGreaterThanOrEqual(8);
    const f = await sales('get', '/leads/stats?leadCategory=Corporate');
    expect(f.body.totalLeads).toBeLessThan(r.body.totalLeads);
  });

  it('downloads the report as XLSX and CSV', async () => {
    const x = await sales('get', '/leads/report?category=Converted').buffer(true).parse(binary);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    expect(x.headers['content-disposition']).toContain('.xlsx');
    const rows = readXlsx(x.body);
    expect(rows[0][0]).toBe('Lead Number');
    expect(rows.length - 1).toBeGreaterThanOrEqual(8);
    expect(rows.slice(1).every((r) => r[6] === 'Converted')).toBe(true);
    const c = await sales('get', '/leads/report?category=PendingCustomer&format=csv');
    expect(c.headers['content-type']).toContain('text/csv');
    expect(c.text.split('\r\n').length).toBe(2);
  });

  it('bulk uploads CSV and XLSX files', async () => {
    const csv = 'First Name,Last Name,Email,Contact Number,City,Category\nAriel,Gomez,ariel@example.ph,0917111,Pasig,Retail\n"Dela Paz, Jr.",Ronaldo,bad-email,0917222,Manila,Retail\n';
    const r = await sales('post', '/leads/bulk-upload').attach('file', Buffer.from(csv), 'leads.csv');
    expect(r.body.data).toMatchObject({ total: 2, created: 1, failed: 1 });
    expect(r.body.data.errors[0].row).toBe(3);
    const xlsx = writeXlsx(['firstName', 'lastName', 'emailId', 'lob'], [['Hazel', 'Uy', 'hazel@example.ph', 'IAR'], ['Marco', 'Lim', '', 'Motor']]);
    const x = await sales('post', '/leads/bulk-upload').attach('file', xlsx, 'leads.xlsx');
    expect(x.body.data.created).toBe(2);
    const hazel = await sales('get', '/leads?query=hazel@example.ph');
    expect(hazel.body.data[0].lob).toBe('IAR');
    expect((await sales('post', '/leads/bulk-upload')).status).toBe(400);
  });

  it('enforces permissions', async () => {
    expect((await finance('post', '/leads').send(body)).status).toBe(403);
    // claims handlers read the insured's lead (holder details on the claim form) but cannot change leads
    expect((await claims('get', '/leads')).status).toBe(200);
    expect((await claims('post', '/leads').send(body)).status).toBe(403);
    expect((await request(ctx.app).get('/api/leads')).status).toBe(401);
  });

  it('soft-deletes a lead, but not one with an issued policy', async () => {
    const d = await sales('delete', `/leads/${leadId}`);
    expect(d.status).toBe(200);
    expect((await sales('get', `/leads/${leadId}`)).status).toBe(404);
    expect((await pool.query('SELECT deleted_at FROM leads WHERE id = $1', [leadId])).rows[0].deleted_at).not.toBeNull();
    expect((await sales('delete', '/leads/ld_sls_01')).status).toBe(400);
  });
});
