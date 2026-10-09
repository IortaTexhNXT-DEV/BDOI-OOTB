/**
 * Screen exports as CSV: the rows the screen shows, one column per entry of columns ([{ field, header }], field a
 * property name or (row) => value). The file starts with a byte order mark so that Excel reads it as UTF-8 (ñ, ₱).
 */
const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/** CSV text of rows (CRLF line ends). */
export const toCsv = (rows, columns) =>
  [
    columns.map((c) => cell(c.header)).join(","),
    ...(rows || []).map((r) => columns.map((c) => cell(typeof c.field === "function" ? c.field(r) : r?.[c.field])).join(",")),
  ].join("\r\n");

/** Downloads rows as a CSV file. */
export const downloadCsv = (fileName, rows, columns) => {
  const url = URL.createObjectURL(new Blob([`﻿${toCsv(rows, columns)}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
