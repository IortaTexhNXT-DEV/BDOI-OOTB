import { BASE_URL } from "../utility/constant";
import authService from "./authService";

class PolicyRenewalService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  async getRenewals({ clientId, policyId, status, page = 1, limit = 50 } = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (clientId) params.append("clientId", clientId);
      if (policyId) params.append("policyId", policyId);
      if (status) params.append("status", status);

      const response = await fetch(
        `${this.baseURL}/policy-renewals?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to fetch policy renewals (status ${response.status})`
        );
      }

      const data = await response.json();
      const payload = data?.data ?? data ?? {};

      const renewals = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.renewals)
        ? payload.renewals
        : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(data.renewals)
        ? data.renewals
        : Array.isArray(data.items)
        ? data.items
        : [];

      return {
        success: true,
        data: renewals,
        pagination:
          payload.pagination ||
          data.pagination || {
            page,
            limit,
            total: renewals.length,
            totalPages: 1,
          },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch renewals",
      };
    }
  }

  async request(method, path, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        return {
          success: false,
          error: data?.message || data?.error || `Request failed (status ${response.status})`,
        };
      }
      return { success: true, data: data?.data ?? data, message: data?.message || "" };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Request failed",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Renewal wizard prefill for a policy: the open renewal's saved wizard data, else the
   * expiring policy's quotation / policy data (coverageDetails, accessories, vehicle, client, insurer).
   */
  getRenewalPrefill(policyId) {
    return this.request("GET", `/policy-renewals/policies/${encodeURIComponent(policyId)}/prefill`);
  }

  /** Save wizard data on the policy's open renewal (created when there is none). */
  saveRenewalWizard(policyId, payload) {
    return this.request("POST", `/policy-renewals/policies/${encodeURIComponent(policyId)}/renewals`, payload);
  }

  /**
   * "Completed Quote": save the wizard data and create (or update) the renewal quotation linked to
   * the expiring policy. Returns { quotationId, quotationNumber, quotation, renewal }.
   */
  createRenewalQuotation(policyId, payload) {
    return this.request("POST", `/policy-renewals/policies/${encodeURIComponent(policyId)}/quotation`, payload);
  }
}

const policyRenewalService = new PolicyRenewalService();
export default policyRenewalService;
