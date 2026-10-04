import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { InputNumber } from "primereact/inputnumber";
import { ProgressSpinner } from "primereact/progressspinner";
import CoverageDeatails from "../coverageDetails";
import StepErrors from "../../../components/StepErrors";
import policyRenewalService from "../../../services/policyRenewalService";
import { formatDate } from "../../../utility/dateFormat";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import "./index.scss";

/**
 * Renewal terms of a non-motor policy (travel, fire, personal accident, liability ...): the expiring term for
 * reference and the sum insured and net premium of the renewal term. Taxes are applied when the renewal quotation
 * is created (the line's rates); the next step is the order summary. Motor policies keep the motor coverage screen.
 */
const RenewalTermDetails = ({ prefill }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const cov = prefill.coverageDetails || {};
  const [sumInsured, setSumInsured] = useState(Number(cov.totalSumInsured) || null);
  const [netPremium, setNetPremium] = useState(Number(cov.netPremium) || null);
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState(null);
  const [touched, setTouched] = useState(false);

  const fieldErrors = {
    sumInsured: !(sumInsured > 0) ? t("renewalTerm.sumInsuredRequired") : "",
    netPremium: !(netPremium > 0) ? t("renewalTerm.netPremiumRequired") : "",
  };

  const next = async () => {
    setTouched(true);
    if (fieldErrors.sumInsured || fieldErrors.netPremium) return;
    setSaving(true);
    setStepError(null);
    const r = await policyRenewalService.saveRenewalWizard(prefill.policyId, { coverageDetails: { totalSumInsured: sumInsured, netPremium } });
    setSaving(false);
    if (!r.success) {
      setStepError({ message: r.error, errors: r.errors });
      return;
    }
    navigate(`/agent/renewalquote/ordersummary/${prefill.policyId}`, { state: { policyId: prefill.policyId } });
  };

  const facts = [
    [t("renewalTerm.policyNumber"), prefill.policyNumber],
    [t("renewalTerm.client"), prefill.clientName],
    [t("renewalTerm.product"), prefill.productName || prefill.productType],
    [t("renewalTerm.insurer"), prefill.insuranceCompanyName],
    [t("renewalTerm.currentTerm"), `${formatDate(prefill.inceptionDate)} - ${formatDate(prefill.expiryDate)}`],
    [t("renewalTerm.currentSumInsured"), formatCurrency(prefill.sumInsured)],
    [t("renewalTerm.currentNetPremium"), formatCurrency(prefill.netPremium)],
    [t("renewalTerm.currentGrossPremium"), formatCurrency(prefill.grossPremium)],
  ];

  return (
    <div className="renewal-term">
      <h1 className="renewal-term__title">{t("renewalTerm.title")}</h1>
      <p className="renewal-term__sub">
        {prefill.clientName} / {prefill.policyNumber}
        {prefill.eligibility?.label ? ` / ${prefill.eligibility.label}` : ""}
      </p>
      <Card>
        <h2 className="renewal-term__section">{t("renewalTerm.expiringTerm")}</h2>
        <dl className="renewal-term__facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || "-"}</dd>
            </div>
          ))}
        </dl>
        {prefill.eligibility?.message && <p className="renewal-term__note">{prefill.eligibility.message}</p>}

        <h2 className="renewal-term__section">{t("renewalTerm.renewalTerm")}</h2>
        <div className="grid">
          <div className="col-12 md:col-6">
            <label htmlFor="rt-si" className="block mb-2">
              {t("renewalTerm.sumInsured")} <span className="required-mark">*</span>
            </label>
            <InputNumber inputId="rt-si" value={sumInsured} onValueChange={(e) => setSumInsured(e.value)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} className="w-full" inputClassName="text-right" />
            {touched && fieldErrors.sumInsured && <small className="p-error block mt-1">{fieldErrors.sumInsured}</small>}
          </div>
          <div className="col-12 md:col-6">
            <label htmlFor="rt-np" className="block mb-2">
              {t("renewalTerm.netPremium")} <span className="required-mark">*</span>
            </label>
            <InputNumber inputId="rt-np" value={netPremium} onValueChange={(e) => setNetPremium(e.value)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} className="w-full" inputClassName="text-right" />
            {touched && fieldErrors.netPremium && <small className="p-error block mt-1">{fieldErrors.netPremium}</small>}
            <small className="block mt-1 text-color-secondary">{t("renewalTerm.taxesNote")}</small>
          </div>
        </div>

        <StepErrors error={stepError} />
        <div className="renewal-term__actions">
          <Button type="button" label={t("renewalTerm.back")} outlined onClick={() => navigate("/agent/expired-policies")} disabled={saving} />
          <Button type="button" label={t("renewalTerm.next")} onClick={next} loading={saving} />
        </div>
      </Card>
    </div>
  );
};

RenewalTermDetails.propTypes = { prefill: PropTypes.object.isRequired };

/**
 * First step of a renewal: the motor coverage screen for motor policies, the renewal terms for every other line.
 */
const RenewalCoverageStep = () => {
  const { t } = useTranslation();
  const { id: policyId } = useParams();
  const [prefill, setPrefill] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    policyRenewalService.getRenewalPrefill(policyId).then((r) => {
      if (!active) return;
      if (r.success) setPrefill(r.data);
      else setError(r.error);
    });
    return () => {
      active = false;
    };
  }, [policyId]);

  if (error) return <StepErrors error={{ message: error }} />;
  if (!prefill) {
    return (
      <div className="renewal-term__loading">
        <ProgressSpinner style={{ width: "2rem", height: "2rem" }} />
        <span>{t("renewalTerm.loading")}</span>
      </div>
    );
  }
  if (prefill.isMotor) return <CoverageDeatails action="coveragedetail" flow="renewal" />;
  return <RenewalTermDetails prefill={prefill} />;
};

export default RenewalCoverageStep;
