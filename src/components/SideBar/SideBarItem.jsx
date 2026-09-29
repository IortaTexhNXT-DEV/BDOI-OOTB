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
    console.log("🟣 SidebarItem handleItemClick:", {
      path,
      itemName: item?.name,
      hasEvent: !!event,
      timestamp: new Date().toISOString(),
    });
    if (event) {
      event.stopPropagation();
      console.log("🟣 SidebarItem - Event propagation stopped");
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

  console.log(isPathIncluded, "find isPathIncluded in text color", item?.name, {
    currentPath: currentPathname,
    itemIncludes: item?.includes,
    pathArrayData,
  });

  return (
    <li>
      <div
        style={{
          padding: "4px 8px",
          margin: "0px",
          borderRadius: "6px",
          backgroundColor: isPathIncluded
            ? "rgba(255, 255, 255, 0.1)"
            : "transparent",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!isPathIncluded) {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
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
            console.log("🟣 SidebarItem span onClick:", {
              path: item.path,
              itemName: item?.name,
              hasEvent: !!e,
              timestamp: new Date().toISOString(),
            });
            handleItemClick(item.path, e);
          }}
          style={{
            color: isPathIncluded ? "#fff" : "rgba(255, 255, 255, 0.85)",
            fontWeight: isPathIncluded ? 600 : 500,
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
