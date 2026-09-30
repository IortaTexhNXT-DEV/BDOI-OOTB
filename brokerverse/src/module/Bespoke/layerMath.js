/**
 * Client-side mirror of the layering rules (the server validates again): shares per layer total 100%, one lead per
 * layer, distinct insurers, the primary layer attaches at 0 and every excess layer where the one below ends, and the
 * layer premiums add up to the net premium. Returns the list of problems (empty when the layers can be saved).
 */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const layerShareTotal = (layer) => Math.round((layer.participants || []).reduce((s, p) => s + (Number(p.sharePercent) || 0), 0) * 10000) / 10000;

export function layerProblems(layers, { netPremium = 0, contiguous = true } = {}) {
  const out = [];
  const sorted = [...(layers || [])].sort((a, b) => (Number(a.attachmentPoint) || 0) - (Number(b.attachmentPoint) || 0));
  sorted.forEach((l, i) => {
    const n = i + 1;
    if (!(Number(l.limit) > 0)) out.push(`Layer ${n}: the limit must be more than 0`);
    if (!(Number(l.premium) > 0)) out.push(`Layer ${n}: the layer premium must be more than 0`);
    if (i === 0 && Number(l.attachmentPoint || 0) !== 0) out.push("The primary layer attaches at 0");
    if (i > 0 && contiguous) {
      const prev = sorted[i - 1];
      const at = r2(Number(prev.attachmentPoint || 0) + Number(prev.limit || 0));
      if (r2(l.attachmentPoint) !== at) out.push(`Layer ${n} must attach at ${at}, where layer ${i} ends`);
    }
    const parts = l.participants || [];
    if (!parts.length) out.push(`Layer ${n}: add at least one participant`);
    if (parts.some((p) => !p.insuranceCompanyId)) out.push(`Layer ${n}: choose the insurer of every participant`);
    if (new Set(parts.map((p) => p.insuranceCompanyId)).size !== parts.length) out.push(`Layer ${n}: an insurer can take part only once in a layer`);
    if (parts.filter((p) => p.isLead).length > 1) out.push(`Layer ${n}: exactly one participant must lead the layer`);
    const total = layerShareTotal(l);
    if (parts.length && Math.abs(total - 100) > 0.0001) out.push(`Layer ${n}: shares must total exactly 100% (they total ${total}%)`);
  });
  const premium = r2(sorted.reduce((s, l) => s + (Number(l.premium) || 0), 0));
  if (Number(netPremium) > 0 && Math.abs(premium - Number(netPremium)) > 0.005) out.push(`The layer premiums total ${premium}; they must add up to the net premium ${Number(netPremium)}`);
  return out;
}

/** The next layer: attaches where the last one ends. */
export const nextLayer = (layers) => {
  const last = layers[layers.length - 1];
  const at = last ? r2(Number(last.attachmentPoint || 0) + Number(last.limit || 0)) : 0;
  return { name: layers.length ? `Excess layer ${layers.length}` : "Primary layer", limit: null, attachmentPoint: at, premium: null, participants: [{ insuranceCompanyId: null, sharePercent: 100, isLead: true, commissionRate: null }] };
};
