/**
 * Bundled brand packs: packs that ship with the product under backend/assets/brand-packs/<id>/ (manifest.json with
 * the pack's identity and trademark terms, theme.json and the images it names, built the same way as a brand pack
 * folder of docs/package/04_Onboarding_and_Go_Live/Brand_Packs). None is applied by default: a System Administrator
 * enables one through the API (POST /branding/packs/bundled/:id/enable) after acknowledging that the environment
 * belongs to the client engagement whose contract with iorta TechNXT covers the use of the marks the pack carries. The enablement is recorded (who, when, the
 * acknowledgement, the branding before it) so the broker can go back to the iorta TechNXT default at any time.
 * A deployment made for that client names its pack in BRAND_PACK instead: the API enforces it at every start
 * (enforceDeploymentPack), the first time recorded the same way with the deployment configuration as the source of the
 * acknowledgement, and while it is set the look of the screens cannot be changed through the API (assertNotEnforced).
 */
import fs from 'node:fs';
import path from 'node:path';
import { one, pool, query } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { config } from '../../config.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting, setSetting } from '../../lib/settings.js';
import { clearLetterheadCache, primaryCompany, ASSETS_DIR } from '../../lib/letterhead.js';
import { saveFile } from '../masters/helpers.js';
import { DEFAULT_THEME, SCHEMA } from './presets.js';
import { PACK_FORMAT, assertBrandImage, currentTheme, importBrandPack, saveTheme, storedImageBytes, validateTheme } from './service.js';

export const BUNDLED_DIR = path.join(ASSETS_DIR, 'brand-packs');

/** Colours shown as the preview of a pack on the screen, in this order. */
export const PREVIEW_COLORS = ['primary', 'headerBg', 'sidebarBg', 'tableHeaderBg', 'buttonBg', 'accent'];

/** The sentence the administrator acknowledges when enabling a pack (kept with the enablement record). */
export const ACKNOWLEDGEMENT_TEXT = 'This environment belongs to the client engagement whose contract with iorta TechNXT covers the use of these marks.';

/** Added to the acknowledgement of an enablement made at start-up from the BRAND_PACK variable. */
export const DEPLOYMENT_NOTE = 'Given by the deployment configuration (BRAND_PACK).';

/** Who an enablement or an application made at start-up is recorded against (no signed-in user). */
const SYSTEM_USER = { id: null, username: 'system' };

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const ID_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;

/** manifest.json of a bundled pack folder, checked; throws when it is not usable. */
function readManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  let m;
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error(`${file} is not valid JSON`); }
  const id = str(m.id);
  if (!ID_RE.test(id) || id !== path.basename(dir)) throw new Error(`${file}: "id" must be the folder name (lower-case letters, digits and dashes)`);
  if (!str(m.name)) throw new Error(`${file}: "name" is required`);
  return {
    id, name: str(m.name).slice(0, 80), description: str(m.description).slice(0, 600), trademarkOwner: str(m.trademarkOwner).slice(0, 200),
    requiresAcknowledgement: m.requiresAcknowledgement !== false, permissionBasis: str(m.permissionBasis).slice(0, 300),
    permissionNote: str(m.permissionNote).slice(0, 600),
    version: str(m.version || '1.0.0').slice(0, 20), pack: str(m.pack || 'theme.json'),
  };
}

/**
 * Read a bundled pack folder as the import logic reads an uploaded pack: { manifest (theme.json), files: Map(name ->
 * Buffer), bundled (manifest.json) }. The theme.json must have the brand pack format and name only files of the folder.
 */
export function loadBundledPack(id) {
  if (!ID_RE.test(str(id))) throw notFound('Unknown bundled brand pack');
  const dir = path.join(BUNDLED_DIR, id);
  const bundled = fs.existsSync(dir) ? readManifest(dir) : null;
  if (!bundled) throw notFound('Unknown bundled brand pack');
  const packFile = path.join(dir, path.basename(bundled.pack));
  if (!fs.existsSync(packFile)) throw new Error(`Bundled brand pack ${id}: ${bundled.pack} is missing`);
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(packFile, 'utf8')); } catch { throw new Error(`Bundled brand pack ${id}: ${bundled.pack} is not valid JSON`); }
  if (manifest?.format !== PACK_FORMAT || !manifest.theme || typeof manifest.theme !== 'object') throw new Error(`Bundled brand pack ${id}: ${bundled.pack} is not a brand pack`);
  const files = new Map();
  for (const [role, file] of Object.entries(manifest.assets || {})) {
    if (!file) continue;
    const name = path.basename(String(file));
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) throw new Error(`Bundled brand pack ${id}: ${role} file ${file} is missing`);
    files.set(name, fs.readFileSync(p));
  }
  return { manifest, files, bundled };
}

