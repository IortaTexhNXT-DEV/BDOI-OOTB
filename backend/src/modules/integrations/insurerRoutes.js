import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { created, ok, paging } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { uploadFile } from '../documents/tabular.js';
import * as outbox from './framework/outbox.js';
import * as ins from './insurer.js';

/**
 * Master > System Configuration > Insurer Integration: the API mapping of each insurer (write:integrations), the
 * requests sent to insurers (policy issuance, policy data, claim status; write:policies or write:claims) and the claim
 * status file import (the file fallback; write:claims). Premium and policy data by file: Accounts > Insurer
 * Reconciliation (insurer statement import).
 */
const { router, define } = moduleRouter('Insurer Integration', '/insurer-integration');
const SCREEN = 'Master > System Configuration > Insurer Integration';
const readMap = [requireAuth, requirePermission('read:integrations', 'read:policies', 'read:claims')];
const writeMap = [requireAuth, requirePermission('write:integrations')];
const sendPerm = [requireAuth, requirePermission('write:policies', 'write:claims', 'write:integrations')];
const mappingExample = { id: 1, insuranceCompanyId: 3, insurerName: 'Malayan Insurance Co., Inc.', connectorCode: 'INSURER_API', enabled: true, brokerCode: 'BRK-00123', autoIssueRequest: false,
  productMap: { MOTOR: 'PC', FIRE: 'FI' }, requestMap: {}, responseMap: { policyNumber: 'data.policyNo', status: 'data.status', premium: 'data.totalPremium' }, claimStatusMap: { 'UNDER EVALUATION': 'In review' } };
const jsonMap = z.record(z.any());

