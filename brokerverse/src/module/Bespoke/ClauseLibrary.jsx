import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import bespokeService from "../../services/bespokeService";
import { BespokeTag, PageHeader, formatDate } from "./shared";
import { isoDate } from "../Placement/dates";
import "../Placement/index.scss";
import "./index.scss";

const LINES = ["FIRE", "IAR", "MARINE", "ENGINEERING", "CASUALTY", "ACCIDENT", "MOTOR", "BOND"];
const EMPTY = { code: "", title: "", clauseType: "clause", linesOfBusiness: [], category: "", wording: "", effectiveFrom: null, changeNote: "", status: "active" };

/** Master > Clause Library: clauses, warranties, exclusions ... with versioned wording and placeholders. */
const ClauseLibrary = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState({ clauseTypes: [], placeholders: [] });
  const [filters, setFilters] = useState({ clauseType: "", lob: "", status: "", search: "" });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  const fail = (e) => toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await bespokeService.listClauses({ ...filters, status: filters.status || undefined }));
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);
  useEffect(() => { bespokeService.clauseOptions().then(setOptions).catch(() => {}); }, []);

  const typeOptions = (options.clauseTypes || []).map((c) => ({ label: t(`bespoke.clauseType.${c}`, { defaultValue: c }), value: c }));
  const open = async (row) => {
    if (!row) { setEditing({ ...EMPTY, isNew: true }); return; }
    try {
      const c = await bespokeService.getClause(row.id);
      setDetail(c);
      setEditing({ ...c, effectiveFrom: null, changeNote: "", isNew: false, originalWording: c.wording });
    } catch (e) {
      fail(e);
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      const body = { title: editing.title, clauseType: editing.clauseType, linesOfBusiness: editing.linesOfBusiness, category: editing.category || null, status: editing.status,
        wording: editing.wording, effectiveFrom: isoDate(editing.effectiveFrom) || undefined, changeNote: editing.changeNote || undefined };
      if (editing.isNew) await bespokeService.createClause({ ...body, code: editing.code });
      else await bespokeService.updateClause(editing.id, body);
      toast.current?.show({ severity: "success", summary: t("bespoke.library.saved"), life: 3000 });
      setEditing(null);
      setDetail(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const insertPlaceholder = (key) => setEditing({ ...editing, wording: `${editing.wording || ""}{${key}}` });
  const wordingChanged = editing && !editing.isNew && editing.wording !== editing.originalWording;

  return (
    <div className="placement-page bespoke-page">
      <Toast ref={toast} />
      <PageHeader title={t("bespoke.library.title")} subtitle={t("bespoke.library.subtitle")}>
        <Button label={t("bespoke.library.new")} icon="pi pi-plus" onClick={() => open(null)} />
      </PageHeader>
      <div className="placement-card">
        <div className="toolbar">
          <span className="p-input-icon-left search">
            <i className="pi pi-search" />
            <InputText value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder={t("bespoke.library.search")} />
          </span>
          <Dropdown value={filters.clauseType} options={[{ label: t("bespoke.library.allTypes"), value: "" }, ...typeOptions]} onChange={(e) => setFilters({ ...filters, clauseType: e.value })} />
          <Dropdown value={filters.lob} options={[{ label: t("bespoke.library.allLines"), value: "" }, ...LINES.map((l) => ({ label: l, value: l }))]} onChange={(e) => setFilters({ ...filters, lob: e.value })} />
          <Dropdown value={filters.status} options={[{ label: t("bespoke.status.active"), value: "" }, { label: t("bespoke.status.inactive"), value: "inactive" }, { label: t("bespoke.library.allStatuses"), value: "all" }]}
            onChange={(e) => setFilters({ ...filters, status: e.value })} />
        </div>
        <DataTable value={rows} loading={loading} dataKey="id" stripedRows size="small" className="placement-grid" paginator rows={15} emptyMessage={t("bespoke.library.empty")}
          onRowClick={(e) => open(e.data)} rowClassName={() => "clickable"}>
          <Column field="code" header={t("bespoke.fields.code")} body={(r) => <span className="doc-number">{r.code}</span>} sortable />
          <Column field="title" header={t("bespoke.fields.title")} sortable />
          <Column field="clauseType" header={t("bespoke.fields.clauseType")} body={(r) => t(`bespoke.clauseType.${r.clauseType}`, { defaultValue: r.clauseType })} sortable />
          <Column header={t("bespoke.fields.lines")} body={(r) => (r.linesOfBusiness.length ? r.linesOfBusiness.join(", ") : t("bespoke.library.allLines"))} />
          <Column field="currentVersion" header={t("bespoke.fields.version")} className="num" />
          <Column header={t("bespoke.fields.effective")} body={(r) => `${formatDate(r.effectiveFrom)}${r.effectiveTo ? ` - ${formatDate(r.effectiveTo)}` : ""}`} />
          <Column header={t("bespoke.fields.status")} body={(r) => <BespokeTag status={r.status} />} />
        </DataTable>
      </div>

      <Dialog header={editing?.isNew ? t("bespoke.library.new") : `${editing?.code || ""} ${editing?.title || ""}`} visible={!!editing} style={{ width: "min(960px, 96vw)" }}
        onHide={() => { setEditing(null); setDetail(null); }} className="placement-dialog"
        footer={<Button label={t("common.save", { defaultValue: "Save" })} icon="pi pi-check" loading={saving} onClick={save} disabled={!editing?.title || !editing?.wording || (editing?.isNew && !editing?.code)} />}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-3">
              <label htmlFor="cl-code">{t("bespoke.fields.code")}</label>
              <InputText id="cl-code" value={editing.code} disabled={!editing.isNew} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="cl-title">{t("bespoke.fields.title")}</label>
              <InputText id="cl-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-3">
              <label htmlFor="cl-type">{t("bespoke.fields.clauseType")}</label>
              <Dropdown inputId="cl-type" value={editing.clauseType} options={typeOptions} onChange={(e) => setEditing({ ...editing, clauseType: e.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="cl-lines">{t("bespoke.fields.lines")}</label>
              <MultiSelect inputId="cl-lines" value={editing.linesOfBusiness} options={LINES.map((l) => ({ label: l, value: l }))} onChange={(e) => setEditing({ ...editing, linesOfBusiness: e.value })}
                placeholder={t("bespoke.library.allLines")} className="w-full" display="chip" />
            </div>
            <div className="col-12 md:col-3">
              <label htmlFor="cl-cat">{t("bespoke.fields.category")}</label>
              <InputText id="cl-cat" value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-3">
              <label htmlFor="cl-status">{t("bespoke.fields.status")}</label>
              <Dropdown inputId="cl-status" value={editing.status} options={["active", "inactive"].map((s) => ({ label: t(`bespoke.status.${s}`), value: s }))} onChange={(e) => setEditing({ ...editing, status: e.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="cl-wording">{t("bespoke.fields.wording")}</label>
              <InputTextarea id="cl-wording" value={editing.wording} onChange={(e) => setEditing({ ...editing, wording: e.target.value })} rows={6} autoResize className="w-full" />
              <div className="placeholder-chips">
                <span className="hint">{t("bespoke.library.placeholderHint")}</span>
                {(options.placeholders || []).map((p) => (
                  <Button key={p.key} label={`{${p.key}}`} tooltip={p.label} size="small" text onClick={() => insertPlaceholder(p.key)} />
                ))}
              </div>
            </div>
            {(editing.isNew || wordingChanged) && (
              <>
                <div className="col-12 md:col-4">
                  <label htmlFor="cl-from">{t("bespoke.fields.effectiveFrom")}</label>
                  <Calendar inputId="cl-from" value={editing.effectiveFrom} onChange={(e) => setEditing({ ...editing, effectiveFrom: e.value })} dateFormat="yy-mm-dd" showIcon className="w-full" />
                  <span className="hint">{t("bespoke.library.effectiveHint")}</span>
                </div>
                <div className="col-12 md:col-8">
                  <label htmlFor="cl-note">{t("bespoke.fields.changeNote")}</label>
                  <InputText id="cl-note" value={editing.changeNote} onChange={(e) => setEditing({ ...editing, changeNote: e.target.value })} className="w-full" />
                </div>
              </>
            )}
            {detail?.versions?.length > 0 && (
              <div className="col-12">
                <div className="section-title">{t("bespoke.library.versions")}</div>
                <DataTable value={detail.versions} size="small" dataKey="version">
                  <Column field="version" header={t("bespoke.fields.version")} />
                  <Column header={t("bespoke.fields.effective")} body={(v) => `${formatDate(v.effectiveFrom)}${v.effectiveTo ? ` - ${formatDate(v.effectiveTo)}` : ""}`} />
                  <Column field="wording" header={t("bespoke.fields.wording")} body={(v) => <span className="wording-cell">{v.wording}</span>} />
                  <Column field="changeNote" header={t("bespoke.fields.changeNote")} />
                  <Column field="createdBy" header={t("bespoke.fields.changedBy")} />
                </DataTable>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default ClauseLibrary;
