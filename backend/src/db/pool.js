import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;
// NUMERIC -> number, BIGINT -> number, DATE -> ISO date string
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

export const query = (text, params) => pool.query(text, params);

/** Run fn inside a transaction; fn receives a client with the same query() API. */
export async function withTransaction(fn) {
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

export const one = async (text, params) => (await query(text, params)).rows[0] ?? null;
export const many = async (text, params) => (await query(text, params)).rows;
