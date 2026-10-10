/*
 * The manual of an edition covers only the features the edition runs (scripts/build-help.js). The features and what
 * they control come from the catalogue of the backend (backend/src/modules/features/catalogue.js); the delivered
 * edition has the Phase 1 and platform functions on, Phase 2 and the future releases off.
 *
 * For a feature that is off, the build leaves out of the chapters, before anything else is read:
 *   - the sections named in its `documents` (the heading and everything up to the next heading of the same or a higher
 *     level);
 *   - the blocks marked for it: "::: feature <key>" ... ":::" (the marks themselves always go);
 *   - the table rows, list items and "See ..." lines that only lead to a section left out or to one of its screens; a
 *     link to a section left out elsewhere becomes plain text, and a list of links in a table cell loses the ones left out.
 */
const path = require("path");

const FEATURE_BLOCK = /^::: feature ([a-z0-9-]+)\s*$/;

/** The delivered edition: { off: [{ key, status, menus, routes }], documents: Set of section ids to leave out }. */
async function deliveredEdition(repo) {
  const { FEATURES, alwaysOn } = await import(path.join(repo, "backend", "src", "modules", "features", "catalogue.js"));
  const off = FEATURES.filter((f) => !alwaysOn(f));
  return {
    off: off.map((f) => ({ key: f.key, status: "off", menus: [...f.controls.menus], routes: [...f.controls.routes] })),
    keys: new Set(off.map((f) => f.key)),
    documents: new Set(off.flatMap((f) => f.controls.documents)),
  };
}

const HEADING = /^(#{1,3}) .*?(?:\{#([a-z0-9-]+)\})?\s*$/;

/** Chapter text without the sections, blocks, rows and links of the features that are off. */
function editionText(text, { keys, documents, screens = new Set() }) {
  const out = [];
  let skipLevel = 0;
  let block = null;
  for (const line of text.split("\n")) {
    const fence = line.match(FEATURE_BLOCK);
    if (fence) {
      block = { key: fence[1], keep: !keys.has(fence[1]) };
      continue;
    }
    if (block && /^:::\s*$/.test(line)) {
      block = null;
      continue;
    }
    if (block && !block.keep) continue;
    const h = line.match(HEADING);
    if (h) {
      const level = h[1].length;
      if (skipLevel && level > skipLevel) continue;
      skipLevel = h[2] && documents.has(h[2]) ? level : 0;
      if (skipLevel) continue;
    } else if (skipLevel) continue;
    out.push(line);
  }
  const gone = (id) => documents.has(id);
  const placeholderGone = (p) => screens.has(p.trim());
  const links = /\[([^\]]+)\]\(#([a-z0-9-]+)\)/g;
  const placeholders = /\{\{(?:menu|screen):([^}]+)\}\}/g;
  return out
    .map((line) => {
      const targets = [...line.matchAll(links)].map((m) => m[2]);
      const shown = [...line.matchAll(placeholders)].map((m) => m[1]);
      const goneLinks = targets.filter(gone);
      const goneScreens = shown.filter(placeholderGone);
      if (!goneLinks.length && !goneScreens.length) return line;
      if (/^\s*\|/.test(line)) {
        const cells = line.split("|");
        const lastCell = cells[cells.length - 2] || "";
        const kept = [...lastCell.matchAll(links)].filter((m) => !gone(m[2]));
        if (!kept.length || goneScreens.length) return null;
        cells[cells.length - 2] = ` ${kept.map((m) => m[0]).join(", ")} `;
        return cells.join("|");
      }
      if (goneScreens.length) return null;
      if (/^\s*(See|See also|Also see)\s/.test(line) && targets.every(gone)) return null;
      if (/^\s*([-*]|\d+\.)\s+\[[^\]]+\]\(#[a-z0-9-]+\)\s*$/.test(line) && targets.every(gone)) return null;
      return line.replace(links, (all, label, id) => (gone(id) ? label : all));
    })
    .filter((line) => line !== null)
    .join("\n");
}

module.exports = { deliveredEdition, editionText, FEATURE_BLOCK };
