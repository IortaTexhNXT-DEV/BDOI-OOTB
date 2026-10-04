/**
 * Product Configurator rules applied in the business flow.
 *
 * Governing template: the product template whose rating factors, acceptance rules, coverages, market and document
 * templates apply to a quotation, broker slip, placement or policy: the template named on the record (templateCode),
 * else for motor the pricing template (setting motor.pricing_template_code, the one the quote wizard prices with),
 * else the newest Active template in force for the product, else for the line of business.
 *
 * Acceptance rules (product_components kind 'underwriting-rules') are insurer underwriting guidelines. Each rule tests
 * one risk field (vehicle age, vehicle use, sum insured, number of members...) with an operator and a value, and
 * applies to every insurer or to one insurer:
 *  - Auto-Accept: the risk is accepted when the condition holds; otherwise the rule's otherwiseAction (Refer by
 *    default, or Decline) applies.
 *  - Refer: when the condition holds the quotation is referred; it cannot be sent to the customer, approved, placed or
 *    issued until a user with the rule's authority role (and enough Underwriting referral authority in the authority
 *    matrix for the sum insured) approves the referral.
 *  - Decline: when the condition holds the quotation (or the insurer on a broker slip) is refused with the rule's message.
 *  - Apply Loading: when the condition holds loadingPercent % of the net premium is added to the net premium.
 * A rule whose field is not on the record is reported as not evaluated (it neither accepts nor refers).
 *
 * Rating factors (kind 'rating-factors') multiply the net premium by the factor of the band the risk falls in
 * (Multiplicative / Discount), or add factor % of it (Additive), when the record carries the factor's field.
 */
import { query } from '../../db/pool.js';
import { badRequest, forbidden } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { num, round2 } from '../../lib/money.js';

const run = (db) => db || { query };
const rows = async (db, sql, params) => (await run(db).query(sql, params)).rows;
const first = async (db, sql, params) => (await rows(db, sql, params))[0] || null;

/** Risk fields a rule or rating factor can test: label, type and (text fields) the values offered on screen. */
export const RISK_FIELDS = {
  vehicleAge: { label: 'Vehicle age (years)', type: 'number' },
  vehicleUse: { label: 'Vehicle use', type: 'text', options: ['Private', 'Commercial', 'PUV', 'TNVS'] },
  vehicleType: { label: 'Vehicle class', type: 'text' },
  sumInsured: { label: 'Sum insured', type: 'number' },
  fairMarketValue: { label: 'Fair market value', type: 'number' },
  driverAge: { label: 'Driver age', type: 'number' },
  claimsLast3Years: { label: 'Claims in the last 3 years', type: 'number' },
  ncbYears: { label: 'Claim-free years (NCB)', type: 'number' },
  fleetSize: { label: 'Fleet size', type: 'number' },
  memberCount: { label: 'Number of members', type: 'number' },
  modified: { label: 'Vehicle has modifications', type: 'boolean' },
  floodProne: { label: 'Location in a flood-prone area', type: 'boolean' },
  constructionType: { label: 'Construction type', type: 'text', options: ['Concrete', 'Mixed', 'Wood'] },
};
export const OPERATORS = ['<=', '<', '>=', '>', '=', '!='];
export const RULE_ACTIONS = ['Auto-Accept', 'Refer', 'Decline', 'Apply Loading'];
export const RULE_TYPES = ['Acceptance', 'Validation', 'Referral', 'Loading'];

/** Condition text of the earlier free-text rules -> structured condition (used when a rule has no field yet). */
const LABELS = {
  'vehicle age': 'vehicleAge', 'vehicle use': 'vehicleUse', 'vehicle class': 'vehicleType', 'sum insured': 'sumInsured', 'fair market value': 'fairMarketValue',
  'driver age': 'driverAge', 'claims in last 3 years': 'claimsLast3Years', 'claims in the last 3 years': 'claimsLast3Years', 'number of members': 'memberCount',
  'fleet size': 'fleetSize', 'construction type': 'constructionType',
};
const PHRASES = [[/modification/i, 'modified'], [/flood/i, 'floodProne']];

