/**
 * Insurance Commission reports of a broker, built from the ledger and the production records:
 *
 * IC annual statement (annualStatement / annualStatementWorkbook): the schedules of the annual statement of an
 * insurance broker as a working paper for the broker's accountant:
 *   Cover                  company, TIN, IC licence in force (licence register), period, form set (compliance.ic_statement_form)
 *   Schedule 1 Balance sheet          ledger balances at the year end on the lines of ic_statement_lines, prior year beside
 *   Schedule 2 Income statement       movements of the year (closing entries left out), prior year beside
 *   Schedule 3 Premiums and commissions by insurer and line   premiums placed (net and gross) and commission earned
 *   Schedule 4 Premiums held in trust premiums payable to each insurer at the year end against the premium trust account
 *   Accountant confirmation           the lines and checks the accountant must confirm before filing
 *   Unmapped accounts                 ledger accounts with a balance that no line takes
 * IC production report (production / productionWorkbook): premiums placed by insurer and IC line of business per month
 * or quarter, with the policy detail.
 *
 * Premiums placed: each policy issued in the period (issue date, else inception date), split by its participating
 * insurers (risk_participants; the policy's insurer at 100% when it has none), plus the premium change of completed
 * endorsements effective in the period, split by the same shares. Line of business: compliance.ic_line_map on the
 * product line (else the policy's line of business), columns in compliance.ic_lines_of_business.
 */
import { many, one, query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { legalIdentity } from '../../lib/letterhead.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';

const POSTED = "j.status IN ('posted', 'reversed')";
const r2 = (v) => round2(Number(v) || 0);

export async function icLines() {
  const v = await getSetting('compliance.ic_lines_of_business', null);
  return Array.isArray(v) && v.length ? v.map(String) : ['Fire', 'Marine', 'Motor Car', 'Casualty', 'Suretyship', 'Engineering', 'Accident and Health', 'Others'];
}
async function lineMap() {
  const v = await getSetting('compliance.ic_line_map', {});
  return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k.toLowerCase(), String(x)])) : {};
}
/** IC line of a policy: the map on the product line, then on the policy line of business; else the last column (Others). */
const icLineOf = (map, lines, ...keys) => {
  for (const k of keys) {
    const hit = k ? map[String(k).toLowerCase()] : null;
    if (hit && lines.includes(hit)) return hit;
  }
  return lines[lines.length - 1];
};

// ------------------------------------------------------------------ mapping

export async function statementLines({ all = false } = {}) {
  return many(`SELECT * FROM ic_statement_lines ${all ? '' : "WHERE status = 'active'"} ORDER BY schedule, sort_order, code`);
}
export const lineApi = (l) => ({ id: l.id, schedule: l.schedule, code: l.code, section: l.section, label: l.label, sortOrder: l.sort_order,
  accountPrefixes: l.account_prefixes || [], confirm: l.confirm, status: l.status, updatedBy: l.updated_by, updatedAt: l.updated_at });

export async function updateStatementLine(id, body, user) {
  const before = await one('SELECT * FROM ic_statement_lines WHERE id = $1', [id]);
  if (!before) throw notFound('Statement line not found');
  const prefixes = body.accountPrefixes !== undefined ? [...new Set(body.accountPrefixes.map((p) => String(p).trim()).filter(Boolean))] : before.account_prefixes;
  if (prefixes.some((p) => !/^[0-9A-Za-z.-]{1,20}$/.test(p))) throw badRequest('Validation failed', [{ path: 'accountPrefixes', message: 'An account prefix is the start of an account code (letters, digits, dot or dash)' }]);
  await query(`UPDATE ic_statement_lines SET label = $2, section = $3, sort_order = $4, account_prefixes = $5, confirm = $6, status = $7, updated_by = $8, updated_at = now() WHERE id = $1`,
    [id, body.label ?? before.label, body.section ?? before.section, body.sortOrder ?? before.sort_order, prefixes, body.confirm !== undefined ? body.confirm || null : before.confirm,
      body.status ?? before.status, user.username || user.id]);
  return { before: lineApi(before), after: lineApi(await one('SELECT * FROM ic_statement_lines WHERE id = $1', [id])) };
}

