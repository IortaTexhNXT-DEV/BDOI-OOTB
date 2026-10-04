/**
 * Runtime configuration: the single place the front end reads its deployment settings.
 *
 * One build serves every environment (Dev, SIT, UAT, Pre-Prod, Production). The web server publishes
 * `/env-config.js`, generated when the container or service starts from its environment variables
 * (see scripts/env-config.sh), and index.html loads it before the app bundle. It sets
 * `window.__BROKERVERSE_CONFIG__`, for example:
 *
 *   window.__BROKERVERSE_CONFIG__ = {
 *     API_BASE_URL: "/api",          // or https://api.example.ph/api when the API is on another origin
 *     ENVIRONMENT_NAME: "UAT",       // shown as a label next to the logo; empty or PRODUCTION shows none
 *     ENVIRONMENT_COLOR: "#b45309",  // optional label colour (hex); a default per environment otherwise
 *     ANALYTICS_ENABLED: false
 *   };
 *
 * Order for each value: the runtime file, then the build-time REACT_APP_* value (older builds and local
 * `npm start`), then the default. With nothing configured the API is reached on the same origin at `/api`,
 * which the web server proxies to the backend.
 */

export const RUNTIME_CONFIG_GLOBAL = "__BROKERVERSE_CONFIG__";
export const DEFAULT_API_BASE_URL = "/api";

const PRODUCTION_NAMES = new Set(["PROD", "PRODUCTION", "LIVE", "PRD"]);

/** Label colours per environment: muted, readable with white text, distinct from the brand blue. */
const DEFAULT_COLORS = {
  LOCAL: "#475569",
  DEV: "#475569",
  DEVELOPMENT: "#475569",
  SIT: "#6d28d9",
  QA: "#6d28d9",
  TEST: "#6d28d9",
  UAT: "#b45309",
  STAGING: "#b45309",
  PREPROD: "#b91c1c",
  "PRE-PROD": "#b91c1c",
  DEMO: "#0f766e",
  TRAINING: "#0f766e",
};
const FALLBACK_COLOR = "#475569";
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const text = (value) => (typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim());

const isUnset = (value) => {
  const v = text(value);
  // an unfilled placeholder such as ${API_BASE_URL} or __API_BASE_URL__ counts as not set
  return v === "" || v === "undefined" || v === "null" || /^\$\{.*\}$/.test(v) || /^__.*__$/.test(v);
};

const flag = (value) => /^(1|true|yes|on)$/i.test(text(value));

/** API base without a trailing slash; relative paths ("/api") and absolute http(s) URLs are accepted. */
export const normaliseApiBaseUrl = (value) => {
  if (isUnset(value)) return "";
  const v = text(value).replace(/\/+$/, "");
  if (v === "") return "";
  if (v.startsWith("/") || /^https?:\/\//i.test(v)) return v;
  return "";
};

export const isProductionName = (name) => PRODUCTION_NAMES.has(text(name).toUpperCase());

/**
 * Resolve the configuration from the runtime object and the build-time environment.
 * @param {object} [runtime] the object set by /env-config.js (window.__BROKERVERSE_CONFIG__)
 * @param {object} [buildEnv] build-time values (process.env, REACT_APP_* only)
 */
export function resolveConfig(runtime, buildEnv) {
  const rt = runtime && typeof runtime === "object" ? runtime : {};
  const env = buildEnv && typeof buildEnv === "object" ? buildEnv : {};
  const pick = (runtimeKey, buildKey) => (!isUnset(rt[runtimeKey]) ? rt[runtimeKey] : !isUnset(env[buildKey]) ? env[buildKey] : "");

  const apiBaseUrl =
    normaliseApiBaseUrl(rt.API_BASE_URL) || normaliseApiBaseUrl(env.REACT_APP_BASE_URL) || DEFAULT_API_BASE_URL;

  const environmentName = text(pick("ENVIRONMENT_NAME", "REACT_APP_ENVIRONMENT_NAME")).toUpperCase().slice(0, 24);
  const production = environmentName === "" || isProductionName(environmentName);
  const requestedColor = text(pick("ENVIRONMENT_COLOR", "REACT_APP_ENVIRONMENT_COLOR"));
  const environmentColor = HEX_COLOR.test(requestedColor)
    ? requestedColor
    : DEFAULT_COLORS[environmentName] || FALLBACK_COLOR;

  return Object.freeze({
    apiBaseUrl,
    environmentName,
    environmentColor,
    // the label is shown on every environment except production (or when no name is given)
    showEnvironmentBanner: !production,
    isProduction: production,
    analyticsEnabled: flag(pick("ANALYTICS_ENABLED", "REACT_APP_ANALYTICS_ENABLED")),
    source: !isUnset(rt.API_BASE_URL) ? "runtime" : !isUnset(env.REACT_APP_BASE_URL) ? "build" : "default",
  });
}

const readRuntime = () => {
  try {
    return typeof window !== "undefined" ? window[RUNTIME_CONFIG_GLOBAL] : undefined;
  } catch {
    return undefined;
  }
};

// CRA replaces each process.env.REACT_APP_* reference with its value at build time, so name them one by one.
const buildTimeEnv = () => ({
  REACT_APP_BASE_URL: process.env.REACT_APP_BASE_URL,
  REACT_APP_ENVIRONMENT_NAME: process.env.REACT_APP_ENVIRONMENT_NAME,
  REACT_APP_ENVIRONMENT_COLOR: process.env.REACT_APP_ENVIRONMENT_COLOR,
  REACT_APP_ANALYTICS_ENABLED: process.env.REACT_APP_ANALYTICS_ENABLED,
});

const config = resolveConfig(readRuntime(), buildTimeEnv());

export default config;
