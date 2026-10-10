/**
 * Undo of a migration load, before the go-live lock. A load is undone as a whole, in one transaction (a job, jobs.js),
 * the objects in reverse load order: the records it created are removed with every row their creation wrote (claim
 * history, collection items, CTPL authentications, risk participants), the records it changed get back the values they
 * had before it (the importer of their sheet loads the before-image kept on each row), and the opening balances set it
 * replaced is restored (data_load_batches.opening_before). Each record undone gets a migrate-undo audit entry; the rows
 * of the batch become undone. Number counters are not wound back.
 *
 * Nothing may hang on the records of the load: business entered since (receipts, credits and collection actions on its
 * open items, deposited cheques, endorsements, claims, renewals, documents, a CTPL authentication sent to the LTO) and
 * the records of a later load (its policies on the clients of this one, its open items on these policies ...) or a later
 * load that changed the same records. dependents() lists them; the check runs when the undo is requested, approved and
 * again inside the undo transaction with the records locked, so business saved in between still stops it.
 */
import { many, one, query, runInTransaction } from '../../db/pool.js';
import { conflict } from '../../lib/errors.js';
import { auditMany } from '../../lib/audit.js';
import { clearSettingsCache } from '../../lib/settings.js';
import { protectPayload } from '../../lib/pii.js';
import { assertMigrationOpen } from '../../lib/goLiveLock.js';
import { GO_LIVE_PREFIX, OPENING_JOURNAL_SOURCE, writeOpeningJournal } from '../period-end/opening.js';
import * as svc from './service.js';

/**
 * A row entered in BrokerVerse, or created by a load loaded after the batch ($2): what depends on the batch's records.
 * Rows of earlier loads (the policies of the clients a batch changed) do not.
 */
const LATER = (a) => `(${a}.load_batch_id IS NULL OR ${a}.load_batch_id IN (SELECT id FROM data_load_batches WHERE loaded_at > (SELECT loaded_at FROM data_load_batches WHERE id = $2)))`;

/**
 * Per table of the records a load creates: the entity of its audit entries, what hangs on a record
 * ($1: record ids, $2: the batch; each query returns id, label, n) and how a created record is removed ($1: id).
 */
