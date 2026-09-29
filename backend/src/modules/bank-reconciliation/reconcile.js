/**
 * Bank reconciliation runs (BRC number) per bank account and period: draft -> prepared -> approved (maker-checker: the
 * approver differs from the preparer and holds approve:bank-reconciliation). Approval locks the matches cleared up to
 * the period end; an approver may reopen an approved (or prepared) run with remarks (history + audit).
 *
 * Bank Reconciliation Statement as of the period end (the standard Philippine layout):
 *   balance per bank statement + deposits in transit - outstanding cheques +/- bank errors      = adjusted bank balance
 *   balance per books + bank credits not yet booked - bank charges not yet booked +/- book errors = adjusted book balance
 * An entry is outstanding as of the date when it is not in an active match cleared on or before the date.
 * Balance per bank: opening balance of the latest statement starting on or before the date plus its lines up to the
 * date. Balance per books: GL balance of the cash account (pe_balance_before, which honours year-end opening balances).
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { APPROVE, addDays, iso, isPeriod, linkedAccount, periodEnd, periodStart, round2, userNames } from './common.js';
import { bankLineRow, bookLineRow } from './matching.js';

/** Balance per bank statement as of a date (null when the account has no statement starting on or before it). */
export async function bankBalance(db, accountId, asOf) {
  const s = (await db.query(`SELECT * FROM bank_statements WHERE bank_account_id = $1 AND status = 'active' AND period_from <= $2
    ORDER BY period_from DESC, created_at DESC LIMIT 1`, [accountId, asOf])).rows[0];
  if (!s) return { balance: null, statement: null };
  const moved = (await db.query('SELECT COALESCE(sum(amount), 0) AS m FROM bank_statement_lines WHERE statement_id = $1 AND status = \'active\' AND txn_date <= $2', [s.id, asOf])).rows[0].m;
  return { balance: round2(Number(s.opening_balance) + Number(moved)), statement: s };
}

/** Balance per books (GL cash account, debit positive) at the end of a date. */
export async function bookBalance(db, glCode, asOf) {
  const r = (await db.query('SELECT balance FROM pe_balance_before($1::date) WHERE account_code = $2', [addDays(iso(asOf), 1), glCode])).rows[0];
  return round2(r ? Number(r.balance) : 0);
}

