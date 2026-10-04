/**
 * Insurer system integration: one mapping per insurer (connector, broker code, product codes, request and response
 * maps, claim status map) and three requests sent through the integration outbox:
 *
 *   insurer.policy_issue   issuance request built from the policy through the request map; the insurer's policy number
 *                          and status are stored on the policy (doc.insurerPolicyNumber, doc.insurerIssueStatus)
 *   insurer.policy_data    premium and status of the policy at the insurer; a premium difference above
 *                          insurer_integration.premium_tolerance is flagged (details.insurerPolicyData)
 *   insurer.claim_status   the insurer's status of a claim, read through the claim status map (claims.details.insurerStatus)
 *
 * Inbound (pushed by the insurer, or read from the claim status file of the screen): insurer.claim_status and
 * insurer.policy_issued. File fallback for premium and policy data: the insurer statement import of Accounts >
 * Insurer Reconciliation.
 */
import { many, one, query } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { registerMessageType } from './framework/registry.js';
import { enqueue, processOutbox } from './framework/outbox.js';
import { mapObject } from './framework/http.js';

const run = (db) => db || { query };
export const REQUEST_TYPES = ['insurer.policy_issue', 'insurer.policy_data', 'insurer.claim_status'];

/** Default request map: the fields an insurer API usually needs, from the policy source (see policySource). */
export const DEFAULT_REQUEST_MAP = {
  brokerCode: '{{brokerCode}}', productCode: 'productCode', brokerPolicyNumber: 'policyNumber', insuredName: 'insuredName', inceptionDate: 'inceptionDate',
  expiryDate: 'expiryDate', sumInsured: 'sumInsured', netPremium: 'netPremium', grossPremium: 'grossPremium', currency: 'currency',
  vehicle: { plateNumber: 'vehicle.plateNumber', chassisNumber: 'vehicle.chassisNumber', engineNumber: 'vehicle.engineNumber', make: 'vehicle.make', model: 'vehicle.model', year: 'vehicle.year' },
  client: { name: 'client.name', email: 'client.email', mobile: 'client.mobile', tin: 'client.tin', address: 'client.address' },
};

export const toMapping = (m) => ({
  id: m.id, insuranceCompanyId: m.insurance_company_id, insurerName: m.insurer_name || null, insurerCode: m.insurer_code || null, connectorCode: m.connector_code,
  enabled: m.enabled, brokerCode: m.broker_code, autoIssueRequest: m.auto_issue_request, productMap: m.product_map || {}, requestMap: m.request_map || {},
  responseMap: m.response_map || {}, claimStatusMap: m.claim_status_map || {}, remarks: m.remarks, updatedAt: m.updated_at,
});
const MAP_SELECT = 'SELECT m.*, ic.name AS insurer_name, ic.code AS insurer_code FROM insurer_api_mappings m JOIN insurance_companies ic ON ic.id = m.insurance_company_id';

export const listMappings = async () => (await many(`${MAP_SELECT} ORDER BY ic.name`)).map(toMapping);
export async function mappingOf(insurerId, db = null) {
  return (await run(db).query(`${MAP_SELECT} WHERE m.insurance_company_id = $1`, [Number(insurerId) || 0])).rows[0] || null;
}

async function assertInsurerConnector(code) {
  const c = await one('SELECT kind FROM integration_connectors WHERE code = $1', [code]);
  if (!c) throw badRequest('Validation failed', [{ path: 'connectorCode', message: `Connector ${code} does not exist` }]);
  if (c.kind !== 'insurer_api') throw badRequest('Validation failed', [{ path: 'connectorCode', message: `Connector ${code} is not an insurer API connector` }]);
}

