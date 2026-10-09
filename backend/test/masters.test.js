import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let salesToken;
beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'm.sales', password: 'Welcome@123', displayName: 'M Sales', roles: ['sales'] });
  salesToken = await loginAs(ctx.app, 'm.sales', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });
const as = (tok, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);

describe('masters catalogue', () => {
  it('lists every master screen with field definitions and counts', async () => {
    const r = await ctx.api('get', '/masters');
    expect(r.status).toBe(200);
    const codes = r.body.data.map((t) => t.code);
    for (const c of ['company', 'branch', 'insurance-company', 'line-of-business', 'product', 'cover', 'signatory', 'vehicle', 'country', 'state', 'city', 'commission', 'hierarchy', 'designation', 'employee',
      'transaction-code', 'currency', 'exchange-rate', 'bank', 'account-category', 'main-account', 'sub-account', 'taxation', 'petty-cash', 'remittance-automated', 'remittance-analytics-config']) expect(codes).toContain(c);
    expect(r.body.data.find((t) => t.code === 'country').count).toBeGreaterThanOrEqual(5);
    expect(r.body.data.find((t) => t.code === 'taxation').fields.find((f) => f.name === 'taxRate')).toMatchObject({ type: 'number', required: true });
    const fin = await ctx.api('get', '/masters?category=remittance');
    expect(fin.body.data).toHaveLength(16);
  });
  it('delivers a designation in the Designation master for every broker role and the compliance officer of the Compliance department', async () => {
    const rows = (await ctx.api('get', '/masters/designation?perPage=100')).body.data;
    const names = rows.map((r) => r.designationName);
    for (const d of ['System Administrator', 'Account Executive', 'Placement Officer', 'Client Service Officer', 'Claims Officer', 'Accounting Officer', 'Accounting Manager', 'Compliance Officer']) expect(names).toContain(d);
    expect(rows.find((r) => r.designationName === 'Compliance Officer')).toMatchObject({ designationCode: 'DSG-CPO', departmentCode: 'CMP' });
    const depts = (await ctx.api('get', '/masters/department?perPage=100')).body.data.map((r) => r.DepartmentCode);
    expect(depts).toContain('CMP');
  });
});

describe('signatories master (order summary Authorized Signature)', () => {
  it('lists the seeded signatories with name and position, and a sales user reads them as dropdown options', async () => {
    const list = await ctx.api('get', '/masters/signatory');
    expect(list.status).toBe(200);
    const byName = Object.fromEntries(list.body.data.map((s) => [s.signatoryName, s]));
    expect(byName['Maria Regina Cruz']).toMatchObject({ designation: 'President & CEO', status: 'Active' });
    expect(byName['Maria Regina Cruz'].signatoryCode).toMatch(/^SIG-\d{3}$/);
    const opts = await as(salesToken, 'get', '/masters/signatory/options');
    expect(opts.status).toBe(200);
    expect(opts.body.data.map((o) => o.value)).toEqual(expect.arrayContaining(['Maria Regina Cruz', 'Jose Antonio Reyes', 'Ana Patricia Lim']));
    expect(opts.body.data.map((o) => o.value)).not.toContain('JACINTO');
  });

  it('a signatory added under Master is offered; an inactive one is not', async () => {
    const c = await ctx.api('post', '/masters/signatory').send({ signatoryCode: 'SIG-900', signatoryName: 'Carmela Santos', signatoryDescription: 'Operations Head', designation: 'Operations Head' });
    expect(c.status).toBe(201);
    let opts = await as(salesToken, 'get', '/masters/signatory/options');
    expect(opts.body.data.map((o) => o.value)).toContain('Carmela Santos');
    expect((await ctx.api('patch', `/masters/signatory/${c.body.data.id}/status`).send({ status: 'Inactive' })).status).toBe(200);
    opts = await as(salesToken, 'get', '/masters/signatory/options');
    expect(opts.body.data.map((o) => o.value)).not.toContain('Carmela Santos');
  });
});

