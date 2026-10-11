import { menuList } from "../components/SideBar/list";
import { ADMIN_ROLES, getUserPermissions, getUserRoles, isPathAllowed } from "./menuPermissions";

/**
 * True when the signed-in user's roles may open the screen at `path` (the same rule as the side menu and the route
 * guard). Use it to hide buttons and links that lead to a screen the role cannot reach.
 * @param {string} path
 * @returns {boolean}
 */
export const canOpen = (path) => isPathAllowed(path, menuList, getUserRoles());

/**
 * True when a record link (an address with a query, as My Work and the notifications give) leads to a screen the
 * signed-in user may open; a link that would end on "Not authorised" is not offered.
 * @param {string} link
 * @returns {boolean}
 */
export const canOpenLink = (link) => !!link && canOpen(String(link).split(/[?#]/)[0]);

/**
 * True when the signed-in user holds an API permission such as "write:policies" (stored at sign-in), the same check
 * the server makes; use it to hide actions the server would refuse. Unknown (nothing stored) counts as allowed, so the
 * server stays the authority.
 * @param {string} permission
 * @returns {boolean}
 */
export const hasPermission = (permission) => {
  if (getUserRoles().some((role) => ADMIN_ROLES.includes(role))) return true;
  const held = getUserPermissions();
  return held ? held.includes(permission) : true;
};

export default canOpen;
