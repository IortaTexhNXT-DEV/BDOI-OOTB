#!/usr/bin/env node
/**
 * Client data masking (npm run mask:data): masks the personal data of a COPY of a broker's production database before
 * it is used outside production (SIT, UAT, Pre-Prod refresh, training, support reproduction), as the Data Privacy Act
 * of 2012 (Republic Act No. 10173) and the guidance of the National Privacy Commission require.
 * Procedure, legal basis and the table of rules: docs/onboarding/DATA_MASKING.md.
 *
 * What it does, in one transaction:
 *   - every column of the personal data catalogue (scripts/lib/pii-catalogue.js) is masked with its rule: deterministic
 *     pseudonyms (HMAC-SHA256 with the secret MASK_SALT, never stored): the same original gives the same masked value in
 *     every table, column and JSON document, so joins, duplicate checks and searches keep working;
 *   - every other text and JSON column is swept: e-mail addresses, mobile numbers and TINs replaced, storage keys
 *     renamed, and in transaction and system tables every known client name replaced by its pseudonym;
 *   - users keep their usernames and roles; every password is reset: the administrator named by --admin gets
 *     MASK_ADMIN_PASSWORD, the other users MASK_STAFF_PASSWORD (changed at first sign-in) or, without it, sign-in is
 *     disabled for them; two-factor secrets cleared and every session ended. Staff names and e-mail addresses are masked
 *     with --mask-staff, their other personal data (phone, date of birth, address) always;
 *   - the e-mail outbox, sign-in sessions and history, password reset codes and password history are emptied, and
 *     e-mail sending is switched off (notification.email_enabled), so the copy never e-mails a real client;
 *   - system.environment is set to the target (--environment), system.masked_at stamped, and the run recorded in the
 *     audit trail (counts and options, never the salt).
 * Then the files of client storage folders (--storage=<the copy's upload folder>): deleted with --purge-files, else
 * replaced by a placeholder under the masked key. Last, the verification: every text and JSON column of every table is
 * scanned for e-mail addresses outside example.test, mobile numbers and TINs that are not masked; any left makes the
 * exit code 4.
 *
 * Safety: refuses unless CONFIRM_MASK=yes; refuses on a database marked production (system.environment = production;
 * a database without the marker whose go-live lock is on counts as production); MASK_SALT (16 characters or more) is
 * required. Dry run by default: prints what would change per table and column; --execute masks.
 *
 * Usage:
 *   CONFIRM_MASK=yes MASK_SALT=... npm run mask:data -- --environment=uat                                  # dry run
 *   CONFIRM_MASK=yes MASK_SALT=... MASK_ADMIN_PASSWORD=... npm run mask:data -- --environment=uat --execute \
 *       [--admin=BrokerVerse] [--mask-staff] [--mask-locality] [--storage=/srv/brokerverse-uat/uploads [--purge-files]]
 *   npm run mask:data -- --verify-only                                                                      # scan only
 * DATABASE_URL selects the copy. Stop the API instances of the copy first.
 */
import crypto from 'node:crypto';
import { isPiiCipher, revealPii } from '../src/lib/pii.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { TABLE_ACTIONS, catalogueEntry, jsonKeyRule, keyWords } from './lib/pii-catalogue.js';
import {
  EMAIL_RE, MASKED_EMAIL_DOMAIN, MOBILE_RE, Masker, TIN_RE, isMaskedMobile, isMaskedTin, norm,
} from './lib/pseudonyms.js';
import { SYSTEM_TABLES, TRANSACTION_FILE_FOLDERS, TRANSACTION_TABLES } from './lib/table-classification.js';
import {
  ENVIRONMENTS, MASKED_AT_KEY, NON_PRODUCTION_ENVIRONMENTS, PRODUCTION_IDENTITY_KEY, RESTORED_FROM_KEY, SYSTEM_ENVIRONMENT_KEY, systemEnvironment,
} from '../src/lib/environment.js';
import { GO_LIVE_LOCK_KEY, isGoLiveLocked } from '../src/lib/goLiveLock.js';

export class MaskRefused extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

const ident = (t) => `"${String(t).replace(/"/g, '""')}"`;
const EMAIL_SENDING_KEY = 'notification.email_enabled';
const NAME_RULES = new Set(['firstName', 'lastName', 'personName', 'companyName', 'partyName']);
const NUMERIC_RULES = new Set(['phone', 'tin', 'idNumber', 'bankAccount', 'plate', 'chassis', 'engine', 'houseNo', 'postal']);
const TEXT_TYPES = new Set(['text', 'varchar', 'bpchar', 'json', 'jsonb', '_text', '_varchar']);
/** Tables never touched: schema history and number counters hold no personal data. */
const SKIP_TABLES = new Set(['schema_migrations', 'sequences']);
/** Tables where known client names are also replaced in free text (transactions, system records, people). */
const NAME_SWEEP_TABLES = new Set([...TRANSACTION_TABLES, ...SYSTEM_TABLES, 'users', 'commission_referrers', 'signatories']);
/** Non-catalogued columns that are identifiers, codes, usernames or states: never swept (storage keys only renamed). */
const NO_SWEEP_RE = /(^id$|_id$|_ids$|_by$|^by$|username|_code$|^code$|_number$|_no$|^status$|_status$|_type$|^type$|^kind$|currency|_hash$|^jti$|^entity$|_at$)/;
const KEY_COLUMN_RE = /_key$/;
const BATCH = 500;

// ------------------------------------------------------------------------------------------------ helpers

