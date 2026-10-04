/**
 * Sanctions, PEP and negative list screening.
 *
 * Lists (aml_screening_lists) are loaded as versions: a file (UN consolidated list XML, CSV or XLSX) or a change made
 * on screen to the internal negative list creates a new version and becomes the list's current version; the earlier
 * versions stay, with their entries, as the record of what was screened when. A new version is followed by a rescreen
 * of every client, beneficial owner and authorised signatory.
 *
 * Screening (aml_screenings) runs at onboarding, at policy issue and at a refund or claim payout, on demand and on a
 * list update: the name is compared with the current entries of the active lists (matching.js) and, when a commercial
 * provider is configured, sent to it as well (providers.js). Potential matches at or above aml.match_threshold become
 * hits (aml_screening_hits). A hit that the compliance officer cleared for the same party and list entry before is
 * cleared again automatically. Open, escalated and confirmed hits stop the events listed in aml.screening_block_events.
 *
 * Screenings and hits are written on their own connection, so they stay recorded when the policy issue or payout that
 * triggered them is refused and rolled back.
 */
import crypto from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { parseUploadedRows, pick } from '../documents/tabular.js';
import { notify } from '../notifications/service.js';
import { matchEntry, nameTokens, normalizeName } from './matching.js';
import { callProvider, providerConfig } from './providers.js';
import { amlSetting, isoDay } from './common.js';

// ---------------------------------------------------------------- lists and versions

export const listRow = (l) => ({
  id: l.id, code: l.code, name: l.name, listType: l.list_type, source: l.source, description: l.description, active: l.active,
  currentVersionId: l.current_version_id === null ? null : Number(l.current_version_id), versionNo: l.version_no ?? null, entries: l.entries_count ?? 0,
  loadedAt: l.loaded_at ?? null, fileName: l.file_name ?? null, updatedAt: l.updated_at,
});

export async function listLists() {
  return (await query(`SELECT l.*, v.version_no, v.entries_count, v.loaded_at, v.file_name FROM aml_screening_lists l
    LEFT JOIN aml_list_versions v ON v.id = l.current_version_id ORDER BY l.id`)).rows.map(listRow);
}

async function getList(id) {
  const l = (await query('SELECT * FROM aml_screening_lists WHERE id::text = $1 OR code = $1', [String(id)])).rows[0];
  if (!l) throw notFound('Screening list not found');
  return l;
}

