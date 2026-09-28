import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import * as svc from './service.js';

/** Dashboard KPIs: Executive, Sales, Underwriting, Claims and the agent home (legacy APIROUTES.DASHBOARD.GET_DETAILS). */
const { router, define } = moduleRouter('Dashboards', '');
const send = (res, data) => res.json({ success: true, ...data, data });
const isAdmin = (u) => (u.roles || []).some((r) => ['it-admin', 'ba'].includes(r));

define({
  method: 'GET', path: '/agent/get-dashboard-details', summary: 'Agent home: own funnel, premium this month, renewals due, recent quotations, commission (scope=all for managers)', screen: 'Dashboard > Agent Dashboard',
  middleware: [requireAuth, requirePermission('read:leads', 'read:quotations', 'read:policies')], query: { scope: 'mine' },
  response: { success: true, data: { funnel: { leads: 16, quotations: 14, policies: 8 }, premiumThisMonth: 125000, renewalsDueIn60Days: 3, recentQuotations: [], expiringPolicies: [] } },
  handler: async (req, res) => {
    const all = req.query.scope === 'all' && (isAdmin(req.user) || req.user.permissions.includes('read:reports'));
    send(res, all ? await svc.sales(null) : await svc.agentHome(req.user.id));
  },
});
define({
  method: 'GET', path: '/dashboard/executive', summary: 'Executive KPIs (premium, policies in force, new business, claims ratio, retention), premium by product, monthly trend, regions, products, agents',
  screen: 'Dashboard > Executive Dashboard', middleware: [requireAuth, requirePermission('read:reports')], query: { period: 'month' },
  response: { success: true, data: { executiveKPIs: { totalRevenue: { value: 125000, change: 12.5, trend: 'up' } }, revenueByProduct: { labels: ['Motor'], data: [125000] }, monthlyTrend: { labels: ['Sep'], premium: [125000] } } },
  handler: async (req, res) => send(res, await svc.executive(req.query.period)),
});
define({
  method: 'GET', path: '/dashboard/sales', summary: 'Sales funnel: leads by status, quotations by status, conversion rates, premium by product and month', screen: 'Dashboard > Sales',
  middleware: [requireAuth, requirePermission('read:leads', 'read:quotations')], query: { scope: 'mine' },
  response: { success: true, data: { funnel: { leads: 16, quotations: 14, policies: 8, leadToPolicyRate: 50 }, leadsByStatus: [{ status: 'New', count: 4 }] } },
  handler: async (req, res) => send(res, await svc.sales(req.query.scope === 'mine' ? req.user.id : null)),
});
define({
  method: 'GET', path: '/dashboard/underwriting', summary: 'Underwriting workbench: submissions, cycle time, data-quality alerts, cases awaiting decision, volume by LOB', screen: 'Dashboard > Underwriting Dashboard',
  middleware: [requireAuth, requirePermission('read:quotations')],
  response: { success: true, data: { workbenchMetrics: { newSubmissions: 3, olderSubmissions: 1, avgCycleTime: '26 Hours', openAlerts: { totalAlerts: 0 } }, myCases: [] } },
  handler: async (_req, res) => send(res, await svc.underwriting()),
});
define({
  method: 'GET', path: '/dashboard/claims', summary: 'Claims KPIs: counts and estimates by status, settled amount, average days to settle', screen: 'Dashboard > Claims Dashboard',
  middleware: [requireAuth, requirePermission('read:claims')], response: { success: true, data: { totalClaims: 5, settledAmount: 85000, claimsByStatus: [{ status: 'registered', count: 2 }] } },
  handler: async (_req, res) => send(res, await svc.claimsSummary()),
});

export default router;
