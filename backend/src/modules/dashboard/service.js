/** Dashboard KPIs computed from the operational tables (leads, quotes, policies, claims, renewals, commissions). */
import { many, one } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../documents/common.js';
import { quoteStatusOut } from '../documents/statuses.js';
import { scopeSql } from '../../lib/scope.js';
import { businessTimeZone, calendarPeriod, today } from '../../lib/dates.js';

/**
 * One user's own book, with the same ownership rules as the record scope of security.scoped_roles (lib/scope.js): the
 * dashboard counts exactly the leads, quotations and policies the user's lists show (D108). null = everyone's book.
 */
export const ownBook = (user) => (user ? { userId: user.id, ids: [user.id, user.username].filter(Boolean) } : null);
/** SQL predicate for `alias` of `entity` limited to `book` (pushes its parameter onto params); TRUE for null. */
const inBook = (book, entity, alias, params) => scopeSql(book, entity, alias, params);

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const change = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : (cur ? 100 : 0));
/** Product label of a policy: its product type, else the product master name, else the LOB. */
/** Window of the "renewals due" counters and lists (dashboard.renewals_due_days). */
const renewalsDueDays = async () => Number(await getSetting('dashboard.renewals_due_days', 60)) || 0;
const PRODUCT = "COALESCE(p.product_type, pr.name, p.lob, 'Other')";
/** Start of a business date (Manila midnight by general.timezone) as a timestamptz, for comparing created_at. */
const START = (date, tz) => `(${date}::date::timestamp AT TIME ZONE ${tz})`;

/**
 * Premium written in the current and previous period, policies in force, new business, claims ratio, retention.
 * The period is the calendar month / quarter / year to date in the configured time zone (1 September to today for
 * "This Month"), compared with the whole previous period (August).
 */
