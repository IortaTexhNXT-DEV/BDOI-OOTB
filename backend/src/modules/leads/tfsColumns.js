/**
 * Columns of the TFS account file (TIS-BRD-LEAD-01, INTG-03; gap register GAP-SALES-06). TFS_COLUMNS is the delivered
 * map; the setting leads.tfs_column_map (migration 0685) holds the header and the other names of each field as TISPH
 * configures them, so a change in the TFS file layout is a configuration change on Master > Configuration (IT
 * AppSupport, write:settings, audited) rather than a code change. A field the setting leaves out keeps its delivered
 * column. The import and the upload template both read tfsColumns().
 */
import { getSetting } from '../../lib/settings.js';

const normKey = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Delivered columns of the TFS account file (the default of leads.tfs_column_map). */
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

export const TFS_COLUMN_MAP_KEY = 'leads.tfs_column_map';
const FIELD_KEYS = new Set(TFS_COLUMNS.map((c) => c.key));

/** The delivered map in the shape of the setting: { field: { header, aliases } }. */
export const defaultTfsColumnMap = () => Object.fromEntries(TFS_COLUMNS.map((c) => [c.key, { header: c.header, aliases: [...(c.aliases || [])] }]));

/**
 * Errors of a value of leads.tfs_column_map: an object of known fields, each with a header (text up to 80 characters)
 * and optional aliases (a list of texts); no column name may be given to two fields (compared without case, spaces or
 * punctuation, as the file is read). `path` names the setting in the errors.
 */
export function tfsColumnMapErrors(value, path = TFS_COLUMN_MAP_KEY) {
  const errors = [];
  const err = (message) => errors.push({ path, message });
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    err('must be an object of TFS fields, each with its header and aliases');
    return errors;
  }
  const owner = new Map();
  for (const [field, spec] of Object.entries(value)) {
    if (!FIELD_KEYS.has(field)) { err(`${field} is not a field of the TFS account file (${[...FIELD_KEYS].join(', ')})`); continue; }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) { err(`${field} must be an object with header and aliases`); continue; }
    const header = typeof spec.header === 'string' ? spec.header.trim() : '';
    if (!header || header.length > 80) err(`${field}: header is required (up to 80 characters)`);
    if (spec.aliases !== undefined && (!Array.isArray(spec.aliases) || spec.aliases.some((a) => typeof a !== 'string' || !a.trim() || a.length > 80))) {
      err(`${field}: aliases must be a list of column names (up to 80 characters each)`);
      continue;
    }
    for (const name of [header, ...(spec.aliases || [])].filter(Boolean)) {
      const k = normKey(name);
      if (owner.has(k) && owner.get(k) !== field) err(`Column name "${name}" is given to both ${owner.get(k)} and ${field}`);
      owner.set(k, field);
    }
  }
  return errors;
}

/** The columns of the TFS account file in force: the delivered columns with the header and aliases of the setting. */
export async function tfsColumns() {
  const map = await getSetting(TFS_COLUMN_MAP_KEY, null);
  // a value that no longer passes (edited outside the screen) is not used: the delivered columns stay in force
  if (!map || tfsColumnMapErrors(map).length) return TFS_COLUMNS;
  return TFS_COLUMNS.map((c) => (map[c.key] ? { ...c, header: map[c.key].header.trim(), aliases: (map[c.key].aliases || []).map((a) => a.trim()) } : c));
}
