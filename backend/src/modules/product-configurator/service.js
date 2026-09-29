/**
 * Product configurator: product templates (product_templates), their configuration components
 * (product_components) and risk mappings (product_risk_mappings / product_risk_sections).
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { isoDate, lastMonths, params, round2, toNumber } from '../masters/helpers.js';
import { nextDocumentNumber } from '../../lib/numbering.js';

// ---------------- templates ----------------

const COUNT_SQL = `(SELECT json_build_object(
    'coverages', count(*) FILTER (WHERE c.kind = 'coverages'),
    'ratingFactors', count(*) FILTER (WHERE c.kind = 'rating-factors'),
    'underwritingRules', count(*) FILTER (WHERE c.kind = 'underwriting-rules'))
  FROM product_components c WHERE c.template_id = t.id AND c.status <> 'Deleted') AS counts`;

export const templateOut = (r) => ({
  id: r.id, templateCode: r.template_code, name: r.name, category: r.category, lineOfBusiness: r.line_of_business,
  description: r.description, status: r.status, version: r.version_label || `v${r.version}`, versionNumber: r.version,
  effectiveDate: r.effective_date, expiryDate: r.expiry_date, baseRate: r.base_rate, minPremium: r.min_premium, maxPremium: r.max_premium,
  commissionRate: r.commission_rate, configuration: r.config || {}, features: r.features || {}, insurers: r.insurers || [], tags: r.tags || [],
  productId: r.product_id, parentId: r.parent_id, retiredAt: r.retired_at, retiredReason: r.retired_reason,
  createdBy: r.created_by, createdAt: r.created_at, updatedBy: r.updated_by, updatedAt: r.updated_at,
  _count: r.counts || { coverages: 0, ratingFactors: 0, underwritingRules: 0 },
});

export async function listTemplates(qs, pg) {
  const p = params();
  const conds = ['TRUE'];
  if (qs.search) conds.push(`(t.name ILIKE ${p.add(`%${qs.search}%`)} OR t.template_code ILIKE $${p.values.length} OR t.description ILIKE $${p.values.length})`);
  if (qs.status) conds.push(`lower(t.status) = lower(${p.add(qs.status)})`);
  if (qs.category) conds.push(`lower(t.category) = lower(${p.add(qs.category)})`);
  if (qs.lineOfBusiness) conds.push(`t.line_of_business ILIKE ${p.add(qs.lineOfBusiness)}`);
  if (String(qs.latestOnly || 'false') === 'true') conds.push('NOT EXISTS (SELECT 1 FROM product_templates n WHERE n.parent_id = t.id)');
  const where = conds.join(' AND ');
  const total = (await one(`SELECT count(*)::int AS n FROM product_templates t WHERE ${where}`, p.values)).n;
  const rows = await many(`SELECT t.*, ${COUNT_SQL} FROM product_templates t WHERE ${where} ORDER BY t.updated_at DESC, t.id DESC
                           LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  return { total, rows: rows.map(templateOut) };
}

export async function getTemplateRow({ id, templateCode }) {
  let r = null;
  if (id !== undefined && id !== null && /^\d+$/.test(String(id))) r = await one(`SELECT t.*, ${COUNT_SQL} FROM product_templates t WHERE t.id = $1`, [Number(id)]);
  else if (templateCode) {
    r = await one(`SELECT t.*, ${COUNT_SQL} FROM product_templates t WHERE lower(t.template_code) = lower($1)
                   ORDER BY (t.status = 'Active') DESC, t.version DESC LIMIT 1`, [String(templateCode)]);
  }
  if (!r) throw notFound('Product template not found');
  return r;
}

/** Template with every configuration component, as the quote screens and the configurator read it. */
export async function getConfigurator(ref) {
  const t = templateOut(await getTemplateRow(ref));
  const comps = await many('SELECT * FROM product_components WHERE template_id = $1 AND status <> \'Deleted\' ORDER BY kind, sort_order, id', [t.id]);
  const group = (kind) => comps.filter((c) => c.kind === kind).map((c) => componentOut(c, t));
  return {
    ...t,
    coverages: group('coverages'), ratingFactors: group('rating-factors'), underwritingRules: group('underwriting-rules'),
    documents: group('documents'), commissionStructures: group('commissions'), taxes: group('taxes'), acceptanceLimits: group('acceptance-limits'),
    ratingParameters: group('rating-parameters'), marketMappings: group('market-mappings'), workflows: group('workflows'),
  };
}

const TEMPLATE_FIELDS = {
  templateCode: 'template_code', name: 'name', category: 'category', lineOfBusiness: 'line_of_business', description: 'description',
  status: 'status', effectiveDate: 'effective_date', expiryDate: 'expiry_date', baseRate: 'base_rate', minPremium: 'min_premium',
  maxPremium: 'max_premium', commissionRate: 'commission_rate', configuration: 'config', features: 'features', insurers: 'insurers',
  tags: 'tags', productId: 'product_id', version: 'version_label',
};
const JSON_COLS = new Set(['config', 'features', 'insurers', 'tags']);
const NUM_COLS = new Set(['base_rate', 'min_premium', 'max_premium', 'commission_rate']);

