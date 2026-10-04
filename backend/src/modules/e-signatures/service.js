/**
 * E-signatures: capture (drawn on screen or uploaded), versions with effective dates, revocation, protected storage,
 * and the mapping of signatures to documents (document type -> slot -> source and condition).
 *
 * Storage: the image is written to the uploads storage under e-signatures/ with a documents row of category
 * "e-signatures". GET /api/s3/object refuses that category (signed link or not), so a signature image is only read by
 * the document renderer and by GET /api/e-signatures/:id/image, which checks the caller.
 *
 * Printing: every document builder calls signatureSection(documentType, ctx) (or renderSignatureBlock for one slot,
 * e.g. a {{signature:slot}} placeholder in an uploaded template). A draft prints the slots without images and the
 * "UNSIGNED DRAFT" watermark; an issued (or approved, per slot condition) document prints each signer's image with
 * name, designation and date.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { many, one, query } from '../../db/pool.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { renderTemplate } from '../../lib/template.js';
import { today } from '../../lib/dates.js';
import { formatDate } from '../../lib/pdf/format.js';
import { loadImage } from '../../lib/pdf/image.js';
import { getLetterhead, resolveLogo } from '../../lib/letterhead.js';
import { hasPermission, isAdmin } from '../../lib/auth.js';
import { reserveKey, resolveKey, writeObject } from '../uploads/storage.js';
import { detectType } from '../uploads/fileTypes.js';

export const STORAGE_CATEGORY = 'e-signatures';
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const isoDay = (v) => (v ? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null);

/**
 * Document types that print signatures, with the statuses that make a document final. `draft` statuses print no
 * signature image and the draft watermark; `approved` (when listed) are the statuses a slot with condition
 * "approved" needs; `cancelled` statuses print a CANCELLED watermark and no signature.
 */
export const DOCUMENT_TYPES = {
  quotation: { label: 'Quotation slip', draft: ['draft', 'quoted'] },
  'policy-schedule': { label: 'Policy schedule', draft: ['draft'], cancelled: ['cancelled'] },
  endorsement: { label: 'Endorsement', draft: ['draft', 'submitted', 'pendingcustomer', 'cancel-initiated', 'initiatecancel'], cancelled: ['rejected', 'cancelled'] },
  'official-receipt': { label: 'Official receipt', draft: ['draft'], cancelled: ['cancelled', 'void', 'voided'] },
  'acknowledgement-receipt': { label: 'Acknowledgement receipt', draft: [], cancelled: ['rejected'] },
  'payment-voucher': { label: 'Payment voucher', draft: ['draft', 'pending', 'for-approval', 'rejected', 'returned'], approved: ['approved', 'printed', 'released', 'paid', 'cleared'], cancelled: ['cancelled', 'void'] },
  'debit-note': { label: 'Commission debit note', draft: ['draft', 'for-approval', 'rejected'], cancelled: ['cancelled'] },
  'billing-statement': { label: 'Billing statement / invoice', draft: [] },
  'statement-of-account': { label: 'Statement of account', draft: [] },
  'journal-voucher': { label: 'Journal voucher', draft: ['draft', 'pending', 'for-approval', 'rejected'], approved: ['posted', 'approved'], cancelled: ['reversed', 'cancelled', 'void'] },
  'claim-settlement-letter': { label: 'Claim settlement letter', draft: ['open', 'registered', 'in-review', 'documents-pending', 'pending'], approved: ['approved', 'settled', 'closed'], cancelled: ['rejected', 'withdrawn'] },
};
export const SOURCES = {
  'document-signatory': 'Signatory chosen on the document (else the default signatory)',
  'named-signatory': 'A named signatory',
  'default-signatory': 'The default signatory (documents.default_signatory)',
  'approving-user': 'The user who approved the document',
  'issuing-user': 'The user who issued / prepared the document',
};
export const CONDITIONS = { issued: 'Once the document is issued', approved: 'Once the document is approved', always: 'Always (also on drafts)' };

const norm = (s) => str(s).toLowerCase().replace(/[\s_]+/g, '-');

