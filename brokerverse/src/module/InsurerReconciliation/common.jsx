import React from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Tag } from "primereact/tag";
import SvgDot from "../../assets/icons/SvgDot";
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
  const home = { label: master ? t("insurerRec.master") : t("insurerRec.accounts") };
  const model = [{ label: master ? t("insurerRec.finance") : t("insurerRec.menu") }, ...trail.map((label) => ({ label }))];
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

/** Insurer dropdown options with the insurer id as value (the reconciliation API takes ids). */
export const insurerOptions = async () => (await loadInsurerOptions()).map((o) => ({ label: o.label, value: o.id, code: o.value }));

/** A difference shown with its sign, blank when zero. */
export const Diff = ({ value }) => (value ? <span className={value < 0 ? "text-red-600" : "text-orange-600"}>{money(value)}</span> : <span className="pe-muted">-</span>);
