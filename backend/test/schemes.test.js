import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { schemeStatus } from '../src/modules/schemes/service.js';
import { findSchemeAndLine } from '../src/modules/schemes/rating.js';

// TIS-BRD-SCHM-02 (FRS SCHM-02): Scheme Master, maker-checker, life cycle, versions, vehicle lines upload, scheme rating.
let ctx;
let maker;
let approver;
let sales;
let claims;
let now;
let motorId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}
const PERILS = [
  { code: 'OD', included: true, rate: 2 }, { code: 'AON', included: true, rate: 0.5 }, { code: 'BI', included: true, limit: 100000, premium: 1000 },
  { code: 'PD', included: true, limit: 100000, premium: 1000 }, { code: 'APPA', included: true, limit: 25000, rate: 0.1 }, { code: 'RSA', included: false },
  { code: 'PAD', included: false }, { code: 'CTPL', included: true },
];
const LINES = [
  { make: 'Toyota', model: 'Vios', yearFrom: 2026, yearTo: 2027, siFrom: 500000, siTo: 1300000, vehicleClass: 'private_cars' },
  { make: 'Toyota', model: 'Fortuner', variant: '2.4 G 4x2 AT', yearFrom: 2026, yearTo: 2027, siFrom: 1500000, siTo: 2500000, vehicleClass: 'private_cars', odRate: 2.2 },
];
const scheme = (extra = {}) => ({
  schemeNo: 'S1-STD-TEST', schemeType: 'scheme1', description: 'Scheme 1 standard (test)', effectiveFrom: now, effectiveTo: addDays(now, 364), bankChannelId: 'ch_seed_tfs',
  allDealers: true, insurerIds: [2, 3], productId: motorId, vehicleClasses: ['private_cars', 'light_medium_trucks'], perils: PERILS, commissionPct: 25, dealerCommissionPct: 85,
  termYears: 5, year1PaidBy: 'dealer', siSchedule: [100, 90, 80, 70, 60], lines: LINES, ...extra,
});
const xlsx = (rows, headers = ['SCHEME_NO', 'MAKE', 'MODEL', 'VARIANT', 'YEAR_FROM', 'YEAR_TO', 'SI_FROM', 'SI_TO', 'VEHICLE_CLASS', 'OD_RATE', 'AON_RATE']) =>
  writeXlsx({ sheets: [{ name: 'Data', columns: headers.map((h) => ({ header: h })), rows }] });

beforeAll(async () => {
  ctx = await setup();
  now = await today();
  maker = await persona('sch.maker', ['processing']);
  approver = await persona('sch.approver', ['accounting-manager']);
  sales = await persona('sch.sales', ['sales']);
  claims = await persona('sch.claims', ['claims']);
  motorId = (await q("SELECT id FROM products WHERE code = 'MOTOR'"))[0].id;
});
afterAll(async () => { await pool.end(); });

