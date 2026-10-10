import bcrypt from 'bcryptjs';
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { PLATFORM_ROLE, isPlatformAdmin, requirePlatformAdmin } from '../../lib/platform.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { conflict } from '../../lib/errors.js';
import { one, withTransaction } from '../../db/pool.js';
import { passwordPolicy, recordHistory } from '../../lib/password.js';
import { temporaryPassword } from '../../lib/secrets.js';
import { getSetting } from '../../lib/settings.js';
import { sendSheet } from '../claims/docs.js';
import { SYSTEM_ENVIRONMENT_KEY } from '../../lib/environment.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Features and Releases', '/features');
const platform = moduleRouter('Platform Administration', '/platform');
const reader = [requireAuth, requirePermission('read:features')];
const vendor = [requireAuth, requirePlatformAdmin];
const SCREEN = 'Master > System Configuration > Features & Releases';
const VENDOR_SCREEN = 'Master > Platform > Features & Releases';

const featureExample = { key: 'payables', name: 'Accounts payable', module: 'Accounts', tier: 'PHASE_2', tierName: 'Phase 2', requirements: ['TIS-BRD-NIA-03'],
  dependsOn: ['suppliers'], status: 'off', statusName: 'Not enabled', decisionPending: false, enabledAt: null, enabledBy: null, releaseRef: null };

define({
  method: 'GET', path: '/state', summary: 'Features of this environment that are not plainly on (off or read-only) with the menu entries and addresses they hide; every signed-in user (menus, route guard, sections)',
  screen: 'Side menu; route guard', middleware: [requireAuth],
  response: { success: true, data: [{ key: 'payables', status: 'off', menus: ['Accounts > Payables > Supplier Invoices'], routes: [] }] },
  handler: async (_req, res) => ok(res, await svc.clientState()),
});
define({
  method: 'GET', path: '/catalogue', summary: 'Catalogue of features and releases with tier, status, requirement ids, enabled date, enabled by and release reference (read-only)',
  screen: SCREEN, middleware: reader, response: { success: true, data: [featureExample] },
  handler: async (req, res) => ok(res, await svc.catalogueView({ full: isPlatformAdmin(req.user) })),
});
define({
  method: 'GET', path: '/catalogue/export', summary: 'Catalogue of features and releases as Excel: the features with their status and the future releases with their description',
  screen: `${SCREEN} > Export`, middleware: reader, response: '(xlsx file)',
  handler: async (_req, res) => {
    const rows = await svc.catalogueView();
    const columns = [
      { key: 'name', header: 'Feature', width: 40 }, { key: 'module', header: 'Module', width: 22 }, { key: 'tierName', header: 'Tier', width: 16 },
      { key: 'statusName', header: 'Status', width: 14 }, { key: 'requirements', header: 'Requirement IDs', width: 40 }, { key: 'enabledAt', header: 'Enabled On', type: 'date', width: 14 },
      { key: 'enabledBy', header: 'Enabled By', width: 16 }, { key: 'releaseRef', header: 'Release Reference', width: 22 }, { key: 'description', header: 'Description', width: 70 },
    ];
    const shape = (r) => ({ ...r, requirements: r.requirements.join(', '), enabledAt: r.enabledAt ? new Date(r.enabledAt) : null });
    await sendSheet(res, { fileName: 'features-and-releases', sheets: [
      { name: 'Features', columns, rows: rows.map(shape) },
      { name: 'Future releases', columns: columns.filter((c) => ['name', 'module', 'statusName', 'description'].includes(c.key)),
        rows: rows.filter((r) => r.tier === 'FUTURE').map(shape) },
    ] });
  },
});

// ------------------------------------------------------------------ platform administrator (vendor)
const changeSchema = z.object({
  action: z.enum(['enable', 'disable']), features: z.array(z.string()).optional(), tier: z.enum(['PHASE_2', 'FUTURE']).optional(),
  reasonCode: z.string().optional(), note: z.string().optional(), releaseRef: z.string().optional(), effective: z.enum(['immediate', 'scheduled']).optional(), effectiveAt: z.string().optional(),
});

