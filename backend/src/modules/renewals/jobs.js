/**
 * Scheduled-job entry points for src/jobs/handlers.js (register with
 *   export { processRenewalQueue, renewalPipeline, renewalNoticeRun, renewalNotices } from '../modules/renewals/jobs.js';
 * and add rows to scheduled_jobs with handler 'processRenewalQueue' / 'renewalPipeline' / 'renewalNoticeRun' / 'renewalNotices').
 */
import './batches.js'; // registers the renewal-batch-notices job type
import { processQueue, requeueStale } from './queue.js';
import { refreshPipeline } from './service.js';
import { runNoticeSchedule, staffRenewalReminders } from './notices.js';

/** Requeue stale jobs and process everything waiting in job_queue. */
export async function processRenewalQueue() {
  const requeued = await requeueStale(15);
  const { processed = 0, busy = false } = await processQueue({ max: 500 });
  return { requeued, processed, busy };
}

/** Add policies expiring soon to the renewal pipeline and lapse renewals past the grace period. */
export const renewalPipeline = () => refreshPipeline(null);

/** Renewal notices due at the marks before expiry, by e-mail, through the notice gate; lock-in review tasks. */
export const renewalNoticeRun = () => runNoticeSchedule();

/** "Renewal due in n days" reminders to the policy owners (none for suppressed lock-in and Scheme 2 accounts). */
export const renewalNotices = () => staffRenewalReminders();
