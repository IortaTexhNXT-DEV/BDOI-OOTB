/*
 * Lists translation keys used in src that are missing from src/locales/en.json (and, for
 * information, from th.json). A missing key without an inline default shows the raw key on screen;
 * one with a default (t("a.b", "Text")) shows the English default in every language.
 *
 *   node scripts/check-translations.js           report
 *   node scripts/check-translations.js --strict  exit with code 1 when en.json misses a key
 *   node scripts/check-translations.js --add-defaults  add missing keys that have an inline default to en.json
 *
 * Only literal keys are checked: t("a.b"), t('a.b'), i18n.t("a.b") and i18nKey="a.b". Keys built
 * at run time (t(`prefix.${name}`)) are listed by their static prefix and not checked.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const STRICT = process.argv.includes("--strict");
const ADD_DEFAULTS = process.argv.includes("--add-defaults");
const load = (lang) => JSON.parse(fs.readFileSync(path.join(SRC, "locales", `${lang}.json`), "utf8"));
const lookup = (dict, key) => key.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), dict) !== undefined;
// t("a.b", { count }) resolves to the plural forms a.b_one / a.b_other when a.b itself is absent
const has = (dict, key) => lookup(dict, key) || lookup(dict, `${key}_other`);

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listFiles(full);
    return /\.(js|jsx)$/.test(e.name) && !/\.test\.(js|jsx)$/.test(e.name) ? [full] : [];
  });
}

const en = load("en");
const th = load("th");
const used = new Map(); // key -> first "file:line"
const defaults = new Map(); // key -> inline default text
const dynamic = new Set();
const KEY = /(?:\bt|i18n\.t)\(\s*(["'])([A-Za-z0-9_.-]+)\1(?:\s*,\s*(["'])((?:(?!\3).)*)\3)?|i18nKey=(["'])([A-Za-z0-9_.-]+)\5/g;
const TEMPLATE = /(?:\bt|i18n\.t)\(\s*`([A-Za-z0-9_.-]*)\$\{/g;

for (const file of listFiles(SRC)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(KEY)) {
      const key = m[2] || m[6];
      if (m[4] && !defaults.has(key)) defaults.set(key, m[4]);
      if (key.includes(".") && !used.has(key)) used.set(key, `${path.relative(SRC, file)}:${i + 1}`);
    }
    for (const m of line.matchAll(TEMPLATE)) dynamic.add(m[1] || "(whole key)");
  });
}

const missingEn = [...used].filter(([key]) => !has(en, key));
const noDefault = missingEn.filter(([key]) => !defaults.has(key));
const missingTh = [...used].filter(([key]) => has(en, key) && !has(th, key));
console.log(`Literal keys used: ${used.size}. Keys built at run time (by prefix): ${dynamic.size}.`);
console.log(`\nMissing in en.json with an inline default (English shown in every language): ${missingEn.length - noDefault.length}`);
console.log(`Missing in en.json without a default (the raw key is shown): ${noDefault.length}`);
noDefault.forEach(([key, where]) => console.log(`  ${key}  ${where}`));
console.log(`\nIn en.json but missing in th.json (English is shown): ${missingTh.length}`);
if (ADD_DEFAULTS) {
  for (const [key] of missingEn) {
    if (!defaults.has(key)) continue;
    const parts = key.split(".");
    let node = en;
    for (const p of parts.slice(0, -1)) {
      if (node[p] === undefined) node[p] = {};
      node = typeof node[p] === "object" && node[p] !== null ? node[p] : null;
      if (!node) break; // a text value already sits where a section is needed
    }
    if (node) node[parts[parts.length - 1]] = defaults.get(key);
  }
  fs.writeFileSync(path.join(SRC, "locales", "en.json"), `${JSON.stringify(en, null, 2)}\n`);
  console.log("\nInline defaults added to en.json.");
}
if (STRICT && noDefault.length) process.exit(1);
