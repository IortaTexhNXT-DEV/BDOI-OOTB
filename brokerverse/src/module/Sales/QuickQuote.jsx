import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { PageHeader } from "../Placement/shared";
import { RFQ_PATH, entryOf, productOf, rfqState, useProductLines } from "./salesProducts";
import ProductPicker from "./ProductPicker";
import "../Placement/index.scss";
import "./index.scss";

/**
 * Sales & Marketing > Quick Quote: the active package products (Product master business type "package") to quote on
 * the spot, chosen by line of business, then product. A motor product opens the motor quote wizard, which starts with
 * the prospect's details (tagged with the product) and prices the vehicle from the motor tariff (own damage, CTPL, Auto
 * Passenger PA); any other package product is quoted through a Request for Quotation.
 */
const QuickQuote = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lines = useProductLines({ businessType: "package" });
  const [choice, setChoice] = useState({ lob: null, productId: null });
  const product = productOf(lines, choice.productId);
  const hasWizard = (p) => entryOf(p) === "motor";

  const start = (p) => {
    if (hasWizard(p)) navigate("/agent/createlead", { state: { product: { lob: p.lob, productId: p.id } } });
    else navigate(RFQ_PATH, { state: rfqState(p) });
  };

  return (
    <div className="placement-page quick-quote">
      <PageHeader title={t("salesMarketing.quickQuote.title")}>
        <Button label={t("salesMarketing.quickQuote.nonPackage")} icon="pi pi-send" outlined onClick={() => navigate(RFQ_PATH)} />
      </PageHeader>
      {lines && !lines.length ? (
        <div className="placement-card muted">{t("salesMarketing.quickQuote.none")}</div>
      ) : (
        <div className="placement-card quick-quote-picker">
          <p className="muted">{t("productPicker.quickQuoteHint")}</p>
          <ProductPicker value={choice} onChange={setChoice} lines={lines} idPrefix="quick-quote" required />
        </div>
      )}
      {product && (
        <div className="grid">
          <div className="col-12 md:col-6 xl:col-4">
            <div className="placement-card quick-quote-product h-full">
              <div className="quick-quote-product-head">
                <h3>{product.name}</h3>
                <Tag value={t(`productClassification.segments.${product.customerSegment || "both"}`)} severity="info" />
              </div>
              <p className="muted">{hasWizard(product) ? t("salesMarketing.quickQuote.wizard") : t("salesMarketing.quickQuote.noWizard")}</p>
              <Button
                label={hasWizard(product) ? t("salesMarketing.quickQuote.start") : t("salesMarketing.quickQuote.request")}
                icon={hasWizard(product) ? "pi pi-bolt" : "pi pi-send"}
                outlined={!hasWizard(product)}
                onClick={() => start(product)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickQuote;
