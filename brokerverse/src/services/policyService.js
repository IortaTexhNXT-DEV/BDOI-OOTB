import { BASE_URL } from "../utility/constant";

/**
 * Policy Service
 * Handles policy-related API calls
 */
class PolicyService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Get authorization header for API requests
   * @returns {Object} Authorization header object
   */
  getAuthHeader() {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Fetch policies with pagination and filters
   * @param {number} page - Page number (default: 1)
   * @param {number} pageSize - Number of items per page (default: 10)
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Object>} API response with policies data
   */
  async getPolicies(page = 1, pageSize = 10, filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      // Add filters to query params
      if (filters.paymentStatus)
        params.append("paymentStatus", filters.paymentStatus);
      if (filters.quoteRefId) params.append("quoteRefId", filters.quoteRefId);
      if (filters.productType)
        params.append("productType", filters.productType);
      if (filters.insuranceCompanyName)
        params.append("insuranceCompanyName", filters.insuranceCompanyName);
      if (filters.clientName) params.append("clientName", filters.clientName);
      if (filters.clientId) params.append("clientId", filters.clientId);
      if (filters.issuedDateFrom)
        params.append("issuedDateFrom", filters.issuedDateFrom.toISOString());
      if (filters.issuedDateTo)
        params.append("issuedDateTo", filters.issuedDateTo.toISOString());
      if (filters.expiryDateFrom)
        params.append("expiryDateFrom", filters.expiryDateFrom.toISOString());
      if (filters.expiryDateTo)
        params.append("expiryDateTo", filters.expiryDateTo.toISOString());
      if (filters.premiumMin !== null && filters.premiumMin !== undefined)
        params.append("premiumMin", filters.premiumMin.toString());
      if (filters.premiumMax !== null && filters.premiumMax !== undefined)
        params.append("premiumMax", filters.premiumMax.toString());
      const searchQuery =
        (filters.query !== null &&
          filters.query !== undefined &&
          String(filters.query).trim()) ||
        (filters.policyNumber !== null &&
          filters.policyNumber !== undefined &&
          String(filters.policyNumber).trim()) ||
        "";
      if (searchQuery) {
        params.append("query", searchQuery);
        params.append("policyNumber", searchQuery);
      }
      if (filters.lob) params.append("lob", filters.lob);

      console.log(
        `Fetching policies - Page: ${page}, PageSize: ${pageSize}, Filters:`,
        filters
      );

      const response = await fetch(
        `${this.baseURL}/policies?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...this.getAuthHeader(),
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
      console.log("Policies API response:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Get policies error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch policies",
      };
    }
  }

  async updatePolicy(policyId, payload = {}) {
    if (!policyId) {
      return {
        success: false,
        error: "Policy ID is required",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/policies/${policyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeader(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.error || "Failed to update policy"
        );
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("Update policy error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to update policy",
      };
    }
  }

  /**
   * Get policy details by ID
   * @param {string} policyId - Policy ID
   * @returns {Promise<Object>} API response with policy data
   */
  async getPolicyDetails(policyId) {
    if (!policyId) {
      return {
        success: false,
        error: "Policy ID is required",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log(`Fetching policy details for: ${policyId}`);

      const response = await fetch(`${this.baseURL}/policies/${policyId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log("Policy details API response:", data);

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("Get policy details error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch policy details",
      };
    }
  }

  /**
   * Search policies by field and value
   * @param {string} field - Field to search in
   * @param {string} value - Value to search for
   * @param {Array} policies - Array of policies to search in
   * @returns {Array} Filtered policies
   */
  searchPolicies(field, value, policies) {
    if (!value || !policies || !Array.isArray(policies)) {
      return [];
    }

    const lowercasedValue = value.toLowerCase();

    return policies.filter((policy) => {
      switch (field) {
        case "Policy Number":
          return policy.policyNumber?.toLowerCase().includes(lowercasedValue);
        case "Insured Name":
          return policy.insuredName?.toLowerCase().includes(lowercasedValue);
        case "Plate Number":
          return policy.plateNumber?.toLowerCase().includes(lowercasedValue);
        case "Motor Number":
          return policy.motorNumber?.toLowerCase().includes(lowercasedValue);
        case "Chassis Number":
          return policy.chassisNumber?.toLowerCase().includes(lowercasedValue);
        case "ID Card Number":
          return policy.idCardNumber?.toLowerCase().includes(lowercasedValue);
        default:
          // General search across multiple fields
          return (
            policy.policyNumber?.toLowerCase().includes(lowercasedValue) ||
            policy.insuredName?.toLowerCase().includes(lowercasedValue) ||
            policy.plateNumber?.toLowerCase().includes(lowercasedValue) ||
            policy.motorNumber?.toLowerCase().includes(lowercasedValue) ||
            policy.chassisNumber?.toLowerCase().includes(lowercasedValue) ||
            policy.idCardNumber?.toLowerCase().includes(lowercasedValue)
          );
      }
    });
  }

  /**
   * Transform API policy data to match frontend format
   * @param {Object} apiPolicy - Policy data from API
   * @returns {Object} Transformed policy data
   */
  transformPolicyData(apiPolicy) {
    // Extract client data
    const client = apiPolicy.client || {};
    const clientName =
      client.firstName && client.lastName
        ? `${client.firstName} ${client.lastName}`.trim()
        : apiPolicy.insuredName || "N/A";

    return {
      ...apiPolicy,
      // Core IDs
      id: apiPolicy.policyId,
      policyId: apiPolicy.policyId,

      // Client information (FIXED)
      ClientId: client.clientId || apiPolicy.clientId || "N/A",
      ClientName: clientName,
      clientId: apiPolicy.clientId,
      client: client,

      // Payment status (FIXED)
      Payment: apiPolicy.paymentStatus || "Pending",
      paymentStatus: apiPolicy.paymentStatus,

      // Policy details
      policyNumber: apiPolicy.policyNumber,
      insuredName: apiPolicy.insuredName,
      idCard: apiPolicy.idCard,
      idCardNumber: apiPolicy.idCardNumber,
      motorNumber: apiPolicy.motorNumber,
      chassisNumber: apiPolicy.chassisNumber,
      mortgage: apiPolicy.mortgage,
      certNumber: apiPolicy.certNumber,
      plateNumber: apiPolicy.plateNumber,
      mvFileNumber: apiPolicy.MvFileNumber,
      authenCode: apiPolicy.authenCode,
      truckType: apiPolicy.truckType,
      aluminum: apiPolicy.aluminum,
      airBag: apiPolicy.airBag,
      tnvs: apiPolicy.TNVS,

      // Vehicle details from policy
      vehicleBrand: apiPolicy.vehicleBrand,
      modelYear: apiPolicy.modelYear,
      vehicleModel: apiPolicy.vehicleModel,
      modelVariant: apiPolicy.modelVariant,
      vehicleColor: apiPolicy.vehicleColor,
      seatingCapacity: apiPolicy.seatingCapacity,

      // Vehicle photos
      vehicleLeftSidePhoto: apiPolicy.vehicleLeftSidePhoto,
      vehicleRightSidePhoto: apiPolicy.vehicleRightSidePhoto,
      vehicleFrontSidePhoto: apiPolicy.vehicleFrontSidePhoto,
      vehicleRearSidePhoto: apiPolicy.vehicleRearSidePhoto,
      vehicleInteriorDashboardPhoto: apiPolicy.vehicleInteriorDashboardPhoto,

      // Dates and documents
      production: apiPolicy.production,
      inception: apiPolicy.inception,
      issuedDate: apiPolicy.issuedDate,
      expiry: apiPolicy.expiry,
      uploadPolicy: apiPolicy.uploadPolicy,

      // References
      quoteRefId: apiPolicy.quoteRefId,
      leadId: apiPolicy.leadId,
      lead: apiPolicy.lead,
      quotation: {
        ...apiPolicy.quotation,
        fireRiskDetails: apiPolicy.fireRiskDetails || apiPolicy.quotation?.fireRiskDetails,
        firePremiumDetails: apiPolicy.firePremiumDetails || apiPolicy.quotation?.firePremiumDetails,
      },

      // Fire LOB – keep at root for policy API response
      fireRiskDetails: apiPolicy.fireRiskDetails,
      firePremiumDetails: apiPolicy.firePremiumDetails,

      // Audit
      createdBy: apiPolicy.createdBy,
      createdAt: apiPolicy.createdAt,
      updatedBy: apiPolicy.updatedBy,
      updatedAt: apiPolicy.updatedAt,

      // Display fields
      PolicyIssued: apiPolicy.issuedDate,
      PolicyExpiry: apiPolicy.expiry,
      ProductDescription:
        apiPolicy.quotation?.productType ||
        apiPolicy.product ||
        "Motor Comprehensive",
      GrossPremium:
        apiPolicy.grossPremium ||
        this.calculateGrossPremium(apiPolicy.quotation?.participantDetails),
    };
  }

  async getPolicyEndorsementDetails(policyId) {
    try {
      const response = await fetch(
        `${this.baseURL}/endorsements/get-endorsement/policy-id?policyId=${policyId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...this.getAuthHeader(),
          },
        }
      );

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
      console.error("Get policy endorsement details error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch policy endorsement details",
      };
    }
  }

  /**
   * Calculate gross premium from participant details
   * @param {Array} participantDetails - Array of participant details
   * @returns {string} Formatted gross premium
   */
  calculateGrossPremium(participantDetails) {
    if (!participantDetails || !Array.isArray(participantDetails)) {
      return "0.00";
    }

    const totalPremium = participantDetails.reduce((sum, participant) => {
      const premium = parseFloat(
        participant.premiumCurrency?.replace(/[^0-9.-]/g, "") || 0
      );
      return sum + premium;
    }, 0);

    return totalPremium.toFixed(2);
  }

  async getPolicyRenewalCoverage({ policyId, page = 1, limit = 20 } = {}) {
    if (!policyId) {
      return {
        success: false,
        error: "Policy ID is required",
        data: [],
        pagination: null,
        coverage: {},
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const params = new URLSearchParams({ policyId, page, limit });
      const requestUrl = `${this.baseURL}/policy-renewals?${params.toString()}`;

      const response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const result = await response.json();

      if (result?.success === false) {
        return {
          success: false,
          error: result?.message || "Failed to fetch policy renewal coverage",
          data: result?.data || [],
          pagination: result?.pagination || null,
          coverage: {},
        };
      }

      const coverageRecord = this.extractRenewalCoverageRecord(result?.data);
      const transformedCoverage = coverageRecord
        ? this.transformRenewalCoverage(
            coverageRecord?.coverageDetails || coverageRecord
          )
        : {};

      return {
        success: true,
        data: result?.data || [],
        pagination: result?.pagination || null,
        message: result?.message || "",
        coverage: transformedCoverage,
      };
    } catch (error) {
      console.error("Get policy renewal coverage error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch policy renewal coverage",
        data: [],
        pagination: null,
        coverage: {},
      };
    }
  }

  async createPolicyRenewal(policyId, payload = {}) {
    if (!policyId) {
      return {
        success: false,
        error: "Policy ID is required",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `${this.baseURL}/policy-renewals/policies/${policyId}/renewals`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.getAuthHeader(),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok || responseData?.success === false) {
        const message =
          responseData?.message ||
          responseData?.error ||
          `HTTP error! status: ${response.status}`;
        return {
          success: false,
          error: message,
          data: responseData?.data ?? responseData,
        };
      }

      return {
        success: true,
        data: responseData?.data ?? responseData,
        message: responseData?.message || "",
      };
    } catch (error) {
      console.error("Create policy renewal error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to create policy renewal coverage",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async updatePaymentStatus(policyId, paymentData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.baseURL}/policies/${policyId}/payment-status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...this.getAuthHeader(),
          },
          body: JSON.stringify(paymentData),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            "Failed to update payment status"
        );
      }

      const data = await response.json();
      console.log("Payment status updated successfully:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Update payment status error:", error);
      return {
        success: false,
        error: error.message || "Failed to update payment status",
      };
    }
  }

  async updatePolicyRenewal(renewalId, payload = {}) {
    if (!renewalId) {
      return {
        success: false,
        error: "Renewal ID is required",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `${this.baseURL}/policy-renewals/${renewalId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...this.getAuthHeader(),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok || responseData?.success === false) {
        const message =
          responseData?.message ||
          responseData?.error ||
          `HTTP error! status: ${response.status}`;
        return {
          success: false,
          error: message,
          data: responseData?.data ?? responseData,
        };
      }

      return {
        success: true,
        data: responseData?.data ?? responseData,
        message: responseData?.message || "",
      };
    } catch (error) {
      console.error("Update policy renewal error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to update policy renewal coverage",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  extractRenewalCoverageRecord(data) {
    if (!data) {
      return null;
    }

    if (Array.isArray(data)) {
      return data[0] || null;
    }

    return data;
  }

  getCoverageFieldValue(source, keys) {
    if (!source || !keys || !Array.isArray(keys)) {
      return "";
    }

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        if (value !== undefined && value !== null) {
          return this.normalizeCoverageValue(value);
        }
      }
    }

    return "";
  }

  normalizeCoverageValue(value) {
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "number") {
      return value.toString();
    }

    return `${value}`;
  }

  /**
   * Transform policy coverage details for renewal form pre-population
   * @param {Object} policyData - Complete policy data from API
   * @returns {Object} Coverage details formatted for renewal form
   */
  transformPolicyCoverageForRenewal(policyData) {
    if (!policyData) {
      return {};
    }

    // Direct field mapping - no helper function to avoid extraction issues
    const result = {
      LossandDamagecoverage: policyData.lossAndDamageCoverage || "",
      LossandDamagecoverageRate: policyData.lossAndDamageCoverageRate || "",
      LossandDamagecoveragepremium:
        policyData.lossAndDamageCoveragePremium || "",
      ActsofNatureRate: policyData.actsOfNatureRate || "",
      CtplCoverageRate: policyData.ctplCoverageRate || "",
      ActsofNaturepremium: policyData.actsOfNaturePremium || "",
      BodilyInjury: policyData.bodilyInjury || "",
      BodilyInjuryCoveragePremium: policyData.bodilyInjuryCoveragePremium || "",
      PropertyDamage: policyData.propertyDamage || "",
      PropertyDamageCoveragePremium:
        policyData.propertyDamageCoveragePremium || "",
      AutopassengerpersonalAccident:
        policyData.autoPassengerPersonalAccident || "",
      APPATotalCoverage: policyData.APPAtotalCoverage || "",
      APPACoveragePremium: policyData.APPAcoveragePremium || "",
      TotalSumInsured:
        policyData.totalSumInsured || policyData.totalCoverage || "",
    };

    return result;
  }

  transformRenewalCoverage(rawCoverage) {
    if (!rawCoverage) {
      return {};
    }

    const source =
      rawCoverage?.coverageDetails || rawCoverage?.coverage || rawCoverage;

    return {
      LossandDamagecoverage: this.getCoverageFieldValue(source, [
        "lossAndDamageCoverage",
      ]),
      LossandDamagecoverageRate: this.getCoverageFieldValue(source, [
        "lossAndDamageCoverageRate",
      ]),
      LossandDamagecoveragepremium: this.getCoverageFieldValue(source, [
        "lossAndDamageCoveragePremium",
      ]),
      ActsofNatureRate: this.getCoverageFieldValue(source, [
        "actsOfNatureRate",
      ]),
      ActsofNaturepremium: this.getCoverageFieldValue(source, [
        "actsOfNaturePremium",
      ]),
      CtplCoverageRate: this.getCoverageFieldValue(source, [
        "ctplCoverageRate",
      ]),
      BodilyInjury: this.getCoverageFieldValue(source, ["bodilyInjury"]),
      BodilyInjuryCoveragePremium: this.getCoverageFieldValue(source, [
        "bodilyInjuryCoveragePremium",
      ]),
      PropertyDamage: this.getCoverageFieldValue(source, ["propertyDamage"]),
      PropertyDamageCoveragePremium: this.getCoverageFieldValue(source, [
        "propertyDamageCoveragePremium",
      ]),
      AutopassengerpersonalAccident: this.getCoverageFieldValue(source, [
        "autoPassengerPersonalAccident",
      ]),
      APPATotalCoverage: this.getCoverageFieldValue(source, [
        "APPAtotalCoverage",
      ]),
      APPACoveragePremium: this.getCoverageFieldValue(source, [
        "APPAcoveragePremium",
      ]),
      TotalSumInsured: this.getCoverageFieldValue(source, ["totalSumInsured"]),
    };
  }

  /**
   * Bulk upload policies from Excel file
   * @param {File} file - Excel file to upload
   * @returns {Promise<Object>} API response with upload results
   */
  async bulkUploadPolicies(file) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for file upload

      console.log("Uploading policies file:", file.name);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${this.baseURL}/policies/bulk-upload`, {
        method: "POST",
        headers: {
          ...this.getAuthHeader(),
          // Note: Don't set Content-Type for FormData, browser will set it with boundary
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload policies file");
      }

      const data = await response.json();
      console.log("Policies bulk upload completed:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Bulk upload policies error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Upload timeout. Please try again."
            : error.message || "Failed to upload policies file",
      };
    }
  }
}

// Create and export a singleton instance
const policyService = new PolicyService();
export default policyService;