/** Ids of the bundled packs (folders of backend/assets/brand-packs with a manifest.json), sorted by name. */
export function bundledPackIds() {
  if (!fs.existsSync(BUNDLED_DIR)) return [];
  return fs.readdirSync(BUNDLED_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(BUNDLED_DIR, d.name, 'manifest.json')))
    .map((d) => d.name)
    .sort();
}

/** The enablement in force (latest row with status enabled), with the display name of who enabled it; null when none. */
export async function currentEnablement() {
  const row = await one(`SELECT e.*, u.display_name AS enabled_by_display_name
    FROM brand_pack_enablements e LEFT JOIN users u ON u.id = e.enabled_by_user_id
    WHERE e.status = 'enabled' ORDER BY e.enabled_at DESC, e.id DESC LIMIT 1`);
  return row ? enablementView(row) : null;
}

const enablementView = (r) => ({
  id: r.id, packId: r.pack_id, packName: r.pack_name, packVersion: r.pack_version, trademarkOwner: r.trademark_owner,
  acknowledgedPermission: r.acknowledged_permission, acknowledgementText: r.acknowledgement_text, applied: r.applied || [], status: r.status,
  enabledAt: r.enabled_at, enabledBy: r.enabled_by, enabledByName: r.enabled_by_display_name || r.enabled_by, revertedAt: r.reverted_at, revertedBy: r.reverted_by,
});

/** The enablement history (newest first), for the screen and the support procedures. */
export async function enablementHistory(limit = 20) {
  const { rows } = await query(`SELECT e.*, u.display_name AS enabled_by_display_name
    FROM brand_pack_enablements e LEFT JOIN users u ON u.id = e.enabled_by_user_id ORDER BY e.enabled_at DESC, e.id DESC LIMIT $1`, [Math.min(100, Math.max(1, Number(limit) || 20))]);
  return rows.map(enablementView);
}

/**
 * The bundled packs for the screen: manifest, the resolved theme (so the sample document and e-mail can preview it
 * unsaved), a colour preview, the application name the pack sets, the images it carries, and the status in this
 * environment (enabled, with who and when, or available). Also says whether the default branding is in force.
 */
export async function listBundledPacks() {
  const current = await currentEnablement();
  const packs = bundledPackIds().map((id) => {
    const { manifest, bundled } = loadBundledPack(id);
    const { theme, warnings } = validateTheme({ ...manifest.theme, login: { ...(manifest.theme.login || {}), panelImageUrl: '' } });
    const enabled = current?.packId === id;
    return {
      ...bundled, theme, systemName: str(manifest.systemName), assets: Object.keys(manifest.assets || {}).filter((k) => manifest.assets[k]),
      preview: Object.fromEntries(PREVIEW_COLORS.map((k) => [k, theme.colors[k]])), warnings,
      status: enabled ? 'enabled' : 'available', enablement: enabled ? current : null,
    };
  });
  return { packs, current, defaultName: DEFAULT_THEME.name, defaultInForce: !current, acknowledgementText: ACKNOWLEDGEMENT_TEXT };
}

/** What the branding is now, kept with an enablement so Back to default can restore the parts the pack replaced. */
async function brandingSnapshot() {
  const company = await primaryCompany().catch(() => null);
  return {
    theme: await currentTheme(),
    logoUrl: str(await getSetting('branding.logo_url', '')),
    faviconUrl: str(await getSetting('branding.favicon_url', '/favicon.ico')),
    systemName: str(await getSetting('general.system_name', 'BrokerVerse')),
    companyId: company?.id || null,
    documentLogo: company?.data?.Logo || null,
  };
}

/**
 * Enable a bundled pack: the same checks and the same application as an imported pack (importBrandPack), plus the
 * acknowledgement, which the request must carry as true, and the enablement record. Returns the import summary with
 * the enablement. dryRun checks only (nothing applied, nothing recorded). `pack` is the pack already loaded (with the
 * theme the start-up enforcement keeps the e-mail and document sections in).
 */
