/**
 * Finance control settings (GAP-FIN-05; TIS-BRD-NFR-5.2, NFR-02, Pre-BSM M17 v4 FGA department): the maker-checker and
 * posting controls of Finance. IT AppSupport keeps the system configuration (write:settings) but does not switch off
 * the controls of the department it does not belong to: changing one of these keys needs the Finance approver's
 * permission (approve:period-end; the System Administrator always passes), on every path that writes settings (PUT
 * /settings, PUT /system-settings/configuration, the settings sheet of a configuration load). Finance changes them on
 * Accounts > Period End > Period Management > Finance Controls (GET / PUT /period-end/finance-controls).
 */
import { forbidden } from './errors.js';
import { hasPermission } from './auth.js';

export const FINANCE_CONTROL_PERMISSION = 'approve:period-end';

/** The controls, in the order Finance Controls lists them. */
export const FINANCE_CONTROL_KEYS = [
  'finance.maker_checker_enabled',
  'journal.require_approval',
  'payables.maker_checker',
  'accounting.period_close_requires_approval',
  'accounting.reopen_closed_periods',
  'accounting.year_end_accepts_soft_closed',
  'accounting.parked_events',
  'accounting.auto_post_system_entries',
  'receipts.reversal_requires_approval',
];

export const isFinanceControl = (key) => FINANCE_CONTROL_KEYS.includes(key);

/** changes = [[key, newValue, oldValue?]]: refuse a change to a finance control by a user without the Finance permission. */
export function assertFinanceControlsAllowed(changes, user) {
  const touched = changes.filter(([k, v, before]) => isFinanceControl(k) && (before === undefined || JSON.stringify(v) !== JSON.stringify(before))).map(([k]) => k);
  if (touched.length && !hasPermission(user, FINANCE_CONTROL_PERMISSION)) {
    throw forbidden(`${touched.join(', ')} ${touched.length > 1 ? 'are finance controls' : 'is a finance control'}: only Finance (${FINANCE_CONTROL_PERMISSION}) changes it, on Period Management > Finance Controls`);
  }
}
