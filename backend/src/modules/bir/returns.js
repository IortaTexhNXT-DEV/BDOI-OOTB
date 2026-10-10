/**
 * BIR returns computed from the books, laid out as the BIR form, with their filing records.
 *
 *   0619-E   Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded): first and second month of a quarter
 *   1601-EQ  Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded): per ATC, less the 0619-E
 *            remittances of the quarter; attachment: the QAP
 *   1604-E   Annual Information Return of Creditable Income Taxes Withheld (Expanded): remittances per month and the
 *            alphalist of payees (schedule 3: subject to expanded withholding; schedule 4: income payments exempt)
 *   2551Q    Quarterly Percentage Tax Return (non-VAT broker or agent): gross sales per month at bir.percentage_tax_rate
 *
 * The withholding figures are the payment vouchers with tax withheld and the approved supplier invoices of accounts
 * payable with EWT (period-end/tax.js#withholdingLines, the same source as BIR Form 2307 and the QAP); each 0619-E / 1601-EQ is reconciled with the QAP report and with the ledger
 * withholding accounts (bir.withholding_ledger_accounts, else accounting.account.wht_payable). Item numbers follow
 * the January 2018 (ENCS) versions of the forms; the tax adviser confirms them against the current eBIRForms / eFPS
 * version before filing.
 *
 * Every computation returns one structure ({ form, title, period, header, items, schedules, reconciliation, taxDue })
 * that the screen shows, and that output.js prints (PDF) and exports (Excel) without knowing the form.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { withholdingLines } from '../period-end/tax.js';
import { iso } from '../period-end/fiscal.js';
import { formatDate, printFormat } from '../../lib/pdf/index.js';
import { alphalistRows, birIdentity, monthPeriod, monthlyDueDate, quarterPeriod, quarterlyDueDate, round2, splitTin, sum, yearPeriod, MONTH_NAMES } from './common.js';

export const FORMS = {
  '0619-E': { title: 'Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded)', period: 'month', version: 'January 2018 (ENCS)' },
  '1601-EQ': { title: 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)', period: 'quarter', version: 'January 2018 (ENCS)' },
  '1604-E': { title: 'Annual Information Return of Creditable Income Taxes Withheld (Expanded)', period: 'year', version: 'January 2018 (ENCS)' },
  '2551Q': { title: 'Quarterly Percentage Tax Return', period: 'quarter', version: 'January 2018 (ENCS), as amended for RA 11976' },
};
export const FORM_CODES = Object.keys(FORMS);

/** The period of a form from { year, month, quarter }. */
export function periodOf(form, q) {
  const f = FORMS[form];
  if (!f) throw notFound(`Unknown BIR form ${form}`);
  if (f.period === 'month') {
    const p = monthPeriod(q.year, q.month);
    if (form === '0619-E' && p.month % 3 === 0) throw badRequest('0619-E is filed for the first and second month of a quarter; the third month is covered by the 1601-EQ');
    return p;
  }
  if (f.period === 'quarter') return quarterPeriod(q.year, q.quarter);
  return yearPeriod(q.year);
}

const money = (v) => round2(Number(v) || 0);

async function atcInfo(db) {
  const rows = (await db.query('SELECT atc, rate, COALESCE(nature_of_payment, description) AS nature FROM tax_codes WHERE atc IS NOT NULL')).rows;
  return new Map(rows.map((r) => [r.atc, { rate: Number(r.rate), nature: r.nature }]));
}

/** Withholding of a period grouped by ATC: [{ atc, nature, rate, taxBase, tax, payees, transactions }]. */
async function byAtc(db, from, to) {
  const lines = await withholdingLines(db, 'issued', from, to);
  const info = await atcInfo(db);
  const map = new Map();
  for (const l of lines) {
    const k = l.atc || '';
    const r = map.get(k) || { atc: k, nature: info.get(k)?.nature || '', rate: info.get(k)?.rate ?? null, taxBase: 0, tax: 0, payees: new Set(), transactions: 0 };
    r.taxBase = round2(r.taxBase + l.income); r.tax = round2(r.tax + l.tax); r.payees.add(l.key); r.transactions += 1;
    map.set(k, r);
  }
  return { lines, rows: [...map.values()].map((r) => ({ ...r, payees: r.payees.size, rate: r.rate ?? (r.taxBase ? round2((100 * r.tax) / r.taxBase) : 0) }))
    .sort((a, b) => a.atc.localeCompare(b.atc)) };
}

