/**
 * The audit trail as business events: one entry per action (who, when, from where) with the fields it changed,
 * each as label -> old value -> new value, formatted the way the screens show them (amounts with the currency, dates in
 * general.date_format, times in general.timezone, status labels, Yes / No, record numbers instead of ids).
 *
 * The stored rows are not changed: audit_log keeps one row per action with before / after JSON and claim_field_changes
 * one row per changed claim field; both are read here and turned into events.
 *
 * Privacy: secrets (passwords, tokens, 2FA secrets, PINs ...) are never shown; government ID and bank account numbers
 * are shown masked (last four characters) unless the viewer holds view:pii; the personal data of an anonymised
 * client or prospect are shown as "Anonymised".
 */
import { many } from '../db/pool.js';
import { getSetting } from './settings.js';
import { hasPermission } from './auth.js';
import { DEFAULT_FORMAT, applyDatePattern, formatAmount } from './pdf/format.js';
import { printFormat } from './pdf/index.js';
import { STATUS_LABELS, actionTitle, entityLabel, pathLabel, sentenceCase, statusText } from './auditLabels.js';
import { revealPii } from './pii.js';
import { VIEW_PII } from './piiPolicy.js';

export const EMPTY = null;
export const MASK = '••••••';
export const ANONYMISED = 'Anonymised';

// ---------------------------------------------------------------- classification of keys

const leaf = (path) => String(path).split('.').pop();
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Keys whose values are never shown (credentials and secrets). */
const SECRET = /(pass(word)?|passwd|pwd|secret|token|otp|totp|mfa|2fa|twofactor|apikey|privatekey|hash|salt|cvv|cvc|cardnumber|recoverycode|signingkey|sealed)/;
export const isSecretKey = (path) => {
  const n = norm(leaf(path));
  return SECRET.test(n) || n === 'pin' || n === 'mpin';
};

/** Government IDs and account numbers: shown masked unless the viewer may see personal data in full. */
const IDENTIFIER = new Set(['tin', 'tinno', 'tinnumber', 'taxnumber', 'taxid', 'taxidentificationnumber', 'sss', 'sssno', 'sssnumber', 'gsis', 'gsisno',
  'philhealth', 'philhealthno', 'pagibig', 'pagibigno', 'umid', 'passport', 'passportno', 'passportnumber', 'licenseno', 'licensenumber', 'licenceno',
  'licencenumber', 'driverslicense', 'driverlicense', 'driverlicenseno', 'idnumber', 'idno', 'governmentid', 'validid', 'accountnumber', 'accountno',
  'bankaccount', 'bankaccountnumber', 'bankaccountno', 'iban']);
export const isIdentifierKey = (path) => IDENTIFIER.has(norm(leaf(path)));

/** Personal data of a party (shown as Anonymised once the party's personal data were anonymised). */
const PERSONAL = new Set(['firstname', 'lastname', 'middlename', 'middleinitial', 'suffix', 'fullname', 'displayname', 'preferredname', 'name', 'insuredname',
  'customername', 'clientname', 'companyname', 'email', 'emailid', 'emailaddress', 'phone', 'phonenumber', 'mobile', 'mobileno', 'mobilenumber',
  'contactnumber', 'contactno', 'telephone', 'landline', 'fax', 'address', 'address1', 'address2', 'addressline1', 'addressline2', 'fulladdress',
  'mailingaddress', 'homeaddress', 'street', 'road', 'houseno', 'housenumber', 'barangay', 'zipcode', 'postalcode', 'dob', 'birthdate', 'dateofbirth',
  'birthday', 'placeofbirth', 'age', 'gender', 'sex', 'civilstatus', 'occupation', 'employer', 'nationality', 'mothersmaidenname', 'contactperson',
  'contactname', 'notes', 'extra', ...IDENTIFIER]);
export const isPersonalKey = (path) => String(path).split('.').some((p) => PERSONAL.has(norm(p)));

/** Bookkeeping keys that repeat what the event already says (who / when) or carry no business meaning. */
const NOISE = new Set(['id', 'createdat', 'updatedat', 'createdby', 'updatedby', 'modifiedby', 'modifiedon', 'submittedat', 'submittedby', 'approvedat',
  'lastmodified', 'rowversion', 'proofkey', 'storagekey', 'filekey', 'objectkey', 'tokenversion', 'attrs', 'premiumbreakdown', 'lead', 'searchtext', 'deletedat', 'requestedat']);
