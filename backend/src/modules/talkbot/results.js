/**
 * Talkbot call results (FRS LEAD-09 4.2): the Call Records export of the Talkbot platform is uploaded on a call list Sent
 * to Talkbot (or with results already loaded: a second calling day adds attempts). Each row is one call attempt, matched
 * to its line by Contact ID (the policy number of the Contact Import file), else by Contact Number when one line only
 * has it; a Call ID is loaded once. The outcome of every line touched is derived again from all its attempts
 * (outcomes.js), a manual outcome is kept until an attempt of a better rank comes, and an outcome that changes is
 * written on the renewal timeline of the policy as a Talkbot Call activity.
 */
import { many, one, query, runInTransaction } from '../../db/pool.js';
import { HttpError, badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { config } from '../../config.js';
import { businessTimeZone, isoDate, today } from '../../lib/dates.js';
import { readXlsx } from '../documents/xlsx.js';
import { normKey } from '../documents/tabular.js';
import { saveFile } from '../masters/helpers.js';
import { activity, ensureRenewal } from '../renewals/service.js';
import { CONFIRMED, OUTCOME_LABELS, OUTCOMES, deriveLine, rankOf, rulesOf } from './outcomes.js';
import { LIST_STATUS, mobileOf } from './service.js';
import { CALL_RECORD_COLUMNS } from './columns.js';


/** Offset of the business time zone at an instant, in minutes (Asia/Manila: +480). */
function zoneOffset(tz, at) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at).map((p) => [p.type, p.value]));
  const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((local - at.getTime()) / 60000);
}

/** Call Time DD/MM/YYYY HH:MM:SS in the business time zone (or an Excel date serial) -> Date; null when not a valid date and time. */
export function parseCallTime(v, tz) {
  const s = String(v ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const ms = Math.round((Number(s) - 25569) * 86400000);
    const local = new Date(ms);
    return Number.isNaN(local.getTime()) ? null : new Date(ms - zoneOffset(tz, local) * 60000);
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const [d, mo, y, h, mi, se] = [m[1], m[2], m[3], m[4], m[5], m[6] || '0'].map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi, se);
  const check = new Date(wall);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1 || h > 23 || mi > 59 || se > 59) return null;
  return new Date(wall - zoneOffset(tz, check) * 60000);
}

/** Date of Callback YYYY-MM-DD (or DD/MM/YYYY); null when empty or not a date. */
const callbackOf = (v) => {
  const s = String(v ?? '').trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : (/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s) || []).slice(1).reverse().map((x) => x.padStart(2, '0')).join('-');
  return iso && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) && new Date(`${iso}T00:00:00Z`).toISOString().startsWith(iso) ? iso : null;
};

/** The rows of the uploaded workbook keyed by column, with the header checked (FR-TBT-010). */
function readCallRecords(file) {
  const name = String(file?.originalname || '').toLowerCase();
  const isZip = file?.buffer?.[0] === 0x50 && file?.buffer?.[1] === 0x4b;
  if (!file?.buffer?.length || !name.endsWith('.xlsx') || !isZip) throw badRequest('Upload the Talkbot Call Records file as Excel (.xlsx)', [{ path: 'file', message: 'Upload the Talkbot Call Records file as Excel (.xlsx)' }]);
  let table;
  try {
    table = readXlsx(file.buffer);
  } catch (e) {
    if (/more than/.test(e.message)) {
      const message = `The file has more than ${config.importMaxRows.toLocaleString('en-US')} rows; at most ${config.importMaxRows.toLocaleString('en-US')} rows can be loaded at once`;
      throw badRequest(message, [{ path: 'file', message }]);
    }
    throw badRequest(`Could not read the file: ${e.message}`);
  }
  const header = (table[0] || []).map(normKey);
  const index = {};
  for (const c of CALL_RECORD_COLUMNS) {
    const i = header.indexOf(normKey(c.header));
    if (i < 0) {
      const message = `The file has no column ${c.header}. Upload the Call Records export of the Talkbot platform.`;
      throw badRequest(message, [{ path: 'file', message }]);
    }
    index[c.key] = i;
  }
  const rows = table.slice(1).map((r, i) => ({ rowNo: i + 2, ...Object.fromEntries(Object.entries(index).map(([k, ix]) => [k, String(r[ix] ?? '').trim()])) }))
    .filter((r) => Object.keys(index).some((k) => r[k] !== ''));
  return rows;
}

