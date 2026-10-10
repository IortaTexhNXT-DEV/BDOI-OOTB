/**
 * Feature entitlements on the screen side: which functions of the platform this environment runs (backend
 * modules/features, GET /api/features/state). The server is the control (its API answers 403 FEATURE_NOT_ENABLED);
 * this module shapes what the user sees: the side menu without the entries of features that are off, the route guard
 * ("Not available in this edition"), and the sections of screens wrapped in <Feature name="...">.
 *
 * The state lists only the features that are not plainly on: { key, status: 'off' | 'read-only', menus, routes }.
 * A feature that is not listed is on, so a screen registered by a later release is visible until the server says
 * otherwise. Plain module without browser imports: the help build and the manual role facts load it in Node.
 */
import { findActiveTrail } from "../components/SideBar/menuTree.js";

const STORAGE_KEY = "FEATURE_STATE";
const listeners = new Set();

const readCache = () => {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};

let current = readCache();

/** The features that are not plainly on (empty until the state is known). */
export const featureList = () => current || [];
/** True once the state of this environment is known (fetched, or kept from the previous visit). */
export const hasFeatureState = () => current !== null;

/** Replace the state (after GET /features/state) and tell the screens that use it. */
export const setFeatureState = (list) => {
  current = Array.isArray(list) ? list : [];
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn(current));
};

/** Forget the state (sign-out). */
export const clearFeatureState = () => {
  current = null;
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
};

export const subscribeFeatures = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** 'on', 'read-only' or 'off'. */
export const featureStatus = (key, list = featureList()) => list.find((f) => f.key === key)?.status || "on";
export const isFeatureOn = (key, list = featureList()) => featureStatus(key, list) === "on";

const offOnly = (list) => list.filter((f) => f.status === "off");

/** Menu entries ("Group > Item" names) of the features that are off. */
export const hiddenMenus = (list = featureList()) => new Set(offOnly(list).flatMap((f) => f.menus || []));

/** The menu tree without the entries of features that are off; groups left empty disappear. */
export const withoutFeatures = (menuList, list = featureList()) => {
  const hidden = hiddenMenus(list);
  if (!hidden.size) return menuList;
  const prune = (items, trail) =>
    (items || [])
      .map((item) => {
        const names = [...trail, item.name];
        if (!item.submenu) return hidden.has(names.join(" > ")) ? null : item;
        const submenu = prune(item.submenu, names);
        return submenu.length ? { ...item, submenu } : null;
      })
      .filter(Boolean);
  return prune(menuList, []);
};

const startsWith = (pathname, prefix) => {
  const base = String(prefix || "").replace(/\/+$/, "");
  return !!base && (pathname === base || pathname.startsWith(`${base}/`));
};

/**
 * The feature that keeps an address out of this edition, or null: an address of a feature that is off (its routes), or
 * one that belongs to a menu entry of such a feature (the most specific entry, as the side menu marks it).
 */
export const blockedFeatureFor = (pathname, menuList, list = featureList()) => {
  const off = offOnly(list);
  if (!off.length) return null;
  const byRoute = off.find((f) => (f.routes || []).some((r) => startsWith(pathname, r)));
  if (byRoute) return byRoute.key;
  const trail = findActiveTrail(menuList, pathname);
  if (!trail.length) return null;
  const name = trail.join(" > ");
  return off.find((f) => (f.menus || []).includes(name))?.key || null;
};