/** The Bank Reconciliation Statement of an account as of a date, with the reconciling items. */
export async function computeStatement(db, account, asOf) {
  const id = account.bank_account_id;
  const { balance: bankBal, statement } = await bankBalance(db, id, asOf);
  const bookBal = await bookBalance(db, account.gl_account_code, asOf);
  const book = (await db.query(`SELECT * FROM bank_book_lines v WHERE v.bank_account_id = $1 AND v.txn_date <= $2 AND (v.cleared_date IS NULL OR v.cleared_date > $2)
    ORDER BY v.txn_date, v.jv_number`, [id, asOf])).rows;
  const bank = (await db.query(`SELECT l.*, s.statement_number, mi.match_id, m.cleared_date, m.match_type, m.locked_by_rec FROM bank_statement_lines l
    LEFT JOIN bank_statements s ON s.id = l.statement_id LEFT JOIN bank_rec_match_items mi ON mi.bank_line_id = l.id AND mi.active LEFT JOIN bank_rec_matches m ON m.id = mi.match_id
    WHERE l.bank_account_id = $1 AND l.status = 'active' AND l.txn_date <= $2 AND (m.cleared_date IS NULL OR m.cleared_date > $2) ORDER BY l.txn_date, l.line_no`, [id, asOf])).rows;
  const diffs = (await db.query(`SELECT * FROM bank_rec_matches WHERE bank_account_id = $1 AND status = 'active' AND cleared_date <= $2 AND difference <> 0 ORDER BY cleared_date`, [id, asOf])).rows;
  const sum = (list, f) => round2(list.reduce((s, x) => s + f(x), 0));
  const dit = book.filter((v) => Number(v.amount) > 0);
  const oc = book.filter((v) => Number(v.amount) < 0);
  const bankErr = bank.filter((l) => l.flag === 'bank-error');
  const open = bank.filter((l) => l.flag !== 'bank-error');
  const credits = open.filter((l) => Number(l.amount) > 0);
  const debits = open.filter((l) => Number(l.amount) < 0);
  const bankErrMatches = diffs.filter((m) => m.difference_treatment === 'bank-error');
  const bookErrMatches = diffs.filter((m) => m.difference_treatment === 'book-error');
  const f = {
    bankBalance: bankBal === null ? 0 : bankBal,
    depositsInTransit: sum(dit, (v) => Number(v.amount)),
    outstandingCheques: sum(oc, (v) => -Number(v.amount)),
    // a bank error is taken out of the bank balance: a wrong credit is deducted, a wrong debit added back
    bankErrors: round2(sum(bankErr, (l) => -Number(l.amount)) + sum(bankErrMatches, (m) => -Number(m.difference))),
    bookBalance: bookBal,
    unbookedCredits: sum(credits, (l) => Number(l.amount)),
    unbookedDebits: sum(debits, (l) => -Number(l.amount)),
    // a book error: the books recorded a different amount than the bank; the adjusted book balance uses the bank's
    bookErrors: sum(bookErrMatches, (m) => Number(m.difference)),
  };
  f.adjustedBankBalance = round2(f.bankBalance + f.depositsInTransit - f.outstandingCheques + f.bankErrors);
  f.adjustedBookBalance = round2(f.bookBalance + f.unbookedCredits - f.unbookedDebits + f.bookErrors);
  f.difference = round2(f.adjustedBankBalance - f.adjustedBookBalance);
  const matchRow = (m) => ({ matchId: m.id, clearedDate: iso(m.cleared_date), bankTotal: Number(m.bank_total), bookTotal: Number(m.book_total), difference: Number(m.difference), remarks: m.remarks });
  return {
    asOf: iso(asOf), bankAccount: account.bank_account_code, bankAccountName: account.bank_account_name, bankName: account.bank_name, accountNumber: account.account_number,
    glAccountCode: account.gl_account_code, glAccountName: account.gl_account_name || null,
    statement: statement ? { id: statement.id, statementNumber: statement.statement_number, statementRef: statement.statement_ref, periodFrom: iso(statement.period_from), periodTo: iso(statement.period_to) } : null,
    noStatement: bankBal === null,
    ...f,
    unmatchedBankLines: bank.length, unmatchedBookLines: book.length,
    items: {
      depositsInTransit: dit.map(bookLineRow), outstandingCheques: oc.map(bookLineRow), bankErrors: [...bankErr.map(bankLineRow), ...bankErrMatches.map(matchRow)],
      unbookedCredits: credits.map(bankLineRow), unbookedDebits: debits.map(bankLineRow), bookErrors: bookErrMatches.map(matchRow),
    },
  };
}

const FIGURES = ['bankBalance', 'depositsInTransit', 'outstandingCheques', 'bankErrors', 'adjustedBankBalance', 'bookBalance', 'unbookedCredits', 'unbookedDebits', 'bookErrors', 'adjustedBookBalance', 'difference'];
const COLS = { bankBalance: 'bank_balance', depositsInTransit: 'deposits_in_transit', outstandingCheques: 'outstanding_cheques', bankErrors: 'bank_errors', adjustedBankBalance: 'adjusted_bank_balance',
  bookBalance: 'book_balance', unbookedCredits: 'unbooked_credits', unbookedDebits: 'unbooked_debits', bookErrors: 'book_errors', adjustedBookBalance: 'adjusted_book_balance', difference: 'difference' };

async function storeFigures(db, recId, st, snapshot = false) {
  await db.query(`UPDATE bank_reconciliations SET ${FIGURES.map((k, i) => `${COLS[k]} = $${i + 2}`).join(', ')}, unmatched_bank_lines = $13, unmatched_book_lines = $14, computed_at = now(),
    snapshot = CASE WHEN $15 THEN $16::jsonb ELSE snapshot END, updated_at = now() WHERE id = $1`,
  [recId, ...FIGURES.map((k) => st[k]), st.unmatchedBankLines, st.unmatchedBookLines, snapshot, JSON.stringify(st)]);
}