async function forEachBatch(client, sql, params, fn) {
  const cursor = `mask_${crypto.randomBytes(4).toString('hex')}`;
  await client.query(`DECLARE ${cursor} NO SCROLL CURSOR FOR ${sql}`, params);
  try {
    for (;;) {
      const r = await client.query(`FETCH ${BATCH} FROM ${cursor}`);
      if (!r.rows.length) break;
      await fn(r.rows);
      if (r.rows.length < BATCH) break;
    }
  } finally {
    await client.query(`CLOSE ${cursor}`);
  }
}

/** Text-like columns of every public table: Map(table -> [{ name, udt, nullable }]) (date columns kept for dob rules). */
async function tableColumns(client) {
  const r = await client.query(`SELECT c.table_name, c.column_name, c.udt_name, c.is_nullable = 'YES' AS nullable
    FROM information_schema.columns c JOIN pg_tables t ON t.tablename = c.table_name AND t.schemaname = 'public'
    WHERE c.table_schema = 'public' AND c.is_generated = 'NEVER' ORDER BY c.table_name, c.ordinal_position`);
  const out = new Map();
  for (const x of r.rows) {
    if (!out.has(x.table_name)) out.set(x.table_name, []);
    out.get(x.table_name).push({ name: x.column_name, udt: x.udt_name, nullable: x.nullable });
  }
  return out;
}

const castOf = (udt) => (udt === 'jsonb' ? 'jsonb' : udt === 'json' ? 'json' : udt === 'date' ? 'date' : udt.startsWith('_') ? 'text[]' : 'text');
const selectExpr = (c) => (c.udt === 'date' ? `${ident(c.name)}::text` : ident(c.name));
const asParam = (c, v) => {
  if (v == null) return null;
  if (c.udt === 'json' || c.udt === 'jsonb' || c.udt.startsWith('_')) return JSON.stringify(v);
  return String(v);
};
const sameValue = (a, b) => (a === b) || (a != null && b != null && typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b));

// ------------------------------------------------------------------------------------------------ rules

function staffNameKept(m, opt, rule) {
  return opt.party === 'staff' && !m.maskStaff && NAME_RULES.has(rule);
}

/** Apply a catalogue rule to one (non-JSON) value. */
export function applyRule(m, rule, v, opt = {}) {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map((x) => applyRule(m, rule, x, opt));
  if (staffNameKept(m, opt, rule)) return v;
  switch (rule) {
    case 'firstName': case 'lastName': case 'personName': return m.personName(v);
    case 'companyName': return m.companyName(v);
    case 'partyName': return m.partyName(v);
    case 'email': case 'emailList': return m.emailList(v);
    case 'locality': return m.locality(v, 'city');
    case 'province': return m.locality(v, 'province');
    case 'postal': return m.locality(v, 'postal');
    case 'secret': return opt.nullable === false ? crypto.randomBytes(16).toString('hex') : null;
    case 'blank': return opt.nullable === false ? '' : null;
    case 'scrub': return m.scrub(v, { names: opt.names !== false });
    case 'json': return walkJson(m, v, opt);
    default:
      if (typeof m[rule] !== 'function') throw new Error(`unknown masking rule ${rule}`);
      return m[rule](v);
  }
}

function jsonValue(m, rule, x, opt) {
  if (x == null || typeof x === 'boolean') return x;
  // identifiers encrypted at rest (migration 0277) are masked in clear; the database encrypts the masked value again
  if (isPiiCipher(x)) x = revealPii(x);
  if (typeof x === 'number') {
    if (!rule || !NUMERIC_RULES.has(rule)) return x;
    const r = applyRule(m, rule, String(x), opt);
    return /^[1-9]\d{0,14}$/.test(r) ? Number(r) : r;
  }
  if (typeof x !== 'string') return x;
  if (!rule) return m.scrub(x, { names: opt.names !== false });
  if (rule === 'keep') return m.storageKey(x);
  if (rule === 'secret' || rule === 'blank') return x === '' ? x : null;
  return applyRule(m, rule, x, { ...opt, nullable: true });
}

/** Mask a JSON document: each key by its name (jsonKeyRule), other strings swept. */
export function walkJson(m, v, opt = {}, parentWords = [], inherited = null) {
  if (Array.isArray(v)) return v.map((x) => walkJson(m, x, opt, parentWords, inherited));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const rule = opt.patternsOnly ? null : (jsonKeyRule(k, { parentWords, bareName: opt.bareName && !parentWords.length }) ?? inherited);
      out[k] = x && typeof x === 'object' ? walkJson(m, x, opt, keyWords(k), rule) : jsonValue(m, rule, x, opt);
    }
    return out;
  }
  return jsonValue(m, inherited, v, opt);
}

/** Collection pass over a JSON document: remember names (and, staff not masked, kept e-mail addresses). */
function collectJson(m, v, opt, parentWords = [], inherited = null) {
  if (Array.isArray(v)) { v.forEach((x) => collectJson(m, x, opt, parentWords, inherited)); return; }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      const rule = jsonKeyRule(k, { parentWords, bareName: opt.bareName && !parentWords.length }) ?? inherited;
      if (x && typeof x === 'object') collectJson(m, x, opt, keyWords(k), rule);
      else collectValue(m, rule, x, opt);
    }
    return;
  }
  collectValue(m, inherited, v, opt);
}

function collectValue(m, rule, x, opt) {
  if (typeof x !== 'string' || !x) return;
  const staffKept = opt.party === 'staff' && !m.maskStaff;
  if ((rule === 'email' || rule === 'emailList') && staffKept) {
    for (const e of x.match(EMAIL_RE) || []) m.keptEmails.add(norm(e));
    return;
  }
  if (rule === 'contact' && !x.includes('@') && x.replace(/\D/g, '').length < 7) rule = 'partyName';
  if (NAME_RULES.has(rule) && !staffKept) m.register(rule, x);
}

