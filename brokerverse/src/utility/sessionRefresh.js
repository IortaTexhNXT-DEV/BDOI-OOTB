/**
 * Session renewal for every API call.
 *
 * Most services call fetch() directly and several create their own axios instances, so a 401 used
 * to log the user out even though a valid refresh token was stored. This wraps window.fetch once:
 * when an API request (not an /auth/ call) returns 401, the refresh token is exchanged for a new
 * access token (one refresh at a time, shared by concurrent requests) and the request is retried
 * with the new token. If the refresh fails, the original 401 is returned and the existing
 * handlers log the user out as before. axios instances are covered by the interceptor in
 * utility/interceptor.js, which uses the same refresh function.
 */
import { BASE_URL } from "./constant";

let inFlight = null;

/** Keep the stored user in step with the token (roles and permissions change when an administrator edits them). */
const storeUser = (user) => {
  if (!user) return;
  try {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("USER_ROLE", (user.roles || []).join(", ") || "user");
    localStorage.setItem("USER_ROLES", JSON.stringify(user.roles || []));
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(user.permissions || []));
    if (user.displayName) localStorage.setItem("USER_NAME", user.displayName);
  } catch {
    /* storage unavailable */
  }
};

const nativeFetch = (...args) => (window.__bvNativeFetch || window.fetch)(...args);

const SESSION_KEYS = ["accessToken", "refreshToken", "user", "tokenExpiry", "USER_ROLE", "USER_ROLES", "USER_NAME", "USER_EMAIL", "USER_PERMISSIONS", "USER_ID", "USERNAME"];
/** Forget a session the server no longer accepts and return to the sign-in page. */
const endSession = () => {
  try {
    SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
  window.clearAuthCache?.();
  if (!window.location.pathname.startsWith("/login")) window.location.assign("/login?session=ended");
};

/**
 * Exchange the refresh token for a new access token (and a rotated refresh token). One refresh at a time per tab;
 * when another tab rotated the token first, its new token (already in localStorage) is used instead.
 */
export const refreshAccessToken = () => {
  if (inFlight) return inFlight;
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken || !BASE_URL) return Promise.resolve(null);
  inFlight = nativeFetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then((r) => (r.ok ? r.json() : { rejected: r.status === 401 }))
    .then((data) => {
      if (!data?.accessToken) {
        // another tab may have rotated the refresh token a moment ago: use the session it stored
        const current = localStorage.getItem("refreshToken");
        if (current && current !== refreshToken) return localStorage.getItem("accessToken");
        // the session was ended on the server (password changed or reset, account deactivated, token reuse)
        if (data?.rejected) endSession();
        return null;
      }
      localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      if (data.expiresIn) {
        localStorage.setItem("tokenExpiry", String(Date.now() + data.expiresIn * 1000));
      }
      storeUser(data.user);
      window.clearAuthCache?.();
      return data.accessToken;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};

/**
 * Renew the access token shortly before it expires while the application is open, so uploads (XMLHttpRequest) and
 * links opened in new tabs never meet an expired token. Signing out after inactivity is the idle timer's job.
 */
const RENEW_BEFORE_MS = 2 * 60 * 1000;
export const startTokenRenewal = () => {
  if (typeof window === "undefined" || window.__bvRenewalTimer) return;
  window.__bvRenewalTimer = window.setInterval(() => {
    const expiry = Number(localStorage.getItem("tokenExpiry") || 0);
    if (localStorage.getItem("refreshToken") && expiry && expiry - Date.now() < RENEW_BEFORE_MS) refreshAccessToken();
  }, 30 * 1000);
};

// Credential endpoints answer 401 for wrong input, not for an expired session: never retried.
const CREDENTIAL_CALL = /\/auth\/(login|refresh|logout|forgot-password|reset-password|password-policy)(\/|\?|$)/;
const isApiCall = (url) => BASE_URL && typeof url === "string" && url.startsWith(BASE_URL) && !CREDENTIAL_CALL.test(url);

const withToken = (init, token) => {
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
};

if (typeof window !== "undefined" && window.fetch && !window.__bvNativeFetch) {
  window.__bvNativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await window.__bvNativeFetch(input, init);
    const url = typeof input === "string" ? input : input?.url;
    if (response.status !== 401 || !isApiCall(url) || init?.__bvRetried) return response;
    const token = await refreshAccessToken();
    if (!token) return response;
    return window.__bvNativeFetch(input, { ...withToken(init, token), __bvRetried: true });
  };
}

startTokenRenewal();
