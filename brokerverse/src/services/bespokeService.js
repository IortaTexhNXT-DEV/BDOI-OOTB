import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Bespoke (non-packaged) placement API: clause library and slip templates, slip composer, underwriter rooms, layering
 * and co-insurance ledger, facultative reinsurance binders (routes under /bespoke).
 */
const queryString = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : "";
};

const parse = async (response) => {
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    const detail = Array.isArray(json.errors) ? json.errors.map((e) => e.message).filter(Boolean).join(", ") : "";
    const error = new Error(json.message && detail && json.message === "Validation failed" ? detail : json.message || detail || `Request failed (${response.status})`);
    error.status = response.status;
    error.errors = json.errors;
    throw error;
  }
  return json;
};

const request = async (method, path, body, { auth = true } = {}) => parse(await fetch(`${BASE_URL}${path}`, {
  method,
  headers: { "Content-Type": "application/json", ...(auth ? authService.getAuthHeader() : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
}));

/** Multipart upload: file plus plain fields. */
const upload = async (path, file, fields = {}) => {
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([k, v]) => v !== undefined && v !== null && form.append(k, v));
  return parse(await fetch(`${BASE_URL}${path}`, { method: "POST", headers: { ...authService.getAuthHeader() }, body: form }));
};

/** Open a server-rendered PDF in a new tab. */
const openPdf = async (path) => {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { ...authService.getAuthHeader() } });
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.message || `Could not open the document (${response.status})`);
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/** Download a server-generated file (XLSX / CSV) under its own name. */
const download = async (path, fileName) => {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { ...authService.getAuthHeader() } });
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.message || `Could not download the file (${response.status})`);
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const enc = encodeURIComponent;

