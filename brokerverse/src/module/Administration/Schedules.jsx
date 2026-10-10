import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import adminService from "../../services/adminService";
import i18n from "../../i18n";
import DetailDialog from "../../components/DetailDialog";
import StatusChip from "../../components/StatusChip";
import { openConfirm } from "../../components/ConfirmDialog";
import { ActivityLog, fromJobRuns, humanize } from "../../components/ActivityLog";
import "./index.scss";

import { formatInstant } from "../../utility/dateFormat";

const s = (key, opts) => i18n.t(`schedules.${key}`, opts);

// Plain-language schedule for the common cron shapes; anything else is shown as written.
const pad = (n) => String(n).padStart(2, "0");
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export const describeCron = (cron) => {
  const parts = String(cron || "").trim().split(/\s+/);
  if (parts.length !== 5) return cron || "-";
  const [min, hour, dom, mon, dow] = parts;
  const num = (v) => /^\d+$/.test(v);
  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") return s("cron.everyMinute");
  if (/^\*\/\d+$/.test(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") return s("cron.everyMinutes", { count: Number(min.slice(2)) });
  if (num(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") return s("cron.hourly", { minute: pad(min) });
  if (num(min) && num(hour) && mon === "*") {
    const at = `${pad(hour)}:${pad(min)}`;
    if (dom === "*" && dow === "*") return s("cron.daily", { at });
    if (dom === "*" && dow === "1-5") return s("cron.weekdays", { at });
    if (dom === "*" && num(dow)) return s("cron.weekly", { day: s(`days.${DAYS[Number(dow) % 7]}`), at });
    if (num(dom) && dow === "*") return s("cron.monthly", { day: dom, at });
  }
  return cron;
};
// Job results as short facts: {"updated":5} -> "Updated: 5"
export const describeOutput = (out) => {
  if (out == null) return "";
  if (typeof out !== "object") return String(out);
  const value = (v) => {
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === "object") return Object.entries(v).map(([k, x]) => `${humanize(k).toLowerCase()} ${x}`).join(", ");
    return v;
  };
  // counts read as "5 updated", "3 notifications"; other values as "Folder: /exports"
  return Object.entries(out)
    .map(([k, v]) => {
      const shown = value(v);
      return typeof shown === "number" ? s("outputCount", { count: shown, what: humanize(k).toLowerCase() }) : `${humanize(k)}: ${shown}`;
    })
    .join("; ") || s("done");
};
const fmt = (d) => formatInstant(d);
const RUN_SEVERITY = { success: "success", failed: "danger", running: "info" };
const runChip = (status) => (status ? <StatusChip code={status} label={s(`runStatus.${status}`, { defaultValue: humanize(status) })} severity={RUN_SEVERITY[status] || "info"} /> : "-");

/** Master > Schedules: the jobs the backend runs on a timetable (renewal notices, expiries, ageing, reports, e-mail). */
const Schedules = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [jobs, setJobs] = useState([]);
  const [runs, setRuns] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState("");
  // Cron expressions are read in the configured business time zone (general.timezone, e.g. Asia/Manila)
  const timeZone = jobs.find((j) => j.timeZone)?.timeZone || "";

  const load = () =>
    adminService.getSchedules().then(setJobs).catch((e) => toast.current?.show({ severity: "error", summary: t("schedules.title"), detail: e.message }));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run now starts the job at once (notices, e-mails, ageing): asked first; the job's outcome is the toast
  const run = async (job) => {
    let r;
    setBusy(job.code);
    const started = await openConfirm({
      title: t("schedules.runTitle"),
      severity: "warning",
      message: t("schedules.runMessage"),
      facts: [
        { label: t("schedules.job"), value: job.name },
        { label: t("schedules.whatItDoes"), value: job.description, hidden: !job.description },
        { label: t("schedules.status"), value: job.enabled ? t("schedules.switchedOn") : t("schedules.switchedOff") },
        { label: t("schedules.schedule"), value: describeCron(job.cron) },
        { label: t("schedules.lastRun"), value: job.lastRunAt || t("schedules.neverRun"), type: job.lastRunAt ? "datetime" : undefined },
        { label: t("schedules.nextRun"), value: job.nextRunAt, type: "datetime", hidden: !job.enabled || !job.nextRunAt },
      ],
      confirmLabel: t("schedules.runAction"),
      onConfirm: async () => {
        r = await adminService.runSchedule(job.code);
      },
    });
    setBusy("");
    if (!started) return;
    toast.current?.show({ severity: r.status === "success" ? "success" : "error", summary: job.name, detail: r.status === "success" ? describeOutput(r.output) : r.error });
    load();
  };

  const showRuns = async (job) => {
    setRuns({ job, rows: [], loading: true, error: null });
    try {
      const rows = await adminService.getScheduleRuns(job.code);
      setRuns({ job, rows, loading: false, error: null });
    } catch (e) {
      setRuns({ job, rows: [], loading: false, error: e.message || true });
    }
  };

  const saveEdit = async () => {
    try {
      await adminService.updateSchedule(edit.code, { cron: edit.cron, enabled: edit.enabled });
      toast.current?.show({ severity: "success", summary: edit.name, detail: t("schedules.saved") });
      setEdit(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: edit.name, detail: e.message });
    }
  };

  // what each run did, in words: the job's result, or its error
  // what a run did, counted by kind ("Updated 5", "Notifications 3"), under What changed; a text result stays a remark
  const runEntries = (rows) => fromJobRuns(rows).map((entry, i) => {
    const out = rows[i].output;
    if (!out || typeof out !== "object" || Array.isArray(out)) return { ...entry, remarks: entry.remarks || describeOutput(out) || null };
    const changes = Object.entries(out).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
      .map(([k, v]) => ({ field: k, label: humanize(k), before: null, after: String(v) }));
    return { ...entry, changes };
  });

  const actions = (job) => (
    <div className="admin__actions">
      <Button icon="pi pi-play" rounded text aria-label={t("schedules.runNow")} loading={busy === job.code} onClick={() => run(job)} tooltip={t("schedules.runNow")} tooltipOptions={{ position: "top" }} />
      <Button icon="pi pi-history" rounded text aria-label={t("schedules.runHistory")} onClick={() => showRuns(job)} tooltip={t("schedules.runHistory")} tooltipOptions={{ position: "top" }} />
      <Button icon="pi pi-pencil" rounded text aria-label={t("schedules.edit")} onClick={() => setEdit({ ...job })} tooltip={t("schedules.edit")} tooltipOptions={{ position: "top" }} />
    </div>
  );

  return (
    <div className="admin__page">
      <Toast ref={toast} />
      <BreadCrumb model={[{ label: t("schedules.title") }]} home={{ label: t("schedules.master") }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>{t("schedules.title")}</h2>
        </div>
      </div>
      <DataTable value={jobs} dataKey="code" stripedRows size="small">
        <Column field="name" header={t("schedules.job")} />
        <Column field="description" header={t("schedules.whatItDoes")} />
        <Column header={timeZone ? t("schedules.scheduleIn", { zone: timeZone }) : t("schedules.schedule")} body={(j) => <span title={j.cron}>{describeCron(j.cron)}</span>} />
        <Column header={t("schedules.status")} body={(j) => <StatusChip code={j.enabled ? "active" : "inactive"} label={j.enabled ? t("schedules.scheduled") : t("schedules.switchedOff")} severity={j.enabled ? "success" : "secondary"} />} />
        <Column header={t("schedules.nextRun")} body={(j) => (j.enabled && j.nextRunAt ? fmt(j.nextRunAt) : "-")} />
        <Column header={t("schedules.lastRun")} body={(j) => fmt(j.lastRunAt)} />
        <Column header={t("schedules.lastStatus")} body={(j) => runChip(j.lastStatus)} />
        <Column header="" body={actions} />
      </DataTable>

      {runs ? (
        <DetailDialog visible onHide={() => setRuns(null)} header={t("schedules.historyTitle", { job: runs.job.name })} size="md">
          <ActivityLog entries={runEntries(runs.rows)} loading={runs.loading} error={runs.error} onRetry={() => showRuns(runs.job)} emptyText={t("schedules.noRuns")} />
        </DetailDialog>
      ) : null}

      <Dialog header={edit ? t("schedules.editTitle", { job: edit.name }) : ""} visible={!!edit} onHide={() => setEdit(null)} style={{ width: "min(480px, 95vw)" }} className="bv-centered"
        footer={(
          <>
            <Button label={t("schedules.cancel")} text onClick={() => setEdit(null)} />
            <Button label={t("schedules.saveSchedule")} icon="pi pi-check" onClick={saveEdit} />
          </>
        )}>
        {edit && (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="cron">{t("schedules.cronLabel")}</label>
              <InputText id="cron" value={edit.cron} onChange={(e) => setEdit({ ...edit, cron: e.target.value })} />
              <small className="block mt-1">{describeCron(edit.cron)}</small>
              <small>{timeZone ? t("schedules.cronHelpZone", { zone: timeZone }) : t("schedules.cronHelp")}</small>
            </div>
            <div className="admin__field admin__field--inline">
              <label htmlFor="enabled">{t("schedules.enabled")}</label>
              <InputSwitch inputId="enabled" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.value })} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Schedules;