/** 'draft' | 'issued' | 'approved' | 'cancelled' for a document type and its status (unknown status = issued). */
export function documentState(documentType, status) {
  const t = DOCUMENT_TYPES[documentType] || { draft: ['draft'] };
  const s = norm(status);
  if (!s) return 'issued';
  if ((t.cancelled || []).includes(s)) return 'cancelled';
  if ((t.draft || []).includes(s)) return 'draft';
  if (t.approved) return t.approved.includes(s) ? 'approved' : 'issued';
  return 'approved';
}

// ---------- capture, versions, revocation ----------

async function ownerOf(ownerType, ownerId) {
  if (ownerType === 'signatory') {
    const r = await one("SELECT id, name, designation, status FROM signatories WHERE id::text = $1 AND status <> 'deleted'", [str(ownerId)]);
    if (!r) throw notFound('Signatory not found');
    return { id: String(r.id), name: r.name, designation: r.designation };
  }
  if (ownerType === 'user') {
    const r = await one('SELECT id, display_name, username, designation FROM users WHERE id = $1', [str(ownerId)]);
    if (!r) throw notFound('User not found');
    return { id: r.id, name: r.display_name || r.username, designation: r.designation };
  }
  throw badRequest('ownerType must be signatory or user');
}

/**
 * Who may manage a signature: a signatory's with write:masters; a user's own signature by that user only (a signature
 * is personal: an administrator can revoke it, never capture it for someone else).
 */
export function assertCanManage(user, ownerType, ownerId, action = 'capture') {
  if (ownerType === 'signatory') {
    if (!hasPermission(user, 'write:masters')) throw forbidden('Managing signatory signatures needs write:masters');
    return;
  }
  if (ownerType === 'user') {
    if (user?.id === ownerId) return;
    if (action !== 'capture' && isAdmin(user)) return;
    throw forbidden(action === 'capture' ? 'A user signature can only be captured by that user (My Profile > E-signature)' : 'Not your signature');
  }
  throw badRequest('ownerType must be signatory or user');
}

/** Consent statement shown before capture (placeholders filled). */
export async function consentText(ownerType, ownerId) {
  const owner = ownerId ? await ownerOf(ownerType, ownerId).catch(() => null) : null;
  const key = ownerType === 'signatory' ? 'signatures.consent_text_signatory' : 'signatures.consent_text_user';
  const fallback = ownerType === 'signatory'
    ? 'I confirm that {{signatoryName}} has authorised {{companyName}} to capture this signature and to print it on the documents mapped to this signatory.'
    : 'I confirm that this is my own signature and I authorise {{companyName}} to print it on the documents I issue or approve.';
  const lh = await getLetterhead().catch(() => ({}));
  return renderTemplate((await getSetting(key, fallback)) || fallback, {
    signatoryName: owner?.name || 'the signatory', companyName: lh.name || 'the company', systemName: (await getSetting('general.system_name', 'BrokerVerse')) || 'BrokerVerse',
  }, { html: false });
}

/** The image of a capture request: a PNG data URL (drawn) or uploaded bytes; PNG / JPEG that the PDF engine can print. */
export async function signatureImage({ imageData, file }) {
  let buffer = null;
  if (file?.buffer) buffer = file.buffer;
  else if (imageData) {
    const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)$/.exec(str(imageData));
    if (!m) throw badRequest('imageData must be a PNG or JPEG data URL (data:image/png;base64,...)');
    buffer = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  }
  if (!buffer?.length) throw badRequest('Draw the signature or upload an image (PNG or JPEG)');
  const max = Number(await getSetting('signatures.max_bytes', 524288)) || 524288;
  if (buffer.length > max) throw badRequest(`The signature image is larger than ${Math.round(max / 1024)} KB`);
  const type = detectType(buffer, file?.originalname || 'signature.png');
  if (!['image/png', 'image/jpeg'].includes(type)) throw badRequest('The signature must be a PNG or JPEG image');
  const img = loadImage(buffer);
  if (!img) throw badRequest('The signature image cannot be read (interlaced PNG or damaged file); save it as a plain PNG or JPEG');
  if (img.width > 3000 || img.height > 3000 || img.width < 20 || img.height < 10) throw badRequest('The signature image must be between 20 x 10 and 3000 x 3000 pixels');
  return { buffer, contentType: type, width: img.width, height: img.height };
}

