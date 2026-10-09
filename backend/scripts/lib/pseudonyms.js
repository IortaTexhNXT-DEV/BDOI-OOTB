/**
 * Deterministic pseudonyms for the client data masking tool (scripts/mask-data.js, docs/onboarding/DATA_MASKING.md).
 *
 * Every masked value is derived from the original with an HMAC-SHA256 keyed by a secret salt (MASK_SALT, never stored):
 * the same original gives the same masked value in every table, column and JSON document of a run (so joins, duplicate
 * checks and searches keep working), and without the salt the masked value cannot be traced back to the original.
 *
 * Masked values are recognisable, so the verification step can tell them from real data:
 *   e-mail           user<12 hex>@example.test                     (RFC 2606 reserved domain)
 *   mobile number    +63 900 ... / 0900 ...                        (network code 900, not issued to a PH network)
 *   TIN              999-###-###-000
 *   file name        masked-<8 hex>.<extension>
 */
import crypto from 'node:crypto';
import path from 'node:path';

export const FIRST_NAMES = [
  'Adelina', 'Alfredo', 'Alma', 'Amado', 'Analyn', 'Angelito', 'Antonio', 'Arnel', 'Aurora', 'Benjie', 'Bernadette', 'Bienvenido',
  'Carmelita', 'Cecilia', 'Celso', 'Conchita', 'Corazon', 'Crisanto', 'Danilo', 'Delia', 'Dionisio', 'Dolores', 'Edgardo', 'Editha',
  'Efren', 'Elmer', 'Emerita', 'Ernesto', 'Estela', 'Eugenio', 'Felicidad', 'Fernando', 'Florante', 'Gemma', 'Generoso', 'Gerardo',
  'Gloria', 'Gregorio', 'Herminio', 'Imelda', 'Isidro', 'Jaime', 'Jennylyn', 'Jerome', 'Jocelyn', 'Joel', 'Jonalyn', 'Josefina',
  'Jovito', 'Leonora', 'Leticia', 'Lorenzo', 'Lourdes', 'Luzviminda', 'Mailene', 'Marilou', 'Marites', 'Marlon', 'Melchor', 'Merlinda',
  'Milagros', 'Narciso', 'Nelia', 'Nestor', 'Noel', 'Norberto', 'Ofelia', 'Orlando', 'Pacita', 'Perla', 'Primitivo', 'Purita',
  'Rachelle', 'Reynaldo', 'Rhodora', 'Rodel', 'Rogelio', 'Romeo', 'Rosalie', 'Rosario', 'Ruben', 'Rodrigo', 'Salvacion', 'Sherwin',
  'Socorro', 'Teodoro', 'Teresita', 'Virgilio', 'Wilfredo', 'Zenaida', 'Arlene', 'Bayani', 'Dalisay', 'Ligaya', 'Mayumi', 'Tala',
  'Liwayway', 'Dakila', 'Makisig', 'Lualhati', 'Jomar', 'Kristel', 'Princess', 'Mark Anthony', 'John Paul', 'Mary Grace', 'Jhun',
  'Rowena', 'Eduardo', 'Ricardo', 'Lorna', 'Remedios', 'Wilma', 'Marivic', 'Charmaine', 'Rommel', 'Dennis', 'Ariel', 'Ronaldo',
];
export const LAST_NAMES = [
  'Abad', 'Agbayani', 'Alcantara', 'Alvarado', 'Arceo', 'Bacani', 'Balagtas', 'Baltazar', 'Banaag', 'Bautista', 'Bernabe', 'Buenaventura',
  'Cabrera', 'Calderon', 'Castillo', 'Catapang', 'Concepcion', 'Cuenca', 'Dagohoy', 'Dalisay', 'Datu', 'De Guzman', 'De Leon', 'Del Mundo',
  'Dimaculangan', 'Dimagiba', 'Domingo', 'Dumalagan', 'Enriquez', 'Esguerra', 'Espiritu', 'Estrella', 'Fajardo', 'Feliciano', 'Galang',
  'Gatchalian', 'Hernandez', 'Ilagan', 'Javier', 'Labrador', 'Lacson', 'Lagman', 'Lapid', 'Lualhati', 'Mabini', 'Macaraeg', 'Magbanua',
  'Malonzo', 'Manalastas', 'Manalo', 'Manansala', 'Mangubat', 'Marasigan', 'Matias', 'Medina', 'Mendoza', 'Monserrat', 'Natividad',
  'Ocampo', 'Ong', 'Pacquiao', 'Padilla', 'Pagdanganan', 'Palad', 'Panganiban', 'Pascual', 'Perez', 'Pineda', 'Quiambao', 'Quijano',
  'Ramirez', 'Ramos', 'Reyes', 'Rivera', 'Robles', 'Roque', 'Rosales', 'Sabado', 'Salazar', 'Salonga', 'Samonte', 'San Pedro', 'Santiago',
  'Saragena', 'Sarmiento', 'Silang', 'Sison', 'Soliman', 'Sumulong', 'Tagle', 'Tamayo', 'Tolentino', 'Torres', 'Valdez', 'Valenzuela',
  'Velasco', 'Ventura', 'Vergara', 'Yap', 'Yulo', 'Zamora', 'Zabala', 'Agustin', 'Bonifacio', 'Cajucom', 'Dizon', 'Evangelista',
  'Flores', 'Gonzaga', 'Lim', 'Macapagal', 'Nepomuceno', 'Orosa', 'Punzalan', 'Quintos', 'Sandoval', 'Tiongson', 'Umali', 'Villareal',
];
const COMPANY_WORDS = [
  'Bayanihan', 'Mabuhay', 'Kalayaan', 'Silangan', 'Kanluran', 'Hilaga', 'Timog', 'Malaya', 'Liwanag', 'Tagumpay', 'Pag-asa', 'Bituin',
  'Dalampasigan', 'Bagwis', 'Sampaguita', 'Narra', 'Molave', 'Yakal', 'Kamagong', 'Ilang-Ilang', 'Banaue', 'Mayon', 'Taal', 'Apo',
  'Pinatubo', 'Pasig', 'Agos', 'Alon', 'Bukid', 'Bundok', 'Dagat', 'Habagat', 'Amihan', 'Araw', 'Buwan', 'Haraya', 'Diwa', 'Galing',
  'Husay', 'Sikat', 'Tibay', 'Lakas', 'Ganda', 'Sinag', 'Tanglaw', 'Ugnayan', 'Bigkis', 'Kaagapay', 'Masagana', 'Masigla',
];
const COMPANY_KINDS = ['Trading', 'Enterprises', 'Holdings', 'Industries', 'Ventures', 'Resources', 'Merchandising', 'Development', 'Logistics', 'Foods'];
const STREETS = [
  'Mabini', 'Rizal', 'Bonifacio', 'Luna', 'Del Pilar', 'Burgos', 'Aguinaldo', 'Jacinto', 'Silang', 'Sampaguita', 'Narra', 'Molave',
  'Ilang-Ilang', 'Kamagong', 'Dama de Noche', 'Gumamela', 'Acacia', 'Mangga', 'Santol', 'Kalachuchi', 'Waling-Waling', 'Katipunan',
  'Malvar', 'Panday Pira', 'Lakandula', 'Soliman', 'Dagohoy', 'Lapu-Lapu', 'Kalantiaw', 'Balagtas',
];
const STREET_KINDS = ['St.', 'Street', 'Ave.', 'Road', 'Extension'];
const BARANGAYS = [
  'San Isidro', 'San Jose', 'Poblacion', 'Santo Nino', 'San Roque', 'Bagong Silang', 'Malanday', 'San Antonio', 'Santa Cruz', 'Mabolo',
  'Bagumbayan', 'San Vicente', 'Maligaya', 'Masagana', 'Pag-asa', 'Bagong Pag-asa', 'San Rafael', 'Santa Lucia', 'Burol', 'Kanluran',
];
const LOCALITIES = [
  { city: 'Lipa City', province: 'Batangas', zip: '4217' }, { city: 'Tarlac City', province: 'Tarlac', zip: '2300' },
  { city: 'Naga City', province: 'Camarines Sur', zip: '4400' }, { city: 'Roxas City', province: 'Capiz', zip: '5800' },
  { city: 'Tagbilaran City', province: 'Bohol', zip: '6300' }, { city: 'Dipolog City', province: 'Zamboanga del Norte', zip: '7100' },
  { city: 'Malaybalay City', province: 'Bukidnon', zip: '8700' }, { city: 'Laoag City', province: 'Ilocos Norte', zip: '2900' },
  { city: 'Calapan City', province: 'Oriental Mindoro', zip: '5200' }, { city: 'Tacloban City', province: 'Leyte', zip: '6500' },
];

