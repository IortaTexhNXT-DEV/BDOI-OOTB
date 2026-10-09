/**
 * Broker branding at runtime: loads GET /api/branding (public: the sign-in page uses it too), applies it to the page
 * (themeEngine.applyBranding) and keeps it current. The request is revalidated with the ETag (304 when nothing
 * changed) on every navigation (at most every 15 seconds), when the tab becomes visible again and every 5 minutes, so
 * a theme saved by an administrator reaches every signed-in user without a reload or a rebuild.
 *
 * No screen is drawn in a look that is not the environment's: the last branding this browser received is kept (with
 * what the first paint needs: CSS variables, layout attributes, favicon, tab title, applied by public/branding-boot.js
 * before the application loads) and used at once on the next load; without it (first visit) only a neutral page is
 * shown until GET /api/branding answers. `ready` says the branding is known.
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
// an API that does not answer does not hold the application back longer than this
const READY_TIMEOUT_MS = 8000;
const POLL_MS = 5 * 60 * 1000;
const apiBase = () => String(process.env.REACT_APP_BASE_URL || "/api").replace(/\/+$/, "");

const BrandingContext = createContext({ branding: null, ready: false, refresh: () => Promise.resolve(null) });

/** Key of the first-paint copy of the branding (read by public/branding-boot.js). */
export const BOOT_KEY = "bv.branding.boot";

/** Keep the branding for the next load; storage unavailable (private window) only means waiting for the API next time. */
export function saveBootBranding(data, vars, root = document.documentElement) {
  try {
    const user = getUserData();
    const attrs = Object.fromEntries(["data-bv-density", "data-bv-header", "data-bv-sidebar", "data-bv-theme"].map((a) => [a, root.getAttribute(a)]).filter(([, v]) => v));
    window.localStorage.setItem(BOOT_KEY, JSON.stringify({ vars, attrs, faviconUrl: data.faviconUrl || "", title: appTitle(data.systemName, { authenticated: isAuthenticated(), userName: user?.displayName || user?.username }), branding: data }));
  } catch {
    // the next load waits for the branding behind the neutral page
  }
}

/** The branding kept by the last load of this browser, or null. */
export function cachedBranding() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(BOOT_KEY) || "null");
    return saved?.branding && typeof saved.branding === "object" && saved.branding.theme ? saved.branding : null;
  } catch {
    return null;
  }
}

/** What is shown while the branding is not known yet: a plain page, no logo, no name, no brand colour. */
export const BrandingPending = () => <div className="bv-branding-pending" role="status" aria-busy="true" aria-label="Loading" />;

/** GET /api/branding through the browser cache (If-None-Match: a 304 costs no body). */
export async function fetchBranding(fetchImpl = typeof fetch !== "undefined" ? fetch : null) {
  if (!fetchImpl) return null;
  const res = await fetchImpl(`${apiBase()}/branding`, { cache: "no-cache", credentials: "omit", headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.data || null;
}

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(cachedBranding);
  const [ready, setReady] = useState(() => branding !== null);
  const last = useRef({ at: 0, version: branding?.version || null });
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

  // the kept branding also brings its font and favicon (public/branding-boot.js set the colours already)
  useEffect(() => {
    if (last.current.version) applyBranding(branding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  return <BrandingContext.Provider value={value}>{ready ? children : <BrandingPending />}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);

/** Tell the provider that the branding changed (after a save on the Theme and Branding screen). */
export const notifyBrandingUpdated = (data = null) => window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT, { detail: data }));
