/**
 * Payment uploads that are matched to the bills (migration 0530):
 *   bank payments    a bank's report of the payments credited to TISPH (FGA-BR-01 to BR-07, TIS-BRD-COLL-09): each line
 *                    is matched by its reference (10-digit payment reference, policy number or bill number) to what the
 *                    policy owes. Within bank_matching.tolerance it is matched; above it the receipt pays the bills and
 *                    the excess is held On Account (overpaid); below it the receipt pays part (underpaid, listed as an
 *                    insufficient payment); with no bill found the payment is held as a floating payment.
 *   insurer direct   payments the clients made to the insurance company (TIS-BRD-COLL-07, FGA-PC-07): each settles the
 *                    policy's bills with a receipt of channel insurer-direct (Dr premium payable / Cr premium receivable).
 * Each upload is a receipt batch (RVB-) with its lines.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { isoDate, today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { camel, excelDate } from '../accounting/lib/sheet.js';
import { mapColumns } from '../documents/tabular.js';
import { createReceipt } from './service.js';
import { findPolicy } from './receivables.js';
import { holdUnapplied } from './unapplied.js';

export const BANK_PAYMENT_COLUMNS = [
  { key: 'paidOn', header: 'Date', aliases: ['paymentDate', 'valueDate', 'date'], required: true, format: 'Date the bank credited the payment, YYYY-MM-DD', example: '2026-10-05' },
  { key: 'reference', header: 'Reference', aliases: ['referenceNo', 'paymentReference'], required: true, format: 'The 10-digit payment reference the client quoted (or the policy or bill number)', example: '1000000016' },
  { key: 'amount', header: 'Amount', required: true, format: 'Amount credited in PHP, greater than zero', example: '35946.88' },
  { key: 'bankAccount', header: 'Bank Account', aliases: ['account'], format: 'Bank account code of the collection account; the receipt default when empty', example: 'ACC-MBT-001' },
  { key: 'payer', header: 'Payer', aliases: ['payerName', 'name'], format: 'Name on the bank line', example: 'Andrea Villanueva' },
  { key: 'remarks', header: 'Remarks', format: 'Text', example: '' },
];

export const INSURER_DIRECT_COLUMNS = [
  { key: 'policyNumber', header: 'Policy Number', aliases: ['policy', 'reference', 'paymentReference'], required: true, format: 'Policy number or its 10-digit payment reference', example: 'PC-MLY-2026-000101' },
  { key: 'amount', header: 'Amount', required: true, format: 'Amount the client paid to the insurer, PHP, not above what the policy owes', example: '35946.88' },
  { key: 'paidOn', header: 'Date Paid', aliases: ['paymentDate', 'date'], required: true, format: 'Date the insurer received it, YYYY-MM-DD, not in the future', example: '2026-10-05' },
  { key: 'insurerReference', header: 'Insurer Reference', aliases: ['insurerOr', 'orNumber'], format: "The insurer's receipt or reference", example: 'MIC-OR-004512' },
  { key: 'remarks', header: 'Remarks', format: 'Text', example: '' },
];

const amountOf = (v, label = 'Amount') => {
  const n = round2(Number(String(v ?? '').replace(/,/g, '')));
  if (!Number.isFinite(n) || !(n > 0)) throw badRequest(`${label} must be a number greater than zero`);
  return n;
};
const dateOf = async (v, label) => {
  const d = excelDate(v) || isoDate(v);
  if (!d) throw badRequest(`${label} is not a valid date`);
  if (d > (await today())) throw badRequest(`${label} cannot be in the future`);
  return d;
};

async function newBatch(kind, fileName, rows, user) {
  const number = await nextDocumentNumber('receipt_batch');
  return one('INSERT INTO receipt_batches(batch_number, kind, file_name, row_count, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *', [number, kind, fileName || null, rows, user?.id ?? null]);
}
async function closeBatch(batch, created, failed, total) {
  return one('UPDATE receipt_batches SET created_count = $2, failed_count = $3, premium_total = $4 WHERE id = $1 RETURNING *', [batch.id, created, failed, round2(total)]);
}

/** What a reference finds: { policy, bill } (bill only for a bill number) or null. */
async function findByReference(db, reference) {
  const bill = (await db.query('SELECT * FROM receivables WHERE bill_number = $1 OR reference = $1 LIMIT 1', [reference])).rows[0];
  if (bill?.policy_id) return { policy: await findPolicy(db, bill.policy_id), bill };
  const policy = await findPolicy(db, reference);
  return policy ? { policy, bill: null } : null;
}
const owedOn = async (db, policyId) => round2(Number((await db.query(`SELECT COALESCE(sum(balance), 0) AS s FROM receivables WHERE policy_id = $1 AND status IN ('open', 'partial')`,
  [policyId])).rows[0].s));

