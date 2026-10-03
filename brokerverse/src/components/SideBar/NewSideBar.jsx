import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { menuList } from "./list";
import "./NewSideBar.scss";
import SidebarItemCollapse from "./SideBarItemCollapse";
import SidebarItem from "./SideBarItem";
import { useLocation, useNavigate } from "react-router-dom";
import findNamesByPath from "../../utility/findSidBarNames";
import { InputText } from "primereact/inputtext";
import { filterMenuForRoles, getUserRoles } from "../../utils/menuPermissions";
import {
  COMMISSION_VIEW_MODE_EVENT,
  getCommissionViewMode,
} from "../../module/Commission/utils/commissionViewMode";
import { DEFAULT_SYSTEM_SETTINGS } from "../../utility/systemCurrencies";

const NewSideBar = ({ onNavigate }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Product name and logo from System Settings (general.system_name, branding.logo_url)
  const systemName = useSelector(
    (state) => state.systemSettingsReducer?.systemName || DEFAULT_SYSTEM_SETTINGS.systemName
  );
  const logoUrl = useSelector(
    (state) =>
      state.systemSettingsReducer?.logoUrl || DEFAULT_SYSTEM_SETTINGS.logoUrl
  );
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
      setCommissionViewModeState(event?.detail || getCommissionViewMode());
    };
    window.addEventListener(COMMISSION_VIEW_MODE_EVENT, onViewModeChange);
    return () => {
      window.removeEventListener(COMMISSION_VIEW_MODE_EVENT, onViewModeChange);
    };
  }, []);

  // Roles do not change during a session, so read them once.
  const userRoles = useMemo(() => getUserRoles(), []);

  // Deny-by-default role filter shared with the route guard (utils/menuPermissions.js).
  const baseFilteredMenuList = useMemo(() => {
    if (!userRoles.length) {
      return menuList.filter((menu) => menu.name === "Dashboard");
    }
    return filterMenuForRoles(menuList, userRoles);
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
        "/processing/dashboard",
        "/agent/home",
      ];
      const isDashboardPath = dashboardPaths.some(
        (path) => currentPath === path || currentPath.startsWith(path + "/"),
      );

      // If Dashboard is matched but path doesn't match Dashboard-specific paths,
      // find a more specific match by checking all menus
      if (topLevelMenuName === "Dashboard" && !isDashboardPath) {
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
        } else {
          // No better match found, collapse Dashboard
          topLevelMenuName = null;
        }
      }

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
        <a className="bdoi-brand" href="/" aria-label={`${systemName} home`}>
          <img src={logoUrl} alt={`${systemName} logo`} />
          <span className="bdoi-brand-product">{systemName}</span>
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
