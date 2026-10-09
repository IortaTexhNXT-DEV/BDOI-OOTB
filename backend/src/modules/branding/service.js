/**
 * Broker branding: the theme (setting branding.theme), its validation (allowed values, WCAG AA contrast), the public
 * branding payload the front end applies before and after sign-in, the branding images (application logo, favicon,
 * sign-in panel) and the document branding read by every printed document and report file.
 *
 * One source for everything a broker sees: change the theme or the logo here and the screens (on the next navigation),
 * the documents and the reports follow without a rebuild.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { config } from '../../config.js';
import { one, query } from '../../db/pool.js';
import { getSetting, setSetting } from '../../lib/settings.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { clearLetterheadCache, getLetterhead, primaryCompany, resolveLogo } from '../../lib/letterhead.js';
import { renderTemplate } from '../../lib/template.js';
import { inflateEntry } from '../../lib/uploadLimits.js';
import { findDocument, keyFromUrlOrKey, objectExists, resolveKey } from '../uploads/storage.js';
import { detectType } from '../uploads/fileTypes.js';
import { DEFAULT_THEME, PRESETS, FONTS, SCHEMA, LOGIN_LIBRARY, googleFontUrl, presetList } from './presets.js';
import { contrastChecks, isHex, normHex } from './contrast.js';

export { presetList, FONTS, LOGIN_LIBRARY, SCHEMA };

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Branding images a theme refers to: name -> setting key or theme path. */
export const ASSETS = {
  logo: { setting: 'branding.logo_url', label: 'Application logo' },
  favicon: { setting: 'branding.favicon_url', label: 'Favicon' },
  'login-panel': { theme: ['login', 'panelImageUrl'], label: 'Sign-in panel image' },
};

/** Values of the older login settings of this release's first drafts ('default-art', 'gradient'). */
const LOGIN_PANEL_ALIASES = { 'default-art': 'library', gradient: 'color' };

/** One field value of a stored theme, coerced by its schema type; undefined when missing or not valid. */
function fieldValue(def, v) {
  if (v === undefined || v === null) return undefined;
  switch (def.type) {
    case 'color': return normHex(v) || undefined;
    case 'color?': return v === '' ? '' : normHex(v) || undefined;
    case 'enum': return def.values.includes(v) ? v : undefined;
    case 'int': { const n = Number(v); return v !== '' && Number.isInteger(n) && n >= def.min && n <= def.max ? n : undefined; }
    case 'bool': return typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : undefined;
    case 'text': return typeof v === 'string' || typeof v === 'number' ? str(v).slice(0, def.max) : undefined;
    case 'image': return typeof v === 'string' ? str(v) : undefined;
    default: return undefined;
  }
}

/**
 * The full theme: the stored theme (any part may be missing) over its preset over the default. A broker that never
 * saved a theme keeps the colours of the older System Settings primary / secondary colour fields.
 */
export function resolveTheme(stored, legacy = {}) {
  const s = isObj(stored) ? clone(stored) : {};
  if (isObj(s.login) && LOGIN_PANEL_ALIASES[s.login.panel]) s.login.panel = LOGIN_PANEL_ALIASES[s.login.panel];
  const base = PRESETS[s.preset] || DEFAULT_THEME;
  const t = clone(base);
  if (s.preset === 'custom') t.preset = 'custom';
  if (str(s.name)) t.name = str(s.name).slice(0, 80);
  if (!isObj(stored) || !Object.keys(stored).length) {
    // never saved: the System Settings colours of earlier releases
    const p = normHex(legacy.primary);
    const sec = normHex(legacy.secondary);
    if (p && p !== DEFAULT_THEME.colors.primary) Object.assign(t.colors, { primary: p, buttonBg: p, link: p, focusRing: p });
    if (sec && sec !== DEFAULT_THEME.colors.secondary) Object.assign(t.colors, { secondary: sec, buttonHoverBg: sec, primaryDark: sec });
  }
  if (FONTS[s.font]) t.font = s.font;
  for (const [section, fields] of Object.entries(SCHEMA)) {
    if (!isObj(s[section])) continue;
    for (const [k, def] of Object.entries(fields)) {
      const v = fieldValue(def, s[section][k]);
      if (v !== undefined) t[section][k] = v;
    }
  }
  return t;
}

/** The theme in force (resolved), from branding.theme and the legacy colour settings. */
export async function currentTheme() {
  const stored = await getSetting('branding.theme', null);
  return resolveTheme(stored, { primary: await getSetting('branding.primary_color', null), secondary: await getSetting('branding.secondary_color', null) });
}