export const recRow = (r, users = new Map()) => r && ({
  id: r.id, recNumber: r.rec_number, bankAccount: r.bank_account_code, bankAccountId: r.bank_account_id, glAccountCode: r.gl_account_code, period: r.period, asOfDate: iso(r.as_of_date),
  status: r.status, ...Object.fromEntries(FIGURES.map((k) => [k, r[COLS[k]] === null ? null : Number(r[COLS[k]])])),
  unmatchedBankLines: r.unmatched_bank_lines, unmatchedBookLines: r.unmatched_book_lines, computedAt: r.computed_at,
  preparedBy: r.prepared_by, preparedByName: users.get(r.prepared_by) || null, preparedAt: r.prepared_at,
  approvedBy: r.approved_by, approvedByName: users.get(r.approved_by) || null, approvedAt: r.approved_at,
  reopenedBy: r.reopened_by, reopenedByName: users.get(r.reopened_by) || null, reopenedAt: r.reopened_at, reopenRemarks: r.reopen_remarks, remarks: r.remarks, createdAt: r.created_at,
});

async function history(db, rec, from, to, remarks, user) {
  await db.query('INSERT INTO bank_reconciliation_history(rec_id, from_status, to_status, remarks, changed_by) VALUES ($1,$2,$3,$4,$5)', [rec.id, from, to, remarks, user?.id ?? null]);
}

async function lockRec(db, id) {
  const r = (await db.query('SELECT * FROM bank_reconciliations WHERE (id = $1 OR rec_number = $1) FOR UPDATE', [String(id)])).rows[0];
  if (!r) throw notFound('Bank reconciliation not found');
  return r;
}

export async function listRecs(db, q = {}) {
  const account = q.bankAccount ? await linkedAccount(db, q.bankAccount) : null;
  const rows = (await db.query(`SELECT * FROM bank_reconciliations WHERE status <> 'cancelled' AND ($1::int IS NULL OR bank_account_id = $1) AND ($2::text IS NULL OR period = $2)
    AND ($3::text IS NULL OR status = $3) ORDER BY period DESC, bank_account_code LIMIT 300`, [account?.bank_account_id ?? null, q.period || null, q.status || null])).rows;
  const users = await userNames(db, rows.flatMap((r) => [r.prepared_by, r.approved_by, r.reopened_by]));
  return rows.map((r) => recRow(r, users));
}

export async function createRec(db, b, user) {
  const account = await linkedAccount(db, b.bankAccount);
  if (!isPeriod(b.period)) throw badRequest('period must be YYYY-MM');
  const existing = (await db.query('SELECT rec_number FROM bank_reconciliations WHERE bank_account_id = $1 AND period = $2 AND status <> \'cancelled\'', [account.bank_account_id, b.period])).rows[0];
  if (existing) throw conflict(`${account.bank_account_code} already has a reconciliation for ${b.period} (${existing.rec_number})`);
  const number = await nextDocumentNumber('bank_reconciliation', { db });
  const r = (await db.query(`INSERT INTO bank_reconciliations(rec_number, bank_account_id, bank_account_code, gl_account_code, period, as_of_date, status, remarks, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8) RETURNING *`, [number, account.bank_account_id, account.bank_account_code, account.gl_account_code, b.period, periodEnd(b.period), b.remarks || null, user?.id ?? null])).rows[0];
  await history(db, r, null, 'draft', b.remarks || null, user);
  await storeFigures(db, r.id, await computeStatement(db, account, iso(r.as_of_date)));
  return r;
}

