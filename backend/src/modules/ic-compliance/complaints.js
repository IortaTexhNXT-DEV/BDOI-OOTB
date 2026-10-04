/**
 * Complaints register (RA 11765, Financial Products and Services Consumer Protection Act, and the Insurance
 * Commission's rules on complaints handling): Compliance > Insurance Commission > Complaints.
 *
 * Life cycle: received -> acknowledged -> in-progress -> (escalated) -> resolved -> closed. Deadlines are computed on
 * receipt from the settings (complaints.ack_days, complaints.resolution_days_simple / _complex, calendar days). Ageing
 * is counted in calendar days from receipt to resolution (or to today while open). Every step is kept in `actions`.
 * The daily job complaints-deadlines (complaintsDeadlines) reminds the person assigned once a day of a deadline due or
 * passed and, with complaints.auto_escalate, escalates complaints whose resolution is overdue to approve:complaints.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { renderTemplate } from '../../lib/template.js';
import { notify } from '../notifications/service.js';
import { daysBetween, documentsIn, historyEntry, iso, listSetting } from './common.js';

export const STATUSES = ['received', 'acknowledged', 'in-progress', 'escalated', 'resolved', 'closed'];
export const OPEN = ['received', 'acknowledged', 'in-progress', 'escalated'];
export const OUTCOMES = ['upheld', 'partially-upheld', 'not-upheld', 'withdrawn'];
export const COMPLAINANT_TYPES = ['client', 'claimant', 'prospect', 'third-party', 'other'];

const num = async (key, fallback) => {
  const n = Number(await getSetting(key, fallback));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
export const channels = () => listSetting('complaints.channels', ['Walk-in', 'Phone', 'E-mail', 'Letter']);
export const categories = () => listSetting('complaints.categories', ['Claims handling', 'Other']);

/** Deadlines of a complaint received on a date: { ackDueOn, resolutionDueOn }. */
export async function deadlines(receivedOn, complexity) {
  return {
    ackDueOn: addDays(receivedOn, await num('complaints.ack_days', 2)),
    resolutionDueOn: addDays(receivedOn, complexity === 'complex' ? await num('complaints.resolution_days_complex', 45) : await num('complaints.resolution_days_simple', 7)),
  };
}

const SELECT = `SELECT c.*, cl.client_code, cl.display_name AS client_name, p.policy_number, cm.claim_number, ic.name AS insurer_name,
    u.display_name AS assigned_to_name
  FROM complaints c LEFT JOIN clients cl ON cl.id = c.client_id LEFT JOIN policies p ON p.id = c.policy_id LEFT JOIN claims cm ON cm.id = c.claim_id
  LEFT JOIN insurance_companies ic ON ic.id = c.insurance_company_id LEFT JOIN users u ON u.id = c.assigned_to`;

