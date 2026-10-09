import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import LeadCreationCard from "./leadCreationCard";
import { useNavigate } from "react-router-dom";
import LeadEdit from "../leadEdit";
import NewProspectGate from "./NewProspectGate";

const LeadCreation = ({ flow, action }) => {
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
              <div className="arrowlabel_txt">{t("leadCreation.lead")}</div>
            </div>
            <LeadCreationCard flow={flow} action={action} />
          </div>
        </NewProspectGate>
        : <div>
          <LeadEdit flow={flow} action={action} /><LeadCreationCard flow={flow} action={action} />
        </div>
      }
    </>
  );
};

export default LeadCreation;
