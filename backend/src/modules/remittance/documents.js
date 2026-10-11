/**
 * Documents of a remittance (Accounts > Remittance > Remittances: the row menu and the record's Documents tab), all
 * built on the server with the letterhead of the Company master (lib/letterhead.js through printContext) and
 * lib/xlsx.js, named <Ref>_<Document>_<yyyymmdd>.<ext>:
 *   - the remittance schedule, XLSX and PDF (A4 landscape; FR-RMT-015): the header (company, "Remittance Schedule",
 *     insurer, product line, coverage date, remittance no., date), one row per policy in the layout of FRS COMM-06
 *     chapter 6 (Motor: PREMIUM, REMITTING and COMMISSION per peril from the commission basis of the policy; other
 *     lines: premium and commission sections), the totals and the note that it is valid without signature;
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

const money = (key, label, width = 13) => ({ key, label, type: 'money', width });
const POLICY_COLUMNS = [{ key: 'issuedDate', label: 'ISSUED DATE', type: 'date', width: 12 }, { key: 'client', label: 'CLIENT NAME', width: 28 }];
const PERIL_KEYS = [['OD', 'OD/TH'], ['AON', 'AON'], ['PD', 'PD'], ['BI', 'BI'], ['APPA', 'PA']];
const COMMISSION_COLUMNS = [money('grossAmount', 'GROSS AMOUNT'), money('commissionVat', 'VAT'), money('netOfVat', 'NET OF VAT'), money('ewt', 'EWT'),
  money('netPayable', 'NET AMOUNT PAYABLE', 15)];

/**
 * The columns of the schedule (FRS COMM-06 chapter 6): Motor, one row per policy with the sections PREMIUM, REMITTING and
 * COMMISSION per peril (6.1); any other line, the premium and commission sections of 6.2. Both end with the amount due
 * to the insurer. The internal copy adds the variance share and the referrer (never on the insurer's copy).
 */
export function scheduleColumns(motor, internal = false) {
  const head = motor
    ? [...POLICY_COLUMNS, { key: 'carModel', label: 'CAR MODEL', width: 22 }, { key: 'insurer', label: 'INSURANCE COMPANY', width: 26 }, { key: 'policyNo', label: 'POLICY NO.', width: 20 },
      { key: 'businessType', label: 'BUSINESS TYPE / MOTOR TYPE', width: 18 }, { key: 'inception', label: 'INCEPTION DATE FROM', type: 'date', width: 14 }, money('sumInsured', 'SI', 14),
      ...PERIL_KEYS.map(([c, l]) => money(`premium${c}`, `PREMIUM ${l}`)), money('netPremium', 'PREMIUM AMOUNT'), money('vat', 'VAT'), money('dst', 'DST'), money('lgt', 'LGT'),
      money('roadside', 'ROADSIDE ASSISTANCE'), money('premium', 'TOTAL PREMIUM', 15),
      ...PERIL_KEYS.map(([c, l]) => money(`remitting${c}`, `REMITTING ${l}`)), money('remitting', 'TOTAL REMITTING', 15),
      ...PERIL_KEYS.map(([c, l]) => money(`commission${c}`, `COMMISSION ${l}`))]
    : [...POLICY_COLUMNS, { key: 'productType', label: 'PRODUCT TYPE', width: 22 }, { key: 'insurer', label: 'INSURANCE COMPANY', width: 26 }, { key: 'policyNo', label: 'POLICY NO.', width: 20 },
      { key: 'inception', label: 'INCEPTION DATE FROM', type: 'date', width: 14 }, money('sumInsured', 'SI', 14), money('netPremium', 'PREMIUM AMOUNT'), money('vat', 'VAT'),
      money('dst', 'DST'), money('lgt', 'LGT'), money('others', 'OTHERS'), money('premium', 'TOTAL PREMIUM', 15)];
  return [...head, ...COMMISSION_COLUMNS, money('due', 'DUE TO INSURER', 16),
    ...(internal ? [money('varianceShare', 'VARIANCE SHARE'), { key: 'referrer', label: 'REFERRER', width: 24 }] : [])];
}
const moneyKeys = (cols) => cols.filter((c) => c.type === 'money' && c.key !== 'sumInsured').map((c) => c.key);
const amount = (v) => round2(Number(v) || 0);

