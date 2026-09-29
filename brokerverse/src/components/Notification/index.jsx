import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Badge } from "primereact/badge";
import { Checkbox } from "primereact/checkbox";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { Tooltip } from "primereact/tooltip";
import { useNotifications } from "../../hooks/useNotifications";
import { showSuccessMessage, showErrorMessage } from "../../utility/toastUtils";
import GobackComponent from "../GobackComponent";
import "./index.scss";

const NotificationScreen = () => {
  const { t } = useTranslation();
  const {
    notifications,
    loading,
    error,
    unreadCount,
    selectedNotifications,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    deleteNotification,
    deleteNotifications,
    toggleSelection,
    selectAll,
    clearSelection,
    refresh,
  } = useNotifications();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format time for display
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get priority severity
  const getPrioritySeverity = (priority) => {
    switch (priority) {
      case "HIGH":
        return "danger";
      case "NORMAL":
        return "info";
      case "LOW":
        return "success";
      default:
        return "info";
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
  };

  // Handle mark as read
  const handleMarkAsRead = async () => {
    if (selectedNotifications.length > 0) {
      await markMultipleAsRead(selectedNotifications);
    }
  };

  // Handle delete notification
  const handleDeleteClick = (notification) => {
    setNotificationToDelete(notification);
    setShowDeleteDialog(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (notificationToDelete) {
      await deleteNotification(notificationToDelete.id);
      setShowDeleteDialog(false);
      setNotificationToDelete(null);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedNotifications.length > 0) {
      await deleteNotifications(selectedNotifications);
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case "LEAD_CREATED":
        return "pi pi-user-plus";
      case "CLAIM_CREATED":
        return "pi pi-exclamation-triangle";
      case "POLICY_CREATED":
        return "pi pi-file";
      case "QUOTE_CREATED":
        return "pi pi-calculator";
      default:
        return "pi pi-bell";
    }
  };

  if (loading) {
    return (
      <div className="notification-loading">
        <div className="loading-spinner">
          <i className="pi pi-spin pi-spinner" style={{ fontSize: "2rem" }}></i>
          <p>{t("notificationPage.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notification-error">
        <div className="error-content">
          <i
            className="pi pi-exclamation-triangle"
            style={{ fontSize: "2rem", color: "#dc3545" }}
          ></i>
          <p>{t("notificationPage.errorLoading")} {error}</p>
          <Button
            label={t("notificationPage.retry")}
            icon="pi pi-refresh"
            onClick={refresh}
            className="p-button-outlined"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="notification-container">
      <GobackComponent />

      <div className="notification-header">
        <div className="header-left">
          <h1>{t("notificationPage.notifications")}</h1>
          <div className="notification-stats">
            <Badge
              value={unreadCount}
              severity="danger"
              className="unread-badge"
            />
            <span className="unread-text">
              {unreadCount} {unreadCount === 1 ? t("notificationPage.unread") : t("notificationPage.unread_plural")}
            </span>
          </div>
        </div>

        <div className="header-actions">
          <Button
            label={t("notificationPage.refresh")}
            icon="pi pi-refresh"
            className="p-button-outlined p-button-sm"
            onClick={refresh}
          />
          {unreadCount > 0 && (
            <Button
              label={t("notificationPage.markAllRead")}
              icon="pi pi-check"
              className="p-button-success p-button-sm"
              onClick={markAllAsRead}
            />
          )}
        </div>
      </div>

      {selectedNotifications.length > 0 && (
        <div className="bulk-actions">
          <div className="bulk-info">
            <span>
              {selectedNotifications.length} {t("notificationPage.selected")}
            </span>
          </div>
          <div className="bulk-buttons">
            <Button
              label={t("notificationPage.markAsRead")}
              icon="pi pi-check"
              className="p-button-success p-button-sm"
              onClick={handleMarkAsRead}
            />
            <Button
              label={t("common.delete")}
              icon="pi pi-trash"
              className="p-button-danger p-button-sm"
              onClick={handleBulkDelete}
            />
            <Button
              label={t("notificationPage.clearSelection")}
              icon="pi pi-times"
              className="p-button-text p-button-sm"
              onClick={clearSelection}
            />
          </div>
        </div>
      )}

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="no-notifications">
            <i
              className="pi pi-bell-slash"
              style={{ fontSize: "3rem", color: "#6c757d" }}
            ></i>
            <p>{t("notificationPage.noNotifications")}</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${
                !notification.isRead ? "unread" : ""
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-checkbox">
                <Checkbox
                  checked={selectedNotifications.includes(notification.id)}
                  onChange={() => toggleSelection(notification.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="notification-content">
                <div className="notification-header-item">
                  <div className="notification-title">
                    <i
                      className={`notification-icon ${getNotificationIcon(
                        notification.type
                      )}`}
                    ></i>
                    <span className="title-text">{notification.title}</span>
                    {!notification.isRead && (
                      <Badge
                        value={t("notificationPage.new")}
                        severity="info"
                        className="new-badge"
                      />
                    )}
                  </div>

                  <div className="notification-actions">
                    <Tag
                      value={notification.priority}
                      severity={getPrioritySeverity(notification.priority)}
                      className="priority-tag"
                    />
                    <Button
                      icon="pi pi-times"
                      className="p-button-rounded p-button-text p-button-sm delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(notification);
                      }}
                      tooltip={t("notificationPage.deleteNotificationTooltip")}
                    />
                  </div>
                </div>

                <div className="notification-message">
                  {notification.message}
                </div>

                <div className="notification-meta">
                  <span className="notification-time">
                    {formatTime(notification.createdAt)}
                  </span>
                  <span className="notification-date">
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog
        header={t("notificationPage.deleteNotification")}
        visible={showDeleteDialog}
        style={{ width: "400px" }}
        onHide={() => setShowDeleteDialog(false)}
        footer={
          <div>
            <Button
              label={t("common.cancel")}
              icon="pi pi-times"
              className="p-button-text"
              onClick={() => setShowDeleteDialog(false)}
            />
            <Button
              label={t("common.delete")}
              icon="pi pi-trash"
              className="p-button-danger"
              onClick={confirmDelete}
            />
          </div>
        }
      >
        <p>{t("notificationPage.deleteConfirm")}</p>
        {notificationToDelete && (
          <div className="notification-preview">
            <strong>{notificationToDelete.title}</strong>
            <p>{notificationToDelete.message}</p>
          </div>
        )}
      </Dialog>

      <Tooltip target=".delete-btn" />
    </div>
  );
};

export default NotificationScreen;
