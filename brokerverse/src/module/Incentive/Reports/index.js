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
import { MultiSelect } from "primereact/multiselect";
import { ProgressBar } from "primereact/progressbar";
import { Steps } from "primereact/steps";
import { RadioButton } from "primereact/radiobutton";
import { Checkbox } from "primereact/checkbox";
import { useNavigate } from "react-router-dom";
import SvgAdd from "../../../assets/icons/SvgAdd";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgEyeIcon from "../../../assets/icons/SvgEyeIcon";
import SvgSearchIcon from "../../../assets/icons/SvgSearchIcon";
import InputField from "../../../components/InputField";
import { incentiveMockData, incentiveCrudOperations } from "../../../services/mockData/incentiveMockData";
import "./index.scss";

const Reports = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);

  // State management
  const [reports, setReports] = useState([]);
  const [reportTemplates, setReportTemplates] = useState(incentiveMockData.reportTemplates);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(false);

  // Report generation state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [reportParameters, setReportParameters] = useState({});
  const [reportFormat, setReportFormat] = useState("PDF");
  const [reportSchedule, setReportSchedule] = useState({
    isScheduled: false,
    frequency: "",
    time: null,
    recipients: []
  });

  // Generated reports history
  const [generatedReports, setGeneratedReports] = useState([
    {
      id: 1,
      reportName: "Monthly Payout Summary - January 2025",
      template: "Monthly Payout Summary",
      generatedDate: "2025-02-01",
      generatedBy: "System Admin",
      format: "PDF",
      status: "Completed",
      fileSize: "2.5 MB",
      downloadCount: 15
    },
    {
      id: 2,
      reportName: "Agent Payout Details - Q4 2024",
      template: "Agent Payout Details",
      generatedDate: "2025-01-15",
      generatedBy: "Finance Manager",
      format: "Excel",
      status: "Completed",
      fileSize: "8.7 MB",
      downloadCount: 8
    },
    {
      id: 3,
      reportName: "Target Achievement Report - December 2024",
      template: "Target Achievement Report",
      generatedDate: "2025-01-05",
      generatedBy: "System Admin",
      format: "PDF",
      status: "Completed",
      fileSize: "1.2 MB",
      downloadCount: 23
    }
  ]);

  // Options
  const categoryOptions = [
    { label: "All Categories", value: "All" },
    { label: "Payout Reports", value: "Payout Reports" },
    { label: "Performance Reports", value: "Performance Reports" },
    { label: "Program Analysis", value: "Program Analysis" }
  ];

  const formatOptions = [
    { label: "PDF", value: "PDF" },
    { label: "Excel", value: "Excel" }
  ];

  const frequencyOptions = [
    { label: "Daily", value: "Daily" },
    { label: "Weekly", value: "Weekly" },
    { label: "Monthly", value: "Monthly" },
    { label: "Quarterly", value: "Quarterly" }
  ];

  // Breadcrumb items
  const items = [
    { label: "Incentive", url: "/incentive" },
    { label: "Reports", url: "/incentive/reports" }
  ];

  const home = { label: "Dashboard" };

  // Steps for report generation
  const generationSteps = [
    { label: "Select Template" },
    { label: "Configure Parameters" },
    { label: "Format & Schedule" },
    { label: "Review & Generate" }
  ];

  // Initialize data
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      // In a real application, this would fetch from API
      setReports(generatedReports);

      toast.current.show({
        severity: 'success',
        summary: 'Data Loaded',
        detail: 'Report templates and history loaded successfully',
        life: 3000
      });
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load report data',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter data
  const filteredTemplates = reportTemplates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(search.toLowerCase()) ||
                         template.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle report generation
  const handleGenerateReport = () => {
    setGenerationStep(0);
    setSelectedTemplate(null);
    setReportParameters({});
    setReportFormat("PDF");
    setReportSchedule({
      isScheduled: false,
      frequency: "",
      time: null,
      recipients: []
    });
    setShowGenerateDialog(true);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);

    // Initialize parameters based on template
    const initialParams = {};
    template.parameters.forEach(param => {
      initialParams[param] = "";
    });
    setReportParameters(initialParams);

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
      const result = await incentiveCrudOperations.generateReport(
        selectedTemplate.id,
        {
          parameters: reportParameters,
          format: reportFormat,
          schedule: reportSchedule
        }
      );

      const newReport = {
        id: Date.now(),
        reportName: `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
        template: selectedTemplate.name,
        generatedDate: new Date().toISOString().split('T')[0],
        generatedBy: "Current User",
        format: reportFormat,
        status: "Generating",
        fileSize: "Processing...",
        downloadCount: 0
      };

      setGeneratedReports([newReport, ...generatedReports]);
      setShowGenerateDialog(false);

      toast.current.show({
        severity: "success",
        summary: "Report Generation Started",
        detail: `Report "${selectedTemplate.name}" is being generated`,
        life: 5000
      });

      // Simulate report completion
      setTimeout(() => {
        setGeneratedReports(prev => prev.map(r =>
          r.id === newReport.id
            ? { ...r, status: "Completed", fileSize: "1.5 MB" }
            : r
        ));
        toast.current.show({
          severity: "success",
          summary: "Report Ready",
          detail: `Report "${selectedTemplate.name}" is ready for download`,
          life: 3000
        });
      }, 3000);
    } catch (error) {
      toast.current.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to generate report",
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle download
  const handleDownload = (report) => {
    toast.current.show({
      severity: "info",
      summary: "Download Started",
      detail: `Downloading ${report.reportName}...`,
      life: 3000
    });

    // Update download count
    setGeneratedReports(prev => prev.map(r =>
      r.id === report.id ? { ...r, downloadCount: r.downloadCount + 1 } : r
    ));
  };

  // Handle view
  const handleViewReport = (report) => {
    toast.current.show({
      severity: "info",
      summary: "Opening Report",
      detail: `Opening ${report.reportName} in new tab...`,
      life: 3000
    });
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
          disabled={rowData.status !== "Completed"}
        />
        <Button
          icon="pi pi-download"
          className="download-button"
          onClick={() => handleDownload(rowData)}
          tooltip="Download"
          disabled={rowData.status !== "Completed"}
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
            onClick={handleGenerateReport}
          >
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
                  tooltip="Refresh"
                />
              </div>

              <DataTable
                value={generatedReports}
                className="reports-table"
                stripedRows
                paginator
                rows={10}
                loading={loading}
                emptyMessage="No reports generated yet"
              >
                <Column field="reportName" header="Report Name" style={{ width: "30%" }} />
                <Column field="template" header="Template" style={{ width: "15%" }} />
                <Column
                  field="generatedDate"
                  header="Generated Date"
                  style={{ width: "12%" }}
                  body={(data) => new Date(data.generatedDate).toLocaleDateString()}
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
                          value={reportParameters[param]}
                          onChange={(e) => setReportParameters({
                            ...reportParameters,
                            [param]: e.value
                          })}
                          placeholder={`Select ${param.toLowerCase()}`}
                          selectionMode={param.toLowerCase().includes('range') ? 'range' : 'single'}
                        />
                      ) : param.toLowerCase().includes('program') ? (
                        <MultiSelect
                          value={reportParameters[param]}
                          options={incentiveMockData.programs.map(p => ({ label: p.programName, value: p.programCode }))}
                          onChange={(e) => setReportParameters({
                            ...reportParameters,
                            [param]: e.value
                          })}
                          placeholder="Select programs"
                          display="chip"
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
                <h3>Format & Schedule</h3>
                <div className="format-schedule-form">
                  <div className="format-section">
                    <h4>Output Format</h4>
                    <div className="format-options">
                      {selectedTemplate?.formats.map((format) => (
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

                  <div className="schedule-section">
                    <h4>Schedule Options</h4>
                    <div className="schedule-option">
                      <Checkbox
                        inputId="scheduled"
                        checked={reportSchedule.isScheduled}
                        onChange={(e) => setReportSchedule({
                          ...reportSchedule,
                          isScheduled: e.checked
                        })}
                      />
                      <label htmlFor="scheduled">Schedule recurring generation</label>
                    </div>

                    {reportSchedule.isScheduled && (
                      <div className="schedule-details">
                        <div className="schedule-field">
                          <label>Frequency:</label>
                          <Dropdown
                            value={reportSchedule.frequency}
                            options={frequencyOptions}
                            onChange={(e) => setReportSchedule({
                              ...reportSchedule,
                              frequency: e.value
                            })}
                            placeholder="Select frequency"
                          />
                        </div>
                        <div className="schedule-field">
                          <label>Time:</label>
                          <Calendar
                            value={reportSchedule.time}
                            onChange={(e) => setReportSchedule({
                              ...reportSchedule,
                              time: e.value
                            })}
                            timeOnly
                            placeholder="Select time"
                          />
                        </div>
                      </div>
                    )}
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
                          <strong>{key}:</strong> {value?.toString() || "Not specified"}
                        </div>
                      ))}
                    </div>
                  </div>
                  {reportSchedule.isScheduled && (
                    <div className="review-item">
                      <label>Schedule:</label>
                      <span>{reportSchedule.frequency} at {reportSchedule.time?.toLocaleTimeString()}</span>
                    </div>
                  )}
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