platform.define({
  method: 'GET', path: '/features', summary: 'Every feature with its state and what it controls (menus, API, jobs, connectors, settings, sections, documents)',
  screen: VENDOR_SCREEN, middleware: vendor, response: { success: true, data: [featureExample] },
  handler: async (_req, res) => ok(res, await svc.catalogueView({ full: true })),
});
platform.define({
  method: 'POST', path: '/features/preview', summary: 'Impact of enabling or disabling features or a tier bundle: features with dependencies, menus, roles that gain access, jobs, connectors, settings to configure, read-only features',
  screen: `${VENDOR_SCREEN} > Enable / Disable`, middleware: [...vendor, validate(changeSchema)],
  request: { action: 'enable', tier: 'PHASE_2' }, response: { success: true, data: { action: 'enable', features: [{ key: 'payables', from: 'off', to: 'on' }], menus: [], roles: [] } },
  handler: async (req, res) => ok(res, await svc.preview(req.body)),
});
platform.define({
  method: 'GET', path: '/features/changes', summary: 'Feature change requests (status pending, scheduled, applied, rejected, withdrawn), newest first',
  screen: `${VENDOR_SCREEN} > Changes`, middleware: vendor, query: { status: 'pending' },
  handler: async (req, res) => ok(res, await svc.listChanges({ status: req.query.status })),
});
platform.define({
  method: 'POST', path: '/features/changes', summary: 'Request a change (maker): enable or disable features or a tier bundle, with reason, contract or change request reference and effective date (immediate or scheduled)',
  screen: `${VENDOR_SCREEN} > Enable / Disable`, middleware: [...vendor, validate(changeSchema)],
  request: { action: 'enable', tier: 'PHASE_2', reasonCode: 'FTR-CONTRACT', releaseRef: 'CR-2027-004', effective: 'immediate' },
  response: { success: true, data: { change: { id: 1, ref: 'FCR-00001', status: 'pending' } } },
  handler: async (req, res) => {
    const r = await svc.requestChange(req.body, req.user);
    await audit(req, { entity: 'feature_change', entityId: r.change.id, action: 'request', after: r.change });
    created(res, r, `Change ${r.change.ref} waits for approval by another platform administrator`);
  },
});
platform.define({
  method: 'POST', path: '/features/changes/:id/decision', summary: 'Approve or reject a change (checker, never the requester); an immediate change applies at once, a scheduled one on its date',
  screen: `${VENDOR_SCREEN} > Changes > Approve / Reject`, middleware: [...vendor, validate(z.object({ decision: z.enum(['approve', 'reject']), remarks: z.string().optional(), reasonCode: z.string().optional(), note: z.string().optional() }))],
  request: { decision: 'approve', remarks: 'Checked against CR-2027-004' }, response: { success: true, data: { change: { id: 1, status: 'applied' }, applied: [{ key: 'payables', from: 'off', to: 'on' }] } },
  handler: async (req, res) => {
    const r = await svc.decideChange(req.params.id, req.body, req.user);
    await audit(req, { entity: 'feature_change', entityId: r.change.id, action: req.body.decision === 'approve' ? 'approve' : 'reject', after: r.change });
    const word = req.body.decision === 'reject' ? 'rejected' : r.change.status === 'scheduled' ? 'approved; it applies on its effective date' : 'approved and applied';
    ok(res, r, `Change ${r.change.ref} ${word}`);
  },
});
platform.define({
  method: 'POST', path: '/features/changes/:id/withdraw', summary: 'Withdraw a change waiting for approval (requester) or cancel a scheduled change',
  screen: `${VENDOR_SCREEN} > Changes > Withdraw`, middleware: vendor, response: { success: true, data: { id: 1, status: 'withdrawn' } },
  handler: async (req, res) => {
    const c = await svc.withdrawChange(req.params.id, req.user);
    await audit(req, { entity: 'feature_change', entityId: c.id, action: 'withdraw', after: c });
    ok(res, c, `Change ${c.ref} withdrawn`);
  },
});
platform.define({
  method: 'GET', path: '/features/export', summary: 'Entitlements of this environment (JSON) for promotion to another environment',
  screen: `${VENDOR_SCREEN} > Export for promotion`, middleware: vendor, response: '(json file)',
  handler: async (_req, res) => {
    const env = String((await getSetting(SYSTEM_ENVIRONMENT_KEY, '')) || '').trim() || 'environment';
    res.setHeader('Content-Disposition', `attachment; filename="features-${env.replace(/[^a-z0-9-]+/gi, '-')}.json"`);
    res.json(await svc.exportState(env));
  },
});
platform.define({
  method: 'POST', path: '/features/promote', summary: 'Promote the entitlements exported from another environment: raises the change requests (enable, disable) that bring this environment to that state, each waiting for approval',
  screen: `${VENDOR_SCREEN} > Promote from another environment`,
  middleware: [...vendor, validate(z.object({ file: z.object({ environment: z.string().optional(), features: z.array(z.object({ key: z.string(), status: z.string() }).passthrough()) }).passthrough(),
    reasonCode: z.string().optional(), note: z.string().optional(), releaseRef: z.string().optional(), effective: z.enum(['immediate', 'scheduled']).optional(), effectiveAt: z.string().optional() }))],
  request: { file: { environment: 'uat', features: [{ key: 'payables', status: 'on' }] }, reason: 'Promotion of the UAT sign-off', releaseRef: 'CR-2027-004' },
  handler: async (req, res) => {
    const { file, ...body } = req.body;
    const r = await svc.promote(file, body, req.user);
    for (const c of r.changes) await audit(req, { entity: 'feature_change', entityId: c.id, action: 'request', after: c });
    ok(res, r, r.changes.length ? `${r.changes.length} change request(s) wait for approval` : 'This environment already has that state');
  },
});
platform.define({
  method: 'GET', path: '/admins', summary: 'Platform administrator accounts', screen: `${VENDOR_SCREEN} > Platform administrators`, middleware: vendor,
  response: { success: true, data: [{ id: 'usr_1', username: 'platform.admin@iorta.example', displayName: 'Platform Administrator', twoFactorEnabled: true }] },
  handler: async (_req, res) => ok(res, await svc.platformAdmins()),
});
platform.define({
  method: 'POST', path: '/admins', summary: 'Add a platform administrator (the second approver): a temporary password is returned once; the password is changed and two-factor authentication set up at the first sign-in',
  screen: `${VENDOR_SCREEN} > Platform administrators > Add`,
  middleware: [...vendor, validate(z.object({ username: z.string().trim().min(3).max(60).regex(/^[A-Za-z0-9._@-]+$/), displayName: z.string().trim().min(1), email: z.string().email() }))],
  request: { username: 'second.admin@iorta.example', displayName: 'Second Administrator', email: 'second.admin@iorta.example' },
  response: { success: true, data: { id: 'usr_2', username: 'second.admin@iorta.example', temporaryPassword: '<shown once>' } },
  handler: async (req, res) => {
    const b = req.body;
    if (await one('SELECT 1 FROM users WHERE lower(username) = lower($1)', [b.username])) throw conflict('Username already exists');
    const password = temporaryPassword(await passwordPolicy());
    const hash = await bcrypt.hash(password, 10);
    const id = await withTransaction(async (c) => {
      const u = (await c.query(`INSERT INTO users(username, password_hash, display_name, email, status, must_change_password, created_by) VALUES ($1,$2,$3,$4,'active',true,$5) RETURNING id`,
        [b.username, hash, b.displayName, b.email, req.user.username])).rows[0];
      await c.query('INSERT INTO user_roles(user_id, role_id) SELECT $1, id FROM roles WHERE code = $2', [u.id, PLATFORM_ROLE]);
      await recordHistory(u.id, hash, c);
      return u.id;
    });
    await audit(req, { entity: 'user', entityId: id, action: 'create', after: { username: b.username, displayName: b.displayName, email: b.email, roles: [PLATFORM_ROLE] } });
    res.set('Cache-Control', 'no-store');
    created(res, { id, username: b.username, displayName: b.displayName, temporaryPassword: password }, 'Platform administrator added with a temporary password');
  },
});

export default router;
export const mount = '/features';
export const extraMounts = [['/platform', platform.router]];
