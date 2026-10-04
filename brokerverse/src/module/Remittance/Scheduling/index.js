import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Calendar } from "primereact/calendar";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Timeline } from "primereact/timeline";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { Toast } from "primereact/toast";
import remittanceService, { masterService } from "../../../services/remittanceService";
import { calendarDateFormat, dateBody, isoDate, loadInsurerOptions, showError, showSuccess } from "../shared";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";

// A schedule says what to remit (insurers, cut-off) and how often (frequency, next run date). It has no timer of its
// own: the "Remittance schedules" job of Master > Schedules runs the due schedules.
const SCHEDULES_ROUTE = "/master/configuration/schedules";
const emptySchedule = { id: null, code: "", name: "", insurers: [], cutOffDays: 0, frequency: null, nextRun: null, linkedProcesses: [] };
const toDate = (v) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null);

const SchedulingDashboard = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [job, setJob] = useState(null);
  const [timeZone, setTimeZone] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [frequencies, setFrequencies] = useState([]);
  const [insurerOptions, setInsurerOptions] = useState([]);
  const [processOptions, setProcessOptions] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(emptySchedule);
  const [loading, setLoading] = useState(false);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const data = await remittanceService.listSchedules();
      setScheduledJobs(data.scheduledJobs || []);
      setUpcomingEvents((data.upcomingEvents || []).map((e) => ({ ...e, icon: "pi pi-calendar", color: "var(--bv-primary)" })));
      setJob(data.job || null);
      setTimeZone(data.timeZone || "");
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
    masterService.definition("remittance-schedule")
      .then((def) => setFrequencies((def.fields || []).find((f) => f.name === "frequency")?.options || []))
      .catch((e) => showError(toast, e));
    loadInsurerOptions()
      .then((rows) => setInsurerOptions(rows.map((r) => ({ label: r.label, value: r.value }))))
      .catch((e) => showError(toast, e));
    masterService.options("remittance-automated")
      .then((rows) => setProcessOptions((rows || []).map((r) => ({ label: `${r.code} - ${r.label}`, value: r.code }))))
      .catch((e) => showError(toast, e));
  }, []);

  const run = async (action, message) => {
    try {
      await action();
      showSuccess(toast, message);
      await loadSchedules();
      return true;
    } catch (e) {
      showError(toast, e);
      return false;
    }
  };

  const runNow = (row) => run(() => remittanceService.runSchedule(row.id), `${row.name} executed`);

  const togglePause = (row) => run(
    () => remittanceService.setScheduleStatus(row.id, row.status === "Active" ? "Paused" : "Active"),
    `${row.name} ${row.status === "Active" ? "paused" : "resumed"}`
  );

  const openNew = () => {
    setForm(emptySchedule);
    setShowDialog(true);
  };

  const openEdit = (row) => {
    setForm({
      id: row.id, code: row.code, name: row.name, insurers: row.insurers || [], cutOffDays: Number(row.cutOffDays) || 0,
      frequency: row.frequency, nextRun: toDate(row.nextRun), linkedProcesses: row.linkedProcesses || [],
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    const { id, ...body } = form;
    const payload = { ...body, nextRun: isoDate(form.nextRun) || null };
    const done = await run(
      () => (id ? remittanceService.updateSchedule(id, payload) : remittanceService.createSchedule(payload)),
      id ? t("remittance.scheduleSaved") : t("remittance.newSchedule")
    );
    if (done) {
      setShowDialog(false);
      setForm(emptySchedule);
    }
  };

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Active' ? 'success' : 'warning';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const insurersBody = (rowData) => (rowData.insurers?.length ? rowData.insurers.join(", ") : (rowData.linkedProcesses || []).join(", ") || "-");

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button icon="pi pi-play" className="p-button-rounded p-button-success p-button-text" tooltip={t("remittance.runNow")}
          disabled={rowData.status !== "Active"} onClick={() => runNow(rowData)} aria-label={t("remittance.runNow")}
          />
        <Button icon={rowData.status === "Active" ? "pi pi-pause" : "pi pi-refresh"} className="p-button-rounded p-button-warning p-button-text"
          onClick={() => togglePause(rowData)}
          aria-label={rowData.status === "Active" ? t("remittance.pause", "Pause") : t("remittance.resume", "Resume")}
          tooltip={rowData.status === "Active" ? t("remittance.pause", "Pause") : t("remittance.resume", "Resume")} tooltipOptions={{ position: "top" }} />
        <Button icon="pi pi-pencil" className="p-button-rounded p-button-text" tooltip={t("common.edit", "Edit")} tooltipOptions={{ position: "top" }}
          aria-label={t("common.edit", "Edit")} onClick={() => openEdit(rowData)} />
      </div>
    );
  };

  const customizedContent = (item) => {
    return (
      <Card className="timeline-card">
        <div className="timeline-header">
          {/* the run date of the event (the API sends it as the status text, ISO) in the configured date format */}
          <Tag value={formatAppDate(item.status)} />
        </div>
        <div className="timeline-content">
          <i className={item.icon} style={{ color: item.color }}></i>
          <span>{item.content}</span>
        </div>
      </Card>
    );
  };

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const canSave = form.code && form.name && form.frequency && (form.insurers.length || form.linkedProcesses.length);

  const dialogFooter = (
    <div>
      <Button label={t("common.cancel")} icon="pi pi-times" className="p-button-text" onClick={() => setShowDialog(false)} />
      <Button label={form.id ? t("common.save", "Save") : t("remittance.newSchedule")} icon="pi pi-check" onClick={handleSave} disabled={!canSave} />
    </div>
  );

  return (
    <div className="scheduling-dashboard">
      <Toast ref={toast} />
      <h2>{t("remittance.scheduling")}</h2>
      <p className="scheduling-note">
        {t("remittance.schedulingNote", { timeZone: timeZone || "-" })}{" "}
        {job && (
          <>
            <Tag value={job.enabled ? t("remittance.scheduleJobOn") : t("remittance.scheduleJobOff")} severity={job.enabled ? "success" : "warning"} />{" "}
          </>
        )}
        <Link to={SCHEDULES_ROUTE}>{t("remittance.openSchedules")}</Link>
      </p>

      <div className="dashboard-grid">
        <div className="schedule-calendar">
          <Card title={t("remittance.scheduleCalendar")}>
            <Calendar dateFormat={calendarDateFormat()}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.value)}
              inline
              showWeek
            />
          </Card>
        </div>

        <div className="upcoming-events">
          <Card title={t("remittance.upcomingEvents")}>
            <Timeline
              value={upcomingEvents}
              content={customizedContent}
              className="custom-timeline"
            />
          </Card>
        </div>
      </div>

      <Card title={t("remittance.scheduledJobs")} className="mt-4">
        <div className="toolbar mb-3">
          <Button label={t("remittance.newSchedule")} icon="pi pi-plus" className="p-button-primary" onClick={openNew} />
          <Button label={t("remittance.runNow")} icon="pi pi-play" className="p-button-success ml-2"
            disabled={!selectedJob || selectedJob.status !== "Active"} onClick={() => runNow(selectedJob)} />
        </div>
        <DataTable value={scheduledJobs} stripedRows loading={loading} selectionMode="single" selection={selectedJob}
          onSelectionChange={(e) => setSelectedJob(e.value)} dataKey="id">
          <Column field="name" header={t("remittance.scheduleName")} />
          <Column field="insurers" header={t("remittance.scheduleInsurers")} body={insurersBody} />
          <Column field="cutOffDays" header={t("remittance.cutOffDays")} />
          <Column field="nextRun" body={dateBody("nextRun")} header={t("remittance.nextRun")} />
          <Column field="frequency" header={t("remittance.frequency")} />
          <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
          <Column header={t("remittance.actions")} body={actionBodyTemplate} style={{ width: '150px' }} />
        </DataTable>
      </Card>

      <Dialog header={form.id ? t("remittance.editSchedule") : t("remittance.newSchedule")} visible={showDialog} style={{ width: '40vw' }} breakpoints={{ '960px': '75vw', '640px': '95vw' }}
        footer={dialogFooter} onHide={() => setShowDialog(false)}>
        <div className="p-fluid">
          <div className="p-field field">
            <label>{t("remittance.scheduleCode")} *</label>
            <InputText value={form.code} disabled={!!form.id} onChange={(e) => setField("code", e.target.value)} />
          </div>
          <div className="p-field field">
            <label>{t("remittance.scheduleName")} *</label>
            <InputText value={form.name} onChange={(e) => setField("name", e.target.value)} />
          </div>
          <div className="p-field field">
            <label>{t("remittance.scheduleInsurers")} *</label>
            <MultiSelect value={form.insurers} options={insurerOptions} filter display="chip" onChange={(e) => setField("insurers", e.value)} />
          </div>
          <div className="p-field field">
            <label htmlFor="schedule-cut-off-days">{t("remittance.cutOffDays")}</label>
            <InputNumber inputId="schedule-cut-off-days" value={form.cutOffDays} min={0} max={365} showButtons style={{ width: "10rem" }} onValueChange={(e) => setField("cutOffDays", e.value ?? 0)} />
            <small>{t("remittance.cutOffDaysHelp")}</small>
          </div>
          <div className="p-field field">
            <label>{t("remittance.frequency")} *</label>
            <Dropdown value={form.frequency} options={frequencies} onChange={(e) => setField("frequency", e.value)} />
          </div>
          <div className="p-field field">
            <label>{t("remittance.nextRun")}</label>
            <Calendar dateFormat={calendarDateFormat()} value={form.nextRun} onChange={(e) => setField("nextRun", e.value)} showIcon />
          </div>
          <div className="p-field field">
            <label>{t("remittance.scheduleAutomated")}</label>
            <MultiSelect value={form.linkedProcesses} options={processOptions} onChange={(e) => setField("linkedProcesses", e.value)} display="chip" />
            <small>{t("remittance.scheduleAutomatedHelp")}</small>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default SchedulingDashboard;
