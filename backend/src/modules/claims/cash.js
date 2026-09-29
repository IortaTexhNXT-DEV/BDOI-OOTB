/**
 * Cash side of a claim settled through the broker. The settlement journal (claim.settlement.paid_through_broker) books
 * the amount recoverable from each insurer against the amount payable to the claimant; this module records
 * - funds received from an insurer into a bank account (posting rule claim.funds_received: Dr bank / Cr claims receivable)
 * - payment to the claimant by voucher / cheque or transfer (posting rule claim.paid_to_claimant: Dr claims payable / Cr bank)
 * and never lets either exceed what is due (each insurer's share; the settlement amount).
 */
import { pool, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { postEvent } from '../accounting/lib/posting.js';
import { allocate, policyParticipants } from '../accounting/lib/coinsurance.js';
import { isoDate, round2 } from '../accounting/lib/http.js';

async function loadClaim(db, id, lock = false) {
  const c = (await db.query(`SELECT c.*, p.policy_number, p.client_id AS policy_client_id, cl.display_name AS client_name FROM claims c JOIN policies p ON p.id = c.policy_id
    LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id) WHERE c.id = $1 OR c.claim_number = $1 ${lock ? 'FOR UPDATE OF c' : ''}`, [id])).rows[0];
  if (!c) throw notFound('Claim not found');
  return c;
}

const movementRow = (m) => ({
  id: Number(m.id), kind: m.kind, insurerId: m.insurance_company_id, insurer: m.insurer_name || null, amount: Number(m.amount), date: m.movement_date,
  bankAccount: m.bank_account, paymentMode: m.payment_mode, reference: m.reference, payee: m.payee, remarks: m.remarks, journalId: m.journal_id,
  journalNumber: m.jv_number || null, createdBy: m.created_by_name || m.created_by, createdAt: m.created_at,
});

/** Settlement cash position: what each insurer owes and has paid, what the claimant is owed and has been paid, the movements. */
export async function settlementCash(db, id) {
  const c = await loadClaim(db, id);
  const amount = round2(Number(c.settled_amount ?? c.settlement?.settlementAmount ?? 0));
  const throughBroker = !!c.settlement?.paidThroughBroker;
  const parts = await policyParticipants(c.policy_id, db);
  const shares = amount > 0 && parts.length ? allocate(amount, parts.map((p) => p.share)) : [];
  const moves = (await db.query(`SELECT m.*, ic.name AS insurer_name, j.jv_number, (SELECT display_name FROM users u WHERE u.id = m.created_by) AS created_by_name
    FROM claim_settlement_movements m LEFT JOIN insurance_companies ic ON ic.id = m.insurance_company_id LEFT JOIN journal_vouchers j ON j.id = m.journal_id
    WHERE m.claim_id = $1 ORDER BY m.movement_date, m.id`, [c.id])).rows.map(movementRow);
  const received = (insurerId) => round2(moves.filter((m) => m.kind === 'funds-received' && m.insurerId === insurerId).reduce((s, m) => s + m.amount, 0));
  const insurers = parts.map((p, i) => ({ insurerId: p.insurerId, insurer: p.insurerName, share: p.share, recoverable: shares[i] || 0, received: received(p.insurerId),
    outstanding: round2((shares[i] || 0) - received(p.insurerId)) }));
  const paid = round2(moves.filter((m) => m.kind === 'paid-to-claimant').reduce((s, m) => s + m.amount, 0));
  const bankAccounts = (await db.query(`SELECT code, name, data->>'glAccount' AS gl, data->>'bankName' AS bank FROM master_records
    WHERE type_code = 'bank-account' AND status = 'active' ORDER BY code`)).rows.map((b) => ({ code: b.code, name: b.name, glAccount: b.gl, bankName: b.bank }));
  return {
    claimId: c.id, claimNumber: c.claim_number, policyNumber: c.policy_number, status: c.status, paidThroughBroker: throughBroker, settlementPosted: !!c.settlement_jv_id,
    // cash can be recorded once the settlement through the broker is booked
    canRecord: throughBroker && !!c.settlement_jv_id && ['settled', 'closed'].includes(c.status),
    settlementAmount: amount, claimant: c.settlement?.payee || c.client_name || '', insurers,
    totalRecoverable: round2(insurers.reduce((s, x) => s + x.recoverable, 0)), totalReceived: round2(insurers.reduce((s, x) => s + x.received, 0)),
    paidToClaimant: paid, payableToClaimant: round2(amount - paid), movements: moves, bankAccounts,
  };
}

const positive = (v, field) => {
  const n = round2(Number(v));
  if (!(n > 0)) throw badRequest('Validation failed', [{ path: field, message: `${field} must be greater than zero` }]);
  return n;
};

/**
 * Record a cash movement. kind funds-received: { insurerId (optional for a single insurer), amount, bankAccount, date,
 * reference, remarks }; kind paid-to-claimant: { amount, bankAccount, paymentMode (check | bank-transfer | cash),
 * reference (voucher / cheque number), payee, date, remarks }.
 */
export async function recordMovement(id, kind, b, user) {
  return withTransaction(async (db) => {
    const c = await loadClaim(db, id, true);
    const pos = await settlementCash(db, c.id);
    if (!pos.paidThroughBroker) throw conflict(`Claim ${c.claim_number} is not settled through the broker; the insurer pays the claimant directly`);
    if (!pos.canRecord) throw conflict(`Claim ${c.claim_number} has no booked settlement through the broker yet`);
    const amount = positive(b.amount, 'amount');
    const date = isoDate(b.date) || null;
    if (!b.bankAccount) throw badRequest('Validation failed', [{ path: 'bankAccount', message: 'bankAccount is required' }]);
    const vars = { claimNumber: c.claim_number, memoRef: b.reference ? `${kind === 'funds-received' ? 'Advice' : 'Voucher'} ${b.reference}` : `Claim ${c.claim_number}` };
    let insurer = null;
    let jv;
    if (kind === 'funds-received') {
      insurer = b.insurerId ? pos.insurers.find((x) => String(x.insurerId) === String(b.insurerId)) : pos.insurers.length === 1 ? pos.insurers[0] : null;
      if (!insurer) throw badRequest('Validation failed', [{ path: 'insurerId', message: 'Choose the insurer the funds came from' }]);
      if (amount > insurer.outstanding + 0.005) throw conflict(`Only ${insurer.outstanding.toFixed(2)} is still due from ${insurer.insurer}`);
      jv = await postEvent('claim.funds_received', {
        date: date || undefined, source: 'claims', entryType: 'CLAIM_SETTLEMENT', transactionCode: c.claim_number, referenceType: 'Claim', referenceId: c.id,
        clientId: c.client_id || c.policy_client_id, policyId: c.policy_id, policyNumber: c.policy_number, insuranceCompanyId: insurer.insurerId,
        bankAccount: b.bankAccount, paymentMode: 'bank-transfer', amounts: { amount }, vars: { ...vars, insurer: insurer.insurer },
      }, { db, user });
    } else if (kind === 'paid-to-claimant') {
      if (amount > pos.payableToClaimant + 0.005) throw conflict(`Only ${pos.payableToClaimant.toFixed(2)} is still payable to the claimant`);
      jv = await postEvent('claim.paid_to_claimant', {
        date: date || undefined, source: 'claims', entryType: 'CLAIM_SETTLEMENT', transactionCode: b.reference || c.claim_number, referenceType: 'Claim', referenceId: c.id,
        clientId: c.client_id || c.policy_client_id, policyId: c.policy_id, policyNumber: c.policy_number, bankAccount: b.bankAccount, paymentMode: b.paymentMode || 'check',
        amounts: { amount }, vars: { ...vars, claimant: b.payee || pos.claimant || 'claimant' },
      }, { db, user });
    } else throw badRequest(`Unknown movement ${kind}`);
    await db.query(`INSERT INTO claim_settlement_movements(claim_id, kind, insurance_company_id, amount, movement_date, bank_account, payment_mode, reference, payee, remarks, journal_id, created_by)
      VALUES ($1,$2,$3,$4,COALESCE($5::date, numbering_business_date()),$6,$7,$8,$9,$10,$11,$12)`,
    [c.id, kind, insurer?.insurerId ?? null, amount, date, String(b.bankAccount), kind === 'paid-to-claimant' ? b.paymentMode || 'check' : 'bank-transfer', b.reference || null,
      kind === 'paid-to-claimant' ? b.payee || pos.claimant || null : null, b.remarks || null, jv.id, user?.id ?? null]);
    return { journalId: jv.id, journalNumber: jv.jv_number, position: await settlementCash(db, c.id) };
  });
}

export const cashPosition = (id) => settlementCash(pool, id);
