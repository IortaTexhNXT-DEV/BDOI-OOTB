/**
 * Month-end checklist: the automatic checks behind the checklist items of type "auto" (period_close_checklist.code).
 * Each check returns { status: passed | failed | not-applicable, count, amount, message, detail (first rows) }.
 * A failed check of severity "warning" is reported as "warning" and does not block the close.
 */
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { addDays } from '../../lib/dates.js';
import { iso, monthEnd, monthStart } from './fiscal.js';

const OPEN_JV = ['pending', 'draft', 'for-approval', 'approved'];
const SAMPLE = 20;

/** Start / end dates of a period row (legacy rows without dates: the calendar month). */
export const bounds = (p) => {
  const start = p.start_date ? iso(p.start_date) : monthStart(`${p.period.slice(0, 7)}-01`);
  const end = p.end_date ? iso(p.end_date) : monthEnd(start);
  return { start, end };
};
const result = (count, message, detail = [], amount = null) => ({ status: count ? 'failed' : 'passed', count, amount, message: count ? message : 'OK', detail });

export const AUTO_CHECKS = {
  async unposted_journals(db, p) {
    const { start, end } = bounds(p);
    const rows = (await db.query(`SELECT jv_number AS "jvNumber", jv_date AS "date", status, description, total_debit AS amount FROM journal_vouchers
      WHERE (period = $1 OR (jv_date BETWEEN $2 AND $3 AND period !~ '-13$')) AND status = ANY($4) ORDER BY jv_date, jv_number`, [p.period, start, end, OPEN_JV])).rows;
    return result(rows.length, `${rows.length} journal(s) in ${p.period} not posted (post, reject or cancel them)`, rows.slice(0, SAMPLE));
  },
  async trial_balance(db, p) {
    const { end } = bounds(p);
    const t = (await db.query(`SELECT COALESCE(sum(l.debit),0) AS d, COALESCE(sum(l.credit),0) AS c FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      WHERE j.status IN ('posted','reversed') AND j.jv_date <= $1`, [end])).rows[0];
    const diff = round2(Number(t.d) - Number(t.c));
    return result(diff !== 0 ? 1 : 0, `Trial balance out of balance by ${diff} as of ${end}`, [{ debit: round2(t.d), credit: round2(t.c), difference: diff }], diff);
  },
  async suspense_balance(db, p) {
    const { end } = bounds(p);
    const code = await getSetting('accounting.account.suspense', null);
    if (!code) return { status: 'not-applicable', count: 0, amount: null, message: 'No suspense account configured (accounting.account.suspense)', detail: [] };
    const b = round2((await db.query(`SELECT COALESCE(sum(l.debit - l.credit),0) AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      WHERE l.account_code = $1 AND j.status IN ('posted','reversed') AND j.jv_date <= $2`, [String(code), end])).rows[0].b);
    return result(b !== 0 ? 1 : 0, `Suspense account ${code} has a balance of ${b} as of ${end}`, [{ accountCode: String(code), balance: b }], b);
  },
  async unapplied_receipts(db, p) {
    const { end } = bounds(p);
    const rows = (await db.query(`SELECT r.receipt_number AS "receiptNumber", r.received_date AS "date", rl.policy_number AS "policyNumber", (rl.paid - rl.applied_amount) AS unapplied
      FROM receipt_lines rl JOIN receipts r ON r.id = rl.receipt_id
      WHERE r.received_date <= $1 AND r.status <> 'cancelled' AND COALESCE(r.receipt_status, '') <> 'Cancelled' AND rl.paid > rl.applied_amount
      ORDER BY r.received_date`, [end])).rows;
    const amount = round2(rows.reduce((s, r) => s + Number(r.unapplied), 0));
    return result(rows.length, `${rows.length} receipt line(s) with ${amount} received but not applied to a bill`, rows.slice(0, SAMPLE), amount);
  },
  // Bank reconciliation module: bank accounts with activity in the period need an approved reconciliation for it
  async unreconciled_bank(db, p) {
    const { monthEndCheck } = await import('../bank-reconciliation/reconcile.js');
    return monthEndCheck(db, p, bounds(p));
  },
  async policies_without_accounting(db, p) {
    const { end } = bounds(p);
    const rows = (await db.query(`SELECT p.policy_number AS "policyNumber", p.inception_date AS "inceptionDate", p.premium_total AS premium FROM policies p
      WHERE p.billing_mode = 'broker' AND p.status IN ('active','issued') AND p.inception_date <= $1 AND p.premium_total > 0
        AND NOT EXISTS (SELECT 1 FROM receivables r WHERE r.policy_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM journal_vouchers j WHERE j.policy_id = p.id AND j.status <> 'cancelled')
      ORDER BY p.inception_date`, [end])).rows;
    return result(rows.length, `${rows.length} issued polic${rows.length === 1 ? 'y has' : 'ies have'} neither a receivable nor a journal`, rows.slice(0, SAMPLE),
      round2(rows.reduce((s, r) => s + Number(r.premium), 0)));
  },
  async remittances_due(db, p) {
    const { end } = bounds(p);
    const rows = (await db.query(`SELECT remittance_number AS reference, period, net_due AS amount, status FROM remittances WHERE status = 'approved' AND COALESCE(period, '') <= $1
      UNION ALL SELECT invoice_number, to_char(created_at, 'YYYY-MM'), outstanding, status FROM invoice_lists
        WHERE lower(payee_type) = 'insurer' AND status IN ('open','in-voucher') AND outstanding > 0 AND created_at::date <= $2::date - 30
      ORDER BY 2`, [p.period.slice(0, 7), end])).rows;
    return result(rows.length, `${rows.length} remittance(s) / insurer payable(s) due and not paid`, rows.slice(0, SAMPLE), round2(rows.reduce((s, r) => s + Number(r.amount), 0)));
  },
  async direct_bill_unbilled(db, p) {
    const { end } = bounds(p);
    const rows = (await db.query(`SELECT i.reference, i.booked_on AS "bookedOn", i.amount FROM direct_bill_items i
      WHERE i.status = 'unbilled' AND i.debit_note_id IS NULL AND i.booked_on <= $1 ORDER BY i.booked_on`, [end])).rows;
    return result(rows.length, `${rows.length} direct-bill commission item(s) not yet billed on a debit note`, rows.slice(0, SAMPLE), round2(rows.reduce((s, r) => s + Number(r.amount), 0)));
  },
};

