/**
 * Create or update the named users of an installation from a CSV file kept OUTSIDE the repository
 * (columns: name, username, password, role[, email]). Each user gets the role (replacing its roles), the initial
 * password and must change it at the first sign-in; the password policy applies to the new password they choose.
 *
 *   DATABASE_URL=postgres://... CONFIRM_PROVISION=yes node scripts/provision-users.js /secure/path/users.csv
 *
 * Dry run (lists what would change) unless CONFIRM_PROVISION=yes. Never commit the CSV.
 *
 * On a hosted environment without database access from outside (Railway), run it from a one-off service of the
 * project: the CSV content in a variable, written to a file by the start command, the variable removed afterwards.
 */
import fs from 'node:fs';
import { withTransaction, pool } from '../src/db/pool.js';
import { savePassword } from '../src/lib/password.js';
import { parseCsv } from '../src/modules/documents/tabular.js';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('usage: node scripts/provision-users.js <users.csv>  (columns: name, username, password, role[, email])');
  process.exit(2);
}
const [header, ...rows] = parseCsv(fs.readFileSync(file, 'utf8'));
const col = (h) => header.findIndex((x) => x.trim().toLowerCase() === h);
const idx = { name: col('name'), username: col('username'), password: col('password'), role: col('role'), email: col('email') };
if ([idx.name, idx.username, idx.password, idx.role].some((i) => i < 0)) {
  console.error('the CSV needs the columns name, username, password and role');
  process.exit(2);
}
const apply = process.env.CONFIRM_PROVISION === 'yes';

await withTransaction(async (db) => {
  for (const r of rows) {
    const u = { name: r[idx.name].trim(), username: r[idx.username].trim().toLowerCase(), password: r[idx.password], role: r[idx.role].trim(), email: idx.email >= 0 ? r[idx.email].trim() : '' };
    const role = (await db.query('SELECT id FROM roles WHERE code = $1', [u.role])).rows[0];
    if (!role) throw new Error(`Unknown role ${u.role} for ${u.username}`);
    let user = (await db.query('SELECT id FROM users WHERE lower(username) = $1', [u.username])).rows[0];
    console.log(`${apply ? '' : '[dry run] '}${user ? 'update' : 'create'} ${u.username} (${u.name}) as ${u.role}`);
    if (!apply) continue;
    if (!user) {
      user = (await db.query(`INSERT INTO users(username, display_name, email, status, password_hash) VALUES ($1, $2, NULLIF($3, ''), 'active', '!') RETURNING id`,
        [u.username, u.name, u.email])).rows[0];
    } else {
      await db.query(`UPDATE users SET display_name = $2, email = COALESCE(NULLIF($3, ''), email), status = 'active', failed_logins = 0 WHERE id = $1`, [user.id, u.name, u.email]);
    }
    await db.query('DELETE FROM user_roles WHERE user_id = $1', [user.id]);
    await db.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)', [user.id, role.id]);
    await savePassword(user.id, u.password, { db, extraSql: 'must_change_password = true, token_version = token_version + 1' });
    await db.query(`INSERT INTO audit_log(username, entity, entity_id, action, after_data) VALUES ('provision-users', 'user', $1, 'provision', $2)`,
      [user.id, JSON.stringify({ username: u.username, roles: [u.role], mustChangePassword: true })]);
  }
});
await pool.end();
