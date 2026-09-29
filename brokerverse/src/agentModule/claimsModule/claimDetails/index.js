import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import "./index.scss";
import ClaimDetailsCard from "./claimDetailsCard";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getClaimDetailsViewData,
  getClaimDetailsForEdit,
} from "./store/claimDetailsMiddleWare";
const ClaimDetails = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  // Get parameters from URL or navigation state
  const { leadId, quoteId, policyId, claimId } = params;
  const navigationState = location.state || {};

  // Console logs to check data passed from previous page
  console.log("=== CLAIM DETAILS PAGE DATA ===");
  console.log("URL Params:", { leadId, quoteId, policyId, claimId });
  console.log("Navigation State:", navigationState);
  console.log("Location object:", location);
  console.log("Full URL:", window.location.href);
  console.log("Pathname:", window.location.pathname);
  console.log("Search params:", window.location.search);

  // Use URL params first, then fall back to navigation state, then hardcoded defaults
  const leadRefId = leadId || navigationState.leadRefId || "LEAD-001";
  const quoteRefId = quoteId || navigationState.quoteRefId || "QUOTE-001";
  const policyRefId =
    policyId ||
    navigationState.policyRefId ||
    navigationState.policyId ||
    "POLICY-001";

  console.log("Final Reference IDs:", { leadRefId, quoteRefId, policyRefId });
  console.log("=== END CLAIM DETAILS PAGE DATA ===");

  // Log navigation flow details
  console.log("=== NAVIGATION FLOW ANALYSIS ===");
  console.log("Navigating to claim page for:");
  console.log("- Lead ID:", leadRefId);
  console.log("- Quote ID:", quoteRefId);
  console.log("- Policy ID:", policyRefId);
  console.log("- Claim ID:", claimId);
  console.log("=== END NAVIGATION FLOW ANALYSIS ===");

  // Get claim details data from Redux store
  const { claimDetailsViewData } = useSelector(
    ({ claimDetailsMainReducers }) => {
      return {
        claimDetailsViewData: claimDetailsMainReducers?.claimDetailsViewData,
      };
    }
  );

  // Log Redux store data
  console.log("=== REDUX STORE DATA ===");
  console.log("Claim Details View Data:", claimDetailsViewData);
  console.log("Policy Holder Name:", claimDetailsViewData?.PolicyHolderName);
  console.log("Policy Number:", claimDetailsViewData?.policyNumber);
  console.log("Insurance Company:", claimDetailsViewData?.InsuranceCompanyName);
  console.log("=== END REDUX STORE DATA ===");

  // Dispatch action to fetch policy and lead details
  const dispatch = useDispatch();

  useEffect(() => {
    console.log("=== DISPATCHING CLAIM DETAILS VIEW DATA ===");
    console.log("Dispatching with:", { leadRefId, quoteRefId, policyRefId });
    console.log("Navigation State:", navigationState);
    console.log("Claim ID from URL:", claimId);
    console.log("Claim ID from navigation:", navigationState.claimId);

    // Determine if this is edit flow based on claimId in URL or navigation state
    const isEditFlow = claimId && claimId !== "new";
    const actualClaimId =
      claimId && claimId !== "new" ? claimId : navigationState.claimId;

    console.log("=== FLOW DETECTION ===");
    console.log("Is Edit Flow:", isEditFlow);
    console.log("Actual Claim ID:", actualClaimId);
    console.log("=== END FLOW DETECTION ===");

    if (isEditFlow && actualClaimId) {
      console.log("=== EDIT FLOW - FETCHING CLAIM DETAILS ===");
      console.log("Claim ID for edit:", actualClaimId);
      console.log("Fetching details for existing claim:", actualClaimId);
      dispatch(getClaimDetailsForEdit(actualClaimId));
    } else {
      console.log("=== NEW CLAIM FLOW - FETCHING POLICY/LEAD DETAILS ===");
      console.log("Creating new claim for policy:", policyRefId);
      console.log("Using reference IDs:", {
        leadRefId,
        quoteRefId,
        policyRefId,
      });
      console.log("Fetching policy details for policy number:", policyRefId);
      dispatch(
        getClaimDetailsViewData({
          leadRefId,
          quoteRefId,
          policyRefId,
          lob: navigationState.lob || navigationState.productType,
        })
      );
    }

    console.log("=== END DISPATCHING CLAIM DETAILS VIEW DATA ===");
  }, [
    dispatch,
    leadRefId,
    quoteRefId,
    policyRefId,
    claimId,
    navigationState.isEdit,
    navigationState.claimId,
  ]);

  return (
    <div className="claim__details__container">
      <div className="claim__details__container__titles">{t("agent.clients")}</div>
      <div className="claim__details__container__back__btn mt-3">
        <div onClick={() => navigate("/agent/clientlisting")}>
          <SvgLeftArrow />
        </div>
        <div className="claim__details__container__back__btn__title">
          {(() => {
            const policyHolderName =
              claimDetailsViewData?.PolicyHolderName || t("agent.loading");
            const policyNumber = claimDetailsViewData?.policyNumber;
            const claimIdValue = claimId;

            return `${policyHolderName} / ${
              policyNumber
                ? `${t("agent.policyLabel")}: ${policyNumber}`
                : claimIdValue
                ? `${t("agent.claimLabel")}: ${claimIdValue}`
                : t("agent.loading")
            }`;
          })()}
        </div>
      </div>
      <ClaimDetailsCard
        leadRefId={leadRefId}
        quoteRefId={quoteRefId}
        policyRefId={policyRefId}
        initialLob={navigationState.lob || navigationState.productType}
      />
    </div>
  );
};

export default ClaimDetails;