/** The Talkbot outcome a line gets from its attempts and its manual outcome (FR-TBT-012 R9). */
function nextOutcome(line, derived, rules) {
  if (line.outcome_source === 'manual') {
    const manualRank = rankOf(line.outcome, rules);
    if (derived.rank === null || derived.rank >= manualRank) return null;
  }
  return derived;
}

/** The Talkbot Call activity of a line on the renewal timeline (FR-TBT-013); opens the renewal when there is none. */
async function timeline(line, list, user, { outcome, detail, callbackDate, attempts, manual = false, remark = null }) {
  let renewalId = line.renewal_id;
  try {
    renewalId = renewalId || (await ensureRenewal(line.policy_id, user)).id;
  } catch {
    return null;
  }
  const label = OUTCOME_LABELS[outcome] || outcome;
  const description = manual
    ? `Talkbot Call - ${label} (recorded by hand) - ${list.list_number}${remark ? `: ${remark}` : ''}`
    : `Talkbot Call - ${label} - ${list.list_number}${list.task_name ? ` (${list.task_name})` : ''}, ${attempts} attempt${attempts === 1 ? '' : 's'}`;
  // the renewal's contact attempts go up once per call list, not per call
  const seen = await one("SELECT 1 FROM renewal_activities WHERE renewal_id = $1 AND activity_type = 'Talkbot Call' AND details->>'listNumber' = $2", [renewalId, list.list_number]);
  await activity(null, renewalId, user, { type: 'Talkbot Call', method: 'Phone', description, outcome: label,
    nextAction: outcome === 'call-back' && callbackDate ? 'Call the client back' : null, followUpDate: outcome === 'call-back' ? callbackDate || null : null,
    details: { listNumber: list.list_number, taskName: list.task_name, attempts, talkbotDetail: detail, manual } });
  await query('UPDATE renewals SET contact_attempts = contact_attempts + $2, last_contact_at = now(), updated_at = now() WHERE id = $1', [renewalId, seen ? 0 : 1]);
  await query('UPDATE talkbot_call_lines SET renewal_id = $2 WHERE id = $1', [line.id, renewalId]);
  return renewalId;
}

async function loadList(id) {
  const l = await one('SELECT * FROM talkbot_call_lists WHERE id = $1 OR list_number = $1', [String(id)]);
  if (!l) throw notFound('Call list not found');
  return l;
}

/** Derive the outcome of lines again from their attempts and apply it (timeline entry when it changes). Returns the lines changed. */
async function rederive(lines, list, user, rules) {
  let changed = 0;
  for (const line of lines) {
    const attempts = (await many(`SELECT result, call_status AS "callStatus", call_result AS "callResult", callback_date AS "callbackDate", drop_off_point AS "dropOffPoint",
        call_time AS "callTime", id FROM talkbot_call_attempts WHERE line_id = $1 ORDER BY call_time, id`, [line.id]));
    const derived = deriveLine(attempts, rules);
    for (const a of derived.classified) await query('UPDATE talkbot_call_attempts SET outcome = $2, outcome_rank = $3 WHERE id = $1', [a.id, a.outcome, a.rank]);
    const last = attempts.length ? attempts[attempts.length - 1].callTime : null;
    await query('UPDATE talkbot_call_lines SET attempts = $2, last_call_at = $3 WHERE id = $1', [line.id, attempts.length, last]);
    const next = nextOutcome(line, derived, rules);
    if (!next || (next.outcome === line.outcome && line.outcome_source === 'file')) continue;
    const callbackDate = next.outcome === 'call-back' ? next.attempt?.callbackDate || null : null;
    await query(`UPDATE talkbot_call_lines SET outcome = $2, outcome_detail = $3, outcome_rank = $4, outcome_at = $5, outcome_source = 'file', callback_date = $6,
        manual_remark = NULL, manual_by = NULL WHERE id = $1`, [line.id, next.outcome, next.detail, next.rank, next.attempt?.callTime || new Date(), callbackDate]);
    if (next.outcome !== line.outcome) {
      await timeline(line, list, user, { outcome: next.outcome, detail: next.detail, callbackDate, attempts: attempts.length });
      changed += 1;
    }
  }
  return changed;
}

