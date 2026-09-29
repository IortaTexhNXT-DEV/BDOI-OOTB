import { BASE_URL } from '../utility/constant';
import authService from './authService';

class EndorsementService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  getAuthHeader() {
    return authService.getAuthHeader();
  }

  async createEndorsement(payload) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/endorsements/create-endorsement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to create endorsement (status ${response.status})`
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
          error.name === 'AbortError'
            ? 'Request timeout. Please try again.'
            : error.message || 'Failed to create endorsement',
      };
    }
  }

  async getEndorsementById(endorsementId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/endorsements/${endorsementId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to fetch endorsement (status ${response.status})`
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
          error.name === 'AbortError'
            ? 'Request timeout. Please try again.'
            : error.message || 'Failed to fetch endorsement',
      };
    }
  }

  async uploadEndorsementDocument(endorsementId, file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('endorsementId', endorsementId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${this.baseURL}/endorsements/upload-document`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeader(),
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed (status ${response.status})`);
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
          error.name === 'AbortError'
            ? 'Upload timeout. Please try again.'
            : error.message || 'Failed to upload document',
      };
    }
  }

  async completeEndorsement(payload) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/endorsements/complete-endorsement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to complete endorsement (status ${response.status})`
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
          error.name === 'AbortError'
            ? 'Request timeout. Please try again.'
            : error.message || 'Failed to complete endorsement',
      };
    }
  }

  async getEndorsements({ clientId, policyId, page = 1, perPage = 50 } = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const params = new URLSearchParams({
        pageNo: page.toString(),
        perPage: perPage.toString(),
      });

      if (clientId) params.append('clientId', clientId);
      if (policyId) params.append('policyId', policyId);

      const response = await fetch(
        `${this.baseURL}/endorsements/get-All-Endorsements?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeader(),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to fetch endorsements (status ${response.status})`
        );
      }

      const data = await response.json();
      const payload = data?.data ?? data ?? {};

      const items = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.endorsements)
        ? payload.endorsements
        : Array.isArray(data.items)
        ? data.items
        : [];

      return {
        success: true,
        data: items,
        pagination: payload.pagination || data.pagination || {
          page,
          perPage,
          total: items.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error.name === 'AbortError'
            ? 'Request timeout. Please try again.'
            : error.message || 'Failed to fetch endorsements',
      };
    }
  }
}

export default new EndorsementService();
