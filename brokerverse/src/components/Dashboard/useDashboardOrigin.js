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
let settings = null;
let pending = null;
const loadSettings = () => {
  if (settings) return Promise.resolve(settings);
  if (!pending) {
    pending = dashboardService.getSettings()
      .then((s) => {
        // the server resolves "auto" (the delivered default): All business until a policy is issued after go-live
        defaultOrigin = valid(s?.defaultOrigin) || "all";
        settings = { cutoverDate: s?.cutoverDate || null, issuedPolicies: s?.issuedPolicies ?? null };
        return settings;
      })
      // settings unreadable: All business, the view that is never empty when there is any business at all
      .catch(() => { defaultOrigin = defaultOrigin || "all"; return { cutoverDate: null, issuedPolicies: null }; })
      .finally(() => { pending = null; });
  }
  return pending;
};
const loadDefault = () => (defaultOrigin ? Promise.resolve(defaultOrigin) : loadSettings().then(() => defaultOrigin || "all"));
/** Forget the default read from the server (tests, sign-out). */
export const resetDashboardOrigin = () => { defaultOrigin = null; settings = null; pending = null; };

/**
 * The origin view of the dashboards ("issued" = Issued since go-live, "all" = All business): the user's last choice in
 * this browser, else the configured default (GET /dashboard/settings; "auto", the delivered default, opens on All
 * business until a policy is issued after go-live). `ready` is false until the view is known, so a dashboard reads its
 * figures once, in the right view. `cutoverDate` (null until known or when not set) names the go-live date in the empty
 * state of the issued view.
 */
export const useDashboardOrigin = () => {
  const [origin, setState] = useState(() => readStoredOrigin() || defaultOrigin);
  const [info, setInfo] = useState(settings);
  useEffect(() => {
    if (origin) return undefined;
    let live = true;
    loadDefault().then((v) => { if (live) setState((cur) => cur || v); });
    return () => { live = false; };
  }, [origin]);
  // the cutover date, for the empty state of the issued view (read once per session, never delays the figures)
  useEffect(() => {
    if (info || origin !== "issued") return undefined;
    let live = true;
    loadSettings().then((s) => { if (live) setInfo(s); });
    return () => { live = false; };
  }, [info, origin]);
  const setOrigin = useCallback((value) => {
    const v = valid(value);
    if (!v) return;
    storeOrigin(v);
    setState(v);
  }, []);
  return { origin: origin || "all", setOrigin, ready: Boolean(origin), cutoverDate: info?.cutoverDate || null };
};

export default useDashboardOrigin;
