import React from "react";
import SharedPageHeader from "../../components/PageHeader";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { money, date, dateTime, showError, showSuccess } from "../PeriodEnd/common";
import { loadInsurerOptions } from "../Remittance/shared";

export { money, date, dateTime, showError, showSuccess };

const SEVERITY = { draft: "info", submitted: "warning", approved: "success", cancelled: "secondary", matched: "success", difference: "warning", unmatched: "danger", missing: "danger", note: "info", adjustment: "warning" };

/** Status chip with a translated label (insurerRec.status.<status>). */
export const IrTag = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <Tag className="pe-tag" value={t(`insurerRec.status.${status}`, { defaultValue: String(status) })} severity={SEVERITY[status] || "info"} />;
};

/** Page title with the Accounts > Insurer Reconciliation (or Master > Finance) breadcrumb and action buttons. */
export const PageHeader = ({ master = false, title, trail = [], subtitle, children }) => {
  const { t } = useTranslation();
  const home = master ? t("insurerRec.master") : t("insurerRec.accounts");
  const section = master ? t("insurerRec.finance") : t("insurerRec.menu");
  return (
    <SharedPageHeader title={title} home={home} section={section} trail={[...trail, ...(trail[trail.length - 1] === title ? [] : [title])]} help={subtitle}>{children}</SharedPageHeader>
  );
};

/** Insurer dropdown options with the insurer id as value (the reconciliation API takes ids). */
export const insurerOptions = async () => (await loadInsurerOptions()).map((o) => ({ label: o.label, value: o.id, code: o.value }));

/** A difference shown with its sign, blank when zero. */
export const Diff = ({ value }) => (value ? <span className={value < 0 ? "text-red-600" : "text-orange-600"}>{money(value)}</span> : <span className="pe-muted">-</span>);
