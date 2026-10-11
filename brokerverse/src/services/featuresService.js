import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";
import { setFeatureState } from "../features/entitlements";

/**
 * Features and releases API: the state of this environment (/features/state, every signed-in user), the read-only
 * catalogue (/features/catalogue) and the platform administrator's screen (/platform: preview, change requests with
 * maker-checker, promotion between environments, platform administrators).
 */
const request = async (method, path, body) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...authService.getAuthHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    const error = new Error(apiErrorMessage(json, response.status));
    error.status = response.status;
    error.code = json.code;
    throw error;
  }
  return json;
};

/** Download a file and save it under the name the server gives. */
const download = async (path, fallbackName) => {
  const response = await fetch(`${BASE_URL}${path}`, { headers: authService.getAuthHeader() });
  if (!response.ok) throw new Error(apiErrorMessage(await response.json().catch(() => ({})), response.status));
  const name = (response.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

const featuresService = {
  /** Fetch the state of this environment and hand it to the menu, the route guard and the sections. */
  refreshState: async () => {
    const r = await request("GET", "/features/state");
    setFeatureState(r.data || []);
    return r.data || [];
  },
  catalogue: () => request("GET", "/features/catalogue").then((r) => r.data),
  exportCatalogue: () => download("/features/catalogue/export", "features-and-releases.xlsx"),
  platformFeatures: () => request("GET", "/platform/features").then((r) => r.data),
  preview: (body) => request("POST", "/platform/features/preview", body).then((r) => r.data),
  changes: (status) => request("GET", `/platform/features/changes${status ? `?status=${encodeURIComponent(status)}` : ""}`).then((r) => r.data),
  requestChange: (body) => request("POST", "/platform/features/changes", body),
  decide: (id, body) => request("POST", `/platform/features/changes/${encodeURIComponent(id)}/decision`, body),
  withdraw: (id) => request("POST", `/platform/features/changes/${encodeURIComponent(id)}/withdraw`, {}),
  exportState: () => download("/platform/features/export", "features.json"),
  promote: (body) => request("POST", "/platform/features/promote", body),
  admins: () => request("GET", "/platform/admins").then((r) => r.data),
  addAdmin: (body) => request("POST", "/platform/admins", body),
};

export default featuresService;
