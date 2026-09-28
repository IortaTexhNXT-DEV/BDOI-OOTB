import React, { useState, useRef } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { Toast } from "primereact/toast";
import { ProgressBar } from "primereact/progressbar";
import { disbursementsService } from "../../../services/disbursementsService";
import SvgUpload from "../../../assets/agentIcon/SvgUpload";
import SvgDownloadIcon from "../../../assets/agentIcon/SvgDownloadIcon";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import "./index.scss";

const BulkUploadModal = ({ visible, onHide, onUploadSuccess }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const fileUploadRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null); // Clear previous upload result on new file selection
    }
  };

  const handleDownloadTemplate = () => {
    const templateURL = "https://salesverse-inxt-public-documents-20250531.s3.ap-southeast-1.amazonaws.com/template/disbursements-bulk-upload-template+2.xlsx";
    window.open(templateURL, "_blank", "noopener,noreferrer");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.current.show({ severity: 'warn', summary: t("validation.noFileSelected"), detail: t("validation.selectExcelFile"), life: 3000 });
      return;
    }

    setLoading(true);

    try {
      const result = await disbursementsService.bulkUploadDisbursements(selectedFile);

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
          summary: t("paymentVoucher.uploadStarted"),
          detail: data.message || t("paymentVoucher.bulkUploadStarted"),
          life: 5000
        });

        // Auto-close modal after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);

        // Notify parent to refresh the disbursements table
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("paymentVoucher.uploadFailed"),
        detail: error.message || t("paymentVoucher.failedToUploadDisbursements"),
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


  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header="Bulk Upload Disbursements"
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
                <h4>{t("paymentVoucher.instructions")}</h4>
                <Button
                  label={t("paymentVoucher.downloadTemplate")}
                  icon="pi pi-download"
                  className="p-button-sm p-button-text"
                  onClick={handleDownloadTemplate}
                />
              </div>
              <ul>
                <li>{t("paymentVoucher.instruction1")}</li>
                <li>{t("paymentVoucher.instruction2")}</li>
                <li>{t("paymentVoucher.instruction3")}</li>
                <li>{t("paymentVoucher.instruction4")}</li>
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
                chooseLabel={selectedFile ? selectedFile.name : t("paymentVoucher.chooseFile")}
                onSelect={handleFileSelect}
                disabled={loading}
              />
              {!selectedFile && (
                <div className="upload-placeholder">
                  <SvgUpload />
                  <p>{t("paymentVoucher.selectExcelToUpload")}</p>
                  <span>{t("paymentVoucher.maxFileSize10MB")}</span>
                </div>
              )}
            </div>

            {loading && (
              <div className="upload-progress">
                <ProgressBar mode="indeterminate" style={{ height: "6px" }} />
                <p>{t("paymentVoucher.processingYourFile")}</p>
              </div>
            )}

            <div className="bulk-upload-footer">
              <Button
                label={t("common.cancel")}
                className="p-button-text"
                onClick={handleClose}
                disabled={loading}
              />
              <Button
                label={loading ? t("paymentVoucher.uploading") : t("paymentVoucher.upload")}
                onClick={handleUpload}
                disabled={!selectedFile || loading}
                loading={loading}
              />
            </div>
          </div>
        ) : (
          <div className="processing-section">
            <div className="processing-header">
              <h4>{t("paymentVoucher.processing")}</h4>
              <ProgressBar mode="indeterminate" style={{ height: '6px', marginTop: '1rem' }} />
            </div>
            
            <div className="status-message">
              <p className="status-text">{uploadResult.message || t("paymentVoucher.fileBeingProcessed")}</p>
            </div>

            <div className="processing-actions">
              <Button
                label={t("common.close")}
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

BulkUploadModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onUploadSuccess: PropTypes.func.isRequired,
};

export default BulkUploadModal;
