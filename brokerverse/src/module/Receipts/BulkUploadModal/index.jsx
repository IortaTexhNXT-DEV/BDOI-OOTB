import React, { useState, useRef } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { Toast } from "primereact/toast";
import { ProgressBar } from "primereact/progressbar";
import { receiptsService } from "../../../services/receiptsService";
import SvgUpload from "../../../assets/agentIcon/SvgUpload";
import SvgDownloadIcon from "../../../assets/agentIcon/SvgDownloadIcon";
import "./index.scss";
import PropTypes from "prop-types";

const BulkUploadModal = ({ visible, onHide, onUploadSuccess }) => {
  const toast = useRef(null);
  const fileUploadRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

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
          summary: 'Invalid File',
          detail: 'Please upload only Excel files (.xlsx)',
          life: 3000
        });
        fileUploadRef.current.clear();
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.current.show({
          severity: 'error',
          summary: 'File Too Large',
          detail: 'File size must be less than 10MB',
          life: 3000
        });
        fileUploadRef.current.clear();
        return;
      }

      setSelectedFile(file);
      setUploadResult(null); // Clear previous upload result on new file selection
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.current.show({
        severity: 'warn',
        summary: 'No File Selected',
        detail: 'Please select a file to upload',
        life: 3000
      });
      return;
    }

    setLoading(true);
    setUploadResult(null);

    try {
      const result = await receiptsService.bulkUploadReceipts(selectedFile);

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
          summary: 'Upload Started',
          detail: data.message || 'Receipt bulk upload started. Processing in background.',
          life: 5000
        });

        // Auto-close modal after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);

        // Notify parent to refresh the receipts table
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
        detail: error.message || 'Failed to upload receipts file',
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
    const templateURL = "https://salesverse-inxt-public-documents-20250531.s3.ap-southeast-1.amazonaws.com/template/receipts-bulk-upload-template+2.xlsx";
    window.open(templateURL, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header="Bulk Upload Receipts"
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
                <h4>Instructions:</h4>
                <Button
                  label="Download Template"
                  icon="pi pi-download"
                  className="p-button-sm p-button-text"
                  onClick={handleDownloadTemplate}
                />
              </div>
              <ul>
                <li>Download the sample template file</li>
                <li>Fill in the receipt details in the Excel file</li>
                <li>Upload the completed file (max 10MB)</li>
                <li>Only .xlsx files are supported</li>
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
                chooseLabel={selectedFile ? selectedFile.name : "Choose File"}
                onSelect={handleFileSelect}
                disabled={loading}
              />
              {!selectedFile && (
                <div className="upload-placeholder">
                  <SvgUpload />
                  <p>Select Excel file to upload</p>
                  <span>Maximum file size: 10MB</span>
                </div>
              )}
            </div>

            {loading && (
              <div className="upload-progress">
                <ProgressBar mode="indeterminate" style={{ height: "6px" }} />
                <p>Processing your file...</p>
              </div>
            )}

            <div className="bulk-upload-footer">
              <Button
                label="Cancel"
                className="p-button-text"
                onClick={handleClose}
                disabled={loading}
              />
              <Button
                label={loading ? "Uploading..." : "Upload"}
                onClick={handleUpload}
                disabled={!selectedFile || loading}
                loading={loading}
              />
            </div>
          </div>
        ) : (
          <div className="processing-section">
            <div className="processing-header">
              <h4>Processing...</h4>
              <ProgressBar mode="indeterminate" style={{ height: '6px', marginTop: '1rem' }} />
            </div>
            
            <div className="status-message">
              <p className="status-text">{uploadResult.message || 'Your file is being processed. Receipts will be created shortly.'}</p>
            </div>

            <div className="processing-actions">
              <Button
                label="Close"
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