describe('generic master (company)', () => {
  let id;
  it('creates, reads, searches, updates and deactivates', async () => {
    const body = { CompanyCode: 'TST', CompanyName: 'Test Brokers Inc.', LicenseNumber: 'IC-1', EmailID: 'a@b.example', PhoneNumber: '+63 2 1', City: 'Makati', State: 'Metro Manila', Country: 'Philippines' };
    const c = await ctx.api('post', '/masters/company').send(body);
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ ...body, status: 'Active' });
    id = c.body.data.id;
    expect((await ctx.api('get', `/masters/company/${id}`)).body.data.CompanyName).toBe('Test Brokers Inc.');
    const s = await ctx.api('get', '/masters/company?search=test brokers');
    expect(s.body.total).toBe(1);
    const f = await ctx.api('get', '/masters/company?City=makati&perPage=2&page=1');
    expect(f.body.data.length).toBeLessThanOrEqual(2);
    expect(f.body.totalPages).toBeGreaterThanOrEqual(1);
    const u = await ctx.api('put', `/masters/company/${id}`).send({ Fax: '+63 2 2' });
    expect(u.body.data).toMatchObject({ Fax: '+63 2 2', CompanyCode: 'TST' });
    const st = await ctx.api('patch', `/masters/company/${id}/status`).send({ status: 'Inactive' });
    expect(st.body.data.status).toBe('Inactive');
    const opts = await ctx.api('get', '/masters/company/options');
    expect(opts.body.data.some((o) => o.code === 'TST')).toBe(false);
    const d = await ctx.api('delete', `/masters/company/${id}`);
    expect(d.status).toBe(200);
    expect((await ctx.api('get', `/masters/company/${id}`)).status).toBe(404);
  });
  it('validates required fields, types and duplicate codes', async () => {
    const r = await ctx.api('post', '/masters/company').send({ CompanyCode: 'X' });
    expect(r.status).toBe(400);
    // licence, e-mail and phone are optional (the letterhead prints what is filled in); the name is required
    expect(r.body.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['CompanyName']));
    const badEmail = await ctx.api('post', '/masters/company').send({ CompanyCode: 'X2', CompanyName: 'X2', EmailID: 'not-an-email' });
    expect(badEmail.body.errors.map((e) => e.path)).toEqual(['EmailID']);
    const bad = await ctx.api('post', '/masters/taxation').send({ taxCode: 'T1', taxName: 'x', taxRate: 'abc', basis: 'Premium', effectiveFrom: '2026-01-01' });
    expect(bad.status).toBe(400);
    const dup = await ctx.api('post', '/masters/company').send({ CompanyCode: 'bvb', CompanyName: 'Dup', LicenseNumber: '1', EmailID: 'd@x.example', PhoneNumber: '1' });
    expect(dup.status).toBe(409);
    expect((await ctx.api('get', '/masters/nope')).status).toBe(404);
  });
  it('enforces permissions: sales may read but not write', async () => {
    expect((await as(salesToken, 'get', '/masters/cover')).status).toBe(200);
    expect((await as(salesToken, 'post', '/masters/cover').send({ coverCode: 'Z', coverName: 'Z', coverDescription: 'Z' })).status).toBe(403);
    expect((await request(ctx.app).get('/api/masters/cover')).status).toBe(401);
  });
});

