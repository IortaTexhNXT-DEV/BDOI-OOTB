/*
 * A client edition of the user manual, built from its manifest (docs/TISPH/manual/manual.json for TISPH): the chapter
 * files in the order of the manifest, the generated role facts and the checks that stop the build.
 *
 * Chapter syntax on top of the manual Markdown (render.js):
 *   {{include:generated/roles/<role>.md}}   the generated facts of a role (menus, access, approvals, SoD)
 *   {{role-summary:<role>}}                  department and one-line summary of a role
 *   {{screen:/agent/leadlisting}}            menu path of a screen and the roles that open it, with their access
 *   {{menu:/agent/leadlisting}}              the menu path of a screen as the side bar shows it
 *   {{roles:approve:quotations}}             the roles of the edition holding a permission, in business names
 *   ::: draft ... :::                        text still being written ("In preparation"; refused once Approved)
 *   <!-- ... -->                             a note for the writers, never published
 *   ![Caption](images/<chapter>/<file>.png)  a screenshot of the edition's image folder
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { HEADING, IMAGE } = require("./render");

const PLACEHOLDER = /\{\{([a-z-]+):([^}]+)\}\}/g;

// codes that never reach a business reader: permissions, role codes, setting keys
const CODE_CHECKS = [
  { re: /\b(?:read|write|approve|view):[a-z][a-z-]*/g, why: "permission code" },
  { re: /\btis-[a-z]+(?:-[a-z]+)*\b/g, why: "role code" },
  { re: /`[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_*]+)+`/g, why: "setting key" },
  { re: /\b[a-z][a-zA-Z]*\.[a-z]+_[a-z_]+\b/g, why: "setting key" },
];

const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "");
const cell = (s) => String(s ?? "").replace(/\|/g, "/");

function loadManifest(file) {
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  return { ...manifest, dir: path.dirname(file) };
}

