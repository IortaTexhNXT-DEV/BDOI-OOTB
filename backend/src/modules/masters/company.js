/**
 * Company master rules. The primary company (IsPrimary) is the letterhead of every printed document and report:
 * at most one active company may be primary. Saving a company refreshes the letterhead and keeps
 * general.company_name equal to the primary company's name.
 */
import { one, query } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { clearSettingsCache } from '../../lib/settings.js';
import { clearLetterheadCache } from '../../lib/letterhead.js';
import { asBool } from './helpers.js';

export const COMPANY_TYPE = 'company';

/**
 * Reject a second primary company. `values` are the record's fields after the change, `status` its status after the
 * change ('active' | 'inactive' | ...), `exceptId` the record itself on an update.
 */
export async function assertSinglePrimary(t, values, status, exceptId = null) {
  if (t.code !== COMPANY_TYPE || !asBool(values.IsPrimary) || (status && status !== 'active')) return;
  const other = await one(`SELECT id, name FROM master_records WHERE type_code = $1 AND status = 'active' AND ($2::int IS NULL OR id <> $2)
    AND lower(COALESCE(data->>'IsPrimary', 'false')) IN ('true', 'yes', '1') ORDER BY id LIMIT 1`, [COMPANY_TYPE, exceptId ? Number(exceptId) : null]);
  if (other) {
    throw badRequest('Validation failed', [{ path: 'IsPrimary', message: `Only one company can be the letterhead (primary) company: ${other.name} is already primary. Untick "Letterhead company" on ${other.name} first.` }]);
  }
}

/** After a company is created, changed or (de)activated: refresh the letterhead and general.company_name. */
export async function afterCompanyChange(t, userId = null) {
  if (t.code !== COMPANY_TYPE) return;
  clearLetterheadCache();
  const primary = await one(`SELECT name FROM master_records WHERE type_code = $1 AND status = 'active'
    AND lower(COALESCE(data->>'IsPrimary', 'false')) IN ('true', 'yes', '1') ORDER BY id LIMIT 1`, [COMPANY_TYPE]);
  if (primary?.name) {
    await query('UPDATE app_settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1 AND value IS DISTINCT FROM $2',
      ['general.company_name', JSON.stringify(primary.name), userId]);
    clearSettingsCache();
  }
}