export function parseCondition(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const m = s.match(/^(.+?)\s*(<=|>=|!=|<|>|=)\s*(.+)$/);
  if (m) {
    const field = LABELS[m[1].trim().toLowerCase()];
    if (!field) return null;
    const rhs = m[3].trim();
    const ref = rhs.match(/^(.+?)\s*\*\s*([\d.]+)$/);
    if (ref && LABELS[ref[1].trim().toLowerCase()]) return { field, operator: m[2], valueField: LABELS[ref[1].trim().toLowerCase()], valueFactor: Number(ref[2]) };
    const n = Number(rhs.replace(/,/g, '').replace(/\s*(years?|yrs?|%|php)$/i, ''));
    return { field, operator: m[2], value: Number.isFinite(n) ? n : rhs };
  }
  const phrase = PHRASES.find(([re]) => re.test(s));
  return phrase ? { field: phrase[1], operator: '=', value: true } : null;
}

/** Structured condition of a rule: its own field / operator / value, else parsed from the condition text. */
export function conditionOf(rule) {
  if (rule.field && RISK_FIELDS[rule.field]) {
    return { field: rule.field, operator: rule.operator || '=', value: rule.value, valueField: rule.valueField || null, valueFactor: rule.valueFactor ?? null };
  }
  return parseCondition(rule.condition);
}

/** Readable condition, e.g. "Vehicle age (years) <= 15" or "Sum insured > Fair market value x 1.1". */
export function describeCondition(c) {
  if (!c) return '';
  const label = RISK_FIELDS[c.field]?.label || c.field;
  if (RISK_FIELDS[c.field]?.type === 'boolean') return c.value === false || c.value === 'false' ? `Not: ${label.toLowerCase()}` : label;
  const rhs = c.valueField ? `${RISK_FIELDS[c.valueField]?.label || c.valueField}${c.valueFactor && Number(c.valueFactor) !== 1 ? ` x ${c.valueFactor}` : ''}` : String(c.value);
  return `${label} ${c.operator} ${rhs}`;
}

/** Checks of a rule before it is saved (merged data); returns [{ path, message }]. */
export async function ruleErrors(data, db = null) {
  const errors = [];
  if (data.action && !RULE_ACTIONS.includes(data.action)) errors.push({ path: 'action', message: `action must be one of ${RULE_ACTIONS.join(', ')}` });
  if (data.type && !RULE_TYPES.includes(data.type)) errors.push({ path: 'type', message: `type must be one of ${RULE_TYPES.join(', ')}` });
  if (data.field !== undefined && data.field !== null && data.field !== '') {
    if (!RISK_FIELDS[data.field]) errors.push({ path: 'field', message: `field must be one of ${Object.keys(RISK_FIELDS).join(', ')}` });
    if (data.operator && !OPERATORS.includes(data.operator)) errors.push({ path: 'operator', message: `operator must be one of ${OPERATORS.join(' ')}` });
    if (RISK_FIELDS[data.field]?.type === 'number' && !data.valueField && !Number.isFinite(Number(data.value))) errors.push({ path: 'value', message: 'value must be a number for this field' });
    if (data.valueField && !RISK_FIELDS[data.valueField]) errors.push({ path: 'valueField', message: 'valueField must be a risk field' });
  } else if (!parseCondition(data.condition)) {
    errors.push({ path: 'field', message: 'Choose the risk field, operator and value the rule tests: the condition text alone cannot be evaluated' });
  }
  if (data.action === 'Apply Loading' && !(num(data.loadingPercent) > 0)) errors.push({ path: 'loadingPercent', message: 'A loading rule needs the loading % (above 0)' });
  if (data.action === 'Auto-Accept' && data.otherwiseAction && !['Refer', 'Decline'].includes(data.otherwiseAction)) errors.push({ path: 'otherwiseAction', message: 'otherwiseAction must be Refer or Decline' });
  const refers = data.action === 'Refer' || (data.action === 'Auto-Accept' && (data.otherwiseAction || 'Refer') === 'Refer');
  if (refers && !data.authorityRole) errors.push({ path: 'authorityRole', message: 'A rule that refers needs the authority role that may approve the referral' });
  if (data.authorityRole && !(await first(db, 'SELECT 1 FROM roles WHERE code = $1', [data.authorityRole]))) errors.push({ path: 'authorityRole', message: `Role ${data.authorityRole} does not exist` });
  if (data.insurerId || data.insurerName) {
    const ic = await first(db, `SELECT id, name FROM insurance_companies WHERE id::text = $1 OR lower(name) = lower($1) OR lower(code) = lower($1)`, [String(data.insurerId || data.insurerName)]);
    if (!ic) errors.push({ path: 'insurerId', message: `Insurer ${data.insurerId || data.insurerName} is not in the insurer master` });
    else { data.insurerId = ic.id; data.insurerName = ic.name; }
  } else { data.insurerId = null; data.insurerName = null; }
  const c = conditionOf(data);
  if (c && !errors.length) data.condition = describeCondition(c);
  return errors;
}

