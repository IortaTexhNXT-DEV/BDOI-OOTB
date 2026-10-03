/**
 * Month-end valuation steps: unearned commission deferral and foreign-currency revaluation. Both post one journal
 * dated the period end (source period-close) that is reversed automatically on day 1 of the next period.
 */
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { addDays, DAY_MS } from '../../lib/dates.js';
import { account, createJournal } from '../accounting/lib/ledger.js';
import { bounds } from './checks.js';
import { baseCurrency, exchangeRateOn } from '../../lib/currency.js';

const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const isoOf = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

async function record(db, { runId, period, step, jv, reverseOn }) {
  await db.query('INSERT INTO period_close_entries(run_id, period, step, jv_id, auto_reverse_on) VALUES ($1,$2,$3,$4,$5)', [runId, period, step, jv.id, reverseOn]);
}

/**
 * Commission deferral (accounting.defer_commission): for every policy whose cover runs past the period end, the part
 * of the commission income recognised up to the period end that relates to days after it (pro rata by days) is moved
 * to unearned commission: Dr Commission Income / Cr Unearned Commission, reversed on day 1 of the next period.
 */
export async function deferCommission(db, p, { user, runId }) {
  if (!(await getSetting('accounting.defer_commission', false))) return { status: 'skipped', message: 'Commission deferral is off (accounting.defer_commission)' };
  const { end } = bounds(p);
  const income = await account('commission_income');
  const unearned = await account('unearned_commission');
  const rows = (await db.query(`SELECT po.id, po.policy_number, po.inception_date, po.expiry_date, sum(l.credit - l.debit) AS commission
      FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN policies po ON po.id = COALESCE(l.policy_id, j.policy_id)
     WHERE l.account_code = $1 AND j.status IN ('posted','reversed') AND j.jv_date <= $2 AND COALESCE(j.entry_type, '') <> 'COMMISSION_DEFERRAL'
       AND j.source <> 'year-end-close' AND po.expiry_date > $2
     GROUP BY po.id, po.policy_number, po.inception_date, po.expiry_date HAVING sum(l.credit - l.debit) > 0 ORDER BY po.policy_number`, [income, end])).rows;
  const lines = []; const detail = [];
  for (const r of rows) {
    const start = isoOf(r.inception_date); const expiry = isoOf(r.expiry_date);
    const total = Math.max(1, days(start, expiry));
    const earned = Math.min(total, Math.max(0, days(start, end) + 1));
    const amount = round2(Number(r.commission) * (total - earned) / total);
    if (!(amount > 0)) continue;
    const memo = `Unearned commission ${r.policy_number} (${total - earned}/${total} days)`;
    lines.push({ accountCode: income, debit: amount, credit: 0, memo, policyId: r.id }, { accountCode: unearned, debit: 0, credit: amount, memo, policyId: r.id });
    detail.push({ policyNumber: r.policy_number, commission: round2(r.commission), coverDays: total, unearnedDays: total - earned, deferred: amount });
  }
  if (!lines.length) return { status: 'done', message: 'No commission to defer', amount: 0, journals: [], detail };
  const jv = await createJournal(db, { date: end, description: `Unearned commission deferral ${p.period}`, source: 'period-close', entryType: 'COMMISSION_DEFERRAL',
    referenceType: 'PeriodClose', referenceId: runId, status: 'posted', lines }, user);
  await record(db, { runId, period: p.period, step: 'deferral', jv, reverseOn: addDays(end, 1) });
  const amount = round2(detail.reduce((s, d) => s + d.deferred, 0));
  return { status: 'done', message: `Deferred ${amount} of commission on ${detail.length} polic${detail.length === 1 ? 'y' : 'ies'}`, amount, journals: [jv.id], detail };
}

/** Month-end rate of a currency into the base currency from the dated Exchange Rate master (null when missing). */
export async function monthEndRate(db, currency, base, date) {
  return exchangeRateOn(db, currency, base, date);
}

/**
 * FX revaluation: foreign-currency balances (lines carrying a foreign amount) of monetary accounts
 * (accounting.fx_revaluation_account_types) are restated into the base currency (Currency master) at the month-end
 * rate of the Exchange Rate master, the same rates journal vouchers convert at; the difference goes to unrealised FX gain / loss and is reversed on day 1 of the next period.
 */
export async function revalueFx(db, p, { user, runId }) {
  const { end } = bounds(p);
  const base = await baseCurrency(db);
  const types = (await getSetting('accounting.fx_revaluation_account_types', ['asset', 'liability'])) || ['asset', 'liability'];
  const rows = (await db.query(`SELECT l.account_code, upper(l.currency_code) AS ccy,
        sum(CASE WHEN l.debit > 0 THEN l.foreign_amount ELSE -l.foreign_amount END) AS fc, sum(l.debit - l.credit) AS book
      FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
     WHERE j.status IN ('posted','reversed') AND j.jv_date <= $1 AND l.foreign_amount IS NOT NULL AND l.currency_code IS NOT NULL
       AND upper(l.currency_code) <> $2 AND a.account_type = ANY($3)
     GROUP BY 1, 2 ORDER BY 1, 2`, [end, base, types])).rows;
  if (!rows.length) return { status: 'done', message: 'No foreign-currency balances to revalue', amount: 0, journals: [], detail: [] };
  const gain = await account('fx_unrealised_gain');
  const loss = await account('fx_unrealised_loss');
  const lines = []; const detail = []; const missing = new Set();
  for (const r of rows) {
    const rate = await monthEndRate(db, r.ccy, base, end);
    if (!rate) { missing.add(r.ccy); continue; }
    const revalued = round2(Number(r.fc) * rate);
    const diff = round2(revalued - Number(r.book));
    detail.push({ accountCode: r.account_code, currency: r.ccy, foreignBalance: round2(r.fc), rate, bookBalance: round2(r.book), revalued, difference: diff });
    if (diff === 0) continue;
    const memo = `FX revaluation ${r.ccy} ${round2(r.fc)} @ ${rate}`;
    const fxLine = { currencyCode: r.ccy, foreignAmount: 0, exchangeRate: rate, memo };
    if (diff > 0) lines.push({ accountCode: r.account_code, debit: diff, credit: 0, ...fxLine }, { accountCode: gain, debit: 0, credit: diff, memo, currencyCode: base });
    else lines.push({ accountCode: loss, debit: -diff, credit: 0, memo, currencyCode: base }, { accountCode: r.account_code, debit: 0, credit: -diff, ...fxLine });
  }
  const warning = missing.size ? `No month-end rate in the Exchange Rate master for ${[...missing].join(', ')} on ${end}` : null;
  if (!lines.length) return { status: missing.size ? 'warning' : 'done', message: warning || 'Balances already at the month-end rate', amount: 0, journals: [], detail };
  const jv = await createJournal(db, { date: end, description: `Unrealised FX revaluation ${p.period}`, source: 'period-close', entryType: 'FX_REVALUATION',
    referenceType: 'PeriodClose', referenceId: runId, status: 'posted', lines }, user);
  await record(db, { runId, period: p.period, step: 'fx', jv, reverseOn: addDays(end, 1) });
  const net = round2(detail.reduce((s, d) => s + d.difference, 0));
  return { status: missing.size ? 'warning' : 'done', message: [`Net unrealised ${net >= 0 ? 'gain' : 'loss'} ${Math.abs(net)}`, warning].filter(Boolean).join('; '), amount: net, journals: [jv.id], detail };
}
