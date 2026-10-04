/**
 * Minimal, dependency-free .xlsx (Office Open XML SpreadsheetML) writer.
 * Supports several sheets, a styled + frozen header row, autofilter, column widths and typed cells
 * (text, number, money, integer, date, wrap).
 */
import { createZip } from './zip.js';
import { protectExportRows } from './piiPolicy.js';

const MAX_CELL = 32767;
// Style indexes in styles.xml cellXfs
const STYLE = { text: 0, header: 1, money: 2, date: 3, wrap: 4, integer: 5, number: 6, percent: 6, headerRequired: 7, headerNavy: 8, sample: 9, bold: 10, textCell: 11,
  added: 12, missing: 13, changed: 14, good: 15, bad: 16 };
/**
 * Row and cell styles (sheet.rowStyles, sheet.cellStyle): sample = italic on a light amber fill (sample rows of a
 * workbook template); bold = a heading line; added = green fill, missing = amber fill, changed = light red fill in bold
 * (comparison workbooks); good / bad = bold green / red text on a light fill (verdicts).
 */
const NUMBER_STYLES = new Set([STYLE.added, STYLE.missing, STYLE.changed, STYLE.good, STYLE.bad]);
const ROW_STYLE = { sample: STYLE.sample, bold: STYLE.bold, added: STYLE.added, missing: STYLE.missing, changed: STYLE.changed, good: STYLE.good, bad: STYLE.bad };