/** Own asset path or a path of the front end (no other host: a theme cannot make browsers call a third party). */
const isLocalImageRef = (v) => !v || /^\/[A-Za-z0-9._\-/]+$/.test(v) || v.startsWith(`${config.publicBaseUrl}/api/branding/assets/`) || /\/api\/s3\/object\/[A-Za-z0-9._\-/]+$/.test(v.split('?')[0]);

/**
 * Validate a theme sent by the layout screens or a brand pack. Unknown values are refused (not ignored):
 * colours must be hex, the font must be one of FONTS, numbers within their range, texts within their length, images
 * uploaded (never another web site); text on the buttons, the header and the table header must reach WCAG AA.
 * Returns { theme (resolved), errors, warnings, checks }.
 */
export function validateTheme(input) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });
  const s = isObj(input) ? clone(input) : {};
  if (!isObj(input)) add('theme', 'Theme must be an object');
  if (isObj(s.login) && LOGIN_PANEL_ALIASES[s.login.panel]) s.login.panel = LOGIN_PANEL_ALIASES[s.login.panel];
  if (s.preset !== undefined && s.preset !== 'custom' && !PRESETS[s.preset]) add('preset', `Unknown preset ${s.preset}; use one of ${[...Object.keys(PRESETS), 'custom'].join(', ')}`);
  if (s.name !== undefined && str(s.name).length > 80) add('name', 'Theme name is at most 80 characters');
  if (s.font !== undefined && !FONTS[s.font]) add('font', `Font must be one of ${Object.keys(FONTS).join(', ')} (Google Fonts only from fonts.googleapis.com, through this list)`);
  for (const [section, fields] of Object.entries(SCHEMA)) {
    if (s[section] === undefined) continue;
    if (!isObj(s[section])) { add(section, `${section} must be an object`); continue; }
    for (const [k, v] of Object.entries(s[section])) {
      const def = fields[k];
      const path = `${section}.${k}`;
      if (!def) { add(path, 'Unknown setting'); continue; }
      if (v === undefined || v === null) continue;
      if (def.type === 'color' && !isHex(v)) add(path, 'must be a hex colour such as #0072d8');
      else if (def.type === 'color?' && v !== '' && !isHex(v)) add(path, 'must be a hex colour or empty');
      else if (def.type === 'enum' && !def.values.includes(v)) add(path, `must be one of ${def.values.join(', ')}`);
      else if (def.type === 'int' && (!Number.isInteger(Number(v)) || v === '' || Number(v) < def.min || Number(v) > def.max)) add(path, `must be a whole number from ${def.min} to ${def.max}`);
      else if (def.type === 'bool' && typeof v !== 'boolean' && !['true', 'false'].includes(v)) add(path, 'must be true or false');
      else if (def.type === 'text') {
        if (str(v).length > def.max) add(path, `is at most ${def.max} characters`);
        else if (/[<>]/.test(str(v))) add(path, 'cannot contain < or >');
      } else if (def.type === 'image' && !isLocalImageRef(str(v))) add(path, 'Upload the image (images from other web sites are not allowed)');
    }
  }
  if (isObj(s.login) && s.login.panel === 'image' && !str(s.login.panelImageUrl)) add('login.panelImageUrl', 'Upload the sign-in picture or choose a library picture or a colour');
  const theme = resolveTheme(s);
  // the document colours that are empty follow documents.accent_color; checked with the default accent
  const forCheck = { ...theme, documents: { ...theme.documents, accentColor: theme.documents.accentColor || '#1f4e79' } };
  const checks = contrastChecks(forCheck);
  for (const c of checks.filter((x) => !x.ok && x.blocking)) add(`contrast.${c.key}`, `${c.label}: contrast ${c.ratio}:1 is below WCAG AA ${c.required}:1`);
  const warnings = checks.filter((x) => !x.ok && !x.blocking).map((c) => ({ path: `contrast.${c.key}`, message: `${c.label}: contrast ${c.ratio}:1 is below WCAG AA ${c.required}:1` }));
  return { theme, errors, warnings, checks };
}

/** Save a theme (validated; refused when it fails AA). Keeps the legacy colour settings in step. */
export async function saveTheme(input, userId) {
  const { theme, errors, warnings, checks } = validateTheme(input);
  if (errors.length) throw badRequest('The theme was not saved', errors);
  await setSetting('branding.theme', theme, userId);
  await setSetting('branding.primary_color', theme.colors.primary, userId);
  await setSetting('branding.secondary_color', theme.colors.secondary, userId);
  return { theme, warnings, checks };
}

