import express from 'express';
import multer from 'multer';
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth } from '../../lib/auth.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { ok } from '../../lib/respond.js';
import { query } from '../../db/pool.js';
import { deleteObject, findDocument, keyFromUrlOrKey, objectExists, publicUrl, reserveKey, resolveKey, safeKey, storeFile, writeObject } from './storage.js';

/**
 * File storage used by every upload control. The front end calls the /s3/* API (upload, upload-multiple,
 * presigned URLs); objects are stored on local disk under UPLOAD_DIR with S3-style keys, so a real S3 bucket can
 * replace storage.js without changing the API.
 */
const { router, define } = moduleRouter('Files (S3 API)', '/s3');
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });
const keyParam = (req) => safeKey(req.params[0] || req.params.key);

define({
  method: 'POST', path: '/upload', summary: 'Upload one file (multipart: file, folder)', screen: 'Every upload control (vehicle photos, policy documents, IDs)',
  middleware: [requireAuth, upload.single('file')], request: { file: '<binary>', folder: 'vehicle-photos' },
  response: { success: true, data: { url: 'http://host/api/s3/object/vehicle-photos/123-abc-photo.jpg', key: 'vehicle-photos/123-abc-photo.jpg' } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('file is required');
    const out = await storeFile(req.file, { folder: req.body.folder || 'uploads', userId: req.user.id, entity: req.body.entity, entityId: req.body.entityId });
    res.json({ success: true, message: 'Uploaded', data: out, url: out.url, key: out.key });
  },
});
define({
  method: 'POST', path: '/upload-multiple', summary: 'Upload several files (multipart: files[], folder)', screen: 'Multi-file upload controls',
  middleware: [requireAuth, upload.array('files', 20)], request: { files: ['<binary>'], folder: 'claims' },
  response: { success: true, files: [{ url: 'http://host/api/s3/object/claims/1-a-x.pdf', key: 'claims/1-a-x.pdf' }] },
  handler: async (req, res) => {
    if (!req.files?.length) throw badRequest('files are required');
    const files = [];
    for (const f of req.files) files.push(await storeFile(f, { folder: req.body.folder || 'uploads', userId: req.user.id }));
    res.json({ success: true, files, data: { files } });
  },
});
define({
  method: 'POST', path: '/presigned-upload-url', summary: 'Reserve a key and return a URL to PUT the file to', screen: 'Direct uploads',
  middleware: [requireAuth], request: { fileName: 'photo.jpg', fileType: 'image/jpeg', folder: 'vehicle-photos' },
  response: { success: true, url: 'http://host/api/s3/put/vehicle-photos/1-a-photo.jpg', key: 'vehicle-photos/1-a-photo.jpg' },
  handler: async (req, res) => {
    const key = await reserveKey({ folder: req.body?.folder || 'uploads', fileName: req.body?.fileName || 'file', contentType: req.body?.fileType, userId: req.user.id });
    const url = publicUrl(key).replace('/api/s3/object/', '/api/s3/put/');
    res.json({ success: true, url, key, data: { url, key, publicUrl: publicUrl(key) } });
  },
});
router.put(/^\/put\/(.+)$/, requireAuth, express.raw({ type: '*/*', limit: '25mb' }), async (req, res, next) => {
  try {
    const key = keyParam(req);
    if (!(await findDocument(key))) throw notFound('Unknown key; request an upload URL first');
    await writeObject(key, req.body || Buffer.alloc(0), req.headers['content-type']);
    res.json({ success: true, data: { key, url: publicUrl(key) } });
  } catch (e) { next(e); }
});
define({
  method: 'POST', path: '/presigned-download-urls', summary: 'Resolve stored file URLs or keys to download URLs', screen: 'Document and photo viewers',
  middleware: [requireAuth], request: { urls: ['http://host/api/s3/object/vehicle-photos/1-a-photo.jpg'] },
  response: { success: true, data: { 'http://host/api/s3/object/vehicle-photos/1-a-photo.jpg': 'http://host/api/s3/object/vehicle-photos/1-a-photo.jpg' } },
  handler: async (req, res) => {
    const list = Array.isArray(req.body?.urls) ? req.body.urls : Array.isArray(req.body?.keys) ? req.body.keys : [];
    ok(res, Object.fromEntries(list.map((u) => [u, publicUrl(keyFromUrlOrKey(u))])));
  },
});
router.get(/^\/presigned-download-url\/(.+)$/, requireAuth, (req, res) => { const url = publicUrl(keyFromUrlOrKey(req.params[0])); res.json({ success: true, url, data: { url } }); });
router.get(/^\/file\/(.+)\/public-url$/, requireAuth, (req, res) => { const url = publicUrl(safeKey(req.params[0])); res.json({ success: true, url, data: { url } }); });
router.get(/^\/file\/(.+)\/exists$/, requireAuth, (req, res) => { const exists = objectExists(safeKey(req.params[0])); res.json({ success: true, exists, data: { exists } }); });
router.delete(/^\/file\/(.+)$/, requireAuth, async (req, res, next) => {
  try {
    const key = safeKey(req.params[0]);
    const doc = await findDocument(key);
    if (!doc) throw notFound('File not found');
    await deleteObject(key);
    await query('INSERT INTO audit_log(user_id, username, entity, entity_id, action) VALUES ($1,$2,\'document\',$3,\'delete\')', [req.user.id, req.user.username, key]);
    res.json({ success: true, message: 'File deleted' });
  } catch (e) { next(e); }
});
// Object download. Public by URL like an S3 object URL with an unguessable key; images must load in <img> tags.
router.get(/^\/object\/(.+)$/, async (req, res, next) => {
  try {
    const key = safeKey(req.params[0]);
    const doc = await findDocument(key);
    if (!doc || !objectExists(key)) throw notFound('File not found');
    if (doc.content_type) res.type(doc.content_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
    res.sendFile(resolveKey(key));
  } catch (e) { next(e); }
});

// Regex routes are registered directly; list them for the API documentation.
import { ROUTES } from '../../lib/registry.js';
for (const [method, path, summary] of [
  ['PUT', '/s3/put/:key', 'Upload target returned by presigned-upload-url (raw body)'],
  ['GET', '/s3/presigned-download-url/:key', 'Download URL for one stored file'],
  ['GET', '/s3/file/:key/public-url', 'Public URL of a stored file'],
  ['GET', '/s3/file/:key/exists', 'Check whether a stored file exists'],
  ['DELETE', '/s3/file/:key', 'Delete a stored file'],
  ['GET', '/s3/object/:key', 'Download a stored file (object URL)'],
]) ROUTES.push({ module: 'Files (S3 API)', method, path, summary, auth: path !== '/s3/object/:key', roles: [], permissions: [], screen: 'Document and photo viewers' });

export default router;
export const mount = '/s3';
