import { Button } from "primereact/button";
import { Card } from "primereact/card";
import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import SvgRightarrow from "../../../../assets/agentIcon/SvgRightArrow";
import policyService from "../../../../services/policyService";
import StatusIllustration from "../../../component/StatusIllustration";

const PolicyApprovalCard = ({ state }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Extract IDs from state
  const policyId = state?.policyId;
  const quotationId = state?.quotationId;
  const paymentStatus = state?.paymentStatus || state?.policyData?.paymentStatus;
  const policyData = state?.policyData;

  const handlePolicyReceived = async () => {
    console.log('=== POLICY RECEIVED - PROCEEDING TO PAYMENT ===');
    console.log('Policy ID:', policyId);
    console.log('Quotation ID:', quotationId);
    
    let resolvedPolicyId = policyId;
    let resolvedPolicyData = policyData;

    if (!resolvedPolicyId && quotationId) {
      try {
        const response = await policyService.getPolicies(1, 1, { quoteRefId: quotationId });
        if (response.success && Array.isArray(response.data?.data) && response.data.data.length > 0) {
          const policyRecord = response.data.data[0];
          resolvedPolicyId = policyRecord.policyId || policyRecord.id;
          resolvedPolicyData = policyRecord;
        }
      } catch (error) {
        console.error('Failed to resolve policy ID on waiting page:', error);
      }
    }

    if (!resolvedPolicyId) {
      console.error('Policy ID not found in state');
      alert(t("agent.policyIdNotFound"));
      return;
    }
    
    // Navigate to payment options for the created policy
    // Note: fromWaitingPage MUST be set after spread to ensure it's not overridden
    const navigationState = {
      ...state,
      policyId: resolvedPolicyId,
      quotationId: quotationId,
      policyData: resolvedPolicyData,
      fromWaitingPage: true, // This MUST be true for auto-payment flow
    };
    
    console.log('Final navigation state:', navigationState);
    console.log('fromWaitingPage is:', navigationState.fromWaitingPage);
    
    navigate(`/agent/uploadpolicy/${quotationId || ''}`, {
      state: navigationState,
    });
  };
  
  const handleEdit = () => {
    const quotationIdForEdit = quotationId || state?.quotation?.id;
    if (quotationIdForEdit) {
      navigate(`/agent/convertpolicy/customerinfo/edit/${quotationIdForEdit}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="policy__approval__card__container mt-4">
      <Card className="pt-5">
        <div className="policy__approval__card__title">{t("agent.waitingForPolicy")}</div>
        <div className="policy__approval__card__image__containe mt-4">
          <StatusIllustration variant="waiting" size="8rem" />
        </div>
        <div className="policy__approval__card__sub__text__container mt-3">
          <div className="policy__approval__card__sub__text">
            {paymentStatus === 'Pending' || paymentStatus === 'Draft'
              ? t("agent.policyAwaitingPayment")
              : t("agent.quotationSubmittedWaitPolicy")}
          </div>
        </div>

        <div className="policy__approval__card__btn__container mt-6">
          <div className="edit__btn__container">
            <Button className="edit__btn" onClick={handleEdit}>
              {t("agent.edit")}
            </Button>
          </div>
          <div className="recived__btn__container">
            <Button
              className="recived__btn"
              onClick={handlePolicyReceived}
            >
              {t("agent.policyReceived")}
              <span className="flex" style={{ marginLeft: "10px" }}>
                <SvgRightarrow />
              </span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PolicyApprovalCard;
