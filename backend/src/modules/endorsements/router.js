import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { paging } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { sendEntity, actor } from '../documents/common.js';
import { getPolicyRow, toPolicy } from '../policies/service.js';
import { uploadFile } from '../documents/tabular.js';
import { storeFile } from '../uploads/storage.js';
import { ownRecord, withScope } from '../../lib/scope.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Endorsements', '/endorsements');
const SCREEN = 'Operations > Policy > Endorsement';
const canRead = [requireAuth, requirePermission('read:endorsements')];
const canWrite = [requireAuth, requirePermission('write:endorsements')];
const out = svc.toEndorsement;
const example = { endorsementId: 'end_1', endorsementNumber: 'END-2026-00001', policyId: 'pol_1', policyNumber: 'POL-2026-00001', status: 'Draft', endorsementTypeIds: [1], premiumDelta: 0 };

const createBody = z.object({
  policyId: z.string().min(1, 'policyId is required'), endorsementTypeIds: z.union([z.array(z.union([z.number(), z.string()])), z.number(), z.string()]).optional(),
  isCancelPolicy: z.boolean().optional(), cancellationType: z.string().optional(), premiumDelta: z.union([z.number(), z.string()]).optional(),
}).passthrough();
const completeBody = z.object({
  endorsementId: z.string().min(1), policyNumber: z.string().optional(), endorsementNumber: z.string().optional(), productionDate: z.string().optional(),
  inceptionDate: z.string().optional(), issuedDate: z.string().optional(), expiryDate: z.string().optional(), documentKey: z.string().optional().nullable(), notes: z.string().optional(),
  billingMode: z.enum(['broker', 'direct']).optional(),
}).passthrough();

