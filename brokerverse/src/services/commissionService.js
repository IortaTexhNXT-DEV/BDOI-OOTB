import { getRequest, postRequest } from "../utility/commonServices";

class CommissionService {
  static async getDashboard() {
    const response = await getRequest("commission/dashboard");
    return response.data;
  }

  static async getReferrerAccounts() {
    const response = await getRequest("commission/referrer-accounts");
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
}

export default CommissionService;
