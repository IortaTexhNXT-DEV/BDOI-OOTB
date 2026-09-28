import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "primereact/button";
import "./index.scss";
import CustomToast from "../../../components/Toast";
import StatusIllustration from "../../component/StatusIllustration";

const PaymentErrorEndorsment = () => {
  const { t } = useTranslation();
  const { endorsementId } = useParams();
  const { state } = useLocation();
  const policyId = state?.policyId;
  const clientId = state?.clientId;
  const clientName = state?.clientName;
  const endorsementData = state?.endorsementData;

  const toastRef = useRef(null);
  const navigate = useNavigate();

  // Get policy number from state or endorsementData
  const policyNumber = 
    state?.policyNumber ||
    endorsementData?.policyNumber ||
    "N/A";

  // Check if this is a cancellation endorsement
  const endorsementStatus = endorsementData?.status;
  const endorsementTypeIds = endorsementData?.endorsementTypeIds || [];
  const isCancellation = 
    endorsementStatus === "Cancelled" ||
    endorsementStatus === "InitiateCancel" ||
    endorsementTypeIds.includes(5) ||
    endorsementData?.isCancelPolicy === true;

  const handleReject = () => {
    toastRef.current.showToast();
    setTimeout(() => {
      if (clientId) {
        navigate(`/agent/clientview/${clientId}`, { replace: true });
      } else {
        navigate("/agent/clientlisting", { replace: true });
      }
    }, 2000);
  };

  const handleCommonAction = () => {
    if (clientId) {
      navigate(`/agent/clientview/${clientId}`);
    } else {
      navigate(-1);
    }
  };

  const handleSubmit = () => {
      navigate(`/agent/uploadendorsement/${endorsementId}`, {
      state: {
        endorsementId,
        policyId,
        clientId,
        clientNumber: state?.clientNumber,
        clientName,
        endorsementData,
      },
    });
  };
  return (
    <div className="endorsement__waiting__approval__overall">
      <div className="endorsement__waiting__requestapproval__upload__main__title">
        {t("endorsement.clients")}
      </div>
      <div
        onClick={handleCommonAction}
        className="endorsement__waiting__request__uploadarrow__back__btn mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="endorsement__waiting__request__upload__back__btn__title">
          {clientName || t("endorsement.client")} / {t("endorsement.clientId")} : {state?.clientNumber}
        </div>
      </div>
      <CustomToast
        ref={toastRef}
        message={t("endorsement.endorsementRejected")}
        messageType="error"
      />
      <Card className="mt-4 claimrequest__overall__card">
        <div>
          <div className="endorsement__waiting__title_txt mt-6">
            {t("endorsement.waitingForUpdate")}
          </div>
          <div className="claimtitle__img__overallcontainer mt-4">
            <StatusIllustration variant="waiting" className="claimtitle__img__container" />
          </div>
          <div className="claimtitle__txt_container mt-6">
            <div>
              {isCancellation ? t("endorsement.cancellation") : t("endorsement.endorsementTitle")} {t("endorsement.requestRaised", { policyNumber })}
            </div>
            <div>{t("endorsement.pleaseWaitProcessed")}</div>
          </div>
        </div>
        <div className="claimtitle__butt_container mt-6">
          <Button
            link
            onClick={handleReject}
            className="endorsement__waiting__back__but"
          >
            {t("endorsement.reject")}
          </Button>
          <Button
            onClick={handleSubmit}
            className="endorsement__waiting__snd__but"
          >
            {t("endorsement.proceed")}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PaymentErrorEndorsment;
