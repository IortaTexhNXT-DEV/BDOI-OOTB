import { getRequest, postRequest } from "../utility/commonServices";
import request from "../utility/interceptor";

/**
 * Go-live data workbench API (/data-load): the configuration and migration workbooks (templates, upload and dry-run
 * validation, errors workbook, load, history, reconciliation) and the environment comparison. System Administrator only.
 */
const enc = encodeURIComponent;
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

/** The server's message for a toast (a failed download answers JSON in a Blob). */
export const errorMessage = async (error, fallback) => {
  let body = error?.response?.data || {};
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    try {
      body = JSON.parse(await body.text());
    } catch {
      body = {};
    }
  }
  const detail = Array.isArray(body.errors) ? body.errors.map((e) => e.message).filter(Boolean).join("; ") : "";
  return body.message || detail || error?.message || fallback;
};

const data = (promise) => promise.then((r) => r.data.data);
const withMessage = (promise) => promise.then((r) => ({ data: r.data.data, message: r.data.message }));

/** Save a file answered by the server under the name it gives. */
const download = async (url, params, fallbackName) => {
  const response = await request.get(url, { params: clean(params), responseType: "blob" });
  const name = (response.headers?.["content-disposition"] || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const href = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
};

const goLiveDataService = {
  kits: () => data(getRequest("data-load/kits")),
  downloadTemplate: (kit, prefill) => download(`data-load/kits/${enc(kit)}/template`, { prefill: prefill ? "true" : undefined }, `GoLive_${kit}_Workbook.xlsx`),
  upload: (kit, file) => {
    const form = new FormData();
    form.append("kit", kit);
    form.append("file", file);
    return withMessage(request.post("data-load/batches", form));
  },
  batches: (params) => getRequest("data-load/batches", clean(params)).then((r) => ({ items: r.data.data, total: r.data.total })),
  batch: (id) => data(getRequest(`data-load/batches/${enc(id)}`)),
  validate: (id) => withMessage(postRequest(`data-load/batches/${enc(id)}/validate`, {})),
  load: (id, validRowsOnly) => withMessage(postRequest(`data-load/batches/${enc(id)}/load`, { validRowsOnly: !!validRowsOnly })),
  downloadErrors: (id) => download(`data-load/batches/${enc(id)}/errors`, {}, `GoLive_Batch${id}_Errors.xlsx`),
  downloadReconciliation: (id) => download(`data-load/batches/${enc(id)}/reconciliation`, {}, `GoLive_Reconciliation_Batch${id}.xlsx`),
  // environment comparison (never loads): an export compared with this environment, or file A with file B
  compare: (file, fileB, includeNumbering) => {
    const form = new FormData();
    form.append("file", file);
    if (fileB) form.append("fileB", fileB);
    form.append("includeNumbering", includeNumbering ? "true" : "false");
    return withMessage(request.post("data-load/compare", form));
  },
  comparisons: (params) => getRequest("data-load/compare", clean(params)).then((r) => ({ items: r.data.data, total: r.data.total })),
  comparison: (id) => data(getRequest(`data-load/compare/${enc(id)}`)),
  comparisonRows: (id, params) => getRequest(`data-load/compare/${enc(id)}/rows`, clean(params)).then((r) => ({ items: r.data.data, total: r.data.total })),
  downloadComparison: (id) => download(`data-load/compare/${enc(id)}/workbook`, {}, `GoLive_Environment_Comparison_${id}.xlsx`),
};

export default goLiveDataService;
