import React from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Tag } from "primereact/tag";
import SvgDot from "../../assets/icons/SvgDot";
import { InfoTip } from "../../components/RecordPage";
import { statusSeverity } from "../../utils/statusSeverity";
import { date, dateTime, money, showError, showSuccess } from "../PeriodEnd/common";
import "../PeriodEnd/index.scss";

export { date, dateTime, money, showError, showSuccess };

/** Status chip with a translated label (opsAcc.status.<status>). */
export const OpsTag = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <Tag className="pe-tag" value={t(`opsAcc.status.${status}`, { defaultValue: String(status).replace(/[_-]/g, " ") })} severity={statusSeverity(status)} />;
};

/** Page title with the breadcrumb (menu group > section > page) and the page actions; the page's explanation (`help`, or `subtitle`) is the tooltip of the title's info icon. */
export const PageHeader = ({ title, group, section, subtitle, help, children }) => {
  const { t } = useTranslation();
  const model = [section, title].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((label) => ({ label }));
  return (
    <div className="pe-header">
      <div>
        <h1 className="pe-title">
          {title}
          {help || subtitle ? <InfoTip text={help || subtitle} /> : null}
        </h1>
        <BreadCrumb home={{ label: group || t("opsAcc.accounts") }} model={model} separatorIcon={<SvgDot color={"#000"} />} className="pe-breadcrumb" />
      </div>
      <div className="pe-header-actions">{children}</div>
    </div>
  );
};

/** A labelled form field (label above the input, PrimeFlex grid column), with its validation message under it. */
export const Field = ({ label, children, col = "col-12 md:col-6", required = false, error }) => (
  <div className={col}>
    <label className="block mb-1">{label}{required ? " *" : ""}</label>
    {children}
    {error ? <small className="p-error block mt-1" role="alert">{error}</small> : null}
  </div>
);

export { blank, default as useFieldErrors } from "../../hooks/useFieldErrors";

/** Today as YYYY-MM-DD in local time; a Date as YYYY-MM-DD. */
export const isoOf = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null);
export const todayIso = () => isoOf(new Date());
export const toDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`) : null);
export const numericColumn = { className: "bv-num", headerClassName: "bv-num" };
