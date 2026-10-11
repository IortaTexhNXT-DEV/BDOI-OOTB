import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import PageActions from "../../components/PageActions";
import LoadingBar from "../../components/LoadingBar";
import { FilterBar, SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { Chip, ROOT, count, dateOf, dateTimeOf, num, useAccess } from "./shared";
import { useOpenRuns } from "./Loads";

const STATUSES = ["open", "signed", "superseded"];
const PAGE = 20;

/** Reconciliations of the migration loads, newest first, and the creation of the reconciliation of a run. */
const Reconciliations = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canWrite } = useAccess();
  const runs = useOpenRuns();
  const [filter, setFilter] = useState({ runId: null, status: null });
  const [first, setFirst] = useState(0);
  const loader = useCallback(() => goLiveService.reconciliations({ ...filter, page: first / PAGE + 1, perPage: PAGE }), [filter, first]);
  const { data, loading, refreshing } = useStableLoad(loader, { initialData: { rows: [], total: 0 } });
  const runOptions = runs.map((r) => ({ label: `${r.runNumber} · ${r.title}`, value: r.id }));
  const change = (patch) => {
    setFirst(0);
    setFilter((f) => ({ ...f, ...patch }));
  };

  const create = async () => {
    let created = null;
    const ok = await openConfirm({
      title: t("goLive.recon.newTitle"), severity: "neutral", message: t("goLive.recon.newMessage"),
      input: { type: "select", label: t("goLive.loads.run"), required: true, options: runOptions.filter((o) => runs.find((r) => r.id === o.value)?.status !== "cancelled") },
      confirmLabel: t("goLive.recon.create"),
      onConfirm: async (runId) => {
        created = await goLiveService.createReconciliation({ runId });
      },
    });
    if (ok && created) navigate(`${ROOT}/reconciliation/${created.id}`);
  };

  return (
    <SectionCard title={t("goLive.recon.title")} className="bv-loading-host" actions={canWrite ? <PageActions onAdd={create} addLabel={t("goLive.recon.new")} /> : null}>
      <LoadingBar active={refreshing} />
      <FilterBar active={!!(filter.runId || filter.status)} onClear={() => change({ runId: null, status: null })}>
        <Dropdown value={filter.runId} options={runOptions} onChange={(e) => change({ runId: e.value || null })} showClear placeholder={t("goLive.loads.allRuns")}
          aria-label={t("goLive.loads.run")} />
        <Dropdown value={filter.status} options={STATUSES.map((s) => ({ label: t(`goLive.status.recon.${s}`), value: s }))} onChange={(e) => change({ status: e.value || null })}
          showClear placeholder={t("goLive.loads.allStatuses")} aria-label={t("goLive.loads.status")} />
      </FilterBar>
      <DataTable value={data?.rows || []} dataKey="id" size="small" lazy paginator rows={PAGE} first={first} totalRecords={data?.total || 0} onPage={(e) => setFirst(e.first)}
        loading={loading} emptyMessage={t("goLive.recon.none")} onRowClick={(e) => navigate(`${ROOT}/reconciliation/${e.data.id}`)} rowClassName={() => "go-live__clickable"}>
        <Column field="reconNumber" header={t("goLive.recon.recNo")} />
        <Column header={t("goLive.loads.run")} body={(r) => runs.find((x) => x.id === r.runId)?.runNumber || "—"} />
        <Column header={t("goLive.recon.loads")} body={(r) => (r.loads || []).join(", ") || "—"} />
        <Column header={t("goLive.header.cutover")} body={(r) => dateOf(r.cutoverDate)} />
        <Column header={t("goLive.loads.status")} body={(r) => <Chip kind="recon" code={r.status} />} />
        <Column header={t("goLive.recon.openDifferences")} body={(r) => count(r.openDifferences)} {...num} />
        <Column header={t("goLive.recon.signedBy")} body={(r) => (Array.isArray(r.signedBy) ? r.signedBy.join(", ") : r.signedBy) || "—"} />
        <Column header={t("goLive.recon.createdColumn")} body={(r) => `${r.createdBy || "—"} · ${dateTimeOf(r.createdAt)}`} />
      </DataTable>
    </SectionCard>
  );
};

export default Reconciliations;
