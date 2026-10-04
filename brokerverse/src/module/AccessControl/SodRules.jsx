import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { SelectButton } from "primereact/selectbutton";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import accessControlService from "../../services/accessControlService";
import { PageHeader, useLabels } from "./common";
import "../Administration/index.scss";
import "./index.scss";

const EMPTY = { code: "", name: "", roleA: null, roleB: null, action: "block", reason: "", active: true };

/**
 * Master > User Management > Segregation of Duties: pairs of roles one person should not hold together. "Block"
 * stops the roles being given to the same user; "Warn" allows it and says so. The User Access Matrix lists who breaks a rule.
 */
const SodRules = () => {
  const k = useLabels();
  const toast = useRef(null);
  const [rules, setRules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([accessControlService.sodRules(), accessControlService.userMatrix()]);
      setRules(r);
      setRoles(m.roles.map((x) => ({ label: x.name, value: x.code })));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await accessControlService.saveSodRule({ ...form, reason: form.reason || undefined, code: form.id ? undefined : form.code.trim().toUpperCase() });
      toast.current?.show({ severity: "success", summary: r.message });
      setForm(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message });
    } finally {
      setSaving(false);
    }
  };

  const switchOff = async (rule) => {
    try {
      const r = await accessControlService.switchOffSodRule(rule.id);
      toast.current?.show({ severity: "success", summary: r.message });
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: e.message });
    }
  };

  const actions = [{ label: k("actionBlock", "Block"), value: "block" }, { label: k("actionWarn", "Warn"), value: "warn" }];
  const valid = form && form.name.trim() && form.roleA && form.roleB && form.roleA !== form.roleB && (form.id || form.code.trim());

  return (
    <div className="admin__page access__page">
      <Toast ref={toast} />
      <PageHeader
        title={k("sodTitle", "Segregation of Duties")}
        actions={<Button icon="pi pi-plus" label={k("newRule", "New rule")} onClick={() => setForm({ ...EMPTY })} />}
      />
      <DataTable value={rules} dataKey="id" loading={loading} size="small" stripedRows className="access__table" emptyMessage={k("noRules", "No rules")}>
        <Column field="code" header={k("colCode", "Code")} style={{ width: "10rem" }} body={(r) => <span className="access__code">{r.code}</span>} />
        <Column field="name" header={k("colRule", "Rule")} />
        <Column header={k("colRoles", "Roles")} body={(r) => `${r.roleAName} + ${r.roleBName}`} />
        <Column header={k("colAction", "When assigned")} body={(r) => <Tag value={r.action === "block" ? k("actionBlock", "Block") : k("actionWarn", "Warn")} severity={r.action === "block" ? "danger" : "warning"} />} />
        <Column field="reason" header={k("colReason", "Reason")} />
        <Column header={k("colStatus", "Status")} body={(r) => <Tag value={r.active ? k("on", "On") : k("off", "Off")} severity={r.active ? "success" : "secondary"} />} />
        <Column header="" style={{ width: "11rem" }} body={(r) => (
          <div className="access__row-actions">
            <Button icon="pi pi-pencil" text rounded aria-label={k("edit", "Edit")} onClick={() => setForm({ ...r, reason: r.reason || "" })} tooltip={k("edit", "Edit")} tooltipOptions={{ position: "top" }} />
            {r.active ? <Button label={k("switchOff", "Switch off")} text size="small" onClick={() => switchOff(r)} /> : null}
          </div>
        )} />
      </DataTable>

      <Dialog header={form?.id ? k("editRule", "Edit rule") : k("newRule", "New rule")} visible={!!form} style={{ width: "32rem" }} modal onHide={() => setForm(null)}
        footer={<>
          <Button label={k("cancel", "Cancel")} text onClick={() => setForm(null)} />
          <Button label={k("save", "Save")} icon="pi pi-check" loading={saving} disabled={!valid} onClick={save} />
        </>}>
        {form ? (
          <div className="admin__grid admin__grid--single">
            {!form.id ? (
              <div className="admin__field">
                <label htmlFor="sod-code">{k("colCode", "Code")}</label>
                <InputText id="sod-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="SOD-OPS-ACCT" />
              </div>
            ) : null}
            <div className="admin__field">
              <label htmlFor="sod-name">{k("colRule", "Rule")}</label>
              <InputText id="sod-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="access__two">
              <div className="admin__field">
                <label htmlFor="sod-a">{k("roleA", "Role")}</label>
                <Dropdown inputId="sod-a" value={form.roleA} options={roles} onChange={(e) => setForm((f) => ({ ...f, roleA: e.value }))} />
              </div>
              <div className="admin__field">
                <label htmlFor="sod-b">{k("roleB", "Not together with")}</label>
                <Dropdown inputId="sod-b" value={form.roleB} options={roles.filter((r) => r.value !== form.roleA)} onChange={(e) => setForm((f) => ({ ...f, roleB: e.value }))} />
              </div>
            </div>
            <div className="admin__field">
              <label>{k("colAction", "When assigned")}</label>
              <SelectButton value={form.action} options={actions} onChange={(e) => e.value && setForm((f) => ({ ...f, action: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="sod-reason">{k("colReason", "Reason")}</label>
              <InputText id="sod-reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default SodRules;
