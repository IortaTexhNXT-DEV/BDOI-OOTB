/**
 * E-signatures: capture (drawn or uploaded) for authorised signatories (Master > Signatories, write:masters) and for a
 * user's own signature (My Profile), versions, revocation, the protected image, and the document signature mapping
 * (Master > System Configuration > Document Signatures).
 */
import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { badRequest, forbidden } from '../../lib/errors.js';
import { hasPermission } from '../../lib/auth.js';
import { ok, created } from '../../lib/respond.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { canRead, canWrite } from '../masters/helpers.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('E-signatures', '/e-signatures');
const upload = memoryUpload({ files: 1 });
const singleFile = (req, res, next) => upload.single('file')(req, res, (e) => next(e ? badRequest(e.message) : undefined));
const SCREEN = 'Master > Signatories > E-signature; My Profile > E-signature';
const actor = (req) => ({ user: req.user, ip: req.ip });
const sigExample = { id: 3, ownerType: 'signatory', ownerId: '1', version: 2, method: 'drawn', effectiveFrom: '2026-10-01', effectiveTo: null, status: 'active',
  consentText: 'I confirm that Maria Regina Cruz has authorised ...', capturedBy: 'BrokerVerse', capturedAt: '2026-10-01T02:00:00Z', imageUrl: '/api/e-signatures/3/image' };

define({
  method: 'GET', path: '/consent', summary: 'Consent statement shown before a signature is captured (ownerType signatory | user, ownerId)', screen: SCREEN,
  query: { ownerType: 'signatory', ownerId: '1' }, response: { success: true, data: { text: 'I confirm that ...' } },
  handler: async (req, res) => ok(res, { text: await svc.consentText(String(req.query.ownerType || 'user'), req.query.ownerId || req.user.id) }),
});
define({
  method: 'GET', path: '/', summary: "Signature versions of a signatory (read:masters / write:masters) or of the signed-in user (ownerType=user, own only unless administrator)", screen: SCREEN,
  query: { ownerType: 'signatory', ownerId: '1' }, response: { success: true, data: [sigExample] },
  handler: async (req, res) => {
    const ownerType = String(req.query.ownerType || 'user');
    const ownerId = String(req.query.ownerId || (ownerType === 'user' ? req.user.id : ''));
    if (ownerType === 'signatory') {
      if (!hasPermission(req.user, 'read:masters') && !hasPermission(req.user, 'write:masters')) throw forbidden('Viewing signatory signatures needs read:masters');
    } else svc.assertCanManage(req.user, 'user', ownerId, 'view');
    ok(res, await svc.listSignatures(ownerType, ownerId));
  },
});
define({
  method: 'POST', path: '/', summary: 'Capture a signature (new version): JSON { ownerType, ownerId, method: drawn, imageData: PNG data URL, effectiveFrom, consent: true } or multipart file + the same fields. A user signature only by that user',
  screen: SCREEN, middleware: [singleFile],
  request: { ownerType: 'signatory', ownerId: '1', method: 'drawn', imageData: 'data:image/png;base64,iVBORw0...', effectiveFrom: '2026-10-01', consent: true },
  response: { success: true, data: sigExample },
  handler: async (req, res) => {
    const b = req.body || {};
    const sig = await svc.captureSignature({ ownerType: b.ownerType, ownerId: b.ownerType === 'user' && !b.ownerId ? req.user.id : b.ownerId, method: b.method,
      imageData: b.imageData, file: req.file, effectiveFrom: b.effectiveFrom, consent: b.consent }, actor(req));
    created(res, sig, 'Signature saved');
  },
});
define({
  method: 'POST', path: '/:id/revoke', summary: 'Revoke a signature version (reason required): it no longer prints on any document', screen: SCREEN,
  request: { reason: 'Signatory left the company' }, response: { success: true, data: { ...sigExample, status: 'revoked' } },
  handler: async (req, res) => ok(res, await svc.revokeSignature(req.params.id, req.body?.reason, actor(req)), 'Signature revoked'),
});
define({
  method: 'GET', path: '/:id/image', summary: 'The signature image (bearer only, no signed links; signatories: write:masters, users: own or administrator); not cached', screen: SCREEN,
  response: '(image/png | image/jpeg)',
  handler: async (req, res) => {
    const f = await svc.signatureFile(req.params.id, req.user);
    res.setHeader('Content-Type', f.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(f.buffer);
  },
});
define({
  method: 'GET', path: '/slots', summary: 'Document signature mapping: document types, slot sources and conditions, and the slots', screen: 'Master > System Configuration > Document Signatures',
  middleware: canRead('settings'),
  response: { success: true, data: { documentTypes: [{ key: 'policy-schedule', label: 'Policy schedule' }], sources: [{ key: 'default-signatory', label: 'The default signatory' }], conditions: [{ key: 'issued', label: 'Once the document is issued' }],
    slots: [{ id: 1, documentType: 'policy-schedule', slot: 'authorized', label: 'For {{companyName}}', source: 'default-signatory', condition: 'issued', active: true }] } },
  handler: async (_req, res) => ok(res, {
    documentTypes: Object.entries(svc.DOCUMENT_TYPES).map(([key, t]) => ({ key, label: t.label })),
    sources: Object.entries(svc.SOURCES).map(([key, label]) => ({ key, label })),
    conditions: Object.entries(svc.CONDITIONS).map(([key, label]) => ({ key, label })),
    slots: await svc.listSlots(), placeholder: '{{signature:<slot>}}',
  }),
});
define({
  method: 'PUT', path: '/slots', summary: 'Save the signature mapping of the document types sent ({ slots: [{ documentType, slot, label, source, signatoryId?, condition, active }] })',
  screen: 'Master > System Configuration > Document Signatures', middleware: canWrite('settings'),
  request: { slots: [{ documentType: 'payment-voucher', slot: 'approved-by', label: 'Approved by', source: 'approving-user', condition: 'approved', active: true }] },
  response: { success: true, data: [] },
  handler: async (req, res) => {
    const before = await svc.listSlots();
    const after = await svc.saveSlots(req.body?.slots, req.user.id);
    await audit(req, { entity: 'document-signature-slots', action: 'update', before, after });
    ok(res, after, 'Signature mapping saved');
  },
});

export default router;
export const mount = '/e-signatures';
