/**
 * CAS registration pack: what the BIR asks of a computerized accounting system, produced by the system itself.
 *
 *   loose-leaf books  general journal, general ledger, cash receipts book, cash disbursements book, sales book and
 *                     purchase book per period (month), printed as PDF with page numbers that run on through the
 *                     taxable year (cas_book_prints keeps the pages each print used; a reprint keeps its pages and is
 *                     marked REPRINT; only the latest print of a book can be voided, and its pages are then reused)
 *   documents         system description and controls, backup and restore procedure (text built from the settings
 *                     cas.*), audit trail extract (Excel / PDF) for a date range
 *
 * Sources: posted (and reversed) journals for the journal, ledger and cash books; the sales invoices for the sales
 * book; payment vouchers to suppliers and journals with input VAT for the purchase book.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { renderPdf } from '../../lib/pdf/index.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { iso } from '../period-end/fiscal.js';
import { alphalistRows, birIdentity, monthPeriod, round2, sum } from './common.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(here, '../../../package.json'), 'utf8'));

export const BOOKS = {
  general_journal: { title: 'General Journal', columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'journalNumber', label: 'Journal no.' }, { key: 'reference', label: 'Reference' },
    { key: 'particulars', label: 'Particulars' }, { key: 'accountCode', label: 'Account' }, { key: 'accountName', label: 'Account title' }, { key: 'debit', label: 'Debit', type: 'money' }, { key: 'credit', label: 'Credit', type: 'money' }] },
  general_ledger: { title: 'General Ledger', columns: [{ key: 'accountCode', label: 'Account' }, { key: 'accountName', label: 'Account title' }, { key: 'date', label: 'Date', type: 'date' },
    { key: 'journalNumber', label: 'Journal no.' }, { key: 'description', label: 'Particulars' }, { key: 'debit', label: 'Debit', type: 'money' }, { key: 'credit', label: 'Credit', type: 'money' },
    { key: 'runningBalance', label: 'Balance', type: 'money' }] },
  cash_receipts: { title: 'Cash Receipts Book', columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'journalNumber', label: 'Journal no.' }, { key: 'reference', label: 'Receipt / reference' },
    { key: 'particulars', label: 'Received from / particulars' }, { key: 'cashAccount', label: 'Cash account' }, { key: 'amount', label: 'Cash debit', type: 'money' }, { key: 'accounts', label: 'Accounts credited' }] },
  cash_disbursements: { title: 'Cash Disbursements Book', columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'journalNumber', label: 'Journal no.' }, { key: 'reference', label: 'Voucher / cheque' },
    { key: 'particulars', label: 'Paid to / particulars' }, { key: 'cashAccount', label: 'Cash account' }, { key: 'amount', label: 'Cash credit', type: 'money' }, { key: 'accounts', label: 'Accounts debited' }] },
  sales: { title: 'Sales Book', columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'invoiceNumber', label: 'Invoice no.' }, { key: 'buyer', label: 'Customer' }, { key: 'tin', label: 'TIN' },
    { key: 'vatableSales', label: 'VATable sales', type: 'money' }, { key: 'exemptSales', label: 'VAT-exempt', type: 'money' }, { key: 'zeroRatedSales', label: 'Zero-rated', type: 'money' },
    { key: 'vat', label: 'Output VAT', type: 'money' }, { key: 'total', label: 'Total', type: 'money' }, { key: 'status', label: 'Status' }] },
  purchases: { title: 'Purchase Book', columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'journalNumber', label: 'Journal no.' }, { key: 'reference', label: 'Voucher / reference' },
    { key: 'supplier', label: 'Supplier' }, { key: 'tin', label: 'TIN' }, { key: 'netPurchase', label: 'Purchases (net of VAT)', type: 'money' }, { key: 'inputVat', label: 'Input VAT', type: 'money' },
    { key: 'withholding', label: 'Tax withheld', type: 'money' }, { key: 'total', label: 'Gross amount', type: 'money' }] },
};
export const BOOK_CODES = Object.keys(BOOKS);
const POSTED = "j.status IN ('posted', 'reversed')";
const CASH = "(SELECT code FROM gl_accounts WHERE category = 'Cash and Cash Equivalents')";

async function cashBook(db, from, to, side) {
  const cashSide = side === 'receipts' ? 'debit' : 'credit';
  const other = side === 'receipts' ? 'credit' : 'debit';
  const rows = (await db.query(`SELECT j.id, j.jv_date, j.jv_number, COALESCE(j.transaction_code, j.reference_id, '') AS reference, j.description,
      string_agg(DISTINCT c.account_code, ', ') AS cash_account, sum(c.${cashSide} - c.${other}) AS amount,
      (SELECT string_agg(o.account_code || ' ' || o.account_name || ' ' || to_char(o.${other}, 'FM999,999,999,990.00'), '; ' ORDER BY o.line_no) FROM journal_lines o
        WHERE o.jv_id = j.id AND o.${other} > 0 AND o.account_code NOT IN ${CASH}) AS accounts
    FROM journal_vouchers j JOIN journal_lines c ON c.jv_id = j.id AND c.account_code IN ${CASH}
    WHERE ${POSTED} AND j.jv_date BETWEEN $1 AND $2 GROUP BY j.id HAVING sum(c.${cashSide} - c.${other}) > 0 ORDER BY j.jv_date, j.jv_number`, [from, to])).rows;
  return rows.map((r) => ({ date: iso(r.jv_date), journalNumber: r.jv_number, reference: r.reference, particulars: r.description || '', cashAccount: r.cash_account, amount: round2(r.amount), accounts: r.accounts || '' }));
}

/** Rows of a book for a period. */
export async function bookRows(db, book, from, to) {
  if (book === 'general_journal') {
    return (await db.query(`SELECT j.jv_date, j.jv_number, COALESCE(j.transaction_code, '') AS reference, COALESCE(NULLIF(l.memo, ''), j.description, '') AS particulars,
        l.account_code, a.name, l.debit, l.credit FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
      WHERE ${POSTED} AND j.jv_date BETWEEN $1 AND $2 ORDER BY j.jv_date, j.jv_number, l.line_no`, [from, to])).rows
      .map((r) => ({ date: iso(r.jv_date), journalNumber: r.jv_number, reference: r.reference, particulars: r.particulars, accountCode: r.account_code, accountName: r.name,
        debit: Number(r.debit) || null, credit: Number(r.credit) || null }));
  }
  if (book === 'general_ledger') {
    const rows = await alphalistRows('glDetail', from, to);
    return rows.map((r) => ({ accountCode: r.accountCode, accountName: r.accountName, date: r.date ? iso(r.date) : '', journalNumber: r.journalNumber || 'Opening',
      description: r.description, debit: r.openingBalance !== null && r.openingBalance !== undefined ? (Number(r.openingBalance) > 0 ? Number(r.openingBalance) : null) : Number(r.debit) || null,
      credit: r.openingBalance !== null && r.openingBalance !== undefined ? (Number(r.openingBalance) < 0 ? -Number(r.openingBalance) : null) : Number(r.credit) || null, runningBalance: Number(r.runningBalance) }));
  }
  if (book === 'cash_receipts') return cashBook(db, from, to, 'receipts');
  if (book === 'cash_disbursements') return cashBook(db, from, to, 'disbursements');
  if (book === 'sales') {
    return (await db.query(`SELECT * FROM sales_invoices WHERE invoice_date BETWEEN $1 AND $2 ORDER BY invoice_number`, [from, to])).rows.map((r) => {
      const live = r.status === 'issued';
      return { date: iso(r.invoice_date), invoiceNumber: r.invoice_number, buyer: r.buyer_name, tin: r.buyer_tin || '', vatableSales: live ? Number(r.vatable_sales) : 0,
        exemptSales: live ? Number(r.vat_exempt_sales) : 0, zeroRatedSales: live ? Number(r.zero_rated_sales) : 0, vat: live ? Number(r.vat_amount) : 0, total: live ? Number(r.total_amount) : 0,
        status: live ? 'Issued' : `Cancelled: ${r.cancel_reason || ''}` };
    });
  }
  if (book === 'purchases') {
    const inputVat = String((await getSetting('accounting.account.input_vat', '135000')) || '135000');
    const wht = String((await getSetting('accounting.account.wht_payable', '2204001')) || '2204001');
    return (await db.query(`SELECT j.jv_date, j.jv_number, COALESCE(d.voucher_number, j.transaction_code, '') AS reference, COALESCE(d.payee_name, j.description, '') AS supplier,
        COALESCE(cr.tin, ic.tin, '') AS tin,
        COALESCE((SELECT sum(x.debit - x.credit) FROM journal_lines x WHERE x.jv_id = j.id AND x.account_code = $3), 0) AS input_vat,
        COALESCE((SELECT sum(x.credit - x.debit) FROM journal_lines x WHERE x.jv_id = j.id AND x.account_code = $4), 0) AS withholding,
        COALESCE(NULLIF(d.gross_amount, 0), d.amount + d.wht_amount, (SELECT sum(x.debit) FROM journal_lines x WHERE x.jv_id = j.id)) AS gross
      FROM journal_vouchers j LEFT JOIN disbursements d ON d.journal_id = j.id LEFT JOIN commission_referrers cr ON cr.id = d.referrer_id LEFT JOIN insurance_companies ic ON ic.id = d.insurance_company_id
      WHERE ${POSTED} AND j.jv_date BETWEEN $1 AND $2 AND (d.payee_type = 'Supplier' OR EXISTS (SELECT 1 FROM journal_lines v WHERE v.jv_id = j.id AND v.account_code = $3 AND v.debit > 0))
      ORDER BY j.jv_date, j.jv_number`, [from, to, inputVat, wht])).rows.map((r) => {
      const gross = round2(r.gross); const vat = round2(r.input_vat);
      return { date: iso(r.jv_date), journalNumber: r.jv_number, reference: r.reference, supplier: r.supplier, tin: r.tin, netPurchase: round2(gross - vat), inputVat: vat, withholding: round2(r.withholding), total: gross };
    });
  }
  throw notFound(`Unknown book ${book}`);
}

