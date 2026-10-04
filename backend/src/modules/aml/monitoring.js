/**
 * Covered and suspicious transaction monitoring.
 *
 * A run (daily job aml-transaction-monitoring, or Run monitoring on Compliance > Transaction Alerts) applies the enabled
 * rules (aml_rules) to the receipts, refunds, cancellations and claim payments of a date range and records an alert per
 * rule and transaction. Alerts are unique per rule and reference, so running the same days again adds nothing twice; an
 * open covered transaction alert of a banking day is updated when more cash of the client arrives that day.
 *
 * Rules (parameters on Compliance > AML Settings):
 *   CT_CASH                 cash (aml.covered_payment_modes) above aml.covered_threshold within one banking day per
 *                           client (aml.covered_aggregation banking-day) or in one receipt (single)
 *   STR_STRUCTURING         at least minCount cash receipts of a client within days days, each at or below the threshold,
 *                           adding up to minTotal or more
 *   STR_EARLY_CANCEL        cancellation endorsement effective within days days of inception with a return premium;
 *                           high when a refund of the policy went to another payee than the client
 *   STR_THIRD_PARTY_PAYOUT  customer refund voucher or claim payment to a payee whose name scores below minScore against
 *                           the client's name
 *   STR_OVERPAYMENT_REFUND  customer refund voucher where the premium received on the policy (or from the client) exceeds
 *                           the premium billed by minExcess or more, received within days days before the refund
 *   STR_PAYER_DIFFERS       receipt or paid payment link whose payer name scores below minScore against the client's name
 */
