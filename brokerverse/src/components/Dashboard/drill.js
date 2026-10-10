/**
 * Drill-down from a dashboard figure to the list behind it, filtered the same way. The lists keep their filters for
 * the browser tab (hooks/useServerList useListState, sessionStorage "bv-list:<key>"): the dashboard writes the filter
 * there and opens the list on its first page.
 */
const write = (key, value) => {
  try {
    window.sessionStorage.setItem(`bv-list:${key}`, JSON.stringify(value));
  } catch {
    // storage unavailable (private window): the list opens with its own defaults
  }
};

const POLICY_FILTERS = {
  paymentStatus: "", productType: "", insuranceCompanyName: "", clientName: "",
  issuedDateFrom: null, issuedDateTo: null, expiryDateFrom: null, expiryDateTo: null, premiumMin: null, premiumMax: null,
};

/** The lists a dashboard opens: { path, key, state } of each. */
export const LISTS = {
  /** Policies issued between two dates (YYYY-MM-DD), optionally of one product. */
  policiesIssued: (from, to, productType = "") => ({
    path: "/agent/policy", key: "policies",
    state: { search: "", showFilters: true, applied: { ...POLICY_FILTERS, issuedDateFrom: from || null, issuedDateTo: to || null, productType } },
  }),
  /** Policies expiring between two dates. */
  policiesExpiring: (from, to) => ({
    path: "/agent/policy", key: "policies",
    state: { search: "", showFilters: true, applied: { ...POLICY_FILTERS, expiryDateFrom: from || null, expiryDateTo: to || null } },
  }),
  /** The claims register at one stage (open, pending-approval, approved, settled; "" for all). */
  claims: (status = "") => ({ path: "/agent/claim", key: "claims", state: { search: "", status } }),
  prospects: () => ({ path: "/agent/leadlisting", key: "prospects", state: { search: "" } }),
  quotations: () => ({ path: "/agent/Quotation", key: "quotations", state: { search: "" } }),
};

/** Open a list filtered as the figure it was opened from (`target` from LISTS). */
export function drillDown(navigate, target) {
  if (!target) return;
  if (target.key) {
    write(target.key, target.state || {});
    write(`${target.key}:page`, { first: 0, rows: 20 });
  }
  navigate(target.path);
}
