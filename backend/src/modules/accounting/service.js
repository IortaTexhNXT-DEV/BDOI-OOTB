/** Ledger queries (entries, client / policy ledgers, trial balance), open-entry matching, periods, chart of accounts, payment entries. */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { account, createJournal, periodOf } from './lib/ledger.js';
import { isoDate, num, round2, today } from './lib/http.js';
import { applyToPolicy, ensureBilled, requirePolicy, findClient } from '../receipts/receivables.js';

const STATUS_LABEL = { posted: 'Posted', pending: 'Pending', draft: 'Pending', 'for-approval': 'Pending', approved: 'Pending', reversed: 'Reversed', cancelled: 'Cancelled', rejected: 'Cancelled' };
const STATUS_FILTER = { Posted: ['posted'], Pending: ['pending', 'draft', 'for-approval', 'approved'], Reversed: ['reversed'], Cancelled: ['cancelled', 'rejected'] };

export const ENTRY_SQL = `SELECT l.id, l.jv_id, l.line_no, l.account_code, COALESCE(a.name, l.account_name) AS account_name, a.parent_code, a.account_type, l.debit, l.credit,
  l.memo, COALESCE(l.due_date, j.due_date) AS due_date, l.currency_code, j.jv_number, j.jv_date, j.description, j.status, j.source, j.entry_type, j.entry_sub_type,
  j.transaction_code, j.reference_type, j.reference_id, j.currency, COALESCE(l.client_id, j.client_id) AS client_id, COALESCE(l.policy_id, j.policy_id) AS policy_id,
  COALESCE(p.policy_number, j.policy_number) AS policy_number, c.client_code, c.first_name, c.last_name, c.display_name
  FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id LEFT JOIN gl_accounts a ON a.code = l.account_code
  LEFT JOIN clients c ON c.id = COALESCE(l.client_id, j.client_id) LEFT JOIN policies p ON p.id = COALESCE(l.policy_id, j.policy_id)`;

export const entryRow = (e) => {
  const debit = Number(e.debit) > 0;
  return {
    id: String(e.id), entryId: String(e.id), transactionId: e.jv_id, journalId: e.jv_id, transactionCode: e.jv_number, transactionNumber: e.jv_number,
    sourceTransactionCode: e.transaction_code, entryType: e.entry_type, entrySubType: e.entry_sub_type, debitCredit: debit ? 'DEBIT' : 'CREDIT',
    amount: debit ? Number(e.debit) : Number(e.credit), debit: Number(e.debit), credit: Number(e.credit), accountCode: e.account_code, accountName: e.account_name,
    account: { accountCode: e.account_code, accountName: e.account_name, accountType: e.account_type }, glCode: e.account_code, mainAccount: e.parent_code || e.account_code,
    description: e.memo || e.description, narration: e.description, documentDate: e.jv_date, dueDate: e.due_date, status: STATUS_LABEL[e.status] || e.status,
    motherPolicyId: e.policy_id, motherPolicyNumber: e.policy_number, policyId: e.policy_id, policyNumber: e.policy_number, clientId: e.client_id,
    client: e.client_id ? { id: e.client_id, clientId: e.client_code, firstName: e.first_name, lastName: e.last_name, displayName: e.display_name } : null,
    referenceType: e.reference_type, referenceId: e.reference_id, source: e.source, currency: e.currency_code || e.currency,
  };
};

/** WHERE builder over ENTRY_SQL aliases from the common query filters. */
export function entryWhere(q) {
  const where = ['j.status <> \'cancelled\'']; const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replaceAll('?', `$${p.length}`)); };
  if (q.policyId) add('(COALESCE(l.policy_id, j.policy_id) = ? OR j.policy_number = ? OR p.policy_number = ?)', q.policyId);
  if (q.clientId) add('(COALESCE(l.client_id, j.client_id) = ? OR c.client_code = ?)', q.clientId);
  if (q.clientName) add('c.display_name ILIKE \'%\' || ? || \'%\'', q.clientName);
  if (q.entryType) add('j.entry_type = ?', q.entryType);
  if (q.referenceType) add('j.reference_type = ?', q.referenceType);
  if (q.status) {
    const st = STATUS_FILTER[q.status] || [String(q.status).toLowerCase()];
    add('j.status = ANY(?)', st);
    where.splice(0, 1);
  }
  if (q.glCode) add('(l.account_code LIKE ? || \'%\')', q.glCode);
  if (q.accountCode) add('l.account_code = ?', q.accountCode);
  if (q.debitCredit === 'DEBIT') where.push('l.debit > 0');
  if (q.debitCredit === 'CREDIT') where.push('l.credit > 0');
  if (q.currency) add('COALESCE(l.currency_code, j.currency) = ?', q.currency);
  if (q.startDate) add('j.jv_date >= ?::date', isoDate(q.startDate));
  if (q.endDate) add('j.jv_date <= ?::date', isoDate(q.endDate));
  if (q.transactionCode) add('(j.jv_number = ? OR j.transaction_code = ?)', q.transactionCode);
  return { where: `WHERE ${where.join(' AND ')}`, params: p };
}

