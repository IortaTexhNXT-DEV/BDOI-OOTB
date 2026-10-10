/** Standard rates and the rate discount of a promotion line (TIS-BRD-PROD-15, FR-PRM-003). */
import { getSetting } from '../../lib/settings.js';
import { num, round2 } from '../../lib/money.js';

/** Standard Own Damage and Acts of Nature rates (%) a promotion is measured against. */
export async function standardRates() {
  const s = (await getSetting('promotions.standard_rates', { ownDamage: 2, actsOfNature: 0.5 })) || {};
  return { ownDamage: num(s.ownDamage ?? 2), actsOfNature: num(s.actsOfNature ?? 0.5) };
}

/** Rate discount % of a line (FR-PRM-003 R3): the worst case, at the minimum Own Damage rate. */
export function rateDiscount(line, std, benefit = 'rate') {
  if (benefit === 'discount') return round2(num(line.discountPct));
  const standard = std.ownDamage + std.actsOfNature;
  if (!standard) return 0;
  return round2(((standard - (num(line.minOd ?? line.promoOd) + num(line.promoAon))) / standard) * 100);
}
