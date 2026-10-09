import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgAdd from "../../../assets/agentIcon/SvgAdd"
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import ClientListingCard from "./clientListingCard";
import { Dropdown } from "primereact/dropdown";
import SvgMotor from "../../../assets/agentIcon/SvgMotor";
import SvgHome from "../../../assets/agentIcon/SvgHome";
import SvgFire from "../../../assets/agentIcon/SvgFire";
import { useNavigate } from "react-router-dom";
import { canOpen, hasPermission } from "../../../utils/canOpen";
import { Button } from "primereact/button";
import { RFQ_PATH, entryOf, rfqState, useSalesProducts } from "../../../module/Sales/salesProducts";

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

  // "Create Lead": one choice per active product of the Product master, opening the screen the product is quoted on
  const products = useSalesProducts({ enabled: canCreateLead });
  const forms = { motor: "/agent/createlead", fire: "/agent/createlead/fire-allied-perils", iar: "/agent/createlead/iar", eb: "/agent/createlead/employee-benefit" };
  const icons = { motor: <SvgMotor />, fire: <SvgFire />, iar: <SvgHome /> };
  const createLead = (p) => {
    const form = forms[entryOf(p)];
    if (form) navigate(form);
    else navigate(RFQ_PATH, { state: rfqState(p, { newProspect: true }) });
  };
  const dropdownOptions = (products || []).map((p) => ({
    value: p.id,
    label: (
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div>{icons[entryOf(p)] || <i className="pi pi-send" />}</div>
        <div
          style={{
            fontFamily: "Nunito, Arial, sans-serif",
            fontWeight: 400,
            fontSize: "16px",
            color: "#111927",
            width: "100%",
          }}
        >
          {p.name}
        </div>
      </div>
    ),
  }));

  return (
    <div className="clientlisting__overal__container">

      <div className="grid mt-3">
        <div className="col-12 md:col-6 lg:col-6">
          <label className="leadlisting__overal__container__title">{t("clients.title")}</label>
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className="btn_lable_save_container">
            {/* client onboarding before the first policy (customer due diligence, write:clients) */}
            {hasPermission("write:clients") && (
              <Button icon="pi pi-user-plus" label={t("onboarding.onboardButton")} className="mr-2" onClick={() => navigate("/agent/client-onboarding")} />
            )}
            {canCreateLead && (
            <Dropdown
              value={selectedOption}
              options={dropdownOptions}
              onChange={(e) => {
                setSelectedOption(null);
                const product = (products || []).find((p) => p.id === e.value);
                if (product) createLead(product);
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