export async function searchEntries(db, q, pg) {
  const { where, params } = entryWhere(q);
  const base = `FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id LEFT JOIN clients c ON c.id = COALESCE(l.client_id, j.client_id) LEFT JOIN policies p ON p.id = COALESCE(l.policy_id, j.policy_id)`;
  const t = (await db.query(`SELECT count(*)::int AS n, COALESCE(sum(l.debit),0) AS d, COALESCE(sum(l.credit),0) AS c ${base} ${where}`, params)).rows[0];
  const sql = `${ENTRY_SQL} ${where} ORDER BY j.jv_date DESC, j.created_at DESC, l.line_no`;
  const rows = pg ? (await db.query(`${sql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset])).rows : (await db.query(sql, params)).rows;
  return { rows: rows.map(entryRow), total: t.n, totals: { totalDebits: round2(t.d), totalCredits: round2(t.c), balance: round2(t.d - t.c) } };
}

/** Ledger (oldest first) with a running balance. */
export async function ledger(db, q) {
  const { where, params } = entryWhere(q);
  const rows = (await db.query(`${ENTRY_SQL} ${where} ORDER BY j.jv_date, j.created_at, l.line_no`, params)).rows;
  let bal = 0;
  const data = rows.map((r) => { bal = round2(bal + Number(r.debit) - Number(r.credit)); return { ...entryRow(r), runningBalance: bal }; });
  const d = round2(rows.reduce((s, r) => s + Number(r.debit), 0)); const c = round2(rows.reduce((s, r) => s + Number(r.credit), 0));
  return { data, totals: { totalDebits: d, totalCredits: c, balance: round2(d - c), count: rows.length } };
}

export async function allClientsAccounting(db, q, pg) {
  const { where, params } = entryWhere(q);
  const clientWhere = `${where} AND COALESCE(l.client_id, j.client_id) IS NOT NULL`;
  const grouped = (await db.query(`SELECT COALESCE(l.client_id, j.client_id) AS client_id, count(*)::int AS n, sum(l.debit) AS d, sum(l.credit) AS c
    FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id LEFT JOIN clients c ON c.id = COALESCE(l.client_id, j.client_id) LEFT JOIN policies p ON p.id = COALESCE(l.policy_id, j.policy_id)
    ${clientWhere} GROUP BY 1`, params)).rows;
  const clients = new Map((await db.query('SELECT id, client_code, display_name FROM clients WHERE id = ANY($1)', [grouped.map((g) => g.client_id)])).rows.map((c) => [c.id, c]));
  grouped.sort((a, b) => String(clients.get(a.client_id)?.display_name).localeCompare(String(clients.get(b.client_id)?.display_name)));
  const page = grouped.slice(pg.offset, pg.offset + pg.limit);
  const data = [];
  for (const g of page) {
    const tx = (await db.query(`${ENTRY_SQL} ${where} AND COALESCE(l.client_id, j.client_id) = $${params.length + 1} ORDER BY j.jv_date DESC, l.line_no`, [...params, g.client_id])).rows;
    const cl = clients.get(g.client_id) || {};
    data.push({ clientId: g.client_id, clientNumber: cl.client_code, clientName: cl.display_name, totalTransactions: g.n,
      summary: { totalDebits: round2(g.d), totalCredits: round2(g.c), balance: round2(g.d - g.c) }, transactions: tx.map(entryRow) });
  }
  const gd = round2(grouped.reduce((s, g) => s + Number(g.d), 0)); const gc = round2(grouped.reduce((s, g) => s + Number(g.c), 0));
  return { data, total: grouped.length, totals: { totalClients: grouped.length, totalTransactions: grouped.reduce((s, g) => s + g.n, 0), grandTotalDebits: gd, grandTotalCredits: gc, grandTotalBalance: round2(gd - gc) } };
}

// ---------- open-entry matching ----------
const REMAINING = `(CASE WHEN l.debit > 0 THEN l.debit ELSE l.credit END) - COALESCE((SELECT sum(m.matched_amount) FROM entry_matches m WHERE m.status = 'active' AND (m.debit_line_id = l.id OR m.credit_line_id = l.id)), 0)`;

export async function unmatchedEntries(db, q) {
  const { where, params } = entryWhere({ ...q, status: 'Posted' });
  const rows = (await db.query(`SELECT * FROM (${ENTRY_SQL.replace('SELECT l.id,', `SELECT ${REMAINING} AS remaining, a.is_open_item, l.id,`)} ${where}) x
    WHERE x.is_open_item AND x.remaining > 0 ORDER BY x.jv_date, x.id LIMIT 500`, params)).rows;
  return rows.map((r) => ({ ...entryRow(r), originalAmount: Number(r.debit) > 0 ? Number(r.debit) : Number(r.credit), amount: round2(r.remaining) }));
}

export async function matchEntries(db, pairs, meta, user) {
  const out = [];
  for (const pr of pairs) {
    const lines = (await db.query(`SELECT l.*, a.is_open_item, j.status, ${REMAINING} AS remaining FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
      JOIN gl_accounts a ON a.code = l.account_code WHERE l.id = ANY($1) FOR UPDATE OF l`, [[Number(pr.debitTransactionId), Number(pr.creditTransactionId)]])).rows;
    const dr = lines.find((l) => String(l.id) === String(pr.debitTransactionId));
    const cr = lines.find((l) => String(l.id) === String(pr.creditTransactionId));
    if (!dr || !cr) throw notFound('Entry not found');
    if (!(Number(dr.debit) > 0) || !(Number(cr.credit) > 0)) throw badRequest('Match a debit entry against a credit entry');
    if (dr.account_code !== cr.account_code) throw badRequest(`Entries are on different accounts (${dr.account_code} / ${cr.account_code})`);
    if (!dr.is_open_item || dr.status !== 'posted' || cr.status !== 'posted') throw badRequest('Only posted entries on open-item accounts can be matched');
    const amount = round2(num(pr.matchedAmount) || Math.min(Number(dr.remaining), Number(cr.remaining)));
    if (!(amount > 0) || amount > round2(dr.remaining) || amount > round2(cr.remaining)) throw badRequest(`Matched amount ${amount} exceeds the unmatched balance`);
    const m = (await db.query(`INSERT INTO entry_matches(debit_line_id, credit_line_id, matched_amount, adjustment_amount, document_ref, narration, write_off_code, matched_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [dr.id, cr.id, amount, pr.adjustmentAmount == null ? null : round2(num(pr.adjustmentAmount)), meta.documentRef || null,
      meta.narration || null, meta.writeOffCode || null, user.id])).rows[0];
    out.push({ id: m.id, matchingId: m.id, debitTransactionId: String(dr.id), creditTransactionId: String(cr.id), matchedAmount: Number(m.matched_amount), matchedDate: m.matched_at });
  }
  return out;
}

