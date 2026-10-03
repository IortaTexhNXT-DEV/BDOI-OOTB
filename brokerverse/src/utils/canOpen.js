import { menuList } from "../components/SideBar/list";
import { ADMIN_ROLES, getUserRoles, isPathAllowed } from "./menuPermissions";

/**
 * True when the signed-in user's roles may open the screen at `path` (the same rule as the side menu and the route
 * guard). Use it to hide buttons and links that lead to a screen the role cannot reach.
 * @param {string} path
 * @returns {boolean}
 */
export const canOpen = (path) => isPathAllowed(path, menuList, getUserRoles());

/**
 * True when the signed-in user holds an API permission such as "write:policies" (stored at sign-in), the same check
 * the server makes; use it to hide actions the server would refuse. Unknown (nothing stored) counts as allowed, so the
 * server stays the authority.
 * @param {string} permission
 * @returns {boolean}
 */
export const hasPermission = (permission) => {
  if (getUserRoles().some((role) => ADMIN_ROLES.includes(role))) return true;
  try {
    const stored = JSON.parse(localStorage.getItem("USER_PERMISSIONS") || "null");
    return Array.isArray(stored) ? stored.includes(permission) : true;
  } catch {
    return true;
  }
};

export default canOpen;
