/**
 * Data privacy (Data Privacy Act of 2012, RA 10173): consents of clients and prospects per purpose, the register of
 * data subject requests, the personal data export (access / portability) and anonymisation (erasure once the
 * insurance and tax records no longer have to be kept). Rules: service.js.
 * Permissions: consents follow the party (read:clients / write:clients for a client, read:leads / write:leads for a
 * prospect; read:privacy / write:privacy also pass); the registers, exports and anonymisation need read:privacy /
 * write:privacy (System Administrator, Operations).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission, hasPermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { forbidden } from '../../lib/errors.js';
import { assertVisible } from '../../lib/scope.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { notify } from '../notifications/service.js';
import { actor } from '../documents/common.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Data Privacy', '/privacy');
const read = [requireAuth, requirePermission('read:privacy')];
const write = [requireAuth, requirePermission('write:privacy')];
const S = 'Master > Data Privacy';
const PARTY_SCREENS = 'Operations > Clients > Client view > Data privacy; Sales & Marketing > Prospects > Prospect view';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const partyType = z.enum(['client', 'lead']);

/** Consents follow the party's own permissions: clients for a client, leads for a prospect (or the privacy team's). */
async function partyAccess(req, type, ref, mode) {
  const own = `${mode}:${type === 'client' ? 'clients' : 'leads'}`;
  if (!hasPermission(req.user, own) && !hasPermission(req.user, `${mode}:privacy`)) throw forbidden(`Requires permission: ${own} or ${mode}:privacy`);
  await assertVisible(req, type, ref);
  return svc.getParty(type, ref);
}

// ---------- consents ----------
const consentExample = { id: 1, partyType: 'client', partyId: 'cl_1', purpose: 'marketing', granted: true, status: 'granted', channel: 'Form', noticeVersion: '1.0',
  evidence: 'Signed client information sheet', recordedBy: 'Ana Reyes', recordedAt: '2026-10-01T02:00:00.000Z', withdrawnAt: null };

define({
  method: 'GET', path: '/consents', summary: 'Consent status of a client or prospect per purpose (processing, marketing, sharing) with the full history',
  screen: PARTY_SCREENS, middleware: [requireAuth, requirePermission('read:clients', 'read:leads', 'read:privacy')], query: { partyType: 'client', partyId: 'cl_1' },
  response: { success: true, data: { partyType: 'client', partyId: 'cl_1', partyName: 'Juan Dela Cruz', noticeVersion: '1.0', purposes: [consentExample], history: [consentExample] } },
  handler: async (req, res) => {
    const type = partyType.parse(req.query.partyType);
    const party = await partyAccess(req, type, String(req.query.partyId || ''), 'read');
    ok(res, await svc.consentsOf(party));
  },
});
define({
  method: 'GET', path: '/consents/register', summary: 'Consent register across clients and prospects (filters: purpose, status granted / withdrawn / refused, partyType, channel, current, from, to, search)',
  screen: `${S} > Consent Register`, middleware: read, query: { purpose: 'marketing', status: 'granted', current: 'true' },
  response: { success: true, data: [{ ...consentExample, partyCode: 'CL-2026-00001', partyName: 'Juan Dela Cruz', current: true }] },
  handler: async (req, res) => ok(res, await svc.consentRegister(req.query)),
});
define({
  method: 'POST', path: '/consents', summary: 'Record consent given or refused for a purpose (the notice version defaults to privacy.notice_version)',
  screen: PARTY_SCREENS, middleware: [requireAuth, requirePermission('write:clients', 'write:leads', 'write:privacy'),
    validate(z.object({ partyType, partyId: z.string().min(1), purpose: z.enum(svc.PURPOSES), granted: z.boolean(), channel: z.enum(svc.CHANNELS),
      noticeVersion: z.string().trim().max(20).optional(), evidence: z.string().trim().max(1000).optional() }).strict())],
  request: { partyType: 'client', partyId: 'cl_1', purpose: 'marketing', granted: true, channel: 'Form', evidence: 'Signed client information sheet' },
  response: { success: true, data: consentExample },
  handler: async (req, res) => {
    const party = await partyAccess(req, req.body.partyType, req.body.partyId, 'write');
    const r = svc.consentApi(await svc.recordConsent(party, req.body, actor(req)));
    await audit(req, { entity: 'privacy_consent', entityId: r.id, action: r.granted ? 'grant' : 'refuse', after: r });
    created(res, r, r.granted ? 'Consent recorded' : 'Refusal recorded');
  },
});
define({
  method: 'POST', path: '/consents/:id/withdraw', summary: 'Withdraw a consent in force (the record stays in the history)', screen: PARTY_SCREENS,
  middleware: [requireAuth, requirePermission('write:clients', 'write:leads', 'write:privacy'), validate(z.object({ reason: z.string().trim().min(2).max(500) }).strict())],
  request: { reason: 'Client asked by e-mail to stop marketing messages' }, response: { success: true, data: { ...consentExample, status: 'withdrawn', withdrawnAt: '2026-10-03T01:00:00.000Z' } },
  handler: async (req, res) => {
    const row = await svc.getConsent(req.params.id);
    await partyAccess(req, row.party_type, row.party_id, 'write');
    const r = svc.consentApi(await svc.withdrawConsent(row.id, req.body.reason, actor(req)));
    await audit(req, { entity: 'privacy_consent', entityId: r.id, action: 'withdraw', before: svc.consentApi(row), after: r });
    ok(res, r, 'Consent withdrawn');
  },
});

