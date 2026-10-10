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
import { humanize, RecordActivityLog } from "../../components/ActivityLog";
import DetailDialog from "../../components/DetailDialog";
import { Field, OpsTag, PageHeader, blank, isoOf, showError, showSuccess, toDate, useFieldErrors } from "./common";

const HIDDEN = ["audit-user", "audit-date"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// whole numbers of days (payment terms, follow-up days, maximum days in force) and months (useful life); percentages
// (premium retained, rates) keep their unit, which the form shows in the label hint
const DAY_FIELDS = /Days$/;
const MONTH_FIELDS = /Months$/;
const PERCENT_FIELDS = /(Percent|Pct|Rate)$/;
const display = (f, v, t) => {
  if (v === null || v === undefined || v === "") return "";
  if (f.type === "boolean") return v === true || v === "true" ? t("detailView.yes") : t("detailView.no");
  if (DAY_FIELDS.test(f.name) && Number.isFinite(Number(v))) return t("opsAcc.masters.days", { count: Number(v) });
  if (MONTH_FIELDS.test(f.name) && Number.isFinite(Number(v))) return t("opsAcc.masters.months", { count: Number(v) });
  if ((PERCENT_FIELDS.test(f.name) || /%/.test(f.label || "")) && Number.isFinite(Number(v))) return `${Number(v)}%`;
  // "*" matches every line of business or claim type
  if (v === "*") return t("opsAcc.masters.anyValue");
  if (f.type === "select" && Array.isArray(f.options)) {
    const option = f.options.find((o) => (o && typeof o === "object" ? o.value : o) === v);
    if (option && typeof option === "object") return String(option.label ?? v);
    return humanize(String(v));
  }
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

// the label without the hint it carries on the form ("Line of Business (* = all)")
const plainLabel = (label) => String(label || "").replace(/\s*\([^)]*\)\s*$/, "");

// the fields that name a record: its code and its name, or the first text fields of the master
const NAME_FIELDS = /^(name|documentName|title|description)$/;
const recordName = (r, fields) => {
  const code = r.code ? String(r.code) : "";
  const nameField = fields.find((f) => NAME_FIELDS.test(f.name) && r[f.name]);
  const name = nameField ? String(r[nameField.name]) : "";
  return [code, name].filter(Boolean).join(" · ") || String(r.id);
};
// the record as people call it: its name, else its code
const shortName = (r, fields) => {
  const nameField = fields.find((f) => NAME_FIELDS.test(f.name) && r[f.name]);
  return nameField ? String(r[nameField.name]) : String(r.code || r.id || "");
};
// select options as the list shows them: a plain code is put in words, a { label, value } option keeps its label
const optionsOf = (options) => options.map((o) => (o && typeof o === "object" ? o : { label: humanize(String(o)), value: o }));

/**
 * A master kept on the generic master store and maintained by the team that uses it (Repair Shops, Suppliers, Asset
 * Classes, Short-Period Rates, Cancellation Reasons, Claim Document Checklist): list, add, edit, activate / deactivate.
 * The fields come from the master type definition, so a field added on Master > Configuration shows here too; a field
 * taken from another master or from the users is a list (it stays a text box when the list cannot be read). `item`
 * names one record of the master ("supplier") for the titles of the add and edit panels.
 * `optionLabels` gives the business labels of the values of a select field ({ field: (value) => label }); `filterBy`
 * names a select field offered as a filter above the list.
 */
const MasterRecordsPage = ({ type, title, item, group, section, help, columns, optionLabels, filterBy }) => {
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
  const [history, setHistory] = useState(null); // the record whose history is open

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
    // the code and name are in the title; the facts are the other fields of the list, as they are shown there
    const named = ["code", ...fields.filter((f) => NAME_FIELDS.test(f.name)).slice(0, 1).map((f) => f.name)];
    const ok = await openConfirm({
      title: t(`opsAcc.confirmations.master.${action}ItemTitle`, { item: item || title, name: recordName(r, fields) }),
      severity: r.isActive ? "warning" : "neutral",
      message: t(`opsAcc.confirmations.master.${action}Message`),
      facts: [
        ...shown.filter((f) => !named.includes(f.name) && f.type !== "text").slice(0, 4)
          .map((f) => ({ label: plainLabel(f.label), value: display(f, r[f.name], t), hidden: display(f, r[f.name], t) === "" })),
      ],
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
    if (f.type === "select" && Array.isArray(f.options)) return <Dropdown value={v ?? null} options={optionsOf(f.options)} optionLabel="label" optionValue="value" onChange={(e) => set(f.name, e.value)} className="w-full" showClear />;
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
            <RowActions onEdit={() => open({ id: r.id, values: { ...r } })} editLabel={t("opsAcc.edit")} active={r.isActive} onStatus={() => toggle(r)}>
              <Button type="button" icon="pi pi-history" text rounded aria-label={t("opsAcc.masters.history")} tooltip={t("opsAcc.masters.history")} tooltipOptions={{ position: "top" }} onClick={() => setHistory(r)} />
            </RowActions>
          )} />
        </DataTable>
      </div>
      <Dialog className="pe-dialog" header={edit?.id ? t("opsAcc.masters.editItem", { item: item || title, name: shortName(edit.values, fields) }) : t("opsAcc.masters.newItem", { item: item || title })} visible={!!edit} style={{ width: "min(720px, 96vw)" }}
        onHide={() => open(null)} footer={<div><Button label={t("opsAcc.cancel")} outlined onClick={() => open(null)} /><Button label={t("opsAcc.save")} icon="pi pi-save" onClick={save} /></div>}>
        {edit && <div className="grid">{fields.map((f) => <Field key={f.name} label={f.label} required={f.required && !f.numbering} error={errors[f.name]}>{input(f)}</Field>)}</div>}
      </Dialog>
      {/* every change of a record (bank details, terms, rates), with who made it and when */}
      <DetailDialog visible={!!history} onHide={() => setHistory(null)} size="md"
        header={history ? t("opsAcc.masters.historyOf", { item: item || title, name: recordName(history, fields) }) : ""}>
        {history && <RecordActivityLog entity={`master:${type}`} recordId={history.id} />}
      </DetailDialog>
    </div>
  );
};

export default MasterRecordsPage;
