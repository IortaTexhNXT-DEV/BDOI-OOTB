/**
 * Matching of bank statement lines with book entries (posted GL lines on the bank account's cash account).
 *
 * Automatic rules (bank_match_rules, in sort order, only exact amounts):
 *   adjustment    a bank line with the adjustment journal created from it
 *   contra        a book entry and its reversal on the same account (cancelled receipt / cheque) cancel out
 *   reference     same amount and the bank reference equals the cheque no., OR no. or payment reference of the entry
 *   amount-date   same amount, dates within the window, exactly one candidate on each side
 *   one-to-many   one bank line = several book entries in the window (a deposit of several ORs); unique combination
 *   many-to-one   several bank lines = one book entry (a bank batch); unique combination
 * Manual matches take any number of lines on both sides; amounts must agree, or the difference is explained as an
 * adjustment journal (bank transaction type), a bank error or a book error (reconciling items of the statement).
 * Every match records who / when; unmatching keeps the match row (status unmatched, who / when / why).
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { assertOpenDate, iso, normRef, round2 } from './common.js';

const DAY = 86400000;
const days = (a, b) => Math.abs(Date.parse(`${iso(a)}T00:00:00Z`) - Date.parse(`${iso(b)}T00:00:00Z`)) / DAY;

export const bankLineRow = (l) => ({
  id: l.id, statementId: l.statement_id, statementNumber: l.statement_number || null, lineNo: l.line_no, date: iso(l.txn_date), valueDate: l.value_date ? iso(l.value_date) : null,
  description: l.description, reference: l.reference, debit: Number(l.debit), credit: Number(l.credit), amount: Number(l.amount),
  balance: l.running_balance === null || l.running_balance === undefined ? null : Number(l.running_balance), typeCode: l.type_code, flag: l.flag, flagRemarks: l.flag_remarks,
  adjustmentJournalId: l.adjustment_jv_id, adjustmentJournalNumber: l.adjustment_jv_number || null, adjustmentJournalStatus: l.adjustment_jv_status || null,
  matchId: l.match_id || null, matchType: l.match_type || null, clearedDate: l.cleared_date ? iso(l.cleared_date) : null, locked: !!l.locked_by_rec,
});
export const bookLineRow = (v) => ({
  id: Number(v.line_id), journalId: v.jv_id, journalNumber: v.jv_number, date: iso(v.txn_date), journalStatus: v.jv_status, source: v.source, documentType: v.doc_type,
  documentNumber: v.doc_number, chequeNumber: v.cheque_no, chequeStatus: v.cheque_status, checkbookId: v.checkbook_id, receiptId: v.receipt_id, party: v.party,
  reference: v.payment_reference, description: v.description, debit: Number(v.debit), credit: Number(v.credit), amount: Number(v.amount), reversalOf: v.reversal_of,
  matchId: v.match_id || null, matchType: v.match_type || null, clearedDate: v.cleared_date ? iso(v.cleared_date) : null, locked: !!v.locked_by_rec,
});

const BANK_SELECT = `SELECT l.*, s.statement_number, mi.match_id, m.cleared_date, m.match_type, m.locked_by_rec, j.jv_number AS adjustment_jv_number, j.status AS adjustment_jv_status
  FROM bank_statement_lines l LEFT JOIN bank_statements s ON s.id = l.statement_id
  LEFT JOIN bank_rec_match_items mi ON mi.bank_line_id = l.id AND mi.active LEFT JOIN bank_rec_matches m ON m.id = mi.match_id
  LEFT JOIN journal_vouchers j ON j.id = l.adjustment_jv_id`;

/** Bank lines of an account (active), optionally in a date range / unmatched only. */
export async function bankLines(db, accountId, { from = null, to = null, unmatched = false } = {}) {
  return (await db.query(`${BANK_SELECT} WHERE l.bank_account_id = $1 AND l.status = 'active' AND ($2::date IS NULL OR l.txn_date >= $2) AND ($3::date IS NULL OR l.txn_date <= $3)
    ${unmatched ? 'AND mi.match_id IS NULL' : ''} ORDER BY l.txn_date, s.statement_number, l.line_no`, [accountId, from, to])).rows;
}

