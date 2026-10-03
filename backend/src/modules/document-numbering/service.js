/**
 * Document Numbering master: the document series (prefix, pattern, width, reset rule) behind every number the system
 * issues. Numbers are issued by next_document_number() (src/lib/numbering.js); this module lists, previews and
 * maintains the series. The next number can only move forward, never below the highest number already issued.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';

export const TOKENS = ['{PREFIX}', '{YYYY}', '{YY}', '{MM}', '{FY}', '{BRANCH}', '{LOB}', '{SEQ}'];
export const RESET_RULES = ['yearly', 'fiscal_yearly', 'monthly', 'never'];

const SELECT = `SELECT d.*, k.period_key, q.value AS current_value,
    format_document_number(d.pattern, d.prefix, d.seq_width, COALESCE(q.value + 1, d.start_number), k.today, NULL, NULL) AS next_preview,
    (SELECT u.display_name FROM users u WHERE u.id::text = d.updated_by) AS updated_by_name
  FROM document_numbering d
  CROSS JOIN LATERAL (SELECT numbering_business_date() AS today, numbering_period_key(d.reset_rule, numbering_business_date()) AS period_key) k
  LEFT JOIN sequences q ON q.name = d.code AND q.period = k.period_key`;

export const toSeries = (r) => ({
  id: r.id, code: r.code, name: r.name, module: r.module, prefix: r.prefix, pattern: r.pattern, seqWidth: r.seq_width,
  resetRule: r.reset_rule, startNumber: Number(r.start_number), active: r.active, description: r.description,
  periodKey: r.period_key, currentValue: r.current_value === null || r.current_value === undefined ? 0 : Number(r.current_value),
  nextNumber: r.current_value === null || r.current_value === undefined ? Number(r.start_number) : Number(r.current_value) + 1,
  nextPreview: r.next_preview, updatedBy: r.updated_by_name || r.updated_by, updatedAt: r.updated_at,
});

export async function listSeries({ module, search, active } = {}) {
  const where = ['TRUE'];
  const values = [];
  const add = (sql, v) => { values.push(v); where.push(sql.replaceAll('?', `$${values.length}`)); };
  if (module) add('d.module = ?', String(module));
  if (search) add('(d.code ILIKE ? OR d.name ILIKE ? OR d.prefix ILIKE ?)', `%${search}%`);
  if (active === 'true' || active === true) where.push('d.active');
  if (active === 'false' || active === false) where.push('NOT d.active');
  return (await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY d.module, d.name`, values)).map(toSeries);
}

export async function getSeries(code, db = null) {
  const row = db ? (await db.query(`${SELECT} WHERE d.code = $1`, [code])).rows[0] : await one(`${SELECT} WHERE d.code = $1`, [code]);
  if (!row) throw notFound(`Document numbering series ${code} not found`);
  return toSeries(row);
}

/** Pattern rules: known tokens only, {PREFIX} and {SEQ} present, and a period token for the reset rule (else numbers would repeat). */
export function validatePattern(pattern, resetRule) {
  const errors = [];
  const unknown = (pattern.match(/\{[^}]*\}/g) || []).filter((t) => !TOKENS.includes(t));
  if (unknown.length) errors.push({ path: 'pattern', message: `Unknown token(s) ${unknown.join(', ')}; use ${TOKENS.join(' ')}` });
  if (/[{}]/.test(pattern.replace(/\{[^}]*\}/g, ''))) errors.push({ path: 'pattern', message: 'Unbalanced brace in pattern' });
  for (const t of ['{PREFIX}', '{SEQ}']) if (!pattern.includes(t)) errors.push({ path: 'pattern', message: `Pattern must contain ${t}` });
  const hasYear = pattern.includes('{YYYY}') || pattern.includes('{YY}');
  if (resetRule === 'yearly' && !hasYear) errors.push({ path: 'pattern', message: 'A yearly reset needs {YYYY} or {YY} in the pattern' });
  if (resetRule === 'fiscal_yearly' && !pattern.includes('{FY}')) errors.push({ path: 'pattern', message: 'A fiscal-year reset needs {FY} in the pattern' });
  if (resetRule === 'monthly' && !(pattern.includes('{MM}') && (hasYear || pattern.includes('{FY}')))) {
    errors.push({ path: 'pattern', message: 'A monthly reset needs {MM} and a year ({YYYY}, {YY} or {FY}) in the pattern' });
  }
  if (!/^[A-Za-z0-9{}\-/_.]+$/.test(pattern)) errors.push({ path: 'pattern', message: 'Pattern may contain letters, digits, tokens and the separators - / _ .' });
  return errors;
}

const COLUMNS = { name: 'name', module: 'module', prefix: 'prefix', pattern: 'pattern', seqWidth: 'seq_width', resetRule: 'reset_rule', startNumber: 'start_number', active: 'active', description: 'description' };

