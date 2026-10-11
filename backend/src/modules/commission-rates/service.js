/**
 * Commission rules register (Master > Finance > Commission Rate Matrix; commission_rates): rules keyed by insurer,
 * product, line of business, policy type, channel type, motor type and sum insured band, with a rate basis of "% of
 * net premium" (one rate) or "issuing vs remitting" (three rates per peril, perils.js), for a date range.
 *
 * While commission.rules_approval_required is on (TISPH) a rule is never saved in force: it is a draft until its maker
 * submits it, a change request on Configuration Approvals (changes.js) until a holder of approve:commission-rules
 * other than the maker approves it, and then in force from its effective date. An approved rule is amended as a new
 * version that end-dates the one it replaces on approval, and ended rather than deleted. With the setting off a rule
 * is saved in force at once, as the matrix did before (other tenants).
 */
import { many, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { addDays, today } from '../../lib/dates.js';
import { CHANNEL_TYPES, LEVEL_LABELS, SPECIFICITY_SQL } from './resolve.js';
import { RATE_BASES, cleanPerilRates, isDualRateLine, perilDerived } from './perils.js';

export const STATUS_LABELS = { draft: 'Draft', pending: 'Pending approval', approved: 'Approved', returned: 'Returned', withdrawn: 'Withdrawn' };
export const CHANNEL_TYPE_LABELS = { financing_bank: 'Financing bank', dealer: 'Dealer', affinity_partner: 'Affinity partner', agent: 'Agent / referrer', direct: 'Direct' };

const SELECT = `SELECT r.*, ic.name AS insurer_name, ic.code AS insurer_code, p.name AS product_name, p.code AS product_code, p.line AS product_line,
    ${SPECIFICITY_SQL} AS level, (SELECT u.display_name FROM users u WHERE u.id = r.updated_by) AS updated_by_name,
    (SELECT u.display_name FROM users u WHERE u.id = r.submitted_by) AS submitted_by_name, (SELECT u.display_name FROM users u WHERE u.id = r.approved_by) AS approved_by_name,
    (SELECT c.id FROM accounting_config_changes c WHERE c.kind = 'commission-rule' AND c.target = 'rule:' || r.id AND c.status = 'pending' LIMIT 1) AS pending_change_id
  FROM commission_rates r LEFT JOIN insurance_companies ic ON ic.id = r.insurance_company_id LEFT JOIN products p ON p.id = r.product_id`;

/** Whether rule changes wait for approval on Configuration Approvals (commission.rules_approval_required). */
export const approvalRequired = async () => (await getSetting('commission.rules_approval_required', false)) === true;

const motorTypeName = async (code) => ((await getSetting('commission.motor_types', [])) || []).find((m) => String(m.code).toUpperCase() === String(code || '').toUpperCase())?.name || code || null;

export async function toRate(r) {
  const perilRates = (r.peril_rates || []).map((x) => ({ ...x, ...perilDerived(x) }));
  return {
    id: r.id, insuranceCompanyId: r.insurance_company_id, insurerName: r.insurer_name, insurerCode: r.insurer_code,
    productId: r.product_id, productName: r.product_name, productCode: r.product_code, lineOfBusiness: r.line_of_business,
    policyType: r.policy_type, channelType: r.channel_type, channelTypeLabel: r.channel_type ? CHANNEL_TYPE_LABELS[r.channel_type] || r.channel_type : null,
    motorType: r.motor_type, motorTypeName: await motorTypeName(r.motor_type), siFrom: r.si_from === null ? null : Number(r.si_from), siTo: r.si_to === null ? null : Number(r.si_to),
    rateBasis: r.rate_basis, rate: Number(r.rate), ratePercent: Math.round(Number(r.rate) * 1000000) / 10000, perilRates,
    effectiveFrom: r.effective_from, effectiveTo: r.effective_to, active: r.active, remarks: r.remarks,
    approvalStatus: r.approval_status, statusLabel: STATUS_LABELS[r.approval_status] || r.approval_status, version: r.version, replacesId: r.replaces_id,
    changeAction: r.change_action, changeNote: r.change_note, pendingChangeId: r.pending_change_id ? Number(r.pending_change_id) : null,
    submittedBy: r.submitted_by_name || r.submitted_by, submittedById: r.submitted_by, submittedAt: r.submitted_at, approvedBy: r.approved_by_name || r.approved_by, approvedAt: r.approved_at,
    level: LEVEL_LABELS[r.level], updatedBy: r.updated_by_name || r.updated_by, updatedById: r.updated_by, updatedAt: r.updated_at,
  };
}

export async function listRates(q = {}) {
  const where = ['TRUE'];
  const values = [];
  const add = (sql, v) => { values.push(v); where.push(sql.replaceAll('?', `$${values.length}`)); };
  if (q.insuranceCompanyId) add('r.insurance_company_id = ?', Number(q.insuranceCompanyId));
  if (q.productId) add('r.product_id = ?', Number(q.productId));
  if (q.lineOfBusiness) add('lower(r.line_of_business) = lower(?)', String(q.lineOfBusiness));
  if (q.policyType) add('r.policy_type = ?', String(q.policyType));
  if (q.channelType) add('r.channel_type = ?', String(q.channelType));
  if (q.motorType) add('upper(r.motor_type) = upper(?)', String(q.motorType));
  if (q.status && q.status !== 'all') add('r.approval_status = ?', String(q.status));
  if (q.active === 'true' || q.active === true) where.push('r.active');
  if (q.active === 'false' || q.active === false) where.push('NOT r.active');
  if (q.uploadId) add('r.upload_id = ?', String(q.uploadId));
  if (q.search) add('(ic.name ILIKE ? OR p.name ILIKE ? OR r.line_of_business ILIKE ? OR r.remarks ILIKE ? OR r.motor_type ILIKE ?)', `%${q.search}%`);
  const rows = await many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ic.name NULLS LAST, p.name NULLS LAST, r.line_of_business NULLS LAST, r.motor_type NULLS LAST, r.policy_type, r.effective_from DESC, r.version DESC`, values);
  return Promise.all(rows.map(toRate));
}

async function fetchRate(db, id, lock = false) {
  const row = (await db.query(`${SELECT} WHERE r.id = $1${lock ? ' FOR UPDATE OF r' : ''}`, [Number(id)])).rows[0];
  if (!row) throw notFound(`Commission rate ${id} not found`);
  return toRate(row);
}
export const getRate = (id) => fetchRate({ query }, id);

/** The versions of a rule (the chain of replaced rules), oldest first. */
export async function ruleHistory(id) {
  // up to the first version, then every version that replaced it
  let root = Number(id);
  for (let guard = 0; guard < 100; guard += 1) {
    const r = (await many('SELECT replaces_id FROM commission_rates WHERE id = $1', [root]))[0];
    if (!r?.replaces_id) break;
    root = r.replaces_id;
  }
  const rows = await many(`WITH RECURSIVE chain AS (SELECT r.id FROM commission_rates r WHERE r.id = $1
      UNION ALL SELECT r.id FROM commission_rates r JOIN chain c ON r.replaces_id = c.id)
    ${SELECT.replace('FROM commission_rates r', 'FROM chain JOIN commission_rates r ON r.id = chain.id')} ORDER BY r.version, r.id`, [root]);
  return Promise.all(rows.map(toRate));
}

const keysLabel = (v, names) => [names.insurer || 'Any insurer', names.product || names.lob || 'Any product', v.motor_type || null, v.policy_type === 'any' ? 'Any policy type' : v.policy_type,
  v.channel_type ? CHANNEL_TYPE_LABELS[v.channel_type] : null].filter(Boolean).join(' - ');

/** Reject a rule whose keys and dates overlap another rule in force or awaiting approval (checked under a table lock). */
async function assertNoOverlap(db, v, { exceptId = null, replacesId = null, review = false } = {}) {
  if (!v.active) return;
  const statuses = review ? ['approved', 'pending'] : ['approved', 'pending', 'draft', 'returned'];
  const hit = (await db.query(`SELECT r.id, r.effective_from, r.effective_to, r.si_from, r.si_to, ic.name AS insurer, p.name AS product FROM commission_rates r
      LEFT JOIN insurance_companies ic ON ic.id = r.insurance_company_id LEFT JOIN products p ON p.id = r.product_id
    WHERE r.active AND r.approval_status = ANY($12) AND ($1::int IS NULL OR r.id <> $1) AND ($11::int IS NULL OR r.id <> $11)
      AND r.insurance_company_id IS NOT DISTINCT FROM $2::int AND r.product_id IS NOT DISTINCT FROM $3::int
      AND lower(r.line_of_business) IS NOT DISTINCT FROM lower($4::text) AND r.policy_type = $5
      AND r.channel_type IS NOT DISTINCT FROM $8::text AND upper(r.motor_type) IS NOT DISTINCT FROM upper($9::text)
      AND ((r.si_from IS NULL AND r.si_to IS NULL AND $10::numeric IS NULL AND $13::numeric IS NULL)
        OR (NOT (r.si_from IS NULL AND r.si_to IS NULL) AND NOT ($10::numeric IS NULL AND $13::numeric IS NULL)
            AND numrange(COALESCE(r.si_from, 0), COALESCE(r.si_to, 1e15), '[]') && numrange(COALESCE($10::numeric, 0), COALESCE($13::numeric, 1e15), '[]')))
      AND daterange(r.effective_from, r.effective_to, '[]') && daterange($6::date, $7::date, '[]')
    ORDER BY r.effective_from LIMIT 1`,
  [exceptId, v.insurance_company_id, v.product_id, v.line_of_business, v.policy_type, v.effective_from, v.effective_to, v.channel_type, v.motor_type, v.si_from, replacesId, statuses, v.si_to])).rows[0];
  if (!hit) return;
  const banded = (hit.si_from !== null || hit.si_to !== null) && (v.si_from !== null || v.si_to !== null)
    && !(Number(hit.si_from ?? 0) === Number(v.si_from ?? 0) && Number(hit.si_to ?? 1e15) === Number(v.si_to ?? 1e15));
  if (banded) throw conflict(`The sum insured band overlaps band ${Number(hit.si_from ?? 0)} - ${hit.si_to === null ? 'open' : Number(hit.si_to)} of another rule with the same keys (rule #${hit.id})`);
  throw conflict(`Another rule for ${keysLabel(v, { insurer: hit.insurer, product: hit.product, lob: v.line_of_business })} is in force on these dates (rule #${hit.id}, ${hit.effective_from} to ${hit.effective_to || 'open'})`);
}

/**
 * A line of business must be a code of the Line of Business master (case-insensitive; stored in lower case): a rate on
 * an unknown code would never apply. Checked when the code is set or changed (the go-live workbook checks the same).
 */
async function checkLineOfBusiness(db, code) {
  if (!code) return;
  const hit = (await db.query(`SELECT 1 FROM master_records WHERE type_code = 'line-of-business' AND status <> 'deleted' AND lower(code) = lower($1)`, [code])).rowCount;
  if (!hit) {
    const message = `Line of business ${code} is not in the Line of Business master (Master > Line of Business); use one of its codes`;
    throw badRequest(message, [{ path: 'lineOfBusiness', message }]);
  }
}

/** Whether the rule's line is rated per peril (Motor): its line of business, else its product's line. */
async function dualRateRule(db, v) {
  if (v.line_of_business) return isDualRateLine(v.line_of_business);
  if (v.product_id) {
    const p = (await db.query('SELECT line FROM products WHERE id = $1', [v.product_id])).rows[0];
    return isDualRateLine(p?.line);
  }
  return false;
}

async function checkRefs(db, v) {
  if (v.insurance_company_id && !(await db.query('SELECT 1 FROM insurance_companies WHERE id = $1', [v.insurance_company_id])).rowCount) {
    throw badRequest('Validation failed', [{ path: 'insuranceCompanyId', message: `Insurance company ${v.insurance_company_id} not found` }]);
  }
  if (v.product_id && !(await db.query('SELECT 1 FROM products WHERE id = $1', [v.product_id])).rowCount) {
    throw badRequest('Validation failed', [{ path: 'productId', message: `Product ${v.product_id} not found` }]);
  }
  if (!v.insurance_company_id && !v.product_id && !v.line_of_business) {
    throw badRequest('Choose an insurer, a product or a line of business', [{ path: 'insuranceCompanyId', message: 'Choose an insurer, a product or a line of business (the general default is commission.default_rate)' }]);
  }
  if (v.effective_to && v.effective_to < v.effective_from) throw badRequest('Effective to must be on or after effective from', [{ path: 'effectiveTo', message: 'Effective to must be on or after effective from' }]);
  if (v.si_from !== null && v.si_to !== null && Number(v.si_to) <= Number(v.si_from)) throw badRequest('Sum insured to must be higher than sum insured from', [{ path: 'siTo', message: 'Sum insured to must be higher than sum insured from' }]);
  if (v.channel_type && !CHANNEL_TYPES.includes(v.channel_type)) throw badRequest('Validation failed', [{ path: 'channelType', message: `channelType must be one of ${CHANNEL_TYPES.join(', ')}` }]);
  if (!RATE_BASES.includes(v.rate_basis)) throw badRequest('Validation failed', [{ path: 'rateBasis', message: `rateBasis must be one of ${RATE_BASES.join(', ')}` }]);
  if (v.motor_type) {
    const known = ((await getSetting('commission.motor_types', [])) || []).some((m) => String(m.code).toUpperCase() === String(v.motor_type).toUpperCase());
    if (!known) throw badRequest('Validation failed', [{ path: 'motorType', message: `Motor type ${v.motor_type} is not in the list of motor types (Master > Configuration)` }]);
  }
  if ((v.rate_basis === 'issuing-remitting' || v.motor_type || v.si_from !== null || v.si_to !== null) && !(await dualRateRule(db, v))) {
    const message = 'Issuing vs remitting, a motor type and a sum insured band are used for Motor products only';
    throw badRequest(message, [{ path: 'rateBasis', message }]);
  }
}

const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const columnsOf = (b, base = {}) => ({
  insurance_company_id: b.insuranceCompanyId !== undefined ? b.insuranceCompanyId : base.insuranceCompanyId ?? null,
  product_id: b.productId !== undefined ? b.productId : base.productId ?? null,
  line_of_business: b.lineOfBusiness !== undefined ? (b.lineOfBusiness ? String(b.lineOfBusiness).trim().toLowerCase() : null) : base.lineOfBusiness ?? null,
  policy_type: b.policyType ?? base.policyType ?? 'any',
  channel_type: b.channelType !== undefined ? (b.channelType || null) : base.channelType ?? null,
  motor_type: b.motorType !== undefined ? (b.motorType ? String(b.motorType).trim().toUpperCase() : null) : base.motorType ?? null,
  si_from: b.siFrom !== undefined ? numOrNull(b.siFrom) : base.siFrom ?? null,
  si_to: b.siTo !== undefined ? numOrNull(b.siTo) : base.siTo ?? null,
  rate_basis: b.rateBasis ?? base.rateBasis ?? 'net-premium',
  rate: b.rate ?? base.rate ?? 0,
  peril_rates: b.perilRates !== undefined ? b.perilRates : base.perilRates ?? [],
  effective_from: b.effectiveFrom ?? base.effectiveFrom,
  effective_to: b.effectiveTo !== undefined ? b.effectiveTo : base.effectiveTo ?? null,
  active: b.active ?? base.active ?? true,
  remarks: b.remarks !== undefined ? b.remarks : base.remarks ?? null,
});

/** Validate the columns of a rule (references, keys, basis, peril rates); returns the columns with clean peril rates. */
async function cleanColumns(db, b, base = {}) {
  const v = columnsOf(b, base);
  await checkRefs(db, v);
  if ((v.line_of_business || null) !== (base.lineOfBusiness ? String(base.lineOfBusiness).toLowerCase() : null)) await checkLineOfBusiness(db, b.lineOfBusiness ? String(b.lineOfBusiness).trim() : null);
  if (v.rate_basis === 'issuing-remitting') {
    v.peril_rates = (await cleanPerilRates(v.peril_rates)).rows;
    v.rate = 0;
  } else {
    v.peril_rates = [];
    if (v.rate === null || v.rate === undefined || Number(v.rate) < 0 || Number(v.rate) > 1) throw badRequest('Validation failed', [{ path: 'rate', message: 'rate must be between 0 and 1' }]);
  }
  return v;
}

const COLS = ['insurance_company_id', 'product_id', 'line_of_business', 'policy_type', 'channel_type', 'motor_type', 'si_from', 'si_to', 'rate_basis', 'rate', 'peril_rates', 'effective_from', 'effective_to', 'active', 'remarks'];
const values = (v) => COLS.map((c) => (c === 'peril_rates' ? JSON.stringify(v[c] || []) : v[c]));

async function insertRule(db, v, { status, version = 1, replacesId = null, changeAction = 'new', user, uploadId = null }) {
  const r = await db.query(`INSERT INTO commission_rates(${COLS.join(', ')}, approval_status, version, replaces_id, change_action, created_by, updated_by, upload_id)
    VALUES (${COLS.map((_, i) => `$${i + 1}`).join(',')}, $${COLS.length + 1}, $${COLS.length + 2}, $${COLS.length + 3}, $${COLS.length + 4}, $${COLS.length + 5}, $${COLS.length + 5}, $${COLS.length + 6}) RETURNING id`,
  [...values(v), status, version, replacesId, changeAction, user?.id ?? null, uploadId]);
  return r.rows[0].id;
}

async function updateRule(db, id, v, user) {
  await db.query(`UPDATE commission_rates SET ${COLS.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_by = $${COLS.length + 2}, updated_at = now() WHERE id = $1`,
    [id, ...values(v), user?.id ?? null]);
}

/** Add a rule: in force at once, or a draft (submit: true sends it for approval) while rule changes are reviewed. */
export async function createRate(b, user, { uploadId = null, direct = false } = {}) {
  return withTransaction(async (db) => {
    await db.query('LOCK TABLE commission_rates IN SHARE ROW EXCLUSIVE MODE');
    const review = !direct && (await approvalRequired());
    const v = await cleanColumns(db, b);
    await assertNoOverlap(db, v, { review });
    const id = await insertRule(db, v, { status: review ? 'draft' : 'approved', user, uploadId });
    if (review && b.submit) await submitIn(db, id, user, b.changeNote || null);
    return fetchRate(db, id);
  });
}

/**
 * Change a rule. Under review a draft or returned rule is edited in place; an approved rule is amended as a new
 * version (a draft that replaces it; submit: true sends it for approval); a pending rule is refused. Without review
 * the rule is changed in place, as before.
 */
export async function updateRate(id, b, user, { direct = false } = {}) {
  return withTransaction(async (db) => {
    await db.query('LOCK TABLE commission_rates IN SHARE ROW EXCLUSIVE MODE');
    const before = await fetchRate(db, id, true);
    const review = !direct && (await approvalRequired());
    if (!review) {
      const v = await cleanColumns(db, b, before);
      await assertNoOverlap(db, v, { exceptId: before.id });
      await updateRule(db, before.id, v, user);
      return { before, after: await fetchRate(db, before.id) };
    }
    if (before.approvalStatus === 'pending') throw conflict('This rule already has a change waiting for approval');
    if (['draft', 'returned', 'withdrawn'].includes(before.approvalStatus)) {
      const v = await cleanColumns(db, b, before);
      await assertNoOverlap(db, v, { exceptId: before.id, replacesId: before.replacesId, review: true });
      await updateRule(db, before.id, v, user);
      await db.query("UPDATE commission_rates SET approval_status = 'draft' WHERE id = $1 AND approval_status = 'withdrawn'", [before.id]);
      if (b.submit) await submitIn(db, before.id, user, b.changeNote || null);
      return { before, after: await fetchRate(db, before.id) };
    }
    // approved: a new version replaces this one from its effective date
    const v = await cleanColumns(db, { ...b, active: true }, before);
    if (!b.effectiveFrom) throw badRequest('Give the effective-from date of the new version', [{ path: 'effectiveFrom', message: 'Give the effective-from date of the new version' }]);
    await assertNoOverlap(db, v, { replacesId: before.id, review: true });
    const latest = (await db.query('SELECT COALESCE(max(version), 0) AS v FROM commission_rates WHERE replaces_id = $1 OR id = $1', [before.id])).rows[0].v;
    const newId = await insertRule(db, v, { status: 'draft', version: Number(latest) + 1, replacesId: before.id, changeAction: 'amend', user });
    if (b.submit) await submitIn(db, newId, user, b.changeNote || null);
    return { before, after: await fetchRate(db, newId) };
  });
}

/** Delete a rule: never an approved one under review (it is used by quotations and policies; end it instead). */
export async function deleteRate(id) {
  return withTransaction(async (db) => {
    const before = await fetchRate(db, id, true);
    if ((await approvalRequired()) && ['approved', 'pending'].includes(before.approvalStatus)) {
      throw conflict('This rule is used by quotations or policies and cannot be deleted. Use End instead.');
    }
    await db.query("UPDATE accounting_config_changes SET status = 'withdrawn', decided_at = now() WHERE kind = 'commission-rule' AND target = $1 AND status = 'pending'", [`rule:${before.id}`]);
    await db.query('DELETE FROM commission_rates WHERE id = $1', [before.id]);
    return before;
  });
}

async function submitIn(db, id, user, note) {
  const { submitRuleChange } = await import('./changes.js');
  const r = await fetchRate(db, id, true);
  if (!['draft', 'returned', 'withdrawn'].includes(r.approvalStatus)) throw conflict(r.approvalStatus === 'pending' ? 'This rule already has a change waiting for approval' : `Rule #${r.id} is ${r.statusLabel.toLowerCase()}`);
  if (r.effectiveFrom < (await today())) throw badRequest('Effective from cannot be before today', [{ path: 'effectiveFrom', message: 'Effective from cannot be before today' }]);
  await assertNoOverlap(db, columnsOf({}, r), { exceptId: r.id, replacesId: r.replacesId, review: true });
  await submitRuleChange(db, r, { action: r.changeAction || 'new', note, user });
  await db.query("UPDATE commission_rates SET approval_status = 'pending', submitted_by = $2, submitted_at = now(), change_note = $3, updated_by = $2, updated_at = now() WHERE id = $1", [r.id, user?.id ?? null, note]);
}

/** Submit a draft or returned rule for approval (Configuration Approvals). */
export async function submitRate(id, user, { changeNote = null } = {}) {
  if (!(await approvalRequired())) throw conflict('Commission rules are saved in force: there is no approval step');
  return withTransaction(async (db) => {
    await db.query('LOCK TABLE commission_rates IN SHARE ROW EXCLUSIVE MODE');
    await submitIn(db, id, user, changeNote);
    return fetchRate(db, id);
  });
}

/** Withdraw a pending rule (its maker, or an approver): back to draft, the change withdrawn. */
export async function withdrawRate(id, user) {
  return withTransaction(async (db) => {
    const r = await fetchRate(db, id, true);
    if (r.approvalStatus !== 'pending') throw conflict(`Rule #${r.id} is ${r.statusLabel.toLowerCase()}; only a pending rule can be withdrawn`);
    const approver = (user?.permissions || []).includes('approve:commission-rules') || (user?.roles || []).includes('system-admin');
    if (r.submittedById !== user?.id && !approver) throw conflict('Only the user who submitted the rule or an approver can withdraw it');
    await db.query("UPDATE accounting_config_changes SET status = 'withdrawn', decided_by = $2, decided_at = now() WHERE kind = 'commission-rule' AND target = $1 AND status = 'pending'", [`rule:${r.id}`, user?.id ?? null]);
    await db.query("UPDATE commission_rates SET approval_status = 'withdrawn', updated_by = $2, updated_at = now() WHERE id = $1", [r.id, user?.id ?? null]);
    return fetchRate(db, r.id);
  });
}

/** End an approved rule on a date (sent for approval under review; applied at once otherwise). */
export async function endRate(id, { effectiveTo, changeNote = null }, user) {
  return withTransaction(async (db) => {
    const r = await fetchRate(db, id, true);
    if (r.approvalStatus !== 'approved') throw conflict(`Rule #${r.id} is ${r.statusLabel.toLowerCase()}; only an approved rule can be ended`);
    if (!effectiveTo || effectiveTo < r.effectiveFrom) throw badRequest('Effective to must be on or after effective from', [{ path: 'effectiveTo', message: 'Effective to must be on or after effective from' }]);
    if (!(await approvalRequired())) {
      await db.query('UPDATE commission_rates SET effective_to = $2, updated_by = $3, updated_at = now() WHERE id = $1', [r.id, effectiveTo, user?.id ?? null]);
      return fetchRate(db, r.id);
    }
    if (r.pendingChangeId) throw conflict('This rule already has a change waiting for approval');
    const { submitRuleChange } = await import('./changes.js');
    await submitRuleChange(db, r, { action: 'end', effectiveTo, note: changeNote, user });
    return fetchRate(db, r.id);
  });
}

/**
 * Apply an approved or rejected rule change (changes.js): approve puts the rule in force (and end-dates the version it
 * replaces, or sets the end date of an ended rule); reject returns it to its maker.
 */
export async function applyRuleDecision(db, change, action, user) {
  const ruleId = Number(change.payload?.ruleId);
  const r = (await db.query('SELECT * FROM commission_rates WHERE id = $1 FOR UPDATE', [ruleId])).rows[0];
  if (!r) throw notFound(`Commission rule ${ruleId} not found`);
  const act = change.payload?.action || 'new';
  if (action !== 'approve') {
    if (act !== 'end') await db.query("UPDATE commission_rates SET approval_status = 'returned', updated_by = $2, updated_at = now() WHERE id = $1", [r.id, user?.id ?? null]);
    return;
  }
  if (act === 'end') {
    await db.query('UPDATE commission_rates SET effective_to = $2, updated_by = $3, updated_at = now() WHERE id = $1', [r.id, change.payload.effectiveTo, user?.id ?? null]);
    return;
  }
  if (r.approval_status !== 'pending') throw conflict(`Rule #${r.id} is ${STATUS_LABELS[r.approval_status]?.toLowerCase() || r.approval_status}`);
  if (String(r.effective_from).slice(0, 10) < (await today())) {
    throw conflict('The effective-from date of this change has passed. Return it so that the maker can set a new date.');
  }
  await db.query(`UPDATE commission_rates SET approval_status = 'approved', active = true, approved_by = $2, approved_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`, [r.id, user?.id ?? null]);
  if (r.replaces_id) {
    await db.query(`UPDATE commission_rates SET effective_to = $2::date, updated_by = $3, updated_at = now() WHERE id = $1 AND (effective_to IS NULL OR effective_to >= $2::date)`,
      [r.replaces_id, addDays(String(r.effective_from).slice(0, 10), -1), user?.id ?? null]);
  }
}
