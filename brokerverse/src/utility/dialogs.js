/**
 * In-app replacements for the browser's native window.alert / window.confirm / window.prompt.
 *
 * <AppDialogs /> (components/AppDialogs, mounted once in App.js) registers the application toast and the host of the
 * shared confirmation dialog (components/ConfirmDialog), in which confirmAction and promptText ask their question.
 */
import i18n from "../i18n";
import { openConfirm } from "../components/ConfirmDialog/openConfirm";
import logger from "./logger";
import { readableError } from "./apiError";

let toastRef = null;

/** Called by <AppDialogs /> with the ref of the application toast (a components/Toast CustomToast). */
export const registerAppToast = (ref) => {
  toastRef = ref;
};

const tr = (key, fallback) => {
  const text = i18n.t(key);
  return text && text !== key ? text : fallback;
};

const SUMMARY = {
  success: () => tr("common.success", "Success"),
  error: () => tr("common.error", "Error"),
  warn: () => tr("common.warning", "Warning"),
  info: () => tr("common.information", "Information"),
};

const text = (message) => {
  if (message === null || message === undefined) return "";
  if (message instanceof Error) return message.message;
  return typeof message === "string" ? message : String(message);
};

/**
 * Show a message in the application toast (in place of alert()).
 * @param {"success"|"error"|"warn"|"info"} severity
 * @param {*} message
 */
export const notify = (severity, message) => {
  const detail = severity === "error" ? readableError(text(message)) : text(message);
  const toast = toastRef?.current;
  if (toast?.showToast) {
    toast.showToast(severity, (SUMMARY[severity] || SUMMARY.info)(), detail);
  } else {
    // the app shell is not mounted (e.g. unit tests): keep the message visible in the console
    // eslint-disable-next-line no-console
    logger.warn(`[${severity}] ${detail}`);
  }
};

export const notifyError = (message) => notify("error", message);
export const notifySuccess = (message) => notify("success", message);
export const notifyWarn = (message) => notify("warn", message);
export const notifyInfo = (message) => notify("info", message);

/**
 * In-app text prompt (in place of window.prompt), shown in the shared confirmation dialog (components/ConfirmDialog) with
 * a text box. Resolves the text entered (trimmed) when the user confirms, null when they cancel or close the dialog, so
 * `const reason = await promptText(msg); if (!reason) return;` keeps the native behaviour.
 * @param {string} message label of the box
 * @param {string} [defaultValue]
 * @param {{ header?: string, title?: string, acceptLabel?: string, rejectLabel?: string, multiline?: boolean,
 *   required?: boolean, minLength?: number, maxLength?: number, message?: string, facts?: Array, note?: string,
 *   severity?: "neutral"|"warning"|"danger" }} [options] the summary of what is decided (message, facts) is shown above the box
 * @returns {Promise<string|null>}
 */
export const promptText = async (
  message,
  defaultValue = "",
  { header, title, acceptLabel, rejectLabel, multiline = true, required = true, minLength, maxLength, facts, note, severity = "neutral", message: summary } = {}
) => {
  const value = await openConfirm({
    title: title || header || tr("common.enterDetails", "Enter details"),
    severity,
    message: summary,
    facts,
    note,
    input: {
      type: multiline ? "textarea" : "text",
      label: text(message),
      required,
      minLength,
      maxLength,
      defaultValue: defaultValue === null || defaultValue === undefined ? "" : String(defaultValue),
    },
    confirmLabel: acceptLabel || tr("confirmDialog.confirm", "Confirm"),
    cancelLabel: rejectLabel,
  });
  return value === null || value === undefined || value === "" ? null : value;
};

/**
 * In-app confirmation (in place of window.confirm), shown in the shared confirmation dialog (components/ConfirmDialog).
 * Resolves true when the user confirms, false when they cancel or close the dialog, so
 * `if (!(await confirmAction(msg, { header, acceptLabel }))) return;` keeps the native behaviour. Give the action as a
 * verb (acceptLabel "Delete template") and the record it applies to as facts ([{ label, value, type }]).
 * @param {string} message one sentence: what is about to happen
 * @param {{ header?: string, title?: string, acceptLabel?: string, rejectLabel?: string, danger?: boolean,
 *   severity?: "neutral"|"warning"|"danger", facts?: Array, note?: string }} [options]
 * @returns {Promise<boolean>}
 */
export const confirmAction = (message, { header, title, acceptLabel, rejectLabel, danger = false, severity, facts, note } = {}) =>
  openConfirm({
    title: title || header || tr("common.confirm", "Confirm"),
    severity: severity || (danger ? "danger" : "warning"),
    message: text(message),
    facts,
    note,
    confirmLabel: acceptLabel || tr("confirmDialog.confirm", "Confirm"),
    cancelLabel: rejectLabel,
  });