// ---------- data subject requests ----------
const requestExample = { id: 'dsr_1', requestNumber: 'DSR-2026-00001', partyType: 'client', partyId: 'cl_1', partyName: 'Juan Dela Cruz', requesterName: 'Juan Dela Cruz',
  requesterContact: 'juan@example.com', requestType: 'access', receivedOn: '2026-10-01', dueOn: '2026-10-16', status: 'open', overdue: false, assignedTo: null, outcome: null };
const requestBody = z.object({
  partyType: partyType.optional().nullable(), partyId: z.string().max(60).optional().nullable(), requesterName: z.string().trim().min(2).max(200),
  requesterContact: z.string().trim().max(200).optional().nullable(), requestType: z.enum(svc.REQUEST_TYPES), description: z.string().trim().max(2000).optional().nullable(),
  receivedOn: date.optional(), assignedTo: z.string().max(60).optional().nullable(), responseNotes: z.string().trim().max(4000).optional().nullable(),
}).strict();

async function tellAssignee(r, by) {
  if (!r.assigned_to || r.assigned_to === by) return;
  await notify({ userId: r.assigned_to, type: 'task', title: `Data subject request ${r.request_number} assigned to you`,
    message: `${r.request_type} request of ${r.requester_name}, due on ${svc.requestApi(r).dueOn}`, link: '/master/data-privacy/requests', entity: 'data_subject_request', entityId: r.id });
}

