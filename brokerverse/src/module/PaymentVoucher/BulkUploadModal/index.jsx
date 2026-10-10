import { useState, useRef } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { ProgressBar } from "primereact/progressbar";
import { disbursementsService } from "../../../services/disbursementsService";
import FileField from "../../../components/FileField";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { downloadBulkUploadTemplate } from "../../../agentModule/component/bulkUploadTemplate";
import "./index.scss";

const BulkUploadModal = ({ visible, onHide, onUploadSuccess }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
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

  const handleDownloadTemplate = () => downloadBulkUploadTemplate("disbursements");

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.current.show({ severity: 'warn', summary: t("validation.noFileSelected"), detail: t("validation.selectExcelFile"), life: 3000 });
      return;
    }

    setLoading(true);

    try {
      const result = await disbursementsService.bulkUploadDisbursements(selectedFile);

      if (result.success) {
        const apiResponse = result.data;
        
        // Handle the API response structure
        const data = apiResponse.data || apiResponse;
        
        // Store the upload result to show processing status
        setUploadResult(data);
        
        setSelectedFile(null);
        
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

  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header={t("paymentVoucher.bulkUploadTitle")}
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
                label={t("paymentVoucher.downloadTemplate")}
                icon="pi pi-download"
                className="p-button-sm p-button-text p-0"
                onClick={handleDownloadTemplate}
              />
            </div>

            <div className="upload-area">
              <FileField
                id="pv-bulk-upload-file"
                accept=".xlsx,.csv"
                value={selectedFile}
                onChange={(file) => (file ? handleFileSelect({ files: [file] }) : setSelectedFile(null))}
                disabled={loading}
                hint={t("paymentVoucher.maxFileSize10MB")}
              />
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
                outlined
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
                outlined
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
