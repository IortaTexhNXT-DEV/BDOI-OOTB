import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Lead Service
 * Handles lead-related API calls
 */
class LeadService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Create a new lead
   * @param {Object} leadData - Lead data to create
   * @returns {Promise<Object>} API response
   */
  async createLead(leadData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.baseURL}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(leadData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || "Failed to create lead"
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
            : error.message || "Failed to create lead",
      };
    }
  }

  /**
   * Get all leads with pagination and filters
   * @param {Object} params - Query parameters (page, pageSize, leadCategory, country, province, city, query)
   * @returns {Promise<Object>} API response with data, page, pageSize, total
   */
  async getAllLeads(params = {}) {
    try {
      const {
        page = 1,
        pageSize = 10,
        leadCategory,
        country,
        province,
        city,
        query,
        lob,
      } = params;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Build query string
      const queryParams = new URLSearchParams();
      queryParams.append("page", page);
      queryParams.append("pageSize", pageSize);
      if (leadCategory) queryParams.append("leadCategory", leadCategory);
      if (country) queryParams.append("country", country);
      if (province) queryParams.append("province", province);
      if (city) queryParams.append("city", city);
      if (query) queryParams.append("query", query);
      if (lob) queryParams.append("lob", lob);

      const url = `${this.baseURL}/leads?${queryParams.toString()}`;

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
        throw new Error(errorData.message || "Failed to fetch leads");
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || [],
        page: data.page || page,
        pageSize: data.pageSize || pageSize,
        total: data.total || 0,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch leads",
        data: [],
        page: params.page || 1,
        pageSize: params.pageSize || 10,
        total: 0,
      };
    }
  }

  /**
   * Update a lead
   * @param {string} leadId - Lead ID to update
   * @param {Object} leadData - Updated lead data
   * @returns {Promise<Object>} API response
   */
  async updateLead(leadId, leadData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/leads/${leadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(leadData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || "Failed to update lead"
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
            : error.message || "Failed to update lead",
      };
    }
  }

  /**
   * Tag or change the line of business and product of a lead
   * @param {string} leadId - Lead ID
   * @param {{ lob: string, productId: number }} tag - Line of business code and product id
   * @returns {Promise<Object>} API response with the updated lead
   */
  async tagProduct(leadId, { lob, productId }) {
    try {
      const response = await fetch(`${this.baseURL}/leads/${encodeURIComponent(leadId)}/product`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
        body: JSON.stringify({ lob, productId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = Array.isArray(data.errors) ? data.errors.map((e) => e.message).filter(Boolean).join(", ") : "";
        throw new Error(detail || data.message || "Failed to tag the product");
      }
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message || "Failed to tag the product" };
    }
  }

  /**
   * Get lead by ID
   * @param {string} leadId - Lead ID
   * @returns {Promise<Object>} API response
   */
  async getLeadById(leadId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/leads/${leadId}`, {
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
        throw new Error(errorData.message || "Failed to fetch lead");
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
            : error.message || "Failed to fetch lead",
      };
    }
  }

  /**
   * Search leads
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} API response
   */
  async searchLeads(searchParams) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const queryString = new URLSearchParams(searchParams).toString();
      const url = `${this.baseURL}/leads/search${
        queryString ? `?${queryString}` : ""
      }`;

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
        throw new Error(errorData.message || "Failed to search leads");
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
            : error.message || "Failed to search leads",
      };
    }
  }

  /**
   * Delete a lead
   * @param {string} leadId - Lead ID to delete
   * @returns {Promise<Object>} API response
   */
  async deleteLead(leadId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/leads/${leadId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete lead");
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
            : error.message || "Failed to delete lead",
      };
    }
  }

  /**
   * Get lead statistics
   * @param {Object} filters - Filter options (country, province, city, leadCategory)
   * @returns {Promise<Object>} API response with statistics
   */
  async getLeadStats(filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const queryParams = new URLSearchParams();
      if (filters.country) queryParams.append("country", filters.country);
      if (filters.province) queryParams.append("province", filters.province);
      if (filters.city) queryParams.append("city", filters.city);
      if (filters.leadCategory)
        queryParams.append("leadCategory", filters.leadCategory);

      const url = `${this.baseURL}/leads/stats${
        queryParams.toString() ? `?${queryParams.toString()}` : ""
      }`;

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
        throw new Error(errorData.message || "Failed to fetch lead statistics");
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
            : error.message || "Failed to fetch lead statistics",
        data: {
          totalLeads: 0,
          recentLeads: 0,
          leadsByCategory: [],
          leadsByCountry: [],
        },
      };
    }
  }

  /**
   * Create a Fire and Allied Perils lead (personal details only - page 1).
   * Uses POST /leads with lob: "FIRE". Page 2+ (risk, premium) goes to Create Quotation.
   * @param {Object} payload - Personal details only (firstName, lastName, email, etc.)
   * @returns {Promise<Object>} API response with leadId
   */
  async createFireLead(payload) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.baseURL}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Failed to create Fire lead"
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
            : error.message || "Failed to create Fire lead",
      };
    }
  }

  /**
   * Create an Industrial All Risks lead (personal details only).
   * Uses POST /leads with lob: "IAR".
   */
  async createIarLead(payload) {
    return this.createFireLead({ ...payload, lob: "IAR" });
  }

  /**
   * Generate lead report Excel file
   * @param {string} category - Report category (Excel, Converted, Pending, Dropped/Declined, Revised/Reconstruct)
   * @returns {Promise<Object>} API response with Excel file download
   */
  async generateLeadReport(category = null) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for report generation

      // Build query parameters
      const params = new URLSearchParams();
      if (category) {
        params.append("category", category);
      }

      const url = `${this.baseURL}/leads/report${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to parse error response
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            `Failed to generate report (status ${response.status})`
        );
      }

      // Handle Excel file response
      const blob = await response.blob();
      const url_blob = window.URL.createObjectURL(blob);

      // Get filename from Content-Disposition header or create default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `lead-report-${category || "all"}-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const link = document.createElement("a");
      link.href = url_blob;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url_blob);

      return {
        success: true,
        data: {
          blob: blob,
          url: url_blob,
          fileName: filename,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to generate lead report",
      };
    }
  }
}

// Create and export a singleton instance
const leadService = new LeadService();
export default leadService;
