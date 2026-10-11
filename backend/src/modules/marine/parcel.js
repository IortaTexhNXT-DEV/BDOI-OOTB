/**
 * Parcel certificates of a Parcel / Courier open cover (FR-PCL-010 to 014).
 *
 * One parcel = one customer = one certificate (PCC series): Add parcel on screen or one row of the TFS daily parcel list
 * (Upload parcels, PARCEL_COLUMNS), with the same checks (FR-PCL-012): required data, parcel date within the period,
 * not in the future and at most parcel.max_backdate_days old, waybill unique on the cover (error), the same loan
 * account within parcel.duplicate_days (warning, flagged Possible duplicate), province on the address master, e-mail
 * and +63 mobile format. The certificate carries the covers and the charge in force on the parcel date (after
 * endorsements) and joins the daily declaration of its date, or today's as a late item.
 *
 * With an e-mail address (parcel.email_certificate) the certificate is queued in the E-mail Outbox as a PDF protected by
 * the password rule parcel.certificate_password; Print certificates of the day prints the others of a date.
 *
 * Cancel (service.js#cancelCertificate) before the month is submitted; afterwards a reversal requested with a reason
 * within parcel.reversal_max_days and approved by a second user (approve:marine): Reversed, a negative line on the
 * next monthly declaration.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { documentAttachment, queueEmail } from '../../lib/mailer.js';
import { renderTemplate } from '../documents/common.js';
import { num, round2 } from '../documents/common.js';
import { mapColumns, normKey } from '../documents/tabular.js';
import { CERT_SELECT, certificateOut, getCertificateRow, getCoverRow, issueCertificate, recompute, recomputeOpenMonth } from './service.js';
import { premiumPerCertificate, termsOn, validEmail } from './terms.js';
import { assignDaily } from './daily.js';

/** Columns of the TFS parcel list (FRS PJRN-09 13.1); the template is built from this list. */
export const PARCEL_COLUMNS = [
  { key: 'parcelDate', header: 'PARCEL_DATE', aliases: ['parcel date', 'date'], format: 'Date DD/MM/YYYY or YYYY-MM-DD; blank = the parcel date of the dialog; within the period, not in the future, at most parcel.max_backdate_days old', example: '09/10/2026' },
  { key: 'customerName', header: 'CUSTOMER_NAME', aliases: ['customer name', 'customer'], required: true, format: 'Text 120, as on the loan', example: 'Maria Clara Reyes' },
  { key: 'loanAccount', header: 'LOAN_ACCOUNT', aliases: ['loan account', 'tfs loan account'], required: true, format: 'Text 30; the same account within parcel.duplicate_days gives a warning', example: '0701-2026-118842' },
  { key: 'addressLine', header: 'ADDRESS_LINE', aliases: ['address', 'address line'], required: true, format: 'House / unit, street', example: '18 Sampaguita St.' },
  { key: 'barangay', header: 'BARANGAY', format: 'Text', example: 'Bel-Air' },
  { key: 'city', header: 'CITY_MUNICIPALITY', aliases: ['city', 'municipality', 'city / municipality'], required: true, format: 'City or municipality', example: 'Makati City' },
  { key: 'province', header: 'PROVINCE', required: true, format: 'Province of the address list (Metro Manila for NCR)', example: 'Metro Manila' },
  { key: 'zipCode', header: 'ZIP', aliases: ['zip code', 'postal code'], format: 'Text', example: '1209' },
  { key: 'mobile', header: 'MOBILE', aliases: ['mobile number'], format: 'Mobile number 09XXXXXXXXX or +639XXXXXXXXX', example: '09175550123' },
  { key: 'email', header: 'EMAIL', aliases: ['e-mail'], format: 'E-mail address; the certificate is e-mailed to it', example: 'maria.reyes@example.ph' },
  { key: 'documentsSent', header: 'DOCUMENTS', aliases: ['documents sent'], required: true, format: 'One or more of parcel.documents_sent, separated by ;', example: 'Certificate of registration; Deed of sale' },
  { key: 'courier', header: 'COURIER', format: 'Text; blank = parcel.default_courier', example: 'LBC Express' },
  { key: 'waybillNo', header: 'WAYBILL_NO', aliases: ['waybill', 'waybill no'], required: true, format: 'Text 30, unique on the open cover', example: '143298765012' },
  { key: 'deliveryType', header: 'DELIVERY_TYPE', aliases: ['delivery type'], required: true, format: 'A delivery type of the open cover (Rush, Regular)', example: 'Rush' },
];

