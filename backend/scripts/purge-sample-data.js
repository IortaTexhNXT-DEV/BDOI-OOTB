#!/usr/bin/env node
/**
 * Production data reset (npm run purge:sample): removes the demo / sample data from a database that was started with
 * SEED_SAMPLE_DATA on, keeping the reference data (settings, roles, permissions, scheduled jobs, masters, chart of
 * accounts, product templates, report catalogue) and the users you choose. See backend/src/db/seeds/README.md.
 *
 * What it removes:
 *   - every business transaction: leads, clients, quotations, policies, endorsements, receivables, receipts, payments,
 *     collections, disbursements, petty cash, commissions, remittances, reinsurance treaties / cessions, incentive
 *     calculations, claims, renewals, journal vouchers, accounting period closes, notifications, documents and
 *     generated-report records, job history and the document-number counters (numbering restarts at 1).
 *     This is ALL transaction data, not only the seeded rows: run it before go-live, never on a live book.
 *   - the sample master rows seeded from seeds/sample/*.sql: fictional insurers, demo branches (Cebu, Davao),
 *     signatories, commission referrers, reinsurers, incentive programmes and demo master records (companies,
 *     employees, bank accounts, petty cash funds, exchange rates, commission rates).
 *   - the sample users (agent.*, fin.approver), or, with --keep-users, every user except the BrokerVerse administrator
 *     and the users listed.
 * The audit trail is kept (the purge itself is recorded in it) unless --purge-audit is given.
 *
 * Safety: refuses to run unless CONFIRM_PURGE=yes. Dry run by default (prints the row counts it would delete); pass
 * --execute to delete. Everything runs in one transaction: any error rolls the whole purge back.
 *
 * Usage:
 *   CONFIRM_PURGE=yes npm run purge:sample                          # dry run: counts per table
 *   CONFIRM_PURGE=yes npm run purge:sample -- --execute             # purge
 *   CONFIRM_PURGE=yes npm run purge:sample -- --execute --keep-users=jdoe,mreyes --purge-audit
 * DATABASE_URL selects the database (as for the API). Stop the API instances first: the purge locks the tables.
 */
import { fileURLToPath } from 'node:url';

/** Transaction tables, emptied completely (one TRUNCATE, so foreign keys among them are satisfied). */
export const TRANSACTION_TABLES = [
  'leads', 'clients', 'quotes', 'policies', 'endorsements', 'policy_payments', 'documents',
  'broker_slips', 'insurer_offers', 'placements', 'risk_participants',
  'receivables', 'receipts', 'receipt_lines', 'receipt_applications', 'entry_matches', 'invoice_lists',
  'collection_items', 'collection_actions', 'disbursements', 'checkbooks',
  'petty_cash_funds', 'petty_cash_requests', 'petty_cash_request_lines', 'petty_cash_disbursements', 'petty_cash_receipts', 'petty_cash_replenishments',
  'commissions', 'commission_debit_notes', 'commission_debit_note_lines', 'commission_debit_note_collections', 'direct_bill_items',
  'remittances', 'remittance_lines', 'remittance_items', 'remittance_approvals', 'remittance_delegations',
  'reinsurance_treaties', 'cessions', 'reinsurance_recoveries', 'reinsurance_bordereaux', 'reinsurance_reconciliations', 'reinsurance_exceptions',
  'incentive_calculations', 'incentive_results',
  'claims', 'claim_history', 'claim_field_changes',
  'renewals', 'renewal_quotes', 'renewal_notices', 'renewal_activities', 'renewal_batches', 'renewal_batch_policies', 'winback_campaigns',
  'journal_vouchers', 'journal_lines', 'accounting_periods',
  'notifications', 'agent_events', 'email_outbox', 'generated_reports', 'job_runs', 'job_queue', 'sequences',
];
/** With --purge-audit. */
export const AUDIT_TABLES = ['audit_log', 'login_history'];

/** Sample master rows (seeds/sample/*.sql), by natural key. */
export const SAMPLE_MASTERS = [
  { table: 'insurance_companies', label: 'fictional insurers', where: "code IN ('SECUREGUARD','APEX','LIBERTYSHIELD','SENTINEL','GOLDENHORIZON','INTEGRITY','EVERSAFE')" },
  { table: 'branches', label: 'demo branches', where: "code IN ('CEB','DAV')" },
  { table: 'signatories', label: 'fictional signatories', where: "name IN ('Maria Regina Cruz','Jose Antonio Reyes','Ana Patricia Lim')" },
  { table: 'commission_referrers', label: 'fictional referrers', where: "id IN ('ref-jdelacruz','ref-rbautista','ref-amendoza','ref-pvillanueva','ref-mreyes','ref-lgarcia','ref-makatimotors','ref-cebuprime')" },
  { table: 'reinsurers', label: 'sample reinsurers', where: "id IN ('RE001','RE002','RE003','RE004','RE005','RE006') AND created_by = 'seed'" },
  { table: 'incentive_programs', label: 'sample incentive programmes', where: "program_code IN ('INC-2026-001','INC-2026-002','INC-2026-003','INC-2026-004')" },
  { table: 'master_records', label: 'demo master records', where: "created_by = 'seed' AND type_code IN ('company','bank-account','employee','petty-cash','exchange-rate','commission')" },
];
export const SAMPLE_USERS = ['agent.jdelacruz', 'agent.msantos', 'agent.preyes', 'agent.agarcia', 'agent.jmartinez', 'fin.approver'];
export const ADMIN_USERNAME = 'BrokerVerse';

