import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import ImportDialog from "../../components/ImportDialog";
import PageActions from "../../components/PageActions";
import LoadingBar from "../../components/LoadingBar";
import DateField from "../../components/DateField";
import { FilterBar, SectionCard } from "../../components/RecordPage";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { Chip, ROOT, count, dateTimeOf, num, useAccess, useMigrationOpen } from "./shared";

const KITS = ["migration", "configuration"];
const STATUSES = ["validating", "validated", "failed", "pending-approval", "rejected", "withdrawn", "expired", "running", "loaded", "undo-pending", "undoing", "undone"];
const PAGE = 20;
const NO_FILTER = { kit: null, runId: null, status: null, from: "", to: "" };

/** When and by whom: the date and time on one line, the user below (muted). */
export const Stamp = ({ at, by }) => (at ? (
  <span className="go-live__stamp"><span className="go-live__nowrap">{dateTimeOf(at)}</span>{by ? <span className="go-live__muted">{by}</span> : null}</span>
) : "—");

/** Open runs (planned or running) as the choices of an upload. */
export const useOpenRuns = () => {
  const loader = useCallback(() => goLiveService.runs({ perPage: 100 }), []);
  const { data } = useStableLoad(loader, { initialData: { rows: [] } });
  return data?.rows || [];
};

