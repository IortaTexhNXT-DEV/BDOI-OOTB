import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/**
 * Data Migration & Go-Live API (/data-load): overview, templates and value maps, loads (upload, review, duplicates,
 * approval, undo), reconciliations, runs with their checklist, defects and evidence, Go / No-Go, the go-live lock and
 * hypercare. Lists come back as { rows, total }; files as { blob, fileName } (saveFile puts them on the user's computer).
 */
const BASE = "/data-load";

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};

const failure = (body, status) => {
  const error = new Error(apiErrorMessage(body, status));
  error.status = status;
  error.errors = body?.errors || [];
  return error;
};

const call = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${BASE}${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...authService.getAuthHeader(), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw failure(body, response.status);
  return body;
};
const get = async (path) => (await call(path)).data;
const list = async (path) => {
  const body = await call(path);
  return { rows: body.data || [], total: body.total ?? (body.data || []).length, extra: body };
};
const post = async (path, payload = {}) => (await call(path, { method: "POST", body: JSON.stringify(payload) })).data;
const put = async (path, payload = {}) => (await call(path, { method: "PUT", body: JSON.stringify(payload) })).data;
const del = async (path) => (await call(path, { method: "DELETE" })).data;
const upload = async (path, file, fields = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") form.append(k, v);
  });
  form.append("file", file);
  return (await call(path, { method: "POST", body: form })).data;
};

/** GET a file with the session token: { blob, fileName, sha256 }. */
const file = async (path) => {
  const response = await fetch(`${BASE_URL}${BASE}${path}`, { headers: { ...authService.getAuthHeader() } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw failure(body, response.status);
  }
  const name = /filename="?([^";]+)"?/i.exec(response.headers.get("Content-Disposition") || "");
  return { blob: await response.blob(), fileName: name ? name[1] : "download", sha256: response.headers.get("X-Content-SHA256") || null };
};