export async function matchedEntries(db, q) {
  const rows = (await db.query(`SELECT m.* FROM entry_matches m JOIN journal_lines l ON l.id = m.debit_line_id JOIN journal_vouchers j ON j.id = l.jv_id
    WHERE m.status = 'active' AND ($1::text IS NULL OR COALESCE(l.currency_code, j.currency) = $1) ORDER BY m.matched_at DESC LIMIT 500`, [q.currency || null])).rows;
  const ids = rows.flatMap((m) => [m.debit_line_id, m.credit_line_id]);
  const lines = new Map((await db.query(`${ENTRY_SQL} WHERE l.id = ANY($1)`, [ids])).rows.map((e) => [Number(e.id), entryRow(e)]));
  return rows.map((m) => ({ id: m.id, matchedAmount: Number(m.matched_amount), matchedDate: m.matched_at, documentRef: m.document_ref, narration: m.narration,
    adjustmentAmount: m.adjustment_amount === null ? null : Number(m.adjustment_amount), debitTransaction: lines.get(Number(m.debit_line_id)), creditTransaction: lines.get(Number(m.credit_line_id)) }));
}

export async function unmatch(db, ids, user) {
  const r = await db.query('UPDATE entry_matches SET status = \'unmatched\', unmatched_by = $2, unmatched_at = now() WHERE id = ANY($1) AND status = \'active\' RETURNING id', [ids, user.id]);
  if (!r.rowCount) throw notFound('No active matches found for the given ids');
  return r.rows.map((x) => x.id);
}

