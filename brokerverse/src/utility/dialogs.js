/**
 * In-app replacements for the browser's native window.alert / window.confirm.
 *
 * <AppDialogs /> (components/AppDialogs, mounted once in App.js) registers the application toast and renders the shared
 * PrimeReact <ConfirmDialog tagKey={APP_DIALOG_TAG} />. Screens that mount their own <ConfirmDialog /> (no tagKey) are not
 * affected: PrimeReact only opens the dialog whose tagKey matches the confirmDialog() call.
 */
import { confirmDialog } from "primereact/confirmdialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import i18n from "../i18n";
import logger from "./logger";

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
    logger.warn(`[${severity}] ${detail}`);
  }
};

export const notifyError = (message) => notify("error", message);
export const notifySuccess = (message) => notify("success", message);
export const notifyWarn = (message) => notify("warn", message);
export const notifyInfo = (message) => notify("info", message);

/**
 * In-app text prompt (in place of window.prompt): a dialog with a text box. Resolves the text entered (trimmed) when the
 * user presses OK, null when they cancel or close the dialog, so `const reason = await promptText(msg); if (!reason)
 * return;` keeps the native behaviour.
 * @param {string} message label shown above the box
 * @param {string} [defaultValue]
 * @param {{ header?: string, acceptLabel?: string, rejectLabel?: string, multiline?: boolean }} [options]
 * @returns {Promise<string|null>}
 */
export const promptText = (message, defaultValue = "", { header, acceptLabel, rejectLabel, multiline = true } = {}) =>
  new Promise((resolve) => {
    let settled = false;
    let current = defaultValue === null || defaultValue === undefined ? "" : String(defaultValue);
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const onChange = (e) => {
      current = e.target.value;
    };
    const box = multiline ? (
      <InputTextarea id="app-prompt-text" defaultValue={current} rows={3} autoResize autoFocus onChange={onChange} />
    ) : (
      <InputText id="app-prompt-text" defaultValue={current} autoFocus onChange={onChange} />
    );
    confirmDialog({
      tagKey: APP_DIALOG_TAG,
      message: (
        <div className="app-prompt" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: "min(28rem, 80vw)" }}>
          <label htmlFor="app-prompt-text">{text(message)}</label>
          {box}
        </div>
      ),
      header: header || tr("common.enterDetails", "Enter details"),
      acceptLabel: acceptLabel || tr("common.ok", "OK"),
      rejectLabel: rejectLabel || tr("common.cancel", "Cancel"),
      accept: () => done(current.trim()),
      reject: () => done(null),
      onHide: () => done(null),
    });
  });

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