const signatureOut = (r) => r && ({
  id: r.id, ownerType: r.owner_type, ownerId: r.owner_id, version: r.version, method: r.method, contentType: r.content_type,
  effectiveFrom: isoDay(r.effective_from), effectiveTo: isoDay(r.effective_to), status: r.status, consentText: r.consent_text, consentAt: r.consent_at,
  capturedBy: r.captured_by_name || r.captured_by, capturedAt: r.captured_at, revokedBy: r.revoked_by_name || r.revoked_by, revokedAt: r.revoked_at, revokeReason: r.revoke_reason,
  imageUrl: `/api/e-signatures/${r.id}/image`,
});

export async function listSignatures(ownerType, ownerId) {
  const rows = await many(`SELECT s.*, cu.display_name AS captured_by_name, ru.display_name AS revoked_by_name FROM e_signatures s
    LEFT JOIN users cu ON cu.id = s.captured_by LEFT JOIN users ru ON ru.id = s.revoked_by
    WHERE s.owner_type = $1 AND s.owner_id = $2 ORDER BY s.version DESC`, [ownerType, str(ownerId)]);
  return rows.map(signatureOut);
}

/** Audit entry of a signature event (never the image itself). */
async function auditSignature(db, { userId, username, ip }, action, sig, extra = {}) {
  await db.query(`INSERT INTO audit_log(user_id, username, entity, entity_id, action, before_data, after_data, ip) VALUES ($1,$2,'e-signature',$3,$4,$5,$6,$7)`,
    [userId || null, username || null, String(sig.id), action, extra.before ? JSON.stringify(extra.before) : null,
      JSON.stringify({ ownerType: sig.owner_type, ownerId: sig.owner_id, version: sig.version, method: sig.method, status: sig.status, effectiveFrom: isoDay(sig.effective_from),
        effectiveTo: isoDay(sig.effective_to), contentHash: sig.content_hash, consentText: sig.consent_text, ...(extra.after || {}) }), ip || null]);
}

/**
 * Capture a signature (a new version). The previous active version ends the day before the new one takes effect
 * ("replaced"). `consent` must be true: the consent statement in force is stored with the version.
 */
