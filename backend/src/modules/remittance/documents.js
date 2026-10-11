/**
 * Documents of a remittance (Accounts > Remittance > Remittances: the row menu and the record's Documents tab), all
 * built on the server with the letterhead of the Company master (lib/letterhead.js through printContext) and
 * lib/xlsx.js, named <Ref>_<Document>_<yyyymmdd>.<ext>:
 *   - the remittance schedule, XLSX and PDF (A4 landscape): the header (company, "Remittance Schedule", insurer,
 *     product line, coverage date, remittance no., date), one row per policy with the columns today's data holds
 *     (issued date, client, car model, insurer, policy no., business type, inception, sum insured, premium,
 *     commission, taxes, due to insurer), the totals and the note that it is valid without signature. The per-peril premium,
 *     remitting and commission columns of the FRS layout come with the Phase 2 line data;
 *   - the remittance advice (PDF, portrait): addressee, reference and payment blocks and the amounts, the payment
 *     from the voucher the remittance's settlement raised (documents/templates.js#remittanceAdviceDoc).
 */
import { many, one } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { buildPdf, printContext, renderReportPdf } from '../../lib/pdf/index.js';
import { formatDate } from '../../lib/pdf/format.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { today as businessToday } from '../../lib/dates.js';
import { round2 } from '../masters/helpers.js';
import { excelBrand } from '../reports/service.js';
import { remittanceAdviceDoc } from '../documents/templates.js';
import { remittancePolicyList } from '../documents/uploadTemplates.js';
import { importLimits } from './imports.js';
import { remittanceDetails } from './service.js';
import { registerExport, registerRow } from './register.js';

export const SCHEDULE_NOTE = 'Note: This is a system-generated document and is valid without physical signature.';

/** "<Ref>_<Document>_<yyyymmdd>.<ext>" with the business date. */
export async function documentFileName(ref, document, ext) {
  return `${String(ref).replace(/[^A-Za-z0-9-]+/g, '_')}_${document}_${(await businessToday()).replace(/-/g, '')}.${ext}`;
}

export const SCHEDULE_COLUMNS = [
  { key: 'issuedDate', label: 'ISSUED DATE', type: 'date', width: 12 }, { key: 'client', label: 'CLIENT NAME', width: 28 }, { key: 'carModel', label: 'CAR MODEL', width: 22 },
  { key: 'insurer', label: 'INSURANCE COMPANY', width: 26 }, { key: 'policyNo', label: 'POLICY NO.', width: 20 }, { key: 'businessType', label: 'BUSINESS TYPE', width: 12 },
  { key: 'inception', label: 'INCEPTION DATE FROM', type: 'date', width: 14 }, { key: 'sumInsured', label: 'SI', type: 'money', width: 14 },
  { key: 'premium', label: 'TOTAL PREMIUM', type: 'money', width: 15 }, { key: 'commission', label: 'COMMISSION', type: 'money', width: 14 },
  { key: 'tax', label: 'TAXES', type: 'money', width: 12 }, { key: 'due', label: 'DUE TO INSURER', type: 'money', width: 16 },
];

/** The rows of a remittance's schedule (one per policy line) with the header data and the totals. */
export async function scheduleData(id, user) {
  const row = await registerRow(id, user);
  if (!row) throw notFound('Remittance not found');
  const lines = await many(`SELECT rl.*, p.issued_date, p.inception_date AS policy_inception, p.sum_insured, p.renewed_from, c.display_name AS client_name,
      NULLIF(concat_ws(' ', COALESCE(q.vehicle->>'brand', q.vehicle->>'make'), q.vehicle->>'model', COALESCE(q.vehicle->>'year', q.vehicle->>'yearModel')), '') AS car_model,
      COALESCE(li.name, ri.name) AS insurer_name
    FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id
    LEFT JOIN policies p ON p.id = rl.policy_id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN quotes q ON q.id = p.quote_id
    LEFT JOIN insurance_companies li ON li.id = rl.insurance_company_id LEFT JOIN insurance_companies ri ON ri.id = r.insurance_company_id
    WHERE rl.remittance_id = $1 ORDER BY rl.id`, [row.id]);
  const rows = lines.map((l) => ({
    issuedDate: l.issued_date || null, client: l.client_name || l.insured_name || '', carModel: l.car_model || '', insurer: l.insurer_name || '',
    policyNo: l.policy_number || '', businessType: l.policy_id ? (l.renewed_from ? 'RENEW' : 'NEW') : '', inception: l.policy_inception || l.effective_date || null,
    sumInsured: l.sum_insured === null || l.sum_insured === undefined ? null : round2(l.sum_insured), premium: round2(l.premium), commission: round2(l.commission),
    tax: round2(l.tax), due: round2(l.net),
  }));
  const sum = (k) => round2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  return { row, rows, totals: { premium: sum('premium'), commission: sum('commission'), tax: sum('tax'), due: sum('due') } };
}

/** The header lines of a schedule after the company name: title, insurer, product line, coverage date, number, date. */
async function scheduleHeader(row, fmt) {
  const coverage = row.coverageWeek ? `${formatDate(row.coverageWeek.from, fmt)} to ${formatDate(row.coverageWeek.to, fmt)}` : '';
  return [['Insurer', row.insurer?.name || ''], ['Product line', row.productLine || ''], ['Coverage Date', coverage], ['REM no', row.remittanceNo],
    ['Date', formatDate(await businessToday(), fmt)]];
}

