import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import InputTextField from "../../../component/inputText";
import DropdownField from "../../../component/DropdwonField";
import { useFormik } from "formik";
import useQuoteOptions from "../../../quoteModule/policyDetails/policyDetailsCard/useQuoteOptions";
import useMasterOptions from "../../../../module/GeneralMasters/common/useMasterOptions";

const TNVSOptions = [
  { label: "True", value: "Yes" },
  { label: "False", value: "No" },
];

const initialValue = {
  TNVS: "",
  MotorNumber: "",
  ChassisNumber: "",
  Mortgage: "",
  CertNumber: "",
  PlateNumber: "",
  MVFileNumber: "",
  AuthenCode: "",
  VehicleBrand: "",
  ModelYear: "",
  ModelVariant: "",
  VehicleModel: "",
  VehicleColor: "",
  SeatingCapacity: "",
};

const addFallbackOption = (value, options = []) => {
  if (!value) {
    return options;
  }

  const exists = options.some((option) => option?.value === value);

  if (exists) {
    return options;
  }

  return [{ label: value, value }, ...options];
};

const mapPersonalDetailsToInitialValues = (details) => ({
  ...initialValue,
  TNVS: details?.TNVS ?? "",
  MotorNumber: details?.MotorNumber ?? "",
  ChassisNumber: details?.ChassisNumber ?? "",
  Mortgage: details?.Mortgage ?? "",
  CertNumber: details?.CertNumber ?? "",
  PlateNumber: details?.PlateNumber ?? "",
  MVFileNumber: details?.MVFileNumber ?? "",
  AuthenCode: details?.AuthenCode ?? "",
  VehicleBrand: details?.VehicleBrand ?? "",
  ModelYear: details?.ModelYear ?? "",
  ModelVariant: details?.ModelVariant ?? "",
  VehicleModel: details?.VehicleModel ?? "",
  VehicleColor: details?.VehicleColor ?? "",
  SeatingCapacity: details?.SeatingCapacity ?? "",
});

