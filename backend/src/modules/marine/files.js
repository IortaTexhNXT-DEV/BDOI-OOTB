/**
 * The declaration to the insurer (FR-PCL-023, 024, 031, 050, 051).
 *
 * Declaration file: an Excel workbook in the layout of the open cover (marine.declaration_file_layouts): sheet
 * Declaration (one row per certificate and cover of a parcel cover, one row per shipment of a cargo cover, reversals as
 * negative REVERSAL rows, the columns of the layout), sheet Summary (per cover: certificates, sum insured, premium, net
 * premium, taxes, commission; or the premium and taxes of a cargo declaration) and sheet Control (open policy, period,
 * rows, total premium, created at and by). It is written from a submitted declaration only, never when its total
 * differs from the declaration premium, and every version is kept until the insurer accepts the declaration.
 *
 * Send to the insurer queues an e-mail to the cover's declaration e-mail with the file, the Declaration summary (PDF)
 * and, for a parcel cover, the Parcel certificate register (Excel); the insurer's acceptance is recorded with its
 * reference (Accepted, or Accepted with differences: rows and premium accepted, remark). Billing does not wait for it.
 */
import { many, one } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { documentAttachment, queueEmail } from '../../lib/mailer.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { isoDate, today } from '../../lib/dates.js';
import { printFormat } from '../../lib/pdf/index.js';
import { renderTemplate } from '../documents/common.js';
import { num, round2 } from '../documents/common.js';
import { getCoverRow, getDeclaration, getDeclarationRow, listCertificates } from './service.js';
import { fileLayouts, lineTaxRates, taxesInside } from './terms.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const yyyymm = (period) => String(period).replace('-', '');

/** "Maria Clara Reyes" -> "REYES, MARIA CLARA" (layout nameFormat LAST, FIRST; upper case when upperCaseNames). */
export function layoutName(name, layout = {}) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  let out = parts.join(' ');
  if (layout.nameFormat === 'LAST, FIRST' && parts.length > 1) out = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
  return layout.upperCaseNames ? out.toUpperCase() : out;
}

/** The value of a Declaration column for a parcel row (certificate x cover) or a cargo row. */
function cell(col, ctx) {
  const { d, cover, x, c, sign, layout, taxes } = ctx;
  const map = {
    DECL_NO: d.declarationNumber, DECL_DATE: x.dailyDeclarationDate || String(x.shipmentDate).slice(0, 10), CERT_NO: x.certificateNumber,
    POLICY_NO: c?.insurerPolicyNo || cover.insurer_reference || '', COVER: c?.line || '', COVER_NAME: c?.name || '', ASSURED: cover.client_name,
    CUSTOMER: layoutName(x.customerName, layout), LOAN_ACCOUNT: x.loanAccount || '', ADDRESS: [x.city, x.province].filter(Boolean).join(', '),
    WAYBILL: x.waybillNo || '', COURIER: x.courier || '', PARCEL_DATE: String(x.shipmentDate).slice(0, 10), LATE: x.late ? 'Y' : 'N',
    SUM_INSURED: round2(sign * num(c ? c.sumInsured : x.insuredValue)), PREMIUM: round2(sign * num(c ? c.premium : x.premium)),
    NET_PREMIUM: taxes ? round2(sign * taxes.net) : '', TAXES: taxes ? round2(sign * (taxes.vat + taxes.dst + taxes.lgt)) : '',
    STATUS: sign < 0 ? 'REVERSAL' : 'NEW', SHIPMENT_DATE: String(x.shipmentDate).slice(0, 10), CONVEYANCE: x.conveyance || '', VOYAGE_FROM: x.voyageFrom || '',
    VOYAGE_TO: x.voyageTo || '', DELIVERY_RECEIPT: x.billOfLading || '', TRUCK_PLATE: x.vesselName || '', GOODS: x.goodsDescription || '', CONSIGNEE: x.consignee || '',
    INVOICE_VALUE: round2(sign * num(x.invoiceValue)), MARKUP_PCT: num(x.markupPercent), INSURED_VALUE: round2(sign * num(x.insuredValue)), RATE_PCT: num(x.ratePercent),
  };
  return map[col] ?? '';
}
const NUMERIC = new Set(['SUM_INSURED', 'PREMIUM', 'NET_PREMIUM', 'TAXES', 'INVOICE_VALUE', 'INSURED_VALUE']);

