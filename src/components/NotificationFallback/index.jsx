import React from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import "./index.scss";

const NotificationFallback = ({ onRetry, error }) => {
  const { t } = useTranslation();
  return (
    <div className="notification-fallback">
      <Card title={t("notificationPage.unavailable")}>
        <div className="fallback-warning">
          <i
            className="pi pi-exclamation-triangle"
            style={{ color: "#f39c12", marginRight: "8px" }}
          ></i>
          <span>{t("notificationPage.unableToLoad")}</span>
          <Button
            label={t("notificationPage.retry")}
            icon="pi pi-refresh"
            size="small"
            onClick={onRetry}
            className="p-button-outlined p-button-sm"
            style={{ marginLeft: "10px" }}
          />
        </div>

        <div className="fallback-info mt-3">
          <p>
            <strong>{t("common.error")}:</strong> {error}
          </p>
          <p>
            <strong>{t("common.note")}:</strong> {t("notificationPage.checkConnection")}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default NotificationFallback;