/** A run with its statement: live for drafts (figures refreshed), the frozen snapshot once prepared / approved. */
export async function getRec(db, id, { live = false } = {}) {
  let r = (await db.query('SELECT * FROM bank_reconciliations WHERE id = $1 OR rec_number = $1', [String(id)])).rows[0];
  if (!r) throw notFound('Bank reconciliation not found');
  const account = await linkedAccount(db, r.bank_account_id);
  let statement;
  if (r.status === 'draft' || live || !r.snapshot) {
    statement = await computeStatement(db, account, iso(r.as_of_date));
    if (r.status === 'draft') {
      await storeFigures(db, r.id, statement);
      r = (await db.query('SELECT * FROM bank_reconciliations WHERE id = $1', [r.id])).rows[0];
    }
  } else statement = r.snapshot;
  const hist = (await db.query('SELECT * FROM bank_reconciliation_history WHERE rec_id = $1 ORDER BY changed_at DESC, id DESC', [r.id])).rows;
  const users = await userNames(db, [r.prepared_by, r.approved_by, r.reopened_by, ...hist.map((h) => h.changed_by)]);
  return { ...recRow(r, users), periodFrom: periodStart(r.period), statement,
    history: hist.map((h) => ({ from: h.from_status, to: h.to_status, remarks: h.remarks, changedBy: users.get(h.changed_by) || h.changed_by || 'system', changedAt: h.changed_at })) };
}

export async function prepareRec(db, id, user, { remarks = null } = {}) {
  const r = await lockRec(db, id);
  if (r.status !== 'draft') throw conflict(`Reconciliation ${r.rec_number} is ${r.status}`);
  const account = await linkedAccount(db, r.bank_account_id);
  const st = await computeStatement(db, account, iso(r.as_of_date));
  if (st.noStatement) throw conflict(`No bank statement of ${account.bank_account_code} covers ${r.period}; import the statement first`);
  if (st.difference !== 0) throw conflict(`The adjusted bank balance (${st.adjustedBankBalance}) and the adjusted book balance (${st.adjustedBookBalance}) differ by ${st.difference}; match or adjust the open items first`);
  await storeFigures(db, r.id, st, true);
  await db.query('UPDATE bank_reconciliations SET status = \'prepared\', prepared_by = $2, prepared_at = now(), remarks = COALESCE($3, remarks) WHERE id = $1', [r.id, user.id, remarks]);
  await history(db, r, 'draft', 'prepared', remarks, user);
  return getRec(db, r.id);
}

export async function approveRec(db, id, user, { remarks = null } = {}) {
  if (!hasPermission(user, APPROVE)) throw forbidden(`Approving a bank reconciliation requires permission ${APPROVE}`);
  const r = await lockRec(db, id);
  if (r.status !== 'prepared') throw conflict(`Reconciliation ${r.rec_number} is ${r.status}; only prepared reconciliations can be approved`);
  if ((await getSetting('finance.maker_checker_enabled', true)) && r.prepared_by === user.id) {
    throw forbidden('Maker-checker: the reconciliation must be approved by a different user than the one who prepared it');
  }
  const account = await linkedAccount(db, r.bank_account_id);
  const st = await computeStatement(db, account, iso(r.as_of_date));
  const changed = FIGURES.filter((k) => round2(st[k]) !== round2(r[COLS[k]]));
  if (changed.length) throw conflict(`The reconciliation changed since it was prepared (${changed.join(', ')}); the preparer must prepare it again`);
  if (st.difference !== 0) throw conflict(`The adjusted balances differ by ${st.difference}`);
  await storeFigures(db, r.id, st, true);
  await db.query('UPDATE bank_reconciliations SET status = \'approved\', approved_by = $2, approved_at = now() WHERE id = $1', [r.id, user.id]);
  const locked = await db.query(`UPDATE bank_rec_matches SET locked_by_rec = $1 WHERE bank_account_id = $2 AND status = 'active' AND cleared_date <= $3 AND locked_by_rec IS NULL`,
    [r.id, r.bank_account_id, r.as_of_date]);
  await history(db, r, 'prepared', 'approved', remarks || `${locked.rowCount} match(es) locked`, user);
  return getRec(db, r.id);
}

