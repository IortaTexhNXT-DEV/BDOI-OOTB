import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import ClaimJourneyLayout from "../shared/ClaimJourneyLayout";
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

  // Use URL params first, then fall back to navigation state, then hardcoded defaults
  const leadRefId = leadId || navigationState.leadRefId || "LEAD-001";
  const quoteRefId = quoteId || navigationState.quoteRefId || "QUOTE-001";
  const policyRefId =
    policyId ||
    navigationState.policyRefId ||
    navigationState.policyId ||
    "POLICY-001";

  // Get claim details data from Redux store
  const { claimDetailsViewData } = useSelector(
    ({ claimDetailsMainReducers }) => {
      return {
        claimDetailsViewData: claimDetailsMainReducers?.claimDetailsViewData,
      };
    }
  );

  // Dispatch action to fetch policy and lead details
  const dispatch = useDispatch();

  useEffect(() => {
    // Determine if this is edit flow based on claimId in URL or navigation state
    const isEditFlow = claimId && claimId !== "new";
    const actualClaimId =
      claimId && claimId !== "new" ? claimId : navigationState.claimId;

    if (isEditFlow && actualClaimId) {
      dispatch(getClaimDetailsForEdit(actualClaimId));
    } else {
      dispatch(
        getClaimDetailsViewData({
          leadRefId,
          quoteRefId,
          policyRefId,
          lob: navigationState.lob || navigationState.productType,
        })
      );
    }

  }, [
    dispatch,
    leadRefId,
    quoteRefId,
    policyRefId,
    claimId,
    navigationState.isEdit,
    navigationState.claimId,
  ]);

  const holder = claimDetailsViewData?.PolicyHolderName || "";
  const policyNumber = claimDetailsViewData?.policyNumber;
  const clientId = claimDetailsViewData?.clientId || navigationState.clientId;
  return (
    <ClaimJourneyLayout
      step="notification"
      claimNumber={claimId && claimId !== "new" ? claimDetailsViewData?.claimNumber || "" : ""}
      holderName={holder}
      reference={policyNumber ? t("claimFlow.policyRef", { number: policyNumber }) : ""}
      onBack={() => navigate(clientId ? `/agent/clientview/${clientId}` : "/agent/claim")}
      title={t("claimFlow.notificationTitle")}
    >
      <ClaimDetailsCard
        leadRefId={leadRefId}
        quoteRefId={quoteRefId}
        policyRefId={policyRefId}
        initialLob={navigationState.lob || navigationState.productType}
      />
    </ClaimJourneyLayout>
  );
};

export default ClaimDetails;
