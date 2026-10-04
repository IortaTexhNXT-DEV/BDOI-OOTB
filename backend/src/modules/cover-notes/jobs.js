/** Scheduled job cover-note-expiry (Master > Schedules): policy link, expiry and reminders of cover notes. */
import { pool } from '../../db/pool.js';
import { expiryJob } from './service.js';

export const coverNoteExpiry = async () => expiryJob(pool);