export async function enableBundledPack(id, { user, acknowledgedPermission, acknowledgementText = ACKNOWLEDGEMENT_TEXT, dryRun = false, applyDocumentLogo = true, applySystemName = true, storeImage, pack: loaded = null }) {
  const pack = loaded || loadBundledPack(id);
  if (!dryRun && pack.bundled.requiresAcknowledgement && acknowledgedPermission !== true) {
    throw badRequest('Acknowledge the engagement first', [{ path: 'acknowledgedPermission', message: `Tick "${ACKNOWLEDGEMENT_TEXT}" to enable ${pack.bundled.name}; the marks of this pack belong to ${pack.bundled.trademarkOwner || 'their owner'}` }]);
  }
  // the snapshot kept is the branding before any bundled pack: replacing one pack by another keeps the first one's
  const current = dryRun ? null : await currentEnablement();
  const previous = dryRun ? null : (current && (await one('SELECT previous FROM brand_pack_enablements WHERE id = $1', [current.id]))?.previous) || await brandingSnapshot();
  const result = await importBrandPack(pack, { userId: user?.id ?? null, dryRun, applyDocumentLogo, applySystemName, storeImage });
  if (dryRun) return { ...result, pack: pack.bundled };
  await query(`UPDATE brand_pack_enablements SET status = 'replaced', reverted_by_user_id = $1, reverted_by = $2, reverted_at = now() WHERE status = 'enabled'`, [user?.id ?? null, user?.username ?? null]);
  const row = await one(`INSERT INTO brand_pack_enablements(pack_id, pack_name, pack_version, trademark_owner, acknowledged_permission, acknowledgement_text, applied, previous, enabled_by_user_id, enabled_by)
    VALUES ($1, $2, $3, $4, true, $5, $6::jsonb, $7::jsonb, $8, $9) RETURNING *`,
  [pack.bundled.id, pack.bundled.name, pack.bundled.version, pack.bundled.trademarkOwner, acknowledgementText, JSON.stringify(result.applied), JSON.stringify(previous), user?.id ?? null, user?.username ?? null]);
  return { ...result, pack: pack.bundled, enablement: await currentEnablement() || enablementView(row) };
}

/** Store an image of a bundled pack (logo, favicon, sign-in picture) in the uploads storage, as an uploaded one. */
export async function storeBundledImage(file, _category, userId, ref) {
  const asset = String(ref).endsWith('favicon') ? 'favicon' : String(ref).endsWith('loginPanel') ? 'login-panel' : 'logo';
  const contentType = assertBrandImage(asset, file);
  return saveFile({ category: asset === 'favicon' ? 'favicon' : 'logo', fileName: file.originalname || `${asset}.png`, content: file.buffer, contentType, entity: 'branding', entityId: asset, userId });
}

const DEPLOYMENT_LOCK = "hashtext('brokerverse.brand_pack')";

/** The bundled pack the deployment enforces (BRAND_PACK naming a shipped pack), else ''. */
export const deploymentPackId = () => (config.brandPack && bundledPackIds().includes(config.brandPack) ? config.brandPack : '');

/** Refuse a change to the look of the screens (`what`: "The logo", ...) while the deployment enforces a brand pack. */
export function assertNotEnforced(what) {
  const id = deploymentPackId();
  if (id) throw badRequest(`${what} comes from the brand pack of the deployment (BRAND_PACK=${id}) and cannot be changed here; the e-mail and document layouts are changed on their screens`);
}

/** Theme values of the screens and the sign-in page: what a brand pack fixes (the e-mail and document sections are the broker's). */
const SCREEN_SECTIONS = ['colors', 'layout', 'radius', 'login'];
const SCREEN_LOGO = ['appHeight', 'loginHeight', 'showName'];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Paths of the screen values (name, preset, font, colours, layout, radius, sign-in page, logo sizes) where two resolved themes differ. */
export function screenDifferences(theme, reference) {
  const out = ['preset', 'name', 'font'].filter((k) => !same(theme[k], reference[k]));
  for (const section of SCREEN_SECTIONS) {
    for (const k of Object.keys(SCHEMA[section]).filter((x) => x !== 'panelImageUrl')) if (!same(theme[section]?.[k], reference[section]?.[k])) out.push(`${section}.${k}`);
  }
  for (const k of SCREEN_LOGO) if (!same(theme.logo?.[k], reference.logo?.[k])) out.push(`logo.${k}`);
  return out;
}