/**
 * Motor tariff checks (vehicle classes, CTPL 1-year / 3-year amounts, Auto Passenger PA): amounts are non-negative
 * numbers, seats whole numbers, class codes unique. A blank 3-year amount means the class has no 3-year CTPL.
 */
function motorTariffErrors(cfg) {
  const errors = [];
  const amount = (v) => v === undefined || v === null || v === '' || (Number.isFinite(Number(String(v).replace(/,/g, ''))) && Number(String(v).replace(/,/g, '')) >= 0);
  if (cfg.vehicleClasses !== undefined) {
    if (!Array.isArray(cfg.vehicleClasses)) errors.push({ path: 'configuration.vehicleClasses', message: 'vehicleClasses must be a list' });
    else {
      const codes = new Set();
      cfg.vehicleClasses.forEach((c, i) => {
        if (!c?.code || !/^[a-z0-9_]+$/.test(c.code)) errors.push({ path: `configuration.vehicleClasses.${i}.code`, message: 'Class code is required (lower-case letters, digits, _)' });
        else if (codes.has(c.code)) errors.push({ path: `configuration.vehicleClasses.${i}.code`, message: `Class code ${c.code} is used twice` });
        codes.add(c?.code);
        if (!String(c?.label || '').trim()) errors.push({ path: `configuration.vehicleClasses.${i}.label`, message: 'Class name is required' });
        if (c?.seats !== undefined && c.seats !== '' && !(Number.isInteger(Number(c.seats)) && Number(c.seats) > 0)) errors.push({ path: `configuration.vehicleClasses.${i}.seats`, message: 'Seats must be a whole number above 0' });
      });
    }
  }
  for (const key of ['ctplSetting', 'ctplSetting3Year']) {
    for (const [code, v] of Object.entries(cfg[key] || {})) if (!amount(v)) errors.push({ path: `configuration.${key}.${code}`, message: 'CTPL amount must be a number of 0 or more' });
  }
  if (cfg.appaSetting !== undefined) {
    const a = cfg.appaSetting || {};
    if (!amount(a.ratePercent)) errors.push({ path: 'configuration.appaSetting.ratePercent', message: 'Auto Passenger PA rate must be a number of 0 or more' });
    if (a.limits !== undefined && !(Array.isArray(a.limits) && a.limits.every((x) => amount(x) && Number(x) > 0))) errors.push({ path: 'configuration.appaSetting.limits', message: 'Auto Passenger PA limits must be amounts above 0' });
  }
  return errors;
}

async function templateValues(body, partial) {
  const errors = [];
  const required = ['templateCode', 'name', 'category', 'lineOfBusiness', 'effectiveDate', 'status'];
  if (!partial) for (const f of required) if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') errors.push({ path: f, message: `${f} is required` });
  const statuses = (await getSetting('product.template_statuses', ['Draft', 'Active', 'Inactive', 'Retired'])) || [];
  if (body.status !== undefined && !statuses.includes(body.status)) errors.push({ path: 'status', message: `status must be one of ${statuses.join(', ')}` });
  const vals = {};
  for (const [field, col] of Object.entries(TEMPLATE_FIELDS)) {
    if (body[field] === undefined) continue;
    let v = body[field];
    if (col === 'effective_date' || col === 'expiry_date') {
      v = isoDate(v);
      if (body[field] && !v) errors.push({ path: field, message: `${field} must be a date` });
    } else if (NUM_COLS.has(col)) v = v === null || v === '' ? null : toNumber(v, NaN);
    else if (col === 'product_id') v = v === null || v === '' ? null : Number(v);
    else if (col === 'version_label') v = v == null ? null : String(v);
    if (NUM_COLS.has(col) && Number.isNaN(v)) errors.push({ path: field, message: `${field} must be a number` });
    vals[col] = JSON_COLS.has(col) ? JSON.stringify(v ?? (col === 'insurers' || col === 'tags' ? [] : {})) : v;
  }
  if (vals.effective_date && vals.expiry_date && vals.expiry_date < vals.effective_date) errors.push({ path: 'expiryDate', message: 'Expiry date must be after the effective date' });
  if (body.configuration && typeof body.configuration === 'object') errors.push(...motorTariffErrors(body.configuration));
  if (errors.length) throw badRequest('Validation failed', errors);
  return vals;
}

export async function createTemplate(body, user) {
  const b = { ...body };
  if (!b.templateCode) b.templateCode = await nextDocumentNumber('product_template');
  const vals = await templateValues(b, false);
  if (await one('SELECT 1 FROM product_templates WHERE lower(template_code) = lower($1)', [vals.template_code])) throw conflict(`Template code ${vals.template_code} already exists`);
  const cols = Object.keys(vals);
  const p = params();
  const r = await one(`INSERT INTO product_templates(${[...cols, 'created_by', 'updated_by'].join(', ')})
                       VALUES (${[...cols.map((c) => p.add(vals[c])), p.add(user.username), p.add(user.username)].join(', ')}) RETURNING id`, p.values);
  return templateOut(await getTemplateRow({ id: r.id }));
}

