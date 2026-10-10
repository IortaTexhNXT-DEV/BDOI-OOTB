import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { Toast } from "primereact/toast";
import PageActions from "../../components/PageActions";
import RowActions, { actionsColumn } from "../../components/RowActions";
import mastersService from "../../services/mastersService";
import service from "../../services/opsAccountingService";
import userService from "../../services/userService";
import { openConfirm } from "../../components/ConfirmDialog";
import { Field, OpsTag, PageHeader, blank, isoOf, showError, showSuccess, toDate, useFieldErrors } from "./common";

const HIDDEN = ["audit-user", "audit-date"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const display = (f, v, t) => {
  if (v === null || v === undefined || v === "") return "";
  if (f.type === "boolean") return v === true || v === "true" ? t("detailView.yes") : t("detailView.no");
  const option = Array.isArray(f.options) ? f.options.find((o) => o?.value === v) : null;
  if (option) return option.label;
  return String(v);
};
// a field picked from another master (optionsFrom) or from the users: a field named ...Code keeps the code, any other the name
const lookup = async (f) => {
  if (f.optionsFrom === "user") return (await userService.lookupUsers()).map((u) => ({ label: u.name, value: u.name }));
  const byCode = /Code$/.test(f.name);
  return (await mastersService.options(f.optionsFrom, { valueField: byCode ? "code" : "label" }))
    .map((o) => ({ label: byCode ? `${o.code} - ${o.label}` : o.label, value: o.value }));
};
/** A select field whose values have business labels: its options as { label, value } (the stored value stays the code). */
const withLabels = (f, label) => (label && Array.isArray(f.options) ? { ...f, options: f.options.map((value) => ({ label: label(value), value })) } : f);

/**
 * A master kept on the generic master store and maintained by the team that uses it (Repair Shops, Suppliers, Asset
 * Classes, Short-Period Rates, Cancellation Reasons, Claim Document Checklist): list, add, edit, activate / deactivate.
 * The fields come from the master type definition, so a field added on Master > Configuration shows here too; a field
 * taken from another master or from the users is a list (it stays a text box when the list cannot be read).
 * `optionLabels` gives the business labels of the values of a select field ({ field: (value) => label }); `filterBy`
 * names a select field offered as a filter above the list.
 */
const MasterRecordsPage = ({ type, title, group, section, help, columns, optionLabels, filterBy }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(false);
  const [filterValue, setFilterValue] = useState(null);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null); // { id, values }
  const { errors, check, fromApi, clear } = useFieldErrors();
  const open = (value) => { clear(); setEdit(value); };

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
  useEffect(() => {
    const listed = fields.filter((f) => f.optionsFrom);
    Promise.all(listed.map((f) => lookup(f).then((options) => [f.name, options]).catch(() => null)))
      .then((loaded) => setLists(Object.fromEntries(loaded.filter(Boolean))));
  }, [fields]);
  const filterField = filterBy ? fields.find((f) => f.name === filterBy) : null;

  const shown = useMemo(() => (columns ? fields.filter((f) => columns.includes(f.name)) : fields.slice(0, 6)), [fields, columns]);
  // the rules of the type definition the API applies: required (a code the system numbers may be left empty), e-mail, length
  const problem = (f) => {
    const v = edit.values[f.name];
    if (blank(v) || (Array.isArray(v) && !v.length)) return f.required && !f.numbering && f.type !== "boolean" ? t("opsAcc.required") : null;
    if (f.type === "email" && !EMAIL.test(String(v).trim())) return t("opsAcc.invalidEmail");
    if (f.maxLength && String(v).length > f.maxLength) return t("opsAcc.tooLong", { max: f.maxLength });
    const from = f.notBefore ? edit.values[f.notBefore] : null;
    if (f.type === "date" && from && String(v).slice(0, 10) < String(from).slice(0, 10)) return t("opsAcc.notBefore", { other: fields.find((x) => x.name === f.notBefore)?.label || f.notBefore });
    return null;
  };
  const save = async () => {
    if (!check(Object.fromEntries(fields.map((f) => [f.name, problem(f)])))) return;
    try {
      const payload = Object.fromEntries(fields.map((f) => [f.name, edit.values[f.name] ?? (f.type === "boolean" ? false : null)]).filter(([, v]) => v !== null && v !== ""));
      if (edit.id) await service.updateMaster(type, edit.id, payload);
      else await service.createMaster(type, payload);
      showSuccess(toast, t("opsAcc.masters.saved", { name: title }));
      open(null);
      load();
    } catch (e) {
      fromApi(e);
      showError(toast, e);
    }
  };
  const toggle = async (r) => {
    const action = r.isActive ? "deactivate" : "activate";
    const ok = await openConfirm({
      title: t(`opsAcc.confirmations.master.${action}Title`, { name: title }),
      severity: r.isActive ? "warning" : "neutral",
      message: t(`opsAcc.confirmations.master.${action}Message`),
      facts: shown.slice(0, 3).map((f) => ({ label: f.label, value: display(f, r[f.name], t) })),
      confirmLabel: t(`opsAcc.${action}`),
    });
    if (!ok) return;
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
    if (lists[f.name]) {
      const options = v && !lists[f.name].some((o) => o.value === v) ? [{ label: String(v), value: v }, ...lists[f.name]] : lists[f.name];
      return <Dropdown inputId={`f-${f.name}`} value={v ?? null} options={options} onChange={(e) => set(f.name, e.value)} className="w-full" filter showClear placeholder={t("opsAcc.select", "Select")} />;
    }
    if (f.type === "select" && Array.isArray(f.options)) return <Dropdown value={v ?? null} options={f.options} onChange={(e) => set(f.name, e.value)} className="w-full" showClear />;
    if (f.type === "multiselect" && Array.isArray(f.options)) return <MultiSelect value={Array.isArray(v) ? v : []} options={f.options} onChange={(e) => set(f.name, e.value)} className="w-full" display="chip" />;
    if (f.type === "date") return <Calendar value={toDate(v)} onChange={(e) => set(f.name, isoOf(e.value))} dateFormat="yy-mm-dd" showIcon showButtonBar className="w-full" />;
    if (f.type === "number" || f.type === "integer") {
      return <InputNumber value={v === null || v === undefined || v === "" ? null : Number(v)} onValueChange={(e) => set(f.name, e.value)} className="w-full"
        mode="decimal" maxFractionDigits={f.type === "integer" ? 0 : 4} useGrouping={false} />;
    }
    if (f.type === "text") return <InputTextarea value={v ?? ""} onChange={(e) => set(f.name, e.target.value)} rows={2} className="w-full" autoResize />;
    return <InputText value={v ?? ""} onChange={(e) => set(f.name, e.target.value)} className="w-full" maxLength={f.maxLength || undefined} keyfilter={f.type === "email" ? "email" : undefined} />;
  };

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={title} group={group} section={section} help={help}>
        <PageActions onAdd={() => open({ id: null, values: {} })} addLabel={t("opsAcc.masters.add")} />
      </PageHeader>
      <div className="pe-card">
        <div className="bv-list-toolbar">
          <span className="p-input-icon-left bv-list-search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("opsAcc.search")} aria-label={t("opsAcc.search")} />
          </span>
          {filterField && (
            <Dropdown value={filterValue} options={filterField.options || []} onChange={(e) => setFilterValue(e.value ?? null)} showClear className="w-18rem"
              placeholder={t("opsAcc.masters.allOf", { name: filterField.label })} aria-label={filterField.label} />
          )}
        </div>
        <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={25} emptyMessage={t("opsAcc.none")}>
          {shown.map((f) => <Column key={f.name} header={f.label} body={(r) => display(f, r[f.name], t)} />)}
          <Column header={t("opsAcc.statusLabel")} body={(r) => <OpsTag status={r.isActive ? "active" : "inactive"} />} />
          <Column header={t("common.actions")} {...actionsColumn} body={(r) => (
            <RowActions onEdit={() => open({ id: r.id, values: { ...r } })} editLabel={t("opsAcc.edit")} active={r.isActive} onStatus={() => toggle(r)} />
          )} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={edit?.id ? t("opsAcc.masters.edit", { name: title }) : t("opsAcc.masters.new", { name: title })} visible={!!edit} style={{ width: "min(720px, 96vw)" }}
        onHide={() => open(null)} footer={<div><Button label={t("opsAcc.cancel")} text onClick={() => open(null)} /><Button label={t("opsAcc.save")} icon="pi pi-save" onClick={save} /></div>}>
        {edit && <div className="grid">{fields.map((f) => <Field key={f.name} label={f.label} required={f.required && !f.numbering} error={errors[f.name]}>{input(f)}</Field>)}</div>}
      </Dialog>
    </div>
  );
};

export default MasterRecordsPage;
