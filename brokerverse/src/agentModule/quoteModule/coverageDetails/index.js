import React, { useEffect, useMemo } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import CoverageDetailsCard from "./coverageDetailsCard";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getpolicyDetailedMiddleware } from "../policyDetailedView/store/policyDetailedMiddleware";
import { getPolicyRenewalCoverageMiddleware } from "./store/coverageDetailsMiddleware";
import { fetchProductTemplateByIdMiddleware } from "../../../module/ProductConfigurator/store/productConfiguratorMiddleware";

const CoverageDeatails = ({ action, flow }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: policyId } = useParams();
  const dispatch = useDispatch();

  const { policydetailedlist } = useSelector(
    ({ policyDetailedViewMainReducers }) => ({
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
    })
  );

  useEffect(() => {
    dispatch(
      fetchProductTemplateByIdMiddleware({
        templateCode: "MOT-003-2025",
      })
    );
  }, []);

  useEffect(() => {
    if (policyId) {
      dispatch(getpolicyDetailedMiddleware({ policyId }));
      if (flow === "renewal") {
        dispatch(
          getPolicyRenewalCoverageMiddleware({
            policyId,
            page: 1,
            limit: 20,
          })
        );
      }
    }
  }, [dispatch, policyId, flow]);

  const clientName =
    state?.ClientName ||
    state?.clientName ||
    policydetailedlist?.ClientName ||
    policydetailedlist?.clientName;
  const clientId =
    policydetailedlist?.client?.clientCode ||
    state?.ClientId ||
    state?.clientId ||
    policydetailedlist?.ClientId ||
    policydetailedlist?.clientId;
  const leadId = state?.leadId || state?.LeadId;
  const policyNumber =
    state?.policyNumber ||
    state?.PolicyNumber ||
    policydetailedlist?.policyNumber ||
    policyId;

  const displayTitle = useMemo(() => {
    const parts = [];

    if (flow === "renewal") {
      if (clientName) {
        parts.push(clientName);
      }
      if (clientId) {
        parts.push(`${t("agent.clientIdLabel")} ${clientId}`);
      }
    } else {
      if (leadId) {
        parts.push(`${t("agent.leadIdLabel")} ${leadId}`);
      }
    }

    return parts.join(" / ") || (flow === "renewal" ? t("agent.client") : t("agent.lead"));
  }, [flow, clientName, clientId, leadId]);

  const handleLeadNavigation = () => {
    navigate(-1);
  };

  return (
    <div className="coverage__container">
      <div className="coverage__container__titles">
        {flow === "renewal" ? t("agent.client") : t("agent.leads")}
      </div>
      <div
        onClick={handleLeadNavigation}
        className="coverage__container__back__btn mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="coverage__container__back__btn__title">
          {displayTitle}
        </div>
      </div>
      <CoverageDetailsCard
        action={action}
        flow={flow}
        policyId={policyId}
        coInsurance={state?.coInsurance}
        installmentType={state?.installmentType}
        clientId={clientId}
        leadId={leadId}
        policyNumber={policyNumber}
      />
    </div>
  );
};

export default CoverageDeatails;
