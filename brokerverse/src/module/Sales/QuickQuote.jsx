import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import placementService from "../../services/placementService";
import { notifyError } from "../../utility/dialogs";
import { PageHeader } from "../Placement/shared";
import "../Placement/index.scss";
import "./index.scss";

/**
 * Quote wizards built into the front end, by line of business. The motor wizard starts with the prospect's details
 * and prices the vehicle from the motor tariff (own damage, CTPL, Auto Passenger PA).
 */
const WIZARDS = { MOTOR: "/agent/createlead" };

/**
 * Sales & Marketing > Quick Quote: the package products (Product master business type "package") to quote on the
 * spot. A product with a quote wizard opens it; any other package product is quoted through a Request for Quotation.
 */
const QuickQuote = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);

  useEffect(() => {
    let alive = true;
    placementService
      .options({ businessType: "package" })
      .then((o) => alive && setProducts(o.products || []))
      .catch((e) => {
        notifyError(e.message);
        if (alive) setProducts([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const start = (p) => {
    const wizard = WIZARDS[p.lob];
    if (wizard) navigate(wizard);
    else navigate("/placement/broker-slips/new", { state: { prefill: { productId: p.id, productType: p.name } } });
  };

  return (
    <div className="placement-page quick-quote">
      <PageHeader title={t("salesMarketing.quickQuote.title")} subtitle={t("salesMarketing.quickQuote.subtitle")}>
        <Button label={t("salesMarketing.quickQuote.nonPackage")} icon="pi pi-send" outlined onClick={() => navigate("/placement/broker-slips/new")} />
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
              <p className="muted">{WIZARDS[p.lob] ? t("salesMarketing.quickQuote.wizard") : t("salesMarketing.quickQuote.noWizard")}</p>
              <Button
                label={WIZARDS[p.lob] ? t("salesMarketing.quickQuote.start") : t("salesMarketing.quickQuote.request")}
                icon={WIZARDS[p.lob] ? "pi pi-bolt" : "pi pi-send"}
                outlined={!WIZARDS[p.lob]}
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