/** The line of an account: longest matching prefix among the lines of the schedule (null when none). */
function lineFor(lines, code) {
  let best = null;
  for (const l of lines) {
    for (const p of l.account_prefixes || []) {
      if (code.startsWith(p) && (!best || p.length > best.len)) best = { line: l, len: p.length };
    }
  }
  return best?.line || null;
}

// ------------------------------------------------------------------ periods

/** { from, to, priorFrom, priorTo, year } from ?year= (calendar year) or ?from=&to=. */
export function statementPeriod(q = {}) {
  let from = q.from;
  let to = q.to;
  if (!from || !to) {
    const year = Number(q.year) || new Date().getUTCFullYear() - 1;
    if (year < 2000 || year > 2100) throw badRequest('Validation failed', [{ path: 'year', message: 'Choose a reporting year' }]);
    from = `${year}-01-01`;
    to = `${year}-12-31`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw badRequest('Validation failed', [{ path: 'from', message: 'Give a valid period (from on or before to)' }]);
  const back = (d) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`.replace(/-02-29$/, '-02-28');
  return { from, to, priorFrom: back(from), priorTo: back(to), year: Number(to.slice(0, 4)) };
}

// ------------------------------------------------------------------ annual statement

async function balancesAt(date) {
  return many(`SELECT a.code, a.name, a.account_type, COALESCE(sum(CASE WHEN a.account_type = 'asset' OR a.account_type = 'expense' THEN l.debit - l.credit ELSE l.credit - l.debit END), 0) AS amount
      FROM gl_accounts a LEFT JOIN journal_lines l ON l.account_code = a.code AND EXISTS (SELECT 1 FROM journal_vouchers j WHERE j.id = l.jv_id AND ${POSTED} AND j.jv_date <= $1::date)
     GROUP BY a.code, a.name, a.account_type`, [date]);
}
async function movements(from, to) {
  return many(`SELECT a.code, a.name, a.account_type, COALESCE(sum(CASE WHEN a.account_type = 'income' THEN l.credit - l.debit ELSE l.debit - l.credit END), 0) AS amount
      FROM gl_accounts a JOIN journal_lines l ON l.account_code = a.code JOIN journal_vouchers j ON j.id = l.jv_id
     WHERE a.account_type IN ('income', 'expense') AND ${POSTED} AND j.source <> 'year-end-close' AND j.jv_date BETWEEN $1::date AND $2::date
     GROUP BY a.code, a.name, a.account_type`, [from, to]);
}

function schedule(lines, accounts, prior, unmapped) {
  const rows = new Map(lines.map((l) => [l.code, { code: l.code, section: l.section, label: l.label, current: 0, prior: 0, accounts: [], confirm: l.confirm }]));
  const take = (list, field) => {
    for (const a of list) {
      const amt = r2(a.amount);
      if (!amt) continue;
      const l = lineFor(lines, a.code);
      if (!l) { unmapped.push({ code: a.code, name: a.name, type: a.account_type, period: field, amount: amt }); continue; }
      const row = rows.get(l.code);
      row[field] = r2(row[field] + amt);
      if (!row.accounts.includes(a.code)) row.accounts.push(a.code);
    }
  };
  take(accounts, 'current');
  take(prior, 'prior');
  return [...rows.values()];
}

const sum = (rows, field, pred = () => true) => r2(rows.filter(pred).reduce((s, r) => s + r[field], 0));

/** The firm's IC licence in force on a date (licence register), for the cover. */
async function firmLicence(date) {
  return one(`SELECT licence_number, licence_type, expiry_date FROM compliance_licences WHERE holder_type = 'firm' AND status = 'active'
      AND (expiry_date IS NULL OR expiry_date >= $1::date) ORDER BY expiry_date DESC NULLS LAST LIMIT 1`, [date]);
}

export async function annualStatement(q = {}) {
  const p = statementPeriod(q);
  const all = await statementLines();
  const bsLines = all.filter((l) => l.schedule === 'balance-sheet');
  const isLines = all.filter((l) => l.schedule === 'income-statement');
  const unmapped = [];
  const [bsNow, bsPrior] = [await balancesAt(p.to), await balancesAt(p.priorTo)];
  const isNow = await movements(p.from, p.to);
  const isPrior = await movements(p.priorFrom, p.priorTo);
  const bs = schedule(bsLines, bsNow.filter((a) => ['asset', 'liability', 'equity'].includes(a.account_type)), bsPrior.filter((a) => ['asset', 'liability', 'equity'].includes(a.account_type)), unmapped);
  const is = schedule(isLines, isNow, isPrior, unmapped);
  // income and expense not closed into retained earnings at the date: the result of the year shown under equity
  const unclosed = (list) => r2(list.filter((a) => a.account_type === 'income').reduce((s, a) => s + Number(a.amount), 0) - list.filter((a) => a.account_type === 'expense').reduce((s, a) => s + Number(a.amount), 0));
  bs.push({ code: 'BS-E99', section: 'Equity', label: 'Net income for the year not yet closed to retained earnings', current: unclosed(bsNow), prior: unclosed(bsPrior), accounts: [], confirm: null });
  const totals = (field) => {
    const assets = sum(bs, field, (r) => r.section === 'Assets');
    const liabilities = sum(bs, field, (r) => r.section === 'Liabilities');
    const equity = sum(bs, field, (r) => r.section === 'Equity');
    const revenue = sum(is, field, (r) => r.section === 'Revenue');
    const cost = sum(is, field, (r) => r.section === 'Cost of services');
    const expenses = sum(is, field, (r) => ['Operating expenses', 'Other expenses'].includes(r.section));
    const tax = sum(is, field, (r) => r.section === 'Income tax');
    return { assets, liabilities, equity, liabilitiesAndEquity: r2(liabilities + equity), difference: r2(assets - liabilities - equity),
      revenue, costOfServices: cost, expenses, incomeBeforeTax: r2(revenue - cost - expenses), incomeTax: tax, netIncome: r2(revenue - cost - expenses - tax) };
  };
  const current = totals('current');
  const prior = totals('prior');
  const placed = await production({ from: p.from, to: p.to, groupBy: 'year' });
  const held = await premiumsHeld(p.to);
  const trust = bs.find((r) => r.code === 'BS-A02')?.current || 0;
  const minimumNetWorth = await getSetting('compliance.ic_minimum_net_worth', null);
  const company = await legalIdentity();
  const licence = await firmLicence(p.to);
  const checks = [
    { check: 'The balance sheet balances (assets = liabilities + equity)', ok: Math.abs(current.difference) < 0.01, detail: `Difference ${current.difference.toFixed(2)}` },
    { check: 'Every ledger account with a balance is on a line of the statement', ok: !unmapped.length, detail: unmapped.length ? `${unmapped.length} account(s) on the Unmapped accounts sheet` : 'All mapped' },
    { check: 'Premiums held for insurers are covered by the premium trust account', ok: trust + 0.005 >= held.total, detail: `Trust account ${trust.toFixed(2)}, premiums payable ${held.total.toFixed(2)}` },
    { check: 'The firm\'s IC licence is in force at the year end (licence register)', ok: !!licence, detail: licence ? `${licence.licence_type} ${licence.licence_number || ''}`.trim() : 'No licence of the firm in force on the register' },
    ...(minimumNetWorth !== null && minimumNetWorth !== undefined && minimumNetWorth !== '' ? [{ check: 'Net worth at or above the minimum set in compliance.ic_minimum_net_worth', ok: current.equity >= Number(minimumNetWorth), detail: `Equity ${current.equity.toFixed(2)}, minimum ${Number(minimumNetWorth).toFixed(2)}` }] : []),
  ];
  return {
    period: p, form: (await getSetting('compliance.ic_statement_form', null)) || 'Annual Statement of an Insurance Broker',
    company: { name: company.name, tin: company.tin, address: company.address, icLicence: licence ? { number: licence.licence_number, type: licence.licence_type, expiryDate: licence.expiry_date } : null },
    balanceSheet: bs, incomeStatement: is, totals: { current, prior }, premiumsByInsurerAndLine: placed, premiumsHeld: held, trustAccount: trust,
    confirmations: [...bs, ...is].filter((r) => r.confirm).map((r) => ({ code: r.code, label: r.label, amount: r.current, confirm: r.confirm })),
    checks, unmapped,
  };
}

/** Premiums payable to each insurer at a date (ledger lines of the premium payable lines BS-L01, by the insurer of the line or of its policy). */
export async function premiumsHeld(date) {
  const line = await one("SELECT account_prefixes FROM ic_statement_lines WHERE code = 'BS-L01' AND status = 'active'");
  const prefixes = line?.account_prefixes?.length ? line.account_prefixes : ['22010'];
  const rows = await many(`SELECT COALESCE(l.insurance_company_id, p.insurance_company_id) AS insurer_id, ic.name AS insurer, sum(l.credit - l.debit) AS amount
      FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id LEFT JOIN policies p ON p.id = l.policy_id
      LEFT JOIN insurance_companies ic ON ic.id = COALESCE(l.insurance_company_id, p.insurance_company_id)
     WHERE ${POSTED} AND j.jv_date <= $1::date AND EXISTS (SELECT 1 FROM unnest($2::text[]) x WHERE l.account_code LIKE x || '%')
     GROUP BY 1, 2 HAVING round(sum(l.credit - l.debit), 2) <> 0 ORDER BY 2 NULLS LAST`, [date, prefixes]);
  const items = rows.map((r) => ({ insurerId: r.insurer_id, insurer: r.insurer || 'Not attributed to an insurer', amount: r2(r.amount) }));
  return { items, total: r2(items.reduce((s, r) => s + r.amount, 0)) };
}

// ------------------------------------------------------------------ production

const periodKey = (d, groupBy) => {
  if (groupBy === 'year') return d.slice(0, 4);
  if (groupBy === 'quarter') return `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
  return d.slice(0, 7);
};

/** Premiums placed: { lines, periods, rows (insurer x line), byPeriod (period x line), detail, totals }. */
export async function production(q = {}) {
  const p = q.from && q.to ? { from: q.from, to: q.to } : statementPeriod(q);
  const groupBy = ['month', 'quarter', 'year'].includes(q.groupBy) ? q.groupBy : 'month';
  const lines = await icLines();
  const map = await lineMap();
  const policies = await many(`SELECT p.id, p.policy_number, COALESCE(p.issued_date, p.inception_date)::text AS basis_date, p.lob, p.product_type, pr.line AS product_line,
      p.insured_name, p.net_premium, p.premium_total, p.commission_amount, p.insurance_company_id, p.currency
    FROM policies p LEFT JOIN products pr ON pr.id = p.product_id
    WHERE p.status <> 'cancelled' AND COALESCE(p.issued_date, p.inception_date) BETWEEN $1::date AND $2::date`, [p.from, p.to]);
  const endorsements = await many(`SELECT e.id, e.policy_id, e.premium_delta, COALESCE(e.effective_date, e.updated_at::date)::text AS basis_date, p.policy_number, p.lob, p.product_type, pr.line AS product_line,
      p.insured_name, p.insurance_company_id, p.premium_total, p.commission_amount
    FROM endorsements e JOIN policies p ON p.id = e.policy_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE e.status = 'completed' AND e.premium_delta <> 0 AND COALESCE(e.effective_date, e.updated_at::date) BETWEEN $1::date AND $2::date`, [p.from, p.to]);
  const ids = [...new Set([...policies.map((x) => x.id), ...endorsements.map((x) => x.policy_id)])];
  const parts = ids.length ? await many(`SELECT rp.entity_id AS policy_id, rp.insurance_company_id, rp.share_percent, rp.premium, rp.premium_total, rp.commission_amount
      FROM risk_participants rp WHERE rp.entity_type = 'policy' AND rp.entity_id = ANY($1::text[]) AND rp.status <> 'removed'`, [ids]) : [];
  const insurers = new Map((await many('SELECT id, code, name FROM insurance_companies')).map((r) => [r.id, r]));
  const byPolicy = new Map();
  for (const x of parts) byPolicy.set(x.policy_id, [...(byPolicy.get(x.policy_id) || []), x]);
  const detail = [];
  for (const pol of policies) {
    const line = icLineOf(map, lines, pol.product_line, pol.lob, pol.product_type);
    const net = Number(pol.net_premium) > 0 ? Number(pol.net_premium) : Number(pol.premium_total);
    const shares = byPolicy.get(pol.id) || [{ insurance_company_id: pol.insurance_company_id, share_percent: 100, premium: net, premium_total: pol.premium_total, commission_amount: pol.commission_amount }];
    for (const s of shares) {
      const pct = Number(s.share_percent) / 100;
      detail.push({ kind: 'Policy', reference: pol.policy_number, date: pol.basis_date, period: periodKey(pol.basis_date, groupBy), insurerId: s.insurance_company_id,
        insurer: insurers.get(s.insurance_company_id)?.name || 'Unknown insurer', line, product: pol.product_type || pol.product_line || '', insured: pol.insured_name || '',
        sharePercent: Number(s.share_percent), netPremium: r2(Number(s.premium) > 0 ? s.premium : net * pct), grossPremium: r2(Number(s.premium_total) > 0 ? s.premium_total : Number(pol.premium_total) * pct),
        commission: r2(Number(s.commission_amount) > 0 ? s.commission_amount : Number(pol.commission_amount) * pct) });
    }
  }
  for (const e of endorsements) {
    const line = icLineOf(map, lines, e.product_line, e.lob, e.product_type);
    const shares = byPolicy.get(e.policy_id) || [{ insurance_company_id: e.insurance_company_id, share_percent: 100 }];
    const rate = Number(e.premium_total) > 0 ? Number(e.commission_amount) / Number(e.premium_total) : 0;
    for (const s of shares) {
      const pct = Number(s.share_percent) / 100;
      detail.push({ kind: 'Endorsement', reference: e.policy_number, date: e.basis_date, period: periodKey(e.basis_date, groupBy), insurerId: s.insurance_company_id,
        insurer: insurers.get(s.insurance_company_id)?.name || 'Unknown insurer', line, product: e.product_type || e.product_line || '', insured: e.insured_name || '',
        sharePercent: Number(s.share_percent), netPremium: r2(Number(e.premium_delta) * pct), grossPremium: r2(Number(e.premium_delta) * pct), commission: r2(Number(e.premium_delta) * pct * rate) });
    }
  }
  detail.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.reference.localeCompare(b.reference)));
  const zero = () => Object.fromEntries(lines.map((l) => [l, 0]));
  const rows = new Map();
  const byPeriod = new Map();
  for (const d of detail) {
    const r = rows.get(d.insurer) || { insurer: d.insurer, insurerId: d.insurerId, premium: zero(), totalPremium: 0, grossPremium: 0, commission: 0, policies: new Set() };
    r.premium[d.line] = r2(r.premium[d.line] + d.netPremium);
    r.totalPremium = r2(r.totalPremium + d.netPremium);
    r.grossPremium = r2(r.grossPremium + d.grossPremium);
    r.commission = r2(r.commission + d.commission);
    if (d.kind === 'Policy') r.policies.add(d.reference);
    rows.set(d.insurer, r);
    const b = byPeriod.get(d.period) || { period: d.period, premium: zero(), totalPremium: 0, commission: 0 };
    b.premium[d.line] = r2(b.premium[d.line] + d.netPremium);
    b.totalPremium = r2(b.totalPremium + d.netPremium);
    b.commission = r2(b.commission + d.commission);
    byPeriod.set(d.period, b);
  }
  const insurerRows = [...rows.values()].map((r) => ({ ...r, policies: r.policies.size })).sort((a, b) => a.insurer.localeCompare(b.insurer));
  const totals = { premium: zero(), totalPremium: 0, grossPremium: 0, commission: 0, policies: new Set(detail.filter((d) => d.kind === 'Policy').map((d) => d.reference)).size };
  for (const r of insurerRows) {
    for (const l of lines) totals.premium[l] = r2(totals.premium[l] + r.premium[l]);
    totals.totalPremium = r2(totals.totalPremium + r.totalPremium);
    totals.grossPremium = r2(totals.grossPremium + r.grossPremium);
    totals.commission = r2(totals.commission + r.commission);
  }
  return { from: p.from, to: p.to, groupBy, lines, rows: insurerRows, byPeriod: [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period)), detail, totals };
}

