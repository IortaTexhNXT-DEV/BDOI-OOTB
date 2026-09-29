import { useState } from "react";
import { useTranslation } from "react-i18next";
import QuotationTable from "./quotationTable";
import "../quotationModule/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import SvgDot from "../../assets/agentIcon/SvgDots";
import SvgMotor from "../../assets/agentIcon/SvgMotor";
import SvgFire from "../../assets/agentIcon/SvgFire";
import SvgHome from "../../assets/agentIcon/SvgHome";
import BulkUploadModal from "./BulkUploadModal";
import { useNavigate } from "react-router-dom";
import QuoteStatsCards from "../quoteModule/quoteListing/QuoteStatsCards";

const ClientListingCard = () => {
  const { t } = useTranslation();
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const navigate = useNavigate();

  const items = [{ label: t("quotationPage.title"), url: "/agent/clientlisting" }];
  const Initiate = { label: t("quotationPage.home") };

  const handleBulkUploadSuccess = () => {
    // Refresh the quotations table by updating key
    setRefreshKey((prev) => prev + 1);
  };

  const handleCreateQuote = () => {
    // Navigate to lead listing to select a lead for quote creation
    navigate("/agent/leadlisting");
  };

  const handleCreateIarQuote = () => {
    navigate("/agent/createlead/iar");
  };

  const dropdownOptions = [
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => handleCreateQuote()}
        >
          <div>
            <SvgMotor />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("quotationPage.motorQuote")}
          </div>
        </div>
      ),
      value: "Motor",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => handleCreateQuote()}
        >
          <div>
            <SvgFire />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("quotationPage.fireAndAlliedPerils")}
          </div>
        </div>
      ),
      value: "FireAndAlliedPerils",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => handleCreateIarQuote()}
        >
          <div>
            <SvgHome />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("quotationPage.industrialAllRisks", "Industrial All Risks")}
          </div>
        </div>
      ),
      value: "IndustrialAllRisks",
    },
  ];

  return (
    <div className="claim__table__container__quotation mt-4">
      <div className="grid mt-3">
        <div className="col-12 md:col-6 lg:col-6">
          <label className="leadlisting__overal__container__title">
            {t("quotationPage.title")}
          </label>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums  bg-transparent"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Button
              label={t("quotationPage.bulkUpload")}
              className="p-button-outlined"
              onClick={() => setShowBulkUpload(true)}
              style={{ borderRadius: "8px" }}
            />
            <Dropdown
              value={selectedOption}
              options={dropdownOptions}
              placeholder={t("quotationPage.createQuote")}
              className="dropdown__createlead"
              style={{
                minWidth: "150px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
              }}
              onChange={(e) => {
                setSelectedOption(e.value);
                if (e.value === "IndustrialAllRisks") {
                  handleCreateIarQuote();
                } else if (e.value === "Motor" || e.value === "FireAndAlliedPerils") {
                  handleCreateQuote();
                }
                setSelectedOption(null);
              }}
            />
          </div>
        </div>
        <div
          className="col-12 md:col-12 lg:col-12 scroll-container"
          style={{ overflowY: "auto", height: "100%" }}
        >
          <QuoteStatsCards leadRefId={null} />
          {/* <Card style={{ borderRadius: "20px", width: "100%" }}> */}
          <div className="bg-white shadow-md border border-gray-200 rounded-2xl p-4">
            {" "}
            <QuotationTable key={refreshKey} />
          </div>

          {/* </Card> */}
        </div>
      </div>
      <BulkUploadModal
        visible={showBulkUpload}
        onHide={() => setShowBulkUpload(false)}
        onUploadSuccess={handleBulkUploadSuccess}
      />
    </div>
  );
};

export default ClientListingCard;
