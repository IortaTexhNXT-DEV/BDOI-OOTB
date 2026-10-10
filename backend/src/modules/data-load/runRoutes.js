/**
 * Routes of the Overview, Mock Runs, Cutover, Go-Live (Go / No-Go) and Hypercare tabs of Data Migration & Go-Live:
 * runs (runs.js), the checklist and defects (cutover.js), evidence files (evidence.js), the evidence pack
 * (evidence-pack.js), decisions (decisions.js), the overview (overview.js) and hypercare (hypercare.js), declared on the
 * data-load router (router.js).
 */
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { ok, created, paging, pageMeta } from '../../lib/respond.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { INLINE_TYPES } from '../uploads/fileTypes.js';
import * as runs from './runs.js';
import * as cutover from './cutover.js';
import * as evidence from './evidence.js';
import * as decisions from './decisions.js';
import { evidencePack } from './evidence-pack.js';
import { overview } from './overview.js';
import { hypercare } from './hypercare.js';

const evidenceUpload = memoryUpload({ files: 1 }).single('file');

const runExample = { id: 3, runNumber: 'RUN-000003', kind: 'production', kindLabel: 'Production', title: 'Production cutover', environment: 'production', cutoverDate: '2026-11-02',
  plannedStart: '2026-10-31T09:30:00Z', plannedEnd: '2026-11-01T10:00:00Z', actualStart: '2026-10-31T09:31:00Z', actualEnd: null, durationMs: null, status: 'running', statusLabel: 'Running',
  result: null, resultLabel: null, exitCriteria: 'Reconciliation signed; Go decision', exitCriteriaMet: null, summary: null, personalData: 'production-extract',
  personalDataLabel: 'Production extract', dpoApprovalRef: 'DPO-2026-014', restorePoint: '2026-10-31T14:00:00Z', evidencePackSha256: null, archiveRef: null, loads: 2, defectsOpen: 1,
  defectsTotal: 4, createdBy: 'Andrea Lim', createdAt: '2026-10-20T02:00:00Z', closedBy: null, closedAt: null };
const stepExample = { id: 31, runId: 3, code: 'CO-3', title: 'Pre-load checks and restore point', phase: 'cutover', phaseLabel: 'Cutover', sort: 130, ownerUserId: 'usr_7a1c',
  ownerName: 'Paolo Cruz', ownerRole: 'DevOps lead', offsetLabel: 'Saturday 22:00', durationMinutes: 30, evidenceHint: 'Cutover log with the restore time', evidenceRequired: true,
  evidenceCount: 1, plannedStart: '2026-10-31T14:00:00Z', plannedEnd: '2026-10-31T14:30:00Z', actualStart: '2026-10-31T14:02:00Z', actualEnd: '2026-10-31T14:25:00Z', elapsedMs: 1380000,
  late: false, status: 'done', statusLabel: 'Done', notes: null, dependsOn: ['CO-2'], waitingFor: [], updatedBy: 'Paolo Cruz', updatedAt: '2026-10-31T14:25:00Z' };
const defectExample = { id: 8, defectNumber: 'DEF-000008', runId: 3, title: 'Plate number with a trailing space refused', object: 'Policies - Motor', severity: 3, status: 'fixed',
  owner: 'Migration lead', batchId: 12, loadNumber: 'MIG-000012', stepId: 32, stepCode: 'CO-4', description: 'Rows 14-18 of the motor sheet', resolution: 'Trimmed in the extract',
  foundBy: 'Andrea Lim', foundAt: '2026-11-01T01:10:00Z', closedAt: null };
