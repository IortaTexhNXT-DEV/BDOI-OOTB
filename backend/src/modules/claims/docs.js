/**
 * Spreadsheet downloads of the claims and renewals modules (CSV or XLSX) and their template rendering. PDFs are made
 * by the shared engine in lib/pdf.
 */
import { csvCell } from '../../lib/csv.js';
import { writeXlsx } from '../../lib/xlsx.js';

export { renderTemplate } from '../../lib/template.js';

// ---------- CSV ----------
export const toCsv = (columns, rows) => [columns.map((c) => csvCell(c.header)).join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','))].join('\n');

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Send a workbook (or CSV when format=csv) as a download. */
export function sendSheet(res, { fileName, sheets, format = 'excel' }) {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    return res.send(toCsv(sheets[0].columns, sheets[0].rows));
  }
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
  return res.send(writeXlsx({ sheets: sheets.map((sh) => ({ ...sh, columns: sh.columns.map((c) => ({ type: 'auto', ...c })) })) }));
}
