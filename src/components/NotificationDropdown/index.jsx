import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { OverlayPanel } from "primereact/overlaypanel";
import { Button } from "primereact/button";
import { Badge } from "primereact/badge";
import { ScrollPanel } from "primereact/scrollpanel";
import { useNotificationContext } from "../../context/NotificationContext";
import NotificationBadge from "../NotificationBadge";
import "./index.scss";

const NotificationDropdown = () => {
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    markAsRead,
    deleteNotification,
    fetchNotifications,
  } = useNotificationContext();

  const [showDropdown, setShowDropdown] = useState(false);
  const overlayRef = useRef(null);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      fetchNotifications();
    }
  }, [showDropdown, fetchNotifications]);

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    setShowDropdown(false);
  };

  const handleDeleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return t("notificationPage.justNow");
    if (diffInMinutes < 60) return t("notificationPage.minutesAgo", { count: diffInMinutes });
    if (diffInMinutes < 1440) return t("notificationPage.hoursAgo", { count: Math.floor(diffInMinutes / 60) });
    return t("notificationPage.daysAgo", { count: Math.floor(diffInMinutes / 1440) });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "LEAD_CREATED":
        return "pi pi-user-plus";
      case "CLAIM_CREATED":
        return "pi pi-exclamation-triangle";
      case "POLICY_CREATED":
      case "POLICY_ACTIVATED":
        return "pi pi-file";
      case "QUOTE_CREATED":
        return "pi pi-calculator";
      case "PAYMENT_COMPLETED":
        return "pi pi-wallet";
      default:
        return "pi pi-bell";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "HIGH":
        return "#dc3545";
      case "NORMAL":
        return "#007bff";
      case "LOW":
        return "#28a745";
      default:
        return "#6c757d";
    }
  };

  return (
    <div className="notification-dropdown">
      <Button
        icon="pi pi-bell"
        className="p-button-text notification-trigger"
        onClick={(e) => overlayRef.current.toggle(e)}
        aria-label={t("common.notification")}
      >
        <NotificationBadge showCount={true} />
      </Button>

      <OverlayPanel
        ref={overlayRef}
        className="notification-overlay"
        onShow={() => setShowDropdown(true)}
        onHide={() => setShowDropdown(false)}
      >
        <div className="notification-dropdown-content">
          <div className="notification-header">
            <h3>{t("common.notification")}</h3>
            {unreadCount > 0 && (
              <Badge
                value={unreadCount}
                severity="danger"
                className="unread-count"
              />
            )}
          </div>

          <ScrollPanel
            style={{ height: "400px" }}
            className="notification-scroll"
          >
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <i
                  className="pi pi-bell-slash"
                  style={{ fontSize: "2rem", color: "#6c757d" }}
                ></i>
                <p>{t("notificationPage.noNotifications")}</p>
              </div>
            ) : (
              <div className="notification-list">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${
                      !notification.isRead ? "unread" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-icon">
                      <i className={getNotificationIcon(notification.type)}></i>
                    </div>

                    <div className="notification-content">
                      <div className="notification-title">
                        {notification.title}
                        {!notification.isRead && (
                          <div className="unread-indicator"></div>
                        )}
                      </div>
                      <div className="notification-message">
                        {notification.message}
                      </div>
                      <div className="notification-meta">
                        <span
                          className="notification-priority"
                          style={{
                            color: getPriorityColor(notification.priority),
                          }}
                        >
                          {notification.priority}
                        </span>
                        <span className="notification-time">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="notification-actions">
                      <Button
                        icon="pi pi-times"
                        className="p-button-rounded p-button-text p-button-sm delete-btn"
                        onClick={(e) =>
                          handleDeleteNotification(notification.id, e)
                        }
                        tooltip={t("notificationPage.deleteNotificationTooltip")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollPanel>

          <div className="notification-footer">
            <Button
              label={t("notificationPage.viewAll")}
              icon="pi pi-external-link"
              className="p-button-text p-button-sm"
              onClick={() => {
                setShowDropdown(false);
                // Navigate to full notification page
                window.location.href = "/agent/notification";
              }}
            />
          </div>
        </div>
      </OverlayPanel>
    </div>
  );
};

export default NotificationDropdown;
