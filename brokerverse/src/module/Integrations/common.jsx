import React from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Tag } from "primereact/tag";
import SvgDot from "../../assets/icons/SvgDot";
import { money, date, dateTime, showError, showSuccess } from "../PeriodEnd/common";
import { loadInsurerOptions } from "../Remittance/shared";
import "./index.scss";

export { money, date, dateTime, showError, showSuccess };

const SEVERITY = {
  queued: "info", processing: "info", retry: "warning", sent: "success", failed: "danger", cancelled: "secondary", skipped: "secondary",
  received: "info", processed: "success", ignored: "secondary",
  pending: "warning", requested: "info", authenticated: "success",
  draft: "info", "for-approval": "warning", approved: "success", "file-generated": "info", completed: "success", paid: "success", rejected: "danger",
  active: "success", exhausted: "secondary", closed: "secondary", test: "warning", live: "success", "not-sent": "secondary", "not-required": "secondary",
};

/** Status chip with a translated label (integrations.status.<status>). */
export const IntTag = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <Tag className="pe-tag" value={t(`integrations.status.${status}`, { defaultValue: String(status).replace(/[_-]/g, " ") })} severity={SEVERITY[status] || "info"} />;
};

/** Page title with its breadcrumb (home, section, page) and the action buttons on the right. */
export const PageHeader = ({ home, section, title, subtitle, children }) => (
  <div className="pe-header">
    <div>
      <h1 className="pe-title">{title}</h1>
      <BreadCrumb home={{ label: home }} model={[{ label: section }, { label: title }]} separatorIcon={<SvgDot color={"#000"} />} className="pe-breadcrumb" />
      {subtitle && <p className="pe-subtitle">{subtitle}</p>}
    </div>
    <div className="pe-header-actions">{children}</div>
  </div>
);

/** Insurer dropdown options with the insurer id as value. */
export const insurerOptions = async () => (await loadInsurerOptions()).map((o) => ({ label: o.label, value: o.id, code: o.value }));

/** Local calendar date of a date picker value as YYYY-MM-DD. */
export const isoDay = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined);

/** Pretty JSON for the detail dialogs and the option editors. */
export const pretty = (v) => (v === undefined || v === null ? "" : JSON.stringify(v, null, 2));

/** Parse a JSON text area; returns [value, error]. */
export const parseJson = (text, fallback) => {
  if (!String(text || "").trim()) return [fallback, null];
  try {
    return [JSON.parse(text), null];
  } catch (e) {
    return [fallback, e.message];
  }
};
