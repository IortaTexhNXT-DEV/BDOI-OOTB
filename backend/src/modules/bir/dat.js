/**
 * BIR validation data files (.DAT) for the alphalists, so they can be validated with the BIR's own tools and submitted
 * (e-mail to esubmission@bir.gov.ph or the eAFS) instead of being keyed into the BIR Alphalist Data Entry module.
 *
 * Layout version (DAT_LAYOUT.version): the comma-delimited record layouts of the BIR Alphalist Data Entry and Validation
 * Module version 7.x for the QAP (1601-EQ), the SAWT and the 1604-E alphalist of payees, and the RELIEF (Reconciliation
 * of Listing for Enforcement) data file layout for the Summary List of Sales and of Purchases. One header record, one
 * detail record per payee / customer / supplier and ATC, one control record with the totals; text in upper case
 * between double quotes (double quotes removed, accented letters replaced: the validation modules accept ASCII only);
 * amounts with two decimals and no thousands separator; dates MM/YYYY (QAP, SAWT) or MM/DD/YYYY (1604-E, SLSP); lines
 * end with CR LF. The BIR revises these layouts with new module versions: validate every file with the current
 * module before submission, and update DAT_LAYOUT when the BIR publishes a new one.
 *
 * The generators are pure (identity + rows in, file out) so tests compare them with fixed expected files
 * (test/fixtures/bir); datFile() feeds them the rows of the QAP, SAWT and SLSP reports and of the 1604-E alphalist.
 *
 * generateDat() keeps each generated file in the register bir_dat_files with its validation (validateDat(): the file
 * read back, its detail records and control totals compared with the report, the fields the BIR module refuses
 * checked per record), so the file submitted can be downloaded again unchanged.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { iso } from '../period-end/fiscal.js';
import { alphalistRows, birIdentity, quarterPeriod, round2, splitTin, sum } from './common.js';
import { alphalist1604E } from './returns.js';

export const DAT_LAYOUT = Object.freeze({
  version: 'BIR Alphalist Data Entry and Validation Module v7.x (QAP 1601-EQ, SAWT, 1604-E schedules 3 and 4); RELIEF data file layout (SLSP sales and purchases)',
  files: {
    qap: { name: '{TIN}{BRANCH}{MMYYYY}1601EQ.DAT', records: ['HQAP,H1601EQ,TIN,BRANCH,"REGISTERED NAME",MM/YYYY,RDO',
      'D1,1601EQ,SEQ,TIN,BRANCH,"REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME",MM/YYYY,ATC,RATE,INCOME PAYMENT,TAX WITHHELD',
      'C1,1601EQ,TIN,BRANCH,MM/YYYY,TOTAL INCOME PAYMENT,TOTAL TAX WITHHELD'] },
    sawt: { name: '{TIN}{BRANCH}{MMYYYY}{FORM}.DAT', records: ['HSAWT,H{FORM},TIN,BRANCH,"REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME",MM/YYYY,RDO',
      'DSAWT,D{FORM},SEQ,TIN,BRANCH,"REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME",MM/YYYY,,ATC,RATE,INCOME PAYMENT,TAX WITHHELD',
      'CSAWT,C{FORM},TIN,BRANCH,MM/YYYY,TOTAL INCOME PAYMENT,TOTAL TAX WITHHELD'] },
    '1604e': { name: '{TIN}{BRANCH}1231{YYYY}1604E.DAT', records: ['H1604E,TIN,BRANCH,12/31/YYYY,AMENDED (Y/N),NUMBER OF SHEETS,RDO',
      'D3,1604E,TIN,BRANCH,12/31/YYYY,SEQ,PAYEE TIN,PAYEE BRANCH,"REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME",ATC,"NATURE OF INCOME PAYMENT",INCOME PAYMENT,RATE,TAX WITHHELD',
      'C3,1604E,TIN,BRANCH,12/31/YYYY,TOTAL INCOME PAYMENT,TOTAL TAX WITHHELD',
      'D4,1604E,TIN,BRANCH,12/31/YYYY,SEQ,PAYEE TIN,PAYEE BRANCH,"REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME",ATC,"NATURE OF INCOME PAYMENT",INCOME PAYMENT',
      'C4,1604E,TIN,BRANCH,12/31/YYYY,TOTAL INCOME PAYMENT'] },
    slspSales: { name: '{TIN}S{MM}{YYYY}.DAT', records: ['H,S,"TIN","REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME","TRADE NAME","ADDRESS 1","ADDRESS 2",EXEMPT,ZERO-RATED,TAXABLE,OUTPUT TAX,RDO,MM/DD/YYYY,FISCAL YEAR END MONTH',
      'D,S,"CUSTOMER TIN","REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME","ADDRESS 1","ADDRESS 2",EXEMPT,ZERO-RATED,TAXABLE,OUTPUT TAX,OWNER TIN,MM/DD/YYYY'] },
    slspPurchases: { name: '{TIN}P{MM}{YYYY}.DAT', records: ['H,P,"TIN","REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME","TRADE NAME","ADDRESS 1","ADDRESS 2",EXEMPT,ZERO-RATED,SERVICES,CAPITAL GOODS,OTHER GOODS,INPUT TAX,CREDITABLE INPUT TAX,NON-CREDITABLE INPUT TAX,RDO,MM/DD/YYYY,FISCAL YEAR END MONTH',
      'D,P,"SUPPLIER TIN","REGISTERED NAME","LAST NAME","FIRST NAME","MIDDLE NAME","ADDRESS 1","ADDRESS 2",EXEMPT,ZERO-RATED,SERVICES,CAPITAL GOODS,OTHER GOODS,INPUT TAX,OWNER TIN,MM/DD/YYYY'] },
  },
});
export const DAT_TYPES = ['qap', 'sawt', '1604e', 'slspSales', 'slspPurchases'];

const CRLF = '\r\n';
/** Text field: ASCII upper case, no double quotes or line breaks, quoted. */
export const txt = (v, max = 50) => `"${String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/"/g, '')
  .replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max)}"`;
