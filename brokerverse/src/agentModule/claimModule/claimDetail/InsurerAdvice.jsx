import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { StatusChip } from "../../../components/RecordPage";
import FieldError from "../../../components/FieldError";
import claimHandlingService from "../../../services/claimHandlingService";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { formatDate } from "../../../utility/dateFormat";
import { numberLocale } from "../../../utility/currencyConverter";

const ADVICE_SEVERITY = { approved: "success", "cheque-available": "success", "loa-issued": "info", "under-evaluation": "info", "incomplete-requirements": "warning", denied: "danger" };

/**
 * The insurer's side of a claim (TIS-BRD-CLAIM-04, FGA CM-06): insurer claim number, the insurer's claims handler, the
 * advice status, the authorisation code and the amount offered; recorded with Record insurer advice (write:claims).
 */
const InsurerAdvice = ({ claim, statuses, canEdit, onSaved, notify }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const open = () => {
    setErrors({});
    setForm({
      insurerClaimNumber: claim.insuranceCompanyClaimNumber || "", insurerHandler: claim.insurerHandler || "", insurerHandlerContact: claim.insurerHandlerContact || "",
      adviceStatus: claim.insurerAdvice || null, authorisationCode: claim.authorisationCode || "", offerAmount: claim.insurerOfferAmount ?? null, note: "",
    });
  };
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== null && v !== ""));
      await claimHandlingService.recordAdvice(claim.id, payload);
      notify("success", t("claimInsurer.saved"));
      setForm(null);
      onSaved();
    } catch (e) {
      setErrors(Object.fromEntries((e.errors || []).map((x) => [x.path, x.message])));
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  };
  const rows = [
    [t("claimJourney.insurerClaimNumber"), claim.insuranceCompanyClaimNumber],
    [t("claimInsurer.handler"), [claim.insurerHandler, claim.insurerHandlerContact].filter(Boolean).join(" · ")],
    [t("claimInsurer.advice"), claim.insurerAdvice ? <StatusChip label={claim.insurerAdviceLabel} severity={ADVICE_SEVERITY[claim.insurerAdvice] || "info"} /> : null],
    [t("claimInsurer.adviceDate"), claim.insurerAdviceAt ? formatDate(claim.insurerAdviceAt) : null],
    [t("claimInsurer.authorisationCode"), claim.authorisationCode],
    [t("claimInsurer.offer"), claim.insurerOfferAmount !== null && claim.insurerOfferAmount !== undefined ? formatCurrency(claim.insurerOfferAmount) : null],
    [t("claimInsurer.submitted"), claim.submittedToInsurerAt ? formatDate(claim.submittedToInsurerAt) : t("claimInsurer.notSubmitted")],
  ];
  return (
    <>
      <dl className="claim-journey__facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
          </div>
        ))}
      </dl>
      {canEdit ? <Button type="button" icon="pi pi-pencil" outlined size="small" label={t("claimInsurer.record")} onClick={open} className="mt-2" /> : null}
      <Dialog header={t("claimInsurer.record")} visible={!!form} onHide={() => setForm(null)} style={{ width: "40rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <>
            <Button type="button" label={t("claimJourney.cancel")} text onClick={() => setForm(null)} disabled={busy} />
            <Button type="button" label={t("claimInsurer.save")} icon="pi pi-check" onClick={save} loading={busy} />
          </>
        )}>
        {form ? (
          <div className="grid">
            <div className="col-12 md:col-6">
              <label htmlFor="ia-number">{t("claimJourney.insurerClaimNumber")}</label>
              <InputText id="ia-number" value={form.insurerClaimNumber} onChange={(e) => set("insurerClaimNumber")(e.target.value)} maxLength={60} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ia-status">{t("claimInsurer.advice")}</label>
              <Dropdown inputId="ia-status" value={form.adviceStatus} onChange={(e) => set("adviceStatus")(e.value)} options={statuses} showClear className={errors.adviceStatus ? "w-full p-invalid" : "w-full"}
                placeholder={t("claimInsurer.chooseAdvice")} />
              <FieldError error={errors.adviceStatus} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ia-handler">{t("claimInsurer.handler")}</label>
              <InputText id="ia-handler" value={form.insurerHandler} onChange={(e) => set("insurerHandler")(e.target.value)} maxLength={120} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ia-contact">{t("claimInsurer.handlerContact")}</label>
              <InputText id="ia-contact" value={form.insurerHandlerContact} onChange={(e) => set("insurerHandlerContact")(e.target.value)} maxLength={120} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ia-auth">{t("claimInsurer.authorisationCode")}</label>
              <InputText id="ia-auth" value={form.authorisationCode} onChange={(e) => set("authorisationCode")(e.target.value)} maxLength={60} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ia-offer">{t("claimInsurer.offer")}</label>
              <InputNumber inputId="ia-offer" value={form.offerAmount} onValueChange={(e) => set("offerAmount")(e.value)} mode="decimal" locale={numberLocale()}
                minFractionDigits={2} maxFractionDigits={2} min={0} className={errors.offerAmount ? "w-full p-invalid" : "w-full"} inputClassName="text-right" />
              <FieldError error={errors.offerAmount} />
            </div>
            <div className="col-12">
              <label htmlFor="ia-note">{t("claimInsurer.note")}</label>
              <InputTextarea id="ia-note" value={form.note} onChange={(e) => set("note")(e.target.value)} rows={2} autoResize maxLength={2000} className="w-full" />
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};

InsurerAdvice.propTypes = {
  claim: PropTypes.object.isRequired,
  statuses: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })),
  canEdit: PropTypes.bool,
  onSaved: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};
InsurerAdvice.defaultProps = { statuses: [], canEdit: false };

export default InsurerAdvice;
