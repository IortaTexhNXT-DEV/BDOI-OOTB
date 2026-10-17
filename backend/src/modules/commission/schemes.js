/**
 * Sharing schemes (Accounts > Commission > Sharing Schemes; sharing_schemes; TIS-BRD-PROD-16, COMM-05; FRS FR-CMR-010 to 015).
 *
 * A scheme says who is paid what of the commission of a policy: split lines paid to the referrer of the policy, the
 * parent of the referrer (agent hierarchy) or the dealer / partner of the channel, on a share basis (the variance to
 * the TIS remitting rate in points of the sum insured of the chosen perils, a % of the commission of those perils, a
 * % of the net premium, or a fixed amount per policy) with a default, a minimum and a maximum inside which an
 * authorised user may change it. A scheme is used for the policies of its products, insurers and policy type on dates
 * within its period; it is assigned to referrers and distribution channels with an override inside the limits.
 *
 * While commission.rules_approval_required is on (TISPH) a scheme, each amendment (a new version) and each assignment
 * is approved on Master > Finance > Configuration Approvals (kinds sharing-scheme and scheme-assignment) by a holder
 * of approve:sharing-schemes other than its maker; an approver suspends, resumes and ends an active scheme. Without
 * the setting a scheme is active as soon as it is saved. The daily job commission-rules-schemes activates scheduled
 * schemes, ends those past their last day and supersedes replaced versions.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { addDays, isoDate, today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { requiredReason } from '../ops-masters/records.js';
import { requestChange } from '../posting-rules/service.js';

export const SHARE_BASES = ['variance', 'commission-pct', 'net-premium-pct', 'fixed'];
export const SHARE_BASIS_LABELS = { variance: 'Variance to the TIS remitting rate', 'commission-pct': '% of commission', 'net-premium-pct': '% of net premium', fixed: 'Fixed amount per policy' };
export const PAID_TO = ['referrer', 'parent', 'channel'];
export const PAID_TO_LABELS = { referrer: 'Referrer of the policy', parent: 'Parent of the referrer', channel: 'Dealer / partner of the channel' };
export const PARTY_TYPES = ['Agent', 'Sub-agent', 'TFS team member', 'Referral', 'Dealer', 'Affinity partner', 'External'];
export const STATUS_LABELS = { draft: 'Draft', pending: 'Pending approval', scheduled: 'Scheduled', active: 'Active', suspended: 'Suspended', superseded: 'Superseded', ended: 'Ended', returned: 'Returned', withdrawn: 'Withdrawn' };
const LIVE = ['active', 'scheduled', 'suspended'];
const CODE = /^[A-Z0-9-]{3,20}$/;

export const approvalRequired = async () => (await getSetting('commission.rules_approval_required')) === true;

const SELECT = `SELECT s.*, (SELECT u.display_name FROM users u WHERE u.id = s.created_by) AS created_by_name, (SELECT u.display_name FROM users u WHERE u.id = s.submitted_by) AS submitted_by_name,
    (SELECT u.display_name FROM users u WHERE u.id = s.approved_by) AS approved_by_name,
    (SELECT c.id FROM accounting_config_changes c WHERE c.kind = 'sharing-scheme' AND c.target = 'scheme:' || s.id AND c.status = 'pending' LIMIT 1) AS pending_change_id,
    (SELECT count(*)::int FROM commission_referrers r WHERE upper(r.scheme_code) = upper(s.code)) AS referrers,
    (SELECT count(*)::int FROM distribution_channels ch WHERE upper(ch.scheme_code) = upper(s.code)) AS channels
  FROM sharing_schemes s`;

const names = async (table, ids) => (ids?.length ? (await many(`SELECT id, name FROM ${table} WHERE id = ANY($1)`, [ids])).map((r) => r.name) : []);

export async function schemeOut(s) {
  return {
    id: s.id, code: s.code, name: s.name, partyTypes: s.party_types || [], productIds: s.product_ids || [], productNames: await names('products', s.product_ids),
    insurerIds: s.insurer_ids || [], insurerNames: await names('insurance_companies', s.insurer_ids), policyType: s.policy_type, effectiveFrom: isoDate(s.effective_from), effectiveTo: isoDate(s.effective_to),
    payWhenFullyPaid: s.pay_when_fully_paid, combineWithReferrer: s.combine_with_referrer, lines: (s.lines || []).map((l, i) => ({ ...l, lineNo: i + 1, basisLabel: SHARE_BASIS_LABELS[l.basis], paidToLabel: PAID_TO_LABELS[l.paidTo] })),
    status: s.status, statusLabel: STATUS_LABELS[s.status] || s.status, version: s.version, replacesId: s.replaces_id, changeNote: s.change_note, remarks: s.remarks,
    pendingChangeId: s.pending_change_id ? Number(s.pending_change_id) : null, assignments: { referrers: s.referrers ?? 0, channels: s.channels ?? 0 },
    createdBy: s.created_by_name || s.created_by, createdById: s.created_by, submittedBy: s.submitted_by_name || s.submitted_by, submittedById: s.submitted_by, submittedAt: s.submitted_at,
    approvedBy: s.approved_by_name || s.approved_by, approvedAt: s.approved_at, suspendedAt: s.suspended_at, suspensionNote: s.suspension_note, endedAt: s.ended_at, updatedAt: s.updated_at,
  };
}

async function fetch(db, ref, lock = false) {
  const s = (await db.query(`${SELECT} WHERE s.id::text = $1 OR (upper(s.code) = upper($1) AND s.status = ANY($2)) ORDER BY s.version DESC LIMIT 1${lock ? ' FOR UPDATE OF s' : ''}`, [String(ref), [...LIVE, 'draft', 'pending', 'returned', 'withdrawn']])).rows[0];
  if (!s) throw notFound(`Sharing scheme ${ref} not found`);
  return s;
}
export const getScheme = async (ref) => schemeOut(await fetch({ query }, ref));

export async function listSchemes(q = {}) {
  const where = ['TRUE'];
  const values = [];
  const add = (sql, v) => { values.push(v); where.push(sql.replaceAll('?', `$${values.length}`)); };
  if (q.status && q.status !== 'all') add('s.status = ?', String(q.status));
  else if (!q.status) where.push("s.status <> 'superseded'");
  if (q.partyType) add('? = ANY(s.party_types)', String(q.partyType));
  if (q.productId) add('? = ANY(s.product_ids)', Number(q.productId));
  if (q.search) add('(s.code ILIKE ? OR s.name ILIKE ?)', `%${q.search}%`);
  const rows = await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY s.code, s.version DESC`, values);
  return Promise.all(rows.map(schemeOut));
}

/** Assignments of a scheme: the referrers and channels using it, with their override. */
export async function schemeAssignments(ref) {
  const s = await fetch({ query }, ref);
  const referrers = await many('SELECT id, name, referrer_type, scheme_override FROM commission_referrers WHERE upper(scheme_code) = upper($1) ORDER BY name', [s.code]);
  const channels = await many('SELECT id, code, name, channel_type, scheme_override FROM distribution_channels WHERE upper(scheme_code) = upper($1) ORDER BY name', [s.code]);
  return {
    referrers: referrers.map((r) => ({ id: r.id, name: r.name, partyType: r.referrer_type, override: r.scheme_override === null ? null : Number(r.scheme_override) })),
    channels: channels.map((c) => ({ id: c.id, code: c.code, name: c.name, channelType: c.channel_type, override: c.scheme_override === null ? null : Number(c.scheme_override) })),
  };
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Check the split lines of a scheme (FR-CMR-011, 012); returns the clean lines. */
export async function cleanLines(lines) {
  const maxLevels = Number(await getSetting('commission.max_chain_levels', 2)) || 2;
  const errors = [];
  const out = [];
  let pctTotal = 0;
  let chain = 0;
  for (const [i, l] of (Array.isArray(lines) ? lines : []).entries()) {
    const path = `lines.${i}`;
    const paidTo = PAID_TO.includes(l.paidTo) ? l.paidTo : null;
    const basis = SHARE_BASES.includes(l.basis) ? l.basis : null;
    if (!paidTo) errors.push({ path: `${path}.paidTo`, message: `Paid to must be one of ${PAID_TO.join(', ')}` });
    if (!basis) errors.push({ path: `${path}.basis`, message: `Share basis must be one of ${SHARE_BASES.join(', ')}` });
    const def = num(l.defaultValue);
    const min = num(l.min) ?? 0;
    const max = num(l.max);
    if (def === null || !Number.isFinite(def) || def < 0) errors.push({ path: `${path}.defaultValue`, message: 'Enter the default share' });
    if (max !== null && min > max) errors.push({ path: `${path}.max`, message: 'The minimum cannot be higher than the maximum' });
    if (def !== null && (def < min || (max !== null && def > max))) errors.push({ path: `${path}.defaultValue`, message: 'The default must be between the minimum and the maximum' });
    if (basis === 'commission-pct' || basis === 'net-premium-pct') {
      if (max !== null && max > 100) errors.push({ path: `${path}.max`, message: 'A percentage share cannot be above 100' });
      if (basis === 'commission-pct') pctTotal += max ?? def ?? 0;
    }
    if (paidTo === 'referrer' || paidTo === 'parent') chain += 1;
    const perils = Array.isArray(l.perils) && l.perils.length ? l.perils.map((p) => String(p).toUpperCase()) : ['OD', 'AON'];
    out.push({ paidTo, basis, perils, defaultValue: def, min, max, addToReferrer: l.addToReferrer === true, description: l.description ? String(l.description).slice(0, 200) : null });
  }
  if (pctTotal > 100) errors.push({ path: 'lines', message: 'The shares of this scheme add up to more than 100% of the commission' });
  if (chain > maxLevels) errors.push({ path: 'lines', message: `A scheme can share along at most ${maxLevels} levels` });
  if (errors.length) throw badRequest(errors[0].message, errors);
  return out;
}

async function cleanScheme(db, b, base = null) {
  const code = String(b.code ?? base?.code ?? '').trim().toUpperCase();
  if (!code) throw badRequest('Enter the scheme code', [{ path: 'code', message: 'Enter the scheme code' }]);
  if (!CODE.test(code)) throw badRequest('Use capital letters, digits and hyphens, 3 to 20 characters', [{ path: 'code', message: 'Use capital letters, digits and hyphens, 3 to 20 characters' }]);
  const v = {
    code, name: String(b.name ?? base?.name ?? '').trim(),
    party_types: (b.partyTypes ?? base?.party_types ?? []).filter((t) => PARTY_TYPES.includes(t)),
    product_ids: (b.productIds ?? base?.product_ids ?? []).map(Number).filter((x) => Number.isInteger(x) && x > 0),
    insurer_ids: (b.insurerIds ?? base?.insurer_ids ?? []).map(Number).filter((x) => Number.isInteger(x) && x > 0),
    policy_type: ['new', 'renewal', 'any'].includes(b.policyType) ? b.policyType : base?.policy_type || 'any',
    effective_from: b.effectiveFrom ?? isoDate(base?.effective_from), effective_to: b.effectiveTo !== undefined ? b.effectiveTo || null : isoDate(base?.effective_to),
    pay_when_fully_paid: b.payWhenFullyPaid ?? base?.pay_when_fully_paid ?? true, combine_with_referrer: b.combineWithReferrer ?? base?.combine_with_referrer ?? false,
    lines: b.lines !== undefined ? await cleanLines(b.lines) : base?.lines || [], remarks: b.remarks !== undefined ? b.remarks || null : base?.remarks || null,
  };
  if (!v.name) throw badRequest('Enter the scheme name', [{ path: 'name', message: 'Enter the scheme name' }]);
  if (!v.party_types.length) throw badRequest('Choose at least one party type', [{ path: 'partyTypes', message: 'Choose at least one party type' }]);
  if (!v.product_ids.length) throw badRequest('Choose at least one product', [{ path: 'productIds', message: 'Choose at least one product' }]);
  if (!v.effective_from) throw badRequest('Give the effective-from date', [{ path: 'effectiveFrom', message: 'Give the effective-from date' }]);
  if (v.effective_to && v.effective_to < v.effective_from) throw badRequest('Effective to must be on or after effective from', [{ path: 'effectiveTo', message: 'Effective to must be on or after effective from' }]);
  if ((await db.query('SELECT count(*)::int AS n FROM products WHERE id = ANY($1)', [v.product_ids])).rows[0].n !== v.product_ids.length) throw badRequest('Validation failed', [{ path: 'productIds', message: 'A product was not found' }]);
  const dup = (await db.query("SELECT id FROM sharing_schemes WHERE upper(code) = $1 AND status NOT IN ('superseded', 'ended', 'withdrawn') AND ($2::int IS NULL OR id <> $2) AND ($3::int IS NULL OR id <> $3)",
    [code, base?.id ?? null, base?.replaces_id ?? null])).rows[0];
  if (dup && !(base && base.replaces_id)) throw conflict(`Scheme code ${code} is already used`);
  return v;
}

const COLS = ['code', 'name', 'party_types', 'product_ids', 'insurer_ids', 'policy_type', 'effective_from', 'effective_to', 'pay_when_fully_paid', 'combine_with_referrer', 'lines', 'remarks'];
const vals = (v) => COLS.map((c) => (c === 'lines' ? JSON.stringify(v.lines) : v[c]));

/** The status a scheme takes when it comes into force on `day`. */
const inForceStatus = async (v, day = null) => (v.effective_from > (day || (await today())) ? 'scheduled' : 'active');

export async function createScheme(b, user) {
  return withTransaction(async (db) => {
    const review = await approvalRequired();
    const v = await cleanScheme(db, b);
    const status = review ? 'draft' : await inForceStatus(v);
    const r = await db.query(`INSERT INTO sharing_schemes(${COLS.join(', ')}, status, created_by, updated_by, approved_by, approved_at)
      VALUES (${COLS.map((_, i) => `$${i + 1}`).join(',')}, $${COLS.length + 1}, $${COLS.length + 2}, $${COLS.length + 2}, $${COLS.length + 3}, $${COLS.length + 4}) RETURNING id`,
    [...vals(v), status, user?.id ?? null, review ? null : user?.id ?? null, review ? null : new Date()]);
    if (review && b.submit) await submitIn(db, r.rows[0].id, user, b.changeNote || null);
    return schemeOut(await fetch(db, r.rows[0].id));
  });
}

export async function updateScheme(ref, b, user) {
  return withTransaction(async (db) => {
    const s = await fetch(db, ref, true);
    const review = await approvalRequired();
    if (['draft', 'returned', 'withdrawn'].includes(s.status) || !review) {
      if (review && s.status === 'pending') throw conflict('This scheme already has a change waiting for approval');
      const v = await cleanScheme(db, { ...b, code: s.code }, s);
      await db.query(`UPDATE sharing_schemes SET ${COLS.map((c, i) => `${c} = $${i + 2}`).join(', ')}, status = CASE WHEN status = 'withdrawn' THEN 'draft' ELSE status END, updated_by = $${COLS.length + 2}, updated_at = now() WHERE id = $1`,
        [s.id, ...vals(v), user?.id ?? null]);
      if (review && b.submit) await submitIn(db, s.id, user, b.changeNote || null);
      return schemeOut(await fetch(db, s.id));
    }
    if (s.status === 'pending') throw conflict('This scheme already has a change waiting for approval');
    if (!LIVE.includes(s.status)) throw conflict(`Scheme ${s.code} is ${STATUS_LABELS[s.status].toLowerCase()} and cannot be amended`);
    // an amendment is a new version that supersedes this one when it comes into force
    const v = await cleanScheme(db, { ...b, code: s.code }, s);
    const latest = (await db.query('SELECT COALESCE(max(version), 0) AS v FROM sharing_schemes WHERE upper(code) = upper($1)', [s.code])).rows[0].v;
    const r = await db.query(`INSERT INTO sharing_schemes(${COLS.join(', ')}, status, version, replaces_id, created_by, updated_by)
      VALUES (${COLS.map((_, i) => `$${i + 1}`).join(',')}, 'draft', $${COLS.length + 1}, $${COLS.length + 2}, $${COLS.length + 3}, $${COLS.length + 3}) RETURNING id`,
    [...vals(v), Number(latest) + 1, s.id, user?.id ?? null]);
    if (b.submit) await submitIn(db, r.rows[0].id, user, b.changeNote || null);
    return schemeOut(await fetch(db, r.rows[0].id));
  });
}

const linesText = (lines) => (lines || []).map((l) => `${PAID_TO_LABELS[l.paidTo]}: ${l.basis === 'variance' ? `${l.defaultValue} points` : l.basis === 'fixed' ? `PHP ${l.defaultValue}` : `${l.defaultValue}%`} (${l.min ?? 0} - ${l.max ?? 'open'}, ${SHARE_BASIS_LABELS[l.basis]} on ${(l.perils || []).join(', ')})`).join('; ');

async function submitIn(db, id, user, note) {
  const s = await fetch(db, id, true);
  if (!['draft', 'returned', 'withdrawn'].includes(s.status)) throw conflict(s.status === 'pending' ? 'This scheme already has a change waiting for approval' : `Scheme ${s.code} is ${STATUS_LABELS[s.status].toLowerCase()}`);
  if (!(s.lines || []).length) throw badRequest('Add at least one split line', [{ path: 'lines', message: 'Add at least one split line' }]);
  const action = s.replaces_id ? 'amend' : 'new';
  const prev = s.replaces_id ? (await db.query('SELECT * FROM sharing_schemes WHERE id = $1', [s.replaces_id])).rows[0] : null;
  await requestChange(db, { kind: 'sharing-scheme', target: `scheme:${s.id}`, note, user,
    payload: { schemeId: s.id, action, label: `Sharing scheme - ${action}: ${s.code} ${s.name}`, code: s.code, name: s.name, version: s.version, partyTypes: s.party_types, policyType: s.policy_type,
      effectiveFrom: isoDate(s.effective_from), effectiveTo: isoDate(s.effective_to), lines: linesText(s.lines) },
    before: prev ? { version: prev.version, effectiveFrom: isoDate(prev.effective_from), effectiveTo: isoDate(prev.effective_to), lines: linesText(prev.lines) } : null });
  await db.query("UPDATE sharing_schemes SET status = 'pending', submitted_by = $2, submitted_at = now(), change_note = $3, updated_by = $2, updated_at = now() WHERE id = $1", [s.id, user?.id ?? null, note]);
}

export async function submitScheme(ref, user, { changeNote = null } = {}) {
  if (!(await approvalRequired())) throw conflict('Sharing schemes are saved in force: there is no approval step');
  return withTransaction(async (db) => { await submitIn(db, (await fetch(db, ref)).id, user, changeNote); return schemeOut(await fetch(db, ref)); });
}

export async function withdrawScheme(ref, user) {
  return withTransaction(async (db) => {
    const s = await fetch(db, ref, true);
    if (s.status !== 'pending') throw conflict(`Scheme ${s.code} is ${STATUS_LABELS[s.status].toLowerCase()}; only a pending scheme can be withdrawn`);
    if (s.submitted_by !== user?.id && !hasPermission(user, 'approve:sharing-schemes')) throw conflict('Only the user who submitted the scheme or an approver can withdraw it');
    await db.query("UPDATE accounting_config_changes SET status = 'withdrawn', decided_by = $2, decided_at = now() WHERE kind = 'sharing-scheme' AND target = $1 AND status = 'pending'", [`scheme:${s.id}`, user?.id ?? null]);
    await db.query("UPDATE sharing_schemes SET status = 'withdrawn', updated_by = $2, updated_at = now() WHERE id = $1", [s.id, user?.id ?? null]);
    return schemeOut(await fetch(db, s.id));
  });
}

/** Suspend, resume or end an active scheme (approve:sharing-schemes; a remark is required; FR-CMR-013). */
export async function changeSchemeState(ref, action, b, user) {
  return withTransaction(async (db) => {
    const s = await fetch(db, ref, true);
    const note = String(b?.note ?? b?.remarks ?? '').trim();
    if (action === 'suspend') {
      if (!LIVE.includes(s.status) || s.status === 'suspended') throw conflict(`Scheme ${s.code} is ${STATUS_LABELS[s.status].toLowerCase()}`);
      if (!note) throw badRequest('Enter a remark', [{ path: 'note', message: 'Enter a remark' }]);
      await db.query("UPDATE sharing_schemes SET status = 'suspended', suspended_by = $2, suspended_at = now(), suspension_note = $3, updated_by = $2, updated_at = now() WHERE id = $1", [s.id, user?.id ?? null, note]);
    } else if (action === 'resume') {
      if (s.status !== 'suspended') throw conflict(`Scheme ${s.code} is ${STATUS_LABELS[s.status].toLowerCase()}`);
      await db.query('UPDATE sharing_schemes SET status = $2, suspended_by = NULL, suspended_at = NULL, suspension_note = NULL, updated_by = $3, updated_at = now() WHERE id = $1',
        [s.id, await inForceStatus({ effective_from: isoDate(s.effective_from) }), user?.id ?? null]);
    } else if (action === 'end') {
      if (!LIVE.includes(s.status)) throw conflict(`Scheme ${s.code} is ${STATUS_LABELS[s.status].toLowerCase()}`);
      const reason = await requiredReason(db, 'scheme_end', { reasonCode: b?.reasonCode, note });
      const assigned = (s.referrers || 0) + (s.channels || 0);
      const replacement = b?.replacementCode ? await fetch(db, String(b.replacementCode)) : null;
      if (assigned && !replacement && b?.confirmNoSharing !== true) {
        throw conflict(`This scheme is assigned to ${assigned} referrers and channels. Choose the scheme that replaces it, or confirm that their business is no longer shared.`);
      }
      if (replacement && !LIVE.includes(replacement.status)) throw conflict(`Scheme ${replacement.code} is ${STATUS_LABELS[replacement.status].toLowerCase()} and cannot replace ${s.code}`);
      const day = await today();
      // a scheme ended before it started keeps its first day as its last
      await db.query("UPDATE sharing_schemes SET status = 'ended', effective_to = GREATEST(LEAST(COALESCE(effective_to, $2::date), $2::date), effective_from), ended_by = $3, ended_at = now(), remarks = $4, updated_by = $3, updated_at = now() WHERE id = $1",
        [s.id, day, user?.id ?? null, reason.text]);
      await db.query('UPDATE commission_referrers SET scheme_code = $2, scheme_override = NULL, updated_at = now() WHERE upper(scheme_code) = upper($1)', [s.code, replacement?.code || null]);
      await db.query('UPDATE distribution_channels SET scheme_code = $2, scheme_override = NULL, updated_at = now() WHERE upper(scheme_code) = upper($1)', [s.code, replacement?.code || null]);
    } else throw badRequest(`Unknown action ${action}`);
    return schemeOut(await fetch(db, s.id));
  });
}

/** The party type of a channel for a scheme's party types (dealer group and branch = Dealer; affinity partner = Affinity partner). */
export const channelPartyType = (channelType) => (['dealer_group', 'dealer_branch'].includes(channelType) ? 'Dealer' : channelType === 'affinity_partner' ? 'Affinity partner' : null);

/**
 * Assign a scheme (or none) with an override to a referrer or a channel (FR-CMR-014): approved on Configuration
 * Approvals under review, applied at once otherwise. Returns the change or the record.
 */
export async function assignScheme({ referrerId = null, channelId = null, schemeCode, override = null, note = null }, user) {
  return withTransaction(async (db) => {
    const scheme = schemeCode ? await fetch(db, String(schemeCode)) : null;
    if (schemeCode && !scheme) throw notFound(`Sharing scheme ${schemeCode} not found`);
    const target = referrerId ? (await db.query('SELECT id, name, referrer_type AS party_type, scheme_code, scheme_override FROM commission_referrers WHERE id = $1', [String(referrerId)])).rows[0]
      : (await db.query('SELECT id, name, channel_type, scheme_code, scheme_override FROM distribution_channels WHERE id = $1', [String(channelId)])).rows[0];
    if (!target) throw notFound(referrerId ? 'Referrer not found' : 'Distribution channel not found');
    const partyType = referrerId ? target.party_type : channelPartyType(target.channel_type);
    if (scheme) {
      if (!LIVE.includes(scheme.status)) throw conflict(`Scheme ${scheme.code} is ${STATUS_LABELS[scheme.status].toLowerCase()}`);
      if (!scheme.party_types.includes(partyType)) throw badRequest(`Scheme ${scheme.code} is not for party type ${partyType || 'of this record'}`, [{ path: 'schemeCode', message: `Scheme ${scheme.code} is not for party type ${partyType || 'of this record'}` }]);
      if (override !== null && override !== undefined && override !== '') {
        const line = (scheme.lines || []).find((l) => l.paidTo !== 'parent') || scheme.lines?.[0];
        const min = Number(line?.min ?? 0);
        const max = line?.max === null || line?.max === undefined ? null : Number(line.max);
        if (Number(override) < min || (max !== null && Number(override) > max)) throw badRequest(`The override must be between ${min} and ${max ?? 'open'}`, [{ path: 'override', message: `The override must be between ${min} and ${max ?? 'open'}` }]);
      }
    }
    const payload = { referrerId: referrerId || null, channelId: channelId || null, schemeCode: scheme?.code || null, override: override === '' ? null : override ?? null,
      label: `Sharing scheme - assign: ${target.name} to ${scheme?.code || 'no scheme'}${override ? ` at ${override}` : ''}` };
    const before = { schemeCode: target.scheme_code, override: target.scheme_override === null ? null : Number(target.scheme_override) };
    if (await approvalRequired()) {
      const change = await requestChange(db, { kind: 'scheme-assignment', target: referrerId ? `referrer:${referrerId}` : `channel:${channelId}`, payload, before, note, user });
      const table = referrerId ? 'commission_referrers' : 'distribution_channels';
      await db.query(`UPDATE ${table} SET pending_scheme = $2, updated_at = now() WHERE id = $1`, [target.id, JSON.stringify({ ...payload, changeId: change.id })]);
      return { pending: true, change };
    }
    await applyAssignment(db, payload);
    return { pending: false, change: null };
  });
}

async function applyAssignment(db, p) {
  const table = p.referrerId ? 'commission_referrers' : 'distribution_channels';
  await db.query(`UPDATE ${table} SET scheme_code = $2, scheme_override = $3, pending_scheme = NULL, updated_at = now() WHERE id = $1`, [p.referrerId || p.channelId, p.schemeCode, p.override === null ? null : Number(p.override)]);
}

/** Apply a decision of Configuration Approvals on a scheme or an assignment (approve, reject or withdraw). */
export async function applySchemeDecision(db, change, action, user) {
  if (change.kind === 'scheme-assignment') {
    const table = change.payload?.referrerId ? 'commission_referrers' : 'distribution_channels';
    if (action === 'approve') await applyAssignment(db, change.payload);
    else await db.query(`UPDATE ${table} SET pending_scheme = NULL, updated_at = now() WHERE id = $1`, [change.payload?.referrerId || change.payload?.channelId]);
    return;
  }
  const s = (await db.query('SELECT * FROM sharing_schemes WHERE id = $1 FOR UPDATE', [Number(change.payload?.schemeId) || 0])).rows[0];
  if (!s) throw notFound('Sharing scheme not found');
  if (action !== 'approve') {
    await db.query('UPDATE sharing_schemes SET status = $2, updated_by = $3, updated_at = now() WHERE id = $1', [s.id, action === 'withdraw' ? 'withdrawn' : 'returned', user?.id ?? null]);
    return;
  }
  if (s.status !== 'pending') throw conflict(`Scheme ${s.code} is ${STATUS_LABELS[s.status]?.toLowerCase() || s.status}`);
  const status = await inForceStatus({ effective_from: isoDate(s.effective_from) });
  await db.query("UPDATE sharing_schemes SET status = $2, approved_by = $3, approved_at = now(), updated_by = $3, updated_at = now() WHERE id = $1", [s.id, status, user?.id ?? null]);
  if (status === 'active' && s.replaces_id) await supersede(db, s);
}

async function supersede(db, s) {
  await db.query(`UPDATE sharing_schemes SET status = 'superseded', effective_to = GREATEST(LEAST(COALESCE(effective_to, $2::date), $2::date), effective_from), updated_at = now()
    WHERE id = $1 AND status IN ('active', 'scheduled', 'suspended')`, [s.replaces_id, addDays(isoDate(s.effective_from), -1)]);
}

/** Daily job: scheduled schemes come into force, replaced versions are superseded, schemes past their last day end. */
export async function schemesJob({ asOf = null } = {}) {
  const day = asOf || (await today());
  const started = await many("UPDATE sharing_schemes SET status = 'active', updated_at = now() WHERE status = 'scheduled' AND effective_from <= $1::date RETURNING id, code, replaces_id, effective_from", [day]);
  for (const s of started.filter((x) => x.replaces_id)) await supersede({ query }, s);
  const ended = await many("UPDATE sharing_schemes SET status = 'ended', ended_at = now(), updated_at = now() WHERE status IN ('active', 'suspended') AND effective_to IS NOT NULL AND effective_to < $1::date RETURNING code", [day]);
  const rulesEnded = await many("UPDATE commission_rates SET active = false, updated_at = now() WHERE approval_status = 'approved' AND active AND effective_to IS NOT NULL AND effective_to < $1::date - 1 RETURNING id", [day]);
  return { asOf: day, activated: started.map((s) => s.code), ended: ended.map((s) => s.code), rulesEnded: rulesEnded.length };
}

/**
 * The scheme that applies to a placement (FR-CMR-015): the referrer's (with its override), else the channel's or its
 * dealer group's, else none. Returns { scheme, override, source: 'referrer' | 'channel' | null, lines } with only an
 * active scheme in force on the date whose products, insurers and policy type match.
 */
export async function schemeFor(db, { referrerId = null, channelId = null, productId = null, insurerId = null, policyType = 'new', date = null }) {
  const run = db || { query };
  const on = date || (await today());
  const fits = (s) => s && s.status === 'active' && isoDate(s.effective_from) <= on && (!s.effective_to || isoDate(s.effective_to) >= on)
    && (!s.product_ids.length || !productId || s.product_ids.includes(Number(productId))) && (!s.insurer_ids.length || !insurerId || s.insurer_ids.includes(Number(insurerId)))
    && (s.policy_type === 'any' || s.policy_type === policyType);
  const load = async (code) => (code ? (await run.query("SELECT * FROM sharing_schemes WHERE upper(code) = upper($1) AND status = 'active' ORDER BY version DESC LIMIT 1", [code])).rows[0] : null);
  if (referrerId && referrerId !== 'direct') {
    const r = (await run.query('SELECT scheme_code, scheme_override FROM commission_referrers WHERE id = $1', [String(referrerId)])).rows[0];
    const s = await load(r?.scheme_code);
    if (fits(s)) return { scheme: s, override: r.scheme_override === null ? null : Number(r.scheme_override), source: 'referrer' };
  }
  if (channelId) {
    const ch = (await run.query('SELECT c.scheme_code, c.scheme_override, p.scheme_code AS parent_code, p.scheme_override AS parent_override FROM distribution_channels c LEFT JOIN distribution_channels p ON p.id = c.parent_id WHERE c.id = $1', [String(channelId)])).rows[0];
    for (const [code, override] of [[ch?.scheme_code, ch?.scheme_override], [ch?.parent_code, ch?.parent_override]]) {
      const s = await load(code);
      if (fits(s)) return { scheme: s, override: override === null || override === undefined ? null : Number(override), source: 'channel' };
    }
  }
  return { scheme: null, override: null, source: null };
}

/** Options of the scheme dialog and the referrer form. */
export const schemeOptions = () => ({ partyTypes: PARTY_TYPES, shareBases: SHARE_BASES.map((b) => ({ code: b, label: SHARE_BASIS_LABELS[b] })), paidTo: PAID_TO.map((p) => ({ code: p, label: PAID_TO_LABELS[p] })) });

/** The worked example of a scheme's lines on a sample policy (FR-CMR-011): amounts per line and what TISPH keeps. */
export function exampleShares(lines, { sumInsured = 800000, netPremium = 20000, commission = 7200, variance = { OD: 0.3, AON: 0.1 } } = {}) {
  const rows = (lines || []).map((l) => {
    const perils = l.perils?.length ? l.perils : ['OD', 'AON'];
    let amount = 0;
    if (l.basis === 'variance') amount = perils.reduce((s, p) => s + (sumInsured * Math.min(Number(l.defaultValue), Number(variance[p] ?? l.defaultValue))) / 100, 0);
    else if (l.basis === 'commission-pct') amount = (commission * Number(l.defaultValue)) / 100;
    else if (l.basis === 'net-premium-pct') amount = (netPremium * Number(l.defaultValue)) / 100;
    else amount = Number(l.defaultValue);
    return { paidTo: l.paidTo, basis: l.basis, amount: round2(amount) };
  });
  const shared = round2(rows.reduce((s, r) => s + r.amount, 0));
  return { sumInsured, netPremium, commission, rows, shared: Math.min(shared, commission), retained: round2(Math.max(0, commission - shared)) };
}

/** Whether a user may change shares (write:commission-share); 403 otherwise. */
export const assertShareRight = (user) => { if (!hasPermission(user, 'write:commission-share')) throw forbidden('Only users with the right to change commission shares can change this value'); };

export const getSchemeRow = (db, ref) => fetch(db, ref);
export const schemeById = async (id) => (await one('SELECT * FROM sharing_schemes WHERE id = $1', [Number(id)])) || null;