/**
 * Upload results (FR-TBT-010, 011, 012, 013): load the Call Records file on a call list. confirmTaskName: load a file
 * whose Task Name differs from the task name the list was sent as (otherwise refused with code TASK_NAME_DIFFERS).
 * Returns { uploadNumber, message, total, loaded, failed, errors: [{ row, message }], outcomeCounts, changed }.
 */
export async function uploadResults(listId, file, { confirmTaskName = false } = {}, user) {
  const list = await loadList(listId);
  if (!['sent', 'results-loaded'].includes(list.status)) {
    if (['draft'].includes(list.status)) throw badRequest('Mark the call list as sent to Talkbot before you upload results');
    throw conflict(`Call list ${list.list_number} is ${LIST_STATUS[list.status]}; results can no longer be uploaded`);
  }
  const rows = readCallRecords(file);
  const max = Number(await getSetting('talkbot.max_upload_rows', 20000)) || 20000;
  if (rows.length > max) {
    const message = `The file has ${rows.length.toLocaleString('en-US')} rows; at most ${max.toLocaleString('en-US')} rows can be loaded at once`;
    throw badRequest(message, [{ path: 'file', message }]);
  }
  if (!rows.length) throw badRequest('The file has no data rows (first row must be the column headers)');
  const fileTask = rows.find((r) => r.taskName)?.taskName || '';
  if (list.task_name && fileTask && fileTask.toLowerCase() !== list.task_name.toLowerCase() && !confirmTaskName) {
    const message = `The file is for Talkbot task ${fileTask} but the call list was sent as ${list.task_name}. Load it anyway?`;
    throw new HttpError(409, message, [{ path: 'file', code: 'TASK_NAME_DIFFERS', message }]);
  }
  const tz = await businessTimeZone();
  const rules = rulesOf(await getSetting('talkbot.outcome_rules', null));
  const saved = await saveFile({ category: 'talkbot-call-records', fileName: file.originalname, content: file.buffer, contentType: file.mimetype,
    entity: 'talkbot-call-list', entityId: list.id, userId: user?.id ?? null });
  return runInTransaction(async () => {
    const lines = await many(`SELECT l.*, p.policy_number FROM talkbot_call_lines l JOIN policies p ON p.id = l.policy_id WHERE l.list_id = $1 AND l.line_status = 'active'`, [list.id]);
    const byPolicy = new Map(lines.map((l) => [l.policy_number.toLowerCase(), l]));
    const byMobile = new Map();
    for (const l of lines) if (l.phone) byMobile.set(l.phone, [...(byMobile.get(l.phone) || []), l]);
    const known = new Set((await many('SELECT call_id FROM talkbot_call_attempts WHERE call_id = ANY($1)', [rows.map((r) => r.callId).filter(Boolean)])).map((r) => r.call_id));
    const n = (await one('SELECT COALESCE(max(upload_number), 0) + 1 AS n FROM talkbot_call_uploads WHERE list_id = $1', [list.id])).n;
    const upload = await one(`INSERT INTO talkbot_call_uploads(list_id, upload_number, file_key, file_name, file_size, task_name, rows_total, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [list.id, n, saved.key, file.originalname, file.size, fileTask || null, rows.length, user?.id ?? null]);
    const errors = [];
    const touched = new Map();
    for (const r of rows) {
      const fail = (message) => errors.push({ row: r.rowNo, message: `Row ${r.rowNo}: ${message}` });
      if (!r.callId) { fail('Call ID is empty'); continue; }
      if (known.has(r.callId)) { fail(`Call ID ${r.callId} was already loaded`); continue; }
      let line = r.contactId ? byPolicy.get(r.contactId.toLowerCase()) : null;
      if (!line && r.contactId && !mobileOf(r.contactNumber)) { fail(`Contact ID ${r.contactId} is not on call list ${list.list_number}`); continue; }
      if (!line) {
        const same = byMobile.get(mobileOf(r.contactNumber)) || [];
        if (same.length > 1) { fail(`Contact Number ${r.contactNumber} belongs to more than one account on the list`); continue; }
        if (!same.length) { fail(r.contactId ? `Contact ID ${r.contactId} is not on call list ${list.list_number}` : `Contact Number ${r.contactNumber} is not on call list ${list.list_number}`); continue; }
        [line] = same;
      }
      const at = parseCallTime(r.callTime, tz);
      if (!at) { fail(`Call Time ${r.callTime} is not a valid date and time`); continue; }
      await query(`INSERT INTO talkbot_call_attempts(line_id, upload_id, row_no, call_id, contact_id, contact_name, contact_number, result, call_time, duration_seconds,
          tags, drop_off_point, call_status, call_result, callback_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [line.id, upload.id, r.rowNo, r.callId, r.contactId || null, r.contactName || null, r.contactNumber || null, r.result || null, at,
        /^\d+$/.test(r.duration) ? Number(r.duration) : null, r.tags || null, r.dropOffPoint || null, r.callStatus || null, r.callResult || null, callbackOf(r.callbackDate)]);
      known.add(r.callId);
      touched.set(line.id, line);
    }
    const loaded = rows.length - errors.length;
    const changed = await rederive([...touched.values()], list, user, rules);
    const counts = Object.fromEntries((await many(`SELECT outcome, count(*)::int AS n FROM talkbot_call_lines WHERE list_id = $1 AND line_status = 'active' GROUP BY outcome`, [list.id]))
      .map((x) => [x.outcome, x.n]));
    await query('UPDATE talkbot_call_uploads SET rows_loaded = $2, rows_failed = $3, errors = $4, outcome_counts = $5 WHERE id = $1',
      [upload.id, loaded, errors.length, JSON.stringify(errors), JSON.stringify(counts)]);
    if (loaded) await query("UPDATE talkbot_call_lists SET status = 'results-loaded', last_upload_at = now(), updated_at = now() WHERE id = $1", [list.id]);
    const total = rows.length.toLocaleString('en-US');
    return { uploadId: upload.id, uploadNumber: n, listNumber: list.list_number, total: rows.length, loaded, failed: errors.length, errors, outcomeCounts: counts, changed,
      message: `Processed ${total} rows: ${loaded.toLocaleString('en-US')} loaded, ${errors.length.toLocaleString('en-US')} failed` };
  });
}

