/**
 * Slip composer: the wording of a bespoke Request for Quotation (broker slip) or placement slip. A slip starts blank or
 * from a template, clauses are added from the library (keeping their clause id and version), removed, reordered or
 * reworded for this slip only (manuscript). Every save is a new version with a snapshot and the list of changes.
 *
 * Placeholder values: those derived from the linked broker slip / placement (insured, sum insured, period, situation,
 * premium) overridden by the values entered on the slip.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { formatAmount } from '../../lib/pdf/format.js';
import { num } from '../../lib/money.js';
import { clauseTypes, fillPlaceholders, getClauseRow, templateById } from './clauses.js';
import { diffSnapshots } from './diff.js';

const SELECT = `SELECT s.*, b.slip_number AS broker_slip_number, b.insured_name AS bs_insured, b.lob AS bs_lob, p.placement_number, p.insured_name AS pl_insured,
  t.code AS template_code, t.name AS template_name, (SELECT display_name FROM users u WHERE u.id = s.updated_by) AS updated_by_name,
  (SELECT display_name FROM users u WHERE u.id = s.created_by) AS created_by_name
  FROM composed_slips s LEFT JOIN broker_slips b ON b.id = s.broker_slip_id LEFT JOIN placements p ON p.id = s.placement_id
  LEFT JOIN slip_templates t ON t.id = s.template_id`;

export async function getComposedRow(ref, db = null) {
  const r = (await (db || { query }).query(`${SELECT} WHERE s.id = $1 OR s.slip_number = $1`, [String(ref)])).rows[0];
  if (!r) throw notFound('Composed slip not found');
  return r;
}

/** Placeholder values taken from the broker slip or placement the slip belongs to. */
export async function derivedVariables(row) {
  const out = {};
  let src = null;
  if (row.placement_id) {
    src = await one('SELECT insured_name, sum_insured, currency, inception_date, expiry_date, premium_base AS premium, doc FROM placements WHERE id = $1', [row.placement_id]);
    if (src) src.risk = src.doc?.riskDetails || {};
  } else if (row.broker_slip_id) {
    src = await one('SELECT insured_name, sum_insured, currency, inception_date, expiry_date, NULL::numeric AS premium, risk_details AS risk FROM broker_slips WHERE id = $1', [row.broker_slip_id]);
  }
  if (!src) return out;
  const risk = src.risk || {};
  const set = (k, v) => { if (v !== undefined && v !== null && v !== '') out[k] = v; };
  set('insured_name', src.insured_name);
  set('currency', src.currency);
  if (num(src.sum_insured)) set('sum_insured', formatAmount(num(src.sum_insured)));
  if (num(src.premium)) set('premium', formatAmount(num(src.premium)));
  set('period_from', src.inception_date);
  set('period_to', src.expiry_date);
  set('situation', risk.location || risk.locationAddress || risk.situation);
  set('voyage', risk.voyage);
  return out;
}

const clauseOut = (c) => ({
  id: Number(c.id), position: c.position, clauseId: c.clause_id, clauseVersion: c.clause_version, code: c.code, title: c.title, clauseType: c.clause_type,
  wording: c.wording, libraryWording: c.library_wording, manuscript: c.clause_id ? c.wording !== c.library_wording : true,
  latestVersion: c.latest_version ?? null, newerVersionAvailable: Boolean(c.clause_id && c.latest_version && c.latest_version > c.clause_version),
});

async function clausesOf(slipId) {
  const rows = await many(`SELECT x.*, c.current_version AS latest_version FROM composed_slip_clauses x LEFT JOIN clause_library c ON c.id = x.clause_id
    WHERE x.slip_id = $1 ORDER BY x.position`, [slipId]);
  return rows.map(clauseOut);
}

/** The state that is versioned: what the snapshot holds. */
const snapshotOf = (row, clauses) => ({
  title: row.title, status: row.status, variables: row.variables || {}, sections: row.sections || [],
  clauses: clauses.map((c) => ({ clauseId: c.clauseId, clauseVersion: c.clauseVersion, code: c.code, title: c.title, clauseType: c.clauseType, wording: c.wording, manuscript: c.manuscript })),
});

