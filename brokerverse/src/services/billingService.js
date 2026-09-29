import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Billing Service
 * Handles billing statement and invoice generation API calls
 */
class BillingService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Generate billing statement for policy
   * @param {string} policyId - Policy ID
   * @returns {Promise<Object>} API response with billing statement
   */
  async generatePolicyBillingStatement(policyId) {
    if (!policyId) {
      return {
        success: false,
        error: "Policy ID is required",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      console.log(`Generating billing statement for policy: ${policyId}`);

      const response = await fetch(
        `${this.baseURL}/billing-statement/policy/${policyId}/generate`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
            Cookie: "i18next=id",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      // Handle file download response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = `policy-billing-statement-${policyId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return {
        success: true,
        data: {
          blob: blob,
          url: url,
          fileName: `policy-billing-statement-${policyId}.pdf`,
        },
      };
    } catch (error) {
      console.error("Generate policy billing statement error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to generate policy billing statement",
      };
    }
  }

  /**
   * Preview endorsement billing statement (returns JSON/data)
   * @param {string} endorsementId - Endorsement ID
   * @returns {Promise<Object>} API response with preview data
   */
  async previewEndorsementBillingStatement(endorsementId) {
    if (!endorsementId) {
      return {
        success: false,
        error: "Endorsement ID is required",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `${this.baseURL}/billing-statement/endorsement/${endorsementId}/preview`,
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
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Preview endorsement billing error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to preview endorsement billing",
      };
    }
  }

  /**
   * Generate billing statement for endorsement (PDF download)
   * Supports both policyId (legacy) and endorsementId for Fire/endorsement-specific billing
   * @param {string} policyIdOrEndorsementId - Policy ID or Endorsement ID
   * @param {Object} options - { useEndorsementId: boolean } to use endorsement ID
   * @returns {Promise<Object>} API response with billing statement
   */
  async generateEndorsementBillingStatement(
    policyIdOrEndorsementId,
    options = {}
  ) {
    if (!policyIdOrEndorsementId) {
      return {
        success: false,
        error: "Policy ID or Endorsement ID is required",
      };
    }

    const useEndorsementId = options.useEndorsementId === true;
    const id = policyIdOrEndorsementId;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      console.log(
        `Generating endorsement billing statement for ${useEndorsementId ? "endorsement" : "policy"}: ${id}`
      );

      const response = await fetch(
        `${this.baseURL}/billing-statement/endorsement/${id}/generate`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
            Cookie: "i18next=id",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      // Handle file download response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = `endorsement-billing-statement-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return {
        success: true,
        data: {
          blob: blob,
          url: url,
          fileName: `endorsement-billing-statement-${id}.pdf`,
        },
      };
    } catch (error) {
      console.error("Generate endorsement billing statement error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message ||
              "Failed to generate endorsement billing statement",
      };
    }
  }

  /**
   * Generate billing statement for renewal
   * @param {string} policyId - Policy ID
   * @returns {Promise<Object>} API response with billing statement
   */
  async generateRenewalBillingStatement(policyId) {
    if (!policyId) {
      return {
        success: false,
        error: "Policy ID is required",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      console.log(
        `Generating renewal billing statement for policy: ${policyId}`
      );

      const response = await fetch(
        `${this.baseURL}/billing-statement/renewal/${policyId}/generate`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
            Cookie: "i18next=id",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      // Handle file download response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = `renewal-billing-statement-${policyId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return {
        success: true,
        data: {
          blob: blob,
          url: url,
          fileName: `renewal-billing-statement-${policyId}.pdf`,
        },
      };
    } catch (error) {
      console.error("Generate renewal billing statement error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to generate renewal billing statement",
      };
    }
  }
}

// Create and export a singleton instance
const billingService = new BillingService();
export default billingService;
