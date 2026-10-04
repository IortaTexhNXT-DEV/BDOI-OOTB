/**
 * AML cases: the compliance officer's file on a client or transactions. A case is opened from alerts or screening hits
 * (escalation) or directly; CTR cases hold covered transactions, STR cases the suspicious ones. The STR due date is
 * aml.str_due_working_days working days after the date suspicion was established; a CTR case is due
 * aml.ctr_due_working_days working days after its earliest transaction.
 *
 * Status: open (investigation) -> for-filing (approved by a compliance officer holding approve:aml, with the narrative)
 * -> filed (report file generated and marked submitted to the AMLC with its acknowledgement); or closed with a reason
 * (no report).
 */
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { assessClient } from './risk.js';
import { addWorkingDays, amlSetting, isoDay } from './common.js';
import { ALERT_SELECT, alertRow } from './monitoring.js';
import { hitRow, recountScreening, getHit } from './screening.js';

export const caseRow = (c) => ({
  id: c.id, caseNumber: c.case_number, caseType: c.case_type, clientId: c.client_id, clientCode: c.client_code || null, clientName: c.client_name || null,
  title: c.title, narrative: c.narrative, suspicionReasons: c.suspicion_reasons || [], status: c.status, suspicionOn: isoDay(c.suspicion_on), dueOn: isoDay(c.due_on),
  assignedTo: c.assigned_to, assignedToName: c.assigned_to_name || null, approvedBy: c.approved_by_name || c.approved_by, approvedAt: c.approved_at, filedOn: isoDay(c.filed_on),
  amlcReference: c.amlc_reference, closedReason: c.closed_reason, closedAt: c.closed_at, createdBy: c.created_by_name || c.created_by, createdAt: c.created_at,
  overdue: !!c.overdue, alerts: c.alerts_count ?? undefined,
});

const CASE_SELECT = `SELECT ac.*, c.client_code, c.display_name AS client_name, au.display_name AS assigned_to_name, pu.display_name AS approved_by_name,
  cu.display_name AS created_by_name, (ac.status IN ('open', 'for-filing') AND ac.due_on < CURRENT_DATE) AS overdue,
  (SELECT count(*) FROM aml_alerts x WHERE x.case_id = ac.id) AS alerts_count
  FROM aml_cases ac LEFT JOIN clients c ON c.id = ac.client_id LEFT JOIN users au ON au.id = ac.assigned_to LEFT JOIN users pu ON pu.id = ac.approved_by
  LEFT JOIN users cu ON cu.id = ac.created_by`;

export const SUSPICION_REASONS = [
  'no-underlying-legal-or-trade-obligation', 'client-not-properly-identified', 'amount-not-commensurate-with-business-or-capacity', 'structuring',
  'deviation-from-profile', 'related-to-unlawful-activity', 'similar-or-analogous', 'sanctions-or-designated-person',
];

export async function listCases(q = {}) {
  const params = [];
  const where = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('ac.status = ANY(?)', String(q.status).split(','));
  if (q.caseType) add('ac.case_type = ?', q.caseType);
  if (q.clientId) add('ac.client_id = ?', q.clientId);
  if (q.search) add("(ac.case_number ILIKE '%' || ? || '%' OR ac.title ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%')", q.search);
  return (await query(`${CASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY (ac.status IN ('open', 'for-filing')) DESC, ac.due_on NULLS LAST, ac.created_at DESC LIMIT 500`, params)).rows.map(caseRow);
}

export async function getCase(id) {
  const c = (await query(`${CASE_SELECT} WHERE ac.id = $1 OR ac.case_number = $1`, [id])).rows[0];
  if (!c) throw notFound('AML case not found');
  const alerts = (await query(`${ALERT_SELECT} WHERE a.case_id = $1 ORDER BY a.transaction_date`, [c.id])).rows.map(alertRow);
  const hits = (await query(`SELECT h.*, l.name AS list_name FROM aml_screening_hits h LEFT JOIN aml_screening_lists l ON l.id = h.list_id WHERE h.case_id = $1 ORDER BY h.id`, [c.id])).rows.map(hitRow);
  const reports = (await query('SELECT id, report_number, report_type, status, generated_at, submitted_on, amlc_reference FROM aml_reports WHERE case_id = $1 ORDER BY generated_at DESC', [c.id])).rows
    .map((r) => ({ id: r.id, reportNumber: r.report_number, reportType: r.report_type, status: r.status, generatedAt: r.generated_at, submittedOn: isoDay(r.submitted_on), amlcReference: r.amlc_reference }));
  return { ...caseRow(c), alertList: alerts, hitList: hits, reports };
}

