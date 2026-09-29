import React from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import RenewalRequestCard from "./renewalRequestCard";
import { useNavigate } from "react-router-dom";

const RenewalRequest = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNavigationOpenItems = () => {
    navigate("/agent/openitemslistdata");
  };

  return (
    <div className="expiring__policy__container">
      <div className="grid mt-3">
        <div className="col-12 md:col-6 lg:col-6">
          <label className="leadlisting__overal__container__title">
            {t("openItems.renewalRequest")}
          </label>
        </div>
      </div>

      <div
        className="expiring__policy__container__back__btn cursor-pointer"
        onClick={handleNavigationOpenItems}
      >
        <SvgLeftArrow />
        <div className="expiring__policy__container__back__btn__title">
          {t("openItems.openItems")}
        </div>
      </div>
      <RenewalRequestCard />
    </div>
  );
};

export default RenewalRequest;
