import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import userService from "../../services/userService";
import { hasPermission } from "../../utils/canOpen";
import { ADMIN_ROLES, getUserRoles } from "../../utils/menuPermissions";
import { openConfirm } from "../../components/ConfirmDialog";
import { Field, PageHeader, StatusTag, date, dateTime, money, num, showError, showSuccess } from "./common";

const ROLES = ["sales", "processing", "operations", "claims", "accounting", "accounting-manager"];
const NUMERIC = ["integer", "number", "money"];
const NO_VALUE = ["empty", "notEmpty"];
const EMPTY = { id: null, name: "", description: "", dataset: null, columns: [], filters: [], groupBy: [], sort: [], sharedRoles: [] };

/** A cell of the result as the column's type reads. */
const cell = (type, v) => {
  if (v === null || v === undefined) return "";
  if (type === "money") return money(v);
  if (type === "number") return num(v);
  if (type === "integer") return num(v, 0);
  if (type === "date") return date(v);
  return String(v);
};

/**
 * Reports > Report Builder: ad hoc reports over curated datasets (policies, receivables, claims, prospects,
 * quotations, collections ...) with the columns, filters, grouping and sort the user picks. A user who sees their
 * own book only sees their own rows here too. Reports can be saved privately or shared with roles and exported to
 * Excel. The administrator also sees the scheduled BI extract (one CSV per dataset written to storage).
 */
