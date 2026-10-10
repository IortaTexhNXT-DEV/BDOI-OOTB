import { apiRequest } from "./remittanceService";

const I = "/incentive";
const id = (v) => encodeURIComponent(v);
const data = async (method, path, options) => (await apiRequest(method, `${I}${path}`, options)).data;
const get = (path, params) => data("GET", path, { params });
const post = (path, body) => data("POST", path, { body: body || {} });

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
  adjustCalculation: (batchId, lines) => post(`/calculations/${id(batchId)}/adjust`, { lines }),
  submitCalculation: (batchId) => post(`/calculations/${id(batchId)}/submit`),
  calculationActivity: (batchId) => get(`/calculations/${id(batchId)}/activity`),
  approveCalculation: (batchId, remarks) => post(`/calculations/${id(batchId)}/approve`, { remarks: remarks || undefined }),
  // reason: { reasonCode, note } of the Reason Codes master (context incentive_batch_reject)
  rejectCalculation: (batchId, reason) => post(`/calculations/${id(batchId)}/reject`, reason),
  payCalculation: (batchId, payload) => post(`/calculations/${id(batchId)}/pay`, payload),
  approvals: () => get("/approvals"),

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