export async function updateTemplate(id, body, user) {
  const before = templateOut(await getTemplateRow({ id }));
  const vals = await templateValues(body, true);
  if (vals.template_code && vals.template_code.toLowerCase() !== String(before.templateCode || '').toLowerCase()
    && await one('SELECT 1 FROM product_templates WHERE lower(template_code) = lower($1) AND id <> $2', [vals.template_code, Number(id)])) {
    throw conflict(`Template code ${vals.template_code} already exists`);
  }
  const p = params([Number(id)]);
  const sets = Object.keys(vals).map((c) => `${c} = ${p.add(vals[c])}`);
  sets.push(`updated_by = ${p.add(user.username)}`, 'updated_at = now()');
  await query(`UPDATE product_templates SET ${sets.join(', ')} WHERE id = $1`, p.values);
  return { before, after: templateOut(await getTemplateRow({ id })) };
}

export async function setTemplateLifecycle(id, action, reason, user) {
  const before = templateOut(await getTemplateRow({ id }));
  if (action === 'retire') {
    if (before.status === 'Retired') throw badRequest('Template is already retired');
    await query('UPDATE product_templates SET status = \'Retired\', retired_at = now(), retired_reason = $2, updated_by = $3, updated_at = now() WHERE id = $1', [Number(id), reason || null, user.username]);
  } else {
    if (before.status === 'Active') throw badRequest('Template is already active');
    if (before.expiryDate && before.expiryDate < (await today())) throw badRequest('Template has expired; extend the expiry date before reactivating');
    await query('UPDATE product_templates SET status = \'Active\', retired_at = NULL, retired_reason = NULL, updated_by = $2, updated_at = now() WHERE id = $1', [Number(id), user.username]);
  }
  return { before, after: templateOut(await getTemplateRow({ id })) };
}

/** Clone a template (and its components) as the next draft version. */
export async function newVersion(id, body, user) {
  const src = await getTemplateRow({ id });
  const newId = await withTransaction(async (c) => {
    const maxV = (await c.query('SELECT max(version)::int AS v FROM product_templates WHERE lower(template_code) = lower($1)', [src.template_code])).rows[0].v || src.version;
    const r = await c.query(`INSERT INTO product_templates(name, product_id, version, config, status, template_code, category, line_of_business, description, version_label,
        effective_date, expiry_date, base_rate, min_premium, max_premium, commission_rate, features, insurers, tags, parent_id, created_by, updated_by)
      SELECT name, product_id, $2, config, 'Draft', template_code, category, line_of_business, description, $3, COALESCE($4::date, effective_date), expiry_date,
        base_rate, min_premium, max_premium, commission_rate, features, insurers, tags, id, $5, $5 FROM product_templates WHERE id = $1 RETURNING id`,
    [src.id, maxV + 1, body.version || `v${maxV + 1}`, isoDate(body.effectiveDate), user.username]);
    await c.query(`INSERT INTO product_components(template_id, kind, code, name, data, status, sort_order, created_by, updated_by)
                   SELECT $2, kind, code, name, data, status, sort_order, $3, $3 FROM product_components WHERE template_id = $1 AND status <> 'Deleted'`, [src.id, r.rows[0].id, user.username]);
    return r.rows[0].id;
  });
  return templateOut(await getTemplateRow({ id: newId }));
}

export async function listVersions(id) {
  const t = await getTemplateRow({ id });
  const rows = await many(`SELECT t.*, ${COUNT_SQL} FROM product_templates t WHERE lower(t.template_code) = lower($1) ORDER BY t.version DESC`, [t.template_code]);
  return rows.map((r) => ({ ...templateOut(r), isCurrent: r.status === 'Active' }));
}

/** Insurer panel: the template's insurers with their market-mapping terms. */
export async function insurerPanel(id) {
  const t = templateOut(await getTemplateRow({ id }));
  const maps = await many('SELECT * FROM product_components WHERE template_id = $1 AND kind = \'market-mappings\' AND status <> \'Deleted\'', [t.id]);
  const names = new Set([...t.insurers, ...maps.map((m) => m.data.insurerName).filter(Boolean)]);
  const out = [];
  for (const name of names) {
    const ins = await one('SELECT id, code, name, short_name, commission_rate FROM insurance_companies WHERE lower(name) = lower($1) OR lower(code) = lower($1) OR lower(short_name) = lower($1)', [name]);
    const m = maps.find((x) => String(x.data.insurerName).toLowerCase() === String(name).toLowerCase());
    out.push({ insurerName: ins?.name || name, insurerId: ins?.id ?? null, insurerCode: ins?.code ?? null, onPanel: t.insurers.includes(name),
      defaultCommissionRate: ins?.commission_rate == null ? null : round2(ins.commission_rate * 100), mapping: m ? componentOut(m, t) : null });
  }
  return out;
}

