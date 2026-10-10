import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import placementService from "../../services/placementService";
import s3Service from "../../services/s3Service";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { calendarDateFormat } from "../../utility/dateFormat";
import { formatDate } from "./shared";
import { fromIso, isoDate } from "./dates";
import FileField from "../../components/FileField";

const VEHICLE = ["chassisNumber", "motorNumber", "plateNumber", "mvFileNumber"];
const AMOUNTS = ["sumInsured", "netPremium", "grossPremium", "commissionAmount"];
const blank = (v) => !v || ["TBA", "N/A"].includes(String(v).trim().toUpperCase());

/** The form values for a placement: the last e-policy recorded (returned to the insurer), else the slip's figures. */
export const epolicyFormValues = (p) => {
  const ep = p.epolicy || {};
  const doc = p.doc || {};
  const vehicle = doc.insuranceVehicleDetails?.[0] || {};
  const prefill = p.kycPrefill || {};
  const carried = (k) => [ep.vehicle?.[k], prefill[k], doc[k], vehicle[k], p.riskDetails?.[k]].find((v) => !blank(v)) || "";
  return {
    insurerPolicyNumber: ep.insurerPolicyNumber || "", brokerPolicyNumber: ep.brokerPolicyNumber || "", participantName: ep.participantName || p.insuredName || p.customerName || "",
    sumInsured: ep.sumInsured ?? p.sumInsured, netPremium: ep.netPremium ?? p.netPremium, grossPremium: ep.grossPremium ?? p.grossPremium, commissionAmount: ep.commissionAmount ?? p.commissionAmount,
    issueDate: fromIso(ep.issueDate), issuanceDate: fromIso(ep.issuanceDate) || new Date(), effectiveDate: fromIso(ep.effectiveDate || p.inceptionDate), expiryDate: fromIso(ep.expiryDate || p.expiryDate),
    productionDate: fromIso(ep.productionDate), deductible: ep.deductible || doc.deductible || "", remarks: "",
    vehicle: Object.fromEntries(VEHICLE.map((k) => [k, carried(k)])),
    references: Object.fromEntries((p.participants || []).filter((x) => !x.isLead && x.status !== "declined").map((x) => [x.insuranceCompanyId, x.insurerReference || ""])),
  };
};

/**
 * e-Policy received (TIS-BRD-ISSUE-02): the issued policy the insurer returned is uploaded and its figures keyed - both
 * policy numbers, the participant name, sum insured, premium, commission, the issue / issuance / effective / production
 * dates and, for motor and CTPL only, the vehicle identifiers carried from the quotation (registration mandatory, TBA
 * not accepted) and an optional vehicle photo; Credit Life, Personal Accident, Travel, Parcel and the other lines have
 * neither. The server compares it with the slip at once.
 */