async function ledgerAccounts() {
  const list = (await getSetting('bir.withholding_ledger_accounts', [])) || [];
  if (Array.isArray(list) && list.length) return list.map(String);
  return [String((await getSetting('accounting.account.wht_payable', '2204001')) || '2204001')];
}

/**
 * Ledger side of the reconciliation: tax withheld booked in the period (credits, net of reversals), remittances
 * (other debits) and the balance at the period end, on the withholding accounts.
 */
async function ledgerWithholding(db, from, to) {
  const accounts = await ledgerAccounts();
  const r = (await db.query(`SELECT
      COALESCE(sum(l.credit) FILTER (WHERE j.jv_date BETWEEN $2 AND $3), 0) AS credits,
      COALESCE(sum(l.debit) FILTER (WHERE j.jv_date BETWEEN $2 AND $3 AND (j.reversal_of IS NOT NULL OR j.source = 'reversal')), 0) AS reversals,
      COALESCE(sum(l.debit) FILTER (WHERE j.jv_date BETWEEN $2 AND $3 AND j.reversal_of IS NULL AND j.source <> 'reversal'), 0) AS remitted,
      COALESCE(sum(l.credit - l.debit) FILTER (WHERE j.jv_date <= $3), 0) AS closing
    FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
    WHERE l.account_code = ANY($1) AND j.status IN ('posted', 'reversed') AND j.source NOT IN ('year-end-close')`, [accounts, from, to])).rows[0];
  return { accounts, withheld: round2(Number(r.credits) - Number(r.reversals)), remitted: money(r.remitted), closingBalance: money(r.closing) };
}

/** QAP report rows of the period, grouped per ATC for the reconciliation. */
async function qapTotals(from, to) {
  const rows = await alphalistRows('qap', from, to);
  const perAtc = new Map();
  for (const r of rows) perAtc.set(r.atc || '', round2((perAtc.get(r.atc || '') || 0) + Number(r.taxWithheld || 0)));
  return { rows, payees: rows.length, income: sum(rows, 'incomePayment'), tax: sum(rows, 'taxWithheld'), perAtc };
}

function reconciliation(returnTax, qap, ledger, atcRows) {
  const checks = [
    { code: 'qap', label: 'Quarterly Alphalist of Payees (QAP report)', returnAmount: returnTax, otherAmount: qap ? qap.tax : null },
    { code: 'ledger', label: `Ledger: tax withheld credited to ${ledger.accounts.join(', ')}`, returnAmount: returnTax, otherAmount: ledger.withheld },
  ].filter((c) => c.otherAmount !== null).map((c) => ({ ...c, difference: round2(c.returnAmount - c.otherAmount), reconciled: Math.abs(round2(c.returnAmount - c.otherAmount)) < 0.01 }));
  const atc = qap ? atcRows.map((r) => {
    const q = qap.perAtc.get(r.atc) || 0;
    return { atc: r.atc, returnAmount: r.tax, qapAmount: q, difference: round2(r.tax - q) };
  }) : [];
  return { checks, perAtc: atc, ledger, reconciled: checks.every((c) => c.reconciled) };
}

/** Active filing of a form and period, and the earlier (superseded / cancelled) ones. */
export async function filingsOf(db, form, key) {
  const rows = (await db.query('SELECT * FROM bir_return_filings WHERE form_code = $1 AND period_key = $2 ORDER BY created_at DESC', [form, key])).rows;
  return { active: rows.find((r) => r.status === 'filed') || null, history: rows.map(filingRow) };
}

