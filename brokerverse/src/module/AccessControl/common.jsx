import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { formatDate } from "../../utility/dateFormat";

/** Labels of the access control screens (en.json "accessControl"), with the English text as the fallback. */
export const useLabels = () => {
  const { t } = useTranslation();
  return useCallback((key, fallback, values) => t(`accessControl.${key}`, { defaultValue: fallback, ...(values || {}) }), [t]);
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

/**
 * Per-viewer choices of the access screens (include the base platform roles, show technical names), kept in this
 * browser only; a blocked or empty storage gives the default.
 */
export const BASE_ROLES_KEY = "bv.access.baseRoles";
export const TECHNICAL_NAMES_KEY = "bv.access.technicalNames";
export const readPreference = (key, fallback = false) => {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
export const writePreference = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // the choice then lasts for this visit only
  }
};

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Names of the access catalogue in the user's language, the server's English name as the fallback: areas, modules,
 * levels, and the department groups of the role lists.
 */
export const useAccessNames = () => {
  const k = useLabels();
  const area = useCallback((a) => (a ? k(`areas.${a.code}`, a.name) : ""), [k]);
  // a module added after this release (code "other:<module>") has only the server's name
  const module = useCallback((m) => (m ? (m.code.includes(":") ? m.name : k(`modules.${m.code}`, m.name)) : ""), [k]);
  const level = useCallback((code) => k(`levels.${code}`, { view: "View", edit: "Create and edit", approve: "Approve", special: "Special" }[code] || code), [k]);
  const group = useCallback((g) => (g.label ? k(`departments.${slug(g.key)}`, g.label) : g.key === "platform"
    ? k("basePlatformRoles", "Base platform roles") : k("otherRoles", "Other roles")), [k]);
  return { area, module, level, group };
};
