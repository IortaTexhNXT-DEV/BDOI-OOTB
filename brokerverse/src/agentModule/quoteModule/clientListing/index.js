import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgAdd from "../../../assets/agentIcon/SvgAdd"
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import ClientListingCard from "./clientListingCard";
import { Dropdown } from "primereact/dropdown";
import SvgMotor from "../../../assets/agentIcon/SvgMotor";
import SvgTravel from "../../../assets/agentIcon/SvgTravel";
import SvgHome from "../../../assets/agentIcon/SvgHome";
import SvgFire from "../../../assets/agentIcon/SvgFire";
import { useNavigate } from "react-router-dom";
import { canOpen } from "../../../utils/canOpen";

const ClientListing = () => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState(null);
  const navigate = useNavigate();

  const items = [
    { label: t("clients.title") },
  ];
  const Initiate = { label: t("sidebar.Operations") };
  // only roles that may open Leads/Prospects are offered "Create Lead" (claims users view clients only)
  const canCreateLead = canOpen("/agent/createlead");

  const dropdownOptions = [
    {
      label: <div style={{ display: "flex",alignItems:"center",gap:"10px" }} onClick={()=>{handleClickMotor()}}>
        <div><SvgMotor /></div>
        <div
          style={{
            fontFamily: "Nunito, Arial, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: "#111927",
            width: "100%",
          }}
        >
          {t("dashboard.Motor")}
        </div>
      </div>,
      value: 'Motor'
    },
    {
      label: <div style={{ display: "flex",alignItems:"center",gap:"10px" }} onClick={()=>{handleClickFireAndAlliedPerils()}}>
        <div><SvgFire /></div>
        <div
          style={{
            fontFamily: "Nunito, Arial, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: "#111927",
            width: "100%",
          }}
        >
          {t("dashboard.Fire and Allied Perils")}
        </div>
      </div>,
      value: 'FireAndAlliedPerils'
    },
    {
      label: <div style={{ display: "flex",alignItems:"center",gap:"10px" }}>
        <div><SvgTravel /></div>
        <div
          style={{
            fontFamily: "Nunito, Arial, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: "#111927",
            width: "100%",
          }}
        >
          {t("dashboard.Travel")}
        </div>
      </div>,
      value: 'Travel'
    },
    {
      label: <div style={{ display: "flex",alignItems:"center",gap:"10px" }}>
        <div><SvgHome /></div>
        <div
          style={{
            fontFamily: "Nunito, Arial, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: "#111927",
            width: "100%",
          }}
        >
          {t("dashboard.Property")}
        </div>
      </div>, value: 'Property'
    },
  ];


  const handleClickMotor = () =>{
    navigate("/agent/createlead")
  }

  const handleClickFireAndAlliedPerils = () => {
    navigate("/agent/createlead/fire-allied-perils");
  }


  return (
    <div className="clientlisting__overal__container">

      <div className="grid mt-3">
        <div className="col-12 md:col-6 lg:col-6">
          <label className="leadlisting__overal__container__title">{t("clients.title")}</label>
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className="btn_lable_save_container">
            {canCreateLead && (
            <Dropdown
              value={selectedOption}
              options={dropdownOptions}
              onChange={(e) => {
                setSelectedOption(e.value);
                if (e.value === "Motor") {
                  handleClickMotor();
                } else if (e.value === "FireAndAlliedPerils") {
                  handleClickFireAndAlliedPerils();
                }
              }}
              placeholder={t("clients.createLead")}
              dropdownIcon={<SvgAdd />}
            />
            )}
          </div>
        </div>
      </div>
      <div>
        <BreadCrumb
          model={items}
          home={Initiate}
          className="breadCrums"
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>
      <ClientListingCard />
    </div>);
};

export default ClientListing;