// ---------------------------------------------------------------- governing template

/** The template in force that governs a record: { id, template_code, name, product_id, line_of_business, insurers } or null. */
export async function governingTemplate({ templateCode = null, productId = null, lob = null } = {}, db = null) {
  const on = await today();
  const inForce = `t.status = 'Active' AND (t.effective_date IS NULL OR t.effective_date <= $2::date) AND (t.expiry_date IS NULL OR t.expiry_date >= $2::date)`;
  const order = 'ORDER BY t.effective_date DESC NULLS LAST, t.version DESC, t.id DESC LIMIT 1';
  if (templateCode) {
    const t = await first(db, `SELECT t.* FROM product_templates t WHERE lower(t.template_code) = lower($1) AND ${inForce} ${order}`, [String(templateCode), on]);
    if (t) return t;
  }
  const line = lob ? String(lob).toUpperCase() : null;
  if (line === 'MOTOR') {
    const code = await getSetting('motor.pricing_template_code');
    const t = code ? await first(db, `SELECT t.* FROM product_templates t WHERE t.template_code = $1 AND ${inForce} ${order}`, [code, on]) : null;
    if (t) return t;
  }
  if (productId) {
    const t = await first(db, `SELECT t.* FROM product_templates t WHERE t.product_id::text = $1::text AND ${inForce} ${order}`, [String(productId), on]);
    if (t) return t;
  }
  if (line) return first(db, `SELECT t.* FROM product_templates t WHERE upper(t.line_of_business) = $1 AND ${inForce} ${order}`, [line, on]);
  return null;
}

const components = (db, templateId, kind) => rows(db, `SELECT id, code, name, data, status FROM product_components WHERE template_id = $1 AND kind = $2 AND status = 'Active'
  ORDER BY sort_order, id`, [templateId, kind]);

// ---------------------------------------------------------------- risk facts

const yes = (v) => v === true || ['true', 'yes', 'y', '1'].includes(String(v ?? '').trim().toLowerCase());
const present = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const pick = (...vals) => vals.find(present);

