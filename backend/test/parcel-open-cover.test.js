/**
 * Parcel / Courier open policy and declarations (TIS-BRD-PJRN-09, FRS PJRN-09 FR-PCL-001 to 061; GAP-QUOTE-20 to 22, 24):
 * the parcel set-up and its checks, activation, endorsements of the open policy with maker-checker, Add parcel and the
 * TFS parcel upload with the checks of FR-PCL-012, the password-protected certificate e-mail and Print certificates of the
 * day, daily declarations closed by the job with late items, the monthly declaration with the taxes inside the flat
 * premium, the declaration file, sending and acceptance, cancellation and reversal, billing at the charge per certificate
 * with the service fee and gross remittance, access per permission, and the cargo shipment upload.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { today, addDays } from '../src/lib/dates.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { generateDocument } from '../src/modules/documents/emailDocuments.js';
import { marineDailyDeclarationClose, marineMonthlyDeclarationOpen } from '../src/jobs/handlers.js';
import { taxesInside } from '../src/modules/marine/terms.js';

let ctx;
const as = {};
const ids = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
const setSetting = async (key, value) => { await q('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = r.body.data.userId;
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const PARCEL_HEADERS = ['PARCEL_DATE', 'CUSTOMER_NAME', 'LOAN_ACCOUNT', 'ADDRESS_LINE', 'BARANGAY', 'CITY_MUNICIPALITY', 'PROVINCE', 'ZIP', 'MOBILE', 'EMAIL', 'DOCUMENTS', 'COURIER', 'WAYBILL_NO', 'DELIVERY_TYPE'];
const xlsx = (headers, rows) => writeXlsx({ sheets: [{ name: 'Data', columns: headers.map((h) => ({ header: h, type: 'text' })), rows }] });
const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

let T; // business date today
let P; // a parcel date in the month before
let prevPeriod;
let thisPeriod;
let axa;
const TFS = 'cl_sls_93';
const covers = [{ name: 'Marine (parcel)', line: 'MARINE', insurerPolicyNo: 'MN-HO-26-000631-00', sumInsured: 10000, premium: 12, commissionPercent: 3, coverDays: null },
  { name: 'Personal Accident', line: 'PA', insurerPolicyNo: 'PA-TBA', sumInsured: 50000, premium: 50, commissionPercent: 3, coverDays: 365 }];
let contract;
const parcel = (o = {}) => ({ parcelDate: T, customerName: 'Maria Clara Reyes', loanAccount: '0701-2026-118842', addressLine: '18 Sampaguita St.', barangay: 'Bel-Air', city: 'Makati City',
  province: 'Metro Manila', mobile: '09175550123', email: 'maria.reyes@example.ph', documentsSent: 'Certificate of registration; Deed of sale', waybillNo: '143298765012', deliveryType: 'Rush', ...o });

beforeAll(async () => {
  ctx = await setup();
  for (const [u, roles] of [['pc.ops', ['operations']], ['pc.sales', ['sales']], ['pc.mgr', ['accounting-manager']], ['pc.claims', ['claims']], ['pc.tsa', ['tis-sales-associate']],
    ['pc.fin', ['tis-finance']]]) await persona(u, roles);
  T = await today();
  const first = `${T.slice(0, 7)}-01`;
  P = addDays(first, -2);
  prevPeriod = P.slice(0, 7);
  thisPeriod = T.slice(0, 7);
  await setSetting('parcel.max_backdate_days', 60);
  axa = (await q("SELECT id FROM insurance_companies WHERE code = 'AXA'"))[0].id;
  contract = { coverType: 'parcel', clientId: TFS, insuranceCompanyId: axa, insurerReference: 'MN-HO-26-000631-00', periodFrom: addDays(T, -100), periodTo: addDays(T, 265),
    goodsDescription: 'Loan collateral documents sent by LBC Express', clauses: 'Truck Risk Clause with Robbery and Hijacking', covers, chargePerCertificate: 500,
    declarationEmail: 'declarations@axa.example.ph' };
});
afterAll(async () => { await pool.end(); });

let cover;
describe('open policy set-up (FR-PCL-001 to 004)', () => {
  it('refuses a parcel cover without type, reference, valid covers or a charge covering the premium; Sales cannot set one up', async () => {
    const msg = async (body) => (await as['pc.ops']('post', '/marine/open-covers').send(body)).body.errors?.map((e) => e.message) || [];
    expect(await msg({ ...contract, coverType: undefined, covers: undefined })).toContain('Choose the open cover type');
    expect(await msg({ ...contract, insurerReference: '' })).toContain("Enter the insurer's open policy number");
    expect(await msg({ ...contract, chargePerCertificate: 50 })).toContain('The charge per certificate cannot be lower than the premium per certificate (62.00)');
    expect(await msg({ ...contract, covers: [{ ...covers[0], premium: 0 }] })).toContain('Enter a sum insured and a premium greater than zero');
    expect(await msg({ ...contract, covers: [{ ...covers[0], commissionPercent: 130 }] })).toContain('The commission must be between 0% and 100%');
    expect(await msg({ ...contract, covers: [{ ...covers[0], line: 'FIRE' }] })).toContain('A parcel cover must be on the Marine or Personal Accident line');
    expect(await msg({ ...contract, covers: [covers[0], covers[0]] })).toContain('Cover Marine (parcel) is listed twice');
    expect(await msg({ ...contract, covers: [] })).toContain('Add at least one cover to the open cover');
    expect(await msg({ ...contract, declarationEmail: 'not-an-email' })).toContain('Enter the e-mail address the declaration file is sent to');
    expect((await as['pc.sales']('post', '/marine/open-covers').send(contract)).status).toBe(403);
    expect((await as['pc.tsa']('post', '/marine/open-covers').send(contract)).status).toBe(403);
  });

  it('saves a parcel cover in Draft with the delivered defaults: gross, daily declaration, monthly AXA file; premium 62, service fee 438', async () => {
    const r = await as['pc.ops']('post', '/marine/open-covers').send(contract);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    cover = r.body.data;
    expect(r.body.message).toBe(`Open cover ${cover.coverNumber} created`);
    expect(cover).toMatchObject({ coverType: 'parcel', status: 'draft', remittanceBasis: 'gross', dailyDeclaration: true, fileFrequency: 'monthly', fileLayout: 'axa-parcel',
      premiumPerCertificate: 62, chargePerCertificate: 500, serviceFeePerCertificate: 438, rates: [] });
    expect(cover.deliveryTypes.map((d) => d.label)).toEqual(['Rush', 'Regular']);
    const t = await as['pc.ops']('put', `/marine/open-covers/${cover.id}`).send({ coverType: 'cargo' });
    expect(t.status).toBe(400);
    expect(t.body.errors[0].message).toBe('The open cover type cannot change after the open cover is saved');
    // a cargo cover defaults to the net basis
    const cargo = await as['pc.ops']('post', '/marine/open-covers').send({ coverType: 'cargo', clientId: 'cl_sls_06', insuranceCompanyId: axa, periodFrom: addDays(T, -100), periodTo: addDays(T, 265),
      goodsDescription: 'Auto parts', rates: [{ conveyance: 'Land', ratePercent: 0.15, limit: 3000000 }], markupPercent: 0, minimumPremium: 500 });
    expect(cargo.body.data).toMatchObject({ coverType: 'cargo', remittanceBasis: 'net', dailyDeclaration: true });
  });

  it('activation issues the open policy without a bill, listing the covers and the remittance basis; an overlapping parcel cover is refused', async () => {
    const r = await as['pc.ops']('post', `/marine/open-covers/${cover.id}/activate`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const p = (await q('SELECT premium_total, doc, details FROM policies WHERE id = $1', [r.body.data.policyId]))[0];
    expect(Number(p.premium_total)).toBe(0);
    // remitted bill by bill (remittance per bill of open covers)
    expect(p.details.openCover).toBe(true);
    expect(p.doc).toMatchObject({ openCoverType: 'parcel', remittanceBasis: 'gross' });
    expect(p.doc.riskDetails.covers).toContain('Personal Accident: sum insured 50000.00, premium 50.00');
    const again = await as['pc.ops']('post', '/marine/open-covers').send({ ...contract, periodFrom: T, periodTo: addDays(T, 300) });
    expect(again.status).toBe(400);
    expect(again.body.errors[0].message).toMatch(new RegExp(`^Open cover ${cover.coverNumber} already covers Toyota Financial Services Philippines Corporation with AXA`));
    const edit = await as['pc.ops']('put', `/marine/open-covers/${cover.id}`).send({ chargePerCertificate: 600 });
    expect(edit.status).toBe(409);
    expect(edit.body.message).toMatch(/change it with an endorsement of the open policy/);
  });
});

let first;
describe('parcel certificates (FR-PCL-010 to 013)', () => {
  it('Add parcel checks the data, the period, the waybill and the address; read-only users cannot add', async () => {
    const add = (o, who = 'pc.sales') => as[who]('post', `/marine/open-covers/${cover.id}/parcels`).send(parcel(o));
    const err = async (o) => (await add(o)).body.errors?.[0]?.message;
    expect(await err({ waybillNo: '' })).toBe('Waybill no. is required');
    expect(await err({ parcelDate: addDays(T, 1) })).toBe('The parcel date cannot be after today');
    expect(await err({ parcelDate: addDays(T, -70) })).toBe('The parcel date is more than 60 days old: refer the parcel to the insurer');
    expect(await err({ parcelDate: addDays(T, -120) })).toMatch(/^The parcel date must fall within/);
    expect(await err({ province: 'Atlantis' })).toBe('Province Atlantis is not on the address list');
    expect(await err({ email: 'maria@' })).toBe('Enter a valid e-mail address');
    expect(await err({ deliveryType: 'Drone' })).toMatch(/^Delivery type must be one of Rush, Regular/);
    expect((await add({}, 'pc.claims')).status).toBe(403);
    const r = await add({ parcelDate: P });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    first = r.body.data;
    expect(r.body.message).toBe(`Certificate ${first.certificateNumber} issued`);
    expect(first.certificateNumber).toMatch(/^PCC-\d{4}-\d{6}$/);
    expect(first).toMatchObject({ kind: 'parcel', premium: 62, charge: 500, insuredValue: 60000, mobile: '+639175550123', late: false, possibleDuplicate: false, emailed: true });
    expect(first.covers.find((c) => c.line === 'PA')).toMatchObject({ from: P, to: addDays(P, 364) });
    expect(first.dailyDeclarationDate).toBe(P);
    expect(await err({ loanAccount: '0701-2026-999999' })).toBe(`Waybill 143298765012 is already on certificate ${first.certificateNumber}`);
    const dup = await add({ waybillNo: '143298765013', email: '', parcelDate: P });
    expect(dup.status).toBe(201);
    expect(dup.body.data.possibleDuplicate).toBe(true);
    expect(dup.body.warnings[0]).toBe(`Loan account 0701-2026-118842 already has certificate ${first.certificateNumber} of ${P}: issued and flagged as a possible duplicate`);
  });

  it('e-mails the certificate as a password-protected PDF (last six digits of the loan account)', async () => {
    const mail = (await q("SELECT * FROM email_outbox WHERE entity = 'marine_certificate' AND entity_id = $1", [first.id]))[0];
    expect(mail).toMatchObject({ to_address: 'maria.reyes@example.ph', subject: `Your parcel insurance certificate ${first.certificateNumber}` });
    expect(mail.body_html).toContain('last six digits of your TFS loan account');
    expect(mail.attachments[0]).toMatchObject({ kind: 'document', document: 'parcel-certificate' });
    const doc = await generateDocument('parcel-certificate', { certificateId: first.id });
    const pdf = doc.content.toString('latin1');
    expect(pdf.startsWith('%PDF-1.6')).toBe(true);
    expect(pdf).toMatch(/\/Encrypt \d+ 0 R/);
    expect(pdf).toContain('/CFM /AESV2');
    expect(pdf).not.toContain('Maria Clara Reyes');
    // the staff print is not protected
    const print = await as['pc.claims']('get', `/marine/certificates/${first.id}/print`).buffer(true).parse(binary);
    expect(print.status).toBe(200);
    expect(print.body.toString('latin1')).not.toContain('/Encrypt');
    expect(print.body.toString('latin1')).toContain('Maria Clara Reyes');
  });

  it('uploads the TFS parcel list: .xlsx only, required columns, one certificate per valid row, failed rows listed; the same file again creates nothing', async () => {
    const up = (buf, name, fields = {}) => {
      const r = as['pc.sales']('post', `/marine/open-covers/${cover.id}/parcels/upload`);
      for (const [k, v] of Object.entries(fields)) r.field(k, v);
      return r.attach('file', buf, name);
    };
    expect((await up(Buffer.from('a,b'), 'list.csv')).body.message).toBe('Upload an Excel (.xlsx) file');
    const noWaybill = await up(xlsx(PARCEL_HEADERS.filter((h) => h !== 'WAYBILL_NO'), [['', 'X']]), 'list.xlsx');
    expect(noWaybill.body.message).toBe('The file has no column WAYBILL_NO: download the template again');
    const rows = [
      ['', 'Juan Dela Cruz', '0701-2026-200001', '1 Rizal Ave.', '', 'Quezon City', 'Metro Manila', '', '', '', 'Deed of sale', '', 'WB-0001', 'Regular'],
      [dmy(T), 'Ana Santos', '0701-2026-200002', '2 Mabini St.', '', 'Cebu City', 'Cebu', '', '+639181112222', '', 'Certificate of registration', 'LBC Express', 'WB-0002', 'Rush'],
      ['', 'Pedro Penduko', '0701-2026-200003', '3 Luna St.', '', 'Makati City', 'Metro Manila', '', '', '', 'Deed of sale', '', '143298765012', 'Rush'],
    ];
    const r = await up(xlsx(PARCEL_HEADERS, rows), 'tfs-parcels.xlsx', { parcelDate: T });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Processed 3 rows: 2 created, 1 failed');
    expect(r.body.data.errors[0].text).toBe(`Row 4: Waybill 143298765012 is already on certificate ${first.certificateNumber}`);
    const again = await up(xlsx(PARCEL_HEADERS, rows), 'tfs-parcels.xlsx', { parcelDate: T });
    expect(again.body.message).toBe('Processed 3 rows: 0 created, 3 failed');
    const certs = (await as['pc.ops']('get', `/marine/open-covers/${cover.id}/certificates?from=${T}&to=${T}`)).body.data;
    expect(certs.map((x) => x.customerName).sort()).toEqual(['Ana Santos', 'Juan Dela Cruz']);
    expect(certs.every((x) => x.premium === 62 && x.emailed === false)).toBe(true);
    const uploads = (await as['pc.ops']('get', `/marine/open-covers/${cover.id}/uploads`)).body.data;
    expect(uploads[0]).toMatchObject({ kind: 'parcels', rowsTotal: 3, rowsCreated: 0, rowsFailed: 3 });
  });

  it('prints the certificates of the day that were not e-mailed; a day without them is refused', async () => {
    const day = await as['pc.sales']('get', `/marine/open-covers/${cover.id}/certificates/day-print?date=${T}`).buffer(true).parse(binary);
    expect(day.status).toBe(200);
    expect(day.body.subarray(0, 4).toString()).toBe('%PDF');
    const none = await as['pc.sales']('get', `/marine/open-covers/${cover.id}/certificates/day-print?date=${addDays(T, -50)}`);
    expect(none.status).toBe(409);
    expect(none.body.message).toBe(`All certificates of ${addDays(T, -50)} were e-mailed: nothing to print`);
  });
});

let decl;
describe('daily and monthly declarations, file and insurer (FR-PCL-020 to 024, 050, 051)', () => {
  it('the job closes the days ended (Nil without parcels); a parcel of a closed day is declared today as a late item', async () => {
    const out = await marineDailyDeclarationClose();
    expect(out.closed).toBeGreaterThanOrEqual(1);
    expect(out.nil).toBeGreaterThan(0);
    const days = (await as['pc.ops']('get', `/marine/open-covers/${cover.id}`)).body.data.dailyDeclarations;
    expect(days.find((d) => d.date === P)).toMatchObject({ status: 'closed', items: 2 });
    expect(days.find((d) => d.date === T)).toMatchObject({ status: 'open' });
    expect(days.find((d) => d.date === addDays(P, -1))).toMatchObject({ status: 'nil', items: 0 });
    const late = await as['pc.sales']('post', `/marine/open-covers/${cover.id}/parcels`).send(parcel({ customerName: 'Carlo Bautista', loanAccount: '0701-2026-300001', waybillNo: 'WB-LATE', email: '', parcelDate: P }));
    expect(late.status).toBe(201);
    expect(late.body.data).toMatchObject({ late: true, dailyDeclarationDate: T });
    expect(late.body.warnings).toContain(`Parcel date ${P} is already closed: the certificate is declared today as a late item`);
  });

  it('the monthly declaration takes its days, shows the taxes inside the flat premium and the charge; submit is refused while a day is open', async () => {
    const r = await as['pc.ops']('post', `/marine/open-covers/${cover.id}/declarations`).send({ period: prevPeriod });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    decl = r.body.data;
    expect(decl).toMatchObject({ shipments: 2, premium: 124, grossPremium: 124, taxesInside: true, chargeTotal: 1000, serviceFee: 876, commission: 3.72 });
    const marine = decl.coverLines.find((l) => l.line === 'MARINE');
    expect(marine).toMatchObject({ certificates: 2, premium: 24, commission: 0.72 });
    expect(Math.round((marine.net + marine.vat + marine.dst + marine.lgt) * 100)).toBe(2400);
    expect(taxesInside(12, { vat: 0.12, dst: 0.125, lgt: 0.0075 })).toEqual({ premium: 12, net: 9.58, vat: 1.15, dst: 1.2, lgt: 0.07 });
    expect(taxesInside(14880, { vat: 0.12, dst: 0.125, lgt: 0.0075 })).toEqual({ premium: 14880, net: 11880.24, vat: 1425.63, dst: 1485.03, lgt: 89.1 });
    expect(decl.dailyDeclarations.some((d) => d.status === 'nil')).toBe(true);
    const current = await as['pc.ops']('post', `/marine/open-covers/${cover.id}/declarations`).send({ period: thisPeriod });
    const refused = await as['pc.ops']('post', `/marine/declarations/${current.body.data.id}/submit`).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.message).toMatch(/^The daily declaration of \d{4}-\d{2}-\d{2} is still open$/);
    expect((await as['pc.sales']('post', `/marine/declarations/${decl.id}/submit`).send({})).status).toBe(403);
  });

  it('submit writes the AXA declaration file: one row per certificate and cover, control total equal to the premium; sending and acceptance', async () => {
    const s = await as['pc.ops']('post', `/marine/declarations/${decl.id}/submit`).send({});
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(s.body.data).toMatchObject({ status: 'submitted', fileStatus: 'generated' });
    expect(s.body.data.files[0].fileName).toBe(`AXA_MN-HO-26-000631-00_${prevPeriod.replace('-', '')}_${decl.declarationNumber}.xlsx`);
    const f = await as['pc.ops']('get', `/marine/declarations/${decl.id}/file`).buffer(true).parse(binary);
    const wb = readWorkbook(f.body);
    const sheet = (name) => wb.find((x) => x.name === name).rows;
    expect(sheet('Declaration').length).toBe(1 + 4);
    expect(sheet('Declaration')[0].slice(0, 5)).toEqual(['DECL_NO', 'DECL_DATE', 'CERT_NO', 'POLICY_NO', 'COVER']);
    expect(sheet('Declaration')[1]).toContain('REYES, MARIA CLARA');
    expect(sheet('Control').find((x) => x[0] === 'Total premium')[1]).toBe('124.00');
    expect((await q("SELECT status FROM open_cover_daily_declarations WHERE monthly_declaration_id = $1 AND status <> 'declared'", [decl.id])).length).toBe(0);
    const reg = await as['pc.ops']('get', `/marine/declarations/${decl.id}/register`).buffer(true).parse(binary);
    expect(readWorkbook(reg.body)[0].rows.length).toBe(3);
    const pdf = await as['pc.claims']('get', `/marine/declarations/${decl.id}/print`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    const send = await as['pc.ops']('post', `/marine/declarations/${decl.id}/send`);
    expect(send.body.message).toBe(`Declaration ${decl.declarationNumber} queued for e-mail to declarations@axa.example.ph`);
    const mail = (await q('SELECT attachments FROM email_outbox WHERE id = $1', [send.body.data.emailId]))[0];
    expect(mail.attachments.map((a) => a.document)).toEqual(['marine-declaration-file', 'marine-declaration-summary', 'parcel-certificate-register']);
    for (const a of mail.attachments) expect((await generateDocument(a.document, a.params)).content.length).toBeGreaterThan(100);
    expect((await as['pc.ops']('post', `/marine/declarations/${decl.id}/acceptance`).send({ result: 'accepted' })).body.errors[0].message).toBe("Enter the insurer's reference for the declaration");
    const acc = await as['pc.ops']('post', `/marine/declarations/${decl.id}/acceptance`).send({ result: 'accepted-with-differences', reference: 'AXA-DCL-1', rows: 3, premium: 112, remark: 'One certificate not received' });
    expect(acc.body.message).toBe('Insurer acceptance recorded');
    expect((await as['pc.ops']('post', `/marine/declarations/${decl.id}/file`)).status).toBe(409);
  });

  it('bills the client the charge per certificate: premium due to AXA in full (gross), service fee booked as income, commission to Direct Bill Processing', async () => {
    const b = await as['pc.ops']('post', `/marine/declarations/${decl.id}/bill`);
    expect(b.status, JSON.stringify(b.body)).toBe(200);
    expect(b.body.data).toMatchObject({ amount: 1000, premium: 124, serviceFee: 876, remittanceBasis: 'gross' });
    const rcv = (await q('SELECT * FROM receivables WHERE id = $1', [b.body.data.receivableId]))[0];
    expect(rcv).toMatchObject({ remittance_basis: 'gross', client_id: TFS });
    expect(Number(rcv.amount)).toBe(1000);
    const jl = await q(`SELECT sum(l.debit) AS d, sum(l.credit) AS c FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE j.transaction_code = $1`, [rcv.bill_number]);
    expect(Number(jl[0].d)).toBeCloseTo(1000, 2);
    expect(Number(jl[0].c)).toBeCloseTo(1000, 2);
    const fee = await q("SELECT j.id FROM journal_vouchers j JOIN posting_rules r ON r.id = j.posting_rule_id WHERE r.event_code = 'parcel.service_fee' AND j.transaction_code = $1", [rcv.bill_number]);
    expect(fee.length).toBe(1);
    const dbi = await q("SELECT basis, commission FROM direct_bill_items WHERE reference = $1", [rcv.bill_number]);
    expect(dbi[0].basis).toBe('gross');
    expect(Number(dbi[0].commission)).toBeCloseTo(3.72, 2);
    const pol = (await q('SELECT premium_total FROM policies WHERE id = $1', [cover.policyId || (await q('SELECT policy_id FROM open_covers WHERE id = $1', [cover.id]))[0].policy_id]))[0];
    expect(Number(pol.premium_total)).toBe(124);
  });
});

describe('cancellation and reversal (FR-PCL-014)', () => {
  it('a certificate on a submitted month is only reversed, by a second user holding approve:marine, as a negative line on the next month', async () => {
    const c = await as['pc.sales']('post', `/marine/certificates/${first.id}/cancel`).send({ reason: 'Parcel not sent' });
    expect(c.status).toBe(409);
    expect(c.body.message).toBe(`Certificate ${first.certificateNumber} is on submitted declaration ${decl.declarationNumber}: request a reversal`);
    expect((await as['pc.sales']('post', `/marine/certificates/${first.id}/reversal`).send({ reason: '' })).body.errors[0].message).toBe('Enter the reason for the cancellation');
    const rq = await as['pc.sales']('post', `/marine/certificates/${first.id}/reversal`).send({ reason: 'Parcel not sent' });
    expect(rq.body.data.reversalStatus).toBe('pending');
    const work = await as['pc.mgr']('get', '/my-work/items?perPage=200');
    expect(JSON.stringify(work.body)).toContain('Certificate reversal');
    expect((await as['pc.sales']('post', `/marine/certificates/${first.id}/reversal/decision`).send({ decision: 'approve' })).status).toBe(403);
    const ok = await as['pc.mgr']('post', `/marine/certificates/${first.id}/reversal/decision`).send({ decision: 'approve' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data.status).toBe('reversed');
    const current = (await as['pc.ops']('get', `/marine/open-covers/${cover.id}`)).body.data.declarations.find((d) => d.period === thisPeriod);
    expect(ok.body.message).toBe(`Certificate ${first.certificateNumber} reversed on declaration ${current.declarationNumber}`);
    const d = (await as['pc.ops']('get', `/marine/declarations/${current.id}`)).body.data;
    expect(d.reversals).toBe(1);
    expect(d.reversalItems[0].certificateNumber).toBe(first.certificateNumber);
    // 3 certificates of this month (2 uploaded, 1 late) less the reversal
    expect(d.premium).toBe(62 * 3 - 62);
    expect(d.chargeTotal).toBe(500 * 3 - 500);
  });

  it('a certificate of an open month is cancelled with a reason of the list', async () => {
    const x = (await as['pc.ops']('get', `/marine/open-covers/${cover.id}/certificates?search=Juan`)).body.data[0];
    expect((await as['pc.sales']('post', `/marine/certificates/${x.id}/cancel`).send({ reason: 'Changed my mind' })).status).toBe(400);
    expect((await as['pc.claims']('post', `/marine/certificates/${x.id}/cancel`).send({ reason: 'Parcel not sent' })).status).toBe(403);
    const c = await as['pc.sales']('post', `/marine/certificates/${x.id}/cancel`).send({ reason: 'Parcel not sent' });
    expect(c.status).toBe(200);
    expect(c.body.data).toMatchObject({ status: 'cancelled', dailyDeclarationId: null });
  });
});

describe('endorsement of the open policy (FR-PCL-005)', () => {
  let e;
  it('needs a reason and an effective date after the declared month; one pending at a time', async () => {
    const send = (b, who = 'pc.ops') => as[who]('post', `/marine/open-covers/${cover.id}/endorsements`).send(b);
    const changes = { covers: [covers[0], { ...covers[1], premium: 55 }], chargePerCertificate: 500 };
    expect((await send({ effectiveFrom: T, reason: '', changes })).body.errors[0].message).toBe('Enter the reason for the endorsement');
    const early = await send({ effectiveFrom: P, reason: 'AXA premium review', changes });
    expect(early.body.errors[0].message).toBe(`The endorsement can apply from ${thisPeriod}-01 at the earliest: the month before is already declared`);
    expect((await send({ effectiveFrom: `${thisPeriod}-01`, reason: 'AXA premium review', changes }, 'pc.sales')).status).toBe(403);
    const r = await send({ effectiveFrom: `${thisPeriod}-01`, reason: 'AXA premium review', changes });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    e = r.body.data;
    expect(e).toMatchObject({ status: 'pending', changedFields: ['covers'] });
    expect((await send({ effectiveFrom: T, reason: 'Again', changes: { clauses: 'x' } })).status).toBe(409);
  });

  it('is approved by another user holding approve:marine with an MOE number; certificates from the effective date follow it', async () => {
    expect((await as['pc.ops']('post', `/marine/endorsements/${e.id}/decision`).send({ decision: 'approve' })).status).toBe(403);
    const work = await as['pc.fin']('get', '/my-work/items?perPage=200');
    expect(JSON.stringify(work.body)).toContain('Open policy endorsement');
    const r = await as['pc.fin']('post', `/marine/endorsements/${e.id}/decision`).send({ decision: 'approve' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.endorsementNumber).toMatch(/^MOE-\d{4}-\d{5}$/);
    expect(r.body.message).toBe(`Endorsement ${r.body.data.endorsementNumber} approved, effective ${thisPeriod}-01`);
    const now = await as['pc.sales']('post', `/marine/open-covers/${cover.id}/parcels`).send(parcel({ customerName: 'Liza Soberano', loanAccount: '0701-2026-400001', waybillNo: 'WB-NEW', email: '' }));
    expect(now.body.data.premium).toBe(67);
    // a parcel of the previous month (before the effective date) keeps the terms it was issued on
    const old = await as['pc.sales']('post', `/marine/open-covers/${cover.id}/parcels`).send(parcel({ customerName: 'Old Terms', loanAccount: '0701-2026-400002', waybillNo: 'WB-OLD', email: '', parcelDate: P }));
    expect(old.body.data.premium).toBe(62);
    expect(old.body.data.late).toBe(true);
    const c = (await as['pc.ops']('get', `/marine/open-covers/${cover.id}`)).body.data;
    expect(c.covers[1].premium).toBe(55);
    expect(c.endorsements[0]).toMatchObject({ status: 'approved', reason: 'AXA premium review' });
  });
});

describe('jobs, access and marine cargo inland (FR-PCL-022, 030, 061)', () => {
  it('the monthly job opens nothing twice', async () => {
    const out = await marineMonthlyDeclarationOpen();
    expect(out.declarations).not.toContain(decl.declarationNumber);
    expect((await q('SELECT count(*)::int AS n FROM open_cover_declarations WHERE open_cover_id = $1 AND period = $2', [cover.id, prevPeriod]))[0].n).toBe(1);
  });

  it('grants: Sales and the TIS Sales personas add parcels but neither set up, endorse nor bill; Operations does not approve', async () => {
    const perms = async (role) => (await q('SELECT p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE r.code = $1', [role])).map((x) => x.code);
    for (const role of ['sales', 'tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head']) {
      expect(await perms(role), role).toEqual(expect.arrayContaining(['read:marine', 'write:parcel-certificates']));
      expect(await perms(role), role).not.toContain('write:marine');
    }
    expect(await perms('operations')).not.toContain('approve:marine');
    expect(await perms('accounting-manager')).toContain('approve:marine');
    expect((await as['pc.tsa']('post', `/marine/declarations/${decl.id}/bill`)).status).toBe(403);
  });

  it('uploads the cargo shipments of a day: priced at the Land rate with the minimum, refused above the limit', async () => {
    const cargo = (await as['pc.ops']('get', '/marine/open-covers?type=cargo')).body.data[0];
    await as['pc.ops']('post', `/marine/open-covers/${cargo.id}/activate`);
    const headers = ['SHIPMENT_DATE', 'CONVEYANCE', 'VOYAGE_FROM', 'VOYAGE_TO', 'DELIVERY_RECEIPT', 'GOODS', 'INVOICE_VALUE', 'CERTIFICATE'];
    const rows = [[dmy(T), 'Land', 'Manila', 'Batangas', 'DR-1', 'Auto parts', '850000', ''], [dmy(T), 'Land', 'Manila', 'Pampanga', 'DR-2', 'Tyres', '240000', 'Y'],
      [dmy(T), 'Land', 'Manila', 'Laguna', 'DR-3', 'Engines', '1600000', ''], [dmy(T), 'Land', 'Manila', 'Cavite', 'DR-4', 'Engines', '3200000', '']];
    const r = await as['pc.ops']('post', `/marine/open-covers/${cargo.id}/shipments/upload`).attach('file', xlsx(headers, rows), 'shipments.xlsx');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Processed 4 rows: 3 created, 1 failed');
    expect(r.body.data.errors[0].text).toBe('Row 5: Insured value 3200000.00 exceeds the Land limit per conveyance 3000000.00: refer the shipment to the insurer');
    const certs = (await as['pc.ops']('get', `/marine/open-covers/${cargo.id}/certificates`)).body.data;
    expect(certs.map((x) => x.premium).sort((a, b) => a - b)).toEqual([500, 1275, 2400]);
    expect(certs.every((x) => x.dailyDeclarationDate === T)).toBe(true);
    const wrong = await as['pc.sales']('post', `/marine/open-covers/${cargo.id}/parcels/upload`).attach('file', xlsx(PARCEL_HEADERS, []), 'p.xlsx');
    expect(wrong.status).toBe(409);
    expect(wrong.body.message).toBe('Parcels can only be uploaded on an active Parcel / Courier open cover');
  });
});
