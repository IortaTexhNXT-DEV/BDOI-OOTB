import { Card } from "primereact/card";
import React from "react";
import { useTranslation } from "react-i18next";
import SvgLead from "../../../../assets/agentIcon/SvgLead";
import SvgArrow from "../../../../assets/agentIcon/SvgArrow";
import SvgClient from "../../../../assets/agentIcon/SvgClient";
import SvgPolicySold from "../../../../assets/agentIcon/SvgPolicySold";
import { useNavigate } from "react-router-dom";

const TopCard = ({ detail }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const handleLeadsNavigation = () => {
    navigate("/agent/leadlisting");
  };
  const handleClientsNavigation = () => {
    navigate("/agent/clientlisting");
  };
  const handlePolicyNavigation = () => {
    navigate("/agent/clientlisting");
  };
  return (
    <div className="top__card__container grid">
      <div className="col-12 md:col-4 lg:col-4">
        <Card>
          <div className="grid m-0">
            <div className="col-4 md:col-4 lg:col-4">
              <SvgLead />
            </div>
            <div className="col-8 md:col-8 lg:col-8">
              <div className="card__container__title">{t("dashboard.totalLeads")}</div>
              <div className="card__container__count mt-1">
                {detail?.totalLeads}
              </div>
            </div>
          </div>
          <div className="card__container__btn__container mt-3">
            <div
              onClick={handleLeadsNavigation}
              className="card__container__btn cursor-pointer"
            >
              {t("common.seeMore")} <SvgArrow />
            </div>
          </div>
        </Card>
      </div>
      <div className="col-12 md:col-4 lg:col-4">
        <Card>
          <div className="grid  m-0">
            <div className="col-4 md:col-4 lg:col-4">
              <SvgClient />
            </div>
            <div className="col-8 md:col-8 lg:col-8">
              <div className="card__container__title">{t("dashboard.totalClients")}</div>
              <div className="card__container__count mt-1">
                {detail?.totalClients}
              </div>
            </div>
          </div>
          <div className="card__container__btn__container mt-3">
            <div
              onClick={handleClientsNavigation}
              className="card__container__btn cursor-pointer"
            >
              {t("common.seeMore")} <SvgArrow />
            </div>
          </div>
        </Card>
      </div>
      <div className="col-12 md:col-4 lg:col-4">
        <Card>
          <div className="grid  m-0">
            <div className="col-4 md:col-4 lg:col-4">
              <SvgPolicySold />
            </div>
            <div className="col-8 md:col-8 lg:col-8">
              <div className="card__container__title">{t("dashboard.policySold")}</div>
              <div className="card__container__count mt-1">
                {detail?.policySold}
              </div>
            </div>
          </div>
          <div className="card__contaiiner__btn__container mt-3">
            <div
              onClick={handlePolicyNavigation}
              className="card__container__btn cursor-pointer"
            >
              {t("common.seeMore")} <SvgArrow />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TopCard;