/** The facts a rule can test, read from a quotation / broker slip / placement document. Missing facts are left out. */
export async function riskFacts(v = {}) {
  const vd = (Array.isArray(v.insuranceVehicleDetails) ? v.insuranceVehicleDetails[0] : v.insuranceVehicleDetails) || {};
  const pd = v.policyDetails || {};
  const rd = v.riskDetails || {};
  const src = [v, pd, vd, rd];
  const get = (...keys) => pick(...keys.flatMap((k) => src.map((s) => s?.[k])));
  const f = {};
  const year = Number(String(await today()).slice(0, 4));
  const modelYear = num(get('modelYear', 'ModelYear', 'yearModel'));
  if (present(get('vehicleAge'))) f.vehicleAge = num(get('vehicleAge'));
  else if (modelYear > 1900) f.vehicleAge = Math.max(0, year - modelYear);
  const vehicleType = get('vehicleType', 'VehicleType');
  if (vehicleType) f.vehicleType = String(vehicleType);
  const use = get('vehicleUse', 'usage');
  if (use) f.vehicleUse = String(use);
  else if (vehicleType) {
    const byClass = (await getSetting('underwriting.vehicle_use_by_class', { taxi_puj_and_mini_bus: 'PUV', pub_and_tourist_bus: 'PUV' })) || {};
    if (byClass[vehicleType]) f.vehicleUse = byClass[vehicleType];
    else if (yes(get('TNVS'))) f.vehicleUse = 'TNVS';
  }
  const si = num(v.totalSumInsured) || num(v.sumInsured) || num(rd.sumInsured) || num(v.lossAndDamageCoverage);
  if (si > 0) f.sumInsured = round2(si);
  for (const k of ['fairMarketValue', 'driverAge', 'claimsLast3Years', 'ncbYears', 'fleetSize']) if (present(get(k))) f[k] = num(get(k));
  const members = get('memberCount', 'numberOfMembers', 'numberOfEmployees');
  if (present(members)) f.memberCount = num(members);
  else if (Array.isArray(v.members)) f.memberCount = v.members.length;
  for (const [k, keys] of [['modified', ['modified', 'vehicleModified', 'hasModifications']], ['floodProne', ['floodProne', 'floodProneArea']]]) {
    const x = get(...keys);
    if (present(x)) f[k] = yes(x);
  }
  const ct = get('constructionType', 'construction');
  if (ct) f.constructionType = String(ct);
  return f;
}

const eq = (a, b) => (typeof a === 'boolean' || typeof b === 'boolean' ? yes(a) === yes(b) : String(a).trim().toLowerCase() === String(b).trim().toLowerCase());

/** true / false, or null when the field (or the field compared with) is not known. */
export function test(c, facts) {
  if (!c) return null;
  const a = facts[c.field];
  if (a === undefined) return null;
  let b = c.value;
  if (c.valueField) {
    if (facts[c.valueField] === undefined) return null;
    b = num(facts[c.valueField]) * (c.valueFactor === null || c.valueFactor === undefined ? 1 : Number(c.valueFactor));
  }
  if (RISK_FIELDS[c.field]?.type === 'boolean' && (b === undefined || b === null || b === '')) b = true;
  switch (c.operator) {
    case '<=': return num(a) <= num(b);
    case '<': return num(a) < num(b);
    case '>=': return num(a) >= num(b);
    case '>': return num(a) > num(b);
    case '!=': return !eq(a, b);
    default: return typeof a === 'number' && Number.isFinite(Number(b)) ? num(a) === num(b) : eq(a, b);
  }
}

// ---------------------------------------------------------------- rating factors

/** Band of a rating factor rule: from its from / to / equals, else parsed from its condition text ("2-5 years", "> 10", "3+", "Concrete", "Standard"). */
export function bandOf(r) {
  if (present(r.from) || present(r.to)) return { from: present(r.from) ? num(r.from) : null, to: present(r.to) ? num(r.to) : null };
  if (present(r.equals)) return { equals: r.equals };
  const s = String(r.condition || '').trim().replace(/,/g, '').replace(/\s*(years?|yrs?)$/i, '');
  let m = s.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (m) return { from: Number(m[1]), to: Number(m[2]) };
  m = s.match(/^(>=|<=|>|<)\s*([\d.]+)$/);
  if (m) return { op: m[1], n: Number(m[2]) };
  m = s.match(/^([\d.]+)\s*\+$/);
  if (m) return { op: '>=', n: Number(m[1]) };
  if (/^\d+(\.\d+)?$/.test(s)) return { from: Number(s), to: Number(s) };
  if (/^(standard|base|default|all)$/i.test(s)) return { always: true };
  return s ? { equals: s } : null;
}

