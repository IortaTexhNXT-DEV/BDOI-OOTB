import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/** Promotions (/promotions) and discount caps (/discount-caps) API (PROD-15). */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};
const call = async (method, path, payload) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method, headers: { "Content-Type": "application/json", ...authService.getAuthHeader() }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(apiErrorMessage(body, response.status));
    error.errors = Array.isArray(body.errors) ? body.errors : [];
    throw error;
  }
  return body;
};

const promotionService = {
  list: async (params) => (await call("GET", `/promotions${qs(params)}`)).data,
  get: async (id) => (await call("GET", `/promotions/${encodeURIComponent(id)}`)).data,
  create: (body) => call("POST", "/promotions", body),
  update: (id, body) => call("PUT", `/promotions/${encodeURIComponent(id)}`, body),
  remove: (id) => call("DELETE", `/promotions/${encodeURIComponent(id)}`),
  /** submit | recall | approve | return | suspend | resume | withdraw | amend */
  act: (id, action, body = {}) => call("POST", `/promotions/${encodeURIComponent(id)}/${action}`, body),
  choices: async () => (await call("GET", "/promotions/choices")).data,
  open: async (body) => (await call("POST", "/promotions/open", body)).data,
  caps: async (params) => (await call("GET", `/discount-caps${qs(params)}`)).data,
  proposeCap: (body) => call("POST", "/discount-caps", body),
  /** approve | return | withdraw */
  capAct: (id, action, body = {}) => call("POST", `/discount-caps/${encodeURIComponent(id)}/${action}`, body),
};

export default promotionService;
