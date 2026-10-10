import { moduleRouter } from '../../lib/registry.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok } from '../../lib/respond.js';
import { canRead, canWrite } from '../masters/helpers.js';
import * as svc from './service.js';

/**
 * Master > System Configuration > Security Controls: the register of the security, data-protection and operational
 * controls with their current state against the BRD targets, and the dated evidence of the controls met outside the
 * application. Reading needs the settings permission; recording evidence needs write:settings and is audited.
 */
const { router, define } = moduleRouter('Security Controls', '/system-controls');
const SCREEN = 'Master > System Configuration > Security Controls';
const control = { key: 'idle-timeout', kind: 'enforced', group: 'access', groupLabel: 'Sign-in and sessions', name: 'Idle session timeout', requirements: ['TIS-BRD-NFR-03'],
  current: '30 minutes, enforced by the API and the browser', target: 'Sign-out after 3 minutes without activity', status: 'review', evidence: null, managedBy: { screen: 'Master > System Configuration > Configuration', path: '/master/configuration/settings' } };
const evidence = { id: 1, controlKey: 'backups', evidenceDate: '2026-10-01', result: 'met', reference: 'Azure backup report 2026-09', remarks: 'Restore drill 42 minutes', recordedBy: 'IT AppSupport', recordedAt: '2026-10-01T02:00:00Z' };

define({
  method: 'GET', path: '/', summary: 'The controls register: every control with its group, requirement ids, current state, target, status (met, review, not-met, pending) and latest evidence', screen: SCREEN,
  middleware: canRead('settings'), response: { success: true, data: [control], groups: svc.GROUPS, results: svc.RESULTS },
  handler: async (_req, res) => ok(res, await svc.listControls(), 'OK', { groups: svc.GROUPS, results: svc.RESULTS }),
});
define({
  method: 'GET', path: '/:key/evidence', summary: 'The evidence recorded for a control, newest first', screen: `${SCREEN} > Evidence`, middleware: canRead('settings'),
  response: { success: true, data: [evidence] },
  handler: async (req, res) => ok(res, await svc.listEvidence(req.params.key)),
});
define({
  method: 'POST', path: '/:key/evidence', summary: 'Record dated evidence of a control (evidence date, result met / not-met / review, reference, remarks); audited', screen: `${SCREEN} > Record evidence`,
  middleware: [...canWrite('settings'), validate(z.object({ evidenceDate: z.string().min(1), result: z.enum(svc.RESULTS), reference: z.string().min(1).max(200), remarks: z.string().max(2000).nullable().optional() }).strict())],
  request: { evidenceDate: '2026-10-01', result: 'met', reference: 'Azure backup report 2026-09', remarks: 'Restore drill 42 minutes' }, response: { success: true, data: evidence },
  handler: async (req, res) => {
    const row = await svc.recordEvidence(req.params.key, req.body, req.user);
    await audit(req, { entity: 'system_control', entityId: req.params.key, action: 'record-evidence', after: { evidenceDate: row.evidenceDate, result: row.result, reference: row.reference } });
    ok(res, row, 'Evidence recorded');
  },
});

export default router;
export const mount = '/system-controls';
