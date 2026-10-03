import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/** Cash of a claim settled through the broker: funds received from the insurer, payment to the claimant. */
const call = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authService.getAuthHeader(),
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || `Request failed (${response.status})`);
  return json;
};

const base = (claimId) => `/claims/${encodeURIComponent(claimId)}/settlement-cash`;

const claimSettlementCashService = {
  getPosition: (claimId) => call(base(claimId)).then((r) => r.data),
  recordFundsReceived: (claimId, body) => call(`${base(claimId)}/funds-received`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.data),
  recordPaidToClaimant: (claimId, body) => call(`${base(claimId)}/paid-to-claimant`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.data),
};

export default claimSettlementCashService;
