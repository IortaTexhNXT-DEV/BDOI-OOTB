/**
 * The one-time SAP opening file (Data Migration & Go-Live > Go-Live). SAP normally receives the opening position by its
 * own cutover load, and the reconciliation compares the two trial balances. When TISPH wants BrokerVerse to send it
 * (migration.sap_gl_include_opening, changed on the Go-Live tab only), the opening balances set of the opening balance
 * journal goes to SAP once, as a separate file in the layout of the SAP GL daily file (sap-gl/service.js exportOpening),
 * never in a daily file: requested by a holder of write:data-load with a reason, generated on the approval of another
 * user (approve:data-load) once go-live is locked, and refused once generated (journal_vouchers.sap_exported_at).
 */
import { many, one, pool, runInTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { getSetting } from '../../lib/settings.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { isGoLiveLocked } from '../../lib/goLiveLock.js';
import { notifyApprovers, notifyDecision } from '../notifications/approvals.js';
import { OPENING_JOURNAL_SOURCE, openingJournalLines } from '../period-end/opening.js';
import { exportOpening, getRun, runFile } from '../sap-gl/service.js';

const APPROVE = 'approve:data-load';
const LINK = '/master/configuration/go-live/decision';
const DOCUMENT = 'SAP opening file';

const enabled = async () => (await getSetting('migration.sap_gl_include_opening', false)) === true;

/** The opening balance journal of the cutover date in force, or null. */
async function openingJournal() {
  const cutover = String((await getSetting('golive.cutover_date', '')) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutover)) return null;
  return one(`SELECT * FROM journal_vouchers WHERE source = $1 AND jv_date = $2::date - 1 ORDER BY created_at DESC LIMIT 1`, [OPENING_JOURNAL_SOURCE, cutover]);
}

const requestOut = (r) => r && ({
  id: Number(r.id), status: r.status, reason: r.reason, requestedBy: r.requested_by_name || r.requested_by, requestedById: r.requested_by, requestedAt: r.requested_at,
  decidedBy: r.decided_by_name || r.decided_by, decidedById: r.decided_by, decidedAt: r.decided_at, decisionRemarks: r.decision_remarks, exportId: r.export_id === null ? null : Number(r.export_id),
});
const REQUEST_SELECT = `SELECT r.*, ru.display_name AS requested_by_name, du.display_name AS decided_by_name FROM sap_opening_file_requests r
  LEFT JOIN users ru ON ru.id = r.requested_by LEFT JOIN users du ON du.id = r.decided_by`;

/** The opening file: setting, journal, requests (newest first) and the SAP GL run that carries the files once generated. */
export async function sapOpeningState() {
  const j = await openingJournal();
  const requests = await many(`${REQUEST_SELECT} ORDER BY r.id DESC LIMIT 20`);
  const done = requests.find((r) => r.status === 'approved' && r.export_id);
  return {
    enabled: await enabled(), locked: await isGoLiveLocked(pool),
    journal: j ? { id: j.id, journalNumber: j.jv_number, asAt: j.jv_date, totalDebit: Number(j.total_debit), totalCredit: Number(j.total_credit), sapExportedAt: j.sap_exported_at } : null,
    pendingRequest: requestOut(requests.find((r) => r.status === 'pending')) || null, requests: requests.map(requestOut),
    run: done ? await getRun(done.export_id) : null,
  };
}

/** Request the opening file (write:data-load) with a reason: the setting on, the journal there and not yet sent. */
export async function requestSapOpening({ reason }, user, req) {
  if (!await enabled()) throw conflict('Opening balances are not sent to SAP by BrokerVerse (Go-Live settings)');
  const why = String(reason || '').trim();
  if (!why) throw badRequest('Validation failed', [{ path: 'reason', message: 'Give the reason' }]);
  const j = await openingJournal();
  if (!j) throw conflict('No opening balances are loaded for the cutover date');
  if (j.sap_exported_at) throw conflict(`The SAP opening file of ${j.jv_number} was generated on ${new Date(j.sap_exported_at).toISOString().slice(0, 10)}; it is generated once`);
  let r;
  try {
    r = await one('INSERT INTO sap_opening_file_requests(journal_id, reason, requested_by) VALUES ($1,$2,$3) RETURNING id', [j.id, why.slice(0, 1000), user.id]);
  } catch (e) {
    if (e.code === '23505') throw conflict('A request of the SAP opening file is already waiting for approval');
    throw e;
  }
  const out = requestOut(await one(`${REQUEST_SELECT} WHERE r.id = $1`, [r.id]));
  await audit(req, { entity: 'sap_opening_file', entityId: out.id, action: 'request', after: { ...out, journalNumber: j.jv_number } });
  await notifyApprovers({ audience: APPROVE, document: DOCUMENT, number: j.jv_number, by: user.username, link: LINK, entity: 'sap_opening_file', entityId: out.id });
  return sapOpeningState();
}

