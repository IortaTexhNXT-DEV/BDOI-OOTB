import { BASE_URL } from "../utility/constant";

/**
 * Authentication Service
 * Handles login API calls and localStorage token management
 */
class AuthService {
  constructor() {
    this.baseURL = BASE_URL;
    this.accessTokenKey = "accessToken";
    this.refreshTokenKey = "refreshToken";
    this.userKey = "user";
    this.tokenExpiryKey = "tokenExpiry";
  }

  /**
   * Store or retrieve device ID for session tracking
   * @returns {string} Device ID
   */
  storeDeviceId() {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      // Generate unique device ID
      deviceId = `device-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  }

  /**
   * Login user with username and password
   * @param {string} username - User's username
   * @param {string} password - User's password
   * @returns {Promise<Object>} Login response with tokens and user data
   */
  async login(username, password) {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced to 8 seconds

      console.log("Starting login API call...", this.baseURL);
      console.log("BASE_URL from constant:", BASE_URL);
      console.log(
        "Environment REACT_APP_BASE_URL:",
        process.env.REACT_APP_BASE_URL
      );
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const apiTime = performance.now() - startTime;
      console.log(`API call took ${apiTime.toFixed(2)}ms`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Login failed");
      }

      const data = await response.json();

      // Store tokens and user data in localStorage
      this.setTokens(data);
      this.setUser(data.user);

      const totalTime = performance.now() - startTime;
      console.log(`Total login process took ${totalTime.toFixed(2)}ms`);

      // Store deviceId for session tracking
      this.storeDeviceId();

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      const totalTime = performance.now() - startTime;
      console.error(`Login error after ${totalTime.toFixed(2)}ms:`, error);
      return {
        success: false,
        error:
          error.name === "AbortError"
            ? "Login timeout. Please try again."
            : error.message || "Login failed",
      };
    }
  }

  /**
   * Set tokens in localStorage
   * @param {Object} tokenData - Token data from API response
   */
  setTokens(tokenData) {
    localStorage.setItem(this.accessTokenKey, tokenData.accessToken);
    localStorage.setItem(this.refreshTokenKey, tokenData.refreshToken);

    // Calculate expiry time if expiresIn is provided
    if (tokenData.expiresIn) {
      const expiryTime = new Date().getTime() + tokenData.expiresIn * 1000;
      localStorage.setItem(this.tokenExpiryKey, expiryTime.toString());
    } else {
      // Set a default expiry of 24 hours if not provided
      const defaultExpiry = new Date().getTime() + 24 * 60 * 60 * 1000;
      localStorage.setItem(this.tokenExpiryKey, defaultExpiry.toString());
    }

    // Don't clear cache here - let the authentication check happen naturally
  }

  /**
   * Set user data in localStorage
   * @param {Object} user - User data from API response
   */
  setUser(user) {
    localStorage.setItem(this.userKey, JSON.stringify(user));

    // Also store individual user fields for easy access
    localStorage.setItem("USER_ROLE", user.roles.join(", ") || "user");
    localStorage.setItem("USER_ROLES", JSON.stringify(user.roles || ["user"]));
    localStorage.setItem("USER_NAME", user.displayName || "");
    localStorage.setItem("USER_EMAIL", user.email || "");
    localStorage.setItem(
      "USER_PERMISSIONS",
      JSON.stringify(user.permissions || [])
    );
    localStorage.setItem("USER_ID", user.userId || "");
    localStorage.setItem("USERNAME", user.username || "");

    // Don't clear cache here - let the authentication check happen naturally
  }

  /**
   * Clear authentication cache
   */
  clearAuthCache() {
    // This will be handled by the tokenManager
    if (typeof window !== "undefined" && window.clearAuthCache) {
      window.clearAuthCache();
    }
  }

  /**
   * Get access token from localStorage
   * @returns {string|null} Access token or null if not found
   */
  getAccessToken() {
    return localStorage.getItem(this.accessTokenKey);
  }

  /**
   * Get refresh token from localStorage
   * @returns {string|null} Refresh token or null if not found
   */
  getRefreshToken() {
    return localStorage.getItem(this.refreshTokenKey);
  }

  /**
   * Get user data from localStorage
   * @returns {Object|null} User data or null if not found
   */
  getUser() {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has valid token
   */
  isAuthenticated() {
    const token = this.getAccessToken();
    const expiry = localStorage.getItem(this.tokenExpiryKey);

    if (!token || !expiry) {
      return false;
    }

    // Check if token is expired
    const currentTime = new Date().getTime();
    const tokenExpiry = parseInt(expiry);

    return currentTime < tokenExpiry;
  }

  /**
   * Get authorization header for API requests
   * @returns {Object} Authorization header object
   */
  getAuthHeader() {
    const token = this.getAccessToken();
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
      };
    }
    return {};
  }

  /**
   * Logout user via API and clear localStorage
   */
  async logout() {
    try {
      const refreshToken = this.getRefreshToken();
      const deviceId = localStorage.getItem("deviceId");

      // Call logout API if refresh token exists
      if (refreshToken) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

          await fetch(`${this.baseURL}/auth/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.getAccessToken()}`,
            },
            body: JSON.stringify({
              refreshToken: refreshToken,
              deviceId: deviceId || undefined, // Send deviceId if available
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
        } catch (apiError) {
          console.warn("Logout API call failed:", apiError);
          // Continue with local logout even if API fails
        }
      }

      // Clear localStorage INCLUDING deviceId and individual user fields
      localStorage.removeItem(this.accessTokenKey);
      localStorage.removeItem(this.refreshTokenKey);
      localStorage.removeItem(this.userKey);
      localStorage.removeItem(this.tokenExpiryKey);
      localStorage.removeItem("deviceId");

      // Clear individual user fields
      localStorage.removeItem("USER_ROLE");
      localStorage.removeItem("USER_NAME");
      localStorage.removeItem("USER_EMAIL");
      localStorage.removeItem("USER_PERMISSIONS");
      localStorage.removeItem("USER_ID");
      localStorage.removeItem("USERNAME");

      // Clear auth cache
      this.clearAuthCache();

      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      // Even if there's an error, clear ALL local data
      localStorage.clear(); // Clear everything for clean logout
      this.clearAuthCache();
      return { success: false, error: error.message };
    }
  }

  /**
   * Get authorization header for API requests
   * @returns {Object} Authorization header object
   */
  getAuthHeader() {
    const token = this.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Refresh access token using refresh token
   * @returns {Promise<Object>} Refresh response
   */
  async refreshToken() {
    try {
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      this.setTokens(data);

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Token refresh error:", error);
      this.logout();
      return {
        success: false,
        error: error.message || "Token refresh failed",
      };
    }
  }

  /**
   * Check if token needs refresh (within 5 minutes of expiry)
   * @returns {boolean} True if token needs refresh
   */
  needsRefresh() {
    const expiry = localStorage.getItem(this.tokenExpiryKey);
    if (!expiry) return false;

    const currentTime = new Date().getTime();
    const tokenExpiry = parseInt(expiry);
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

    return tokenExpiry - currentTime < fiveMinutes;
  }
}

// Create and export a singleton instance
const authService = new AuthService();
export default authService;
