/**
 * Environment comparison of the configuration workbook: the comparison engine, without the database, so the API
 * (compare an uploaded export with this environment, or two uploaded exports with each other) and the release
 * pipeline script (scripts/compare-environments.js, two running APIs) share it.
 *
 * The two sides are called "file" and "here": the uploaded workbook and this environment (or file A and file B).
 * Rows are matched on the natural key of their sheet (the keys the workbench loads with); every column of the kit is
 * compared in its comparable form (dates, numbers, Yes / No and lists normalised, common.js). A row is identical,
 * different (with the field-level differences), only in the file (would be new here) or only here (missing from the
 * file). Fields that legitimately differ between environments (ENVIRONMENT_SPECIFIC) are reported apart and never make
 * the environments differ.
 *
 * Catalogue: the plain description of the kit's sheets (catalogueOf, also GET /data-load/kits):
 *   [{ key, name, keyColumns, keyDefaults, columns: [{ key, header, type, list }] }]
 */
import { readWorkbook } from '../documents/xlsx.js';
import { normKey } from '../documents/tabular.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { badRequest } from '../../lib/errors.js';
import { SAMPLE_PREFIX, cellString, cleanValue, comparable, keyText } from './common.js';

export const STATUSES = ['different', 'only-in-file', 'only-here', 'identical'];

const URL_TOKENS = new Set(['url', 'urls', 'uri', 'host', 'hosts', 'hostname', 'domain', 'domains', 'endpoint', 'endpoints', 'callback', 'webhook', 'origin', 'origins']);
const tokens = (key) => String(key || '').toLowerCase().split(/[._]/);

/**
 * Fields that legitimately differ between environments (Dev, SIT, UAT, Pre-Prod, Production): reported in the
 * environment-specific section, never as a difference. A rule matches a setting (Settings sheet, on its key: the Value
 * column, or the whole row when it is on one side only) or a column (sheet '*' = every sheet). optional: the rule
 * is switched off by that comparison option (the numbering counters are compared with includeNumbering).
 */
export const ENVIRONMENT_SPECIFIC = [
  { id: 'cutover-date', sheet: 'settings', label: 'Cutover date (golive.cutover_date)',
    reason: 'Each environment has its own cutover date: rehearsals use their own, Production the real one', setting: (k) => k === 'golive.cutover_date' },
  { id: 'urls-hosts', sheet: 'settings', label: 'Settings holding a URL or host (e.g. general.frontend_url)',
    reason: 'Every environment has its own addresses', setting: (k) => tokens(k).some((t) => URL_TOKENS.has(t)) },
  { id: 'email-sender', sheet: 'settings', label: 'E-mail sender settings (e.g. notification.from_address)',
    reason: 'Non-production environments send from their own address so that test mail is recognised',
    setting: (k) => /(^|\.)(from_address|from_name|from_email|reply_to|mail_from|sender[a-z_]*|smtp[a-z_]*)$/.test(k) || /^(smtp|mail|mailer)\./.test(k) },
  { id: 'payment-gateway-mode', sheet: 'settings', label: 'Payment gateway modes (sandbox / live)',
    reason: 'Gateways run in sandbox mode outside Production (the gateways and their credentials are kept on Master > Finance > Payment Gateways, not in the workbook)',
    setting: (k) => /^payments?\.gateway/.test(k) || tokens(k).some((t) => t === 'sandbox' || t === 'live_mode' || t === 'test_mode') || /gateway[a-z_]*\.mode$|gateway_mode$/.test(k) },
  { id: 'environment-name', sheet: 'settings', label: 'Settings naming the environment (e.g. general.environment)',
    reason: 'Names the environment itself', setting: (k) => tokens(k).some((t) => t === 'environment' || t === 'env') },
  { id: 'setting-description', sheet: 'settings', column: 'description', label: 'Settings: Description column',
    reason: 'Reference text of the workbook, never loaded' },
  { id: 'numbering-counters', sheet: 'numbering', column: 'nextNumber', optional: 'includeNumbering', label: 'Numbering: Next Number',
    reason: 'Counters move with the business of each environment; switch on "Include numbering counters" to compare them' },
  { id: 'address-columns', sheet: '*', columnPattern: /(url|uri|hostname|host|endpoint|webhook|callback)$/i, label: 'Columns holding a URL or host (any sheet)',
    reason: 'Every environment has its own addresses' },
];

