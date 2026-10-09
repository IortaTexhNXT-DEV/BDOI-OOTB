/**
 * Lead assignment API (/lead-assignment), mounted by the leads module: assignment rules (with their order and a run of
 * the queue through them), the reassignment queue (take, send to the queue), single and bulk reassignment with a reason
 * code, a prospect's assignment history and the team view by reporting line.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import * as asg from './assignment.js';

const { router, define } = moduleRouter('Lead assignment', '/lead-assignment');
const SCREEN = 'Operations > Sales & Marketing > Lead Assignment';
const canRead = [requireAuth, requirePermission('read:lead-assignment', 'write:lead-assignment')];
const canWrite = [requireAuth, requirePermission('write:lead-assignment')];
// the team view is open to every prospect user: a manager sees the people reporting to them
const canTeam = [requireAuth, requirePermission('read:leads', 'read:lead-assignment')];

const conditions = z.object({
  branchCode: z.string().max(40).optional().nullable(), lob: z.string().max(40).optional().nullable(), productId: z.union([z.number().int(), z.string().max(40)]).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  leadCategory: z.string().max(40).optional().nullable(), channelId: z.string().max(40).optional().nullable(),
  province: z.string().max(120).optional().nullable(), city: z.string().max(120).optional().nullable(),
}).partial();
const ruleBody = z.object({
  name: z.string().trim().min(1).max(120), priority: z.coerce.number().int().min(0).max(100000).optional(),
  method: z.enum(asg.METHODS).optional(), conditions: conditions.optional(), assignees: z.array(z.string().min(1)).min(1),
  status: z.enum(['active', 'inactive']).optional(), description: z.string().max(500).optional().nullable(),
});
const ruleUpdate = ruleBody.partial();
const leadIds = z.array(z.string().min(1)).min(1).max(1000);
const reasonFields = { reasonCode: z.string().trim().max(40).optional().nullable(), reason: z.string().trim().max(500).optional().nullable() };
const reassignBody = z.object({ leadIds, toUserId: z.string().min(1), ...reasonFields });
const queueBody = z.object({ leadIds, ...reasonFields }).refine((b) => b.reasonCode || b.reason, { message: 'Choose the reason or enter a note', path: ['reasonCode'] });
const takeBody = z.object({ leadIds });
const orderBody = z.object({ ids: z.array(z.coerce.number().int()).min(1).max(500) });
const runBody = z.object({ dryRun: z.boolean().optional() });

const rule = { id: 1, name: 'Metro Manila motor', priority: 10, method: 'round_robin', conditions: { lob: 'MOTOR', province: 'Metro Manila' }, assignees: ['usr_1', 'usr_2'], assigneeNames: ['Juan Dela Cruz', 'Maria Santos'], status: 'active' };
const queued = { id: 'ld_1', leadNumber: 'LD-2026-00012', name: 'Jose Reyes', status: 'New', lob: 'MOTOR', ownerName: 'Juan Dela Cruz', assignmentStatus: 'queued', queueReason: 'No assignment rule matched' };

define({
  method: 'GET', path: '/rules', summary: 'Lead assignment rules by priority (filter status)', screen: `${SCREEN} > Rules`, middleware: canRead,
  query: { status: 'active' }, response: { success: true, data: [rule] },
  handler: async (req, res) => res.json({ success: true, data: await asg.listRules(req.query) }),
});
define({
  method: 'POST', path: '/rules', summary: 'Add an assignment rule (conditions on branch, line, source, category, channel, province, city; round robin, load or fixed)', screen: `${SCREEN} > Rules > Add`,
  middleware: [...canWrite, validate(ruleBody)], request: { name: 'Metro Manila motor', priority: 10, method: 'round_robin', conditions: { lob: 'MOTOR', province: 'Metro Manila' }, assignees: ['usr_1', 'usr_2'] },
  response: { success: true, data: rule },
  handler: async (req, res) => {
    const r = await asg.createRule(req.body, req.user.id);
    await audit(req, { entity: 'lead_assignment_rule', entityId: r.id, action: 'create', after: r });
    res.status(201).json({ success: true, message: 'Assignment rule added', data: r });
  },
});
define({
  method: 'PUT', path: '/rules/order', summary: 'Order the assignment rules: priorities 10, 20, 30 ... in the order of the ids given', screen: `${SCREEN} > Rules > Move up / down`,
  middleware: [...canWrite, validate(orderBody)], request: { ids: [3, 1, 2] }, response: { success: true, data: [rule] },
  handler: async (req, res) => {
    const rules = await asg.reorderRules(req.body.ids, req.user.id);
    await audit(req, { entity: 'lead_assignment_rule', entityId: req.body.ids.join(','), action: 'reorder', after: rules.map((r) => ({ id: r.id, priority: r.priority })) });
    res.json({ success: true, message: 'Order of the rules saved', data: rules });
  },
});
define({
  method: 'POST', path: '/rules/run', summary: 'Run the reassignment queue through the active rules (dryRun: preview only)', screen: `${SCREEN} > Reassignment Queue > Assign by rules`,
  middleware: [...canWrite, validate(runBody)], request: { dryRun: true },
  response: { success: true, data: { dryRun: true, assigned: [{ leadNumber: 'LD-2026-00012', name: 'Jose Reyes', ruleName: 'Metro Manila motor', toName: 'Juan Dela Cruz' }], unmatched: 2 } },
  handler: async (req, res) => {
    const out = await asg.runQueue({ dryRun: req.body.dryRun }, req.user.id);
    if (!out.dryRun) {
      for (const a of out.assigned) await audit(req, { entity: 'lead', entityId: a.leadId, action: 'assign-by-rule', after: { ownerUserId: a.toUserId, ruleId: a.ruleId } });
    }
    const message = out.dryRun ? `${out.assigned.length} prospect(s) would be assigned; ${out.unmatched} stay in the queue`
      : `${out.assigned.length} prospect(s) assigned by the rules; ${out.unmatched} stay in the queue`;
    res.json({ success: true, message, data: out });
  },
});
define({
  method: 'PUT', path: '/rules/:id', summary: 'Change an assignment rule (status active / inactive activates or deactivates it)', screen: `${SCREEN} > Rules > Edit`, middleware: [...canWrite, validate(ruleUpdate)],
  request: { priority: 20, status: 'inactive' }, response: { success: true, data: rule },
  handler: async (req, res) => {
    const { before, after } = await asg.updateRule(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'lead_assignment_rule', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Assignment rule saved', data: after });
  },
});
define({
  method: 'DELETE', path: '/rules/:id', summary: 'Remove an assignment rule (made inactive when it already assigned prospects)', screen: `${SCREEN} > Rules > Delete`, middleware: canWrite,
  response: { success: true, message: 'Assignment rule removed', data: { removed: true } },
  handler: async (req, res) => {
    const out = await asg.deleteRule(req.params.id, req.user.id);
    await audit(req, { entity: 'lead_assignment_rule', entityId: out.rule.id, action: out.removed ? 'delete' : 'deactivate', before: out.rule });
    res.json({ success: true, message: out.removed ? 'Assignment rule removed' : 'The rule assigned prospects before, so it was made inactive', data: { removed: out.removed } });
  },
});
define({
  method: 'GET', path: '/queue', summary: 'Reassignment queue: prospects no rule could assign, whose assignee is inactive, not worked in time or sent by hand (filters search, lob (NONE: product not yet tagged), branchCode, reasonCode)',
  screen: `${SCREEN} > Reassignment Queue`, middleware: canRead, query: { search: 'reyes', lob: 'MOTOR', reasonCode: 'REA-LEAVE' }, response: { success: true, data: [queued] },
  handler: async (req, res) => res.json({ success: true, data: await asg.queueList(req.query) }),
});
define({
  method: 'POST', path: '/reassign', summary: 'Reassign one or many prospects to an account executive (from the queue or in bulk) with a reason code of the Reason Codes master (reassignment) and / or a note (required while leads.reassignment_reason_required)',
  screen: `${SCREEN} > Reassign`, middleware: [...canWrite, validate(reassignBody)], request: { leadIds: ['ld_1', 'ld_2'], toUserId: 'usr_2', reasonCode: 'REA-TERRITORY', reason: 'Moved to the Cebu branch' },
  response: { success: true, data: { reassigned: 2, toUserId: 'usr_2', toName: 'Maria Santos', reasonCode: 'REA-TERRITORY', reason: 'Territory or branch change: Moved to the Cebu branch' } },
  handler: async (req, res) => {
    const action = req.body.leadIds.length > 1 ? 'bulk' : 'manual';
    const out = await asg.reassign(req.body.leadIds, req.body.toUserId, { reasonCode: req.body.reasonCode, reason: req.body.reason, action, by: req.user.id });
    for (const l of out.leads) {
      await audit(req, { entity: 'lead', entityId: l.id, action: 'reassign', before: { ownerUserId: l.fromUserId }, after: { ownerUserId: out.toUserId, reason: out.reason, reasonCode: out.reasonCode } });
    }
    res.json({ success: true, message: `${out.reassigned} prospect(s) reassigned to ${out.toName}`,
      data: { reassigned: out.reassigned, toUserId: out.toUserId, toName: out.toName, reason: out.reason, reasonCode: out.reasonCode } });
  },
});
define({
  method: 'POST', path: '/queue/take', summary: 'Take prospects waiting in the reassignment queue: they are assigned to the signed-in user', screen: `${SCREEN} > Reassignment Queue > Take`,
  middleware: [...canWrite, validate(takeBody)], request: { leadIds: ['ld_1'] }, response: { success: true, data: { reassigned: 1, toUserId: 'usr_1', toName: 'Ana Garcia' } },
  handler: async (req, res) => {
    const out = await asg.reassign(req.body.leadIds, req.user.id, { action: 'taken', by: req.user.id });
    for (const l of out.leads) await audit(req, { entity: 'lead', entityId: l.id, action: 'take', before: { ownerUserId: l.fromUserId }, after: { ownerUserId: out.toUserId } });
    res.json({ success: true, message: `${out.reassigned} prospect(s) taken from the queue`, data: { reassigned: out.reassigned, toUserId: out.toUserId, toName: out.toName } });
  },
});
define({
  method: 'POST', path: '/queue', summary: 'Send prospects to the reassignment queue with a reason code of the Reason Codes master (reassignment) and / or a note', screen: `${SCREEN} > Send to Queue`,
  middleware: [...canWrite, validate(queueBody)], request: { leadIds: ['ld_1'], reasonCode: 'REA-LEAVE', reason: 'Back on 20 October' },
  response: { success: true, data: { queued: 1, reasonCode: 'REA-LEAVE', reason: 'Account executive on leave: Back on 20 October' } },
  handler: async (req, res) => {
    const out = await asg.sendToQueue(req.body.leadIds, { reasonCode: req.body.reasonCode, reason: req.body.reason }, req.user.id);
    await audit(req, { entity: 'lead', entityId: req.body.leadIds.join(','), action: 'queue', after: { reason: out.reason, reasonCode: out.reasonCode } });
    res.json({ success: true, message: `${out.queued} prospect(s) sent to the queue`, data: out });
  },
});
define({
  method: 'GET', path: '/history/:leadId', summary: 'Assignment history of a prospect', screen: `${SCREEN}; Prospects > View`, middleware: canTeam,
  response: { success: true, data: [{ action: 'auto', fromName: null, toName: 'Juan Dela Cruz', ruleName: 'Metro Manila motor', assignedAt: '2026-10-01T02:00:00Z' }] },
  handler: async (req, res) => res.json({ success: true, data: await asg.leadHistory(req.params.leadId) }),
});
define({
  method: 'GET', path: '/team', summary: 'Team view: the members reporting to a manager (the signed-in user by default) with their prospects by status, and the team\'s prospects',
  screen: `${SCREEN} > Team View`, middleware: canTeam, query: { managerId: 'usr_1', memberId: 'usr_2', status: 'New' },
  response: { success: true, data: { managerId: 'usr_1', members: [{ id: 'usr_1', name: 'Ana Garcia', depth: 0, open: 4, new: 1, converted: 2 }], totals: { open: 4 }, leads: [queued] } },
  handler: async (req, res) => res.json({ success: true, data: await asg.teamView(req.user, req.query) }),
});
define({
  method: 'GET', path: '/assignees', summary: 'Active users who can receive prospects (name, branch, open prospects); with leadIds (comma separated) the assignees of the rules matching those prospects are marked suggested',
  screen: SCREEN, middleware: canTeam, query: { leadIds: 'ld_1,ld_2' },
  response: { success: true, data: [{ id: 'usr_1', name: 'Juan Dela Cruz', username: 'agent.jdelacruz', branchCode: 'HO', designation: 'Account Executive', open: 4, suggested: true, rules: ['Metro Manila motor'] }] },
  handler: async (req, res) => res.json({ success: true, data: await asg.assigneeOptions({ leadIds: String(req.query.leadIds || '').split(',').filter(Boolean) }) }),
});

export default router;