/** Reopen a prepared or approved run (approver, remarks required): back to draft, its matches unlocked. */
export async function reopenRec(db, id, user, { remarks }) {
  if (!hasPermission(user, APPROVE)) throw forbidden(`Reopening a bank reconciliation requires permission ${APPROVE}`);
  if (!String(remarks || '').trim()) throw badRequest('Remarks are required to reopen a reconciliation');
  const r = await lockRec(db, id);
  if (!['prepared', 'approved'].includes(r.status)) throw conflict(`Reconciliation ${r.rec_number} is ${r.status}`);
  const later = (await db.query('SELECT rec_number FROM bank_reconciliations WHERE bank_account_id = $1 AND status = \'approved\' AND as_of_date > $2 ORDER BY as_of_date LIMIT 1', [r.bank_account_id, r.as_of_date])).rows[0];
  if (later) throw conflict(`A later reconciliation (${later.rec_number}) is approved; reopen it first`);
  await db.query('UPDATE bank_rec_matches SET locked_by_rec = NULL WHERE locked_by_rec = $1', [r.id]);
  await db.query(`UPDATE bank_reconciliations SET status = 'draft', reopened_by = $2, reopened_at = now(), reopen_remarks = $3, approved_by = NULL, approved_at = NULL,
    prepared_by = NULL, prepared_at = NULL, snapshot = NULL, updated_at = now() WHERE id = $1`, [r.id, user.id, remarks]);
  await history(db, r, r.status, 'draft', remarks, user);
  return { before: r, after: await getRec(db, r.id) };
}

/** Cancel a draft run. */
export async function cancelRec(db, id, user, { remarks = null } = {}) {
  const r = await lockRec(db, id);
  if (r.status !== 'draft') throw conflict(`Only draft reconciliations can be cancelled (${r.rec_number} is ${r.status})`);
  await db.query('UPDATE bank_reconciliations SET status = \'cancelled\', updated_at = now() WHERE id = $1', [r.id]);
  await history(db, r, 'draft', 'cancelled', remarks, user);
  return recRow(r);
}

// ---------- printable statement ----------
const money = (v) => Number(v || 0);
const txt = (v) => String(v ?? '').replace(/[\u2013\u2014]/g, '-');
const itemTable = (list, kind) => ({
  columns: kind === 'book' ? ['Date', 'Journal', 'Document', 'Cheque / Ref.', 'Payee / Payer', 'Amount'] : ['Date', 'Statement', 'Description', 'Reference', 'Amount'],
  widths: kind === 'book' ? [55, 72, 140, 68, 110, 70] : [55, 80, 200, 110, 70],
  rows: list.map((x) => (kind === 'book'
    ? [x.date, x.journalNumber, txt(`${x.documentType || ''} ${x.documentNumber || ''}`.trim()), txt(x.chequeNumber || x.reference || ''), txt(x.party || x.description || ''), Math.abs(money(x.amount))]
    : [x.date || x.clearedDate, x.statementNumber || x.matchId || '', txt(x.description || x.remarks || ''), txt(x.reference || ''), Math.abs(money(x.amount ?? x.difference))])),
});

/** Document spec (documents/pdf.js buildPdf) of the Bank Reconciliation Statement. */
export async function statementPdfSpec(rec, company) {
  const s = rec.statement;
  const fig = (label, v, sign = 1) => [label, sign * money(v)];
  const block = (rows) => ({ columns: ['', 'PHP'], widths: [415, 100], rows });
  const sections = [
    { heading: 'Balance per bank statement', table: block([
      fig('Balance per bank statement', s.bankBalance), fig('Add: deposits in transit', s.depositsInTransit), fig('Less: outstanding cheques', s.outstandingCheques, -1),
      fig('Add / (less): bank errors', s.bankErrors), fig('ADJUSTED BANK BALANCE', s.adjustedBankBalance)]) },
    { heading: 'Balance per books', table: block([
      fig('Balance per books', s.bookBalance), fig('Add: bank credits not yet booked', s.unbookedCredits), fig('Less: bank charges not yet booked', s.unbookedDebits, -1),
      fig('Add / (less): book errors', s.bookErrors), fig('ADJUSTED BOOK BALANCE', s.adjustedBookBalance)]) },
    { heading: 'Result', rows: [['Difference (must be zero)', money(s.difference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })], ['Status', rec.status.toUpperCase()]] },
  ];
  const detail = [['Deposits in transit', s.items?.depositsInTransit, 'book'], ['Outstanding cheques', s.items?.outstandingCheques, 'book'], ['Bank credits not yet booked', s.items?.unbookedCredits, 'bank'],
    ['Bank charges not yet booked', s.items?.unbookedDebits, 'bank'], ['Bank errors', s.items?.bankErrors, 'bank'], ['Book errors', s.items?.bookErrors, 'bank']];
  for (const [heading, list, kind] of detail) if (list?.length) sections.push({ heading: `${heading} (${list.length})`, table: itemTable(list, kind) });
  const at = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '-');
  sections.push({ heading: 'Sign-off', rows: [['Prepared by', txt(rec.preparedByName || '-')], ['Prepared at', at(rec.preparedAt)], ['Approved by', txt(rec.approvedByName || '-')], ['Approved at', at(rec.approvedAt)]] });
  return {
    title: 'Bank Reconciliation Statement',
    subtitle: txt(`${company.name || ''}${company.name ? '  -  ' : ''}${rec.recNumber}`),
    meta: [['Bank account', s.bankAccount], ['Account name', txt(s.bankAccountName || '-')], ['Bank', txt(s.bankName || '-')], ['Account number', s.accountNumber || '-'],
      ['GL account', txt(`${s.glAccountCode} ${s.glAccountName || ''}`.trim())], ['Period', rec.period], ['As of', s.asOf],
      ['Bank statement', txt(s.statement ? `${s.statement.statementNumber}${s.statement.statementRef ? ` (${s.statement.statementRef})` : ''}` : '-')]],
    sections,
    footer: txt(`${company.system || company.name || ''} - generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`),
  };
}

