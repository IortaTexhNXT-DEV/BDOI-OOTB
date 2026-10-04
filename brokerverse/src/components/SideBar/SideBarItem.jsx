import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const SidebarItem = ({
  item,
  isActive,
  currentPathname,
  pathArrayData,
  onNavigate,
}) => {
  const Navigate = useNavigate();
  const { t } = useTranslation();

  const handleItemClick = (path, event) => {
    if (event) {
      event.stopPropagation();
    }
    Navigate(path);
    // Close sidebar on mobile/tablet after navigation
    if (onNavigate) {
      onNavigate();
    }
  };

  // Check if current path matches this specific menu item's includes array
  // Don't rely on pathArrayData alone since "Home" with "/" matches everything
  const isPathIncluded = React.useMemo(() => {
    if (!item?.includes || !Array.isArray(item.includes)) {
      return false;
    }

    const processedPath = currentPathname?.replace(/\d+/g, "") || "";

    // Check if current path matches any of the item's includes
    // Special handling: if "/" is in includes, only match it if path is exactly "/"
    // Otherwise, check other specific includes first
    const hasGenericRoot = item.includes.includes("/");
    const specificIncludes = item.includes.filter((inc) => inc !== "/");

    let matches = false;

    // First, check specific includes (more specific matches take priority)
    if (specificIncludes.length > 0) {
      matches = specificIncludes.some((inc) => {
        return processedPath.startsWith(inc);
      });
    }

    // Only check "/" if no specific match found AND path is exactly "/"
    if (!matches && hasGenericRoot) {
      matches = processedPath === "/";
    }

    // Also verify the item name is in pathArrayData (for hierarchy validation)
    const isInPathArray =
      Array.isArray(pathArrayData) && pathArrayData.includes(item?.name);

    // Both conditions must be true: path matches AND item is in path hierarchy
    return matches && isInPathArray;
  }, [item?.includes, item?.name, currentPathname, pathArrayData]);

  return (
    <li>
      <div
        style={{
          padding: "4px 8px",
          margin: "0px",
          borderRadius: "6px",
          // theme colours (Theme and Branding): active item background and the accent marker of brand themes
          backgroundColor: isPathIncluded ? "var(--bv-sidebar-active-bg, #e5f5ff)" : "transparent",
          boxShadow: isPathIncluded ? "inset 3px 0 0 var(--bv-sidebar-marker, transparent)" : "none",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!isPathIncluded) {
            e.currentTarget.style.backgroundColor = "var(--bv-sidebar-hover-bg, #f6f6f6)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isPathIncluded) {
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      >
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
          className={"singleitemname__container"}
          onClick={(e) => {
            handleItemClick(item.path, e);
          }}
          style={{
            color: "#004ea8",
            fontWeight: isPathIncluded ? 700 : 600,
            fontSize: "15px",
          }}
        >
          {t(`sidebar.${item?.name}`, { defaultValue: item?.name })}
        </span>
      </div>
    </li>
  );
};

export default SidebarItem;
