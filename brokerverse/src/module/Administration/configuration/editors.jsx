import React, { useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Chips } from "primereact/chips";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { TabView, TabPanel } from "primereact/tabview";
import { placeholdersOf } from "./catalog";

/** Round a percent shown from a stored fraction (0.0075 -> 0.75) without floating noise. */
const toPercent = (v) => (v === null || v === undefined ? null : Math.round(v * 100 * 10000) / 10000);
const fromPercent = (v) => (v === null || v === undefined ? null : Math.round((v / 100) * 1000000) / 1000000);

export const SwitchEditor = ({ id, value, onChange, disabled }) => (
  <div className="cfg__switch">
    <InputSwitch inputId={id} checked={!!value} onChange={(e) => onChange(e.value)} disabled={disabled} />
    <span>{value ? "On" : "Off"}</span>
  </div>
);

export const NumberEditor = ({ id, value, onChange, unit = {}, percent, disabled }) => {
  const scale = unit.scale || 1;
  const shown = percent ? toPercent(value) : value === null || value === undefined ? null : value / scale;
  return (
    <div className="cfg__number">
      {unit.prefix ? <span className="cfg__affix">{unit.prefix}</span> : null}
      <InputNumber inputId={id} value={shown} disabled={disabled} mode="decimal" minFractionDigits={0} maxFractionDigits={percent || scale > 1 ? 4 : 2}
        onValueChange={(e) => onChange(e.value === null ? null : percent ? fromPercent(e.value) : Math.round(e.value * scale))} />
      {percent ? <span className="cfg__affix">%</span> : unit.suffix ? <span className="cfg__affix">{unit.suffix}</span> : null}
    </div>
  );
};

export const SelectEditor = ({ id, value, onChange, choices, disabled }) => {
  const options = choices.map(([v, label]) => ({ value: v, label }));
  // a stored value outside the list is still shown, so saving never changes it silently
  if (value !== null && value !== undefined && !options.some((o) => o.value === value)) options.push({ value, label: String(value) });
  return <Dropdown inputId={id} value={value} options={options} onChange={(e) => onChange(e.value)} disabled={disabled} className="cfg__select" />;
};

export const TextEditor = ({ id, value, onChange, disabled, long }) =>
  long ? <InputTextarea id={id} value={value ?? ""} rows={3} autoResize onChange={(e) => onChange(e.target.value)} disabled={disabled} className="cfg__wide" />
    : <InputText id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="cfg__text" />;

export const ColorEditor = ({ id, value, onChange, disabled }) => (
  <div className="cfg__color">
    <input type="color" aria-label="Pick a colour" value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000"} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    <InputText id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  </div>
);

export const ImageEditor = ({ id, value, onChange, disabled }) => (
  <div className="cfg__image">
    {value ? <img src={value} alt="" /> : <span className="cfg__muted">No image</span>}
    <InputText id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="Image address" />
  </div>
);

/** A list of values (days, statuses, options) as removable chips; numbers are checked as they are added. */
export const ChipsEditor = ({ id, value, onChange, numeric, disabled }) => {
  const [error, setError] = useState("");
  return (
    <div className="cfg__chips">
      <Chips inputId={id} value={(value || []).map(String)} disabled={disabled} separator="," allowDuplicate={false}
        onChange={(e) => {
          const items = e.value.map((x) => String(x).trim()).filter(Boolean);
          if (numeric && items.some((x) => Number.isNaN(Number(x)))) { setError("Enter numbers only"); return; }
          setError("");
          onChange(numeric ? items.map(Number) : items);
        }} />
      <small className={error ? "cfg__error" : "cfg__muted"}>{error || "Type a value and press Enter; remove one with its x."}</small>
    </div>
  );
};

