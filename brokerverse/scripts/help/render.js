/*
 * Markdown of the user manual to HTML (scripts/build-help.js). The manual uses a small, fixed subset: headings of
 * three levels, paragraphs, numbered and bulleted lists, tables, block quotes (notes), images on a line of their own,
 * bold, italic, code, web links and links to a heading ([text](#id)). A "::: draft" ... ":::" block marks text still
 * being written; it shows as "In preparation". A heading may carry its id: "## Prospects {#prospects}"; without one the id is
 * made from the heading text.
 */

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Heading text to an anchor: "Requests for quotation (broker slips)" -> "requests-for-quotation-broker-slips". */
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const HEADING = /^(#{1,3}) (.+?)(?:\s+\{#([a-z0-9][a-z0-9-]*)\})?\s*$/;
const IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

const inline = (text) => {
  // code spans first, so that their content is not formatted
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts
    .map((part) => {
      if (/^`[^`]+`$/.test(part)) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      return escapeHtml(part)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\[([^\]]+)\]\(#([a-z0-9-]+)\)/g, '<a href="#$2">$1</a>');
    })
    .join("");
};

/** Front matter between "---" lines: { meta, body }. */
function parseFrontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: md.slice(m[0].length) };
}

/**
 * The headings with unique ids. An explicit id is kept as written (a repeated one is an error); a heading without
 * one whose plain id is taken elsewhere is prefixed with its chapter's id.
 */
function headingIds(lines) {
  const heads = [];
  let chapter = null;
  let section = null;
  for (const line of lines) {
    const m = line.match(HEADING);
    if (!m) continue;
    const level = m[1].length;
    const title = m[2].trim();
    const h = { level, title, plain: slug(title), explicit: m[3] || null };
    if (level === 1) chapter = h;
    if (level === 2) section = h;
    h.chapter = level === 1 ? null : chapter;
    h.section = level === 3 ? section : null;
    heads.push(h);
  }
  const used = new Set();
  const repeated = [];
  for (const h of heads) {
    if (!h.explicit) continue;
    if (used.has(h.explicit)) repeated.push(h.explicit);
    used.add(h.explicit);
    h.id = h.explicit;
  }
  if (repeated.length) throw new Error(`heading ids used twice: ${repeated.join(", ")}`);
  const count = {};
  heads.forEach((h) => (count[h.plain] = (count[h.plain] || 0) + 1));
  for (const h of heads) {
    if (h.id) continue;
    let id = h.plain;
    const chapterId = h.chapter && (h.chapter.explicit || h.chapter.plain);
    if (count[id] > 1 && h.chapter) id = `${chapterId}-${h.plain}`;
    if (used.has(id) && h.section) id = `${chapterId}-${h.section.explicit || h.section.plain}-${h.plain}`;
    let n = 2;
    const base = id;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    h.id = id;
  }
  return heads;
}

/**
 * The body as HTML. `image(src)` returns the published address of an image (relative to the page) or throws when the
 * image cannot be used.
 */
function render(body, heads, image) {
  const lines = body.split("\n");
  const html = [];
  let hi = 0;
  let i = 0;
  const para = [];
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (HEADING.test(line)) {
      flush();
      const h = heads[hi++];
      if (h.level === 1 && hi > 1) html.push("</section>");
      if (h.level === 1) html.push(`<section class="chapter" aria-labelledby="${h.id}">`);
      const number = h.number ? `<span class="num">${h.number}</span> ` : "";
      html.push(`<h${h.level} id="${h.id}"><a class="anchor" href="#${h.id}" aria-hidden="true">#</a>${number}${inline(h.title)}</h${h.level}>`);
      i++;
      continue;
    }
    const img = line.match(IMAGE);
    if (img) {
      flush();
      html.push(`<figure><img src="${escapeHtml(image(img[2]))}" alt="${escapeHtml(img[1])}" loading="lazy"><figcaption>${inline(img[1])}</figcaption></figure>`);
      i++;
      continue;
    }
    if (/^\|.*\|\s*$/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const bodyRows = rows.slice(/^\|[\s:|-]+\|$/.test(rows[1] || "") ? 2 : 1);
      html.push(
        `<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
          bodyRows.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
          "</tbody></table></div>",
      );
      continue;
    }
    if (/^(\d+\.|-) /.test(line)) {
      flush();
      const ordered = /^\d+\./.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^- /.test(lines[i]))) {
        let text = lines[i].replace(/^(\d+\.|-) /, "");
        i++;
        // a continuation line of the item (wrapped text)
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) text += ` ${lines[i++].trim()}`;
        items.push(`<li>${inline(text)}</li>`);
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    if (/^::: draft\s*$/.test(line)) {
      flush();
      const text = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) text.push(lines[i++].trim());
      i++;
      html.push(`<aside class="draft"><strong>In preparation.</strong> ${inline(text.filter(Boolean).join(" "))}</aside>`);
      continue;
    }
    if (/^> /.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^> ?/.test(lines[i])) quote.push(lines[i++].replace(/^> ?/, ""));
      html.push(`<aside class="note">${inline(quote.join(" "))}</aside>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  html.push("</section>");
  return html.join("\n");
}

/** The contents list: chapters with their sections. */
function toc(heads) {
  const out = [];
  let open = false;
  for (const h of heads) {
    const title = `${h.number ? `${h.number} ` : ""}${escapeHtml(h.title)}`;
    if (h.level === 1) {
      if (open) out.push("</ul></li>");
      out.push(`<li><a href="#${h.id}">${title}</a><ul>`);
      open = true;
    } else if (h.level === 2) {
      out.push(`<li><a href="#${h.id}">${title}</a></li>`);
    }
  }
  if (open) out.push("</ul></li>");
  return out.join("");
}

module.exports = { escapeHtml, slug, inline, parseFrontMatter, headingIds, render, toc, HEADING, IMAGE };
