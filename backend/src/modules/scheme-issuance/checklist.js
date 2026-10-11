/**
 * The document checklist of a scheme application (TIS-BRD-SCHM-01, FRS FR-SIS-010 to 014).
 *
 * buildChecklist copies the active records of the Scheme Document Checklist master (type scheme-document-checklist)
 * whose scheme type, KYC source and condition match the application; a rebuild after a change adds the new items,
 * removes the Pending ones that no longer apply and keeps a Received one as optional. Each item is Received by an
 * upload (file type by content, at most schemes.max_document_mb) or by hand with a remark (never a KYC item), Reopened
 * with a remark, or Waived under maker-checker: the maker requests the waiver of an item the master allows to be
 * waived and a second user holding approve:scheme-issuance approves (Waived) or rejects it (Pending). The gate counts
 * the required items not Received or Waived: an application goes to the insurer only at zero.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { activeRecords } from '../ops-masters/records.js';
import { storeFile } from '../uploads/storage.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';

export const ITEM_LABELS = { pending: 'Pending', received: 'Received', 'waiver-requested': 'Waiver requested', waived: 'Waived' };
const on = (v) => v === true || ['true', 'yes', '1'].includes(String(v ?? '').toLowerCase());
const fail = (path, message, code = null) => badRequest(message, [{ path, message, ...(code ? { code } : {}) }]);

/** Gate of a checklist (FR-SIS-014): required items not Received or Waived (a Waiver requested item still blocks). */
export function gateOf(items) {
  const missing = items.filter((i) => i.required && !['received', 'waived'].includes(i.status));
  return { missing: missing.length, documents: missing.map((i) => i.document), required: items.filter((i) => i.required).length,
    in: items.filter((i) => i.required && ['received', 'waived'].includes(i.status)).length };
}

/** The records of the master that apply to an application: scheme type, KYC source and condition (FR-SIS-011). */
export async function applicableRecords(db, { type, kycSource, borrower = {}, araMode = null, release = null }) {
  const rows = await activeRecords(db, 'scheme-document-checklist');
  const minor = Number(await getSetting('policy.kyc_minor_age', 21)) || 21;
  const { ageOn } = await import('./service.js');
  const age = ageOn(borrower.birthday, release);
  const foreign = borrower.nationality && !/^(filipino|philippine|philippines|ph)$/i.test(String(borrower.nationality).trim());
  const typeLabel = type === 'scheme1' ? 'Scheme 1' : type === 'scheme2' ? 'Scheme 2' : null;
  const kycLabel = kycSource === 'full' ? 'Full KYC' : 'TFSPH';
  return rows.filter((r) => {
    if (r.schemeType && r.schemeType !== '*' && r.schemeType !== typeLabel) return false;
    if (r.kycSource && r.kycSource !== '*' && r.kycSource !== kycLabel) return false;
    const c = r.condition || 'Always';
    if (c === 'Non-Filipino borrower') return !!foreign;
    if (c === 'Borrower 21 or younger') return age !== null && age <= minor;
    if (c === 'ARA payment by ADA') return type === 'scheme1' && araMode === 'ADA';
    return true;
  }).sort((a, b) => Number(a.sortOrder ?? 100) - Number(b.sortOrder ?? 100));
}