const OBJECTS = {
  clients: {
    entity: 'client',
    dependents: `SELECT p.client_id AS id, CASE WHEN p.load_batch_id IS NULL THEN 'Policies issued in BrokerVerse' ELSE 'Policies of load ' || (SELECT load_number FROM data_load_batches WHERE id = p.load_batch_id) END AS label,
        count(*)::int AS n FROM policies p WHERE p.client_id = ANY($1) AND ${LATER('p')} GROUP BY 1, 2
      UNION ALL SELECT client_id, 'Quotations', count(*)::int FROM quotes WHERE client_id = ANY($1) GROUP BY 1
      UNION ALL SELECT client_id, 'Claims registered in BrokerVerse', count(*)::int FROM claims WHERE client_id = ANY($1) AND origin = 'issued' GROUP BY 1
      UNION ALL SELECT client_id, 'Receipts', count(*)::int FROM receipts WHERE client_id = ANY($1) GROUP BY 1
      UNION ALL SELECT entity_id, 'Documents', count(*)::int FROM documents WHERE entity = 'client' AND entity_id = ANY($1) GROUP BY 1`,
    remove: ['DELETE FROM clients WHERE id = $1'],
  },
  policies: {
    entity: 'policy',
    dependents: `SELECT r.policy_id AS id, CASE WHEN r.load_batch_id IS NULL THEN 'Bills issued in BrokerVerse' ELSE 'Open items of load ' || (SELECT load_number FROM data_load_batches WHERE id = r.load_batch_id) END AS label, count(*)::int AS n
        FROM receivables r WHERE r.policy_id = ANY($1) AND ${LATER('r')} GROUP BY 1, 2
      UNION ALL SELECT r.policy_id, 'Receipts', count(*)::int FROM receipt_applications a JOIN receivables r ON r.id = a.receivable_id WHERE r.policy_id = ANY($1) GROUP BY 1
      UNION ALL SELECT policy_id, 'Endorsements', count(*)::int FROM endorsements WHERE policy_id = ANY($1) GROUP BY 1
      UNION ALL SELECT c.policy_id, CASE WHEN c.load_batch_id IS NULL THEN 'Claims registered in BrokerVerse' ELSE 'Claims of load ' || (SELECT load_number FROM data_load_batches WHERE id = c.load_batch_id) END, count(*)::int
        FROM claims c WHERE c.policy_id = ANY($1) AND ${LATER('c')} GROUP BY 1, 2
      UNION ALL SELECT policy_id, 'Renewals', count(*)::int FROM renewals WHERE policy_id = ANY($1) GROUP BY 1
      UNION ALL SELECT renewed_from, 'Renewal issued', count(*)::int FROM policies WHERE renewed_from = ANY($1) GROUP BY 1
      UNION ALL SELECT d.policy_id, CASE WHEN ${LATER('d')} AND d.load_batch_id IS NOT NULL THEN 'Post-dated cheques of load ' || (SELECT load_number FROM data_load_batches WHERE id = d.load_batch_id)
          ELSE 'Post-dated cheques deposited or entered in BrokerVerse' END, count(*)::int
        FROM post_dated_cheques d WHERE d.policy_id = ANY($1) AND (${LATER('d')} OR d.status <> 'on-hand') AND d.status <> 'cancelled' GROUP BY 1, 2
      UNION ALL SELECT policy_id, 'CTPL authentication sent to the LTO', count(*)::int FROM ctpl_authentications WHERE policy_id = ANY($1) AND lto_status IN ('queued', 'sent') GROUP BY 1
      UNION ALL SELECT entity_id, 'Documents', count(*)::int FROM documents WHERE entity = 'policy' AND entity_id = ANY($1) GROUP BY 1`,
    remove: ['DELETE FROM ctpl_authentications WHERE policy_id = $1', 'DELETE FROM risk_participants WHERE entity_type = \'policy\' AND entity_id = $1', 'DELETE FROM policies WHERE id = $1'],
  },
  receivables: {
    entity: 'receivable',
    dependents: `SELECT receivable_id AS id, 'Receipts' AS label, count(*)::int AS n FROM receipt_applications WHERE receivable_id = ANY($1) GROUP BY 1
      UNION ALL SELECT receivable_id, 'Receipts', count(*)::int FROM receipts WHERE receivable_id = ANY($1) GROUP BY 1
      UNION ALL SELECT receivable_id, 'Credits', count(*)::int FROM receivable_credits WHERE receivable_id = ANY($1) GROUP BY 1
      UNION ALL SELECT i.receivable_id, 'Collection actions', count(*)::int FROM collection_actions a JOIN collection_items i ON i.id = a.collection_id WHERE i.receivable_id = ANY($1) GROUP BY 1
      UNION ALL SELECT d.receivable_id, CASE WHEN ${LATER('d')} AND d.load_batch_id IS NOT NULL THEN 'Post-dated cheques of load ' || (SELECT load_number FROM data_load_batches WHERE id = d.load_batch_id)
          ELSE 'Post-dated cheques deposited or entered in BrokerVerse' END, count(*)::int
        FROM post_dated_cheques d WHERE d.receivable_id = ANY($1) AND (${LATER('d')} OR d.status <> 'on-hand') AND d.status <> 'cancelled' GROUP BY 1, 2`,
    remove: ['DELETE FROM collection_items WHERE receivable_id = $1', 'DELETE FROM receivables WHERE id = $1'],
  },
  post_dated_cheques: {
    entity: 'post_dated_cheque',
    dependents: `SELECT id, 'Post-dated cheque deposited' AS label, 1 AS n FROM post_dated_cheques WHERE id = ANY($1) AND status NOT IN ('on-hand', 'cancelled')`,
    remove: ['DELETE FROM post_dated_cheques WHERE id = $1'],
  },
  claims: {
    entity: 'claim',
    dependents: `SELECT claim_id AS id, 'Claim history' AS label, GREATEST(count(*)::int - 1, 0) AS n FROM claim_history WHERE claim_id = ANY($1) GROUP BY 1
      UNION ALL SELECT claim_id, 'Settlement movements', count(*)::int FROM claim_settlement_movements WHERE claim_id = ANY($1) GROUP BY 1
      UNION ALL SELECT claim_id, 'Letters of authority', count(*)::int FROM claim_loas WHERE claim_id = ANY($1) GROUP BY 1
      UNION ALL SELECT claim_id, 'Documents', count(*)::int FROM claim_document_items WHERE claim_id = ANY($1) GROUP BY 1`,
    remove: ['DELETE FROM claim_history WHERE claim_id = $1', 'DELETE FROM claims WHERE id = $1'],
  },
};
const OPENING = 'opening-balances';

