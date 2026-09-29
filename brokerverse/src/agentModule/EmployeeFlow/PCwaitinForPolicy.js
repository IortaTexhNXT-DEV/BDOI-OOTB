import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Image } from "primereact/image";
import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import SvgRightarrow from "../../assets/agentIcon/SvgRightArrow";
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";

const PCwaitingForPolicy = ({ state }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleclick = () => {
    navigate("/agent/employee-benefit/policy-upload-policy", { state: state });
  };
  const handleEdit = () => {
    navigate(`/agent/employee-benefit/create-quote`);
  };
  const handleLeadNavigation = () => {
    navigate(-1);
  };
  let flow = "nonrenewal"

  return (
    <div className="policy__approval__card__container mt-4">

     <div className="order__summary__main__title">
                {flow === "renewal" ? t("employeeBenefit.client") : t("employeeBenefit.leads")}
            </div>
            <div
                onClick={handleLeadNavigation}
                className="order__summary__back__btn mt-3 cursor-pointer"
            >
                <SvgLeftArrow />
                <div className="order__summary__back__btn__title">
                    {flow === "renewal"
                        ? `Carson Darrin / ${t("employeeBenefit.clientIdLabel")} 12345678`
                        : `${t("employeeBenefit.leadIdLabel")} 12345678`}
                </div>
            </div>

      <Card style={{marginTop:"20px"}} className="pt-5">
        <div className="policy__approval__card__title">{t("employeeBenefit.waitingForPolicy")}</div>
        <div className="policy__approval__card__image__containe mt-4">
          <Image
            src="https://i.ibb.co/gz54P23/Hourglass.png"
            width="106px"
            height="187px"
          />
        </div>
        <div className="policy__approval__card__sub__text__container mt-3">
          <div className="policy__approval__card__sub__text">
            {t("employeeBenefit.quotationSubmittedWaitPolicy")}
          </div>
        </div>

        <div className="policy__approval__card__btn__container mt-6">
          <div className="edit__btn__container">
            <Button className="edit__btn" onClick={handleEdit}>
              {t("employeeBenefit.edit")}
            </Button>
          </div>
          <div className="recived__btn__container">
            <Button
              className="recived__btn"
              onClick={() => {
                handleclick();
              }}
            >
              {t("employeeBenefit.policyReceived")}
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

export default PCwaitingForPolicy;
