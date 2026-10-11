/**
 * Motor issuance checklist (TIS-BRD-ISSUE-01, TIS-BRD-KYC-03; TISPH decision of 11 Oct 2026, GAP-QUOTE-23; migration
 * 0688). The documents to have on file before a Motor placement slip is booked, from the Motor Issuance Checklist master
 * (type motor-issuance-checklist): each record applies by the vehicle (brand new or used), the insured (individual or
 * corporate), the financing and a condition (always, a used vehicle older than the minimum age, a transfer of
 * insurance, CTPL included). buildChecklist copies the records that apply to the slip; a later change of the slip or
 * the master adds the new ones, removes the pending ones that no longer apply and keeps a received or waived one as
 * optional. An item is received with an uploaded file (documentKey from /s3/upload) or a remark, reopened with a
 * remark, or waived under maker-checker: requested with the reason, approved or rejected by a user holding
 * approve:policies who did not request it. A record with a KYC document type is met by that document on the client's
 * KYC file. The gate counts the mandatory items neither received, waived nor on file: with
 * placement.issuance_checklist_mode block the booking is refused, with warn it goes ahead naming them, off skips it.
 * A scheme application slip has its own checklist (Scheme Issuance).
 */
import { many, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';
import { activeRecords } from '../ops-masters/records.js';
import { findDocument } from '../uploads/storage.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';

export const MASTER = 'motor-issuance-checklist';
export const ITEM_LABELS = { pending: 'Pending', received: 'Received', 'waiver-requested': 'Waiver requested', waived: 'Waived' };
const MODES = ['block', 'warn', 'off'];
const CLOSED = ['issued', 'cancelled'];
const on = (v) => v === true || ['true', 'yes', '1'].includes(String(v ?? '').toLowerCase());
const blank = (v) => !String(v ?? '').trim();
const fail = (path, message) => badRequest('Validation failed', [{ path, message }]);

/** placement.issuance_checklist_mode: block (delivered), warn or off. */
export async function checklistMode() {
  const v = String(await getSetting('placement.issuance_checklist_mode', 'block') || 'block').toLowerCase();
  return MODES.includes(v) ? v : 'block';
}
/** Does the checklist apply to the placement row (Motor, not a scheme slip)? */
export const appliesTo = (p) => String(p.lob || '').toUpperCase() === 'MOTOR' && p.source !== 'scheme';

/** The facts the master records are matched on: vehicle condition and age, insured type, financing, transfer, CTPL. */
export async function factsOf(p, db = { query }) {
  const quote = p.quote_id ? (await db.query('SELECT doc FROM quotes WHERE id = $1', [p.quote_id])).rows[0]?.doc || {} : {};
  const doc = { ...quote, ...(p.doc || {}) };
  const vehicle = { ...(quote.insuranceVehicleDetails?.[0] || {}), ...(p.doc?.insuranceVehicleDetails?.[0] || {}), ...(doc.riskDetails || {}) };
  const year = Number(String(await today()).slice(0, 4));
  const modelYear = Number(vehicle.modelYear || vehicle.yearOfManufacture || doc.modelYear) || null;
  const condition = String(doc.vehicleCondition || vehicle.vehicleCondition || '');
  let brandNew;
  if (condition) brandNew = /new/i.test(condition) && !/used/i.test(condition);
  else if (doc.brandNew === true || doc.brandNew === false) brandNew = doc.brandNew;
  else brandNew = modelYear ? modelYear >= year : false;
  const client = p.client_id ? (await db.query('SELECT client_type, lead_category, company_name FROM clients WHERE id = $1', [p.client_id])).rows[0] : null;
  const lead = p.lead_id ? (await db.query('SELECT lead_category, company_name, loan_id FROM leads WHERE id = $1', [p.lead_id])).rows[0] : null;
  const corporate = /corporate|juridical/i.test(String(client?.client_type || '')) || /corporate/i.test(String(client?.lead_category || lead?.lead_category || ''));
  const financed = Boolean(doc.mortgage || doc.mortgagee || doc.mortgageeChannelId || doc.loanAccount || doc.financingBank || doc.bankName || lead?.loan_id);
  const transfer = doc.transferOfInsurance === true || /transfer/i.test(String(doc.businessType || ''));
  const ctpl = on(doc.includeCTPL) || /ctpl|compulsory third party/i.test(String(p.product_type || ''));
  return { brandNew, vehicleAge: modelYear ? Math.max(0, year - modelYear) : null, modelYear, corporate, financed, transfer, ctpl };
}

/** The active records of the master that apply to the facts, in their order. */
export async function applicableRecords(db, facts) {
  return (await activeRecords(db, MASTER)).filter((r) => {
    const veh = r.vehicleCondition || 'Any';
    if (veh === 'Brand new' && !facts.brandNew) return false;
    if (veh === 'Used' && facts.brandNew) return false;
    const cust = r.customerType || 'Any';
    if (cust === 'Individual' && facts.corporate) return false;
    if (cust === 'Corporate' && !facts.corporate) return false;
    const fin = r.financing || 'Any';
    if (fin === 'Financed' && !facts.financed) return false;
    if (fin === 'Not financed' && facts.financed) return false;
    const c = r.condition || 'Always';
    if (c === 'Vehicle older than the minimum age') return !facts.brandNew && facts.vehicleAge !== null && facts.vehicleAge >= Number(r.minVehicleAge || 0);
    if (c === 'Transfer of insurance') return facts.transfer;
    if (c === 'CTPL included') return facts.ctpl;
    return true;
  }).sort((a, b) => Number(a.sortOrder ?? 100) - Number(b.sortOrder ?? 100));
}

/** Build or rebuild the checklist of a Motor placement (inside the caller's transaction). */
async function buildChecklist(db, p) {
  const records = await applicableRecords(db, await factsOf(p, db));
  const codes = new Set(records.map((r) => String(r.code).toUpperCase()));
  const items = (await db.query('SELECT * FROM placement_checklist_items WHERE placement_id = $1', [p.id])).rows;
  for (const r of records) {
    const code = String(r.code).toUpperCase();
    const have = items.find((i) => i.code === code);
    const required = r.required === undefined ? true : on(r.required);
    const canWaive = r.canWaive === undefined ? true : on(r.canWaive);
    if (have) {
      // a pending item follows the master; a received or waived one keeps its status (mandatory again if the master says so)
      if (have.status === 'pending') await db.query('UPDATE placement_checklist_items SET document = $2, required = $3, can_waive = $4, kyc_doc_type = $5, sort_order = $6, updated_at = now() WHERE id = $1',
        [have.id, r.documentName || r.name, required, canWaive, r.kycDocType || null, Number(r.sortOrder ?? 100)]);
      else if (!have.required && required) await db.query('UPDATE placement_checklist_items SET required = true, updated_at = now() WHERE id = $1', [have.id]);
      continue;
    }
    await db.query(`INSERT INTO placement_checklist_items(placement_id, code, document, required, can_waive, kyc_doc_type, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (placement_id, code) DO NOTHING`, [p.id, code, r.documentName || r.name, required, canWaive, r.kycDocType || null, Number(r.sortOrder ?? 100)]);
  }
  for (const i of items.filter((x) => !codes.has(x.code))) {
    if (i.status === 'pending') await db.query('DELETE FROM placement_checklist_items WHERE id = $1', [i.id]);
    else if (i.required) await db.query('UPDATE placement_checklist_items SET required = false, updated_at = now() WHERE id = $1', [i.id]);
  }
}

const toItem = (r, onFile) => ({
  id: Number(r.id), code: r.code, document: r.document, required: r.required, canWaive: r.can_waive, kycDocType: r.kyc_doc_type, sortOrder: r.sort_order,
  status: r.status, statusLabel: ITEM_LABELS[r.status], onFile: r.status === 'pending' && onFile.has(r.kyc_doc_type), fileKey: r.file_key, fileName: r.file_name, remark: r.remark,
  receivedAt: r.received_at, receivedBy: r.received_by_name || r.received_by, waiverReason: r.waiver_reason, waiverRequestedBy: r.waiver_requested_by_name || r.waiver_requested_by,
  waiverRequestedById: r.waiver_requested_by, waiverRequestedAt: r.waiver_requested_at, waiverDecidedBy: r.waiver_decided_by_name || r.waiver_decided_by, waiverDecidedAt: r.waiver_decided_at,
  waiverNote: r.waiver_note,
});
const ITEM_SELECT = `SELECT i.*, ru.display_name AS received_by_name, wu.display_name AS waiver_requested_by_name, du.display_name AS waiver_decided_by_name
  FROM placement_checklist_items i LEFT JOIN users ru ON ru.id = i.received_by LEFT JOIN users wu ON wu.id = i.waiver_requested_by LEFT JOIN users du ON du.id = i.waiver_decided_by`;

/** Gate: the mandatory items neither received, waived nor on the client's KYC file (a waiver requested still counts). */
export function gateOf(items) {
  const missing = items.filter((i) => i.required && !['received', 'waived'].includes(i.status) && !i.onFile);
  return { missing: missing.length, documents: missing.map((i) => i.document), required: items.filter((i) => i.required).length };
}

const placementRow = async (db, id, lock = false) => {
  const p = (await db.query(`SELECT * FROM placements WHERE id = $1 OR placement_number = $1${lock ? ' FOR UPDATE' : ''}`, [String(id)])).rows[0];
  if (!p) throw notFound('Placement slip not found');
  return p;
};

/** The checklist of a placement: { applies, mode, facts, items, gate }; built (or brought up to date) while the slip is open. */
export async function checklistOf(id) {
  const out = await withTransaction(async (db) => {
    const p = await placementRow(db, id, true);
    if (!appliesTo(p)) return { p, applies: false };
    if (!CLOSED.includes(p.status)) await buildChecklist(db, p);
    return { p, applies: true, facts: await factsOf(p, db) };
  });
  const mode = await checklistMode();
  if (!out.applies) return { applies: false, mode, items: [], gate: { missing: 0, documents: [], required: 0 } };
  const rows = await many(`${ITEM_SELECT} WHERE i.placement_id = $1 ORDER BY i.sort_order, i.id`, [out.p.id]);
  const onFile = new Set(out.p.client_id ? (await many('SELECT DISTINCT doc_type FROM client_kyc_documents WHERE client_id = $1', [out.p.client_id])).map((r) => r.doc_type) : []);
  const items = rows.map((r) => toItem(r, onFile));
  return { applies: true, mode, facts: out.facts, items, gate: gateOf(items) };
}

/**
 * The check at booking: { warnings } when the mode is warn and documents are missing; refused (400, code
 * ISSUANCE_CHECKLIST) when the mode is block.
 */
export async function assertIssuanceChecklist(p) {
  const mode = await checklistMode();
  if (mode === 'off' || !appliesTo(p)) return { warnings: [] };
  const c = await checklistOf(p.id);
  if (!c.gate.missing) return { warnings: [] };
  const text = `${c.gate.missing} mandatory document(s) of the Motor issuance checklist missing: ${c.gate.documents.join(', ')}`;
  if (mode === 'block') {
    throw badRequest(`Placement slip ${p.placement_number} cannot be booked: ${text}`, [{ path: 'issuanceChecklist', code: 'ISSUANCE_CHECKLIST', message: text, documents: c.gate.documents }]);
  }
  return { warnings: [text], missing: c.gate.documents };
}

/** The open placement and one of its items, locked. */
async function itemFor(db, placementId, itemId) {
  const p = await placementRow(db, placementId, true);
  if (CLOSED.includes(p.status)) throw conflict(`Placement slip ${p.placement_number} is ${p.status}: its checklist is read-only`);
  const item = (await db.query('SELECT * FROM placement_checklist_items WHERE id = $1 AND placement_id = $2 FOR UPDATE', [Number(itemId), p.id])).rows[0];
  if (!item) throw notFound('Checklist item not found');
  return { p, item };
}

/** Receive an item: a file uploaded through /s3/upload (documentKey) or, for a paper original on file, a remark. */
export async function receiveItem(placementId, itemId, { documentKey = null, documentName = null, remark = null }, user) {
  if (documentKey && !(await findDocument(documentKey))) throw fail('documentKey', 'documentKey is not a file uploaded through /s3/upload');
  if (!documentKey && blank(remark)) throw fail('remark', 'Upload the document or enter a remark (a paper original on file)');
  return withTransaction(async (db) => {
    const { p, item } = await itemFor(db, placementId, itemId);
    if (item.status === 'received' && !documentKey) throw conflict(`${item.document} is already received`);
    await db.query(`UPDATE placement_checklist_items SET status = 'received', file_key = COALESCE($2, file_key), file_name = COALESCE($3, file_name), remark = $4, received_at = now(),
      received_by = $5, updated_at = now() WHERE id = $1`, [item.id, documentKey, documentKey ? (documentName || documentKey.split('/').pop()) : null, blank(remark) ? null : String(remark).trim(), user.id]);
    if (documentKey) await db.query("UPDATE documents SET entity = 'placement', entity_id = $2, category = $3 WHERE storage_key = $1 AND entity IS NULL", [documentKey, p.id, item.document]);
    return { placement: p, item, message: `${item.document} received` };
  });
}

/** Reopen a received or waived item with a remark: back to pending. */
export async function reopenItem(placementId, itemId, { remark }, user) {
  if (blank(remark)) throw fail('remark', 'Remark is required');
  return withTransaction(async (db) => {
    const { p, item } = await itemFor(db, placementId, itemId);
    if (!['received', 'waived'].includes(item.status)) throw conflict(`${item.document} is ${ITEM_LABELS[item.status]}: only a received or waived document is reopened`);
    await db.query(`UPDATE placement_checklist_items SET status = 'pending', remark = $2, received_at = NULL, received_by = NULL, waiver_decided_by = NULL, waiver_decided_at = NULL,
      updated_at = now() WHERE id = $1`, [item.id, String(remark).trim()]);
    return { placement: p, item, message: `${item.document} reopened`, by: user.id };
  });
}

/** Request the waiver of a pending item the master allows to be waived, with the reason. */
export async function requestWaiver(placementId, itemId, { reason }, user) {
  if (blank(reason)) throw fail('reason', 'Reason is required');
  const out = await withTransaction(async (db) => {
    const { p, item } = await itemFor(db, placementId, itemId);
    if (item.status !== 'pending') throw conflict(`${item.document} is ${ITEM_LABELS[item.status]}: only a pending document is waived`);
    if (!item.can_waive) throw fail('itemId', `${item.document} cannot be waived`);
    await db.query(`UPDATE placement_checklist_items SET status = 'waiver-requested', waiver_reason = $2, waiver_requested_by = $3, waiver_requested_at = now(), waiver_decided_by = NULL,
      waiver_decided_at = NULL, waiver_note = NULL, updated_at = now() WHERE id = $1`, [item.id, String(reason).trim(), user.id]);
    return { p, item };
  });
  await notifyApprovers({ audience: 'approve:policies', document: 'Checklist waiver', number: out.p.placement_number, by: user.username, detail: `${out.item.document}: ${reason}`,
    link: `/placement/placement-slips/${out.p.id}`, entity: 'placement', entityId: out.p.id });
  return { placement: out.p, item: out.item, message: `Waiver of ${out.item.document} requested` };
}

/** Approve (waived) or reject with the reason (pending) a waiver: approve:policies, never the user who requested it. */
export async function decideWaiver(placementId, itemId, { decision, note = null }, user) {
  if (!['approve', 'reject'].includes(decision)) throw fail('decision', 'decision must be approve or reject');
  if (!hasPermission(user, 'approve:policies')) throw forbidden('A waiver of the Motor issuance checklist is decided by an approver (approve:policies)');
  if (decision === 'reject' && blank(note)) throw fail('note', 'Reason is required');
  const out = await withTransaction(async (db) => {
    const { p, item } = await itemFor(db, placementId, itemId);
    if (item.status !== 'waiver-requested') throw conflict(`${item.document} has no waiver waiting for a decision`);
    if (item.waiver_requested_by === user.id) throw forbidden('Maker-checker: the waiver is decided by a user other than the one who requested it');
    await db.query('UPDATE placement_checklist_items SET status = $2, waiver_decided_by = $3, waiver_decided_at = now(), waiver_note = $4, updated_at = now() WHERE id = $1',
      [item.id, decision === 'approve' ? 'waived' : 'pending', user.id, blank(note) ? null : String(note).trim()]);
    return { p, item };
  });
  await notifyDecision({ userId: out.item.waiver_requested_by, decidedBy: user.id, document: 'Checklist waiver', number: `${out.p.placement_number} - ${out.item.document}`,
    approved: decision === 'approve', by: user.username, reason: note || null, link: `/placement/placement-slips/${out.p.id}`, entity: 'placement', entityId: out.p.id });
  return { placement: out.p, item: out.item, message: `Waiver of ${out.item.document} ${decision === 'approve' ? 'approved' : 'rejected'}` };
}