describe('table-backed masters', () => {
  it('country / state / city map to the reference tables with references resolved by name', async () => {
    const c = await ctx.api('post', '/masters/country').send({ CountryName: 'Viet Nam', ISOCode: 'VN', Description: 'Viet Nam', PhoneCode: '+84' });
    expect(c.status).toBe(201);
    const row = (await pool.query('SELECT name, code, attrs FROM countries WHERE code = $1', ['VN'])).rows[0];
    expect(row).toMatchObject({ name: 'Viet Nam', attrs: { Description: 'Viet Nam', PhoneCode: '+84' } });
    const s = await ctx.api('post', '/masters/state').send({ StateCode: 'HN', StateName: 'Ha Noi', Description: 'Capital', Country: 'Viet Nam' });
    expect(s.status).toBe(201);
    expect(s.body.data).toMatchObject({ Country: 'Viet Nam', CountryId: c.body.data.id });
    const city = await ctx.api('post', '/masters/city').send({ CityCode: 'HN-1', CityName: 'Ba Dinh', Description: 'District', State: 'Ha Noi' });
    expect(city.status).toBe(201);
    expect(city.body.data.State).toBe('Ha Noi');
    const badRef = await ctx.api('post', '/masters/state').send({ StateCode: 'X', StateName: 'X', Description: 'x', Country: 'Atlantis' });
    expect(badRef.status).toBe(400);
    const dup = await ctx.api('post', '/masters/country').send({ CountryName: 'philippines', ISOCode: 'PX', Description: 'x' });
    expect(dup.status).toBe(409);
    const states = await ctx.api('get', '/masters/state/options?Country=Philippines');
    expect(states.body.data.length).toBeGreaterThanOrEqual(10);
    expect(states.body.data.every((o) => o.label)).toBe(true);
    const upd = await ctx.api('put', `/masters/country/${c.body.data.id}`).send({ PhoneCode: '+840' });
    expect(upd.body.data).toMatchObject({ PhoneCode: '+840', CountryName: 'Viet Nam', Modifiedby: 'BrokerVerse Administrator' });
    expect(upd.body.data.ModifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('currency and seeded insurance companies expose front-end field names', async () => {
    const cur = await ctx.api('get', '/masters/currency?search=PHP');
    expect(cur.body.data[0]).toMatchObject({ CurrencyCode: 'PHP', CurrencyName: 'Philippine Peso', NumberofDecimals: 2, isBase: true });
    const ins = await ctx.api('get', '/masters/insurance-company?sortBy=insuranceCompanyName');
    expect(ins.body.data[0].insuranceCompanyCode).toBeTruthy();
    expect(ins.body.data.find((i) => i.insuranceCompanyCode === 'MALAYAN').city).toBe('Makati');
  });
  it('the retired taxation master keeps its records for reference but refuses changes', async () => {
    const list = await ctx.api('get', '/masters/taxation?taxCode=VAT');
    const vat = list.body.data[0];
    expect(vat).toMatchObject({ taxCode: 'VAT', status: 'Inactive' });
    expect(vat.settingKey).toBeUndefined();
    const u = await ctx.api('put', `/masters/taxation/${vat.id}`).send({ taxRate: 12.5 });
    expect(u.status).toBe(400);
    expect(u.body.message).toMatch(/retired/);
  });
});

describe('master type definitions', () => {
  it('administrators add a new master type and edit field definitions without code changes', async () => {
    const t = await ctx.api('post', '/masters').send({ code: 'occupation', label: 'Occupation', codeField: 'occCode', labelField: 'occName', fields: [{ name: 'occCode', label: 'Code', required: true }, { name: 'occName', label: 'Name', required: true }, { name: 'riskClass', type: 'select', options: ['1', '2', '3'] }] });
    expect(t.status).toBe(201);
    const r = await ctx.api('post', '/masters/occupation').send({ occCode: 'ENG', occName: 'Engineer', riskClass: '1' });
    expect(r.status).toBe(201);
    expect((await ctx.api('post', '/masters/occupation').send({ occCode: 'X', occName: 'X', riskClass: '9' })).status).toBe(400);
    const d = await ctx.api('put', '/masters/occupation/definition').send({ fields: [{ name: 'occCode', label: 'Code', required: true }, { name: 'occName', label: 'Name', required: true }, { name: 'riskClass', type: 'select', options: ['1', '2', '3', '9'] }] });
    expect(d.status).toBe(200);
    expect((await ctx.api('post', '/masters/occupation').send({ occCode: 'X', occName: 'X', riskClass: '9' })).status).toBe(201);
    expect((await ctx.api('get', '/masters/occupation/definition')).body.data.fields).toHaveLength(3);
    expect((await as(salesToken, 'post', '/masters').send({ code: 'zz', fields: [{ name: 'a' }] })).status).toBe(403);
  });
});

describe('commission master', () => {
  it('is retired: the Commission Rate Matrix is the only commission source, the records stay readable', async () => {
    const base = { desc: 'Motor comprehensive, all sales', insuranceCompany: 'Any Insurer', product: 'Motor', maxRate: 15, effectiveFrom: '2026-01-01' };
    const c = await ctx.api('post', '/masters/commission').send({ ...base, selectCover: ['Own Damage', 'Theft'] });
    expect(c.status).toBe(400);
    expect(c.body.message).toMatch(/retired .* Commission Rate Matrix/);
    const all = await ctx.api('get', '/masters/commission');
    expect(all.status).toBe(200);
    expect(all.body.data.length).toBeGreaterThan(0);
    expect(all.body.data.every((r) => r.status === 'Inactive')).toBe(true);
  });
});

describe('covers by line of business', () => {
  it('offers the covers of a line and those without a line', async () => {
    const extra = await ctx.api('post', '/masters/cover').send({ coverCode: 'ANYLINE', coverName: 'Any line cover', coverDescription: 'Offered for every line' });
    expect(extra.status).toBe(201);
    const fire = (await ctx.api('get', '/masters/cover/options?linesOfBusiness=fire')).body.data.map((o) => o.code);
    expect(fire).toEqual(expect.arrayContaining(['FLEXA', 'EQ', 'ANYLINE']));
    expect(fire).not.toContain('OD');
    const motor = (await ctx.api('get', '/masters/cover/options?linesOfBusiness=motor')).body.data.map((o) => o.code);
    expect(motor).toEqual(expect.arrayContaining(['OD', 'CTPL', 'ANYLINE']));
    expect(motor).not.toContain('FLEXA');
  });
});
