/**
 * Shared helpers of the AML/CFT module: settings with their defaults, working days for the AMLC filing deadlines,
 * client names, and small value helpers.
 */
import { query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { addDays } from '../../lib/dates.js';

/** Defaults of the AML settings (migration 0263 creates them in app_settings; Compliance > AML Settings changes them). */
export const AML_DEFAULTS = {
  'aml.covered_threshold': 500000,
  'aml.covered_aggregation': 'banking-day',
  'aml.covered_payment_modes': ['cash'],
  'aml.ctr_due_working_days': 5,
  'aml.str_due_working_days': 1,
  'aml.match_threshold': 0.85,
  'aml.risk_low_max_score': 2,
  'aml.risk_high_min_score': 8,
  'aml.pep_always_high': true,
  'aml.kyc_refresh_months': { low: 36, normal: 24, high: 12 },
  'aml.kyc_refresh_notice_days': 30,
  'aml.beneficial_owner_threshold': 25,
  'aml.record_retention_years': 5,
  'aml.screening_block_events': ['policy-issue', 'payout'],
  'aml.block_issue_pending_edd': true,
  'aml.screening_provider': { provider: 'lists', endpoint: '', apiKeyEnv: 'AML_SCREENING_API_KEY', mode: 'sandbox', timeoutMs: 10000, maxAttempts: 5 },
  'aml.amlc_institution_code': '',
  'aml.amlc_transaction_codes': { 'cash-premium-payment': 'PPC', 'premium-payment': 'PPN', 'premium-refund': 'PRF', 'claim-payment': 'CLP', other: 'OTH' },
};
export const AML_SETTING_KEYS = Object.keys(AML_DEFAULTS);

/** One AML setting (the default when the key is missing). */
export const amlSetting = async (key) => {
  const v = await getSetting(key, AML_DEFAULTS[key]);
  return v === null || v === undefined ? AML_DEFAULTS[key] : v;
};

export const RATINGS = ['low', 'normal', 'high'];
export const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));
export const round2 = (v) => Math.round(num(v) * 100) / 100;
export const isoDay = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/** National holidays of the Holiday master (Master > Configuration), as YYYY-MM-DD strings. */
async function holidays(db = { query }) {
  const r = await db.query("SELECT data->>'date' AS d FROM master_records WHERE type_code = 'holiday' AND status = 'active' AND COALESCE(data->>'scope', 'National') ILIKE 'national'");
  return new Set(r.rows.map((x) => x.d).filter(Boolean));
}

/** The date `days` working days after `from` (Saturdays, Sundays and national holidays skipped). */
export async function addWorkingDays(from, days, db) {
  const off = await holidays(db);
  let d = isoDay(from);
  let left = Math.max(0, Number(days) || 0);
  while (left > 0) {
    d = addDays(d, 1);
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6 && !off.has(d)) left -= 1;
  }
  return d;
}

/** Display name of a client row. */
export const clientName = (c) => c?.display_name || [c?.first_name, c?.middle_name, c?.last_name].filter(Boolean).join(' ') || c?.company_name || '';

/** Lower-case trimmed text for comparisons. */
export const lc = (v) => String(v ?? '').trim().toLowerCase();

/** Months to add to a date (YYYY-MM-DD), day clamped to the end of the month. */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + Number(months);
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
