import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../assets/icons/SvgDot";
import { money, date, dateTime, showError, showSuccess, previousPeriod, currentPeriod, JournalDialog, JournalLink } from "../PeriodEnd/common";
import "./index.scss";

export { money, date, dateTime, showError, showSuccess, previousPeriod, currentPeriod, JournalDialog, JournalLink };

const SEVERITY = {
  matched: "success", unmatched: "warning", "bank-error": "danger", locked: "secondary", draft: "info", prepared: "warning", approved: "success", cancelled: "secondary",
  posted: "success", "for-approval": "warning", adjustment: "info", auto: "success", manual: "info", contra: "secondary", active: "success", inactive: "secondary",
  example: "warning", outstanding: "warning", stale: "danger", duplicate: "danger", new: "success",
};

/** Status chip with a translated label (bankReconciliation.status.<status>). */
export const BrTag = ({ status, value }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <Tag className="br-tag" value={value || t(`bankReconciliation.status.${status}`, { defaultValue: String(status).replace(/[_-]/g, " ") })} severity={SEVERITY[status] || "info"} />;
};

/** Page header with the Accounts > Bank Reconciliation breadcrumb (or Master > Finance for the masters). */
export const PageHeader = ({ master = false, title, trail = [], subtitle, children }) => {
  const { t } = useTranslation();
  const home = { label: master ? t("bankReconciliation.master") : t("bankReconciliation.accounts") };
  const model = [{ label: master ? t("bankReconciliation.finance") : t("bankReconciliation.menu") }, ...trail.map((label) => ({ label }))];
  return (
    <div className="pe-header">
      <div>
        <h1 className="pe-title">{title}</h1>
        <BreadCrumb home={home} model={model} separatorIcon={<SvgDot color={"#000"} />} className="pe-breadcrumb" />
        {subtitle && <p className="pe-subtitle">{subtitle}</p>}
      </div>
      <div className="pe-header-actions">{children}</div>
    </div>
  );
};

/** Signed amount with debit (money out) in red. */
export const Amount = ({ value }) => (
  <span className={Number(value) < 0 ? "br-debit" : "br-credit"}>{money(value)}</span>
);

export const periodLabel = (p) => {
  if (!p) return "";
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
};

/** Recent periods (YYYY-MM), newest first. */
export const recentPeriods = (n = 18) => {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const p = new Date(Date.UTC(d.getFullYear(), d.getMonth() - i, 1)).toISOString().slice(0, 7);
    return { label: `${periodLabel(p)} (${p})`, value: p };
  });
};

export const sum = (list, f = (x) => x.amount) => Math.round(list.reduce((s, x) => s + Number(f(x) || 0), 0) * 100) / 100;
