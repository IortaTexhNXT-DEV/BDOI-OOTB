/**
 * Settings read in code versus settings present in the database.
 *
 *   node scripts/check-settings.js            # report (DATABASE_URL must point at a migrated and seeded database)
 *   node scripts/check-settings.js --json
 *
 * "Read in code" is every key passed to getSetting / setSetting / settingExists, the report query helper setting()
 * and the sample-seed SQL function fin_setting(). A key built at run time (`email.template.${key}` in JavaScript,
 * 'numbering.' || code || '.prefix' in SQL) becomes a pattern (email.template.*). "Present" is what migrations and
 * seeds put into app_settings.
 *
 * The report has three lists:
 *   missing     read in code with a fixed key that no migration or seed creates (a typo, or a fallback that is
 *               always used). The exit code is 1 when this list is not empty.
 *   unread      in the database, but no back-end file reads it or even names it, and the front end does not name it
 *               either. Candidates for removal; check the Configuration screen and reports before deleting.
 *   frontEnd    in the database and only named by the front end (read through GET /settings or /system-settings).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(here, '..');
const FRONT_END = path.resolve(BACKEND, '..', 'brokerverse', 'src');

const READ_CALL = /\b(?:getSetting|setSetting|settingExists|setting|fin_setting)\(\s*(['"`])([^'"`]+)\1/g;
// A key read directly in SQL: SELECT value FROM app_settings WHERE key = 'receivables.due_days'
const SQL_READ = /\bkey\s*=\s*'([a-z][a-z0-9_]*\.[a-z0-9_.]+)'/g;
const KEY_LITERAL = /(['"`])([a-z][a-z0-9_]*\.[a-z0-9_.<>-]*[a-z0-9_>])\1/g;
// A key built in SQL: 'numbering.' || s.code || '.prefix'
const SQL_CONCAT = /'([a-z_.]+\.)'\s*\|\|[^|]{1,60}\|\|\s*'([a-z_.]*)'/g;

function filesUnder(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(p, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

/** A key with ${...} parts as a regular expression ("email.template.${key}" matches email.template.<anything>). */
const templatePattern = (key) => new RegExp(`^${key.split(/\$\{[^}]*\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+')}$`);

/** Keys read by back-end code: { fixed: Map(key -> [file:line]), patterns: [{ key, re }] } and every key-like literal. */
export function keysInCode(root = BACKEND) {
  const fixed = new Map();
  const patterns = [];
  const literals = new Set();
  const files = [...filesUnder(path.join(root, 'src'), ['.js']), ...filesUnder(path.join(root, 'src', 'db'), ['.sql'])];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(SQL_CONCAT)) {
      const key = `${m[1]}\${code}${m[2]}`;
      if (!patterns.some((p) => p.key === key)) patterns.push({ key, re: templatePattern(key) });
    }
    const reads = [...text.matchAll(READ_CALL)].map((m) => ({ key: m[2], index: m.index }));
    if (file.endsWith('.sql')) reads.push(...[...text.matchAll(SQL_READ)].map((m) => ({ key: m[1], index: m.index })));
    for (const m of reads) {
      const { key } = m;
      if (!key.includes('.')) continue;
      if (key.includes('${')) {
        if (!patterns.some((p) => p.key === key)) patterns.push({ key, re: templatePattern(key) });
        continue;
      }
      const where = `${path.relative(root, file)}:${text.slice(0, m.index).split('\n').length}`;
      fixed.set(key, [...(fixed.get(key) || []), where]);
    }
    if (file.endsWith('.js')) for (const m of text.matchAll(KEY_LITERAL)) literals.add(m[2]);
  }
  return { fixed, patterns, literals };
}

/** Key-like literals named by the front end (empty when the front-end folder is not next to the back end). */
export function keysInFrontEnd(dir = FRONT_END) {
  const found = new Set();
  for (const file of filesUnder(dir, ['.js', '.jsx', '.ts', '.tsx'])) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(KEY_LITERAL)) found.add(m[2]);
  }
  return found;
}

export async function checkSettings(db = pool) {
  const present = (await db.query('SELECT key, "group" FROM app_settings ORDER BY key')).rows;
  const presentKeys = new Set(present.map((r) => r.key));
  const code = keysInCode();
  const frontEnd = keysInFrontEnd();
  // "accounting.account.<role>" in a comment or message stands for every role key
  const placeholder = [...code.literals].filter((k) => k.includes('<')).map((k) => templatePattern(k.replace(/<[^>]+>/g, '${x}')));
  const readByPattern = (key) => code.patterns.some((p) => p.re.test(key)) || placeholder.some((re) => re.test(key));

  const missing = [...code.fixed.entries()].filter(([key]) => !presentKeys.has(key))
    .map(([key, where]) => ({ key, where: [...new Set(where)] }));
  const unread = [];
  const frontEndOnly = [];
  for (const { key, group } of present) {
    if (code.fixed.has(key) || code.literals.has(key) || readByPattern(key)) continue;
    (frontEnd.has(key) ? frontEndOnly : unread).push({ key, group });
  }
  return { present: present.length, readInCode: code.fixed.size, patterns: code.patterns.map((p) => p.key), missing, unread, frontEnd: frontEndOnly };
}

function print(r) {
  console.log(`${r.present} settings in the database, ${r.readInCode} fixed keys read in code, ${r.patterns.length} key patterns.`);
  console.log(`\nRead in code but not in the database (${r.missing.length}):`);
  for (const m of r.missing) console.log(`  ${m.key}  (${m.where.join(', ')})`);
  console.log(`\nIn the database, named only by the front end (${r.frontEnd.length}):`);
  for (const u of r.frontEnd) console.log(`  ${u.key}  [${u.group}]`);
  console.log(`\nIn the database, not named anywhere in code (${r.unread.length}):`);
  for (const u of r.unread) console.log(`  ${u.key}  [${u.group}]`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkSettings()
    .then((r) => {
      if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
      else print(r);
      return pool.end().then(() => process.exit(r.missing.length ? 1 : 0));
    })
    .catch((e) => { console.error(`check-settings failed: ${e.message}`); process.exit(2); });
}
