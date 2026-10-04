/**
 * AMLC report files: covered transaction reports (CTR) and suspicious transaction reports (STR).
 *
 * Format BV-AMLC-TXN 1.0 (FORMAT_VERSION): a pipe-delimited text file (UTF-8, CRLF) laid out after the transaction
 * report fields of the AMLC Registration and Reporting Guidelines (subject, transaction, counterparty, reason and
 * narrative), one file per report:
 *   H|institution code|report type (CTR or STR)|report number|date generated|period from|period to|transactions|format version
 *   D|sequence|transaction date|transaction reference|AMLC transaction code|amount|currency|payment mode|subject type (I individual, C juridical)
 *    |last name|first name|middle name|registered name|birth date or registration date|place of birth|nationality or country of incorporation
 *    |ID type or registration authority|ID number or registration number|TIN|address|occupation or nature of business|policy number
 *    |counterparty name|reason codes (STR)|alert number
 *   N|narrative line (STR only, one record per line of the narrative)
 *   T|transactions|total amount
 * Pipes and line breaks inside values are replaced by spaces. The fields marked "confirm" in the user manual (institution
 * code, transaction codes, ID type codes, the order of the D fields) must be checked by the broker against the AMLC's
 * current reporting guidelines and the file validated in the AMLC portal before the first filing; the codes come from
 * aml.amlc_institution_code and aml.amlc_transaction_codes, so a change needs no new release.
 */
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { amlSetting, isoDay, num, round2 } from './common.js';
import { getCase } from './cases.js';

export const FORMAT_VERSION = 'BV-AMLC-TXN 1.0';

const clean = (v) => String(v ?? '').replace(/[|\r\n]+/g, ' ').trim();
const line = (fields) => fields.map(clean).join('|');
const addressOf = (c) => [c.house_no, c.road, c.barangay, c.city, c.state, c.postal_code, c.country].filter(Boolean).join(', ');

export const reportRow = (r) => ({
  id: r.id, reportNumber: r.report_number, reportType: r.report_type, caseId: r.case_id, caseNumber: r.case_number || null, periodFrom: isoDay(r.period_from),
  periodTo: isoDay(r.period_to), formatVersion: r.format_version, fileName: r.file_name, transactions: r.transactions, totalAmount: Number(r.total_amount), status: r.status,
  generatedBy: r.generated_by_name || r.generated_by, generatedAt: r.generated_at, submittedOn: isoDay(r.submitted_on), submittedBy: r.submitted_by_name || r.submitted_by,
  amlcReference: r.amlc_reference, amlcNotes: r.amlc_notes,
});

const REPORT_SELECT = `SELECT r.*, ac.case_number, gu.display_name AS generated_by_name, su.display_name AS submitted_by_name FROM aml_reports r
  LEFT JOIN aml_cases ac ON ac.id = r.case_id LEFT JOIN users gu ON gu.id = r.generated_by LEFT JOIN users su ON su.id = r.submitted_by`;

export async function listReports(q = {}) {
  const params = [];
  const where = [];
  if (q.reportType) { params.push(q.reportType); where.push(`r.report_type = $${params.length}`); }
  if (q.status) { params.push(String(q.status).split(',')); where.push(`r.status = ANY($${params.length})`); }
  return (await query(`${REPORT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.generated_at DESC LIMIT 500`, params)).rows.map(reportRow);
}

export async function getReport(id, { withContent = false } = {}) {
  const r = (await query(`${REPORT_SELECT} WHERE r.id = $1 OR r.report_number = $1`, [id])).rows[0];
  if (!r) throw notFound('Report not found');
  return withContent ? { ...reportRow(r), content: r.content } : reportRow(r);
}

