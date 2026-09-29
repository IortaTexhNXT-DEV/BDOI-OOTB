import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Toast } from 'primereact/toast';
import s3Service from '../../services/s3Service';

/**
 * S3FileUpload Component
 * Handles file uploads to S3 with progress tracking and preview
 * 
 * @param {Function} onUploadSuccess - Callback with uploaded file URL
 * @param {Function} onUploadError - Callback on upload error
 * @param {string} accept - Accepted file types (e.g., "image/*", ".pdf")
 * @param {number} maxFileSize - Max file size in bytes (default: 10MB)
 * @param {boolean} multiple - Allow multiple file uploads
 * @param {boolean} showPreview - Show image preview
 * @param {string} uploadPath - S3 path prefix (e.g., "vehicle-photos", "policy-docs")
 */
const S3FileUpload = ({
  onUploadSuccess,
  onUploadError,
  accept = 'image/*',
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  multiple = false,
  showPreview = true,
  uploadPath = 'uploads',
  className = ''
}) => {
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useRef(null);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    
    // Validate file sizes
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        showToast('error', 'File Too Large', `${file.name} exceeds ${(maxFileSize / 1024 / 1024).toFixed(0)}MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Create preview URLs for images
    const filesWithPreview = validFiles.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      name: file.name,
      size: file.size,
      uploading: false,
      uploaded: false,
      url: null
    }));

    if (multiple) {
      setSelectedFiles(prev => [...prev, ...filesWithPreview]);
    } else {
      setSelectedFiles(filesWithPreview);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showToast('warn', 'No Files', 'Please select files to upload');
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = selectedFiles
        .filter(f => !f.uploaded)
        .map(async (fileData, index) => {
          try {
            // Update progress for this file
            updateFileProgress(index, 0);

            // Upload to S3
            const result = await s3Service.uploadFile(
              fileData.file,
              uploadPath,
              (progressPercent) => {
                updateFileProgress(index, progressPercent);
              }
            );

            if (result.success) {
              // Mark as uploaded
              updateFileStatus(index, true, result.url);
              
              // Call success callback
              if (onUploadSuccess) {
                onUploadSuccess(result.url, fileData.file);
              }

              showToast('success', 'Upload Success', `${fileData.name} uploaded successfully`);
              
              return result.url;
            } else {
              throw new Error(result.error || 'Upload failed');
            }
          } catch (error) {
            console.error(`Failed to upload ${fileData.name}:`, error);
            showToast('error', 'Upload Failed', `${fileData.name}: ${error.message}`);
            
            if (onUploadError) {
              onUploadError(error, fileData.file);
            }
            
            return null;
          }
        });

      const urls = await Promise.all(uploadPromises);
      const successfulUrls = urls.filter(url => url !== null);
      
      setUploadedUrls(prev => [...prev, ...successfulUrls]);
      
    } catch (error) {
      console.error('Upload error:', error);
      showToast('error', 'Upload Failed', error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const updateFileProgress = (index, percent) => {
    setUploadProgress(prev => ({
      ...prev,
      [index]: percent
    }));
  };

  const updateFileStatus = (index, uploaded, url = null) => {
    setSelectedFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, uploaded, url } : file
    ));
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      // Revoke preview URL to avoid memory leak
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
    
    // Remove progress entry
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });
  };

  const handleDeleteUploaded = async (index, fileData) => {
    if (!fileData.url) return;

    const confirmDelete = window.confirm(`Delete ${fileData.name}?`);
    if (!confirmDelete) return;

    try {
      // Extract S3 key from URL
      const urlParts = fileData.url.split('/');
      const key = urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)

      const result = await s3Service.deleteFile(key);
      
      if (result.success) {
        handleRemoveFile(index);
        showToast('success', 'Deleted', `${fileData.name} deleted successfully`);
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('error', 'Delete Failed', error.message);
    }
  };

  const showToast = (severity, summary, detail) => {
    if (toast.current) {
      toast.current.show({ severity, summary, detail, life: 3000 });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={`s3-file-upload ${className}`}>
      <Toast ref={toast} />
      
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Upload Buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          label={t("agent.chooseFiles")}
          icon="pi pi-file"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-button-outlined"
        />
        
        {selectedFiles.length > 0 && (
          <Button
            label={`Upload ${selectedFiles.filter(f => !f.uploaded).length} File(s)`}
            icon="pi pi-upload"
            onClick={handleUpload}
            disabled={isUploading || selectedFiles.every(f => f.uploaded)}
            loading={isUploading}
            className="p-button-success"
          />
        )}
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="files-list">
          {selectedFiles.map((fileData, index) => (
            <div 
              key={index} 
              className="file-item mb-3 p-3 border-1 border-round surface-border"
            >
              <div className="flex align-items-center justify-content-between mb-2">
                <div className="flex align-items-center gap-3 flex-1">
                  {/* Preview or Icon */}
                  {showPreview && fileData.preview ? (
                    <img 
                      src={fileData.preview} 
                      alt={fileData.name}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                  ) : (
                    <i className="pi pi-file text-4xl text-primary"></i>
                  )}
                  
                  {/* File Info */}
                  <div className="flex-1">
                    <div className="font-semibold">{fileData.name}</div>
                    <div className="text-sm text-500">{formatFileSize(fileData.size)}</div>
                    
                    {/* Status */}
                    {fileData.uploaded && (
                      <div className="text-sm text-green-500 mt-1">
                        <i className="pi pi-check-circle mr-1"></i>
                        Uploaded
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {fileData.uploaded ? (
                    <Button
                      icon="pi pi-trash"
                      className="p-button-rounded p-button-danger p-button-text"
                      onClick={() => handleDeleteUploaded(index, fileData)}
                      tooltip="Delete"
                    />
                  ) : (
                    <Button
                      icon="pi pi-times"
                      className="p-button-rounded p-button-text"
                      onClick={() => handleRemoveFile(index)}
                      disabled={isUploading}
                      tooltip="Remove"
                    />
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {!fileData.uploaded && uploadProgress[index] !== undefined && uploadProgress[index] > 0 && (
                <ProgressBar 
                  value={uploadProgress[index]} 
                  showValue={true}
                  className="h-1rem"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

S3FileUpload.propTypes = {
  onUploadSuccess: PropTypes.func,
  onUploadError: PropTypes.func,
  accept: PropTypes.string,
  maxFileSize: PropTypes.number,
  multiple: PropTypes.bool,
  showPreview: PropTypes.bool,
  uploadPath: PropTypes.string,
  className: PropTypes.string
};

export default S3FileUpload;

