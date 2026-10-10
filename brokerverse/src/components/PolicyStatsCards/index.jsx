import React from "react";
import { useTranslation } from "react-i18next";
import StatCards from "../StatCards";
import { businessDate } from "../../utility/dateFormat";

const DAY_MS = 86400000;

/** Policies by expiry: in force, expiring within five days, expired (counted on business dates). */
export const policyCounts = (policyData = [], today = businessDate()) => {
  const base = Date.parse(`${today}T00:00:00Z`);
  return policyData.reduce((acc, policy) => {
    const expiry = String(policy.PolicyExpiry || policy.expiry || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return acc;
    const days = Math.round((Date.parse(`${expiry}T00:00:00Z`) - base) / DAY_MS);
    if (days < 0) acc.expired += 1;
    else if (days <= 5) acc.expiring += 1;
    else acc.active += 1;
    return acc;
  }, { active: 0, expiring: 0, expired: 0 });
};

/** Policy figures: neutral KPI cards; a state is an icon and a word, never a coloured card. */
const PolicyStatsCards = ({ policyData = [] }) => {
  const { t } = useTranslation();
  const { active, expiring, expired } = policyCounts(policyData);
  return (
    <StatCards items={[
      { key: "active", label: t("shared.activePolicies"), value: active, note: t("shared.moreThan5Days") },
      { key: "expiring", label: t("shared.expiringSoon"), value: expiring, note: t("shared.zeroTo5Days"),
        status: expiring ? { severity: "warning", label: t("shared.expiringSoon") } : null },
      { key: "expired", label: t("shared.expiredPolicies"), value: expired, note: t("shared.pastExpiryDate"),
        status: expired ? { severity: "serious", label: t("shared.expiredPolicies") } : null },
    ]} />
  );
};

export default PolicyStatsCards;