/** Words of a name that are kept as they are (particles, titles, suffixes): they do not identify anybody. */
const PARTICLES = new Set(['de', 'del', 'dela', 'delos', 'la', 'las', 'los', 'san', 'santa', 'santo', 'sta', 'sto', 'y', 'van', 'von', 'da', 'di',
  'jr', 'sr', 'ii', 'iii', 'iv', 'ma', 'mr', 'mrs', 'ms', 'miss', 'dr', 'atty', 'engr', 'arch', 'hon', 'rev', 'fr', 'sis', 'bro']);
/** Words that are never treated as a name in free text (common words, months, insurance terms), even when somebody bears them. */
const STOPWORDS = new Set(`the and for with from that this have has was were are not but you your our their his her its who whom which what when where
why how all any each few more most other some such only own same than too very can will just don should now also into over under after before
between out off again further then once here there both until while about against during above below upon per via may june july april march
august january february september october november december monday tuesday wednesday thursday friday saturday sunday new old good great grace
hope joy faith love rose star king queen prince lord city town street road avenue village subdivision building tower unit floor block lot phase
policy premium motor fire life insurance insured client clients company corporation inc corp ltd trading bank branch office head main north
south east west upper lower general insurer broker agent payment receipt claim claims renewal quote quotation lead endorsement amount total net
gross balance due date paid unpaid cash check cheque transfer deposit refund commission tax vat ewt dst lgt fst account accounts journal entry
masked test example user admin system sample data note notes remarks walk caller unknown anonymous anonymised anonymized prospect
customer guest sales direct online referral office unit team desk department division section house executive manager officer staff
operations ops finance accounting underwriting underwriter marketing service services support help helpdesk centre center region regional
area national provincial private public government holdings family`.split(/\s+/));
/** Company legal forms and generic business words kept at the end of a masked company name. */
const COMPANY_SUFFIX = new Set(['inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'opc', 'llc', 'plc', 'enterprises',
  'enterprise', 'trading', 'holdings', 'group', 'industries', 'services', 'cooperative', 'coop', 'association', 'foundation', 'realty',
  'development', 'motors', 'marketing', 'ventures', 'resources', 'systems', 'solutions', 'partners', 'and', 'sons', 'philippines', 'phils',
  'phil', 'foods', 'food', 'manufacturing', 'construction', 'logistics', 'transport', 'farms', 'hospital', 'clinic', 'school', 'college',
  'store', 'stores', 'mart', 'bakeshop', 'restaurant', 'hardware', 'pharmacy', 'agency', 'lending', 'finance', 'merchandising', 'international']);
