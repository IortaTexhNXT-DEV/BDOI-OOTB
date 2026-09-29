/** Read models for the Operations > Renewals workspace screens (queue, at-risk, negotiations, lapse, performance, approvals). */
import { many, one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { round2, today, daysBetween, toDate } from '../claims/util.js';
import { BASE, OPEN, activityApi, listRenewals, readContext, riskOf, toApi } from './service.js';
import { nextDocumentNumber } from '../../lib/numbering.js';

/** Renewal queue with the dashboard counters (total, due within renewals.due_soon_days, at risk, in grace period). */
export async function renewalQueue(q, pg) {
  const { total, items, all } = await listRenewals({ ...q, openOnly: q.status ? undefined : 'true' }, pg);
  const dueSoonDays = Number(await getSetting('renewals.due_soon_days', 30)) || 0;
  return {
    total, items,
    dashboard: {
      totalPolicies: all.length, dueSoon: all.filter((p) => p.daysToExpiry <= dueSoonDays && p.daysToExpiry > 0).length,
      atRisk: all.filter((p) => ['High', 'Critical'].includes(p.retentionRisk)).length, inGracePeriod: all.filter((p) => p.inGracePeriod).length,
      totalPremium: round2(all.reduce((s, p) => s + (p.currentPremium || 0), 0)),
    },
  };
}

/** Open renewals whose retention risk is Medium or above, with factors and recommended actions. */
export async function atRisk() {
  const ctx = await readContext();
  const actions = (await getSetting('renewals.risk_actions', {})) || {};
  const rows = await many(`${BASE} WHERE r.status = ANY($1) ORDER BY p.expiry_date`, [OPEN]);
  const todayStr = ctx.todayStr;
  return rows.map((r) => toApi(r, ctx)).map((a) => {
    const raw = rows.find((x) => x.id === a.id);
    const days = daysBetween(todayStr, a.expiryDate);
    const { factors } = riskOf(raw, ctx, days, a.premiumVariancePct);
    return { ...a, factors };
  }).filter((a) => a.retentionRisk !== 'Low').map((a) => ({
    id: a.id, renewalId: a.id, policyNumber: a.policyNumber, insuredName: a.insuredName, product: a.product, expiryDate: a.expiryDate, daysToExpiry: a.daysToExpiry,
    currentPremium: a.currentPremium, renewalPremium: a.renewalPremium, riskScore: a.riskScore, riskCategory: a.retentionRisk, riskFactors: a.factors,
    recommendedActions: [...new Set(a.factors.flatMap((f) => actions[f.factor] || []))],
    actionPlan: { priority: a.retentionRisk === 'Critical' ? 'Critical' : a.retentionRisk === 'High' ? 'Urgent' : 'Normal', assignedTo: a.assignedAgent, deadline: a.expiryDate },
  })).sort((x, y) => y.riskScore - x.riskScore);
}
/** Renewals in negotiation (quoted / pending approval or with contact history) with their timeline. */
export async function negotiations() {
  const ctx = await readContext();
  const rows = await many(`${BASE} WHERE r.status = ANY($1) AND (r.status IN ('quoted', 'pending-approval', 'approved')
    OR EXISTS (SELECT 1 FROM renewal_activities a WHERE a.renewal_id = r.id)) ORDER BY r.updated_at DESC`, [OPEN]);
  const acts = await many('SELECT * FROM renewal_activities WHERE renewal_id = ANY($1) ORDER BY at, id', [rows.map((r) => r.id)]);
  return rows.map((r) => {
    const a = toApi(r, ctx);
    return {
      negotiationId: a.renewalNumber, id: a.id, renewalId: a.id, policyNumber: a.policyNumber, clientName: a.clientName, currentStage: a.renewalStatus,
      currentPremium: a.currentPremium, proposedPremium: a.renewalPremium, premiumVariancePct: a.premiumVariancePct, expiryDate: a.expiryDate,
      timeline: acts.filter((x) => x.renewal_id === r.id).map(activityApi),
    };
  });
}

export async function pendingApprovals() {
  const ctx = await readContext();
  const rows = await many(`${BASE} WHERE r.status = 'pending-approval' ORDER BY r.submitted_at`);
  return rows.map((r) => {
    const a = toApi(r, ctx);
    return {
      approvalId: a.id, renewalId: a.id, type: 'Renewal Terms', policyNumber: a.policyNumber, clientName: a.clientName, requestedBy: a.submittedBy,
      requestDate: a.submittedAt, dueDate: a.expiryDate, priority: a.daysToExpiry <= 15 ? 'High' : 'Normal', approvalLevel: 'Underwriting',
      details: { standardPremium: a.currentPremium, requestedPremium: a.renewalPremium, variancePercent: a.premiumVariancePct, justification: a.approvalNote },
    };
  });
}

export async function lapsed() {
  const ctx = await readContext();
  const days = Number(await getSetting('renewals.reinstatement_days', 90));
  const rows = await many(`${BASE} WHERE r.status = 'lapsed' ORDER BY r.lapsed_at DESC`);
  const acts = await many('SELECT * FROM renewal_activities WHERE renewal_id = ANY($1) AND activity_type = \'Win-back\' ORDER BY at', [rows.map((r) => r.id)]);
  return rows.map((r) => {
    const a = toApi(r, ctx);
    const lapseDate = r.lapsed_at ? new Date(r.lapsed_at).toISOString().slice(0, 10) : a.expiryDate;
    const daysLapsed = Math.max(0, daysBetween(lapseDate, ctx.todayStr));
    const attempts = acts.filter((x) => x.renewal_id === r.id).map(activityApi);
    const deadline = new Date(`${lapseDate}T00:00:00Z`); deadline.setUTCDate(deadline.getUTCDate() + days);
    return {
      id: a.id, renewalId: a.id, policyNumber: a.policyNumber, insuredName: a.insuredName, product: a.product, lapseDate, daysLapsed,
      premiumLost: a.renewalPremium ?? a.currentPremium, lapseReason: r.lapse_reason, winBackAttempts: attempts,
      reinstatementEligible: daysLapsed <= days, reinstatementDeadline: deadline.toISOString().slice(0, 10),
      winBackStatus: attempts.length ? 'In Progress' : 'Not Started',
    };
  });
}

/** Retention KPIs over renewals due in [from, to]: renewal rate, premium retention, cycle time, by product, by agent, monthly trend. */
export async function performance(q) {
  const to = (await toDate(q.to)) || await today();
  const from = (await toDate(q.from)) || `${Number(to.slice(0, 4)) - 1}${to.slice(4)}`;
  const rows = await many(`SELECT r.status, r.due_date, r.premium_old, r.premium_new, r.created_at, r.renewed_at, pr.line, pr.name AS product,
      COALESCE(u.display_name, 'Unassigned') AS agent
    FROM renewals r JOIN policies p ON p.id = r.policy_id LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN users u ON u.id = COALESCE(r.owner_user_id, p.owner_user_id) WHERE r.due_date BETWEEN $1 AND $2`, [from, to]);
  const stats = (list) => {
    const decided = list.filter((r) => ['renewed', 'lapsed'].includes(r.status));
    const renewed = list.filter((r) => r.status === 'renewed');
    const expiring = decided.reduce((s, r) => s + Number(r.premium_old || 0), 0);
    const retained = renewed.reduce((s, r) => s + Number(r.premium_new ?? r.premium_old ?? 0), 0);
    const cycles = renewed.filter((r) => r.renewed_at).map((r) => (new Date(r.renewed_at) - new Date(r.created_at)) / 86400000);
    return {
      total: list.length, renewed: renewed.length, lapsed: decided.length - renewed.length, open: list.length - decided.length,
      renewalRate: decided.length ? round2((renewed.length / decided.length) * 100) : 0,
      premiumRetention: expiring ? round2((retained / expiring) * 100) : 0, premiumRetained: round2(retained),
      avgCycleTime: cycles.length ? round2(cycles.reduce((s, c) => s + c, 0) / cycles.length) : 0,
      avgPremium: list.length ? round2(list.reduce((s, r) => s + Number(r.premium_new ?? r.premium_old ?? 0), 0) / list.length) : 0,
    };
  };
  const group = (key) => [...new Set(rows.map((r) => r[key] || 'other'))].map((k) => [k, stats(rows.filter((r) => (r[key] || 'other') === k))]);
  const byAgent = group('agent').map(([agentName, s]) => ({ agentName, renewalRate: s.renewalRate, policiesRenewed: s.renewed, premiumRetained: s.premiumRetained, avgCycleTime: s.avgCycleTime }))
    .sort((a, b) => b.renewalRate - a.renewalRate || b.premiumRetained - a.premiumRetained).map((a, i) => ({ ...a, ranking: i + 1 }));
  const months = [...new Set(rows.map((r) => String(r.due_date).slice(0, 7)))].sort();
  return {
    period: { from, to }, overall: stats(rows),
    byProduct: Object.fromEntries(group('line').map(([k, s]) => [k, { renewalRate: s.renewalRate, avgPremium: s.avgPremium, renewed: s.renewed, lapsed: s.lapsed, open: s.open }])),
    byAgent,
    trends: { monthly: months.map((m) => ({ month: m, rate: stats(rows.filter((r) => String(r.due_date).startsWith(m))).renewalRate })) },
  };
}

// ---------------------------------------------------------------- win-back campaigns
const campaignApi = (c, s) => ({
  id: c.id, campaignId: c.campaign_number, campaignName: c.name, targetSegment: c.target_segment, startDate: c.start_date, endDate: c.end_date,
  status: c.status, offer: { discount: c.discount_pct, additionalBenefits: c.offers }, budget: c.budget, createdBy: c.created_by, createdAt: c.created_at,
  statistics: s,
});
async function campaignStats(c) {
  const s = await one(`SELECT
      (SELECT count(*) FROM renewals r WHERE r.status = 'lapsed' AND r.lapsed_at::date <= $2::date)::int AS targeted,
      (SELECT count(DISTINCT a.renewal_id) FROM renewal_activities a WHERE a.activity_type = 'Win-back' AND a.details->>'campaignId' = $1)::int AS contacted,
      (SELECT count(DISTINCT a.renewal_id) FROM renewal_activities a JOIN renewals r ON r.id = a.renewal_id WHERE a.activity_type = 'Win-back' AND a.details->>'campaignId' = $1 AND r.status <> 'lapsed')::int AS converted,
      (SELECT COALESCE(sum(COALESCE(r.premium_new, r.premium_old)), 0) FROM renewals r WHERE r.status <> 'lapsed' AND EXISTS (SELECT 1 FROM renewal_activities a WHERE a.renewal_id = r.id AND a.activity_type = 'Win-back' AND a.details->>'campaignId' = $1))::numeric AS recovered`, [c.id, c.end_date]);
  return { targetedPolicies: s.targeted + s.converted, contacted: s.contacted, responded: s.converted, converted: s.converted, conversionRate: s.contacted ? round2((s.converted / s.contacted) * 100) : 0, revenueRecovered: s.recovered };
}
export async function listCampaigns() {
  const rows = await many('SELECT * FROM winback_campaigns ORDER BY start_date DESC, created_at DESC');
  const out = [];
  for (const c of rows) out.push(campaignApi(c, await campaignStats(c)));
  return out;
}
export async function createCampaign(input, user) {
  const number = await nextDocumentNumber('campaign', { unique: { table: 'winback_campaigns', column: 'campaign_number' } });
  const c = await one(`INSERT INTO winback_campaigns(campaign_number, name, target_segment, start_date, end_date, discount_pct, budget, offers, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [number, input.campaignName, input.targetSegment || null, await toDate(input.startDate), await toDate(input.endDate),
    input.discount ?? 0, input.budget ?? 0, JSON.stringify(input.offers || []), user?.username ?? null]);
  return campaignApi(c, await campaignStats(c));
}
export async function getCampaign(id) {
  const c = await one('SELECT * FROM winback_campaigns WHERE id = $1 OR campaign_number = $1', [id]);
  return c ? campaignApi(c, await campaignStats(c)) : null;
}
