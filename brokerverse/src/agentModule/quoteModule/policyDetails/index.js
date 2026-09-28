import React, { useEffect, useState } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import PolicyDetailsCard from "./policyDetailsCard";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import leadService from "../../../services/leadService";

const PolicyDetails = ({ action, flow }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: routeId } = useParams();
  const quotationData = state?.quotationData;
  const leadRefId = useSelector(
    ({ quotationReducers }) => quotationReducers?.currentQuoteCreation?.leadRefId
  );

  // The lead comes from the navigation state (straight after creating it or from Lead Details); a quote opened
  // by URL loads it from the route id, so the header never shows an invented id.
  const [lead, setLead] = useState(state?.lead || null);
  const leadIdToLoad = state?.lead
    ? null
    : action === "createquote"
    ? routeId
    : quotationData?.leadRefId || leadRefId || null;

  useEffect(() => {
    if (!leadIdToLoad) return undefined;
    let active = true;
    leadService
      .getLeadById(leadIdToLoad)
      .then((result) => {
        if (active && result?.success && result.data) setLead(result.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [leadIdToLoad]);

  const displayLeadId =
    lead?.generatedLeadId || quotationData?.lead?.generatedLeadId || "";

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
          {flow === "lead" ? t("agent.leadIdLabel") : t("agent.clientIdLabel")}{" "}
          {displayLeadId}
        </div>
      </div>
      <PolicyDetailsCard action={action} flow={flow} lead={lead} />
    </div>
  );
};

export default PolicyDetails;