const MotorDetailsChange = ({
  index,
  disabled,
  shouldSubmit,
  onSectionSubmitted,
  personalDetails,
}) => {
  const { t } = useTranslation();
  const formikInitialValues = useMemo(
    () => mapPersonalDetailsToInitialValues(personalDetails),
    [personalDetails]
  );

  const formik = useFormik({
    initialValues: formikInitialValues,
    enableReinitialize: true,
    onSubmit: (values) => {
      onSectionSubmitted?.(index, values);
    },
    // validate,
  });

  const tnvsOptions = useMemo(
    () => addFallbackOption(formikInitialValues.TNVS, TNVSOptions),
    [formikInitialValues.TNVS]
  );

  // Mortgagee banks (Bank master) and the vehicle brand -> model -> variant cascade, model years and colours
  // (vehicle masters and configuration), as on Create Quote; a stored value stays selectable.
  const mortgageMaster = useMasterOptions("bank");
  const mortgageOptions = useMemo(
    () => addFallbackOption(formikInitialValues.Mortgage, mortgageMaster),
    [formikInitialValues.Mortgage, mortgageMaster]
  );
  const {
    brandOptions: vehicleBrandOptions,
    modelYearOptions,
    variantOptions: modelVariantOptions,
    modelOptions: vehicleModelOptions,
    colourOptions: vehicleColorOptions,
  } = useQuoteOptions({
    brand: formik.values.VehicleBrand,
    model: formik.values.VehicleModel,
    current: formikInitialValues,
  });

  useEffect(() => {
    if (!shouldSubmit) {
      return;
    }

    formik.submitForm();
  }, [formik, shouldSubmit]);

  return (
    <div>
      <div className="customer__info__subtitle mt-2 mb-2">
        {t("endorsement.motorDetailsChange")}
      </div>
      {/* <form onSubmit={formik.handleSubmit}> */}
      <div class="grid">
        <div class="col-12 mt-2 p-0">
          <div class="grid m-0">
            <div class="col-12 md:col-6 lg:col-6 xl:col-6">
              <DropdownField
                label={t("endorsement.tnvs")}
                disabled={disabled}
                value={formik.values.TNVS}
                options={tnvsOptions}
                onChange={(e) => {
                  formik.setFieldValue("TNVS", e.value);
                }}
                optionLabel="label"
                error={formik.touched.TNVS && formik.errors.TNVS}
              />
            </div>
          </div>
        </div>
        <div class="col-6 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.motorNumber")}
            value={formik.values.MotorNumber}
            onChange={formik.handleChange("MotorNumber")}
            error={formik.touched.MotorNumber && formik.errors.MotorNumber}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.chassisNumber")}
            value={formik.values.ChassisNumber}
            onChange={formik.handleChange("ChassisNumber")}
            error={formik.touched.ChassisNumber && formik.errors.ChassisNumber}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.mortgage")}
            value={formik.values.Mortgage}
            options={mortgageOptions}
            onChange={(e) => {
              formik.setFieldValue("Mortgage", e.value);
            }}
            optionLabel="label"
            error={formik.touched.Mortgage && formik.errors.Mortgage}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.certNumber")}
            value={formik.values.CertNumber}
            onChange={formik.handleChange("CertNumber")}
            error={formik.touched.CertNumber && formik.errors.CertNumber}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.plateNumber")}
            value={formik.values.PlateNumber}
            onChange={formik.handleChange("PlateNumber")}
            error={formik.touched.PlateNumber && formik.errors.PlateNumber}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.mvFileNumber")}
            value={formik.values.MVFileNumber}
            onChange={formik.handleChange("MVFileNumber")}
            error={formik.touched.MVFileNumber && formik.errors.MVFileNumber}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.authenCode")}
            value={formik.values.AuthenCode}
            onChange={formik.handleChange("AuthenCode")}
            error={formik.touched.AuthenCode && formik.errors.AuthenCode}
          />
        </div>

        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.vehicleBrand")}
            value={formik.values.VehicleBrand}
            options={vehicleBrandOptions}
            onChange={(e) => {
              formik.setFieldValue("VehicleBrand", e.value);
            }}
            optionLabel="label"
            error={formik.touched.VehicleBrand && formik.errors.VehicleBrand}
          />
        </div>

        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.modelYear")}
            value={formik.values.ModelYear}
            options={modelYearOptions}
            onChange={(e) => {
              formik.setFieldValue("ModelYear", e.value);
            }}
            optionLabel="label"
            error={formik.touched.ModelYear && formik.errors.ModelYear}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.modelVariant")}
            value={formik.values.ModelVariant}
            options={modelVariantOptions}
            onChange={(e) => {
              formik.setFieldValue("ModelVariant", e.value);
            }}
            optionLabel="label"
            error={formik.touched.ModelVariant && formik.errors.ModelVariant}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.vehicleModel")}
            value={formik.values.VehicleModel}
            options={vehicleModelOptions}
            onChange={(e) => {
              formik.setFieldValue("VehicleModel", e.value);
            }}
            optionLabel="label"
            error={formik.touched.VehicleModel && formik.errors.VehicleModel}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <DropdownField
            disabled={disabled}
            label={t("endorsement.vehicleColor")}
            value={formik.values.VehicleColor}
            options={vehicleColorOptions}
            onChange={(e) => {
              formik.setFieldValue("VehicleColor", e.value);
            }}
            optionLabel="label"
            error={formik.touched.VehicleColor && formik.errors.VehicleColor}
          />
        </div>
        <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            disabled={disabled}
            label={t("endorsement.seatingCapacity")}
            value={formik.values.SeatingCapacity}
            onChange={formik.handleChange("SeatingCapacity")}
            error={
              formik.touched.SeatingCapacity && formik.errors.SeatingCapacity
            }
          />
        </div>
      </div>
      {/* </form> */}
    </div>
  );
};

export default MotorDetailsChange;
