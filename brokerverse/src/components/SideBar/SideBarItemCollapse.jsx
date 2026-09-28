import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SidebarItem from "./SideBarItem";
import SvgAccountIcon from "../../assets/icons/SvgAccountIcon";
import SvgArrow from "../../assets/icons/SvgArrow";
import SvgBackArrow from "../../assets/icons/SvgBackArrow";
import SvgAdd from "../../assets/icons/SvgAdd";
import SvgDownarrows from "../../assets/agentIcon/SvgDownarrows";
import SvgUparrows from "../../assets/agentIcon/SvgUparrows";

const SidebarItemCollapse = ({
  item,
  currentPathname,
  pathArrayData,
  onNavigate,
  isExpanded, // Controlled from parent (for top-level menus)
  onToggle, // Callback to parent to handle expansion (for top-level menus)
}) => {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(false);
  // For nested menus (when onToggle is not provided), manage own state
  const [localExpanded, setLocalExpanded] = useState(false);

  // Determine if this is a top-level menu (has onToggle) or nested menu
  const isTopLevel = !!onToggle;
  const isExpandedState = isTopLevel ? isExpanded : localExpanded;

  // Check if this top-level menu should be highlighted/active
  // Only highlight if current path actually matches one of this menu's submenu items
  const isMenuActive = React.useMemo(() => {
    if (!isTopLevel || !item?.submenu) {
      return false;
    }

    const processedPath = currentPathname?.replace(/\d+/g, "") || "";

    // Check if any submenu item matches the current path
    const hasMatchingSubmenu = item.submenu.some((subItem) => {
      if (!subItem.includes || !Array.isArray(subItem.includes)) {
        return false;
      }

      // Check specific includes first (excluding "/")
      const specificIncludes = subItem.includes.filter((inc) => inc !== "/");
      const hasGenericRoot = subItem.includes.includes("/");

      // Check specific includes
      if (specificIncludes.length > 0) {
        const matchesSpecific = specificIncludes.some((inc) => {
          return processedPath.startsWith(inc);
        });
        if (matchesSpecific) return true;
      }

      // Only check "/" if path is exactly "/"
      if (hasGenericRoot && processedPath === "/") {
        return true;
      }

      return false;
    });

    return hasMatchingSubmenu;
  }, [isTopLevel, item?.submenu, currentPathname]);

  const handleToggleCollapse = (e) => {
    console.log("🔴 SidebarItemCollapse handleToggleCollapse:", {
      menuName: item?.name,
      isTopLevel,
      currentExpanded: isExpandedState,
      willToggleTo: !isExpandedState,
      hasEvent: !!e,
      timestamp: new Date().toISOString(),
    });
    // Stop event propagation to prevent bubbling
    if (e) {
      e.stopPropagation();
    }

    if (isTopLevel) {
      // Top-level menu: notify parent to handle expansion (parent will close other menus)
      if (onToggle) {
        onToggle(item?.name);
      }
    } else {
      // Nested menu: manage own state
      setLocalExpanded(!localExpanded);
    }
  };

  // Auto-expand nested menus if current path matches
  // Note: Top-level menu expansion is handled by parent (NewSideBar)
  useEffect(() => {
    if (!isTopLevel && item?.submenu) {
      const processedPath = currentPathname?.replace(/\d+/g, "") || "";

      // Check if any submenu item (or nested submenu) matches the current path
      const checkSubmenuMatch = (subItems) => {
        return subItems.some((subItem) => {
          // Check if this submenu item matches
          if (subItem.includes && Array.isArray(subItem.includes)) {
            const specificIncludes = subItem.includes.filter(
              (inc) => inc !== "/"
            );
            const hasGenericRoot = subItem.includes.includes("/");

            // Check specific includes
            if (specificIncludes.length > 0) {
              const matchesSpecific = specificIncludes.some((inc) => {
                return processedPath.startsWith(inc);
              });
              if (matchesSpecific) return true;
            }

            // Only check "/" if path is exactly "/"
            if (hasGenericRoot && processedPath === "/") {
              return true;
            }
          }

          // Recursively check nested submenus
          if (subItem.submenu && Array.isArray(subItem.submenu)) {
            return checkSubmenuMatch(subItem.submenu);
          }

          return false;
        });
      };

      const hasMatch = checkSubmenuMatch(item.submenu);

      if (hasMatch) {
        console.log(
          "🟡 SidebarItemCollapse - Auto-expanding nested menu:",
          item?.name,
          "because path matches"
        );
        setLocalExpanded(true);
      } else {
        // Only collapse if it was auto-expanded (don't collapse if user manually expanded it)
        // We can't easily track manual vs auto expansion, so we'll keep it expanded if it was already expanded
        // This prevents flickering when navigating between pages
        console.log(
          "🟡 SidebarItemCollapse - Nested menu:",
          item?.name,
          "does not match current path"
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPathname, item?.name, item?.submenu]);

  return (
    <li>
      <div
        onClick={(e) => {
          handleToggleCollapse(e);
        }}
      >
        <div
          className={`divcontent__sidebar_overall ${
            isMenuActive ? "" : "divcontent__sidebardeactive__overall"
          }`}
        >
          <div className="divcontent__sidebar">
            {item.icon && (
              <span
                style={{
                  marginRight: "8px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {item.icon}
              </span>
            )}
            <span
              className={`itemname__container ${
                isExpandedState ? "collapsed" : ""
              }`}
              style={{
                color: "#004ea8",
                fontWeight: isMenuActive ? 700 : 600,
                fontSize: "15px",
              }}
            >
              {t(`sidebar.${item?.name}`, { defaultValue: item?.name })}
            </span>
          </div>
          <span className="itemarrow__container justify-end">
            {isExpandedState === true ? <SvgUparrows /> : <SvgDownarrows />}
          </span>
        </div>
      </div>
      {isExpandedState && (
        <ul className="submunusidebar__container">
          {item.submenu.map((childItem, index) =>
            childItem.submenu ? (
              <SidebarItemCollapse
                item={childItem}
                key={index}
                isActive={true}
                currentPathname={currentPathname}
                pathArrayData={pathArrayData}
                onNavigate={onNavigate}
                // Nested menus manage their own state (don't pass isExpanded/onToggle for nested)
              />
            ) : (
              <SidebarItem
                item={childItem}
                key={index}
                isActive={true}
                currentPathname={currentPathname}
                pathArrayData={pathArrayData}
                onNavigate={onNavigate}
              />
            )
          )}
        </ul>
      )}
    </li>
  );
};

export default SidebarItemCollapse;
