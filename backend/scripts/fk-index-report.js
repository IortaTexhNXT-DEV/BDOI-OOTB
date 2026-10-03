/**
 * Foreign keys without a supporting index, read from the PostgreSQL catalog of DATABASE_URL.
 *
 *   node scripts/fk-index-report.js            # table: referencing table.column -> referenced table, rows, indexed?
 *   node scripts/fk-index-report.js --sql      # CREATE INDEX IF NOT EXISTS statements for the unindexed ones
 *   node scripts/fk-index-report.js --json
 *
 * A foreign key counts as indexed when some index starts with exactly its columns (in any order). Referenced tables
 * that are small masters (see MASTER_TABLES) are listed but not proposed when the *referencing* table is itself a
 * small master: indexes are only worth it where the table can grow (transactions, logs, documents, lines).
 * Migration 0146 was generated from this report.
 */
import { pool } from '../src/db/pool.js';

/** Reference / master / set-up tables that stay small (tens to a few thousand rows): FKs *on* them are not indexed. */
export const MASTER_TABLES = new Set([
  'app_settings', 'bank_match_rules', 'bank_statement_formats', 'bank_transaction_types', 'banks', 'branches', 'cities', 'commission_rates',
  'commission_referrers', 'countries', 'coverages', 'currencies', 'districts', 'document_numbering', 'fiscal_years', 'gl_accounts', 'incentive_programs',
  'insurance_companies', 'master_records', 'master_types', 'opening_balances', 'period_close_checklist', 'permissions', 'petty_cash_funds',
  'policy_types', 'postal_codes', 'posting_rule_lines', 'posting_rules', 'product_components', 'product_risk_mappings', 'product_risk_sections',
  'product_templates', 'products', 'recurring_journals', 'reinsurance_treaties', 'reinsurers', 'remittance_delegations', 'report_definitions',
  'report_schedules', 'role_permissions', 'roles', 'scheduled_jobs', 'signatories', 'states', 'tax_codes', 'user_roles', 'vehicle_brands',
  'vehicle_models', 'vehicle_variants', 'write_off_reasons',
]);
/** Maker-checker stamp columns (who approved / rejected / submitted): shown on the record, never joined or filtered on. */
const STAMP_COLUMN = /^(approved_by|rejected_by|submitted_by|confirmed_by|action_by|delegated_to|created_by)$/;

export async function unindexedForeignKeys(db = pool) {
  const { rows } = await db.query(`
    WITH fk AS (
      SELECT c.oid, c.conname, c.conrelid, c.confrelid, c.conkey,
             (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS cols
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.contype = 'f' AND n.nspname = 'public')
    SELECT fk.conname, fk.conrelid::regclass::text AS tbl, fk.confrelid::regclass::text AS ref, fk.cols,
           GREATEST(cl.reltuples, 0)::bigint AS est_rows,
           EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = fk.conrelid
                     AND (i.indkey::int2[])[0:array_length(fk.conkey, 1) - 1] @> fk.conkey
                     AND (i.indkey::int2[])[0:array_length(fk.conkey, 1) - 1] <@ fk.conkey) AS indexed
    FROM fk JOIN pg_class cl ON cl.oid = fk.conrelid
    ORDER BY tbl, conname`);
  return rows;
}

export const indexName = (tbl, cols) => `${tbl}_${cols.join('_')}_fk_idx`.slice(0, 63);
export const proposal = (r) => !r.indexed && !MASTER_TABLES.has(r.tbl) && !(r.cols.length === 1 && STAMP_COLUMN.test(r.cols[0]));

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await unindexedForeignKeys();
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else if (process.argv.includes('--sql')) {
    for (const r of rows.filter(proposal)) console.log(`CREATE INDEX IF NOT EXISTS ${indexName(r.tbl, r.cols)} ON ${r.tbl} (${r.cols.join(', ')});`);
  } else {
    const un = rows.filter((r) => !r.indexed);
    console.log(`${rows.length} foreign keys, ${un.length} without an index, ${un.filter(proposal).length} proposed (growing tables)`);
    for (const r of un) console.log(`${proposal(r) ? '+' : ' '} ${r.tbl}(${r.cols.join(', ')}) -> ${r.ref}`);
  }
  await pool.end();
}
