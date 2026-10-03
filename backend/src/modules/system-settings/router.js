import { memoryUpload } from '../../lib/uploadLimits.js';
import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { setSetting } from '../../lib/settings.js';
import { ok } from '../../lib/respond.js';
import { canRead, canWrite } from '../masters/helpers.js';
import * as svc from './service.js';

/**
 * System Settings screen (Master > System Settings) plus the configuration catalogue that lets administrators
 * edit every business parameter (taxes, numbering, limits, notification switches, schedules) from the front end.
 */
const { router, define } = moduleRouter('System Settings', '/system-settings');
// Files are held in memory and validated against uploads.image_max_bytes before being written to UPLOAD_DIR.
const upload = memoryUpload({ files: 1 });
const singleFile = (req, res, next) => upload.single('file')(req, res, (e) => next(e ? badRequest(e.message) : undefined));
const SCREEN = 'Master > System Settings';
const example = {
  logoUrl: '/bdoi/iorta-technxt.png', logoPresets: [{ id: 'iorta-technxt', label: 'iorta TechNXT (BrokerVerse)', url: '/bdoi/iorta-technxt.png', builtIn: true }], displayCurrency: 'PHP',
  primaryColor: '#0072d8', secondaryColor: '#004ea8', defaultLanguage: 'en', faviconUrl: '/favicon.ico', systemName: 'BrokerVerse',
  currencies: [{ code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2, isBase: true, locale: 'en-PH', region: 'Asia' }], baseCurrency: 'PHP', updatedAt: '2026-09-28T00:00:00.000Z',
};

define({
  method: 'GET', path: '/', auth: false, summary: 'System settings (branding, display currency, language, application name); public because the sign-in page needs them', screen: `${SCREEN}; Sign-in; App shell`,
  response: { success: true, data: example },
  handler: async (_req, res) => ok(res, await svc.getSystemSettings()),
});
define({
  method: 'PUT', path: '/', summary: 'Save system settings (logoUrl, displayCurrency, primaryColor, secondaryColor, defaultLanguage, faviconUrl, systemName)', screen: SCREEN,
  middleware: canWrite('settings'), request: { systemName: 'BrokerVerse', displayCurrency: 'PHP', primaryColor: '#0072d8', secondaryColor: '#004ea8', defaultLanguage: 'en', logoUrl: '/iorta.png' },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const before = await svc.getSystemSettings();
    const changes = await svc.updateSystemSettings(req.body || {}, req.user.id);
    const after = await svc.getSystemSettings();
    await audit(req, { entity: 'system-settings', action: 'update', before, after: changes });
    ok(res, after, 'System settings saved');
  },
});
define({
  method: 'POST', path: '/logo-presets', summary: 'Add a company logo preset (JSON { label, url, setActive } or multipart label + file + setActive)', screen: `${SCREEN} > Add Company Logo`,
  middleware: [...canWrite('settings'), singleFile], request: { label: 'Sample Bank', url: 'https://example.com/logo.png', setActive: true },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const body = req.body || {};
    let { url } = body;
    if (req.file) url = (await svc.storeImage(req.file, 'logo', req.user.id, body.label)).url;
    const preset = await svc.addLogoPreset({ label: body.label, url, setActive: body.setActive }, req.user.id);
    await audit(req, { entity: 'system-settings', entityId: preset.id, action: 'add-logo-preset', after: preset });
    ok(res, await svc.getSystemSettings(), 'Company logo added');
  },
});
define({
  method: 'DELETE', path: '/logo-presets/:id', summary: 'Remove a custom logo preset (built-in presets cannot be removed)', screen: `${SCREEN} > Remove Logo`,
  middleware: canWrite('settings'), response: { success: true, data: example },
  handler: async (req, res) => {
    const preset = await svc.removeLogoPreset(req.params.id, req.user.id);
    await audit(req, { entity: 'system-settings', entityId: preset.id, action: 'remove-logo-preset', before: preset });
    ok(res, await svc.getSystemSettings(), 'Company logo removed');
  },
});
define({
  method: 'POST', path: '/upload/:field', summary: 'Upload the logo or favicon (multipart "file"); stored under UPLOAD_DIR and recorded in documents', screen: `${SCREEN} > Upload`,
  middleware: [...canWrite('settings'), singleFile], request: { file: '(binary)' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const field = svc.UPLOAD_FIELDS[req.params.field];
    if (!field) throw badRequest(`Unknown upload field ${req.params.field}; use one of ${Object.keys(svc.UPLOAD_FIELDS).join(', ')}`);
    const stored = await svc.storeImage(req.file, field === 'logoUrl' ? 'logo' : 'favicon', req.user.id, field);
    await setSetting(svc.FIELD_KEYS[field], stored.url, req.user.id);
    await audit(req, { entity: 'system-settings', entityId: field, action: 'upload', after: stored });
    ok(res, await svc.getSystemSettings(), 'File uploaded');
  },
});
define({
  method: 'GET', path: '/configuration', summary: 'Configuration catalogue: every app_settings key with group, label, type and value (drives a Configuration screen)', screen: 'Master > Configuration',
  middleware: canRead('settings'), query: { group: 'tax' },
  response: { success: true, data: { groups: [{ group: 'tax', label: 'Taxes', items: [{ key: 'tax.vat_rate', value: 0.12, label: 'VAT rate', type: 'number', editable: true, managedBy: { screen: 'Master > Finance > Premium Taxes & LGU Rates', path: '/master/finance/premium-taxes' } }] }], items: [], total: 1 } },
  handler: async (req, res) => ok(res, await svc.configurationCatalogue(req.query.group)),
});
define({
  method: 'PUT', path: '/configuration', summary: 'Update configuration values ({ settings: { key: value } } or { items: [{ key, value }] }); values are type-checked; settings owned by another screen are refused', screen: 'Master > Configuration',
  middleware: canWrite('settings'), request: { settings: { 'limits.bulk_upload_max_rows': 1000, 'notification.email_enabled': true } },
  response: { success: true, data: { groups: [], items: [], total: 0 } },
  handler: async (req, res) => {
    const b = req.body || {};
    const changes = b.settings && typeof b.settings === 'object' ? b.settings
      : Array.isArray(b.items) ? Object.fromEntries(b.items.map((i) => [i.key, i.value])) : null;
    if (!changes) throw badRequest('Send { settings: { key: value } } or { items: [{ key, value }] }');
    const { before, after } = await svc.updateConfiguration(changes, req.user.id);
    await audit(req, { entity: 'settings', action: 'update', before, after });
    ok(res, await svc.configurationCatalogue(), 'Configuration saved');
  },
});

export default router;
export const mount = '/system-settings';
