import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import { Field, OpsTag, PageHeader, showError, showSuccess } from "./common";

const HIDDEN = ["audit-user", "audit-date"];
const display = (f, v) => {
  if (v === null || v === undefined || v === "") return "";
  if (f.type === "boolean") return v === true || v === "true" ? "Yes" : "No";
  const option = Array.isArray(f.options) ? f.options.find((o) => o?.value === v) : null;
  if (option) return option.label;
  return String(v);
};
/** A select field whose values have business labels: its options as { label, value } (the stored value stays the code). */
const withLabels = (f, label) => (label && Array.isArray(f.options) ? { ...f, options: f.options.map((value) => ({ label: label(value), value })) } : f);

/**
 * A master kept on the generic master store and maintained by the team that uses it (Repair Shops, Suppliers, Asset
 * Classes, Short-Period Rates, Cancellation Reasons, Claim Document Checklist): list, add, edit, activate / deactivate.
 * The fields come from the master type definition, so a field added on Master > Configuration shows here too.
 * `optionLabels` gives the business labels of the values of a select field ({ field: (value) => label }); `filterBy`
 * names a select field offered as a filter above the list.
 */
const MasterRecordsPage = ({ type, title, group, section, intro, columns, optionLabels, filterBy }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterValue, setFilterValue] = useState(null);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null); // { id, values }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await service.masterRecords(type, { search: search || undefined, status: "all", ...(filterBy && filterValue ? { [filterBy]: filterValue } : {}) });
      setRows(r.rows);
      setFields((r.type?.fields || []).filter((f) => !HIDDEN.includes(f.type)).map((f) => withLabels(f, optionLabels?.[f.name])));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [type, search, filterBy, filterValue, optionLabels]);
  useEffect(() => { load(); }, [load]);
  const filterField = filterBy ? fields.find((f) => f.name === filterBy) : null;

  const shown = useMemo(() => (columns ? fields.filter((f) => columns.includes(f.name)) : fields.slice(0, 6)), [fields, columns]);
  const save = async () => {
    try {
      const payload = Object.fromEntries(fields.map((f) => [f.name, edit.values[f.name] ?? (f.type === "boolean" ? false : null)]).filter(([, v]) => v !== null && v !== ""));
      if (edit.id) await service.updateMaster(type, edit.id, payload);
      else await service.createMaster(type, payload);
      showSuccess(toast, t("opsAcc.masters.saved", { name: title }));
      setEdit(null);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const toggle = async (r) => {
    try {
      await service.setMasterStatus(type, r.id, r.isActive ? "Inactive" : "Active");
      load();
    } catch (e) {
      showError(toast, e);
    }
  };
  const set = (name, value) => setEdit((d) => ({ ...d, values: { ...d.values, [name]: value } }));
  const input = (f) => {
    const v = edit.values[f.name];
    if (f.type === "boolean") return <Checkbox inputId={`f-${f.name}`} checked={v === true || v === "true"} onChange={(e) => set(f.name, e.checked)} />;
    if (f.type === "select" && Array.isArray(f.options)) return <Dropdown value={v ?? null} options={f.options} onChange={(e) => set(f.name, e.value)} className="w-full" showClear />;
    if (f.type === "number" || f.type === "integer") {
      return <InputNumber value={v === null || v === undefined || v === "" ? null : Number(v)} onValueChange={(e) => set(f.name, e.value)} className="w-full"
        mode="decimal" maxFractionDigits={f.type === "integer" ? 0 : 4} useGrouping={false} />;
    }
    if (f.type === "text") return <InputTextarea value={v ?? ""} onChange={(e) => set(f.name, e.target.value)} rows={2} className="w-full" autoResize />;
    return <InputText value={v ?? ""} onChange={(e) => set(f.name, e.target.value)} className="w-full" />;
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={title} group={group} section={section} subtitle={intro}>
        <Button icon="pi pi-plus" label={t("opsAcc.masters.add")} onClick={() => setEdit({ id: null, values: {} })} />
      </PageHeader>
      <div className="pe-card">
        <div className="flex gap-2 mb-2">
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.search")} className="w-20rem" />
          {filterField && (
            <Dropdown value={filterValue} options={filterField.options || []} onChange={(e) => setFilterValue(e.value ?? null)} showClear className="w-18rem"
              placeholder={t("opsAcc.masters.allOf", { name: filterField.label })} aria-label={filterField.label} />
          )}
        </div>
        <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={25} emptyMessage={t("opsAcc.none")}>
          {shown.map((f) => <Column key={f.name} header={f.label} body={(r) => display(f, r[f.name])} />)}
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.isActive ? "active" : "inactive"} />} />
          <Column body={(r) => (
            <span className="flex gap-1">
              <Button icon="pi pi-pencil" text size="small" aria-label={t("opsAcc.edit")} tooltip={t("opsAcc.edit")} onClick={() => setEdit({ id: r.id, values: { ...r } })} />
              <Button icon={r.isActive ? "pi pi-ban" : "pi pi-check"} text size="small" aria-label={r.isActive ? t("opsAcc.deactivate") : t("opsAcc.activate")}
                tooltip={r.isActive ? t("opsAcc.deactivate") : t("opsAcc.activate")} onClick={() => toggle(r)} />
            </span>
          )} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={edit?.id ? t("opsAcc.masters.edit", { name: title }) : t("opsAcc.masters.new", { name: title })} visible={!!edit} style={{ width: "min(720px, 96vw)" }}
        onHide={() => setEdit(null)} footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => setEdit(null)} /><Button label={t("opsAcc.save")} icon="pi pi-save" onClick={save} /></div>}>
        {edit && <div className="grid">{fields.map((f) => <Field key={f.name} label={f.label} required={f.required}>{input(f)}</Field>)}</div>}
      </Dialog>
    </div>
  );
};

export default MasterRecordsPage;