/** Extra noise per record type. */
const NOISE_BY_ENTITY = { quotation: new Set(['participantdetails', 'firepremiumdetails', 'coverages', 'documents']) };
const isNoise = (entity, path) => {
  const n = norm(leaf(path));
  return NOISE.has(n) || NOISE_BY_ENTITY[entity]?.has(n);
};

const MONEY = /(amount|premium|suminsured|balance|fee|fees|charge|charges|deductible|excess|price|cost|outstanding|vat$|dst$|lgt$|tax$|taxes$|commission$|due$|paid$|total$|limit$|salvage|depreciation|estimate$|value$)/;
const NOT_MONEY = /(rate|percent|pct|count|days|number|no$|id$|code|type|status|method|mode|basis|currency|date|name|label|ratio|share)/;
const PERCENT = /(percent|pct|sharepercent|ratepercent)$/;
/** Rates kept as a number of percent ("commissionRate 10", "ewtRate 2"; a fraction such as 0.15 stays as it is); exchange and base rates are plain numbers. */
const RATE_PERCENT = /(commission|ewt|wht|vat|tax|discount|share|interest|loading)rate$/;
const DATEISH = /(date|dob|birthday|until|from$|to$|on$|expiry|inception|effective)$/;
const STATUS = /status$/;
const ENUM = /(type|mode|method|channel|priority|basis|category|option|frequency|gender|civilstatus|line|lob|kind|level|severity|result|outcome|decision)$/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const ISO_IN_TEXT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})/g;
/** Ids generated by the database ("pol_0123456789abcdef"): resolved to the record's number or name. */
export const REF_ID = /^(usr|cl|ld|qt|pol|end|clm|rnw|or|jv)_[0-9a-f]{16}$/;
/** Any generated id ("pp_f597cedf90aac9f9", "rcv_..."). */
const TECH_ID = /^[a-z]{1,8}_[0-9a-f]{8,}$/;

// ---------------------------------------------------------------- formatting

/** Format context: settings read once per request. */
export async function formatContext({ viewer = null, statusLabels = {}, refs = new Map(), fieldLabels = {}, masterLabels = {}, anonymised = false } = {}) {
  const fmt = await printFormat().catch(() => DEFAULT_FORMAT);
  return { fmt, viewer, canSeePersonal: !viewer || hasPermission(viewer, VIEW_PII), statusLabels, refs, fieldLabels, masterLabels, anonymised };
}

const timeIn = (d, timeZone) => {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); } catch { return d.toISOString().slice(11, 16); }
};
const dayIn = (d, timeZone) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch { return d.toISOString().slice(0, 10); }
};

/** An instant as { day: YYYY-MM-DD, date, time, text } in the business time zone and the configured date format. */
export function instant(v, fmt = DEFAULT_FORMAT) {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const day = dayIn(d, fmt.timeZone);
  const date = applyDatePattern(day, fmt.dateFormat);
  const time = timeIn(d, fmt.timeZone);
  return { day, date, time, text: `${date} ${time}` };
}

/** A date-time text: date only when it falls on midnight in the business zone and the key names a date. */
function dateTimeText(v, fmt, dateKey) {
  const i = instant(v, fmt);
  if (!i) return String(v);
  return dateKey && i.time === '00:00' ? i.date : i.text;
}

const isNumeric = (v) => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()));

/** "PHP 85,000.00" (currency of the record when known, else the configured currency). */
/** The symbol of the home currency as the screens show it (PHP -> ₱); the code itself when the currency has none. */
const currencySymbol = (code) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value || code;
  } catch {
    return code;
  }
};
export const moneyText = (v, fmt = DEFAULT_FORMAT, currency) => {
  const home = String(fmt.currency || 'PHP').toUpperCase();
  const code = String(currency || home).toUpperCase();
  // a foreign amount keeps its code, so that $ is never read as another dollar
  const symbol = code === home ? currencySymbol(code) : code;
  return symbol === code ? `${code} ${formatAmount(v, fmt.decimals ?? 2)}` : `${symbol}${formatAmount(v, fmt.decimals ?? 2)}`;
};

const maskTail = (v) => {
  const s = String(v);
  return s.length <= 4 ? MASK : `${MASK}${s.slice(-4)}`;
};

