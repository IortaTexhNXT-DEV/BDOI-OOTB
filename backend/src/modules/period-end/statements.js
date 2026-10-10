/**
 * Financial statements of Accounts > Period End > Financial Statements: the income statement, balance sheet and trial
 * balance of the report catalogue (reports/periodEndQueries.js) laid out in sections, statement groups, account lines
 * and totals, with the date range of every column and the figures of the summary cards. The same layout gives the Excel
 * workbook and the PDF, so the screen, the files and the print always show the same numbers. Lines whose columns are
 * all zero are left out.
 */
import { round2 } from '../../lib/money.js';
import { today } from '../../lib/dates.js';
import { formatAmount, formatDate } from '../../lib/pdf/format.js';
import { ensureCalendar, iso } from './fiscal.js';

/** Statement type -> catalogue report and title. */
export const STATEMENT_TYPES = {
  'income-statement': { report: 'income-statement', title: 'Income Statement', criteria: 'Detailed' },
  'balance-sheet': { report: 'balance-sheet', title: 'Balance Sheet', criteria: 'Detailed' },
  'trial-balance': { report: 'trial-balance-ocm', title: 'Trial Balance', criteria: 'Overall' },
};

const SECTIONS = {
  'income-statement': [['income', 'Income'], ['expense', 'Expenses']],
  'balance-sheet': [['asset', 'Assets'], ['liability', 'Liabilities'], ['equity', 'Equity']],
};

/** Columns of each statement: the report column and the date window it covers (see statementRanges). */
const MEASURES = {
  'income-statement': [
    { key: 'currentPeriod', label: 'This period', range: 'current' },
    { key: 'yearToDate', label: 'Year to date', range: 'yearToDate' },
    { key: 'priorPeriod', label: 'Same period last year', range: 'priorPeriod' },
    { key: 'priorYearToDate', label: 'Last year to date', range: 'priorYearToDate' },
  ],
  'balance-sheet': [
    { key: 'balance', label: 'As of', range: 'asOf' },
    { key: 'priorYearEnd', label: 'Previous year end', range: 'priorYearEnd' },
  ],
  'trial-balance': [
    { key: 'openingDebit', label: 'Opening debit', group: 'opening', side: 'debit', range: 'opening' },
    { key: 'openingCredit', label: 'Opening credit', group: 'opening', side: 'credit', range: 'opening' },
    { key: 'periodDebit', label: 'Movement debit', group: 'movement', side: 'debit', range: 'current' },
    { key: 'periodCredit', label: 'Movement credit', group: 'movement', side: 'credit', range: 'current' },
    { key: 'closingDebit', label: 'Closing debit', group: 'closing', side: 'debit', range: 'asOf' },
    { key: 'closingCredit', label: 'Closing credit', group: 'closing', side: 'credit', range: 'asOf' },
  ],
};

// lines of the balance sheet that add up income and expense (no single account to open)
const EARNINGS_LINES = new Set(['CYE', 'PYE']);

/**
 * Date windows of the columns for From / To, with the same arithmetic as the report queries: the fiscal year start of
 * To Date (the calendar year when no fiscal year covers it) and the same windows one year earlier.
 */
export async function statementRanges(db, from, to) {
  const r = (await db.query(`WITH f AS (SELECT COALESCE((SELECT start_date FROM fiscal_years WHERE $2::date BETWEEN start_date AND end_date), date_trunc('year', $2::date)::date) AS ys)
    SELECT f.ys::text AS ys, ($1::date - interval '1 year')::date::text AS pf, ($2::date - interval '1 year')::date::text AS pt,
      (f.ys - interval '1 year')::date::text AS pys, (f.ys - 1)::text AS pye, ($1::date - 1)::text AS eve,
      (SELECT code FROM fiscal_years WHERE $2::date BETWEEN start_date AND end_date) AS fy FROM f`, [from, to])).rows[0];
  return {
    fiscalYear: r.fy, current: { from, to }, yearToDate: { from: r.ys, to }, priorPeriod: { from: r.pf, to: r.pt },
    priorYearToDate: { from: r.pys, to: r.pt }, asOf: { from: null, to }, priorYearEnd: { from: null, to: r.pye }, opening: { from: null, to: r.eve },
  };
}

const isZero = (values) => Object.values(values).every((v) => Math.abs(v) < 0.005);
const sumOf = (list, keys) => Object.fromEntries(keys.map((k) => [k, round2(list.reduce((s, x) => s + x.values[k], 0))]));
const combine = (keys, fn) => Object.fromEntries(keys.map((k) => [k, round2(fn(k))]));