async function pendingRequest() {
  const r = await one(`${REQUEST_SELECT} WHERE r.status = 'pending'`);
  if (!r) throw notFound('No request of the SAP opening file is waiting');
  return r;
}

/**
 * Approve the request (approve:data-load, not its requester): the file is generated in the SAP pick-up folder and the
 * journal marked sent, in one transaction. Refused before the go-live lock and once the file was generated.
 */
export async function approveSapOpening(user, req) {
  const r = await pendingRequest();
  await assertChecker(user, r.requested_by, DOCUMENT, { configurable: false });
  if (!await enabled()) throw conflict('Opening balances are not sent to SAP by BrokerVerse (Go-Live settings)');
  if (!await isGoLiveLocked(pool)) throw conflict('The SAP opening file is generated once go-live is locked: the opening balances are then final');
  const run = await runInTransaction(async () => {
    const moved = await one(`UPDATE sap_opening_file_requests SET status = 'approved', decided_by = $2, decided_at = now() WHERE id = $1 AND status = 'pending' RETURNING id`, [r.id, user.id]);
    if (!moved) throw conflict('The request was decided by another user');
    const j = await one('UPDATE journal_vouchers SET sap_exported_at = now() WHERE id = $1 AND sap_exported_at IS NULL RETURNING *', [r.journal_id]);
    if (!j) throw conflict('The SAP opening file was already generated; it is generated once');
    const out = await exportOpening({ journal: j, lines: await openingJournalLines(pool, j), userId: user.id });
    await one('UPDATE sap_opening_file_requests SET export_id = $2 WHERE id = $1 RETURNING id', [r.id, out.id]);
    return out;
  });
  const done = requestOut(await one(`${REQUEST_SELECT} WHERE r.id = $1`, [r.id]));
  await audit(req, { entity: 'sap_opening_file', entityId: done.id, action: 'approve', before: requestOut(r), after: { ...done, files: run.files.map((f) => f.fileName) } });
  await notifyDecision({ userId: r.requested_by, decidedBy: user.id, document: DOCUMENT, number: `#${done.id}`, approved: true, by: user.username, link: LINK,
    entity: 'sap_opening_file', entityId: done.id });
  return sapOpeningState();
}

/** Reject the request with remarks (approve:data-load, not its requester). */
export async function rejectSapOpening({ remarks }, user, req) {
  const note = String(remarks || '').trim();
  if (!note) throw badRequest('Validation failed', [{ path: 'remarks', message: 'Give the reason of the rejection' }]);
  const r = await pendingRequest();
  await assertChecker(user, r.requested_by, DOCUMENT, { configurable: false });
  const moved = await one(`UPDATE sap_opening_file_requests SET status = 'rejected', decided_by = $2, decided_at = now(), decision_remarks = $3 WHERE id = $1 AND status = 'pending' RETURNING id`,
    [r.id, user.id, note.slice(0, 1000)]);
  if (!moved) throw conflict('The request was decided by another user');
  await audit(req, { entity: 'sap_opening_file', entityId: Number(r.id), action: 'reject', before: requestOut(r), after: { status: 'rejected', remarks: note } });
  await notifyDecision({ userId: r.requested_by, decidedBy: user.id, document: DOCUMENT, number: `#${r.id}`, approved: false, by: user.username, reason: note, link: LINK,
    entity: 'sap_opening_file', entityId: Number(r.id) });
  return sapOpeningState();
}

/** Withdraw the request (its requester). */
export async function withdrawSapOpening(user, req) {
  const r = await pendingRequest();
  if (r.requested_by !== user.id) throw forbidden('Only the user who made the request can withdraw it');
  const moved = await one('UPDATE sap_opening_file_requests SET status = \'withdrawn\' WHERE id = $1 AND status = \'pending\' RETURNING id', [r.id]);
  if (!moved) throw conflict('The request was decided by another user');
  await audit(req, { entity: 'sap_opening_file', entityId: Number(r.id), action: 'withdraw', before: requestOut(r), after: { status: 'withdrawn' } });
  return sapOpeningState();
}

/** One file (header | line) of the generated opening file. */
export async function sapOpeningFile(kind) {
  const r = await one('SELECT export_id FROM sap_opening_file_requests WHERE status = \'approved\' AND export_id IS NOT NULL ORDER BY id DESC LIMIT 1');
  if (!r) throw notFound('The SAP opening file has not been generated');
  return runFile(r.export_id, kind);
}