// ---------- branding images ----------

/** Storage key of a stored image reference (uploaded object URL / key), else null (a front-end path such as /bdoi/x.png). */
const storageKeyOf = (ref) => {
  const s = str(ref);
  if (!s || (s.startsWith('/') && !s.includes('/api/s3/object/'))) return null;
  if (s.includes('/api/branding/assets/')) return null;
  const key = keyFromUrlOrKey(s);
  return key && objectExists(key) ? key : null;
};

/** Bytes of a branding image stored in the uploads storage; null for an empty reference, a front-end path or a missing file. */
export function storedImageBytes(ref) {
  const key = storageKeyOf(ref);
  return key ? fs.readFileSync(resolveKey(key)) : null;
}

async function assetRef(name, theme) {
  const a = ASSETS[name];
  if (!a) return '';
  if (a.setting) return str(await getSetting(a.setting, ''));
  return str(a.theme.reduce((o, k) => o?.[k], theme));
}

/** URL the browser loads an image from: a stored file through /api/branding/assets/<name> (public, versioned), a front-end path as is. */
async function assetUrl(name, ref) {
  const key = storageKeyOf(ref);
  if (!key) return str(ref).includes('/api/branding/assets/') ? '' : str(ref);
  const v = crypto.createHash('sha1').update(key).digest('hex').slice(0, 10);
  return `${config.publicBaseUrl}/api/branding/assets/${name}?v=${v}`;
}

/** { file, contentType } of a branding image; 404 when it is not a stored file. */
export async function brandingAsset(name) {
  if (!ASSETS[name]) throw notFound('Unknown branding image');
  const key = storageKeyOf(await assetRef(name, await currentTheme()));
  if (!key) throw notFound('No stored image');
  const doc = await findDocument(key);
  const type = String(doc?.content_type || '').toLowerCase();
  if (!/^image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon|svg\+xml)$/.test(type)) throw notFound('Not an image');
  return { file: resolveKey(key), contentType: type };
}

/**
 * An SVG accepted as a branding image: plain drawing only. Refused (not cleaned): scripts, event handlers, foreign
 * objects, entities / DOCTYPE, external references and javascript: URLs. The images are served with a sandbox CSP too.
 */
