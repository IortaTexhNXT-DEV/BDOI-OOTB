import { BASE_URL } from '../utility/constant';
import authService from './authService';

/**
 * Client Service
 * Handles client-related API calls
 */
class ClientService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Get all clients with pagination
   * @param {Number} page - Page number (default: 1)
   * @param {Number} pageSize - Items per page (default: 10)
   * @returns {Promise<Object>} API response with data, page, pageSize, total
   */
  /**
   * Clients matching a name, client code, mobile number or e-mail (first 10), for picking an existing customer.
   * @param {string} term - Text to search for
   * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
   */
  async searchClients(term) {
    try {
      const response = await fetch(`${this.baseURL}/clients?search=${encodeURIComponent(term)}&page=1&pageSize=10`, {
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Failed to search clients');
      const list = body.data?.clients || body.clients || [];
      return { success: true, data: list.map((c) => ({ ...c, displayName: c.displayName || c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName })) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getClients(page = 1, pageSize = 10, filters = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      // server-side search (name, client code, e-mail, phone) and client type (individual / corporate)
      Object.entries(filters || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") query.append(k, v); });

      const response = await fetch(`${this.baseURL}/clients?${query.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch clients');
      }

      const data = await response.json();
      
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to fetch clients'),
      };
    }
  }

  /**
   * Get customer codes for dropdown
   * @returns {Promise<Object>} API response with customer codes
   */
  async getCustomerCodes() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/customers/codes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch customer codes');
      }

      const data = await response.json();
      
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to fetch customer codes'),
      };
    }
  }

  /**
   * Get client by ID
   * @param {String} clientId - Client ID
   * @returns {Promise<Object>} API response with client data
   */
  async getClientById(clientId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/clients/${clientId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch client');
      }

      const data = await response.json();
      
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to fetch client'),
      };
    }
  }

  /**
   * Create client (with Thailand address fields: roadThanon, soiAlley, mooVillage)
   * @param {Object} clientData - Client data
   * @returns {Promise<Object>} API response with clientId
   */
  async createClient(clientData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify(clientData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to create client');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to create client'),
      };
    }
  }

  /**
   * Update client (supports Thailand address fields: roadThanon, soiAlley, mooVillage)
   * @param {String} clientId - Client ID
   * @param {Object} clientData - Updated client data
   * @returns {Promise<Object>} API response
   */
  async updateClient(clientId, clientData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify(clientData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to update client');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to update client'),
      };
    }
  }
}

// Create and export a singleton instance
const clientService = new ClientService();
export default clientService;