export const filingRow = (f) => f && ({
  id: f.id, form: f.form_code, periodKey: f.period_key, year: f.year, quarter: f.quarter, month: f.month, periodFrom: iso(f.period_from), periodTo: iso(f.period_to),
  taxDue: Number(f.tax_due), penalties: Number(f.penalties), amountPaid: Number(f.amount_paid), dateFiled: iso(f.date_filed), filingReference: f.filing_reference,
  paymentDate: f.payment_date ? iso(f.payment_date) : null, paymentReference: f.payment_reference, paymentChannel: f.payment_channel, amended: f.amended,
  supersedes: f.supersedes, status: f.status, remarks: f.remarks, createdBy: f.created_by, createdAt: f.created_at, updatedAt: f.updated_at,
  cancelReason: f.cancel_reason, cancelledAt: f.cancelled_at,
});

/** A due date as the screens and the printed return show dates (general.date_format). */
const dueText = async (v) => formatDate(v, await printFormat());
/** "2026-01" as "01/2026", the way the return names a month. */
const monthText = (key) => String(key || '').split('-').reverse().join('/');

const headerOf = (id, extra = []) => [
  ['TIN', id.tinFormatted], ['RDO code', id.rdoCode], ["Withholding agent's name / registered name", id.name], ['Registered address', id.address],
  ['ZIP code', id.zip], ['Category of withholding agent', id.category === 'government' ? 'Government' : 'Private'], ...extra,
];

/** Tax remitted on a filed return (amount paid less penalties), 0 when the return is not filed. */
async function remitted(db, form, key) {
  const f = (await filingsOf(db, form, key)).active;
  return f ? round2(Number(f.amount_paid) - Number(f.penalties)) : 0;
}

// ---------------------------------------------------------------- 0619-E

async function compute0619E(db, p) {
  const id = await birIdentity();
  const { rows } = await byAtc(db, p.from, p.to);
  const tax = sum(rows, 'tax');
  const ledger = await ledgerWithholding(db, p.from, p.to);
  const qap = await qapTotals(p.from, p.to);
  const filing = (await filingsOf(db, '0619-E', p.key)).active;
  return {
    header: headerOf(id, [['For the month (MM/YYYY)', `${String(p.month).padStart(2, '0')}/${p.year}`], ['Due date', await dueText(await monthlyDueDate(p))],
      ['Tax type code', 'WE'], ['Any taxes withheld?', tax > 0 ? 'Yes' : 'No'], ['Top withholding agent', id.topWithholdingAgent ? 'Yes' : 'No']]),
    items: [
      { no: '14', label: 'Amount of remittance', amount: tax },
      { no: '15', label: 'Less: amount remitted from previously filed form, if this is an amended form', amount: 0 },
      { no: '16', label: 'Net amount of remittance (item 14 less item 15)', amount: tax },
      { no: '17', label: 'Add: penalties (surcharge, interest, compromise): enter on the filing record', amount: filing ? Number(filing.penalties) : 0 },
      { no: '18', label: 'Total amount of remittance (sum of items 16 and 17)', amount: round2(tax + (filing ? Number(filing.penalties) : 0)) },
    ],
    schedules: [{ code: 'atc', title: 'Working paper: tax withheld per ATC', columns: ATC_COLUMNS, rows, totals: { taxBase: sum(rows, 'taxBase'), tax } }],
    reconciliation: reconciliation(tax, qap, ledger, rows), taxDue: tax,
  };
}
const ATC_COLUMNS = [{ key: 'atc', label: 'ATC' }, { key: 'nature', label: 'Nature of income payment' }, { key: 'taxBase', label: 'Tax base', type: 'money' },
  { key: 'rate', label: 'Tax rate (%)', type: 'number' }, { key: 'tax', label: 'Tax required to be withheld', type: 'money' }, { key: 'payees', label: 'Payees', type: 'integer' }];

// ---------------------------------------------------------------- 1601-EQ

