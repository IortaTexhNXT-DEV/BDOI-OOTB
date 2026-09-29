import { menuList } from "../components/SideBar/list";
import { getUserRoles, isPathAllowed } from "./menuPermissions";

/**
 * True when the signed-in user's roles may open the screen at `path` (the same rule as the side menu and the route
 * guard). Use it to hide buttons and links that lead to a screen the role cannot reach (D109).
 * @param {string} path
 * @returns {boolean}
 */
export const canOpen = (path) => isPathAllowed(path, menuList, getUserRoles());

export default canOpen;
