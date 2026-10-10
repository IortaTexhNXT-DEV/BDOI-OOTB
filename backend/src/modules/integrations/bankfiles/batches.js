/**
 * Bank payment batches: payment vouchers (insurer remittances, referrer commission payouts, refunds, suppliers) paid
 * through a bank's bulk credit, InstaPay or PESONet upload file.
 *
 *   draft         vouchers chosen (submitted for approval, not paid, not on another batch, no cheque issued); each
 *                 payee needs a bank account (Payee Bank Accounts, or the referrer's account on file)
 *   for-approval  submitted by the maker
 *   approved      a different user approves (maker-checker against the batch and every voucher's maker; Authority
 *                 Matrix limit payment_voucher on the batch total)
 *   file-generated / sent
 *                 the file is written from the layout, downloaded and uploaded on the bank portal (sent)
 *   completed     every line has a result: read from the bank's status file or entered by hand. A paid line posts its
 *                 voucher's payment journal as the approver (Dr payable of the payee type / Cr cash in bank of the batch's
 *                 bank account; a referrer payout pays its commission lines) and marks the voucher paid; a rejected line
 *                 leaves the voucher unpaid, free for another batch or a cheque.
 */
import { many, one, query, withTransaction } from '../../../db/pool.js';
import { badRequest, conflict, notFound } from '../../../lib/errors.js';
import { getSetting } from '../../../lib/settings.js';
import { round2 } from '../../../lib/money.js';
import { moneyText } from '../../../lib/auditEvents.js';
import { printFormat } from '../../../lib/pdf/index.js';
import { nextDocumentNumber } from '../../../lib/numbering.js';
import { companyName } from '../../../lib/letterhead.js';
import { today } from '../../../lib/dates.js';
import { assertChecker } from '../../../lib/makerChecker.js';
import { hasPermission } from '../../../lib/auth.js';
import { assertAuthority, effectiveAuthority } from '../../access-control/service.js';
import { registerMessageType } from '../framework/registry.js';
import { enqueue, processOutbox, receive } from '../framework/outbox.js';
import { layoutRow, parseStatusFile, renderFile } from './layouts.js';

const run = (db) => db || { query };
export const BATCH_STATUSES = ['draft', 'for-approval', 'approved', 'file-generated', 'sent', 'completed', 'cancelled'];
export const PAYEE_TYPES = ['Insurer', 'Agent/Referrer', 'Customer', 'Client', 'Supplier'];
const AGENT = 'Agent/Referrer';

// ------------------------------------------------------------------ payee bank accounts

export const toPayeeAccount = (a) => ({
  id: a.id, payeeType: a.payee_type, payeeId: a.payee_id, payeeName: a.payee_name, bankCode: a.bank_code, bankName: a.bank_name || null, bankBranch: a.bank_branch,
  accountNumber: a.account_number, accountName: a.account_name, accountType: a.account_type, isDefault: a.is_default, email: a.email, active: a.active, updatedAt: a.updated_at,
});
const PAYEE_SELECT = 'SELECT a.*, b.name AS bank_name FROM payee_bank_accounts a LEFT JOIN banks b ON upper(b.code) = upper(a.bank_code)';

export async function listPayeeAccounts(q = {}) {
  return (await many(`${PAYEE_SELECT} WHERE ($1::text IS NULL OR a.payee_type = $1) AND ($2::text IS NULL OR a.payee_name ILIKE '%' || $2 || '%' OR a.account_number ILIKE '%' || $2 || '%' OR a.payee_id = $2)
    ORDER BY a.payee_type, a.payee_name, a.id`, [q.payeeType || null, q.search ? String(q.search).trim() : null])).map(toPayeeAccount);
}

async function payeeName(type, id) {
  if (type === 'Insurer') return (await one('SELECT name FROM insurance_companies WHERE id::text = $1 OR code = $1', [String(id)]))?.name || null;
  if (type === AGENT) return (await one('SELECT name FROM commission_referrers WHERE id = $1', [String(id)]))?.name || null;
  if (type === 'Customer' || type === 'Client') return (await one('SELECT display_name FROM clients WHERE id = $1 OR client_code = $1', [String(id)]))?.display_name || null;
  return null;
}

