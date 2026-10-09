import { badRequest } from '../../lib/errors.js';

/** Active records of a generic master type as plain objects ({ id, code, name, ...data }), for the modules that use them. */
export async function activeRecords(db, type) {
  const rows = (await db.query('SELECT id, code, name, data FROM master_records WHERE type_code = $1 AND status = \'active\' ORDER BY code', [type])).rows;
  return rows.map((r) => ({ ...(r.data || {}), id: r.id, code: r.code, name: r.name }));
}

/** One active record of a type by code (case-insensitive) or id; null when there is none. */
export async function activeRecord(db, type, ref) {
  if (ref === null || ref === undefined || ref === '') return null;
  const r = (await db.query(`SELECT id, code, name, data FROM master_records WHERE type_code = $1 AND status = 'active'
    AND (lower(code) = lower($2) OR id::text = $2) ORDER BY (lower(code) = lower($2)) DESC LIMIT 1`, [type, String(ref)])).rows[0];
  return r ? { ...(r.data || {}), id: r.id, code: r.code, name: r.name } : null;
}

/**
 * The reason of a decision (claim repudiation, quotation decline, renewal lapse ...) from the reason-code master
 * (Master > Insurance Management > Reason Codes). A reasonCode must be an active code of one of the contexts, and a
 * code marked "requires note" needs the free-text reason as well. Without a code the free-text reason is kept as it is.
 * Returns { code, text }: the text is the reason's name followed by the note, or the note alone.
 */
export async function decisionReason(db, contexts, { reasonCode, reason } = {}) {
  const note = String(reason ?? '').trim() || null;
  if (reasonCode === undefined || reasonCode === null || String(reasonCode).trim() === '') return { code: null, text: note };
  const r = await activeRecord(db, 'reason-code', String(reasonCode).trim());
  if (!r || !contexts.includes(r.context)) {
    throw badRequest('Validation failed', [{ path: 'reasonCode', message: `${reasonCode} is not an active reason code for ${contexts.join(' or ')} (Master > Insurance Management > Reason Codes)` }]);
  }
  if (['true', 'yes', '1'].includes(String(r.requiresNote).toLowerCase()) && !note) throw badRequest('Validation failed', [{ path: 'reason', message: `Reason ${r.code} (${r.name}) needs a note` }]);
  return { code: r.code, text: note ? `${r.name}: ${note}` : r.name };
}

/**
 * The reason a decision cannot be taken without (a period close or reopening, a year-end reversal, a void of a
 * printed book, an incentive batch rejection; the contexts of seed 88_accounting_reasons.sql): reasonCode must be an
 * active code of the context, and a code marked "requires note" needs the note as well. Returns
 * { code, name, note, text }: text is the reason's name followed by the note, the form kept in the remarks and the
 * audit trail beside the code.
 */
export async function requiredReason(db, context, { reasonCode, note } = {}) {
  const code = String(reasonCode ?? '').trim();
  const remark = String(note ?? '').trim() || null;
  if (!code) throw badRequest('Validation failed', [{ path: 'reasonCode', message: 'Choose the reason' }]);
  const r = await activeRecord(db, 'reason-code', code);
  if (!r || r.context !== context) {
    throw badRequest('Validation failed', [{ path: 'reasonCode', message: `${code} is not a reason for this action` }]);
  }
  if (['true', 'yes', '1'].includes(String(r.requiresNote).toLowerCase()) && !remark) throw badRequest('Validation failed', [{ path: 'note', message: `Reason ${r.name} needs a note` }]);
  return { code: r.code, name: r.name, note: remark, text: remark ? `${r.name}: ${remark}` : r.name };
}
