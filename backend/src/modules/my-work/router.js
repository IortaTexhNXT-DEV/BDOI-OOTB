/**
 * Operations > My Work (/my-work): the open items waiting on the signed-in user, their team and everyone (summary,
 * paged list, per-member breakdown, agenda), reassignment where the owning module supports it (claims handler, data
 * subject request assignee, tasks), the work diary (tasks) and the Home figures (figures.js: role preset, role, branch and
 * the role's figures). Every signed-in user has a My Work; each category is shown only with the permission to read its
 * records (sources.js), so no permission of its own is needed.
 */
import { moduleRouter } from '../../lib/registry.js';
import { hasPermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { assertVisible, scopeOf } from '../../lib/scope.js';
import { notify } from '../notifications/service.js';
import * as svc from './service.js';
import * as tasks from './tasks.js';
import { figures } from './figures.js';
import { assignableUsers, manages } from './team.js';

const { router, define } = moduleRouter('My Work', '/my-work');
const S = 'Operations > My Work';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 hours)');
const listQuery = (req) => ({ ...req.query, recordScope: undefined });
const withRecordScope = async (req, q) => ({ ...q, recordScope: await scopeOf(req) });

const itemExample = {
  category: 'quotes', kind: 'Awaiting customer response', id: 'qt_1', ref: 'QT-2026-00012', title: 'Private Car', clientName: 'Maria Santos', dueDate: '2026-10-08',
  overdue: false, dueToday: false, priority: 'normal', status: 'sent', nextAction: "Follow up the customer's response", ownerId: 'usr_1', ownerName: 'Maria Rivera',
  queue: false, link: '/agent/quotedetailview/qt_1', amount: 18250.5, createdAt: '2026-09-28T02:00:00Z', reassign: null,
};
const taskExample = {
  id: 'tsk_1', title: 'Call Mr. Santos about the fire renewal', notes: 'Bring the revised schedule', dueDate: '2026-10-06', dueTime: '10:30', priority: 'high', status: 'open',
  overdue: false, dueToday: false, assignedTo: 'usr_1', assignedToName: 'Maria Rivera', createdBy: 'usr_9', createdByName: 'Ana Reyes', source: 'manager',
  sourceLabel: 'Assigned by manager', automatic: false, entity: 'policy', entityId: 'pol_1', entityRef: 'POL-2026-00031', entityLabel: 'Maria Santos', link: '/agent/policydetail/pol_1',
  remindAt: '2026-10-06T01:30:00Z', reminderMinutes: 60, canEdit: true, canReassign: true, canDelete: true,
};

define({
  method: 'GET', path: '/summary', summary: 'Header figures (open, overdue, due today, due soon) and the count of each category for scope me | team | all', screen: S,
  query: { scope: 'me' },
  response: { success: true, data: { asOf: '2026-10-04', scope: 'me', dueSoonDays: 7, totals: { open: 14, overdue: 3, dueToday: 2, dueSoon: 5, high: 4 },
    categories: [{ code: 'quotes', label: 'Quotations', icon: 'pi pi-file-edit', count: 4, overdue: 1, dueToday: 0, dueSoon: 2, high: 1, nextDue: '2026-10-06' }],
    team: { size: 2, isManager: true } } },
  handler: async (req, res) => ok(res, await svc.summary(req.user, await withRecordScope(req, listQuery(req)))),
});

define({
  method: 'GET', path: '/figures', summary: 'Home: the role preset of the signed-in user, their role, branch and company for the page subtitle, and the two or three figures of the role (sales: quotes this month, conversion, renewals due; claims: open claims, average days open; accounting: overdue receivables, collections this month; compliance: deadlines, EDD reviews; administrator: active users, failed jobs)',
  screen: `${S} (Home)`,
  response: { success: true, data: { asOf: '2026-10-04', preset: 'sales', roleCode: 'sales', roleName: 'Sales & Marketing (Account Executive)', firstName: 'Maria', branch: 'Makati', company: 'BrokerVerse',
    figures: [{ key: 'quotesMonth', label: 'Quotes this month', value: 12, format: 'count' }, { key: 'conversion', label: 'Conversion (90 days)', value: 38, format: 'percent' }, { key: 'renewals30', label: 'Renewals due in 30 days', value: 7, format: 'count' }] } },
  handler: async (req, res) => ok(res, await figures(req.user, { recordScope: await scopeOf(req) })),
});

