import React, { useMemo } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import PolicyDetailedViewCard from "./policyDetailViewCard";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";

const PolicyDetailedView = ({ action }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: policyId } = useParams();

  const { policydetailedlist } = useSelector(
    ({ policyDetailedViewMainReducers }) => ({
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
    })
  );

  const clientName =
    state?.ClientName ||
    state?.clientName ||
    policydetailedlist?.ClientName ||
    policydetailedlist?.clientName;
  // Show the client code (CL-2026-00001), never the internal id
  const clientId =
    state?.ClientCode ||
    state?.client?.clientCode ||
    state?.clientCode ||
    policydetailedlist?.ClientCode ||
    policydetailedlist?.client?.clientCode ||
    policydetailedlist?.client?.generatedClientId ||
    state?.ClientId ||
    state?.clientId ||
    policydetailedlist?.ClientId ||
    policydetailedlist?.clientId;

  const displayTitle = useMemo(() => {
    const parts = [];

    if (clientName) {
      parts.push(clientName);
    }
    if (clientId) {
      parts.push(`${t("agent.clientIdLabel")} ${clientId}`);
    }
    return parts.join(" / ") || t("agent.policyDetailsTitle");
  }, [clientName, clientId, t]);

  const handleClientViewNavigation = () => {
    navigate(-1);
  };

  return (
    <div className="policy__details__view__container">
      <div className="policy__details__view__container__title">{t("agent.clientsLabel")}</div>
      <div
        className="policy__details__view__back__btn__container mt-3 cursor-pointer"
        onClick={handleClientViewNavigation}
      >
        <SvgLeftArrow />
        <div className="policy__details__view__back__btn__container__title">
          {displayTitle}
        </div>
      </div>
      <PolicyDetailedViewCard
        action={action}
        state={state}
        policyId={policyId}
      />
    </div>
  );
};

export default PolicyDetailedView;
