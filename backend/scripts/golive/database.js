/**
 * Direct database work of the rehearsal: the transaction reset of TARGET (the function of npm run reset:transactions,
 * run on TARGET_DATABASE_URL), checksums of TARGET's master and configuration tables, and the read-only snapshot of
 * SOURCE (the "old system") at the close of the day before the cutover, which the API has no as-at view of.
 */
import pg from 'pg';
import { resetTransactions } from '../reset-transactions.js';
import { revealPii } from '../../src/lib/pii.js';
import { MASTER_CONFIG_TABLES } from '../lib/table-classification.js';

/** Columns that change by using the system, not by configuring it (sign-ins, password changes, timestamps). */
const VOLATILE = /^(last_login_at|last_login|last_seen_at|last_activity_at|failed_login_attempts|failed_attempts|locked_until|login_count|password_hash|password_changed_at|must_change_password|updated_at|token_version|last_used_at|last_run_at|next_run_at|last_status|last_error|run_count)$/;

export async function withClient(url, fn) {
  // DATE columns as YYYY-MM-DD text (no time zone shift)
  const types = { getTypeParser: (oid, format) => (oid === 1082 ? (v) => v : pg.types.getTypeParser(oid, format)) };
  const client = new pg.Client({ connectionString: url, types });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Transaction reset of TARGET (dry run or execute); throws ResetRefused when the go-live lock is on. */
export function reset(url, { execute, actor = 'go-live rehearsal' }) {
  return withClient(url, (client) => resetTransactions(client, { execute, actor }));
}

/**
 * Checksum of every master and configuration table of TARGET: { table: { rows, md5 } }. Columns that change by
 * using the system (sign-in times, password hashes, updated_at) are left out.
 */
export function masterChecksums(url) {
  return withClient(url, async (client) => {
    const existing = new Set((await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map((r) => r.tablename));
    const out = {};
    for (const table of MASTER_CONFIG_TABLES.filter((t) => existing.has(t))) {
      const cols = (await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = $1 ORDER BY ordinal_position', [table])).rows
        .map((r) => r.column_name).filter((c) => !VOLATILE.test(c));
      const list = cols.map((c) => `"${c}"`).join(', ');
      const r = (await client.query(`SELECT count(*)::int AS n, md5(COALESCE(string_agg(x, E'\\n' ORDER BY x), '')) AS h FROM (SELECT ROW(${list})::text AS x FROM "${table}") s`)).rows[0];
      out[table] = { rows: r.n, md5: r.h };
    }
    return out;
  });
}

/** Tables whose checksum differs between two checksum sets. */
export function checksumDiff(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((t) => a[t]?.md5 !== b[t]?.md5)
    .map((t) => ({ table: t, before: a[t]?.rows ?? null, after: b[t]?.rows ?? null }));
}

/** Count of rows in some TARGET tables (business data present?). */
export function countRows(url, tables) {
  return withClient(url, async (client) => {
    const out = {};
    for (const t of tables) out[t] = (await client.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n;
    return out;
  });
}

const S = (v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
const money = (v) => String(Math.round(Number(v || 0) * 100) / 100);

/**
 * The old system's open business at the close of cutover - 1, read from SOURCE in one read-only transaction:
 *   policies   in force at cutover: issued before it, expiring on or after it, status active or renewed;
 *   clients    the clients of those policies (and of the open claims);
 *   openItems  their bills with a balance at cutover - 1: today's balance plus the receipts and credits whose journal is
 *              dated on or after the cutover, for bills booked before the cutover;
 *   claims     claims registered or in review, reported before the cutover, on a migrated policy;
 *   glByPolicy premiums receivable control account per policy at cutover - 1 (to explain the control account check).
 * The business date of SOURCE rows is their document date (issue, journal, collection date), not the time they were keyed.
 */
export function sourceSnapshot(url, { cutover, receivableAccount = '1202001' }) {
  return withClient(url, async (client) => {
    await client.query('BEGIN TRANSACTION READ ONLY');
    try {
      const q = async (sql, params = []) => (await client.query(sql, params)).rows;
      const policies = await q(`SELECT p.*, c.client_code, ic.code AS insurer_code, pr.code AS product_code, u.username AS owner_username
        FROM policies p JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
        LEFT JOIN products pr ON pr.id = p.product_id LEFT JOIN users u ON u.id = p.owner_user_id
        WHERE p.issued_date < $1::date AND p.expiry_date >= $1::date AND p.status IN ('active', 'renewed') ORDER BY p.policy_number`, [cutover]);
      const notMigrated = await q(`SELECT p.policy_number, p.status, p.issued_date, p.expiry_date FROM policies p
        WHERE NOT (p.issued_date < $1::date AND p.expiry_date >= $1::date AND p.status IN ('active', 'renewed')) ORDER BY p.policy_number`, [cutover]);
      const ids = policies.map((p) => p.id);
      const bills = await q(`SELECT r.*, p.policy_number,
          r.balance
          + COALESCE((SELECT sum(a.amount) FROM receipt_applications a LEFT JOIN journal_vouchers j ON j.id = a.journal_id
              WHERE a.receivable_id = r.id AND a.status = 'applied' AND COALESCE(j.jv_date, a.collected_on) >= $2::date), 0)
          + COALESCE((SELECT sum(k.amount) FROM receivable_credits k LEFT JOIN journal_vouchers j ON j.id = k.journal_id
              WHERE k.receivable_id = r.id AND COALESCE(j.jv_date, (k.created_at AT TIME ZONE 'Asia/Manila')::date) >= $2::date), 0) AS balance_asof,
          COALESCE(b.jv_date, (r.created_at AT TIME ZONE 'Asia/Manila')::date) AS billed_on
        FROM receivables r JOIN policies p ON p.id = r.policy_id LEFT JOIN journal_vouchers b ON b.id = r.booking_jv_id
        WHERE r.policy_id = ANY($1) ORDER BY p.policy_number, r.bill_number`, [ids, cutover]);
      const openItems = bills.filter((b) => b.billed_on && S(b.billed_on) < cutover && Number(b.balance_asof) > 0.004);
      const claims = await q(`SELECT c.*, p.policy_number, u.username AS handler_username FROM claims c JOIN policies p ON p.id = c.policy_id
        LEFT JOIN users u ON u.id = c.handler_user_id
        WHERE c.status IN ('registered', 'in-review') AND c.reported_date < $1::date AND c.policy_id = ANY($2) ORDER BY c.claim_number`, [cutover, ids]);
      const clientIds = [...new Set(policies.map((p) => p.client_id))];
      const clients = await q('SELECT * FROM clients WHERE id = ANY($1) ORDER BY client_code', [clientIds]);
      const glByPolicy = await q(`SELECT p.policy_number, p.status, p.issued_date, sum(l.debit - l.credit) AS balance FROM journal_lines l
          JOIN journal_vouchers j ON j.id = l.jv_id LEFT JOIN policies p ON p.id = l.policy_id
        WHERE j.status IN ('posted', 'reversed') AND j.jv_date < $1::date AND l.account_code = $2 GROUP BY 1, 2, 3 HAVING sum(l.debit - l.credit) <> 0`, [cutover, receivableAccount]);
      return {
        policies, clients, openItems, claims, glByPolicy, notMigrated,
        rows: {
          clients: clients.map((c) => ({
            'Client Code': c.client_code, 'Client Type': c.client_type, 'First Name': S(c.first_name), 'Last Name': S(c.last_name), 'Company Name': S(c.company_name),
            Email: S(c.email), Phone: S(c.phone), TIN: S(revealPii(c.tin)), 'Birth Date': S(c.birth_date), Gender: S(c.gender), Address: S(c.address), City: S(c.city),
            Province: S(c.state), Country: S(c.country), 'Postal Code': S(c.postal_code),
          })),
          policies: policies.map((p) => {
            const open = openItems.filter((b) => b.policy_id === p.id).reduce((s, b) => s + Number(b.balance_asof), 0);
            const gross = Number(p.premium_total);
            const rate = p.doc?.commissionRate ?? (Number(p.net_premium) > 0 && p.commission_amount !== undefined ? Math.round((Number(p.commission_amount) / Number(p.net_premium)) * 10000) / 10000 : '');
            return {
              'Policy Number': p.policy_number, 'Client Code': p.client_code, Insurer: S(p.insurer_code), Product: S(p.product_code), 'Insured Name': S(p.insured_name),
              'Inception Date': S(p.inception_date), 'Expiry Date': S(p.expiry_date), 'Issue Date': S(p.issued_date), 'Sum Insured': money(p.sum_insured),
              'Net Premium': money(p.net_premium), 'Gross Premium': money(gross), 'Commission Rate': S(rate), 'Billing Mode': S(p.billing_mode),
              'Payment Status': open <= 0.004 ? 'Completed' : open >= gross - 0.004 ? 'Pending' : 'Partial', 'Plate Number': S(p.doc?.plateNumber), 'Account Executive': S(p.owner_username),
            };
          }),
          openItems: openItems.map((b) => ({ 'Policy Number': b.policy_number, 'Bill Reference': b.bill_number, 'Due Date': S(b.due_date), 'Original Amount': money(b.amount), 'Open Balance': money(b.balance_asof) })),
          claims: claims.map((c) => ({
            'Claim Number': c.claim_number, 'Policy Number': c.policy_number, 'Loss Date': S(c.loss_date), 'Reported Date': S(c.reported_date), Status: c.status,
            'Loss Type': S(c.loss_type), Description: S(c.description), 'Outstanding Estimate': money(c.estimate_amount), 'Insurer Claim Number': S(c.insurer_claim_number),
            Handler: S(c.handler_username),
          })),
        },
      };
    } finally {
      await client.query('ROLLBACK').catch(() => {});
    }
  });
}
