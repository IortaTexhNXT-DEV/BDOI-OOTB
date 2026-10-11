/**
 * Guard of the UI standard (docs/developer-guide/ui-standard.md): fails when a screen brings back a browser file
 * input, its own h1, a native date or select control, or when en.json gains emojis, exclamation marks, marketing
 * adjectives or chatty phrases. Justified exceptions live in uiStandard.allow.json with their reason.
 */
import fs from "fs";
import path from "path";
import { bundleProblems, copyProblems, isTitleCaseLabel, sourceProblems, titleCaseLabels } from "./uiStandard";
import allow from "./uiStandard.allow.json";

const SRC = path.join(__dirname, "..");

const listFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === "node_modules" ? [] : listFiles(full);
  return /\.(js|jsx)$/.test(e.name) && !/\.test\.(js|jsx)$/.test(e.name) ? [full] : [];
});

const allowed = (file, rule) => allow.files.some((a) => a.file === file && a.rule === rule);

describe("UI standard guard", () => {
  const files = listFiles(SRC).filter((f) => !f.endsWith(path.join("utils", "uiStandard.js")));
  const found = files.flatMap((f) => {
    const rel = path.relative(SRC, f).split(path.sep).join("/");
    // comments may name the controls they replace
    const source = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    return sourceProblems(rel, source);
  });

  it("finds no browser file input, own h1, native date or native select outside the allow-list", () => {
    const problems = found.filter((p) => !allowed(p.file, p.rule)).map((p) => `${p.file}: ${p.rule}`);
    expect(problems).toEqual([]);
  });

  it("keeps the allow-list current (every entry still needed, every reason given)", () => {
    const stale = allow.files.filter((a) => !found.some((p) => p.file === a.file && p.rule === a.rule)).map((a) => `${a.file}: ${a.rule}`);
    expect(stale).toEqual([]);
    expect(allow.files.every((a) => a.why && a.why.length > 10)).toBe(true);
  });

  it("finds no emoji, exclamation mark, marketing adjective or chatty phrase in en.json", () => {
    const en = JSON.parse(fs.readFileSync(path.join(SRC, "locales", "en.json"), "utf8"));
    const problems = bundleProblems(en, allow.copyKeys.map((c) => c.key)).map((p) => `${p.key}: ${p.rule} (${p.detail})`);
    expect(problems).toEqual([]);
  });
});

describe("help texts", () => {
  // keys of the texts behind the info icon of a title (PageHeader help / subtitle / intro / description, HelpTip)
  // eslint-disable-next-line global-require
  const keys = require("./uiStandard.helpKeys.json");
  const en = JSON.parse(fs.readFileSync(path.join(SRC, "locales", "en.json"), "utf8"));
  const valueOf = (key) => key.split(".").reduce((n, p) => (n && typeof n === "object" ? n[p] : undefined), en);

  it("keeps every help text to one sentence", () => {
    const long = keys.filter((k) => typeof valueOf(k) === "string")
      .filter((k) => valueOf(k).trim().split(/(?<=[.!?])\s+(?=[A-Z(])/).filter((s) => !/\b(e\.g|i\.e|etc|vs|No|Inc|Co|Corp|Ltd|approx|incl)\.$/.test(s)).length > 1);
    expect(long).toEqual([]);
  });
});

describe("visual rules", () => {
  const sheets = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sheets(full);
    return /\.s?css$/.test(e.name) && e.name !== "primereact-bdoi.css" ? [full] : [];
  });
  const code = (f) => fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("uses no gradients and only the theme's shadows (focus rings and inset lines aside)", () => {
    const problems = sheets(SRC).flatMap((f) => {
      const css = code(f);
      const rel = path.relative(SRC, f);
      const out = [];
      if (/(linear|radial)-gradient\(/.test(css)) out.push(`${rel}: gradient`);
      (css.match(/box-shadow:\s*[^;{}]+;/g) || []).forEach((d) => {
        const v = d.replace(/box-shadow:\s*/, "");
        if (!/^(none|inherit|var\(--|\$shadow|\$focus)/.test(v) && !/inset/.test(v) && !/^0 0 0 /.test(v)) out.push(`${rel}: ${d.trim()}`);
      });
      return out;
    });
    expect(problems).toEqual([]);
  });
});

describe("sentence case", () => {
  it("finds no Title Case label in en.json outside the allow-list", () => {
    const en = JSON.parse(fs.readFileSync(path.join(SRC, "locales", "en.json"), "utf8"));
    expect(titleCaseLabels(en, (allow.titleCaseKeys || []).map((c) => c.key))).toEqual([]);
  });

  it("tells Title Case from sentence case, keeping proper nouns and acronyms", () => {
    expect(isTitleCaseLabel("Sum Insured Amount")).toBe(true);
    expect(isTitleCaseLabel("Sum insured amount")).toBe(false);
    expect(isTitleCaseLabel("Toyota BIR 2307 certificate")).toBe(false);
    expect(isTitleCaseLabel("OR/CR upload")).toBe(false);
  });
});

describe("copyProblems", () => {
  it("flags the copy the standard forbids", () => {
    expect(copyProblems("Saved!").map((p) => p.rule)).toEqual(["exclamation"]);
    expect(copyProblems("Easily upload files").map((p) => p.rule)).toEqual(["marketing"]);
    expect(copyProblems("Oops, something failed").map((p) => p.rule)).toEqual(["chatty"]);
    expect(copyProblems("Done \u{1F389}").map((p) => p.rule)).toEqual(["emoji"]);
    expect(copyProblems("Policy {{number}} issued.")).toEqual([]);
  });
});

describe("sourceProblems", () => {
  it("flags the native controls and headings", () => {
    expect(sourceProblems("a.jsx", '<input type="file" />').map((p) => p.rule)).toEqual(["raw-file-input"]);
    expect(sourceProblems("a.jsx", "<h1>Title</h1><select></select>").map((p) => p.rule)).toEqual(["own-h1", "native-select"]);
  });
});
