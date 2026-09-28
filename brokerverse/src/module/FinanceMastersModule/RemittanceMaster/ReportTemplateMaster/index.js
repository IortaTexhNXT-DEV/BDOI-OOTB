import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { Checkbox } from "primereact/checkbox";
import { Calendar } from "primereact/calendar";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Toast } from "primereact/toast";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import remittanceService from "../../../../services/remittanceService";
import { showError } from "../../../Remittance/shared";
import { saveAndReturn } from "../masterRecord";
import "./index.scss";

const ReportTemplateMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = React.useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedReports, setGeneratedReports] = useState([]);

  useEffect(() => {
    if (!data?.code) return;
    remittanceService.listReports()
      .then((rows) => setGeneratedReports((rows || []).filter((r) => r.templateCode === data.code)))
      .catch((error) => showError(toast, error));
  }, [data]);

  const [formData, setFormData] = useState({
    reportCode: "",
    reportName: "",
    reportCategory: "Operational",
    reportType: "Tabular",
    frequency: "Daily",
    format: "PDF",
    enableSchedule: false,
    runTime: null,
    startDate: null,
    emailRecipients: "",
    outputFormats: ["PDF"]
  });

  const categoryOptions = [
    { label: "Operational", value: "Operational" },
    { label: "Financial", value: "Financial" },
    { label: "Analytical", value: "Analytical" },
    { label: "Compliance", value: "Compliance" }
  ];

  const frequencyOptions = [
    { label: "Daily", value: "Daily" },
    { label: "Weekly", value: "Weekly" },
    { label: "Monthly", value: "Monthly" },
    { label: "Quarterly", value: "Quarterly" }
  ];

  const formatOptions = [
    { label: "PDF", value: "PDF" },
    { label: "Excel", value: "Excel" },
    { label: "CSV", value: "CSV" }
  ];

  const items = [
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Report Templates", url: "#" },
  ];

  const home = { label: "Master" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      if (data) {
        const formats = Array.isArray(data.format) ? data.format : [data.format].filter(Boolean);
        setFormData((prev) => ({
          ...prev,
          reportCategory: data.category || prev.reportCategory,
          frequency: data.frequency || prev.frequency,
          format: formats[0] || prev.format,
          emailRecipients: data.distribution?.email?.join(", ") || "",
          outputFormats: formats.length ? formats : prev.outputFormats,
          ...(data.form || {}),
          runTime: data.form?.runTime ? new Date(data.form.runTime) : null,
          startDate: data.form?.startDate ? new Date(data.form.startDate) : null,
          reportCode: data.code,
          reportName: data.name,
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        reportCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 1000);
    return `RPT-${String(random).padStart(3, '0')}`;
  };

  const handleSave = async () => {
    setIsLoading(true);
    await saveAndReturn({
      type: "remittance-report-template",
      id: data?.id,
      toast,
      navigate,
      record: {
        code: formData.reportCode,
        name: formData.reportName,
        category: formData.reportCategory,
        frequency: formData.frequency,
        format: formData.outputFormats,
        distribution: { email: formData.emailRecipients.split(",").map((e) => e.trim()).filter(Boolean) },
        form: formData
      }
    });
    setIsLoading(false);
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  return (
    <div className="report-template-master">
      <Toast ref={toast} />

      <div className="page-header">
        <BreadCrumb model={items} home={home} />
      </div>

      <Card className="main-card">
        <div className="card-header">
          <h3>Report Template Master</h3>
          <div className="header-actions">
            <Button
              label={t("financeMasters.save")}
              icon="pi pi-save"
              className="p-button-sm p-button-success"
              onClick={handleSave}
              disabled={mode === "view"}
              loading={isLoading}
            />
            <Button
              label={t("common.cancel")}
              icon="pi pi-times"
              className="p-button-sm p-button-secondary"
              onClick={handleCancel}
            />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header="Template Configuration">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Report Details
              </h4>
              <div className="form-grid three-column">
                <div className="form-field">
                  <label htmlFor="reportCode">Report Code *</label>
                  <InputText
                    id="reportCode"
                    value={formData.reportCode}
                    onChange={(e) => setFormData({ ...formData, reportCode: e.target.value })}
                    disabled={mode === "edit" || mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="reportName">Report Name *</label>
                  <InputText
                    id="reportName"
                    value={formData.reportName}
                    onChange={(e) => setFormData({ ...formData, reportName: e.target.value })}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="reportCategory">Category</label>
                  <Dropdown
                    id="reportCategory"
                    value={formData.reportCategory}
                    options={categoryOptions}
                    onChange={(e) => setFormData({ ...formData, reportCategory: e.value })}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="frequency">Frequency</label>
                  <Dropdown
                    id="frequency"
                    value={formData.frequency}
                    options={frequencyOptions}
                    onChange={(e) => setFormData({ ...formData, frequency: e.value })}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="format">Output Format</label>
                  <Dropdown
                    id="format"
                    value={formData.format}
                    options={formatOptions}
                    onChange={(e) => setFormData({ ...formData, format: e.value })}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="enableSchedule"
                    checked={formData.enableSchedule}
                    onChange={(e) => setFormData({ ...formData, enableSchedule: e.checked })}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="enableSchedule" className="ml-2">Enable Scheduling</label>
                </div>
              </div>

              {formData.enableSchedule && (
                <>
                  <h4 className="section-title mt-4">
                    <SvgDot />
                    Schedule Settings
                  </h4>
                  <div className="form-grid two-column">
                    <div className="form-field">
                      <label htmlFor="runTime">Run Time</label>
                      <Calendar
                        id="runTime"
                        value={formData.runTime}
                        onChange={(e) => setFormData({ ...formData, runTime: e.value })}
                        timeOnly
                        hourFormat="24"
                        disabled={mode === "view"}
                        className="w-full"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="emailRecipients">Email Recipients</label>
                      <InputText
                        id="emailRecipients"
                        value={formData.emailRecipients}
                        onChange={(e) => setFormData({ ...formData, emailRecipients: e.target.value })}
                        disabled={mode === "view"}
                        className="w-full"
                        placeholder={t("remittance.emailAddressesCommas")}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabPanel>

          <TabPanel header="Generated Reports">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Recent Generated Reports
              </h4>
              <DataTable
                value={generatedReports}
                responsiveLayout="scroll"
                className="mt-3"
                emptyMessage="No reports generated"
                showGridlines
              >
                <Column
                  field="templateCode"
                  header="Template Code"
                  style={{ width: '15%' }}
                />
                <Column
                  field="generatedOn"
                  header="Generated On"
                  style={{ width: '20%' }}
                />
                <Column
                  field="period"
                  header="Period"
                  style={{ width: '15%' }}
                />
                <Column
                  field="fileSize"
                  header="File Size"
                  style={{ width: '12%' }}
                />
                <Column
                  field="status"
                  header="Status"
                  body={(rowData) => (
                    <span className={`status-badge status-${rowData.status.toLowerCase()}`}>
                      {rowData.status}
                    </span>
                  )}
                  style={{ width: '12%' }}
                />
                <Column
                  field="downloads"
                  header="Downloads"
                  style={{ width: '12%' }}
                />
                <Column
                  header="Actions"
                  body={(rowData) => (
                    <div className="action-buttons">
                      <Button
                        icon="pi pi-download"
                        className="p-button-sm p-button-text"
                        tooltip="Download"
                        onClick={() => {
                          toast.current.show({
                            severity: "info",
                            summary: "Download",
                            detail: `Downloading report ${rowData.templateCode}`,
                            life: 3000
                          });
                        }}
                      />
                    </div>
                  )}
                  style={{ width: '14%' }}
                />
              </DataTable>
            </div>
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

export default ReportTemplateMaster;