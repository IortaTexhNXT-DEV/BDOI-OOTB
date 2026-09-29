import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const toQueryString = (params = {}) =>
  new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  ).toString();

/**
 * Accounting Service
 * Handles accounting and client ledger API calls
 */
class AccountingService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Get client ledger view
   * @param {string} clientId - Client ID
   * @returns {Promise<Object>} API response with client ledger data
   */
  async getClientLedgerView(clientId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `${this.baseURL}/accounting/clients/${clientId}/ledger-view`,
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
            `Failed to fetch client ledger (status ${response.status})`
        );
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || [],
        totals: data.totals || {},
        pagination: data.pagination || {},
        message: data.message || "Client ledger view retrieved successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to fetch client ledger",
        data: [],
        totals: {},
        pagination: {},
      };
    }
  }

  /**
   * Create payment accounting entry
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} API response
   */
  async createPaymentAccountingEntry(paymentData) {
    try {
      // Validate required fields
      if (!paymentData) {
        throw new Error("Payment data is required");
      }

      if (!paymentData.clientId) {
        throw new Error("Client ID is required for accounting entries");
      }

      if (!paymentData.amount || paymentData.amount <= 0) {
        throw new Error(
          "Valid amount is required for accounting entries (must be greater than 0)"
        );
      }

      if (!paymentData.referenceType) {
        throw new Error("Reference type is required for accounting entries");
      }

      if (!paymentData.referenceId) {
        throw new Error("Reference ID is required for accounting entries");
      }

      // Ensure amount is a number
      const amount = parseFloat(paymentData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a valid positive number");
      }

      // Normalize payment data
      const normalizedData = {
        ...paymentData,
        amount: amount,
        paymentDate: paymentData.paymentDate || new Date().toISOString(),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.baseURL}/accounting/payment-entries`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify(normalizedData),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          errorData.error ||
          `Failed to create payment accounting entry (status ${response.status})`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get policy ledger view
   * @param {string} policyId - Policy ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} API response with policy ledger data
   */
  async getPolicyLedgerView(policyId, filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append("startDate", filters.startDate);
      if (filters.endDate) queryParams.append("endDate", filters.endDate);
      if (filters.entryType) queryParams.append("entryType", filters.entryType);
      if (filters.status) queryParams.append("status", filters.status);
      if (filters.page) queryParams.append("page", filters.page);
      if (filters.pageSize) queryParams.append("pageSize", filters.pageSize);

      const response = await fetch(
        `${
          this.baseURL
        }/accounting/policies/${policyId}/ledger-view?${queryParams.toString()}`,
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
            `Failed to fetch policy ledger (status ${response.status})`
        );
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || [],
        totals: data.totals || {},
        pagination: data.pagination || {},
        message: data.message || "Policy ledger view retrieved successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to fetch policy ledger",
        data: [],
        totals: {},
        pagination: {},
      };
    }
  }

  /**
   * Get policy accounting entries
   * @param {string} policyId - Policy ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} API response with policy entries
   */
  async getPolicyAccountingEntries(policyId, filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append("startDate", filters.startDate);
      if (filters.endDate) queryParams.append("endDate", filters.endDate);
      if (filters.entryType) queryParams.append("entryType", filters.entryType);
      if (filters.status) queryParams.append("status", filters.status);
      if (filters.page) queryParams.append("page", filters.page);
      if (filters.pageSize) queryParams.append("pageSize", filters.pageSize);

      const response = await fetch(
        `${
          this.baseURL
        }/accounting/policies/${policyId}/entries?${queryParams.toString()}`,
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
            `Failed to fetch policy entries (status ${response.status})`
        );
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || [],
        isCoInsurance: Boolean(data.isCoInsurance),
        pagination: data.pagination || {},
        message:
          data.message || "Policy accounting entries retrieved successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to fetch policy entries",
        data: [],
        isCoInsurance: false,
        pagination: {},
      };
    }
  }

  /**
   * Query accounting entries with flexible filters
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} API response with matching entries
   */
  async queryAccountingEntries(filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const queryParams = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (
          filters[key] !== undefined &&
          filters[key] !== null &&
          filters[key] !== ""
        ) {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await fetch(
        `${this.baseURL}/accounting/entries/search?${queryParams.toString()}`,
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
            `Failed to search accounting entries (status ${response.status})`
        );
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || [],
        pagination: data.pagination || {},
        message: data.message || "Accounting entries retrieved successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to query accounting entries",
        data: [],
        pagination: {},
      };
    }
  }

  /**
   * Get all clients with their accounting entries
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} API response with all clients accounting data
   */
  async getAllClientsAccounting(filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append("startDate", filters.startDate);
      if (filters.endDate) queryParams.append("endDate", filters.endDate);
      if (filters.entryType) queryParams.append("entryType", filters.entryType);
      if (filters.clientId) queryParams.append("clientId", filters.clientId);
      if (filters.policyId) queryParams.append("policyId", filters.policyId);
      if (filters.page) queryParams.append("page", filters.page);
      if (filters.pageSize) queryParams.append("pageSize", filters.pageSize);

      const response = await fetch(
        `${
          this.baseURL
        }/accounting/all-clients-accounting?${queryParams.toString()}`,
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
            `Failed to fetch all clients accounting (status ${response.status})`
        );
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || [],
        pagination: data.pagination || {},
        totals: data.totals || {},
        message:
          data.message || "All clients accounting data retrieved successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to fetch all clients accounting",
        data: [],
        pagination: {},
        totals: {},
      };
    }
  }

  /**
   * Post a transaction (change status from Pending to Posted)
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} API response
   */
  async postTransaction(transactionId) {
    try {
      const response = await fetch(
        `${this.baseURL}/accounting/transactions/${transactionId}/post`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Failed to post transaction"
        );
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data,
        message: data.message || "Transaction posted successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to post transaction",
      };
    }
  }

  /**
   * Reverse a transaction (change status from Posted to Reversed)
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} API response
   */
  async reverseTransaction(transactionId) {
    try {
      const response = await fetch(
        `${this.baseURL}/accounting/transactions/${transactionId}/reverse`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            "Failed to reverse transaction"
        );
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data,
        message: data.message || "Transaction reversed successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to reverse transaction",
      };
    }
  }

  /**
   * Cancel a transaction (change status to Cancelled)
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} API response
   */
  async cancelTransaction(transactionId) {
    try {
      const response = await fetch(
        `${this.baseURL}/accounting/transactions/${transactionId}/cancel`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Failed to cancel transaction"
        );
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data,
        message: data.message || "Transaction cancelled successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to cancel transaction",
      };
    }
  }

  /**
   * Bulk post transactions
   * @param {string[]} transactionIds - Array of transaction IDs
   * @returns {Promise<Object>} API response
   */
  async bulkPostTransactions(transactionIds) {
    try {
      const response = await fetch(
        `${this.baseURL}/accounting/transactions/bulk-post`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({ transactionIds }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            "Failed to bulk post transactions"
        );
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data,
        message: data.message || "Transactions posted successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to bulk post transactions",
      };
    }
  }

  /**
   * Export accounting entries to Excel
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Success status
   */
  async exportAccountingEntries(filters = {}) {
    try {
      // Build query string from filters
      const queryParams = new URLSearchParams();

      Object.keys(filters).forEach((key) => {
        const value = filters[key];
        if (value !== null && value !== undefined && value !== "") {
          if (value instanceof Date) {
            queryParams.append(key, value.toISOString().split("T")[0]);
          } else {
            queryParams.append(key, value);
          }
        }
      });

      const queryString = queryParams.toString();
      const url = `${this.baseURL}/accounting/export${
        queryString ? `?${queryString}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              "No accounting entries found matching the filters"
          );
        }
        throw new Error(
          `Failed to export accounting entries (status ${response.status})`
        );
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "accounting-entries-export.xlsx";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      return {
        success: true,
        message: "Accounting entries exported successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to export accounting entries",
      };
    }
  }

  async getAccounts(filters = {}) {
    try {
      const query = toQueryString(filters);
      const response = await fetch(
        `${this.baseURL}/accounting/accounts${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to get accounts");
      }
      return { success: true, data: data.data || [] };
    } catch (error) {
      return { success: false, error: error.message, data: [] };
    }
  }

  /** Chart of accounts requests that throw the server message on failure (used by the chart of accounts master). */
  async chartRequest(method, path, body) {
    const response = await fetch(`${this.baseURL}/accounting${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const details = (data.errors || []).map((e) => e.message).filter(Boolean).join(", ");
      throw new Error(`${data.message || `Request failed (${response.status})`}${details ? `: ${details}` : ""}`);
    }
    return data.data;
  }

  /** Account types and financial-statement groups of the chart. */
  getAccountGroups() {
    return this.chartRequest("GET", "/account-groups");
  }

  /** Chart of accounts in statement order, with system roles (throws on error). */
  listChartOfAccounts(filters = {}) {
    const query = toQueryString(filters);
    return this.chartRequest("GET", `/accounts${query ? `?${query}` : ""}`);
  }

  createAccount(account) {
    return this.chartRequest("POST", "/accounts", account);
  }

  updateAccount(code, changes) {
    return this.chartRequest("PUT", `/accounts/${encodeURIComponent(code)}`, changes);
  }

  async getUnmatchedEntries(filters = {}) {
    try {
      const query = toQueryString({ ...filters, page: 1, pageSize: 100 });
      const response = await fetch(
        `${this.baseURL}/accounting/entries/unmatched?${query}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to get unmatched entries");
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || [],
        pagination: data.pagination || {},
        message: data.message || "Unmatched entries retrieved successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to get unmatched entries",
        data: [],
        pagination: {},
      };
    }
  }

  async matchEntries(matchPairs, metadata = {}) {
    try {
      const response = await fetch(`${this.baseURL}/accounting/entries/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ matchPairs, metadata }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to match entries");
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data,
        message: data.message || "Entries matched successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to match entries",
        data: [],
      };
    }
  }
  async getMatchedEntries(filters = {}) {
    try {
      const query = toQueryString(filters);
      const response = await fetch(
        `${this.baseURL}/accounting/entries/matched${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to get matched entries");
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || [],
        pagination: data.pagination || {},
        message: data.message || "Matched entries retrieved successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to get matched entries",
        data: [],
        pagination: {},
      };
    }
  }
  async unmatchEntries(matchingIds) {
    try {
      const response = await fetch(
        `${this.baseURL}/accounting/entries/unmatch`,

        {
          body: JSON.stringify({ matchingIds }),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to unmatch entries");
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data,
        message: data.message || "Entries unmatched successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to unmatch entries",
        data: [],
      };
    }
  }
}

const accountingService = new AccountingService();
export default accountingService;
