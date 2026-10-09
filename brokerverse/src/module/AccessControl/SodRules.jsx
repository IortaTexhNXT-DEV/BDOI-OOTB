import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { SelectButton } from "primereact/selectbutton";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import accessControlService from "../../services/accessControlService";
import { indexCatalogue } from "./roleAccess";
import { PageHeader, useAccessNames, useLabels } from "./common";
import "../Administration/index.scss";
import "./index.scss";

const EMPTY = { code: "", name: "", kind: "roles", roleA: null, roleB: null, accessA: [], accessB: [], action: "block", reason: "", active: true };

/**
 * Master > User Management > Segregation of Duties: pairs of roles one person should not hold together, and access a
 * role or a person should not combine (issuing receipts and selling). "Block" stops the roles being given to the same
 * user and the change of a role's access; "Warn" allows it and says so. The User Access Matrix lists who breaks a rule.
 */
const SodRules = () => {
  const k = useLabels();
  const toast = useRef(null);
  const [rules, setRules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [catalogue, setCatalogue] = useState(null);
  const names = useAccessNames();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m, a] = await Promise.all([accessControlService.sodRules(), accessControlService.userMatrix(), accessControlService.roleAccess()]);
      setRules(r);
      setRoles(m.roles.map((x) => ({ label: x.name, value: x.code })));
      setCatalogue(a.catalogue);
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

  // the access a rule can name, area by area: "Receipts › Create and edit"
  const accessOptions = useMemo(() => {
    const idx = indexCatalogue(catalogue);
    return idx.areas.map((a) => ({
      label: names.area(a),
      items: idx.modulesOf(a.code).flatMap((m) => m.levels.map((l) => ({ label: `${names.module(m)} › ${names.level(l)}`, value: idx.code(m.code, l) }))),
    }));
  }, [catalogue, names]);
  const kinds = [{ label: k("kindRoles", "Roles held together"), value: "roles" }, { label: k("kindAccess", "Access combined"), value: "access" }];
  const actions = [{ label: k("actionBlock", "Block"), value: "block" }, { label: k("actionWarn", "Warn"), value: "warn" }];
  const sides = form?.kind === "access"
    ? form.accessA.length && form.accessB.length && !form.accessA.some((c) => form.accessB.includes(c))
    : form?.roleA && form?.roleB && form.roleA !== form.roleB;
  const valid = form && form.name.trim() && sides && (form.id || form.code.trim());
  const between = (r) => (r.kind === "access" ? (
    <div className="access__user">
      <span>{r.accessANames.join("; ")}</span>
      <span className="access__muted">{k("notCombinedWith", "not combined with {{access}}", { access: r.accessBNames.join("; ") })}</span>
    </div>
  ) : `${r.roleAName} + ${r.roleBName}`);

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
        <Column header={k("colBetween", "Between")} body={between} />
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
            <div className="admin__field">
              <label>{k("colKind", "Rule type")}</label>
              <SelectButton value={form.kind} options={kinds} onChange={(e) => e.value && setForm((f) => ({ ...f, kind: e.value }))} disabled={!!form.id} />
            </div>
            {form.kind === "access" ? (
              <>
                <div className="admin__field">
                  <label htmlFor="sod-access-a">{k("accessA", "Access")}</label>
                  <MultiSelect inputId="sod-access-a" value={form.accessA} options={accessOptions} optionGroupLabel="label" optionGroupChildren="items" display="chip" filter
                    onChange={(e) => setForm((f) => ({ ...f, accessA: e.value }))} placeholder={k("chooseAccess", "Choose the access")} />
                </div>
                <div className="admin__field">
                  <label htmlFor="sod-access-b">{k("accessB", "Not combined with")}</label>
                  <MultiSelect inputId="sod-access-b" value={form.accessB} options={accessOptions} optionGroupLabel="label" optionGroupChildren="items" display="chip" filter
                    onChange={(e) => setForm((f) => ({ ...f, accessB: e.value }))} placeholder={k("chooseAccess", "Choose the access")} />
                </div>
              </>
            ) : (
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
            )}
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