async function compute1601EQ(db, p) {
  const id = await birIdentity();
  const { rows } = await byAtc(db, p.from, p.to);
  const tax = sum(rows, 'tax');
  const ledger = await ledgerWithholding(db, p.from, p.to);
  const qap = await qapTotals(p.from, p.to);
  const m1 = await remitted(db, '0619-E', p.months[0]);
  const m2 = await remitted(db, '0619-E', p.months[1]);
  const prior = (await filingsOf(db, '1601-EQ', p.key)).active;
  const previouslyFiled = 0;
  const totalRemit = round2(m1 + m2 + previouslyFiled);
  const due = round2(tax - totalRemit);
  const penalties = prior ? Number(prior.penalties) : 0;
  return {
    header: headerOf(id, [['For the year', String(p.year)], ['Quarter', `Q${p.quarter}`], ['Due date', await dueText(quarterlyDueDate(p))],
      ['Any taxes withheld?', tax > 0 ? 'Yes' : 'No'], ['Number of sheets attached', '1 (QAP)']]),
    items: [
      ...rows.map((r, i) => ({ no: `${13 + i}`, label: `${r.atc} ${r.nature}`, taxBase: r.taxBase, rate: r.rate, amount: r.tax, schedule: true })),
      { no: '19', label: 'Total taxes withheld for the quarter', amount: tax },
      { no: '20', label: `Less: remittances made, 1st month of the quarter (0619-E ${monthText(p.months[0])})`, amount: m1 },
      { no: '21', label: `Less: remittances made, 2nd month of the quarter (0619-E ${monthText(p.months[1])})`, amount: m2 },
      { no: '22', label: 'Tax remitted in the return previously filed, if this is an amended return', amount: previouslyFiled },
      { no: '23', label: 'Over-remittance from the previous quarter of the same taxable year', amount: 0 },
      { no: '24', label: 'Total remittances made (sum of items 20 to 23)', amount: totalRemit },
      { no: '25', label: 'Tax still due / (over-remittance) (item 19 less item 24)', amount: due },
      { no: '26-28', label: 'Add: penalties (surcharge, interest, compromise): enter on the filing record', amount: penalties },
      { no: '30', label: 'Total amount still due / (over-remittance)', amount: round2(due + penalties) },
    ],
    schedules: [
      { code: 'atc', title: 'Part II: computation of tax per ATC', columns: ATC_COLUMNS, rows, totals: { taxBase: sum(rows, 'taxBase'), tax } },
      { code: 'qap', title: 'Attachment: Quarterly Alphalist of Payees (QAP)', columns: QAP_COLUMNS, rows: qap.rows, totals: { incomePayment: qap.income, taxWithheld: qap.tax } },
    ],
    reconciliation: reconciliation(tax, qap, ledger, rows), taxDue: due,
  };
}
const QAP_COLUMNS = [{ key: 'seqNo', label: 'Seq', type: 'integer' }, { key: 'tin', label: 'TIN' }, { key: 'registeredName', label: 'Registered name' },
  { key: 'lastName', label: 'Last name' }, { key: 'firstName', label: 'First name' }, { key: 'middleName', label: 'Middle name' }, { key: 'atc', label: 'ATC' },
  { key: 'natureOfPayment', label: 'Nature of income payment' }, { key: 'taxRate', label: 'Rate (%)', type: 'number' },
  { key: 'incomePayment', label: 'Amount of income payment', type: 'money' }, { key: 'taxWithheld', label: 'Tax withheld', type: 'money' }];

// ---------------------------------------------------------------- 1604-E

/**
 * Alphalist of payees for the year (1604-E schedule 3): one row per payee and ATC with the income payments and the
 * tax withheld of the year; schedule 4 (income payments exempt from withholding) lists payees paid without tax when
 * bir.alphalist_exempt_payee_types names their types (empty: none).
 */
