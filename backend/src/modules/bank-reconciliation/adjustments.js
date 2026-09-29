/**
 * Adjustments from the bank side and stale cheques.
 *
 * postBankAdjustment() is the single place where bank reconciliation posts to the ledger: unrecorded bank items
 * (bank charges, interest, final tax, direct credits, other debits) are journalised with the account of their bank
 * transaction type (account role accounting.account.<role>, a GL account, or a user-chosen account when the type
 * allows it); returned cheques cancel the official receipt (reversing its journals and re-opening the receivable).
 * It uses createJournal (source 'bank-reconciliation') today; switch it to the posting-rules engine (postEvent) here.
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { account as roleAccount, createJournal, reverseJournal } from '../accounting/lib/ledger.js';
import { cancelReceipt } from '../receipts/service.js';
import { updateCheckbook } from '../disbursements/service.js';
import { assertOpenDate, iso, round2 } from './common.js';
import { insertMatch } from './matching.js';

export const typeRow = (t) => t && ({
  code: t.code, name: t.name, description: t.description, direction: t.direction, action: t.action, accountRole: t.account_role, glAccountCode: t.gl_account_code,
  allowAccountOverride: t.allow_account_override, requiresApproval: t.requires_approval, matchPattern: t.match_pattern, active: t.active, sortOrder: t.sort_order, isSystem: t.is_system,
});

async function counterAccount(t, override) {
  if (override) {
    if (!t.allow_account_override) throw badRequest(`Bank transaction type ${t.code} posts to a fixed account`);
    return String(override);
  }
  if (t.gl_account_code) return t.gl_account_code;
  return roleAccount(t.account_role);
}

/** Cash lines of the given journals on the account's GL cash account. */
const cashLines = async (db, account, jvIds) => (await db.query(`SELECT l.id, l.debit, l.credit, j.jv_date, j.status FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
  WHERE l.jv_id = ANY($1) AND l.account_code = $2`, [jvIds, account.gl_account_code])).rows;

/**
 * Post the adjustment for an unrecorded bank item.
 *   line: the bank statement line (row of bank_statement_lines) or null for a match difference
 *   { typeCode, amount (default the line's amount, signed: credit positive), date (default the line date), accountCode (override),
 *     receiptId (returned cheque), remarks }
 * Returns { journal, journals, matchId, status }.
 */
