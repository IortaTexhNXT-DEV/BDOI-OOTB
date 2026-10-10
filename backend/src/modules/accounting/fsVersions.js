/**
 * Financial statement versions (FGA-DS-07; migration 0527): the lines of a statement in order, each carrying a range
 * of GL accounts (GL from / GL to compared as account-code prefixes). An account belongs to the first line, by line
 * number, whose range takes it; the reports show the accounts no line takes as "Accounts not in this version".
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';

const STATEMENTS = { bs: 'Balance Sheet', is: 'Income Statement' };
export const NOT_MAPPED = 'Accounts not in this version';
const pad = (col, fill) => `rpad(${col}, 12, '${fill}')`;
/** SQL condition: the account code `code` falls in the range of the line `l`. */
export const inRange = (code, l) => `${pad(code, '0')} BETWEEN ${pad(`${l}.gl_from`, '0')} AND ${pad(`${l}.gl_to`, '9')}`;

/**
 * SQL of the accounts of every active version with the line that takes each: version_code, line_no, statement
 * (Balance Sheet / Income Statement), section, caption, normal_balance, code, name. A version of scope income leaves the
 * balance sheet accounts out; an account no line takes gets line 9999 and the caption NOT_MAPPED.
 */
export const FS_MAP = `SELECT fv.code AS version_code, COALESCE(m.line_no, 9999) AS line_no,
    COALESCE(CASE m.statement WHEN 'bs' THEN '${STATEMENTS.bs}' WHEN 'is' THEN '${STATEMENTS.is}' END,
      CASE WHEN a.account_type IN ('income', 'expense') THEN '${STATEMENTS.is}' ELSE '${STATEMENTS.bs}' END) AS statement,
    COALESCE(m.section, 'Not mapped') AS section, COALESCE(m.caption, '${NOT_MAPPED}') AS caption,
    COALESCE(m.normal_balance, CASE WHEN a.account_type IN ('asset', 'expense') THEN 'debit' ELSE 'credit' END) AS normal_balance, a.code, a.name
  FROM fs_versions fv CROSS JOIN gl_accounts a
  LEFT JOIN LATERAL (SELECT v.* FROM fs_version_lines v WHERE v.version_code = fv.code AND ${inRange('a.code', 'v')} ORDER BY v.line_no LIMIT 1) m ON true
  WHERE fv.status = 'active' AND (fv.scope = 'full' OR a.account_type IN ('income', 'expense'))`;

const versionRow = (v) => ({ code: v.code, name: v.name, purpose: v.purpose, scope: v.scope, status: v.status, lineCount: Number(v.line_count ?? 0),
  updatedAt: v.updated_at, updatedBy: v.updated_by_name || null });
const lineRow = (l) => ({ lineNo: l.line_no, statement: l.statement, section: l.section, caption: l.caption, glFrom: l.gl_from, glTo: l.gl_to, normalBalance: l.normal_balance,
  accounts: Number(l.accounts ?? 0) });

export async function listVersions(db) {
  return (await db.query(`SELECT v.*, (SELECT count(*) FROM fs_version_lines l WHERE l.version_code = v.code) AS line_count,
      (SELECT display_name FROM users WHERE id = v.updated_by) AS updated_by_name FROM fs_versions v ORDER BY v.code`)).rows.map(versionRow);
}

/** A version with its lines (and how many accounts each line takes) and the accounts no line takes. */
export async function getVersion(db, code) {
  const v = (await db.query(`SELECT v.*, (SELECT display_name FROM users WHERE id = v.updated_by) AS updated_by_name FROM fs_versions v WHERE v.code = $1`, [String(code)])).rows[0];
  if (!v) throw notFound(`Financial statement version ${code} not found`);
  const lines = (await db.query(`SELECT l.*, (SELECT count(*) FROM (${FS_MAP}) f WHERE f.version_code = l.version_code AND f.line_no = l.line_no) AS accounts
    FROM fs_version_lines l WHERE l.version_code = $1 ORDER BY l.line_no`, [v.code])).rows;
  const unmapped = (await db.query(`SELECT a.code, a.name, a.account_type FROM gl_accounts a
    WHERE a.status = 'active' AND ($2 = 'full' OR a.account_type IN ('income', 'expense'))
      AND NOT EXISTS (SELECT 1 FROM fs_version_lines l WHERE l.version_code = $1 AND ${inRange('a.code', 'l')}) ORDER BY a.code`, [v.code, v.scope])).rows;
  return { ...versionRow({ ...v, line_count: lines.length }), lines: lines.map(lineRow), unmapped: unmapped.map((a) => ({ code: a.code, name: a.name, accountType: a.account_type })) };
}

const fail = (path, message) => badRequest('Validation failed', [{ path, message }]);

