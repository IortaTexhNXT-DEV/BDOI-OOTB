/*
 * Word and PDF of a client edition (npm run help:word): the Word source that npm run help:build writes
 * (docs/TISPH/manual/generated/TISPH_User_Manual.md) goes through docs/TISPH/tools/md2docx.py on the TISPH document
 * template, in the manual layout and with the edition's brand pack (cover, header, footer, colours and font of the
 * client instead of the template's artwork); the PDF is made from the Word file by LibreOffice. Then the help is built again so that public/help
 * carries both files. Needs python3 with python-docx and Pillow, and LibreOffice (soffice).
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const REPO = path.resolve(ROOT, "..");
const TOOLS = path.join(REPO, "docs", "TISPH", "tools");
const edition = JSON.parse(fs.readFileSync(path.join(ROOT, "help.config.json"), "utf8")).edition;
const manifestFile = path.join(REPO, "docs", "TISPH", "manual", "manual.json");

if (edition !== "tisph") {
  console.error(`help:word builds the TISPH edition; help.config.json ships the ${edition} edition`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const dir = path.dirname(manifestFile);
const source = path.join(dir, manifest.wordSource);
if (!fs.existsSync(source)) {
  console.error(`${path.relative(REPO, source)} is missing: run npm run help:build first`);
  process.exit(1);
}
const version = manifest.status === "Approved" ? manifest.version : `${manifest.version} ${manifest.status || "Draft"}`;
const brand = manifest.brandPack ? ["--brand-pack", path.join(REPO, "backend", "assets", "brand-packs", manifest.brandPack)] : [];
execFileSync("python3", ["-I", path.join(TOOLS, "md2docx.py"), source, path.join(dir, manifest.files.word),
  "--template", path.join(TOOLS, "Document_template_Format1.docx"), "--title", manifest.title, "--version", version, "--date", manifest.date,
  "--prepared-by", manifest.prepared, "--company", manifest.owner, "--subtitle", manifest.owner, "--classification", manifest.classification || "",
  "--keywords", `${manifest.owner}; User Manual`, "--manual", ...brand, "--chapter-breaks", "--keep-pdf", path.join(dir, manifest.files.pdf)],
  { stdio: ["ignore", "ignore", "inherit"] });
console.log(`help: ${manifest.files.word} and ${manifest.files.pdf} -> ${path.relative(REPO, dir)}`);
execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", path.join(ROOT, "scripts", "build-help.js")], { stdio: "inherit" });
