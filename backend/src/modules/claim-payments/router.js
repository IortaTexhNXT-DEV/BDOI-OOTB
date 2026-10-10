/**
 * Claims Settlements (Accounts > Claims Settlements): claims paid through the broker, worked from the Accounting menu.
 * Funds received from the insurer (write:claim-funds, posting rule claim.funds_received) and payment to the claimant
 * (write:disbursements, posting rule claim.paid_to_claimant, claim payment voucher number), the reversal of either
 * recorded in error (reverse:claim-cash, reason code, reversing journal), the payment voucher and the release form.
 * Reading needs read:receipts, read:disbursements or read:claims.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok } from '../../lib/respond.js';
import { sendPdf } from '../../lib/pdf/index.js';
import * as cash from '../claims/cash.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Claims Settlements', '/claim-payments');
const read = [requireAuth, requirePermission('read:receipts', 'read:disbursements', 'read:claims')];
const S = 'Accounts > Claims Settlements';
const row = { claimNumber: 'CLM-2026-00001', policyNumber: 'POL-2026-00001', claimant: 'Maria Santos', settlementAmount: 75000, totalReceived: 75000, toReceive: 0,
  paidToClaimant: 0, payableToClaimant: 75000, heldForClaimant: 75000, stage: 'to-pay' };
const cashSchema = z.object({ amount: z.coerce.number().positive(), bankAccount: z.string().min(1).max(100), date: z.string().max(40).optional().nullable(), reference: z.string().max(100).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(), insurerId: z.union([z.string(), z.number()]).optional().nullable(), paymentMode: z.enum(['check', 'bank-transfer', 'cash']).optional(),
  payee: z.string().max(200).optional().nullable() });

define({
  method: 'GET', path: '/', summary: 'Claims settled through the broker with funds to receive from insurers and amounts payable to claimants (status outstanding | awaiting-funds | to-pay | completed | all, search)',
  screen: S, middleware: read, query: { status: 'outstanding' }, response: { success: true, data: { summary: { claims: 1, toReceive: 0, heldForClaimant: 75000, payableToClaimant: 75000 }, rows: [row] } },
  handler: async (req, res) => ok(res, await svc.listSettlements(pool, req.query)),
});
define({
  method: 'GET', path: '/claims/:id', summary: 'Cash position of one claim settled through the broker (insurers, claimant, movements, bank accounts)', screen: S, middleware: read,
  response: { success: true, data: { claimNumber: 'CLM-2026-00001', settlementAmount: 75000, insurers: [], movements: [] } },
  handler: async (req, res) => ok(res, await cash.cashPosition(req.params.id)),
});
define({
  method: 'POST', path: '/claims/:id/funds-received', summary: 'Record settlement funds received from an insurer into a bank account (posting rule claim.funds_received)', screen: `${S} > Funds received`,
  middleware: [requireAuth, requirePermission('write:claim-funds'), validate(cashSchema)], request: { insurerId: 1, amount: 75000, bankAccount: 'ACC-OPS-001', date: '2026-10-04', reference: 'RA-8812' },
  response: { success: true, data: { journalNumber: 'JV-2026-00140' } },
  handler: async (req, res) => {
    const r = await cash.recordMovement(req.params.id, 'funds-received', req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.position.claimId, action: 'funds-received', after: { ...req.body, journalId: r.journalId } });
    ok(res, r, `Funds received recorded (${r.journalNumber})`);
  },
});
define({
  method: 'POST', path: '/claims/:id/pay', summary: 'Pay the settlement to the claimant (posting rule claim.paid_to_claimant); a claim payment voucher number is assigned', screen: `${S} > Pay claimant`,
  middleware: [requireAuth, requirePermission('write:disbursements'), validate(cashSchema)], request: { amount: 75000, bankAccount: 'ACC-OPS-001', paymentMode: 'check', reference: 'Chq 000512', payee: 'Maria Santos' },
  response: { success: true, data: { journalNumber: 'JV-2026-00141', voucherNumber: 'CPV-2026-00001', movementId: 7 } },
  handler: async (req, res) => {
    const r = await cash.recordMovement(req.params.id, 'paid-to-claimant', req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.position.claimId, action: 'paid-to-claimant', after: { ...req.body, journalId: r.journalId, voucherNumber: r.voucherNumber } });
    ok(res, r, `Payment ${r.voucherNumber} recorded (${r.journalNumber})`);
  },
});
define({
  method: 'POST', path: '/claims/:id/movements/:movementId/reverse', summary: 'Reverse funds received or a payment to the claimant recorded in error (reason code of context claim_cash_reversal and a remark; not by the user who recorded it); the journal is reversed',
  screen: `${S} > Reverse`, middleware: [requireAuth, requirePermission('reverse:claim-cash'), validate(z.object({ reasonCode: z.string().min(1).max(40), note: z.string().max(1000).optional().nullable() }))],
  request: { reasonCode: 'CRV-AMOUNT', note: 'Recorded 75,000 instead of 57,000' }, response: { success: true, data: { movementId: 7, kind: 'funds-received', amount: 75000, journalNumber: 'JV-2026-00152' } },
  handler: async (req, res) => {
    const r = await cash.reverseMovement(req.params.id, req.params.movementId, req.body, req.user);
    await audit(req, { entity: 'claim', entityId: r.position.claimId, action: 'reverse-cash-movement', after: { movementId: r.movementId, kind: r.kind, amount: r.amount, reasonCode: r.reasonCode, reason: r.reason, journalNumber: r.journalNumber } });
    ok(res, r, `Movement reversed${r.journalNumber ? ` (${r.journalNumber})` : ''}`);
  },
});
define({
  method: 'GET', path: '/movements/:movementId/voucher', summary: 'Claim payment voucher (PDF) of a payment to the claimant', screen: `${S} > Payment voucher`, middleware: read, response: 'application/pdf',
  handler: async (req, res) => {
    const r = await svc.voucherPdf(pool, req.params.movementId);
    sendPdf(res, r.pdf, r.fileName);
  },
});
define({
  method: 'GET', path: '/claims/:id/release-form', summary: 'Release and quitclaim (PDF) for the claimant to sign on payment of the settlement', screen: `${S} > Release form`, middleware: read, response: 'application/pdf',
  handler: async (req, res) => {
    const r = await svc.releaseFormPdf(pool, req.params.id);
    sendPdf(res, r.pdf, r.fileName);
  },
});

export default router;
export const mount = '/claim-payments';
