import React, { useState, useEffect, useMemo } from "react";
import { Sidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";
import SvgLogo from "../../assets/icons/SvgLogo";
import SvgDot from "../../assets/icons/SvgDot";
import { menuList } from "./list";
import "../SideBar/index.scss";
import { Link, useLocation } from "react-router-dom";
import SvgAccountIcon from "../../assets/icons/SvgAccountIcon";
import SvgMassterIcon from "../../assets/icons/SvgMassterIcon";
import SvgReportsIcon from "../../assets/icons/SvgReportsIcon";
import SvgFinalLogo from "../../assets/icons/SvgFinalLogo";
import SvgAgentClientIcon from "../../assets/agentIcon/SvgAgentClientIcon";
import SvgAgentPaymentIcon from "../../assets/agentIcon/SvgAgentPaymentIcon";
import SvgAgentHomeIcon from "../../assets/agentIcon/SvgAgentHomeIcon";
import SvgAgentLeadIcon from "../../assets/agentIcon/SvgAgentLeadIcon";
import SvgAgentItemsIcon from "../../assets/agentIcon/SvgAgentItemsIcon";
import findNamesByPath from "../../utility/findSidBarNames";
import Cookies from "js-cookie";

const ResponsiveDrawer = () => {
  const [openSubMenu, setOpenSubMenu] = useState("Master");
  const [visible, setVisible] = useState(true);
  const location = useLocation();
  const [findPath, setPath] = useState("");
  const [selectedList, setSelectedList] = useState([])

  // Get user role from cookies
  const userRole = Cookies.get("USER_ROLE");

  // Filter menu based on user role - memoized to prevent unnecessary re-renders
  const filteredMenuList = useMemo(() => {
    return menuList.filter((menu) => {
      // If user is not admin, hide the Master menu
      if (userRole === "user" && menu.name === "Master") {
        return false;
      }
      return true;
    });
  }, [userRole]);

  const handleNavigation = (navigationPath) => {
    setPath(navigationPath);
    setOpenSubMenu("");
  };

  const handleClick = (name) => {

    setOpenSubMenu(name);
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
    setPath(location?.pathname);
    const selectedPaths = findNamesByPath(filteredMenuList, location?.pathname);
    setSelectedList([...selectedPaths])
  }, [location, filteredMenuList])

  return (
    <Sidebar
      visible={visible}
      style={{
        backgroundColor: "#1C2536 !important",
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
        backgroundColor: "#1C2536 !important",
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
          <SvgFinalLogo />
        </div>
        <Menu style={{ backgroundColor: "#1C2536 !important", border: "none" }}>
          {selectedList.length > 0 && filteredMenuList.map((data, index) => {
            console.log(data?.name, 'find matched data', data?.name === selectedList[0])
            return (
              <React.Fragment key={data.name}>
                <SubMenu
                  defaultOpen={data.name == selectedList[0] ? true : false}
                  // defaultOpen={true}
                  style={{
                    color: "#fff",
                    width: "100%",
                    paddingLeft: "8px",
                    backgroundColor:
                      data?.name == openSubMenu ||
                        data.submenu.some((subItem) => subItem.path === findPath)
                        ? "#36435c"
                        : "#1C2536",
                  }}
                  color="#fff"
                  label={data.name}
                  icon={
                    data.name === "Accounts" ? (
                      <SvgAccountIcon
                        color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                      />
                    ) : data.name === "Petty Cash" ? (
                      <SvgAccountIcon
                        color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                      />
                    ) : data.name === "Master" ? (
                      <SvgMassterIcon
                        color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                      />
                    ) : data.name === "Reports" ? (
                      <SvgReportsIcon
                        color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                      />
                    ) : data.name === "Broker" ? (
                      <SvgReportsIcon
                        color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                      />
                    ) : undefined
                  }

                  onClick={() => handleClick(data.name)}
                >
                  {data.submenu.map((subItem, subIndex) => {
                    return (
                      <React.Fragment key={subIndex}>
                        {subItem.submenu ? (
                          <SubMenu


                            label={subItem.name}
                            defaultOpen={subItem.name == selectedList[1] ? true : false}

                            style={{ marginLeft: -8 }}
                          >
                            {subItem.submenu.map((nestedItem, nestedIndex) => (
                              <React.Fragment key={nestedIndex}>
                                {nestedItem.submenu ? (
                                  <SubMenu
                                    label={nestedItem.name}
                                    defaultOpen={nestedItem.name == selectedList[2] ? true : false}
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
                                          onClick={() =>
                                            handleNavigation(subsubmenuItem.path)
                                          }
                                        >
                                          <div className="menu__list">
                                            <SvgDot
                                              color={
                                                subsubmenuItem.path === findPath
                                                  ? "#6366F1"
                                                  : "#1C2536"
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
                                      )
                                    )}
                                  </SubMenu>
                                ) : (
                                  <MenuItem
                                    key={nestedIndex}
                                    component={<Link to={nestedItem.path} />}
                                    onClick={() =>
                                      handleNavigation(nestedItem.path)
                                    }
                                  >
                                    <div className="menu__list">
                                      <SvgDot
                                        color={
                                          nestedItem.path === findPath
                                            ? "#6366F1"
                                            : "#1C2536"
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
                            onClick={() => handleNavigation(subItem.path)}
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
                                subItem.name === "Payments" ? (
                                subItem.name === "Home" ? (
                                  <SvgAgentHomeIcon
                                    color={
                                      subItem.path === findPath
                                        ? "#6366F1"
                                        : "#9DA4AE"
                                    }
                                  />
                                ) : subItem.name === "Leads" ? (
                                  <SvgAgentLeadIcon
                                    color={
                                      subItem.path === findPath
                                        ? "#6366F1"
                                        : "#9DA4AE"
                                    }
                                  />
                                ) : subItem.name === "Clients" ? (
                                  <SvgAgentClientIcon
                                    color={
                                      subItem.path === findPath
                                        ? "#6366F1"
                                        : "#9DA4AE"
                                    }
                                  />
                                ) : subItem.name === "Open Items" ? (
                                  <SvgAgentItemsIcon
                                    color={
                                      subItem.path === findPath
                                        ? "#6366F1"
                                        : "#9DA4AE"
                                    }
                                  />
                                ) : (
                                  <SvgAgentPaymentIcon
                                    color={
                                      subItem.path === findPath
                                        ? "#6366F1"
                                        : "#9DA4AE"
                                    }
                                  />
                                )
                              ) : (
                                <SvgDot
                                  color={
                                    subItem.path === findPath
                                      ? "#6366F1"
                                      : "#1C2536"
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
            )
          })}
        </Menu>
      </div>
    </Sidebar>
  );
};

export default ResponsiveDrawer;
