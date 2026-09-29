import React from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import "./index.scss";
import SvgClientProfile from "../../../assets/agentIcon/SvgClientProfile";
import LeadCreationCard from "../leadCreation/leadCreationCard";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const LeadEdit = ({ flow, action }) => {
  const { t } = useTranslation();
  const { currentLeadDetails } = useSelector(
    ({ leadReducers }) => {
      return {
        currentLeadDetails: leadReducers?.currentLeadDetails,
      };
    }
  );
  const navigate = useNavigate();
  const handleClientNavigation = () => {
    if (flow == "lead") {
      navigate("/agent/leadlisting");
    } else if (flow === "client") {
      navigate("/agent/clientlisting");
    }
  };
  return (
    <div className="overall_leadedit_container">
      <div
        className="innerlead_container mt-3 cursor-pointer"
        onClick={handleClientNavigation}
      >
        <SvgLeftArrow />
        <div className="arrowlabel_txt">
          {flow === "lead" ? t("leadEdit.leads") : t("leadEdit.clients")}
        </div>
      </div>
      <div className="client__container mt-5">
        <div className="client__svg__container">
          {flow === "lead" && currentLeadDetails?.firstName ? (
            <div 
              style={{
                width: '65px',
                height: '65px',
                borderRadius: '50%',
                backgroundColor: '#FDB6B2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#D4635D'
              }}
            >
              {currentLeadDetails.firstName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <SvgClientProfile />
          )}
        </div>
        <div>
          <div className="client__profile__title">
            {flow === "lead" 
              ? `${currentLeadDetails?.firstName || ''} ${currentLeadDetails?.lastName || ''}`.trim() || t("leadEdit.loading")
              : "Carson Darrin"
            }
          </div>
          <div className="client__profile__id">
            {flow === "lead" ? `${t("leadEdit.leadId")} : ${currentLeadDetails?.generatedLeadId || currentLeadDetails?.leadId || t("leadEdit.loading")}` : `${t("leadEdit.clientId")} : 12345678`}
          </div>
        </div>
      </div>
      <LeadCreationCard flow={flow} action={action} />
    </div>
  );
};

export default LeadEdit;
