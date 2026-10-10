/**
 * Authority Matrix (Master > Users and Access): approval limits per transaction type and role (or person), in
 * business words, and their changes through the configuration approval.
 *
 * Reading: the limit in effect today, a change scheduled for a later date, and the change waiting for approval of
 * each cell; the roles by department (roleDirectory) with the transaction types each can approve, worked out from the
 * permissions of the approval steps that check the matrix (AUTHORITY_STEPS).
 *
 * Changing: a cell, a personal limit, the removal of a limit or an uploaded workbook becomes one change of kind
 * authority-limits in accounting_config_changes (changes.js). A different user holding approve:access-control
 * approves it; every line then applies from its effective date (service.applyLimit). While a change waits, its
 * cells take no other change. access.authority_reference_required asks for the authority reference (board
 * resolution number and date) on every line.
 *
 * What "Not set" means at approval time is decided by access.authority_without_limit (service.assertAuthority).
 */
import { badRequest, conflict, forbidden } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';
import { APPROVER, listAccessChanges, registerAccessKind, requestAccessChange } from './changes.js';
import { roleDirectory } from './roles.js';
import { applyLimit, listLimits, transactionTypes } from './service.js';

export const KIND = 'authority-limits';
export const AUTHORITY_PATH = '/master/generals/usermanagement/authority-matrix';
const EDIT = 'write:access-control';
const UPLOAD = 'upload';
export const UPLOAD_FOLDER = 'authority-matrix';

/**
 * The approval steps that check a transaction type (callers of assertAuthority) and the permissions a role needs to
 * reach each; ruleRoles: only the authority roles named by the active acceptance rules decide (product-configurator
 * underwriting.js assertMayDecide). A type missing here is not checked by any step: its limits have no effect.
 */
export const AUTHORITY_STEPS = {
  claim_settlement: { step: 'Operations > Claims > Settlement approval', permissions: ['write:claims', 'approve:claims'] },
  payment_voucher: { step: 'Accounts > Disbursements > Cheque approval, and bank payment batch approval', permissions: ['write:disbursements'] },
  journal_voucher: { step: 'Accounts > Journal Vouchers > Approve', permissions: ['write:journal-vouchers'] },
  remittance: { step: 'Accounts > Remittance > Approval', permissions: ['write:remittance'] },
  remittance_settlement: { step: 'Accounts > Remittance > Approval (settlement, adjustment, transfer)', permissions: ['write:remittance'] },
  underwriting_referral: { step: 'Quotation > Underwriting referral (the authority role of the acceptance rule)', permissions: ['write:quotations'], ruleRoles: true },
};

const money = (v) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 100) / 100);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
const cellKey = (type, roleCode, userId) => `${type}|${roleCode ? `role:${roleCode}` : `user:${userId}`}`;
const fold = (s) => String(s || '').trim().toLowerCase();