export async function setInsurerPanel(id, insurers, user) {
  if (!Array.isArray(insurers)) throw badRequest('insurers must be an array of insurer names or codes');
  const names = [];
  for (const v of insurers) {
    const key = typeof v === 'object' && v ? (v.insurerName || v.name || v.code) : v;
    const ins = await one('SELECT name FROM insurance_companies WHERE (lower(name) = lower($1) OR lower(code) = lower($1)) AND status = \'active\'', [String(key)]);
    if (!ins) throw badRequest('Validation failed', [{ path: 'insurers', message: `Insurer ${key} is not an active insurance company` }]);
    if (!names.includes(ins.name)) names.push(ins.name);
  }
  return updateTemplate(id, { insurers: names }, user);
}

/** Premium illustration: base rate x sum insured, rating factors, minimum premium, statutory taxes, commission. */
export async function calculatePremium(id, body) {
  const t = await getConfigurator({ id });
  const sumInsured = toNumber(body.sumInsured, NaN);
  if (!Number.isFinite(sumInsured) || sumInsured <= 0) throw badRequest('sumInsured must be a positive number');
  const rate = toNumber(body.baseRate ?? t.baseRate, NaN);
  if (!Number.isFinite(rate)) throw badRequest('The template has no base rate');
  const basePremium = round2(sumInsured * (rate / 100));
  let premium = basePremium;
  const applied = [];
  for (const [k, v] of Object.entries(body.factors || {})) {
    const n = toNumber(v, NaN);
    if (!Number.isFinite(n)) throw badRequest(`Factor ${k} must be a number`);
    premium *= n;
    applied.push({ factor: k, value: n });
  }
  premium = round2(premium);
  const min = t.minPremium == null ? null : Number(t.minPremium);
  const max = t.maxPremium == null ? null : Number(t.maxPremium);
  let adjusted = premium;
  if (min !== null && adjusted < min) adjusted = min;
  if (max !== null && adjusted > max) adjusted = max;
  let taxes = t.taxes.filter((x) => x.status === 'Active').map((x) => ({ code: x.taxCode, name: x.taxName, rate: toNumber(x.rate), basis: x.basis || 'Premium' }));
  if (!taxes.length) {
    const keys = [['DST', 'Documentary stamp tax', 'tax.dst_rate'], ['LGT', 'Local government tax', 'tax.lgt_rate']];
    taxes = [];
    for (const [code, name, key] of keys) taxes.push({ code, name, rate: toNumber(await getSetting(key, 0)) * 100, basis: 'Premium' });
  }
  const taxLines = taxes.map((x) => ({ ...x, amount: round2(x.basis === 'Sum Insured' ? sumInsured * x.rate / 100 : adjusted * x.rate / 100) }));
  const totalTax = round2(taxLines.reduce((s, x) => s + x.amount, 0));
  const commRate = toNumber(t.commissionRate ?? (toNumber(await getSetting('commission.default_rate', 0.15)) * 100));
  const commission = round2(adjusted * commRate / 100);
  return {
    templateId: t.id, templateCode: t.templateCode, sumInsured, baseRate: rate, basePremium, factors: applied, ratedPremium: premium,
    minimumApplied: min !== null && premium < min, maximumApplied: max !== null && premium > max, adjustedPremium: round2(adjusted),
    taxes: taxLines, totalTax, grossPremium: round2(adjusted + totalTax), commissionRate: commRate, commission, netPremium: round2(adjusted - commission),
    currency: await getSetting('currency.default', 'PHP'),
  };
}

// ---------------- components ----------------

/** URL segment -> code / name fields as the configurator screens name them, plus required and numeric fields. */
export const KINDS = {
  coverages: { code: 'coverageCode', name: 'coverageName', required: ['coverageCode', 'coverageName', 'type'], numbers: ['deductible', 'waitingPeriod'], label: 'Coverage' },
  'rating-factors': { code: 'factorCode', name: 'factorName', required: ['factorCode', 'factorName', 'type'], numbers: [], label: 'Rating factor' },
  'underwriting-rules': { code: 'ruleCode', name: 'ruleName', required: ['ruleCode', 'ruleName', 'type', 'condition', 'action'], numbers: [], label: 'Underwriting rule' },
  documents: { code: 'documentCode', name: 'documentName', required: ['documentCode', 'documentName', 'type'], numbers: [], label: 'Document template' },
  workflows: { code: 'workflowCode', name: 'workflowName', required: ['workflowCode', 'workflowName', 'type'], numbers: [], label: 'Approval workflow', global: true },
  'market-mappings': { code: 'productCode', name: 'insurerName', required: ['insurerName', 'productCode'], numbers: ['commissionRate', 'overrideRate', 'profitShare', 'targetPremium', 'ytdPremium'], label: 'Market mapping' },
  commissions: { code: 'structureCode', name: 'structureName', required: ['structureName', 'type'], numbers: [], label: 'Commission structure' },
  taxes: { code: 'taxCode', name: 'taxName', required: ['taxCode', 'taxName', 'rate'], numbers: ['rate'], label: 'Statutory tax' },
  'acceptance-limits': { code: 'limitCode', name: 'limitName', required: ['limitCode', 'limitName'], numbers: ['minSumInsured', 'maxSumInsured', 'maxVehicleAge', 'minAge', 'maxAge', 'authorityLimit'], label: 'Acceptance limit' },
  'rating-parameters': { code: 'parameterCode', name: 'parameterName', required: ['parameterCode', 'parameterName'], numbers: [], label: 'Rating parameter' },
};