/**
 * The rows of a remittance's schedule (one per policy line) with the header data, the columns and the totals: per peril
 * the premium, the insurer remitting and the commission of the commission basis booked on the policy (FR-RMT-002), the
 * premium taxes of its bills, the commission with its VAT and EWT, and the amount due to the insurer.
 */
export async function scheduleData(id, user, { internal = false } = {}) {
  const row = await registerRow(id, user);
  if (!row) throw notFound('Remittance not found');
  const lines = await many(`SELECT rl.*, p.issued_date, p.inception_date AS policy_inception, p.sum_insured, p.renewed_from, p.net_premium AS policy_net,
      p.details->'commissionBasis' AS basis, c.display_name AS client_name, pr.name AS product_name,
      NULLIF(concat_ws(' ', COALESCE(q.vehicle->>'brand', q.vehicle->>'make'), q.vehicle->>'model', COALESCE(q.vehicle->>'year', q.vehicle->>'yearModel')), '') AS car_model,
      COALESCE(li.name, ri.name) AS insurer_name, b.vat, b.dst, b.lgt, b.commission_vat, b.commission_ewt
    FROM remittance_lines rl JOIN remittances r ON r.id = rl.remittance_id
    LEFT JOIN policies p ON p.id = rl.policy_id LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN quotes q ON q.id = p.quote_id LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN insurance_companies li ON li.id = rl.insurance_company_id LEFT JOIN insurance_companies ri ON ri.id = r.insurance_company_id
    LEFT JOIN LATERAL (SELECT sum(COALESCE(x.vat, 0)) AS vat, sum(COALESCE(x.dst, 0)) AS dst, sum(COALESCE(x.lgt, 0)) AS lgt, sum(COALESCE(x.commission_vat, 0)) AS commission_vat,
        sum(COALESCE(x.commission_ewt, 0)) AS commission_ewt FROM receivables x WHERE x.policy_id = rl.policy_id AND x.status NOT IN ('cancelled', 'written-off', 'credited')) b ON true
    WHERE rl.remittance_id = $1 ORDER BY rl.id`, [row.id]);
  const motor = /motor/i.test(row.productLine || '') || lines.some((l) => l.basis?.rateBasis === 'issuing-remitting');
  const columns = scheduleColumns(motor, internal);
  const rows = lines.map((l) => {
    const basis = l.basis || {};
    const perils = new Map((basis.perils || []).map((x) => [x.code, x]));
    const premium = amount(l.premium);
    const commission = amount(l.commission);
    const [vat, dst, lgt] = [amount(l.vat), amount(l.dst), amount(l.lgt)];
    const net = l.policy_net !== null && l.policy_net !== undefined ? amount(l.policy_net) : amount(basis.netPremium ?? premium - vat - dst - lgt);
    // commission VAT and EWT as booked on the bills, else the line's tax (commission VAT less EWT) as VAT
    const commissionVat = Number(l.commission_vat) ? amount(l.commission_vat) : Math.max(0, amount(l.tax));
    const ewt = Number(l.commission_ewt) ? amount(l.commission_ewt) : 0;
    const out = {
      issuedDate: l.issued_date || null, client: l.client_name || l.insured_name || '', carModel: l.car_model || '', productType: l.product_name || l.product || '',
      insurer: l.insurer_name || '', policyNo: l.policy_number || '',
      businessType: l.policy_id ? [l.renewed_from ? 'RENEW' : 'NEW', basis.motorType].filter(Boolean).join(' / ') : '', inception: l.policy_inception || l.effective_date || null,
      sumInsured: l.sum_insured === null || l.sum_insured === undefined ? null : round2(l.sum_insured), netPremium: net, vat, dst, lgt,
      roadside: amount(perils.get('RSA')?.premium), others: round2(Math.max(0, premium - net - vat - dst - lgt)), premium,
      remitting: amount(basis.insurerRemitting ?? premium - commission), grossAmount: round2(commission + commissionVat), commissionVat, netOfVat: commission, ewt,
      netPayable: round2(commission + commissionVat - ewt), due: amount(l.net), varianceShare: amount(basis.varianceShare), referrer: basis.referrer?.name || '',
    };
    for (const [code] of PERIL_KEYS) {
      const x = perils.get(code);
      out[`premium${code}`] = amount(x?.premium);
      out[`remitting${code}`] = amount(x?.insurerRemitting);
      out[`commission${code}`] = amount(x?.commission);
    }
    return out;
  });
  const totals = Object.fromEntries(moneyKeys(columns).map((k) => [k, round2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0))]));
  return { row, rows, totals, columns, motor };
}

