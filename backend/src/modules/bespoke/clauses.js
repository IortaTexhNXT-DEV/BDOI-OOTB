/**
 * Clause library (Master > Clause Library) and slip templates (Master > Slip Templates).
 *
 * A clause has a type, the lines of business it applies to and versioned wording. Changing the wording adds a version
 * effective from a date; the previous version then ends the day before, so a slip always knows which wording was in
 * force and which version it took. Placeholders are the {name} tokens of the wording.
 */
import { many, one, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, isoDate, today } from '../../lib/dates.js';

export const DEFAULT_CLAUSE_TYPES = ['clause', 'warranty', 'exclusion', 'endorsement', 'condition', 'deductible', 'subjectivity'];

/** The {name} placeholders of a wording, in order of first appearance. */
export function placeholdersOf(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/\{([a-z][a-z0-9_]*)\}/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Replace {name} placeholders with values; unknown ones stay visible as [name] so the slip shows what is missing. */
export function fillPlaceholders(text, values = {}) {
  return String(text || '').replace(/\{([a-z][a-z0-9_]*)\}/g, (_, k) => {
    const v = values[k];
    return v === undefined || v === null || v === '' ? `[${k}]` : String(v);
  });
}

export async function clauseTypes() {
  const list = await getSetting('bespoke.clause_types', DEFAULT_CLAUSE_TYPES);
  return Array.isArray(list) && list.length ? list : DEFAULT_CLAUSE_TYPES;
}

const lobList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim().toUpperCase()).filter(Boolean);

const versionOut = (v) => ({
  id: v.id, version: v.version, wording: v.wording, placeholders: v.placeholders || [], effectiveFrom: v.effective_from, effectiveTo: v.effective_to,
  changeNote: v.change_note, createdBy: v.created_by_name || v.created_by, createdAt: v.created_at,
});

export const clauseOut = (c, versions = null) => ({
  id: c.id, code: c.code, title: c.title, clauseType: c.clause_type, linesOfBusiness: c.lines_of_business || [], category: c.category,
  currentVersion: c.current_version, status: c.status, remarks: c.remarks, wording: c.wording ?? null, placeholders: c.placeholders || [],
  effectiveFrom: c.effective_from ?? null, effectiveTo: c.effective_to ?? null, updatedBy: c.updated_by_name || c.updated_by, updatedAt: c.updated_at,
  ...(versions ? { versions: versions.map(versionOut) } : {}),
});

/** Clause with the wording of its version in force on `date` (else its current version). */
const CLAUSE_SELECT = `SELECT c.*, v.wording, v.placeholders, v.effective_from, v.effective_to, v.version AS wording_version,
  (SELECT display_name FROM users u WHERE u.id = c.updated_by) AS updated_by_name
  FROM clause_library c LEFT JOIN LATERAL (
    SELECT * FROM clause_versions x WHERE x.clause_id = c.id
    ORDER BY (x.effective_from <= $1::date AND (x.effective_to IS NULL OR x.effective_to >= $1::date)) DESC, x.version = c.current_version DESC, x.version DESC LIMIT 1) v ON true`;

export async function listClauses(q = {}) {
  const date = isoDate(q.date) || await today();
  const params = [date];
  const where = ['TRUE'];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.status && q.status !== 'all') add('c.status = ?', q.status); else if (!q.status) where.push("c.status = 'active'");
  if (q.clauseType) add('c.clause_type = ANY(?::text[])', String(q.clauseType).split(','));
  if (q.lob) add("(c.lines_of_business = '{}' OR upper(?) = ANY(c.lines_of_business))", q.lob);
  if (q.search) add("(c.code ILIKE '%' || ? || '%' OR c.title ILIKE '%' || ? || '%' OR v.wording ILIKE '%' || ? || '%')", q.search);
  const rows = await many(`${CLAUSE_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.clause_type, c.code`, params);
  return rows.map((r) => clauseOut(r));
}

export async function getClauseRow(ref, date = null) {
  const r = await one(`${CLAUSE_SELECT} WHERE c.id::text = $2 OR c.code = upper($2)`, [date || await today(), String(ref)]);
  if (!r) throw notFound('Clause not found');
  return r;
}