define({
  method: 'GET', path: '/items', summary: 'Open items, paged and sorted on the server (scope me | team | all; category, due overdue | today | soon | later | none, priority, kind, search, assignee; sort due | priority | client | category | amount, order asc | desc)',
  screen: `${S} > My Items / My Team`, query: { scope: 'me', category: 'approvals', due: 'overdue', sort: 'due', page: 1, pageSize: 20 },
  response: { success: true, data: [itemExample], total: 1, page: 1, perPage: 20, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const r = await svc.listItems(req.user, await withRecordScope(req, listQuery(req)), pg);
    ok(res, r.rows, 'OK', pageMeta(r.total, pg));
  },
});

define({
  method: 'GET', path: '/team', summary: 'Open items of each user reporting to the signed-in manager (users.reporting_to, any depth): totals, overdue, due today and per category',
  screen: `${S} > My Team`, query: { category: 'claims' },
  response: { success: true, data: { asOf: '2026-10-04', categories: [{ code: 'claims', label: 'Claims' }],
    members: [{ userId: 'usr_2', name: 'Carlo Estrada', designation: 'Claims Officer', total: 6, overdue: 2, dueToday: 1, high: 2, byCategory: { claims: { count: 4, overdue: 2 } }, managerName: 'Joy Macaraeg' }] } },
  handler: async (req, res) => ok(res, await svc.teamBreakdown(req.user, await withRecordScope(req, listQuery(req)))),
});

define({
  method: 'GET', path: '/agenda', summary: 'Open items due between from and to (at most 6 weeks) for the calendar; tasks come from GET /my-work/tasks with from / to', screen: `${S} > Calendar`,
  query: { from: '2026-10-04', to: '2026-10-10', scope: 'me' }, response: { success: true, data: { from: '2026-10-04', to: '2026-10-10', items: [itemExample] } },
  handler: async (req, res) => ok(res, await svc.agenda(req.user, await withRecordScope(req, listQuery(req)))),
});

define({
  method: 'GET', path: '/assignees', summary: 'People the signed-in user may assign work to: themselves and their team (administrators: every active user)', screen: `${S} > Task / Reassign`,
  response: { success: true, data: [{ id: 'usr_1', username: 'maria.rivera', displayName: 'Maria Rivera', designation: 'Account Executive', self: true }] },
  handler: async (req, res) => ok(res, await assignableUsers(req.user)),
});

