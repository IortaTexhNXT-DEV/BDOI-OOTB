/**
 * Documents attached to e-mails (lib/mailer.js documentAttachment): each generator builds the PDF of one record when
 * the message is sent, from the same templates as the print buttons, so the outbox keeps only a reference.
 *
 *   official-receipt       { receiptId }     official receipt (Accounts > Receipts > Print)
 *   premium-invoice        { receivableId }  premium invoice / statement of account of one bill
 *   commission-debit-note  { debitNoteId }   commission debit note to the insurer (direct bill)
 *   policy-schedule        { policyId }      policy schedule
 *   placement-slip         { placementId, insurerId }  placement slip (firm order) showing that insurer's share
 *   bank-endorsement-letter { saleId }       letter to the financing bank of a dealer sale (motor programmes)
 *   comparison-report      { reportId }      client comparison and recommendation report
 *   endorsement            { endorsementId } endorsement or cancellation request to the insurer
 *   quotation-slip         { quoteId }       the quotation as printed for the client
 *   remittance-schedule    { remittanceId }  the remittance schedule to the insurer (XLSX, insurer copy)
 *   parcel-certificate     { certificateId } parcel certificate of insurance, protected by parcel.certificate_password
 *   marine-declaration-file { declarationId } latest declaration file of a monthly declaration (Excel, insurer layout)
 *   marine-declaration-summary { declarationId } Declaration summary (parcel) or Declaration of Shipments (cargo)
 *   parcel-certificate-register { declarationId } certificate register of a parcel declaration (Excel)
 *   credit-life-certificate { memberId }     Credit Life certificate of cover, protected by credit_life.certificate_password
 *   credit-life-soa        { batchId }       statement of account of a Credit Life batch to the financing bank
 *   credit-life-batch-list { batchId }       the issued accounts of a Credit Life batch forwarded to the insurer (Excel)
 */
import { pool } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { buildPdf } from './pdf.js';
import { receiptDoc, policyScheduleDoc, printablePolicy, commissionDebitNoteDoc } from './templates.js';
import { billStatement } from '../receipts/billing.js';
import { getDebitNote } from '../remittance/directbill.js';
import { getPolicyRow, toPolicy } from '../policies/service.js';

const PDF = 'application/pdf';

