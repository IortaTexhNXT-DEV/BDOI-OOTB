import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Toast } from 'primereact/toast';
import s3Service from '../../services/s3Service';
import logger from "../../utility/logger";

let nextId = 0;

/**
 * S3FileUpload Component
 * Handles file uploads with progress tracking and preview.
 *
 * With `autoUpload` a file is uploaded as soon as it is chosen (one step, progress shown per file); without it the
 * user presses Upload after choosing (legacy two-step behaviour). A file can be removed before, during or after
 * upload; `onRemove(url, file)` tells the parent so it can clear the value it stored.
 *
 * @param {Function} onUploadSuccess - Callback with uploaded file URL
 * @param {Function} onUploadError - Callback on upload error
 * @param {Function} onRemove - Callback when an uploaded / selected file is removed
 * @param {string} accept - Accepted file types (e.g., "image/*", ".pdf")
 * @param {number} maxFileSize - Max file size in bytes (default: 10MB)
 * @param {boolean} multiple - Allow multiple file uploads
 * @param {boolean} showPreview - Show image preview
 * @param {boolean} autoUpload - Upload immediately on selection
 * @param {string} uploadPath - Storage path prefix (e.g., "vehicle-photos", "policy-docs")
 */
const S3FileUpload = ({
  onUploadSuccess,
  onUploadError,
  onRemove,
  accept = 'image/*',
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  multiple = false,
  showPreview = true,
  autoUpload = false,
  uploadPath = 'uploads',
  className = ''
}) => {
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const toast = useRef(null);

  const showToast = (severity, summary, detail) => {
    if (toast.current) {
      toast.current.show({ severity, summary, detail, life: 3000 });
    }
  };

  const patchFile = (id, patch) => {
    setSelectedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const uploadOne = async (fileData) => {
    patchFile(fileData.id, { uploading: true, progress: 0, error: null });
    try {
      const result = await s3Service.uploadFile(fileData.file, uploadPath, (percent) => patchFile(fileData.id, { progress: percent }));
      if (!result.success) throw new Error(result.error || 'Upload failed');
      patchFile(fileData.id, { uploading: false, uploaded: true, progress: 100, url: result.url });
      if (onUploadSuccess) onUploadSuccess(result.url, fileData.file, result);
      return result.url;
    } catch (error) {
      patchFile(fileData.id, { uploading: false, error: error.message || 'Upload failed' });
      showToast('error', 'Upload Failed', `${fileData.name}: ${error.message}`);
      if (onUploadError) onUploadError(error, fileData.file);
      return null;
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    // allow choosing the same file again after removing it
    event.target.value = '';

    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        showToast('error', 'File Too Large', `${file.name} exceeds ${(maxFileSize / 1024 / 1024).toFixed(0)}MB limit`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;

    const entries = validFiles.map((file) => {
      nextId += 1;
      return {
        id: nextId,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        name: file.name,
        size: file.size,
        uploading: false,
        uploaded: false,
        progress: 0,
        error: null,
        url: null
      };
    });

    if (!multiple) {
      // replacing the single file: the previous one is no longer the value
      selectedFiles.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
        if (f.uploaded && onRemove) onRemove(f.url, f.file);
      });
    }
    setSelectedFiles((prev) => (multiple ? [...prev, ...entries] : entries));
    if (autoUpload) entries.forEach((e) => uploadOne(e));
  };

  const handleUpload = async () => {
    const pending = selectedFiles.filter((f) => !f.uploaded && !f.uploading);
    if (pending.length === 0) {
      showToast('warn', 'No Files', 'Please select files to upload');
      return;
    }
    await Promise.all(pending.map((f) => uploadOne(f)));
  };

  const handleRemoveFile = async (fileData) => {
    if (fileData.uploaded && fileData.url) {
      // best effort: remove the stored object; the value is cleared either way
      try {
        const urlParts = fileData.url.split('/');
        await s3Service.deleteFile(urlParts.slice(-2).join('/'));
      } catch (error) {
        logger.warn('Stored file could not be deleted:', error);
      }
    }
    if (fileData.preview) URL.revokeObjectURL(fileData.preview);
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileData.id));
    if (onRemove) onRemove(fileData.url, fileData.file);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isUploading = selectedFiles.some((f) => f.uploading);
  const notUploaded = selectedFiles.filter((f) => !f.uploaded && !f.uploading).length;

  return (
    <div className={`s3-file-upload ${className}`}>
      <Toast ref={toast} />

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <div className="flex gap-2 mb-3 flex-wrap">
        <Button
          type="button"
          label={t('agent.chooseFiles')}
          icon={autoUpload ? 'pi pi-upload' : 'pi pi-file'}
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-button-outlined"
        />

        {notUploaded > 0 && (
          <Button
            type="button"
            label={autoUpload ? `Retry ${notUploaded} File(s)` : `Upload ${notUploaded} File(s)`}
            icon="pi pi-upload"
            onClick={handleUpload}
            disabled={isUploading}
            loading={isUploading}
            className="p-button-success"
          />
        )}
      </div>
      {autoUpload && selectedFiles.length === 0 && (
        <div className="text-sm text-500 mb-2">Files upload as soon as you choose them.</div>
      )}

      {selectedFiles.length > 0 && (
        <div className="files-list">
          {selectedFiles.map((fileData) => (
            <div
              key={fileData.id}
              className="file-item mb-3 p-3 border-1 border-round surface-border"
            >
              <div className="flex align-items-center justify-content-between mb-2">
                <div className="flex align-items-center gap-3 flex-1">
                  {showPreview && fileData.preview ? (
                    <img
                      src={fileData.preview}
                      alt={fileData.name}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                  ) : (
                    <i className="pi pi-file text-4xl text-primary"></i>
                  )}

                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="font-semibold" style={{ overflowWrap: 'anywhere' }}>{fileData.name}</div>
                    <div className="text-sm text-500">{formatFileSize(fileData.size)}</div>
                    {fileData.uploading && (
                      <div className="text-sm text-primary mt-1">
                        <i className="pi pi-spin pi-spinner mr-1"></i>
                        Uploading…
                      </div>
                    )}
                    {fileData.uploaded && (
                      <div className="text-sm text-green-500 mt-1">
                        <i className="pi pi-check-circle mr-1"></i>
                        Uploaded
                      </div>
                    )}
                    {fileData.error && (
                      <div className="text-sm text-red-500 mt-1">
                        <i className="pi pi-exclamation-circle mr-1"></i>
                        {fileData.error}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  icon={fileData.uploaded ? 'pi pi-trash' : 'pi pi-times'}
                  className={`p-button-rounded p-button-text ${fileData.uploaded ? 'p-button-danger' : ''}`}
                  onClick={() => handleRemoveFile(fileData)}
                  disabled={fileData.uploading}
                  tooltip="Remove"
                  aria-label={`Remove ${fileData.name}`}
                />
              </div>

              {fileData.uploading && (
                <ProgressBar
                  value={fileData.progress || 0}
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
  onRemove: PropTypes.func,
  accept: PropTypes.string,
  maxFileSize: PropTypes.number,
  multiple: PropTypes.bool,
  showPreview: PropTypes.bool,
  autoUpload: PropTypes.bool,
  uploadPath: PropTypes.string,
  className: PropTypes.string
};

export default S3FileUpload;
