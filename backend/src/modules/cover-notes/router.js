/**
 * Cover notes (Operations > Cover Notes): issue from an accepted quotation or a placement slip, print, e-mail to the
 * client, cancel; the policy is linked and the cover note superseded when the policy is issued. read:policies to view,
 * write:policies to issue, send and cancel.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { sendPdf } from '../../lib/pdf/index.js';
import { queueEmail, fileAttachment } from '../../lib/mailer.js';
import { emailTemplate, renderTemplate } from '../documents/common.js';
import { companyName } from '../../lib/letterhead.js';
import { storeFile } from '../accounting/lib/files.js';
import * as svc from './service.js';
import { coverNotePdf } from './print.js';

const { router, define } = moduleRouter('Cover Notes', '/cover-notes');
const read = [requireAuth, requirePermission('read:policies')];
const write = [requireAuth, requirePermission('write:policies')];
const S = 'Operations > Cover Notes';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const example = { id: 'cvn_1', coverNoteNumber: 'CVN-2026-00001', source: 'quote', quoteNumber: 'QT-2026-00012', insuredName: 'Maria Santos', insurerName: 'Malayan Insurance Co., Inc.',
  coverFrom: '2026-10-04', coverTo: '2026-11-03', validityDays: 30, status: 'active', daysLeft: 30, policyNumber: null };

define({
  method: 'GET', path: '/', summary: 'Cover notes (status active | superseded | expired | cancelled | all, search, clientId, expiringWithin days); policies issued since are linked first',
  screen: S, middleware: read, query: { status: 'active', expiringWithin: 7 }, response: { success: true, data: { asOf: '2026-10-04', summary: { active: 1, expiringSoon: 0 }, rows: [example] } },
  handler: async (req, res) => ok(res, await svc.listCoverNotes(pool, req.query)),
});
define({
  method: 'GET', path: '/sources', summary: 'Accepted quotations and sent / bound placement slips a cover note can be issued from (search)', screen: `${S} > Issue`, middleware: read,
  query: { search: 'QT-2026' }, response: { success: true, data: [{ kind: 'quote', id: 'qt_1', reference: 'QT-2026-00012', status: 'accepted', clientName: 'Maria Santos', insurerName: 'Malayan', premiumTotal: 18250 }] },
  handler: async (req, res) => ok(res, await svc.eligibleSources(pool, req.query)),
});
define({
  method: 'GET', path: '/:id', summary: 'One cover note', screen: S, middleware: read, response: { success: true, data: example },
  handler: async (req, res) => ok(res, await svc.getCoverNote(pool, req.params.id)),
});
define({
  method: 'GET', path: '/:id/pdf', summary: 'Printable cover note (PDF with the company letterhead and cover_note.wording)', screen: `${S} > Print`, middleware: read, response: 'application/pdf',
  handler: async (req, res) => {
    const cn = await svc.getCoverNote(pool, req.params.id);
    sendPdf(res, await coverNotePdf(cn), `${cn.coverNoteNumber}.pdf`);
  },
});
const issueBody = z.object({ quoteId: z.string().optional(), placementId: z.string().optional(), coverFrom: date.optional(), validityDays: z.number().int().min(1).max(366).optional(),
  conditions: z.string().max(4000).optional().nullable(), insurerReference: z.string().max(100).optional().nullable(), riskDescription: z.string().max(1000).optional().nullable() });
define({
  method: 'POST', path: '/', summary: 'Issue a cover note from an accepted quotation (quoteId) or a sent / bound placement slip (placementId) for cover_note.validity_days', screen: `${S} > Issue`,
  middleware: [...write, validate(issueBody)], request: { quoteId: 'qt_1', coverFrom: '2026-10-04', validityDays: 30, insurerReference: 'MIC-BND-2231' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const cn = await withTransaction((db) => svc.issueCoverNote(db, req.body, req.user));
    await audit(req, { entity: 'cover_note', entityId: cn.id, action: 'create', after: cn });
    created(res, cn, `Cover note ${cn.coverNoteNumber} issued until ${cn.coverTo}`);
  },
});
define({
  method: 'POST', path: '/:id/cancel', summary: 'Cancel an active cover note (reason required)', screen: S, middleware: [...write, validate(z.object({ reason: z.string().min(1).max(1000) }))],
  request: { reason: 'Client declined the cover' }, response: { success: true, data: { ...example, status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.cancelCoverNote(db, req.params.id, req.body.reason, req.user));
    await audit(req, { entity: 'cover_note', entityId: r.after.id, action: 'cancel', before: { status: r.before.status }, after: { status: r.after.status, reason: req.body.reason } });
    ok(res, r.after, `Cover note ${r.after.coverNoteNumber} cancelled`);
  },
});
define({
  method: 'POST', path: '/:id/send', summary: 'E-mail the cover note PDF to the client (e-mail template cover_note; to defaults to the client e-mail)', screen: `${S} > Send`,
  middleware: [...write, validate(z.object({ to: z.string().email().optional() }))], request: { to: 'client@example.ph' }, response: { success: true, data: { emailId: 12, to: 'client@example.ph' } },
  handler: async (req, res) => {
    const cn = await svc.getCoverNote(pool, req.params.id);
    const client = cn.clientId ? (await pool.query('SELECT email FROM clients WHERE id = $1', [cn.clientId])).rows[0] : null;
    const to = req.body?.to || client?.email;
    if (!to) throw badRequest('Validation failed', [{ path: 'to', message: 'The client has no e-mail address; enter one' }]);
    const pdf = await coverNotePdf(cn);
    const r = await withTransaction(async (db) => {
      const file = await storeFile(db, { category: 'generated', fileName: `${cn.coverNoteNumber}.pdf`, contentType: 'application/pdf', buffer: pdf, entity: 'cover_note', entityId: cn.id, userId: req.user.id });
      const t = await emailTemplate('cover_note');
      const v = { clientName: cn.insuredName || cn.clientName || '', coverNoteNumber: cn.coverNoteNumber, coverFrom: cn.coverFrom, coverTo: cn.coverTo, companyName: await companyName() };
      const emailId = await queueEmail({ db, to, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'cover_note', entity: 'cover_note', entityId: cn.id,
        attachments: [fileAttachment(file.key, file.fileName)] });
      return { emailId, to };
    });
    await audit(req, { entity: 'cover_note', entityId: cn.id, action: 'send', after: r });
    ok(res, r, `Cover note queued to ${to}`);
  },
});

export default router;
export const mount = '/cover-notes';
