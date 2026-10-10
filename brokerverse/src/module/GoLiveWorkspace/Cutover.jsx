import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import DetailDialog from "../../components/DetailDialog";
import FieldError from "../../components/FieldError";
import LoadingBar from "../../components/LoadingBar";
import StatCards from "../../components/StatCards";
import StatusChip from "../../components/StatusChip";
import { EmptyState, FilterBar, RowActions, SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import { calendarDateFormat, toDate } from "../../utility/dateFormat";
import goLiveService from "../../services/goLiveService";
import { Chip, dateTimeOf, duration, useAccess, useWorkspace } from "./shared";
import Evidence from "./Evidence";

export const RESTORE_POINT_STEP = "CO-3";

/** The run the checklist opens on: the one named in the address, else the production run, else the latest open run. */
export const defaultRun = (runs, wanted) => {
  if (wanted && runs.some((r) => String(r.id) === String(wanted))) return Number(wanted);
  const live = runs.filter((r) => r.status !== "cancelled");
  return (live.find((r) => r.kind === "production") || live.find((r) => ["planned", "running"].includes(r.status)) || live[0] || {}).id || null;
};

/** What a step allows now: start, done, block, skip (the server checks the same). */
export const stepActions = (s, runStatus) => {
  const running = runStatus === "running";
  return {
    start: running && ["not-started", "blocked"].includes(s.status) && !(s.waitingFor || []).length,
    done: running && s.status === "in-progress",
    block: running && ["not-started", "in-progress"].includes(s.status),
    skip: ["planned", "running"].includes(runStatus) && ["not-started", "blocked"].includes(s.status),
  };
};

/** Done of a step: a note when the evidence named by the runbook is not attached, the restore point on CO-3. */
const DoneDialog = ({ runId, step, restorePoint, onHide, onDone }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [point, setPoint] = useState(toDate(restorePoint) || null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const noteNeeded = step.evidenceRequired && !step.evidenceCount;
  const problems = tried ? {
    note: noteNeeded && !note.trim() ? t("goLive.cutover.noteNeeded", { hint: step.evidenceHint }) : null,
    point: step.code === RESTORE_POINT_STEP && !point ? t("goLive.cutover.restorePointRequired") : null,
  } : {};
  const save = async () => {
    setTried(true);
    if ((noteNeeded && !note.trim()) || (step.code === RESTORE_POINT_STEP && !point)) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.stepAction(runId, step.id, "done", { note: note.trim() || null, ...(step.code === RESTORE_POINT_STEP ? { restorePoint: point.toISOString() } : {}) });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="md" header={t("goLive.cutover.doneTitle", { code: step.code })} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.cutover.markDone")} icon="pi pi-check" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <p className="go-live__subject">{step.title}</p>
        {step.evidenceHint ? (
          <span>{t("goLive.cutover.evidenceAttached", { count: step.evidenceCount, hint: step.evidenceHint })}</span>
        ) : null}
        {step.code === RESTORE_POINT_STEP ? (
          <>
            <label htmlFor="step-restore" className="bv-field-label">{t("goLive.runs.restorePoint")}<span className="required-marker">*</span></label>
            <Calendar inputId="step-restore" value={point} onChange={(e) => setPoint(e.value || null)} showTime hourFormat="24" dateFormat={calendarDateFormat()} showIcon
              className={`w-full${problems.point ? " p-invalid" : ""}`} />
            <FieldError error={problems.point} />
          </>
        ) : null}
        <label htmlFor="step-note" className="bv-field-label">{t("goLive.cutover.note")}{noteNeeded ? <span className="required-marker">*</span> : null}</label>
        <InputTextarea id="step-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoResize maxLength={2000} className={`w-full${problems.note ? " p-invalid" : ""}`} />
        <FieldError error={problems.note} />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Owner (a user of the workspace or a role), planned start and end, notes of a step. */
const StepDialog = ({ runId, step, users, onHide, onDone }) => {
  const { t } = useTranslation();
  const [f, setF] = useState({ ownerUserId: step.ownerUserId || null, ownerRole: step.ownerRole || "", plannedStart: toDate(step.plannedStart) || null,
    plannedEnd: toDate(step.plannedEnd) || null, notes: step.notes || "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const endProblem = tried && f.plannedStart && f.plannedEnd && f.plannedEnd < f.plannedStart ? t("goLive.runs.endBeforeStart") : null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setTried(true);
    if (f.plannedStart && f.plannedEnd && f.plannedEnd < f.plannedStart) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.updateStep(runId, step.id, { ownerUserId: f.ownerUserId, ownerRole: f.ownerRole.trim() || null, plannedStart: f.plannedStart ? f.plannedStart.toISOString() : null,
        plannedEnd: f.plannedEnd ? f.plannedEnd.toISOString() : null, notes: f.notes.trim() || null });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="md" header={`${step.code} · ${step.title}`} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.cutover.saveStep")} icon="pi pi-check" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <label htmlFor="step-owner" className="bv-field-label">{t("goLive.cutover.ownerUser")}</label>
        <Dropdown inputId="step-owner" value={f.ownerUserId} options={users.map((u) => ({ label: u.name, value: u.userId }))} onChange={(e) => set("ownerUserId", e.value || null)}
          showClear filter className="w-full" placeholder={t("goLive.common.none")} />
        <label htmlFor="step-role" className="bv-field-label">{t("goLive.cutover.ownerRole")}</label>
        <InputText id="step-role" value={f.ownerRole} onChange={(e) => set("ownerRole", e.target.value)} maxLength={100} className="w-full" />
        <label htmlFor="step-start" className="bv-field-label">{t("goLive.cutover.plannedStart")}</label>
        <Calendar inputId="step-start" value={f.plannedStart} onChange={(e) => set("plannedStart", e.value || null)} showTime hourFormat="24" dateFormat={calendarDateFormat()} showIcon className="w-full" />
        <label htmlFor="step-end" className="bv-field-label">{t("goLive.cutover.plannedEnd")}</label>
        <Calendar inputId="step-end" value={f.plannedEnd} onChange={(e) => set("plannedEnd", e.value || null)} showTime hourFormat="24" dateFormat={calendarDateFormat()} showIcon
          className={`w-full${endProblem ? " p-invalid" : ""}`} />
        <FieldError error={endProblem} />
        <label htmlFor="step-notes" className="bv-field-label">{t("goLive.cutover.notes")}</label>
        <InputTextarea id="step-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} autoResize maxLength={2000} className="w-full" />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Cutover: the runbook checklist of a run by phase, with owner, planned and actual times, status, evidence and notes. */
const Cutover = () => {
  const { t } = useTranslation();
  const { notify, reloadOverview } = useWorkspace();
  const { canWrite } = useAccess();
  const [params, setParams] = useSearchParams();
  const runsLoader = useCallback(() => goLiveService.runs({ perPage: 100 }), []);
  const { data: runsData } = useStableLoad(runsLoader, { initialData: { rows: [] } });
  const runs = useMemo(() => runsData?.rows || [], [runsData]);
  const [runId, setRunId] = useState(null);
  const usersLoader = useCallback(() => (canWrite ? goLiveService.users() : Promise.resolve([])), [canWrite]);
  const { data: users } = useStableLoad(usersLoader, { initialData: [] });
  const [done, setDone] = useState(null);
  const [editing, setEditing] = useState(null);
  const [evidenceOf, setEvidenceOf] = useState(null);

  useEffect(() => {
    if (runId === null && runs.length) setRunId(defaultRun(runs, params.get("run")));
  }, [runs, runId, params]);

  const loader = useCallback(() => goLiveService.steps(runId), [runId]);
  const { data, loading, refreshing, reload } = useStableLoad(loader, { enabled: !!runId });
  const run = runs.find((r) => r.id === runId);
  const runStatus = data?.runStatus;
  const changed = (message) => {
    notify("success", message);
    reload();
    reloadOverview();
  };
  const choose = (id) => {
    setRunId(id);
    setParams(id ? { run: String(id) } : {});
  };

  const noted = (s, action) => openConfirm({
    title: t(`goLive.cutover.noted.${action}.title`, { code: s.code }), severity: "warning", message: s.title,
    input: { type: "textarea", label: t("goLive.cutover.note"), required: true },
    confirmLabel: t(`goLive.cutover.noted.${action}.confirm`),
    onConfirm: async (note) => {
      await goLiveService.stepAction(runId, s.id, action, { note });
      changed(t(`goLive.cutover.noted.${action}.done`, { code: s.code }));
    },
  });
  const start = async (s) => {
    try {
      await goLiveService.stepAction(runId, s.id, "start");
      changed(t("goLive.cutover.started", { code: s.code }));
    } catch (e) {
      notify("error", e.message);
    }
  };

  const actionsOf = (s) => {
    const can = stepActions(s, runStatus);
    return (
      <RowActions actions={[
        { icon: "pi pi-play", label: t("goLive.cutover.start"), onClick: () => start(s), hidden: !can.start },
        { icon: "pi pi-check", label: t("goLive.cutover.markDone"), onClick: () => setDone(s), hidden: !can.done },
      ]} menu={[
        { label: t("goLive.cutover.noted.block.confirm"), icon: "pi pi-ban", command: () => noted(s, "block"), hidden: !can.block },
        { label: t("goLive.cutover.noted.skip.confirm"), icon: "pi pi-forward", command: () => noted(s, "skip"), hidden: !can.skip },
        { label: t("goLive.cutover.edit"), icon: "pi pi-pencil", command: () => setEditing(s), hidden: !["planned", "running"].includes(runStatus) },
      ]} />
    );
  };
  const p = data?.progress;
  const kpis = [
    { key: "progress", label: t("goLive.cutover.progress"), value: p ? `${p.percent}%` : undefined, note: p ? t("goLive.overview.checklistNote", { done: p.done, total: p.total }) : null },
    { key: "elapsed", label: t("goLive.cutover.elapsedVsPlan"), value: p ? duration(p.elapsedMs) : undefined, note: p ? t("goLive.cutover.planned", { time: duration(p.plannedMs) }) : null },
    { key: "next", label: t("goLive.cutover.next"), value: p?.next ? p.next.code : "—", note: p?.next?.title || null },
    { key: "late", label: t("goLive.cutover.late"), value: p ? p.late.length : undefined, note: p?.late.join(", ") || null,
      status: p?.late.length ? { severity: "warning", label: t("goLive.cutover.lateSteps") } : undefined },
  ];

  return (
    <div className="go-live__stack">
      <FilterBar>
        <Dropdown value={runId} options={runs.map((r) => ({ label: `${r.runNumber} · ${r.title}`, value: r.id }))} onChange={(e) => choose(e.value)} placeholder={t("goLive.cutover.chooseRun")}
          aria-label={t("goLive.loads.run")} />
        {run ? <Chip kind="run" code={run.status} /> : null}
      </FilterBar>
      {!runs.length && !runsData?.total ? (
        <EmptyState icon="pi-list-check" title={t("goLive.cutover.noRun")} />
      ) : (
        <>
          <StatCards items={kpis} />
          <SectionCard title={t("goLive.cutover.checklist")} className="bv-loading-host">
            <LoadingBar active={refreshing} />
            <DataTable value={data?.steps || []} dataKey="id" size="small" loading={loading} rowGroupMode="subheader" groupRowsBy="phase"
              rowGroupHeaderTemplate={(s) => <strong>{t(`goLive.cutoverPhase.${s.phase}`, { defaultValue: s.phaseLabel })}</strong>} emptyMessage={t("goLive.cutover.none")} scrollable>
              <Column field="code" header={t("goLive.cutover.code")} />
              <Column header={t("goLive.cutover.step")} body={(s) => (
                <span>{s.title}{s.waitingFor?.length ? <small className="go-live__muted"> · {t("goLive.cutover.waitsFor", { steps: s.waitingFor.join(", ") })}</small> : null}</span>
              )} />
              <Column header={t("goLive.cutover.owner")} body={(s) => s.ownerName || s.ownerRole || "—"} />
              <Column header={t("goLive.cutover.plannedStart")} body={(s) => dateTimeOf(s.plannedStart)} />
              <Column header={t("goLive.cutover.plannedEnd")} body={(s) => dateTimeOf(s.plannedEnd)} />
              <Column header={t("goLive.cutover.actualStart")} body={(s) => dateTimeOf(s.actualStart)} />
              <Column header={t("goLive.cutover.actualEnd")} body={(s) => dateTimeOf(s.actualEnd)} />
              <Column header={t("goLive.loads.status")} body={(s) => (
                <span className="go-live__chips"><Chip kind="step" code={s.status} />{s.late ? <StatusChip label={t("goLive.cutover.late")} severity="danger" /> : null}</span>
              )} />
              <Column header={t("goLive.cutover.evidence")} body={(s) => (
                <Button type="button" icon="pi pi-paperclip" text size="small" label={String(s.evidenceCount)} onClick={() => setEvidenceOf(s)}
                  aria-label={t("goLive.cutover.evidenceOf", { code: s.code, count: s.evidenceCount })} />
              )} />
              <Column header={t("goLive.cutover.notes")} body={(s) => s.notes || "—"} />
              {canWrite ? <Column body={actionsOf} headerClassName="bv-row-actions-head" bodyClassName="bv-row-actions-cell" /> : null}
            </DataTable>
          </SectionCard>
        </>
      )}
      {done ? <DoneDialog runId={runId} step={done} restorePoint={run?.restorePoint} onHide={() => setDone(null)}
        onDone={() => { setDone(null); changed(t("goLive.cutover.doneMessage", { code: done.code })); }} /> : null}
      {editing ? <StepDialog runId={runId} step={editing} users={users || []} onHide={() => setEditing(null)}
        onDone={() => { setEditing(null); changed(t("goLive.cutover.saved", { code: editing.code })); }} /> : null}
      {evidenceOf ? (
        <DetailDialog visible onHide={() => { setEvidenceOf(null); reload(); }} size="lg" header={t("goLive.cutover.evidenceTitle", { code: evidenceOf.code })}>
          <Evidence ownerType="step" ownerId={evidenceOf.id} open={["planned", "running"].includes(runStatus)} />
        </DetailDialog>
      ) : null}
    </div>
  );
};

export default Cutover;
