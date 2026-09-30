import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Message of an API error body: the message plus the reason given for each field or acceptance problem
 * ("Validation failed: Reported date ... cannot be before the date of loss").
 */
export const apiErrorText = (body, fallback) => {
  const reasons = [body?.errors, body?.details]
    .filter(Array.isArray)
    .flat()
    .map((d) => (typeof d === "string" ? d : d?.message))
    .filter(Boolean);
  const message = body?.message || fallback;
  return reasons.length ? `${message}: ${reasons.join("; ")}` : message;
};
const readError = (response) => response.json().catch(() => ({}));

class ClaimsService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Get claim details by ID
   * @param {string} claimId - Claim ID
   * @returns {Promise<Object>} API response
   */
  async getClaimDetails(claimId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/claims/${claimId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(apiErrorText(await readError(response), "Failed to fetch claim details"));
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch claim details",
      };
    }
  }

  async getClaims(filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const params = new URLSearchParams();

      if (filters.clientId) params.append("clientId", filters.clientId);
      if (filters.policyId) params.append("policyId", filters.policyId);
      if (filters.status) params.append("status", filters.status);
      if (filters.page) params.append("page", filters.page.toString());
      if (filters.limit) params.append("limit", filters.limit.toString());

      const response = await fetch(
        `${this.baseURL}/claims?${params.toString()}`,
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
            `Failed to fetch claims (status ${response.status})`
        );
      }

      const data = await response.json();
      const payload = data?.data ?? data ?? {};

      const items = Array.isArray(payload.claims)
        ? payload.claims
        : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(data.claims)
        ? data.claims
        : Array.isArray(data.items)
        ? data.items
        : [];

      const pagination = payload.pagination || data.pagination || null;

      return {
        success: true,
        data: items,
        pagination,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch claims",
      };
    }
  }

  /**
   * Reject claim
   * @param {string} claimId - The claim ID to reject
   * @returns {Promise<Object>} API response
   */
  /**
   * Checker decision on a settlement in "Pending Approval" (the approver must differ from the requester)
   * @param {string} claimId - Claim ID or number
   * @param {{decision: "approve"|"return", approvedAmount?: number, note?: string}} payload
   * @returns {Promise<Object>} { success, data } or { success: false, error }
   */
  async approveSettlement(claimId, payload) {
    try {
      const response = await fetch(`${this.baseURL}/claims/approve-settlement/${claimId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorText(data, "Failed to record the settlement decision"));
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Claim masters for the claim screens (status labels, settlement types, causes of loss, sections per line)
   * @returns {Promise<Object>} { success, data } or { success: false, error }
   */
  async getConfig() {
    try {
      const response = await fetch(`${this.baseURL}/claims/config`, {
        headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorText(data, "Failed to load the claim settings"));
      return { success: true, data: data.data || {} };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Close a settled or rejected claim
   * @param {string} claimId - Claim ID or number
   * @param {string} [note] - Closing note
   * @returns {Promise<Object>} { success, data } or { success: false, error }
   */
  async closeClaim(claimId, note) {
    try {
      const response = await fetch(`${this.baseURL}/claims/close/${claimId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
        body: JSON.stringify(note ? { note } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorText(data, "Failed to close the claim"));
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async rejectClaim(claimId, reason) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.baseURL}/claims/rejectclaim/${claimId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify(reason ? { reason } : {}),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(apiErrorText(await readError(response), "Failed to reject claim"));
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to reject claim",
      };
    }
  }

  /**
   * Settle claim
   * @param {string} claimId - The claim ID to settle
   * @param {Object} settlementData - Settlement data including type, amount, dates, and document
   * @returns {Promise<Object>} API response
   */
  async settleClaim(claimId, settlementData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Create FormData for multipart/form-data request
      const formData = new FormData();
      formData.append("settlementType", settlementData.settlementType);
      formData.append("settlementAmount", settlementData.settlementAmount);
      formData.append(
        "settlementIssueDate",
        settlementData.settlementIssueDate
      );
      formData.append("settlementDate", settlementData.settlementDate);

      // Add document if provided
      if (settlementData.settlementDocument) {
        formData.append(
          "settlementDocument",
          settlementData.settlementDocument
        );
      }

      const response = await fetch(`${this.baseURL}/claims/settle/${claimId}`, {
        method: "PUT",
        headers: {
          ...authService.getAuthHeader(),
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(apiErrorText(await readError(response), "Failed to settle claim"));
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to settle claim",
      };
    }
  }

  /**
   * Update claim with adjuster data
   * @param {string} claimId - The claim ID to update
   * @param {Object} adjusterData - Adjuster data including form fields and file
   * @returns {Promise<Object>} API response
   */
  async updateClaim(claimId, adjusterData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Create FormData for multipart/form-data request
      const formData = new FormData();

      // Add all the form fields
      if (adjusterData.insuranceCompanyClaimNumber) {
        formData.append(
          "insuranceCompanyClaimNumber",
          adjusterData.insuranceCompanyClaimNumber
        );
      }
      if (adjusterData.reportedDate) {
        formData.append("reportedDate", adjusterData.reportedDate);
      }
      if (adjusterData.dateOfIncident) {
        formData.append("dateOfIncident", adjusterData.dateOfIncident);
      }
      if (adjusterData.addressOfIncident) {
        formData.append("addressOfIncident", adjusterData.addressOfIncident);
      }
      if (adjusterData.driverName) {
        formData.append("driverName", adjusterData.driverName);
      }
      if (adjusterData.driverDetails) {
        formData.append(
          "driverDetails",
          JSON.stringify(adjusterData.driverDetails)
        );
      }
      if (adjusterData.adjusterName) {
        formData.append("adjusterName", adjusterData.adjusterName);
      }
      if (adjusterData.adjusterStatus) {
        formData.append("adjusterStatus", adjusterData.adjusterStatus);
      }

      // Add third party details
      if (adjusterData.thirdPartyName) {
        formData.append(
          "thirdPartyDetails[thirdPartyName]",
          adjusterData.thirdPartyName
        );
      }
      if (adjusterData.thirdPartyContactNumber) {
        formData.append(
          "thirdPartyDetails[thirdPartyContactNumber]",
          adjusterData.thirdPartyContactNumber
        );
      }
      [
        ["thirdPartyPlateNumber", adjusterData.thirdPartyPlateNumber],
        ["thirdPartyUnit", adjusterData.thirdPartyUnit],
        ["thirdPartyShop", adjusterData.thirdPartyShop],
        ["thirdPartyInsuranceCompanyName", adjusterData.thirdPartyInsuranceCompanyName],
      ].forEach(([key, value]) => {
        if (value) formData.append(`thirdPartyDetails[${key}]`, value);
      });

      // Add file if provided
      if (adjusterData.file) {
        formData.append("file", adjusterData.file);
      }

      const response = await fetch(`${this.baseURL}/claims/${claimId}`, {
        method: "PUT",
        headers: {
          ...authService.getAuthHeader(),
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(apiErrorText(await readError(response), "Failed to update claim"));
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to update claim",
      };
    }
  }

  /**
   * Update claim status
   * @param {string} claimId - The claim ID to update
   * @param {string} claimStatus - The new status for the claim
   * @returns {Promise<Object>} API response
   */
  async updateClaimStatus(claimId, claimStatus) {
    try {
      const response = await fetch(
        `${this.baseURL}/claims/updatestatus/${claimId}`,
        {
          method: "PUT",
          headers: {
            ...authService.getAuthHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            claimStatus: claimStatus,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(apiErrorText(await readError(response), "Failed to update claim status"));
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to update claim status",
      };
    }
  }

  /**
   * Create a new claim
   * @param {Object} claimData - Claim data including policy info, driver details, third party details, email data, and document
   * @returns {Promise<Object>} API response with claim data
   */
  async createClaim(claimData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for file upload

      // Create FormData for multipart/form-data request
      const formData = new FormData();

      // Add all the form fields
      formData.append(
        "isPolicyHolderTheDriver",
        claimData.isPolicyHolderTheDriver || "false"
      );
      formData.append("policyNumber", claimData.policyNumber || "");
      formData.append("createdBy", claimData.createdBy || "");
      formData.append("lob", claimData.lob || "MOTOR");
      formData.append(
        "reportedDate",
        claimData.reportedDate || new Date().toISOString()
      );
      // Incident and claim metadata (API spec)
      if (claimData.claimStatus)
        formData.append("claimStatus", claimData.claimStatus);
      if (claimData.claimType)
        formData.append("claimType", claimData.claimType);
      if (claimData.claimPriority)
        formData.append("claimPriority", claimData.claimPriority);
      if (claimData.dateOfIncident) {
        const d = claimData.dateOfIncident;
        // send the calendar date the user picked (local), not a time-zone shifted timestamp
        const iso = d instanceof Date
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          : String(d);
        formData.append("dateOfIncident", iso);
      }
      if (claimData.timeOfIncident)
        formData.append("timeOfIncident", claimData.timeOfIncident);
      if (claimData.addressOfIncident)
        formData.append("addressOfIncident", claimData.addressOfIncident);
      if (claimData.cityOfIncident)
        formData.append("cityOfIncident", claimData.cityOfIncident);
      if (claimData.provinceOfIncident)
        formData.append("provinceOfIncident", claimData.provinceOfIncident);
      if (claimData.typeOfIncident)
        formData.append("typeOfIncident", claimData.typeOfIncident);
      if (
        claimData.estimatedClaimAmount != null &&
        claimData.estimatedClaimAmount !== ""
      )
        formData.append(
          "estimatedClaimAmount",
          String(claimData.estimatedClaimAmount)
        );
      if (claimData.insuranceCompanyClaimNumber)
        formData.append(
          "insuranceCompanyClaimNumber",
          claimData.insuranceCompanyClaimNumber
        );
      // Add required reference IDs
      formData.append("leadRefId", claimData.leadRefId || "LEAD-001");
      formData.append("quoteRefId", claimData.quoteRefId || "QUOTE-001");
      formData.append("policyRefId", claimData.policyRefId || "POLICY-001");

      // Add JSON strings for complex objects
      if (claimData.policyInfo) {
        formData.append("policyInfo", JSON.stringify(claimData.policyInfo));
      }

      if (claimData.driverDetails) {
        formData.append(
          "driverDetails",
          JSON.stringify(claimData.driverDetails)
        );
      }

      if (claimData.thirdPartyDetails) {
        formData.append(
          "thirdPartyDetails",
          JSON.stringify(claimData.thirdPartyDetails)
        );
      }

      if (claimData.emailData) {
        formData.append("emailData", JSON.stringify(claimData.emailData));
      }

      // Add file if present
      if (claimData.claimDocument) {
        formData.append("claimDocument", claimData.claimDocument);
      }

      const response = await fetch(`${this.baseURL}/claims`, {
        method: "POST",
        headers: {
          ...authService.getAuthHeader(),
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // the server lists each acceptance problem (loss date outside the policy period, unpaid premium ...)
        throw new Error(apiErrorText(await readError(response), "Failed to create claim"));
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to create claim",
      };
    }
  }

  /**
   * Get claims list with pagination
   * @param {number} page - Page number
   * @param {number} pageSize - Number of items per page
   * @returns {Promise<Object>} API response
   */
  async getClaimsList(page = 1, pageSize = 10) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        return {
          success: false,
          error: "User not authenticated. Please login again.",
        };
      }

      const response = await fetch(
        `${this.baseURL}/claims?page=${page}&pageSize=${pageSize}`,
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
        if (response.status === 401) {
          return {
            success: false,
            error: "Session expired. Please login again.",
          };
        }
        throw new Error(apiErrorText(await readError(response), "Failed to get claims list"));
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to get claims list",
      };
    }
  }

  /**
   * Get claim audit trail
   * @param {string} claimId - The claim ID
   * @param {string} sortOrder - Sort order (asc or desc)
   * @returns {Promise<Object>} API response
   */
  async getClaimAuditTrail(claimId, sortOrder = "desc") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.baseURL}/claims/audit-trail/${claimId}?sort=${sortOrder}`,
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
          errorData.error ||
            errorData.message ||
            "Failed to get claim audit trail"
        );
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to get claim audit trail",
      };
    }
  }

  /**
   * Get claim documents
   * @param {string} claimId - The claim ID
   * @param {string} documentName - The document name
   * @returns {Promise<Object>} API response
   */
  async getClaimDocuments(claimId, documentName) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${
          this.baseURL
        }/claims/getdocuments/${claimId}?documentName=${encodeURIComponent(
          documentName
        )}`,
        {
          method: "GET",
          headers: {
            ...authService.getAuthHeader(),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(apiErrorText(await readError(response), "Failed to get claim documents"));
      }

      // Handle PDF response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      return {
        success: true,
        data: {
          blob: blob,
          url: url,
          documentName: documentName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to get claim documents",
      };
    }
  }
}

// Create and export a singleton instance
const claimsService = new ClaimsService();
export default claimsService;
