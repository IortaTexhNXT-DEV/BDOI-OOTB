import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputTextarea } from "primereact/inputtextarea";
import { TabView, TabPanel } from "primereact/tabview";
import { Toast } from "primereact/toast";
import adminService from "../../services/adminService";
import "./index.scss";

const GROUP_LABELS = {
  general: "General",
  branding: "Branding",
  currency: "Currency",
  tax: "Taxes",
  numbering: "Document numbering",
  limits: "Limits and validity",
  commission: "Commission",
  notification: "Notifications",
  reports: "Reports",
  accounting: "Accounting",
  claims: "Claims",
  collections: "Collections",
  dashboard: "Dashboard",
  direct_bill: "Direct bill",
  email: "E-mail",
  endorsements: "Endorsements",
  finance: "Finance",
  incentive: "Incentives",
  leads: "Leads",
  policies: "Policies",
  policy: "Policy documents",
  premium: "Premium",
  product: "Products",
  quotations: "Quotations",
  quote: "Quote approval",
  reinsurance: "Reinsurance",
  remittance: "Remittance",
  renewals: "Renewals",
  security: "Security",
  system: "System",
  uploads: "Uploads",
};

/** Tab label of a settings group: the known label, else the key in words ("direct_bill" -> "Direct bill"). */
const groupLabel = (group) => {
  if (GROUP_LABELS[group]) return GROUP_LABELS[group];
  const words = String(group || "Other").replace(/[_.-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A list of plain values (codes, numbers, day counts) is edited as "a, b, c"; other structures as indented JSON. */
const isPlainList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number");
const toText = (v, original = v) => {
  if (typeof v === "string") return v;
  if (isPlainList(original)) return v.join(", ");
  return JSON.stringify(v, null, 2);
};
/** A list of flat records (languages, currencies, thresholds...): edited as a small table, one row per record. */
const isRecordList = (v) =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every(
    (x) =>
      x && typeof x === "object" && !Array.isArray(x) &&
      Object.values(x).every((y) => y === null || ["string", "number", "boolean"].includes(typeof y))
  );

const RecordListEditor = ({ id, value, original, onChange }) => {
  const columns = [...new Set(original.flatMap((r) => Object.keys(r)))];
  const kind = (col) => typeof original.find((r) => r[col] !== undefined && r[col] !== null)?.[col];
  const cell = (row, col) => (row[col] === null || row[col] === undefined ? "" : String(row[col]));
  const setCell = (index, col, next) =>
    onChange(
      value.map((row, i) =>
        i !== index ? row : { ...row, [col]: kind(col) === "number" ? (next === "" ? null : Number(next)) : next }
      )
    );
  const remove = (index) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, Object.fromEntries(columns.map((c) => [c, kind(c) === "boolean" ? false : kind(c) === "number" ? null : ""]))]);
  return (
    <div className="admin__records" id={id}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (x) => x.toUpperCase())}</th>
            ))}
            <th aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {value.map((row, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>
                  {kind(c) === "boolean" ? (
                    <InputSwitch checked={!!row[c]} onChange={(e) => setCell(i, c, e.value)} aria-label={c} />
                  ) : (
                    <InputText value={cell(row, c)} onChange={(e) => setCell(i, c, e.target.value)} aria-label={c} />
                  )}
                </td>
              ))}
              <td>
                <Button type="button" icon="pi pi-trash" text rounded aria-label="Remove row" onClick={() => remove(i)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button type="button" label="Add row" icon="pi pi-plus" text onClick={add} />
    </div>
  );
};

/** The value to save for a json setting edited as text (see toText); throws on invalid JSON or a bad number. */
const fromText = (text, original) => {
  if (Array.isArray(text) && text.some((row) => row && typeof row === "object" && Object.values(row).some((x) => Number.isNaN(x)))) {
    throw new Error("numbers expected");
  }
  if (typeof text !== "string") return text;
  if (isPlainList(original)) {
    const items = text.split(",").map((x) => x.trim()).filter(Boolean);
    const numeric = original.length > 0 && original.every((x) => typeof x === "number");
    if (numeric && items.some((x) => Number.isNaN(Number(x)))) throw new Error("numbers expected");
    return numeric ? items.map(Number) : items;
  }
  return JSON.parse(text);
};

/**
 * Master > Configuration: every business parameter the backend uses (tax rates, numbering prefixes,
 * limits, notification switches...) is stored in the database and edited here, not in code.
 */