/**
 * One value as text for the trail; null when empty (the screens show a dash). `path` is the (flattened) key,
 * `ctx` from formatContext, `currency` the record's currency when it has one.
 */
export function formatValue(path, value, ctx, currency) {
  // identifiers are kept encrypted in the trail (migration 0277)
  if (typeof value === 'string') value = revealPii(value);
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return EMPTY;
  if (isSecretKey(path)) return MASK;
  if (ctx.anonymised && isPersonalKey(path)) return ANONYMISED;
  if (isIdentifierKey(path) && !ctx.canSeePersonal) return maskTail(value);
  const key = norm(leaf(path));
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.every((x) => x === null || typeof x !== 'object')) return value.map((x) => formatValue(path, x, ctx, currency)).filter(Boolean).join(', ') || EMPTY;
    return `${value.length} ${value.length === 1 ? 'entry' : 'entries'}`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value).trim();
  if (['true', 'false'].includes(s.toLowerCase()) && /^(is|has|can|allow|enable|active)/.test(key)) return s.toLowerCase() === 'true' ? 'Yes' : 'No';
  if (REF_ID.test(s)) return ctx.refs.get(s) || s;
  if (STATUS.test(key)) return statusText(s, ctx.statusLabels);
  if (isNumeric(s)) {
    if (PERCENT.test(key) || (RATE_PERCENT.test(key) && Number(s) > 1)) return `${Number(s)}%`;
    if (MONEY.test(key) && !NOT_MONEY.test(key)) return moneyText(s, ctx.fmt, currency);
    return s;
  }
  if (ISO_DATE.test(s)) return applyDatePattern(s, ctx.fmt.dateFormat);
  if (ISO_DATETIME.test(s)) return dateTimeText(s, ctx.fmt, DATEISH.test(key));
  if (ENUM.test(key) && (/^[a-z]+([-_][a-z]+)*$/.test(s) || /^[A-Z]+([-_][A-Z]+)*$/.test(s))) return sentenceCase(s);
  // timestamps inside free text ("approved 2026-10-02T01:49:37.774Z")
  return s.replace(ISO_IN_TEXT, (m) => instant(m, ctx.fmt)?.text || m);
}

// ---------------------------------------------------------------- flattening and diff

/** A JSON text that holds an object or array is read as that value (claim_field_changes stores text). */
export function parseMaybeJson(v) {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (!(s.startsWith('{') || s.startsWith('['))) return v;
  try { return JSON.parse(s); } catch { return v; }
}

/**
 * Nested objects as dotted keys: { adjuster: { adjusterName: 'A' } } -> { 'adjuster.adjusterName': 'A' }. Arrays of
 * plain values stay a list; arrays of objects stay one value (shown as a number of entries). Depth is bounded.
 */
export function flatten(value, prefix = '', out = {}, depth = 0) {
  const v = parseMaybeJson(value);
  if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && depth < 4) {
    const keys = Object.keys(v);
    if (!keys.length && prefix) out[prefix] = null;
    for (const k of keys) flatten(v[k], prefix ? `${prefix}.${k}` : k, out, depth + 1);
    return out;
  }
  if (prefix) out[prefix] = v instanceof Date ? v.toISOString() : v;
  return out;
}

/** Keys holding the id of another record (clientId, insurance_company_id); ID numbers of a person are not among them. */
const isIdKey = (path) => /([a-z0-9]Id|_id|ID)$/.test(leaf(path)) && !isIdentifierKey(path);
/** A database key (8, "cl_crs_10", "usr_b8c15d013470b6e2"), as opposed to a reference a user knows ("BLK-1"). */
const isInternalId = (v) => typeof v === 'number' || (typeof v === 'string' && (/^\d+$/.test(v) || /^[a-z]{1,8}_[a-z0-9_]+$/.test(v)));

/** The order of the facts of a created record: its number, the parties, status and type, dates, amounts, then the rest. */
const factRank = (path) => {
  const k = norm(leaf(path));
  // the record's own number or code first; a code that classifies it (EWT code, transaction code) reads with the types
  if (/(number|no)$/.test(k) || k === 'code') return 0;
  if (/code$/.test(k)) return 3;
  if (/name$/.test(k) || /^(client|insurer|insured|supplier|product)/.test(k)) return 1;
  if (STATUS.test(k)) return 2;
  if (ENUM.test(k)) return 3;
  if (DATEISH.test(k)) return 4;
  if (MONEY.test(k) && !NOT_MONEY.test(k)) return 5;
  return 6;
};