export async function executive(period = 'month') {
  const range = await calendarPeriod(period);
  const cur = `created_at >= ${START('$1', '$4')} AND created_at < ${START('$2', '$4')}`;
  const prev = `created_at >= ${START('$3', '$4')} AND created_at < ${START('$1', '$4')}`;
  const k = await one(`SELECT
      COALESCE(sum(premium_total) FILTER (WHERE ${cur}), 0) AS premium_cur,
      COALESCE(sum(premium_total) FILTER (WHERE ${prev}), 0) AS premium_prev,
      count(*) FILTER (WHERE status IN ('active','issued') AND expiry_date >= $5::date)::int AS active,
      count(*) FILTER (WHERE ${cur})::int AS new_cur,
      count(*) FILTER (WHERE ${prev})::int AS new_prev,
      COALESCE(sum(premium_total) FILTER (WHERE renewed_from IS NULL AND ${cur}), 0) AS new_business,
      COALESCE(sum(premium_total), 0) AS premium_all
    FROM policies`, [range.from, range.next, range.prevFrom, range.timeZone, range.to]);
  const claims = await one(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status NOT IN ('settled','closed','rejected'))::int AS open,
      COALESCE(sum(COALESCE(settled_amount, approved_amount, 0)), 0) AS incurred, COALESCE(sum(estimate_amount), 0) AS reserved FROM claims`);
  const ret = await one(`SELECT count(*) FILTER (WHERE status = 'renewed')::int AS renewed, count(*) FILTER (WHERE status IN ('renewed','lapsed'))::int AS closed FROM renewals`);
  const targets = await getSetting('dashboard.targets', {});
  const kpi = (value, prev, target) => ({ value, change: change(value, prev), trend: value >= prev ? 'up' : 'down', target: target ?? null, achievement: target ? pct(value, target) : null });
  const claimsRatio = pct(Number(claims.incurred), Number(k.premium_all));
  return {
    executiveKPIs: {
      totalRevenue: kpi(round2(k.premium_cur), round2(k.premium_prev), targets.totalRevenue),
      activePolicies: kpi(k.active, k.active - k.new_cur + k.new_prev, targets.activePolicies),
      newBusiness: kpi(round2(k.new_business), round2(k.premium_prev), targets.newBusiness),
      claimsRatio: { value: claimsRatio, target: targets.claimsRatio ?? null, trend: claimsRatio <= (targets.claimsRatio ?? 100) ? 'down' : 'up' },
      retentionRate: { value: pct(ret.renewed, ret.closed), target: targets.retentionRate ?? null },
      customerSatisfaction: { value: null, target: targets.customerSatisfaction ?? null, note: 'No survey data captured' },
    },
    revenueByProduct: await premiumByProduct(),
    monthlyTrend: await monthlyTrend(12),
    regionalPerformance: await regional(),
    topProducts: await topProducts(),
    agentPerformance: await agents(),
    claimsAnalytics: { totalClaims: claims.total, openClaims: claims.open, incurred: round2(claims.incurred), reserved: round2(claims.reserved), claimsRatio },
    receivables: await receivablesPosition(),
    currency: await getSetting('currency.default', 'PHP'),
    period: { code: range.period, from: range.from, to: range.to, end: range.end, previousFrom: range.prevFrom, previousTo: range.prevTo },
  };
}

/**
 * What the broker is owed: premium from clients on broker-billed policies (open bills) and commission from insurers on
 * direct-bill policies (the client paid the insurer, so no premium is receivable from the client).
 */
export async function receivablesPosition() {
  const r = await one(`SELECT COALESCE(sum(rv.balance), 0) AS premium, count(*)::int AS bills,
      COALESCE(sum(rv.balance) FILTER (WHERE rv.due_date < $1::date), 0) AS premium_overdue
    FROM receivables rv JOIN policies p ON p.id = rv.policy_id
    WHERE rv.status IN ('open', 'partial') AND rv.balance > 0 AND p.billing_mode <> 'direct'`, [await today()]);
  const { receivableSummary } = await import('../remittance/directbill.js');
  const c = await receivableSummary();
  return { premiumFromClients: round2(r.premium), premiumBills: r.bills, premiumOverdue: round2(r.premium_overdue),
    commissionFromInsurers: c.total, commissionUnbilled: c.unbilled, commissionBilled: c.billedOutstanding, commissionOverdue: c.overdue };
}

/** Premium by product; `book` (ownBook) limits it to one user's policies. */
export async function premiumByProduct(book = null) {
  const params = [];
  const rows = await many(`SELECT ${PRODUCT} AS product, COALESCE(sum(p.premium_total),0) AS premium, count(*)::int AS policies
    FROM policies p LEFT JOIN products pr ON pr.id = p.product_id WHERE ${inBook(book, 'policy', 'p', params)} GROUP BY 1 ORDER BY 2 DESC`, params);
  return { labels: rows.map((r) => r.product), data: rows.map((r) => round2(r.premium)), policies: rows.map((r) => r.policies) };
}

/** Monthly premium / policies / quotes / leads; `book` (ownBook) limits it to one user's book. */
export async function monthlyTrend(months = 12, book = null) {
  const params = [months];
  const pol = inBook(book, 'policy', 'p', params);
  const quo = inBook(book, 'quote', 'q', params);
  const lea = inBook(book, 'lead', 'l', params);
  // Calendar months in the business time zone (general.timezone), so a policy written at 07:00 Manila on the 1st
  // counts in the new month
  params.push(await businessTimeZone());
  const tz = `$${params.length}`;
  const month = (col) => `date_trunc('month', ${col} AT TIME ZONE ${tz})`;
  const rows = await many(`SELECT to_char(m, 'YYYY-MM') AS month, to_char(m, 'Mon') AS label,
      COALESCE((SELECT sum(premium_total) FROM policies p WHERE ${month('p.created_at')} = m AND ${pol}), 0) AS premium,
      (SELECT count(*)::int FROM policies p WHERE ${month('p.created_at')} = m AND ${pol}) AS policies,
      (SELECT count(*)::int FROM quotes q WHERE ${month('q.created_at')} = m AND q.deleted_at IS NULL AND ${quo}) AS quotes,
      (SELECT count(*)::int FROM leads l WHERE ${month('l.created_at')} = m AND l.deleted_at IS NULL AND ${lea}) AS leads
    FROM generate_series(${month('now()')} - make_interval(months => $1 - 1), ${month('now()')}, interval '1 month') AS m ORDER BY m`, params);
  return { labels: rows.map((r) => r.label), months: rows.map((r) => r.month), premium: rows.map((r) => round2(r.premium)),
    policies: rows.map((r) => r.policies), quotes: rows.map((r) => r.quotes), leads: rows.map((r) => r.leads) };
}

async function regional() {
  const rows = await many(`SELECT COALESCE(c.state, 'Unspecified') AS region, COALESCE(sum(p.premium_total),0) AS premium, count(*)::int AS policies
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id GROUP BY 1 ORDER BY 2 DESC`);
  const total = rows.reduce((s, r) => s + Number(r.premium), 0);
  return rows.map((r) => ({ region: r.region, premium: round2(r.premium), policies: r.policies, marketShare: pct(Number(r.premium), total) }));
}

async function topProducts() {
  const rows = await many(`WITH pp AS (SELECT p.id, p.premium_total, ${PRODUCT} AS product FROM policies p LEFT JOIN products pr ON pr.id = p.product_id),
      inc AS (SELECT policy_id, sum(COALESCE(settled_amount, approved_amount, 0)) AS incurred FROM claims GROUP BY 1)
    SELECT pp.product, COALESCE(sum(pp.premium_total),0) AS premium, count(*)::int AS policies, COALESCE(sum(inc.incurred),0) AS incurred
    FROM pp LEFT JOIN inc ON inc.policy_id = pp.id GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);
  return rows.map((r) => ({ product: r.product, premium: round2(r.premium), policies: r.policies, claimRatio: pct(Number(r.incurred), Number(r.premium)) }));
}

