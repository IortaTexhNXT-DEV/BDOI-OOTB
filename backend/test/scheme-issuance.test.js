import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { setSetting } from '../src/lib/settings.js';

// TIS-BRD-SCHM-01 (FRS SCHM-01), CR-05: Scheme Issuance - applications, checklist, waivers, placement, policy, lock-in capture.
let ctx;
let ops;
let ops2;
let head;
let sales;
let now;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}
const PERILS = [
  { code: 'OD', included: true, rate: 2 }, { code: 'AON', included: true, rate: 0.5 }, { code: 'BI', included: true, limit: 100000, premium: 1000 },
  { code: 'PD', included: true, limit: 100000, premium: 1000 }, { code: 'APPA', included: true, limit: 25000, rate: 0.1 }, { code: 'CTPL', included: true },
];
let n = 0;
const loan = () => `80051${String(23400 + (n += 1)).padStart(5, '0')}`;
const chassis = () => `MR2B29F30R${String(1120000 + n).padStart(7, '0')}`;
const application = (extra = {}) => ({
  schemeNo: 'S1-SIS-TEST', loanAccount: loan(), bookingDate: addDays(now, -2), loanTermMonths: 60, releaseDate: now,
  borrower: { firstName: 'Ramon', lastName: 'Villanueva', birthday: '1992-03-14', nationality: 'Filipino', idType: 'PhilID', idNumber: '1234-5678-9012' },
  dealerChannelId: 'ch_seed_tmk_mkt', make: 'Toyota', model: 'Vios', variant: '1.3 XLE CVT', yearModel: Number(now.slice(0, 4)), chassisNumber: chassis(), engineNumber: `2NR-F${n}`,
  conductionSticker: `CS${n}`, invoicePrice: 1000000, insuranceCompanyId: 2, araSignedOn: addDays(now, -2), araPaymentMode: 'ADA', ...extra,
});
async function makeScheme(schemeNo, schemeType, extra = {}) {
  const r = await ctx.api('post', '/schemes').send({ schemeNo, schemeType, description: `${schemeNo} test`, effectiveFrom: now, effectiveTo: addDays(now, 364), bankChannelId: 'ch_seed_tfs',
    allDealers: true, insurerIds: [2, 3], productId: (await q("SELECT id FROM products WHERE code = 'MOTOR'"))[0].id, vehicleClasses: ['private_cars'], perils: PERILS,
    commissionPct: 25, dealerCommissionPct: 85, termYears: 5, year1PaidBy: 'dealer', siSchedule: [100, 90, 80, 70, 60],
    lines: [{ make: 'Toyota', model: 'Vios', yearFrom: Number(now.slice(0, 4)) - 1, yearTo: Number(now.slice(0, 4)) + 1, siFrom: 500000, siTo: 1300000, vehicleClass: 'private_cars' }], ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  await ctx.api('post', `/schemes/${r.body.data.id}/submit`).send({});
  const ok = await head.api('post', `/schemes/${r.body.data.id}/approve`).send({});
  expect(ok.body.data?.status, JSON.stringify(ok.body)).toBe('active');
  return r.body.data.id;
}
/** Complete the checklist: KYC items uploaded, the others received with a remark. */
async function complete(api, id) {
  const items = (await api('get', `/scheme-issuance/${id}`)).body.data.items;
  let last;
  for (const i of items.filter((x) => x.required && x.status === 'pending')) {
    last = i.kyc ? await api('post', `/scheme-issuance/${id}/items/${i.id}/upload`).attach('file', PDF, `${i.code}.pdf`)
      : await api('post', `/scheme-issuance/${id}/items/${i.id}/receive`).send({ remark: 'Original in the loan folder' });
    expect(last.status, JSON.stringify(last.body)).toBe(200);
  }
  return last;
}

beforeAll(async () => {
  ctx = await setup();
  now = await today();
  ops = await persona('sis.ops', ['processing']);
  ops2 = await persona('sis.ops2', ['processing']);
  head = await persona('sis.head', ['accounting-manager']);
  sales = await persona('sis.sales', ['sales']);
  await makeScheme('S1-SIS-TEST', 'scheme1');
  await makeScheme('S2-SIS-TEST', 'scheme2');
});
afterAll(async () => { await pool.end(); });

let app1;
describe('application (FR-SIS-001 to 005)', () => {
  it('creates an application priced from the scheme with the checklist by condition; Documents pending', async () => {
    const r = await ops.api('post', '/scheme-issuance').send(application());
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    app1 = r.body.data;
    expect(app1.status).toBe('documents-pending');
    expect(r.body.message).toContain(`Application ${app1.applicationNumber} saved. Premium computed from scheme S1-SIS-TEST: year 1 gross premium`);
    expect(app1.pricing).toMatchObject({ schemeNo: 'S1-SIS-TEST', policyYears: 5, lockInYears: 5, araYears: 4, payer: 'dealer' });
    expect(app1.pricing.year1.grossPremium).toBe(35634.84);
    // the application schedule leaves out the CTPL of the later years (schemes.application_schedule_ctpl false)
    expect(app1.pricing.schedule.map((y) => y.ctpl)).toEqual([1660.4, 0, 0, 0, 0]);
    expect(app1.pricing.schedule.slice(1).every((y) => y.whoPays === 'Client, ARA (ADA)')).toBe(true);
    const codes = app1.items.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['SCH-LOAN', 'SCH-INVOICE', 'SCH-DR', 'SCH-MORTGAGE']));
    expect(codes.some((c) => c.startsWith('KYC-TFS'))).toBe(true);
    expect(codes).not.toContain('KYC-ID');
    expect(app1.gate.missing).toBeGreaterThan(0);
  });

  it('a missing value keeps a Draft; a wrong value is refused (loan account, term, release date, ARA, bank, duplicate loan)', async () => {
    const d = await ops.api('post', '/scheme-issuance').send(application({ araSignedOn: null, chassisNumber: null }));
    expect(d.status).toBe(201);
    expect(d.body.data.status).toBe('draft');
    expect(d.body.message).toContain('Draft: Chassis number is required; ARA signed on is required for Scheme 1');
    const bad = async (extra, text) => {
      const r = await ops.api('post', '/scheme-issuance').send(application(extra));
      expect(r.status, text).toBe(400);
      expect(r.body.message).toContain(text);
    };
    await bad({ loanAccount: '12345' }, 'The TFS loan account must have 10 digits');
    await bad({ loanAccount: app1.loanAccount }, `Loan account ${app1.loanAccount} is already on application ${app1.applicationNumber}`);
    await bad({ loanTermMonths: 96 }, 'Loan term must be between 12 and 84 months');
    await bad({ releaseDate: addDays(now, 1) }, 'The vehicle release date cannot be in the future');
    await bad({ releaseDate: addDays(now, -31), bookingDate: addDays(now, -31), araSignedOn: addDays(now, -31) }, 'The vehicle release date cannot be more than 30 days before today');
    await bad({ araSignedOn: addDays(now, -40) }, 'ARA signed on must be between');
    await bad({ araPaymentMode: 'CASH' }, 'ARA payment mode must be one of');
    await bad({ bankChannelId: 'ch_seed_bpi' }, 'The financing bank must be TFSPH or one of its branches');
    await bad({ borrower: { firstName: 'Ana', birthday: '1990-01-01', idType: 'Library card', idNumber: '1' } }, 'ID type "Library card" is not an accepted ID');
    expect((await sales.api('post', '/scheme-issuance').send(application())).status).toBe(403);
  });

  it('the scheme checks keep a Draft: dealer, model range, sum insured range, old model year, a chassis already used (FR-SIS-003)', async () => {
    const check = async (extra, text) => {
      const r = await ops.api('post', '/scheme-issuance').send(application(extra));
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.data.status).toBe('draft');
      expect(JSON.stringify(r.body.data.problems)).toContain(text);
    };
    await check({ model: 'Hiace' }, 'Toyota Hiace is outside the make and model range of scheme S1-SIS-TEST');
    await check({ invoicePrice: 1500000 }, 'is outside the range 500,000 - 1,300,000 of scheme S1-SIS-TEST');
    await check({ yearModel: Number(now.slice(0, 4)) - 3 }, 'Scheme business is for brand-new vehicles only');
    await check({ chassisNumber: app1.vehicle.chassisNumber }, `Chassis number ${app1.vehicle.chassisNumber} is already on ${app1.applicationNumber}`);
    await check({ insuranceCompanyId: 5 }, 'is not an insurer of scheme S1-SIS-TEST');
  });

  it('Scheme 2: paid through the monthly amortisation, no ARA, billed to TFSPH', async () => {
    const r = await ops.api('post', '/scheme-issuance').send(application({ schemeNo: 'S2-SIS-TEST', araSignedOn: null, araPaymentMode: null }));
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: 'documents-pending', araPaymentMode: 'MA', araSignedOn: null });
    expect(r.body.data.pricing).toMatchObject({ payer: 'bank', araYears: 0 });
  });
});

