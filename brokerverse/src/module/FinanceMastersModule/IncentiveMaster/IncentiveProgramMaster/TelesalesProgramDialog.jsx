import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { TabPanel, TabView } from "primereact/tabview";
import { Tag } from "primereact/tag";
import DateField from "../../../../components/DateField";
import FieldError from "../../../../components/FieldError";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../../../components/ReasonPicker";
import incentiveService from "../../../../services/incentiveService";
import { readableError } from "../../../../utility/apiError";
import { formatCurrency } from "../../../../utility/currencyConverter";
import { formatDate } from "../../../../utility/dateFormat";
import { hasPermission } from "../../../../utils/canOpen";

const iso = (d) => {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const toDate = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`) : null);
/** ANC to of each level (next ANC from - 0.01; the last "and above") and Up to of each band. */
export const ancTo = (tiers, i) => (tiers[i + 1] ? Math.round((Number(tiers[i + 1].ancFrom) - 0.01) * 100) / 100 : null);
export const upTo = (bands, i) => (bands[i + 1] ? bands[i + 1].over : null);
const errorOf = (errors, path) => (errors || []).filter((e) => e.path === path || String(e.path || "").startsWith(`${path}[`)).map((e) => e.message).join("; ");

/**
 * A Telesales incentive program (FRS COMM-08 FR-TSI-001 to 005): Basic Information (Motor products, minimum policies to
 * qualify, withholding tax %, effective month, change reason), Callers (insurance partner, Team Leader, dates;
 * Disqualify / Reinstate with approve:incentive), Incentive Structure (ANC tier table with new-business and renewal
 * amounts, production-excess table) and History (versions with their maker, approver and status). Save draft keeps the
 * open version; Submit for approval sends it to Configuration Approvals.
 */
const TelesalesProgramDialog = ({ programId, initial, visible, onHide, onSaved }) => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`incentiveProgramMaster.telesales.${key}`, opts);
  const [defaults, setDefaults] = useState(null);
  const [options, setOptions] = useState({ callers: [], teamLeaders: [], insurers: [] });
  const [program, setProgram] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [caller, setCaller] = useState(null);
  const [deciding, setDeciding] = useState(null);
  const approver = hasPermission("approve:incentive");

  const fill = useCallback((p, d) => {
    const v = p?.open || p?.current;
    setForm({
      programCode: p?.programCode || initial?.programCode || "", programName: p?.programName || initial?.programName || "", description: p?.description || initial?.description || "",
      products: v?.products || d?.defaultProducts || [], minPolicies: v?.minPolicies ?? d?.minPolicies ?? 15, whtPct: v?.whtPct ?? d?.whtPct ?? 5,
      effectiveFrom: toDate(p?.open ? v.effectiveFrom : (p ? p.firstOpenMonth || d?.effectiveFrom : d?.effectiveFrom)), endDate: toDate(p?.endDate),
      changeReason: p?.open?.changeReason || "",
      tiers: (v?.tiers || d?.tiers || []).map(({ ancFrom, nbAmount, renewalAmount }) => ({ ancFrom, nbAmount, renewalAmount })),
      bands: (v?.bands || d?.bands || []).map(({ over, every, amount }) => ({ over, every, amount })),
    });
  }, [initial]);

  const load = useCallback(async () => {
    const d = await incentiveService.telesalesDefaults();
    setDefaults(d);
    incentiveService.telesalesOptions().then(setOptions).catch(() => null);
    if (programId) {
      const p = await incentiveService.getTelesalesProgram(programId);
      setProgram(p);
      fill(p, d);
    } else {
      setProgram(null);
      fill(null, d);
    }
  }, [programId, fill]);

  useEffect(() => {
    if (visible) load().catch((e) => setMessage(readableError(e?.message)));
  }, [visible, load]);

  const body = () => ({ programCode: form.programCode || undefined, programName: form.programName, description: form.description || null, products: form.products,
    minPolicies: form.minPolicies, whtPct: form.whtPct, effectiveFrom: iso(form.effectiveFrom), endDate: iso(form.endDate), changeReason: form.changeReason || undefined,
    tiers: form.tiers, bands: form.bands });
  const run = async (fn, done) => {
    setBusy(true);
    setErrors([]);
    setMessage(null);
    try {
      const p = await fn();
      setWarnings(p?.warnings || []);
      setProgram(p);
      fill(p, defaults);
      setMessage(done);
      onSaved(p, done);
    } catch (e) {
      setErrors(e?.errors || e?.data?.errors || []);
      setMessage(readableError(e?.message) || t("confirmDialog.failed"));
    } finally {
      setBusy(false);
    }
  };
  const save = () => run(() => (program ? incentiveService.saveTelesalesDraft(program.id, body()) : incentiveService.createTelesalesProgram(body())), k("saved"));
  const submit = () => run(async () => {
    if (program) await incentiveService.saveTelesalesDraft(program.id, body());
    const p = program || (await incentiveService.createTelesalesProgram(body()));
    return incentiveService.submitTelesalesVersion(p.id, form.changeReason || undefined);
  }, k("submitted"));
  const recall = () => run(() => incentiveService.recallTelesalesVersion(program.id), k("recalled"));

  const pending = program?.open?.status === "Pending approval";
  const setRow = (list, i, key, value) => setForm((f) => ({ ...f, [list]: f[list].map((r, j) => (j === i ? { ...r, [key]: value } : r)) }));
  const addRow = (list, row) => setForm((f) => ({ ...f, [list]: [...f[list], row] }));
  const removeRow = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, j) => j !== i) }));

  const saveCaller = async () => {
    try {
      if (caller.id) await incentiveService.updateCaller(caller.id, { dateTo: iso(caller.dateTo), teamLeaderId: caller.teamLeaderId });
      else await incentiveService.addCaller(program.id, { userId: caller.userId, insuranceCompanyId: caller.insuranceCompanyId, teamLeaderId: caller.teamLeaderId, dateFrom: iso(caller.dateFrom), dateTo: iso(caller.dateTo) });
      setCaller(null);
      setProgram(await incentiveService.getTelesalesProgram(program.id));
    } catch (e) {
      setCaller((c) => ({ ...c, error: (e?.errors || []).map((x) => x.message).join("; ") || readableError(e?.message) }));
    }
  };
  const decide = async () => {
    const { row, action, reason, date, tried } = deciding;
    if (!tried) setDeciding((d) => ({ ...d, tried: true }));
    try {
      if (action === "disqualify") {
        if (reasonProblem(reason) || !reason?.note) {
          setDeciding((d) => ({ ...d, tried: true, error: k("disqualifyNeedsRemark") }));
          return;
        }
        await incentiveService.disqualifyCaller(row.id, { ...reasonPayload(reason), date: iso(date) });
      } else {
        await incentiveService.reinstateCaller(row.id, { note: reason?.note, date: iso(date) });
      }
      setDeciding(null);
      setProgram(await incentiveService.getTelesalesProgram(program.id));
    } catch (e) {
      setDeciding((d) => ({ ...d, error: readableError(e?.message) }));
    }
  };

  const footer = (
    <div className="dialog-footer">
      <Button type="button" label={k("cancel")} className="p-button-text" onClick={onHide} />
      {pending ? <Button type="button" label={k("recall")} outlined onClick={recall} loading={busy} /> : null}
      <Button type="button" label={k("saveDraft")} outlined onClick={save} loading={busy} disabled={pending} />
      <Button type="button" label={k("submit")} icon="pi pi-send" onClick={submit} loading={busy} disabled={pending} />
    </div>
  );

  return (
    <Dialog header={program ? k("editTitle", { code: program.programCode }) : k("addTitle")} visible={visible} onHide={onHide} style={{ width: "64rem" }} breakpoints={{ "960px": "96vw" }}
      footer={footer} className="ipm-dialog">
      {!form ? null : (
        <div className="ipm-form">
          {message ? <div className={errors.length ? "p-error" : "ipm-form__note"} role="status">{message}</div> : null}
          {warnings.map((w) => <div key={w.path} className="ipm-form__note">{w.message}</div>)}
          {program?.open?.returnRemark && program.open.status === "Draft" ? <div className="p-error">{k("returned", { remark: program.open.returnRemark })}</div> : null}
          <TabView>
            <TabPanel header={k("basic")}>
              <div className="form-grid">
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="ts-code">{t("incentiveProgramMaster.programCode")}</label>
                    <InputText id="ts-code" value={form.programCode} disabled={!!program} onChange={(e) => setForm({ ...form, programCode: e.target.value })} placeholder={t("incentiveProgramMaster.codeWhenBlank")} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="ts-name" className="ipm-form__required">{t("incentiveProgramMaster.programName")}</label>
                    <InputText id="ts-name" value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} />
                    <FieldError error={errorOf(errors, "programName")} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field full-width">
                    <label htmlFor="ts-desc">{t("incentiveProgramMaster.description")}</label>
                    <InputTextarea id="ts-desc" value={form.description} rows={2} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field"><label>{k("applicableTo")}</label><InputText value={k("caller")} disabled /></div>
                  <div className="form-field"><label>{k("targetMetric")}</label><InputText value={defaults?.targetMetric || ""} disabled /></div>
                  <div className="form-field"><label>{k("frequency")}</label><InputText value={k("monthly")} disabled /></div>
                </div>
                <div className="form-row">
                  <div className="form-field full-width">
                    <label htmlFor="ts-products" className="ipm-form__required">{k("products")}</label>
                    <MultiSelect inputId="ts-products" value={form.products} options={(defaults?.products || []).map((p) => ({ value: p.id, label: p.name }))} display="chip"
                      onChange={(e) => setForm({ ...form, products: e.value })} />
                    <FieldError error={errorOf(errors, "products")} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="ts-min" className="ipm-form__required">{k("minPolicies")}</label>
                    <InputNumber inputId="ts-min" value={form.minPolicies} min={1} max={999} onValueChange={(e) => setForm({ ...form, minPolicies: e.value })} />
                    <FieldError error={errorOf(errors, "minPolicies")} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="ts-wht" className="ipm-form__required">{k("whtPct")}</label>
                    <InputNumber inputId="ts-wht" value={form.whtPct} min={0} max={100} minFractionDigits={2} maxFractionDigits={2} onValueChange={(e) => setForm({ ...form, whtPct: e.value })} />
                    <FieldError error={errorOf(errors, "whtPct")} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="ts-eff" className="ipm-form__required">{k("effectiveFrom")}</label>
                    <DateField id="ts-eff" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
                    <FieldError error={errorOf(errors, "effectiveFrom")} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="ts-end">{t("incentiveProgramMaster.endDate")}</label>
                    <DateField id="ts-end" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>{k("status")}</label>
                    <InputText value={program?.open ? `${program.open.status} - ${k("version", { n: program.open.version })}` : program?.current ? k("inForce", { n: program.current.version }) : k("newDraft")} disabled />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field full-width">
                    <label htmlFor="ts-reason" className={program?.current ? "ipm-form__required" : undefined}>{k("changeReason")}</label>
                    <InputText id="ts-reason" value={form.changeReason} onChange={(e) => setForm({ ...form, changeReason: e.target.value })} />
                    <FieldError error={errorOf(errors, "changeReason")} />
                  </div>
                </div>
              </div>
            </TabPanel>
            <TabPanel header={k("callers")} disabled={!program}>
              <div className="ipm-tab-toolbar">
                <Button type="button" label={k("addCaller")} icon="pi pi-plus" size="small" onClick={() => setCaller({ dateFrom: new Date() })} />
              </div>
              <DataTable value={program?.callers || []} dataKey="id" size="small" emptyMessage={k("noCallers")}>
                <Column header={k("callerName")} body={(r) => <span>{r.name} <span className="inc-muted">{r.code}</span></span>} />
                <Column header={k("insurer")} field="insurer" />
                <Column header={k("teamLeader")} field="teamLeader" />
                <Column header={k("from")} body={(r) => formatDate(r.dateFrom)} />
                <Column header={k("to")} body={(r) => (r.dateTo ? formatDate(r.dateTo) : "-")} />
                <Column header={k("callerStatus")} body={(r) => (
                  <span><Tag value={k(`callerStatusValue.${r.status}`, { defaultValue: r.status })} severity={r.status === "Active" ? "success" : r.status === "Disqualified" ? "danger" : "secondary"} />
                    {r.status === "Disqualified" ? <span className="inc-muted"> {formatDate(r.disqualifiedFrom)} {r.disqualifyReason}</span> : null}</span>
                )} />
                <Column body={(r) => (
                  <span>
                    <Button type="button" icon="pi pi-pencil" text size="small" aria-label={k("editCaller")} onClick={() => setCaller({ ...r, dateFrom: toDate(r.dateFrom), dateTo: toDate(r.dateTo) })} />
                    {approver && r.status === "Active" ? <Button type="button" label={k("disqualify")} text size="small" severity="danger" onClick={() => setDeciding({ row: r, action: "disqualify", date: new Date() })} /> : null}
                    {approver && r.status === "Disqualified" ? <Button type="button" label={k("reinstate")} text size="small" onClick={() => setDeciding({ row: r, action: "reinstate", date: new Date() })} /> : null}
                  </span>
                )} />
              </DataTable>
            </TabPanel>
            <TabPanel header={k("structure")}>
              <h4>{k("tierTable")}</h4>
              <DataTable value={form.tiers.map((r, i) => ({ ...r, i }))} dataKey="i" size="small" emptyMessage={k("noLevels")}>
                <Column header={k("level")} body={(r) => r.i + 1} style={{ width: "5rem" }} />
                <Column header={k("ancFrom")} body={(r) => <InputNumber value={r.ancFrom} minFractionDigits={2} maxFractionDigits={2} aria-label={k("ancFrom")} onValueChange={(e) => setRow("tiers", r.i, "ancFrom", e.value)} />} />
                <Column header={k("ancTo")} body={(r) => (ancTo(form.tiers, r.i) === null ? k("andAbove") : formatCurrency(ancTo(form.tiers, r.i)))} />
                <Column header={k("nbAmount")} body={(r) => <InputNumber value={r.nbAmount} minFractionDigits={2} maxFractionDigits={2} aria-label={k("nbAmount")} onValueChange={(e) => setRow("tiers", r.i, "nbAmount", e.value)} />} />
                <Column header={k("renewalAmount")} body={(r) => <InputNumber value={r.renewalAmount} minFractionDigits={2} maxFractionDigits={2} aria-label={k("renewalAmount")} onValueChange={(e) => setRow("tiers", r.i, "renewalAmount", e.value)} />} />
                <Column body={(r) => <Button type="button" icon="pi pi-trash" text size="small" severity="danger" aria-label={k("removeLevel")} onClick={() => removeRow("tiers", r.i)} />} />
              </DataTable>
              <Button type="button" label={k("addLevel")} icon="pi pi-plus" size="small" text disabled={form.tiers.length >= 10} onClick={() => addRow("tiers", { ancFrom: null, nbAmount: null, renewalAmount: 0 })} />
              <FieldError error={errorOf(errors, "tiers")} />
              <h4>{k("bandTable")}</h4>
              <DataTable value={form.bands.map((r, i) => ({ ...r, i }))} dataKey="i" size="small" emptyMessage={k("noBands")}>
                <Column header={k("band")} body={(r) => r.i + 1} style={{ width: "5rem" }} />
                <Column header={k("over")} body={(r) => <InputNumber value={r.over} min={0} aria-label={k("over")} onValueChange={(e) => setRow("bands", r.i, "over", e.value)} />} />
                <Column header={k("upTo")} body={(r) => (upTo(form.bands, r.i) === null ? k("noLimit") : upTo(form.bands, r.i))} />
                <Column header={k("every")} body={(r) => <InputNumber value={r.every} min={1} aria-label={k("every")} onValueChange={(e) => setRow("bands", r.i, "every", e.value)} />} />
                <Column header={k("amount")} body={(r) => <InputNumber value={r.amount} minFractionDigits={2} maxFractionDigits={2} aria-label={k("amount")} onValueChange={(e) => setRow("bands", r.i, "amount", e.value)} />} />
                <Column body={(r) => <Button type="button" icon="pi pi-trash" text size="small" severity="danger" aria-label={k("removeBand")} onClick={() => removeRow("bands", r.i)} />} />
              </DataTable>
              <Button type="button" label={k("addBand")} icon="pi pi-plus" size="small" text disabled={form.bands.length >= 10} onClick={() => addRow("bands", { over: null, every: 1, amount: null })} />
              <FieldError error={errorOf(errors, "bands")} />
              <p className="ipm-form__note">{k("methodNote", { method: k(`method.${defaults?.excessMethod || "banded"}`) })}</p>
            </TabPanel>
            <TabPanel header={k("history")} disabled={!program}>
              <DataTable value={program?.versions || []} dataKey="id" size="small">
                <Column header={k("version", { n: "" })} body={(r) => `v${r.version}`} />
                <Column header={k("effectiveFrom")} body={(r) => formatDate(r.effectiveFrom)} />
                <Column header={k("minPolicies")} field="minPolicies" />
                <Column header={k("callerStatus")} body={(r) => (r.displayStatus === "Superseded" && r.supersededFrom ? k("supersededFrom", { date: formatDate(r.supersededFrom) }) : r.displayStatus)} />
                <Column header={k("maker")} field="createdBy" />
                <Column header={k("approver")} body={(r) => r.approvedBy || "-"} />
                <Column header={k("changeReason")} body={(r) => r.changeReason || r.returnRemark || "-"} />
              </DataTable>
            </TabPanel>
          </TabView>
        </div>
      )}
      <Dialog visible={!!caller} onHide={() => setCaller(null)} header={caller?.id ? k("editCaller") : k("addCaller")} style={{ width: "34rem" }} modal
        footer={<><Button type="button" label={k("cancel")} text onClick={() => setCaller(null)} /><Button type="button" label={k("saveCaller")} onClick={saveCaller} /></>}>
        {caller ? (
          <div className="ipm-form">
            <label htmlFor="ts-caller">{k("callerName")}</label>
            <Dropdown inputId="ts-caller" value={caller.userId} disabled={!!caller.id} filter options={options.callers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} onChange={(e) => setCaller({ ...caller, userId: e.value })} />
            <label htmlFor="ts-insurer">{k("insurer")}</label>
            <Dropdown inputId="ts-insurer" value={caller.insuranceCompanyId} disabled={!!caller.id} filter options={options.insurers.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => setCaller({ ...caller, insuranceCompanyId: e.value })} />
            <label htmlFor="ts-leader">{k("teamLeader")}</label>
            <Dropdown inputId="ts-leader" value={caller.teamLeaderId} filter options={options.teamLeaders.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => setCaller({ ...caller, teamLeaderId: e.value })} />
            <label htmlFor="ts-from">{k("from")}</label>
            <DateField id="ts-from" value={caller.dateFrom} disabled={!!caller.id} onChange={(e) => setCaller({ ...caller, dateFrom: e.target.value })} />
            <label htmlFor="ts-to">{k("to")}</label>
            <DateField id="ts-to" value={caller.dateTo || null} onChange={(e) => setCaller({ ...caller, dateTo: e.target.value })} />
            <FieldError error={caller.error} />
          </div>
        ) : null}
      </Dialog>
      <Dialog visible={!!deciding} onHide={() => setDeciding(null)} header={deciding ? k(`${deciding.action}Title`, { name: deciding.row.name }) : ""} style={{ width: "34rem" }} modal
        footer={<><Button type="button" label={k("cancel")} text onClick={() => setDeciding(null)} /><Button type="button" label={deciding ? k(deciding.action) : ""} onClick={decide} /></>}>
        {deciding ? (
          <div className="ipm-form">
            <label htmlFor="ts-dq-date">{k("date")}</label>
            <DateField id="ts-dq-date" value={deciding.date} onChange={(e) => setDeciding({ ...deciding, date: e.target.value })} />
            {deciding.action === "disqualify"
              ? <ReasonPicker context="incentive_disqualify" value={deciding.reason || null} onChange={(reason) => setDeciding((d) => ({ ...d, reason }))} showErrors={!!deciding.tried} />
              : (
                <>
                  <label htmlFor="ts-rq-note">{k("remark")}</label>
                  <InputTextarea id="ts-rq-note" rows={2} value={deciding.reason?.note || ""} onChange={(e) => setDeciding({ ...deciding, reason: { note: e.target.value } })} />
                </>
              )}
            <FieldError error={deciding.error} />
          </div>
        ) : null}
      </Dialog>
    </Dialog>
  );
};

TelesalesProgramDialog.propTypes = {
  /** the program edited; null for a new program */
  programId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** values typed on the Add Program dialog before Telesales was chosen */
  initial: PropTypes.object,
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
TelesalesProgramDialog.defaultProps = { programId: null, initial: null };

export default TelesalesProgramDialog;