const LABELS = { customerName: 'Customer name', loanAccount: 'TFS loan account', addressLine: 'Address line', city: 'City or municipality', province: 'Province',
  documentsSent: 'Documents sent', waybillNo: 'Waybill no.', deliveryType: 'Delivery type' };
const fail = (path, message, code) => badRequest(message, [{ path, message, ...(code ? { code } : {}) }]);

/** Philippine mobile number in the +63 format of BrokerVerse, or null when it is not one. */
export function phMobile(v) {
  const s = String(v || '').replace(/[\s()-]/g, '');
  const m = /^(?:\+?63|0)(9\d{9})$/.exec(s);
  return m ? `+63${m[1]}` : null;
}

/** DD/MM/YYYY, YYYY-MM-DD or an Excel serial date to YYYY-MM-DD (null when not a date). */
export function parcelDateOf(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) return isoDate(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
  return isoDate(s);
}

/** The password of an e-mailed parcel certificate (parcel.certificate_password): '' when the rule is none. */
export async function parcelPassword(x) {
  const rule = String((await getSetting('parcel.certificate_password', 'loan_last6')) || 'none');
  const digits = (v) => String(v || '').replace(/\D/g, '');
  if (rule === 'loan_last6') return digits(x.loan_account).slice(-6);
  if (rule === 'loan_last4') return digits(x.loan_account).slice(-4);
  if (rule === 'mobile_last4') return digits(x.mobile).slice(-4);
  return '';
}
const PASSWORD_HINTS = { loan_last6: 'The PDF opens with the last six digits of your TFS loan account number.', loan_last4: 'The PDF opens with the last four digits of your TFS loan account number.',
  mobile_last4: 'The PDF opens with the last four digits of your mobile number.' };

/**
 * Check a parcel (FR-PCL-012) against a cover and its terms; returns the clean values and the warnings, or throws 400
 * with the first error.
 */
