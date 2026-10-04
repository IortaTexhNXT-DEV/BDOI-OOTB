import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const toQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.append(key, value);
  });
  return query.toString();
};

async function request(path, { method = "GET", params, body } = {}) {
  const query = toQuery(params);
  const response = await fetch(`${BASE_URL}${path}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authService.getAuthHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    throw new Error(json.message || `Request failed (${response.status})`);
  }
  return json;
}

const getJson = (path, params) => request(path, { params });

/** Agent > Payments and Open Items. */
const paymentsService = {
  /** Premium bills by status (PAID, PENDING, REVIEWING); resolves to { data, pagination, summary }. */
  getPayments(params = {}) {
    return getJson("/payments", { pageSize: 100, ...params });
  },
  async getPayment(id) {
    return (await getJson(`/payments/${encodeURIComponent(id)}`)).data;
  },
  /** { summary: [{ type, status, count }], items: [...] }; params: type, search. */
  async getOpenItems(params = {}) {
    return (await getJson("/open-items", params)).data;
  },
  async getEvents(params = {}) {
    return (await getJson("/open-items/events", params)).data || [];
  },
  /** { date, notes, startTime, endTime } */
  async addEvent(event) {
    return (await request("/open-items/events", { method: "POST", body: event })).data;
  },
};

export default paymentsService;
