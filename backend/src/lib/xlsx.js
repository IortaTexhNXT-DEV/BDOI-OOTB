/**
 * Minimal, dependency-free .xlsx (Office Open XML SpreadsheetML) writer.
 * Supports several sheets, a styled + frozen header row, autofilter, column widths and typed cells
 * (text, number, money, integer, date, wrap), and the broker branding of report files: the header row colours of the
 * theme and, optionally, the logo and a banner (company, registration line, title) above the first sheet's table.
 */
import { createZip } from './zip.js';
import { protectExportRows } from './piiPolicy.js';
import { DEFAULT_FORMAT } from './pdf/format.js';

const MAX_CELL = 32767;
// Style indexes in styles.xml cellXfs
const STYLE = { text: 0, header: 1, money: 2, date: 3, wrap: 4, integer: 5, number: 6, percent: 6, headerRequired: 7, headerNavy: 8, sample: 9, bold: 10, textCell: 11,
  added: 12, missing: 13, changed: 14, good: 15, bad: 16, bannerTitle: 17, banner: 18 };
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
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^-?\d+\.\d{1,4}$/;

/** Excel number format of a date pattern of general.date_format ("DD/MM/YYYY" -> "dd/mm/yyyy", "DD MMM YYYY" -> "dd mmm yyyy"). */
export const excelDateFormat = (pattern = DEFAULT_FORMAT.dateFormat) => String(pattern || DEFAULT_FORMAT.dateFormat)
  .replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D/g, (t) => t.toLowerCase());
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
  // 'auto': a whole number stays a number, a decimal (a number, or text such as a database amount "12525.00") is an amount
  // with thousands separators, a yyyy-mm-dd date is a date cell, anything else is text
  if (type === 'auto' && typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" s="${STYLE.money}"><v>${value}</v></c>`;
  const autoText = type === 'auto' && typeof value === 'string';
  const kind = autoText && ISO_DATE.test(value) ? 'date' : autoText && DECIMAL.test(value) ? 'money' : type;
  const numeric = ['money', 'integer', 'number', 'percent'].includes(kind);
  if (numeric && Number.isFinite(Number(value))) return `<c r="${ref}" s="${STYLE[kind]}"><v>${Number(value)}</v></c>`;
  if (kind === 'date') {
    const d = excelDate(value);
    if (d !== null) return `<c r="${ref}" s="${STYLE.date}"><v>${d}</v></c>`;
  }
  let text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  if (text.length > MAX_CELL) text = `${text.slice(0, MAX_CELL - 3)}...`;
  const style = kind === 'wrap' || typeof value === 'object' ? STYLE.wrap : STYLE.text;
  return `<c r="${ref}" s="${style}" t="s"><v>${sst.idx(text)}</v></c>`;
}

/** Rows above the table of a branded sheet: the logo row (when there is a logo), the banner lines, one blank row. */
export const bannerRows = (sheet) => (sheet.banner?.length || sheet.logo ? (sheet.logo ? 1 : 0) + (sheet.banner?.length || 0) + 1 : 0);