async function checkParcel(db, cover, v, { defaultDate = null } = {}) {
  for (const k of Object.keys(LABELS)) if (!String(v[k] ?? '').trim()) throw fail(k, `${LABELS[k]} is required`, 'MSG-PCL-026');
  const now = await today();
  const date = v.parcelDate ? parcelDateOf(v.parcelDate) : (defaultDate || now);
  if (!date) throw fail('parcelDate', 'The parcel date is not a date (DD/MM/YYYY)');
  const from = String(cover.period_from).slice(0, 10);
  const to = String(cover.period_to).slice(0, 10);
  if (date < from || date > to) throw fail('parcelDate', `The parcel date must fall within ${from} to ${to}`, 'MSG-PCL-027');
  if (date > now) throw fail('parcelDate', 'The parcel date cannot be after today', 'MSG-PCL-028');
  const back = Number(await getSetting('parcel.max_backdate_days', 30));
  if (date < addDays(now, -back)) throw fail('parcelDate', `The parcel date is more than ${back} days old: refer the parcel to the insurer`, 'MSG-PCL-029');
  const waybill = String(v.waybillNo).trim();
  const used = (await db.query("SELECT certificate_number FROM open_cover_certificates WHERE open_cover_id = $1 AND waybill_no = $2 AND status <> 'cancelled' LIMIT 1", [cover.id, waybill])).rows[0];
  if (used) throw fail('waybillNo', `Waybill ${waybill} is already on certificate ${used.certificate_number}`, 'MSG-PCL-030');
  const province = String(v.province).trim();
  const prov = (await db.query("SELECT name FROM states WHERE (lower(name) = lower($1) OR lower(code) = lower($1)) AND status <> 'deleted' LIMIT 1", [province])).rows[0];
  if (!prov) throw fail('province', `Province ${province} is not on the address list`, 'MSG-PCL-032');
  const email = String(v.email || '').trim();
  if (email && !validEmail(email)) throw fail('email', 'Enter a valid e-mail address', 'MSG-PCL-033');
  const mobile = String(v.mobile || '').trim();
  const mobile63 = mobile ? phMobile(mobile) : null;
  if (mobile && !mobile63) throw fail('mobile', 'Enter the mobile number as 09XXXXXXXXX or +639XXXXXXXXX');
  const terms = await termsOn(db, cover, date);
  const types = (terms.deliveryTypes || []).length ? terms.deliveryTypes : ((await getSetting('parcel.delivery_types', [])) || []);
  const dt = types.find((t) => [t.code, t.label].some((x) => String(x || '').toLowerCase() === String(v.deliveryType).trim().toLowerCase()));
  if (!dt) throw fail('deliveryType', `Delivery type must be one of ${types.map((t) => t.label || t.code).join(', ')}`);
  const allowedDocs = ((await getSetting('parcel.documents_sent', [])) || []).map(String);
  const docs = String(v.documentsSent).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const unknown = docs.filter((d) => allowedDocs.length && !allowedDocs.some((a) => a.toLowerCase() === d.toLowerCase()));
  if (unknown.length) throw fail('documentsSent', `Documents must be from: ${allowedDocs.join(', ')}`);
  const docList = docs.map((d) => allowedDocs.find((a) => a.toLowerCase() === d.toLowerCase()) || d);
  const warnings = [];
  const days = Number(await getSetting('parcel.duplicate_days', 7));
  const account = String(v.loanAccount).trim();
  const recent = (await db.query(`SELECT certificate_number, shipment_date FROM open_cover_certificates WHERE open_cover_id = $1 AND loan_account = $2 AND status <> 'cancelled'
    AND shipment_date BETWEEN $3::date AND $4::date ORDER BY shipment_date DESC LIMIT 1`, [cover.id, account, addDays(date, -days), addDays(date, days)])).rows[0];
  if (recent) warnings.push(`Loan account ${account} already has certificate ${recent.certificate_number} of ${String(recent.shipment_date).slice(0, 10)}: issued and flagged as a possible duplicate`);
  return {
    date, terms, warnings, duplicate: Boolean(recent),
    values: { customerName: String(v.customerName).trim(), loanAccount: account, addressLine: String(v.addressLine).trim(), barangay: String(v.barangay || '').trim() || null,
      city: String(v.city).trim(), province: prov.name, zipCode: String(v.zipCode || '').trim() || null, mobile: mobile63, email: email || null, documentsSent: docList.join('; '),
      courier: String(v.courier || '').trim() || String(await getSetting('parcel.default_courier', 'LBC Express')), waybillNo: waybill, deliveryType: dt.label || dt.code,
      deliveryCharge: dt.charge === undefined ? null : round2(num(dt.charge)) },
  };
}

/** The covers of a certificate with their period: from the parcel date for the cover days, or the transit. */
const coversAsIssued = (covers, date) => covers.map((c) => ({ ...c, from: date, to: c.coverDays ? addDays(date, c.coverDays - 1) : null }));

/** Queue the certificate e-mail (password-protected PDF) when the customer has an e-mail and parcel.email_certificate is on. */
async function queueCertificateEmail(db, x) {
  if (!x.email || (await getSetting('parcel.email_certificate', true)) === false) return null;
  const rule = String((await getSetting('parcel.certificate_password', 'loan_last6')) || 'none');
  const vars = { certificateNumber: x.certificate_number, customerName: x.customer_name, waybillNo: x.waybill_no, passwordHint: PASSWORD_HINTS[rule] || '' };
  const subject = renderTemplate(await getSetting('parcel.certificate_email_subject', 'Your parcel insurance certificate {{certificateNumber}}'), vars);
  const html = renderTemplate(await getSetting('parcel.certificate_email_body', '<p>Your certificate {{certificateNumber}} is attached.</p>'), vars);
  const id = await queueEmail({ db, to: x.email, subject, html, template: 'parcel-certificate', entity: 'marine_certificate', entityId: x.id,
    attachments: [documentAttachment('parcel-certificate', { certificateId: x.id }, `parcel-certificate-${x.certificate_number}.pdf`)] });
  await db.query('UPDATE open_cover_certificates SET email_id = $2, emailed_at = now() WHERE id = $1', [x.id, id]);
  return id;
}