export async function clauseById(ref) {
  const c = await getClauseRow(ref);
  const versions = await many(`SELECT v.*, (SELECT display_name FROM users u WHERE u.id = v.created_by) AS created_by_name FROM clause_versions v
    WHERE v.clause_id = $1 ORDER BY v.version DESC`, [c.id]);
  return clauseOut(c, versions);
}

/** One version of a clause (exact version number) with its wording. */
export async function clauseVersion(clauseId, version) {
  const v = await one('SELECT * FROM clause_versions WHERE clause_id = $1 AND version = $2', [clauseId, version]);
  if (!v) throw notFound(`Version ${version} of the clause was not found`);
  return versionOut(v);
}

async function assertType(type) {
  if (!(await clauseTypes()).includes(type)) throw badRequest(`clauseType must be one of: ${(await clauseTypes()).join(', ')}`);
}

export async function createClause(b, userId) {
  await assertType(b.clauseType);
  const code = String(b.code || '').trim().toUpperCase();
  if (await one('SELECT 1 FROM clause_library WHERE code = $1', [code])) throw conflict(`Clause ${code} already exists`);
  const from = isoDate(b.effectiveFrom) || await today();
  const id = await withTransaction(async (db) => {
    const r = await db.query(`INSERT INTO clause_library(code, title, clause_type, lines_of_business, category, remarks, status, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`, [code, b.title, b.clauseType, lobList(b.linesOfBusiness), b.category || null, b.remarks || null, b.status || 'active', userId]);
    await db.query(`INSERT INTO clause_versions(clause_id, version, wording, placeholders, effective_from, effective_to, change_note, created_by)
      VALUES ($1, 1, $2, $3, $4, $5, $6, $7)`, [r.rows[0].id, b.wording, placeholdersOf(b.wording), from, isoDate(b.effectiveTo), b.changeNote || 'Initial wording', userId]);
    return r.rows[0].id;
  });
  return clauseById(id);
}

/**
 * Update a clause. Title, type, lines, category and status change in place; a different wording adds a version
 * effective from `effectiveFrom` (default today) and closes the previous one the day before.
 */
