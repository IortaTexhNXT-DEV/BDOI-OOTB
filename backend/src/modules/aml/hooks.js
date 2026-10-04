/**
 * Where the AML checks plug into the business flows:
 *   onboarding     a client created on Operations > Clients > Onboard client: rated and screened (with its owners and
 *                  signatories); a match is queued for the compliance officer, the record is kept
 *   policy issue   every policy issued (quotation, placement slip, package, renewal, recorded policy), inside the issue
 *                  transaction: the client is rated with the new policy's line, premium and payment mode and screened;
 *                  the issue is refused while a hit is undecided or confirmed (aml.screening_block_events) and, for a
 *                  High-risk client, until its EDD review is approved (aml.block_issue_pending_edd)
 *   payout         a premium refund cheque or a claim payment to the claimant: the payee and the client are screened
 *                  and the payment refused on an undecided or confirmed hit
 * Go-live loads of in-force policies (src.migration) are not checked: the clients are rated and screened by the
 * rescreen that follows the first list upload, or on Compliance > Client Due Diligence.
 */
import { assessClient, assertEddForIssue } from './risk.js';
import { screenForEvent, screenPayout } from './screening.js';

export async function onClientOnboarded(db, clientId, userId) {
  const assessment = await assessClient(db, clientId, { trigger: 'onboarding', userId });
  const screening = await screenForEvent(clientId, 'onboarding', { referenceType: 'client', referenceId: clientId, userId, db });
  return { assessment, screening };
}

/** Called by policies/service.js issuePolicy inside the issue transaction. */
export async function atPolicyIssue(db, { clientId, policyId, policyNumber, lob, premium, paymentMode, userId }) {
  if (!clientId) return null;
  const assessment = await assessClient(db, clientId, { trigger: 'policy-issue', extra: { lob, premium, paymentMode }, userId, reference: policyNumber || policyId });
  await screenForEvent(clientId, 'policy-issue', { referenceType: 'policy', referenceId: policyId, userId, db });
  await assertEddForIssue(db, clientId);
  return assessment;
}

/** Called before a refund cheque or a claim payment is approved and posted. */
export async function atPayout({ clientId, payeeName, referenceType, referenceId, userId, db }) {
  await screenPayout({ clientId, payeeName, referenceType, referenceId, userId, db });
}