/** Records of a batch by table: { table: [{ id, key, action, sheet, rowId, before, data }] } (rows loaded with a record). */
async function recordsOf(batchId) {
  const rows = await many(`SELECT id, sheet, record_table, record_id, record_key, action, before, data FROM data_load_rows
    WHERE batch_id = $1 AND status = 'loaded' AND record_id IS NOT NULL AND action IN ('created', 'updated') ORDER BY id`, [batchId]);
  const out = {};
  for (const r of rows) {
    if (!OBJECTS[r.record_table]) continue;
    (out[r.record_table] ||= []).push({ id: r.record_id, key: r.record_key, action: r.action, sheet: r.sheet, rowId: r.id, before: r.before, data: r.data });
  }
  return out;
}

/** True when the batch replaced the opening balances set (its sheet loaded with something created or changed). */
const replacedOpening = async (batchId) => !!(await one(`SELECT 1 AS x FROM data_load_rows WHERE batch_id = $1 AND sheet = $2 AND status = 'loaded' AND action IN ('created', 'updated') LIMIT 1`,
  [batchId, OPENING]));

/**
 * What stops the undo of a loaded migration batch: [{ object, key, dependent, count }] (object: the entity of the record,
 * key: its number). lock: the records are locked FOR UPDATE first (inside the undo transaction).
 */
export async function dependents(batch, { lock = false } = {}) {
  const records = await recordsOf(batch.id);
  const out = [];
  for (const [table, list] of Object.entries(records)) {
    const ids = list.map((r) => r.id);
    if (lock) await query(`SELECT id FROM ${table} WHERE id = ANY($1) FOR UPDATE`, [ids]);
    const keyOf = new Map(list.map((r) => [String(r.id), r.key]));
    const sql = OBJECTS[table].dependents;
    for (const d of await many(sql, sql.includes('$2') ? [ids, batch.id] : [ids])) {
      if (d.n > 0) out.push({ object: OBJECTS[table].entity, key: keyOf.get(String(d.id)) || String(d.id), dependent: d.label, count: d.n });
    }
    // a later load that changed the same records
    const later = await many(`SELECT r.record_id, b.load_number, count(*)::int AS n FROM data_load_rows r JOIN data_load_batches b ON b.id = r.batch_id
      WHERE r.record_table = $1 AND r.record_id = ANY($2::text[]) AND r.batch_id <> $3 AND r.status = 'loaded' AND r.action = 'updated' AND b.status IN ('loaded', 'undo-pending', 'undoing')
        AND b.loaded_at > (SELECT loaded_at FROM data_load_batches WHERE id = $3)
      GROUP BY 1, 2`, [table, ids.map(String), batch.id]);
    for (const d of later) out.push({ object: OBJECTS[table].entity, key: keyOf.get(String(d.record_id)) || d.record_id, dependent: `Changed by load ${d.load_number}`, count: d.n });
  }
  if (batch.cutoverDate && await replacedOpening(batch.id)) {
    const other = await one('SELECT b.load_number FROM opening_balances o JOIN data_load_batches b ON b.id = o.load_batch_id WHERE o.source_run = $1 AND o.load_batch_id <> $2 LIMIT 1',
      [`${GO_LIVE_PREFIX}${batch.cutoverDate}`, batch.id]);
    if (other) out.push({ object: 'opening_balances', key: batch.cutoverDate, dependent: `Replaced by load ${other.load_number}`, count: 1 });
  }
  return out;
}