/** Transactions behind an alert, as report detail lines: receipts, vouchers, claim payments, endorsements, links. */
async function transactionsOf(alert) {
  const d = alert.details || {};
  const codes = (await amlSetting('aml.amlc_transaction_codes')) || {};
  const out = [];
  if (Array.isArray(d.receipts) && d.receipts.length) {
    for (const r of (await query('SELECT id, receipt_number, received_date, amount, currency_code, payment_mode, policy_number, customer_name FROM receipts WHERE id = ANY($1::text[]) ORDER BY received_date, created_at, id', [d.receipts])).rows) {
      const cash = String(r.payment_mode).toLowerCase() === 'cash';
      out.push({ date: isoDay(r.received_date), reference: r.receipt_number || r.id, code: codes[cash ? 'cash-premium-payment' : 'premium-payment'] || codes.other || '', amount: num(r.amount),
        currency: r.currency_code || 'PHP', mode: r.payment_mode, policy: r.policy_number, counterparty: r.customer_name || '' });
    }
    return out;
  }
  const kind = { disbursement: 'premium-refund', 'claim-payment': 'claim-payment', endorsement: 'premium-refund', receipt: 'premium-payment', 'payment-link': 'premium-payment' }[alert.reference_type] || 'other';
  out.push({ date: isoDay(alert.transaction_date), reference: alert.reference_number || alert.reference_id, code: codes[kind] || codes.other || '', amount: num(alert.amount),
    currency: alert.currency || 'PHP', mode: d.paymentMode || '', policy: d.policyNumber || '', counterparty: d.payee || d.payer || '' });
  return out;
}

async function subjectFields(clientId) {
  const c = clientId ? (await query('SELECT * FROM clients WHERE id = $1', [clientId])).rows[0] : null;
  if (!c) return Array(14).fill('');
  const juridical = c.client_type === 'corporate';
  return [juridical ? 'C' : 'I', juridical ? '' : c.last_name, juridical ? '' : c.first_name, juridical ? '' : c.middle_name, juridical ? c.company_name || c.display_name : '',
    isoDay(juridical ? c.registration_date : c.birth_date) || '', juridical ? '' : c.place_of_birth, juridical ? c.incorporation_country || c.nationality : c.nationality,
    juridical ? c.registration_authority : c.id_type, juridical ? c.registration_number : c.id_number, c.tin, addressOf(c), juridical ? c.business_nature : c.occupation];
}

