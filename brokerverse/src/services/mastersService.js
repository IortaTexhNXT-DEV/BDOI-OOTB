import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Masters service: every master screen reads and writes its records through /masters/<type>.
 * Records use the screen's own field names; status is "Active" / "Inactive".
 */
const MASTERS_URL = `${BASE_URL}/masters`;
const LIST_PAGE_SIZE = 500;

const headers = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  ...authService.getAuthHeader(),
});

/** "Validation failed: Code is required, ..." from an API error body. */
export const apiErrorMessage = (json = {}, status) => {
  const message = json.message || `Request failed (${status})`;
  // A field message the summary already states (e.g. "Password must contain a digit") is not repeated after it
  const lower = message.toLowerCase();
  const details = (Array.isArray(json.errors) ? json.errors.map((e) => String(e.message || e)) : [])
    .filter((d) => {
      const text = d.toLowerCase();
      const tail = text.split(" ").slice(2).join(" ");
      return !lower.includes(text) && !(tail.length > 8 && lower.includes(tail));
    })
    .join(", ");
  return details ? `${message}: ${details}` : message;
};

const queryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.append(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
};

async function request(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    throw new Error(apiErrorMessage(json, response.status));
  }
  return json;
}

const typeUrl = (type, id) => `${MASTERS_URL}/${encodeURIComponent(type)}${id !== undefined ? `/${encodeURIComponent(id)}` : ""}`;

/** YYYY-MM-DD in local time for a Date picked in a calendar. */
export const toDateText = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Removes read-only bookkeeping fields and turns calendar Dates into YYYY-MM-DD before a record is sent. */
export const toPayload = (record = {}) => {
  const { id, createdAt, updatedAt, createdBy, updatedBy, isActive, ...fields } = record;
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value instanceof Date ? toDateText(value) : value])
  );
};

/** Search text from a screen's search payload ({ textSearch } or a plain string). */
export const searchText = (query) => String(query?.textSearch ?? query ?? "").trim();

/** Error text for rejectWithValue from a thrown error. */
export const errorMessage = (error) => error?.message || "Something went wrong";

const mastersService = {
  /** Records of a master type (all pages the screen needs); params: search, status, any field filter. */
  async list(type, params = {}) {
    const json = await request(`${typeUrl(type)}${queryString({ perPage: LIST_PAGE_SIZE, ...params })}`);
    return json.data || [];
  },
  async get(type, id) {
    return (await request(typeUrl(type, id))).data;
  },
  async create(type, record) {
    return (await request(typeUrl(type), { method: "POST", body: toPayload(record) })).data;
  },
  async update(type, id, record) {
    return (await request(typeUrl(type, id), { method: "PUT", body: toPayload(record) })).data;
  },
  /** Saves a record: update when it has an id, create otherwise. */
  async save(type, record) {
    return record?.id ? this.update(type, record.id, record) : this.create(type, record);
  },
  async setStatus(type, id, active) {
    const body = { status: active ? "Active" : "Inactive" };
    return (await request(`${typeUrl(type, id)}/status`, { method: "PATCH", body })).data;
  },
  async remove(type, id) {
    return (await request(typeUrl(type, id), { method: "DELETE" })).data;
  },
  /** Active records as dropdown options [{ id, code, label, value }]; params filter by field (e.g. { Country: "Philippines" }). */
  async options(type, params = {}) {
    return (await request(`${typeUrl(type)}/options${queryString(params)}`)).data || [];
  },
  async definition(type) {
    return (await request(`${typeUrl(type)}/definition`)).data;
  },
};

export default mastersService;

/** Agents (referrers) as dropdown options from GET /incentive/agents; the value is the agent name. */
export const agentOptions = async () => {
  const response = await fetch(`${BASE_URL}/incentive/agents`, { headers: headers() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) throw new Error(apiErrorMessage(json, response.status));
  return (json.data || []).map((agent) => ({ label: agent.name, value: agent.name, code: agent.code }));
};
