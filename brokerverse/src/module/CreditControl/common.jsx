import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { statusSeverity } from "../../utils/statusSeverity";
import { PageHeader as PeriodEndHeader, date, dateTime, money, showError, showSuccess } from "../PeriodEnd/common";

export { date, dateTime, money, showError, showSuccess };


/** Status chip with a translated label (creditControl.status.<status>). */
export const CcTag = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <Tag className="pe-tag" value={t(`creditControl.status.${status}`, { defaultValue: String(status) })} severity={statusSeverity(status)} />;
};

/** Page header with the Accounts > Credit Control breadcrumb. */
export const PageHeader = (props) => {
  const { t } = useTranslation();
  return <PeriodEndHeader section={t("creditControl.menu")} {...props} />;
};

/** Ageing bucket headers from the bucket days of a report ([30, 60, 90] -> 1-30, 31-60, 61-90, over 90). */
export const bucketLabels = (days = [30, 60, 90], t) => ({
  current: t("creditControl.notDue"), b1: `1-${days[0]}`, b2: `${days[0] + 1}-${days[1]}`, b3: `${days[1] + 1}-${days[2]}`, b4: t("creditControl.over", { days: days[2] }),
});

/** Today as YYYY-MM-DD in local time. */
export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const isoOf = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null);