export const amt = (v) => round2(Number(v) || 0).toFixed(2);
const rate = (v) => (Number(v) || 0).toFixed(2);
const tin9 = (v) => splitTin(v).tin.padEnd(9, '0').slice(0, 9);
const br4 = (v) => String(v || '0000').replace(/\D/g, '').slice(-4).padStart(4, '0');
const mmYYYY = (iso) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const mdY = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const lines = (arr) => arr.join(CRLF) + CRLF;
/** "12 Ayala Ave, Makati City, Metro Manila" -> ["12 AYALA AVE", "MAKATI CITY, METRO MANILA"] */
export const splitAddress = (a) => {
  const parts = String(a || '').split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length < 2 ? [parts[0] || '', ''] : [parts[0], parts.slice(1).join(', ')];
};
const missingTin = (rows, label) => rows.filter((r) => !String(r.tin || '').replace(/\D/g, '')).map((r) => `${label} ${r.registeredName || r.customerName || [r.lastName, r.firstName].filter(Boolean).join(', ') || '(no name)'} has no TIN`);

/** QAP DAT of a quarter. id: birIdentity(); rows: QAP report rows; periodTo: last day of the quarter. */
export function qapDat(id, rows, periodTo) {
  const tin = tin9(id.tin); const br = br4(id.branch); const p = mmYYYY(periodTo);
  const out = [`HQAP,H1601EQ,${tin},${br},${txt(id.name)},${p},${id.rdoCode || ''}`];
  rows.forEach((r, i) => {
    const t = splitTin(r.tin, '0000');
    out.push(`D1,1601EQ,${i + 1},${tin9(t.tin)},${br4(t.branch)},${txt(r.registeredName)},${txt(r.lastName, 30)},${txt(r.firstName, 30)},${txt(r.middleName, 30)},${p},${r.atc || ''},${rate(r.taxRate)},${amt(r.incomePayment)},${amt(r.taxWithheld)}`);
  });
  out.push(`C1,1601EQ,${tin},${br},${p},${amt(sum(rows, 'incomePayment'))},${amt(sum(rows, 'taxWithheld'))}`);
  return { fileName: `${tin}${br}${periodTo.slice(5, 7)}${periodTo.slice(0, 4)}1601EQ.DAT`, content: lines(out), warnings: missingTin(rows, 'Payee') };
}

