/**
 * Claim document checklist: the Documents step of a claim and the work queue Operations > Claims Awaiting Documents.
 *
 * The documents a claim needs come from the checklist master (claim-document-requirement: line of business and claim
 * type, * for any, required or optional). A claim type of the master applies when it is the claim's type or names the
 * cause of loss ("Theft", "Third Party", "Death"; several separated by ";"). They are copied onto the claim the first
 * time its checklist is opened; documents added
 * to the master later are added to open claims, nothing is removed (an item that does not apply is waived with a
 * reason). An uploaded claim document whose name matches an item marks it received. A reminder lists the missing
 * documents to the claimant (e-mail template claim_missing_documents), by hand or every claims.document_reminder_days
 * days (job claim-document-reminders). A claim is submitted to the insurer only when every required document is in
 * (claims.require_documents_before_submission).
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { queueEmail } from '../../lib/mailer.js';
import { companyName } from '../../lib/letterhead.js';
import { notify } from '../notifications/service.js';
import { emailTemplate, renderTemplate } from '../documents/common.js';
import { activeRecords } from '../ops-masters/records.js';
import { scopeSql } from '../../lib/scope.js';

const esc = (v) => String(v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const matches = (rule, value) => !rule || rule === '*' || String(rule).trim().toLowerCase() === String(value || '').trim().toLowerCase();
const escRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A claim-type rule: * (any), or types separated by ";", each the claim type or words of the cause of loss. */
const typeMatches = (rule, claimType, cause) => {
  if (!rule || String(rule).trim() === '*') return true;
  return String(rule).split(';').map((x) => x.trim()).filter(Boolean)
    .some((x) => matches(x, claimType) || (cause && new RegExp(`\\b${escRe(x)}\\b`, 'i').test(String(cause))));
};

async function loadClaim(db, ref) {
  const c = (await db.query(`SELECT c.*, p.policy_number, p.lob AS policy_lob, pr.line AS product_line, cl.display_name AS client_name, cl.email AS client_email
    FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
    WHERE c.id = $1 OR c.claim_number = $1`, [String(ref)])).rows[0];
  if (!c) throw notFound('Claim not found');
  return c;
}

