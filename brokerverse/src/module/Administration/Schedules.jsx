import React, { useEffect, useRef, useState } from "react";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import adminService from "../../services/adminService";
import "./index.scss";

import { formatDate as formatAppDate } from "../../utility/dateFormat";

// Plain-language schedule for the common cron shapes; anything else is shown as written.
const pad = (n) => String(n).padStart(2, "0");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const describeCron = (cron) => {
  const parts = String(cron || "").trim().split(/\s+/);
  if (parts.length !== 5) return cron || "-";
  const [min, hour, dom, mon, dow] = parts;
  const num = (v) => /^\d+$/.test(v);
  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") return "Every minute";
  if (/^\*\/\d+$/.test(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") return `Every ${min.slice(2)} minutes`;
  if (num(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") return `Hourly at :${pad(min)}`;
  if (num(min) && num(hour) && mon === "*") {
    const at = `${pad(hour)}:${pad(min)}`;
    if (dom === "*" && dow === "*") return `Daily at ${at}`;
    if (dom === "*" && dow === "1-5") return `Weekdays at ${at}`;
    if (dom === "*" && num(dow)) return `Every ${DAYS[Number(dow) % 7]} at ${at}`;
    if (num(dom) && dow === "*") return `Monthly on day ${dom} at ${at}`;
  }
  return cron;
};
// Job results as short sentences: {"updated":5} -> "Updated: 5"
export const describeOutput = (out) => {
  if (out == null) return "";
  if (typeof out !== "object") return String(out);
  const words = (k) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  return Object.entries(out)
    .map(([k, v]) => `${words(k)}: ${Array.isArray(v) ? v.length : typeof v === "object" && v ? JSON.stringify(v) : v}`)
    .join(", ") || "Done";
};
const fmt = (d) => formatAppDate(d, { withTime: true });
const statusTag = (s) => (s ? <Tag value={s} severity={s === "success" ? "success" : s === "failed" ? "danger" : "info"} /> : "-");

/** Master > Schedules: the jobs the backend runs on a timetable (renewal notices, expiries, ageing, reports, e-mail). */
const Schedules = () => {
  const toast = useRef(null);
  const [jobs, setJobs] = useState([]);
  const [runs, setRuns] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState("");
  // Cron expressions are read in the configured business time zone (general.timezone, e.g. Asia/Manila)
  const timeZone = jobs.find((j) => j.timeZone)?.timeZone || "";

  const load = () =>
    adminService.getSchedules().then(setJobs).catch((e) => toast.current?.show({ severity: "error", summary: "Schedules", detail: e.message }));
  useEffect(() => {
    load();
  }, []);

  const run = async (job) => {
    setBusy(job.code);
    try {
      const r = await adminService.runSchedule(job.code);
      toast.current?.show({ severity: r.status === "success" ? "success" : "error", summary: job.name, detail: r.status === "success" ? describeOutput(r.output) : r.error });
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: job.name, detail: e.message });
    } finally {
      setBusy("");
    }
  };

  const showRuns = async (job) => {
    try {
      setRuns({ job, rows: await adminService.getScheduleRuns(job.code) });
    } catch (e) {
      toast.current?.show({ severity: "error", summary: job.name, detail: e.message });
    }
  };

  const saveEdit = async () => {
    try {
      await adminService.updateSchedule(edit.code, { cron: edit.cron, enabled: edit.enabled });
      toast.current?.show({ severity: "success", summary: edit.name, detail: "Schedule saved" });
      setEdit(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: edit.name, detail: e.message });
    }
  };

  const actions = (job) => (
    <div className="admin__actions">
      <Button icon="pi pi-play" rounded text title="Run now" aria-label="Run now" loading={busy === job.code} onClick={() => run(job)} />
      <Button icon="pi pi-history" rounded text title="Run history" aria-label="Run history" onClick={() => showRuns(job)} />
      <Button icon="pi pi-pencil" rounded text title="Edit schedule" aria-label="Edit schedule" onClick={() => setEdit({ ...job })} />
    </div>
  );

  return (
    <div className="admin__page">
      <Toast ref={toast} />
      <BreadCrumb model={[{ label: "Master" }, { label: "Schedules" }]} home={{ icon: "pi pi-home", url: "/" }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>Schedules</h2>
          <p>
            Jobs run automatically on the timetable below, in the {timeZone ? <strong>{timeZone}</strong> : "configured"} time zone (System Settings, General).
            Run a job now to test it.
          </p>
        </div>
      </div>
      <DataTable value={jobs} dataKey="code" stripedRows size="small">
        <Column field="name" header="Job" />
        <Column field="description" header="What it does" />
        <Column header={timeZone ? `Schedule (${timeZone})` : "Schedule"} body={(j) => <span title={j.cron}>{describeCron(j.cron)}</span>} />
        <Column header="Enabled" body={(j) => (j.enabled ? "Yes" : "No")} />
        <Column header="Next run" body={(j) => (j.enabled && j.nextRunAt ? fmt(j.nextRunAt) : "-")} />
        <Column header="Last run" body={(j) => fmt(j.lastRunAt)} />
        <Column header="Last status" body={(j) => statusTag(j.lastStatus)} />
        <Column header="" body={actions} />
      </DataTable>

      <Dialog header={runs ? `Run history: ${runs.job.name}` : ""} visible={!!runs} onHide={() => setRuns(null)} style={{ width: "min(900px, 95vw)" }}>
        <DataTable value={runs?.rows || []} size="small" emptyMessage="No runs yet">
          <Column header="Started" body={(r) => fmt(r.startedAt)} />
          <Column header="Finished" body={(r) => fmt(r.finishedAt)} />
          <Column header="Status" body={(r) => statusTag(r.status)} />
          <Column field="triggeredBy" header="Triggered by" />
          <Column header="Result" body={(r) => r.error || describeOutput(r.output)} />
        </DataTable>
      </Dialog>

      <Dialog header={edit ? `Edit: ${edit.name}` : ""} visible={!!edit} onHide={() => setEdit(null)} style={{ width: "min(480px, 95vw)" }}
        footer={<Button label="Save" icon="pi pi-check" onClick={saveEdit} />}>
        {edit && (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="cron">Schedule (cron)</label>
              <InputText id="cron" value={edit.cron} onChange={(e) => setEdit({ ...edit, cron: e.target.value })} />
              <small className="block mt-1">{describeCron(edit.cron)}</small>
              <small>minute hour day month weekday, for example 0 6 * * * runs daily at 06:00{timeZone ? ` ${timeZone} time` : ""}</small>
            </div>
            <div className="admin__field admin__field--inline">
              <label htmlFor="enabled">Enabled</label>
              <InputSwitch inputId="enabled" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.value })} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Schedules;
