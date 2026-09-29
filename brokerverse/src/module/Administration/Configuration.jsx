import React, { useEffect, useMemo, useRef, useState } from "react";
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

const toText = (v) => (typeof v === "string" ? v : JSON.stringify(v));

/**
 * Master > Configuration: every business parameter the backend uses (tax rates, numbering prefixes,
 * limits, notification switches...) is stored in the database and edited here, not in code.
 */
const Configuration = () => {
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
    rows.forEach((r) => {
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
          changes[key] = typeof v === "string" ? JSON.parse(v) : v;
        } catch {
          toast.current?.show({ severity: "warn", summary: row.label, detail: "Enter valid JSON, for example [60, 30, 15]" });
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
    if (r.type === "json")
      return <InputTextarea id={r.key} value={toText(v)} rows={2} autoResize onChange={(e) => set(r.key, e.target.value)} />;
    if (r.type === "color")
      return (
        <div className="admin__color">
          <span className="admin__swatch" style={{ background: v }} />
          <InputText id={r.key} value={v || ""} onChange={(e) => set(r.key, e.target.value)} />
        </div>
      );
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
