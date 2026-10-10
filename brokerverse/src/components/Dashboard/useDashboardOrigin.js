import { useCallback, useEffect, useState } from "react";
import dashboardService from "../../services/dashboardService";
import { currentUser } from "../../utility/userIdentity";

/** The business a dashboard counts: policies issued in BrokerVerse since go-live, or all business with the migrated policies. */
export const ORIGIN_VIEWS = ["issued", "all"];
const valid = (v) => (ORIGIN_VIEWS.includes(v) ? v : null);
const storageKey = () => `bv.dashboard.origin.${currentUser().userId || "anonymous"}`;

/** The user's choice kept in this browser, or null (nothing kept, or the browser blocks storage). */
export const readStoredOrigin = () => {
  try {
    return valid(localStorage.getItem(storageKey()));
  } catch {
    return null;
  }
};
const storeOrigin = (value) => {
  try {
    localStorage.setItem(storageKey(), value);
  } catch {
    // storage blocked: the choice holds for this visit only
  }
};

// the configured default is read once per session; every dashboard opened afterwards starts from it without a request
let defaultOrigin = null;
let pending = null;
const loadDefault = () => {
  if (defaultOrigin) return Promise.resolve(defaultOrigin);
  if (!pending) {
    pending = dashboardService.getSettings()
      .then((s) => { defaultOrigin = valid(s?.defaultOrigin) || "issued"; return defaultOrigin; })
      .catch(() => "issued")
      .finally(() => { pending = null; });
  }
  return pending;
};
/** Forget the default read from the server (tests, sign-out). */
export const resetDashboardOrigin = () => { defaultOrigin = null; pending = null; };

/**
 * The origin view of the dashboards ("issued" = Issued since go-live, "all" = All business): the user's last choice in
 * this browser, else the configured default (GET /dashboard/settings). `ready` is false until the view is known, so a
 * dashboard reads its figures once, in the right view.
 */
export const useDashboardOrigin = () => {
  const [origin, setState] = useState(() => readStoredOrigin() || defaultOrigin);
  useEffect(() => {
    if (origin) return undefined;
    let live = true;
    loadDefault().then((v) => { if (live) setState((cur) => cur || v); });
    return () => { live = false; };
  }, [origin]);
  const setOrigin = useCallback((value) => {
    const v = valid(value);
    if (!v) return;
    storeOrigin(v);
    setState(v);
  }, []);
  return { origin: origin || "issued", setOrigin, ready: Boolean(origin) };
};

export default useDashboardOrigin;
