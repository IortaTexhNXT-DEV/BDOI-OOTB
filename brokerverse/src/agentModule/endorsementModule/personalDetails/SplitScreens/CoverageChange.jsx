import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import CalculaitionTextInputs from "../../../component/calculaitionTextInputs";
import InputTextField from "../../../component/inputText";
import DropdownField from "../../../component/DropdownField";
import {
  computeAllPremiums,
  getTaxRates,
} from "../../../quoteModule/utils/premiumCalculations";
import { parseNumericValue } from "../../../quoteModule/utils/quotationDataTransform";
import useTaxRates from "../../../quoteModule/utils/useTaxRates";
import { formatNumber } from "../../../../utility/currencyConverter";
import useMotorTariff, { appaFigures, findVehicleClass } from "../../../quoteModule/utils/useMotorTariff";
import { amountOptions, bodilyInjuryOptions, propertyDamageOptions } from "../../../../utility/quoteOptions";

/** Inputs that drive the premium: a change to any of them re-prices the cover. */
const PRICING_INPUTS = [
  "LossandDamagecoverage",
  "LossandDamagecoverageRate",
  "ActsofNatureRate",
  "BodilyInjury",
  "PropertyDamage",
  "AutopassengerpersonalAccident",
  "Discount",
  "OthersPremium",
];

/** Cents rounding, the same as the server (premium.js) so the premium change matches its price. */
const round2 = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => round2(n).toFixed(2);
/** Decimal tax rate (0.0075) as a percentage label (0.75). */
const percentOf = (rate) => Number((Number(rate || 0) * 100).toFixed(4));

/** Numeric fingerprint of the pricing inputs ("1,200,000" and 1200000 are the same). */
const pricingKey = (details) =>
  PRICING_INPUTS.map((k) => parseNumericValue(details?.[k])).join("|");

/**
 * Dropdown options plus the stored amount when it is not one of them, and the option value that matches the stored
 * amount whatever its grouping ("2,00,000", 200000 and "200,000" all select 200,000).
 */
const withStoredAmount = (options, stored) => {
  if (stored === undefined || stored === null || stored === "") {
    return { options, value: "" };
  }
  const amount = parseNumericValue(stored);
  const hit = options.find((o) => parseNumericValue(o.value) === amount);
  if (hit) return { options, value: hit.value };
  const extra = { label: formatNumber(amount), value: formatNumber(amount) };
  return { options: [...options, extra], value: extra.value };
};

/**
 * Price the coverage like the quotation (quoteModule/utils/premiumCalculations): cover premiums from the policy's own
 * rates (defaults for BI / PD / APPA), flat premiums kept where a cover has no sum insured or rate, taxes at the
 * configured rates, each rounded to cents.
 */
const priceCoverage = (details, taxRates, fallbackOwnDamageRate, appaTerms = {}) => {
  const odRate = details.LossandDamagecoverageRate || fallbackOwnDamageRate || "";
  const c = computeAllPremiums({
    lossAndDamageCoverage: details.LossandDamagecoverage,
    lossAndDamageCoverageRate: odRate,
    actsOfNatureRate: details.ActsofNatureRate || 0,
    ctplCoverageRate: details.CtplCoverageRate || 0,
    roadsideAssistanceRate: details.RoadsideAssistanceRate || 0,
    personalAccidentCoverRate: details.PersonalAccidentCoverRate || 0,
    bodilyInjury: details.BodilyInjury,
    bodilyInjuryRate: details.BodilyInjuryRate,
    propertyDamage: details.PropertyDamage,
    propertyDamageRate: details.PropertyDamageRate,
    autoPassengerPersonalAccident: details.AutopassengerpersonalAccident,
    appaSeats: appaTerms.seats,
    appaRatePercent: appaTerms.tariff?.appa?.ratePercent,
  });
  // a cover without a basis keeps the premium the policy has for it
  const keep = (basis, computed, existing) =>
    parseNumericValue(basis) ? computed : existing || computed;
  const aon = keep(details.ActsofNatureRate, c.actsOfNaturePremium, details.ActsofNaturepremium);
  const bi = keep(details.BodilyInjury, c.bodilyInjuryCoveragePremium, details.BodilyInjuryCoveragePremium);
  const pd = keep(details.PropertyDamage, c.propertyDamageCoveragePremium, details.PropertyDamageCoveragePremium);
  // CTPL stays as issued; Auto Passenger PA keeps its premium unless its limit per person changes (as the server does).
  const appaChanged =
    parseNumericValue(details.AutopassengerpersonalAccident) !== parseNumericValue(appaTerms.issuedPerPerson);
  const appaNew = appaFigures(appaTerms.tariff, details.AutopassengerpersonalAccident, appaTerms.seats);
  const appa = appaChanged ? appaNew.premium : details.APPAcoveragePremium;
  const appaTotal = appaChanged ? appaNew.total : details.APPATotalCoverage;
  const ra = keep(details.RoadsideAssistanceRate, c.roadsideAssistancePremium, details.RoadsideAssistancePremium);
  const pac = keep(details.PersonalAccidentCoverRate, c.personalAccidentCoverPremium, details.PersonalAccidentCoverPremium);
  const net = round2(
    [c.lossAndDamageCoveragePremium, aon, c.ctplCoveragePremium, ra, pac, bi, pd, appa]
      .map((v) => round2(parseNumericValue(v)))
      .reduce((s, v) => s + v, 0)
  );
  const vat = round2(net * taxRates.valueAddedTax);
  const dst = round2(net * taxRates.documentaryStampTax);
  const lgt = round2(net * taxRates.localGovernmentTax);
  const others = round2(parseNumericValue(details.OthersPremium));
  const discount = round2(parseNumericValue(details.Discount));
  const gross = Math.max(0, round2(net + vat + dst + lgt + others - discount));
  return {
    ...details,
    LossandDamagecoverageRate: odRate,
    LossandDamagecoveragepremium: money(parseNumericValue(c.lossAndDamageCoveragePremium)),
    ActsofNaturepremium: money(parseNumericValue(aon)),
    BodilyInjuryCoveragePremium: money(parseNumericValue(bi)),
    PropertyDamageCoveragePremium: money(parseNumericValue(pd)),
    APPATotalCoverage: money(parseNumericValue(appaTotal)),
    APPAcoveragePremium: money(parseNumericValue(appa)),
    TotalSumInsured: money(
      parseNumericValue(details.LossandDamagecoverage) +
        parseNumericValue(details.BodilyInjury) +
        parseNumericValue(details.PropertyDamage) +
        parseNumericValue(appaTotal)
    ),
    NETpremium: money(net),
    ValueAddedTax: money(vat),
    DocumentaryStampTax: money(dst),
    LocalGovtTax: money(lgt),
    OthersPremium: money(others),
    Discount: money(discount),
    Grosspremium: money(gross),
  };
};

