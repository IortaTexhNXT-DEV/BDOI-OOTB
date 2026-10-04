/**
 * "Show full identifiers" switch of the user menu. When the server masks personal identifiers on request
 * (privacy.pii_reveal_mode = on-request), a user holding view:pii sees masked values until the switch is on; while it
 * is on every API call carries the header X-Unmask-PII: 1 and the server records each unmasked answer in the audit
 * trail. The switch lasts for the browser tab (sessionStorage).
 */
const KEY = "BV_UNMASK_PII";
export const UNMASK_HEADER = "X-Unmask-PII";
export const PII_REVEAL_EVENT = "bv:pii-reveal";

const readStorage = (store, key) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};

/** Does the signed-in user hold "View full personal identifiers" (view:pii) or the administrator role? */
export const canViewFullIdentifiers = () => {
  try {
    const perms = JSON.parse(readStorage(localStorage, "USER_PERMISSIONS") || "[]");
    const roles = JSON.parse(readStorage(localStorage, "USER_ROLES") || "[]");
    return (Array.isArray(perms) && perms.includes("view:pii")) || (Array.isArray(roles) && roles.includes("system-admin"));
  } catch {
    return false;
  }
};

export const isRevealOn = () => readStorage(sessionStorage, KEY) === "1";

export const setRevealOn = (on) => {
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the switch stays off */
  }
  window.dispatchEvent(new CustomEvent(PII_REVEAL_EVENT, { detail: { on: !!on } }));
};

/** Headers to add to an API call. */
export const revealHeaders = () => (isRevealOn() && canViewFullIdentifiers() ? { [UNMASK_HEADER]: "1" } : {});
