/**
 * In-app replacements for the browser's native window.alert / window.confirm (D44).
 *
 * <AppDialogs /> (components/AppDialogs, mounted once in App.js) registers the application toast and renders the shared
 * PrimeReact <ConfirmDialog tagKey={APP_DIALOG_TAG} />. Screens that mount their own <ConfirmDialog /> (no tagKey) are not
 * affected: PrimeReact only opens the dialog whose tagKey matches the confirmDialog() call.
 */
import { confirmDialog } from "primereact/confirmdialog";
import i18n from "../i18n";

export const APP_DIALOG_TAG = "app-dialog";

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
  const detail = text(message);
  const toast = toastRef?.current;
  if (toast?.showToast) {
    toast.showToast(severity, (SUMMARY[severity] || SUMMARY.info)(), detail);
  } else {
    // the app shell is not mounted (e.g. unit tests): keep the message visible in the console
    // eslint-disable-next-line no-console
    console.warn(`[${severity}] ${detail}`);
  }
};

export const notifyError = (message) => notify("error", message);
export const notifySuccess = (message) => notify("success", message);
export const notifyWarn = (message) => notify("warn", message);
export const notifyInfo = (message) => notify("info", message);

/**
 * In-app confirmation (in place of window.confirm). Resolves true when the user accepts, false when they cancel or close
 * the dialog, so `if (!(await confirmAction(msg))) return;` keeps the native behaviour.
 * @param {string} message
 * @param {{ header?: string, acceptLabel?: string, rejectLabel?: string, danger?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export const confirmAction = (message, { header, acceptLabel, rejectLabel, danger = false } = {}) =>
  new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    confirmDialog({
      tagKey: APP_DIALOG_TAG,
      message: text(message),
      header: header || tr("common.confirm", "Confirm"),
      icon: "pi pi-exclamation-triangle",
      acceptLabel: acceptLabel || tr("common.yes", "Yes"),
      rejectLabel: rejectLabel || tr("common.no", "No"),
      acceptClassName: danger ? "p-button-danger" : undefined,
      accept: () => done(true),
      reject: () => done(false),
      onHide: () => done(false),
    });
  });