/** Text a reader sees: without heading ids, image addresses and heading links. */
const readable = (line) => line.replace(/\s*\{#[a-z0-9-]+\}\s*$/, "").replace(/\]\([^)]*\)/g, "]");

/** Forbidden terms of the manifest and the code checks, line by line: [{ file, line, text, why }]. */
function checkText(chunks, forbidden = []) {
  const rules = forbidden.map((f) => ({
    re: f.pattern ? new RegExp(f.pattern, `g${f.caseSensitive === false ? "i" : ""}`)
      : new RegExp(`(?<![\\w-])${f.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, `g${f.caseSensitive === false ? "i" : ""}`),
    why: f.why,
  }));
  const found = [];
  for (const { file, text } of chunks) {
    text.split("\n").forEach((raw, n) => {
      const line = readable(raw);
      for (const r of [...rules, ...CODE_CHECKS]) {
        for (const m of line.matchAll(r.re)) found.push({ file, line: n + 1, text: m[0], why: r.why });
      }
    });
  }
  return found;
}

/**
 * Assemble an edition: { markdown, chapters: [{ file, text }], images: [{ from, to }], problems: [], drafts, hash }.
 * `facts` is the generated role-facts.json of the edition.
 */
function assemble(manifest, facts) {
  const problems = [];
  const images = [];
  const chapters = [];
  const { dir } = manifest;
  const screens = facts.screens || {};
  const roleBy = new Map(facts.roles.map((r) => [r.code, r]));
  const inside = (rel) => {
    const abs = path.resolve(dir, rel);
    return abs.startsWith(`${path.resolve(dir)}${path.sep}`) ? abs : null;
  };

  const expand = (file, text) =>
    text.replace(PLACEHOLDER, (all, kind, arg) => {
      const key = arg.trim();
      if (kind === "include") {
        const abs = inside(key);
        if (!abs || !key.endsWith(".md") || !fs.existsSync(abs)) {
          problems.push(`${file}: include not found: ${key}`);
          return "";
        }
        return fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n").trim();
      }
      if (kind === "menu") {
        if (screens[key]) return screens[key].menu;
        problems.push(`${file}: {{menu:${key}}} is no screen of the edition's menus`);
        return key;
      }
      if (kind === "screen") {
        const s = screens[key];
        if (!s) {
          problems.push(`${file}: {{screen:${key}}} is no screen of the edition's menus (withdrawn, or no role opens it)`);
          return "";
        }
        return [`**Menu:** ${s.menu}`, "", "| Role | Access |", "|---|---|", ...s.roles.map((r) => `| ${cell(r.role)} | ${r.access} |`)].join("\n");
      }
      if (kind === "roles") {
        const holders = facts.permissionHolders?.[key];
        if (!holders || !holders.length) {
          problems.push(`${file}: {{roles:${key}}} names a permission no role of the edition holds`);
          return "";
        }
        return list(holders);
      }
      if (kind === "role-summary") {
        const r = roleBy.get(key);
        if (!r) {
          problems.push(`${file}: {{role-summary:${key}}} names no role of the edition`);
          return "";
        }
        return `**Department:** ${r.department}. ${r.summary}${/[.]$/.test(r.summary) ? "" : "."}`;
      }
      problems.push(`${file}: unknown placeholder ${all}`);
      return all;
    });

  for (const rel of manifest.chapters) {
    const abs = inside(rel);
    if (!abs || !fs.existsSync(abs)) {
      problems.push(`chapter not found: ${rel}`);
      continue;
    }
    const raw = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->\n?/g, "");
    const text = expand(rel, raw);
    const lines = text.split("\n");
    lines.forEach((line, n) => {
      const h = line.match(HEADING);
      if (h && h[1].length <= 2 && !h[3]) problems.push(`${rel}:${n + 1}: heading without an id: ${line}`);
      const img = line.match(IMAGE);
      if (img) {
        const src = img[2];
        const abs = /^images\//.test(src) ? inside(src) : null;
        if (!abs) problems.push(`${rel}:${n + 1}: image outside the images folder: ${src}`);
        else if (!fs.existsSync(abs)) problems.push(`${rel}:${n + 1}: image not found: ${src}`);
        else images.push({ from: abs, to: src });
      }
    });
    chapters.push({ file: rel, text: text.replace(/\n{3,}/g, "\n\n").trim() });
  }

  for (const f of checkText(chapters, manifest.forbidden)) problems.push(`${f.file}:${f.line}: ${f.why}: "${f.text}"`);

  const markdown = `${chapters.map((c) => c.text).join("\n\n")}\n`;
  const ids = new Set([...markdown.matchAll(/\{#([a-z0-9-]+)\}/g)].map((m) => m[1]));
  for (const r of facts.roles) {
    if (!ids.has(r.chapterId)) problems.push(`no chapter for the role ${r.name} (a heading {#${r.chapterId}})`);
    else if (!ids.has(`${r.chapterId}-menus`)) problems.push(`the chapter of ${r.name} does not include generated/roles/${r.code}.md`);
  }
  const drafts = (markdown.match(/^::: draft\s*$/gm) || []).length;
  const hash = crypto.createHash("sha256").update(markdown).digest("hex");
  return { markdown, chapters, images, problems, drafts, hash };
}

/**
 * The status the edition may show: Approved only with an approver, a sign-off reference and the hash of the source
 * that was signed off, and without text in preparation; otherwise Draft.
 */
function effectiveStatus(manifest, { hash, drafts }) {
  if (manifest.status !== "Approved") return { status: manifest.status || "Draft", reason: null };
  if (!manifest.approved || !manifest.approvalRef) return { status: "Draft", reason: "Approved needs the approver and the sign-off reference" };
  if (manifest.approvedHash !== hash) return { status: "Draft", reason: "the source changed after the sign-off (approvedHash)" };
  if (drafts) return { status: "Draft", reason: `${drafts} sections are still in preparation` };
  return { status: "Approved", reason: null };
}

/**
 * The source of the Word edition (docs/TISPH/tools/md2docx.py): title, document control, then the chapters one heading
 * level down, without heading ids, with the text in preparation as notes and the images by their file path.
 */
function wordSource(manifest, { markdown }, status) {
  const rows = [
    ["Document", manifest.title], ["Version", manifest.version], ["Date", manifest.date], ["Status", status],
    ["Classification", manifest.classification], ["Author", manifest.prepared], ["Owner", manifest.owner],
  ].filter(([, v]) => v);
  const out = [`# ${manifest.title}`, "", "## Document Control", "", "| Item | Value |", "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`), ""];
  if ((manifest.changes || []).length) {
    out.push("**Change log**", "", "| Version | Date | Author | Change |", "|---|---|---|---|",
      ...manifest.changes.map((c) => `| ${cell(c.version)} | ${cell(c.date)} | ${cell(c.author)} | ${cell(c.change)} |`), "");
  }
  if ((manifest.signOff || []).length) {
    out.push("**Approval**", "", "| Role | Name | Date | Signature |", "|---|---|---|---|",
      ...manifest.signOff.map((s) => `| ${cell(s.role)} | ${cell(s.name)} | ${cell(s.date)} | |`), "");
  }
  const body = markdown
    .replace(/^(#{1,3}) (.+?)(?:\s+\{#[a-z0-9-]+\})?\s*$/gm, (m, hashes, title) => `#${hashes} ${title}`)
    .replace(/^::: draft\s*\n([\s\S]*?)\n:::\s*$/gm, (m, text) => `> In preparation. ${text.replace(/\n/g, " ").trim()}`)
    .replace(/\[([^\]]+)\]\(#[a-z0-9-]+\)/g, "$1")
    .replace(/^!\[([^\]]*)\]\((images\/[^)]+)\)\s*$/gm, (m, cap, src) => `![${cap}](${path.join(manifest.dir, src)})`);
  return `${out.join("\n")}\n${body}`;
}

module.exports = { loadManifest, assemble, checkText, effectiveStatus, wordSource, CODE_CHECKS };