define({
  method: 'GET', path: '/get-All-Endorsements', summary: 'List endorsements (clientId, policyId, status, search; pageNo / perPage)', screen: 'Operations > Clients > Client view > Endorsements',
  middleware: canRead, query: { pageNo: 1, perPage: 50, clientId: 'cl_1' },
  response: { success: true, data: { items: [example], pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 } } },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { total, rows } = await svc.listEndorsements(await withScope(req), pg);
    const pagination = { page: pg.page, perPage: pg.perPage, total, totalPages: Math.ceil(total / pg.perPage) };
    res.json({ success: true, data: { items: rows.map(out), pagination }, pagination });
  },
});
define({
  method: 'GET', path: '/get-endorsement/policy-id', summary: 'Policy details with its endorsements (endorsement start screen)', screen: `${SCREEN} > Personal details`,
  middleware: [...canRead, ownRecord('policy', (req) => req.query.policyId)], query: { policyId: 'pol_1' }, response: { success: true, data: { policyId: 'pol_1', policyNumber: 'POL-2026-00001', endorsements: [example] } },
  handler: async (req, res) => {
    if (!req.query.policyId) throw badRequest('policyId is required');
    const policy = toPolicy(await getPolicyRow(req.query.policyId));
    const endorsements = (await svc.endorsementsOfPolicy(policy.id)).map(out);
    sendEntity(res, { ...policy, endorsements });
  },
});
define({
  method: 'POST', path: '/create-endorsement', summary: 'Create an endorsement (personal / motor / coverage / extension / cancellation; Fire payloads)', screen: `${SCREEN} > Save`,
  middleware: [...canWrite, validate(createBody), ownRecord('policy', (req) => req.body.policyId)],
  request: { policyId: 'pol_1', endorsementTypeIds: [1, 2], personalDetails: { FirstName: 'Juan', LastName: 'Dela Cruz', ContactNumber: '09179998888' }, motorDetails: { PlateNumber: 'NEW 1234' } },
  response: { ...example, success: true },
  handler: async (req, res) => {
    const e = out(await svc.createEndorsement(req.body, actor(req)));
    await audit(req, { entity: 'endorsement', entityId: e.id, action: 'create', after: e });
    sendEntity(res, e, { status: 201, message: 'Endorsement created' });
  },
});
for (const [path, cancel, label] of [['/send-endorsement-to-customer/:id', false, 'Send the endorsement to the customer (PendingCustomer)'], ['/initiate-cancel-policy/:id', true, 'Initiate policy cancellation (InitiateCancel)']]) {
  define({
    method: 'POST', path, summary: label, screen: `${SCREEN} > Summary`, middleware: [...canWrite, ownRecord('endorsement')], request: { sentBy: 'agent' },
    response: { success: true, message: 'Endorsement sent', endorsement: { ...example, status: cancel ? 'InitiateCancel' : 'PendingCustomer' } },
    handler: async (req, res) => {
      const { before, after, emailedTo } = await svc.sendToCustomer(req.params.id, actor(req), cancel);
      await audit(req, { entity: 'endorsement', entityId: after.id, action: cancel ? 'initiate-cancel' : 'send-to-customer', before: { status: out(before).status }, after: { status: out(after).status, emailedTo } });
      res.json({ success: true, message: cancel ? 'Cancellation initiated' : 'Endorsement sent to customer', emailedTo, endorsement: out(after), data: out(after) });
    },
  });
}
define({
  method: 'POST', path: '/upload-document', summary: 'Upload the endorsement document (multipart: file, endorsementId)', screen: `${SCREEN} > Upload endorsement`,
  middleware: [...canWrite, uploadFile, ownRecord('endorsement', (req) => req.body?.endorsementId)], request: 'multipart/form-data file + endorsementId', response: { success: true, data: { documentKey: 'endorsement/abc.pdf', documentUrl: 'http://host/api/s3/object/endorsement/abc.pdf' } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('file is required');
    if (!req.body?.endorsementId) throw badRequest('endorsementId is required');
    await svc.getEndorsementRow(req.body.endorsementId);
    const stored = await storeFile(req.file, { folder: 'endorsement', userId: actor(req), entity: 'endorsement', entityId: req.body.endorsementId });
    const { key } = stored;
    const e = out(await svc.attachDocument(req.body.endorsementId, key, actor(req)));
    await audit(req, { entity: 'endorsement', entityId: e.id, action: 'upload-document', after: { documentKey: key } });
    res.json({ success: true, message: 'Document uploaded', data: { documentKey: key, documentUrl: e.documentUrl, endorsement: e } });
  },
});
define({
  method: 'POST', path: '/complete-endorsement', summary: 'Complete the endorsement: apply changes and premium delta to the policy, bill a positive delta, notify the policy owner', screen: `${SCREEN} > Upload endorsement > Submit`,
  middleware: [...canWrite, validate(completeBody), ownRecord('endorsement', (req) => req.body.endorsementId)],
  request: { endorsementId: 'end_1', policyNumber: 'POL-2026-00001', endorsementNumber: 'INS-END-778', issuedDate: '2026-09-28', expiryDate: '2027-09-28', documentKey: 'endorsement/abc.pdf' },
  response: { ...example, status: 'Completed', success: true },
  handler: async (req, res) => {
    const { before, after } = await svc.completeEndorsement(req.body, actor(req));
    await audit(req, { entity: 'endorsement', entityId: after.id, action: 'complete', before: out(before), after: out(after) });
    await audit(req, { entity: 'policy', entityId: after.policy_id, action: 'endorse', after: { endorsementNumber: after.endorsement_number, premiumDelta: Number(after.premium_delta), status: out(after).status } });
    sendEntity(res, out(after), { message: 'Endorsement completed' });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Get one endorsement (by id or number)', screen: `${SCREEN} > Detailed view`, middleware: [...canRead, ownRecord('endorsement')],
  response: { ...example, success: true }, handler: async (req, res) => sendEntity(res, out(await svc.getEndorsementRow(req.params.id))),
});

export default router;
export const mount = '/endorsements';
