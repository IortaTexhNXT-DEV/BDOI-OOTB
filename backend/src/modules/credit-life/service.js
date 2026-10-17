/**
 * Credit Life batches (TIS-BRD-PJRN-01, PJRN-02; FGA CL-01 to CL-04): the monthly batch of the loan accounts a
 * financing bank (TFS) insures, without a lead or quotation journey.
 *
 * A batch (CLB series) is opened for the bank, the insurer, the product (credit_life.batch_product) and the month; its
 * members (one per loan account) come from the bank's file (CREDIT_LIFE_COLUMNS) or are encoded one by one. Each member
 * is checked against the Credit Life rules of the quotations (quotations/creditLife.js, credit_life.rules: borrower age,
 * number of TFS accounts, loan tenor, sum insured) and the data checks (required fields, e-mail, +63 mobile, one active
 * certificate per loan account); a failing member is kept with its messages and is not issued.
 *
 * Issue: every valid member gets a certificate of cover (CLC series) on the master policy of its customer (CLMP series,
 * one per customer of the bank with the insurer, PJRN-02: "one master policy per customer covering multiple loans"),
 * cover from the loan release date (credit_life.cover_start) for the loan term, premium fixed per account or at the rate
 * per 1,000 (credit_life.batch_premium_basis); the certificate is e-mailed as a password-protected PDF
 * (certificates.js). Send to insurer forwards the list of the issued accounts (PJRN-01).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { num, round2 } from '../documents/common.js';
import { mapColumns, normKey } from '../documents/tabular.js';
import { ageOn, creditLifeRules } from '../quotations/creditLife.js';

/** Columns of the financing bank's Credit Life file; the template (Credit_Life_Members_Upload_Template.xlsx) is built from this list. */
export const CREDIT_LIFE_COLUMNS = [
  { key: 'customerNo', header: 'CUSTOMER_NO', aliases: ['customer no', 'customer number', 'cif'], format: "The bank's customer number: the customer's loans share one master policy (name and birth date when blank)", example: 'TFS-C-0045821' },
  { key: 'lastName', header: 'LAST_NAME', aliases: ['last name', 'surname'], required: true, format: 'Text', example: 'Dela Cruz' },
  { key: 'firstName', header: 'FIRST_NAME', aliases: ['first name'], required: true, format: 'Text', example: 'Juan' },
  { key: 'birthDate', header: 'BIRTH_DATE', aliases: ['birth date', 'birthday', 'date of birth'], required: true, format: 'Date DD/MM/YYYY or YYYY-MM-DD; under the age limit of credit_life.rules', example: '14/03/1980' },
  { key: 'loanAccount', header: 'LOAN_ACCOUNT', aliases: ['loan account', 'tfs loan account'], required: true, format: 'TFS loan number, 10 digits (credit_life.loan_account_pattern); one active certificate per loan account', example: '8005123456' },
  { key: 'loanAmount', header: 'LOAN_AMOUNT', aliases: ['loan amount', 'amount financed'], format: 'Amount', example: '1250000' },
  { key: 'loanTermMonths', header: 'LOAN_TERM_MONTHS', aliases: ['loan term', 'term'], required: true, format: 'Whole number of months; the cover follows the loan tenor (credit_life.rules termYears)', example: '60' },
  { key: 'releaseDate', header: 'RELEASE_DATE', aliases: ['release date', 'unit release date'], required: true, format: 'Date DD/MM/YYYY or YYYY-MM-DD, not in the future', example: '05/10/2026' },
  { key: 'bookingDate', header: 'BOOKING_DATE', aliases: ['booking date'], format: 'Date DD/MM/YYYY or YYYY-MM-DD the loan was booked, not in the future', example: '03/10/2026' },
  { key: 'maturityDate', header: 'MATURITY_DATE', aliases: ['maturity date'], format: 'Date DD/MM/YYYY or YYYY-MM-DD the loan matures, after the release date', example: '05/10/2031' },
  { key: 'outstandingBalance', header: 'OUTSTANDING_BALANCE', aliases: ['outstanding', 'outstanding balance'], format: 'Amount of the loan still outstanding', example: '1250000' },
  { key: 'gender', header: 'GENDER', aliases: ['sex'], format: 'M or F (Male / Female)', example: 'M' },
  { key: 'accountCount', header: 'ACCOUNT_COUNT', aliases: ['accounts', 'number of accounts'], format: "Number of the borrower's accounts with the bank (counted from the file when blank)", example: '1' },
  { key: 'sumInsured', header: 'SUM_INSURED', aliases: ['sum insured'], format: 'Amount; blank = credit_life.batch_sum_insured', example: '1000000' },
  { key: 'email', header: 'EMAIL', aliases: ['e-mail'], format: 'E-mail address; the certificate of cover is e-mailed to it', example: 'juan.delacruz@example.ph' },
  { key: 'mobile', header: 'MOBILE', aliases: ['mobile number'], format: 'Mobile number 09XXXXXXXXX or +639XXXXXXXXX', example: '09175550123' },
  { key: 'address', header: 'ADDRESS', format: 'House / unit, street, barangay', example: '18 Sampaguita St., Bel-Air' },
  { key: 'city', header: 'CITY', aliases: ['city / municipality'], format: 'City or municipality', example: 'Makati City' },
  { key: 'province', header: 'PROVINCE', format: 'Province', example: 'Metro Manila' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phMobile = (v) => {
  const m = /^(?:\+?63|0)(9\d{9})$/.exec(String(v || '').replace(/[\s()-]/g, ''));
  return m ? `+63${m[1]}` : null;
};
const dateOf = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) return isoDate(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
  return isoDate(s);
};
const genderOf = (v) => ({ M: 'M', MALE: 'M', F: 'F', FEMALE: 'F' })[String(v ?? '').trim().toUpperCase()] || null;
const nameOf = (m) => [m.first_name, m.last_name].filter(Boolean).join(' ');
const keyOf = (v) => (String(v.customerNo || '').trim() ? `NO:${String(v.customerNo).trim().toUpperCase()}`
  : `NB:${String(v.lastName || '').trim().toUpperCase()}|${String(v.firstName || '').trim().toUpperCase()}|${v.birthDate || ''}`);

export const batchOut = (b) => b && ({
  id: b.id, batchNumber: b.batch_number, financingClientId: b.financing_client_id, bankName: b.bank_name ?? null, insuranceCompanyId: b.insurance_company_id, insurerName: b.insurer_name ?? null,
  productId: b.product_id, productName: b.product_name ?? null, period: b.period, fileName: b.file_name, status: b.status, notes: b.notes,
  members: b.members ?? 0, valid: b.valid ?? 0, errors: b.error_count ?? 0, issued: b.issued ?? 0, cancelled: b.cancelled ?? 0,
  totalSumInsured: Number(b.total_sum_insured || 0), totalPremium: Number(b.total_premium || 0),
  issuedAt: b.issued_at, issuedBy: b.issued_by_name ?? b.issued_by, sentAt: b.sent_at, sentTo: b.sent_to, soaSentAt: b.soa_sent_at ?? null, soaSentTo: b.soa_sent_to ?? null,
  insurerSoaReference: b.insurer_soa_reference ?? null, createdAt: b.created_at, createdBy: b.created_by_name ?? b.created_by,
});
export const memberOut = (m) => ({
  id: m.id, batchId: m.batch_id, batchNumber: m.batch_number ?? null, masterPolicyId: m.master_policy_id, masterNumber: m.master_number ?? null, rowNo: m.row_no,
  certificateNumber: m.certificate_number, customerNo: m.customer_no, firstName: m.first_name, lastName: m.last_name, borrowerName: nameOf(m), birthDate: m.birth_date ? String(m.birth_date).slice(0, 10) : null,
  email: m.email, mobile: m.mobile, address: m.address, city: m.city, province: m.province, loanAccount: m.loan_account, loanAmount: m.loan_amount == null ? null : Number(m.loan_amount),
  loanTermMonths: m.loan_term_months, releaseDate: m.release_date ? String(m.release_date).slice(0, 10) : null, bookingDate: m.booking_date ? String(m.booking_date).slice(0, 10) : null,
  maturityDate: m.maturity_date ? String(m.maturity_date).slice(0, 10) : null, outstandingBalance: m.outstanding_balance == null ? null : Number(m.outstanding_balance), gender: m.gender ?? null,
  accountCount: m.account_count, sumInsured: Number(m.sum_insured), premium: Number(m.premium),
  coverFrom: m.cover_from ? String(m.cover_from).slice(0, 10) : null, coverTo: m.cover_to ? String(m.cover_to).slice(0, 10) : null, status: m.status, errors: m.errors || [],
  emailed: Boolean(m.email_id), emailedAt: m.emailed_at, issuedAt: m.issued_at, cancelReason: m.cancel_reason,
});

const BATCH_SELECT = `SELECT b.*, c.display_name AS bank_name, ic.name AS insurer_name, ic.contact_email AS insurer_email, p.name AS product_name, iu.display_name AS issued_by_name,
  cu.display_name AS created_by_name,
  (SELECT count(*)::int FROM credit_life_members m WHERE m.batch_id = b.id) AS members,
  (SELECT count(*)::int FROM credit_life_members m WHERE m.batch_id = b.id AND m.status = 'valid') AS valid,
  (SELECT count(*)::int FROM credit_life_members m WHERE m.batch_id = b.id AND m.status = 'error') AS error_count,
  (SELECT count(*)::int FROM credit_life_members m WHERE m.batch_id = b.id AND m.status = 'issued') AS issued,
  (SELECT count(*)::int FROM credit_life_members m WHERE m.batch_id = b.id AND m.status = 'cancelled') AS cancelled,
  (SELECT COALESCE(sum(m.sum_insured), 0) FROM credit_life_members m WHERE m.batch_id = b.id AND m.status IN ('valid', 'issued')) AS total_sum_insured,
  (SELECT COALESCE(sum(m.premium), 0) FROM credit_life_members m WHERE m.batch_id = b.id AND m.status IN ('valid', 'issued')) AS total_premium
  FROM credit_life_batches b JOIN clients c ON c.id = b.financing_client_id JOIN insurance_companies ic ON ic.id = b.insurance_company_id
  LEFT JOIN products p ON p.id = b.product_id LEFT JOIN users iu ON iu.id = b.issued_by LEFT JOIN users cu ON cu.id = b.created_by`;
export const MEMBER_SELECT = `SELECT m.*, b.batch_number, mp.master_number FROM credit_life_members m JOIN credit_life_batches b ON b.id = m.batch_id
  LEFT JOIN credit_life_master_policies mp ON mp.id = m.master_policy_id`;

export async function listBatches(q = {}) {
  return (await many(`${BATCH_SELECT} WHERE ($1::text IS NULL OR b.status = $1) AND ($2::text IS NULL OR b.batch_number ILIKE '%' || $2 || '%' OR c.display_name ILIKE '%' || $2 || '%')
    ORDER BY b.created_at DESC LIMIT 500`, [q.status || null, q.search || null])).map(batchOut);
}

export async function batchRow(id, db = { query }) {
  const b = (await db.query(`${BATCH_SELECT} WHERE b.id = $1 OR b.batch_number = $1`, [String(id)])).rows[0];
  if (!b) throw notFound('Credit Life batch not found');
  return b;
}

export async function getBatch(id, q = {}) {
  const b = await batchRow(id);
  const members = (await many(`${MEMBER_SELECT} WHERE m.batch_id = $1 AND ($2::text IS NULL OR m.status = $2)
    AND ($3::text IS NULL OR m.loan_account ILIKE '%' || $3 || '%' OR m.last_name ILIKE '%' || $3 || '%' OR m.first_name ILIKE '%' || $3 || '%' OR m.certificate_number ILIKE '%' || $3 || '%')
    ORDER BY m.row_no NULLS LAST, m.created_at LIMIT 20000`, [b.id, q.status || null, q.search || null])).map(memberOut);
  return { ...batchOut(b), memberList: members };
}

/** Choices of the New batch panel: the financing banks (clients), the Credit Life products, the defaults. */
export async function batchChoices() {
  const rules = await creditLifeRules();
  const codes = [...new Set([await getSetting('credit_life.batch_product', 'CL-COMP'), ...rules.products, 'CL-COMP', 'CL-VOL'].map((c) => String(c).toUpperCase()))];
  const products = await many('SELECT id AS value, name AS label, code FROM products WHERE upper(code) = ANY($1) ORDER BY code', [codes]);
  return { products, defaultProduct: String(await getSetting('credit_life.batch_product', 'CL-COMP')).toUpperCase(), rules,
    sumInsured: num(await getSetting('credit_life.batch_sum_insured', 1000000)), premiumBasis: await getSetting('credit_life.batch_premium_basis', 'fixed'),
    premiumPerAccount: num(await getSetting('credit_life.batch_premium_per_account', 2000)) };
}

export async function createBatch(b, user) {
  const client = await one('SELECT id FROM clients WHERE id = $1 OR client_code = $1', [String(b.financingClientId || '')]);
  if (!client) throw badRequest('Validation failed', [{ path: 'financingClientId', message: 'Choose the financing bank (a client)' }]);
  if (!(await one('SELECT 1 FROM insurance_companies WHERE id = $1', [b.insuranceCompanyId]))) throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: 'Unknown insurer' }]);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.period || ''))) throw badRequest('Validation failed', [{ path: 'period', message: 'The batch month is YYYY-MM' }]);
  const code = String(await getSetting('credit_life.batch_product', 'CL-COMP'));
  const productId = b.productId || (await one('SELECT id FROM products WHERE upper(code) = upper($1) LIMIT 1', [code]))?.id || null;
  const number = await nextDocumentNumber('credit_life_batch', { unique: { table: 'credit_life_batches', column: 'batch_number' } });
  const r = await one(`INSERT INTO credit_life_batches(batch_number, financing_client_id, insurance_company_id, product_id, period, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [number, client.id, b.insuranceCompanyId, productId, b.period, b.notes || null, user.id]);
  return getBatch(r.id);
}

/** Premium of a member: fixed per account, or the sum insured at the rate per 1,000 of credit_life.rules. */
async function premiumOf(si, rules) {
  if ((await getSetting('credit_life.batch_premium_basis', 'fixed')) === 'rate') return round2((si / 1000) * num(rules.ratePerThousand));
  return round2(num(await getSetting('credit_life.batch_premium_per_account', 2000)));
}

/**
 * Check one member (values in API shape) against the Credit Life rules and the data checks. Returns { values, errors }
 * (errors as messages; an empty list is a valid member). `siblings`: the other members of the batch (loan accounts of
 * the same customer, duplicate loan accounts).
 */
export async function checkMember(db, batch, v, siblings = []) {
  const rules = await creditLifeRules();
  const errors = [];
  const req = { lastName: 'Last name', firstName: 'First name', birthDate: 'Birth date', loanAccount: 'Loan account', loanTermMonths: 'Loan term (months)', releaseDate: 'Release date' };
  for (const [k, label] of Object.entries(req)) if (!String(v[k] ?? '').trim()) errors.push(`${label} is required`);
  const birth = dateOf(v.birthDate);
  const release = dateOf(v.releaseDate);
  if (v.birthDate && !birth) errors.push('The birth date is not a date (DD/MM/YYYY)');
  if (v.releaseDate && !release) errors.push('The release date is not a date (DD/MM/YYYY)');
  const now = await today();
  if (release && release > now) errors.push('The release date cannot be after today');
  const coverFrom = (await getSetting('credit_life.cover_start', 'release_date')) === 'batch_period' ? `${batch.period}-01` : release;
  if (birth && coverFrom) {
    const age = ageOn(birth, coverFrom);
    if (age > rules.maxAge) errors.push(`The borrower is ${age}: Credit Life covers borrowers aged up to ${rules.maxAge}`);
    if (age < 18) errors.push(`The borrower is ${age}: a borrower must be of age`);
  }
  const months = Number(v.loanTermMonths);
  const years = Math.ceil(months / 12);
  if (v.loanTermMonths !== undefined && v.loanTermMonths !== '' && (!Number.isInteger(months) || months < 1 || years < rules.termYears.min || years > rules.termYears.max)) {
    errors.push(`The term follows the loan tenor: ${rules.termYears.min} to ${rules.termYears.max} years`);
  }
  const account = String(v.loanAccount || '').trim();
  if (account && account.length > 30) errors.push('The loan account is at most 30 characters');
  const pattern = String((await getSetting('credit_life.loan_account_pattern', '^[0-9]{10}$')) || '');
  if (account && pattern && !new RegExp(pattern).test(account)) errors.push(`Loan account ${account} is not a TFS loan number (${pattern === '^[0-9]{10}$' ? '10 digits' : pattern})`);
  if (account && siblings.some((s) => s.loan_account === account)) errors.push(`Loan account ${account} is already in this batch`);
  const active = account ? (await db.query(`SELECT m.certificate_number FROM credit_life_members m WHERE m.loan_account = $1 AND m.status = 'issued'
    AND (m.cover_to IS NULL OR m.cover_to >= $2::date) LIMIT 1`, [account, coverFrom || now])).rows[0] : null;
  if (active) errors.push(`Loan account ${account} is already covered by certificate ${active.certificate_number}`);
  const key = keyOf({ ...v, birthDate: birth });
  const own = siblings.filter((s) => keyOf({ customerNo: s.customer_no, lastName: s.last_name, firstName: s.first_name, birthDate: s.birth_date ? String(s.birth_date).slice(0, 10) : '' }) === key);
  const given = v.accountCount === undefined || v.accountCount === null || v.accountCount === '' ? null : Number(v.accountCount);
  if (given !== null && (!Number.isInteger(given) || given < 1)) errors.push("Enter the number of the borrower's accounts as a whole number");
  const accounts = Math.max(given || 0, own.length + 1);
  if (accounts > rules.maxAccounts) errors.push(`The borrower has ${accounts} accounts: Credit Life excludes borrowers with more than ${rules.maxAccounts}`);
  const email = String(v.email || '').trim();
  if (email && !EMAIL_RE.test(email)) errors.push('Enter a valid e-mail address');
  const mobile = String(v.mobile || '').trim();
  const mobile63 = mobile ? phMobile(mobile) : null;
  if (mobile && !mobile63) errors.push('Enter the mobile number as 09XXXXXXXXX or +639XXXXXXXXX');
  const si = round2(num(v.sumInsured) > 0 ? num(v.sumInsured) : num(await getSetting('credit_life.batch_sum_insured', rules.defaultSumInsured)));
  if (si > num(rules.defaultSumInsured)) errors.push(`The sum insured is at most ${num(rules.defaultSumInsured).toFixed(2)}`);
  const loanAmount = v.loanAmount === undefined || v.loanAmount === null || v.loanAmount === '' ? null : round2(num(v.loanAmount));
  if (loanAmount !== null && !(loanAmount > 0)) errors.push('The loan amount must be greater than zero');
  // the TFS file's fields of the CLI Generated Report (RPT-OPS-01): booking and maturity dates, outstanding balance, gender
  const booking = dateOf(v.bookingDate);
  const maturity = dateOf(v.maturityDate);
  if (v.bookingDate && !booking) errors.push('The booking date is not a date (DD/MM/YYYY)');
  if (booking && booking > now) errors.push('The booking date cannot be after today');
  if (v.maturityDate && !maturity) errors.push('The maturity date is not a date (DD/MM/YYYY)');
  if (maturity && release && maturity <= release) errors.push('The maturity date must be after the release date');
  const outstanding = v.outstandingBalance === undefined || v.outstandingBalance === null || v.outstandingBalance === '' ? null : round2(num(v.outstandingBalance));
  if (outstanding !== null && (!Number.isFinite(outstanding) || outstanding < 0)) errors.push('The outstanding balance cannot be negative');
  const gender = genderOf(v.gender);
  if (String(v.gender ?? '').trim() && !gender) errors.push('Enter the gender as M or F');
  return {
    errors,
    values: { customerNo: String(v.customerNo || '').trim() || null, firstName: String(v.firstName || '').trim() || null, lastName: String(v.lastName || '').trim() || null, birthDate: birth,
      email: email || null, mobile: mobile63 || (mobile || null), address: String(v.address || '').trim() || null, city: String(v.city || '').trim() || null, province: String(v.province || '').trim() || null,
      loanAccount: account || '(blank)', loanAmount, loanTermMonths: Number.isInteger(months) ? months : null, releaseDate: release, accountCount: accounts, sumInsured: si,
      bookingDate: booking, maturityDate: maturity, outstandingBalance: outstanding, gender,
      premium: await premiumOf(si, rules), coverFrom, coverTo: coverFrom && Number.isInteger(months) && months > 0 ? addDays(addMonths(coverFrom, months), -1) : null },
  };
}
const addMonths = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
};

async function insertMember(db, batch, v, errors, user, rowNo = null) {
  return (await db.query(`INSERT INTO credit_life_members(batch_id, row_no, customer_no, first_name, last_name, birth_date, email, mobile, address, city, province, loan_account, loan_amount,
      loan_term_months, release_date, account_count, sum_insured, premium, cover_from, cover_to, status, errors, created_by, booking_date, maturity_date, outstanding_balance, gender)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING id`,
  [batch.id, rowNo, v.customerNo, v.firstName, v.lastName, v.birthDate, v.email, v.mobile, v.address, v.city, v.province, v.loanAccount, v.loanAmount, v.loanTermMonths, v.releaseDate,
    v.accountCount, v.sumInsured, v.premium, v.coverFrom, v.coverTo, errors.length ? 'error' : 'valid', JSON.stringify(errors), user.id, v.bookingDate, v.maturityDate,
    v.outstandingBalance, v.gender])).rows[0];
}

const assertDraft = (b) => { if (b.status !== 'draft') throw conflict(`Batch ${b.batch_number} is ${b.status}: its members can no longer change`); };

/** Encode one member (CL-01): refused with its messages when a check fails. */
export async function addMember(batchId, body, user) {
  return withTransaction(async (db) => {
    const b = await batchRow(batchId, db);
    assertDraft(b);
    const siblings = (await db.query("SELECT * FROM credit_life_members WHERE batch_id = $1 AND status IN ('valid', 'issued')", [b.id])).rows;
    const { values, errors } = await checkMember(db, b, body, siblings);
    if (errors.length) throw badRequest(errors[0], errors.map((message) => ({ path: 'member', message })));
    const r = await insertMember(db, b, values, [], user);
    return memberOut((await db.query(`${MEMBER_SELECT} WHERE m.id = $1`, [r.id])).rows[0]);
  });
}

/**
 * Upload the bank's file (CL-02): .xlsx with the required columns, at most credit_life.max_upload_rows rows. Every row
 * is kept: valid, or with its messages (not issued). The batch keeps the file name.
 */
export async function uploadMembers(batchId, { rows, headers, fileName }, user) {
  if (!String(fileName || '').toLowerCase().endsWith('.xlsx')) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file' }]);
  const have = new Set(headers || []);
  for (const c of CREDIT_LIFE_COLUMNS.filter((x) => x.required === true)) {
    if (![c.key, c.header, ...(c.aliases || [])].some((h) => have.has(normKey(h)))) {
      throw badRequest(`The file has no column ${c.header}: download the template again`, [{ path: 'file', message: `The file has no column ${c.header}: download the template again` }]);
    }
  }
  const max = Number(await getSetting('credit_life.max_upload_rows', 10000));
  if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; at most ${max} rows can be uploaded at once`, [{ path: 'file', message: `The file has ${rows.length} rows; at most ${max} rows can be uploaded at once` }]);
  return withTransaction(async (db) => {
    const b = await batchRow(batchId, db);
    assertDraft(b);
    const siblings = (await db.query("SELECT * FROM credit_life_members WHERE batch_id = $1 AND status IN ('valid', 'issued')", [b.id])).rows;
    const start = Number((await db.query('SELECT COALESCE(max(row_no), 0) AS n FROM credit_life_members WHERE batch_id = $1', [b.id])).rows[0].n);
    let valid = 0;
    const failed = [];
    for (const [i, raw] of rows.entries()) {
      const rowNo = i + 2;
      const v = mapColumns(raw, CREDIT_LIFE_COLUMNS);
      const { values, errors } = await checkMember(db, b, v, siblings);
      await insertMember(db, b, values, errors, user, start + rowNo - 1);
      if (errors.length) failed.push({ row: rowNo, message: errors.join('; '), text: `Row ${rowNo}: ${errors.join('; ')}` });
      else {
        valid += 1;
        siblings.push({ loan_account: values.loanAccount, customer_no: values.customerNo, last_name: values.lastName, first_name: values.firstName, birth_date: values.birthDate });
      }
    }
    await db.query('UPDATE credit_life_batches SET file_name = $2, updated_at = now() WHERE id = $1', [b.id, fileName]);
    return { total: rows.length, valid, failed: failed.length, errors: failed, message: `Processed ${rows.length} rows: ${valid} valid, ${failed.length} failed` };
  });
}

