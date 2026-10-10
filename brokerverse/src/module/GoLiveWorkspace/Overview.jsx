import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Button } from "primereact/button";
import StatCards from "../../components/StatCards";
import LoadingBar from "../../components/LoadingBar";
import { SectionCard } from "../../components/RecordPage";
import { Chip, ROOT, count, dateTimeOf, useWorkspace } from "./shared";

const PHASE_SEVERITY = { done: "good", "in-progress": "warning" };

/** Where the programme stands: phases, figures of the loads and of the current run, latest loads, what waits for the user. */
const Overview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { overview: o } = useWorkspace();
  const run = o?.run;
  const loads = o?.loads;
  const forMe = o?.forMe || { approvals: [], votes: [], steps: [] };

  const kpis = [
    { key: "loaded", label: t("goLive.overview.loadsLoaded"), value: loads?.loaded, note: t("goLive.overview.pendingFailed", { pending: loads?.pendingApproval ?? 0, failed: loads?.failed ?? 0 }),
      onClick: () => navigate(`${ROOT}/loads`) },
    { key: "rows", label: t("goLive.overview.rowsLoaded"), value: loads ? (loads.rows.new || 0) + (loads.rows.changed || 0) : undefined,
      note: loads ? t("goLive.overview.rowsNote", { new: count(loads.rows.new), changed: count(loads.rows.changed) }) : null },
    { key: "recon", label: t("goLive.overview.reconciliation"), value: run?.reconciliation ? t(`goLive.status.recon.${run.reconciliation.status}`) : "—",
      note: run?.reconciliation ? t("goLive.overview.openDifferences", { count: run.reconciliation.openDifferences }) : null,
      onClick: run?.reconciliation ? () => navigate(`${ROOT}/reconciliation/${run.reconciliation.id}`) : undefined },
    { key: "defects", label: t("goLive.overview.defects"), value: o ? o.defects.severity1 + o.defects.severity2 : undefined,
      note: o ? t("goLive.overview.defectsNote", { s1: o.defects.severity1, s2: o.defects.severity2 }) : null,
      status: o && o.defects.severity1 ? { severity: "critical", label: t("goLive.overview.critical") } : undefined },
    { key: "checklist", label: t("goLive.overview.checklist"), value: run ? `${run.checklist.percent}%` : "—",
      note: run ? t("goLive.overview.checklistNote", { done: run.checklist.done, total: run.checklist.total }) : null, onClick: run ? () => navigate(`${ROOT}/cutover`) : undefined },
    { key: "decision", label: t("goLive.overview.decision"), value: run?.decision ? t(`goLive.status.decision.${run.decision.status}`) : "—", onClick: () => navigate(`${ROOT}/decision`) },
  ];

  const waiting = [
    ...forMe.approvals.map((a) => ({ key: `${a.type}-${a.id}`, what: t(`goLive.overview.waiting.${a.type}`), reference: a.reference,
      to: a.type === "lock" || a.type === "unlock" ? `${ROOT}/decision` : `${ROOT}/loads/${a.id}` })),
    ...forMe.votes.map((v) => ({ key: `vote-${v.id}`, what: t("goLive.overview.waiting.vote"), reference: v.reference, to: `${ROOT}/decision` })),
    ...forMe.steps.map((s) => ({ key: `step-${s.id}`, what: t("goLive.overview.waiting.step"), reference: `${s.code} ${s.title}`, due: s.plannedEnd, to: `${ROOT}/cutover?run=${s.runId}` })),
  ];
  const open = (row) => (
    <Button type="button" icon="pi pi-arrow-right" text rounded aria-label={t("goLive.common.open")} tooltip={t("goLive.common.open")} onClick={() => navigate(row.to)} />
  );

  return (
    <div className="go-live__stack">
      <SectionCard title={t("goLive.overview.phases")}>
        <ol className="go-live__phases" aria-label={t("goLive.overview.phases")}>
          {(o?.phases || []).map((p) => (
            <li key={p.key} className={`go-live__phase go-live__phase--${PHASE_SEVERITY[p.status] || "idle"}`}>
              <span className="go-live__phase-name">{t(`goLive.phase.${p.key}`)}</span>
              <Chip kind="phase" code={p.status} />
            </li>
          ))}
        </ol>
      </SectionCard>
      <StatCards items={kpis} />
      <div className="go-live__columns">
        <SectionCard title={t("goLive.overview.latestLoads")} className="bv-loading-host">
          <LoadingBar active={!o} />
          <DataTable value={loads?.latest || []} dataKey="id" size="small" emptyMessage={t("goLive.overview.noLoads")}
            onRowClick={(e) => navigate(`${ROOT}/loads/${e.data.id}`)} rowClassName={() => "go-live__clickable"}>
            <Column field="loadNumber" header={t("goLive.loads.loadNo")} />
            <Column header={t("goLive.loads.kit")} body={(b) => t(`goLive.kit.${b.kit}`)} />
            <Column header={t("goLive.loads.status")} body={(b) => <Chip kind="batch" code={b.status} />} />
            <Column header={t("goLive.loads.uploadedAt")} body={(b) => dateTimeOf(b.createdAt)} />
          </DataTable>
        </SectionCard>
        <SectionCard title={t("goLive.overview.forMe")}>
          <DataTable value={waiting} dataKey="key" size="small" emptyMessage={t("goLive.overview.nothingWaiting")}>
            <Column field="what" header={t("goLive.overview.what")} />
            <Column field="reference" header={t("goLive.overview.reference")} />
            <Column header={t("goLive.overview.due")} body={(r) => (r.due ? dateTimeOf(r.due) : "—")} />
            <Column body={open} headerClassName="bv-row-actions-head" bodyClassName="bv-row-actions-cell" />
          </DataTable>
        </SectionCard>
      </div>
    </div>
  );
};

export default Overview;
