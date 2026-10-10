import React, { useCallback, useId, useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import FieldError from "../FieldError";
import opsAccountingService from "../../services/opsAccountingService";
import { useStableLoad } from "../../hooks/useStableLoad";
import "./index.scss";

export const NOTE_MAX_LENGTH = 1000;
const yes = (v) => ["true", "yes", "1"].includes(String(v).toLowerCase());

/** Active reasons of the contexts as dropdown options, in the master's sort order. */
export const reasonOptions = (records, contexts) => records
  .filter((r) => contexts.includes(r.context) && String(r.status || "Active").toLowerCase() === "active")
  .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || String(a.name).localeCompare(String(b.name)))
  .map((r) => ({ label: r.name, value: r.code, requiresNote: yes(r.requiresNote) }));

/** What is still missing in a reason: "reason" (none chosen), "note" (the chosen reason needs a note) or null. */
export const reasonProblem = (value, { required = true } = {}) => {
  if (!value?.reasonCode) return required ? "reason" : null;
  if (value.noteRequired && !String(value.note || "").trim()) return "note";
  return null;
};

/** The reason as the API takes it: { reasonCode, note } (no note when it is empty). */
export const reasonPayload = (value) => ({
  reasonCode: value?.reasonCode || undefined,
  note: String(value?.note || "").trim() || undefined,
});

/**
 * The reason of a decision, chosen from the Reason Codes master (Master > Insurance Management > Reason Codes) for one
 * context or several, with a note that becomes required when the chosen reason asks for one (Other). The value is
 * { reasonCode, reasonLabel, note, noteRequired } (noteRequired: the reason asks for a note, or the screen always does);
 * reasonProblem(value) tells what is missing and reasonPayload(value)
 * gives the fields to send. The server checks the same rules again.
 */
const ReasonPicker = ({ context, value, onChange, label, noteLabel, required = true, noteRequired = false, disabled = false, showErrors = false, autoFocus = false, className = "" }) => {
  const { t } = useTranslation();
  const id = `bv-reason-${useId().replace(/:/g, "")}`;
  const contexts = useMemo(() => [].concat(context), [context]);
  const key = contexts.join(",");
  const loader = useCallback(async () => {
    const one = key.includes(",") ? undefined : key;
    const { rows } = await opsAccountingService.masterRecords("reason-code", { status: "Active", context: one });
    return rows;
  }, [key]);
  const { data, loading, error } = useStableLoad(loader, { initialData: [] });
  const options = useMemo(() => reasonOptions(data || [], contexts), [data, contexts]);

  const current = value || {};
  const problem = showErrors ? reasonProblem(current, { required }) : null;
  const emit = (patch) => onChange({ reasonCode: null, reasonLabel: null, note: "", noteRequired: false, ...current, ...patch });
  const choose = (code) => {
    const option = options.find((o) => o.value === code);
    emit({ reasonCode: option ? option.value : null, reasonLabel: option ? option.label : null, noteRequired: noteRequired || !!option?.requiresNote });
  };

  return (
    <div className={`bv-reason ${className}`.trim()}>
      <div className="bv-reason__field">
        <label htmlFor={`${id}-code`} className="bv-field-label">
          {label || t("reasonPicker.reason", "Reason")}{required && <span className="required-marker">*</span>}
        </label>
        <Dropdown inputId={`${id}-code`} value={current.reasonCode ?? null} options={options} onChange={(e) => choose(e.value)} disabled={disabled} autoFocus={autoFocus}
          placeholder={loading ? t("reasonPicker.loading", "Loading reasons") : t("reasonPicker.choose", "Choose a reason")} filter={options.length > 10} showClear={!required && !!current.reasonCode}
          emptyMessage={error || t("reasonPicker.none", "No reasons are set up for this action")} className={`w-full${problem === "reason" ? " p-invalid" : ""}`}
          aria-invalid={problem === "reason" || undefined} aria-describedby={problem === "reason" ? `${id}-code-error` : undefined} />
        <FieldError id={`${id}-code-error`} error={problem === "reason" ? t("reasonPicker.reasonRequired", "Choose the reason") : null} />
      </div>
      <div className="bv-reason__field">
        <label htmlFor={`${id}-note`} className="bv-field-label">
          {noteLabel || t("reasonPicker.note", "Note")}
          {current.noteRequired || noteRequired ? <span className="required-marker">*</span> : <span className="bv-reason__optional">{t("reasonPicker.optional", "(optional)")}</span>}
        </label>
        <InputTextarea id={`${id}-note`} value={current.note || ""} onChange={(e) => emit({ note: e.target.value })} disabled={disabled} rows={3} autoResize maxLength={NOTE_MAX_LENGTH}
          className={`w-full${problem === "note" ? " p-invalid" : ""}`} aria-invalid={problem === "note" || undefined} aria-describedby={problem === "note" ? `${id}-note-error` : undefined} />
        <FieldError id={`${id}-note-error`} error={problem === "note" ? t("reasonPicker.noteRequired", "This reason needs a note") : null} />
      </div>
    </div>
  );
};

ReasonPicker.propTypes = {
  /** context of the Reason Codes master (period_close, period_reopen ...), or several */
  context: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]).isRequired,
  /** { reasonCode, reasonLabel, note, noteRequired } */
  value: PropTypes.shape({ reasonCode: PropTypes.string, reasonLabel: PropTypes.string, note: PropTypes.string, noteRequired: PropTypes.bool }),
  /** receives the whole new value */
  onChange: PropTypes.func.isRequired,
  /** label of the reason ("Reason" when left out) */
  label: PropTypes.string,
  /** label of the note ("Note" when left out) */
  noteLabel: PropTypes.string,
  /** a reason must be chosen (true by default) */
  required: PropTypes.bool,
  /** the note is required whatever the reason (the change note of a controlled document) */
  noteRequired: PropTypes.bool,
  disabled: PropTypes.bool,
  /** shows what is missing under the fields (set it once the user tried to confirm) */
  showErrors: PropTypes.bool,
  autoFocus: PropTypes.bool,
  className: PropTypes.string,
};

export default ReasonPicker;