const ReportBuilder = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const write = hasPermission("write:reports");
  const admin = getUserRoles().some((r) => ADMIN_ROLES.includes(r));
  const [tab, setTab] = useState(0);
  const [datasets, setDatasets] = useState([]);
  const [saved, setSaved] = useState([]);
  const [roles, setRoles] = useState(ROLES);
  const [def, setDef] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(null);
  const [runs, setRuns] = useState([]);

  const loadSaved = useCallback(async () => {
    try {
      setSaved(await service.savedReports());
    } catch (e) {
      showError(toast, e);
    }
  }, []);
  const loadRuns = useCallback(async () => {
    if (!admin) return;
    try {
      setRuns(await service.biRuns());
    } catch (e) {
      showError(toast, e);
    }
  }, [admin]);
  useEffect(() => {
    service.datasets().then(setDatasets).catch((e) => showError(toast, e));
    loadSaved();
    loadRuns();
    if (admin) userService.getRoles().then((r) => setRoles(r.map((x) => x.code).filter(Boolean).filter((x) => !ADMIN_ROLES.includes(x)))).catch(() => setRoles(ROLES));
  }, [loadSaved, loadRuns, admin]);

  const dataset = useMemo(() => datasets.find((d) => d.key === def.dataset) || null, [datasets, def.dataset]);
  const columnOptions = (dataset?.columns || []).map((c) => ({ value: c.key, label: c.label }));
  const columnOf = (key) => dataset?.columns.find((c) => c.key === key);
  const textColumns = (dataset?.columns || []).filter((c) => !NUMERIC.includes(c.type)).map((c) => ({ value: c.key, label: c.label }));

  const definition = () => ({ dataset: def.dataset, columns: def.columns, filters: def.filters.filter((f) => f.column && f.op), groupBy: def.groupBy, sort: def.sort.filter((s) => s.column) });
  const run = async () => {
    setRunning(true);
    try {
      const r = await service.runReport(definition());
      setResult(r.data);
    } catch (e) {
      showError(toast, e);
    } finally {
      setRunning(false);
    }
  };
  const exportExcel = async () => {
    try {
      await service.exportReport({ ...definition(), name: def.name || dataset?.label });
    } catch (e) {
      showError(toast, e);
    }
  };
  const save = async () => {
    const body = { ...definition(), name: saving.name, description: saving.description || null, sharedRoles: saving.sharedRoles };
    try {
      const r = saving.id ? await service.updateSavedReport(saving.id, body) : await service.saveReport(body);
      showSuccess(toast, r.message);
      setDef({ ...def, id: r.data.id, name: saving.name, description: saving.description, sharedRoles: saving.sharedRoles });
      setSaving(null);
      loadSaved();
    } catch (e) {
      showError(toast, e);
    }
  };
  const open = (r) => {
    setDef({ id: r.id, name: r.name, description: r.description || "", dataset: r.dataset, columns: r.columns, filters: r.filters, groupBy: r.groupBy, sort: r.sort, sharedRoles: r.sharedRoles });
    setResult(null);
    setTab(0);
  };
  const remove = async (r) => {
    let out = null;
    const done = await openConfirm({
      title: t("distribution.rb.deleteTitle", "Delete saved report"),
      severity: "danger",
      message: t("distribution.rb.deleteMessage", "The saved report is deleted for everyone it is shared with. Files already exported are kept."),
      facts: [
        { label: t("distribution.common.name", "Name"), value: r.name },
        { label: t("distribution.rb.dataset", "Dataset"), value: datasets.find((d) => d.key === r.dataset)?.label || r.dataset },
        { label: t("distribution.rb.owner", "Owner"), value: r.ownerName },
        { label: t("distribution.rb.lastRun", "Last run"), value: r.lastRunAt, type: "datetime" },
      ],
      confirmLabel: t("distribution.rb.deleteTitle", "Delete saved report"),
      onConfirm: async () => { out = await service.deleteSavedReport(r.id); },
    });
    if (!done) return;
    showSuccess(toast, out?.message);
    if (def.id === r.id) setDef(EMPTY);
    loadSaved();
  };
  const runExtract = async () => {
    try {
      const r = await service.runBiExtract();
      showSuccess(toast, r.message);
      loadRuns();
    } catch (e) {
      showError(toast, e);
    }
  };

  const setFilter = (i, patch) => setDef((d) => ({ ...d, filters: d.filters.map((f, k) => (k === i ? { ...f, ...patch } : f)) }));
  const opLabel = (op) => t(`distribution.rb.op.${op}`, op);

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.reports", "Reports")} title={t("distribution.rb.title", "Report Builder")}
        subtitle={t("distribution.rb.subtitle", "Pick a dataset, the columns, filters and grouping; run it on screen, export it to Excel, save it for yourself or share it with roles.")} />
      <div className="pe-card">
        <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
          <TabPanel header={t("distribution.rb.build", "Build")}>
            <div className="dist-grid">
              <Field label={t("distribution.rb.dataset", "Dataset")}>
                <Dropdown value={def.dataset} options={datasets.map((d) => ({ value: d.key, label: d.label }))} placeholder={t("distribution.rb.pickDataset", "Choose a dataset")}
                  onChange={(e) => { setDef({ ...EMPTY, dataset: e.value }); setResult(null); }} />
              </Field>
              <Field label={t("distribution.rb.report", "Saved report")}>
                <InputText value={def.id ? def.name : t("distribution.rb.unsaved", "Not saved")} disabled />
              </Field>
              <Field label={t("distribution.rb.columns", "Columns")} full help={t("distribution.rb.columnsHelp", "With grouping, the numeric columns chosen are summed per group")}>
                <MultiSelect value={def.columns} options={columnOptions} display="chip" filter disabled={!dataset} onChange={(e) => setDef({ ...def, columns: e.value })} />
              </Field>
              <Field label={t("distribution.rb.groupBy", "Group by")}>
                <MultiSelect value={def.groupBy} options={textColumns} display="chip" selectionLimit={5} disabled={!dataset} onChange={(e) => setDef({ ...def, groupBy: e.value })} />
              </Field>
              <Field label={t("distribution.rb.sort", "Sort by")}>
                <div className="dist-toolbar">
                  <Dropdown value={def.sort[0]?.column || null} options={columnOptions} showClear disabled={!dataset}
                    onChange={(e) => setDef({ ...def, sort: e.value ? [{ column: e.value, dir: def.sort[0]?.dir || "asc" }] : [] })} />
                  <Dropdown value={def.sort[0]?.dir || "asc"} options={[{ value: "asc", label: t("distribution.rb.asc", "Ascending") }, { value: "desc", label: t("distribution.rb.desc", "Descending") }]}
                    disabled={!def.sort[0]} onChange={(e) => setDef({ ...def, sort: [{ ...def.sort[0], dir: e.value }] })} />
                </div>
              </Field>
            </div>

            <h3 className="pe-section-title mt-3">{t("distribution.rb.filters", "Filters")}</h3>
            {def.filters.map((f, i) => {
              const col = columnOf(f.column);
              const type = col?.type || "text";
              const inputType = type === "date" ? "date" : NUMERIC.includes(type) ? "number" : "text";
              return (
                // eslint-disable-next-line react/no-array-index-key
                <div className="dist-filter-row" key={i}>
                  <Dropdown value={f.column} options={columnOptions} filter aria-label={t("distribution.rb.column", "Column")} onChange={(e) => setFilter(i, { column: e.value, op: columnOf(e.value)?.operators[0] || null, value: "", value2: "" })} />
                  <Dropdown value={f.op} options={(col?.operators || []).map((op) => ({ value: op, label: opLabel(op) }))} aria-label={t("distribution.rb.operator", "Operator")} onChange={(e) => setFilter(i, { op: e.value })} />
                  {NO_VALUE.includes(f.op) ? <span /> : (
                    <InputText type={inputType} value={f.value ?? ""} aria-label={t("distribution.rb.value", "Value")}
                      placeholder={f.op === "in" ? t("distribution.rb.inHelp", "Values separated by commas") : ""} onChange={(e) => setFilter(i, { value: e.target.value })} />
                  )}
                  {f.op === "between" ? <InputText type={inputType} value={f.value2 ?? ""} aria-label={t("distribution.rb.value2", "And")} onChange={(e) => setFilter(i, { value2: e.target.value })} /> : <span />}
                  <Button icon="pi pi-trash" text severity="danger" aria-label={t("distribution.rb.removeFilter", "Remove filter")} onClick={() => setDef({ ...def, filters: def.filters.filter((_, k) => k !== i) })} />
                </div>
              );
            })}
            <Button label={t("distribution.rb.addFilter", "Add filter")} icon="pi pi-filter" text disabled={!dataset} onClick={() => setDef({ ...def, filters: [...def.filters, { column: null, op: null, value: "", value2: "" }] })} />

            <div className="dist-toolbar mt-3">
              <Button label={t("distribution.rb.run", "Run")} icon="pi pi-play" onClick={run} loading={running} disabled={!dataset} />
              <Button label={t("distribution.rb.export", "Export to Excel")} icon="pi pi-file-excel" outlined onClick={exportExcel} disabled={!dataset} />
              {write ? <Button label={def.id ? t("distribution.rb.saveChanges", "Save changes") : t("distribution.rb.save", "Save report")} icon="pi pi-save" outlined disabled={!dataset}
                onClick={() => setSaving({ id: def.id, name: def.name, description: def.description, sharedRoles: def.sharedRoles || [] })} /> : null}
              {write && def.id ? <Button label={t("distribution.rb.saveAs", "Save as new")} icon="pi pi-copy" text disabled={!dataset}
                onClick={() => setSaving({ id: null, name: `${def.name} (2)`, description: def.description, sharedRoles: [] })} /> : null}
            </div>

            {result && (
              <div className="mt-3">
                <p className="pe-muted">
                  {result.truncated
                    ? t("distribution.rb.truncated", "Showing {{shown}} of {{total}} rows; export to Excel for all of them.", { shown: result.rows.length, total: result.total })
                    : t("distribution.rb.rows", "{{count}} rows", { count: result.total })}
                </p>
                <DataTable value={result.rows} size="small" stripedRows paginator rows={25} scrollable emptyMessage={t("distribution.common.none", "Nothing to show")}>
                  {result.columns.map((c) => (
                    <Column key={c.key} field={c.key} header={c.label} sortable body={(r) => cell(c.type, r[c.key])}
                      className={NUMERIC.includes(c.type) ? "bv-num" : undefined} headerClassName={NUMERIC.includes(c.type) ? "bv-num" : undefined}
                      footer={result.totals[c.key] !== undefined ? cell(c.type, result.totals[c.key]) : undefined} />
                  ))}
                </DataTable>
              </div>
            )}
          </TabPanel>

          <TabPanel header={t("distribution.rb.saved", "Saved reports")}>
            <DataTable value={saved} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="name" header={t("distribution.common.name", "Name")} />
              <Column header={t("distribution.rb.dataset", "Dataset")} body={(r) => datasets.find((d) => d.key === r.dataset)?.label || r.dataset} />
              <Column field="description" header={t("distribution.common.description", "Description")} />
              <Column field="ownerName" header={t("distribution.rb.owner", "Owner")} />
              <Column header={t("distribution.rb.sharedWith", "Shared with")} body={(r) => (r.sharedRoles.length ? r.sharedRoles.join(", ") : t("distribution.rb.private", "Private"))} />
              <Column header={t("distribution.rb.lastRun", "Last run")} body={(r) => dateTime(r.lastRunAt)} />
              <Column body={(r) => (
                <div className="dist-actions">
                  <Button icon="pi pi-folder-open" text size="small" tooltip={t("distribution.rb.open", "Open")} aria-label={t("distribution.rb.open", "Open")} onClick={() => open(r)} />
                  <Button icon="pi pi-file-excel" text size="small" tooltip={t("distribution.rb.export", "Export to Excel")} aria-label={t("distribution.rb.export", "Export to Excel")}
                    onClick={() => service.exportSavedReport(r.id).catch((e) => showError(toast, e))} />
                  {write ? <Button icon="pi pi-trash" text size="small" severity="danger" aria-label={t("distribution.common.delete", "Delete")} onClick={() => remove(r)} /> : null}
                </div>
              )} />
            </DataTable>
          </TabPanel>

          {admin ? (
            <TabPanel header={t("distribution.rb.bi", "BI extract")}>
              <div className="dist-toolbar">
                <p className="pe-muted">{t("distribution.rb.biHelp", "The bi-extract job writes one CSV per dataset (Settings: bi.extract_datasets) to the storage folder for the BI tool to pick up.")}</p>
                <Button label={t("distribution.rb.runExtract", "Run now")} icon="pi pi-refresh" onClick={runExtract} />
              </div>
              <DataTable value={runs} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.common.none", "Nothing to show")}>
                <Column header={t("distribution.rb.started", "Started")} body={(r) => dateTime(r.startedAt)} />
                <Column field="folder" header={t("distribution.rb.folder", "Folder")} />
                <Column header={t("distribution.rb.files", "Files")} body={(r) => (r.files || []).map((f) => `${f.dataset} (${f.rows})`).join(", ")} />
                <Column field="rowsTotal" header={t("distribution.rb.rowsTotal", "Rows")} className="bv-num" headerClassName="bv-num" />
                <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
                <Column field="error" header={t("distribution.rb.error", "Error")} />
              </DataTable>
            </TabPanel>
          ) : null}
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={saving?.id ? t("distribution.rb.saveChanges", "Save changes") : t("distribution.rb.save", "Save report")} visible={!!saving} style={{ width: "min(560px, 96vw)" }}
        onHide={() => setSaving(null)} footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setSaving(null)} />
          <Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={save} disabled={!saving?.name} /></div>}>
        {saving && (
          <div className="dist-grid">
            <Field label={t("distribution.common.name", "Name")} full><InputText value={saving.name} onChange={(e) => setSaving({ ...saving, name: e.target.value })} /></Field>
            <Field label={t("distribution.common.description", "Description")} full><InputText value={saving.description || ""} onChange={(e) => setSaving({ ...saving, description: e.target.value })} /></Field>
            <Field label={t("distribution.rb.shareWith", "Share with roles")} full help={t("distribution.rb.shareHelp", "Empty: only you (and the administrator) see it. Each user still sees only the rows their access allows.")}>
              <MultiSelect value={saving.sharedRoles} options={roles.map((r) => ({ value: r, label: r }))} display="chip" onChange={(e) => setSaving({ ...saving, sharedRoles: e.value })} />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default ReportBuilder;