export async function savePayeeAccount(id, b, user) {
  const bank = await one('SELECT code FROM banks WHERE upper(code) = upper($1)', [b.bankCode]);
  if (!bank) throw badRequest('Validation failed', [{ path: 'bankCode', message: `Unknown bank ${b.bankCode} (Master > Finance > Bank)` }]);
  let payeeId = String(b.payeeId);
  if (b.payeeType === 'Insurer') {
    const ins = await one('SELECT id FROM insurance_companies WHERE id::text = $1 OR code = $1', [payeeId]);
    if (!ins) throw badRequest('Validation failed', [{ path: 'payeeId', message: 'Unknown insurer' }]);
    payeeId = String(ins.id);
  }
  const name = b.payeeName || await payeeName(b.payeeType, payeeId);
  if (!name) throw badRequest('Validation failed', [{ path: 'payeeId', message: `No ${b.payeeType} found with this id` }]);
  const before = id ? await one(`${PAYEE_SELECT} WHERE a.id = $1`, [Number(id)]) : null;
  if (id && !before) throw notFound('Payee bank account not found');
  const vals = [b.payeeType, payeeId, name, bank.code, b.bankBranch || null, String(b.accountNumber).trim(), b.accountName, b.accountType || 'savings', b.isDefault !== false, b.email || null, b.active !== false, user?.id ?? null];
  let newId = id;
  if (id) {
    await query(`UPDATE payee_bank_accounts SET payee_type = $2, payee_id = $3, payee_name = $4, bank_code = $5, bank_branch = $6, account_number = $7, account_name = $8, account_type = $9,
      is_default = $10, email = $11, active = $12, updated_by = $13, updated_at = now() WHERE id = $1`, [Number(id), ...vals]);
  } else {
    newId = (await one(`INSERT INTO payee_bank_accounts(payee_type, payee_id, payee_name, bank_code, bank_branch, account_number, account_name, account_type, is_default, email, active, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`, vals)).id;
  }
  if (b.isDefault !== false) await query('UPDATE payee_bank_accounts SET is_default = false WHERE payee_type = $1 AND payee_id = $2 AND id <> $3', [b.payeeType, payeeId, Number(newId)]);
  return { before: before ? toPayeeAccount(before) : null, after: toPayeeAccount(await one(`${PAYEE_SELECT} WHERE a.id = $1`, [Number(newId)])) };
}

/** The payee of a voucher: { type, id } in the keys used by payee_bank_accounts. */
const payeeKey = (d) => {
  if (d.payee_type === 'Insurer') return { type: 'Insurer', id: d.insurance_company_id ? String(d.insurance_company_id) : d.payee_id };
  if (d.payee_type === AGENT) return { type: AGENT, id: d.referrer_id || d.payee_id };
  if (d.payee_type === 'Customer' || d.payee_type === 'Client') return { type: d.payee_type, id: d.client_id || d.payee_id || d.customer_code };
  return { type: d.payee_type, id: d.payee_id || d.customer_code };
};

/** Bank account a voucher is paid to, or null. */
export async function payeeAccountOf(db, d) {
  const k = payeeKey(d);
  if (!k.id) return null;
  const types = k.type === 'Customer' || k.type === 'Client' ? ['Customer', 'Client'] : [k.type];
  const a = (await run(db).query(`SELECT * FROM payee_bank_accounts WHERE payee_type = ANY($1) AND payee_id = $2 AND active ORDER BY is_default DESC, id LIMIT 1`, [types, String(k.id)])).rows[0];
  if (a) return { bankCode: a.bank_code, accountNumber: a.account_number, accountName: a.account_name, accountType: a.account_type, email: a.email };
  if (k.type === AGENT) {
    const r = (await run(db).query(`SELECT r.name, r.email, r.bank_account_no, b.code AS bank_code FROM commission_referrers r
      LEFT JOIN banks b ON upper(b.code) = upper(r.bank_name) OR upper(b.name) = upper(r.bank_name) WHERE r.id = $1`, [String(k.id)])).rows[0];
    if (r?.bank_account_no && r.bank_code) return { bankCode: r.bank_code, accountNumber: r.bank_account_no, accountName: r.name, accountType: 'savings', email: r.email };
  }
  return null;
}

