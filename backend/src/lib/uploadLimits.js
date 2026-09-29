/**
 * Multipart upload limits, from the environment (UPLOAD_MAX_MB, UPLOAD_MAX_FILES, IMPORT_MAX_MB). Files are held in
 * memory while they are checked, so the limits bound the memory one request can take.
 */
import zlib from 'node:zlib';
import multer from 'multer';
import { config } from '../config.js';
import { badRequest } from './errors.js';

/** Documents and photos: UPLOAD_MAX_MB per file, at most `files` (default UPLOAD_MAX_FILES) files per request. */
export const memoryUpload = ({ maxBytes = config.uploadMaxBytes, files = config.uploadMaxFiles } = {}) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: Math.min(files, config.uploadMaxFiles), fields: 200, fieldSize: 1024 * 1024 },
});

/** Spreadsheet / CSV imports and statement files: one file of at most IMPORT_MAX_MB. */
export const importUpload = () => memoryUpload({ maxBytes: config.importMaxBytes, files: 1 });

/**
 * Inflate one ZIP entry of an uploaded workbook with an output cap (IMPORT_MAX_INFLATED_MB), so a small "zip bomb"
 * cannot expand to gigabytes in memory. method 8 = DEFLATE, 0 = stored.
 */
export function inflateEntry(raw, method) {
  const max = config.importMaxInflatedBytes;
  if (method !== 8) {
    if (raw.length > max) throw badRequest('The workbook is too large');
    return raw;
  }
  try {
    return zlib.inflateRawSync(raw, { maxOutputLength: max });
  } catch (e) {
    if (e instanceof RangeError || e.code === 'ERR_BUFFER_TOO_LARGE') throw badRequest(`The workbook is too large when uncompressed (limit ${Math.round(max / 1048576)} MB)`);
    throw badRequest('The workbook could not be read (damaged ZIP data)');
  }
}

/** Throw 400 when an import has more data rows than IMPORT_MAX_ROWS. */
export function assertRowLimit(count) {
  if (count > config.importMaxRows) throw badRequest(`The file has more than ${config.importMaxRows} rows; split it into smaller files`);
}
