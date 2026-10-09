/**
 * Confirmation of one action, laid out the same on every screen: a title with a small icon by severity, one sentence
 * saying what is about to happen, the facts it applies to (label and value; amounts right-aligned, dates in the
 * configured format), the consequence, and Cancel next to a button that names the action ("Process remittance",
 * "Delete supplier"). The action runs inside the dialog: the button shows that it is working, the dialog closes when
 * the action succeeds and stays open with the error when it fails. An optional field asks for a reason, a date, an
 * amount or a choice with the confirmation.
 *
 *   <ConfirmDialog visible={open} onHide={() => setOpen(false)} severity="danger"
 *     title={t("suppliers.deleteTitle")} message={t("suppliers.deleteMessage", { name })}
 *     facts={[{ label: t("suppliers.code"), value: code }, { label: t("suppliers.balance"), value: balance, type: "amount" }]}
 *     confirmLabel={t("suppliers.delete")} onConfirm={() => supplierService.remove(id)} />
 *
 * From an event handler, without state of its own: `await openConfirm({ ...the same props })` (./openConfirm).
 */
import React, { useEffect, useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { readableError } from "../../utility/apiError";
import { toDate, toIsoDate } from "../../utility/dateFormat";
import { numberLocale } from "../../utility/currencyConverter";
import { formatValue, NUMERIC_TYPES } from "../KeyValueGrid/formatValue";
import "./confirmDialog.scss";

const ICONS = { neutral: "pi pi-info-circle", warning: "pi pi-exclamation-triangle", danger: "pi pi-exclamation-circle" };

// controls that act on Enter themselves (a focused button clicks, a text area breaks the line, a list opens)
const OWN_ENTER = "button, a, textarea, input, [role='combobox'], .p-dropdown, .p-calendar";

const initialValue = (input) => {
  if (!input) return null;
  if (input.type === "date") return toDate(input.defaultValue);
  if (input.defaultValue !== undefined) return input.defaultValue;
  return ["number", "amount", "select"].includes(input.type) ? null : "";
};

const outputValue = (input, value) => {
  if (input.type === "date") return toIsoDate(value);
  return typeof value === "string" ? value.trim() : value;
};

const ConfirmDialog = ({
  visible, onHide, title, severity, icon, message, facts, note, input, confirmLabel, confirmIcon, cancelLabel, onConfirm, onCancel, className,
}) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [value, setValue] = useState(() => initialValue(input));
  const dialogRef = useRef(null);
  const acceptRef = useRef(null);
  const fieldRef = useRef(null);
  const busyRef = useRef(false);
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    if (!visible) return;
    busyRef.current = false;
    setBusy(false);
    setError(null);
    setFieldError(null);
    setValue(initialValue(inputRef.current));
  }, [visible]);

  const problemOf = (v) => {
    const empty = v === null || v === undefined || v === "";
    if (empty) return input.required ? t("confirmDialog.required", { label: input.label }) : null;
    if (input.minLength && typeof v === "string" && v.length < input.minLength) return t("confirmDialog.minLength", { count: input.minLength });
    return input.validate ? input.validate(v) || null : null;
  };

  const focusField = () => fieldRef.current?.querySelector("input:not([type='hidden']), textarea")?.focus();

  const confirm = async () => {
    if (busyRef.current) return;
    const result = input ? outputValue(input, value) : undefined;
    if (input) {
      const problem = input.type === "date" && value && !result ? t("confirmDialog.invalidDate") : problemOf(result);
      if (problem) {
        setFieldError(problem);
        focusField();
        return;
      }
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (onConfirm) await onConfirm(result);
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      setError(readableError(e?.message || (typeof e === "string" ? e : "")) || t("confirmDialog.failed"));
      return;
    }
    busyRef.current = false;
    setBusy(false);
    if (onHide) onHide({ confirmed: true, value: result });
  };

  const cancel = () => {
    if (busyRef.current) return;
    if (onCancel) onCancel();
    if (onHide) onHide({ confirmed: false });
  };

  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;

  // Enter confirms when the focus is on the dialog itself (not on a control that handles Enter)
  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.isComposing) return;
      const root = dialogRef.current?.getElement?.();
      const target = e.target;
      if (!(target === document.body || (root && root.contains(target)))) return;
      if (target.closest?.(OWN_ENTER)) return;
      e.preventDefault();
      confirmRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  const onShow = () => {
    if (input) focusField();
    else acceptRef.current?.focus?.();
  };

  const change = (next) => {
    setValue(next);
    setFieldError(null);
  };
  const enterConfirms = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    }
  };

  const control = () => {
    const describedBy = fieldError ? `${fieldId}-error` : undefined;
    const invalid = fieldError ? true : undefined;
    switch (input.type) {
      case "textarea":
        return (
          <InputTextarea id={fieldId} value={value ?? ""} rows={input.rows || 3} autoResize maxLength={input.maxLength} placeholder={input.placeholder}
            disabled={busy} aria-invalid={invalid} aria-describedby={describedBy} onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enterConfirms(e); }} />
        );
      case "date":
        return (
          <Calendar inputId={fieldId} value={value} minDate={toDate(input.minDate) || undefined} maxDate={toDate(input.maxDate) || undefined} disabled={busy}
            placeholder={input.placeholder} aria-invalid={invalid} aria-describedby={describedBy} onChange={(e) => change(e.value)} />
        );
      case "number":
      case "amount":
        return (
          <InputNumber inputId={fieldId} value={value} mode="decimal" locale={numberLocale()} min={input.min} max={input.max} disabled={busy}
            minFractionDigits={input.type === "amount" ? 2 : undefined} maxFractionDigits={input.type === "amount" ? 2 : input.decimals ?? 2}
            aria-invalid={invalid} aria-describedby={describedBy} onValueChange={(e) => change(e.value)} onKeyDown={enterConfirms} />
        );
      case "select":
        return (
          <Dropdown inputId={fieldId} value={value} options={input.options || []} optionLabel="label" optionValue="value" filter={(input.options || []).length > 8}
            placeholder={input.placeholder} disabled={busy} aria-invalid={invalid} aria-describedby={describedBy} onChange={(e) => change(e.value)} />
        );
      default:
        return (
          <InputText id={fieldId} value={value ?? ""} maxLength={input.maxLength} placeholder={input.placeholder} disabled={busy}
            aria-invalid={invalid} aria-describedby={describedBy} onChange={(e) => change(e.target.value)} onKeyDown={enterConfirms} />
        );
    }
  };

  const shownFacts = (facts || []).filter((f) => f && !f.hidden);
  const tone = ICONS[severity] ? severity : "neutral";

  const header = (
    <span className="bv-confirm__title">
      <i className={`bv-confirm__icon ${icon || ICONS[tone]}`} aria-hidden="true" />
      <span>{title}</span>
    </span>
  );

  const footer = (
    <>
      <Button type="button" label={cancelLabel || t("confirmDialog.cancel")} text className="bv-confirm__cancel" disabled={busy} onClick={cancel} />
      <Button ref={acceptRef} type="button" label={confirmLabel || t("confirmDialog.confirm")} icon={confirmIcon} loading={busy}
        severity={tone === "danger" ? "danger" : undefined} className="bv-confirm__accept" onClick={confirm} />
    </>
  );

  return (
    <Dialog ref={dialogRef} visible={visible} onHide={cancel} onShow={onShow} header={header} footer={footer} modal draggable={false} resizable={false}
      closable={!busy} closeOnEscape={!busy} className={["bv-centered", "bv-confirm", `bv-confirm--${tone}`, className].filter(Boolean).join(" ")}
      style={{ width: "34rem" }} breakpoints={{ "640px": "calc(100vw - 32px)" }}>
      <div className="bv-confirm__body">
        {message ? <p className="bv-confirm__message">{message}</p> : null}
        {shownFacts.length ? (
          <table className="bv-confirm__facts">
            <tbody>
              {shownFacts.map((f, i) => (
                <tr key={f.key || f.label || i} className={f.emphasis ? "bv-confirm__fact--total" : undefined}>
                  <th scope="row">{f.label}</th>
                  <td className={NUMERIC_TYPES.has(f.type) ? "bv-confirm__num" : undefined}>{formatValue(f.value, f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {input ? (
          <div className="bv-confirm__field" ref={fieldRef}>
            <label htmlFor={fieldId}>
              {input.label}
              {input.required ? <span className="bv-confirm__required" aria-hidden="true"> *</span> : null}
            </label>
            {control()}
            {fieldError ? <small id={`${fieldId}-error`} className="bv-confirm__field-error" role="alert">{fieldError}</small> : null}
          </div>
        ) : null}
        {note ? <p className="bv-confirm__note">{note}</p> : null}
        {error ? (
          <div className="bv-confirm__error" role="alert">
            <i className="pi pi-times-circle" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
};

export const factShape = PropTypes.shape({
  label: PropTypes.node.isRequired,
  value: PropTypes.any,
  /** text (default), amount, number, percent, date, datetime, boolean (components/KeyValueGrid/formatValue) */
  type: PropTypes.string,
  currency: PropTypes.string,
  decimals: PropTypes.number,
  /** a total: bold, with a rule above */
  emphasis: PropTypes.bool,
  hidden: PropTypes.bool,
});

export const inputShape = PropTypes.shape({
  /** text (default), textarea, date, number, amount, select */
  type: PropTypes.oneOf(["text", "textarea", "date", "number", "amount", "select"]),
  label: PropTypes.string.isRequired,
  required: PropTypes.bool,
  minLength: PropTypes.number,
  maxLength: PropTypes.number,
  rows: PropTypes.number,
  placeholder: PropTypes.string,
  defaultValue: PropTypes.any,
  /** date: earliest and latest day (Date or ISO text) */
  minDate: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  maxDate: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  min: PropTypes.number,
  max: PropTypes.number,
  decimals: PropTypes.number,
  /** select: [{ label, value }] */
  options: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.node, value: PropTypes.any })),
  /** extra check of the value given: returns the message to show, or nothing */
  validate: PropTypes.func,
});

ConfirmDialog.propTypes = {
  visible: PropTypes.bool,
  /** Called once the dialog is answered: { confirmed: true, value } after the action succeeded, { confirmed: false } when cancelled. */
  onHide: PropTypes.func,
  title: PropTypes.node.isRequired,
  severity: PropTypes.oneOf(["neutral", "warning", "danger"]),
  /** another PrimeIcons class for the title icon (the severity still sets its colour) */
  icon: PropTypes.string,
  /** one sentence: what is about to happen */
  message: PropTypes.node,
  facts: PropTypes.arrayOf(factShape),
  /** what follows from the action (e.g. "The remittances can no longer be edited.") */
  note: PropTypes.node,
  input: inputShape,
  /** the action as a verb: "Process remittance", "Generate statement", "Delete supplier" */
  confirmLabel: PropTypes.string.isRequired,
  confirmIcon: PropTypes.string,
  cancelLabel: PropTypes.string,
  /** runs the action (may return a promise); receives the value of `input`. A thrown error is shown in the dialog. */
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  className: PropTypes.string,
};

ConfirmDialog.defaultProps = {
  visible: false,
  onHide: null,
  severity: "neutral",
  icon: null,
  message: null,
  facts: [],
  note: null,
  input: null,
  confirmIcon: null,
  cancelLabel: null,
  onConfirm: null,
  onCancel: null,
  className: null,
};

export default ConfirmDialog;
