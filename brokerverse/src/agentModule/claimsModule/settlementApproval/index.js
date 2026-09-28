import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "primereact/button";
import { useSelector } from "react-redux";
import "./index.scss";
import CustomToast from "../../../components/Toast";
import claimsService from "../../../services/claimsService";
import customHistory from "../../../routes/customHistory";
import StatusIllustration from "../../component/StatusIllustration";

const SettlementApproval = () => {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const { id } = params;
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Get claim ID from URL params or navigation state
  const claimId = id || location.state?.claimId || location.state?.id;
  const [claim, setClaim] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const isPendingApproval = claim?.lifecycleStatus === "pending-approval";

  useEffect(() => {
    if (!claimId) return;
    claimsService.getClaimDetails(claimId).then((result) => {
      if (result.success) setClaim(result.data?.data || result.data);
    });
  }, [claimId]);

  const showError = (detail) =>
    toastRef.current.showToast({ severity: "error", summary: t("common.error", "Error"), detail });

  /** Checker decision (approve | return) on a settlement waiting in "Pending Approval". */
  const handleSettlementDecision = async (decision) => {
    setDeciding(true);
    const result = await claimsService.approveSettlement(claimId, {
      decision,
      ...(decision === "approve" && claim?.settlementAmount ? { approvedAmount: claim.settlementAmount } : {}),
    });
    setDeciding(false);
    if (!result.success) {
      showError(result.error);
      return;
    }
    toastRef.current.showToast({ severity: "success", detail: result.data?.message });
    navigate(`/agent/claimdetailedview/${claimId}`, { replace: true });
  };

  // Get policy holder data from Redux
  const {
    policyHolderName: reduxPolicyHolderName,
    claimNumber: reduxClaimNumber,
  } = useSelector(({ claimDetailsMainReducers }) => ({
    policyHolderName: claimDetailsMainReducers?.policyHolderName || "",
    policyNumber: claimDetailsMainReducers?.policyNumber || "",
    claimNumber: claimDetailsMainReducers?.claimNumber || "",
  }));

  // Try to get policy holder name from Redux first, then fallback
  const policyHolderName = reduxPolicyHolderName || t("agent.loading");

  const claimNumber = reduxClaimNumber || t("agent.loading");

  const handleReject = async () => {
    if (!claimId) {
      console.error("No claim ID available for rejection");
      return;
    }

    setLoading(true);
    console.log("=== REJECTING CLAIM ===");
    console.log("Claim ID:", claimId);
    console.log("=== END REJECTING CLAIM ===");

    try {
      const result = await claimsService.rejectClaim(claimId);

      if (result.success) {
        console.log("Claim rejected successfully:", result.data);
        toastRef.current.showToast();
        setTimeout(async () => {
          let resolvedClientId = location.state?.clientId;
          if (!resolvedClientId && claimId) {
            try {
              const claimResult = await claimsService.getClaimDetails(claimId);
              const claimPayload = claimResult?.data;
              resolvedClientId =
                claimPayload?.data?.policy?.clientId ||
                claimPayload?.policy?.clientId ||
                claimPayload?.data?.clientId ||
                claimPayload?.clientId;
            } catch (fetchError) {
              console.error("Failed to resolve clientId after reject:", fetchError);
            }
          }
          if (resolvedClientId) {
            navigate(`/agent/clientview/${resolvedClientId}`, { replace: true });
          } else {
            navigate("/agent/clientlisting", { replace: true });
          }
        }, 2000);
      } else {
        console.error("Failed to reject claim:", result.error);
        // You can add error handling here, like showing an error toast
      }
    } catch (error) {
      console.error("Error rejecting claim:", error);
      // You can add error handling here
    } finally {
      setLoading(false);
    }
  };

  const handleBackNavigation = () => {
    customHistory.back();
  };

  const handleSubmit = () => {
    if (!claimId) {
      console.error("No claim ID available for navigation");
      return;
    }

    navigate(`/agent/claimrequest/settlementdetails/${claimId}`);
  };
  return (
    <div className="claimsettlement__approval__overall">
      <div className="claim__requestapproval__upload__main__title">{t("settlementApproval.clients")}</div>
      <div 
        className="claim__request__uploadarrow__back__btn mt-3 cursor-pointer"
        onClick={handleBackNavigation}
      >
        <SvgLeftArrow />
        <div className="claim__request__upload__back__btn__title">
          {policyHolderName} / {claimNumber ? t("settlementApproval.claimLabel", { claimNumber }) : t("settlementApproval.loading")}
        </div>
      </div>
      <CustomToast ref={toastRef} message={t("settlementApproval.claimRejectedToast")} />
      <Card className="mt-4 claimrequest__overall__card">
        <div>
          <div className="claim__title_txt mt-6">{t("settlementApproval.waitingForSettlement")}</div>
          <div className="claimtitle__img__overallcontainer mt-4">
            <StatusIllustration variant="waiting" className="claimtitle__img__container" />
          </div>
          <div className="claimtitle__txt_container mt-6">
            <div>{t("settlementApproval.claimBeingProcessed")}</div>
            <div>{t("settlementApproval.kindlyBePatientSettlement")}</div>
          </div>
        </div>
        {isPendingApproval ? (
          <div className="claimtitle__butt_container mt-6">
            <Button
              link
              onClick={() => handleSettlementDecision("return")}
              className="claim__back__but"
              disabled={deciding}
            >
              {t("settlementApproval.returnSettlement", "Return")}
            </Button>
            <Button
              onClick={() => handleSettlementDecision("approve")}
              className="claim__snd__but"
              disabled={deciding}
              loading={deciding}
            >
              {t("settlementApproval.approveSettlement", "Approve Settlement")}
            </Button>
          </div>
        ) : (
          <div className="claimtitle__butt_container mt-6">
            <Button
              link
              onClick={handleReject}
              className="claim__back__but"
              disabled={loading}
              loading={loading}
            >
              {loading ? t("settlementApproval.rejecting") : t("settlementApproval.reject")}
            </Button>
            <Button
              onClick={handleSubmit}
              className="claim__snd__but"
            >
              {t("settlementApproval.proceed")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SettlementApproval;