/** Book entries of an account, optionally in a date range / unmatched only. */
export async function bookLines(db, accountId, { from = null, to = null, unmatched = false } = {}) {
  return (await db.query(`SELECT * FROM bank_book_lines v WHERE v.bank_account_id = $1 AND ($2::date IS NULL OR v.txn_date >= $2) AND ($3::date IS NULL OR v.txn_date <= $3)
    ${unmatched ? 'AND v.match_id IS NULL' : ''} ORDER BY v.txn_date, v.jv_number, v.line_id`, [accountId, from, to])).rows;
}

/** Insert a match with its items. items: [{ side, id, amount, date }]. */
export async function insertMatch(db, account, items, { matchType, ruleCode = null, confidence = null, treatment = null, remarks = null, user }) {
  const bank = items.filter((i) => i.side === 'bank');
  const book = items.filter((i) => i.side === 'book');
  const bankTotal = round2(bank.reduce((s, i) => s + Number(i.amount), 0));
  const bookTotal = round2(book.reduce((s, i) => s + Number(i.amount), 0));
  const difference = round2(bankTotal - bookTotal);
  if (difference !== 0 && !treatment) throw badRequest(`Bank ${bankTotal} and book ${bookTotal} differ by ${difference}; explain the difference`);
  const cleared = items.map((i) => iso(i.date)).sort().pop();
  await assertOpenDate(db, account.bank_account_id, cleared, 'The match');
  const m = (await db.query(`INSERT INTO bank_rec_matches(bank_account_id, match_type, rule_code, confidence, bank_total, book_total, difference, difference_treatment, cleared_date, remarks, matched_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
  [account.bank_account_id, matchType, ruleCode, confidence, bankTotal, bookTotal, difference, difference ? treatment : null, cleared, remarks, user?.id ?? null])).rows[0];
  for (const i of items) {
    try {
      await db.query('INSERT INTO bank_rec_match_items(match_id, side, bank_line_id, journal_line_id, amount) VALUES ($1,$2,$3,$4,$5)',
        [m.id, i.side, i.side === 'bank' ? i.id : null, i.side === 'book' ? i.id : null, i.amount]);
    } catch (e) {
      if (e.code === '23505') throw conflict(`${i.side === 'bank' ? 'Bank line' : 'Book entry'} ${i.label || i.id} is already matched`);
      throw e;
    }
  }
  return m;
}

const bankItem = (l) => ({ side: 'bank', id: l.id, amount: Number(l.amount), date: l.txn_date, label: l.reference || l.description });
const bookItem = (v) => ({ side: 'book', id: Number(v.line_id), amount: Number(v.amount), date: v.txn_date, label: v.jv_number });

/** References of a bank line: its reference and the tokens of its description with digits. */
function bankRefs(l) {
  const out = new Set();
  if (normRef(l.reference).length >= 3) out.add(normRef(l.reference));
  for (const w of String(l.description || '').split(/[\s/#:,;]+/)) if (/\d/.test(w) && normRef(w).length >= 4) out.add(normRef(w));
  return out;
}
const bookRefs = (v) => new Set([v.cheque_no, v.payment_reference, v.doc_number, v.transaction_code].map(normRef).filter((r) => r.length >= 3));
const numeric = (r) => (/^\d+$/.test(r) ? String(Number(r)) : null);
function refsMatch(a, b) {
  for (const x of a) {
    for (const y of b) {
      if (x === y) return true;
      const nx = numeric(x); const ny = numeric(y);
      if (nx && ny && nx === ny && nx.length >= 3) return true;
      if (x.length >= 6 && y.length >= 6 && (x.endsWith(y) || y.endsWith(x))) return true;
    }
  }
  return false;
}

/** Subsets (2..max items) of candidates whose amounts add up to target; stops after `limit` solutions. */
function subsets(cands, target, max, limit = 2) {
  const found = [];
  const t = Math.round(target * 100);
  const vals = cands.map((c) => Math.round(Number(c.amount) * 100));
  let steps = 0;
  const walk = (start, sum, picked) => {
    if (found.length >= limit || steps > 20000) return;
    steps += 1;
    if (picked.length >= 2 && sum === t) { found.push(picked.map((i) => cands[i])); return; }
    if (picked.length >= max) return;
    for (let i = start; i < cands.length; i += 1) {
      const next = sum + vals[i];
      if (Math.abs(next) > Math.abs(t)) continue;
      walk(i + 1, next, [...picked, i]);
    }
  };
  walk(0, 0, []);
  return found;
}

/** Run the automatic matching rules for one bank account. Returns { matched, byRule, matches }. */
export async function autoMatch(db, account, user = null) {
  const rules = (await db.query('SELECT * FROM bank_match_rules WHERE active ORDER BY sort_order, code')).rows;
  const window = Number(await getSetting('bank_reconciliation.date_window_days', 5));
  const maxLines = Number(await getSetting('bank_reconciliation.group_max_lines', 6));
  const approved = (await db.query('SELECT max(as_of_date) AS d FROM bank_reconciliations WHERE bank_account_id = $1 AND status = \'approved\'', [account.bank_account_id])).rows[0].d;
  const open = (d) => !approved || iso(d) > iso(approved);
  let bank = (await bankLines(db, account.bank_account_id, { unmatched: true })).filter((l) => !l.flag);
  let book = await bookLines(db, account.bank_account_id, { unmatched: true });
  const byRule = {}; const matches = [];
  const take = async (rule, bankSel, bookSel, type = 'auto') => {
    const items = [...bankSel.map(bankItem), ...bookSel.map(bookItem)];
    if (!open(items.map((i) => iso(i.date)).sort().pop())) return false;
    const m = await insertMatch(db, account, items, { matchType: type, ruleCode: rule.code, confidence: rule.confidence, user });
    const bs = new Set(bankSel.map((l) => l.id)); const ks = new Set(bookSel.map((v) => String(v.line_id)));
    bank = bank.filter((l) => !bs.has(l.id));
    book = book.filter((v) => !ks.has(String(v.line_id)));
    byRule[rule.code] = (byRule[rule.code] || 0) + 1;
    matches.push({ id: m.id, rule: rule.code, confidence: rule.confidence, bankLines: bankSel.length, bookLines: bookSel.length, amount: Number(m.bank_total || m.book_total) });
    return true;
  };
  const same = (a, b) => round2(a) === round2(b);
  for (const rule of rules) {
    const p = rule.params || {};
    const win = Number(p.dateWindowDays ?? window);
    const max = Number(p.maxLines ?? maxLines);
    if (rule.rule_type === 'adjustment') {
      for (const l of bank.filter((x) => x.adjustment_jv_id)) {
        const sel = book.filter((v) => v.jv_id === l.adjustment_jv_id || v.reversal_of === l.adjustment_jv_id);
        const own = book.filter((v) => v.jv_id === l.adjustment_jv_id);
        if (own.length && same(own.reduce((s, v) => s + Number(v.amount), 0), l.amount)) await take(rule, [l], own, 'adjustment');
        else if (sel.length && same(sel.reduce((s, v) => s + Number(v.amount), 0), l.amount)) await take(rule, [l], sel, 'adjustment');
      }
    } else if (rule.rule_type === 'contra') {
      for (const v of [...book]) {
        if (!v.reversal_of || !book.includes(v)) continue;
        const orig = book.filter((o) => o.jv_id === v.reversal_of);
        const rev = book.filter((o) => o.jv_id === v.jv_id);
        const net = round2([...orig, ...rev].reduce((s, o) => s + Number(o.amount), 0));
        if (orig.length && net === 0) await take(rule, [], [...orig, ...rev], 'contra');
      }
    } else if (rule.rule_type === 'reference') {
      for (const l of [...bank]) {
        const refs = bankRefs(l);
        if (!refs.size) continue;
        const cands = book.filter((v) => same(v.amount, l.amount) && refsMatch(refs, bookRefs(v)));
        if (cands.length === 1) await take(rule, [l], cands);
        else if (cands.length > 1) {
          cands.sort((a, b) => days(a.txn_date, l.txn_date) - days(b.txn_date, l.txn_date));
          await take(rule, [l], [cands[0]]);
        }
      }
    } else if (rule.rule_type === 'amount-date') {
      for (const l of [...bank]) {
        const cands = book.filter((v) => same(v.amount, l.amount) && days(v.txn_date, l.txn_date) <= win);
        if (cands.length !== 1) continue;
        const back = bank.filter((x) => same(x.amount, cands[0].amount) && days(x.txn_date, cands[0].txn_date) <= win);
        if (back.length === 1) await take(rule, [l], cands);
      }
    } else if (rule.rule_type === 'one-to-many') {
      for (const l of [...bank]) {
        const cands = book.filter((v) => Math.sign(v.amount) === Math.sign(l.amount) && Math.abs(v.amount) < Math.abs(l.amount) && days(v.txn_date, l.txn_date) <= win).slice(0, 20);
        if (cands.length < 2) continue;
        const sol = subsets(cands, Number(l.amount), max);
        if (sol.length === 1) await take(rule, [l], sol[0]);
      }
    } else if (rule.rule_type === 'many-to-one') {
      for (const v of [...book]) {
        const cands = bank.filter((l) => Math.sign(l.amount) === Math.sign(v.amount) && Math.abs(l.amount) < Math.abs(v.amount) && days(v.txn_date, l.txn_date) <= win).slice(0, 20);
        if (cands.length < 2) continue;
        const sol = subsets(cands, Number(v.amount), max);
        if (sol.length === 1) await take(rule, sol[0], [v]);
      }
    }
  }
  return { bankAccount: account.bank_account_code, matched: matches.length, byRule, matches };
}

/**
 * Manual match: { bankLineIds, bookLineIds, treatment (bank-error | book-error, when amounts differ), remarks }.
 * (A difference explained by an adjustment journal is posted first by the router through postBankAdjustment.)
 */
export async function manualMatch(db, account, { bankLineIds = [], bookLineIds = [], treatment = null, remarks = null }, user) {
  if (!bankLineIds.length && !bookLineIds.length) throw badRequest('Select the bank lines and book entries to match');
  if (bankLineIds.length + bookLineIds.length < 2) throw badRequest('A match needs at least two lines');
  const bank = (await db.query(`${BANK_SELECT} WHERE l.id = ANY($1) AND l.status = 'active' FOR UPDATE OF l`, [bankLineIds])).rows;
  if (bank.length !== new Set(bankLineIds).size) throw notFound('Bank line not found');
  if (bank.some((l) => l.bank_account_id !== account.bank_account_id)) throw badRequest(`Every bank line must belong to ${account.bank_account_code}`);
  const book = (await db.query('SELECT * FROM bank_book_lines WHERE line_id = ANY($1::bigint[])', [bookLineIds.map(Number)])).rows;
  if (book.length !== new Set(bookLineIds.map(Number)).size) throw notFound('Book entry not found (only posted entries on the bank account\'s GL account can be matched)');
  if (book.some((v) => v.bank_account_id !== account.bank_account_id)) throw badRequest(`Every book entry must be on ${account.gl_account_code}`);
  const taken = [...bank.filter((l) => l.match_id).map((l) => l.reference || l.description), ...book.filter((v) => v.match_id).map((v) => v.jv_number)];
  if (taken.length) throw conflict(`Already matched: ${taken.join(', ')}`);
  if (treatment && !['bank-error', 'book-error'].includes(treatment)) throw badRequest('treatment must be bank-error or book-error');
  return insertMatch(db, account, [...bank.map(bankItem), ...book.map(bookItem)], { matchType: 'manual', treatment, remarks, user });
}

export async function getMatch(db, id) {
  const m = (await db.query('SELECT * FROM bank_rec_matches WHERE id = $1', [String(id)])).rows[0];
  if (!m) throw notFound('Match not found');
  const items = (await db.query('SELECT * FROM bank_rec_match_items WHERE match_id = $1 ORDER BY side, id', [m.id])).rows;
  return { ...m, items };
}

export const matchRow = (m, users = new Map()) => ({
  id: m.id, matchType: m.match_type, rule: m.rule_code, confidence: m.confidence, bankTotal: Number(m.bank_total), bookTotal: Number(m.book_total), difference: Number(m.difference),
  treatment: m.difference_treatment, clearedDate: iso(m.cleared_date), remarks: m.remarks, status: m.status, locked: !!m.locked_by_rec,
  matchedBy: users.get(m.matched_by) || m.matched_by || 'system', matchedAt: m.matched_at, unmatchedBy: users.get(m.unmatched_by) || m.unmatched_by, unmatchedAt: m.unmatched_at, unmatchReason: m.unmatch_reason,
  items: (m.items || []).map((i) => ({ side: i.side, bankLineId: i.bank_line_id, journalLineId: i.journal_line_id === null ? null : Number(i.journal_line_id), amount: Number(i.amount), active: i.active })),
});

/** Undo a match (kept as unmatched with who / when / why). A match locked by an approved reconciliation is refused. */
export async function unmatch(db, id, user, reason = null) {
  const m = (await db.query('SELECT * FROM bank_rec_matches WHERE id = $1 FOR UPDATE', [String(id)])).rows[0];
  if (!m) throw notFound('Match not found');
  if (m.status !== 'active') throw conflict('The match was already undone');
  if (m.locked_by_rec) {
    const rec = (await db.query('SELECT rec_number, period FROM bank_reconciliations WHERE id = $1', [m.locked_by_rec])).rows[0];
    throw conflict(`The match is part of the approved reconciliation ${rec?.rec_number || ''} (${rec?.period || ''}); an approver must reopen it first`);
  }
  await assertOpenDate(db, m.bank_account_id, m.cleared_date, 'The match');
  await db.query('UPDATE bank_rec_match_items SET active = false WHERE match_id = $1', [m.id]);
  const after = (await db.query('UPDATE bank_rec_matches SET status = \'unmatched\', unmatched_by = $2, unmatched_at = now(), unmatch_reason = $3 WHERE id = $1 RETURNING *', [m.id, user.id, reason])).rows[0];
  return { before: m, after };
}

export async function listMatches(db, accountId, { from = null, to = null, status = 'active' } = {}) {
  const rows = (await db.query(`SELECT m.*, COALESCE((SELECT json_agg(i ORDER BY i.side, i.id) FROM bank_rec_match_items i WHERE i.match_id = m.id), '[]') AS items FROM bank_rec_matches m
    WHERE m.bank_account_id = $1 AND ($2::date IS NULL OR m.cleared_date >= $2) AND ($3::date IS NULL OR m.cleared_date <= $3) AND ($4::text IS NULL OR m.status = $4)
    ORDER BY m.matched_at DESC LIMIT 500`, [accountId, from, to, status === 'all' ? null : status])).rows;
  return rows;
}

/** Flag / unflag a bank line as a bank error (a reconciling item on the bank side, no journal). */
export async function flagLine(db, id, { flag = null, remarks = null }, user) {
  const l = (await db.query(`${BANK_SELECT} WHERE l.id = $1 AND l.status = 'active' FOR UPDATE OF l`, [String(id)])).rows[0];
  if (!l) throw notFound('Bank line not found');
  if (flag && flag !== 'bank-error') throw badRequest('flag must be bank-error or empty');
  if (flag && l.match_id) throw conflict('The line is matched; unmatch it first');
  if (flag && !String(remarks || '').trim()) throw badRequest('Explain the bank error in the remarks');
  if (l.bank_account_id) await assertOpenDate(db, l.bank_account_id, l.txn_date, 'The line');
  return (await db.query('UPDATE bank_statement_lines SET flag = $2, flag_remarks = $3, updated_by = $4, updated_at = now() WHERE id = $1 RETURNING *', [l.id, flag, flag ? remarks : null, user.id])).rows[0];
}
