import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Calendar } from "primereact/calendar";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Timeline } from "primereact/timeline";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { Toast } from "primereact/toast";
import remittanceService, { masterService } from "../../../services/remittanceService";
import { isoDate, showError, showSuccess } from "../shared";
import "./index.scss";

const SCHEDULE_ROUTE = "/master/finance/remittance/schedulemaster";
const emptySchedule = { code: "", name: "", frequency: null, time: "", nextRun: null, linkedProcesses: [] };

const SchedulingDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [frequencies, setFrequencies] = useState([]);
  const [processOptions, setProcessOptions] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(emptySchedule);
  const [loading, setLoading] = useState(false);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const data = await remittanceService.listSchedules();
      setScheduledJobs(data.scheduledJobs || []);
      setUpcomingEvents((data.upcomingEvents || []).map((e) => ({ ...e, icon: "pi pi-calendar", color: "#673AB7" })));
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
    Promise.all([masterService.options("remittance-automated"), masterService.options("remittance-report-template")])
      .then(([automated, reports]) => setProcessOptions([...automated, ...reports].map((r) => ({ label: `${r.code} - ${r.label}`, value: r.code }))))
      .catch((e) => showError(toast, e));
  }, []);

  const run = async (action, message) => {
    try {
      await action();
      showSuccess(toast, message);
      await loadSchedules();
    } catch (e) {
      showError(toast, e);
    }
  };

  const runNow = (job) => run(() => remittanceService.runSchedule(job.id), `${job.name} executed`);

  const togglePause = (job) => run(
    () => remittanceService.setScheduleStatus(job.id, job.status === "Active" ? "Paused" : "Active"),
    `${job.name} ${job.status === "Active" ? "paused" : "resumed"}`
  );

  const handleCreate = () => run(async () => {
    await remittanceService.createSchedule({ ...form, nextRun: isoDate(form.nextRun) });
    setShowDialog(false);
    setForm(emptySchedule);
  }, t("remittance.newSchedule"));

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Active' ? 'success' : 'warning';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button icon="pi pi-play" className="p-button-rounded p-button-success p-button-text" tooltip={t("remittance.runNow")}
          disabled={rowData.status !== "Active"} onClick={() => runNow(rowData)} />
        <Button icon={rowData.status === "Active" ? "pi pi-pause" : "pi pi-refresh"} className="p-button-rounded p-button-warning p-button-text"
          onClick={() => togglePause(rowData)} />
        <Button icon="pi pi-pencil" className="p-button-rounded p-button-text"
          onClick={() => navigate(`${SCHEDULE_ROUTE}/edit`, { state: { data: rowData, mode: "edit" } })} />
      </div>
    );
  };

  const customizedContent = (item) => {
    return (
      <Card className="timeline-card">
        <div className="timeline-header">
          <Tag value={item.status} />
        </div>
        <div className="timeline-content">
          <i className={item.icon} style={{ color: item.color }}></i>
          <span>{item.content}</span>
        </div>
      </Card>
    );
  };

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const dialogFooter = (
    <div>
      <Button label={t("common.cancel")} icon="pi pi-times" className="p-button-text" onClick={() => setShowDialog(false)} />
      <Button label={t("remittance.newSchedule")} icon="pi pi-check" onClick={handleCreate} disabled={!form.code || !form.name || !form.frequency} />
    </div>
  );

  return (
    <div className="scheduling-dashboard">
      <Toast ref={toast} />
      <h2>{t("remittance.scheduling")}</h2>

      <div className="dashboard-grid">
        <div className="schedule-calendar">
          <Card title={t("remittance.scheduleCalendar")}>
            <Calendar
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
          <Button label={t("remittance.newSchedule")} icon="pi pi-plus" className="p-button-primary" onClick={() => setShowDialog(true)} />
          <Button label={t("remittance.runNow")} icon="pi pi-play" className="p-button-success ml-2"
            disabled={!selectedJob || selectedJob.status !== "Active"} onClick={() => runNow(selectedJob)} />
        </div>
        <DataTable value={scheduledJobs} stripedRows loading={loading} selectionMode="single" selection={selectedJob}
          onSelectionChange={(e) => setSelectedJob(e.value)} dataKey="id">
          <Column field="name" header={t("remittance.scheduleName")} />
          <Column field="nextRun" header={t("remittance.nextRun")} />
          <Column field="frequency" header={t("remittance.frequency")} />
          <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
          <Column header={t("remittance.actions")} body={actionBodyTemplate} style={{ width: '150px' }} />
        </DataTable>
      </Card>

      <Dialog header={t("remittance.newSchedule")} visible={showDialog} style={{ width: '40vw' }} footer={dialogFooter} onHide={() => setShowDialog(false)}>
        <div className="p-fluid">
          <div className="p-field">
            <label>Code *</label>
            <InputText value={form.code} onChange={(e) => setField("code", e.target.value)} />
          </div>
          <div className="p-field">
            <label>{t("remittance.scheduleName")} *</label>
            <InputText value={form.name} onChange={(e) => setField("name", e.target.value)} />
          </div>
          <div className="p-field">
            <label>{t("remittance.frequency")} *</label>
            <Dropdown value={form.frequency} options={frequencies} onChange={(e) => setField("frequency", e.value)} />
          </div>
          <div className="p-field">
            <label>{t("remittance.nextRun")}</label>
            <Calendar value={form.nextRun} onChange={(e) => setField("nextRun", e.value)} />
          </div>
          <div className="p-field">
            <label>Time</label>
            <InputText value={form.time} onChange={(e) => setField("time", e.target.value)} placeholder="HH:mm" />
          </div>
          <div className="p-field">
            <label>Linked Processes</label>
            <MultiSelect value={form.linkedProcesses} options={processOptions} onChange={(e) => setField("linkedProcesses", e.value)} display="chip" />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default SchedulingDashboard;
