/**
 * Documents of a remittance (Remittances row menu, record > Documents): the schedule as server XLSX and PDF (letterhead,
 * header lines, one row per policy, totals, the note that it is valid without signature) and the advice letter (PDF, with the payment
 * block of the settlement voucher), named <Ref>_<Document>_<yyyymmdd>.<ext>. The /pdf print of earlier releases stays.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, remittanceBody } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';

let ctx;
let gm;
let sales;
let rem;
let insurerId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const binary = (r) => r.buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
const as = (token, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  ctx = await setup();
  for (const [u, n, roles] of [['doc.gm', 'A. Tan', ['tis-general-manager']], ['doc.sales', 'S. Ales', ['sales']]]) {
    expect((await ctx.api('post', '/users').send({ username: u, password: 'Welcome@123', displayName: n, email: `${u}@example.ph`, roles })).status).toBe(201);
  }
  gm = await loginAs(ctx.app, 'doc.gm', 'Welcome@123');
  sales = await loginAs(ctx.app, 'doc.sales', 'Welcome@123');
  [{ id: insurerId }] = await q(`INSERT INTO insurance_companies(code, name, short_name, status, address, tin) VALUES ('DOCINS', 'Document Test Insurance Corp.', 'Doc Test', 'active',
    '12 Ayala Avenue, Makati City', '000-111-222-000') RETURNING id`);
  const [p] = await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, issued_date, premium_total, commission_amount, sum_insured, renewed_from)
    VALUES ('TISPH-PC-DOC-0001', (SELECT id FROM clients ORDER BY id LIMIT 1), (SELECT id FROM products WHERE code = 'MOTOR'), $1, 'issued', DATE '2026-10-01', DATE '2027-10-01',
      DATE '2026-09-28', 64159.68, 24022.50, 1250000, NULL) RETURNING id`, [insurerId]);
  const c = await ctx.api('post', '/remittance/remittances').send(await remittanceBody({ insurerCode: 'DOCINS', period: '2026-10', lines: [{ policyId: p.id }, { policyNo: 'EXT-DOC-2', premium: 12000, commission: 1800, tax: 200 }] }));
  expect(c.status).toBe(201);
  rem = c.body.data;
});
afterAll(async () => { await pool.end(); });

describe('remittance schedule', () => {
  it('downloads as a server XLSX: letterhead, header lines, one row per policy, totals and the note', async () => {
    const r = await binary(as(gm, 'get', `/remittance/remittances/${rem.id}/schedule.xlsx`));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/spreadsheetml/);
    expect(r.headers['content-disposition']).toMatch(new RegExp(`attachment; filename="${rem.remittanceNo}_Schedule_\\d{8}\\.xlsx"`));
    const [sheet] = readWorkbook(r.body);
    const at = sheet.rows.findIndex((row) => row[0] === 'ISSUED DATE');
    const banner = sheet.rows.slice(0, at).map((row) => row[0]).filter(Boolean);
    const company = (await q("SELECT COALESCE(data->>'CompanyName', name) AS name FROM master_records WHERE type_code = 'company' AND status = 'active' ORDER BY (lower(COALESCE(data->>'IsPrimary', 'false')) IN ('true', 'yes', '1')) DESC, id LIMIT 1"))[0];
    expect(banner[0]).toBe(String(company.name).toUpperCase());
    expect(banner.slice(1, 4)).toEqual(['Remittance Schedule', 'Insurer: Document Test Insurance Corp.', 'Product line: Motor']);
    expect(banner).toContain(`REM no: ${rem.remittanceNo}`);
    expect(banner.some((l) => /^Coverage Date: \d{2}\/\d{2}\/\d{4} to \d{2}\/\d{2}\/\d{4}$/.test(l))).toBe(true);
    expect(sheet.rows[at]).toEqual(['ISSUED DATE', 'CLIENT NAME', 'CAR MODEL', 'INSURANCE COMPANY', 'POLICY NO.', 'BUSINESS TYPE', 'INCEPTION DATE FROM', 'SI', 'TOTAL PREMIUM',
      'COMMISSION', 'TAXES', 'DUE TO INSURER']);
    const data = sheet.rows.slice(at + 1);
    expect(data).toHaveLength(4);
    const pol = data.find((row) => row[4] === 'TISPH-PC-DOC-0001');
    expect(pol[3]).toBe('Document Test Insurance Corp.');
    expect(pol[5]).toBe('NEW');
    expect(pol.slice(7).map(Number)).toEqual([1250000, 64159.68, 24022.5, 0, 40137.18]);
    expect(data[2][1]).toBe('TOTAL');
    expect(data[2].slice(8).map(Number)).toEqual([76159.68, 25822.5, 200, 50137.18]);
    expect(data[3][0]).toBe('Note: This is a system-generated document and is valid without physical signature.');
  });

  it('downloads as a server PDF (A4 landscape) with the same rows', async () => {
    const r = await binary(as(gm, 'get', `/remittance/remittances/${rem.id}/schedule.pdf`));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/application\/pdf/);
    expect(r.headers['content-disposition']).toMatch(new RegExp(`attachment; filename="${rem.remittanceNo}_Schedule_\\d{8}\\.pdf"`));
    const text = r.body.toString('latin1');
    expect(text.slice(0, 5)).toBe('%PDF-');
    for (const s of ['Remittance Schedule', 'TISPH-PC-DOC-0001', 'EXT-DOC-2', 'TOTAL', '40,137.18', '50,137.18', 'Note: This is a system-generated document']) expect(text).toContain(`(${s}`);
    expect(text).toMatch(/\/MediaBox \[0 0 841\.89 595\.28\]/);
  });
});

describe('remittance advice', () => {
  it('prints the advice letter with the payment block of the settlement voucher', async () => {
    const [d] = await q(`INSERT INTO disbursements(voucher_number, payee_type, payee_name, amount, status, payment_mode, reference_no, paid_at, insurance_company_id, voucher_date)
      VALUES ('PV-DOC-0001', 'Insurer', 'Document Test Insurance Corp.', 50137.18, 'paid', 'bank-transfer', 'MB123456', now(), $1, DATE '2026-10-13') RETURNING id`, [insurerId]);
    await q(`INSERT INTO remittance_items(kind, reference_no, amount, status, insurance_company_id, data) VALUES ('settlement', 'SET-DOC-0001', 50137.18, 'Approved', $1, $2)`,
      [insurerId, JSON.stringify({ remittanceIds: [rem.id], disbursementId: d.id, voucherNumber: 'PV-DOC-0001' })]);
    await q("UPDATE remittances SET status = 'settled', settled_at = now() WHERE id = $1", [rem.id]);
    const row = (await as(gm, 'get', `/remittance/remittances?segment=all&insurerId=${insurerId}`)).body.data[0];
    expect(row).toMatchObject({ statusLabel: 'Settled (voucher raised)', voucher: { number: 'PV-DOC-0001' }, bankReference: 'MB123456' });
    expect(row.actions.map((a) => a.code)).toEqual(['view', 'download-schedule-xlsx', 'download-schedule-pdf', 'download-advice', 'open-voucher']);
    const rec = (await as(gm, 'get', `/remittance/remittances/${rem.id}`)).body.data;
    expect(rec.payment).toMatchObject({ voucher: { number: 'PV-DOC-0001' }, method: 'Bank transfer', valueDate: '2026-10-13', bankReference: 'MB123456', settlement: { reference: 'SET-DOC-0001' } });
    expect(rec.downloads.map((x) => x.code)).toEqual(['schedule-xlsx', 'schedule-pdf', 'advice']);
    const r = await binary(as(gm, 'get', `/remittance/remittances/${rem.id}/advice.pdf`));
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(new RegExp(`attachment; filename="${rem.remittanceNo}_Advice_\\d{8}\\.pdf"`));
    const text = r.body.toString('latin1');
    for (const s of ['Remittance Advice', 'Document Test Insurance Corp.', '000-111-222-000', 'PV-DOC-0001', 'Bank transfer', 'MB123456', 'Refund credits netted', 'Amount paid',
      '50,137.18', 'Schedule attached.']) expect(text).toContain(`(${s}`);
    expect(text).toMatch(/\/MediaBox \[0 0 595\.28 841\.89\]/);
    // the print of earlier releases stays
    expect((await binary(as(gm, 'get', `/remittance/remittances/${rem.id}/pdf`))).status).toBe(200);
  });

  it('needs read:remittance; agency bills and unknown remittances are not found', async () => {
    expect((await as(sales, 'get', `/remittance/remittances/${rem.id}/schedule.xlsx`)).status).toBe(403);
    expect((await as(sales, 'get', `/remittance/remittances/${rem.id}/advice.pdf`)).status).toBe(403);
    const [agency] = await q("SELECT id FROM remittances WHERE kind = 'agency-bill' LIMIT 1");
    expect((await as(gm, 'get', `/remittance/remittances/${agency.id}/schedule.pdf`)).status).toBe(404);
    expect((await as(gm, 'get', '/remittance/remittances/rm_missing/advice.pdf')).status).toBe(404);
  });
});
