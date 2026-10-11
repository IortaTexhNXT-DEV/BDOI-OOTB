import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { Chips } from "primereact/chips";
import DetailDialog from "../../components/DetailDialog";
import FieldError from "../../components/FieldError";
import StatusChip from "../../components/StatusChip";
import { SectionCard } from "../../components/RecordPage";
import goLiveService from "../../services/goLiveService";
import { useAccess } from "./shared";
import { REASON_MIN } from "./LockBlock";

/** Label of a setting of the Go-Live tab (the server's label when the screen has none). */
export const settingLabel = (t, def) => t(`goLive.settings.fields.${def.field}`, { defaultValue: def.label });

/** A value of a setting as the tab shows it: Yes / No, a choice, a list, a number. */
export const settingText = (t, def, value) => {
  if (value === null || value === undefined) return "—";
  if (def.type === "boolean") return value ? t("goLive.common.yes") : t("goLive.common.no");
  if (def.type === "choice") return t(`goLive.settings.choices.${value}`, { defaultValue: value });
  if (def.type === "list") return value.length ? value.map((v) => t(`goLive.rule.${v}`, { defaultValue: v })).join(", ") : t("goLive.settings.none");
  if (def.type === "series") return value.length ? value.map((v) => def.choices?.find((c) => c.value === v)?.label || v).join(", ") : t("goLive.settings.none");
  if (def.type === "integer") return def.allowZero && Number(value) === 0 ? t("goLive.settings.forEver") : String(value);
  return Array.isArray(value) ? value.join(", ") : String(value);
};

/** What is wrong with a settings request: a whole number out of its bounds, an empty list, the reason. */
export const settingsProblems = (defs, values, reason, t) => {
  const out = {};
  for (const d of defs) {
    const v = values[d.field];
    if (d.type === "integer" && !(Number.isInteger(v) && v <= d.max && (v >= d.min || (d.allowZero && v === 0)))) {
      out[d.field] = t("goLive.settings.range", { min: d.min, max: d.max });
    }
    if (["codes", "series"].includes(d.type) && !(Array.isArray(v) && v.length)) out[d.field] = t("goLive.settings.oneOrMore");
  }
  if (String(reason || "").trim().length < REASON_MIN) out.reason = t("goLive.lock.reasonRequired", { count: REASON_MIN });
  return out;
};

/** Request of a settings change: every setting of the tab with its value (frozen ones read-only once locked) and the reason. */
const SettingsDialog = ({ state, onHide, onDone }) => {
  const { t } = useTranslation();
  const defs = state.settingDefinitions || [];
  const [values, setValues] = useState({ ...state.settings });
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problems = tried ? settingsProblems(defs, values, reason, t) : {};
  const set = (field, v) => setValues((x) => ({ ...x, [field]: v }));
  const changed = defs.filter((d) => JSON.stringify(values[d.field]) !== JSON.stringify(state.settings[d.field]));
  const save = async () => {
    setTried(true);
    if (Object.keys(settingsProblems(defs, values, reason, t)).length || !changed.length) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.requestSettings(Object.fromEntries(changed.map((d) => [d.field, values[d.field]])), reason.trim());
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const input = (d) => {
    const frozen = d.beforeLock && state.locked;
    const id = `setting-${d.field}`;
    const invalid = problems[d.field] ? " p-invalid" : "";
    if (d.type === "boolean") return <InputSwitch inputId={id} checked={!!values[d.field]} onChange={(e) => set(d.field, e.value)} disabled={frozen} />;
    if (d.type === "choice") {
      return <Dropdown inputId={id} value={values[d.field]} options={d.choices.map((c) => ({ value: c, label: t(`goLive.settings.choices.${c}`, { defaultValue: c }) }))}
        onChange={(e) => set(d.field, e.value)} disabled={frozen} className="w-full" />;
    }
    if (d.type === "list" || d.type === "series") {
      const options = d.type === "list" ? d.choices.map((c) => ({ value: c, label: t(`goLive.rule.${c}`, { defaultValue: c }) })) : d.choices;
      return <MultiSelect inputId={id} value={values[d.field] || []} options={options} onChange={(e) => set(d.field, e.value)} disabled={frozen} display="chip"
        className={`w-full${invalid}`} />;
    }
    if (d.type === "integer") {
      return <InputNumber inputId={id} value={values[d.field]} onValueChange={(e) => set(d.field, e.value)} min={0} max={d.max} showButtons disabled={frozen}
        className={invalid.trim()} />;
    }
    return <Chips inputId={id} value={values[d.field] || []} onChange={(e) => set(d.field, (e.value || []).map((x) => String(x).trim().toUpperCase()))} separator=","
      disabled={frozen} className={`w-full${invalid}`} />;
  };
  return (
    <DetailDialog visible onHide={onHide} size="lg" header={t("goLive.settings.requestTitle")} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.settings.requestChange")} onClick={save} loading={busy} disabled={!changed.length} />
      </>
    )}>
      <div className="go-live__form">
        {defs.map((d) => (
          <div key={d.field} className="go-live__setting">
            <label htmlFor={`setting-${d.field}`} className="bv-field-label">{settingLabel(t, d)}</label>
            {input(d)}
            {d.beforeLock && state.locked ? <small className="go-live__muted">{t("goLive.settings.frozen")}</small> : null}
            <FieldError error={problems[d.field]} />
          </div>
        ))}
        <label htmlFor="settings-reason" className="bv-field-label">{t("goLive.lock.reason")}<span className="required-marker">*</span></label>
        <InputTextarea id="settings-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoResize maxLength={1000}
          className={`w-full${problems.reason ? " p-invalid" : ""}`} />
        <FieldError error={problems.reason} />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/**
 * Settings of the workspace (approval of loads, migrated business in the figures, the SAP opening file, the dashboards'
 * view, duplicate checks, unlock limits, evidence retention, naming and numbering): shown here, changed by a request
 * that another user approves on the Go-Live Lock card.
 */
const SettingsBlock = ({ state, onChanged }) => {
  const { t } = useTranslation();
  const { canWrite, canApprove } = useAccess();
  const [editing, setEditing] = useState(false);
  const defs = state.settingDefinitions || [];
  const waiting = !!state.pendingRequest;
  return (
    <SectionCard title={t("goLive.settings.title")} actions={canWrite || canApprove ? (
      <Button type="button" icon="pi pi-sliders-h" label={t("goLive.settings.requestChange")} outlined onClick={() => setEditing(true)} disabled={waiting}
        tooltip={waiting ? t("goLive.settings.waiting") : undefined} tooltipOptions={{ showOnDisabled: true, position: "left" }} />
    ) : null}>
      <DataTable value={defs} dataKey="field" size="small">
        <Column header={t("goLive.settings.setting")} body={(d) => settingLabel(t, d)} />
        <Column header={t("goLive.settings.value")} body={(d) => settingText(t, d, state.settings?.[d.field])} />
        <Column header={t("goLive.settings.afterLock")} body={(d) => (
          <StatusChip label={d.beforeLock ? t("goLive.settings.frozenShort") : t("goLive.settings.changeable")} severity={d.beforeLock ? "secondary" : "info"} />
        )} />
      </DataTable>
      {editing ? <SettingsDialog state={state} onHide={() => setEditing(false)}
        onDone={() => { setEditing(false); onChanged(t("goLive.lock.requested", { what: t("goLive.lock.actions.settings") })); }} /> : null}
    </SectionCard>
  );
};

export default SettingsBlock;
