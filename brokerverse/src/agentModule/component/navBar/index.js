import React, { useRef, useState } from "react";
import { useLanguageOptions } from "../../../utility/languages";
import { ChangePasswordDialog, TwoFactorDialog } from "../../authModule/security/AccountSecurityDialogs";
import "./index.scss";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { Dropdown } from "primereact/dropdown";
import SvgClose from "../../../assets/agentIcon/SvgClose";
import SvgProfile from "../../../assets/agentIcon/SvgProfile";
import SvgHelp from "../../../assets/agentIcon/SvgHelp";
import SvgLogOut from "../../../assets/agentIcon/SvgLogout";
import { useNavigate } from "react-router-dom";
import { logout } from "../../../utility/logout";
import { useNotificationContext } from "../../../context/NotificationContext";
import SvgArrow from "../../../assets/icons/SvgArrow";
import Cookies from "js-cookie";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import InitialsAvatar from "../InitialsAvatar";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";

const AgentNavBar = () => {
  const menuRight = useRef(null);
  const menuProfile = useRef(null);
  // "password" | "2fa" | "" : the account security dialog that is open
  const [securityDialog, setSecurityDialog] = useState("");
  // configured languages that have a translation (see utility/languages.js)
  const languageOptions = useLanguageOptions();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { notifications, unreadCount, markAsRead, deleteNotification } =
    useNotificationContext();

  // Get user data from localStorage
  const userName = localStorage.getItem("USER_NAME") || "User";
  const userEmail = localStorage.getItem("USER_EMAIL") || "user@example.com";
  const currentLanguage = (i18n.language && i18n.language.startsWith("th")) ? "th" : "en";

  // Debug logging
  console.log("NavBar - Unread Count:", unreadCount);
  console.log("NavBar - Notifications:", notifications);

  const handleLogOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
      // Fallback: clear data and redirect
      navigate("/login");
    }
  };
  const handleNotificationNavigation = () => {
    navigate("/agent/notification");
  };

  const handleProfile = () => {
    navigate("/agent/viewprofile");
  };

  // Format notification data for display
  const formatNotificationData = (notification) => {
    return {
      id: notification.id,
      name: notification.title || t("header.notification"),
      policyNo: notification.message || t("common.noDetails"),
      status: getStatusFromType(notification.type),
      date: formatDate(notification.createdAt),
      isRead: notification.isRead,
    };
  };

  // Get status based on notification type
  const getStatusFromType = (type) => {
    switch (type) {
      case "LEAD_CREATED":
        return t("header.newLeadCreated");
      case "POLICY_CREATED":
        return t("header.policyCreated");
      case "POLICY_ACTIVATED":
        return t("header.policyActivated");
      case "PAYMENT_COMPLETED":
        return t("header.paymentCompleted");
      case "QUOTE_CREATED":
        return t("header.quoteCreated");
      case "CLAIM_CREATED":
        return t("header.claimCreated");
      default:
        return t("header.notification");
    }
  };

  // Format date for display (use Thai locale when language is Thai)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return formatAppDate(date, { withTime: true });
  };

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
  };

  // Handle notification delete
  const handleNotificationDelete = async (notificationId, e) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };
  const items = [
    {
      label: (
        <div
          style={{
            fontFamily: "Nunito, Arial, sans-serif",
            fontWeight: 500,
            fontSize: "24px",
            color: "#111927",
          }}
        >
          {t("header.notification")}
        </div>
      ),
      items: notifications.slice(0, 5).map((notification) => {
        const item = formatNotificationData(notification);
        return {
          template: (
            <div>
              <div
                className="grid m-0"
                style={{
                  padding: "1rem",
                  borderRadius: "10px",
                  backgroundColor: !notification.isRead
                    ? "#fff3cd"
                    : "transparent",
                  borderLeft: !notification.isRead
                    ? "4px solid #ffc107"
                    : "none",
                }}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="col-8 md:col-8 lg:col-8">
                  <div
                    style={{
                      color: "#111927",
                      fontFamily: "Nunito, Arial, sans-serif",
                      fontWeight: 500,
                      fontSize: "14px",
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      color: "#6C737F",
                      fontFamily: "Nunito, Arial, sans-serif",
                      fontWeight: 500,
                      fontSize: "14px",
                    }}
                    className="mt-1"
                  >
                    {item.policyNo}
                  </div>
                  <div
                    style={{
                      color: "#0072d8",
                      fontFamily: "Nunito, Arial, sans-serif",
                      fontWeight: 500,
                      fontSize: "14px",
                    }}
                    className="mt-1"
                  >
                    {item.status}
                  </div>
                  <div
                    style={{
                      color: "#6C737F",
                      fontFamily: "Nunito, Arial, sans-serif",
                      fontWeight: 500,
                      fontSize: "12px",
                    }}
                    className="mt-1"
                  >
                    {item.date}
                  </div>
                </div>
                <div
                  className="col-4 md:col-4 lg:col-4"
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    padding: "15px",
                  }}
                >
                  <div
                    onClick={(e) =>
                      handleNotificationDelete(notification.id, e)
                    }
                  >
                    <SvgClose />
                  </div>
                </div>
              </div>
            </div>
          ),
        };
      }),
    },
    {
      label: (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#111927",
            fontFamily: "Nunito, Arial, sans-serif",
            fontSize: "14px",
            fontWeight: 400,
          }}
          onClick={handleNotificationNavigation}
        >
          {t("common.seeMore")} <SvgArrow />
        </div>
      ),
    },
  ];

  const Profileitems = [
    {
      label: (
        <div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
            }}
          >
            {userName}
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#6C737F",
            }}
            className="mt-2"
          >
            {userEmail}
          </div>
        </div>
      ),
      items: [
        {
          label: (
            <div
              style={{
                fontFamily: "Nunito, Arial, sans-serif",
                fontWeight: 400,
                fontSize: "16px",
                color: "#111927",
              }}
              onClick={handleProfile}
            >
              {t("header.profile")}
            </div>
          ),
          icon: (
            <div className="mr-3">
              <SvgProfile onClick={handleProfile} />
            </div>
          ),
        },
        {
          label: (
            <div style={{ fontFamily: "Nunito, Arial, sans-serif", fontWeight: 400, fontSize: "16px", color: "#111927" }}>
              {t("security.changePassword")}
            </div>
          ),
          icon: (
            <div className="mr-3">
              <i className="pi pi-key" aria-hidden="true" style={{ fontSize: "1.1rem", color: "#6C737F" }} />
            </div>
          ),
          command: () => setSecurityDialog("password"),
        },
        {
          label: (
            <div style={{ fontFamily: "Nunito, Arial, sans-serif", fontWeight: 400, fontSize: "16px", color: "#111927" }}>
              {t("security.twoFactor")}
            </div>
          ),
          icon: (
            <div className="mr-3">
              <i className="pi pi-shield" aria-hidden="true" style={{ fontSize: "1.1rem", color: "#6C737F" }} />
            </div>
          ),
          command: () => setSecurityDialog("2fa"),
        },
        {
          label: (
            <div
              style={{
                fontFamily: "Nunito, Arial, sans-serif",
                fontWeight: 400,
                fontSize: "16px",
                color: "#111927",
              }}
            >
              {t("header.help")}
            </div>
          ),
          icon: (
            <div className="mr-3">
              <SvgHelp />
            </div>
          ),
        },
        {
          label: (
            <div
              style={{
                fontFamily: "Nunito, Arial, sans-serif",
                fontWeight: 400,
                fontSize: "16px",
                color: "#111927",
              }}
              onClick={() => handleLogOut()}
            >
              {t("header.logout")}
            </div>
          ),
          icon: (
            <div className="mr-3">
              <SvgLogOut />
            </div>
          ),
        },
      ],
    },
  ];

  const menuStyle = {
    width: "360px",
    maxHeight: "100vh",
    overflowY: "scroll",
    left: "calc(100% - 400px)",
  };

  return (
    <div className="Agentnavbar__container">
      <div className="bdo-logo-section">
        {/* <img
          src="/iorta.png"
          alt="iortaTechNxt Logo"
          className="bdo-logo-nav"
        /> */}
      </div>
      <div className="nav-spacer"></div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Dropdown
          value={currentLanguage}
          options={languageOptions}
          onChange={(e) => i18n.changeLanguage(e.value)}
          aria-label={t("common.language")}
          style={{ minWidth: "100px" }}
          className="language-selector-navbar"
        />
        <Menu
          model={items}
          popup
          ref={menuRight}
          id="popup_menu_right"
          popupAlignment="right"
          style={menuStyle}
        />
        <div className="notification-badge-container">
          <Button
            icon="pi pi-bell"
            className="p-button-text p-button-lg notification-button-hover"
            onClick={(event) => menuRight.current.toggle(event)}
            aria-controls="popup_menu_right"
            aria-haspopup
            style={{
              position: "relative",
              fontSize: "1.2rem",
              color: "#6c757d",
              border: "none",
              background: "transparent",
              padding: "0.5rem",
              borderRadius: "50%",
              transition: "all 0.3s ease",
            }}
          />
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
      <Menu
        model={Profileitems}
        popup
        ref={menuProfile}
        id="popup_menu_right"
        popupAlignment="right"
        //   style={menuStyle}
      />
      <Button
        className="p-0"
        onClick={(event) => menuProfile.current.toggle(event)}
        aria-controls="popup_menu_right"
        aria-haspopup
      >
        <InitialsAvatar size="40px" className="navbar__container__profile__image" />
      </Button>
      <ChangePasswordDialog visible={securityDialog === "password"} onHide={() => setSecurityDialog("")} />
      <TwoFactorDialog visible={securityDialog === "2fa"} onHide={() => setSecurityDialog("")} />
    </div>
  );
};

export default AgentNavBar;
