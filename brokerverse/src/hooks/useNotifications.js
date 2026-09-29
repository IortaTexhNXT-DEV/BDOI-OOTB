import { useState, useEffect, useCallback, useRef } from "react";
import notificationService from "../services/notificationService";
import { showSuccessMessage, showErrorMessage } from "../utility/toastUtils";

export const useNotifications = (initialParams = {}) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotifications, setSelectedNotifications] = useState([]);

  // Use ref to store initial params to prevent infinite re-renders
  const initialParamsRef = useRef(initialParams);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);

      try {
        const response = await notificationService.getNotifications({
          ...initialParamsRef.current,
          ...params,
        });

        // Handle different response structures - API returns {success: true, data: {notifications: [], pagination: {}, unreadCount: 0}}
        const notificationsData =
          response.data?.data?.notifications ||
          response.data?.notifications ||
          response.data ||
          [];
        const paginationData =
          response.data?.data?.pagination ||
          response.data?.pagination ||
          response.pagination ||
          {};
        const unreadCountData =
          response.data?.data?.unreadCount ||
          response.data?.unreadCount ||
          response.unreadCount ||
          0;

        setNotifications(
          Array.isArray(notificationsData) ? notificationsData : []
        );
        setPagination(paginationData);
        setUnreadCount(unreadCountData);
      } catch (err) {
        const errorMessage = err.message || "Failed to fetch notifications";
        setError(errorMessage);

        // If it's a 500 error, show a more user-friendly message
        if (err.message?.includes("500")) {
          setError(
            "Server error: Unable to load notifications. Please try again later."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [] // Remove initialParams dependency to prevent infinite loop
  );

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);

      // Update local state
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
      showSuccessMessage("Notification marked as read");
    } catch (err) {
      showErrorMessage("Failed to mark notification as read");
    }
  }, []);

  // Mark multiple notifications as read
  const markMultipleAsRead = useCallback(
    async (notificationIds) => {
      try {
        await notificationService.markNotificationsAsRead(notificationIds);

        // Update local state
        setNotifications((prev) =>
          prev.map((notification) =>
            notificationIds.includes(notification.id)
              ? {
                  ...notification,
                  isRead: true,
                  readAt: new Date().toISOString(),
                }
              : notification
          )
        );

        const unreadCount = notificationIds.filter((id) =>
          notifications.find((n) => n.id === id && !n.isRead)
        ).length;

        setUnreadCount((prev) => Math.max(0, prev - unreadCount));
        setSelectedNotifications([]);
        showSuccessMessage(
          `${notificationIds.length} notifications marked as read`
        );
      } catch (err) {
        showErrorMessage("Failed to mark notifications as read");
      }
    },
    [notifications]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllNotificationsAsRead();

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
      setSelectedNotifications([]);
      showSuccessMessage("All notifications marked as read");
    } catch (err) {
      showErrorMessage("Failed to mark all notifications as read");
    }
  }, []);

  // Delete single notification
  const deleteNotification = useCallback(
    async (notificationId) => {
      try {
        await notificationService.deleteNotification(notificationId);

        // Update local state
        const deletedNotification = notifications.find(
          (n) => n.id === notificationId
        );
        setNotifications((prev) =>
          prev.filter((notification) => notification.id !== notificationId)
        );

        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        setSelectedNotifications((prev) =>
          prev.filter((id) => id !== notificationId)
        );
        showSuccessMessage("Notification deleted");
      } catch (err) {
        showErrorMessage("Failed to delete notification");
      }
    },
    [notifications]
  );

  // Delete multiple notifications
  const deleteNotifications = useCallback(
    async (notificationIds) => {
      try {
        await notificationService.deleteNotifications(notificationIds);

        // Update local state
        const deletedNotifications = notifications.filter((n) =>
          notificationIds.includes(n.id)
        );
        const unreadDeletedCount = deletedNotifications.filter(
          (n) => !n.isRead
        ).length;

        setNotifications((prev) =>
          prev.filter(
            (notification) => !notificationIds.includes(notification.id)
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - unreadDeletedCount));
        setSelectedNotifications([]);
        showSuccessMessage(`${notificationIds.length} notifications deleted`);
      } catch (err) {
        showErrorMessage("Failed to delete notifications");
      }
    },
    [notifications]
  );

  // Toggle notification selection
  const toggleSelection = useCallback((notificationId) => {
    setSelectedNotifications((prev) =>
      prev.includes(notificationId)
        ? prev.filter((id) => id !== notificationId)
        : [...prev, notificationId]
    );
  }, []);

  // Select all notifications
  const selectAll = useCallback(() => {
    setSelectedNotifications(notifications.map((n) => n.id));
  }, [notifications]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedNotifications([]);
  }, []);

  // Refresh notifications
  const refresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]); // Now safe to include fetchNotifications dependency

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]); // Now safe to include fetchNotifications dependency

  return {
    // Data
    notifications,
    loading,
    error,
    pagination,
    unreadCount,
    selectedNotifications,

    // Actions
    fetchNotifications,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    deleteNotification,
    deleteNotifications,
    toggleSelection,
    selectAll,
    clearSelection,
    refresh,

    // Computed values
    hasUnread: unreadCount > 0,
    hasSelected: selectedNotifications.length > 0,
    selectedCount: selectedNotifications.length,
    unreadNotifications: notifications.filter((n) => !n.isRead),
    readNotifications: notifications.filter((n) => n.isRead),
  };
};

export default useNotifications;