export function componentOut(c, t) {
  return { id: c.id, productId: c.template_id, templateCode: t?.templateCode ?? c.template_code ?? null, ...c.data, status: c.status, createdBy: c.created_by, createdAt: c.created_at, updatedAt: c.updated_at };
}

function componentValues(kind, body, partial) {
  const def = KINDS[kind];
  const errors = [];
  const data = {};
  for (const [k, v] of Object.entries(body)) {
    if (['id', 'productId', 'templateId', 'templateCode', 'status', 'createdAt', 'updatedAt', 'createdBy'].includes(k)) continue;
    data[k] = v;
  }
  if (!partial) for (const f of def.required) if (data[f] === undefined || data[f] === null || String(data[f]).trim() === '') errors.push({ path: f, message: `${f} is required` });
  for (const f of def.numbers) {
    if (data[f] === undefined || data[f] === null || data[f] === '') continue;
    const n = toNumber(data[f], NaN);
    if (!Number.isFinite(n)) errors.push({ path: f, message: `${f} must be a number` });
    else data[f] = n;
  }
  if (body.status !== undefined && !['Active', 'Inactive', 'Draft'].includes(body.status)) errors.push({ path: 'status', message: 'status must be Active, Inactive or Draft' });
  if (errors.length) throw badRequest('Validation failed', errors);
  return data;
}

async function resolveTemplateId(body, def) {
  const ref = body.productId ?? body.templateId;
  if ((ref === undefined || ref === null || ref === '') && !body.templateCode) {
    if (def.global) return null;
    throw badRequest('Validation failed', [{ path: 'productId', message: 'productId (template id) or templateCode is required' }]);
  }
  return (await getTemplateRow({ id: ref, templateCode: body.templateCode })).id;
}

export async function listComponents(kind, qs, pg) {
  const p = params([kind]);
  const conds = ['c.kind = $1', 'c.status <> \'Deleted\''];
  const tid = qs.productId ?? qs.templateId;
  if (tid) conds.push(`(c.template_id = ${p.add(Number(tid))}${KINDS[kind].global ? ' OR c.template_id IS NULL' : ''})`);
  if (qs.templateCode) conds.push(`t.template_code = ${p.add(qs.templateCode)}`);
  if (qs.status) conds.push(`c.status = ${p.add(qs.status)}`);
  if (qs.search) conds.push(`c.data::text ILIKE ${p.add(`%${qs.search}%`)}`);
  const where = conds.join(' AND ');
  const base = 'FROM product_components c LEFT JOIN product_templates t ON t.id = c.template_id';
  const total = (await one(`SELECT count(*)::int AS n ${base} WHERE ${where}`, p.values)).n;
  const rows = await many(`SELECT c.*, t.template_code ${base} WHERE ${where} ORDER BY c.template_id NULLS FIRST, c.sort_order, c.id LIMIT ${p.add(pg.limit)} OFFSET ${p.add(pg.offset)}`, p.values);
  return { total, rows: rows.map((r) => componentOut(r)) };
}

export async function getComponent(kind, id) {
  if (!/^\d+$/.test(String(id))) throw notFound(`${KINDS[kind].label} not found`);
  const r = await one('SELECT c.*, t.template_code FROM product_components c LEFT JOIN product_templates t ON t.id = c.template_id WHERE c.id = $1 AND c.kind = $2 AND c.status <> \'Deleted\'', [Number(id), kind]);
  if (!r) throw notFound(`${KINDS[kind].label} not found`);
  return componentOut(r);
}

const dupGuard = (def) => (e) => {
  if (e.code === '23505') throw conflict(`${def.label} code already exists for this product`);
  throw e;
};

