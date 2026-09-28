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
};

export default journalVoucherService;