const inBand = (band, v) => {
  if (!band) return false;
  if (band.always) return true;
  if (band.equals !== undefined) return eq(v, band.equals);
  const x = num(v);
  if (band.op) return test({ field: 'x', operator: band.op, value: band.n }, { x });
  return (band.from === null || x >= band.from) && (band.to === null || x <= band.to);
};

/** Field a factor rates on: its own, else by the usual factor codes. */
const FACTOR_FIELDS = { VEH_AGE: 'vehicleAge', DRV_AGE: 'driverAge', NCB: 'ncbYears', USE: 'vehicleUse', FLEET: 'fleetSize', CONST_TYPE: 'constructionType', CLAIMS: 'claimsLast3Years' };
export const factorField = (f) => (f.field && RISK_FIELDS[f.field] ? f.field : FACTOR_FIELDS[String(f.factorCode || '').toUpperCase()] || null);

/** Rating factors of a template on the risk: [{ factorCode, factorName, field, value, band, factor, type }] (only factors that matched a band). */
export function applicableFactors(factors, facts, { skip = [] } = {}) {
  const out = [];
  for (const f of factors) {
    const field = factorField(f);
    if (!field || skip.includes(field) || facts[field] === undefined) continue;
    const bands = Array.isArray(f.rules) ? f.rules : [];
    const specific = bands.find((r) => !bandOf(r)?.always && inBand(bandOf(r), facts[field]));
    const hit = specific || bands.find((r) => bandOf(r)?.always);
    if (!hit || !Number.isFinite(Number(hit.factor))) continue;
    out.push({ factorCode: f.factorCode, factorName: f.factorName, field, value: facts[field], band: hit.condition || null, factor: Number(hit.factor), type: f.type || 'Multiplicative' });
  }
  return out;
}

// ---------------------------------------------------------------- evaluation

const ROLE_NAMES = async (db, codes) => Object.fromEntries((await rows(db, 'SELECT code, name FROM roles WHERE code = ANY($1)', [codes])).map((r) => [r.code, r.name]));

/** Outcome of one rule on the facts. */
function outcomeOf(rule, facts) {
  const c = conditionOf(rule);
  const met = test(c, facts);
  const base = { ruleCode: rule.ruleCode, ruleName: rule.ruleName, type: rule.type, action: rule.action, condition: describeCondition(c) || rule.condition || '',
    insurerId: rule.insurerId || null, insurerName: rule.insurerName || null, authorityRole: rule.authorityRole || null, message: rule.message || rule.ruleName };
  if (met === null) return { ...base, outcome: 'not-evaluated', message: `${RISK_FIELDS[c?.field]?.label || 'The tested field'} is not on the record` };
  if (rule.action === 'Auto-Accept') {
    if (met) return { ...base, outcome: 'accepted' };
    const otherwise = rule.otherwiseAction || 'Refer';
    return { ...base, outcome: otherwise === 'Decline' ? 'declined' : 'referred', message: rule.otherwiseMessage || `${rule.ruleName}: not met (${base.condition})` };
  }
  if (!met) return { ...base, outcome: 'passed' };
  if (rule.action === 'Decline') return { ...base, outcome: 'declined' };
  if (rule.action === 'Refer') return { ...base, outcome: 'referred' };
  if (rule.action === 'Apply Loading') return { ...base, outcome: 'loaded', loadingPercent: num(rule.loadingPercent) };
  return { ...base, outcome: 'passed' };
}

/**
 * Acceptance rules and rating factors of the governing template on a risk.
 * Returns null when no template governs the record, else
 * { templateId, templateCode, templateName, decision: accepted|referred|declined, results, referredRules, declinedRules,
 *   loadingPercent, factors, facts }.
 */
