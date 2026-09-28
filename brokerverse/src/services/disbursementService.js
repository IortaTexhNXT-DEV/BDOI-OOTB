import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/**
 * Service for handling disbursement-related API calls
 */
class DisbursementService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Create a new disbursement
   * @param {Object} disbursementData - Disbursement data
   * @returns {Promise<Object>} API response with disbursement data
   */
  async createDisbursement(disbursementData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/disbursements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(disbursementData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create disbursement");
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
            : error.message || "Failed to create disbursement",
      };
    }
  }

  /**
   * Get all disbursements with pagination
   * @param {Number} page - Page number (default: 1)
   * @param {Number} pageSize - Items per page (default: 10)
   * @returns {Promise<Object>} API response with disbursements data
   */
  async getDisbursements(page = 1, pageSize = 10) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.baseURL}/disbursements?page=${page}&pageSize=${pageSize}`,
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
        throw new Error(errorData.message || "Failed to fetch disbursements");
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
            : error.message || "Failed to fetch disbursements",
      };
    }
  }

  /**
   * Filter disbursements with new API endpoint
   * @param {Object} filterParams - Filter parameters
   * @returns {Promise<Object>} API response with filtered disbursements data
   */
  async filterDisbursements(filterParams) {
    try {
      const {
        customerCode,
        voucherNumber,
        transactionNumber,
        fromDate,
        toDate,
        page = 1,
        pageSize = 10,
      } = filterParams;

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("page", page);
      queryParams.append("pageSize", pageSize);

      // Add filter parameters if they exist
      if (customerCode) queryParams.append("customerCode", customerCode);
      if (voucherNumber) queryParams.append("voucherNumber", voucherNumber);
      if (transactionNumber)
        queryParams.append("transactionNumber", transactionNumber);
      if (fromDate) queryParams.append("fromDate", fromDate);
      if (toDate) queryParams.append("toDate", toDate);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.baseURL}/disbursements?${queryParams.toString()}`,
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
        throw new Error(errorData.message || "Failed to filter disbursements");
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
            : error.message || "Failed to filter disbursements",
      };
    }
  }

  /**
   * Bulk print disbursements
   * @param {Object} filters - Filters for bulk print (customerCode, fromDate, toDate)
   * @returns {Promise<Object>} API response with download URL
   */
  async bulkPrintDisbursements(filters) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for bulk operations

      const queryParams = new URLSearchParams({
        customerCodeFrom: filters.customerCodeFrom,
        customerCodeTo: filters.customerCodeTo,
        createdAtFrom: filters.createdAtFrom,
        createdAtTo: filters.createdAtTo,
      });

      const response = await fetch(
        `${this.baseURL}/disbursements/printDisbursement?${queryParams}`,
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
        // Return the full error response structure to preserve message and error details
        return {
          success: false,
          data: errorData, // Preserve the full API error response
          error: errorData,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      // Handle network errors, timeouts, etc.
      if (error.name === "AbortError") {
        return {
          success: false,
          error: { message: "Request timeout. Please try again." },
        };
      }
      // If error is already structured, preserve it
      if (error.data || error.message) {
        return {
          success: false,
          data: error.data || { message: error.message },
          error: error.data || { message: error.message },
        };
      }
      return {
        success: false,
        error: {
          message: error.message || "Failed to bulk print disbursements",
        },
      };
    }
  }

  /**
   * Update disbursement amount
   * @param {String} disbursementId - Disbursement ID
   * @param {Object} updateData - Data to update (amount)
   * @returns {Promise<Object>} API response with updated disbursement data
   */
  async updateDisbursement(disbursementId, updateData) {
    try {
      console.log("=== DISBURSEMENT SERVICE: updateDisbursement ===");
      console.log("Disbursement ID:", disbursementId);
      console.log("Update data:", updateData);
      console.log("Base URL:", this.baseURL);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${this.baseURL}/disbursements/${disbursementId}`;
      console.log("Making PUT request to:", url);
      console.log("Auth headers:", authService.getAuthHeader());

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(updateData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(errorData.message || "Failed to update disbursement");
      }

      const data = await response.json();
      console.log("API response data:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Update disbursement service error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to update disbursement",
      };
    }
  }

  /**
   * Update checkbook status
   * @param {String} checkbookId - Checkbook ID
   * @param {Object} checkbookData - Checkbook data to update
   * @returns {Promise<Object>} API response with updated checkbook data
   */
  async updateCheckbook(checkbookId, checkbookData) {
    try {
      console.log("=== DISBURSEMENT SERVICE: updateCheckbook ===");
      console.log("Checkbook ID:", checkbookId);
      console.log("Checkbook data:", checkbookData);
      console.log("Base URL:", this.baseURL);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${this.baseURL}/disbursements/checkbook/${checkbookId}`;
      console.log("Making PUT request to:", url);
      console.log("Auth headers:", authService.getAuthHeader());

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(checkbookData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(errorData.message || "Failed to update checkbook");
      }

      const data = await response.json();
      console.log("API response data:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Update checkbook service error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to update checkbook",
      };
    }
  }

  /**
   * Get invoice list with checkbooks by invoice list ID
   * @param {String} invoiceListId - Invoice List ID
   * @returns {Promise<Object>} API response with invoice list and checkbooks data
   */
  async getInvoiceListById(invoiceListId) {
    try {
      console.log("=== DISBURSEMENT SERVICE: getInvoiceListById ===");
      console.log("Invoice List ID:", invoiceListId);
      console.log("Base URL:", this.baseURL);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${this.baseURL}/disbursements/invoice-list/${invoiceListId}`;
      console.log("Making GET request to:", url);
      console.log("Auth headers:", authService.getAuthHeader());

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(errorData.message || "Failed to fetch invoice list");
      }

      const data = await response.json();
      console.log("API response data:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Invoice list service error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch invoice list",
      };
    }
  }

  async getInvoiceListByCustomerCode(customerCode) {
    try {
      const controller = new AbortController();

      const response = await fetch(
        `${this.baseURL}/disbursements/invoice-list?page=1&pageSize=10&customerCode=${customerCode}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch invoice list");
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
            : error.message || "Failed to fetch invoice list",
      };
    }
  }

  /**
   * Create invoice list item
   * @param {Object} invoiceListData - Invoice list data
   * @returns {Promise<Object>} API response with invoice list data
   */
  async createInvoiceList(invoiceListData) {
    try {
      console.log('=== DISBURSEMENT SERVICE: createInvoiceList ===');
      console.log('Invoice list data:', invoiceListData);
      console.log('Base URL:', this.baseURL);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${this.baseURL}/disbursements/invoice-list`;
      console.log('Making POST request to:', url);
      console.log('Auth headers:', authService.getAuthHeader());

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify(invoiceListData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error response:', errorData);
        throw new Error(errorData.message || errorData.error?.details || 'Failed to create invoice list');
      }

      const data = await response.json();
      console.log('API response data:', data);

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      console.error('Create invoice list service error:', error);
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to create invoice list'),
      };
    }
  }

  /**
   * Find or create disbursement for cancellation
   * @param {Object} options - Options for finding/creating disbursement
   * @param {String} options.customerCode - Customer code
   * @param {String} options.policyNumber - Policy number (optional)
   * @param {String} options.createdBy - User ID creating the disbursement
   * @returns {Promise<Object>} API response with disbursement data
   */
  async findOrCreateDisbursementForCancellation({ customerCode, policyNumber, createdBy }) {
    try {
      // First, try to find existing disbursement for this customer
      const filterResult = await this.filterDisbursements({
        customerCode,
        page: 1,
        pageSize: 1
      });

      // Check different possible response structures
      const disbursements = 
        filterResult.data?.data || 
        filterResult.data?.disbursements || 
        (Array.isArray(filterResult.data) ? filterResult.data : []);

      if (filterResult.success && disbursements.length > 0) {
        // Use existing disbursement (prefer one with cancellation criteria)
        const cancellationDisbursement = disbursements.find(
          d => d.criteria?.toLowerCase().includes('cancellation') || 
               d.criteria?.toLowerCase().includes('refund')
        ) || disbursements[0];
        
        return {
          success: true,
          data: cancellationDisbursement,
          isNew: false
        };
      }

      // Create new disbursement for cancellation
      const today = new Date().toISOString().split('T')[0];
      const disbursementData = {
        voucherDate: today,
        departmentCode: "DEPT-001",
        branchCode: "BR-001",
        payeeType: "Client",
        criteria: "Policy Cancellation Refund",
        customerCode: customerCode,
        transactionCode: `TXN-CANCEL-${Date.now()}`,
        transactionDescription: `Cancellation refund for ${policyNumber || 'policy'}`,
        instrumentCurrency: "THB",
        remarks: `Refund disbursement for policy cancellation ${policyNumber || ''}`,
        amount: "0.00", // Will be updated when invoice list is created
        createdBy: createdBy
      };

      const createResult = await this.createDisbursement(disbursementData);
      
      if (createResult.success) {
        // Extract disbursement ID from response
        const disbursement = createResult.data?.data || createResult.data;
        return {
          success: true,
          data: disbursement,
          isNew: true
        };
      } else {
        throw new Error(createResult.error || 'Failed to create disbursement');
      }
    } catch (error) {
      console.error('Find or create disbursement error:', error);
      return {
        success: false,
        error: error.message || 'Failed to find or create disbursement'
      };
    }
  }

  /**
   * Get disbursement by ID
   * @param {String} disbursementId - Disbursement ID
   * @returns {Promise<Object>} API response with disbursement data
   */
  async getDisbursementById(disbursementId) {
    try {
      console.log("=== DISBURSEMENT SERVICE: getDisbursementById ===");
      console.log("Disbursement ID:", disbursementId);
      console.log("Base URL:", this.baseURL);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${this.baseURL}/disbursements/${disbursementId}`;
      console.log("Making GET request to:", url);
      console.log("Auth headers:", authService.getAuthHeader());

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(errorData.message || "Failed to fetch disbursement");
      }

      const data = await response.json();
      console.log("API response data:", data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Disbursement service error:", error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Request timeout. Please try again."
            : error.message || "Failed to fetch disbursement",
      };
    }
  }

  async createCheckbook(checkbookData) {
    try {
      const response = await fetch(`${this.baseURL}/disbursements/checkbook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(checkbookData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create checkbook");
      }
      const data = await response.json();
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to create checkbook",
      };
    }
  }

  async getAgentInvoiceLines(referrerId) {
    try {
      const response = await fetch(
        `${this.baseURL}/disbursements/agent-invoice-lines?referrerId=${encodeURIComponent(referrerId)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to fetch agent invoice lines"
        );
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to fetch agent invoice lines",
      };
    }
  }

  async approveAgentPayout(disbursementId, { lineIds }) {
    try {
      const response = await fetch(
        `${this.baseURL}/disbursements/${disbursementId}/approve-agent-payout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({ lineIds }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to approve agent payout");
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to approve agent payout",
      };
    }
  }

  async bulkAgentDisburse(payload) {
    try {
      const response = await fetch(
        `${this.baseURL}/disbursements/bulk-agent-disburse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to bulk disburse agents");
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to bulk disburse agents",
      };
    }
  }
}

export default new DisbursementService();