export async function saveMapping(insurerId, b, user) {
  const ins = await one('SELECT id, name FROM insurance_companies WHERE id = $1', [Number(insurerId)]);
  if (!ins) throw notFound('Insurer not found');
  const before = await mappingOf(ins.id);
  const v = { connector_code: b.connectorCode ?? before?.connector_code, enabled: b.enabled ?? before?.enabled ?? true, broker_code: b.brokerCode !== undefined ? b.brokerCode || null : before?.broker_code || null,
    auto_issue_request: b.autoIssueRequest ?? before?.auto_issue_request ?? false, product_map: b.productMap ?? before?.product_map ?? {}, request_map: b.requestMap ?? before?.request_map ?? {},
    response_map: b.responseMap ?? before?.response_map ?? {}, claim_status_map: b.claimStatusMap ?? before?.claim_status_map ?? {}, remarks: b.remarks !== undefined ? b.remarks || null : before?.remarks || null };
  if (!v.connector_code) throw badRequest('Validation failed', [{ path: 'connectorCode', message: 'Choose the connector of the insurer API' }]);
  await assertInsurerConnector(v.connector_code);
  await query(`INSERT INTO insurer_api_mappings(insurance_company_id, connector_code, enabled, broker_code, auto_issue_request, product_map, request_map, response_map, claim_status_map, remarks, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
    ON CONFLICT (insurance_company_id) DO UPDATE SET connector_code = EXCLUDED.connector_code, enabled = EXCLUDED.enabled, broker_code = EXCLUDED.broker_code,
      auto_issue_request = EXCLUDED.auto_issue_request, product_map = EXCLUDED.product_map, request_map = EXCLUDED.request_map, response_map = EXCLUDED.response_map,
      claim_status_map = EXCLUDED.claim_status_map, remarks = EXCLUDED.remarks, updated_by = EXCLUDED.updated_by, updated_at = now()`,
  [ins.id, v.connector_code, v.enabled, v.broker_code, v.auto_issue_request, JSON.stringify(v.product_map), JSON.stringify(v.request_map), JSON.stringify(v.response_map),
    JSON.stringify(v.claim_status_map), v.remarks, user?.id ?? null]);
  return { before: before ? toMapping(before) : null, after: toMapping(await mappingOf(ins.id)) };
}

/** What a request map reads from: the policy with its client and vehicle in plain names. */
export async function policySource(db, policyRef, mapping) {
  const p = (await run(db).query(`SELECT p.*, c.display_name AS client_name, c.email AS client_email, c.phone AS client_phone, c.tin AS client_tin, c.address AS client_address
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id WHERE p.id = $1 OR p.policy_number = $1`, [String(policyRef)])).rows[0];
  if (!p) throw notFound('Policy not found');
  const doc = p.doc || {};
  const veh = (Array.isArray(doc.insuranceVehicleDetails) && doc.insuranceVehicleDetails[0]) || {};
  const pick = (...keys) => { for (const src of [doc, veh]) for (const k of keys) if (src[k] !== undefined && src[k] !== null && src[k] !== '') return src[k]; return null; };
  const productMap = mapping?.product_map || {};
  const productKey = [p.product_type, p.lob].find((k) => k && productMap[k] !== undefined) || null;
  return {
    row: p,
    source: {
      brokerCode: mapping?.broker_code || null, policyId: p.id, policyNumber: p.policy_number, insurerPolicyNumber: doc.insurerPolicyNumber || null,
      productType: p.product_type, lob: p.lob, productCode: productKey ? productMap[productKey] : (p.product_type || p.lob), insuredName: p.insured_name || p.client_name,
      inceptionDate: p.inception_date, expiryDate: p.expiry_date, issuedDate: p.issued_date, sumInsured: Number(p.sum_insured), netPremium: Number(p.net_premium || 0),
      grossPremium: Number(p.premium_total), currency: p.currency,
      vehicle: { plateNumber: pick('plateNumber', 'plateNo'), chassisNumber: pick('chassisNumber', 'chassisNo'), engineNumber: pick('engineNumber', 'engineNo'), make: pick('make', 'vehicleMake', 'brand'),
        model: pick('model', 'vehicleModel'), year: pick('yearOfManufacture', 'year', 'modelYear') },
      client: { name: p.client_name, email: p.client_email, mobile: p.client_phone, tin: p.client_tin, address: p.client_address },
    },
  };
}

/** The issuance request of a policy as the insurer will receive it (preview on the screen, payload of the message). */
export async function buildIssueRequest(db, policyRef, mapping) {
  const { row, source } = await policySource(db, policyRef, mapping);
  const map = Object.keys(mapping?.request_map || {}).length ? mapping.request_map : DEFAULT_REQUEST_MAP;
  return { row, source, request: mapObject(map, source) };
}

async function mappingForPolicy(db, policyRef) {
  const p = (await run(db).query('SELECT id, policy_number, insurance_company_id FROM policies WHERE id = $1 OR policy_number = $1', [String(policyRef)])).rows[0];
  if (!p) throw notFound('Policy not found');
  const m = p.insurance_company_id ? await mappingOf(p.insurance_company_id, db) : null;
  if (!m) throw badRequest(`The insurer of policy ${p.policy_number} has no API mapping (Master > System Configuration > Insurer Integration)`);
  if (!m.enabled) throw badRequest(`The API mapping of ${m.insurer_name} is switched off`);
  return { policy: p, mapping: m };
}

