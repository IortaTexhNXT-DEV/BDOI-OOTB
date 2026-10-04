/**
 * Personal data breach and security incident register (Data Privacy Act of 2012; NPC Circular 16-03 on personal data
 * breach management and the NPC rules that followed it): Compliance > Data Privacy > Breach Register.
 *
 * Life cycle: open (logged when discovered) -> assessed (criteria recorded, notifiable decided) -> notified (NPC and
 * data subjects notified, for a notifiable breach) -> closed. The NPC deadline is discovered_at +
 * privacy.breach_notify_hours (72); hoursLeft is negative once it has passed, and a notification after it needs the
 * reason for the delay. A breach is notifiable when it involves sensitive personal information or information that
 * may enable identity fraud, the data is reasonably believed to have been acquired by an unauthorised person, and it is
 * likely to give rise to a real risk of serious harm; the DPO may decide otherwise with a recorded reason.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { notify } from '../notifications/service.js';
import { documentsIn, historyEntry, iso, listSetting } from '../ic-compliance/common.js';

export const INCIDENT_TYPES = ['personal-data-breach', 'security-incident'];
export const NATURES = ['confidentiality', 'integrity', 'availability'];
export const STATUSES = ['open', 'assessed', 'notified', 'closed'];
export const dataCategories = () => listSetting('privacy.breach_data_categories', ['Names and contact details', 'Other']);

async function notifyHours() {
  const n = Number(await getSetting('privacy.breach_notify_hours', 72));
  return Number.isFinite(n) && n > 0 ? n : 72;
}

/** Notifiable under the NPC criteria (the three conditions together). */
export const meetsCriteria = (b) => !!((b.sensitive_data || b.identity_fraud_risk) && b.unauthorised_acquisition && b.real_risk_of_harm);

const SELECT = 'SELECT b.*, u.display_name AS dpo_name FROM personal_data_breaches b LEFT JOIN users u ON u.id = b.dpo_user_id';

