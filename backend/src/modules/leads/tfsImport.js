/**
 * TFS account import (Prospects > Bulk Upload > TFS accounts; TIS-BRD-LEAD-01, INTG-03 lead import). Toyota Financial
 * Services sends its accounts as a file; each row becomes a prospect with the full TFS detail set: reference number,
 * Loan ID, customer, contacts, address, birthday, vehicle, insurance provider, policy expiry, loan dates, product group
 * and SRP. Source TFS (Lead Source master), Customer Type TFS. The upload is stamped as a batch (LIB-yyyy-nnnnn).
 *
 * Rows are loaded one by one; a failed row does not stop the others (NFR-07.4). A row without a policy expiry date
 * gives no prospect (leads.tfs_expiry_required); an insurance provider the Insurance Company master does not know is
 * refused; a Loan ID twice in the file is refused the second time. A Loan ID already on a prospect updates that
 * prospect (TFS detail, and the status and disposition when given) instead of creating a second one.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { isoDate } from '../../lib/dates.js';
import { mapColumns } from '../documents/tabular.js';
import { assertLeadValues, createLead, getLead, toLead, VEHICLE_KEYS } from './service.js';

/** Columns of the TFS account file; the upload template is built from this list. */
export const TFS_COLUMNS = [
  { key: 'tfsReference', header: 'Reference No.', aliases: ['reference number', 'ref no', 'account reference'], format: 'TFS reference number of the account', example: 'TFS-2026-104233' },
  { key: 'loanId', header: 'Loan ID', aliases: ['loan number', 'loan no'], required: true, format: 'TFS loan identifier; one prospect per loan', example: 'LN-0094418' },
  { key: 'firstName', header: 'First Name', aliases: ['fname'], required: 'First Name or Company Name', format: 'Text (up to 100 characters)', example: 'Andrea' },
  { key: 'lastName', header: 'Last Name', aliases: ['surname'], format: 'Text (up to 100 characters)', example: 'Villanueva' },
  { key: 'companyName', header: 'Company Name', aliases: ['company'], required: 'First Name or Company Name', format: 'Text; for a corporate (fleet) account', example: '' },
  { key: 'DOB', header: 'Birthday', aliases: ['date of birth', 'birthdate', 'dob'], format: 'Date YYYY-MM-DD', example: '1987-06-21' },
  { key: 'contactNumber', header: 'Mobile', aliases: ['mobile number', 'contact number', 'phone'], format: 'Mobile number', example: '09173047105' },
  { key: 'emailId', header: 'Email', aliases: ['e-mail', 'email address'], format: 'E-mail address', example: 'andrea.villanueva@gmail.com' },
  { key: 'houseNo', header: 'Address', aliases: ['house / unit no.', 'house no', 'street address'], format: 'House, unit, street', example: '12 Mabini St.' },
  { key: 'barangay', header: 'Barangay', format: 'Text', example: 'San Antonio' },
  { key: 'city', header: 'City / Municipality', aliases: ['city', 'municipality'], format: 'City or municipality', example: 'Pasig City' },
  { key: 'province', header: 'Province', format: 'Province (Metro Manila for NCR)', example: 'Metro Manila' },
  { key: 'zipCode', header: 'ZIP Code', aliases: ['zip'], format: 'Four digits', example: '1600' },
  { key: 'make', header: 'Vehicle Make', aliases: ['make', 'brand'], format: 'Text', example: 'Toyota' },
  { key: 'model', header: 'Vehicle Model', aliases: ['model'], format: 'Text', example: 'Raize' },
  { key: 'variant', header: 'Vehicle Variant', aliases: ['variant'], format: 'Text', example: '1.0 Turbo CVT' },
  { key: 'modelYear', header: 'Model Year', aliases: ['year model', 'year'], format: 'Four digits', example: '2023' },
  { key: 'plateNumber', header: 'Plate No.', aliases: ['plate number', 'plate'], format: 'Text', example: 'NAB 1234' },
  { key: 'chassisNumber', header: 'Chassis No.', aliases: ['chassis number', 'vin'], format: 'Text', example: 'MHKA4DE30PJ012345' },
  { key: 'engineNumber', header: 'Engine No.', aliases: ['engine number', 'motor number'], format: 'Text', example: '1KR0123456' },
  { key: 'insuranceProvider', header: 'Insurance Provider', aliases: ['insurer', 'insurance company'], format: 'Insurer of Master > Insurance Company (code or name)', example: 'Malayan Insurance Co., Inc.' },
  { key: 'policyExpiryDate', header: 'Policy Expiry Date', aliases: ['expiry date', 'insurance expiry'], required: true, format: 'Date YYYY-MM-DD; an account without it gives no prospect', example: '2026-12-15' },
  { key: 'loanStartDate', header: 'Loan Start Date', aliases: ['loan start'], format: 'Date YYYY-MM-DD', example: '2023-12-15' },
  { key: 'loanBookingDate', header: 'Loan Booking Date', aliases: ['booking date'], format: 'Date YYYY-MM-DD', example: '2023-12-10' },
  { key: 'loanMaturityDate', header: 'Loan Maturity Date', aliases: ['maturity date'], format: 'Date YYYY-MM-DD', example: '2028-12-15' },
  { key: 'productGroup', header: 'Product Group', aliases: ['product'], format: 'Text (for example Motor, Credit Life)', example: 'Motor' },
  { key: 'srp', header: 'SRP', aliases: ['suggested retail price', 'unit price'], format: 'Amount in pesos, no thousands separator', example: '1078000' },
  { key: 'leadCategory', header: 'Lead Category', aliases: ['category'], format: 'Retail or Corporate; Retail when empty', allowed: ['Retail', 'Corporate'], example: 'Retail' },
  { key: 'status', header: 'Status', aliases: ['call status', 'lead status'], format: 'Prospect status (leads.statuses); on an account already loaded it updates the prospect', example: '' },
  { key: 'disposition', header: 'Disposition', aliases: ['call disposition'], format: 'Interested, Not Interested, Uncontacted, Call back or Renewed', example: '' },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The insurer named in a row (code or name, active), or null. */
async function insurerOf(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  return one("SELECT id, name FROM insurance_companies WHERE status = 'active' AND (lower(code) = lower($1) OR lower(name) = lower($1)) ORDER BY id LIMIT 1", [v]);
}

/** The Lead Source of TFS accounts: the master record with code or name TFS, else the text TFS. */
async function tfsSource() {
  const r = await one("SELECT name FROM master_records WHERE type_code = 'lead-source' AND status = 'active' AND (lower(code) = 'tfs' OR lower(name) = 'tfs') LIMIT 1");
  return r?.name || 'TFS';
}

/** The prospect body of one row: { body, errors }. */
async function rowBody(row, { expiryRequired, source }) {
  const v = mapColumns(row, TFS_COLUMNS);
  const errors = [];
  for (const k of ['DOB', 'policyExpiryDate', 'loanStartDate', 'loanBookingDate', 'loanMaturityDate']) {
    if (v[k] && !DATE.test(String(v[k])) && !isoDate(v[k])) errors.push(`${TFS_COLUMNS.find((c) => c.key === k).header} must be a date YYYY-MM-DD`);
  }
  if (!v.loanId) errors.push('Loan ID is required');
  if (!v.firstName && !v.companyName) errors.push('First Name or Company Name is required');
  if (expiryRequired && !v.policyExpiryDate) errors.push('No policy expiry date: no prospect is created for this account');
  let insurer = null;
  if (v.insuranceProvider) {
    insurer = await insurerOf(v.insuranceProvider);
    if (!insurer) errors.push(`Insurance Provider ${v.insuranceProvider} is not an insurer of Master > Insurance Company`);
  }
  const vehicle = Object.fromEntries(VEHICLE_KEYS.filter((k) => v[k]).map((k) => [k, v[k]]));
  const body = {
    tfsReference: v.tfsReference || null, loanId: v.loanId, firstName: v.firstName, lastName: v.lastName, companyName: v.companyName, DOB: v.DOB, contactNumber: v.contactNumber,
    emailId: v.emailId || null, houseNo: v.houseNo, barangay: v.barangay, city: v.city, province: v.province, zipCode: v.zipCode, country: 'Philippines',
    vehicle, insuranceProviderId: insurer?.id ?? null, policyExpiryDate: v.policyExpiryDate || null, loanStartDate: v.loanStartDate || null,
    loanBookingDate: v.loanBookingDate || null, loanMaturityDate: v.loanMaturityDate || null, productGroup: v.productGroup || null, srp: v.srp || null,
    leadCategory: v.leadCategory || 'Retail', customerType: 'TFS', source, ...(v.status ? { status: v.status } : {}), ...(v.disposition ? { disposition: v.disposition } : {}),
    lob: /motor/i.test(String(v.productGroup || '')) ? 'MOTOR' : undefined,
  };
  for (const k of Object.keys(body)) if (body[k] === undefined || body[k] === '') delete body[k];
  return { body, errors };
}

/** The TFS detail of a row written over the prospect already loaded for the loan (and its status / disposition). */
async function updateFromRow(lead, body, batchId, userId) {
  const cols = {
    tfs_reference: body.tfsReference ?? lead.tfs_reference, insurance_provider_id: body.insuranceProviderId ?? lead.insurance_provider_id,
    policy_expiry_date: isoDate(body.policyExpiryDate) ?? lead.policy_expiry_date, loan_start_date: isoDate(body.loanStartDate) ?? lead.loan_start_date,
    loan_booking_date: isoDate(body.loanBookingDate) ?? lead.loan_booking_date, loan_maturity_date: isoDate(body.loanMaturityDate) ?? lead.loan_maturity_date,
    product_group: body.productGroup ?? lead.product_group, srp: body.srp !== undefined ? Number(String(body.srp).replace(/,/g, '')) : lead.srp,
    vehicle: JSON.stringify({ ...(lead.vehicle || {}), ...(body.vehicle || {}) }), import_batch_id: batchId,
    ...(body.status ? { status: body.status } : {}), ...(body.disposition ? { disposition: body.disposition } : {}),
  };
  await assertLeadValues(cols, lead);
  const keys = Object.keys(cols);
  await query(`UPDATE leads SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2}, updated_at = now() WHERE id = $1`,
    [lead.id, ...Object.values(cols), userId]);
  return getLead(lead.id);
}

/** A new upload batch: { id, number }. */
export async function newBatch(kind, fileName, rows, userId) {
  const number = await nextDocumentNumber('lead_import', { unique: { table: 'lead_import_batches', column: 'batch_number' } });
  const b = await one('INSERT INTO lead_import_batches(batch_number, kind, file_name, rows_total, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id', [number, kind, fileName, rows, userId]);
  return { id: b.id, number };
}

export async function closeBatch(batchId, { created, updated, errors }) {
  await query('UPDATE lead_import_batches SET created = $2, updated = $3, failed = $4, errors = $5 WHERE id = $1', [batchId, created, updated, errors.length, JSON.stringify(errors)]);
}

/**
 * Load the rows of a TFS account file. onLead(lead, action) is called for every prospect created or updated (audit).
 * Returns { batchNumber, message, total, created, updated, failed, errors: [{ row, message }] }.
 */
export async function importTfs(rows, { fileName, userId, onLead }) {
  if (!rows.length) throw badRequest('The file has no data rows (first row must be the column headers)');
  const expiryRequired = (await getSetting('leads.tfs_expiry_required', true)) !== false;
  const source = await tfsSource();
  const batch = await newBatch('tfs', fileName, rows.length, userId);
  const seen = new Set();
  const errors = [];
  let created = 0;
  let updated = 0;
  for (const [i, row] of rows.entries()) {
    const rowNo = i + 2;
    const { body, errors: rowErrors } = await rowBody(row, { expiryRequired, source });
    const loan = String(body.loanId || '').toLowerCase();
    if (loan && seen.has(loan)) rowErrors.push(`Loan ID ${body.loanId} appears twice in the file`);
    if (rowErrors.length) { errors.push({ row: rowNo, message: rowErrors.join('; ') }); continue; }
    seen.add(loan);
    try {
      const existing = (await many('SELECT * FROM leads WHERE lower(loan_id) = $1 AND deleted_at IS NULL', [loan]))[0];
      if (existing) {
        const lead = await updateFromRow(existing, body, batch.id, userId);
        updated += 1;
        await onLead?.(toLead(lead), 'tfs-update', toLead(existing));
      } else {
        const lead = await withTransaction(async (c) => {
          const l = await createLead(body, userId, c);
          await c.query('UPDATE leads SET import_batch_id = $2 WHERE id = $1', [l.id, batch.id]);
          return getLead(l.id, c);
        });
        created += 1;
        await onLead?.(toLead(lead), 'tfs-import');
      }
    } catch (e) {
      errors.push({ row: rowNo, message: e.details?.length ? e.details.map((d) => d.message).join('; ') : e.message });
    }
  }
  await closeBatch(batch.id, { created, updated, errors });
  return { batchNumber: batch.number, total: rows.length, created, updated, failed: errors.length, errors: errors.map((e) => ({ ...e, message: `Row ${e.row}: ${e.message}` })),
    message: `Processed ${rows.length} rows: ${created} created, ${updated} updated, ${errors.length} failed (batch ${batch.number})` };
}
