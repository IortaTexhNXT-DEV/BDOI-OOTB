import React from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";

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

export const shortDate = (d) => (d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" }) : "");
export const dateTime = (d) =>
  d ? new Date(d).toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/** Page frame shared by the screens: breadcrumb, title (with a facts line on a detail page) and the actions on the right. */
export const PageHeader = ({ title, intro, actions }) => {
  const k = useLabels();
  return (
    <>
      <BreadCrumb
        model={[{ label: k("userManagement", "User Management") }, { label: title }]}
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
