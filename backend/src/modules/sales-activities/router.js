/**
 * Sales activities (/sales-activities): the calls, meetings, e-mails and visits account executives log on prospects,
 * quotations and clients, the timeline of a record, the activity list and the activity report by account executive
 * and period (Sales > Sales Activities; the Activities panel of the prospect, client and quotation screens).
 * read:sales-activities to view, write:sales-activities to log, change and cancel. Activity types and outcomes are
 * the operational masters sales-activity-type and sales-activity-outcome (/ops-masters).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { scopeOf } from '../../lib/scope.js';
import { sendTable } from '../documents/tabular.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Sales Activities', '/sales-activities');
const read = [requireAuth, requirePermission('read:sales-activities', 'write:sales-activities')];
const write = [requireAuth, requirePermission('write:sales-activities')];
const S = 'Sales > Sales Activities';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const when = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Use an ISO date and time');
const activity = { id: 'sac_1', entity: 'lead', entityId: 'lead_1', recordNumber: 'LD-2026-00012', partyName: 'Rico Villanueva', activityType: 'CALL', activityTypeName: 'Phone call',
  channel: 'call', subject: 'Introductory call', activityAt: '2026-10-02T02:30:00Z', durationMinutes: 15, contactPerson: 'Rico Villanueva', outcome: 'INTERESTED',
  outcomeName: 'Interested, wants a quotation', nextStep: 'Send the motor quotation', nextStepDate: '2026-10-06', taskId: 'tsk_1', taskStatus: 'open', accountExecutive: 'usr_1',
  accountExecutiveName: 'Maria Rivera', status: 'logged' };
const body = {
  activityType: z.string().min(1).max(50), subject: z.string().max(200).optional(), notes: z.string().max(4000).optional().nullable(), activityAt: when,
  durationMinutes: z.number().int().min(0).max(1440).optional().nullable(), contactPerson: z.string().max(200).optional().nullable(), location: z.string().max(200).optional().nullable(),
  outcome: z.string().max(50).optional().nullable(), nextStep: z.string().max(200).optional().nullable(), nextStepDate: date.optional().nullable(),
  accountExecutive: z.string().max(60).optional().nullable(),
};

define({
  method: 'GET', path: '/options', summary: 'Activity types (channel, default days to the next step) and outcomes for the log form', screen: `${S}; Activities panel`, middleware: read,
  response: { success: true, data: { types: [{ code: 'CALL', name: 'Phone call', channel: 'call', followUpDays: 3 }], outcomes: [{ code: 'INTERESTED', name: 'Interested, wants a quotation', result: 'positive' }],
    channels: svc.CHANNELS, nextStepRequired: false } },
  handler: async (_req, res) => ok(res, await svc.options(pool)),
});
define({
  method: 'GET', path: '/timeline/:entity/:id', summary: 'Timeline of a prospect (lead), quotation (quote) or client: its activities newest first, with those of its quotations, and the open next step',
  screen: 'Prospect / Client / Quotation > Activities', middleware: read, query: { includeCancelled: 'false' },
  response: { success: true, data: { record: { entity: 'lead', id: 'lead_1', number: 'LD-2026-00012', name: 'Rico Villanueva' }, activities: [activity],
    nextStep: { activityId: 'sac_1', nextStep: 'Send the motor quotation', dueDate: '2026-10-06', taskId: 'tsk_1' } } },
  handler: async (req, res) => ok(res, await svc.timeline(pool, req.params.entity, req.params.id, { recordScope: await scopeOf(req), includeCancelled: req.query.includeCancelled === 'true' })),
});
define({
  method: 'GET', path: '/report', summary: 'Activity report of a period (from, to; accountExecutive, activityType, channel): per account executive the activities by channel, outcomes, next steps and follow-ups; format=xlsx or csv',
  screen: `${S} > Activity Report`, middleware: read, query: { from: '2026-10-01', to: '2026-10-31' },
  response: { success: true, data: { from: '2026-10-01', to: '2026-10-31', totals: { activities: 12, accountExecutives: 2, nextSteps: 8, followUpsDone: 5, followUpsOpen: 3, followUpsOverdue: 1, positive: 4 },
    rows: [{ accountExecutive: 'usr_1', accountExecutiveName: 'Maria Rivera', total: 7, call: 4, meeting: 1, email: 1, visit: 1, other: 0, prospects: 3, clients: 2, quotations: 1, nextSteps: 5,
      followUpsDone: 3, followUpsOpen: 2, followUpsOverdue: 1, positive: 2 }], byType: [{ activityType: 'CALL', activityTypeName: 'Phone call', total: 6 }], byOutcome: [] } },
  handler: async (req, res) => {
    const r = await svc.activityReport(pool, req.query, { recordScope: await scopeOf(req) });
    if (['xlsx', 'csv'].includes(req.query.format)) {
      await sendTable(res, { header: ['Account Executive', 'Activities', 'Calls', 'Meetings', 'E-mails', 'Visits', 'Other', 'Prospects', 'Clients', 'Quotations', 'Positive Outcomes', 'Next Steps',
        'Follow-ups Done', 'Follow-ups Open', 'Follow-ups Overdue'],
      rows: r.rows.map((x) => [x.accountExecutiveName, x.total, x.call, x.meeting, x.email, x.visit, x.other, x.prospects, x.clients, x.quotations, x.positive, x.nextSteps, x.followUpsDone,
        x.followUpsOpen, x.followUpsOverdue]), fileBase: `sales-activity-report-${r.from}-${r.to}`, format: req.query.format, sheetName: 'Activity report' });
      return;
    }
    ok(res, { ...r, activities: undefined });
  },
});
define({
  method: 'GET', path: '/', summary: 'Activities (from, to, accountExecutive, activityType, outcome, channel, entity, search, status logged | cancelled | all); format=xlsx or csv',
  screen: `${S} > Activities`, middleware: read, query: { from: '2026-10-01', to: '2026-10-31' }, response: { success: true, data: [activity] },
  handler: async (req, res) => {
    const rows = await svc.listActivities(pool, req.query, { recordScope: await scopeOf(req) });
    if (['xlsx', 'csv'].includes(req.query.format)) {
      await sendTable(res, { header: ['Date', 'Account Executive', 'Type', 'Subject', 'Record', 'Prospect / Client', 'Contact', 'Outcome', 'Next Step', 'Next Step Date', 'Follow-up'],
        rows: rows.map((a) => [String(a.activityAt instanceof Date ? a.activityAt.toISOString() : a.activityAt).slice(0, 16).replace('T', ' '), a.accountExecutiveName, a.activityTypeName, a.subject,
          a.recordNumber || '', a.partyName || '', a.contactPerson || '', a.outcomeName || '', a.nextStep || '', a.nextStepDate || '', a.taskStatus || '']),
        fileBase: 'sales-activities', format: req.query.format, sheetName: 'Activities' });
      return;
    }
    ok(res, rows);
  },
});
define({
  method: 'GET', path: '/:id', summary: 'One activity', screen: S, middleware: read, response: { success: true, data: activity },
  handler: async (req, res) => ok(res, await svc.getActivity(pool, req.params.id)),
});
define({
  method: 'POST', path: '/', summary: 'Log an activity on a prospect (lead), quotation (quote) or client; a next step with its date creates the follow-up task in My Work',
  screen: 'Prospect / Client / Quotation > Activities > Log Activity', middleware: [...write, validate(z.object({ entity: z.enum(['lead', 'quote', 'client']), entityId: z.string().min(1), ...body }))],
  request: { entity: 'lead', entityId: 'lead_1', activityType: 'CALL', subject: 'Introductory call', activityAt: '2026-10-02T10:30:00+08:00', durationMinutes: 15, outcome: 'INTERESTED',
    nextStep: 'Send the motor quotation', nextStepDate: '2026-10-06' }, response: { success: true, data: activity },
  handler: async (req, res) => {
    const r = await withTransaction(async (db) => svc.logActivity(db, req.body, req.user, { recordScope: await scopeOf(req) }));
    await audit(req, { entity: 'sales_activity', entityId: r.activity.id, action: 'create', after: r.activity });
    created(res, r.activity, r.activity.taskId ? `Activity logged; follow-up task due ${r.activity.nextStepDate} added to My Work` : 'Activity logged');
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change an activity (a changed next step moves its open follow-up task)', screen: 'Prospect / Client / Quotation > Activities',
  middleware: [...write, validate(z.object(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v.optional()]))))], request: { outcome: 'QUOTE_REQUESTED', nextStepDate: '2026-10-07' },
  response: { success: true, data: activity },
  handler: async (req, res) => {
    const r = await withTransaction(async (db) => svc.updateActivity(db, req.params.id, req.body, req.user, { recordScope: await scopeOf(req) }));
    await audit(req, { entity: 'sales_activity', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Activity updated');
  },
});
define({
  method: 'POST', path: '/:id/cancel', summary: 'Cancel an activity logged in error (its open follow-up task is cancelled)', screen: 'Prospect / Client / Quotation > Activities',
  middleware: [...write, validate(z.object({ reason: z.string().min(3).max(500) }))], request: { reason: 'Logged on the wrong prospect' },
  response: { success: true, data: { ...activity, status: 'cancelled' } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.cancelActivity(db, req.params.id, req.body.reason, req.user));
    await audit(req, { entity: 'sales_activity', entityId: r.id, action: 'cancel', after: r });
    ok(res, r, 'Activity cancelled');
  },
});

export default router;
export const mount = '/sales-activities';
