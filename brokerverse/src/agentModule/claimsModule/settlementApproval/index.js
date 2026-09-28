import React, { useRef, useState } from "react";
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

  // Get policy holder data from Redux
  const {
    policyHolderName: reduxPolicyHolderName,
    policyNumber: reduxPolicyNumber,
    claimNumber: reduxClaimNumber,
  } = useSelector(({ claimDetailsMainReducers }) => ({
    policyHolderName: claimDetailsMainReducers?.policyHolderName || "",
    policyNumber: claimDetailsMainReducers?.policyNumber || "",
    claimNumber: claimDetailsMainReducers?.claimNumber || "",
  }));

  // Try to get policy holder name from Redux first, then fallback
  const policyHolderName = reduxPolicyHolderName || t("agent.loading");

  const claimNumber = reduxClaimNumber || t("agent.loading");

  console.log("=== SETTLEMENT APPROVAL PAGE DATA ===");
  console.log("URL Params:", params);
  console.log("Navigation State:", location.state);
  console.log("Claim ID:", claimId);
  console.log("=== REDUX POLICY HOLDER DATA ===");
  console.log("Redux Policy Holder Name:", reduxPolicyHolderName);
  console.log("Redux Policy Number:", reduxPolicyNumber);
  console.log("Redux Claim Number:", reduxClaimNumber);
  console.log("Final Policy Holder Name:", policyHolderName);
  console.log("Final Claim Number:", claimNumber);
  console.log("=== END REDUX POLICY HOLDER DATA ===");
  console.log("=== END SETTLEMENT APPROVAL PAGE DATA ===");
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
        setTimeout(() => {
          navigate(`/agent/clientview/${123}`);
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
            <img
              src="https://i.ibb.co/4pbj1hp/waiting-for-approval.png"
              className="claimtitle__img__container"
            />
          </div>
          <div className="claimtitle__txt_container mt-6">
            <div>{t("settlementApproval.claimBeingProcessed")}</div>
            <div>{t("settlementApproval.kindlyBePatientSettlement")}</div>
          </div>
        </div>
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
      </Card>
    </div>
  );
};

export default SettlementApproval;