define({
  method: 'GET', path: '/mappings', summary: 'API mapping of each insurer with the default request map', screen: `${SCREEN} > Mappings`, middleware: readMap,
  response: { success: true, data: [mappingExample], defaultRequestMap: ins.DEFAULT_REQUEST_MAP },
  handler: async (_req, res) => ok(res, await ins.listMappings(), 'OK', { defaultRequestMap: ins.DEFAULT_REQUEST_MAP }),
});
define({
  method: 'PUT', path: '/mappings/:insurerId', summary: 'Create or change the API mapping of an insurer: connector, broker code, automatic issuance request, product codes, request / response / claim status maps',
  screen: `${SCREEN} > Mappings > Edit`, middleware: [...writeMap, validate(z.object({ connectorCode: z.string().trim().min(2).max(40).optional(), enabled: z.boolean().optional(),
    brokerCode: z.string().trim().max(60).nullable().optional(), autoIssueRequest: z.boolean().optional(), productMap: z.record(z.string().max(60)).optional(), requestMap: jsonMap.optional(),
    responseMap: z.record(z.string().max(120)).optional(), claimStatusMap: z.record(z.string().max(60)).optional(), remarks: z.string().max(500).nullable().optional() }).strict())],
  request: { connectorCode: 'INSURER_API', brokerCode: 'BRK-00123', productMap: { MOTOR: 'PC' } }, response: { success: true, data: mappingExample },
  handler: async (req, res) => {
    const { before, after } = await ins.saveMapping(req.params.insurerId, req.body, req.user);
    await audit(req, { entity: 'insurer_api_mapping', entityId: after.insuranceCompanyId, action: before ? 'update' : 'create', before, after });
    ok(res, after, `Mapping of ${after.insurerName} saved`);
  },
});
define({
  method: 'POST', path: '/mappings/:insurerId/preview', summary: 'The issuance request a policy of this insurer would send (request map applied); nothing is sent', screen: `${SCREEN} > Mappings > Preview`,
  middleware: [...readMap, validate(z.object({ policyNumber: z.string().trim().min(1).max(60) }).strict())], request: { policyNumber: 'PC-MLY-2026-000101' },
  response: { success: true, data: { request: { brokerCode: 'BRK-00123', productCode: 'PC', insuredName: 'Maria Santos' } } },
  handler: async (req, res) => {
    const m = await ins.mappingOf(req.params.insurerId);
    if (!m) throw badRequest('Save the mapping first');
    const { row, request } = await ins.buildIssueRequest(null, req.body.policyNumber, m);
    if (Number(row.insurance_company_id) !== Number(m.insurance_company_id)) throw badRequest(`Policy ${row.policy_number} is not with ${m.insurer_name}`);
    ok(res, { request });
  },
});
define({
  method: 'GET', path: '/requests', summary: 'Requests sent to insurers (status, messageType, entityId, search; paging)', screen: `${SCREEN} > Requests`, middleware: readMap,
  query: { messageType: 'insurer.claim_status', status: 'failed' },
  response: { success: true, data: [{ id: 12, connectorCode: 'INSURER_API', messageType: 'insurer.policy_issue', entity: 'policy', reference: 'PC-MLY-2026-000101', status: 'sent', externalRef: 'MIC-PC-2026-77812' }], total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const types = String(req.query.messageType || ins.REQUEST_TYPES.join(',')).split(',').filter((t) => ins.REQUEST_TYPES.includes(t));
    const { total, rows } = await outbox.listMessages({ ...req.query, messageType: (types.length ? types : ins.REQUEST_TYPES).join(',') }, pg);
    ok(res, rows, 'OK', { total, page: pg.page, perPage: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'POST', path: '/requests', summary: 'Send a request to the insurer: policy issuance (insurer.policy_issue), policy and premium data (insurer.policy_data) or claim status (insurer.claim_status)',
  screen: `${SCREEN} > Requests > New request`, middleware: [...sendPerm, validate(z.object({ type: z.enum(ins.REQUEST_TYPES), policyId: z.string().trim().max(60).optional(), claimId: z.string().trim().max(60).optional(),
    force: z.boolean().optional() }).strict().refine((b) => (b.type === 'insurer.claim_status' ? b.claimId : b.policyId), 'The policy (or, for a claim status, the claim) is required'))],
  request: { type: 'insurer.policy_issue', policyId: 'PC-MLY-2026-000101' }, response: { success: true, data: { id: 12, status: 'sent', externalRef: 'MIC-PC-2026-77812' } },
  handler: async (req, res) => {
    const m = await ins.createRequest(req.body, req.user);
    const after = await outbox.getMessage(m.id);
    await audit(req, { entity: after.entity, entityId: after.entityId, action: 'insurer-request', after: { messageId: after.id, type: after.messageType, status: after.status, externalRef: after.externalRef } });
    created(res, after, after.status === 'sent' ? 'Sent to the insurer' : after.status === 'retry' ? `The insurer did not answer; retry scheduled (${after.lastError})` : `Not sent: ${after.lastError || after.status}`);
  },
});
define({
  method: 'POST', path: '/claim-status/import', summary: 'File fallback: claim statuses from the insurer as CSV (Claim Number, Status, Remarks, Status Date); each row goes through the integration inbox',
  screen: `${SCREEN} > Claim status file`, middleware: [requireAuth, requirePermission('write:claims', 'write:integrations'), uploadFile],
  request: { file: '(multipart) claim-status.csv' }, response: { success: true, data: { rows: 2, processed: 2, failed: 0, results: [{ row: 2, claimNumber: 'CLM-2026-00031', status: 'processed' }] } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('Attach the claim status file (CSV)');
    const rows = ins.parseClaimStatusCsv(req.file.buffer.toString('utf8'));
    const results = [];
    for (const r of rows) {
      const i = await outbox.receive({ connectorCode: null, messageType: 'insurer.claim_status', source: 'file', externalRef: req.file.originalname || null, payload: r }, req.user);
      results.push({ row: r.row, claimNumber: r.claimNumber, status: i.status, error: i.lastError || null });
    }
    const out = { rows: rows.length, processed: results.filter((r) => r.status === 'processed').length, failed: results.filter((r) => r.status !== 'processed').length, results };
    await audit(req, { entity: 'integration_inbox', entityId: null, action: 'claim-status-import', after: { file: req.file.originalname, rows: out.rows, processed: out.processed, failed: out.failed } });
    ok(res, out, `${out.processed} of ${out.rows} claim statuses applied`);
  },
});

export default [['/insurer-integration', router]];
