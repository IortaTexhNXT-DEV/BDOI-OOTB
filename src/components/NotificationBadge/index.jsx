import React from "react";
import { Badge } from "primereact/badge";
import { useNotificationContext } from "../../context/NotificationContext";
import "./index.scss";

const NotificationBadge = ({
  showCount = true,
  maxCount = 99,
  className = "",
  size = "normal",
  onClick,
}) => {
  const { unreadCount, hasUnread } = useNotificationContext();

  const displayCount = showCount ? Math.min(unreadCount, maxCount) : "";
  const showBadge = hasUnread && unreadCount > 0;

  if (!showBadge) {
    return null;
  }

  return (
    <div
      className={`notification-badge ${className} ${size}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <i className="pi pi-bell notification-icon" />
      {showCount && (
        <Badge
          value={displayCount}
          severity="danger"
          className="notification-count"
        />
      )}
    </div>
  );
};

export default NotificationBadge;
