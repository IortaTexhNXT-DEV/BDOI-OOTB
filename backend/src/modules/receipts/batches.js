/**
 * Receipt voucher batches (TIS-BRD-COLL-08; migration 0528): one bulk upload of receipts is one batch (RVB-). A row of
 * the TISPH file can combine premium and commission (Amount = premium + Commission Amount). With
 * receipts.batch_commission_handling "separate" the premium part is receipted against the policy and the commission
 * part kept on the batch, exported for Accounting to reconcile with the insurer's commission; with "refuse" such a row
 * is refused.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { formatMoney, round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { camel } from '../accounting/lib/sheet.js';
import { mapColumns } from '../documents/tabular.js';
import { createReceipt, RECEIPT_UPLOAD_COLUMNS } from './service.js';

const amountOf = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return 0;
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) throw badRequest('Commission Amount must be a number of 0 or more');
  return round2(n);
};

export const batchOut = (b) => ({ id: b.id, batchNumber: b.batch_number, kind: b.kind || 'receipts', fileName: b.file_name, rows: b.row_count, created: b.created_count, failed: b.failed_count,
  premiumTotal: Number(b.premium_total), commissionTotal: Number(b.commission_total), commissionRows: (b.commission_lines || []).length, createdBy: b.created_by_name || null,
  createdAt: b.created_at });

/**
 * Receipt the rows of a file as one batch. parse(values) turns the mapped columns of a row into the receipt body.
 * Returns { batch, ids, errors: [{ row, message, issues }], commissionText }.
 */
export async function runBatch(rows, { fileName, parse, user }) {
  const handling = String((await getSetting('receipts.batch_commission_handling', 'separate')) || 'separate');
  const number = await nextDocumentNumber('receipt_batch');
  const batch = await one('INSERT INTO receipt_batches(batch_number, file_name, row_count, created_by) VALUES ($1,$2,$3,$4) RETURNING *', [number, fileName || null, rows.length, user?.id ?? null]);
  const ids = []; const errors = []; const commission = [];
  let premiumTotal = 0;
  for (const [i, r] of rows.entries()) {
    const row = i + 2;
    try {
      const v = mapColumns(r, RECEIPT_UPLOAD_COLUMNS, camel);
      const total = round2(Number(String(v.amount ?? '').replace(/,/g, '')));
      const part = amountOf(v.commissionAmount);
      if (part > 0 && handling === 'refuse') throw badRequest('The row carries a commission amount; upload the premium receipts only');
      if (part > 0 && !(part < total)) throw badRequest('Commission Amount must be less than the Amount of the row');
      const premium = round2(total - part);
      const body = parse({ ...v, amount: Number.isFinite(premium) ? premium : v.amount });
      const rc = await withTransaction(async (db) => {
        const created = await createReceipt(db, body, user, { source: 'bulk-upload' });
        await db.query('UPDATE receipts SET batch_id = $2 WHERE id = $1', [created.receiptId, batch.id]);
        return created;
      });
      ids.push(rc.receiptId);
      premiumTotal += Number(rc.amount);
      if (part > 0) {
        commission.push({ row, policyNumber: rc.policyNumber, clientName: rc.name, insurer: rc.policy?.insurer || null, amount: part, premium: Number(rc.amount),
          receiptNumber: rc.receiptNumber, referenceNo: rc.referenceNo || null, receiptDate: rc.receiptDate });
      }
    } catch (e) {
      errors.push({ row, message: e.message, issues: e.issues });
    }
  }
  const commissionTotal = round2(commission.reduce((s, l) => s + l.amount, 0));
  const saved = await one(`UPDATE receipt_batches SET created_count = $2, failed_count = $3, premium_total = $4, commission_total = $5, commission_lines = $6::jsonb
    WHERE id = $1 RETURNING *`, [batch.id, ids.length, errors.length, round2(premiumTotal), commissionTotal, JSON.stringify(commission)]);
  return { batch: batchOut(saved), ids, errors, commissionText: await formatMoney(commissionTotal) };
}

export async function listBatches() {
  return (await many(`SELECT b.*, (SELECT display_name FROM users u WHERE u.id = b.created_by) AS created_by_name FROM receipt_batches b ORDER BY b.created_at DESC LIMIT 200`))
    .map(batchOut);
}

export async function getBatch(ref) {
  const b = (await query(`SELECT b.*, (SELECT display_name FROM users u WHERE u.id = b.created_by) AS created_by_name FROM receipt_batches b
    WHERE b.id = $1 OR b.batch_number = $1`, [String(ref)])).rows[0];
  if (!b) throw notFound('Receipt batch not found');
  const { bankLines } = await import('./bankPayments.js');
  return { ...batchOut(b), commissionLines: b.commission_lines || [], lines: b.kind === 'bank-payments' ? await bankLines(b.id) : [] };
}
