#!/usr/bin/env node
/**
 * Transaction reset (npm run reset:transactions): removes every business record of a smoke test and keeps ALL masters,
 * configuration and users exactly as they are. Use it in a new environment after the smoke test, or in Production
 * before go-live, then load the go-live migration and switch on golive.locked. See docs/onboarding/SMOKE_TEST_AND_RESET.md.
 *
 * Every table is classified in scripts/lib/table-classification.js (transaction, system or master/configuration); the
 * reset refuses to run while the database has a table that no list names.
 *
 * What it removes:
 *   - every transaction table (leads, clients, quotations, policies, endorsements, receivables, receipts, payments,
 *     collections, disbursements, petty cash movements, commissions, remittances, incentive results, claims, renewals,
 *     journals, accounting periods and fiscal years, period-end closes, bank and insurer reconciliations, credit control,
 *     package sales, payment links, access reviews, consent records);
 *   - notifications, the e-mail outbox, generated report records, job run history and queue, sign-in history,
 *     sign-in sessions and password reset codes;
 *   - the document records of transaction storage folders (with --purge-files also the files of those folders);
 *   - the document number counters of transaction series: each series restarts at the next number configured for the
 *     current period (Master > Document Numbering > Set next number, or the Numbering sheet of the go-live configuration
 *     workbook: the old system's last number + 1), else at its start number; the dry run lists the restart per series.
 *     Counters of series that number master records (MASTER_SERIES: petty cash fund, product template, incentive
 *     programme, commission and employee codes) are kept, since the records they numbered stay;
 *   - the go-live opening balances, unless --keep-opening-balances (the migration is normally reloaded after the reset).
 * The trial balance is then empty and every period is open again: the accounting calendar is regenerated, open, from
 * the first posting or opening balance load. Petty cash funds stay; their establishment journal goes with the ledger,
 * so the fund is detached from it and its available cash set back to the fund size (the cash on hand at go-live comes
 * in with the opening balances).
 * Kept: masters, configuration, users, roles, settings, chart of accounts, product configurator, numbering series
 * definitions, authority matrix, commission rate matrix, tax rules, scheduled job definitions, report catalogue,
 * templates, the audit trail (unless --purge-audit; the reset itself is always recorded in it).
 *
 * Safety: refuses to run unless CONFIRM_RESET=yes, and refuses while the setting golive.locked is on (an administrator
 * switches it off in Master > Configuration > Go-live; that change is audited). Dry run by default (prints the row
 * counts per table); --execute deletes. Everything runs in one transaction: any error rolls the whole reset back.
 *
 * Usage:
 *   CONFIRM_RESET=yes npm run reset:transactions                                   # dry run: counts per table
 *   CONFIRM_RESET=yes npm run reset:transactions -- --execute                      # reset
 *   CONFIRM_RESET=yes npm run reset:transactions -- --execute --keep-opening-balances --purge-files
 * DATABASE_URL selects the database (as for the API), UPLOAD_DIR the file storage. Stop the API instances first: the
 * reset locks the tables.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MASTER_CONFIG_TABLES, MASTER_SERIES, SYSTEM_RESET_ACTIONS, TRANSACTION_FILE_FOLDERS, TRANSACTION_TABLES, classificationGaps,
} from './lib/table-classification.js';
import { GO_LIVE_LOCK_KEY, isGoLiveLocked } from '../src/lib/goLiveLock.js';

const ident = (t) => `"${t.replace(/"/g, '""')}"`;
const GO_LIVE_RUN = 'go-live:%';

export class ResetRefused extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

/** Files under the transaction folders of the storage root: [{ folder, files }]. */
export function transactionFiles(uploadDir) {
  if (!uploadDir) return [];
  const root = path.resolve(uploadDir);
  const count = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
  return TRANSACTION_FILE_FOLDERS.map((folder) => {
    const dir = path.join(root, folder);
    return { folder, dir, files: fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? count(dir) : 0 };
  }).filter((f) => f.files > 0);
}

/**
 * Restart of the series whose counters the reset deletes: [{ series, period, restartAt, preview, configured }] where
 * restartAt is the first number issued after the reset in the current period, configured true when it is the next
 * number set for that period (period_start_number, migration 0246) rather than the series' start number.
 */
