/**
 * Broker branding at runtime: loads GET /api/branding (public: the sign-in page uses it too), applies it to the page
 * (themeEngine.applyBranding) and keeps it current. The request is revalidated with the ETag (304 when nothing
 * changed) on every navigation (at most every 15 seconds), when the tab becomes visible again and every 5 minutes, so
 * a theme saved by an administrator reaches every signed-in user without a reload or a rebuild. `ready` turns true once
 * the first request has answered (or failed), so a screen can wait for it instead of painting the default look first.
 * What the first paint needs (CSS variables, layout attributes, favicon, browser tab title) is kept in this browser for
 * public/branding-boot.js, which applies it before the application loads.
 *
 *   const { branding, ready, refresh } = useBranding();
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { applyBranding } from "./themeEngine";
import { appTitle } from "../../utility/applySystemSettings";
import { fetchSystemSettings } from "../../module/SystemSettings/store/systemSettingsSlice";
import { getUserData, isAuthenticated } from "../../utility/tokenManager";
import "./branding.scss";

export const BRANDING_UPDATED_EVENT = "bv:branding-updated";
const MIN_INTERVAL_MS = 15000;
// a slow API does not hold the sign-in page back longer than this
const READY_TIMEOUT_MS = 4000;
const POLL_MS = 5 * 60 * 1000;
const apiBase = () => String(process.env.REACT_APP_BASE_URL || "/api").replace(/\/+$/, "");

const BrandingContext = createContext({ branding: null, ready: false, refresh: () => Promise.resolve(null) });

/** Key of the first-paint copy of the branding (read by public/branding-boot.js). */
export const BOOT_KEY = "bv.branding.boot";

/** Keep what the first paint needs for the next visit; storage unavailable (private window) only loses the head start. */
export function saveBootBranding(data, vars, root = document.documentElement) {
  try {
    const user = getUserData();
    const attrs = Object.fromEntries(["data-bv-density", "data-bv-header", "data-bv-sidebar", "data-bv-theme"].map((a) => [a, root.getAttribute(a)]).filter(([, v]) => v));
    window.localStorage.setItem(BOOT_KEY, JSON.stringify({ vars, attrs, faviconUrl: data.faviconUrl || "", title: appTitle(data.systemName, { authenticated: isAuthenticated(), userName: user?.displayName || user?.username }) }));
  } catch {
    // the next visit paints the default look until the branding arrives
  }
}

/** GET /api/branding through the browser cache (If-None-Match: a 304 costs no body). */
export async function fetchBranding(fetchImpl = typeof fetch !== "undefined" ? fetch : null) {
  if (!fetchImpl) return null;
  const res = await fetchImpl(`${apiBase()}/branding`, { cache: "no-cache", credentials: "omit", headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.data || null;
}

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(null);
  const [ready, setReady] = useState(false);
  const last = useRef({ at: 0, version: null });
  const location = useLocation();
  const dispatch = useDispatch();

  const apply = useCallback((data) => {
    if (!data) return;
    if (data.version && data.version === last.current.version) return;
    const changed = last.current.version !== null;
    last.current.version = data.version || null;
    saveBootBranding(data, applyBranding(data));
    setBranding(data);
    // the logo and the application name of the side bar come from System Settings: reload them when the branding changed
    if (changed) {
      const user = getUserData();
      dispatch(fetchSystemSettings({ authenticated: isAuthenticated(), userName: user?.displayName || user?.username || "User" }));
    }
  }, [dispatch]);

  const refresh = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - last.current.at < MIN_INTERVAL_MS) return null;
    last.current.at = now;
    try {
      const data = await fetchBranding();
      apply(data);
      return data;
    } catch {
      return null; // offline or API down: the current (or compiled default) look stays
    } finally {
      setReady(true);
    }
  }, [apply]);

  // first load, then on every navigation
  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const onUpdated = (e) => { if (e.detail) apply(e.detail); else refresh({ force: true }); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(BRANDING_UPDATED_EVENT, onUpdated);
    const timer = setInterval(() => refresh({ force: true }), POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(BRANDING_UPDATED_EVENT, onUpdated);
      clearInterval(timer);
    };
  }, [apply, refresh]);

  const value = useMemo(() => ({ branding, ready, refresh }), [branding, ready, refresh]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);

/** Tell the provider that the branding changed (after a save on the Theme and Branding screen). */
export const notifyBrandingUpdated = (data = null) => window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT, { detail: data }));