async function agents() {
  const rows = await many(`SELECT u.id, u.display_name AS name, u.branch_code AS branch,
      COALESCE((SELECT sum(p.premium_total) FROM policies p WHERE p.owner_user_id = u.id), 0) AS premium,
      (SELECT count(*)::int FROM policies p WHERE p.owner_user_id = u.id) AS policies,
      (SELECT count(*)::int FROM quotes q WHERE q.created_by = u.id AND q.deleted_at IS NULL) AS quotes,
      (SELECT count(*)::int FROM quotes q WHERE q.created_by = u.id AND q.status = 'converted') AS converted
    FROM users u WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.created_by = u.id) OR EXISTS (SELECT 1 FROM policies p WHERE p.owner_user_id = u.id)
    ORDER BY premium DESC LIMIT 10`);
  return rows.map((r) => ({ userId: r.id, name: r.name, branch: r.branch, premium: round2(r.premium), policies: r.policies, quotes: r.quotes, conversion: pct(r.converted, r.quotes) }));
}

/** Sales funnel: leads -> quotes -> policies, optionally for one user's book (ownBook). */
export async function sales(book = null) {
  const lp = [];
  const leadsBy = await many(`SELECT status, count(*)::int AS count FROM leads l WHERE l.deleted_at IS NULL AND ${inBook(book, 'lead', 'l', lp)} GROUP BY 1 ORDER BY 2 DESC`, lp);
  const qp = [];
  const quotesBy = await many(`SELECT status, count(*)::int AS count, COALESCE(sum(premium_total),0) AS premium FROM quotes q WHERE q.deleted_at IS NULL AND ${inBook(book, 'quote', 'q', qp)} GROUP BY 1 ORDER BY 2 DESC`, qp);
  const p = [];
  const lead = inBook(book, 'lead', 'l', p);
  const quote = inBook(book, 'quote', 'q', p);
  const policy = inBook(book, 'policy', 'po', p);
  p.push(await renewalsDueDays());
  const dueDays = `$${p.length}::int`;
  p.push(await businessTimeZone());
  const tz = `$${p.length}`;
  p.push(await today());
  const day = `$${p.length}::date`;
  const f = await one(`SELECT (SELECT count(*)::int FROM leads l WHERE l.deleted_at IS NULL AND ${lead}) AS leads,
      (SELECT count(DISTINCT q.lead_id)::int FROM quotes q WHERE q.deleted_at IS NULL AND ${quote}) AS quoted_leads,
      (SELECT count(*)::int FROM quotes q WHERE q.deleted_at IS NULL AND ${quote}) AS quotes,
      (SELECT count(*)::int FROM policies po WHERE ${policy}) AS policies,
      (SELECT COALESCE(sum(po.premium_total),0) FROM policies po WHERE ${policy} AND date_trunc('month', po.created_at AT TIME ZONE ${tz}) = date_trunc('month', now() AT TIME ZONE ${tz})) AS premium_month,
      (SELECT count(*)::int FROM policies po WHERE ${policy} AND po.status IN ('active','issued') AND po.expiry_date BETWEEN ${day} AND ${day} + ${dueDays}) AS renewals_due`, p);
  return {
    funnel: { leads: f.leads, quotedLeads: f.quoted_leads, quotations: f.quotes, policies: f.policies, leadToQuoteRate: pct(f.quoted_leads, f.leads), quoteToPolicyRate: pct(f.policies, f.quotes), leadToPolicyRate: pct(f.policies, f.leads) },
    leadsByStatus: leadsBy, quotationsByStatus: quotesBy.map((r) => ({ status: quoteStatusOut(r.status), count: r.count, premium: round2(r.premium) })),
    premiumThisMonth: round2(f.premium_month), renewalsDueIn60Days: f.renewals_due,
    premiumByProduct: await premiumByProduct(book), monthlyTrend: await monthlyTrend(6, book),
  };
}

