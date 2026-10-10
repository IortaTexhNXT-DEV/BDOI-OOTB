/**
 * Insurer billing run (FRS FR-RMT-020, 021): the commission billing statements of the remitted policies.
 *
 * The run day is a day of insurer_billing.run_days (15 and 26); when it falls on a Saturday, a Sunday or a day of the
 * Holiday master the run takes place on the working day before (insurer_billing.non_working_day = previous) or after
 * (next). A run takes the remittance lines of the remittances approved before the billing date and not yet billed and
 * drafts one statement per insurer, product line and settlement basis (billing_statement series):
 *  - net basis (the commission was kept out of the remittance): the lines of the remittances, commission with its VAT
 *    and the EWT the insurer withholds; approved, the statement is settled by retention;
 *  - gross basis (the whole premium was remitted): the unbilled gross-remittance commission of the remitted policies,
 *    approved with commission.billing_statement and collected from the insurer.
 * Gross Amount = commission + VAT, Net Amount Payable = Gross Amount - EWT, due insurer_billing.due_days after the
 * billing date; a line is billed once, until its statement is rejected or cancelled. Each run is kept in
 * insurer_billing_runs (MSG-RMT-014 / MSG-RMT-015).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, businessTimeZone, isoDate, today as businessToday } from '../../lib/dates.js';
import { formatDate } from '../../lib/pdf/format.js';
import { printFormat } from '../../lib/pdf/index.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { baseCurrency } from '../../lib/currency.js';
import { round2 } from '../masters/helpers.js';
import { commissionTax, ewtRate } from './directbill.js';
import { lineOf } from './eligibility.js';
import { holidays, toWorkingDay } from '../../lib/workingDays.js';

const REMITTED = ['approved', 'settled'];
/** The billing dates of the month of `date`: each run day moved off non-working days. */
export async function billingDates(date) {
  const days = ((await getSetting('insurer_billing.run_days', [15, 26])) || []).map(Number).filter((d) => d >= 1 && d <= 31);
  const step = (await getSetting('insurer_billing.non_working_day', 'previous')) === 'next' ? 1 : -1;
  const month = date.slice(0, 7);
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const off = await holidays(addDays(`${month}-01`, -7), addDays(`${month}-${String(last).padStart(2, '0')}`, 7));
  return days.map((d) => toWorkingDay(`${month}-${String(Math.min(d, last)).padStart(2, '0')}`, step, off));
}

/** Whether `date` is a billing date (the job runs only then). */
export const isBillingDate = async (date) => (await billingDates(date)).includes(date);

/** The net-basis remittance lines approved before `billingDate` and not yet billed (of one insurer when given). */
async function netLines(billingDate, insurerId) {
  return many(`SELECT rl.*, r.remittance_number, COALESCE(rl.insurance_company_id, r.insurance_company_id) AS insurer_id, p.inception_date, pr.line AS product_line,
      COALESCE(p.insured_name, c.display_name) AS client_name
    FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id LEFT JOIN policies p ON p.id = rl.policy_id LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE r.kind = 'direct-bill' AND r.status = ANY($1) AND r.approved_at IS NOT NULL AND (r.approved_at AT TIME ZONE $4::text)::date < $2::date
      AND rl.billing_note_id IS NULL AND rl.commission > 0 AND ($3::int IS NULL OR COALESCE(rl.insurance_company_id, r.insurance_company_id) = $3)
    ORDER BY rl.id`, [REMITTED, billingDate, insurerId || null, await businessTimeZone()]);
}

/** The unbilled gross-remittance commission of the policies on a remittance approved before `billingDate`. */
async function grossItems(billingDate, insurerId) {
  return many(`SELECT it.*, it.insurance_company_id AS insurer_id, p.policy_number, p.inception_date, pr.line AS product_line, COALESCE(p.insured_name, c.display_name) AS client_name,
      (SELECT r.remittance_number FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id WHERE rl.policy_id = it.policy_id AND r.status = ANY($1)
        ORDER BY r.approved_at DESC LIMIT 1) AS remittance_number
    FROM direct_bill_items it JOIN policies p ON p.id = it.policy_id LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN clients c ON c.id = p.client_id
    WHERE it.basis = 'gross' AND it.status = 'unbilled' AND it.debit_note_id IS NULL AND ($3::int IS NULL OR it.insurance_company_id = $3)
      AND EXISTS (SELECT 1 FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id WHERE rl.policy_id = it.policy_id AND r.status = ANY($1)
        AND r.approved_at IS NOT NULL AND (r.approved_at AT TIME ZONE $4::text)::date < $2::date)
    ORDER BY it.booked_on, p.policy_number`, [REMITTED, billingDate, insurerId || null, await businessTimeZone()]);
}

