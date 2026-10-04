/**
 * The one PDF engine of the platform (no dependencies): documents (quotations, schedules, slips, receipts, vouchers,
 * statements, claim letters) and report listings. Every page carries the letterhead of the Company master
 * (lib/letterhead.js) and a footer with the company, "Generated <date time> by <user>" and "Page X of Y".
 *
 *   const pdf = await renderPdf(spec)               // letterhead, formats and user filled in, then buildPdf
 *   const pdf = buildPdf({ ...await printContext(), ...spec })
 *   const pdf = await renderPdfBatch([spec, spec])  // several documents in one file (one page group each)
 *   const pdf = await renderReportPdf({ title, params, columns, rows, totals })
 *
 * The document spec is described in ./layout.js.
 */
import { one } from '../../db/pool.js';
import { getSetting } from '../settings.js';
import { businessTimeZone } from '../dates.js';
import { getLetterhead } from '../letterhead.js';
import { currentUser } from '../requestContext.js';
import { PdfWriter, PAGE_SIZES } from './writer.js';
import { DocRenderer } from './layout.js';
import { DEFAULT_FORMAT, formatDateTime } from './format.js';
import { revealInPlace } from '../pii.js';
import { protectExportRows } from '../piiPolicy.js';
import { prepareTable, allocateWidths } from './table.js';

export { toWinAnsi, textWidth, wrapText } from './fonts.js';
export { formatAmount, formatDate, formatDateTime, humanize, amountInWords, numberToWords } from './format.js';

/** Render one or more specs into one PDF; each spec is its own page group (its own "Page X of Y"). */
export function buildPdfBatch(specs, { title } = {}) {
  const list = specs.filter(Boolean);
  const first = list[0] || {};
  const writer = new PdfWriter({ title: title || [first.title, first.number].filter(Boolean).join(' '), author: first.letterhead?.name || '', subject: first.title || '' });
  // personal identifiers encrypted at rest are printed in full on documents (lib/pii.js)
  for (const spec of list) revealInPlace(spec);
  for (const spec of list.length ? list : [{ title: 'Document' }]) new DocRenderer(writer, spec, spec.render || {}).render();
  return writer.toBuffer();
}

/** Render a document spec into a PDF Buffer (synchronous). A spec with `documents` renders each of them in turn. */
export function buildPdf(spec) {
  if (Array.isArray(spec?.documents)) {
    const shared = { ...spec };
    delete shared.documents;
    return buildPdfBatch(spec.documents.map((d) => ({ ...shared, ...d })), { title: spec.title });
  }
  return buildPdfBatch([spec]);
}

/** Formats used in documents: general.date_format, currency.decimals, currency.default, general.timezone. */
export async function printFormat() {
  const decimals = Number(await getSetting('currency.decimals', 2));
  return {
    dateFormat: (await getSetting('general.date_format', DEFAULT_FORMAT.dateFormat)) || DEFAULT_FORMAT.dateFormat,
    decimals: Number.isInteger(decimals) && decimals >= 0 && decimals <= 4 ? decimals : 2,
    currency: (await getSetting('currency.default', 'PHP')) || 'PHP',
    timeZone: await businessTimeZone(),
  };
}

/** Display name of a user ({ id } / id / username), for the "Generated ... by" footer line. */
async function displayNameOf(user) {
  if (!user) return '';
  if (typeof user === 'object' && user.displayName) return user.displayName;
  const id = typeof user === 'object' ? user.id : user;
  const row = id ? await one('SELECT display_name, username FROM users WHERE id::text = $1::text OR username = $1::text LIMIT 1', [String(id)]).catch(() => null) : null;
  return row?.display_name || row?.username || (typeof user === 'object' ? user.username || '' : '');
}

/**
 * What every printed document needs besides its content: { letterhead, format, generatedAt, generatedBy,
 * accentColor }. The user defaults to the signed-in user of the current request.
 */
export async function printContext({ user } = {}) {
  const format = await printFormat();
  const who = user === undefined ? currentUser() : user;
  return {
    letterhead: await getLetterhead(), format, generatedAt: formatDateTime(new Date(), format),
    generatedBy: (await displayNameOf(who)) || (typeof who === 'string' ? who : ''),
    accentColor: (await getSetting('documents.accent_color', '#1f4e79')) || '#1f4e79',
  };
}

/** printContext + buildPdf. */
export async function renderPdf(spec, opts = {}) {
  return buildPdf({ ...(await printContext(opts)), ...stripUndefined(spec) });
}

/** printContext + buildPdfBatch (bulk prints: one receipt / voucher per page group). */
export async function renderPdfBatch(specs, opts = {}) {
  const ctx = await printContext(opts);
  return buildPdfBatch(specs.map((s) => ({ ...ctx, ...stripUndefined(s) })), { title: opts.title });
}

const stripUndefined = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined));

/**
 * Page size and table font for a wide listing: the configured size in landscape with the font reduced step by step
 * down to 6 pt, then A3 landscape. Returns { pageSize, fontSize }.
 */
export function fitReport(table, { pageSize = 'A4', format } = {}) {
  const prepared = prepareTable(table, { ...DEFAULT_FORMAT, ...(format || {}) });
  const sizes = [7.5, 7, 6.5, 6];
  const candidates = [...new Set([String(pageSize).toUpperCase() in PAGE_SIZES ? String(pageSize).toUpperCase() : 'A4', 'A3'])];
  for (const ps of candidates) {
    const avail = PAGE_SIZES[ps][1] - 60;
    for (const fontSize of sizes) if (allocateWidths(prepared, avail, fontSize).fits) return { pageSize: ps, fontSize, prepared };
  }
  return { pageSize: 'A3', fontSize: 6, prepared };
}

/**
 * A report listing: letterhead, title, parameter line, one table (header repeated on every page, zebra rows, totals row).
 * @param {{title: string, params?: string, columns: {key: string, label: string, type?: string}[], rows: object[],
 *   totals?: object, pageSize?: string, sections?: object[]}} report
 */
export function buildReportPdf({ title, params = '', columns, rows, totals = null, pageSize = 'A4', sections = [], ...ctx }) {
  // a listing follows the masking of the user who runs it (lib/piiPolicy.js)
  const table = { columns, rows: protectExportRows(columns || [], rows || []), totals: totals && Object.keys(totals).length ? totals : null };
  const fit = fitReport(table, { pageSize, format: ctx.format });
  return buildPdf({ ...ctx, title, params, orientation: 'landscape', pageSize: fit.pageSize,
    sections: [{ table: { ...table, prepared: fit.prepared, fontSize: fit.fontSize } }, ...sections] });
}

export async function renderReportPdf(report, opts = {}) {
  return buildReportPdf({ ...(await printContext(opts)), ...stripUndefined(report) });
}

/** Send a PDF buffer (inline by default: the front end opens it in a tab or downloads it as a blob). */
export function sendPdf(res, buffer, fileName, disposition = 'inline') {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}