// ------------------------------------------------------------------ vouchers that can go on a batch

const OPEN_LINE = `EXISTS (SELECT 1 FROM bank_payment_batch_lines l JOIN bank_payment_batches b ON b.id = l.batch_id
  WHERE l.disbursement_id = d.id AND b.status <> 'cancelled' AND l.status IN ('pending', 'paid'))`;
const HAS_CHEQUE = "EXISTS (SELECT 1 FROM checkbooks c WHERE c.disbursement_id = d.id AND c.status IN ('Pending', 'Approved', 'Printed'))";

export async function eligibleStatuses() {
  return (await getSetting('bank_payments.allow_draft_vouchers', false)) ? ['draft', 'for-approval'] : ['for-approval'];
}

export async function eligibleVouchers(q = {}) {
  const rows = await many(`SELECT d.* FROM disbursements d WHERE d.status = ANY($1) AND d.amount > 0 AND NOT ${OPEN_LINE} AND NOT ${HAS_CHEQUE}
      AND ($2::text IS NULL OR d.payee_type = $2) AND ($3::text IS NULL OR d.voucher_number ILIKE '%' || $3 || '%' OR d.payee_name ILIKE '%' || $3 || '%')
    ORDER BY d.voucher_date, d.voucher_number LIMIT 500`, [await eligibleStatuses(), q.payeeType || null, q.search ? String(q.search).trim() : null]);
  const out = [];
  for (const d of rows) {
    const acc = await payeeAccountOf(null, d);
    out.push({ disbursementId: d.id, voucherNumber: d.voucher_number, voucherDate: d.voucher_date, payeeType: d.payee_type, payeeName: d.payee_name, amount: Number(d.amount),
      status: d.status, bankCode: acc?.bankCode || null, accountNumber: acc?.accountNumber || null, accountName: acc?.accountName || null, ready: !!acc });
  }
  return out;
}

// ------------------------------------------------------------------ batches

export const toBatch = (b) => ({
  id: b.id, batchNumber: b.batch_number, layoutCode: b.layout_code, layoutName: b.layout_name || null, bankAccountCode: b.bank_account_code, bankAccountName: b.bank_account_name || null,
  channel: b.channel, valueDate: b.value_date, status: b.status, lineCount: b.line_count, totalAmount: Number(b.total_amount), paidCount: b.paid_count, rejectedCount: b.rejected_count,
  pendingCount: b.line_count - b.paid_count - b.rejected_count, fileName: b.file_name, fileHash: b.file_hash, fileGeneratedAt: b.file_generated_at, sentAt: b.sent_at,
  outboxId: b.outbox_id ? Number(b.outbox_id) : null, remarks: b.remarks, rejectedReason: b.rejected_reason, submittedAt: b.submitted_at, approvedAt: b.approved_at,
  approvedBy: b.approved_by_name || b.approved_by, createdBy: b.created_by_name || b.created_by, createdAt: b.created_at, updatedAt: b.updated_at,
});
export const toLine = (l) => ({
  id: Number(l.id), seq: l.seq, disbursementId: l.disbursement_id, voucherNumber: l.voucher_number, payeeType: l.payee_type, payeeName: l.payee_name, bankCode: l.bank_code,
  accountNumber: l.account_number, accountName: l.account_name, accountType: l.account_type, amount: Number(l.amount), reference: l.reference, status: l.status,
  bankReference: l.bank_reference, reason: l.reason, journalId: l.journal_id, journalNumber: l.jv_number || null, resultSource: l.result_source, resultAt: l.result_at,
});
const BATCH_SELECT = `SELECT b.*, lay.name AS layout_name, ba.bank_account_name, (SELECT display_name FROM users u WHERE u.id = b.created_by) AS created_by_name,
  (SELECT display_name FROM users u WHERE u.id = b.approved_by) AS approved_by_name
  FROM bank_payment_batches b JOIN bank_file_layouts lay ON lay.code = b.layout_code LEFT JOIN bank_account_links ba ON ba.bank_account_code = b.bank_account_code`;