/** SAWT DAT of a quarter (or month) for the return `form` (1702Q, 2550Q, ...). */
export function sawtDat(id, rows, periodTo, form = '1702Q') {
  const tin = tin9(id.tin); const br = br4(id.branch); const p = mmYYYY(periodTo); const f = String(form).replace(/[^0-9A-Z]/gi, '').toUpperCase();
  const out = [`HSAWT,H${f},${tin},${br},${txt(id.name)},"","","",${p},${id.rdoCode || ''}`];
  rows.forEach((r, i) => {
    const t = splitTin(r.tin, '0000');
    out.push(`DSAWT,D${f},${i + 1},${tin9(t.tin)},${br4(t.branch)},${txt(r.registeredName)},${txt(r.lastName, 30)},${txt(r.firstName, 30)},${txt(r.middleName, 30)},${p},,${r.atc || ''},${rate(r.taxRate)},${amt(r.incomePayment)},${amt(r.taxWithheld)}`);
  });
  out.push(`CSAWT,C${f},${tin},${br},${p},${amt(sum(rows, 'incomePayment'))},${amt(sum(rows, 'taxWithheld'))}`);
  return { fileName: `${tin}${br}${periodTo.slice(5, 7)}${periodTo.slice(0, 4)}${f}.DAT`, content: lines(out), warnings: missingTin(rows, 'Payor') };
}

/** 1604-E DAT: schedule 3 (subject to expanded withholding) and schedule 4 (exempt) of a year. */
export function alphalist1604EDat(id, year, schedule3, schedule4 = [], { amended = false } = {}) {
  const tin = tin9(id.tin); const br = br4(id.branch); const d = `12/31/${year}`;
  const out = [`H1604E,${tin},${br},${d},${amended ? 'Y' : 'N'},0,${id.rdoCode || ''}`];
  schedule3.forEach((r, i) => {
    out.push(`D3,1604E,${tin},${br},${d},${i + 1},${tin9(r.tin)},${br4(r.branch)},${txt(r.registeredName)},${txt(r.lastName, 30)},${txt(r.firstName, 30)},${txt(r.middleName, 30)},${r.atc || ''},${txt(r.natureOfPayment)},${amt(r.incomePayment)},${rate(r.taxRate)},${amt(r.taxWithheld)}`);
  });
  out.push(`C3,1604E,${tin},${br},${d},${amt(sum(schedule3, 'incomePayment'))},${amt(sum(schedule3, 'taxWithheld'))}`);
  if (schedule4.length) {
    schedule4.forEach((r, i) => {
      out.push(`D4,1604E,${tin},${br},${d},${i + 1},${tin9(r.tin)},${br4(r.branch)},${txt(r.registeredName)},${txt(r.lastName, 30)},${txt(r.firstName, 30)},${txt(r.middleName, 30)},${r.atc || ''},${txt(r.natureOfPayment)},${amt(r.incomePayment)}`);
    });
    out.push(`C4,1604E,${tin},${br},${d},${amt(sum(schedule4, 'incomePayment'))}`);
  }
  return { fileName: `${tin}${br}1231${year}1604E.DAT`, content: lines(out), warnings: missingTin([...schedule3, ...schedule4], 'Payee') };
}

const ownerHeader = (id) => {
  const [a1, a2] = splitAddress(id.address);
  return `${txt(tin9(id.tin))},${txt(id.name)},"","","",${txt(id.tradeName || id.name)},${txt(a1)},${txt(a2)}`;
};

/** SLSP sales DAT (RELIEF): one detail per customer for the period. rows: { tin, registeredName, customerName, address, exemptSales, zeroRatedSales, taxableSales, outputTax } */
export function slspSalesDat(id, rows, periodTo, fyEndMonth = 12) {
  const d = mdY(periodTo);
  const tin = tin9(id.tin);
  const out = [`H,S,${ownerHeader(id)},${amt(sum(rows, 'exemptSales'))},${amt(sum(rows, 'zeroRatedSales'))},${amt(sum(rows, 'taxableSales'))},${amt(sum(rows, 'outputTax'))},${id.rdoCode || ''},${d},${fyEndMonth}`];
  for (const r of rows) {
    const [a1, a2] = splitAddress(r.address);
    const person = !r.registeredName && r.customerName ? String(r.customerName).trim().split(/\s+/) : null;
    out.push(`D,S,${txt(tin9(r.tin))},${txt(r.registeredName)},${txt(person ? person[person.length - 1] : '', 30)},${txt(person ? person[0] : '', 30)},${txt(person && person.length > 2 ? person.slice(1, -1).join(' ') : '', 30)},${txt(a1)},${txt(a2)},${amt(r.exemptSales)},${amt(r.zeroRatedSales)},${amt(r.taxableSales)},${amt(r.outputTax)},${tin},${d}`);
  }
  return { fileName: `${tin}S${periodTo.slice(5, 7)}${periodTo.slice(0, 4)}.DAT`, content: lines(out), warnings: missingTin(rows, 'Customer') };
}

