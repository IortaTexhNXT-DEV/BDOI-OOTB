/**
 * Report queries of bank reconciliation (merged into QUERIES in queries.js). Same conventions: $1 = from, $2 = to,
 * extras from app_settings follow; columns starting with "_" are internal. The bank account filter (BankAccount) reads
 * _bank_account_code / _bank_account_id; the GL account filter reads _account.
 *
 * "As of To Date": a book entry or bank line is cleared when it is in an active match whose cleared date (the latest
 * date among the matched lines) is on or before To Date. The book side comes from the view bank_book_lines (posted GL
 * lines on the cash account linked to a bank account, with their source document).
 */
const setting = (key, fallback, type) => ({ key, fallback, type });
const BANK_FILTERS = ['bankAccount', 'account'];
const staleDays = setting('bank_reconciliation.stale_cheque_days', 180, 'int');

// Bank Reconciliation Statement figures per reconciliation run (as of date in the range)
const statement = `SELECT r.rec_number AS "recNumber", r.bank_account_code AS "bankAccount", b.bank_account_name AS "bankAccountName", r.gl_account_code AS "glAccount",
    r.period, r.as_of_date AS "asOfDate", r.status, r.bank_balance AS "bankBalance", r.deposits_in_transit AS "depositsInTransit",
    r.outstanding_cheques AS "outstandingCheques", r.bank_errors AS "bankErrors", r.adjusted_bank_balance AS "adjustedBankBalance",
    r.book_balance AS "bookBalance", r.unbooked_credits AS "unbookedCredits", r.unbooked_debits AS "unbookedDebits", r.book_errors AS "bookErrors",
    r.adjusted_book_balance AS "adjustedBookBalance", r.difference, pu.display_name AS "preparedBy", r.prepared_at AS "preparedAt",
    au.display_name AS "approvedBy", r.approved_at AS "approvedAt",
    r.bank_account_code AS _bank_account_code, r.bank_account_id::text AS _bank_account_id, r.gl_account_code AS _account
  FROM bank_reconciliations r LEFT JOIN bank_account_links b ON b.bank_account_id = r.bank_account_id
  LEFT JOIN users pu ON pu.id = r.prepared_by LEFT JOIN users au ON au.id = r.approved_by
  WHERE r.status <> 'cancelled' AND r.as_of_date BETWEEN $1::date AND $2::date`;

// Unpresented book entries as of To Date: payments (outstanding cheques) or receipts (deposits in transit)
const unpresented = (sign) => `SELECT v.bank_account_code AS "bankAccount", v.account_code AS "glAccount", v.txn_date AS "date", v.jv_number AS "journalNumber",
    v.doc_type AS "documentType", v.doc_number AS "documentNumber", v.cheque_no AS "chequeNumber", COALESCE(v.payment_reference, v.cheque_no) AS reference,
    v.party AS ${sign < 0 ? 'payee' : 'payer'}, v.description, ${sign < 0 ? 'v.credit - v.debit' : 'v.debit - v.credit'} AS amount,
    ($2::date - v.txn_date) AS "ageDays", ${sign < 0 ? 'CASE WHEN $2::date - v.txn_date > $3::int THEN \'Stale\' ELSE \'Outstanding\' END' : '\'In transit\''} AS status,
    v.bank_account_code AS _bank_account_code, v.bank_account_id::text AS _bank_account_id, v.account_code AS _account
  FROM bank_book_lines v
  WHERE v.amount ${sign < 0 ? '<' : '>'} 0 AND v.txn_date <= $2::date AND (v.cleared_date IS NULL OR v.cleared_date > $2::date)
    AND ($3::int IS NULL OR TRUE)`;

// Bank statement lines of the range not cleared as of To Date
const unmatchedBank = `SELECT b.bank_account_code AS "bankAccount", s.statement_number AS "statementNumber", l.txn_date AS "date", l.value_date AS "valueDate",
    l.description, l.reference, l.debit, l.credit, l.amount, t.name AS "suggestedType", COALESCE(l.flag, '') AS flag, ($2::date - l.txn_date) AS "ageDays",
    CASE WHEN l.flag = 'bank-error' THEN 'Bank error' WHEN l.adjustment_jv_id IS NOT NULL THEN 'Adjustment pending' ELSE 'Unmatched' END AS status,
    b.bank_account_code AS _bank_account_code, b.bank_account_id::text AS _bank_account_id, b.gl_account_code AS _account
  FROM bank_statement_lines l JOIN bank_account_links b ON b.bank_account_id = l.bank_account_id
  LEFT JOIN bank_statements s ON s.id = l.statement_id LEFT JOIN bank_transaction_types t ON t.code = l.type_code
  WHERE l.status = 'active' AND l.txn_date BETWEEN $1::date AND $2::date
    AND NOT EXISTS (SELECT 1 FROM bank_rec_match_items mi JOIN bank_rec_matches m ON m.id = mi.match_id
      WHERE mi.bank_line_id = l.id AND mi.active AND m.cleared_date <= $2::date)`;

