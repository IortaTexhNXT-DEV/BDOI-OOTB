/**
 * AMLA record keeping (section 9(b)): customer identification records and transaction records are kept for at least
 * aml.record_retention_years (default 5) years from the end of the relationship or the transaction, and for as long as a
 * case on them is pending. Used by the anonymisation of Master > Data Privacy, which refuses while this holds, and shown
 * on the AML dashboard.
 */
import { addMonths, amlSetting, isoDay } from './common.js';

/** Why the AML records of a client must still be kept ({ code, message }), or null. */
export async function amlRetentionBlocker(db, clientId, now) {
  const open = Number((await db.query("SELECT count(*) AS n FROM aml_cases WHERE client_id = $1 AND status IN ('open', 'for-filing')", [clientId])).rows[0].n);
  if (open) return { code: 'aml-case-open', count: open, message: `${open} AML case(s) on the client still open: the records are kept until the case is closed` };
  const years = Number(await amlSetting('aml.record_retention_years'));
  const last = (await db.query(`SELECT max(d) AS d FROM (
      SELECT max(expiry_date) AS d FROM policies WHERE client_id = $1
      UNION ALL SELECT max(transaction_date) FROM aml_alerts WHERE client_id = $1
      UNION ALL SELECT max(COALESCE(filed_on, closed_at::date)) FROM aml_cases WHERE client_id = $1
      UNION ALL SELECT max(received_date) FROM receipts WHERE client_id = $1) x`, [clientId])).rows[0].d;
  const lastDay = isoDay(last);
  if (!lastDay) return null;
  const until = addMonths(lastDay, years * 12);
  if (until > now) return { code: 'aml-retention', message: `AMLA records (identification and transactions) are kept until ${until} (${years} years after ${lastDay})` };
  return null;
}
