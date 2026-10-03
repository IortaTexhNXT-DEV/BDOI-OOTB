import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import InputTextField from "../../../component/inputText";
import DropdownField from "../../../component/DropdownField";
import DatepickerField from "../../../component/datePicker";
import { useFormik } from "formik";
import {
  CONSTRUCTION_TYPES,
  BUILDING_TYPES,
  EARTHQUAKE_ZONES,
  OCCUPANCY_TYPES,
  FIRE_PROTECTION_OPTIONS,
  SMI_ENTRY_FIELDS,
  COVER_CONFIG,
} from "../../../leadModule/FireLeadCreation/fireRiskConstants";
import InputNumberField from "../../../component/inputNumberField";
import useTaxRates from "../../../quoteModule/utils/useTaxRates";

const getSiForCover = (cover, vals) => {
  if (cover.smiGroupCode === "SMIGRP1") {
    const b = Number(vals.Building) || 0;
    const p = Number(vals.PlantAndMachinery) || 0;
    const o = Number(vals.OtherContents) || 0;
    return b + p + o;
  }
  if (cover.smiGroupCode === "SMIGRP2") return Number(vals.GrossProfit) || 0;
  if (cover.smiGroupCode === "SMIGRP3") return Number(vals.LossOfRent) || 0;
  return 0;
};

const computePremiumFromSi = (vals, vatRate) => {
  const coverBreakupComputed = COVER_CONFIG.map((cover) => {
    const si = getSiForCover(cover, vals);
    const rate = cover.rate || 0;
    const premium = si * (rate / 100);
    return { ...cover, si, premium: Math.round(premium * 100) / 100 };
  });
  const totalCoverPremium = coverBreakupComputed.reduce((s, c) => s + c.premium, 0);
  const vat = totalCoverPremium * vatRate;
  return { totalCoverPremium, valueAddedTax: vat };
};

