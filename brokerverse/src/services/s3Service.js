import authService from './authService';
import { BASE_URL } from '../utility/constant';

const OBJECT_PATH = "/api/s3/object/";

/**
 * Stored-file URL as this browser reaches the API. The server signs file URLs with its configured public address
 * (PUBLIC_BASE_URL), which need not be the address the browser uses (another host name, a proxy, a local run), so the
 * image never loaded; the object path and signature are kept and the API address of this front end (BASE_URL) is used.
 * @param {string} url signed or plain object URL (or any other URL, returned unchanged)
 * @returns {string}
 */
export const browserFileUrl = (url) => {
  if (typeof url !== "string") return url;
  const at = url.indexOf(OBJECT_PATH);
  if (at < 0) return url;
  return `${BASE_URL}/s3/object/${url.slice(at + OBJECT_PATH.length)}`;
};

/**
 * S3 Service - Handles file uploads/downloads to AWS S3
 */
class S3Service {
  constructor() {
    this.baseURL = `${BASE_URL}/s3`;
  }

  /**
   * Upload a single file to S3
   * @param {File} file - File to upload
   * @param {string} folder - Folder path in S3 (e.g., 'vehicle-photos', 'policy-docs')
   * @param {Function} onProgress - Progress callback (percent)
   * @returns {Promise<Object>} Result with S3 URL
   */
  async uploadFile(file, folder = 'uploads', onProgress = null) {
    try {
      // XMLHttpRequest is not covered by the 401 retry of fetch: renew a nearly expired access token first
      await authService.freshAccessToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        // Progress tracking
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          });
        }

        // Success handler
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              const url = response.data?.url || response.url;
              const key = response.data?.key || response.key;
              resolve({
                success: true,
                url: url,
                key: key,
                data: response.data || response
              });
            } catch (error) {
              reject(new Error('Failed to parse upload response'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        // Error handlers
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });

        // Set up request
        xhr.open('POST', `${this.baseURL}/upload`);
        
        // Add auth header
        const authHeader = authService.getAuthHeader();
        if (authHeader.Authorization) {
          xhr.setRequestHeader('Authorization', authHeader.Authorization);
        }

        // Send request
        xhr.send(formData);
      });

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to upload file'
      };
    }
  }

  /**
   * Upload multiple files to S3
   * @param {File[]} files - Array of files to upload
   * @param {string} folder - Folder path in S3
   * @param {Function} onProgress - Progress callback (percent)
   * @returns {Promise<Object>} Result with S3 URLs
   */
  async uploadMultipleFiles(files, folder = 'uploads', onProgress = null) {
    try {
      await authService.freshAccessToken();
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('folder', folder);

      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        // Progress tracking
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          });
        }

        // Success handler
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({
                success: true,
                files: response.files,
                data: response
              });
            } catch (error) {
              reject(new Error('Failed to parse upload response'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        // Error handlers
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });

        // Set up request
        xhr.open('POST', `${this.baseURL}/upload-multiple`);
        
        // Add auth header
        const authHeader = authService.getAuthHeader();
        if (authHeader.Authorization) {
          xhr.setRequestHeader('Authorization', authHeader.Authorization);
        }

        // Send request
        xhr.send(formData);
      });

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to upload files'
      };
    }
  }

  /**
   * Delete a file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} Result
   */
  async deleteFile(key) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/file/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete file');
      }

      const data = await response.json();

      return {
        success: true,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to delete file')
      };
    }
  }

  /**
   * Generate presigned URL for upload
   * @param {string} fileName - File name
   * @param {string} fileType - File MIME type
   * @param {string} folder - Folder path in S3
   * @returns {Promise<Object>} Result with presigned URL
   */
  async generatePresignedUploadUrl(fileName, fileType, folder = 'uploads') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/presigned-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ fileName, fileType, folder }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate presigned URL');
      }

      const data = await response.json();

      return {
        success: true,
        url: data.url,
        key: data.key,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to generate presigned URL')
      };
    }
  }

  /**
   * Generate presigned URL for download
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration in seconds (default: 3600)
   * @returns {Promise<Object>} Result with presigned URL
   */
  async generatePresignedDownloadUrl(key, expiresIn = 3600) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/presigned-download-url/${encodeURIComponent(key)}?expiresIn=${expiresIn}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate presigned URL');
      }

      const data = await response.json();

      return {
        success: true,
        url: browserFileUrl(data.url),
        data: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to generate presigned URL')
      };
    }
  }

  /**
   * Get public URL for a file
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} Result with public URL
   */
  async getPublicUrl(key) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/file/${encodeURIComponent(key)}/public-url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get public URL');
      }

      const data = await response.json();

      return {
        success: true,
        url: browserFileUrl(data.url),
        data: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to get public URL')
      };
    }
  }

  /**
   * Check if a file exists in S3
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} Result with exists boolean
   */
  async fileExists(key) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseURL}/file/${encodeURIComponent(key)}/exists`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check file existence');
      }

      const data = await response.json();

      return {
        success: true,
        exists: data.exists,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to check file existence')
      };
    }
  }

  /**
   * Get presigned download URLs for multiple S3 URLs
   * @param {string[]} urls - Array of S3 URLs
   * @returns {Promise<Object>} Result with URL mapping (originalUrl -> presignedUrl)
   */
  async getPresignedDownloadUrls(urls) {
    try {
      if (!Array.isArray(urls) || urls.length === 0) {
        return {
          success: true,
          data: {}
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.baseURL}/presigned-download-urls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify({ urls }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get presigned URLs');
      }

      const data = await response.json();

      return {
        success: true,
        // URL mapping object (original URL or key -> signed URL this browser can open)
        data: Object.fromEntries(Object.entries(data.data || {}).map(([k, v]) => [k, browserFileUrl(v)]))
      };
    } catch (error) {
      return {
        success: false,
        error: error.name === 'AbortError' ? 'Request timeout. Please try again.' : (error.message || 'Failed to get presigned URLs')
      };
    }
  }
}

const s3Service = new S3Service();
export default s3Service;