const GENERATORS = {
  'official-receipt': async ({ receiptId }) => {
    const r = (await pool.query('SELECT r.*, c.display_name AS client_name FROM receipts r LEFT JOIN clients c ON c.id = r.client_id WHERE r.id = $1 OR r.receipt_number = $1', [String(receiptId)])).rows[0];
    if (!r) throw notFound('Receipt not found');
    const lines = (await pool.query('SELECT * FROM receipt_lines WHERE receipt_id = $1 ORDER BY line_no', [r.id])).rows;
    return { fileName: `receipt-${r.receipt_number}.pdf`, content: buildPdf(await receiptDoc(r, lines)) };
  },
  'premium-invoice': async ({ receivableId }) => {
    const s = await billStatement(pool, receivableId);
    return { fileName: s.fileName, content: s.pdf };
  },
  'commission-debit-note': async ({ debitNoteId }) => {
    const dn = await getDebitNote(debitNoteId);
    return { fileName: `debit-note-${dn.dnNumber}.pdf`, content: buildPdf(await commissionDebitNoteDoc(dn, dn.lines)) };
  },
  'policy-schedule': async ({ policyId }) => {
    const row = await getPolicyRow(String(policyId));
    const p = await printablePolicy(toPolicy(row), row);
    return { fileName: `policy-schedule-${p.policyNumber}.pdf`, content: buildPdf(await policyScheduleDoc(p)) };
  },
  'placement-slip': async ({ placementId, insurerId = null }) => {
    const { placementById } = await import('../placement/placements.js');
    const { placementSlipDoc } = await import('./templates.js');
    const p = await placementById(placementId);
    return { fileName: `placement-slip-${p.placementNumber}${insurerId ? `-${insurerId}` : ''}.pdf`, content: buildPdf(await placementSlipDoc(p, insurerId)) };
  },
  // distribution and product documents (motor programmes, comparison reports)
  'bank-endorsement-letter': async ({ saleId }) => {
    const { bankLetterSpec } = await import('../motor-programmes/letters.js');
    const spec = await bankLetterSpec(saleId);
    return { fileName: `bank-letter-${spec.number || saleId}.pdf`, content: buildPdf(spec) };
  },
  'endorsement': async ({ endorsementId }) => {
    const { getEndorsementRow, toEndorsement } = await import('../endorsements/service.js');
    const { endorsementDoc } = await import('./templates.js');
    const row = await getEndorsementRow(endorsementId);
    const e = toEndorsement(row);
    return { fileName: `endorsement-${e.endorsementNumber}.pdf`, content: buildPdf(await endorsementDoc(e, row)) };
  },
  'quotation-slip': async ({ quoteId }) => {
    const { quoteById } = await import('../quotations/service.js');
    const { quoteDoc } = await import('./templates.js');
    const q = await quoteById(String(quoteId));
    return { fileName: `quotation-${q.quotationNumber}.pdf`, content: buildPdf(await quoteDoc(q)) };
  },
  'remittance-schedule': async ({ remittanceId }) => {
    // the insurer's copy of the remittance schedule (FR-RMT-015): never the variance share or the referrer
    const { scheduleXlsx } = await import('../remittance/documents.js');
    const { buffer, fileName } = await scheduleXlsx(remittanceId, { id: null, username: 'system', roles: [], permissions: [] });
    return { fileName, content: buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  },
  'comparison-report': async ({ reportId }) => {
    const { comparisonReportSpec } = await import('../comparison-reports/service.js');
    const spec = await comparisonReportSpec(reportId);
    return { fileName: `comparison-report-${spec.number}.pdf`, content: buildPdf(spec) };
  },
  // open covers (marine/files.js, marine/documents.js) and Credit Life (credit-life/certificates.js)
  'parcel-certificate': async ({ certificateId }) => {
    const { certificatePdf } = await import('../marine/documents.js');
    const { pdf, row } = await certificatePdf(certificateId, { protect: true });
    return { fileName: `parcel-certificate-${row.certificate_number}.pdf`, content: pdf };
  },
  'marine-declaration-file': async ({ declarationId }) => {
    const { latestFile } = await import('../marine/files.js');
    return latestFile(declarationId);
  },
  'marine-declaration-summary': async ({ declarationId }) => {
    const { declarationSummarySpec } = await import('../marine/files.js');
    const { formatters } = await import('./templates.js');
    const { printContext } = await import('./pdf.js');
    const ctx = await printContext({ user: null });
    const spec = await declarationSummarySpec(declarationId, formatters(ctx));
    return { fileName: `declaration-summary-${spec.number}.pdf`, content: buildPdf({ ...ctx, ...spec }) };
  },
  'parcel-certificate-register': async ({ declarationId }) => {
    const { certificateRegister } = await import('../marine/files.js');
    return certificateRegister({ declarationId });
  },
  'credit-life-certificate': async ({ memberId }) => {
    const { certificatePdf } = await import('../credit-life/certificates.js');
    const { pdf, row } = await certificatePdf(memberId, { protect: true });
    return { fileName: `credit-life-certificate-${row.certificate_number}.pdf`, content: pdf };
  },
  'credit-life-soa': async ({ batchId }) => {
    const { batchSoaPdf } = await import('../credit-life/certificates.js');
    const { pdf, number } = await batchSoaPdf(batchId);
    return { fileName: `credit-life-soa-${number}.pdf`, content: pdf };
  },
  'credit-life-batch-list': async ({ batchId }) => {
    const { batchList } = await import('../credit-life/certificates.js');
    const { fileName, content, contentType } = await batchList(batchId);
    return { fileName, content, contentType };
  },
};

export const DOCUMENT_GENERATORS = Object.freeze(Object.keys(GENERATORS));

/** Build one document: { fileName, contentType, content (Buffer) }. */
export async function generateDocument(id, params = {}) {
  const g = GENERATORS[id];
  if (!g) throw new Error(`Unknown document ${id}`);
  const out = await g(params || {});
  return { contentType: PDF, ...out };
}
