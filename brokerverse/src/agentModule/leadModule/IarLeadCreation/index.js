import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "../leadCreation/index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { useNavigate, useLocation } from "react-router-dom";
import IarLeadCreationCard from "./IarLeadCreationCard";

const IarLeadCreation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const leadRefIdFromState = location.state?.leadRefId || location.state?.leadId;

  const handleLeadNavigation = () => {
    if (leadRefIdFromState) {
      navigate(`/agent/quotelisting?leadRefId=${leadRefIdFromState}`);
    } else {
      navigate("/agent/leadlisting");
    }
  };

  return (
    <div className="overall_Leadcreat_container">
      {step !== 4 && (
        <div
          onClick={handleLeadNavigation}
          className="innerlead_container mt-3 cursor-pointer"
        >
          <SvgLeftArrow />
          <div className="arrowlabel_txt">{t("iarLead.lead", "Lead")}</div>
        </div>
      )}
      <IarLeadCreationCard step={step} onStepChange={setStep} />
    </div>
  );
};

export default IarLeadCreation;