// ---------- trial balance, periods, chart of accounts ----------
export async function trialBalance(db, q) {
  const asOf = isoDate(q.asOf) || (q.period ? (await db.query('SELECT (to_date($1, \'YYYY-MM\') + interval \'1 month - 1 day\')::date AS d', [q.period])).rows[0].d : today());
  const from = isoDate(q.from) || null;
  const rows = (await db.query(`SELECT a.code, a.name, a.account_type, COALESCE(sum(l.debit),0) AS d, COALESCE(sum(l.credit),0) AS c
    FROM gl_accounts a LEFT JOIN journal_lines l ON l.account_code = a.code AND EXISTS (SELECT 1 FROM journal_vouchers j WHERE j.id = l.jv_id
      AND j.status IN ('posted','reversed') AND j.jv_date <= $1 AND ($2::date IS NULL OR j.jv_date >= $2))
    GROUP BY a.code, a.name, a.account_type HAVING COALESCE(sum(l.debit),0) <> 0 OR COALESCE(sum(l.credit),0) <> 0 ORDER BY a.code`, [asOf, from])).rows;
  const data = rows.map((r) => {
    const net = round2(Number(r.d) - Number(r.c));
    return { accountCode: r.code, accountName: r.name, accountType: r.account_type, totalDebit: round2(r.d), totalCredit: round2(r.c), debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0, balance: net };
  });
  const debit = round2(data.reduce((s, r) => s + r.debit, 0)); const credit = round2(data.reduce((s, r) => s + r.credit, 0));
  return { asOf, from, rows: data, totals: { debit, credit, difference: round2(debit - credit), balanced: debit === credit } };
}

export async function listPeriods(db) {
  const rows = (await db.query(`SELECT to_char(d, 'YYYY-MM') AS period FROM generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') d`)).rows;
  const stored = new Map((await db.query('SELECT * FROM accounting_periods')).rows.map((p) => [p.period, p]));
  const all = new Set([...rows.map((r) => r.period), ...stored.keys()]);
  return [...all].sort().reverse().map((period) => {
    const s = stored.get(period);
    return { period, status: s?.status || 'open', closedBy: s?.closed_by || null, closedAt: s?.closed_at || null, reopenedBy: s?.reopened_by || null, reopenedAt: s?.reopened_at || null, remarks: s?.remarks || null };
  });
}

export async function setPeriodStatus(db, period, status, remarks, user) {
  if (!/^\d{4}-\d{2}$/.test(period)) throw badRequest('period must be YYYY-MM');
  if (status === 'closed') {
    const open = (await db.query(`SELECT count(*)::int AS n FROM journal_vouchers WHERE period = $1 AND status IN ('pending','draft','for-approval','approved')`, [period])).rows[0].n;
    if (open) throw conflict(`Period ${period} has ${open} unposted journal(s); post or cancel them before closing`);
    if (period >= periodOf(today()) && !(remarks || '').length) throw badRequest('Closing the current or a future period requires remarks');
    await db.query(`INSERT INTO accounting_periods(period, status, closed_by, closed_at, remarks) VALUES ($1,'closed',$2,now(),$3)
      ON CONFLICT (period) DO UPDATE SET status = 'closed', closed_by = $2, closed_at = now(), remarks = COALESCE($3, accounting_periods.remarks), updated_at = now()`, [period, user.id, remarks || null]);
  } else {
    await db.query(`INSERT INTO accounting_periods(period, status, reopened_by, reopened_at, remarks) VALUES ($1,'open',$2,now(),$3)
      ON CONFLICT (period) DO UPDATE SET status = 'open', reopened_by = $2, reopened_at = now(), remarks = COALESCE($3, accounting_periods.remarks), updated_at = now()`, [period, user.id, remarks || null]);
  }
  return (await listPeriods(db)).find((p) => p.period === period);
}

export const accountRow = (a) => ({ code: a.code, accountCode: a.code, name: a.name, accountName: a.name, accountType: a.account_type, parentCode: a.parent_code, category: a.category,
  isOpenItem: a.is_open_item, allowManual: a.allow_manual, status: a.status });

