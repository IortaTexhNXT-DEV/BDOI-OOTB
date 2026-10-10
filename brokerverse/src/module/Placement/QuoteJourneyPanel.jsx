import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import placementService from "../../services/placementService";
import { notifyError } from "../../utility/dialogs";
import { JourneyTimeline } from "./shared";
import "./index.scss";

const PLACEABLE = ["CustomerAccepted", "SubmittedToInsurer", "Approved"];
const STOPPED = ["Rejected", "Expired", "Cancelled", "Lapsed"];

/**
 * Placement journey of a quotation (Quotation Slip): Broker Slip -> Quotation Slip -> Placement Slip -> Policy with links,
 * and the next step allowed by placement.journey (create / open the placement slip).
 */
const QuoteJourneyPanel = ({ quotation, relatedPolicy, onChanged }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!quotation?.quotationId) return null;
  const journey = quotation.journey || {};
  const policyId = quotation.policyId || relatedPolicy?.policyId || null;
  // a rejected quotation stops the journey at the quotation slip; once the policy is issued, a step that was never
  // taken is shown as not used rather than still to do
  const stopped = STOPPED.includes(quotation.quotationStatus);
  const placementMode = policyId && !quotation.placementId ? "skip" : journey.placementSlip;
  const steps = [
    { key: "brokerSlip", done: Boolean(quotation.brokerSlipId), reference: quotation.brokerSlipNumber, id: quotation.brokerSlipId, mode: policyId && !quotation.brokerSlipId ? "skip" : journey.brokerSlip },
    { key: "quotationSlip", done: !stopped, stopped, reference: quotation.quotationNumber, mode: journey.quotationSlip },
    { key: "placementSlip", done: Boolean(quotation.placementId), reference: quotation.placementNumber, id: quotation.placementId, mode: placementMode },
    { key: "policy", done: Boolean(policyId), reference: relatedPolicy?.policyNumber || relatedPolicy?.policyData?.policyNumber || (policyId ? t("placement.journey.issued") : null), id: policyId, mode: "required" },
  ];
  const canPlace = !quotation.placementId && !policyId && journey.placementSlip && journey.placementSlip !== "skip" && PLACEABLE.includes(quotation.quotationStatus);
  const place = async () => {
    setBusy(true);
    try {
      const p = await placementService.placeQuotation(quotation.quotationId);
      onChanged?.();
      navigate(`/placement/placement-slips/${p.id}`);
    } catch (e) {
      notifyError?.(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="quote-journey-panel">
      <div className="quote-journey-head">
        <span className="journey-title">{t("placement.journey.title")}</span>
        {journey.placementSlip === "required" && !quotation.placementId && !policyId && <span className="journey-note">{t("placement.journey.placementRequired")}</span>}
        {quotation.placementId && <Button label={t("placement.actions.openPlacement")} icon="pi pi-external-link" text size="small" onClick={() => navigate(`/placement/placement-slips/${quotation.placementId}`)} />}
        {canPlace && <Button label={t("placement.actions.createPlacement")} icon="pi pi-briefcase" size="small" onClick={place} loading={busy} />}
      </div>
      <JourneyTimeline steps={steps} />
    </div>
  );
};

export default QuoteJourneyPanel;