const evidenceExample = { id: 5, ownerType: 'step', ownerId: 31, fileName: 'Cutover_Log_CO-3.pdf', contentType: 'application/pdf', sizeBytes: 48211,
  sha256: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae', note: 'Restore time 22:00', uploadedBy: 'Paolo Cruz', uploadedAt: '2026-10-31T14:20:00Z' };
const criterionExample = { code: 'G8', title: 'Numbering continues above every legacy number in every period, branch and line, and every COC series', waivable: true, automatic: true,
  status: 'not-met', statusLabel: 'Not met', autoResult: { met: false, detail: '1 legacy number(s) a series would issue again', items: [{ series: 'policy', label: 'Policy number', number: 'POL-2027-00005', next: 1, periods: ['2027'] }],
    checkedAt: '2026-11-01T08:00:00Z' }, evidence: null, waivedBy: null, waiverReason: null, updatedBy: 'Andrea Lim', updatedAt: '2026-11-01T08:00:00Z' };
const decisionExample = { id: 2, runId: 3, runNumber: 'RUN-000003', runKind: 'production', status: 'voting', statusLabel: 'Voting', meetingAt: '2026-11-01T08:00:00Z', reason: null,
  actions: null, newDate: null, minuteRef: null, createdBy: 'Andrea Lim', createdAt: '2026-11-01T07:30:00Z', decidedAt: null, criteria: [criterionExample],
  approvers: [{ userId: 'usr_91b2', name: 'Liza Santos', roleLabel: 'Finance Head', vote: 'go', remarks: 'Trial balance agrees', votedAt: '2026-11-01T08:10:00Z' }],
  summary: { criteria: 11, met: 11, votes: 1, approvers: 3 } };

/** Declare the routes: define of the data-load router, its permission chains and the workspace screen name. */
export function defineRunRoutes(define, { canRead, canWrite, canApprove, canWriteOrApprove, WORKSPACE, sendXlsx }) {
  const RUNS = `${WORKSPACE} > Mock Runs`;
  const CUTOVER = `${WORKSPACE} > Cutover`;
  const DECISION = `${WORKSPACE} > Go-Live > Go / No-Go`;

  define({
    method: 'GET', path: '/overview', summary: 'Overview of the programme: phases, cutover date and lock, the current run (checklist progress, reconciliation, Go / No-Go), loads by status, rows loaded by result, latest loads, open defects of severity 1 and 2, and what waits for the user (approvals, votes, checklist steps)',
    screen: `${WORKSPACE} > Overview`, middleware: canRead,
    response: { success: true, data: { cutoverDate: '2026-11-02', locked: false, environment: 'production', phases: [{ key: 'mock-1', label: 'Mock 1', status: 'done' }],
      run: { id: 3, runNumber: 'RUN-000003', kind: 'production', title: 'Production cutover', status: 'running', checklist: { done: 12, total: 21, blocked: 0, percent: 57 },
        reconciliation: { id: 7, reconNumber: 'REC-000007', status: 'open', openDifferences: 1 }, decision: null },
      loads: { loaded: 2, pendingApproval: 1, failed: 0, rows: { new: 1450, changed: 4, unchanged: 0, duplicate: 2 }, latest: [] }, defects: { severity1: 0, severity2: 1 },
      forMe: { approvals: [{ type: 'load', id: 13, reference: 'MIG-000013' }], votes: [], steps: [] } } },
    handler: async (req, res) => ok(res, await overview(req.user)),
  });
  define({
    method: 'GET', path: '/hypercare', summary: 'Hypercare figures after the go-live lock: business issued since go-live, migrated open items collected, renewals of migrated policies, endorsements, claims and cancellations on migrated policies, edits to migrated records, daily checks and tie-outs, imports refused while locked, unlocks and relocks, open defects of the production run; { started: false } before the lock',
    screen: `${WORKSPACE} > Hypercare`, middleware: canRead,
    response: { success: true, data: { started: true, cutoverDate: '2026-11-02', daysSinceGoLive: 3, hypercareDays: 28, issued: { policies: 41, grossPremium: 812500, endorsements: 3, receipts: 57, receiptAmount: 1250000, claims: 2 },
      migratedItems: { count: 640, cleared: 52, openingBalance: 8450000, collected: 912000, openBalance: 7538000, collectedPercent: 10.79, ageing: [] }, renewals: { due: 118, renewed: 9 },
      migratedPolicies: { endorsements: 6, claims: 4, cancellations: 1, cancelledPremium: -5400 }, edits: { total: 12, byEntity: [{ entity: 'policy', count: 9 }], byDay: [] },
      checks: [{ code: 'trial-balance', label: 'Trial balance balanced', ok: true, detail: null }], lock: { refused: 1, latestRefused: [], unlocks: [] }, defects: [{ severity: 1, open: 0 }] } },
    handler: async (_req, res) => ok(res, await hypercare()),
  });

  // ------------------------------------------------------------------ runs

  define({
    method: 'GET', path: '/runs', summary: 'Runs (Mock 1, Mock 2, dress rehearsal, extra mock, production), newest first, with their loads and open defects; filters kind, status',
    screen: RUNS, middleware: canRead, query: { kind: 'mock-2', status: 'completed', page: 1, perPage: 50 },
    response: { success: true, data: [runExample], total: 1, page: 1, perPage: 50, totalPages: 1 },
    handler: async (req, res) => {
      const pg = paging(req.query, { page: 1, perPage: 50 });
      const { rows, total } = await runs.listRuns({ kind: req.query.kind || null, status: req.query.status || null }, pg);
      ok(res, rows, 'OK', { ...pageMeta(total, pg), currentRunId: await runs.currentRun() });
    },
  });
  define({
    method: 'POST', path: '/runs', summary: 'Create a run (one production run at a time); its cutover checklist is copied from the runbook. A production extract needs the DPO approval reference',
    screen: `${RUNS} > New run`, middleware: canWrite,
    request: { kind: 'mock-2', title: 'Mock 2 - full extract', cutoverDate: '2026-11-02', plannedStart: '2026-10-10T01:00:00Z', plannedEnd: '2026-10-11T09:00:00Z', personalData: 'masked-copy',
      dpoApprovalRef: null, exitCriteria: 'No validation error; every control figure reconciles' },
    response: { success: true, message: 'RUN-000003 created', data: runExample },
    handler: async (req, res) => {
      const r = await runs.createRun(req.body, req.user, req);
      created(res, r, `${r.runNumber} created`);
    },
  });
  define({
    method: 'GET', path: '/runs/:id', summary: 'A run: its record, loads with validate / load / undo times and rows per second, checklist timings, reconciliations, Go / No-Go decisions, defects by status and totals',
    screen: RUNS, middleware: canRead, response: { success: true, data: { ...runExample, loadsList: [], steps: [], reconciliations: [], decisions: [], defectsByStatus: { open: 1 },
      timings: { validateMs: 5400, loadMs: 61000, undoMs: 0, rowsLoaded: 1456, stepsDone: 12, steps: 21, lateSteps: [], elapsedMs: null } } },
    handler: async (req, res) => ok(res, await runs.getRun(req.params.id)),
  });
  define({
    method: 'PUT', path: '/runs/:id', summary: 'Change a run: title, dates, personal data and DPO approval, exit criteria, summary, restore point; the SHA-256 of a downloaded evidence pack of the run and its archive reference (also once the run is completed)',
    screen: RUNS, middleware: canWrite, request: { evidencePackSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', archiveRef: 'TISPH-ARCH-2026-0042' },
    response: { success: true, message: 'Run saved', data: runExample },
    handler: async (req, res) => ok(res, await runs.updateRun(req.params.id, req.body, req.user, req), 'Run saved'),
  });
  define({
    method: 'POST', path: '/runs/:id/start', summary: 'Start a planned run (actual start now)', screen: RUNS, middleware: canWrite,
    response: { success: true, message: 'RUN-000003 started', data: runExample },
    handler: async (req, res) => {
      const r = await runs.startRun(req.params.id, req.user, req);
      ok(res, r, `${r.runNumber} started`);
    },
  });
  define({
    method: 'POST', path: '/runs/:id/complete', summary: 'Complete a running run with its result (passed, passed-with-issues, failed), whether the exit criteria were met and a summary; refused while one of its loads is in progress',
    screen: RUNS, middleware: canWrite, request: { result: 'passed-with-issues', exitCriteriaMet: true, summary: 'Reconciled; two severity 3 defects deferred' },
    response: { success: true, message: 'RUN-000003 completed', data: { ...runExample, status: 'completed', result: 'passed-with-issues' } },
    handler: async (req, res) => {
      const r = await runs.completeRun(req.params.id, req.body, req.user, req);
      ok(res, r, `${r.runNumber} ${r.status}`);
    },
  });
  define({
    method: 'POST', path: '/runs/:id/cancel', summary: 'Cancel a planned or running run with a reason (never the production run once go-live is locked)',
    screen: RUNS, middleware: canWrite, request: { reason: 'Replaced by an extra mock after the cleansing' },
    response: { success: true, message: 'RUN-000003 cancelled', data: { ...runExample, status: 'cancelled' } },
    handler: async (req, res) => {
      const r = await runs.cancelRun(req.params.id, req.body, req.user, req);
      ok(res, r, `${r.runNumber} cancelled`);
    },
  });
  define({
    method: 'GET', path: '/runs/:id/report', summary: 'Run report (format=xlsx or pdf): summary, checklist timings, loads with timings, results, defects; built when downloaded',
    screen: `${RUNS} > Report`, middleware: canRead, query: { format: 'xlsx' }, response: '(xlsx or pdf file)',
    handler: async (req, res) => {
      const format = String(req.query.format || 'xlsx').toLowerCase();
      if (!['pdf', 'xlsx'].includes(format)) throw badRequest('format must be pdf or xlsx');
      const f = await runs.runReport(req.params.id, format);
      if (format === 'xlsx') return sendXlsx(res, f.fileName, f.buffer);
      res.setHeader('Content-Type', f.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${f.fileName}"`);
      return res.send(f.buffer);
    },
  });
  define({
    method: 'GET', path: '/runs/:id/evidence-pack', summary: 'Evidence pack of a run (ZIP with manifest.csv giving the SHA-256 of each file): run report, evidence files, each load (summary, rows, errors; the uploaded workbook only for users with write:data-load and view:pii), reconciliations with the signed PDF, Go / No-Go, lock requests and an audit extract. Built on download and masked for a user without view:pii; its SHA-256 is in X-Content-SHA256 and the audit trail',
    screen: `${RUNS} > Evidence pack`, middleware: canRead, response: '(application/zip)',
    handler: async (req, res) => {
      const pack = await evidencePack(req.params.id, req.user);
      await audit(req, { entity: 'migration_run', entityId: Number(req.params.id), action: 'evidence-pack', after: { sha256: pack.sha256, files: pack.files.length, uploadedFiles: pack.withFile } });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${pack.fileName}"`);
      res.setHeader('X-Content-SHA256', pack.sha256);
      res.setHeader('Cache-Control', 'no-store');
      res.send(pack.buffer);
    },
  });

  // ------------------------------------------------------------------ checklist

  define({
    method: 'GET', path: '/runs/:id/steps', summary: 'Cutover checklist of a run by phase: owner, planned and actual start and end, status, evidence count, notes, the steps each waits for; progress, elapsed against plan, next step, late steps',
    screen: CUTOVER, middleware: canRead,
    response: { success: true, data: { runId: 3, runNumber: 'RUN-000003', runStatus: 'running', steps: [stepExample],
      progress: { done: 12, total: 21, percent: 57, plannedMs: 54000000, elapsedMs: 41000000, next: { id: 32, code: 'CO-4', title: 'Validate' }, late: [] } } },
    handler: async (req, res) => ok(res, await cutover.listSteps(req.params.id)),
  });
  define({
    method: 'PUT', path: '/runs/:id/steps/:stepId', summary: 'Change a checklist step: owner (user or role), planned start and end, notes',
    screen: `${CUTOVER} > Edit`, middleware: canWrite, request: { ownerUserId: 'usr_7a1c', plannedStart: '2026-10-31T14:00:00Z', plannedEnd: '2026-10-31T14:30:00Z' },
    response: { success: true, message: 'Step saved', data: stepExample },
    handler: async (req, res) => ok(res, await cutover.updateStep(req.params.id, req.params.stepId, req.body, req.user, req), 'Step saved'),
  });
  define({
    method: 'POST', path: '/runs/:id/steps/:stepId/start', summary: 'Start a step of a running run (actual start now); refused until every step it depends on is done or skipped',
    screen: `${CUTOVER} > Start`, middleware: canWrite, response: { success: true, message: 'CO-3 started', data: { ...stepExample, status: 'in-progress', actualEnd: null } },
    handler: async (req, res) => {
      const s = await cutover.startStep(req.params.id, req.params.stepId, req.user, req);
      ok(res, s, `${s.code} started`);
    },
  });
  define({
    method: 'POST', path: '/runs/:id/steps/:stepId/done', summary: 'Finish a step in progress (actual end now); a step whose runbook names evidence needs an evidence file or a note saying why there is none; CO-3 records the restore point (restorePoint) or needs it on the run',
    screen: `${CUTOVER} > Done`, middleware: canWrite, request: { note: null, restorePoint: '2026-10-31T14:00:00Z' }, response: { success: true, message: 'CO-3 done', data: stepExample },
    handler: async (req, res) => {
      const s = await cutover.doneStep(req.params.id, req.params.stepId, req.body, req.user, req);
      ok(res, s, `${s.code} done`);
    },
  });
  define({
    method: 'POST', path: '/runs/:id/steps/:stepId/block', summary: 'Block a step not started or in progress, with a note', screen: `${CUTOVER} > Blocked`, middleware: canWrite,
    request: { note: 'Legacy day-end still running' }, response: { success: true, message: 'CO-1 blocked', data: { ...stepExample, code: 'CO-1', status: 'blocked' } },
    handler: async (req, res) => {
      const s = await cutover.blockStep(req.params.id, req.params.stepId, req.body, req.user, req);
      ok(res, s, `${s.code} blocked`);
    },
  });
  define({
    method: 'POST', path: '/runs/:id/steps/:stepId/skip', summary: 'Skip a step not started or blocked, with a note', screen: `${CUTOVER} > Skip`, middleware: canWrite,
    request: { note: 'Not part of a mock run' }, response: { success: true, message: 'PC-1 skipped', data: { ...stepExample, code: 'PC-1', status: 'skipped' } },
    handler: async (req, res) => {
      const s = await cutover.skipStep(req.params.id, req.params.stepId, req.body, req.user, req);
      ok(res, s, `${s.code} skipped`);
    },
  });
  define({
    method: 'GET', path: '/runbook', summary: 'The runbook template copied into each new run: steps by phase with owner role, timetable slot, duration, evidence and dependencies',
    screen: `${CUTOVER} > Runbook`, middleware: canRead, response: { success: true, data: [{ code: 'CO-3', title: 'Pre-load checks and restore point', phase: 'cutover', phaseLabel: 'Cutover',
      ownerRole: 'DevOps lead', offsetLabel: 'Saturday 22:00', durationMinutes: 30, evidenceHint: 'Cutover log with the restore time', dependsOn: ['CO-2'], sort: 130, status: 'active' }] },
    handler: async (_req, res) => ok(res, await cutover.runbook()),
  });
  define({
    method: 'PUT', path: '/runbook/:code', summary: 'Change a step of the runbook template (new runs copy it): title, owner role, timetable slot, duration, evidence, dependencies, order, active or inactive',
    screen: `${CUTOVER} > Runbook`, middleware: canWrite, request: { ownerRole: 'DevOps lead', durationMinutes: 45 },
    response: { success: true, message: 'Runbook step saved', data: { code: 'CO-3', title: 'Pre-load checks and restore point', durationMinutes: 45 } },
    handler: async (req, res) => ok(res, await cutover.updateRunbookStep(req.params.code, req.body, req.user, req), 'Runbook step saved'),
  });

  // ------------------------------------------------------------------ defects

  define({
    method: 'GET', path: '/runs/:id/defects', summary: 'Defects of a run, newest first', screen: `${RUNS} > Defects`, middleware: canRead, response: { success: true, data: [defectExample] },
    handler: async (req, res) => ok(res, await cutover.listDefects(req.params.id)),
  });
  define({
    method: 'POST', path: '/runs/:id/defects', summary: 'Record a defect of a run: title, object, severity 1 to 4, status, owner, the load and step of the run it was found in, description, resolution',
    screen: `${RUNS} > Defects > Add`, middleware: canWrite, request: { title: 'Plate number with a trailing space refused', object: 'Policies - Motor', severity: 3, batchId: 12, stepId: 32 },
    response: { success: true, message: 'DEF-000008 recorded', data: defectExample },
    handler: async (req, res) => {
      const d = await cutover.createDefect(req.params.id, req.body, req.user, req);
      created(res, d, `${d.defectNumber} recorded`);
    },
  });
  define({
    method: 'PUT', path: '/runs/:id/defects/:defectId', summary: 'Change a defect (closing it records when)', screen: `${RUNS} > Defects > Edit`, middleware: canWrite,
    request: { status: 'fixed', resolution: 'Trimmed in the extract' }, response: { success: true, message: 'DEF-000008 saved', data: defectExample },
    handler: async (req, res) => {
      const d = await cutover.updateDefect(req.params.id, req.params.defectId, req.body, req.user, req);
      ok(res, d, `${d.defectNumber} saved`);
    },
  });

  // ------------------------------------------------------------------ evidence

  define({
    method: 'GET', path: '/evidence', summary: 'Evidence files of a record (ownerType run, step, reconciliation, decision or defect, and ownerId) or of everything of a run (runId)',
    screen: `${RUNS} > Evidence`, middleware: canRead, query: { ownerType: 'step', ownerId: 31 }, response: { success: true, data: [evidenceExample] },
    handler: async (req, res) => ok(res, await evidence.listEvidence({ ownerType: req.query.ownerType || null, ownerId: req.query.ownerId || null,
      runId: /^\d+$/.test(String(req.query.runId || '')) ? Number(req.query.runId) : null })),
  });
  define({
    method: 'POST', path: '/evidence', summary: 'Attach an evidence file (multipart "file", ownerType, ownerId, note) to a run, checklist step, reconciliation, decision or defect; kept in the go-live evidence store with its SHA-256',
    screen: `${RUNS} > Evidence > Attach`, middleware: [...canWrite, evidenceUpload], request: 'multipart/form-data file, ownerType, ownerId, note',
    response: { success: true, message: 'Evidence attached', data: evidenceExample },
    handler: async (req, res) => {
      const e = await evidence.uploadEvidence(req.file, { ownerType: req.body?.ownerType, ownerId: req.body?.ownerId, note: req.body?.note }, req.user);
      await audit(req, { entity: 'migration_evidence', entityId: e.id, action: 'upload', after: { ownerType: e.ownerType, ownerId: e.ownerId, owner: e.ownerLabel, runNumber: e.runNumber,
        fileName: e.fileName, sha256: e.sha256, sizeBytes: e.sizeBytes } });
      created(res, e, 'Evidence attached');
    },
  });
  define({
    method: 'GET', path: '/evidence/:id', summary: 'Download an evidence file (the only way it is served; each download is audited)', screen: `${RUNS} > Evidence`, middleware: canRead,
    response: '(file)',
    handler: async (req, res) => {
      const { evidence: e, buffer } = await evidence.evidenceFile(req.params.id);
      await audit(req, { entity: 'migration_evidence', entityId: e.id, action: 'download', after: { fileName: e.fileName, sha256: e.sha256 } });
      const type = INLINE_TYPES.includes(e.contentType) ? e.contentType : 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `attachment; filename="${String(e.fileName).replace(/[\r\n"]/g, '_')}"`);
      res.setHeader('X-Content-SHA256', e.sha256 || '');
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    },
  });
  define({
    method: 'DELETE', path: '/evidence/:id', summary: 'Remove an evidence file: its uploader, while the run is planned or running', screen: `${RUNS} > Evidence > Remove`, middleware: canWrite,
    response: { success: true, message: 'Evidence removed', data: evidenceExample },
    handler: async (req, res) => {
      const e = await evidence.deleteEvidence(req.params.id, req.user);
      await audit(req, { entity: 'migration_evidence', entityId: e.id, action: 'delete', before: e });
      ok(res, e, 'Evidence removed');
    },
  });

  // ------------------------------------------------------------------ Go / No-Go

  define({
    method: 'GET', path: '/criteria', summary: 'The Go / No-Go criteria template copied into each decision (G2 to G5 never waived; automatic criteria computed from the records)',
    screen: DECISION, middleware: canRead, response: { success: true, data: [{ code: 'G2', title: 'Migration load of the production run loaded with no row in error and not with valid rows only',
      evidenceHint: 'Load record', automatic: true, waivable: false, sort: 20, status: 'active' }] },
    handler: async (_req, res) => ok(res, await decisions.criteriaTemplate()),
  });
  define({
    method: 'PUT', path: '/criteria/:code', summary: 'Change a criterion of the template (new decisions copy it): title, evidence, order, active; a criterion that is never waived stays so and stays active',
    screen: DECISION, middleware: canWrite, request: { evidenceHint: 'Signed sample sheets (CO-8)' },
    response: { success: true, message: 'Criterion saved', data: { code: 'G5', title: 'Business validation samples passed', evidenceHint: 'Signed sample sheets (CO-8)', automatic: false, waivable: false, sort: 50, status: 'active' } },
    handler: async (req, res) => ok(res, await decisions.updateCriterionTemplate(req.params.code, req.body, req.user, req), 'Criterion saved'),
  });
  define({
    method: 'GET', path: '/decisions', summary: 'Go / No-Go decisions, newest first, with their criteria and approvers (filter runId)', screen: DECISION, middleware: canRead, query: { runId: 3 },
    response: { success: true, data: [decisionExample] },
    handler: async (req, res) => ok(res, await decisions.listDecisions({ runId: req.query.runId || null })),
  });
  define({
    method: 'POST', path: '/decisions', summary: 'Create the Go / No-Go decision of a run with its approvers (users who may approve go-live, at least migration.go_live_min_approvers, one as Finance Head, not the creator); the criteria are copied and the automatic ones computed',
    screen: `${DECISION} > New decision`, middleware: canWrite,
    request: { runId: 3, meetingAt: '2026-11-01T08:00:00Z', approvers: [{ userId: 'usr_91b2', roleLabel: 'Finance Head' }, { userId: 'usr_44d0', roleLabel: 'General Manager' }] },
    response: { success: true, message: 'Decision created', data: { ...decisionExample, status: 'draft' } },
    handler: async (req, res) => created(res, await decisions.createDecision(req.body, req.user, req), 'Decision created'),
  });
  define({
    method: 'GET', path: '/decisions/:id', summary: 'A decision: criteria with their automatic results, evidence and waivers; approvers and votes; outcome', screen: DECISION, middleware: canRead,
    response: { success: true, data: decisionExample },
    handler: async (req, res) => ok(res, await decisions.getDecision(req.params.id)),
  });
  define({
    method: 'POST', path: '/decisions/:id/refresh', summary: 'Compute the automatic criteria again (G2 load, G3 checks and tie-outs, G4 sign-off, G6 comparison, G7 users, G8 numbering, G9 restore point, G11 evidence pack); draft only',
    screen: DECISION, middleware: canWrite, response: { success: true, message: 'Criteria refreshed', data: { ...decisionExample, status: 'draft' } },
    handler: async (req, res) => ok(res, await decisions.refreshDecision(req.params.id, req.user, req), 'Criteria refreshed'),
  });
  define({
    method: 'PUT', path: '/decisions/:id/criteria/:code', summary: 'Record a criterion of a draft decision: met or not met for a manual criterion and its evidence (write:data-load); waived with a reason (approve:data-load, not the creator; refused on G2 to G5)',
    screen: DECISION, middleware: canWriteOrApprove, request: { status: 'waived', waiverReason: 'Project Sponsor approval in writing, ref. PS-2026-11' },
    response: { success: true, message: 'Criterion saved', data: { ...decisionExample, status: 'draft' } },
    handler: async (req, res) => ok(res, await decisions.setCriterion(req.params.id, req.params.code, req.body, req.user, req), 'Criterion saved'),
  });
  define({
    method: 'POST', path: '/decisions/:id/open-voting', summary: 'Open the voting once every criterion is met or waived (the automatic criteria are computed again); the approvers are notified',
    screen: DECISION, middleware: canWrite, response: { success: true, message: 'Voting open', data: decisionExample },
    handler: async (req, res) => ok(res, await decisions.openVoting(req.params.id, req.user, req), 'Voting open'),
  });
  define({
    method: 'POST', path: '/decisions/:id/vote', summary: 'Vote Go or No-Go (a named approver of the decision, once). A No-Go gives the reason, the actions and the new date and ends the decision; the last Go makes it Go',
    screen: `${DECISION} > Vote`, middleware: canApprove, request: { vote: 'no-go', remarks: 'Tie-out of due to insurers open', reason: 'Due to insurers differ by PHP 12,400', actions: 'Explain the difference with the Finance Head', newDate: '2026-11-09' },
    response: { success: true, message: 'Vote recorded', data: { ...decisionExample, status: 'no-go' } },
    handler: async (req, res) => {
      const d = await decisions.vote(req.params.id, req.body, req.user, req);
      ok(res, d, d.status === 'voting' ? 'Vote recorded' : `Decision: ${d.statusLabel}`);
    },
  });
  define({
    method: 'POST', path: '/decisions/:id/withdraw', summary: 'Withdraw a decision in draft or voting, with a reason', screen: DECISION, middleware: canWrite, request: { reason: 'Meeting moved' },
    response: { success: true, message: 'Decision withdrawn', data: { ...decisionExample, status: 'withdrawn' } },
    handler: async (req, res) => ok(res, await decisions.withdrawDecision(req.params.id, req.body, req.user, req), 'Decision withdrawn'),
  });
}
