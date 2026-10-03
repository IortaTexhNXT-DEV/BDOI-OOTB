import React from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "primereact/button";
import "./index.scss";
import StatusIllustration from "../../component/StatusIllustration";

const ClaimRejected = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const clientId = location.state?.clientId;
  const claimId = location.state?.claimId;
  const policyNumber = location.state?.policyNumber;

  const navigateToClientView = () => {
    if (clientId) {
      navigate(`/agent/clientview/${clientId}`);
    } else {
      navigate(-1);
    }
  };

  const handleCommonAction = () => {
    navigateToClientView();
  };
  const handleSubmit = () => {
    navigate("/agent/claimdocumentupload", {
      state: {
        clientId,
        claimId,
        policyNumber,
      },
    });
  };
  return (
    <div className="claimrejected__approval__overall">
      <div className="claim__requestapproval__upload__main__title">{t("agent.clientsLabel")}</div>
      <div
        onClick={handleCommonAction}
        className="claim__request__uploadarrow__back__btn mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="claim__request__upload__back__btn__title">
          {t("agent.clientIdLabel")} {clientId || ""}
        </div>
      </div>
      <Card className="mt-8 claimrequest__overall__card">
        <div className="claimtitle__card_overall">
          <div className="claimtitle__img__overallcontainer mt-8">
            <StatusIllustration variant="rejected" className="claimtitle__img__container" />
          </div>
          <div className="claimtitle__txt_container mt-6">
            <div>{t("agent.claimRequestRejected")}</div>
            <div>{t("agent.claimRejectedViewInfo")}</div>
          </div>
        </div>
        <div className="claimtitle__butt_container mt-6">
          <Button onClick={handleSubmit} className="claim__snd__but">
            {t("agent.detail")}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ClaimRejected;
