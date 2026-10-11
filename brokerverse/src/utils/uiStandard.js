/**
 * Rules of the UI standard (docs/developer-guide/ui-standard.md) that a machine can check, shared by the guard test
 * (uiStandard.test.js). Pure functions over text, so they run in Jest without a browser.
 */

/** Marketing adjectives and chatty phrases that do not belong in a back-office screen. */
export const BANNED_WORDS = ["seamless", "seamlessly", "powerful", "easily", "simply", "effortlessly", "effortless", "smart"];
export const BANNED_PHRASES = ["let's", "oops", "great!", "here you can", "awesome", "whoops"];

// pictographic emoji (not the arrows, dashes and symbols an amount or a chip may carry)
const EMOJI = /\p{Extended_Pictographic}/u;
const ALLOWED_SYMBOLS = /[©®™↑↓←→↔⇄✓✔✕✗✘★☆⚠ℹ]/gu;

/** Every string of a translation bundle with its dotted key. */
export const flatten = (node, prefix = "", out = []) => {
  if (typeof node === "string") out.push([prefix, node]);
  else if (node && typeof node === "object") Object.entries(node).forEach(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k, out));
  return out;
};

const words = (text) => String(text).toLowerCase().replace(/\{\{[^}]*\}\}/g, " ").split(/[^a-z'!]+/).filter(Boolean);

/** The problems of one UI string: [{ rule, detail }]. */
export const copyProblems = (text) => {
  const problems = [];
  const s = String(text);
  const plain = s.replace(/\{\{[^}]*\}\}/g, "").replace(/<[^>]+>/g, "");
  if (EMOJI.test(plain.replace(ALLOWED_SYMBOLS, ""))) problems.push({ rule: "emoji", detail: s });
  if (/!(\s|$)/.test(plain)) problems.push({ rule: "exclamation", detail: s });
  const ws = words(plain);
  BANNED_WORDS.forEach((w) => { if (ws.includes(w)) problems.push({ rule: "marketing", detail: w }); });
  const lower = plain.toLowerCase();
  BANNED_PHRASES.forEach((p) => { if (lower.includes(p)) problems.push({ rule: "chatty", detail: p }); });
  return problems;
};

/** The problems of a whole bundle, skipping the keys allowed by `allow` (exact keys or prefixes ending in "."). */
export const bundleProblems = (bundle, allow = []) => flatten(bundle)
  .filter(([key]) => !allow.some((a) => key === a || (a.endsWith(".") && key.startsWith(a))))
  .flatMap(([key, text]) => copyProblems(text).map((p) => ({ key, ...p })));

/** Source files that draw a raw file input (`type="file"`), an h1 or a native date / select control. */
export const sourceProblems = (file, source) => {
  const problems = [];
  if (/type=["']file["']/.test(source)) problems.push({ file, rule: "raw-file-input" });
  if (/<h1[\s>]/.test(source)) problems.push({ file, rule: "own-h1" });
  if (/type=["']date["']/.test(source)) problems.push({ file, rule: "native-date" });
  if (/<select[\s>]/.test(source)) problems.push({ file, rule: "native-select" });
  return problems;
};

/** Proper nouns that keep their capital inside a sentence-case label (names, products, months, organisations). */
export const PROPER_NOUNS = new Set(`Toyota Lexus Excel Microsoft Word PowerPoint Google Gmail Outlook Viber WhatsApp BrokerVerse Talkbot TechNXT Philippines
Philippine Filipino Manila Makati Cebu Davao Luzon Visayas Mindanao Metro January February March April May June July August September October November
December Monday Tuesday Wednesday Thursday Friday Saturday Sunday PhilHealth Pag IBIG GCash Maya PayMaya Visa Mastercard Amex AppSupport SharePoint
Teams Slack Zoom Docker AWS Azure Bancnet BancNet Guidewire Sapiens SAP Fiori English Tagalog Thai Unicode`.split(/\s+/));

const LABEL_WORD = /[A-Za-z][A-Za-z'’]*/g;
const SMALL_WORDS = new Set(["a", "an", "the", "of", "to", "for", "and", "or", "in", "on", "by", "with", "from", "per", "at", "vs", "as"]);
const keepsCapital = (w) => PROPER_NOUNS.has(w) || w === "I" || w === w.toUpperCase() || /\d/.test(w) || /[A-Z]/.test(w.slice(1));

/** True for a short label written in Title Case ("Sum Insured Amount") rather than sentence case ("Sum insured amount"). */
export const isTitleCaseLabel = (text) => {
  const plain = String(text).replace(/\{\{[^}]*\}\}|<[^>]+>|\$t\([^)]*\)/g, " ");
  const all = plain.match(LABEL_WORD) || [];
  if (all.length < 2 || all.length > 8) return false;
  if (/[.?]\s*$/.test(String(text).trim()) && all.length > 5) return false;
  // words after a sentence break, a colon, a dash or a breadcrumb arrow start again
  const rest = plain.split(/[.:!?]\s|\n|\s-\s|>/).flatMap((seg) => (seg.match(LABEL_WORD) || []).slice(1));
  const caps = rest.filter((w) => /^[A-Z]/.test(w) && !keepsCapital(w));
  const small = rest.filter((w) => /^[a-z]/.test(w) && !SMALL_WORDS.has(w));
  return caps.length >= 1 && caps.length > small.length;
};

/**
 * Named business documents and terms: always in Title Case, also inside a sentence-case label or message
 * ("Print the Placement Slip"). Plurals follow ("Official Receipts").
 */
export const NAMED_TERMS = [
  "Request for Quotation", "Placement Slip", "Quotation Slip", "Broker Slip", "Official Receipt", "Acknowledgement Receipt", "Provisional Receipt",
  "Collection Receipt", "Statement of Account", "Certificate of Cover", "Cover Note", "Policy Schedule", "Endorsement Slip", "Debit Note", "Credit Note",
  "Scheme Master", "Product Configurator", "Journal Voucher", "Payment Voucher", "Auto Renewal Agreement", "Placement Report", "Comparison Report",
  "Chart of Accounts", "Trial Balance", "General Ledger", "Bureau of Internal Revenue", "Insurance Commission",
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TERM_RE = new RegExp(`\\b(${NAMED_TERMS.map((n) => escapeRe(n).replace(/ /g, "\\s+")).join("|")})(s?)\\b`, "gi");

/** The text with every named term in its Title Case form. */
export const capitaliseTerms = (text) => String(text).replace(TERM_RE, (m, term, plural) => {
  const canonical = NAMED_TERMS.find((n) => n.toLowerCase() === term.toLowerCase().replace(/\s+/g, " "));
  return `${canonical}${plural}`;
});

const maskTerms = (text) => String(text).replace(TERM_RE, (m) => m.replace(/[A-Za-z]/g, "x"));

/**
 * Keys that name a place or a thing and so take Title Case (the client's two levels): menu items (sidebar.*,
 * sidebarFull.*), page and dialog titles, tab names and report names. Everything else is sentence case.
 */
export const TITLE_KEY_PREFIXES = ["sidebar.", "sidebarFull."];
const TITLE_SEGMENT = /^(title|heading|pageTitle|dialogTitle|screenTitle|[a-zA-Z]+Title)$/;
export const isTitleLevelKey = (key, titleKeys = new Set()) => titleKeys.has(key) || TITLE_KEY_PREFIXES.some((p) => key.startsWith(p))
  || TITLE_SEGMENT.test(key.split(".").pop()) || /\.tabs\.[^.]+$/.test(key);

const TITLE_TAGS = "TabPanel|AccordionTab|Dialog|DetailDialog|ImportDialog|PageHeader|ConfiguratorPage|LayoutPage|RecordPage|BankBatchDialog";
const TITLE_ATTR = new RegExp(`<(?:${TITLE_TAGS})\\b[^<>]*?\\b(?:title|header)=\\{\\s*t\\(\\s*["']([\\w.\\- &/]+)["']`, "g");

/** Translation keys a source file uses as a tab name, a page title or a dialog title. */
export const titleKeysOf = (source) => Array.from(String(source).matchAll(TITLE_ATTR), (m) => m[1]);

/** The title-level texts that are not Title Case ("Loan bookings upload" as a tab name). */
export const isTitleCase = (text) => {
  const plain = String(text).replace(/\{\{[^}]*\}\}|<[^>]+>|\$t\([^)]*\)/g, " ");
  const words = plain.match(LABEL_WORD) || [];
  if (words.length < 2 || words.length > 8 || /[.?!]\s*$/.test(String(text).trim())) return true;
  return words.slice(1).every((w) => /^[A-Z]/.test(w) || SMALL_WORDS.has(w) || keepsCapital(w));
};

/** Title Case for a title-level label: each word capitalised except the small words inside it. */
export const toTitleCase = (text) => {
  let first = true;
  return String(text).replace(/\{\{[^}]*\}\}|<[^>]+>|[A-Za-z][A-Za-z'’]*|[.:!?]\s|\s-\s|>/g, (tok) => {
    if (/^([.:!?]\s|\s-\s|>)$/.test(tok)) { first = true; return tok; }
    if (!/^[A-Za-z]/.test(tok)) return tok;
    const out = first || !SMALL_WORDS.has(tok.toLowerCase()) ? tok.charAt(0).toUpperCase() + tok.slice(1) : tok.toLowerCase();
    first = false;
    return out;
  });
};

/**
 * Case problems of a bundle: a title-level key (isTitleLevelKey) must be Title Case; any other label must be sentence
 * case, apart from proper nouns, acronyms and the named terms. `allow`: keys (or prefixes ending in ".") left out.
 */
/** A report name ("Premium Production Report", "Claims Register"): Title Case like a page title. */
export const isReportName = (key, text) => /^[A-Za-z][\w &/'’-]{2,60}\b(report|register|ledger|listing)s?$/i.test(String(text).trim())
  && !/(generat|fail|error|select|loading|no[A-Z]|empty)/.test(key.split(".").pop());

/**
 * A message headline (an error, empty-state, confirmation or toast title such as "This record could not be loaded",
 * "No records found", "Changes saved"): sentence case even under a title key. Known by its key or by reading as a
 * statement rather than a name.
 */
const MESSAGE_KEY = /(^|\.)(errors?|empty|toast|toasts|confirm|confirmation|notFound)(\.|$)|(error|empty|notFound|loadFailed|failed|success|saved|deleted|confirm|warning|noResults|noData|noRecords)[A-Z]?\w*Title$|^(error|empty|toast|confirm)/i;
const STATEMENT = /^(no|this|these|that|there|your|you|we|nothing|something)\b|\b(could|cannot|can't|couldn't|is|are|was|were|has|have|had|will|won't|not|been|did|does|do)\b|[.!?]$/i;
export const isMessageHeadline = (key, text) => MESSAGE_KEY.test(key) || STATEMENT.test(String(text).replace(/\{\{[^}]*\}\}/g, "").trim());

/** Sentence case: the first word and proper nouns, acronyms and named terms keep their capitals. */
export const toSentenceCase = (text) => {
  let first = true;
  const lowered = String(text).replace(/\{\{[^}]*\}\}|<[^>]+>|[A-Za-z][A-Za-z'’]*|[.:!?]\s|\s-\s|>/g, (tok) => {
    if (/^([.:!?]\s|\s-\s|>)$/.test(tok)) { first = true; return tok; }
    if (!/^[A-Za-z]/.test(tok)) return tok;
    const out = first || keepsCapital(tok) ? tok : tok.charAt(0).toLowerCase() + tok.slice(1);
    first = false;
    return out;
  });
  return capitaliseTerms(lowered);
};

export const isTitleLevel = (key, text, titleKeys = new Set()) => (isTitleLevelKey(key, titleKeys) || isReportName(key, text)) && !isMessageHeadline(key, text);

export const caseProblems = (bundle, titleKeys = new Set(), allow = []) => flatten(bundle)
  .filter(([key]) => !allow.some((a) => key === a || (a.endsWith(".") && key.startsWith(a))))
  .flatMap(([key, text]) => {
    if (isTitleLevel(key, text, titleKeys)) return isTitleCase(text) ? [] : [`${key}: not Title Case: ${text}`];
    if (isTitleCaseLabel(maskTerms(text))) return [`${key}: not sentence case: ${text}`];
    if (capitaliseTerms(text) !== text) return [`${key}: named term not in Title Case: ${text}`];
    return [];
  });

/** Kept for callers of the first version of the guard: the sentence-case problems only. */
export const titleCaseLabels = (bundle, allow = []) => caseProblems(bundle, new Set(), allow).filter((p) => p.includes("not sentence case"));