import { query } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { addDays, today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { notify } from '../notifications/service.js';
import { nameScore } from './matching.js';
import { amlSetting, isoDay, num, round2 } from './common.js';

export const ruleRow = (r) => ({ code: r.code, name: r.name, kind: r.kind, description: r.description, params: r.params || {}, severity: r.severity, enabled: r.enabled, updatedAt: r.updated_at });

export async function listRules() {
  return (await query("SELECT * FROM aml_rules ORDER BY kind, code")).rows.map(ruleRow);
}

export async function updateRule(code, b, userId) {
  const before = (await query('SELECT * FROM aml_rules WHERE code = $1', [code])).rows[0];
  if (!before) throw notFound('Rule not found');
  const params = b.params ? { ...before.params, ...b.params } : before.params;
  for (const [k, v] of Object.entries(params)) if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw badRequest(`Parameter ${k} must be a number of zero or more`);
  const r = await query('UPDATE aml_rules SET enabled = COALESCE($2, enabled), severity = COALESCE($3, severity), params = $4, updated_by = $5, updated_at = now() WHERE code = $1 RETURNING *',
    [code, b.enabled ?? null, b.severity ?? null, JSON.stringify(params), userId]);
  return { before: ruleRow(before), after: ruleRow(r.rows[0]) };
}

const CANCELLED_RECEIPT = "lower(COALESCE(r.receipt_status, '')) NOT IN ('cancelled', 'void', 'rejected') AND lower(COALESCE(r.status, '')) NOT IN ('cancelled', 'void')";

/** Record an alert unless one exists for the rule and reference; returns true when added. `refresh` updates an open alert. */
async function raise(rule, a, refresh = false) {
  const existing = (await query('SELECT id, status FROM aml_alerts WHERE rule_code = $1 AND reference_type = $2 AND reference_id = $3', [rule.code, a.referenceType, String(a.referenceId)])).rows[0];
  if (existing) {
    if (refresh && existing.status === 'open') {
      await query('UPDATE aml_alerts SET amount = $2, summary = $3, details = $4 WHERE id = $1', [existing.id, round2(a.amount), a.summary, JSON.stringify(a.details || {})]);
    }
    return false;
  }
  const number = await nextDocumentNumber('aml_alert', { unique: { table: 'aml_alerts', column: 'alert_number' } });
  await query(`INSERT INTO aml_alerts(alert_number, rule_code, kind, severity, client_id, reference_type, reference_id, reference_number, transaction_date, amount, summary, details)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (rule_code, reference_type, reference_id) DO NOTHING`,
  [number, rule.code, rule.kind, a.severity || rule.severity, a.clientId || null, a.referenceType, String(a.referenceId), a.referenceNumber || null, a.date, round2(a.amount),
    a.summary, JSON.stringify(a.details || {})]);
  return true;
}

const money = (v) => `PHP ${num(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function coveredCash(rule, from, to) {
  const threshold = num(await amlSetting('aml.covered_threshold'));
  const modes = ((await amlSetting('aml.covered_payment_modes')) || ['cash']).map((m) => String(m).toLowerCase());
  const single = (await amlSetting('aml.covered_aggregation')) === 'single';
  const rows = (await query(`SELECT r.client_id, r.received_date, c.display_name, c.client_code, sum(r.amount) AS total, count(*) AS n,
      array_agg(r.id ORDER BY r.id) AS ids, array_agg(COALESCE(r.receipt_number, r.id) ORDER BY r.id) AS numbers, max(r.amount) AS largest
    FROM receipts r JOIN clients c ON c.id = r.client_id
    WHERE lower(r.payment_mode) = ANY($1::text[]) AND r.received_date BETWEEN $2 AND $3 AND ${CANCELLED_RECEIPT}
    GROUP BY r.client_id, r.received_date, c.display_name, c.client_code`, [modes, from, to])).rows;
  let added = 0;
  for (const g of rows) {
    if (single) {
      const each = (await query(`SELECT r.id, r.receipt_number, r.amount FROM receipts r WHERE r.id = ANY($1::text[]) AND r.amount > $2`, [g.ids, threshold])).rows;
      for (const r of each) {
        if (await raise(rule, { clientId: g.client_id, referenceType: 'receipt', referenceId: r.id, referenceNumber: r.receipt_number, date: isoDay(g.received_date), amount: r.amount,
          summary: `Cash receipt ${r.receipt_number || r.id} of ${money(r.amount)} from ${g.display_name} is above the covered threshold of ${money(threshold)}`,
          details: { receipts: [r.id], receiptNumbers: [r.receipt_number], threshold, aggregation: 'single' } })) added += 1;
      }
    } else if (num(g.total) > threshold) {
      const day = isoDay(g.received_date);
      if (await raise(rule, { clientId: g.client_id, referenceType: 'client-day', referenceId: `${g.client_id}:${day}`, referenceNumber: g.numbers.join(', '), date: day, amount: g.total,
        summary: `${g.n} cash receipt(s) of ${g.display_name} on ${day} add up to ${money(g.total)}, above the covered threshold of ${money(threshold)}`,
        details: { receipts: g.ids, receiptNumbers: g.numbers, threshold, aggregation: 'banking-day' } }, true)) added += 1;
    }
  }
  return added;
}

async function structuring(rule, from, to) {
  const p = { days: 7, minCount: 3, minTotal: 400000, ...rule.params };
  const threshold = num(await amlSetting('aml.covered_threshold'));
  const modes = ((await amlSetting('aml.covered_payment_modes')) || ['cash']).map((m) => String(m).toLowerCase());
  const rows = (await query(`SELECT r.id, r.receipt_number, r.client_id, r.received_date, r.amount, c.display_name FROM receipts r JOIN clients c ON c.id = r.client_id
    WHERE lower(r.payment_mode) = ANY($1::text[]) AND r.received_date BETWEEN $2::date - $4::int AND $3 AND r.amount <= $5 AND ${CANCELLED_RECEIPT}
    ORDER BY r.client_id, r.received_date, r.id`, [modes, from, to, Number(p.days), threshold])).rows;
  const byClient = new Map();
  for (const r of rows) { if (!byClient.has(r.client_id)) byClient.set(r.client_id, []); byClient.get(r.client_id).push(r); }
  let added = 0;
  for (const [clientId, list] of byClient) {
    for (const last of list.filter((r) => isoDay(r.received_date) >= from)) {
      const end = isoDay(last.received_date);
      const start = addDays(end, -(Number(p.days) - 1));
      const win = list.filter((r) => isoDay(r.received_date) >= start && isoDay(r.received_date) <= end);
      const total = win.reduce((s, r) => s + num(r.amount), 0);
      if (win.length < Number(p.minCount) || total < Number(p.minTotal)) continue;
      // one alert per client while an earlier one of the same window is still open
      const recent = (await query(`SELECT 1 FROM aml_alerts WHERE rule_code = $1 AND client_id = $2 AND status IN ('open', 'escalated') AND transaction_date >= $3::date`,
        [rule.code, clientId, start])).rows[0];
      if (recent) continue;
      if (await raise(rule, { clientId, referenceType: 'client-window', referenceId: `${clientId}:${end}`, referenceNumber: win.map((r) => r.receipt_number || r.id).join(', '), date: end,
        amount: total, summary: `${win.length} cash payments of ${last.display_name} below the covered threshold within ${p.days} days add up to ${money(total)}`,
        details: { receipts: win.map((r) => r.id), from: start, to: end, params: p } })) added += 1;
    }
  }
  return added;
}

async function clientRefunds(from, to) {
  return (await query(`SELECT d.id, d.voucher_number, d.voucher_date, d.payee_name, d.amount, d.policy_id, d.policy_number, c.id AS client_id, c.display_name, c.client_code
    FROM disbursements d JOIN clients c ON c.id = COALESCE(d.client_id, (SELECT x.id FROM clients x WHERE x.client_code = d.customer_code LIMIT 1))
    WHERE d.payee_type IN ('Customer', 'Client') AND d.voucher_date BETWEEN $1 AND $2 AND lower(d.status) NOT IN ('cancelled', 'draft', 'rejected')`, [from, to])).rows;
}

async function earlyCancel(rule, from, to) {
  const p = { days: 90, ...rule.params };
  const minScore = num((await query("SELECT params FROM aml_rules WHERE code = 'STR_THIRD_PARTY_PAYOUT'")).rows[0]?.params?.minScore) || 0.85;
  const rows = (await query(`SELECT e.id, e.endorsement_number, e.premium_delta, COALESCE(e.effective_date, e.completed_at::date, e.created_at::date) AS eff, p.id AS policy_id,
      p.policy_number, p.inception_date, c.id AS client_id, c.display_name
    FROM endorsements e JOIN policies p ON p.id = e.policy_id LEFT JOIN clients c ON c.id = COALESCE(e.client_id, p.client_id)
    WHERE e.is_cancel AND lower(e.status) IN ('completed', 'cancelled') AND COALESCE(e.effective_date, e.completed_at::date, e.created_at::date) BETWEEN $1 AND $2
      AND e.premium_delta < 0 AND COALESCE(e.effective_date, e.completed_at::date, e.created_at::date) - p.inception_date <= $3`, [from, to, Number(p.days)])).rows;
  let added = 0;
  for (const r of rows) {
    const refunds = (await query(`SELECT voucher_number, payee_name, amount FROM disbursements WHERE policy_id = $1 AND payee_type IN ('Customer', 'Client') AND lower(status) <> 'cancelled'`, [r.policy_id])).rows;
    const thirdParty = refunds.filter((d) => r.display_name && nameScore(d.payee_name, r.display_name) < minScore);
    const days = Math.round((Date.parse(isoDay(r.eff)) - Date.parse(isoDay(r.inception_date))) / 86400000);
    if (await raise(rule, { clientId: r.client_id, referenceType: 'endorsement', referenceId: r.id, referenceNumber: r.endorsement_number || r.policy_number, date: isoDay(r.eff),
      amount: Math.abs(num(r.premium_delta)), severity: thirdParty.length ? 'high' : rule.severity,
      summary: `Policy ${r.policy_number} cancelled ${days} day(s) after inception with a return premium of ${money(Math.abs(num(r.premium_delta)))}${thirdParty.length ? `; refund paid to ${thirdParty.map((d) => d.payee_name).join(', ')}` : ''}`,
      details: { policyId: r.policy_id, policyNumber: r.policy_number, daysAfterInception: days, refunds, thirdPartyRefund: thirdParty.length > 0 } })) added += 1;
  }
  return added;
}

async function thirdPartyPayout(rule, from, to) {
  const minScore = num(rule.params?.minScore) || 0.85;
  let added = 0;
  for (const d of await clientRefunds(from, to)) {
    const score = nameScore(d.payee_name, d.display_name);
    if (!d.payee_name || score >= minScore) continue;
    if (await raise(rule, { clientId: d.client_id, referenceType: 'disbursement', referenceId: d.id, referenceNumber: d.voucher_number, date: isoDay(d.voucher_date), amount: d.amount,
      summary: `Refund voucher ${d.voucher_number} of ${money(d.amount)} paid to ${d.payee_name}, not the client ${d.display_name}`,
      details: { payee: d.payee_name, client: d.display_name, score, policyNumber: d.policy_number } })) added += 1;
  }
  const claims = (await query(`SELECT m.id, m.amount, m.movement_date, m.payee, m.reference, cl.claim_number, c.id AS client_id, c.display_name
    FROM claim_settlement_movements m JOIN claims cl ON cl.id = m.claim_id JOIN policies p ON p.id = cl.policy_id JOIN clients c ON c.id = COALESCE(cl.client_id, p.client_id)
    WHERE m.kind = 'paid-to-claimant' AND m.movement_date BETWEEN $1 AND $2`, [from, to])).rows;
  for (const m of claims) {
    const score = nameScore(m.payee, m.display_name);
    if (!m.payee || score >= minScore) continue;
    if (await raise(rule, { clientId: m.client_id, referenceType: 'claim-payment', referenceId: m.id, referenceNumber: m.reference || m.claim_number, date: isoDay(m.movement_date),
      amount: m.amount, summary: `Claim ${m.claim_number}: ${money(m.amount)} paid to ${m.payee}, not the insured ${m.display_name}`,
      details: { payee: m.payee, client: m.display_name, score, claimNumber: m.claim_number } })) added += 1;
  }
  return added;
}

async function overpaymentRefund(rule, from, to) {
  const p = { days: 60, minExcess: 5000, ...rule.params };
  let added = 0;
  for (const d of await clientRefunds(from, to)) {
    const start = addDays(isoDay(d.voucher_date), -Number(p.days));
    const scope = d.policy_id ? ['r.policy_id = $1', 'policy_id = $1', d.policy_id] : ['r.client_id = $1', 'client_id = $1', d.client_id];
    const recent = num((await query(`SELECT COALESCE(sum(r.amount), 0) AS s FROM receipts r WHERE ${scope[0]} AND r.received_date BETWEEN $2 AND $3 AND ${CANCELLED_RECEIPT}`,
      [scope[2], start, isoDay(d.voucher_date)])).rows[0].s);
    if (!recent) continue;
    const received = num((await query(`SELECT COALESCE(sum(r.amount), 0) AS s FROM receipts r WHERE ${scope[0]} AND ${CANCELLED_RECEIPT}`, [scope[2]])).rows[0].s);
    const billed = num((await query(`SELECT COALESCE(sum(amount), 0) AS s FROM receivables WHERE ${scope[1]} AND lower(COALESCE(status, '')) NOT IN ('cancelled', 'void')`, [scope[2]])).rows[0].s);
    const excess = round2(received - billed);
    if (excess < Number(p.minExcess)) continue;
    if (await raise(rule, { clientId: d.client_id, referenceType: 'disbursement', referenceId: d.id, referenceNumber: d.voucher_number, date: isoDay(d.voucher_date), amount: d.amount,
      summary: `${d.display_name} paid ${money(received)} against ${money(billed)} billed${d.policy_number ? ` on ${d.policy_number}` : ''} and was refunded ${money(d.amount)} (voucher ${d.voucher_number})`,
      details: { received, billed, excess, refund: num(d.amount), policyNumber: d.policy_number } })) added += 1;
  }
  return added;
}

async function payerDiffers(rule, from, to) {
  const minScore = num(rule.params?.minScore) || 0.85;
  let added = 0;
  const receipts = (await query(`SELECT r.id, r.receipt_number, r.received_date, r.amount, r.customer_name, c.id AS client_id, c.display_name FROM receipts r JOIN clients c ON c.id = r.client_id
    WHERE r.received_date BETWEEN $1 AND $2 AND r.customer_name IS NOT NULL AND btrim(r.customer_name) <> '' AND ${CANCELLED_RECEIPT}`, [from, to])).rows;
  for (const r of receipts) {
    const score = nameScore(r.customer_name, r.display_name);
    if (score >= minScore) continue;
    if (await raise(rule, { clientId: r.client_id, referenceType: 'receipt', referenceId: r.id, referenceNumber: r.receipt_number, date: isoDay(r.received_date), amount: r.amount,
      summary: `Receipt ${r.receipt_number || r.id} of ${money(r.amount)} paid by ${r.customer_name} for the client ${r.display_name}`, details: { payer: r.customer_name, client: r.display_name, score } })) added += 1;
  }
  const links = (await query(`SELECT l.id, l.link_number, l.paid_at, COALESCE(l.paid_amount, l.total) AS amount, l.payer_name, c.id AS client_id, c.display_name
    FROM payment_links l JOIN clients c ON c.id = l.client_id WHERE l.status = 'paid' AND l.paid_at::date BETWEEN $1 AND $2 AND COALESCE(btrim(l.payer_name), '') <> ''`, [from, to])).rows;
  for (const l of links) {
    const score = nameScore(l.payer_name, l.display_name);
    if (score >= minScore) continue;
    if (await raise(rule, { clientId: l.client_id, referenceType: 'payment-link', referenceId: l.id, referenceNumber: l.link_number, date: isoDay(l.paid_at), amount: l.amount,
      summary: `Payment link ${l.link_number} of ${money(l.amount)} paid by ${l.payer_name} for the client ${l.display_name}`, details: { payer: l.payer_name, client: l.display_name, score } })) added += 1;
  }
  return added;
}

const RUNNERS = { CT_CASH: coveredCash, STR_STRUCTURING: structuring, STR_EARLY_CANCEL: earlyCancel, STR_THIRD_PARTY_PAYOUT: thirdPartyPayout,
  STR_OVERPAYMENT_REFUND: overpaymentRefund, STR_PAYER_DIFFERS: payerDiffers };
export const RULE_CODES = Object.keys(RUNNERS);

/** Run the enabled rules over [from, to] (default: the last `days` days to today). Returns { from, to, added: { rule: n }, total }. */
export async function runMonitoring({ from = null, to = null, days = 3, notifyOfficer = true } = {}) {
  const end = isoDay(to) || await today();
  const start = isoDay(from) || addDays(end, -(Number(days) - 1));
  if (start > end) throw badRequest('from must be on or before to');
  const added = {};
  for (const rule of (await query('SELECT * FROM aml_rules WHERE enabled ORDER BY code')).rows) {
    const run = RUNNERS[rule.code];
    if (run) added[rule.code] = await run({ ...rule, params: rule.params || {} }, start, end);
  }
  const total = Object.values(added).reduce((s, n) => s + n, 0);
  if (notifyOfficer && total) {
    await notify({ type: 'reminder', priority: 'high', title: `${total} new AML transaction alert(s)`, message: `Monitoring of ${start} to ${end}: ${Object.entries(added).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ')}`,
      link: '/compliance/aml/alerts', entity: 'aml_alert', audience: 'read:aml' });
  }
  return { from: start, to: end, added, total };
}

