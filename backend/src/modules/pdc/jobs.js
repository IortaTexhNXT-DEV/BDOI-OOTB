/** Scheduled jobs of the post-dated cheques (Master > Schedules): retained cheques due for deposit, and the follow-up of cheques with the Insurance Partners. */
import { pool } from '../../db/pool.js';
import { depositDueJob } from './service.js';
import { followUpJob } from './lifecycle.js';

export const pdcDepositDue = async () => depositDueJob(pool);
export const pdcFollowUp = async () => followUpJob(pool);
