/**
 * The append-only audit trail and its one recorded bypass (migrations 0591, 0596): setting app.audit_purge by hand
 * does nothing, the bypass writes its own entries that nothing can remove, it may only delete or rewrite personal data,
 * the audit trail is never truncated, and an application request can never use it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { requestContext } from '../src/lib/requestContext.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

beforeAll(async () => { await setup(); });
afterAll(async () => { await pool.end(); });

/** Run fn(client) in a transaction that is always rolled back. */
async function inTx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    return await fn(c);
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    c.release();
  }
}
const seedEntry = async () => (await one("INSERT INTO audit_log(username, entity, entity_id, action, after_data) VALUES ('t', 'policy', 'pol_x', 'update', '{\"name\":\"Juan\"}') RETURNING id")).id;

describe('append-only audit trail', () => {
  it('setting app.audit_purge by hand, or forging a token, deletes and changes nothing', async () => {
    const id = await seedEntry();
    for (const value of ['on', 'tx:1']) {
      await expect(inTx(async (c) => {
        await c.query("SELECT set_config('app.audit_purge', $1, true)", [value]);
        await c.query('DELETE FROM audit_log WHERE id = $1', [id]);
      })).rejects.toThrow(/cannot be changed or deleted/);
    }
    // the token of the transaction without its recorded begin entry is refused too
    await expect(inTx(async (c) => {
      await c.query("SELECT set_config('app.audit_purge', audit_bypass_token(), true)");
      await c.query("UPDATE audit_log SET after_data = '{}' WHERE id = $1", [id]);
    })).rejects.toThrow(/cannot be changed or deleted/);
    await expect(query('TRUNCATE audit_log')).rejects.toThrow(/cannot be truncated/);
    expect(await one('SELECT id FROM audit_log WHERE id = $1', [id])).toEqual({ id });
  });

  it('the bypass needs a tool and a reason, records itself first and its row count at the end, and its entries cannot be removed', async () => {
    await expect(inTx((c) => c.query("SELECT audit_bypass_begin('housekeeping', '')"))).rejects.toThrow(/tool and a reason/);
    const a = await seedEntry();
    const b = await seedEntry();
    const c = await pool.connect();
    let token;
    try {
      await c.query('BEGIN');
      await c.query("SELECT audit_bypass_begin('test-tool', 'retention test', 'tester')");
      token = (await c.query('SELECT audit_bypass_token() AS t')).rows[0].t;
      expect((await c.query('DELETE FROM audit_log WHERE id = ANY($1)', [[a, b]])).rowCount).toBe(2);
      // its own entries stay, under the bypass too; the audit trail is still never truncated
      await c.query('SAVEPOINT s');
      await expect(c.query("DELETE FROM audit_log WHERE entity = 'audit_bypass'")).rejects.toThrow(/bypass cannot be changed or deleted/);
      await c.query('ROLLBACK TO SAVEPOINT s');
      await expect(c.query('TRUNCATE audit_log')).rejects.toThrow(/cannot be truncated/);
      await c.query('ROLLBACK TO SAVEPOINT s');
      await c.query('SELECT audit_bypass_end()');
      await c.query('COMMIT');
    } finally {
      c.release();
    }
    const entries = (await query("SELECT action, username, after_data FROM audit_log WHERE entity = 'audit_bypass' AND entity_id = $1 ORDER BY id", [token])).rows;
    expect(entries.map((e) => e.action)).toEqual(['begin', 'end']);
    expect(entries[0]).toMatchObject({ username: 'tester', after_data: expect.objectContaining({ tool: 'test-tool', reason: 'retention test', actor: 'tester' }) });
    expect(entries[1].after_data).toMatchObject({ rowsDeleted: 2, rowsUpdated: 0 });
    // the bypass ends with the transaction: the next one is append-only again
    await expect(query("UPDATE audit_log SET after_data = '{}' WHERE entity = 'audit_bypass'")).rejects.toThrow(/bypass cannot be changed or deleted/);
  });

  it('an update under the bypass may rewrite personal data only, never who, when, what or which record', async () => {
    const id = await seedEntry();
    await expect(inTx(async (c) => {
      await c.query("SELECT audit_bypass_begin('mask-data', 'test')");
      await c.query("UPDATE audit_log SET action = 'view' WHERE id = $1", [id]);
    })).rejects.toThrow(/Only the personal data/);
    await expect(inTx(async (c) => {
      await c.query("SELECT audit_bypass_begin('mask-data', 'test')");
      await c.query("UPDATE audit_log SET at = now() - interval '1 year' WHERE id = $1", [id]);
    })).rejects.toThrow(/Only the personal data/);
    const r = await inTx(async (c) => {
      await c.query("SELECT audit_bypass_begin('mask-data', 'test')");
      await c.query("UPDATE audit_log SET after_data = '{\"name\":\"Masked\"}' WHERE id = $1", [id]);
      await c.query('SELECT audit_bypass_end()');
      return (await c.query("SELECT after_data FROM audit_log WHERE entity = 'audit_bypass' AND action = 'end' AND entity_id = audit_bypass_token()")).rows[0];
    });
    expect(r.after_data).toMatchObject({ tool: 'mask-data', rowsUpdated: 1, rowsDeleted: 0 });
  });
});

describe('application requests', () => {
  it('a query that names the bypass is refused while a request is served, before it reaches the database', async () => {
    const id = await seedEntry();
    const inRequest = (fn) => new Promise((resolve, reject) => requestContext({ method: 'GET', url: '/api/x' }, {}, () => fn().then(resolve, reject)));
    await expect(inRequest(() => query("SELECT set_config('app.audit_purge', 'on', false)"))).rejects.toThrow(/cannot be used by an application request/);
    await expect(inRequest(() => query("SELECT audit_bypass_begin('api', 'x')"))).rejects.toThrow(/cannot be used by an application request/);
    // even with the session value set by hand on the connection, a request cannot delete
    await expect(inRequest(async () => {
      await query('SELECT 1');
      return query('DELETE FROM audit_log WHERE id = $1', [id]);
    })).rejects.toThrow(/cannot be changed or deleted/);
    expect(await one('SELECT id FROM audit_log WHERE id = $1', [id])).toEqual({ id });
  });

  it('only the housekeeping job, the operator tools and the migrations name the bypass', () => {
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|sql)$/.test(e.name) && files.push(path.join(d, e.name))));
    walk(path.join(ROOT, 'src'));
    const users = files.filter((f) => /audit_purge|audit_bypass_begin/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
    expect(users.filter((f) => !f.startsWith('src/db/migrations/')).sort()).toEqual(['src/db/pool.js', 'src/jobs/housekeeping.js']);
  });
});
