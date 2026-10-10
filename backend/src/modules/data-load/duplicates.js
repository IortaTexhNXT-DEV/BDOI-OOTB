/**
 * Duplicate detection of a load: a row that would create a record matching another record by a rule other than its
 * key. Each rule runs within the file (an earlier row of the batch) and against the records stored in BrokerVerse, of
 * any origin. The stored side is read once per validation into memory (normalised key -> records), never one query per
 * row; the file side grows as the rows are read. Rules apply to the objects that declare them (registry.js
 * duplicateRules) and only when switched on in the setting migration.duplicate_rules.
 *
 *   tin              Clients: same TIN (stored side through the blind index clients.tin_bidx: encrypted TINs are
 *                    compared without decrypting)
 *   name-birth-date  Clients, individual: same first and last name and the same birth date
 *   company-name     Clients, corporate: same company name, when the TIN is empty on either side
 *   vehicle          Policies - Motor / CTPL: same plate, conduction sticker or chassis number on another policy of the
 *                    same sheet in force over an overlapping period
 *   coc              Policies - CTPL: same COC number of the same insurer (CTPL authentications, migrated CTPL policies)
 *   policy-number    every policy sheet: the number of a stored policy of another insurer (the same insurer is the row's
 *                    own record, or an error)
 *   insurer-variant  every Insurer column: a value that is no code, name or short name but equals one insurer once
 *                    normalised ("Malayan Ins. Co., Inc." for MALAYAN)
 *   master-name      configuration masters with a name column: a new code whose normalised name equals an existing
 *                    record of the same master
 *
 * A match: { rule, kind: 'file' | 'stored', row?, recordId?, number, name }.
 */
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { blindIndex, normaliseIdentifier, revealPii } from '../../lib/pii.js';
import { cellString, keyText } from './common.js';

export const DUPLICATE_RULES = ['tin', 'name-birth-date', 'company-name', 'vehicle', 'coc', 'policy-number', 'insurer-variant', 'master-name'];

/** Columns each rule reads: a masked value in one of them is an error (it cannot be compared). */
export const RULE_COLUMNS = {
  tin: ['tin'], 'name-birth-date': ['firstName', 'lastName', 'birthDate'], 'company-name': ['companyName'], vehicle: ['plateNumber', 'conductionSticker', 'chassisNumber'],
  coc: ['certNumber'], 'policy-number': ['policyNumber'], 'insurer-variant': ['insurer'], 'master-name': [],
};

/** Labels of the rules (review screen, errors workbook, Instructions sheet). */
export const RULE_LABELS = {
  tin: 'Same TIN', 'name-birth-date': 'Same name and birth date', 'company-name': 'Same company name', vehicle: 'Same vehicle in force',
  coc: 'Same COC number', 'policy-number': 'Policy number of another insurer', 'insurer-variant': 'Insurer name variant', 'master-name': 'Same name',
};

// ------------------------------------------------------------------ normalisation

