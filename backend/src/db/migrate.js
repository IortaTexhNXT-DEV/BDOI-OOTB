import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'migrations');

/** Migration files not yet applied (the whole list when schema_migrations does not exist yet). */
export async function pendingMigrations() {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const exists = (await pool.query("SELECT to_regclass('public.schema_migrations') AS t")).rows[0].t;
  const done = exists ? new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name)) : new Set();
  return files.filter((f) => !done.has(f));
}

/**
 * Advisory-lock key of the migrate step (int4 pair). Several API instances starting together (and `npm run migrate`)
 * take this session lock first, so only one applies the pending migrations; the others wait, then find nothing to do.
 */
export const MIGRATION_LOCK = "hashtext('brokerverse.migrate'), hashtext('schema_migrations')";

export async function migrate({ reset = false, log = console.log, lockTimeoutMs = Number(process.env.MIGRATION_LOCK_TIMEOUT_MS || 600000) } = {}) {
  const client = await pool.connect();
  let locked = false;
  try {
    // Wait for another instance's migrate step (bounded by lockTimeoutMs, default 10 minutes).
    await client.query(`SET lock_timeout = ${Math.max(0, Math.floor(lockTimeoutMs))}`);
    const t0 = Date.now();
    if (!(await client.query(`SELECT pg_try_advisory_lock(${MIGRATION_LOCK}) AS ok`)).rows[0].ok) {
      log('waiting for another instance to finish migrating');
      await client.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK})`);
      log(`migration lock acquired after ${Date.now() - t0} ms`);
    }
    locked = true;
    await client.query('RESET lock_timeout');
    if (reset) {
      // Tables are dropped in batches, each in its own transaction: one DROP SCHEMA CASCADE over several hundred
      // tables (and their indexes, sequences and triggers) needs more locks than a default server allows
      // (max_locks_per_transaction 64: "out of shared memory").
      const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map((r) => r.tablename);
      for (let i = 0; i < tables.length; i += 40) {
        await client.query(`DROP TABLE IF EXISTS ${tables.slice(i, i + 40).map((t) => `public."${t.replace(/"/g, '""')}"`).join(', ')} CASCADE`);
      }
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      log('schema reset');
    }
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
        await client.query('COMMIT');
        log(`applied ${f}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${f} failed: ${e.message}`);
      }
    }
  } finally {
    await client.query('RESET lock_timeout').catch(() => {});
    if (locked) await client.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK})`).catch(() => {});
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Migrations are forward-only in deployed environments: --reset drops every table, so it is refused in production.
  if (process.argv.includes('--reset') && process.env.NODE_ENV === 'production') {
    console.error('migrate --reset drops the whole schema and is refused with NODE_ENV=production.');
    process.exit(1);
  }
  migrate({ reset: process.argv.includes('--reset') })
    .then(() => pool.end())
    .catch((e) => { console.error(e); process.exit(1); });
}
