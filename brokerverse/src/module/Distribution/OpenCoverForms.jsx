import React, { useEffect, useState } from "react";
import FileField from "../../components/FileField";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import service from "../../services/distributionService";
import KeyValueGrid from "../../components/KeyValueGrid";
import { Field, fieldErrors, fromIsoDay, isoDay, money, num } from "./common";

export const CONVEYANCES = ["Sea", "Air", "Land"];
export const premiumOf = (covers) => Math.round((covers || []).reduce((s, c) => s + Number(c.premium || 0), 0) * 100) / 100;

/** The choices of the open cover panels (GET /marine/choices), loaded once per screen. */
export const useCoverChoices = () => {
  const [choices, setChoices] = useState({ types: [], layouts: [], defaultCovers: [], deliveryTypes: [], coverLines: ["MARINE", "PA"], documentsSent: [], cancelReasons: [], defaultCharge: 500 });
  useEffect(() => {
    service.openCoverChoices().then(setChoices).catch(() => {});
  }, []);
  return choices;
};

/** Form values of the terms of a cover (new cover: the defaults of its type). */
export const termsForm = (cover, choices, type = "parcel") => (cover ? {
  periodTo: fromIsoDay(cover.periodTo), goodsDescription: cover.goodsDescription || "", voyageScope: cover.voyageScope || "", clauses: cover.clauses || "", insurerReference: cover.insurerReference || "",
  rates: CONVEYANCES.map((c) => cover.rates.find((r) => r.conveyance === c) || { conveyance: c, ratePercent: null, limit: null }), markupPercent: cover.markupPercent, minimumPremium: cover.minimumPremium,
  declarationFrequency: cover.declarationFrequency, covers: cover.covers.map((c) => ({ ...c })), chargePerCertificate: cover.chargePerCertificate, deliveryTypes: cover.deliveryTypes,
  remittanceBasis: cover.remittanceBasis, dailyDeclaration: cover.dailyDeclaration, fileFrequency: cover.fileFrequency, fileLayout: cover.fileLayout, declarationEmail: cover.declarationEmail || "",
} : {
  periodTo: null, goodsDescription: type === "parcel" ? "Loan collateral documents sent by courier" : "", voyageScope: "", clauses: type === "parcel" ? "" : "Institute Cargo Clauses (A); Institute War and Strikes Clauses (Cargo)",
  insurerReference: "", rates: CONVEYANCES.map((c) => ({ conveyance: c, ratePercent: null, limit: null })), markupPercent: type === "parcel" ? 0 : 10, minimumPremium: type === "parcel" ? 0 : 500,
  declarationFrequency: "monthly", covers: (choices.defaultCovers || []).map((c) => ({ ...c })), chargePerCertificate: choices.defaultCharge, deliveryTypes: choices.deliveryTypes || [],
  remittanceBasis: type === "parcel" ? "gross" : "net", dailyDeclaration: choices.dailyDeclaration !== false, fileFrequency: type === "parcel" ? "monthly" : null,
  fileLayout: type === "parcel" ? "axa-parcel" : null, declarationEmail: "",
});

/** API body of the terms of a form. */
export const termsBody = (f, type) => ({
  periodTo: isoDay(f.periodTo), goodsDescription: f.goodsDescription, voyageScope: f.voyageScope || null, clauses: f.clauses || null, insurerReference: f.insurerReference || null,
  ...(type === "parcel"
    ? { covers: f.covers.map((c) => ({ ...c, coverDays: c.coverDays || null })), chargePerCertificate: f.chargePerCertificate, deliveryTypes: f.deliveryTypes }
    : { rates: f.rates.filter((x) => x.ratePercent && x.limit), markupPercent: f.markupPercent, minimumPremium: f.minimumPremium || 0, declarationFrequency: f.declarationFrequency }),
  remittanceBasis: f.remittanceBasis, dailyDeclaration: f.dailyDeclaration, fileFrequency: f.fileFrequency || null, fileLayout: f.fileFrequency ? f.fileLayout : null, declarationEmail: f.declarationEmail || null,
});

