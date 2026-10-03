import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { TabView, TabPanel } from "primereact/tabview";
import { Steps } from "primereact/steps";
import { RadioButton } from "primereact/radiobutton";
import SvgAdd from "../../../assets/icons/SvgAdd";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgEyeIcon from "../../../assets/icons/SvgEyeIcon";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import InputField from "../../../components/InputField";
import incentiveService from "../../../services/incentiveService";
import { isoDate, showError, showSuccess } from "../../Remittance/shared";
import { calendarDateFormat, formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";

/** Report parameters keyed the way the API reads them (period, program, topN, from / to). */
const toApiParameters = (params) => Object.fromEntries(Object.entries(params).flatMap(([key, value]) => {
  if (value === "" || value === null || value === undefined) return [];
  const name = key.toLowerCase();
  if (Array.isArray(value)) return [[`${name.replace(/\s+/g, "")}From`, isoDate(value[0])], [`${name.replace(/\s+/g, "")}To`, isoDate(value[1])]];
  if (value instanceof Date) return [[name.replace(/\s+/g, ""), isoDate(value)]];
  if (name === "top n") return [["topN", value]];
  return [[name.replace(/\s+/g, ""), value]];
}));

const Reports = () => {
  const { t } = useTranslation();
  const toast = useRef(null);

  // State management
  const [reportTemplates, setReportTemplates] = useState([]);
  const [programOptions, setProgramOptions] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(false);

  // Report generation state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [reportParameters, setReportParameters] = useState({});
  const [reportFormat, setReportFormat] = useState("PDF");

  // Generated reports history
  const [generatedReports, setGeneratedReports] = useState([]);

  // Options
  const categoryOptions = [
    { label: "All Categories", value: "All" },
    ...[...new Set(reportTemplates.map((tpl) => tpl.category).filter(Boolean))].map((c) => ({ label: c, value: c }))
  ];

  // Breadcrumb items
  const items = [
    { label: t("incentive.incentive") },
    { label: t("incentive.reports", { defaultValue: "Reports" }), url: "/incentive/reports" }
  ];

  const home = { label: t("sidebar.Accounts") };

  // Steps for report generation
  const generationSteps = [
    { label: "Select Template" },
    { label: "Configure Parameters" },
    { label: "Format" },
    { label: "Review & Generate" }
  ];

  // Initialize data
  useEffect(() => {
    loadReports();
    incentiveService.reportTemplates().then(setReportTemplates).catch((error) => showError(toast, error));
    incentiveService.listPrograms()
      .then((rows) => setProgramOptions(rows.map((p) => ({ label: p.programName, value: p.programCode }))))
      .catch((error) => showError(toast, error));
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const rows = await incentiveService.listReports();
      setGeneratedReports((rows || []).map((r) => ({
        id: r.reportId,
        reportName: `${r.reportType} - ${formatAppDate(r.generatedDate)}`,
        template: r.reportType,
        generatedDate: r.generatedDate,
        generatedBy: r.generatedBy,
        format: "CSV",
        status: r.status === "done" ? "Completed" : r.status,
        fileSize: `${r.rowCount} rows`,
        downloadCount: "-",
        fileUrl: r.fileUrl
      })));
    } catch (error) {
      showError(toast, error, 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  // Filter data
  const filteredTemplates = reportTemplates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(search.toLowerCase()) ||
                         String(template.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle report generation
  const handleGenerateReport = () => {
    setGenerationStep(0);
    setSelectedTemplate(null);
    setReportParameters({});
    setReportFormat("PDF");
    setShowGenerateDialog(true);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);

    // Initialize parameters based on template
    const initialParams = {};
    (template.parameters || []).forEach(param => {
      initialParams[param] = "";
    });
    setReportParameters(initialParams);
    setReportFormat((template.formats || [])[0] || "CSV");

    handleNextStep();
  };

  const handleNextStep = () => {
    if (generationStep < generationSteps.length - 1) {
      setGenerationStep(generationStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (generationStep > 0) {
      setGenerationStep(generationStep - 1);
    }
  };

  const handleGenerateSubmit = async () => {
    setLoading(true);
    try {
      const result = await incentiveService.generateReport({
        templateId: selectedTemplate.id,
        parameters: toApiParameters(reportParameters),
        format: reportFormat
      });
      setShowGenerateDialog(false);
      showSuccess(toast, `${result.reportType}: ${result.rowCount} row(s)`, "Report Ready");
      window.open(result.fileUrl, "_blank", "noopener");
      await loadReports();
    } catch (error) {
      showError(toast, error, "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  // Handle download
  const handleDownload = (report) => {
    window.open(report.fileUrl, "_blank", "noopener");
  };

  // Handle view
  const handleViewReport = (report) => {
    window.open(report.fileUrl, "_blank", "noopener");
  };
  // Template functions
  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case "Completed": return "success";
        case "Generating": return "warning";
        case "Failed": return "danger";
        default: return "info";
      }
    };

    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const formatBodyTemplate = (rowData) => {
    const getIcon = (format) => {
      switch (format) {
        case "PDF": return "pi pi-file-pdf";
        case "Excel": return "pi pi-file-excel";
        default: return "pi pi-file";
      }
    };

    return (
      <div className="format-cell">
        <i className={getIcon(rowData.format)}></i>
        <span>{rowData.format}</span>
      </div>
    );
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon={<SvgEyeIcon />}
          className="view-button"
          onClick={() => handleViewReport(rowData)}
          tooltip="View Report"
          disabled={rowData.status !== "Completed"} aria-label="View Report"
        />
        <Button
          icon="pi pi-download"
          className="download-button"
          onClick={() => handleDownload(rowData)}
          tooltip="Download"
          disabled={rowData.status !== "Completed"} aria-label="Download"
        />
      </div>
    );
  };

  const templateActionTemplate = (rowData) => {
    return (
      <Button
        label="Generate"
        icon="pi pi-play"
        className="generate-button"
        onClick={() => handleTemplateSelect(rowData)}
      />
    );
  };

  // Dialog footer
  const generateDialogFooter = (
    <div className="dialog-footer">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setShowGenerateDialog(false)}
      />
      {generationStep > 0 && (
        <Button
          label="Previous"
          icon="pi pi-arrow-left"
          className="p-button-secondary"
          onClick={handlePrevStep}
        />
      )}
      {generationStep < generationSteps.length - 1 ? (
        <Button
          label="Next"
          icon="pi pi-arrow-right"
          onClick={handleNextStep}
          disabled={!selectedTemplate}
        />
      ) : (
        <Button
          label="Generate Report"
          icon="pi pi-play"
          onClick={handleGenerateSubmit}
          loading={loading}
        />
      )}
    </div>
  );

  return (
    <div className="container__reports">
      <Toast ref={toast} />

      {/* Header */}
      <div className="top__container">
        <div className="page__title">{t("incentive.incentiveReports")}</div>
        <div className="add-button-container">
          <Button
            icon={<div className="pr-2"><SvgAdd /></div>}
            className="main__btn__action"
            onClick={handleGenerateReport} aria-label="Add" tooltip="Add" tooltipOptions={{ position: "top" }} >
            Generate Report
          </Button>
        </div>
        <BreadCrumb
          home={home}
          className="breadCrums__view__reversal"
          model={items}
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>

      {/* Content */}
      <div className="content-container">
        <TabView>
          <TabPanel header="Report Templates">
            <Card>
              {/* Filter Section */}
              <div className="filter-section">
                <div className="filter-row">
                  <div className="filter-field">
                    <label>Search Templates</label>
                    <InputField
                      placeholder="Search by name or description..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      icon={<SvgSearchIcon />}
                    />
                  </div>
                  <div className="filter-field">
                    <label>Category</label>
                    <Dropdown
                      value={selectedCategory}
                      options={categoryOptions}
                      onChange={(e) => setSelectedCategory(e.value)}
                      placeholder="Select category"
                    />
                  </div>
                </div>
              </div>

              {/* Templates Grid */}
              <div className="templates-grid">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="template-card">
                    <div className="template-header">
                      <h4>{template.name}</h4>
                      <Tag value={template.category} />
                    </div>
                    <div className="template-description">
                      <p>{template.description}</p>
                    </div>
                    <div className="template-details">
                      <div className="detail-item">
                        <strong>Parameters:</strong> {template.parameters.join(", ")}
                      </div>
                      <div className="detail-item">
                        <strong>Formats:</strong> {template.formats.join(", ")}
                      </div>
                    </div>
                    <div className="template-actions">
                      {templateActionTemplate(template)}
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabPanel>

          <TabPanel header="Generated Reports">
            <Card>
              <div className="section-header">
                <h3>Report History</h3>
                <Button
                  icon="pi pi-refresh"
                  className="p-button-text"
                  onClick={loadReports}
                  tooltip="Refresh" aria-label="Refresh"
                />
              </div>

              <DataTable
                value={generatedReports}
                className="reports-table"
                stripedRows
                paginator
                rows={20}
                loading={loading}
                emptyMessage="No reports generated yet"
              >
                <Column field="reportName" header="Report Name" style={{ width: "30%" }} />
                <Column field="template" header="Template" style={{ width: "15%" }} />
                <Column
                  field="generatedDate"
                  header="Generated Date"
                  style={{ width: "12%" }}
                  body={(data) => formatAppDate(data.generatedDate)}
                />
                <Column field="generatedBy" header="Generated By" style={{ width: "12%" }} />
                <Column
                  body={formatBodyTemplate}
                  header="Format"
                  style={{ width: "8%" }}
                />
                <Column field="fileSize" header="File Size" style={{ width: "8%" }} />
                <Column
                  field="downloadCount"
                  header="Downloads"
                  style={{ width: "8%", textAlign: "center" }}
                />
                <Column
                  body={statusBodyTemplate}
                  header="Status"
                  style={{ width: "8%" }}
                />
                <Column
                  body={actionBodyTemplate}
                  header="Actions"
                  style={{ width: "10%" }}
                />
              </DataTable>
            </Card>
          </TabPanel>
        </TabView>
      </div>

      {/* Generate Report Dialog */}
      <Dialog
        header="Generate Incentive Report"
        visible={showGenerateDialog}
        onHide={() => setShowGenerateDialog(false)}
        style={{ width: '70vw', maxWidth: '800px' }}
        footer={generateDialogFooter}
        maximizable
      >
        <div className="generation-wizard">
          <Steps model={generationSteps} activeIndex={generationStep} />

          <div className="step-content">
            {generationStep === 0 && (
              <div className="step-panel">
                <h3>Select Report Template</h3>
                <div className="templates-selection">
                  {reportTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`template-option ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="template-info">
                        <h4>{template.name}</h4>
                        <p>{template.description}</p>
                        <Tag value={template.category} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {generationStep === 1 && selectedTemplate && (
              <div className="step-panel">
                <h3>Configure Parameters</h3>
                <div className="parameters-form">
                  {selectedTemplate.parameters.map((param) => (
                    <div key={param} className="parameter-field">
                      <label>{param}:</label>
                      {param.toLowerCase().includes('date') ? (
                        <Calendar
                          dateFormat={calendarDateFormat()}
                          value={reportParameters[param]}
                          onChange={(e) => setReportParameters({
                            ...reportParameters,
                            [param]: e.value
                          })}
                          placeholder={`Select ${param.toLowerCase()}`}
                          selectionMode={param.toLowerCase().includes('range') ? 'range' : 'single'}
                        />
                      ) : param.toLowerCase().includes('program') ? (
                        <Dropdown
                          value={reportParameters[param]}
                          options={programOptions}
                          onChange={(e) => setReportParameters({
                            ...reportParameters,
                            [param]: e.value
                          })}
                          placeholder="All programs"
                          showClear
                        />
                      ) : (
                        <InputText
                          value={reportParameters[param]}
                          onChange={(e) => setReportParameters({
                            ...reportParameters,
                            [param]: e.target.value
                          })}
                          placeholder={`Enter ${param.toLowerCase()}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {generationStep === 2 && (
              <div className="step-panel">
                <h3>Format</h3>
                <div className="format-schedule-form">
                  <div className="format-section">
                    <h4>Output Format</h4>
                    <div className="format-options">
                      {(selectedTemplate?.formats || []).map((format) => (
                        <div key={format} className="format-option">
                          <RadioButton
                            inputId={format}
                            name="format"
                            value={format}
                            onChange={(e) => setReportFormat(e.value)}
                            checked={reportFormat === format}
                          />
                          <label htmlFor={format}>{format}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {generationStep === 3 && (
              <div className="step-panel">
                <h3>Review & Generate</h3>
                <div className="review-section">
                  <div className="review-item">
                    <label>Template:</label>
                    <span>{selectedTemplate?.name}</span>
                  </div>
                  <div className="review-item">
                    <label>Format:</label>
                    <span>{reportFormat}</span>
                  </div>
                  <div className="review-item">
                    <label>Parameters:</label>
                    <div className="parameters-review">
                      {Object.entries(reportParameters).map(([key, value]) => (
                        <div key={key} className="param-review">
                          <strong>{key}:</strong> {(Array.isArray(value) ? value.map((v) => isoDate(v)).join(" - ") : value instanceof Date ? isoDate(value) : value?.toString()) || "Not specified"}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="generation-note">
                  <i className="pi pi-info-circle"></i>
                  <p>The report will be generated and made available for download. You will receive a notification when it's ready.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Reports;