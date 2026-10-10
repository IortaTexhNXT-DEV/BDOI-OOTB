import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { RadioButton } from "primereact/radiobutton";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { AutoComplete } from "primereact/autocomplete";
import { SelectButton } from "primereact/selectbutton";
import placementService from "../../services/placementService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { formatDate as formatConfiguredDate, formatInstant } from "../../utility/dateFormat";
import { statusSeverity as sharedSeverity } from "../../utils/statusSeverity";

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const formatDate = (d) => formatConfiguredDate(d, { empty: "-" });
/** Date and time of an event, in the business time zone. */
export const formatDateTime = (d) => formatInstant(d, { empty: "-" });

/** Label of a risk detail of a slip (placement.risk.<key>), the key in words when it has none. */
export const riskLabel = (t, key) => t(`placement.risk.${key}`, { defaultValue: key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()) });

/** Tag severity per status of broker slips, offers, placement slips and participants: the one scheme of every list. */
export const statusSeverity = (status) => sharedSeverity(status);

export const StatusTag = ({ status }) => {
  const { t } = useTranslation();
  return <Tag value={t(`placement.status.${status}`, { defaultValue: status })} severity={statusSeverity(status)} className="placement-status" />;
};

/** Loads the insurers / products reference data once per screen. */
export const usePlacementOptions = () => {
  const [options, setOptions] = useState({ insurers: [], products: [], defaultBillingMode: "broker" });
  useEffect(() => {
    let alive = true;
    placementService.options().then((o) => alive && setOptions(o)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return options;
};

/**
 * The same split as the server (placement/participants.js): each co-insurer's share is rounded to 2 decimals and the
 * lead takes what is left, so the preview always adds up to the totals.
 */
export const splitPreview = (parts, totals) => {
  const keys = ["sumInsured", "premium", "premiumTotal", "commissionAmount"];
  const rows = parts.map((p) => ({ ...p }));
  const others = Object.fromEntries(keys.map((k) => [k, 0]));
  rows.filter((r) => !r.isLead).forEach((r) => {
    keys.forEach((k) => { r[k] = round2((Number(totals[k]) || 0) * (Number(r.sharePercent) || 0) / 100); others[k] = round2(others[k] + r[k]); });
  });
  const lead = rows.find((r) => r.isLead);
  if (lead) keys.forEach((k) => { lead[k] = round2((Number(totals[k]) || 0) - others[k]); });
  return rows;
};

export const shareTotal = (parts) => Math.round((parts || []).reduce((s, p) => s + (Number(p.sharePercent) || 0), 0) * 10000) / 10000;

/** Client-side mirror of the server rules, for the live message (the server validates again). */
export const participantProblem = (parts, t) => {
  if (!parts.length) return t("placement.participants.needOne");
  if (parts.some((p) => !p.insuranceCompanyId)) return t("placement.participants.chooseInsurer");
  if (new Set(parts.map((p) => p.insuranceCompanyId)).size !== parts.length) return t("placement.participants.duplicate");
  if (parts.some((p) => !(Number(p.sharePercent) > 0))) return t("placement.participants.positiveShare");
  if (parts.filter((p) => p.isLead).length !== 1) return t("placement.participants.oneLead");
  const total = shareTotal(parts);
  if (Math.abs(total - 100) > 0.0001) return t("placement.participants.mustTotal", { total });
  return null;
};

/**
 * Co-insurance participant editor: insurer (insurer master), share %, lead toggle, optional insurer reference, live
 * total with the 100% rule and a per-participant premium / commission preview.
 */
export const ParticipantEditor = ({ value, onChange, insurers, totals = {}, showReference = false, disabled = false }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const parts = useMemo(() => value || [], [value]);
  const preview = useMemo(() => splitPreview(parts, { sumInsured: totals.sumInsured, premium: totals.netPremium, premiumTotal: totals.grossPremium, commissionAmount: totals.commissionAmount }), [parts, totals]);
  const total = shareTotal(parts);
  const problem = participantProblem(parts, t);
  const insurerOptions = (insurers || []).map((i) => ({ label: i.name, value: i.id }));
  const set = (index, patch) => onChange(parts.map((p, i) => (i === index ? { ...p, ...patch } : patch.isLead ? { ...p, isLead: false } : p)));
  const add = () => onChange([...parts, { insuranceCompanyId: null, sharePercent: parts.length ? round2(Math.max(0, 100 - total)) || null : 100, isLead: !parts.length, insurerReference: "" }]);
  const remove = (index) => {
    const next = parts.filter((_, i) => i !== index);
    if (next.length && !next.some((p) => p.isLead)) next[0] = { ...next[0], isLead: true };
    onChange(next);
  };
  return (
    <div className="participant-editor table-scroll">
      <table className="participant-table">
        <thead>
          <tr>
            <th>{t("placement.participants.insurer")}</th>
            <th className="num">{t("placement.participants.share")}</th>
            <th className="center">{t("placement.participants.lead")}</th>
            {showReference && <th>{t("placement.participants.reference")}</th>}
            <th className="num">{t("placement.participants.sumInsured")}</th>
            <th className="num">{t("placement.participants.premium")}</th>
            <th className="num">{t("placement.participants.gross")}</th>
            <th className="num">{t("placement.participants.commission")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {parts.map((p, i) => (
            <tr key={i} className={p.isLead ? "lead-row" : ""}>
              <td style={{ minWidth: "15rem" }}>
                <Dropdown value={p.insuranceCompanyId} options={insurerOptions} onChange={(e) => set(i, { insuranceCompanyId: e.value })} filter placeholder={t("placement.participants.chooseInsurer")}
                  className="w-full" disabled={disabled} aria-label={t("placement.participants.insurer")} />
              </td>
              <td className="num" style={{ width: "8rem" }}>
                <InputNumber value={p.sharePercent} onValueChange={(e) => set(i, { sharePercent: e.value })} suffix="%" min={0} max={100} maxFractionDigits={4} inputClassName="w-full text-right"
                  disabled={disabled} aria-label={t("placement.participants.share")} />
              </td>
              <td className="center"><RadioButton checked={Boolean(p.isLead)} onChange={() => set(i, { isLead: true })} disabled={disabled} aria-label={t("placement.participants.lead")} /></td>
              {showReference && (
                <td><InputText value={p.insurerReference || ""} onChange={(e) => set(i, { insurerReference: e.target.value })} className="w-full" disabled={disabled} placeholder={t("placement.participants.referencePlaceholder")} /></td>
              )}
              <td className="num">{formatCurrency(preview[i]?.sumInsured || 0)}</td>
              <td className="num">{formatCurrency(preview[i]?.premium || 0)}</td>
              <td className="num">{formatCurrency(preview[i]?.premiumTotal || 0)}</td>
              <td className="num">{formatCurrency(preview[i]?.commissionAmount || 0)}</td>
              <td className="center">{!disabled && <Button icon="pi pi-trash" text rounded severity="danger" onClick={() => remove(i)} aria-label={t("placement.actions.remove")} tooltip={t("placement.actions.remove")} tooltipOptions={{ position: "top" }} />}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{!disabled && <Button label={t("placement.participants.add")} icon="pi pi-plus" text onClick={add} />}</td>
            <td className="num"><strong className={problem ? "total-bad" : "total-ok"}>{Number(total.toFixed(4))}%</strong></td>
            <td colSpan={showReference ? 7 : 6}>
              {problem ? <span className="total-bad"><i className="pi pi-exclamation-triangle mr-1" />{problem}</span>
                : <span className="total-ok"><i className="pi pi-check-circle mr-1" />{parts.length > 1 ? t("placement.participants.okCo") : t("placement.participants.okSingle")}</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

/** Read-only participants table (quote / policy / placement detail). */
export const ParticipantsTable = ({ participants, currency, actions }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  return (
    <table className="participant-table readonly">
      <thead>
        <tr>
          <th>{t("placement.participants.insurer")}</th><th className="num">{t("placement.participants.share")}</th>
          <th className="num">{t("placement.participants.sumInsured")}</th><th className="num">{t("placement.participants.premium")}</th><th className="num">{t("placement.participants.taxes")}</th>
          <th className="num">{t("placement.participants.gross")}</th><th className="num">{t("placement.participants.commission")}</th><th>{t("placement.participants.reference")}</th>
          <th>{t("placement.participants.status")}</th>{actions && <th />}
        </tr>
      </thead>
      <tbody>
        {(participants || []).map((p) => (
          <tr key={p.participantId || p.insuranceCompanyId} className={p.isLead ? "lead-row" : ""}>
            <td>
              {p.insuranceCompanyName}
              <small className="participant-role">{p.isLead ? t("placement.participants.leadInsurer") : t("placement.participants.coInsurer")}</small>
            </td>
            <td className="num">{Number(p.sharePercent)}%</td>
            <td className="num">{formatCurrency(p.sumInsured)}</td>
            <td className="num">{formatCurrency(p.premium)}</td>
            <td className="num">{formatCurrency(p.taxes)}</td>
            <td className="num">{formatCurrency(p.premiumTotal)}</td>
            <td className="num">{formatCurrency(p.commissionAmount)}</td>
            <td>{p.insurerReference || "-"}</td>
            <td><StatusTag status={p.status} /></td>
            {actions && <td className="actions-cell">{actions(p)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/** Journey steps Broker Slip -> Quotation Slip -> Placement Slip -> Policy with links to each document. */
export const JourneyTimeline = ({ steps }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const link = { brokerSlip: (id) => `/placement/broker-slips/${id}`, quotationSlip: (id) => `/agent/quotedetailview/${id}`, placementSlip: (id) => `/placement/placement-slips/${id}`,
    policy: (id) => `/agent/policydetail/${id}` };
  return (
    <ol className="journey-timeline" aria-label={t("placement.journey.title")}>
      {steps.map((s, i) => {
        const state = s.done ? "done" : s.mode === "skip" ? "skipped" : s.current ? "current" : "todo";
        const to = s.id && link[s.key] ? link[s.key](s.id) : null;
        return (
          <li key={s.key} className={`journey-step ${state}`}>
            <span className="journey-marker">{s.done ? <i className="pi pi-check" /> : i + 1}</span>
            <div className="journey-body">
              <div className="journey-label" title={t(`placement.journey.steps.${s.key}`, { defaultValue: s.label })}>{t(`placement.journey.steps.${s.key}`, { defaultValue: s.label })}</div>
              {s.reference ? (to ? <button type="button" className="journey-link" onClick={() => navigate(to)}>{s.reference}</button> : <span className="journey-ref" title={s.reference}>{s.reference}</span>)
                : <span className="journey-ref muted">{s.mode && s.mode !== "required" && !s.done ? t(`placement.journey.mode.${s.mode}`) : s.done ? formatDate(s.at) : "-"}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

/** Customer picker: an existing client or lead (autocomplete), or (optionally) a new insured. */
/** Customer of a slip: an existing client or lead, or (allowNew) a new one typed in; newLabel names that choice. */
export const CustomerPicker = ({ value, onChange, allowNew = false, newLabel }) => {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState([]);
  const timer = useRef(null);
  const kind = value?.kind || "client";
  const kinds = [{ label: t("placement.customer.client"), value: "client" }, { label: t("placement.customer.lead"), value: "lead" }, ...(allowNew ? [{ label: newLabel || t("placement.customer.new"), value: "new" }] : [])];
  const search = (e) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const rows = kind === "lead" ? await placementService.searchLeads(e.query) : await placementService.searchClients(e.query);
        setSuggestions(rows.map((r) => ({ id: r.id, label: kind === "lead" ? `${r.fullName || [r.firstName, r.lastName].filter(Boolean).join(" ") || r.companyName} (${r.generatedLeadId || r.id})`
          : `${r.displayName} (${r.clientCode || r.generatedClientId || r.id})`, name: kind === "lead" ? (r.companyName || [r.firstName, r.lastName].filter(Boolean).join(" ")) : r.displayName })));
      } catch {
        setSuggestions([]);
      }
    }, 250);
  };
  return (
    <div className="customer-picker">
      <SelectButton value={kind} options={kinds} onChange={(e) => e.value && onChange({ kind: e.value })} className="mb-2" />
      {kind === "new" ? (
        <div className="grid">
          <div className="col-12 md:col-6">
            <label htmlFor="new-company">{t("placement.customer.companyName")}</label>
            <InputText id="new-company" value={value?.companyName || ""} onChange={(e) => onChange({ ...value, kind, companyName: e.target.value })} className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label htmlFor="new-first">{t("placement.customer.firstName")}</label>
            <InputText id="new-first" value={value?.firstName || ""} onChange={(e) => onChange({ ...value, kind, firstName: e.target.value })} className="w-full" />
          </div>
          <div className="col-12 md:col-3">
            <label htmlFor="new-last">{t("placement.customer.lastName")}</label>
            <InputText id="new-last" value={value?.lastName || ""} onChange={(e) => onChange({ ...value, kind, lastName: e.target.value })} className="w-full" />
          </div>
          <div className="col-12 md:col-6">
            <label htmlFor="new-email">{t("placement.customer.email")}</label>
            <InputText id="new-email" value={value?.emailId || ""} onChange={(e) => onChange({ ...value, kind, emailId: e.target.value })} className="w-full" />
          </div>
          <div className="col-12 md:col-6">
            <label htmlFor="new-phone">{t("placement.customer.contactNumber")}</label>
            <InputText id="new-phone" value={value?.contactNumber || ""} onChange={(e) => onChange({ ...value, kind, contactNumber: e.target.value })} className="w-full" />
          </div>
        </div>
      ) : (
        <AutoComplete value={value?.selected || ""} suggestions={suggestions} completeMethod={search} field="label" onChange={(e) => onChange({ kind, selected: e.value })}
          placeholder={t(kind === "lead" ? "placement.customer.searchLead" : "placement.customer.searchClient")} className="w-full" inputClassName="w-full" forceSelection />
      )}
    </div>
  );
};

/** API fields for the picked customer. */
export const customerFields = (c) => {
  if (!c) return {};
  if (c.kind === "new") {
    return { companyName: c.companyName || undefined, firstName: c.firstName || undefined, lastName: c.lastName || undefined, emailId: c.emailId || undefined, contactNumber: c.contactNumber || undefined };
  }
  const id = c.selected?.id;
  if (!id) return {};
  return c.kind === "lead" ? { leadRefId: id } : { clientId: id };
};
export const customerName = (c) => (c?.kind === "new" ? (c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ")) : c?.selected?.name) || "";

/** Generic risk details editor: label / value rows stored as { key: value }. */
export const RiskDetailsEditor = ({ value, onChange }) => {
  const { t } = useTranslation();
  const rows = Object.entries(value || {});
  const toKey = (label) => label.trim().replace(/[^A-Za-z0-9 ]/g, "").replace(/ (\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toLowerCase());
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  return (
    <div className="risk-details-editor">
      {rows.map(([k, v]) => (
        <div key={k} className="grid align-items-center">
          <div className="col-12 md:col-4 risk-key">{k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())}</div>
          <div className="col-10 md:col-7"><InputText value={v} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className="w-full" /></div>
          <div className="col-2 md:col-1"><Button icon="pi pi-times" text rounded severity="secondary" onClick={() => { const n = { ...value }; delete n[k]; onChange(n); }} aria-label={t("placement.actions.remove")} tooltip={t("placement.actions.remove")} tooltipOptions={{ position: "top" }} /></div>
        </div>
      ))}
      <div className="grid align-items-center">
        <div className="col-12 md:col-4"><InputText value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("placement.risk.itemPlaceholder")} className="w-full" /></div>
        <div className="col-10 md:col-7"><InputText value={text} onChange={(e) => setText(e.target.value)} placeholder={t("placement.risk.valuePlaceholder")} className="w-full" /></div>
        <div className="col-2 md:col-1">
          <Button icon="pi pi-plus" text rounded disabled={!label.trim()} onClick={() => { onChange({ ...(value || {}), [toKey(label)]: text }); setLabel(""); setText(""); }} aria-label={t("placement.actions.add")} tooltip={t("placement.actions.add")} tooltipOptions={{ position: "top" }} />
        </div>
      </div>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, children, onBack }) => (
  <div className="placement-header">
    <div className="placement-header-text">
      {onBack && <Button icon="pi pi-arrow-left" text rounded onClick={onBack} className="mr-2" aria-label="Back" tooltip="Back" tooltipOptions={{ position: "top" }} />}
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
    </div>
    <div className="placement-header-actions">{children}</div>
  </div>
);

/** A label and its value on one line; `wide` puts a long text (remarks, a reason) under its label across the grid. */
export const Field = ({ label, children, wide = false }) => (
  <div className={wide ? "placement-field placement-field--wide" : "placement-field"}>
    <span className="placement-field-label">{label}</span>
    <span className="placement-field-value">{children ?? "-"}</span>
  </div>
);
