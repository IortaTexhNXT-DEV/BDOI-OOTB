import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { getLeadStatsMiddleware } from "../../Store/leadMiddleware";
import "./index.scss";

import { numberLocale } from "../../../../utility/currencyConverter";
const LeadStatsCards = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { leadStats, loading, error } = useSelector(({ leadReducers }) => ({
    leadStats: leadReducers?.leadStats || {
      totalLeads: 0,
      recentLeads: 0,
      last30DaysLeads: 0,
      convertedLeads: 0,
      leadsWithQuotations: 0,
      conversionRate: 0,
      quotationRate: 0,
      growthRate: 0,
      leadsByCategory: [],
      leadsByCountry: [],
      leadsByStatus: [],
    },
    loading: leadReducers?.loading || false,
    error: leadReducers?.error || null,
  }));

  useEffect(() => {
    dispatch(getLeadStatsMiddleware());
  }, [dispatch]);

  // Calculate active leads count
  const activeLeadsCount =
    leadStats.totalLeads -
    leadStats.convertedLeads -
    (leadStats.leadsByStatus.find((s) => s.status === "Lost")?.count || 0);

  // Build KPI data structure with translation keys for warnings (for severity/icon logic)
  const leadKPIs = {
    totalLeads: {
      titleKey: "leads.totalLeads",
      value: leadStats.totalLeads,
      change:
        leadStats.growthRate !== 0
          ? `${leadStats.growthRate > 0 ? "+" : ""}${leadStats.growthRate}%`
          : null,
      trend:
        leadStats.growthRate > 0
          ? "up"
          : leadStats.growthRate < 0
          ? "down"
          : null,
      icon: "pi pi-users",
      color: "#36a2eb",
    },
    recentLeads: {
      titleKey: "leads.last7Days",
      value: leadStats.recentLeads,
      change: null,
      trend: null,
      icon: "pi pi-clock",
      color: "#4bc0c0",
      warningKey: leadStats.recentLeads === 0 ? "leads.noRecentActivity" : null,
    },
    last30DaysLeads: {
      titleKey: "leads.last30Days",
      value: leadStats.last30DaysLeads,
      change:
        leadStats.growthRate !== 0 && leadStats.last30DaysLeads > 0
          ? `${leadStats.growthRate > 0 ? "+" : ""}${leadStats.growthRate}%`
          : null,
      trend:
        leadStats.growthRate > 0
          ? "up"
          : leadStats.growthRate < 0
          ? "down"
          : null,
      icon: "pi pi-calendar",
      color: "#9966ff",
      warningKey:
        leadStats.last30DaysLeads === 0 && leadStats.totalLeads > 0
          ? "leads.noNewLeads"
          : leadStats.growthRate < -50 && leadStats.last30DaysLeads > 0
          ? "leads.criticalDecline"
          : null,
    },
    convertedLeads: {
      titleKey: "leads.convertedLeads",
      value: leadStats.convertedLeads,
      change: null,
      trend: null,
      icon: "pi pi-check-circle",
      color: "#4caf50",
      subtitleKey: "leads.conversionRate",
      subtitleValue: { rate: leadStats.conversionRate },
      warningKey:
        leadStats.conversionRate === 0 && leadStats.totalLeads > 0
          ? "leads.noConversions"
          : leadStats.conversionRate < 10 &&
            leadStats.conversionRate > 0 &&
            leadStats.totalLeads >= 10
          ? "leads.lowConversion"
          : null,
    },
    leadsWithQuotations: {
      titleKey: "leads.withQuotations",
      value: leadStats.leadsWithQuotations,
      change: null,
      trend: null,
      icon: "pi pi-file",
      color: "#ff9f40",
      subtitleKey: "leads.quotationRate",
      subtitleValue: { rate: leadStats.quotationRate },
    },
    activeLeads: {
      titleKey: "leads.activeLeads",
      value: activeLeadsCount,
      change: null,
      trend: null,
      icon: "pi pi-bolt",
      color: "#ffce56",
    },
  };

  if (loading) {
    return (
      <div className="lead-stats-container">
        <div className="kpi-section">
          <div className="kpi-scroll-container">
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
    <div className="lead-stats-container">
      {/* KPI Cards Section - Executive Dashboard Style */}
      <div className="kpi-section">
        <div className="kpi-scroll-container">
          {Object.entries(leadKPIs).map(([key, kpi]) => (
            <div key={key} className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">{t(kpi.titleKey)}</span>
                {kpi.change && kpi.trend && (
                  <Tag
                    value={kpi.change}
                    severity={kpi.trend === "up" ? "success" : "danger"}
                    icon={`pi pi-arrow-${kpi.trend}`}
                  />
                )}
              </div>
              <div className="kpi-value">{kpi.value.toLocaleString(numberLocale())}</div>
              {kpi.subtitleKey && (
                <div className="kpi-subtitle">
                  {t(kpi.subtitleKey, kpi.subtitleValue || {})}
                </div>
              )}
              {kpi.warningKey && (
                <Tag
                  severity={
                    kpi.warningKey === "leads.criticalDecline" ||
                    kpi.warningKey === "leads.noNewLeads"
                      ? "danger"
                      : "warning"
                  }
                  value={t(kpi.warningKey)}
                  className="kpi-warning-tag"
                  icon={`pi ${
                    kpi.warningKey === "leads.criticalDecline"
                      ? "pi-exclamation-circle"
                      : kpi.warningKey === "leads.noConversions" ||
                        kpi.warningKey === "leads.noNewLeads" ||
                        kpi.warningKey === "leads.noRecentActivity"
                      ? "pi-ban"
                      : "pi-exclamation-triangle"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeadStatsCards;
