import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Sidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";
import SvgLogo from "../../assets/icons/SvgLogo";
import SvgDot from "../../assets/icons/SvgDot";
import { menuList } from "./list";
import "../SideBar/index.scss";
import { Link } from "react-router-dom";
import SvgAccountIcon from "../../assets/icons/SvgAccountIcon";
import SvgMassterIcon from "../../assets/icons/SvgMassterIcon";
import SvgReportsIcon from "../../assets/icons/SvgReportsIcon";
import SvgFinalLogo from "../../assets/icons/SvgFinalLogo";
import SvgAgentClientIcon from "../../assets/agentIcon/SvgAgentClientIcon";
import SvgAgentPaymentIcon from "../../assets/agentIcon/SvgAgentPaymentIcon";
import SvgAgentHomeIcon from "../../assets/agentIcon/SvgAgentHomeIcon";
import SvgAgentLeadIcon from "../../assets/agentIcon/SvgAgentLeadIcon";
import SvgAgentItemsIcon from "../../assets/agentIcon/SvgAgentItemsIcon";
import SvgQuotationIcon from "../../assets/agentIcon/SvgQuotationIcon";
import SvgPolicyIcon from "../../assets/agentIcon/SvgPolicyIcon";
import Cookies from "js-cookie";
import { DEFAULT_SYSTEM_SETTINGS } from "../../utility/systemCurrencies";