/** The rules as shown to the user (without the matching functions), with whether they apply to this comparison. */
export const environmentRules = (options = {}) => ENVIRONMENT_SPECIFIC.map((r) => ({ id: r.id, sheet: r.sheet, label: r.label, reason: r.reason,
  applied: !(r.optional && options[r.optional]) }));

const activeRules = (options) => ENVIRONMENT_SPECIFIC.filter((r) => !(r.optional && options[r.optional]));
const forSheet = (rules, sheet) => rules.filter((r) => r.sheet === sheet || r.sheet === '*');
/** Rule that makes a whole row environment-specific (a setting), or null. */
const rowRule = (rules, sheet, values) => (sheet === 'settings' ? forSheet(rules, sheet).find((r) => r.setting && r.setting(String(values.key || '').trim().toLowerCase())) || null : null);
/** Rule that makes one column of a row environment-specific, or null. */
function columnRule(rules, sheet, values, column) {
  for (const r of forSheet(rules, sheet)) {
    if (r.column && r.column === column) return r;
    if (r.columnPattern && r.columnPattern.test(column)) return r;
    if (r.setting && column === 'value' && r.setting(String(values.key || '').trim().toLowerCase())) return r;
  }
  return null;
}

/** Plain description of a kit's sheets (no functions): what the engine and the pipeline script need. */
export function catalogueOf(sheets) {
  return sheets.map((s) => ({ key: s.key, name: s.name, keyColumns: s.keyColumns, keyDefaults: s.keyDefaults || {},
    columns: s.columns.map((c) => ({ key: c.key, header: c.header, type: c.type || 'text', ...(c.list ? { list: c.list } : {}) })) }));
}

/**
 * Read the object sheets of a kit workbook: { [sheet key]: { columns: [column keys found in the header], rows:
 * [{ rowNumber, values }] } } for the sheets found (by name). Empty and sample rows are skipped; unknown sheets and
 * columns are ignored. Throws when none of the kit's sheets is in the workbook.
 */
export function readSheets(buffer, sheets, { label = 'The workbook' } = {}) {
  let book;
  try {
    book = readWorkbook(buffer);
  } catch (e) {
    throw badRequest(`Could not read ${label === 'The workbook' ? 'the workbook' : label}: ${e.message}`);
  }
  const byName = new Map(book.map((s) => [s.name.trim().toLowerCase(), s]));
  const out = {};
  for (const sheet of sheets) {
    const ws = [sheet.name, ...(sheet.aliases || [])].map((n) => byName.get(n.toLowerCase())).find(Boolean);
    if (!ws) continue;
    const header = (ws.rows[0] || []).map((h) => normKey(h));
    const lookup = new Map();
    for (const c of sheet.columns) for (const name of [c.header, c.key, ...(c.aliases || [])]) if (!lookup.has(normKey(name))) lookup.set(normKey(name), c);
    const index = header.map((h) => lookup.get(h) || null);
    const rows = [];
    ws.rows.slice(1).forEach((cells, i) => {
      if (!cells.some((x) => String(x ?? '').trim() !== '')) return;
      if (String(cells[0] ?? '').trim().toUpperCase().startsWith(SAMPLE_PREFIX)) return;
      const values = {};
      index.forEach((c, ci) => {
        if (!c) return;
        const v = cleanValue(c, cells[ci]);
        if (v !== '' && values[c.key] === undefined) values[c.key] = v;
      });
      rows.push({ rowNumber: i + 2, values });
    });
    out[sheet.key] = { columns: [...new Set(index.filter(Boolean).map((c) => c.key))], rows };
  }
  if (!Object.keys(out).length) throw badRequest(`${label} has none of the sheets of this kit (${sheets.map((s) => s.name).join(', ')})`);
  return out;
}

