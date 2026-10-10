import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission, hasPermission } from '../../lib/auth.js';
import { scopeOf } from '../../lib/scope.js';
import { calendarPeriod, isoDate } from '../../lib/dates.js';
import { badRequest } from '../../lib/errors.js';
import { one } from '../../db/pool.js';
import * as svc from './service.js';

/** Dashboard KPIs: Executive, Sales, Processing, Claims and the sales home (legacy APIROUTES.DASHBOARD.GET_DETAILS). */
const { router, define } = moduleRouter('Dashboards', '');
const send = (res, data) => res.json({ success: true, ...data, data });
/** Comparison of a dashboard period: the previous period (default) or the same period last year. */
const compareOf = (v) => (v === 'lastYear' ? 'lastYear' : 'previous');

define({
  method: 'GET', path: '/agent/get-dashboard-details', summary: 'Sales home (Account Executive): own funnel, premium this month, renewals due, recent quotations, commission (scope=all for managers)', screen: 'Dashboard > Sales Dashboard',
  middleware: [requireAuth, requirePermission('read:leads', 'read:quotations', 'read:policies')], query: { scope: 'mine' },
  response: { success: true, data: { funnel: { leads: 16, quotations: 14, policies: 8 }, premiumThisMonth: 125000, renewalsDueIn60Days: 3, recentQuotations: [], expiringPolicies: [] } },
  handler: async (req, res) => {
    const scoped = await scopeOf(req);
    const all = !scoped && req.query.scope === 'all' && hasPermission(req.user, 'read:reports');
    send(res, all ? await svc.sales(null) : { ...(await svc.agentHome(svc.ownBook(req.user))), scoped: Boolean(scoped) });
  },
});
define({
  method: 'GET', path: '/dashboard/executive', summary: 'Executive KPIs (premium, policies in force, new business, claims ratio, retention) with their change against the previous period or the same period last year (compare=previous|lastYear), premium by product, monthly trend, regions, products, agents; asOf = when the figures were read',
  screen: 'Dashboard > Executive Dashboard', middleware: [requireAuth, requirePermission('read:reports')], query: { period: 'month', compare: 'previous' },
  response: { success: true, data: { executiveKPIs: { totalRevenue: { value: 125000, change: 12.5, trend: 'up' } }, revenueByProduct: { labels: ['Motor'], data: [125000] }, monthlyTrend: { labels: ['Sep'], premium: [125000] } } },
  handler: async (req, res) => send(res, await svc.executive(req.query.period, compareOf(req.query.compare))),
});
define({
  method: 'GET', path: '/dashboard/sales', summary: 'Sales funnel: leads by status, quotations by status, conversion rates, premium by product and month (always own book for scoped roles)', screen: 'Dashboard > Sales',
  middleware: [requireAuth, requirePermission('read:leads', 'read:quotations')], query: { scope: 'mine' },
  response: { success: true, data: { funnel: { leads: 16, quotations: 14, policies: 8, leadToPolicyRate: 50 }, leadsByStatus: [{ status: 'New', count: 4 }] } },
  handler: async (req, res) => send(res, await svc.sales(req.query.scope === 'mine' || (await scopeOf(req)) ? svc.ownBook(req.user) : null)),
});
define({
  method: 'GET', path: '/dashboard/sales/overview', summary: 'Sales Dashboard: prospects, quotations, conversion and premium for a date range (period=month|quarter|year or from/to) and the same figures of the compared dates as previous (compare=previous|lastYear), pipeline by stage, figures by sales person, premium by product, monthly trend. Scoped roles see their own book; others the whole book or one sales person (salesPerson=user id)',
  screen: 'Dashboard > Sales Dashboard', middleware: [requireAuth, requirePermission('read:leads', 'read:quotations')], query: { period: 'month', compare: 'previous', salesPerson: 'usr_0123' },
  response: { success: true, data: { period: { from: '2026-09-01', to: '2026-09-30', compare: 'previous', comparedFrom: '2026-08-01', comparedTo: '2026-08-30' }, kpis: { prospects: 61, newProspects: 12, quotations: 9, policies: 4, premium: 125000, prospectConversionRate: 25, pipelineValue: 350000 },
    previous: { prospects: 58, newProspects: 9, quotations: 7, policies: 3, premium: 98000 },
    pipeline: { prospects: [{ stage: 'New', count: 7 }], quotations: [{ stage: 'Draft', count: 2, premium: 45000 }] },
    bySalesPerson: [{ userId: 'usr_0123', name: 'Paolo Dizon', prospects: 5, quotations: 3, policies: 2, premium: 64000, conversionRate: 40 }], salesPersons: [{ id: 'usr_0123', name: 'Paolo Dizon' }], scoped: false } },
  handler: async (req, res) => {
    const scoped = await scopeOf(req);
    let from = isoDate(req.query.from);
    let to = isoDate(req.query.to);
    let prevFrom = null;
    if (!from || !to) ({ from, to, prevFrom } = await calendarPeriod(req.query.period || 'month'));
    if (from > to) throw badRequest('The start of the range is after its end');
    const compared = svc.comparisonRange({ from, to, prevFrom }, compareOf(req.query.compare));
    // scoped roles always see their own book; others the whole book or the chosen sales person's
    let book = scoped ? svc.ownBook(req.user) : null;
    if (!scoped && req.query.salesPerson) {
      const u = await one('SELECT id, username FROM users WHERE id = $1', [String(req.query.salesPerson)]);
      if (!u) throw badRequest('Unknown sales person');
      book = svc.ownBook(u);
    }
    const data = await svc.salesOverview({ book, from, to, compared });
    send(res, { ...data, scoped: Boolean(scoped), salesPersons: scoped ? [] : await svc.salesPersons() });
  },
});
define({
  method: 'GET', path: '/dashboard/processing', summary: 'Processing Team workbench: quotations with the customer or the insurers, cycle time, data-quality alerts, cases awaiting decision, volume by LOB', screen: 'Dashboard > Processing Dashboard',
  middleware: [requireAuth, requirePermission('read:quotations')],
  response: { success: true, data: { workbenchMetrics: { newSubmissions: 3, olderSubmissions: 1, avgCycleTime: '26 Hours', openAlerts: { totalAlerts: 0 } }, myCases: [] } },
  handler: async (_req, res) => send(res, await svc.processing()),
});
define({
  method: 'GET', path: '/dashboard/claims', summary: 'Claims KPIs: counts and estimates by status, settled amount, average days to settle', screen: 'Dashboard > Claims Dashboard',
  middleware: [requireAuth, requirePermission('read:claims')], response: { success: true, data: { totalClaims: 5, settledAmount: 85000, claimsByStatus: [{ status: 'registered', count: 2 }] } },
  handler: async (_req, res) => send(res, await svc.claimsSummary()),
});

export default router;
