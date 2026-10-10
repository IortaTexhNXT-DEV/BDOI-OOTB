import { moduleRouter } from '../../lib/registry.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok } from '../../lib/respond.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { many, query } from '../../db/pool.js';
import { canRead, canWrite } from '../masters/helpers.js';
import { listClocks, listTargets, slaMonitor, summary, toTarget } from '../../lib/sla.js';

/**
 * Master > System Configuration > Service Levels: the turnaround of every status a document waits in (hours, working
 * time, escalation roles) and the open clocks. Reading needs the settings permission; changes need write:settings and
 * are audited. The clocks are kept by the sla-monitor job and read by My Work.
 */
const { router, define } = moduleRouter('Service Levels', '/service-levels');
const SCREEN = 'Master > System Configuration > Service Levels';
const example = { code: 'POL-PLACED', document: 'placement', name: 'Insurer issues the policy', targetHours: 16, workingTime: true, escalateToRoles: ['tis-ops-unit-head'], active: true, monitored: true };
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  targetHours: z.coerce.number().positive().max(9999).optional(),
  workingTime: z.boolean().optional(),
  escalateToRoles: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  active: z.boolean().optional(),
}).strict();
const COLUMNS = { name: 'name', description: 'description', targetHours: 'target_hours', workingTime: 'working_time', escalateToRoles: 'escalate_to_roles', active: 'active' };

define({
  method: 'GET', path: '/', summary: 'The service level register (filters: document, active) with the count of open and breached clocks', screen: SCREEN, middleware: canRead('settings'),
  query: { document: 'placement' }, response: { success: true, data: [example], summary: { open: 12, breached: 2, dueSoon: 3 } },
  handler: async (req, res) => ok(res, await listTargets(req.query), 'OK', { summary: await summary() }),
});
define({
  method: 'GET', path: '/clocks', summary: 'The open service level clocks (filters: targetCode, ownerId, breached, limit), breaches first', screen: `${SCREEN} > Open items`, middleware: canRead('settings'),
  query: { targetCode: 'POL-PLACED', breached: 'true' }, response: { success: true, data: [{ id: 1, targetCode: 'POL-PLACED', ref: 'PS-2026-00012', dueAt: '2026-10-12T08:00:00Z', breachedAt: null }] },
  handler: async (req, res) => ok(res, await listClocks(req.query)),
});
define({
  method: 'POST', path: '/run', summary: 'Run the service level monitor now (the sla-monitor job): opens, closes, marks and escalates the clocks', screen: SCREEN, middleware: canWrite('settings'),
  response: { success: true, data: { opened: 3, closed: 1, breached: 1, escalated: 1 } },
  handler: async (_req, res) => ok(res, await slaMonitor(), 'Service level monitor run'),
});
define({
  method: 'PUT', path: '/:code', summary: 'Change a service level: name, description, target hours, working time, escalation roles, active; audited', screen: `${SCREEN} > Edit`,
  middleware: [...canWrite('settings'), validate(updateSchema)], request: { targetHours: 16, workingTime: true, escalateToRoles: ['tis-ops-unit-head'] }, response: { success: true, data: example },
  handler: async (req, res) => {
    const before = (await many('SELECT * FROM sla_targets WHERE code = $1', [req.params.code]))[0];
    if (!before) throw notFound(`Service level ${req.params.code} not found`);
    if (req.body.escalateToRoles) {
      const known = (await many('SELECT code FROM roles WHERE code = ANY($1::text[])', [req.body.escalateToRoles])).map((r) => r.code);
      const unknown = req.body.escalateToRoles.filter((r) => !known.includes(r));
      if (unknown.length) throw badRequest('Validation failed', [{ path: 'escalateToRoles', message: `Unknown role(s): ${unknown.join(', ')}` }]);
    }
    const sets = [];
    const values = [req.params.code];
    for (const [key, col] of Object.entries(COLUMNS)) {
      if (req.body[key] === undefined) continue;
      values.push(key === 'escalateToRoles' ? JSON.stringify(req.body[key]) : req.body[key]);
      sets.push(`${col} = $${values.length}`);
    }
    if (sets.length) {
      values.push(req.user.id);
      await query(`UPDATE sla_targets SET ${sets.join(', ')}, updated_by = $${values.length} WHERE code = $1`, values);
    }
    const after = (await listTargets()).find((t) => t.code === req.params.code);
    await audit(req, { entity: 'sla_target', entityId: req.params.code, action: 'update', before: toTarget(before), after });
    ok(res, after, 'Service level saved');
  },
});

export default router;
export const mount = '/service-levels';
