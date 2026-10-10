import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { SplitButton } from "primereact/splitbutton";
import DetailDialog from "../../components/DetailDialog";
import ImportDialog from "../../components/ImportDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import PageActions from "../../components/PageActions";
import RowActions, { actionsColumn } from "../../components/RowActions";
import FieldError from "../../components/FieldError";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import { SectionCard, FilterBar } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { dateTimeOf, num, count, useAccess, useDownload, useWorkspace } from "./shared";

const EMPTY_MAP = { id: null, object: null, legacyValue: "", targetCode: "", note: "" };

/** Download buttons of a kit or of one object: the blank template, or the current data of this environment. */
const DownloadButton = ({ kit, objects = [], label, compact = false }) => {
  const { t } = useTranslation();
  const download = useDownload();
  const blank = () => download(() => goLiveService.template(kit, { objects }));
  const current = () => download(() => goLiveService.template(kit, { prefill: true, objects }));
  if (compact) {
    return (
      <RowActions>
        <Button type="button" icon="pi pi-file" text rounded aria-label={t("goLive.templates.blank")} tooltip={t("goLive.templates.blank")} tooltipOptions={{ position: "top" }} onClick={blank} />
        <Button type="button" icon="pi pi-database" text rounded aria-label={t("goLive.templates.currentData")} tooltip={t("goLive.templates.currentData")}
          tooltipOptions={{ position: "top" }} onClick={current} />
      </RowActions>
    );
  }
  return <SplitButton label={label} icon="pi pi-download" outlined onClick={blank} model={[{ label: t("goLive.templates.currentData"), icon: "pi pi-database", command: current }]} />;
};

