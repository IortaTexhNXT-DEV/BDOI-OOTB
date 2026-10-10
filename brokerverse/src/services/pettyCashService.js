import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/** Petty cash API: kinds are funds, requests, disbursements, receipts, replenishments. */
const PETTY_CASH_URL = `${BASE_URL}/petty-cash`;

const toQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.append(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
};

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${PETTY_CASH_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authService.getAuthHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    throw new Error(json.message || json.error?.message || `Request failed (${response.status})`);
  }
  return json;
}

const pettyCashService = {
  /** One page of records: { data, pagination }; params: search, pettyCashCode, status, page, pageSize. */
  list(kind, params = {}) {
    return request(`/${kind}${toQuery({ pageSize: 100, ...params })}`);
  },
  async get(kind, id) {
    return (await request(`/${kind}/${encodeURIComponent(id)}`)).data;
  },
  async create(kind, body) {
    return (await request(`/${kind}`, { method: "POST", body })).data;
  },
  async updateFund(id, body) {
    return (await request(`/funds/${encodeURIComponent(id)}`, { method: "PUT", body })).data;
  },
  async updateRequest(id, body) {
    return (await request(`/requests/${encodeURIComponent(id)}`, { method: "PUT", body })).data;
  },
  /** A fund waiting for approval: action approve (establishes it) | reject (needs a reason). */
  async decideFund(id, action, reason) {
    const body = action === "reject" ? { reason } : {};
    return (await request(`/funds/${encodeURIComponent(id)}/${action}`, { method: "POST", body })).data;
  },
  /** action: submit | approve | reject (reject needs a reason). */
  async transitionRequest(id, action, reason) {
    const body = action === "reject" ? { reason } : {};
    return (await request(`/requests/${encodeURIComponent(id)}/${action}`, { method: "POST", body })).data;
  },
};

export default pettyCashService;
