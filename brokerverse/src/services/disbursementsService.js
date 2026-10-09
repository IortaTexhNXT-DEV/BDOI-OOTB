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
      return {
        success: false,
        error: error.message || 'Failed to fetch disbursements',
      };
    }
  },
};

export { disbursementsService };