export async function createComponent(kind, body, user) {
  const def = KINDS[kind];
  const data = componentValues(kind, body, false);
  const templateId = await resolveTemplateId(body, def);
  const r = await one(`INSERT INTO product_components(template_id, kind, code, name, data, status, sort_order, created_by, updated_by)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
  [templateId, kind, data[def.code] ?? null, data[def.name] ?? null, JSON.stringify(data), body.status || 'Active', Number(body.sortOrder) || 100, user.username]).catch(dupGuard(def));
  return getComponent(kind, r.id);
}

export async function updateComponent(kind, id, body, user) {
  const def = KINDS[kind];
  const before = await getComponent(kind, id);
  const data = componentValues(kind, body, true);
  const row = await one('SELECT data FROM product_components WHERE id = $1', [Number(id)]);
  const merged = { ...row.data, ...data };
  for (const f of def.required) if (merged[f] === undefined || merged[f] === null || String(merged[f]).trim() === '') throw badRequest('Validation failed', [{ path: f, message: `${f} is required` }]);
  await query(`UPDATE product_components SET data = $2, code = $3, name = $4, status = COALESCE($5, status), updated_by = $6, updated_at = now() WHERE id = $1`,
    [Number(id), JSON.stringify(merged), merged[def.code] ?? null, merged[def.name] ?? null, body.status || null, user.username]).catch(dupGuard(def));
  return { before, after: await getComponent(kind, id) };
}

export async function deleteComponent(kind, id, user) {
  const before = await getComponent(kind, id);
  await query('UPDATE product_components SET status = \'Deleted\', updated_by = $2, updated_at = now() WHERE id = $1', [Number(id), user.username]);
  return before;
}

// ---------------- analytics / dashboard ----------------

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Other');

export async function analytics() {
  const top = await many(`
    WITH p AS (SELECT pr.id AS product_id, pr.name, pr.line, pol.premium_total, pol.inception_date, pol.commission_amount, pol.id AS pol_id
               FROM policies pol JOIN products pr ON pr.id = pol.product_id WHERE pol.status <> 'cancelled'),
         c AS (SELECT pol.product_id, sum(COALESCE(cl.settled_amount, cl.approved_amount, cl.estimate_amount)) AS incurred
               FROM claims cl JOIN policies pol ON pol.id = cl.policy_id WHERE cl.status <> 'rejected' GROUP BY pol.product_id)
    SELECT p.product_id, p.name, p.line, count(*)::int AS policies, COALESCE(sum(p.premium_total), 0) AS premium, COALESCE(sum(p.commission_amount), 0) AS commission,
           COALESCE(max(c.incurred), 0) AS incurred,
           COALESCE(sum(p.premium_total) FILTER (WHERE p.inception_date > current_date - 365), 0) AS last12,
           COALESCE(sum(p.premium_total) FILTER (WHERE p.inception_date <= current_date - 365 AND p.inception_date > current_date - 730), 0) AS prev12
    FROM p LEFT JOIN c ON c.product_id = p.product_id GROUP BY p.product_id, p.name, p.line ORDER BY premium DESC`);
  const topProducts = top.map((r) => ({
    productId: r.product_id, productName: r.name, totalPolicies: r.policies, totalPremium: round2(r.premium), avgPremium: r.policies ? round2(r.premium / r.policies) : 0,
    lossRatio: r.premium ? round2((r.incurred / r.premium) * 100) : 0, profitMargin: r.premium ? round2(((r.premium - r.incurred - r.commission) / r.premium) * 100) : 0,
    growth: r.prev12 ? round2(((r.last12 - r.prev12) / r.prev12) * 100) : 0,
  }));
  const months = lastMonths(Number(await getSetting('product.analytics_months', 6)) || 6);
  const trendRows = await many(`SELECT to_char(pol.inception_date, 'YYYY-MM') AS m, count(*)::int AS policies, COALESCE(sum(pol.premium_total), 0) AS premium
                                FROM policies pol WHERE pol.inception_date >= $1::date AND pol.status <> 'cancelled' GROUP BY 1`, [`${months[0].key}-01`]);
  const claimRows = await many(`SELECT to_char(cl.loss_date, 'YYYY-MM') AS m, COALESCE(sum(COALESCE(cl.settled_amount, cl.approved_amount, cl.estimate_amount)), 0) AS incurred
                                FROM claims cl WHERE cl.loss_date >= $1::date AND cl.status <> 'rejected' GROUP BY 1`, [`${months[0].key}-01`]);
  const performanceTrend = months.map(({ key, label }) => {
    const t = trendRows.find((x) => x.m === key) || { policies: 0, premium: 0 };
    const c = claimRows.find((x) => x.m === key) || { incurred: 0 };
    return { month: label, period: key, premium: round2(t.premium), policies: t.policies, lossRatio: t.premium ? round2((c.incurred / t.premium) * 100) : 0 };
  });
  const totalPremium = topProducts.reduce((s, x) => s + x.totalPremium, 0);
  const categoryBreakdown = {};
  for (const r of top) {
    const k = cap(r.line);
    const cur = categoryBreakdown[k] || { percentage: 0, premium: 0, count: 0 };
    cur.premium = round2(cur.premium + Number(r.premium));
    cur.count += r.policies;
    categoryBreakdown[k] = cur;
  }
  for (const v of Object.values(categoryBreakdown)) v.percentage = totalPremium ? round2((v.premium / totalPremium) * 100) : 0;
  return { topProducts, performanceTrend, categoryBreakdown, totals: { premium: round2(totalPremium), policies: topProducts.reduce((s, x) => s + x.totalPolicies, 0) } };
}

export async function dashboard() {
  const byStatus = await many('SELECT status, count(*)::int AS n FROM product_templates GROUP BY status');
  const byCategory = await many('SELECT COALESCE(category, \'Other\') AS category, count(*)::int AS n FROM product_templates WHERE status <> \'Retired\' GROUP BY 1 ORDER BY 2 DESC');
  const comps = await many('SELECT kind, count(*)::int AS n FROM product_components WHERE status = \'Active\' GROUP BY kind');
  const recent = await many(`SELECT t.*, ${COUNT_SQL} FROM product_templates t ORDER BY t.updated_at DESC LIMIT 5`);
  const expiring = await many(`SELECT t.*, ${COUNT_SQL} FROM product_templates t WHERE t.status = 'Active' AND t.expiry_date BETWEEN current_date AND current_date + $1::int ORDER BY t.expiry_date`, [Number(await getSetting('product.expiry_warning_days', 60)) || 0]);
  const count = (s) => byStatus.find((x) => x.status === s)?.n || 0;
  const a = await analytics();
  return {
    summary: {
      totalTemplates: byStatus.reduce((s, x) => s + x.n, 0), active: count('Active'), draft: count('Draft'), inactive: count('Inactive'), retired: count('Retired'),
      components: Object.fromEntries(comps.map((c) => [c.kind, c.n])),
    },
    byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c.n])),
    recentTemplates: recent.map(templateOut), expiringSoon: expiring.map(templateOut), analytics: a,
  };
}

// ---------------- risk mappings ----------------

const sectionOut = (s) => ({
  id: s.id, sectionCode: s.section_code, sectionLabel: s.section_label, remarks: s.remarks, defaultRatePercent: s.default_rate_percent,
  sortOrder: s.sort_order, isActive: s.is_active, createdBy: s.created_by, createdAt: s.created_at, updatedBy: s.updated_by, updatedAt: s.updated_at,
});
const mappingOut = (m, sections) => ({
  id: m.id, productCode: m.product_code, lobCode: m.lob_code, productName: m.product_name, lineOfBusiness: m.line_of_business,
  definitionType: m.definition_type, definitionLabel: m.definition_label, status: m.status, configuration: m.configuration || {},
  createdBy: m.created_by, createdAt: m.created_at, updatedBy: m.updated_by, updatedAt: m.updated_at,
  sectionCount: sections.filter((s) => s.is_active).length, sections: sections.map(sectionOut),
});

export async function listRiskMappings(qs) {
  const p = params();
  const conds = ['TRUE'];
  if (qs.search) conds.push(`(m.product_name ILIKE ${p.add(`%${qs.search}%`)} OR m.product_code ILIKE $${p.values.length} OR m.lob_code ILIKE $${p.values.length} OR m.line_of_business ILIKE $${p.values.length})`);
  if (qs.status) conds.push(`m.status = ${p.add(qs.status)}`);
  if (qs.definitionType) conds.push(`m.definition_type = ${p.add(qs.definitionType)}`);
  const rows = await many(`SELECT m.* FROM product_risk_mappings m WHERE ${conds.join(' AND ')} ORDER BY m.product_name`, p.values);
  const secs = await many('SELECT * FROM product_risk_sections WHERE mapping_id = ANY($1) AND is_active ORDER BY sort_order, section_code', [rows.map((r) => r.id)]);
  return rows.map((m) => mappingOut(m, secs.filter((s) => s.mapping_id === m.id)));
}

export async function getRiskMapping(id, includeInactive = false) {
  const m = await one('SELECT * FROM product_risk_mappings WHERE id = $1', [id]);
  if (!m) throw notFound('Risk mapping not found');
  const secs = await many(`SELECT * FROM product_risk_sections WHERE mapping_id = $1 ${includeInactive ? '' : 'AND is_active'} ORDER BY sort_order, section_code`, [id]);
  return mappingOut(m, secs);
}

const MAPPING_STATUSES = ['Active', 'Inactive', 'Draft'];

export async function createRiskMapping(b, user) {
  const errors = ['productCode', 'lobCode', 'productName', 'definitionType'].filter((f) => !b[f]).map((f) => ({ path: f, message: `${f} is required` }));
  if (b.status && !MAPPING_STATUSES.includes(b.status)) errors.push({ path: 'status', message: `status must be one of ${MAPPING_STATUSES.join(', ')}` });
  if (errors.length) throw badRequest('Validation failed', errors);
  if (await one('SELECT 1 FROM product_risk_mappings WHERE lower(product_code) = lower($1)', [b.productCode])) throw conflict(`Product code ${b.productCode} already has a risk mapping`);
  const r = await one(`INSERT INTO product_risk_mappings(product_code, lob_code, product_name, line_of_business, definition_type, definition_label, status, configuration, created_by, updated_by)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`,
  [b.productCode, b.lobCode, b.productName, b.lineOfBusiness || null, b.definitionType, b.definitionLabel || null, b.status || 'Draft', JSON.stringify(b.configuration || { type: b.lobCode }), user.username]);
  return getRiskMapping(r.id);
}

export async function updateRiskMapping(id, b, user) {
  const before = await getRiskMapping(id, true);
  if (b.status && !MAPPING_STATUSES.includes(b.status)) throw badRequest('Validation failed', [{ path: 'status', message: `status must be one of ${MAPPING_STATUSES.join(', ')}` }]);
  if (b.configuration !== undefined && (typeof b.configuration !== 'object' || b.configuration === null || Array.isArray(b.configuration))) throw badRequest('Validation failed', [{ path: 'configuration', message: 'configuration must be an object' }]);
  const cfg = b.configuration ? { ...b.configuration, type: b.configuration.type || before.lobCode } : null;
  await query(`UPDATE product_risk_mappings SET product_name = COALESCE($2, product_name), line_of_business = COALESCE($3, line_of_business),
                 definition_type = COALESCE($4, definition_type), definition_label = COALESCE($5, definition_label), status = COALESCE($6, status),
                 configuration = COALESCE($7, configuration), updated_by = $8, updated_at = now() WHERE id = $1`,
  [id, b.productName || null, b.lineOfBusiness || null, b.definitionType || null, b.definitionLabel || null, b.status || null, cfg ? JSON.stringify(cfg) : null, user.username]);
  return { before, after: await getRiskMapping(id) };
}

/** Sections that can still be added: the risk-section master minus the mapping's active sections. */
export async function sectionOptions(id) {
  await getRiskMapping(id);
  return many(`SELECT r.data->>'sectionCode' AS "sectionCode", r.data->>'sectionLabel' AS "sectionLabel", (r.data->>'defaultRatePercent')::numeric AS "defaultRatePercent"
               FROM master_records r WHERE r.type_code = 'risk-section' AND r.status = 'active'
                 AND NOT EXISTS (SELECT 1 FROM product_risk_sections s WHERE s.mapping_id = $1 AND s.section_code = r.data->>'sectionCode' AND s.is_active)
               ORDER BY COALESCE((r.data->>'sortOrder')::int, 100), r.data->>'sectionLabel'`, [id]);
}

export async function addSection(id, b, user) {
  await getRiskMapping(id);
  if (!b.sectionCode) throw badRequest('Validation failed', [{ path: 'sectionCode', message: 'sectionCode is required' }]);
  const master = await one('SELECT data FROM master_records WHERE type_code = \'risk-section\' AND status = \'active\' AND lower(code) = lower($1)', [b.sectionCode]);
  if (!master) throw badRequest('Validation failed', [{ path: 'sectionCode', message: `Section ${b.sectionCode} is not in the risk-section master` }]);
  const existing = await one('SELECT * FROM product_risk_sections WHERE mapping_id = $1 AND section_code = $2', [id, master.data.sectionCode]);
  if (existing?.is_active) throw conflict(`Section ${master.data.sectionCode} is already mapped`);
  const rate = b.defaultRatePercent === undefined || b.defaultRatePercent === null ? toNumber(master.data.defaultRatePercent, null) : toNumber(b.defaultRatePercent, NaN);
  if (Number.isNaN(rate) || (rate !== null && (rate < 0 || rate > 100))) throw badRequest('Validation failed', [{ path: 'defaultRatePercent', message: 'defaultRatePercent must be between 0 and 100' }]);
  if (existing) {
    await query(`UPDATE product_risk_sections SET is_active = true, remarks = $2, default_rate_percent = $3, updated_by = $4, updated_at = now() WHERE id = $1`, [existing.id, b.remarks || null, rate, user.username]);
  } else {
    await query(`INSERT INTO product_risk_sections(mapping_id, section_code, section_label, remarks, default_rate_percent, sort_order, created_by, updated_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`, [id, master.data.sectionCode, master.data.sectionLabel, b.remarks || null, rate, toNumber(master.data.sortOrder, 100), user.username]);
  }
  await query('UPDATE product_risk_mappings SET updated_by = $2, updated_at = now() WHERE id = $1', [id, user.username]);
  return getRiskMapping(id);
}

export async function updateSection(id, sectionId, b, user) {
  const s = await one('SELECT * FROM product_risk_sections WHERE id = $1 AND mapping_id = $2', [sectionId, id]);
  if (!s) throw notFound('Risk section not found');
  const rate = b.defaultRatePercent === undefined ? s.default_rate_percent : (b.defaultRatePercent === null ? null : toNumber(b.defaultRatePercent, NaN));
  if (Number.isNaN(rate) || (rate !== null && (rate < 0 || rate > 100))) throw badRequest('Validation failed', [{ path: 'defaultRatePercent', message: 'defaultRatePercent must be between 0 and 100' }]);
  await query(`UPDATE product_risk_sections SET remarks = $3, default_rate_percent = $4, sort_order = COALESCE($5, sort_order), section_label = COALESCE($6, section_label),
               updated_by = $7, updated_at = now() WHERE id = $1 AND mapping_id = $2`,
  [sectionId, id, b.remarks === undefined ? s.remarks : b.remarks, rate, b.sortOrder === undefined ? null : Number(b.sortOrder), b.sectionLabel || null, user.username]);
  return { before: sectionOut(s), after: await getRiskMapping(id) };
}

export async function deactivateSection(id, sectionId, user) {
  const s = await one('SELECT * FROM product_risk_sections WHERE id = $1 AND mapping_id = $2', [sectionId, id]);
  if (!s) throw notFound('Risk section not found');
  await query('UPDATE product_risk_sections SET is_active = false, updated_by = $3, updated_at = now() WHERE id = $1 AND mapping_id = $2', [sectionId, id, user.username]);
  return { before: sectionOut(s), after: await getRiskMapping(id) };
}
