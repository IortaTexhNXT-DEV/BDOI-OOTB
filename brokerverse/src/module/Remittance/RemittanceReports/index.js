import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card } from "primereact/card";
import { Tree } from "primereact/tree";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { MultiSelect } from "primereact/multiselect";
import { RadioButton } from "primereact/radiobutton";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import remittanceService from "../../../services/remittanceService";
import { calendarDateFormat, isoDate, isoMonth, loadInsurerOptions, loadMasterOptions, showError, showSuccess } from "../shared";
import "./index.scss";

const SCHEDULE_ROUTE = "/master/finance/remittance/schedulemaster";

/** Report templates grouped into tree nodes by category. */
const toTree = (templates) => {
  const groups = {};
  templates.forEach((tpl) => {
    const category = tpl.category || "General";
    (groups[category] = groups[category] || []).push(tpl);
  });
  return Object.entries(groups).map(([category, rows], i) => ({
    key: String(i),
    label: `${category} Reports`,
    icon: "pi pi-folder",
    selectable: false,
    children: rows.map((tpl, j) => ({ key: `${i}-${j}`, label: tpl.name, data: tpl }))
  }));
};

const RemittanceReports = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportParams, setReportParams] = useState({
    reportPeriod: [null, null],
    insurer: [],
    branch: [],
    productLine: [],
    outputFormat: "csv",
    reportLayout: "Detailed",
    includeCharts: true,
    orientation: "Portrait"
  });
  const [templates, setTemplates] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [scheduledReports, setScheduledReports] = useState([]);
  const [insurerOptions, setInsurerOptions] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const [productLineOptions, setProductLineOptions] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadReports = async () => {
    try {
      const [tpl, reports, schedules] = await Promise.all([
        remittanceService.reportTemplates(),
        remittanceService.listReports(),
        remittanceService.listSchedules()
      ]);
      setTemplates(tpl || []);
      setRecentReports(reports || []);
      const codes = new Set((tpl || []).map((x) => x.code));
      setScheduledReports((schedules?.scheduledJobs || []).filter((j) => (j.linkedProcesses || []).some((c) => codes.has(c))));
    } catch (e) {
      showError(toast, e);
    }
  };

  useEffect(() => {
    loadReports();
    loadInsurerOptions().then(setInsurerOptions).catch((e) => showError(toast, e));
    loadMasterOptions("branch").then(setBranchOptions).catch((e) => showError(toast, e));
    loadMasterOptions("line-of-business").then((rows) => setProductLineOptions(rows.map((r) => ({ label: r.label, value: r.label })))).catch((e) => showError(toast, e));
  }, []);

  const reportCategories = toTree(templates);
  const selectedKey = selectedReport && Object.keys(selectedReport)[0];
  const selectedTemplate = reportCategories.flatMap((c) => c.children).find((n) => n.key === selectedKey)?.data;
  const [from, to] = reportParams.reportPeriod || [];

  const withBusy = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBusy(false);
    }
  };

  const generate = () => remittanceService.generateReport({
    templateCode: selectedTemplate.code,
    from: isoDate(from),
    to: isoDate(to),
    insurers: reportParams.insurer
  });

  const handlePreview = () => withBusy(async () => {
    const preview = await remittanceService.previewStatement({ period: isoMonth(from || new Date()), insurers: reportParams.insurer });
    toast.current.show({ severity: "info", summary: selectedTemplate.name, detail: `${preview.totalRows} row(s) for ${isoMonth(from || new Date())}`, life: 4000 });
  });

  const handleGenerate = () => withBusy(async () => {
    const report = await generate();
    showSuccess(toast, `${report.referenceNo}: ${report.rowCount} row(s)`, "Report Generated");
    window.open(report.fileUrl, "_blank", "noopener");
    loadReports();
  });

  const handleSchedule = () => withBusy(async () => {
    const tomorrow = isoDate(new Date(Date.now() + 86400000));
    await remittanceService.createSchedule({
      code: `SCH-${selectedTemplate.code}-${tomorrow.replace(/-/g, "")}`,
      name: selectedTemplate.name,
      type: "Report",
      frequency: selectedTemplate.frequency || "Monthly",
      nextRun: tomorrow,
      linkedProcesses: [selectedTemplate.code]
    });
    showSuccess(toast, `${selectedTemplate.name} scheduled`);
    loadReports();
  });

  const handleEmail = () => {
    const recipients = window.prompt("Send report to (comma separated e-mails)", "");
    if (!recipients) return;
    withBusy(async () => {
      const report = await generate();
      await remittanceService.sendNotification({
        type: "Report",
        subject: `${selectedTemplate.name} (${report.period})`,
        content: `The report is available at ${report.fileUrl}`,
        recipients: recipients.split(",").map((r) => r.trim()).filter(Boolean),
        channel: "Email"
      });
      showSuccess(toast, `${selectedTemplate.name} e-mailed`);
      loadReports();
    });
  };

  const pauseSchedule = (job) => withBusy(async () => {
    await remittanceService.setScheduleStatus(job.id, job.status === "Active" ? "Paused" : "Active");
    showSuccess(toast, `${job.name} ${job.status === "Active" ? "paused" : "resumed"}`);
    loadReports();
  });

  return (
    <div className="remittance-reports">
      <Toast ref={toast} />
      <h2>{t("remittanceReports.title")}</h2>

      <div className="report-center">
        <Card title={t("remittanceReports.reportCategories")} className="left-panel">
          <Tree
            value={reportCategories}
            selectionMode="single"
            selectionKeys={selectedReport}
            onSelectionChange={(e) => setSelectedReport(e.value)}
          />
        </Card>

        <Card title={t("remittanceReports.reportParameters")} className="center-panel">
          {selectedTemplate ? (
            <div className="report-params">
              <div className="report-info">
                <h4>Selected Report</h4>
                <p>{selectedTemplate.name}</p>
                <p className="text-muted">{[selectedTemplate.code, selectedTemplate.frequency, selectedTemplate.format].filter(Boolean).join(" • ")}</p>
              </div>

              <div className="param-section">
                <h4>{t("remittanceReports.reportParameters")}</h4>
                <div className="p-fluid">
                  <div className="p-field field">
                    <label>{t("remittanceReports.reportPeriod")} *</label>
                    <Calendar dateFormat={calendarDateFormat()}
                      value={reportParams.reportPeriod}
                      onChange={(e) => setReportParams({ ...reportParams, reportPeriod: e.value })}
                      selectionMode="range"
                      placeholder={t("remittanceReports.selectDateRange")}
                    />
                  </div>
                  <div className="p-field field">
                    <label>{t("remittanceReports.insurer")}</label>
                    <MultiSelect
                      value={reportParams.insurer}
                      options={insurerOptions}
                      filter
                      onChange={(e) => setReportParams({ ...reportParams, insurer: e.value })}
                      placeholder={t("remittanceReports.allInsurers")}
                      display="chip"
                    />
                  </div>
                  <div className="p-field field">
                    <label>{t("remittanceReports.branch")}</label>
                    <MultiSelect
                      value={reportParams.branch}
                      options={branchOptions}
                      onChange={(e) => setReportParams({ ...reportParams, branch: e.value })}
                      placeholder={t("remittanceReports.allBranches")}
                      display="chip"
                    />
                  </div>
                  <div className="p-field field">
                    <label>Product Line</label>
                    <MultiSelect
                      value={reportParams.productLine}
                      options={productLineOptions}
                      onChange={(e) => setReportParams({ ...reportParams, productLine: e.value })}
                      placeholder="All Products"
                      display="chip"
                    />
                  </div>
                </div>
              </div>

              <div className="output-section">
                <h4>Output Options</h4>
                <div className="p-fluid formgrid grid">
                  <div className="p-field field col-12 md:col-6">
                    <label>Output Format</label>
                    <div className="format-options">
                      <div className="p-field-radiobutton field-radiobutton">
                        <RadioButton inputId="csv" value="csv" onChange={(e) => setReportParams({ ...reportParams, outputFormat: e.value })} checked={reportParams.outputFormat === 'csv'} />
                        <label htmlFor="csv">CSV</label>
                      </div>
                    </div>
                  </div>
                  <div className="p-field field col-12 md:col-6">
                    <label>Report Layout</label>
                    <Dropdown
                      value={reportParams.reportLayout}
                      options={[
                        { label: "Summary", value: "Summary" },
                        { label: "Detailed", value: "Detailed" },
                        { label: "Consolidated", value: "Consolidated" }
                      ]}
                      onChange={(e) => setReportParams({ ...reportParams, reportLayout: e.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="action-buttons">
                <Button label="Preview" icon="pi pi-eye" className="p-button-secondary mr-2" onClick={handlePreview} disabled={busy} />
                <Button label="Generate Report" icon="pi pi-file" className="p-button-primary mr-2" onClick={handleGenerate} loading={busy} />
                <Button label="Schedule" icon="pi pi-calendar" className="p-button-secondary mr-2" onClick={handleSchedule} disabled={busy} />
                <Button label="Email" icon="pi pi-send" className="p-button-secondary" onClick={handleEmail} disabled={busy} />
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a report from the categories to configure parameters</p>
            </div>
          )}
        </Card>

        <Card title="Recent Reports" className="right-panel">
          <div className="recent-section">
            <h4>Recently Generated</h4>
            {recentReports.map((report) => (
              <div key={report.id} className="recent-item">
                <div className="item-info">
                  <div className="item-name">{report.name} - {report.period}</div>
                  <div className="item-meta">{report.createdDate} • {report.fileSize}</div>
                </div>
                <div className="item-actions">
                  <Button icon="pi pi-download" className="p-button-text p-button-sm" onClick={() => window.open(report.fileUrl, "_blank", "noopener")} />
                </div>
              </div>
            ))}
          </div>

          <div className="scheduled-section mt-3">
            <h4>Scheduled Reports</h4>
            {scheduledReports.map((report) => (
              <div key={report.id} className="scheduled-item">
                <div className="item-info">
                  <div className="item-name">{report.name}</div>
                  <div className="item-meta">{report.frequency} • Next: {report.nextRun} • {report.status}</div>
                </div>
                <div className="item-actions">
                  <Button icon="pi pi-pencil" className="p-button-text p-button-sm"
                    onClick={() => navigate(`${SCHEDULE_ROUTE}/edit`, { state: { data: report, mode: "edit" } })} />
                  <Button icon={report.status === "Active" ? "pi pi-pause" : "pi pi-play"} className="p-button-text p-button-sm" onClick={() => pauseSchedule(report)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RemittanceReports;