/** Remove a member of a draft batch (a failed row corrected and encoded again). */
export async function removeMember(id) {
  const m = await one(`${MEMBER_SELECT} WHERE m.id = $1`, [String(id)]);
  if (!m) throw notFound('Member not found');
  const b = await batchRow(m.batch_id);
  assertDraft(b);
  await query('DELETE FROM credit_life_members WHERE id = $1', [m.id]);
  return memberOut(m);
}

/** The master policy of a customer of the bank with the insurer (created on its first certificate). */
async function masterFor(db, b, m, user) {
  const key = keyOf({ customerNo: m.customer_no, lastName: m.last_name, firstName: m.first_name, birthDate: m.birth_date ? String(m.birth_date).slice(0, 10) : '' });
  const found = (await db.query('SELECT * FROM credit_life_master_policies WHERE financing_client_id = $1 AND insurance_company_id = $2 AND customer_key = $3',
    [b.financing_client_id, b.insurance_company_id, key])).rows[0];
  if (found) {
    await db.query('UPDATE credit_life_master_policies SET email = COALESCE($2, email), mobile = COALESCE($3, mobile), updated_at = now() WHERE id = $1', [found.id, m.email, m.mobile]);
    return found;
  }
  const number = await nextDocumentNumber('credit_life_master', { db, unique: { table: 'credit_life_master_policies', column: 'master_number' } });
  return (await db.query(`INSERT INTO credit_life_master_policies(master_number, financing_client_id, insurance_company_id, product_id, customer_key, customer_no, first_name, last_name, birth_date,
      email, mobile, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
  [number, b.financing_client_id, b.insurance_company_id, b.product_id, key, m.customer_no, m.first_name, m.last_name, m.birth_date, m.email, m.mobile, user.id])).rows[0];
}

/**
 * Issue a draft batch (CL-03, CL-04): a certificate of cover on the customer's master policy for every valid member,
 * each re-checked first (a member that no longer passes is marked with its messages), and the certificate e-mail queued.
 */
export async function issueBatch(batchId, user) {
  const { queueCertificateEmail } = await import('./certificates.js');
  return withTransaction(async (db) => {
    const b = await batchRow(batchId, db);
    assertDraft(b);
    await db.query('SELECT id FROM credit_life_batches WHERE id = $1 FOR UPDATE', [b.id]);
    const members = (await db.query("SELECT * FROM credit_life_members WHERE batch_id = $1 AND status = 'valid' ORDER BY row_no NULLS LAST, created_at", [b.id])).rows;
    if (!members.length) throw conflict(`Batch ${b.batch_number} has no valid member to issue`);
    let issued = 0;
    let emailed = 0;
    for (const m of members) {
      const active = (await db.query(`SELECT certificate_number FROM credit_life_members WHERE loan_account = $1 AND status = 'issued' AND id <> $2
        AND (cover_to IS NULL OR cover_to >= $3::date) LIMIT 1`, [m.loan_account, m.id, m.cover_from])).rows[0];
      if (active) {
        await db.query("UPDATE credit_life_members SET status = 'error', errors = $2, updated_at = now() WHERE id = $1",
          [m.id, JSON.stringify([`Loan account ${m.loan_account} is already covered by certificate ${active.certificate_number}`])]);
        continue;
      }
      const master = await masterFor(db, b, m, user);
      const number = await nextDocumentNumber('credit_life_certificate', { db, unique: { table: 'credit_life_members', column: 'certificate_number' } });
      await db.query(`UPDATE credit_life_members SET status = 'issued', certificate_number = $2, master_policy_id = $3, issued_at = now(), updated_at = now() WHERE id = $1`,
        [m.id, number, master.id]);
      issued += 1;
      if (await queueCertificateEmail(db, { ...m, certificate_number: number })) emailed += 1;
    }
    await db.query("UPDATE credit_life_batches SET status = 'issued', issued_at = now(), issued_by = $2, updated_at = now() WHERE id = $1", [b.id, user.id]);
    return { issued, emailed, message: `Batch ${b.batch_number} issued: ${issued} certificates, ${emailed} e-mailed` };
  });
}

/** Cancel an issued certificate with a reason. */
export async function cancelMember(id, reason, user) {
  if (!String(reason || '').trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'Enter the reason for the cancellation' }]);
  const m = await one(`${MEMBER_SELECT} WHERE m.id = $1 OR m.certificate_number = $1`, [String(id)]);
  if (!m) throw notFound('Member not found');
  if (m.status !== 'issued') throw conflict(`Certificate ${m.certificate_number || m.loan_account} is ${m.status}: only an issued certificate is cancelled`);
  await query("UPDATE credit_life_members SET status = 'cancelled', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), updated_at = now() WHERE id = $1", [m.id, String(reason).trim(), user.id]);
  return memberOut(await one(`${MEMBER_SELECT} WHERE m.id = $1`, [m.id]));
}

export async function listMasterPolicies(q = {}) {
  return many(`SELECT mp.id, mp.master_number AS "masterNumber", mp.customer_no AS "customerNo", concat_ws(' ', mp.first_name, mp.last_name) AS "borrowerName", mp.birth_date AS "birthDate",
      c.display_name AS "bankName", ic.name AS "insurerName", mp.status, mp.created_at AS "createdAt",
      (SELECT count(*)::int FROM credit_life_members m WHERE m.master_policy_id = mp.id AND m.status = 'issued') AS certificates,
      (SELECT COALESCE(sum(m.sum_insured), 0)::float FROM credit_life_members m WHERE m.master_policy_id = mp.id AND m.status = 'issued') AS "sumInsured"
    FROM credit_life_master_policies mp JOIN clients c ON c.id = mp.financing_client_id JOIN insurance_companies ic ON ic.id = mp.insurance_company_id
    WHERE ($1::text IS NULL OR mp.master_number ILIKE '%' || $1 || '%' OR mp.last_name ILIKE '%' || $1 || '%' OR mp.first_name ILIKE '%' || $1 || '%' OR mp.customer_no ILIKE '%' || $1 || '%')
    ORDER BY mp.created_at DESC LIMIT 500`, [q.search || null]);
}

export async function getMasterPolicy(id) {
  const mp = await one(`SELECT mp.*, c.display_name AS bank_name, ic.name AS insurer_name, p.name AS product_name FROM credit_life_master_policies mp
    JOIN clients c ON c.id = mp.financing_client_id JOIN insurance_companies ic ON ic.id = mp.insurance_company_id LEFT JOIN products p ON p.id = mp.product_id
    WHERE mp.id = $1 OR mp.master_number = $1`, [String(id)]);
  if (!mp) throw notFound('Master policy not found');
  const certificates = (await many(`${MEMBER_SELECT} WHERE m.master_policy_id = $1 ORDER BY m.issued_at`, [mp.id])).map(memberOut);
  return { id: mp.id, masterNumber: mp.master_number, customerNo: mp.customer_no, borrowerName: nameOf(mp), birthDate: mp.birth_date ? String(mp.birth_date).slice(0, 10) : null,
    email: mp.email, mobile: mp.mobile, bankName: mp.bank_name, insurerName: mp.insurer_name, productName: mp.product_name, status: mp.status, createdAt: mp.created_at, certificates };
}