/** Draft one statement in transaction `db` from its lines (each { commission, vat, ewt, ... }); returns its id. */
async function insertStatement(db, { insurerId, basis, productLine, billingDate, lines, runId, user }) {
  const sum = (k) => round2(lines.reduce((s, x) => s + Number(x[k] || 0), 0));
  const commission = sum('commission');
  const vat = sum('vat');
  const amount = round2(commission + vat);
  const ewt = sum('ewt');
  const dates = lines.map((l) => isoDate(l.inception_date)).filter(Boolean).sort();
  const number = await nextDocumentNumber('billing_statement', { db });
  const due = addDays(billingDate, Number(await getSetting('insurer_billing.due_days', 15)) || 0);
  const d = (await db.query(`INSERT INTO commission_debit_notes(dn_number, insurance_company_id, period_from, period_to, dn_date, due_date, currency, gross_premium, commission, vat, amount,
      ewt_rate, expected_ewt, balance, status, remarks, created_by, updated_by, basis, product_line, billing_run_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$11,'draft',$14,$15,$15,$16,$17,$18) RETURNING id`,
  [number, insurerId, dates[0] || null, dates.at(-1) || null, billingDate, due, await baseCurrency(), sum('gross_premium'), commission, vat, amount,
    commission ? round2(ewt / commission) : 0, ewt, `${lines.length} booked account/s`, user?.id || null, basis, productLine, runId])).rows[0];
  let n = 0;
  for (const l of lines) {
    n += 1;
    await db.query(`INSERT INTO commission_debit_note_lines(debit_note_id, item_id, remittance_line_id, remittance_number, line_no, policy_id, policy_number, reference, insured_name, product,
        line_of_business, inception_date, gross_premium, commission_rate, commission, vat, amount, ewt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [d.id, l.item_id || null, l.remittance_line_id || null, l.remittance_number || null, n, l.policy_id, l.policy_number, l.remittance_number || null, l.client_name,
      productLine, String(productLine || '').toUpperCase(), isoDate(l.inception_date), l.gross_premium, l.gross_premium ? round2(l.commission / l.gross_premium) : null,
      l.commission, l.vat, round2(l.commission + l.vat), l.ewt]);
  }
  const lineIds = lines.map((l) => l.remittance_line_id).filter(Boolean);
  if (lineIds.length) await db.query('UPDATE remittance_lines SET billing_note_id = $2 WHERE id = ANY($1)', [lineIds, d.id]);
  const itemIds = lines.map((l) => l.item_id).filter(Boolean);
  if (itemIds.length) await db.query('UPDATE direct_bill_items SET debit_note_id = $2, status = \'billed\' WHERE id = ANY($1)', [itemIds, d.id]);
  return d.id;
}

/**
 * Run the billing for `billingDate` (default today), for every insurer or one: drafts the statements and records the
 * run. Returns { run, notes: [{ id, number, insurer, productLine, basis, amount }], message }.
 */
export async function runBilling({ billingDate = null, insurerId = null, trigger = 'user', user = null } = {}) {
  const day = isoDate(billingDate) || (await businessToday());
  if (day > (await businessToday())) throw badRequest('Validation failed', [{ path: 'billingDate', message: 'The billing date cannot be in the future' }]);
  const ins = insurerId ? await one('SELECT id, name FROM insurance_companies WHERE id::text = $1 OR lower(code) = lower($1)', [String(insurerId)]) : null;
  if (insurerId && !ins) throw badRequest('Validation failed', [{ path: 'insurerId', message: `Insurer ${insurerId} was not found` }]);
  const run = await one('INSERT INTO insurer_billing_runs(billing_date, trigger, user_id, insurance_company_id) VALUES ($1,$2,$3,$4) RETURNING id',
    [day, trigger, trigger === 'user' ? user?.id || null : null, ins?.id || null]);
  try {
    const rate = await ewtRate();
    const groups = new Map();
    const put = (insurer, basis, l) => {
      const key = `${insurer}|${basis}|${lineOf(l)}`;
      groups.set(key, { insurerId: insurer, basis, productLine: lineOf(l), lines: [...(groups.get(key)?.lines || []), l] });
    };
    for (const l of await netLines(day, ins?.id)) {
      const tax = await commissionTax(Number(l.commission));
      put(l.insurer_id, 'net', { ...l, remittance_line_id: l.id, gross_premium: Number(l.premium), commission: tax.commission, vat: tax.vat, ewt: round2(tax.commission * rate) });
    }
    for (const it of await grossItems(day, ins?.id)) {
      put(it.insurer_id, 'gross', { ...it, item_id: it.id, gross_premium: Number(it.gross_premium), commission: Number(it.commission), vat: Number(it.vat),
        ewt: round2(Number(it.commission) * rate) });
    }
    const created = [];
    for (const g of groups.values()) {
      const id = await withTransaction((db) => insertStatement(db, { ...g, billingDate: day, runId: run.id, user }));
      created.push(await one(`SELECT d.id, d.dn_number, d.basis, d.product_line, d.amount, i.name AS insurer FROM commission_debit_notes d JOIN insurance_companies i ON i.id = d.insurance_company_id
        WHERE d.id = $1`, [id]));
    }
    const fmt = await printFormat();
    const message = created.length ? `Billing run done: ${created.length} billing statement(s) drafted.`
      : `Nothing to bill for ${ins?.name || 'any insurer'} up to ${formatDate(addDays(day, -1), fmt)}.`;
    await query(`UPDATE insurer_billing_runs SET result = $2, statements = $3, note_ids = $4, message = $5, finished_at = now() WHERE id = $1`,
      [run.id, created.length ? 'success' : 'nothing', created.length, JSON.stringify(created.map((n) => n.id)), message]);
    return { run: { id: Number(run.id), billingDate: day, statements: created.length }, message,
      notes: created.map((n) => ({ id: n.id, number: n.dn_number, insurer: n.insurer, productLine: n.product_line, basis: n.basis, amount: round2(n.amount) })) };
  } catch (e) {
    await query("UPDATE insurer_billing_runs SET result = 'failed', message = $2, finished_at = now() WHERE id = $1", [run.id, e.message]);
    throw e;
  }
}

/** Scheduled job "Insurer billing run": runs on a billing date only, once a day. */
export async function billingJob({ asOf = null } = {}) {
  const day = asOf || (await businessToday());
  if (!(await isBillingDate(day))) return { skipped: `Not a billing date (${(await billingDates(day)).join(', ')})` };
  const done = await one("SELECT id FROM insurer_billing_runs WHERE billing_date = $1 AND trigger = 'job' AND result <> 'failed'", [day]);
  if (done) return { skipped: `Billing run of ${day} already done` };
  const r = await runBilling({ billingDate: day, trigger: 'job' });
  return { billingDate: day, statements: r.notes.length, message: r.message };
}

/** The last billing runs, newest first, and the next billing dates. */
export async function billingRuns() {
  const today = await businessToday();
  const rows = await many(`SELECT x.*, (SELECT display_name FROM users u WHERE u.id = x.user_id) AS user_name, ic.name AS insurer_name FROM insurer_billing_runs x
    LEFT JOIN insurance_companies ic ON ic.id = x.insurance_company_id ORDER BY x.started_at DESC LIMIT 50`);
  const thisMonth = await billingDates(today);
  const nextMonth = await billingDates(addDays(`${today.slice(0, 7)}-01`, 40));
  return {
    nextBillingDates: [...thisMonth, ...nextMonth].filter((d) => d >= today).slice(0, 2),
    runs: rows.map((r) => ({ id: Number(r.id), billingDate: isoDate(r.billing_date), trigger: r.trigger, user: r.user_name || null, insurer: r.insurer_name || null,
      statements: r.statements, result: r.result, message: r.message, startedAt: r.started_at })),
  };
}
