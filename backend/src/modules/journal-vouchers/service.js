/**
 * Manual journal vouchers with maker-checker: created 'for-approval' (journal.require_approval), posted by a different
 * user on approval. Reversal JVs mirror a posted voucher; correction JVs reverse it and post the corrected lines in one
 * voucher. Both go through the same approval.
 */
import { getSetting } from '../../lib/settings.js';
import { baseCurrency, rateToBase } from '../../lib/currency.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { assertPeriodOpen, createJournal, postJournal, reverseJournal } from '../accounting/lib/ledger.js';
import { assertChecker, isoDate, num, round2, today } from '../accounting/lib/http.js';
import { assertAuthority } from '../access-control/service.js';

const MANUAL_SOURCES = ['manual', 'correction', 'reversal'];
export const headerRow = (j) => ({
  id: j.id, journalVoucherId: j.id, transactionCode: j.transaction_code, transactionNumber: j.jv_number, transactionDescription: j.description, description: j.description,
  date: j.jv_date, voucherDate: j.jv_date, totalDebit: Number(j.total_debit), totalCredit: Number(j.total_credit), status: j.status, kind: j.kind, source: j.source,
  requiresApproval: j.requires_approval, createdBy: j.created_by, createdAt: j.created_at, approvedBy: j.approved_by, approvedAt: j.approved_at, postedAt: j.posted_at,
  rejectedBy: j.rejected_by, rejectionReason: j.rejection_reason, reversalOf: j.reversal_of, correctionOf: j.correction_of, reversedBy: j.reversed_by_jv,
});
export const lineRow = (l, j) => ({
  ...headerRow(j), id: String(l.id), lineId: String(l.id), lineNo: l.line_no, accountCode: l.account_code, accountName: l.account_name,
  mainAccount: l.main_account || l.account_code, subAccount: l.sub_account || '', mainAccountDescription: l.main_account_description || l.account_name || '',
  subAccountDescription: l.sub_account_description || '', entryType: Number(l.debit) > 0 ? 'Debit' : 'Credit', debit: Number(l.debit), credit: Number(l.credit),
  localAmount: Number(l.debit) > 0 ? Number(l.debit) : Number(l.credit), foreignAmount: l.foreign_amount === null ? null : Number(l.foreign_amount),
  currencyCode: l.currency_code, exchangeRate: Number(l.exchange_rate), remarks: l.memo || '', branchCode: l.branch_code || '', branchCodeDescription: l.branch_description || '',
  departmentCode: l.department_code || '', departmentDescription: l.department_description || '',
});

export async function getJv(db, ref, lock = false) {
  const j = (await db.query(`SELECT * FROM journal_vouchers WHERE id = $1 OR jv_number = $1${lock ? ' FOR UPDATE' : ''}`, [String(ref)])).rows[0];
  if (!j) throw notFound('Journal voucher not found');
  return j;
}
export async function jvDetail(db, ref) {
  const j = await getJv(db, ref);
  const lines = (await db.query('SELECT * FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [j.id])).rows;
  return { ...headerRow(j), entries: lines.map((l) => lineRow(l, j)) };
}

export async function history(db, q, pg) {
  const where = []; const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replaceAll('?', `$${p.length}`)); };
  if (String(q.all) !== 'true') add('source = ANY(?)', MANUAL_SOURCES);
  if (q.transactionCode) add('transaction_code ILIKE \'%\' || ? || \'%\'', q.transactionCode);
  if (q.transactionNumber) add('jv_number ILIKE \'%\' || ? || \'%\'', q.transactionNumber);
  if (q.status) add('status = ?', q.status);
  if (q.kind) add('kind = ?', q.kind);
  if (q.fromDate) add('jv_date >= ?::date', isoDate(q.fromDate));
  if (q.toDate) add('jv_date <= ?::date', isoDate(q.toDate));
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n FROM journal_vouchers ${w}`, p)).rows[0].n;
  const rows = (await db.query(`SELECT * FROM journal_vouchers ${w} ORDER BY jv_date DESC, created_at DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, pg.limit, pg.offset])).rows;
  return { rows: rows.map(headerRow), total };
}

/**
 * Convert voucher entries (Debit / Credit, foreign amount, currency) to ledger lines in the base currency (Currency
 * master, is_base). A foreign-currency line converts at the rate of the dated Exchange Rate master in force on the
 * voucher date (amount in base = foreign amount x rate); the rate is stored on the line. A local amount sent with a
 * foreign-currency line must agree with that conversion.
 */
