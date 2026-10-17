/**
 * Credit Life documents on the BrokerVerse document engine (lib/pdf: company letterhead, footer, Documents and Reports
 * Layout): the certificate of cover of one loan account (CL-03), printed by staff or e-mailed to the borrower as a
 * password-protected PDF (CL-04, credit_life.certificate_password), the master policy schedule of a customer, and the
 * list of a batch forwarded to the insurer (PJRN-01).
 */
import { many, one } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { documentAttachment, queueEmail } from '../../lib/mailer.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { printContext } from '../../lib/pdf/index.js';
import { buildPdf } from '../documents/pdf.js';
import { formatters, kv } from '../documents/templates.js';
import { renderTemplate } from '../documents/common.js';
import { signatoryFor, signatureBlock } from '../documents/signatory.js';
import { MEMBER_SELECT, batchRow } from './service.js';

const name = (m) => [m.first_name, m.last_name].filter(Boolean).join(' ');
const PASSWORD_HINTS = { birth_ddmmyyyy: 'The PDF opens with your birth date as DDMMYYYY (for example 14031980).',
  loan_last4: 'The PDF opens with the last four digits of your loan account number.', loan_last6: 'The PDF opens with the last six digits of your loan account number.' };

/** The password of a member's e-mailed certificate (credit_life.certificate_password); '' when the rule is none. */
export async function certificatePassword(m) {
  const rule = String((await getSetting('credit_life.certificate_password', 'birth_ddmmyyyy')) || 'none');
  const digits = (v) => String(v || '').replace(/\D/g, '');
  if (rule === 'birth_ddmmyyyy' && m.birth_date) {
    const d = String(m.birth_date instanceof Date ? m.birth_date.toISOString() : m.birth_date).slice(0, 10);
    return `${d.slice(8, 10)}${d.slice(5, 7)}${d.slice(0, 4)}`;
  }
  if (rule === 'loan_last4') return digits(m.loan_account).slice(-4);
  if (rule === 'loan_last6') return digits(m.loan_account).slice(-6);
  return '';
}

async function memberRow(id) {
  const m = await one(`${MEMBER_SELECT.replace('SELECT m.*, b.batch_number, mp.master_number', `SELECT m.*, b.batch_number, mp.master_number, b.financing_client_id, b.insurance_company_id,
    c.display_name AS bank_name, ic.name AS insurer_name, p.name AS product_name`)} JOIN clients c ON c.id = b.financing_client_id
    JOIN insurance_companies ic ON ic.id = b.insurance_company_id LEFT JOIN products p ON p.id = b.product_id WHERE m.id = $1 OR m.certificate_number = $1`, [String(id)]);
  if (!m) throw notFound('Certificate not found');
  return m;
}

/** Document spec of a certificate of cover. */
export async function certificateSpec(m, ctx) {
  const f = formatters(ctx);
  const cancelled = m.status === 'cancelled';
  return {
    title: 'Credit Life Certificate of Cover', number: m.certificate_number, watermark: cancelled ? 'CANCELLED' : (m.status !== 'issued' ? 'NOT ISSUED' : undefined),
    meta: kv([['Master policy', m.master_number], ['Product', m.product_name], ['Insurer', m.insurer_name], ['Financing bank', m.bank_name], ['Batch', m.batch_number],
      ['Date issued', m.issued_at ? f.date(String(m.issued_at instanceof Date ? m.issued_at.toISOString() : m.issued_at).slice(0, 10)) : '']]),
    sections: [
      { heading: 'Insured borrower', rows: kv([['Name', name(m)], ['Customer number', m.customer_no], ['Date of birth', f.date(m.birth_date)],
        ['Address', [m.address, m.city, m.province].filter(Boolean).join(', ')]]) },
      { heading: 'Loan and cover', rows: kv([['Loan account', m.loan_account], ['Amount financed', m.loan_amount == null ? '' : f.ccy(m.loan_amount)], ['Loan term', m.loan_term_months ? `${m.loan_term_months} months` : ''],
        ['Sum insured', f.ccy(m.sum_insured)], ['Premium', f.ccy(m.premium)], ['Period of cover', m.cover_from ? `${f.date(m.cover_from)} to ${f.date(m.cover_to)}` : '']]) },
      { text: (await getSetting('credit_life.certificate_wording', null)) || '' },
      ...(cancelled ? [] : [{ signatures: [signatureBlock('For and on behalf of the insurer', await signatoryFor(null))] }]),
    ],
  };
}