export async function composedById(ref) {
  const row = await getComposedRow(ref);
  const clauses = await clausesOf(row.id);
  const derived = await derivedVariables(row);
  const values = { ...derived, ...(row.variables || {}) };
  const types = await clauseTypes();
  const versions = await many(`SELECT v.version, v.changes, v.change_note, v.created_at, v.created_by, (SELECT display_name FROM users u WHERE u.id = v.created_by) AS created_by_name
    FROM composed_slip_versions v WHERE v.slip_id = $1 ORDER BY v.version DESC`, [row.id]);
  return {
    id: row.id, slipNumber: row.slip_number, title: row.title, status: row.status, version: row.version, lob: row.lob,
    brokerSlipId: row.broker_slip_id, brokerSlipNumber: row.broker_slip_number, placementId: row.placement_id, placementNumber: row.placement_number,
    insuredName: row.pl_insured || row.bs_insured || derived.insured_name || null, templateId: row.template_id, templateCode: row.template_code, templateName: row.template_name,
    variables: row.variables || {}, derivedVariables: derived, values,
    sections: (row.sections || []).map((s) => ({ ...s, rendered: fillPlaceholders(s.text, values) })),
    clauses: clauses.map((c) => ({ ...c, rendered: fillPlaceholders(c.wording, values) })).sort((a, b) => a.position - b.position),
    clauseTypeOrder: types,
    missingPlaceholders: [...new Set([...(row.sections || []).map((s) => s.text), ...clauses.map((c) => c.wording)].flatMap((t) => [...String(t || '').matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map((m) => m[1]))
      .filter((k) => values[k] === undefined || values[k] === null || values[k] === ''))],
    versions: versions.map((v) => ({ version: v.version, changes: v.changes, changeNote: v.change_note, changedBy: v.created_by_name || v.created_by, changedAt: v.created_at })),
    finalisedAt: row.finalised_at, createdBy: row.created_by_name || row.created_by, createdAt: row.created_at, updatedBy: row.updated_by_name || row.updated_by, updatedAt: row.updated_at,
  };
}

export async function listComposed(q = {}) {
  const params = [];
  const where = ["s.status <> 'cancelled'"];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (q.brokerSlipId) add('(s.broker_slip_id = ? OR b.slip_number = ?)', q.brokerSlipId);
  if (q.placementId) add('(s.placement_id = ? OR p.placement_number = ?)', q.placementId);
  if (q.status) { where.shift(); add('s.status = ANY(?::text[])', String(q.status).split(',')); }
  if (q.search) add("(s.slip_number ILIKE '%' || ? || '%' OR s.title ILIKE '%' || ? || '%' OR b.insured_name ILIKE '%' || ? || '%' OR p.insured_name ILIKE '%' || ? || '%')", q.search);
  const rows = await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY s.updated_at DESC LIMIT 200`, params);
  return rows.map((r) => ({ id: r.id, slipNumber: r.slip_number, title: r.title, status: r.status, version: r.version, lob: r.lob, brokerSlipId: r.broker_slip_id,
    brokerSlipNumber: r.broker_slip_number, placementId: r.placement_id, placementNumber: r.placement_number, insuredName: r.pl_insured || r.bs_insured || null,
    templateName: r.template_name, updatedBy: r.updated_by_name || r.updated_by, updatedAt: r.updated_at }));
}

async function writeClauses(db, slipId, clauses) {
  await db.query('DELETE FROM composed_slip_clauses WHERE slip_id = $1', [slipId]);
  for (const [i, c] of clauses.entries()) {
    await db.query(`INSERT INTO composed_slip_clauses(slip_id, position, clause_id, clause_version, code, title, clause_type, wording, library_wording)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [slipId, i + 1, c.clauseId || null, c.clauseVersion || null, c.code || null, c.title, c.clauseType, c.wording, c.libraryWording ?? null]);
  }
}

/**
 * Resolve the clauses sent by the composer: a library clause (clauseId, optional clauseVersion, optional wording to
 * make it manuscript) or a manuscript clause (title, clauseType, wording). The library wording of the version is kept
 * so the slip shows whether the text was changed.
 */
async function resolveClauses(list) {
  const types = await clauseTypes();
  const out = [];
  for (const [i, c] of (list || []).entries()) {
    if (c.clauseId || (c.code && !c.manuscriptOnly)) {
      const lib = await one('SELECT * FROM clause_library WHERE id::text = $1 OR code = upper($1)', [String(c.clauseId || c.code)]);
      if (!lib) throw badRequest(`Clause ${c.clauseId || c.code} (line ${i + 1}) is not in the clause library`);
      const version = Number(c.clauseVersion) || null;
      const v = version
        ? await one('SELECT * FROM clause_versions WHERE clause_id = $1 AND version = $2', [lib.id, version])
        : await one(`SELECT * FROM clause_versions WHERE clause_id = $1 AND effective_from <= $2::date AND (effective_to IS NULL OR effective_to >= $2::date)
            ORDER BY version DESC LIMIT 1`, [lib.id, await today()]) || await one('SELECT * FROM clause_versions WHERE clause_id = $1 AND version = $2', [lib.id, lib.current_version]);
      if (!v) throw badRequest(`Version ${version} of clause ${lib.code} was not found`);
      out.push({ clauseId: lib.id, clauseVersion: v.version, code: lib.code, title: c.title || lib.title, clauseType: lib.clause_type,
        wording: c.wording !== undefined && c.wording !== null && String(c.wording).trim() !== '' ? String(c.wording) : v.wording, libraryWording: v.wording });
    } else {
      if (!c.title || !String(c.wording || '').trim()) throw badRequest(`A manuscript clause (line ${i + 1}) needs a title and a wording`);
      if (!types.includes(c.clauseType)) throw badRequest(`clauseType of "${c.title}" must be one of: ${types.join(', ')}`);
      out.push({ clauseId: null, clauseVersion: null, code: c.code || null, title: c.title, clauseType: c.clauseType, wording: String(c.wording), libraryWording: null });
    }
  }
  return out;
}

