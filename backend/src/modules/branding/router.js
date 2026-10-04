/**
 * Broker branding (Master > System Settings > Theme and Branding): the public branding payload (sign-in page and app
 * shell, with ETag), the branding images, the theme editor endpoints, a sample document and e-mail with an unsaved
 * theme, brand pack export / import (onboarding a broker, promoting branding between environments) and the bundled
 * brand packs shipped with the product (listed, checked, enabled with the trademark acknowledgement, back to default).
 */
import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting, setSetting } from '../../lib/settings.js';
import { ok } from '../../lib/respond.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { createZip } from '../../lib/zip.js';
import { canRead, canWrite, saveFile } from '../masters/helpers.js';
import { sendPdf } from '../../lib/pdf/index.js';
import * as svc from './service.js';
import * as bundled from './bundled.js';
import { samplePdf } from './sample.js';

const { router, define } = moduleRouter('Branding', '/branding');
const upload = memoryUpload({ files: 1 });
const singleFile = (req, res, next) => upload.single('file')(req, res, (e) => next(e ? badRequest(e.message) : undefined));
const SCREEN = 'Master > System Settings > Theme and Branding';
const truthy = (v) => v === true || ['true', '1', 'yes', 'on'].includes(String(v ?? '').toLowerCase());

const themeExample = { preset: 'iorta-technxt', name: 'iorta TechNXT (default)', colors: { primary: '#0072d8', headerBg: '#ffffff', headerText: '#2e2e2e', tableHeaderBg: '#004ea8', tableHeaderText: '#ffffff' },
  layout: { headerStyle: 'light', sidebarStyle: 'light', density: 'comfortable', tableHeaderStyle: 'solid' }, font: 'nunito', radius: { sm: 8, md: 12, lg: 16, button: 8 },
  logo: { appHeight: 36, loginHeight: 56, documentHeight: 46 },
  login: { panel: 'library', library: 'philippines', panelImageUrl: '', focalX: 50, focalY: 50, overlay: 0, showOnMobile: false, headline: '', tagline: '' },
  documents: { accentColor: '', footerText: 'Authorized by the Insurance Commission to act as an Insurance Broker, Licence No. {{licence}}' },
  email: { enabled: true, headerBg: '#ffffff', headerText: '#2e2e2e', accentColor: '#0072d8', showLogo: true, footerText: '{{companyName}} | {{address}}' } };

/** Store a branding image (type, size and SVG checked) in the uploads storage; returns { url, key, fileName }. */
async function storeBrandImage(asset, file, userId) {
  const contentType = svc.assertBrandImage(asset, file);
  return saveFile({ category: asset === 'favicon' ? 'favicon' : 'logo', fileName: file.originalname || `${asset}.png`, content: file.buffer, contentType, entity: 'branding', entityId: asset, userId });
}

