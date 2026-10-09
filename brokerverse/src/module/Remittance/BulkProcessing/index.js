import React, { useEffect, useState, useRef } from "react";
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
import remittanceService, { masterService } from "../../../services/remittanceService";
import { downloadCsv, formatDateTime, showError, statusSeverity } from "../shared";
import importService from "../../../services/importService";
import SvgDot from "../../../assets/icons/SvgDot";
import { useTranslation } from "react-i18next";
import "./index.scss";

const BulkProcessing = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [upload, setUpload] = useState(null);
  const [processedRecords, setProcessedRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);

  useEffect(() => {
    masterService.list("remittance-bulk-processing", { status: "Active" })
      .then((rows) => setSelectedConfig((rows || []).find((r) => /csv/i.test(r.fileFormat)) || (rows || [])[0] || null))
      .catch((e) => showError(toast, e));
  }, []);

  const steps = [
    { label: t("remittance.uploadFile") },
    { label: t("remittance.validate") },
    { label: t("remittance.process") },
    { label: t("remittance.complete") }
  ];

  const validationResults = upload?.validationResults || [];

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
      const result = await remittanceService.uploadBulk(file, selectedConfig?.code);
      setUpload(result);
      e.options?.clear?.();

      toast.current.show({
        severity: result.errorCount ? 'warn' : 'success',
        summary: 'File Uploaded',
        detail: `${file.name}: ${result.successCount}/${result.totalRecords} records valid`,
        life: 4000
      });

      setActiveIndex(1);
    } catch (error) {
      showError(toast, error, 'Upload Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    setLoading(true);
    try {
      const result = await remittanceService.processBulk(upload.id);
      const processed = { ...result.upload, processedAt: result.upload.processedAt || new Date().toISOString() };
      setProcessedRecords([processed]);
      setActiveIndex(3);
      toast.current.show({
        severity: processed.errorCount > 0 ? 'warn' : 'success',
        summary: 'Processing Complete',
        detail: `Processed ${processed.successCount}/${processed.totalRecords} records; ${result.remittances.length} draft remittance(s) created`,
        life: 4000
      });
    } catch (error) {
      showError(toast, error, 'Processing Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    const record = processedRecords[0] || upload;
    downloadCsv(`${(record?.fileName || 'bulk').replace(/\.[^.]+$/, '')}_report.csv`, record?.errors || [], [
      { field: 'row', header: 'Row' },
      { field: 'field', header: 'Field' },
      { field: 'message', header: 'Error' }
    ]);
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
            <Button label={t("remittance.downloadTemplate")} icon="pi pi-download" outlined size="small" className="mb-3"
              onClick={() => importService.downloadTemplate(`/remittance/bulk/template${selectedConfig?.code ? `?configCode=${encodeURIComponent(selectedConfig.code)}` : ""}`).catch((e) => showError(toast, e))} />
            <FileUpload
              name="bulkFile"
              customUpload
              uploadHandler={handleUpload}
              disabled={loading}
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
            {loading && <ProgressBar mode="indeterminate" style={{ height: "6px" }} />}
            <p className="mt-3">Processing {upload?.validRowCount ?? 0} records...</p>
            <Button label={t("remittance.startProcessing")} onClick={handleProcess} className="p-button-success mt-3" loading={loading} disabled={!upload?.validRowCount} />
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
                       severity={statusSeverity(processedRecords[0].status)} />
                  <span className="ml-2">Processed on {formatDateTime(processedRecords[0].processedAt)}</span>
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
                  setUpload(null);
                  setProcessedRecords([]);
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
