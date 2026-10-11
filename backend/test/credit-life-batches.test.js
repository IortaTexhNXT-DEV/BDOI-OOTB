/**
 * Credit Life batches (TIS-BRD-PJRN-01, PJRN-02; FGA CL-01 to CL-04; GAP-QUOTE-18): the monthly batch of the financing
 * bank, members encoded or uploaded and checked against the Credit Life rules of the quotations (credit_life.rules),
 * issue with one master policy per customer and a certificate of cover per loan, the password-protected certificate
 * e-mail, forwarding to the insurer, cancellation, and access per permission.
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
import { certificatePassword } from '../src/modules/credit-life/certificates.js';

let ctx;
const as = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const HEADERS = ['CUSTOMER_NO', 'LAST_NAME', 'FIRST_NAME', 'BIRTH_DATE', 'LOAN_ACCOUNT', 'LOAN_AMOUNT', 'LOAN_TERM_MONTHS', 'RELEASE_DATE', 'ACCOUNT_COUNT', 'SUM_INSURED', 'EMAIL', 'MOBILE'];
const xlsx = (headers, rows) => writeXlsx({ sheets: [{ name: 'Data', columns: headers.map((h) => ({ header: h, type: 'text' })), rows }] });
const TFS = 'cl_sls_93';
let T;
let insurer;
let batch;

beforeAll(async () => {
  ctx = await setup();
  for (const [u, roles] of [['cl.ops', ['operations']], ['cl.sales', ['sales']], ['cl.claims', ['claims']], ['cl.tsa', ['tis-sales-associate']], ['cl.toa', ['tis-ops-associate']]]) await persona(u, roles);
  T = await today();
  insurer = (await q("SELECT id FROM insurance_companies WHERE status = 'active' ORDER BY id LIMIT 1"))[0].id;
});
afterAll(async () => { await pool.end(); });

describe('batch and members (PJRN-01, CL-01, CL-02)', () => {
  it('opens the monthly batch of the financing bank; Sales and the TIS Sales personas only read; Claims has no access', async () => {
    const body = { financingClientId: TFS, insuranceCompanyId: insurer, period: T.slice(0, 7) };
    expect((await as['cl.sales']('post', '/credit-life/batches').send(body)).status).toBe(403);
    expect((await as['cl.tsa']('post', '/credit-life/batches').send(body)).status).toBe(403);
    expect((await as['cl.claims']('get', '/credit-life/batches')).status).toBe(403);
    expect((await as['cl.ops']('post', '/credit-life/batches').send({ ...body, period: '2026-13' })).status).toBe(400);
    const r = await as['cl.toa']('post', '/credit-life/batches').send(body);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    batch = r.body.data;
    expect(batch.batchNumber).toMatch(/^CLB-\d{4}-\d{5}$/);
    expect(batch).toMatchObject({ status: 'draft', productName: 'Credit Life - Compulsory', members: 0 });
    expect((await as['cl.tsa']('get', `/credit-life/batches/${batch.id}`)).status).toBe(200);
  });

  it('encodes a member checked against the Credit Life rules: age, tenor, duplicate loan; premium fixed per account, cover over the loan term', async () => {
    const add = (o) => as['cl.ops']('post', `/credit-life/batches/${batch.id}/members`).send({ customerNo: 'C-001', lastName: 'Dela Cruz', firstName: 'Juan', birthDate: '1980-03-14',
      loanAccount: '8005000001', loanAmount: 1250000, loanTermMonths: 60, releaseDate: addDays(T, -5), email: 'juan@example.ph', mobile: '09175550123', ...o });
    const old = await add({ birthDate: '1950-01-01', loanAccount: '8005000099' });
    expect(old.status).toBe(400);
    expect(old.body.message).toMatch(/^The borrower is \d+: Credit Life excludes borrowers aged 65 and over$/);
    expect((await add({ loanTermMonths: 84, loanAccount: '8005000098' })).body.message).toBe('The term follows the loan tenor: 1 to 5 years');
    expect((await add({ email: 'juan@', loanAccount: '8005000097' })).body.message).toBe('Enter a valid e-mail address');
    expect((await add({ releaseDate: addDays(T, 3), loanAccount: '8005000096' })).body.message).toBe('The release date cannot be after today');
    expect((await add({ sumInsured: 2000000, loanAccount: '8005000095' })).body.message).toBe('The sum insured is at most 1000000.00');
    const r = await add({});
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data).toMatchObject({ status: 'valid', sumInsured: 1000000, premium: 2000, mobile: '+639175550123', coverFrom: addDays(T, -5) });
    expect(r.body.data.coverTo).toBe(addDays(`${String(Number(addDays(T, -5).slice(0, 4)) + 5)}${addDays(T, -5).slice(4)}`, -1));
    expect((await add({ firstName: 'Juana' })).body.message).toBe('Loan account 8005000001 is already in this batch');
  });

  it('uploads the bank\'s file: every row kept, valid or with its messages; .xlsx only; required columns', async () => {
    const up = (buf, name) => as['cl.ops']('post', `/credit-life/batches/${batch.id}/upload`).attach('file', buf, name);
    expect((await up(Buffer.from('a'), 'members.csv')).body.message).toBe('Upload an Excel (.xlsx) file');
    expect((await up(xlsx(HEADERS.filter((h) => h !== 'LOAN_ACCOUNT'), [['x']]), 'members.xlsx')).body.message).toBe('The file has no column LOAN_ACCOUNT: download the template again');
    const rel = `${T.slice(8, 10)}/${T.slice(5, 7)}/${T.slice(0, 4)}`;
    const rows = [
      ['C-001', 'Dela Cruz', 'Juan', '14/03/1980', '8005000002', '900000', '36', rel, '', '', 'juan@example.ph', ''],
      ['C-002', 'Santos', 'Ana', '01/07/1990', '8005000003', '800000', '48', rel, '', '', '', '+639181112222'],
      ['C-003', 'Reyes', 'Lolo', '01/01/1950', '8005000004', '500000', '24', rel, '', '', '', ''],
      ['C-004', 'Lim', 'Many', '02/02/1985', '8005000005', '500000', '24', rel, '7', '', '', ''],
    ];
    const r = await up(xlsx(HEADERS, rows), 'tfs-credit-life.xlsx');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Processed 4 rows: 2 valid, 2 failed');
    expect(r.body.data.errors.map((e) => e.row)).toEqual([4, 5]);
    expect(r.body.data.errors[1].text).toBe('Row 5: The borrower has 7 accounts: Credit Life excludes borrowers with more than 6');
    const b = (await as['cl.ops']('get', `/credit-life/batches/${batch.id}`)).body.data;
    expect(b).toMatchObject({ members: 5, valid: 3, errors: 2, fileName: 'tfs-credit-life.xlsx', totalPremium: 6000 });
  });
});

let issued;
describe('issue, certificates and the insurer (PJRN-02, CL-03, CL-04)', () => {
  it('issues a certificate per valid loan on one master policy per customer and e-mails it as a password-protected PDF', async () => {
    expect((await as['cl.sales']('post', `/credit-life/batches/${batch.id}/issue`)).status).toBe(403);
    const r = await as['cl.ops']('post', `/credit-life/batches/${batch.id}/issue`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toEqual({ issued: 3, emailed: 2, message: `Batch ${batch.batchNumber} issued: 3 certificates, 2 e-mailed` });
    const b = (await as['cl.ops']('get', `/credit-life/batches/${batch.id}?status=issued`)).body.data;
    issued = b.memberList;
    expect(issued.every((m) => /^CLC-\d{4}-\d{6}$/.test(m.certificateNumber))).toBe(true);
    const juan = issued.filter((m) => m.customerNo === 'C-001');
    expect(juan).toHaveLength(2);
    expect(new Set(juan.map((m) => m.masterNumber)).size).toBe(1);
    expect(issued.find((m) => m.customerNo === 'C-002').masterNumber).not.toBe(juan[0].masterNumber);
    const mail = (await q("SELECT * FROM email_outbox WHERE entity = 'credit_life_member' AND entity_id = $1", [juan[0].id]))[0];
    expect(mail.subject).toBe(`Your Credit Life certificate of cover ${juan[0].certificateNumber}`);
    expect(mail.body_html).toContain('birth date as DDMMYYYY');
    const doc = await generateDocument(mail.attachments[0].document, mail.attachments[0].params);
    const pdf = doc.content.toString('latin1');
    expect(pdf).toMatch(/\/Encrypt \d+ 0 R/);
    expect(pdf).not.toContain('Dela Cruz');
    expect(await certificatePassword({ birth_date: '1980-03-14', loan_account: '8005000001' })).toBe('14031980');
    await q("UPDATE app_settings SET value = '\"loan_last4\"' WHERE key = 'credit_life.certificate_password'");
    clearSettingsCache();
    expect(await certificatePassword({ birth_date: '1980-03-14', loan_account: '8005000001' })).toBe('0001');
    await q("UPDATE app_settings SET value = '\"birth_ddmmyyyy\"' WHERE key = 'credit_life.certificate_password'");
    clearSettingsCache();
    const print = await as['cl.tsa']('get', `/credit-life/members/${juan[0].id}/certificate`).buffer(true).parse(binary);
    expect(print.status).toBe(200);
    expect(print.body.toString('latin1')).toContain('Dela Cruz');
    expect((await as['cl.ops']('post', `/credit-life/batches/${batch.id}/members`).send({ lastName: 'X' })).status).toBe(409);
  });

  it('forwards the issued accounts to the insurer and lists the master policies', async () => {
    const s = await as['cl.ops']('post', `/credit-life/batches/${batch.id}/send`).send({ to: 'creditlife@insurer.example.ph' });
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(s.body.data).toMatchObject({ to: 'creditlife@insurer.example.ph', accounts: 3 });
    const mail = (await q('SELECT attachments FROM email_outbox WHERE id = $1', [s.body.data.emailId]))[0];
    const list = await generateDocument(mail.attachments[0].document, mail.attachments[0].params);
    expect(readWorkbook(list.content)[0].rows.length).toBe(4);
    expect((await as['cl.ops']('get', `/credit-life/batches/${batch.id}`)).body.data.status).toBe('sent');
    const masters = (await as['cl.sales']('get', '/credit-life/master-policies?search=Dela Cruz')).body.data;
    expect(masters).toHaveLength(1);
    expect(masters[0]).toMatchObject({ certificates: 2, sumInsured: 2000000 });
    const one = (await as['cl.sales']('get', `/credit-life/master-policies/${masters[0].id}`)).body.data;
    expect(one.certificates.map((c) => c.loanAccount).sort()).toEqual(['8005000001', '8005000002']);
    const pdf = await as['cl.sales']('get', `/credit-life/master-policies/${masters[0].id}/print`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
  });

  it('a covered loan is refused in a later batch; a certificate is cancelled with a reason', async () => {
    const b2 = (await as['cl.ops']('post', '/credit-life/batches').send({ financingClientId: TFS, insuranceCompanyId: insurer, period: T.slice(0, 7) })).body.data;
    const again = await as['cl.ops']('post', `/credit-life/batches/${b2.id}/members`).send({ lastName: 'Dela Cruz', firstName: 'Juan', birthDate: '1980-03-14', loanAccount: '8005000001',
      loanTermMonths: 60, releaseDate: T });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/^Loan account 8005000001 is already covered by certificate CLC-/);
    const x = issued.find((m) => m.loanAccount === '8005000003');
    expect((await as['cl.ops']('post', `/credit-life/members/${x.id}/cancel`).send({ reason: '' })).status).toBe(400);
    const c = await as['cl.ops']('post', `/credit-life/members/${x.id}/cancel`).send({ reason: 'Loan cancelled before release' });
    expect(c.body.data.status).toBe('cancelled');
    expect((await as['cl.ops']('post', `/credit-life/members/${x.id}/cancel`).send({ reason: 'again' })).status).toBe(409);
    const audit = await q("SELECT action FROM audit_log WHERE entity IN ('credit_life_batch', 'credit_life_member') ORDER BY id");
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['create', 'upload', 'issue', 'send', 'cancel']));
  });
});
