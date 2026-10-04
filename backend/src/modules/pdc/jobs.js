/** Scheduled job pdc-deposit-due (Master > Schedules): tell Accounting which post-dated cheques are due for deposit. */
import { pool } from '../../db/pool.js';
import { depositDueJob } from './service.js';

export const pdcDepositDue = async () => depositDueJob(pool);