/**
 * The theme a pack puts on the screens, with the parts the broker edits on the layout screens (e-mail, documents, the
 * logo height on documents) kept from `current`; a part still at the iorta TechNXT default (never edited, or reset)
 * takes the pack's.
 */
function enforcedTheme(pack, current) {
  const login = pack.manifest.theme.login || {};
  const assets = pack.manifest.assets || {};
  const { theme } = validateTheme({ ...pack.manifest.theme, login: { ...login, panelImageUrl: '', panel: login.panel === 'image' ? 'library' : login.panel } });
  if (assets.loginPanel) theme.login.panel = 'image';
  const isDefault = (section) => Object.keys(DEFAULT_THEME[section]).every((k) => same(current[section]?.[k], DEFAULT_THEME[section][k]));
  for (const section of ['email', 'documents']) if (!isDefault(section)) theme[section] = { ...current[section] };
  if (current.logo.documentHeight !== DEFAULT_THEME.logo.documentHeight) theme.logo.documentHeight = current.logo.documentHeight;
  return theme;
}

/**
 * Where the branding of this environment differs from a pack: { reasons, theme (the one to apply), documentLogo (the
 * print logo of the primary company is missing or not an uploaded image), reuse: role -> URL of an image already
 * stored with the same bytes as the pack's, so applying again stores no new copy }.
 */
async function packDrift(pack) {
  const current = await currentTheme();
  const theme = enforcedTheme(pack, current);
  const company = await primaryCompany().catch(() => null);
  const refs = {
    logo: str(await getSetting('branding.logo_url', '')),
    favicon: str(await getSetting('branding.favicon_url', '')),
    loginPanel: str(current.login.panelImageUrl),
    documentLogo: str(company?.data?.Logo),
  };
  const stored = Object.fromEntries(Object.entries(refs).map(([role, ref]) => [role, storedImageBytes(ref)]));
  const reasons = [];
  const differences = screenDifferences(current, theme);
  if (differences.length) reasons.push(`the theme differs (${differences.slice(0, 6).join(', ')}${differences.length > 6 ? ', ...' : ''})`);
  const systemName = str(pack.manifest.systemName).slice(0, 120);
  const nameNow = str(await getSetting('general.system_name', ''));
  if (systemName && nameNow !== systemName) reasons.push(`the application name is "${nameNow}"`);
  const reuse = {};
  for (const [role, file] of Object.entries(pack.manifest.assets || {})) {
    if (!file) continue;
    const bytes = pack.files.get(path.basename(String(file)));
    const match = Object.keys(refs).find((r) => stored[r]?.equals(bytes));
    if (match) reuse[role] = refs[match];
    if (role !== 'documentLogo' && !stored[role]?.equals(bytes)) reasons.push(`the ${role === 'loginPanel' ? 'sign-in picture' : role} is not the pack's`);
  }
  const documentLogo = !!company && !!pack.manifest.assets?.documentLogo && !stored.documentLogo;
  if (documentLogo) reasons.push(refs.documentLogo ? `the print logo of the primary company is ${refs.documentLogo}` : 'the primary company has no print logo');
  return { reasons, theme, documentLogo, reuse, before: current };
}

/**
 * Enforce the pack named by BRAND_PACK at start-up (after migrations and seed): when it is not the enablement in force,
 * or the branding of the screens has drifted from it (theme, application name, logo, favicon, the print logo of the
 * primary company missing), it is applied again, keeping the e-mail and document sections the broker set on the layout
 * screens. Images already stored with the pack's bytes are reused, so a start with nothing to do stores nothing. The
 * first application records the acknowledgement with a note that the deployment configuration gave it, against the
 * user "system"; every application is audited and logged with its reasons. Several instances starting together take
 * an advisory lock so only one of them applies it. log is the application logger (info, warn). Returns
 * { status: 'enabled' | 're-applied' | 'in-force' | 'unknown' | 'skipped', ... }.
 */
