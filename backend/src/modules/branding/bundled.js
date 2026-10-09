/**
 * Bundled brand packs: packs that ship with the product under backend/assets/brand-packs/<id>/ (manifest.json with
 * the pack's identity and trademark terms, theme.json and the images it names, built the same way as a brand pack
 * folder of docs/package/04_Onboarding_and_Go_Live/Brand_Packs). None is applied by default: a System Administrator
 * enables one on Master > System Settings > Theme and Branding > Brand packs after acknowledging that the environment
 * belongs to the client engagement whose contract with iorta TechNXT covers the use of the marks the pack carries. The enablement is recorded (who, when, the
 * acknowledgement, the branding before it) so the broker can go back to the iorta TechNXT default at any time.
 * A deployment made for that client may name its pack in BRAND_PACK instead: the API enables it once at start-up
 * (enableDeploymentPack), recorded the same way with the deployment configuration as the source of the acknowledgement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { one, pool, query } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting, setSetting } from '../../lib/settings.js';
import { clearLetterheadCache, primaryCompany, ASSETS_DIR } from '../../lib/letterhead.js';
import { saveFile } from '../masters/helpers.js';
import { DEFAULT_THEME } from './presets.js';
import { PACK_FORMAT, assertBrandImage, currentTheme, importBrandPack, saveTheme, validateTheme } from './service.js';

export const BUNDLED_DIR = path.join(ASSETS_DIR, 'brand-packs');

/** Colours shown as the preview of a pack on the screen, in this order. */
export const PREVIEW_COLORS = ['primary', 'headerBg', 'sidebarBg', 'tableHeaderBg', 'buttonBg', 'accent'];

/** The sentence the administrator acknowledges when enabling a pack (kept with the enablement record). */
export const ACKNOWLEDGEMENT_TEXT = 'This environment belongs to the client engagement whose contract with iorta TechNXT covers the use of these marks.';

/** Added to the acknowledgement of an enablement made at start-up from the BRAND_PACK variable. */
export const DEPLOYMENT_NOTE = 'Given by the deployment configuration (BRAND_PACK).';

/** Who an enablement made at start-up is recorded against (no signed-in user). */
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
 * the enablement. dryRun checks only (nothing applied, nothing recorded).
 */
export async function enableBundledPack(id, { user, acknowledgedPermission, acknowledgementText = ACKNOWLEDGEMENT_TEXT, dryRun = false, applyDocumentLogo = true, applySystemName = true, storeImage }) {
  const pack = loadBundledPack(id);
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

/**
 * Enable the pack named by BRAND_PACK at start-up (after migrations and seed), once per environment: nothing is done
 * when a pack is already in force or when the pack was ever enabled here (by this start-up or on the screen), so an
 * administrator's later Back to default stands across restarts. The acknowledgement is recorded with a note that the
 * deployment configuration gave it, against the user "system", and audited. Several instances starting together take
 * an advisory lock so only one of them enables it. log is the application logger (info, warn). Returns { status: 'enabled' | 'skipped' | 'unknown', ... }.
 */
export async function enableDeploymentPack(id, { log = { info() {}, warn() {} }, storeImage = storeBundledImage } = {}) {
  const packId = str(id);
  if (!packId) return { status: 'skipped', reason: 'not set' };
  if (!bundledPackIds().includes(packId)) {
    log.warn(`BRAND_PACK=${packId} is not a bundled brand pack (${bundledPackIds().join(', ') || 'none shipped'}); the branding is left as it is`);
    return { status: 'unknown', packId };
  }
  const lock = await pool.connect();
  try {
    await lock.query(`SELECT pg_advisory_lock(${DEPLOYMENT_LOCK})`);
    const current = await currentEnablement();
    if (current) return { status: 'skipped', packId, reason: `${current.packName} is in force` };
    if (await one('SELECT id FROM brand_pack_enablements WHERE pack_id = $1 LIMIT 1', [packId])) return { status: 'skipped', packId, reason: 'enabled before in this environment' };
    const before = await currentTheme();
    const acknowledgementText = `${ACKNOWLEDGEMENT_TEXT} ${DEPLOYMENT_NOTE}`;
    const result = await enableBundledPack(packId, { user: SYSTEM_USER, acknowledgedPermission: true, acknowledgementText, storeImage });
    await audit({ user: SYSTEM_USER, auditSource: { channel: 'job', name: 'BRAND_PACK' } }, { entity: 'branding', entityId: `bundled-pack:${packId}`, action: 'enable-pack', before,
      after: { pack: packId, name: result.pack.name, version: result.pack.version, trademarkOwner: result.pack.trademarkOwner, acknowledgedPermission: true, acknowledgementText, applied: result.applied, theme: result.theme } });
    log.info(`Brand pack ${result.pack.name} enabled from BRAND_PACK=${packId} (${result.applied.join(', ')})`);
    return { status: 'enabled', packId, enablement: result.enablement };
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