// ---------------------------------------------------------------- alerts

export const alertRow = (a) => ({
  id: a.id, alertNumber: a.alert_number, ruleCode: a.rule_code, ruleName: a.rule_name, kind: a.kind, severity: a.severity, clientId: a.client_id, clientCode: a.client_code,
  clientName: a.client_name, referenceType: a.reference_type, referenceId: a.reference_id, referenceNumber: a.reference_number, transactionDate: isoDay(a.transaction_date),
  amount: Number(a.amount), currency: a.currency, summary: a.summary, details: a.details || {}, status: a.status, caseId: a.case_id, caseNumber: a.case_number || null,
  decisionReason: a.decision_reason, decidedBy: a.decided_by_name || a.decided_by, decidedAt: a.decided_at, createdAt: a.created_at,
});

export const ALERT_SELECT = `SELECT a.*, r.name AS rule_name, c.client_code, c.display_name AS client_name, ac.case_number, u.display_name AS decided_by_name
  FROM aml_alerts a JOIN aml_rules r ON r.code = a.rule_code LEFT JOIN clients c ON c.id = a.client_id LEFT JOIN aml_cases ac ON ac.id = a.case_id LEFT JOIN users u ON u.id = a.decided_by`;

export async function listAlerts(q = {}) {
  const params = [];
  const where = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('a.status = ANY(?)', String(q.status).split(','));
  if (q.kind) add('a.kind = ?', q.kind);
  if (q.ruleCode) add('a.rule_code = ?', q.ruleCode);
  if (q.clientId) add('a.client_id = ?', q.clientId);
  if (q.caseId) add('a.case_id = ?', q.caseId);
  if (q.from) add('a.transaction_date >= ?::date', q.from);
  if (q.to) add('a.transaction_date <= ?::date', q.to);
  if (q.search) add("(a.alert_number ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%' OR a.reference_number ILIKE '%' || ? || '%')", q.search);
  return (await query(`${ALERT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY (a.status = 'open') DESC, a.transaction_date DESC, a.alert_number DESC LIMIT 500`, params)).rows.map(alertRow);
}

export async function getAlert(id) {
  const a = (await query(`${ALERT_SELECT} WHERE a.id = $1 OR a.alert_number = $1`, [id])).rows[0];
  if (!a) throw notFound('Alert not found');
  return alertRow(a);
}

/** Close an alert after review (no report): the reason is kept. */
export async function closeAlert(id, reason, userId) {
  const a = await getAlert(id);
  if (a.status !== 'open') throw conflict(`Alert ${a.alertNumber} is ${a.status}`);
  if (a.kind === 'covered') throw conflict('A covered transaction is reported to the AMLC, not closed: include it in a CTR file (Compliance > AMLC Reports)');
  if (!reason || String(reason).trim().length < 5) throw badRequest('Give the reason for closing the alert (at least 5 characters)');
  await query("UPDATE aml_alerts SET status = 'closed', decision_reason = $2, decided_by = $3, decided_at = now() WHERE id = $1", [a.id, String(reason).trim(), userId]);
  return { before: a, after: await getAlert(a.id) };
}
