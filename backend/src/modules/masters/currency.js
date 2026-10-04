/**
 * Currency master rules for the accounting base currency (currencies.is_base, migration 0235):
 *   - exactly one active currency is the base currency; marking another one moves the flag (one statement, the
 *     currencies_one_base exclusion constraint is checked at the end of it);
 *   - the base currency is locked once a journal exists: it can neither move to another currency nor be unflagged;
 *   - the base currency cannot be deactivated or deleted.
 * Exchange rates are not kept here: the dated Exchange Rate master is the only source (lib/currency.js).
 */
import { one, query } from '../../db/pool.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { journalsExist } from '../../lib/currency.js';
import { asBool } from './helpers.js';

export const CURRENCY_TABLE = 'currencies';
const isCurrency = (t) => t.storage === 'table' && t.table_name === CURRENCY_TABLE;

/**
 * Check a create / update / status change of a currency. `next` holds the record's fields after the change, `before`
 * the record before it (null on create), `status` the status after the change. Returns { makeBase } : true when the
 * record must become the base currency once it is written (setBaseCurrency).
 */
export async function checkBaseCurrency(t, next, { before = null, status = 'active' } = {}) {
  if (!isCurrency(t)) return { makeBase: false };
  const wasBase = before ? asBool(before.isBase) === true : false;
  const wantBase = next.isBase === undefined || next.isBase === null ? wasBase : asBool(next.isBase) === true;
  const live = !status || status === 'active';
  if (wasBase && !live) throw conflict(`${before.CurrencyCode} is the accounting base currency and cannot be deactivated or deleted`);
  if (wantBase === wasBase) return { makeBase: false };
  const current = await one("SELECT id, code FROM currencies WHERE is_base AND status = 'active' ORDER BY id LIMIT 1");
  if (wasBase && !wantBase) {
    throw badRequest('Validation failed', [{ path: 'isBase', message: 'A base currency is required: mark another currency as the base currency instead' }]);
  }
  if (!live) throw badRequest('Validation failed', [{ path: 'isBase', message: 'An inactive currency cannot be the base currency' }]);
  if (current && (await journalsExist())) {
    throw conflict(`The accounting base currency (${current.code}) cannot be changed once journals exist`);
  }
  return { makeBase: true };
}

/** Make a currency the only base currency (one statement: the old flag is cleared as the new one is set). */
export async function setBaseCurrency(id) {
  await query('UPDATE currencies SET is_base = (id = $1), updated_at = now() WHERE is_base OR id = $1', [Number(id)]);
}

/** Values to write: the is_base flag is set by setBaseCurrency, never directly. */
export function withoutBaseFlag(t, values) {
  if (!isCurrency(t) || values.isBase === undefined) return values;
  const rest = { ...values };
  delete rest.isBase;
  return rest;
}
