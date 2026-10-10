/**
 * The dashboards and the one each persona lands on (BRD TIS-BRD-RPT-01: every persona has a dashboard of its own).
 * A role's first dashboard is its default; the dashboard switcher lists every dashboard the user's roles may open (the
 * same rules as the side menu, utils/menuPermissions).
 */
import { menuList } from "../SideBar/list";
import { getUserRoles, isPathAllowed } from "../../utils/menuPermissions";

export const DASHBOARDS = [
  { key: "executive", path: "/executive/dashboard" },
  { key: "sales", path: "/sales/dashboard" },
  { key: "processing", path: "/processing/dashboard" },
  { key: "claims", path: "/claims/dashboard" },
  { key: "renewals", path: "/renewal/analytics" },
  { key: "commission", path: "/commission/dashboard" },
  { key: "collections", path: "/agent/collections/aging-report" },
  { key: "remittance", path: "/finance/remittance/analytics" },
  { key: "products", path: "/product-configurator/dashboard" },
];

/** Roles in order of precedence (a user with several roles lands on the first match) and their default dashboard. */
export const PERSONA_DASHBOARD = [
  [/^(tis-general-manager|system-admin|tis-superid)$/, "executive"],
  [/^(tis-sales-unit-head|tis-sales-officer|tis-sales-associate|sales)$/, "sales"],
  [/^(tis-ops-unit-head|tis-ops-officer|tis-ops-associate|processing)$/, "processing"],
  [/^claims$/, "claims"],
  [/^operations$/, "renewals"],
  [/^(accounting-manager|tis-finance)$/, "commission"],
  [/^(accounting|tis-ccd-.+)$/, "collections"],
];

/** The dashboards the roles may open, in the order of DASHBOARDS. */
export const allowedDashboards = (roles = getUserRoles(), menu = menuList) =>
  DASHBOARDS.filter((d) => isPathAllowed(d.path, menu, roles));

/** The default dashboard of the roles: the persona's own when it may open it, else the first it may open; null for none. */
export function defaultDashboard(roles = getUserRoles(), menu = menuList) {
  const allowed = allowedDashboards(roles, menu);
  const list = (roles || []).map((r) => String(r).toLowerCase());
  for (const [re, key] of PERSONA_DASHBOARD) {
    if (list.some((r) => re.test(r))) {
      const own = allowed.find((d) => d.key === key);
      if (own) return own;
    }
  }
  return allowed[0] || null;
}