async function queueRequest(db, type, { mapping, entity, entityId, reference, payload }, user) {
  const n = Number((await run(db).query('SELECT count(*)::int AS n FROM integration_outbox WHERE entity = $1 AND entity_id = $2 AND message_type = $3', [entity, entityId, type])).rows[0].n);
  return enqueue(db, { connectorCode: mapping.connector_code, messageType: type, entity, entityId, reference, idempotencyKey: `${type}:${entityId}:${n + 1}`,
    payload: { ...payload, insurerId: mapping.insurance_company_id, insurerCode: mapping.insurer_code, brokerCode: mapping.broker_code, responseMap: mapping.response_map || {} } }, user);
}

/**
 * Queue (and, with send, send at once) a request: { type, policyId | claimId }. Returns the outbox message.
 */
export async function createRequest(b, user, { send = true, fetchImpl, db = null } = {}) {
  let m;
  if (b.type === 'insurer.policy_issue' || b.type === 'insurer.policy_data') {
    const { policy, mapping } = await mappingForPolicy(db, b.policyId);
    if (b.type === 'insurer.policy_issue') {
      const { row, request } = await buildIssueRequest(db, policy.id, mapping);
      if (row.doc?.insurerPolicyNumber && !b.force) throw conflict(`Policy ${row.policy_number} has the insurer policy number ${row.doc.insurerPolicyNumber} already`);
      m = await queueRequest(db, b.type, { mapping, entity: 'policy', entityId: policy.id, reference: policy.policy_number, payload: { policyNumber: policy.policy_number, request } }, user);
    } else {
      const { source } = await policySource(db, policy.id, mapping);
      m = await queueRequest(db, b.type, { mapping, entity: 'policy', entityId: policy.id, reference: policy.policy_number,
        payload: { policyNumber: policy.policy_number, insurerPolicyNumber: source.insurerPolicyNumber || policy.policy_number, expectedPremium: source.grossPremium } }, user);
    }
  } else if (b.type === 'insurer.claim_status') {
    const c = (await run(db).query(`SELECT c.id, c.claim_number, c.details, p.insurance_company_id FROM claims c JOIN policies p ON p.id = c.policy_id WHERE c.id = $1 OR c.claim_number = $1`, [String(b.claimId)])).rows[0];
    if (!c) throw notFound('Claim not found');
    const mapping = await mappingOf(c.insurance_company_id, db);
    if (!mapping?.enabled) throw badRequest('The insurer of this claim has no active API mapping');
    m = await queueRequest(db, b.type, { mapping, entity: 'claim', entityId: c.id, reference: c.claim_number,
      payload: { claimNumber: c.claim_number, insurerClaimNumber: c.details?.insurerClaimNumber || c.claim_number } }, user);
  } else throw badRequest(`Unknown request type ${b.type}`);
  if (send && !db) await processOutbox({ ids: [m.id], fetchImpl });
  return m;
}

/** Policy issue hook: the issuance request when the insurer's mapping asks for it (auto_issue_request). */
export async function afterPolicyIssued(db, policyId, userId) {
  const p = (await db.query('SELECT insurance_company_id FROM policies WHERE id = $1', [policyId])).rows[0];
  if (!p?.insurance_company_id) return null;
  const m = await mappingOf(p.insurance_company_id, db);
  if (!m?.enabled || !m.auto_issue_request) return null;
  return createRequest({ type: 'insurer.policy_issue', policyId }, userId ? { id: userId } : null, { send: false, db });
}

const claimStatusOf = (mapping, raw) => {
  const map = mapping?.claim_status_map || {};
  const key = Object.keys(map).find((k) => k.toLowerCase() === String(raw || '').toLowerCase());
  return key ? map[key] : raw;
};

async function applyClaimStatus(db, claimId, { status, remarks, source, at = null }) {
  const c = (await db.query(`SELECT c.id, c.claim_number, p.insurance_company_id FROM claims c JOIN policies p ON p.id = c.policy_id WHERE c.id = $1 OR c.claim_number = $1`, [String(claimId)])).rows[0];
  if (!c) throw new Error(`Claim ${claimId} not found`);
  const mapping = await mappingOf(c.insurance_company_id, db);
  const label = claimStatusOf(mapping, status);
  const info = { insurerStatus: label, insurerStatusRaw: status, insurerRemarks: remarks || null, insurerStatusAt: at || new Date().toISOString(), insurerStatusSource: source };
  await db.query('UPDATE claims SET details = details || $2::jsonb, updated_at = now() WHERE id = $1', [c.id, JSON.stringify(info)]);
  await db.query('INSERT INTO claim_history(claim_id, by_user, status, note) VALUES ($1, $2, (SELECT status FROM claims WHERE id = $1), $3)',
    [c.id, 'Insurer integration', `Insurer status: ${label}${remarks ? ` (${remarks})` : ''}`]);
  return { claimId: c.id, claimNumber: c.claim_number, insurerStatus: label };
}

