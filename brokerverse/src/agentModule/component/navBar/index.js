import { useEffect, useMemo, useRef, useState } from "react";
import { showLanguagePicker, useLanguageOptions } from "../../../utility/languages";
import { ChangePasswordDialog, TwoFactorDialog } from "../../authModule/security/AccountSecurityDialogs";
import "./index.scss";
import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { OverlayPanel } from "primereact/overlaypanel";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import { logout } from "../../../utility/logout";
import { useNotificationContext } from "../../../context/NotificationContext";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import InitialsAvatar from "../InitialsAvatar";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import { currentUser, displayNameOf, roleLineOf } from "../../../utility/userIdentity";
import profileService, { PROFILE_UPDATED_EVENT } from "../../../services/profileService";
import logger from "../../../utility/logger";
import { openHelp } from "../../../components/HelpPanel/helpEvents";

export const PROFILE_PATH = "/account/profile";
/** Notifications listed in the bell panel (the full list is on the Notifications page). */
const PANEL_SIZE = 6;

/** Unread count as shown on the bell: 1..99, then "99+". */
export const badgeText = (count) => (count > 99 ? "99+" : String(count));

/** Newest first, whatever order the list arrived in. */
export const newestFirst = (list) =>
  [...(list || [])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

const TYPE_ICON = {
  LEAD_CREATED: "pi-user-plus",
  CLAIM_CREATED: "pi-exclamation-triangle",
  POLICY_CREATED: "pi-file",
  POLICY_ACTIVATED: "pi-file-check",
  QUOTE_CREATED: "pi-calculator",
  PAYMENT_COMPLETED: "pi-wallet",
};

const AgentNavBar = () => {
  const notificationPanel = useRef(null);
  const menuProfile = useRef(null);
  // "password" | "2fa" | "" : the account security dialog that is open
  const [securityDialog, setSecurityDialog] = useState("");
  // configured languages that have a translation (see utility/languages.js); the picker only when there is a choice
  const languageOptions = useLanguageOptions();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotificationContext();
  const [me, setMe] = useState(() => currentUser());

  // Name, initials and role names from the profile (also after the user edits it on My Profile)
  useEffect(() => {
    let live = true;
    profileService
      .getCachedProfile()
      .then((p) => live && setMe((m) => ({ ...m, ...p })))
      .catch(() => {});
    const onUpdate = (e) => setMe((m) => ({ ...m, ...(e.detail || {}) }));
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate);
    return () => {
      live = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate);
    };
  }, []);

  const name = displayNameOf(me);
  const roleLine = roleLineOf(me);
  const currentLanguage =
    languageOptions.find((o) => i18n.language && i18n.language.startsWith(o.value))?.value || languageOptions[0]?.value;

  const handleLogOut = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error("Logout failed:", error);
      navigate("/login");
    }
  };

  const typeLabel = (type) => {
    const key = {
      LEAD_CREATED: "newLeadCreated",
      POLICY_CREATED: "policyCreated",
      POLICY_ACTIVATED: "policyActivated",
      PAYMENT_COMPLETED: "paymentCompleted",
      QUOTE_CREATED: "quoteCreated",
      CLAIM_CREATED: "claimCreated",
    }[type];
    return key ? t(`header.${key}`) : "";
  };

  const latest = useMemo(() => newestFirst(notifications).slice(0, PANEL_SIZE), [notifications]);

  const openNotification = async (n) => {
    if (!n.isRead) await markAsRead(n.id);
  };

  const removeNotification = async (id, e) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  const menuItem = (label, icon, command) => ({ label, icon: `pi ${icon}`, command, className: "bv-user-menu__item" });

  const profileItems = [
    {
      label: (
        <div className="bv-user-menu__who">
          <InitialsAvatar person={me} size="40px" />
          <div className="bv-user-menu__who-text">
            <div className="bv-user-menu__name">{name}</div>
            {roleLine && <div className="bv-user-menu__role">{roleLine}</div>}
          </div>
        </div>
      ),
      items: [
        menuItem(t("header.profile"), "pi-user", () => navigate(PROFILE_PATH)),
        menuItem(t("security.changePassword"), "pi-key", () => setSecurityDialog("password")),
        menuItem(t("security.twoFactor"), "pi-shield", () => setSecurityDialog("2fa")),
        menuItem(t("header.help"), "pi-question-circle", openHelp),
      ],
    },
    { separator: true },
    menuItem(t("header.logout"), "pi-sign-out", handleLogOut),
  ];

  return (
    <div className="Agentnavbar__container">
      <div className="bdo-logo-section"></div>
      <div className="nav-spacer"></div>
      <div className="bv-topbar__tools">
        {showLanguagePicker(languageOptions) && (
          <Dropdown
            value={currentLanguage}
            options={languageOptions}
            onChange={(e) => i18n.changeLanguage(e.value)}
            aria-label={t("common.language")}
            className="language-selector-navbar"
          />
        )}
        <div className="notification-badge-container">
          <Button
            type="button"
            icon="pi pi-bell"
            className="p-button-text p-button-rounded bv-topbar__icon-btn"
            onClick={(event) => notificationPanel.current.toggle(event)}
            aria-haspopup
            aria-controls="bv-notification-panel"
            aria-label={unreadCount > 0 ? t("header.notificationsUnread", { count: unreadCount }) : t("header.notifications")}
          />
          {unreadCount > 0 && (
            <span className="notification-badge" aria-hidden="true">
              {badgeText(unreadCount)}
            </span>
          )}
        </div>
        <OverlayPanel ref={notificationPanel} id="bv-notification-panel" className="bv-notification-panel" aria-label={t("header.notifications")}>
          <div className="bv-notification-panel__head">
            <div className="bv-notification-panel__title">
              {t("header.notifications")}
              {unreadCount > 0 && <span className="bv-notification-panel__count">{t("header.unreadCount", { count: unreadCount })}</span>}
            </div>
            <Button
              type="button"
              label={t("header.markAllRead")}
              className="p-button-text p-button-sm bv-notification-panel__mark"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            />
          </div>
          {latest.length === 0 ? (
            <div className="bv-notification-panel__empty">
              <i className="pi pi-inbox" aria-hidden="true" />
              {t("header.noNotifications")}
            </div>
          ) : (
            <ul className="bv-notification-panel__list">
              {latest.map((n) => (
                <li key={n.id} className={`bv-notification ${n.isRead ? "" : "is-unread"}`}>
                  <button type="button" className="bv-notification__body" onClick={() => openNotification(n)}>
                    <span className="bv-notification__icon" aria-hidden="true">
                      <i className={`pi ${TYPE_ICON[n.type] || "pi-bell"}`} />
                    </span>
                    <span className="bv-notification__text">
                      <span className="bv-notification__title">{n.title || typeLabel(n.type) || t("header.notification")}</span>
                      {n.message && <span className="bv-notification__message">{n.message}</span>}
                      <span className="bv-notification__meta">
                        {typeLabel(n.type) && <span>{typeLabel(n.type)}</span>}
                        <span>{formatAppDate(n.createdAt, { withTime: true })}</span>
                      </span>
                    </span>
                    {!n.isRead && <span className="bv-notification__dot" aria-label={t("header.unread")} />}
                  </button>
                  <Button
                    type="button"
                    icon="pi pi-times"
                    className="p-button-text p-button-rounded p-button-sm bv-notification__remove"
                    aria-label={t("header.removeNotification")}
                    onClick={(e) => removeNotification(n.id, e)}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="bv-notification-panel__foot">
            <Button
              type="button"
              label={t("header.viewAllNotifications")}
              icon="pi pi-arrow-right"
              iconPos="right"
              className="p-button-text p-button-sm"
              onClick={(e) => {
                notificationPanel.current.hide(e);
                navigate("/agent/notification");
              }}
            />
          </div>
        </OverlayPanel>
      </div>
      <Menu model={profileItems} popup ref={menuProfile} id="bv-user-menu" popupAlignment="right" className="bv-user-menu" />
      <Button
        type="button"
        className="p-0 bv-topbar__avatar-btn"
        onClick={(event) => menuProfile.current.toggle(event)}
        aria-controls="bv-user-menu"
        aria-haspopup
        aria-label={t("header.accountMenu", { name })}
      >
        <InitialsAvatar person={me} size="40px" className="navbar__container__profile__image" />
      </Button>
      <ChangePasswordDialog visible={securityDialog === "password"} onHide={() => setSecurityDialog("")} />
      <TwoFactorDialog visible={securityDialog === "2fa"} onHide={() => setSecurityDialog("")} />
    </div>
  );
};

export default AgentNavBar;