const moneyKeys = (book) => BOOKS[book].columns.filter((c) => c.type === 'money' && c.key !== 'runningBalance').map((c) => c.key);

async function bookSpec(db, book, p, numbering, { reprint = false } = {}) {
  const b = BOOKS[book];
  if (!b) throw notFound(`Unknown book ${book}`);
  const rows = await bookRows(db, book, p.from, p.to);
  const id = await birIdentity();
  const totals = Object.fromEntries(moneyKeys(book).map((k) => [k, sum(rows, k)]));
  const table = { columns: b.columns.map((c) => (c.type ? { label: c.label, type: c.type } : c.label)),
    rows: [...rows.map((r) => b.columns.map((c) => (r[c.key] === null || r[c.key] === undefined ? '' : r[c.key]))),
      b.columns.map((c, i) => (i === 0 ? 'TOTAL' : totals[c.key] !== undefined ? totals[c.key] : ''))], totalRow: true };
  const permit = (await getSetting('cas.permit_number', '')) || '';
  return { rows, totals, spec: {
    title: `${b.title}${reprint ? ' (REPRINT)' : ''}`, number: p.label, orientation: 'landscape',
    meta: [['Taxpayer', id.name], ['TIN', id.tinFormatted], ['Address', id.address], ['Period', `${p.from} to ${p.to}`], ['CAS permit / acknowledgement', permit || '-'],
      ['Entries', String(rows.length)]],
    sections: [{ table }], pageNumbering: numbering,
    footerNote: `Loose-leaf book of accounts generated by ${(await getSetting('cas.software_name', 'iNXT BrokerVerse')) || 'iNXT BrokerVerse'} version ${pkg.version}.`,
  } };
}