registerMessageType({
  type: 'insurer.policy_issue', kind: 'insurer_api', label: 'Policy issuance request to the insurer',
  onSent: async (db, message, result) => {
    const d = result.data || {};
    await db.query(`UPDATE policies SET doc = doc || jsonb_strip_nulls(jsonb_build_object('insurerPolicyNumber', $2::text, 'insurerIssueStatus', $3::text, 'insurerIssueAt', now()::text)) WHERE id = $1`,
      [message.entityId, d.policyNumber ? String(d.policyNumber) : null, d.status ? String(d.status) : 'accepted']);
  },
});
registerMessageType({
  type: 'insurer.policy_data', kind: 'insurer_api', label: 'Policy and premium data from the insurer',
  onSent: async (db, message, result) => {
    const d = result.data || {};
    const p = (await db.query('SELECT premium_total FROM policies WHERE id = $1', [message.entityId])).rows[0];
    const tolerance = Number(await getSetting('insurer_integration.premium_tolerance', 1)) || 0;
    const premium = d.premium === undefined || d.premium === null || d.premium === '' ? null : Number(d.premium);
    const difference = premium === null || !p ? null : round2(premium - Number(p.premium_total));
    const info = { insurerPolicyData: { policyNumber: d.policyNumber || null, status: d.status || null, premium, difference, flagged: difference !== null && Math.abs(difference) > tolerance, at: new Date().toISOString() } };
    await db.query('UPDATE policies SET details = details || $2::jsonb WHERE id = $1', [message.entityId, JSON.stringify(info)]);
    if (d.policyNumber) await db.query("UPDATE policies SET doc = doc || jsonb_build_object('insurerPolicyNumber', $2::text) WHERE id = $1 AND NOT (doc ? 'insurerPolicyNumber')", [message.entityId, String(d.policyNumber)]);
  },
});
registerMessageType({
  type: 'insurer.claim_status', kind: 'insurer_api', label: 'Claim status from the insurer',
  onSent: async (db, message, result) => {
    if (!result.data?.status) throw new Error('The answer has no claim status');
    await applyClaimStatus(db, message.entityId, { status: result.data.status, remarks: result.data.remarks, source: 'api' });
  },
  onInbound: async (db, inbox) => {
    const p = inbox.payload || {};
    if (!p.claimNumber || !p.status) throw new Error('claimNumber and status are required');
    const r = await applyClaimStatus(db, p.claimNumber, { status: p.status, remarks: p.remarks, source: inbox.source, at: p.statusDate || null });
    return { entity: 'claim', entityId: r.claimId, result: r };
  },
});
registerMessageType({
  type: 'insurer.policy_issued', kind: 'insurer_api', label: 'Policy number confirmed by the insurer',
  onInbound: async (db, inbox) => {
    const p = inbox.payload || {};
    const row = (await db.query('SELECT id FROM policies WHERE policy_number = $1 OR id = $1', [String(p.brokerPolicyNumber || p.policyId || '')])).rows[0];
    if (!row) throw new Error(`Policy ${p.brokerPolicyNumber || p.policyId} not found`);
    await db.query(`UPDATE policies SET doc = doc || jsonb_strip_nulls(jsonb_build_object('insurerPolicyNumber', $2::text, 'insurerIssueStatus', $3::text, 'insurerIssueAt', now()::text)) WHERE id = $1`,
      [row.id, p.insurerPolicyNumber ? String(p.insurerPolicyNumber) : null, p.status ? String(p.status) : 'issued']);
    return { entity: 'policy', entityId: row.id, result: { insurerPolicyNumber: p.insurerPolicyNumber } };
  },
});

/**
 * Claim status file (CSV): columns Claim Number, Status, Remarks, Status Date (headers compared without case or
 * spaces). Each row goes through the inbox (source file) so the monitor shows what was read.
 */
export function parseClaimStatusCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw badRequest('The file is empty');
  const split = (l) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i += 1) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };
  const head = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const idx = (names) => head.findIndex((h) => names.includes(h));
  const cn = idx(['claimnumber', 'claimno', 'claim']); const st = idx(['status', 'claimstatus', 'insurerstatus']); const rm = idx(['remarks', 'remark', 'notes']); const dt = idx(['statusdate', 'date']);
  if (cn < 0 || st < 0) throw badRequest(`The file needs the columns Claim Number and Status (found: ${split(lines[0]).join(', ')})`);
  return lines.slice(1).map((l, i) => {
    const c = split(l);
    return { row: i + 2, claimNumber: c[cn], status: c[st], remarks: rm >= 0 ? c[rm] || null : null, statusDate: dt >= 0 ? c[dt] || null : null };
  }).filter((r) => r.claimNumber);
}
