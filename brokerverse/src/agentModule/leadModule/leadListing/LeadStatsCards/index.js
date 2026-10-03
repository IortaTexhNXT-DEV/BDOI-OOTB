import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import leadService from "../../../../services/leadService";
import StatCards from "../../../../components/StatCards";
import logger from "../../../../utility/logger";

/** Prospect figures above the list. Fixed-height cards: a dash until the figures arrive, no skeleton, no badges. */
const LeadStatsCards = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    leadService.getLeadStats({}).then((res) => {
      if (alive && res?.success) setStats(res.data || {});
    }).catch((e) => logger.error("Prospect figures:", e));
    return () => { alive = false; };
  }, []);

  const lost = stats ? (stats.leadsByStatus || []).find((s) => s.status === "Lost")?.count || 0 : 0;
  const v = (n) => (stats ? Number(n) || 0 : null);
  const items = [
    { key: "total", label: t("leads.totalLeads"), value: v(stats?.totalLeads) },
    { key: "last7", label: t("leads.last7Days"), value: v(stats?.recentLeads) },
    { key: "last30", label: t("leads.last30Days"), value: v(stats?.last30DaysLeads) },
    { key: "converted", label: t("leads.convertedLeads"), value: v(stats?.convertedLeads), note: stats ? t("leads.conversionRate", { rate: stats.conversionRate || 0 }) : null },
    { key: "quoted", label: t("leads.withQuotations"), value: v(stats?.leadsWithQuotations), note: stats ? t("leads.quotationRate", { rate: stats.quotationRate || 0 }) : null },
    { key: "active", label: t("leads.activeLeads"), value: stats ? Math.max(0, (stats.totalLeads || 0) - (stats.convertedLeads || 0) - lost) : null },
  ];
  return <StatCards items={items} />;
};

export default LeadStatsCards;
