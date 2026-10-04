#!/usr/bin/env node
/**
 * Go-live rehearsal (npm run rehearsal:golive): the go-live of a broker rehearsed end to end between two running
 * environments, through their public APIs, with a run log of every check (PASS / FAIL and figures).
 *
 *   SOURCE  an environment with configuration and business data (think UAT): its configuration is promoted and its open
 *           book plays the old system to migrate;
 *   TARGET  the environment going live (think Production): migrated and seeded with reference data only. The rehearsal
 *           changes it (configuration loaded, smoke test, transaction reset, migration, new business), so point it at a
 *           rehearsal or pre-go-live database, never at a live one.
 *
 * Steps: 1. SOURCE configuration exported with the current data. 2. Loaded into TARGET with the cutover date: validate,
 * 3 deliberate errors reported with sheet / row / column, errors workbook fixed and loaded, reload without duplicates,
 * masters and configuration compared. 3. Smoke test on TARGET (client, quotation, policy, receipt: numbers and journals),
 * transaction reset (dry run, execute), masters identical (checksums), counters restarted at the next numbers the
 * Numbering sheet set (no reload of the sheet needed: step 4 loads the workbook again only to check it changes nothing),
 * trial balance empty.
 * 4. Migration workbook = TARGET's blank template filled with SOURCE's open book at cutover - 1; injected errors, errors
 * workbook, fix, load, reconciliation against SOURCE, reload without duplicates. 5. New and migrated data side by side:
 * new policy number, renewal of a migrated policy, receipt on a migrated open item, trial balance and receivables
 * control account, source filter. 6. Go-live lock: migration refused (409), reset refused, configuration accepted.
 * 7. TARGET configuration exported again and compared with step 1 (environment-specific differences listed).
 *
 *   SOURCE_API=https://uat.example/api TARGET_API=https://preprod.example/api \
 *   SOURCE_ADMIN_PASSWORD=... TARGET_ADMIN_PASSWORD=... PERSONA_PASSWORD=... \
 *   SOURCE_DATABASE_URL=postgres://... TARGET_DATABASE_URL=postgres://... CONFIRM_RESET=yes npm run rehearsal:golive
 *
 * Environment:
 *   SOURCE_API, TARGET_API        API roots of the two environments (…/api)
 *   SOURCE_ADMIN_USER, TARGET_ADMIN_USER  System Administrators (default ADMIN_USER or BrokerVerse)
 *   SOURCE_ADMIN_PASSWORD, TARGET_ADMIN_PASSWORD  their passwords (default ADMIN_PASSWORD)
 *   PERSONA_PASSWORD              password the persona users of the configuration workbook set on TARGET at their first
 *                                 sign-in (temporary password returned once by the load); must meet the password policy
 *   SOURCE_DATABASE_URL           SOURCE database, read only: the open book as at cutover - 1 (the API has no as-at view)
 *   TARGET_DATABASE_URL           TARGET database: transaction reset (the function of npm run reset:transactions) and
 *                                 checksums of the master tables
 *   CONFIRM_RESET=yes             required: the rehearsal resets TARGET's transactions (also at the start of a re-run)
 *   CUTOVER_DATE                  first day of live transactions on TARGET (default: TARGET's business date today)
 *   REHEARSAL_REPORT              run log (default docs/e2e/GOLIVE_REHEARSAL_RUN.md; "none" to skip)
 *   REHEARSAL_WORKDIR             where the workbooks of every step are saved (default a temporary directory)
 *   REHEARSAL_KEEP_LOCK=yes       leave golive.locked on at the end (default: switched off again for the next run)
 *   REHEARSAL_ALLOW_UNLOCK=yes    allow a run on a TARGET whose golive.locked is on (switches it off first)
 *   REHEARSAL_SEED                random seed of the synthetic new business (default brokerverse-golive)
 *
 * Exit code 1 when a check failed. Passwords never reach the output or the run log.
 */
import fs from 'node:fs';
import { loadConfig } from './golive/config.js';
import { RehearsalLog, expect } from './golive/log.js';
import { Api, Session, dataOf } from './uat/http.js';
import { Random } from './uat/random.js';
import { todayIn, addDays } from './uat/dates.js';
import { countRows, reset } from './golive/database.js';
import { step1, step2 } from './golive/steps-config.js';
import { step3 } from './golive/steps-smoke.js';
import { step4 } from './golive/steps-migration.js';
import { step5 } from './golive/steps-sync.js';
import { step6, step7, unlock } from './golive/steps-lock.js';

const cfg = loadConfig();
const log = new RehearsalLog({ quiet: cfg.quiet });
log.hide(cfg.sourcePassword, cfg.targetPassword, cfg.personaPassword, ...[cfg.sourceDb, cfg.targetDb].map((u) => { try { return new URL(u).password; } catch { return ''; } }));

const ctx = {
  cfg, log, rnd: new Random(cfg.seed), figures: {}, state: {}, sections: [],
  src: { api: new Api(cfg.sourceApi) }, tgt: { api: new Api(cfg.targetApi), personas: {}, temporaryPasswords: {} },
};

