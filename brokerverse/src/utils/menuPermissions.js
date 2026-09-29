/**
 * Menu permissions based on user roles
 * Maps roles to allowed menu names and submenu names
 *
 * IMPORTANT: Any role not explicitly defined in this object will have FULL ACCESS by default.
 * This means new roles will automatically get access to all menus without needing configuration.
 * Only explicitly defined roles will have restricted permissions.
 */

export const roleMenuPermissions = {
  sales: {
    dashboard: ["Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    operations: [
      "Home",
      "Leads/Prospects",
      "Clients",
      "Quotation",
      "Policy",
      "Claims",
      "Renewals",
      "Open Items",
      "Payments",
    ],
    reports: ["Operational Reports"],
  },
  underwriting: {
    dashboard: ["Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    operations: [
      "Home",
      "Leads/Prospects",
      "Clients",
      "Quotation",
      "Policy",
      "Claims",
      "Renewals",
      "Open Items",
      "Payments",
    ],
    reports: ["Operational Reports"],
  },
  "customer-services": {
    dashboard: ["Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    operations: [
      "Home",
      "Leads/Prospects",
      "Clients",
      "Quotation",
      "Policy",
      "Claims",
      "Renewals",
      "Open Items",
      "Payments",
    ],
    reports: ["Operational Reports"],
  },
  claims: {
    dashboard: ["Dashboard"],
    "product configurator": ["Dashboard", "Product Templates"],
    operations: [
      "Home",
      "Leads/Prospects",
      "Clients",
      "Quotation",
      "Policy",
      "Claims",
      "Renewals",
      "Open Items",
      "Payments",
    ],
    reports: ["Operational Reports"],
  },
  finance: {
    dashboard: ["Dashboard"],
    accounts: ["Receipts", "Collections", "Disbursement"],
    commission: ["Commission Dashboard", "Agents/Referrer Accounts"],
    reports: ["Financial Reports"],
  },
  "it-admin": {
    // All access
    all: true,
  },
  ba: {
    // All access
    all: true,
  },
};

/**
 * Check if a role has access to a specific menu
 * @param {string} role - User role
 * @param {string} menuName - Name of the menu (e.g., "Operations", "Accounts")
 * @param {string} submenuName - Name of the submenu (optional)
 * @returns {boolean}
 *
 * Note: If a role is not defined in roleMenuPermissions, it will have full access by default.
 * This allows new roles to automatically get access to all menus without explicit configuration.
 */
export const hasMenuAccess = (role, menuName, submenuName = null) => {
  if (!role) return false;

  const roleKey = role.toLowerCase();
  const permissions = roleMenuPermissions[roleKey];

  // If user has "all" access, return true
  if (permissions && permissions.all) {
    return true;
  }

  // If no permissions defined for this role, grant all access
  if (!permissions) {
    return true;
  }

  // If checking menu access without submenu
  if (!submenuName && menuName) {
    return permissions[menuName.toLowerCase()] !== undefined;
  }

  // If checking submenu access
  if (submenuName && menuName) {
    const menuPerms = permissions[menuName.toLowerCase()];
    if (menuPerms) {
      // Check if the submenu is in the allowed list
      return menuPerms.includes(submenuName);
    }
  }

  return false;
};

/**
 * Check if a role has access to a specific menu item (considering nested structure)
 * @param {string} role - User role
 * @param {string} menuName - Name of the menu (e.g., "Operations", "Accounts")
 * @param {string|object} submenu - Name of submenu or submenu object
 * @returns {boolean}
 */
export const checkSubmenuAccess = (role, menuName, submenu) => {
  if (!role) return false;

  const roleKey = role.toLowerCase();
  const permissions = roleMenuPermissions[roleKey];

  // If user has "all" access, return true
  if (permissions && permissions.all) {
    return true;
  }

  // If no permissions defined for this role, grant all access
  if (!permissions) return true;

  // Get the submenu name if it's an object
  const submenuName = typeof submenu === "object" ? submenu.name : submenu;

  const menuPerms = permissions[menuName.toLowerCase()];
  if (!menuPerms) return false;

  // Check if the submenu is in the allowed list
  return menuPerms.includes(submenuName);
};

/**
 * Filter menu items based on user role
 * @param {Array} menuList - Array of menu items
 * @param {string} role - User role
 * @returns {Array} Filtered menu list
 */
export const filterMenuByRole = (menuList, role) => {
  if (!role) return [];

  const roleKey = role.toLowerCase();

  return menuList
    .map((menu) => {
      // Handle nested submenus
      if (menu.submenu) {
        const filteredSubmenu = menu.submenu
          .map((submenu) => {
            if (submenu.submenu) {
              const filteredNestedSubmenu = submenu.submenu.filter(
                (nestedSubmenu) =>
                  checkSubmenuAccess(roleKey, menu.name, nestedSubmenu.name)
              );
              return filteredNestedSubmenu.length > 0
                ? { ...submenu, submenu: filteredNestedSubmenu }
                : null;
            }
            return checkSubmenuAccess(roleKey, menu.name, submenu.name)
              ? submenu
              : null;
          })
          .filter((item) => item !== null);

        return filteredSubmenu.length > 0
          ? { ...menu, submenu: filteredSubmenu }
          : null;
      }

      // Handle menu without submenus
      return hasMenuAccess(roleKey, menu.name) ? menu : null;
    })
    .filter((item) => item !== null);
};