define({
  method: 'POST', path: '/items/reassign', summary: 'Reassign an open item to yourself or someone in your team where its module supports it: claim handler (write:claims), data subject request (write:privacy), task',
  screen: `${S} > My Team`,
  middleware: [validate(z.object({ category: z.enum(['claims', 'approvals', 'tasks']), id: z.string().min(1).max(80), assignTo: z.string().min(1).max(60), note: z.string().max(500).optional() }))],
  request: { category: 'claims', id: 'clm_1', assignTo: 'usr_3' }, response: { success: true, message: 'Reassigned', data: { category: 'claims', id: 'clm_1', ownerId: 'usr_3', ownerName: 'Joy Macaraeg' } },
  handler: async (req, res) => {
    const { category, id, assignTo } = req.body;
    const team = await assignableUsers(req.user);
    const target = team.find((u) => u.id === assignTo);
    if (!target) throw forbidden('Work can be reassigned only to yourself or to people who report to you');
    if (category === 'tasks') {
      const r = await tasks.updateTask(id, { assignedTo: assignTo }, req.user, { recordScope: await scopeOf(req) });
      await audit(req, { entity: 'task', entityId: id, action: 'reassign', before: { assignedTo: r.before.assignedTo }, after: { assignedTo: assignTo } });
      return ok(res, { category, id, ownerId: assignTo, ownerName: target.displayName }, 'Reassigned');
    }
    if (category === 'claims') {
      if (!hasPermission(req.user, 'write:claims')) throw forbidden('Requires permission: write:claims');
      await assertVisible(req, 'claim', id);
      const claim = (await pool.query('SELECT id, claim_number, handler_user_id, status FROM claims WHERE id = $1 OR claim_number = $1', [id])).rows[0];
      if (!claim) throw notFound('Claim not found');
      if (claim.handler_user_id && !(await manages(req.user, claim.handler_user_id))) throw forbidden('The claim is handled by someone who does not report to you');
      const claims = await import('../claims/service.js');
      const r = await claims.updateClaim(claim.id, { handlerUserId: assignTo }, req.user, []);
      await audit(req, { entity: 'claim', entityId: claim.id, action: 'reassign', before: { handlerUserId: claim.handler_user_id }, after: { handlerUserId: assignTo } });
      if (assignTo !== req.user.id) {
        await notify({ userId: assignTo, type: 'info', title: `Claim ${claim.claim_number} assigned to you`, message: `${req.user.username} made you the handler of claim ${claim.claim_number}`,
          link: `/agent/claimdetail/${claim.id}`, entity: 'claim', entityId: claim.id });
      }
      return ok(res, { category, id: r.after?.id || claim.id, ownerId: assignTo, ownerName: target.displayName }, 'Reassigned');
    }
    // approvals: only the data subject requests have an assignee (the other approvals are queues of a permission)
    if (!hasPermission(req.user, 'write:privacy')) throw forbidden('Requires permission: write:privacy');
    const privacy = await import('../privacy/service.js');
    const dsr = (await pool.query('SELECT id, request_number, assigned_to FROM data_subject_requests WHERE id = $1 OR request_number = $1', [id])).rows[0];
    if (!dsr) throw badRequest('Only data subject requests can be reassigned among the approvals; open the record for the others');
    if (dsr.assigned_to && !(await manages(req.user, dsr.assigned_to))) throw forbidden('The request is assigned to someone who does not report to you');
    const { before, after } = await withTransaction((db) => privacy.updateRequest(db, dsr.id, { assignedTo: assignTo }, req.user.id));
    await audit(req, { entity: 'data_subject_request', entityId: dsr.id, action: 'reassign', before: { assignedTo: before.assigned_to }, after: { assignedTo: after.assigned_to } });
    if (assignTo !== req.user.id) {
      await notify({ userId: assignTo, type: 'info', title: `Data subject request ${dsr.request_number} assigned to you`, message: `Assigned by ${req.user.username}`,
        link: '/master/data-privacy/requests', entity: 'data_subject_request', entityId: dsr.id });
    }
    return ok(res, { category, id: dsr.id, ownerId: assignTo, ownerName: target.displayName }, 'Reassigned');
  },
});

// ---------------------------------------------------------------------------------------------------- tasks

const relatedType = z.enum(Object.keys(tasks.RELATED));
const taskFields = {
  title: z.string().trim().min(2).max(200), notes: z.string().trim().max(4000).nullable().optional(), dueDate: date, dueTime: time.nullable().optional(),
  priority: z.enum(tasks.PRIORITIES).optional(), assignedTo: z.string().min(1).max(60).optional(), entity: relatedType.nullable().optional(),
  entityId: z.string().max(80).nullable().optional(), reminderMinutes: z.number().int().min(0).max(43200).nullable().optional(),
};

