import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Calendar } from "primereact/calendar";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Timeline } from "primereact/timeline";
import "./index.scss";

const SchedulingDashboard = () => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const scheduledJobs = [
    { id: 1, name: "Monthly Remittance - ABC Insurance", nextRun: "2025-10-01 09:00", frequency: "Monthly", status: "Active" },
    { id: 2, name: "Weekly Settlement - XYZ Life", nextRun: "2025-09-28 14:00", frequency: "Weekly", status: "Active" },
    { id: 3, name: "Quarterly Report - Global Health", nextRun: "2025-12-31 18:00", frequency: "Quarterly", status: "Active" },
    { id: 4, name: "Daily Reconciliation", nextRun: "2025-09-27 06:00", frequency: "Daily", status: "Paused" },
  ];

  const upcomingEvents = [
    { status: "Today 14:00", date: "2025-09-26", icon: "pi pi-clock", color: "#FF9800", content: "Weekly Settlement Processing" },
    { status: "Tomorrow 09:00", date: "2025-09-27", icon: "pi pi-calendar", color: "#607D8B", content: "Daily Reconciliation" },
    { status: "Sep 28, 14:00", date: "2025-09-28", icon: "pi pi-calendar", color: "#9C27B0", content: "Weekly Settlement - XYZ Life" },
    { status: "Oct 1, 09:00", date: "2025-10-01", icon: "pi pi-calendar", color: "#673AB7", content: "Monthly Remittance Run" },
  ];

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Active' ? 'success' : 'warning';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const actionBodyTemplate = () => {
    return (
      <div className="action-buttons">
        <Button icon="pi pi-play" className="p-button-rounded p-button-success p-button-text" />
        <Button icon="pi pi-pause" className="p-button-rounded p-button-warning p-button-text" />
        <Button icon="pi pi-pencil" className="p-button-rounded p-button-text" />
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

  return (
    <div className="scheduling-dashboard">
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
          <Button label={t("remittance.newSchedule")} icon="pi pi-plus" className="p-button-primary" />
          <Button label={t("remittance.runNow")} icon="pi pi-play" className="p-button-success ml-2" />
        </div>
        <DataTable value={scheduledJobs} stripedRows>
          <Column field="name" header={t("remittance.scheduleName")} />
          <Column field="nextRun" header={t("remittance.nextRun")} />
          <Column field="frequency" header={t("remittance.frequency")} />
          <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
          <Column header={t("remittance.actions")} body={actionBodyTemplate} style={{ width: '150px' }} />
        </DataTable>
      </Card>
    </div>
  );
};

export default SchedulingDashboard;
