import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "./mastersService";

/**
 * User Service
 * Handles user-related API calls
 */
class UserService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  /**
   * Get all users with pagination
   * @param {Object} params - Query parameters (page, limit, search, sortBy, sortOrder)
   * @returns {Promise<Object>} API response with users and pagination
   */
  async getUsers(params = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = params;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const queryParams = new URLSearchParams();
      queryParams.append("page", page);
      queryParams.append("limit", limit);
      if (search) queryParams.append("search", search);
      if (sortBy) queryParams.append("sortBy", sortBy);
      if (sortOrder) queryParams.append("sortOrder", sortOrder);

      const url = `${this.baseURL}/users?${queryParams.toString()}`;

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch users");
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || [],
        pagination: data.pagination || {},
      };
    } catch (error) {
      console.error("Get users error:", error);
      return {
        success: false,
        error: error.name === "AbortError" ? "Request timeout" : error.message,
        data: [],
        pagination: {},
      };
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} API response
   */
  async getUserById(userId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/users/${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch user");
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get user by ID error:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch user",
        data: null,
      };
    }
  }

  /**
   * Create new user
   * @param {Object} userData - User data to create
   * @returns {Promise<Object>} API response
   */
  async createUser(userData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(userData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(apiErrorMessage(errorData, response.status));
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Create user error:", error);
      return {
        success: false,
        error: error.message || "Failed to create user",
      };
    }
  }

  /**
   * Update user
   * @param {string} userId - User ID
   * @param {Object} userData - Updated user data
   * @returns {Promise<Object>} API response
   */
  async updateUser(userId, userData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(userData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(apiErrorMessage(errorData, response.status));
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Update user error:", error);
      return {
        success: false,
        error: error.message || "Failed to update user",
      };
    }
  }

  /**
   * Delete user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} API response
   */
  async deleteUser(userId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete user");
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Delete user error:", error);
      return {
        success: false,
        error: error.message || "Failed to delete user",
      };
    }
  }

  /**
   * Update user password
   * @param {string} userId - User ID
   * @param {string} password - New password
   * @returns {Promise<Object>} API response
   */
  async updatePassword(userId, password) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/users/${userId}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update password");
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Update password error:", error);
      return {
        success: false,
        error: error.message || "Failed to update password",
      };
    }
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} API response
   */
  async getUserStats() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/users/stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch user stats");
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get user stats error:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch user stats",
        data: {},
      };
    }
  }

  /** JSON request that throws the API error message on failure (roles endpoints). */
  async request(path, { method = "GET", body } = {}) {
    const response = await fetch(`${this.baseURL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authService.getAuthHeader(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) throw new Error(apiErrorMessage(json, response.status));
    return json.data;
  }

  /** Roles with their permission codes and user counts (GET /roles). */
  getRoles() {
    return this.request("/roles");
  }

  /** All permission codes grouped by module (GET /roles/permissions). */
  getPermissions() {
    return this.request("/roles/permissions");
  }

  /** Create a role: { code, name, description, permissions[], status }. */
  createRole(role) {
    return this.request("/roles", { method: "POST", body: role });
  }

  /** Update a role (partial): { name, description, permissions[], status }. */
  updateRole(id, role) {
    return this.request(`/roles/${encodeURIComponent(id)}`, { method: "PUT", body: role });
  }

  /** Delete a non-system role that has no users. */
  deleteRole(id) {
    return this.request(`/roles/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  /** Activate / deactivate / unlock a user (PATCH /users/:id/status). */
  setUserStatus(userId, status) {
    return this.request(`/users/${encodeURIComponent(userId)}/status`, { method: "PATCH", body: { status } });
  }
}

const userService = new UserService();
export default userService;
