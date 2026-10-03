/**
 * Go-live open items: premium bills still unpaid in the old system, loaded against policies already in BrokerVerse.
 * Each becomes a receivable with source 'opening' (legacy bill reference kept in reference, go_live_date set) and a
 * collection item, so it ages, is chased and is paid like any bill. No booking journal is posted: the GL carries
 * these bills in the opening balance of the premiums receivable account (Accounts > Period End > opening balances).
 *
 * Rows are loaded one by one; a row already loaded for the same go-live date is skipped, so the file can be uploaded
 * again after fixing the rows that failed.
 */
import { badRequest, conflict } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { excelDate } from '../accounting/lib/sheet.js';
import { findPolicy } from './receivables.js';

export const OPENING_SOURCE = 'opening';

/** Columns of the open items upload; the upload template is built from this list. */
export const OPEN_ITEM_COLUMNS = [
  { key: 'policyNumber', header: 'Policy Number', aliases: ['policy no', 'policy'], required: true, format: 'Policy number already in BrokerVerse (load the in-force policies first)', example: 'FPG-FI-2026-004417' },
  { key: 'billReference', header: 'Bill Reference', aliases: ['invoice number', 'debit note', 'reference'], required: true, format: 'Invoice or debit note number in the old system; one per policy', example: 'DN-2026-08812' },
  { key: 'dueDate', header: 'Due Date', required: true, format: 'Date YYYY-MM-DD; drives ageing and reminders', example: '2026-10-31' },
  { key: 'originalAmount', header: 'Original Amount', aliases: ['bill amount', 'amount'], format: 'Amount billed in PHP; the open balance when empty', example: '78437.50' },
  { key: 'openBalance', header: 'Open Balance', aliases: ['balance', 'outstanding'], required: true, format: 'Amount still unpaid at go-live in PHP, greater than zero', example: '40000.00' },
];

const num = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : Number(String(v).replace(/,/g, '').trim()));

/** Load one row ({ policyNumber, billReference, dueDate, originalAmount, openBalance }); returns { status, billNumber }. */
export async function loadOpenItem(db, v, { goLiveDate, user }) {
  if (!v.policyNumber) throw badRequest('Policy Number is required');
  if (!v.billReference) throw badRequest('Bill Reference is required');
  const policy = await findPolicy(db, v.policyNumber);
  if (!policy) throw badRequest(`Policy ${v.policyNumber} is not in BrokerVerse; load the in-force policies first`);
  if (policy.billing_mode === 'direct') throw badRequest(`Policy ${policy.policy_number} is direct billed: the client pays the insurer`);
  const due = excelDate(v.dueDate);
  if (!due) throw badRequest('Due Date is required (YYYY-MM-DD)');
  const balance = num(v.openBalance);
  if (!(balance > 0)) throw badRequest('Open Balance must be an amount greater than zero');
  const amount = num(v.originalAmount) ?? balance;
  if (!(amount >= balance)) throw badRequest('Original Amount cannot be less than the Open Balance');
  const ref = String(v.billReference).trim();
  const existing = (await db.query('SELECT bill_number, go_live_date FROM receivables WHERE policy_id = $1 AND reference = $2 AND source = $3', [policy.id, ref, OPENING_SOURCE])).rows[0];
  if (existing) {
    const loadedFor = existing.go_live_date ? new Date(existing.go_live_date).toISOString().slice(0, 10) : null;
    if (loadedFor && loadedFor !== goLiveDate) throw conflict(`Bill ${ref} of ${policy.policy_number} was loaded for go-live date ${loadedFor}`);
    return { status: 'skipped', billNumber: existing.bill_number };
  }
  const billNumber = await nextDocumentNumber('invoice', { db, unique: { table: 'receivables', column: 'bill_number' } });
  const r = (await db.query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status, source, reference, currency, net_premium, go_live_date, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$4,$11,$12) RETURNING id`,
  [billNumber, policy.id, policy.client_id, round2(amount), round2(balance), due, balance < amount ? 'partial' : 'open', OPENING_SOURCE, ref, policy.currency || 'PHP', goLiveDate, user?.id ?? null])).rows[0];
  await db.query('INSERT INTO collection_items(receivable_id, policy_id, client_id) VALUES ($1,$2,$3) ON CONFLICT (receivable_id) DO NOTHING', [r.id, policy.id, policy.client_id]);
  return { status: 'created', billNumber };
}
