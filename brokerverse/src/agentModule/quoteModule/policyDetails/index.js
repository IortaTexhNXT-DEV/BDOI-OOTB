import React from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import PolicyDetailsCard from "./policyDetailsCard";
import { useNavigate, useLocation } from "react-router-dom";

const PolicyDetails = ({ action, flow }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const quotationData = state?.quotationData;

  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };
  return (
    <div className="policy__container">
      <div className="policy__container__title">
        {flow === "lead" ? t("agent.leads") : t("agent.clientsLabel")}
      </div>
      <div
        onClick={handleLeadNavigation}
        className="policy__container__back__btn__container mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="policy__container__back__btn__title">
          {flow === "lead" ? t("agent.leadIdLabel") : t("agent.clientIdLabel")} 
          {flow === "lead"
            ? state?.lead?.generatedLeadId ||
              quotationData?.lead?.generatedLeadId ||
              quotationData?.leadRefId ||
              ""
            : state?.client?.clientCode ||
              state?.clientCode ||
              quotationData?.client?.clientCode ||
              quotationData?.client?.generatedClientId ||
              ""}{" "}
        </div>
      </div>
      <PolicyDetailsCard action={action} flow={flow} />
    </div>
  );
};

export default PolicyDetails;
