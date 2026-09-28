import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import "./index.scss";
import CustomToast from "../../../components/Toast";

const EndorsementRejected = () => {
  const { t } = useTranslation();
  const params = useParams();
  const { id } = params;
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const handleReject = () => {
    toastRef.current.showToast();
    setTimeout(() => {
      navigate(`/agent/clientview/${123}`);
    }, 2000);
  };
  const handleCommonAction = () => {
    navigate(`/agent/clientview/${123}`);
  };
  const handleSubmit = () => {
    navigate(`/agent/clientview/${123}`);
  };
  return (
    <div className="endorsement__rejected__overall">
      <div className="endorsement__waiting__requestapproval__upload__main__title">
        {t("endorsement.clients")}
      </div>
      <div
        onClick={handleCommonAction}
        className="endorsement__waiting__request__uploadarrow__back__btn mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="endorsement__waiting__request__upload__back__btn__title">
          Carson Darrin / {t("endorsement.clientId")} : {id}
        </div>
      </div>
      <CustomToast ref={toastRef} message={t("endorsement.endorsementRejected")} />
      <Card className="mt-4 claimrequest__overall__card">
        <div className="mt-6">
          <div className="claimtitle__img__overallcontainer mt-4">
            <img
              src="https://i.ibb.co/V21pJZs/REJECTED-1.png"
              className="claimtitle__img__container"
              alt="Rejected"
            />
          </div>
          <div className="claimtitle__txt_container mt-6">
            <div>{t("endorsement.thisEndorsementRejected")}</div>
            <div>
              {t("endorsement.youCanStillView")}
            </div>
          </div>
        </div>
        <div className="claimtitle__butt_container mt-8">
          <Button
            onClick={handleSubmit}
            className="endorsement__waiting__snd__but"
          >
            {t("endorsement.details")}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default EndorsementRejected;