describe('document checklist and waivers (FR-SIS-011 to 014)', () => {
  it('a KYC item needs a file; Received needs a remark; a waiver goes to another approver; the gate opens at Ready to issue', async () => {
    const items = app1.items;
    const kyc = items.find((i) => i.kyc);
    let r = await ops.api('post', `/scheme-issuance/${app1.id}/items/${kyc.id}/receive`).send({ remark: 'seen' });
    expect(r.body.message).toBe('A KYC document must be uploaded');
    const inv = items.find((i) => i.code === 'SCH-INVOICE');
    r = await ops.api('post', `/scheme-issuance/${app1.id}/items/${inv.id}/receive`).send({});
    expect(r.body.message).toBe('Remark is required when no file is uploaded');
    r = await ops.api('post', `/scheme-issuance/${app1.id}/items/${kyc.id}/upload`).attach('file', Buffer.from('MZ not a document'), 'id.exe');
    expect(r.status).toBe(400);
    expect((await ops.api('post', `/scheme-issuance/${app1.id}/items/${inv.id}/waive`).send({ reason: 'x' })).body.message).toBe('Vehicle sales invoice cannot be waived');
    expect((await ops.api('post', `/scheme-issuance/${app1.id}/send`).send({})).body.message).toContain('The application cannot go to the insurer:');
    // waive the chattel mortgage: requested by ops, never decided by ops; head approves
    const mort = items.find((i) => i.code === 'SCH-MORTGAGE');
    r = await ops.api('post', `/scheme-issuance/${app1.id}/items/${mort.id}/waive`).send({ reason: 'Registration in progress at LTO' });
    expect(r.body.message).toBe(`Waiver of ${mort.document} requested`);
    expect((await ops.api('post', `/scheme-issuance/${app1.id}/items/${mort.id}/waiver/approve`).send({})).status).toBe(403);
    expect((await head.api('post', `/scheme-issuance/${app1.id}/items/${mort.id}/waiver/reject`).send({})).body.message).toBe('Reason is required');
    r = await head.api('post', `/scheme-issuance/${app1.id}/items/${mort.id}/waiver/approve`).send({ note: 'Copy to follow' });
    expect(r.body.message).toBe(`Waiver of ${mort.document} approved`);
    // a waiver the requester holds approve:scheme-issuance for is still refused to the requester
    const r2 = await complete(ops.api, app1.id);
    expect(r2.body.status).toBe('ready');
    r = await ops.api('post', `/scheme-issuance/${app1.id}/items/${inv.id}/reopen`).send({ remark: 'Blurred scan' });
    expect(r.body.status).toBe('documents-pending');
    r = await ops.api('post', `/scheme-issuance/${app1.id}/items/${inv.id}/receive`).send({ remark: 'Clear copy on file' });
    expect(r.body.status).toBe('ready');
    r = await ops.api('post', `/scheme-issuance/${app1.id}/items`).send({ document: 'Insurer letter of undertaking' });
    expect(r.status).toBe(201);
    expect((await ops.api('get', `/scheme-issuance/${app1.id}`)).body.data.status).toBe('ready');
  });

  it('a KYC record of the master cannot be made waivable (notWhen rule)', async () => {
    const rec = (await q("SELECT id FROM master_records WHERE type_code = 'scheme-document-checklist' AND (data->>'kycItem')::boolean IS TRUE LIMIT 1"))[0];
    const r = await ctx.api('put', `/masters/scheme-document-checklist/${rec.id}`).send({ canWaive: true });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('A KYC item cannot be waived');
  });
});

