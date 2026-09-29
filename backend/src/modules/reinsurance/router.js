import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { created, ok } from '../../lib/respond.js';
import { canRead, canWrite } from '../masters/helpers.js';
import * as svc from './service.js';

/** Reinsurance (5 screens + Treaty master). Method names mirror services/mockData/reinsuranceMockData.js. */
const { router, define } = moduleRouter('Reinsurance', '/reinsurance');
const read = canRead('reinsurance');
const write = canWrite('reinsurance');
// Claims officers register and follow up recoveries on their claims (Reinsurance > Claims Recovery).
const recoveryRead = canRead('reinsurance', 'write:claims');
const recoveryWrite = canWrite('reinsurance', 'write:claims');
// Reconciling reinsurer statements (premium / claims accounts) is a finance task: remittance users reconcile and resolve
// variances and exceptions, and read the reinsurer list the statement form offers. Treaties and cessions stay
// with reinsurance users.
const reconRead = canRead('reinsurance', 'read:remittance', 'write:remittance');
const reconWrite = canWrite('reinsurance', 'write:remittance');
const S = (n) => `Reinsurance > ${n}`;
const treaty = { id: 1, treatyNumber: 'QS-MOTOR-2026', name: 'Motor Quota Share Treaty 2026', type: 'Quota Share', lineOfBusiness: 'Motor', reinsurers: ['RE001', 'RE002'], effectiveDate: '2026-01-01', expiryDate: '2026-12-31', cession: { percentage: 40, maxLimit: 50000000 }, commission: { type: 'Flat', rate: 32.5 }, status: 'Active', utilization: 12.5, premiumCeded: 1250000, claimsRecovered: 450000 };
const cession = { id: 1, cessionNumber: 'CES-2026-00001', policyNumber: 'POL-2026-90002', insured: 'Sample Corp.', treatyId: 1, treatyNumber: 'QS-MOTOR-2026', grossPremium: 142500, sumInsured: 7500000, cessionPercentage: 40, cededPremium: 57000, cededSumInsured: 3000000, commission: 18525, netPremium: 38475, status: 'Pending' };
const run = async (req, entity, action, fn) => {
  const out = await fn();
  await audit(req, { entity, entityId: out?.after?.id ?? out?.id ?? req.params.id, action, before: out?.before, after: out?.after ?? out });
  return out?.after ?? out;
};

// ---------- security policy / reinsurers ----------
define({
  method: 'GET', path: '/security-policy', summary: 'Minimum reinsurer security rating (configuration) and the rating scale (security-rating master)', screen: 'Master > Reinsurance Treaty', middleware: read,
  response: { success: true, data: { minimumRating: 'A-', scale: [{ rating: 'AA-', rank: 19 }] } },
  handler: async (_req, res) => {
    const p = await svc.securityPolicy();
    ok(res, { minimumRating: p.min, minimumRank: p.minRank, scale: [...p.scale.entries()].sort((a, b) => b[1] - a[1]).map(([rating, rank]) => ({ rating, rank })) });
  },
});
define({
  method: 'GET', path: '/reinsurers', summary: 'Reinsurers with security rating and whether they meet the minimum', screen: 'Master > Reinsurance Treaty', middleware: reconRead, query: { status: 'Active' },
  response: { success: true, data: [{ id: 'RE001', name: 'National Reinsurance Corporation of the Philippines', type: 'Local', rating: 'A-', meetsMinimumRating: true, status: 'Active' }], minimumRating: 'A-' },
  handler: async (req, res) => {
    const { rows, minimumRating } = await svc.listReinsurers(req.query);
    ok(res, rows, 'OK', { minimumRating });
  },
});
define({
  method: 'GET', path: '/reinsurers/:id', summary: 'One reinsurer', screen: 'Master > Reinsurance Treaty', middleware: read, response: { success: true, data: { id: 'RE001' } },
  handler: async (req, res) => ok(res, await svc.getReinsurer(req.params.id)),
});
define({
  method: 'POST', path: '/reinsurers', summary: 'Add a reinsurer (rating must be in the security-rating master)', screen: 'Master > Reinsurance Treaty', middleware: write,
  request: { name: 'Pacific Re Asia', shortName: 'Pacific Re', type: 'Regional', country: 'Singapore', rating: 'A', ratingAgency: 'AM Best', capacity: 'USD 1 Billion', contact: { email: 'treaty@pacificre.example' } },
  response: { success: true, data: { id: 'RE-2026-00001', rating: 'A', meetsMinimumRating: true } },
  handler: async (req, res) => created(res, await run(req, 'reinsurer', 'create', () => svc.createReinsurer(req.body || {}, req.user)), 'Reinsurer created'),
});
define({
  method: 'PUT', path: '/reinsurers/:id', summary: 'Update a reinsurer (rating, status, contact)', screen: 'Master > Reinsurance Treaty', middleware: write, request: { rating: 'BBB+' }, response: { success: true, data: { id: 'RE001' } },
  handler: async (req, res) => ok(res, await run(req, 'reinsurer', 'update', () => svc.updateReinsurer(req.params.id, req.body || {}, req.user)), 'Reinsurer updated'),
});

