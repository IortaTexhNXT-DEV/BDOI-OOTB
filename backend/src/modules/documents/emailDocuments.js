/**
 * Documents attached to e-mails (lib/mailer.js documentAttachment): each generator builds the PDF of one record when
 * the message is sent, from the same templates as the print buttons, so the outbox keeps only a reference.
 *
 *   official-receipt       { receiptId }     official receipt (Accounts > Receipts > Print)
 *   premium-invoice        { receivableId }  premium invoice / statement of account of one bill
 *   commission-debit-note  { debitNoteId }   commission debit note to the insurer (direct bill)
 *   policy-schedule        { policyId }      policy schedule
 *   bank-endorsement-letter { saleId }       letter to the financing bank of a dealer sale (motor programmes)
 *   comparison-report      { reportId }      client comparison and recommendation report
 *   fac-slip               { placementId, kind, shareId }  facultative slip, cover note, debit or credit note
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
  // distribution and product documents (motor programmes, comparison reports, facultative reinsurance, marine)
  'bank-endorsement-letter': async ({ saleId }) => {
    const { bankLetterSpec } = await import('../motor-programmes/letters.js');
    const spec = await bankLetterSpec(saleId);
    return { fileName: `bank-letter-${spec.number || saleId}.pdf`, content: buildPdf(spec) };
  },
  'comparison-report': async ({ reportId }) => {
    const { comparisonReportSpec } = await import('../comparison-reports/service.js');
    const spec = await comparisonReportSpec(reportId);
    return { fileName: `comparison-report-${spec.number}.pdf`, content: buildPdf(spec) };
  },
  'fac-slip': async ({ placementId, kind = 'slip', shareId = null }) => {
    const { facDocumentSpec } = await import('../reinsurance/facultativeDocs.js');
    const spec = await facDocumentSpec(placementId, kind, shareId);
    return { fileName: `${kind}-${spec.number}.pdf`, content: buildPdf(spec) };
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