export async function restartNumbers(client, names) {
  if (!names.length) return [];
  const withPeriodStart = (await client.query("SELECT to_regproc('numbering_start_number') IS NOT NULL AS ok")).rows[0].ok;
  const start = withPeriodStart ? 'numbering_start_number(d.code, k.period)' : 'd.start_number';
  const rows = (await client.query(`SELECT d.code, k.period, ${start} AS restart_at, ${start} IS DISTINCT FROM d.start_number AS configured,
      format_document_number(d.pattern, d.prefix, d.seq_width, ${start}, numbering_business_date(), NULL, NULL) AS preview
    FROM document_numbering d CROSS JOIN LATERAL (SELECT numbering_period_key(d.reset_rule, numbering_business_date()) AS period) k
    WHERE d.code = ANY($1)`, [names.map((n) => n.replace(/-/g, '_'))])).rows;
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return names.map((name) => {
    const r = byCode.get(name.replace(/-/g, '_'));
    return r ? { series: name, period: r.period, restartAt: Number(r.restart_at), preview: r.preview, configured: r.configured }
      : { series: name, period: null, restartAt: 1, preview: null, configured: false };
  });
}

const countRows = async (db, table, where = 'true', params = []) => (await db.query(`SELECT count(*)::int AS n FROM ${ident(table)} WHERE ${where}`, params)).rows[0].n;

/**
 * Plan (and with execute, perform) the reset on a pg client, in one transaction.
 * Options: execute, keepOpeningBalances, purgeAudit, purgeFiles (with uploadDir), actor (recorded in the audit trail).
 * Returns { executed, tables: [{ table, category, what, rows }], kept: { tables, rows }, series: { reset, kept, restart }, files, total }.
 * Throws ResetRefused (code GOLIVE_LOCKED or UNCLASSIFIED_TABLES) without changing anything.
 */
