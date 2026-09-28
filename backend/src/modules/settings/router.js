import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission, requireRole } from '../../lib/auth.js';
import { getSettings, setSetting } from '../../lib/settings.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { many, query } from '../../db/pool.js';
import { ok } from '../../lib/respond.js';

const { router, define } = moduleRouter('System Settings', '/settings');

define({
  method: 'GET', path: '/', summary: 'All configuration values (grouped)', screen: 'Master > System Settings', middleware: [requireAuth],
  query: { group: 'tax' }, response: { success: true, data: [{ key: 'tax.vat_rate', value: 0.12, group: 'tax', label: 'VAT rate', type: 'number' }] },
  handler: async (req, res) => ok(res, await getSettings(req.query.group)),
});
define({
  method: 'GET', path: '/public', auth: false, summary: 'Branding settings needed before sign-in (logo, colours, names)', screen: 'Sign-in',
  response: { success: true, data: { 'branding.logo_url': '', 'branding.primary_color': '#0072d8' } },
  handler: async (_req, res) => {
    const rows = await many('SELECT key, value FROM app_settings WHERE "group" IN (\'branding\', \'general\')');
    ok(res, Object.fromEntries(rows.map((r) => [r.key, r.value])));
  },
});
define({
  method: 'PUT', path: '/', summary: 'Update one or more configuration values', screen: 'Master > System Settings', roles: ['it-admin', 'ba'],
  middleware: [requireAuth, requireRole('it-admin', 'ba'), validate(z.object({ settings: z.record(z.any()) }))],
  request: { settings: { 'tax.vat_rate': 0.12, 'branding.primary_color': '#0072d8' } }, response: { success: true },
  handler: async (req, res) => {
    const before = Object.fromEntries((await getSettings()).map((s) => [s.key, s.value]));
    for (const [k, v] of Object.entries(req.body.settings)) {
      const exists = (await query('SELECT editable FROM app_settings WHERE key = $1', [k])).rows[0];
      if (!exists || !exists.editable) continue;
      await setSetting(k, v, req.user.id);
    }
    await audit(req, { entity: 'settings', action: 'update', before, after: req.body.settings });
    ok(res, await getSettings(), 'Settings updated');
  },
});
define({
  method: 'GET', path: '/audit', summary: 'Audit trail (filter by entity / entityId / user)', screen: 'Master > Audit trail', roles: ['it-admin', 'ba'],
  middleware: [requireAuth, requirePermission('read:audit')], query: { entity: 'policy', entityId: 'pol_1', limit: 100 },
  response: { success: true, data: [{ at: '2026-01-01T00:00:00Z', username: 'BrokerVerse', entity: 'policy', action: 'create' }] },
  handler: async (req, res) => {
    const { entity, entityId, username } = req.query;
    const limit = Math.min(1000, Number(req.query.limit) || 200);
    ok(res, await many(`SELECT id, at, user_id AS "userId", username, entity, entity_id AS "entityId", action, before_data AS "before", after_data AS "after", ip FROM audit_log
      WHERE ($1::text IS NULL OR entity = $1) AND ($2::text IS NULL OR entity_id = $2) AND ($3::text IS NULL OR username = $3) ORDER BY id DESC LIMIT $4`, [entity || null, entityId || null, username || null, limit]));
  },
});

export default router;
export const mount = '/settings';
