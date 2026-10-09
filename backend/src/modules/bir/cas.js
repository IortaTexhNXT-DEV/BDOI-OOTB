/**
 * CAS registration pack: what the BIR asks of a computerized accounting system, produced by the system itself.
 *
 *   loose-leaf books  general journal, general ledger, cash receipts book, cash disbursements book, sales book and
 *                     purchase book per period (month), printed as PDF with page numbers that run on through the
 *                     taxable year (cas_book_prints keeps the pages each print used; a reprint keeps its pages and is
 *                     marked REPRINT; only the latest print of a book can be voided, and its pages are then reused)
 *   documents         system description and controls, backup and restore procedure (controlled documents, see
 *                     ./casDocuments.js), audit trail extract (Excel / PDF) for a date range
 *   readiness         what the registration pack still needs, with the CAS registration values kept on this screen
 *
 * Sources: posted (and reversed) journals for the journal, ledger and cash books; the sales invoices for the sales
 * book; payment vouchers to suppliers and journals with input VAT for the purchase book.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getSetting, setSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { renderPdf } from '../../lib/pdf/index.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { iso } from '../period-end/fiscal.js';
import { requiredReason } from '../ops-masters/records.js';
import { alphalistRows, birIdentity, monthPeriod, round2, sum } from './common.js';
import { listDocuments } from './casDocuments.js';

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
  reprints: r.reprints, lastReprintedAt: r.last_reprinted_at, status: r.status, voidReason: r.void_reason, voidReasonCode: r.void_reason_code, printedBy: r.printed_by, printedAt: r.printed_at });

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

/** Void the latest print of a book with a reason of the Reason Codes master (cas_print_void); its pages are used again by the next print. */
export async function voidPrint(db, id, body, user) {
  const r = (await db.query('SELECT * FROM cas_book_prints WHERE id = $1', [id])).rows[0];
  if (!r || r.status !== 'printed') throw notFound('Printed book not found');
  const later = (await db.query('SELECT 1 FROM cas_book_prints WHERE book_code = $1 AND fiscal_year = $2 AND status = \'printed\' AND period > $3', [r.book_code, r.fiscal_year, r.period])).rows[0];
  if (later) throw conflict('Only the latest print of a book can be voided');
  const reason = await requiredReason(db, 'cas_print_void', body);
  const v = (await db.query(`UPDATE cas_book_prints SET status = 'voided', void_reason = $2, void_reason_code = $3, voided_by = $4, voided_at = now() WHERE id = $1 RETURNING *`,
    [id, reason.text, reason.code, user?.id ?? null])).rows[0];
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

// ---------------------------------------------------------------- audit trail extract

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


// ---------------------------------------------------------------- registration values and readiness

/**
 * The CAS registration values kept on this screen (settings, closed list): CAS permit number and date, invoice ATP or
 * acknowledgement number and date, the backup custodian and the system contact (the user and the name printed).
 */
export const REGISTRATION = {
  permitNumber: 'cas.permit_number', permitDate: 'cas.permit_date', atpNumber: 'invoice.atp_number', atpDateIssued: 'invoice.atp_date_issued',
  custodianUserId: 'cas.backup_custodian_user', custodian: 'cas.backup_custodian', contactUserId: 'cas.system_contact_user', contact: 'cas.system_contact',
};

/** The registration values and the active users who can be named custodian or contact. */
export async function registration(db) {
  const values = {};
  for (const [field, key] of Object.entries(REGISTRATION)) values[field] = String((await getSetting(key, '')) || '');
  values.casPermitNumber = String((await getSetting('invoice.cas_permit_number', '')) || '');
  const people = (await db.query(`SELECT id, COALESCE(display_name, username) AS name, email, designation FROM users WHERE status = 'active'
    ORDER BY lower(COALESCE(display_name, username)) LIMIT 1000`)).rows.map((u) => ({ userId: u.id, name: u.name, email: u.email || '', position: u.designation || '' }));
  return { ...values, people };
}

/**
 * Save registration values ({ field: value } of REGISTRATION); a custodian or contact is chosen among the active users
 * and printed as "Name, position" (the contact also with the e-mail). Returns { before, after } of the changed keys.
 */
export async function saveRegistration(db, body, user) {
  const changes = {};
  for (const field of ['permitNumber', 'permitDate', 'atpNumber', 'atpDateIssued']) {
    if (body[field] !== undefined) changes[REGISTRATION[field]] = String(body[field] ?? '').trim();
  }
  for (const [role, idField, textField] of [['custodian', 'custodianUserId', 'custodian'], ['contact', 'contactUserId', 'contact']]) {
    if (body[idField] === undefined) continue;
    if (!body[idField]) {
      changes[REGISTRATION[idField]] = '';
      changes[REGISTRATION[textField]] = '';
      continue;
    }
    const u = (await db.query('SELECT id, COALESCE(display_name, username) AS name, email FROM users WHERE id = $1 AND status = \'active\'', [body[idField]])).rows[0];
    if (!u) throw badRequest('Validation failed', [{ path: idField, message: 'choose an active user' }]);
    const position = String(body[`${role}Position`] || '').trim();
    changes[REGISTRATION[idField]] = u.id;
    changes[REGISTRATION[textField]] = [u.name, position, role === 'contact' ? u.email : null].filter(Boolean).join(', ');
  }
  const before = {};
  for (const key of Object.keys(changes)) before[key] = (await getSetting(key, '')) || '';
  for (const [key, value] of Object.entries(changes)) await setSetting(key, value, user?.id ?? null);
  return { before, after: changes };
}

/**
 * Readiness of the CAS pack: one row per item with its business name, Complete / Missing, the value when it is set and
 * the action that completes it (company: Master > Company; permit, atp, custodian, contact: the registration values of
 * this screen; document: approve the document; books: print a book).
 */
export async function casChecklist(db) {
  const id = await birIdentity();
  const r = await registration(db);
  const prints = (await db.query('SELECT count(*)::int AS n FROM cas_book_prints WHERE status = \'printed\'')).rows[0].n;
  const docs = await listDocuments(db);
  const doc = (type) => docs.find((d) => d.type === type).approved;
  const row = (code, item, done, value, action) => ({ code, item, done: !!done, status: done ? 'complete' : 'missing', value: done ? value || null : null, action });
  return [
    row('company', 'Taxpayer name, TIN and registered address', id.name && id.tin && id.address, id.name, 'company'),
    row('rdo', 'RDO code', id.rdoCode, id.rdoCode, 'company'),
    row('permit', 'CAS permit or acknowledgement number and date', r.permitNumber && r.permitDate, r.permitNumber, 'permit'),
    row('atp', 'Invoice ATP or acknowledgement', r.atpNumber || r.casPermitNumber, r.atpNumber || r.casPermitNumber, 'atp'),
    row('custodian', 'Backup custodian', r.custodian, r.custodian, 'custodian'),
    row('contact', 'System contact person', r.contact, r.contact, 'contact'),
    row('systemDescription', 'System description approved', doc('system_description'), doc('system_description') && `Version ${doc('system_description').version}`, 'document'),
    row('backupProcedure', 'Backup procedure approved', doc('backup_procedure'), doc('backup_procedure') && `Version ${doc('backup_procedure').version}`, 'document'),
    row('books', 'Books printed at least once', prints > 0, prints > 0 ? String(prints) : null, 'books'),
  ];
}