export async function postBankAdjustment(db, account, line, b, user) {
  const t = (await db.query('SELECT * FROM bank_transaction_types WHERE code = $1', [String(b.typeCode || '')])).rows[0];
  if (!t) throw notFound(`Bank transaction type ${b.typeCode} not found`);
  if (!t.active) throw badRequest(`Bank transaction type ${t.code} is inactive`);
  const signed = round2(b.amount ?? line?.amount);
  if (!signed) throw badRequest('The adjustment amount is zero');
  const direction = signed < 0 ? 'debit' : 'credit';
  if (t.direction !== direction) throw badRequest(`${t.name} is a bank ${t.direction}; this item is a bank ${direction}`);
  if (line) {
    if (line.adjustment_jv_id) throw conflict('An adjustment was already created from this bank line');
    const matched = (await db.query('SELECT 1 FROM bank_rec_match_items WHERE bank_line_id = $1 AND active', [line.id])).rows[0];
    if (matched) throw conflict('The bank line is already matched');
  }
  const date = iso(b.date || line?.txn_date || (await today()));
  await assertOpenDate(db, account.bank_account_id, date, 'The adjustment');
  const amount = Math.abs(signed);
  const narrative = [t.name, line?.description, line?.reference, b.remarks].filter(Boolean).join(' – ');

  if (t.action === 'returned-cheque') {
    if (!b.receiptId) throw badRequest('Select the official receipt of the returned cheque');
    const r = (await db.query('SELECT * FROM receipts WHERE id = $1 OR receipt_number = $1', [String(b.receiptId)])).rows[0];
    if (!r) throw notFound('Official receipt not found');
    const apps = (await db.query('SELECT journal_id FROM receipt_applications WHERE receipt_id = $1 AND status = \'applied\' AND journal_id IS NOT NULL', [r.id])).rows.map((a) => a.journal_id);
    await cancelReceipt(db, r.id, `Returned cheque${line?.reference ? ` ${line.reference}` : ''}: ${b.remarks || line?.description || 'returned by the bank'}`, user);
    const reversals = (await db.query('SELECT id, jv_number FROM journal_vouchers WHERE reversal_of = ANY($1) AND status = \'posted\'', [apps])).rows;
    const cash = await cashLines(db, account, reversals.map((x) => x.id));
    const total = round2(cash.reduce((s, c) => s + Number(c.debit) - Number(c.credit), 0));
    let matchId = null;
    if (line) {
      await db.query('UPDATE bank_statement_lines SET adjustment_jv_id = $2, type_code = $3, updated_by = $4, updated_at = now() WHERE id = $1', [line.id, reversals[0]?.id || null, t.code, user.id]);
      if (cash.length && total === signed) {
        const m = await insertMatch(db, account, [{ side: 'bank', id: line.id, amount: signed, date: line.txn_date },
          ...cash.map((c) => ({ side: 'book', id: Number(c.id), amount: round2(Number(c.debit) - Number(c.credit)), date: c.jv_date }))], { matchType: 'adjustment', ruleCode: t.code, confidence: 100, remarks: `Returned cheque, receipt ${r.receipt_number} cancelled`, user });
        matchId = m.id;
      }
    }
    return { status: 'posted', receiptNumber: r.receipt_number, journal: reversals[0] || null, journals: reversals, matchId,
      message: matchId ? null : `Receipt ${r.receipt_number} cancelled; its reversal (${total}) on ${account.gl_account_code} does not equal the bank line (${signed}): match it manually` };
  }

  const counter = await counterAccount(t, b.accountCode);
  const cash = account.gl_account_code;
  const lines = direction === 'debit'
    ? [{ accountCode: counter, debit: amount, credit: 0, memo: narrative }, { accountCode: cash, debit: 0, credit: amount, memo: `${t.name}${line?.reference ? ` ${line.reference}` : ''}` }]
    : [{ accountCode: cash, debit: amount, credit: 0, memo: `${t.name}${line?.reference ? ` ${line.reference}` : ''}` }, { accountCode: counter, debit: 0, credit: amount, memo: narrative }];
  // Posting-rules engine hand-over point: replace this createJournal with postEvent('bank.adjustment', { type, account, line, amount, date }).
  const jv = await createJournal(db, {
    date, description: `Bank reconciliation: ${narrative}`.slice(0, 500), source: 'bank-reconciliation', entryType: 'BANK_ADJUSTMENT', transactionCode: t.code,
    referenceType: 'BankStatementLine', referenceId: line?.id || null, status: t.requires_approval ? 'for-approval' : undefined, requiresApproval: t.requires_approval, lines,
  }, user);
  let matchId = null;
  if (line) {
    await db.query('UPDATE bank_statement_lines SET adjustment_jv_id = $2, type_code = $3, updated_by = $4, updated_at = now() WHERE id = $1', [line.id, jv.id, t.code, user.id]);
    if (jv.status === 'posted') {
      const [c] = await cashLines(db, account, [jv.id]);
      const m = await insertMatch(db, account, [{ side: 'bank', id: line.id, amount: signed, date: line.txn_date }, { side: 'book', id: Number(c.id), amount: signed, date }],
        { matchType: 'adjustment', ruleCode: t.code, confidence: 100, remarks: t.name, user });
      matchId = m.id;
    }
  }
  const [cashLine] = await cashLines(db, account, [jv.id]);
  return { status: jv.status, journal: { id: jv.id, jv_number: jv.jv_number }, journals: [{ id: jv.id, jv_number: jv.jv_number }], matchId, cashLineId: cashLine ? Number(cashLine.id) : null,
    message: jv.status === 'posted' ? null : `Journal ${jv.jv_number} awaits approval by a second user; it is matched to the bank line once posted` };
}

// ---------- stale cheques ----------

