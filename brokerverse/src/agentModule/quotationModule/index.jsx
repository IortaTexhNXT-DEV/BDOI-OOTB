import { useState } from "react";
import { useTranslation } from "react-i18next";
import QuotationTable from "./quotationTable";
import "../quotationModule/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import SvgDot from "../../assets/agentIcon/SvgDots";
import ImportDialog from "../../components/ImportDialog";
import { useNavigate } from "react-router-dom";
import QuoteStatsCards from "../quoteModule/quoteListing/QuoteStatsCards";
import { RFQ_PATH, entryOf, rfqState } from "../../module/Sales/salesProducts";
import { prospectFormState } from "../leadModule/leadListing/useProspectStart";
import { ProductPickerDialog } from "../../module/Sales/ProductPicker";

/** Bulk upload: template and importer of the API (Data, Columns and Instructions sheets; failed rows listed). */
const UPLOAD_TARGETS = [{ label: "Quotations", templatePath: "/quotations/bulk-upload/template", uploadPath: "/quotations/bulk-upload" }];

const ClientListingCard = () => {
  const { t } = useTranslation();
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [choosingProduct, setChoosingProduct] = useState(false);
  const navigate = useNavigate();

  const items = [{ label: t("quotationPage.title") }];
  const Initiate = { label: t("sidebar.Operations") };

  const handleBulkUploadSuccess = () => {
    // Refresh the quotations table by updating key
    setRefreshKey((prev) => prev + 1);
  };

  // the product to quote (line of business, then product): motor and fire quotes start from a prospect, IAR and employee
  // benefits from their own forms, any other product from a Request for Quotation to the insurers
  const start = (p) => {
    setChoosingProduct(false);
    const entry = entryOf(p);
    if (entry === "motor" || entry === "fire") navigate("/agent/leadlisting");
    else if (entry === "iar") navigate("/agent/createlead/iar", { state: prospectFormState({ product: p }) });
    else if (entry === "eb") navigate("/agent/createlead/employee-benefit", { state: prospectFormState({ product: p }) });
    else navigate(RFQ_PATH, { state: rfqState(p) });
  };

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
            <Button label={t("quotationPage.createQuote")} icon="pi pi-plus" onClick={() => setChoosingProduct(true)} style={{ borderRadius: "8px" }} />
            <ProductPickerDialog visible={choosingProduct} onHide={() => setChoosingProduct(false)} onSelect={start}
              header={t("quotationPage.createQuote")} hint={t("productPicker.createQuoteHint")} />
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
      <ImportDialog
        visible={showBulkUpload}
        onHide={() => setShowBulkUpload(false)}
        title={t("bulkUploadQuotations.header")}
        targets={UPLOAD_TARGETS}
        onDone={handleBulkUploadSuccess}
      />
    </div>
  );
};

export default ClientListingCard;
