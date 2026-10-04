/**
 * Post-dated cheque register (Accounts > Post-Dated Cheques).
 *
 * A cheque received from a client against a bill (or a policy) is registered on hand with its drawee bank, number,
 * date, amount and the vault where it is kept; nothing is posted then. On or after its date it is deposited: the
 * official receipt is created through the receipts module (receivable credited, posting rule receipt.apply on the bank
 * account deposited to). The bank's answer is recorded: cleared, or bounced, which cancels that receipt (its journal is
 * reversed and the bill is open again), tells Accounting and, with pdc.notify_client_on_bounce, the client. A bounced
 * cheque is replaced by a new one (linked both ways); an unused cheque can be returned to the client or cancelled.
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { formatMoney } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { queueEmail } from '../../lib/mailer.js';
import { companyName } from '../../lib/letterhead.js';
import { notify } from '../notifications/service.js';
import { emailTemplate, renderTemplate } from '../documents/common.js';
import { createReceipt, cancelReceipt } from '../receipts/service.js';

const EPS = 0.005;
const SELECT = `SELECT d.*, c.display_name AS client_name, c.client_code, c.email AS client_email, p.policy_number, r.bill_number, r.balance AS bill_balance,
  b.name AS bank_name, rc.receipt_number, (SELECT u.display_name FROM users u WHERE u.id = d.created_by) AS created_by_name,
  (SELECT x.pdc_number FROM post_dated_cheques x WHERE x.id = d.replaced_by_id) AS replaced_by_number,
  (SELECT x.pdc_number FROM post_dated_cheques x WHERE x.id = d.replaces_id) AS replaces_number
  FROM post_dated_cheques d LEFT JOIN clients c ON c.id = d.client_id LEFT JOIN policies p ON p.id = d.policy_id LEFT JOIN receivables r ON r.id = d.receivable_id
  LEFT JOIN banks b ON b.id = d.bank_id LEFT JOIN receipts rc ON rc.id = d.receipt_id`;

const out = (r, asOf) => r && ({
  id: r.id, pdcNumber: r.pdc_number, clientId: r.client_id, clientCode: r.client_code || null, clientName: r.client_name || null, policyId: r.policy_id, policyNumber: r.policy_number || null,
  receivableId: r.receivable_id, billNumber: r.bill_number || null, billBalance: r.bill_balance === null || r.bill_balance === undefined ? null : Number(r.bill_balance),
  bankId: r.bank_id, bankName: r.bank_name || r.drawee_bank || null, draweeBank: r.drawee_bank, branch: r.branch, chequeNumber: r.cheque_number, chequeDate: isoDate(r.cheque_date),
  amount: Number(r.amount), receivedDate: isoDate(r.received_date), storageLocation: r.storage_location, status: r.status,
  dueInDays: asOf && r.status === 'on-hand' ? Math.round((Date.parse(isoDate(r.cheque_date)) - Date.parse(asOf)) / 86400000) : null,
  depositAccount: r.deposit_account, depositedOn: isoDate(r.deposited_on), receiptId: r.receipt_id, receiptNumber: r.receipt_number || null, clearedOn: isoDate(r.cleared_on),
  bouncedOn: isoDate(r.bounced_on), bounceReason: r.bounce_reason, bounceCharge: Number(r.bounce_charge), replacesId: r.replaces_id, replacesNumber: r.replaces_number || null,
  replacedById: r.replaced_by_id, replacedByNumber: r.replaced_by_number || null, returnedOn: isoDate(r.returned_on), returnReason: r.return_reason, remarks: r.remarks,
  createdBy: r.created_by_name || r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function getPdc(db, ref) {
  const r = (await db.query(`${SELECT} WHERE d.id = $1 OR d.pdc_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Post-dated cheque not found');
  return out(r, await today());
}

/** Register: status (on-hand | deposited | cleared | bounced | replaced | returned | cancelled | open | all), dueBy, clientId, policyId, search. */
export async function listPdcs(db, q = {}) {
  const asOf = await today();
  const where = ['TRUE'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status === 'open') where.push("d.status IN ('on-hand', 'deposited')");
  else if (q.status && q.status !== 'all') add('d.status = ?', q.status);
  if (q.dueBy) add("d.status = 'on-hand' AND d.cheque_date <= ?::date", isoDate(q.dueBy));
  if (q.clientId) add('(d.client_id = ? OR c.client_code = ?)', q.clientId);
  if (q.policyId) add('(d.policy_id = ? OR p.policy_number = ?)', q.policyId);
  if (q.search) add(`(d.pdc_number ILIKE '%' || ? || '%' OR d.cheque_number ILIKE '%' || ? || '%' OR c.display_name ILIKE '%' || ? || '%' OR p.policy_number ILIKE '%' || ? || '%'
    OR r.bill_number ILIKE '%' || ? || '%')`, q.search);
  const rows = (await db.query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY d.cheque_date, d.pdc_number LIMIT 2000`, params)).rows.map((r) => out(r, asOf));
  const onHand = (await db.query(`SELECT count(*)::int AS n, COALESCE(sum(amount), 0) AS a, count(*) FILTER (WHERE cheque_date <= $1::date)::int AS due,
    COALESCE(sum(amount) FILTER (WHERE cheque_date <= $1::date), 0) AS due_amount FROM post_dated_cheques WHERE status = 'on-hand'`, [asOf])).rows[0];
  return { asOf, summary: { onHand: onHand.n, onHandAmount: Number(onHand.a), dueNow: onHand.due, dueNowAmount: Number(onHand.due_amount),
    bounced: (await db.query("SELECT count(*)::int AS n FROM post_dated_cheques WHERE status = 'bounced'")).rows[0].n }, rows };
}

/** Cheques on hand due for deposit within pdc.due_window_days (or by the given date). */
export async function depositDue(db, { asOf = null } = {}) {
  const now = asOf || (await today());
  const window = Number(await getSetting('pdc.due_window_days', 3)) || 0;
  const rows = (await db.query(`${SELECT} WHERE d.status = 'on-hand' AND d.cheque_date <= ($1::date + $2::int) ORDER BY d.cheque_date, d.pdc_number`, [now, window])).rows.map((r) => out(r, now));
  return { asOf: now, windowDays: window, total: round2(rows.reduce((s, r) => s + r.amount, 0)), rows };
}

async function lockPdc(db, id) {
  const r = (await db.query('SELECT * FROM post_dated_cheques WHERE id = $1 OR pdc_number = $1 FOR UPDATE', [String(id)])).rows[0];
  if (!r) throw notFound('Post-dated cheque not found');
  return r;
}

/** What the cheque pays: the bill (and its policy and client), or the policy. */
async function targetOf(db, b) {
  if (b.receivableId) {
    const r = (await db.query('SELECT r.*, p.billing_mode FROM receivables r LEFT JOIN policies p ON p.id = r.policy_id WHERE r.id = $1 OR r.bill_number = $1', [String(b.receivableId)])).rows[0];
    if (!r) throw notFound(`Bill ${b.receivableId} not found`);
    if (!['open', 'partial'].includes(r.status) || !(Number(r.balance) > EPS)) throw conflict(`Bill ${r.bill_number} has no open balance`);
    return { receivable: r, policyId: r.policy_id, clientId: r.client_id };
  }
  if (b.policyId) {
    const p = (await db.query('SELECT id, client_id, policy_number, billing_mode FROM policies WHERE id = $1 OR policy_number = $1', [String(b.policyId)])).rows[0];
    if (!p) throw notFound(`Policy ${b.policyId} not found`);
    if (p.billing_mode === 'direct') throw conflict(`Policy ${p.policy_number} is direct billed: the client pays the insurer`);
    return { receivable: null, policyId: p.id, clientId: p.client_id };
  }
  throw badRequest('Validation failed', [{ path: 'receivableId', message: 'Give the bill (receivableId) or the policy (policyId) the cheque pays' }]);
}

/** Register a cheque on hand. b: { receivableId | policyId, bankId | draweeBank, branch, chequeNumber, chequeDate, amount, receivedDate, storageLocation, remarks, replacesId }. */
export async function registerPdc(db, b, user) {
  const t = await targetOf(db, b);
  const amount = round2(b.amount);
  if (!(amount > 0)) throw badRequest('Validation failed', [{ path: 'amount', message: 'Amount must be greater than zero' }]);
  if (!b.bankId && !String(b.draweeBank || '').trim()) throw badRequest('Validation failed', [{ path: 'bankId', message: 'Choose the drawee bank' }]);
  if (t.receivable) {
    const pending = Number((await db.query(`SELECT COALESCE(sum(amount), 0) AS a FROM post_dated_cheques WHERE receivable_id = $1 AND status IN ('on-hand', 'deposited')
      AND ($2::text IS NULL OR id <> $2)`, [t.receivable.id, b.replacesId || null])).rows[0].a);
    const room = round2(Number(t.receivable.balance) - pending);
    if (amount > room + EPS) throw conflict(`Bill ${t.receivable.bill_number} has ${room.toFixed(2)} left after the cheques already on hand; this cheque is ${amount.toFixed(2)}`);
  }
  const number = await nextDocumentNumber('pdc', { db, unique: { table: 'post_dated_cheques', column: 'pdc_number' } });
  const r = (await db.query(`INSERT INTO post_dated_cheques(pdc_number, client_id, policy_id, receivable_id, bank_id, drawee_bank, branch, cheque_number, cheque_date, amount, received_date,
      storage_location, remarks, replaces_id, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id`,
  [number, t.clientId, t.policyId, t.receivable?.id || null, b.bankId || null, b.draweeBank || null, b.branch || null, String(b.chequeNumber).trim(), isoDate(b.chequeDate), amount,
    isoDate(b.receivedDate) || (await today()), b.storageLocation || null, b.remarks || null, b.replacesId || null, user?.id ?? null])).rows[0]
    .id;
  return getPdc(db, r);
}

/** Deposit a cheque on or after its date: the official receipt is created and posted. b: { depositAccount, depositDate }. */
export async function depositPdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.status !== 'on-hand') throw conflict(`Cheque ${d.pdc_number} is ${d.status}; only a cheque on hand is deposited`);
  const on = isoDate(b.depositDate) || (await today());
  if (on < isoDate(d.cheque_date)) throw conflict(`Cheque ${d.pdc_number} is dated ${isoDate(d.cheque_date)}; it cannot be deposited before its date`);
  const account = b.depositAccount || (await getSetting('pdc.default_deposit_account', '')) || null;
  if (!account) throw badRequest('Validation failed', [{ path: 'depositAccount', message: 'Choose the bank account the cheque is deposited to' }]);
  const bill = d.receivable_id ? (await db.query('SELECT id, balance, status FROM receivables WHERE id = $1', [d.receivable_id])).rows[0] : null;
  const onBill = bill && ['open', 'partial'].includes(bill.status) && Number(bill.balance) + EPS >= Number(d.amount);
  const receipt = await createReceipt(db, {
    ...(onBill ? { receivableId: bill.id } : { policyId: d.policy_id }), amount: Number(d.amount), paymentMode: 'check', referenceNo: `Cheque ${d.cheque_number}`,
    bankId: d.bank_id || null, receiptDate: on, bankAccountCode: account, remarks: `Post-dated cheque ${d.pdc_number} (cheque ${d.cheque_number} dated ${isoDate(d.cheque_date)})`,
  }, user, { source: 'pdc' });
  await db.query(`UPDATE post_dated_cheques SET status = 'deposited', deposit_account = $2, deposited_on = $3, deposited_by = $4, receipt_id = $5, updated_by = $4, updated_at = now()
    WHERE id = $1`, [d.id, account, on, user?.id ?? null, receipt.receiptId || receipt.id]);
  return { pdc: await getPdc(db, d.id), receiptNumber: receipt.receiptNumber };
}

export async function clearPdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (d.status !== 'deposited') throw conflict(`Cheque ${d.pdc_number} is ${d.status}; only a deposited cheque clears`);
  await db.query('UPDATE post_dated_cheques SET status = \'cleared\', cleared_on = $2, updated_by = $3, updated_at = now() WHERE id = $1', [d.id, isoDate(b.clearedOn) || (await today()), user?.id ?? null]);
  return getPdc(db, d.id);
}

/** The bank returned the cheque: its receipt is cancelled (the bill is open again), Accounting and the client are told. */
export async function bouncePdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (!['deposited', 'cleared'].includes(d.status)) throw conflict(`Cheque ${d.pdc_number} is ${d.status}; only a deposited cheque can bounce`);
  const reason = String(b.reason || '').trim();
  if (!reason) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason the bank returned the cheque (e.g. DAIF, account closed)' }]);
  if (d.receipt_id) {
    const rc = (await db.query('SELECT receipt_status FROM receipts WHERE id = $1', [d.receipt_id])).rows[0];
    if (rc && rc.receipt_status !== 'Cancelled') await cancelReceipt(db, d.receipt_id, `Cheque ${d.cheque_number} bounced: ${reason}`, user);
  }
  await db.query(`UPDATE post_dated_cheques SET status = 'bounced', bounced_on = $2, bounce_reason = $3, bounce_charge = $4, updated_by = $5, updated_at = now() WHERE id = $1`,
    [d.id, isoDate(b.bouncedOn) || (await today()), reason, round2(b.bounceCharge || 0), user?.id ?? null]);
  const pdc = await getPdc(db, d.id);
  await notify({ type: 'task', priority: 'high', title: `Cheque ${pdc.chequeNumber} bounced`, audience: 'write:receipts',
    message: `${pdc.pdcNumber}: cheque ${pdc.chequeNumber} of ${pdc.clientName || 'the client'} for ${await formatMoney(pdc.amount)} was returned (${reason}). Receipt ${pdc.receiptNumber || ''} was cancelled; ask for a replacement.`.replace(/\s+/g, ' '),
    link: '/accounts/post-dated-cheques', entity: 'post_dated_cheque', entityId: pdc.id });
  let emailedTo = null;
  if ((await getSetting('pdc.notify_client_on_bounce', true)) !== false && d.client_id) {
    const c = (await db.query('SELECT email, display_name FROM clients WHERE id = $1', [d.client_id])).rows[0];
    if (c?.email) {
      const t = await emailTemplate('pdc_bounced');
      const v = { clientName: c.display_name, chequeNumber: pdc.chequeNumber, bankName: pdc.bankName || '', chequeDate: pdc.chequeDate, amount: pdc.amount.toFixed(2),
        currency: await getSetting('currency.default', 'PHP'), reason, policyNumber: pdc.policyNumber || '', companyName: await companyName() };
      await queueEmail({ db, to: c.email, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'pdc_bounced', entity: 'post_dated_cheque', entityId: pdc.id });
      emailedTo = c.email;
    }
  }
  return { pdc, emailedTo };
}

/** Replace a bounced (or on-hand) cheque by a new one for the same bill or policy. */
export async function replacePdc(db, id, b, user) {
  const d = await lockPdc(db, id);
  if (!['bounced', 'on-hand'].includes(d.status)) throw conflict(`Cheque ${d.pdc_number} is ${d.status}; only a bounced or on-hand cheque is replaced`);
  const target = d.receivable_id && (await db.query('SELECT 1 FROM receivables WHERE id = $1 AND status IN (\'open\', \'partial\') AND balance > 0', [d.receivable_id])).rowCount
    ? { receivableId: d.receivable_id } : { policyId: d.policy_id };
  const fresh = await registerPdc(db, { ...b, ...target, replacesId: d.id, amount: b.amount ?? Number(d.amount) }, user);
  await db.query('UPDATE post_dated_cheques SET status = \'replaced\', replaced_by_id = $2, updated_by = $3, updated_at = now() WHERE id = $1', [d.id, fresh.id, user?.id ?? null]);
  return { replaced: await getPdc(db, d.id), pdc: fresh };
}

/** Give an unused cheque back to the client (returned) or void a registration made in error (cancelled). */
export async function closePdc(db, id, kind, reason, user) {
  const d = await lockPdc(db, id);
  if (d.status !== 'on-hand') throw conflict(`Cheque ${d.pdc_number} is ${d.status}; only a cheque on hand can be ${kind}`);
  if (!String(reason || '').trim()) throw badRequest('Validation failed', [{ path: 'reason', message: 'A reason is required' }]);
  if (kind === 'returned') {
    await db.query('UPDATE post_dated_cheques SET status = \'returned\', returned_on = $2, return_reason = $3, updated_by = $4, updated_at = now() WHERE id = $1', [d.id, await today(), reason, user?.id ?? null]);
  } else {
    await db.query('UPDATE post_dated_cheques SET status = \'cancelled\', remarks = concat_ws(\' / \', remarks, $2::text), updated_by = $3, updated_at = now() WHERE id = $1', [d.id, `Cancelled: ${reason}`, user?.id ?? null]);
  }
  return getPdc(db, d.id);
}

/** Daily job: tell Accounting which cheques are due for deposit. */
export async function depositDueJob(db) {
  const due = await depositDue(db);
  if (!due.rows.length) return { due: 0 };
  const now = due.asOf;
  const today0 = due.rows.filter((r) => r.chequeDate <= now).length;
  await notify({ type: 'reminder', title: `${due.rows.length} post-dated cheque(s) due for deposit`, audience: 'write:receipts',
    message: `${today0} due today or earlier and ${due.rows.length - today0} within ${due.windowDays} day(s), ${await formatMoney(due.total)} in all.`,
    link: '/accounts/post-dated-cheques', entity: 'post_dated_cheque', entityId: now });
  return { due: due.rows.length, total: due.total };
}