export async function evaluate(v, { insurerId = null, productId = null, lob = null, templateCode = null } = {}, db = null) {
  const t = await governingTemplate({ templateCode: templateCode || v.productTemplateCode || v.templateCode, productId: productId || v.productId, lob }, db);
  if (!t) return null;
  const facts = await riskFacts(v);
  const rules = (await components(db, t.id, 'underwriting-rules')).map((r) => r.data)
    .filter((r) => !r.insurerId || (insurerId && Number(r.insurerId) === Number(insurerId)));
  const results = rules.map((r) => outcomeOf(r, facts));
  const roles = await ROLE_NAMES(db, [...new Set(results.map((r) => r.authorityRole).filter(Boolean))]);
  for (const r of results) r.authorityRoleName = r.authorityRole ? roles[r.authorityRole] || r.authorityRole : null;
  const declined = results.filter((r) => r.outcome === 'declined');
  const referred = results.filter((r) => r.outcome === 'referred');
  const ncbGiven = num(v.ncdPercent) > 0 || num(v.NCD) > 0;
  const factors = applicableFactors((await components(db, t.id, 'rating-factors')).map((r) => r.data), facts, { skip: ncbGiven ? ['ncbYears'] : [] });
  return {
    templateId: t.id, templateCode: t.template_code, templateName: t.name,
    decision: declined.length ? 'declined' : referred.length ? 'referred' : 'accepted',
    results, referredRules: referred.map((r) => r.ruleCode), declinedRules: declined.map((r) => r.ruleCode),
    loadingPercent: round2(results.filter((r) => r.outcome === 'loaded').reduce((s, r) => s + num(r.loadingPercent), 0)),
    factors, facts,
  };
}

/** Rating factors and loadings applied to a net premium: { net, ratingAdjustment, loadingAmount }. */
export function adjustNet(net, uw) {
  if (!uw || !(net > 0)) return { net, ratingAdjustment: 0, loadingAmount: 0 };
  let rated = net;
  for (const f of uw.factors) rated = f.type === 'Additive' ? rated + (net * f.factor) / 100 : rated * f.factor;
  rated = round2(rated);
  const loadingAmount = round2((rated * uw.loadingPercent) / 100);
  return { net: round2(rated + loadingAmount), ratingAdjustment: round2(rated - net), loadingAmount };
}

/** Refuse a declined risk with the rules' messages. */
export function assertNotDeclined(uw, what = 'This risk') {
  if (uw?.decision !== 'declined') return;
  const d = uw.results.filter((r) => r.outcome === 'declined');
  throw badRequest(`${what} is declined by the acceptance rules of ${uw.templateCode}: ${d.map((r) => `${r.ruleCode} (${r.message})`).join('; ')}`,
    d.map((r) => ({ path: 'underwriting', rule: r.ruleCode, message: `${r.ruleName}: ${r.message}` })));
}

/**
 * Referral state of a quotation after a (re)pricing: a referral already approved for the same (or more) rules stays
 * approved; otherwise a new pending referral is opened. null when nothing is referred.
 */
export function referralFor(uw, previous = null) {
  if (uw?.decision !== 'referred') return null;
  const rules = uw.referredRules;
  if (previous?.status === 'approved' && rules.every((r) => (previous.ruleCodes || []).includes(r))) return previous;
  const referred = uw.results.filter((r) => r.outcome === 'referred');
  const roles = [...new Set(referred.map((r) => r.authorityRole).filter(Boolean))];
  const roleNames = roles.map((code) => referred.find((r) => r.authorityRole === code)?.authorityRoleName || code);
  return { status: 'pending', ruleCodes: rules, authorityRoles: roles, authorityRoleNames: roleNames, requestedAt: new Date().toISOString(),
    reasons: uw.results.filter((r) => r.outcome === 'referred').map((r) => `${r.ruleCode}: ${r.message}`) };
}

/** Refuse a step while the quotation's referral is not approved. */
export function assertReferralCleared(q, step) {
  const doc = q.doc || {};
  const ref = doc.underwritingReferral;
  if (!ref || ref.status === 'approved') return;
  if (ref.status === 'declined') throw badRequest(`Quotation ${q.quote_number} was declined on referral${ref.remarks ? `: ${ref.remarks}` : ''}`);
  throw badRequest(`Quotation ${q.quote_number} is referred (${(ref.reasons || ref.ruleCodes || []).join('; ')}): ${step} needs the referral approved by ${(ref.authorityRoleNames || ref.authorityRoles || []).join(' / ') || 'an authorised approver'}`);
}

