/**
 * Shared helpers of the BIR forms: return periods, the broker's identity on BIR forms (the primary company of the
 * Company master, with the TIN branch code and the RDO), TIN splitting and the alphalist rows of the report queries
 * (QAP, SAWT, SLSP), so a return, its alphalist and its DAT file are produced from the same rows.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';
import { legalIdentity } from '../../lib/letterhead.js';
import { execute } from '../reports/engine.js';
import { addMonths, monthEnd } from '../period-end/fiscal.js';

export { round2 };
export const sum = (rows, key) => round2(rows.reduce((s, r) => s + Number(r[key] || 0), 0));
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const year = (y) => {
  const n = Number(y);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw badRequest('year is invalid');
  return n;
};

/** { from, to, months: ['YYYY-MM'...], key, label } of a month, a quarter or a year. */
export function monthPeriod(y, m) {
  const yy = year(y); const mm = Number(m);
  if (!Number.isInteger(mm) || mm < 1 || mm > 12) throw badRequest('month must be 1 to 12');
  const from = `${yy}-${String(mm).padStart(2, '0')}-01`;
  return { year: yy, month: mm, from, to: monthEnd(from), months: [from.slice(0, 7)], key: from.slice(0, 7), label: `${MONTH_NAMES[mm - 1]} ${yy}` };
}
export function quarterPeriod(y, q) {
  const yy = year(y); const qq = Number(q);
  if (!Number.isInteger(qq) || qq < 1 || qq > 4) throw badRequest('quarter must be 1 to 4');
  const from = `${yy}-${String((qq - 1) * 3 + 1).padStart(2, '0')}-01`;
  return { year: yy, quarter: qq, from, to: monthEnd(addMonths(from, 2)), months: [0, 1, 2].map((i) => addMonths(from, i).slice(0, 7)), key: `${yy}-Q${qq}`, label: `Q${qq} ${yy}` };
}
export function yearPeriod(y) {
  const yy = year(y);
  return { year: yy, from: `${yy}-01-01`, to: `${yy}-12-31`, months: Array.from({ length: 12 }, (_, i) => `${yy}-${String(i + 1).padStart(2, '0')}`), key: String(yy), label: String(yy) };
}

/** "123-456-789-00000" -> { tin: '123456789', branch: '00000' }; the branch defaults to `fallback`. */
export function splitTin(value, fallback = '00000') {
  const digits = String(value || '').replace(/\D/g, '');
  return { tin: digits.slice(0, 9), branch: digits.length > 9 ? digits.slice(9, 14).padStart(5, '0') : fallback };
}
/** 123456789 + 00000 -> 123-456-789-00000 (for printing). */
export const formatTin = (tin, branch) => {
  const t = String(tin || '').replace(/\D/g, '');
  if (!t) return '';
  return [t.slice(0, 3), t.slice(3, 6), t.slice(6, 9), branch].filter(Boolean).join('-');
};

/**
 * The broker on BIR forms: registered name, trade name, TIN (9 digits) and branch code, address, ZIP, RDO, line of
 * business, withholding agent category. Name, TIN, address and RDO come from the Company master (lib/letterhead.js).
 */
export async function birIdentity() {
  const li = await legalIdentity();
  const branchSetting = String((await getSetting('bir.tin_branch_code', '00000')) || '00000').replace(/\D/g, '') || '00000';
  const { tin, branch } = splitTin(li.tin, branchSetting.padStart(5, '0'));
  return {
    name: li.name || '', tradeName: (await getSetting('bir.trade_name', '')) || li.name || '', tin, branch, tinFormatted: formatTin(tin, branch),
    address: li.address || '', zip: li.zip || '', rdoCode: li.rdoCode || '',
    lineOfBusiness: (await getSetting('bir.line_of_business', 'Insurance brokerage')) || '',
    category: (await getSetting('bir.withholding_agent_category', 'private')) || 'private',
    topWithholdingAgent: (await getSetting('bir.top_withholding_agent', false)) === true,
    vatRegistered: (await getSetting('direct_bill.broker_vat_registered', true)) !== false,
  };
}

/** All rows of a report query (no paging), e.g. alphalistRows('qap', from, to). */
export async function alphalistRows(queryName, from, to, criteria = null) {
  const r = await execute({ code: queryName, query_name: queryName, default_columns: [] }, { FromDate: from, ToDate: to, ...(criteria ? { criteria } : {}) }, { all: true });
  return r.rows;
}

/** Due date of a monthly remittance (day bir.withholding_due_day of the next month). */
export async function monthlyDueDate(period) {
  const day = Number(await getSetting('bir.withholding_due_day', 10)) || 10;
  const next = addMonths(period.from, 1);
  return `${next.slice(0, 8)}${String(Math.min(day, 28)).padStart(2, '0')}`;
}
/** Due date of a quarterly return (1601-EQ, 2551Q): the last day of the month after the quarter. */
export const quarterlyDueDate = (period) => monthEnd(addMonths(period.from, 3));