const FireDetailsChange = ({
  index,
  disabled,
  shouldSubmit,
  onSectionSubmitted,
  fireDetails,
}) => {
  const { t } = useTranslation();
  const { valueAddedTax: vatRate } = useTaxRates();
  const quotation = fireDetails?.quotation || {};
  const fireRisk =
    fireDetails?.fireRiskDetails ||
    quotation?.fireRiskDetails ||
    quotation?.fireRisk ||
    {};
  const firePremium =
    fireDetails?.firePremiumDetails ||
    quotation?.firePremiumDetails ||
    quotation?.firePremium ||
    {};
  const lead = fireDetails?.lead || {};
  const coverBreakup = firePremium?.coverBreakup || [];
  const sumInsured = firePremium?.sumInsured || {};

  const siInitial = useMemo(
    () =>
      SMI_ENTRY_FIELDS.reduce((acc, f) => {
        acc[f.key] = sumInsured[f.key] ?? null;
        return acc;
      }, {}),
    [sumInsured]
  );

  const [siValues, setSiValues] = useState(siInitial);

  const initialValues = useMemo(
    () => ({
      FirstName: lead?.firstName || fireDetails?.insuredName?.split?.(" ")?.[0] || "",
      LastName: lead?.lastName || fireDetails?.insuredName?.split?.(" ")?.[1] || "",
      EmailID: lead?.emailId || "",
      ContactNumber: lead?.contactNumber || "",
      locationAddress: fireRisk?.locationAddress || "",
      natureOfBusiness: fireRisk?.natureOfBusiness || "",
      constructionType: fireRisk?.constructionType || "",
      buildingType: fireRisk?.buildingType || "",
      earthquakeZone: fireRisk?.earthquakeZone || "",
      occupancyType: fireRisk?.occupancyType || "",
      fireProtection: fireRisk?.fireProtection || "",
      noOfFloors: fireRisk?.noOfFloors ?? null,
      totalPremium: firePremium?.totalPremium ?? null,
      valueAddedTax: firePremium?.valueAddedTax ?? null,
      premiumDelta: null,
      effectiveDate: (() => {
        const raw =
          fireDetails?.effectiveDate ||
          fireDetails?.inception ||
          fireDetails?.issuedDate;
        if (!raw) return null;
        if (raw instanceof Date) return raw;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
      })(),
      ...siInitial,
    }),
    [fireDetails, fireRisk, firePremium, lead, siInitial]
  );

  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    onSubmit: (values) => {
      const totalPremium = Number(values.totalPremium) || 0;
      const oldTotal =
        Number(firePremium?.totalPremium) ||
        Number(fireDetails?.grossPremium) ||
        0;
      const premiumDelta = values.premiumDelta != null
        ? Number(values.premiumDelta)
        : totalPremium - oldTotal;

      const coverBreakupComputed = COVER_CONFIG.map((cover) => {
        const si = getSiForCover(cover, { ...siValues, ...values });
        const rate = cover.rate || 0;
        const premium = si * (rate / 100);
        return {
          coverDesc: cover.coverDesc,
          si,
          rate: `${rate}%`,
          premium: Math.round(premium * 100) / 100,
        };
      }).filter((c) => c.si > 0);

      const totalCoverPremium =
        coverBreakupComputed.reduce((s, c) => s + c.premium, 0) || totalPremium;
      const vat = Number(values.valueAddedTax) || totalCoverPremium * vatRate;

      onSectionSubmitted?.(index, {
        personalDetails: {
          FirstName: values.FirstName,
          LastName: values.LastName,
          EmailID: values.EmailID,
          ContactNumber: values.ContactNumber,
        },
        fireDetails: {
          fireRiskDetails: {
            locationAddress: values.locationAddress,
            natureOfBusiness: values.natureOfBusiness,
            constructionType: values.constructionType,
            buildingType: values.buildingType,
            earthquakeZone: values.earthquakeZone,
            occupancyType: values.occupancyType,
            fireProtection: values.fireProtection,
            noOfFloors: values.noOfFloors,
          },
          firePremiumDetails: {
            coverBreakup: coverBreakupComputed.length
              ? coverBreakupComputed
              : coverBreakup,
            totalPremium: totalCoverPremium || totalPremium,
            sumInsured: SMI_ENTRY_FIELDS.reduce((acc, f) => {
              const v = values[f.key] ?? siValues[f.key];
              if (v != null) acc[f.key] = Number(v) || 0;
              return acc;
            }, {}),
          },
        },
        coverageChanges: {
          valueAddedTax: vat,
          totalPremium: totalCoverPremium || totalPremium,
        },
        premiumDelta,
        effectiveDate: values.effectiveDate
          ? new Date(values.effectiveDate).toISOString().split("T")[0]
          : null,
      });
    },
  });

  useEffect(() => {
    if (!shouldSubmit) return;
    formik.submitForm();
  }, [formik, shouldSubmit]);

  return (
    <div>
      <div className="customer__info__subtitle mt-2 mb-2">
        {t("fireEndorsement.fireRegularPremiumChangeSubtitle")}
      </div>
      <div className="grid">
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputTextField
            label={t("fireEndorsement.firstName")}
            disabled={disabled}
            value={formik.values.FirstName}
            onChange={formik.handleChange("FirstName")}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputTextField
            label={t("fireEndorsement.lastName")}
            disabled={disabled}
            value={formik.values.LastName}
            onChange={formik.handleChange("LastName")}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputTextField
            label={t("fireEndorsement.email")}
            disabled={disabled}
            value={formik.values.EmailID}
            onChange={formik.handleChange("EmailID")}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputTextField
            label={t("fireEndorsement.contactNumber")}
            disabled={disabled}
            value={formik.values.ContactNumber}
            onChange={formik.handleChange("ContactNumber")}
          />
        </div>
        <div className="col-12 mt-2">
          <InputTextField
            label={t("fireEndorsement.locationAddress")}
            disabled={disabled}
            value={formik.values.locationAddress}
            onChange={formik.handleChange("locationAddress")}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputTextField
            label={t("fireEndorsement.natureOfBusiness")}
            disabled={disabled}
            value={formik.values.natureOfBusiness}
            onChange={formik.handleChange("natureOfBusiness")}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <DropdownField
            label={t("fireEndorsement.constructionType")}
            disabled={disabled}
            value={formik.values.constructionType}
            options={CONSTRUCTION_TYPES}
            onChange={(e) => formik.setFieldValue("constructionType", e.value)}
            optionLabel="label"
            optionValue="value"
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <DropdownField
            label={t("fireEndorsement.buildingType")}
            disabled={disabled}
            value={formik.values.buildingType}
            options={BUILDING_TYPES}
            onChange={(e) => formik.setFieldValue("buildingType", e.value)}
            optionLabel="label"
            optionValue="value"
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <DropdownField
            label={t("fireEndorsement.earthquakeZone")}
            disabled={disabled}
            value={formik.values.earthquakeZone}
            options={EARTHQUAKE_ZONES}
            onChange={(e) => formik.setFieldValue("earthquakeZone", e.value)}
            optionLabel="label"
            optionValue="value"
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <DropdownField
            label={t("fireEndorsement.occupancyType")}
            disabled={disabled}
            value={formik.values.occupancyType}
            options={OCCUPANCY_TYPES}
            onChange={(e) => formik.setFieldValue("occupancyType", e.value)}
            optionLabel="label"
            optionValue="value"
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <DropdownField
            label={t("fireEndorsement.fireProtection")}
            disabled={disabled}
            value={formik.values.fireProtection}
            options={FIRE_PROTECTION_OPTIONS}
            onChange={(e) => formik.setFieldValue("fireProtection", e.value)}
            optionLabel="label"
            optionValue="value"
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputNumberField
            label={t("fireEndorsement.noOfFloors")}
            disabled={disabled}
            value={formik.values.noOfFloors}
            onValueChange={(e) => formik.setFieldValue("noOfFloors", e.value)}
          />
        </div>
        {SMI_ENTRY_FIELDS.map((f) => (
          <div key={f.key} className="col-12 md:col-6 lg:col-6 mt-2">
            <InputTextField
              label={t(`fireLead.si${f.key}`)}
              disabled={disabled}
              type="number"
              inputMode="numeric"
              value={
                (() => {
                  const val = formik.values[f.key] ?? siValues[f.key];
                  return val === null || val === undefined || val === ""
                    ? ""
                    : String(val);
                })()
              }
              onChange={(e) => {
                const raw = e.target.value;
                const v = raw === "" ? null : parseFloat(raw);
                const numVal = Number.isNaN(v) ? null : v;
                formik.setFieldValue(f.key, numVal);
                setSiValues((prev) => ({ ...prev, [f.key]: numVal }));
                const nextSi = { ...formik.values, [f.key]: numVal };
                const { totalCoverPremium, valueAddedTax } =
                  computePremiumFromSi(nextSi, vatRate);
                formik.setFieldValue("totalPremium", totalCoverPremium);
                formik.setFieldValue("valueAddedTax", valueAddedTax);
              }}
            />
          </div>
        ))}
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputNumberField
            label={t("fireEndorsement.totalPremiumPhp")}
            disabled={disabled}
            value={formik.values.totalPremium}
            onValueChange={(e) => formik.setFieldValue("totalPremium", e.value)}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputNumberField
            label={t("fireEndorsement.valueAddedTaxPhp")}
            disabled={disabled}
            value={formik.values.valueAddedTax}
            onValueChange={(e) => formik.setFieldValue("valueAddedTax", e.value)}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <InputNumberField
            label={t("fireEndorsement.premiumDeltaPhp")}
            disabled={disabled}
            value={formik.values.premiumDelta}
            onValueChange={(e) => formik.setFieldValue("premiumDelta", e.value)}
            placeholder={t("fireEndorsement.premiumDeltaPlaceholder")}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <DatepickerField
            label={t("fireEndorsement.effectiveDate")}
            disabled={disabled}
            value={formik.values.effectiveDate}
            onChange={(e) => formik.setFieldValue("effectiveDate", e.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default FireDetailsChange;
