/**
 * Build the upload templates (docs/package/05_Delivery/Upload_Templates): one XLSX per upload the platform accepts,
 * plus a CSV for the uploads that read CSV only, and the coverage table of the README in that folder. Columns come
 * from the importers themselves (the *_UPLOAD_COLUMNS lists, the master type definitions, the GENERIC bank and insurer
 * statement formats, the remittance bulk-processing configuration), so run this again after an importer, a master
 * type or a format changes. Templates the platform no longer accepts (a retired master type, for example) are removed.
 *
 *   DATABASE_URL=postgres://... node scripts/build-upload-templates.js [output directory]
 *
 * The database must be migrated and seeded (reference data is enough).
 * Default output: ../docs/package/05_Delivery/Upload_Templates.
 *
 * Also writes the two blank go-live workbooks of Master > Go-Live Data Load (GoLive_Configuration_Workbook.xlsx and
 * GoLive_Migration_Workbook.xlsx, src/modules/data-load), so they can be handed out without signing in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';
import { getSetting } from '../src/lib/settings.js';
import * as masters from '../src/modules/masters/service.js';
import { MASTER_TEMPLATES } from '../src/modules/masters/uploadSamples.js';
import { bulkConfig } from '../src/modules/remittance/items.js';
import {
  insurerStatementUpload, masterUpload, remittanceUpload, staticUploads, statementUpload, templateCsv, templateWorkbook,
} from '../src/modules/documents/uploadTemplates.js';
import { KITS, kitSheets, template as kitTemplate } from '../src/modules/data-load/service.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_OUT = path.resolve(backend, '..', 'docs', 'package', '05_Delivery', 'Upload_Templates');
const TEMPLATE_FILE = /_Template\.(xlsx|csv)$/;

/**
 * Every API route that receives a file (module folder, method, path inside the module), with the templates of the
 * rows it reads, or why it has none (a single attachment is not a data file). test/upload-templates.test.js scans the
 * routers and fails when a route that receives a file is missing here.
 */
export const FILE_ROUTES = [
  { module: 'masters', method: 'POST', path: '/:type/upload', templates: ['master:*'] },
  { module: 'accounting', method: 'POST', path: '/accounts/upload', templates: ['chart-of-accounts'] },
  { module: 'leads', method: 'POST', path: '/bulk-upload', templates: ['leads'] },
  { module: 'quotations', method: 'POST', path: '/bulk-upload', templates: ['quotations'] },
  { module: 'policies', method: 'POST', path: '/bulk-upload', templates: ['policies'] },
  { module: 'receipts', method: 'POST', path: '/bulk-upload', templates: ['receipts'] },
  { module: 'disbursements', method: 'POST', path: '/bulk-upload', templates: ['disbursements'] },
  { module: 'period-end', method: 'POST', path: '/opening-balances/import', templates: ['opening-balances'] },
  { module: 'receipts', method: 'POST', path: '/opening-items/import', templates: ['open-items'] },
  { module: 'bank-reconciliation', method: 'POST', path: '/statements/import', templates: ['bank-statement'] },
  { module: 'bank-reconciliation', method: 'POST', path: '/statements/preview', templates: ['bank-statement'] },
  { module: 'bank-reconciliation', method: 'POST', path: '/formats/:code/test', templates: ['bank-statement'] },
  { module: 'insurer-reconciliation', method: 'POST', path: '/statements/import', templates: ['insurer-statement'] },
  { module: 'insurer-reconciliation', method: 'POST', path: '/statements/preview', templates: ['insurer-statement'] },
  { module: 'remittance', method: 'POST', path: '/bulk/upload', templates: ['remittance-bulk'] },
  { module: 'data-load', method: 'POST', path: '/batches', templates: ['kit:configuration', 'kit:migration'] },
  { module: 'claims', method: 'POST', path: '/', noTemplate: 'Claim documents and photos attached to a claim (single files)' },
  { module: 'claims', method: 'PUT', path: '/:id', noTemplate: 'Claim documents and photos attached to a claim (single files)' },
  { module: 'claims', method: 'PUT', path: '/settle/:id', noTemplate: 'Settlement documents attached to a claim (single files)' },
  { module: 'endorsements', method: 'POST', path: '/upload-document', noTemplate: 'The endorsement document (single file)' },
  { module: 'system-settings', method: 'POST', path: '/logo-presets', noTemplate: 'Logo image (single file)' },
  { module: 'system-settings', method: 'POST', path: '/upload/:field', noTemplate: 'Logo or favicon image (single file)' },
  { module: 'branding', method: 'POST', path: '/upload/:asset', noTemplate: 'Logo, favicon or sign-in picture (single image)' },
  { module: 'branding', method: 'POST', path: '/brand-pack', noTemplate: 'Brand pack exported by Theme and Branding (.zip or .json)' },
  { module: 'e-signatures', method: 'POST', path: '/', noTemplate: 'Signature image (single PNG / JPEG, or drawn on screen)' },
  { module: 'uploads', method: 'POST', path: '/upload', noTemplate: 'Attachments: policy documents, IDs, vehicle photos, payment proofs, quotation responses, insurer offers, product documents, company logo' },
  { module: 'uploads', method: 'POST', path: '/upload-multiple', noTemplate: 'Several attachments at once (claim documents)' },
];