export async function saveList(id, b, userId) {
  if (id) {
    const before = await getList(id);
    const r = await query(`UPDATE aml_screening_lists SET name = COALESCE($2, name), description = COALESCE($3, description), active = COALESCE($4, active),
      source = COALESCE($5, source), updated_by = $6, updated_at = now() WHERE id = $1 RETURNING *`, [before.id, b.name ?? null, b.description ?? null, b.active ?? null, b.source ?? null, userId]);
    invalidate();
    return { before: listRow(before), after: listRow(r.rows[0]) };
  }
  try {
    const r = await query(`INSERT INTO aml_screening_lists(code, name, list_type, source, description, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [String(b.code).toUpperCase(), b.name, b.listType, b.source || 'Broker', b.description || null, userId]);
    return { before: null, after: listRow(r.rows[0]) };
  } catch (e) {
    if (e.code === '23505') throw conflict(`A list with code ${b.code} already exists`);
    throw e;
  }
}

export const versionRow = (v) => ({
  id: Number(v.id), listId: v.list_id, versionNo: v.version_no, fileName: v.file_name, format: v.format, checksum: v.checksum, entries: v.entries_count,
  publicationDate: isoDay(v.publication_date), notes: v.notes, loadedBy: v.loaded_by_name || v.loaded_by, loadedAt: v.loaded_at, rescreenedAt: v.rescreened_at,
  rescreen: v.rescreen_summary || null, current: !!v.is_current,
});

export async function listVersions(listId) {
  const l = await getList(listId);
  return (await query(`SELECT v.*, u.display_name AS loaded_by_name, (v.id = $2) AS is_current FROM aml_list_versions v LEFT JOIN users u ON u.id = v.loaded_by
    WHERE v.list_id = $1 ORDER BY v.version_no DESC`, [l.id, l.current_version_id])).rows.map(versionRow);
}

export const entryRow = (e) => ({
  id: Number(e.id), entryRef: e.entry_ref, entityType: e.entity_type, fullName: e.full_name, aliases: e.aliases || [], birthDate: e.birth_date,
  nationality: e.nationality, remarks: e.remarks,
});

export async function listEntries(listId, { search = '', versionId = null, limit = 200 } = {}) {
  const l = await getList(listId);
  const v = versionId || l.current_version_id;
  if (!v) return [];
  const params = [v];
  let where = 'version_id = $1';
  if (search) { params.push(normalizeName(search)); where += ` AND (normalized_name LIKE '%' || $2 || '%' OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE upper(a) LIKE '%' || $2 || '%'))`; }
  params.push(Math.min(Number(limit) || 200, 1000));
  return (await query(`SELECT * FROM aml_list_entries WHERE ${where} ORDER BY full_name LIMIT $${params.length}`, params)).rows.map(entryRow);
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : XML_ENTITIES[e.toLowerCase()] ?? m))
  .replace(/\s+/g, ' ').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'gi'))].map((m) => m[1]);

/**
 * Entries of an XML list. The UN Security Council consolidated list (INDIVIDUAL and ENTITY records with FIRST_NAME to
 * FOURTH_NAME, aliases, REFERENCE_NUMBER, nationality and date of birth) is read as published; another XML file is read
 * when its records are <entry> elements with <name>, <alias>, <type>, <birthDate>, <nationality>, <reference>.
 */
export function parseListXml(text) {
  const out = [];
  for (const block of tags(text, 'INDIVIDUAL')) {
    const name = ['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME'].map((t) => tag(block, t)).filter(Boolean).join(' ');
    if (!name) continue;
    const aliases = tags(block, 'INDIVIDUAL_ALIAS').map((a) => tag(a, 'ALIAS_NAME')).filter(Boolean);
    const dob = tags(block, 'INDIVIDUAL_DATE_OF_BIRTH').map((d) => tag(d, 'DATE') || tag(d, 'YEAR')).filter(Boolean)[0] || null;
    const nat = tags(block, 'NATIONALITY').map((n) => tag(n, 'VALUE')).filter(Boolean).join(', ') || null;
    out.push({ entryRef: tag(block, 'REFERENCE_NUMBER') || tag(block, 'DATAID') || null, entityType: 'individual', fullName: name, aliases, birthDate: dob, nationality: nat,
      remarks: tag(block, 'UN_LIST_TYPE') || null });
  }
  for (const block of tags(text, 'ENTITY')) {
    const name = tag(block, 'FIRST_NAME');
    if (!name) continue;
    out.push({ entryRef: tag(block, 'REFERENCE_NUMBER') || tag(block, 'DATAID') || null, entityType: 'entity', fullName: name,
      aliases: tags(block, 'ENTITY_ALIAS').map((a) => tag(a, 'ALIAS_NAME')).filter(Boolean), birthDate: null, nationality: null, remarks: tag(block, 'UN_LIST_TYPE') || null });
  }
  if (!out.length) {
    for (const block of tags(text, 'entry')) {
      const name = tag(block, 'name');
      if (!name) continue;
      out.push({ entryRef: tag(block, 'reference') || null, entityType: /entity|organi[sz]ation|company/i.test(tag(block, 'type')) ? 'entity' : 'individual', fullName: name,
        aliases: tags(block, 'alias').map(decode).filter(Boolean), birthDate: tag(block, 'birthDate') || null, nationality: tag(block, 'nationality') || null, remarks: tag(block, 'remarks') || null });
    }
  }
  return out;
}

/** Entries of a CSV or XLSX list: Name (required), Aliases (separated by ; or |), Type, Birth Date, Nationality, Reference, Remarks. */
export function parseListRows(file) {
  return parseUploadedRows(file).map((r) => ({
    entryRef: pick(r, 'reference', 'ref', 'reference number', 'id', 'dataid') || null,
    entityType: /entity|organi[sz]ation|company|corporat/i.test(pick(r, 'type', 'entity type') || '') ? 'entity' : 'individual',
    fullName: pick(r, 'name', 'full name', 'fullname', 'entity name') || [pick(r, 'first name'), pick(r, 'middle name'), pick(r, 'last name')].filter(Boolean).join(' '),
    aliases: String(pick(r, 'aliases', 'alias', 'aka') || '').split(/[;|]/).map((x) => x.trim()).filter(Boolean),
    birthDate: pick(r, 'birth date', 'date of birth', 'dob', 'birthdate') || null,
    nationality: pick(r, 'nationality', 'country') || null,
    remarks: pick(r, 'remarks', 'position', 'notes', 'designation') || null,
  })).filter((e) => e.fullName && e.fullName.trim());
}

async function insertVersion(db, list, entries, { fileName = null, format, checksum = null, publicationDate = null, notes = null, userId }) {
  const no = Number((await db.query('SELECT COALESCE(max(version_no), 0) + 1 AS n FROM aml_list_versions WHERE list_id = $1', [list.id])).rows[0].n);
  const v = (await db.query(`INSERT INTO aml_list_versions(list_id, version_no, file_name, format, checksum, entries_count, publication_date, notes, loaded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [list.id, no, fileName, format, checksum, entries.length, publicationDate, notes, userId])).rows[0];
  for (let i = 0; i < entries.length; i += 1000) {
    const chunk = entries.slice(i, i + 1000);
    await db.query(`INSERT INTO aml_list_entries(list_id, version_id, entry_ref, entity_type, full_name, normalized_name, aliases, birth_date, nationality, remarks)
      SELECT $1, $2, x.ref, x.typ, x.nam, x.norm, ARRAY(SELECT jsonb_array_elements_text(x.ali)), x.dob, x.nat, x.rem
      FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::jsonb[], $8::text[], $9::text[], $10::text[]) AS x(ref, typ, nam, norm, ali, dob, nat, rem)`,
    [list.id, v.id, chunk.map((e) => e.entryRef || null), chunk.map((e) => e.entityType || 'individual'), chunk.map((e) => e.fullName.trim()), chunk.map((e) => normalizeName(e.fullName)),
      chunk.map((e) => JSON.stringify(e.aliases || [])), chunk.map((e) => e.birthDate || null), chunk.map((e) => e.nationality || null), chunk.map((e) => e.remarks || null)]);
  }
  await db.query('UPDATE aml_screening_lists SET current_version_id = $2, updated_by = $3, updated_at = now() WHERE id = $1', [list.id, v.id, userId]);
  return v;
}

