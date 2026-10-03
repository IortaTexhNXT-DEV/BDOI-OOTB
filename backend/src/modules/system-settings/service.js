/**
 * System Settings: the front end's settings object is a view over app_settings keys, so GET /settings (key-value)
 * and /system-settings always agree.
 */
import crypto from 'node:crypto';
import { many, one } from '../../db/pool.js';
import { getSetting, setSetting } from '../../lib/settings.js';
import { baseCurrency, currencyChoices } from '../../lib/currency.js';
import { badRequest } from '../../lib/errors.js';
import { saveFile } from '../masters/helpers.js';
import { detectType } from '../uploads/fileTypes.js';
import { assertNotOwnedElsewhere, settingOwner } from '../../lib/settingOwners.js';

/**
 * Front-end field -> app_settings key. System Settings owns these keys (lib/settingOwners.js): the generic configuration
 * endpoints refuse them. systemName is the one application name (sign-in page, side bar, browser tab).
 */
export const FIELD_KEYS = {
  logoUrl: 'branding.logo_url',
  faviconUrl: 'branding.favicon_url',
  primaryColor: 'branding.primary_color',
  secondaryColor: 'branding.secondary_color',
  displayCurrency: 'currency.default',
  defaultLanguage: 'general.default_language',
  systemName: 'general.system_name',
};
/** Upload targets: POST /system-settings/upload/:field */
export const UPLOAD_FIELDS = { logo: 'logoUrl', favicon: 'faviconUrl', logoUrl: 'logoUrl', faviconUrl: 'faviconUrl' };

const HEX = /^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$/;

async function values(keys) {
  const rows = await many('SELECT key, value, updated_at FROM app_settings WHERE key = ANY($1)', [keys]);
  return { map: Object.fromEntries(rows.map((r) => [r.key, r.value])), updatedAt: rows.reduce((m, r) => (!m || r.updated_at > m ? r.updated_at : m), null) };
}

/** The settings object exactly as the front end reads it. */
export async function getSystemSettings() {
  const keys = [...Object.values(FIELD_KEYS), 'branding.default_logo_url', 'branding.logo_presets', 'currency.allowed', 'general.languages',
    'general.company_name', 'general.system_name', 'general.timezone', 'general.date_format', 'currency.symbol', 'currency.decimals',
    'general.phone_country_code', 'general.mobile_pattern', 'general.mobile_example', 'quote.vehicle_colours', 'quote.model_year_span',
    'quote.bodily_injury_limits', 'quote.property_damage_limits'];
  const { map, updatedAt } = await values(keys);
  return {
    logoUrl: map['branding.logo_url'] || map['branding.default_logo_url'] || '',
    logoPresets: Array.isArray(map['branding.logo_presets']) ? map['branding.logo_presets'] : [],
    displayCurrency: map['currency.default'],
    primaryColor: map['branding.primary_color'],
    secondaryColor: map['branding.secondary_color'],
    defaultLanguage: map['general.default_language'],
    faviconUrl: map['branding.favicon_url'],
    // display currency choices: the active currencies of the Currency master (currency.allowed adds the locale)
    currencies: await currencyChoices(),
    // the accounting (ledger) base currency, Currency master: the display currency only relabels amounts
    baseCurrency: await baseCurrency().catch(() => null),
    languages: map['general.languages'] || [],
    companyName: map['general.company_name'],
    systemName: map['general.system_name'],
    timezone: map['general.timezone'],
    dateFormat: map['general.date_format'],
    currencySymbol: map['currency.symbol'],
    currencyDecimals: map['currency.decimals'],
    phoneCountryCode: map['general.phone_country_code'],
    mobilePattern: map['general.mobile_pattern'],
    mobileExample: map['general.mobile_example'],
    vehicleColours: Array.isArray(map['quote.vehicle_colours']) ? map['quote.vehicle_colours'] : [],
    modelYearSpan: map['quote.model_year_span'],
    bodilyInjuryLimits: Array.isArray(map['quote.bodily_injury_limits']) ? map['quote.bodily_injury_limits'] : [],
    propertyDamageLimits: Array.isArray(map['quote.property_damage_limits']) ? map['quote.property_damage_limits'] : [],
    updatedAt,
  };
}

/** Validate and save the fields the System Settings screen sends; unknown fields are ignored. */
export async function updateSystemSettings(body, userId) {
  const changes = {};
  const errors = [];
  for (const [field, key] of Object.entries(FIELD_KEYS)) {
    if (body[field] === undefined) continue;
    const v = typeof body[field] === 'string' ? body[field].trim() : body[field];
    if (['primaryColor', 'secondaryColor'].includes(field) && !HEX.test(v)) errors.push({ path: field, message: 'must be a hex colour such as #0072d8' });
    if (field === 'systemName' && (!v || String(v).length > 120)) errors.push({ path: field, message: 'Application name is required (max 120 characters)' });
    if (field === 'defaultLanguage' && !/^[a-z]{2,3}(-[A-Za-z]{2})?$/.test(String(v))) errors.push({ path: field, message: 'must be a language code such as en' });
    if (['logoUrl', 'faviconUrl'].includes(field) && v && String(v).length > 1000) errors.push({ path: field, message: 'URL is too long' });
    changes[key] = v;
  }
  if (changes['currency.default'] !== undefined) {
    const choices = await currencyChoices();
    changes['currency.default'] = String(changes['currency.default'] || '').toUpperCase();
    if (!choices.some((c) => c.code === changes['currency.default'])) errors.push({ path: 'displayCurrency', message: 'Currency is not an active currency of the Currency master' });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  for (const [k, v] of Object.entries(changes)) await setSetting(k, v, userId);
  return changes;
}

/** Validate an uploaded image against the configured size and type limits. */
export async function assertImage(file) {
  if (!file) throw badRequest('file is required (multipart field "file")');
  const max = Number(await getSetting('uploads.image_max_bytes', 2097152));
  const types = (await getSetting('uploads.image_types', [])) || [];
  if (file.size > max) throw badRequest(`File exceeds the maximum size of ${Math.round(max / 1024)} KB`);
  // The type is taken from the file signature, not from the browser's claim.
  const detected = detectType(file.buffer, file.originalname);
  const allowed = types.length ? types : ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!detected || !allowed.includes(detected)) throw badRequest(`File type ${detected || file.mimetype || 'unknown'} is not allowed`);
  file.detectedType = detected;
}

