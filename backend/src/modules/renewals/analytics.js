/** Read models for the Operations > Renewals workspace screens (queue, at-risk, negotiations, lapse, performance, approvals). */
import { many, one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { round2, today, daysBetween } from '../claims/util.js';
import { BASE, OPEN, RISK_FACTORS, activityApi, listRenewals, readContext, riskOf, toApi } from './service.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { businessDate } from '../../lib/dates.js';

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

/**
 * Risk register of the Renewals > At-Risk Policies screen: open renewals whose retention risk is Medium or above, highest
 * score first, with the score breakdown (every factor with its finding, weight and points), the recommended actions of
 * the factors found (renewals.risk_actions), the next open My Work task on the renewal (or the next step recorded on its
 * timeline) and the last contact.
 */
export async function atRisk() {
  const ctx = await readContext();
  const actions = (await getSetting('renewals.risk_actions', {})) || {};
  const rows = await many(`${BASE} WHERE r.status = ANY($1) ORDER BY p.expiry_date`, [OPEN]);
  const ids = rows.map((r) => r.id);
  const [tasks, steps] = ids.length ? await Promise.all([
    many(`SELECT DISTINCT ON (t.entity_id) t.entity_id, t.id, t.title, t.due_date, u.display_name AS assignee FROM work_tasks t
      LEFT JOIN users u ON u.id = t.assigned_to WHERE t.entity = 'renewal' AND t.entity_id = ANY($1) AND t.status = 'open' ORDER BY t.entity_id, t.due_date, t.id`, [ids]),
    many(`SELECT DISTINCT ON (renewal_id) renewal_id, next_action, follow_up_date FROM renewal_activities
      WHERE renewal_id = ANY($1) AND next_action IS NOT NULL ORDER BY renewal_id, at DESC, id DESC`, [ids]),
  ]) : [[], []];
  const taskOf = new Map(tasks.map((t) => [t.entity_id, t]));
  const stepOf = new Map(steps.map((s) => [s.renewal_id, s]));
  return rows.map((raw) => {
    const a = toApi(raw, ctx);
    const { factors, breakdown } = riskOf(raw, ctx, daysBetween(ctx.todayStr, a.expiryDate), a.premiumVariancePct);
    return { a, raw, factors, breakdown };
  }).filter(({ a }) => a.retentionRisk !== 'Low').map(({ a, raw, factors, breakdown }) => {
    const task = taskOf.get(a.id);
    const step = stepOf.get(a.id);
    const keyOf = (f) => (actions[f.factor] ? f.factor : RISK_FACTORS.find((x) => x.code === f.code)?.factor);
    return {
      id: a.id, renewalId: a.id, renewalNumber: a.renewalNumber, policyId: a.policyId, policyNumber: a.policyNumber, clientId: a.clientId, insuredName: a.insuredName,
      product: a.product, insurer: a.insurer, expiryDate: a.expiryDate, daysToExpiry: a.daysToExpiry, status: a.status, statusCode: a.statusCode,
      currentPremium: a.currentPremium, renewalPremium: a.renewalPremium, riskScore: a.riskScore, riskCategory: a.retentionRisk, riskFactors: factors, scoreBreakdown: breakdown,
      recommendedActions: [...new Set(factors.flatMap((f) => actions[keyOf(f)] || []))],
      nextAction: task ? { kind: 'task', taskId: task.id, title: task.title, dueDate: task.due_date, assignee: task.assignee }
        : step ? { kind: 'step', title: step.next_action, dueDate: step.follow_up_date } : null,
      lastContactDate: a.lastContactDate, contactAttempts: a.contactAttempts, noticeStage: a.noticeStage,
      assignedAgent: a.assignedAgent, assignedAgentId: raw.owner_user_id || raw.policy_owner || null,
      actionPlan: { priority: a.retentionRisk === 'Critical' ? 'Critical' : a.retentionRisk === 'High' ? 'Urgent' : 'Normal', assignedTo: a.assignedAgent, deadline: a.expiryDate },
      expired: a.daysToExpiry < 0, inGracePeriod: a.inGracePeriod, pastGracePeriod: a.pastGracePeriod,
      premiumChangePct: a.premiumVariancePct, premiumChangeReview: a.premiumChangeReview, salesPerson: a.salesPerson,
    };
  }).sort((x, y) => y.riskScore - x.riskScore);
}
/**
 * Negotiation timeline of renewals, newest first: notes and contacts recorded on the renewal, notices sent, re-rated
 * quotes, renewal quotations (prepared, sent to the client, accepted) and the status milestones (opened, submitted,
 * approved, lapsed, renewed). Events already recorded as an activity are not repeated.
 */
export async function timelines(ids) {
  if (!ids.length) return new Map();
  const [acts, notices, rquotes, quotes, rens] = await Promise.all([
    many('SELECT * FROM renewal_activities WHERE renewal_id = ANY($1) ORDER BY at, id', [ids]),
    many('SELECT * FROM renewal_notices WHERE renewal_id = ANY($1) ORDER BY sent_at', [ids]),
    many('SELECT * FROM renewal_quotes WHERE renewal_id = ANY($1) ORDER BY created_at', [ids]),
    many(`SELECT id, quote_number, status, premium_total, created_at, approval_sent_at, approval_sent_to, customer_accepted_at, doc->'renewal'->>'renewalId' AS renewal_id
      FROM quotes WHERE doc->'renewal'->>'renewalId' = ANY($1) AND deleted_at IS NULL ORDER BY created_at`, [ids]),
    many(`SELECT r.id, r.created_at, r.created_by, r.submitted_at, r.approved_at, r.lapsed_at, r.lapse_reason, r.renewed_at, r.approval_note,
      (SELECT display_name FROM users u WHERE u.id = r.submitted_by) AS submitted_name, (SELECT display_name FROM users u WHERE u.id = r.approved_by) AS approved_name
      FROM renewals r WHERE r.id = ANY($1)`, [ids]),
  ]);
  const out = new Map(ids.map((id) => [id, []]));
  const push = (id, e) => out.get(id)?.push({ id: e.id, date: e.date, at: e.date, type: e.type, category: e.category, method: e.method || null,
    description: e.description || null, outcome: e.outcome || null, nextAction: e.nextAction || null, followUpDate: e.followUpDate || null, by: e.by || null, source: e.source });
  const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const CATEGORY = { Note: 'note', 'Counter Offer': 'offer', 'Revised Offer': 'offer', 'Competitor Quote': 'offer', 'Quote Generated': 'quote',
    'Submitted for Approval': 'status', Approved: 'status', Returned: 'status', Renewed: 'status', Lapsed: 'status', Reinstated: 'status' };
  for (const a of acts) {
    const x = activityApi(a);
    push(a.renewal_id, { ...x, id: `act-${a.id}`, date: a.at, category: CATEGORY[a.activity_type] || (/notice/i.test(a.activity_type) ? 'notice' : 'contact'), source: 'activity' });
  }
  const logged = (id, pred) => acts.some((a) => a.renewal_id === id && pred(a));
  for (const n of notices) {
    if (!logged(n.renewal_id, (a) => /notice/i.test(a.activity_type) && Math.abs(new Date(a.at) - new Date(n.sent_at)) < 60000)) {
      push(n.renewal_id, { id: `ntc-${n.id}`, date: n.sent_at, type: 'Renewal notice sent', category: 'notice', method: n.method, description: `Notice ${n.stage} (${n.notice_type}) to ${n.recipient || 'the client'}`, by: n.sent_by, source: 'notice' });
    }
  }
  for (const q of rquotes) {
    if (!logged(q.renewal_id, (a) => a.activity_type === 'Quote Generated' && Math.abs(new Date(a.at) - new Date(q.created_at)) < 60000)) {
      push(q.renewal_id, { id: `rq-${q.id}`, date: q.created_at, type: 'Quote Generated', category: 'quote', description: `Re-rated quote ${q.quote_number}: ${money(q.total_premium)}`, by: q.created_by, source: 'quote' });
    }
  }
  for (const q of quotes) {
    if (!logged(q.renewal_id, (a) => a.details?.quoteId === q.id)) {
      push(q.renewal_id, { id: `qt-${q.id}`, date: q.created_at, type: 'Quotation prepared', category: 'quote', description: `Renewal quotation ${q.quote_number}: ${money(q.premium_total)}`, source: 'quotation' });
    }
    if (q.approval_sent_at) push(q.renewal_id, { id: `qs-${q.id}`, date: q.approval_sent_at, type: 'Quotation sent to client', category: 'quote', method: 'Email', description: `Quotation ${q.quote_number} sent${q.approval_sent_to ? ` to ${q.approval_sent_to}` : ''} for acceptance`, source: 'quotation' });
    if (q.customer_accepted_at) push(q.renewal_id, { id: `qa-${q.id}`, date: q.customer_accepted_at, type: 'Client accepted the quotation', category: 'status', description: `Quotation ${q.quote_number} accepted`, source: 'quotation' });
  }
  for (const r of rens) {
    push(r.id, { id: `open-${r.id}`, date: r.created_at, type: 'Renewal opened', category: 'status', by: r.created_by, source: 'renewal' });
    const has = (type) => logged(r.id, (a) => a.activity_type === type);
    if (r.submitted_at && !has('Submitted for Approval')) push(r.id, { id: `sub-${r.id}`, date: r.submitted_at, type: 'Submitted for Approval', category: 'status', description: r.approval_note, by: r.submitted_name, source: 'renewal' });
    if (r.approved_at && !has('Approved')) push(r.id, { id: `apr-${r.id}`, date: r.approved_at, type: 'Approved', category: 'status', by: r.approved_name, source: 'renewal' });
    if (r.lapsed_at && !has('Lapsed')) push(r.id, { id: `lap-${r.id}`, date: r.lapsed_at, type: 'Lapsed', category: 'status', description: r.lapse_reason, source: 'renewal' });
    if (r.renewed_at && !has('Renewed')) push(r.id, { id: `ren-${r.id}`, date: r.renewed_at, type: 'Renewed', category: 'status', source: 'renewal' });
  }
  for (const list of out.values()) list.sort((x, y) => new Date(y.date) - new Date(x.date));
  return out;
}

/** Renewals in negotiation (quoted / pending approval / approved, or with contact history) with their timeline. */
export async function negotiations() {
  const ctx = await readContext();
  const rows = await many(`${BASE} WHERE r.status = ANY($1) AND (r.status IN ('quoted', 'pending-approval', 'approved')
    OR EXISTS (SELECT 1 FROM renewal_activities a WHERE a.renewal_id = r.id) OR EXISTS (SELECT 1 FROM renewal_notices n WHERE n.renewal_id = r.id)
    OR EXISTS (SELECT 1 FROM quotes q WHERE q.doc->'renewal'->>'renewalId' = r.id AND q.deleted_at IS NULL)) ORDER BY r.updated_at DESC`, [OPEN]);
  const tl = await timelines(rows.map((r) => r.id));
  return rows.map((r) => {
    const a = toApi(r, ctx);
    const timeline = tl.get(r.id) || [];
    return {
      negotiationId: a.renewalNumber, id: a.id, renewalId: a.id, renewalNumber: a.renewalNumber, policyNumber: a.policyNumber, clientName: a.clientName,
      product: a.product, insurer: a.insurer, salesPerson: a.salesPerson, currentStage: a.renewalStatus, statusCode: a.statusCode,
      currentPremium: a.currentPremium, proposedPremium: a.renewalPremium, premiumVariancePct: a.premiumVariancePct, premiumChangeReview: a.premiumChangeReview,
      expiryDate: a.expiryDate, daysToExpiry: a.daysToExpiry, lastActivityAt: timeline[0]?.date || null, timeline,
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
      premiumLost: a.renewalPremium ?? a.currentPremium, lapseReason: r.lapse_reason, lapseReasonCode: r.lapse_reason_code ?? null, winBackAttempts: attempts,
      reinstatementEligible: daysLapsed <= days, reinstatementDeadline: deadline.toISOString().slice(0, 10),
      winBackStatus: attempts.length ? 'In Progress' : 'Not Started',
    };
  });
}

/** Retention KPIs over renewals due in [from, to]: renewal rate, premium retention, cycle time, by product, by agent, monthly trend. */
export async function performance(q) {
  const to = (await businessDate(q.to)) || await today();
  const from = (await businessDate(q.from)) || `${Number(to.slice(0, 4)) - 1}${to.slice(4)}`;
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
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [number, input.campaignName, input.targetSegment || null, await businessDate(input.startDate), await businessDate(input.endDate),
    input.discount ?? 0, input.budget ?? 0, JSON.stringify(input.offers || []), user?.username ?? null]);
  return campaignApi(c, await campaignStats(c));
}
export async function getCampaign(id) {
  const c = await one('SELECT * FROM winback_campaigns WHERE id = $1 OR campaign_number = $1', [id]);
  return c ? campaignApi(c, await campaignStats(c)) : null;
}