// ---------- treaties ----------
define({
  method: 'GET', path: '/treaties', summary: 'Treaties with utilization, premium ceded and claims recovered (filter status, type, lineOfBusiness, reinsurer, search)', screen: `${S('Treaty Dashboard')}; Master > Reinsurance Treaty`,
  middleware: read, query: { status: 'Active' }, response: { success: true, data: [treaty] },
  handler: async (req, res) => ok(res, await svc.listTreaties(req.query)),
});
define({
  method: 'GET', path: '/treaties/:id', summary: 'One treaty (id or treaty number)', screen: S('Treaty Detail'), middleware: read, response: { success: true, data: treaty },
  handler: async (req, res) => ok(res, await svc.getTreaty(req.params.id)),
});
define({
  method: 'POST', path: '/treaties', summary: 'Add a treaty; every reinsurer must meet the minimum security rating; pending approval when configured', screen: 'Master > Reinsurance Treaty > Add Treaty', middleware: write,
  request: { treatyNumber: 'QS-FIRE-2027', name: 'Fire Quota Share 2027', type: 'Quota Share', lineOfBusiness: 'Fire', reinsurers: ['RE001', 'RE002'], effectiveDate: '2027-01-01', expiryDate: '2027-12-31', retention: 100000000, cession: { percentage: 50, maxLimit: 100000000 }, commission: { type: 'Flat', rate: 32.5 } },
  response: { success: true, data: { ...treaty, status: 'Pending Approval' } },
  handler: async (req, res) => created(res, await run(req, 'treaty', 'create', () => svc.createTreaty(req.body || {}, req.user)), 'Treaty created'),
});
define({
  method: 'PUT', path: '/treaties/:id', summary: 'Update a treaty (changes to an active treaty go back for approval when configured)', screen: 'Master > Reinsurance Treaty > Edit', middleware: write,
  request: { commission: { type: 'Flat', rate: 30 } }, response: { success: true, data: treaty },
  handler: async (req, res) => ok(res, await run(req, 'treaty', 'update', () => svc.updateTreaty(req.params.id, req.body || {}, req.user)), 'Treaty updated'),
});
for (const action of ['approve', 'reject']) {
  define({
    method: 'POST', path: `/treaties/:id/${action}`, summary: `${action === 'approve' ? 'Approve' : 'Reject'} a treaty (maker-checker; approval re-checks security ratings)`, screen: 'Master > Reinsurance Treaty', middleware: write,
    request: action === 'reject' ? { reason: 'Reinsurer panel incomplete' } : {}, response: { success: true, data: { ...treaty, status: action === 'approve' ? 'Active' : 'Rejected' } },
    handler: async (req, res) => ok(res, await run(req, 'treaty', action, () => svc.decideTreaty(req.params.id, action, req.body || {}, req.user)), `Treaty ${action}d`),
  });
}
define({
  method: 'GET', path: '/treaties/:id/capacity', summary: 'Treaty capacity, used, available and utilization', screen: S('Treaty Detail'), middleware: read,
  response: { success: true, data: { capacity: 50000000, used: 6250000, available: 43750000, utilization: 12.5 } },
  handler: async (req, res) => ok(res, await svc.treatyCapacity(req.params.id)),
});
define({
  method: 'GET', path: '/treaties/:id/cessions', summary: 'Cessions under a treaty', screen: S('Treaty Detail'), middleware: read, response: { success: true, data: [cession] },
  handler: async (req, res) => ok(res, await svc.listCessions({ treatyId: (await svc.getTreaty(req.params.id)).id })),
});
define({
  method: 'GET', path: '/treaties/:id/claims', summary: 'Recovery claims under a treaty', screen: S('Treaty Detail'), middleware: read, response: { success: true, data: [{ recoveryNumber: 'RCL-2026-00001', status: 'Pending' }] },
  handler: async (req, res) => ok(res, await svc.listRecoveries({ treatyId: (await svc.getTreaty(req.params.id)).id })),
});

