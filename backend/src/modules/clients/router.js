import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok, paging } from '../../lib/respond.js';
import { sendEntity, actor } from '../documents/common.js';
import { ownRecord, withScope, scopeOf } from '../../lib/scope.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Clients', '/clients');
const customers = moduleRouter('Clients', '/customers');
const SCREEN = 'Operations > Clients';
const canRead = [requireAuth, requirePermission('read:clients')];
const canWrite = [requireAuth, requirePermission('write:clients')];

const clientBody = z.object({
  firstName: z.string().max(100).optional().nullable(), lastName: z.string().max(100).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(), emailId: z.string().email().optional().nullable().or(z.literal('')),
  contactNumber: z.string().max(40).optional().nullable(), DOB: z.string().optional().nullable(), leadCategory: z.string().max(40).optional().nullable(),
  status: z.enum(['active', 'inactive', 'deleted']).optional(),
}).passthrough();
const example = { clientId: 'cl_1', generatedClientId: 'CL-2026-00001', firstName: 'Juan', lastName: 'Dela Cruz', emailId: 'juan@example.com', contactNumber: '09171234567', leadCategory: 'Retail', policies: [{ policyId: 'pol_1', policyNumber: 'POL-2026-00001', status: 'Active' }] };

define({
  method: 'GET', path: '/', summary: 'List clients (search, leadCategory, clientType individual / corporate, status; paging)', screen: SCREEN, middleware: canRead,
  query: { page: 1, pageSize: 10, search: 'juan' },
  response: { success: true, data: { clients: [example], pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 } } },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows } = await svc.listClients(await withScope(req), pg);
    const pagination = { page: pg.page, pageSize: pg.perPage, totalCount: total, totalPages: Math.ceil(total / pg.perPage) };
    res.json({ success: true, data: { clients: rows.map((r) => svc.toClient(r)), pagination }, total, page: pg.page, pageSize: pg.perPage });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Get one client with its policies (by id or client code)', screen: `${SCREEN} > Client view / Payment options`, middleware: [...canRead, ownRecord('client')],
  response: { ...example, success: true, data: example },
  handler: async (req, res) => sendEntity(res, svc.toClient(await svc.getClient(req.params.id))),
});
define({
  method: 'POST', path: '/', summary: 'Create a client', screen: SCREEN, middleware: [...canWrite, validate(clientBody.refine((b) => b.firstName || b.companyName, { message: 'firstName or companyName is required', path: ['firstName'] }))],
  request: { firstName: 'Juan', lastName: 'Dela Cruz', emailId: 'juan@example.com', leadCategory: 'Retail' }, response: { ...example, success: true },
  handler: async (req, res) => {
    const client = svc.toClient(await svc.createClient(req.body, actor(req)));
    await audit(req, { entity: 'client', entityId: client.id, action: 'create', after: client });
    sendEntity(res, client, { status: 201, message: 'Client created' });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Update a client', screen: `${SCREEN} > Edit`, middleware: [...canWrite, ownRecord('client'), validate(clientBody)],
  request: { contactNumber: '09179998888' }, response: { ...example, success: true },
  handler: async (req, res) => {
    const { before, after } = await svc.updateClient(req.params.id, req.body, actor(req));
    const client = svc.toClient(after);
    await audit(req, { entity: 'client', entityId: client.id, action: 'update', before: svc.toClient(before), after: client });
    sendEntity(res, client, { message: 'Client updated' });
  },
});
define({
  method: 'POST', path: '/from-lead/:leadId', summary: 'Convert a lead into a client (returns the existing client when already converted)', screen: 'Operations > Quotation > Convert to policy',
  middleware: [...canWrite, ownRecord('lead', 'leadId')], request: { contactNumber: '09171234567' }, response: { ...example, success: true },
  handler: async (req, res) => {
    const client = svc.toClient(await svc.convertLead(req.params.leadId, req.body || {}, actor(req)));
    await audit(req, { entity: 'client', entityId: client.id, action: 'convert-lead', after: { leadId: req.params.leadId, clientId: client.id } });
    sendEntity(res, client, { status: 201, message: 'Lead converted to client' });
  },
});

customers.define({
  method: 'GET', path: '/codes', summary: 'Customer codes for dropdowns', screen: 'Accounts > Disbursement / Receipts', middleware: canRead,
  response: { success: true, data: [{ clientId: 'cl_1', customerCode: 'CL-2026-00001', name: 'Juan Dela Cruz' }] },
  handler: async (req, res) => ok(res, await svc.customerCodes(await scopeOf(req))),
});

export default router;
export const mount = '/clients';
export const extraMounts = [['/customers', customers.router]];
