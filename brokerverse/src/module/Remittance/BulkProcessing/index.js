import React, { useState, useRef } from "react";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressBar } from "primereact/progressbar";
import { Card } from "primereact/card";
import { Steps } from "primereact/steps";
import { Toast } from "primereact/toast";
import { BreadCrumb } from "primereact/breadcrumb";
import { Tag } from "primereact/tag";
import { bulkProcessingData, mockCrudOperations } from "../../../services/mockData/remittanceMockData";
import SvgDot from "../../../assets/icons/SvgDot";
import { useTranslation } from "react-i18next";
import "./index.scss";

const BulkProcessing = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processingStatus, setProcessingStatus] = useState("idle");
  const [processedRecords, setProcessedRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(bulkProcessingData.configurations[0]);

  const [configurations, setConfigurations] = useState(bulkProcessingData.configurations);
  const [processingHistory, setProcessingHistory] = useState(bulkProcessingData.processingHistory);

  const steps = [
    { label: t("remittance.uploadFile") },
    { label: t("remittance.validate") },
    { label: t("remittance.process") },
    { label: t("remittance.complete") }
  ];

  const validationResults = selectedConfig ? selectedConfig.validationRules.map((rule, index) => ({
    field: rule.field,
    rule: rule.rule,
    valid: Math.floor(Math.random() * 20) + 80,
    invalid: Math.floor(Math.random() * 10) + 1,
    total: 100
  })) : [];

  const items = [
    { label: t("sidebar.Finance"), url: "#" },
    { label: t("sidebar.Remittance"), url: "#" },
    { label: t("sidebar.Bulk Processing"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  const handleUpload = async (e) => {
    setLoading(true);
    try {
      const file = e.files[0];
      setUploadedFile(file);

      // Validate file against configuration
      if (file.size > selectedConfig.maxFileSize * 1024 * 1024) {
        throw new Error(`File size exceeds maximum limit of ${selectedConfig.maxFileSize}MB`);
      }

      // Create upload record
      const uploadRecord = {
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        configCode: selectedConfig.code,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Current User',
        status: 'Uploaded'
      };

      await mockCrudOperations.create('bulk_upload', uploadRecord);

      toast.current.show({
        severity: 'success',
        summary: 'File Uploaded',
        detail: `${file.name} uploaded successfully`,
        life: 3000
      });

      setActiveIndex(1);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Upload Failed',
        detail: error.message || 'Failed to upload file',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    setProcessingStatus("processing");
    setLoading(true);

    try {
      const totalRecords = Math.floor(Math.random() * 1000) + 500;
      const successCount = Math.floor(totalRecords * 0.85) + Math.floor(Math.random() * 100);
      const errorCount = totalRecords - successCount;

      // Create processing record
      const processRecord = {
        fileName: uploadedFile.name,
        configCode: selectedConfig.code,
        totalRecords,
        successCount,
        errorCount,
        status: errorCount > 0 ? 'Completed with Errors' : 'Success',
        processedBy: 'Current User',
        processedAt: new Date().toISOString()
      };

      const result = await mockCrudOperations.create('bulk_process', processRecord);
      setProcessedRecords([result]);

      // Add to history
      setProcessingHistory(prev => [processRecord, ...prev]);

      setTimeout(() => {
        setProcessingStatus("complete");
        setActiveIndex(3);
        setLoading(false);

        toast.current.show({
          severity: errorCount > 0 ? 'warn' : 'success',
          summary: 'Processing Complete',
          detail: `Processed ${successCount}/${totalRecords} records successfully`,
          life: 4000
        });
      }, 3000);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Processing Failed',
        detail: error.message || 'Failed to process file',
        life: 3000
      });
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const reportData = {
        fileName: uploadedFile.name,
        processedRecords: processedRecords[0],
        generatedAt: new Date().toISOString()
      };

      await mockCrudOperations.create('processing_report', reportData);

      toast.current.show({
        severity: 'success',
        summary: 'Report Downloaded',
        detail: 'Processing report has been downloaded',
        life: 3000
      });
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Download Failed',
        detail: 'Failed to download report',
        life: 3000
      });
    }
  };

  return (
    <div className="bulk-processing">
      <Toast ref={toast} />
      <div className="header-section">
        <h1 className="page__title">Bulk Remittance Processing</h1>
        <BreadCrumb model={items} home={home} />
      </div>
      
      <Steps model={steps} activeIndex={activeIndex} className="mb-4" />

      <Card>
        {activeIndex === 0 && (
          <div className="upload-section">
            <FileUpload
              name="bulkFile"
              customUpload
              uploadHandler={handleUpload}
              accept=".csv,.xlsx"
              maxFileSize={50000000}
              emptyTemplate={<p>Drag and drop files here to upload.</p>}
            />
          </div>
        )}

        {activeIndex === 1 && (
          <div className="validation-section">
            <h3>{t("remittance.validationResults")}</h3>
            <DataTable value={validationResults}>
              <Column field="field" header="Field" />
              <Column field="valid" header="Valid" />
              <Column field="invalid" header="Invalid" />
              <Column field="total" header="Total" />
            </DataTable>
            <div className="mt-3">
              <Button label={t("remittance.back")} onClick={() => setActiveIndex(0)} className="p-button-secondary mr-2" />
              <Button label={t("remittance.process")} onClick={() => setActiveIndex(2)} className="p-button-primary" />
            </div>
          </div>
        )}

        {activeIndex === 2 && (
          <div className="processing-section">
            <h3>{t("remittance.processingRecords")}</h3>
            <ProgressBar mode="indeterminate" style={{ height: "6px" }} />
            <p className="mt-3">Processing 100 records...</p>
            <Button label={t("remittance.startProcessing")} onClick={handleProcess} className="p-button-success mt-3" />
          </div>
        )}

        {activeIndex === 3 && (
          <div className="complete-section">
            <h3>{t("remittance.processingComplete")}</h3>
            {processedRecords.length > 0 && (
              <div className="summary">
                <div className="summary-cards">
                  <Card className="summary-card success">
                    <div className="card-content">
                      <i className="pi pi-check-circle"></i>
                      <div>
                        <div className="value">{processedRecords[0].successCount}</div>
                        <div className="label">{t("remittance.successfullyProcessed")}</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="summary-card error">
                    <div className="card-content">
                      <i className="pi pi-times-circle"></i>
                      <div>
                        <div className="value">{processedRecords[0].errorCount}</div>
                        <div className="label">Failed Records</div>
                      </div>
                    </div>
                  </Card>
                  <Card className="summary-card total">
                    <div className="card-content">
                      <i className="pi pi-file"></i>
                      <div>
                        <div className="value">{processedRecords[0].totalRecords}</div>
                        <div className="label">{t("remittance.totalRecords")}</div>
                      </div>
                    </div>
                  </Card>
                </div>
                <div className="status-info mt-3">
                  <Tag value={processedRecords[0].status}
                       severity={processedRecords[0].status === 'Success' ? 'success' : 'warning'} />
                  <span className="ml-2">Processed on {new Date(processedRecords[0].processedAt).toLocaleString()}</span>
                </div>
              </div>
            )}
            <div className="action-buttons mt-4">
              <Button
                label={t("remittance.downloadReport")}
                icon="pi pi-download"
                className="p-button-primary mr-2"
                onClick={handleDownloadReport}
              />
              <Button
                label={t("remittance.processAnotherFile")}
                icon="pi pi-refresh"
                className="p-button-secondary"
                onClick={() => {
                  setActiveIndex(0);
                  setUploadedFile(null);
                  setProcessedRecords([]);
                  setProcessingStatus('idle');
                }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BulkProcessing;
