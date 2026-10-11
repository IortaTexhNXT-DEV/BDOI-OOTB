/**
 * The Talkbot outcome of policies, as Renewal Batch, Generate Renewal Quotes and Renewal Queue read it: the latest
 * outcome of the policy on any call list that is not cancelled (a line taken off its list does not count).
 * A policy is Talkbot-confirmed while its latest outcome is Willing to renew and was set within
 * talkbot.confirmation_valid_days.
 */
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, businessDate, isoDate, today } from '../../lib/dates.js';
import { CONFIRMED, OUTCOME_LABELS } from './outcomes.js';

const ddmmyyyy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** Map policy id -> { outcome, label, listId, listNumber, outcomeAt, outcomeDate, callbackDate, attempts, manual, confirmed }. */
export async function talkbotStatus(policyIds, db = null) {
  const ids = [...new Set((policyIds || []).filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const validDays = Number(await getSetting('talkbot.confirmation_valid_days', 30)) || 0;
  const since = addDays(await today(), -validDays);
  const sql = `SELECT DISTINCT ON (l.policy_id) l.policy_id, l.outcome, l.outcome_at, l.outcome_source, l.callback_date, l.attempts, l.list_id, cl.list_number,
      l.batch_id, l.quote_status, l.quote_number
    FROM talkbot_call_lines l JOIN talkbot_call_lists cl ON cl.id = l.list_id
    WHERE l.policy_id = ANY($1) AND l.line_status = 'active' AND cl.status <> 'cancelled'
    ORDER BY l.policy_id, (l.outcome = 'not-called'), l.outcome_at DESC NULLS LAST, cl.created_at DESC`;
  const rows = db ? (await db.query(sql, [ids])).rows : await many(sql, [ids]);
  const out = new Map();
  for (const r of rows) {
    const outcomeDate = r.outcome_at ? await businessDate(r.outcome_at) : null;
    out.set(r.policy_id, {
      outcome: r.outcome, label: OUTCOME_LABELS[r.outcome] || r.outcome, listId: r.list_id, listNumber: r.list_number, outcomeAt: r.outcome_at, outcomeDate,
      callbackDate: r.callback_date ? isoDate(r.callback_date) : null, attempts: r.attempts, manual: r.outcome_source === 'manual',
      confirmed: r.outcome === CONFIRMED && Boolean(outcomeDate) && outcomeDate >= since,
    });
  }
  return out;
}

/**
 * Whether Generate Renewal Quotes may quote a policy (FR-TBT-022): { ok } or { ok: false, reason } with the message of
 * the batch policy ("Not confirmed by Talkbot", "Talkbot confirmation of 01/09/2026 is older than 30 days").
 */
export async function confirmationOf(status) {
  if (status?.confirmed) return { ok: true };
  if (status?.outcome === CONFIRMED && status.outcomeDate) {
    const days = Number(await getSetting('talkbot.confirmation_valid_days', 30)) || 0;
    return { ok: false, reason: `Talkbot confirmation of ${ddmmyyyy(status.outcomeDate)} is older than ${days} days` };
  }
  return { ok: false, reason: 'Not confirmed by Talkbot' };
}
