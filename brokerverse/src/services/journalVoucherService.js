import request from "../utility/interceptor";
import { getRequest, postRequest } from "../utility/commonServices";

const BASE = "journal-vouchers";

/** Error text from an axios error raised by the API. */
export const apiErrorMessage = (error, fallback = "Request failed") =>
  error?.response?.data?.message ||
  error?.response?.data?.error?.message ||
  error?.message ||
  fallback;

const journalVoucherService = {
  async getHistory(params = {}) {
    return (await getRequest(`${BASE}/history`, params)).data;
  },
  async getVoucher(idOrNumber) {
    return (await getRequest(`${BASE}/${encodeURIComponent(idOrNumber)}`)).data?.data;
  },
  async create(payload) {
    return (await postRequest(BASE, payload)).data;
  },
  async approve(id) {
    return (await postRequest(`${BASE}/${encodeURIComponent(id)}/approve`, {})).data;
  },
  async reject(id, reason) {
    return (await postRequest(`${BASE}/${encodeURIComponent(id)}/reject`, { reason })).data;
  },
  /** Correction JV: reverses transactionNumber and posts the corrected entries. */
  async createCorrection(payload) {
    return (await postRequest(`${BASE}/correction`, payload)).data;
  },
  /** Reversal JV of a posted voucher (transactionNumber). */
  async createReversal(payload) {
    return (await postRequest(`${BASE}/reversal`, payload)).data;
  },
  /** Upload template (XLSX with the Data, Columns and Instructions sheets), saved under the name the server gives. */
  async downloadTemplate() {
    const response = await request.get(`${BASE}/upload/template`, { responseType: "blob" });
    const name = (response.headers?.["content-disposition"] || "").match(/filename="([^"]+)"/)?.[1] || "Journal_Vouchers_Upload_Template.xlsx";
    const href = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  },
  /** Upload vouchers from CSV / XLSX: every voucher is parked for approval, or nothing is saved (errors per row). */
  async upload(file) {
    const form = new FormData();
    form.append("file", file);
    return (await postRequest(`${BASE}/upload`, form)).data;
  },
};

export default journalVoucherService;
