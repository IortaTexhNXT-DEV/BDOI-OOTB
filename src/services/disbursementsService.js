import { BASE_URL } from "../utility/constant";
import { getAccessToken } from "../utility/tokenManager";

const disbursementsService = {
  // Get disbursements list
  getDisbursements: async (page = 1, pageSize = 10) => {
    try {
      const token = getAccessToken();
      const headers = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}/disbursements?page=${page}&pageSize=${pageSize}`, {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('Get disbursements error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch disbursements',
      };
    }
  },

  // Bulk upload disbursements
  bulkUploadDisbursements: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAccessToken();
      const headers = {};
      
      console.log('Disbursements bulk upload - Token:', token ? 'Present' : 'Missing');
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('Disbursements bulk upload - Authorization header set');
      } else {
        console.warn('Disbursements bulk upload - No access token found');
      }

      const response = await fetch(`${BASE_URL}/disbursements/bulk-upload`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload disbursements file');
      }

      const data = await response.json();
      console.log('Disbursements bulk upload completed:', data);
      
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('Bulk upload disbursements error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload disbursements file',
      };
    }
  },
};

export { disbursementsService };