/**
 * Record outcome (FR-TBT-014): set the outcome of a line by hand with a remark, on a list Sent to Talkbot or with
 * results loaded. A manual Willing to renew counts as Talkbot-confirmed from its date.
 */
export async function recordOutcome(listId, lineRef, { outcome, date, remark }, user) {
  const list = await loadList(listId);
  if (!['sent', 'results-loaded'].includes(list.status)) throw conflict(`Call list ${list.list_number} is ${LIST_STATUS[list.status]}; an outcome can be recorded once it is sent`);
  const line = await one(`SELECT l.*, p.policy_number FROM talkbot_call_lines l JOIN policies p ON p.id = l.policy_id
    WHERE l.list_id = $1 AND l.line_status = 'active' AND (l.id::text = $2 OR p.policy_number = $2)`, [list.id, String(lineRef)]);
  if (!line) throw notFound('The account is not on this call list');
  if (!OUTCOMES.includes(outcome) || outcome === 'not-called') throw badRequest('Choose the outcome', [{ path: 'outcome', message: 'Choose the outcome' }]);
  const text = String(remark ?? '').trim();
  if (!text) throw badRequest('Enter a remark for the outcome you record', [{ path: 'remark', message: 'Enter a remark for the outcome you record' }]);
  const day = isoDate(date) || await today();
  if (day > await today()) throw badRequest('The date of the outcome cannot be in the future', [{ path: 'date', message: 'The date of the outcome cannot be in the future' }]);
  const rules = rulesOf(await getSetting('talkbot.outcome_rules', null));
  return runInTransaction(async () => {
    await query(`UPDATE talkbot_call_lines SET outcome = $2, outcome_detail = $3, outcome_rank = $4, outcome_at = $5::date + time '12:00', outcome_source = 'manual',
        manual_remark = $3, manual_by = $6, callback_date = CASE WHEN $2 = 'call-back' THEN callback_date END WHERE id = $1`,
    [line.id, outcome, text, rankOf(outcome, rules), day, user?.id ?? null]);
    await timeline(line, list, user, { outcome, detail: text, callbackDate: null, attempts: line.attempts, manual: true, remark: text });
    const after = await one('SELECT * FROM talkbot_call_lines WHERE id = $1', [line.id]);
    return { listNumber: list.list_number, policyNumber: line.policy_number, before: { outcome: line.outcome, source: line.outcome_source, detail: line.outcome_detail },
      after: { outcome: after.outcome, source: 'manual', detail: text, date: day }, confirmed: outcome === CONFIRMED,
      message: `Outcome recorded for policy ${line.policy_number}` };
  });
}