define({
  method: 'GET', path: '/tasks', summary: 'Tasks, paged (scope mine | created | team | all; status open | done | cancelled | all, due overdue | today | soon | later, priority, source, search, assignee, from / to, entity + entityId; sort due | priority | created)',
  screen: `${S} > My Tasks / Calendar`, query: { scope: 'mine', status: 'open', page: 1, pageSize: 20 },
  response: { success: true, data: [taskExample], total: 1, page: 1, perPage: 20, totalPages: 1, counts: { open: 4, overdue: 1, today: 2 } },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const r = await tasks.listTasks(req.user, req.query, pg);
    ok(res, r.rows, 'OK', { ...pageMeta(r.total, pg), counts: r.counts });
  },
});
define({
  method: 'GET', path: '/tasks/:id', summary: 'One task (assignee, creator, a manager of the assignee or an administrator)', screen: `${S} > My Tasks`,
  response: { success: true, data: taskExample }, handler: async (req, res) => ok(res, await tasks.getTask(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/tasks', summary: 'Create a task for yourself or, as a manager, for someone reporting to you; reminderMinutes before the due time (null: none; default myWork.default_reminder_minutes)',
  screen: `${S} > My Tasks > New task`, middleware: [validate(z.object(taskFields))],
  request: { title: 'Call Mr. Santos about the fire renewal', dueDate: '2026-10-06', dueTime: '10:30', priority: 'high', entity: 'policy', entityId: 'pol_1', reminderMinutes: 60 },
  response: { success: true, message: 'Task created', data: taskExample },
  handler: async (req, res) => {
    const t = await tasks.createTask(req.body, req.user, { recordScope: await scopeOf(req) });
    await audit(req, { entity: 'task', entityId: t.id, action: 'create', after: t });
    created(res, t, 'Task created');
  },
});
define({
  method: 'PUT', path: '/tasks/:id', summary: 'Change a task: title, notes, due date / time, priority, reminder, related record; reassign (creator or manager)', screen: `${S} > My Tasks > Edit`,
  middleware: [validate(z.object(taskFields).partial().refine((b) => Object.keys(b).length > 0, 'Nothing to change'))],
  request: { dueDate: '2026-10-07', dueTime: '14:00', reminderMinutes: 30 }, response: { success: true, message: 'Task updated', data: taskExample },
  handler: async (req, res) => {
    const r = await tasks.updateTask(req.params.id, req.body, req.user, { recordScope: await scopeOf(req) });
    await audit(req, { entity: 'task', entityId: req.params.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Task updated');
  },
});
for (const [action, word] of [['complete', 'completed'], ['reopen', 'reopened']]) {
  define({
    method: 'POST', path: `/tasks/:id/${action}`, summary: action === 'complete' ? 'Mark a task done (optional note)' : 'Reopen a done or cancelled task', screen: `${S} > My Tasks`,
    middleware: [validate(z.object({ note: z.string().trim().max(1000).optional().nullable() }))], request: action === 'complete' ? { note: 'Client confirmed by phone' } : {},
    response: { success: true, message: `Task ${word}`, data: { ...taskExample, status: action === 'complete' ? 'done' : 'open' } },
    handler: async (req, res) => {
      const r = await tasks.setStatus(req.params.id, action, req.user, { note: req.body?.note || null });
      await audit(req, { entity: 'task', entityId: req.params.id, action, before: { status: r.before.status }, after: { status: r.after.status } });
      ok(res, r.after, `Task ${word}`);
    },
  });
}
define({
  method: 'DELETE', path: '/tasks/:id', summary: 'Cancel an open task (its creator or a manager; follow-up tasks are completed instead)', screen: `${S} > My Tasks`,
  response: { success: true, message: 'Task cancelled', data: { ...taskExample, status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await tasks.setStatus(req.params.id, 'cancel', req.user);
    await audit(req, { entity: 'task', entityId: req.params.id, action: 'cancel', before: { status: r.before.status }, after: { status: r.after.status } });
    ok(res, r.after, 'Task cancelled');
  },
});
define({
  method: 'GET', path: '/records', summary: 'Records a task can be related to, by number or name (type client | lead | policy | quote | claim | renewal | endorsement | placement | broker_slip | collection)',
  screen: `${S} > My Tasks > New task`, query: { type: 'policy', search: 'POL-2026' },
  response: { success: true, data: [{ entity: 'policy', id: 'pol_1', ref: 'POL-2026-00031', label: 'Maria Santos', link: '/agent/policydetail/pol_1' }] },
  handler: async (req, res) => ok(res, await tasks.findRecords(req.user, req.query, { recordScope: await scopeOf(req) })),
});

export default router;
export const mount = '/my-work';
