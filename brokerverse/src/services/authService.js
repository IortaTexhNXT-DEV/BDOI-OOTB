import { BASE_URL } from "../utility/constant";
import { refreshAccessToken } from "../utility/sessionRefresh";
import logger from "../utility/logger";

const SSO_TRANSACTION_KEY = "bvSsoTransaction";

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
    try {
      const data = await this.authCall("/auth/login", {
        body: { username, password, deviceId: this.storeDeviceId() },
        timeout: 15000,
      });
      return this.signInStep(data);
    } catch (error) {
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
   * Classify a sign-in answer. Only a full session (access + refresh token) is stored; the intermediate steps
   * (two-factor code, forced two-factor enrolment, required password change) keep their short-lived token in the
   * screen's memory and never reach localStorage.
   * @returns {{ success: true, step: "done"|"twoFactor"|"enrol2fa"|"changePassword", data: Object }}
   */
  signInStep(data) {
    if (data?.twoFactorRequired) return { success: true, step: "twoFactor", data };
    if (data?.twoFactorSetupRequired) return { success: true, step: "enrol2fa", data };
    if (data?.passwordChangeRequired) return { success: true, step: "changePassword", data };
    this.startSession(data);
    return { success: true, step: "done", data };
  }

  /** Store a full sign-in payload (tokens and user). */
  startSession(data) {
    if (!data?.accessToken || !data?.refreshToken) throw new Error("Sign-in did not return a session");
    this.setTokens(data);
    if (data.user) this.setUser(data.user);
    this.storeDeviceId();
    this.clearAuthCache();
  }

  /**
   * JSON call to an /auth endpoint. `token` is sent as the bearer (a restricted sign-in token or the session's).
   * Throws an Error with the API message (and .status, .errors) on failure.
   */
  async authCall(path, { method = "POST", body, token, timeout = 10000 } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${this.baseURL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        // never retried with the stored session token (the bearer may be a restricted sign-in token)
        __bvRetried: true,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.message || `Request failed (${response.status})`);
        error.status = response.status;
        error.errors = data.errors;
        error.retryAfter = data.retryAfter;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Second sign-in step: the 6-digit authenticator code. */
  async verifyTwoFactor(challengeToken, code) {
    const data = await this.authCall("/auth/login/2fa", {
      body: { challengeToken, code: String(code).trim(), deviceId: this.storeDeviceId() },
    });
    return this.signInStep(data);
  }

  /** Sign-in methods of this environment: { passwordSignIn, sso: { enabled, provider } }. */
  async signInOptions() {
    const data = await this.authCall("/auth/options", { method: "GET" });
    return data.data || {};
  }

  /**
   * "Sign in with Microsoft": go to the Microsoft sign-in page. The transaction token of this sign-in waits in
   * sessionStorage (this tab only) until Microsoft sends the browser back to /login with the code.
   */
  async startMicrosoftSignIn() {
    const data = await this.authCall("/auth/sso/start", { body: { deviceId: this.storeDeviceId() } });
    sessionStorage.setItem(SSO_TRANSACTION_KEY, data.data.transaction);
    window.location.assign(data.data.authorizationUrl);
  }

  /** Back from Microsoft with ?code=&state=: the API verifies the sign-in and answers like the password sign-in. */
  async completeMicrosoftSignIn(code, state) {
    const transaction = sessionStorage.getItem(SSO_TRANSACTION_KEY);
    sessionStorage.removeItem(SSO_TRANSACTION_KEY);
    if (!transaction) throw new Error("The Microsoft sign-in was interrupted; sign in again");
    const data = await this.authCall("/auth/sso/callback", {
      body: { code, state, transaction, deviceId: this.storeDeviceId() },
      timeout: 20000,
    });
    return this.signInStep(data);
  }

  /** Password rules from System Settings (minLength, requireUpper/Lower/Digit/Symbol, historyCount, maxAgeDays). */
  async getPasswordPolicy() {
    const data = await this.authCall("/auth/password-policy", { method: "GET" });
    return data.data || {};
  }

  /**
   * Change the password. With `token` (the restricted token of a sign-in that requires a new password) the answer
   * completes the sign-in; in a normal session the server ends the other sessions and returns new tokens.
   */
  async changePassword({ currentPassword, newPassword }, token) {
    const bearer = token || (await this.freshAccessToken());
    const data = await this.authCall("/auth/change-password", {
      body: { currentPassword, newPassword, deviceId: this.storeDeviceId() },
      token: bearer,
    });
    if (token) return this.signInStep(data);
    if (data.accessToken && data.refreshToken) this.startSession(data);
    return { success: true, step: "done", data };
  }

  /** Forgot password: ask for a reset code by username or e-mail (the answer never says whether the account exists). */
  async requestPasswordReset(usernameOrEmail) {
    const value = String(usernameOrEmail || "").trim();
    return this.authCall("/auth/forgot-password", { body: value.includes("@") ? { email: value } : { username: value } });
  }

  /** Reset the password with the e-mailed code. */
  async resetPassword({ usernameOrEmail, code, newPassword }) {
    const value = String(usernameOrEmail || "").trim();
    return this.authCall("/auth/reset-password", {
      body: { ...(value.includes("@") ? { email: value } : { username: value }), code: String(code).trim(), newPassword },
    });
  }

  /** Two-factor authentication of the signed-in user (or of a restricted enrolment token). */
  async twoFactorStatus(token) {
    return (await this.authCall("/auth/2fa/status", { method: "GET", token: token || (await this.freshAccessToken()) })).data || {};
  }

  async twoFactorSetup(token) {
    return (await this.authCall("/auth/2fa/setup", { token: token || (await this.freshAccessToken()) })).data || {};
  }

  /** Confirm enrolment. After a forced enrolment (restricted token) the answer continues the sign-in. */
  async twoFactorEnable(code, token) {
    const data = await this.authCall("/auth/2fa/enable", { body: { code: String(code).trim() }, token: token || (await this.freshAccessToken()) });
    if (token) return this.signInStep(data);
    return { success: true, step: "done", data };
  }

  async twoFactorDisable(code) {
    return this.authCall("/auth/2fa/disable", { body: { code: String(code).trim() }, token: await this.freshAccessToken() });
  }

  /** The session's access token, renewed first when it is about to expire (/auth calls bypass the 401 retry). */
  async freshAccessToken() {
    if (this.needsRefresh() && this.getRefreshToken()) await refreshAccessToken();
    return this.getAccessToken();
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

    // Access tokens are short-lived; with a refresh token the session continues (the next API call renews it).
    if (this.getRefreshToken()) return true;
    const currentTime = new Date().getTime();
    const tokenExpiry = parseInt(expiry);

    return currentTime < tokenExpiry;
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
          logger.warn("Logout API call failed:", apiError);
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
