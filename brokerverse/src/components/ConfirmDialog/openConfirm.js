import React from "react";
import { createRoot } from "react-dom/client";
import ConfirmDialogHost from "./ConfirmDialogHost";
import { enqueue, hasHost } from "./confirmQueue";

const PROPS = ["title", "severity", "icon", "message", "facts", "note", "input", "confirmLabel", "confirmIcon", "cancelLabel", "onConfirm", "onCancel", "className"];

// the names of PrimeReact's confirmDialog(), so that a call can move over with its callbacks
const LEGACY = { header: "title", acceptLabel: "confirmLabel", rejectLabel: "cancelLabel", accept: "onConfirm", reject: "onCancel" };

const propsOf = (options) => {
  const out = {};
  Object.entries(LEGACY).forEach(([from, to]) => {
    if (options[from] !== undefined) out[to] = options[from];
  });
  PROPS.forEach((key) => {
    if (options[key] !== undefined) out[key] = options[key];
  });
  return out;
};

let ownHost = false;

// outside the application shell (AppDialogs not mounted): a host of its own, once
const mountHost = () => {
  if (ownHost) return;
  ownHost = true;
  const node = document.createElement("div");
  node.className = "bv-confirm-host";
  document.body.appendChild(node);
  createRoot(node).render(<ConfirmDialogHost />);
};

/**
 * Ask for a confirmation from anywhere (an event handler, a service call chain) with the shared ConfirmDialog; takes
 * its props (title, severity, message, facts, note, input, confirmLabel, onConfirm ...) or PrimeReact confirmDialog()
 * names (header, acceptLabel, accept, reject).
 *
 *   if (!(await openConfirm({ title, message, facts, confirmLabel: t("remittance.processAction") }))) return;
 *   await openConfirm({ ..., onConfirm: () => service.process(ids) });   // runs inside the dialog, errors shown there
 *   const reason = await openConfirm({ ..., input: { type: "textarea", label: t("common.reason"), required: true } });
 *
 * Resolves true once confirmed (and the action, when given, has succeeded), false when cancelled; with `input`, the
 * value entered instead of true and null when cancelled.
 * @param {object} options
 * @returns {Promise<boolean|*>}
 */
export const openConfirm = async (options = {}) => {
  const props = propsOf(options);
  if (!hasHost()) mountHost();
  const result = await enqueue(props);
  if (props.input) return result.confirmed ? result.value : null;
  return !!result.confirmed;
};

export default openConfirm;
