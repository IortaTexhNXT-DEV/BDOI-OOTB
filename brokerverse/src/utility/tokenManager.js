/**
 * Token Manager Utility
 * Provides utility functions for token management and localStorage operations
 */

/**
 * Token storage keys
 */
export const TOKEN_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  USER_DATA: "user",
  TOKEN_EXPIRY: "tokenExpiry",
  USER_ROLE: "USER_ROLE",
  USER_NAME: "USER_NAME",
};

/**
 * Get item from localStorage with error handling
 * @param {string} key - Storage key
 * @returns {string|null} Stored value or null
 */
export const getStorageItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Error getting item from localStorage: ${key}`, error);
    return null;
  }
};

/**
 * Set item in localStorage with error handling
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 * @returns {boolean} Success status
 */
export const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Error setting item in localStorage: ${key}`, error);
    return false;
  }
};

/**
 * Remove item from localStorage with error handling
 * @param {string} key - Storage key
 * @returns {boolean} Success status
 */
export const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing item from localStorage: ${key}`, error);
    return false;
  }
};

/**
 * Clear all authentication data from localStorage
 */
export const clearAuthData = () => {
  const keysToRemove = [
    TOKEN_KEYS.ACCESS_TOKEN,
    TOKEN_KEYS.REFRESH_TOKEN,
    TOKEN_KEYS.USER_DATA,
    TOKEN_KEYS.TOKEN_EXPIRY,
    TOKEN_KEYS.USER_ROLE,
    TOKEN_KEYS.USER_NAME,
  ];

  keysToRemove.forEach((key) => removeStorageItem(key));

  // Clear auth cache
  authCache = null;
  authCacheTime = 0;
};

/**
 * Check if token is expired
 * @param {string} expiryTime - Token expiry time as string
 * @returns {boolean} True if token is expired
 */
export const isTokenExpired = (expiryTime) => {
  if (!expiryTime) return true;

  try {
    const currentTime = new Date().getTime();
    const tokenExpiry = parseInt(expiryTime);
    return currentTime >= tokenExpiry;
  } catch (error) {
    console.error("Error checking token expiry:", error);
    return true;
  }
};

/**
 * Get token expiry time
 * @returns {string|null} Token expiry time or null
 */
export const getTokenExpiry = () => {
  return getStorageItem(TOKEN_KEYS.TOKEN_EXPIRY);
};

// Cache authentication status to prevent repeated checks
let authCache = null;
let authCacheTime = 0;
const CACHE_DURATION = 1000; // 1 second cache

// Global function to clear auth cache
if (typeof window !== "undefined") {
  window.clearAuthCache = () => {
    authCache = null;
    authCacheTime = 0;
  };
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has valid token
 */
export const isAuthenticated = () => {
  const now = Date.now();

  // Return cached result if still valid
  if (authCache !== null && now - authCacheTime < CACHE_DURATION) {
    return authCache;
  }

  const token = getStorageItem(TOKEN_KEYS.ACCESS_TOKEN);
  const expiry = getTokenExpiry();

  let isValid = false;

  // If we have a token, check if it's expired (if expiry exists)
  if (token) {
    if (getStorageItem(TOKEN_KEYS.REFRESH_TOKEN)) {
      // Access tokens are short-lived (30 minutes by default); with a refresh token the session continues and the
      // next API call (or the renewal timer in sessionRefresh.js) renews the access token.
      isValid = true;
    } else if (expiry) {
      isValid = !isTokenExpired(expiry);
    } else {
      // If no expiry is set, assume token is valid
      isValid = true;
    }
  }

  // Cache the result
  authCache = isValid;
  authCacheTime = now;

  return isValid;
};

/**
 * Get user data from localStorage
 * @returns {Object|null} User data or null
 */
export const getUserData = () => {
  const userData = getStorageItem(TOKEN_KEYS.USER_DATA);
  if (!userData) return null;

  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error("Error parsing user data:", error);
    return null;
  }
};

/**
 * Get access token from localStorage
 * @returns {string|null} Access token or null
 */
export const getAccessToken = () => {
  return getStorageItem(TOKEN_KEYS.ACCESS_TOKEN);
};

/**
 * Get refresh token from localStorage
 * @returns {string|null} Refresh token or null
 */
export const getRefreshToken = () => {
  return getStorageItem(TOKEN_KEYS.REFRESH_TOKEN);
};

/**
 * Set authentication data in localStorage
 * @param {Object} authData - Authentication data
 */
export const setAuthData = (authData) => {
  const { accessToken, refreshToken, user, expiresIn } = authData;

  // Set tokens
  setStorageItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
  setStorageItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);

  // Set user data
  setStorageItem(TOKEN_KEYS.USER_DATA, JSON.stringify(user));

  // Set user role and name for compatibility
  setStorageItem(TOKEN_KEYS.USER_ROLE, user.roles?.join(", ") || "user");
  setStorageItem(TOKEN_KEYS.USER_NAME, user.displayName || user.username);

  // Calculate and set expiry time
  if (expiresIn) {
    const expiryTime = new Date().getTime() + expiresIn * 1000;
    setStorageItem(TOKEN_KEYS.TOKEN_EXPIRY, expiryTime.toString());
  }

  // Clear auth cache to force re-check
  authCache = null;
  authCacheTime = 0;
};

/**
 * Get authorization header for API requests
 * @returns {Object} Authorization header object
 */
export const getAuthHeader = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Check if token needs refresh (within 5 minutes of expiry)
 * @returns {boolean} True if token needs refresh
 */
export const needsTokenRefresh = () => {
  const expiry = getTokenExpiry();
  if (!expiry) return false;

  const currentTime = new Date().getTime();
  const tokenExpiry = parseInt(expiry);
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

  return tokenExpiry - currentTime < fiveMinutes;
};
