import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import CustomToast from "../../../components/Toast";
import claimsService from "../../../services/claimsService";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import ClaimJourneyLayout, { ClaimActions, ClaimSection } from "../shared/ClaimJourneyLayout";
import FormErrorSummary from "../shared/FormErrorSummary";

/**
 * Assessment: the claim as reported and adjusted, then the decision to go on to the settlement or to reject the claim.
 * A settlement waiting for the checker (maker-checker) is approved or returned here.
 */
const SettlementApproval = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const claimId = id || location.state?.claimId || location.state?.id;
  const [claim, setClaim] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!claimId) return;
    claimsService.getClaimDetails(claimId).then((result) => {
      if (result.success) setClaim(result.data?.data || result.data);
      else setLoadError(result.error);
    });
  }, [claimId]);

  const status = claim?.lifecycleStatus;
  const isPendingApproval = status === "pending-approval";
  const canDecide = ["registered", "in-review"].includes(status);
  const detailView = () => navigate(`/agent/claimdetailedview/${claimId}`, { replace: true });

  const decideSettlement = async (decision) => {
    setBusy(true);
    setActionError("");
    const result = await claimsService.approveSettlement(claimId, {
      decision,
      ...(decision === "approve" && claim?.settlementAmount ? { approvedAmount: claim.settlementAmount } : {}),
    });
    setBusy(false);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    toastRef.current?.showToast({ severity: "success", detail: result.data?.message });
    detailView();
  };

  const rejectClaim = async () => {
    if (reason.trim().length < 3) {
      setActionError(t("claimJourney.rejectReasonRequired"));
      return;
    }
    setBusy(true);
    setActionError("");
    const result = await claimsService.rejectClaim(claimId, reason.trim());
    setBusy(false);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    setRejecting(false);
    detailView();
  };

  const rows = claim
    ? [
        [t("claimJourney.claimNumber"), claim.claimNumber],
        [t("claimJourney.policyNumber"), claim.policyNumber || claim.policy?.policyNumber],
        [t("claimJourney.insurer"), claim.insuranceCompanyName || claim.policy?.insuranceCompanyName],
        [t("claimJourney.insurerClaimNumber"), claim.insuranceCompanyClaimNumber],
        [t("claimJourney.dateOfLoss"), formatDate(claim.dateOfIncident)],
        [t("claimJourney.dateReported"), formatDate(claim.reportedDate)],
        [t("claimJourney.causeOfLoss"), claim.typeOfIncident],
        [t("claimJourney.adjusterName"), claim.adjusterName],
        [t("claimJourney.estimatedAmount"), formatCurrency(claim.estimatedClaimAmount)],
        ...(isPendingApproval ? [[t("claimJourney.settlementAmount"), formatCurrency(claim.settlementAmount)]] : []),
      ]
    : [];

  return (
    <ClaimJourneyLayout
      step={isPendingApproval ? "approval" : "assessment"}
      holderName={claim?.policyHolderName}
      reference={claim?.claimNumber ? t("claimJourney.claimRef", { number: claim.claimNumber }) : ""}
      status={claim?.claimStatus}
      onBack={() => navigate(claim?.clientId ? `/agent/clientview/${claim.clientId}` : "/agent/claim")}
      title={isPendingApproval ? t("claimJourney.approvalTitle") : t("claimJourney.assessmentTitle")}
    >
      <CustomToast ref={toastRef} />
      {!claim && !loadError && <p className="claim-journey__hint">{t("claimJourney.loadingClaim")}</p>}
      {loadError && <FormErrorSummary serverError={loadError} />}
      {claim && (
        <ClaimSection title={t("claimJourney.claimSummary")}>
          <dl className="claim-journey__facts">
            {rows.map(([label, value]) => (
              <div key={label} className="claim-journey__fact">
                <dt>{label}</dt>
                <dd>{value || "-"}</dd>
              </div>
            ))}
          </dl>
          {isPendingApproval && <p className="claim-journey__hint">{t("claimJourney.checkerHint")}</p>}
          {!isPendingApproval && !canDecide && (
            <div className="claim-journey__notice">{t("claimJourney.decisionTaken", { status: claim.claimStatus })}</div>
          )}
        </ClaimSection>
      )}
      <FormErrorSummary serverError={actionError} />
      <ClaimActions>
        <Button
          type="button"
          label={t("claimJourney.back")}
          outlined
          onClick={() => navigate(`/agent/claimrequest/adjustersubmission/${claimId}`, { state: { claimId } })}
          disabled={busy}
        />
        {isPendingApproval && (
          <>
            <Button type="button" label={t("claimJourney.returnSettlement")} severity="secondary" outlined onClick={() => decideSettlement("return")} disabled={busy} />
            <Button type="button" label={t("claimJourney.approveSettlement")} onClick={() => decideSettlement("approve")} loading={busy} disabled={busy} />
          </>
        )}
        {canDecide && (
          <>
            <Button type="button" label={t("claimJourney.rejectClaim")} severity="danger" outlined onClick={() => setRejecting(true)} disabled={busy} />
            <Button
              type="button"
              label={t("claimJourney.proceedToSettlement")}
              onClick={() => navigate(`/agent/claimrequest/settlementdetails/${claimId}`, { state: { claimId } })}
              disabled={busy}
            />
          </>
        )}
        {claim && !isPendingApproval && !canDecide && <Button type="button" label={t("claimJourney.openClaim")} onClick={detailView} />}
      </ClaimActions>
      <Dialog
        header={t("claimJourney.rejectClaim")}
        visible={rejecting}
        style={{ width: "32rem" }}
        onHide={() => setRejecting(false)}
        footer={
          <>
            <Button type="button" label={t("claimJourney.cancel")} text onClick={() => setRejecting(false)} disabled={busy} />
            <Button type="button" label={t("claimJourney.rejectClaim")} severity="danger" onClick={rejectClaim} loading={busy} />
          </>
        }
      >
        <label htmlFor="reject-reason" className="block mb-2">{t("claimJourney.rejectReason")}</label>
        <InputTextarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoResize className="w-full" />
      </Dialog>
    </ClaimJourneyLayout>
  );
};

export default SettlementApproval;
