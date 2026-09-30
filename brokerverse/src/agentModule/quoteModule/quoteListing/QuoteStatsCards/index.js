import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { useDispatch, useSelector } from "react-redux";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { getQuotationStatsMiddleware } from "../../Store/quotationMiddleware";
import "./index.scss";

import { numberLocale } from "../../../../utility/currencyConverter";
const QuoteStatsCards = ({ leadRefId }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const dispatch = useDispatch();
  const { quotationStats, loading, error } = useSelector(
    ({ quotationReducers }) => ({
      quotationStats: quotationReducers?.quotationStats || {
        totalQuotations: 0,
        recentQuotations: 0,
        last30DaysQuotations: 0,
        convertedToPolicyCount: 0,
        approvedQuotations: 0,
        pendingQuotations: 0,
        activeQuotationsCount: 0,
        conversionRate: 0,
        approvalRate: 0,
        growthRate: 0,
        averagePremium: 0,
        totalPremiumValue: 0,
        averageApprovedPremium: 0,
        quotationsByStatus: [],
        quotationsByProductType: [],
      },
      loading: quotationReducers?.loading || false,
      error: quotationReducers?.error || null,
    })
  );

  useEffect(() => {
    dispatch(getQuotationStatsMiddleware({ leadRefId: leadRefId || null }));
  }, [dispatch, leadRefId]);

  // Calculate active quotations count (fallback if not provided by backend)
  const activeQuotationsCount =
    quotationStats.activeQuotationsCount !== undefined &&
    quotationStats.activeQuotationsCount !== null
      ? quotationStats.activeQuotationsCount
      : quotationStats.totalQuotations -
        quotationStats.convertedToPolicyCount -
        (quotationStats.quotationsByStatus
          .filter((s) =>
            ["Rejected", "Expired", "Cancelled", "Dropped"].includes(s.status)
          )
          .reduce((sum, s) => sum + (s.count || 0), 0) || 0);

  // Map API status to translation key for card title
  const getStatusTitleKey = (status) => {
    const keyMap = {
      Draft: "quoteStats.statusDraft",
      Approved: "quoteStats.statusApproved",
      Pending: "quoteStats.statusPending",
      ConvertedToPolicy: "quoteStats.statusConvertedToPolicy",
      Rejected: "quoteStats.statusRejected",
      Dropped: "quoteStats.statusDropped",
      Expired: "quoteStats.statusExpired",
      Cancelled: "quoteStats.statusCancelled",
      CustomerAccepted: "quoteStats.statusCustomerAccepted",
      PendingCustomer: "quoteStats.statusPendingCustomer",
      SubmittedToInsurer: "quoteStats.statusSubmittedToInsurer",
      InProgress: "quoteStats.statusInProgress",
    };
    return keyMap[status] ? t(keyMap[status]) : status;
  };

  // Get status color and icon mapping
  const getStatusConfig = (status) => {
    const statusMap = {
      ConvertedToPolicy: {
        color: "#4caf50",
        icon: "pi-shield",
        severity: "success",
      },
      Approved: { color: "#2196f3", icon: "pi-check-circle", severity: "info" },
      Pending: { color: "#ff9800", icon: "pi-hourglass", severity: "warning" },
      Rejected: {
        color: "var(--color-danger)",
        icon: "pi-times-circle",
        severity: "danger",
      },
      Dropped: { color: "#9e9e9e", icon: "pi-ban", severity: "secondary" },
      Expired: { color: "#795548", icon: "pi-clock", severity: "warning" },
      Cancelled: { color: "#607d8b", icon: "pi-times", severity: "secondary" },
      Draft: { color: "#9c27b0", icon: "pi-file-edit", severity: "info" },
      CustomerAccepted: {
        color: "#2196f3",
        icon: "pi-user-plus",
        severity: "info",
      },
      PendingCustomer: {
        color: "#ff9800",
        icon: "pi-user",
        severity: "warning",
      },
      SubmittedToInsurer: {
        color: "#00bcd4",
        icon: "pi-send",
        severity: "info",
      },
      InProgress: {
        color: "#9c27b0",
        icon: "pi-spinner",
        severity: "info",
      },
    };
    return (
      statusMap[status] || {
        color: "#757575",
        icon: "pi-circle",
        severity: "secondary",
      }
    );
  };

  // Calculate percentage for each status
  const getStatusPercentage = (count) => {
    if (quotationStats.totalQuotations === 0) return 0;
    return ((count / quotationStats.totalQuotations) * 100).toFixed(1);
  };

  // Build KPI data structure
  const quotationKPIs = {
    totalQuotations: {
      title: t("quoteStats.totalQuotations"),
      value: quotationStats.totalQuotations,
      change:
        quotationStats.growthRate !== 0 && quotationStats.growthRate !== null
          ? `${quotationStats.growthRate > 0 ? "+" : ""}${
              quotationStats.growthRate
            }%`
          : null,
      trend:
        quotationStats.growthRate > 0
          ? "up"
          : quotationStats.growthRate < 0
          ? "down"
          : null,
      icon: "pi pi-file",
      color: "#36a2eb",
      warning:
        quotationStats.growthRate <= -100 && quotationStats.totalQuotations > 0
          ? t("quoteStats.completeDecline")
          : null,
      warningSeverity: "danger",
    },
    averagePremium: {
      title: t("quoteStats.averagePremium"),
      value: quotationStats.averagePremium,
      change: null,
      trend: null,
      icon: "pi pi-money-bill",
      color: "#2ecc71",
      formatted: formatCurrency(quotationStats.averagePremium),
      isFinancial: true,
    },
    approvedQuotations: {
      title: t("quoteStats.approvedQuotations"),
      value: quotationStats.approvedQuotations,
      change: null,
      trend: null,
      icon: "pi pi-check-circle",
      color: "#4caf50",
      subtitle: t("quoteStats.approvalRate", { rate: quotationStats.approvalRate }),
      warning:
        quotationStats.approvalRate === 0 && quotationStats.totalQuotations > 0
          ? t("quoteStats.noApprovals")
          : quotationStats.approvalRate < 20 &&
            quotationStats.approvalRate > 0 &&
            quotationStats.totalQuotations >= 10
          ? t("quoteStats.lowApprovalRate")
          : null,
      warningSeverity:
        quotationStats.approvalRate === 0 && quotationStats.totalQuotations > 0
          ? "danger"
          : "warning",
    },
    activeQuotations: {
      title: t("quoteStats.activeQuotations"),
      value: activeQuotationsCount,
      change: null,
      trend: null,
      icon: "pi pi-bolt",
      color: "#ffce56",
    },

    pendingQuotations: {
      title: t("quoteStats.pendingReview"),
      value: quotationStats.pendingQuotations,
      change: null,
      trend: null,
      icon: "pi pi-hourglass",
      color: "#e67e22",
      warning:
        quotationStats.pendingQuotations >
          quotationStats.totalQuotations * 0.5 &&
        quotationStats.totalQuotations > 0
          ? t("quoteStats.highPendingCount")
          : null,
      warningSeverity: "warning",
    },
  };

  if (loading) {
    return (
      <div className="quote-stats-container">
        <div className="kpi-section">
          <div className="kpi-scroll-container">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <Card key={i} className="kpi-card">
                <Skeleton width="100%" height="120px" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <Message severity="error" text={error} className="w-full mb-4" />;
  }

  return (
    <div className="quote-stats-container">
      {/* KPI Cards Section - Executive Dashboard Style */}
      <div className="kpi-section">
        <div className="kpi-scroll-container">
          {/* First KPI Card */}
          {(() => {
            const kpiEntries = Object.entries(quotationKPIs);
            if (kpiEntries.length > 0) {
              const [key, kpi] = kpiEntries[0];
              return (
                <div key={key} className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">{kpi.title}</span>
                    {kpi.change && kpi.trend && (
                      <Tag
                        value={kpi.change}
                        severity={kpi.trend === "up" ? "success" : "danger"}
                        icon={`pi pi-arrow-${kpi.trend}`}
                      />
                    )}
                  </div>
                  <div className="kpi-value">
                    {kpi.isFinancial
                      ? kpi.formatted
                      : typeof kpi.value === "number"
                      ? kpi.value.toLocaleString(numberLocale())
                      : kpi.value}
                  </div>
                  {kpi.subtitle && (
                    <div className="kpi-subtitle">{kpi.subtitle}</div>
                  )}
                  {kpi.warning && (
                    <Tag
                      severity={kpi.warningSeverity || "warning"}
                      value={kpi.warning}
                      className="kpi-warning-tag"
                      icon={`pi ${kpi.warningSeverity === "danger" ? "pi-exclamation-circle" : "pi-exclamation-triangle"}`}
                    />
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* Status Cards - Integrated into same scroll container */}
          {quotationStats.quotationsByStatus &&
            quotationStats.quotationsByStatus.length > 0 &&
            quotationStats.quotationsByStatus.map((statusItem, index) => {
              const statusConfig = getStatusConfig(statusItem.status);
              const percentage = getStatusPercentage(statusItem.count);
              return (
                <div key={`status-${index}`} className="kpi-card status-card">
                  <div className="kpi-header">
                    <div className="status-info">
                      <i
                        className={`pi ${statusConfig.icon}`}
                        style={{ color: statusConfig.color }}
                      />
                      <span className="kpi-title">{getStatusTitleKey(statusItem.status)}</span>
                    </div>
                    <Tag
                      value={statusItem.count}
                      severity={statusConfig.severity}
                    />
                  </div>
                  <div className="kpi-value">{statusItem.count}</div>
                  <div className="status-progress">
                    <div
                      className="status-progress-bar"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: statusConfig.color,
                      }}
                    />
                  </div>
                  <div className="kpi-subtitle">{t("quoteStats.percentOfTotal", { percent: percentage })}</div>
                </div>
              );
            })}

          {/* Rest of KPI Cards (from index 1 onwards) */}
          {Object.entries(quotationKPIs)
            .slice(1)
            .map(([key, kpi]) => (
              <div key={key} className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-title">{kpi.title}</span>
                  {kpi.change && kpi.trend && (
                    <Tag
                      value={kpi.change}
                      severity={kpi.trend === "up" ? "success" : "danger"}
                      icon={`pi pi-arrow-${kpi.trend}`}
                    />
                  )}
                </div>
                <div className="kpi-value">
                  {kpi.isFinancial
                    ? kpi.formatted
                    : typeof kpi.value === "number"
                    ? kpi.value.toLocaleString(numberLocale())
                    : kpi.value}
                </div>
                {kpi.subtitle && (
                  <div className="kpi-subtitle">{kpi.subtitle}</div>
                )}
                {kpi.warning && (
                  <Tag
                    severity={kpi.warningSeverity || "warning"}
                    value={kpi.warning}
                    className="kpi-warning-tag"
                    icon={`pi ${kpi.warningSeverity === "danger" ? "pi-exclamation-circle" : "pi-exclamation-triangle"}`}
                  />
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default QuoteStatsCards;
