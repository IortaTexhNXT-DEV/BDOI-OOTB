/**
 * Loan bookings upload of Scheme Issuance (TIS-BRD-SCHM-01 FR-SIS-002): the TFSPH list of the loans booked under the
 * schemes. Each row is one application, checked and priced as on screen (FR-SIS-001, 003, 004) and given its checklist;
 * a row with any problem fails with its row number and creates nothing, the others go on. The batch (SB-yyyy-nnnnn)
 * keeps the file name, the counts and the failed rows.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { mapColumns, normKey } from '../documents/tabular.js';
import { saveApplication } from './service.js';

/** Columns of the Loan bookings file (FRS SCHM-01 13.1); the template (Scheme_Loan_Bookings_Upload_Template.xlsx) is built from this list. */
export const LOAN_BOOKING_COLUMNS = [
  { key: 'schemeNo', header: 'Scheme Code', aliases: ['scheme no', 'scheme'], required: true, format: 'Scheme No. of an Active scheme of the Scheme Master', example: 'S1-STD-2026' },
  { key: 'loanAccount', header: 'Loan Account No.', aliases: ['loan account', 'tfs loan account'], required: true, format: '10 digits; unique among open applications', example: '8005123456' },
  { key: 'bankCode', header: 'Financing Bank Code', aliases: ['bank code'], format: 'TFSPH or a TFSPH branch channel; TFSPH when empty', example: 'TFS-HQ' },
  { key: 'bookingDate', header: 'Loan Booking Date', aliases: ['booking date'], required: true, format: 'Date YYYY-MM-DD, not in the future', example: '2026-10-05' },
  { key: 'releaseDate', header: 'Vehicle Release Date', aliases: ['release date'], required: true, format: 'Date YYYY-MM-DD, not in the future, within the backdating limit (schemes.max_backdating_days)', example: '2026-10-07' },
  { key: 'loanTermMonths', header: 'Loan Term (months)', aliases: ['loan term'], required: true, format: 'Whole number, 12 to 84', example: '60' },
  { key: 'firstName', header: 'Borrower First Name', aliases: ['first name'], required: 'Borrower First Name or Borrower Company Name', format: 'Text', example: 'Ramon' },
  { key: 'lastName', header: 'Borrower Last Name', aliases: ['last name'], format: 'Text', example: 'Villanueva' },
  { key: 'companyName', header: 'Borrower Company Name', aliases: ['company name'], required: 'Borrower First Name or Borrower Company Name', format: 'Text; for a loan to a company', example: '' },
  { key: 'birthday', header: 'Birthday', aliases: ['date of birth', 'dob'], required: true, format: 'Date YYYY-MM-DD; drives the KYC conditions (21 or younger)', example: '1992-03-14' },
  { key: 'nationality', header: 'Nationality', format: 'Text; a non-Filipino borrower adds SRRV or ACR / ICR to the checklist', example: 'Filipino' },
  { key: 'mobile', header: 'Mobile', aliases: ['mobile number'], format: 'Mobile number', example: '09175550123' },
  { key: 'email', header: 'Email', aliases: ['e-mail'], format: 'E-mail address', example: 'ramon.villanueva@example.ph' },
  { key: 'address', header: 'Address', format: 'House / unit, street, barangay', example: '18 Sampaguita St., Barangay Bel-Air' },
  { key: 'city', header: 'City', aliases: ['city / municipality'], format: 'City or municipality', example: 'Makati City' },
  { key: 'province', header: 'Province', format: 'Province (Metro Manila for NCR)', example: 'Metro Manila' },
  { key: 'kycSource', header: 'KYC Source', format: 'TFSPH (TFSPH KYC confirmation) or Full KYC; TFSPH when empty', allowed: ['TFSPH', 'Full KYC'], example: 'TFSPH' },
  { key: 'idType', header: 'ID Type', required: true, format: 'ID presented at loan approval, one of the TFSPH list (schemes.kyc_primary_ids, schemes.kyc_secondary_ids)', example: 'PhilID' },
  { key: 'idNumber', header: 'ID Number', required: true, format: 'Number of the ID', example: '1234-5678-9012-3456' },
  { key: 'dealerCode', header: 'Dealer Branch Code', aliases: ['dealer code'], required: true, format: 'Code of a dealer group or branch channel', example: 'TMK-MKT' },
  { key: 'make', header: 'Make', required: true, format: 'Vehicle brand of the Vehicle master', example: 'Toyota' },
  { key: 'model', header: 'Model', required: true, format: 'Vehicle model, in the scheme range', example: 'Vios' },
  { key: 'variant', header: 'Variant', format: 'Model variant', example: '1.3 XLE CVT' },
  { key: 'yearModel', header: 'Year Model', aliases: ['year'], required: true, format: 'Four digits; brand-new only', example: '2026' },
  { key: 'color', header: 'Color', aliases: ['colour'], format: 'Text', example: 'Silver Metallic' },
  { key: 'chassisNumber', header: 'Chassis Number', aliases: ['vin'], required: true, format: 'Chassis / VIN, unique', example: 'MR2B29F30R1123456' },
  { key: 'engineNumber', header: 'Engine Number', aliases: ['motor number'], required: true, format: 'Engine / motor number', example: '2NR-F123456' },
  { key: 'conductionSticker', header: 'Conduction Sticker', format: 'Conduction sticker of a new car without plates', example: 'A1B234' },
  { key: 'plateNumber', header: 'Plate Number', format: 'When already issued', example: '' },
  { key: 'invoicePrice', header: 'Invoice Price', aliases: ['sum insured'], required: true, format: 'Amount in PHP (the year-1 sum insured), more than 0', example: '1015000' },
  { key: 'insurer', header: 'Insurer', format: 'Name or code of an insurer of the scheme; the scheme\'s when it names one', example: 'PIONEER' },
  { key: 'araSignedOn', header: 'ARA Signed On', required: 'Scheme 1', format: 'Date YYYY-MM-DD', example: '2026-10-05' },
  { key: 'araPaymentMode', header: 'ARA Payment Mode', required: 'Scheme 1', format: 'Code of schemes.ara_payment_modes', allowed: ['ADA', 'PDC', 'ONLINE', 'CARD'], example: 'ADA' },
];

