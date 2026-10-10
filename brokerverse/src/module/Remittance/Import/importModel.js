/**
 * What the Import policy list dialog checks and shows before and after the server's validation: the file check made
 * in the browser against GET /remittance/imports/limits, the result chips of a validated import and the severity of a
 * row result.
 */

export const FILE_TYPES = [".xlsx", ".csv"];
export const RESULT_FILTERS = ["", "ready", "warnings", "errors"];

const KIND_SEVERITY = { ok: "success", warning: "warning", error: "danger" };

/** Chip severity of a row result kind (ok, warning, error). */
export const resultSeverity = (kind) => KIND_SEVERITY[kind] || "secondary";

/**
 * Why a chosen file is refused before it is sent ("type" or "size"), or null. The limits are the server's (maxBytes,
 * fileTypes); without them only the type is checked and the server checks the size.
 */
export const fileProblem = (file, limits) => {
  if (!file) return null;
  const types = limits?.fileTypes?.length ? limits.fileTypes : FILE_TYPES;
  const name = String(file.name || "").toLowerCase();
  if (!types.some((ext) => name.endsWith(String(ext).toLowerCase()))) return "type";
  if (limits?.maxBytes && Number(file.size) > Number(limits.maxBytes)) return "size";
  return null;
};

/** The error codes of POST /imports/validate that belong to the file field. */
export const FILE_CODES = ["FILE_TOO_LARGE", "FILE_TYPE", "FILE_MISSING", "TOO_MANY_ROWS"];

/** The chips of a validated import: Rows, Ready, Errors, Warnings ([{ key, count }]). */
export const countChips = (counts = {}) => [
  { key: "rows", count: counts.rows ?? 0 },
  { key: "ready", count: counts.ready ?? 0 },
  { key: "errors", count: counts.errors ?? 0 },
  { key: "warnings", count: counts.warnings ?? 0 },
];
