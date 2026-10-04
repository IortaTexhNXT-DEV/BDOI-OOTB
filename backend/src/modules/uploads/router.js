import express from 'express';
import { moduleRouter } from '../../lib/registry.js';
import { authenticate, hasPermission, isAdmin } from '../../lib/auth.js';
import { badRequest, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { query } from '../../db/pool.js';
import { config } from '../../config.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { verifyFileSignature } from '../../lib/secrets.js';
import { deleteObject, findDocument, keyFromUrlOrKey, objectExists, publicUrl, reserveKey, resolveKey, safeKey, signedUrl, storeFile, writeObject } from './storage.js';
import { INLINE_TYPES, allowedTypes, assertAllowedFile } from './fileTypes.js';

/**
 * File storage used by every upload control. The front end calls the /s3/* API (upload, upload-multiple,
 * presigned URLs); objects are stored on local disk under UPLOAD_DIR with S3-style keys, so a real S3 bucket can
 * replace storage.js without changing the API.
 *
 * Access rules:
 * - upload: any signed-in user; the type must be in uploads.allowed_types (checked by file signature);
 * - replace (PUT) and delete: the uploader, a user with write access to the module that owns the document, or an
 *   administrator;
 * - read (GET object): a signed-in user (bearer header) or a signed, expiring link (?exp=&sig=) as returned by the API.
 */
const { router, define } = moduleRouter('Files (S3 API)', '/s3');
export const upload = memoryUpload();
const keyParam = (req) => safeKey(req.params[0] || req.params.key);

/** Module that owns a stored document (entity first, else the upload folder); null when unknown. */
const MODULE_BY_NAME = [
  [/^endorse/, 'endorsements'], [/^(claim|settlement)/, 'claims'], [/^(system-settings|logo|favicon|branding)/, 'settings'],
  [/^(receipt|payment|proof|billing|collection)/, 'receipts'], [/^disburse/, 'disbursements'], [/^remittance/, 'remittance'],
  [/^(reinsurance|bordereaux|treat)/, 'reinsurance'], [/^incentive/, 'incentive'], [/^product/, 'products'],
  [/^(template|master)/, 'masters'], [/^lead/, 'leads'], [/^(quot|quote)/, 'quotations'],
  [/^(vehicle|polic|upload-policy)/, 'policies'], [/^(id-card|kyc|client|customer)/, 'clients'],
];
export function owningModule(doc) {
  for (const name of [doc?.entity, doc?.category, String(doc?.storage_key || '').split('/')[0]]) {
    const n = String(name || '').toLowerCase();
    if (!n) continue;
    const hit = MODULE_BY_NAME.find(([re]) => re.test(n));
    if (hit) return hit[1];
  }
  return null;
}

/** May this user replace or delete the document? */
export function canModify(user, doc) {
  if (isAdmin(user) || (doc.uploaded_by && doc.uploaded_by === user.id)) return true;
  const mod = owningModule(doc);
  return !!mod && hasPermission(user, `write:${mod}`);
}

define({
  method: 'POST', path: '/upload', summary: 'Upload one file (multipart: file, folder); type checked against uploads.allowed_types', screen: 'Every upload control (vehicle photos, policy documents, IDs)',
  middleware: [upload.single('file')], request: { file: '<binary>', folder: 'vehicle-photos' },
  response: { success: true, data: { url: 'http://host/api/s3/object/vehicle-photos/123-abc-photo.jpg?exp=1767225600&sig=...', key: 'vehicle-photos/123-abc-photo.jpg' } },
  handler: async (req, res) => {
    if (!req.file) throw badRequest('file is required');
    const out = await storeFile(req.file, { folder: req.body.folder || 'uploads', userId: req.user.id, entity: req.body.entity, entityId: req.body.entityId });
    res.json({ success: true, message: 'Uploaded', data: out, url: out.url, key: out.key });
  },
});
define({
  method: 'POST', path: '/upload-multiple', summary: 'Upload several files (multipart: files[], folder); every file is type checked', screen: 'Multi-file upload controls',
  middleware: [upload.array('files', config.uploadMaxFiles)], request: { files: ['<binary>'], folder: 'claims' },
  response: { success: true, files: [{ url: 'http://host/api/s3/object/claims/1-a-x.pdf?exp=1767225600&sig=...', key: 'claims/1-a-x.pdf' }] },
  handler: async (req, res) => {
    if (!req.files?.length) throw badRequest('files are required');
    const allowed = await allowedTypes();
    for (const f of req.files) await assertAllowedFile(f.buffer, f.originalname, { allowed }); // all or nothing
    const files = [];
    for (const f of req.files) files.push(await storeFile(f, { folder: req.body.folder || 'uploads', userId: req.user.id }));
    res.json({ success: true, files, data: { files } });
  },
});
define({
  method: 'POST', path: '/presigned-upload-url', summary: 'Reserve a key and return a URL to PUT the file to', screen: 'Direct uploads',
  request: { fileName: 'photo.jpg', fileType: 'image/jpeg', folder: 'vehicle-photos' },
  response: { success: true, url: 'http://host/api/s3/put/vehicle-photos/1-a-photo.jpg', key: 'vehicle-photos/1-a-photo.jpg' },
  handler: async (req, res) => {
    const key = await reserveKey({ folder: req.body?.folder || 'uploads', fileName: req.body?.fileName || 'file', contentType: null, userId: req.user.id });
    const url = publicUrl(key).replace('/api/s3/object/', '/api/s3/put/');
    res.json({ success: true, url, key, data: { url, key, publicUrl: publicUrl(key) } });
  },
});
define({
  method: 'PUT', path: '/put/*', summary: 'Upload target returned by presigned-upload-url (raw body); uploader, module writer or administrator; type checked', screen: 'Direct uploads',
  middleware: [express.raw({ type: '*/*', limit: config.uploadMaxBytes })], request: '<binary>', response: { success: true, data: { key: 'vehicle-photos/1-a-photo.jpg' } },
  handler: async (req, res) => {
    const key = keyParam(req);
    const doc = await findDocument(key);
    if (!doc) throw notFound('Unknown key; request an upload URL first');
    if (!canModify(req.user, doc)) throw forbidden('You can only replace files you uploaded or files of a module you can edit');
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const contentType = await assertAllowedFile(body, doc.file_name);
    await writeObject(key, body, contentType);
    await query('INSERT INTO audit_log(user_id, username, entity, entity_id, action) VALUES ($1,$2,\'document\',$3,\'replace\')', [req.user.id, req.user.username, key]);
    res.json({ success: true, data: { key, url: publicUrl(key) } });
  },
});
define({
  method: 'POST', path: '/presigned-download-urls', summary: 'Resolve stored file URLs or keys to signed, expiring download URLs', screen: 'Document and photo viewers',
  request: { urls: ['http://host/api/s3/object/vehicle-photos/1-a-photo.jpg'] },
  response: { success: true, data: { 'http://host/api/s3/object/vehicle-photos/1-a-photo.jpg': 'http://host/api/s3/object/vehicle-photos/1-a-photo.jpg?exp=1767225600&sig=...' } },
  handler: async (req, res) => {
    const list = Array.isArray(req.body?.urls) ? req.body.urls : Array.isArray(req.body?.keys) ? req.body.keys : [];
    if (list.length > 500) throw badRequest('At most 500 URLs per request');
    // The map is built here (not by the response signer) so the original URLs stay unchanged as keys.
    const map = Object.fromEntries(list.map((u) => [u, signedUrl(keyFromUrlOrKey(u))]));
    res.set('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify({ success: true, message: 'OK', data: map }));
  },
});
define({
  method: 'GET', path: '/presigned-download-url/*', summary: 'Signed, expiring download URL for one stored file', screen: 'Document and photo viewers',
  response: { success: true, url: 'http://host/api/s3/object/x/1-a-photo.jpg?exp=1767225600&sig=...' },
  handler: async (req, res) => { const url = signedUrl(keyFromUrlOrKey(req.params[0])); res.json({ success: true, url, data: { url } }); },
});
define({
  method: 'GET', path: '/file/*/public-url', summary: 'Signed, expiring URL of a stored file', screen: 'Document and photo viewers',
  response: { success: true, url: 'http://host/api/s3/object/x/1-a-photo.jpg?exp=1767225600&sig=...' },
  handler: async (req, res) => { const url = signedUrl(safeKey(req.params[0])); res.json({ success: true, url, data: { url } }); },
});
define({
  method: 'GET', path: '/file/*/exists', summary: 'Check whether a stored file exists', screen: 'Document and photo viewers',
  response: { success: true, exists: true },
  handler: async (req, res) => { const exists = objectExists(safeKey(req.params[0])); res.json({ success: true, exists, data: { exists } }); },
});
define({
  method: 'DELETE', path: '/file/*', summary: 'Delete a stored file (uploader, module writer or administrator)', screen: 'Document and photo viewers',
  response: { success: true },
  handler: async (req, res) => {
    const key = safeKey(req.params[0]);
    const doc = await findDocument(key);
    if (!doc) throw notFound('File not found');
    if (doc.category === 'e-signatures') throw forbidden('Signature images are revoked through E-signatures, not deleted');
    if (!canModify(req.user, doc)) throw forbidden('You can only delete files you uploaded or files of a module you can edit');
    await deleteObject(key);
    await query('INSERT INTO audit_log(user_id, username, entity, entity_id, action) VALUES ($1,$2,\'document\',$3,\'delete\')', [req.user.id, req.user.username, key]);
    res.json({ success: true, message: 'File deleted' });
  },
});

/**
 * Object download: a signed link (?exp=&sig=) or a bearer header. Served with nosniff and a sandbox CSP; only images
 * and PDF are shown inline, everything else is an attachment. Types outside the allow-list are sent as
 * application/octet-stream.
 */
async function serveObject(req, res) {
  const key = safeKey(req.params[0]);
  const signed = verifyFileSignature(key, req.query.exp, req.query.sig);
  if (!signed) {
    if (!req.headers.authorization) throw unauthorized(req.query.sig ? 'This file link has expired; reload the page to get a new one' : 'Sign in to open this file');
    await authenticate(req);
  }
  const doc = await findDocument(key);
  if (!doc || !objectExists(key)) throw notFound('File not found');
  // e-signature images are never served by key (modules/e-signatures: GET /api/e-signatures/:id/image checks the caller)
  if (doc.category === 'e-signatures') throw forbidden('Signature images are not available through file links');
  const stored = String(doc.content_type || '').split(';')[0].trim().toLowerCase();
  const known = [...await allowedTypes(), ...INLINE_TYPES];
  const type = known.includes(stored) && stored !== 'text/html' ? stored : 'application/octet-stream';
  const inline = INLINE_TYPES.includes(type);
  const fileName = String(doc.file_name || 'file').replace(/[\r\n"]/g, '_');
  res.type(type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Browser PDF viewers refuse to render a sandboxed document, so a PDF keeps the API's default CSP (helmet: no
  // inline script, no plug-in objects); every other file is sandboxed (no script, no same-origin access).
  if (type !== 'application/pdf') res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  // A signed link may be cached for as long as it is valid (screens re-render the same image URL); bearer downloads 5 minutes.
  const maxAge = signed ? Math.max(0, Number(req.query.exp) - Math.floor(Date.now() / 1000)) : 300;
  res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
  res.sendFile(resolveKey(key));
}
define({
  method: 'GET', path: '/object/*', auth: false, summary: 'Download a stored file: bearer header or signed link (?exp=&sig=, from any API response)', screen: 'Document and photo viewers',
  query: { exp: 1767225600, sig: '<hmac>' }, response: '(file)', handler: serveObject,
});

/** Older generated-file links (/api/upload/file/<key>) are served by the same handler. */
const legacy = moduleRouter('Files (S3 API)', '/upload');
legacy.define({
  method: 'GET', path: '/file/*', auth: false, summary: 'Download a stored file (older link form of /s3/object)', screen: 'Receipts / disbursements print',
  query: { exp: 1767225600, sig: '<hmac>' }, response: '(file)', handler: serveObject,
});

export default router;
export const mount = '/s3';
export const extraMounts = [['/upload', legacy.router]];