export async function captureSignature({ ownerType, ownerId, method, imageData, file, effectiveFrom, consent }, actor) {
  const owner = await ownerOf(ownerType, ownerId);
  assertCanManage(actor.user, ownerType, owner.id, 'capture');
  if (!(consent === true || consent === 'true')) throw badRequest('Accept the consent statement to save the signature');
  const img = await signatureImage({ imageData, file });
  const from = isoDay(effectiveFrom) || await today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw badRequest('effectiveFrom must be a date (YYYY-MM-DD)');
  const kind = method === 'uploaded' || file ? 'uploaded' : 'drawn';
  const key = await reserveKey({ folder: STORAGE_CATEGORY, fileName: `${ownerType}-${owner.id}.${img.contentType === 'image/png' ? 'png' : 'jpg'}`, contentType: img.contentType,
    userId: actor.user?.id, entity: 'e-signature', entityId: `${ownerType}:${owner.id}` });
  await writeObject(key, img.buffer, img.contentType);
  const hash = crypto.createHash('sha256').update(img.buffer).digest('hex');
  const consentStatement = await consentText(ownerType, owner.id);
  const prev = await one(`SELECT * FROM e_signatures WHERE owner_type = $1 AND owner_id = $2 AND status = 'active' ORDER BY version DESC LIMIT 1`, [ownerType, owner.id]);
  const version = Number((await one('SELECT COALESCE(max(version), 0) AS v FROM e_signatures WHERE owner_type = $1 AND owner_id = $2', [ownerType, owner.id])).v) + 1;
  const sig = await one(`INSERT INTO e_signatures(owner_type, owner_id, version, storage_key, content_type, content_hash, method, effective_from, consent_text, consent_ip, captured_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [ownerType, owner.id, version, key, img.contentType, hash, kind, from, consentStatement, actor.ip || null, actor.user?.id || null]);
  if (prev) {
    const ended = await one(`UPDATE e_signatures SET status = 'replaced', effective_to = GREATEST(effective_from, $2::date - 1) WHERE id = $1 RETURNING *`, [prev.id, from]);
    await auditSignature({ query }, actorInfo(actor), 'replace', ended, { after: { replacedBy: sig.id } });
  }
  await auditSignature({ query }, actorInfo(actor), 'capture', sig, { after: { width: img.width, height: img.height, replaces: prev?.id || null } });
  return signatureOut(sig);
}

const actorInfo = (actor) => ({ userId: actor.user?.id, username: actor.user?.username, ip: actor.ip });

export async function getSignatureRow(id) {
  const r = await one('SELECT * FROM e_signatures WHERE id::text = $1', [str(id)]);
  if (!r) throw notFound('Signature not found');
  return r;
}

/** Revoke a version: it never prints again (also not on reprints of older documents). */
export async function revokeSignature(id, reason, actor) {
  const r = await getSignatureRow(id);
  assertCanManage(actor.user, r.owner_type, r.owner_id, 'revoke');
  if (r.status === 'revoked') throw badRequest('The signature is already revoked');
  if (!str(reason)) throw badRequest('Give the reason for the revocation');
  const out = await one(`UPDATE e_signatures SET status = 'revoked', revoked_by = $2, revoked_at = now(), revoke_reason = $3, effective_to = LEAST(COALESCE(effective_to, CURRENT_DATE), CURRENT_DATE)
    WHERE id = $1 RETURNING *`, [r.id, actor.user?.id || null, str(reason).slice(0, 500)]);
  await auditSignature({ query }, actorInfo(actor), 'revoke', out, { before: { status: r.status }, after: { reason: out.revoke_reason } });
  return signatureOut(out);
}

/** The image of a version for an authorised viewer: { buffer, contentType }. */
export async function signatureFile(id, user) {
  const r = await getSignatureRow(id);
  if (r.owner_type === 'signatory' ? !hasPermission(user, 'write:masters') : user?.id !== r.owner_id && !isAdmin(user)) {
    throw forbidden('You cannot view this signature');
  }
  return { buffer: fs.readFileSync(resolveKey(r.storage_key)), contentType: r.content_type };
}

/** The signature of an owner in force on a date (latest version), as { buffer, type } for the PDF engine, else null. */
export async function effectiveSignature(ownerType, ownerId, onDate) {
  if (!ownerId) return null;
  const day = isoDay(onDate) || await today();
  const r = await one(`SELECT storage_key FROM e_signatures WHERE owner_type = $1 AND owner_id = $2 AND status <> 'revoked'
    AND effective_from <= $3::date AND (effective_to IS NULL OR effective_to >= $3::date) ORDER BY version DESC LIMIT 1`, [ownerType, String(ownerId), day]).catch(() => null);
  if (!r) return null;
  try {
    const buffer = fs.readFileSync(resolveKey(r.storage_key));
    return { buffer, type: buffer[0] === 0x89 ? 'png' : 'jpeg' };
  } catch {
    return null;
  }
}

// ---------- document mapping ----------

const slotOut = (r) => ({ id: r.id, documentType: r.document_type, slot: r.slot, label: r.label, source: r.source, signatoryId: r.signatory_id, signatoryName: r.signatory_name || null,
  condition: r.condition, sortOrder: r.sort_order, active: r.active, updatedAt: r.updated_at });

export async function listSlots(documentType = null) {
  const rows = await many(`SELECT d.*, s.name AS signatory_name FROM document_signature_slots d LEFT JOIN signatories s ON s.id = d.signatory_id
    WHERE ($1::text IS NULL OR d.document_type = $1) ORDER BY d.document_type, d.sort_order, d.slot`, [documentType]).catch(() => []);
  return rows.map(slotOut);
}

/** Replace the mapping of the document types sent (other types keep theirs). */
export async function saveSlots(slots, userId) {
  if (!Array.isArray(slots)) throw badRequest('Send { slots: [...] }');
  const errors = [];
  slots.forEach((s, i) => {
    if (!DOCUMENT_TYPES[s.documentType]) errors.push({ path: `slots[${i}].documentType`, message: `Unknown document type ${s.documentType}` });
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(str(s.slot))) errors.push({ path: `slots[${i}].slot`, message: 'Slot code: lower-case letters, digits and hyphens (e.g. approved-by)' });
    if (!str(s.label) || str(s.label).length > 80) errors.push({ path: `slots[${i}].label`, message: 'Label is required (max 80 characters)' });
    if (!SOURCES[s.source]) errors.push({ path: `slots[${i}].source`, message: `Source must be one of ${Object.keys(SOURCES).join(', ')}` });
    if (s.source === 'named-signatory' && !s.signatoryId) errors.push({ path: `slots[${i}].signatoryId`, message: 'Choose the signatory' });
    if (s.condition && !CONDITIONS[s.condition]) errors.push({ path: `slots[${i}].condition`, message: `Condition must be one of ${Object.keys(CONDITIONS).join(', ')}` });
  });
  const seen = new Set();
  slots.forEach((s, i) => { const k = `${s.documentType}/${s.slot}`; if (seen.has(k)) errors.push({ path: `slots[${i}].slot`, message: `Slot ${s.slot} appears twice for ${s.documentType}` }); seen.add(k); });
  if (errors.length) throw badRequest('Validation failed', errors);
  const types = [...new Set(slots.map((s) => s.documentType))];
  await query('DELETE FROM document_signature_slots WHERE document_type = ANY($1)', [types]);
  for (const [i, s] of slots.entries()) {
    await query(`INSERT INTO document_signature_slots(document_type, slot, label, source, signatory_id, condition, sort_order, active, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [s.documentType, str(s.slot), str(s.label), s.source, s.source === 'named-signatory' ? Number(s.signatoryId) : null, s.condition || 'issued', Number(s.sortOrder ?? i + 1), s.active !== false, userId]);
  }
  return listSlots();
}

