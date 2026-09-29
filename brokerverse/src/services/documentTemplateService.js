import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Document Template Service
 * Handles quote template and policy schedule PDF generation (Motor & Fire LOB)
 */
class DocumentTemplateService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Get quote template PDF (Motor or Fire by LOB)
   * @param {string} quotationId - Quotation ID
   * @param {Object} options - { isFire: boolean, fileName?: string }
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async getQuoteTemplatePdf(quotationId, options = {}) {
    const { isFire = false, fileName = "quotation.pdf" } = options;
    if (!quotationId) {
      return { success: false, error: "Quotation ID is required" };
    }

    const path = isFire
      ? `/document-templates/quote-template-fire/${quotationId}`
      : `/document-templates/quote-template/${quotationId}`;

    return this._fetchPdfAndDownload(`${this.baseURL}${path}`, fileName);
  }

  /**
   * Get policy schedule PDF (Motor or Fire by LOB) and trigger download
   * @param {string} policyId - Policy ID
   * @param {Object} options - { isFire: boolean, fileName?: string }
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async getPolicySchedulePdf(policyId, options = {}) {
    const { isFire = false, fileName = "policy-schedule.pdf" } = options;
    if (!policyId) {
      return { success: false, error: "Policy ID is required" };
    }

    const path = isFire
      ? `/document-templates/policy-schedule-fire/${policyId}`
      : `/document-templates/policy-schedule/${policyId}`;

    return this._fetchPdfAndDownload(`${this.baseURL}${path}`, fileName);
  }

  /**
   * Fetch policy schedule PDF as blob (for preview or open in new tab)
   * @param {string} policyId - Policy ID
   * @param {Object} options - { isFire: boolean }
   * @returns {Promise<{ success: boolean, blob?: Blob, error?: string }>}
   */
  async fetchPolicyScheduleBlob(policyId, options = {}) {
    const { isFire = false } = options;
    if (!policyId) {
      return { success: false, error: "Policy ID is required" };
    }

    const path = isFire
      ? `/document-templates/policy-schedule-fire/${policyId}`
      : `/document-templates/policy-schedule/${policyId}`;

    return this._fetchPdfBlob(`${this.baseURL}${path}`);
  }

  /**
   * Download receipt PDF (full receipt or selected line items).
   * @param {string} receiptId - Receipt ID
   * @param {Object} options - { lineIds?: string[], fileName?: string }
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async getReceiptPdf(receiptId, options = {}) {
    const { lineIds = [], fileName } = options;
    if (!receiptId) {
      return { success: false, error: "Receipt ID is required" };
    }

    const params = new URLSearchParams();
    if (Array.isArray(lineIds) && lineIds.length > 0) {
      params.set("lineIds", lineIds.join(","));
    }

    const query = params.toString();
    const path = `/document-templates/receipt/${receiptId}${query ? `?${query}` : ""}`;
    const downloadName =
      fileName ||
      (lineIds.length > 0
        ? `receipt-${receiptId}-selected.pdf`
        : `receipt-${receiptId}.pdf`);

    return this._fetchPdfAndDownload(`${this.baseURL}${path}`, downloadName);
  }

  /**
   * Fetch PDF from URL and return blob (no download)
   * @private
   */
  async _fetchPdfBlob(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message =
          errorData.message ||
          errorData.error?.message ||
          (typeof errorData.error === "string" ? errorData.error : null);
        if (!message) {
          if (response.status === 400 && errorData.error?.code === "LOB_MISMATCH") {
            message = "Document type does not match this record's line of business.";
          } else if (response.status === 404) {
            message = "Document not found.";
          } else {
            message = `Request failed (${response.status})`;
          }
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      return { success: true, blob };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to load document",
      };
    }
  }

  /**
   * Fetch PDF from URL and trigger download
   * @private
   */
  async _fetchPdfAndDownload(url, fileName) {
    const result = await this._fetchPdfBlob(url);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const objectUrl = window.URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
    return { success: true };
  }
}

const documentTemplateService = new DocumentTemplateService();
export default documentTemplateService;