const pageCount = (buf) => (buf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;

export const printRow = (r) => r && ({ id: r.id, book: r.book_code, bookTitle: BOOKS[r.book_code]?.title, fiscalYear: r.fiscal_year, period: r.period, periodFrom: iso(r.period_from), periodTo: iso(r.period_to),
  firstPage: r.first_page, lastPage: r.last_page, pages: r.pages, entries: r.entries, totalDebit: Number(r.total_debit), totalCredit: Number(r.total_credit), fileHash: r.file_hash,
  reprints: r.reprints, lastReprintedAt: r.last_reprinted_at, status: r.status, voidReason: r.void_reason, printedBy: r.printed_by, printedAt: r.printed_at });

/** Preview (no record, no page numbers) of a book: { rows, totals } for the screen. */
export async function previewBook(db, book, period) {
  const p = monthPeriod(period.slice(0, 4), period.slice(5, 7));
  const { rows, totals } = await bookSpec(db, book, p, null);
  return { book, title: BOOKS[book].title, period: p.key, from: p.from, to: p.to, columns: BOOKS[book].columns, rows, totals };
}

/** Print a book for a period: the next pages of the book's year, recorded; returns { print, pdf }. */
export async function printBook(db, book, period, user) {
  if (!BOOKS[book]) throw notFound(`Unknown book ${book}`);
  const p = monthPeriod(String(period).slice(0, 4), String(period).slice(5, 7));
  const existing = (await db.query('SELECT * FROM cas_book_prints WHERE book_code = $1 AND period = $2 AND status = \'printed\'', [book, p.key])).rows[0];
  if (existing) throw conflict(`${BOOKS[book].title} ${p.key} is already printed (pages ${existing.first_page} to ${existing.last_page}); reprint it instead`);
  const prior = (await db.query('SELECT * FROM cas_book_prints WHERE book_code = $1 AND fiscal_year = $2 AND status = \'printed\' ORDER BY period DESC LIMIT 1', [book, p.year])).rows[0];
  if (prior && prior.period > p.key) throw conflict(`${BOOKS[book].title} is already printed up to ${prior.period}: a period cannot be printed after a later one`);
  if ((await getSetting('cas.enforce_print_order', true)) !== false && p.month > 1) {
    const prev = `${p.year}-${String(p.month - 1).padStart(2, '0')}`;
    if (!prior || prior.period !== prev) throw conflict(`Print ${BOOKS[book].title} ${prev} first (cas.enforce_print_order)`);
  }
  const start = prior ? prior.last_page + 1 : 1;
  const label = `${BOOKS[book].title} ${p.year}`;
  const { rows, totals, spec } = await bookSpec(db, book, p, { label, start });
  const pdf = await renderPdf(spec, { user });
  const pages = pageCount(pdf);
  const r = (await db.query(`INSERT INTO cas_book_prints(book_code, fiscal_year, period, period_from, period_to, first_page, last_page, pages, entries, total_debit, total_credit, file_hash, printed_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
  [book, p.year, p.key, p.from, p.to, start, start + pages - 1, pages, rows.length, totals.debit ?? totals.amount ?? totals.total ?? 0, totals.credit ?? 0,
    crypto.createHash('sha256').update(pdf).digest('hex'), user?.id ?? null])).rows[0];
  return { print: printRow(r), pdf };
}

/** Reprint a recorded print with its original page numbers (marked REPRINT). */
export async function reprintBook(db, id, user) {
  const r = (await db.query('SELECT * FROM cas_book_prints WHERE id = $1', [id])).rows[0];
  if (!r) throw notFound('Book print not found');
  if (r.status !== 'printed') throw conflict('A voided print cannot be reprinted');
  const p = monthPeriod(r.period.slice(0, 4), r.period.slice(5, 7));
  const { spec } = await bookSpec(db, r.book_code, p, { label: `${BOOKS[r.book_code].title} ${r.fiscal_year}`, start: r.first_page }, { reprint: true });
  const pdf = await renderPdf(spec, { user });
  await db.query('UPDATE cas_book_prints SET reprints = reprints + 1, last_reprinted_at = now(), last_reprinted_by = $2 WHERE id = $1', [id, user?.id ?? null]);
  return { print: printRow(r), pdf };
}

/** Void the latest print of a book (its pages are used again by the next print). */
export async function voidPrint(db, id, reason, user) {
  const r = (await db.query('SELECT * FROM cas_book_prints WHERE id = $1', [id])).rows[0];
  if (!r || r.status !== 'printed') throw notFound('Printed book not found');
  const later = (await db.query('SELECT 1 FROM cas_book_prints WHERE book_code = $1 AND fiscal_year = $2 AND status = \'printed\' AND period > $3', [r.book_code, r.fiscal_year, r.period])).rows[0];
  if (later) throw conflict('Only the latest print of a book can be voided');
  const v = (await db.query('UPDATE cas_book_prints SET status = \'voided\', void_reason = $2, voided_by = $3, voided_at = now() WHERE id = $1 RETURNING *', [id, reason, user?.id ?? null])).rows[0];
  return printRow(v);
}

export async function listPrints(db, q = {}) {
  return (await db.query(`SELECT * FROM cas_book_prints WHERE ($1::int IS NULL OR fiscal_year = $1) AND ($2::text IS NULL OR book_code = $2) ORDER BY fiscal_year DESC, book_code, period DESC`,
    [q.year ? Number(q.year) : null, q.book || null])).rows.map(printRow);
}

/** Excel of a book for a period (working copy; the PDF print is the loose-leaf book). */
export async function bookXlsx(db, book, period) {
  const pv = await previewBook(db, book, period);
  const totals = pv.columns.map((c, i) => (i === 0 ? 'TOTAL' : pv.totals[c.key] !== undefined ? pv.totals[c.key] : ''));
  return writeXlsx({ title: `${pv.title} ${pv.period}`, sheets: [{ name: pv.title, columns: pv.columns.map((c) => ({ header: c.label, type: c.type || 'text', width: c.type ? 16 : 28 })),
    rows: [...pv.rows.map((r) => pv.columns.map((c) => r[c.key] ?? '')), totals], rowStyles: [...pv.rows.map(() => null), 'bold'] }] });
}

// ---------------------------------------------------------------- documents

const casSettings = async () => ({
  software: (await getSetting('cas.software_name', 'iNXT BrokerVerse')) || 'iNXT BrokerVerse', booksForm: (await getSetting('cas.books_form', 'loose-leaf')) || 'loose-leaf',
  permit: (await getSetting('cas.permit_number', '')) || '', backupFrequency: (await getSetting('cas.backup_frequency', 'Daily full backup with continuous transaction log archiving (point-in-time recovery)')) || '',
  backupRetention: (await getSetting('cas.backup_retention', 'Daily backups kept 35 days; monthly backups kept 10 years (NIRC Sec. 235 retention)')) || '',
  backupLocation: (await getSetting('cas.backup_location', 'Managed database service of the hosting provider in the Philippines region, with an encrypted off-site copy')) || '', custodian: (await getSetting('cas.backup_custodian', '')) || '', contact: (await getSetting('cas.system_contact', '')) || '',
});

/** System description and controls (PDF), for the CAS registration / acknowledgement file. */
export async function systemDescriptionPdf(db) {
  const id = await birIdentity();
  const s = await casSettings();
  const series = (await db.query('SELECT code, name, prefix, pattern, reset_rule FROM document_numbering WHERE active ORDER BY name')).rows;
  const roles = (await db.query('SELECT code, name FROM roles ORDER BY name')).rows;
  const accounts = (await db.query('SELECT count(*)::int AS n FROM gl_accounts WHERE status = \'active\'')).rows[0].n;
  return renderPdf({
    title: 'Computerized Accounting System: System Description and Controls', number: `${s.software} ${pkg.version}`,
    meta: [['Taxpayer', id.name], ['TIN', id.tinFormatted], ['Registered address', id.address], ['RDO', id.rdoCode || '-'], ['System', `${s.software} version ${pkg.version}${process.env.GIT_REF ? ` (${process.env.GIT_REF})` : ''}`],
      ['Form of books', s.booksForm], ['CAS permit / acknowledgement', s.permit || 'to be issued'], ['Contact person', s.contact || '-']],
    sections: [
      { heading: '1. Purpose and scope', text: `${s.software} is the insurance broking and accounting system of ${id.name || 'the taxpayer'}. It records the broking operations (quotations, policies, endorsements, claims, renewals), the billing and collection of premium, the remittance of premium to insurers, commission (direct-bill debit notes, broker-billed commission, overriding commission from insurers, commission to agents and referrers) and the general ledger. Every operational event posts a balanced journal through a posting rule; the books of accounts and the BIR reports are produced from these journals.` },
      { heading: '2. Modules', rows: [['Sales and placement', 'Prospects, quotations, requests for quotation, placement slips'], ['Policy administration', 'Policies, endorsements, renewals, claims'],
        ['Receivables and receipts', 'Bills, receipts (collection receipts), collections, credit control'], ['Remittance', 'Premium remittance to insurers, direct-bill commission debit notes, insurer statement reconciliation'],
        ['Commission', 'Commission to agents and referrers, overriding / contingent commission from insurers'], ['General ledger', 'Chart of accounts, posting rules, journal vouchers, period-end close, financial statements'],
        ['Tax', 'Sales invoices (EOPT), BIR Form 2307, 0619-E, 1601-EQ, 1604-E, 2551Q, VAT summary, SAWT, QAP, SLSP, DAT files, e-invoicing outbox'],
        ['Administration', 'Users, roles, document numbering, configuration, audit trail, scheduled jobs']], columns: 1 },
      { heading: '3. Books of accounts', text: `Generated per month as ${s.booksForm} books: General Journal, General Ledger, Cash Receipts Book, Cash Disbursements Book, Sales Book and Purchase Book. Page numbers run on through the taxable year; every print is recorded (book, period, pages, entries, file hash) and a reprint keeps its page numbers and is marked REPRINT. The chart of accounts has ${accounts} active accounts.` },
      { heading: '4. Controls', rows: [
        ['Access', `Sign-in with personal user accounts, password policy, optional two-factor authentication, session time-out. Roles: ${roles.map((r) => r.name).join(', ')}. Every API endpoint checks the user's permissions.`],
        ['Segregation of duties', 'Maker-checker on journal vouchers, payment vouchers (cheque approval), posting rule and account changes, month-end and year-end close, commission and overriding commission computations.'],
        ['Data integrity', 'Journals cannot be posted unbalanced, on inactive accounts or into closed periods; posted journals are never edited or deleted, only reversed; documents are cancelled with a reason, never deleted.'],
        ['Numbering', `System-generated, sequential numbers per series: ${series.map((x) => `${x.name} (${x.prefix})`).join(', ')}. The sales invoice series never resets and stays within the registered serial range.`],
        ['Period control', 'Accounting periods open, soft-closed, closed and locked; month-end checklist and approval; year-end close with closing entries.'],
        ['Audit trail', 'Every change records the user, date and time, screen or API, and the values before and after; the audit trail cannot be changed from the application and is extracted for any date range.'],
        ['Backup', `${s.backupFrequency}. Retention: ${s.backupRetention}. Location: ${s.backupLocation}.`]], columns: 1 },
      { heading: '5. Outputs', text: 'Financial statements (income statement, balance sheet, trial balance), general ledger detail, journal register, receivables and payables ageing, BIR forms and alphalists with their DAT files, sales invoices and payment acknowledgements, official / collection receipts, payment vouchers.' },
      { heading: '6. Hardware and software environment', text: 'Web application (Node.js API, PostgreSQL database, React front end) hosted on a managed cloud platform; users connect with a current web browser over HTTPS. No data is kept on the users\' computers.' },
      { signatures: [{ label: 'Prepared by' }, { label: 'Approved by (taxpayer)' }] },
    ],
  });
}