/** Issue one parcel certificate (Add parcel, or a row of the upload inside its own transaction). Returns the certificate with its warnings. */
export async function issueParcel(coverId, body, user, { db = null, uploadId = null, defaultDate = null } = {}) {
  const run = async (tx) => {
    const cover = await getCoverRow(coverId, tx);
    if (cover.status !== 'active' || cover.cover_type !== 'parcel') throw conflict('Parcels can only be uploaded on an active Parcel / Courier open cover');
    const p = await checkParcel(tx, cover, body, { defaultDate });
    const covers = coversAsIssued(p.terms.covers || [], p.date);
    const number = await nextDocumentNumber('parcel_certificate', { db: tx, date: p.date, unique: { table: 'open_cover_certificates', column: 'certificate_number' } });
    const daily = cover.daily_declaration ? await assignDaily(tx, cover, p.date) : null;
    const v = p.values;
    const r = (await tx.query(`INSERT INTO open_cover_certificates(certificate_number, open_cover_id, kind, shipment_date, goods_description, invoice_value, markup_percent, insured_value,
        rate_percent, premium, issued_by, customer_name, loan_account, address_line, barangay, city, province, zip_code, mobile, email, documents_sent, courier, waybill_no, delivery_type,
        delivery_charge, covers, charge, late, possible_duplicate, daily_declaration_id, upload_id)
      VALUES ($1,$2,'parcel',$3,$4,0,0,$5,0,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24,$25,$26,$27) RETURNING id`,
    [number, cover.id, p.date, cover.goods_description, round2(covers.reduce((s, c) => s + num(c.sumInsured), 0)), premiumPerCertificate(covers), user.id, v.customerName, v.loanAccount,
      v.addressLine, v.barangay, v.city, v.province, v.zipCode, v.mobile, v.email, v.documentsSent, v.courier, v.waybillNo, v.deliveryType, v.deliveryCharge, JSON.stringify(covers),
      round2(num(p.terms.chargePerCertificate)), Boolean(daily?.late), p.duplicate, daily?.daily.id || null, uploadId])).rows[0];
    await recomputeOpenMonth(tx, cover.id, daily ? String(daily.daily.declaration_date).slice(0, 10) : p.date);
    const row = await getCertificateRow(r.id, tx);
    await queueCertificateEmail(tx, row);
    return { ...certificateOut(await getCertificateRow(r.id, tx)), warnings: [...p.warnings, ...(daily?.message ? [daily.message] : [])] };
  };
  return db ? run(db) : withTransaction(run);
}

/** Header check of an upload: every required column present (MSG-PCL-021). */
function checkHeaders(headers, columns) {
  const have = new Set(headers || []);
  for (const c of columns.filter((x) => x.required === true)) {
    if (![c.key, c.header, ...(c.aliases || [])].some((h) => have.has(normKey(h)))) {
      throw badRequest(`The file has no column ${c.header}: download the template again`, [{ path: 'file', message: `The file has no column ${c.header}: download the template again`, code: 'MSG-PCL-021' }]);
    }
  }
}

/** Columns of the cargo shipment list (FRS PJRN-09 13.2). */
export const SHIPMENT_COLUMNS = [
  { key: 'shipmentDate', header: 'SHIPMENT_DATE', aliases: ['shipment date', 'date'], required: true, format: 'Date DD/MM/YYYY or YYYY-MM-DD, within the period', example: '05/10/2026' },
  { key: 'conveyance', header: 'CONVEYANCE', required: true, format: 'A conveyance rated on the open cover (Land for inland)', example: 'Land' },
  { key: 'voyageFrom', header: 'VOYAGE_FROM', aliases: ['from'], required: true, format: 'Text 200', example: 'Manila' },
  { key: 'voyageTo', header: 'VOYAGE_TO', aliases: ['to'], required: true, format: 'Text 200', example: 'Batangas City' },
  { key: 'billOfLading', header: 'DELIVERY_RECEIPT', aliases: ['delivery receipt', 'waybill'], format: 'Waybill or delivery receipt', example: 'DR-0051234' },
  { key: 'vesselName', header: 'TRUCK_PLATE', aliases: ['truck plate', 'plate'], format: 'Plate of the truck', example: 'NBC 1234' },
  { key: 'goodsDescription', header: 'GOODS', format: 'Text; blank = the goods of the open cover', example: 'Auto parts' },
  { key: 'packing', header: 'PACKING', format: 'Text', example: '12 pallets' },
  { key: 'consignee', header: 'CONSIGNEE', format: 'Text', example: 'Batangas Auto Supply' },
  { key: 'invoiceValue', header: 'INVOICE_VALUE', aliases: ['invoice value'], required: true, format: 'Amount > 0; insured value within the limit of the conveyance', example: '850000' },
  { key: 'markupPercent', header: 'MARKUP_PCT', aliases: ['markup'], format: 'Decimal 2; blank = the mark-up of the open cover', example: '0' },
  { key: 'certificate', header: 'CERTIFICATE', format: 'Y issues a certificate; blank or N enters a declared item', allowed: ['Y', 'N'], example: 'N' },
];

