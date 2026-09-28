import { Card } from "primereact/card";
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import InputTextField from "../../../component/inputText";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import { Tooltip } from "primereact/tooltip";
import { useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import { useDispatch, useSelector } from "react-redux";
import { postClaimDetailsData } from "../store/claimDetailsMiddleWare";
import { mapToApiLob } from "../store/claimDetailsMiddleWare";
import { isFireLob } from "../../../endorsementModule/constants/endorsementCategories";
import DropdownField from "../../../component/DropdwonField";
import DatepickerField from "../../../component/datePicker";
import InputNumberField from "../../../component/inputNumberField";

const ClaimDetailsCard = ({
  leadRefId,
  quoteRefId,
  policyRefId,
  initialLob,
}) => {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);

  // Fire incident/cause-of-loss options (translated)
  const FIRE_INCIDENT_TYPES = [
    { label: t("claimDetails.fire"), value: "Fire" },
    { label: t("claimDetails.flood"), value: "Flood" },
    { label: t("claimDetails.typhoon"), value: "Typhoon" },
    { label: t("claimDetails.earthquake"), value: "Earthquake" },
    { label: t("claimDetails.lightning"), value: "Lightning" },
    { label: t("claimDetails.other"), value: "Other" },
  ];
  const [lastUpdatedData, setLastUpdatedData] = useState(null);
  const navigate = useNavigate();

  const { claimDetailsViewData, claimThirdParty, loading } = useSelector(
    ({ claimDetailsMainReducers }) => {
      return {
        claimDetailsViewData: claimDetailsMainReducers?.claimDetailsViewData,
        claimThirdParty: claimDetailsMainReducers?.claimThirdParty,
        loading: claimDetailsMainReducers?.loading,
      };
    }
  );

  const isFire = isFireLob(
    claimDetailsViewData?.lob ||
      claimDetailsViewData?.productType ||
      initialLob
  );

  const formInitialValue = {
    InsuranceCompanyName: claimDetailsViewData?.InsuranceCompanyName || "",
    policyNumber: claimDetailsViewData?.policyNumber || "",
    PolicyHolderName: claimDetailsViewData?.PolicyHolderName || "",
    HouseNo: claimDetailsViewData?.HouseNo || "",
    Barangay: claimDetailsViewData?.Barangay || "",
    CountryName: claimDetailsViewData?.CountryName || "",
    Province: claimDetailsViewData?.Province || "",
    CityName: claimDetailsViewData?.CityName || "",
    ZipCode: claimDetailsViewData?.ZipCode || "",
    // Driver's details - restore from Redux state if available, otherwise start empty
    driverName: claimThirdParty?.driverName || "",
    driverHouseNo: claimThirdParty?.driverHouseNo || "",
    driverBarangay: claimThirdParty?.driverBarangay || "",
    driverCountry: claimThirdParty?.driverCountry || "",
    driverProvince: claimThirdParty?.driverProvince || "",
    driverCity: claimThirdParty?.driverCity || "",
    driverZipCode: claimThirdParty?.driverZipCode || "",
    // Third party details - restore from Redux state if available, otherwise start empty
    InsuranceCompanyN: claimThirdParty?.InsuranceCompanyN || "",
    name: claimThirdParty?.name || "",
    contactNumber: claimThirdParty?.contactNumber || "",
    plateNumber: claimThirdParty?.plateNumber || "",
    unit: claimThirdParty?.unit || "",
    shop: claimThirdParty?.shop || "",
    // Incident details (Fire; Motor uses defaults in sendMail)
    dateOfIncident: claimThirdParty?.dateOfIncident || null,
    timeOfIncident: claimThirdParty?.timeOfIncident || "",
    addressOfIncident: claimThirdParty?.addressOfIncident || "",
    cityOfIncident: claimThirdParty?.cityOfIncident || "",
    provinceOfIncident: claimThirdParty?.provinceOfIncident || "",
    typeOfIncident: claimThirdParty?.typeOfIncident || "",
    estimatedClaimAmount: claimThirdParty?.estimatedClaimAmount ?? null,
    insuranceCompanyClaimNumber:
      claimThirdParty?.insuranceCompanyClaimNumber || "",
  };

  console.log("=== FORM INITIAL VALUES ===");
  console.log("Form Initial Value:", formInitialValue);
  console.log("=== END FORM INITIAL VALUES ===");

  const dispatch = useDispatch();

  const handleSubmit = (values) => {
    const lob = mapToApiLob(
      claimDetailsViewData?.lob ||
        claimDetailsViewData?.productType ||
        initialLob
    );
    const payload = {
      ...values,
      leadRefId,
      quoteRefId,
      policyRefId,
      lob,
    };
    dispatch(postClaimDetailsData(payload));
    navigate("/agent/claimrequest/sendmail");
  };

  // Custom validation: driverName required only for Motor
  const customValidation = (values) => {
    const errors = {};
    if (
      !isFire &&
      (!values.driverName || values.driverName.trim() === "")
    ) {
      errors.driverName = t("claimDetails.driversNameRequired");
    }
    return errors;
  };

  const formik = useFormik({
    initialValues: formInitialValue,
    enableReinitialize: true, // Allow form to reinitialize when Redux data changes
    validate: customValidation,
    onSubmit: handleSubmit,
  });

  // Update form when Redux data changes
  useEffect(() => {
    console.log("=== FORM UPDATE USEEFFECT TRIGGERED ===");
    console.log("Claim Details View Data:", claimDetailsViewData);
    console.log("Claim Third Party Data:", claimThirdParty);
    console.log("Data keys:", Object.keys(claimDetailsViewData || {}));
    console.log("Third Party Data keys:", Object.keys(claimThirdParty || {}));
    console.log("Data length:", Object.keys(claimDetailsViewData || {}).length);
    console.log(
      "Third Party Data length:",
      Object.keys(claimThirdParty || {}).length
    );
    console.log("Last Updated Data:", lastUpdatedData);
    console.log("Current Formik Values:", formik.values);

    // Check if we have either claim details or third party data
    const hasClaimDetails =
      claimDetailsViewData && Object.keys(claimDetailsViewData).length > 0;
    const hasThirdPartyData =
      claimThirdParty && Object.keys(claimThirdParty).length > 0;

    if (hasClaimDetails || hasThirdPartyData) {
      // Check if data has actually changed to prevent unnecessary updates
      const dataString = JSON.stringify({
        claimDetailsViewData,
        claimThirdParty,
      });
      if (lastUpdatedData === dataString) {
        console.log("Data hasn't changed, skipping form update");
        return;
      }

      console.log("=== UPDATING FORM WITH REDUX DATA ===");
      console.log("Claim Details View Data:", claimDetailsViewData);
      console.log("Claim Third Party Data:", claimThirdParty);
      console.log("Last Updated Data:", lastUpdatedData);
      console.log("Current Formik Values (before update):", formik.values);

      // Check if user has already entered data (scenario 3: coming back from mail screen)
      const hasUserData =
        (formik.values.driverName && formik.values.driverName.trim() !== "") ||
        (formik.values.driverHouseNo &&
          formik.values.driverHouseNo.trim() !== "") ||
        (formik.values.name && formik.values.name.trim() !== "") ||
        (formik.values.contactNumber &&
          formik.values.contactNumber.trim() !== "") ||
        (formik.values.addressOfIncident &&
          formik.values.addressOfIncident.trim() !== "") ||
        (formik.values.typeOfIncident && formik.values.typeOfIncident !== "");

      // If user has already entered data, don't override it (scenario 3: coming back from mail screen)
      if (hasUserData) {
        console.log("User has entered data, preserving existing form values");
        setLastUpdatedData(dataString);
        return;
      }

      // Only update form with API data if user hasn't entered anything (scenarios 1 & 2: new claim or edit)
      console.log("No user data found, updating form with API data");

      const updatedValues = {
        InsuranceCompanyName: claimDetailsViewData?.InsuranceCompanyName || "",
        policyNumber: claimDetailsViewData?.policyNumber || "",
        PolicyHolderName: claimDetailsViewData?.PolicyHolderName || "",
        HouseNo: claimDetailsViewData?.HouseNo || "",
        Barangay: claimDetailsViewData?.Barangay || "",
        CountryName: claimDetailsViewData?.CountryName || "",
        Province: claimDetailsViewData?.Province || "",
        CityName: claimDetailsViewData?.CityName || "",
        ZipCode: claimDetailsViewData?.ZipCode || "",
        // Driver's details - use Redux third party data first, then API data, then checkbox logic
        driverName:
          claimThirdParty?.driverName ||
          claimDetailsViewData?.driverName ||
          (checked ? claimDetailsViewData?.PolicyHolderName || "" : ""),
        driverHouseNo:
          claimThirdParty?.driverHouseNo ||
          claimDetailsViewData?.driverHouseNo ||
          (checked ? claimDetailsViewData?.HouseNo || "" : ""),
        driverBarangay:
          claimThirdParty?.driverBarangay ||
          claimDetailsViewData?.driverBarangay ||
          (checked ? claimDetailsViewData?.Barangay || "" : ""),
        driverCountry:
          claimThirdParty?.driverCountry ||
          claimDetailsViewData?.driverCountry ||
          (checked ? claimDetailsViewData?.CountryName || "" : ""),
        driverProvince:
          claimThirdParty?.driverProvince ||
          claimDetailsViewData?.driverProvince ||
          (checked ? claimDetailsViewData?.Province || "" : ""),
        driverCity:
          claimThirdParty?.driverCity ||
          claimDetailsViewData?.driverCity ||
          (checked ? claimDetailsViewData?.CityName || "" : ""),
        driverZipCode:
          claimThirdParty?.driverZipCode ||
          claimDetailsViewData?.driverZipCode ||
          (checked ? claimDetailsViewData?.ZipCode || "" : ""),
        // Third party details - use Redux third party data first, then API data
        InsuranceCompanyN:
          claimThirdParty?.InsuranceCompanyN ||
          claimDetailsViewData?.InsuranceCompanyN ||
          "",
        name: claimThirdParty?.name || claimDetailsViewData?.name || "",
        contactNumber:
          claimThirdParty?.contactNumber ||
          claimDetailsViewData?.contactNumber ||
          "",
        plateNumber:
          claimThirdParty?.plateNumber ||
          claimDetailsViewData?.plateNumber ||
          "",
        unit: claimThirdParty?.unit || claimDetailsViewData?.unit || "",
        shop: claimThirdParty?.shop || claimDetailsViewData?.shop || "",
        dateOfIncident: claimThirdParty?.dateOfIncident ?? null,
        timeOfIncident: claimThirdParty?.timeOfIncident || "",
        addressOfIncident: claimThirdParty?.addressOfIncident || "",
        cityOfIncident: claimThirdParty?.cityOfIncident || "",
        provinceOfIncident: claimThirdParty?.provinceOfIncident || "",
        typeOfIncident: claimThirdParty?.typeOfIncident || "",
        estimatedClaimAmount: claimThirdParty?.estimatedClaimAmount ?? null,
        insuranceCompanyClaimNumber:
          claimThirdParty?.insuranceCompanyClaimNumber || "",
      };

      console.log("Updated Form Values:", updatedValues);
      formik.setValues(updatedValues);
      setLastUpdatedData(dataString);

      console.log("=== FORM VALUES AFTER UPDATE ===");
      console.log("Formik values after setValues:", formik.values);
      console.log("=== END FORM VALUES AFTER UPDATE ===");

      console.log("=== END UPDATING FORM WITH REDUX DATA ===");
    } else {
      console.log("No data to update form with");
    }
  }, [claimDetailsViewData, claimThirdParty, lastUpdatedData, checked]); // Added claimThirdParty to dependencies

  console.log("=== FORMIK STATE ===");
  console.log("Formik Values:", formik.values);
  console.log("Formik Touched:", formik.touched);
  console.log("Formik Errors:", formik.errors);
  console.log("=== END FORMIK STATE ===");
  const handleCheckboxChange = (e) => {
    setChecked(e.checked);

    if (e.checked) {
      // If checkbox is checked, populate driver details with policy holder data
      formik.setValues({
        ...formik.values,
        driverName: claimDetailsViewData?.PolicyHolderName || "",
        driverHouseNo: claimDetailsViewData?.HouseNo || "",
        driverBarangay: claimDetailsViewData?.Barangay || "",
        driverCountry: claimDetailsViewData?.CountryName || "",
        driverProvince: claimDetailsViewData?.Province || "",
        driverCity: claimDetailsViewData?.CityName || "",
        driverZipCode: claimDetailsViewData?.ZipCode || "",
      });
    } else {
      // If checkbox is unchecked, clear driver details
      formik.setValues({
        ...formik.values,
        driverName: "",
        driverHouseNo: "",
        driverBarangay: "",
        driverCountry: "",
        driverProvince: "",
        driverCity: "",
        driverZipCode: "",
      });
    }
  };

  // Show loading state while fetching data
  if (loading) {
    return (
      <div className="claim__details__card__container mt-4">
        <Card>
          <div className="claim__details__card__container__title">
            {t("claimDetails.claimRequest")}
          </div>
          <div className="text-center p-4">
            <div>{t("claimDetails.loadingPolicyAndLead")}</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="claim__details__card__container mt-4">
      <Card>
        <div className="claim__details__card__container__title">
          {t("claimDetails.claimRequest")}
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.insuranceCompanyName")}
              value={formik.values.InsuranceCompanyName}
              disabled={true}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.policyNumber")}
              value={formik.values.policyNumber}
              disabled={true}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.policyHolderName")}
              value={formik.values.PolicyHolderName}
              onChange={(e) => {
                console.log("Policy Holder Name changed:", e.target.value);
                formik.handleChange("PolicyHolderName")(e);
              }}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.houseNoUnitStreet")}
              value={formik.values.HouseNo}
              onChange={(e) => {
                console.log("House No changed:", e.target.value);
                formik.handleChange("HouseNo")(e);
              }}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.barangaySubd")}
              value={formik.values.Barangay}
              onChange={(e) => {
                console.log("Barangay changed:", e.target.value);
                formik.handleChange("Barangay")(e);
              }}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.country")}
              value={formik.values.CountryName}
              onChange={(e) => {
                console.log("Country changed:", e.target.value);
                formik.handleChange("CountryName")(e);
              }}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.province")}
              value={formik.values.Province}
              onChange={(e) => {
                console.log("Province changed:", e.target.value);
                formik.handleChange("Province")(e);
              }}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.city")}
              value={formik.values.CityName}
              onChange={(e) => {
                console.log("City changed:", e.target.value);
                formik.handleChange("CityName")(e);
              }}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.zipCode")}
              value={formik.values.ZipCode}
              onChange={(e) => {
                console.log("ZIP Code changed:", e.target.value);
                formik.handleChange("ZipCode")(e);
              }}
            />
          </div>
        </div>

        {claimDetailsViewData?.isCoInsurance && (
          <div className="co-insurance-info-section mt-4">
            <div className="co-insurance-info-section__header">
              <div className="claim__details__card__sub__title ml-2">
                {t("claimDetails.coInsuranceInformation")}
              </div>
              <i
                className="pi pi-question-circle co-insurance-info-icon"
                data-pr-tooltip={t("claimDetails.coInsuranceInfoTooltip")}
                data-pr-position="right"
              />
              <Tooltip target=".co-insurance-info-icon" />
            </div>
            <div className="grid mt-2 ml-1">
              <div className="col-12 md:col-6 lg:col-6">
                <div className="co-insurance-info-field">
                  <div className="co-insurance-info-field__label">
                    {t("claimDetails.coInsurancePolicy")}
                  </div>
                  <span className="co-insurance-policy-yes-pill">
                    {t("claimDetails.yes")}
                  </span>
                </div>
              </div>
              <div className="col-12 md:col-6 lg:col-6">
                <div className="co-insurance-info-field">
                  <div className="co-insurance-info-field__label">
                    {t("claimDetails.numberOfParticipatingInsurers")}
                  </div>
                  <div className="co-insurance-info-field__value">
                    {claimDetailsViewData?.participatingInsurersCount ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isFire && (
          <>
            <div className="claim__details__card__sub__title mt-4 ml-2">
              {t("claimDetails.incidentDetails")}
            </div>
            <div className="grid mt-2">
              <div className="col-12 md:col-6 lg:col-6">
                <DatepickerField
                  label={t("claimDetails.dateOfIncident")}
                  value={formik.values.dateOfIncident}
                  onChange={(e) =>
                    formik.setFieldValue("dateOfIncident", e.value)
                  }
                  dateFormat="yy-mm-dd"
                />
              </div>
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.timeOfIncident")}
                  value={formik.values.timeOfIncident}
                  onChange={(e) =>
                    formik.setFieldValue("timeOfIncident", e.target.value)
                  }
                  placeholder={t("claimDetails.timePlaceholder")}
                />
              </div>
            </div>
            <div className="grid mt-2">
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.addressOfIncident")}
                  value={formik.values.addressOfIncident}
                  onChange={(e) =>
                    formik.setFieldValue("addressOfIncident", e.target.value)
                  }
                />
              </div>
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.city")}
                  value={formik.values.cityOfIncident}
                  onChange={(e) =>
                    formik.setFieldValue("cityOfIncident", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid mt-2">
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.province")}
                  value={formik.values.provinceOfIncident}
                  onChange={(e) =>
                    formik.setFieldValue("provinceOfIncident", e.target.value)
                  }
                />
              </div>
              <div className="col-12 md:col-6 lg:col-6">
                <DropdownField
                  label={t("claimDetails.typeOfIncident")}
                  value={formik.values.typeOfIncident}
                  onChange={(e) =>
                    formik.setFieldValue("typeOfIncident", e.value)
                  }
                  options={FIRE_INCIDENT_TYPES}
                  optionLabel="label"
                  optionValue="value"
                  placeholder={t("claimDetails.select")}
                />
              </div>
            </div>
            <div className="grid mt-2">
              <div className="col-12 md:col-6 lg:col-6">
                <InputNumberField
                  label={t("claimDetails.estimatedClaimAmount")}
                  value={formik.values.estimatedClaimAmount}
                  onValueChange={(e) =>
                    formik.setFieldValue("estimatedClaimAmount", e.value)
                  }
                  inputId="estimatedClaimAmount"
                />
              </div>
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.insuranceCompanyClaimNumber")}
                  value={formik.values.insuranceCompanyClaimNumber}
                  onChange={(e) =>
                    formik.setFieldValue(
                      "insuranceCompanyClaimNumber",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </>
        )}

        {!isFire && (
          <>
            <div className="check__box__container mt-3">
              <Checkbox
                onChange={handleCheckboxChange}
                checked={checked}
              ></Checkbox>
              <div className="check__box__container__title">
                {t("claimDetails.sameAsPolicyHolder")}
              </div>
            </div>
            <div className="grid mt-3">
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.driversNameLabel")}
              value={formik.values.driverName}
              onChange={(e) => {
                console.log("Driver's name changed:", e.target.value);
                formik.handleChange("driverName")(e);
              }}
            />
            {formik.touched.driverName && formik.errors.driverName && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.driverName}
              </div>
            )}
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.houseNoUnitStreet")}
              value={formik.values.driverHouseNo}
              onChange={(e) => {
                console.log("Driver House No changed:", e.target.value);
                formik.handleChange("driverHouseNo")(e);
              }}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.barangaySubd")}
              value={formik.values.driverBarangay}
              onChange={(e) => {
                console.log("Driver Barangay changed:", e.target.value);
                formik.handleChange("driverBarangay")(e);
              }}
            />
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.country")}
              value={formik.values.driverCountry}
              onChange={(e) => {
                console.log("Driver Country changed:", e.target.value);
                formik.handleChange("driverCountry")(e);
              }}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.province")}
              value={formik.values.driverProvince}
              onChange={(e) => {
                console.log("Driver Province changed:", e.target.value);
                formik.handleChange("driverProvince")(e);
              }}
            />
          </div>
        </div>

        <div className="grid  mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.city")}
              value={formik.values.driverCity}
              onChange={(e) => {
                console.log("Driver City changed:", e.target.value);
                formik.handleChange("driverCity")(e);
              }}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("claimDetails.zipCode")}
              value={formik.values.driverZipCode}
              onChange={(e) => {
                console.log("Driver ZIP Code changed:", e.target.value);
                formik.handleChange("driverZipCode")(e);
              }}
            />
          </div>
        </div>
          </>
        )}

        <div className="claim__details__card__sub__title mt-3 ml-2">
          {isFire ? t("claimDetails.thirdPartyDetailsWitness") : t("claimDetails.thirdPartyDetails")}
        </div>
        <div>
          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("claimDetails.name")}
                value={formik.values.name}
                onChange={formik.handleChange("name")}
              />
              {formik.touched.name && formik.errors.name && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.name}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("claimDetails.contactNumber")}
                value={formik.values.contactNumber}
                onChange={formik.handleChange("contactNumber")}
              />
              {formik.touched.contactNumber && formik.errors.contactNumber && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.contactNumber}
                </div>
              )}
            </div>
          </div>

          {!isFire && (
            <div className="grid mt-2">
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.plateNumber")}
                  value={formik.values.plateNumber}
                  onChange={formik.handleChange("plateNumber")}
                />
                {formik.touched.plateNumber && formik.errors.plateNumber && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.plateNumber}
                  </div>
                )}
              </div>
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.unit")}
                  value={formik.values.unit}
                  onChange={formik.handleChange("unit")}
                />
                {formik.touched.unit && formik.errors.unit && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.unit}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid mt-2">
            {!isFire && (
              <div className="col-12 md:col-6 lg:col-6">
                <InputTextField
                  label={t("claimDetails.shop")}
                  value={formik.values.shop}
                  onChange={formik.handleChange("shop")}
                />
                {formik.touched.shop && formik.errors.shop && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.shop}
                  </div>
                )}
              </div>
            )}
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("claimDetails.insuranceCompanyNameOptional")}
                value={formik.values.InsuranceCompanyN}
                onChange={formik.handleChange("InsuranceCompanyN")}
              />
              {formik.touched.InsuranceCompanyN &&
                formik.errors.InsuranceCompanyN && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.InsuranceCompanyN}
                  </div>
                )}
            </div>
          </div>
          <div className="next_but_container">
            <Button label={t("claimDetails.next")} onClick={formik.handleSubmit} />
          </div>
        </div>
      </Card>
    </div>
  );
};

ClaimDetailsCard.propTypes = {
  leadRefId: PropTypes.string,
  quoteRefId: PropTypes.string,
  policyRefId: PropTypes.string,
  initialLob: PropTypes.string,
};

export default ClaimDetailsCard;
