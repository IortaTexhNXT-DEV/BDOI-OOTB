/**
 * Evidence pack of a run (GET /api/data-load/runs/:id/evidence-pack): one ZIP built while serving the download, masked
 * for the user who downloads it (lib/piiPolicy.js: every workbook built in the request), never stored. It holds:
 *   run/Run_Report.xlsx              summary, checklist timings, loads with timings, results, defects
 *   evidence/<owner>/<file>          every evidence file of the run, its steps, defects, decisions and reconciliations
 *   loads/<load number>/             per load: Summary.xlsx (counts, timings, file SHA-256), Rows.xlsx (each row with its
 *                                    result and values), Errors.xlsx (rows in error and duplicates) and, for a user with
 *                                    write:data-load and view:pii, the uploaded workbook as received
 *   reconciliations/<number>/        the signed PDF kept when the last slot signed, and the reconciliation workbook
 *   decisions/Go_No_Go.xlsx          decisions, criteria with automatic results and waivers, approvers and votes
 *   go-live/Lock_Requests.xlsx       lock and unlock requests
 *   audit/Audit_Extract.xlsx         per-record entries of the run's loads by entity and action, changes of the go-live
 *                                    and migration settings, imports refused while locked
 *   manifest.csv                     every file of the pack with its size and SHA-256
 * The SHA-256 of the ZIP is returned with it and audited (migration_run evidence-pack); recorded on the run with the
 * archive reference, it meets criterion G11.
 */
import crypto from 'node:crypto';
import { many } from '../../db/pool.js';
import { hasPermission } from '../../lib/auth.js';
import { VIEW_PII } from '../../lib/piiPolicy.js';
import { writeXlsx } from '../../lib/xlsx.js';
import { createZip } from '../../lib/zip.js';
import { toCsv } from '../../lib/csv.js';
import { batchFile, batchRows, errorsWorkbook, getBatch, kitSheets } from './service.js';
import { getReconciliation, reportWorkbook, signedReport } from './reconciliation.js';
import { listLockRequests } from './golive.js';
import { listDecisions } from './decisions.js';
import { evidenceFile, listEvidence } from './evidence.js';
import { getRun, runReportSheets } from './runs.js';

