import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import DetailDialog from "../../components/DetailDialog";
import DateField from "../../components/DateField";
import FieldError from "../../components/FieldError";
import PageActions from "../../components/PageActions";
import LoadingBar from "../../components/LoadingBar";
import { FilterBar, SectionCard } from "../../components/RecordPage";
import { useStableLoad } from "../../hooks/useStableLoad";
import { calendarDateFormat, toDate } from "../../utility/dateFormat";
import goLiveService from "../../services/goLiveService";
import { Chip, ROOT, count, dateTimeOf, duration, num, useAccess, useWorkspace } from "./shared";

export const RUN_KINDS = ["mock-1", "mock-2", "dress-rehearsal", "extra-mock", "production"];
export const PERSONAL_DATA = ["synthetic", "masked-copy", "production-extract"];
const STATUSES = ["planned", "running", "completed", "failed", "cancelled"];
const PAGE = 20;

/** What is wrong with a run form, by field. */
export const runProblems = (f, t, { create = true } = {}) => {
  const out = {};
  if (create && !f.kind) out.kind = t("goLive.runs.kindRequired");
  if (!String(f.title || "").trim()) out.title = t("goLive.runs.titleRequired");
  if (f.plannedStart && f.plannedEnd && f.plannedEnd < f.plannedStart) out.plannedEnd = t("goLive.runs.endBeforeStart");
  if (f.personalData === "production-extract" && !String(f.dpoApprovalRef || "").trim()) out.dpoApprovalRef = t("goLive.runs.dpoRequired");
  return out;
};