/** The schedule workbook: the letterhead block and header lines above the table, the totals row and the note. */
export async function scheduleXlsx(id, user) {
  const { row, rows, totals } = await scheduleData(id, user);
  const print = await printContext({ user });
  const lh = print.letterhead || {};
  const brand = excelBrand(print);
  const header = await scheduleHeader(row, print.format);
  const banner = [String(lh.name || '').toUpperCase(), 'Remittance Schedule', ...header.map(([k, v]) => `${k}: ${v}`)];
  const total = { issuedDate: '', client: 'TOTAL', premium: totals.premium, commission: totals.commission, tax: totals.tax, due: totals.due };
  const note = { issuedDate: SCHEDULE_NOTE };
  const data = [...rows, total, note].map((r) => SCHEDULE_COLUMNS.map((c) => r[c.key] ?? ''));
  const buffer = writeXlsx({
    sheets: [{ name: 'Schedule', columns: SCHEDULE_COLUMNS.map((c) => ({ header: c.label, type: c.type, width: c.width })), rows: data, banner, logo: !!brand.logoImage,
      autoFilter: false }],
    title: `Remittance Schedule ${row.remittanceNo}`, brand, dateFormat: print.format?.dateFormat,
  });
  return { buffer, fileName: await documentFileName(row.remittanceNo, 'Schedule', 'xlsx') };
}

/** The schedule as a PDF listing (A4 landscape, the font reduced to fit). */
export async function schedulePdf(id, user) {
  const { row, rows, totals } = await scheduleData(id, user);
  const print = await printContext({ user });
  const header = await scheduleHeader(row, print.format);
  const buffer = await renderReportPdf({ title: 'Remittance Schedule', params: header.map(([k, v]) => `${k}: ${v || '-'}`).join('   ·   '),
    columns: SCHEDULE_COLUMNS.map((c) => ({ key: c.key, label: c.label, type: c.type })), rows,
    totals: { client: 'TOTAL', premium: totals.premium, commission: totals.commission, tax: totals.tax, due: totals.due },
    sections: [{ note: SCHEDULE_NOTE }] }, { user });
  return { buffer, fileName: await documentFileName(row.remittanceNo, 'Schedule', 'pdf') };
}

/**
 * The data of the advice letter: addressee, coverage, product line, basis, the payment block of the settlement voucher
 * and the amounts (commission VAT and EWT from the voucher's payables, refund credits netted on the voucher).
 */
export async function adviceData(id, user) {
  const row = await registerRow(id, user);
  if (!row) throw notFound('Remittance not found');
  const ins = row.insurer ? await one('SELECT name, address, tin FROM insurance_companies WHERE id = $1', [row.insurer.id]) : null;
  const v = row.voucher;
  const d = v ? await one('SELECT voucher_number, payment_mode, voucher_date, reference_no, paid_at, amount FROM disbursements WHERE id = $1', [v.id]) : null;
  const taxes = v ? await one('SELECT COALESCE(sum(vat), 0) AS vat, COALESCE(sum(wht), 0) AS wht FROM invoice_lists WHERE disbursement_id = $1', [v.id]) : null;
  const credits = v ? await one(`SELECT COALESCE(sum((ap->>'amount')::numeric), 0) AS amount FROM insurer_refund_credits c CROSS JOIN LATERAL jsonb_array_elements(c.applications) ap
    WHERE ap->>'disbursementId' = $1`, [v.id]) : null;
  return {
    row,
    advice: {
      date: await businessToday(), insurer: { name: ins?.name || row.insurer?.name || '', address: ins?.address || '', tin: ins?.tin || '' },
      coverage: row.coverageWeek, productLine: row.productLine, basis: row.basisLabel,
      payment: d ? { voucherNo: d.voucher_number, method: d.payment_mode, valueDate: d.voucher_date, bankReference: d.paid_at ? d.reference_no : null } : null,
      amounts: { premium: row.premium, commission: row.commission, commissionVat: taxes ? round2(taxes.vat) : null, commissionEwt: taxes ? round2(taxes.wht) : null,
        dueToInsurer: row.dueToInsurer, refundCredits: credits ? round2(credits.amount) : null, amountPaid: d?.paid_at ? round2(d.amount) : null },
    },
  };
}

/** The advice PDF (portrait). */
export async function advicePdf(id, user) {
  const { row, advice } = await adviceData(id, user);
  const details = await remittanceDetails(row.id, { viewer: user });
  const buffer = buildPdf(await remittanceAdviceDoc(details, details.policies, advice));
  return { buffer, fileName: await documentFileName(row.remittanceNo, 'Advice', 'pdf') };
}

/** The register export (Remittances > Export XLSX): the letterhead block, the filter summary and the table. */
export async function registerXlsx(qs, user) {
  const print = await printContext({ user });
  const x = await registerExport(qs, user, print.format);
  const lh = print.letterhead || {};
  const brand = excelBrand(print);
  const reg = [lh.tin ? `TIN ${lh.tin}` : '', ...(lh.addressLines || []).slice(0, 1)].filter(Boolean).join('   |   ');
  const totals = { remittanceNo: 'TOTAL', policies: x.totals.policies, dueToInsurer: x.totals.dueToInsurer };
  const rows = [...x.rows, totals];
  const buffer = writeXlsx({
    sheets: [{ name: 'Remittances', columns: x.columns, rows, banner: [lh.name, reg, 'Remittances', x.summary].filter(Boolean), logo: !!brand.logoImage }],
    title: 'Remittances', brand, dateFormat: print.format?.dateFormat,
  });
  return { buffer, fileName: await documentFileName('Remittances', 'Register', 'xlsx') };
}

/** The Import policy list template with the active insurer codes and today's limits (GET /remittance/imports/template). */
export async function policyListTemplate() {
  const codes = (await many("SELECT code FROM insurance_companies WHERE status = 'active' AND code IS NOT NULL ORDER BY code")).map((r) => r.code);
  const limits = await importLimits();
  return remittancePolicyList({ insurerCodes: codes, maxRows: limits.maxRows, maxMb: limits.maxMb });
}