export async function alphalist1604E(db, y) {
  const p = yearPeriod(y);
  const lines = await withholdingLines(db, 'issued', p.from, p.to);
  const info = await atcInfo(db);
  const map = new Map();
  for (const l of lines) {
    const k = `${l.key}|${l.atc}`;
    const r = map.get(k) || { payeeKey: l.key, name: l.name, tin: l.tin, address: l.address, atc: l.atc, nature: info.get(l.atc)?.nature || '', rate: info.get(l.atc)?.rate ?? null, income: 0, tax: 0,
      individualPayee: l.individual === true };
    r.income = round2(r.income + l.income); r.tax = round2(r.tax + l.tax);
    map.set(k, r);
  }
  const individual = (name, key) => /^(Agent\/Referrer|Agent|Sub-agent|Client):/.test(key) && !/\b(inc|corp|corporation|co|company|ltd|llc|insurance|agency|services)\b\.?/i.test(name);
  const rows = [...map.values()].sort((a, b) => a.name.localeCompare(b.name) || a.atc.localeCompare(b.atc)).map((r, i) => {
    const t = splitTin(r.tin, '0000');
    const ind = r.individualPayee || individual(r.name, r.payeeKey);
    const parts = String(r.name).trim().split(/\s+/);
    return { seqNo: i + 1, tin: t.tin, branch: t.branch.slice(-4).padStart(4, '0'), registeredName: ind ? null : r.name, lastName: ind ? parts[parts.length - 1] : null,
      firstName: ind ? parts[0] : null, middleName: ind && parts.length > 2 ? parts.slice(1, -1).join(' ') : null, atc: r.atc, natureOfPayment: r.nature,
      taxRate: r.rate ?? (r.income ? round2((100 * r.tax) / r.income) : 0), incomePayment: r.income, taxWithheld: r.tax };
  });
  return { period: p, schedule3: rows, schedule4: [] };
}
const ALPHA_COLUMNS = [{ key: 'seqNo', label: 'Seq', type: 'integer' }, { key: 'tin', label: 'TIN' }, { key: 'branch', label: 'Branch' }, { key: 'registeredName', label: 'Registered name' },
  { key: 'lastName', label: 'Last name' }, { key: 'firstName', label: 'First name' }, { key: 'middleName', label: 'Middle name' }, { key: 'atc', label: 'ATC' },
  { key: 'natureOfPayment', label: 'Nature of income payment' }, { key: 'taxRate', label: 'Rate (%)', type: 'number' },
  { key: 'incomePayment', label: 'Amount of income payment', type: 'money' }, { key: 'taxWithheld', label: 'Amount of tax withheld', type: 'money' }];