export async function enforceDeploymentPack(id, { log = { info() {}, warn() {} }, storeImage = storeBundledImage } = {}) {
  const packId = str(id);
  if (!packId) return { status: 'skipped', reason: 'not set' };
  if (!bundledPackIds().includes(packId)) {
    log.warn(`BRAND_PACK=${packId} is not a bundled brand pack (${bundledPackIds().join(', ') || 'none shipped'}); the branding is left as it is`);
    return { status: 'unknown', packId };
  }
  const lock = await pool.connect();
  try {
    await lock.query(`SELECT pg_advisory_lock(${DEPLOYMENT_LOCK})`);
    const pack = loadBundledPack(packId);
    const current = await currentEnablement();
    const drift = await packDrift(pack);
    const inForce = current?.packId === packId;
    const reasons = [...(inForce ? [] : [current ? `${current.packName} was in force` : 'no brand pack was in force']), ...drift.reasons];
    if (!reasons.length) {
      log.info(`Brand pack ${pack.bundled.name} in force (BRAND_PACK=${packId})`);
      return { status: 'in-force', packId, enablement: current };
    }
    const enforced = { ...pack, manifest: { ...pack.manifest, theme: drift.theme } };
    const reuse = (file, category, userId, ref) => {
      const url = drift.reuse[String(ref).split(':').pop()];
      return url ? { url } : storeImage(file, category, userId, ref);
    };
    const acknowledgementText = `${ACKNOWLEDGEMENT_TEXT} ${DEPLOYMENT_NOTE}`;
    const options = { applyDocumentLogo: drift.documentLogo, storeImage: reuse };
    const result = inForce
      ? { ...(await importBrandPack(enforced, { userId: null, ...options })), pack: pack.bundled, enablement: current }
      : await enableBundledPack(packId, { pack: enforced, user: SYSTEM_USER, acknowledgedPermission: true, acknowledgementText, ...options });
    const action = inForce ? 'reapply-pack' : 'enable-pack';
    await audit({ user: SYSTEM_USER, auditSource: { channel: 'job', name: 'BRAND_PACK' } }, { entity: 'branding', entityId: `bundled-pack:${packId}`, action, before: drift.before,
      after: { pack: packId, name: result.pack.name, version: result.pack.version, trademarkOwner: result.pack.trademarkOwner, acknowledgedPermission: true, acknowledgementText, reasons, applied: result.applied, theme: result.theme } });
    log.info(`Brand pack ${result.pack.name} ${inForce ? 'applied again' : 'enabled'} from BRAND_PACK=${packId}: ${reasons.join('; ')} (${result.applied.join(', ')})`);
    return { status: inForce ? 're-applied' : 'enabled', packId, reasons, applied: result.applied, enablement: result.enablement };
  } finally {
    await lock.query(`SELECT pg_advisory_unlock(${DEPLOYMENT_LOCK})`).catch(() => {});
    lock.release();
  }
}

/**
 * Back to the iorta TechNXT default: the default theme, the default logo and favicon, and, when a bundled pack is
 * enabled, the application name and the print logo of the primary company as they were before it. The enablement in
 * force is closed (status reverted). Returns { theme, restored, enablement (the closed one or null) }.
 */
export async function resetToDefault({ user }) {
  const current = await currentEnablement();
  const prev = current ? (await one('SELECT previous FROM brand_pack_enablements WHERE id = $1', [current.id]))?.previous || {} : {};
  const restored = ['theme', 'logo', 'favicon'];
  await saveTheme(DEFAULT_THEME, user?.id ?? null);
  await setSetting('branding.logo_url', '', user?.id ?? null);
  await setSetting('branding.favicon_url', '/favicon.ico', user?.id ?? null);
  if (current) {
    await setSetting('general.system_name', str(prev.systemName) || 'BrokerVerse', user?.id ?? null);
    restored.push('systemName');
    if (prev.companyId && (current.applied || []).includes('documentLogo')) {
      await query(`UPDATE master_records SET data = CASE WHEN $2::text IS NULL THEN data - 'Logo' ELSE jsonb_set(data, '{Logo}', to_jsonb($2::text)) END, updated_by = $3, updated_at = now() WHERE id = $1`,
        [prev.companyId, prev.documentLogo || null, user?.id ?? null]);
      clearLetterheadCache();
      restored.push('documentLogo');
    }
    await query(`UPDATE brand_pack_enablements SET status = 'reverted', reverted_by_user_id = $2, reverted_by = $3, reverted_at = now() WHERE id = $1`, [current.id, user?.id ?? null, user?.username ?? null]);
  }
  clearLetterheadCache();
  return { theme: await currentTheme(), restored, enablement: current };
}