/** "PHP 1,000,000.00", "10%", "No limit", "Not set". */
export const limitWords = (measure, maxAmount, unlimited, set = true) => {
  if (!set) return 'Not set';
  if (unlimited) return 'No limit';
  const n = Number(maxAmount);
  return measure === 'percent' ? `${n}%` : `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Permissions of each role with the roles it includes (active ones), by role code. */
async function rolePermissions(db) {
  const { rows } = await db.query(`SELECT r.code, r.status, r.inherits, COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS perms
    FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id GROUP BY r.id`);
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const out = new Map();
  for (const r of rows) {
    const held = new Set(r.perms);
    const seen = new Set([r.code]);
    const queue = [...(r.inherits || [])];
    while (queue.length) {
      const next = byCode.get(queue.shift());
      if (!next || seen.has(next.code) || next.status !== 'active') continue;
      seen.add(next.code);
      next.perms.forEach((p) => held.add(p));
      queue.push(...(next.inherits || []));
    }
    out.set(r.code, held);
  }
  return out;
}

/** Roles the active acceptance rules name to decide an underwriting referral. */
const referralRoles = async (db) => new Set((await db.query(`SELECT DISTINCT data->>'authorityRole' AS code FROM product_components
  WHERE kind = 'underwriting-rules' AND status = 'Active' AND data->>'authorityRole' IS NOT NULL`)).rows.map((r) => r.code));

/** The transaction types a role can approve: those whose approval step it reaches. */
const approvesOf = (role, perms, ruleRoles) => Object.entries(AUTHORITY_STEPS)
  .filter(([, s]) => role.fullAccess || (s.permissions.every((p) => perms?.has(p)) && (!s.ruleRoles || ruleRoles.has(role.code))))
  .map(([type]) => type);

/**
 * Everything the matrix, the checks and the exports read: types, roles, people with a limit, and per cell the limit
 * in effect, the scheduled one and the change waiting for approval.
 */
async function loadState(db, user = null) {
  const day = await today();
  const [types, dir, perms, ruleRoles, limits, open, withoutLimit, referenceRequired] = await Promise.all([
    transactionTypes(db), roleDirectory(db), rolePermissions(db), referralRoles(db), listLimits(db),
    listAccessChanges(db, { kind: KIND, status: 'pending' }, user),
    getSetting('access.authority_without_limit', 'allow'), getSetting('access.authority_reference_required', true),
  ]);
  const roles = dir.roles.map((r) => ({ ...r, approves: approvesOf(r, perms.get(r.code), ruleRoles) }));
  const cells = new Map();
  const at = (key) => {
    if (!cells.has(key)) cells.set(key, { inEffect: null, scheduled: null, pending: null });
    return cells.get(key);
  };
  for (const l of limits) {
    const c = at(cellKey(l.transactionType, l.roleCode, l.userId));
    if (l.status === 'active' && l.effectiveFrom <= day && (!l.effectiveTo || l.effectiveTo >= day)) c.inEffect = l;
    else if (l.status === 'active' && l.effectiveFrom > day && (!c.scheduled || l.effectiveFrom < c.scheduled.effectiveFrom)) c.scheduled = l;
    else if (l.status === 'pending') c.pending = { source: 'limit', limit: l };
  }
  for (const ch of open) {
    for (const line of ch.payload?.lines || []) at(cellKey(line.transactionType, line.roleCode, line.userId)).pending = { source: 'change', change: ch, line };
  }
  return {
    day, types, typeByCode: new Map(types.map((t) => [t.code, t])), roles, roleByCode: new Map(roles.map((r) => [r.code, r])),
    departments: dir.departments, limits, open, cells, withoutLimit: String(withoutLimit), referenceRequired: referenceRequired !== false,
    edit: !!user && hasPermission(user, EDIT), approve: !!user && hasPermission(user, APPROVER), user,
  };
}

/** The change waiting for approval of a cell, as the screen shows it, with what this user may do. */
function pendingOut(p, st) {
  if (!p) return null;
  if (p.source === 'limit') {
    const l = p.limit;
    const mine = st.user?.id === l.requestedById;
    return { source: 'limit', limitId: l.id, ref: `AL-${l.id}`, lines: 1, maxAmount: l.maxAmount, unlimited: l.unlimited, removes: false, effectiveFrom: l.effectiveFrom,
      referenceNo: l.referenceNo, referenceDate: l.referenceDate, remarks: l.remarks, requestedBy: l.requestedBy, requestedById: l.requestedById, requestedAt: l.requestedAt,
      canDecide: st.approve && !mine, canWithdraw: mine || st.approve };
  }
  const { change: c, line } = p;
  return { source: 'change', changeId: c.id, ref: c.ref, lines: c.payload?.lines?.length || 1, maxAmount: line.unlimited ? null : line.maxAmount, unlimited: !!line.unlimited,
    removes: !!line.removes, effectiveFrom: line.effectiveFrom, referenceNo: line.referenceNo || null, referenceDate: line.referenceDate || null, remarks: line.remarks || c.changeNote || null,
    requestedBy: c.requestedBy, requestedById: c.requestedById, requestedAt: c.requestedAt, canDecide: c.canDecide, canWithdraw: c.canWithdraw };
}

/** One cell of the matrix (or one personal limit): in effect, scheduled, waiting for approval. */
function cellOut(st, key) {
  const c = st.cells.get(key) || {};
  const l = c.inEffect;
  return {
    limitId: l?.id ?? null, maxAmount: l ? l.maxAmount : null, unlimited: !!l && l.unlimited, set: !!l, effectiveFrom: l?.effectiveFrom ?? null,
    endsOn: l?.effectiveTo ?? null, referenceNo: l?.referenceNo ?? null, referenceDate: l?.referenceDate ?? null, remarks: l?.remarks ?? null,
    approvedBy: l?.decidedBy ?? null, approvedAt: l?.decidedAt ?? null, changeId: l?.changeId ?? null,
    scheduled: c.scheduled ? { limitId: c.scheduled.id, maxAmount: c.scheduled.maxAmount, unlimited: c.scheduled.unlimited, effectiveFrom: c.scheduled.effectiveFrom,
      referenceNo: c.scheduled.referenceNo } : null,
    pending: pendingOut(c.pending, st),
  };
}

/** Personal limits: one entry per person and type with a limit in effect, scheduled or waiting for approval. */
async function personalOut(db, st) {
  const keys = [...st.cells.keys()].filter((k) => k.includes('|user:'));
  const ids = [...new Set(keys.map((k) => k.split('|user:')[1]))];
  const users = new Map((await db.query('SELECT id, username, display_name AS "displayName", status FROM users WHERE id = ANY($1)', [ids])).rows.map((u) => [u.id, u]));
  return keys.map((key) => {
    const [type, rest] = key.split('|user:');
    const cell = cellOut(st, key);
    const t = st.typeByCode.get(type);
    const u = users.get(rest);
    return { key, userId: rest, userName: u?.displayName || rest, username: u?.username || null, userActive: u?.status === 'active', transactionType: type,
      transactionName: t?.name || type, measure: t?.measure || 'amount', ...cell };
  }).filter((p) => p.set || p.scheduled || p.pending)
    .sort((a, b) => a.userName.localeCompare(b.userName) || (st.typeByCode.get(a.transactionType)?.sortOrder ?? 0) - (st.typeByCode.get(b.transactionType)?.sortOrder ?? 0));
}

/**
 * The Authority Matrix as the screen shows it: transaction types down (active ones), the active roles across with
 * their department, whether they belong to the base platform and the types they can approve, each cell's limit in
 * effect, scheduled change and change waiting for approval; the personal limits; the rule for a cell without a
 * limit; what the signed-in user may do.
 */
export async function authorityMatrix(db, user = null) {
  const st = await loadState(db, user);
  const roles = st.roles.filter((r) => r.status === 'active');
  const types = st.types.filter((t) => t.active);
  const legacy = st.limits.filter((l) => l.status === 'pending').length;
  return {
    asOf: st.day,
    withoutLimit: st.withoutLimit,
    referenceRequired: st.referenceRequired,
    departments: st.departments,
    roles: roles.map((r) => ({ code: r.code, name: r.name, department: r.department, platform: r.platform, fullAccess: r.fullAccess, approves: r.approves })),
    rows: types.map((t) => ({ code: t.code, name: t.name, measure: t.measure, description: t.description, checked: !!AUTHORITY_STEPS[t.code], step: AUTHORITY_STEPS[t.code]?.step || null,
      cells: Object.fromEntries(roles.map((r) => [r.code, cellOut(st, cellKey(t.code, r.code))])) })),
    userLimits: await personalOut(db, st),
    pendingCount: st.open.length + legacy,
    abilities: { edit: st.edit, approve: st.approve },
  };
}

// ---------------------------------------------------------------- checking a change

const sameValue = (a, b) => !!a && !!b && !!a.unlimited === !!b.unlimited && (a.unlimited || money(a.maxAmount) === money(b.maxAmount));

/**
 * Check one line of a change against the matrix: { line (normalised, with the names and the value in effect),
 * errors: [{ field, message }], same (the value is the one in effect, nothing scheduled) }.
 */
function checkLine(st, raw, people) {
  const errors = [];
  const fail = (field, message) => errors.push({ field, message });
  const t = st.typeByCode.get(raw.transactionType);
  if (!t || !t.active) fail('transactionType', 'Unknown or inactive transaction type');
  let who = null;
  if (!raw.roleCode === !raw.userId) fail('roleCode', 'Give either a role or a person');
  else if (raw.roleCode) {
    const r = st.roleByCode.get(raw.roleCode);
    if (!r || r.status !== 'active') fail('roleCode', 'Unknown or inactive role');
    else who = r.name;
  } else {
    const u = people.get(raw.userId);
    if (!u || u.status !== 'active') fail('userId', 'Unknown or inactive user');
    else who = u.displayName;
  }
  const cell = st.cells.get(cellKey(raw.transactionType, raw.roleCode, raw.userId)) || {};
  const removes = !!raw.removes;
  const unlimited = !removes && !!raw.unlimited;
  let max = null;
  if (removes) {
    if (!cell.inEffect && !cell.scheduled) fail('removes', 'There is no limit to remove');
  } else if (!unlimited) {
    max = raw.maxAmount === null || raw.maxAmount === undefined || raw.maxAmount === '' ? null : Number(raw.maxAmount);
    if (max === null || Number.isNaN(max)) fail('maxAmount', 'Enter the limit, or choose No limit');
    else if (max < 0) fail('maxAmount', 'The limit cannot be negative');
    else if (Math.round(max * 100) !== max * 100) fail('maxAmount', 'Use at most 2 decimals');
    else if (t?.measure === 'percent' && max > 100) fail('maxAmount', 'A percent limit cannot be over 100');
  }
  const from = raw.effectiveFrom || st.day;
  if (!validDate(from)) fail('effectiveFrom', 'Enter the date as YYYY-MM-DD');
  else if (from < st.day) fail('effectiveFrom', 'The effective date cannot be in the past');
  const referenceNo = String(raw.referenceNo || '').trim();
  const referenceDate = raw.referenceDate || null;
  if (st.referenceRequired && !referenceNo) fail('referenceNo', 'Enter the authority reference (for example the board resolution number)');
  if (referenceNo.length > 60) fail('referenceNo', 'Use at most 60 characters');
  if (st.referenceRequired && !referenceDate) fail('referenceDate', 'Enter the date of the authority reference');
  if (referenceDate && !validDate(referenceDate)) fail('referenceDate', 'Enter the date as YYYY-MM-DD');
  else if (referenceDate && referenceDate > st.day) fail('referenceDate', 'The reference date cannot be in the future');
  const remarks = String(raw.remarks || '').trim();
  if (remarks.length > 500) fail('remarks', 'Use at most 500 characters');
  const now = cell.inEffect;
  const line = {
    transactionType: raw.transactionType, transactionName: t?.name || raw.transactionType, measure: t?.measure || 'amount',
    roleCode: raw.roleCode || null, userId: raw.roleCode ? null : raw.userId || null, who,
    maxAmount: removes || unlimited ? null : money(max), unlimited, removes, effectiveFrom: from,
    referenceNo: referenceNo || null, referenceDate, remarks: remarks || null,
    before: { set: !!now, maxAmount: now?.maxAmount ?? null, unlimited: !!now?.unlimited, scheduled: cell.scheduled ? cell.scheduled.effectiveFrom : null },
  };
  const same = !removes && !cell.scheduled && sameValue(now, line) && from === st.day;
  return { line, errors, same, cell };
}

const pendingRef = (cell) => (cell.pending?.source === 'change' ? cell.pending.change.ref : cell.pending ? `AL-${cell.pending.limit.id}` : null);

async function peopleOf(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const { rows } = await db.query('SELECT id, display_name AS "displayName", status FROM users WHERE id = ANY($1)', [list]);
  return new Map(rows.map((u) => [u.id, u]));
}

/** "Journal voucher approval · TIS Finance: Not set → PHP 1,000,000.00 from 2026-11-01 (BR-2026-014)". */
export const lineText = (l) => {
  const was = limitWords(l.measure, l.before?.maxAmount, l.before?.unlimited, !!l.before?.set);
  const next = l.removes ? 'removed' : limitWords(l.measure, l.maxAmount, l.unlimited);
  return `${l.transactionName} · ${l.who}: ${was} → ${next} from ${l.effectiveFrom}${l.referenceNo ? ` (${l.referenceNo})` : ''}`;
};

/**
 * Propose a change of the matrix: { lines: [{ transactionType, roleCode | userId, maxAmount, unlimited, removes,
 * effectiveFrom, referenceNo, referenceDate, remarks }], remarks, source ('screen' | 'upload'), file: { key, name },
 * rowsRead, unchanged }. The whole change is refused when a line is wrong, changes nothing, repeats a cell or touches
 * a cell with a change waiting for approval. Returns the change waiting for approval.
 */
export async function proposeChange(db, body, user) {
  const raws = Array.isArray(body.lines) ? body.lines : [];
  if (!raws.length) throw badRequest('Validation failed', [{ path: 'lines', message: 'Nothing to change' }]);
  const st = await loadState(db, user);
  const people = await peopleOf(db, raws.map((r) => r.userId));
  const errors = [];
  const lines = [];
  const seen = new Map();
  for (const [i, raw] of raws.entries()) {
    const r = checkLine(st, raw, people);
    r.errors.forEach((e) => errors.push({ path: `lines.${i}.${e.field}`, message: e.message }));
    const key = cellKey(raw.transactionType, raw.roleCode, raw.userId);
    if (seen.has(key)) errors.push({ path: `lines.${i}`, message: `The same transaction and ${raw.roleCode ? 'role' : 'person'} are on line ${seen.get(key) + 1}` });
    seen.set(key, i);
    if (!r.errors.length && r.same) errors.push({ path: `lines.${i}`, message: `No change: ${r.line.transactionName} · ${r.line.who} is already ${limitWords(r.line.measure, r.line.maxAmount, r.line.unlimited)}` });
    const ref = pendingRef(r.cell);
    if (ref) throw conflict(`A change of ${r.line.transactionName} · ${r.line.who || ''} is waiting for approval (${ref}); approve, reject or withdraw it first`);
    lines.push(r.line);
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  let file = null;
  if (body.file?.key) {
    const doc = (await db.query('SELECT storage_key, file_name FROM documents WHERE storage_key = $1 AND category = $2 AND uploaded_by = $3',
      [body.file.key, UPLOAD_FOLDER, user.id])).rows[0];
    if (!doc) throw badRequest('Validation failed', [{ path: 'file', message: 'Upload the file again' }]);
    file = { key: doc.storage_key, name: doc.file_name };
  }
  const single = lines.length === 1 && !file;
  const title = single ? `${lines[0].transactionName} · ${lines[0].who}` : `${lines.length} approval limits${file ? ` · ${file.name}` : ''}`;
  const target = single ? cellKey(lines[0].transactionType, lines[0].roleCode, lines[0].userId) : UPLOAD;
  const payload = { title, source: file ? 'upload' : 'screen', file, rowsRead: body.rowsRead ?? null, unchanged: body.unchanged ?? null, lines };
  const change = await requestAccessChange(db, { kind: KIND, target, payload, note: String(body.remarks || '').trim() || null, user });
  if (file) await db.query("UPDATE documents SET entity = 'accounting_config_change', entity_id = $2 WHERE storage_key = $1", [file.key, String(change.id)]);
  return change;
}

registerAccessKind(KIND, {
  label: 'Authority matrix',
  link: (c) => `${AUTHORITY_PATH}?tab=pending&change=${c.id}`,
  describe: async (_db, c) => ({ targetLabel: c.payload?.title || c.target, summary: (c.payload?.lines || []).map(lineText) }),
  assertDecider: async (_db, c, user) => {
    if ((c.payload?.lines || []).some((l) => l.userId && l.userId === user.id)) throw forbidden('You cannot approve a change of your own approval limit');
  },
  apply: async (db, c, user) => {
    const ids = [];
    for (const l of c.payload?.lines || []) {
      const live = (await db.query(`SELECT t.active AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM roles WHERE code = $2 AND status = 'active'))
          AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = $3)) AS ok FROM authority_transaction_types t WHERE t.code = $1`,
      [l.transactionType, l.roleCode, l.userId])).rows[0];
      if (!live?.ok) throw conflict(`${l.transactionName} · ${l.who} is no longer active; reject the change`);
      ids.push(await applyLimit(db, { ...l, changeId: c.id, requestedBy: c.requested_by, requestedAt: c.requested_at }, user));
    }
    return { audit: { entity: 'authority_limit', entityId: `CFG-${c.id}`, action: 'apply', after: { change: c.id, lines: ids.length, limits: ids.filter(Boolean) } } };
  },
  requested: (c, user) => {
    const lines = c.summary.slice(0, 5).join('; ');
    const more = c.summary.length > 5 ? ` and ${c.summary.length - 5} more` : '';
    return `${user.username} proposed a change of the Authority Matrix (${c.targetLabel}): ${lines}${more}${c.changeNote ? ` (${c.changeNote})` : ''}`;
  },
  applied: (c) => {
    const n = c.payload?.lines?.length || 0;
    return n === 1 ? `the approval limit of ${c.targetLabel} is changed from ${c.payload.lines[0].effectiveFrom}` : `${n} approval limits are changed from their effective dates`;
  },
});

// ---------------------------------------------------------------- upload (Excel template)

/** Columns of the upload template and of the importer (documents/tabular.js mapColumns). */
export const AUTHORITY_UPLOAD_COLUMNS = [
  { key: 'transaction', header: 'Transaction', aliases: ['Transaction type'], required: true, width: 34 },
  { key: 'role', header: 'Role', required: true, width: 34 },
  { key: 'department', header: 'Department', note: 'Information only', width: 22 },
  { key: 'measure', header: 'Measure', note: 'Information only', width: 18 },
  { key: 'inEffect', header: 'In effect', note: 'Information only', width: 20 },
  { key: 'limit', header: 'Limit', aliases: ['Approval limit'], width: 16 },
  { key: 'noLimit', header: 'No limit', allowed: ['Yes', 'No'], width: 10 },
  { key: 'effectiveFrom', header: 'Effective from', format: 'YYYY-MM-DD', width: 15 },
  { key: 'referenceNo', header: 'Authority reference', aliases: ['Reference'], width: 22 },
  { key: 'referenceDate', header: 'Reference date', format: 'YYYY-MM-DD', width: 15 },
  { key: 'remarks', header: 'Remarks', width: 30 },
  { key: 'transactionCode', header: 'Transaction code', width: 22 },
  { key: 'roleCode', header: 'Role code', width: 22 },
];
const HEADER = Object.fromEntries(AUTHORITY_UPLOAD_COLUMNS.map((c) => [c.key, c.header]));
const FIELD_COLUMN = { transactionType: HEADER.transaction, roleCode: HEADER.role, maxAmount: HEADER.limit, removes: HEADER.limit, effectiveFrom: HEADER.effectiveFrom,
  referenceNo: HEADER.referenceNo, referenceDate: HEADER.referenceDate, remarks: HEADER.remarks };

const INSTRUCTIONS = [
  'Change the Limit, No limit, Effective from, Authority reference, Reference date and Remarks columns; the other columns are for information.',
  'Limit: an amount in PHP, or a percent of the premium (0 to 100) for a percent transaction, with at most 2 decimals. Leave it empty with No limit = Yes.',
  'A row left as it is, or with the limit in effect, is not changed. A row without a limit is not changed when the role has no limit.',
  'A limit is not removed by emptying its row: remove it on the Authority Matrix screen.',
  'Effective from: today or a later date (YYYY-MM-DD); empty means today. A later date keeps the limit in effect until the day before.',
  'Authority reference and Reference date: the board resolution or memo that grants the authority (reference date not in the future).',
  'A row may name the transaction and the role by name or by code (the codes on the right win). Each transaction and role once.',
  'The whole file is checked first: with any error nothing is saved. The changes then go for approval together, to an administrator other than you.',
];

/** Excel serial day (as read from a date cell) or YYYY-MM-DD; null when empty, the text itself when unreadable. */
const readDate = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/^\d{5}(\.0+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : s;
};
const readNumber = (v) => {
  const s = String(v ?? '').replace(/PHP|₱|%|,|\s/gi, '');
  return s === '' ? null : Number(s);
};
const yesNo = (v) => {
  const s = fold(v);
  if (!s) return false;
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0'].includes(s)) return false;
  return undefined;
};

/** Find a record by code first, else by its name (one match only): { item } or { error }. */
function lookup(list, code, name, what) {
  if (code) {
    const byCode = list.find((x) => x.code === String(code).trim());
    return byCode ? { item: byCode } : { error: `${what} code ${code} is unknown or inactive` };
  }
  if (!name) return { error: `${what} is required` };
  const matches = list.filter((x) => fold(x.name) === fold(name));
  if (matches.length > 1) return { error: `${what} "${name}" matches ${matches.length} records; give the ${what.toLowerCase()} code` };
  return matches.length ? { item: matches[0] } : { error: `${what} "${name}" is unknown or inactive` };
}

/**
 * Check an uploaded workbook (rows mapped with AUTHORITY_UPLOAD_COLUMNS) against the matrix without saving anything:
 * { rowsRead, changes: [line with its row], unchanged, errors: [{ row, message }] }. Row numbers are those of the
 * sheet (the header is row 1).
 */
export async function checkUpload(db, rows, user) {
  const st = await loadState(db, user);
  const types = st.types.filter((t) => t.active);
  const roles = st.roles.filter((r) => r.status === 'active');
  const errors = [];
  const changes = [];
  let unchanged = 0;
  const seen = new Map();
  rows.forEach((v, i) => {
    const row = i + 2;
    const fail = (message) => errors.push({ row, message });
    const t = lookup(types, v.transactionCode, v.transaction, 'Transaction');
    const r = lookup(roles, v.roleCode, v.role, 'Role');
    if (t.error) fail(t.error);
    if (r.error) fail(r.error);
    if (t.error || r.error) return;
    const key = cellKey(t.item.code, r.item.code);
    if (seen.has(key)) {
      fail(`${t.item.name} for ${r.item.name} is already on row ${seen.get(key)}`);
      return;
    }
    seen.set(key, row);
    const noLimit = yesNo(v.noLimit);
    const limit = readNumber(v.limit);
    if (noLimit === undefined) return fail(`${HEADER.noLimit}: write Yes or No`);
    if (limit !== null && Number.isNaN(limit)) return fail(`${HEADER.limit}: "${v.limit}" is not a number`);
    if (limit !== null && noLimit) return fail(`${HEADER.limit}: give a limit or No limit = Yes, not both`);
    const cell = st.cells.get(key) || {};
    if (limit === null && !noLimit) {
      if (cell.inEffect) fail(`${HEADER.limit}: empty, but ${r.item.name} has a limit for ${t.item.name}; a limit is removed on the Authority Matrix screen`);
      else unchanged += 1;
      return;
    }
    const raw = { transactionType: t.item.code, roleCode: r.item.code, maxAmount: limit, unlimited: !!noLimit, effectiveFrom: readDate(v.effectiveFrom),
      referenceNo: v.referenceNo, referenceDate: readDate(v.referenceDate), remarks: v.remarks };
    const c = checkLine(st, raw, new Map());
    const asIs = !raw.effectiveFrom && (sameValue(cell.inEffect, c.line) || sameValue(cell.scheduled, c.line));
    if (c.same || asIs) {
      unchanged += 1;
      return;
    }
    if (cell.pending) {
      const p = pendingOut(cell.pending, st);
      if (!p.removes && sameValue(p, c.line)) unchanged += 1;
      else fail(`${t.item.name} for ${r.item.name} has a change waiting for approval (${p.ref}); approve, reject or withdraw it first`);
      return;
    }
    if (c.errors.length) {
      c.errors.forEach((e) => fail(`${FIELD_COLUMN[e.field] || e.field}: ${e.message}`));
      return;
    }
    changes.push({ row, ...c.line });
  });
  return { rowsRead: rows.length, changes, unchanged, errors };
}

/** Active roles of the template: TISPH roles, with `base` the base platform ones too. */
const pickRoles = (st, { base = false } = {}) => st.roles.filter((r) => r.status === 'active' && (base || !r.platform));

/**
 * Upload template: the matrix as it is, one row per transaction and role (types checked by an approval step unless
 * `unchecked`; roles that can approve them, or with a limit, unless `all`), with drop-down lists and the rules.
 * Returns the workbook sheets for lib/xlsx.js writeXlsx.
 */
export async function templateSheets(db, user, { base = false, unchecked = false, all = false } = {}) {
  const st = await loadState(db, user);
  const types = st.types.filter((t) => t.active && (unchecked || AUTHORITY_STEPS[t.code]));
  const roles = pickRoles(st, { base });
  const data = [];
  for (const t of types) {
    for (const r of roles) {
      const cell = st.cells.get(cellKey(t.code, r.code)) || {};
      if (!all && !r.approves.includes(t.code) && !cell.inEffect && !cell.scheduled && !cell.pending) continue;
      const l = cell.inEffect;
      data.push([t.name, r.name, r.department || (r.platform ? 'Base platform roles' : 'Other roles'), t.measure === 'percent' ? 'Percent of premium' : 'Amount in PHP',
        limitWords(t.measure, l?.maxAmount, l?.unlimited, !!l), l && !l.unlimited ? String(l.maxAmount) : '', l?.unlimited ? 'Yes' : 'No', '', '', '', '', t.code, r.code]);
    }
  }
  const last = Math.max(data.length + 1, 2);
  const lists = Math.max(types.length, roles.length, 2);
  const listRows = Array.from({ length: lists }, (_, i) => [types[i]?.name || '', roles[i]?.name || '', ['Yes', 'No'][i] || '']);
  const col = (key) => String.fromCharCode(65 + AUTHORITY_UPLOAD_COLUMNS.findIndex((c) => c.key === key));
  return [
    { name: 'Data', columns: AUTHORITY_UPLOAD_COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width, required: c.required })), rows: data, textColumns: true,
      validations: [
        { sqref: `${col('transaction')}2:${col('transaction')}${last + 500}`, formula: `Lists!$A$2:$A$${types.length + 1}` },
        { sqref: `${col('role')}2:${col('role')}${last + 500}`, formula: `Lists!$B$2:$B$${roles.length + 1}` },
        { sqref: `${col('noLimit')}2:${col('noLimit')}${last + 500}`, formula: 'Lists!$C$2:$C$3' },
      ] },
    { name: 'Lists', columns: [{ header: 'Transaction', width: 40 }, { header: 'Role', width: 40 }, { header: 'No limit', width: 10 }], rows: listRows, autoFilter: false },
    { name: 'Instructions', columns: [{ header: 'Rule', width: 120 }], rows: INSTRUCTIONS.map((x) => [x]), autoFilter: false },
  ];
}

// ---------------------------------------------------------------- exports for audit

export const AUTHORITY_MATRIX_HEADER = ['Department', 'Role', 'Base platform role', 'Transaction', 'Checked at', 'Measure', 'Limit in effect', 'Effective from',
  'Ends on', 'Authority reference', 'Reference date', 'Approved by', 'Approved on', 'Scheduled change', 'Waiting for approval', 'Transaction code', 'Role code'];

/** Every active role (base platform roles flagged) and every active transaction type, one row each. */
export async function authorityMatrixRows(db, user) {
  const st = await loadState(db, user);
  const out = [];
  for (const r of st.roles.filter((x) => x.status === 'active')) {
    for (const t of st.types.filter((x) => x.active)) {
      const c = cellOut(st, cellKey(t.code, r.code));
      const s = c.scheduled;
      const p = c.pending;
      out.push([r.department || (r.platform ? 'Base platform roles' : 'Other roles'), r.name, r.platform ? 'Yes' : 'No', t.name, AUTHORITY_STEPS[t.code]?.step || 'Not checked by an approval step',
        t.measure === 'percent' ? 'Percent of premium' : 'Amount in PHP', limitWords(t.measure, c.maxAmount, c.unlimited, c.set), c.effectiveFrom || '', c.endsOn || '',
        c.referenceNo || '', c.referenceDate || '', c.approvedBy || '', c.approvedAt ? new Date(c.approvedAt).toISOString().slice(0, 10) : '',
        s ? `${limitWords(t.measure, s.maxAmount, s.unlimited)} from ${s.effectiveFrom}` : '',
        p ? `${p.ref}: ${p.removes ? 'remove' : limitWords(t.measure, p.maxAmount, p.unlimited)} from ${p.effectiveFrom}` : '', t.code, r.code]);
    }
  }
  return out;
}

export const LIMIT_HISTORY_HEADER = ['Transaction', 'Role or person', 'Limit', 'Effective from', 'Effective to', 'Status', 'Authority reference', 'Reference date', 'Change',
  'Proposed by', 'Proposed on', 'Decided by', 'Decided on', 'Decision note', 'Remarks', 'Transaction code', 'Role code'];

/** Status of a limit row in words: In effect, Scheduled, Ended, Waiting for approval, Rejected, Retired, Withdrawn. */
export const limitStatus = (l, day) => {
  if (l.status === 'active') {
    if (l.effectiveFrom > day) return 'Scheduled';
    if (l.effectiveTo && l.effectiveTo < day) return 'Ended';
    return 'In effect';
  }
  return { pending: 'Waiting for approval', rejected: 'Rejected', retired: 'Retired', withdrawn: 'Withdrawn' }[l.status] || l.status;
};

/** Every limit row with its people and dates, newest first: the History tab and its download. */
export async function limitHistory(db, { transactionType = null } = {}) {
  const day = await today();
  return (await listLimits(db, { status: 'all', transactionType }))
    .map((l) => ({ ...l, statusLabel: limitStatus(l, day) }))
    .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')) || b.id - a.id);
}

const dayOf = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
export const limitHistoryRows = (list) => list.map((l) => [l.transactionName, l.roleName || l.userName || l.roleCode || l.userId, limitWords(l.measure, l.maxAmount, l.unlimited),
  l.effectiveFrom || '', l.effectiveTo || '', l.statusLabel, l.referenceNo || '', l.referenceDate || '', l.changeId ? `CFG-${l.changeId}` : '', l.requestedBy || '',
  dayOf(l.requestedAt), l.decidedBy || '', dayOf(l.decidedAt), l.decisionNote || '', l.remarks || '', l.transactionType, l.roleCode || '']);