const ResponsiveDrawer = () => {
  const [findPath, setPath] = useState(null);
  const [openSubMenu, setOpenSubMenu] = useState("  ");
  const [visible, setVisible] = useState(true);
  const logoUrl = useSelector(
    (state) =>
      state.systemSettingsReducer?.logoUrl || DEFAULT_SYSTEM_SETTINGS.logoUrl
  );

  // Get user role and permissions from localStorage
  const userRole = localStorage.getItem("USER_ROLE");
  const userPermissions = JSON.parse(
    localStorage.getItem("USER_PERMISSIONS") || "[]",
  );

  // Log permissions for debugging
  console.log("🔐 Sidebar - User Role:", userRole);
  console.log("🔐 Sidebar - User Permissions:", userPermissions);
  console.log(
    "🔐 Sidebar - Raw USER_PERMISSIONS:",
    localStorage.getItem("USER_PERMISSIONS"),
  );
  console.log("🔐 Sidebar - All localStorage keys:", Object.keys(localStorage));

  // Helper function to check if user has required permissions
  const hasPermission = (requiredPermissions) => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    const hasAccess = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );
    console.log("🔐 Checking permissions:", {
      requiredPermissions,
      userPermissions,
      hasAccess,
    });
    return hasAccess;
  };

  // Filter menu recursively based on permissions
  const filterMenuByPermissions = (menu) => {
    return menu
      .map((item) => {
        // Check if menu item has permissions requirement
        if (item.permissions && !hasPermission(item.permissions)) {
          console.log(
            "🔐 Hiding menu item:",
            item.name,
            "due to missing permissions:",
            item.permissions,
          );
          return null; // Hide this item
        }

        // If item has submenu, filter submenu recursively
        if (item.submenu) {
          const filteredSubmenu = filterMenuByPermissions(item.submenu);

          // If all submenu items are hidden, hide parent too
          if (filteredSubmenu.length === 0) {
            console.log(
              "🔐 Hiding parent menu:",
              item.name,
              "because all children are hidden",
            );
            return null;
          }

          return { ...item, submenu: filteredSubmenu };
        }

        return item;
      })
      .filter((item) => item !== null);
  };

  // Apply permission filtering
  const filteredMenuList = filterMenuByPermissions(menuList);

  console.log("🔐 Final filtered menu list:", filteredMenuList);
  console.log("🔐 Original menu list length:", menuList.length);
  console.log("🔐 Filtered menu list length:", filteredMenuList.length);

  const handleNavigation = (navigationPath, event) => {
    console.log("🔵 handleNavigation called:", {
      navigationPath,
      hasEvent: !!event,
      currentOpenSubMenu: openSubMenu,
      timestamp: new Date().toISOString(),
    });
    if (event) {
      event.stopPropagation();
      console.log("🔵 Event propagation stopped");
    }
    setPath(navigationPath);
    setOpenSubMenu("");
    console.log("🔵 After handleNavigation - openSubMenu set to empty string");
  };

  const handleClick = (name) => {
    const newState = openSubMenu === name ? "" : name;
    console.log("🟢 handleClick called:", {
      menuName: name,
      currentOpenSubMenu: openSubMenu,
      newOpenSubMenu: newState,
      willToggle: openSubMenu === name,
      timestamp: new Date().toISOString(),
    });
    setOpenSubMenu(newState);
    console.log("🟢 After handleClick - openSubMenu set to:", newState);
  };

  useEffect(() => {
    const handleResize = () => {
      setVisible(window.innerWidth > 800);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    console.log("🟡 openSubMenu state changed:", {
      openSubMenu,
      timestamp: new Date().toISOString(),
    });
  }, [openSubMenu]);

  return (
    <Sidebar
      visible={visible}
      style={{
        backgroundColor: "#ffffff !important",
        display: visible ? "block" : "none",
        height: "100vh",
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": {
          display: "none",
        },
      }}
      rootStyles={{
        backgroundColor: "#ffffff !important",
      }}
      onHide={() => setVisible(false)}
    >
      <div style={{ padding: "1.25rem" }}>
        <div
          style={{
            marginBottom: "20px",
            marginTop: "20px",
            marginLeft: "28px",
          }}
        >
          {/* <SvgLogo color={"#fff"} /> */}
          {/* <SvgFinalLogo /> */}
          <img
            src={logoUrl}
            alt="BDO Insure"
            style={{
              maxWidth: "100%",
              maxHeight: "36px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </div>
        <Menu style={{ backgroundColor: "#ffffff !important", border: "none" }}>
          {filteredMenuList.map((data, index) => (
            <React.Fragment key={data.name}>
              <SubMenu
                style={{
                  color: "#fff",
                  width: "100%",
                  paddingLeft: "8px",
                  backgroundColor:
                    data.name === openSubMenu ||
                    data.submenu.some((subItem) => subItem.path === findPath)
                      ? "#36435c"
                      : "#2e2e2e",
                }}
                color="#fff"
                label={data.name}
                icon={
                  data.name === "Accounts" ? (
                    <SvgAccountIcon
                      color={data.name === openSubMenu ? "#0072d8" : "#Fff"}
                    />
                  ) : data.name === "Petty Cash" ? (
                    <SvgAccountIcon
                      color={data.name === openSubMenu ? "#0072d8" : "#Fff"}
                    />
                  ) : data.name === "Master" ? (
                    <SvgMassterIcon
                      color={data.name === openSubMenu ? "#0072d8" : "#Fff"}
                    />
                  ) : data.name === "Reports" ? (
                    <SvgReportsIcon
                      color={data.name === openSubMenu ? "#0072d8" : "#Fff"}
                    />
                  ) : data.name === "Broker" ? (
                    <SvgReportsIcon
                      color={data.name === openSubMenu ? "#0072d8" : "#Fff"}
                    />
                  ) : undefined
                }
                onClick={(e) => {
                  console.log("🔴 SubMenu onClick triggered:", {
                    menuName: data.name,
                    hasEvent: !!e,
                    eventType: e?.type,
                    currentTarget: e?.currentTarget?.textContent,
                    target: e?.target?.textContent,
                    timestamp: new Date().toISOString(),
                  });
                  handleClick(data.name);
                }}
              >
                {data.submenu.map((subItem, subIndex) => {
                  return (
                    <React.Fragment key={subIndex}>
                      {subItem.submenu ? (
                        <SubMenu
                          label={subItem.name}
                          style={{ marginLeft: -8 }}
                        >
                          {subItem.submenu.map((nestedItem, nestedIndex) => (
                            <React.Fragment key={nestedIndex}>
                              {nestedItem.submenu ? (
                                <SubMenu
                                  label={nestedItem.name}
                                  style={
                                    {
                                      /* Style for nested submenu */
                                    }
                                  }
                                >
                                  {nestedItem.submenu.map(
                                    (subsubmenuItem, subsubmenuIndex) => (
                                      <MenuItem
                                        key={subsubmenuIndex}
                                        component={
                                          <Link to={subsubmenuItem.path} />
                                        }
                                        onClick={(e) => {
                                          console.log(
                                            "🟣 MenuItem onClick (subsubmenuItem):",
                                            {
                                              path: subsubmenuItem.path,
                                              name: subsubmenuItem.name,
                                              hasEvent: !!e,
                                              eventType: e?.type,
                                              currentTarget:
                                                e?.currentTarget?.textContent,
                                              timestamp:
                                                new Date().toISOString(),
                                            },
                                          );
                                          handleNavigation(
                                            subsubmenuItem.path,
                                            e,
                                          );
                                        }}
                                      >
                                        <div className="menu__list">
                                          <SvgDot
                                            color={
                                              subsubmenuItem.path === findPath
                                                ? "#0072d8"
                                                : "#2e2e2e"
                                            }
                                          />
                                          <span
                                            style={{
                                              color:
                                                subsubmenuItem.path === findPath
                                                  ? "#fff"
                                                  : "#9DA4AE",
                                            }}
                                            className="menu__text"
                                          >
                                            {subsubmenuItem.name}
                                          </span>
                                        </div>
                                      </MenuItem>
                                    ),
                                  )}
                                </SubMenu>
                              ) : (
                                <MenuItem
                                  key={nestedIndex}
                                  component={<Link to={nestedItem.path} />}
                                  onClick={(e) => {
                                    console.log(
                                      "🟣 MenuItem onClick (nestedItem):",
                                      {
                                        path: nestedItem.path,
                                        name: nestedItem.name,
                                        hasEvent: !!e,
                                        eventType: e?.type,
                                        currentTarget:
                                          e?.currentTarget?.textContent,
                                        timestamp: new Date().toISOString(),
                                      },
                                    );
                                    handleNavigation(nestedItem.path, e);
                                  }}
                                >
                                  <div className="menu__list">
                                    <SvgDot
                                      color={
                                        nestedItem.path === findPath
                                          ? "#0072d8"
                                          : "#2e2e2e"
                                      }
                                    />
                                    <span
                                      style={{
                                        color:
                                          nestedItem.path === findPath
                                            ? "#fff"
                                            : "#9DA4AE",
                                      }}
                                      className="menu__text"
                                    >
                                      {nestedItem.name}
                                    </span>
                                  </div>
                                </MenuItem>
                              )}
                            </React.Fragment>
                          ))}
                        </SubMenu>
                      ) : (
                        <MenuItem
                          key={subIndex}
                          component={<Link to={subItem.path} />}
                          onClick={(e) => {
                            console.log(
                              "🟣 MenuItem onClick (subItem - Leads/Prospects):",
                              {
                                path: subItem.path,
                                name: subItem.name,
                                hasEvent: !!e,
                                eventType: e?.type,
                                currentTarget: e?.currentTarget?.textContent,
                                parentMenuName: data.name,
                                timestamp: new Date().toISOString(),
                              },
                            );
                            handleNavigation(subItem.path, e);
                          }}
                        >
                          <div
                            className="menu__list"
                            style={
                              data.name === "Broker"
                                ? {
                                    display: "flex",
                                    gap: "10px",
                                    alignItems: "center",
                                  }
                                : {}
                            }
                          >
                            {subItem.name === "Home" ||
                            subItem.name === "Leads" ||
                            subItem.name === "Clients" ||
                            subItem.name === "Open Items" ||
                            subItem.name === "Claim" ||
                            subItem.name === "Policy" ||
                            subItem.name === "Quotation" ||
                            subItem.name === "Payments" ? (
                              subItem.name === "Home" ? (
                                <SvgAgentHomeIcon
                                  color={
                                    subItem.path === findPath
                                      ? "#0072d8"
                                      : "#9DA4AE"
                                  }
                                />
                              ) : subItem.name === "Leads" ? (
                                <SvgAgentLeadIcon
                                  color={
                                    subItem.path === findPath
                                      ? "#0072d8"
                                      : "#9DA4AE"
                                  }
                                />
                              ) : subItem.name === "Clients" ? (
                                <SvgAgentClientIcon
                                  color={
                                    subItem.path === findPath
                                      ? "#0072d8"
                                      : "#9DA4AE"
                                  }
                                />
                              ) : subItem.name === "Open Items" ? (
                                <SvgAgentItemsIcon
                                  color={
                                    subItem.path === findPath
                                      ? "#0072d8"
                                      : "#9DA4AE"
                                  }
                                />
                              ) : subItem.name === "Claim" ? (
                                <SvgAgentItemsIcon
                                  color={
                                    subItem.path === findPath
                                      ? "#0072d8"
                                      : "#9DA4AE"
                                  }
                                />
                              ) : subItem.name === "Quotation" ? (
                                <SvgQuotationIcon
                                  color={
                                    subItem.path === findPath
                                      ? "#0072d8"
                                      : "#9DA4AE"
                                  }
                                />
                              ) : subItem.name === "Policy" ? (
                                <SvgPolicyIcon
                                  color={
                                    subItem.path === findPath
                                      ? "#0072d8"
                                      : "#9DA4AE"
                                  }
                                />
                              ) : (
                                <SvgAgentPaymentIcon
                                  color={
                                    subItem.path === findPath
                                      ? "#0072d8"
                                      : "#9DA4AE"
                                  }
                                />
                              )
                            ) : (
                              <SvgDot
                                color={
                                  subItem.path === findPath
                                    ? "#0072d8"
                                    : "#2e2e2e"
                                }
                              />
                            )}

                            <span
                              style={{
                                color:
                                  subItem.path === findPath
                                    ? "#fff"
                                    : "#9DA4AE",
                              }}
                              className="menu__text"
                            >
                              {subItem.name}
                            </span>
                          </div>
                        </MenuItem>
                      )}
                    </React.Fragment>
                  );
                })}
              </SubMenu>
            </React.Fragment>
          ))}
        </Menu>
      </div>
    </Sidebar>
  );
};

export default ResponsiveDrawer;