// ------------------------------------------------------------------ workbooks

const money = (key, header, width = 16) => ({ key, header, type: 'money', width });
const text = (key, header, width = 30) => ({ key, header, width });

function productionSheets(pr, title) {
  const lineCols = pr.lines.map((l, i) => money(`l${i}`, l));
  const flat = (r, extra) => ({ ...extra, ...Object.fromEntries(pr.lines.map((l, i) => [`l${i}`, r.premium[l]])) });
  return [
    { name: `${title} by insurer`, columns: [text('insurer', 'Insurer', 40), ...lineCols, money('total', 'Total premiums'), money('gross', 'Gross premiums (with taxes)'), money('commission', 'Commission earned'), { key: 'policies', header: 'Policies', type: 'integer', width: 10 }],
      rows: [...pr.rows.map((r) => flat(r, { insurer: r.insurer, total: r.totalPremium, gross: r.grossPremium, commission: r.commission, policies: r.policies })),
        flat(pr.totals, { insurer: 'TOTAL', total: pr.totals.totalPremium, gross: pr.totals.grossPremium, commission: pr.totals.commission, policies: pr.totals.policies })],
      rowStyles: [...pr.rows.map(() => null), 'bold'] },
    { name: `${title} by period`, columns: [text('period', pr.groupBy === 'quarter' ? 'Quarter' : pr.groupBy === 'year' ? 'Year' : 'Month', 14), ...lineCols, money('total', 'Total premiums'), money('commission', 'Commission earned')],
      rows: pr.byPeriod.map((b) => flat(b, { period: b.period, total: b.totalPremium, commission: b.commission })) },
    { name: 'Detail', columns: [text('kind', 'Kind', 12), text('reference', 'Policy', 20), { key: 'date', header: 'Date', type: 'date', width: 12 }, text('insurer', 'Insurer', 34),
      { key: 'sharePercent', header: 'Share %', type: 'number', width: 9 }, text('line', 'IC line', 18), text('product', 'Product', 24), text('insured', 'Insured', 30),
      money('netPremium', 'Premium'), money('grossPremium', 'Gross premium'), money('commission', 'Commission')], rows: pr.detail },
  ];
}