describe('placement, policy, lock-in capture, cancellation (FR-SIS-020 to 024, 030)', () => {
  let placementId;
  it('sends a Ready application on a Placement Slip of source scheme; the application is read-only', async () => {
    const r = await ops.api('post', `/scheme-issuance/${app1.id}/send`).send({});
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toMatch(new RegExp(`^Application ${app1.applicationNumber} sent to .* on placement slip PS-`));
    placementId = r.body.data.placementId;
    const p = (await q('SELECT source, premium_total, status FROM placements WHERE id = $1', [placementId]))[0];
    expect(p).toMatchObject({ source: 'scheme', premium_total: 35634.84 });
    expect((await ops.api('put', `/scheme-issuance/${app1.id}`).send({ invoicePrice: 1100000 })).body.message).toContain('was sent to the insurer: its data and checklist are read-only');
    expect((await ops.api('post', `/scheme-issuance/${app1.id}/issue`).send({})).body.message).toBe('The policy can be issued only after the insurer has confirmed the placement');
  });

  it('issues once acknowledged: the dealer billing client is required, the lock-in Scheme 1 ARA is captured (end = start + 5 years - 1 day)', async () => {
    if ((await q('SELECT status FROM placements WHERE id = $1', [placementId]))[0].status === 'draft') {
      await q("UPDATE placements SET status = 'sent', sent_at = now() WHERE id = $1", [placementId]);
    }
    const ack = await ops.api('post', `/placements/${placementId}/acknowledge`).send({ reference: 'PIO-ACK-0001' });
    expect(ack.status, JSON.stringify(ack.body)).toBe(200);
    await q("DELETE FROM channel_billing_accounts WHERE channel_id IN ('ch_seed_tmk_mkt', (SELECT parent_id FROM distribution_channels WHERE id = 'ch_seed_tmk_mkt'))");
    let r = await ops.api('post', `/scheme-issuance/${app1.id}/issue`).send({});
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('has no billing client: add it on Distribution Channels before issuing');
    await setSetting('schemes.require_billing_client', false);
    try {
      r = await ops.api('post', `/scheme-issuance/${app1.id}/issue`).send({});
    } finally {
      await setSetting('schemes.require_billing_client', true);
    }
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const { policyId, lockIn } = r.body.data;
    expect(r.body.message).toContain(`Lock-in Scheme 1 ARA recorded on policy ${r.body.data.policyNumber} until`);
    expect(lockIn).toMatchObject({ source: 'scheme1-ara', years: 5, tfs_loan_account: app1.loanAccount, reference: 'S1-SIS-TEST' });
    const pol = (await q('SELECT inception_date::text AS inc, commission_amount, doc FROM policies WHERE id = $1', [policyId]))[0];
    const lk = (await q('SELECT start_date::text AS s, end_date::text AS e FROM policy_lock_ins WHERE policy_id = $1', [policyId]))[0];
    expect(lk.s).toBe(pol.inc);
    const y5 = new Date(`${pol.inc}T00:00:00Z`); y5.setUTCFullYear(y5.getUTCFullYear() + 5);
    expect(lk.e).toBe(addDays(y5.toISOString().slice(0, 10), -1));
    expect(Number(pol.commission_amount)).toBe(6781.25);
    expect(pol.doc.scheme).toMatchObject({ schemeNo: 'S1-SIS-TEST' });
    expect((await q('SELECT count(*)::int AS n FROM policy_schemes WHERE policy_id = $1 AND application_id = $2', [policyId, app1.id]))[0].n).toBe(1);
    expect((await q('SELECT status FROM placements WHERE id = $1', [placementId]))[0].status).toBe('issued');
    expect((await ops.api('post', `/scheme-issuance/${app1.id}/cancel`).send({ reason: 'x' })).body.message).toContain('use Policy Cancellation');
  });

  it('cancels with a reason; once sent only an approver, and the slip is cancelled with it (FR-SIS-024)', async () => {
    const a = (await ops2.api('post', '/scheme-issuance').send(application())).body.data;
    expect((await ops2.api('post', `/scheme-issuance/${a.id}/cancel`).send({})).body.message).toBe('Reason is required');
    await complete(ops2.api, a.id);
    const sent = await ops2.api('post', `/scheme-issuance/${a.id}/send`).send({});
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    let r = await ops2.api('post', `/scheme-issuance/${a.id}/cancel`).send({ reasonCode: 'SAC-NOT-RELEASED' });
    expect(r.status).toBe(403);
    r = await head.api('post', `/scheme-issuance/${a.id}/cancel`).send({ reasonCode: 'SAC-NOT-RELEASED', reason: 'Loan not released' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await q('SELECT status FROM placements WHERE id = $1', [sent.body.data.placementId]))[0].status).toBe('cancelled');
    // the loan account is free again
    expect((await ops2.api('post', '/scheme-issuance').send(application({ loanAccount: a.loanAccount }))).status).toBe(201);
  });

  it('a declined application goes to another insurer of the scheme (FR-SIS-021)', async () => {
    const a = (await ops.api('post', '/scheme-issuance').send(application())).body.data;
    await complete(ops.api, a.id);
    expect((await ops.api('post', `/scheme-issuance/${a.id}/send`).send({})).status).toBe(200);
    expect((await ops.api('post', `/scheme-issuance/${a.id}/decline`).send({})).body.message).toBe('Reason is required');
    expect((await ops.api('post', `/scheme-issuance/${a.id}/decline`).send({ reason: 'Capacity full' })).status).toBe(200);
    expect((await ops.api('post', `/scheme-issuance/${a.id}/insurer`).send({ insuranceCompanyId: 2 })).body.message).toBe('Choose another insurer of the scheme');
    const r = await ops.api('post', `/scheme-issuance/${a.id}/insurer`).send({ insuranceCompanyId: 3 });
    expect(r.body.status).toBe('ready');
  });
});