define({
  method: 'GET', path: '/requests', summary: 'Data subject requests (filters: status, requestType, overdue=true, partyType, partyId, assignedTo, search) with counts',
  screen: `${S} > Data Subject Requests`, middleware: read, query: { status: 'open,in-progress', overdue: 'true' },
  response: { success: true, data: { items: [requestExample], summary: { open: 1, overdue: 0, completed: 0, rejected: 0 }, today: '2026-10-03' } },
  handler: async (req, res) => ok(res, await svc.listRequests(req.query)),
});
define({
  method: 'GET', path: '/requests/:id', summary: 'One data subject request (by id or number)', screen: `${S} > Data Subject Requests`, middleware: read,
  response: { success: true, data: requestExample },
  handler: async (req, res) => ok(res, await svc.requestView(req.params.id)),
});
define({
  method: 'POST', path: '/requests', summary: 'Log a data subject request; numbered from the DSR series, due privacy.request_due_days after receipt',
  screen: `${S} > Data Subject Requests`, middleware: [...write, validate(requestBody)],
  request: { partyType: 'client', partyId: 'cl_1', requesterName: 'Juan Dela Cruz', requesterContact: 'juan@example.com', requestType: 'access', receivedOn: '2026-10-01' },
  response: { success: true, data: requestExample },
  handler: async (req, res) => {
    const row = await withTransaction((db) => svc.createRequest(db, req.body, actor(req)));
    const r = await svc.requestView(row.id);
    await audit(req, { entity: 'data_subject_request', entityId: r.id, action: 'create', after: r });
    if (row.assigned_to) await tellAssignee(row, actor(req));
    else {
      await notify({ type: 'task', title: `New data subject request ${r.requestNumber}`, message: `${r.requestType} request of ${r.requesterName}, due on ${r.dueOn}`,
        link: '/master/data-privacy/requests', entity: 'data_subject_request', entityId: r.id, audience: 'write:privacy' });
    }
    created(res, r, `Request ${r.requestNumber} logged, due on ${r.dueOn}`);
  },
});
define({
  method: 'PUT', path: '/requests/:id', summary: 'Update an open request: party, requester, type, date received (due date follows), status open / in-progress, assignee, notes',
  screen: `${S} > Data Subject Requests`,
  middleware: [...write, validate(requestBody.partial().extend({ status: z.enum(['open', 'in-progress']).optional(), outcome: z.string().trim().max(2000).optional().nullable() }).strict())],
  request: { status: 'in-progress', assignedTo: 'usr_1', responseNotes: 'Identity verified with a valid ID' }, response: { success: true, data: { ...requestExample, status: 'in-progress' } },
  handler: async (req, res) => {
    const { before, after } = await withTransaction((db) => svc.updateRequest(db, req.params.id, req.body, actor(req)));
    const r = await svc.requestView(after.id);
    await audit(req, { entity: 'data_subject_request', entityId: r.id, action: 'update', before: svc.requestApi(before), after: r });
    if (after.assigned_to !== before.assigned_to) await tellAssignee(after, actor(req));
    ok(res, r, 'Request updated');
  },
});
define({
  method: 'POST', path: '/requests/:id/close', summary: 'Close a request as completed or rejected, with the outcome told to the data subject',
  screen: `${S} > Data Subject Requests`,
  middleware: [...write, validate(z.object({ status: z.enum(['completed', 'rejected']), outcome: z.string().trim().min(2).max(2000),
    responseNotes: z.string().trim().max(4000).optional(), closedOn: date.optional() }).strict())],
  request: { status: 'completed', outcome: 'Personal data sent to the client by e-mail on 2026-10-05' }, response: { success: true, data: { ...requestExample, status: 'completed', closedOn: '2026-10-05' } },
  handler: async (req, res) => {
    const { before, after } = await withTransaction((db) => svc.closeRequest(db, req.params.id, req.body, actor(req)));
    const r = await svc.requestView(after.id);
    await audit(req, { entity: 'data_subject_request', entityId: r.id, action: 'close', before: svc.requestApi(before), after: r });
    ok(res, r, `Request ${r.requestNumber} closed`);
  },
});

