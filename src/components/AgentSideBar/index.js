import React, { useState, useEffect } from "react";
import { Sidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";
import SvgLogo from "../../assets/icons/SvgLogo";
import SvgDot from "../../assets/icons/SvgDot";
import { menuList } from "./menu";
import "./index.scss";
import { Link, useNavigate } from "react-router-dom";
import SvgAccountIcon from "../../assets/icons/SvgAccountIcon";
import SvgMassterIcon from "../../assets/icons/SvgMassterIcon";
import SvgReportsIcon from "../../assets/icons/SvgReportsIcon";

const AgenSideBar = () => {
    const [findPath, setPath] = useState(null);
    const [openSubMenu, setOpenSubMenu] = useState("");
    const [visible, setVisible] = useState(true);
    const navigate = useNavigate()
    const handleNavigation = (navigationPath) => {
        setPath(navigationPath);
        setOpenSubMenu("");
    };

    const handleClick = (name) => {
        navigate(name)
    };

    useEffect(() => {
        const handleResize = () => {
            setVisible(window.innerWidth > 768);
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

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
            <div style={{ padding: "20px" }}>
                <div style={{ marginBottom: "20px", marginTop: "20px" }}>
                    <SvgLogo color={"#fff"} />
                </div>
                <Menu style={{ backgroundColor: "#1C2536 !important", border: "none" }}>
                    {menuList?.map((data, index) => (
                        <React.Fragment key={data.name}>
                            <SubMenu
                                style={{
                                    color: "#fff",
                                    width: "100%",
                                    backgroundColor:
                                        data.name === openSubMenu ||
                                            data.submenu?.some((subItem) => subItem.path === findPath)
                                            ? "#36435c"
                                            : "#1C2536",
                                }}
                                color="#fff"
                                label={data.name}
                                // icon={
                                //     data.name === "Accounts" ? (
                                //         <SvgAccountIcon
                                //             color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                                //         />
                                //     ) :
                                //         data.name === "Petty Cash" ? (
                                //             <SvgAccountIcon
                                //                 color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                                //             />
                                //         ) :
                                //             data.name === "Master" ? (
                                //                 <SvgMassterIcon
                                //                     color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                                //                 />
                                //             ) : data.name === "Reports" ? (
                                //                 <SvgReportsIcon
                                //                     color={data.name === openSubMenu ? "#6366F1" : "#Fff"}
                                //                 />
                                //             ) : undefined
                                // }
                                onClick={() => handleClick(data.path)}
                            >
                                {data.submenu && data.submenu.map((subItem, subIndex) => (
                                    <React.Fragment key={subIndex}>
                                        {subItem.submenu ? (
                                            <SubMenu
                                                label={subItem.name}
                                                style={{ /* Style for nested submenu */ }}
                                            >
                                                {subItem.submenu.map((nestedItem, nestedIndex) => (
                                                    <React.Fragment key={nestedIndex}>
                                                        {nestedItem.submenu ? (
                                                            <SubMenu
                                                                label={nestedItem.name}
                                                                style={{ /* Style for nested submenu */ }}
                                                            >
                                                                {nestedItem.submenu.map((subsubmenuItem, subsubmenuIndex) => (
                                                                    <MenuItem
                                                                        key={subsubmenuIndex}
                                                                        component={<Link to={subsubmenuItem.path} />}
                                                                        onClick={() => handleNavigation(subsubmenuItem.path)}
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
                                                                ))}
                                                            </SubMenu>
                                                        ) : (
                                                            <MenuItem
                                                                key={nestedIndex}
                                                                component={<Link to={nestedItem.path} />}
                                                                onClick={() => handleNavigation(nestedItem.path)}
                                                            >
                                                                <div className="menu__list">
                                                                    <SvgDot
                                                                        color={
                                                                            nestedItem.path === findPath ? "#6366F1" : "#1C2536"
                                                                        }
                                                                    />
                                                                    <span
                                                                        style={{
                                                                            color:
                                                                                nestedItem.path === findPath ? "#fff" : "#9DA4AE",
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
                                                <div className="menu__list">
                                                    <SvgDot
                                                        color={
                                                            subItem.path === findPath ? "#6366F1" : "#1C2536"
                                                        }
                                                    />
                                                    <span
                                                        style={{
                                                            color:
                                                                subItem.path === findPath ? "#fff" : "#9DA4AE",
                                                        }}
                                                        className="menu__text"
                                                    >
                                                        {subItem.name}
                                                    </span>
                                                </div>
                                            </MenuItem>
                                        )}
                                    </React.Fragment>
                                ))}
                            </SubMenu>
                        </React.Fragment>
                    ))}
                </Menu>
            </div>
        </Sidebar>
    );
};

export default AgenSideBar;
