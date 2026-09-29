/**
 * Document PDFs: the shared engine in lib/pdf (letterhead from the Company master, footer, tables that never truncate
 * numbers). Kept as the import path of the document templates: buildPdf(spec) and sendPdf(res, buffer, fileName).
 * Specs built with templates.js#header() already carry the letterhead and the generated-by line.
 */
export { buildPdf, buildPdfBatch, renderPdf, renderPdfBatch, sendPdf, printContext } from '../../lib/pdf/index.js';