export async function updateSeries(code, input, user) {
  return withTransaction(async (db) => {
    const before = (await db.query('SELECT * FROM document_numbering WHERE code = $1 FOR UPDATE', [code])).rows[0];
    if (!before) throw notFound(`Document numbering series ${code} not found`);
    const next = {
      pattern: input.pattern ?? before.pattern, resetRule: input.resetRule ?? before.reset_rule,
      prefix: input.prefix ?? before.prefix, active: input.active ?? before.active,
    };
    const errors = validatePattern(next.pattern, next.resetRule);
    if (errors.length) throw badRequest('Validation failed', errors);
    if (next.active) {
      const clash = (await db.query('SELECT code, name FROM document_numbering WHERE upper(prefix) = upper($1) AND active AND code <> $2', [next.prefix, code])).rows[0];
      if (clash) throw conflict(`Prefix ${next.prefix} is already used by the active series ${clash.name} (${clash.code})`);
    }
    const sets = [];
    const values = [code];
    for (const [key, col] of Object.entries(COLUMNS)) {
      if (input[key] === undefined) continue;
      values.push(input[key]);
      sets.push(`${col} = $${values.length}`);
    }
    if (!sets.length) return { before: await getSeries(code, db), after: await getSeries(code, db) };
    const beforeOut = await getSeries(code, db);
    values.push(user?.id ?? null);
    await db.query(`UPDATE document_numbering SET ${sets.join(', ')}, updated_by = $${values.length} WHERE code = $1`, values);
    return { before: beforeOut, after: await getSeries(code, db) };
  });
}

/** Preview the next number, optionally with unsaved pattern / prefix / width / reset values from the edit dialog. */
export async function previewSeries(code, q = {}) {
  const s = await getSeries(code);
  const pattern = q.pattern ?? s.pattern;
  const resetRule = q.resetRule ?? s.resetRule;
  const errors = validatePattern(pattern, resetRule);
  const width = q.seqWidth === undefined ? s.seqWidth : Number(q.seqWidth);
  if (!Number.isInteger(width) || width < 1 || width > 12) errors.push({ path: 'seqWidth', message: 'seqWidth must be a whole number from 1 to 12' });
  if (q.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(q.date))) errors.push({ path: 'date', message: 'date must be YYYY-MM-DD' });
  if (errors.length) return { valid: false, errors, preview: null };
  const r = await one(`SELECT k.d AS date, numbering_period_key($3, k.d) AS period_key,
      (SELECT value FROM sequences WHERE name = $1 AND period = numbering_period_key($3, k.d)) AS current_value
    FROM (SELECT COALESCE($2::date, numbering_business_date()) AS d) k`, [code, q.date || null, resetRule]);
  // a changed reset rule starts a new counter period: preview from the start number
  const seq = r.current_value === null || r.current_value === undefined ? Number(q.startNumber ?? s.startNumber) : Number(r.current_value) + 1;
  const f = await one('SELECT format_document_number($1, $2, $3, $4, $5::date, $6, $7) AS n', [pattern, q.prefix ?? s.prefix, width, seq, r.date, q.branch || null, q.lob || null]);
  return { valid: true, errors: [], preview: f.n, periodKey: r.period_key, currentValue: Number(r.current_value || 0), nextNumber: seq };
}

/**
 * Move the next number of the current period forward (e.g. to continue after a manual series). Never backwards: the
 * counter is only raised when the new value is above the highest number issued, checked in one statement.
 */
export async function setNextNumber(code, nextNumber, user) {
  return withTransaction(async (db) => {
    const s = (await db.query('SELECT * FROM document_numbering WHERE code = $1 FOR UPDATE', [code])).rows[0];
    if (!s) throw notFound(`Document numbering series ${code} not found`);
    const before = await getSeries(code, db);
    const target = nextNumber - 1;
    const r = await db.query(`INSERT INTO sequences(name, period, value) VALUES ($1, numbering_period_key($2, numbering_business_date()), $3)
      ON CONFLICT (name, period) DO UPDATE SET value = EXCLUDED.value WHERE sequences.value <= EXCLUDED.value RETURNING value`, [code, s.reset_rule, target]);
    if (!r.rowCount) {
      throw conflict(`The next number cannot go backwards: ${before.nextNumber - 1} has already been issued in period ${before.periodKey}; enter ${before.nextNumber} or more`);
    }
    await db.query('UPDATE document_numbering SET updated_by = $2, updated_at = now() WHERE code = $1', [code, user?.id ?? null]);
    return { before, after: await getSeries(code, db) };
  });
}

export async function modules() {
  return (await many('SELECT module, count(*)::int AS count FROM document_numbering GROUP BY module ORDER BY module')).map((r) => ({ module: r.module, count: r.count }));
}
