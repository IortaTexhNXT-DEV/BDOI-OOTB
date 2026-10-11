import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router-dom";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import { useSelector } from "react-redux";
import DetailHeader from "../../../../components/DetailHeader";
import DetailSection from "../../../../components/DetailSection";
import KeyValueGrid from "../../../../components/KeyValueGrid";
import { RecordActivityLog } from "../../../../components/ActivityLog";

// a currency as "EUR · Euro"
const currencyText = (code, description) => [code, description].filter(Boolean).join(" · ");

/** Master > Finance > Exchange Rate > View: the rate as a record (its facts once, read only) with its history. */
function ViewExchange() {
  const { t } = useTranslation();
  const { ExchangeDetailView } = useSelector(({ exchangeMasterReducer }) => ({
    ExchangeDetailView: exchangeMasterReducer?.ExchangeDetailView || {},
  }));
  const navigate = useNavigate();
  const r = ExchangeDetailView;

  const home = { label: t("financeMasters.master") };
  const items = [
    { label: t("financeMasters.exchangeRate"), url: "/master/finance/exchangerate" },
    { label: t("financeMasters.viewExchangeRate") },
  ];

  return (
    <div className="overall__viewexchange__container">
      <div className="flex align-items-center gap-2">
        <button type="button" className="p-link" onClick={() => navigate(-1)} aria-label={t("common.back")}><SvgBackicon /></button>
        <label className="label_header">{t("financeMasters.exchangeRateDetails")}</label>
      </div>
      <BreadCrumb model={items} home={home} className="breadcrumbs_container" separatorIcon={<SvgDot color="currentColor" />} />

      <Card>
        <DetailHeader title={`${r.CurrencyCode || ""} → ${r.ToCurrencyCode || ""}`} />
        <DetailSection title={t("financeMasters.exchangeRateDetails")}>
          <KeyValueGrid columns={3} items={[
            { label: t("financeMasters.fromCurrency"), value: currencyText(r.CurrencyCode, r.CurrencyDescription) },
            { label: t("financeMasters.toCurrency"), value: currencyText(r.ToCurrencyCode, r.ToCurrencyDescription) },
            { label: t("financeMasters.exchangeRate"), value: r.ExchangeRate, type: "number", decimals: 6 },
            { label: t("financeMasters.effectiveFrom"), value: r.EffectiveFrom, type: "date" },
            { label: t("financeMasters.effectiveTo"), value: r.EffectiveTo, type: "date" },
          ]} />
        </DetailSection>
        {r.id ? (
          <DetailSection title={t("detailView.activity")}>
            <RecordActivityLog entity="master:exchange-rate" recordId={r.id} />
          </DetailSection>
        ) : null}
      </Card>
    </div>
  );
}

export default ViewExchange;