export function assertSafeSvg(buffer) {
  const text = Buffer.from(buffer).toString('utf8');
  const bad = [/<\s*script\b/i, /\son[a-z]+\s*=/i, /<\s*foreignObject\b/i, /<!ENTITY/i, /<!DOCTYPE/i, /javascript:/i,
    /(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:(?!image\/(?:png|jpeg|webp|gif)))/i, /<\s*(?:iframe|embed|object|audio|video)\b/i, /@import/i, /url\(\s*["']?\s*(?:https?:|\/\/)/i];
  if (bad.some((re) => re.test(text))) throw badRequest('The SVG contains scripts, event handlers or external references; export it as a plain drawing (or upload PNG / JPG / WebP)');
}

/** Upload rules of the branding images: allowed types and size per image. */
export const UPLOAD_RULES = {
  logo: { types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], maxBytes: 2 * 1024 * 1024 },
  favicon: { types: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'], maxBytes: 512 * 1024 },
  'login-panel': { types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], maxBytes: 5 * 1024 * 1024 },
};

/** Check a branding image upload (type by signature, size, safe SVG); returns the detected type. */
export function assertBrandImage(asset, file) {
  const rule = UPLOAD_RULES[asset];
  if (!rule) throw badRequest(`Unknown branding image ${asset}`);
  if (!file?.buffer?.length) throw badRequest('file is required (multipart field "file")');
  if (file.buffer.length > rule.maxBytes) throw badRequest(`The image is larger than ${Math.round(rule.maxBytes / 1024)} KB`);
  const type = detectType(file.buffer, file.originalname || '');
  if (!type || !rule.types.includes(type)) throw badRequest(`${type || 'This file type'} is not allowed here; use ${rule.types.map((t) => t.split('/')[1].replace('svg+xml', 'svg').replace('vnd.microsoft.icon', 'ico')).join(', ')}`);
  if (type === 'image/svg+xml') assertSafeSvg(file.buffer);
  return type;
}

// ---------- public payload ----------

/**
 * What the front end needs to brand the sign-in page and the application: GET /api/branding (public). Returns
 * { body, etag }; the ETag changes whenever the theme, a logo or the names change.
 */
export async function publicBranding() {
  const theme = await currentTheme();
  const logoRef = str(await getSetting('branding.logo_url', '')) || str(await getSetting('branding.default_logo_url', '/bdoi/iorta-technxt.png'));
  const lh = await getLetterhead().catch(() => ({}));
  const body = {
    systemName: str(await getSetting('general.system_name', 'BrokerVerse')) || 'BrokerVerse',
    companyName: lh.name || str(await getSetting('general.company_name', null)),
    logoUrl: await assetUrl('logo', logoRef),
    faviconUrl: await assetUrl('favicon', await getSetting('branding.favicon_url', '/favicon.ico')),
    fontUrl: googleFontUrl(theme.font),
    fontStack: FONTS[theme.font]?.stack || FONTS.nunito.stack,
    theme: { ...theme, login: { ...theme.login, panelImageUrl: await assetUrl('login-panel', theme.login.panelImageUrl), libraryUrl: LOGIN_LIBRARY[theme.login.library]?.file || LOGIN_LIBRARY.philippines.file } },
  };
  const etag = `"${crypto.createHash('sha1').update(JSON.stringify(body)).digest('base64url').slice(0, 27)}"`;
  return { body: { ...body, version: etag.replace(/"/g, '') }, etag };
}

// ---------- document branding ----------

/**
 * A footer line with its placeholders filled from the primary company ({{licence}}, {{tin}}, {{companyName}},
 * {{address}}); a line that names the licence number (or TIN) is left out while the company has none.
 */
export function fillLine(text, lh = {}) {
  let line = str(text);
  if (/\{\{\s*licen[cs]e\s*\}\}/.test(line) && !lh.licence) return '';
  if (/\{\{\s*tin\s*\}\}/.test(line) && !lh.tin) return '';
  line = renderTemplate(line, { licence: lh.licence, license: lh.licence, tin: lh.tin, companyName: lh.name, address: (lh.addressLines || []).join(', ') }, { html: false });
  return line.replace(/^[\s|,-]+|[\s|,-]+$/g, '');
}

/**
 * Branding of printed documents and report files: colours, the footer line (placeholders filled from the primary
 * company), whether the logo prints, the logo height and the Excel header colours. `letterhead` is lib/letterhead.js.
 */
export async function documentBranding(letterhead = null, theme = null) {
  const t = theme || await currentTheme();
  const d = t.documents || {};
  const legacyAccent = normHex(await getSetting('documents.accent_color', '#1f4e79')) || '#1f4e79';
  const accent = normHex(d.accentColor) || legacyAccent;
  const lh = letterhead || await getLetterhead().catch(() => ({}));
  const footer = fillLine(d.footerText, lh);
  return {
    accent,
    headingColor: normHex(d.headingColor) || accent,
    headingBg: normHex(d.headingBg) || '#e9eff5',
    tableHeaderBg: normHex(d.tableHeaderBg) || accent,
    tableHeaderText: normHex(d.tableHeaderText) || '#ffffff',
    footerText: footer,
    reportFooterText: fillLine(d.reportFooterText, lh),
    showLogo: d.showLogo !== false,
    logoHeight: Number(t.logo?.documentHeight) || 46,
    excel: { headerBg: normHex(d.excelHeaderBg) || '#1f4e78', headerText: normHex(d.excelHeaderText) || '#ffffff', logo: d.excelLogo !== false },
    themeName: t.name,
  };
}

// ---------- e-mail branding ----------

const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Wrap an e-mail body in the broker's layout (Master > System Configuration > E-mail Layout): a header band with the logo (attached
 * inline, cid:brand-logo) or the company name, the body, and the footer line. Applied when the message is sent, so a
 * queued message carries the branding in force. Returns { html, attachments } (nodemailer attachments).
 * `logoAs: 'data'` embeds the logo as a data URI instead (the preview on screen).
 */
export async function emailLayout(bodyHtml, { theme = null, logoAs = 'cid' } = {}) {
  const t = theme || await currentTheme();
  const e = t.email || DEFAULT_THEME.email;
  const html = String(bodyHtml ?? '');
  if (e.enabled === false || /data-bv-layout|<html[\s>]/i.test(html)) return { html, attachments: [] };
  const lh = await getLetterhead().catch(() => ({}));
  const attachments = [];
  let brand = `<span style="font-size:18px;font-weight:700;color:${e.headerText}">${escHtml(lh.name || (await getSetting('general.system_name', 'BrokerVerse')))}</span>`;
  if (e.showLogo !== false && lh.logo?.buffer) {
    const type = lh.logo.type === 'jpeg' ? 'image/jpeg' : 'image/png';
    const src = logoAs === 'data' ? `data:${type};base64,${lh.logo.buffer.toString('base64')}` : 'cid:brand-logo';
    if (logoAs !== 'data') attachments.push({ filename: `logo.${lh.logo.type === 'jpeg' ? 'jpg' : 'png'}`, content: lh.logo.buffer, contentType: type, cid: 'brand-logo' });
    brand = `<img src="${src}" alt="${escHtml(lh.name || '')}" height="40" style="height:40px;width:auto;display:block;border:0">`;
  }
  const footer = fillLine(e.footerText, lh);
  const font = FONTS[t.font]?.stack || FONTS.nunito.stack;
  const out = `<div data-bv-layout="1" style="background:#f4f5f7;padding:24px 0;font-family:${escHtml(font)}">`
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse">'
    + `<tr><td style="background:${e.headerBg};padding:16px 24px;border-bottom:3px solid ${e.accentColor}">${brand}</td></tr>`
    + `<tr><td style="padding:24px;color:#2e2e2e;font-size:14px;line-height:1.5">${html}</td></tr>`
    + (footer ? `<tr><td style="padding:12px 24px;border-top:1px solid #e4e4e4;color:#656565;font-size:11px">${escHtml(footer)}</td></tr>` : '')
    + '</table></div>';
  return { html: out, attachments };
}

// ---------- brand packs ----------

export const PACK_FORMAT = 'brokerverse-brand-pack';

/** Bytes and type of an image reference (stored file or a front-end asset shipped in backend/assets). */
async function imageBytes(ref) {
  const key = storageKeyOf(ref);
  if (key) {
    const doc = await findDocument(key);
    return { buffer: fs.readFileSync(resolveKey(key)), contentType: doc?.content_type || 'application/octet-stream', fileName: doc?.file_name || key.split('/').pop() };
  }
  const img = str(ref) ? await resolveLogo(ref) : null;
  return img ? { buffer: img.buffer, contentType: img.type === 'png' ? 'image/png' : 'image/jpeg', fileName: str(ref).split('/').pop() } : null;
}

/**
 * The brand pack of this environment: { manifest, files: [{ name, buffer, contentType }] }. The manifest carries the
 * theme, the application name and the file names of the images (logo, favicon, sign-in panel, document logo).
 */
export async function exportBrandPack({ name } = {}) {
  const theme = await currentTheme();
  const files = [];
  const assets = {};
  const add = async (role, ref) => {
    const img = await imageBytes(ref).catch(() => null);
    if (!img) return;
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' }[img.contentType] || 'bin';
    const file = `${role}.${ext}`;
    files.push({ name: file, buffer: img.buffer, contentType: img.contentType });
    assets[role] = file;
  };
  await add('logo', await getSetting('branding.logo_url', ''));
  await add('favicon', await getSetting('branding.favicon_url', '/favicon.ico'));
  if (theme.login.panelImageUrl) await add('loginPanel', theme.login.panelImageUrl);
  const company = await primaryCompany().catch(() => null);
  if (company?.data?.Logo) await add('documentLogo', company.data.Logo);
  const manifest = {
    format: PACK_FORMAT, version: 1, name: str(name) || theme.name, exportedAt: new Date().toISOString(),
    systemName: str(await getSetting('general.system_name', 'BrokerVerse')), theme: { ...theme, login: { ...theme.login, panelImageUrl: '' } }, assets,
  };
  return { manifest, files };
}

/** A brand pack as one JSON document (images embedded as base64). */
export async function exportBrandPackJson(opts) {
  const { manifest, files } = await exportBrandPack(opts);
  return { ...manifest, files: Object.fromEntries(files.map((f) => [f.name, { contentType: f.contentType, base64: f.buffer.toString('base64') }])) };
}

/**
 * Read a brand pack: a .zip (theme.json + image files) or a JSON document (images as base64). Returns
 * { manifest, files: Map(name -> Buffer) }.
 */
export function parseBrandPack(buffer, fileName = '') {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const files = new Map();
  let manifest;
  if (buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50) {
    const zip = readZipBuffers(buf);
    const mf = zip.get('theme.json') || zip.get('brand-pack.json') || zip.get('manifest.json');
    if (!mf) throw badRequest('The brand pack .zip has no theme.json');
    try { manifest = JSON.parse(mf.toString('utf8')); } catch { throw badRequest('theme.json is not valid JSON'); }
    for (const n of zip.names) if (!/\.json$|\.md$|\.txt$|\/$/i.test(n)) files.set(n.split('/').pop(), zip.get(n));
  } else {
    try { manifest = JSON.parse(buf.toString('utf8')); } catch { throw badRequest(`${fileName || 'The file'} is neither a brand pack .zip nor brand pack JSON`); }
    for (const [n, f] of Object.entries(isObj(manifest.files) ? manifest.files : {})) if (f?.base64) files.set(n, Buffer.from(f.base64, 'base64'));
  }
  if (!isObj(manifest) || manifest.format !== PACK_FORMAT) throw badRequest(`Not a brand pack: theme.json must have "format": "${PACK_FORMAT}"`);
  if (!isObj(manifest.theme)) throw badRequest('The brand pack has no theme');
  for (const [role, file] of Object.entries(manifest.assets || {})) if (file && !files.has(file)) throw badRequest(`The brand pack names ${role} file ${file} but does not contain it`);
  return { manifest, files };
}

/** Entries of a zip as Buffers (stored or deflated), size-capped like every other upload. */
function readZipBuffers(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw badRequest('Not a valid .zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count && n < 50; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { method, csize, local });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return {
    names: [...entries.keys()],
    get: (name) => {
      const e = entries.get(name);
      if (!e) return null;
      const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
      const data = buf.subarray(start, start + e.csize);
      return inflateEntry(data, e.method);
    },
  };
}

/**
 * Apply a brand pack: validate its theme (refused like a theme saved on screen), store its images (type and size
 * checked), then save the theme, the logo, the favicon and the sign-in panel; `documentLogo` also becomes the print
 * logo of the primary company (Master > Company) unless applyDocumentLogo is false. dryRun validates only.
 */
export async function importBrandPack({ manifest, files }, { userId = null, dryRun = false, applyDocumentLogo = true, applySystemName = true, storeImage }) {
  const login = manifest.theme.login || {};
  const { theme, errors, warnings, checks } = validateTheme({ ...manifest.theme, login: { ...login, panelImageUrl: '', panel: login.panel === 'image' ? 'library' : login.panel } });
  if (errors.length) throw badRequest('The brand pack theme was not accepted', errors);
  const assets = manifest.assets || {};
  const summary = { name: str(manifest.name) || theme.name, theme, warnings, checks, assets: Object.keys(assets).filter((k) => assets[k]), dryRun: !!dryRun, applied: [] };
  if (dryRun) return summary;
  const stored = {};
  for (const [role, file] of Object.entries(assets)) {
    if (!file) continue;
    const buffer = files.get(file);
    stored[role] = (await storeImage({ buffer, originalname: file, size: buffer.length }, role === 'favicon' ? 'favicon' : 'logo', userId, `brand-pack:${role}`)).url;
  }
  if (stored.loginPanel) theme.login = { ...theme.login, panel: 'image', panelImageUrl: stored.loginPanel };
  if (theme.login.panel === 'image' && !theme.login.panelImageUrl) theme.login.panel = 'library';
  await saveTheme(theme, userId);
  summary.applied.push('theme');
  if (stored.logo) { await setSetting('branding.logo_url', stored.logo, userId); summary.applied.push('logo'); }
  if (stored.favicon) { await setSetting('branding.favicon_url', stored.favicon, userId); summary.applied.push('favicon'); }
  if (applySystemName && str(manifest.systemName)) { await setSetting('general.system_name', str(manifest.systemName).slice(0, 120), userId); summary.applied.push('systemName'); }
  if (stored.documentLogo && applyDocumentLogo) {
    const company = await primaryCompany().catch(() => null);
    if (company) {
      await query(`UPDATE master_records SET data = jsonb_set(data, '{Logo}', to_jsonb($2::text)), updated_by = $3, updated_at = now() WHERE id = $1`, [company.id, stored.documentLogo, userId]);
      clearLetterheadCache();
      summary.applied.push('documentLogo');
    }
  }
  summary.theme = (await currentTheme());
  return summary;
}

/** Name of the primary company record, for the import confirmation. */
export async function primaryCompanyName() {
  const c = await one(`SELECT name FROM master_records WHERE type_code = 'company' AND status = 'active' ORDER BY (lower(COALESCE(data->>'IsPrimary', 'false')) IN ('true', 'yes', '1')) DESC, id LIMIT 1`).catch(() => null);
  return c?.name || null;
}