// ---------- cessions ----------
define({
  method: 'GET', path: '/cessions', summary: 'Cessions (filter treatyId, status, type Treaty/Facultative, search)', screen: S('Cession Tracking'), middleware: read, response: { success: true, data: [cession] },
  handler: async (req, res) => ok(res, await svc.listCessions(req.query)),
});
define({
  method: 'GET', path: '/cessions/:id', summary: 'One cession', screen: S('Cession Tracking'), middleware: read, response: { success: true, data: cession },
  handler: async (req, res) => ok(res, await svc.getCession(req.params.id)),
});
define({
  method: 'POST', path: '/cessions', summary: 'Process a cession: treaty share (quota share / surplus lines) or facultative; capacity and security checks', screen: `${S('Cession Tracking > Process Cession')}`, middleware: write,
  request: { policyNumber: 'POL-2026-90002', treatyId: 1 }, response: { success: true, data: cession },
  handler: async (req, res) => created(res, await run(req, 'cession', 'create', () => svc.createCession(req.body || {}, req.user)), 'Cession created'),
});
for (const action of ['confirm', 'reject']) {
  define({
    method: 'POST', path: `/cessions/:id/${action}`, summary: `${action === 'confirm' ? 'Confirm' : 'Reject'} a cession (maker-checker)`, screen: S('Cession Tracking'), middleware: write,
    request: action === 'reject' ? { reason: 'Reinsurer declined' } : {}, response: { success: true, data: { ...cession, status: action === 'confirm' ? 'Confirmed' : 'Rejected' } },
    handler: async (req, res) => ok(res, await run(req, 'cession', action, () => svc.decideCession(req.params.id, action, req.body || {}, req.user)), `Cession ${action}ed`),
  });
}