async function compute1604E(db, p) {
  const id = await birIdentity();
  const al = await alphalist1604E(db, p.year);
  const monthly = [];
  for (let m = 1; m <= 12; m += 1) {
    const key = `${p.year}-${String(m).padStart(2, '0')}`;
    const mp = monthPeriod(p.year, m);
    const { rows } = await byAtc(db, mp.from, mp.to);
    const form = m % 3 === 0 ? '1601-EQ' : '0619-E';
    const fk = m % 3 === 0 ? `${p.year}-Q${m / 3}` : key;
    const f = (await filingsOf(db, form, fk)).active;
    monthly.push({ month: MONTH_NAMES[m - 1], form, dateOfRemittance: f ? iso(f.payment_date || f.date_filed) : null, reference: f?.payment_reference || f?.filing_reference || null,
      taxesWithheld: sum(rows, 'tax'), penalties: f ? Number(f.penalties) : 0, totalRemitted: f ? Number(f.amount_paid) : 0 });
  }
  const tax = sum(al.schedule3, 'taxWithheld');
  const remittedTotal = sum(monthly, 'totalRemitted');
  const penalties = sum(monthly, 'penalties');
  return {
    header: headerOf(id, [['For the year', String(p.year)], ['Due date', await dueText(`${p.year + 1}-03-01`)], ['Number of sheets attached', '2 (schedules 3 and 4)']]),
    items: [
      { no: 'IV', label: 'Total taxes withheld for the year (schedule 3)', amount: tax },
      { no: 'IV', label: 'Total penalties paid', amount: penalties },
      { no: 'IV', label: 'Total amount remitted (filing records)', amount: remittedTotal },
      { no: '', label: 'Difference: taxes withheld less tax remitted', amount: round2(tax - (remittedTotal - penalties)) },
    ],
    schedules: [
      { code: 'remittances', title: 'Part IV: summary of remittances per month', columns: [{ key: 'month', label: 'Month' }, { key: 'form', label: 'Form' },
        { key: 'dateOfRemittance', label: 'Date of remittance', type: 'date' }, { key: 'reference', label: 'Reference / bank confirmation' },
        { key: 'taxesWithheld', label: 'Taxes withheld', type: 'money' }, { key: 'penalties', label: 'Penalties', type: 'money' }, { key: 'totalRemitted', label: 'Total amount remitted', type: 'money' }],
      rows: monthly, totals: { taxesWithheld: sum(monthly, 'taxesWithheld'), penalties, totalRemitted: remittedTotal } },
      { code: 'schedule3', title: 'Schedule 3: alphalist of payees subject to expanded withholding tax', columns: ALPHA_COLUMNS, rows: al.schedule3,
        totals: { incomePayment: sum(al.schedule3, 'incomePayment'), taxWithheld: tax } },
      { code: 'schedule4', title: 'Schedule 4: alphalist of payees whose income payments are exempt from withholding tax', columns: ALPHA_COLUMNS, rows: al.schedule4, totals: { incomePayment: 0, taxWithheld: 0 } },
    ],
    reconciliation: { checks: [{ code: 'remitted', label: 'Taxes withheld (schedule 3) against tax remitted on the filing records', returnAmount: tax,
      otherAmount: round2(remittedTotal - penalties), difference: round2(tax - (remittedTotal - penalties)), reconciled: Math.abs(tax - (remittedTotal - penalties)) < 0.01 }],
    perAtc: [], reconciled: Math.abs(tax - (remittedTotal - penalties)) < 0.01 },
    taxDue: 0,
  };
}

// ---------------------------------------------------------------- 2551Q

/**
 * Gross sales per month of the quarter from the ledger: revenue accounts (income in the Revenue statement group),
 * credits less debits, period-end entries excluded. Percentage tax = gross sales x bir.percentage_tax_rate (default 3%).
 */
export async function grossSales(db, from, to) {
  return (await db.query(`SELECT to_char(j.jv_date, 'YYYY-MM') AS month, a.code, a.name, COALESCE(sum(l.credit - l.debit), 0) AS amount
    FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id JOIN gl_accounts a ON a.code = l.account_code
    WHERE j.status IN ('posted', 'reversed') AND j.jv_date BETWEEN $1 AND $2 AND j.source NOT IN ('period-close', 'year-end-close')
      AND a.account_type = 'income' AND a.fs_group = 'Revenue' GROUP BY 1, 2, 3 ORDER BY 1, 2`, [from, to])).rows.map((r) => ({ ...r, amount: money(r.amount) }));
}

