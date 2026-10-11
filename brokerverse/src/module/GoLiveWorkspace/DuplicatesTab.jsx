import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { RadioButton } from "primereact/radiobutton";
import { InputTextarea } from "primereact/inputtextarea";
import DetailDialog from "../../components/DetailDialog";
import FieldError from "../../components/FieldError";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import { FilterBar } from "../../components/RecordPage";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { dateTimeOf, num, useWorkspace } from "./shared";

export const RULES = ["tin", "name-birth-date", "company-name", "vehicle", "coc", "policy-number", "insurer-variant", "master-name"];
const RESOLVABLE = ["validated", "failed"];
const PAGE = 50;
export const REASON_MIN = 5;

/** The records a duplicate row matches: a row of the same file or a record of BrokerVerse with its number and name. */
const matchesText = (t, matches = []) => matches.map((m) => (m.kind === "file" ? t("goLive.duplicates.fileRow", { row: m.row ?? m.number }) : [m.number, m.name].filter(Boolean).join(" "))).join("; ");

/** What is wrong with a resolution form, by field (empty when it can be sent). */
export const resolutionProblems = (form, rows, t) => {
  const out = {};
  if (form.resolution === undefined) out.resolution = t("goLive.duplicates.chooseResolution");
  if (form.resolution === "insurer-suffix" && rows.some((r) => !(r.duplicates || []).some((m) => m.rule === "policy-number"))) {
    out.resolution = t("goLive.duplicates.suffixOnlyPolicy");
  }
  if (form.resolution === "use-existing" && form.needsTarget && !form.targetCode) out.targetCode = t("goLive.duplicates.chooseRecord");
  if (String(form.reason || "").trim().length < REASON_MIN) out.reason = t("goLive.duplicates.reasonRequired", { count: REASON_MIN });
  return out;
};