const bespokeService = {
  // clause library and slip templates
  clauseOptions: async () => (await request("GET", "/bespoke/clauses/options")).data,
  listClauses: async (params) => (await request("GET", `/bespoke/clauses${queryString(params)}`)).data,
  getClause: async (id) => (await request("GET", `/bespoke/clauses/${enc(id)}`)).data,
  createClause: async (body) => (await request("POST", "/bespoke/clauses", body)).data,
  updateClause: async (id, body) => (await request("PUT", `/bespoke/clauses/${enc(id)}`, body)).data,
  listTemplates: async (params) => (await request("GET", `/bespoke/slip-templates${queryString(params)}`)).data,
  getTemplate: async (id) => (await request("GET", `/bespoke/slip-templates/${enc(id)}`)).data,
  createTemplate: async (body) => (await request("POST", "/bespoke/slip-templates", body)).data,
  updateTemplate: async (id, body) => (await request("PUT", `/bespoke/slip-templates/${enc(id)}`, body)).data,

  // slip composer
  listSlips: async (params) => (await request("GET", `/bespoke/slips${queryString(params)}`)).data,
  getSlip: async (id) => (await request("GET", `/bespoke/slips/${enc(id)}`)).data,
  createSlip: async (body) => (await request("POST", "/bespoke/slips", body)).data,
  saveSlip: (id, body) => request("PUT", `/bespoke/slips/${enc(id)}`, body),
  slipAction: async (id, action, note) => (await request("POST", `/bespoke/slips/${enc(id)}/${action}`, { note })).data,
  libraryClause: async (clauseId) => (await request("GET", `/bespoke/slips/library-clause/${enc(clauseId)}`)).data,
  slipDiff: async (id, from, to) => (await request("GET", `/bespoke/slips/${enc(id)}/diff${queryString({ from, to })}`)).data,
  openSlipPdf: (id) => openPdf(`/bespoke/slips/${enc(id)}/pdf`),

  // underwriter rooms
  listRooms: async (params) => (await request("GET", `/bespoke/rooms${queryString(params)}`)).data,
  getRoom: async (id) => (await request("GET", `/bespoke/rooms/${enc(id)}`)).data,
  createRoom: async (body) => (await request("POST", "/bespoke/rooms", body)).data,
  inviteInsurers: async (id, insurerIds) => (await request("POST", `/bespoke/rooms/${enc(id)}/insurers`, { insurerIds })).data,
  uploadSov: (id, file) => upload(`/bespoke/rooms/${enc(id)}/sov`, file),
  uploadAttachment: (id, file, fields) => upload(`/bespoke/rooms/${enc(id)}/attachments`, file, fields),
  requestBids: async (id, body) => (await request("POST", `/bespoke/rooms/${enc(id)}/bids/request`, body)).data,
  recordBid: async (id, body) => (await request("POST", `/bespoke/rooms/${enc(id)}/bids`, body)).data,
  counterBid: async (id, bidId, body) => (await request("POST", `/bespoke/rooms/${enc(id)}/bids/${enc(bidId)}/counter`, body)).data,
  bidAction: async (id, bidId, action, body = {}) => (await request("POST", `/bespoke/rooms/${enc(id)}/bids/${enc(bidId)}/${action}`, body)).data,
  postMessage: async (id, body) => (await request("POST", `/bespoke/rooms/${enc(id)}/messages`, body)).data,
  underwriterLink: async (id, insurerId, body = {}) => (await request("POST", `/bespoke/rooms/${enc(id)}/insurers/${enc(insurerId)}/link`, body)).data,
  award: (id, body) => request("POST", `/bespoke/rooms/${enc(id)}/award`, body),
  closeRoom: async (id, reason) => (await request("POST", `/bespoke/rooms/${enc(id)}/close`, { reason })).data,

  // external underwriter page (no sign-in)
  linkView: async (token) => (await request("POST", "/bespoke/underwriter-link/view", { token }, { auth: false })).data,
  linkBid: async (token, body) => (await request("POST", "/bespoke/underwriter-link/bid", { token, ...body }, { auth: false })).data,
  linkMessage: async (token, body) => (await request("POST", "/bespoke/underwriter-link/message", { token, body }, { auth: false })).data,

  // layering and co-insurance
  listLayered: async (params) => (await request("GET", `/bespoke/layers${queryString(params)}`)).data,
  getLayers: async (type, id) => (await request("GET", `/bespoke/layers/${enc(type)}/${enc(id)}`)).data,
  saveLayers: async (type, id, layers) => (await request("PUT", `/bespoke/layers/${enc(type)}/${enc(id)}`, { layers })).data,
  layerRemittance: async (type, id) => (await request("GET", `/bespoke/layers/${enc(type)}/${enc(id)}/remittance`)).data,
  reconcileParticipant: async (type, id, body) => (await request("POST", `/bespoke/layers/${enc(type)}/${enc(id)}/reconcile`, body)).data,
  claimSplit: async (claimId) => (await request("GET", `/bespoke/layers/claims/${enc(claimId)}`)).data,
  claimMovement: async (claimId, body) => (await request("POST", `/bespoke/layers/claims/${enc(claimId)}/movements`, body)).data,
  claimRecovery: async (claimId, body) => (await request("POST", `/bespoke/layers/claims/${enc(claimId)}/recoveries`, body)).data,
  outstandingRecoveries: async (params) => (await request("GET", `/bespoke/layers/reports/outstanding-recoveries${queryString(params)}`)).data,
  downloadRecoveries: (params) => download(`/bespoke/layers/reports/outstanding-recoveries${queryString({ ...params, format: "xlsx" })}`, "outstanding-recoveries.xlsx"),

  // facultative reinsurance
  facOptions: async () => (await request("GET", "/bespoke/facultative/options")).data,
  capacityCheck: async (params) => (await request("GET", `/bespoke/facultative/capacity-check${queryString(params)}`)).data,
  listFac: (params) => request("GET", `/bespoke/facultative${queryString(params)}`),
  getFac: async (id) => (await request("GET", `/bespoke/facultative/${enc(id)}`)).data,
  createFac: async (body) => (await request("POST", "/bespoke/facultative", body)).data,
  updateFac: async (id, body) => (await request("PUT", `/bespoke/facultative/${enc(id)}`, body)).data,
  facAction: async (id, action, body = {}) => (await request("POST", `/bespoke/facultative/${enc(id)}/${action}`, body)).data,
  facSettlement: async (id, body) => (await request("POST", `/bespoke/facultative/${enc(id)}/settlements`, body)).data,
  facRecovery: async (id, body) => (await request("POST", `/bespoke/facultative/${enc(id)}/recoveries`, body)).data,
  facRecoveryReceipt: async (recoveryId, body) => (await request("POST", `/bespoke/facultative/recoveries/${enc(recoveryId)}/receive`, body)).data,
  facStatement: async (params) => (await request("GET", `/bespoke/facultative/reports/statement${queryString(params)}`)).data,
  facAgeing: async (params) => (await request("GET", `/bespoke/facultative/reports/ageing${queryString(params)}`)).data,
  downloadFacStatement: (params) => download(`/bespoke/facultative/reports/statement${queryString({ ...params, format: "xlsx" })}`, "facultative-statement.xlsx"),
  openFacPdf: (id) => openPdf(`/bespoke/facultative/${enc(id)}/pdf`),
};

export default bespokeService;
