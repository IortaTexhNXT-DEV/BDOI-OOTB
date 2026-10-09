import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { created, ok, paging } from '../../lib/respond.js';
import { withTransaction } from '../../db/pool.js';
import { sendTable } from '../documents/tabular.js';
import * as ctpl from './ctpl.js';
import { printFormat } from '../../lib/pdf/index.js';
import { formatDateTime } from '../../lib/pdf/format.js';

/**
 * Operations > CTPL Authentication: COC series per insurer and branch, the authentication of each CTPL cover (request
 * to the IC-accredited provider, manual entry of a code obtained on the provider's portal), the unauthenticated CTPL
 * report. Read: read:policies; change: write:policies.
 */
const { router, define } = moduleRouter('CTPL Authentication', '/ctpl');
const SCREEN = 'Operations > CTPL Authentication';
const read = [requireAuth, requirePermission('read:policies')];
const write = [requireAuth, requirePermission('write:policies')];
const authExample = { id: 'cta_0123456789abcdef', policyNumber: 'PC-MLY-2026-000101', insurerName: 'Malayan Insurance Co., Inc.', cocNumber: 'MIC00012345', plateNumber: 'NCA 4521',
  chassisNumber: 'MHFXR41G5J0012345', status: 'authenticated', method: 'api', authCode: '7F3A9C21B0D4', providerReference: 'TXN-88123', ltoStatus: 'not-required', hoursWaiting: null, overdue: false };
const seriesExample = { id: 1, insuranceCompanyId: 3, insurerName: 'Malayan Insurance Co., Inc.', branchCode: null, prefix: 'MIC', seriesFrom: 12000, seriesTo: 12999, nextNumber: 12346,
  numberWidth: 8, remaining: 654, status: 'active', lowStock: false };