/** Put a downloaded file on the user's computer. */
export const saveFile = ({ blob, fileName }) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const goLiveService = {
  overview: () => get("/overview"),
  hypercare: () => get("/hypercare"),
  kits: () => get("/kits"),
  users: () => get("/users"),
  template: (kit, { prefill = false, objects = [] } = {}) => file(`/kits/${kit}/template${qs({ prefill: prefill ? "true" : undefined, objects: objects.join(",") })}`),

  // value maps
  valueMaps: (params) => list(`/value-maps${qs(params)}`),
  saveValueMap: (body) => post("/value-maps", body),
  updateValueMap: (id, body) => put(`/value-maps/${id}`, body),
  deleteValueMap: (id) => del(`/value-maps/${id}`),
  valueMapsWorkbook: () => file("/value-maps/workbook"),
  namesWorkbook: (token) => file(`/document-names/check/${token}/workbook`),

  // loads
  batches: (params) => list(`/batches${qs(params)}`),
  batch: (id) => get(`/batches/${id}`),
  createBatch: (file_, fields) => upload("/batches", file_, fields),
  validateBatch: (id) => post(`/batches/${id}/validate`),
  batchRows: (id, params) => list(`/batches/${id}/rows${qs(params)}`),
  batchDuplicates: (id, params) => list(`/batches/${id}/duplicates${qs(params)}`),
  resolveDuplicates: (id, body) => post(`/batches/${id}/resolutions`, body),
  submitBatch: (id, validRowsOnly = false) => post(`/batches/${id}/submit`, { validRowsOnly }),
  withdrawBatch: (id) => post(`/batches/${id}/withdraw`),
  approveBatch: (id) => post(`/batches/${id}/approve`),
  rejectBatch: (id, reason) => post(`/batches/${id}/reject`, { reasonCode: reason.reasonCode, remarks: reason.note }),
  errorsFile: (id) => file(`/batches/${id}/errors`),
  batchReconciliation: (id) => file(`/batches/${id}/reconciliation`),
  uploadedFile: (id) => file(`/batches/${id}/file`),
  dependents: (id) => get(`/batches/${id}/dependents`),
  dependentsWorkbook: (id) => file(`/batches/${id}/dependents/workbook`),
  requestUndo: (id, reason) => post(`/batches/${id}/undo-request`, { reason }),
  approveUndo: (id) => post(`/batches/${id}/undo-approve`),
  rejectUndo: (id, remarks) => post(`/batches/${id}/undo-reject`, { remarks }),
  withdrawUndo: (id) => post(`/batches/${id}/undo-withdraw`),

  // reconciliation
  reconciliations: (params) => list(`/reconciliations${qs(params)}`),
  reconciliation: (id) => get(`/reconciliations/${id}`),
  createReconciliation: (body) => post("/reconciliations", body),
  recompute: (id) => post(`/reconciliations/${id}/recompute`),
  updateLine: (id, lineId, body) => put(`/reconciliations/${id}/lines/${lineId}`, body),
  explainDifference: (id, diffId, body) => put(`/reconciliations/${id}/differences/${diffId}`, body),
  acceptDifference: (id, diffId, explanation) => post(`/reconciliations/${id}/differences/${diffId}/accept`, { explanation }),
  sign: (id, slot, remarks) => post(`/reconciliations/${id}/signoffs/${slot}`, { remarks }),
  reconciliationReport: (id, format, signed = false) => file(`/reconciliations/${id}/report${qs({ format, version: signed ? "signed" : undefined })}`),
  tieouts: (id) => get(`/reconciliations/${id}/tieouts`),
  saveTieouts: (tieouts) => put("/settings/tieouts", { tieouts }),

  // runs, checklist, defects, evidence
  runs: (params) => list(`/runs${qs(params)}`),
  run: (id) => get(`/runs/${id}`),
  createRun: (body) => post("/runs", body),
  updateRun: (id, body) => put(`/runs/${id}`, body),
  startRun: (id) => post(`/runs/${id}/start`),
  completeRun: (id, body) => post(`/runs/${id}/complete`, body),
  cancelRun: (id, reason) => post(`/runs/${id}/cancel`, { reason }),
  runReport: (id, format) => file(`/runs/${id}/report${qs({ format })}`),
  evidencePack: (id) => file(`/runs/${id}/evidence-pack`),
  steps: (runId) => get(`/runs/${runId}/steps`),
  updateStep: (runId, stepId, body) => put(`/runs/${runId}/steps/${stepId}`, body),
  stepAction: (runId, stepId, action, body = {}) => post(`/runs/${runId}/steps/${stepId}/${action}`, body),
  defects: (runId) => get(`/runs/${runId}/defects`),
  createDefect: (runId, body) => post(`/runs/${runId}/defects`, body),
  updateDefect: (runId, defectId, body) => put(`/runs/${runId}/defects/${defectId}`, body),
  evidence: (params) => get(`/evidence${qs(params)}`),
  attachEvidence: (file_, fields) => upload("/evidence", file_, fields),
  evidenceFile: (id) => file(`/evidence/${id}`),
  deleteEvidence: (id) => del(`/evidence/${id}`),

  // Go / No-Go, lock, SAP opening file
  decisions: (runId) => get(`/decisions${qs({ runId })}`),
  createDecision: (body) => post("/decisions", body),
  refreshDecision: (id) => post(`/decisions/${id}/refresh`),
  setCriterion: (id, code, body) => put(`/decisions/${id}/criteria/${code}`, body),
  openVoting: (id) => post(`/decisions/${id}/open-voting`),
  vote: (id, body) => post(`/decisions/${id}/vote`, body),
  withdrawDecision: (id, reason) => post(`/decisions/${id}/withdraw`, { reason }),
  goLive: () => get("/golive"),
  setCutoverDate: (cutoverDate) => put("/golive/cutover-date", { cutoverDate }),
  lockRequests: (params) => get(`/golive/lock-requests${qs(params)}`),
  requestLock: (body) => post("/golive/lock-requests", body),
  approveLock: (id) => post(`/golive/lock-requests/${id}/approve`),
  rejectLock: (id, remarks) => post(`/golive/lock-requests/${id}/reject`, { remarks }),
  withdrawLock: (id) => post(`/golive/lock-requests/${id}/withdraw`),
  sapOpening: () => get("/golive/sap-opening-file"),
  requestSapOpening: (reason) => post("/golive/sap-opening-file", { reason }),
  approveSapOpening: () => post("/golive/sap-opening-file/approve"),
  rejectSapOpening: (remarks) => post("/golive/sap-opening-file/reject", { remarks }),
  withdrawSapOpening: () => post("/golive/sap-opening-file/withdraw"),
  sapOpeningFile: (kind) => file(`/golive/sap-opening-file/files/${kind}`),

  /** Upload paths for the shared ImportDialog (it posts the file itself). */
  paths: {
    batches: `${BASE}/batches`,
    valueMapsUpload: `${BASE}/value-maps/upload`,
    valueMapsTemplate: `${BASE}/value-maps/workbook`,
    namesCheck: `${BASE}/document-names/check`,
    legacy: (id) => `${BASE}/reconciliations/${id}/legacy`,
    kitTemplate: (kit) => `${BASE}/kits/${kit}/template`,
  },
};

export default goLiveService;
