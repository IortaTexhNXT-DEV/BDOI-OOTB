import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Toast } from "primereact/toast";
import PageHeader from "../../../components/PageHeader";
import LoadingBar from "../../../components/LoadingBar";
import DetailDialog from "../../../components/DetailDialog";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import StatusChip from "../../../components/StatusChip";
import { fileSize } from "../../../components/ImportDialog";
import { useStableLoad } from "../../../hooks/useStableLoad";
import environmentPromotionService from "../../../services/environmentPromotionService";
import importService from "../../../services/importService";
import { formatInstant } from "../../../utility/dateFormat";
import "../index.scss";
import "./index.scss";

/**
 * Master > Environment Promotion > Compare Environments: the Setup Workbook exported from another environment compared
 * with this one (nothing is loaded): the verdict, the counts per sheet, the rows that differ, and the comparison
 * workbook to download.
 */
const CompareEnvironments = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`environmentPromotion.${key}`, opts);
  const toast = useRef(null);
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [includeNumbering, setIncludeNumbering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [rows, setRows] = useState([]);
  const loader = useCallback(() => environmentPromotionService.listComparisons(1, 50).then((r) => r.data || []), []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);

  const compare = async () => {
    setBusy(true);
    try {
      const r = await importService.upload(environmentPromotionService.comparePath, file, { kit: "configuration", includeNumbering: includeNumbering ? "true" : "false" });
      toast.current?.show({ severity: r.verdict === "mirrored" ? "success" : "warn", summary: k("compareTitle"), detail: r.message });
      setFile(null);
      if (input.current) input.current.value = "";
      reload();
      openComparison({ id: r.id });
    } catch (e) {
      toast.current?.show({ severity: "error", summary: k("compareTitle"), detail: e.message });
    } finally {
      setBusy(false);
    }
  };
  const openComparison = async (row) => {
    try {
      const [c, r] = await Promise.all([environmentPromotionService.getComparison(row.id), environmentPromotionService.comparisonRows(row.id, { perPage: 200 })]);
      setOpen(c);
      setRows(r.data || []);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: k("compareTitle"), detail: e.message });
    }
  };
  const verdictChip = (v) => <StatusChip label={t(`environmentPromotion.verdict.${v}`, { defaultValue: v })} severity={v === "mirrored" ? "success" : "warning"} />;
  const statusChip = (s) => <StatusChip label={t(`environmentPromotion.rowStatus.${s}`, { defaultValue: s })} severity={s === "identical" ? "success" : s === "different" ? "warning" : "info"} />;
  const diffText = (r) => (r.differences || []).map((d) => `${d.header || d.column}: ${d.file ?? ""} → ${d.here ?? ""}`).join("; ");

  return (
    <div className="admin__page ep-page">
      <Toast ref={toast} />
      <PageHeader title={k("compareTitle")} home={t("sidebar.Master")} section={t("sidebar.Environment Promotion")} trail={[k("compareTitle")]} help={k("compareHelp")}
        actions={<Button type="button" icon="pi pi-refresh" label={t("numberingMasters.refresh")} outlined loading={refreshing} onClick={() => reload()} />} />
      <div className="bv-loading-host">
        <LoadingBar active={loading || refreshing || busy} />
        {error ? <p className="ep-error">{String(error)}</p> : null}
        <DetailSection title={k("sections.compare")}>
          <div className="ep-upload">
            <input ref={input} type="file" accept=".xlsx" aria-label={k("chooseWorkbook")} onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="compare-file" />
            {file ? <span>{file.name} · {fileSize(file.size)}</span> : null}
            <label className="ep-check">
              <Checkbox inputId="ep-numbering" checked={includeNumbering} onChange={(e) => setIncludeNumbering(!!e.checked)} />
              <span>{k("includeNumbering")}</span>
            </label>
            <Button type="button" icon="pi pi-search" label={k("compare")} onClick={compare} disabled={!file || busy} loading={busy} />
          </div>
        </DetailSection>
        <DetailSection title={k("sections.comparisons")}>
          <DataTable value={data || []} dataKey="id" size="small" stripedRows emptyMessage={k("noComparisons")} className="fr-table" data-testid="comparisons">
            <Column header={k("columns.file")} body={(r) => <Button type="button" link label={r.fileName || String(r.id)} className="fr-link" onClick={() => openComparison(r)} />} />
            <Column header={k("columns.verdict")} body={(r) => verdictChip(r.verdict)} />
            <Column header={k("columns.identical")} body={(r) => r.totals?.identical ?? "-"} />
            <Column header={k("columns.different")} body={(r) => r.totals?.different ?? "-"} />
            <Column header={k("columns.onlyInFile")} body={(r) => r.totals?.onlyInFile ?? "-"} />
            <Column header={k("columns.onlyHere")} body={(r) => r.totals?.onlyHere ?? "-"} />
            <Column header={k("columns.by")} field="createdBy" />
            <Column header={k("columns.when")} body={(r) => formatInstant(r.createdAt)} />
          </DataTable>
        </DetailSection>
      </div>

      <DetailDialog visible={!!open} onHide={() => setOpen(null)} header={open?.fileName || k("comparison")} size="lg">
        {open ? (
          <>
            <DetailSection title={k("comparison")} actions={<Button type="button" icon="pi pi-download" label={k("downloadComparison")} outlined size="small" onClick={() => importService.downloadTemplate(environmentPromotionService.comparisonWorkbookPath(open.id), "Environment_Comparison.xlsx").catch((e) => toast.current?.show({ severity: "error", summary: k("compareTitle"), detail: e.message }))} />}>
              <KeyValueGrid columns={3} items={[
                { label: k("columns.verdict"), value: verdictChip(open.verdict) },
                { label: k("columns.identical"), value: open.totals?.identical },
                { label: k("columns.different"), value: open.totals?.different },
                { label: k("columns.onlyInFile"), value: open.totals?.onlyInFile },
                { label: k("columns.onlyHere"), value: open.totals?.onlyHere },
                { label: k("columns.environmentSpecific"), value: open.totals?.environmentSpecific },
              ]} />
            </DetailSection>
            <DetailSection title={k("sections.sheets")}>
              <DataTable value={open.sheets || []} dataKey="sheet" size="small" stripedRows scrollable scrollHeight="14rem">
                <Column header={k("columns.sheet")} field="name" />
                <Column header={k("columns.inFile")} field="inFile" />
                <Column header={k("columns.here")} field="here" />
                <Column header={k("columns.identical")} field="identical" />
                <Column header={k("columns.different")} field="different" />
                <Column header={k("columns.onlyInFile")} field="onlyInFile" />
                <Column header={k("columns.onlyHere")} field="onlyHere" />
              </DataTable>
            </DetailSection>
            <DetailSection title={k("sections.differences")}>
              <DataTable value={rows} dataKey="key" size="small" stripedRows scrollable scrollHeight="18rem" emptyMessage={k("noDifferences")}>
                <Column header={k("columns.sheet")} field="sheetName" />
                <Column header={k("columns.key")} field="key" />
                <Column header={k("columns.status")} body={(r) => statusChip(r.status)} />
                <Column header={k("columns.change")} body={diffText} />
              </DataTable>
            </DetailSection>
          </>
        ) : null}
      </DetailDialog>
    </div>
  );
};

export default CompareEnvironments;