// ---------- month-end close check ----------

/**
 * Auto check unreconciled_bank of the month-end checklist: every bank account linked to a GL cash account with activity
 * in the period (posted GL lines on the account, or bank statement lines) needs an approved reconciliation for the
 * period. Periods before bank_reconciliation.check_from_period are not checked.
 */
export async function monthEndCheck(db, p, { start, end }) {
  const from = String((await getSetting('bank_reconciliation.check_from_period', '')) || '').trim();
  const period = String(p.period).slice(0, 7);
  if (from && period < from) return { status: 'not-applicable', count: 0, amount: null, message: `Bank reconciliations are required from ${from} (bank_reconciliation.check_from_period)`, detail: [] };
  const accounts = (await db.query(`SELECT b.bank_account_code AS "bankAccount", b.gl_account_code AS "glAccount",
      (SELECT count(*)::int FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE l.account_code = b.gl_account_code AND j.status IN ('posted','reversed') AND j.jv_date BETWEEN $1 AND $2) AS "glLines",
      (SELECT count(*)::int FROM bank_statement_lines s WHERE s.bank_account_id = b.bank_account_id AND s.status = 'active' AND s.txn_date BETWEEN $1 AND $2) AS "bankLines",
      (SELECT r.rec_number || ' (' || r.status || ')' FROM bank_reconciliations r WHERE r.bank_account_id = b.bank_account_id AND r.period = $3 AND r.status <> 'cancelled' LIMIT 1) AS reconciliation,
      EXISTS (SELECT 1 FROM bank_reconciliations r WHERE r.bank_account_id = b.bank_account_id AND r.period = $3 AND r.status = 'approved') AS approved
    FROM bank_account_links b WHERE b.gl_account_code IS NOT NULL AND b.status = 'active' ORDER BY b.bank_account_code`, [start, end, period])).rows;
  const active = accounts.filter((a) => a.glLines || a.bankLines);
  if (!active.length) {
    return { status: accounts.length ? 'passed' : 'not-applicable', count: 0, amount: null,
      message: accounts.length ? 'OK' : 'No bank account is linked to a GL cash account; link them on Accounts > Bank Reconciliation', detail: [] };
  }
  const missing = active.filter((a) => !a.approved);
  return { status: missing.length ? 'failed' : 'passed', count: missing.length, amount: null,
    message: missing.length ? `${missing.length} bank account(s) with activity in ${period} have no approved bank reconciliation: ${missing.map((a) => a.bankAccount).join(', ')}` : 'OK',
    detail: missing.map((a) => ({ bankAccount: a.bankAccount, glAccount: a.glAccount, glLines: a.glLines, bankLines: a.bankLines, reconciliation: a.reconciliation || 'none' })) };
}