/** PDF of a certificate; `protect` encrypts it with the password rule (the copy e-mailed to the borrower). */
export async function certificatePdf(id, { protect = false } = {}) {
  const m = await memberRow(id);
  const ctx = await printContext();
  const spec = await certificateSpec(m, ctx);
  const password = protect ? await certificatePassword(m) : '';
  return { pdf: buildPdf({ ...ctx, ...spec, password: password || undefined }), row: m };
}

/** Queue the certificate e-mail of an issued member with an e-mail address (credit_life.email_certificate); returns the outbox id or null. */
export async function queueCertificateEmail(db, m) {
  if (!m.email || (await getSetting('credit_life.email_certificate', true)) === false) return null;
  const rule = String((await getSetting('credit_life.certificate_password', 'birth_ddmmyyyy')) || 'none');
  const vars = { certificateNumber: m.certificate_number, borrowerName: name(m), loanAccount: m.loan_account, passwordHint: PASSWORD_HINTS[rule] || '' };
  const id = await queueEmail({ db, to: m.email, template: 'credit-life-certificate', entity: 'credit_life_member', entityId: m.id,
    subject: renderTemplate((await getSetting('credit_life.certificate_email_subject', null)) || '', vars, { html: false }),
    html: renderTemplate((await getSetting('credit_life.certificate_email_body', null)) || '', vars),
    attachments: [documentAttachment('credit-life-certificate', { memberId: m.id }, `credit-life-certificate-${m.certificate_number}.pdf`)] });
  await db.query('UPDATE credit_life_members SET email_id = $2, emailed_at = now() WHERE id = $1', [m.id, id]);
  return id;
}

/** Master policy schedule: the customer and the certificates of cover of all their loans. */
export async function masterPolicyPdf(id) {
  const mp = await one(`SELECT mp.*, c.display_name AS bank_name, ic.name AS insurer_name, p.name AS product_name FROM credit_life_master_policies mp
    JOIN clients c ON c.id = mp.financing_client_id JOIN insurance_companies ic ON ic.id = mp.insurance_company_id LEFT JOIN products p ON p.id = mp.product_id
    WHERE mp.id = $1 OR mp.master_number = $1`, [String(id)]);
  if (!mp) throw notFound('Master policy not found');
  const rows = await many("SELECT * FROM credit_life_members WHERE master_policy_id = $1 AND status IN ('issued', 'cancelled') ORDER BY issued_at", [mp.id]);
  const ctx = await printContext();
  const f = formatters(ctx);
  return { number: mp.master_number, pdf: buildPdf({ ...ctx, title: 'Credit Life Master Policy', number: mp.master_number,
    meta: kv([['Customer', name(mp)], ['Customer number', mp.customer_no], ['Date of birth', f.date(mp.birth_date)], ['Product', mp.product_name], ['Insurer', mp.insurer_name], ['Financing bank', mp.bank_name]]),
    sections: [{ heading: 'Loans covered', table: {
      columns: [{ key: 'certificate', label: 'Certificate' }, { key: 'loan', label: 'Loan account' }, { key: 'period', label: 'Period of cover' }, { key: 'sumInsured', label: 'Sum insured', type: 'money' },
        { key: 'premium', label: 'Premium', type: 'money' }, { key: 'status', label: 'Status' }],
      rows: rows.map((m) => ({ certificate: m.certificate_number, loan: m.loan_account, period: `${f.date(m.cover_from)} to ${f.date(m.cover_to)}`, sumInsured: Number(m.sum_insured), premium: Number(m.premium),
        status: m.status === 'issued' ? 'In force' : 'Cancelled' })) } }] }) };
}