/** SLSP purchases DAT (RELIEF). rows: { tin, registeredName, address, exemptPurchases, zeroRatedPurchases, purchaseOfServices, purchaseOfCapitalGoods, purchaseOfOtherGoods, inputTax } */
export function slspPurchasesDat(id, rows, periodTo, fyEndMonth = 12) {
  const d = mdY(periodTo);
  const tin = tin9(id.tin);
  const input = sum(rows, 'inputTax');
  const out = [`H,P,${ownerHeader(id)},${amt(sum(rows, 'exemptPurchases'))},${amt(sum(rows, 'zeroRatedPurchases'))},${amt(sum(rows, 'purchaseOfServices'))},${amt(sum(rows, 'purchaseOfCapitalGoods'))},${amt(sum(rows, 'purchaseOfOtherGoods'))},${amt(input)},${amt(input)},0.00,${id.rdoCode || ''},${d},${fyEndMonth}`];
  for (const r of rows) {
    const [a1, a2] = splitAddress(r.address);
    out.push(`D,P,${txt(tin9(r.tin))},${txt(r.registeredName)},"","","",${txt(a1)},${txt(a2)},${amt(r.exemptPurchases)},${amt(r.zeroRatedPurchases)},${amt(r.purchaseOfServices)},${amt(r.purchaseOfCapitalGoods)},${amt(r.purchaseOfOtherGoods)},${amt(r.inputTax)},${tin},${d}`);
  }
  return { fileName: `${tin}P${periodTo.slice(5, 7)}${periodTo.slice(0, 4)}.DAT`, content: lines(out), warnings: missingTin(rows, 'Supplier') };
}

/** SLSP rows of the report (per month) summed per counterparty for the whole period. */
function perCounterparty(rows, keys) {
  const map = new Map();
  for (const r of rows) {
    const k = `${r.tin}|${r.registeredName || ''}|${r.customerName || r.supplierName || ''}`;
    const o = map.get(k) || { tin: r.tin, registeredName: r.registeredName || null, customerName: r.customerName || r.supplierName || null, address: r.address, ...Object.fromEntries(keys.map((x) => [x, 0])) };
    for (const x of keys) o[x] = round2(o[x] + Number(r[x] || 0));
    map.set(k, o);
  }
  return [...map.values()].filter((o) => keys.some((x) => o[x]));
}

/** Rows of the report and the file of a type and period: { out, rows, schedule4, period, form } (form: return of a SAWT). */
async function buildDat(db, type, q) {
  const id = await birIdentity();
  if (!id.tin) throw badRequest('The broker\'s TIN is missing: fill it in on Master > Company (primary company) before generating BIR files');
  if (type === '1604e') {
    const al = await alphalist1604E(db, q.year);
    return { rows: al.schedule3, schedule4: al.schedule4, period: al.period,
      out: alphalist1604EDat(id, al.period.year, al.schedule3, al.schedule4, { amended: q.amended === true || q.amended === 'true' }) };
  }
  const p = quarterPeriod(q.year, q.quarter);
  let rows; let out; let form = null;
  if (type === 'qap') { rows = await alphalistRows('qap', p.from, p.to); out = qapDat(id, rows, p.to); }
  else if (type === 'sawt') {
    form = String(q.form || (await getSetting('bir.sawt_form', '1702Q'))).replace(/[^0-9A-Z]/gi, '').toUpperCase();
    rows = await alphalistRows('sawt', p.from, p.to);
    out = sawtDat(id, rows, p.to, form);
  }
  else if (type === 'slspSales') {
    rows = perCounterparty(await alphalistRows('slspSales', p.from, p.to), ['exemptSales', 'zeroRatedSales', 'taxableSales', 'outputTax']);
    out = slspSalesDat(id, rows, p.to, Number(await getSetting('bir.fiscal_year_end_month', 12)) || 12);
  } else if (type === 'slspPurchases') {
    rows = perCounterparty(await alphalistRows('slspPurchases', p.from, p.to), ['exemptPurchases', 'zeroRatedPurchases', 'purchaseOfServices', 'purchaseOfCapitalGoods', 'purchaseOfOtherGoods', 'inputTax']);
    out = slspPurchasesDat(id, rows, p.to, Number(await getSetting('bir.fiscal_year_end_month', 12)) || 12);
  } else throw badRequest(`Unknown DAT file type ${type}`);
  return { rows, schedule4: [], period: p, out, form };
}

