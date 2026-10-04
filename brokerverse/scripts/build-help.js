/*
 * Builds the in-app help from the user manual (docs/package/source/user-manual.md):
 *
 *   public/help/user-manual.html          the manual as one HTML page, every heading with a stable anchor
 *   public/help/sections.json             the headings (id, title, level, parent): the Help panel links a screen to one
 *   public/help/images/                   the screenshots the manual shows
 *   public/help/BrokerVerse_User_Manual.pdf  the PDF of the manual (docs/package/05_Delivery)
 *
 *   npm run help:build                    run after the manual changes; commit public/help
 *
 * The Help panel (components/HelpPanel) maps each screen to a heading id (helpRoutes.js); its test fails when a
 * heading it links to was renamed, so a manual change that breaks a link is caught.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.resolve(ROOT, "..", "docs", "package");
const MANUAL = path.join(DOCS, "source", "user-manual.md");
const IMAGES = path.join(DOCS, "source", "manual-images");
const PDF = path.join(DOCS, "05_Delivery", "BrokerVerse_User_Manual.pdf");
const OUT = path.join(ROOT, "public", "help");
const PDF_NAME = "BrokerVerse_User_Manual.pdf";

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Heading text to an anchor: "Requests for quotation (broker slips)" -> "requests-for-quotation-broker-slips". */
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inline = (text) => {
  // code spans first, so that their content is not formatted
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts
    .map((part) => {
      if (/^`[^`]+`$/.test(part)) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      return escapeHtml(part)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    })
    .join("");
};

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

/** The headings with unique ids: a heading whose plain id is taken elsewhere is prefixed with its chapter's id. */
function headingIds(lines) {
  const heads = [];
  let chapter = null;
  let section = null;
  for (const line of lines) {
    const m = line.match(/^(#{1,3}) (.+)$/);
    if (!m) continue;
    const level = m[1].length;
    const title = m[2].trim();
    const h = { level, title, plain: slug(title) };
    if (level === 1) chapter = h;
    if (level === 2) section = h;
    h.chapter = level === 1 ? null : chapter;
    h.section = level === 3 ? section : null;
    heads.push(h);
  }
  const count = {};
  heads.forEach((h) => (count[h.plain] = (count[h.plain] || 0) + 1));
  const used = new Set();
  for (const h of heads) {
    let id = h.plain;
    if (count[id] > 1 && h.chapter) id = `${h.chapter.plain}-${h.plain}`;
    if (used.has(id) && h.section) id = `${h.chapter.plain}-${h.section.plain}-${h.plain}`;
    let n = 2;
    const base = id;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    h.id = id;
  }
  return heads;
}

function render(body, heads, images) {
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
    const heading = line.match(/^(#{1,3}) (.+)$/);
    if (heading) {
      flush();
      const h = heads[hi++];
      if (h.level === 1 && hi > 1) html.push("</section>");
      if (h.level === 1) html.push(`<section class="chapter" aria-labelledby="${h.id}">`);
      html.push(`<h${h.level} id="${h.id}"><a class="anchor" href="#${h.id}" aria-hidden="true">#</a>${inline(h.title)}</h${h.level}>`);
      i++;
      continue;
    }
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      flush();
      const file = path.basename(img[2]);
      images.add(file);
      html.push(`<figure><img src="images/${encodeURIComponent(file)}" alt="${escapeHtml(img[1])}" loading="lazy"><figcaption>${inline(img[1])}</figcaption></figure>`);
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

const STYLE = `
:root{--navy:#004ea8;--blue:#0072d8;--bg:#f6f6f6;--text:#4b4b4b;--head:#2e2e2e;--muted:#656565;--border:#e4e4e4;--tint:#e5f5ff}
*{box-sizing:border-box}html{scroll-padding-top:72px}
body{margin:0;font:15px/1.6 "Nunito",Arial,sans-serif;color:var(--text);background:var(--bg)}
header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:16px;padding:12px 24px;background:#fff;border-bottom:1px solid var(--border)}
header h1{font-size:18px;margin:0;color:var(--head)}header .meta{color:var(--muted);font-size:13px}
header .spacer{flex:1}header a.button{color:#fff;background:var(--blue);padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px;max-width:1400px;margin:0 auto;padding:24px}
nav.toc{position:sticky;top:80px;align-self:start;max-height:calc(100vh - 104px);overflow:auto;background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px 8px;font-size:13.5px;scrollbar-width:thin}
nav.toc ul{list-style:none;margin:0;padding:0}nav.toc li li{padding-left:14px;border-left:1px solid var(--border);margin-left:8px}
nav.toc a{display:block;padding:3px 8px;border-radius:6px;color:var(--text);text-decoration:none}
nav.toc a:hover{background:var(--bg)}nav.toc > ul > li > a{font-weight:700;color:var(--head);margin-top:6px}nav.toc a.current{background:var(--tint);color:var(--navy);font-weight:700}
main{background:#fff;border:1px solid var(--border);border-radius:12px;padding:8px 40px 40px;min-width:0}
main :is(h1,h2,h3){color:var(--head);line-height:1.3;position:relative}main h1{font-size:26px;margin:40px 0 12px;padding-top:12px;border-top:1px solid var(--border)}
section.chapter:first-child h1{border-top:0}main h2{font-size:20px;margin:32px 0 8px}main h3{font-size:16.5px;margin:24px 0 6px}
h1:target,h2:target,h3:target{background:var(--tint);box-shadow:0 0 0 8px var(--tint);border-radius:4px}
.anchor{position:absolute;left:-22px;color:var(--border);text-decoration:none;font-weight:400}h1:hover .anchor,h2:hover .anchor,h3:hover .anchor{color:var(--blue)}
.table{overflow-x:auto;margin:12px 0}table{border-collapse:collapse;width:100%;font-size:14px}
th{background:var(--navy);color:#fff;text-align:left;padding:8px 10px;font-weight:700}td{border-bottom:1px solid var(--border);padding:8px 10px;vertical-align:top}
tr:nth-child(even) td{background:#f5faff}code{font-size:13px;background:var(--bg);padding:1px 5px;border-radius:4px}
figure{margin:16px 0}figure img{max-width:100%;height:auto;border:1px solid var(--border);border-radius:8px}figcaption{font-size:13px;color:var(--muted);margin-top:4px}
aside.note{background:var(--tint);border-left:3px solid var(--blue);padding:10px 14px;border-radius:0 8px 8px 0;margin:12px 0}
@media (max-width:900px){.layout{grid-template-columns:1fr}nav.toc{position:static;max-height:none}main{padding:8px 16px 24px}}
@media print{header,nav.toc{display:none}.layout{display:block;padding:0}main{border:0}}
`;

function build() {
  const md = fs.readFileSync(MANUAL, "utf8").replace(/\r\n/g, "\n");
  const { meta, body } = parseFrontMatter(md);
  const heads = headingIds(body.split("\n"));
  const images = new Set();
  const content = render(body, heads, images);

  const toc = [];
  let open = false;
  for (const h of heads) {
    if (h.level === 1) {
      if (open) toc.push("</ul></li>");
      toc.push(`<li><a href="#${h.id}">${escapeHtml(h.title)}</a><ul>`);
      open = true;
    } else if (h.level === 2) {
      toc.push(`<li><a href="#${h.id}">${escapeHtml(h.title)}</a></li>`);
    }
  }
  if (open) toc.push("</ul></li>");

  const title = `BrokerVerse ${meta.title || "User Manual"}`;
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <span class="meta">Version ${escapeHtml(meta.version || "")} · ${escapeHtml(meta.date || "")}</span>
  <span class="spacer"></span>
  <a class="button" href="${PDF_NAME}" download>Download PDF</a>
</header>
<div class="layout">
<nav class="toc" aria-label="Contents"><ul>${toc.join("")}</ul></nav>
<main>
${content}
</main>
</div>
<script>
// The contents list follows the section in the address (Help > Open this section) and the reader's scrolling.
(function () {
  var links = {};
  document.querySelectorAll("nav.toc a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
  var heads = Array.prototype.slice.call(document.querySelectorAll("main h1[id], main h2[id]"));
  var current = null;
  function mark(id, scroll) {
    var a = links[id];
    if (!a || a === current) return;
    if (current) current.classList.remove("current");
    a.classList.add("current");
    current = a;
    if (scroll) a.scrollIntoView({ block: "center" });
  }
  function sectionOf(el) {
    // an h3 belongs to the h2 (or h1) above it
    var id = null;
    heads.forEach(function (h) { if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING || h === el) id = h.id; });
    return id;
  }
  function fromHash() {
    var el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) mark(sectionOf(el), true);
  }
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("scroll", function () {
    var top = null;
    heads.forEach(function (h) { if (h.getBoundingClientRect().top < 120) top = h; });
    if (top) mark(top.id, false);
  }, { passive: true });
  fromHash();
})();
</script>
</body>
</html>
`;

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "images"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "user-manual.html"), page);
  const sections = heads.map((h) => ({
    id: h.id,
    title: h.title,
    level: h.level,
    chapter: h.chapter ? h.chapter.title : null,
  }));
  fs.writeFileSync(
    path.join(OUT, "sections.json"),
    `${JSON.stringify({ title, version: meta.version || "", date: meta.date || "", sections }, null, 1)}\n`,
  );
  let missing = 0;
  for (const file of images) {
    const src = path.join(IMAGES, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, "images", file));
    else {
      missing += 1;
      console.warn(`image not found: ${file}`);
    }
  }
  if (fs.existsSync(PDF)) fs.copyFileSync(PDF, path.join(OUT, PDF_NAME));
  else console.warn(`PDF not found: ${PDF}`);
  console.log(`help: ${heads.length} sections, ${images.size - missing} images, PDF ${fs.existsSync(PDF) ? "copied" : "missing"} -> ${path.relative(ROOT, OUT)}`);
}

build();