async function buildFile({ reportType, reportNumber, from, to, alerts, narrative = '', reasons = [] }) {
  const institution = (await amlSetting('aml.amlc_institution_code')) || '';
  const details = [];
  let total = 0;
  let seq = 0;
  for (const a of alerts) {
    const subject = await subjectFields(a.client_id);
    for (const t of await transactionsOf(a)) {
      seq += 1;
      total += t.amount;
      details.push(line(['D', seq, t.date, t.reference, t.code, t.amount.toFixed(2), t.currency, t.mode, ...subject, t.policy, t.counterparty, reasons.join(';'), a.alert_number]));
    }
  }
  const lines = [line(['H', institution, reportType, reportNumber, await today(), from || '', to || '', seq, FORMAT_VERSION]), ...details];
  if (reportType === 'STR') for (const n of String(narrative || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) lines.push(line(['N', n]));
  lines.push(line(['T', seq, round2(total).toFixed(2)]));
  return { content: `${lines.join('\r\n')}\r\n`, transactions: seq, total: round2(total) };
}

async function saveReport(db, { reportType, from, to, caseId, alerts, built, userId, number }) {
  const r = (await db.query(`INSERT INTO aml_reports(report_number, report_type, case_id, period_from, period_to, format_version, file_name, content, transactions, total_amount, generated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
  [number, reportType, caseId, from, to, FORMAT_VERSION, `${number}_${reportType}.txt`, built.content, built.transactions, built.total, userId])).rows[0];
  for (const a of alerts) await db.query('INSERT INTO aml_report_items(report_id, alert_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.id, a.id]);
  return r.id;
}

/** CTR file of the covered transaction alerts of [from, to] not yet in a CTR file. */
export async function generateCtr({ from, to }, userId) {
  const start = isoDay(from);
  const end = isoDay(to);
  if (!start || !end || start > end) throw badRequest('Give the period: from and to (YYYY-MM-DD), from on or before to');
  const alerts = (await query(`SELECT a.* FROM aml_alerts a WHERE a.kind = 'covered' AND a.transaction_date BETWEEN $1 AND $2 AND a.status IN ('open', 'escalated')
    AND NOT EXISTS (SELECT 1 FROM aml_report_items i JOIN aml_reports r ON r.id = i.report_id WHERE i.alert_id = a.id AND r.report_type = 'CTR' AND r.status <> 'rejected')
    ORDER BY a.transaction_date, a.alert_number`, [start, end])).rows;
  if (!alerts.length) throw conflict(`No covered transaction to report between ${start} and ${end}`);
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('aml_report', { db, unique: { table: 'aml_reports', column: 'report_number' } });
    const built = await buildFile({ reportType: 'CTR', reportNumber: number, from: start, to: end, alerts });
    return saveReport(db, { reportType: 'CTR', from: start, to: end, caseId: null, alerts, built, userId, number });
  });
  return getReport(id);
}

/** STR (or CTR) file of an approved case. */
export async function generateForCase(caseId, userId) {
  const c = await getCase(caseId);
  if (c.status !== 'for-filing') throw conflict(`Case ${c.caseNumber} is ${c.status}: approve it for filing first`);
  const alerts = (await query('SELECT * FROM aml_alerts WHERE case_id = $1 ORDER BY transaction_date, alert_number', [c.id])).rows;
  const hits = c.hitList;
  if (!alerts.length && !hits.length) throw conflict('The case has nothing to report');
  const dates = alerts.map((a) => isoDay(a.transaction_date)).sort();
  // a case on a screening match alone reports the client with the case date as the transaction
  const items = alerts.length ? alerts : [{ id: null, alert_number: '', client_id: c.clientId, transaction_date: c.suspicionOn, amount: 0, reference_type: 'case', reference_id: c.caseNumber,
    reference_number: c.caseNumber, details: {} }];
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('aml_report', { db, unique: { table: 'aml_reports', column: 'report_number' } });
    const built = await buildFile({ reportType: c.caseType, reportNumber: number, from: dates[0] || c.suspicionOn, to: dates[dates.length - 1] || c.suspicionOn, alerts: items,
      narrative: c.narrative, reasons: c.suspicionReasons });
    return saveReport(db, { reportType: c.caseType, from: dates[0] || c.suspicionOn, to: dates[dates.length - 1] || c.suspicionOn, caseId: c.id, alerts: alerts, built, userId, number });
  });
  return getReport(id);
}

/** Record the filing in the AMLC portal: the alerts become reported and the case filed. */
export async function markSubmitted(id, { submittedOn, amlcReference, notes, status = 'submitted' }, userId) {
  const r = await getReport(id);
  if (!['generated', 'submitted'].includes(r.status)) throw conflict(`Report ${r.reportNumber} is ${r.status}`);
  if (!['submitted', 'acknowledged', 'rejected'].includes(status)) throw badRequest('status must be submitted, acknowledged or rejected');
  const on = isoDay(submittedOn) || await today();
  await withTransaction(async (db) => {
    await db.query('UPDATE aml_reports SET status = $2, submitted_on = $3, submitted_by = $4, amlc_reference = COALESCE($5, amlc_reference), amlc_notes = COALESCE($6, amlc_notes) WHERE id = $1',
      [r.id, status, on, userId, amlcReference || null, notes || null]);
    if (status !== 'rejected') {
      await db.query("UPDATE aml_alerts SET status = 'reported', decided_by = COALESCE(decided_by, $2), decided_at = COALESCE(decided_at, now()) WHERE id IN (SELECT alert_id FROM aml_report_items WHERE report_id = $1)", [r.id, userId]);
      if (r.caseId) await db.query("UPDATE aml_cases SET status = 'filed', filed_on = $2, amlc_reference = COALESCE($3, amlc_reference), updated_by = $4, updated_at = now() WHERE id = $1", [r.caseId, on, amlcReference || null, userId]);
    }
  });
  return getReport(r.id);
}