export async function toLines(db, entries, date) {
  if (!Array.isArray(entries) || !entries.length) throw badRequest('entries are required');
  const base = await baseCurrency(db);
  const on = date || (await today());
  const known = new Set((await db.query('SELECT code FROM gl_accounts WHERE code = ANY($1)', [entries.flatMap((e) => [e.subAccount, e.mainAccount].filter(Boolean))])).rows.map((r) => r.code));
  const out = [];
  for (const [i, e] of entries.entries()) {
    const side = String(e.entryType || '').toLowerCase();
    if (!['debit', 'credit'].includes(side)) throw badRequest(`Entry ${i + 1}: entryType must be Debit or Credit`);
    const currency = String(e.currencyCode || base).toUpperCase();
    const given = e.localAmount !== undefined && e.localAmount !== '' && e.localAmount !== null ? round2(num(e.localAmount)) : null;
    let rate = 1;
    let local;
    if (currency === base) {
      local = given ?? round2(num(e.foreignAmount));
    } else {
      if (e.foreignAmount === undefined || e.foreignAmount === null || e.foreignAmount === '') throw badRequest(`Entry ${i + 1}: foreignAmount is required for a ${currency} line`);
      try {
        rate = await rateToBase(db, currency, on, base);
      } catch (err) {
        throw badRequest(`Entry ${i + 1}: ${err.message}`);
      }
      local = round2(num(e.foreignAmount) * rate);
      if (given !== null && Math.abs(given - local) > 0.01) {
        throw badRequest(`Entry ${i + 1}: local amount ${given} does not match ${e.foreignAmount} ${currency} at the ${on} rate ${rate} (${local})`);
      }
    }
    if (!(local > 0)) throw badRequest(`Entry ${i + 1}: amount must be greater than zero`);
    const accountCode = e.subAccount && known.has(e.subAccount) ? e.subAccount : e.mainAccount;
    if (!accountCode) throw badRequest(`Entry ${i + 1}: mainAccount is required`);
    out.push({ accountCode, debit: side === 'debit' ? local : 0, credit: side === 'credit' ? local : 0, memo: e.remarks || null, mainAccount: e.mainAccount, subAccount: e.subAccount || null,
      mainAccountDescription: e.mainAccountDescription, subAccountDescription: e.subAccountDescription, branchCode: e.branchCode, branchDescription: e.branchCodeDescription,
      departmentCode: e.departmentCode, departmentDescription: e.departmentDescription, currencyCode: currency, foreignAmount: e.foreignAmount === undefined ? null : round2(num(e.foreignAmount)), exchangeRate: rate });
  }
  return out;
}

const approvalStatus = async () => ((await getSetting('journal.require_approval', true)) ? 'for-approval' : 'posted');

export async function createManual(db, b, user) {
  const status = await approvalStatus();
  const date = isoDate(b.date || b.voucherDate) || (await today());
  return createJournal(db, { date, description: b.transactionDescription || b.description || null, source: 'manual', manual: true,
    transactionCode: b.transactionCode, entryType: 'JOURNAL_VOUCHER', referenceType: 'JournalVoucher', status, requiresApproval: status !== 'posted', lines: await toLines(db, b.entries, date) }, user);
}

async function assertNoPendingAdjustment(db, original) {
  const p = (await db.query('SELECT jv_number FROM journal_vouchers WHERE (reversal_of = $1 OR correction_of = $1) AND status IN (\'for-approval\',\'pending\',\'draft\')', [original.id])).rows[0];
  if (p) throw conflict(`Journal ${original.jv_number} already has a pending adjustment (${p.jv_number})`);
}

export async function createReversal(db, b, user) {
  const original = await getJv(db, b.transactionNumber || b.journalVoucherId || b.id, true);
  await assertNoPendingAdjustment(db, original);
  const status = await approvalStatus();
  return reverseJournal(db, original.id, user, { date: isoDate(b.date) || (await today()), description: b.description || b.reversalDescription, transactionCode: b.reversalJVTransactionCode || b.transactionCode,
    status, requiresApproval: status !== 'posted' });
}

export async function createCorrection(db, b, user) {
  const original = await getJv(db, b.transactionNumber || b.journalVoucherId || b.id, true);
  if (original.status !== 'posted') throw conflict(`Only posted vouchers can be corrected (${original.jv_number} is ${original.status})`);
  await assertNoPendingAdjustment(db, original);
  const old = (await db.query('SELECT * FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [original.id])).rows;
  const reversal = old.map((l) => ({ accountCode: l.account_code, debit: Number(l.credit), credit: Number(l.debit), memo: `Reverse ${original.jv_number}${l.memo ? ` – ${l.memo}` : ''}`,
    mainAccount: l.main_account, subAccount: l.sub_account, branchCode: l.branch_code, departmentCode: l.department_code, currencyCode: l.currency_code, clientId: l.client_id, policyId: l.policy_id }));
  const status = await approvalStatus();
  const date = isoDate(b.date) || (await today());
  if (status === 'posted') await assertPeriodOpen(db, date);
  const jv = await createJournal(db, { date, description: b.description || `Correction of ${original.jv_number}`, source: 'correction', kind: 'correction', manual: true,
    transactionCode: b.correctionJVTransactionCode || b.transactionCode || original.transaction_code, entryType: original.entry_type || 'JOURNAL_VOUCHER', referenceType: 'JournalVoucher',
    referenceId: original.id, correctionOf: original.id, status: status === 'posted' ? 'pending' : status, requiresApproval: status !== 'posted',
    lines: [...reversal, ...(await toLines(db, b.entries, date))] }, user);
  if (status === 'posted') return postJournal(db, jv.id, user);
  return jv;
}

export async function approve(db, ref, user) {
  const j = await getJv(db, ref, true);
  if (j.status !== 'for-approval') throw conflict(`Voucher ${j.jv_number} is ${j.status}; only vouchers awaiting approval can be approved`);
  await assertChecker(user, j.created_by, 'journal voucher');
  const debits = (await db.query('SELECT COALESCE(sum(debit), 0) AS total FROM journal_lines WHERE jv_id = $1', [j.id])).rows[0].total;
  await assertAuthority(db, user, 'journal_voucher', Number(debits));
  return postJournal(db, j.id, user);
}

export async function reject(db, ref, reason, user) {
  const j = await getJv(db, ref, true);
  if (j.status !== 'for-approval') throw conflict(`Voucher ${j.jv_number} is ${j.status}; only vouchers awaiting approval can be rejected`);
  await assertChecker(user, j.created_by, 'journal voucher');
  return (await db.query('UPDATE journal_vouchers SET status = \'rejected\', rejected_by = $2, rejected_at = now(), rejection_reason = $3, updated_at = now() WHERE id = $1 RETURNING *', [j.id, user.id, reason])).rows[0];
}
