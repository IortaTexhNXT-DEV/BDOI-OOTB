import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/**
 * Claim handling beside the claim journey: the check before registering (outstanding premium, claims ratio, late
 * intimation, claims of the same date of loss), the cancellation of a claim registered in error, the insurer's advice,
 * the death verification, the communication log and the follow-up e-mail to the insurer, and the reversal of a
 * settlement cash movement recorded in error. Every call answers the data or throws an Error with the API message.
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};
const call = async (method, path, payload) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(apiErrorMessage(body, response.status));
    error.errors = Array.isArray(body.errors) ? body.errors : [];
    throw error;
  }
  return body.data;
};
const id = (v) => encodeURIComponent(v);

const claimHandlingService = {
  registrationCheck: (policyId, lossDate, reportedDate) => call("GET", `/claims/registration-check${qs({ policyId, lossDate, reportedDate })}`),
  cancel: (claimId, reason) => call("PUT", `/claims/cancel/${id(claimId)}`, reason),
  recordAdvice: (claimId, advice) => call("PUT", `/claims/${id(claimId)}/insurer-advice`, advice),
  verifyDeath: (claimId, verifiedOn, note) => call("POST", `/claims/${id(claimId)}/verify-death`, { verifiedOn, note }),
  communications: (claimId) => call("GET", `/claims/${id(claimId)}/communications`),
  addCommunication: (claimId, entry) => call("POST", `/claims/${id(claimId)}/communications`, entry),
  completeFollowUp: (claimId, commId) => call("POST", `/claims/${id(claimId)}/communications/${id(commId)}/done`),
  followUpInsurer: (claimId, payload) => call("POST", `/claims/${id(claimId)}/insurer-follow-up`, payload),
  reverseMovement: (claimId, movementId, reason) => call("POST", `/claim-payments/claims/${id(claimId)}/movements/${id(movementId)}/reverse`, reason),
};

export default claimHandlingService;
