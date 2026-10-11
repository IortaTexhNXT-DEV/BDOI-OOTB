/**
 * KYC and vehicle-identifier checks at policy issuance (convert quotation to policy, book a placement).
 *
 * The required items per line of business come from app_settings `policy.kyc_required_fields`
 * ({ MOTOR: [...], FIRE: [...], '*': [...] }; '*' applies to lines without their own entry) and the
 * accepted ID documents from `policy.kyc_id_types`. Values are read from the quotation (customer /
 * vehicle information saved on the convert-to-policy steps) and the issuance request, so the same
 * check guards the screen and the API.
 *
 * KYC by source (TIS-BRD-KYC-02, FR-SIS-012): the KYC Mode of the client's lead source (Lead Source master) decides
 * what is collected. Under "TFS confirmation" the deal relies on the KYC validated by Toyota Financial Services: the
 * TFS confirmation stands in for the government ID, which is not collected again. Under "Full KYC" the ID items apply,
 * and a secondary ID (policy.kyc_secondary_ids) needs a second ID. The Onboarding Checklist master (type kyc-checklist,
 * Pre-BSM M14) lists the documents required at booking per line and mode (government ID, OR/CR, signed proposal,
 * four-side vehicle photos, the birth certificate of a customer aged 21 or under, the ACR I-Card / SRRV of a
 * non-Filipino); it is enforced with policy.kyc_checklist_enforced, against the documents on the client record
 * (client_kyc_documents) and the files of the booking.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest } from '../../lib/errors.js';
import { query } from '../../db/pool.js';
import { revealPii } from '../../lib/pii.js';
import { activeRecord, activeRecords } from '../ops-masters/records.js';

export const KYC_MODES = { full: 'Full KYC', tfs: 'TFS confirmation' };

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
  idType2: { label: 'Second ID type', keys: ['idType2', 'secondIdType'] },
  idNumber2: { label: 'Second ID number', keys: ['idNumber2', 'secondIdNumber', 'idCardNumber2'] },
  tfsConfirmation: { label: 'TFS KYC confirmation', keys: ['tfsKycReference', 'tfsKycConfirmation', 'tfsReference', 'tfsKycConfirmationKey'] },
};
/** Where the files of the checklist documents are found on a booking (document type -> keys of the sources). */
const CHECKLIST_KEYS = {
  'government-id': KYC_ITEMS.idImage.keys,
  'tfs-kyc-confirmation': KYC_ITEMS.tfsConfirmation.keys,
  'or-cr': ['ltoDocumentKey', 'orCrDocumentKey', 'orCrKey', 'orcrDocumentKey'],
  'signed-proposal': ['signedProposalKey', 'proposalFormKey', 'signedProposalDocumentKey'],
  'birth-certificate': ['birthCertificateKey'],
  'acr-srrv': ['acrDocumentKey', 'srrvDocumentKey'],
};
const VEHICLE_PHOTOS = ['vehicleLeftSidePhoto', 'vehicleRightSidePhoto', 'vehicleFrontSidePhoto', 'vehicleRearSidePhoto'];

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim().toUpperCase() !== 'N/A';

/** First non-empty value of an item across the sources (later sources override earlier ones). */
export function kycValue(sources, item) {
  const def = KYC_ITEMS[item];
  if (!def?.keys) return null;
  let found = null;
  for (const s of sources.filter(Boolean)) {
    // an ID number is stored encrypted (migration 0277): the value is compared and proposed in clear
    for (const k of def.keys) if (filled(s[k])) { found = String(revealPii(s[k])).trim(); break; }
  }
  return found;
}

export async function requiredKycFor(lob) {
  const cfg = (await getSetting('policy.kyc_required_fields', KYC_DEFAULT_REQUIRED)) || KYC_DEFAULT_REQUIRED;
  const key = String(lob || '').toUpperCase();
  const list = cfg[key] ?? cfg['*'] ?? [];
  return (Array.isArray(list) ? list : []).filter((i) => KYC_ITEMS[i]);
}

/**
 * The KYC mode of a party: the KYC Mode of the lead source of the client (clients.source) or of the prospect
 * (leads.source), or a source listed in policy.kyc_tfs_sources; Full KYC when unknown. Returns { mode, source }.
 */
export async function kycModeFor({ clientId = null, leadId = null, source = null }, db = { query }) {
  let code = source;
  if (!code && clientId) code = (await db.query('SELECT source FROM clients WHERE id = $1 OR client_code = $1 LIMIT 1', [String(clientId)])).rows[0]?.source || null;
  if (!code && leadId) code = (await db.query('SELECT source FROM leads WHERE id = $1 LIMIT 1', [String(leadId)])).rows[0]?.source || null;
  if (!code) return { mode: KYC_MODES.full, source: null };
  const tfs = (await getSetting('policy.kyc_tfs_sources', [])) || [];
  if (Array.isArray(tfs) && tfs.some((s) => String(s).toLowerCase() === String(code).toLowerCase())) return { mode: KYC_MODES.tfs, source: code };
  const record = await activeRecord(db, 'lead-source', code) || (await activeRecords(db, 'lead-source')).find((r) => String(r.name).toLowerCase() === String(code).toLowerCase());
  return { mode: record?.kycMode === KYC_MODES.tfs ? KYC_MODES.tfs : KYC_MODES.full, source: code };
}