/** Match and receipt the lines of a bank's payment report. Returns { batch, counts, errors, ids }. */
export async function runBankUpload(rows, { fileName, user }) {
  const tolerance = Number(await getSetting('bank_matching.tolerance', 1)) || 0;
  const batch = await newBatch('bank-payments', fileName, rows.length, user);
  const counts = { matched: 0, overpaid: 0, underpaid: 0, unmatched: 0, failed: 0 };
  const errors = []; const ids = [];
  let total = 0;
  for (const [i, raw] of rows.entries()) {
    const row = i + 2;
    let v = {};
    try {
      v = mapColumns(raw, BANK_PAYMENT_COLUMNS, camel);
      const reference = String(v.reference ?? '').trim();
      if (!reference) throw badRequest('Reference is required');
      const amount = amountOf(v.amount);
      const paidOn = await dateOf(v.paidOn, 'Date');
      const line = await withTransaction(async (db) => {
        const found = await findByReference(db, reference);
        const base = { batch_id: batch.id, row_no: row, paid_on: paidOn, reference, amount, bank_account: v.bankAccount || null, payer: v.payer || null };
        if (!found || found.policy.billing_mode === 'direct' || !((await owedOn(db, found.policy.id)) > 0)) {
          const hold = await holdUnapplied(db, { kind: 'floating', amount, date: paidOn, paymentMode: 'bank-transfer', referenceNo: reference, bankAccount: v.bankAccount || null,
            payerName: v.payer || null, clientId: found?.policy?.client_id || null, remarks: found ? `Nothing open on ${found.policy.policy_number}` : 'No policy or bill found for the reference', user });
          return { ...base, outcome: 'unmatched', policy_id: found?.policy?.id || null, unapplied_id: hold.id, message: found ? 'Nothing open on the policy: held as a floating payment' : 'No policy or bill found: held as a floating payment' };
        }
        const expected = found.bill && ['open', 'partial'].includes(found.bill.status) ? round2(found.bill.balance) : await owedOn(db, found.policy.id);
        const difference = round2(amount - expected);
        const outcome = Math.abs(difference) <= tolerance ? 'matched' : difference > 0 ? 'overpaid' : 'underpaid';
        const rc = await createReceipt(db, { policyId: found.policy.id, amount, receiptDate: paidOn, paymentMode: 'bank-transfer', referenceNo: reference,
          bankAccountCode: v.bankAccount || undefined, remarks: [`Bank payment ${batch.batch_number} line ${row}`, v.remarks].filter(Boolean).join('. ') }, user, { source: 'bank-upload' });
        await db.query('UPDATE receipts SET batch_id = $2 WHERE id = $1', [rc.receiptId, batch.id]);
        const hold = (await db.query('SELECT id FROM unapplied_collections WHERE receipt_id = $1 ORDER BY created_at LIMIT 1', [rc.receiptId])).rows[0];
        return { ...base, outcome, receivable_id: found.bill?.id || null, policy_id: found.policy.id, receipt_id: rc.receiptId, unapplied_id: hold?.id || null, expected, difference,
          message: outcome === 'overpaid' ? 'Excess held On Account' : outcome === 'underpaid' ? 'Insufficient payment' : null };
      });
      await one(`INSERT INTO bank_payment_lines(batch_id, row_no, paid_on, reference, amount, bank_account, payer, outcome, receivable_id, policy_id, receipt_id, unapplied_id, expected, difference, message)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`, [line.batch_id, line.row_no, line.paid_on, line.reference, line.amount, line.bank_account, line.payer,
        line.outcome, line.receivable_id || null, line.policy_id || null, line.receipt_id || null, line.unapplied_id || null, line.expected ?? null, line.difference ?? null, line.message || null]);
      counts[line.outcome] += 1;
      total += line.amount;
      if (line.receipt_id) ids.push(line.receipt_id);
    } catch (e) {
      counts.failed += 1;
      errors.push({ row, message: e.message, issues: e.issues });
      await one(`INSERT INTO bank_payment_lines(batch_id, row_no, reference, outcome, message) VALUES ($1,$2,$3,'failed',$4) RETURNING id`,
        [batch.id, row, v.reference ? String(v.reference) : null, e.message]);
    }
  }
  const saved = await closeBatch(batch, rows.length - counts.failed, counts.failed, total);
  return { batch: saved, counts, errors, ids };
}

