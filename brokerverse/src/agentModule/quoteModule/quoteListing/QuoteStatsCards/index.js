import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import quotationService from "../../../../services/quotationService";
import StatCards from "../../../../components/StatCards";
import logger from "../../../../utility/logger";

const CLOSED = ["Rejected", "Expired", "Cancelled", "Dropped"];

/** Quotation figures above the list (for one prospect when leadRefId is given). Fixed-height cards, no badges. */
const QuoteStatsCards = ({ leadRefId }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    (leadRefId ? quotationService.getQuotationStats(leadRefId) : quotationService.getQuotationStats())
      .then((res) => { if (alive && res?.success) setStats(res.data || {}); })
      .catch((e) => logger.error("Quotation figures:", e));
    return () => { alive = false; };
  }, [leadRefId]);

  const byStatus = (name) => (stats?.quotationsByStatus || []).find((s) => s.status === name)?.count || 0;
  const active = stats
    ? stats.activeQuotationsCount ?? Math.max(0, (stats.totalQuotations || 0) - (stats.convertedToPolicyCount || 0)
      - (stats.quotationsByStatus || []).filter((s) => CLOSED.includes(s.status)).reduce((sum, s) => sum + (s.count || 0), 0))
    : null;
  const v = (n) => (stats ? Number(n) || 0 : null);
  const items = [
    { key: "total", label: t("quoteStats.totalQuotations"), value: v(stats?.totalQuotations) },
    { key: "active", label: t("quoteStats.activeQuotations"), value: active },
    { key: "pending", label: t("quoteStats.pendingReview"), value: v(stats?.pendingQuotations) },
    { key: "approved", label: t("quoteStats.approvedQuotations"), value: v(stats?.approvedQuotations), note: stats ? t("quoteStats.approvalRate", { rate: stats.approvalRate || 0 }) : null },
    { key: "converted", label: t("quoteStats.statusConvertedToPolicy"), value: stats ? stats.convertedToPolicyCount ?? byStatus("ConvertedToPolicy") : null },
    { key: "average", label: t("quoteStats.averagePremium"), value: stats ? formatCurrency(stats.averagePremium || 0) : null },
  ];
  return <StatCards items={items} />;
};

export default QuoteStatsCards;