/** The accounts of a batch forwarded to the insurer (Excel): the issued certificates with the borrower and the loan. */
export async function batchList(batchId) {
  const b = await batchRow(batchId);
  const rows = await many("SELECT m.*, mp.master_number FROM credit_life_members m LEFT JOIN credit_life_master_policies mp ON mp.id = m.master_policy_id WHERE m.batch_id = $1 AND m.status = 'issued' ORDER BY m.row_no NULLS LAST", [b.id]);
  const header = ['Certificate', 'Master policy', 'Customer no.', 'Last name', 'First name', 'Birth date', 'Gender', 'Loan account', 'Loan amount', 'Outstanding balance', 'Booking date',
    'Release date', 'Maturity date', 'Term (months)', 'Cover from', 'Cover to', 'Sum insured', 'Premium'];
  const day = (d) => String(d || '').slice(0, 10);
  const content = writeXlsx({ title: `Credit Life batch ${b.batch_number}`, sheets: [{ name: 'Accounts',
    columns: header.map((h) => ({ header: h, type: ['Loan amount', 'Outstanding balance', 'Sum insured', 'Premium'].includes(h) ? 'money' : 'text', width: 16 })),
    rows: rows.map((m) => [m.certificate_number, m.master_number, m.customer_no || '', m.last_name, m.first_name, day(m.birth_date), m.gender || '', m.loan_account,
      m.loan_amount == null ? '' : Number(m.loan_amount), m.outstanding_balance == null ? '' : Number(m.outstanding_balance), day(m.booking_date), day(m.release_date), day(m.maturity_date),
      m.loan_term_months || '', day(m.cover_from), day(m.cover_to), Number(m.sum_insured), Number(m.premium)]) }] });
  return { fileName: `credit-life-${b.batch_number}.xlsx`, content, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', rows: rows.length, batch: b };
}

/** Forward the issued accounts of a batch to the insurer (PJRN-01): e-mail with the list; the batch becomes Sent. */
export async function sendBatch(batchId, to, user) {
  const { conflict, badRequest } = await import('../../lib/errors.js');
  const b = await batchRow(batchId);
  if (!['issued', 'sent'].includes(b.status)) throw conflict(`Batch ${b.batch_number} is ${b.status}: issue it before sending it to the insurer`);
  const address = String(to || b.insurer_email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) throw badRequest('Validation failed', [{ path: 'to', message: "Enter the insurer's e-mail address (no contact e-mail on the Insurance Company master)" }]);
  const list = await batchList(b.id);
  const vars = { batchNumber: b.batch_number, period: b.period, members: String(list.rows), insurerName: b.insurer_name, bankName: b.bank_name, premium: Number(b.total_premium).toFixed(2) };
  const id = await queueEmail({ to: address, template: 'credit-life-batch', entity: 'credit_life_batch', entityId: b.id,
    subject: renderTemplate((await getSetting('credit_life.insurer_email_subject', null)) || '', vars, { html: false }),
    html: renderTemplate((await getSetting('credit_life.insurer_email_body', null)) || '', vars),
    attachments: [documentAttachment('credit-life-batch-list', { batchId: b.id }, list.fileName, list.contentType)] });
  await one("UPDATE credit_life_batches SET status = 'sent', sent_at = now(), sent_to = $2, email_id = $3, updated_at = now() WHERE id = $1 RETURNING id", [b.id, address, id]);
  return { emailId: id, to: address, accounts: list.rows, message: `Batch ${b.batch_number} queued for e-mail to ${address}`, by: user?.id };
}

/**
 * What the statement of account bills per account (credit_life.soa_billing_basis, pending TISPH's confirmation of the
 * fixed year-1 charge, PJRN-03): the premium of the account (premium, the default), the fixed
 * credit_life.soa_amount_per_account (per_account), or nothing (none: the accounts without an amount due).
 */
export async function soaBilling() {
  const basis = String((await getSetting('credit_life.soa_billing_basis', 'premium')) || 'premium');
  const perAccount = Number(await getSetting('credit_life.soa_amount_per_account', 2000)) || 0;
  if (basis === 'none') return { basis, amountOf: () => null };
  if (basis === 'per_account') return { basis, amountOf: () => perAccount };
  return { basis: 'premium', amountOf: (m) => Number(m.premium) };
}

/** Statement of account of a batch to the financing bank (PJRN-01): the issued accounts with the amount billed (soaBilling), and the total. */
export async function batchSoaPdf(batchId) {
  const b = await batchRow(batchId);
  const rows = await many("SELECT * FROM credit_life_members WHERE batch_id = $1 AND status = 'issued' ORDER BY row_no NULLS LAST", [b.id]);
  const ctx = await printContext();
  const f = formatters(ctx);
  const billing = await soaBilling();
  const billed = billing.basis !== 'none';
  const total = billed ? rows.reduce((s, m) => s + billing.amountOf(m), 0) : 0;
  const amountLabel = billing.basis === 'per_account' ? 'Amount due' : 'Premium';
  return { number: b.batch_number, total, basis: billing.basis, accounts: rows.length, pdf: buildPdf({ ...ctx, title: 'Credit Life Statement of Account', number: b.batch_number,
    meta: kv([['Financing bank', b.bank_name], ['Insurer', b.insurer_name], ['Product', b.product_name], ['Month', b.period], ['Insurer SOA reference', b.insurer_soa_reference]]),
    sections: [{ heading: 'Accounts covered', table: {
      columns: [{ key: 'certificate', label: 'Certificate' }, { key: 'loan', label: 'Loan account' }, { key: 'borrower', label: 'Borrower' }, { key: 'period', label: 'Period of cover' },
        { key: 'sumInsured', label: 'Sum insured', type: 'money' }, ...(billed ? [{ key: 'amount', label: amountLabel, type: 'money' }] : [])],
      rows: rows.map((m) => ({ certificate: m.certificate_number, loan: m.loan_account, borrower: name(m), period: `${f.date(m.cover_from)} to ${f.date(m.cover_to)}`,
        sumInsured: Number(m.sum_insured), ...(billed ? { amount: billing.amountOf(m) } : {}) })),
      totals: { certificate: `${rows.length} account(s)`, ...(billed ? { amount: total } : {}) } } },
    ...(billed ? [{ heading: 'Amount due', rows: [[billing.basis === 'per_account' ? 'Total amount due' : 'Total premium due', f.ccy(total)]] }] : [])] }) };
}

/** Send the statement of account of a sent batch to the financing bank (e-mail with the PDF); the insurer's SOA reference may be recorded. */
export async function sendSoa(batchId, { to = null, insurerSoaReference = null } = {}) {
  const { conflict, badRequest } = await import('../../lib/errors.js');
  const b = await batchRow(batchId);
  if (b.status !== 'sent') throw conflict(`Batch ${b.batch_number} is ${b.status}: send it to the insurer before the statement of account goes to the bank`);
  const bank = await one('SELECT email FROM clients WHERE id = $1', [b.financing_client_id]);
  const address = String(to || bank?.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) throw badRequest('Validation failed', [{ path: 'to', message: "Enter the bank's e-mail address" }]);
  if (insurerSoaReference) await one('UPDATE credit_life_batches SET insurer_soa_reference = $2 WHERE id = $1 RETURNING id', [b.id, insurerSoaReference]);
  const soa = await batchSoaPdf(b.id);
  const vars = { batchNumber: b.batch_number, period: b.period, bankName: b.bank_name, insurerName: b.insurer_name, members: String(soa.accounts), premium: soa.total.toFixed(2) };
  const id = await queueEmail({ to: address, template: 'credit-life-soa', entity: 'credit_life_batch', entityId: b.id,
    subject: renderTemplate((await getSetting('credit_life.soa_email_subject', null)) || '', vars, { html: false }),
    html: renderTemplate((await getSetting('credit_life.soa_email_body', null)) || '', vars),
    attachments: [documentAttachment('credit-life-soa', { batchId: b.id }, `credit-life-soa-${b.batch_number}.pdf`)] });
  await one('UPDATE credit_life_batches SET soa_sent_at = now(), soa_sent_to = $2, soa_email_id = $3, updated_at = now() WHERE id = $1 RETURNING id', [b.id, address, id]);
  return { emailId: id, to: address, accounts: soa.accounts, total: soa.total, basis: soa.basis, message: `Statement of account ${b.batch_number} queued for e-mail to ${address}` };
}
