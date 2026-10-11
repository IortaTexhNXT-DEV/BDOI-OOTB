/**
 * Records of the Data Migration & Go-Live API as the screens receive them, and the signed-in user, for the jest tests
 * of the workspace.
 */

/** Sign in as a user with these API permissions (roles decide the menus only). */
export const signIn = (permissions, { userId = "usr_me", roles = ["tis-it-admin"] } = {}) => {
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
  localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  localStorage.setItem("user", JSON.stringify({ userId, username: userId, displayName: userId, roles }));
};
export const READ = ["read:data-load"];
export const WRITE = ["read:data-load", "write:data-load"];
export const APPROVE = ["read:data-load", "approve:data-load"];
export const ALL = ["read:data-load", "write:data-load", "approve:data-load", "view:pii"];

export const overview = {
  cutoverDate: "2026-11-02", locked: false, lockedAt: null, unlock: null, environment: "uat",
  phases: [{ key: "templates", label: "Templates", status: "done" }, { key: "mock-1", label: "Mock 1", status: "in-progress" }],
  run: { id: 3, runNumber: "RUN-000003", kind: "production", title: "Production cutover", status: "running", checklist: { done: 2, total: 4, blocked: 0, percent: 50 },
    reconciliation: { id: 7, reconNumber: "REC-000007", status: "open", openDifferences: 1 }, decision: null },
  loads: { loaded: 2, pendingApproval: 1, failed: 0, rows: { new: 1450, changed: 4, unchanged: 0, duplicate: 2 },
    latest: [{ id: 12, loadNumber: "MIG-000012", kit: "migration", fileName: "wb.xlsx", status: "pending-approval", createdAt: "2026-10-28T09:00:00Z" }] },
  defects: { severity1: 0, severity2: 1 },
  forMe: { approvals: [{ type: "load", id: 12, reference: "MIG-000012" }], votes: [], steps: [] },
};

export const batch = (patch = {}) => ({
  id: 12, loadNumber: "MIG-000012", kit: "migration", runId: 3, legacySystem: "TISPH Excel", fileName: "GoLive_Migration_Workbook.xlsx", status: "validated",
  cutoverDate: "2026-11-02", rowsRead: 480, rowsValid: 480, rowsError: 0, rowsNew: 470, rowsChanged: 4, rowsUnchanged: 6, rowsDuplicate: 0, fileStored: true,
  validateMs: 5400, loadMs: null, undoMs: null, sameFileAs: null, sheets: [{ sheet: "clients", name: "Clients", read: 480, created: 470, updated: 4, unchanged: 6, duplicate: 0, errors: 0 }],
  loadedCounts: null, reconciliation: null, validRowsOnly: false, message: null, jobId: null, progress: null,
  createdBy: "Ana Loader", createdById: "usr_loader", createdAt: "2026-10-28T09:00:00Z", validatedAt: "2026-10-28T09:00:05Z",
  submittedBy: null, submittedById: null, submittedAt: null, expiresAt: null, decision: null, decidedBy: null, decidedAt: null,
  undoRequestedBy: null, undoRequestedById: null, undoRequestedAt: null, undoReason: null, ...patch,
});
export const batchResponse = (patch = {}, extra = {}) => ({ batch: batch(patch), errors: [], totalErrors: 0, queue: null, makers: { load: ["usr_loader"], undo: [] }, ...extra });

export const duplicateRow = (patch = {}) => ({
  id: 9013, sheet: "clients", sheetName: "Clients", row: 13, key: "C-000990", result: "duplicate", values: { clientCode: "C-000990" }, changes: [], errors: [], warnings: [],
  duplicates: [{ rule: "tin", label: "Same TIN", kind: "stored", recordId: "cli_1", number: "C-000881", name: "Andrea Lim" }], resolution: null, resolutionReason: null,
  resolvedBy: null, resolvedAt: null, ...patch,
});