const same = (a, b) => {
  const empty = (x) => x === null || x === undefined || x === '' || (Array.isArray(x) && !x.length);
  if (empty(a) && empty(b)) return true;
  if (isNumeric(a) && isNumeric(b)) return Number(a) === Number(b);
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * The changed fields between two snapshots (either may be null: a creation lists the values set, a deletion the values
 * removed), labelled and formatted: [{ key, label, from, to, masked }]. Fields are in the order of the snapshots.
 */
export function diffFields(entity, before, after, ctx) {
  const b = before ? flatten(before) : {};
  const a = after ? flatten(after) : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const currency = a.currency || b.currency;
  // a record created or removed is described by its own facts: nested working data and lists of lines are left out
  const whole = !before || !after;
  const out = [];
  const labels = new Set();
  for (const key of keys) {
    if (isNoise(entity, key)) continue;
    if (whole && key.includes('.')) continue;
    const raw = a[key] ?? b[key];
    if (whole && Array.isArray(raw) && raw.some((x) => x && typeof x === 'object')) continue;
    // a technical id that names no record a user knows (payment line, receivable ...) says nothing to the reader
    if (typeof raw === 'string' && TECH_ID.test(raw) && !ctx.refs.has(raw) && /id$/i.test(leaf(key))) continue;
    // a reference kept as an id ("clientId cl_crs_10", "insuranceCompanyId 8") is shown by the name stored next to it
    if (isIdKey(key) && isInternalId(raw) && !ctx.refs.has(raw)) continue;
    // isActive next to status says the same thing twice
    if (norm(key) === 'isactive' && keys.includes('status')) continue;
    // "paymentModeLabel" next to "paymentMode": the label is the same value in words
    if (/label$/i.test(leaf(key)) && keys.includes(key.replace(/Label$/, ''))) continue;
    if (before && after && same(b[key], a[key])) continue;
    if (!before && (a[key] === null || a[key] === undefined || a[key] === '')) continue;
    if (!after && (b[key] === null || b[key] === undefined || b[key] === '')) continue;
    const from = before ? formatValue(key, b[key], ctx, currency) : EMPTY;
    const to = after ? formatValue(key, a[key], ctx, currency) : EMPTY;
    if (before && after && from === to && !isSecretKey(key)) continue; // differs only in form (e.g. "1" and 1)
    if (from === EMPTY && to === EMPTY) continue;
    let label = pathLabel(entity, key, ctx.fieldLabels);
    if (typeof raw === 'string' && ctx.refs.has(raw)) label = label.replace(/ ID$/, '');
    // two keys with one label ("clientId" resolved and "clientName"): the first one says it
    if (labels.has(label)) continue;
    labels.add(label);
    out.push({ key, label, from, to, ...(isSecretKey(key) ? { masked: true } : {}) });
  }
  return whole ? out.map((c, i) => ({ c, i })).sort((x, y) => factRank(x.c.key) - factRank(y.c.key) || x.i - y.i).map((x) => x.c) : out;
}

// ---------------------------------------------------------------- source and user

/** Where an event came from: the stored source, else derived from the row (older rows). */
export function sourceOf(row) {
  const s = row.source && typeof row.source === 'object' ? row.source : null;
  if (s?.channel === 'screen') return { channel: 'screen', label: 'Screen', name: s.name ? String(s.name).replace(/\s*>?\s*\(any [^)]*\)/i, '') : null };
  if (s?.channel === 'api') return { channel: 'api', label: 'Integration', name: s.name || null };
  if (s?.channel === 'job') return { channel: 'job', label: 'System job', name: s.name || null };
  // a step read from the record's own columns: who did it is not always kept, which does not make it a job
  if (s?.channel === 'record') return { channel: 'application', label: 'Application', name: null };
  const action = String(row.action || '');
  const username = String(row.username || '');
  if (username.startsWith('customer:')) return { channel: 'portal', label: 'Customer portal', name: null };
  if (['bulk-create', 'go-live-migration', 'provision'].includes(action) || username === 'provision-users') return { channel: 'upload', label: 'Data load', name: null };
  if (!row.user_id && (!username || ['system', 'payment-gateway', 'scheduler'].includes(username))) {
    return { channel: 'job', label: username === 'payment-gateway' ? 'Payment gateway' : 'System job', name: null };
  }
  return { channel: 'application', label: 'Application', name: null };
}