/** Backup and restore procedure (PDF). */
export async function backupProcedurePdf() {
  const id = await birIdentity();
  const s = await casSettings();
  return renderPdf({
    title: 'Backup and Restore Procedure', number: s.software,
    meta: [['Taxpayer', id.name], ['TIN', id.tinFormatted], ['Custodian', s.custodian || '-']],
    sections: [
      { heading: '1. What is backed up', text: 'The whole database (every transaction, master, configuration record, audit trail entry and the record of the books printed) and the stored documents (uploaded files and generated documents).' },
      { heading: '2. Frequency and retention', rows: [['Frequency', s.backupFrequency], ['Retention', s.backupRetention], ['Location', s.backupLocation]], columns: 1 },
      { heading: '3. Procedure', text: '1. The hosting platform takes the automated backups at the frequency above and archives the transaction log for point-in-time recovery. 2. The custodian checks every week that the latest backup completed. 3. At every month-end close, after the books of the month are printed, a monthly backup is kept for the retention period. 4. Backups are encrypted at rest and in transit; access is limited to the custodian and the system administrator.' },
      { heading: '4. Restore and test', text: '1. Restore into a separate environment (never over the live database) from the backup or to a point in time. 2. Check the restored trial balance and the last journal numbers against the last printed books. 3. Record the test (date, backup used, result, who performed it). A restore test is performed at least twice a year and after any change of the hosting platform.' },
      { heading: '5. Books on storage media', text: 'When the books are kept in computerized form, the general journal, general ledger and the subsidiary books are exported per period (PDF and Excel) and kept on storage media with the backups, for submission to the BIR within the period the regulations set.' },
      { signatures: [{ label: 'Custodian' }, { label: 'Approved by (taxpayer)' }] },
    ],
  });
}