define({
  method: 'GET', path: '/', auth: false, summary: 'Branding of this environment: theme (colours, layout, font, radius, logo sizes, sign-in page, documents, e-mail), logo, favicon, names. Public (the sign-in page uses it); ETag / If-None-Match answers 304 when unchanged',
  screen: 'Sign-in; App shell (applied on every navigation)',
  response: { success: true, data: { systemName: 'BrokerVerse', companyName: 'iorta TechNXT Insurance Brokers, Inc.', logoUrl: '/bdoi/iorta-technxt.png', faviconUrl: '/favicon.ico', fontUrl: null, fontStack: '"Nunito", Arial, sans-serif', theme: themeExample, version: 'k3j...' } },
  handler: async (req, res) => {
    const { body, etag } = await svc.publicBranding();
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    if (req.headers['if-none-match'] === etag) { res.status(304).end(); return; }
    res.json({ success: true, data: body });
  },
});
define({
  method: 'GET', path: '/assets/:name', auth: false, summary: 'A branding image (logo, favicon, login-panel) uploaded for this environment; public, versioned by ?v=',
  screen: 'Sign-in; App shell', response: '(image)',
  handler: async (req, res) => {
    const a = await svc.brandingAsset(req.params.name);
    res.type(a.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.sendFile(a.file);
  },
});

const editorPayload = async () => {
  const stored = await getSetting('branding.theme', null);
  const theme = await svc.currentTheme();
  const { checks, warnings } = svc.validateTheme(theme);
  const pub = (await svc.publicBranding()).body;
  return { theme, saved: !!(stored && Object.keys(stored).length), presets: svc.presetList(), fonts: Object.entries(svc.FONTS).map(([key, f]) => ({ key, ...f })),
    loginLibrary: Object.entries(svc.LOGIN_LIBRARY).map(([key, l]) => ({ key, ...l })), uploadRules: svc.UPLOAD_RULES, checks, warnings,
    systemName: pub.systemName, logoUrl: pub.logoUrl, faviconUrl: pub.faviconUrl, loginPanelUrl: pub.theme.login.panelImageUrl,
    company: await svc.primaryCompanyName(), documentBranding: await svc.documentBranding(null, theme) };
};

define({
  method: 'GET', path: '/theme', summary: 'Theme editor: the theme in force, presets, fonts, sign-in picture library, upload rules, contrast checks, application name and images', screen: SCREEN, middleware: canRead('settings'),
  response: { success: true, data: { theme: themeExample, saved: true, presets: [{ key: 'classic-blue', name: 'Classic Blue', theme: themeExample }], fonts: [{ key: 'nunito', label: 'Nunito (bundled, default)' }],
    loginLibrary: [{ key: 'motor', label: 'Motor: road and city', file: '/brand/library/motor.svg' }], checks: [], warnings: [], systemName: 'BrokerVerse' } },
  handler: async (_req, res) => ok(res, await editorPayload()),
});
define({
  method: 'POST', path: '/theme/validate', summary: 'Check a theme without saving it: resolved theme, errors (refused: AA failures on buttons, header, table header) and warnings', screen: `${SCREEN} > Live preview`,
  middleware: canRead('settings'), request: { theme: themeExample }, response: { success: true, data: { theme: themeExample, errors: [], warnings: [], checks: [{ key: 'headerText', ratio: 12.6, required: 4.5, ok: true }] } },
  handler: async (req, res) => ok(res, svc.validateTheme(req.body?.theme || req.body || {})),
});
define({
  method: 'PUT', path: '/theme', summary: 'Save the theme ({ theme, systemName? }); every signed-in user gets it on the next navigation, documents, reports and e-mails at once. Refused when text on the buttons, header or table header fails WCAG AA',
  screen: SCREEN, middleware: canWrite('settings'), request: { theme: themeExample, systemName: 'BrokerVerse' }, response: { success: true, data: { theme: themeExample, warnings: [], checks: [] } },
  handler: async (req, res) => {
    const body = req.body || {};
    const before = await svc.currentTheme();
    const name = body.systemName === undefined ? undefined : String(body.systemName).trim();
    if (name !== undefined && (!name || name.length > 120 || /[<>]/.test(name))) throw badRequest('Validation failed', [{ path: 'systemName', message: 'Application name is required (max 120 characters, no < or >)' }]);
    const saved = await svc.saveTheme(body.theme || (body.colors ? body : {}), req.user.id);
    if (name !== undefined) await setSetting('general.system_name', name, req.user.id);
    await audit(req, { entity: 'branding', entityId: 'theme', action: 'update', before, after: { theme: saved.theme, ...(name !== undefined ? { systemName: name } : {}) } });
    ok(res, { ...(await editorPayload()), warnings: saved.warnings }, 'Theme saved');
  },
});
define({
  method: 'POST', path: '/upload/:asset', summary: 'Upload a branding image (multipart "file"): logo (PNG/JPG/WebP/SVG, 2 MB), favicon (PNG/ICO/SVG, 512 KB) or login-panel (sign-in picture: PNG/JPG/WebP/SVG, 5 MB); SVG must be a plain drawing',
  screen: `${SCREEN} > Upload`, middleware: [...canWrite('settings'), singleFile], request: { file: '(binary)' }, response: { success: true, data: { theme: themeExample } },
  handler: async (req, res) => {
    const asset = req.params.asset;
    if (!svc.ASSETS[asset]) throw badRequest(`Unknown branding image ${asset}; use logo, favicon or login-panel`);
    const stored = await storeBrandImage(asset, req.file, req.user.id);
    if (asset === 'login-panel') {
      const theme = await svc.currentTheme();
      await svc.saveTheme({ ...theme, login: { ...theme.login, panel: 'image', panelImageUrl: stored.url } }, req.user.id);
    } else {
      await setSetting(svc.ASSETS[asset].setting, stored.url, req.user.id);
    }
    await audit(req, { entity: 'branding', entityId: asset, action: 'upload', after: { key: stored.key, fileName: stored.fileName } });
    ok(res, await editorPayload(), 'Image uploaded');
  },
});
define({
  method: 'DELETE', path: '/upload/:asset', summary: 'Go back to the default image (logo: the default logo; favicon: the default icon; login-panel: the picture library)', screen: `${SCREEN} > Reset image`,
  middleware: canWrite('settings'), response: { success: true, data: { theme: themeExample } },
  handler: async (req, res) => {
    const asset = req.params.asset;
    if (!svc.ASSETS[asset]) throw badRequest(`Unknown branding image ${asset}`);
    if (asset === 'login-panel') {
      const theme = await svc.currentTheme();
      await svc.saveTheme({ ...theme, login: { ...theme.login, panel: 'library', panelImageUrl: '' } }, req.user.id);
    } else await setSetting(svc.ASSETS[asset].setting, asset === 'favicon' ? '/favicon.ico' : '', req.user.id);
    await audit(req, { entity: 'branding', entityId: asset, action: 'reset' });
    ok(res, await editorPayload(), 'Image reset');
  },
});
define({
  method: 'POST', path: '/preview-document', summary: 'Sample document (PDF) printed with a theme that is not saved yet (body: { theme })', screen: `${SCREEN} > Sample document`,
  middleware: canRead('settings'), request: { theme: themeExample }, response: '(application/pdf)',
  handler: async (req, res) => {
    const { theme, errors } = svc.validateTheme(req.body?.theme || req.body || {});
    if (errors.length && !truthy(req.query.lenient)) throw badRequest('The theme has errors', errors);
    sendPdf(res, await samplePdf(theme), 'branding-sample.pdf');
  },
});
define({
  method: 'POST', path: '/preview-email', summary: 'Sample e-mail (HTML) in the e-mail layout of a theme that is not saved yet (body: { theme })', screen: `${SCREEN} > E-mail`,
  middleware: canRead('settings'), request: { theme: themeExample }, response: { success: true, data: { html: '<div data-bv-layout="1">...</div>' } },
  handler: async (req, res) => {
    const { theme } = svc.validateTheme(req.body?.theme || req.body || {});
    const sample = '<p>Dear Juan Dela Cruz,</p><p>Attached is the premium invoice <b>INV-2026-00012</b> for policy <b>MC-2026-00045</b>.</p><p>Thank you,</p>';
    ok(res, { html: (await svc.emailLayout(sample, { theme: { ...theme, email: { ...theme.email, enabled: true } }, logoAs: 'data' })).html });
  },
});
define({
  method: 'GET', path: '/brand-pack', summary: 'Export the brand pack of this environment (theme incl. layout, sign-in page, documents and e-mail; application name; logo, favicon, sign-in picture, print logo): format=zip (default) or json',
  screen: `${SCREEN} > Export brand pack`, middleware: canRead('settings'), query: { format: 'zip' }, response: '(application/zip | application/json)',
  handler: async (req, res) => {
    const name = String(req.query.name || '').slice(0, 80);
    const slug = (name || (await svc.currentTheme()).name || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand';
    if (String(req.query.format || 'zip').toLowerCase() === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${slug}.brandpack.json"`);
      res.json(await svc.exportBrandPackJson({ name }));
      return;
    }
    const { manifest, files } = await svc.exportBrandPack({ name });
    const zip = createZip([{ name: 'theme.json', data: JSON.stringify(manifest, null, 2) }, ...files.map((f) => ({ name: f.name, data: f.buffer }))]);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.brandpack.zip"`);
    res.end(zip);
  },
});
define({
  method: 'POST', path: '/brand-pack', summary: 'Import a brand pack (multipart "file": .zip or .json, or a JSON body). dryRun=true only validates; applyDocumentLogo=false keeps the print logo of Master > Company; applySystemName=false keeps the application name',
  screen: `${SCREEN} > Import brand pack`, middleware: [...canWrite('settings'), singleFile], query: { dryRun: true, applyDocumentLogo: true },
  request: { file: '(binary .zip or .json)' }, response: { success: true, data: { name: 'Toyota Insurance Services', applied: ['theme', 'logo', 'documentLogo'], warnings: [] } },
  handler: async (req, res) => {
    const opt = { ...req.query, ...(req.file ? req.body : {}) };
    const pack = req.file ? svc.parseBrandPack(req.file.buffer, req.file.originalname) : svc.parseBrandPack(Buffer.from(JSON.stringify(req.body || {})), 'body');
    const roleAsset = (role) => (role === 'favicon' ? 'favicon' : role === 'loginPanel' ? 'login-panel' : 'logo');
    for (const [role, file] of Object.entries(pack.manifest.assets || {})) if (file) svc.assertBrandImage(roleAsset(role), { buffer: pack.files.get(file), originalname: file });
    const before = await svc.currentTheme();
    const storeImage = async (file, _category, userId, ref) => storeBrandImage(String(ref).endsWith('favicon') ? 'favicon' : String(ref).endsWith('loginPanel') ? 'login-panel' : 'logo', file, userId);
    const result = await svc.importBrandPack(pack, { userId: req.user.id, dryRun: truthy(opt.dryRun), applyDocumentLogo: opt.applyDocumentLogo === undefined ? true : truthy(opt.applyDocumentLogo),
      applySystemName: opt.applySystemName === undefined ? true : truthy(opt.applySystemName), storeImage });
    if (!result.dryRun) await audit(req, { entity: 'branding', entityId: 'brand-pack', action: 'import', before, after: { name: result.name, applied: result.applied, theme: result.theme } });
    ok(res, result, result.dryRun ? 'Brand pack checked (nothing applied)' : `Brand pack ${result.name} applied`);
  },
});

// ---------- bundled brand packs ----------

const bundledExample = { id: 'toyota-insurance-services', name: 'Toyota Insurance Services', description: 'Client brand pack ...', trademarkOwner: 'Toyota Motor Corporation and Toyota Insurance Services (Philippines)',
  requiresWrittenPermission: true, permissionNote: 'The Toyota name ... trademarks of their owners', version: '1.0.0', systemName: 'Toyota Insurance Services', assets: ['logo', 'documentLogo'],
  preview: { primary: '#1a1a1a', headerBg: '#ffffff', sidebarBg: '#ffffff', tableHeaderBg: '#eeeeee', buttonBg: '#1a1a1a', accent: '#eb0a1e' }, theme: themeExample, warnings: [], status: 'available', enablement: null };
const enablementExample = { id: 1, packId: 'toyota-insurance-services', packName: 'Toyota Insurance Services', acknowledgedPermission: true, acknowledgementText: bundled.ACKNOWLEDGEMENT_TEXT,
  applied: ['theme', 'logo', 'documentLogo', 'systemName'], status: 'enabled', enabledAt: '2026-10-04T08:00:00.000Z', enabledBy: 'admin', enabledByName: 'System Administrator' };
const storeBundledImage = async (file, _category, userId, ref) => storeBrandImage(String(ref).endsWith('favicon') ? 'favicon' : String(ref).endsWith('loginPanel') ? 'login-panel' : 'logo', file, userId);
const enableOptions = (body) => ({ applyDocumentLogo: body.applyDocumentLogo === undefined ? true : truthy(body.applyDocumentLogo), applySystemName: body.applySystemName === undefined ? true : truthy(body.applySystemName) });

define({
  method: 'GET', path: '/packs/bundled', summary: 'Brand packs shipped with the product (backend/assets/brand-packs): manifest (name, description, trademark owner, written permission required, version), the theme, a colour preview and the status in this environment (enabled, with who and when, or available). None is enabled by default',
  screen: `${SCREEN} > Brand packs > Bundled packs`, middleware: canRead('settings'),
  response: { success: true, data: { packs: [bundledExample], current: null, defaultName: 'iorta TechNXT (default)', defaultInForce: true, acknowledgementText: bundled.ACKNOWLEDGEMENT_TEXT, history: [enablementExample] } },
  handler: async (_req, res) => ok(res, { ...(await bundled.listBundledPacks()), history: await bundled.enablementHistory() }),
});
define({
  method: 'POST', path: '/packs/bundled/:id/check', summary: 'Check a bundled brand pack without applying it (dry run): the same checks as an import (theme rules, WCAG AA contrast, image types), the resolved theme and contrast warnings',
  screen: `${SCREEN} > Brand packs > Bundled packs > Check`, middleware: canRead('settings'),
  response: { success: true, data: { name: 'Toyota Insurance Services', dryRun: true, assets: ['logo', 'documentLogo'], warnings: [], theme: themeExample, pack: bundledExample } },
  handler: async (req, res) => {
    const pack = bundled.loadBundledPack(req.params.id);
    for (const [role, file] of Object.entries(pack.manifest.assets || {})) if (file) svc.assertBrandImage(role === 'favicon' ? 'favicon' : role === 'loginPanel' ? 'login-panel' : 'logo', { buffer: pack.files.get(file), originalname: file });
    ok(res, await bundled.enableBundledPack(req.params.id, { user: req.user, dryRun: true, storeImage: storeBundledImage }), 'Brand pack checked (nothing applied)');
  },
});
define({
  method: 'POST', path: '/packs/bundled/:id/enable', summary: 'Enable a bundled brand pack through the import logic. The body must carry acknowledgedPermission: true (the administrator confirms the broker holds the written permission of the owner of the marks); the enablement is recorded (who, when, acknowledgement) and audited. applyDocumentLogo=false keeps the print logo of Master > Company; applySystemName=false keeps the application name',
  screen: `${SCREEN} > Brand packs > Bundled packs > Enable`, middleware: canWrite('settings'), request: { acknowledgedPermission: true, applyDocumentLogo: true, applySystemName: true },
  response: { success: true, data: { name: 'Toyota Insurance Services', applied: ['theme', 'logo', 'documentLogo', 'systemName'], warnings: [], theme: themeExample, pack: bundledExample, enablement: enablementExample } },
  handler: async (req, res) => {
    const body = req.body || {};
    const pack = bundled.loadBundledPack(req.params.id);
    for (const [role, file] of Object.entries(pack.manifest.assets || {})) if (file) svc.assertBrandImage(role === 'favicon' ? 'favicon' : role === 'loginPanel' ? 'login-panel' : 'logo', { buffer: pack.files.get(file), originalname: file });
    const before = await svc.currentTheme();
    const result = await bundled.enableBundledPack(req.params.id, { user: req.user, acknowledgedPermission: body.acknowledgedPermission === true, ...enableOptions(body), storeImage: storeBundledImage });
    await audit(req, { entity: 'branding', entityId: `bundled-pack:${pack.bundled.id}`, action: 'enable-pack', before,
      after: { pack: pack.bundled.id, name: pack.bundled.name, version: pack.bundled.version, trademarkOwner: pack.bundled.trademarkOwner, acknowledgedPermission: true, acknowledgementText: bundled.ACKNOWLEDGEMENT_TEXT, applied: result.applied, theme: result.theme } });
    ok(res, result, `Brand pack ${result.name} enabled`);
  },
});
define({
  method: 'POST', path: '/packs/reset-default', summary: 'Back to the iorta TechNXT default: default theme, default logo and favicon; when a bundled pack is enabled, also the application name and the print logo of the primary company as they were before it, and the enablement is closed (status reverted). Audited',
  screen: `${SCREEN} > Brand packs > Back to default`, middleware: canWrite('settings'), response: { success: true, data: { theme: themeExample, restored: ['theme', 'logo', 'favicon', 'systemName', 'documentLogo'], enablement: enablementExample } },
  handler: async (req, res) => {
    const before = await svc.currentTheme();
    const result = await bundled.resetToDefault({ user: req.user });
    await audit(req, { entity: 'branding', entityId: result.enablement ? `bundled-pack:${result.enablement.packId}` : 'theme', action: 'reset-default', before, after: { restored: result.restored, theme: result.theme, enablementId: result.enablement?.id || null } });
    ok(res, { ...result, ...(await editorPayload()) }, 'Default branding restored');
  },
});

export default router;
export const mount = '/branding';
