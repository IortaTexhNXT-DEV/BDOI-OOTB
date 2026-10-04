import { deleteRequest, getRequest, postRequest, putRequest } from "../utility/commonServices";

/**
 * Operations > My Work API (/my-work): open items waiting on the user, their team or everyone; the per-member team
 * breakdown; reassignment; the work diary (tasks) and the agenda.
 */
const enc = encodeURIComponent;
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

/** The server's message (with the field messages of a validation error), for toasts. */
export const errorMessage = (error, fallback) => {
  const body = error?.response?.data || {};
  const detail = Array.isArray(body.errors) ? body.errors.map((e) => e.message).filter(Boolean).join("; ") : "";
  if (body.message && detail && body.message !== "Validation failed") return body.message;
  return detail || body.message || error?.message || fallback;
};

const data = (promise) => promise.then((r) => r.data.data);
const page = (promise) => promise.then((r) => ({ rows: r.data.data || [], total: Number(r.data.total) || 0, counts: r.data.counts || null }));

const myWorkService = {
  summary: (scope = "me") => data(getRequest("my-work/summary", { scope })),
  items: (params) => page(getRequest("my-work/items", clean(params))),
  team: (params) => data(getRequest("my-work/team", clean(params))),
  agenda: (params) => data(getRequest("my-work/agenda", clean(params))),
  assignees: () => data(getRequest("my-work/assignees")),
  reassign: (body) => data(postRequest("my-work/items/reassign", body)),

  tasks: (params) => page(getRequest("my-work/tasks", clean(params))),
  task: (id) => data(getRequest(`my-work/tasks/${enc(id)}`)),
  createTask: (body) => data(postRequest("my-work/tasks", body)),
  updateTask: (id, body) => data(putRequest(`my-work/tasks/${enc(id)}`, body)),
  completeTask: (id, note) => data(postRequest(`my-work/tasks/${enc(id)}/complete`, { note: note || null })),
  reopenTask: (id) => data(postRequest(`my-work/tasks/${enc(id)}/reopen`, {})),
  cancelTask: (id) => data(deleteRequest(`my-work/tasks/${enc(id)}`)),
  records: (type, search) => data(getRequest("my-work/records", clean({ type, search }))),
};

export default myWorkService;