/** Load a new version of a list from an uploaded file (XML, CSV, XLSX); rescreens every party unless rescreen is false. */
export async function uploadVersion(listId, file, { publicationDate = null, notes = null, rescreen = true, userId }) {
  const list = await getList(listId);
  if (!file?.buffer?.length) throw badRequest('Upload the list file in the "file" field (XML, CSV or XLSX)');
  const name = String(file.originalname || '').toLowerCase();
  const text = file.buffer.toString('utf8');
  const isXml = name.endsWith('.xml') || /^\s*(\ufeff)?<\?xml|^\s*<[A-Za-z]/.test(text.slice(0, 200));
  let entries;
  try {
    entries = isXml ? parseListXml(text) : parseListRows(file);
  } catch (e) {
    throw badRequest(`Could not read the list: ${e.message}`);
  }
  if (!entries.length) throw badRequest('The file has no list entries (for CSV / XLSX the first row must hold the column headers, with a Name column)');
  const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const v = await withTransaction((db) => insertVersion(db, list, entries, { fileName: file.originalname, format: isXml ? 'xml' : name.endsWith('.xlsx') ? 'xlsx' : 'csv',
    checksum, publicationDate: isoDay(publicationDate), notes, userId }));
  invalidate();
  const summary = rescreen ? await rescreenAll({ userId, versionId: v.id }) : null;
  return { version: versionRow({ ...v, is_current: true }), rescreen: summary };
}

