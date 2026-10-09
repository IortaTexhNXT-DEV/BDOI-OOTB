import { moduleRouter } from '../../lib/registry.js';
import { ADMIN_ROLE, requireAuth, requirePermission, requireRole } from '../../lib/auth.js';
import { getSettings, setSetting } from '../../lib/settings.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { many, one, query } from '../../db/pool.js';
import { ok, paging } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { businessTimeZone, today } from '../../lib/dates.js';
import { assertNotControlled, assertParkedEvents } from '../posting-rules/service.js';
import { assertNotOwnedElsewhere, settingOwner } from '../../lib/settingOwners.js';
import { localizationErrors } from '../system-settings/service.js';
import { EXPORT_COLUMNS, exportRows } from '../../lib/auditEvents.js';
import { sendSheet } from '../claims/docs.js';
import * as auditSvc from '../audit/service.js';

const { router, define } = moduleRouter('System Settings', '/settings');
/** Settings with the screen that owns them (managedBy: { screen, path }; null when Master > Configuration edits it). */
const withOwners = (rows) => rows.map((r) => ({ ...r, managedBy: settingOwner(r.key) }));

define({
  method: 'GET', path: '/', summary: 'All configuration values (grouped); managedBy names the screen that changes a setting owned elsewhere', screen: 'Master > Configuration', middleware: [requireAuth],
  query: { group: 'tax' }, response: { success: true, data: [{ key: 'tax.vat_rate', value: 0.12, group: 'tax', label: 'VAT rate', type: 'number', managedBy: { screen: 'Master > Finance > Premium Taxes & LGU Rates', path: '/master/finance/premium-taxes' } }] },
  handler: async (req, res) => ok(res, withOwners(await getSettings(req.query.group))),
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
  method: 'PUT', path: '/', summary: 'Update one or more configuration values (a setting owned by another screen, e.g. branding.* or tax.vat_rate, is refused with that screen\'s name)', screen: 'Master > Configuration', roles: [ADMIN_ROLE],
  middleware: [requireAuth, requireRole(ADMIN_ROLE), validate(z.object({ settings: z.record(z.any()) }))],
  request: { settings: { 'limits.bulk_upload_max_rows': 1000, 'notification.email_enabled': true } }, response: { success: true },
  handler: async (req, res) => {
    const before = Object.fromEntries((await getSettings()).map((s) => [s.key, s.value]));
    const changes = Object.entries(req.body.settings).map(([k, v]) => [k, v, before[k]]);
    assertNotOwnedElsewhere(changes);
    const invalid = await localizationErrors(changes);
    if (invalid.length) throw badRequest('Validation failed', invalid);
    await assertNotControlled(changes);
    assertParkedEvents(changes);
    for (const [k, v] of changes) {
      const exists = (await query('SELECT editable FROM app_settings WHERE key = $1', [k])).rows[0];
      if (!exists || !exists.editable) continue;
      await setSetting(k, v, req.user.id);
    }
    await audit(req, { entity: 'settings', action: 'update', before, after: req.body.settings });
    ok(res, withOwners(await getSettings()), 'Settings updated');
  },
});
define({
  method: 'GET', path: '/audit', summary: 'Audit trail (filter by entity / entityId / user and a from / to business-date range, general.timezone; newest first; with page / pageSize a page of the log and its total, else the latest `limit` entries)', screen: 'Master > Audit trail', roles: [ADMIN_ROLE],
  middleware: [requireAuth, requirePermission('read:audit')], query: { entity: 'policy', entityId: 'pol_1', username: 'BrokerVerse', from: '2026-09-01', to: '2026-09-30', page: 1, pageSize: 20 },
  response: { success: true, data: [{ at: '2026-01-01T00:00:00Z', username: 'BrokerVerse', entity: 'policy', action: 'create' }], total: 1, page: 1, pageSize: 20, totalPages: 1 },
  handler: async (req, res) => {
    const { entity, entityId, username } = req.query;
    const iso = (v, field) => {
      if (v === undefined || v === '') return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw badRequest('Validation failed', [{ path: field, message: `${field} must be a date (YYYY-MM-DD)` }]);
      return String(v);
    };
    const from = iso(req.query.from, 'from');
    const to = iso(req.query.to, 'to');
    // from / to are business dates: a day runs from 00:00 to 24:00 in general.timezone (Manila), not UTC
    const where = `($1::text IS NULL OR entity = $1) AND ($2::text IS NULL OR entity_id = $2) AND ($3::text IS NULL OR username = $3)
        AND ($4::date IS NULL OR at >= ($4::date)::timestamp AT TIME ZONE $6) AND ($5::date IS NULL OR at < ($5::date + 1)::timestamp AT TIME ZONE $6)`;
    const params = [entity || null, entityId || null, username || null, from, to, await businessTimeZone()];
    const columns = 'id, at, user_id AS "userId", username, entity, entity_id AS "entityId", action, before_data AS "before", after_data AS "after", ip';
    if (req.query.page !== undefined || req.query.pageSize !== undefined) {
      // a page of the log (the screen pages through it on the server, however long it grows)
      const pg = paging(req.query, { page: 1, perPage: 20 });
      const total = (await one(`SELECT count(*)::int AS n FROM audit_log WHERE ${where}`, params)).n;
      const rows = await many(`SELECT ${columns} FROM audit_log WHERE ${where} ORDER BY id DESC LIMIT $7 OFFSET $8`, [...params, pg.limit, pg.offset]);
      return ok(res, rows, 'OK', { total, page: pg.page, pageSize: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
    }
    const limit = Math.min(1000, Number(req.query.limit) || 200);
    return ok(res, await many(`SELECT ${columns} FROM audit_log WHERE ${where} ORDER BY id DESC LIMIT $7`, [...params, limit]));
  },
});

const auditRead = [requireAuth, requirePermission('read:audit')];
const auditEvent = {
  id: '812', at: '2026-10-02T01:49:37.774Z', day: '2026-10-02', date: '02/10/2026', time: '09:49', atText: '02/10/2026 09:49', entity: 'policy',
  entityLabel: 'Policy', entityId: 'pol_0123456789abcdef', reference: 'MC-2026-000123', action: 'update', title: 'Policy updated', note: null,
  user: { username: 'r.underwriter', displayName: 'Ramon Reyes', roles: ['Underwriter'] }, source: { channel: 'screen', label: 'Screen', name: 'Operations > Policies > Edit' },
  changes: [{ key: 'grossPremium', label: 'Gross premium', from: 'PHP 12,500.00', to: 'PHP 13,750.00' }],
};
define({
  method: 'GET', path: '/audit/events',
  summary: 'Audit trail as business events (one per action, newest first, paged on the server): user display name and roles, date and time in general.timezone, source (screen / API / system job), record type and number, the event and its changed fields (label, old value, new value; secrets never shown). Filters: from / to (business dates), username, entity (record type, comma-separated; "master" = every master), entityRef (record id or number), action. export=csv | excel downloads every matching event, one row per changed field (at most 10,000 events)',
  screen: 'Master > Audit trail', roles: [ADMIN_ROLE], middleware: auditRead,
  query: { from: '2026-09-01', to: '2026-09-30', username: 'r.underwriter', entity: 'policy', entityRef: 'MC-2026-000123', action: 'update', page: 1, pageSize: 20 },
  response: { success: true, data: [auditEvent], total: 1, page: 1, pageSize: 20, totalPages: 1 },
  handler: async (req, res) => {
    const format = String(req.query.export || '').toLowerCase();
    if (format === 'csv' || format === 'excel' || format === 'xlsx') {
      const events = await auditSvc.logExport(req.query, req.user);
      const stamp = await today();
      return sendSheet(res, { fileName: `audit-trail-${stamp}`, format: format === 'csv' ? 'csv' : 'excel', sheets: [{ name: 'Audit trail', columns: EXPORT_COLUMNS, rows: exportRows(events) }] });
    }
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const r = await auditSvc.logPage(req.query, pg, req.user);
    return ok(res, r.events, 'OK', { total: r.total, page: pg.page, pageSize: pg.perPage, totalPages: Math.ceil(r.total / pg.perPage) });
  },
});
define({
  method: 'GET', path: '/audit/options', summary: 'Filter choices of the audit trail: record types and actions found in the log (with business labels) and the users who made changes',
  screen: 'Master > Audit trail', roles: [ADMIN_ROLE], middleware: auditRead,
  response: { success: true, data: { recordTypes: [{ value: 'policy', label: 'Policy', count: 120 }], actions: [{ value: 'update', label: 'Updated' }], users: [{ value: 'r.underwriter', label: 'Ramon Reyes' }] } },
  handler: async (_req, res) => ok(res, await auditSvc.logOptions()),
});

export default router;
export const mount = '/settings';