/** Natural key of a row: the key columns in comparable form (keyDefaults for an empty key column, e.g. policy type any). */
function keyOf(sheet, values) {
  return keyText(...sheet.keyColumns.map((k) => {
    const col = sheet.columns.find((c) => c.key === k) || { key: k };
    const v = values[k] === undefined || values[k] === '' ? sheet.keyDefaults?.[k] ?? '' : values[k];
    return comparable(col, v);
  }));
}
/** Key as shown: the key columns joined with " / " ("-" for an empty one, e.g. a commission rate of every line). */
const keyLabel = (sheet, values) => {
  const parts = sheet.keyColumns.map((k) => cellString(values[k]) || sheet.keyDefaults?.[k] || '');
  return parts.some(Boolean) ? parts.map((p) => p || '-').join(' / ') : '(no key)';
};

const text = (v) => cellString(v);
const pick = (values, columns) => Object.fromEntries(columns.filter((c) => text(values[c.key]) !== '').map((c) => [c.key, text(values[c.key])]));

/**
 * Compare two sides of the configuration workbook.
 *   file, here: { [sheet key]: { columns?: [keys] (null or absent = every column), rows: [{ rowNumber?, values }] } };
 *               a sheet absent from a side has no rows on that side (noted on the sheet)
 *   options:    { includeNumbering }
 * Returns { verdict: 'mirrored' | 'differences', totals, sheets: [summary], rows: [row], environmentSpecific: [entry] }
 *   row:   { sheet, sheetName, key, status, rowFile, rowHere, values (identical rows), file, here (values by column key),
 *            differences: [{ column, header, file, here }] }
 *   entry: { sheet, sheetName, key, column, header, file, here, rule, reason } (column null: the row is on one side only)
 */
export function compareSides({ catalogue, file, here, options = {} }) {
  const rules = activeRules(options);
  const sheets = [];
  const rows = [];
  const environmentSpecific = [];
  for (const sheet of catalogue) {
    const a = file[sheet.key];
    const b = here[sheet.key];
    if (!a && !b) continue;
    const notes = [];
    if (!a) notes.push('sheet not in the file');
    if (!b) notes.push('sheet not on the other side');
    const has = (side, k) => !side || !side.columns || side.columns.includes(k);
    const columns = sheet.columns.filter((c) => has(a, c.key) && has(b, c.key));
    const skipped = sheet.columns.filter((c) => !columns.includes(c));
    if (a && b && skipped.length) notes.push(`not compared (column missing from one side): ${skipped.map((c) => c.header).join(', ')}`);
    const sum = { sheet: sheet.key, name: sheet.name, inFile: a?.rows.length || 0, here: b?.rows.length || 0, identical: 0, different: 0, onlyInFile: 0, onlyHere: 0,
      environmentSpecific: 0, notes };
    sheets.push(sum);
    const group = (side) => {
      const m = new Map();
      for (const r of side?.rows || []) {
        const k = keyOf(sheet, r.values);
        m.set(k, [...(m.get(k) || []), r]);
      }
      return m;
    };
    const ga = group(a);
    const gb = group(b);
    const envEntry = (key, column, va, vb, rule) => {
      const c = column ? sheet.columns.find((x) => x.key === column) : null;
      environmentSpecific.push({ sheet: sheet.key, sheetName: sheet.name, key, column, header: c ? c.header : null,
        file: va === undefined ? null : va, here: vb === undefined ? null : vb, rule: rule.id, reason: rule.reason });
    };
    const keys = [...new Set([...ga.keys(), ...gb.keys()])];
    for (const k of keys) {
      const la = ga.get(k) || [];
      const lb = gb.get(k) || [];
      for (let i = 0; i < Math.max(la.length, lb.length); i += 1) {
        const ra = la[i];
        const rb = lb[i];
        const base = ra || rb;
        const key = keyLabel(sheet, base.values);
        const entry = { sheet: sheet.key, sheetName: sheet.name, key, rowFile: ra?.rowNumber ?? null, rowHere: rb?.rowNumber ?? null };
        if (!ra || !rb) {
          const rr = rowRule(rules, sheet.key, base.values);
          if (rr) {
            const v = text(base.values.value);
            envEntry(key, null, ra ? v : undefined, rb ? v : undefined, rr);
            sum.environmentSpecific += 1;
            continue;
          }
          const status = ra ? 'only-in-file' : 'only-here';
          rows.push({ ...entry, status, [ra ? 'file' : 'here']: pick(base.values, columns), differences: [] });
          sum[ra ? 'onlyInFile' : 'onlyHere'] += 1;
          continue;
        }
        const differences = [];
        let envCount = 0;
        for (const c of columns) {
          if (comparable(c, ra.values[c.key]) === comparable(c, rb.values[c.key])) continue;
          const rule = columnRule(rules, sheet.key, ra.values, c.key);
          if (rule) {
            envEntry(key, c.key, text(ra.values[c.key]), text(rb.values[c.key]), rule);
            envCount += 1;
          } else differences.push({ column: c.key, header: c.header, file: text(ra.values[c.key]), here: text(rb.values[c.key]) });
        }
        if (envCount) sum.environmentSpecific += 1;
        if (differences.length) {
          rows.push({ ...entry, status: 'different', file: pick(ra.values, columns), here: pick(rb.values, columns), differences });
          sum.different += 1;
        } else {
          rows.push({ ...entry, status: 'identical', values: pick(ra.values, columns), differences: [] });
          sum.identical += 1;
        }
      }
    }
  }
  const totals = { identical: 0, different: 0, onlyInFile: 0, onlyHere: 0, environmentSpecific: 0, inFile: 0, here: 0 };
  for (const s of sheets) for (const k of Object.keys(totals)) totals[k] += s[k];
  const order = Object.fromEntries(STATUSES.map((s, i) => [s, i]));
  const sheetOrder = Object.fromEntries(catalogue.map((s, i) => [s.key, i]));
  rows.sort((x, y) => sheetOrder[x.sheet] - sheetOrder[y.sheet] || order[x.status] - order[y.status] || x.key.localeCompare(y.key));
  const verdict = totals.different + totals.onlyInFile + totals.onlyHere ? 'differences' : 'mirrored';
  return { verdict, totals, sheets, rows, environmentSpecific };
}

