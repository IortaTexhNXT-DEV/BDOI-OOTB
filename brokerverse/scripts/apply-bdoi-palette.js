/*
 * One-off codemod behind the BDOI theme: rewrites the colours and fonts that are hard-coded in
 * component stylesheets and inline styles under src/ to the BDO Style Guide palette and Nunito.
 * Safe to run again (already converted values are left alone). src/theme/bdoi is skipped.
 *
 *   node scripts/apply-bdoi-palette.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "src");
const skip = path.join(root, "theme", "bdoi");
// The System Settings colour presets are user choices, not theme values.
const keep = [path.join(root, "module", "SystemSettings", "index.js")];
const NUNITO_CSS = '"Nunito", Arial, sans-serif';
const NUNITO_JS = '"Nunito, Arial, sans-serif"';

const hexMap = {
  "#6366f1": "#0072d8", // indigo -> CTA Blue
  "#4f46e5": "#005fb4", // deep indigo -> CTA Blue hover
  "#4338ca": "#004ea8", // indigo text -> Header Blue
  "#c7d2fe": "#bfdcf2",
  "#e0e7ff": "#e5f5ff", // -> Background Blue
  "#eef2ff": "#eef8ff",
  "#0056b3": "#0072d8", // old BDO blue -> CTA Blue
  "#003d82": "#004ea8", // old BDO navy -> Header Blue
  "#0062ff": "#0072d8",
};
const hexRe = new RegExp(`(${Object.keys(hexMap).join("|")})(?![0-9a-f])`, "gi");

function convert(text, isStyle) {
  let out = text.replace(hexRe, (m) => hexMap[m.toLowerCase()]);
  out = out.replace(/rgba\(\s*99\s*,\s*102\s*,\s*241\s*,/g, "rgba(0, 114, 216,");
  // The old dark sidebar colour: white where it paints a background, near black where it is text.
  out = out
    .split("\n")
    .map((line) =>
      /#1c2536/i.test(line)
        ? line.replace(/#1c2536/gi, /background/i.test(line) ? "#ffffff" : "#2e2e2e")
        : line
    )
    .join("\n");
  if (isStyle) {
    out = out.replace(
      /font-family:\s*([^;{}\n]*?)(\s*!important)?\s*;/g,
      (m, value, imp) =>
        /poppins|inter/i.test(value) && !/nunito/i.test(value)
          ? `font-family: ${NUNITO_CSS}${imp || ""};`
          : m
    );
  } else {
    out = out.replace(/fontFamily:\s*(["'`])([^"'`\n]*)\1/g, (m, q, value) =>
      /poppins|inter/i.test(value) && !/nunito/i.test(value) ? `fontFamily: ${NUNITO_JS}` : m
    );
  }
  return out;
}

let changed = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (full === skip || keep.includes(full)) continue;
    if (entry.isDirectory()) walk(full);
    else if (/\.(s?css|jsx?|tsx?)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      const next = convert(text, /\.s?css$/.test(entry.name));
      if (next !== text) {
        fs.writeFileSync(full, next);
        changed += 1;
      }
    }
  }
})(root);
console.log(`apply-bdoi-palette: ${changed} files updated`);
