import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import CustomToast from "../../../components/Toast";
import claimsService from "../../../services/claimsService";
import { formatCurrency } from "../../../utility/currencyConverter";
import { formatDate } from "../../../utility/dateFormat";
import ClaimJourneyLayout, { ClaimActions, ClaimSection } from "../shared/ClaimJourneyLayout";
import FormErrorSummary from "../shared/FormErrorSummary";
import useMasterOptions from "../../component/useMasterOptions";
import { hasPermission } from "../../../utils/canOpen";

/**
 * Assessment: the claim as reported and adjusted, then the decision to go on to the settlement or to reject the claim
 * (repudiation: a reason code of Master > Insurance Management > Reason Codes and its note, or the reason as text).
 * A settlement waiting for the checker (maker-checker) is approved or returned here. Decisions need approve:claims.
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
  const [reasonCode, setReasonCode] = useState(null);
  const repudiationReasons = useMasterOptions("reason-code", { filter: (r) => r.context === "repudiation" });
  const mayDecide = hasPermission("approve:claims");

  useEffect(() => {
    if (!claimId) return;
    claimsService.getClaimDetails(claimId).then((result) => {
      if (result.success) setClaim(result.data?.data || result.data);
      else setLoadError(result.error);
    });
  }, [claimId]);

  const status = claim?.lifecycleStatus;
  const isPendingApproval = status === "pending-approval";
  const canDecide = mayDecide && ["registered", "in-review"].includes(status);
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
    const coded = repudiationReasons.find((o) => o.value === reasonCode);
    const noteNeeded = coded ? coded.record.requiresNote === true || String(coded.record.requiresNote).toLowerCase() === "true" : true;
    if (noteNeeded && reason.trim().length < 3) {
      setActionError(t(coded ? "claimJourney.rejectNoteRequired" : "claimJourney.rejectReasonRequired"));
      return;
    }
    setBusy(true);
    setActionError("");
    const result = await claimsService.rejectClaim(claimId, reason.trim(), reasonCode);
    setBusy(false);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    setRejecting(false);
    detailView();
  };

  let nextText = null;
  if (claim && isPendingApproval) nextText = mayDecide ? t("claimFlow.next.approve") : t("claimFlow.next.awaitingApproval");
  else if (claim && canDecide) nextText = t("claimFlow.next.assessment");
  else if (claim && ["registered", "in-review"].includes(status)) nextText = t("claimFlow.next.awaitingDecision");
  else if (claim) nextText = t("claimJourney.decisionTaken", { status: claim.claimStatus });

  // the claim's key facts are in the strip above; the assessment adds what the adjuster and the settlement recorded
  const rows = claim
    ? [
        [t("claimJourney.dateReported"), formatDate(claim.reportedDate)],
        [t("claimJourney.adjusterName"), claim.adjusterName],
        [t("claimFlow.adjusterStatus"), claim.adjusterStatus],
        ...(isPendingApproval
          ? [[t("claimJourney.settlementType"), claim.settlementType], [t("claimJourney.settlementAmount"), formatCurrency(claim.settlementAmount)]]
          : []),
      ]
    : [];

  return (
    <ClaimJourneyLayout
      claim={claim}
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
        <ClaimSection title={isPendingApproval ? t("claimFlow.settlementToApprove") : t("claimFlow.assessmentBasis")}>
          <dl className="claim-journey__facts">
            {rows.map(([label, value]) => (
              <div key={label} className="claim-journey__fact">
                <dt>{label}</dt>
                <dd>{value || "-"}</dd>
              </div>
            ))}
          </dl>
        </ClaimSection>
      )}
      <FormErrorSummary serverError={actionError} />
      <ClaimActions next={nextText}>
        <Button
          type="button"
          label={t("claimJourney.back")}
          outlined
          onClick={() => navigate(`/agent/claimrequest/adjustersubmission/${claimId}`, { state: { claimId } })}
          disabled={busy}
        />
        {isPendingApproval && mayDecide && (
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
        <label htmlFor="reject-reason-code" className="block mb-2">{t("claimJourney.rejectReasonCode")}</label>
        <Dropdown inputId="reject-reason-code" value={reasonCode} options={repudiationReasons} onChange={(e) => setReasonCode(e.value)}
          placeholder={t("claimJourney.rejectReasonCodeNone")} showClear filter className="w-full mb-3" />
        <label htmlFor="reject-reason" className="block mb-2">{t(reasonCode ? "claimJourney.rejectNote" : "claimJourney.rejectReason")}</label>
        <InputTextarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoResize className="w-full" />
      </Dialog>
    </ClaimJourneyLayout>
  );
};

export default SettlementApproval;
