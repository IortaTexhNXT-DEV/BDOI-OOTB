import runtimeConfig from "../config/runtimeConfig";

// API base: /env-config.js at run time, else the build-time REACT_APP_BASE_URL, else "/api" (src/config/runtimeConfig.js)
export const BASE_URL = runtimeConfig.apiBaseUrl;

export const TOKEN = "token";
export const DEFAULT_TOKEN_EXPIRY_DAY = 1;
export const REMEMBER_ME_EXPIRY_DAYS = 365;
export const PaginationDropdown = [
  { label: 10, value: 10 },
  { label: 20, value: 20 },
  { label: 50, value: 50 },
];