/**
 * The statement layout from the report rows: { type, title, from, to, fiscalYear, measures, sections, result, cards }.
 * sections: [{ key, label, groups: [{ label, lines, total }], total }]; a line: { accountCode, accountName, values,
 * drill } (drill: the line is one GL account). The trial balance has one section of lines and the grand total as
 * result. The year-to-date columns of the income statement are left out when the range is already the year to date.
 */
export function buildStatement(type, report, ranges) {
  const { from, to } = ranges.current;
  let measures = MEASURES[type];
  if (type === 'income-statement' && ranges.yearToDate.from === from) measures = measures.filter((m) => !['yearToDate', 'priorYearToDate'].includes(m.key));
  const keys = measures.map((m) => m.key);
  const lines = (report.rows || []).map((r) => ({
    accountType: r.accountType, fsGroup: r.fsGroup, accountCode: r.accountCode, accountName: r.accountName,
    values: Object.fromEntries(keys.map((k) => [k, round2(Number(r[k]) || 0)])), drill: !EARNINGS_LINES.has(r.accountCode),
  })).filter((l) => !isZero(l.values));
  const out = {
    type, title: STATEMENT_TYPES[type].title, from: type === 'balance-sheet' ? null : from, to, fiscalYear: ranges.fiscalYear,
    measures: measures.map((m) => ({ ...m, from: ranges[m.range].from, to: ranges[m.range].to })),
  };
  if (type === 'trial-balance') {
    const total = sumOf(lines, keys);
    const difference = round2(total.closingDebit - total.closingCredit);
    return { ...out, sections: [{ key: 'accounts', label: null, groups: [{ label: null, lines, total: null }], total: null }],
      result: { key: 'total', label: 'Total', values: total },
      cards: { totalDebit: total.closingDebit, totalCredit: total.closingCredit, difference, balanced: difference === 0 } };
  }
  const sections = SECTIONS[type].map(([key, label]) => {
    const inSection = lines.filter((l) => l.accountType === key);
    const groups = [...new Set(inSection.map((l) => l.fsGroup))].map((g) => {
      const gl = inSection.filter((l) => l.fsGroup === g);
      return { label: g, lines: gl, total: sumOf(gl, keys) };
    });
    return { key, label, groups, total: sumOf(inSection, keys) };
  });
  const total = Object.fromEntries(sections.map((s) => [s.key, s.total]));
  if (type === 'income-statement') {
    const net = combine(keys, (k) => total.income[k] - total.expense[k]);
    return { ...out, sections, result: { key: 'netIncome', label: 'Net income (loss)', values: net },
      cards: { totalIncome: total.income.currentPeriod, totalExpense: total.expense.currentPeriod, netIncome: net.currentPeriod,
        netIncomeYearToDate: keys.includes('yearToDate') ? net.yearToDate : net.currentPeriod } };
  }
  const le = combine(keys, (k) => total.liability[k] + total.equity[k]);
  const difference = round2(total.asset.balance - le.balance);
  return { ...out, sections, result: { key: 'liabilitiesAndEquity', label: 'Total liabilities and equity', values: le },
    cards: { totalAssets: total.asset.balance, totalLiabilities: total.liability.balance, totalEquity: total.equity.balance, difference, balanced: difference === 0 } };
}

/**
 * Fiscal years (newest first) with their twelve periods for the period choice of the statements, and the default: the
 * period that contains today's business date. The adjustment period 13 is left out (a single day, the fiscal year end,
 * inside the last month).
 */
export async function statementCalendar(db) {
  const years = await ensureCalendar(db);
  const periods = (await db.query(`SELECT period, fiscal_year, period_no, start_date, end_date, status FROM accounting_periods
    WHERE fiscal_year IS NOT NULL AND NOT is_adjustment ORDER BY start_date`)).rows;
  const day = await today();
  const current = periods.find((p) => iso(p.start_date) <= day && iso(p.end_date) >= day) || periods[periods.length - 1] || null;
  return {
    today: day,
    current: current ? { fiscalYear: current.fiscal_year, period: current.period } : null,
    fiscalYears: years.slice().reverse().map((f) => ({
      code: f.code, startDate: iso(f.start_date), endDate: iso(f.end_date), status: f.status,
      periods: periods.filter((p) => p.fiscal_year === f.code).map((p) => ({ period: p.period, periodNo: p.period_no, startDate: iso(p.start_date), endDate: iso(p.end_date), status: p.status })),
    })),
  };
}