/** A change made on a master screen names the master ("Master > Insurance company"). */
function masterSource(source, entity, masterLabels) {
  if (source.channel !== 'screen' || !String(entity).startsWith('master:') || (source.name && source.name !== 'Master')) return source;
  return { ...source, name: `Master > ${entityLabel(entity, masterLabels)}` };
}

/** The user of an event: display name and role names (from the users table when the user still exists). */
export function userOf(row) {
  const username = row.username || null;
  if (username && username.startsWith('customer:')) return { username: null, displayName: 'Customer', roles: [] };
  if (!row.user_id && !username) return { username: null, displayName: 'System', roles: [] };
  return { id: row.user_id || null, username, displayName: row.display_name || username || 'System', roles: row.role_names || [] };
}

// ---------------------------------------------------------------- reference lookups

const REF_TABLES = {
  usr: ['users', 'display_name'], cl: ['clients', "display_name || COALESCE(' (' || client_code || ')', '')"], ld: ['leads', 'COALESCE(lead_number, display_name)'],
  qt: ['quotes', 'quote_number'], pol: ['policies', 'policy_number'], end: ['endorsements', 'endorsement_number'], clm: ['claims', 'claim_number'],
  rnw: ['renewals', 'renewal_number'], or: ['receipts', 'receipt_number'], jv: ['journal_vouchers', 'jv_number'],
};

