/**
 * Claim document checklist (the Documents step of a claim) and the work queue Operations > Claims Awaiting Documents:
 * the documents of a claim from the checklist master,
 * received / waived status, upload, missing-document reminders to the claimant and the submission of the claim file to
 * the insurer (refused while a required document is missing, claims.require_documents_before_submission).
 * read:claims to view, write:claims to change.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { ownRecord, scopeOf } from '../../lib/scope.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { checkUploadedFiles } from '../uploads/fileTypes.js';
import { storeUpload } from '../claims/util.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Claim Documents', '/claim-documents');
const read = [requireAuth, requirePermission('read:claims')];
const write = [requireAuth, requirePermission('write:claims')];
const S = 'Operations > Claims > claim > Documents';
const multerSingle = memoryUpload({ files: 1 }).single('file');
const singleFile = (req, res, next) => multerSingle(req, res, (e) => next(e ? badRequest(e.message) : undefined));
const example = { claimNumber: 'CLM-2026-00001', policyNumber: 'POL-2026-00001', claimType: 'Own Damage', summary: { total: 8, required: 7, received: 5, missingRequired: 2, complete: false },
  items: [{ id: 1, documentName: 'Police report or affidavit of the driver', required: true, status: 'pending' }], reminders: [] };

define({
  method: 'GET', path: '/awaiting', summary: 'Work queue: open claims whose claim file has not gone to the insurer, with the required documents received and missing and the last reminder (stage missing | ready | all)',
  screen: 'Operations > Claims Awaiting Documents', middleware: [...read, validate(z.object({ stage: z.enum(['missing', 'ready', 'all']).optional(), search: z.string().max(100).optional() }), 'query')], query: { stage: 'missing' },
  response: { success: true, data: { summary: { missing: 3, ready: 1, documentsMissing: 11, notReminded: 1 },
    rows: [{ claimId: 'clm_1', claimNumber: 'CLM-2026-00001', policyNumber: 'POL-2026-00001', claimant: 'Maria Santos', lob: 'MOTOR', lossCause: 'Theft', status: 'registered',
      reportedDate: '2026-10-01', daysOpen: 8, required: 18, received: 15, missing: 3, lastReminderAt: null, complete: false }] } },
  handler: async (req, res) => ok(res, await withTransaction(async (db) => svc.awaiting(db, { stage: req.query.stage, search: req.query.search, scope: await scopeOf(req) }))),
});
define({
  method: 'GET', path: '/claims/:id', summary: 'Document checklist of a claim (from the checklist master by line of business and claim type), what is missing and the reminders sent',
  screen: S, middleware: [...read, ownRecord('claim')], response: { success: true, data: example },
  handler: async (req, res) => ok(res, await withTransaction((db) => svc.checklist(db, req.params.id))),
});
define({
  method: 'PATCH', path: '/claims/:id/items/:itemId', summary: 'Mark a document received (receivedOn), waived (waiveReason) or pending again, or change whether it is required',
  screen: S, middleware: [...write, ownRecord('claim'), validate(z.object({ status: z.enum(['pending', 'received', 'waived']).optional(), receivedOn: z.string().optional().nullable(),
    waiveReason: z.string().max(500).optional().nullable(), required: z.boolean().optional() }))],
  request: { status: 'received', receivedOn: '2026-10-04' }, response: { success: true, data: { id: 1, status: 'received', receivedOn: '2026-10-04' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.updateItem(db, req.params.id, req.params.itemId, req.body || {}, req.user));
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'document-checklist', before: r.before, after: r.after });
    ok(res, r.after, `${r.after.documentName}: ${r.after.status}`);
  },
});
define({
  method: 'POST', path: '/claims/:id/items', summary: 'Add a document the master does not list to the claim checklist', screen: S,
  middleware: [...write, ownRecord('claim'), validate(z.object({ documentName: z.string().min(1).max(200), required: z.boolean().optional() }))],
  request: { documentName: 'Medical certificate', required: true }, response: { success: true, data: { id: 9, documentName: 'Medical certificate', required: true, status: 'pending' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.addItem(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'document-checklist-add', after: r });
    created(res, r, `${r.documentName} added to the checklist`);
  },
});
define({
  method: 'POST', path: '/claims/:id/items/:itemId/upload', summary: 'Upload the copy of a checklist document (multipart file); the item is marked received', screen: S,
  middleware: [...write, ownRecord('claim'), singleFile, checkUploadedFiles], request: 'multipart/form-data file', response: { success: true, data: { id: 1, status: 'received', fileName: 'police-report.pdf' } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('file is required');
    const list = await svc.checklist(pool, req.params.id);
    const item = list.items.find((i) => i.id === Number(req.params.itemId));
    if (!item) throw badRequest('Checklist item not found');
    await storeUpload(req.file, { category: item.documentName, entity: 'claim', entityId: list.claimId, userId: req.user.id });
    const doc = (await pool.query('SELECT id FROM documents WHERE entity = \'claim\' AND entity_id = $1 AND category = $2 ORDER BY created_at DESC LIMIT 1', [list.claimId, item.documentName])).rows[0];
    const r = await withTransaction((db) => svc.updateItem(db, list.claimId, item.id, { status: 'received', documentId: doc?.id }, req.user));
    await audit(req, { entity: 'claim', entityId: list.claimId, action: 'document-upload', after: r.after });
    ok(res, r.after, `${item.documentName} uploaded`);
  },
});
define({
  method: 'POST', path: '/claims/:id/remind', summary: 'E-mail the claimant the documents still missing (template claim_missing_documents; to defaults to the client e-mail)', screen: `${S} > Remind`,
  middleware: [...write, ownRecord('claim'), validate(z.object({ to: z.string().email().optional() }))], request: {}, response: { success: true, data: { emailId: 31, to: 'claimant@example.ph', missing: ['Police report'] } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.remind(db, req.params.id, req.body || {}, req.user));
    await audit(req, { entity: 'claim', entityId: req.params.id, action: 'document-reminder', after: r });
    ok(res, r, `Reminder queued to ${r.to}`);
  },
});
define({
  method: 'POST', path: '/claims/:id/submit-to-insurer', summary: 'Submit the claim file to the insurer: e-mails the insurer (to, else its claims address) the policy reference, insured and documents submitted, and records the submission; refused while a required document is missing (claims.require_documents_before_submission)',
  screen: `${S} > Submit to insurer`, middleware: [...write, ownRecord('claim'), validate(z.object({ reference: z.string().max(100).optional(), note: z.string().max(1000).optional(), to: z.string().email().max(200).optional() }))],
  request: { reference: 'E-mail to Malayan claims 04-Oct' }, response: { success: true, data: { ...example, submittedToInsurerAt: '2026-10-04T03:00:00Z' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.submitToInsurer(db, req.params.id, req.body || {}, req.user));
    await audit(req, { entity: 'claim', entityId: r.claimId, action: 'submit-to-insurer', after: { submittedToInsurerAt: r.submittedToInsurerAt, missingRequired: r.summary.missingRequired, emailedTo: r.insurerEmail?.to || null } });
    ok(res, r, `Claim ${r.claimNumber} submitted to the insurer`);
  },
});

export default router;
export const mount = '/claim-documents';
