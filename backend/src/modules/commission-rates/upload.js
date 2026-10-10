/**
 * Upload rules (Master > Finance > Commission Rate Matrix > Upload rules; FRS FR-CMR-005): an insurer's net rate
 * schedule as a spreadsheet with one row per peril of a rule. Rows with the same keys and dates form one rule; a rule
 * whose rows are not all valid is not created and its rows are listed as failed. Every rule created by an upload is a
 * draft submitted for approval (Configuration Approvals) while rule changes are reviewed, else in force at once.
 */
import crypto from 'node:crypto';
import { many } from '../../db/pool.js';
import { HttpError, badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { readXlsx } from '../documents/xlsx.js';
import { sendWorkbook } from '../documents/uploadTemplates.js';
import { CHANNEL_TYPES, POLICY_TYPES } from './resolve.js';
import { PERILS, PERIL_BASES } from './perils.js';
import { createRate } from './service.js';

export const UPLOAD_COLUMNS = [
  { key: 'insurer', header: 'Insurer', required: 'when no product or line of business', format: 'Insurer code of Master > Insurance Company', example: 'MALAYAN' },
  { key: 'product', header: 'Product', required: 'when no insurer or line of business', format: 'Product code (MOTOR, PA ...)', example: 'MOTOR' },
  { key: 'lineOfBusiness', header: 'Line of Business', required: false, format: 'Code of the Line of Business master', example: '' },
  { key: 'policyType', header: 'Policy Type', required: false, format: 'new, renewal or any (default any)', allowed: POLICY_TYPES, example: 'new' },
  { key: 'channelType', header: 'Channel Type', required: false, format: 'Blank for any channel', allowed: CHANNEL_TYPES, example: '' },
  { key: 'motorType', header: 'Motor Type', required: false, format: 'Motor type code (PC-SEDAN, PC-OTHER ...); blank for any', example: 'PC-OTHER' },
  { key: 'siFrom', header: 'Sum Insured From', required: false, format: 'Amount; blank for no band', example: '' },
  { key: 'siTo', header: 'Sum Insured To', required: false, format: 'Amount (inclusive); blank for no band', example: '' },
  { key: 'effectiveFrom', header: 'Effective From', required: true, format: 'YYYY-MM-DD, not before today', example: '2026-11-01' },
  { key: 'effectiveTo', header: 'Effective To', required: false, format: 'YYYY-MM-DD; blank for open-ended', example: '' },
  { key: 'peril', header: 'Peril', required: true, format: 'OD, AON, BI, PD, APPA or RSA', allowed: PERILS.map((p) => p.code), example: 'OD' },
  { key: 'basis', header: 'Basis', required: true, format: 'issuing-remitting, premium-pct or none', allowed: PERIL_BASES, example: 'issuing-remitting' },
  { key: 'issuing', header: 'Issuing %', required: false, format: '% of the sum insured, up to 4 decimals (issuing-remitting)', example: '2.0000' },
  { key: 'tisRemitting', header: 'TIS Remitting %', required: 'issuing-remitting perils', format: '% of the sum insured', example: '1.7000' },
  { key: 'insurerNet', header: 'Insurer Net %', required: 'issuing-remitting perils', format: '% of the sum insured', example: '1.3000' },
  { key: 'commissionPct', header: 'Commission %', required: 'premium-pct perils', format: '% of the peril premium', example: '' },
  { key: 'remarks', header: 'Remarks', required: false, format: 'Text', example: 'Malayan net rate schedule Nov 2026' },
];

const SAMPLES = [
  { insurer: 'MALAYAN', product: 'MOTOR', policyType: 'new', motorType: 'PC-OTHER', effectiveFrom: '2026-11-01', peril: 'OD', basis: 'issuing-remitting', issuing: '2.0000', tisRemitting: '1.7000', insurerNet: '0.9500' },
  { insurer: 'MALAYAN', product: 'MOTOR', policyType: 'new', motorType: 'PC-OTHER', effectiveFrom: '2026-11-01', peril: 'AON', basis: 'issuing-remitting', issuing: '0.5000', tisRemitting: '0.4000', insurerNet: '0.2500' },
  { insurer: 'MALAYAN', product: 'MOTOR', policyType: 'new', motorType: 'PC-OTHER', effectiveFrom: '2026-11-01', peril: 'BI', basis: 'premium-pct', commissionPct: '25' },
];

export const templateDef = (maxRows) => ({
  id: 'commission-rules', title: 'Commission rules', file: 'Commission_Rules_Template.xlsx', menu: 'Master > Finance > Commission Rate Matrix > Upload rules',
  fileTypes: '.xlsx', maxRows, columns: UPLOAD_COLUMNS, samples: SAMPLES,
  onError: 'Rows with the same keys and dates form one rule. A rule whose rows are not all valid is not created; its rows are listed as failed. The other rules are created and sent for approval.',
  notes: ['One row per peril of a rule: Own Damage / Theft (OD) and Acts of Nature (AON) with their issuing, TIS remitting and insurer net rates; Bodily Injury (BI), Property Damage (PD) and Auto Passenger Personal Accident (APPA) with their commission % of the premium.',
    'A peril of the product that has no row earns no commission (basis none).'],
});

export const sendRulesTemplate = async (res) => sendWorkbook(res, templateDef(Number(await getSetting('commission.rules_max_rows', 2000)) || 2000));

const normKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function readRules(file) {
  const name = String(file?.originalname || '').toLowerCase();
  const zip = file?.buffer && file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;
  if (!name.endsWith('.xlsx') || !zip) throw new HttpError(400, 'Upload an Excel (.xlsx) file', [{ path: 'file', code: 'FILE_TYPE', message: 'Upload an Excel (.xlsx) file' }]);
  let table;
  try { table = readXlsx(file.buffer); } catch (e) { throw badRequest(`Could not read the file: ${e.message}`); }
  const rows = table.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (!rows.length) throw badRequest('The file is empty');
  const keys = rows[0].map(normKey);
  const idx = {};
  for (const c of UPLOAD_COLUMNS) idx[c.key] = keys.findIndex((k) => k === normKey(c.header) || k === normKey(c.key));
  const missing = UPLOAD_COLUMNS.filter((c) => c.required === true && idx[c.key] < 0);
  if (missing.length) {
    const message = 'The file does not have the template columns. Download the template and copy your rows into it.';
    throw new HttpError(400, message, [{ path: 'file', code: 'HEADER_MISSING', message }]);
  }
  return rows.slice(1).map((r, i) => ({ rowNo: i + 2, ...Object.fromEntries(UPLOAD_COLUMNS.map((c) => [c.key, idx[c.key] < 0 ? '' : String(r[idx[c.key]] ?? '').trim()])) }));
}

const blank = (v) => v === '' || v === null || v === undefined;
const numberOf = (v) => (blank(v) ? null : Number(String(v).replace(/,/g, '')));
/** A date cell: YYYY-MM-DD as typed, or the serial number Excel keeps for a date cell. */
const dateOf = (v) => {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{5}(\.0+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
  return s;
};

/**
 * Load the rules of an .xlsx file: returns { uploadId, processed, created, failed, rules: [rule ids], errors:
 * [{ row, message }], message } (MSG-CMR-025 / 026).
 */
export async function uploadRules(file, user) {
  const maxRows = Number(await getSetting('commission.rules_max_rows', 2000)) || 2000;
  const rows = readRules(file);
  if (rows.length > maxRows) throw badRequest(`The file has ${rows.length} rows; at most ${maxRows} are accepted`);
  const insurers = new Map((await many('SELECT id, upper(code) AS code FROM insurance_companies')).map((r) => [r.code, r.id]));
  const products = new Map((await many('SELECT id, upper(code) AS code FROM products')).map((r) => [r.code, r.id]));
  const errors = [];
  const groups = new Map();
  for (const r of rows) {
    const rowErrors = [];
    const insurerId = blank(r.insurer) ? null : insurers.get(r.insurer.toUpperCase()) ?? null;
    if (!blank(r.insurer) && insurerId === null) rowErrors.push(`Insurer ${r.insurer} was not found`);
    const productId = blank(r.product) ? null : products.get(r.product.toUpperCase()) ?? null;
    if (!blank(r.product) && productId === null) rowErrors.push(`Product ${r.product} was not found`);
    const peril = r.peril.toUpperCase();
    if (!PERILS.some((p) => p.code === peril)) rowErrors.push(`Peril ${r.peril || '(blank)'} is not one of ${PERILS.map((p) => p.code).join(', ')}`);
    const basis = r.basis.toLowerCase();
    if (!PERIL_BASES.includes(basis)) rowErrors.push(`Basis ${r.basis || '(blank)'} is not one of ${PERIL_BASES.join(', ')}`);
    r.effectiveFrom = dateOf(r.effectiveFrom);
    r.effectiveTo = blank(r.effectiveTo) ? '' : dateOf(r.effectiveTo);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom)) rowErrors.push('Effective From must be YYYY-MM-DD');
    if (!blank(r.effectiveTo) && !/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveTo)) rowErrors.push('Effective To must be YYYY-MM-DD');
    const policyType = blank(r.policyType) ? 'any' : r.policyType.toLowerCase();
    if (!POLICY_TYPES.includes(policyType)) rowErrors.push(`Policy Type ${r.policyType} is not one of ${POLICY_TYPES.join(', ')}`);
    const channelType = blank(r.channelType) ? null : r.channelType.toLowerCase();
    if (channelType && !CHANNEL_TYPES.includes(channelType)) rowErrors.push(`Channel Type ${r.channelType} is not one of ${CHANNEL_TYPES.join(', ')}`);
    for (const k of ['siFrom', 'siTo', 'issuing', 'tisRemitting', 'insurerNet', 'commissionPct']) {
      if (!blank(r[k]) && !Number.isFinite(numberOf(r[k]))) rowErrors.push(`${UPLOAD_COLUMNS.find((c) => c.key === k).header} must be a number`);
    }
    const key = [insurerId, productId, r.lineOfBusiness.toLowerCase(), policyType, channelType, r.motorType.toUpperCase(), r.siFrom, r.siTo, r.effectiveFrom, r.effectiveTo].join('|');
    const g = groups.get(key) || { rows: [], errors: [], body: { insuranceCompanyId: insurerId, productId, lineOfBusiness: blank(r.lineOfBusiness) ? null : r.lineOfBusiness, policyType, channelType,
      motorType: blank(r.motorType) ? null : r.motorType.toUpperCase(), siFrom: numberOf(r.siFrom), siTo: numberOf(r.siTo), effectiveFrom: r.effectiveFrom, effectiveTo: blank(r.effectiveTo) ? null : r.effectiveTo,
      rateBasis: 'issuing-remitting', perilRates: [], remarks: blank(r.remarks) ? null : r.remarks, submit: true } };
    g.rows.push(r.rowNo);
    for (const e of rowErrors) g.errors.push({ row: r.rowNo, message: e });
    if (!rowErrors.length) g.body.perilRates.push({ peril, basis, issuing: numberOf(r.issuing), tisRemitting: numberOf(r.tisRemitting), insurerNet: numberOf(r.insurerNet), commissionPct: numberOf(r.commissionPct) });
    groups.set(key, g);
  }
  const uploadId = `upl_${crypto.randomBytes(6).toString('hex')}`;
  const rules = [];
  let failed = 0;
  for (const g of groups.values()) {
    if (!g.errors.length) {
      try {
        rules.push((await createRate(g.body, user, { uploadId })).id);
        continue;
      } catch (e) {
        const message = e.details?.[0]?.message || e.message;
        g.errors.push({ row: g.rows[0], message });
      }
    }
    failed += g.rows.length;
    const seen = new Set(g.errors.map((e) => e.row));
    for (const e of g.errors) errors.push(e);
    for (const row of g.rows) if (!seen.has(row)) errors.push({ row, message: 'Another row of the same rule failed' });
  }
  errors.sort((a, b) => a.row - b.row);
  const created = rows.length - failed;
  return { uploadId, processed: rows.length, created, failed, rules, errors: errors.map((e) => ({ ...e, message: `Row ${e.row}: ${e.message}` })),
    message: `Processed ${rows.length} rows: ${created} created, ${failed} failed` };
}