/** "01/10/2026 to 31/10/2026", or "As of 31/10/2026" for the balance sheet. */
export const periodText = (st, fmt) => (st.from ? `${formatDate(st.from, fmt)} to ${formatDate(st.to, fmt)}` : `As of ${formatDate(st.to, fmt)}`);

/**
 * Column heading of a file: the label with its dates ("Same period last year 01/10/2025 - 31/10/2025"); the trial
 * balance columns keep their label (the period line gives the dates).
 */
const measureHeading = (m, fmt) => {
  if (m.group) return m.label;
  if (m.from) return `${m.label} ${formatDate(m.from, fmt)} - ${formatDate(m.to, fmt)}`;
  return `${m.label} ${formatDate(m.to, fmt)}`;
};

/**
 * Rows of the files, in statement order: [kind, account, description, values]. kind: heading (section), group,
 * line, subtotal (group total), total (section total), result.
 */
function fileRows(st) {
  const rows = [];
  for (const s of st.sections) {
    if (s.label) rows.push(['heading', '', s.label.toUpperCase(), null]);
    for (const g of s.groups) {
      // a group named as its section (Equity under Equity) has no heading or total of its own
      const own = g.label && g.label !== s.label;
      if (own) rows.push(['group', '', g.label, null]);
      for (const l of g.lines) rows.push(['line', l.drill ? l.accountCode : '', l.accountName, l.values]);
      if (own && g.total) rows.push(['subtotal', '', `Total ${g.label}`, g.total]);
    }
    if (s.total) rows.push(['total', '', `TOTAL ${s.label.toUpperCase()}`, s.total]);
  }
  rows.push(['result', '', st.result.label.toUpperCase(), st.result.values]);
  return rows;
}

/** An amount of a printed statement: negatives in parentheses. */
const printed = (v, decimals) => (v < 0 ? `(${formatAmount(-v, decimals)})` : formatAmount(v, decimals));
/** A file cell: none on heading rows, and none for the zero side of a trial balance line. */
const cell = (st, kind, values, key) => (!values || (st.type === 'trial-balance' && kind === 'line' && !values[key]) ? null : values[key]);

/**
 * PDF document spec (lib/pdf) of a statement: letterhead, title, period, currency, printed by / at, and one table with
 * the sections, groups, lines and totals; the result line is the bold total row.
 * ctx: printContext() (format, generatedBy, generatedAt) and currency.
 */
export function statementPdfSpec(st, ctx) {
  const fmt = ctx.format || {};
  const decimals = fmt.decimals ?? 2;
  const columns = [{ label: 'Account', type: 'code' }, { label: 'Description' }, ...st.measures.map((m) => ({ label: measureHeading(m, fmt), type: 'money', align: 'right' }))];
  const rows = fileRows(st).map(([kind, code, text, values]) => [code, text, ...st.measures.map((m) => {
    const v = cell(st, kind, values, m.key);
    return v === null ? '' : printed(v, decimals);
  })]);
  const meta = [['Period', periodText(st, fmt)], ['Currency', ctx.currency], ['Printed by', ctx.generatedBy || '-'], ['Printed at', ctx.generatedAt]];
  if (st.type !== 'income-statement') meta.push(['Balance check', st.cards.balanced ? 'Balanced' : `Out of balance by ${printed(st.cards.difference, decimals)}`]);
  return {
    title: st.title, meta, orientation: st.measures.length > 3 ? 'landscape' : 'portrait',
    sections: [{ table: { columns, rows, totalRow: true } }],
  };
}

/**
 * Excel sheet (lib/xlsx) of a statement: a banner with the company, title, period, printed by / at and currency above
 * the table; amounts stay numbers; headings and totals in bold.
 * meta: { companyName, generatedBy, generatedAt, currency, format, logo }.
 */
export function statementSheet(st, meta) {
  const fmt = meta.format || {};
  const list = fileRows(st);
  const bold = new Set(['heading', 'group', 'subtotal', 'total', 'result']);
  return {
    name: st.title,
    banner: [meta.companyName, st.title, periodText(st, fmt), `Printed by ${meta.generatedBy || '-'} at ${meta.generatedAt}`, `Amounts in ${meta.currency}`].filter(Boolean),
    logo: !!meta.logo,
    columns: [{ header: 'Account', width: 12 }, { header: 'Description', width: 48 },
      ...st.measures.map((m) => ({ header: measureHeading(m, fmt), type: 'money', width: 22 }))],
    rows: list.map(([kind, code, text, values]) => [code, text, ...st.measures.map((m) => cell(st, kind, values, m.key))]),
    cellStyle: (ri, ci) => (ci <= 1 && bold.has(list[ri][0]) ? 'bold' : null),
    autoFilter: false,
  };
}
