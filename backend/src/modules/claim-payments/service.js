/**
 * Claims paid through the broker, from the Accounting side (Accounts > Claims Settlements): the claims whose settlement
 * through the broker is booked (posting rule claim.settlement.paid_through_broker), what each insurer still owes and
 * what is still payable to the claimant. The cash itself is recorded with claims/cash.js (claim.funds_received into the
 * bank / claims receivable clearing account, claim.paid_to_claimant out of the claims payable fiduciary account), the
 * same as on the claim screen; this module adds the list, the claim payment voucher and the release form.
 */
import { notFound } from '../../lib/errors.js';
import { isoDate } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { renderPdf, formatAmount, formatDate, printFormat, amountInWords } from '../../lib/pdf/index.js';
import { companyName } from '../../lib/letterhead.js';
import { settlementCash } from '../claims/cash.js';

/** Claims settled through the broker with their cash position (status outstanding | received | completed | all; search). */
export async function listSettlements(db, q = {}) {
  const params = [];
  let filter = '';
  if (q.search) {
    params.push(`%${q.search}%`);
    filter = ` AND (c.claim_number ILIKE $1 OR p.policy_number ILIKE $1 OR cl.display_name ILIKE $1)`;
  }
  const claims = (await db.query(`SELECT c.id FROM claims c JOIN policies p ON p.id = c.policy_id LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
    WHERE c.settlement_jv_id IS NOT NULL AND (c.settlement->>'paidThroughBroker')::boolean IS TRUE${filter} ORDER BY c.updated_at DESC LIMIT 500`, params)).rows;
  const rows = [];
  for (const { id } of claims) {
    const p = await settlementCash(db, id);
    const toReceive = round2(p.totalRecoverable - p.totalReceived);
    // what is still due to the claimant out of the funds already received (the broker pays out what it holds)
    const stage = p.payableToClaimant <= 0.005 ? 'completed' : toReceive > 0.005 ? 'awaiting-funds' : 'to-pay';
    rows.push({ claimId: p.claimId, claimNumber: p.claimNumber, policyNumber: p.policyNumber, claimant: p.claimant, status: p.status, settlementAmount: p.settlementAmount,
      insurers: p.insurers.map((i) => i.insurer).join(', '), totalReceived: p.totalReceived, toReceive, paidToClaimant: p.paidToClaimant, payableToClaimant: p.payableToClaimant,
      heldForClaimant: round2(p.totalReceived - p.paidToClaimant), stage });
  }
  const filtered = !q.status || q.status === 'all' ? rows : rows.filter((r) => (q.status === 'outstanding' ? r.stage !== 'completed' : r.stage === q.status));
  const sum = (k) => round2(filtered.reduce((s, r) => s + r[k], 0));
  return { summary: { claims: filtered.length, toReceive: sum('toReceive'), heldForClaimant: sum('heldForClaimant'), payableToClaimant: sum('payableToClaimant') }, rows: filtered };
}

async function movement(db, id) {
  const m = (await db.query(`SELECT m.*, c.claim_number, c.settlement, c.loss_date, c.claim_type, p.policy_number, p.insured_name, cl.display_name AS client_name, ic.name AS insurer_name,
      j.jv_number, (SELECT u.display_name FROM users u WHERE u.id = m.created_by) AS created_by_name
    FROM claim_settlement_movements m JOIN claims c ON c.id = m.claim_id JOIN policies p ON p.id = c.policy_id LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id)
    LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN journal_vouchers j ON j.id = m.journal_id WHERE m.id = $1`, [Number(id)])).rows[0];
  if (!m) throw notFound('Claim payment not found');
  return m;
}

