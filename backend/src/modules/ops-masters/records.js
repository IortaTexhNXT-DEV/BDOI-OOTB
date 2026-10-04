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