const CoverageChange = ({
  disabled,
  vehicleType,
  seatingCapacity,
  productConfigurator,
  coverageDetails,
  setCoverageDetails,
  currentGrossPremium,
  index,
  shouldSubmit,
  onSectionSubmitted,
}) => {
  const { t } = useTranslation();
  const premiumRates = productConfigurator?.configuration?.premiumRates;
  const motorTariff = useMotorTariff();
  const vehicleClassInfo = findVehicleClass(motorTariff, vehicleType);
  const vehicleCode = vehicleClassInfo?.value || vehicleType;
  const appaSeats = Number(seatingCapacity) || vehicleClassInfo?.defaultSeats || 0;
  // same tax source as the quotation: the premium tax and charge engine (Premium Taxes & LGU Rates)
  const settingsTaxRates = useTaxRates();
  const taxRates = useMemo(
    () => getTaxRates(productConfigurator, settingsTaxRates),
    [productConfigurator, settingsTaxRates]
  );

  const policyKey =
    coverageDetails.policyId ||
    coverageDetails.policyNumber ||
    (coverageDetails.LossandDamagecoverage ? "policy" : "");
  const key = pricingKey(coverageDetails);
  // pricing inputs as loaded from the policy, and as last priced
  const loadedRef = useRef({ policy: null, key: null });
  const pricedKeyRef = useRef(null);

  useEffect(() => {
    if (!policyKey) return; // policy not loaded yet
    if (loadedRef.current.policy !== policyKey) {
      // the policy's own figures stand until the user edits a pricing input
      loadedRef.current = { policy: policyKey, key, appa: coverageDetails.AutopassengerpersonalAccident };
      pricedKeyRef.current = key;
      return;
    }
    if (key === pricedKeyRef.current) return;
    pricedKeyRef.current = key;
    setCoverageDetails(
      priceCoverage(coverageDetails, taxRates, premiumRates?.[vehicleCode], {
        tariff: motorTariff,
        seats: appaSeats,
        issuedPerPerson: loadedRef.current.appa,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyKey, key]);

  // tax rates arriving after an edit re-price with the right rates
  useEffect(() => {
    if (!policyKey || pricedKeyRef.current === loadedRef.current.key) return;
    setCoverageDetails(
      priceCoverage(coverageDetails, taxRates, premiumRates?.[vehicleCode], {
        tariff: motorTariff,
        seats: appaSeats,
        issuedPerPerson: loadedRef.current.appa,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxRates]);

  // Handle form submission: the parent keeps the edited coverage (sectionValuesRef[index])
  useEffect(() => {
    if (shouldSubmit && onSectionSubmitted) {
      onSectionSubmitted(index, coverageDetails);
    }
  }, [shouldSubmit, onSectionSubmitted, index, coverageDetails]);

  const setField = useCallback(
    (field, value) => setCoverageDetails({ ...coverageDetails, [field]: value }),
    [coverageDetails, setCoverageDetails]
  );

  // Limits offered come from Master > Configuration (quote.bodily_injury_limits / quote.property_damage_limits)
  const bodilyInjury = withStoredAmount(bodilyInjuryOptions(), coverageDetails.BodilyInjury);
  const propertyDamage = withStoredAmount(propertyDamageOptions(), coverageDetails.PropertyDamage);
  const appa = withStoredAmount(
    amountOptions(motorTariff.appa.limits),
    coverageDetails.AutopassengerpersonalAccident
  );

  const text = (v) => (v === undefined || v === null ? "" : String(v));
  const premiumChange =
    coverageDetails.Grosspremium !== "" && coverageDetails.Grosspremium !== undefined
      ? round2(parseNumericValue(coverageDetails.Grosspremium) - parseNumericValue(currentGrossPremium))
      : 0;
  const premiumChangeLabel =
    premiumChange > 0
      ? t("endorsement.additionalPremium", "Additional premium")
      : premiumChange < 0
      ? t("endorsement.returnPremium", "Return premium")
      : t("endorsement.premiumChange", "Premium change");

  const half = "col-12 md:col-6 lg:col-6 xl:col-6 mt-2";
  const readOnly = (label, value) => (
    <InputTextField readOnly label={label} value={text(value)} />
  );

  return (
    <div>
      <div className="customer__info__subtitle mt-2 mb-2">{t("endorsement.coverageChange")}</div>
      <div className="grid">
        <div className="col-12 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.ownDamageCoverage")}
            value={text(coverageDetails.LossandDamagecoverage)}
            keyfilter="num"
            onChange={(e) => setField("LossandDamagecoverage", e.target.value)}
          />
        </div>
        <div className={half}>
          {readOnly(t("endorsement.ownDamageCoverageRate"), coverageDetails.LossandDamagecoverageRate)}
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.ownDamageCoveragePremium")}
            value={coverageDetails.LossandDamagecoveragepremium}
          />
        </div>
        <div className={half}>
          {readOnly(t("endorsement.actsOfNatureRate", "Acts of nature rate"), coverageDetails.ActsofNatureRate)}
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.actsOfNaturePremium")}
            value={coverageDetails.ActsofNaturepremium}
          />
        </div>
        <div className="col-12 mt-2">
          {/* CTPL is a fixed tariff premium: it stays as issued for the rest of the term. */}
          <CalculaitionTextInputs
            label={t("endorsement.ctplPremiumAsIssued", "CTPL premium (as issued)")}
            value={text(coverageDetails.CtplCoverageRate) || "-"}
          />
        </div>
        <div className={half}>
          <DropdownField
            disabled={disabled}
            label={t("endorsement.bodilyInjury", "Bodily injury")}
            value={bodilyInjury.value}
            options={bodilyInjury.options}
            onChange={(e) => setField("BodilyInjury", e.value)}
            optionLabel="label"
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.bodilyInjuryCoveragePremium")}
            value={coverageDetails.BodilyInjuryCoveragePremium}
          />
        </div>
        <div className={half}>
          <DropdownField
            disabled={disabled}
            label={t("endorsement.propertyDamage")}
            value={propertyDamage.value}
            options={propertyDamage.options}
            onChange={(e) => setField("PropertyDamage", e.value)}
            optionLabel="label"
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.propertyDamageCoveragePremium", "Property damage coverage premium")}
            value={coverageDetails.PropertyDamageCoveragePremium}
          />
        </div>
        <div className="col-12 mt-2">
          <DropdownField
            label={t("endorsement.autoPassengerPersonalAccident", "Auto passenger personal accident")}
            disabled={disabled}
            value={appa.value}
            options={appa.options}
            onChange={(e) => setField("AutopassengerpersonalAccident", e.value)}
            optionLabel="label"
          />
        </div>
        <div className={half}>
          {readOnly(t("endorsement.appaTotalCoverage"), coverageDetails.APPATotalCoverage)}
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.appaCoveragePremium", "APPA coverage premium")}
            value={coverageDetails.APPAcoveragePremium}
          />
        </div>
        <div className="col-12 mt-2">
          <CalculaitionTextInputs
            label={t("endorsement.totalSumInsured", "Total Sum Insured")}
            value={coverageDetails.TotalSumInsured}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.netPremium")}
            value={coverageDetails.NETpremium}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={`${t("endorsement.valueAddedTax", "Value Added Tax")} ( ${percentOf(taxRates.valueAddedTax)}% )`}
            value={coverageDetails.ValueAddedTax}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.othersAccPremium", "Others(Acc. premium)")}
            value={coverageDetails.OthersPremium}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={`${t("endorsement.documentaryStampTax", "Documentary Stamp Tax")} ( ${percentOf(taxRates.documentaryStampTax)}% )`}
            value={coverageDetails.DocumentaryStampTax}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={`${t("endorsement.localGovtTax", "Local Gov’t Tax")} ( ${percentOf(taxRates.localGovernmentTax)}% )`}
            value={coverageDetails.LocalGovtTax}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.discount")}
            value={coverageDetails.Discount}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.others")}
            value={coverageDetails.Others}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={t("endorsement.grossPremium")}
            value={coverageDetails.Grosspremium}
          />
        </div>
        <div className={half}>
          <CalculaitionTextInputs
            label={premiumChangeLabel}
            value={money(premiumChange)}
          />
        </div>
      </div>
    </div>
  );
};

export default CoverageChange;