/** The attempts of a line with the upload they came from (FR-TBT-031). */
export async function lineAttempts(listId, lineId) {
  const list = await loadList(listId);
  return many(`SELECT a.id, a.call_id AS "callId", a.result, a.call_time AS "callTime", a.duration_seconds AS "duration", a.call_status AS "callStatus",
      a.call_result AS "callResult", a.drop_off_point AS "dropOffPoint", a.callback_date AS "callbackDate", a.tags, a.outcome, u.upload_number AS "uploadNumber",
      u.file_name AS "fileName", a.row_no AS "rowNo"
    FROM talkbot_call_attempts a JOIN talkbot_call_lines l ON l.id = a.line_id JOIN talkbot_call_uploads u ON u.id = a.upload_id
    WHERE l.list_id = $1 AND l.id::text = $2 ORDER BY a.call_time, a.id`, [list.id, String(lineId)]);
}

/** The uploads of a call list, newest first (file kept for talkbot.file_retention_days). */
export async function listUploads(listId) {
  const list = await loadList(listId);
  const rows = await many(`SELECT u.*, us.display_name AS uploaded_by_name FROM talkbot_call_uploads u LEFT JOIN users us ON us.id = u.uploaded_by
    WHERE u.list_id = $1 ORDER BY u.upload_number DESC`, [list.id]);
  return rows.map((u) => ({ id: u.id, uploadNumber: u.upload_number, fileName: u.file_name, fileSize: Number(u.file_size), taskName: u.task_name, total: u.rows_total,
    loaded: u.rows_loaded, failed: u.rows_failed, errors: u.errors || [], outcomeCounts: u.outcome_counts || {}, uploadedBy: u.uploaded_by_name, uploadedAt: u.uploaded_at,
    fileAvailable: Boolean(u.file_key) && !u.file_purged_at }));
}

/** The stored file of an upload: { key, fileName } (404 once removed after talkbot.file_retention_days). */
export async function uploadFile(listId, uploadId) {
  const list = await loadList(listId);
  const u = await one('SELECT * FROM talkbot_call_uploads WHERE list_id = $1 AND (id = $2 OR upload_number::text = $2)', [list.id, String(uploadId)]);
  if (!u) throw notFound('Upload not found');
  if (!u.file_key || u.file_purged_at) throw notFound(`The file of upload ${u.upload_number} of ${list.list_number} is no longer kept`);
  return { key: u.file_key, fileName: u.file_name };
}

/** talkbot.outcome_rules changed: the outcomes of the lists not closed or cancelled are derived again (FR-TBT-012). */
export async function rederiveOpenLists(user = null) {
  const rules = rulesOf(await getSetting('talkbot.outcome_rules', null));
  const lists = await many("SELECT * FROM talkbot_call_lists WHERE status IN ('sent', 'results-loaded')");
  let changed = 0;
  for (const list of lists) {
    const lines = await many("SELECT * FROM talkbot_call_lines WHERE list_id = $1 AND line_status = 'active' AND attempts > 0", [list.id]);
    changed += await runInTransaction(() => rederive(lines, list, user, rules));
  }
  return { lists: lists.length, changed };
}