const words = (s) => cellString(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii']);
const COMPANY_WORDS = new Set(['inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'opc', 'phils', 'philippines']);
const INSURER_WORDS = new Set(['the', 'insurance', 'ins', 'assurance', 'co', 'company', 'corp', 'corporation', 'inc', 'phils', 'philippines']);

/** Text compared as written: lower case, composed, spaces collapsed. */
export const normaliseText = (s) => cellString(s).toLowerCase().replace(/\s+/g, ' ');
/** A person's name: lower case, accents kept, spaces collapsed, suffixes Jr / Sr / II / III removed. */
export const normalisePersonName = (...parts) => words(parts.join(' ')).filter((w) => !NAME_SUFFIXES.has(w)).join(' ');
/** A company name: lower case, punctuation removed, legal-form words (Inc, Corp, Co, Ltd, OPC, Phils ...) removed. */
export const normaliseCompany = (s) => words(s).filter((w) => !COMPANY_WORDS.has(w)).join(' ');
/** An insurer name: as a company, and the words insurance, ins and assurance removed too. */
export const normaliseInsurer = (s) => words(s).filter((w) => !INSURER_WORDS.has(w)).join('');
/** A plate, conduction sticker, chassis or COC number: upper case, letters and digits only. */
export const normaliseVehicleId = (s) => normaliseIdentifier(s);
/** A policy number: upper case, spaces removed. */
export const normalisePolicyNumber = (s) => cellString(s).toUpperCase().replace(/\s+/g, '');

/** Rules switched on (setting migration.duplicate_rules). */
export async function enabledRules() {
  const v = await getSetting('migration.duplicate_rules', DUPLICATE_RULES);
  return new Set((Array.isArray(v) ? v : DUPLICATE_RULES).filter((r) => DUPLICATE_RULES.includes(r)));
}

const push = (map, key, value) => {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};
/** Normalisation of the names of a master: insurers as insurers, every other master as a company. */
const nameNorm = (sheet) => (sheet.key === 'master:insurance-company' ? normaliseInsurer : normaliseCompany);
const overlaps = (a, b) => !(a.to < b.from || b.to < a.from);
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : '');

// ------------------------------------------------------------------ stored side (read once per validation)

const STORED = {
  async tin() {
    const map = new Map();
    for (const c of await many("SELECT id, client_code, display_name, tin_bidx FROM clients WHERE tin_bidx IS NOT NULL AND status <> 'deleted'")) {
      push(map, c.tin_bidx, { recordId: c.id, number: c.client_code, name: c.display_name });
    }
    return map;
  },
  async 'name-birth-date'() {
    const map = new Map();
    for (const c of await many(`SELECT id, client_code, display_name, first_name, last_name, birth_date FROM clients
        WHERE client_type = 'individual' AND birth_date IS NOT NULL AND status <> 'deleted'`)) {
      push(map, `${normalisePersonName(c.first_name, c.last_name)}|${iso(c.birth_date)}`, { recordId: c.id, number: c.client_code, name: c.display_name });
    }
    return map;
  },
  async 'company-name'() {
    const map = new Map();
    for (const c of await many("SELECT id, client_code, display_name, company_name, tin FROM clients WHERE client_type = 'corporate' AND status <> 'deleted'")) {
      push(map, normaliseCompany(c.company_name || c.display_name), { recordId: c.id, number: c.client_code, name: c.display_name, hasTin: !!revealPii(c.tin) });
    }
    return map;
  },
  async vehicle(ctx) {
    const map = new Map();
    const rows = await many(`SELECT p.id, p.policy_number, p.legacy_number, p.insurance_company_id, p.inception_date, p.expiry_date, p.doc->>'plateNumber' AS plate,
        p.doc->>'conductionSticker' AS conduction, p.doc->>'chassisNumber' AS chassis, pr.code AS product_code, pr.name AS product_name, pr.line AS product_line
      FROM policies p LEFT JOIN products pr ON pr.id = p.product_id
     WHERE p.status IN ('active', 'issued') AND ($1::date IS NULL OR p.expiry_date >= $1::date)
       AND (p.doc ? 'plateNumber' OR p.doc ? 'conductionSticker' OR p.doc ? 'chassisNumber')`, [ctx.cutover || null]);
    for (const p of rows) {
      const kind = ctx.policyKindOf ? ctx.policyKindOf({ code: p.product_code, name: p.product_name, line: p.product_line }) : null;
      const rec = { recordId: p.id, number: p.policy_number, legacyNumber: p.legacy_number, insurerId: p.insurance_company_id, name: p.policy_number, kind,
        period: { from: iso(p.inception_date), to: iso(p.expiry_date) } };
      for (const id of new Set([p.plate, p.conduction, p.chassis].map(normaliseVehicleId).filter(Boolean))) push(map, id, rec);
    }
    return map;
  },
  async coc() {
    const map = new Map();
    const rows = await many(`SELECT a.insurance_company_id, a.coc_number AS coc, a.policy_id, a.policy_number FROM ctpl_authentications a
       WHERE a.status <> 'cancelled' AND btrim(COALESCE(a.coc_number, '')) <> ''
      UNION SELECT p.insurance_company_id, p.doc->>'certNumber', p.id, p.policy_number FROM policies p
       WHERE p.origin = 'migrated' AND btrim(COALESCE(p.doc->>'certNumber', '')) <> ''`);
    for (const r of rows) push(map, `${r.insurance_company_id}|${normaliseVehicleId(r.coc)}`, { recordId: r.policy_id, number: r.policy_number, name: r.coc });
    return map;
  },
  async 'policy-number'() {
    const map = new Map();
    const rows = await many(`SELECT p.id, p.policy_number, p.legacy_number, p.insurance_company_id, p.origin, ic.code AS insurer_code, ic.name AS insurer_name
      FROM policies p LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id`);
    for (const p of rows) {
      const rec = { recordId: p.id, number: p.policy_number, insurerId: p.insurance_company_id, insurerCode: p.insurer_code, name: p.insurer_name || p.insurer_code, origin: p.origin };
      push(map, normalisePolicyNumber(p.policy_number), rec);
      if (p.legacy_number && normalisePolicyNumber(p.legacy_number) !== normalisePolicyNumber(p.policy_number)) push(map, normalisePolicyNumber(p.legacy_number), { ...rec, viaLegacy: true });
    }
    return map;
  },
  async 'insurer-variant'() {
    const map = new Map();
    for (const i of await many("SELECT id, code, name, short_name FROM insurance_companies WHERE status <> 'deleted'")) {
      for (const n of new Set([i.code, i.name, i.short_name].filter(Boolean).map(normaliseInsurer).filter(Boolean))) push(map, n, { recordId: i.id, number: i.code, name: i.name });
    }
    return map;
  },
};

// ------------------------------------------------------------------ the rules: subject of a row and its matches

/**
 * For each rule: applies(sheet, v) and keys(ctx, sheet, v) -> the normalised keys the row is matched on (file and
 * stored side), and accept(match, ctx, sheet, v): whether a stored match is another record (not the row's own).
 */
const RULES = {
  tin: {
    keys: (ctx, sheet, v) => (v.tin ? [blindIndex(v.tin)].filter(Boolean) : []),
    accept: (m, ctx, sheet, v) => keyText(m.number) !== keyText(v.clientCode),
  },
  'name-birth-date': {
    keys: (ctx, sheet, v) => (String(v.clientType || '').toLowerCase() === 'individual' && v.firstName && v.lastName && v.birthDate
      ? [`${normalisePersonName(v.firstName, v.lastName)}|${v.birthDate}`] : []),
    accept: (m, ctx, sheet, v) => keyText(m.number) !== keyText(v.clientCode),
  },
  'company-name': {
    keys: (ctx, sheet, v) => (String(v.clientType || '').toLowerCase() === 'corporate' && v.companyName ? [normaliseCompany(v.companyName)].filter(Boolean) : []),
    // two companies with a TIN each are told apart by the TIN rule
    accept: (m, ctx, sheet, v) => keyText(m.number) !== keyText(v.clientCode) && (!m.hasTin || !v.tin),
  },
  vehicle: {
    keys: (ctx, sheet, v) => [...new Set([v.plateNumber, v.conductionSticker, v.chassisNumber].map(normaliseVehicleId).filter(Boolean))],
    accept: (m, ctx, sheet, v, self) => m.kind === sheet.policyKind && !self.sameRecord(m) && overlaps(m.period, { from: v.inceptionDate, to: v.expiryDate }),
  },
  coc: {
    keys: (ctx, sheet, v, self) => (v.certNumber && self.insurer ? [`${self.insurer.id}|${normaliseVehicleId(v.certNumber)}`] : []),
    accept: (m, ctx, sheet, v, self) => !self.sameRecord(m),
  },
  'policy-number': {
    keys: (ctx, sheet, v) => (v.policyNumber ? [normalisePolicyNumber(v.policyNumber)] : []),
    // a policy of the same insurer with the number (or keeping it as legacy number) is the row's own record, or an
    // error of the importer: find() then reports no match
    accept: (m, ctx, sheet, v, self) => !!self.insurer && m.insurerId !== self.insurer.id,
  },
  'insurer-variant': {
    keys: (ctx, sheet, v, self) => (v.insurer && !self.insurer ? [normaliseInsurer(v.insurer)].filter(Boolean) : []),
    accept: () => true,
  },
  'master-name': {
    keys: (ctx, sheet, v) => (sheet.nameColumn && v[sheet.nameColumn] ? [nameNorm(sheet)(v[sheet.nameColumn])].filter(Boolean) : []),
    accept: (m, ctx, sheet, v) => m.key !== sheet.keyOf(v),
  },
};

/** Rules that compare against a stored map built from the sheet's own current data (configuration masters). */
const SHEET_STORED = new Set(['master-name']);
/** Rules that never look at other rows of the file: a variant is matched against the insurer master only. */
const STORED_ONLY = new Set(['insurer-variant', 'policy-number']);

/**
 * The duplicate checks of one validation. stored(rule) maps are read on first use; sheetRows: the sheet's current data
 * (exportRows, already read for the Unchanged check) for the master-name rule.
 *   find(sheet, v, { rowNumber, insurer, sameRecord, sheetRows }) -> matches
 *   remember(sheet, v, { rowNumber, insurer })                              -> the row joins the file side
 */
export async function duplicateDetector(ctx) {
  const enabled = await enabledRules();
  const stored = new Map();
  const file = new Map();
  const sheetMaps = new Map();
  const storedOf = async (rule) => {
    if (!stored.has(rule)) stored.set(rule, await STORED[rule](ctx));
    return stored.get(rule);
  };
  const sheetMapOf = (sheet, rows) => {
    if (!sheetMaps.has(sheet.key)) {
      const map = new Map();
      for (const r of rows || []) push(map, nameNorm(sheet)(r[sheet.nameColumn]), { key: sheet.keyOf(r), number: sheet.keyColumns.map((k) => r[k]).join(' / '), name: r[sheet.nameColumn] });
      sheetMaps.set(sheet.key, map);
    }
    return sheetMaps.get(sheet.key);
  };
  const rulesOf = (sheet) => (sheet.duplicateRules || []).filter((r) => enabled.has(r) && RULES[r]);
  const fileKey = (sheet, rule, key) => `${rule === 'vehicle' || rule === 'coc' ? sheet.key : rule}\u0000${key}`;

  return {
    enabled,
    async find(sheet, v, self = {}) {
      const out = [];
      const me = { sameRecord: () => false, ...self };
      for (const rule of rulesOf(sheet)) {
        const def = RULES[rule];
        for (const key of def.keys(ctx, sheet, v, me)) {
          if (!STORED_ONLY.has(rule)) {
            for (const f of file.get(fileKey(sheet, rule, key)) || []) {
              if (rule === 'vehicle' && !overlaps(f.period, { from: v.inceptionDate, to: v.expiryDate })) continue;
              if (rule === 'company-name' && f.hasTin && v.tin) continue;
              out.push({ rule, kind: 'file', sheet: f.sheet, row: f.row, number: f.number, name: f.name });
            }
          }
          const map = SHEET_STORED.has(rule) ? sheetMapOf(sheet, self.sheetRows) : await storedOf(rule);
          const list = map.get(key) || [];
          if (rule === 'policy-number' && me.insurer && list.some((m) => m.insurerId === me.insurer.id)) continue;
          for (const m of list) {
            if (!def.accept(m, ctx, sheet, v, me)) continue;
            out.push({ rule, kind: 'stored', recordId: m.recordId ?? null, number: m.number, name: m.name, ...(m.insurerCode ? { insurerCode: m.insurerCode } : {}) });
          }
        }
      }
      // one match per record and rule: an earlier row of the file that is the stored record itself counts once
      const stored = new Set(out.filter((m) => m.kind === 'stored').map((m) => `${m.rule}|${m.number}`));
      const seen = new Set();
      return out.filter((m) => {
        if (m.kind === 'file' && stored.has(`${m.rule}|${m.number}`)) return false;
        const k = `${m.rule}|${m.kind}|${m.recordId ?? m.row}|${m.number}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },
    remember(sheet, v, self = {}) {
      const me = { sameRecord: () => false, ...self };
      for (const rule of rulesOf(sheet)) {
        if (STORED_ONLY.has(rule)) continue;
        for (const key of RULES[rule].keys(ctx, sheet, v, me)) {
          push(file, fileKey(sheet, rule, key), { sheet: sheet.name, row: self.rowNumber ?? null, number: sheet.keyColumns.map((k) => v[k]).join(' / '),
            name: v.companyName || [v.firstName, v.lastName].filter(Boolean).join(' ') || v[sheet.nameColumn] || v.policyNumber || null,
            period: { from: v.inceptionDate, to: v.expiryDate }, hasTin: !!v.tin });
        }
      }
    },
  };
}

/** Text of a match for the errors workbook and the review: "Duplicate: Same TIN as client C-000881 (row 12)". */
export function matchText(m) {
  const where = m.kind === 'file' ? `row ${m.row}${m.sheet ? ` of ${m.sheet}` : ''}` : 'BrokerVerse';
  const what = m.name && m.name !== m.number ? `${m.number} (${m.name})` : m.number;
  return `Duplicate: ${RULE_LABELS[m.rule] || m.rule} as ${what}, ${where}`;
}