/** Add an entry to a list on screen (internal negative list): a new version with the current entries and the new one. */
export async function addEntry(listId, e, userId) {
  const list = await getList(listId);
  if (!e.fullName || String(e.fullName).trim().length < 2) throw badRequest('fullName is required');
  const current = list.current_version_id ? (await query('SELECT * FROM aml_list_entries WHERE version_id = $1', [list.current_version_id])).rows.map(entryRow) : [];
  const v = await withTransaction((db) => insertVersion(db, list, [...current, { ...e, aliases: e.aliases || [] }],
    { format: 'manual', notes: `Added ${String(e.fullName).trim()}${e.reason ? `: ${e.reason}` : ''}`, userId }));
  invalidate();
  const summary = await rescreenAll({ userId, versionId: v.id });
  return { version: versionRow({ ...v, is_current: true }), rescreen: summary };
}

/** Remove an entry from a list on screen: a new version without it. */
export async function removeEntry(listId, entryId, reason, userId) {
  const list = await getList(listId);
  if (!reason || String(reason).trim().length < 5) throw badRequest('Give the reason for removing the entry (at least 5 characters)');
  const all = (await query('SELECT * FROM aml_list_entries WHERE version_id = $1', [list.current_version_id])).rows.map(entryRow);
  const gone = all.find((x) => x.id === Number(entryId));
  if (!gone) throw notFound('Entry not found in the current version');
  const v = await withTransaction((db) => insertVersion(db, list, all.filter((x) => x.id !== gone.id), { format: 'manual', notes: `Removed ${gone.fullName}: ${reason}`, userId }));
  invalidate();
  return { version: versionRow({ ...v, is_current: true }), removed: gone };
}

// ---------------------------------------------------------------- in-memory index of the current entries

let cache = { key: null, entries: [], byPrefix: new Map() };
const invalidate = () => { cache = { key: null, entries: [], byPrefix: new Map() }; };
export const clearScreeningCache = invalidate;

async function index() {
  const lists = (await query('SELECT id, code, name, list_type, current_version_id FROM aml_screening_lists WHERE active AND current_version_id IS NOT NULL ORDER BY id')).rows;
  const key = lists.map((l) => `${l.id}:${l.current_version_id}`).join(',');
  if (cache.key === key) return cache;
  const entries = lists.length ? (await query(`SELECT e.*, l.code AS list_code, l.name AS list_name, l.list_type FROM aml_list_entries e JOIN aml_screening_lists l ON l.id = e.list_id
    WHERE e.version_id = ANY($1::bigint[])`, [lists.map((l) => l.current_version_id)])).rows : [];
  const byPrefix = new Map();
  entries.forEach((e, i) => {
    for (const n of [e.full_name, ...(e.aliases || [])]) {
      for (const w of nameTokens(n)) {
        const p = w.slice(0, 2);
        if (!byPrefix.has(p)) byPrefix.set(p, new Set());
        byPrefix.get(p).add(i);
      }
    }
  });
  cache = { key, entries, byPrefix };
  return cache;
}

/** Potential matches of a name in the current lists: [{ entry, score, matchedName }] with score >= threshold, best first. */
export async function matchName(name, { birthDate = null, threshold = null } = {}) {
  const t = threshold ?? Number(await amlSetting('aml.match_threshold'));
  const idx = await index();
  const candidates = new Set();
  for (const w of nameTokens(name)) for (const i of idx.byPrefix.get(w.slice(0, 2)) || []) candidates.add(i);
  const out = [];
  for (const i of candidates) {
    const e = idx.entries[i];
    const m = matchEntry(name, e, { birthDate });
    if (m.score >= t) out.push({ entry: e, score: m.score, matchedName: m.matchedName });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 25);
}

