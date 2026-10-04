/**
 * Scheduled jobs of the AML module (migration 0263, Master > Schedules):
 *   aml-transaction-monitoring  daily: the covered and suspicious transaction rules over the last params.days days
 *   aml-kyc-refresh-due         weekly: clients whose KYC refresh date has come become refresh due; the compliance
 *                               officer is told how many refreshes and EDD reviews are due
 *   aml-provider-retry          every 15 minutes (delivered switched off): failed requests to the screening provider
 */
import { query } from '../../db/pool.js';
import { today } from '../../lib/dates.js';
import { notify } from '../notifications/service.js';
import { runMonitoring } from './monitoring.js';
import { refreshDue, refreshKycStatus } from './risk.js';
import { dueRequests, retryRequest } from './providers.js';
import { applyProviderMatches } from './screening.js';

export async function amlTransactionMonitoring(params = {}) {
  return runMonitoring({ days: Number(params.days) || 3 });
}

export async function amlKycRefreshDue() {
  const now = await today();
  const overdue = (await query("SELECT id FROM clients WHERE kyc_next_review_on <= $1::date AND status <> 'deleted' AND anonymised_at IS NULL AND kyc_status <> 'refresh-due'", [now])).rows;
  for (const c of overdue) await refreshKycStatus({ query }, c.id);
  const due = await refreshDue();
  const edd = Number((await query("SELECT count(*) AS n FROM aml_edd_reviews WHERE status IN ('open', 'submitted')")).rows[0].n);
  if (due.length || edd) {
    await notify({ type: 'reminder', priority: due.some((d) => d.overdue) ? 'high' : 'normal', title: 'KYC refreshes and EDD reviews due',
      message: `${due.length} client(s) due for KYC refresh (${due.filter((d) => d.overdue).length} overdue); ${edd} EDD review(s) open or awaiting approval`,
      link: '/compliance/aml/kyc-refresh', entity: 'aml_kyc_refresh', audience: 'read:aml' });
  }
  return { markedDue: overdue.length, due: due.length, edd };
}

export async function amlProviderRetry() {
  const ids = await dueRequests();
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    const r = await retryRequest(id);
    if (r?.ok) { ok += 1; await applyProviderMatches(id); } else failed += 1;
    if (r && !r.ok && r.status === 'abandoned') {
      await notify({ type: 'reminder', priority: 'high', title: 'Screening provider request abandoned', message: `Request ${id} failed after the last attempt (${r.error}); screen the party manually`,
        link: '/compliance/aml/lists', entity: 'aml_provider_request', entityId: id, audience: 'read:aml' });
    }
  }
  return { retried: ids.length, succeeded: ok, failed };
}