// Bank book: GL detail of each bank account's cash account with an opening balance and a running balance
const bankBook = `WITH u AS (
    SELECT b.bank_account_id, b.bank_account_code, b.gl_account_code AS account_code, $1::date AS d, NULL::text AS jv_number, 'Opening balance' AS descr,
      NULL::text AS doc_type, NULL::text AS doc_number, NULL::text AS cheque_no, NULL::text AS party,
      GREATEST(COALESCE(ob.balance, 0), 0) AS debit, GREATEST(-COALESCE(ob.balance, 0), 0) AS credit, 0::bigint AS seq, true AS is_open, NULL::date AS cleared
    FROM bank_account_links b LEFT JOIN pe_balance_before($1::date) ob ON ob.account_code = b.gl_account_code WHERE b.gl_account_code IS NOT NULL
    UNION ALL
    SELECT v.bank_account_id, v.bank_account_code, v.account_code, v.txn_date, v.jv_number, v.description, v.doc_type, v.doc_number, v.cheque_no, v.party,
      v.debit, v.credit, v.line_id, false, v.cleared_date
    FROM bank_book_lines v WHERE v.txn_date BETWEEN $1::date AND $2::date)
  SELECT u.bank_account_code AS "bankAccount", u.account_code AS "glAccount", u.d AS "date", u.jv_number AS "journalNumber", u.doc_type AS "documentType",
    u.doc_number AS "documentNumber", u.cheque_no AS "chequeNumber", u.party, u.descr AS description,
    CASE WHEN u.is_open THEN u.debit - u.credit END AS "openingBalance",
    CASE WHEN u.is_open THEN NULL ELSE u.debit END AS debit, CASE WHEN u.is_open THEN NULL ELSE u.credit END AS credit,
    sum(u.debit - u.credit) OVER (PARTITION BY u.bank_account_id ORDER BY u.is_open DESC, u.d, u.seq) AS "runningBalance",
    CASE WHEN u.is_open THEN NULL WHEN u.cleared IS NOT NULL AND u.cleared <= $2::date THEN 'Cleared' ELSE 'Outstanding' END AS reconciled,
    u.seq AS _seq, u.is_open AS _open, u.bank_account_code AS _bank_account_code, u.bank_account_id::text AS _bank_account_id, u.account_code AS _account
  FROM u`;

export const BANK_REC_QUERIES = {
  bankRecStatement: {
    sql: statement, filters: [...BANK_FILTERS, 'status'], criteria: { Overall: {}, 'Bank Account': { groupBy: 'bankAccount' } },
    orderBy: 'f."bankAccount", f."asOfDate"',
    summary: { reconciled: 'count(*) FILTER (WHERE f.status = \'approved\')', notAgreed: 'count(*) FILTER (WHERE f.difference <> 0)' },
  },
  outstandingCheques: {
    sql: unpresented(-1), extras: [staleDays], filters: BANK_FILTERS, criteria: { Overall: {}, 'Bank Account': { groupBy: 'bankAccount' }, Status: { groupBy: 'status' } },
    orderBy: 'f."bankAccount", f."date", f."journalNumber"',
    summary: { stale: 'count(*) FILTER (WHERE f.status = \'Stale\')', staleAmount: 'COALESCE(sum(f.amount) FILTER (WHERE f.status = \'Stale\'), 0)' },
  },
  depositsInTransit: {
    sql: unpresented(1), extras: [staleDays], filters: BANK_FILTERS, criteria: { Overall: {}, 'Bank Account': { groupBy: 'bankAccount' } },
    orderBy: 'f."bankAccount", f."date", f."journalNumber"',
  },
  unmatchedBankLines: {
    sql: unmatchedBank, filters: BANK_FILTERS, criteria: { Overall: {}, 'Bank Account': { groupBy: 'bankAccount' }, 'Suggested Type': { groupBy: 'suggestedType' } },
    orderBy: 'f."bankAccount", f."date"',
  },
  bankBook: {
    sql: bankBook, filters: BANK_FILTERS, criteria: { 'Bank Account': { groupBy: 'bankAccount' }, Overall: {} },
    orderBy: 'f."bankAccount", f._open DESC, f."date", f._seq',
    summary: { closingBalance: 'COALESCE(sum(f."openingBalance"), 0) + COALESCE(sum(f.debit), 0) - COALESCE(sum(f.credit), 0)' },
  },
};
