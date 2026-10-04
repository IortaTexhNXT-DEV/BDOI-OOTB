/**
 * Client comparison and recommendation reports (Operations > Sales & Marketing > Comparison Reports).
 *
 * A report compares the options offered to a client: the insurer offers of a request for quotation (broker slip), or
 * quotations prepared for the same prospect or client. The options are copied into the report when it is prepared, so
 * the report a client received never changes afterwards. The broker recommends one option and gives the reasons; the
 * report prints on the letterhead with the introduction and disclaimer of the Configuration (comparison.*), never with
 * commission figures, and can be e-mailed to the client through the outbox. Accepting records the option chosen.
 */
import { many, one, query } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { renderTemplate } from '../../lib/template.js';
import { companyName } from '../../lib/letterhead.js';
import { queueEmail, documentAttachment } from '../../lib/mailer.js';
import { round2 } from '../documents/common.js';
import { header, formatters, kv } from '../documents/templates.js';
import { signatoryFor, signatureBlock } from '../documents/signatory.js';

export const reportOut = (r) => r && ({
  id: r.id, reportNumber: r.report_number, sourceType: r.source_type, brokerSlipId: r.broker_slip_id, brokerSlipNumber: r.slip_number ?? null, quoteIds: r.quote_ids || [],
  leadId: r.lead_id, clientId: r.client_id, preparedFor: r.prepared_for, title: r.title, introduction: r.introduction, options: r.options || [], criteria: r.criteria || [],
  recommendedKey: r.recommended_key, recommended: (r.options || []).find((o) => o.key === r.recommended_key) || null, reasons: r.reasons || [], disclaimer: r.disclaimer,
  status: r.status, chosenKey: r.chosen_key, issuedAt: r.issued_at, sentTo: r.sent_to, sentAt: r.sent_at, acceptedAt: r.accepted_at,
  createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

const SELECT = `SELECT r.*, bs.slip_number, u.display_name AS created_by_name FROM comparison_reports r LEFT JOIN broker_slips bs ON bs.id = r.broker_slip_id
  LEFT JOIN users u ON u.id = r.created_by`;

export async function listReports(q = {}) {
  return (await many(`${SELECT} WHERE ($1::text IS NULL OR r.status = $1) AND ($2::text IS NULL OR r.report_number ILIKE '%' || $2 || '%' OR r.prepared_for ILIKE '%' || $2 || '%' OR bs.slip_number ILIKE '%' || $2 || '%')
    AND ($3::text IS NULL OR r.broker_slip_id = $3) ORDER BY r.created_at DESC LIMIT 500`, [q.status || null, q.search || null, q.brokerSlipId || null])).map(reportOut);
}

export async function getReportRow(id) {
  const r = await one(`${SELECT} WHERE r.id = $1 OR r.report_number = $1`, [String(id)]);
  if (!r) throw notFound('Comparison report not found');
  return r;
}
export const getReport = async (id) => reportOut(await getReportRow(id));

/** Options from the offers of a broker slip (offered ones only), cheapest first. */
async function optionsFromSlip(slipId) {
  const slip = await one(`SELECT bs.*, COALESCE(c.display_name, l.display_name, bs.insured_name) AS party_name FROM broker_slips bs LEFT JOIN clients c ON c.id = bs.client_id
    LEFT JOIN leads l ON l.id = bs.lead_id WHERE bs.id = $1 OR bs.slip_number = $1`, [String(slipId)]);
  if (!slip) throw notFound('Request for quotation not found');
  const offers = await many(`SELECT o.*, ic.name AS insurer_name FROM insurer_offers o JOIN insurance_companies ic ON ic.id = o.insurance_company_id
    WHERE o.broker_slip_id = $1 AND o.status = 'offered' ORDER BY o.premium_total NULLS LAST, ic.name`, [slip.id]);
  const options = offers.map((o) => ({
    key: o.id, sourceId: o.id, insurerId: o.insurance_company_id, insurer: o.insurer_name, sumInsured: Number(o.sum_insured ?? slip.sum_insured) || 0,
    premium: Number(o.premium) || 0, taxes: Number(o.taxes) || 0, grossPremium: Number(o.premium_total) || round2(Number(o.premium || 0) + Number(o.taxes || 0)),
    deductible: o.deductibles || '', terms: o.terms || '', validUntil: o.validity_date, sharePercent: Number(o.offered_share), highlights: '',
  }));
  return { slip, options, partyName: slip.party_name, leadId: slip.lead_id, clientId: slip.client_id, currency: slip.currency };
}

/** Options from quotations of the same prospect or client. */
async function optionsFromQuotes(ids) {
  const quotes = await many(`SELECT q.*, ic.name AS insurer_name, COALESCE(c.display_name, l.display_name) AS party_name FROM quotes q
    LEFT JOIN insurance_companies ic ON ic.id = q.insurance_company_id LEFT JOIN clients c ON c.id = q.client_id LEFT JOIN leads l ON l.id = q.lead_id
    WHERE (q.id = ANY($1) OR q.quote_number = ANY($1)) AND q.deleted_at IS NULL ORDER BY q.premium_total`, [ids.map(String)]);
  if (quotes.length < 2) throw badRequest('Validation failed', [{ path: 'quoteIds', message: 'Choose at least two quotations to compare' }]);
  const parties = new Set(quotes.map((q) => q.client_id || q.lead_id));
  if (parties.size > 1) throw badRequest('Validation failed', [{ path: 'quoteIds', message: 'The quotations must be for the same prospect or client' }]);
  const options = quotes.map((q) => {
    const d = q.doc || {};
    return {
      key: q.id, sourceId: q.id, quoteNumber: q.quote_number, insurerId: q.insurance_company_id, insurer: q.insurer_name || d.insuranceCompanyName || 'Insurer',
      sumInsured: Number(q.sum_insured), premium: Number(q.premium_base), taxes: round2(Number(q.vat) + Number(q.dst) + Number(q.lgt) + Number(q.fst) + Number(q.others)),
      grossPremium: Number(q.premium_total), deductible: d.deductible || d.deductibles || '', terms: d.remarks || q.remarks || '', validUntil: q.valid_until, highlights: '',
    };
  });
  return { quotes, options, partyName: quotes[0].party_name, leadId: quotes[0].lead_id, clientId: quotes[0].client_id };
}

/** Options with their rank by gross premium (1 = cheapest) and the user's highlights kept. */
const ranked = (options, highlights = {}) => [...options].sort((a, b) => a.grossPremium - b.grossPremium)
  .map((o, i) => ({ ...o, rank: i + 1, highlights: highlights[o.key] ?? o.highlights ?? '' }));

export async function createReport(b, userId) {
  const src = b.brokerSlipId ? await optionsFromSlip(b.brokerSlipId) : await optionsFromQuotes(b.quoteIds || []);
  if (src.options.length < 2) throw badRequest('Validation failed', [{ path: 'brokerSlipId', message: 'At least two insurer offers are needed for a comparison' }]);
  const options = ranked(src.options, b.highlights || {});
  const recommended = b.recommendedKey && options.some((o) => o.key === b.recommendedKey) ? b.recommendedKey : options[0].key;
  const reasons = (b.reasons && b.reasons.length ? b.reasons : [(await getSetting('comparison.default_reasons', []))[0]]).filter(Boolean);
  const number = await nextDocumentNumber('comparison_report', { unique: { table: 'comparison_reports', column: 'report_number' } });
  const r = await one(`INSERT INTO comparison_reports(report_number, source_type, broker_slip_id, quote_ids, lead_id, client_id, prepared_for, title, introduction, options, criteria,
      recommended_key, reasons, disclaimer, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id`,
  [number, b.brokerSlipId ? 'broker_slip' : 'quotations', src.slip?.id || null, src.quotes ? src.quotes.map((q) => q.id) : [], src.leadId || null, src.clientId || null,
    b.preparedFor || src.partyName || 'Client', b.title || ((await getSetting('comparison.report_title', null)) || ''),
    b.introduction ?? ((await getSetting('comparison.introduction', null)) || ''), JSON.stringify(options), JSON.stringify(b.criteria || []), recommended, reasons,
    b.disclaimer ?? ((await getSetting('comparison.disclaimer', null)) || ''), userId]);
  return getReport(r.id);
}

/** Change the recommendation, reasons, wording or highlights of a report not yet accepted. */
export async function updateReport(id, b, userId) {
  const before = await getReportRow(id);
  if (before.status === 'accepted') throw conflict('The client already chose an option: prepare a new report');
  const options = b.highlights ? ranked(before.options, b.highlights) : before.options;
  if (b.recommendedKey && !options.some((o) => o.key === b.recommendedKey)) throw badRequest('Validation failed', [{ path: 'recommendedKey', message: 'Not one of the options of the report' }]);
  await query(`UPDATE comparison_reports SET prepared_for = COALESCE($2, prepared_for), title = COALESCE($3, title), introduction = COALESCE($4, introduction), options = $5,
      recommended_key = COALESCE($6, recommended_key), reasons = COALESCE($7, reasons), disclaimer = COALESCE($8, disclaimer), criteria = COALESCE($9, criteria),
      updated_by = $10, updated_at = now() WHERE id = $1`,
  [before.id, b.preparedFor ?? null, b.title ?? null, b.introduction ?? null, JSON.stringify(options), b.recommendedKey ?? null, b.reasons ?? null, b.disclaimer ?? null,
    b.criteria ? JSON.stringify(b.criteria) : null, userId]);
  return { before: reportOut(before), after: await getReport(before.id) };
}

/** Record the option the client chose. */
export async function acceptReport(id, chosenKey, userId) {
  const r = await getReportRow(id);
  if (!r.options.some((o) => o.key === chosenKey)) throw badRequest('Validation failed', [{ path: 'chosenKey', message: 'Not one of the options of the report' }]);
  await query("UPDATE comparison_reports SET status = 'accepted', chosen_key = $2, accepted_at = now(), issued_at = COALESCE(issued_at, now()), updated_by = $3, updated_at = now() WHERE id = $1",
    [r.id, chosenKey, userId]);
  return getReport(r.id);
}

export const markIssued = (id) => query("UPDATE comparison_reports SET status = CASE WHEN status = 'draft' THEN 'issued' ELSE status END, issued_at = COALESCE(issued_at, now()) WHERE id = $1", [id]);

/** The client's e-mail: of the client, else of the prospect. */
async function partyEmail(r) {
  const row = await one('SELECT COALESCE((SELECT email FROM clients WHERE id = $1), (SELECT email FROM leads WHERE id = $2)) AS email', [r.client_id, r.lead_id]);
  return row?.email || null;
}

/** Queue the report to the client (PDF attached, generated when the e-mail is sent). */
export async function emailReport(id, to = null, userId = null) {
  const r = await getReportRow(id);
  const address = to || (await partyEmail(r));
  if (!address) throw badRequest('The client has no e-mail address: enter the address to send to');
  const vars = { clientName: r.prepared_for, reportNumber: r.report_number, companyName: await companyName() };
  const outboxId = await queueEmail({
    to: address, subject: renderTemplate(await getSetting('comparison.email_subject', 'Insurance proposal {{reportNumber}}'), vars, { html: false }),
    html: renderTemplate((await getSetting('comparison.email_body', null)) || '', vars), template: 'comparison-report', entity: 'comparison_report', entityId: r.id,
    attachments: [documentAttachment('comparison-report', { reportId: r.id }, `comparison-report-${r.report_number}.pdf`)],
  });
  await query("UPDATE comparison_reports SET status = CASE WHEN status = 'draft' THEN 'issued' ELSE status END, issued_at = COALESCE(issued_at, now()), sent_to = $2, sent_at = now(), updated_by = $3 WHERE id = $1",
    [r.id, address, userId]);
  return { outboxId, to: address };
}

/** Document spec of the report: letterhead, introduction, comparison table, the recommendation and its reasons, disclaimer. */
export async function comparisonReportSpec(id) {
  const r = reportOut(await getReportRow(id));
  const h = await header(r.title, r.reportNumber);
  const f = formatters(h);
  const signatory = await signatoryFor(null);
  const rec = r.recommended;
  const columns = [{ key: 'rank', label: '#' }, { key: 'insurer', label: 'Insurer' }, { key: 'sumInsured', label: 'Sum insured', type: 'money' },
    { key: 'premium', label: 'Premium', type: 'money' }, { key: 'taxes', label: 'Taxes', type: 'money' }, { key: 'grossPremium', label: 'Total premium', type: 'money' },
    { key: 'deductible', label: 'Deductible' }, { key: 'validUntil', label: 'Valid until' }];
  return {
    ...h,
    meta: kv([['Prepared for', r.preparedFor], ['Date', f.date(new Date(r.issuedAt || r.createdAt || Date.now()).toISOString().slice(0, 10))],
      ['Request for quotation', r.brokerSlipNumber], ['Options compared', String(r.options.length)]]),
    sections: [
      ...(r.introduction ? [{ text: r.introduction }] : []),
      { heading: 'Comparison of the offers', table: { columns, rows: r.options.map((o) => ({ ...o, insurer: o.key === r.recommendedKey ? `${o.insurer} (recommended)` : o.insurer,
        validUntil: o.validUntil ? f.date(o.validUntil) : '', deductible: o.deductible || '' })) } },
      ...r.options.filter((o) => o.terms || o.highlights).map((o) => ({ heading: o.insurer, rows: kv([['Key terms', o.terms], ['What stands out', o.highlights]]), columns: 1 })),
      ...(rec ? [{ heading: 'Our recommendation', rows: kv([['Recommended insurer', rec.insurer], ['Total premium', f.ccy(rec.grossPremium)], ['Sum insured', f.ccy(rec.sumInsured)]]) },
        { heading: 'Why we recommend it', text: r.reasons.map((x, i) => `${i + 1}. ${x}`).join('\n') }] : []),
      ...(r.disclaimer ? [{ note: r.disclaimer }] : []),
      { signatures: [signatureBlock('Prepared by', signatory), 'Conforme (client signature and date)'] },
    ],
  };
}
