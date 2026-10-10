import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { ProgressBar } from "primereact/progressbar";
import leadService from "../../../../services/leadService";
import "./index.scss";
import FileField from "../../../../components/FileField";
import { downloadBulkUploadTemplate, isSupportedUploadFile } from "../../../component/bulkUploadTemplate";

const BulkUploadModal = ({ visible, onHide, onUploadSuccess }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.files[0];
    if (file) {
      // Validate file type
      if (!isSupportedUploadFile(file)) {
        toast.current.show({
          severity: 'error',
          summary: t('bulkUploadLeads.invalidFile'),
          detail: t('bulkUploadLeads.onlyExcelFiles'),
          life: 3000
        });
        setSelectedFile(null);
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.current.show({
          severity: 'error',
          summary: t('bulkUploadLeads.fileTooLarge'),
          detail: t('bulkUploadLeads.fileSizeLessThan10MB'),
          life: 3000
        });
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.current.show({
        severity: 'warn',
        summary: t('bulkUploadLeads.noFileSelected'),
        detail: t('bulkUploadLeads.pleaseSelectFile'),
        life: 3000
      });
      return;
    }

    setLoading(true);
    setUploadResult(null);

    try {
      const result = await leadService.bulkUploadLeads(selectedFile);

      if (result.success) {
        const apiResponse = result.data;
        
        // Handle the API response structure
        const data = apiResponse.data || apiResponse;
        
        // Store the upload result to show processing status
        setUploadResult(data);
        
        // Clear selected file after successful upload
        setSelectedFile(null);
        
        // Show success message
        toast.current.show({
          severity: 'success',
          summary: t('bulkUploadLeads.uploadStarted'),
          detail: data.message || t('bulkUploadLeads.uploadStartedDetail'),
          life: 5000
        });

        // Auto-close modal after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);

        // Notify parent to refresh the leads table
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t('bulkUploadLeads.uploadFailed'),
        detail: error.message || t('bulkUploadLeads.uploadFailedDetail'),
        life: 3000
      });
      
      // Clear selected file on error
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    onHide();
  };

  const handleDownloadTemplate = () => downloadBulkUploadTemplate("leads");

  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header={t("bulkUploadLeads.header")}
      className="bulk-upload-modal"
      style={{ width: '600px' }}
      modal
    >
      <div className="bulk-upload-container">
        <Toast ref={toast} />
        
        {!uploadResult ? (
          <div className="bulk-upload-content">
            <div className="upload-template">
              <Button
                label={t("bulkUploadLeads.downloadTemplate")}
                icon="pi pi-download"
                className="p-button-sm p-button-text p-0"
                onClick={handleDownloadTemplate}
              />
            </div>

            <div className="upload-area">
              <FileField
                id="bulk-upload-file"
                accept=".xlsx,.csv"
                value={selectedFile}
                onChange={(file) => (file ? handleFileSelect({ files: [file] }) : setSelectedFile(null))}
                disabled={loading}
                hint={t("bulkUploadLeads.maxFileSize")}
              />
            </div>

            {loading && (
              <div className="upload-progress">
                <ProgressBar mode="indeterminate" style={{ height: "6px" }} />
                <p>{t("bulkUploadLeads.processingFile")}</p>
              </div>
            )}

            <div className="bulk-upload-footer">
              <Button
                label={t("bulkUploadLeads.cancel")}
                outlined
                onClick={handleClose}
                disabled={loading}
              />
              <Button
                label={t("bulkUploadLeads.upload")}
                onClick={handleUpload}
                disabled={!selectedFile || loading}
                loading={loading}
              />
            </div>
          </div>
        ) : (
          <div className="processing-section">
            <div className="processing-header">
              <h4>{t("bulkUploadLeads.processing")}</h4>
              <ProgressBar mode="indeterminate" style={{ height: '6px', marginTop: '1rem' }} />
            </div>
            
            <div className="status-message">
              <p className="status-text">{uploadResult.message || t('bulkUploadLeads.fileBeingProcessed')}</p>
            </div>

            <div className="processing-actions">
              <Button
                label={t("bulkUploadLeads.close")}
                onClick={handleClose}
                className="close-button"
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default BulkUploadModal;