const AMOUNT_KEYS = ['incomePayment', 'taxWithheld', 'taxableSales', 'outputTax', 'inputTax'];
const totalsOf = (rows) => Object.fromEntries(AMOUNT_KEYS.filter((k) => rows.some((r) => r[k] !== undefined)).map((k) => [k, sum(rows, k)]));

/** Build a DAT file from the system's data: { type, fileName, content, rows, totals, warnings, layoutVersion }. */
export async function datFile(db, type, q) {
  const { out, rows } = await buildDat(db, type, q);
  return { type, ...out, records: out.content.split(CRLF).filter(Boolean).length, rows: rows.length, totals: totalsOf(rows), layoutVersion: DAT_LAYOUT.version, layout: DAT_LAYOUT.files[type] };
}

// ---------------------------------------------------------------- validation of a file against its report

/** Fields of a comma-delimited record; a field between double quotes may hold commas. */
export function splitRecord(line) {
  const out = [];
  let cur = ''; let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Where the fields are in each record of a layout (positions in splitRecord()): detail record prefix, TIN, registered
 * name, last and first name, ATC (when the layout has one), the amounts of the detail, and the record that carries
 * the totals with the position of each total.
 */
const PARSE = {
  qap: { detail: ['D1'], tin: 3, name: 5, last: 6, first: 7, atc: 10, amounts: { incomePayment: 12, taxWithheld: 13 }, control: { prefix: ['C1'], at: { incomePayment: 5, taxWithheld: 6 } } },
  sawt: { detail: ['DSAWT'], tin: 3, name: 5, last: 6, first: 7, atc: 11, amounts: { incomePayment: 13, taxWithheld: 14 }, control: { prefix: ['CSAWT'], at: { incomePayment: 5, taxWithheld: 6 } } },
  '1604e': { detail: ['D3'], tin: 6, name: 8, last: 9, first: 10, atc: 12, amounts: { incomePayment: 14, taxWithheld: 16 }, control: { prefix: ['C3'], at: { incomePayment: 5, taxWithheld: 6 } },
    exempt: { detail: ['D4'], amounts: { incomePayment: 14 }, control: { prefix: ['C4'], at: { incomePayment: 5 } } } },
  slspSales: { detail: ['D', 'S'], tin: 2, name: 3, last: 4, first: 5, amounts: { exemptSales: 9, zeroRatedSales: 10, taxableSales: 11, outputTax: 12 },
    control: { prefix: ['H', 'S'], at: { exemptSales: 10, zeroRatedSales: 11, taxableSales: 12, outputTax: 13 } } },
  slspPurchases: { detail: ['D', 'P'], tin: 2, name: 3, last: 4, first: 5,
    amounts: { exemptPurchases: 9, zeroRatedPurchases: 10, purchaseOfServices: 11, purchaseOfCapitalGoods: 12, purchaseOfOtherGoods: 13, inputTax: 14 },
    control: { prefix: ['H', 'P'], at: { exemptPurchases: 10, zeroRatedPurchases: 11, purchaseOfServices: 12, purchaseOfCapitalGoods: 13, purchaseOfOtherGoods: 14, inputTax: 15 } } },
};
const startsWith = (fields, prefix) => prefix.every((p, i) => fields[i] === p);
const num = (v) => Number(String(v ?? '').trim() || 0);

/** Detail count and control totals of one part of a file (schedule 3 or 4 of the 1604-E, or the whole file). */
function readPart(records, part) {
  const details = records.filter((r) => startsWith(r.fields, part.detail));
  const control = records.find((r) => startsWith(r.fields, part.control.prefix));
  const totals = Object.fromEntries(Object.entries(part.control.at).map(([k, i]) => [k, control ? round2(num(control.fields[i])) : null]));
  const detailTotals = Object.fromEntries(Object.keys(part.control.at).map((k) => [k, round2(details.reduce((s, d) => s + num(d.fields[part.amounts[k]]), 0))]));
  return { details, totals, detailTotals };
}

/**
 * Validation of a DAT file against the report rows it was built from: the file is read back and its detail records
 * and control (or header) totals are compared with the report; each detail record is checked for the fields the BIR
 * validation module refuses (TIN, name, ATC, negative amounts).
 * Returns { valid, checks: [{ code, report, file, difference, agrees }], errors: [{ record, name, code }] }.
 */
export function validateDat(type, content, rows, schedule4 = []) {
  const layout = PARSE[type];
  if (!layout) throw badRequest(`Unknown DAT file type ${type}`);
  const records = String(content).split(CRLF).filter(Boolean).map((line, i) => ({ no: i + 1, fields: splitRecord(line) }));
  const checks = [];
  const check = (code, report, file) => {
    const difference = file === null ? null : round2(file - report);
    checks.push({ code, report, file, difference, agrees: difference !== null && Math.abs(difference) < 0.005 });
  };
  const compare = (part, reportRows, suffix = '') => {
    const read = readPart(records, part);
    check(`records${suffix}`, reportRows.length, read.details.length);
    for (const k of Object.keys(part.control.at)) {
      check(`${k}${suffix}`, sum(reportRows, k), read.totals[k]);
      if (read.totals[k] !== null && Math.abs(read.detailTotals[k] - read.totals[k]) >= 0.005) checks.push({ code: `${k}${suffix}Detail`, report: read.totals[k], file: read.detailTotals[k], difference: round2(read.detailTotals[k] - read.totals[k]), agrees: false });
    }
    return read.details;
  };
  const details = compare(layout, rows);
  if (layout.exempt && schedule4.length) compare(layout.exempt, schedule4, 'Exempt');

  const errors = [];
  for (const d of details) {
    const f = d.fields;
    const name = f[layout.name] || [f[layout.last], f[layout.first]].filter(Boolean).join(', ');
    const add = (code) => errors.push({ record: d.no, name: name || null, code });
    if (!/[1-9]/.test(String(f[layout.tin] || ''))) add('tinMissing');
    if (!name) add('nameMissing');
    if (layout.atc !== undefined && !String(f[layout.atc] || '').trim()) add('atcMissing');
    if (Object.values(layout.amounts).some((i) => num(f[i]) < 0)) add('negativeAmount');
  }
  return { valid: checks.every((c) => c.agrees) && errors.length === 0, checks, errors };
}

// ---------------------------------------------------------------- register of generated files

const datRow = (r, { content = false } = {}) => r && ({
  id: r.id, type: r.dat_type, form: r.form_code, year: r.year, quarter: r.quarter, periodKey: r.period_key, periodFrom: iso(r.period_from), periodTo: iso(r.period_to),
  fileName: r.file_name, records: r.records, rows: r.detail_rows, totals: r.totals, checks: r.checks, errors: r.errors, warnings: r.warnings, valid: r.valid,
  layoutVersion: r.layout_version, generatedBy: r.generated_by, generatedByName: r.generated_by_name || r.generated_by, generatedAt: r.generated_at,
  ...(content ? { content: r.content, layout: DAT_LAYOUT.files[r.dat_type] } : {}),
});
const SELECT_DAT = 'SELECT f.*, u.display_name AS generated_by_name FROM bir_dat_files f LEFT JOIN users u ON u.id = f.generated_by';

/** Generate a DAT file, validate it against its report and keep it in the register. */
export async function generateDat(db, type, q, user) {
  const { out, rows, schedule4, period, form } = await buildDat(db, type, q);
  const validation = validateDat(type, out.content, rows, schedule4);
  const r = (await db.query(`INSERT INTO bir_dat_files(dat_type, form_code, year, quarter, period_key, period_from, period_to, file_name, content, records, detail_rows, totals,
    checks, errors, warnings, valid, layout_version, generated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
  [type, form, period.year, period.quarter ?? null, period.key, period.from, period.to, out.fileName, out.content, out.content.split(CRLF).filter(Boolean).length,
    rows.length + schedule4.length, JSON.stringify(totalsOf(rows)), JSON.stringify(validation.checks), JSON.stringify(validation.errors), JSON.stringify(out.warnings || []),
    validation.valid, DAT_LAYOUT.version, user?.id ?? null])).rows[0];
  return getDatFile(db, r.id);
}

/** Generated files, newest first (filter year, type); without their content. */
export async function listDatFiles(db, q = {}) {
  const rows = (await db.query(`${SELECT_DAT} WHERE ($1::int IS NULL OR f.year = $1) AND ($2::text IS NULL OR f.dat_type = $2) ORDER BY f.generated_at DESC LIMIT 500`,
    [q.year ? Number(q.year) : null, q.type || null])).rows;
  return rows.map((r) => datRow(r));
}

/** One generated file with its content and record layout. */
export async function getDatFile(db, id) {
  const r = (await db.query(`${SELECT_DAT} WHERE f.id = $1`, [id])).rows[0];
  if (!r) throw notFound('DAT file not found');
  return datRow(r, { content: true });
}