/** A name that is a company (legal form or business word) rather than a person. */
export const COMPANY_RE = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|opc|llc|enterprises?|trading|holdings|group|industries|services|cooperative|coop|association|foundation|realty|development|motors|marketing|ventures|resources|systems|solutions|partners|insurance|agency|bank|lending|finance|foods?|manufacturing|construction|logistics|hospital|school|college|university|store|mart|bakeshop|restaurant|hardware|pharmacy|merchandising)\b\.?/i;

export const MASKED_EMAIL_DOMAIN = 'example.test';
export const MASKED_MOBILE_NETWORK = '900';
export const MASKED_TIN_PREFIX = '999';
export const MASKED_TEXT = '[masked]';

/** Patterns of personal data in free text: also used by the verification step. */
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// A mobile number stands on its own: a digit run glued to letters or an underscore is part of an identifier (pol_0991234567ab)
export const MOBILE_RE = /(?<![\w+])(?:\+?63|0)[\s.-]?\(?9\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\w)/g;
export const TIN_RE = /(?<![\d-])\d{3}[- ]\d{3}[- ]\d{3}(?:[- ]\d{3,5})?(?![\d-])/g;
const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}]+)*/gu;

/** Lower-case, accents removed, single spaces: the key under which a value is pseudonymised. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const digitsOf = (s) => String(s).replace(/\D/g, '');
const isMaskedEmail = (s) => norm(s).endsWith(`@${MASKED_EMAIL_DOMAIN}`);
/** True when a mobile number found by MOBILE_RE is a masked one (network code 900). */
export const isMaskedMobile = (s) => /^(?:63|0)?900/.test(digitsOf(s));
export const isMaskedTin = (s) => digitsOf(s).startsWith(MASKED_TIN_PREFIX);