/** Active checklist items in order. */
export const checklistItems = async (db) => (await db.query('SELECT * FROM period_close_checklist WHERE active ORDER BY sort_order, code')).rows;

/** Run the auto checks of the given items for a period; manual items are returned as pending. */
export async function runChecks(db, p, items) {
  const out = [];
  for (const it of items) {
    if (it.item_type !== 'auto') { out.push({ code: it.code, label: it.label, itemType: 'manual', severity: it.severity, sortOrder: it.sort_order, status: 'pending' }); continue; }
    const fn = AUTO_CHECKS[it.code];
    const r = fn ? await fn(db, p) : { status: 'not-applicable', count: 0, amount: null, message: `No automatic check named ${it.code}`, detail: [] };
    const status = r.status === 'failed' && it.severity === 'warning' ? 'warning' : r.status;
    out.push({ code: it.code, label: it.label, itemType: 'auto', severity: it.severity, sortOrder: it.sort_order, ...r, status });
  }
  return out;
}

/** Blocking auto checks that fail for a period (used before any close). */
export async function blockingFailures(db, p) {
  const items = (await checklistItems(db)).filter((i) => i.item_type === 'auto' && i.severity === 'blocking');
  return (await runChecks(db, p, items)).filter((r) => r.status === 'failed');
}

export const nextDay = (d) => addDays(iso(d), 1);