/** Loads: the history of the uploaded workbooks with their results, and the upload that validates a workbook first. */
const Loads = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canWrite } = useAccess();
  const migration = useMigrationOpen();
  const runs = useOpenRuns();
  const [filter, setFilter] = useState(NO_FILTER);
  const [first, setFirst] = useState(0);
  const [upload, setUpload] = useState(false);
  const [runId, setRunId] = useState(undefined);
  const [legacySystem, setLegacySystem] = useState("");

  const loader = useCallback(() => goLiveService.batches({ ...filter, page: first / PAGE + 1, perPage: PAGE }), [filter, first]);
  const { data, loading, refreshing } = useStableLoad(loader, { initialData: { rows: [], total: 0 } });
  const change = (patch) => {
    setFirst(0);
    setFilter((f) => ({ ...f, ...patch }));
  };

  const runOptions = runs.map((r) => ({ label: `${r.runNumber} · ${r.title}`, value: r.id }));
  const openRuns = runs.filter((r) => ["planned", "running"].includes(r.status)).map((r) => ({ label: `${r.runNumber} · ${r.title}`, value: r.id }));
  // the upload names the run in progress unless the user chooses another (or none)
  const running = runs.find((r) => r.status === "running" && r.kind === "production") || runs.find((r) => r.status === "running") || null;
  const chosenRun = runId === undefined ? running?.id ?? null : runId;
  const targets = useMemo(() => KITS.map((kit) => ({
    label: t(`goLive.kit.${kit}`), templatePath: goLiveService.paths.kitTemplate(kit), uploadPath: `${goLiveService.paths.batches}?kit=${kit}`,
  })), [t]);
  const fields = { runId: chosenRun || undefined, legacySystem: legacySystem.trim() || undefined };
  const steps = [
    { id: "load-run", label: t("goLive.loads.run"), control: (
      <Dropdown inputId="load-run" value={chosenRun} options={openRuns} onChange={(e) => setRunId(e.value)} showClear placeholder={t("goLive.loads.noRun")} className="w-full" />
    ) },
    { id: "load-legacy", label: t("goLive.loads.legacySystem"), control: (
      <InputText id="load-legacy" value={legacySystem} onChange={(e) => setLegacySystem(e.target.value)} maxLength={100} placeholder={t("goLive.loads.legacyDefault")} className="w-full" />
    ) },
  ];

  return (
    <SectionCard title={t("goLive.loads.title")} className="bv-loading-host"
      actions={canWrite ? <PageActions onUpload={() => setUpload(true)} uploadLabel={t("goLive.loads.upload")} disabledReason={migration.reason} /> : null}>
      <LoadingBar active={refreshing} />
      <FilterBar active={Object.values(filter).some(Boolean)} onClear={() => change(NO_FILTER)}>
        <Dropdown value={filter.kit} options={KITS.map((k) => ({ label: t(`goLive.kit.${k}`), value: k }))} onChange={(e) => change({ kit: e.value || null })} showClear
          placeholder={t("goLive.loads.allKits")} aria-label={t("goLive.loads.kit")} />
        <Dropdown value={filter.runId} options={runOptions} onChange={(e) => change({ runId: e.value || null })} showClear placeholder={t("goLive.loads.allRuns")}
          aria-label={t("goLive.loads.run")} />
        <Dropdown value={filter.status} options={STATUSES.map((s) => ({ label: t(`goLive.status.batch.${s}`), value: s }))} onChange={(e) => change({ status: e.value || null })}
          showClear placeholder={t("goLive.loads.allStatuses")} aria-label={t("goLive.loads.status")} />
        <span className="go-live__filter-date">
          <DateField id="loads-from" value={filter.from} onChange={(e) => change({ from: e.target.value })} placeholder={t("goLive.common.from")} />
        </span>
        <span className="go-live__filter-date">
          <DateField id="loads-to" value={filter.to} onChange={(e) => change({ to: e.target.value })} placeholder={t("goLive.common.to")} />
        </span>
      </FilterBar>
      <DataTable value={data?.rows || []} dataKey="id" size="small" lazy paginator rows={PAGE} first={first} totalRecords={data?.total || 0} onPage={(e) => setFirst(e.first)}
        loading={loading} emptyMessage={t("goLive.loads.none")} onRowClick={(e) => navigate(`${ROOT}/loads/${e.data.id}`)} rowClassName={() => "go-live__clickable"}
        scrollable tableClassName="go-live__table-compact">
        <Column header={t("goLive.loads.loadNo")} body={(b) => (
          <span className="go-live__stamp"><span className="go-live__nowrap">{b.loadNumber}</span><span className="go-live__muted">{t(`goLive.kit.${b.kit}`)}</span></span>
        )} frozen />
        <Column header={t("goLive.loads.run")} body={(b) => runs.find((r) => r.id === b.runId)?.runNumber || "—"} bodyClassName="go-live__nowrap" />
        <Column header={t("goLive.loads.file")} body={(b) => <span className="go-live__ellipsis" title={b.fileName}>{b.fileName}</span>} />
        <Column header={t("goLive.result.new")} body={(b) => count(b.rowsNew)} {...num} />
        <Column header={t("goLive.result.changed")} body={(b) => count(b.rowsChanged)} {...num} />
        <Column header={t("goLive.result.unchanged")} body={(b) => count(b.rowsUnchanged)} {...num} />
        <Column header={t("goLive.result.duplicate")} body={(b) => count(b.rowsDuplicate)} {...num} />
        <Column header={t("goLive.result.error")} body={(b) => count(b.rowsError)} {...num} />
        <Column header={t("goLive.loads.status")} body={(b) => <Chip kind="batch" code={b.status} />} bodyClassName="go-live__nowrap" />
        <Column header={t("goLive.loads.uploaded")} body={(b) => <Stamp at={b.createdAt} by={b.createdBy} />} />
        <Column header={t("goLive.loads.loadedAt")} body={(b) => (b.undoneAt ? <Stamp at={b.undoneAt} by={t("goLive.status.batch.undone")} />
          : <Stamp at={b.loadedAt} by={b.decision === "approved" ? t("goLive.loads.approvedBy", { name: b.decidedBy }) : null} />)} />
      </DataTable>
      <ImportDialog visible={upload} onHide={() => setUpload(false)} title={t("goLive.loads.upload")} targets={targets} steps={steps} fields={fields} accept=".xlsx"
        fileTypes={t("goLive.loads.fileTypes")} loadLabel={t("goLive.loads.uploadValidate")} help={t("goLive.loads.uploadHelp")}
        onUploaded={(r) => { setUpload(false); navigate(`${ROOT}/loads/${r.batch.id}`); }} />
    </SectionCard>
  );
};

export default Loads;