/** Master types that take an upload: active, not retired, not excluded (masters.noTemplateReason), in template order. */
export async function uploadableMasterTypes() {
  const types = (await pool.query("SELECT code FROM master_types WHERE status = 'active' ORDER BY sort_order, code")).rows.map((r) => r.code);
  const order = (code) => { const i = MASTER_TEMPLATES.findIndex((m) => m.type === code); return i < 0 ? MASTER_TEMPLATES.length : i; };
  const out = [];
  for (const code of types.sort((a, b) => order(a) - order(b))) {
    const t = await masters.getType(code);
    if (!masters.noTemplateReason(t)) out.push(t);
  }
  return out;
}

/** Every upload definition, in the order of the go-live set-up. */
export async function uploadDefinitions() {
  const maxRows = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
  const defs = [];
  for (const t of await uploadableMasterTypes()) defs.push(masterUpload(t, { maxRows }));
  const statics = staticUploads();
  const format = (await pool.query('SELECT * FROM bank_statement_formats WHERE code = \'GENERIC\'')).rows[0];
  if (!format) throw new Error('Bank statement format GENERIC not found');
  const insurerFormat = (await pool.query('SELECT * FROM insurer_statement_formats WHERE code = \'GENERIC\'')).rows[0];
  if (!insurerFormat) throw new Error('Insurer statement format GENERIC not found');
  const { cfg, maps } = await bulkConfig();
  return [...statics.filter((d) => d.id === 'chart-of-accounts'), ...defs, ...statics.filter((d) => d.id !== 'chart-of-accounts'),
    statementUpload(format), insurerStatementUpload(insurerFormat), remittanceUpload(maps, cfg.code)];
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const routeOf = (d) => d.route.replace(/ \(.*$/, '');

/** Markdown coverage table: upload, screen with the Upload button, API route, template file(s). */
export function coverageTable(list) {
  const rows = list.map((d) => `| ${cell(d.title)} | ${cell(d.button ? d.screen : `No Upload button: ${d.screen}`)} | ${cell(d.route.startsWith('POST') ? `\`${routeOf(d)}\`` : d.route)} | \`${d.file}\`${d.csv ? `, \`${d.csv}\`` : ''} |`);
  return ['| Upload | Screen with the Upload button | API route | Template |', '|---|---|---|---|', ...rows].join('\n');
}

/** Replace the coverage table between the markers of README.md in outDir (when the README has them). */
export function writeCoverage(outDir, list) {
  const readme = path.join(outDir, 'README.md');
  if (!fs.existsSync(readme)) return false;
  const text = fs.readFileSync(readme, 'utf8');
  const re = /(<!-- coverage:start[^>]*-->)[\s\S]*?(<!-- coverage:end -->)/;
  if (!re.test(text)) return false;
  fs.writeFileSync(readme, text.replace(re, (_m, a, b) => `${a}\n${coverageTable(list)}\n${b}`));
  return true;
}

/**
 * Write the workbooks (and CSV files) to outDir, remove template files the platform no longer accepts and refresh the
 * README coverage table; returns [{ id, file, csv, title, menu, screen, button, route, headers, required }] with .removed.
 */
export async function buildTemplates(outDir = DEFAULT_OUT) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = [];
  for (const def of await uploadDefinitions()) {
    fs.writeFileSync(path.join(outDir, def.file), templateWorkbook(def));
    if (def.csv) fs.writeFileSync(path.join(outDir, def.csv), `${templateCsv(def)}\r\n`);
    out.push({ id: def.id, file: def.file, csv: def.csv || null, title: def.title, menu: def.menu, screen: def.screen || def.menu, button: def.button !== false, route: def.route,
      headers: def.columns.map((c) => c.header), required: def.columns.filter((c) => c.required === true).map((c) => c.header) });
  }
  // go-live workbench kits: one workbook per kit (blank), sheets in load order
  for (const kit of Object.keys(KITS)) {
    const { fileName, buffer } = await kitTemplate(kit);
    fs.writeFileSync(path.join(outDir, fileName), buffer);
    const sheets = await kitSheets(kit);
    out.push({ id: `kit:${kit}`, file: fileName, csv: null, title: KITS[kit].title, menu: 'Master > Go-Live Data Load', screen: 'Master > Go-Live Data Load',
      button: true, route: 'POST /api/data-load/batches (multipart field "file", field kit)', headers: sheets.map((x) => x.name), required: [] });
  }
  const keep = new Set(out.flatMap((t) => [t.file, t.csv].filter(Boolean)));
  const removed = fs.readdirSync(outDir).filter((f) => TEMPLATE_FILE.test(f) && !keep.has(f));
  for (const f of removed) fs.rmSync(path.join(outDir, f));
  writeCoverage(outDir, out);
  return Object.assign(out, { removed });
}

async function main() {
  const outDir = path.resolve(process.argv[2] || DEFAULT_OUT);
  const list = await buildTemplates(outDir);
  for (const t of list) console.log(`${t.file}${t.csv ? ` + ${t.csv}` : ''}: ${t.headers.length} ${t.id.startsWith('kit:') ? 'sheets' : 'columns'}`);
  for (const f of list.removed) console.log(`removed ${f} (no longer accepted by the platform)`);
  console.log(`${list.length} templates written to ${outDir}`);
  await pool.end();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(async (e) => {
    console.error(e.message);
    await pool.end();
    process.exit(1);
  });
}
