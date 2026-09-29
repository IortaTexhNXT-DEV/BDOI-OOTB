import {
  getRequest,
  postRequest,
  putRequest,
  deleteRequest,
} from "../utility/commonServices";
import request from "../utility/interceptor";

/**
 * Batch Renewal Service
 * Handles API calls for batch renewal operations
 */
class BatchRenewalService {
  /**
   * Get all renewal batches with pagination
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Batches list with pagination
   */
  static async getBatches(params = {}) {
    try {
      const queryParams = new URLSearchParams();

      if (params.page) queryParams.append("page", params.page);
      if (params.limit) queryParams.append("limit", params.limit);
      if (params.status) queryParams.append("status", params.status);
      if (params.search) queryParams.append("search", params.search);
      if (params.sortField) queryParams.append("sortField", params.sortField);
      if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);

      const response = await getRequest(
        `policy-renewals/batches?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Get batches error:", error);
      throw error;
    }
  }

  /**
   * Get batch by ID
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Batch details
   */
  static async getBatchById(batchId) {
    try {
      const response = await getRequest(`policy-renewals/batches/${batchId}`);
      return response.data;
    } catch (error) {
      console.error("Get batch by ID error:", error);
      throw error;
    }
  }

  /**
   * Create new batch renewal
   * @param {Object} batchData - Batch creation data
   * @returns {Promise<Object>} Created batch
   */
  static async createBatch(batchData) {
    try {
      const response = await postRequest(
        "policy-renewals/create-batches",
        batchData
      );
      return response.data;
    } catch (error) {
      console.error("Create batch error:", error);
      throw error;
    }
  }

  /**
   * Update batch renewal
   * @param {string} batchId - Batch ID
   * @param {Object} batchData - Update data
   * @returns {Promise<Object>} Updated batch
   */
  static async updateBatch(batchId, batchData) {
    try {
      const response = await putRequest(
        `policy-renewals/batches/${batchId}`,
        batchData
      );
      return response.data;
    } catch (error) {
      console.error("Update batch error:", error);
      throw error;
    }
  }

  /**
   * Delete batch renewal
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Deletion response
   */
  static async deleteBatch(batchId) {
    try {
      const response = await deleteRequest(
        `policy-renewals/batches/${batchId}`
      );
      return response.data;
    } catch (error) {
      console.error("Delete batch error:", error);
      throw error;
    }
  }

  /**
   * Get batch policies
   * @param {string} batchId - Batch ID
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Batch policies
   */
  static async getBatchPolicies(batchId, params = {}) {
    try {
      const queryParams = new URLSearchParams();

      if (params.page) queryParams.append("page", params.page);
      if (params.pageSize) queryParams.append("pageSize", params.pageSize);
      if (params.noticeStatus)
        queryParams.append("noticeStatus", params.noticeStatus);
      if (params.isSelected !== undefined)
        queryParams.append("isSelected", params.isSelected);

      const response = await getRequest(
        `policy-renewals/batches/${batchId}/policies?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Get batch policies error:", error);
      throw error;
    }
  }

  /**
   * Update batch policy selection
   * @param {string} batchId - Batch ID
   * @param {string} policyId - Policy ID
   * @param {boolean} isSelected - Selection status
   * @returns {Promise<Object>} Update response
   */
  static async updatePolicySelection(batchId, policyId, isSelected) {
    try {
      const response = await putRequest(
        `policy-renewals/batches/${batchId}/policies/${policyId}`,
        { isSelected }
      );
      return response.data;
    } catch (error) {
      console.error("Update policy selection error:", error);
      throw error;
    }
  }

  /**
   * Send renewal notices for batch
   * @param {string} batchId - Batch ID
   * @param {Object} noticeData - Notice configuration
   * @returns {Promise<Object>} Send response
   */
  static async sendRenewalNotices(noticeData = {}) {
    try {
      const response = await postRequest(
        `policy-renewals/batches/${noticeData.batchId}/send-notices`,
        noticeData
      );
      return response.data;
    } catch (error) {
      console.error("Send renewal notices error:", error);
      throw error;
    }
  }

  /**
   * Get batch statistics
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Batch statistics
   */
  static async getBatchStatistics(batchId) {
    try {
      const response = await getRequest(
        `policy-renewals/batches/${batchId}/statistics`
      );
      return response.data;
    } catch (error) {
      console.error("Get batch statistics error:", error);
      throw error;
    }
  }

  /**
   * Get queue job status
   * @param {string} jobId - Queue job ID
   * @returns {Promise<Object>} Job status
   */
  static async getQueueJobStatus(jobId) {
    try {
      const response = await getRequest(`policy-renewals/queue/${jobId}`);
      return response.data;
    } catch (error) {
      console.error("Get queue job status error:", error);
      throw error;
    }
  }

  /**
   * Retry failed renewal notices for a batch
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Retry response
   */
  static async retryFailedNotices(batchId) {
    try {
      const response = await postRequest(
        `policy-renewals/batches/${batchId}/retry-failed`,
        {}
      );
      return response.data;
    } catch (error) {
      console.error("Retry failed notices error:", error);
      throw error;
    }
  }

  /**
   * Get batch notice status
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Notice status statistics
   */
  static async getBatchNoticeStatus(batchId) {
    try {
      const response = await getRequest(
        `policy-renewals/batches/${batchId}/notice-status`
      );
      return response.data;
    } catch (error) {
      console.error("Get batch notice status error:", error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue statistics
   */
  static async getQueueStats() {
    try {
      const response = await getRequest(`policy-renewals/queue-stats`);
      return response.data;
    } catch (error) {
      console.error("Get queue stats error:", error);
      throw error;
    }
  }

  /**
   * Generate and download batch report as Excel
   * @param {string} batchId - Batch ID
   * @returns {Promise<Blob>} Excel file blob
   */
  static async generateBatchReport(batchId) {
    try {
      const response = await request.get(
        `policy-renewals/batches/${batchId}/report`,
        {
          responseType: "blob",
        }
      );
      return response.data;
    } catch (error) {
      console.error("Generate batch report error:", error);
      throw error;
    }
  }
}

export default BatchRenewalService;
