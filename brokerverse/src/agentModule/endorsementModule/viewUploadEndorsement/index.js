import React from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useLocation, useNavigate } from "react-router-dom";
import billingService from "../../../services/billingService";
import InputTextField from "../../component/inputText";
import SvgBlueArrow from "../../../assets/agentIcon/SvgBlueArrow";

const ViewEndorsement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();

  const endorsementId = state?.endorsementId || state?.id;

  const handleclickNavigation = () => {
    navigate(`/agent/endorsement/paymentconfirmation/${endorsementId || ""}`);
  };
  const handlePayLater = () => {
    navigate(-1);
  };

  const handleEndorsement = () => {
    if (endorsementId) {
      billingService.generateEndorsementBillingStatement(endorsementId, { useEndorsementId: true });
    }
  };

  return (
    <div className="view__endorsement__container">
      <div className="view__endorsement__container__title">{t("endorsement.clients")}</div>
      <div className="grid mt-3">
        <div className="view__endorsement__container__back__btn__container col-12 md:col-6 lg:col-6">
          <SvgLeftArrow />
          <div className="view__endorsement__container__back__btn__title">
            {state?.clientNumber ? `${t("endorsement.clientId")} : ${state.clientNumber}` : state?.clientName || t("endorsement.client")}
          </div>
        </div>
      </div>
      <div className="view__endorsement__card__container mt-4">
        <Card className="card__container">
          <div className="view__endorsement__card__container__title">
            {t("endorsement.endorsementTitle")}
          </div>
          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.policyNumber")}
                value="123456"
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.endorsementNumber")}
                value="123456"
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.production")}
                value="12/12/2023"
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.inception")}
                value="12/12/2023"
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.issuedDate")}
                value="12/12/2023"
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.expiry")}
                value="12/12/2023"
                disabled={true}
              />
            </div>
          </div>

          <div className="view__endorsement__card__sub__title mt-2 mb-2">
            {t("endorsement.document")}
          </div>

          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <div onClick={()=>handleEndorsement()} className="endorsement__detail__view__box">
                <div className="grid mt-2">
                  <div className="col-12 md:col-6 lg:col-6">
                    <div className="endorsement__detail__view__box__title">
                      {t("endorsement.endorsementTitle")}
                    </div>
                  </div>
                  <div className="col-12 md:col-6 lg:col-6">
                    <div className="endorsement__detail__view__box__container">
                      <div className="endorsement__detail__view__box__sub__title">
                        {t("endorsement.view")}
                      </div>
                      <SvgBlueArrow />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid m-0 mt-2">
            <div className="col-12 md:col-12 lg:col-12 back__complete__btn__container ">
              <div className="back__btn__container">
                <Button className="back__btn" onClick={handlePayLater}>
                  {t("endorsement.payLater")}
                </Button>
              </div>
              <div className="complete__btn__container">
                <Button
                  className="complete__btn"
                  onClick={() => {
                    handleclickNavigation();
                  }}
                >
                  {t("endorsement.proceedToPayment")}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ViewEndorsement;
