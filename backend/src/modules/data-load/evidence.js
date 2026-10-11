/**
 * Evidence files of Data Migration & Go-Live (migration 0444): files attached to a run, a checklist step, a
 * reconciliation, a Go / No-Go decision or a defect (cutover log, freeze notice, signed sample sheets, decision minute,
 * archive receipt). They are kept in the storage folder go-live-evidence with their SHA-256, which the uploads router
 * never serves: GET /api/data-load/evidence/:id is the only way out, with read:data-load, and each download is audited.
 * The uploader removes a file while its run is still planned or running; afterwards it is evidence and stays.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { many, one } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { EVIDENCE_FOLDER, deleteObject, resolveKey, storeFile } from '../uploads/storage.js';
import { OPEN_RUN } from './runs.js';

export const OWNER_TYPES = { run: 'Run', step: 'Checklist step', reconciliation: 'Reconciliation', decision: 'Go / No-Go decision', defect: 'Defect' };
/** The table of each owner type and how its run is found. */
const OWNER_SQL = {
  run: 'SELECT id AS run_id, run_number AS label FROM migration_runs WHERE id = $1',
  step: 'SELECT s.run_id, s.code AS label FROM migration_run_steps s WHERE s.id = $1',
  reconciliation: 'SELECT run_id, recon_number AS label FROM migration_reconciliations WHERE id = $1',
  decision: 'SELECT run_id, \'Decision \' || id AS label FROM go_live_decisions WHERE id = $1',
  defect: 'SELECT run_id, defect_number AS label FROM migration_run_defects WHERE id = $1',
};

const toEvidence = (e) => e && ({
  id: Number(e.id), ownerType: e.owner_type, ownerId: Number(e.owner_id), fileName: e.file_name, contentType: e.content_type, sizeBytes: e.size_bytes === null ? null : Number(e.size_bytes),
  sha256: e.sha256, note: e.note, uploadedBy: e.uploaded_by_name || e.uploaded_by, uploadedById: e.uploaded_by, uploadedAt: e.uploaded_at,
});
const SELECT = 'SELECT e.*, u.display_name AS uploaded_by_name FROM migration_evidence e LEFT JOIN users u ON u.id = e.uploaded_by';

/** The owner of evidence: { runId, label } (400 on an unknown type, 404 when missing). */
async function ownerOf(ownerType, ownerId) {
  if (!OWNER_SQL[ownerType]) throw badRequest('Validation failed', [{ path: 'ownerType', message: `Attach to one of ${Object.keys(OWNER_TYPES).join(', ')}` }]);
  if (!/^\d+$/.test(String(ownerId ?? ''))) throw badRequest('Validation failed', [{ path: 'ownerId', message: 'Give the id of the record' }]);
  const o = await one(OWNER_SQL[ownerType], [Number(ownerId)]);
  if (!o) throw notFound(`${OWNER_TYPES[ownerType]} not found`);
  const run = o.run_id === null ? null : await one('SELECT id, run_number, status FROM migration_runs WHERE id = $1', [o.run_id]);
  return { runId: run ? Number(run.id) : null, runNumber: run?.run_number || null, runStatus: run?.status || null, label: o.label };
}

/** Evidence of a record (ownerType, ownerId), or of every record of a run (runId). */
export async function listEvidence({ ownerType = null, ownerId = null, runId = null } = {}) {
  if (runId !== null) {
    return (await many(`${SELECT} WHERE (e.owner_type = 'run' AND e.owner_id = $1)
        OR (e.owner_type = 'step' AND e.owner_id IN (SELECT id FROM migration_run_steps WHERE run_id = $1))
        OR (e.owner_type = 'defect' AND e.owner_id IN (SELECT id FROM migration_run_defects WHERE run_id = $1))
        OR (e.owner_type = 'decision' AND e.owner_id IN (SELECT id FROM go_live_decisions WHERE run_id = $1))
        OR (e.owner_type = 'reconciliation' AND e.owner_id IN (SELECT id FROM migration_reconciliations WHERE run_id = $1))
      ORDER BY e.id`, [Number(runId)])).map(toEvidence);
  }
  await ownerOf(ownerType, ownerId);
  return (await many(`${SELECT} WHERE e.owner_type = $1 AND e.owner_id = $2 ORDER BY e.id`, [ownerType, Number(ownerId)])).map(toEvidence);
}

export async function getEvidence(id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Evidence not found');
  const e = await one(`${SELECT} WHERE e.id = $1`, [Number(id)]);
  if (!e) throw notFound('Evidence not found');
  return toEvidence(e);
}

/** Attach a file (multer memory file) to a record: { ownerType, ownerId, note }; refused when its run is cancelled. */
export async function uploadEvidence(file, { ownerType, ownerId, note }, user) {
  if (!file?.buffer?.length) throw badRequest('Attach the file in the "file" field');
  const owner = await ownerOf(ownerType, ownerId);
  if (owner.runStatus === 'cancelled') throw conflict(`Run ${owner.runNumber} is cancelled`);
  const stored = await storeFile(file, { folder: EVIDENCE_FOLDER, userId: user.id, entity: 'migration_evidence', entityId: `${ownerType}:${ownerId}` });
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const r = await one(`INSERT INTO migration_evidence(owner_type, owner_id, file_key, file_name, content_type, size_bytes, sha256, note, uploaded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [ownerType, Number(ownerId), stored.key, String(file.originalname || 'file').slice(0, 200), stored.contentType,
    file.buffer.length, sha256, String(note || '').trim().slice(0, 1000) || null, user.id]);
  return { ...(await getEvidence(r.id)), ownerLabel: owner.label, runNumber: owner.runNumber };
}

/** The stored file of an evidence record: { evidence, buffer }. */
export async function evidenceFile(id) {
  const e = await one('SELECT * FROM migration_evidence WHERE id = $1', [Number(id) || 0]);
  if (!e) throw notFound('Evidence not found');
  try {
    return { evidence: toEvidence(e), buffer: await fs.promises.readFile(resolveKey(e.file_key)) };
  } catch {
    throw notFound(`The file ${e.file_name} is no longer stored`);
  }
}

/** Remove an evidence file: its uploader, while its run is planned or running (evidence of no run: always). */
export async function deleteEvidence(id, user) {
  const e = await one('SELECT * FROM migration_evidence WHERE id = $1', [Number(id) || 0]);
  if (!e) throw notFound('Evidence not found');
  if (e.uploaded_by !== user.id) throw forbidden('Only the user who attached the file can remove it');
  const owner = await ownerOf(e.owner_type, e.owner_id);
  if (owner.runId !== null && !OPEN_RUN.includes(owner.runStatus)) throw conflict(`Run ${owner.runNumber} is closed: its evidence is kept`);
  const before = await getEvidence(e.id);
  await deleteObject(e.file_key);
  await one('DELETE FROM migration_evidence WHERE id = $1 RETURNING id', [e.id]);
  return before;
}
