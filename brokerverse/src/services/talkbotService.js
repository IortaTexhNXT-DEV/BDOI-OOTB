import { BASE_URL } from "../utility/constant";
import authService from "./authService";
import { apiErrorMessage } from "../utility/apiError";

/**
 * Talkbot call lists API (/talkbot, Operations > Renewals > Talkbot Calls): the lists and their accounts, the Contact
 * Import download, Mark as sent, cancel and close, the call results upload (through the ImportDialog), manual outcomes
 * and the renewal batch of the confirmed accounts.
 */
const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return s ? `?${s}` : "";
};
const handle = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(apiErrorMessage(body, response.status));
    error.status = response.status;
    error.errors = Array.isArray(body.errors) ? body.errors : [];
    throw error;
  }
  return body;
};
const headers = () => ({ "Content-Type": "application/json", ...authService.getAuthHeader() });
const get = async (path) => handle(await fetch(`${BASE_URL}${path}`, { headers: headers() }));
const send = async (method, path, payload = {}) => handle(await fetch(`${BASE_URL}${path}`, { method, body: JSON.stringify(payload), headers: headers() }));
const id = (v) => encodeURIComponent(v);
const T = "/talkbot";

/** Save a file the API answers (POST or GET) under the name of its Content-Disposition. */
const saveFile = async (path, fallbackName, method = "GET") => {
  const response = await fetch(`${BASE_URL}${path}`, { method, headers: { ...authService.getAuthHeader() } });
  if (!response.ok) await handle(response);
  const name = (response.headers.get("content-disposition") || "").match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return name;
};

const talkbotService = {
  options: async () => (await get(`${T}/options`)).data,
  preview: async (criteria) => (await send("POST", `${T}/preview`, criteria)).data,
  lists: async (params = {}) => get(`${T}/lists${qs(params)}`),
  list: async (listId, params = {}) => (await get(`${T}/lists/${id(listId)}${qs(params)}`)).data,
  create: (criteria) => send("POST", `${T}/lists`, criteria),
  removeLine: (listId, lineId, reason) => send("POST", `${T}/lists/${id(listId)}/lines/${id(lineId)}/remove`, { reasonCode: reason?.reasonCode, reason: reason?.note }),
  restoreLine: (listId, lineId) => send("POST", `${T}/lists/${id(listId)}/lines/${id(lineId)}/restore`),
  download: (listId, number) => saveFile(`${T}/lists/${id(listId)}/download`, `${number}_Contact_Import.xlsx`, "POST"),
  markSent: (listId, taskName) => send("POST", `${T}/lists/${id(listId)}/send`, { taskName }),
  cancel: (listId, reason) => send("POST", `${T}/lists/${id(listId)}/cancel`, { reasonCode: reason?.reasonCode, reason: reason?.note }),
  close: (listId) => send("POST", `${T}/lists/${id(listId)}/close`),
  recordOutcome: (listId, lineId, body) => send("POST", `${T}/lists/${id(listId)}/lines/${id(lineId)}/outcome`, body),
  attempts: async (listId, lineId) => (await get(`${T}/lists/${id(listId)}/lines/${id(lineId)}/attempts`)).data,
  uploads: async (listId) => (await get(`${T}/lists/${id(listId)}/uploads`)).data,
  uploadFile: (listId, upload) => saveFile(`${T}/lists/${id(listId)}/uploads/${id(upload.id)}/file`, upload.fileName),
  createRenewalBatches: (listId) => send("POST", `${T}/lists/${id(listId)}/renewal-batches`),
  templatePath: `${T}/results/template`,
  resultsPath: (listId) => `${T}/lists/${id(listId)}/results`,
};

export default talkbotService;
