import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import ClientListingCard from "./clientListingCard";
import { useNavigate } from "react-router-dom";
import { canOpen, hasPermission } from "../../../utils/canOpen";
import { Button } from "primereact/button";
import useProspectStart from "../../leadModule/leadListing/useProspectStart";
import { ProductPickerDialog } from "../../../module/Sales/ProductPicker";

const ClientListing = () => {
  const { t } = useTranslation();
  const [choosingProduct, setChoosingProduct] = useState(false);
  const navigate = useNavigate();

  const items = [
    { label: t("clients.title") },
  ];
  const Initiate = { label: t("sidebar.Operations") };
  // only roles that may open Leads/Prospects are offered "Create Lead" (claims users view clients only)
  const canCreateLead = canOpen("/agent/createlead");

  // "Create Lead": the line of business and product open the screen the product is quoted on, tagged with the product;
  // Skip - tag product later opens the prospect form without a product
  const { openProduct, skipProduct, productRequired } = useProspectStart();
  const createLead = (p) => {
    setChoosingProduct(false);
    openProduct(p);
  };
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
              <>
                <Button icon="pi pi-plus" label={t("clients.createLead")} onClick={() => setChoosingProduct(true)} />
                <ProductPickerDialog visible={choosingProduct} onHide={() => setChoosingProduct(false)} onSelect={createLead}
                  onSkip={productRequired ? undefined : () => skipProduct()}
                  header={t("clients.createLead")} hint={t("productPicker.createLeadHint")} />
              </>
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
