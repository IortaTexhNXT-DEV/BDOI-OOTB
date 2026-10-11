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