/** 409 listing what stops an undo. */
export function dependentsConflict(batch, deps) {
  const shown = deps.slice(0, 5).map((d) => `${d.key}: ${d.dependent.toLowerCase()}`).join('; ');
  return Object.assign(conflict(`${batch.loadNumber} cannot be undone: ${deps.length} record(s) have business or later loads that depend on them (${shown}${deps.length > 5 ? '; ...' : ''})`),
    { details: deps.map((d) => ({ path: d.key, message: `${d.object} ${d.key}: ${d.dependent} (${d.count})` })) });
}

/** Refuse an undo of a batch: not a loaded migration batch, go-live locked, or records that depend on it. */
export async function assertUndoable(batch, { req = null, statuses = ['loaded'] } = {}) {
  if (batch.kit !== 'migration') throw conflict('Only a migration load is undone here; a configuration load is corrected by a new load');
  if (!statuses.includes(batch.status)) throw conflict(svc.statusConflict(batch));
  await assertMigrationOpen('undo', { req });
  const deps = await dependents(batch);
  if (deps.length) throw dependentsConflict(batch, deps);
}

/**
 * Undo a batch in status undoing (moved there by the approval of the undo), as the approver: see the head of this file.
 * jobId, onProgress, onWait: see service.validateBatch. Returns { batch, removed, restored }.
 */
export async function undoBatch(id, user, { jobId = null, onProgress = null, onWait = null } = {}) {
  const batch = await svc.getBatch(id);
  if (batch.status !== 'undoing') throw conflict(svc.statusConflict(batch));
  const started = Date.now();
  let outcome;
  try {
    await assertMigrationOpen('undo');
    outcome = await runInTransaction(async () => {
      await svc.jobTimeouts();
      await svc.takeLoadLock(onWait);
      const deps = await dependents(batch, { lock: true });
      if (deps.length) throw dependentsConflict(batch, deps);
      const state = await svc.goLiveState();
      const ctx = await svc.loadContext(batch, user, state, false, { ...(await svc.originOfBatch(batch)), undo: true, onProgress });
      const sheets = await svc.kitSheets(batch.kit);
      const records = await recordsOf(batch.id);
      const bySheet = {};
      for (const list of Object.values(records)) for (const r of list) (bySheet[r.sheet] ||= []).push(r);
      const total = Object.values(bySheet).reduce((n, l) => n + l.length, 0);
      let done = 0;
      let removed = 0;
      let restored = 0;
      const tableOf = Object.fromEntries(Object.entries(records).flatMap(([t, l]) => l.map((r) => [r.rowId, t])));
      // reverse load order; inside a sheet, last row first
      for (const sheet of [...sheets].reverse()) {
        if (sheet.key === OPENING) {
          restored += await restoreOpening(ctx, batch);
          continue;
        }
        for (const r of (bySheet[sheet.key] || []).slice().reverse()) {
          const def = OBJECTS[tableOf[r.rowId]];
          if (r.action === 'created') {
            for (const sql of def.remove) await query(sql, [r.id]);
            ctx.audits.push({ entity: def.entity, entityId: r.id, action: 'migrate-undo', before: protectPayload(r.data),
              after: { removed: true, key: r.key, batchId: batch.id, loadNumber: batch.loadNumber } });
            removed += 1;
          } else {
            // the importer of the sheet writes the values kept before the load back (its record() call is the audit entry)
            await sheet.importRow(ctx, protectPayload(r.before));
            restored += 1;
          }
          done += 1;
          if (onProgress && done % svc.PROGRESS_ROWS === 0) await onProgress({ sheet: sheet.name, done, total });
        }
      }
      await auditMany({ user }, ctx.audits);
      await query('UPDATE data_load_rows SET status = \'undone\' WHERE batch_id = $1 AND status = \'loaded\'', [batch.id]);
      const ok = await one(`UPDATE data_load_batches SET status = 'undone', undone_by = $2, undone_at = now(), undo_ms = $3, progress = NULL, message = NULL
        WHERE id = $1 AND status = 'undoing' AND ($4::bigint IS NULL OR job_id = $4) RETURNING id`, [batch.id, user.id, Date.now() - started, jobId]);
      if (!ok) throw Object.assign(new Error(svc.INTERRUPTED), { superseded: true });
      return { removed, restored };
    });
  } catch (e) {
    if (!e.superseded) {
      const why = e.status ? `Not undone: ${e.message}` : svc.interruptedError(e) ? svc.INTERRUPTED : `The undo stopped: ${e.message}. Nothing was changed`;
      await svc.stopBatch(batch.id, 'undoing', 'loaded', why, jobId);
    }
    throw e;
  } finally {
    clearSettingsCache();
  }
  return { batch: await svc.getBatch(batch.id), ...outcome };
}

