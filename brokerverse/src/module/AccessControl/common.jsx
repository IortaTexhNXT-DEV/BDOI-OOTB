import React from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { formatDate } from "../../utility/dateFormat";

/** Labels of the access control screens (en.json "accessControl"), with the English text as the fallback. */
export const useLabels = () => {
  const { t } = useTranslation();
  return (key, fallback, values) => t(`accessControl.${key}`, { defaultValue: fallback, ...(values || {}) });
};

export const formatPeso = (v) =>
  v === null || v === undefined ? "" : `PHP ${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A limit as shown in the matrix: "No limit", "PHP 1,000,000.00" or "15%". */
export const limitText = (measure, value, unlimited, noLimit) => {
  if (unlimited) return noLimit;
  if (value === null || value === undefined) return "";
  return measure === "percent" ? `${Number(value)}%` : formatPeso(value);
};

/** Dates and date-times in the configured format (System Settings general.date_format), like every other screen. */
export const shortDate = (d) => formatDate(d, { empty: "" });
export const dateTime = (d) => formatDate(d, { withTime: true, empty: "" });

/** Page frame shared by the screens: breadcrumb, title (with a facts line on a detail page) and the actions on the right. */
export const PageHeader = ({ title, intro, actions }) => {
  const k = useLabels();
  return (
    <>
      <BreadCrumb
        model={[{ label: k("userManagement", "Users and Access") }, { label: title }]}
        home={{ label: k("master", "Master") }}
        className="admin__breadcrumb"
      />
      <div className="admin__header">
        <div>
          <h2>{title}</h2>
          {intro ? <p>{intro}</p> : null}
        </div>
        {actions ? <div className="admin__actions">{actions}</div> : null}
      </div>
    </>
  );
};