// ---------- recoveries ----------
define({
  method: 'GET', path: '/claims', summary: 'Reinsurance recovery claims (filter status, treatyId)', screen: S('Claims Recovery'), middleware: recoveryRead,
  response: { success: true, data: [{ id: 'rcl_1', recoveryNumber: 'RCL-2026-00001', claimNumber: 'CLM-2026-00001', grossClaim: 500000, recoverableAmount: 200000, status: 'Pending' }] },
  handler: async (req, res) => ok(res, await svc.listRecoveries(req.query)),
});
define({
  method: 'GET', path: '/claims/:id', summary: 'One recovery claim', screen: S('Claims Recovery'), middleware: recoveryRead, response: { success: true, data: { id: 'rcl_1' } },
  handler: async (req, res) => ok(res, await svc.getRecovery(req.params.id)),
});
define({
  method: 'POST', path: '/claims', summary: 'Register a recovery for a claim (recoverable from the cession share or XoL layers)', screen: S('Claims Recovery'), middleware: recoveryWrite,
  request: { claimNumber: 'CLM-2026-00001', grossClaim: 500000, causeOfLoss: 'Collision', documents: ['Loss Report'] }, response: { success: true, data: { recoverableAmount: 200000, status: 'Pending' } },
  handler: async (req, res) => created(res, await run(req, 'ri_recovery', 'create', () => svc.createRecovery(req.body || {}, req.user)), 'Recovery registered'),
});
for (const [path, action, label] of [['submit-recovery', 'submit', 'Submit to reinsurers'], ['settle', 'settle', 'Record the reinsurer settlement'], ['dispute', 'dispute', 'Mark as disputed'], ['cash-call', 'cash-call', 'Request a cash call']]) {
  define({
    method: 'POST', path: `/claims/:id/${path}`, summary: label, screen: S('Claims Recovery'), middleware: recoveryWrite,
    request: { settle: { settlementAmount: 200000, recoveryDate: '2026-09-30' }, dispute: { reason: 'Late notification' }, 'cash-call': { amount: 100000 } }[action] || {},
    response: { success: true, data: { status: { submit: 'Processing', settle: 'Recovered', dispute: 'Disputed', 'cash-call': 'Processing' }[action] } },
    handler: async (req, res) => ok(res, await run(req, 'ri_recovery', action, () => svc.recoveryAction(req.params.id, action, req.body || {}, req.user)), 'Recovery updated'),
  });
}

// ---------- bordereaux ----------
define({
  method: 'GET', path: '/bordereaux', summary: 'Premium and claims bordereaux', screen: `${S('Reports')}; ${S('Reconciliation')}`, middleware: read, query: { type: 'Premium' },
  response: { success: true, data: [{ id: 'bdx_1', reference: 'BDX-2026-00001', type: 'Premium', period: '2026-09', entries: 5, grossPremium: 850000, cededPremium: 340000, commission: 110500, netAmount: 229500, status: 'Submitted' }] },
  handler: async (req, res) => ok(res, await svc.listBordereaux(req.query)),
});
define({
  method: 'POST', path: '/bordereaux/generate', summary: 'Generate a bordereau for a period (confirmed cessions or recoveries); writes a CSV file', screen: S('Reports > Bordereau'), middleware: write,
  request: { type: 'Premium', period: '2026-09', treatyId: 1 }, response: { success: true, data: { reference: 'BDX-2026-00002', status: 'Draft', fileUrl: 'http://host/api/s3/object/bordereaux/x.csv' } },
  handler: async (req, res) => created(res, await run(req, 'bordereau', 'generate', () => svc.generateBordereau(req.body || {}, req.user)), 'Bordereau generated'),
});
for (const action of ['submit', 'confirm']) {
  define({
    method: 'POST', path: `/bordereaux/:id/${action}`, summary: `${action === 'submit' ? 'Submit' : 'Confirm'} a bordereau`, screen: S('Reports > Bordereau'), middleware: write,
    response: { success: true, data: { status: action === 'submit' ? 'Submitted' : 'Confirmed' } },
    handler: async (req, res) => ok(res, await run(req, 'bordereau', action, () => svc.bordereauAction(req.params.id, action, req.user)), `Bordereau ${action}ed`),
  });
}