/** Receipt the payments made directly to the insurance company. Returns { batch, errors, ids }. */
export async function runInsurerDirectUpload(rows, { fileName, user }) {
  const tolerance = Number(await getSetting('bank_matching.tolerance', 1)) || 0;
  const batch = await newBatch('insurer-direct', fileName, rows.length, user);
  const errors = []; const ids = [];
  let total = 0;
  for (const [i, raw] of rows.entries()) {
    const row = i + 2;
    try {
      const v = mapColumns(raw, INSURER_DIRECT_COLUMNS, camel);
      const amount = amountOf(v.amount);
      const paidOn = await dateOf(v.paidOn, 'Date Paid');
      const rc = await withTransaction(async (db) => {
        const policy = await findPolicy(db, String(v.policyNumber ?? '').trim());
        if (!policy) throw badRequest(`Policy ${v.policyNumber} not found`);
        if (policy.billing_mode === 'direct') throw badRequest(`Policy ${policy.policy_number} is direct billed: the insurer bills the client`);
        const owed = await owedOn(db, policy.id);
        if (amount > owed + tolerance) throw badRequest(`Policy ${policy.policy_number} owes ${owed.toFixed(2)}; the amount paid to the insurer is more`);
        const created = await createReceipt(db, { policyId: policy.id, amount: Math.min(amount, owed), receiptDate: paidOn, paymentMode: 'bank-transfer',
          referenceNo: v.insurerReference || null, collectedByInsurerId: policy.insurance_company_id, partnerReference: v.insurerReference || null,
          remarks: [`Paid to ${policy.insurer_name || 'the insurer'} (${batch.batch_number} line ${row})`, v.remarks].filter(Boolean).join('. ') }, user, { source: 'insurer-direct' });
        await db.query('UPDATE receipts SET batch_id = $2 WHERE id = $1', [created.receiptId, batch.id]);
        return created;
      });
      ids.push(rc.receiptId);
      total += Number(rc.amount);
    } catch (e) {
      errors.push({ row, message: e.message, issues: e.issues });
    }
  }
  const saved = await closeBatch(batch, ids.length, errors.length, total);
  return { batch: saved, errors, ids };
}

/** The lines of a bank payment batch, in file order. */
export async function bankLines(batchId) {
  return (await many(`SELECT l.*, p.policy_number, r.receipt_number, c.display_name AS client_name FROM bank_payment_lines l
    LEFT JOIN policies p ON p.id = l.policy_id LEFT JOIN receipts r ON r.id = l.receipt_id LEFT JOIN clients c ON c.id = p.client_id
    WHERE l.batch_id = $1 ORDER BY l.row_no`, [batchId])).map((l) => ({ row: l.row_no, paidOn: isoDate(l.paid_on), reference: l.reference, amount: l.amount === null ? null : Number(l.amount),
    outcome: l.outcome, policyNumber: l.policy_number, clientName: l.client_name || l.payer, receiptNumber: l.receipt_number, expected: l.expected === null ? null : Number(l.expected),
    difference: l.difference === null ? null : Number(l.difference), message: l.message }));
}
