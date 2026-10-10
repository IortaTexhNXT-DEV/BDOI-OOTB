import {
  getRequest,
  postRequest,
  patchRequest,
} from "../utility/commonServices";

/**
 * Collection Service - Frontend API client for collections module
 */
class CollectionService {
  /**
   * Get collections list with filters and pagination
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Collections list
   */
  static async getCollections(params = {}) {
    try {
      const queryParams = new URLSearchParams();

      if (params.page) queryParams.append("page", params.page);
      if (params.pageSize) queryParams.append("pageSize", params.pageSize);
      if (params.status) queryParams.append("status", params.status);
      if (params.overdueLevel)
        queryParams.append("overdueLevel", params.overdueLevel);
      if (params.clientId) queryParams.append("clientId", params.clientId);
      if (params.search) queryParams.append("search", params.search);
      if (params.sortField) queryParams.append("sortField", params.sortField);
      if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);

      const response = await getRequest(
        `collections?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get collection by ID
   * @param {string} collectionId - Collection ID
   * @returns {Promise<Object>} Collection details
   */
  static async getCollectionById(collectionId) {
    try {
      const response = await getRequest(`collections/${collectionId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add follow-up action to collection
   * @param {string} collectionId - Collection ID
   * @param {Object} actionData - Follow-up action data
   * @returns {Promise<Object>} Result
   */
  static async addFollowUpAction(collectionId, actionData) {
    try {
      const response = await postRequest(
        `collections/${collectionId}/follow-up`,
        actionData
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set commitment date for collection
   * @param {string} collectionId - Collection ID
   * @param {string} commitmentDate - Date client committed to pay
   * @param {string} reason - Reason for delay
   * @returns {Promise<Object>} Result
   */
  static async setCommitmentDate(collectionId, commitmentDate, reason) {
    try {
      const response = await patchRequest(
        `collections/${collectionId}/commitment`,
        {
          commitmentDate,
          reason,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get aging report
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Aging report
   */
  static async getAgingReport(filters = {}) {
    try {
      const queryParams = new URLSearchParams();

      if (filters.clientId) queryParams.append("clientId", filters.clientId);

      const response = await getRequest(
        `collections/aging-report?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   * @returns {Promise<Object>} Dashboard stats
   */
  static async getDashboardStats() {
    try {
      const response = await getRequest("collections/dashboard-stats");
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sync collection from receipt
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<Object>} Result
   */
  static async syncFromReceipt(receiptId) {
    try {
      const response = await postRequest("collections/sync", { receiptId });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  static async sendEmail(collectionId, body) {
    try {
      const response = await postRequest(
        `collections/${collectionId}/send-email`,
        body
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send due date reminders
   * @returns {Promise<Object>} Result
   */
  /** What the due-date reminders would send now: { items, clients, withoutEmail, totalOutstanding, byLevel }. */
  static async getDueDateReminderPreview() {
    const response = await getRequest("collections/send-due-date-reminders/preview");
    return response.data;
  }

  static async sendDueDateReminders() {
    try {
      const response = await postRequest("collections/send-due-date-reminders");
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default CollectionService;