/** Processing Team workbench: quotations waiting for customer / insurer decisions, cycle time and data-quality alerts. */
export async function processing() {
  const m = await one(`SELECT count(*) FILTER (WHERE status IN ('sent','accepted','submitted') AND updated_at >= now() - interval '7 days')::int AS new_subs,
      count(*) FILTER (WHERE status IN ('sent','accepted','submitted') AND updated_at < now() - interval '7 days')::int AS old_subs,
      COALESCE(avg(EXTRACT(EPOCH FROM (COALESCE(approved_at, customer_accepted_at) - created_at)) / 3600) FILTER (WHERE COALESCE(approved_at, customer_accepted_at) IS NOT NULL), 0) AS cycle_hours,
      count(*) FILTER (WHERE valid_until IS NULL AND status NOT IN ('converted','rejected','dropped'))::int AS missing_dates,
      count(*) FILTER (WHERE product_type IS NULL AND status NOT IN ('converted','rejected','dropped'))::int AS missing_lob
    FROM quotes WHERE deleted_at IS NULL`);
  const dup = await one(`SELECT count(*)::int AS n FROM (SELECT lead_id, lob FROM quotes WHERE deleted_at IS NULL AND status IN ('draft','sent','accepted','submitted')
    AND lead_id IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1) d`);
  const cases = await many(`SELECT q.id, q.quote_number, q.status, q.product_type, q.lob, q.premium_total, q.sum_insured, q.valid_until, q.updated_at,
      l.display_name AS insured, u.display_name AS agent FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id LEFT JOIN users u ON u.id = q.created_by
    WHERE q.deleted_at IS NULL AND q.status IN ('sent','accepted','submitted') ORDER BY q.updated_at LIMIT 25`);
  const byLob = await many(`SELECT lob, count(*)::int AS count FROM quotes WHERE deleted_at IS NULL AND status IN ('sent','accepted','submitted','approved') GROUP BY 1 ORDER BY 2 DESC`);
  const hiSi = Number(await getSetting('dashboard.high_sum_insured', 5000000));
  return {
    workbenchMetrics: { newSubmissions: m.new_subs, olderSubmissions: m.old_subs, avgCycleTime: `${Math.round(Number(m.cycle_hours))} Hours`, avgCycleHours: round2(m.cycle_hours),
      openAlerts: { duplicateSubmission: dup.n, missingDates: m.missing_dates, missingLOB: m.missing_lob, totalAlerts: dup.n + m.missing_dates + m.missing_lob } },
    myCases: cases.map((c) => ({ caseId: c.quote_number, quotationId: c.id, proposedInsured: c.insured, agent: c.agent, faceAmount: round2(c.sum_insured), premium: round2(c.premium_total),
      productType: c.product_type || c.lob, requirementDue: c.valid_until, status: quoteStatusOut(c.status), priority: Number(c.sum_insured) >= hiSi ? 'high' : 'medium' })),
    volumeByLOB: { labels: byLob.map((r) => r.lob), data: byLob.map((r) => r.count) },
  };
}