/** API shape; ageing and the overdue flags on the date given. */
export function complaintApi(r, now) {
  const received = iso(r.received_at);
  const resolvedOn = iso(r.resolved_at);
  const open = OPEN.includes(r.status);
  const ackOverdue = !r.acknowledged_at && now > iso(r.ack_due_on) && open;
  const resolutionOverdue = open && now > iso(r.resolution_due_on);
  return {
    id: r.id, complaintNumber: r.complaint_number, receivedAt: r.received_at, receivedOn: received, channel: r.channel,
    complainantName: r.complainant_name, complainantContact: r.complainant_contact, complainantType: r.complainant_type,
    clientId: r.client_id, clientCode: r.client_code || null, clientName: r.client_name || null, policyId: r.policy_id, policyNumber: r.policy_number || null,
    claimId: r.claim_id, claimNumber: r.claim_number || null, insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name || null,
    category: r.category, complexity: r.complexity, subject: r.subject, description: r.description, amountDisputed: r.amount_disputed === null ? null : Number(r.amount_disputed),
    status: r.status, assignedTo: r.assigned_to, assignedToName: r.assigned_to_name || null,
    ackDueOn: iso(r.ack_due_on), acknowledgedAt: r.acknowledged_at, acknowledgedBy: r.acknowledged_by,
    resolutionDueOn: iso(r.resolution_due_on), resolvedAt: r.resolved_at, resolvedBy: r.resolved_by, outcome: r.outcome, resolution: r.resolution,
    redressAmount: r.redress_amount === null ? null : Number(r.redress_amount),
    escalationLevel: r.escalation_level, escalatedAt: r.escalated_at, escalationReason: r.escalation_reason,
    referredToRegulator: r.referred_to_regulator, regulatorReference: r.regulator_reference, referredOn: iso(r.referred_on),
    closedAt: r.closed_at, closedBy: r.closed_by, documents: r.documents || [], actions: r.actions || [],
    ageDays: daysBetween(received, resolvedOn || now), ackOverdue, resolutionOverdue,
    resolvedWithinDeadline: resolvedOn ? resolvedOn <= iso(r.resolution_due_on) : null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Register with filters (status, category, channel, overdue, assignedTo, from, to, search) and counts. */
export async function listComplaints(q = {}) {
  const now = await today();
  const where = ['true'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('c.status = ANY(?::text[])', String(q.status).split(','));
  if (q.category) add('c.category = ?', String(q.category));
  if (q.channel) add('c.channel = ?', String(q.channel));
  if (q.assignedTo) add('c.assigned_to = ?', String(q.assignedTo));
  if (q.clientId) add('c.client_id = ?', String(q.clientId));
  if (q.policyId) add('c.policy_id = ?', String(q.policyId));
  if (q.from) add('c.received_at >= ?::date', String(q.from));
  if (q.to) add("c.received_at < (?::date + interval '1 day')", String(q.to));
  if (q.search) add("(c.complaint_number ILIKE '%' || ? || '%' OR c.complainant_name ILIKE '%' || ? || '%' OR c.subject ILIKE '%' || ? || '%')", String(q.search));
  const rows = (await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY c.received_at DESC`, params)).map((r) => complaintApi(r, now));
  const items = String(q.overdue) === 'true' ? rows.filter((r) => r.ackOverdue || r.resolutionOverdue) : rows;
  const all = (await many(`${SELECT} WHERE c.status = ANY($1::text[])`, [OPEN])).map((r) => complaintApi(r, now));
  return {
    items, today: now,
    summary: { open: all.length, ackOverdue: all.filter((r) => r.ackOverdue).length, resolutionOverdue: all.filter((r) => r.resolutionOverdue).length,
      escalated: all.filter((r) => r.status === 'escalated').length },
  };
}

export async function getComplaint(id) {
  const r = await one(`${SELECT} WHERE c.id = $1 OR c.complaint_number = $1`, [id]);
  if (!r) throw notFound('Complaint not found');
  return r;
}
export const complaintView = async (id) => complaintApi(await getComplaint(id), await today());

/** Client, policy and claim links: a policy or claim fills the client; the client must match. */
async function resolveLinks(body, before = {}) {
  const out = {};
  const policyId = body.policyId !== undefined ? body.policyId || null : before.policy_id;
  const claimId = body.claimId !== undefined ? body.claimId || null : before.claim_id;
  let clientId = body.clientId !== undefined ? body.clientId || null : before.client_id;
  let insurerId = body.insuranceCompanyId !== undefined ? body.insuranceCompanyId || null : before.insurance_company_id;
  if (claimId) {
    const c = await one('SELECT id, policy_id, client_id FROM claims WHERE id = $1 OR claim_number = $1', [claimId]);
    if (!c) throw badRequest('Validation failed', [{ path: 'claimId', message: 'Claim not found' }]);
    out.claim_id = c.id;
  } else out.claim_id = null;
  const polRef = policyId || (out.claim_id ? (await one('SELECT policy_id FROM claims WHERE id = $1', [out.claim_id])).policy_id : null);
  if (polRef) {
    const p = await one('SELECT id, client_id, insurance_company_id FROM policies WHERE id = $1 OR policy_number = $1', [polRef]);
    if (!p) throw badRequest('Validation failed', [{ path: 'policyId', message: 'Policy not found' }]);
    out.policy_id = p.id;
    if (!clientId) clientId = p.client_id;
    else if (p.client_id && p.client_id !== clientId) throw badRequest('Validation failed', [{ path: 'policyId', message: 'The policy belongs to another client' }]);
    if (!insurerId) insurerId = p.insurance_company_id;
  } else out.policy_id = null;
  if (clientId) {
    const c = await one('SELECT id FROM clients WHERE id = $1 OR client_code = $1', [clientId]);
    if (!c) throw badRequest('Validation failed', [{ path: 'clientId', message: 'Client not found' }]);
    out.client_id = c.id;
  } else out.client_id = null;
  out.insurance_company_id = insurerId ? Number(insurerId) : null;
  return out;
}

async function assertOption(list, value, path) {
  if (value !== undefined && value !== null && !(await list()).includes(value)) throw badRequest('Validation failed', [{ path, message: `${value} is not one of the values set in the configuration` }]);
}

export async function createComplaint(body, user) {
  await assertOption(channels, body.channel, 'channel');
  await assertOption(categories, body.category, 'category');
  const links = await resolveLinks(body);
  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
  if (Number.isNaN(receivedAt.getTime())) throw badRequest('Validation failed', [{ path: 'receivedAt', message: 'Invalid date' }]);
  const receivedOn = body.receivedAt && /^\d{4}-\d{2}-\d{2}$/.test(body.receivedAt) ? body.receivedAt : await today(receivedAt);
  const d = await deadlines(receivedOn, body.complexity);
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('complaint', { db, date: receivedOn });
    const row = (await db.query(`INSERT INTO complaints(complaint_number, received_at, channel, complainant_name, complainant_contact, complainant_type, client_id, policy_id, claim_id,
        insurance_company_id, category, complexity, subject, description, amount_disputed, assigned_to, ack_due_on, resolution_due_on, documents, actions, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$21) RETURNING id`,
    [number, receivedAt, body.channel, body.complainantName, body.complainantContact || null, body.complainantType || 'client', links.client_id, links.policy_id, links.claim_id,
      links.insurance_company_id, body.category, body.complexity || 'simple', body.subject, body.description || null, body.amountDisputed ?? null, body.assignedTo || null,
      d.ackDueOn, d.resolutionDueOn, JSON.stringify(documentsIn(body.documents || [], user)), JSON.stringify([historyEntry('received', user, { channel: body.channel })]), user.id])).rows[0];
    return row.id;
  });
  const c = await complaintView(id);
  if (c.assignedTo && c.assignedTo !== user.id) await tellAssignee(c);
  return c;
}

async function tellAssignee(c) {
  await notify({ userId: c.assignedTo, type: 'task', title: `Complaint ${c.complaintNumber} assigned to you`,
    message: `${c.category}: ${c.subject}. Acknowledge by ${c.ackDueOn}, resolve by ${c.resolutionDueOn}.`, link: '/compliance/complaints', entity: 'complaint', entityId: c.id });
}

const EDITABLE = { channel: 'channel', complainantName: 'complainant_name', complainantContact: 'complainant_contact', complainantType: 'complainant_type', category: 'category',
  subject: 'subject', description: 'description', amountDisputed: 'amount_disputed', assignedTo: 'assigned_to' };

/** Edit an open complaint (details, links, assignment, complexity: the resolution deadline follows the complexity). */
export async function updateComplaint(id, body, user) {
  const before = await getComplaint(id);
  if (!OPEN.includes(before.status)) throw conflict(`A ${before.status} complaint cannot be changed`);
  await assertOption(channels, body.channel, 'channel');
  await assertOption(categories, body.category, 'category');
  const cols = {};
  for (const [k, c] of Object.entries(EDITABLE)) if (body[k] !== undefined) cols[c] = body[k] === '' ? null : body[k];
  if (['clientId', 'policyId', 'claimId', 'insuranceCompanyId'].some((k) => body[k] !== undefined)) Object.assign(cols, await resolveLinks(body, before));
  if (body.documents !== undefined) cols.documents = JSON.stringify(documentsIn(body.documents, user));
  if (body.complexity && body.complexity !== before.complexity) {
    cols.complexity = body.complexity;
    cols.resolution_due_on = (await deadlines(iso(before.received_at), body.complexity)).resolutionDueOn;
  }
  const changes = Object.keys(cols).filter((k) => k !== 'documents');
  const actions = [...(before.actions || []), historyEntry(body.assignedTo !== undefined && body.assignedTo !== before.assigned_to ? 'assigned' : 'updated', user, { fields: changes })];
  const all = { ...cols, actions: JSON.stringify(actions), updated_by: user.id, updated_at: new Date() };
  const keys = Object.keys(all);
  await query(`UPDATE complaints SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(all)]);
  const after = await complaintView(before.id);
  if (body.assignedTo && body.assignedTo !== before.assigned_to && body.assignedTo !== user.id) await tellAssignee(after);
  return { before: complaintApi(before, await today()), after };
}

/**
 * Status actions: acknowledge, start (in-progress), escalate (reason), resolve (outcome, resolution, redress),
 * refer (to the regulator: reference, date), close, reopen (a resolved complaint the complainant contests).
 */
export async function act(id, action, body, user) {
  const before = await getComplaint(id);
  const set = {};
  const now = new Date();
  const need = (cond, msg) => { if (!cond) throw conflict(msg); };
  switch (action) {
    case 'acknowledge':
      need(before.status === 'received', `Only a received complaint can be acknowledged (this one is ${before.status})`);
      Object.assign(set, { status: 'acknowledged', acknowledged_at: body.acknowledgedAt ? new Date(body.acknowledgedAt) : now, acknowledged_by: user.username || user.id });
      break;
    case 'start':
      need(['received', 'acknowledged'].includes(before.status), `A ${before.status} complaint cannot be started`);
      Object.assign(set, { status: 'in-progress' }, before.acknowledged_at ? {} : { acknowledged_at: now, acknowledged_by: user.username || user.id });
      break;
    case 'escalate':
      need(OPEN.includes(before.status), `A ${before.status} complaint cannot be escalated`);
      if (!body.reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason for the escalation' }]);
      Object.assign(set, { status: 'escalated', escalation_level: before.escalation_level + 1, escalated_at: now, escalation_reason: body.reason });
      break;
    case 'resolve':
      need(OPEN.includes(before.status), `A ${before.status} complaint cannot be resolved`);
      if (!OUTCOMES.includes(body.outcome)) throw badRequest('Validation failed', [{ path: 'outcome', message: `outcome must be one of ${OUTCOMES.join(', ')}` }]);
      if (!body.resolution) throw badRequest('Validation failed', [{ path: 'resolution', message: 'Describe the resolution given to the complainant' }]);
      Object.assign(set, { status: 'resolved', outcome: body.outcome, resolution: body.resolution, redress_amount: body.redressAmount ?? null, resolved_at: body.resolvedAt ? new Date(body.resolvedAt) : now,
        resolved_by: user.username || user.id }, before.acknowledged_at ? {} : { acknowledged_at: now, acknowledged_by: user.username || user.id });
      break;
    case 'refer':
      if (!body.regulatorReference) throw badRequest('Validation failed', [{ path: 'regulatorReference', message: 'Give the reference of the Insurance Commission' }]);
      Object.assign(set, { referred_to_regulator: true, regulator_reference: body.regulatorReference, referred_on: body.referredOn || await today() });
      break;
    case 'close':
      need(before.status === 'resolved', `Only a resolved complaint can be closed (this one is ${before.status})`);
      Object.assign(set, { status: 'closed', closed_at: now, closed_by: user.username || user.id });
      break;
    case 'reopen':
      need(['resolved', 'closed'].includes(before.status), `Only a resolved or closed complaint can be reopened (this one is ${before.status})`);
      if (!body.reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason for reopening' }]);
      Object.assign(set, { status: 'in-progress', resolved_at: null, resolved_by: null, outcome: null, closed_at: null, closed_by: null });
      break;
    default:
      throw badRequest(`Unknown action ${action}`);
  }
  const actions = [...(before.actions || []), historyEntry(action, user, Object.fromEntries(Object.entries({ reason: body.reason, outcome: body.outcome, reference: body.regulatorReference, notes: body.notes }).filter(([, v]) => v)))];
  const all = { ...set, actions: JSON.stringify(actions), updated_by: user.id, updated_at: now };
  const keys = Object.keys(all);
  await query(`UPDATE complaints SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [before.id, ...Object.values(all)]);
  const after = await complaintView(before.id);
  if (action === 'escalate') {
    await notify({ type: 'task', priority: 'high', title: `Complaint ${after.complaintNumber} escalated`, message: `${after.subject}: ${body.reason}`, link: '/compliance/complaints',
      entity: 'complaint', entityId: after.id, audience: 'approve:complaints' });
  }
  return { before: complaintApi(before, await today()), after };
}

/** Letter text: the setting with the complaint's placeholders filled. kind: acknowledgement | resolution. */
export async function letterSpec(id, kind) {
  const c = await complaintView(id);
  if (kind === 'resolution' && !['resolved', 'closed'].includes(c.status)) throw conflict('The resolution letter is printed once the complaint is resolved');
  const key = kind === 'resolution' ? 'complaints.resolution_letter_text' : 'complaints.ack_letter_text';
  const template = String((await getSetting(key, null)) || '');
  const vars = { complainantName: c.complainantName, complaintNumber: c.complaintNumber, receivedOn: c.receivedOn, subject: c.subject,
    assignedTo: c.assignedToName || 'Our complaints officer', resolutionDueOn: c.resolutionDueOn, resolution: c.resolution || '', outcome: (c.outcome || '').replace('-', ' ') };
  return {
    complaint: c,
    spec: {
      title: kind === 'resolution' ? 'Response to your complaint' : 'Acknowledgement of your complaint', number: c.complaintNumber,
      meta: [['Date', await today()], ['To', c.complainantName], ...(c.complainantContact ? [['Contact', c.complainantContact]] : []),
        ['Our reference', c.complaintNumber], ...(c.policyNumber ? [['Policy', c.policyNumber]] : []), ...(c.claimNumber ? [['Claim', c.claimNumber]] : [])],
      sections: [{ text: `Dear ${c.complainantName},` }, { text: renderTemplate(template, vars, { html: false }) }, { text: 'Sincerely,' },
        { signatures: [{ label: 'Complaints officer', name: c.assignedToName || null }], perRow: 2 }],
    },
  };
}

/** Regulator report: complaints received in a period, with counts by category, channel, status and outcome, and ageing. */
export async function regulatorReport(q = {}) {
  const now = await today();
  const from = q.from || `${now.slice(0, 4)}-01-01`;
  const to = q.to || now;
  const rows = (await many(`${SELECT} WHERE c.received_at >= $1::date AND c.received_at < ($2::date + interval '1 day') ORDER BY c.received_at`, [from, to])).map((r) => complaintApi(r, now));
  const count = (key) => Object.entries(rows.reduce((m, r) => ({ ...m, [r[key] || 'Not set']: (m[r[key] || 'Not set'] || 0) + 1 }), {})).map(([k, n]) => ({ value: k, count: n }));
  const resolved = rows.filter((r) => r.resolvedAt);
  const buckets = [['0 to 7 days', 0, 7], ['8 to 15 days', 8, 15], ['16 to 30 days', 16, 30], ['31 to 45 days', 31, 45], ['Over 45 days', 46, Infinity]];
  return {
    from, to, total: rows.length, resolved: resolved.length, open: rows.filter((r) => OPEN.includes(r.status)).length,
    resolvedWithinDeadline: resolved.filter((r) => r.resolvedWithinDeadline).length,
    averageResolutionDays: resolved.length ? Math.round((resolved.reduce((s, r) => s + r.ageDays, 0) / resolved.length) * 10) / 10 : null,
    referredToRegulator: rows.filter((r) => r.referredToRegulator).length,
    byCategory: count('category'), byChannel: count('channel'), byStatus: count('status'), byOutcome: count('outcome'),
    ageing: buckets.map(([label, lo, hi]) => ({ bucket: label, open: rows.filter((r) => OPEN.includes(r.status) && r.ageDays >= lo && r.ageDays <= hi).length,
      resolved: resolved.filter((r) => r.ageDays >= lo && r.ageDays <= hi).length })),
    items: rows,
  };
}

export function regulatorSheets(rep) {
  const two = (name, list, label) => ({ name, columns: [{ key: 'value', header: label, width: 40 }, { key: 'count', header: 'Complaints', type: 'integer', width: 12 }], rows: list });
  return [
    { name: 'Summary', columns: [{ key: 'k', header: 'Item', width: 50 }, { key: 'v', header: 'Value', width: 24 }], rows: [
      { k: 'Period', v: `${rep.from} to ${rep.to}` }, { k: 'Complaints received', v: rep.total }, { k: 'Resolved', v: rep.resolved }, { k: 'Still open', v: rep.open },
      { k: 'Resolved within the deadline', v: rep.resolvedWithinDeadline }, { k: 'Average days to resolve', v: rep.averageResolutionDays ?? '' },
      { k: 'Referred to the Insurance Commission', v: rep.referredToRegulator }] },
    two('By category', rep.byCategory, 'Category'), two('By channel', rep.byChannel, 'Channel'), two('By status', rep.byStatus, 'Status'), two('By outcome', rep.byOutcome, 'Outcome'),
    { name: 'Ageing', columns: [{ key: 'bucket', header: 'Days from receipt', width: 20 }, { key: 'open', header: 'Open', type: 'integer' }, { key: 'resolved', header: 'Resolved', type: 'integer' }], rows: rep.ageing },
    { name: 'Register', columns: [
      { key: 'complaintNumber', header: 'Reference', width: 16 }, { key: 'receivedOn', header: 'Received', type: 'date', width: 12 }, { key: 'channel', header: 'Channel', width: 16 },
      { key: 'complainantName', header: 'Complainant', width: 28 }, { key: 'complainantType', header: 'Complainant type', width: 14 }, { key: 'policyNumber', header: 'Policy', width: 18 },
      { key: 'claimNumber', header: 'Claim', width: 16 }, { key: 'insurerName', header: 'Insurer', width: 28 }, { key: 'category', header: 'Category', width: 26 },
      { key: 'complexity', header: 'Complexity', width: 10 }, { key: 'subject', header: 'Subject', width: 40 }, { key: 'status', header: 'Status', width: 12 },
      { key: 'ackDueOn', header: 'Acknowledge by', type: 'date', width: 12 }, { key: 'resolutionDueOn', header: 'Resolve by', type: 'date', width: 12 },
      { key: 'outcome', header: 'Outcome', width: 16 }, { key: 'ageDays', header: 'Age (days)', type: 'integer', width: 10 },
      { key: 'regulatorReference', header: 'IC reference', width: 16 }], rows: rep.items },
  ];
}

/** Daily job: reminders of deadlines due or passed, once a day per complaint and kind; automatic escalation. */
export async function complaintDeadlineRun(now) {
  const rows = (await many(`${SELECT} WHERE c.status = ANY($1::text[])`, [OPEN])).map((r) => complaintApi(r, now));
  const autoEscalate = (await getSetting('complaints.auto_escalate', true)) !== false;
  let reminded = 0;
  let escalated = 0;
  for (const c of rows) {
    const due = [];
    if (!c.acknowledgedAt && c.ackDueOn <= now) due.push(['acknowledge', `acknowledge by ${c.ackDueOn}`]);
    if (c.resolutionDueOn <= now) due.push(['resolve', `resolve by ${c.resolutionDueOn}`]);
    for (const [kind, text] of due) {
      const ins = await one('INSERT INTO complaint_reminders(complaint_id, kind, sent_on) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING complaint_id', [c.id, kind, now]);
      if (!ins) continue;
      await notify({ ...(c.assignedTo ? { userId: c.assignedTo } : { audience: 'write:complaints' }), type: 'reminder', priority: 'high',
        title: `Complaint ${c.complaintNumber}: ${kind === 'acknowledge' ? 'acknowledgement' : 'resolution'} due`, message: `${c.subject}: ${text}.`,
        link: '/compliance/complaints', entity: 'complaint', entityId: c.id });
      reminded += 1;
    }
    if (autoEscalate && c.resolutionOverdue && c.status !== 'escalated') {
      const system = { id: null, username: 'system' };
      await act(c.id, 'escalate', { reason: `Resolution overdue since ${c.resolutionDueOn}` }, system);
      escalated += 1;
    }
  }
  return { open: rows.length, reminded, escalated };
}