/** Step 0: sign in, cutover date, TARGET state (a re-run starts from TARGET's configuration with no business). */
async function preflight() {
  log.setPhase('Step 0. Pre-flight');
  ctx.src.admin = new Session(ctx.src.api, cfg.sourceAdmin);
  ctx.tgt.admin = new Session(ctx.tgt.api, cfg.targetAdmin);
  await log.check(`Sign in to SOURCE (${cfg.sourceApi}) and TARGET (${cfg.targetApi}) as System Administrator`, async () => {
    await ctx.src.admin.login(cfg.sourcePassword);
    await ctx.tgt.admin.login(cfg.targetPassword);
    const settings = Object.fromEntries((dataOf(await ctx.tgt.admin.get('/settings')) || []).map((s) => [s.key, s.value]));
    ctx.today = todayIn(settings['general.timezone'] || 'Asia/Manila');
    ctx.cutover = cfg.cutover || ctx.today;
    ctx.receivableAccount = String(settings['accounting.account.premium_receivable'] || '1202001');
    expect(ctx.cutover <= ctx.today, `CUTOVER_DATE ${ctx.cutover} is after today ${ctx.today}: new business is dated today`);
    return `TARGET business date ${ctx.today}; cutover ${ctx.cutover} (opening balances as at ${addDays(ctx.cutover, -1)}); receivables control account ${ctx.receivableAccount}`;
  }, { critical: true });

  await log.check('TARGET starts without business data and without the go-live lock', async () => {
    const kits = dataOf(await ctx.tgt.admin.get('/data-load/kits'));
    const notes = [];
    if (kits.locked) {
      expect(cfg.allowUnlock, 'golive.locked is on: TARGET holds a live book. Set REHEARSAL_ALLOW_UNLOCK=yes only if it is a rehearsal environment');
      await ctx.tgt.admin.put('/settings', { settings: { 'golive.locked': false } });
      notes.push('golive.locked was on: switched off (REHEARSAL_ALLOW_UNLOCK=yes)');
    }
    const counts = await countRows(cfg.targetDb, ['clients', 'policies', 'journal_vouchers', 'opening_balances']);
    if (Object.values(counts).some(Boolean)) {
      const r = await reset(cfg.targetDb, { execute: true, actor: 'go-live rehearsal (pre-flight of a re-run)' });
      notes.push(`business data of an earlier run removed by the transaction reset (${r.total} rows)`);
      await ctx.tgt.admin.login(cfg.targetPassword);
    }
    return notes.join('; ') || `no business data (${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', ')})`;
  }, { critical: true });
}

function choosePlayers() {
  const insurers = ctx.configBook.rows('Insurers').map((r) => r.values['Insurance Company Code']);
  const rated = ctx.configBook.rows('Commission Rates').map((r) => r.values.Insurer).filter(Boolean);
  ctx.smokeInsurer = insurers.find((c) => rated.includes(c)) || insurers[0];
  const bank = ctx.configBook.rows('Bank Accounts')[0];
  ctx.bankAccountCode = bank?.values['Account Code'] || null;
}

async function main() {
  await preflight();
  await step1(ctx);
  choosePlayers();
  await step2(ctx);
  await step3(ctx);
  await step4(ctx);
  await step5(ctx);
  await step6(ctx);
  await step7(ctx);
}

let crashed = null;
try {
  await main();
} catch (e) {
  crashed = e;
  log.info(`stopped: ${e.message}`);
}
try {
  await unlock(ctx);
} catch (e) {
  log.info(`could not switch golive.locked off: ${e.message}`);
}

const passed = log.checks.filter((c) => c.ok).length;
const context = [
  ['SOURCE', cfg.sourceApi], ['TARGET', cfg.targetApi], ['Business date', ctx.today || ''], ['Cutover date', ctx.cutover || ''],
  ['Workbooks saved in', cfg.workDir], ['API calls', ctx.src.api.calls + ctx.tgt.api.calls],
  ['Result', crashed ? `stopped: ${crashed.message}` : log.failures.length ? `${log.failures.length} check(s) failed` : `all ${passed} checks passed`],
];
log.print('');
for (const l of log.summaryLines()) log.print(l);
log.print(`${log.checks.length} checks, ${log.checks.length - passed} failed${crashed ? ' (stopped early)' : ''}`);
if (cfg.report) {
  // hand-written sections of the report (from "## Defects found and fixed" on) are kept across runs
  const kept = fs.existsSync(cfg.report) ? fs.readFileSync(cfg.report, 'utf8').split(/\n(?=## Defects found and fixed)/)[1] : null;
  const intro = 'Generated by `backend/scripts/golive-rehearsal.js` (`npm run rehearsal:golive`). The rehearsal drives two running environments through '
    + 'their public APIs: SOURCE (configuration and business data, think UAT) and TARGET (the environment going live, think Production). '
    + 'It reads SOURCE\'s database only for the open book as at the day before the cutover, and runs the transaction reset on TARGET\'s database.';
  log.write(cfg.report, { title: 'Go-live rehearsal run', intro, context, sections: [{ title: 'Checks step by step', body: log.checksMarkdown() }, ...ctx.sections] });
  if (kept) fs.appendFileSync(cfg.report, `\n${kept.trimEnd()}\n`);
  log.print(`run log written to ${cfg.report}`);
}
process.exit(crashed || log.failures.length ? 1 : 0);