/** Build or rebuild the checklist of an application (inside the caller's transaction). */
export async function buildChecklist(db, applicationId, facts) {
  const records = await applicableRecords(db, facts);
  const codes = new Set(records.map((r) => String(r.code).toUpperCase()));
  const items = (await db.query('SELECT * FROM scheme_checklist_items WHERE application_id = $1', [applicationId])).rows;
  for (const r of records) {
    const kyc = on(r.kycItem);
    const have = items.find((i) => i.code.toUpperCase() === String(r.code).toUpperCase());
    if (have) {
      // a record kept on the application keeps its status; its terms follow the master while it is pending
      if (have.status === 'pending') await db.query('UPDATE scheme_checklist_items SET document = $2, kyc = $3, required = $4, can_waive = $5, sort_order = $6, updated_at = now() WHERE id = $1',
        [have.id, r.documentName, kyc, r.required === undefined ? true : on(r.required), on(r.canWaive) && !kyc, Number(r.sortOrder ?? 100)]);
      else if (!have.required && on(r.required) && have.status !== 'pending') await db.query('UPDATE scheme_checklist_items SET required = true WHERE id = $1', [have.id]);
      continue;
    }
    await db.query(`INSERT INTO scheme_checklist_items(application_id, code, document, kyc, required, can_waive, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (application_id, code) DO NOTHING`, [applicationId, String(r.code).toUpperCase(), r.documentName, kyc, r.required === undefined ? true : on(r.required),
      on(r.canWaive) && !kyc, Number(r.sortOrder ?? 100)]);
  }
  for (const i of items.filter((x) => !x.added && !codes.has(x.code.toUpperCase()))) {
    if (i.status === 'pending') await db.query('DELETE FROM scheme_checklist_items WHERE id = $1', [i.id]);
    else await db.query('UPDATE scheme_checklist_items SET required = false, updated_at = now() WHERE id = $1', [i.id]);
  }
}

const toItem = (r) => ({
  id: Number(r.id), code: r.code, document: r.document, kyc: r.kyc, required: r.required, canWaive: r.can_waive, added: r.added, sortOrder: r.sort_order,
  status: r.status, statusLabel: ITEM_LABELS[r.status], fileKey: r.file_key, fileName: r.file_name, receivedAt: r.received_at, receivedBy: r.received_by_name || r.received_by,
  remark: r.remark, waiverReason: r.waiver_reason, waiverRequestedBy: r.waiver_requested_by_name || r.waiver_requested_by, waiverRequestedById: r.waiver_requested_by,
  waiverRequestedAt: r.waiver_requested_at, waiverDecidedBy: r.waiver_decided_by_name || r.waiver_decided_by, waiverDecidedAt: r.waiver_decided_at, waiverNote: r.waiver_note,
});
const ITEM_SELECT = `SELECT i.*, ru.display_name AS received_by_name, wu.display_name AS waiver_requested_by_name, du.display_name AS waiver_decided_by_name
  FROM scheme_checklist_items i LEFT JOIN users ru ON ru.id = i.received_by LEFT JOIN users wu ON wu.id = i.waiver_requested_by LEFT JOIN users du ON du.id = i.waiver_decided_by`;

export async function listItems(applicationId) {
  return (await many(`${ITEM_SELECT} WHERE i.application_id = $1 ORDER BY i.sort_order, i.id`, [applicationId])).map(toItem);
}

/** The application and one of its items, locked; refused once the application left the open statuses. */
async function itemFor(db, applicationId, itemId, { allowSent = false } = {}) {
  const a = (await db.query('SELECT * FROM scheme_applications WHERE id = $1 OR application_number = $1 FOR UPDATE', [String(applicationId)])).rows[0];
  if (!a) throw notFound('Scheme application not found');
  const open = ['documents-pending', 'ready', 'declined', ...(allowSent ? ['sent'] : [])];
  if (a.status === 'draft') throw conflict(`Application ${a.application_number} is a Draft: complete it first (${(a.problems || []).map((p) => p.message).join('; ') || 'missing data'})`);
  if (!open.includes(a.status)) throw conflict(`Application ${a.application_number} is ${a.status === 'sent' ? 'with the insurer' : a.status}: its checklist is read-only`);
  const item = (await db.query('SELECT * FROM scheme_checklist_items WHERE id = $1 AND application_id = $2 FOR UPDATE', [Number(itemId), a.id])).rows[0];
  if (!item) throw notFound('Checklist item not found');
  return { a, item };
}

async function afterChange(db, a) {
  const { settle } = await import('./service.js');
  return settle(db, a.id, a.problems || []);
}