/** Outstanding payments older than bank_reconciliation.stale_cheque_days as of a date. */
export async function staleCheques(db, account, asOf) {
  const limit = Number(await getSetting('bank_reconciliation.stale_cheque_days', 180));
  const rows = (await db.query(`SELECT v.*, ($2::date - v.txn_date) AS age FROM bank_book_lines v
    WHERE v.bank_account_id = $1 AND v.amount < 0 AND v.txn_date <= $2::date - $3::int AND (v.cleared_date IS NULL OR v.cleared_date > $2::date)
    ORDER BY v.txn_date, v.jv_number`, [account.bank_account_id, asOf, limit])).rows;
  return { staleDays: limit, asOf, rows };
}

/**
 * Cancel a stale cheque: the payment journal is reversed and the payable re-opened. Cheques still Pending / Approved go
 * through the disbursement cancellation (updateCheckbook); a printed (issued) cheque is cancelled the same way here:
 * reversal journal, cheque Cancelled, payable (invoice list) open again, payment voucher cancelled when it has no other
 * live cheque.
 */
export async function cancelStaleCheque(db, account, journalLineId, reason, user) {
  const v = (await db.query('SELECT * FROM bank_book_lines WHERE line_id = $1', [Number(journalLineId)])).rows[0];
  if (!v || v.bank_account_id !== account.bank_account_id) throw notFound('Outstanding payment not found on this bank account');
  if (v.match_id) throw conflict('The payment has cleared the bank (it is matched)');
  if (!v.checkbook_id) throw badRequest('The payment is not a cheque issued through Disbursement; reverse it with a journal voucher');
  const limit = Number(await getSetting('bank_reconciliation.stale_cheque_days', 180));
  const now = await today();
  if (Date.parse(`${now}T00:00:00Z`) - Date.parse(`${iso(v.txn_date)}T00:00:00Z`) < limit * 86400000) throw conflict(`Cheque ${v.cheque_no} is not stale yet (${limit} days)`);
  const ck = (await db.query('SELECT * FROM checkbooks WHERE id = $1 FOR UPDATE', [v.checkbook_id])).rows[0];
  if (ck.status === 'Cancelled') throw conflict(`Cheque ${ck.instrument_no} is already cancelled`);
  const why = `Stale cheque ${ck.instrument_no || ''} cancelled${reason ? `: ${reason}` : ''}`.trim();
  if (['Pending', 'Approved'].includes(ck.status)) {
    await updateCheckbook(db, ck.id, { status: 'Cancelled' }, user);
  } else {
    if (ck.journal_id) await reverseJournal(db, ck.journal_id, user, { description: why });
    await db.query('UPDATE checkbooks SET status = \'Cancelled\', updated_at = now() WHERE id = $1', [ck.id]);
    if (ck.invoice_list_id) await db.query('UPDATE invoice_lists SET status = \'open\', updated_at = now() WHERE id = $1', [ck.invoice_list_id]);
    if (ck.disbursement_id) {
      const live = (await db.query('SELECT count(*)::int AS n FROM checkbooks WHERE disbursement_id = $1 AND status <> \'Cancelled\'', [ck.disbursement_id])).rows[0].n;
      if (!live) await db.query('UPDATE disbursements SET status = \'cancelled\', updated_at = now() WHERE id = $1', [ck.disbursement_id]);
    }
  }
  const rev = (await db.query('SELECT id, jv_number FROM journal_vouchers WHERE reversal_of = $1 ORDER BY created_at DESC LIMIT 1', [v.jv_id])).rows[0];
  // the cheque and its reversal cancel out on the bank account (book contra)
  const pair = (await db.query('SELECT * FROM bank_book_lines WHERE jv_id = ANY($1) AND bank_account_id = $2 AND match_id IS NULL', [[v.jv_id, rev?.id].filter(Boolean), account.bank_account_id])).rows;
  let matchId = null;
  if (rev && round2(pair.reduce((s, p) => s + Number(p.amount), 0)) === 0) {
    const m = await insertMatch(db, account, pair.map((p) => ({ side: 'book', id: Number(p.line_id), amount: Number(p.amount), date: p.txn_date })),
      { matchType: 'contra', ruleCode: 'STALE', confidence: 100, remarks: why, user });
    matchId = m.id;
  }
  return { chequeNumber: ck.instrument_no, checkbookId: ck.id, reversal: rev ? { id: rev.id, jvNumber: rev.jv_number } : null, matchId };
}