async function dueFor(caseType, suspicionOn, alertDates) {
  if (caseType === 'STR') return addWorkingDays(suspicionOn, Number(await amlSetting('aml.str_due_working_days')));
  if (caseType === 'CTR') return addWorkingDays(alertDates.sort()[0] || suspicionOn, Number(await amlSetting('aml.ctr_due_working_days')));
  return null;
}

/** Open a case, optionally with alerts and hits (escalation). b: { caseType, clientId, title, narrative, suspicionReasons, suspicionOn, assignedTo, alertIds, hitIds }. */
export async function createCase(b, userId) {
  if (!['CTR', 'STR', 'review'].includes(b.caseType)) throw badRequest('caseType must be CTR, STR or review');
  const alertIds = b.alertIds || [];
  const alerts = alertIds.length ? (await query('SELECT * FROM aml_alerts WHERE id = ANY($1::text[])', [alertIds])).rows : [];
  if (alerts.length !== alertIds.length) throw badRequest('An alert was not found');
  const taken = alerts.find((a) => a.case_id || a.status !== 'open');
  if (taken) throw conflict(`Alert ${taken.alert_number} is ${taken.case_id ? 'already in a case' : taken.status}`);
  const clientId = b.clientId || alerts.find((a) => a.client_id)?.client_id || null;
  const suspicionOn = isoDay(b.suspicionOn) || await today();
  const due = await dueFor(b.caseType, suspicionOn, alerts.map((a) => isoDay(a.transaction_date)));
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('aml_case', { db, unique: { table: 'aml_cases', column: 'case_number' } });
    const r = (await db.query(`INSERT INTO aml_cases(case_number, case_type, client_id, title, narrative, suspicion_reasons, suspicion_on, due_on, assigned_to, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [number, b.caseType, clientId, b.title || `${b.caseType} ${number}`, b.narrative || null, b.suspicionReasons || [], suspicionOn, due, b.assignedTo || null, userId])).rows[0];
    if (alertIds.length) await db.query("UPDATE aml_alerts SET case_id = $2, status = 'escalated', decided_by = $3, decided_at = now(), decision_reason = COALESCE(decision_reason, 'Escalated to a case') WHERE id = ANY($1::text[])", [alertIds, r.id, userId]);
    return r.id;
  });
  for (const hitId of b.hitIds || []) await escalateHit(hitId, { caseId: id, reason: b.narrative || 'Escalated to a case' }, { id: userId });
  return getCase(id);
}

export async function updateCase(id, b, userId) {
  const before = await getCase(id);
  if (!['open', 'for-filing'].includes(before.status)) throw conflict(`Case ${before.caseNumber} is ${before.status}`);
  const suspicionOn = b.suspicionOn !== undefined ? isoDay(b.suspicionOn) : before.suspicionOn;
  const due = before.caseType === 'STR' && suspicionOn !== before.suspicionOn ? await dueFor('STR', suspicionOn, []) : before.dueOn;
  await query(`UPDATE aml_cases SET title = COALESCE($2, title), narrative = COALESCE($3, narrative), suspicion_reasons = COALESCE($4, suspicion_reasons), suspicion_on = $5, due_on = $6,
    assigned_to = CASE WHEN $7::boolean THEN $8 ELSE assigned_to END, updated_by = $9, updated_at = now() WHERE id = $1`,
  [before.id, b.title ?? null, b.narrative ?? null, b.suspicionReasons ?? null, suspicionOn, due, b.assignedTo !== undefined, b.assignedTo || null, userId]);
  return { before, after: await getCase(before.id) };
}

/** Add open alerts to a case. */
export async function addAlerts(id, alertIds, userId) {
  const c = await getCase(id);
  if (!['open', 'for-filing'].includes(c.status)) throw conflict(`Case ${c.caseNumber} is ${c.status}`);
  const r = await query(`UPDATE aml_alerts SET case_id = $2, status = 'escalated', decided_by = $3, decided_at = now(), decision_reason = COALESCE(decision_reason, 'Escalated to a case')
    WHERE id = ANY($1::text[]) AND status = 'open' AND case_id IS NULL RETURNING id`, [alertIds, c.id, userId]);
  if (r.rowCount !== alertIds.length) throw conflict('Only open alerts that are in no case can be added');
  return getCase(c.id);
}

/** Approve the case for filing (approve:aml): the narrative is required for an STR. */
export async function approveCase(id, user) {
  const c = await getCase(id);
  if (c.status !== 'open') throw conflict(`Case ${c.caseNumber} is ${c.status}`);
  if (c.caseType === 'review') throw conflict('A review case is not filed with the AMLC: close it, or open an STR or CTR case');
  if (c.caseType === 'STR' && (!c.narrative || c.narrative.trim().length < 20)) throw badRequest('Write the narrative of the suspicious transaction (at least 20 characters) before approving the case for filing');
  if (c.caseType === 'STR' && !c.suspicionReasons.length) throw badRequest('Choose at least one ground of suspicion');
  if (!c.alertList.length && !c.hitList.length) throw badRequest('The case has no transaction alert or screening hit to report');
  await query("UPDATE aml_cases SET status = 'for-filing', approved_by = $2, approved_at = now(), updated_by = $2, updated_at = now() WHERE id = $1", [c.id, user.id]);
  return getCase(c.id);
}

export async function closeCase(id, reason, userId) {
  const c = await getCase(id);
  if (!['open', 'for-filing'].includes(c.status)) throw conflict(`Case ${c.caseNumber} is ${c.status}`);
  if (!reason || String(reason).trim().length < 5) throw badRequest('Give the reason for closing the case (at least 5 characters)');
  if (c.alertList.some((a) => a.kind === 'covered')) throw conflict('The case holds covered transactions: they are reported to the AMLC (CTR), the case cannot be closed without a report');
  await withTransaction(async (db) => {
    await db.query("UPDATE aml_cases SET status = 'closed', closed_reason = $2, closed_by = $3, closed_at = now(), updated_by = $3, updated_at = now() WHERE id = $1", [c.id, String(reason).trim(), userId]);
    await db.query("UPDATE aml_alerts SET status = 'closed', decision_reason = $2 WHERE case_id = $1 AND status = 'escalated'", [c.id, `Case closed: ${String(reason).trim()}`]);
  });
  return getCase(c.id);
}

// ---------------------------------------------------------------- screening hit decisions

/**
 * Compliance officer's decision on a hit (approve:aml): clear (false positive), confirm (true match: the client is
 * rated High and blocked), escalate (to a case: an existing one or a new review case).
 */
export async function decideHit(id, { decision, reason, caseId = null }, user) {
  const h = await getHit(id);
  if (!['open', 'escalated'].includes(h.status)) throw conflict(`The hit is already ${h.status}`);
  if (!reason || String(reason).trim().length < 5) throw badRequest('Give the reason for the decision (at least 5 characters)');
  if (decision === 'escalate') return escalateHit(id, { caseId, reason }, user);
  if (!['clear', 'confirm'].includes(decision)) throw badRequest('decision must be clear, escalate or confirm');
  await query('UPDATE aml_screening_hits SET status = $2, decision_reason = $3, decided_by = $4, decided_at = now() WHERE id = $1',
    [h.id, decision === 'clear' ? 'cleared' : 'confirmed', String(reason).trim(), user.id]);
  await recountScreening(h.screeningId);
  if (h.clientId) {
    // a confirmed match rates the client High (and blocks it); a cleared one may lift the block
    const exists = (await query('SELECT 1 FROM clients WHERE id = $1', [h.clientId])).rows[0];
    if (exists) await assessClient({ query }, h.clientId, { trigger: 'screening', userId: user.id, reference: `Screening hit ${h.id} ${decision === 'clear' ? 'cleared' : 'confirmed'}` });
  }
  return getHit(h.id);
}

async function escalateHit(id, { caseId, reason }, user) {
  const h = await getHit(id);
  let target = caseId;
  if (!target) {
    const c = await createCase({ caseType: 'review', clientId: h.clientId, title: `Screening match: ${h.partyName} / ${h.matchedName} (${h.listCode})`, narrative: reason }, user.id);
    target = c.id;
  } else {
    const c = (await query('SELECT id, status FROM aml_cases WHERE id = $1 OR case_number = $1', [caseId])).rows[0];
    if (!c) throw notFound('AML case not found');
    if (!['open', 'for-filing'].includes(c.status)) throw conflict('The case is no longer open');
    target = c.id;
  }
  await query("UPDATE aml_screening_hits SET status = 'escalated', case_id = $2, decision_reason = $3, decided_by = $4, decided_at = now() WHERE id = $1",
    [h.id, target, String(reason || 'Escalated').trim(), user.id]);
  await recountScreening(h.screeningId);
  return getHit(h.id);
}
