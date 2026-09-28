import React, { useState, useEffect } from "react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Badge } from "primereact/badge";
import { useNotifications } from "../../hooks/useNotifications";

const NotificationTest = () => {
  const { notifications, loading, error, unreadCount, refresh } =
    useNotifications();

  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    setDebugInfo({
      notificationsCount: notifications.length,
      notifications: notifications,
      loading: loading,
      error: error,
      unreadCount: unreadCount,
      timestamp: new Date().toLocaleString(),
    });
  }, [notifications, loading, error, unreadCount]);

  return (
    <div className="notification-test">
      <Card title="Notification Test Component">
        <div className="debug-section">
          <h4>Debug Information</h4>
          <p>
            <strong>Loading:</strong> {loading ? "Yes" : "No"}
          </p>
          <p>
            <strong>Error:</strong> {error || "None"}
          </p>
          <p>
            <strong>Notifications Count:</strong> {notifications.length}
          </p>
          <p>
            <strong>Unread Count:</strong> {unreadCount}
          </p>
          <p>
            <strong>Last Updated:</strong> {debugInfo.timestamp}
          </p>
        </div>

        <div className="actions-section">
          <Button
            label="Refresh Notifications"
            icon="pi pi-refresh"
            onClick={refresh}
            className="p-button-primary"
          />
        </div>

        <div className="notifications-section">
          <h4>Raw Notifications Data</h4>
          <pre
            style={{
              background: "#f5f5f5",
              padding: "10px",
              borderRadius: "4px",
              fontSize: "12px",
              maxHeight: "300px",
              overflow: "auto",
            }}
          >
            {JSON.stringify(notifications, null, 2)}
          </pre>
        </div>

        <div className="display-section">
          <h4>Displayed Notifications</h4>
          {loading && <p>Loading notifications...</p>}
          {error && <p style={{ color: "red" }}>Error: {error}</p>}
          {notifications.length === 0 && !loading && !error && (
            <p>No notifications found</p>
          )}
          {notifications.length > 0 && (
            <div className="notification-list">
              {notifications.map((notification, index) => (
                <div
                  key={notification.id || index}
                  className="notification-item"
                >
                  <div className="notification-header">
                    <span className="notification-title">
                      {notification.title}
                    </span>
                    {!notification.isRead && (
                      <Badge value="NEW" severity="info" />
                    )}
                  </div>
                  <div className="notification-message">
                    {notification.message}
                  </div>
                  <div className="notification-meta">
                    <span>Type: {notification.type}</span>
                    <span>Priority: {notification.priority}</span>
                    <span>
                      Created:{" "}
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default NotificationTest;