export const reconciliation = (patch = {}) => ({
  id: 7, reconNumber: "REC-000007", runId: 3, allBatches: true, cutoverDate: "2026-11-02", openingBalancesAsAt: "2026-11-01", status: "open", computedAt: "2026-11-01T02:10:00Z",
  createdBy: "Ana Loader", createdById: "usr_loader", createdAt: "2026-11-01T02:10:00Z", signedAt: null, signedReport: false, reportSha256: null,
  batches: [{ id: 12, loadNumber: "MIG-000012", legacySystem: "TISPH Excel", loadedAt: "2026-11-01T01:55:00Z", status: "loaded" }],
  lines: [{ id: 41, kind: "measure", object: "Policies", measure: "gross premium", group: null, label: null, sides: { system: "BrokerVerse", other: "Legacy" }, systemValue: 1250000,
    legacyValue: 1250000, difference: 0, tolerance: 0, toleranceReason: null, accounts: [], status: "matched" }],
  differences: [], makers: ["usr_loader", "usr_approver"],
  signoffs: [{ slot: "data-owner", label: "Data owner", signedBy: null, signedById: null, signedAt: null, remarks: null },
    { slot: "finance-head", label: "Finance Head", signedBy: null, signedById: null, signedAt: null, remarks: null }],
  summary: { lines: 1, matched: 1, differences: 0, openDifferences: 0, missingLegacy: [], signed: 0, slots: 2 }, ...patch,
});

export const runRecord = (patch = {}) => ({
  id: 3, runNumber: "RUN-000003", kind: "production", title: "Production cutover", environment: "uat", cutoverDate: "2026-11-02", plannedStart: null, plannedEnd: null,
  actualStart: "2026-10-31T09:31:00Z", actualEnd: null, durationMs: null, status: "running", result: null, exitCriteria: null, exitCriteriaMet: null, summary: null,
  personalData: "masked-copy", dpoApprovalRef: null, restorePoint: null, evidencePackSha256: null, archiveRef: null, loads: 1, defectsOpen: 0, defectsTotal: 0, ...patch,
});

export const step = (patch = {}) => ({
  id: 31, runId: 3, code: "CO-3", title: "Pre-load checks and restore point", phase: "cutover", phaseLabel: "Cutover", ownerUserId: null, ownerName: null, ownerRole: "DevOps lead",
  evidenceHint: "Cutover log with the restore time", evidenceRequired: true, evidenceCount: 0, plannedStart: null, plannedEnd: null, actualStart: null, actualEnd: null,
  elapsedMs: null, late: false, status: "not-started", notes: null, dependsOn: [], waitingFor: [], ...patch,
});
export const steps = (list) => ({ runId: 3, runNumber: "RUN-000003", runStatus: "running", steps: list,
  progress: { done: 0, total: list.length, percent: 0, plannedMs: 0, elapsedMs: 0, next: null, late: [] } });

export const goLiveState = (patch = {}) => ({
  cutoverDate: "2026-11-02", locked: false, lockedAt: null, lockRequestId: null, unlock: null, unlockWindowEndsAt: null, unlockMaxHours: 4, pendingRequest: null,
  conditions: [{ code: "go-decision", label: "Go decision of the production run", met: true, detail: null },
    { code: "reconciliation", label: "Reconciliation of the production run signed", met: true, detail: null },
    { code: "restore-point", label: "Restore point recorded", met: true, detail: null }, { code: "nothing-pending", label: "Nothing pending", met: true, detail: null }],
  scopes: [{ key: "migration", label: "Migration workbook" }, { key: "opening-items", label: "Open items import" }],
  settings: { loadApprovalRequired: true, sapGlIncludeOpening: false }, ...patch,
});

export const decision = (patch = {}) => ({
  id: 2, runId: 3, runNumber: "RUN-000003", runKind: "production", status: "voting", meetingAt: null, reason: null, actions: null, newDate: null,
  createdBy: "Ana Loader", createdById: "usr_loader", createdAt: "2026-11-01T07:30:00Z", decidedAt: null,
  criteria: [{ code: "G2", title: "Production load loaded", waivable: false, automatic: true, status: "met", autoResult: { met: true, detail: "MIG-000012 loaded" }, evidence: null }],
  approvers: [{ userId: "usr_me", name: "Me", roleLabel: "Finance Head", vote: null, remarks: null, votedAt: null },
    { userId: "usr_gm", name: "GM", roleLabel: "General Manager", vote: null, remarks: null, votedAt: null }],
  summary: { criteria: 1, met: 1, votes: 0, approvers: 2 }, ...patch,
});