async function compute2551Q(db, p) {
  const id = await birIdentity();
  const rate = Number(await getSetting('bir.percentage_tax_rate', 3));
  const atc = (await getSetting('bir.percentage_tax_atc', 'PT010')) || 'PT010';
  const rows = await grossSales(db, p.from, p.to);
  const accounts = [...new Map(rows.map((r) => [r.code, r.name])).entries()];
  const perAccount = accounts.map(([code, name]) => {
    const o = { account: code, accountName: name };
    p.months.forEach((m, i) => { o[`month${i + 1}`] = sum(rows.filter((r) => r.code === code && r.month === m), 'amount'); });
    o.total = round2(o.month1 + o.month2 + o.month3);
    return o;
  });
  const monthTotals = p.months.map((m) => sum(rows.filter((r) => r.month === m), 'amount'));
  const gross = round2(monthTotals.reduce((s, v) => s + v, 0));
  const tax = round2((gross * rate) / 100);
  // creditable percentage tax withheld per BIR Form 2307 (none on commission: kept for completeness), prior payments
  const prior = (await filingsOf(db, '2551Q', p.key)).active;
  const penalties = prior ? Number(prior.penalties) : 0;
  return {
    header: headerOf(id, [['Year ended', `12/${p.year}`], ['Quarter', `Q${p.quarter}`], ['Due date', await dueText(quarterlyDueDate(p))],
      ['VAT registered', id.vatRegistered ? 'Yes (percentage tax not normally due: check with the tax adviser)' : 'No']]),
    items: [
      { no: '13', label: `${atc} gross sales / receipts`, taxBase: gross, rate, amount: tax, schedule: true },
      { no: '14', label: 'Total tax due', amount: tax },
      { no: '15', label: 'Less: creditable percentage tax withheld per BIR Form 2307', amount: 0 },
      { no: '16', label: 'Less: tax paid in the return previously filed, if amended', amount: 0 },
      { no: '19', label: 'Tax still payable / (overpayment)', amount: tax },
      { no: '20-23', label: 'Add: penalties (surcharge, interest, compromise): enter on the filing record', amount: penalties },
      { no: '24', label: 'Total amount payable / (overpayment)', amount: round2(tax + penalties) },
    ],
    schedules: [
      { code: 'months', title: 'Working paper: gross sales per month (ledger revenue accounts)',
        columns: [{ key: 'month', label: 'Month' }, { key: 'grossSales', label: 'Gross sales / receipts', type: 'money' }, { key: 'rate', label: 'Rate (%)', type: 'number' }, { key: 'tax', label: 'Percentage tax', type: 'money' }],
        rows: p.months.map((m, i) => ({ month: m, grossSales: monthTotals[i], rate, tax: round2((monthTotals[i] * rate) / 100) })), totals: { grossSales: gross, tax } },
      { code: 'accounts', title: 'Working paper: gross sales per revenue account',
        columns: [{ key: 'account', label: 'Account' }, { key: 'accountName', label: 'Account name' }, ...p.months.map((m, i) => ({ key: `month${i + 1}`, label: m, type: 'money' })), { key: 'total', label: 'Total', type: 'money' }],
        rows: perAccount, totals: { month1: monthTotals[0], month2: monthTotals[1], month3: monthTotals[2], total: gross } },
    ],
    reconciliation: { checks: [], perAtc: [], reconciled: true }, taxDue: tax, rate, atc,
  };
}

const COMPUTE = { '0619-E': compute0619E, '1601-EQ': compute1601EQ, '1604-E': compute1604E, '2551Q': compute2551Q };

/** The return of a form and period, with its filing record and filing history. */
export async function computeReturn(db, form, q) {
  const p = periodOf(form, q);
  const r = await COMPUTE[form](db, p);
  const filings = await filingsOf(db, form, p.key);
  return { form, title: FORMS[form].title, formVersion: FORMS[form].version, period: { key: p.key, label: p.label, from: p.from, to: p.to, year: p.year, quarter: p.quarter || null, month: p.month || null },
    ...r, filing: filingRow(filings.active), filingHistory: filings.history };
}

/** Filing calendar of a year: every return due with its tax and filing status. */
export async function returnCalendar(db, y) {
  const yy = yearPeriod(y).year;
  const vat = (await getSetting('direct_bill.broker_vat_registered', true)) !== false;
  const out = [];
  for (let q = 1; q <= 4; q += 1) {
    for (const m of [(q - 1) * 3 + 1, (q - 1) * 3 + 2]) out.push({ form: '0619-E', year: yy, month: m, quarter: q });
    out.push({ form: '1601-EQ', year: yy, quarter: q });
    if (!vat) out.push({ form: '2551Q', year: yy, quarter: q });
  }
  out.push({ form: '1604-E', year: yy });
  const filings = (await db.query('SELECT * FROM bir_return_filings WHERE year = $1 AND status = \'filed\'', [yy])).rows;
  const rows = [];
  for (const r of out) {
    const p = periodOf(r.form, r);
    const f = filings.find((x) => x.form_code === r.form && x.period_key === p.key);
    const due = r.form === '0619-E' ? await monthlyDueDate(p) : r.form === '1604-E' ? `${yy + 1}-03-01` : quarterlyDueDate(p);
    rows.push({ form: r.form, title: FORMS[r.form].title, year: yy, quarter: r.quarter || null, month: r.month || null, periodKey: p.key, periodLabel: p.label, dueDate: due,
      status: f ? 'filed' : 'not_filed', dateFiled: f ? iso(f.date_filed) : null, amountPaid: f ? Number(f.amount_paid) : null, filingReference: f?.filing_reference || null, filingId: f?.id || null });
  }
  return rows;
}