/** Run form (new run, or the planning of an open run): kind, title, dates, personal data used with the DPO approval, exit criteria. */
export const RunDialog = ({ run, onHide, onSaved }) => {
  const { t } = useTranslation();
  const create = !run;
  const [f, setF] = useState(() => ({
    kind: run?.kind || null, title: run?.title || "", cutoverDate: run?.cutoverDate || "", plannedStart: toDate(run?.plannedStart) || null, plannedEnd: toDate(run?.plannedEnd) || null,
    personalData: run?.personalData || null, dpoApprovalRef: run?.dpoApprovalRef || "", exitCriteria: run?.exitCriteria || "",
  }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problems = tried ? runProblems(f, t, { create }) : {};
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setTried(true);
    if (Object.keys(runProblems(f, t, { create })).length) return;
    setBusy(true);
    setError(null);
    try {
      const body = { title: f.title.trim(), cutoverDate: f.cutoverDate || null, plannedStart: f.plannedStart ? f.plannedStart.toISOString() : null,
        plannedEnd: f.plannedEnd ? f.plannedEnd.toISOString() : null, personalData: f.personalData, dpoApprovalRef: f.dpoApprovalRef.trim() || null, exitCriteria: f.exitCriteria.trim() || null };
      const saved = create ? await goLiveService.createRun({ kind: f.kind, ...body }) : await goLiveService.updateRun(run.id, body);
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const label = (id, text, required) => <label htmlFor={id} className="bv-field-label">{text}{required ? <span className="required-marker">*</span> : null}</label>;
  return (
    <DetailDialog visible onHide={onHide} size="md" header={create ? t("goLive.runs.new") : t("goLive.runs.edit", { number: run.runNumber })} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={create ? t("goLive.runs.create") : t("goLive.runs.save")} icon="pi pi-check" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form go-live__form--grid">
        {create ? (
          <div>
            {label("run-kind", t("goLive.runs.kind"), true)}
            <Dropdown inputId="run-kind" value={f.kind} options={RUN_KINDS.map((k) => ({ label: t(`goLive.runKind.${k}`), value: k }))} onChange={(e) => set("kind", e.value)}
              className={`w-full${problems.kind ? " p-invalid" : ""}`} placeholder={t("goLive.common.choose")} />
            <FieldError error={problems.kind} />
          </div>
        ) : null}
        <div>
          {label("run-title", t("goLive.runs.runTitle"), true)}
          <InputText id="run-title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} className={`w-full${problems.title ? " p-invalid" : ""}`} />
          <FieldError error={problems.title} />
        </div>
        <div>
          {label("run-cutover", t("goLive.header.cutover"))}
          <DateField id="run-cutover" value={f.cutoverDate} onChange={(e) => set("cutoverDate", e.target.value)} />
        </div>
        <div>
          {label("run-start", t("goLive.runs.plannedStart"))}
          <Calendar inputId="run-start" value={f.plannedStart} onChange={(e) => set("plannedStart", e.value || null)} showTime hourFormat="24" dateFormat={calendarDateFormat()} showIcon className="w-full" />
        </div>
        <div>
          {label("run-end", t("goLive.runs.plannedEnd"))}
          <Calendar inputId="run-end" value={f.plannedEnd} onChange={(e) => set("plannedEnd", e.value || null)} showTime hourFormat="24" dateFormat={calendarDateFormat()} showIcon
            className={`w-full${problems.plannedEnd ? " p-invalid" : ""}`} />
          <FieldError error={problems.plannedEnd} />
        </div>
        <div>
          {label("run-pd", t("goLive.runs.personalData"))}
          <Dropdown inputId="run-pd" value={f.personalData} options={PERSONAL_DATA.map((k) => ({ label: t(`goLive.personalData.${k}`), value: k }))} showClear
            onChange={(e) => set("personalData", e.value || null)} className="w-full" placeholder={t("goLive.common.choose")} />
        </div>
        {f.personalData === "production-extract" ? (
          <div>
            {label("run-dpo", t("goLive.runs.dpoApproval"), true)}
            <InputText id="run-dpo" value={f.dpoApprovalRef} onChange={(e) => set("dpoApprovalRef", e.target.value)} maxLength={200}
              className={`w-full${problems.dpoApprovalRef ? " p-invalid" : ""}`} />
            <FieldError error={problems.dpoApprovalRef} />
          </div>
        ) : null}
        <div className="go-live__form-full">
          {label("run-exit", t("goLive.runs.exitCriteria"))}
          <InputTextarea id="run-exit" value={f.exitCriteria} onChange={(e) => set("exitCriteria", e.target.value)} rows={3} autoResize maxLength={4000} className="w-full" />
        </div>
        {error ? <p className="go-live__error go-live__form-full" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Runs: Mock 1, Mock 2, the dress rehearsal and the production run with their timings, loads and defects. */
const Runs = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notify, reloadOverview } = useWorkspace();
  const { canWrite } = useAccess();
  const [filter, setFilter] = useState({ kind: null, status: null });
  const [first, setFirst] = useState(0);
  const [creating, setCreating] = useState(false);
  const loader = useCallback(() => goLiveService.runs({ ...filter, page: first / PAGE + 1, perPage: PAGE }), [filter, first]);
  const { data, loading, refreshing } = useStableLoad(loader, { initialData: { rows: [], total: 0 } });
  const change = (patch) => {
    setFirst(0);
    setFilter((f) => ({ ...f, ...patch }));
  };

  return (
    <SectionCard title={t("goLive.runs.title")} className="bv-loading-host" actions={canWrite ? <PageActions onAdd={() => setCreating(true)} addLabel={t("goLive.runs.new")} /> : null}>
      <LoadingBar active={refreshing} />
      <FilterBar active={!!(filter.kind || filter.status)} onClear={() => change({ kind: null, status: null })}>
        <Dropdown value={filter.kind} options={RUN_KINDS.map((k) => ({ label: t(`goLive.runKind.${k}`), value: k }))} onChange={(e) => change({ kind: e.value || null })} showClear
          placeholder={t("goLive.runs.allKinds")} aria-label={t("goLive.runs.kind")} />
        <Dropdown value={filter.status} options={STATUSES.map((s) => ({ label: t(`goLive.status.run.${s}`), value: s }))} onChange={(e) => change({ status: e.value || null })} showClear
          placeholder={t("goLive.loads.allStatuses")} aria-label={t("goLive.loads.status")} />
      </FilterBar>
      <DataTable value={data?.rows || []} dataKey="id" size="small" lazy paginator rows={PAGE} first={first} totalRecords={data?.total || 0} onPage={(e) => setFirst(e.first)}
        loading={loading} emptyMessage={t("goLive.runs.none")} onRowClick={(e) => navigate(`${ROOT}/runs/${e.data.id}`)} rowClassName={() => "go-live__clickable"}>
        <Column field="runNumber" header={t("goLive.runs.runNo")} />
        <Column header={t("goLive.runs.kind")} body={(r) => t(`goLive.runKind.${r.kind}`)} />
        <Column field="title" header={t("goLive.runs.runTitle")} />
        <Column header={t("goLive.runs.environment")} body={(r) => t(`goLive.environment.${r.environment}`, { defaultValue: String(r.environment || "").toUpperCase() })} />
        <Column header={t("goLive.runs.planned")} body={(r) => `${dateTimeOf(r.plannedStart)} – ${dateTimeOf(r.plannedEnd)}`} />
        <Column header={t("goLive.runs.actual")} body={(r) => `${dateTimeOf(r.actualStart)} – ${dateTimeOf(r.actualEnd)}`} />
        <Column header={t("goLive.runs.duration")} body={(r) => duration(r.durationMs)} {...num} />
        <Column header={t("goLive.runs.loads")} body={(r) => count(r.loads)} {...num} />
        <Column header={t("goLive.runs.defects")} body={(r) => `${count(r.defectsOpen)} / ${count(r.defectsTotal)}`} {...num} />
        <Column header={t("goLive.runs.result")} body={(r) => <Chip kind="runResult" code={r.result} />} />
        <Column header={t("goLive.loads.status")} body={(r) => <Chip kind="run" code={r.status} />} />
      </DataTable>
      {creating ? (
        <RunDialog onHide={() => setCreating(false)} onSaved={(r) => {
          setCreating(false);
          notify("success", t("goLive.runs.created", { number: r.runNumber }));
          reloadOverview();
          navigate(`${ROOT}/runs/${r.id}`);
        }} />
      ) : null}
    </SectionCard>
  );
};

export default Runs;
