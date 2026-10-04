/**
 * Scheduled job privacy-requests-due (registered by migration 0221, disabled until switched on under
 * Master > Schedules): a reminder to the data privacy team (read:privacy) for every open data subject request past its
 * due date, at most once a day per request.
 */
import { one } from '../../db/pool.js';
import { today } from '../../lib/dates.js';
import { notify } from '../notifications/service.js';
import { overdueRequests, requestApi } from './service.js';

export async function privacyRequestsDue() {
  if (!(await one("SELECT to_regclass('data_subject_requests') IS NOT NULL AS ok")).ok) return { skipped: 'data privacy not migrated' };
  const now = await today();
  const rows = await overdueRequests(now);
  let notified = 0;
  for (const row of rows) {
    const r = requestApi(row, now);
    const recent = await one(`SELECT 1 FROM notifications WHERE entity = 'data_subject_request' AND entity_id = $1 AND type = 'reminder'
      AND created_at > now() - interval '20 hours'`, [r.id]);
    if (recent) continue;
    await notify({ type: 'reminder', priority: 'high', title: `Data subject request ${r.requestNumber} is overdue`,
      message: `${r.requestType} request of ${r.requesterName} was due on ${r.dueOn}${r.assignedToName ? ` (assigned to ${r.assignedToName})` : ''}`,
      link: '/master/data-privacy/requests', entity: 'data_subject_request', entityId: r.id, audience: 'read:privacy' });
    notified += 1;
  }
  return { overdue: rows.length, notified };
}