/** The default signatory (documents.default_signatory, else the first active one) as a signer. */
async function defaultSignatory() {
  const rows = await many(`SELECT id, name, designation, signature_key FROM signatories WHERE status = 'active' ORDER BY name`).catch(() => []);
  const wanted = str(await getSetting('documents.default_signatory', '')).toLowerCase();
  return rows.find((r) => wanted && r.name.toLowerCase() === wanted) || rows[0] || null;
}

async function signatoryByRef(ref) {
  const s = str(ref);
  if (!s) return null;
  return one(`SELECT id, name, designation, signature_key FROM signatories WHERE status <> 'deleted' AND (lower(name) = lower($1) OR id::text = $1)
    ORDER BY (status = 'active') DESC, id LIMIT 1`, [s]).catch(() => null);
}

/** Signer of a slot: { ownerType, ownerId, name, designation, legacyKey } or null. */
async function signerOf(slot, ctx) {
  let sig = null;
  switch (slot.source) {
    case 'document-signatory': sig = (await signatoryByRef(ctx.signatory)) || await defaultSignatory(); break;
    case 'named-signatory': sig = slot.signatoryId ? await signatoryByRef(String(slot.signatoryId)) : null; break;
    case 'default-signatory': sig = await defaultSignatory(); break;
    case 'approving-user':
    case 'issuing-user': {
      const ref = slot.source === 'approving-user' ? ctx.approvedBy : ctx.issuedBy;
      if (!ref) return ctx.names?.[slot.source] ? { name: ctx.names[slot.source] } : null;
      const u = await one('SELECT id, display_name, username, designation FROM users WHERE id::text = $1 OR username = $1 LIMIT 1', [String(ref)]).catch(() => null);
      return u ? { ownerType: 'user', ownerId: u.id, name: u.display_name || u.username, designation: u.designation } : { name: String(ref) };
    }
    default: return null;
  }
  if (!sig && slot.source === 'document-signatory' && str(ctx.signatory)) return { name: str(ctx.signatory) };
  return sig ? { ownerType: 'signatory', ownerId: String(sig.id), name: sig.name, designation: sig.designation, legacyKey: sig.signature_key } : null;
}

/**
 * One signature slot of a document, resolved: { slot, label, name, title, date, image, signed }. `ctx`:
 * { status, date (document date), signatory (chosen on the document), issuedBy, approvedBy (user ids), names
 * ({ 'issuing-user': 'display name' } when only a name is known), format, companyName }.
 * This is the helper behind the {{signature:slot}} placeholder of uploaded document templates.
 */
