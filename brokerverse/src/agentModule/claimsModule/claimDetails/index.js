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
