import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { useRef } from "react";
import claimsService from "../../../services/claimsService";
import { useSelector } from "react-redux";
import "./index.scss";
import StatusIllustration from "../../component/StatusIllustration";

const RequestApproval = ({ flow }) => {
  const { t } = useTranslation();
  const params = useParams();
  const { id } = params;
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const toast = useRef(null);

  // Get data from navigation state
  const navigationState = location.state || {};
  const policyNumber = navigationState.policyNumber || t("claimAuditTrail.nA");
  const claimId = navigationState.claimId || id;
  const fullResponse = navigationState.fullResponse || {};

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

  // Try to get policy holder name from Redux first, then navigation state, then fullResponse or use fallback
  const policyHolderName =
    reduxPolicyHolderName ||
    navigationState.policyHolderName ||
    fullResponse?.data?.policyHolderName ||
    fullResponse?.data?.claim?.policyHolderName ||
    fullResponse?.data?.claim?.PolicyHolderName ||
    t("claimRequestApproval.loading");

  // Use Redux claim number instead of navigation state
  const claimNumber = reduxClaimNumber || t("claimRequestApproval.loading");

  // Console logs to debug the data
  console.log("=== REQUEST APPROVAL PAGE DATA ===");
  console.log("URL Params:", params);
  console.log("Navigation State:", navigationState);
  console.log("Policy Number:", policyNumber);
  console.log("Claim Number:", claimNumber);
  console.log("Claim ID:", claimId);
  console.log("Policy Holder Name:", policyHolderName);
  console.log("Full Response:", fullResponse);
  console.log("=== REDUX DATA ===");
  console.log("Redux Policy Holder Name:", reduxPolicyHolderName);
  console.log("Redux Policy Number:", reduxPolicyNumber);
  console.log("Redux Claim Number:", reduxClaimNumber);
  console.log("=== END REDUX DATA ===");
  console.log("=== CLAIM DATA ANALYSIS ===");
  console.log("Available claim data fields:", {
    claimId: claimId,
    policyNumber: policyNumber,
    claimNumber: claimNumber,
    fullResponse: fullResponse,
    navigationState: navigationState,
  });
  console.log("=== END CLAIM DATA ANALYSIS ===");
  console.log("=== END REQUEST APPROVAL PAGE DATA ===");

  const handleEdit = async () => {
    try {
      setIsLoading(true);

      // Get claim details using the claim ID from URL
      const claimId = id;
      console.log("=== FETCHING CLAIM DETAILS FOR EDIT ===");
      console.log("Claim ID:", claimId);

      const result = await claimsService.getClaimDetails(claimId);

      if (result.success) {
        const claimData = result.data;
        console.log("Claim data fetched:", claimData);

        // Extract the necessary IDs from claim data
        const leadRefId = claimData.leadRefId || "LEAD-001";
        const quoteRefId = claimData.quoteRefId || "QUOTE-001";
        const policyRefId = claimData.policyRefId || "POLICY-001";

        console.log("Extracted IDs:", { leadRefId, quoteRefId, policyRefId });

        // Navigate to claim details page with claimId in URL
        console.log("=== NAVIGATING TO EDIT CLAIM ===");
        console.log("Claim ID for edit:", claimId);
        console.log("Reference IDs:", { leadRefId, quoteRefId, policyRefId });
        console.log("=== END NAVIGATING TO EDIT CLAIM ===");

        navigate(`/agent/claimrequest/claimdetails/${claimId}`);
      } else {
        console.error("Failed to fetch claim details:", result.error);
        toast.current.show({
          severity: "error",
          summary: t("claimRequestApproval.error"),
          detail: t("claimRequestApproval.failedToLoadClaimDetails"),
          life: 5000,
        });
      }
    } catch (error) {
      console.error("Error fetching claim details:", error);
      toast.current.show({
        severity: "error",
        summary: t("claimRequestApproval.error"),
        detail: t("claimRequestApproval.unexpectedErrorLoading"),
        life: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Use the claim ID from the URL parameter (id)
      const claimId = id; // This should be the claim ID from the previous screen

      const result = await claimsService.updateClaimStatus(
        claimId,
        "Processing"
      );

      if (result.success) {
        toast.current.show({
          severity: "success",
          summary: t("claimRequestApproval.success"),
          detail: t("claimRequestApproval.claimStatusUpdated"),
          life: 3000,
        });

        // Navigate after successful update
        setTimeout(() => {
          if (flow === "quotation") {
            navigate("/agent/quotedetailedit");
          } else {
            navigate(`/agent/claimrequest/adjustersubmission/${claimId}`);
          }
        }, 1000);
      } else {
        toast.current.show({
          severity: "error",
          summary: t("claimRequestApproval.error"),
          detail: result.error || t("claimRequestApproval.failedToUpdateStatus"),
          life: 5000,
        });
      }
    } catch (error) {
      console.error("Error updating claim status:", error);
      toast.current.show({
        severity: "error",
        summary: t("claimRequestApproval.error"),
        detail: t("claimRequestApproval.unexpectedError"),
        life: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientViewNavigation = () => {
    const clientId =
      navigationState.clientId ||
      fullResponse?.data?.policy?.clientId ||
      fullResponse?.data?.claim?.policy?.clientId ||
      fullResponse?.data?.clientId;

    if (clientId) {
      navigate(`/agent/clientview/${clientId}`);
    } else {
      navigate(-1);
    }
  };
  return (
    <div className="claim__approval__overall">
      <Toast ref={toast} />
      <div className="claim__requestapproval__upload__main__title">{t("claimRequestApproval.clients")}</div>
      <div
        className="claim__request__uploadarrow__back__btn mt-3 cursor-pointer"
        onClick={handleClientViewNavigation}
      >
        <SvgLeftArrow />
        <div className="claim__request__upload__back__btn__title">
          {(() => {
            console.log("=== REQUEST APPROVAL DISPLAY LOGIC ===");
            console.log("Policy Holder Name:", policyHolderName);
            console.log("Claim Number:", claimNumber);
            console.log(
              "Displaying:",
              `${policyHolderName} / ${
                claimNumber ? `Claim: ${claimNumber}` : "Loading..."
              }`
            );
            console.log("=== END REQUEST APPROVAL DISPLAY LOGIC ===");

            return `${policyHolderName} / ${
              claimNumber ? t("claimRequestApproval.claimLabel", { claimNumber }) : t("claimRequestApproval.loading")
            }`;
          })()}
        </div>
      </div>
      <Card className="mt-4 claimrequest__overall__card">
        <div>
          <div className="claim__title_txt mt-6">{t("claimRequestApproval.waitingForUpdate")}</div>
          <div className="claimtitle__img__overallcontainer mt-4">
            <StatusIllustration variant="waiting" className="claimtitle__img__container" />
          </div>
          <div className="claimtitle__txt_container mt-6">
            <div>
              {" "}
              {t("claimRequestApproval.claimRequestRaised", { policyNumber })}
            </div>
            <div>
              {" "}
              {t("claimRequestApproval.kindlyBePatient")}
            </div>
          </div>
        </div>
        <div className="claimtitle__butt_container mt-6">
          <Button
            link
            onClick={handleEdit}
            className="claim__back__but"
            disabled={isLoading}
            loading={isLoading}
          >
            {isLoading ? t("claimRequestApproval.loading") : t("claimRequestApproval.edit")}
          </Button>
          <Button
            onClick={handleSubmit}
            className="claim__snd__but"
            loading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? t("claimRequestApproval.updating") : t("claimRequestApproval.proceed")}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RequestApproval;
