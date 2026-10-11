import { moduleRouter } from '../../lib/registry.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok } from '../../lib/respond.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import * as svc from './service.js';

/**
 * Master > Environment Promotion > Promotion Path (TIS IT AppSupport / Admin): where this environment stands on the
 * promotion path, the release it runs, the last export, load and comparison of the Setup Workbook, and the marker of
 * the environment. The workbook itself is downloaded, compared and loaded with the data-load module.
 */
const { router, define } = moduleRouter('Environment Promotion', '/environment-promotion');
const SCREEN = 'Master > Environment Promotion > Promotion Path';
const canRead = [requireAuth, requirePermission('read:data-load')];
const canWrite = [requireAuth, requirePermission('write:data-load')];
const example = { environment: 'uat', label: 'User Acceptance Testing', onPath: true, previous: { code: 'sit', label: 'System Integration Testing' }, next: { code: 'preprod', label: 'Pre-Production' },
  path: [{ code: 'dev', label: 'Development', position: 1, current: false, done: true }], choices: [{ code: 'dev', label: 'Development' }],
  release: { apiVersion: '2026.1.3', webVersion: null, environment: 'UAT', commit: 'a1b2c3d', ref: null, buildTime: null, schema: '0595_environment_promotion.sql' },
  cutoverDate: '2026-11-01', locked: false, lastExport: { at: '2026-10-10T02:00:00Z', by: 'it.admin' }, lastLoad: null, lastComparison: null };

define({
  method: 'GET', path: '/', summary: 'The promotion path with the position of this environment, the release identity (versions, commit, schema), the go-live state and the last export, load and comparison of the configuration workbook',
  screen: SCREEN, middleware: canRead, response: { success: true, data: example },
  handler: async (_req, res) => ok(res, await svc.promotionPath()),
});
define({
  method: 'GET', path: '/history', summary: 'The loads of the configuration workbook into this environment, newest first', screen: `${SCREEN} > History`, middleware: canRead,
  response: { success: true, data: [{ id: 7, fileName: 'GoLive_Configuration_Workbook.xlsx', status: 'loaded', rowsRead: 412, rowsError: 0, createdAt: '2026-10-10T02:00:00Z', loadedAt: '2026-10-10T02:05:00Z', createdBy: 'IT AppSupport' }] },
  handler: async (_req, res) => ok(res, await svc.history()),
});
define({
  method: 'PUT', path: '/environment', summary: 'Mark this database as an environment of the path (dev, sit, uat, preprod, training, production); a locked database stays production; audited',
  screen: `${SCREEN} > Mark environment`, middleware: [...canWrite, validate(z.object({ environment: z.string().min(1) }))], request: { environment: 'uat' },
  response: { success: true, message: 'Environment marked as User Acceptance Testing', data: example },
  handler: async (req, res) => {
    const r = await svc.setEnvironment(req.body.environment, req.user);
    await audit(req, { entity: 'environment', entityId: 'system.environment', action: 'mark', before: { environment: r.before }, after: { environment: r.after } });
    const data = await svc.promotionPath();
    ok(res, data, `Environment marked as ${data.label}`);
  },
});

export default router;
export const mount = '/environment-promotion';
