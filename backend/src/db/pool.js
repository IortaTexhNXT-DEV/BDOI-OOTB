import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;
// NUMERIC -> number, BIGINT -> number, DATE -> ISO date string
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

/**
 * Ambient transaction (runInTransaction): while one is active in the current async context, query / one / many and
 * pool.query run on its client, and withTransaction opens a SAVEPOINT on that client instead of a new connection. So
 * code written against the pool helpers (master records, settings, numbering ...) and code that takes a `db` client
 * see the same uncommitted rows, and a whole workbook can be checked in one transaction that is rolled back (dry run).
 *
 * Outside an ambient transaction nothing changes: withTransaction takes its own connection and the helpers use the
 * pool. Store: { client, seq (savepoint counter shared by the transaction), chain (serialises sibling savepoints),
 * closed (set when the transaction ends, so a late fire-and-forget query falls back to the pool and never reaches a
 * connection that has gone back to the pool) }.
 */
const ambient = new AsyncLocalStorage();
const active = () => {
  const s = ambient.getStore();
  return s && !s.closed ? s : null;
};

/** True while an ambient transaction (runInTransaction) is active in the current async context. */
export const inTransaction = () => !!active();

const poolQuery = pool.query.bind(pool);
// pool.query is used directly by a few modules: it follows the ambient transaction too.
pool.query = (...args) => {
  const s = active();
  return s ? s.client.query(...args) : poolQuery(...args);
};

export const query = (text, params) => pool.query(text, params);

/** Run task after the earlier sibling savepoints of the same level (savepoints on one client must nest, never interleave). */
function serialise(store, task) {
  const run = store.chain.then(task, task);
  store.chain = run.then(() => undefined, () => undefined);
  return run;
}

/** A savepoint on the ambient client: fn's changes are kept on success and undone on error. */
function savepoint(store, fn) {
  return serialise(store, async () => {
    store.seq.n += 1;
    const name = `bv_sp_${store.seq.n}`;
    const { client } = store;
    await client.query(`SAVEPOINT ${name}`);
    const inner = { client, seq: store.seq, chain: Promise.resolve(), closed: false };
    try {
      const result = await ambient.run(inner, () => fn(client));
      await inner.chain;
      await client.query(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (e) {
      await inner.chain;
      try {
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        await client.query(`RELEASE SAVEPOINT ${name}`);
      } catch { /* the outer transaction is failed; its own rollback follows */ }
      throw e;
    }
  });
}

/**
 * Run fn inside a transaction; fn receives a client with the same query() API. Inside an ambient transaction this is
 * a savepoint of it (rolled back alone when fn throws).
 */
export async function withTransaction(fn) {
  const store = active();
  if (store) return savepoint(store, fn);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Run fn in an ambient transaction: everything fn does through query / one / many / pool.query / withTransaction runs
 * on one client. rollback: true undoes everything at the end (dry run) and returns fn's result. Nested inside another
 * ambient transaction it becomes a savepoint (rolled back at the end when rollback is set).
 */
export async function runInTransaction(fn, { rollback = false } = {}) {
  const outer = active();
  if (outer) {
    if (!rollback) return savepoint(outer, fn);
    const undo = new Error('dry run');
    let result;
    try {
      await savepoint(outer, async (c) => { result = await fn(c); throw undo; });
    } catch (e) {
      if (e !== undo) throw e;
    }
    return result;
  }
  const client = await pool.connect();
  const store = { client, seq: { n: 0 }, chain: Promise.resolve(), closed: false };
  let broken = false;
  try {
    await client.query('BEGIN');
    const result = await ambient.run(store, () => fn(client));
    await store.chain;
    await client.query(rollback ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch (e) {
    await store.chain.catch(() => undefined);
    try { await client.query('ROLLBACK'); } catch { broken = true; }
    throw e;
  } finally {
    store.closed = true;
    client.release(broken ? true : undefined);
  }
}

export const one = async (text, params) => (await query(text, params)).rows[0] ?? null;
export const many = async (text, params) => (await query(text, params)).rows;
