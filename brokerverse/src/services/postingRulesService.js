import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Posting Rules and Account Determination (Master > Finance). Every call throws the server message on failure.
 */
async function request(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const details = (data.errors || []).map((e) => e.message).filter(Boolean).join("; ");
    throw new Error(`${data.message || `Request failed (${response.status})`}${details ? `: ${details}` : ""}`);
  }
  return data.data;
}

const postingRulesService = {
  events: () => request("GET", "/posting-rules/events"),
  meta: () => request("GET", "/posting-rules/meta"),
  rules: (eventCode) => request("GET", `/posting-rules?eventCode=${encodeURIComponent(eventCode)}`),
  history: (ruleId) => request("GET", `/posting-rules/${ruleId}/history`),
  simulate: (body) => request("POST", "/posting-rules/simulate", body),
  saveVersion: (eventCode, body) => request("POST", `/posting-rules/events/${encodeURIComponent(eventCode)}/versions`, body),
  setActive: (ruleId, active) => request("PUT", `/posting-rules/${ruleId}/status`, { active }),
  accountDetermination: () => request("GET", "/account-determination"),
  setRole: (role, glCode) => request("PUT", `/account-determination/roles/${encodeURIComponent(role)}`, { glCode }),
  setMap: (name, map) => request("PUT", `/account-determination/maps/${encodeURIComponent(name)}`, { map }),
  addWriteOffReason: (reason) => request("POST", "/account-determination/write-off-reasons", reason),
  updateWriteOffReason: (code, reason) => request("PUT", `/account-determination/write-off-reasons/${encodeURIComponent(code)}`, reason),
  commissionTaxes: () => request("GET", "/account-determination/commission-taxes"),
  setCommissionTaxes: (body) => request("PUT", "/account-determination/commission-taxes", body),
  writeOffReasons: () => request("GET", "/accounting/write-off-reasons"),
  glAccounts: () => request("GET", "/accounting/accounts?status=active"),
};

export default postingRulesService;
