import { apiRequest } from "./remittanceService";
import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

const I = "/incentive";
const id = (v) => encodeURIComponent(v);
const data = async (method, path, options) => (await apiRequest(method, `${I}${path}`, options)).data;
const get = (path, params) => data("GET", path, { params });
const post = (path, body) => data("POST", path, { body: body || {} });
const put = (path, body) => data("PUT", path, { body: body || {} });

/** Download a file of the incentive API and save it under the name the server gives. */
const download = async (path, fallbackName) => {
  const response = await fetch(`${BASE_URL}${I}${path}`, { headers: authService.getAuthHeader() });
  if (!response.ok) throw new Error(apiErrorMessage(await response.json().catch(() => ({})), response.status));
  const name = (response.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

/** Incentive programs, calculations (maker-checker approvals), agent views and reports (/incentive/*). */
export const incentiveService = {
  // programs (Master > Incentive Programs)
  listPrograms: (params) => get("/programs", params),
  getProgram: (programId) => get(`/programs/${id(programId)}`),
  createProgram: (payload) => post("/programs", payload),
  updateProgram: (programId, payload) => data("PUT", `/programs/${id(programId)}`, { body: payload }),
  deleteProgram: (programId) => apiRequest("DELETE", `${I}/programs/${id(programId)}`),

  // calculations and approvals
  listCalculations: (params) => get("/calculations", params),
  getCalculation: (batchId) => get(`/calculations/${id(batchId)}`),
  createCalculation: (payload) => post("/calculations", payload),
  // reason: { reasonCode, note } of the Reason Codes master (context incentive_adjustment)
  adjustCalculation: (batchId, lines, reason) => post(`/calculations/${id(batchId)}/adjust`, { lines, ...reason }),
  submitCalculation: (batchId) => post(`/calculations/${id(batchId)}/submit`),
  calculationActivity: (batchId) => get(`/calculations/${id(batchId)}/activity`),
  approveCalculation: (batchId, remarks) => post(`/calculations/${id(batchId)}/approve`, { remarks: remarks || undefined }),
  // reason: { reasonCode, note } of the Reason Codes master (context incentive_batch_reject)
  rejectCalculation: (batchId, reason) => post(`/calculations/${id(batchId)}/reject`, reason),
  payCalculation: (batchId, payload) => post(`/calculations/${id(batchId)}/pay`, payload),
  approvals: () => get("/approvals"),

  // telesales program (FRS COMM-08): versions approved on Configuration Approvals, callers, batch policies
  telesalesDefaults: () => get("/telesales/defaults"),
  telesalesOptions: () => get("/telesales/options"),
  getTelesalesProgram: (programId) => get(`/telesales/programs/${id(programId)}`),
  createTelesalesProgram: (payload) => post("/telesales/programs", payload),
  saveTelesalesDraft: (programId, payload) => put(`/telesales/programs/${id(programId)}`, payload),
  submitTelesalesVersion: (programId, changeReason) => post(`/telesales/programs/${id(programId)}/submit`, { changeReason }),
  recallTelesalesVersion: (programId) => post(`/telesales/programs/${id(programId)}/recall`),
  addCaller: (programId, payload) => post(`/telesales/programs/${id(programId)}/callers`, payload),
  updateCaller: (callerId, payload) => put(`/telesales/callers/${id(callerId)}`, payload),
  // reason: { reasonCode, note } of the Reason Codes master (context incentive_disqualify) and the date
  disqualifyCaller: (callerId, payload) => post(`/telesales/callers/${id(callerId)}/disqualify`, payload),
  reinstateCaller: (callerId, payload) => post(`/telesales/callers/${id(callerId)}/reinstate`, payload),
  recalculate: (batchId) => post(`/calculations/${id(batchId)}/recalculate`),
  batchPolicies: (batchId, params) => get(`/calculations/${id(batchId)}/policies`, params),
  // reason: { reasonCode, note } of the Reason Codes master (context incentive_exclude)
  excludePolicy: (batchId, policyId, reason) => post(`/calculations/${id(batchId)}/policies/${id(policyId)}/exclude`, reason),
  includePolicy: (batchId, policyId) => post(`/calculations/${id(batchId)}/policies/${id(policyId)}/include`),
  exportBatch: (batchId) => download(`/calculations/${id(batchId)}/export`, `${batchId}.xlsx`),

  // agent views
  myPrograms: (agentId) => get("/my-programs", { agentId }),
  agentPrograms: () => get("/agent-programs"),
  statement: (params) => get("/statement", params),
  agents: () => get("/agents"),
  branches: () => get("/branches"),

  // reports
  reportTemplates: () => get("/reports/templates"),
  listReports: () => get("/reports"),
  generateReport: (payload) => post("/reports/generate", payload),
};

export default incentiveService;