export async function batchRow(id, db = null, lock = false) {
  const b = (await run(db).query(`SELECT * FROM bank_payment_batches WHERE id = $1 OR batch_number = $1${lock ? ' FOR UPDATE' : ''}`, [String(id)])).rows[0];
  if (!b) throw notFound('Bank payment batch not found');
  return b;
}
export async function getBatch(id, db = null) {
  const b = (await run(db).query(`${BATCH_SELECT} WHERE b.id = $1 OR b.batch_number = $1`, [String(id)])).rows[0];
  if (!b) throw notFound('Bank payment batch not found');
  const lines = (await run(db).query(`SELECT l.*, j.jv_number FROM bank_payment_batch_lines l LEFT JOIN journal_vouchers j ON j.id = l.journal_id WHERE l.batch_id = $1 ORDER BY l.seq`, [b.id])).rows;
  return { ...toBatch(b), lines: lines.map(toLine) };
}

export async function listBatches(q, pg) {
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status) add('b.status = ANY(?)', String(q.status).split(',').map((s) => s.trim()));
  if (q.search) add("(b.batch_number ILIKE '%' || ? || '%' OR EXISTS (SELECT 1 FROM bank_payment_batch_lines l WHERE l.batch_id = b.id AND (l.voucher_number ILIKE '%' || ? || '%' OR l.payee_name ILIKE '%' || ? || '%')))", String(q.search).trim());
  const w = where.join(' AND ');
  const total = (await one(`SELECT count(*)::int AS n FROM bank_payment_batches b WHERE ${w}`, params)).n;
  const rows = await many(`${BATCH_SELECT} WHERE ${w} ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pg.limit, pg.offset]);
  return { total, rows: rows.map(toBatch) };
}

/** Create a draft batch: { layoutCode, bankAccountCode, channel, valueDate, disbursementIds, remarks }. */
export async function createBatch(b, user) {
  const layout = await layoutRow(b.layoutCode);
  if (!layout.active) throw badRequest(`Layout ${layout.code} is not active`);
  if (!(layout.channels || []).includes(b.channel)) throw badRequest(`Layout ${layout.name} does not write ${b.channel} files`);
  const account = await one("SELECT * FROM bank_account_links WHERE bank_account_code = $1 AND status = 'active'", [b.bankAccountCode]);
  if (!account) throw badRequest('Validation failed', [{ path: 'bankAccountCode', message: `Unknown or inactive bank account ${b.bankAccountCode} (Master > Finance > Bank Account)` }]);
  const limit = b.channel === 'instapay' ? Number(await getSetting('bank_payments.instapay_limit', 50000)) : null;
  const perLine = layout.max_amount_per_line === null ? null : Number(layout.max_amount_per_line);
  const statuses = await eligibleStatuses();
  return withTransaction(async (db) => {
    const vouchers = (await db.query(`SELECT d.*, ${OPEN_LINE} AS on_batch, ${HAS_CHEQUE} AS has_cheque FROM disbursements d WHERE d.id = ANY($1) FOR UPDATE`, [b.disbursementIds])).rows;
    const errors = [];
    if (vouchers.length !== new Set(b.disbursementIds).size) errors.push({ path: 'disbursementIds', message: 'Some vouchers were not found' });
    const lines = [];
    for (const d of vouchers.sort((x, y) => b.disbursementIds.indexOf(x.id) - b.disbursementIds.indexOf(y.id))) {
      const at = `voucher ${d.voucher_number}`;
      if (!statuses.includes(d.status)) errors.push({ path: at, message: `is ${d.status}; only vouchers ${statuses.join(' or ')} can be paid by bank file` });
      else if (d.on_batch) errors.push({ path: at, message: 'is on another bank payment batch' });
      else if (d.has_cheque) errors.push({ path: at, message: 'has a cheque issued' });
      else if (!(Number(d.amount) > 0)) errors.push({ path: at, message: 'has no amount' });
      else if (limit && Number(d.amount) > limit) errors.push({ path: at, message: `is above the InstaPay limit of ${limit.toLocaleString('en-PH')}` });
      else if (perLine && Number(d.amount) > perLine) errors.push({ path: at, message: `is above the layout's limit per line of ${perLine.toLocaleString('en-PH')}` });
      const acc = await payeeAccountOf(db, d);
      if (!acc) errors.push({ path: at, message: `${d.payee_name}: no bank account on file (Master > Finance > Bank File Layouts, Payee Bank Accounts)` });
      lines.push({ d, acc });
    }
    if (errors.length) throw badRequest('Some vouchers cannot be paid by this batch', errors);
    const number = await nextDocumentNumber('bank_payment_batch', { db, unique: { table: 'bank_payment_batches', column: 'batch_number' } });
    const total = round2(lines.reduce((s, l) => s + Number(l.d.amount), 0));
    const batch = (await db.query(`INSERT INTO bank_payment_batches(batch_number, layout_code, bank_account_code, channel, value_date, line_count, total_amount, remarks, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`, [number, layout.code, account.bank_account_code, b.channel, b.valueDate || await today(), lines.length, total, b.remarks || null, user?.id ?? null])).rows[0];
    let seq = 0;
    for (const { d, acc } of lines) {
      seq += 1;
      await db.query(`INSERT INTO bank_payment_batch_lines(batch_id, seq, disbursement_id, voucher_number, payee_type, payee_name, bank_code, account_number, account_name, account_type, email, amount, reference)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [batch.id, seq, d.id, d.voucher_number, d.payee_type, d.payee_name, acc.bankCode, acc.accountNumber, acc.accountName,
        acc.accountType, acc.email, Number(d.amount), d.voucher_number]);
    }
    return getBatch(batch.id, db);
  });
}

async function transition(id, from, to, user, sets = {}) {
  return withTransaction(async (db) => {
    const b = await batchRow(id, db, true);
    if (!from.includes(b.status)) throw conflict(`Batch ${b.batch_number} is ${b.status}`);
    const before = toBatch(b);
    const cols = Object.keys(sets);
    await db.query(`UPDATE bank_payment_batches SET status = $2, updated_by = $3, updated_at = now()${cols.map((c, i) => `, ${c} = $${i + 4}`).join('')} WHERE id = $1`,
      [b.id, to, user?.id ?? null, ...Object.values(sets)]);
    return { b, before, db };
  });
}

export async function submitBatch(id, user) {
  const { before, b } = await transition(id, ['draft'], 'for-approval', user, { submitted_by: user?.id ?? null, submitted_at: new Date(), rejected_reason: null });
  return { before, after: await getBatch(b.id) };
}

/** Approve (maker-checker against the batch and every voucher; Authority Matrix payment_voucher on the total). */
export async function approveBatch(id, user) {
  return withTransaction(async (db) => {
    const b = await batchRow(id, db, true);
    if (b.status !== 'for-approval') throw conflict(`Batch ${b.batch_number} is ${b.status}; submit it for approval first`);
    await assertChecker(user, b.created_by, 'bank payment batch');
    await assertChecker(user, b.submitted_by, 'bank payment batch');
    for (const v of (await db.query('SELECT d.voucher_number, d.created_by FROM bank_payment_batch_lines l JOIN disbursements d ON d.id = l.disbursement_id WHERE l.batch_id = $1', [b.id])).rows) {
      await assertChecker(user, v.created_by, `payment voucher ${v.voucher_number}`);
    }
    await assertAuthority(db, user, 'payment_voucher', Number(b.total_amount));
    const before = toBatch(b);
    await db.query("UPDATE bank_payment_batches SET status = 'approved', approved_by = $2, approved_at = now(), updated_by = $2, updated_at = now() WHERE id = $1", [b.id, user.id]);
    return { before, after: await getBatch(b.id, db) };
  });
}

/**
 * Can `user` approve or reject batch `b` (a bank_payment_batches row)? The rules of approveBatch as a code and the
 * sentence the screen shows instead of the buttons: { canDecide, blockedCode, blockedReason }. Read only; approveBatch
 * enforces them. Codes: WRONG_STATUS (not awaiting approval), NO_PERMISSION, MAKER (created the batch), SUBMITTER,
 * VOUCHER_MAKER (made a voucher of the batch), NO_AUTHORITY, ABOVE_LIMIT (Authority Matrix payment_voucher).
 */
export async function batchDecision(b, user, db = null) {
  const no = (blockedCode, blockedReason) => ({ canDecide: false, blockedCode, blockedReason });
  if (b.status !== 'for-approval') return no('WRONG_STATUS', null);
  if (!hasPermission(user, 'write:disbursements')) return no('NO_PERMISSION', 'You can view payment batches but not approve them.');
  if (await getSetting('finance.maker_checker_enabled', true)) {
    if (b.created_by === user.id) return no('MAKER', 'You prepared this batch. Another user must approve it.');
    if (b.submitted_by === user.id) return no('SUBMITTER', 'You submitted this batch. Another user must approve it.');
    const mine = (await run(db).query(`SELECT d.voucher_number FROM bank_payment_batch_lines l JOIN disbursements d ON d.id = l.disbursement_id
      WHERE l.batch_id = $1 AND d.created_by = $2 ORDER BY l.seq LIMIT 1`, [b.id, user.id])).rows[0];
    if (mine) return no('VOUCHER_MAKER', `You prepared payment voucher ${mine.voucher_number} in this batch. Another user must approve it.`);
  }
  if (await getSetting('access.authority_enforced', true)) {
    const a = await effectiveAuthority(run(db), user.id, 'payment_voucher', await today());
    const type = (await run(db).query("SELECT name FROM authority_transaction_types WHERE code = 'payment_voucher'")).rows[0]?.name || 'Payment voucher';
    if (!a.found && String(await getSetting('access.authority_without_limit', 'allow')) === 'refuse') {
      return no('NO_AUTHORITY', `You have no approval limit for ${type}. Ask an administrator to set one in the Authority Matrix.`);
    }
    if (a.found && !a.unlimited && Number(b.total_amount) > a.limit) {
      const fmt = await printFormat();
      return no('ABOVE_LIMIT', `${moneyText(Number(b.total_amount), fmt)} is above your approval limit of ${moneyText(a.limit, fmt)}.`);
    }
  }
  return { canDecide: true, blockedCode: null, blockedReason: null };
}

/** A batch (toBatch / getBatch) with the decision block of `user`. */
export async function withDecision(batch, user) {
  return { ...batch, decision: await batchDecision(await batchRow(batch.id), user) };
}

export async function rejectBatch(id, reason, user) {
  const { before, b } = await transition(id, ['for-approval'], 'draft', user, { rejected_reason: reason });
  return { before, after: await getBatch(b.id) };
}

/** Write the payment file from the layout (approved batch; again while no line has a result). */
export async function generateFile(id, user) {
  const out = await withTransaction(async (db) => {
    const b = await batchRow(id, db, true);
    if (!['approved', 'file-generated', 'sent'].includes(b.status)) throw conflict(`Batch ${b.batch_number} is ${b.status}; the file is written once the batch is approved`);
    if (b.paid_count + b.rejected_count > 0) throw conflict('Results were recorded on this batch: the file can no longer be written again');
    const layout = await layoutRow(b.layout_code, db);
    const account = (await db.query('SELECT * FROM bank_account_links WHERE bank_account_code = $1', [b.bank_account_code])).rows[0] || {};
    const lines = (await db.query('SELECT * FROM bank_payment_batch_lines WHERE batch_id = $1 ORDER BY seq', [b.id])).rows;
    const batch = { batchNumber: b.batch_number, valueDate: b.value_date, bankAccountNumber: account.account_number || '', bankAccountName: account.bank_account_name || '',
      bankCode: account.bank_code || layout.bank_code || '', companyName: await companyName(), totalAmount: Number(b.total_amount), count: lines.length, channel: b.channel,
      createdDate: String(b.created_at.toISOString?.() || b.created_at).slice(0, 10) };
    const file = renderFile(layout, batch, lines.map((l) => ({ seq: l.seq, voucherNumber: l.voucher_number, reference: l.reference, payeeName: l.payee_name, accountName: l.account_name,
      accountNumber: l.account_number, bankCode: l.bank_code, accountType: l.account_type, amount: Number(l.amount), email: l.email, payeeType: l.payee_type })));
    const m = await enqueue(db, { connectorCode: 'BANK_FILES', messageType: 'bank.payment_file', entity: 'bank_payment_batch', entityId: b.id, reference: b.batch_number,
      idempotencyKey: `bank:file:${b.id}:${file.hash}`, payload: { fileName: file.fileName, lines: lines.length, total: Number(b.total_amount), hash: file.hash, channel: b.channel } }, user);
    const before = toBatch(b);
    await db.query(`UPDATE bank_payment_batches SET status = CASE WHEN status = 'approved' THEN 'file-generated' ELSE status END, file_name = $2, file_content = $3, file_hash = $4,
      file_generated_at = now(), file_generated_by = $5, outbox_id = $6, updated_at = now() WHERE id = $1`, [b.id, file.fileName, file.content, file.hash, user?.id ?? null, m.id]);
    return { before, outboxId: m.id, batchId: b.id };
  });
  await processOutbox({ ids: [out.outboxId] });
  return { before: out.before, after: await getBatch(out.batchId) };
}

export async function fileOf(id) {
  const b = await batchRow(id);
  if (!b.file_content) throw notFound('The file of this batch has not been written yet');
  return { fileName: b.file_name, content: b.file_content };
}

export async function markSent(id, user) {
  const { before, b } = await transition(id, ['file-generated'], 'sent', user, { sent_at: new Date(), sent_by: user?.id ?? null });
  return { before, after: await getBatch(b.id) };
}

export async function cancelBatch(id, reason, user) {
  return withTransaction(async (db) => {
    const b = await batchRow(id, db, true);
    if (['completed', 'cancelled'].includes(b.status)) throw conflict(`Batch ${b.batch_number} is ${b.status}`);
    if (b.paid_count > 0) throw conflict('Lines of this batch were paid: it cannot be cancelled');
    const before = toBatch(b);
    await db.query("UPDATE bank_payment_batches SET status = 'cancelled', remarks = trim(both ' ' FROM COALESCE(remarks, '') || ' Cancelled: ' || $2), updated_by = $3, updated_at = now() WHERE id = $1",
      [b.id, reason, user?.id ?? null]);
    return { before, after: await getBatch(b.id, db) };
  });
}

/** Post a paid line: the voucher's payment journal as the batch approver, the voucher marked paid. */
async function payLine(db, b, l, bankReference) {
  const approver = { id: b.approved_by };
  const svc = await import('../../disbursements/service.js');
  const d = await svc.getDisbursementRaw(db, l.disbursement_id, true);
  if (['paid', 'cancelled'].includes(d.status)) throw conflict(`Voucher ${d.voucher_number} is ${d.status}`);
  if (d.payee_type === AGENT) {
    const ids = (await db.query("SELECT id FROM commissions WHERE disbursement_id = $1 AND status = 'Approved'", [d.id])).rows.map((r) => r.id);
    if (ids.length) {
      const r = await svc.approveAgentPayout(db, d.id, ids, approver, { bankAccount: b.bank_account_code, paymentMode: 'bank-transfer' });
      return { journalId: r.journalId, checkbookId: null };
    }
  }
  const cb = (await db.query(`INSERT INTO checkbooks(disbursement_id, customer_code, customer_name, main_account, instrument_book_id, instrument_no, instrument_date, totale_amount, status, created_by)
    VALUES ($1,$2,$3,$4,'BANK-FILE',$5,$6,$7,'Pending',$8) RETURNING id`, [d.id, d.customer_code, d.payee_name, b.bank_account_code, bankReference || b.batch_number, b.value_date,
    Number(l.amount), b.created_by])).rows[0];
  await svc.updateCheckbook(db, cb.id, { status: 'Approved', totaleAmount: Number(l.amount) }, approver);
  await svc.updateCheckbook(db, cb.id, { status: 'Printed' }, approver);
  const c = (await db.query('SELECT journal_id FROM checkbooks WHERE id = $1', [cb.id])).rows[0];
  return { journalId: c.journal_id, checkbookId: cb.id };
}

async function refreshCounts(db, batchId) {
  await db.query(`UPDATE bank_payment_batches b SET paid_count = x.paid, rejected_count = x.rejected, status = CASE WHEN x.pending = 0 THEN 'completed' ELSE b.status END, updated_at = now()
    FROM (SELECT count(*) FILTER (WHERE status = 'paid')::int AS paid, count(*) FILTER (WHERE status = 'rejected')::int AS rejected, count(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM bank_payment_batch_lines WHERE batch_id = $1) x WHERE b.id = $1`, [batchId]);
}

/**
 * Apply results to a batch: [{ reference | lineId, status: paid | rejected, bankReference, reason, amount }]. Returns
 * { applied, skipped: [{ reference, reason }] }. source: file | manual.
 */
export async function applyResults(db, batchId, results, { source, userId }) {
  const b = await batchRow(batchId, db, true);
  if (!['file-generated', 'sent'].includes(b.status)) throw conflict(`Batch ${b.batch_number} is ${b.status}: results are recorded once its file is written`);
  const lines = (await db.query('SELECT * FROM bank_payment_batch_lines WHERE batch_id = $1 ORDER BY seq FOR UPDATE', [b.id])).rows;
  const out = { applied: 0, paid: 0, rejected: 0, skipped: [] };
  for (const r of results) {
    const l = r.lineId ? lines.find((x) => Number(x.id) === Number(r.lineId)) : lines.find((x) => x.reference === r.reference || x.voucher_number === r.reference);
    const ref = r.reference || l?.reference || String(r.lineId);
    if (!l) { out.skipped.push({ reference: ref, reason: 'not on this batch' }); continue; }
    if (l.status !== 'pending') { out.skipped.push({ reference: ref, reason: `already ${l.status}` }); continue; }
    if (!['paid', 'rejected'].includes(r.status)) { out.skipped.push({ reference: ref, reason: `status "${r.rawStatus || r.status}" is neither paid nor rejected` }); continue; }
    if (r.status === 'paid' && r.amount !== null && r.amount !== undefined && Math.abs(Number(r.amount) - Number(l.amount)) > 0.005) {
      out.skipped.push({ reference: ref, reason: `amount ${r.amount} differs from ${Number(l.amount)}` });
      continue;
    }
    let posted = { journalId: null, checkbookId: null };
    if (r.status === 'paid') posted = await payLine(db, b, l, r.bankReference);
    await db.query(`UPDATE bank_payment_batch_lines SET status = $2, bank_reference = $3, reason = $4, journal_id = $5, checkbook_id = $6, result_source = $7, result_at = now(), result_by = $8 WHERE id = $1`,
      [l.id, r.status, r.bankReference || null, r.reason || null, posted.journalId, posted.checkbookId, source, userId || null]);
    out.applied += 1;
    out[r.status] += 1;
  }
  await refreshCounts(db, b.id);
  return out;
}

/** Import the bank's status file: read with the layout, stored in the integration inbox and applied. */
export async function importStatusFile(id, text, fileName, user) {
  const b = await batchRow(id);
  const layout = await layoutRow(b.layout_code);
  const rows = parseStatusFile(layout, text);
  if (!rows.length) throw badRequest('The status file has no result rows');
  const inbox = await receive({ connectorCode: 'BANK_FILES', messageType: 'bank.status_file', source: 'file', externalRef: fileName || null, entity: 'bank_payment_batch', entityId: b.id,
    payload: { batchId: b.id, batchNumber: b.batch_number, fileName: fileName || null, userId: user?.id ?? null, rows } }, user);
  if (inbox.status !== 'processed') throw badRequest(`The status file could not be applied: ${inbox.lastError}`);
  return { inboxId: inbox.id, outcome: inbox.result, batch: await getBatch(b.id) };
}

/** Manual result of one line (the bank portal shows it paid or rejected). */
export async function setLineResult(id, lineId, r, user) {
  return withTransaction(async (db) => {
    const outcome = await applyResults(db, id, [{ lineId, status: r.status, bankReference: r.bankReference, reason: r.reason }], { source: 'manual', userId: user?.id });
    if (!outcome.applied) throw conflict(`Line not updated: ${outcome.skipped[0]?.reason || 'unknown reason'}`);
    return { outcome, batch: await getBatch(id, db) };
  });
}

registerMessageType({ type: 'bank.payment_file', kind: 'bank_file', label: 'Bank payment file written for upload' });
registerMessageType({
  type: 'bank.status_file', kind: 'bank_file', label: 'Bank payment status file imported',
  onInbound: async (db, inbox) => {
    const p = inbox.payload || {};
    const outcome = await applyResults(db, p.batchId, p.rows || [], { source: 'file', userId: p.userId });
    return { entity: 'bank_payment_batch', entityId: p.batchId, result: outcome };
  },
});