async function normaliseSections(list) {
  const known = new Map(((await getSetting('bespoke.slip_sections', [])) || []).map((s) => [s.key, s.heading]));
  const seen = new Set();
  return (list || []).map((s, i) => {
    const key = String(s.key || `custom_${i + 1}`).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (seen.has(key)) throw badRequest(`Section ${key} appears twice`);
    seen.add(key);
    return { key, heading: String(s.heading || known.get(key) || key), text: String(s.text ?? '') };
  });
}

async function saveVersion(db, slipId, version, snapshot, previous, changeNote, userId, initial = null) {
  const changes = initial ? [initial] : diffSnapshots(previous, snapshot).changes;
  await db.query('INSERT INTO composed_slip_versions(slip_id, version, snapshot, changes, change_note, created_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [slipId, version, JSON.stringify(snapshot), JSON.stringify(changes), changeNote || null, userId]);
  return changes;
}

/** New composed slip for a broker slip or placement: blank, or from a template (its sections and clauses in force today). */
export async function createComposed(b, userId) {
  let lob = b.lob || null;
  let title = b.title || null;
  if (b.brokerSlipId) {
    const s = await one('SELECT id, slip_number, lob, insured_name FROM broker_slips WHERE id = $1 OR slip_number = $1', [String(b.brokerSlipId)]);
    if (!s) throw badRequest(`Broker slip ${b.brokerSlipId} not found`);
    b = { ...b, brokerSlipId: s.id };
    lob = lob || s.lob;
    title = title || `Request for quotation ${s.slip_number}${s.insured_name ? ` - ${s.insured_name}` : ''}`;
  }
  if (b.placementId) {
    const p = await one('SELECT id, placement_number, lob, insured_name FROM placements WHERE id = $1 OR placement_number = $1', [String(b.placementId)]);
    if (!p) throw badRequest(`Placement slip ${b.placementId} not found`);
    b = { ...b, placementId: p.id };
    lob = lob || p.lob;
    title = title || `Placement slip ${p.placement_number}${p.insured_name ? ` - ${p.insured_name}` : ''}`;
  }
  let sections = [];
  let clauses = [];
  let template = null;
  if (b.templateId) {
    template = await templateById(b.templateId);
    if (template.status !== 'active') throw badRequest(`Slip template ${template.code} is not active`);
    sections = template.sections;
    clauses = await resolveClauses(template.clauses.filter((c) => c.status === 'active').map((c) => ({ clauseId: c.clauseId })));
  } else if (b.blank !== false) {
    const std = (await getSetting('bespoke.slip_sections', [])) || [];
    sections = std.map((s) => ({ key: s.key, heading: s.heading, text: '' }));
  }
  if (Array.isArray(b.sections)) sections = b.sections;
  if (Array.isArray(b.clauses)) clauses = await resolveClauses(b.clauses);
  sections = await normaliseSections(sections);
  const id = await withTransaction(async (db) => {
    const number = await nextDocumentNumber('composed_slip', { db, unique: { table: 'composed_slips', column: 'slip_number' } });
    const r = await db.query(`INSERT INTO composed_slips(slip_number, title, broker_slip_id, placement_id, template_id, lob, variables, sections, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *`,
    [number, title || template?.name || 'Bespoke slip', b.brokerSlipId || null, b.placementId || null, template?.id || null, lob, JSON.stringify(b.variables || {}), JSON.stringify(sections), userId]);
    await writeClauses(db, r.rows[0].id, clauses);
    const snap = snapshotOf(r.rows[0], clauses.map((c) => ({ ...c, manuscript: c.clauseId ? c.wording !== c.libraryWording : true })));
    await saveVersion(db, r.rows[0].id, 1, snap, null, b.changeNote, userId, template ? `Created from template ${template.code}` : 'Created blank');
    return r.rows[0].id;
  });
  return composedById(id);
}

/**
 * Save the composer: title, placeholder values, sections and clauses (the whole list in order). A save that changes
 * nothing is not a version. Only a draft slip can be edited.
 */
export async function saveComposed(ref, b, userId) {
  const row = await getComposedRow(ref);
  if (row.status !== 'draft') throw conflict(`A ${row.status} slip cannot be edited${row.status === 'final' ? ': reopen it first' : ''}`);
  const beforeClauses = await clausesOf(row.id);
  const previous = snapshotOf(row, beforeClauses);
  const sections = b.sections === undefined ? row.sections || [] : await normaliseSections(b.sections);
  const clauses = b.clauses === undefined
    ? beforeClauses.map((c) => ({ ...c, libraryWording: c.libraryWording }))
    : await resolveClauses(b.clauses);
  const next = { ...row, title: b.title || row.title, variables: b.variables === undefined ? row.variables || {} : b.variables, sections };
  const snapshot = snapshotOf(next, clauses.map((c) => ({ ...c, manuscript: c.clauseId ? c.wording !== c.libraryWording : true })));
  const { changes } = diffSnapshots(previous, snapshot);
  if (!changes.length) return { changes: [], unchanged: true, slip: await composedById(row.id) };
  await withTransaction(async (db) => {
    const version = row.version + 1;
    await db.query('UPDATE composed_slips SET title = $2, variables = $3, sections = $4, version = $5, updated_by = $6, updated_at = now() WHERE id = $1',
      [row.id, next.title, JSON.stringify(next.variables), JSON.stringify(sections), version, userId]);
    await writeClauses(db, row.id, clauses);
    await saveVersion(db, row.id, version, snapshot, previous, b.changeNote, userId);
  });
  return { changes, unchanged: false, slip: await composedById(row.id) };
}

/** draft -> final (printed and sent); final -> draft (reopen); any -> cancelled. Each is a version. */
export async function setComposedStatus(ref, status, userId, note = null) {
  const row = await getComposedRow(ref);
  const allowed = { final: ['draft'], draft: ['final'], cancelled: ['draft', 'final'] };
  if (!allowed[status]?.includes(row.status)) throw conflict(`A ${row.status} slip cannot become ${status}`);
  const clauses = await clausesOf(row.id);
  const previous = snapshotOf(row, clauses);
  await withTransaction(async (db) => {
    const version = row.version + 1;
    await db.query(`UPDATE composed_slips SET status = $2, version = $3, finalised_at = CASE WHEN $2 = 'final' THEN now() ELSE finalised_at END,
        finalised_by = CASE WHEN $2 = 'final' THEN $4 ELSE finalised_by END, updated_by = $4, updated_at = now() WHERE id = $1`, [row.id, status, version, userId]);
    await saveVersion(db, row.id, version, { ...previous, status }, previous, note, userId);
  });
  return { before: previous, slip: await composedById(row.id) };
}

export async function versionSnapshot(ref, version) {
  const row = await getComposedRow(ref);
  const v = await one(`SELECT v.*, (SELECT display_name FROM users u WHERE u.id = v.created_by) AS created_by_name FROM composed_slip_versions v
    WHERE v.slip_id = $1 AND v.version = $2`, [row.id, Number(version)]);
  if (!v) throw notFound(`Version ${version} of ${row.slip_number} was not found`);
  return { version: v.version, snapshot: v.snapshot, changes: v.changes, changeNote: v.change_note, changedBy: v.created_by_name || v.created_by, changedAt: v.created_at };
}

/** Differences between two versions (default: the previous version and the current one). */
export async function diffVersions(ref, from, to) {
  const row = await getComposedRow(ref);
  const b = Number(to) || row.version;
  const a = Number(from) || Math.max(1, b - 1);
  const [va, vb] = [await versionSnapshot(row.id, a), await versionSnapshot(row.id, b)];
  return { slipNumber: row.slip_number, from: { version: va.version, changedBy: va.changedBy, changedAt: va.changedAt }, to: { version: vb.version, changedBy: vb.changedBy, changedAt: vb.changedAt },
    ...diffSnapshots(va.snapshot, vb.snapshot) };
}

/** Clause of the library in force today, for the composer's "add clause" (uses the same resolution as a save). */
export async function libraryClauseForSlip(ref) {
  const c = await getClauseRow(ref);
  return { clauseId: c.id, clauseVersion: c.wording_version, code: c.code, title: c.title, clauseType: c.clause_type, wording: c.wording };
}

/** The latest composed slip (not cancelled) of a broker slip or placement, for the standard slip prints. */
export async function latestComposedFor(kind, id) {
  const col = kind === 'placement' ? 'placement_id' : 'broker_slip_id';
  const r = await one(`SELECT id FROM composed_slips WHERE ${col} = $1 AND status <> 'cancelled' ORDER BY (status = 'final') DESC, updated_at DESC LIMIT 1`, [String(id)]);
  return r ? composedById(r.id) : null;
}
