import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Badge } from "primereact/badge";
import { Tag } from "primereact/tag";
import { Paginator } from "primereact/paginator";
import { PAGE_SIZES, PAGE_REPORT, PAGINATOR_TEMPLATE } from "../../../hooks/useServerList";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../../hooks/useNotifications";
import { showSuccessMessage } from "../../../utility/toastUtils";
import NotificationFallback from "../../../components/NotificationFallback";
import { openConfirm } from "../../../components/ConfirmDialog";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";

const Notification = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    notifications,
    loading,
    error,
    unreadCount,
    pagination,
    markAsRead,
    deleteNotification,
    refresh,
    fetchNotifications,
  } = useNotifications();
  // the list is paged by the server (20 a page by default)
  const [pager, setPager] = useState({ first: 0, rows: 20 });
  const onPage = (e) => {
    setPager({ first: e.first, rows: e.rows });
    fetchNotifications({ page: e.page + 1, pageSize: e.rows });
  };

  const [, setSelectedNotification] = useState(null);

  const handleHomeNavigation = () => {
    navigate("/");
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    setSelectedNotification(notification);
  };

  const handleDeleteNotification = async (notification, e) => {
    e.stopPropagation();
    const deleted = await openConfirm({
      title: t("notificationPage.deleteTitle"),
      severity: "danger",
      message: t("notificationPage.deleteMessage"),
      facts: [
        { label: t("notificationPage.notification"), value: notification.title },
        { label: t("notificationPage.received"), value: notification.createdAt, type: "datetime", hidden: !notification.createdAt },
      ],
      confirmLabel: t("notificationPage.deleteAction"),
      onConfirm: () => deleteNotification(notification.id).catch(() => {
        throw new Error(t("notificationPage.deleteFailed"));
      }),
    });
    if (deleted) showSuccessMessage(t("notificationPage.deleteSuccess"));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return formatAppDate(date, { withTime: true });
  };

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

  if (loading && !notifications.length) {
    return (
      <div className="notificaition__container">
        <div className="notificaition__container__titles">{t("header.notification")}</div>
        <div className="loading-spinner">
          <i className="pi pi-spin pi-spinner" style={{ fontSize: "2rem" }} aria-label={t("notificationPage.loading")}></i>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notificaition__container">
        <div className="notificaition__container__titles">{t("header.notification")}</div>

        <div
          className="notificaition__container__back__btn mt-3 cursor-pointer"
          onClick={handleHomeNavigation}
        >
          <SvgLeftArrow />
          <div className="notificaition__container__back__btn__title">{t("sidebar.Home")}</div>
        </div>

        <div className="mt-2">
          <NotificationFallback onRetry={refresh} error={error} />
        </div>
      </div>
    );
  }

  return (
    <div className="notificaition__container">
      <div className="notificaition__container__titles">
        {t("header.notification")}
        {unreadCount > 0 && (
          <Badge
            value={unreadCount}
            severity="danger"
            className="unread-count-badge"
          />
        )}
      </div>

      <div
        className="notificaition__container__back__btn mt-3 cursor-pointer"
        onClick={handleHomeNavigation}
      >
        <SvgLeftArrow />
        <div className="notificaition__container__back__btn__title">{t("sidebar.Home")}</div>
      </div>

      <div className="grid mt-2">
        {notifications.length === 0 ? (
          <div className="col-12">
            <Card>
              <div className="no-notifications">
                <i
                  className="pi pi-bell-slash"
                  style={{ fontSize: "2rem", color: "#6c757d" }}
                ></i>
                <p>{t("notificationPage.noNotifications")}</p>
              </div>
            </Card>
          </div>
        ) : (
          notifications.map((notification) => (
            <div key={notification.id} className="col-12 md:col-12 lg:col-12">
              <Card
                className={`notification-card ${
                  !notification.isRead ? "unread" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="grid mt-2">
                  <div className="notificaition__title col-12 md:col-6 lg:col-6">
                    <div className="notification-header">
                      <i
                        className={`notification-icon ${getNotificationIcon(
                          notification.type
                        )}`}
                      ></i>
                      <span className="notification-title-text">
                        {notification.title}
                      </span>
                      {!notification.isRead && (
                        <Badge
                          value={t("notificationPage.new")}
                          severity="info"
                          className="new-badge"
                        />
                      )}
                    </div>
                  </div>
                  <div className="notificaition__dots col-12 md:col-6 lg:col-6">
                    <div className="notification-actions">
                      <Tag
                        value={notification.priority}
                        severity={getPrioritySeverity(notification.priority)}
                        className="priority-tag"
                      />
                      <Button
                        icon="pi pi-trash"
                        className="p-button-rounded p-button-text p-button-sm p-button-danger delete-btn"
                        onClick={(e) =>
                          handleDeleteNotification(notification, e)
                        }
                        tooltip={t("notificationPage.deleteNotificationTooltip")}
                        aria-label={t("notificationPage.deleteNotificationTooltip")}
                      />
                    </div>
                  </div>
                </div>

                <div className="notificaition__sub__title">
                  {notification.message}
                </div>

                <div className="grid" style={{ marginTop: "0.1rem" }}>
                  <div className="notificaition__title__sub col-12 md:col-6 lg:col-6">
                    <div className="notification-type">
                      {notification.type.replace("_", " ")}
                    </div>
                  </div>
                  <div className="notificaition__dots col-12 md:col-6 lg:col-6">
                    <div className="notificaition__title__sub__1">
                      {formatDate(notification.createdAt)}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))
        )}
      </div>
      {(pagination?.total || 0) > PAGE_SIZES[0] && (
        <Paginator first={pager.first} rows={pager.rows} totalRecords={pagination.total} rowsPerPageOptions={PAGE_SIZES} onPageChange={onPage}
          template={PAGINATOR_TEMPLATE} currentPageReportTemplate={PAGE_REPORT} className="mt-2" />
      )}
    </div>
  );
};

export default Notification;
