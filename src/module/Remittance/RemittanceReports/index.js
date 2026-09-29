import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { Tree } from "primereact/tree";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { MultiSelect } from "primereact/multiselect";
import { RadioButton } from "primereact/radiobutton";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import "./index.scss";

const RemittanceReports = () => {
  const { t } = useTranslation();
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportParams, setReportParams] = useState({
    reportPeriod: [null, null],
    insurer: [],
    branch: [],
    productLine: [],
    outputFormat: "pdf",
    reportLayout: "Detailed",
    includeCharts: true,
    orientation: "Portrait"
  });

  const reportCategories = [
    {
      key: "0",
      label: "Operational Reports",
      icon: "pi pi-folder",
      children: [
        { key: "0-0", label: "Daily Remittance Summary", data: { code: "RPT001" } },
        { key: "0-1", label: "Processing Status Report", data: { code: "RPT007" } },
        { key: "0-2", label: "Pending Remittances", data: { code: "RPT008" } }
      ]
    },
    {
      key: "1",
      label: "Financial Reports",
      icon: "pi pi-folder",
      children: [
        { key: "1-0", label: "Monthly Settlement Report", data: { code: "RPT002" } },
        { key: "1-1", label: "Aging Analysis", data: { code: "RPT005" } },
        { key: "1-2", label: "Commission Summary", data: { code: "RPT009" } },
        { key: "1-3", label: "Cash Flow Report", data: { code: "RPT010" } }
      ]
    },
    {
      key: "2",
      label: "Analytical Reports",
      icon: "pi pi-folder",
      children: [
        { key: "2-0", label: "Commission Analysis", data: { code: "RPT003" } },
        { key: "2-1", label: "Trend Analysis", data: { code: "RPT011" } },
        { key: "2-2", label: "Comparative Analysis", data: { code: "RPT012" } }
      ]
    },
    {
      key: "3",
      label: "Control Reports",
      icon: "pi pi-folder",
      children: [
        { key: "3-0", label: "Exception Report", data: { code: "RPT004" } },
        { key: "3-1", label: "Audit Trail Report", data: { code: "RPT013" } },
        { key: "3-2", label: "Reconciliation Report", data: { code: "RPT014" } }
      ]
    }
  ];

  const recentReports = [
    { name: "Monthly Settlement - Sep 2025", date: "2025-09-26 09:30", size: "2.3 MB" },
    { name: "Daily Remittance - 26 Sep", date: "2025-09-26 08:00", size: "1.1 MB" },
    { name: "Commission Analysis Q3", date: "2025-09-25 16:45", size: "3.5 MB" }
  ];

  const scheduledReports = [
    { name: "Daily Remittance Summary", frequency: "Daily", nextRun: "2025-09-27 08:00" },
    { name: "Weekly Exception Report", frequency: "Weekly", nextRun: "2025-09-30 09:00" },
    { name: "Monthly Settlement Report", frequency: "Monthly", nextRun: "2025-10-01 06:00" }
  ];

  return (
    <div className="remittance-reports">
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
          {selectedReport && Object.keys(selectedReport).length > 0 ? (
            <div className="report-params">
              <div className="report-info">
                <h4>Selected Report</h4>
                <p>Daily Remittance Summary</p>
                <p className="text-muted">Generate daily summary of all remittance transactions</p>
              </div>

              <div className="param-section">
                <h4>{t("remittanceReports.reportParameters")}</h4>
                <div className="p-fluid">
                  <div className="p-field">
                    <label>{t("remittanceReports.reportPeriod")} *</label>
                    <Calendar
                      value={reportParams.reportPeriod}
                      onChange={(e) => setReportParams({ ...reportParams, reportPeriod: e.value })}
                      selectionMode="range"
                      placeholder={t("remittanceReports.selectDateRange")}
                    />
                  </div>
                  <div className="p-field">
                    <label>{t("remittanceReports.insurer")}</label>
                    <MultiSelect
                      value={reportParams.insurer}
                      options={[
                        { label: "ABC Insurance", value: "ABC" },
                        { label: "XYZ Life", value: "XYZ" },
                        { label: "Global Health", value: "GH" }
                      ]}
                      onChange={(e) => setReportParams({ ...reportParams, insurer: e.value })}
                      placeholder={t("remittanceReports.allInsurers")}
                      display="chip"
                    />
                  </div>
                  <div className="p-field">
                    <label>{t("remittanceReports.branch")}</label>
                    <MultiSelect
                      value={reportParams.branch}
                      options={[
                        { label: "Head Office", value: "HO" },
                        { label: "North Region", value: "NR" },
                        { label: "South Region", value: "SR" }
                      ]}
                      onChange={(e) => setReportParams({ ...reportParams, branch: e.value })}
                      placeholder={t("remittanceReports.allBranches")}
                      display="chip"
                    />
                  </div>
                  <div className="p-field">
                    <label>Product Line</label>
                    <MultiSelect
                      value={reportParams.productLine}
                      options={[
                        { label: "Motor", value: "Motor" },
                        { label: "Fire and Allied Perils", value: "Fire and Allied Perils" },
                        { label: "Health", value: "Health" },
                        { label: "Life", value: "Life" },
                        { label: "Property", value: "Property" }
                      ]}
                      onChange={(e) => setReportParams({ ...reportParams, productLine: e.value })}
                      placeholder="All Products"
                      display="chip"
                    />
                  </div>
                </div>
              </div>

              <div className="output-section">
                <h4>Output Options</h4>
                <div className="p-fluid p-formgrid p-grid">
                  <div className="p-field p-col-12 p-md-6">
                    <label>Output Format</label>
                    <div className="format-options">
                      <div className="p-field-radiobutton">
                        <RadioButton inputId="pdf" value="pdf" onChange={(e) => setReportParams({ ...reportParams, outputFormat: e.value })} checked={reportParams.outputFormat === 'pdf'} />
                        <label htmlFor="pdf">PDF</label>
                      </div>
                      <div className="p-field-radiobutton">
                        <RadioButton inputId="excel" value="excel" onChange={(e) => setReportParams({ ...reportParams, outputFormat: e.value })} checked={reportParams.outputFormat === 'excel'} />
                        <label htmlFor="excel">Excel</label>
                      </div>
                      <div className="p-field-radiobutton">
                        <RadioButton inputId="csv" value="csv" onChange={(e) => setReportParams({ ...reportParams, outputFormat: e.value })} checked={reportParams.outputFormat === 'csv'} />
                        <label htmlFor="csv">CSV</label>
                      </div>
                    </div>
                  </div>
                  <div className="p-field p-col-12 p-md-6">
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
                  {reportParams.outputFormat === 'pdf' && (
                    <>
                      <div className="p-field p-col-12 p-md-6">
                        <label>Include Charts</label>
                        <Checkbox
                          checked={reportParams.includeCharts}
                          onChange={(e) => setReportParams({ ...reportParams, includeCharts: e.checked })}
                        />
                      </div>
                      <div className="p-field p-col-12 p-md-6">
                        <label>Page Orientation</label>
                        <Dropdown
                          value={reportParams.orientation}
                          options={[
                            { label: "Portrait", value: "Portrait" },
                            { label: "Landscape", value: "Landscape" }
                          ]}
                          onChange={(e) => setReportParams({ ...reportParams, orientation: e.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="action-buttons">
                <Button label="Preview" icon="pi pi-eye" className="p-button-secondary mr-2" />
                <Button label="Generate Report" icon="pi pi-file" className="p-button-primary mr-2" />
                <Button label="Schedule" icon="pi pi-calendar" className="p-button-secondary mr-2" />
                <Button label="Email" icon="pi pi-send" className="p-button-secondary" />
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
            {recentReports.map((report, index) => (
              <div key={index} className="recent-item">
                <div className="item-info">
                  <div className="item-name">{report.name}</div>
                  <div className="item-meta">{report.date} • {report.size}</div>
                </div>
                <div className="item-actions">
                  <Button icon="pi pi-download" className="p-button-text p-button-sm" />
                  <Button icon="pi pi-eye" className="p-button-text p-button-sm" />
                </div>
              </div>
            ))}
          </div>

          <div className="scheduled-section mt-3">
            <h4>Scheduled Reports</h4>
            {scheduledReports.map((report, index) => (
              <div key={index} className="scheduled-item">
                <div className="item-info">
                  <div className="item-name">{report.name}</div>
                  <div className="item-meta">{report.frequency} • Next: {report.nextRun}</div>
                </div>
                <div className="item-actions">
                  <Button icon="pi pi-pencil" className="p-button-text p-button-sm" />
                  <Button icon="pi pi-pause" className="p-button-text p-button-sm" />
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