// ---------- analytics / reconciliation / reports ----------
define({
  method: 'GET', path: '/analytics', summary: 'Treaty utilization, loss ratio trend, retention, recovery performance, catastrophe exposure', screen: `${S('Analytics')}; ${S('Treaty Dashboard')}`, middleware: recoveryRead,
  response: { success: true, data: { treatyUtilization: [{ treaty: 'QS-MOTOR-2026', utilization: 12.5 }], lossRatioTrend: [{ month: 'Sep', gross: 65, net: 58 }], retentionOptimization: { current: { retention: 60, cession: 40, profitability: 15.5 } }, recoveryPerformance: { recoveryRate: 85 }, catastropheExposure: { zones: [], perils: [] } } },
  handler: async (_req, res) => ok(res, await svc.analytics()),
});
define({
  method: 'GET', path: '/reconciliation', summary: 'Statement reconciliations (pending / matched) and exceptions', screen: S('Reconciliation'), middleware: reconRead,
  response: { success: true, data: { pending: [{ id: 'rrc_1', type: 'Premium', reinsurer: 'RE001', period: '2026-08', ourAmount: 3200000, theirAmount: 3180000, variance: 20000, variancePercent: 0.6, status: 'Pending Review', items: 42 }], exceptions: [] } },
  handler: async (_req, res) => ok(res, await svc.reconciliation()),
});
define({
  method: 'POST', path: '/reconciliation', summary: "Reconcile a reinsurer's statement amount against our cessions / recoveries (tolerance from configuration)", screen: S('Reconciliation'), middleware: reconWrite,
  request: { type: 'Premium', reinsurerId: 'RE001', period: '2026-09', theirAmount: 3180000 }, response: { success: true, data: { status: 'Pending Review', variance: 20000 } },
  handler: async (req, res) => created(res, await run(req, 'ri_reconciliation', 'create', () => svc.createReconciliation(req.body || {}, req.user)), 'Reconciliation recorded'),
});
define({
  method: 'POST', path: '/reconciliation/:id/resolve', summary: 'Resolve a reconciliation variance', screen: S('Reconciliation'), middleware: reconWrite, request: { resolution: 'Timing difference; booked in October' },
  response: { success: true, data: { status: 'Resolved' } },
  handler: async (req, res) => ok(res, await run(req, 'ri_reconciliation', 'resolve', () => svc.resolveReconciliation(req.params.id, req.body || {}, req.user)), 'Reconciliation resolved'),
});
define({
  method: 'POST', path: '/exceptions', summary: 'Log a reconciliation exception', screen: S('Reconciliation'), middleware: reconWrite, request: { type: 'Missing Policy', description: 'Policy not in reinsurer statement', amount: 45000 },
  response: { success: true, data: { status: 'Under Investigation' } },
  handler: async (req, res) => created(res, await run(req, 'ri_exception', 'create', () => svc.createException(req.body || {}, req.user)), 'Exception logged'),
});
define({
  method: 'POST', path: '/exceptions/:id/resolve', summary: 'Resolve a reconciliation exception', screen: S('Reconciliation'), middleware: reconWrite, request: { resolution: 'Added to October bordereau' },
  response: { success: true, data: { status: 'Resolved' } },
  handler: async (req, res) => ok(res, await run(req, 'ri_exception', 'resolve', () => svc.resolveException(req.params.id, req.body || {})), 'Exception resolved'),
});
define({
  method: 'GET', path: '/reports/templates', summary: 'Report templates (reinsurance-report-template master)', screen: S('Reports'), middleware: read,
  response: { success: true, data: [{ id: 'RPT001', name: 'Monthly Premium Bordereau', type: 'Premium', frequency: 'Monthly', format: ['Excel', 'PDF'] }] },
  handler: async (_req, res) => ok(res, await svc.reportTemplates()),
});
define({
  method: 'POST', path: '/reports/generate', summary: 'Generate a report from a template (CSV)', screen: S('Reports'), middleware: write, request: { templateId: 'RPT001' },
  response: { success: true, data: { id: 'RPT001', generatedDate: '2026-09-28T00:00:00Z', fileUrl: 'http://host/api/s3/object/reinsurance-reports/x.csv' } },
  handler: async (req, res) => created(res, await run(req, 'ri_report', 'generate', () => svc.generateReport(req.body || {}, req.user)), 'Report generated'),
});

export default router;
export const mount = '/reinsurance';
