/**
 * Printed documents of the open covers, on the BrokerVerse document engine (lib/pdf: company letterhead, footer, the
 * Documents and Reports Layout of the theme): the parcel certificate of insurance (FR-PCL-013) and the cargo
 * certificate. A cancelled certificate prints with a CANCELLED watermark and no signature.
 */
import { getSetting } from '../../lib/settings.js';
import { printContext } from '../../lib/pdf/index.js';
import { buildPdf, buildPdfBatch } from '../documents/pdf.js';
import { formatters, kv } from '../documents/templates.js';
import { signatoryFor, signatureBlock } from '../documents/signatory.js';
import { getCertificateRow, getCoverRow } from './service.js';
import { parcelPassword } from './parcel.js';

/** Document spec of a parcel certificate (row of CERT_SELECT) under its cover. */
async function parcelSpec(x, c, f, signatory) {
  const cancelled = ['cancelled', 'reversed'].includes(x.status);
  const covers = (x.covers || []).map((v) => ({ cover: v.name, policy: v.insurerPolicyNo || c.insurer_reference || '', sumInsured: Number(v.sumInsured),
    period: v.to ? `${f.date(v.from)} to ${f.date(v.to)}` : `In transit from ${f.date(v.from)}` }));
  const limit = (x.covers || []).find((v) => String(v.line).toUpperCase() === 'MARINE');
  return {
    title: 'Certificate of Insurance - Parcel / Courier', number: x.certificate_number, watermark: cancelled ? x.status.toUpperCase() : undefined,
    meta: kv([['Open policy', c.insurer_reference], ['Policy number', c.policy_number], ['Insurer', c.insurer_name], ['Assured of the open policy', c.client_name],
      ['Broker', f.company || ''], ['Date issued', f.date(String(x.issued_at).slice(0, 10))], ['Status', cancelled ? x.status.toUpperCase() : '']]),
    sections: [
      { heading: 'Customer', rows: kv([['Name', x.customer_name], ['TFS loan account', x.loan_account],
        ['Delivery address', [x.address_line, x.barangay, x.city, x.province, x.zip_code].filter(Boolean).join(', ')]]) },
      { heading: 'Parcel', rows: kv([['Parcel date', f.date(x.shipment_date)], ['Documents sent', x.documents_sent], ['Courier', x.courier], ['Waybill no.', x.waybill_no],
        ['Delivery type', x.delivery_type]]) },
      { heading: 'Covers', table: { columns: [{ key: 'cover', label: 'Cover' }, { key: 'policy', label: 'Insurer policy no.' }, { key: 'sumInsured', label: 'Sum insured', type: 'money' },
        { key: 'period', label: 'Period of cover' }], rows: covers } },
      ...(limit ? [{ heading: 'Limit of liability', text: `${f.ccy(limit.sumInsured, c.currency)} per parcel, in excess of what is recoverable from the courier.` }] : []),
      { text: (await getSetting('parcel.certificate_wording', null)) || '' },
      { text: c.clauses ? `Clauses of the open policy: ${c.clauses}` : 'Subject to the clauses of the open policy.' },
      ...(cancelled ? [] : [{ signatures: [signatureBlock('For and on behalf of the insurer', signatory)] }]),
    ],
  };
}

/** Document spec of a cargo certificate or declared shipment. */
async function cargoSpec(x, c, f, signatory) {
  return {
    title: x.kind === 'declared' ? 'Declared Shipment' : 'Marine Insurance Certificate', number: x.certificate_number, watermark: x.status === 'cancelled' ? 'CANCELLED' : undefined,
    meta: kv([['Open cover', c.cover_number], ['Policy number', c.policy_number], ['Insurer', c.insurer_name], ['Assured', c.client_name], ['Date issued', f.date(String(x.issued_at).slice(0, 10))],
      ['Status', x.status === 'cancelled' ? 'CANCELLED' : '']]),
    sections: [
      { heading: 'Shipment', rows: kv([['Conveyance', x.conveyance], ['Vessel / flight', x.vessel_name], ['Voyage', `${x.voyage_from} to ${x.voyage_to}`], ['Sailing / shipment date', f.date(x.shipment_date)],
        ['Bill of lading / airway bill', x.bill_of_lading], ['Goods', x.goods_description], ['Packing', x.packing], ['Consignee', x.consignee]]) },
      { heading: 'Insured value', rows: kv([['Invoice value', f.ccy(x.invoice_value, c.currency)], ['Mark-up', `${Number(x.markup_percent)}%`], ['Insured value', f.ccy(x.insured_value, c.currency)],
        ['Rate', `${Number(x.rate_percent)}%`], ['Premium', f.ccy(x.premium, c.currency)]]) },
      { heading: 'Conditions', text: c.clauses || 'Institute Cargo Clauses (A), Institute War and Strikes Clauses (Cargo), as per the open cover.' },
      { text: (await getSetting('marine.certificate_wording', null)) || '' },
      ...(x.status === 'cancelled' ? [] : [{ signatures: [signatureBlock('For and on behalf of the insurer', signatory)] }]),
    ],
  };
}

/** Spec of any certificate row. */
export async function certificateSpec(x, c = null, ctx = null) {
  const cover = c || await getCoverRow(x.open_cover_id);
  const h = ctx || await printContext();
  const f = { ...formatters(h), company: h.letterhead?.name || '' };
  const signatory = await signatoryFor(null);
  return x.kind === 'parcel' ? parcelSpec(x, cover, f, signatory) : cargoSpec(x, cover, f, signatory);
}

/** PDF of one certificate; `protect` encrypts a parcel certificate with its password rule (the e-mailed copy). */
export async function certificatePdf(id, { protect = false } = {}) {
  const x = await getCertificateRow(id);
  const ctx = await printContext();
  const spec = await certificateSpec(x, null, ctx);
  const password = protect && x.kind === 'parcel' ? await parcelPassword(x) : '';
  return { pdf: buildPdf({ ...ctx, ...spec, password: password || undefined }), row: x };
}

/** One PDF with the certificates of a list (Print certificates of the day). */
export async function certificatesPdf(rows) {
  const ctx = await printContext();
  const c = rows.length ? await getCoverRow(rows[0].open_cover_id) : null;
  const specs = [];
  for (const x of rows) specs.push({ ...ctx, ...(await certificateSpec(x, c, ctx)) });
  return buildPdfBatch(specs, { title: 'Parcel certificates' });
}
