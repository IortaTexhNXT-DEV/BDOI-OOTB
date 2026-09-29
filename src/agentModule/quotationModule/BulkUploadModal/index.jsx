import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { Toast } from "primereact/toast";
import { ProgressBar } from "primereact/progressbar";
import quotationService from "../../../services/quotationService";
import SvgUpload from "../../../assets/agentIcon/SvgUpload";
import "./index.scss";

const BulkUploadModal = ({ visible, onHide, onUploadSuccess }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const fileUploadRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.files[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx')) {
        toast.current.show({
          severity: 'error',
          summary: t('bulkUploadQuotations.invalidFile'),
          detail: t('bulkUploadQuotations.onlyExcelFiles'),
          life: 3000
        });
        fileUploadRef.current.clear();
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.current.show({
          severity: 'error',
          summary: t('bulkUploadQuotations.fileTooLarge'),
          detail: t('bulkUploadQuotations.fileSizeLessThan10MB'),
          life: 3000
        });
        fileUploadRef.current.clear();
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.current.show({
        severity: 'warn',
        summary: t('bulkUploadQuotations.noFileSelected'),
        detail: t('bulkUploadQuotations.pleaseSelectFile'),
        life: 3000
      });
      return;
    }

    setLoading(true);
    setUploadResult(null);

    try {
      const result = await quotationService.bulkUploadQuotations(selectedFile);

      console.log('Bulk upload result:', result);

      if (result.success) {
        const apiResponse = result.data;
        console.log('Upload data (API response):', apiResponse);
        
        // Handle the API response structure
        const data = apiResponse.data || apiResponse;
        console.log('Nested data:', data);
        
        // Store the upload result to show processing status
        setUploadResult(data);
        
        // Clear selected file after successful upload
        setSelectedFile(null);
        if (fileUploadRef.current) {
          fileUploadRef.current.clear();
        }
        
        // Show success message
        toast.current.show({
          severity: 'success',
          summary: t('bulkUploadQuotations.uploadStarted'),
          detail: data.message || t('bulkUploadQuotations.uploadStartedDetail'),
          life: 5000
        });

        // Auto-close modal after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);

        // Notify parent to refresh the quotations table
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Upload Failed',
        detail: error.message || 'Failed to upload quotations file',
        life: 3000
      });
      
      // Clear selected file on error
      setSelectedFile(null);
      if (fileUploadRef.current) {
        fileUploadRef.current.clear();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    if (fileUploadRef.current) {
      fileUploadRef.current.clear();
    }
    onHide();
  };


  const handleDownloadTemplate = () => {
    const templateUrl = 'https://salesverse-inxt-public-documents-20250531.s3.ap-southeast-1.amazonaws.com/sample-xl/Quotations-Bulk-Upload.xlsx';
    window.open(templateUrl, '_blank');
  };


  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header={t('bulkUploadQuotations.header')}
      className="bulk-upload-modal"
      style={{ width: '600px' }}
      modal
    >
      <div className="bulk-upload-container">
        <Toast ref={toast} />
        
        {!uploadResult ? (
          <div className="bulk-upload-content">
            <div className="upload-instructions">
              <div className="instructions-header">
                <h4>{t('bulkUploadQuotations.instructions')}</h4>
                <Button
                  label={t('bulkUploadQuotations.downloadTemplate')}
                  icon="pi pi-download"
                  className="p-button-sm p-button-text"
                  onClick={handleDownloadTemplate}
                />
              </div>
              <ul>
                <li>{t('bulkUploadQuotations.instruction1')}</li>
                <li>{t('bulkUploadQuotations.instruction2')}</li>
                <li>{t('bulkUploadQuotations.instruction3')}</li>
                <li>{t('bulkUploadQuotations.instruction4')}</li>
              </ul>
            </div>

            <div className="upload-area">
              <FileUpload
                ref={fileUploadRef}
                mode="basic"
                name="file"
                accept=".xlsx"
                maxFileSize={10485760}
                customUpload
                auto={false}
                chooseLabel={selectedFile ? selectedFile.name : t('bulkUploadQuotations.chooseFile')}
                onSelect={handleFileSelect}
                disabled={loading}
              />
              {!selectedFile && (
                <div className="upload-placeholder">
                  <SvgUpload />
                  <p>{t('bulkUploadQuotations.selectExcelFile')}</p>
                  <span>{t('bulkUploadQuotations.maxFileSize')}</span>
                </div>
              )}
            </div>

            {loading && (
              <div className="upload-progress">
                <ProgressBar mode="indeterminate" style={{ height: "6px" }} />
                <p>{t('bulkUploadQuotations.processingFile')}</p>
              </div>
            )}

            <div className="bulk-upload-footer">
              <Button
                label={t('bulkUploadQuotations.cancel')}
                className="p-button-text"
                onClick={handleClose}
                disabled={loading}
              />
              <Button
                label={loading ? t('bulkUploadQuotations.uploading') : t('bulkUploadQuotations.upload')}
                onClick={handleUpload}
                disabled={!selectedFile || loading}
                loading={loading}
              />
            </div>
          </div>
        ) : (
          <div className="processing-section">
            <div className="processing-header">
              <h4>{t('bulkUploadQuotations.processing')}</h4>
              <ProgressBar mode="indeterminate" style={{ height: '6px', marginTop: '1rem' }} />
            </div>
            
            <div className="status-message">
              <p className="status-text">{uploadResult.message || t('bulkUploadQuotations.fileBeingProcessed')}</p>
            </div>

            <div className="processing-actions">
              <Button
                label={t('bulkUploadQuotations.close')}
                onClick={handleClose}
                className="close-button"
                severity="success"
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default BulkUploadModal;