/** Resolution of duplicate rows (chosen rows, or every row of a rule): load as new, use the existing record, insurer suffix, or clear. */
export const ResolveDialog = ({ batch, rows, rule, onHide, onDone }) => {
  const { t } = useTranslation();
  const storedNumbers = useMemo(() => (rows.length === 1 ? [...new Set((rows[0].duplicates || []).filter((m) => m.kind !== "file").map((m) => m.number))] : []), [rows]);
  const [form, setForm] = useState({ resolution: undefined, targetCode: null, reason: "", needsTarget: storedNumbers.length > 1 });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problems = tried ? resolutionProblems(form, rows, t) : {};
  const suffixAllowed = rows.length > 0 && rows.every((r) => (r.duplicates || []).some((m) => m.rule === "policy-number"));
  const options = [
    { value: "load-as-new", label: t("goLive.duplicates.loadAsNew") },
    { value: "use-existing", label: t("goLive.duplicates.useExisting") },
    ...(suffixAllowed ? [{ value: "insurer-suffix", label: t("goLive.duplicates.insurerSuffix") }] : []),
    { value: null, label: t("goLive.duplicates.clear") },
  ];
  const save = async () => {
    setTried(true);
    if (Object.keys(resolutionProblems(form, rows, t)).length) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.resolveDuplicates(batch.id, {
        ...(rule ? { rule } : { rows: rows.map((r) => r.id) }), resolution: form.resolution, targetCode: form.resolution === "use-existing" ? form.targetCode : null,
        reason: form.reason.trim(),
      });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="md" header={rule ? t("goLive.duplicates.resolveRule", { rule: t(`goLive.rule.${rule}`) }) : t("goLive.duplicates.resolveRows", { count: rows.length })}
      footer={(
        <>
          <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
          <Button type="button" label={t("goLive.duplicates.resolve")} icon="pi pi-check" onClick={save} loading={busy} />
        </>
      )}>
      <div className="go-live__form" role="radiogroup" aria-label={t("goLive.duplicates.resolution")}>
        <span className="bv-field-label">{t("goLive.duplicates.resolution")}<span className="required-marker">*</span></span>
        {options.map((o) => (
          <div key={String(o.value)} className="go-live__radio">
            <RadioButton inputId={`res-${o.value}`} name="resolution" value={o.value} checked={form.resolution === o.value}
              onChange={() => setForm((f) => ({ ...f, resolution: o.value }))} />
            <label htmlFor={`res-${o.value}`}>{o.label}</label>
          </div>
        ))}
        <FieldError error={problems.resolution} />
        {form.resolution === "use-existing" && form.needsTarget ? (
          <>
            <label htmlFor="res-target" className="bv-field-label">{t("goLive.duplicates.record")}<span className="required-marker">*</span></label>
            <Dropdown inputId="res-target" value={form.targetCode} options={storedNumbers.map((n) => ({ label: n, value: n }))}
              onChange={(e) => setForm((f) => ({ ...f, targetCode: e.value }))} className={`w-full${problems.targetCode ? " p-invalid" : ""}`} placeholder={t("goLive.common.choose")} />
            <FieldError error={problems.targetCode} />
          </>
        ) : null}
        <label htmlFor="res-reason" className="bv-field-label">{t("goLive.duplicates.reason")}<span className="required-marker">*</span></label>
        <InputTextarea id="res-reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} autoResize maxLength={500}
          className={`w-full${problems.reason ? " p-invalid" : ""}`} />
        <FieldError error={problems.reason} />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Duplicate rows of a load grouped by rule, with what they match and their resolution. */
const DuplicatesTab = ({ batch, canResolve, onResolved }) => {
  const { t } = useTranslation();
  const { notify } = useWorkspace();
  const [rule, setRule] = useState(null);
  const [first, setFirst] = useState(0);
  const [selected, setSelected] = useState([]);
  const [resolving, setResolving] = useState(null);
  const loader = useCallback(() => goLiveService.batchDuplicates(batch.id, { rule, page: first / PAGE + 1, perPage: PAGE }), [batch.id, rule, first]);
  const { data, loading, refreshing } = useStableLoad(loader, { initialData: { rows: [], total: 0 } });
  const open = canResolve && RESOLVABLE.includes(batch.status);

  const done = () => {
    setResolving(null);
    setSelected([]);
    notify("success", t("goLive.duplicates.resolved"));
    onResolved();
  };

  return (
    <div className="bv-loading-host">
      <LoadingBar active={refreshing} />
      <FilterBar active={!!rule} onClear={() => { setRule(null); setFirst(0); }} end={open ? (
        <div className="go-live__actions">
          <Button type="button" label={t("goLive.duplicates.resolveSelected", { count: selected.length })} icon="pi pi-check-square" outlined disabled={!selected.length}
            onClick={() => setResolving({ rows: selected, rule: null })} />
          <Button type="button" label={t("goLive.duplicates.resolveAll")} icon="pi pi-list-check" outlined disabled={!rule || !data?.total}
            onClick={() => setResolving({ rows: data.rows, rule })} />
        </div>
      ) : null}>
        <Dropdown value={rule} options={RULES.map((r) => ({ label: t(`goLive.rule.${r}`), value: r }))} onChange={(e) => { setRule(e.value || null); setFirst(0); setSelected([]); }}
          showClear placeholder={t("goLive.duplicates.allRules")} aria-label={t("goLive.duplicates.rule")} />
      </FilterBar>
      <DataTable value={data?.rows || []} dataKey="id" size="small" lazy paginator rows={PAGE} first={first} totalRecords={data?.total || 0} onPage={(e) => setFirst(e.first)}
        loading={loading} emptyMessage={t("goLive.duplicates.none")} selection={open ? selected : null} onSelectionChange={(e) => setSelected(e.value)}
        selectionMode={open ? "checkbox" : null}>
        {open ? <Column selectionMode="multiple" style={{ width: "3rem" }} /> : null}
        <Column field="sheetName" header={t("goLive.load.sheet")} />
        <Column field="row" header={t("goLive.load.row")} {...num} />
        <Column field="key" header={t("goLive.rows.key")} />
        <Column header={t("goLive.duplicates.rule")} body={(r) => [...new Set((r.duplicates || []).map((m) => t(`goLive.rule.${m.rule}`, { defaultValue: m.label })))].join(", ")} />
        <Column header={t("goLive.duplicates.matches")} body={(r) => matchesText(t, r.duplicates) || "—"} />
        <Column header={t("goLive.duplicates.resolution")} body={(r) => (r.resolution
          ? <StatusChip label={t(`goLive.duplicates.resolutions.${r.resolution}`)} severity="success" />
          : <StatusChip label={t("goLive.duplicates.unresolved")} severity="warning" />)} />
        <Column header={t("goLive.duplicates.resolvedBy")} body={(r) => (r.resolvedBy ? `${r.resolvedBy} · ${dateTimeOf(r.resolvedAt)}` : "—")} />
        <Column field="resolutionReason" header={t("goLive.duplicates.reason")} body={(r) => r.resolutionReason || "—"} />
      </DataTable>
      {resolving ? <ResolveDialog batch={batch} rows={resolving.rows} rule={resolving.rule} onHide={() => setResolving(null)} onDone={done} /> : null}
    </div>
  );
};

export default DuplicatesTab;