describe('loan bookings upload (CR-05)', () => {
  it('creates an application per good row and reports the failed rows; .csv refused', async () => {
    const H = ['Scheme Code', 'Loan Account No.', 'Loan Booking Date', 'Loan Term (months)', 'Vehicle Release Date', 'Borrower First Name', 'Borrower Last Name', 'Birthday',
      'Nationality', 'ID Type', 'ID Number', 'Dealer Branch Code', 'Make', 'Model', 'Year Model', 'Chassis Number', 'Engine Number', 'Conduction Sticker', 'Invoice Price', 'Insurer',
      'ARA Signed On', 'ARA Payment Mode'];
    const insurerCode = (await q('SELECT code FROM insurance_companies WHERE id = 2'))[0].code;
    const row = (o = {}) => {
      const a = application();
      const v = { 'Scheme Code': a.schemeNo, 'Loan Account No.': a.loanAccount, 'Loan Booking Date': a.bookingDate, 'Loan Term (months)': '60', 'Vehicle Release Date': a.releaseDate,
        'Borrower First Name': 'Liza', 'Borrower Last Name': 'Santos', Birthday: '1990-05-01', Nationality: 'Filipino', 'ID Type': 'PhilID', 'ID Number': '9999-0000-1111',
        'Dealer Branch Code': 'TMK-MKT', Make: 'Toyota', Model: 'Vios', 'Year Model': String(a.yearModel), 'Chassis Number': a.chassisNumber, 'Engine Number': a.engineNumber,
        'Conduction Sticker': a.conductionSticker, 'Invoice Price': '950000', Insurer: insurerCode, 'ARA Signed On': a.araSignedOn, 'ARA Payment Mode': 'ADA', ...o };
      return H.map((h) => v[h] ?? '');
    };
    const file = writeXlsx({ sheets: [{ name: 'Data', columns: H.map((h) => ({ header: h })), rows: [row(), row({ 'Chassis Number': '' }), row({ 'Loan Account No.': '12' })] }] });
    const r = await ops.api('post', '/scheme-issuance/bookings/upload').attach('file', file, 'bookings.xlsx');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data, JSON.stringify(r.body.data.errors)).toMatchObject({ total: 3, created: 1, failed: 2 });
    expect(r.body.data.errors.map((e) => e.row)).toEqual([3, 4]);
    expect((await ops.api('get', '/scheme-issuance/bookings')).body.data[0]).toMatchObject({ rowsTotal: 3, rowsCreated: 1, rowsFailed: 2 });
    expect((await ops.api('post', '/scheme-issuance/bookings/upload').attach('file', Buffer.from('a,b'), 'b.csv')).body.message).toBe('Upload an Excel (.xlsx) file');
    expect((await ops.api('get', '/scheme-issuance/bookings/template')).status).toBe(200);
  });
});
