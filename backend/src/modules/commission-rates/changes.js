/**
 * Commission rule changes on Master > Finance > Configuration Approvals (accounting_config_changes, kind
 * commission-rule; FRS FR-CMR-003): a new rule, an amendment (a new version) or the end of a rule is a change request
 * decided by a holder of approve:commission-rules other than its maker (posting-rules/service.js decideChange, which
 * applies it through service.js applyRuleDecision). The payload is what the approver reads: the keys of the rule, its
 * dates and its rates.
 */
import { requestChange } from '../posting-rules/service.js';
import { CHANNEL_TYPE_LABELS } from './service.js';

const pct = (v) => (v === null || v === undefined ? '-' : `${Number(v).toFixed(4).replace(/\.?0+$/, '')}%`);

/** The rates of a rule as one readable line per peril ("OD issuing 2% · TIS 1.7% · insurer net 1.3%"). */
export function ratesText(rule) {
  if (rule.rateBasis !== 'issuing-remitting') return `${pct(rule.ratePercent)} of net premium`;
  return (rule.perilRates || []).filter((p) => p.basis !== 'none').map((p) => (p.basis === 'premium-pct'
    ? `${p.peril} ${pct(p.commissionPct)} of premium`
    : `${p.peril} issuing ${pct(p.issuing)} · TIS ${pct(p.tisRemitting)} · insurer net ${pct(p.insurerNet)}`)).join('; ');
}

/** The keys of a rule as the approver reads them. */
export const keysText = (rule) => [rule.insurerName || 'Any insurer', rule.productName || (rule.lineOfBusiness ? String(rule.lineOfBusiness).toUpperCase() : 'Any product'),
  rule.motorTypeName || rule.motorType || null, rule.policyType === 'any' ? 'Any policy type' : rule.policyType === 'new' ? 'New business' : 'Renewal',
  rule.channelType ? CHANNEL_TYPE_LABELS[rule.channelType] || rule.channelType : 'Any channel',
  rule.siFrom !== null || rule.siTo !== null ? `SI ${rule.siFrom ?? 0} - ${rule.siTo ?? 'open'}` : null].filter(Boolean).join(' - ');

/** Raise the change request of a rule (action new | amend | end) for Configuration Approvals; returns the change. */
export async function submitRuleChange(db, rule, { action, effectiveTo = null, note = null, user }) {
  const label = `Commission rule - ${action === 'new' ? 'new' : action === 'end' ? 'end' : 'amend'}: ${keysText(rule)}`;
  const payload = { ruleId: rule.id, action, label, keys: keysText(rule), version: rule.version, effectiveFrom: rule.effectiveFrom,
    effectiveTo: action === 'end' ? effectiveTo : rule.effectiveTo, rateBasis: rule.rateBasis, rates: ratesText(rule), remarks: rule.remarks || null };
  let before = null;
  if (action === 'end') before = { effectiveTo: rule.effectiveTo, rates: ratesText(rule) };
  else if (rule.replacesId) {
    const prev = (await db.query('SELECT r.*, NULL AS insurer_name FROM commission_rates r WHERE r.id = $1', [rule.replacesId])).rows[0];
    if (prev) {
      const { toRate } = await import('./service.js');
      const p = await toRate(prev);
      before = { version: p.version, effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo, rates: ratesText(p) };
    }
  }
  return requestChange(db, { kind: 'commission-rule', target: `rule:${rule.id}`, payload, before, note, user });
}
