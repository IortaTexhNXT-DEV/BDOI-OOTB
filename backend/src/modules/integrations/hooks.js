/**
 * Hooks other modules call so a business event reaches the integrations, without the integrations ever blocking the
 * event: the work runs under a savepoint and a failure is logged, not thrown.
 *
 *   afterPolicyIssued(db, policyId, userId)   policies/service.js issuePolicy: CTPL registration (COC number and
 *                                             authentication request) and the insurer issuance request
 */
import { getSetting } from '../../lib/settings.js';
import { logger } from '../../lib/logger.js';
import { registerForPolicy } from './ctpl.js';
import { afterPolicyIssued as insurerAfterIssued } from './insurer.js';

export async function afterPolicyIssued(db, policyId, userId) {
  let savepoint = false;
  try {
    await db.query('SAVEPOINT integration_policy_hook');
    savepoint = true;
  } catch {
    // not inside a transaction: the work below runs on its own
  }
  try {
    if (await getSetting('ctpl.register_on_issue', true)) await registerForPolicy(db, policyId, userId);
    await insurerAfterIssued(db, policyId, userId);
    if (savepoint) await db.query('RELEASE SAVEPOINT integration_policy_hook');
  } catch (e) {
    if (savepoint) await db.query('ROLLBACK TO SAVEPOINT integration_policy_hook').catch(() => {});
    logger.warn?.({ err: e, policyId }, `integrations: policy ${policyId} issued, but the CTPL / insurer step failed: ${e.message}`);
  }
}