export const colLetter = (i) => {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
export const xmlEscape = (v) => String(v).replace(INVALID_XML, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
function excelDate(v) {
  const s = v instanceof Date ? v.toISOString() : String(v);
  const m = DATE_RE.exec(s);
  if (!m) return null;
  return (Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(1899, 11, 30)) / 86400000;
}

const safeSheetName = (name, used) => {
  const base = String(name || 'Sheet').replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
  let n = 2;
  let out = base;
  while (used.has(out.toLowerCase())) { out = `${base.slice(0, 28)} ${n}`; n += 1; }
  used.add(out.toLowerCase());
  return out;
};

class SharedStrings {
  constructor() { this.map = new Map(); this.list = []; this.count = 0; }
  idx(s) {
    this.count += 1;
    if (!this.map.has(s)) { this.map.set(s, this.list.length); this.list.push(s); }
    return this.map.get(s);
  }
  xml() {
    // a literal _xHHHH_ in the text is escaped as Excel does (_x005F_ = underscore), so readers do not decode it
    const items = this.list.map((s) => `<si><t xml:space="preserve">${xmlEscape(s).replace(/_(x[0-9A-Fa-f]{4}_)/g, '_x005F_$1')}</t></si>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.count}" uniqueCount="${this.list.length}">${items}</sst>`;
  }
}

function cellXml(ref, value, type, sst, rowStyle = null) {
  if (rowStyle !== null) {
    if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${rowStyle}"/>`;
    // a number in a comparison colour stays a number (the template styles keep everything as text)
    if (typeof value === 'number' && Number.isFinite(value) && NUMBER_STYLES.has(rowStyle)) return `<c r="${ref}" s="${rowStyle}"><v>${value}</v></c>`;
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `<c r="${ref}" s="${rowStyle}" t="s"><v>${sst.idx(text.slice(0, MAX_CELL))}</v></c>`;
  }
  if (value === null || value === undefined || value === '') return '';
  // 'auto': a JavaScript number stays a number, anything else is text
  if (type === 'auto' && typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  const numeric = ['money', 'integer', 'number', 'percent'].includes(type);
  if (numeric && Number.isFinite(Number(value))) return `<c r="${ref}" s="${STYLE[type]}"><v>${Number(value)}</v></c>`;
  if (type === 'date') {
    const d = excelDate(value);
    if (d !== null) return `<c r="${ref}" s="${STYLE.date}"><v>${d}</v></c>`;
  }
  let text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  if (text.length > MAX_CELL) text = `${text.slice(0, MAX_CELL - 3)}...`;
  const style = type === 'wrap' || typeof value === 'object' ? STYLE.wrap : STYLE.text;
  return `<c r="${ref}" s="${style}" t="s"><v>${sst.idx(text)}</v></c>`;
}

function sheetXml(sheet, sst) {
  const cols = sheet.columns;
  const rows = sheet.rows.map((r) => (Array.isArray(r) ? r : cols.map((c) => r[c.key])));
  const lastCol = colLetter(Math.max(cols.length - 1, 0));
  const lastRow = rows.length + 1;
  const headerStyle = (c) => (sheet.headerStyle === 'navy' ? STYLE.headerNavy : c.required ? STYLE.headerRequired : STYLE.header);
  const header = `<row r="1" spans="1:${cols.length}" ht="20" customHeight="1">${cols.map((c, i) => `<c r="${colLetter(i)}1" s="${headerStyle(c)}" t="s"><v>${sst.idx(String(c.header ?? c.label ?? c.key ?? ''))}</v></c>`).join('')}</row>`;
  const rowStyleOf = (ri) => ROW_STYLE[sheet.rowStyles?.[ri]] ?? null;
  // cellStyle(row index, column index): style name of one cell (overrides the row style)
  const cellStyleOf = (ri, ci) => (sheet.cellStyle ? ROW_STYLE[sheet.cellStyle(ri, ci)] ?? null : null);
  const body = rows.map((r, ri) => {
    const rs = rowStyleOf(ri) ?? (sheet.textColumns ? STYLE.textCell : null);
    const styled = rs !== null || !!sheet.cellStyle;
    const cells = styled ? cols.map((_, ci) => r[ci]) : r;
    return `<row r="${ri + 2}">${cells.map((v, ci) => cellXml(`${colLetter(ci)}${ri + 2}`, v, cols[ci]?.type || 'text', sst, cellStyleOf(ri, ci) ?? rs)).join('')}</row>`;
  }).join('');
  // textColumns: every column is formatted as text (@), so Excel keeps codes such as 0012 and dates as typed
  const colStyle = sheet.textColumns ? ` style="${STYLE.textCell}"` : '';
  const widths = cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 15}"${colStyle} customWidth="1"/>`).join('');
  const freeze = sheet.freeze === false ? '<sheetView workbookViewId="0"/>'
    : '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>';
  const filter = sheet.autoFilter === false || !cols.length ? '' : `<autoFilter ref="A1:${lastCol}${lastRow}"/>`;
  // drop-down lists: [{ sqref: 'C2:C5000', formula: 'Lists!$A$2:$A$4' }]
  const dv = (sheet.validations || []).filter((v) => v.sqref && v.formula);
  const validations = dv.length ? `<dataValidations count="${dv.length}">${dv.map((v) => `<dataValidation type="list" allowBlank="1" showErrorMessage="${v.strict === false ? 0 : 1}" errorStyle="${v.strict === false ? 'information' : 'stop'}" sqref="${v.sqref}"><formula1>${xmlEscape(v.formula)}</formula1></dataValidation>`).join('')}</dataValidations>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastCol}${lastRow}"/><sheetViews>${freeze}</sheetViews><sheetFormatPr defaultRowHeight="15"/>${widths ? `<cols>${widths}</cols>` : ''}<sheetData>${header}${body}</sheetData>${filter}${validations}<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
<fonts count="6"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font><font><i/><sz val="11"/><color rgb="FF595959"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF0B2A4A"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF9C0006"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF006100"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF9C2A00"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B2A4A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEB9C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="49" fontId="2" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="5" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Build an .xlsx workbook.
 * Column type: text (default), wrap, money, integer, number, percent, date, or auto (numbers numeric, the rest text).
 * A column with required: true gets a dark red header cell instead of the blue one (upload templates).
 * Sheet options: headerStyle 'navy' (navy header for every column), rowStyles (array by data row: 'sample' | 'bold' |
 * 'added' | 'missing' | 'changed' | 'good' | 'bad'), cellStyle ((row index, column index) => one of those names, or null),
 * validations ([{ sqref, formula, strict }]: drop-down lists).
 * @param {{sheets: {name: string, columns: {key?: string, header?: string, label?: string, width?: number, type?: string, required?: boolean}[], rows: (Array|Object)[], freeze?: boolean, autoFilter?: boolean}[], creator?: string, title?: string}} wb
 * @returns {Buffer}
 */
export function writeXlsx({ sheets, creator = 'BrokerVerse', title = '' }) {
  const sst = new SharedStrings();
  const used = new Set();
  // personal identifiers: decrypted, and masked for a user without view:pii (lib/piiPolicy.js)
  const named = sheets.map((s) => ({ ...s, rows: protectExportRows(s.columns || [], s.rows || []), name: safeSheetName(s.name, used) }));
  const sheetFiles = named.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s, sst) }));
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const definedNames = named.map((s, i) => (s.autoFilter === false || !s.columns.length ? ''
    : `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlEscape(s.name.replace(/'/g, "''"))}'!$A$1:$${colLetter(s.columns.length - 1)}$${s.rows.length + 1}</definedName>`)).join('');
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>${xmlEscape(creator)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>BrokerVerse</Application></Properties>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${named.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${definedNames ? `<definedNames>${definedNames}</definedNames>` : ''}</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${named.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: STYLES_XML },
    ...sheetFiles,
  ];
  files.push({ name: 'xl/sharedStrings.xml', data: sst.xml() });
  return createZip(files);
}
