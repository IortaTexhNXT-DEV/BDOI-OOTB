import { getRequest, postRequest, putRequest } from '../utility/commonServices';
import importService from './importService';

export const receiptsService = {
  // Get all receipts with pagination
  getReceipts: async (page = 1, pageSize = 10) => {
    try {
      const response = await getRequest(`receipts?page=${page}&pageSize=${pageSize}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Draft receipts (pay-later) for the Add receipt screen
  getDraftReceipts: async (pageSize = 500) => {
    const response = await getRequest('receipts', { receiptStatus: 'Draft', page: 1, pageSize });
    return response.data;
  },

  // Open (unpaid / partial) bills to collect; params: customerCode, policyNumber, search
  getOpenReceivables: async (params = {}) => {
    const response = await getRequest('receipts/open-receivables', params);
    return response.data?.data || [];
  },

  // Get receipt by ID
  getReceiptById: async (receiptId) => {
    try {
      const response = await getRequest(`receipts/${receiptId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get receipt by receipt number
  getReceiptByNumber: async (receiptNumber) => {
    try {
      const response = await getRequest(`receipts/${receiptNumber}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Search receipts
  searchReceipts: async (searchParams) => {
    try {
      const queryParams = new URLSearchParams(searchParams).toString();
      const response = await getRequest(`receipts/search?${queryParams}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new receipt
  createReceipt: async (receiptData) => {
    try {
      const response = await postRequest('receipts', receiptData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update receipt
  updateReceipt: async (receiptId, receiptData) => {
    try {
      const response = await putRequest(`receipts/${receiptId}`, receiptData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // List receipts with any server-side filters (customerCode, name, receiptStatus, policyId, ...)
  filterReceipts: async ({ page = 1, pageSize = 10, ...filters } = {}) => {
    const queryParams = new URLSearchParams({ page, pageSize });
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, value);
      }
    });
    const response = await getRequest(`receipts?${queryParams.toString()}`);
    return response.data;
  },

  // Bulk print receipts
  bulkPrintReceipts: async (filters) => {
    try {
      // Manually construct query string to ensure proper formatting
      const queryString = Object.keys(filters)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(filters[key])}`)
        .join('&');
      
      const response = await getRequest(`receipts/printReceipt?${queryString}`);
      return response.data;
    } catch (error) {
      // If the error has response data, return it instead of throwing
      if (error.response && error.response.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  // Print single receipt
  printReceipt: async (printData) => {
    try {
      // Use the same endpoint as bulk print but with specific filters for single receipt
      const filters = {
        receiptId: printData.receiptId,
        customerCode: printData.customerCode
      };
      
      // Manually construct query string to ensure proper formatting
      const queryString = Object.keys(filters)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(filters[key])}`)
        .join('&');
      
      const response = await getRequest(`receipts/printReceipt?${queryString}`);
      return response.data;
    } catch (error) {
      // If the error has response data, return it instead of throwing
      if (error.response && error.response.data) {
        return error.response.data;
      }
      throw error;
    }
  },

  // Proof of payment of a receipt (an uploaded file): a remittance run on the fully paid basis needs it
  attachProof: async (receiptId, proof) => (await postRequest(`receipts/${encodeURIComponent(receiptId)}/proof`, proof)).data?.data,

  // Reversal of a receipt: asked with a reason, approved or returned by another user
  requestReversal: async (receiptId, reason) => (await postRequest(`receipts/${encodeURIComponent(receiptId)}/reversal`, reason)).data,
  decideReversal: async (receiptId, decision) => (await postRequest(`receipts/${encodeURIComponent(receiptId)}/reversal/decision`, decision)).data,

  // Unapplied collections (excess On Account, floating, advance): list, record, allocate, refund, reverse
  listUnapplied: async (params = {}) => (await getRequest('receipts/unapplied', params)).data?.data,
  getUnapplied: async (id) => (await getRequest(`receipts/unapplied/${encodeURIComponent(id)}`)).data?.data,
  recordUnapplied: async (payload) => (await postRequest('receipts/unapplied', payload)).data,
  allocateUnapplied: async (id, allocations) => (await postRequest(`receipts/unapplied/${encodeURIComponent(id)}/allocate`, { allocations })).data,
  refundUnapplied: async (id, reason) => (await postRequest(`receipts/unapplied/${encodeURIComponent(id)}/refund`, reason)).data,
  reverseUnapplied: async (id, reason) => (await postRequest(`receipts/unapplied/${encodeURIComponent(id)}/reverse`, reason)).data,

  // Receipt voucher batches (bulk uploads) and the commission part kept apart on each
  receiptBatches: async () => (await getRequest('receipts/batches')).data?.data || [],
  downloadBatchCommission: (batch, format = 'xlsx') => importService.downloadTemplate(`/receipts/batches/${encodeURIComponent(batch.id)}?format=${format}`,
    `${batch.kind === 'bank-payments' ? 'bank-payments' : 'commission'}-${batch.batchNumber}.${format}`),

  // Add payment to existing receipt
  addPaymentToReceipt: async (receiptId, paymentData) => {
    try {
      const response = await postRequest(`receipts/${receiptId}/add-payment`, paymentData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get receipt payment history (receiptsList entries)
  getReceiptPaymentHistory: async (receiptId) => {
    try {
      const response = await getRequest(`receipts/${receiptId}`);
      return {
        success: true,
        data: response.data?.data?.receiptsList || [],
        receipt: response.data?.data
      };
    } catch (error) {
      throw error;
    }
  }
};
