/**
 * Diagnostics for developers and production support.
 *
 * Silent in production builds, so customer browsers do not print internal errors. To see them while
 * reproducing a defect in production, run `localStorage.setItem("bv.debug", "1")` in the browser
 * console and reload; remove the item afterwards. Errors the user must know about are shown with the
 * notify helpers in utility/dialogs, not here.
 */
const enabled = () => {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    return window.localStorage.getItem("bv.debug") === "1";
  } catch {
    return false;
  }
};

/* eslint-disable no-console */
const logger = {
  error: (...args) => enabled() && console.error(...args),
  warn: (...args) => enabled() && console.warn(...args),
};
/* eslint-enable no-console */

export default logger;