/** The rows of the Declaration sheet and their premium total. */
async function declarationRows(d, cover, layout) {
  const columns = Array.isArray(layout.columns) && layout.columns.length ? layout.columns : ['DECL_NO', 'CERT_NO', 'PREMIUM', 'STATUS'];
  const rows = [];
  let total = 0;
  const rates = new Map();
  const ratesOf = async (line) => { if (!rates.has(line)) rates.set(line, await lineTaxRates(line)); return rates.get(line); };
  const lists = [[d.items.filter((x) => x.status !== 'cancelled'), 1], [d.reversalItems, -1]];
  for (const [list, sign] of lists) {
    for (const x of list) {
      if (cover.cover_type === 'parcel') {
        for (const c of x.covers || []) {
          const taxes = taxesInside(num(c.premium), await ratesOf(c.line));
          rows.push(columns.map((col) => cell(col, { d, cover, x, c, sign, layout, taxes })));
          total = round2(total + sign * num(c.premium));
        }
      } else {
        rows.push(columns.map((col) => cell(col, { d, cover, x, c: null, sign, layout, taxes: null })));
        total = round2(total + sign * num(x.premium));
      }
    }
  }
  return { columns, rows, total };
}

/** The file name of a layout ({insurerCode}, {policyNo}, {period}, {declarationNo}). */
const fileNameOf = (layout, { insurerCode, policyNo, period, declarationNo }) => String(layout.fileName || '{insurerCode}_{policyNo}_{period}_{declarationNo}.xlsx')
  .replace('{insurerCode}', insurerCode || 'INSURER').replace('{policyNo}', policyNo || 'POLICY').replace('{period}', period).replace('{declarationNo}', declarationNo)
  .replace(/[^A-Za-z0-9._-]/g, '-');

/**
 * Write the declaration file of a submitted declaration (MSG-PCL-046 otherwise) in the cover's layout; refused when the
 * Declaration total differs from the declaration premium (MSG-PCL-045). Each version is kept.
 */
