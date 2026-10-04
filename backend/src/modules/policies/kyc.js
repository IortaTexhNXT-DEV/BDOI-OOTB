/**
 * KYC and vehicle-identifier checks at policy issuance (convert quotation to policy).
 *
 * The required items per line of business come from app_settings `policy.kyc_required_fields`
 * ({ MOTOR: [...], FIRE: [...], '*': [...] }; '*' applies to lines without their own entry) and the
 * accepted ID documents from `policy.kyc_id_types`. Values are read from the quotation (customer /
 * vehicle information saved on the convert-to-policy steps) and the issuance request, so the same
 * check guards the screen and the API.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';
import { query } from '../../db/pool.js';

export const KYC_DEFAULT_REQUIRED = {
  MOTOR: ['idType', 'idNumber', 'idImage', 'chassisNumber', 'motorNumber', 'plateOrMvFile'],
  '*': [],
};
export const KYC_DEFAULT_ID_TYPES = ['PhilSys ID', 'UMID', 'Passport', "Driver's License", 'PRC ID', 'SSS ID', 'GSIS ID', 'TIN ID', 'Postal ID', "Voter's ID", 'Senior Citizen ID'];

/** Items and the field names the screens / API use for them (first non-empty wins). Also read by My Work (missing documents). */
export const KYC_ITEMS = {
  idType: { label: 'ID type', keys: ['idType', 'idCardType', 'IdCardType', 'idProofType'] },
  idNumber: { label: 'ID number', keys: ['idNumber', 'idCardNumber', 'IdCardNumber'] },
  idImage: { label: 'ID card image', keys: ['idCardImage', 'idImage', 'idCardImageUrl', 'idCardPhoto', 'IdCardImage'] },
  chassisNumber: { label: 'Chassis number', keys: ['chassisNumber', 'ChassisNumber'] },
  motorNumber: { label: 'Motor / engine number', keys: ['motorNumber', 'MotorNumber', 'engineNumber'] },
  plateNumber: { label: 'Plate number', keys: ['plateNumber', 'PlateNumber'] },
  mvFileNumber: { label: 'MV file number', keys: ['mvFileNumber', 'MvFileNumber', 'MVFileNumber'] },
  plateOrMvFile: { label: 'Plate number or MV file number', anyOf: ['plateNumber', 'mvFileNumber'] },
};

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim().toUpperCase() !== 'N/A';

/** First non-empty value of an item across the sources (later sources override earlier ones). */
export function kycValue(sources, item) {
  const def = KYC_ITEMS[item];
  if (!def?.keys) return null;
  let found = null;
  for (const s of sources.filter(Boolean)) {
    for (const k of def.keys) if (filled(s[k])) { found = String(s[k]).trim(); break; }
  }
  return found;
}

export async function requiredKycFor(lob) {
  const cfg = (await getSetting('policy.kyc_required_fields', KYC_DEFAULT_REQUIRED)) || KYC_DEFAULT_REQUIRED;
  const key = String(lob || '').toUpperCase();
  const list = cfg[key] ?? cfg['*'] ?? [];
  return (Array.isArray(list) ? list : []).filter((i) => KYC_ITEMS[i]);
}

/** Labels of the required items that are missing or invalid (empty when complete). */
export async function missingKyc({ lob, sources }) {
  const required = await requiredKycFor(lob);
  const missing = [];
  for (const item of required) {
    const def = KYC_ITEMS[item];
    const ok = def.anyOf ? def.anyOf.some((i) => kycValue(sources, i)) : kycValue(sources, item);
    if (!ok) missing.push(def.label);
  }
  if (required.includes('idType')) {
    const type = kycValue(sources, 'idType');
    const accepted = (await getSetting('policy.kyc_id_types', KYC_DEFAULT_ID_TYPES)) || [];
    if (type && accepted.length && !accepted.some((t) => t.toLowerCase() === type.toLowerCase())) missing.push(`ID type "${type}" is not an accepted ID (${accepted.join(', ')})`);
  }
  return missing;
}

/** Refuse issuance (400) listing every missing item. */
export async function assertKyc({ lob, sources }) {
  const missing = await missingKyc({ lob, sources });
  if (missing.length) {
    throw badRequest(`Policy cannot be issued without the customer's KYC and vehicle identifiers. Missing: ${missing.join('; ')}`,
      missing.map((m) => ({ path: 'kyc', message: m })));
  }
}

/** The identifiers shown on the issue-policy dialog (dialog field -> KYC item). */
export const KYC_PREFILL_FIELDS = { idType: 'idType', idCardNumber: 'idNumber', chassisNumber: 'chassisNumber', motorNumber: 'motorNumber', plateNumber: 'plateNumber' };
const ID_ITEMS = new Set(['idType', 'idNumber']);

/**
 * Values already captured for a policy about to be issued, so the user only verifies them: the ID from the client's
 * earlier policies, then the renewed policy, the quotation (its vehicle, its document) and the placement slip (later
 * sources win, as in the issuance check). Vehicle identifiers never come from the client's other vehicles.
 */
export async function kycPrefill({ clientId = null, quoteId = null, placementDoc = null }, db = { query }) {
  const q = quoteId ? (await db.query('SELECT doc, vehicle FROM quotes WHERE id = $1', [quoteId])).rows[0] : null;
  const renewedFrom = q?.doc?.renewedFromPolicyId || q?.doc?.renewal?.policyId;
  const expiring = renewedFrom ? (await db.query('SELECT doc, details FROM policies WHERE id = $1', [renewedFrom])).rows[0] : null;
  const history = clientId ? (await db.query(`SELECT doc, details FROM policies WHERE client_id = $1 AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 5`, [clientId])).rows : [];
  const v = q?.vehicle || {};
  const legacyVehicle = { chassisNumber: v.chassisNo, motorNumber: v.engineNo, plateNumber: v.plateNo };
  const idSources = history.reverse().flatMap((p) => [p.details, p.doc]);
  const sources = [expiring?.details, expiring?.doc, legacyVehicle, q?.doc?.insuranceVehicleDetails?.[0], q?.doc, placementDoc];
  const out = {};
  for (const [field, item] of Object.entries(KYC_PREFILL_FIELDS)) {
    out[field] = kycValue(ID_ITEMS.has(item) ? [...idSources, ...sources] : sources, item) || '';
  }
  return out;
}
