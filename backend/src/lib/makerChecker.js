/**
 * Maker-checker: the user who approves a record must not be the user who created or submitted it.
 *
 * finance.maker_checker_enabled (Master > Configuration, finance) switches the rule off for a small office with one
 * finance user. Posting rule and account determination changes keep the rule whatever the setting (pass configurable: false).
 * Quotations, renewals, claim settlements and the period close have their own switches and checks.
 */
import { getSetting } from './settings.js';
import { forbidden } from './errors.js';

export async function assertChecker(user, makerId, what = 'record', { configurable = true } = {}) {
  if (!makerId || makerId !== user?.id) return;
  if (configurable && !(await getSetting('finance.maker_checker_enabled', true))) return;
  throw forbidden(`Maker-checker: the ${what} must be approved by a different user than the one who created or submitted it`);
}