// ------------------------------------------------------------------------------------------------ masking

function planColumns(table, cols) {
  const names = NAME_SWEEP_TABLES.has(table);
  const plan = [];
  for (const c of cols) {
    const entry = catalogueEntry(table, c.name);
    const textLike = TEXT_TYPES.has(c.udt);
    let fallback = null;
    if (textLike) fallback = KEY_COLUMN_RE.test(c.name) ? 'keyOnly' : NO_SWEEP_RE.test(c.name) ? null : 'sweep';
    const entryApplies = entry && (textLike || (entry.rule === 'dob' && c.udt === 'date'));
    if (!entryApplies && !fallback) continue;
    plan.push({ ...c, entry: entryApplies ? entry : null, fallback, names, changed: 0, rows: 0 });
  }
  return plan;
}

function maskValue(m, p, v, matchesWhere) {
  if (isPiiCipher(v)) v = revealPii(v);
  if (p.entry && matchesWhere) {
    const opt = { party: p.entry.party, bareName: p.entry.bareName, names: p.names, nullable: p.nullable };
    return applyRule(m, p.entry.rule, v, opt);
  }
  if (p.fallback === 'keyOnly') return Array.isArray(v) ? v.map((x) => m.storageKey(x)) : (typeof v === 'string' ? m.storageKey(v) : v);
  if (p.fallback === 'sweep') {
    if (p.udt === 'json' || p.udt === 'jsonb') return walkJson(m, v, { names: p.names, patternsOnly: !p.names });
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? m.scrub(x, { names: p.names }) : x));
    return m.scrub(v, { names: p.names });
  }
  return v;
}

async function maskTable(client, table, plan, m, execute) {
  const select = ['ctid::text AS "__ctid"', ...plan.map((p, i) => `${selectExpr(p)} AS "c${i}"`),
    ...plan.map((p, i) => (p.entry?.where ? `(${p.entry.where}) AS "w${i}"` : `true AS "w${i}"`))];
  const where = plan.map((p) => `${ident(p.name)} IS NOT NULL`).join(' OR ');
  await forEachBatch(client, `SELECT ${select.join(', ')} FROM ${ident(table)} WHERE ${where}`, [], async (rows) => {
    const changedRows = [];
    for (const row of rows) {
      const next = plan.map((p, i) => {
        const v = row[`c${i}`];
        if (v == null) return v;
        p.rows += 1;
        const out = maskValue(m, p, v, row[`w${i}`] !== false);
        if (!sameValue(v, out)) p.changed += 1;
        return out;
      });
      if (plan.some((p, i) => !sameValue(row[`c${i}`], next[i]))) changedRows.push({ ctid: row.__ctid, next });
    }
    if (!execute || !changedRows.length) return;
    const sets = plan.map((p, i) => `${ident(p.name)} = ${p.udt.startsWith('_') ? `CASE WHEN v.c${i} IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(v.c${i}::jsonb)) END` : `v.c${i}::${castOf(p.udt)}`}`);
    const cols = plan.map((p, i) => `c${i}`).join(', ');
    const unnest = plan.map((p, i) => `$${i + 2}::text[]`).join(', ');
    await client.query(`UPDATE ${ident(table)} t SET ${sets.join(', ')}
      FROM unnest($1::tid[], ${unnest}) AS v(ctid, ${cols})
      WHERE t.ctid = v.ctid AND t.ctid = ANY($1::tid[])`,
    [changedRows.map((r) => r.ctid), ...plan.map((p, i) => changedRows.map((r) => asParam(p, r.next[i])))]);
  });
}

/** Names of institutions (insurers, reinsurers, banks, the broker's own companies and branches): kept wherever they appear. */
const INSTITUTION_SQL = {
  insurance_companies: 'SELECT name AS n FROM insurance_companies UNION SELECT short_name FROM insurance_companies',
  reinsurers: 'SELECT name AS n FROM reinsurers UNION SELECT short_name FROM reinsurers',
  banks: 'SELECT name AS n FROM banks',
  branches: 'SELECT name AS n FROM branches',
  master_records: "SELECT name AS n FROM master_records WHERE type_code IN ('company', 'insurance-company', 'bank', 'branch') UNION SELECT data->>'CompanyName' FROM master_records WHERE type_code = 'company'",
  app_settings: "SELECT value #>> '{}' AS n FROM app_settings WHERE key IN ('general.company_name', 'bir.registered_name', 'general.system_name') AND jsonb_typeof(value) = 'string'",
};

async function collectNames(client, columns, m) {
  for (const [table, sql] of Object.entries(INSTITUTION_SQL)) {
    if (!columns.has(table)) continue;
    for (const { n } of (await client.query(sql)).rows) m.addInstitution(n);
  }
  for (const [table, cols] of columns) {
    if (SKIP_TABLES.has(table) || TABLE_ACTIONS[table]) continue;
    for (const c of cols) {
      const e = catalogueEntry(table, c.name);
      if (!e) continue;
      const isJson = e.rule === 'json';
      const isName = NAME_RULES.has(e.rule) || e.rule === 'contact';
      const keptEmail = (e.rule === 'email' || e.rule === 'emailList') && e.party === 'staff' && !m.maskStaff;
      if (!isJson && !isName && !keptEmail) continue;
      const where = e.where ? ` AND (${e.where})` : '';
      await forEachBatch(client, `SELECT ${ident(c.name)} AS v FROM ${ident(table)} WHERE ${ident(c.name)} IS NOT NULL${where}`, [], async (rows) => {
        for (const { v } of rows) {
          if (isJson) collectJson(m, v, e);
          else if (Array.isArray(v)) v.forEach((x) => collectValue(m, e.rule, x, e));
          else collectValue(m, e.rule, v, e);
        }
      });
    }
  }
  // Staff not masked: their e-mail addresses are kept wherever they appear.
  if (!m.maskStaff && columns.get('users')?.some((c) => c.name === 'email')) {
    for (const { email } of (await client.query("SELECT email FROM users WHERE COALESCE(email, '') <> ''")).rows) m.keptEmails.add(norm(email));
  }
}