function checkLines(lines, scope) {
  if (!Array.isArray(lines) || !lines.length) throw fail('lines', 'Add at least one line');
  const seen = new Set();
  return lines.map((l, i) => {
    const at = (f) => `lines.${i}.${f}`;
    const lineNo = Number(l.lineNo);
    if (!Number.isInteger(lineNo) || lineNo < 1) throw fail(at('lineNo'), 'Line number must be a whole number from 1');
    if (seen.has(lineNo)) throw fail(at('lineNo'), `Line ${lineNo} is used twice`);
    seen.add(lineNo);
    if (!STATEMENTS[l.statement]) throw fail(at('statement'), 'Choose Balance Sheet or Income Statement');
    if (scope === 'income' && l.statement !== 'is') throw fail(at('statement'), 'A budget version has income statement lines only');
    const caption = String(l.caption || '').trim();
    const section = String(l.section || '').trim();
    if (!caption) throw fail(at('caption'), 'Caption is required');
    if (!section) throw fail(at('section'), 'Section is required');
    const from = String(l.glFrom || '').trim();
    const to = String(l.glTo || '').trim();
    if (!/^[0-9A-Za-z]{1,12}$/.test(from)) throw fail(at('glFrom'), 'GL from must be an account code or its first digits');
    if (!/^[0-9A-Za-z]{1,12}$/.test(to)) throw fail(at('glTo'), 'GL to must be an account code or its first digits');
    if (from.padEnd(12, '0') > to.padEnd(12, '9')) throw fail(at('glTo'), 'GL to must not come before GL from');
    if (!['debit', 'credit'].includes(l.normalBalance)) throw fail(at('normalBalance'), 'Choose debit or credit');
    return { lineNo, statement: l.statement, section, caption, from, to, normalBalance: l.normalBalance };
  });
}

async function writeLines(db, code, lines) {
  await db.query('DELETE FROM fs_version_lines WHERE version_code = $1', [code]);
  for (const l of lines) {
    await db.query(`INSERT INTO fs_version_lines(version_code, line_no, statement, section, caption, gl_from, gl_to, normal_balance) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [code, l.lineNo, l.statement, l.section, l.caption, l.from, l.to, l.normalBalance]);
  }
}

/** Add a version (b: { code, name, purpose, scope, lines } or { code, name, copyFrom } to start from another version's lines). */
export async function createVersion(db, b, user) {
  const code = String(b.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) throw fail('code', 'Code must be 2 to 20 letters, digits or dashes');
  if ((await db.query('SELECT 1 FROM fs_versions WHERE code = $1', [code])).rows[0]) throw conflict(`Financial statement version ${code} already exists`);
  const name = String(b.name || '').trim();
  if (!name) throw fail('name', 'Name is required');
  const source = b.copyFrom ? await getVersion(db, b.copyFrom) : null;
  const scope = b.scope || source?.scope || 'full';
  if (!['full', 'income'].includes(scope)) throw fail('scope', 'Choose full statements or income statement only');
  const lines = checkLines(source ? source.lines : b.lines, scope);
  await db.query('INSERT INTO fs_versions(code, name, purpose, scope, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$5)', [code, name, b.purpose || null, scope, user.id]);
  await writeLines(db, code, lines);
  return getVersion(db, code);
}

/** Change a version: name, purpose, status and its lines (the whole list replaces the current one). */
export async function updateVersion(db, code, b, user) {
  const before = await getVersion(db, code);
  const scope = b.scope || before.scope;
  if (!['full', 'income'].includes(scope)) throw fail('scope', 'Choose full statements or income statement only');
  const status = b.status || before.status;
  if (!['active', 'inactive'].includes(status)) throw fail('status', 'Choose active or inactive');
  const name = b.name === undefined ? before.name : String(b.name || '').trim();
  if (!name) throw fail('name', 'Name is required');
  const lines = b.lines === undefined ? null : checkLines(b.lines, scope);
  if (!lines && scope === 'income' && before.lines.some((l) => l.statement !== 'is')) throw fail('scope', 'A budget version has income statement lines only');
  if (status === 'inactive' && before.status === 'active') {
    const def = (await db.query('SELECT value FROM app_settings WHERE key = \'accounting.default_fs_version\'')).rows[0]?.value;
    if (def === before.code) throw conflict(`${before.code} is the default version of the reports; choose another default before you deactivate it`);
  }
  await db.query('UPDATE fs_versions SET name = $2, purpose = $3, scope = $4, status = $5, updated_by = $6, updated_at = now() WHERE code = $1',
    [before.code, name, b.purpose === undefined ? before.purpose : b.purpose || null, scope, status, user.id]);
  if (lines) await writeLines(db, before.code, lines);
  return { before, after: await getVersion(db, before.code) };
}
