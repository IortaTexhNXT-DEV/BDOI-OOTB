/**
 * The text of a failed API call as the user should read it: the field messages of a validation error (one line, or
 * a bullet list when there are several), the server's own message otherwise, and a plain sentence when the server
 * gave none. Field paths, status codes and the generic "Validation failed" headline stay out of the screen.
 *
 *   throw new Error(apiErrorMessage(body, response.status));
 */
import i18n from "../i18n";

/** Headlines that only say a request failed; the field messages say why. */
const GENERIC = /^(validation failed|validation error|bad request|invalid request|request failed|unprocessable entity)\b/i;
/** A message built by older code: "Validation failed (path: message; path: message)" or "...: message, message". */
const LEGACY = /^(validation failed|validation error|bad request|request failed)\s*(?:\((.*)\)|:\s*(.+))$/is;

const tr = (key, fallback) => {
  const text = i18n.t(key);
  return text && text !== key ? text : fallback;
};

const unique = (list) => [...new Set(list.map((m) => String(m).trim()).filter(Boolean))];

/** One line for a single message, a bullet per message for several. */
export const messageList = (messages) => {
  const list = unique(messages);
  return list.length > 1 ? list.map((m) => `• ${m}`).join("\n") : list[0] || "";
};

/** The sentence for a failed call without a message of the server. */
export const statusMessage = (status) => {
  if (status === 403) return tr("apiErrors.forbidden", "You do not have permission to do this.");
  if (status === 404) return tr("apiErrors.notFound", "The record was not found. It may have been removed.");
  if (status === 409) return tr("apiErrors.conflict", "The record was changed by someone else. Reload it and try again.");
  if (status === 413) return tr("apiErrors.tooLarge", "The file is too large.");
  if (status >= 500) return tr("apiErrors.server", "The system could not complete the request. Please try again.");
  return tr("apiErrors.failed", "The request could not be completed.");
};

/** A field message the headline already states ("Password must contain a digit" in "Password must ..., contain a digit"). */
const stated = (message, field) => {
  const lower = message.toLowerCase();
  const text = field.toLowerCase();
  const tail = text.split(" ").slice(2).join(" ");
  return lower.includes(text) || (tail.length > 8 && lower.includes(tail));
};

/**
 * The user's text of an error answer ({ message, errors: [{ path, message }] }) of the API; `fallback` (else a
 * sentence for the status) when the answer says nothing.
 */
export const apiErrorMessage = (body, status, fallback) => {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const fields = unique(errors.map((e) => (typeof e === "string" ? e : e?.message)));
  const raw = body?.message || (typeof body?.error === "string" ? body.error : body?.error?.message) || "";
  const message = typeof raw === "string" && !GENERIC.test(raw.trim()) ? raw.trim() : "";
  if (fields.length) {
    if (!message) return messageList(fields);
    const rest = fields.filter((f) => !stated(message, f));
    return rest.length ? `${message}\n${messageList(rest)}` : message;
  }
  return message || fallback || statusMessage(status);
};

/**
 * A message as the user should read it, for text that was put together before reaching the toast: the field
 * messages of "Validation failed (brokerSlipId: At least two offers are needed; ...)" without the headline and paths.
 */
export const readableError = (text) => {
  const value = String(text ?? "").trim();
  const m = LEGACY.exec(value);
  if (!m) return value;
  const inner = (m[2] || m[3] || "").split(/;\s*|,\s+(?=[a-z][\w.[\]]*:\s)/i);
  const messages = inner.map((part) => part.replace(/^[\w.[\]]+:\s*/, ""));
  return messageList(messages) || value;
};