const ident = (t) => `"${t.replace(/"/g, '""')}"`;

/**
 * Plan (and with execute, perform) the purge on a pg client, in one transaction.
 * Returns { executed, tables: [{ table, rows, what }], users: { remove: [...], keep: [...] }, total }.
 */
export async function purgeSampleData(client, { execute = false, keepUsers = null, purgeAudit = false, log = () => {} } = {}) {
  await client.query('BEGIN');
  try {
    const existing = new Set((await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map((r) => r.tablename));
    const txTables = [...TRANSACTION_TABLES, ...(purgeAudit ? AUDIT_TABLES : [])].filter((t) => existing.has(t));
    const plan = [];
    for (const t of txTables) {
      plan.push({ table: t, what: 'all rows', rows: (await client.query(`SELECT count(*)::int AS n FROM ${ident(t)}`)).rows[0].n });
    }
    for (const m of SAMPLE_MASTERS.filter((x) => existing.has(x.table))) {
      plan.push({ table: m.table, what: m.label, where: m.where, rows: (await client.query(`SELECT count(*)::int AS n FROM ${ident(m.table)} WHERE ${m.where}`)).rows[0].n });
    }
    // Users: the administrator always stays. Without --keep-users only the sample users go; with it, everyone not listed.
    const keep = new Set([ADMIN_USERNAME, ...(keepUsers || [])]);
    const users = (await client.query('SELECT id, username FROM users ORDER BY username')).rows;
    const remove = users.filter((u) => !keep.has(u.username) && (keepUsers ? true : SAMPLE_USERS.includes(u.username)));
    const missing = (keepUsers || []).filter((n) => !users.some((u) => u.username === n));
    if (missing.length) log(`warning: --keep-users names unknown user(s): ${missing.join(', ')}`);
    plan.push({ table: 'users', what: keepUsers ? `all users except ${[...keep].join(', ')}` : 'sample users', rows: remove.length });

    if (execute) {
      if (txTables.length) await client.query(`TRUNCATE ${txTables.map(ident).join(', ')} RESTART IDENTITY`);
      for (const p of plan.filter((x) => x.where)) await client.query(`DELETE FROM ${ident(p.table)} WHERE ${p.where}`);
      if (remove.length) {
        const ids = remove.map((u) => u.id);
        // A kept (real) commission referrer linked to a removed user loses the link, not the referrer.
        if (existing.has('commission_referrers')) await client.query('UPDATE commission_referrers SET user_id = NULL WHERE user_id = ANY($1)', [ids]);
        await client.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
      }
      if (existing.has('audit_log')) {
        await client.query(`INSERT INTO audit_log(username, entity, entity_id, action, after_data) VALUES ('system', 'database', 'sample-data', 'purge', $1)`,
          [JSON.stringify({ tables: plan.filter((p) => p.rows).map((p) => ({ table: p.table, what: p.what, rows: p.rows })), removedUsers: remove.map((u) => u.username) })]);
      }
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
    const total = plan.reduce((s, p) => s + p.rows, 0);
    return { executed: execute, tables: plan.map(({ table, what, rows }) => ({ table, what, rows })), users: { remove: remove.map((u) => u.username), keep: [...keep] }, total };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

export function parseArgs(argv) {
  const opts = { execute: false, keepUsers: null, purgeAudit: false, help: false };
  for (const a of argv) {
    if (a === '--execute' || a === '--no-dry-run') opts.execute = true;
    else if (a === '--dry-run') opts.execute = false;
    else if (a === '--purge-audit') opts.purgeAudit = true;
    else if (a.startsWith('--keep-users=')) opts.keepUsers = a.slice('--keep-users='.length).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('Usage: CONFIRM_PURGE=yes npm run purge:sample -- [--dry-run | --execute] [--keep-users=u1,u2] [--purge-audit]');
    return 0;
  }
  if (process.env.CONFIRM_PURGE !== 'yes') {
    console.error('Refusing to run: set CONFIRM_PURGE=yes to confirm you want to purge the sample data (dry run by default, --execute to delete).');
    return 2;
  }
  const { pool } = await import('../src/db/pool.js');
  const client = await pool.connect();
  try {
    const db = (await client.query('SELECT current_database() AS d')).rows[0].d;
    const r = await purgeSampleData(client, { ...opts, log: (m) => console.log(m) });
    console.log(`${r.executed ? 'Purged' : 'DRY RUN: would purge'} ${r.total} row(s) from database ${db}:`);
    for (const t of r.tables.filter((x) => x.rows)) console.log(`  ${t.table.padEnd(36)} ${String(t.rows).padStart(8)}  ${t.what}`);
    if (r.users.remove.length) console.log(`  users ${r.executed ? 'removed' : 'to remove'}: ${r.users.remove.join(', ')}`);
    console.log(`  users kept: ${opts.keepUsers ? r.users.keep.join(', ') : `every user except the sample users (always ${ADMIN_USERNAME})`}`);
    if (!r.executed) console.log('Nothing was changed. Run again with --execute to purge.');
    return 0;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => process.exit(code)).catch((e) => { console.error(`purge failed (nothing was changed): ${e.message}`); process.exit(1); });
}