export async function claimsSummary() {
  const byStatus = await many('SELECT status, count(*)::int AS count, COALESCE(sum(estimate_amount),0) AS estimate FROM claims GROUP BY 1 ORDER BY 2 DESC');
  const t = await one(`SELECT count(*)::int AS total, COALESCE(sum(settled_amount),0) AS settled, COALESCE(avg(settled_at::date - reported_date) FILTER (WHERE settled_at IS NOT NULL), 0) AS avg_days FROM claims`);
  return { totalClaims: t.total, settledAmount: round2(t.settled), averageDaysToSettle: round2(t.avg_days), claimsByStatus: byStatus.map((r) => ({ ...r, estimate: round2(r.estimate) })) };
}

/** Sales home (Account Executive): own leads, quotes, policies, premium and renewals due. */
export async function agentHome(book) {
  const s = await sales(book);
  const qp = [];
  const recentQuotes = await many(`SELECT q.id AS "quotationId", q.quote_number AS "quotationNumber", q.status, q.premium_total AS "grossPremium", l.display_name AS "leadName", q.created_at AS "createdAt"
    FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id WHERE q.deleted_at IS NULL AND ${inBook(book, 'quote', 'q', qp)} ORDER BY q.created_at DESC LIMIT 5`, qp);
  const pp = [];
  const scope = inBook(book, 'policy', 'p', pp);
  pp.push(await renewalsDueDays());
  pp.push(await today());
  const expiring = await many(`SELECT p.id AS "policyId", p.policy_number AS "policyNumber", p.insured_name AS "insuredName", p.expiry_date AS "expiry", p.premium_total AS "grossPremium"
    FROM policies p WHERE ${scope} AND p.status IN ('active','issued') AND p.expiry_date BETWEEN $${pp.length}::date AND $${pp.length}::date + $${pp.length - 1}::int ORDER BY p.expiry_date LIMIT 10`, pp);
  const commission = await one(`SELECT COALESCE(sum(net_amount) FILTER (WHERE lower(status) <> 'paid'), 0) AS unpaid, COALESCE(sum(net_amount) FILTER (WHERE lower(status) = 'paid'), 0) AS paid
    FROM commissions WHERE agent_user_id = $1`, [book?.userId]);
  // Premium of the book's policies: collected = paid on the premium bills (receipts applied), receivable = still open.
  // Bills cancelled because the policy is direct bill (the client pays the insurer) count in neither (D118).
  const bp = [];
  const book$ = inBook(book, 'policy', 'p', bp);
  const premium = await one(`SELECT COALESCE(sum(p.premium_total), 0) AS gross,
      (SELECT COALESCE(sum(r.amount - r.balance), 0) FROM receivables r JOIN policies p ON p.id = r.policy_id WHERE r.status <> 'cancelled' AND ${book$}) AS collected,
      (SELECT COALESCE(sum(r.balance), 0) FROM receivables r JOIN policies p ON p.id = r.policy_id WHERE r.status IN ('open', 'partial') AND ${book$}) AS receivable
    FROM policies p WHERE ${book$}`, bp);
  const cp = [];
  const clients = await one(`SELECT count(*)::int AS n FROM clients c WHERE ${inBook(book, 'client', 'c', cp)}`, cp);
  return { ...s, recentQuotations: recentQuotes.map((r) => ({ ...r, status: quoteStatusOut(r.status) })), expiringPolicies: expiring,
    commission: { unpaid: round2(commission.unpaid), paid: round2(commission.paid) },
    premium: { gross: round2(premium.gross), collected: round2(premium.collected), receivable: round2(premium.receivable) }, clients: clients.n };
}
