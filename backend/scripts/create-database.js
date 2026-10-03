/**
 * Create the application database when it does not exist yet (first deployment on a new PostgreSQL server or RDS
 * instance). Tables, reference data and the administrator are created by the API itself when it starts (migrations
 * and seeds); this script only makes sure the database named in DATABASE_URL is there.
 *
 *   node scripts/create-database.js        (reads DATABASE_URL from backend/.env)
 *
 * It connects to the server's "postgres" maintenance database with the same user, host and SSL options. When that
 * user may not create databases and the database is missing, it stops with the statement for a DBA to run.
 */
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('DATABASE_URL is not set (backend/.env)\n');
  process.exit(1);
}

const target = new URL(url);
const name = decodeURIComponent(target.pathname.replace(/^\//, ''));
if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) {
  process.stderr.write(`Database name "${name}" in DATABASE_URL is not a plain identifier\n`);
  process.exit(1);
}

// same server, user and options; the "postgres" database exists on every PostgreSQL server and RDS instance
const admin = new URL(url);
admin.pathname = '/postgres';
// the time zone option belongs to the application database connection, not to this check
admin.searchParams.delete('options');

const quoted = `"${name.replace(/"/g, '""')}"`;
const client = new pg.Client({ connectionString: admin.toString() });
try {
  await client.connect();
  const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (found.rowCount) {
    process.stdout.write(`Database ${name} exists\n`);
  } else {
    try {
      await client.query(`CREATE DATABASE ${quoted}`);
      process.stdout.write(`Database ${name} created\n`);
    } catch (e) {
      if (e.code === '42501') {
        process.stderr.write(`User ${decodeURIComponent(target.username)} may not create databases. Ask a DBA to run:\n  CREATE DATABASE ${quoted} OWNER ${decodeURIComponent(target.username)};\n`);
        process.exitCode = 1;
      } else if (e.code !== '42P04') {
        throw e; // 42P04: created meanwhile by another deployment
      }
    }
  }
} catch (e) {
  process.stderr.write(`Could not check the database on ${target.hostname}: ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