const Configuration = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () =>
    adminService
      .getSettings()
      .then((data) => {
        setRows(data);
        setDraft({});
      })
      .catch((e) => toast.current?.show({ severity: "error", summary: "Configuration", detail: e.message }));

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const g = {};
    // document number prefixes are a read-only mirror of Master > Document Numbering, edited there
    rows.filter((r) => r.group !== "numbering").forEach((r) => {
      (g[r.group] = g[r.group] || []).push(r);
    });
    // tabs in alphabetical order of their labels, General first
    return Object.fromEntries(
      Object.entries(g).sort(([a], [b]) => (a === "general" ? -1 : b === "general" ? 1 : groupLabel(a).localeCompare(groupLabel(b))))
    );
  }, [rows]);

  const value = (r) => (r.key in draft ? draft[r.key] : r.value);
  const set = (key, v) => setDraft((d) => ({ ...d, [key]: v }));

  const save = async () => {
    const changes = {};
    for (const [key, v] of Object.entries(draft)) {
      const row = rows.find((r) => r.key === key);
      if (row?.type === "json") {
        try {
          changes[key] = fromText(v, row.value);
        } catch {
          const detail = isPlainList(row.value)
            ? "Enter the values separated by commas, for example 60, 30, 15"
            : isRecordList(row.value)
              ? "Enter numbers in the number columns"
              : "Enter valid JSON";
          toast.current?.show({ severity: "warn", summary: row.label, detail });
          return;
        }
      } else changes[key] = v;
    }
    if (!Object.keys(changes).length) return;
    setSaving(true);
    try {
      const data = await adminService.saveSettings(changes);
      setRows(data);
      setDraft({});
      toast.current?.show({ severity: "success", summary: "Configuration", detail: "Saved" });
    } catch (e) {
      toast.current?.show({ severity: "error", summary: "Configuration", detail: e.message });
    } finally {
      setSaving(false);
    }
  };

  const editor = (r) => {
    const v = value(r);
    if (r.type === "boolean") return <InputSwitch inputId={r.key} checked={!!v} onChange={(e) => set(r.key, e.value)} />;
    if (r.type === "number")
      return (
        <InputNumber inputId={r.key} value={v} onValueChange={(e) => set(r.key, e.value)} mode="decimal" minFractionDigits={0} maxFractionDigits={6} />
      );
    if (r.type === "json" && isRecordList(r.value) && Array.isArray(v))
      return <RecordListEditor id={r.key} value={v} original={r.value} onChange={(next) => set(r.key, next)} />;
    if (r.type === "json")
      return (
        <InputTextarea
          id={r.key}
          className={isPlainList(r.value) ? undefined : "admin__json"}
          value={toText(v, r.value)}
          rows={isPlainList(r.value) ? 1 : 3}
          autoResize
          onChange={(e) => set(r.key, e.target.value)}
        />
      );
    if (r.type === "color")
      return (
        <div className="admin__color">
          <span className="admin__swatch" style={{ background: v }} />
          <InputText id={r.key} value={v || ""} onChange={(e) => set(r.key, e.target.value)} />
        </div>
      );
    // E-mail templates and other long texts: a multi-line box instead of a single line
    // (decided on the saved value, so the box does not change while typing)
    if (typeof r.value === "string" && (r.value.length > 80 || /<[a-z]/i.test(r.value)))
      return <InputTextarea id={r.key} value={v ?? ""} rows={3} autoResize onChange={(e) => set(r.key, e.target.value)} />;
    return <InputText id={r.key} value={v ?? ""} onChange={(e) => set(r.key, e.target.value)} />;
  };

  return (
    <div className="admin__page">
      <Toast ref={toast} />
      <BreadCrumb model={[{ label: "Master" }, { label: "Configuration" }]} home={{ icon: "pi pi-home", url: "/" }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>Configuration</h2>
          <p>Business parameters used by the system. Changes apply immediately and are recorded in the audit trail.</p>
        </div>
        <Button label="Save changes" icon="pi pi-check" onClick={save} loading={saving} disabled={!Object.keys(draft).length} />
      </div>
      <p className="admin__note">
        <i className="pi pi-info-circle" /> {t("numberingMasters.documentNumbering.configurationNote")}{" "}
        <Link to="/master/configuration/document-numbering">{t("numberingMasters.documentNumbering.openScreen")}</Link>
      </p>
      <TabView scrollable className="admin__tabs">
        {Object.entries(groups).map(([group, items]) => (
          <TabPanel key={group} header={groupLabel(group)}>
            <div className="admin__grid">
              {items.map((r) => (
                <div className="admin__field" key={r.key}>
                  <label htmlFor={r.key} title={r.key}>{r.label}</label>
                  {editor(r)}
                </div>
              ))}
            </div>
          </TabPanel>
        ))}
      </TabView>
    </div>
  );
};

export default Configuration;