const safe = (s) => String(s || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
const at = (v) => (v ? new Date(v).toISOString() : '');
const header = (names) => names.map((h) => ({ header: h }));

/** Rows of a load as a workbook: one sheet per object with Row, Result, Key, Record and the values of the row. */
async function rowsWorkbook(batch) {
  const sheets = await kitSheets(batch.kit);
  const { rows } = await batchRows(batch.id, {}, { limit: 1000000, offset: 0 });
  return writeXlsx({
    title: `${batch.loadNumber} rows`,
    sheets: sheets.filter((s) => rows.some((r) => r.sheet === s.key)).map((s) => ({
      name: s.name,
      columns: [{ key: 'row', header: 'Row' }, { key: 'result', header: 'Result' }, { key: 'rowKey', header: 'Key' }, { key: 'record', header: 'Record' },
        ...s.columns.map((c) => ({ key: c.key, header: c.header }))],
      rows: rows.filter((r) => r.sheet === s.key).map((r) => ({ row: r.row, result: r.result, rowKey: r.key, record: r.record?.key || '', ...r.values })),
    })),
  });
}

function loadSummary(batch) {
  return writeXlsx({ title: `${batch.loadNumber} summary`, sheets: [
    { name: 'Summary', columns: header(['Item', 'Value']), rows: [
      ['Load', batch.loadNumber], ['Kit', batch.kit], ['File', batch.fileName || ''], ['File SHA-256', batch.fileSha256 || ''], ['Legacy system', batch.legacySystem || ''],
      ['Status', batch.status], ['Cutover date', batch.cutoverDate || ''], ['Rows', batch.rowsRead], ['New', batch.rowsNew], ['Changed', batch.rowsChanged],
      ['Unchanged', batch.rowsUnchanged], ['Duplicate', batch.rowsDuplicate], ['Error', batch.rowsError], ['Valid rows only', batch.validRowsOnly ? 'Yes' : 'No'],
      ['Uploaded by', batch.createdBy || ''], ['Uploaded at', at(batch.createdAt)], ['Submitted by', batch.submittedBy || ''], ['Approved by', batch.decidedBy || ''],
      ['Approved at', at(batch.decidedAt)], ['Loaded at', at(batch.loadedAt)], ['Undone at', at(batch.undoneAt)], ['Undo reason', batch.undoReason || ''],
      ['Validate (ms)', batch.validateMs ?? ''], ['Load (ms)', batch.loadMs ?? ''], ['Undo (ms)', batch.undoMs ?? '']] },
    { name: 'Sheets', columns: header(['Sheet', 'Read', 'Valid', 'Errors', 'Created', 'Updated', 'Unchanged', 'Duplicate', 'Skipped']),
      rows: (batch.sheets || []).map((s) => [s.name, s.read, s.valid, s.errors, s.created ?? '', s.updated ?? '', s.unchanged ?? '', s.duplicate ?? '', s.skipped ?? '']) },
  ] });
}

function decisionsWorkbook(decisions) {
  return writeXlsx({ title: 'Go / No-Go', sheets: [
    { name: 'Decisions', columns: header(['Decision', 'Run', 'Status', 'Meeting', 'Reason', 'Actions', 'New date', 'Minute', 'Created by', 'Created at', 'Decided at']),
      rows: decisions.map((d) => [d.id, d.runNumber, d.statusLabel, at(d.meetingAt), d.reason || '', d.actions || '', d.newDate || '', d.minuteRef || '', d.createdBy || '', at(d.createdAt), at(d.decidedAt)]) },
    { name: 'Criteria', columns: header(['Decision', 'Criterion', 'Title', 'Status', 'Automatic result', 'Evidence', 'Waived by', 'Waiver reason']),
      rows: decisions.flatMap((d) => d.criteria.map((c) => [d.id, c.code, c.title, c.statusLabel, c.autoResult?.detail || '', c.evidence || '', c.waivedBy || '', c.waiverReason || ''])) },
    { name: 'Votes', columns: header(['Decision', 'Approver', 'Role', 'Vote', 'Remarks', 'Voted at']),
      rows: decisions.flatMap((d) => d.approvers.map((a) => [d.id, a.name, a.roleLabel, a.vote || '', a.remarks || '', at(a.votedAt)])) },
  ] });
}

function lockWorkbook(requests) {
  return writeXlsx({ title: 'Go-live lock', sheets: [{ name: 'Lock requests',
    columns: header(['Request', 'Action', 'Status', 'Reason', 'Steering committee', 'Imports reopened', 'Hours', 'Requested by', 'Requested at', 'Decided by', 'Decided at', 'Remarks', 'Ends at', 'Relocked at']),
    rows: requests.map((r) => [r.id, r.actionLabel, r.status, r.reason, r.decisionRef || '', r.scopeLabels.join(', '), r.hours ?? '', r.requestedBy || '', at(r.requestedAt), r.decidedBy || '',
      at(r.decidedAt), r.decisionRemarks || '', at(r.expiresAt), at(r.relockedAt)]) }] });
}

async function auditWorkbook(batchIds) {
  const records = await many(`SELECT entity, action, count(*)::int AS n FROM audit_log WHERE action IN ('migrate-create', 'migrate-update', 'migrate-undo')
      AND after_data->>'batchId' = ANY($1::text[]) GROUP BY entity, action ORDER BY entity, action`, [batchIds.map(String)]);
  const settings = await many(`SELECT at, username, entity, entity_id, action, before_data, after_data FROM audit_log
     WHERE entity = 'golive_setting' OR (entity = 'settings' AND jsonb_typeof(after_data) = 'object' AND EXISTS (SELECT 1 FROM jsonb_object_keys(after_data) k
       WHERE k LIKE 'golive.%' OR k LIKE 'migration.%')) ORDER BY at, id`);
  const refused = await many(`SELECT at, username, entity_id, after_data FROM audit_log WHERE entity = 'go_live_lock' AND action = 'refused-locked' ORDER BY at, id`);
  return writeXlsx({ title: 'Audit extract', sheets: [
    { name: 'Records', columns: header(['Entity', 'Action', 'Entries']), rows: records.map((r) => [r.entity, r.action, r.n]) },
    { name: 'Settings', columns: header(['At', 'User', 'Setting', 'Action', 'Before', 'After']),
      rows: settings.map((s) => [at(s.at), s.username || '', s.entity_id || s.entity, s.action, JSON.stringify(s.before_data ?? ''), JSON.stringify(s.after_data ?? '')]) },
    { name: 'Refused while locked', columns: header(['At', 'User', 'Import', 'Detail']), rows: refused.map((r) => [at(r.at), r.username || '', r.entity_id || '', JSON.stringify(r.after_data ?? '')]) },
  ] });
}

/** Build the evidence pack of a run for `user`: { fileName, buffer, sha256, files } (files: the manifest rows). */
export async function evidencePack(runId, user) {
  const run = await getRun(runId);
  const files = [];
  const add = (name, data) => files.push({ name, data: Buffer.isBuffer(data) ? data : Buffer.from(data) });
  add('run/Run_Report.xlsx', writeXlsx({ sheets: await runReportSheets(run), title: `${run.runNumber} run report` }));

  for (const e of await listEvidence({ runId: run.id })) {
    const { buffer } = await evidenceFile(e.id);
    add(`evidence/${e.ownerType}-${e.ownerId}/${e.id}_${safe(e.fileName)}`, buffer);
  }

  const withFile = hasPermission(user, 'write:data-load') && hasPermission(user, VIEW_PII);
  for (const b of run.loadsList) {
    const batch = await getBatch(b.id);
    const dir = `loads/${batch.loadNumber}`;
    add(`${dir}/Summary.xlsx`, loadSummary(batch));
    add(`${dir}/Rows.xlsx`, await rowsWorkbook(batch));
    if (batch.rowsError || batch.rowsDuplicate) {
      const errors = await errorsWorkbook(batch.id, user).catch(() => null);
      if (errors) add(`${dir}/Errors.xlsx`, errors.buffer);
    }
    if (withFile && batch.fileStored) {
      const f = await batchFile(batch.id).catch(() => null);
      if (f) add(`${dir}/${safe(f.fileName)}`, f.buffer);
    }
  }

  for (const x of run.reconciliations) {
    const r = await getReconciliation(x.id);
    const dir = `reconciliations/${r.reconNumber}`;
    if (r.signedReport) {
      const signed = await signedReport(r.id).catch(() => null);
      if (signed) add(`${dir}/${signed.fileName}`, signed.buffer);
    }
    add(`${dir}/${r.reconNumber}_Reconciliation.xlsx`, reportWorkbook(r));
  }

  add('decisions/Go_No_Go.xlsx', decisionsWorkbook(await listDecisions({ runId: run.id })));
  add('go-live/Lock_Requests.xlsx', lockWorkbook(await listLockRequests()));
  add('audit/Audit_Extract.xlsx', await auditWorkbook(run.loadsList.map((b) => b.id)));

  const manifest = files.map((f) => ({ path: f.name, bytes: f.data.length, sha256: crypto.createHash('sha256').update(f.data).digest('hex') }));
  add('manifest.csv', toCsv([{ key: 'path', label: 'File' }, { key: 'bytes', label: 'Bytes' }, { key: 'sha256', label: 'SHA-256' }], manifest, { bom: false }));
  const buffer = createZip(files);
  return { fileName: `${run.runNumber}_Evidence_Pack.zip`, buffer, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), files: manifest, withFile };
}
