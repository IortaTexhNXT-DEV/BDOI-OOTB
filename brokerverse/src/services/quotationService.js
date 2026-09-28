import { BASE_URL } from "../utility/constant";
import authService from "./authService";

class QuotationService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Create a new quotation
   * @param {Object} quotationData - The quotation data to create
   * @returns {Promise<Object>} - The created quotation data
   */
  async createQuotation(quotationData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log("Creating quotation with data:", quotationData);
      console.log("Auth header:", authService.getAuthHeader());

      const response = await fetch(`${this.baseURL}/quotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(quotationData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create quotation");
      }

      const data = await response.json();
      console.log("Quotation created successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Create quotation error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to create quotation",
      };
    }
  }

  /**
   * Get all quotations with pagination and optional filtering
   * @param {number} page - Page number
   * @param {number} pageSize - Number of items per page
   * @param {string} leadRefId - Optional lead reference ID to filter quotations
   * @param {string} search - Optional search term
   * @param {string} lob - Optional LOB filter (e.g. "FIRE")
   * @returns {Promise<Object>} - The quotations data
   */
  async getAllQuotations(
    page = 1,
    pageSize = 10,
    leadRefId = null,
    search = null,
    lob = null
  ) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Build query parameters
      let queryParams = `page=${page}&pageSize=${pageSize}`;
      if (leadRefId) {
        queryParams += `&leadRefId=${leadRefId}`;
      }
      if (search) {
        queryParams += `&search=${search}`;
      }
      if (lob) {
        queryParams += `&lob=${lob}`;
      }

      const response = await fetch(
        `${this.baseURL}/quotations?${queryParams}`,
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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch quotations");
      }

      const data = await response.json();
      console.log("Quotations fetched successfully:", data);

      return {
        success: true,
        data: data.data || [],
        page: data.page || page,
        pageSize: data.pageSize || pageSize,
        total: data.total || 0,
      };
    } catch (error) {
      console.error("Get quotations error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch quotations",
      };
    }
  }

  /**
   * Get quotation by ID
   * @param {string} quotationId - The quotation ID
   * @returns {Promise<Object>} - The quotation data
   */
  async getQuotationById(quotationId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log("Fetching quotation by ID:", quotationId);

      const response = await fetch(
        `${this.baseURL}/quotations/${quotationId}`,
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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch quotation");
      }

      const data = await response.json();
      console.log("Quotation fetched successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Get quotation by ID error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch quotation",
      };
    }
  }

  /**
   * Update quotation
   * @param {string} quotationId - The quotation ID
   * @param {Object} quotationData - The updated quotation data
   * @returns {Promise<Object>} - The updated quotation data
   */
  async updateQuotation(quotationId, quotationData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log(
        "Updating quotation:",
        quotationId,
        "with data:",
        quotationData
      );

      const response = await fetch(
        `${this.baseURL}/quotations/${quotationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify(quotationData),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update quotation");
      }

      const data = await response.json();
      console.log("Quotation updated successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Update quotation error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to update quotation",
      };
    }
  }

  /**
   * Delete quotation
   * @param {string} quotationId - The quotation ID
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteQuotation(quotationId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log("Deleting quotation:", quotationId);

      const response = await fetch(
        `${this.baseURL}/quotations/${quotationId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete quotation");
      }

      const data = await response.json();
      console.log("Quotation deleted successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Delete quotation error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to delete quotation",
      };
    }
  }

  /**
   * Bulk upload quotations from Excel file
   * @param {File} file - Excel file to upload
   * @returns {Promise<Object>} API response with upload results
   */
  async bulkUploadQuotations(file) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for file upload

      console.log("Uploading quotations file:", file.name);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${this.baseURL}/quotations/bulk-upload`, {
        method: "POST",
        headers: {
          ...authService.getAuthHeader(),
          // Note: Don't set Content-Type for FormData, browser will set it with boundary
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to upload quotations file"
        );
      }

      const data = await response.json();
      console.log("Quotations bulk upload completed:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Bulk upload quotations error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Upload timeout. Please try again."
            : error.message || "Failed to upload quotations file",
      };
    }
  }

  /**
   * Validate quotation for policy conversion
   * @param {string} quotationId - Quotation ID
   * @returns {Promise<Object>} Validation result with valid flag and error message
   */
  async validateQuotationForConversion(quotationId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      console.log("Validating quotation for conversion:", quotationId);

      // Fetch quotation details
      const result = await this.getQuotationById(quotationId);

      clearTimeout(timeoutId);

      if (!result.success) {
        return {
          valid: false,
          error: result.error || "Failed to fetch quotation details",
        };
      }

      const quotation = result.data;

      // Check if quotation exists
      if (!quotation?.quotationId) {
        return {
          valid: false,
          error: `Quotation not found with ID: ${quotationId}. Please ensure the quotation exists in the system.`,
        };
      }

      // Check if quotation status is Approved
      if (quotation.quotationStatus !== "Approved") {
        return {
          valid: false,
          error: `Cannot convert quotation with status "${quotation.quotationStatus}". Quote must be marked as "Approved" to convert to policy.`,
        };
      }

      return {
        valid: true,
        quotation: quotation,
      };
    } catch (error) {
      console.error("Validate quotation for conversion error:", error);
      return {
        valid: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to validate quotation",
      };
    }
  }

  /**
   * Convert quotation to policy
   * @param {string} quotationId - Quotation ID
   * @param {Object} additionalPolicyData - Additional policy data (customer info, vehicle photos, etc.)
   * @param {string} createdBy - Username
   * @param {string} lob - LOB type (e.g. "FIRE" for Fire and Allied Perils - uses different body format)
   * @returns {Promise<Object>} Result with created policy
   */
  async convertQuotationToPolicy(
    quotationId,
    additionalPolicyData = {},
    createdBy = "agent",
    lob = null
  ) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Longer timeout for conversion

      console.log("Converting quotation to policy:", quotationId);

      // Fire LOB API expects: insuredName, paymentStatus, inception, expiry
      const body =
        lob === "FIRE"
          ? {
              insuredName:
                additionalPolicyData?.insuredName ||
                additionalPolicyData?.clientName ||
                "N/A",
              paymentStatus:
                additionalPolicyData?.paymentStatus || "Pending",
              inception: additionalPolicyData?.inception || new Date().toISOString().split("T")[0],
              expiry:
                additionalPolicyData?.expiry ||
                new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
              ...additionalPolicyData,
            }
          : { additionalPolicyData, createdBy };

      const response = await fetch(
        `${this.baseURL}/quotations/${quotationId}/convert-to-policy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to convert quotation to policy"
        );
      }

      const data = await response.json();
      console.log("Quotation converted to policy successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Convert quotation to policy error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to convert quotation to policy",
      };
    }
  }

  /**
   * Create Fire and Allied Perils quotation
   * @param {Object} quotationData - { leadRefId, fireRiskDetails, firePremiumDetails }
   * @returns {Promise<Object>} Created quotation
   */
  async createFireQuotation(quotationData) {
    return this.createQuotation({
      ...quotationData,
      productType: quotationData.productType || "Fire and Allied Perils",
    });
  }

  /**
   * Create Industrial All Risks quotation
   */
  async createIarQuotation(quotationData) {
    return this.createQuotation({
      ...quotationData,
      productType: quotationData.productType || "Industrial All Risks",
      insurancePolicyType:
        quotationData.insurancePolicyType || "2009",
    });
  }

  /**
   * Update Industrial All Risks quotation (Schedule of Cover / commercial fields)
   */
  async updateIarQuotation(quotationId, quotationData) {
    return this.updateQuotation(quotationId, {
      ...quotationData,
      productType: quotationData.productType || "Industrial All Risks",
      insurancePolicyType:
        quotationData.insurancePolicyType || "2009",
    });
  }

  /**
   * Send Fire quotation for customer approval (email)
   * @param {string} quotationId - Quotation ID
   * @returns {Promise<Object>} Result
   */
  async sendQuotationForApproval(quotationId) {
    try {
      const controller = new AbortController();
      // Longer timeout: send-for-approval may trigger email/notifications
      const timeoutId = setTimeout(
        () => controller.abort(new DOMException("Request timeout", "AbortError")),
        30000
      );

      const response = await fetch(
        `${this.baseURL}/quotations/${quotationId}/send-for-approval`,
        {
          method: "POST",
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
          errorData.message || errorData.error || "Failed to send quotation for approval"
        );
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error("Send for approval error:", error);
      const isAbort = error.name === "AbortError";
      return {
        success: false,
        error: isAbort
          ? "Request timed out. Please try again."
          : error.message || "Failed to send quotation for approval",
      };
    }
  }

  /**
   * Update quotation status
   * @param {string} quotationId - Quotation ID
   * @param {string} status - New status
   * @param {string} updatedBy - User updating the status
   * @returns {Promise<Object>} Result
   */
  async updateQuotationStatus(quotationId, status, updatedBy = "agent") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log(`Updating quotation status: ${quotationId} to ${status}`);

      const response = await fetch(
        `${this.baseURL}/quotations/${quotationId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({ status, updatedBy }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            "Failed to update quotation status"
        );
      }

      const data = await response.json();
      console.log("Quotation status updated successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Update quotation status error:", error);
      return {
        success: false,
        error: error.message || "Failed to update quotation status",
      };
    }
  }

  /**
   * Get quotations by status
   * @param {string} status - Status to filter by
   * @param {Object} filters - Additional filters
   * @returns {Promise<Object>} Result with quotations
   */
  async getQuotationsByStatus(status, filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const queryParams = new URLSearchParams({
        page: filters.page || 1,
        pageSize: filters.pageSize || 10,
        ...(filters.leadRefId && { leadRefId: filters.leadRefId }),
        ...(filters.productType && { productType: filters.productType }),
      });

      console.log("Fetching quotations by status:", status);

      const response = await fetch(
        `${this.baseURL}/quotations/by-status/${status}?${queryParams}`,
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
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to fetch quotations by status"
        );
      }

      const data = await response.json();
      console.log("Quotations by status fetched:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Get quotations by status error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch quotations by status",
      };
    }
  }

  /**
   * Update quotation vehicle information and photos
   * @param {string} quotationId - Quotation ID
   * @param {Object} vehicleInfo - Vehicle information object
   * @param {string} updatedBy - User updating
   * @returns {Promise<Object>} Result
   */
  async updateQuotationVehicleInfo(
    quotationId,
    vehicleInfo,
    updatedBy = "agent"
  ) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      console.log("Updating quotation vehicle info:", quotationId, vehicleInfo);

      const response = await fetch(
        `${this.baseURL}/quotations/${quotationId}/vehicle-info`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({ ...vehicleInfo, updatedBy }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Failed to update quotation vehicle information"
        );
      }

      const data = await response.json();
      console.log("Quotation vehicle info updated successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Update quotation vehicle info error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to update quotation vehicle information",
      };
    }
  }

  /**
   * Email policy quote to customer and insurance company
   * @param {string} quotationId - Quotation ID
   * @returns {Promise<Object>} Result
   */
  async emailPolicyQuoteToCustomer(quotationId, policyId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      console.log("Emailing policy quote to customer:", quotationId);

      const response = await fetch(
        `${this.baseURL}/quotations/${quotationId}/send-mail-policy-quote/customer?policyId=${policyId}`,
        {
          method: "POST",
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
          errorData.message || "Failed to send policy quote email"
        );
      }

      const data = await response.json();
      console.log("Policy quote email sent successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Email policy quote error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to send policy quote email",
      };
    }
  }

  /**
   * Compare two quotations with AI-powered insights
   * @param {string} quotationId1 - First quotation ID
   * @param {string} quotationId2 - Second quotation ID
   * @returns {Promise<Object>} Result with both quotations and AI insights
   */
  async compareQuotations(quotationId1, quotationId2) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // Longer timeout for AI generation

      console.log("Comparing quotations:", quotationId1, quotationId2);

      const response = await fetch(
        `${this.baseURL}/quotations/compare?quotationId1=${quotationId1}&quotationId2=${quotationId2}`,
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
          errorData.error || errorData.message || "Failed to compare quotations"
        );
      }

      const result = await response.json();
      console.log("Quotations compared successfully:", result);

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error("Compare quotations error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. AI comparison is taking longer than expected."
            : error.message || "Failed to compare quotations",
      };
    }
  }

  /**
   * Get quotation statistics
   * @param {Object} filters - Filter options (productType, quotationStatus, leadRefId)
   * @returns {Promise<Object>} API response with statistics
   */
  async getQuotationStats(leadRefId = null) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const queryParams = new URLSearchParams();
      if (leadRefId) queryParams.append("leadRefId", leadRefId);

      const url = `${this.baseURL}/quotations/stats${
        queryParams.toString() ? `?${queryParams.toString()}` : ""
      }`;

      console.log("Fetching quotation stats from:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to fetch quotation statistics"
        );
      }

      const data = await response.json();
      console.log("Quotation stats fetched successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Get quotation stats error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch quotation statistics",
        data: {
          totalQuotations: 0,
          recentQuotations: 0,
          quotationsByStatus: [],
          quotationsByProductType: [],
        },
      };
    }
  }

  /**
   * Get audit trail for a quotation
   * @param {string} quotationId - The quotation ID
   * @param {string} sortOrder - Sort order (asc/desc, default: desc)
   * @returns {Promise<Object>} - The audit trail data
   */
  async getQuotationAuditTrail(quotationId, sortOrder = "desc") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log("=== GET QUOTATION AUDIT TRAIL ===");
      console.log("Quotation ID:", quotationId);
      console.log("Sort Order:", sortOrder);
      console.log("=== END GET QUOTATION AUDIT TRAIL ===");

      const response = await fetch(
        `${this.baseURL}/quotations/audit-trail/${quotationId}?sort=${sortOrder}`,
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
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to get quotation audit trail"
        );
      }

      const data = await response.json();
      console.log("Quotation audit trail fetched successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Get quotation audit trail error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to get quotation audit trail",
      };
    }
  }
}

const quotationService = new QuotationService();
export default quotationService;
