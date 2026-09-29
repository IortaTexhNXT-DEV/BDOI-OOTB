import axios from "axios";
import { getAccessToken } from "../utility/tokenManager";
import { BASE_URL } from "../utility/constant";

const API_BASE_URL = BASE_URL;

class NotificationService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log("Notification API: Token found and added to headers");
        } else {
          console.warn("Notification API: No access token found");
        }
        return config;
      },
      (error) => {
        return Promise.reject(new Error(error.message || "Request failed"));
      }
    );

    // Add response interceptor to handle authentication errors
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          console.error(
            "Notification API: Authentication failed - token may be invalid or expired"
          );
          // Optionally redirect to login or refresh token
        }
        return Promise.reject(new Error(error.message || "Response failed"));
      }
    );
  }

  /**
   * Get all notifications for the current user
   * @param {Object} params - Query parameters (page, pageSize, type, isRead)
   * @returns {Promise<Object>} - Notifications data with pagination
   */
  async getNotifications(params = {}) {
    try {
      const response = await this.api.get("/notifications", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching notifications:", error);
      console.error("Error response:", error.response?.data);

      // Handle different error types
      if (error.response?.status === 500) {
        throw new Error(
          "Server error: Unable to load notifications. Please try again later."
        );
      } else if (error.response?.status === 401) {
        throw new Error("Authentication failed. Please log in again.");
      } else if (error.response?.status === 403) {
        throw new Error(
          "Access denied. You don't have permission to view notifications."
        );
      } else if (error.response?.status === 404) {
        throw new Error(
          "Notifications endpoint not found. Please contact support."
        );
      } else {
        throw new Error(error.message || "Failed to fetch notifications");
      }
    }
  }

  /**
   * Mark a single notification as read
   * @param {string} notificationId - The notification ID
   * @returns {Promise<Object>} - Updated notification data
   */
  async markNotificationAsRead(notificationId) {
    try {
      const response = await this.api.put(
        `/notifications/${notificationId}/read`
      );
      return response.data;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      console.error("Error response:", error.response?.data);
      throw new Error(error.message || "Failed to mark notification as read");
    }
  }

  /**
   * Mark multiple notifications as read
   * @param {Array<string>} notificationIds - Array of notification IDs
   * @returns {Promise<Object>} - Bulk update result
   */
  async markNotificationsAsRead(notificationIds) {
    try {
      const response = await this.api.put("/notifications/read", {
        notificationIds,
      });
      return response.data;
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      throw new Error(error.message || "Failed to mark notifications as read");
    }
  }

  /**
   * Mark all notifications as read
   * @returns {Promise<Object>} - Bulk update result
   */
  async markAllNotificationsAsRead() {
    try {
      const response = await this.api.put("/notifications/read-all");
      return response.data;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw new Error(
        error.message || "Failed to mark all notifications as read"
      );
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - The notification ID
   * @returns {Promise<Object>} - Delete result
   */
  async deleteNotification(notificationId) {
    try {
      const response = await this.api.delete(
        `/notifications/${notificationId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw new Error(error.message || "Failed to delete notification");
    }
  }

  /**
   * Delete multiple notifications
   * @param {Array<string>} notificationIds - Array of notification IDs
   * @returns {Promise<Object>} - Bulk delete result
   */
  async deleteNotifications(notificationIds) {
    try {
      const response = await this.api.delete("/notifications", {
        data: { notificationIds },
      });
      return response.data;
    } catch (error) {
      console.error("Error deleting notifications:", error);
      throw new Error(error.message || "Failed to delete notifications");
    }
  }

  /**
   * Get notification statistics
   * @returns {Promise<Object>} - Notification stats
   */
  async getNotificationStats() {
    try {
      const response = await this.api.get("/notifications/stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching notification stats:", error);
      throw new Error(error.message || "Failed to fetch notification stats");
    }
  }

  /**
   * Get unread notification count
   * @returns {Promise<number>} - Unread count
   */
  async getUnreadCount() {
    try {
      const response = await this.api.get("/notifications/unread-count");
      return response.data.unreadCount;
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return 0;
    }
  }
}

export default new NotificationService();
