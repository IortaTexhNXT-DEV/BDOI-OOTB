import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok } from '../../lib/respond.js';
import { pageParams, sendList } from '../accounting/lib/http.js';
import * as svc from './service.js';
import { syncAutoTasksQuietly } from '../my-work/tasks.js';

const { router, define } = moduleRouter('Collections', '/collections');
const read = [requireAuth, requirePermission('read:collections', 'read:receipts')];
const write = [requireAuth, requirePermission('write:collections')];
const SCREEN = 'Accounts > Collections';
const item = { id: 'col_1', policyNumber: 'POL-2026-00001', client: { firstName: 'Maria', lastName: 'Santos' }, grossPremium: 11862.5, paidAmount: 0, outstandingAmount: 11862.5, currentAmount: 0, days1to30Amount: 11862.5, days31to60Amount: 0, days61to90Amount: 0, over90DaysAmount: 0, dueDate: '2026-09-10', daysPastDue: 18, overdueLevel: 1, collectionStatus: 'Overdue' };

define({
  method: 'GET', path: '/', summary: 'Collections register with ageing buckets (filter status, overdueLevel, clientId, search; sortField, sortOrder; paging)', screen: SCREEN, middleware: read,
  query: { page: 1, pageSize: 10, status: 'Overdue', overdueLevel: '1', search: 'Santos', sortField: 'dueDate', sortOrder: 'asc' },
  response: { success: true, data: [item], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
  handler: async (req, res) => { const pg = pageParams(req.query); const r = await svc.listCollections(pool, req.query, pg); sendList(res, r.rows, r.total, pg); },
});
define({
  method: 'GET', path: '/aging-report', summary: 'Ageing report: bucket totals, percentages and open items', screen: `${SCREEN} > Aging report`, middleware: read, query: { clientId: 'cl_1' },
  response: { success: true, data: { summary: { totalOutstanding: 11862.5, totalCurrent: 0, total1to30: 11862.5, total31to60: 0, total61to90: 0, totalOver90: 0, percentages: { current: 0, days1to30: 100, days31to60: 0, days61to90: 0, over90: 0 } }, collections: [item] } },
  handler: async (req, res) => ok(res, await svc.agingReport(pool, req.query)),
});
define({
  method: 'GET', path: '/dashboard-stats', summary: 'Collections KPIs (outstanding, overdue, committed, escalated, collected this month)', screen: SCREEN, middleware: read,
  response: { success: true, data: { totalOutstanding: 11862.5, overdueCount: 1, overdueAmount: 11862.5, committedCount: 0, escalatedCount: 0, collectedThisMonth: 0 } },
  handler: async (_req, res) => ok(res, await svc.dashboardStats(pool)),
});
define({
  method: 'GET', path: '/send-due-date-reminders/preview', summary: 'What the due-date reminders would send now: items, clients (and those without an e-mail), amount outstanding and items by overdue level',
  screen: `${SCREEN} > Send payment reminders`, middleware: read,
  response: { success: true, data: { items: 3, clients: 2, withoutEmail: 0, totalOutstanding: 24813.75, byLevel: [{ level: 'Overdue', count: 2, amount: 18000 }] } },
  handler: async (_req, res) => ok(res, await svc.dueDateReminderPreview(pool)),
});
define({
  method: 'POST', path: '/send-due-date-reminders', summary: 'Queue reminder e-mails and notify owners for items due soon or overdue (not reminded recently)', screen: SCREEN, middleware: write,
  request: {}, response: { success: true, message: '3 reminder(s) queued', data: { candidates: 3, emails: 3, notifications: 3, skipped: [] } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.sendDueDateReminders(db, req.user));
    await audit(req, { entity: 'collection', entityId: null, action: 'send-due-date-reminders', after: r });
    ok(res, r, `${r.emails} reminder e-mail(s) queued, ${r.notifications} notification(s) sent`);
  },
});
define({
  method: 'POST', path: '/sync', summary: 'Create collection items for receivables (all, or the policies on one receipt)', screen: 'Agent > Payment confirmation; Accounts > Collections',
  middleware: [requireAuth, requirePermission('write:collections', 'write:receipts', 'write:policies'), validate(z.object({ receiptId: z.string().optional() }).passthrough())],
  request: { receiptId: 'or_1' }, response: { success: true, data: { created: 1, closed: 0, collectionId: 'col_1' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.sync(db, req.body || {}, req.user));
    await audit(req, { entity: 'collection', entityId: req.body?.receiptId || null, action: 'sync', after: r });
    ok(res, r, 'Collections synchronised');
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Collection detail with follow-up actions and payment history', screen: `${SCREEN} > Detail`, middleware: read,
  response: { success: true, data: { ...item, followUpActions: [{ actionType: 'Call', actionDate: '2026-09-20T03:00:00Z', actionBy: 'finance1', callOutcome: 'Answered', notes: 'Will pay Friday' }], paymentHistory: [] } },
  handler: async (req, res) => ok(res, await svc.getCollection(pool, req.params.id)),
});
define({
  method: 'PATCH', path: '/:id/commitment', summary: 'Record the date the client committed to pay', screen: `${SCREEN} > Detail > Follow-up (Commitment)`,
  middleware: [...write, validate(z.object({ commitmentDate: z.coerce.date().transform((d) => d.toISOString().slice(0, 10)), reason: z.string().optional().nullable() }))],
  request: { commitmentDate: '2026-10-05', reason: 'Salary on the 5th' }, response: { success: true, data: { ...item, collectionStatus: 'Committed', commitmentDate: '2026-10-05' } },
  handler: async (req, res) => {
    const id = await withTransaction((db) => svc.setCommitment(db, req.params.id, req.body.commitmentDate, req.body.reason, req.user));
    await audit(req, { entity: 'collection', entityId: id, action: 'commitment', after: req.body });
    // the promised date becomes a follow-up task of the collector (Operations > My Work)
    await syncAutoTasksQuietly(req.log);
    ok(res, await svc.getCollection(pool, id), 'Commitment date saved');
  },
});
define({
  method: 'POST', path: '/:id/follow-up', summary: 'Log a follow-up (Call, Email, SMS, Visit, Note, Escalation)', screen: `${SCREEN} > Detail > Follow-up`,
  middleware: [...write, validate(z.object({ actionType: z.enum(['Call', 'Email', 'SMS', 'Visit', 'Note', 'Escalation', 'Commitment']), notes: z.string().optional().nullable(), callOutcome: z.string().optional().nullable(), commitmentDate: z.string().optional().nullable() }))],
  request: { actionType: 'Call', notes: 'Client promised to pay on Friday', callOutcome: 'Answered' }, response: { success: true, data: item },
  handler: async (req, res) => {
    const id = await withTransaction((db) => svc.addAction(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'collection', entityId: id, action: 'follow-up', after: req.body });
    if (req.body.commitmentDate) await syncAutoTasksQuietly(req.log);
    ok(res, await svc.getCollection(pool, id), 'Follow-up saved');
  },
});
define({
  method: 'POST', path: '/:id/send-email', summary: 'E-mail the client about the outstanding premium (queued; logged as an Email action)', screen: `${SCREEN} > Detail > Send e-mail`,
  middleware: [...write, validate(z.object({ notes: z.string().optional(), actionBy: z.string().optional().nullable(), to: z.string().email().optional(), subject: z.string().optional() }))],
  request: { notes: 'Dear Maria, your premium of ₱11,862.50 is due…', actionBy: 'finance1' }, response: { success: true, data: { emailId: 12, to: 'maria.santos@example.ph' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.sendEmail(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'collection', entityId: req.params.id, action: 'send-email', after: r });
    ok(res, r, 'E-mail queued');
  },
});
export default router;
export const mount = '/collections';