function sheetXml(sheet, sst) {
  const cols = sheet.columns;
  const rows = sheet.rows.map((r) => (Array.isArray(r) ? r : cols.map((c) => r[c.key])));
  const lastCol = colLetter(Math.max(cols.length - 1, 0));
  const top = bannerRows(sheet);
  const hr = top + 1; // header row number
  const lastRow = rows.length + hr;
  const headerStyle = (c) => (sheet.headerStyle === 'navy' ? STYLE.headerNavy : c.required ? STYLE.headerRequired : STYLE.header);
  const banner = [];
  if (top) {
    let r = 1;
    if (sheet.logo) { banner.push(`<row r="1" ht="${Math.round(sheet.logo.rowHeight)}" customHeight="1"/>`); r = 2; }
    for (const [i, line] of (sheet.banner || []).entries()) {
      banner.push(`<row r="${r}"${i === 0 ? ' ht="20" customHeight="1"' : ''}><c r="A${r}" s="${i === 0 ? STYLE.bannerTitle : STYLE.banner}" t="s"><v>${sst.idx(String(line).slice(0, MAX_CELL))}</v></c></row>`);
      r += 1;
    }
  }
  const header = `<row r="${hr}" spans="1:${cols.length}" ht="20" customHeight="1">${cols.map((c, i) => `<c r="${colLetter(i)}${hr}" s="${headerStyle(c)}" t="s"><v>${sst.idx(String(c.header ?? c.label ?? c.key ?? ''))}</v></c>`).join('')}</row>`;
  const rowStyleOf = (ri) => ROW_STYLE[sheet.rowStyles?.[ri]] ?? null;
  // cellStyle(row index, column index): style name of one cell (overrides the row style)
  const cellStyleOf = (ri, ci) => (sheet.cellStyle ? ROW_STYLE[sheet.cellStyle(ri, ci)] ?? null : null);
  const body = rows.map((r, ri) => {
    const rs = rowStyleOf(ri) ?? (sheet.textColumns ? STYLE.textCell : null);
    const styled = rs !== null || !!sheet.cellStyle;
    const cells = styled ? cols.map((_, ci) => r[ci]) : r;
    return `<row r="${ri + hr + 1}">${cells.map((v, ci) => cellXml(`${colLetter(ci)}${ri + hr + 1}`, v, cols[ci]?.type || 'text', sst, cellStyleOf(ri, ci) ?? rs)).join('')}</row>`;
  }).join('');
  // textColumns: every column is formatted as text (@), so Excel keeps codes such as 0012 and dates as typed
  const colStyle = sheet.textColumns ? ` style="${STYLE.textCell}"` : '';
  const widths = cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 15}"${colStyle} customWidth="1"/>`).join('');
  const freeze = sheet.freeze === false ? '<sheetView workbookViewId="0"/>'
    : `<sheetView workbookViewId="0"><pane ySplit="${hr}" topLeftCell="A${hr + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${hr + 1}" sqref="A${hr + 1}"/></sheetView>`;
  const filter = sheet.autoFilter === false || !cols.length ? '' : `<autoFilter ref="A${hr}:${lastCol}${lastRow}"/>`;
  // drop-down lists: [{ sqref: 'C2:C5000', formula: 'Lists!$A$2:$A$4' }]
  const dv = (sheet.validations || []).filter((v) => v.sqref && v.formula);
  const validations = dv.length ? `<dataValidations count="${dv.length}">${dv.map((v) => `<dataValidation type="list" allowBlank="1" showErrorMessage="${v.strict === false ? 0 : 1}" errorStyle="${v.strict === false ? 'information' : 'stop'}" sqref="${v.sqref}"><formula1>${xmlEscape(v.formula)}</formula1></dataValidation>`).join('')}</dataValidations>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastCol}${lastRow}"/><sheetViews>${freeze}</sheetViews><sheetFormatPr defaultRowHeight="15"/>${widths ? `<cols>${widths}</cols>` : ''}<sheetData>${banner.join('')}${header}${body}</sheetData>${filter}${validations}<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>${sheet.logo ? '<drawing r:id="rIdLogo"/>' : ''}</worksheet>`;
}

const argb = (hex, fallback) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  return `FF${(m ? m[1] : fallback).toUpperCase()}`;
};

/** Drawing part placing the logo at the top-left of a sheet (one-cell anchor, size in EMU). */
function drawingXml(logo) {
  const cx = Math.round(logo.widthPx * 9525);
  const cy = Math.round(logo.heightPx * 9525);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo" descr="Company logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}

