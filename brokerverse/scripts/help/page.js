/*
 * The user manual page (public/help/user-manual.html): the style sheet comes from the theme of the edition (the brand
 * pack's theme.json, or the product default theme) through themeToCssVars of the application, so the page has the
 * colours, font, button shape and table headers of the screens. No colour of a brand is written here.
 */
const { escapeHtml } = require("./render");

const CSS = `
*{box-sizing:border-box}html{scroll-padding-top:84px}
body{margin:0;font:15px/1.6 var(--bv-font-family);color:#3a3a3a;background:var(--bv-page-bg)}
a{color:var(--bv-link)}a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--bv-focus-color);outline-offset:2px}
header{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 24px;background:var(--bv-header-bg);color:var(--bv-header-text);border-bottom:3px solid var(--bv-marker)}
header img.logo{height:var(--bv-logo-app-height);width:auto;display:block}
header h1{font-size:18px;margin:0;color:var(--bv-header-text)}header .meta{font-size:13px;opacity:.8}
header .status{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border:1px solid currentColor;border-radius:var(--bv-radius-sm);padding:1px 8px}
header .spacer{flex:1}
header a.button{color:var(--bv-button-text);background:var(--bv-button-bg);padding:8px 14px;border-radius:var(--bv-radius-button);text-decoration:none;font-weight:600;font-size:14px}
header a.button:hover{background:var(--bv-button-hover-bg)}
header a.button.outlined{color:var(--bv-button-bg);background:transparent;box-shadow:inset 0 0 0 1px var(--bv-button-bg)}
header a.button.outlined:hover{background:var(--bv-primary-050)}
.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px;max-width:1400px;margin:0 auto;padding:24px}
nav.toc{position:sticky;top:96px;align-self:start;max-height:calc(100vh - 120px);overflow:auto;background:#fff;border:1px solid #e4e4e4;border-radius:var(--bv-radius-md);padding:12px 8px;font-size:13.5px;scrollbar-width:thin}
nav.toc input{width:100%;margin:0 0 8px;padding:6px 10px;font:inherit;border:1px solid var(--bv-field-border);border-radius:var(--bv-radius-sm)}
nav.toc ul{list-style:none;margin:0;padding:0}nav.toc li li{padding-left:14px;border-left:1px solid #e4e4e4;margin-left:8px}
nav.toc a{display:block;padding:3px 8px;border-radius:var(--bv-radius-sm);color:#3a3a3a;text-decoration:none}
nav.toc a:hover{background:var(--bv-page-bg)}nav.toc > ul > li > a{font-weight:700;color:var(--bv-heading-text);margin-top:6px}
nav.toc a.current{background:var(--bv-primary-050);color:var(--bv-heading-text);font-weight:700;box-shadow:inset 3px 0 0 var(--bv-marker)}
main{background:#fff;border:1px solid #e4e4e4;border-radius:var(--bv-radius-md);padding:8px 40px 40px;min-width:0}
main :is(h1,h2,h3){color:var(--bv-heading-text);line-height:1.3;position:relative}main h1{font-size:26px;margin:40px 0 12px;padding-top:12px;border-top:1px solid #e4e4e4}
section.chapter:first-child h1{border-top:0}main h2{font-size:20px;margin:32px 0 8px}main h3{font-size:16.5px;margin:24px 0 6px}
h1:target,h2:target,h3:target{background:var(--bv-primary-050);box-shadow:0 0 0 8px var(--bv-primary-050);border-radius:4px}
.anchor{position:absolute;left:-22px;color:#d0d0d0;text-decoration:none;font-weight:400}h1:hover .anchor,h2:hover .anchor,h3:hover .anchor{color:var(--bv-link)}
.table{overflow-x:auto;margin:12px 0}table{border-collapse:collapse;width:100%;font-size:14px}
th{background:var(--bv-table-header-bg);color:var(--bv-table-header-text);text-align:left;padding:8px 10px;font-weight:700;border-bottom:1px solid var(--bv-table-header-rule)}
td{border-bottom:1px solid #e4e4e4;padding:8px 10px;vertical-align:top}
tr:nth-child(even) td{background:var(--bv-table-stripe)}code{font-size:13px;background:var(--bv-page-bg);padding:1px 5px;border-radius:4px}
main .num{font-weight:700;margin-right:4px}figure{margin:16px 0}figure img{max-width:100%;height:auto;border:1px solid #e4e4e4;border-radius:var(--bv-radius-sm)}figcaption{font-size:13px;color:#656565;margin-top:4px}
aside.note{background:var(--bv-primary-050);border-left:3px solid var(--bv-marker);padding:10px 14px;border-radius:0 var(--bv-radius-sm) var(--bv-radius-sm) 0;margin:12px 0}
aside.draft{background:var(--bv-page-bg);border:1px dashed #b0b0b0;padding:10px 14px;border-radius:var(--bv-radius-sm);margin:12px 0;color:#656565}
@media (max-width:900px){.layout{grid-template-columns:1fr;padding:16px}nav.toc{position:static;max-height:none}main{padding:8px 16px 24px}header{padding:10px 16px}}
@media print{header,nav.toc{display:none}.layout{display:block;padding:0}main{border:0}}
`;

/** @font-face rules of the font files served with the page ({ family, files: [{ weight, src }] }). */
function fontFaces(fonts) {
  if (!fonts) return "";
  return fonts.files.map((f) => `@font-face{font-family:"${fonts.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url("${f.src}") format("woff2")}`).join("");
}

/** The style sheet of a theme: the custom properties of the screens, then the rules of the page. */
function styleSheet(vars) {
  const root = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";");
  return `:root{${root}}${CSS}`;
}

/**
 * The page. `edition`: { title, version, versionLabel, date, status, logo, files: { pdf, word }, fontUrl or fonts }; `vars`: the theme's
 * custom properties; `toc` and `content`: HTML from render.js.
 */
function page({ edition, vars, toc, content }) {
  const downloads = [
    edition.files.word && `<a class="button outlined" href="${escapeHtml(edition.files.word)}" download>Download Word</a>`,
    edition.files.pdf && `<a class="button" href="${escapeHtml(edition.files.pdf)}" download>Download PDF</a>`,
  ].filter(Boolean).join("\n  ");
  const meta = [edition.version && `${escapeHtml(edition.versionLabel || "Version")} ${escapeHtml(edition.version)}`, edition.date && escapeHtml(edition.date)].filter(Boolean).join(" · ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(edition.title)}</title>
${edition.fontUrl ? `<link rel="stylesheet" href="${escapeHtml(edition.fontUrl)}">\n` : ""}<style>${fontFaces(edition.fonts)}${styleSheet(vars)}</style>
</head>
<body>
<header>
  ${edition.logo ? `<img class="logo" src="${escapeHtml(edition.logo)}" alt="${escapeHtml(edition.brandName || "")}">\n  ` : ""}<h1>${escapeHtml(edition.title)}</h1>
  <span class="meta">${meta}</span>
  ${edition.status && edition.status !== "Approved" ? `<span class="status">${escapeHtml(edition.status)}</span>` : ""}
  <span class="spacer"></span>
  ${downloads}
</header>
<div class="layout">
<nav class="toc" aria-label="Contents"><input id="toc-search" type="search" placeholder="Search the contents" aria-label="Search the contents"><ul>${toc}</ul></nav>
<main>
${content}
</main>
</div>
<script src="manual.js"></script>
</body>
</html>
`;
}

module.exports = { styleSheet, page };
