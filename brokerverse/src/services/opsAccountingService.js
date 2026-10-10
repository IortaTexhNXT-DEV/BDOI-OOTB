import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";
import { printPdf } from "../components/Print/printPdf";

/**
 * Operations and accounting API: cover notes (/cover-notes), policy cancellation (/cancellations), post-dated cheques
 * (/pdc), claim documents (/claim-documents), claims settlements (/claim-payments), motor claim repairs
 * (/motor-claims), accounts payable (/payables), fixed assets (/fixed-assets) and their masters (/ops-masters).
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};
const handle = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(apiErrorMessage(body, response.status));
    error.errors = Array.isArray(body.errors) ? body.errors : [];
    throw error;
  }
  return body;
};
const raw = async (path, options = {}) => handle(await fetch(`${BASE_URL}${path}`, {
  ...options,
  headers: { "Content-Type": "application/json", ...authService.getAuthHeader(), ...options.headers },
}));
const request = async (path, options = {}) => (await raw(path, options)).data;
const post = (path, payload = {}) => request(path, { method: "POST", body: JSON.stringify(payload) });
const put = (path, payload = {}) => request(path, { method: "PUT", body: JSON.stringify(payload) });
const patch = (path, payload = {}) => request(path, { method: "PATCH", body: JSON.stringify(payload) });
const id = (v) => encodeURIComponent(v);

/** Print a PDF of the API (components/Print printPdf), or fetch a spreadsheet with the session token and save it. */
const openFile = async (path, fileName = "document.pdf", { download = false } = {}) => {
  if (!download) return printPdf(path, { fileName });
  const response = await fetch(`${BASE_URL}${path}`, { headers: { ...authService.getAuthHeader() } });
  if (!response.ok) await handle(response);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const opsAccountingService = {
  openFile,
  // operational masters
  masterRecords: async (type, params) => {
    const body = await raw(`/ops-masters/${id(type)}${qs({ perPage: 500, ...params })}`);
    return { rows: body.data || [], type: body.type };
  },
  createMaster: (type, payload) => post(`/ops-masters/${id(type)}`, payload),
  updateMaster: (type, recordId, payload) => put(`/ops-masters/${id(type)}/${id(recordId)}`, payload),
  setMasterStatus: (type, recordId, status) => patch(`/ops-masters/${id(type)}/${id(recordId)}/status`, { status }),
  // cover notes
  coverNotes: (params) => request(`/cover-notes${qs(params)}`),
  coverNoteSources: (search) => request(`/cover-notes/sources${qs({ search })}`),
  issueCoverNote: (payload) => post("/cover-notes", payload),
  cancelCoverNote: (cnId, reason) => post(`/cover-notes/${id(cnId)}/cancel`, { reason }),
  sendCoverNote: (cnId, to) => post(`/cover-notes/${id(cnId)}/send`, to ? { to } : {}),
  printCoverNote: (cnId) => openFile(`/cover-notes/${id(cnId)}/pdf`),
  // cancellation
  cancellationReasons: () => request("/cancellations/reasons"),
  searchPolicies: (search) => request(`/policies${qs({ search, status: "active", pageSize: 10 })}`),
  cancellationQuote: (payload) => post("/cancellations/quote", payload),
  createCancellation: async (payload) => {
    const body = await raw("/endorsements/create-endorsement", { method: "POST", body: JSON.stringify(payload) });
    return body.data || body;
  },
  // post-dated cheques
  pdcs: (params) => request(`/pdc${qs(params)}`),
  pdcDue: () => request("/pdc/deposit-due"),
  registerPdc: (payload) => post("/pdc", payload),
  pdcAction: (pdcId, action, payload = {}) => post(`/pdc/${id(pdcId)}/${action}`, payload),
  downloadPdcs: (params) => openFile(`/pdc${qs({ ...params, format: "xlsx" })}`, "post-dated-cheques.xlsx", { download: true }),
  // claim documents
  claimsAwaitingDocuments: (params) => request(`/claim-documents/awaiting${qs(params)}`),
  claimChecklist: (claimRef) => request(`/claim-documents/claims/${id(claimRef)}`),
  updateChecklistItem: (claimRef, itemId, payload) => patch(`/claim-documents/claims/${id(claimRef)}/items/${id(itemId)}`, payload),
  addChecklistItem: (claimRef, payload) => post(`/claim-documents/claims/${id(claimRef)}/items`, payload),
  uploadChecklistItem: async (claimRef, itemId, file) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${BASE_URL}/claim-documents/claims/${id(claimRef)}/items/${id(itemId)}/upload`, { method: "POST", body: form, headers: { ...authService.getAuthHeader() } });
    return (await handle(response)).data;
  },
  remindClaimant: (claimRef, to) => post(`/claim-documents/claims/${id(claimRef)}/remind`, to ? { to } : {}),
  submitClaimToInsurer: (claimRef, payload) => post(`/claim-documents/claims/${id(claimRef)}/submit-to-insurer`, payload),
  claims: async (params) => {
    const body = await raw(`/claims${qs({ pageSize: 50, ...params })}`);
    return body.data?.claims || [];
  },
  // claims settlements
  claimSettlements: (params) => request(`/claim-payments${qs(params)}`),
  claimSettlement: (claimRef) => request(`/claim-payments/claims/${id(claimRef)}`),
  claimFundsReceived: (claimRef, payload) => post(`/claim-payments/claims/${id(claimRef)}/funds-received`, payload),
  claimPay: (claimRef, payload) => post(`/claim-payments/claims/${id(claimRef)}/pay`, payload),
  claimVoucher: (movementId) => openFile(`/claim-payments/movements/${id(movementId)}/voucher`),
  claimReleaseForm: (claimRef) => openFile(`/claim-payments/claims/${id(claimRef)}/release-form`),
  // motor claim repairs
  motorRepairs: (params) => request(`/motor-claims${qs(params)}`),
  repairShops: () => request("/motor-claims/repair-shops"),
  repairFile: (claimRef) => request(`/motor-claims/claims/${id(claimRef)}`),
  addEstimate: (claimRef, payload) => post(`/motor-claims/claims/${id(claimRef)}/estimates`, payload),
  decideEstimate: (claimRef, estimateId, payload) => post(`/motor-claims/claims/${id(claimRef)}/estimates/${id(estimateId)}/decision`, payload),
  issueLoa: (claimRef, payload) => post(`/motor-claims/claims/${id(claimRef)}/loas`, payload),
  cancelLoa: (claimRef, loaId, reason) => post(`/motor-claims/claims/${id(claimRef)}/loas/${id(loaId)}/cancel`, { reason }),
  printLoa: (claimRef, loaId) => openFile(`/motor-claims/claims/${id(claimRef)}/loas/${id(loaId)}/pdf`),
  releaseVehicle: (claimRef, payload) => post(`/motor-claims/claims/${id(claimRef)}/releases`, payload),
  printRelease: (claimRef, releaseId) => openFile(`/motor-claims/claims/${id(claimRef)}/releases/${id(releaseId)}/pdf`),
  // accounts payable
  supplierInvoices: (params) => request(`/payables/invoices${qs(params)}`),
  supplierInvoice: (invId) => request(`/payables/invoices/${id(invId)}`),
  createSupplierInvoice: (payload) => post("/payables/invoices", payload),
  invoiceAction: (invId, action, payload = {}) => post(`/payables/invoices/${id(invId)}/${action}`, payload),
  printSupplierInvoice: (invId) => openFile(`/payables/invoices/${id(invId)}/pdf`),
  supplierPayments: (params) => request(`/payables/payments${qs(params)}`),
  createSupplierPayment: (payload) => post("/payables/payments", payload),
  cancelSupplierPayment: (payId, reason) => post(`/payables/payments/${id(payId)}/cancel`, { reason }),
  printSupplierPayment: (payId) => openFile(`/payables/payments/${id(payId)}/pdf`),
  apAgeing: (params) => request(`/payables/ageing${qs(params)}`),
  downloadApAgeing: (params) => openFile(`/payables/ageing${qs({ ...params, format: "xlsx" })}`, "ap-ageing.xlsx", { download: true }),
  // fixed assets
  assetClasses: () => request("/fixed-assets/classes"),
  assets: (params) => request(`/fixed-assets/assets${qs(params)}`),
  asset: (assetId) => request(`/fixed-assets/assets/${id(assetId)}`),
  createAsset: (payload) => post("/fixed-assets/assets", payload),
  updateAsset: (assetId, payload) => put(`/fixed-assets/assets/${id(assetId)}`, payload),
  downloadAssets: () => openFile("/fixed-assets/assets?format=xlsx", "fixed-asset-register.xlsx", { download: true }),
  depreciationPreview: (period) => request(`/fixed-assets/depreciation/${id(period)}`),
  runDepreciation: (period) => post(`/fixed-assets/depreciation/${id(period)}/run`, {}),
  // fixed asset disposal (sale or write-off) and the disposal register
  disposalPreview: (assetId, params) => request(`/fixed-assets/assets/${id(assetId)}/disposal-preview${qs(params)}`),
  disposeAsset: (assetId, payload) => post(`/fixed-assets/assets/${id(assetId)}/dispose`, payload),
  disposals: (params) => request(`/fixed-assets/disposals${qs(params)}`),
  cancelDisposal: (disposalId, reason) => post(`/fixed-assets/disposals/${id(disposalId)}/cancel`, { reason }),
  printDisposal: (disposalId) => openFile(`/fixed-assets/disposals/${id(disposalId)}/pdf`),
  downloadDisposals: (params) => openFile(`/fixed-assets/disposals${qs({ ...params, format: "xlsx" })}`, "fixed-asset-disposals.xlsx", { download: true }),
  // bank accounts for deposits and payments
  bankAccounts: async () => {
    const body = await raw("/masters/bank-account/options?valueField=code");
    return body.data || [];
  },
  banks: async () => {
    const body = await raw("/masters/bank/options?valueField=id");
    return body.data || [];
  },
};

export default opsAccountingService;
