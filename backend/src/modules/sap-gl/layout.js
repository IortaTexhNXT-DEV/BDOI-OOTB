/**
 * SAP GL file layout (setting sap_gl.layout): renders the header and line records of a day's documents. Pure functions,
 * so the layout can be checked without a database.
 *
 * layout = { format: 'delimited' | 'fixed', delimiter, lineEnding: 'CRLF' | 'LF', fieldNames, encoding, dateFormat,
 *   amountDecimals, debitKey, creditKey, header: { fileName, text, fields }, line: { fileName, fields } }
 * field = { name, source } or { name, value } (a constant), with optional width (fixed format: padded or cut to it),
 *   align ('left' | 'right'), pad (one character), maxLength (text cut to it in any format) and format (dates).
 * Header sources: docNo, documentDate, postingDate, headerText, currency, exportDate.
 * Line sources: docNo, postingKey, glCode, accountName, amount, debit, credit, text, costCentre, valueDate, postingDate,
 *   assignment, clientCode, insurerCode, journalNumber, journalLine, sourceDocument, currency.
 * Templates (file names, header text): {date:FORMAT} the export date, {postingDate:FORMAT}, {docNo:00} zero-padded to the
 * width of the zeros, {runNo}. Date formats: YYYY, YY, MM, MMM (Jan), DD.
 */
export const HEADER_SOURCES = ['docNo', 'documentDate', 'postingDate', 'headerText', 'currency', 'exportDate'];
export const LINE_SOURCES = ['docNo', 'postingKey', 'glCode', 'accountName', 'amount', 'debit', 'credit', 'text', 'costCentre', 'valueDate', 'postingDate',
  'assignment', 'clientCode', 'insurerCode', 'journalNumber', 'journalLine', 'sourceDocument', 'currency'];
const DATE_SOURCES = new Set(['documentDate', 'postingDate', 'valueDate', 'exportDate']);
const AMOUNT_SOURCES = new Set(['amount', 'debit', 'credit']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD formatted with YYYY, YY, MM, MMM and DD. */
export function formatDate(iso, fmt = 'YYYY-MM-DD') {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return String(fmt).replace(/YYYY|YY|MMM|MM|DD/g, (t) => ({ YYYY: y, YY: y.slice(2), MMM: MONTHS[Number(m) - 1], MM: m, DD: d }[t]));
}

/** Fill a template: {date:FMT}, {postingDate:FMT}, {docNo:00}, {runNo}. */
export function fillTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)(?::([^}]*))?\}/g, (_m, key, arg) => {
    const v = vars[key];
    if (v === undefined || v === null) return '';
    if (key === 'date' || key === 'postingDate') return formatDate(v, arg || 'YYYYMMDD');
    if (arg && /^0+$/.test(arg)) return String(v).padStart(arg.length, '0');
    return String(v);
  });
}

/** Layout problems (unknown sources, missing names, bad format), as a list of messages; empty when the layout is usable. */
export function checkLayout(layout) {
  const errors = [];
  if (!layout || typeof layout !== 'object') return ['sap_gl.layout must be an object'];
  if (!['delimited', 'fixed'].includes(layout.format)) errors.push('format must be delimited or fixed');
  if (layout.format === 'delimited' && !String(layout.delimiter ?? '')) errors.push('a delimited layout needs a delimiter');
  for (const [part, sources] of [['header', HEADER_SOURCES], ['line', LINE_SOURCES]]) {
    const p = layout[part];
    if (!p?.fileName) errors.push(`${part}.fileName is required`);
    if (!Array.isArray(p?.fields) || !p.fields.length) { errors.push(`${part}.fields must list the fields`); continue; }
    p.fields.forEach((f, i) => {
      if (!f?.name) errors.push(`${part}.fields[${i}] needs a name`);
      if (f?.source !== undefined && !sources.includes(f.source)) errors.push(`${part}.fields[${i}] (${f.name}): unknown source ${f.source}`);
      if (f?.source === undefined && f?.value === undefined) errors.push(`${part}.fields[${i}] (${f?.name}): give a source or a value`);
      if (layout.format === 'fixed' && !(Number(f?.width) > 0)) errors.push(`${part}.fields[${i}] (${f?.name}): a fixed layout needs a width`);
    });
  }
  return errors;
}

/** Text of a value in a record: dates formatted, amounts with their decimals, separators and line breaks removed. */
function cell(layout, field, raw) {
  let v;
  if (field.source === undefined) v = String(field.value ?? '');
  else if (DATE_SOURCES.has(field.source)) v = formatDate(raw, field.format || layout.dateFormat);
  else if (AMOUNT_SOURCES.has(field.source)) v = Number(raw || 0).toFixed(Number.isInteger(layout.amountDecimals) ? layout.amountDecimals : 2);
  else v = String(raw ?? '');
  v = v.replace(/[\r\n]+/g, ' ');
  if (layout.format === 'delimited' && layout.delimiter) v = v.split(layout.delimiter).join(' ');
  if (Number(field.maxLength) > 0) v = v.slice(0, Number(field.maxLength));
  if (layout.format === 'fixed') {
    const width = Number(field.width);
    const pad = String(field.pad ?? ' ').charAt(0) || ' ';
    v = v.slice(0, width);
    v = field.align === 'right' ? v.padStart(width, pad) : v.padEnd(width, pad);
  }
  return v;
}

const record = (layout, fields, values) => fields.map((f) => cell(layout, f, values[f.source])).join(layout.format === 'fixed' ? '' : layout.delimiter);
const nameRow = (layout, fields) => record(layout, fields.map((f) => ({ ...f, source: undefined, value: f.name })), {});

/**
 * Render the files of a run. docs = [{ docNo, postingDate, currency, lines: [{ debit, credit, glCode, ... }] }].
 * Returns { header: { fileName, content, records }, line: { fileName, content, records } }.
 */
export function renderFiles(layout, { exportDate, runNo, docs }) {
  const eol = layout.lineEnding === 'LF' ? '\n' : '\r\n';
  const vars = { date: exportDate, runNo };
  const headers = docs.map((d) => record(layout, layout.header.fields, {
    docNo: d.docNo, documentDate: d.postingDate, postingDate: d.postingDate, currency: d.currency, exportDate,
    headerText: fillTemplate(layout.header.text, { ...vars, postingDate: d.postingDate, docNo: d.docNo }),
  }));
  const lines = docs.flatMap((d) => d.lines.map((l) => record(layout, layout.line.fields, {
    ...l, docNo: d.docNo, postingDate: d.postingDate, currency: d.currency,
    postingKey: l.debit > 0 ? layout.debitKey : layout.creditKey, amount: l.debit > 0 ? l.debit : l.credit,
  })));
  const file = (part, rows) => {
    const all = layout.fieldNames ? [nameRow(layout, layout[part].fields), ...rows] : rows;
    return { fileName: fillTemplate(layout[part].fileName, vars), content: all.length ? `${all.join(eol)}${eol}` : '', records: rows.length };
  };
  return { header: file('header', headers), line: file('line', lines) };
}
