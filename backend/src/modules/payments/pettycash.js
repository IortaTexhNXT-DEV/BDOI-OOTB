/**
 * Petty cash: funds (initiate = Dr Petty Cash Fund / Cr Cash in Bank), requests (maker-checker approval), disbursements
 * (Dr Expense + Input VAT / Cr Petty Cash Fund + WHT Payable), receipts (cash returned: Dr Petty Cash Fund / Cr account)
 * and replenishments (Dr Petty Cash Fund / Cr Cash in Bank). available_cash is kept in step with every posting.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { account, createJournal } from '../accounting/lib/ledger.js';
import { assertChecker, isoDate, num, round2, str, today } from '../accounting/lib/http.js';
import { notify } from '../notifications/router.js';

const nextNo = async (db, seq, key, fallback) => (await db.query('SELECT next_number($1,$2) AS n', [seq, await getSetting(key, fallback)])).rows[0].n;

export const fundRow = (f) => ({ id: f.id, code: f.code, pettyCashCode: f.code, description: f.description, transactionNumber: f.transaction_number, transactionDate: f.transaction_date,
  fundSize: Number(f.fund_size), maxLimit: Number(f.max_limit), minimumCashbox: Number(f.minimum_cashbox), availableCash: Number(f.available_cash), bankCode: f.bank_code,
  bankAccountCode: f.bank_account_code, mainAccountCode: f.main_account, subAccountCode: f.sub_account, currency: f.currency, branchCode: f.branch_code,
  departmentCode: f.department_code, custodianUserId: f.custodian_user_id, status: f.status, journalId: f.journal_id, createdAt: f.created_at });
export const requestRow = (r, lines = []) => ({ id: r.id, requestNumber: r.request_number, fundId: r.fund_id, pettyCashCode: r.fund_code, requesterName: r.requester_name,
  requestDate: r.request_date, departmentCode: r.department_code, branchCode: r.branch_code, purpose: r.purpose, totalAmount: Number(r.total_amount), status: r.status,
  approvedBy: r.approved_by, approvedAt: r.approved_at, rejectionReason: r.rejection_reason, createdBy: r.created_by, createdAt: r.created_at,
  lines: lines.map((l) => ({ id: l.id, narration: l.narration, amount: Number(l.amount), expenseAccount: l.expense_account })) });
export const disbursementRow = (d) => ({ id: d.id, transactionNumber: d.transaction_number, transactionCode: d.transaction_code, fundId: d.fund_id, pettyCashCode: d.fund_code,
  requestId: d.request_id, requestNumber: d.request_number, criteria: d.criteria, expenseAccount: d.expense_account, amount: Number(d.amount), vat: Number(d.vat), wht: Number(d.wht),
  netAmount: Number(d.net_amount), vatAccount: d.vat_account, whtAccount: d.wht_account, remarks: d.remarks, date: d.disbursement_date, status: d.status, journalId: d.journal_id, createdAt: d.created_at });
export const receiptRow = (r) => ({ id: r.id, receiptNumber: r.receipt_number, transactionNumber: r.transaction_number, transactionCode: r.transaction_code, fundId: r.fund_id,
  pettyCashCode: r.fund_code, requesterName: r.requester_name, branchCode: r.branch_code, bankCode: r.bank_code, creditAccount: r.credit_account, amount: Number(r.amount),
  remarks: r.remarks, date: r.receipt_date, journalId: r.journal_id, createdAt: r.created_at });
export const replenishRow = (r) => ({ id: r.id, transactionNumber: r.transaction_number, transactionCode: r.transaction_code, fundId: r.fund_id, pettyCashCode: r.fund_code,
  branchCode: r.branch_code, bankCode: r.bank_code, subAccount: r.sub_account, amount: Number(r.amount), date: r.replenish_date, remarks: r.remarks, journalId: r.journal_id, createdAt: r.created_at });

export async function getFund(db, ref, lock = false) {
  const f = (await db.query(`SELECT * FROM petty_cash_funds WHERE id = $1 OR code = $1${lock ? ' FOR UPDATE' : ''}`, [String(ref)])).rows[0];
  if (!f) throw notFound('Petty cash fund not found');
  return f;
}
async function fundAccount(db, f) {
  for (const code of [f.sub_account, f.main_account]) if (code && (await db.query('SELECT 1 FROM gl_accounts WHERE code = $1 AND status = \'active\'', [code])).rows[0]) return code;
  return account('petty_cash_fund');
}

export async function createFund(db, b, user) {
  const exists = (await db.query('SELECT 1 FROM petty_cash_funds WHERE code = $1', [b.code])).rows[0];
  if (exists) throw conflict(`Petty cash code ${b.code} already exists`);
  const size = round2(num(b.fundSize));
  const txn = await nextNo(db, 'petty-cash', 'numbering.petty_cash.prefix', 'PC');
  const f = (await db.query(`INSERT INTO petty_cash_funds(code, description, transaction_number, transaction_date, fund_size, max_limit, minimum_cashbox, available_cash, bank_code, bank_account_code,
      main_account, sub_account, currency, branch_code, department_code, custodian_user_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$5,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
  [b.code, str(b.description), txn, isoDate(b.transactionDate) || today(), size, round2(num(b.maxLimit)), round2(num(b.minimumCashbox)), str(b.bankCode), str(b.bankAccountCode),
    str(b.mainAccountCode), str(b.subAccountCode), b.currency || (await getSetting('currency.default', 'PHP')), str(b.branchCode), str(b.departmentCode), b.custodianUserId || null, user.id])).rows[0];
  const jv = await createJournal(db, { source: 'petty-cash', entryType: 'PETTY_CASH_FUND', referenceType: 'PettyCash', referenceId: f.id, transactionCode: txn, description: `Petty cash fund ${f.code} established`,
    lines: [{ accountCode: await fundAccount(db, f), debit: size, memo: `Fund ${f.code}` }, { accountCode: await account('cash_in_bank'), credit: size, memo: `Cheque to ${f.code} custodian` }] }, user);
  return (await db.query('UPDATE petty_cash_funds SET journal_id = $2 WHERE id = $1 RETURNING *', [f.id, jv.id])).rows[0];
}

export async function updateFund(db, id, b) {
  const f = await getFund(db, id, true);
  return (await db.query(`UPDATE petty_cash_funds SET description = COALESCE($2, description), max_limit = COALESCE($3, max_limit), minimum_cashbox = COALESCE($4, minimum_cashbox),
    branch_code = COALESCE($5, branch_code), department_code = COALESCE($6, department_code), custodian_user_id = COALESCE($7, custodian_user_id), status = COALESCE($8, status), updated_at = now()
    WHERE id = $1 RETURNING *`, [f.id, str(b.description), b.maxLimit === undefined ? null : round2(num(b.maxLimit)), b.minimumCashbox === undefined ? null : round2(num(b.minimumCashbox)),
    str(b.branchCode), str(b.departmentCode), b.custodianUserId || null, b.status || null])).rows[0];
}

const REQ_SQL = 'SELECT r.*, f.code AS fund_code FROM petty_cash_requests r JOIN petty_cash_funds f ON f.id = r.fund_id';
export async function getRequest(db, id) {
  const r = (await db.query(`${REQ_SQL} WHERE r.id = $1 OR r.request_number = $1`, [id])).rows[0];
  if (!r) throw notFound('Petty cash request not found');
  return requestRow(r, (await db.query('SELECT * FROM petty_cash_request_lines WHERE request_id = $1 ORDER BY id', [r.id])).rows);
}
async function saveLines(db, id, lines) {
  await db.query('DELETE FROM petty_cash_request_lines WHERE request_id = $1', [id]);
  let total = 0;
  for (const l of lines) {
    const amt = round2(num(l.amount));
    if (!(amt > 0)) throw badRequest('Each request line needs an amount greater than zero');
    await db.query('INSERT INTO petty_cash_request_lines(request_id, narration, amount, expense_account) VALUES ($1,$2,$3,$4)', [id, l.narration, amt, str(l.expenseAccount)]);
    total = round2(total + amt);
  }
  await db.query('UPDATE petty_cash_requests SET total_amount = $2, updated_at = now() WHERE id = $1', [id, total]);
  return total;
}
export async function createRequest(db, b, user) {
  const f = await getFund(db, b.fundId || b.pettyCashCode);
  const no = await nextNo(db, 'petty-cash-request', 'numbering.petty_cash_request.prefix', 'PCR');
  const r = (await db.query(`INSERT INTO petty_cash_requests(request_number, fund_id, requester_name, requester_user_id, request_date, department_code, branch_code, purpose, status, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [no, f.id, b.requesterName, b.requesterUserId || null, isoDate(b.requestDate) || today(), str(b.departmentCode), str(b.branchCode),
    str(b.purpose), b.submit ? 'submitted' : 'draft', user.id])).rows[0];
  const total = await saveLines(db, r.id, b.lines);
  if (Number(f.max_limit) > 0 && total > Number(f.max_limit)) throw badRequest(`Request total ${total} exceeds the fund limit of ${f.max_limit}`);
  return getRequest(db, r.id);
}
export async function updateRequest(db, id, b) {
  const r = (await db.query('SELECT * FROM petty_cash_requests WHERE id = $1 OR request_number = $1 FOR UPDATE', [id])).rows[0];
  if (!r) throw notFound('Petty cash request not found');
  if (!['draft', 'rejected'].includes(r.status)) throw conflict(`Request is ${r.status}; only draft or rejected requests can be edited`);
  await db.query(`UPDATE petty_cash_requests SET requester_name = COALESCE($2, requester_name), request_date = COALESCE($3, request_date), department_code = COALESCE($4, department_code),
    branch_code = COALESCE($5, branch_code), purpose = COALESCE($6, purpose), status = 'draft', updated_at = now() WHERE id = $1`,
  [r.id, str(b.requesterName), isoDate(b.requestDate), str(b.departmentCode), str(b.branchCode), str(b.purpose)]);
  if (Array.isArray(b.lines)) await saveLines(db, r.id, b.lines);
  return getRequest(db, r.id);
}
export async function transitionRequest(db, id, action, user, reason) {
  const r = (await db.query('SELECT * FROM petty_cash_requests WHERE id = $1 OR request_number = $1 FOR UPDATE', [id])).rows[0];
  if (!r) throw notFound('Petty cash request not found');
  if (action === 'submit') {
    if (!['draft', 'rejected'].includes(r.status)) throw conflict(`Request is ${r.status}`);
    if (!(Number(r.total_amount) > 0)) throw badRequest('Add at least one line before submitting');
    await db.query('UPDATE petty_cash_requests SET status = \'submitted\', updated_at = now() WHERE id = $1', [r.id]);
    await notify({ type: 'approval', title: `Petty cash request ${r.request_number} awaiting approval`, message: `${r.requester_name}: ${r.total_amount}`, entity: 'petty_cash_request', entityId: r.id });
  } else {
    if (r.status !== 'submitted') throw conflict(`Request is ${r.status}; only submitted requests can be ${action === 'approve' ? 'approved' : 'rejected'}`);
    await assertChecker(user, r.created_by, 'petty cash request');
    if (action === 'approve') await db.query('UPDATE petty_cash_requests SET status = \'approved\', approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $1', [r.id, user.id]);
    else await db.query('UPDATE petty_cash_requests SET status = \'rejected\', rejected_by = $2, rejected_at = now(), rejection_reason = $3, updated_at = now() WHERE id = $1', [r.id, user.id, reason]);
    if (r.created_by) await notify({ userId: r.created_by, type: 'info', title: `Petty cash request ${r.request_number} ${action === 'approve' ? 'approved' : 'rejected'}`, message: reason || `By ${user.username}`, entity: 'petty_cash_request', entityId: r.id });
  }
  return getRequest(db, r.id);
}

async function adjustCash(db, f, delta) {
  const next = round2(Number(f.available_cash) + delta);
  if (next < 0) throw conflict(`Insufficient petty cash: ${f.available_cash} available`);
  if (next > Number(f.fund_size)) throw conflict(`Fund ${f.code} would exceed its size of ${f.fund_size}`);
  await db.query('UPDATE petty_cash_funds SET available_cash = $2, updated_at = now() WHERE id = $1', [f.id, next]);
  if (delta < 0 && next < Number(f.minimum_cashbox)) {
    await notify({ userId: f.custodian_user_id || null, type: 'alert', title: `Petty cash ${f.code} below minimum`, message: `Available ${next}; minimum cashbox ${f.minimum_cashbox}. Replenish the fund.`, entity: 'petty_cash_fund', entityId: f.id });
  }
}

export async function createDisbursement(db, b, user) {
  const f = await getFund(db, b.fundId || b.pettyCashCode, true);
  const amount = round2(num(b.amount)); const vat = round2(num(b.vat)); const wht = round2(num(b.wht));
  if (!(amount > 0)) throw badRequest('amount must be greater than zero');
  if (vat >= amount || wht >= amount) throw badRequest('VAT and WHT must be less than the amount');
  if (Number(f.max_limit) > 0 && amount > Number(f.max_limit)) throw badRequest(`Amount exceeds the fund limit of ${f.max_limit}`);
  let req = null;
  if (b.requestId) {
    req = (await db.query('SELECT * FROM petty_cash_requests WHERE (id = $1 OR request_number = $1) FOR UPDATE', [b.requestId])).rows[0];
    if (!req) throw notFound('Petty cash request not found');
    if (req.status !== 'approved') throw conflict(`Request ${req.request_number} is ${req.status}; only approved requests can be disbursed`);
    if (req.fund_id !== f.id) throw badRequest('Request belongs to another fund');
    if (amount > Number(req.total_amount)) throw badRequest(`Amount exceeds the approved request total of ${req.total_amount}`);
  }
  const net = round2(amount - wht);
  const txn = await nextNo(db, 'petty-cash', 'numbering.petty_cash.prefix', 'PC');
  const vatAccount = b.vatAccount || await account('input_vat'); const whtAccount = b.whtAccount || await account('wht_payable');
  const jv = await createJournal(db, { source: 'petty-cash', entryType: 'PETTY_CASH_DISBURSEMENT', referenceType: 'PettyCash', transactionCode: txn, description: `Petty cash ${f.code}: ${b.remarks || req?.purpose || 'disbursement'}`,
    lines: [{ accountCode: b.expenseAccount, debit: round2(amount - vat), memo: b.remarks }, { accountCode: vatAccount, debit: vat, memo: 'Input VAT' },
      { accountCode: await fundAccount(db, f), credit: net, memo: `Paid from ${f.code}` }, { accountCode: whtAccount, credit: wht, memo: 'Expanded withholding tax' }] }, user);
  const d = (await db.query(`INSERT INTO petty_cash_disbursements(transaction_number, transaction_code, fund_id, request_id, criteria, expense_account, amount, vat, wht, net_amount, vat_account, wht_account,
      remarks, disbursement_date, journal_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
  [txn, str(b.transactionCode), f.id, req?.id || null, str(b.criteria), b.expenseAccount, amount, vat, wht, net, vatAccount, whtAccount, str(b.remarks), isoDate(b.date) || today(), jv.id, user.id])).rows[0];
  await db.query('UPDATE journal_vouchers SET reference_id = $2 WHERE id = $1', [jv.id, d.id]);
  if (req) await db.query('UPDATE petty_cash_requests SET status = \'disbursed\', updated_at = now() WHERE id = $1', [req.id]);
  await adjustCash(db, f, -net);
  return d;
}

export async function createReceipt(db, b, user) {
  const f = await getFund(db, b.fundId || b.pettyCashCode, true);
  const amount = round2(num(b.amount));
  if (!(amount > 0)) throw badRequest('amount must be greater than zero');
  const no = await nextNo(db, 'petty-cash-receipt', 'numbering.petty_cash_receipt.prefix', 'PCRC');
  const credit = b.creditAccount || b.subAccountCode || await account('employee_advances');
  const jv = await createJournal(db, { source: 'petty-cash', entryType: 'PETTY_CASH_RECEIPT', referenceType: 'PettyCash', transactionCode: no, description: `Cash returned to ${f.code}${b.requesterName ? ` by ${b.requesterName}` : ''}`,
    lines: [{ accountCode: await fundAccount(db, f), debit: amount, memo: b.remarks }, { accountCode: credit, credit: amount, memo: b.remarks }] }, user);
  const r = (await db.query(`INSERT INTO petty_cash_receipts(receipt_number, transaction_number, transaction_code, fund_id, requester_name, branch_code, bank_code, credit_account, amount, remarks, receipt_date, journal_id, created_by)
    VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [no, str(b.transactionCode), f.id, str(b.requesterName), str(b.branchCode), str(b.bankCode), credit, amount, str(b.remarks), isoDate(b.date) || today(), jv.id, user.id])).rows[0];
  await adjustCash(db, f, amount);
  return r;
}

export async function createReplenishment(db, b, user) {
  const f = await getFund(db, b.fundId || b.pettyCashCode, true);
  const amount = round2(b.amount === undefined || b.amount === '' ? Number(f.fund_size) - Number(f.available_cash) : num(b.amount));
  if (!(amount > 0)) throw conflict(`Fund ${f.code} is already at its full size`);
  const txn = await nextNo(db, 'petty-cash', 'numbering.petty_cash.prefix', 'PC');
  const jv = await createJournal(db, { source: 'petty-cash', entryType: 'PETTY_CASH_REPLENISHMENT', referenceType: 'PettyCash', transactionCode: txn, description: `Replenishment of ${f.code}`,
    lines: [{ accountCode: await fundAccount(db, f), debit: amount, memo: 'Replenishment' }, { accountCode: await account('cash_in_bank'), credit: amount, memo: `Cheque for ${f.code}` }] }, user);
  const r = (await db.query(`INSERT INTO petty_cash_replenishments(transaction_number, transaction_code, fund_id, branch_code, bank_code, sub_account, amount, replenish_date, remarks, journal_id, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [txn, str(b.transactionCode), f.id, str(b.branchCode), str(b.bankCode), str(b.subAccountCode), amount, isoDate(b.date) || today(), str(b.remarks), jv.id, user.id])).rows[0];
  await adjustCash(db, f, amount);
  return r;
}

const LISTS = {
  funds: ['SELECT f.*, f.code AS fund_code FROM petty_cash_funds f', 'f', fundRow, 'f.code || \' \' || COALESCE(f.description,\'\') || \' \' || COALESCE(f.transaction_number,\'\')'],
  requests: [REQ_SQL, 'r', (r) => requestRow(r), 'r.request_number || \' \' || r.requester_name || \' \' || f.code'],
  disbursements: ['SELECT d.*, f.code AS fund_code, q.request_number FROM petty_cash_disbursements d JOIN petty_cash_funds f ON f.id = d.fund_id LEFT JOIN petty_cash_requests q ON q.id = d.request_id', 'd', disbursementRow, 'd.transaction_number || \' \' || COALESCE(d.transaction_code,\'\') || \' \' || f.code'],
  receipts: ['SELECT r.*, f.code AS fund_code FROM petty_cash_receipts r JOIN petty_cash_funds f ON f.id = r.fund_id', 'r', receiptRow, 'r.receipt_number || \' \' || COALESCE(r.requester_name,\'\') || \' \' || f.code'],
  replenishments: ['SELECT r.*, f.code AS fund_code FROM petty_cash_replenishments r JOIN petty_cash_funds f ON f.id = r.fund_id', 'r', replenishRow, 'r.transaction_number || \' \' || f.code'],
};
export async function list(db, kind, q, pg) {
  const [sql, alias, map, searchExpr] = LISTS[kind];
  const where = []; const p = [];
  if (q.search) { p.push(q.search); where.push(`(${searchExpr}) ILIKE '%' || $${p.length} || '%'`); }
  if (q.fundId || q.pettyCashCode) { p.push(q.fundId || q.pettyCashCode); where.push(`(f.id = $${p.length} OR f.code = $${p.length})`); }
  if (q.status && kind !== 'receipts' && kind !== 'replenishments') { p.push(q.status); where.push(`${alias}.status = $${p.length}`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n FROM (${sql} ${w}) x`, p)).rows[0].n;
  const rows = (await db.query(`${sql} ${w} ORDER BY ${alias}.created_at DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, pg.limit, pg.offset])).rows;
  return { rows: rows.map(map), total };
}
export async function getOne(db, kind, id) {
  if (kind === 'requests') return getRequest(db, id);
  const [sql, alias, map] = LISTS[kind];
  const numCol = { funds: 'code', disbursements: 'transaction_number', receipts: 'receipt_number', replenishments: 'transaction_number' }[kind];
  const r = (await db.query(`${sql} WHERE ${alias}.id = $1 OR ${alias}.${numCol} = $1`, [id])).rows[0];
  if (!r) throw notFound('Record not found');
  return map(r);
}
