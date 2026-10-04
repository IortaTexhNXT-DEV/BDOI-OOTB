/**
 * Go-live lock (setting golive.locked, Master > Configuration > Go-live). Once on, the transaction reset
 * (scripts/reset-transactions.js) refuses to run: the database holds the live book.
 */
export const GO_LIVE_LOCK_KEY = 'golive.locked';

/** True when the go-live lock is on (read directly, not from the settings cache: scripts run outside the API). */
export async function isGoLiveLocked(db) {
  const r = await db.query('SELECT value FROM app_settings WHERE key = $1', [GO_LIVE_LOCK_KEY]);
  const v = r.rows[0]?.value;
  return v === true || v === 'true';
}
