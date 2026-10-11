import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Toast } from "primereact/toast";
import PageHeader from "../../../components/PageHeader";
import LoadingBar from "../../../components/LoadingBar";
import DetailDialog from "../../../components/DetailDialog";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import ImportDialog from "../../../components/ImportDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import promotionService from "../../../services/promotionService";
import importService from "../../../services/importService";
import { hasPermission } from "../../../utils/canOpen";
import { formatInstant } from "../../../utility/dateFormat";
import "../index.scss";
import "./index.scss";

const BATCH_SEVERITY = { loaded: "success", validated: "info", failed: "danger" };

/**
 * Master > Environment Promotion > Setup Workbook: the configuration of this environment as a workbook (download with
 * the current data to carry it to the next environment), the upload of the workbook of another environment
 * (validated in a rolled-back transaction, then loaded), and the batches with their result per sheet.
 */
const SetupWorkbook = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`environmentPromotion.${key}`, opts);
  const toast = useRef(null);
  const [upload, setUpload] = useState(false);
  const [open, setOpen] = useState(null);
  const canLoad = hasPermission("write:data-load");
  const loader = useCallback(async () => {
    const [kits, batches] = await Promise.all([promotionService.getKits(), promotionService.listBatches(1, 50)]);
    return { kits, batches: batches.data || [] };
  }, []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const kit = useMemo(() => (data?.kits?.kits || []).find((x) => x.kit === "configuration"), [data]);
  const sheets = kit?.sheets || [];
  const targets = useMemo(() => [{ label: k("workbook"), templatePath: promotionService.templatePath(true), uploadPath: promotionService.validatePath, validatePath: promotionService.validatePath }], []); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async (prefill) => {
    try {
      await importService.downloadTemplate(promotionService.templatePath(prefill), kit?.file || "Setup_Workbook.xlsx");
    } catch (e) {
      toast.current?.show({ severity: "error", summary: k("workbookTitle"), detail: e.message });
    }
  };
  const previewFacts = (p) => [
    { label: k("columns.rows"), value: p.batch?.rowsRead, type: "number" },
    { label: k("columns.valid"), value: p.batch?.rowsValid, type: "number" },
    { label: k("columns.errors"), value: p.batch?.rowsError, type: "number" },
    { label: k("columns.sheets"), value: (p.batch?.sheets || []).length, type: "number" },
  ];
  const confirmLoad = (p) => ({
    title: k("loadTitle"), confirmLabel: k("loadConfirm"), severity: "warning", message: k("loadMessage"),
    facts: [{ label: k("columns.file"), value: p.batch?.fileName }, { label: k("columns.rows"), value: p.batch?.rowsRead }],
  });
  const commit = async (p) => {
    const r = await promotionService.loadBatch(p.batch.id);
    return { message: r.message, ...(r.data || {}) };
  };
  const openBatch = async (row) => {
    try {
      setOpen(await promotionService.getBatch(row.id));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: k("workbookTitle"), detail: e.message });
    }
  };
  const chip = (s) => <StatusChip label={t(`environmentPromotion.batchStatus.${s}`, { defaultValue: s })} severity={BATCH_SEVERITY[s] || "secondary"} />;

  return (
    <div className="admin__page ep-page">
      <Toast ref={toast} />
      <PageHeader title={k("workbookTitle")} home={t("sidebar.Master")} section={t("sidebar.Environment Promotion")} trail={[k("workbookTitle")]} help={k("workbookHelp")}
        actions={(
          <>
            <Button type="button" icon="pi pi-download" label={k("downloadCurrent")} outlined onClick={() => download(true)} disabled={!kit} />
            <Button type="button" icon="pi pi-file" label={k("downloadBlank")} outlined onClick={() => download(false)} disabled={!kit} />
            {canLoad ? <Button type="button" icon="pi pi-upload" label={k("upload")} onClick={() => setUpload(true)} /> : null}
            <Button type="button" icon="pi pi-refresh" label={t("numberingMasters.refresh")} outlined loading={refreshing} onClick={() => reload()} />
          </>
        )} />
      <div className="bv-loading-host">
        <LoadingBar active={loading || refreshing} />
        {error ? <p className="ep-error">{String(error)}</p> : null}
        <DetailSection title={k("sections.sheets")}>
          <DataTable value={sheets} dataKey="key" size="small" stripedRows scrollable scrollHeight="20rem" emptyMessage={k("noSheets")} className="fr-table" data-testid="workbook-sheets">
            <Column header="#" body={(_r, o) => o.rowIndex + 1} style={{ width: "4rem" }} />
            <Column header={k("columns.sheet")} field="name" />
            <Column header={k("columns.screen")} field="menu" />
            <Column header={k("columns.key")} body={(r) => (r.keyColumns || []).join(", ")} />
            <Column header={k("columns.columns")} body={(r) => (r.columns || []).length} style={{ width: "7rem" }} />
          </DataTable>
        </DetailSection>
        <DetailSection title={k("sections.batches")}>
          <DataTable value={data?.batches || []} dataKey="id" size="small" stripedRows emptyMessage={k("noBatches")} className="fr-table" data-testid="workbook-batches">
            <Column header={k("columns.file")} body={(r) => <Button type="button" link label={r.fileName || String(r.id)} className="fr-link" onClick={() => openBatch(r)} />} />
            <Column header={k("columns.status")} body={(r) => chip(r.status)} />
            <Column header={k("columns.rows")} field="rowsRead" />
            <Column header={k("columns.errors")} field="rowsError" />
            <Column header={k("columns.by")} field="createdBy" />
            <Column header={k("columns.when")} body={(r) => formatInstant(r.loadedAt || r.validatedAt || r.createdAt)} />
          </DataTable>
        </DetailSection>
      </div>

      <ImportDialog visible={upload} onHide={() => setUpload(false)} title={k("upload")} targets={targets} fields={{ kit: "configuration" }} help={k("uploadHelp")}
        previewFacts={previewFacts} confirmLoad={confirmLoad} onCommit={commit} loadLabel={k("load")}
        onDone={(r) => { toast.current?.show({ severity: "success", summary: k("workbookTitle"), detail: r.message }); reload(); }} />

      <DetailDialog visible={!!open} onHide={() => setOpen(null)} header={open?.batch?.fileName || k("batch")} size="lg">
        {open ? (
          <>
            <DetailSection title={k("batch")}>
              <KeyValueGrid columns={3} items={[
                { label: k("columns.status"), value: chip(open.batch.status) },
                { label: k("columns.rows"), value: open.batch.rowsRead },
                { label: k("columns.errors"), value: open.batch.rowsError },
                { label: k("columns.by"), value: open.batch.createdBy },
                { label: k("columns.when"), value: formatInstant(open.batch.loadedAt || open.batch.createdAt) },
              ]} />
            </DetailSection>
            <DetailSection title={k("sections.sheets")} actions={open.totalErrors ? <Button type="button" icon="pi pi-download" label={k("downloadErrors")} outlined size="small" onClick={() => importService.downloadTemplate(promotionService.errorsPath(open.batch.id), "Setup_Workbook_Errors.xlsx").catch((e) => toast.current?.show({ severity: "error", summary: k("workbookTitle"), detail: e.message }))} /> : null}>
              <DataTable value={open.batch.sheets || []} dataKey="sheet" size="small" stripedRows emptyMessage={k("noSheets")}>
                <Column header={k("columns.sheet")} field="name" />
                <Column header={k("columns.rows")} field="read" />
                <Column header={k("columns.errors")} field="errors" />
                <Column header={k("columns.created")} field="created" />
                <Column header={k("columns.updated")} field="updated" />
              </DataTable>
            </DetailSection>
            {open.errors?.length ? (
              <DetailSection title={k("columns.errors")}>
                <DataTable value={open.errors} size="small" stripedRows scrollable scrollHeight="16rem">
                  <Column header={k("columns.sheet")} field="sheetName" />
                  <Column header={t("importDialog.row")} field="row" style={{ width: "5rem" }} />
                  <Column header={t("importDialog.column")} field="column" />
                  <Column header={t("importDialog.message")} field="message" />
                </DataTable>
              </DetailSection>
            ) : null}
          </>
        ) : null}
      </DetailDialog>
    </div>
  );
};

export default SetupWorkbook;