export async function renderSignatureBlock(documentType, slotCode, ctx = {}) {
  const slots = await listSlots(documentType);
  const slot = slots.find((s) => s.slot === slotCode && s.active);
  if (!slot) return null;
  return resolveSlot(documentType, slot, ctx);
}

async function resolveSlot(documentType, slot, ctx) {
  const state = documentState(documentType, ctx.status);
  const company = ctx.companyName || (await getLetterhead().catch(() => ({}))).name || '';
  const label = renderTemplate(slot.label, { companyName: company || 'the broker' }, { html: false });
  const signer = await signerOf(slot, ctx);
  const allowed = slot.condition === 'always' || (slot.condition === 'approved' ? state === 'approved' : ['issued', 'approved'].includes(state));
  let image = null;
  if (allowed && signer?.ownerType) {
    image = await effectiveSignature(signer.ownerType, signer.ownerId, ctx.date);
    // a signatory's signature uploaded before e-signatures (signatories.signature_key) still prints
    if (!image && signer.legacyKey) image = await resolveLogo(signer.legacyKey).catch(() => null);
  }
  const date = image && ctx.date ? `Date: ${formatDate(ctx.date, ctx.format || {})}` : null;
  return { slot: slot.slot, label, name: signer?.name || null, title: signer?.designation || null, image, date, signed: !!image, allowed, state };
}

/**
 * The signature section of a document: the document's own blocks (`blocks`: [{ slot?, label, name? }] in print order,
 * e.g. "Checked by" stays a blank line) with each mapped slot filled in, then the active slots the document does not
 * list. Returns { section, watermark, state, signed } — spread `watermark` into the spec.
 */
export async function signatureSection(documentType, ctx = {}, { blocks = null, perRow = null } = {}) {
  const slots = (await listSlots(documentType)).filter((s) => s.active);
  const company = ctx.companyName || (await getLetterhead().catch(() => ({}))).name || '';
  const fill = (label) => renderTemplate(label || '', { companyName: company || 'the broker' }, { html: false });
  ctx = { ...ctx, companyName: company };
  const used = new Set();
  const out = [];
  const list = blocks || slots.map((s) => ({ slot: s.slot }));
  for (const b of list) {
    const slot = b.slot ? slots.find((s) => s.slot === b.slot) : null;
    if (slot) {
      used.add(slot.slot);
      const r = await resolveSlot(documentType, slot, ctx);
      out.push({ label: r.label || fill(b.label), name: r.name || b.name || null, title: r.title || b.title || null, image: r.image, date: r.date });
    } else if (!b.slot || blocks) {
      // a block of the document with no (active) mapping: printed as before, without an image
      if (b.slot && !slot && b.optional) continue;
      out.push({ label: fill(b.label), name: b.name || null, title: b.title || null });
    }
  }
  for (const s of slots) {
    if (used.has(s.slot) || !blocks) continue;
    const r = await resolveSlot(documentType, s, ctx);
    out.push({ label: r.label, name: r.name, title: r.title, image: r.image, date: r.date });
  }
  const state = documentState(documentType, ctx.status);
  const draftMark = (await getSetting('signatures.draft_watermark', 'UNSIGNED DRAFT')) ?? 'UNSIGNED DRAFT';
  const watermark = state === 'cancelled' ? 'CANCELLED' : state === 'draft' && out.length ? str(draftMark) || null : null;
  return { section: out.length ? { signatures: out, perRow: perRow || Math.min(out.length, 4) } : null, watermark, state, signed: out.some((b) => b.image) };
}

/**
 * Replace {{signature:slot}} lines of a text template (claim letters, uploaded templates) by signature blocks:
 * returns the resolved blocks for the slots named, in order.
 */
export const SIGNATURE_PLACEHOLDER = /\{\{\s*signature:([a-z0-9-]+)\s*\}\}/gi;
export async function signaturePlaceholders(text, documentType, ctx = {}) {
  const slots = [...String(text || '').matchAll(SIGNATURE_PLACEHOLDER)].map((m) => m[1].toLowerCase());
  const out = [];
  for (const s of slots) {
    const b = await renderSignatureBlock(documentType, s, ctx);
    if (b) out.push(b);
  }
  return out;
}
