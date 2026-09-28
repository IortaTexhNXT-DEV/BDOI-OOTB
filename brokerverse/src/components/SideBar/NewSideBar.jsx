import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { menuList } from "./list";
import "./NewSideBar.scss";
import SidebarItemCollapse from "./SideBarItemCollapse";
import SidebarItem from "./SideBarItem";
import { useLocation, useNavigate } from "react-router-dom";
import findNamesByPath from "../../utility/findSidBarNames";
import Cookies from "js-cookie";
import { InputText } from "primereact/inputtext";
import { roleMenuPermissions } from "../../utils/menuPermissions";
import {
  COMMISSION_VIEW_MODE_EVENT,
  getCommissionViewMode,
} from "../../module/Commission/utils/commissionViewMode";

const NewSideBar = ({ onNavigate }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [pathArrayData, setPathArrayData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [expandedMenu, setExpandedMenu] = useState(null); // Track which menu is expanded (only one at a time)
  const [commissionViewMode, setCommissionViewModeState] = useState(() =>
    getCommissionViewMode(),
  );
  const currentPathname = location?.pathname;

  useEffect(() => {
    const onViewModeChange = (event) => {
      setCommissionViewModeState(
        event?.detail || getCommissionViewMode(),
      );
    };
    window.addEventListener(COMMISSION_VIEW_MODE_EVENT, onViewModeChange);
    return () => {
      window.removeEventListener(COMMISSION_VIEW_MODE_EVENT, onViewModeChange);
    };
  }, []);

  // Memoize user roles to prevent re-parsing on every render
  const userRoles = useMemo(() => {
    const userRole =
      localStorage.getItem("USER_ROLE") || Cookies.get("USER_ROLE");
    // Parse userRoles - if it's empty or null, try to parse from USER_ROLE
    let roles = [];
    // If USER_ROLES is empty but USER_ROLE exists, parse the comma-separated string
    if ((!roles || roles.length === 0) && userRole) {
      roles = userRole.split(", ").map((role) => role.trim());
      console.log("🔧 Parsed roles from USER_ROLE string:", roles);
    }
    return roles;
  }, []); // Empty dependency array - only parse once on mount - roles don't change during the session

  // Helper function to get role menu permissions
  // NOTE: If a role is not defined here, it will have full access by default
  const getRoleMenuPermissions = (roleKey) => {
    return roleMenuPermissions[roleKey];
  };

  // Helper function to check if a role has access to a menu/submenu (case-insensitive)
  const checkMenuAccess = (rolePermissions, menuName, submenuName) => {
    // If rolePermissions is undefined (role not defined), grant all access
    if (!rolePermissions) return true;

    if (rolePermissions.all) return true;

    // Normalize menu name to lowercase for matching
    const menuKey = menuName.toLowerCase();
    const allowedSubmenus = rolePermissions[menuKey];

    if (!allowedSubmenus) return false;

    if (!Array.isArray(allowedSubmenus)) return false;

    return allowedSubmenus.some((allowedName) => {
      const normalizedSubmenuName = submenuName.toLowerCase();
      const normalizedAllowed = allowedName.toLowerCase();
      return (
        normalizedSubmenuName === normalizedAllowed ||
        normalizedSubmenuName.includes(normalizedAllowed) ||
        normalizedAllowed.includes(normalizedSubmenuName)
      );
    });
  };

  // Filter menu based on user role - memoized to prevent unnecessary re-renders
  const baseFilteredMenuList = useMemo(() => {
    // If user has no role or is not authenticated, show only Dashboard and Login
    if (!userRoles || userRoles.length === 0) {
      return menuList.filter(
        (menu) => menu.name === "Dashboard" || menu.name === "Login",
      );
    }

    // Normalize userRoles array
    const normalizedRoles = Array.isArray(userRoles) ? userRoles : [];

    // Check if user has all-access roles (IT Admin, BA)
    const hasAllAccess = normalizedRoles.some(
      (role) =>
        role &&
        (role.toLowerCase() === "it-admin" || role.toLowerCase() === "ba"),
    );

    if (hasAllAccess) {
      return menuList.filter((menu) => menu.name !== "Master");
    }

    // Filter menu based on user's roles
    const filteredMenus = menuList
      .map((menu) => {
        // Create a copy of the menu to avoid mutating the original
        const filteredMenu = { ...menu };

        if (menu.submenu) {
          // Filter submenus based on role access
          const filteredSubmenus = menu.submenu
            .map((submenu) => {
              // Check if any of the user's roles has access to this submenu
              const hasAccess = normalizedRoles.some((role) => {
                if (!role) return false;

                const roleKey = role.toLowerCase();
                const menuPerms = getRoleMenuPermissions(roleKey);

                // Use the new helper function for case-insensitive matching
                return checkMenuAccess(menuPerms, menu.name, submenu.name);
              });

              return hasAccess ? submenu : null;
            })
            .filter((item) => item !== null);

          console.log(
            `Menu: ${menu.name}, Total submenus: ${menu.submenu.length}, Filtered Submenus:`,
            filteredSubmenus.length,
          );
          if (filteredSubmenus.length > 0) {
            console.log(
              `  Visible submenus:`,
              filteredSubmenus.map((s) => s.name),
            );
          }

          // Only include menu if it has visible submenus
          if (filteredSubmenus.length > 0) {
            return { ...filteredMenu, submenu: filteredSubmenus };
          }
          return null;
        }

        // Menu without submenu - check if user has access to the whole menu
        const hasAccess = normalizedRoles.some((role) => {
          if (!role) return false;
          const roleKey = role.toLowerCase();
          const menuPerms = getRoleMenuPermissions(roleKey);
          // If role is not defined (menuPerms is undefined), grant all access
          if (!menuPerms) return true;
          if (menuPerms.all) return true;
          return menuPerms[menu.name.toLowerCase()] !== undefined;
        });

        return hasAccess ? filteredMenu : null;
      })
      .filter((menu) => menu !== null);

    return filteredMenus;
  }, [userRoles]);

  // Hide Agents/Referrer Accounts when Commission view is Management
  const roleAndViewFilteredMenuList = useMemo(() => {
    if (commissionViewMode !== "management") {
      return baseFilteredMenuList;
    }
    return baseFilteredMenuList.map((menu) => {
      if (menu.name !== "Commission" || !menu.submenu) return menu;
      return {
        ...menu,
        submenu: menu.submenu.filter(
          (sub) => sub.name !== "Agents/Referrer Accounts",
        ),
      };
    });
  }, [baseFilteredMenuList, commissionViewMode]);

  // Create a flattened list of all menu items for searching
  const flattenMenuItems = useMemo(() => {
    const items = [];
    const addItem = (item, parent = null) => {
      items.push({
        ...item,
        parent: parent,
        label: parent ? `${parent} > ${item.name}` : item.name,
        searchableText: item.name.toLowerCase(),
      });

      if (item.submenu) {
        item.submenu.forEach((subItem) => addItem(subItem, item.name));
      }
    };

    roleAndViewFilteredMenuList.forEach((item) => addItem(item));
    return items;
  }, [roleAndViewFilteredMenuList]);

  // Filter menu based on search query
  const filteredMenuList = useMemo(() => {
    if (!searchQuery.trim()) {
      return roleAndViewFilteredMenuList;
    }

    const query = searchQuery.toLowerCase();
    const matchingItems = new Set();
    const matchingParents = new Set();

    // Find all matching items and their parents
    roleAndViewFilteredMenuList.forEach((menu) => {
      const menuMatches = menu.name.toLowerCase().includes(query);

      if (menuMatches) {
        matchingItems.add(menu.name);
      }

      if (menu.submenu) {
        menu.submenu.forEach((subItem) => {
          if (subItem.name.toLowerCase().includes(query)) {
            matchingItems.add(subItem.name);
            matchingParents.add(menu.name);
          }
        });
      }
    });

    // Filter menu to show only matching items and their parents
    return roleAndViewFilteredMenuList.filter((menu) => {
      if (matchingItems.has(menu.name) || matchingParents.has(menu.name)) {
        // If parent matches or has matching children, show with filtered submenu
        if (menu.submenu) {
          const filteredSubmenu = menu.submenu.filter(
            (subItem) =>
              matchingItems.has(subItem.name) ||
              menu.name.toLowerCase().includes(query),
          );

          if (filteredSubmenu.length > 0 || matchingItems.has(menu.name)) {
            return {
              ...menu,
              submenu:
                filteredSubmenu.length > 0 ? filteredSubmenu : menu.submenu,
            };
          }
        }
        return true;
      }
      return false;
    });
  }, [searchQuery, roleAndViewFilteredMenuList]);

  // Handle search and create search results
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const results = flattenMenuItems
        .filter((item) => item.searchableText.includes(query))
        .slice(0, 10); // Limit to 10 results
      setSearchResults(results);
      setSelectedSearchIndex(-1);
    } else {
      setSearchResults([]);
      setSelectedSearchIndex(-1);
    }
  }, [searchQuery, flattenMenuItems]);

  // Handle keyboard navigation in search
  const handleSearchKeyDown = (e) => {
    if (searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSearchIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSearchIndex((prev) =>
          prev > 0 ? prev - 1 : searchResults.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedSearchIndex >= 0 && searchResults[selectedSearchIndex]) {
          const item = searchResults[selectedSearchIndex];
          if (item.path) {
            navigate(item.path);
            setSearchQuery("");
            setSearchResults([]);
          }
        }
        break;
      case "Escape":
        setSearchQuery("");
        setSearchResults([]);
        break;
    }
  };

  // Handle clicking on search result
  const handleSearchResultClick = (item) => {
    if (item.path) {
      navigate(item.path);
      setSearchQuery("");
      setSearchResults([]);
      // Close sidebar on mobile/tablet after navigation
      if (onNavigate) {
        onNavigate();
      }
    }
  };

  useEffect(() => {
    const pathArrayData = findNamesByPath(
      baseFilteredMenuList,
      location?.pathname,
    );
    setPathArrayData(pathArrayData);

    // Auto-expand the menu based on current page
    // Find the most specific match (ignore Dashboard's "/" fallback if there's a better match)
    if (pathArrayData && pathArrayData.length > 0) {
      let topLevelMenuName = pathArrayData[0];
      const currentPath = location?.pathname;

      // Dashboard menu has "/" in includes which matches everything
      // Only use Dashboard if path actually matches Dashboard-specific paths
      const dashboardPaths = [
        "/",
        "/executive/dashboard",
        "/claims/dashboard",
        "/underwriting/dashboard",
        "/agent/home",
      ];
      const isDashboardPath = dashboardPaths.some(
        (path) => currentPath === path || currentPath.startsWith(path + "/"),
      );

      // If Dashboard is matched but path doesn't match Dashboard-specific paths,
      // find a more specific match by checking all menus
      if (topLevelMenuName === "Dashboard" && !isDashboardPath) {
        console.log(
          "🟠 NewSideBar - Dashboard matched but path doesn't match Dashboard paths, finding better match",
        );

        // Find all menu matches (excluding Dashboard's "/" match)
        const allMenuMatches = [];
        baseFilteredMenuList.forEach((menu) => {
          if (menu.name === "Dashboard") return; // Skip Dashboard

          if (menu.submenu) {
            menu.submenu.forEach((subItem) => {
              if (subItem.includes) {
                const processedPath = currentPath.replace(/\d+/g, "");
                const hasMatch = subItem.includes.some((inc) => {
                  return inc !== "/" && processedPath.startsWith(inc);
                });

                if (hasMatch) {
                  // Find the longest matching include path
                  const matchingInclude = subItem.includes
                    .filter(
                      (inc) => inc !== "/" && processedPath.startsWith(inc),
                    )
                    .sort((a, b) => b.length - a.length)[0];

                  allMenuMatches.push({
                    menuName: menu.name,
                    submenuName: subItem.name,
                    matchLength: matchingInclude?.length || 0,
                    matchingPath: matchingInclude,
                  });
                }
              }
            });
          }
        });

        // Get the most specific match (longest path match)
        if (allMenuMatches.length > 0) {
          const bestMatch = allMenuMatches.reduce((prev, current) =>
            current.matchLength > prev.matchLength ? current : prev,
          );
          topLevelMenuName = bestMatch.menuName;
          console.log("🟠 NewSideBar - Found more specific match:", {
            originalMatch: "Dashboard",
            betterMatch: bestMatch,
            timestamp: new Date().toISOString(),
          });
        } else {
          // No better match found, collapse Dashboard
          console.log(
            "🟠 NewSideBar - No better match found, collapsing Dashboard",
          );
          topLevelMenuName = null;
        }
      }

      console.log("🟠 NewSideBar - Auto-expanding menu based on path:", {
        path: currentPath,
        pathArrayData,
        topLevelMenuName,
        timestamp: new Date().toISOString(),
      });

      // Update expanded menu based on current path
      setExpandedMenu((currentExpanded) => {
        // Only update if it's different from current expanded menu
        if (currentExpanded !== topLevelMenuName) {
          return topLevelMenuName;
        }
        return currentExpanded;
      });
    } else {
      // If no match found, collapse all menus
      console.log(
        "🟠 NewSideBar - No menu match found for path, collapsing all menus",
      );
      setExpandedMenu((currentExpanded) => {
        if (currentExpanded !== null) {
          return null;
        }
        return currentExpanded;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPathname, baseFilteredMenuList]);

  return (
    <div className="sidebar__overall__container">
      <ul className="list">
        {/* <div className="stack"> */}
        <a className="bdoi-brand" href="/" aria-label="BIBS home">
          <img src="/bdoi/bdo-insure.png" alt="BDO Insure" />
          <span className="bdoi-brand-product">BIBS · BDOI Broker System</span>
        </a>

        {/* Search Box */}
        <div className="menu-search-container">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("common.searchMenu")}
              className="menu-search-input"
              autoComplete="off"
            />
          </span>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="search-results-dropdown">
              {searchResults.map((item, index) => (
                <div
                  key={index}
                  className={`search-result-item ${
                    selectedSearchIndex === index ? "selected" : ""
                  }`}
                  onClick={() => handleSearchResultClick(item)}
                  onMouseEnter={() => setSelectedSearchIndex(index)}
                >
                  <i className={item.icon || "pi pi-angle-right"} />
                  <span className="search-result-text">
                    {item.parent
                      ? `${t(`sidebar.${item.parent}`, { defaultValue: item.parent })} > ${t(`sidebar.${item.name}`, { defaultValue: item.name })}`
                      : t(`sidebar.${item.name}`, { defaultValue: item.name })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <>
          {filteredMenuList.map((individalMenu, index) =>
            individalMenu.submenu ? (
              <SidebarItemCollapse
                item={individalMenu}
                key={index}
                currentPathname={currentPathname}
                pathArrayData={pathArrayData}
                onNavigate={onNavigate}
                isExpanded={expandedMenu === individalMenu.name}
                onToggle={(menuName) => {
                  // If clicking the same menu, collapse it. Otherwise, expand the new one and collapse others
                  setExpandedMenu(expandedMenu === menuName ? null : menuName);
                }}
              />
            ) : (
              <SidebarItem
                item={individalMenu}
                key={index}
                currentPathname={currentPathname}
                pathArrayData={pathArrayData}
                onNavigate={onNavigate}
              />
            ),
          )}
        </>
      </ul>
    </div>
  );
};

export default NewSideBar;