/** Value map form (add and change): object, legacy value, BrokerVerse code, note. */
const ValueMapDialog = ({ value, objects, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(value);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const missing = { object: !form.object, legacyValue: !String(form.legacyValue || "").trim(), targetCode: !String(form.targetCode || "").trim() };
  const save = async () => {
    setTried(true);
    if (Object.values(missing).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      const body = { object: form.object, legacyValue: form.legacyValue.trim(), targetCode: form.targetCode.trim(), note: form.note?.trim() || null };
      await (form.id ? goLiveService.updateValueMap(form.id, body) : goLiveService.saveValueMap(body));
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const footer = (
    <>
      <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
      <Button type="button" label={t("goLive.templates.saveMap")} icon="pi pi-check" onClick={save} loading={busy} />
    </>
  );
  const err = (k, msg) => (tried && missing[k] ? msg : null);
  return (
    <DetailDialog visible onHide={onHide} header={form.id ? t("goLive.templates.editMap") : t("goLive.templates.addMap")} size="md" footer={footer}>
      <div className="go-live__form">
        <label htmlFor="map-object" className="bv-field-label">{t("goLive.templates.object")}<span className="required-marker">*</span></label>
        <Dropdown inputId="map-object" value={form.object} options={objects} optionLabel="label" optionValue="key" onChange={(e) => set("object", e.value)} disabled={!!form.id}
          className={`w-full${err("object", 1) ? " p-invalid" : ""}`} placeholder={t("goLive.common.choose")} />
        <FieldError error={err("object", t("goLive.templates.objectRequired"))} />
        <label htmlFor="map-legacy" className="bv-field-label">{t("goLive.templates.legacyValue")}<span className="required-marker">*</span></label>
        <InputText id="map-legacy" value={form.legacyValue} onChange={(e) => set("legacyValue", e.target.value)} maxLength={200}
          className={`w-full${err("legacyValue", 1) ? " p-invalid" : ""}`} />
        <FieldError error={err("legacyValue", t("goLive.templates.legacyRequired"))} />
        <label htmlFor="map-target" className="bv-field-label">{t("goLive.templates.targetCode")}<span className="required-marker">*</span></label>
        <InputText id="map-target" value={form.targetCode} onChange={(e) => set("targetCode", e.target.value)} maxLength={100}
          className={`w-full${err("targetCode", 1) ? " p-invalid" : ""}`} />
        <FieldError error={err("targetCode", t("goLive.templates.targetRequired"))} />
        <label htmlFor="map-note" className="bv-field-label">{t("goLive.templates.note")}</label>
        <InputTextarea id="map-note" value={form.note || ""} onChange={(e) => set("note", e.target.value)} rows={2} autoResize maxLength={500} className="w-full" />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Templates: the two kits in load order, the policy templates per product, the value maps and the document naming convention. */
const Templates = () => {
  const { t } = useTranslation();
  const { notify } = useWorkspace();
  const { canWrite } = useAccess();
  const download = useDownload();
  const kitsLoader = useCallback(() => goLiveService.kits(), []);
  const { data: catalogue, loading } = useStableLoad(kitsLoader);
  const [filter, setFilter] = useState({ object: null, search: "" });
  const mapsLoader = useCallback(() => goLiveService.valueMaps({ object: filter.object, search: filter.search.trim(), perPage: 200 }), [filter]);
  const maps = useStableLoad(mapsLoader, { debounceMs: 300, initialData: { rows: [], total: 0, extra: {} } });
  const [editing, setEditing] = useState(null);
  const [uploadMaps, setUploadMaps] = useState(false);
  const [checkNames, setCheckNames] = useState(false);
  const [names, setNames] = useState(null);

  const objects = maps.data?.extra?.objects || [];
  const kits = useMemo(() => catalogue?.kits || [], [catalogue]);
  const policySheets = useMemo(() => (kits.find((k) => k.kit === "migration")?.sheets || []).filter((s) => s.policyKind), [kits]);
  const naming = catalogue?.naming;
  const mapTargets = useMemo(() => [{ label: t("goLive.templates.valueMaps"), templatePath: goLiveService.paths.valueMapsTemplate, uploadPath: goLiveService.paths.valueMapsUpload }], [t]);
  const nameTargets = useMemo(() => [{ label: t("goLive.templates.naming"), uploadPath: goLiveService.paths.namesCheck }], [t]);

  const remove = (m) => openConfirm({
    title: t("goLive.templates.removeMapTitle"), severity: "danger", message: t("goLive.templates.removeMapMessage"),
    facts: [{ label: t("goLive.templates.object"), value: m.objectLabel }, { label: t("goLive.templates.legacyValue"), value: m.legacyValue },
      { label: t("goLive.templates.targetCode"), value: m.targetCode }],
    confirmLabel: t("goLive.templates.removeMap"),
    onConfirm: async () => {
      await goLiveService.deleteValueMap(m.id);
      notify("success", t("goLive.templates.mapRemoved"));
      maps.reload();
    },
  });

  return (
    <div className="go-live__stack">
      {kits.map((kit) => (
        <SectionCard key={kit.kit} title={t(`goLive.kit.${kit.kit}`)} className="bv-loading-host"
          actions={<DownloadButton kit={kit.kit} label={t("goLive.templates.downloadKit")} />}>
          <DataTable value={kit.sheets.filter((s) => !s.legacyLayout && !s.policyKind)} dataKey="key" size="small" loading={loading}>
            <Column header={t("goLive.templates.order")} body={(_s, o) => o.rowIndex + 1} {...num} style={{ width: "4rem" }} />
            <Column field="name" header={t("goLive.templates.object")} />
            <Column header={t("goLive.templates.keys")} body={(s) => s.keyColumns.map((k) => s.columns.find((c) => c.key === k)?.header || k).join(", ")} />
            <Column header={t("goLive.templates.dependsOn")} body={(s) => (s.dependsOn.length ? s.dependsOn.map((d) => kit.sheets.find((x) => x.key === d)?.name || d).join(", ") : "—")} />
            <Column header={t("goLive.templates.columns")} body={(s) => count(s.columns.length)} {...num} />
            <Column body={(s) => <DownloadButton kit={kit.kit} objects={[s.key]} compact />} {...actionsColumn} />
          </DataTable>
        </SectionCard>
      ))}

      <SectionCard title={t("goLive.templates.productTemplates")}>
        <DataTable value={policySheets} dataKey="key" size="small" loading={loading} emptyMessage={t("goLive.templates.noProducts")}>
          <Column field="name" header={t("goLive.templates.sheet")} />
          <Column header={t("goLive.templates.products")} body={(s) => (s.products || []).join(", ") || "—"} />
          <Column body={(s) => <DownloadButton kit="migration" objects={[s.key]} compact />} {...actionsColumn} />
        </DataTable>
      </SectionCard>

      <SectionCard title={t("goLive.templates.valueMaps")} className="bv-loading-host"
        actions={(
          <PageActions onUpload={canWrite ? () => setUploadMaps(true) : null} onAdd={canWrite ? () => setEditing(EMPTY_MAP) : null} addLabel={t("goLive.templates.addMap")}>
            <Button type="button" icon="pi pi-download" label={t("goLive.common.download")} outlined onClick={() => download(() => goLiveService.valueMapsWorkbook())} />
          </PageActions>
        )}>
        <LoadingBar active={maps.refreshing} />
        <FilterBar active={!!(filter.object || filter.search)} onClear={() => setFilter({ object: null, search: "" })}>
          <Dropdown value={filter.object} options={objects} optionLabel="label" optionValue="key" showClear placeholder={t("goLive.templates.allObjects")}
            onChange={(e) => setFilter((f) => ({ ...f, object: e.value || null }))} aria-label={t("goLive.templates.object")} />
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} placeholder={t("goLive.common.search")}
              aria-label={t("goLive.common.search")} />
          </span>
        </FilterBar>
        <DataTable value={maps.data?.rows || []} dataKey="id" size="small" loading={maps.loading} paginator rows={20} emptyMessage={t("goLive.templates.noMaps")}>
          <Column field="objectLabel" header={t("goLive.templates.object")} />
          <Column field="legacyValue" header={t("goLive.templates.legacyValue")} />
          <Column field="targetCode" header={t("goLive.templates.targetCode")} />
          <Column field="note" header={t("goLive.templates.note")} body={(m) => m.note || "—"} />
          <Column header={t("goLive.templates.updatedBy")} body={(m) => `${m.updatedBy || m.createdBy || "—"} · ${dateTimeOf(m.updatedAt || m.createdAt)}`} />
          {canWrite ? (
            <Column body={(m) => (
              <RowActions onEdit={() => setEditing({ ...m })} editLabel={t("goLive.templates.editMap")}>
                <Button type="button" icon="pi pi-trash" text rounded severity="danger" aria-label={t("goLive.templates.removeMap")} tooltip={t("goLive.templates.removeMap")}
                  tooltipOptions={{ position: "top" }} onClick={() => remove(m)} />
              </RowActions>
            )} {...actionsColumn} />
          ) : null}
        </DataTable>
      </SectionCard>

      <SectionCard title={t("goLive.templates.naming")}
        actions={<Button type="button" icon="pi pi-check-square" label={t("goLive.templates.checkNames")} outlined onClick={() => { setNames(null); setCheckNames(true); }} />}>
        {naming ? (
          <KeyValueGrid columns={2} items={[
            { label: t("goLive.templates.pattern"), value: naming.pattern, span: "full" },
            { label: t("goLive.templates.example"), value: naming.example, span: "full" },
            { label: t("goLive.templates.recordTypes"), value: naming.recordTypes.map((r) => `${r.code} ${r.label}`).join(", ") },
            { label: t("goLive.templates.extensions"), value: naming.extensions.join(", ") },
            { label: t("goLive.templates.documentTypes"), value: naming.documentTypes.join(", "), span: "full" },
          ]} />
        ) : null}
        {names ? (
          <div className="go-live__result">
            <div className="go-live__result-head">
              <span>{t("goLive.templates.namesChecked", { names: names.summary.names, invalid: names.summary.invalid, missing: names.summary.recordMissing })}</span>
              <Button type="button" icon="pi pi-download" label={t("goLive.templates.downloadResult")} outlined size="small"
                onClick={() => download(() => goLiveService.namesWorkbook(names.token))} />
            </div>
            <DataTable value={names.results} dataKey="name" size="small" paginator rows={20}>
              <Column field="name" header={t("goLive.templates.fileName")} />
              <Column header={t("goLive.templates.valid")} body={(r) => <StatusChip label={r.valid ? t("goLive.templates.valid") : t("goLive.templates.invalid")} severity={r.valid ? "success" : "danger"} />} />
              <Column header={t("goLive.templates.record")} body={(r) => (r.recordNumber ? `${r.recordTypeLabel} ${r.recordNumber}` : "—")} />
              <Column header={t("goLive.templates.inBrokerVerse")} body={(r) => (r.valid ? (r.recordFound ? t("goLive.common.yes") : t("goLive.common.no")) : "—")} />
              <Column field="reason" header={t("goLive.templates.reason")} body={(r) => r.reason || "—"} />
            </DataTable>
          </div>
        ) : null}
      </SectionCard>

      {editing ? (
        <ValueMapDialog value={editing} objects={objects} onHide={() => setEditing(null)}
          onSaved={() => { setEditing(null); notify("success", t("goLive.templates.mapSaved")); maps.reload(); }} />
      ) : null}
      <ImportDialog visible={uploadMaps} onHide={() => setUploadMaps(false)} title={t("goLive.templates.uploadMaps")} targets={mapTargets} accept=".xlsx"
        onUploaded={() => maps.reload()} />
      <ImportDialog visible={checkNames} onHide={() => setCheckNames(false)} title={t("goLive.templates.checkNames")} targets={nameTargets} accept=".xlsx,.csv,.txt"
        fileTypes={t("goLive.templates.namesFileTypes")} loadLabel={t("goLive.templates.check")}
        onUploaded={(r) => { setNames(r); setCheckNames(false); }} />
    </div>
  );
};

export default Templates;
