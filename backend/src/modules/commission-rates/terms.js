/**
 * Insurer credit terms (insurance_companies.premium_warranty_days / remittance_terms_days / default_billing_mode,
 * edited on Master > Generals > Insurance Company). Each term falls back to its setting when the insurer has none.
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';

const BILLING_MODES = ['broker', 'direct'];
const days = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * { premiumWarrantyDays, remittanceTermsDays, billingMode, source: { premiumWarrantyDays: 'insurer' | 'setting', ... } }
 * - premiumWarrantyDays: days the client has to pay (receivable due date), else collections.corporate_credit_days for a
 *   corporate client (clientId given) when set, else collections.default_credit_days
 * - remittanceTermsDays: days after collection the broker must remit, else remittance.default_due_days
 * - billingMode: broker | direct default for the insurer's policies, else direct_bill.default_billing_mode
 */
export async function resolveCreditTerms(insurerId, { db = null, clientId = null } = {}) {
  const run = db || { query };
  const corporate = clientId ? (await run.query('SELECT client_type FROM clients WHERE id = $1', [String(clientId)])).rows[0]?.client_type === 'corporate' : false;
  const corporateDays = corporate ? days(await getSetting('collections.corporate_credit_days', null)) : null;
  const ic = insurerId && /^\d+$/.test(String(insurerId))
    ? (await run.query('SELECT premium_warranty_days, remittance_terms_days, default_billing_mode FROM insurance_companies WHERE id = $1', [Number(insurerId)])).rows[0]
    : null;
  const warranty = days(ic?.premium_warranty_days);
  const remit = days(ic?.remittance_terms_days);
  const mode = BILLING_MODES.includes(ic?.default_billing_mode) ? ic.default_billing_mode : null;
  const settingMode = String(await getSetting('direct_bill.default_billing_mode', 'broker')).toLowerCase();
  return {
    premiumWarrantyDays: warranty ?? corporateDays ?? Number(await getSetting('collections.default_credit_days', 30)),
    remittanceTermsDays: remit ?? Number(await getSetting('remittance.default_due_days', 30)),
    billingMode: mode ?? (BILLING_MODES.includes(settingMode) ? settingMode : 'broker'),
    source: {
      premiumWarrantyDays: warranty === null ? (corporateDays === null ? 'setting' : 'corporate') : 'insurer',
      remittanceTermsDays: remit === null ? 'setting' : 'insurer',
      billingMode: mode === null ? 'setting' : 'insurer',
    },
  };
}
