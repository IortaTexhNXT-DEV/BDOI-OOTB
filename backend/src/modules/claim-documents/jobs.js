/** Scheduled job claim-document-reminders (Master > Schedules): missing-document reminders to claimants. */
import { withTransaction } from '../../db/pool.js';
import { reminderJob } from './service.js';

export const claimDocumentReminders = async () => withTransaction((db) => reminderJob(db));