function applyCase(original, replacement) {
  if (original.length > 1 && original === original.toUpperCase() && original !== original.toLowerCase()) return replacement.toUpperCase();
  if (original === original.toLowerCase() && original !== original.toUpperCase()) return replacement.toLowerCase();
  return replacement;
}

/** Write new digits (and letters) into the positions of the original, keeping separators and length. */
function reshape(original, nextDigit, nextLetter, keepLast = 0) {
  const chars = [...String(original)];
  const alnumIdx = chars.map((c, i) => (/[A-Za-z0-9]/.test(c) ? i : -1)).filter((i) => i >= 0);
  const keep = new Set(keepLast ? alnumIdx.slice(-keepLast) : []);
  return chars.map((c, i) => {
    if (keep.has(i)) return c;
    if (/[0-9]/.test(c)) return nextDigit();
    if (/[A-Z]/.test(c)) return nextLetter().toUpperCase();
    if (/[a-z]/.test(c)) return nextLetter();
    return c;
  }).join('');
}

/** Rename the file part of a storage key (folder/<time>-<nonce>-<file name>) so the original file name does not remain. */
export function storageKeyPattern(folders) {
  const f = folders.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(${f})/(\\d{10,}-[0-9a-f]{8,})-([A-Za-z0-9._-]+)`, 'g');
}

export class Masker {
  /**
   * salt: the secret (MASK_SALT). maskStaff: also mask names and e-mail addresses of the broker's staff. keepLocality: keep
   * city, province, postal code and country of addresses (else replaced by a fake locality). referenceDate: the date at
   * which masked dates of birth give the same age as the originals. fileFolders: storage folders of client files.
   */
  constructor({ salt, maskStaff = false, keepLocality = true, referenceDate = new Date(), fileFolders = [] }) {
    if (!salt || String(salt).length < 16) throw new Error('MASK_SALT must be at least 16 characters');
    this.salt = String(salt);
    this.maskStaff = maskStaff;
    this.keepLocality = keepLocality;
    this.ref = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
    this.firstTokens = new Set();
    this.personTokens = new Set();
    this.companyPhrases = new Map();
    this.maxPhrase = 1;
    this.keptEmails = new Set();
    this.institutions = new Set();
    this.allocated = new Map();
    this.keyRe = fileFolders.length ? storageKeyPattern(fileFolders) : null;
  }

  hmac(kind, value) {
    return crypto.createHmac('sha256', this.salt).update(`${kind}\u0000${value}`).digest();
  }

  /** A deterministic integer in [0, mod). */
  pick(kind, value, mod) {
    return this.hmac(kind, value).readUInt32BE(0) % mod;
  }

  /** Deterministic digit and letter streams for a value. */
  streams(kind, value) {
    let block = 0;
    let buf = Buffer.alloc(0);
    let pos = 0;
    const byte = () => {
      if (pos >= buf.length) { buf = this.hmac(`${kind}#${block++}`, value); pos = 0; }
      return buf[pos++];
    };
    return { digit: () => String(byte() % 10), letter: () => String.fromCharCode(97 + (byte() % 26)) };
  }

  /**
   * Injective allocation: a different original never gets the same masked value of this kind (unique columns,
   * duplicate checks). gen(attempt) proposes a candidate.
   */
  alloc(kind, key, gen) {
    let m = this.allocated.get(kind);
    if (!m) { m = { byKey: new Map(), used: new Set() }; this.allocated.set(kind, m); }
    const hit = m.byKey.get(key);
    if (hit !== undefined) return hit;
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const c = gen(attempt);
      if (!m.used.has(c)) { m.used.add(c); m.byKey.set(key, c); return c; }
    }
    throw new Error(`no free masked value for ${kind}`);
  }

  // ---------------------------------------------------------------- collection (before masking)
  /** Remember an original value so free text that repeats it is masked too. */
  register(rule, value) {
    if (value == null || value === '') return;
    const s = String(value);
    if (this.isInstitution(s)) return;
    if (rule === 'firstName') for (const t of s.match(WORD_RE) || []) this.firstTokens.add(norm(t));
    if (rule === 'companyName' || (rule === 'partyName' && COMPANY_RE.test(s))) {
      this.addCompanyPhrase(s);
      return;
    }
    if (['firstName', 'lastName', 'personName', 'partyName'].includes(rule)) {
      // "Juan Dela Cruz": the first word is a first name; "Dela Cruz, Juan": the first word after the comma
      if (rule !== 'lastName') {
        const given = (s.includes(',') ? s.slice(s.indexOf(',') + 1) : s).match(WORD_RE)?.find((t) => !PARTICLES.has(norm(t)));
        if (given && (rule !== 'firstName')) this.firstTokens.add(norm(given));
      }
      for (const t of s.match(WORD_RE) || []) {
        const k = norm(t);
        if (k.length >= 3 && !/\d/.test(k) && !PARTICLES.has(k) && !STOPWORDS.has(k)) this.personTokens.add(k);
      }
    }
  }

  /** Institutions (insurers, banks, the broker itself) are not personal data: their names are kept. */
  addInstitution(name) {
    const k = (String(name ?? '').match(WORD_RE) || []).map(norm).join(' ');
    if (k) this.institutions.add(k);
  }

  isInstitution(s) {
    return this.institutions.size > 0 && this.institutions.has((String(s).match(WORD_RE) || []).map(norm).join(' '));
  }

  addCompanyPhrase(s) {
    const words = (s.match(WORD_RE) || []).map(norm);
    if (!words.length) return;
    const full = words.join(' ');
    this.companyPhrases.set(full, { canonical: s, core: false });
    this.maxPhrase = Math.max(this.maxPhrase, words.length);
    // the name without its legal form ("Kalayaan Foods" for "Kalayaan Foods Corp.")
    let end = words.length;
    while (end > 0 && COMPANY_SUFFIX.has(words[end - 1])) end -= 1;
    const core = words.slice(0, end);
    if (core.length && core.length < words.length && (core.length > 1 || core[0].length >= 5) && !STOPWORDS.has(core.join(' '))) {
      if (!this.companyPhrases.has(core.join(' '))) this.companyPhrases.set(core.join(' '), { canonical: s, core: true });
    }
  }

  // ---------------------------------------------------------------- names
  nameToken(tok) {
    const k = norm(tok);
    if (PARTICLES.has(k) || !k) return tok;
    if (/^\d+$/.test(k)) return tok;
    if (k.length === 1) return applyCase(tok, String.fromCharCode(65 + this.pick('initial', k, 26)));
    const list = this.firstTokens.has(k) ? FIRST_NAMES : LAST_NAMES;
    let i = this.pick('name', k, list.length);
    if (norm(list[i]) === k) i = (i + 1) % list.length;
    return applyCase(tok, list[i]);
  }

  /** A person's name, word by word: the same word gets the same pseudonym in every field ("Juan" in first name and display name). */
  personName(v) {
    if (v == null || v === '') return v;
    return String(v).replace(WORD_RE, (t) => this.nameToken(t));
  }

  /** { core, suffix } of a masked company name: core is the pseudonym, suffix the legal form kept from the original. */
  companyParts(v) {
    const s = String(v);
    const tokens = s.trim().split(/\s+/);
    let end = tokens.length;
    while (end > 0 && COMPANY_SUFFIX.has(norm(tokens[end - 1]).replace(/[^a-z]/g, ''))) end -= 1;
    const suffix = tokens.slice(end).join(' ');
    const key = (s.match(WORD_RE) || []).map(norm).join(' ') || norm(s);
    const core = this.alloc('company', key, (a) => {
      const i = this.pick(`company:${a}`, key, COMPANY_WORDS.length);
      let j = this.pick(`company2:${a}`, key, COMPANY_WORDS.length);
      if (j === i) j = (j + 1) % COMPANY_WORDS.length;
      const k = this.pick(`company3:${a}`, key, COMPANY_KINDS.length);
      return `${COMPANY_WORDS[i]} ${COMPANY_WORDS[j]}${suffix ? '' : ` ${COMPANY_KINDS[k]}`}`;
    });
    return { core, suffix, upper: s.replace(/[^A-Za-z]/g, '') };
  }

  companyName(v) {
    if (v == null || v === '' || this.isInstitution(v)) return v;
    const { core, suffix, upper } = this.companyParts(v);
    return applyCase(upper, suffix ? `${core} ${suffix}` : core);
  }

  /** A person or a company: companies by their legal form, or because they were seen as a company name. */
  partyName(v) {
    if (v == null || v === '' || this.isInstitution(v)) return v;
    const s = String(v);
    const key = (s.match(WORD_RE) || []).map(norm).join(' ');
    if (this.companyPhrases.has(key) || COMPANY_RE.test(s)) return this.companyName(s);
    return this.personName(s);
  }

  // ---------------------------------------------------------------- contact details and identifiers
  email(v) {
    if (v == null || v === '') return v;
    const s = norm(v);
    if (isMaskedEmail(s) || this.keptEmails.has(s)) return v;
    return `user${this.hmac('email', s).toString('hex').slice(0, 12)}@${MASKED_EMAIL_DOMAIN}`;
  }

  /** E-mail addresses in a value; a recipient of an SMS or Viber message (the "to" of an integration payload) is a mobile number, masked as one. */
  emailList(v) {
    if (v == null || v === '') return v;
    return String(v).replace(EMAIL_RE, (m) => this.email(m)).replace(MOBILE_RE, (m) => (isMaskedMobile(m) ? m : this.phone(m)));
  }

  phone(v) {
    if (v == null || v === '') return v;
    const s = String(v);
    const d = digitsOf(s);
    if (!d) return s;
    if (d.length > 13) return s.replace(MOBILE_RE, (m) => this.phone(m)).replace(/\d{3,}/g, (m) => this.digits('phone', m));
    const mobile = d.match(/^(63|0)?9(\d{2})(\d{7})$/);
    if (mobile) {
      if (mobile[2] === '00') return s;
      const prefix = mobile[1] || '';
      const tail = this.alloc('mobile', d.slice(prefix.length), (a) => {
        const st = this.streams(`mobile:${a}`, d.slice(prefix.length));
        return Array.from({ length: 7 }, st.digit).join('');
      });
      const nd = [...`${prefix}9${MASKED_MOBILE_NETWORK.slice(1)}${tail}`];
      let i = 0;
      return s.replace(/\d/g, () => nd[i++]);
    }
    const keep = d.length > 7 ? 3 : 0;
    const st = this.streams('phone', d);
    let i = 0;
    return s.replace(/\d/g, (c) => (i++ < keep ? c : st.digit()));
  }

  digits(kind, v) {
    const st = this.streams(kind, v);
    return String(v).replace(/\d/g, () => st.digit());
  }

  tin(v) {
    if (v == null || v === '') return v;
    const s = String(v);
    const d = digitsOf(s);
    if (!d) return MASKED_TEXT;
    if (isMaskedTin(s)) return s;
    const base = this.alloc('tin', d.slice(0, 9), (a) => {
      const st = this.streams(`tin:${a}`, d.slice(0, 9));
      return Array.from({ length: 6 }, st.digit).join('');
    });
    return `${MASKED_TIN_PREFIX}-${base.slice(0, 3)}-${base.slice(3)}-000`;
  }

  /** Format-preserving replacement of an identifier: digits stay digits, letters stay letters, separators stay. */
  identifier(kind, v, keepLast = 0) {
    if (v == null || v === '') return v;
    const s = String(v);
    const st = this.streams(kind, norm(s));
    let out = reshape(s, st.digit, st.letter, keepLast);
    if (out === s && /[A-Za-z0-9]/.test(s)) out = reshape(s, () => String((Number(st.digit()) + 1) % 10), st.letter, keepLast);
    // an identifier written like a TIN or a mobile number gets the recognisable masked form of one
    if (!keepLast && new RegExp(`^${TIN_RE.source}$`).test(out)) out = out.replace(/^\d{3}/, MASKED_TIN_PREFIX);
    if (!keepLast && new RegExp(`^${MOBILE_RE.source}$`).test(out)) out = this.phone(s);
    return out;
  }

  idNumber(v) { return this.identifier('id', v); }

  plate(v) { return this.identifier('plate', v); }

  chassis(v) { return this.identifier('chassis', v); }

  engine(v) { return this.identifier('engine', v); }

  bankAccount(v) { return this.identifier('bank', v, 4); }

  houseNo(v) { return this.identifier('house', v); }

  // ---------------------------------------------------------------- addresses and dates
  streetLine(key) {
    const n = 1 + this.pick('house', key, 899);
    return `${n} ${STREETS[this.pick('street', key, STREETS.length)]} ${STREET_KINDS[this.pick('streetkind', key, STREET_KINDS.length)]}`;
  }

  /** A street line (house number, street, building): replaced completely. */
  street(v) {
    if (v == null || v === '') return v;
    return this.streetLine(norm(v));
  }

  /**
   * A one-line address: a fake street; with keepLocality the trailing city / province part (the last one or two
   * comma-separated parts without digits, never the first part) is kept, else a fake locality is used.
   */
  address(v) {
    if (v == null || v === '') return v;
    const s = String(v);
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
    const street = this.streetLine(norm(s));
    if (!this.keepLocality) {
      const loc = LOCALITIES[this.pick('locality', norm(s), LOCALITIES.length)];
      return parts.length > 1 ? `${street}, ${loc.city}, ${loc.province}` : street;
    }
    const tail = [];
    for (let i = parts.length - 1; i >= 1 && tail.length < 2; i -= 1) {
      if (/\d/.test(parts[i])) break;
      tail.unshift(parts[i]);
    }
    return [street, ...tail].join(', ');
  }

  barangay(v) {
    if (v == null || v === '') return v;
    const s = String(v);
    const b = BARANGAYS[this.pick('barangay', norm(s), BARANGAYS.length)];
    return /^\s*(brgy|bgy|barangay)\b\.?/i.test(s) ? `Brgy. ${b}` : b;
  }

  /** City, province, postal code: kept, unless keepLocality is off (then a fake locality of the same kind). */
  locality(v, kind = 'city') {
    if (v == null || v === '' || this.keepLocality) return v;
    const loc = LOCALITIES[this.pick('locality', norm(v), LOCALITIES.length)];
    return kind === 'province' ? loc.province : kind === 'postal' ? loc.zip : loc.city;
  }

  /**
   * A date of birth moved to another day such that the age on the reference date (the masking date) is the same:
   * age bands, age-based rating and minimum-age checks behave as before. Accepts YYYY-MM-DD, an ISO date-time or a
   * Date; returns the same form (YYYY-MM-DD for a date). Unreadable text becomes [masked].
   */
  dob(v) {
    if (v == null || v === '') return v;
    let iso;
    let suffix = '';
    if (v instanceof Date) iso = v.toISOString().slice(0, 10);
    else {
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
      if (!m) return MASKED_TEXT;
      iso = `${m[1]}-${m[2]}-${m[3]}`;
      suffix = m[4] ? m[4] : '';
    }
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return MASKED_TEXT;
    const ref = this.ref;
    let age = ref.getUTCFullYear() - d.getUTCFullYear();
    if (ref.getUTCMonth() < d.getUTCMonth() || (ref.getUTCMonth() === d.getUTCMonth() && ref.getUTCDate() < d.getUTCDate())) age -= 1;
    let out;
    if (age < 0) {
      out = new Date(d.getTime() + (1 + this.pick('dob', iso, 60)) * 86400000);
    } else {
      // born after ref - (age + 1) years and on or before ref - age years
      const latest = new Date(Date.UTC(ref.getUTCFullYear() - age, ref.getUTCMonth(), ref.getUTCDate()));
      const earliest = new Date(Date.UTC(ref.getUTCFullYear() - age - 1, ref.getUTCMonth(), ref.getUTCDate() + 1));
      const span = Math.round((latest - earliest) / 86400000) + 1;
      let k = this.pick('dob', iso, span);
      out = new Date(earliest.getTime() + k * 86400000);
      if (out.toISOString().slice(0, 10) === iso) {
        k = (k + 1 + this.pick('dob2', iso, span - 1)) % span;
        out = new Date(earliest.getTime() + k * 86400000);
      }
    }
    const res = out.toISOString().slice(0, 10);
    return v instanceof Date ? new Date(`${res}T00:00:00Z`) : `${res}${suffix && /^T/.test(suffix) ? 'T00:00:00.000Z' : ''}`;
  }

  // ---------------------------------------------------------------- other
  freeText(v) {
    if (v == null || String(v).trim() === '') return v;
    return MASKED_TEXT;
  }

  fileName(v) {
    if (v == null || v === '') return v;
    const s = String(v);
    if (/^masked-[0-9a-f]{8}/.test(s)) return s;
    const ext = path.extname(s).slice(0, 10).replace(/[^A-Za-z0-9.]/g, '');
    return `masked-${this.hmac('file', s).toString('hex').slice(0, 8)}${ext}`;
  }

  /** The storage key with its file part replaced (folder/<time>-<nonce>-masked-<hash>.<ext>); other keys unchanged. */
  storageKey(v) {
    if (v == null || v === '' || !this.keyRe) return v;
    return String(v).replace(this.keyRe, (m, folder, stamp, file) => (file.startsWith('masked-') ? m : `${folder}/${stamp}-${this.fileName(file)}`));
  }

  ip(v) {
    if (v == null || v === '') return v;
    const s = String(v);
    if (s.includes(':') && !s.includes('.')) return `2001:db8::${this.hmac('ip', s).toString('hex').slice(0, 4)}`;
    return `192.0.2.${1 + this.pick('ip', s, 254)}`;
  }

  /** E-mail address, phone number or name, whichever the value is. */
  contact(v) {
    if (v == null || v === '') return v;
    const s = String(v);
    if (s.includes('@')) return this.emailList(s).replace(MOBILE_RE, (m) => this.phone(m));
    if (digitsOf(s).length >= 7) return this.phone(s);
    return this.partyName(s);
  }

  /**
   * Free text kept readable: storage keys renamed, e-mail addresses, mobile numbers and TINs replaced, and (names on)
   * every known client name (collected from the catalogued name columns) replaced by its pseudonym.
   */
  scrub(v, { names = true } = {}) {
    if (v == null || v === '') return v;
    let s = this.storageKey(String(v));
    s = s.replace(EMAIL_RE, (m) => this.email(m));
    s = s.replace(MOBILE_RE, (m) => (isMaskedMobile(m) ? m : this.phone(m)));
    s = s.replace(TIN_RE, (m) => (isMaskedTin(m) ? m : this.tin(m)));
    if (!names || (!this.personTokens.size && !this.companyPhrases.size)) return s;
    return this.replaceNames(s);
  }

  replaceNames(s) {
    const words = [];
    for (const m of s.matchAll(WORD_RE)) words.push({ text: m[0], start: m.index, end: m.index + m[0].length, key: norm(m[0]) });
    if (!words.length) return s;
    // skip words inside e-mail addresses and masked values (already replaced)
    const protectedSpans = [...s.matchAll(EMAIL_RE)].map((m) => [m.index, m.index + m[0].length])
      .concat([...s.matchAll(/masked-[0-9a-f]{8}[A-Za-z0-9.]*/g)].map((m) => [m.index, m.index + m[0].length]));
    const isProtected = (w) => protectedSpans.some(([a, b]) => w.start >= a && w.end <= b);
    let out = '';
    let last = 0;
    for (let i = 0; i < words.length;) {
      const w = words[i];
      if (isProtected(w)) { i += 1; continue; }
      let matched = 0;
      if (this.companyPhrases.size) {
        for (let n = Math.min(this.maxPhrase, words.length - i); n >= 1; n -= 1) {
          let ok = true;
          for (let j = i + 1; j < i + n; j += 1) if (!/^[\s,.&-]{0,3}$/.test(s.slice(words[j - 1].end, words[j].start))) { ok = false; break; }
          if (!ok) continue;
          const key = words.slice(i, i + n).map((x) => x.key).join(' ');
          if (this.companyPhrases.has(key)) { matched = n; break; }
        }
      }
      if (matched) {
        const span = s.slice(w.start, words[i + matched - 1].end);
        const phrase = this.companyPhrases.get(words.slice(i, i + matched).map((x) => x.key).join(' '));
        const masked = phrase.core ? applyCase(span.replace(/[^A-Za-z]/g, ''), this.companyParts(phrase.canonical).core) : this.companyName(phrase.canonical);
        const value = phrase.core ? masked : applyCase(span.replace(/[^A-Za-z]/g, ''), masked);
        out += s.slice(last, w.start) + value;
        last = words[i + matched - 1].end;
        if (value.endsWith('.') && s[last] === '.') last += 1;
        i += matched;
        continue;
      }
      if (this.personTokens.has(w.key)) {
        out += s.slice(last, w.start) + this.nameToken(w.text);
        last = w.end;
      }
      i += 1;
    }
    return out + s.slice(last);
  }
}