export async function productionWorkbook(q) {
  const pr = await production(q);
  const company = await legalIdentity();
  const cover = { name: 'Report', columns: [text('k', 'Item', 34), text('v', 'Value', 70)], rows: [
    { k: 'Report', v: 'Production report: premiums placed by insurer and line of business' }, { k: 'Broker', v: company.name }, { k: 'TIN', v: company.tin },
    { k: 'Period', v: `${pr.from} to ${pr.to}` }, { k: 'Grouped by', v: pr.groupBy }, { k: 'Basis', v: 'Policies by issue date (inception date when not issued), endorsements by effective date; co-insured policies split by share' },
    { k: 'Generated', v: new Date().toISOString().slice(0, 19).replace('T', ' ') }] };
  return { data: pr, sheets: [cover, ...productionSheets(pr, 'Premiums')] };
}

export async function annualStatementWorkbook(q) {
  const s = await annualStatement(q);
  const amountCols = [text('code', 'Line', 9), text('label', 'Account title', 56), money('current', `${s.period.to}`), money('prior', `${s.period.priorTo}`), text('accounts', 'Ledger accounts', 40)];
  const scheduleRows = (rows, sections, totalsFor) => {
    const out = [];
    const styles = [];
    for (const sec of sections) {
      out.push({ code: '', label: sec.toUpperCase() });
      styles.push('bold');
      for (const r of rows.filter((x) => x.section === sec)) { out.push({ ...r, accounts: r.accounts.join(', ') }); styles.push(null); }
      const t = totalsFor(sec);
      if (t) { out.push({ code: '', label: t.label, current: t.current, prior: t.prior }); styles.push('bold'); }
    }
    return { rows: out, rowStyles: styles };
  };
  const sectionTotal = (rows) => (sec) => ({ label: `Total ${sec.toLowerCase()}`, current: sum(rows, 'current', (r) => r.section === sec), prior: sum(rows, 'prior', (r) => r.section === sec) });
  const bs = scheduleRows(s.balanceSheet, ['Assets', 'Liabilities', 'Equity'], sectionTotal(s.balanceSheet));
  bs.rows.push({ code: '', label: 'TOTAL LIABILITIES AND EQUITY', current: s.totals.current.liabilitiesAndEquity, prior: s.totals.prior.liabilitiesAndEquity });
  bs.rowStyles.push('bold');
  const is = scheduleRows(s.incomeStatement, ['Revenue', 'Cost of services', 'Operating expenses', 'Other expenses', 'Income tax'], sectionTotal(s.incomeStatement));
  is.rows.push({ code: '', label: 'INCOME BEFORE INCOME TAX', current: s.totals.current.incomeBeforeTax, prior: s.totals.prior.incomeBeforeTax },
    { code: '', label: 'NET INCOME', current: s.totals.current.netIncome, prior: s.totals.prior.netIncome });
  is.rowStyles.push('bold', 'bold');
  const lic = s.company.icLicence;
  const cover = { name: 'Cover', columns: [text('k', 'Item', 36), text('v', 'Value', 80)], rows: [
    { k: 'Statement', v: s.form }, { k: 'Insurance broker', v: s.company.name }, { k: 'TIN', v: s.company.tin }, { k: 'Address', v: s.company.address },
    { k: 'IC licence', v: lic ? `${lic.type} ${lic.number || ''}${lic.expiryDate ? `, valid until ${lic.expiryDate}` : ''}`.trim() : 'No licence of the firm in force on the licence register' },
    { k: 'Reporting period', v: `${s.period.from} to ${s.period.to}` }, { k: 'Comparative period', v: `${s.period.priorFrom} to ${s.period.priorTo}` },
    { k: 'Schedules', v: '1 Balance sheet; 2 Income statement; 3 Premiums and commissions by insurer and line; 4 Premiums held in trust; Accountant confirmation; Unmapped accounts' },
    { k: 'Status', v: 'Working paper generated from the ledger and the production records. The broker\'s accountant confirms the lines and checks on the Accountant confirmation sheet and transcribes the figures onto the IC form set in force before filing.' },
    { k: 'Generated', v: new Date().toISOString().slice(0, 19).replace('T', ' ') }] };
  const held = { name: 'Sch 4 Premiums held', columns: [text('insurer', 'Insurer', 44), money('amount', 'Premiums payable to the insurer')],
    rows: [...s.premiumsHeld.items, { insurer: 'TOTAL PREMIUMS HELD FOR INSURERS', amount: s.premiumsHeld.total }, { insurer: 'Premium trust account (BS-A02)', amount: s.trustAccount },
      { insurer: 'Excess (shortfall) of the trust account', amount: round2(s.trustAccount - s.premiumsHeld.total) }],
    rowStyles: [...s.premiumsHeld.items.map(() => null), 'bold', null, 'bold'] };
  const confirm = { name: 'Accountant confirmation', columns: [text('ref', 'Line / check', 12), text('item', 'Item', 60), money('amount', 'Amount'), text('status', 'System check', 12), text('note', 'To confirm', 70), text('by', 'Confirmed by / date', 22)],
    rows: [...s.checks.map((c, i) => ({ ref: `C${i + 1}`, item: c.check, status: c.ok ? 'OK' : 'REVIEW', note: c.detail })),
      ...s.confirmations.map((c) => ({ ref: c.code, item: c.label, amount: c.amount, status: '', note: c.confirm })),
      { ref: 'Sch 3', item: 'Premiums placed and commission by insurer and line', amount: s.premiumsByInsurerAndLine.totals.totalPremium, status: '', note: 'Agree with the production register and the insurers\' statements; commission earned agrees with the income statement line IS-R01 after accruals' }],
    cellStyle: (r, c) => (c === 3 && r < s.checks.length ? (s.checks[r].ok ? 'good' : 'bad') : null) };
  const unmapped = { name: 'Unmapped accounts', columns: [text('code', 'Account', 14), text('name', 'Account name', 50), text('type', 'Type', 12), text('period', 'Period', 10), money('amount', 'Amount')], rows: s.unmapped };
  return { data: s, sheets: [cover, { name: 'Sch 1 Balance sheet', columns: amountCols, ...bs }, { name: 'Sch 2 Income statement', columns: amountCols, ...is },
    ...productionSheets(s.premiumsByInsurerAndLine, 'Sch 3').slice(0, 1), held, confirm, unmapped] };
}
