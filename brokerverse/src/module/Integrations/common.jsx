import React from "react";
import SharedPageHeader from "../../components/PageHeader";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { money, date, dateTime, showError, showSuccess } from "../PeriodEnd/common";
import { loadInsurerOptions } from "../Remittance/shared";
import "./index.scss";

export { money, date, dateTime, showError, showSuccess };

/** Colour of each integration status (shared status colours). */
export const SEVERITY = {
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

/** Page title with its breadcrumb (home, section, page), the help behind the info icon and the action buttons. */
export const PageHeader = ({ home, section, title, subtitle, children }) => (
  <SharedPageHeader title={title} home={home} section={section} trail={[title]} help={subtitle}>{children}</SharedPageHeader>
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