/** Put back the opening balances set the batch replaced (or remove the set it created); one audit entry per account changed. */
async function restoreOpening(ctx, batch) {
  if (!batch.cutoverDate || !(await replacedOpening(batch.id))) return 0;
  const run = `${GO_LIVE_PREFIX}${batch.cutoverDate}`;
  const before = (await one('SELECT opening_before FROM data_load_batches WHERE id = $1', [batch.id])).opening_before || [];
  const current = await many('SELECT account_code, balance FROM opening_balances WHERE source_run = $1', [run]);
  await query('DELETE FROM opening_balances WHERE source_run = $1 AND load_batch_id = $2', [run, batch.id]);
  for (const r of before) {
    await query('INSERT INTO opening_balances(fiscal_year, account_code, balance, source_run, load_batch_id) VALUES ($1,$2,$3,$4,$5)',
      [r.fiscal_year, r.account_code, r.balance, r.source_run, r.load_batch_id]);
  }
  const was = new Map(before.map((r) => [r.account_code, Number(r.balance)]));
  const now = new Map(current.map((r) => [r.account_code, Number(r.balance)]));
  let n = 0;
  for (const code of new Set([...was.keys(), ...now.keys()])) {
    if (was.get(code) === now.get(code)) continue;
    ctx.audits.push({ entity: 'opening_balances', entityId: `${run}:${code}`, action: 'migrate-undo', before: { accountCode: code, balance: now.get(code) ?? 0 },
      after: { accountCode: code, balance: was.get(code) ?? 0, batchId: batch.id, loadNumber: batch.loadNumber } });
    n += 1;
  }
  // the opening balance journal of the load goes with its set; the set restored gets its journal again (a new number)
  const journal = await one('SELECT id, jv_number FROM journal_vouchers WHERE source = $1 AND load_batch_id = $2', [OPENING_JOURNAL_SOURCE, batch.id]);
  const restored = await writeOpeningJournal({ query }, { goLiveDate: batch.cutoverDate, batchId: before[0]?.load_batch_id ?? null, userId: ctx.user.id });
  if (journal) {
    ctx.audits.push({ entity: 'journal_voucher', entityId: journal.id, action: 'migrate-undo', before: { journalNumber: journal.jv_number },
      after: { removed: true, replacedBy: restored?.jv_number || null, batchId: batch.id, loadNumber: batch.loadNumber } });
  }
  return n;
}
