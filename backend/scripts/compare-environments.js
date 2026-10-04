#!/usr/bin/env node
/**
 * Environment comparison for release pipelines: proves that the configuration and masters of two running environments
 * are mirrored (Dev -> SIT -> UAT -> Pre-Prod -> Production), the same comparison as Master > Go-Live Data Load >
 * Compare environments, run outside both of them.
 *
 * Downloads the configuration workbook with the current data (GET /api/data-load/kits/configuration/template?prefill=true)
 * from SOURCE and TARGET, compares them on the natural keys of the workbench (GET /api/data-load/kits) and writes the
 * comparison workbook (Summary with the verdict, one sheet per object with a Difference column, environment-specific
 * values, rules). Nothing is uploaded and nothing is changed on either environment.
 *
 *   SOURCE_API=https://uat.example/api TARGET_API=https://prod.example/api \
 *   SOURCE_ADMIN_PASSWORD=... TARGET_ADMIN_PASSWORD=... node scripts/compare-environments.js
 *
 * Environment:
 *   SOURCE_API, TARGET_API        API roots of the two environments (…/api)
 *   SOURCE_FILE, TARGET_FILE      instead of an API: a configuration export already saved (e.g. a pipeline artefact);
 *                                 at least one side must be an API (it gives the sheets and keys of the workbook)
 *   SOURCE_ADMIN_USER, TARGET_ADMIN_USER          users with read:data-load (default ADMIN_USER or BrokerVerse)
 *   SOURCE_ADMIN_PASSWORD, TARGET_ADMIN_PASSWORD  their passwords (default ADMIN_PASSWORD)
 *   INCLUDE_NUMBERING=yes         compare the numbering counters (Next Number) too; environment-specific by default
 *   COMPARE_OUTPUT                comparison workbook to write (default GoLive_Environment_Comparison_<date>.xlsx)
 *
 * Exit code: 0 mirrored (environment-specific differences only), 1 differences found, 2 the comparison could not run.
 * Passwords never reach the output.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Api, Session, dataOf } from './uat/http.js';
import { VERDICT_TEXT, catalogueOf, compareSides, comparisonWorkbook, readSheets } from '../src/modules/data-load/compare.js';

const TEMPLATE = '/data-load/kits/configuration/template';

/** One side: { label, api?, session?, buffer }. */
async function side(env, name, print) {
  const api = env[`${name}_API`];
  const file = env[`${name}_FILE`];
  if (!api && !file) throw new Error(`Set ${name}_API (or ${name}_FILE)`);
  if (file) {
    print(`${name}: file ${file}`);
    return { label: name, origin: file, buffer: fs.readFileSync(file) };
  }
  const user = env[`${name}_ADMIN_USER`] || env.ADMIN_USER || 'BrokerVerse';
  const password = env[`${name}_ADMIN_PASSWORD`] || env.ADMIN_PASSWORD;
  if (!password) throw new Error(`Set ${name}_ADMIN_PASSWORD (or ADMIN_PASSWORD)`);
  const session = new Session(new Api(api.replace(/\/+$/, '')), user);
  await session.login(password);
  const buffer = await session.file(TEMPLATE, { prefill: 'true' });
  print(`${name}: ${api} (configuration export, ${buffer.length} bytes)`);
  return { label: name, origin: api, session, buffer };
}

/**
 * Run the comparison. Returns { code, result, output }: code 0 mirrored, 1 differences, 2 error. print: line output
 * (console.log by default).
 */
export async function compareEnvironments(env = process.env, { print = console.log } = {}) {
  try {
    const source = await side(env, 'SOURCE', print);
    const target = await side(env, 'TARGET', print);
    const withApi = target.session || source.session;
    if (!withApi) throw new Error('At least one of SOURCE_API and TARGET_API is needed (the sheets and keys of the workbook come from GET /data-load/kits)');
    const kit = (dataOf(await withApi.get('/data-load/kits')).kits || []).find((k) => k.kit === 'configuration');
    if (!kit) throw new Error('GET /data-load/kits has no configuration kit');
    const catalogue = catalogueOf(kit.sheets);
    const options = { includeNumbering: /^(yes|true|1)$/i.test(env.INCLUDE_NUMBERING || '') };
    const result = compareSides({ catalogue, file: readSheets(source.buffer, catalogue, { label: 'SOURCE' }), here: readSheets(target.buffer, catalogue, { label: 'TARGET' }), options });
    const day = new Date().toISOString().slice(0, 10);
    const output = env.COMPARE_OUTPUT || `GoLive_Environment_Comparison_${day}.xlsx`;
    fs.writeFileSync(output, comparisonWorkbook({
      catalogue, result, options, labels: { file: 'SOURCE', here: 'TARGET' },
      context: [['SOURCE', source.origin], ['TARGET', target.origin], ['Compared', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by scripts/compare-environments.js`]],
    }));
    const t = result.totals;
    for (const s of result.sheets.filter((x) => x.different + x.onlyInFile + x.onlyHere)) {
      print(`  ${s.name}: ${[[s.different, 'different'], [s.onlyInFile, 'only in SOURCE'], [s.onlyHere, 'only in TARGET']].filter(([n]) => n).map(([n, w]) => `${n} ${w}`).join(', ')}`);
    }
    for (const r of result.rows.filter((x) => x.status !== 'identical').slice(0, 50)) {
      const what = r.status === 'different' ? r.differences.map((d) => `${d.header}: "${d.file}" / "${d.here}"`).join('; ') : r.status === 'only-in-file' ? 'only in SOURCE' : 'only in TARGET';
      print(`    ${r.sheetName} ${r.key}: ${what}`);
    }
    print(`${VERDICT_TEXT[result.verdict]}: ${t.identical} identical, ${t.different} different, ${t.onlyInFile} only in SOURCE, ${t.onlyHere} only in TARGET, ${t.environmentSpecific} environment-specific (not differences)`);
    print(`comparison workbook written to ${output}`);
    return { code: result.verdict === 'mirrored' ? 0 : 1, result, output };
  } catch (e) {
    print(`comparison could not run: ${e.message}`);
    return { code: 2, error: e };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { code } = await compareEnvironments();
  process.exit(code);
}