/** The body of an application from an uploaded row. */
async function bodyOf(db, v) {
  const insurer = v.insurer ? (await db.query('SELECT id FROM insurance_companies WHERE lower(code) = lower($1) OR lower(name) = lower($1) LIMIT 1', [String(v.insurer).trim()])).rows[0] : null;
  if (v.insurer && !insurer) throw badRequest(`Insurer ${v.insurer} is not on the Insurance Company master`);
  return {
    schemeNo: v.schemeNo, loanAccount: v.loanAccount, bankChannelId: v.bankCode || undefined, bookingDate: v.bookingDate, releaseDate: v.releaseDate,
    loanTermMonths: v.loanTermMonths ? Number(v.loanTermMonths) : undefined,
    borrower: { firstName: v.firstName, lastName: v.lastName, companyName: v.companyName, birthday: v.birthday, nationality: v.nationality, mobile: v.mobile, email: v.email,
      address: v.address, city: v.city, province: v.province, idType: v.idType, idNumber: v.idNumber },
    kycSource: v.kycSource ? (/full/i.test(v.kycSource) ? 'full' : 'tfs') : undefined, dealerChannelId: v.dealerCode,
    make: v.make, model: v.model, variant: v.variant, yearModel: v.yearModel, color: v.color, chassisNumber: v.chassisNumber, engineNumber: v.engineNumber,
    conductionSticker: v.conductionSticker, plateNumber: v.plateNumber, invoicePrice: v.invoicePrice, insuranceCompanyId: insurer?.id, araSignedOn: v.araSignedOn,
    araPaymentMode: v.araPaymentMode ? String(v.araPaymentMode).trim().toUpperCase() : undefined,
  };
}

/** Upload the day's loan bookings (rows of the Data sheet, headers normalised). */
export async function uploadBookings({ rows, headers, fileName }, user) {
  if (!String(fileName || '').toLowerCase().endsWith('.xlsx')) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file', code: 'MSG-SIS-009' }]);
  const have = new Set(headers || []);
  for (const c of LOAN_BOOKING_COLUMNS.filter((x) => x.required === true)) {
    if (![c.key, c.header, ...(c.aliases || [])].some((h) => have.has(normKey(h)))) {
      throw badRequest(`The file does not match the template: column ${c.header} is missing`, [{ path: 'file', message: `The file does not match the template: column ${c.header} is missing`, code: 'MSG-SIS-010' }]);
    }
  }
  const max = Number(await getSetting('schemes.max_rows', 2000));
  if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; at most ${max} rows can be uploaded at once`, [{ path: 'file', message: `The file has ${rows.length} rows; at most ${max} rows can be uploaded at once`, code: 'MSG-SIS-011' }]);
  const batchNumber = await nextDocumentNumber('scheme_booking_batch', { unique: { table: 'scheme_booking_batches', column: 'batch_number' } });
  const batch = await one('INSERT INTO scheme_booking_batches(batch_number, file_name, rows_total, created_by) VALUES ($1,$2,$3,$4) RETURNING id', [batchNumber, fileName, rows.length, user.id]);
  const errors = [];
  const created = [];
  for (const [i, raw] of rows.entries()) {
    const rowNo = i + 2;
    const v = mapColumns(raw, LOAN_BOOKING_COLUMNS);
    try {
      const r = await withTransaction(async (db) => saveApplication(null, await bodyOf(db, v), user, { db, strict: true, batchId: batch.id, rowNo }));
      created.push(r.id);
    } catch (e) {
      const text = e.details?.map?.((d) => d.message).join('; ') || e.message;
      errors.push({ row: rowNo, message: text, text: `Row ${rowNo}: ${text}` });
    }
  }
  const status = errors.length === 0 ? 'processed' : created.length === 0 ? 'failed' : 'partial';
  await one('UPDATE scheme_booking_batches SET rows_created = $2, rows_failed = $3, status = $4, errors = $5 WHERE id = $1 RETURNING id', [batch.id, created.length, errors.length, status, JSON.stringify(errors)]);
  return { batchId: batch.id, batchNumber, total: rows.length, created: created.length, failed: errors.length, errors, applicationIds: created,
    message: `Processed ${rows.length} rows: ${created.length} created, ${errors.length} failed` };
}

export async function listBatches() {
  return many(`SELECT b.id, b.batch_number AS "batchNumber", b.file_name AS "fileName", b.rows_total AS "rowsTotal", b.rows_created AS "rowsCreated", b.rows_failed AS "rowsFailed",
      b.status, b.errors, b.created_at AS "createdAt", u.display_name AS "createdBy"
    FROM scheme_booking_batches b LEFT JOIN users u ON u.id = b.created_by ORDER BY b.created_at DESC LIMIT 200`);
}
