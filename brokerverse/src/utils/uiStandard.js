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
Teams Slack Zoom Docker AWS Azure Bancnet BancNet Guidewire Sapiens SAP Fiori English Tagalog Thai Unicode Bureau Internal Revenue Insurance Commission`.split(/\s+/));

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

/** Keys of a bundle whose label is in Title Case, skipping the allowed keys (exact or prefixes ending in "."). */
export const titleCaseLabels = (bundle, allow = []) => flatten(bundle)
  .filter(([key]) => !allow.some((a) => key === a || (a.endsWith(".") && key.startsWith(a))))
  .filter(([, text]) => isTitleCaseLabel(text))
  .map(([key, text]) => `${key}: ${text}`);
