/**
 * Sub-ledger vs GL tie-out (month-end checklist item subledger_tieout). Each control account is compared with the
 * sub-ledger that should explain it:
 *   premium receivable     open bills: sum of receivables.balance
 *   commission receivable  direct-bill commission not yet on a debit note, plus the balance of debit notes not yet
 *                          collected (draft, pending approval, open, partially collected); gross-remittance commission
 *                          reaches the GL only when its billing statement is approved, so only the balance of approved
 *                          billing statements counts
 *   due to insurers        postings made by operations (bookings, returns, payments, adjustments): everything except
 *                          manual and correction journals and their reversals
 * The GL side is the balance as it stands: the opening balances of the year (the go-live set of migrated balances, or a
 * year-end carry-forward) plus the journals posted since. The migrated open items are on the sub-ledger side, their
 * opening balance on the GL side; due to insurers counts the opening balance of the year on both sides, and the legacy
 * commission receivable, not migrated as debit notes, its go-live opening balance on both sides. The comparison is on current balances: sub-ledger and GL move together, so a difference means something reached one
 * and not the other, whenever the check runs. The usual cause is a manual journal on a control account; the detail
 * lists the manual journals on the account.
 */
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { account, currentBalance } from '../accounting/lib/ledger.js';
import { GO_LIVE_PREFIX } from './opening.js';

const POSTED = 'j.status IN (\'posted\', \'reversed\')';
// source of a journal, a reversal counting as its original
const EFFECTIVE_SOURCE = 'COALESCE((SELECT o.source FROM journal_vouchers o WHERE o.id = j.reversal_of), j.source)';
const MANUAL = '(\'manual\', \'correction\')';
/** The latest fiscal year with opening balances (the go-live set or a year-end carry-forward), as fy. */
const OPENING_YEAR = `WITH fy AS (SELECT f.code, f.start_date FROM fiscal_years f
  WHERE f.start_date <= CURRENT_DATE AND EXISTS (SELECT 1 FROM opening_balances o WHERE o.fiscal_year = f.code) ORDER BY f.start_date DESC LIMIT 1)`;

/** GL balance of a control account on its normal side, the go-live opening balances (or a year-end carry-forward) included. */
async function glBalance(db, code, sign) {
  return round2(sign * await currentBalance(db, code));
}

async function manualJournals(db, code) {
  return (await db.query(`SELECT j.jv_number AS "jvNumber", j.jv_date AS date, j.description, round(sum(l.debit - l.credit), 2)::float AS amount
    FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE l.account_code = $1 AND ${POSTED} AND ${EFFECTIVE_SOURCE} IN ${MANUAL}
    GROUP BY j.jv_number, j.jv_date, j.description ORDER BY j.jv_date DESC LIMIT 10`, [code])).rows;
}

/** Rows { ledger, glAccount, subledger, gl, difference, manualJournals } for the three control accounts. */
export async function subledgerTieOut(db) {
  const codes = { receivable: await account('premium_receivable'), commission: await account('commission_receivable'), insurer: await account('due_to_insurer') };
  const premium = round2((await db.query('SELECT COALESCE(sum(balance), 0) AS b FROM receivables WHERE status <> \'cancelled\'')).rows[0].b);
  // the legacy commission receivable is not migrated as debit notes: its opening balance (go-live set) is its own line
  // of the sub-ledger, as it is of the GL
  const commission = round2((await db.query(`${OPENING_YEAR} SELECT
      COALESCE((SELECT sum(amount) FROM direct_bill_items WHERE status = 'unbilled' AND debit_note_id IS NULL AND basis = 'direct'), 0)
    + COALESCE((SELECT sum(balance) FROM commission_debit_notes WHERE status IN ('open', 'partial') OR (basis = 'direct' AND status IN ('draft', 'for-approval'))), 0)
    + COALESCE((SELECT sum(o.balance) FROM opening_balances o JOIN fy ON fy.code = o.fiscal_year WHERE o.account_code = $1 AND o.source_run LIKE $2 || '%'), 0) AS b`,
  [codes.commission, GO_LIVE_PREFIX])).rows[0].b);
  // the operations postings of the year, on the opening balance of the account (go-live set or year-end carry-forward)
  const insurer = round2(-(await db.query(`${OPENING_YEAR}
    SELECT COALESCE((SELECT sum(o.balance) FROM opening_balances o JOIN fy ON fy.code = o.fiscal_year WHERE o.account_code = $1), 0)
      + COALESCE((SELECT sum(l.debit - l.credit) FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
          WHERE l.account_code = $1 AND ${POSTED} AND ${EFFECTIVE_SOURCE} NOT IN ${MANUAL} AND (NOT EXISTS (SELECT 1 FROM fy) OR j.jv_date >= (SELECT start_date FROM fy))), 0) AS b`,
  [codes.insurer])).rows[0].b);
  const rows = [];
  for (const [ledger, code, sub, sign] of [['Premium receivable', codes.receivable, premium, 1], ['Commission receivable', codes.commission, commission, 1],
    ['Due to insurers', codes.insurer, insurer, -1]]) {
    const gl = await glBalance(db, code, sign);
    const difference = round2(sub - gl);
    rows.push({ ledger, glAccount: code, subledger: sub, gl, difference, manualJournals: difference ? await manualJournals(db, code) : [] });
  }
  return rows;
}

/** Month-end check: failed when a sub-ledger differs from its control account by more than period_end.tieout_tolerance. */
export async function tieOutCheck(db) {
  const tolerance = Math.abs(Number(await getSetting('period_end.tieout_tolerance', 0)) || 0);
  const rows = await subledgerTieOut(db);
  const off = rows.filter((r) => Math.abs(r.difference) > tolerance + 0.001);
  return {
    status: off.length ? 'failed' : 'passed', count: off.length, amount: off.length ? round2(off.reduce((s, r) => s + Math.abs(r.difference), 0)) : null,
    message: off.length ? `Sub-ledger and GL differ: ${off.map((r) => `${r.ledger} (${r.glAccount}) by ${r.difference.toFixed(2)}`).join('; ')}` : 'OK',
    detail: rows,
  };
}
