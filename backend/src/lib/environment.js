/**
 * Environment marker (setting system.environment, migration 0247): which environment this database serves.
 *
 *   dev, sit, uat, preprod, training   non-production copies and project environments
 *   production                        the live book of the broker
 *
 * The client data masking tool (scripts/mask-data.js) refuses to run on a database marked production, and marks the copy
 * it masked with the target environment and the time of masking (system.masked_at). See docs/onboarding/DATA_MASKING.md.
 */
export const SYSTEM_ENVIRONMENT_KEY = 'system.environment';
export const MASKED_AT_KEY = 'system.masked_at';
export const ENVIRONMENTS = ['dev', 'sit', 'uat', 'preprod', 'training', 'production'];
export const NON_PRODUCTION_ENVIRONMENTS = ENVIRONMENTS.filter((e) => e !== 'production');

/** The environment marker read directly (scripts run outside the API): a string, or null when the setting does not exist. */
export async function systemEnvironment(db) {
  const r = await db.query('SELECT value FROM app_settings WHERE key = $1', [SYSTEM_ENVIRONMENT_KEY]);
  if (!r.rows.length) return null;
  const v = r.rows[0].value;
  return typeof v === 'string' ? v.trim().toLowerCase() : String(v ?? '').trim().toLowerCase();
}
