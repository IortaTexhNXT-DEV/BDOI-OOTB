import { getRequest, postRequest, putRequest } from "../utility/commonServices";

class CommissionService {
  static async getDashboard() {
    const response = await getRequest("commission/dashboard");
    return response.data;
  }

  static async getReferrerAccounts() {
    const response = await getRequest("commission/referrer-accounts");
    return response.data;
  }

  // payee enrolment (FGA EN-01, EN-02): the form lists, add, edit and the verification by a second user
  static async getReferrerOptions() {
    const response = await getRequest("commission/referrer-accounts/options");
    return response.data;
  }

  static async createReferrer(payload) {
    const response = await postRequest("commission/referrer-accounts", payload);
    return response.data;
  }

  static async updateReferrer(id, payload) {
    const response = await putRequest(`commission/referrer-accounts/${id}`, payload);
    return response.data;
  }

  static async verifyReferrer(id, payload = {}) {
    const response = await postRequest(`commission/referrer-accounts/${id}/verify`, payload);
    return response.data;
  }

  static async getReferrerAccount(id) {
    const response = await getRequest(`commission/referrer-accounts/${id}`);
    return response.data;
  }

  static async approveLines(id) {
    const response = await postRequest(
      `commission/referrer-accounts/${id}/approve`,
      {}
    );
    return response.data;
  }

  static async generatePayout(id) {
    const response = await postRequest(
      `commission/referrer-accounts/${id}/generate-payout`,
      {}
    );
    return response.data;
  }

  static async getApprovedLines(id) {
    const response = await getRequest(
      `commission/referrer-accounts/${id}/approved-lines`
    );
    return response.data;
  }

  static async getAgentsReadyToPay() {
    const response = await getRequest("commission/agents-ready-to-pay");
    return response.data;
  }

  static async payLines(id, payload) {
    const response = await postRequest(
      `commission/referrer-accounts/${id}/pay-lines`,
      payload
    );
    return response.data;
  }

  static async markEligible(id) {
    const response = await postRequest(
      `commission/referrer-accounts/${id}/mark-eligible`,
      {}
    );
    return response.data;
  }

  static async getLine(referrerId, lineId) {
    const response = await getRequest(
      `commission/referrer-accounts/${referrerId}/lines/${lineId}`
    );
    return response.data;
  }

  static async approveLine(referrerId, lineId) {
    const response = await postRequest(
      `commission/referrer-accounts/${referrerId}/lines/${lineId}/approve`,
      {}
    );
    return response.data;
  }

  static async reverseLine(referrerId, lineId, reason) {
    const response = await postRequest(
      `commission/referrer-accounts/${referrerId}/lines/${lineId}/reverse`,
      { reason }
    );
    return response.data;
  }

  static async setWhtApplicable(referrerId, whtApplicable, reason) {
    const response = await postRequest(
      `commission/referrer-accounts/${referrerId}/wht`,
      { whtApplicable, reason }
    );
    return response.data;
  }

  static async updateLineRate(referrerId, lineId, payload) {
    const response = await postRequest(
      `commission/referrer-accounts/${referrerId}/lines/${lineId}/rate`,
      payload
    );
    return response.data;
  }

  static async markLineEligible(referrerId, lineId) {
    const response = await postRequest(
      `commission/referrer-accounts/${referrerId}/lines/${lineId}/mark-eligible`,
      {}
    );
    return response.data;
  }

  static async payLine(referrerId, lineId) {
    const response = await postRequest(
      `commission/referrer-accounts/${referrerId}/lines/${lineId}/pay`,
      {}
    );
    return response.data;
  }

  // rate change, reversal and withholding tax requests on a line (approved by a second user)
  static async requestLineChange(referrerId, lineId, payload) {
    const response = await postRequest(`commission/referrer-accounts/${referrerId}/lines/${lineId}/requests`, payload);
    return response.data;
  }

  static async listRequests(params) {
    const response = await getRequest("commission/requests", params);
    return response.data;
  }

  static async decideRequest(requestId, action, payload = {}) {
    const response = await postRequest(`commission/requests/${requestId}/${action}`, payload);
    return response.data;
  }

  // the share of a line inside the limits of its sharing scheme
  static async changeShare(referrerId, lineId, payload) {
    const response = await postRequest(`commission/referrer-accounts/${referrerId}/lines/${lineId}/share`, payload);
    return response.data;
  }

  // the commission breakdown of a policy and its recompute
  static async policyBreakdown(policyId) {
    const response = await getRequest(`commission/policies/${policyId}/breakdown`);
    return response.data;
  }

  static async recomputePolicy(policyId) {
    const response = await postRequest(`commission/policies/${policyId}/recompute`, {});
    return response;
  }

  // sharing schemes
  static async listSchemes(params) {
    const response = await getRequest("commission/sharing-schemes", params);
    return response.data;
  }

  static async schemeOptions() {
    const response = await getRequest("commission/sharing-schemes/options");
    return response.data;
  }

  static async getScheme(ref) {
    const response = await getRequest(`commission/sharing-schemes/${encodeURIComponent(ref)}`);
    return response.data;
  }

  static async schemeAssignments(ref) {
    const response = await getRequest(`commission/sharing-schemes/${encodeURIComponent(ref)}/assignments`);
    return response.data;
  }

  static async schemeExample(payload) {
    const response = await postRequest("commission/sharing-schemes/example", payload);
    return response.data;
  }

  static async createScheme(payload) {
    const response = await postRequest("commission/sharing-schemes", payload);
    return response.data;
  }

  static async updateScheme(ref, payload) {
    const response = await putRequest(`commission/sharing-schemes/${encodeURIComponent(ref)}`, payload);
    return response.data;
  }

  static async schemeAction(ref, action, payload = {}) {
    const response = await postRequest(`commission/sharing-schemes/${encodeURIComponent(ref)}/${action}`, payload);
    return response.data;
  }

  static async listChannels(params) {
    const response = await getRequest("channels", params);
    return response.data;
  }

  static async assignScheme(payload) {
    const response = await postRequest("commission/sharing-schemes/assign", payload);
    return response.data;
  }
}

export default CommissionService;
