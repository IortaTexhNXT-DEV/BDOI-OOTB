/**
 * Legacy numbers against the numbering series (data-load/numbering.js): every form a series issues over the go-live
 * window is checked, one per period from the cutover year to the year after and one per branch and line of business
 * when the pattern holds {BRANCH} / {LOB}, each against the next number of its own period; offenders are listed over all
 * forms; migrated COC numbers are checked against the COC series of their insurer.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { addDays, today } from '../src/lib/dates.js';
import { cocClash, cocCollisions, collidingNumber, collidingNumbers, seriesClash, seriesShapes } from '../src/modules/data-load/numbering.js';
import { registerForPolicy } from '../src/modules/integrations/ctpl.js';
import { findPolicy } from '../src/modules/receipts/receivables.js';
import { enableFeatures, goLiveSetup, validatedBatch } from './helpers.js';

let api;
let kits;
let cutover;
let year;
let next;

function book(kit, sheets) {
  const defs = kits.find((k) => k.kit === kit).sheets;
  return writeXlsx({
    sheets: Object.entries(sheets).map(([name, rows]) => {
      const headers = defs.find((s) => s.name === name).columns.map((c) => c.header);
      return { name, columns: headers.map((h) => ({ header: h })), rows: rows.map((r) => headers.map((h) => (r[h] === undefined ? '' : String(r[h])))) };
    }),
  });
}
const upload = (kit, wb) => validatedBatch(api, api('post', '/data-load/batches').field('kit', kit).attach('file', wb, `${kit}.xlsx`));
const load = (id) => api('post', `/data-load/batches/${id}/load`).send({});
const pattern = (code, p) => query('UPDATE document_numbering SET pattern = $2 WHERE code = $1', [code, p]);

beforeAll(async () => {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {}, sampleData: false });
  const app = await createApp();
  await enableFeatures(app, ['legacy-migration']);
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  api = (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`);
  kits = (await api('get', '/data-load/kits')).body.data.kits;
  const now = await today();
  const d = new Date(`${now.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  cutover = d.toISOString().slice(0, 10);
  year = Number(cutover.slice(0, 4));
  next = year + 1;
  await goLiveSetup(api, cutover);
  clearSettingsCache();
  await query("INSERT INTO branches(code, name, status) VALUES ('CEB', 'Cebu', 'active'), ('OLD', 'Closed branch', 'inactive') ON CONFLICT DO NOTHING");
});
afterAll(async () => {
  await pool.end();
});

describe('forms of a series over the go-live window', () => {
  it('has one form per period from the cutover year to the year after, each with the next number of its period', async () => {
    await query("INSERT INTO sequences(name, period, value) VALUES ('policy', $1, 41) ON CONFLICT (name, period) DO UPDATE SET value = 41", [String(year)]);
    const shapes = await seriesShapes('policy');
    const byHead = Object.fromEntries(shapes.map((s) => [s.head, s]));
    expect(byHead[`POL-${year}-`]).toMatchObject({ tail: '', next: 42, periods: [String(year)] });
    expect(byHead[`POL-${next}-`]).toMatchObject({ tail: '', next: 1, periods: [String(next)] });
    expect(await seriesClash('policy', `POL-${year}-00041`)).toBeNull();
    expect(await seriesClash('policy', `POL-${year}-00042`)).toMatchObject({ seq: 42 });
    expect(await seriesClash('policy', 'ABC-123')).toBeNull();
  });

  it('a pattern with {BRANCH} or {LOB} gives a form per active branch and per line of business, and the form without them', async () => {
    await pattern('client', '{PREFIX}-{BRANCH}-{YYYY}-{SEQ}');
    try {
      const heads = (await seriesShapes('client')).map((s) => s.head);
      expect(heads).toEqual(expect.arrayContaining([`CL-${year}-`, `CL-HO-${year}-`, `CL-CEB-${year}-`, `CL-CEB-${next}-`]));
      expect(heads.some((h) => h.includes('OLD'))).toBe(false);
    } finally {
      await pattern('client', '{PREFIX}-{YYYY}-{SEQ}');
    }
    await pattern('claim', '{PREFIX}-{LOB}-{YY}{MM}-{SEQ}');
    try {
      const heads = (await seriesShapes('claim')).map((s) => s.head);
      expect(heads).toEqual(expect.arrayContaining([`CLM-MOTOR-${String(next).slice(2)}01-`, `CLM-${cutover.slice(2, 4)}${cutover.slice(5, 7)}-`]));
    } finally {
      await pattern('claim', '{PREFIX}-{YY}{MM}-{SEQ}');
    }
  });
});

describe('migration workbook', () => {
  it('refuses a legacy policy number of next year\'s period at or above the number that period will issue', async () => {
    const issue = addDays(cutover, -40);
    const policy = (number) => ({ 'Policy Number': number, 'Client Code': 'NUM-C-1', Insurer: 'MALAYAN', Product: 'MOTOR', 'Inception Date': addDays(issue, 1),
      'Expiry Date': addDays(cutover, 300), 'Issue Date': issue, 'Gross Premium': '25000' });
    const r = await upload('migration', book('migration', {
      Clients: [{ 'Client Code': 'NUM-C-1', 'Client Type': 'corporate', 'Company Name': 'Numbers Corp.' }],
      Policies: [policy(`POL-${next}-00001`), policy('INS-77-0001')],
    }));
    expect(r.body.data.errors).toEqual([expect.objectContaining({ sheet: 'policies', row: 2, column: 'Policy Number',
      message: expect.stringMatching(new RegExp(`numbering series, whose next number in period ${next} is 1`)) })]);
  });

  it('refuses a legacy client code of a branch form when the pattern holds {BRANCH}', async () => {
    await pattern('client', '{PREFIX}-{BRANCH}-{YYYY}-{SEQ}');
    try {
      const r = await upload('migration', book('migration', { Clients: [
        { 'Client Code': `CL-CEB-${year}-00010`, 'Client Type': 'corporate', 'Company Name': 'Cebu Branch Client' },
        { 'Client Code': `CL-ZZZ-${year}-00010`, 'Client Type': 'corporate', 'Company Name': 'No Such Branch Client' },
      ] }));
      expect(r.body.data.errors).toEqual([expect.objectContaining({ row: 2, column: 'Client Code', message: expect.stringMatching(/numbering series/) })]);
    } finally {
      await pattern('client', '{PREFIX}-{YYYY}-{SEQ}');
    }
  });
});

describe('numbers already stored', () => {
  it('lists the records a series would issue again over all its forms', async () => {
    await query(`INSERT INTO clients(client_code, client_type, company_name, display_name, origin) VALUES
      ($1, 'corporate', 'A', 'A', 'migrated'), ($2, 'corporate', 'B', 'B', 'migrated'), ($3, 'corporate', 'C', 'C', 'migrated'), ('LEGACY-9', 'corporate', 'D', 'D', 'migrated')`,
    [`CL-HO-${year}-00050`, `CL-${next}-00003`, `CL-${year}-00007`]);
    await pattern('client', '{PREFIX}-{BRANCH}-{YYYY}-{SEQ}');
    try {
      const found = (await collidingNumbers('client')).map((x) => x.number).sort();
      expect(found).toEqual([`CL-${next}-00003`, `CL-${year}-00007`, `CL-HO-${year}-00050`].sort());
      expect(await collidingNumber('client')).not.toBeNull();
      // the Numbering sheet of the configuration workbook refuses a next number that would issue one of them again
      const r = await upload('configuration', book('configuration', { Numbering: [{ 'Series Code': 'client', 'Next Number': '5' }] }));
      expect(r.body.data.errors).toEqual([expect.objectContaining({ column: 'Next Number', message: expect.stringMatching(/already exists with the format of this series/) })]);
    } finally {
      await pattern('client', '{PREFIX}-{YYYY}-{SEQ}');
    }
  });
});

describe('COC numbers', () => {
  it('finds a migrated COC number that a COC series of the same insurer has still to issue', async () => {
    const ins = (await one("SELECT id FROM insurance_companies WHERE code = 'MALAYAN'")).id;
    const other = (await one("SELECT id FROM insurance_companies WHERE code <> 'MALAYAN' ORDER BY id LIMIT 1")).id;
    await query("INSERT INTO coc_series(insurance_company_id, prefix, series_from, series_to, next_number, number_width) VALUES ($1, 'C', 1, 1000, 10, 8)", [ins]);
    const client = (await one("SELECT id FROM clients WHERE client_code = 'LEGACY-9'")).id;
    const policy = async (number, insurer, coc) => query(`INSERT INTO policies(policy_number, client_id, insurance_company_id, status, inception_date, expiry_date, origin, doc)
      VALUES ($1, $2, $3, 'active', $4::date - 30, $4::date + 300, 'migrated', $5)`, [number, client, insurer, cutover, JSON.stringify({ certNumber: coc })]);
    await policy('CTPL-OLD-1', ins, 'C00000050');
    await policy('CTPL-OLD-2', ins, 'C00000005');
    await policy('CTPL-OLD-3', other, 'C00000060');
    expect(await cocCollisions()).toEqual([expect.objectContaining({ number: 'C00000050', policyNumber: 'CTPL-OLD-1', next: 10 })]);
    expect(await cocClash(ins, 'C00000050')).toMatchObject({ next: 10 });
    expect(await cocClash(ins, 'C00000009')).toBeNull();
    expect(await cocClash(ins, 'X00000050')).toBeNull();
    expect(await cocClash(other, 'C00000050')).toBeNull();
  });
});

describe('migrated CTPL certificates', () => {
  const ctpl = (number, coc) => ({ 'Policy Number': number, 'Client Code': 'NUM-CTPL-C', Insurer: 'MALAYAN', Product: 'CTPL', 'Inception Date': addDays(cutover, -30),
    'Expiry Date': addDays(cutover, 330), 'Issue Date': addDays(cutover, -31), 'Gross Premium': '610.00', 'Plate Number': `P ${number.slice(-3)}`, 'Chassis Number': `CH-${number}`,
    'COC Number': coc, 'Authentication Code': 'AU-778' });
  const client = { 'Client Code': 'NUM-CTPL-C', 'Client Type': 'corporate', 'Company Name': 'CTPL Fleet Corp.' };

  it('refuses a COC number that a COC series of the insurer has still to issue', async () => {
    const r = await upload('migration', book('migration', { Clients: [client], 'Policies - CTPL': [ctpl('CTPL-MIG-001', 'C00000500')] }));
    expect(r.body.data.errors).toEqual([expect.objectContaining({ column: 'COC Number', message: expect.stringMatching(/range of a COC series of MALAYAN whose next number is 10/) })]);
  });

  it('records the COC of a migrated CTPL policy as authenticated (manual, not sent to the LTO), so it is never issued again', async () => {
    const outbox = (await one('SELECT count(*)::int AS n FROM integration_outbox')).n;
    const r = await upload('migration', book('migration', { Clients: [client], 'Policies - CTPL': [ctpl('CTPL-MIG-002', 'LEG-COC-778899')] }));
    expect(r.body.data.errors).toEqual([]);
    expect((await load(r.body.data.batch.id)).status).toBe(200);
    const a = await one("SELECT * FROM ctpl_authentications WHERE policy_number = 'CTPL-MIG-002'");
    expect(a).toMatchObject({ coc_number: 'LEG-COC-778899', status: 'authenticated', method: 'manual', lto_status: 'not-required', auth_code: 'AU-778', outbox_id: null,
      load_batch_id: r.body.data.batch.id, chassis_number: 'CH-CTPL-MIG-002' });
    expect((await one('SELECT count(*)::int AS n FROM integration_outbox')).n).toBe(outbox);
    // a CTPL policy issued after go-live cannot get the same COC number
    const issued = await one(`INSERT INTO policies(policy_number, client_id, insurance_company_id, product_id, status, inception_date, expiry_date, lob)
      SELECT 'CTPL-NEW-001', c.id, i.id, p.id, 'active', $1::date, $1::date + 365, 'CTPL' FROM clients c, insurance_companies i, products p
       WHERE c.client_code = 'NUM-CTPL-C' AND i.code = 'MALAYAN' AND p.code = 'CTPL' RETURNING id`, [cutover]);
    await expect(registerForPolicy({ query }, issued.id, null, { force: true, cocNumber: 'LEG-COC-778899' })).rejects.toThrow(/ctpl_authentications_coc_uq/);
    // and the same certificate in a later load is refused
    const twice = await upload('migration', book('migration', { 'Policies - CTPL': [ctpl('CTPL-MIG-003', 'LEG-COC-778899')] }));
    expect(twice.body.data.batch.rowsDuplicate).toBe(1);
  });
});

describe('policy number of another insurer', () => {
  const motor = (insurer) => ({ 'Policy Number': 'SHARED-001', 'Client Code': 'NUM-CTPL-C', Insurer: insurer, Product: 'MOTOR', 'Inception Date': addDays(cutover, -30),
    'Expiry Date': addDays(cutover, 330), 'Issue Date': addDays(cutover, -31), 'Gross Premium': '20000.00', 'Plate Number': `SH ${insurer}` });

  it('offers the insurer suffix and loads the policy as number/INSURER with the number as printed kept as legacy number', async () => {
    await query(`INSERT INTO policies(policy_number, client_id, insurance_company_id, status, inception_date, expiry_date)
      SELECT 'SHARED-001', c.id, i.id, 'active', $1::date - 30, $1::date + 330 FROM clients c, insurance_companies i WHERE c.client_code = 'NUM-CTPL-C' AND i.code = 'FPG'`, [cutover]);
    const r = await upload('migration', book('migration', { 'Policies - Motor': [motor('MALAYAN')] }));
    const id = r.body.data.batch.id;
    const rows = (await api('get', `/data-load/batches/${id}/rows`)).body.data;
    expect(rows[0]).toMatchObject({ result: 'duplicate', duplicates: [expect.objectContaining({ rule: 'policy-number', insurerCode: 'FPG', number: 'SHARED-001' })] });
    expect(rows[0].errors).toEqual([expect.objectContaining({ message: expect.stringMatching(/load it with the insurer suffix \(SHARED-001\/MALAYAN\)/) })]);
    const res = await validatedBatch(api, api('post', `/data-load/batches/${id}/resolutions`).send({ rule: 'policy-number', resolution: 'insurer-suffix', reason: 'Two insurers use the same number' }));
    expect(res.body.data.batch).toMatchObject({ rowsDuplicate: 0, rowsNew: 1 });
    expect((await load(id)).status).toBe(200);
    const p = await one("SELECT p.policy_number, p.legacy_number, p.origin FROM policies p WHERE p.policy_number = 'SHARED-001/MALAYAN'");
    expect(p).toEqual({ policy_number: 'SHARED-001/MALAYAN', legacy_number: 'SHARED-001', origin: 'migrated' });
    // the number as printed finds the other insurer's policy, the full number the migrated one
    const fpg = (await one("SELECT id FROM insurance_companies WHERE code = 'FPG'")).id;
    expect((await findPolicy({ query }, 'SHARED-001')).insurance_company_id).toBe(fpg);
    expect((await findPolicy({ query }, 'SHARED-001/MALAYAN')).legacy_number).toBe('SHARED-001');
    // the same row again is the same policy: unchanged, no duplicate
    const again = await upload('migration', book('migration', { 'Policies - Motor': [motor('MALAYAN')] }));
    expect(again.body.data.batch).toMatchObject({ rowsUnchanged: 1, rowsDuplicate: 0 });
  });

  it('the same number of the same insurer is an error, not a duplicate', async () => {
    const r = await upload('migration', book('migration', { 'Policies - Motor': [motor('FPG')] }));
    expect(r.body.data.batch.rowsDuplicate).toBe(0);
    expect(r.body.data.errors).toEqual([expect.objectContaining({ column: 'Policy Number', message: 'Policy number SHARED-001 already belongs to a policy issued in BrokerVerse' })]);
  });
});