export async function storeImage(file, category, userId, entityId) {
  await assertImage(file);
  return saveFile({ category, fileName: file.originalname, content: file.buffer, contentType: file.detectedType, entity: 'system-settings', entityId, userId });
}

export async function addLogoPreset({ label, url, setActive }, userId) {
  const name = String(label || '').trim();
  if (!name) throw badRequest('Company / client name is required');
  if (!url) throw badRequest('Upload a logo file or enter a logo URL');
  if (!/^(https?:\/\/|\/)/.test(url)) throw badRequest('Logo URL must start with http(s):// or /');
  const presets = (await getSetting('branding.logo_presets', [])) || [];
  if (presets.some((p) => p.label.toLowerCase() === name.toLowerCase())) throw badRequest(`A logo named ${name} already exists`);
  const preset = { id: crypto.randomUUID(), label: name, url, builtIn: false };
  await setSetting('branding.logo_presets', [...presets, preset], userId);
  if (setActive !== false && String(setActive) !== 'false') await setSetting('branding.logo_url', url, userId);
  return preset;
}

export async function removeLogoPreset(id, userId) {
  const presets = (await getSetting('branding.logo_presets', [])) || [];
  const preset = presets.find((p) => p.id === id);
  if (!preset) throw badRequest('Logo preset not found');
  if (preset.builtIn) throw badRequest('Built-in logos cannot be removed');
  await setSetting('branding.logo_presets', presets.filter((p) => p.id !== id), userId);
  if ((await getSetting('branding.logo_url', '')) === preset.url) await setSetting('branding.logo_url', '', userId);
  return preset;
}

// ---------- configuration catalogue ----------

export async function configurationCatalogue(group) {
  const labels = (await getSetting('system.group_labels', {})) || {};
  const rows = await many(`SELECT s.key, s.value, s."group", s.label, s.type, s.editable, s.updated_at, s.updated_by,
                                  (SELECT display_name FROM users u WHERE u.id = s.updated_by) AS updated_by_name
                           FROM app_settings s WHERE ($1::text IS NULL OR s."group" = $1) ORDER BY s."group", s.key`, [group || null]);
  const items = rows.map((r) => ({ key: r.key, value: r.value, group: r.group, label: r.label, type: r.type, editable: r.editable, managedBy: settingOwner(r.key), updatedAt: r.updated_at, updatedBy: r.updated_by_name || r.updated_by }));
  const groups = [];
  for (const it of items) {
    let g = groups.find((x) => x.group === it.group);
    if (!g) { g = { group: it.group, label: labels[it.group] || it.group, items: [] }; groups.push(g); }
    g.items.push(it);
  }
  return { groups, items, total: items.length };
}

function coerceSetting(row, value) {
  switch (row.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return { error: 'must be a number' };
      return { value: n };
    }
    case 'boolean': return { value: value === true || value === 'true' || value === 1 || value === '1' };
    case 'json': {
      if (typeof value === 'string') { try { return { value: JSON.parse(value) }; } catch { return { error: 'must be valid JSON' }; } }
      return { value };
    }
    case 'color': return HEX.test(String(value)) ? { value: String(value) } : { error: 'must be a hex colour' };
    default: return typeof value === 'object' && value !== null ? { error: 'must be text' } : { value: value == null ? '' : String(value) };
  }
}

/**
 * Apply { key: value } changes; every key must exist and be editable, values are coerced by type. A setting owned by
 * another screen (System Settings, Company master, Premium Taxes) is refused with the name of that screen.
 */
export async function updateConfiguration(changes, userId) {
  const keys = Object.keys(changes);
  if (!keys.length) throw badRequest('No settings to update');
  const rows = await many('SELECT key, type, editable, value FROM app_settings WHERE key = ANY($1)', [keys]);
  const errors = [];
  const apply = [];
  for (const k of keys) {
    const row = rows.find((r) => r.key === k);
    if (!row) { errors.push({ path: k, message: 'Unknown setting' }); continue; }
    if (!row.editable) { errors.push({ path: k, message: 'Setting is read-only' }); continue; }
    const c = coerceSetting(row, changes[k]);
    if (c.error) errors.push({ path: k, message: `${k} ${c.error}` });
    else apply.push([k, c.value, row.value]);
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  assertNotOwnedElsewhere(apply);
  const { assertNotControlled } = await import('../posting-rules/service.js');
  await assertNotControlled(apply);
  for (const [k, v] of apply) await setSetting(k, v, userId);
  return { before: Object.fromEntries(apply.map(([k, , b]) => [k, b])), after: Object.fromEntries(apply.map(([k, v]) => [k, v])) };
}

export async function settingExists(key) {
  return !!(await one('SELECT 1 FROM app_settings WHERE key = $1', [key]));
}
