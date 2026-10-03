import { query } from '../db/pool.js';
/** Record who did what to which record; called by every mutating handler. */
export async function audit(req, { entity, entityId, action, before = null, after = null }) {
  await query(
    `INSERT INTO audit_log(user_id, username, entity, entity_id, action, before_data, after_data, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.user?.id ?? null, req.user?.username ?? null, entity, entityId == null ? null : String(entityId), action,
      before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, req.ip],
  );
}
