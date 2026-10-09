import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { PageHeader } from "../Placement/shared";
import { RFQ_PATH, entryOf, rfqState, useSalesProducts } from "./salesProducts";
import "../Placement/index.scss";
import "./index.scss";

/**
 * Sales & Marketing > Quick Quote: the active package products (Product master business type "package") to quote on
 * the spot. A motor product opens the motor quote wizard, which starts with the prospect's details and prices the
 * vehicle from the motor tariff (own damage, CTPL, Auto Passenger PA); any other package product is quoted through a
 * Request for Quotation.
 */
const QuickQuote = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const products = useSalesProducts({ businessType: "package" });
  const hasWizard = (p) => entryOf(p) === "motor";

  const start = (p) => {
    if (hasWizard(p)) navigate("/agent/createlead");
    else navigate(RFQ_PATH, { state: rfqState(p) });
  };

  return (
    <div className="placement-page quick-quote">
      <PageHeader title={t("salesMarketing.quickQuote.title")}>
        <Button label={t("salesMarketing.quickQuote.nonPackage")} icon="pi pi-send" outlined onClick={() => navigate(RFQ_PATH)} />
      </PageHeader>
      {products && !products.length && <div className="placement-card muted">{t("salesMarketing.quickQuote.none")}</div>}
      <div className="grid">
        {(products || []).map((p) => (
          <div key={p.id} className="col-12 md:col-6 xl:col-4">
            <div className="placement-card quick-quote-product h-full">
              <div className="quick-quote-product-head">
                <h3>{p.name}</h3>
                <Tag value={t(`productClassification.segments.${p.customerSegment || "both"}`)} severity="info" />
              </div>
              <p className="muted">{hasWizard(p) ? t("salesMarketing.quickQuote.wizard") : t("salesMarketing.quickQuote.noWizard")}</p>
              <Button
                label={hasWizard(p) ? t("salesMarketing.quickQuote.start") : t("salesMarketing.quickQuote.request")}
                icon={hasWizard(p) ? "pi pi-bolt" : "pi pi-send"}
                outlined={!hasWizard(p)}
                onClick={() => start(p)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickQuote;