/** Upload the file of an item: stored against the application, the item Received with today's date (FR-SIS-011). */
export async function uploadItem(applicationId, itemId, file, user) {
  if (!file?.buffer?.length) throw fail('file', 'file is required');
  const maxMb = Number(await getSetting('schemes.max_document_mb', 10));
  if (file.size > maxMb * 1024 * 1024) throw fail('file', `The file is larger than ${maxMb} MB`);
  // PDF, JPEG or PNG by content (MSG-SIS-027), whatever the file name says
  const head = file.buffer.subarray(0, 8);
  const isPdf = head.subarray(0, 4).toString('latin1') === '%PDF';
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPdf && !isJpeg && !isPng) throw fail('file', 'This file type is not accepted. Upload a PDF, JPEG or PNG file', 'MSG-SIS-027');
  const pre = await withTransaction((db) => itemFor(db, applicationId, itemId));
  let stored;
  try {
    stored = await storeFile(file, { folder: 'scheme-applications', userId: user.id, entity: 'scheme_application', entityId: pre.a.id });
  } catch (e) {
    if (e.status === 400 || e.statusCode === 400) throw fail('file', 'This file type is not accepted. Upload a PDF, JPEG or PNG file', 'MSG-SIS-027');
    throw e;
  }
  return withTransaction(async (db) => {
    const { a, item } = await itemFor(db, applicationId, itemId);
    await db.query(`UPDATE scheme_checklist_items SET status = 'received', file_key = $2, file_name = $3, received_at = now(), received_by = $4, updated_at = now() WHERE id = $1`,
      [item.id, stored.key, stored.fileName, user.id]);
    await db.query("UPDATE documents SET category = $2 WHERE storage_key = $1", [stored.key, item.document]);
    const status = await afterChange(db, a);
    return { before: { status: item.status }, item: toItem({ ...item, status: 'received', file_key: stored.key, file_name: stored.fileName }), status, message: `${item.document} received` };
  });
}

/** Mark an item Received without a file (a paper original on file): remark required; never a KYC item (FR-SIS-011 R2). */
export async function receiveItem(applicationId, itemId, { remark }, user) {
  return withTransaction(async (db) => {
    const { a, item } = await itemFor(db, applicationId, itemId);
    if (item.kyc) throw fail('file', 'A KYC document must be uploaded', 'MSG-SIS-029');
    if (!String(remark || '').trim()) throw fail('remark', 'Remark is required when no file is uploaded', 'MSG-SIS-028');
    await db.query("UPDATE scheme_checklist_items SET status = 'received', remark = $2, received_at = now(), received_by = $3, updated_at = now() WHERE id = $1", [item.id, String(remark).trim(), user.id]);
    const status = await afterChange(db, a);
    return { before: { status: item.status }, status, message: `${item.document} received` };
  });
}

/** Reopen a Received or Waived item with a remark: back to Pending (a Ready application goes back to Documents pending). */
export async function reopenItem(applicationId, itemId, { remark }, user) {
  return withTransaction(async (db) => {
    const { a, item } = await itemFor(db, applicationId, itemId);
    if (!['received', 'waived'].includes(item.status)) throw conflict(`${item.document} is ${ITEM_LABELS[item.status]}: only a received or waived document is reopened`);
    if (!String(remark || '').trim()) throw fail('remark', 'Remark is required');
    await db.query("UPDATE scheme_checklist_items SET status = 'pending', remark = $2, received_at = NULL, received_by = NULL, updated_at = now() WHERE id = $1", [item.id, String(remark).trim()]);
    const status = await afterChange(db, a);
    return { before: { status: item.status }, status, message: `${item.document} reopened`, by: user.id };
  });
}

/** Add a document the master does not list (optional unless required is ticked). */
export async function addItem(applicationId, { document, required = false }, user) {
  return withTransaction(async (db) => {
    const a = (await db.query('SELECT * FROM scheme_applications WHERE id = $1 OR application_number = $1 FOR UPDATE', [String(applicationId)])).rows[0];
    if (!a) throw notFound('Scheme application not found');
    if (!['draft', 'documents-pending', 'ready', 'declined'].includes(a.status)) throw conflict(`Application ${a.application_number} is with the insurer or closed: its checklist is read-only`);
    const name = String(document || '').trim();
    if (!name) throw fail('document', 'Document is required', 'MSG-SIS-025');
    const n = (await db.query("SELECT count(*)::int AS n FROM scheme_checklist_items WHERE application_id = $1 AND added", [a.id])).rows[0].n + 1;
    const r = (await db.query(`INSERT INTO scheme_checklist_items(application_id, code, document, required, added, sort_order) VALUES ($1,$2,$3,$4,true,900) RETURNING *`,
      [a.id, `ADD-${n}`, name, required === true])).rows[0];
    await afterChange(db, a);
    return { item: toItem(r), by: user.id };
  });
}

