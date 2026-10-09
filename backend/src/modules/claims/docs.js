/**
 * Spreadsheet downloads of the claims and renewals modules (CSV or XLSX) and their template rendering. PDFs are made
 * by the shared engine in lib/pdf.
 */
import { csvCell } from '../../lib/csv.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { getSetting } from '../../lib/settings.js';
import { DEFAULT_FORMAT } from '../../lib/pdf/format.js';

export { renderTemplate } from '../../lib/template.js';

// ---------- CSV ----------
export const toCsv = (columns, rows) => [columns.map((c) => csvCell(c.header)).join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','))].join('\n');

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Send a workbook (dates in general.date_format) or, with format=csv, a CSV as a download. */
export async function sendSheet(res, { fileName, sheets, format = 'excel' }) {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    return res.send(toCsv(sheets[0].columns, sheets[0].rows));
  }
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
  const dateFormat = (await getSetting('general.date_format', DEFAULT_FORMAT.dateFormat)) || DEFAULT_FORMAT.dateFormat;
  return res.send(writeXlsx({ sheets: sheets.map((sh) => ({ ...sh, columns: sh.columns.map((c) => ({ type: 'auto', ...c })) })), dateFormat }));
}