/** name -> value pairs (rates per level, accounts per payment mode...): the names are fixed, the values edited. */
export const KeyValueEditor = ({ id, value, onChange, percent, disabled }) => {
  const entries = Object.entries(value || {});
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <table className="cfg__table" id={id}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>
              {typeof v === "boolean" ? <InputSwitch checked={v} onChange={(e) => set(k, e.value)} disabled={disabled} aria-label={k} />
                : typeof v === "number" ? (
                  <div className="cfg__number">
                    <InputNumber value={percent ? toPercent(v) : v} maxFractionDigits={4} disabled={disabled} aria-label={k}
                      onValueChange={(e) => set(k, e.value === null ? null : percent ? fromPercent(e.value) : e.value)} />
                    {percent ? <span className="cfg__affix">%</span> : null}
                  </div>
                ) : <InputText value={v ?? ""} onChange={(e) => set(k, e.target.value)} disabled={disabled} aria-label={k} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/** A list of small records (currencies, languages...) as rows and columns. */
export const RecordsEditor = ({ id, value, original, onChange, disabled }) => {
  const columns = [...new Set((original || []).flatMap((r) => Object.keys(r)))];
  const kind = (col) => typeof (original || []).find((r) => r[col] !== undefined && r[col] !== null)?.[col];
  const setCell = (i, col, next) => onChange(value.map((row, n) => (n !== i ? row : { ...row, [col]: kind(col) === "number" ? (next === "" ? null : Number(next)) : next })));
  const heading = (c) => c.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (x) => x.toUpperCase());
  return (
    <div className="cfg__records" id={id}>
      <table className="cfg__table">
        <thead><tr>{columns.map((c) => <th key={c}>{heading(c)}</th>)}<th aria-label="Remove" /></tr></thead>
        <tbody>
          {value.map((row, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>
                  {kind(c) === "boolean" ? <InputSwitch checked={!!row[c]} onChange={(e) => setCell(i, c, e.value)} aria-label={heading(c)} disabled={disabled} />
                    : <InputText value={row[c] ?? ""} onChange={(e) => setCell(i, c, e.target.value)} aria-label={heading(c)} disabled={disabled} />}
                </td>
              ))}
              <td><Button type="button" icon="pi pi-trash" text rounded aria-label="Remove row" onClick={() => onChange(value.filter((_, n) => n !== i))} disabled={disabled} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button type="button" label="Add row" icon="pi pi-plus" text size="small" disabled={disabled}
        onClick={() => onChange([...value, Object.fromEntries(columns.map((c) => [c, kind(c) === "boolean" ? false : kind(c) === "number" ? null : ""]))])} />
    </div>
  );
};

/** Sample values for the preview of an e-mail, so the wording can be read as the client will see it. */
const SAMPLE = {
  customerName: "Maria Santos", clientName: "Maria Santos", insurerName: "Pacific Crest Insurance Corp.", companyName: "iorta TechNXT Corp.",
  policyNumber: "POL-2026-00125", quotationNumber: "QT-2026-00318", claimNumber: "CLM-2026-00042", productType: "Motor Comprehensive",
  amount: "PHP 24,560.00", dueDate: "15 Oct 2026", period: "September 2026", code: "482913", reportName: "Production Register",
  billNumber: "BILL-2026-0091", billDate: "30 Sep 2026", dnNumber: "DN-2026-0017", noticeLabel: "Renewal reminder", approvalUrl: "#", message: "Please see the attached quotation.",
};
const fillSample = (text) => String(text || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => SAMPLE[k] ?? `[${k}]`);

/** Wording of an e-mail: subject and body, with the placeholders it uses and a preview filled with sample values. */
export const HtmlEditor = ({ id, subject, onSubject, body, onBody, disabled }) => {
  const placeholders = useMemo(() => placeholdersOf(subject || "", body || ""), [subject, body]);
  const preview = useMemo(() => fillSample(body), [body]);
  return (
    <div className="cfg__email">
      {onSubject ? (
        <div className="cfg__email-subject">
          <label htmlFor={`${id}-subject`}>Subject</label>
          <InputText id={`${id}-subject`} value={subject ?? ""} onChange={(e) => onSubject(e.target.value)} disabled={disabled} />
        </div>
      ) : null}
      <TabView className="cfg__email-tabs">
        <TabPanel header="Wording">
          <InputTextarea id={id} value={body ?? ""} rows={6} autoResize onChange={(e) => onBody(e.target.value)} disabled={disabled} className="cfg__wide cfg__mono" />
        </TabPanel>
        <TabPanel header="Preview">
          {onSubject ? <div className="cfg__email-preview-subject">{fillSample(subject)}</div> : null}
          <iframe title="E-mail preview" className="cfg__email-preview" sandbox="" srcDoc={`<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937">${preview}</div>`} />
        </TabPanel>
      </TabView>
      {placeholders.length ? <small className="cfg__muted">Filled in when sent: {placeholders.join(" ")}</small> : null}
    </div>
  );
};

/** Structures only a system administrator changes: validated JSON. */
export const JsonEditor = ({ id, value, onChange, onInvalid, disabled }) => {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState("");
  return (
    <div className="cfg__json">
      <InputTextarea id={id} value={text} rows={6} autoResize disabled={disabled} className="cfg__wide cfg__mono"
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setError("");
            onInvalid?.(false);
          } catch {
            setError("Not valid yet: check the brackets, quotes and commas");
            onInvalid?.(true);
          }
        }} />
      {error ? <small className="cfg__error">{error}</small> : null}
    </div>
  );
};