/** Checklist master rows that apply to a line of business, claim type and cause of loss. */
export async function requirementsFor(db, lob, claimType, cause = null) {
  return (await activeRecords(db, 'claim-document-requirement'))
    .filter((r) => matches(r.lineOfBusiness, lob) && typeMatches(r.claimType, claimType, cause))
    .map((r) => ({ code: r.code, documentName: r.documentName || r.name, required: r.required !== false, sortOrder: Number(r.sortOrder) || 100 }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Copy the applicable master documents onto the claim (missing ones only) and mark uploaded documents received. */
async function syncChecklist(db, c) {
  const lob = c.lob || c.policy_lob || c.product_line;
  for (const r of await requirementsFor(db, lob, c.claim_type, c.loss_type)) {
    await db.query(`INSERT INTO claim_document_items(claim_id, requirement_code, document_name, required, sort_order) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (claim_id, document_name) DO NOTHING`, [c.id, r.code, r.documentName, r.required, r.sortOrder]);
  }
  await db.query(`UPDATE claim_document_items i SET status = 'received', received_on = COALESCE(i.received_on, d.created_at::date), document_id = d.id, updated_at = now()
    FROM documents d WHERE i.claim_id = $1 AND i.status = 'pending' AND d.entity = 'claim' AND d.entity_id = $1 AND d.status = 'uploaded'
      AND lower(d.category) = lower(i.document_name)`, [c.id]);
}

const itemOut = (i) => ({ id: Number(i.id), requirementCode: i.requirement_code, documentName: i.document_name, required: i.required, status: i.status,
  receivedOn: isoDate(i.received_on), documentId: i.document_id, fileName: i.file_name || null, waiveReason: i.waive_reason, sortOrder: i.sort_order,
  updatedBy: i.updated_by_name || i.updated_by, updatedAt: i.updated_at });

/** The claim's checklist with what is missing and the reminders sent. */
export async function checklist(db, ref) {
  const c = await loadClaim(db, ref);
  await syncChecklist(db, c);
  const items = (await db.query(`SELECT i.*, d.file_name, (SELECT u.display_name FROM users u WHERE u.id = i.updated_by) AS updated_by_name FROM claim_document_items i
    LEFT JOIN documents d ON d.id = i.document_id WHERE i.claim_id = $1 ORDER BY i.sort_order, i.id`, [c.id])).rows.map(itemOut);
  const reminders = (await db.query(`SELECT r.*, (SELECT u.display_name FROM users u WHERE u.id = r.created_by) AS by_name FROM claim_document_reminders r WHERE claim_id = $1
    ORDER BY created_at DESC LIMIT 20`, [c.id])).rows.map((r) => ({ id: Number(r.id), to: r.recipient_email, missing: r.missing, automatic: r.automatic, by: r.by_name || r.created_by, at: r.created_at }));
  const missingRequired = items.filter((i) => i.required && i.status === 'pending');
  return {
    claimId: c.id, claimNumber: c.claim_number, policyNumber: c.policy_number, claimType: c.claim_type, lossCause: c.loss_type, lob: c.lob || c.policy_lob, status: c.status, claimantName: c.client_name,
    claimantEmail: c.client_email, submittedToInsurerAt: c.submitted_to_insurer_at, submittedToInsurerBy: c.submitted_to_insurer_by,
    requireComplete: (await getSetting('claims.require_documents_before_submission', true)) !== false,
    summary: { total: items.length, required: items.filter((i) => i.required).length, received: items.filter((i) => i.status === 'received').length,
      receivedRequired: items.filter((i) => i.required && i.status !== 'pending').length, missingRequired: missingRequired.length,
      missingOptional: items.filter((i) => !i.required && i.status === 'pending').length, complete: missingRequired.length === 0 },
    items, reminders,
  };
}

/**
 * Work queue: open claims (claims.open_statuses) whose claim file has not gone to the insurer yet, with how many required
 * documents are in, what is missing and the last reminder; `stage` missing (required documents outstanding), ready (all
 * in, to submit) or all. `scope` limits the claims to a scoped user's book.
 */
export async function awaiting(db, { stage = 'missing', search = '', scope = null } = {}) {
  const open = (await getSetting('claims.open_statuses', ['registered', 'in-review', 'pending-approval', 'approved'])) || [];
  const params = [open];
  const own = scopeSql(scope, 'claim', 'c', params);
  const claims = (await db.query(`SELECT c.*, p.policy_number, p.lob AS policy_lob, pr.line AS product_line, cl.display_name AS client_name
    FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
    WHERE c.status = ANY($1) AND c.submitted_to_insurer_at IS NULL AND ${own} ORDER BY c.created_at`, params)).rows;
  for (const c of claims) await syncChecklist(db, c);
  const counts = new Map((await db.query(`SELECT claim_id, count(*) FILTER (WHERE required)::int AS required,
      count(*) FILTER (WHERE required AND status <> 'pending')::int AS received, count(*) FILTER (WHERE required AND status = 'pending')::int AS missing,
      (SELECT max(r.created_at) FROM claim_document_reminders r WHERE r.claim_id = i.claim_id) AS last_reminder
    FROM claim_document_items i WHERE claim_id = ANY($1) GROUP BY claim_id`, [claims.map((c) => c.id)])).rows.map((r) => [r.claim_id, r]));
  const todayStr = await today();
  const q = String(search || '').trim().toLowerCase();
  const rows = claims.map((c) => {
    const n = counts.get(c.id) || { required: 0, received: 0, missing: 0, last_reminder: null };
    return { claimId: c.id, claimNumber: c.claim_number, policyNumber: c.policy_number, claimant: c.client_name, lob: c.lob || c.policy_lob || c.product_line,
      lossCause: c.loss_type, status: c.status, reportedDate: isoDate(c.reported_date || c.created_at),
      daysOpen: Math.max(0, Math.round((Date.parse(todayStr) - Date.parse(isoDate(c.reported_date || c.created_at))) / 86400000)),
      required: n.required, received: n.received, missing: n.missing, lastReminderAt: n.last_reminder, complete: n.missing === 0 };
  }).filter((r) => !q || [r.claimNumber, r.policyNumber, r.claimant].some((v) => String(v || '').toLowerCase().includes(q)));
  const summary = { missing: rows.filter((r) => !r.complete).length, ready: rows.filter((r) => r.complete).length,
    documentsMissing: rows.reduce((s, r) => s + r.missing, 0), notReminded: rows.filter((r) => !r.complete && !r.lastReminderAt).length };
  const shown = stage === 'all' ? rows : rows.filter((r) => (stage === 'ready' ? r.complete : !r.complete));
  return { summary, rows: shown.sort((a, b) => b.missing - a.missing || b.daysOpen - a.daysOpen) };
}

/** Change an item: status received (receivedOn, documentId) | waived (waiveReason) | pending, or required. */
export async function updateItem(db, ref, itemId, b, user) {
  const c = await loadClaim(db, ref);
  const item = (await db.query('SELECT * FROM claim_document_items WHERE id = $1 AND claim_id = $2 FOR UPDATE', [Number(itemId), c.id])).rows[0];
  if (!item) throw notFound('Checklist item not found');
  const status = b.status || item.status;
  if (status === 'waived' && !String(b.waiveReason || item.waive_reason || '').trim()) throw badRequest('Validation failed', [{ path: 'waiveReason', message: 'Say why the document is not needed' }]);
  await db.query(`UPDATE claim_document_items SET status = $3, received_on = CASE WHEN $3 = 'received' THEN COALESCE($4::date, received_on, $7::date) ELSE NULL END,
      document_id = CASE WHEN $3 = 'received' THEN COALESCE($5, document_id) ELSE document_id END, waive_reason = CASE WHEN $3 = 'waived' THEN COALESCE($6, waive_reason) ELSE NULL END,
      required = COALESCE($8, required), updated_by = $9, updated_at = now() WHERE id = $1 AND claim_id = $2`,
  [item.id, c.id, status, isoDate(b.receivedOn), b.documentId || null, b.waiveReason || null, await today(), typeof b.required === 'boolean' ? b.required : null, user?.id ?? null]);
  return { before: itemOut(item), after: (await checklist(db, c.id)).items.find((i) => i.id === Number(item.id)) };
}

/** A document the claim needs that the master does not list. */
export async function addItem(db, ref, b, user) {
  const c = await loadClaim(db, ref);
  const name = String(b.documentName || '').trim();
  if (!name) throw badRequest('Validation failed', [{ path: 'documentName', message: 'Name the document' }]);
  const r = await db.query(`INSERT INTO claim_document_items(claim_id, document_name, required, sort_order, updated_by) VALUES ($1,$2,$3,900,$4)
    ON CONFLICT (claim_id, document_name) DO NOTHING RETURNING id`, [c.id, name, b.required !== false, user?.id ?? null]);
  if (!r.rowCount) throw conflict(`"${name}" is already on the checklist`);
  return (await checklist(db, c.id)).items.find((i) => i.id === Number(r.rows[0].id));
}

/** E-mail the claimant the documents still missing (required first) and log it. */
export async function remind(db, ref, b = {}, user = null, { automatic = false } = {}) {
  const list = await checklist(db, ref);
  const missing = list.items.filter((i) => i.status === 'pending').sort((a, b2) => Number(b2.required) - Number(a.required));
  if (!missing.length) throw conflict(`Every document of claim ${list.claimNumber} is in`);
  const to = b.to || list.claimantEmail;
  if (!to) throw badRequest('Validation failed', [{ path: 'to', message: 'The claimant has no e-mail address; enter one' }]);
  const t = await emailTemplate('claim_missing_documents');
  // the list is HTML of its own: rendered after the placeholders (which are escaped)
  const TOKEN = 'MISSINGLISTTOKEN';
  const v = { claimantName: list.claimantName || '', claimNumber: list.claimNumber, policyNumber: list.policyNumber, companyName: await companyName(), missingList: TOKEN };
  const items = missing.map((m) => `<li>${esc(m.documentName)}${m.required ? '' : ' (if available)'}</li>`).join('');
  const emailId = await queueEmail({ db, to, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v).replace(TOKEN, items),
    template: 'claim_missing_documents', entity: 'claim', entityId: list.claimId });
  await db.query('INSERT INTO claim_document_reminders(claim_id, recipient_email, missing, email_id, automatic, created_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [list.claimId, to, JSON.stringify(missing.map((m) => m.documentName)), String(emailId), automatic, user?.id ?? null]);
  return { emailId, to, missing: missing.map((m) => m.documentName) };
}

/** Record that the claim file went to the insurer; refused while a required document is missing (setting). */
export async function submitToInsurer(db, ref, b, user) {
  const list = await checklist(db, ref);
  if (list.submittedToInsurerAt) throw conflict(`Claim ${list.claimNumber} was already submitted to the insurer`);
  if (['rejected', 'closed'].includes(list.status)) throw conflict(`Claim ${list.claimNumber} is ${list.status}`);
  const missing = list.items.filter((i) => i.required && i.status === 'pending');
  if (list.requireComplete && missing.length) {
    throw conflict(`Claim ${list.claimNumber} cannot be submitted to the insurer: required documents missing (${missing.map((m) => m.documentName).join('; ')})`);
  }
  await db.query('UPDATE claims SET submitted_to_insurer_at = now(), submitted_to_insurer_by = $2, updated_at = now() WHERE id = $1', [list.claimId, user?.username ?? user?.id ?? null]);
  await db.query('INSERT INTO claim_history(claim_id, by_user, status, note) VALUES ($1,$2,$3,$4)', [list.claimId, user?.username ?? null, list.status,
    `Claim file submitted to the insurer${b.reference ? ` (${b.reference})` : ''}${missing.length ? `; ${missing.length} required document(s) to follow` : ''}${b.note ? `: ${b.note}` : ''}`]);
  return checklist(db, list.claimId);
}

/** Daily job: remind claimants of open claims with required documents missing, every claims.document_reminder_days days. */
export async function reminderJob(db) {
  const every = Number(await getSetting('claims.document_reminder_days', 3)) || 0;
  if (every <= 0) return { skipped: 'claims.document_reminder_days is 0' };
  const open = (await getSetting('claims.open_statuses', ['registered', 'in-review', 'pending-approval', 'approved'])) || [];
  const due = (await db.query(`SELECT c.id FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
    WHERE c.status = ANY($1) AND cl.email IS NOT NULL AND cl.email <> ''
      AND EXISTS (SELECT 1 FROM claim_document_items i WHERE i.claim_id = c.id AND i.required AND i.status = 'pending')
      AND COALESCE((SELECT max(r.created_at) FROM claim_document_reminders r WHERE r.claim_id = c.id), c.created_at) < now() - ($2::int * interval '1 day')`, [open, every])).rows;
  let sent = 0;
  for (const c of due) {
    await remind(db, c.id, {}, null, { automatic: true });
    sent += 1;
  }
  if (sent) await notify({ type: 'info', title: `${sent} missing-document reminder(s) sent`, message: `Claimants of ${sent} open claim(s) were reminded of the documents still missing.`, audience: 'write:claims', link: '/operations/claim-documents' });
  return { reminders: sent };
}
