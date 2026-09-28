import React, { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import CalculaitionTextInputs from "../../../component/calculaitionTextInputs";
import InputTextField from "../../../component/inputText";
import DropdownField from "../../../component/DropdwonField";
import {
  computeAllPremiums,
  calculatePremiumBreakdown,
} from "../../../quoteModule/utils/premiumCalculations";
import {
  AutopassengerpersonalAccidentOptions,
  BodilyInjuryOptions,
  PropertyDamageOptions,
} from "../../../quoteModule/coverageDetails/coverageDetailsCard/mock";

const CoverageChange = ({
  disabled,
  vehicleType,
  productConfigurator,
  coverageDetails,
  setCoverageDetails,
  index,
  shouldSubmit,
  onSectionSubmitted,
}) => {
  const { t } = useTranslation();
  const dat = productConfigurator?.configuration || {};
  const { premiumRates, taxes } = dat;

  // Track if data has been initialized (loaded from parent)
  const isDataInitialized = useRef(false);

  // Track if premium data already exists (check once when data is loaded)
  const hasExistingPremiumData = useRef(false);

  // Track previous values to detect user changes
  const prevValuesRef = useRef(null);

  // Handle automatic calculation when coverage details change
  const handleCalculation = useCallback(
    (currentCoverageDetails) => {
      // Calculate all premiums based on coverage, rates, and sum insured
      // Map PascalCase form fields to camelCase for computeAllPremiums
      const computed = computeAllPremiums({
        lossAndDamageCoverage: currentCoverageDetails.LossandDamagecoverage,
        lossAndDamageCoverageRate:
          currentCoverageDetails.LossandDamagecoverageRate ||
          premiumRates[vehicleType],
        actsOfNatureRate:
          currentCoverageDetails.ActsofNatureRate ||
          premiumRates?.acts_of_nature ||
          "0",
        ctplCoverageRate:
          currentCoverageDetails.CtplCoverageRate ||
          productConfigurator?.configuration?.ctplSetting?.[vehicleType] ||
          premiumRates?.ctplCoverageRate ||
          "0",
        roadsideAssistanceRate: premiumRates?.roadsideAssistanceRate || "0",
        personalAccidentCoverRate:
          premiumRates?.personalAccidentCoverRate || "0",
        bodilyInjury: currentCoverageDetails.BodilyInjury,
        propertyDamage: currentCoverageDetails.PropertyDamage,
        APPAtotalCoverage: currentCoverageDetails.APPATotalCoverage,
        autoPassengerPersonalAccident:
          currentCoverageDetails.AutopassengerpersonalAccident,
      });

      // Calculate full premium breakdown including taxes and gross premium
      const breakdown = calculatePremiumBreakdown(
        {
          ...computed,
          discount: currentCoverageDetails.Discount || "0",
        },
        productConfigurator
      );

      // Validate gross premium vs sum insured
      const sumInsuredNum = parseFloat(computed.totalSumInsured) || 0;
      const grossPremiumNum = parseFloat(breakdown.grossPremium) || 0;
      if (sumInsuredNum > 0 && grossPremiumNum > 0) {
        const premiumRatio = (grossPremiumNum / sumInsuredNum) * 100;
        if (premiumRatio > 10) {
          console.warn(
            `⚠️ [Coverage Change] Gross Premium (${
              breakdown.grossPremium
            }) is ${premiumRatio.toFixed(2)}% of Sum Insured (${
              computed.totalSumInsured
            }). This seems unusually high (>10%). Expected range: 1-5%.`
          );
        } else {
          console.log(
            `[Coverage Change] Premium ratio: ${premiumRatio.toFixed(
              2
            )}% (within expected range)`
          );
        }
      }

      // Map computed camelCase results back to PascalCase for the form
      const updatedCoverageDetails = {
        ...currentCoverageDetails,
        LossandDamagecoveragepremium: computed.lossAndDamageCoveragePremium,
        ActsofNaturepremium: computed.actsOfNaturePremium,
        CtplCoverageRate:
          computed.ctplCoverageRate ||
          currentCoverageDetails.CtplCoverageRate ||
          "",
        BodilyInjuryCoveragePremium: computed.bodilyInjuryCoveragePremium,
        PropertyDamageCoveragePremium: computed.propertyDamageCoveragePremium,
        APPACoveragePremium: computed.APPAcoveragePremium,
        TotalSumInsured: computed.totalSumInsured,
        NETpremium: breakdown.netPremium,
        ValueAddedTax: breakdown.valueAddedTax,
        DocumentaryStampTax: breakdown.documentaryStampTax,
        LocalGovtTax: breakdown.localGovernmentTax,
        OthersPremium: breakdown.accountPremiumOthers,
        Grosspremium: breakdown.grossPremium,
        // Keep discount as user input (it's already in PascalCase)
        Discount: currentCoverageDetails.Discount || "0.00",
      };

      // Update the coverage details with all calculated values
      setCoverageDetails(updatedCoverageDetails);
    },
    [setCoverageDetails, premiumRates, productConfigurator, vehicleType]
  );

  // Initialize and track data changes
  useEffect(() => {
    // Check if premium data exists (check on every render to handle async loading)
    const netPremium = coverageDetails.NETpremium;
    const grossPremium = coverageDetails.Grosspremium;
    const currentlyHasPremiumData = !!(
      (netPremium &&
        netPremium !== "" &&
        netPremium !== "0" &&
        netPremium !== "0.00") ||
      (grossPremium &&
        grossPremium !== "" &&
        grossPremium !== "0" &&
        grossPremium !== "0.00")
    );

    // Check if we have actual data (not just empty strings)
    const hasActualData = !!(
      coverageDetails.LossandDamagecoverage ||
      coverageDetails.policyId ||
      coverageDetails.policyNumber
    );

    // First time: Initialize tracking only when we have actual data
    if (!isDataInitialized.current) {
      // Wait until we have actual data before initializing
      if (!hasActualData) {
        return; // Don't initialize yet, wait for data to load
      }

      hasExistingPremiumData.current = currentlyHasPremiumData;
      isDataInitialized.current = true;

      // Initialize previous values ref with actual data
      prevValuesRef.current = {
        LossandDamagecoverage: coverageDetails.LossandDamagecoverage,
        LossandDamagecoverageRate: coverageDetails.LossandDamagecoverageRate,
        ActsofNatureRate: coverageDetails.ActsofNatureRate,
        CtplCoverageRate: coverageDetails.CtplCoverageRate,
        BodilyInjury: coverageDetails.BodilyInjury,
        PropertyDamage: coverageDetails.PropertyDamage,
        APPATotalCoverage: coverageDetails.APPATotalCoverage,
        AutopassengerpersonalAccident:
          coverageDetails.AutopassengerpersonalAccident,
        Discount: coverageDetails.Discount,
        OthersPremium: coverageDetails.OthersPremium,
      };

      // If premium data exists, don't calculate - just show existing data
      if (hasExistingPremiumData.current) {
        return;
      }
    }

    // After initialization: Update flag if premium data was loaded asynchronously
    if (currentlyHasPremiumData && !hasExistingPremiumData.current) {
      hasExistingPremiumData.current = true;
      // Update prevValuesRef when premium data is detected
      if (prevValuesRef.current) {
        prevValuesRef.current = {
          LossandDamagecoverage: coverageDetails.LossandDamagecoverage,
          LossandDamagecoverageRate: coverageDetails.LossandDamagecoverageRate,
          ActsofNatureRate: coverageDetails.ActsofNatureRate,
          CtplCoverageRate: coverageDetails.CtplCoverageRate,
          BodilyInjury: coverageDetails.BodilyInjury,
          PropertyDamage: coverageDetails.PropertyDamage,
          APPATotalCoverage: coverageDetails.APPATotalCoverage,
          AutopassengerpersonalAccident:
            coverageDetails.AutopassengerpersonalAccident,
          Discount: coverageDetails.Discount,
          OthersPremium: coverageDetails.OthersPremium,
        };
      }
      return; // Don't recalculate when premium data is first detected
    }

    // If premium data exists, don't recalculate unless user explicitly changes input
    if (hasExistingPremiumData.current) {
      // Check if user has changed input values
      if (!prevValuesRef.current) {
        // Initialize prevValuesRef if it doesn't exist yet
        prevValuesRef.current = {
          LossandDamagecoverage: coverageDetails.LossandDamagecoverage,
          LossandDamagecoverageRate: coverageDetails.LossandDamagecoverageRate,
          ActsofNatureRate: coverageDetails.ActsofNatureRate,
          CtplCoverageRate: coverageDetails.CtplCoverageRate,
          BodilyInjury: coverageDetails.BodilyInjury,
          PropertyDamage: coverageDetails.PropertyDamage,
          APPATotalCoverage: coverageDetails.APPATotalCoverage,
          AutopassengerpersonalAccident:
            coverageDetails.AutopassengerpersonalAccident,
          Discount: coverageDetails.Discount,
          OthersPremium: coverageDetails.OthersPremium,
        };
        return;
      }

      const prev = prevValuesRef.current;
      const hasChanged =
        prev.LossandDamagecoverage !== coverageDetails.LossandDamagecoverage ||
        prev.LossandDamagecoverageRate !==
          coverageDetails.LossandDamagecoverageRate ||
        prev.ActsofNatureRate !== coverageDetails.ActsofNatureRate ||
        prev.CtplCoverageRate !== coverageDetails.CtplCoverageRate ||
        prev.BodilyInjury !== coverageDetails.BodilyInjury ||
        prev.PropertyDamage !== coverageDetails.PropertyDamage ||
        prev.APPATotalCoverage !== coverageDetails.APPATotalCoverage ||
        prev.AutopassengerpersonalAccident !==
          coverageDetails.AutopassengerpersonalAccident ||
        prev.Discount !== coverageDetails.Discount ||
        prev.OthersPremium !== coverageDetails.OthersPremium;

      // If user changed input, allow recalculation (user wants to update)
      if (hasChanged) {
        // User explicitly changed input, so allow recalculation
        hasExistingPremiumData.current = false;
        // Continue to calculation logic below
      } else {
        // No user changes, just update tracking and return (don't recalculate)
        prevValuesRef.current = {
          LossandDamagecoverage: coverageDetails.LossandDamagecoverage,
          LossandDamagecoverageRate: coverageDetails.LossandDamagecoverageRate,
          ActsofNatureRate: coverageDetails.ActsofNatureRate,
          CtplCoverageRate: coverageDetails.CtplCoverageRate,
          BodilyInjury: coverageDetails.BodilyInjury,
          PropertyDamage: coverageDetails.PropertyDamage,
          APPATotalCoverage: coverageDetails.APPATotalCoverage,
          AutopassengerpersonalAccident:
            coverageDetails.AutopassengerpersonalAccident,
          Discount: coverageDetails.Discount,
          OthersPremium: coverageDetails.OthersPremium,
        };
        return; // Exit early - don't recalculate
      }
    }

    // After initialization: Check for user changes (for cases without existing premium data)
    if (!prevValuesRef.current) {
      // Initialize prevValuesRef if it doesn't exist
      prevValuesRef.current = {
        LossandDamagecoverage: coverageDetails.LossandDamagecoverage,
        LossandDamagecoverageRate: coverageDetails.LossandDamagecoverageRate,
        ActsofNatureRate: coverageDetails.ActsofNatureRate,
        BodilyInjury: coverageDetails.BodilyInjury,
        PropertyDamage: coverageDetails.PropertyDamage,
        APPATotalCoverage: coverageDetails.APPATotalCoverage,
        AutopassengerpersonalAccident:
          coverageDetails.AutopassengerpersonalAccident,
        Discount: coverageDetails.Discount,
        OthersPremium: coverageDetails.OthersPremium,
      };
      return;
    }

    const prev = prevValuesRef.current;
    const hasChanged =
      prev.LossandDamagecoverage !== coverageDetails.LossandDamagecoverage ||
      prev.LossandDamagecoverageRate !==
        coverageDetails.LossandDamagecoverageRate ||
      prev.ActsofNatureRate !== coverageDetails.ActsofNatureRate ||
      prev.BodilyInjury !== coverageDetails.BodilyInjury ||
      prev.PropertyDamage !== coverageDetails.PropertyDamage ||
      prev.APPATotalCoverage !== coverageDetails.APPATotalCoverage ||
      prev.AutopassengerpersonalAccident !==
        coverageDetails.AutopassengerpersonalAccident ||
      prev.Discount !== coverageDetails.Discount ||
      prev.OthersPremium !== coverageDetails.OthersPremium;

    // If no changes detected, update prevValuesRef to current values (in case parent updated them)
    // but don't recalculate
    if (!hasChanged) {
      // Update prevValuesRef to match current values (handles parent updates)
      prevValuesRef.current = {
        LossandDamagecoverage: coverageDetails.LossandDamagecoverage,
        LossandDamagecoverageRate: coverageDetails.LossandDamagecoverageRate,
        ActsofNatureRate: coverageDetails.ActsofNatureRate,
        BodilyInjury: coverageDetails.BodilyInjury,
        PropertyDamage: coverageDetails.PropertyDamage,
        APPATotalCoverage: coverageDetails.APPATotalCoverage,
        AutopassengerpersonalAccident:
          coverageDetails.AutopassengerpersonalAccident,
        Discount: coverageDetails.Discount,
        OthersPremium: coverageDetails.OthersPremium,
      };
      return;
    }

    // User has changed input - calculate premium
    // Only calculate if we have the required values
    if (
      coverageDetails.LossandDamagecoverage &&
      coverageDetails.LossandDamagecoverageRate &&
      (coverageDetails.BodilyInjury ||
        coverageDetails.PropertyDamage ||
        coverageDetails.APPATotalCoverage)
    ) {
      handleCalculation(coverageDetails);

      // Update previous values after calculation
      prevValuesRef.current = {
        LossandDamagecoverage: coverageDetails.LossandDamagecoverage,
        LossandDamagecoverageRate: coverageDetails.LossandDamagecoverageRate,
        ActsofNatureRate: coverageDetails.ActsofNatureRate,
        BodilyInjury: coverageDetails.BodilyInjury,
        PropertyDamage: coverageDetails.PropertyDamage,
        APPATotalCoverage: coverageDetails.APPATotalCoverage,
        AutopassengerpersonalAccident:
          coverageDetails.AutopassengerpersonalAccident,
        Discount: coverageDetails.Discount,
        OthersPremium: coverageDetails.OthersPremium,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coverageDetails.LossandDamagecoverage,
    coverageDetails.LossandDamagecoverageRate,
    coverageDetails.ActsofNatureRate,
    coverageDetails.CtplCoverageRate,
    coverageDetails.BodilyInjury,
    coverageDetails.PropertyDamage,
    coverageDetails.APPATotalCoverage,
    coverageDetails.AutopassengerpersonalAccident,
    coverageDetails.Discount,
    coverageDetails.OthersPremium,
    coverageDetails.NETpremium,
    coverageDetails.Grosspremium,
    handleCalculation,
  ]);

  // Handle form submission
  useEffect(() => {
    if (shouldSubmit && onSectionSubmitted) {
      // Coverage change doesn't need validation, just pass the current data
      onSectionSubmitted(index, coverageDetails);
    }
  }, [shouldSubmit, onSectionSubmitted, index, coverageDetails]);

  return (
    <div>
      <div className="customer__info__subtitle mt-2 mb-2">{t("endorsement.coverageChange")}</div>
      {/* <form onSubmit={formik.handleSubmit}> */}
      <div class="grid">
        <div class="col-12 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.ownDamageCoverage")}
            value={coverageDetails.LossandDamagecoverage}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                LossandDamagecoverage: e.target.value,
              });
            }}
            error={
              coverageDetails.LossandDamagecoverage &&
              coverageDetails.LossandDamagecoverage.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.ownDamageCoverageRate")}
            className="cursor-not-allowed border-none outline-none focus:outline-none
            focus:border-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 text-blue-500
            "
            value={coverageDetails.LossandDamagecoverageRate}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            label={t("endorsement.ownDamageCoveragePremium")}
            disabled={disabled}
            value={coverageDetails.LossandDamagecoveragepremium}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                LossandDamagecoveragepremium: e.target.value,
              });
            }}
            error={
              coverageDetails.LossandDamagecoveragepremium &&
              coverageDetails.LossandDamagecoveragepremium.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label="Acts of Nature Rate"
            className="cursor-not-allowed border-none"
            disabled={disabled}
            value={coverageDetails.ActsofNatureRate}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            label={t("endorsement.actsOfNaturePremium")}
            disabled={disabled}
            value={coverageDetails.ActsofNaturepremium}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                ActsofNaturepremium: e.target.value,
              });
            }}
            error={
              coverageDetails.ActsofNaturepremium &&
              coverageDetails.ActsofNaturepremium.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label="CTPL Coverage Rate"
            value={coverageDetails.CtplCoverageRate}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                CtplCoverageRate: e.target.value,
              });
            }}
            error={
              coverageDetails.CtplCoverageRate &&
              coverageDetails.CtplCoverageRate.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.bodilyInjury")}
            value={coverageDetails.BodilyInjury}
            options={BodilyInjuryOptions}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                BodilyInjury: e.value,
              });
            }}
            optionLabel="label"
            error={
              coverageDetails.BodilyInjury &&
              coverageDetails.BodilyInjury.length > 0
            }
          />
        </div>

        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            label={t("endorsement.bodilyInjuryCoveragePremium")}
            disabled={disabled}
            value={coverageDetails.BodilyInjuryCoveragePremium}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                BodilyInjuryCoveragePremium: e.target.value,
              });
            }}
            error={
              coverageDetails.BodilyInjuryCoveragePremium &&
              coverageDetails.BodilyInjuryCoveragePremium.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.propertyDamage")}
            value={coverageDetails.PropertyDamage}
            options={PropertyDamageOptions}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                PropertyDamage: e.value,
              });
            }}
            optionLabel="label"
            error={
              coverageDetails.PropertyDamage &&
              coverageDetails.PropertyDamage.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            label="Property Damage Coverage Premium"
            disabled={disabled}
            value={coverageDetails.PropertyDamageCoveragePremium}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                PropertyDamageCoveragePremium: e.target.value,
              });
            }}
            error={
              coverageDetails.PropertyDamageCoveragePremium &&
              coverageDetails.PropertyDamageCoveragePremium.length > 0
            }
          />
        </div>
        <div class="col-12 mt-2">
          <DropdownField
            label={t("endorsement.autoPassengerPersonalAccident")}
            disabled={disabled}
            value={coverageDetails.AutopassengerpersonalAccident}
            options={AutopassengerpersonalAccidentOptions}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                AutopassengerpersonalAccident: e.value,
              });
            }}
            optionLabel="label"
            error={
              coverageDetails.AutopassengerpersonalAccident &&
              coverageDetails.AutopassengerpersonalAccident.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.appaTotalCoverage")}
            className="cursor-not-allowed border-none"
            value={coverageDetails.APPATotalCoverage}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={t("endorsement.actsOfNaturePremium")}
            value={coverageDetails.ActsofNaturepremium}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                ActsofNaturepremium: e.target.value,
              });
            }}
            error={
              coverageDetails.ActsofNaturepremium &&
              coverageDetails.ActsofNaturepremium.length > 0
            }
          />
        </div>
        <div class="col-12 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label="Total Sum Insured"
            value={coverageDetails.TotalSumInsured}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                TotalSumInsured: e.target.value,
              });
            }}
            error={
              coverageDetails.TotalSumInsured &&
              coverageDetails.TotalSumInsured.length > 0
            }
          />
        </div>

        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={t("endorsement.netPremium")}
            value={coverageDetails.NETpremium}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                NETpremium: e.target.value,
              });
            }}
            error={
              coverageDetails.NETpremium &&
              coverageDetails.NETpremium.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={`Value Added Tax ( ${taxes?.value_added_tax || 0}% )`}
            value={coverageDetails.ValueAddedTax}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                ValueAddedTax: e.target.value,
              });
            }}
            error={
              coverageDetails.ValueAddedTax &&
              coverageDetails.ValueAddedTax.length > 0
            }
          />
        </div>

        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label="Others(Acc. premium)"
            value={coverageDetails.OthersPremium}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                OthersPremium: e.target.value,
              });
            }}
            error={
              coverageDetails.OthersPremium &&
              coverageDetails.OthersPremium.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={`Documentary Stamp Tax ( ${
              taxes?.documentary_stamp_tax || 0
            }% )`}
            value={coverageDetails.DocumentaryStampTax}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                DocumentaryStampTax: e.target.value,
              });
            }}
            error={
              coverageDetails.DocumentaryStampTax &&
              coverageDetails.DocumentaryStampTax.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={`Local Gov’t Tax ( ${taxes?.local_government_tax || 0}% )`}
            value={coverageDetails.LocalGovtTax}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                LocalGovtTax: e.target.value,
              });
            }}
            error={
              coverageDetails.LocalGovtTax &&
              coverageDetails.LocalGovtTax.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={t("endorsement.discount")}
            value={coverageDetails.Discount}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                Discount: e.target.value,
              });
            }}
            error={
              coverageDetails.Discount && coverageDetails.Discount.length > 0
            }
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={t("endorsement.others")}
            value={coverageDetails.Others}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                Others: e.target.value,
              });
            }}
            error={coverageDetails.Others && coverageDetails.Others.length > 0}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={t("endorsement.grossPremium")}
            value={coverageDetails.Grosspremium}
            onChange={(e) => {
              setCoverageDetails({
                ...coverageDetails,
                Grosspremium: e.target.value,
              });
            }}
            error={
              coverageDetails.Grosspremium &&
              coverageDetails.Grosspremium.length > 0
            }
          />
        </div>
      </div>
      {/* </form> */}
    </div>
  );
};

export default CoverageChange;