/** Collect generated ids found in values (any depth). */
export function collectRefIds(values, into = new Set()) {
  const walk = (v) => {
    const x = parseMaybeJson(v);
    if (typeof x === 'string' && REF_ID.test(x)) into.add(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  values.forEach(walk);
  return into;
}

/** id -> number / name for the ids given (one query per kind of record). */
export async function resolveRefs(ids) {
  const byKind = {};
  for (const id of ids) (byKind[id.split('_')[0]] ||= []).push(id);
  const out = new Map();
  for (const [kind, list] of Object.entries(byKind)) {
    const [table, expr] = REF_TABLES[kind] || [];
    if (!table) continue;
    const rows = await many(`SELECT id, ${expr} AS label FROM ${table} WHERE id = ANY($1::text[])`, [list]).catch(() => []);
    for (const r of rows) if (r.label) out.set(r.id, r.label);
  }
  return out;
}

/** Record numbers of audited records: entity -> [table, number expression]. */
export const RECORD_NUMBERS = {
  policy: ['policies', 'policy_number'], quotation: ['quotes', 'quote_number'], claim: ['claims', 'claim_number'],
  client: ['clients', "display_name || COALESCE(' (' || client_code || ')', '')"], lead: ['leads', 'COALESCE(lead_number, display_name)'],
  endorsement: ['endorsements', 'endorsement_number'], receipt: ['receipts', 'receipt_number'], renewal: ['renewals', 'renewal_number'],
  journal_voucher: ['journal_vouchers', 'jv_number'], user: ['users', "display_name || ' (' || username || ')'"],
  session: ['users', 'username'], disbursement: ['disbursements', 'voucher_number'], petty_cash_request: ['petty_cash_requests', 'request_number'],
  petty_cash_fund: ['petty_cash_funds', 'code'],
};
/** Columns holding the number a user types to find a record (entity number filter). */
export const RECORD_KEYS = {
  policy: ['policies', 'policy_number'], quotation: ['quotes', 'quote_number'], claim: ['claims', 'claim_number'], client: ['clients', 'client_code'],
  lead: ['leads', 'lead_number'], endorsement: ['endorsements', 'endorsement_number'], receipt: ['receipts', 'receipt_number'],
  renewal: ['renewals', 'renewal_number'], journal_voucher: ['journal_vouchers', 'jv_number'], user: ['users', 'username'],
  disbursement: ['disbursements', 'voucher_number'], petty_cash_request: ['petty_cash_requests', 'request_number'], petty_cash_fund: ['petty_cash_funds', 'code'],
};

/** "entity|id" -> record number / name for a list of audit rows; master records use their code / name. */
export async function recordReferences(rows) {
  const groups = {};
  for (const r of rows) if (r.entity_id) (groups[r.entity] ||= new Set()).add(String(r.entity_id));
  const out = new Map();
  for (const [entity, ids] of Object.entries(groups)) {
    const [table, expr] = RECORD_NUMBERS[entity] || [];
    if (table) {
      const found = await many(`SELECT id::text AS id, ${expr} AS label FROM ${table} WHERE id::text = ANY($1::text[])`, [[...ids]]).catch(() => []);
      for (const f of found) if (f.label) out.set(`${entity}|${f.id}`, f.label);
    } else if (entity.startsWith('master:')) {
      const found = await many(`SELECT id::text AS id, COALESCE(NULLIF(name, ''), code) AS label FROM master_records
        WHERE type_code = $1 AND id::text = ANY($2::text[])`, [entity.slice(7), [...ids]]).catch(() => []);
      for (const f of found) if (f.label) out.set(`${entity}|${f.id}`, f.label);
    }
  }
  return out;
}

/** A readable reference from the snapshot itself when the record has no number column (or no longer exists). */
const SNAPSHOT_KEYS = ['policyNumber', 'claimNumber', 'quotationNumber', 'quoteNumber', 'endorsementNumber', 'receiptNumber', 'jvNumber', 'number',
  'referenceNo', 'referenceNumber', 'code', 'name', 'displayName', 'title', 'label'];
function snapshotReference(row) {
  for (const data of [row.after_data, row.before_data]) {
    if (!data || typeof data !== 'object') continue;
    for (const k of SNAPSHOT_KEYS) if (typeof data[k] === 'string' && data[k].trim()) return data[k].trim();
    const named = Object.entries(data).find(([k, v]) => /(Name|Code)$/.test(k) && typeof v === 'string' && v.trim());
    if (named) return named[1].trim();
  }
  return null;
}

// ---------------------------------------------------------------- events

/** Master type labels and their field labels (for master record events). */
export async function masterDictionaries(entities) {
  const codes = [...new Set(entities.filter((e) => String(e).startsWith('master:')).map((e) => e.slice(7)))];
  if (!codes.length) return { masterLabels: {}, masterFields: {} };
  const types = await many('SELECT code, label, fields FROM master_types WHERE code = ANY($1::text[])', [codes]).catch(() => []);
  const masterLabels = Object.fromEntries(types.map((t) => [t.code, t.label]));
  const masterFields = Object.fromEntries(types.map((t) => [t.code, Object.fromEntries((Array.isArray(t.fields) ? t.fields : []).filter((f) => f?.name)
    .map((f) => [f.name, f.label || sentenceCase(f.name)]))]));
  return { masterLabels, masterFields };
}

/** Claim status labels (claims.status_labels), as the claim lists show them. */
export async function claimStatusLabels() {
  const labels = (await getSetting('claims.status_labels', {})) || {};
  return typeof labels === 'object' ? labels : {};
}

/** Users and their role names, keyed by id and by username. */
async function usersOf(rows) {
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const names = [...new Set(rows.map((r) => r.username).filter(Boolean))];
  if (!ids.length && !names.length) return new Map();
  const users = await many(`SELECT u.id, u.username, u.display_name,
      COALESCE((SELECT array_agg(r.name ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '{}') AS role_names
    FROM users u WHERE u.id = ANY($1::text[]) OR u.username = ANY($2::text[])`, [ids, names]).catch(() => []);
  const map = new Map();
  for (const u of users) { map.set(`id:${u.id}`, u); map.set(`name:${u.username}`, u); }
  return map;
}

/** Parties (client / lead) whose personal data were anonymised, as "entity|id". */
async function anonymisedParties(rows) {
  const clients = [...new Set(rows.filter((r) => r.entity === 'client').map((r) => String(r.entity_id)))];
  const leads = [...new Set(rows.filter((r) => r.entity === 'lead').map((r) => String(r.entity_id)))];
  const out = new Set();
  if (clients.length) (await many('SELECT id FROM clients WHERE anonymised_at IS NOT NULL AND id = ANY($1::text[])', [clients]).catch(() => [])).forEach((r) => out.add(`client|${r.id}`));
  if (leads.length) (await many('SELECT id FROM leads WHERE anonymised_at IS NOT NULL AND id = ANY($1::text[])', [leads]).catch(() => [])).forEach((r) => out.add(`lead|${r.id}`));
  return out;
}

/** Record types whose after snapshot holds only the changed values (configuration saves). */
const PARTIAL_AFTER = new Set(['settings', 'system-settings']);

const NOTE_KEYS = new Set(['note', 'remarks', 'reason', 'comment', 'changenote']);

/**
 * Audit rows ({ id, at, user_id, username, entity, entity_id, action, before_data, after_data, source } or grouped
 * claim changes { ..., changes: [[field, old, new]] }) as events for the screens.
 */
export async function toEvents(rows, { viewer = null } = {}) {
  if (!rows.length) return [];
  const entities = [...new Set(rows.map((r) => r.entity))];
  const { masterLabels, masterFields } = await masterDictionaries(entities);
  const statusLabels = entities.includes('claim') ? await claimStatusLabels() : {};
  const refIds = collectRefIds(rows.flatMap((r) => [r.before_data, r.after_data, ...(r.changes || []).flatMap((c) => [c[1], c[2]])]));
  const [refs, users, references, anonymised] = await Promise.all([resolveRefs(refIds), usersOf(rows), recordReferences(rows), anonymisedParties(rows)]);
  const base = await formatContext({ viewer, refs, masterLabels });
  return rows.map((r) => {
    const ctx = { ...base, statusLabels: r.entity === 'claim' ? statusLabels : STATUS_LABELS[r.entity] || {}, fieldLabels: masterFields[String(r.entity).slice(7)] || {},
      anonymised: anonymised.has(`${r.entity}|${r.entity_id}`) };
    let changes;
    if (r.changes) {
      changes = [];
      for (const [field, oldV, newV] of r.changes) {
        if (!field) continue;
        const before = { [field]: parseMaybeJson(oldV) };
        const after = { [field]: parseMaybeJson(newV) };
        changes.push(...diffFields(r.entity, oldV == null ? null : before, newV == null ? null : after, ctx)
          .map((c) => ({ ...c, from: oldV == null ? EMPTY : c.from, to: newV == null ? EMPTY : c.to })));
      }
    } else if (PARTIAL_AFTER.has(r.entity) && r.before_data && r.after_data) {
      // the after snapshot holds only the values changed: compare those keys alone
      const keys = Object.keys(r.after_data);
      changes = diffFields(r.entity, Object.fromEntries(keys.map((k) => [k, r.before_data[k]])), r.after_data, ctx);
    } else {
      changes = diffFields(r.entity, r.before_data, r.after_data, ctx);
    }
    // a note given with the action is shown under the headline, not as a changed field
    const noteIdx = changes.findIndex((c) => NOTE_KEYS.has(norm(c.key)) && c.from === EMPTY && c.to);
    const note = noteIdx >= 0 ? changes.splice(noteIdx, 1)[0].to : null;
    const when = instant(r.at, base.fmt);
    const u = users.get(`id:${r.user_id}`) || users.get(`name:${r.username}`);
    const user = userOf({ ...r, display_name: u?.display_name, role_names: u?.role_names, user_id: r.user_id || u?.id });
    let title = actionTitle(r.entity, r.action, masterLabels);
    // a plain update that only moved the status reads as a status change
    if (/^(update|status|status changed)$/i.test(String(r.action)) && changes.length === 1 && STATUS.test(norm(leaf(changes[0].key)))) {
      title = changes[0].to ? `Status changed to ${changes[0].to}` : 'Status cleared';
    }
    return {
      id: String(r.id), at: r.at instanceof Date ? r.at.toISOString() : r.at, day: when?.day ?? null, date: when?.date ?? null, time: when?.time ?? null,
      atText: when?.text ?? null, entity: r.entity, entityLabel: entityLabel(r.entity, masterLabels), entityId: r.entity_id ?? null,
      reference: references.get(`${r.entity}|${r.entity_id}`) || snapshotReference(r) || r.entity_id || null,
      action: r.action, title, note, user, source: masterSource(sourceOf(r), r.entity, masterLabels), changes,
    };
  });
}

/** Keys of a snapshot that carry the remarks given with an action, in the order they are read. */
const REMARK_KEYS = ['remarks', 'comments', 'comment', 'reason', 'note', 'notes', 'changeNote'];
const isStatusKey = (key) => /^status(code)?$/.test(norm(leaf(key)));

/** The status of a snapshot as its label (statusCode before status, so a labelled snapshot is read by its code). */
function snapshotStatus(data, statusLabels) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const s = data.statusCode ?? data.status;
  return s === null || s === undefined || s === '' ? null : statusText(s, statusLabels);
}

/** The remarks given with an action: the first remark key of the after snapshot, else the note of the event. */
function remarksOf(row, event) {
  const data = row.after_data && typeof row.after_data === 'object' ? row.after_data : {};
  for (const k of REMARK_KEYS) if (typeof data[k] === 'string' && data[k].trim()) return data[k].trim();
  return event.note || null;
}

/**
 * Audit rows as the entries of a record's activity log (components/ActivityLog of the front end): the action code and
 * its headline, the user with display name and roles, the status move as labels, the remarks given with the action
 * and the other changed fields as { field, label, before, after }. `statusLabels` labels the status codes of the
 * record type (e.g. remittance.status_labels).
 */
export async function activityEntries(rows, { viewer = null, statusLabels = {} } = {}) {
  const events = await toEvents(rows, { viewer });
  return events.map((e, i) => {
    const r = rows[i];
    const from = snapshotStatus(r.before_data, statusLabels);
    const to = snapshotStatus(r.after_data, statusLabels);
    const moved = to !== null && from !== to;
    const roles = e.user.roles || [];
    return {
      id: e.id, at: e.at, day: e.day, date: e.date, time: e.time, atText: e.atText, actionCode: r.action || null, actionLabel: e.title,
      user: { username: e.user.username, displayName: e.user.displayName, roles, role: roles.join(', ') || null },
      fromStatus: moved ? from : null, toStatus: moved ? to : null, remarks: remarksOf(r, e),
      changes: e.changes.filter((c) => !isStatusKey(c.key) && !NOTE_KEYS.has(norm(c.key)) && norm(c.key) !== 'comments')
        .map((c) => ({ field: c.key, label: c.label, before: c.from, after: c.to })),
      source: e.source,
    };
  });
}

/**
 * Claim trail rows (claim_field_changes, one per field) grouped into one row per action: the rows of one trail()
 * call share the transaction time, the action and the user.
 */
export function groupFieldChanges(rows) {
  const out = [];
  for (const r of rows) {
    const at = r.at instanceof Date ? r.at.getTime() : Date.parse(r.at);
    const last = out[out.length - 1];
    if (last && last.atMs === at && last.action === r.action && (last.username || '') === (r.username || '')) {
      last.changes.push([r.field_name, r.old_value, r.new_value]);
      last.ids.push(r.id);
    } else {
      out.push({ id: `c${r.id}`, ids: [r.id], at: r.at, atMs: at, user_id: r.user_id ?? null, username: r.username ?? null, entity: r.entity || 'claim',
        entity_id: r.claim_id, action: r.action, changes: [[r.field_name, r.old_value, r.new_value]], source: r.source ?? null });
    }
  }
  return out.map(({ atMs: _atMs, ids: _ids, ...g }) => g);
}

/** Events as flat rows for a CSV / Excel download: one row per changed field (one row for an event without fields). */
export function exportRows(events) {
  const rows = [];
  for (const e of events) {
    const head = { date: e.date, time: e.time, user: e.user.displayName, role: (e.user.roles || []).join(', '), recordType: e.entityLabel,
      record: e.reference || '', event: e.title, note: e.note || '', source: [e.source.label, e.source.name].filter(Boolean).join(': ') };
    if (!e.changes.length) rows.push({ ...head, field: '', from: '', to: '' });
    for (const c of e.changes) rows.push({ ...head, field: c.label, from: c.from ?? '', to: c.to ?? '' });
  }
  return rows;
}
export const EXPORT_COLUMNS = [
  { key: 'date', header: 'Date' }, { key: 'time', header: 'Time' }, { key: 'user', header: 'User' }, { key: 'role', header: 'Role' },
  { key: 'recordType', header: 'Record type' }, { key: 'record', header: 'Record' }, { key: 'event', header: 'Event' }, { key: 'field', header: 'Field' },
  { key: 'from', header: 'Old value' }, { key: 'to', header: 'New value' }, { key: 'note', header: 'Note' }, { key: 'source', header: 'Source' },
];
