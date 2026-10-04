import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import { formatDate } from "../../utility/dateFormat";
import complianceService, { errorMessage } from "../../services/complianceService";

/** Local calendar date of a date picker value as YYYY-MM-DD (and back). */
export const isoDay = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null);
export const fromIsoDay = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`) : null);
export const showDate = (v) => formatDate(v, { empty: "" });
export const showDateTime = (v) => formatDate(v, { withTime: true, empty: "" });
export const money = (v) => (v === null || v === undefined ? "" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const SEVERITY = {
  valid: "success", current: "success", fit: "success", resolved: "success", closed: "secondary", notified: "success",
  expiring: "warning", due: "warning", conditional: "warning", acknowledged: "info", "in-progress": "info", assessed: "info", received: "info", open: "info",
  expired: "danger", overdue: "danger", "not-fit": "danger", escalated: "danger", missing: "danger",
  "no-expiry": "secondary", "no-validity": "warning", "not-reviewed": "warning", pending: "warning", superseded: "secondary", revoked: "secondary", surrendered: "secondary", ceased: "secondary",
};

/** A state as a coloured tag, labelled from compliance.state.<value>. */
export const StateTag = ({ value }) => {
  const { t } = useTranslation();
  if (!value) return null;
  return <Tag value={t(`compliance.state.${value}`, { defaultValue: value })} severity={SEVERITY[value] || "secondary"} />;
};

/** Page frame of the Compliance screens: breadcrumb, title, one-line purpose and the actions on the right. */
export const PageHeader = ({ section, title, intro, actions }) => {
  const { t } = useTranslation();
  return (
    <>
      <BreadCrumb model={[{ label: section }, { label: title }]} home={{ label: t("compliance.menu") }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>{title}</h2>
          {intro ? <p>{intro}</p> : null}
        </div>
        {actions ? <div className="admin__actions">{actions}</div> : null}
      </div>
    </>
  );
};

/** Counter cards; a card with `filter` toggles that filter. */
export const Stats = ({ items, loading, selected, onSelect }) => (
  <div className="access__stats">
    {items.map((s) => (
      <button type="button" key={s.key} className={`access__stat${selected === s.key ? " is-selected" : ""}`} onClick={() => onSelect && onSelect(selected === s.key ? null : s.key)}>
        <span className="access__stat-value">{loading ? "–" : s.value ?? 0}</span>
        <span className="access__stat-label">{s.label}</span>
      </button>
    ))}
  </div>
);

/** Attached documents: upload (stored with the other uploads), list with links, remove. */
export const DocumentsField = ({ value = [], onChange, disabled }) => {
  const { t } = useTranslation();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const added = [];
      for (const f of files) added.push(await complianceService.uploadDocument(f));
      onChange([...(value || []), ...added]);
    } catch (err) {
      setError(errorMessage(err, t("compliance.uploadFailed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="compliance__docs">
      {(value || []).map((d, i) => (
        <div key={`${d.key}-${i}`} className="compliance__doc">
          <i className="pi pi-file" />
          {d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.name || d.key}</a> : <span>{d.name || d.key}</span>}
          {!disabled ? <Button icon="pi pi-times" text rounded size="small" aria-label={t("compliance.removeDocument")} onClick={() => onChange(value.filter((_, j) => j !== i))} /> : null}
        </div>
      ))}
      {!disabled ? (
        <>
          <input ref={input} type="file" multiple hidden onChange={add} data-testid="compliance-upload" />
          <Button type="button" icon="pi pi-paperclip" label={t("compliance.attach")} outlined size="small" loading={busy} onClick={() => input.current?.click()} />
        </>
      ) : null}
      {error ? <small className="p-error">{error}</small> : null}
    </div>
  );
};

/**
 * One form field from a description: { name, label, type: text | textarea | date | datetime | dropdown | multiselect |
 * number | money | switch | documents, options, required, disabled }.
 */
export const Field = ({ f, form, set }) => {
  const id = `cf-${f.name}`;
  const v = form[f.name];
  let input;
  switch (f.type) {
    case "textarea": input = <InputTextarea id={id} value={v || ""} rows={f.rows || 3} autoResize disabled={f.disabled} onChange={(e) => set({ [f.name]: e.target.value })} />; break;
    case "date": input = <Calendar inputId={id} value={fromIsoDay(v)} dateFormat="dd/mm/yy" showIcon disabled={f.disabled} onChange={(e) => set({ [f.name]: isoDay(e.value) })} />; break;
    case "datetime": input = <Calendar inputId={id} value={v ? new Date(v) : null} showTime hourFormat="24" dateFormat="dd/mm/yy" showIcon disabled={f.disabled} onChange={(e) => set({ [f.name]: e.value ? e.value.toISOString() : null })} />; break;
    case "dropdown": input = <Dropdown inputId={id} value={v ?? null} options={f.options || []} filter={(f.options || []).length > 10} showClear={!f.required} disabled={f.disabled} onChange={(e) => set({ [f.name]: e.value ?? null })} />; break;
    case "multiselect": input = <MultiSelect inputId={id} value={v || []} options={f.options || []} display="chip" disabled={f.disabled} onChange={(e) => set({ [f.name]: e.value })} />; break;
    case "number": input = <InputNumber inputId={id} value={v ?? null} useGrouping={false} min={0} disabled={f.disabled} onValueChange={(e) => set({ [f.name]: e.value ?? null })} />; break;
    case "money": input = <InputNumber inputId={id} value={v ?? null} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} disabled={f.disabled} onValueChange={(e) => set({ [f.name]: e.value ?? null })} />; break;
    case "switch": input = <InputSwitch inputId={id} checked={!!v} disabled={f.disabled} onChange={(e) => set({ [f.name]: e.value })} />; break;
    case "documents": input = <DocumentsField value={v || []} disabled={f.disabled} onChange={(docs) => set({ [f.name]: docs })} />; break;
    default: input = <InputText id={id} value={v || ""} disabled={f.disabled} onChange={(e) => set({ [f.name]: e.target.value })} />;
  }
  return (
    <div className={`compliance__field${f.wide ? " compliance__field--wide" : ""}`}>
      <label htmlFor={id}>{f.label}{f.required ? " *" : ""}</label>
      {input}
      {f.help ? <small className="access__muted">{f.help}</small> : null}
    </div>
  );
};

/** A dialog with a form of fields, Cancel and the primary action. */
export const FormDialog = ({ header, visible, fields, form, setForm, onHide, onSubmit, submitLabel, saving, valid = true, children, width = "52rem" }) => {
  const { t } = useTranslation();
  const set = (patch) => setForm((x) => ({ ...x, ...patch }));
  return (
    <Dialog header={header} visible={visible} style={{ width, maxWidth: "96vw" }} modal onHide={onHide}
      footer={(
        <div>
          <Button label={t("compliance.cancel")} text onClick={onHide} />
          <Button label={submitLabel || t("compliance.save")} icon="pi pi-check" loading={saving} disabled={!valid} onClick={onSubmit} />
        </div>
      )}>
      {visible && form ? (
        <div className="compliance__form">
          {fields.filter((f) => !f.hidden).map((f) => <Field key={f.name} f={f} form={form} set={set} />)}
          {children}
        </div>
      ) : null}
    </Dialog>
  );
};

/** Options as { value, label } from strings, labelled with a translation prefix when given. */
export const asOptions = (list = [], t, prefix) => list.map((v) => ({ value: v, label: prefix ? t(`${prefix}.${v}`, { defaultValue: v }) : v }));

/** History of a register entry (its actions). */
export const History = ({ actions = [] }) => {
  const { t } = useTranslation();
  if (!actions.length) return null;
  return (
    <div className="compliance__history compliance__field--wide">
      <h4>{t("compliance.history")}</h4>
      <ul>
        {[...actions].reverse().map((a, i) => (
          <li key={`${a.at}-${i}`}>
            <span className="access__muted">{showDateTime(a.at)}</span> {t(`compliance.action.${a.action}`, { defaultValue: a.action })} ({a.by})
            {a.reason ? `: ${a.reason}` : ""}{a.outcome ? `: ${a.outcome}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
};