export async function upsertAccount(db, code, b) {
  const exists = (await db.query('SELECT * FROM gl_accounts WHERE code = $1', [code])).rows[0];
  if (b.parentCode) {
    const parent = (await db.query('SELECT 1 FROM gl_accounts WHERE code = $1', [b.parentCode])).rows[0];
    if (!parent) throw badRequest(`Parent account ${b.parentCode} not found`);
  }
  if (exists) {
    if (b.status === 'inactive') {
      const bal = (await db.query('SELECT COALESCE(sum(debit - credit),0) AS b FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id WHERE l.account_code = $1 AND j.status IN (\'posted\',\'reversed\')', [code])).rows[0].b;
      if (round2(bal) !== 0) throw conflict(`Account ${code} has a balance of ${bal}; it cannot be deactivated`);
    }
    return (await db.query(`UPDATE gl_accounts SET name = COALESCE($2,name), account_type = COALESCE($3,account_type), parent_code = COALESCE($4,parent_code), category = COALESCE($5,category),
      is_open_item = COALESCE($6,is_open_item), allow_manual = COALESCE($7,allow_manual), status = COALESCE($8,status), updated_at = now() WHERE code = $1 RETURNING *`,
    [code, b.name, b.accountType, b.parentCode, b.category, b.isOpenItem, b.allowManual, b.status])).rows[0];
  }
  if (!b.name || !b.accountType) throw badRequest('name and accountType are required for a new account');
  return (await db.query(`INSERT INTO gl_accounts(code, name, account_type, parent_code, category, is_open_item, allow_manual, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [code, b.name, b.accountType, b.parentCode || null, b.category || null, !!b.isOpenItem, b.allowManual !== false, b.status || 'active'])).rows[0];
}

// ---------- payment entries (agent payment confirmation flows) ----------
/**
 * Record a premium payment for a policy. Bills the policy if needed (booking journal) and applies the part of `amount`
 * that is still outstanding (a receipt created in the same flow may already have applied it). Direct-billed policies
 * (client paid the insurer) book Dr Commission Receivable / Cr Commission Income once.
 */
export async function paymentEntries(db, b, user) {
  const policy = await requirePolicy(db, b.policyId || b.policyNumber || b.referenceId);
  if (b.clientId && !(await findClient(db, b.clientId))) throw notFound('Client not found');
  const amount = round2(num(b.amount));
  const breakdown = { netPremium: num(b.netPremium), vat: num(b.valueAddedTax), dst: num(b.documentaryStampTax), lgt: num(b.localGovernmentTax), other: num(b.accountPremiumOthers), discount: num(b.discount) };
  const journals = [];
  if (b.isDirectBilled) {
    const done = (await db.query('SELECT id FROM journal_vouchers WHERE entry_type = \'DIRECT_BILLED\' AND policy_id = $1 AND status IN (\'posted\',\'pending\')', [policy.id])).rows[0];
    if (!done) {
      const rate = Number(policy.insurer_commission_rate) || Number(await getSetting('commission.default_rate', 0.15));
      const commission = round2(Number(policy.commission_amount) > 0 ? Number(policy.commission_amount) : (breakdown.netPremium || amount) * rate);
      const jv = await createJournal(db, { source: 'booking', entryType: 'DIRECT_BILLED', referenceType: b.referenceType || 'Policy', referenceId: policy.id, clientId: policy.client_id,
        policyId: policy.id, policyNumber: policy.policy_number, description: b.description || `Direct-billed commission – ${policy.policy_number}`, date: isoDate(b.paymentDate) || today(),
        lines: [{ accountCode: await account('commission_receivable'), debit: commission, memo: `Commission due from ${policy.insurer_name || 'insurer'}` },
          { accountCode: await account('commission_income'), credit: commission, memo: 'Brokerage commission (direct billed)' }] }, user);
      journals.push(jv.id);
    }
    return { journals, applied: 0, alreadyApplied: !!done, directBilled: true };
  }
  const open = await ensureBilled(db, { policy, amount: round2(num(b.grossPremium) || amount), breakdown, source: 'policy', user });
  const outstanding = round2(open.reduce((s, r) => s + Number(r.balance), 0));
  const toApply = round2(Math.min(amount, outstanding));
  if (toApply > 0) {
    await applyToPolicy(db, { policy, amount: toApply, paymentMode: b.paymentMode, referenceNo: b.referenceNo, date: isoDate(b.paymentDate) || today(), user });
  }
  const ids = (await db.query('SELECT id FROM journal_vouchers WHERE policy_id = $1 AND status <> \'cancelled\' ORDER BY created_at', [policy.id])).rows.map((r) => r.id);
  return { journals: ids, applied: toApply, alreadyApplied: toApply === 0 && amount > 0, directBilled: false };
}
