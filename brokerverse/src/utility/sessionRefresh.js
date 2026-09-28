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

export const refreshAccessToken = () => {
  if (inFlight) return inFlight;
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken || !BASE_URL) return Promise.resolve(null);
  inFlight = window.__bvNativeFetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data?.accessToken) return null;
      localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      if (data.expiresIn) {
        localStorage.setItem("tokenExpiry", String(Date.now() + data.expiresIn * 1000));
      }
      return data.accessToken;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};

const isApiCall = (url) => BASE_URL && typeof url === "string" && url.startsWith(BASE_URL) && !url.includes("/auth/");

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