export function breachApi(r, nowMs = Date.now()) {
  const due = new Date(r.npc_due_at).getTime();
  const notifiable = r.notifiable === null ? meetsCriteria(r) : r.notifiable;
  // the clock runs from discovery: an incident not yet assessed shows its deadline too
  const pendingNpc = (notifiable || r.notifiable === null) && !r.npc_notified_at && r.incident_type === 'personal-data-breach' && r.status !== 'closed';
  const notifiedLate = r.npc_notified_at ? new Date(r.npc_notified_at).getTime() > due : null;
  return {
    id: r.id, breachNumber: r.breach_number, incidentType: r.incident_type, title: r.title, description: r.description,
    discoveredAt: r.discovered_at, occurredAt: r.occurred_at, reportedBy: r.reported_by, nature: r.nature || [], dataCategories: r.data_categories || [],
    sensitiveData: r.sensitive_data, identityFraudRisk: r.identity_fraud_risk, unauthorisedAcquisition: r.unauthorised_acquisition, realRiskOfHarm: r.real_risk_of_harm,
    meetsNotificationCriteria: meetsCriteria(r), notifiable, notifiableDecided: r.notifiable !== null, notifiableOverrideReason: r.notifiable_override_reason,
    subjectsAffected: r.subjects_affected, recordsAffected: r.records_affected, systemsAffected: r.systems_affected, cause: r.cause, containment: r.containment,
    remediation: r.remediation, assessmentNotes: r.assessment_notes, assessedAt: r.assessed_at, assessedBy: r.assessed_by,
    npcDueAt: r.npc_due_at, hoursLeft: pendingNpc ? Math.floor((due - nowMs) / 3600000) : null, npcOverdue: pendingNpc && nowMs > due,
    npcNotifiedAt: r.npc_notified_at, npcReference: r.npc_reference, npcNotificationMethod: r.npc_notification_method, npcDelayReason: r.npc_delay_reason, notifiedLate,
    subjectsNotifiedAt: r.subjects_notified_at, subjectsNotifiedCount: r.subjects_notified_count, subjectsNotificationMethod: r.subjects_notification_method,
    subjectsNotNotifiedReason: r.subjects_not_notified_reason, status: r.status, dpoUserId: r.dpo_user_id, dpoName: r.dpo_name || null,
    closedAt: r.closed_at, closedBy: r.closed_by, closureNotes: r.closure_notes, documents: r.documents || [], actions: r.actions || [],
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function listBreaches(q = {}) {
  const where = ['true'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('b.status = ANY(?::text[])', String(q.status).split(','));
  if (q.incidentType) add('b.incident_type = ?', String(q.incidentType));
  if (q.year) add('extract(year FROM b.discovered_at) = ?::int', Number(q.year));
  if (q.search) add("(b.breach_number ILIKE '%' || ? || '%' OR b.title ILIKE '%' || ? || '%')", String(q.search));
  const rows = (await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY b.discovered_at DESC`, params)).map((r) => breachApi(r));
  const items = String(q.pendingNpc) === 'true' ? rows.filter((r) => r.hoursLeft !== null) : rows;
  const open = (await many(`${SELECT} WHERE b.status <> 'closed'`)).map((r) => breachApi(r));
  return {
    items, notifyHours: await notifyHours(),
    summary: { open: open.length, pendingNpc: open.filter((r) => r.hoursLeft !== null).length, npcOverdue: open.filter((r) => r.npcOverdue).length,
      notAssessed: open.filter((r) => !r.assessedAt).length },
  };
}

export async function getBreach(id) {
  const r = await one(`${SELECT} WHERE b.id = $1 OR b.breach_number = $1`, [id]);
  if (!r) throw notFound('Incident not found');
  return r;
}
export const breachView = async (id) => breachApi(await getBreach(id));

const COLS = { incidentType: 'incident_type', title: 'title', description: 'description', occurredAt: 'occurred_at', reportedBy: 'reported_by', subjectsAffected: 'subjects_affected',
  recordsAffected: 'records_affected', systemsAffected: 'systems_affected', cause: 'cause', containment: 'containment', remediation: 'remediation', dpoUserId: 'dpo_user_id' };

async function columns(body, user) {
  const cols = {};
  for (const [k, c] of Object.entries(COLS)) if (body[k] !== undefined) cols[c] = body[k] === '' ? null : body[k];
  if (body.nature !== undefined) {
    if (body.nature.some((n) => !NATURES.includes(n))) throw badRequest('Validation failed', [{ path: 'nature', message: `nature is one or more of ${NATURES.join(', ')}` }]);
    cols.nature = JSON.stringify(body.nature);
  }
  if (body.dataCategories !== undefined) {
    const allowed = await dataCategories();
    const bad = body.dataCategories.find((c) => !allowed.includes(c));
    if (bad) throw badRequest('Validation failed', [{ path: 'dataCategories', message: `${bad} is not a category set in privacy.breach_data_categories` }]);
    cols.data_categories = JSON.stringify(body.dataCategories);
  }
  if (body.documents !== undefined) cols.documents = JSON.stringify(documentsIn(body.documents, user));
  return cols;
}

export async function createBreach(body, user) {
  const cols = await columns(body, user);
  const discovered = body.discoveredAt ? new Date(body.discoveredAt) : new Date();
  if (Number.isNaN(discovered.getTime())) throw badRequest('Validation failed', [{ path: 'discoveredAt', message: 'Invalid date and time' }]);
  if (discovered.getTime() > Date.now() + 60000) throw badRequest('Validation failed', [{ path: 'discoveredAt', message: 'The time of discovery cannot be in the future' }]);
  const due = new Date(discovered.getTime() + (await notifyHours()) * 3600000);
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('data_breach', { db, date: await today(discovered) });
    const all = { ...cols, breach_number: number, discovered_at: discovered, npc_due_at: due, actions: JSON.stringify([historyEntry('logged', user)]), created_by: user.id, updated_by: user.id };
    const keys = Object.keys(all);
    return (await db.query(`INSERT INTO personal_data_breaches(${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, Object.values(all))).rows[0].id;
  });
  const b = await breachView(id);
  if (b.incidentType === 'personal-data-breach') {
    await notify({ type: 'task', priority: 'high', title: `Personal data breach logged: ${b.breachNumber}`,
      message: `${b.title}. Assess it now: a notifiable breach must be notified to the NPC by ${new Date(b.npcDueAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
      link: '/compliance/breaches', entity: 'personal_data_breach', entityId: b.id, audience: 'read:privacy' });
  }
  return b;
}

export async function updateBreach(id, body, user) {
  const before = await getBreach(id);
  if (before.status === 'closed') throw conflict('A closed incident cannot be changed');
  const cols = { ...(await columns(body, user)), actions: JSON.stringify([...(before.actions || []), historyEntry('updated', user)]), updated_by: user.id, updated_at: new Date() };
  const keys = Object.keys(cols);
  await query(`UPDATE personal_data_breaches SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(cols)]);
  return { before: breachApi(before), after: await breachView(before.id) };
}

/**
 * Actions: assess (criteria, notes; notifiable follows the criteria unless decided otherwise with a reason),
 * notify-npc (date, reference, method; the reason for the delay when after the deadline), notify-subjects (date,
 * number, method, or the reason they are not notified), close (notes; a notifiable breach must have been notified).
 */
export async function breachAction(id, action, body, user) {
  const b = await getBreach(id);
  if (b.status === 'closed') throw conflict('The incident is closed');
  const set = {};
  const now = new Date();
  switch (action) {
    case 'assess': {
      const crit = { sensitive_data: !!body.sensitiveData, identity_fraud_risk: !!body.identityFraudRisk, unauthorised_acquisition: !!body.unauthorisedAcquisition, real_risk_of_harm: !!body.realRiskOfHarm };
      const criteria = meetsCriteria(crit);
      const notifiable = body.notifiable === undefined || body.notifiable === null ? criteria : !!body.notifiable;
      if (notifiable !== criteria && !body.overrideReason) {
        throw badRequest('Validation failed', [{ path: 'overrideReason', message: 'Give the reason the decision differs from the NPC criteria' }]);
      }
      Object.assign(set, crit, { notifiable, notifiable_override_reason: notifiable !== criteria ? body.overrideReason : null, assessment_notes: body.notes || null,
        assessed_at: now, assessed_by: user.username || user.id, status: b.status === 'open' ? 'assessed' : b.status });
      if (body.incidentType && INCIDENT_TYPES.includes(body.incidentType)) set.incident_type = body.incidentType;
      break;
    }
    case 'notify-npc': {
      if (!b.assessed_at) throw conflict('Assess the breach before recording its notification');
      const at = body.notifiedAt ? new Date(body.notifiedAt) : now;
      if (at.getTime() > new Date(b.npc_due_at).getTime() && !body.delayReason) {
        throw badRequest('Validation failed', [{ path: 'delayReason', message: 'The notification is after the deadline: give the reason for the delay' }]);
      }
      if (!body.reference) throw badRequest('Validation failed', [{ path: 'reference', message: 'Give the reference or acknowledgement of the NPC' }]);
      Object.assign(set, { npc_notified_at: at, npc_reference: body.reference, npc_notification_method: body.method || null, npc_delay_reason: body.delayReason || null, status: 'notified' });
      break;
    }
    case 'notify-subjects':
      if (!body.notNotifiedReason && !(Number(body.count) >= 0 && body.count !== undefined && body.count !== null)) {
        throw badRequest('Validation failed', [{ path: 'count', message: 'Give the number of data subjects notified, or the reason they are not notified' }]);
      }
      Object.assign(set, body.notNotifiedReason ? { subjects_not_notified_reason: body.notNotifiedReason }
        : { subjects_notified_at: body.notifiedAt ? new Date(body.notifiedAt) : now, subjects_notified_count: Number(body.count), subjects_notification_method: body.method || null });
      break;
    case 'close': {
      const v = breachApi(b);
      if (v.notifiable && v.incidentType === 'personal-data-breach' && !b.npc_notified_at) throw conflict('A notifiable breach is closed only after its notification to the NPC is recorded');
      if (!body.notes) throw badRequest('Validation failed', [{ path: 'notes', message: 'Summarise the outcome and the measures taken' }]);
      Object.assign(set, { status: 'closed', closed_at: now, closed_by: user.username || user.id, closure_notes: body.notes });
      break;
    }
    default:
      throw badRequest(`Unknown action ${action}`);
  }
  const all = { ...set, actions: JSON.stringify([...(b.actions || []), historyEntry(action, user)]), updated_by: user.id, updated_at: now };
  const keys = Object.keys(all);
  await query(`UPDATE personal_data_breaches SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [b.id, ...Object.values(all)]);
  return { before: breachApi(b), after: await breachView(b.id) };
}

/** Annual security incident report of a calendar year. */
export async function annualReport(year) {
  const y = Number(year) || Number((await today()).slice(0, 4)) - 1;
  const rows = (await many(`${SELECT} WHERE extract(year FROM b.discovered_at AT TIME ZONE 'Asia/Manila') = $1 ORDER BY b.discovered_at`, [y])).map((r) => breachApi(r));
  const breaches = rows.filter((r) => r.incidentType === 'personal-data-breach');
  const notifiable = breaches.filter((r) => r.notifiable);
  const byNature = NATURES.map((n) => ({ value: n, count: rows.filter((r) => r.nature.includes(n)).length }));
  const cats = await dataCategories();
  return {
    year: y, incidents: rows.length, securityIncidents: rows.filter((r) => r.incidentType === 'security-incident').length, breaches: breaches.length,
    notifiable: notifiable.length, notifiedToNpc: notifiable.filter((r) => r.npcNotifiedAt).length, notifiedLate: notifiable.filter((r) => r.notifiedLate).length,
    subjectsAffected: rows.reduce((s, r) => s + (r.subjectsAffected || 0), 0), subjectsNotified: rows.reduce((s, r) => s + (r.subjectsNotifiedCount || 0), 0),
    closed: rows.filter((r) => r.status === 'closed').length, byNature,
    byCategory: cats.map((c) => ({ value: c, count: rows.filter((r) => r.dataCategories.includes(c)).length })).filter((x) => x.count),
    items: rows,
  };
}

export function annualSheets(rep) {
  const dt = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '');
  return [
    { name: 'Summary', columns: [{ key: 'k', header: 'Item', width: 56 }, { key: 'v', header: 'Value', width: 16 }], rows: [
      { k: 'Calendar year', v: rep.year }, { k: 'Security incidents and personal data breaches recorded', v: rep.incidents },
      { k: 'Security incidents (no personal data breach)', v: rep.securityIncidents }, { k: 'Personal data breaches', v: rep.breaches },
      { k: 'Breaches meeting the notification criteria', v: rep.notifiable }, { k: 'Notified to the NPC', v: rep.notifiedToNpc },
      { k: 'Notified after the deadline', v: rep.notifiedLate }, { k: 'Data subjects affected', v: rep.subjectsAffected }, { k: 'Data subjects notified', v: rep.subjectsNotified },
      { k: 'Closed', v: rep.closed }] },
    { name: 'By nature', columns: [{ key: 'value', header: 'Nature of the breach', width: 30 }, { key: 'count', header: 'Incidents', type: 'integer' }], rows: rep.byNature },
    { name: 'By data category', columns: [{ key: 'value', header: 'Personal data involved', width: 44 }, { key: 'count', header: 'Incidents', type: 'integer' }], rows: rep.byCategory },
    { name: 'Incidents', columns: [
      { key: 'breachNumber', header: 'Reference', width: 16 }, { key: 'incidentType', header: 'Type', width: 20 }, { key: 'title', header: 'Title', width: 40 },
      { key: 'discovered', header: 'Discovered', width: 17 }, { key: 'nature', header: 'Nature', width: 24 }, { key: 'subjectsAffected', header: 'Subjects affected', type: 'integer' },
      { key: 'notifiable', header: 'Notifiable', width: 10 }, { key: 'npcNotified', header: 'NPC notified', width: 17 }, { key: 'npcReference', header: 'NPC reference', width: 18 },
      { key: 'late', header: 'Late', width: 6 }, { key: 'subjectsNotifiedCount', header: 'Subjects notified', type: 'integer' }, { key: 'containment', header: 'Containment', width: 40 },
      { key: 'remediation', header: 'Remediation', width: 40 }, { key: 'status', header: 'Status', width: 10 }],
    rows: rep.items.map((r) => ({ ...r, discovered: dt(r.discoveredAt), nature: r.nature.join(', '), notifiable: r.notifiable ? 'Yes' : 'No', npcNotified: dt(r.npcNotifiedAt), late: r.notifiedLate ? 'Yes' : '' })) },
  ];
}

/** Hourly job: remind the data privacy team as the NPC deadline of a notifiable breach approaches, and when it has passed. */
export async function breachDeadlineRun(nowMs = Date.now()) {
  const hours = await getSetting('privacy.breach_reminder_hours', [48, 24, 6]);
  const marks = (Array.isArray(hours) ? hours : [48, 24, 6]).map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const rows = (await many(`${SELECT} WHERE b.status <> 'closed' AND b.npc_notified_at IS NULL AND b.incident_type = 'personal-data-breach'`)).map((r) => breachApi(r, nowMs));
  let reminded = 0;
  for (const b of rows.filter((x) => x.hoursLeft !== null || !x.notifiableDecided)) {
    const left = Math.floor((new Date(b.npcDueAt).getTime() - nowMs) / 3600000);
    const mark = left < 0 ? 'overdue' : marks.find((m) => left < m);
    if (mark === undefined) continue;
    const kind = mark === 'overdue' ? 'overdue' : `h${mark}`;
    const ins = await one('INSERT INTO personal_data_breach_reminders(breach_id, kind) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING breach_id', [b.id, kind]);
    if (!ins) continue;
    await notify({ type: 'reminder', priority: 'high', audience: 'read:privacy', link: '/compliance/breaches', entity: 'personal_data_breach', entityId: b.id,
      title: left < 0 ? `NPC notification overdue: ${b.breachNumber}` : `NPC notification due in ${left} hour(s): ${b.breachNumber}`,
      message: `${b.title}${b.notifiableDecided ? '' : ' (not yet assessed)'}: notify the National Privacy Commission by ${new Date(b.npcDueAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.` });
    reminded += 1;
  }
  return { pending: rows.length, reminded };
}

export { iso };