// ---------- parties: look-up, export, anonymisation ----------
define({
  method: 'GET', path: '/parties', summary: 'Clients and prospects by name, code, e-mail or phone (at least 2 characters), for the request register',
  screen: `${S} > Data Subject Requests`, middleware: read, query: { search: 'dela cruz' },
  response: { success: true, data: [{ partyType: 'client', partyId: 'cl_1', code: 'CL-2026-00001', name: 'Juan Dela Cruz', email: 'juan@example.com', phone: '09171234567' }] },
  handler: async (req, res) => ok(res, await svc.searchParties(req.query.search)),
});
define({
  method: 'GET', path: '/assignees', summary: 'Active users who work the data privacy registers (read:privacy)', screen: `${S} > Data Subject Requests`, middleware: read,
  response: { success: true, data: [{ id: 'usr_1', name: 'Ana Reyes', username: 'ana.reyes' }] },
  handler: async (_req, res) => ok(res, await svc.assignees()),
});
define({
  method: 'GET', path: '/parties/:type/:id/export', summary: 'Personal data held about a client or prospect (access / portability): JSON, or ?format=xlsx; ?requestId= notes it on the request',
  screen: `${S} > Data Subject Requests > Export personal data`, middleware: read, query: { format: 'json', requestId: 'DSR-2026-00001' },
  response: { success: true, data: { party: { type: 'client', code: 'CL-2026-00001', name: 'Juan Dela Cruz' }, personalData: { firstName: 'Juan', email: 'juan@example.com' }, consents: [], policies: [], claims: [], receipts: [] } },
  handler: async (req, res) => {
    const type = partyType.parse(req.params.type);
    const party = await svc.getParty(type, req.params.id);
    const doc = await svc.exportParty(party);
    const requestNumber = await withTransaction((db) => svc.noteRequestAction(db, req.query.requestId, party, 'export', actor(req)));
    const format = String(req.query.format || 'json').toLowerCase() === 'xlsx' ? 'xlsx' : 'json';
    await audit(req, { entity: type, entityId: party.id, action: 'privacy-export',
      after: { format, requestNumber, sections: Object.fromEntries(Object.entries(doc).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])) } });
    if (format === 'xlsx') {
      const buf = writeXlsx({ sheets: svc.exportSheets(doc), title: `Personal data of ${party.code}` });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="personal-data-${party.code}.xlsx"`);
      return res.send(buf);
    }
    if (String(req.query.download) === 'true') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="personal-data-${party.code}.json"`);
      return res.send(JSON.stringify(doc, null, 2));
    }
    return ok(res, doc);
  },
});
define({
  method: 'GET', path: '/parties/:type/:id/anonymise/dry-run', summary: 'What anonymising the party would do: the reasons it is refused (open business, retention period) and the fields that would be cleared',
  screen: `${S} > Data Subject Requests > Anonymise`, middleware: read,
  response: { success: true, data: { allowed: false, blockers: [{ code: 'retention-period', message: 'Insurance and tax records are kept until 2035-10-01' }], retention: { years: 10, lastPolicyExpiry: '2025-10-01', retainedUntil: '2035-10-01' }, cleared: { clients: { rows: 1, fields: ['email', 'phone'] } } } },
  handler: async (req, res) => {
    const party = await svc.getParty(partyType.parse(req.params.type), req.params.id);
    ok(res, await svc.anonymiseDryRun(pool, party));
  },
});
define({
  method: 'POST', path: '/parties/:type/:id/anonymise', summary: 'Anonymise a client or prospect: personal fields overwritten in the party, its prospects, policies, quotations, claims and slips; amounts, numbers and dates kept. Refused (409, with the reasons) while records must be kept',
  screen: `${S} > Data Subject Requests > Anonymise`,
  middleware: [...write, validate(z.object({ reason: z.string().trim().min(5).max(1000), requestId: z.string().max(60).optional() }).strict())],
  request: { reason: 'Erasure request DSR-2026-00004; retention period over', requestId: 'DSR-2026-00004' },
  response: { success: true, data: { partyType: 'client', partyCode: 'CL-2014-00001', label: 'Anonymised client CL-2014-00001', cleared: { clients: { rows: 1, fields: ['email', 'phone'] } } } },
  handler: async (req, res) => {
    const party = await svc.getParty(partyType.parse(req.params.type), req.params.id);
    const { result, requestNumber } = await withTransaction(async (db) => {
      const out = await svc.anonymise(db, party, actor(req));
      return { result: out, requestNumber: await svc.noteRequestAction(db, req.body.requestId, party, 'anonymise', actor(req)) };
    });
    // the before-snapshot names the fields cleared, never their values
    await audit(req, { entity: party.type, entityId: party.id, action: 'anonymise', before: { cleared: result.cleared },
      after: { reason: req.body.reason, requestNumber, label: result.label } });
    ok(res, { ...result, requestNumber }, `${party.code} anonymised`);
  },
});

export default router;
export const mount = '/privacy';
