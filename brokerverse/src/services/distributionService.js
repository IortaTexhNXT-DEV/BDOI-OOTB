import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";
import { printPdf } from "../components/Print/printPdf";

/**
 * Distribution, programmes and products API: lead assignment (/lead-assignment), distribution channels (/channels),
 * brand-new vehicle programmes (/motor-programmes), fleet schedules (/fleet), marine open covers (/marine), comparison
 * reports (/comparison-reports), campaigns (/campaigns) and the Report Builder (/report-builder).
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};
const handle = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(apiErrorMessage(body, response.status));
  }
  return body;
};
const request = async (path, options = {}) => (await handle(await fetch(`${BASE_URL}${path}`, {
  ...options,
  headers: { "Content-Type": "application/json", ...authService.getAuthHeader(), ...options.headers },
}))).data;
/** The whole answer ({ data, message, ... }) for actions whose message is shown to the user. */
const send = async (method, path, payload = {}) => handle(await fetch(`${BASE_URL}${path}`, {
  method, body: JSON.stringify(payload), headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
}));
const post = (path, payload) => send("POST", path, payload);
const put = (path, payload) => send("PUT", path, payload);
const remove = (path) => send("DELETE", path);
const upload = async (path, file) => {
  const form = new FormData();
  form.append("file", file);
  return handle(await fetch(`${BASE_URL}${path}`, { method: "POST", body: form, headers: { ...authService.getAuthHeader() } }));
};
/** Print a PDF of the API (components/Print printPdf), or fetch any other file with the session token and save it. */
const fileFrom = async (path, fileName, { open = false, method = "GET", payload = null } = {}) => {
  if (open) return printPdf(path, { fileName });
  const response = await fetch(`${BASE_URL}${path}`, {
    method, headers: { ...(payload ? { "Content-Type": "application/json" } : {}), ...authService.getAuthHeader() }, body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) await handle(response);
  const name = (response.headers.get("content-disposition") || "").match(/filename="([^"]+)"/)?.[1] || fileName;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
const id = (v) => encodeURIComponent(v);

const LA = "/lead-assignment";
const CH = "/channels";
const MP = "/motor-programmes";
const FL = "/fleet";
const MA = "/marine";
const CR = "/comparison-reports";
const CP = "/campaigns";
const RB = "/report-builder";

const distributionService = {
  // lead assignment
  assignmentRules: (params) => request(`${LA}/rules${qs(params)}`),
  createRule: (body) => post(`${LA}/rules`, body),
  updateRule: (ruleId, body) => put(`${LA}/rules/${id(ruleId)}`, body),
  deleteRule: (ruleId) => remove(`${LA}/rules/${id(ruleId)}`),
  assignmentQueue: (params) => request(`${LA}/queue${qs(params)}`),
  reorderRules: (ids) => put(`${LA}/rules/order`, { ids }),
  runRules: (dryRun) => post(`${LA}/rules/run`, { dryRun }),
  reassign: (body) => post(`${LA}/reassign`, body),
  sendToQueue: (body) => post(`${LA}/queue`, body),
  takeFromQueue: (leadIds) => post(`${LA}/queue/take`, { leadIds }),
  assignmentHistory: (leadId) => request(`${LA}/history/${id(leadId)}`),
  teamView: (params) => request(`${LA}/team${qs(params)}`),
  assignees: (leadIds) => request(`${LA}/assignees${qs({ leadIds: leadIds?.length ? leadIds.join(",") : undefined })}`),

  // distribution channels
  channels: (params) => request(`${CH}${qs(params)}`),
  channelOptions: (type) => request(`${CH}/options${qs({ type })}`),
  createChannel: (body) => post(CH, body),
  updateChannel: (channelId, body) => put(`${CH}/${id(channelId)}`, body),
  deleteChannel: (channelId) => remove(`${CH}/${id(channelId)}`),

  // brand-new vehicle programmes
  programmes: (params) => request(`${MP}${qs(params)}`),
  createProgramme: (body) => post(MP, body),
  updateProgramme: (programmeId, body) => put(`${MP}/${id(programmeId)}`, body),
  premiumPreview: (programmeId, params) => request(`${MP}/${id(programmeId)}/premium-preview${qs(params)}`),
  uploadSales: (programmeId, file) => upload(`${MP}/${id(programmeId)}/sales/upload`, file),
  salesTemplate: () => fileFrom(`${MP}/upload-template`, "Dealer_Sales_Upload_Template.xlsx"),
  salesBatches: (params) => request(`${MP}/batches${qs(params)}`),
  dealerSales: (params) => request(`${MP}/sales${qs(params)}`),
  bankLetter: (saleId) => fileFrom(`${MP}/sales/${id(saleId)}/bank-letter`, "bank-letter.pdf", { open: true }),
  batchBankLetters: (batchId) => fileFrom(`${MP}/batches/${id(batchId)}/bank-letters`, "bank-letters.pdf", { open: true }),
  emailBankLetter: (saleId, to) => post(`${MP}/sales/${id(saleId)}/bank-letter/email`, to ? { to } : {}),

  // fleet schedules
  fleets: (params) => request(`${FL}${qs(params)}`),
  fleet: (fleetId) => request(`${FL}/${id(fleetId)}`),
  createFleet: (body) => post(FL, body),
  updateFleet: (fleetId, body) => put(`${FL}/${id(fleetId)}`, body),
  addVehicle: (fleetId, body) => post(`${FL}/${id(fleetId)}/vehicles`, body),
  updateVehicle: (fleetId, vehicleId, body) => put(`${FL}/${id(fleetId)}/vehicles/${id(vehicleId)}`, body),
  removeVehicle: (fleetId, vehicleId) => remove(`${FL}/${id(fleetId)}/vehicles/${id(vehicleId)}`),
  uploadVehicles: (fleetId, file) => upload(`${FL}/${id(fleetId)}/vehicles/upload`, file),
  fleetTemplate: () => fileFrom(`${FL}/upload-template`, "Fleet_Vehicles_Upload_Template.xlsx"),
  issueFleet: (fleetId) => post(`${FL}/${id(fleetId)}/issue`),
  endorseAddVehicle: (fleetId, body) => post(`${FL}/${id(fleetId)}/endorse/add-vehicle`, body),
  endorseDeleteVehicle: (fleetId, vehicleId, body) => post(`${FL}/${id(fleetId)}/endorse/delete-vehicle/${id(vehicleId)}`, body),
  fleetSchedulePdf: (fleetId) => fileFrom(`${FL}/${id(fleetId)}/schedule.pdf`, "fleet-schedule.pdf", { open: true }),
  fleetScheduleXlsx: (fleetId) => fileFrom(`${FL}/${id(fleetId)}/schedule.xlsx`, "fleet-schedule.xlsx"),

  // marine open covers
  openCovers: (params) => request(`${MA}/open-covers${qs(params)}`),
  openCover: (coverId) => request(`${MA}/open-covers/${id(coverId)}`),
  createOpenCover: (body) => post(`${MA}/open-covers`, body),
  updateOpenCover: (coverId, body) => put(`${MA}/open-covers/${id(coverId)}`, body),
  activateOpenCover: (coverId) => post(`${MA}/open-covers/${id(coverId)}/activate`),
  cancelOpenCover: (coverId, reason) => post(`${MA}/open-covers/${id(coverId)}/cancel`, { reason }),
  issueCertificate: (coverId, body) => post(`${MA}/open-covers/${id(coverId)}/certificates`, body),
  addDeclaredItem: (coverId, body) => post(`${MA}/open-covers/${id(coverId)}/declared-items`, body),
  cancelCertificate: (certificateId, reason) => post(`${MA}/certificates/${id(certificateId)}/cancel`, { reason }),
  printCertificate: (certificateId) => fileFrom(`${MA}/certificates/${id(certificateId)}/print`, "certificate.pdf", { open: true }),
  createDeclaration: (coverId, period) => post(`${MA}/open-covers/${id(coverId)}/declarations`, { period }),
  declaration: (declarationId) => request(`${MA}/declarations/${id(declarationId)}`),
  refreshDeclaration: (declarationId) => post(`${MA}/declarations/${id(declarationId)}/refresh`),
  submitDeclaration: (declarationId, notes) => post(`${MA}/declarations/${id(declarationId)}/submit`, notes ? { notes } : {}),
  billDeclaration: (declarationId) => post(`${MA}/declarations/${id(declarationId)}/bill`),
  deleteDeclaration: (declarationId) => remove(`${MA}/declarations/${id(declarationId)}`),
  printDeclaration: (declarationId) => fileFrom(`${MA}/declarations/${id(declarationId)}/print`, "declaration.pdf", { open: true }),

  // comparison reports
  comparisonReports: (params) => request(`${CR}${qs(params)}`),
  comparisonDefaults: () => request(`${CR}/defaults`),
  createComparisonReport: (body) => post(CR, body),
  updateComparisonReport: (reportId, body) => put(`${CR}/${id(reportId)}`, body),
  comparisonPdf: (reportId) => fileFrom(`${CR}/${id(reportId)}/pdf`, "comparison-report.pdf", { open: true }),
  emailComparisonReport: (reportId, to) => post(`${CR}/${id(reportId)}/email`, to ? { to } : {}),
  acceptComparisonReport: (reportId, chosenKey) => post(`${CR}/${id(reportId)}/accept`, { chosenKey }),

  // campaigns
  segments: () => request(`${CP}/segments`),
  previewSegment: (criteria) => post(`${CP}/segments/preview`, { criteria }),
  createSegment: (body) => post(`${CP}/segments`, body),
  updateSegment: (segmentId, body) => put(`${CP}/segments/${id(segmentId)}`, body),
  campaignTemplates: () => request(`${CP}/templates`),
  createCampaignTemplate: (body) => post(`${CP}/templates`, body),
  updateCampaignTemplate: (templateId, body) => put(`${CP}/templates/${id(templateId)}`, body),
  previewCampaignTemplate: (templateId) => post(`${CP}/templates/${id(templateId)}/preview`),
  campaigns: (params) => request(`${CP}${qs(params)}`),
  createCampaign: (body) => post(CP, body),
  updateCampaign: (campaignId, body) => put(`${CP}/${id(campaignId)}`, body),
  scheduleCampaign: (campaignId, scheduledAt) => post(`${CP}/${id(campaignId)}/schedule`, { scheduledAt }),
  sendCampaign: (campaignId) => post(`${CP}/${id(campaignId)}/send`),
  cancelCampaign: (campaignId) => post(`${CP}/${id(campaignId)}/cancel`),
  campaignResults: (campaignId) => request(`${CP}/${id(campaignId)}/results`),

  // report builder
  datasets: () => request(`${RB}/datasets`),
  runReport: (definition) => post(`${RB}/run`, definition),
  exportReport: (definition) => fileFrom(`${RB}/export`, "report.xlsx", { method: "POST", payload: definition }),
  savedReports: () => request(`${RB}/reports`),
  saveReport: (body) => post(`${RB}/reports`, body),
  updateSavedReport: (reportId, body) => put(`${RB}/reports/${id(reportId)}`, body),
  deleteSavedReport: (reportId) => remove(`${RB}/reports/${id(reportId)}`),
  runSavedReport: (reportId) => post(`${RB}/reports/${id(reportId)}/run`),
  exportSavedReport: (reportId) => fileFrom(`${RB}/reports/${id(reportId)}/export`, "report.xlsx"),
  biRuns: () => request(`${RB}/bi-extract/runs`),
  runBiExtract: () => post(`${RB}/bi-extract/run`),
};

export default distributionService;