let s1;
describe('Scheme Master register (FR-SCM-001 to 007)', () => {
  it('saves a Draft v1; the Scheme No. is unique without regard to case; past start, long period and a bank branch are refused', async () => {
    const r = await maker.api('post', '/schemes').send(scheme());
    expect(r.status).toBe(201);
    s1 = r.body.data;
    expect(s1).toMatchObject({ schemeNo: 'S1-STD-TEST', version: 1, status: 'draft', lineCount: 2, commissionPct: 25, tisphPct: 15 });
    const bad = async (extra, status, text) => {
      const x = await maker.api('post', '/schemes').send(scheme(extra));
      expect(x.status, text).toBe(status);
      expect(JSON.stringify(x.body)).toContain(text);
    };
    await bad({ schemeNo: 's1-std-test' }, 400, 'Scheme No. S1-STD-TEST is already used');
    await bad({ schemeNo: 'S1-X', effectiveFrom: addDays(now, -1) }, 400, 'A scheme cannot start before today');
    await bad({ schemeNo: 'S1-Y', effectiveTo: addDays(now, 790) }, 400, 'A scheme can run for at most 24 months');
    await bad({ schemeNo: 'S1-Z', bankChannelId: 'ch_seed_tfs_hq' }, 400, 'The financing bank must be an active financing bank of Distribution Channels');
    await bad({ schemeNo: 'S1 BAD!' }, 400, 'Use capital letters, digits and hyphens (3 to 20 characters)');
    await bad({ schemeNo: 'S1-NOD', allDealers: false, dealerChannelIds: [] }, 400, 'Choose All dealers or at least one dealer');
  });

  it('keeps the mandatory covers, needs the rate of an included peril and warns of a rate above the standard (FR-SCM-002)', async () => {
    const d = (await maker.api('get', `/schemes/${s1.id}`)).body.data;
    expect(d.perils.map((p) => p.name)).toEqual(['Own Damage / Theft', 'Acts of Nature', 'Excess Bodily Injury', 'Property Damage', 'Auto Personal Accident', 'Roadside Assistance',
      'Personal Accident of the Driver', 'CTPL']);
    expect(d.perils.find((p) => p.code === 'CTPL')).toMatchObject({ basis: 'tariff', mandatory: true, included: true });
    expect(d.warnings.map((w) => w.message)).toContain('Line 2: the scheme rate of 2.2000% is above the standard rate of 2.00%');
    let r = await maker.api('put', `/schemes/${s1.id}`).send({ perils: PERILS.map((p) => (p.code === 'OD' ? { ...p, included: false } : p)) });
    expect(r.body.message).toBe('Own Damage / Theft is a mandatory cover of the product and stays in the scheme');
    r = await maker.api('put', `/schemes/${s1.id}`).send({ perils: PERILS.map((p) => (p.code === 'AON' ? { code: 'AON', included: true } : p)) });
    expect(r.body.message).toBe('Acts of Nature: enter the rate of an included peril');
    r = await maker.api('put', `/schemes/${s1.id}`).send({ perils: PERILS.map((p) => (p.code === 'OD' ? { ...p, rate: 2.2 } : p)) });
    expect(r.status).toBe(200);
    expect(r.body.warnings.map((w) => w.message)).toContain('Own Damage / Theft: the scheme rate of 2.2000% is above the standard rate of 2.00%');
    r = await maker.api('put', `/schemes/${s1.id}`).send({ perils: PERILS });
    expect(r.status).toBe(200);
    expect((await q("SELECT action FROM audit_log WHERE entity = 'scheme' AND entity_id = $1 AND action = 'update'", [s1.id])).length).toBeGreaterThan(0);
  });

  it('checks the vehicle lines: overlap of the same level, ranges, classes; the variant line beside an All variants line (FR-SCM-003)', async () => {
    const fortunerOverlap = { make: 'Toyota', model: 'Fortuner', variant: '2.4 G 4x2 AT', yearFrom: 2027, yearTo: 2028, siFrom: 1500000, siTo: 2500000, vehicleClass: 'private_cars' };
    let r = await maker.api('put', `/schemes/${s1.id}`).send({ lines: [...LINES, fortunerOverlap] });
    expect(r.body.message).toBe('Line 3: Toyota Fortuner 2.4 G 4x2 AT, year model 2027 is already covered by line 2');
    r = await maker.api('put', `/schemes/${s1.id}`).send({ lines: [...LINES, { ...LINES[0], model: 'Innova', siFrom: 1300000, siTo: 500000 }] });
    expect(r.body.message).toBe('Line 3: Sum insured to must be higher than Sum insured from');
    r = await maker.api('put', `/schemes/${s1.id}`).send({ lines: [...LINES, { ...LINES[0], model: 'Innova', vehicleClass: 'heavy_trucks' }] });
    expect(r.body.message).toBe('Line 3: heavy_trucks is not a vehicle class of the scheme');
    const allFortuner = { make: 'Toyota', model: 'Fortuner', variant: 'ALL', yearFrom: 2026, yearTo: 2027, siFrom: 1000000, siTo: 3000000, vehicleClass: 'private_cars' };
    r = await maker.api('put', `/schemes/${s1.id}`).send({ lines: [...LINES, allFortuner] });
    expect(r.status).toBe(200);
    expect(r.body.data.lines.map((l) => [l.lineNo, l.vehicle, l.check])).toEqual([[1, 'Toyota Vios, All variants', 'OK'], [2, 'Toyota Fortuner 2.4 G 4x2 AT', 'OK'], [3, 'Toyota Fortuner, All variants', 'OK']]);
  });

  it('commission, dealer share and the term schedule (FR-SCM-005, 006)', async () => {
    const d = (await maker.api('get', `/schemes/${s1.id}`)).body.data;
    expect(d.equivalents).toEqual({ ownDamageRate: 2, commission: 0.5, remitting: 1.5, dealer: 0.425, tisph: 0.075, tisphPct: 15 });
    expect(d.schedule.map((y) => y.exampleSumInsured)).toEqual([1000000, 900000, 800000, 700000, 600000]);
    expect(d.schedule.map((y) => y.whoPays)).toEqual(['dealer', 'client-ada', 'client-ada', 'client-ada', 'client-ada']);
    let r = await maker.api('put', `/schemes/${s1.id}`).send({ dealerCommissionPct: 120 });
    expect(r.body.message).toBe('The dealer commission % must be between 0 and 100');
    r = await maker.api('put', `/schemes/${s1.id}`).send({ termYears: 6 });
    expect(r.body.message).toBe('The term must be between 1 and 5 years');
    r = await maker.api('put', `/schemes/${s1.id}`).send({ siSchedule: [100, 90, 95, 70, 60] });
    expect(r.body.message).toBe('Year 3: the sum insured % cannot be higher than year 2');
    const s2 = (await maker.api('post', '/schemes').send(scheme({ schemeNo: 'S2-STD-TEST', schemeType: 'scheme2', perils: PERILS.map((p) => (p.code === 'OD' ? { ...p, rate: 1.8 } : p.code === 'AON' ? { ...p, rate: 0.4 } : p)) }))).body.data;
    expect(s2.schedule.every((y) => y.whoPaysLabel === 'Client through TFS (M.A.)')).toBe(true);
    // a blank commission cannot be submitted
    const blank = (await maker.api('post', '/schemes').send(scheme({ schemeNo: 'S1-BLANK', commissionPct: null }))).body.data;
    r = await maker.api('post', `/schemes/${blank.id}/submit`).send({});
    expect(r.body.message).toBe('Enter the commission %');
    const nolines = (await maker.api('post', '/schemes').send(scheme({ schemeNo: 'S1-NOLINES', lines: [] }))).body.data;
    expect((await maker.api('post', `/schemes/${nolines.id}/submit`).send({})).body.message).toBe('Add at least one vehicle line');
  });

  it('uploads vehicle lines from Excel row by row; Replace keeps only the file; .csv and an Active scheme are refused (FR-SCM-004)', async () => {
    const draft = (await maker.api('post', '/schemes').send(scheme({ schemeNo: 'S1-UPLOAD', lines: [LINES[0]] }))).body.data;
    const file = xlsx([
      ['S1-UPLOAD', 'Toyota', 'Hilux', 'ALL', '2026', '2027', '900000', '1800000', 'light_medium_trucks', '', ''],
      ['S1-UPLOAD', 'Toyota', 'Innova', '2.8 E AT', '2026', '2027', '1200000', '1900000', 'private_cars', '', ''],
      ['S1-UPLOAD', 'Toyota', 'Vios', 'ALL', '2027', '2028', '500000', '1300000', 'private_cars', '', ''],
    ]);
    let r = await maker.api('post', '/schemes/lines/upload').field('schemeId', draft.id).field('mode', 'add').attach('file', file, 'lines.xlsx');
    expect(r.status).toBe(200);
    expect(r.body.message).toBe('Processed 3 rows: 2 created, 1 failed');
    expect(r.body.data.errors[0].text).toBe('Row 4: Toyota Vios, All variants, year model 2027 is already covered by line 1');
    r = await maker.api('post', '/schemes/lines/upload').field('schemeId', draft.id).field('mode', 'replace').attach('file', file, 'lines.xlsx');
    expect(r.body.data.created).toBe(3);
    expect((await q('SELECT count(*)::int AS n FROM scheme_vehicle_lines WHERE scheme_id = $1', [draft.id]))[0].n).toBe(3);
    r = await maker.api('post', '/schemes/lines/upload').field('schemeId', draft.id).attach('file', Buffer.from('SCHEME_NO,MAKE\nS1-UPLOAD,Toyota'), 'lines.csv');
    expect(r.body.message).toBe('Upload an Excel (.xlsx) file');
    r = await maker.api('post', '/schemes/lines/upload').field('schemeId', draft.id).attach('file', xlsx([['S1-UPLOAD', 'Toyota']], ['SCHEME_NO', 'MAKE']), 'lines.xlsx');
    expect(r.body.message).toBe('Column YEAR_FROM is missing from the Data sheet');
    expect((await sales.api('post', '/schemes/lines/upload').field('schemeId', draft.id).attach('file', file, 'lines.xlsx')).status).toBe(403);
    expect((await maker.api('get', '/schemes/lines/template')).status).toBe(200);
  });

  it('copies a scheme into a new Draft with every tab and lists, filters and exports schemes (FR-SCM-001 copy, FR-SCM-007)', async () => {
    const r = await maker.api('post', `/schemes/${s1.id}/copy`).send({ schemeNo: 'S1-MMG-TEST', effectiveFrom: now, effectiveTo: addDays(now, 364), description: 'Makati Motors scheme' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ schemeNo: 'S1-MMG-TEST', status: 'draft', lineCount: 3, commissionPct: 25 });
    expect(r.body.data.perils.find((p) => p.code === 'OD').rate).toBe(2);
    const list = (await sales.api('get', '/schemes?status=draft&search=TEST')).body;
    expect(list.data.map((s) => s.schemeNo)).toEqual(expect.arrayContaining(['S1-STD-TEST', 'S2-STD-TEST', 'S1-MMG-TEST']));
    expect(list.counts.draft).toBeGreaterThan(2);
    const x = await sales.api('get', '/schemes/export?status=draft').buffer(true).parse((res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(x.status).toBe(200);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    expect((await claims.api('get', '/schemes')).status).toBe(403);
    expect((await sales.api('post', '/schemes').send(scheme({ schemeNo: 'S1-SALES' }))).status).toBe(403);
  });
});

describe('approval and life cycle (FR-SCM-010 to 012)', () => {
  it('maker-checker: the maker never approves; a return needs a remark; approval sets Active or Scheduled and raises an approval in My Work', async () => {
    let r = await maker.api('post', `/schemes/${s1.id}/submit`).send({});
    expect(r.body.message).toBe('Scheme submitted for approval');
    expect(r.body.data.status).toBe('pending-approval');
    const work = await approver.api('get', '/my-work/items?perPage=200');
    expect(JSON.stringify(work.body)).toContain('S1-STD-TEST v1');
    // the maker holding approve:schemes (an administrator who made the scheme) still cannot approve
    const own = (await ctx.api('post', '/schemes').send(scheme({ schemeNo: 'S1-ADMIN' }))).body.data;
    await ctx.api('post', `/schemes/${own.id}/submit`).send({});
    r = await ctx.api('post', `/schemes/${own.id}/approve`).send({});
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('You made or changed this scheme, so another user must approve it');
    expect((await maker.api('post', `/schemes/${s1.id}/approve`).send({})).status).toBe(403);
    r = await approver.api('post', `/schemes/${s1.id}/return`).send({});
    expect(r.body.message).toBe('Enter the reason for returning the scheme');
    r = await approver.api('post', `/schemes/${s1.id}/return`).send({ note: 'Check the Fortuner range' });
    expect(r.body.data.status).toBe('draft');
    await maker.api('post', `/schemes/${s1.id}/submit`).send({});
    r = await approver.api('post', `/schemes/${s1.id}/approve`).send({ note: 'Agreed' });
    expect(r.body.message).toBe('Scheme approved');
    expect(r.body.data.status).toBe('active');
    const later = (await maker.api('post', '/schemes').send(scheme({ schemeNo: 'S1-LATER', effectiveFrom: addDays(now, 10), effectiveTo: addDays(now, 300) }))).body.data;
    await maker.api('post', `/schemes/${later.id}/submit`).send({});
    expect((await approver.api('post', `/schemes/${later.id}/approve`).send({})).body.data.status).toBe('scheduled');
    // an approved version is not edited in place
    expect((await maker.api('put', `/schemes/${s1.id}`).send({ description: 'x' })).body.message).toBe('An approved scheme cannot be changed; use Amend to create a new version');
  });

  it('the daily job activates and expires; suspend, resume and withdraw need a remark (FR-SCM-011)', async () => {
    const later = (await q("SELECT id FROM schemes WHERE scheme_no = 'S1-LATER'"))[0].id;
    expect(await schemeStatus({ date: addDays(now, 10) })).toMatchObject({ activated: 1 });
    expect((await q('SELECT status FROM schemes WHERE id = $1', [later]))[0].status).toBe('active');
    expect((await schemeStatus({ date: addDays(now, 301) })).expired).toBeGreaterThan(0);
    expect((await q('SELECT status FROM schemes WHERE id = $1', [later]))[0].status).toBe('expired');
    expect((await approver.api('post', `/schemes/${s1.id}/suspend`).send({})).body.message).toBe('Enter the reason');
    let r = await approver.api('post', `/schemes/${s1.id}/suspend`).send({ note: 'Rate disputed with Pioneer' });
    expect(r.body).toMatchObject({ message: 'Scheme suspended', data: { status: 'suspended' } });
    // a suspended scheme rates no new loan
    await expect(findSchemeAndLine({ schemeNo: 'S1-STD-TEST', vehicle: { make: 'Toyota', model: 'Vios', yearModel: 2026 }, sumInsured: 1000000, inception: now }))
      .rejects.toThrow(`Scheme S1-STD-TEST is not in force on ${now.split('-').reverse().join('/')}`);
    r = await approver.api('post', `/schemes/${s1.id}/resume`).send({ note: 'Rate confirmed' });
    expect(r.body.data.status).toBe('active');
    expect((await maker.api('post', `/schemes/${s1.id}/suspend`).send({ note: 'x' })).status).toBe(403);
    const w = (await maker.api('post', '/schemes').send(scheme({ schemeNo: 'S1-WD' }))).body.data;
    r = await approver.api('post', `/schemes/${w.id}/withdraw`).send({ note: 'Not needed' });
    expect(r.body.data).toMatchObject({ status: 'withdrawn', effectiveTo: now });
  });

  it('amends an approved scheme as the next version; the version in force stays until the new one is approved (FR-SCM-012)', async () => {
    let r = await maker.api('post', `/schemes/${s1.id}/amend`).send({});
    expect(r.status).toBe(201);
    const v2 = r.body.data;
    expect(v2).toMatchObject({ schemeNo: 'S1-STD-TEST', version: 2, status: 'draft' });
    expect((await maker.api('post', `/schemes/${s1.id}/amend`).send({})).body.message).toBe('Version 2 of this scheme is already being changed or approved');
    expect((await q('SELECT status FROM schemes WHERE id = $1', [s1.id]))[0].status).toBe('active');
    r = await maker.api('put', `/schemes/${v2.id}`).send({ perils: PERILS.map((p) => (p.code === 'OD' ? { ...p, rate: 1.9 } : p)), schemeType: 'scheme2' });
    expect(r.body.message).toBe('The scheme type cannot be changed after approval');
    await maker.api('put', `/schemes/${v2.id}`).send({ perils: PERILS.map((p) => (p.code === 'OD' ? { ...p, rate: 1.9 } : p)) });
    await maker.api('post', `/schemes/${v2.id}/submit`).send({});
    const d = (await approver.api('get', `/schemes/${v2.id}`)).body.data;
    expect(d.changes).toMatchObject({ previousVersion: 1, perils: ['OD'] });
    r = await approver.api('post', `/schemes/${v2.id}/approve`).send({});
    expect(r.body.data.status).toBe('active');
    expect((await q('SELECT status FROM schemes WHERE id = $1', [s1.id]))[0].status).toBe('superseded');
    expect(d.versions.map((v) => v.version)).toEqual([2, 1]);
  });
});

describe('scheme rating (FR-SCM-020 to 022)', () => {
  let s1v2;
  beforeAll(async () => { s1v2 = (await q("SELECT id FROM schemes WHERE scheme_no = 'S1-STD-TEST' AND version = 2"))[0].id; });

  it('previews the premiums of every year for a sample vehicle, nothing saved (Appendix A.1 at OD 2.00%)', async () => {
    const audits = (await q("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'scheme'"))[0].n;
    const s1v1 = (await q("SELECT id FROM schemes WHERE scheme_no = 'S1-STD-TEST' AND version = 1"))[0].id;
    const r = await sales.api('get', `/schemes/${s1v1}/preview?make=Toyota&model=Vios&variant=1.3%20XLE%20CVT&yearModel=2026&sumInsured=1000000&insurerId=2`);
    expect(r.status).toBe(200);
    const y = r.body.data.years;
    expect(y[0]).toMatchObject({ sumInsured: 1000000, ownDamage: 20000, actsOfNature: 5000, netPremium: 27125, vat: 3255, dst: 3391, lgt: 203.44, ctpl: 1660.4, grossPremium: 35634.84,
      commission: 6781.25, dealerShare: 5764.06, tisphShare: 1017.19 });
    expect(y.map((x) => x.grossPremium)).toEqual([35634.84, 30843.19, 27711.94, 25191.09, 22059.84]);
    expect(y.map((x) => x.ctpl)).toEqual([1660.4, 0, 0, 610.4, 610.4]);
    expect((await q("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'scheme'"))[0].n).toBe(audits);
  });

  it('finds the most specific line, the range of the sum insured, the dealer and insurer of the scheme (FR-SCM-020)', async () => {
    const base = { schemeNo: 'S1-STD-TEST', inception: now, insurerId: 2 };
    const f = await findSchemeAndLine({ ...base, vehicle: { make: 'Toyota', model: 'Fortuner', variant: '2.4 G 4x2 AT', yearModel: 2026 }, sumInsured: 1800000 });
    expect(f.line.line_no).toBe(2);
    expect(f.scheme.id).toBe(s1v2);
    await expect(findSchemeAndLine({ ...base, vehicle: { make: 'Toyota', model: 'Vios', yearModel: 2026 }, sumInsured: 1400000 }))
      .rejects.toThrow('The sum insured of 1,400,000.00 is outside the range 500,000 - 1,300,000 of scheme S1-STD-TEST for Toyota Vios');
    await expect(findSchemeAndLine({ ...base, vehicle: { make: 'Toyota', model: 'Innova', yearModel: 2026 }, sumInsured: 1400000 }))
      .rejects.toThrow('Toyota Innova 2026 is not covered by scheme S1-STD-TEST');
    await expect(findSchemeAndLine({ ...base, insurerId: 5, vehicle: { make: 'Toyota', model: 'Vios', yearModel: 2026 }, sumInsured: 1000000 }))
      .rejects.toThrow('Standard Insurance Co., Inc. is not an insurer of scheme S1-STD-TEST');
    await expect(findSchemeAndLine({ ...base, schemeNo: 'S1-LATER', vehicle: { make: 'Toyota', model: 'Vios', yearModel: 2026 }, sumInsured: 1000000 }))
      .rejects.toThrow(/Scheme S1-LATER is not in force on/);
  });

  it('a scheme naming the dealer is used before an All dealers scheme of the same type (FR-SCM-020 R2)', async () => {
    const mmg = (await q("SELECT id FROM schemes WHERE scheme_no = 'S1-MMG-TEST'"))[0].id;
    await maker.api('put', `/schemes/${mmg}`).send({ allDealers: false, dealerChannelIds: ['ch_seed_tmk'] });
    await maker.api('post', `/schemes/${mmg}/submit`).send({});
    expect((await approver.api('post', `/schemes/${mmg}/approve`).send({})).body.data.status).toBe('active');
    const pick = (dealer) => findSchemeAndLine({ schemeType: 'scheme1', dealerChannelId: dealer, inception: now, vehicle: { make: 'Toyota', model: 'Vios', yearModel: 2026 }, sumInsured: 1000000 });
    expect((await pick('ch_seed_tmk_mkt')).scheme.scheme_no).toBe('S1-MMG-TEST');
    expect((await pick('ch_seed_tps_psg')).scheme.scheme_no).toBe('S1-STD-TEST');
    await expect(findSchemeAndLine({ schemeNo: 'S1-MMG-TEST', dealerChannelId: 'ch_seed_tps_psg', inception: now, vehicle: { make: 'Toyota', model: 'Vios', yearModel: 2026 }, sumInsured: 1000000 }))
      .rejects.toThrow('Toyota Pasig is not a dealer of scheme S1-MMG-TEST');
  });
});