/** Request the waiver of a Pending item the master allows to be waived, with the reason (FR-SIS-013). */
export async function requestWaiver(applicationId, itemId, { reason }, user) {
  const out = await withTransaction(async (db) => {
    const { a, item } = await itemFor(db, applicationId, itemId);
    if (item.status !== 'pending') throw conflict(`${item.document} is ${ITEM_LABELS[item.status]}: only a pending document is waived`);
    if (!item.can_waive || item.kyc) throw fail('itemId', `${item.document} cannot be waived`, 'MSG-SIS-035');
    if (!String(reason || '').trim()) throw fail('reason', 'Reason is required', 'MSG-SIS-036');
    await db.query(`UPDATE scheme_checklist_items SET status = 'waiver-requested', waiver_reason = $2, waiver_requested_by = $3, waiver_requested_at = now(), waiver_decided_by = NULL,
      waiver_decided_at = NULL, waiver_note = NULL, updated_at = now() WHERE id = $1`, [item.id, String(reason).trim(), user.id]);
    return { a, item };
  });
  await notifyApprovers({ audience: 'approve:scheme-issuance', document: 'Checklist waiver', number: out.a.application_number, by: user.username,
    detail: `${out.item.document}: ${reason}`, link: `/sales/scheme-issuance/${out.a.id}`, entity: 'scheme_application', entityId: out.a.id });
  return { before: { status: 'pending' }, status: out.a.status, message: `Waiver of ${out.item.document} requested` };
}

/**
 * Approve (Waived, counts as in for the gate) or reject with a remark (Pending) a waiver: approve:scheme-issuance, never
 * the user who requested it (FR-SIS-013 R2).
 */
export async function decideWaiver(applicationId, itemId, { decision, note = null }, user) {
  if (!['approve', 'reject'].includes(decision)) throw badRequest('decision must be approve or reject');
  if (!hasPermission(user, 'approve:scheme-issuance')) throw forbidden('You do not have permission to approve a waiver');
  const out = await withTransaction(async (db) => {
    const { a, item } = await itemFor(db, applicationId, itemId);
    if (item.status !== 'waiver-requested') throw conflict(`${item.document} has no waiver waiting for a decision`);
    if (item.waiver_requested_by === user.id) throw forbidden('Maker-checker: the approver must be different from the user who requested the waiver');
    if (decision === 'reject' && !String(note || '').trim()) throw fail('note', 'Reason is required', 'MSG-SIS-036');
    await db.query(`UPDATE scheme_checklist_items SET status = $2, waiver_decided_by = $3, waiver_decided_at = now(), waiver_note = $4, updated_at = now() WHERE id = $1`,
      [item.id, decision === 'approve' ? 'waived' : 'pending', user.id, String(note || '').trim() || null]);
    const status = await afterChange(db, a);
    return { a, item, status };
  });
  await notifyDecision({ userId: out.item.waiver_requested_by, decidedBy: user.id, document: 'Checklist waiver', number: `${out.a.application_number} - ${out.item.document}`,
    approved: decision === 'approve', status: decision === 'approve' ? 'approved' : 'rejected', by: user.username, reason: note || null, link: `/sales/scheme-issuance/${out.a.id}`,
    entity: 'scheme_application', entityId: out.a.id });
  return { before: { status: 'waiver-requested' }, status: out.status, message: `Waiver of ${out.item.document} ${decision === 'approve' ? 'approved' : 'rejected'}` };
}

/** Pending waivers for My Work (one item per waiver). */
export const pendingWaivers = () => many(`SELECT i.id, i.document, i.waiver_reason, i.waiver_requested_by, i.waiver_requested_at, a.id AS application_id, a.application_number
  FROM scheme_checklist_items i JOIN scheme_applications a ON a.id = i.application_id WHERE i.status = 'waiver-requested' ORDER BY i.waiver_requested_at`);

export { one, query };
