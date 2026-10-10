import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { TabPanel, TabView } from "primereact/tabview";
import DetailHeader from "../../components/DetailHeader";
import DetailDialog from "../../components/DetailDialog";
import FieldError from "../../components/FieldError";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadState from "../../components/LoadState";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import RowActions, { actionsColumn } from "../../components/RowActions";
import { RecordActivityLog } from "../../components/ActivityLog";
import { SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { Chip, ROOT, chipOf, count, dateOf, dateTimeOf, duration, num, useAccess, useDownload, useWorkspace } from "./shared";
import { RunDialog } from "./Runs";
import Evidence from "./Evidence";

const OPEN = ["planned", "running"];
const RESULTS = ["passed", "passed-with-issues", "failed"];
const DEFECT_STATUSES = ["open", "fixed", "retest", "closed", "deferred"];
const SHA256 = /^[0-9a-f]{64}$/;

/** What is wrong with a defect form, by field. */
export const defectProblems = (f, t) => {
  const out = {};
  if (!String(f.title || "").trim()) out.title = t("goLive.defects.titleRequired");
  if (![1, 2, 3, 4].includes(Number(f.severity))) out.severity = t("goLive.defects.severityRequired");
  return out;
};

/** Add or change a defect of a run: title, object, severity, status, owner, load and step, description, resolution. */
const DefectDialog = ({ run, defect, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [f, setF] = useState(() => ({ title: "", object: "", severity: null, status: "open", owner: "", batchId: null, stepId: null, description: "", resolution: "", ...(defect || {}) }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problems = tried ? defectProblems(f, t) : {};
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setTried(true);
    if (Object.keys(defectProblems(f, t)).length) return;
    setBusy(true);
    setError(null);
    try {
      const body = { title: f.title.trim(), object: f.object?.trim() || null, severity: Number(f.severity), status: f.status, owner: f.owner?.trim() || null, batchId: f.batchId || null,
        stepId: f.stepId || null, description: f.description?.trim() || null, resolution: f.resolution?.trim() || null };
      const d = defect?.id ? await goLiveService.updateDefect(run.id, defect.id, body) : await goLiveService.createDefect(run.id, body);
      onSaved(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const label = (id, text, required) => <label htmlFor={id} className="bv-field-label">{text}{required ? <span className="required-marker">*</span> : null}</label>;
  return (
    <DetailDialog visible onHide={onHide} size="lg" header={defect?.id ? defect.defectNumber : t("goLive.defects.add")} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={defect?.id ? t("goLive.defects.save") : t("goLive.defects.record")} icon="pi pi-check" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form go-live__form--grid">
        <div className="go-live__form-full">
          {label("defect-title", t("goLive.defects.defectTitle"), true)}
          <InputText id="defect-title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={300} className={`w-full${problems.title ? " p-invalid" : ""}`} />
          <FieldError error={problems.title} />
        </div>
        <div>
          {label("defect-severity", t("goLive.defects.severity"), true)}
          <Dropdown inputId="defect-severity" value={f.severity} options={[1, 2, 3, 4].map((s) => ({ label: t(`goLive.severity.${s}`), value: s }))} onChange={(e) => set("severity", e.value)}
            className={`w-full${problems.severity ? " p-invalid" : ""}`} placeholder={t("goLive.common.choose")} />
          <FieldError error={problems.severity} />
        </div>
        <div>
          {label("defect-status", t("goLive.loads.status"))}
          <Dropdown inputId="defect-status" value={f.status} options={DEFECT_STATUSES.map((s) => ({ label: t(`goLive.status.defect.${s}`), value: s }))} onChange={(e) => set("status", e.value)}
            className="w-full" />
        </div>
        <div>
          {label("defect-object", t("goLive.defects.object"))}
          <InputText id="defect-object" value={f.object || ""} onChange={(e) => set("object", e.target.value)} maxLength={100} className="w-full" />
        </div>
        <div>
          {label("defect-owner", t("goLive.defects.owner"))}
          <InputText id="defect-owner" value={f.owner || ""} onChange={(e) => set("owner", e.target.value)} maxLength={200} className="w-full" />
        </div>
        <div>
          {label("defect-load", t("goLive.defects.load"))}
          <Dropdown inputId="defect-load" value={f.batchId} options={(run.loadsList || []).map((b) => ({ label: b.loadNumber, value: b.id }))} showClear onChange={(e) => set("batchId", e.value || null)}
            className="w-full" placeholder={t("goLive.common.none")} />
        </div>
        <div>
          {label("defect-step", t("goLive.defects.step"))}
          <Dropdown inputId="defect-step" value={f.stepId} options={(run.stepRefs || []).map((s) => ({ label: `${s.code} ${s.title}`, value: s.id }))} showClear filter
            onChange={(e) => set("stepId", e.value || null)} className="w-full" placeholder={t("goLive.common.none")} />
        </div>
        <div className="go-live__form-full">
          {label("defect-description", t("goLive.defects.description"))}
          <InputTextarea id="defect-description" value={f.description || ""} onChange={(e) => set("description", e.target.value)} rows={3} autoResize maxLength={4000} className="w-full" />
        </div>
        <div className="go-live__form-full">
          {label("defect-resolution", t("goLive.defects.resolution"))}
          <InputTextarea id="defect-resolution" value={f.resolution || ""} onChange={(e) => set("resolution", e.target.value)} rows={2} autoResize maxLength={4000} className="w-full" />
        </div>
        {error ? <p className="go-live__error go-live__form-full" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Completion of a run: result, whether the exit criteria were met, summary. */
const CompleteDialog = ({ run, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [f, setF] = useState({ result: null, exitCriteriaMet: null, summary: "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problems = tried ? {
    result: f.result ? null : t("goLive.runs.resultRequired"), exitCriteriaMet: f.exitCriteriaMet === null ? t("goLive.runs.exitRequired") : null,
    summary: f.summary.trim() ? null : t("goLive.runs.summaryRequired"),
  } : {};
  const save = async () => {
    setTried(true);
    if (!f.result || f.exitCriteriaMet === null || !f.summary.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await goLiveService.completeRun(run.id, { result: f.result, exitCriteriaMet: f.exitCriteriaMet, summary: f.summary.trim() }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="md" header={t("goLive.runs.completeTitle", { number: run.runNumber })} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.runs.completeRun")} icon="pi pi-flag-fill" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <label htmlFor="run-result" className="bv-field-label">{t("goLive.runs.result")}<span className="required-marker">*</span></label>
        <Dropdown inputId="run-result" value={f.result} options={RESULTS.map((r) => ({ label: t(`goLive.status.runResult.${r}`), value: r }))}
          onChange={(e) => setF((x) => ({ ...x, result: e.value }))} className={`w-full${problems.result ? " p-invalid" : ""}`} placeholder={t("goLive.common.choose")} />
        <FieldError error={problems.result} />
        <label htmlFor="run-exit-met" className="bv-field-label">{t("goLive.runs.exitMet")}<span className="required-marker">*</span></label>
        <Dropdown inputId="run-exit-met" value={f.exitCriteriaMet} options={[{ label: t("goLive.common.yes"), value: true }, { label: t("goLive.common.no"), value: false }]}
          onChange={(e) => setF((x) => ({ ...x, exitCriteriaMet: e.value }))} className={`w-full${problems.exitCriteriaMet ? " p-invalid" : ""}`} placeholder={t("goLive.common.choose")} />
        <FieldError error={problems.exitCriteriaMet} />
        <label htmlFor="run-summary" className="bv-field-label">{t("goLive.runs.summary")}<span className="required-marker">*</span></label>
        <InputTextarea id="run-summary" value={f.summary} onChange={(e) => setF((x) => ({ ...x, summary: e.target.value }))} rows={3} autoResize maxLength={4000}
          className={`w-full${problems.summary ? " p-invalid" : ""}`} />
        <FieldError error={problems.summary} />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Evidence pack of the run and the record of its SHA-256 and archive reference (criterion G11). */
const ReportTab = ({ run, canWrite, onSaved }) => {
  const { t } = useTranslation();
  const download = useDownload();
  const [sha, setSha] = useState(run.evidencePackSha256 || "");
  const [archiveRef, setArchiveRef] = useState(run.archiveRef || "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const shaProblem = tried && sha && !SHA256.test(sha.trim().toLowerCase()) ? t("goLive.runs.shaInvalid") : null;
  const pack = async () => {
    const f = await download(() => goLiveService.evidencePack(run.id));
    if (f?.sha256) setSha(f.sha256);
  };
  const save = async () => {
    setTried(true);
    if (sha && !SHA256.test(sha.trim().toLowerCase())) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.updateRun(run.id, { evidencePackSha256: sha.trim().toLowerCase() || null, archiveRef: archiveRef.trim() || null });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="go-live__stack">
      <div className="go-live__actions">
        <Button type="button" icon="pi pi-file-excel" label={t("goLive.runs.reportXlsx")} outlined onClick={() => download(() => goLiveService.runReport(run.id, "xlsx"))} />
        <Button type="button" icon="pi pi-file-pdf" label={t("goLive.runs.reportPdf")} outlined onClick={() => download(() => goLiveService.runReport(run.id, "pdf"))} />
        <Button type="button" icon="pi pi-box" label={t("goLive.runs.evidencePack")} onClick={pack} />
      </div>
      <div className="go-live__form go-live__form--grid">
        <div>
          <label htmlFor="run-sha" className="bv-field-label">{t("goLive.runs.packSha")}</label>
          <InputText id="run-sha" value={sha} onChange={(e) => setSha(e.target.value)} disabled={!canWrite} maxLength={64} className={`w-full go-live__mono${shaProblem ? " p-invalid" : ""}`} />
          <FieldError error={shaProblem} />
        </div>
        <div>
          <label htmlFor="run-archive" className="bv-field-label">{t("goLive.runs.archiveRef")}</label>
          <InputText id="run-archive" value={archiveRef} onChange={(e) => setArchiveRef(e.target.value)} disabled={!canWrite} maxLength={500} className="w-full" />
        </div>
        {canWrite && run.status !== "cancelled" ? (
          <div className="go-live__form-full">
            <Button type="button" icon="pi pi-check" label={t("goLive.runs.recordArchive")} onClick={save} loading={busy} />
          </div>
        ) : null}
        {error ? <p className="go-live__error go-live__form-full" role="alert">{error}</p> : null}
      </div>
    </div>
  );
};

/**
 * One run (/runs/:id): its record with Start, Complete and Cancel, and the tabs Timings, Loads, Results, Defects,
 * Evidence and Report.
 */
const RunPage = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notify, reloadOverview } = useWorkspace();
  const { canWrite } = useAccess();
  const loader = useCallback(async () => {
    const [run, defects, checklist] = await Promise.all([goLiveService.run(id), goLiveService.defects(id), goLiveService.steps(id)]);
    return { ...run, defects, stepRefs: checklist.steps };
  }, [id]);
  const { data: run, loading, refreshing, error, reload } = useStableLoad(loader);
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [defect, setDefect] = useState(null);

  if (!run) return <LoadState loading={loading} error={error} onRetry={reload} onBack={() => navigate(`${ROOT}/runs`)} backLabel={t("goLive.runs.title")} />;

  const open = OPEN.includes(run.status);
  const done = (message) => {
    notify("success", message);
    reload();
    reloadOverview();
  };
  const start = () => openConfirm({
    title: t("goLive.runs.startTitle"), severity: "neutral", message: t("goLive.runs.startMessage", { number: run.runNumber }),
    facts: [{ label: t("goLive.runs.kind"), value: t(`goLive.runKind.${run.kind}`) }, { label: t("goLive.runs.plannedStart"), value: run.plannedStart, type: "datetime" }],
    confirmLabel: t("goLive.runs.startRun"),
    onConfirm: async () => {
      await goLiveService.startRun(run.id);
      done(t("goLive.runs.started", { number: run.runNumber }));
    },
  });
  const cancel = () => openConfirm({
    title: t("goLive.runs.cancelTitle"), severity: "danger", message: t("goLive.runs.cancelMessage", { number: run.runNumber }),
    input: { type: "textarea", label: t("goLive.runs.cancelReason"), required: true },
    confirmLabel: t("goLive.runs.cancelRun"),
    onConfirm: async (reason) => {
      await goLiveService.cancelRun(run.id, reason);
      done(t("goLive.runs.cancelled", { number: run.runNumber }));
    },
  });

  const actions = canWrite ? (
    <div className="go-live__actions">
      {open ? <Button type="button" icon="pi pi-pencil" label={t("goLive.runs.editRun")} outlined onClick={() => setEditing(true)} /> : null}
      {run.status === "planned" ? <Button type="button" icon="pi pi-play" label={t("goLive.runs.startRun")} onClick={start} /> : null}
      {run.status === "running" ? <Button type="button" icon="pi pi-flag-fill" label={t("goLive.runs.completeRun")} onClick={() => setCompleting(true)} /> : null}
      {open ? <Button type="button" icon="pi pi-times" label={t("goLive.runs.cancelRun")} severity="danger" outlined onClick={cancel} /> : null}
    </div>
  ) : null;

  return (
    <div className="go-live__stack">
      <SectionCard className="bv-loading-host">
        <LoadingBar active={refreshing} />
        <Button type="button" icon="pi pi-arrow-left" text label={t("goLive.runs.title")} onClick={() => navigate(`${ROOT}/runs`)} className="go-live__back" />
        <DetailHeader title={`${run.runNumber} · ${run.title}`} status={chipOf(t, "run", run.status)} subtitle={t(`goLive.runKind.${run.kind}`)} actions={actions} meta={[
          { label: t("goLive.runs.environment"), value: t(`goLive.environment.${run.environment}`, { defaultValue: String(run.environment || "").toUpperCase() }) },
          { label: t("goLive.header.cutover"), value: run.cutoverDate, type: "date" },
          { label: t("goLive.runs.planned"), value: `${dateTimeOf(run.plannedStart)} – ${dateTimeOf(run.plannedEnd)}` },
          { label: t("goLive.runs.actual"), value: `${dateTimeOf(run.actualStart)} – ${dateTimeOf(run.actualEnd)}` },
          { label: t("goLive.runs.personalData"), value: run.personalData ? t(`goLive.personalData.${run.personalData}`) : null },
          { label: t("goLive.runs.dpoApproval"), value: run.dpoApprovalRef, hidden: run.personalData !== "production-extract" },
          { label: t("goLive.runs.restorePoint"), value: run.restorePoint, type: "datetime" },
          { label: t("goLive.runs.result"), value: run.result ? t(`goLive.status.runResult.${run.result}`) : null },
        ]} />
      </SectionCard>
      <TabView className="go-live__record-tabs">
        <TabPanel header={t("goLive.runs.tabs.timings")}>
          <div className="go-live__stack">
            <KeyValueGrid columns={4} items={[
              { label: t("goLive.runs.elapsed"), value: duration(run.timings.elapsedMs) },
              { label: t("goLive.load.validateTime"), value: duration(run.timings.validateMs) },
              { label: t("goLive.load.loadTime"), value: duration(run.timings.loadMs) },
              { label: t("goLive.load.undoTime"), value: duration(run.timings.undoMs) },
              { label: t("goLive.runs.rowsLoaded"), value: run.timings.rowsLoaded, type: "number" },
              { label: t("goLive.runs.stepsDone"), value: `${run.timings.stepsDone} / ${run.timings.steps}` },
              { label: t("goLive.runs.lateSteps"), value: run.timings.lateSteps.join(", ") || null, span: 2 },
            ]} />
            <DataTable value={run.steps} dataKey="code" size="small" emptyMessage={t("goLive.cutover.none")}>
              <Column field="code" header={t("goLive.cutover.code")} />
              <Column field="title" header={t("goLive.cutover.step")} />
              <Column header={t("goLive.cutover.plannedStart")} body={(s) => dateTimeOf(s.plannedStart)} />
              <Column header={t("goLive.cutover.actualStart")} body={(s) => dateTimeOf(s.actualStart)} />
              <Column header={t("goLive.cutover.actualEnd")} body={(s) => dateTimeOf(s.actualEnd)} />
              <Column header={t("goLive.runs.plannedDuration")} body={(s) => duration(s.plannedMs)} {...num} />
              <Column header={t("goLive.runs.elapsed")} body={(s) => duration(s.elapsedMs)} {...num} />
              <Column header={t("goLive.loads.status")} body={(s) => (
                <span className="go-live__chips"><Chip kind="step" code={s.status} />{s.late ? <StatusChip label={t("goLive.cutover.late")} severity="danger" /> : null}</span>
              )} />
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header={t("goLive.runs.tabs.loads")}>
          <DataTable value={run.loadsList} dataKey="id" size="small" emptyMessage={t("goLive.loads.none")} onRowClick={(e) => navigate(`${ROOT}/loads/${e.data.id}`)}
            rowClassName={() => "go-live__clickable"}>
            <Column field="loadNumber" header={t("goLive.loads.loadNo")} />
            <Column header={t("goLive.loads.kit")} body={(b) => t(`goLive.kit.${b.kit}`)} />
            <Column field="fileName" header={t("goLive.loads.file")} />
            <Column header={t("goLive.loads.rowsRead")} body={(b) => count(b.rowsRead)} {...num} />
            <Column header={t("goLive.load.validateTime")} body={(b) => duration(b.validateMs)} {...num} />
            <Column header={t("goLive.load.loadTime")} body={(b) => duration(b.loadMs)} {...num} />
            <Column header={t("goLive.load.undoTime")} body={(b) => duration(b.undoMs)} {...num} />
            <Column header={t("goLive.runs.rowsPerSecond")} body={(b) => (b.rowsPerSecond === null ? "—" : count(b.rowsPerSecond))} {...num} />
            <Column header={t("goLive.loads.status")} body={(b) => <Chip kind="batch" code={b.status} />} />
          </DataTable>
        </TabPanel>
        <TabPanel header={t("goLive.runs.tabs.results")}>
          <div className="go-live__stack">
            <KeyValueGrid columns={2} items={[
              { label: t("goLive.runs.exitCriteria"), value: run.exitCriteria, span: "full" },
              { label: t("goLive.runs.exitMet"), value: run.exitCriteriaMet, type: "boolean" },
              { label: t("goLive.runs.result"), value: run.result ? t(`goLive.status.runResult.${run.result}`) : null },
              { label: t("goLive.runs.summary"), value: run.summary, span: "full" },
            ]} />
            <SectionCard title={t("goLive.recon.title")} flush>
              <DataTable value={run.reconciliations} dataKey="id" size="small" emptyMessage={t("goLive.recon.none")}
                onRowClick={(e) => navigate(`${ROOT}/reconciliation/${e.data.id}`)} rowClassName={() => "go-live__clickable"}>
                <Column field="reconNumber" header={t("goLive.recon.recNo")} />
                <Column header={t("goLive.loads.status")} body={(x) => <Chip kind="recon" code={x.status} />} />
                <Column header={t("goLive.recon.signedAt")} body={(x) => dateTimeOf(x.signedAt)} />
              </DataTable>
            </SectionCard>
            <SectionCard title={t("goLive.decision.title")} flush>
              <DataTable value={run.decisions} dataKey="id" size="small" emptyMessage={t("goLive.decision.none")}>
                <Column header={t("goLive.loads.status")} body={(x) => <Chip kind="decision" code={x.status} />} />
                <Column header={t("goLive.decision.decidedAt")} body={(x) => dateTimeOf(x.decidedAt)} />
                <Column header={t("goLive.decision.newDate")} body={(x) => dateOf(x.newDate)} />
              </DataTable>
            </SectionCard>
          </div>
        </TabPanel>
        <TabPanel header={t("goLive.runs.tabs.defects", { count: run.defectsOpen || 0 })}>
          <div className="go-live__stack">
            {canWrite && run.status !== "cancelled" ? (
              <div className="go-live__actions go-live__actions--end">
                <Button type="button" icon="pi pi-plus" label={t("goLive.defects.add")} onClick={() => setDefect({})} />
              </div>
            ) : null}
            <DataTable value={run.defects} dataKey="id" size="small" emptyMessage={t("goLive.defects.none")}>
              <Column field="defectNumber" header={t("goLive.defects.number")} />
              <Column field="title" header={t("goLive.defects.defectTitle")} />
              <Column field="object" header={t("goLive.defects.object")} body={(d) => d.object || "—"} />
              <Column header={t("goLive.defects.severity")} body={(d) => t(`goLive.severity.${d.severity}`)} />
              <Column header={t("goLive.loads.status")} body={(d) => <Chip kind="defect" code={d.status} />} />
              <Column header={t("goLive.defects.owner")} body={(d) => d.owner || "—"} />
              <Column header={t("goLive.defects.load")} body={(d) => d.loadNumber || "—"} />
              <Column header={t("goLive.defects.step")} body={(d) => d.stepCode || "—"} />
              <Column header={t("goLive.defects.found")} body={(d) => `${d.foundBy || "—"} · ${dateTimeOf(d.foundAt)}`} />
              {canWrite && run.status !== "cancelled" ? (
                <Column body={(d) => <RowActions onEdit={() => setDefect(d)} editLabel={t("goLive.defects.edit")} />} {...actionsColumn} />
              ) : null}
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header={t("goLive.runs.tabs.evidence")}>
          <Evidence ownerType="run" ownerId={run.id} runId={run.id} open={open} />
        </TabPanel>
        <TabPanel header={t("goLive.runs.tabs.report")}>
          <ReportTab key={`${run.evidencePackSha256}-${run.archiveRef}`} run={run} canWrite={canWrite} onSaved={() => done(t("goLive.runs.archiveSaved"))} />
        </TabPanel>
        <TabPanel header={t("goLive.common.activity")}>
          <RecordActivityLog entity="migration_run" recordId={run.id} />
        </TabPanel>
      </TabView>
      {editing ? <RunDialog run={run} onHide={() => setEditing(false)} onSaved={() => { setEditing(false); done(t("goLive.runs.saved")); }} /> : null}
      {completing ? <CompleteDialog run={run} onHide={() => setCompleting(false)}
        onSaved={() => { setCompleting(false); done(t("goLive.runs.completed", { number: run.runNumber })); }} /> : null}
      {defect ? <DefectDialog run={run} defect={defect.id ? defect : null} onHide={() => setDefect(null)}
        onSaved={(d) => { setDefect(null); done(t("goLive.defects.saved", { number: d.defectNumber })); }} /> : null}
    </div>
  );
};

export default RunPage;