// ---------------------------------------------------------------- screening

export const hitRow = (h) => ({
  id: Number(h.id), screeningId: Number(h.screening_id), clientId: h.client_id, clientCode: h.client_code || null, clientName: h.client_name || null,
  partyType: h.party_type, partyId: h.party_id, partyName: h.party_name, listCode: h.list_code, listName: h.list_name || h.list_code, entryRef: h.entry_ref,
  matchedName: h.matched_name, score: Number(h.score), details: h.details || {}, status: h.status, decisionReason: h.decision_reason,
  decidedBy: h.decided_by_name || h.decided_by, decidedAt: h.decided_at, caseId: h.case_id, caseNumber: h.case_number || null, event: h.event || null,
  reference: h.reference_type ? { type: h.reference_type, id: h.reference_id } : null, createdAt: h.created_at,
});

export const screeningRow = (s) => ({
  id: Number(s.id), clientId: s.client_id, partyType: s.party_type, partyId: s.party_id, partyName: s.party_name, event: s.event,
  reference: s.reference_type ? { type: s.reference_type, id: s.reference_id } : null, provider: s.provider, status: s.status, hits: s.hits, openHits: s.open_hits,
  message: s.message, screenedBy: s.screened_by_name || s.screened_by, screenedAt: s.screened_at,
});

/**
 * Screen one name and record the screening and its hits. party: { clientId, partyType, partyId, name, birthDate,
 * entityType }; ctx: { event, referenceType, referenceId, userId, quiet (no record without a match: rescreen) }.
 */
export async function screenParty(party, ctx) {
  const name = String(party.name || '').trim();
  if (!name) return null;
  const matches = await matchName(name, { birthDate: party.birthDate });
  const cfg = await providerConfig();
  const useProvider = cfg.provider !== 'lists';
  if (ctx.quiet && !matches.length && !useProvider) return { status: 'clear', hits: 0, openHits: 0, recorded: false };
  const s = (await query(`INSERT INTO aml_screenings(client_id, party_type, party_id, party_name, event, reference_type, reference_id, provider, status, screened_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'clear',$9) RETURNING *`,
  [party.clientId || null, party.partyType, party.partyId || null, name, ctx.event, ctx.referenceType || null, ctx.referenceId == null ? null : String(ctx.referenceId),
    useProvider ? `lists+${cfg.provider}` : 'lists', ctx.userId || null])).rows[0];
  const found = matches.map((m) => ({ listId: m.entry.list_id, listCode: m.entry.list_code, versionId: m.entry.version_id, entryId: m.entry.id, entryRef: m.entry.entry_ref,
    matchedName: m.matchedName, score: m.score, details: { listName: m.entry.list_name, listType: m.entry.list_type, entryName: m.entry.full_name, birthDate: m.entry.birth_date,
      nationality: m.entry.nationality, remarks: m.entry.remarks } }));
  let message = null;
  let status = 'clear';
  if (useProvider) {
    const p = await callProvider({ name, birthDate: party.birthDate || null, entityType: party.entityType || 'individual', screeningId: s.id }, cfg);
    if (p && !p.ok) { status = 'provider-pending'; message = `Provider ${cfg.provider} not reached (${p.error}); screened against the uploaded lists, the request is retried`; }
    const threshold = Number(await amlSetting('aml.match_threshold'));
    for (const m of p?.matches || []) {
      if (m.score >= threshold) found.push({ listId: null, listCode: String(m.list || cfg.provider).toUpperCase().slice(0, 40), versionId: null, entryId: null, entryRef: m.reference || null,
        matchedName: m.name, score: Math.min(1, m.score), details: { provider: cfg.provider, ...(m.details || {}) } });
    }
  }
  const out = await recordHits(s, party, found, ctx.userId);
  if (out.hits) status = 'potential-match';
  await query('UPDATE aml_screenings SET status = $2, hits = $3, open_hits = $4, message = $5 WHERE id = $1', [s.id, status, out.hits, out.open, message]);
  if (out.open) {
    await notify({ type: 'reminder', priority: 'high', title: `Screening: ${out.open} potential match(es) for ${name}`, message: `${ctx.event} screening; decide on Compliance > Screening Hits`,
      link: '/compliance/aml/hits', entity: 'aml_screening', entityId: s.id, audience: 'read:aml' });
  }
  return { id: Number(s.id), status, hits: out.hits, openHits: out.open, message, recorded: true };
}

