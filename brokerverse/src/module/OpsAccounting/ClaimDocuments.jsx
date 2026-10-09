import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { ProgressBar } from "primereact/progressbar";
import { Toast } from "primereact/toast";
import service from "../../services/opsAccountingService";
import StatCards from "../../components/StatCards";
import { EmptyState, FilterBar, PageHeader, RowActions, SectionCard, StatusChip } from "../../components/RecordPage";
import { formatDate } from "../../utility/dateFormat";
import { hasPermission } from "../../utils/canOpen";
import "../../agentModule/claimsModule/shared/claimJourney.scss";

const STAGES = ["missing", "ready", "all"];

/**
 * Operations > Claims Awaiting Documents: the work queue of open claims whose file has not gone to the insurer yet,
 * with how many required documents are in and what is missing. A row opens the claim's Documents step, where the
 * documents are received, waived or reminded and the claim file is submitted to the insurer.
 */
const ClaimDocuments = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [stage, setStage] = useState("missing");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const mayWrite = hasPermission("write:claims");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await service.claimsAwaitingDocuments({ stage, search: search.trim() || undefined }));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("claimDocs.queue.title"), detail: e.message, life: 6000 });
    } finally {
      setLoading(false);
    }
  }, [stage, search, t]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const open = (r) => navigate(`/agent/claimrequest/documents/${r.claimId}`, { state: { claimId: r.claimId } });
  const remind = async (r) => {
    try {
      const out = await service.remindClaimant(r.claimId);
      toast.current?.show({ severity: "success", summary: r.claimNumber, detail: t("claimDocs.reminded", { to: out.to }), life: 3000 });
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: r.claimNumber, detail: e.message, life: 6000 });
    }
  };
  const s = data?.summary;
  const rows = data?.rows || [];
  const progress = (r) => (
    <span className="claim-docs__cell-progress">
      <span>{t("claimDocs.queue.ofRequired", { received: r.received, required: r.required })}</span>
      <ProgressBar value={r.required ? Math.round((r.received / r.required) * 100) : 100} showValue={false} className="claim-docs__bar" />
    </span>
  );

  return (
    <div className="bv-ops-page claim-docs-queue">
      <Toast ref={toast} />
      <PageHeader title={t("claimDocs.queue.title")} crumbs={[{ label: t("sidebar.Operations", "Operations") }, { label: t("claimDocs.queue.title") }]} />
      <StatCards items={[
        { key: "missing", label: t("claimDocs.queue.kpi.missing"), value: s ? s.missing : null, onClick: () => setStage("missing"), active: stage === "missing" },
        { key: "ready", label: t("claimDocs.queue.kpi.ready"), value: s ? s.ready : null, onClick: () => setStage("ready"), active: stage === "ready" },
        { key: "documents", label: t("claimDocs.queue.kpi.documents"), value: s ? s.documentsMissing : null },
        { key: "notReminded", label: t("claimDocs.queue.kpi.notReminded"), value: s ? s.notReminded : null },
      ]} />
      <SectionCard title={t(`claimDocs.queue.stage.${stage}`)} flush>
        <FilterBar active={stage !== "missing" || !!search} onClear={() => { setStage("missing"); setSearch(""); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("claimDocs.queue.search")} aria-label={t("claimDocs.queue.search")} />
          </span>
          <Dropdown value={stage} options={STAGES.map((k) => ({ label: t(`claimDocs.queue.stage.${k}`), value: k }))} onChange={(e) => setStage(e.value)}
            aria-label={t("claimDocs.col.status")} />
        </FilterBar>
        <DataTable value={rows} dataKey="claimId" loading={loading} size="small" paginator={rows.length > 20} rows={20}
          emptyMessage={<EmptyState icon="pi-folder-open" title={t("claimDocs.queue.emptyTitle")} text={t("claimDocs.queue.emptyText")} />}>
          <Column header={t("claimDocs.queue.col.claim")} body={(r) => (
            <span className="bv-cell-stack">
              <button type="button" className="bv-link-button bv-nowrap" onClick={() => open(r)}>{r.claimNumber}</button>
              <small>{r.claimant}</small>
            </span>
          )} />
          <Column field="policyNumber" header={t("claimDocs.queue.col.policy")} className="bv-nowrap" />
          <Column header={t("claimDocs.queue.col.cause")} body={(r) => (
            <span className="bv-cell-stack"><span>{t(`claimFlow.lob.${r.lob}`, r.lob || "—")}</span><small>{r.lossCause || "—"}</small></span>
          )} />
          <Column header={t("claimDocs.queue.col.reported")} body={(r) => (
            <span className="bv-cell-stack"><span className="bv-nowrap">{formatDate(r.reportedDate)}</span><small>{r.daysOpen ? t("claimDocs.queue.daysOpen", { count: r.daysOpen }) : t("claimDocs.queue.today")}</small></span>
          )} />
          <Column header={t("claimDocs.queue.col.documents")} body={progress} style={{ minWidth: "11rem" }} />
          <Column header={t("claimDocs.queue.col.missing")} body={(r) => (r.missing ? <StatusChip label={String(r.missing)} severity="warning" />
            : <StatusChip label={t("claimDocs.queue.readyChip")} severity="success" />)} className="bv-nowrap" />
          <Column header={t("claimDocs.queue.col.lastReminder")} body={(r) => (r.lastReminderAt ? formatDate(r.lastReminderAt) : t("claimDocs.queue.never"))} className="bv-nowrap" />
          <Column header={t("claimFlow.actions")} className="bv-actions" headerClassName="bv-actions" body={(r) => (
            <RowActions actions={[{ icon: "pi pi-folder-open", label: t("claimDocs.queue.open"), onClick: () => open(r) }]}
              menu={[{ label: t("claimDocs.remind"), icon: "pi pi-envelope", hidden: !mayWrite || !r.missing, command: () => remind(r) }]} />
          )} />
        </DataTable>
      </SectionCard>
    </div>
  );
};

export default ClaimDocuments;