export async function resetTransactions(client, {
  execute = false, keepOpeningBalances = false, purgeAudit = false, purgeFiles = false, uploadDir = null, actor = 'system', log = () => {},
} = {}) {
  await client.query('BEGIN');
  let committed = false;
  try {
    if (await isGoLiveLocked(client)) {
      throw new ResetRefused(`Refusing to reset: ${GO_LIVE_LOCK_KEY} is on, this database holds the live book. An administrator switches it off in `
        + 'Master > Configuration > Go-live (recorded in the audit trail) only if the database really has to be reset.', 'GOLIVE_LOCKED');
    }
    const existing = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.tablename);
    const gaps = classificationGaps(existing);
    if (gaps.unclassified.length) {
      throw new ResetRefused(`Refusing to reset: table(s) ${gaps.unclassified.join(', ')} are not classified in scripts/lib/table-classification.js`, 'UNCLASSIFIED_TABLES');
    }
    const has = new Set(existing);

    // Tables emptied completely.
    const removeAll = [
      ...TRANSACTION_TABLES.filter((t) => !(keepOpeningBalances && t === 'fiscal_years')).map((t) => ({ table: t, category: 'transaction' })),
      ...Object.entries(SYSTEM_RESET_ACTIONS).filter(([t, a]) => a === 'remove'
        || (t === 'opening_balances' && !keepOpeningBalances) || (t === 'audit_log' && purgeAudit)).map(([t]) => ({ table: t, category: 'system' })),
    ].filter((x) => has.has(x.table));
    const removeSet = new Set(removeAll.map((x) => x.table));
    const plan = [];
    for (const x of removeAll) plan.push({ ...x, what: 'all rows', rows: await countRows(client, x.table) });

    // Partial removals.
    const seriesKey = "replace(name, '-', '_')";
    const partial = [];
    if (has.has('documents')) {
      partial.push({ table: 'documents', category: 'system', what: 'records of transaction storage folders', where: "split_part(storage_key, '/', 1) = ANY($1)", params: [TRANSACTION_FILE_FOLDERS] });
    }
    if (has.has('sequences')) {
      partial.push({ table: 'sequences', category: 'system', what: 'counters of transaction series (restart at the configured next number of the period, else the start number)', where: `NOT (${seriesKey} = ANY($1))`, params: [MASTER_SERIES] });
    }
    if (keepOpeningBalances) {
      if (has.has('opening_balances')) partial.push({ table: 'opening_balances', category: 'system', what: 'balances carried forward by a year-end close (go-live balances kept)', where: 'COALESCE(source_run, \'\') NOT LIKE $1', params: [GO_LIVE_RUN] });
      if (has.has('fiscal_years')) partial.push({ table: 'fiscal_years', category: 'transaction', what: 'fiscal years without go-live opening balances (the others reopened)', where: 'code NOT IN (SELECT fiscal_year FROM opening_balances WHERE source_run LIKE $1)', params: [GO_LIVE_RUN] });
    }
    for (const p of partial) plan.push({ ...p, rows: await countRows(client, p.table, p.where, p.params) });

    // Petty cash funds are kept, detached from their establishment journal.
    const pettyCash = has.has('petty_cash_funds') ? await countRows(client, 'petty_cash_funds', 'journal_id IS NOT NULL OR transaction_number IS NOT NULL OR available_cash <> fund_size') : 0;

    // Counters and series.
    const counters = has.has('sequences') ? (await client.query(`SELECT name, ${seriesKey} AS code, period, value FROM sequences ORDER BY name, period`)).rows : [];
    const series = {
      reset: [...new Set(counters.filter((c) => !MASTER_SERIES.includes(c.code)).map((c) => c.name))],
      kept: [...new Set(counters.filter((c) => MASTER_SERIES.includes(c.code)).map((c) => c.name))],
    };
    // Where each restarted series starts again: the next number configured for the current period (Set next number,
    // go-live Numbering sheet), else its start number.
    series.restart = await restartNumbers(client, series.reset);
    const keptTables = existing.filter((t) => MASTER_CONFIG_TABLES.includes(t));
    let keptRows = 0;
    for (const t of keptTables) keptRows += await countRows(client, t);
    const files = purgeFiles ? transactionFiles(uploadDir) : [];

    if (execute) {
      if (pettyCash) {
        await client.query('UPDATE petty_cash_funds SET journal_id = NULL, transaction_number = NULL, available_cash = fund_size, updated_at = now() WHERE journal_id IS NOT NULL OR transaction_number IS NOT NULL OR available_cash <> fund_size');
      }
      // A kept table may reference a table that is emptied (petty_cash_funds.journal_id): the reference is cleared and the
      // constraint set aside for the TRUNCATE, then restored (it validates, since the references are cleared).
      const fks = (await client.query(`SELECT c.conname, c.conrelid::regclass::text AS tbl, c.confrelid::regclass::text AS ref, pg_get_constraintdef(c.oid) AS def,
          (SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS cols,
          (SELECT bool_or(a.attnotnull) FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS notnull
        FROM pg_constraint c WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`)).rows
        .map((f) => ({ ...f, tbl: f.tbl.replace(/"/g, ''), ref: f.ref.replace(/"/g, '') }))
        .filter((f) => !removeSet.has(f.tbl) && removeSet.has(f.ref));
      for (const f of fks) {
        if (f.notnull) throw new Error(`${f.tbl}.${f.cols.join(',')} must reference ${f.ref}, which the reset empties: classify ${f.tbl} or ${f.ref} again`);
        await client.query(`UPDATE ${ident(f.tbl)} SET ${f.cols.map((c) => `${ident(c)} = NULL`).join(', ')} WHERE ${f.cols.map((c) => `${ident(c)} IS NOT NULL`).join(' OR ')}`);
        await client.query(`ALTER TABLE ${ident(f.tbl)} DROP CONSTRAINT ${ident(f.conname)}`);
      }
      if (removeAll.length) await client.query(`TRUNCATE ${removeAll.map((x) => ident(x.table)).join(', ')} RESTART IDENTITY`);
      for (const f of fks) await client.query(`ALTER TABLE ${ident(f.tbl)} ADD CONSTRAINT ${ident(f.conname)} ${f.def}`);
      for (const p of partial) await client.query(`DELETE FROM ${ident(p.table)} WHERE ${p.where}`, p.params);
      if (keepOpeningBalances && has.has('fiscal_years')) {
        await client.query("UPDATE fiscal_years SET status = 'open', closed_by = NULL, closed_at = NULL, updated_at = now() WHERE status <> 'open'");
      }
      if (has.has('audit_log')) {
        await client.query(`INSERT INTO audit_log(username, entity, entity_id, action, after_data) VALUES ($1, 'database', 'transactions', 'reset', $2)`,
          [actor, JSON.stringify({
            tables: plan.filter((p) => p.rows).map((p) => ({ table: p.table, what: p.what, rows: p.rows })),
            seriesRestarted: series.restart.map((x) => ({ series: x.series, restartAt: x.restartAt })), seriesKept: series.kept, pettyCashFundsDetached: pettyCash,
            keepOpeningBalances, purgeAudit, purgeFiles: purgeFiles ? files.map((f) => ({ folder: f.folder, files: f.files })) : false,
          })]);
      }
      await client.query('COMMIT');
      committed = true;
      for (const f of files) {
        fs.rmSync(f.dir, { recursive: true, force: true });
        log(`removed ${f.files} file(s) under ${f.folder}/`);
      }
    } else {
      await client.query('ROLLBACK');
    }
    if (pettyCash) plan.push({ table: 'petty_cash_funds', category: 'master', what: 'funds kept, detached from the establishment journal (available cash = fund size)', rows: 0, updated: pettyCash });
    const total = plan.reduce((s, p) => s + p.rows, 0);
    return {
      executed: execute,
      tables: plan.map(({ table, category, what, rows, updated }) => ({ table, category, what, rows, ...(updated ? { updated } : {}) })),
      kept: { tables: keptTables.length, rows: keptRows },
      series,
      files: files.map(({ folder, files: n }) => ({ folder, files: n })),
      total,
    };
  } catch (e) {
    if (!committed) await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

export function parseArgs(argv) {
  const opts = { execute: false, keepOpeningBalances: false, purgeAudit: false, purgeFiles: false, help: false };
  for (const a of argv) {
    if (a === '--execute') opts.execute = true;
    else if (a === '--dry-run') opts.execute = false;
    else if (a === '--keep-opening-balances') opts.keepOpeningBalances = true;
    else if (a === '--keep-audit') opts.purgeAudit = false;
    else if (a === '--purge-audit') opts.purgeAudit = true;
    else if (a === '--purge-files') opts.purgeFiles = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

const USAGE = 'Usage: CONFIRM_RESET=yes npm run reset:transactions -- [--dry-run | --execute] [--keep-opening-balances] [--keep-audit | --purge-audit] [--purge-files]';

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (process.env.CONFIRM_RESET !== 'yes') {
    console.error('Refusing to run: set CONFIRM_RESET=yes to confirm you want to remove all transactions (dry run by default, --execute to delete).');
    return 2;
  }
  const { pool } = await import('../src/db/pool.js');
  const { config } = await import('../src/config.js');
  const client = await pool.connect();
  try {
    const db = (await client.query('SELECT current_database() AS d')).rows[0].d;
    let r;
    try {
      r = await resetTransactions(client, { ...opts, uploadDir: config.uploadDir, actor: process.env.RESET_ACTOR || process.env.USER || 'system', log: (m) => console.log(m) });
    } catch (e) {
      if (e instanceof ResetRefused) {
        console.error(e.message);
        return 3;
      }
      throw e;
    }
    console.log(`${r.executed ? 'Removed' : 'DRY RUN: would remove'} ${r.total} row(s) from database ${db}:`);
    for (const t of r.tables.filter((x) => x.rows || x.updated)) {
      console.log(`  ${t.table.padEnd(36)} ${String(t.rows || t.updated).padStart(8)}  ${t.category.padEnd(11)} ${t.what}`);
    }
    console.log(`  kept: ${r.kept.tables} master and configuration tables (${r.kept.rows} rows), users, the audit trail${opts.purgeAudit ? ' (emptied: --purge-audit)' : ''}`);
    if (r.series.restart.length) {
      console.log(`  numbering restarts (${r.series.restart.length} transaction series), first number after the reset:`);
      for (const x of r.series.restart) {
        console.log(`    ${x.series.padEnd(28)} ${String(x.restartAt).padStart(8)}  ${(x.preview || '').padEnd(22)} ${x.configured ? 'next number configured for the period' : 'start number of the series'}`);
      }
    }
    if (r.series.kept.length) console.log(`  numbering continues (master records keep their codes) for: ${r.series.kept.join(', ')}`);
    if (opts.purgeFiles) console.log(r.files.length ? `  files ${r.executed ? 'removed' : 'to remove'}: ${r.files.map((f) => `${f.folder}/ ${f.files}`).join(', ')}` : '  no transaction files in storage');
    console.log(`  opening balances: ${opts.keepOpeningBalances ? 'go-live balances kept' : 'removed (load the go-live migration again)'}`);
    if (!r.executed) console.log('Nothing was changed. Run again with --execute to reset.');
    else console.log(`Done. Load the go-live migration, then switch on ${GO_LIVE_LOCK_KEY} (Master > Configuration > Go-live).`);
    return 0;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => process.exit(code)).catch((e) => { console.error(`reset failed (nothing was changed): ${e.message}`); process.exit(1); });
}
