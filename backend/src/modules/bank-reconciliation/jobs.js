/**
 * Scheduled job bank-auto-match (registered by migration 0116, disabled by default): runs the automatic matching rules
 * on every bank account linked to a GL cash account that has unmatched statement lines.
 */
import { withTransaction } from '../../db/pool.js';
import { autoMatch } from './matching.js';

export async function bankAutoMatch() {
  return withTransaction(async (db) => {
    const accounts = (await db.query(`SELECT b.* FROM bank_account_links b WHERE b.gl_account_code IS NOT NULL AND b.status = 'active'
      AND EXISTS (SELECT 1 FROM bank_statement_lines l WHERE l.bank_account_id = b.bank_account_id AND l.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM bank_rec_match_items mi WHERE mi.bank_line_id = l.id AND mi.active)) ORDER BY b.bank_account_code`)).rows;
    const results = [];
    for (const a of accounts) {
      await db.query('SAVEPOINT acct');
      try {
        const r = await autoMatch(db, a, null);
        await db.query('RELEASE SAVEPOINT acct');
        results.push({ bankAccount: a.bank_account_code, matched: r.matched });
      } catch (e) {
        await db.query('ROLLBACK TO SAVEPOINT acct');
        results.push({ bankAccount: a.bank_account_code, error: e.message });
      }
    }
    return { accounts: results.length, matched: results.reduce((s, r) => s + (r.matched || 0), 0), results };
  });
}