/** Whether a user may decide a referral: one of the rules' authority roles (or the System Administrator). */
export function assertMayDecide(user, ref) {
  const mine = [...(user.roles || []), user.role].filter(Boolean);
  if (mine.includes('system-admin')) return;
  if (!(ref.authorityRoles || []).some((r) => mine.includes(r))) {
    throw forbidden(`Only ${(ref.authorityRoleNames || ref.authorityRoles || []).join(' / ')} may decide this referral`);
  }
}

// ---------------------------------------------------------------- market

/**
 * The insurer market of a product (Product Configurator > Market Mapping): the insurer panel of its templates in force
 * plus the insurers with an active market mapping valid today. { restricted, insurerIds, insurers: [{ id, name }],
 * templateCodes }. restricted is false when no template names any insurer (every insurer may then be approached).
 */
export async function marketFor({ productId = null, lob = null } = {}, db = null) {
  const on = await today();
  const params = [on];
  let where;
  if (productId) { params.push(String(productId)); where = 't.product_id::text = $2::text'; } else if (lob) { params.push(String(lob).toUpperCase()); where = 'upper(t.line_of_business) = $2'; } else return { restricted: false, insurerIds: [], insurers: [], templateCodes: [] };
  const ts = await rows(db, `SELECT t.id, t.template_code, t.insurers FROM product_templates t WHERE ${where} AND t.status = 'Active'
    AND (t.effective_date IS NULL OR t.effective_date <= $1::date) AND (t.expiry_date IS NULL OR t.expiry_date >= $1::date)`, params);
  if (!ts.length) return { restricted: false, insurerIds: [], insurers: [], templateCodes: [] };
  const maps = await rows(db, `SELECT data FROM product_components WHERE kind = 'market-mappings' AND status = 'Active' AND template_id = ANY($1)
    AND (COALESCE(data->>'validFrom', '') = '' OR (data->>'validFrom')::date <= $2::date) AND (COALESCE(data->>'validTo', '') = '' OR (data->>'validTo')::date >= $2::date)`, [ts.map((t) => t.id), on]);
  const names = [...new Set([...ts.flatMap((t) => t.insurers || []), ...maps.map((m) => m.data.insurerName).filter(Boolean)])];
  if (!names.length) return { restricted: false, insurerIds: [], insurers: [], templateCodes: ts.map((t) => t.template_code) };
  const ins = await rows(db, `SELECT id, name FROM insurance_companies WHERE lower(name) = ANY($1) OR lower(code) = ANY($1) ORDER BY name`, [names.map((n) => n.toLowerCase())]);
  return { restricted: true, insurerIds: ins.map((i) => i.id), insurers: ins, templateCodes: ts.map((t) => t.template_code) };
}

/** Refuse insurers outside the product's market (setting product.market_panel_enforced). */
export async function assertOnMarket({ productId, lob }, insurerIds, db = null) {
  if (!insurerIds?.length || !(await getSetting('product.market_panel_enforced', true))) return;
  const m = await marketFor({ productId, lob }, db);
  if (!m.restricted) return;
  const outside = insurerIds.filter((id) => !m.insurerIds.includes(Number(id)));
  if (!outside.length) return;
  const names = (await rows(db, 'SELECT name FROM insurance_companies WHERE id = ANY($1)', [outside])).map((r) => r.name);
  throw badRequest(`${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} not on the insurer market of this product (Product Configurator > Market Mapping, ${m.templateCodes.join(', ')}): ${m.insurers.map((i) => i.name).join(', ')}`,
    [{ path: 'insurers', message: `Not on the product's insurer market: ${names.join(', ')}` }]);
}
