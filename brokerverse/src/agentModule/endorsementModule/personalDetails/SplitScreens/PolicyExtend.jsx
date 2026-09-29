import React, { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import CalculaitionTextInputs from "../../../component/calculaitionTextInputs";
import DatepickerField from "../../../component/datePicker";
import { InputTextarea } from "primereact/inputtextarea";
import InputTextField from "../../../component/inputText";
import DropdownField from "../../../component/DropdownField";
import { useFormik } from "formik";
import { LossandDamagecoverageRateOptions } from "../mock";
import { bodilyInjuryOptions as configuredBodilyInjuryOptions, propertyDamageOptions as configuredPropertyDamageOptions } from "../../../../utility/quoteOptions";

const initialValue = {
  FromDate: "",
  ToDate: "",
  NumberofDays: "",
  LossandDamagecoverage: "",
  LossandDamagecoverageRate: "",
  LossandDamagecoveragepremium: "",
  ActsOfNatureRate: "",
  ActsofNaturepremium: "",
  BodilyInjury: "",
  BodilyInjuryCoveragePremium: "",
  PropertyDamage: "",
  PropertyDamageCoveragePremium: "",
  Title: "",
  Declaration: "",
};

const PolicyExtend = ({
  index,
  disabled,
  shouldSubmit,
  onSectionSubmitted,
  policyExtendDetails,
}) => {
  const { t } = useTranslation();
  const parseDateValue = useCallback((value) => {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const calculateNumberOfDays = useCallback((fromDate, toDate) => {
    if (!fromDate || !toDate) {
      return "";
    }

    const difference = toDate.getTime() - fromDate.getTime();

    if (difference < 0) {
      return "";
    }

    const dayInMs = 1000 * 60 * 60 * 24;

    return String(Math.round(difference / dayInMs));
  }, []);

  const mapPolicyExtendDetailsToInitialValues = useCallback(
    (details) => {
      const fromDate = parseDateValue(
        details?.FromDate ??
          details?.fromDate ??
          details?.IssuedDate ??
          details?.issuedDate
      );
      const toDate = parseDateValue(
        details?.ToDate ?? details?.toDate ?? details?.Expiry ?? details?.expiry
      );

      const numberOfDays =
        details?.NumberofDays ??
        details?.numberOfDays ??
        calculateNumberOfDays(fromDate, toDate);

      return {
        ...initialValue,
        FromDate: fromDate,
        ToDate: toDate,
        NumberofDays: numberOfDays,
        LossandDamagecoverage:
          details?.LossandDamagecoverage ??
          details?.lossAndDamageCoverage ??
          "",
        LossandDamagecoverageRate:
          details?.LossandDamagecoverageRate ??
          details?.lossAndDamageCoverageRate ??
          "",
        LossandDamagecoveragepremium:
          details?.LossandDamagecoveragepremium ??
          details?.lossAndDamageCoveragePremium ??
          "",
        ActsOfNatureRate:
          details?.ActsOfNatureRate ?? details?.actsOfNatureRate ?? "",
        ActsofNaturepremium:
          details?.ActsofNaturepremium ?? details?.actsOfNaturePremium ?? "",
        BodilyInjury: details?.BodilyInjury ?? details?.bodilyInjury ?? "",
        BodilyInjuryCoveragePremium:
          details?.BodilyInjuryCoveragePremium ??
          details?.bodilyInjuryCoveragePremium ??
          "",
        PropertyDamage:
          details?.PropertyDamage ?? details?.propertyDamage ?? "",
        PropertyDamageCoveragePremium:
          details?.PropertyDamageCoveragePremium ??
          details?.propertyDamageCoveragePremium ??
          "",
        Title: details?.Title ?? details?.title ?? details?.product ?? "",
        Declaration:
          details?.Declaration ?? details?.declaration ?? details?.others ?? "",
      };
    },
    [calculateNumberOfDays, parseDateValue]
  );

  const formikInitialValues = useMemo(
    () => mapPolicyExtendDetailsToInitialValues(policyExtendDetails || {}),
    [mapPolicyExtendDetailsToInitialValues, policyExtendDetails]
  );

  const formik = useFormik({
    initialValues: initialValue,
    enableReinitialize: true,
  });

  useEffect(() => {
    formik.setValues(formikInitialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formikInitialValues]);

  useEffect(() => {
    if (!shouldSubmit) {
      return;
    }

    const formatDateForSubmit = (value) => {
      if (!value) {
        return "";
      }

      if (value instanceof Date) {
        const iso = value.toISOString();

        return iso.split("T")[0];
      }

      return value;
    };

    if (typeof onSectionSubmitted === "function") {
      const payload = {
        ...formik.values,
        FromDate: formatDateForSubmit(formik.values.FromDate),
        ToDate: formatDateForSubmit(formik.values.ToDate),
      };

      onSectionSubmitted(index, payload);
    }

  }, [formik, index, shouldSubmit, onSectionSubmitted]);

  const handleDateChange = useCallback(
    (field) => (event) => {
      const nextDate = parseDateValue(event?.value ?? event?.target?.value);

      formik.setFieldValue(field, nextDate);

      const fromDate = field === "FromDate" ? nextDate : formik.values.FromDate;
      const toDate = field === "ToDate" ? nextDate : formik.values.ToDate;

      const days = calculateNumberOfDays(fromDate, toDate);

      formik.setFieldValue("NumberofDays", days);
    },
    [calculateNumberOfDays, formik, parseDateValue]
  );

  const addFallbackOption = useCallback((value, options = []) => {
    if (!value) {
      return options;
    }

    const hasOption = options.some((option) => option?.value === value);

    if (hasOption) {
      return options;
    }

    return [{ label: value, value }, ...options];
  }, []);

  const lossandDamagecoverageRateOptions = useMemo(
    () =>
      addFallbackOption(
        formikInitialValues.LossandDamagecoverageRate,
        LossandDamagecoverageRateOptions
      ),
    [addFallbackOption, formikInitialValues.LossandDamagecoverageRate]
  );

  const bodilyInjuryOptions = useMemo(
    () =>
      addFallbackOption(formikInitialValues.BodilyInjury, configuredBodilyInjuryOptions()),
    [addFallbackOption, formikInitialValues.BodilyInjury]
  );

  const propertyDamageOptions = useMemo(
    () =>
      addFallbackOption(
        formikInitialValues.PropertyDamage,
        configuredPropertyDamageOptions()
      ),
    [addFallbackOption, formikInitialValues.PropertyDamage]
  );

  return (
    <div>
      <div className="customer__info__subtitle mt-2 mb-2">{t("endorsement.policyExtend")}</div>
      {/* <form onSubmit={formik.handleSubmit}> */}
      <div className="grid">
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DatepickerField
            label={t("endorsement.from")}
            disabled={disabled}
            value={formik.values.FromDate}
            onChange={handleDateChange("FromDate")}
            error={formik.touched.FromDate && formik.errors.FromDate}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DatepickerField
            label={t("endorsement.to")}
            disabled={disabled}
            value={formik.values.ToDate}
            onChange={handleDateChange("ToDate")}
            error={formik.touched.ToDate && formik.errors.ToDate}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.numberOfDays")}
            disabled={disabled}
            value={formik.values.NumberofDays}
            onChange={formik.handleChange("NumberofDays")}
            error={formik.touched.NumberofDays && formik.errors.NumberofDays}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            label={t("endorsement.ownDamageCoverage")}
            disabled={disabled}
            value={formik.values.LossandDamagecoverage}
            onChange={formik.handleChange("LossandDamagecoverage")}
            error={
              formik.touched.LossandDamagecoverage &&
              formik.errors.LossandDamagecoverage
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            label={t("endorsement.ownDamageCoverageRate")}
            disabled={disabled}
            value={formik.values.LossandDamagecoverageRate}
            options={lossandDamagecoverageRateOptions}
            onChange={(e) => {
              formik.setFieldValue("LossandDamagecoverageRate", e.value);
            }}
            optionLabel="label"
            error={
              formik.touched.LossandDamagecoverageRate &&
              formik.errors.LossandDamagecoverageRate
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label="Own Damage coverage premium"
            value={formik.values.LossandDamagecoveragepremium}
            onChange={formik.handleChange("LossandDamagecoveragepremium")}
            error={
              formik.touched.LossandDamagecoveragepremium &&
              formik.errors.LossandDamagecoveragepremium
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.actsOfNatureRate")}
            value={formik.values.ActsOfNatureRate}
            onChange={formik.handleChange("ActsOfNatureRate")}
            error={
              formik.touched.ActsOfNatureRate && formik.errors.ActsOfNatureRate
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            label="Acts of Nature premium"
            disabled={disabled}
            value={formik.values.ActsofNaturepremium}
            onChange={formik.handleChange("ActsofNaturepremium")}
            error={
              formik.touched.ActsofNaturepremium &&
              formik.errors.ActsofNaturepremium
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.bodilyInjury")}
            value={formik.values.BodilyInjury}
            options={bodilyInjuryOptions}
            onChange={(e) => {
              formik.setFieldValue("BodilyInjury", e.value);
            }}
            optionLabel="label"
            error={formik.touched.BodilyInjury && formik.errors.BodilyInjury}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={t("endorsement.bodilyInjuryCoveragePremium")}
            value={formik.values.BodilyInjuryCoveragePremium}
            onChange={formik.handleChange("BodilyInjuryCoveragePremium")}
            error={
              formik.touched.BodilyInjuryCoveragePremium &&
              formik.errors.BodilyInjuryCoveragePremium
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.propertyDamage")}
            value={formik.values.PropertyDamage}
            options={propertyDamageOptions}
            onChange={(e) => {
              formik.setFieldValue("PropertyDamage", e.value);
            }}
            optionLabel="label"
            error={
              formik.touched.PropertyDamage && formik.errors.PropertyDamage
            }
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <CalculaitionTextInputs
            disabled={disabled}
            label={t("endorsement.propertyDamageCoveragePremium")}
            value={formik.values.PropertyDamageCoveragePremium}
            onChange={formik.handleChange("PropertyDamageCoveragePremium")}
            error={
              formik.touched.PropertyDamageCoveragePremium &&
              formik.errors.PropertyDamageCoveragePremium
            }
          />
        </div>
        <div className="col-12 mt-2">
          <CalculaitionTextInputs
            label={t("endorsement.title")}
            disabled={disabled}
            value={formik.values.Title}
            onChange={formik.handleChange("Title")}
            error={formik.touched.Title && formik.errors.Title}
          />
        </div>
        <div className="col-12 mt-2">
          <InputTextarea
            disabled={disabled}
            placeholder={t("endorsement.declaration")}
            rows={6}
            cols={30}
            className="text__area__container"
            value={formik.values.Declaration}
            onChange={formik.handleChange("Declaration")}
            error={formik.touched.Declaration && formik.errors.Declaration}
          />
        </div>
      </div>
      {/* </form> */}
    </div>
  );
};

export default PolicyExtend;
