import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useLocation } from "react-router-dom";
import notificationService from "../services/notificationService";
import authService from "../services/authService";
import logger from "../utility/logger";

/** Notifications are per user: nothing is fetched or polled on the sign-in page or after sign-out. */
const signedIn = () => Boolean(authService.getAccessToken());

const NotificationContext = createContext();

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider"
    );
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const { pathname } = useLocation();

  // Fetch notifications
  const fetchNotifications = useCallback(async (params = {}) => {
    if (!signedIn()) return;
    setLoading(true);
    try {
      const response = await notificationService.getNotifications(params);

      // Handle the nested data structure: {success: true, data: {notifications: [], unreadCount: 0}}
      const notificationsData =
        response.data?.data?.notifications ||
        response.data?.notifications ||
        [];
      const unreadCountData =
        response.data?.data?.unreadCount || response.data?.unreadCount || 0;

      setNotifications(
        Array.isArray(notificationsData) ? notificationsData : []
      );
      setUnreadCount(unreadCountData);
      setLastFetch(new Date());

      // Debug logging
    } catch (error) {
      logger.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : notification
        )
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      logger.error("Error marking notification as read:", error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllNotificationsAsRead();

      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      logger.error("Error marking all notifications as read:", error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId) => {
      try {
        await notificationService.deleteNotification(notificationId);

        const deletedNotification = notifications.find(
          (n) => n.id === notificationId
        );
        setNotifications((prev) =>
          prev.filter((notification) => notification.id !== notificationId)
        );

        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        logger.error("Error deleting notification:", error);
      }
    },
    [notifications]
  );

  // Get unread count
  const getUnreadCount = useCallback(async () => {
    if (!signedIn()) return;
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      logger.error("Error fetching unread count:", error);
    }
  }, []);

  // Auto-refresh notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        getUnreadCount();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, getUnreadCount]);

  // First fetch once signed in (the provider is mounted on the sign-in page too); cleared after sign-out
  useEffect(() => {
    if (!signedIn()) {
      setNotifications([]);
      setUnreadCount(0);
      setLastFetch(null);
      return;
    }
    if (!lastFetch) fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, fetchNotifications]);

  const value = {
    // State
    notifications,
    unreadCount,
    loading,
    lastFetch,

    // Actions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount,

    // Computed
    hasUnread: unreadCount > 0,
    unreadNotifications: notifications.filter((n) => !n.isRead),
    readNotifications: notifications.filter((n) => n.isRead),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
