import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import claimsService from "../../../services/claimsService";
import { formatDate } from "../../../utility/dateFormat";
import ClaimJourneyLayout, { ClaimActions, ClaimSection } from "../shared/ClaimJourneyLayout";
import FormErrorSummary from "../shared/FormErrorSummary";
import { EDITABLE_STATUSES } from "../shared/claimJourney";

/**
 * Review: the claim is registered and the insurer has been advised. The claims officer checks what was reported, can go
 * back and correct it, and moves the claim to processing (adjuster report) once the insurer has acknowledged it.
 */
const RequestApproval = ({ flow }) => {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const claimId = location.state?.claimId || id;
  const [claim, setClaim] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!claimId) return;
    claimsService.getClaimDetails(claimId).then((result) => {
      if (result.success) setClaim(result.data?.data || result.data);
      else setLoadError(result.error || t("claimRequestApproval.failedToLoadClaimDetails"));
    });
  }, [claimId, t]);

  const proceed = async () => {
    const next = () => navigate(flow === "quotation" ? "/agent/quotedetailedit" : `/agent/claimrequest/adjustersubmission/${claimId}`, { state: { claimId, clientId: claim?.clientId } });
    // a claim already in processing goes straight on to the adjuster report
    if (claim?.lifecycleStatus !== "registered") {
      next();
      return;
    }
    setBusy(true);
    const result = await claimsService.updateClaimStatus(claimId, "Processing");
    setBusy(false);
    if (!result.success) {
      toast.current?.show({ severity: "error", summary: t("claimRequestApproval.error"), detail: result.error || t("claimRequestApproval.failedToUpdateStatus"), life: 5000 });
      return;
    }
    toast.current?.show({ severity: "success", summary: t("claimRequestApproval.success"), detail: t("claimRequestApproval.claimStatusUpdated"), life: 3000 });
    next();
  };

  const editable = !claim || EDITABLE_STATUSES.includes(claim.lifecycleStatus);
  const reported = claim ? [
    [t("claimJourney.dateReported"), formatDate(claim.reportedDate)],
    [t("claimFlow.timeOfLoss"), claim.timeOfIncident],
    [t("claimFlow.placeOfLoss"), [claim.addressOfIncident, claim.cityOfIncident, claim.provinceOfIncident].filter(Boolean).join(", ")],
    [t("claimFlow.driver"), claim.driverName],
    [t("claimFlow.thirdParty"), claim.thirdPartyDetails?.thirdPartyName],
    [t("claimFlow.reportedBy"), claim.reportedByName || claim.createdBy],
  ].filter(([, v]) => v) : [];

  return (
    <ClaimJourneyLayout
      claim={claim}
      step="review"
      onBack={() => navigate(claim?.clientId ? `/agent/clientview/${claim.clientId}` : "/agent/claim")}
      title={t("claimFlow.reviewTitle")}
    >
      <Toast ref={toast} />
      {!claim && !loadError && <p className="claim-journey__hint">{t("claimJourney.loadingClaim")}</p>}
      {loadError && <FormErrorSummary serverError={loadError} />}
      {claim && (
        <>
          <ClaimSection title={t("claimFlow.asReported")}>
            <dl className="claim-journey__facts">
              {reported.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {claim.description ? <p className="claim-journey__hint mt-3">{claim.description}</p> : null}
          </ClaimSection>
        </>
      )}
      <ClaimActions next={claim ? (editable ? t("claimFlow.next.review") : t("claimFlow.next.reviewDone", { status: claim.claimStatus })) : null}>
        <Button type="button" label={t("claimJourney.back")} outlined onClick={() => navigate(`/agent/claimrequest/documents/${claimId}`, { state: { claimId } })} disabled={busy || !claim} />
        <Button type="button" label={t("claimFlow.editNotification")} icon="pi pi-pencil" outlined disabled={busy || !claim || !editable}
          onClick={() => navigate(`/agent/claimrequest/claimdetails/${claimId}`)} />
        <Button type="button" label={t("claimFlow.proceedToAdjuster")} icon="pi pi-arrow-right" iconPos="right" onClick={proceed} loading={busy}
          disabled={busy || !claim || !editable} />
      </ClaimActions>
    </ClaimJourneyLayout>
  );
};

RequestApproval.propTypes = { flow: PropTypes.string };
RequestApproval.defaultProps = { flow: "normal" };

export default RequestApproval;