/** The customer facts the checklist rules read: age in years and nationality (from the client record). */
async function customerFacts(clientId, db) {
  if (!clientId) return { age: null, nationality: null };
  const c = (await db.query('SELECT birth_date, nationality FROM clients WHERE id = $1 OR client_code = $1 LIMIT 1', [String(clientId)])).rows[0];
  if (!c) return { age: null, nationality: null };
  const age = c.birth_date ? Math.floor((Date.now() - new Date(c.birth_date).getTime()) / (365.25 * 86400000)) : null;
  return { age, nationality: c.nationality || null };
}

/**
 * The Onboarding Checklist of a booking: the active rows of the kyc-checklist master that apply to the line, the KYC
 * mode and the customer (age, nationality), each with whether a document satisfies it: a file of the booking (the
 * keys of CHECKLIST_KEYS, the four vehicle photos) or a document of the client record of that type.
 */
export async function kycChecklist({ lob, mode, sources = [], clientId = null }, db = { query }) {
  const rows = (await activeRecords(db, 'kyc-checklist')).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const line = String(lob || '').toUpperCase();
  const facts = await customerFacts(clientId, db);
  const minorAge = Number(await getSetting('policy.kyc_minor_age', 21)) || 21;
  const docs = clientId ? (await db.query('SELECT DISTINCT doc_type FROM client_kyc_documents WHERE client_id = $1', [String(clientId)])).rows.map((r) => r.doc_type) : [];
  const out = [];
  for (const r of rows) {
    const forLine = String(r.lob || '*') === '*' || String(r.lob).toUpperCase() === line;
    const forMode = !r.kycMode || r.kycMode === 'Any' || r.kycMode === mode;
    const rule = r.rule || 'Always';
    const applies = forLine && forMode && (rule === 'Always'
      || (rule === 'Customer aged 21 or under' && facts.age !== null && facts.age <= minorAge)
      || (rule === 'Non-Filipino customer' && facts.nationality && !/^(filipino|philippine|ph)$/i.test(String(facts.nationality).trim())));
    if (!applies) continue;
    let satisfied = docs.includes(r.docType);
    if (!satisfied && r.docType === 'vehicle-photos') satisfied = VEHICLE_PHOTOS.every((k) => sources.filter(Boolean).some((s) => filled(s[k])));
    if (!satisfied && CHECKLIST_KEYS[r.docType]) satisfied = CHECKLIST_KEYS[r.docType].some((k) => sources.filter(Boolean).some((s) => filled(s[k])));
    out.push({ code: r.code, name: r.name, docType: r.docType, required: r.required !== false && String(r.required).toLowerCase() !== 'false', satisfied });
  }
  return out;
}

/** Labels of the required items that are missing or invalid (empty when complete). */
export async function missingKyc({ lob, sources, clientId = null, leadId = null, db = { query } }) {
  const { mode } = await kycModeFor({ clientId, leadId }, db);
  const idItems = new Set(['idType', 'idNumber', 'idImage']);
  // TFS-sourced business: the TFS confirmation stands in for the government ID
  const required = (await requiredKycFor(lob)).filter((i) => mode !== KYC_MODES.tfs || !idItems.has(i));
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
    // one primary ID, or two secondary IDs
    const secondary = (await getSetting('policy.kyc_secondary_ids', [])) || [];
    if (type && Array.isArray(secondary) && secondary.some((t) => String(t).toLowerCase() === type.toLowerCase())) {
      const second = kycValue(sources, 'idType2');
      if (!second || !kycValue(sources, 'idNumber2')) missing.push(`A second ID is needed with the secondary ID "${type}" (one primary ID or two secondary IDs)`);
      else if (accepted.length && !accepted.some((t) => t.toLowerCase() === second.toLowerCase())) missing.push(`ID type "${second}" is not an accepted ID (${accepted.join(', ')})`);
    }
  }
  if ((await getSetting('policy.kyc_checklist_enforced', false)) === true) {
    const checklist = await kycChecklist({ lob, mode, sources, clientId }, db);
    for (const c of checklist) if (c.required && !c.satisfied) missing.push(c.name);
  } else if (mode === KYC_MODES.tfs && (await getSetting('policy.kyc_required_fields', KYC_DEFAULT_REQUIRED) || KYC_DEFAULT_REQUIRED)[String(lob || '').toUpperCase()]?.includes('idType')
    && ![...idItems].every((i) => kycValue(sources, i))) {
    // a TFS-sourced Motor deal still needs the TFS confirmation where the ID would have been collected; a full
    // government ID on file (a renewal, a client identified at onboarding) satisfies the KYC whatever the source
    const checklist = await kycChecklist({ lob, mode, sources, clientId }, db);
    const conf = checklist.find((c) => c.docType === 'tfs-kyc-confirmation');
    if (conf && !conf.satisfied) missing.push(conf.name);
  }
  return missing;
}

/** Refuse issuance (400) listing every missing item. */
export async function assertKyc({ lob, sources, clientId = null, leadId = null, db = { query } }) {
  const missing = await missingKyc({ lob, sources, clientId, leadId, db });
  if (missing.length) {
    throw badRequest(`Policy cannot be issued without the customer's KYC and vehicle identifiers. Missing: ${missing.join('; ')}`,
      missing.map((m) => ({ path: 'kyc', message: m })));
  }
}

/** The identifiers shown on the issue-policy dialog (dialog field -> KYC item). */
export const KYC_PREFILL_FIELDS = { idType: 'idType', idCardNumber: 'idNumber', idCardImage: 'idImage', chassisNumber: 'chassisNumber', motorNumber: 'motorNumber', plateNumber: 'plateNumber' };
const ID_ITEMS = new Set(['idType', 'idNumber', 'idImage']);

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
