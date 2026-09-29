/**
 * Double-entry posting engine. Every system posting (policy booking, receipt, disbursement, commission, petty cash)
 * and every manual journal voucher goes through createJournal(), which enforces: at least two non-zero lines,
 * debits = credits, active GL accounts, and an open accounting period when posting. A database trigger re-checks
 * balance and period when a journal becomes 'posted'.
 */
import { getSetting } from '../../../lib/settings.js';
import { badRequest, conflict, forbidden, notFound } from '../../../lib/errors.js';
import { round2, today } from './http.js';

export const periodOf = (date) => String(date).slice(0, 7);
const OPEN_STATES = ['draft', 'for-approval', 'approved', 'pending'];

/** GL account code configured for a role, e.g. account('cash_in_bank') reads accounting.account.cash_in_bank. */
export async function account(key) {
  const code = await getSetting(`accounting.account.${key}`, null);
  if (!code) throw badRequest(`GL account setting accounting.account.${key} is not configured`);
  return String(code);
}
export async function payableAccountFor(payeeType) {
  const map = (await getSetting('accounting.payable_account_by_payee', {})) || {};
  return map[payeeType] ? String(map[payeeType]) : account('due_to_insurer');
}
export async function cashAccountFor(paymentMode) {
  const map = (await getSetting('accounting.cash_account_by_payment_mode', {})) || {};
  return map[paymentMode] ? String(map[paymentMode]) : account('cash_in_bank');
}

export async function assertPeriodOpen(db, date) {
  const r = (await db.query('SELECT status FROM accounting_periods WHERE period = $1', [periodOf(date)])).rows[0];
  if (r?.status === 'closed') throw conflict(`Accounting period ${periodOf(date)} is closed`);
}

async function nextJournalNumber(db) {
  const prefix = await getSetting('numbering.journal.prefix', 'JV');
  return (await db.query('SELECT next_number($1, $2) AS n', ['journal', prefix])).rows[0].n;
}

function normaliseLines(lines) {
  return lines.map((l) => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) }))
    .filter((l) => l.debit > 0 || l.credit > 0)
    .map((l) => {
      if (l.debit > 0 && l.credit > 0) throw badRequest('A journal line cannot carry both a debit and a credit');
      if (l.debit < 0 || l.credit < 0) throw badRequest('Journal amounts must be positive');
      return l;
    });
}

async function loadAccounts(db, codes) {
  const rows = (await db.query('SELECT code, name, status, allow_manual FROM gl_accounts WHERE code = ANY($1)', [codes])).rows;
  const map = new Map(rows.filter((a) => a.status === 'active').map((a) => [a.code, a]));
  const missing = codes.filter((c) => !map.has(c));
  if (missing.length) throw badRequest(`Unknown or inactive GL account(s): ${missing.join(', ')}`);
  return map;
}

/** Validate lines: returns { lines, totalDebit, totalCredit }. */
export async function validateLines(db, rawLines, { manual = false } = {}) {
  const lines = normaliseLines(rawLines || []);
  if (lines.length < 2) throw badRequest('A journal needs at least two non-zero lines');
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (totalDebit !== totalCredit) throw badRequest(`Journal is not balanced: debit ${totalDebit} vs credit ${totalCredit}`);
  const accounts = await loadAccounts(db, [...new Set(lines.map((l) => String(l.accountCode)))]);
  if (manual) {
    const blocked = lines.filter((l) => !accounts.get(String(l.accountCode)).allow_manual).map((l) => l.accountCode);
    if (blocked.length) throw badRequest(`GL account(s) not allowed on manual vouchers: ${blocked.join(', ')}`);
  }
  return { lines, totalDebit, totalCredit, accounts };
}

/**
 * Create a journal. j = { date, description, source, kind, transactionCode, entryType, entrySubType, referenceType,
 * referenceId, clientId, policyId, policyNumber, currency, dueDate, status, requiresApproval, reversalOf, correctionOf,
 * manual, lines: [{ accountCode, debit, credit, memo, clientId, policyId, dueDate, ...manual line fields }] }.
 * status defaults to posted (or pending when accounting.auto_post_system_entries is false).
 */