const partyKey = (party) => `${party.partyType}:${party.partyId || normalizeName(party.name)}`;

async function recordHits(s, party, found, userId) {
  const key = partyKey(party);
  let open = 0;
  for (const f of found) {
    // the same party and entry cleared before: cleared again, with the earlier decision as the reason
    const prior = (await query(`SELECT h.status, h.decision_reason, h.decided_at, u.display_name FROM aml_screening_hits h LEFT JOIN users u ON u.id = h.decided_by
      WHERE h.party_key = $1 AND h.list_code = $2 AND COALESCE(h.entry_ref, h.matched_name) = COALESCE($3, $4) AND h.status IN ('cleared', 'confirmed', 'open', 'escalated')
      ORDER BY (h.status = 'confirmed') DESC, h.decided_at DESC NULLS LAST, h.id DESC LIMIT 1`, [key, f.listCode, f.entryRef, f.matchedName])).rows[0];
    // still undecided, escalated or confirmed: counted, not queued a second time
    if (prior && prior.status !== 'cleared') { open += 1; continue; }
    let status = 'open';
    let reason = null;
    if (prior?.status === 'cleared') { status = 'cleared'; reason = `Cleared before by ${prior.display_name || 'the compliance officer'} on ${isoDay(prior.decided_at)}: ${prior.decision_reason || ''}`.trim(); }
    if (status !== 'cleared') open += 1;
    await query(`INSERT INTO aml_screening_hits(screening_id, client_id, party_type, party_id, party_name, party_key, list_id, list_code, version_id, entry_id, entry_ref,
      matched_name, score, details, status, decision_reason, decided_by, decided_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [s.id, party.clientId || null, party.partyType, party.partyId || null, party.name, key, f.listId, f.listCode, f.versionId, f.entryId, f.entryRef, f.matchedName, f.score,
      JSON.stringify(f.details || {}), status, reason, status === 'cleared' ? userId || null : null, status === 'cleared' ? new Date() : null]);
  }
  return { hits: found.length, open };
}

/** The client, its active beneficial owners and authorised signatories as screening parties. */
export async function clientParties(clientId, db = { query }) {
  const c = (await db.query('SELECT * FROM clients WHERE id = $1', [clientId])).rows[0];
  if (!c) throw notFound('Client not found');
  const name = c.client_type === 'corporate' ? c.company_name || c.display_name : [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ') || c.display_name;
  const parties = [{ clientId, partyType: 'client', partyId: clientId, name, birthDate: isoDay(c.birth_date), entityType: c.client_type === 'corporate' ? 'entity' : 'individual' }];
  if (c.client_type === 'corporate' && c.trade_name && c.trade_name !== name) parties.push({ clientId, partyType: 'client', partyId: clientId, name: c.trade_name, entityType: 'entity' });
  for (const o of (await db.query("SELECT id, full_name, birth_date FROM client_beneficial_owners WHERE client_id = $1 AND status = 'active'", [clientId])).rows) {
    parties.push({ clientId, partyType: 'beneficial-owner', partyId: o.id, name: o.full_name, birthDate: isoDay(o.birth_date) });
  }
  for (const s of (await db.query("SELECT id, full_name, birth_date FROM client_signatories WHERE client_id = $1 AND status = 'active'", [clientId])).rows) {
    parties.push({ clientId, partyType: 'signatory', partyId: s.id, name: s.full_name, birthDate: isoDay(s.birth_date) });
  }
  return parties;
}

/** Screen a client with its beneficial owners and signatories. Returns { screenings, hits, openHits }. */
export async function screenClient(clientId, ctx) {
  const results = [];
  for (const p of await clientParties(clientId, ctx.db)) results.push(await screenParty(p, ctx));
  return { screenings: results.filter((r) => r?.recorded).length, hits: results.reduce((s, r) => s + (r?.hits || 0), 0), openHits: results.reduce((s, r) => s + (r?.openHits || 0), 0) };
}

/** Open, escalated or confirmed hits of a client (or of a party name screened for a payout). */
export async function blockingHits(clientId, partyKeys = []) {
  return (await query(`SELECT h.*, l.name AS list_name FROM aml_screening_hits h LEFT JOIN aml_screening_lists l ON l.id = h.list_id
    WHERE h.status IN ('open', 'escalated', 'confirmed') AND (h.client_id = $1 OR h.party_key = ANY($2::text[])) ORDER BY h.id`, [clientId || null, partyKeys])).rows.map(hitRow);
}

/** Refuse an event (policy-issue, payout) while the party has an undecided or confirmed hit, when the event is in aml.screening_block_events. */
export async function assertNotBlocked(event, { clientId = null, partyKeys = [], what = 'This transaction' } = {}) {
  const events = (await amlSetting('aml.screening_block_events')) || [];
  if (!events.includes(event)) return;
  const hits = await blockingHits(clientId, partyKeys);
  if (!hits.length) return;
  const confirmed = hits.some((h) => h.status === 'confirmed');
  const first = hits[0];
  throw conflict(`${what} is stopped: ${confirmed ? 'a confirmed' : 'an undecided'} sanctions / PEP / negative list match of ${first.partyName} (${first.listCode}, score ${first.score.toFixed(2)}).`
    + ` ${confirmed ? 'The party is on a list; do not proceed and inform the compliance officer.' : 'The compliance officer must clear it on Compliance > Screening Hits first.'}`);
}

/** Screening for an event of a client (onboarding, policy issue): screens and, for a blocking event, refuses on an open hit. */
export async function screenForEvent(clientId, event, { referenceType = null, referenceId = null, userId = null, db = undefined } = {}) {
  const summary = await screenClient(clientId, { event, referenceType, referenceId, userId, db });
  await assertNotBlocked(event, { clientId, what: event === 'policy-issue' ? 'Policy issue' : 'This transaction' });
  return summary;
}

/** Screening of a payee at a refund or claim payout: the payee name and the client; refuses on an open hit. */
export async function screenPayout({ clientId = null, payeeName, referenceType, referenceId, userId = null, db = undefined }) {
  const keys = [];
  if (payeeName) {
    const party = { clientId, partyType: 'payee', partyId: null, name: payeeName };
    keys.push(partyKey(party));
    await screenParty(party, { event: 'payout', referenceType, referenceId, userId });
  }
  if (clientId) await screenClient(clientId, { event: 'payout', referenceType, referenceId, userId, quiet: true, db });
  await assertNotBlocked('payout', { clientId, partyKeys: keys, what: `Payment to ${payeeName || 'the payee'}` });
}

/** Rescreen every client, beneficial owner and signatory against the current lists (after a list update). */
export async function rescreenAll({ userId = null, versionId = null } = {}) {
  const clients = (await query("SELECT id FROM clients WHERE status <> 'deleted' AND anonymised_at IS NULL ORDER BY id")).rows;
  let parties = 0;
  let hits = 0;
  let open = 0;
  for (const c of clients) {
    for (const p of await clientParties(c.id)) {
      parties += 1;
      const r = await screenParty(p, { event: 'rescreen', referenceType: versionId ? 'list-version' : null, referenceId: versionId, userId, quiet: true });
      hits += r?.hits || 0;
      open += r?.openHits || 0;
    }
  }
  const summary = { clients: clients.length, parties, hits, newOpenHits: open, at: new Date().toISOString() };
  if (versionId) await query('UPDATE aml_list_versions SET rescreened_at = now(), rescreen_summary = $2 WHERE id = $1', [versionId, JSON.stringify(summary)]);
  return summary;
}

// ---------------------------------------------------------------- hits queue and decisions

const HIT_SELECT = `SELECT h.*, c.client_code, c.display_name AS client_name, l.name AS list_name, s.event, s.reference_type, s.reference_id,
  u.display_name AS decided_by_name, ac.case_number
  FROM aml_screening_hits h JOIN aml_screenings s ON s.id = h.screening_id LEFT JOIN clients c ON c.id = h.client_id
  LEFT JOIN aml_screening_lists l ON l.id = h.list_id LEFT JOIN users u ON u.id = h.decided_by LEFT JOIN aml_cases ac ON ac.id = h.case_id`;

export async function listHits(q = {}) {
  const params = [];
  const where = [];
  if (q.status) { params.push(String(q.status).split(',')); where.push(`h.status = ANY($${params.length})`); }
  if (q.clientId) { params.push(q.clientId); where.push(`h.client_id = $${params.length}`); }
  if (q.listCode) { params.push(q.listCode); where.push(`h.list_code = $${params.length}`); }
  if (q.search) { params.push(q.search); where.push(`(h.party_name ILIKE '%' || $${params.length} || '%' OR h.matched_name ILIKE '%' || $${params.length} || '%' OR c.client_code ILIKE '%' || $${params.length} || '%')`); }
  return (await query(`${HIT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY (h.status = 'open') DESC, h.created_at DESC LIMIT 500`, params)).rows.map(hitRow);
}

export async function getHit(id) {
  const h = (await query(`${HIT_SELECT} WHERE h.id = $1`, [id])).rows[0];
  if (!h) throw notFound('Screening hit not found');
  return hitRow(h);
}

export async function screeningsOf(clientId, limit = 30) {
  return (await query(`SELECT s.*, u.display_name AS screened_by_name FROM aml_screenings s LEFT JOIN users u ON u.id = s.screened_by WHERE s.client_id = $1
    ORDER BY s.screened_at DESC, s.id DESC LIMIT $2`, [clientId, limit])).rows.map(screeningRow);
}

/** Recount the open hits of a screening after a decision. */
export async function recountScreening(screeningId) {
  await query(`UPDATE aml_screenings s SET open_hits = (SELECT count(*) FROM aml_screening_hits h WHERE h.screening_id = s.id AND h.status IN ('open', 'escalated', 'confirmed'))
    WHERE id = $1`, [screeningId]);
}

/** Matches returned by a provider request retried later: recorded as hits of the screening that sent it. */
export async function applyProviderMatches(requestId) {
  const r = (await query('SELECT * FROM aml_provider_requests WHERE id = $1', [requestId])).rows[0];
  if (!r?.screening_id || r.status !== 'succeeded') return { hits: 0, openHits: 0 };
  const s = (await query('SELECT * FROM aml_screenings WHERE id = $1', [r.screening_id])).rows[0];
  if (!s) return { hits: 0, openHits: 0 };
  const threshold = Number(await amlSetting('aml.match_threshold'));
  const found = (r.response?.matches || []).filter((m) => Number(m.score) >= threshold).map((m) => ({ listId: null, listCode: String(m.list || r.provider).toUpperCase().slice(0, 40),
    versionId: null, entryId: null, entryRef: m.reference || null, matchedName: m.name, score: Math.min(1, Number(m.score)), details: { provider: r.provider, ...(m.details || {}) } }));
  const party = { clientId: s.client_id, partyType: s.party_type, partyId: s.party_id, name: s.party_name };
  const out = await recordHits(s, party, found, null);
  await query(`UPDATE aml_screenings SET status = CASE WHEN hits + $2 > 0 THEN 'potential-match' ELSE 'clear' END, hits = hits + $2, open_hits = open_hits + $3,
    message = COALESCE(message, '') || ' Provider answered on retry.' WHERE id = $1`, [s.id, out.hits, out.open]);
  return { hits: out.hits, openHits: out.open };
}
