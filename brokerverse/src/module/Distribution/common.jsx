import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AutoComplete } from "primereact/autocomplete";
import { BreadCrumb } from "primereact/breadcrumb";
import { Tag } from "primereact/tag";
import SvgDot from "../../assets/icons/SvgDot";
import clientService from "../../services/clientService";
import mastersService from "../../services/mastersService";
import { date, dateTime, money, showError, showSuccess } from "../PeriodEnd/common";
import "./index.scss";

export { date, dateTime, money, showError, showSuccess };

const SEVERITY = {
  active: "success", draft: "info", issued: "success", sent: "success", scheduled: "info", cancelled: "secondary", inactive: "secondary",
  queued: "warning", assigned: "success", created: "success", failed: "danger", processed: "success", partial: "warning", deleted: "secondary",
  "in-market": "info", placed: "warning", bound: "success", closed: "secondary", approached: "info", quoted: "info", accepted: "success", declined: "danger",
  submitted: "info", billed: "success", nil: "secondary", declared: "success", expired: "secondary", excluded: "secondary", "opted-out": "warning", done: "success", running: "info",
  granted: "success", refused: "danger", withdrawn: "warning", "not-recorded": "secondary",
};

/** Status chip with a translated label (distribution.status.<status>). */
export const StatusTag = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <Tag className="pe-tag" value={t(`distribution.status.${status}`, { defaultValue: String(status).replace(/[_-]/g, " ") })} severity={SEVERITY[status] || "info"} />;
};

/** Page header: title, breadcrumb (`home` > `section` > trail), a one-line purpose and the action buttons. */
export const PageHeader = ({ home, section, title, trail = [], subtitle, children }) => (
  <div className="pe-header">
    <div>
      <h1 className="pe-title">{title}</h1>
      <BreadCrumb home={{ label: home }} model={[...(section ? [{ label: section }] : []), ...trail.map((label) => ({ label }))]}
        separatorIcon={<SvgDot color={"#000"} />} className="pe-breadcrumb" />
      {subtitle && <p className="pe-subtitle">{subtitle}</p>}
    </div>
    <div className="pe-header-actions">{children}</div>
  </div>
);

/** A labelled form field of the two-column form grid; a required field is starred and its error replaces the help line. */
export const Field = ({ label, children, full = false, help, required = false, error }) => (
  <div className={`dist-field${full ? " dist-field--full" : ""}${error ? " dist-field--invalid" : ""}`}>
    <label>{label}{required ? <span className="dist-required" aria-hidden="true"> *</span> : null}</label>
    {children}
    {error ? <small className="p-error" role="alert">{error}</small> : help ? <small className="pe-muted">{help}</small> : null}
  </div>
);

/** Field messages of an API validation error ({ path: message }), for the fields of a form. */
export const fieldErrors = (e) => Object.fromEntries((e?.errors || []).filter((x) => x.path).map((x) => [String(x.path).split(".")[0], x.message]));

/** Number of a numeric cell, right aligned. */
export const num = (v, digits = 2) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("en-PH", { minimumFractionDigits: digits, maximumFractionDigits: digits }));

/** Local calendar date of a date picker value as YYYY-MM-DD, and back. */
export const isoDay = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null);
export const fromIsoDay = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`) : null);

/** Client look-up (name, client code, mobile, e-mail); value is the chosen client object. */
export const ClientPicker = ({ value, onChange, placeholder }) => {
  const [suggestions, setSuggestions] = useState([]);
  const search = async (e) => {
    const r = await clientService.searchClients(e.query);
    setSuggestions(r.success ? r.data.map((c) => ({ id: c.id || c.clientId, label: `${c.displayName}${c.clientCode ? ` (${c.clientCode})` : ""}` })) : []);
  };
  return <AutoComplete value={value} suggestions={suggestions} completeMethod={search} field="label" placeholder={placeholder} forceSelection onChange={(e) => onChange(e.value)} />;
};

/** Options [{ label, value }] from values with labels under a translation prefix. */
export const useLabelled = (prefix) => {
  const { t } = useTranslation();
  return (values) => values.map((value) => ({ value, label: t(`${prefix}.${value}`, { defaultValue: String(value) }) }));
};

/** Insurers of the Insurance Company master as drop-down options { value: id, label }. */
export const useInsurers = () => {
  const [list, setList] = useState([]);
  useEffect(() => {
    mastersService.options("insurance-company").then((r) => setList(r.map((x) => ({ value: Number(x.id), label: x.label })))).catch(() => setList([]));
  }, []);
  return list;
};
