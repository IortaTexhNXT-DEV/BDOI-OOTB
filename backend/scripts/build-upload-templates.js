/**
 * Build the upload templates (docs/templates): one XLSX per upload the platform accepts, plus a CSV for the uploads
 * that read CSV only. Columns come from the importers themselves (the *_UPLOAD_COLUMNS lists, the master type
 * definitions, the GENERIC bank statement format, the remittance bulk-processing configuration), so run this again
 * after an importer, a master type or a format changes.
 *
 *   DATABASE_URL=postgres://... node scripts/build-upload-templates.js [output directory]
 *
 * The database must be migrated and seeded (reference data is enough). Default output: ../docs/templates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';
import { getSetting } from '../src/lib/settings.js';
import * as masters from '../src/modules/masters/service.js';
import { MASTER_TEMPLATES } from '../src/modules/masters/uploadSamples.js';
import { bulkConfig } from '../src/modules/remittance/items.js';
import { masterUpload, remittanceUpload, staticUploads, statementUpload, templateCsv, templateWorkbook } from '../src/modules/documents/uploadTemplates.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_OUT = path.resolve(backend, '..', 'docs', 'templates');

/** Every upload definition, in the order of the go-live set-up. */
export async function uploadDefinitions() {
  const maxRows = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
  const defs = [];
  for (const m of MASTER_TEMPLATES) defs.push(masterUpload(await masters.getType(m.type), { maxRows }));
  const statics = staticUploads();
  const format = (await pool.query('SELECT * FROM bank_statement_formats WHERE code = \'GENERIC\'')).rows[0];
  if (!format) throw new Error('Bank statement format GENERIC not found');
  const { cfg, maps } = await bulkConfig();
  return [...statics.filter((d) => d.id === 'chart-of-accounts'), ...defs, ...statics.filter((d) => d.id !== 'chart-of-accounts'), statementUpload(format), remittanceUpload(maps, cfg.code)];
}

/** Write the workbooks (and CSV files) to outDir; returns [{ id, file, csv, headers }]. */
export async function buildTemplates(outDir = DEFAULT_OUT) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = [];
  for (const def of await uploadDefinitions()) {
    fs.writeFileSync(path.join(outDir, def.file), templateWorkbook(def));
    if (def.csv) fs.writeFileSync(path.join(outDir, def.csv), `${templateCsv(def)}\r\n`);
    out.push({ id: def.id, file: def.file, csv: def.csv || null, title: def.title, menu: def.menu, route: def.route, headers: def.columns.map((c) => c.header), required: def.columns.filter((c) => c.required === true).map((c) => c.header) });
  }
  return out;
}

async function main() {
  const outDir = path.resolve(process.argv[2] || DEFAULT_OUT);
  const list = await buildTemplates(outDir);
  for (const t of list) console.log(`${t.file}${t.csv ? ` + ${t.csv}` : ''}: ${t.headers.length} columns`);
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