export async function createJournal(db, j, user) {
  const { lines, totalDebit, totalCredit, accounts } = await validateLines(db, j.lines, { manual: j.manual });
  const date = j.date || (await today());
  const autoPost = await getSetting('accounting.auto_post_system_entries', true);
  const status = j.status || (autoPost ? 'posted' : 'pending');
  if (status === 'posted') await assertPeriodOpen(db, date);
  const currency = j.currency || (await getSetting('currency.default', 'PHP'));
  const number = await nextJournalNumber(db);
  const h = (await db.query(`INSERT INTO journal_vouchers(jv_number, jv_date, description, status, total_debit, total_credit, source, kind,
      transaction_code, entry_type, entry_sub_type, reference_type, reference_id, client_id, policy_id, policy_number, currency, due_date,
      period, requires_approval, reversal_of, correction_of, created_by)
    VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
  [number, date, j.description || null, totalDebit, totalCredit, j.source || 'manual', j.kind || 'standard', j.transactionCode || null,
    j.entryType || null, j.entrySubType || null, j.referenceType || null, j.referenceId == null ? null : String(j.referenceId),
    j.clientId || null, j.policyId || null, j.policyNumber || null, currency, j.dueDate || null, periodOf(date), !!j.requiresApproval,
    j.reversalOf || null, j.correctionOf || null, user?.id ?? null])).rows[0];
  let n = 0;
  for (const l of lines) {
    n += 1;
    const acct = accounts.get(String(l.accountCode));
    await db.query(`INSERT INTO journal_lines(jv_id, line_no, account_code, account_name, debit, credit, memo, main_account, sub_account,
        main_account_description, sub_account_description, branch_code, branch_description, department_code, department_description,
        currency_code, foreign_amount, exchange_rate, client_id, policy_id, due_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [h.id, n, String(l.accountCode), acct.name, l.debit, l.credit, l.memo || null, l.mainAccount || null, l.subAccount || null,
      l.mainAccountDescription || null, l.subAccountDescription || null, l.branchCode || null, l.branchDescription || null,
      l.departmentCode || null, l.departmentDescription || null, l.currencyCode || currency, l.foreignAmount ?? null, l.exchangeRate || 1,
      l.clientId ?? j.clientId ?? null, l.policyId ?? j.policyId ?? null, l.dueDate ?? j.dueDate ?? null]);
  }
  if (status === 'posted') {
    await db.query('UPDATE journal_vouchers SET status = \'posted\', posted_by = $2, posted_at = now() WHERE id = $1', [h.id, user?.id ?? null]);
  } else if (status !== 'pending') {
    await db.query('UPDATE journal_vouchers SET status = $2 WHERE id = $1', [h.id, status]);
  }
  return { ...h, status };
}

/** Resolve a journal from a journal id, a journal number or a journal line id (entry id). */
export async function resolveJournalId(db, ref) {
  const s = String(ref);
  const byJv = (await db.query('SELECT id FROM journal_vouchers WHERE id = $1 OR jv_number = $1', [s])).rows[0];
  if (byJv) return byJv.id;
  if (/^\d+$/.test(s)) {
    const byLine = (await db.query('SELECT jv_id FROM journal_lines WHERE id = $1', [Number(s)])).rows[0];
    if (byLine) return byLine.jv_id;
  }
  throw notFound('Journal / transaction not found');
}

async function lockJournal(db, id) {
  const jv = (await db.query('SELECT * FROM journal_vouchers WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!jv) throw notFound('Journal not found');
  return jv;
}

/** Post a pending / for-approval journal. Journals that require approval must be posted by a different user. */
export async function postJournal(db, id, user) {
  const jv = await lockJournal(db, id);
  if (!OPEN_STATES.includes(jv.status)) throw conflict(`Journal ${jv.jv_number} is ${jv.status} and cannot be posted`);
  if (jv.requires_approval && jv.created_by === user.id && (await getSetting('finance.maker_checker_enabled', true))) {
    throw forbidden('Maker-checker: a journal voucher must be approved by a different user than the one who created it');
  }
  await assertPeriodOpen(db, jv.jv_date);
  const original = jv.reversal_of || jv.correction_of;
  if (original) {
    const o = (await db.query('SELECT jv_number, status FROM journal_vouchers WHERE id = $1 FOR UPDATE', [original])).rows[0];
    if (o?.status !== 'posted') throw conflict(`Journal ${o?.jv_number || original} is ${o?.status || 'missing'}; it can no longer be reversed or corrected`);
  }
  const extra = jv.requires_approval ? ', approved_by = $2, approved_at = now()' : '';
  const posted = (await db.query(`UPDATE journal_vouchers SET status = 'posted', posted_by = $2, posted_at = now(), updated_at = now()${extra} WHERE id = $1 RETURNING *`, [id, user.id])).rows[0];
  if (original) await markReversed(db, original, id);
  return posted;
}

/** Reverse a posted journal with a mirror journal (debits and credits swapped). */
export async function reverseJournal(db, id, user, { date, description, transactionCode, status = 'posted', kind = 'reversal', requiresApproval = false } = {}) {
  const jv = await lockJournal(db, id);
  if (jv.status !== 'posted') throw conflict(`Only posted journals can be reversed (journal ${jv.jv_number} is ${jv.status})`);
  if (jv.reversed_by_jv) throw conflict(`Journal ${jv.jv_number} is already reversed`);
  const matched = (await db.query(`SELECT 1 FROM entry_matches m JOIN journal_lines l ON l.id IN (m.debit_line_id, m.credit_line_id)
    WHERE m.status = 'active' AND l.jv_id = $1 LIMIT 1`, [id])).rows[0];
  if (matched) throw conflict(`Journal ${jv.jv_number} has matched open entries; unmatch them first`);
  const lines = (await db.query('SELECT * FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [id])).rows;
  const rev = await createJournal(db, {
    date: date || (await today()), description: description || `Reversal of ${jv.jv_number}${jv.description ? ` – ${jv.description}` : ''}`,
    source: 'reversal', kind, transactionCode: transactionCode || jv.transaction_code, entryType: jv.entry_type, entrySubType: 'REVERSAL',
    referenceType: jv.reference_type, referenceId: jv.reference_id, clientId: jv.client_id, policyId: jv.policy_id, policyNumber: jv.policy_number,
    currency: jv.currency, reversalOf: jv.id, status, requiresApproval,
    lines: lines.map((l) => ({ accountCode: l.account_code, debit: l.credit, credit: l.debit, memo: l.memo, clientId: l.client_id, policyId: l.policy_id,
      dueDate: l.due_date, mainAccount: l.main_account, subAccount: l.sub_account, mainAccountDescription: l.main_account_description,
      subAccountDescription: l.sub_account_description, branchCode: l.branch_code, departmentCode: l.department_code, currencyCode: l.currency_code,
      foreignAmount: l.foreign_amount, exchangeRate: l.exchange_rate })),
  }, user);
  if (status === 'posted') await markReversed(db, jv.id, rev.id);
  return rev;
}

export async function markReversed(db, originalId, reversalId) {
  await db.query('UPDATE journal_vouchers SET status = \'reversed\', reversed_by_jv = $2, updated_at = now() WHERE id = $1', [originalId, reversalId]);
}

/** Cancel a journal that has not been posted. */
export async function cancelJournal(db, id, user) {
  const jv = await lockJournal(db, id);
  if (!OPEN_STATES.includes(jv.status)) throw conflict(`Journal ${jv.jv_number} is ${jv.status}; only unposted journals can be cancelled (reverse posted ones)`);
  return (await db.query('UPDATE journal_vouchers SET status = \'cancelled\', cancelled_by = $2, cancelled_at = now(), updated_at = now() WHERE id = $1 RETURNING *', [id, user.id])).rows[0];
}