define({
  method: 'GET', path: '/authentications', summary: 'CTPL covers and their authentication (status (comma-separated), unauthenticated=true, insuranceCompanyId, from, to, search; paging) with the count per status',
  screen: SCREEN, middleware: read, query: { unauthenticated: 'true', page: 1, pageSize: 20 }, response: { success: true, data: [authExample], counts: { pending: 2, requested: 1, authenticated: 40 }, total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const { total, rows, counts } = await ctpl.listAuthentications(req.query, pg);
    ok(res, rows, 'OK', { total, counts, page: pg.page, perPage: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'GET', path: '/authentications/report', summary: 'Unauthenticated CTPL report (pending, requested and failed covers with the hours waited; or the filters of the list) as Excel or CSV',
  screen: `${SCREEN} > Unauthenticated CTPL report`, middleware: read, query: { format: 'xlsx', unauthenticated: 'true' }, response: '(file) unauthenticated-ctpl.xlsx',
  handler: async (req, res) => {
    const q = { unauthenticated: 'true', ...req.query };
    const { rows } = await ctpl.listAuthentications(q, { limit: 10000, offset: 0 });
    const fmt = await printFormat();
    const cell = (r, key) => {
      if (key === 'overdue') return r.overdue ? 'Yes' : 'No';
      if (key === 'createdAt') return r.createdAt ? formatDateTime(r.createdAt, fmt) : '';
      return r[key] ?? '';
    };
    await sendTable(res, { header: ctpl.REPORT_COLUMNS.map((c) => c.label), rows: rows.map((r) => ctpl.REPORT_COLUMNS.map((c) => cell(r, c.key))),
      fileBase: 'unauthenticated-ctpl', format: req.query.format === 'csv' ? 'csv' : 'xlsx', sheetName: 'Unauthenticated CTPL' });
  },
});
define({
  method: 'GET', path: '/authentications/:id', summary: 'One CTPL authentication record (by id or COC number)', screen: `${SCREEN} > Detail`, middleware: read,
  response: { success: true, data: authExample }, handler: async (req, res) => ok(res, await ctpl.authView(req.params.id)),
});
define({
  method: 'POST', path: '/authentications', summary: 'Register a CTPL cover by hand (policy issued before the automatic registration, or uploaded): COC number from the series unless given',
  screen: `${SCREEN} > Register policy`, middleware: [...write, validate(z.object({ policyNumber: z.string().trim().min(1).max(60), cocNumber: z.string().trim().max(40).optional() }).strict())],
  request: { policyNumber: 'PC-MLY-2026-000101' }, response: { success: true, data: { ...authExample, status: 'requested' } },
  handler: async (req, res) => {
    const id = await withTransaction((db) => ctpl.registerForPolicy(db, req.body.policyNumber, req.user.id, { force: true, cocNumber: req.body.cocNumber || null }));
    const a = await ctpl.authView(id);
    await audit(req, { entity: 'ctpl_authentication', entityId: id, action: 'register', after: a });
    created(res, a, `CTPL of ${a.policyNumber} registered${a.cocNumber ? ` with COC ${a.cocNumber}` : ''}`);
  },
});
define({
  method: 'PUT', path: '/authentications/:id', summary: 'Correct the vehicle identifiers or the COC number of a cover not yet authenticated', screen: `${SCREEN} > Edit`,
  middleware: [...write, validate(z.object(Object.fromEntries([...ctpl.VEHICLE_FIELDS, 'cocNumber'].map((k) => [k, z.string().trim().max(60).optional()]))).strict())],
  request: { plateNumber: 'NCA 4521', chassisNumber: 'MHFXR41G5J0012345' }, response: { success: true, data: authExample },
  handler: async (req, res) => {
    const { before, after } = await ctpl.updateAuthentication(req.params.id, req.body, req.user);
    await audit(req, { entity: 'ctpl_authentication', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Saved');
  },
});
define({
  method: 'POST', path: '/authentications/:id/authenticate', summary: 'Send the authentication request to the CTPL authentication provider now (again after a failure)', screen: `${SCREEN} > Authenticate`,
  middleware: write, response: { success: true, data: authExample },
  handler: async (req, res) => {
    const a = await ctpl.requestAuthentication(req.params.id, req.user);
    await audit(req, { entity: 'ctpl_authentication', entityId: a.id, action: 'authenticate', after: { status: a.status, authCode: a.authCode, lastError: a.lastError } });
    ok(res, a, a.status === 'authenticated' ? `COC ${a.cocNumber} authenticated: ${a.authCode}` : a.status === 'failed' ? `Authentication failed: ${a.lastError}` : 'Request sent; waiting for the provider');
  },
});
define({
  method: 'POST', path: '/authentications/:id/manual', summary: 'Manual fallback: record the authentication code obtained on the provider\'s portal', screen: `${SCREEN} > Enter code`,
  middleware: [...write, validate(z.object({ authCode: z.string().trim().min(4).max(60), providerReference: z.string().trim().max(80).optional(), cocNumber: z.string().trim().max(40).optional(),
    authenticatedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}/).optional() }).strict())],
  request: { authCode: '7F3A9C21B0D4', providerReference: 'PORTAL-2026-0091' }, response: { success: true, data: { ...authExample, method: 'manual' } },
  handler: async (req, res) => {
    const { before, after } = await ctpl.manualEntry(req.params.id, req.body, req.user);
    await audit(req, { entity: 'ctpl_authentication', entityId: after.id, action: 'manual-code', before, after });
    ok(res, after, `COC ${after.cocNumber} authenticated by hand`);
  },
});
define({
  method: 'POST', path: '/authentications/:id/cancel', summary: 'Cancel a CTPL record (spoiled COC, policy cancelled); the COC number stays used', screen: `${SCREEN} > Cancel`,
  middleware: [...write, validate(z.object({ reason: z.string().trim().min(3).max(500) }).strict())], request: { reason: 'COC spoiled when printing' },
  response: { success: true, data: { ...authExample, status: 'cancelled' } },
  handler: async (req, res) => {
    const { before, after } = await ctpl.cancelAuthentication(req.params.id, req.body.reason, req.user);
    await audit(req, { entity: 'ctpl_authentication', entityId: after.id, action: 'cancel', before, after });
    ok(res, after, 'Cancelled');
  },
});

define({
  method: 'GET', path: '/coc-series', summary: 'COC number series per insurer and branch with the numbers left (insuranceCompanyId, status)', screen: `${SCREEN} > COC Series`, middleware: read,
  response: { success: true, data: [seriesExample] }, handler: async (req, res) => ok(res, await ctpl.listSeries(req.query)),
});
define({
  method: 'POST', path: '/coc-series', summary: 'Record a COC series received from an insurer (numbers may not overlap another series of the insurer with the same prefix)', screen: `${SCREEN} > COC Series > New`,
  middleware: [...write, validate(z.object({ insuranceCompanyId: z.coerce.number().int().positive(), branchCode: z.string().trim().max(20).nullable().optional(), prefix: z.string().trim().max(10).regex(/^[A-Z0-9-]*$/, 'capital letters, digits and -').optional(),
    seriesFrom: z.coerce.number().int().min(0), seriesTo: z.coerce.number().int().min(0), numberWidth: z.coerce.number().int().min(1).max(20).optional(), receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).max(100000).optional(), remarks: z.string().max(500).nullable().optional() }).strict())],
  request: { insuranceCompanyId: 3, prefix: 'MIC', seriesFrom: 12000, seriesTo: 12999, numberWidth: 8 }, response: { success: true, data: seriesExample },
  handler: async (req, res) => {
    const s = await ctpl.createSeries(req.body, req.user);
    await audit(req, { entity: 'coc_series', entityId: s.id, action: 'create', after: s });
    created(res, s, `Series ${s.prefix}${s.seriesFrom} to ${s.prefix}${s.seriesTo} recorded`);
  },
});
define({
  method: 'PUT', path: '/coc-series/:id', summary: 'Close or reopen a series, change its branch, low-stock threshold or remarks', screen: `${SCREEN} > COC Series > Edit`,
  middleware: [...write, validate(z.object({ status: z.enum(['active', 'closed']).optional(), branchCode: z.string().trim().max(20).nullable().optional(), lowStockThreshold: z.coerce.number().int().min(0).max(100000).optional(),
    remarks: z.string().max(500).nullable().optional() }).strict())],
  request: { status: 'closed', remarks: 'Returned to the insurer' }, response: { success: true, data: { ...seriesExample, status: 'closed' } },
  handler: async (req, res) => {
    const { before, after } = await ctpl.updateSeries(req.params.id, req.body, req.user);
    await audit(req, { entity: 'coc_series', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Series saved');
  },
});

export default [['/ctpl', router]];