const stylesXml = ({ headerBg = '#1f4e78', headerText = '#ffffff', titleColor = '#0b2a4a' } = {}, dateFormat = DEFAULT_FORMAT.dateFormat) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="${xmlEscape(excelDateFormat(dateFormat))}"/></numFmts>
<fonts count="9"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font><font><i/><sz val="11"/><color rgb="FF595959"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF0B2A4A"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF9C0006"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF006100"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="${argb(headerText, 'FFFFFF')}"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="14"/><color rgb="${argb(titleColor, '0B2A4A')}"/><name val="Calibri"/><family val="2"/></font><font><sz val="9"/><color rgb="FF5F6B76"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="${argb(headerBg, '1F4E78')}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF9C2A00"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B2A4A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEB9C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="19">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="6" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
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
<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Build an .xlsx workbook.
 * Column type: text (default), wrap, money, integer, number, percent, date, or auto (numbers numeric, the rest text).
 * A column with required: true gets a dark red header cell instead of the blue one (upload templates).
 * Sheet options: headerStyle 'navy' (navy header for every column), rowStyles (array by data row: 'sample' | 'bold' |
 * 'added' | 'missing' | 'changed' | 'good' | 'bad'), cellStyle ((row index, column index) => one of those names, or null),
 * validations ([{ sqref, formula, strict }]: drop-down lists), banner (lines above the table: company, registration,
 * title) and logo (true: the brand logo above the banner).
 * Branding (`brand`, modules/branding documentBranding().excel plus the logo): { headerBg, headerText, titleColor,
 * logoImage: { buffer, type: 'png' | 'jpeg', width, height } }.
 * Date cells are shown in dateFormat (the general.date_format pattern, e.g. DD/MM/YYYY).
 * @param {{sheets: {name: string, columns: {key?: string, header?: string, label?: string, width?: number, type?: string, required?: boolean}[], rows: (Array|Object)[], freeze?: boolean, autoFilter?: boolean, banner?: string[], logo?: boolean}[], creator?: string, title?: string, brand?: object, dateFormat?: string}} wb
 * @returns {Buffer}
 */
export function writeXlsx({ sheets, creator = 'BrokerVerse', title = '', brand = null, dateFormat = DEFAULT_FORMAT.dateFormat }) {
  const sst = new SharedStrings();
  const used = new Set();
  const img = brand?.logoImage && brand.logoImage.width && brand.logoImage.height ? brand.logoImage : null;
  // the logo is drawn 40 px high (row height in points = px * 0.75 + margin)
  const logoBox = img ? { heightPx: 40, widthPx: Math.round((40 * img.width) / img.height), rowHeight: 40 * 0.75 + 8 } : null;
  // personal identifiers: decrypted, and masked for a user without view:pii (lib/piiPolicy.js)
  const named = sheets.map((s) => ({ ...s, rows: protectExportRows(s.columns || [], s.rows || []), name: safeSheetName(s.name, used), logo: s.logo && logoBox ? logoBox : null }));
  const sheetFiles = named.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s, sst) }));
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const definedNames = named.map((s, i) => (s.autoFilter === false || !s.columns.length ? ''
    : `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlEscape(s.name.replace(/'/g, "''"))}'!$A$${bannerRows(s) + 1}:$${colLetter(s.columns.length - 1)}$${s.rows.length + bannerRows(s) + 1}</definedName>`)).join('');
  const logoSheets = named.map((s, i) => (s.logo ? i : -1)).filter((i) => i >= 0);
  const ext = img?.type === 'jpeg' ? 'jpeg' : 'png';
  const drawingParts = logoSheets.flatMap((i, n) => [
    { name: `xl/drawings/drawing${n + 1}.xml`, data: drawingXml(named[i].logo) },
    { name: `xl/drawings/_rels/drawing${n + 1}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.${ext}"/></Relationships>` },
    { name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n + 1}.xml"/></Relationships>` },
  ]);
  if (logoSheets.length) drawingParts.push({ name: `xl/media/logo.${ext}`, data: img.buffer });
  const drawingTypes = logoSheets.length ? `<Default Extension="${ext}" ContentType="image/${ext}"/>${logoSheets.map((_, n) => `<Override PartName="/xl/drawings/drawing${n + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('')}` : '';
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${drawingTypes}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>${xmlEscape(creator)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>BrokerVerse</Application></Properties>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${named.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${definedNames ? `<definedNames>${definedNames}</definedNames>` : ''}</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${named.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: stylesXml(brand || {}, dateFormat) },
    ...sheetFiles,
    ...drawingParts,
  ];
  files.push({ name: 'xl/sharedStrings.xml', data: sst.xml() });
  return createZip(files);
}
