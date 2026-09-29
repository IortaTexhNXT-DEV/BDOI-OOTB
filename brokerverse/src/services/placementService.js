import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Placement journey API: Broker Slips (/broker-slips), Placement Slips (/placements), Record Issued Policy and the
 * journey configuration per line of business (placement.journey).
 */
const queryString = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : "";
};

const request = async (method, path, body) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

const enc = encodeURIComponent;

const placementService = {
  // reference data and configuration
  options: async () => (await request("GET", "/placements/options")).data,
  journey: async (params) => (await request("GET", `/placements/journey${queryString(params)}`)).data,
  searchClients: async (search) => {
    const data = (await request("GET", `/clients${queryString({ search, pageSize: 20 })}`)).data;
    return Array.isArray(data) ? data : data?.clients || [];
  },
  searchLeads: async (search) => (await request("GET", `/leads${queryString({ search, pageSize: 20 })}`)).data || [],

  // broker slips
  listSlips: (params) => request("GET", `/broker-slips${queryString(params)}`),
  getSlip: async (id) => (await request("GET", `/broker-slips/${enc(id)}`)).data,
  createSlip: async (body) => (await request("POST", "/broker-slips", body)).data,
  updateSlip: async (id, body) => (await request("PUT", `/broker-slips/${enc(id)}`, body)).data,
  submitSlip: (id) => request("POST", `/broker-slips/${enc(id)}/submit`, {}),
  addInsurer: async (id, insurer) => (await request("POST", `/broker-slips/${enc(id)}/insurers`, { insurer })).data,
  recordOffer: (id, offerId, body) => request("PUT", `/broker-slips/${enc(id)}/offers/${enc(offerId)}`, body),
  prepareQuotation: (id, body) => request("POST", `/broker-slips/${enc(id)}/prepare-quotation`, body),
  preparePlacement: async (id, body) => (await request("POST", `/broker-slips/${enc(id)}/prepare-placement`, body)).data,
  cancelSlip: async (id, reason) => (await request("POST", `/broker-slips/${enc(id)}/cancel`, { reason })).data,
  closeSlip: async (id, reason) => (await request("POST", `/broker-slips/${enc(id)}/close`, { reason })).data,
  openSlipPdf: (id, insurerId) => openPdf(`/broker-slips/${enc(id)}/documents/broker-slip${queryString({ insurerId })}`),

  // placement slips
  listPlacements: (params) => request("GET", `/placements${queryString(params)}`),
  getPlacement: async (id) => (await request("GET", `/placements/${enc(id)}`)).data,
  createPlacement: async (body) => (await request("POST", "/placements", body)).data,
  updatePlacement: async (id, body) => (await request("PUT", `/placements/${enc(id)}`, body)).data,
  sendPlacement: (id, insurerIds) => request("POST", `/placements/${enc(id)}/send`, insurerIds ? { insurerIds } : {}),
  confirmPlacement: async (id, confirmations) => (await request("POST", `/placements/${enc(id)}/confirm`, { confirmations })).data,
  declineParticipant: async (id, insuranceCompanyId, reason) => (await request("POST", `/placements/${enc(id)}/decline`, { insuranceCompanyId, reason })).data,
  cancelPlacement: async (id, reason) => (await request("POST", `/placements/${enc(id)}/cancel`, { reason })).data,
  issuePolicy: (id, body) => request("POST", `/placements/${enc(id)}/issue-policy`, body || {}),
  recordIssuedPolicy: (body) => request("POST", "/placements/record-issued-policy", body),
  /**
   * The placement slip of a quotation: created from the quotation, or the open one it already has. Used where the
   * journey refuses the direct conversion (PLACEMENT_JOURNEY) and by "Send to Insurance Company".
   */
  placeQuotation: async (quoteId, extra = {}) => {
    try {
      return (await request("POST", "/placements", { quoteId, ...extra })).data;
    } catch (e) {
      if (e.status !== 409) throw e;
      const open = (await request("GET", `/placements${queryString({ quoteId, status: "draft,sent,bound,issued" })}`)).data || [];
      if (!open.length) throw e;
      return open[0];
    }
  },
  openPlacementPdf: (id, insurerId) => openPdf(`/placements/${enc(id)}/documents/placement-slip${queryString({ insurerId })}`),
};

export default placementService;