async function upsertSetting(client, key, value, { group = 'system', label = key, type = 'string', editable = true } = {}) {
  await client.query(`INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES ($1, $2::jsonb, $3, $4, $5, $6)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key, JSON.stringify(value), group, label, type, editable]);
}

/** Where this connection points: database, server address and port, and the cluster identifier (null where not readable). */
export async function databaseIdentity(client) {
  const r = (await client.query('SELECT current_database() AS database, host(inet_server_addr()) AS host, inet_server_port() AS port')).rows[0];
  let systemIdentifier = null;
  try { systemIdentifier = String((await client.query('SELECT system_identifier FROM pg_control_system()')).rows[0].system_identifier); } catch { /* not granted */ }
  return { database: r.database, host: r.host || 'local', port: r.port ?? null, systemIdentifier };
}

const sameIdentity = (a, b) => a && b && a.database === b.database && String(a.host) === String(b.host)
  && String(a.port) === String(b.port) && (a.systemIdentifier ?? null) === (b.systemIdentifier ?? null);

async function readSetting(client, key) {
  const r = await client.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  return r.rows.length ? r.rows[0].value : null;
}

/**
 * Register the production database (run once in Production, after go-live): records where production lives
 * (system.production_identity). A copy restored from it carries this record, so --remark-copy can tell the copy
 * (different server, port, database or cluster) from production itself.
 */
export async function registerProduction(client, { actor = 'system', now = new Date() } = {}) {
  const marker = await systemEnvironment(client);
  if (marker !== 'production') {
    throw new MaskRefused(`Refusing to register: ${SYSTEM_ENVIRONMENT_KEY} is ${marker === null ? 'missing' : `"${marker}"`}; register only the database marked production`, 'NOT_PRODUCTION');
  }
  const identity = { ...(await databaseIdentity(client)), registeredAt: now.toISOString(), registeredBy: actor };
  await client.query('BEGIN');
  try {
    await upsertSetting(client, PRODUCTION_IDENTITY_KEY, identity, { label: 'Where the production database lives (set by the masking tool)', type: 'json', editable: false });
    await client.query(`INSERT INTO audit_log(username, entity, entity_id, action, after_data) VALUES ($1, 'database', 'masking', 'register-production', $2)`, [actor, JSON.stringify(identity)]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
  return identity;
}

async function readPolicy(client) {
  const rows = (await client.query("SELECT key, value FROM app_settings WHERE key LIKE 'security.password_%' OR key = 'limits.password_min_length'")).rows;
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const flag = (k) => s[k] !== false && s[k] !== 'false';
  return {
    minLength: Number(s['security.password_min_length'] ?? s['limits.password_min_length'] ?? 8) || 8,
    requireUpper: flag('security.password_require_upper'), requireLower: flag('security.password_require_lower'),
    requireDigit: flag('security.password_require_digit'), requireSymbol: flag('security.password_require_symbol'),
  };
}

async function maskUsers(client, cols, { adminUsername, adminPassword, staffPassword, execute }) {
  const has = new Set((cols || []).map((c) => c.name));
  const admin = (await client.query('SELECT id FROM users WHERE username = $1', [adminUsername])).rows[0];
  if (!admin) throw new MaskRefused(`Refusing to mask: no user ${adminUsername} (--admin) in this database; that administrator keeps sign-in`, 'UNKNOWN_ADMIN');
  const { policyProblems } = await import('../src/lib/password.js');
  const policy = await readPolicy(client);
  for (const [name, pw] of [['MASK_ADMIN_PASSWORD', adminPassword], ['MASK_STAFF_PASSWORD', staffPassword]]) {
    if (pw == null) continue;
    const problems = policyProblems(pw, policy);
    if (problems.length) throw new MaskRefused(`Refusing to mask: ${name} must ${problems.join(', ')} (password policy of this database)`, 'WEAK_PASSWORD');
  }
  const others = Number((await client.query('SELECT count(*)::int AS n FROM users WHERE id <> $1', [admin.id])).rows[0].n);
  const active = Number((await client.query("SELECT count(*)::int AS n FROM users WHERE id <> $1 AND status = 'active'", [admin.id])).rows[0].n);
  const twoFactor = has.has('totp_enabled') ? Number((await client.query('SELECT count(*)::int AS n FROM users WHERE totp_enabled OR totp_secret IS NOT NULL OR totp_pending_secret IS NOT NULL')).rows[0].n) : 0;
  const result = { admin: adminUsername, others, mode: staffPassword ? 'shared password, changed at first sign-in' : 'sign-in disabled', disabled: staffPassword ? 0 : active, twoFactorCleared: twoFactor };
  if (!execute) return result;
  const adminHash = await bcrypt.hash(String(adminPassword), 10);
  await client.query(`UPDATE users SET password_hash = $2, status = 'active', failed_logins = 0, must_change_password = false, password_changed_at = now() WHERE id = $1`, [admin.id, adminHash]);
  if (staffPassword) {
    const hash = await bcrypt.hash(String(staffPassword), 10);
    await client.query(`UPDATE users SET password_hash = $2, must_change_password = true, failed_logins = 0, password_changed_at = now(),
      status = CASE WHEN status = 'locked' THEN 'active' ELSE status END WHERE id <> $1`, [admin.id, hash]);
  } else {
    const hash = await bcrypt.hash(crypto.randomBytes(32).toString('base64'), 10);
    await client.query(`UPDATE users SET password_hash = $2, status = 'inactive', password_changed_at = now() WHERE id <> $1`, [admin.id, hash]);
  }
  const totp = ['totp_secret', 'totp_pending_secret', 'totp_enabled_at', 'totp_last_step'].filter((c) => has.has(c)).map((c) => `${c} = NULL`);
  if (has.has('totp_enabled')) totp.push('totp_enabled = false');
  if (has.has('token_version')) totp.push('token_version = token_version + 1');
  if (totp.length) await client.query(`UPDATE users SET ${totp.join(', ')}`);
  return result;
}

/**
 * --remark-copy: re-mark a copy restored from production, inside the masking transaction (so a dry run, a refusal or a
 * failed masking leaves the copy marked production). Guards: the operator typed the name of this database, production
 * was registered (system.production_identity, carried by the copy) and this connection is not it. Recorded in the audit
 * trail with the restore source and who ran it.
 */
async function remarkRestoredCopy(client, { marker, environment, confirmDatabase, restoreSource, actor, now }) {
  const here = await databaseIdentity(client);
  if (!confirmDatabase || confirmDatabase !== here.database) {
    throw new MaskRefused(`Refusing to re-mark: type the name of the database to re-mark with --confirm-database=<name> (this connection is to "${here.database}")`, 'CONFIRM_DATABASE');
  }
  const production = await readSetting(client, PRODUCTION_IDENTITY_KEY);
  if (!production || typeof production !== 'object') {
    throw new MaskRefused(`Refusing to re-mark: production was never registered (${PRODUCTION_IDENTITY_KEY} is missing), so this copy cannot be told from production. `
      + 'Register production once (npm run mask:data -- --register-production, in Production) and restore a new copy, or have the DBA mark this copy by hand (docs/onboarding/DATA_MASKING.md, refresh procedure step 2).', 'NO_PRODUCTION_IDENTITY');
  }
  if (sameIdentity(here, production)) {
    throw new MaskRefused(`Refusing to re-mark: this connection is the registered production database (${here.database} on ${here.host}:${here.port})`, 'PRODUCTION');
  }
  const remark = {
    from: marker, to: environment, database: here.database, host: here.host, port: here.port,
    restoreSource: String(restoreSource).trim(), productionDatabase: production.database, productionHost: production.host,
    by: actor, at: now.toISOString(),
  };
  await upsertSetting(client, SYSTEM_ENVIRONMENT_KEY, environment, { label: 'Environment of this database' });
  await upsertSetting(client, RESTORED_FROM_KEY, remark, { label: 'Restore this copy was made from (set by the masking tool)', type: 'json', editable: false });
  await client.query(`INSERT INTO audit_log(username, entity, entity_id, action, before_data, after_data) VALUES ($1, 'database', 'masking', 'remark', $2, $3)`,
    [actor, JSON.stringify({ environment: marker }), JSON.stringify(remark)]);
  return remark;
}

/**
 * Mask the personal data of the database of `client`, in one transaction. Options: environment (target), salt,
 * execute, maskStaff, keepLocality, adminUsername, adminPassword, staffPassword, actor, now (masking date).
 * Returns { executed, environment, columns, tables, users, settings, verification }. Throws MaskRefused without
 * changing anything.
 */
export async function maskData(client, {
  environment, salt, execute = false, maskStaff = false, keepLocality = true, adminUsername = 'BrokerVerse', adminPassword = null,
  staffPassword = null, actor = 'system', now = new Date(), log = () => {}, remarkCopy = false, confirmDatabase = null, restoreSource = null,
} = {}) {
  if (!salt || String(salt).length < 16) throw new MaskRefused('Refusing to mask: MASK_SALT is required (a secret of 16 characters or more, kept only for the run)', 'MISSING_SALT');
  if (!environment || !NON_PRODUCTION_ENVIRONMENTS.includes(environment)) {
    throw new MaskRefused(`Refusing to mask: --environment must name the target, one of ${NON_PRODUCTION_ENVIRONMENTS.join(', ')}`, 'BAD_ENVIRONMENT');
  }
  if (execute && !adminPassword) throw new MaskRefused('Refusing to mask: MASK_ADMIN_PASSWORD is required (the password of the administrator who keeps sign-in)', 'MISSING_ADMIN_PASSWORD');
  if (remarkCopy && !String(restoreSource || '').trim()) {
    throw new MaskRefused('Refusing to re-mark: --restore-source is required (the backup or snapshot the copy was restored from)', 'MISSING_RESTORE_SOURCE');
  }
  const m = new Masker({ salt, maskStaff, keepLocality, referenceDate: now, fileFolders: TRANSACTION_FILE_FOLDERS });

  await client.query('BEGIN');
  try {
    let marker = await systemEnvironment(client);
    const locked = await isGoLiveLocked(client);
    let remark = null;
    if (remarkCopy && (marker === 'production' || (marker === null && locked))) {
      remark = await remarkRestoredCopy(client, { marker, environment, confirmDatabase, restoreSource, actor, now });
      marker = environment;
    }
    if (marker === 'production' || (marker === null && locked)) {
      throw new MaskRefused(`Refusing to mask: this database is marked production (${marker === null ? `${GO_LIVE_LOCK_KEY} is on and ${SYSTEM_ENVIRONMENT_KEY} is missing` : `${SYSTEM_ENVIRONMENT_KEY} = production`}). `
        + 'Mask only a restored copy: the DBA marks the copy first (docs/onboarding/DATA_MASKING.md, refresh procedure step 2).', 'PRODUCTION');
    }
    if (marker !== null && !ENVIRONMENTS.includes(marker)) {
      throw new MaskRefused(`Refusing to mask: ${SYSTEM_ENVIRONMENT_KEY} has the unknown value "${marker}"; treat it as production`, 'PRODUCTION');
    }
    const columns = await tableColumns(client);
    if (!columns.has('users')) throw new MaskRefused('Refusing to mask: not a BrokerVerse database (no users table)', 'NOT_BROKERVERSE');

    log('collecting names');
    await collectNames(client, columns, m);

    const users = await maskUsers(client, columns.get('users'), { adminUsername, adminPassword, staffPassword, execute });

    const report = [];
    for (const [table, cols] of columns) {
      if (SKIP_TABLES.has(table) || TABLE_ACTIONS[table]) continue;
      const plan = planColumns(table, cols);
      if (!plan.length) continue;
      log(`masking ${table}`);
      await maskTable(client, table, plan, m, execute);
      for (const p of plan) {
        if (p.changed) report.push({ table, column: p.name, rule: p.entry?.rule || (p.fallback === 'sweep' ? 'sweep' : 'storage key'), values: p.rows, changed: p.changed });
      }
    }

    const tables = [];
    for (const [table, why] of Object.entries(TABLE_ACTIONS)) {
      if (!columns.has(table)) continue;
      const n = Number((await client.query(`SELECT count(*)::int AS n FROM ${ident(table)}`)).rows[0].n);
      tables.push({ table, action: 'emptied', rows: n, why });
      if (execute && n) await client.query(`DELETE FROM ${ident(table)}`);
    }

    const maskedAt = now.toISOString();
    const settings = { [SYSTEM_ENVIRONMENT_KEY]: environment, [MASKED_AT_KEY]: maskedAt, [EMAIL_SENDING_KEY]: false };
    if (execute) {
      await upsertSetting(client, SYSTEM_ENVIRONMENT_KEY, environment, { label: 'Environment of this database' });
      await upsertSetting(client, MASKED_AT_KEY, maskedAt, { label: 'When the personal data of this database was masked', editable: false });
      await upsertSetting(client, EMAIL_SENDING_KEY, false, { group: 'notification', label: 'Send queued e-mail', type: 'boolean' });
      if (columns.has('audit_log')) {
        await client.query(`INSERT INTO audit_log(username, entity, entity_id, action, after_data) VALUES ($1, 'database', 'masking', 'mask', $2)`, [actor, JSON.stringify({
          environment, maskedAt, previousEnvironment: remark ? remark.from : marker, remark, maskStaff, keepLocality, admin: adminUsername, users,
          columns: report.map((r) => ({ table: r.table, column: r.column, rule: r.rule, changed: r.changed })),
          tables: tables.map((t) => ({ table: t.table, rows: t.rows })),
        })]);
      }
    }
    // verified inside the transaction, before it commits (a dry run changed nothing: there is nothing to verify)
    const verification = execute ? await verifyMasked(client, { keptEmails: m.keptEmails, inTransaction: true }) : null;
    if (execute) await client.query('COMMIT');
    else await client.query('ROLLBACK');
    return { executed: execute, environment, previousEnvironment: remark ? remark.from : marker, remark, columns: report, tables, users, settings, verification, masker: m };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

// ------------------------------------------------------------------------------------------------ verification

const redact = (s) => (s.length <= 4 ? '****' : `${s.slice(0, 3)}${'*'.repeat(Math.min(8, s.length - 3))}`);

/**
 * Scan every text and JSON column of every table for personal data patterns left: e-mail addresses outside
 * example.test (staff addresses kept without --mask-staff are listed apart), mobile numbers outside the masked network
 * code and TINs outside the masked prefix. Returns { findings: [{ table, column, kind, count, examples }], kept, clean }.
 */
const PII_TOKEN_RE = /pii:1:[0-9a-f]{8}:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+/g;
/** A mobile number pattern inside an identifier (doc_a09123456789b, a hash, a storage key) is not a phone number. */
const phoneLike = (s, m) => !/[A-Za-z_]/.test(s[m.index - 1] || ' ') && !/[A-Za-z_]/.test(s[m.index + m[0].length] || ' ');

export async function verifyMasked(client, { keptEmails = null, inTransaction = false } = {}) {
  if (!inTransaction) {
    await client.query('BEGIN READ ONLY');
    try { return await verifyMasked(client, { keptEmails, inTransaction: true }); } finally { await client.query('ROLLBACK'); }
  }
  // Scanning on its own (--verify-only): the staff e-mail addresses of the database (users, employee and signatory
  // records) are the ones a run without --mask-staff kept.
  if (!keptEmails) {
    keptEmails = new Set();
    const r = await client.query(`SELECT email AS v FROM users WHERE email IS NOT NULL
      UNION ALL SELECT data::text FROM master_records WHERE type_code IN ('employee', 'signatory')`);
    for (const { v } of r.rows) for (const e of String(v).match(EMAIL_RE) || []) keptEmails.add(norm(e));
  }
  const columns = await tableColumns(client);
  const findings = [];
  const kept = [];
  // encrypted identifiers (pii:1:) are checked in clear
  const prefilter = '@|9[0-9]{2}[ .()-]{0,2}[0-9]{3}[ .-]?[0-9]{4}|[0-9]{3}[- ][0-9]{3}[- ][0-9]{3}|pii:1:';
  for (const [table, cols] of columns) {
    if (SKIP_TABLES.has(table)) continue;
    for (const c of cols) {
      if (!TEXT_TYPES.has(c.udt)) continue;
      if (c.name === 'id' || c.name.endsWith('_id')) continue; // keys are generated identifiers, not personal data
      const counts = {};
      const keptCount = { n: 0 };
      await forEachBatch(client, `SELECT ${ident(c.name)}::text AS v FROM ${ident(table)} WHERE ${ident(c.name)}::text ~ $1`, [prefilter], async (rows) => {
        for (const { v: stored } of rows) {
          const v = stored.replace(PII_TOKEN_RE, (t) => revealPii(t));
          const add = (kind, s) => { (counts[kind] ||= { count: 0, examples: [] }).count += 1; if (counts[kind].examples.length < 3) counts[kind].examples.push(redact(s)); };
          for (const e of v.match(EMAIL_RE) || []) {
            const k = norm(e);
            if (k.endsWith(`@${MASKED_EMAIL_DOMAIN}`)) continue;
            if (keptEmails.has(k) || /username/.test(c.name)) keptCount.n += 1;
            else add('email', e);
          }
          for (const m of v.matchAll(MOBILE_RE)) if (phoneLike(v, m) && !isMaskedMobile(m[0])) add('mobile', m[0]);
          for (const t of v.match(TIN_RE) || []) if (!isMaskedTin(t)) add('tin', t);
        }
      });
      for (const [kind, x] of Object.entries(counts)) findings.push({ table, column: c.name, kind, count: x.count, examples: x.examples });
      if (keptCount.n) kept.push({ table, column: c.name, kind: 'staff e-mail (kept: --mask-staff not given)', count: keptCount.n });
    }
  }
  return { findings, kept, clean: findings.length === 0 };
}

// ------------------------------------------------------------------------------------------------ files

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF_PLACEHOLDER = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n'
  + '4 0 obj<</Length 58>>stream\nBT /F1 18 Tf 72 760 Td (Document masked: client data masking) Tj ET\nendstream endobj\n'
  + '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
export function placeholderFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf') return PDF_PLACEHOLDER;
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.heic', '.tif', '.tiff'].includes(ext)) return PNG_1X1;
  return Buffer.from('This file was replaced by the client data masking tool (npm run mask:data).\n');
}

/**
 * Files of the client storage folders of the copy (TRANSACTION_FILE_FOLDERS): deleted (purge) or replaced by a
 * placeholder saved under the masked storage key (the key the database now refers to). Returns [{ folder, files }].
 */
export function maskStorage(storageDir, m, { purge = false, execute = false } = {}) {
  const root = path.resolve(storageDir);
  const out = [];
  for (const folder of TRANSACTION_FILE_FOLDERS) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    const files = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else files.push(p);
      }
    };
    walk(dir);
    if (!files.length) continue;
    out.push({ folder, files: files.length, action: purge ? 'deleted' : 'replaced by a placeholder' });
    if (!execute) continue;
    if (purge) { fs.rmSync(dir, { recursive: true, force: true }); continue; }
    for (const p of files) {
      const key = path.relative(root, p).split(path.sep).join('/');
      const masked = m.storageKey(key);
      const target = path.join(root, ...masked.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, placeholderFor(masked));
      if (target !== p) fs.rmSync(p, { force: true });
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ command line

export function parseArgs(argv) {
  const opts = {
    execute: false, environment: null, maskStaff: false, keepLocality: true, adminUsername: 'BrokerVerse', purgeFiles: false, storage: null, verifyOnly: false, help: false,
    remarkCopy: false, confirmDatabase: null, restoreSource: null, registerProduction: false,
  };
  for (const a of argv) {
    if (a === '--execute') opts.execute = true;
    else if (a === '--dry-run') opts.execute = false;
    else if (a.startsWith('--environment=')) opts.environment = a.slice(14).trim().toLowerCase();
    else if (a === '--mask-staff') opts.maskStaff = true;
    else if (a === '--mask-locality') opts.keepLocality = false;
    else if (a.startsWith('--admin=')) opts.adminUsername = a.slice(8).trim();
    else if (a === '--purge-files') opts.purgeFiles = true;
    else if (a.startsWith('--storage=')) opts.storage = a.slice(10).trim();
    else if (a === '--verify-only') opts.verifyOnly = true;
    else if (a === '--remark-copy') opts.remarkCopy = true;
    else if (a.startsWith('--confirm-database=')) opts.confirmDatabase = a.slice(19).trim();
    else if (a.startsWith('--restore-source=')) opts.restoreSource = a.slice(17).trim();
    else if (a === '--register-production') opts.registerProduction = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  if (opts.purgeFiles && !opts.storage) throw new Error('--purge-files needs --storage=<upload folder of the copy>');
  if (opts.remarkCopy && (!opts.confirmDatabase || !opts.restoreSource)) throw new Error('--remark-copy needs --confirm-database=<name of the copy> and --restore-source=<backup or snapshot>');
  return opts;
}

const USAGE = `Usage: CONFIRM_MASK=yes MASK_SALT=<secret> [MASK_ADMIN_PASSWORD=<pw>] [MASK_STAFF_PASSWORD=<pw>] npm run mask:data -- --environment=<${NON_PRODUCTION_ENVIRONMENTS.join('|')}>
         [--dry-run | --execute] [--admin=<username>] [--mask-staff] [--mask-locality] [--storage=<upload folder of the copy> [--purge-files]]
         [--remark-copy --confirm-database=<name of the copy> --restore-source=<backup or snapshot>]
       npm run mask:data -- --verify-only
       npm run mask:data -- --register-production   (once, in Production)`;

function printVerification(v, out) {
  for (const k of v.kept) out(`  kept: ${k.table}.${k.column} ${k.count} ${k.kind}`);
  if (v.clean) out('Verification: no e-mail address, mobile number or TIN left unmasked.');
  else {
    out(`Verification FAILED: personal data patterns left in ${v.findings.length} column(s):`);
    for (const f of v.findings) out(`  ${`${f.table}.${f.column}`.padEnd(44)} ${f.kind.padEnd(7)} ${String(f.count).padStart(6)}  e.g. ${f.examples.join(', ')}`);
  }
}

/** The command (exit code returned): 0 done, 2 not confirmed / usage, 3 refused, 4 personal data left, 1 error. */
export async function main(argv = process.argv.slice(2), env = process.env, { out = console.log, err = console.error } = {}) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { err(e.message); err(USAGE); return 2; }
  if (opts.help) { out(USAGE); return 0; }
  if (opts.registerProduction) {
    const { pool } = await import('../src/db/pool.js');
    const client = await pool.connect();
    try {
      const id = await registerProduction(client, { actor: env.MASK_ACTOR || env.USER || 'system' });
      out(`Registered production: ${id.database} on ${id.host}:${id.port}${id.systemIdentifier ? ` (cluster ${id.systemIdentifier})` : ''}`);
      return 0;
    } catch (e) {
      if (e instanceof MaskRefused) { err(e.message); return 3; }
      throw e;
    } finally {
      client.release();
      await pool.end();
    }
  }
  if (!opts.verifyOnly && env.CONFIRM_MASK !== 'yes') {
    err('Refusing to run: set CONFIRM_MASK=yes to confirm that DATABASE_URL is a restored COPY whose personal data is to be masked (dry run by default, --execute to mask).');
    return 2;
  }
  if (!opts.verifyOnly && (!env.MASK_SALT || env.MASK_SALT.length < 16)) {
    err('Refusing to run: MASK_SALT is required (a secret of 16 characters or more; never stored, do not reuse it for another copy).');
    return 3;
  }
  const { pool } = await import('../src/db/pool.js');
  const client = await pool.connect();
  try {
    const db = (await client.query('SELECT current_database() AS d')).rows[0].d;
    if (opts.verifyOnly) {
      out(`Verifying database ${db}`);
      const v = await verifyMasked(client);
      printVerification(v, out);
      return v.clean ? 0 : 4;
    }
    let r;
    try {
      r = await maskData(client, {
        environment: opts.environment, salt: env.MASK_SALT, execute: opts.execute, maskStaff: opts.maskStaff, keepLocality: opts.keepLocality,
        adminUsername: opts.adminUsername, adminPassword: env.MASK_ADMIN_PASSWORD || null, staffPassword: env.MASK_STAFF_PASSWORD || null,
        actor: env.MASK_ACTOR || env.USER || 'system', log: () => {},
        remarkCopy: opts.remarkCopy, confirmDatabase: opts.confirmDatabase, restoreSource: opts.restoreSource,
      });
    } catch (e) {
      if (e instanceof MaskRefused) { err(e.message); return 3; }
      throw e;
    }
    if (r.remark) out(`${r.executed ? 'Re-marked' : 'DRY RUN: would re-mark'} copy ${r.remark.database} from production to ${r.remark.to} (restored from ${r.remark.restoreSource})`);
    out(`${r.executed ? 'Masked' : 'DRY RUN: would mask'} database ${db} (${r.previousEnvironment ?? 'no environment marker'} -> ${r.environment}):`);
    for (const c of r.columns) out(`  ${`${c.table}.${c.column}`.padEnd(48)} ${c.rule.padEnd(12)} ${String(c.changed).padStart(8)} of ${c.values}`);
    for (const t of r.tables) out(`  ${t.table.padEnd(48)} ${'emptied'.padEnd(12)} ${String(t.rows).padStart(8)} row(s)`);
    out(`  users: ${r.users.admin} keeps sign-in; ${r.users.others} other user(s): ${r.users.mode}${r.users.disabled ? ` (${r.users.disabled} disabled)` : ''}; two-factor cleared for ${r.users.twoFactorCleared}`);
    out(`  settings: ${Object.entries(r.settings).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ')}`);
    if (opts.storage) {
      const files = maskStorage(opts.storage, r.masker, { purge: opts.purgeFiles, execute: r.executed });
      out(files.length ? `  files: ${files.map((f) => `${f.folder}/ ${f.files} ${r.executed ? f.action : `to be ${f.action}`}`).join(', ')}` : '  files: no client files in storage');
    } else out('  files: not touched (no --storage): purge or replace the client files of the copy before handing it over');
    if (!r.executed) { out('Nothing was changed. Run again with --execute to mask (the verification runs then).'); return 0; }
    printVerification(r.verification, out);
    return r.verification.clean ? 0 : 4;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => process.exit(code)).catch((e) => { console.error(`masking failed (nothing was changed): ${e.message}`); process.exit(1); });
}