/** The terms fields of a cover of a type (New open cover, Endorse open policy). `errors` by API path. */
export const TermsFields = ({ type, form, setForm, choices, errors = {}, endorsing = false }) => {
  const { t } = useTranslation();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setCover = (i, patch) => setForm((f) => ({ ...f, covers: f.covers.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));
  const setRate = (i, patch) => setForm((f) => ({ ...f, rates: f.rates.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));
  const premium = premiumOf(form.covers);
  const coverErr = (i, k) => errors[`covers.${i}.${k}`];
  return (
    <>
      <Field label={t("distribution.fl.to", "Period to")} htmlFor="oc-periodTo" error={errors.periodTo}>
        <Calendar inputId="oc-periodTo" value={form.periodTo} dateFormat="yy-mm-dd" showIcon onChange={(e) => set({ periodTo: e.value })} />
      </Field>
      <Field label={t("distribution.oc.insurerReference", "Insurer's reference")} htmlFor="oc-ref" required={type === "parcel"} error={errors.insurerReference}>
        <InputText id="oc-ref" value={form.insurerReference} onChange={(e) => set({ insurerReference: e.target.value })} />
      </Field>
      {!endorsing ? (
        <Field label={t("distribution.oc.goods", "Goods insured")} htmlFor="oc-goods" full required error={errors.goodsDescription}>
          <InputText id="oc-goods" value={form.goodsDescription} onChange={(e) => set({ goodsDescription: e.target.value })} />
        </Field>
      ) : null}
      {type === "cargo" ? (
        <Field label={t("distribution.oc.voyages", "Voyages")} htmlFor="oc-voyages" full><InputText id="oc-voyages" value={form.voyageScope} onChange={(e) => set({ voyageScope: e.target.value })} /></Field>
      ) : null}
      <Field label={t("distribution.oc.clauses", "Clauses")} htmlFor="oc-clauses" full><InputTextarea id="oc-clauses" rows={2} value={form.clauses} onChange={(e) => set({ clauses: e.target.value })} /></Field>
      {type === "parcel" ? (
        <div className="dist-field dist-field--full">
          <label>{t("distribution.oc.coversOnCertificate", "Covers on each certificate")}</label>
          <DataTable value={form.covers} size="small" dataKey="name">
            <Column header={t("distribution.oc.coverName", "Cover")} body={(c, o) => <InputText value={c.name} aria-label={t("distribution.oc.coverName", "Cover")} invalid={Boolean(coverErr(o.rowIndex, "name"))} onChange={(e) => setCover(o.rowIndex, { name: e.target.value })} />} />
            <Column header={t("distribution.oc.line", "Line")} body={(c, o) => <Dropdown value={c.line} options={(choices.coverLines || []).map((l) => ({ value: l, label: t(`distribution.oc.lines.${l}`, l) }))} aria-label={t("distribution.oc.line", "Line")} onChange={(e) => setCover(o.rowIndex, { line: e.value })} />} />
            <Column header={t("distribution.oc.policyNo", "Insurer policy no.")} body={(c, o) => <InputText value={c.insurerPolicyNo || ""} aria-label={t("distribution.oc.policyNo", "Insurer policy no.")} onChange={(e) => setCover(o.rowIndex, { insurerPolicyNo: e.target.value })} />} />
            <Column header={t("distribution.oc.sumInsured", "Sum insured")} body={(c, o) => <InputNumber value={c.sumInsured} min={0} minFractionDigits={2} aria-label={t("distribution.oc.sumInsured", "Sum insured")} onValueChange={(e) => setCover(o.rowIndex, { sumInsured: e.value })} />} />
            <Column header={t("distribution.oc.coverPremium", "Premium incl. taxes")} body={(c, o) => <InputNumber value={c.premium} min={0} minFractionDigits={2} aria-label={t("distribution.oc.coverPremium", "Premium incl. taxes")} invalid={Boolean(coverErr(o.rowIndex, "premium"))} onValueChange={(e) => setCover(o.rowIndex, { premium: e.value })} />} />
            <Column header={t("distribution.oc.commissionPct", "Commission %")} body={(c, o) => <InputNumber value={c.commissionPercent} min={0} max={100} maxFractionDigits={2} aria-label={t("distribution.oc.commissionPct", "Commission %")} onValueChange={(e) => setCover(o.rowIndex, { commissionPercent: e.value })} />} />
            <Column header={t("distribution.oc.coverDays", "Cover days")} body={(c, o) => <InputNumber value={c.coverDays} min={1} useGrouping={false} placeholder={t("distribution.oc.transit", "Transit")} aria-label={t("distribution.oc.coverDays", "Cover days")} onValueChange={(e) => setCover(o.rowIndex, { coverDays: e.value })} />} />
            <Column body={(c, o) => <Button icon="pi pi-trash" text severity="danger" aria-label={t("common.delete", "Delete")} onClick={() => setForm((f) => ({ ...f, covers: f.covers.filter((_, k) => k !== o.rowIndex) }))} />} />
          </DataTable>
          <div className="flex gap-3 align-items-center mt-2">
            <Button label={t("distribution.oc.addCover", "Add cover")} icon="pi pi-plus" text size="small"
              onClick={() => setForm((f) => ({ ...f, covers: [...f.covers, { name: "", line: "MARINE", insurerPolicyNo: "", sumInsured: null, premium: null, commissionPercent: 0, coverDays: null }] }))} />
            <span>{t("distribution.oc.premiumPerCertificate", "Premium per certificate")}: <strong>{money(premium)}</strong></span>
          </div>
          {errors.covers ? <small className="p-error" role="alert">{errors.covers}</small> : null}
          {Object.entries(errors).filter(([k]) => k.startsWith("covers.")).map(([k, v]) => <small key={k} className="p-error block" role="alert">{v}</small>)}
        </div>
      ) : (
        <>
          {/* sea and air need the Phase 2 feature marine-cargo; inland (Land) is always offered */}
          {form.rates.map((r, i) => (choices.cargoEnabled === false && !(choices.inlandConveyances || ["Land"]).includes(r.conveyance) ? null : (
            <Field key={r.conveyance} label={`${t(`distribution.oc.conveyance.${r.conveyance}`, r.conveyance)}: ${t("distribution.oc.rateAndLimit", "rate % and limit per conveyance")}`} full>
              <span className="flex gap-2">
                <InputNumber value={r.ratePercent} min={0} maxFractionDigits={4} placeholder={t("distribution.oc.rate", "Rate %")} aria-label={t("distribution.oc.rate", "Rate %")} onValueChange={(e) => setRate(i, { ratePercent: e.value })} />
                <InputNumber value={r.limit} min={0} placeholder={t("distribution.oc.limit", "Limit any one conveyance")} aria-label={t("distribution.oc.limit", "Limit any one conveyance")} onValueChange={(e) => setRate(i, { limit: e.value })} />
              </span>
            </Field>
          )))}
          <Field label={t("distribution.oc.markup", "Mark-up on invoice %")} htmlFor="oc-markup"><InputNumber inputId="oc-markup" value={form.markupPercent} min={0} max={100} onValueChange={(e) => set({ markupPercent: e.value ?? 0 })} /></Field>
          <Field label={t("distribution.oc.minimum", "Minimum premium per certificate")} htmlFor="oc-min"><InputNumber inputId="oc-min" value={form.minimumPremium} min={0} onValueChange={(e) => set({ minimumPremium: e.value ?? 0 })} /></Field>
          <Field label={t("distribution.oc.frequency", "Declarations")} htmlFor="oc-freq">
            <Dropdown inputId="oc-freq" value={form.declarationFrequency} options={["monthly", "quarterly"].map((v) => ({ value: v, label: t(`distribution.oc.freq.${v}`, v) }))} onChange={(e) => set({ declarationFrequency: e.value })} />
          </Field>
        </>
      )}
      {type === "parcel" ? (
        <>
          <Field label={t("distribution.oc.charge", "Charge per certificate billed to the client")} htmlFor="oc-charge" required error={errors.chargePerCertificate}
            help={t("distribution.oc.serviceFeeHelp", "Service fee {{fee}}", { fee: money(Math.max(Number(form.chargePerCertificate || 0) - premium, 0)) })}>
            <InputNumber inputId="oc-charge" value={form.chargePerCertificate} min={0} minFractionDigits={2} onValueChange={(e) => set({ chargePerCertificate: e.value })} />
          </Field>
          <Field label={t("distribution.oc.deliveryTypes", "Delivery types (reference)")}>
            <span>{(form.deliveryTypes || []).map((d) => `${d.label} ${money(d.charge)}`).join(" · ")}</span>
          </Field>
        </>
      ) : null}
      <Field label={t("distribution.oc.remittanceBasis", "Remittance basis")} htmlFor="oc-basis">
        <Dropdown inputId="oc-basis" value={form.remittanceBasis} options={["gross", "net"].map((v) => ({ value: v, label: t(`distribution.oc.basis.${v}`, v) }))} onChange={(e) => set({ remittanceBasis: e.value })} />
      </Field>
      <Field label={t("distribution.oc.dailyDeclaration", "Daily declaration")} htmlFor="oc-daily">
        <InputSwitch inputId="oc-daily" checked={Boolean(form.dailyDeclaration)} onChange={(e) => set({ dailyDeclaration: e.value })} />
      </Field>
      <Field label={t("distribution.oc.fileFrequency", "Declaration file to the insurer")} htmlFor="oc-filefreq">
        <Dropdown inputId="oc-filefreq" value={form.fileFrequency} showClear placeholder={t("distribution.oc.noFile", "No file")}
          options={["monthly", "daily"].map((v) => ({ value: v, label: t(`distribution.oc.fileFreq.${v}`, v) }))} onChange={(e) => set({ fileFrequency: e.value || null })} />
      </Field>
      {form.fileFrequency ? (
        <>
          <Field label={t("distribution.oc.fileLayout", "File layout")} htmlFor="oc-layout" error={errors.fileLayout}>
            <Dropdown inputId="oc-layout" value={form.fileLayout} options={choices.layouts || []} onChange={(e) => set({ fileLayout: e.value })} />
          </Field>
          <Field label={t("distribution.oc.declarationEmail", "Declaration file e-mail to")} htmlFor="oc-email" error={errors.declarationEmail}>
            <InputText id="oc-email" type="email" value={form.declarationEmail} onChange={(e) => set({ declarationEmail: e.target.value })} />
          </Field>
        </>
      ) : null}
    </>
  );
};

/** Add parcel (FR-PCL-011): the fields of one row of the TFS list; covers and premium read-only from the cover. */
export const ParcelDialog = ({ cover, choices, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ parcelDate: new Date(), customerName: "", loanAccount: "", addressLine: "", barangay: "", city: "", province: "", zipCode: "", mobile: "", email: "",
    documentsSent: [], courier: choices.defaultCourier || "LBC Express", waybillNo: "", deliveryType: cover.deliveryTypes?.[0]?.label || "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const r = await service.addParcel(cover.id, { ...form, parcelDate: isoDay(form.parcelDate), documentsSent: form.documentsSent.join("; ") });
      onSaved(r);
    } catch (e) {
      setErrors({ ...fieldErrors(e), form: e.message });
    } finally {
      setSaving(false);
    }
  };
  const text = (k, label, required = false) => (
    <Field key={k} label={label} htmlFor={`pc-${k}`} required={required} error={errors[k]}>
      <InputText id={`pc-${k}`} value={form[k]} onChange={(e) => set({ [k]: e.target.value })} />
    </Field>
  );
  return (
    <Dialog className="pe-dialog" visible header={t("distribution.oc.addParcelTitle", "Add Parcel")} style={{ width: "min(860px, 96vw)" }} onHide={onHide}
      footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={onHide} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" loading={saving} onClick={save} /></div>}>
      <div className="dist-grid">
        <Field label={t("distribution.oc.parcelDate", "Parcel date")} htmlFor="pc-date" required error={errors.parcelDate}>
          <Calendar inputId="pc-date" value={form.parcelDate} dateFormat="yy-mm-dd" showIcon maxDate={new Date()} onChange={(e) => set({ parcelDate: e.value })} />
        </Field>
        {text("customerName", t("distribution.oc.customer", "Customer name"), true)}
        {text("loanAccount", t("distribution.oc.loanAccount", "TFS loan account"), true)}
        {text("waybillNo", t("distribution.oc.waybill", "Waybill no."), true)}
        {text("addressLine", t("distribution.oc.addressLine", "Address line"), true)}
        {text("barangay", t("distribution.oc.barangay", "Barangay"))}
        {text("city", t("distribution.oc.city", "City or municipality"), true)}
        {text("province", t("distribution.oc.province", "Province"), true)}
        {text("zipCode", t("distribution.oc.zip", "ZIP code"))}
        {text("mobile", t("distribution.oc.mobile", "Mobile number"))}
        {text("email", t("distribution.oc.email", "E-mail"))}
        {text("courier", t("distribution.oc.courier", "Courier"))}
        <Field label={t("distribution.oc.documentsSent", "Documents sent")} htmlFor="pc-docs" required error={errors.documentsSent}>
          <span className="flex flex-wrap gap-2">
            {(choices.documentsSent || []).map((d) => (
              <Button key={d} label={d} size="small" outlined={!form.documentsSent.includes(d)} aria-pressed={form.documentsSent.includes(d)}
                onClick={() => set({ documentsSent: form.documentsSent.includes(d) ? form.documentsSent.filter((x) => x !== d) : [...form.documentsSent, d] })} />
            ))}
          </span>
        </Field>
        <Field label={t("distribution.oc.deliveryType", "Delivery type")} htmlFor="pc-dt" required error={errors.deliveryType}>
          <Dropdown inputId="pc-dt" value={form.deliveryType} options={(cover.deliveryTypes || []).map((d) => ({ value: d.label, label: `${d.label} (${money(d.charge)})` }))} onChange={(e) => set({ deliveryType: e.value })} />
        </Field>
        <div className="dist-field dist-field--full">
          <KeyValueGrid columns={3} items={[
            ...cover.covers.map((c) => ({ label: c.name, value: `${money(c.sumInsured)} / ${money(c.premium)}` })),
            { label: t("distribution.oc.premiumPerCertificate", "Premium per certificate"), value: cover.premiumPerCertificate, type: "amount" },
          ]} />
        </div>
      </div>
      {errors.form && !Object.keys(errors).some((k) => k !== "form") ? <small className="p-error" role="alert">{errors.form}</small> : null}
    </Dialog>
  );
};

/** Upload parcels / Upload shipments (base upload pattern): date, template, file, result with one line per failed row or warning. */
export const UploadDialog = ({ cover, kind, onHide, onDone }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(new Date());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const parcels = kind === "parcels";
  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = parcels ? await service.uploadParcels(cover.id, file, isoDay(date)) : await service.uploadShipments(cover.id, file);
      setResult({ message: r.message, ...r.data });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const template = () => (parcels ? service.parcelTemplate() : service.shipmentTemplate()).catch((e) => setError(e.message));
  return (
    <Dialog className="pe-dialog" visible header={parcels ? t("distribution.oc.uploadParcels", "Upload parcels") : t("distribution.oc.uploadShipments", "Upload shipments")}
      style={{ width: "min(720px, 96vw)" }} onHide={onHide}
      footer={<div><Button label={t("distribution.common.close", "Close")} text onClick={onHide} /><Button label={t("distribution.oc.upload", "Upload")} icon="pi pi-upload" loading={busy} disabled={!file} onClick={upload} /></div>}>
      <div className="dist-grid">
        {parcels ? (
          <Field label={t("distribution.oc.parcelDate", "Parcel date")} htmlFor="up-date">
            <Calendar inputId="up-date" value={date} dateFormat="yy-mm-dd" showIcon maxDate={new Date()} onChange={(e) => setDate(e.value)} />
          </Field>
        ) : null}
        <Field label={t("distribution.oc.file", "Excel file (.xlsx)")} htmlFor="up-file">
          <FileField id="up-file" accept=".xlsx" value={file} onChange={setFile} />
        </Field>
        <div className="dist-field dist-field--full"><Button label={t("distribution.oc.template", "Download template")} icon="pi pi-download" text onClick={template} /></div>
      </div>
      {error ? <small className="p-error" role="alert">{error}</small> : null}
      {result ? (
        <div className="mt-2">
          <strong>{result.message}</strong>
          {(result.messages || []).map((m) => <div key={m.text} className="bv-text-alert">{m.text}</div>)}
        </div>
      ) : null}
    </Dialog>
  );
};

/** Record the insurer's acceptance of a declaration (FR-PCL-024). */
export const AcceptanceDialog = ({ declaration, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ date: new Date(), reference: "", result: "accepted", rows: null, premium: null, remark: "" });
  const [errors, setErrors] = useState({});
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    try {
      const r = await service.recordAcceptance(declaration.id, { ...form, date: isoDay(form.date) });
      onSaved(r);
    } catch (e) {
      setErrors({ ...fieldErrors(e), form: e.message });
    }
  };
  return (
    <Dialog className="pe-dialog" visible header={t("distribution.oc.recordAcceptance", "Record insurer acceptance")} style={{ width: "min(640px, 96vw)" }} onHide={onHide}
      footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={onHide} /><Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={save} /></div>}>
      <div className="dist-grid">
        <Field label={t("distribution.oc.acceptedOn", "Date")} htmlFor="ac-date"><Calendar inputId="ac-date" value={form.date} dateFormat="yy-mm-dd" showIcon onChange={(e) => set({ date: e.value })} /></Field>
        <Field label={t("distribution.oc.insurerRef", "Insurer's reference")} htmlFor="ac-ref" required error={errors.insurerReference}>
          <InputText id="ac-ref" value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
        </Field>
        <Field label={t("distribution.oc.result", "Result")} htmlFor="ac-result">
          <Dropdown inputId="ac-result" value={form.result} options={["accepted", "accepted-with-differences"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }))} onChange={(e) => set({ result: e.value })} />
        </Field>
        {form.result !== "accepted" ? (
          <>
            <Field label={t("distribution.oc.rowsAccepted", "Rows accepted")} htmlFor="ac-rows"><InputNumber inputId="ac-rows" value={form.rows} min={0} onValueChange={(e) => set({ rows: e.value })} /></Field>
            <Field label={t("distribution.oc.premiumAccepted", "Premium accepted")} htmlFor="ac-prem"><InputNumber inputId="ac-prem" value={form.premium} minFractionDigits={2} onValueChange={(e) => set({ premium: e.value })} /></Field>
            <Field label={t("distribution.oc.remark", "Remark")} htmlFor="ac-remark" full required error={errors.remark}>
              <InputTextarea id="ac-remark" rows={2} value={form.remark} onChange={(e) => set({ remark: e.target.value })} />
            </Field>
          </>
        ) : null}
      </div>
    </Dialog>
  );
};

/** The fields an endorsement changed, before and after (approver's view). */
export const EndorsementChanges = ({ endorsement }) => {
  const { t } = useTranslation();
  const show = (v) => {
    if (v === null || v === undefined || v === "") return "-";
    if (Array.isArray(v)) return v.map((x) => (x.name ? `${x.name}: ${num(x.sumInsured)} / ${num(x.premium)} (${x.commissionPercent}%)` : x.conveyance ? `${x.conveyance} ${x.ratePercent}% / ${num(x.limit)}` : x.label || JSON.stringify(x))).join("; ");
    if (typeof v === "boolean") return v ? t("common.yes", "Yes") : t("common.no", "No");
    return String(v);
  };
  const rows = (endorsement.changedFields || []).map((k) => ({ field: t(`distribution.oc.term.${k}`, k), before: show(endorsement.beforeTerms?.[k]), after: show(endorsement.changes[k]) }));
  return (
    <DataTable value={rows} size="small" dataKey="field">
      <Column field="field" header={t("distribution.oc.changedField", "Changed")} />
      <Column field="before" header={t("distribution.oc.before", "Before")} />
      <Column field="after" header={t("distribution.oc.after", "After")} bodyClassName="font-bold" />
    </DataTable>
  );
};