export const EpolicyDialog = ({ placement, visible, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const motor = placement?.lob === "MOTOR";

  useEffect(() => {
    if (visible && placement) {
      setForm(epolicyFormValues(placement));
      setFile(null);
      setPhoto(null);
      setError(null);
    }
  }, [visible, placement]);

  if (!form) return null;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setVehicle = (k) => (e) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, [k]: e.target.value } }));
  const problem = (!file && !placement.epolicy?.documentKey && t("placement.epolicy.errors.file"))
    || (!form.insurerPolicyNumber.trim() && t("placement.epolicy.errors.insurerPolicyNumber"))
    || (!form.participantName.trim() && t("placement.epolicy.errors.participantName"))
    || (!(form.netPremium > 0) && t("placement.epolicy.errors.netPremium"))
    || ((!form.issueDate || !form.effectiveDate) && t("placement.epolicy.errors.dates"))
    || (motor && blank(form.vehicle.plateNumber) && blank(form.vehicle.mvFileNumber) && t("placement.epolicy.errors.registration"))
    || null;

  const save = async () => {
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      let document = { documentKey: placement.epolicy?.documentKey, documentName: placement.epolicy?.documentName };
      if (file) {
        const up = await s3Service.uploadFile(file, "placement-epolicies");
        if (!up?.key) throw new Error(up?.error || t("placement.epolicy.errors.upload"));
        document = { documentKey: up.key, documentName: file.name };
      }
      let vehiclePhoto = {};
      if (motor && photo) {
        const up = await s3Service.uploadFile(photo, "vehicle-photos");
        if (!up?.key) throw new Error(up?.error || t("placement.epolicy.errors.upload"));
        vehiclePhoto = { vehiclePhotoKey: up.key, vehiclePhotoName: photo.name };
      }
      const saved = await placementService.recordEpolicy(placement.id, {
        ...document, ...vehiclePhoto, insurerPolicyNumber: form.insurerPolicyNumber.trim(), brokerPolicyNumber: form.brokerPolicyNumber.trim() || undefined,
        participantName: form.participantName.trim(), sumInsured: form.sumInsured || 0, netPremium: form.netPremium, grossPremium: form.grossPremium ?? undefined,
        commissionAmount: form.commissionAmount ?? undefined, issueDate: isoDate(form.issueDate), issuanceDate: isoDate(form.issuanceDate), effectiveDate: isoDate(form.effectiveDate),
        expiryDate: isoDate(form.expiryDate), productionDate: isoDate(form.productionDate), deductible: form.deductible || undefined, remarks: form.remarks || undefined,
        vehicle: motor ? Object.fromEntries(VEHICLE.map((k) => [k, form.vehicle[k] || undefined])) : undefined,
        participants: Object.entries(form.references).filter(([, ref]) => ref).map(([insuranceCompanyId, insurerReference]) => ({ insuranceCompanyId, insurerReference })),
      });
      onSaved?.(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const date = (k, required) => (
    <div className="col-12 md:col-4" key={k}>
      <label htmlFor={`ep-${k}`}>{t(`placement.epolicy.${k}`)}{required ? " *" : ""}</label>
      <Calendar inputId={`ep-${k}`} value={form[k]} onChange={(e) => set(k)(e.value)} dateFormat={calendarDateFormat()} showIcon className="w-full" />
    </div>
  );
  const coInsurers = (placement.participants || []).filter((x) => !x.isLead && x.status !== "declined");
  return (
    <Dialog className="placement-dialog" header={t("placement.epolicy.title", { number: placement.placementNumber })} visible={visible} onHide={onHide}
      style={{ width: "56rem" }} breakpoints={{ "960px": "96vw" }}
      footer={<><Button label={t("placement.actions.cancel")} text onClick={onHide} /><Button label={t("placement.epolicy.save")} icon="pi pi-upload" loading={busy} onClick={save} /></>}>
      {error && <Message severity="error" className="w-full mb-3" text={error} />}
      <div className="grid">
        <div className="col-12 md:col-6">
          <label htmlFor="ep-file">{t("placement.epolicy.file")} *</label>
          <FileField id="ep-file" accept=".pdf,.jpg,.jpeg,.png" value={file} onChange={setFile} />
          {!file && placement.epolicy?.documentName && <small className="hint">{t("placement.epolicy.keepFile", { name: placement.epolicy.documentName })}</small>}
        </div>
        {motor && (
          <div className="col-12 md:col-6">
            <label htmlFor="ep-photo">{t("placement.epolicy.vehiclePhoto")}</label>
            <FileField id="ep-photo" accept=".jpg,.jpeg,.png" value={photo} onChange={setPhoto} />
          </div>
        )}
        <div className="col-12 md:col-4">
          <label htmlFor="ep-ins">{t("placement.epolicy.insurerPolicyNumber")} *</label>
          <InputText id="ep-ins" value={form.insurerPolicyNumber} onChange={(e) => set("insurerPolicyNumber")(e.target.value)} className="w-full" />
        </div>
        <div className="col-12 md:col-4">
          <label htmlFor="ep-bv">{t("placement.epolicy.brokerPolicyNumber")}</label>
          <InputText id="ep-bv" value={form.brokerPolicyNumber} onChange={(e) => set("brokerPolicyNumber")(e.target.value)} className="w-full" placeholder={t("placement.epolicy.brokerPolicyNumberPlaceholder")} />
        </div>
        <div className="col-12 md:col-4">
          <label htmlFor="ep-name">{t("placement.epolicy.participantName")} *</label>
          <InputText id="ep-name" value={form.participantName} onChange={(e) => set("participantName")(e.target.value)} className="w-full" />
        </div>
        {AMOUNTS.map((k) => (
          <div className="col-12 md:col-3" key={k}>
            <label htmlFor={`ep-${k}`}>{t(`placement.epolicy.${k}`)}{["sumInsured", "netPremium"].includes(k) ? " *" : ""}</label>
            <InputNumber inputId={`ep-${k}`} value={form[k]} onValueChange={(e) => set(k)(e.value)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} className="w-full" inputClassName="w-full" />
          </div>
        ))}
        {date("issueDate", true)}
        {date("issuanceDate")}
        {date("productionDate")}
        {date("effectiveDate", true)}
        {date("expiryDate")}
        <div className="col-12 md:col-4">
          <label htmlFor="ep-ded">{t("placement.epolicy.deductible")}</label>
          <InputText id="ep-ded" value={form.deductible} onChange={(e) => set("deductible")(e.target.value)} className="w-full" />
        </div>
      </div>
      {motor && (
        <>
          <h4 className="mt-2 mb-1">{t("placement.epolicy.vehicle")}</h4>
          <div className="grid">
            {VEHICLE.map((k) => (
              <div className="col-12 md:col-3" key={k}>
                <label htmlFor={`ep-v-${k}`}>{t(`placement.epolicy.${k}`)}{["plateNumber", "mvFileNumber"].includes(k) ? " +" : ""}</label>
                <InputText id={`ep-v-${k}`} value={form.vehicle[k]} onChange={setVehicle(k)} className="w-full" />
              </div>
            ))}
          </div>
          <small className="hint">{t("placement.epolicy.registrationHint")}</small>
        </>
      )}
      {coInsurers.length > 0 && (
        <>
          <h4 className="mt-3 mb-1">{t("placement.epolicy.coInsurerReferences")}</h4>
          <div className="grid">
            {coInsurers.map((x) => (
              <div className="col-12 md:col-6" key={x.insuranceCompanyId}>
                <label htmlFor={`ep-ref-${x.insuranceCompanyId}`}>{`${x.insuranceCompanyName} (${x.sharePercent}%)`}</label>
                <InputText id={`ep-ref-${x.insuranceCompanyId}`} value={form.references[x.insuranceCompanyId] || ""} className="w-full"
                  onChange={(e) => setForm((f) => ({ ...f, references: { ...f.references, [x.insuranceCompanyId]: e.target.value } }))} />
              </div>
            ))}
          </div>
        </>
      )}
      <div className="grid">
        <div className="col-12">
          <label htmlFor="ep-rem">{t("placement.fields.remarks")}</label>
          <InputTextarea id="ep-rem" value={form.remarks} onChange={(e) => set("remarks")(e.target.value)} rows={2} className="w-full" />
        </div>
      </div>
    </Dialog>
  );
};

/** Check against slip: the slip and the e-policy side by side, the differences highlighted. */
export const SlipComparison = ({ check }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  if (!check?.items) return null;
  const show = (item, v) => {
    if (v === null || v === undefined || v === "") return "-";
    if (AMOUNTS.includes(item.key)) return formatCurrency(v);
    if (["effectiveDate", "expiryDate"].includes(item.key)) return formatDate(v);
    return String(v);
  };
  return (
    <div className="table-scroll">
      <table className="participant-table readonly slip-comparison">
        <thead>
          <tr>
            <th>{t("placement.check.item")}</th><th className="num">{t("placement.check.slip")}</th><th className="num">{t("placement.check.epolicy")}</th>
            <th className="num">{t("placement.check.difference")}</th><th>{t("placement.check.result")}</th>
          </tr>
        </thead>
        <tbody>
          {check.items.map((i) => (
            <tr key={i.key} className={`check-${i.status}`}>
              <td>{t(`placement.check.items.${i.key}`, { defaultValue: i.label })}</td>
              <td className="num">{show(i, i.slip)}</td>
              <td className="num">{show(i, i.epolicy)}</td>
              <td className="num">{i.difference === null || i.difference === undefined ? "" : formatCurrency(i.difference)}</td>
              <td><span className={`check-status ${i.status}`}>{t(`placement.check.status.${i.status}`)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <small className="hint">{t("placement.check.tolerance", { amount: formatCurrency(check.tolerance?.amount || 0), percent: check.tolerance?.percent || 0 })}</small>
    </div>
  );
};
