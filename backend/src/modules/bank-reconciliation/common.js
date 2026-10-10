/**
 * Shared helpers of bank reconciliation: bank accounts (bank account master linked to a GL cash account), dates and
 * the "reconciled period" guard. Sign convention everywhere: bank line amount = credit - debit (money into the account
 * positive); book line amount = GL debit - credit on the cash account (receipts positive).
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';
import { addDays } from '../../lib/dates.js';
import { iso, monthEnd, monthStart } from '../period-end/fiscal.js';

export const APPROVE = 'approve:bank-reconciliation';
export { round2, iso, addDays };
export const periodStart = (period) => monthStart(`${period}-01`);
export const periodEnd = (period) => monthEnd(`${period}-01`);
export const isPeriod = (p) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(p || ''));
export const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

export const accountRow = (a) => a && ({
  id: a.bank_account_id, code: a.bank_account_code, name: a.bank_account_name, bankCode: a.bank_code, bankName: a.bank_name, accountNumber: a.account_number,
  currency: a.currency, glAccountCode: a.gl_account_code, glAccountName: a.gl_account_name || null, statementFormat: a.statement_format, status: a.status,
  reconcileFrom: a.reconcile_from ? iso(a.reconcile_from) : null,
});

/** A bank account of the master by code or id (any status but deleted). */
export async function getBankAccount(db, ref) {
  if (ref === null || ref === undefined || ref === '') throw badRequest('bankAccount is required');
  const s = String(ref);
  const a = (await db.query(`SELECT b.*, g.name AS gl_account_name FROM bank_account_links b LEFT JOIN gl_accounts g ON g.code = b.gl_account_code
    WHERE lower(b.bank_account_code) = lower($1) OR ($1 ~ '^[0-9]+$' AND b.bank_account_id = $1::int) ORDER BY (lower(b.bank_account_code) = lower($1)) DESC LIMIT 1`, [s])).rows[0];
  if (!a) throw notFound(`Bank account ${s} not found`);
  return a;
}

/** The bank account, which must be linked to a GL cash account. */
export async function linkedAccount(db, ref) {
  const a = await getBankAccount(db, ref);
  if (!a.gl_account_code) throw badRequest(`Bank account ${a.bank_account_code} is not linked to a GL cash account; set its GL cash account first (Bank Reconciliation > Bank account setup)`);
  return a;
}

/** Latest approved reconciliation of an account (its as-of date: nothing on or before it may change). */
export async function lastApproved(db, accountId) {
  return (await db.query('SELECT * FROM bank_reconciliations WHERE bank_account_id = $1 AND status = \'approved\' ORDER BY as_of_date DESC LIMIT 1', [accountId])).rows[0] || null;
}

/** Refuse a change that would alter an approved Bank Reconciliation Statement (date on or before its as-of date). */
export async function assertOpenDate(db, accountId, date, what = 'This change') {
  const rec = await lastApproved(db, accountId);
  if (rec && iso(date) <= iso(rec.as_of_date)) {
    throw conflict(`${what} falls in ${rec.period}, which is reconciled and approved (${rec.rec_number}); an approver must reopen the reconciliation first`);
  }
}

export async function userNames(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  return new Map((await db.query('SELECT id, COALESCE(display_name, username) AS n FROM users WHERE id = ANY($1)', [list])).rows.map((u) => [u.id, u.n]));
}

/** Role names of users by id, for the history entries (who acted, in which role). */
export async function userRoles(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  return new Map((await db.query(`SELECT ur.user_id AS id, array_agg(r.name ORDER BY r.name) AS roles FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ANY($1) GROUP BY ur.user_id`, [list])).rows.map((u) => [u.id, u.roles]));
}

/** Normalised reference: upper case letters and digits only. */
export const normRef = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