export async function generateFile(declarationId, user) {
  const row = await getDeclarationRow(declarationId);
  if (!['submitted', 'billed', 'nil'].includes(row.status)) throw conflict('Submit the declaration before generating the file');
  if (['accepted', 'accepted-with-differences'].includes(row.file_status)) throw conflict(`Declaration ${row.declaration_number} is already accepted by the insurer`);
  const cover = await getCoverRow(row.open_cover_id);
  const layouts = await fileLayouts();
  const code = cover.file_layout || (cover.cover_type === 'parcel' ? 'axa-parcel' : 'cargo');
  const layout = layouts[code];
  if (!layout) throw badRequest('Validation failed', [{ path: 'fileLayout', message: 'Choose a declaration file layout', code: 'MSG-PCL-013' }]);
  const d = await getDeclaration(row.id);
  const { columns, rows, total } = await declarationRows(d, cover, layout);
  if (Math.abs(total - d.premium) > 0.005) throw conflict(`The file total ${total.toFixed(2)} differs from the declaration premium ${d.premium.toFixed(2)}: the file was not written`);
  const who = user?.id ? (await one('SELECT display_name FROM users WHERE id = $1', [user.id]))?.display_name || user.username || '' : 'system';
  const now = new Date().toISOString();
  const summary = cover.cover_type === 'parcel'
    ? { columns: ['Cover', 'Line', 'Policy no.', 'Certificates', 'Sum insured', 'Premium', 'Net premium', 'VAT', 'DST', 'LGT', 'Commission'].map((h, i) => ({ header: h, type: i > 2 ? (i === 3 ? 'integer' : 'money') : 'text', width: 16 })),
      rows: [...d.coverLines.map((l) => [l.cover, l.line, l.insurerPolicyNo, l.certificates, l.sumInsured, l.premium, l.net, l.vat, l.dst, l.lgt, l.commission]),
        ['Total', '', '', d.shipments - d.reversals, d.totalInsured, d.premium, round2(d.coverLines.reduce((s, l) => s + l.net, 0)), d.vat, d.dst, d.lgt, d.commission]] }
    : { columns: ['Shipments', 'Insured value', 'Premium', 'VAT', 'DST', 'LGT', 'Other charges', 'Total'].map((h, i) => ({ header: h, type: i ? 'money' : 'integer', width: 16 })),
      rows: [[d.shipments - d.reversals, d.totalInsured, d.premium, d.vat, d.dst, d.lgt, d.otherCharges, d.grossPremium]] };
  const buf = writeXlsx({
    title: `Declaration ${d.declarationNumber}`,
    sheets: [
      { name: 'Declaration', columns: columns.map((c) => ({ header: c, type: NUMERIC.has(c) ? 'money' : 'text', width: Math.max(12, c.length + 4) })), rows },
      { name: 'Summary', ...summary },
      { name: 'Control', autoFilter: false, columns: [{ header: 'Item', width: 22 }, { header: 'Value', width: 40 }],
        rows: [['Open policy', cover.insurer_reference || cover.policy_number || ''], ['Open cover', cover.cover_number], ['Declaration', d.declarationNumber], ['Period', d.period],
          ['Rows', String(rows.length)], ['Total premium', total.toFixed(2)], ['Created at', now], ['Created by', who]] },
    ],
  });
  const fileName = fileNameOf(layout, { insurerCode: cover.insurer_code, policyNo: cover.insurer_reference || cover.policy_number, period: yyyymm(d.period), declarationNo: d.declarationNumber });
  const version = Number((await one('SELECT COALESCE(max(version), 0) + 1 AS v FROM open_cover_declaration_files WHERE declaration_id = $1', [row.id])).v);
  const f = await one(`INSERT INTO open_cover_declaration_files(declaration_id, version, layout, file_name, rows_count, total_premium, content, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [row.id, version, code, fileName, rows.length, total, buf, user?.id || null]);
  if (row.file_status === 'not-generated') await one("UPDATE open_cover_declarations SET file_status = 'generated', updated_at = now() WHERE id = $1 RETURNING id", [row.id]);
  return { id: f.id, version, fileName, rows: rows.length, totalPremium: total, message: `Declaration file ${fileName} written` };
}

/** The latest file of a declaration (or a version): { fileName, content }. */
export async function latestFile(declarationId, version = null) {
  const f = await one(`SELECT f.file_name, f.content FROM open_cover_declaration_files f JOIN open_cover_declarations d ON d.id = f.declaration_id
    WHERE (d.id = $1 OR d.declaration_number = $1) AND ($2::int IS NULL OR f.version = $2) ORDER BY f.version DESC LIMIT 1`, [String(declarationId), version]);
  if (!f) throw notFound('The declaration file has not been written: submit the declaration first');
  return { fileName: f.file_name, content: f.content, contentType: XLSX };
}

/** Parcel certificate register (FR-PCL-051): the certificates of a declaration, or of a cover and date range. */
export async function certificateRegister({ declarationId = null, coverId = null, from = null, to = null }) {
  let certs;
  let title;
  if (declarationId) {
    const d = await getDeclaration(declarationId);
    certs = [...d.items, ...d.reversalItems.map((x) => ({ ...x, reversalLine: true }))];
    title = `Certificate register ${d.declarationNumber}`;
  } else {
    certs = await listCertificates(coverId, { from, to });
    title = 'Certificate register';
  }
  const header = ['Certificate', 'Parcel date', 'Declaration date', 'Customer', 'Loan account', 'City', 'Province', 'Waybill', 'Delivery type', 'Flat charge', 'Covers', 'Sum insured',
    'Premium', 'Status', 'Late', 'Possible duplicate'];
  const rows = certs.map((x) => {
    const sign = x.reversalLine ? -1 : 1;
    return [x.certificateNumber, String(x.shipmentDate).slice(0, 10), x.dailyDeclarationDate || '', x.customerName || '', x.loanAccount || '', x.city || '', x.province || '', x.waybillNo || '',
      x.deliveryType || '', x.deliveryCharge ?? '', (x.covers || []).map((c) => c.name).join('; '), round2(sign * x.insuredValue), round2(sign * x.premium),
      x.reversalLine ? 'Reversal' : ({ issued: 'Issued', declared: 'Declared', cancelled: 'Cancelled', reversed: 'Reversed' }[x.status] || x.status), x.late ? 'Y' : 'N', x.possibleDuplicate ? 'Y' : 'N'];
  });
  const fmt = await printFormat();
  const content = writeXlsx({ title, dateFormat: fmt.dateFormat, sheets: [{ name: 'Certificates', columns: header.map((h) => ({ header: h, type: ['Sum insured', 'Premium', 'Flat charge'].includes(h) ? 'money' : 'text', width: 16 })), rows }] });
  return { fileName: `${title.replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase()}.xlsx`, content, contentType: XLSX, rows: rows.length };
}

/** Send the declaration to the insurer (MSG-PCL-048 without the cover's e-mail): file, summary and register attached. */
export async function sendDeclaration(declarationId, user) {
  const row = await getDeclarationRow(declarationId);
  if (!row.declaration_email) throw conflict('Enter the declaration file e-mail on the open cover first');
  if (!['submitted', 'billed', 'nil'].includes(row.status)) throw conflict('Submit the declaration before generating the file');
  if (!(await one('SELECT 1 FROM open_cover_declaration_files WHERE declaration_id = $1', [row.id]))) await generateFile(row.id, user);
  const cover = await getCoverRow(row.open_cover_id);
  const file = await latestFile(row.id);
  const d = await getDeclaration(row.id);
  const vars = { declarationNumber: d.declarationNumber, policyNo: cover.insurer_reference || cover.policy_number || '', period: d.period, insurerName: cover.insurer_name,
    rows: String((await one('SELECT rows_count FROM open_cover_declaration_files WHERE declaration_id = $1 ORDER BY version DESC LIMIT 1', [row.id])).rows_count), premium: d.premium.toFixed(2) };
  const attachments = [documentAttachment('marine-declaration-file', { declarationId: row.id }, file.fileName, XLSX),
    documentAttachment('marine-declaration-summary', { declarationId: row.id }, `declaration-summary-${d.declarationNumber}.pdf`)];
  if (cover.cover_type === 'parcel') attachments.push(documentAttachment('parcel-certificate-register', { declarationId: row.id }, `certificate-register-${d.declarationNumber}.xlsx`, XLSX));
  const id = await queueEmail({ to: row.declaration_email, subject: renderTemplate((await getSetting('marine.declaration_email_subject', null)) || '', vars, { html: false }),
    html: renderTemplate((await getSetting('marine.declaration_email_body', null)) || '', vars), template: 'marine-declaration',
    entity: 'marine_declaration', entityId: row.id, attachments });
  const status = ['accepted', 'accepted-with-differences'].includes(row.file_status) ? row.file_status : 'sent';
  await one('UPDATE open_cover_declarations SET file_status = $2, file_sent_at = now(), file_sent_to = $3, email_id = $4, updated_at = now() WHERE id = $1 RETURNING id',
    [row.id, status, row.declaration_email, id]);
  return { emailId: id, to: row.declaration_email, attachments: attachments.length, message: `Declaration ${d.declarationNumber} queued for e-mail to ${row.declaration_email}` };
}

/** Record the insurer's answer: reference (MSG-PCL-050), result, and with differences the rows and premium accepted and a remark. */
export async function recordAcceptance(declarationId, b, user) {
  const row = await getDeclarationRow(declarationId);
  if (!['submitted', 'billed', 'nil'].includes(row.status)) throw conflict('Submit the declaration before generating the file');
  if (!String(b.reference || '').trim()) throw badRequest('Validation failed', [{ path: 'insurerReference', message: "Enter the insurer's reference for the declaration", code: 'MSG-PCL-050' }]);
  const result = b.result === 'accepted-with-differences' ? 'accepted-with-differences' : 'accepted';
  if (result === 'accepted-with-differences' && !String(b.remark || '').trim()) throw badRequest('Validation failed', [{ path: 'remark', message: 'Enter the differences the insurer found' }]);
  const acceptance = { date: isoDate(b.date) || await today(), reference: String(b.reference).trim(), result, rows: b.rows === undefined || b.rows === null ? null : Number(b.rows),
    premium: b.premium === undefined || b.premium === null ? null : round2(num(b.premium)), remark: b.remark || null, recordedBy: user.id, recordedAt: new Date().toISOString() };
  await one('UPDATE open_cover_declarations SET file_status = $2, acceptance = $3, updated_at = now() WHERE id = $1 RETURNING id', [row.id, result, JSON.stringify(acceptance)]);
  return { acceptance, message: 'Insurer acceptance recorded' };
}

/** The Declaration summary (FR-PCL-050) as a document spec; the cargo declaration keeps the Declaration of Shipments. */
export async function declarationSummarySpec(declarationId, f) {
  const d = await getDeclaration(declarationId);
  const c = await getCoverRow(d.openCoverId);
  const meta = [['Open cover', c.cover_number], ['Open policy', c.insurer_reference || c.policy_number], ['Policy number', c.policy_number], ['Assured', c.client_name],
    ['Insurer', c.insurer_name], ['Period', `${f.date(d.periodFrom)} to ${f.date(d.periodTo)}`], ['Declaration', d.declarationNumber], ['Status', d.status], ['Bill', d.billNumber]];
  if (c.cover_type !== 'parcel') {
    const items = d.items.filter((x) => x.status !== 'cancelled');
    return { title: 'Declaration of Shipments', number: d.declarationNumber, orientation: 'landscape', meta, sections: [
      { heading: 'Shipments', table: {
        columns: [{ key: 'certificateNumber', label: 'Certificate' }, { key: 'shipmentDate', label: 'Date' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'voyage', label: 'Voyage' },
          { key: 'vesselName', label: 'Vessel / flight' }, { key: 'insuredValue', label: 'Insured value', type: 'money' }, { key: 'ratePercent', label: 'Rate %', type: 'number' },
          { key: 'premium', label: 'Premium', type: 'money' }],
        rows: [...items.map((x) => ({ ...x, shipmentDate: f.date(x.shipmentDate), voyage: `${x.voyageFrom} to ${x.voyageTo}`, vesselName: x.vesselName || '' })),
          ...d.reversalItems.map((x) => ({ ...x, certificateNumber: `${x.certificateNumber} (reversal)`, shipmentDate: f.date(x.shipmentDate), voyage: `${x.voyageFrom} to ${x.voyageTo}`,
            vesselName: x.vesselName || '', insuredValue: -x.insuredValue, premium: -x.premium }))],
        totals: { certificateNumber: `${items.length} shipment(s)`, insuredValue: d.totalInsured, premium: d.premium } } },
      { heading: 'Premium', rows: [['Premium', f.ccy(d.premium, c.currency)], ['VAT', f.ccy(d.vat, c.currency)], ['Documentary stamp tax', f.ccy(d.dst, c.currency)],
        ['Local government tax', f.ccy(d.lgt, c.currency)], ['Other charges', d.otherCharges ? f.ccy(d.otherCharges, c.currency) : ''], ['Total premium due', f.ccy(d.grossPremium, c.currency)]] },
    ] };
  }
  return { title: 'Declaration Summary', number: d.declarationNumber, orientation: 'landscape', meta, sections: [
    { heading: 'Covers', table: {
      columns: [{ key: 'cover', label: 'Cover' }, { key: 'insurerPolicyNo', label: 'Policy no.' }, { key: 'certificates', label: 'Certificates', type: 'number' },
        { key: 'sumInsured', label: 'Sum insured', type: 'money' }, { key: 'premium', label: 'Premium', type: 'money' }, { key: 'net', label: 'Net premium', type: 'money' },
        { key: 'vat', label: 'VAT', type: 'money' }, { key: 'dst', label: 'DST', type: 'money' }, { key: 'lgt', label: 'LGT', type: 'money' }, { key: 'commission', label: 'Commission', type: 'money' }],
      rows: d.coverLines, totals: { cover: 'Total', sumInsured: d.totalInsured, premium: d.premium, vat: d.vat, dst: d.dst, lgt: d.lgt, commission: d.commission } } },
    { heading: 'Daily declarations', table: {
      columns: [{ key: 'declarationNumber', label: 'Daily declaration' }, { key: 'date', label: 'Date' }, { key: 'items', label: 'Certificates', type: 'number' },
        { key: 'lateItems', label: 'Late items', type: 'number' }, { key: 'premium', label: 'Premium', type: 'money' }, { key: 'status', label: 'Status' }],
      rows: d.dailyDeclarations.map((x) => ({ ...x, date: f.date(x.date) })) } },
    ...(d.reversalItems.length ? [{ heading: 'Reversals', table: {
      columns: [{ key: 'certificateNumber', label: 'Certificate' }, { key: 'shipmentDate', label: 'Parcel date' }, { key: 'customerName', label: 'Customer' }, { key: 'premium', label: 'Premium', type: 'money' },
        { key: 'charge', label: 'Charge', type: 'money' }],
      rows: d.reversalItems.map((x) => ({ ...x, shipmentDate: f.date(x.shipmentDate), premium: -x.premium, charge: -x.charge })) } }] : []),
    { heading: 'Totals', rows: [['Certificates', String(d.shipments - d.reversals)], ['Premium (inclusive of taxes)', f.ccy(d.premium, c.currency)],
      ['Of which taxes (VAT, DST, LGT)', f.ccy(round2(d.vat + d.dst + d.lgt), c.currency)], ['Charge billed to the client', f.ccy(d.chargeTotal, c.currency)],
      ['Service fee', f.ccy(d.serviceFee, c.currency)], ['Commission due from the insurer', f.ccy(d.commission, c.currency)], ['Remittance basis', d.remittanceBasis === 'gross' ? 'Gross' : 'Net']] },
  ] };
}

/** Files of a declaration (versions). */
export async function declarationFiles(declarationId) {
  return many(`SELECT version, file_name AS "fileName", rows_count AS rows, total_premium AS "totalPremium", created_at AS "createdAt" FROM open_cover_declaration_files
    WHERE declaration_id = $1 ORDER BY version DESC`, [declarationId]);
}