/** Upload a list (parcels or cargo shipments): each row checked and issued on its own; failed rows and warnings listed. */
async function uploadRows({ coverId, rows, headers, fileName, itemDate = null }, user, kind) {
  if (!String(fileName || '').toLowerCase().endsWith('.xlsx')) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file', code: 'MSG-PCL-020' }]);
  const cover = await getCoverRow(coverId);
  if (kind === 'parcels' && (cover.status !== 'active' || cover.cover_type !== 'parcel')) throw conflict('Parcels can only be uploaded on an active Parcel / Courier open cover');
  if (kind === 'shipments' && (cover.status !== 'active' || cover.cover_type !== 'cargo')) throw conflict('Shipments can only be uploaded on an active Marine Cargo open cover');
  const columns = kind === 'parcels' ? PARCEL_COLUMNS : SHIPMENT_COLUMNS;
  checkHeaders(headers, columns);
  const max = Number(await getSetting('parcel.max_upload_rows', 2000));
  if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; at most ${max} rows can be uploaded at once`, [{ path: 'file', message: `The file has ${rows.length} rows; at most ${max} rows can be uploaded at once`, code: 'MSG-PCL-022' }]);
  const date = itemDate ? isoDate(itemDate) : await today();
  const up = await one('INSERT INTO open_cover_uploads(open_cover_id, kind, file_name, item_date, rows_total, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [cover.id, kind, fileName, date, rows.length, user.id]);
  const errors = [];
  const warnings = [];
  const created = [];
  for (const [i, raw] of rows.entries()) {
    const rowNo = i + 2;
    const v = mapColumns(raw, columns);
    try {
      let x;
      if (kind === 'parcels') {
        x = await withTransaction((db) => issueParcel(cover.id, v, user, { db, uploadId: up.id, defaultDate: date }));
      } else {
        const body = { ...v, shipmentDate: parcelDateOf(v.shipmentDate), invoiceValue: num(v.invoiceValue), markupPercent: v.markupPercent === undefined || v.markupPercent === '' ? undefined : num(v.markupPercent) };
        x = await withTransaction((db) => issueCertificate(cover.id, body, user.id, /^y/i.test(String(v.certificate || '')) ? 'certificate' : 'declared', { db, uploadId: up.id }));
      }
      created.push(x.certificateNumber);
      for (const w of x.warnings || []) warnings.push({ row: rowNo, message: w, text: `Row ${rowNo}: ${w}` });
    } catch (e) {
      const text = e.details?.map?.((d) => d.message).join('; ') || e.message;
      errors.push({ row: rowNo, message: text, text: `Row ${rowNo}: ${text}` });
    }
  }
  const messages = [...errors, ...warnings].sort((a, b) => a.row - b.row);
  await one('UPDATE open_cover_uploads SET rows_created = $2, rows_failed = $3, messages = $4 WHERE id = $1 RETURNING id', [up.id, created.length, errors.length, JSON.stringify(messages)]);
  return { uploadId: up.id, total: rows.length, created: created.length, failed: errors.length, errors, warnings, messages, certificates: created,
    message: `Processed ${rows.length} rows: ${created.length} created, ${errors.length} failed` };
}

export const uploadParcels = (args, user) => uploadRows(args, user, 'parcels');
export const uploadShipments = (args, user) => uploadRows(args, user, 'shipments');

export async function listUploads(coverId) {
  return many(`SELECT u.id, u.kind, u.file_name AS "fileName", u.item_date AS "itemDate", u.rows_total AS "rowsTotal", u.rows_created AS "rowsCreated", u.rows_failed AS "rowsFailed",
      u.messages, u.created_at AS "createdAt", us.display_name AS "createdBy" FROM open_cover_uploads u LEFT JOIN users us ON us.id = u.created_by
    WHERE u.open_cover_id = $1 ORDER BY u.created_at DESC LIMIT 100`, [coverId]);
}

/** Certificates of a parcel date that were not e-mailed (Print certificates of the day, MSG-PCL-034 when none). */
export async function certificatesOfDay(coverId, date) {
  const d = isoDate(date) || await today();
  const rows = await many(`${CERT_SELECT} WHERE x.open_cover_id = $1 AND x.kind = 'parcel' AND x.shipment_date = $2 AND x.status <> 'cancelled' AND x.email_id IS NULL
    ORDER BY x.certificate_number`, [coverId, d]);
  if (!rows.length) throw conflict(`All certificates of ${d} were e-mailed: nothing to print`);
  return { date: d, rows };
}

/**
 * Request the reversal of a declared certificate (FR-PCL-014): reason required, within parcel.reversal_max_days of the
 * parcel date; one request at a time. Approved by a second user holding approve:marine.
 */
export async function requestReversal(id, reason, user) {
  if (!String(reason || '').trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'Enter the reason for the cancellation', code: 'MSG-PCL-035' }]);
  const x = await getCertificateRow(id);
  if (x.status !== 'declared') throw conflict(`Certificate ${x.certificate_number} is ${x.status}: only a declared certificate is reversed (cancel one not yet declared)`);
  if (x.reversal_status === 'pending') throw conflict(`The reversal of certificate ${x.certificate_number} is already waiting for approval`);
  const max = Number(await getSetting('parcel.reversal_max_days', 60));
  if (String(x.shipment_date).slice(0, 10) < addDays(await today(), -max)) {
    throw conflict(`Certificate ${x.certificate_number} is more than ${max} days old and can no longer be reversed`);
  }
  await one(`UPDATE open_cover_certificates SET reversal_status = 'pending', reversal_reason = $2, reversal_requested_by = $3, reversal_requested_at = now(), reversal_decided_by = NULL,
    reversal_decided_at = NULL, reversal_remark = NULL, updated_at = now() WHERE id = $1 RETURNING id`, [x.id, String(reason).trim(), user.id]);
  return certificateOut(await getCertificateRow(x.id));
}

/**
 * Approve or return a reversal (approve:marine, never the requester). Approved: the certificate is Reversed and joins
 * the draft monthly declaration of today's month as a negative line (or the next one opened).
 */
export async function decideReversal(id, { decision, remark = null }, user) {
  const x = await getCertificateRow(id);
  if (x.reversal_status !== 'pending') throw conflict(`Certificate ${x.certificate_number} has no reversal waiting for approval`);
  if (x.reversal_requested_by === user.id) throw forbidden('The approver must be different from the user who requested the reversal');
  if (decision === 'return') {
    if (!String(remark || '').trim()) throw badRequest('Validation failed', [{ path: 'remark', message: 'Enter the remark for returning the reversal' }]);
    await one(`UPDATE open_cover_certificates SET reversal_status = 'returned', reversal_decided_by = $2, reversal_decided_at = now(), reversal_remark = $3, updated_at = now()
      WHERE id = $1 RETURNING id`, [x.id, user.id, remark]);
    return { certificate: certificateOut(await getCertificateRow(x.id)), message: `Reversal of certificate ${x.certificate_number} returned` };
  }
  const now = await today();
  await withTransaction(async (db) => {
    await db.query(`UPDATE open_cover_certificates SET status = 'reversed', reversal_status = 'approved', reversal_decided_by = $2, reversal_decided_at = now(), reversal_remark = $3,
      updated_at = now() WHERE id = $1`, [x.id, user.id, remark || null]);
    const decl = (await db.query("SELECT id FROM open_cover_declarations WHERE open_cover_id = $1 AND status = 'draft' AND period_to >= $2 ORDER BY period_from LIMIT 1",
      [x.open_cover_id, now])).rows[0];
    if (decl) await recompute(decl.id, db);
  });
  const after = await getCertificateRow(x.id);
  return { certificate: certificateOut(after),
    message: after.reversal_number ? `Certificate ${x.certificate_number} reversed on declaration ${after.reversal_number}` : `Certificate ${x.certificate_number} reversed on the next declaration` };
}

/** Pending reversals of a cover (for its page) */
export async function pendingReversals(coverId) {
  return (await many(`${CERT_SELECT} WHERE x.open_cover_id = $1 AND x.reversal_status = 'pending' ORDER BY x.reversal_requested_at`, [coverId])).map(certificateOut);
}