export async function updateClause(ref, b, userId) {
  const before = await clauseById(ref);
  if (b.clauseType) await assertType(b.clauseType);
  await withTransaction(async (db) => {
    await db.query(`UPDATE clause_library SET title = COALESCE($2, title), clause_type = COALESCE($3, clause_type), lines_of_business = COALESCE($4, lines_of_business),
        category = COALESCE($5, category), remarks = COALESCE($6, remarks), status = COALESCE($7, status), updated_by = $8, updated_at = now() WHERE id = $1`,
    [before.id, b.title || null, b.clauseType || null, b.linesOfBusiness === undefined ? null : lobList(b.linesOfBusiness), b.category ?? null, b.remarks ?? null, b.status || null, userId]);
    const current = before.versions.find((v) => v.version === before.currentVersion) || before.versions[0];
    if (b.wording !== undefined && b.wording !== current?.wording) {
      const from = isoDate(b.effectiveFrom) || await today();
      if (current && from <= current.effectiveFrom) throw badRequest(`The new wording must take effect after ${current.effectiveFrom}, when version ${current.version} started`);
      const next = Math.max(...before.versions.map((v) => v.version)) + 1;
      await db.query('UPDATE clause_versions SET effective_to = $3 WHERE clause_id = $1 AND version = $2 AND (effective_to IS NULL OR effective_to >= $4)',
        [before.id, current.version, addDays(from, -1), from]);
      await db.query(`INSERT INTO clause_versions(clause_id, version, wording, placeholders, effective_from, effective_to, change_note, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [before.id, next, b.wording, placeholdersOf(b.wording), from, isoDate(b.effectiveTo), b.changeNote || null, userId]);
      await db.query('UPDATE clause_library SET current_version = $2 WHERE id = $1', [before.id, next]);
    } else if (b.effectiveTo !== undefined && current) {
      await db.query('UPDATE clause_versions SET effective_to = $3 WHERE clause_id = $1 AND version = $2', [before.id, current.version, isoDate(b.effectiveTo)]);
    }
  });
  return { before, after: await clauseById(before.id) };
}

// ---------------------------------------------------------------- slip templates

const templateOut = (t, clauses = []) => ({
  id: t.id, code: t.code, name: t.name, linesOfBusiness: t.lines_of_business || [], description: t.description, sections: t.sections || [],
  status: t.status, clauseCount: t.clause_count ?? clauses.length,
  clauses: clauses.map((c) => ({ clauseId: c.id, code: c.code, title: c.title, clauseType: c.clause_type, position: c.position, currentVersion: c.current_version, status: c.status })),
  updatedBy: t.updated_by, updatedAt: t.updated_at,
});

export async function listTemplates(q = {}) {
  const params = [];
  const where = ['TRUE'];
  if (!q.status) where.push("t.status = 'active'"); else if (q.status !== 'all') { params.push(q.status); where.push(`t.status = $${params.length}`); }
  if (q.lob) { params.push(q.lob); where.push(`(t.lines_of_business = '{}' OR upper($${params.length}) = ANY(t.lines_of_business))`); }
  const rows = await many(`SELECT t.*, (SELECT count(*)::int FROM slip_template_clauses x WHERE x.template_id = t.id) AS clause_count FROM slip_templates t
    WHERE ${where.join(' AND ')} ORDER BY t.name`, params);
  return rows.map((t) => templateOut(t));
}

export async function templateById(ref) {
  const t = await one('SELECT * FROM slip_templates WHERE id::text = $1 OR code = upper($1)', [String(ref)]);
  if (!t) throw notFound('Slip template not found');
  const clauses = await many(`SELECT c.*, x.position FROM slip_template_clauses x JOIN clause_library c ON c.id = x.clause_id
    WHERE x.template_id = $1 ORDER BY x.position, c.code`, [t.id]);
  return templateOut(t, clauses);
}

async function normaliseSections(list) {
  const known = new Map(((await getSetting('bespoke.slip_sections', [])) || []).map((s) => [s.key, s.heading]));
  return (list || []).map((s, i) => {
    const key = String(s.key || `custom_${i + 1}`).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    return { key, heading: s.heading || known.get(key) || key, text: s.text || '' };
  });
}

async function writeTemplateClauses(db, templateId, clauseIds) {
  await db.query('DELETE FROM slip_template_clauses WHERE template_id = $1', [templateId]);
  const ids = [];
  for (const ref of clauseIds || []) {
    const c = (await db.query('SELECT id FROM clause_library WHERE id::text = $1 OR code = upper($1)', [String(ref)])).rows[0];
    if (!c) throw badRequest(`Clause ${ref} is not in the clause library`);
    if (!ids.includes(c.id)) ids.push(c.id);
  }
  for (const [i, id] of ids.entries()) await db.query('INSERT INTO slip_template_clauses(template_id, clause_id, position) VALUES ($1,$2,$3)', [templateId, id, i + 1]);
}

export async function createTemplate(b, userId) {
  const code = String(b.code || '').trim().toUpperCase();
  if (await one('SELECT 1 FROM slip_templates WHERE code = $1', [code])) throw conflict(`Slip template ${code} already exists`);
  const sections = await normaliseSections(b.sections);
  const id = await withTransaction(async (db) => {
    const r = await db.query(`INSERT INTO slip_templates(code, name, lines_of_business, description, sections, status, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id`, [code, b.name, lobList(b.linesOfBusiness), b.description || null, JSON.stringify(sections), b.status || 'active', userId]);
    await writeTemplateClauses(db, r.rows[0].id, b.clauseIds);
    return r.rows[0].id;
  });
  return templateById(id);
}

export async function updateTemplate(ref, b, userId) {
  const before = await templateById(ref);
  await withTransaction(async (db) => {
    await db.query(`UPDATE slip_templates SET name = COALESCE($2, name), lines_of_business = COALESCE($3, lines_of_business), description = COALESCE($4, description),
        sections = COALESCE($5, sections), status = COALESCE($6, status), updated_by = $7, updated_at = now() WHERE id = $1`,
    [before.id, b.name || null, b.linesOfBusiness === undefined ? null : lobList(b.linesOfBusiness), b.description ?? null,
      b.sections === undefined ? null : JSON.stringify(await normaliseSections(b.sections)), b.status || null, userId]);
    if (Array.isArray(b.clauseIds)) await writeTemplateClauses(db, before.id, b.clauseIds);
  });
  return { before, after: await templateById(before.id) };
}