/** Record a filing (snapshot of the computed return). An amended filing supersedes the active one. */
export async function recordFiling(db, form, b, user) {
  const ret = await computeReturn(db, form, b);
  const p = ret.period;
  const current = (await filingsOf(db, form, p.key)).active;
  if (current && !b.amended) throw conflict(`${form} ${p.label} is already filed (${current.filing_reference || iso(current.date_filed)}); record an amended return instead`);
  if (!current && b.amended) throw badRequest(`No filed ${form} for ${p.label} to amend`);
  if (current) await db.query('UPDATE bir_return_filings SET status = \'superseded\', updated_by = $2, updated_at = now() WHERE id = $1', [current.id, user?.id ?? null]);
  const snapshot = { header: ret.header, items: ret.items, schedules: ret.schedules.map((s) => ({ code: s.code, title: s.title, rows: s.rows.length, totals: s.totals })), reconciliation: ret.reconciliation };
  const row = (await db.query(`INSERT INTO bir_return_filings(form_code, period_key, year, quarter, month, period_from, period_to, figures, tax_due, penalties, amount_paid, date_filed,
      filing_reference, payment_date, payment_reference, payment_channel, amended, supersedes, remarks, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20) RETURNING *`,
  [form, p.key, p.year, p.quarter, p.month, p.from, p.to, JSON.stringify(snapshot), ret.taxDue, round2(b.penalties || 0), round2(b.amountPaid), b.dateFiled,
    b.filingReference || null, b.paymentDate || null, b.paymentReference || null, b.paymentChannel || null, !!b.amended, current?.id || null, b.remarks || null, user?.id ?? null])).rows[0];
  return filingRow(row);
}

export async function updateFiling(db, id, b, user) {
  const f = (await db.query('SELECT * FROM bir_return_filings WHERE id = $1', [id])).rows[0];
  if (!f) throw notFound('Filing record not found');
  if (f.status !== 'filed') throw conflict(`The filing record is ${f.status}`);
  const m = { ...filingRow(f), ...b };
  const row = (await db.query(`UPDATE bir_return_filings SET date_filed = $2, filing_reference = $3, amount_paid = $4, penalties = $5, payment_date = $6, payment_reference = $7,
      payment_channel = $8, remarks = $9, updated_by = $10, updated_at = now() WHERE id = $1 RETURNING *`,
  [id, m.dateFiled, m.filingReference || null, round2(m.amountPaid), round2(m.penalties || 0), m.paymentDate || null, m.paymentReference || null, m.paymentChannel || null, m.remarks || null, user?.id ?? null])).rows[0];
  return { before: filingRow(f), after: filingRow(row) };
}

export async function cancelFiling(db, id, reason, user) {
  const f = (await db.query('UPDATE bir_return_filings SET status = \'cancelled\', cancelled_by = $2, cancelled_at = now(), cancel_reason = $3, updated_at = now() WHERE id = $1 AND status = \'filed\' RETURNING *',
    [id, user?.id ?? null, reason])).rows[0];
  if (!f) throw notFound('Active filing record not found');
  return filingRow(f);
}

export async function listFilings(db, q = {}) {
  const rows = (await db.query(`SELECT * FROM bir_return_filings WHERE ($1::int IS NULL OR year = $1) AND ($2::text IS NULL OR form_code = $2)
    ORDER BY year DESC, period_key DESC, created_at DESC LIMIT 500`, [q.year ? Number(q.year) : null, q.form || null])).rows;
  return rows.map(filingRow);
}