/** Compare two workbook buffers (file A vs file B) without any database. */
export function compareWorkbooks(bufferA, bufferB, catalogue, options = {}) {
  const file = readSheets(bufferA, catalogue, { label: 'File A' });
  const here = readSheets(bufferB, catalogue, { label: 'File B' });
  return compareSides({ catalogue, file, here, options });
}

export const VERDICT_TEXT = { mirrored: 'Mirrored', differences: 'Differences found' };

/**
 * The comparison workbook: Summary (counts per sheet and the overall verdict), one sheet per object with its rows and
 * a Difference column (only in the file green, only here amber, changed cells highlighted), the environment-specific
 * values and the rules that set them apart.
 *   labels: { file, here } (e.g. "File UAT_config.xlsx" / "This environment (Production)"); context: [[item, value]]
 */
export function comparisonWorkbook({ catalogue, result, labels, context = [], options = {} }) {
  const f = labels.file;
  const h = labels.here;
  const verdict = VERDICT_TEXT[result.verdict];
  const differs = (s) => s.different + s.onlyInFile + s.onlyHere;
  const summaryRows = result.sheets.map((s) => [s.name, s.inFile, s.here, s.identical, s.different, s.onlyInFile, s.onlyHere, s.environmentSpecific,
    differs(s) ? 'Differences found' : 'Mirrored', s.notes.join('; ')]);
  const t = result.totals;
  summaryRows.push(['All sheets', t.inFile, t.here, t.identical, t.different, t.onlyInFile, t.onlyHere, t.environmentSpecific, verdict, '']);
  summaryRows.push([]);
  summaryRows.push(['Verdict', verdict]);
  for (const [k, v] of [...context, ['Numbering counters', options.includeNumbering ? 'Compared' : 'Not compared (environment-specific)']]) summaryRows.push([k, v]);
  const summaryEnd = result.sheets.length;
  const summary = {
    name: 'Summary', headerStyle: 'navy', autoFilter: false,
    columns: [{ header: 'Sheet', width: 24 }, ...[`Rows in ${f}`, `Rows in ${h}`, 'Identical', 'Different', `Only in ${f}`, `Only in ${h}`, 'Environment-specific']
      .map((header) => ({ header, width: Math.max(11, Math.min(36, header.length + 4)), type: 'integer' })), { header: 'Result', width: 18 }, { header: 'Note', width: 50, type: 'wrap' }],
    rows: summaryRows,
    cellStyle: (ri, ci) => {
      const r = summaryRows[ri];
      if (ri <= summaryEnd && ci === 8) return r[8] === 'Mirrored' ? 'good' : 'bad';
      if (r[0] === 'Verdict' && ci === 1) return result.verdict === 'mirrored' ? 'good' : 'bad';
      if (ri < summaryEnd && ci === 5 && r[5]) return 'added';
      if (ri < summaryEnd && ci === 6 && r[6]) return 'missing';
      if (ri < summaryEnd && ci === 4 && r[4]) return 'changed';
      return null;
    },
  };
  const objectSheets = [];
  for (const s of result.sheets) {
    const sheet = catalogue.find((x) => x.key === s.sheet);
    const list = result.rows.filter((r) => r.sheet === s.sheet);
    if (!list.length) continue;
    const cols = sheet.columns;
    const data = [];
    const styles = [];
    const changedCells = [];
    for (const r of list) {
      const values = r.status === 'identical' ? r.values : r.status === 'only-here' ? r.here : r.file;
      const out = cols.map((c) => values?.[c.key] ?? '');
      const changed = new Set(r.differences.map((d) => d.column));
      let diffText = 'Identical';
      if (r.status === 'only-in-file') diffText = `Only in ${f}`;
      else if (r.status === 'only-here') diffText = `Only in ${h}`;
      else if (r.status === 'different') diffText = `Different: ${r.differences.map((d) => `${d.header}: ${f} "${d.file}" / ${h} "${d.here}"`).join('; ')}`;
      out.push(diffText);
      data.push(out);
      styles.push(r.status === 'only-in-file' ? 'added' : r.status === 'only-here' ? 'missing' : null);
      changedCells.push(changed.size ? new Set(cols.map((c, i) => (changed.has(c.key) ? i : -1)).filter((i) => i >= 0).concat(cols.length)) : null);
    }
    objectSheets.push({
      name: sheet.name, headerStyle: 'navy', textColumns: true,
      columns: [...cols.map((c) => ({ header: c.header, width: Math.max(14, Math.min(40, c.header.length + 6)) })), { header: 'Difference', width: 80, type: 'wrap' }],
      rows: data, rowStyles: styles,
      cellStyle: (ri, ci) => (changedCells[ri]?.has(ci) ? 'changed' : null),
    });
  }
  const env = {
    name: 'Environment-specific', headerStyle: 'navy',
    columns: [{ header: 'Sheet', width: 20 }, { header: 'Key', width: 34 }, { header: 'Column', width: 18 }, { header: `Value in ${f}`, width: 34, type: 'wrap' },
      { header: `Value in ${h}`, width: 34, type: 'wrap' }, { header: 'Why it may differ', width: 70, type: 'wrap' }],
    rows: result.environmentSpecific.map((e) => [e.sheetName, e.key, e.header || '(whole row)', e.file ?? `(not in ${f})`, e.here ?? `(not in ${h})`, e.reason]),
  };
  const rulesSheet = {
    name: 'Rules', headerStyle: 'navy', autoFilter: false,
    columns: [{ header: 'Environment-specific field', width: 50 }, { header: 'Sheet', width: 14 }, { header: 'Applied', width: 10 }, { header: 'Why', width: 90, type: 'wrap' }],
    rows: environmentRules(options).map((r) => [r.label, r.sheet === '*' ? 'Every sheet' : catalogue.find((c) => c.key === r.sheet)?.name || r.sheet, r.applied ? 'Yes' : 'No', r.reason]),
  };
  return writeXlsx({ title: `Environment comparison: ${verdict}`, creator: 'BrokerVerse', sheets: [summary, ...objectSheets, env, rulesSheet] });
}