/** Claim payment voucher of a payment to the claimant. */
export async function voucherPdf(db, movementId) {
  const m = await movement(db, movementId);
  if (m.kind !== 'paid-to-claimant') throw notFound('Only a payment to the claimant has a payment voucher');
  const fmt = await printFormat();
  const amount = Number(m.amount);
  const company = await companyName();
  return { fileName: `${m.voucher_number || `claim-payment-${m.id}`}.pdf`, pdf: await renderPdf({
    title: 'Claim Payment Voucher', number: m.voucher_number || `CPV ${m.id}`, dateLine: `Date ${formatDate(m.movement_date, fmt)}`,
    meta: [['Claim no.', m.claim_number], ['Policy no.', m.policy_number], ['Insurer', m.insurer_name || '']].filter(([, v]) => v),
    sections: [
      { heading: 'Payment', columns: 2, rows: [['Payee', m.payee || m.client_name || ''], ['Amount', `${fmt.currency} ${formatAmount(amount, fmt.decimals)}`],
        ['Amount in words', amountInWords(amount, fmt.currency)], ['Mode of payment', m.payment_mode || ''], ['Paid from', m.bank_account || ''],
        ['Cheque / reference', m.reference || ''], ['Journal', m.jv_number || ''], ['Prepared by', m.created_by_name || '']].filter(([, v]) => v !== '') },
      { heading: 'Particulars', text: `Settlement of claim ${m.claim_number} under policy ${m.policy_number}${m.claim_type ? ` (${m.claim_type})` : ''}, paid through ${company} out of the funds received from the insurer.` },
      { signatures: ['Prepared by', 'Checked by', 'Approved by', { label: 'Received by (payee)', name: m.payee || m.client_name || '' }], perRow: 4 },
    ],
  }) };
}

/** Release and quitclaim signed by the claimant when the settlement is paid. */
export async function releaseFormPdf(db, claimRef) {
  const pos = await settlementCash(db, claimRef);
  const c = (await db.query(`SELECT c.*, p.policy_number, p.insured_name, cl.display_name AS client_name, ic.name AS insurer_name FROM claims c JOIN policies p ON p.id = c.policy_id
    LEFT JOIN clients cl ON cl.id = COALESCE(c.client_id, p.client_id) LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE c.id = $1`, [pos.claimId])).rows[0];
  const fmt = await printFormat();
  const company = await companyName();
  const claimant = pos.claimant || c.client_name || c.insured_name || '';
  const amount = pos.settlementAmount;
  const pays = pos.movements.filter((m) => m.kind === 'paid-to-claimant' && !m.reversed);
  const extent = c.status === 'partially-settled' ? 'in partial settlement' : 'in full and final settlement';
  return { fileName: `release-${pos.claimNumber}.pdf`, pdf: await renderPdf({
    title: 'Release and Quitclaim', number: pos.claimNumber, dateLine: `Date ${formatDate(new Date(), fmt)}`,
    meta: [['Claim no.', pos.claimNumber], ['Policy no.', pos.policyNumber], ['Insurer', c.insurer_name || '']].filter(([, v]) => v),
    sections: [
      { text: `KNOW ALL MEN BY THESE PRESENTS: I/We, ${claimant}, acknowledge receipt from ${c.insurer_name || 'the insurer'}, through ${company}, of the sum of ${fmt.currency} ${formatAmount(amount, fmt.decimals)} (${amountInWords(amount, fmt.currency)}) ${extent} of claim ${pos.claimNumber} under policy ${pos.policyNumber} for the loss of ${formatDate(c.loss_date, fmt)}.` },
      { text: `In consideration of this payment I/we release and forever discharge the insurer and ${company} from all claims, demands and actions arising from the said loss, and subrogate the insurer to all my/our rights of recovery against any third party to the extent of the amount paid.` },
      ...(pays.length ? [{ heading: 'Payments', table: { columns: [{ key: 'voucher', label: 'Voucher' }, { key: 'date', label: 'Date', type: 'date' }, { key: 'mode', label: 'Mode' },
        { key: 'reference', label: 'Reference' }, { key: 'amount', label: 'Amount', type: 'amount' }],
      rows: pays.map((m) => ({ voucher: m.voucherNumber || '', date: isoDate(m.date), mode: m.paymentMode || '', reference: m.reference || '', amount: m.amount })) } }] : []),
      { signatures: [{ label: 'Claimant', name: claimant }, { label: 'Witness' }, { label: 'Witness' }], perRow: 3 },
    ],
  }) };
}
