import React from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "primereact/button";
import "./index.scss";

import SvgRightarrow from "../../../assets/agentIcon/SvgRightArrow";
import StatusIllustration from "../../component/StatusIllustration";

const PolicyRenewalWaiting = () => {
  const { t } = useTranslation();
  const params = useParams();
  const { id: renewalId } = params;
  const { state } = useLocation();
  const policyId = state?.policyId;
  const policyData = state?.policyData;
  const quotationId = state?.quotationId;

  const navigate = useNavigate();
  const handleReject = () => {
    // Go back to coverage details to edit the renewal
    if (policyId) {
      navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${policyId}`);
    } else {
      navigate(-1);
    }
  };
  const handleSubmit = () => {
    // Navigate to upload policy page - this should mark renewal as complete
    const navigationState = {
      ...state,
      policyId: policyId,
      quotationId: quotationId,
      policyData: policyData,
      fromWaitingPage: true,
    };
    
    navigate(`/agent/uploadpolicy/${quotationId || ''}`, {
      state: navigationState,
    });
  };
  const handleCommonAction = () => {
    // Navigate to client/policy detail view
    if (policyId) {
      navigate(`/agent/policydetail/${policyId}`);
    } else {
      navigate(`/agent/policy`);
    }
  };
  return (
    <div className="renewal__waiting__screen">
      <div className="claim__requestapproval__upload__main__title">{t("renewalWaiting.clients")}</div>
      <div className="claim__request__uploadarrow__back__btn mt-3">
        <div
          onClick={handleCommonAction}
          className="claim__request__upload__back__btn__title cursor-pointer"
        >
          <SvgLeftArrow />
          {policyData?.client?.name || policyData?.clientName || t("renewalWaiting.client")} / {t("renewalWaiting.policyId")} : {policyId || "N/A"}
        </div>

        <div className="claim__request__upload__back__btn__title">
          {t("renewalWaiting.renewalId")} : {renewalId || "N/A"}
        </div>
      </div>
      <Card className="mt-4 claimrequest__overall__card">
        <div>
          <div className="claim__title_txt mt-6">
            {t("renewalWaiting.waitingForPolicyRenewal")}
          </div>
          <div className="claimtitle__img__overallcontainer mt-4">
            <StatusIllustration variant="waiting" className="claimtitle__img__container" />
          </div>
          <div className="claimtitle__txt_container mt-6">
            <div>
              {t("renewalWaiting.renewalSubmitted")}
            </div>
            <div>{t("renewalWaiting.kindlyWait")}</div>
          </div>
        </div>
        <div className="claimtitle__butt_container mt-6">
          <Button link onClick={handleReject} className="claim__back__but">
            {t("renewalWaiting.edit")}
          </Button>
          <Button onClick={handleSubmit} className="claim__snd__but">
            {t("renewalWaiting.policyReceived")} <SvgRightarrow />
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PolicyRenewalWaiting;