/** Audit trail extract for a date range: rows for Excel / PDF. */
export async function auditExtract(db, { from, to }) {
  if (!from || !to || from > to) throw badRequest('from and to dates are required (from on or before to)');
  const rows = (await db.query(`SELECT a.at, COALESCE(u.display_name, a.username, a.user_id, 'system') AS user_name, a.entity, a.entity_id, a.action,
      a.source->>'channel' AS channel, a.source->>'name' AS screen, a.ip
    FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.at >= $1::date AND a.at < $2::date + 1 ORDER BY a.at, a.id LIMIT 100000`, [from, to])).rows;
  return rows.map((r) => ({ dateTime: new Date(r.at).toISOString().replace('T', ' ').slice(0, 19), user: r.user_name, entity: r.entity, record: r.entity_id || '',
    action: r.action, channel: r.channel || '', screen: r.screen || '', ip: r.ip || '' }));
}
export const AUDIT_COLUMNS = [{ key: 'dateTime', label: 'Date and time (UTC)' }, { key: 'user', label: 'User' }, { key: 'entity', label: 'Record type' }, { key: 'record', label: 'Record' },
  { key: 'action', label: 'Action' }, { key: 'channel', label: 'Channel' }, { key: 'screen', label: 'Screen / API' }, { key: 'ip', label: 'IP address' }];

/** Readiness of the CAS pack: what is set and what the broker still has to fill in. */
export async function casChecklist(db) {
  const id = await birIdentity();
  const s = await casSettings();
  const inv = async (k) => (await getSetting(`invoice.${k}`, '')) || '';
  const prints = (await db.query('SELECT count(*)::int AS n FROM cas_book_prints WHERE status = \'printed\'')).rows[0].n;
  return [
    { item: 'Taxpayer name, TIN and registered address (Master > Company)', done: !!(id.name && id.tin && id.address) },
    { item: 'RDO code (Master > Company)', done: !!id.rdoCode },
    { item: 'CAS permit / acknowledgement number (cas.permit_number)', done: !!s.permit },
    { item: 'Invoice ATP or system acknowledgement (invoice.atp_number / invoice.cas_permit_number)', done: !!((await inv('atp_number')) || (await inv('cas_permit_number'))) },
    { item: 'Backup custodian named (cas.backup_custodian)', done: !!s.custodian },
    { item: 'System contact person (cas.system_contact)', done: !!s.contact },
    { item: 'Books of accounts printed at least once', done: prints > 0 },
  ];
}
