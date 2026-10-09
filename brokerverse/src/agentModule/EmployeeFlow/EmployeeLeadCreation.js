import React from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";
import { useNavigate } from "react-router-dom";
import { EmployeeCreationCard } from "./EmployeeCreationCard";
import NewProspectGate from "../leadModule/leadCreation/NewProspectGate";
 
const EmployeeLeadCreation = ({ flow, action }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };
  return (
    <>
      {action === "post" ?
        <NewProspectGate>
          <div className="overall_Leadcreat_container">
            <div onClick={handleLeadNavigation} className="innerlead_container mt-3 cursor-pointer">
              <SvgLeftArrow />
              <div className="arrowlabel_txt">{t("employeeBenefit.lead")} </div>
            </div>
            <EmployeeCreationCard flow={flow} action={action} />
          </div>
        </NewProspectGate>
        : <div>
          <EmployeeCreationCard flow={flow} action={action} />
        </div>
      }
    </>
  );
};

export default EmployeeLeadCreation;