/** The header lines of a schedule after the company name: title, insurer, product line, coverage date, number, date. */
async function scheduleHeader(row, fmt) {
  const coverage = row.coverageWeek ? `${formatDate(row.coverageWeek.from, fmt)} to ${formatDate(row.coverageWeek.to, fmt)}` : '';
  return [['Insurer', row.insurer?.name || ''], ['Product line', row.productLine || ''], ['Coverage Date', coverage], ['REM no', row.remittanceNo],
    ['Date', formatDate(await businessToday(), fmt)]];
}

/** The schedule workbook: the letterhead block and header lines above the table, the totals row and the note. */
export async function scheduleXlsx(id, user, opts = {}) {
  const { row, rows, totals, columns } = await scheduleData(id, user, opts);
  const print = await printContext({ user });
  const lh = print.letterhead || {};
  const brand = excelBrand(print);
  const header = await scheduleHeader(row, print.format);
  const banner = [String(lh.name || '').toUpperCase(), 'Remittance Schedule', ...header.map(([k, v]) => `${k}: ${v}`)];
  const data = [...rows, { client: 'TOTAL', ...totals }, { issuedDate: SCHEDULE_NOTE }].map((r) => columns.map((c) => r[c.key] ?? ''));
  const buffer = writeXlsx({
    sheets: [{ name: 'Schedule', columns: columns.map((c) => ({ header: c.label, type: c.type, width: c.width })), rows: data, banner, logo: !!brand.logoImage,
      autoFilter: false }],
    title: `Remittance Schedule ${row.remittanceNo}`, brand, dateFormat: print.format?.dateFormat,
  });
  return { buffer, fileName: await documentFileName(row.remittanceNo, 'Schedule', 'xlsx') };
}

// the PDF keeps the section totals of the layout so that it stays legible on A4; the per-peril columns are in the XLSX
const PDF_SKIP = /^(premium|remitting|commission)(OD|AON|PD|BI|APPA)$|^(carModel|insurer|inception|roadside)$/;

/** The schedule as a PDF listing (A4 landscape, the font reduced to fit): the columns of the XLSX less the per-peril ones. */
export async function schedulePdf(id, user, opts = {}) {
  const data = await scheduleData(id, user, opts);
  const { row, rows, totals } = data;
  const columns = data.columns.filter((c) => !PDF_SKIP.test(c.key));
  const print = await printContext({ user });
  const header = await scheduleHeader(row, print.format);
  const buffer = await renderReportPdf({ title: 'Remittance Schedule', params: header.map(([k, v]) => `${k}: ${v || '-'}`).join('   ·   '),
    columns: columns.map((c) => ({ key: c.key, label: c.label, type: c.type })), rows, totals: { client: 'TOTAL', ...totals },
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
