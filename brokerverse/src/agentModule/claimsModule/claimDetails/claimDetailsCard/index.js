import { Card } from "primereact/card";
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import InputTextField from "../../../component/inputText";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import { Tooltip } from "primereact/tooltip";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormik } from "formik";
import { useDispatch, useSelector } from "react-redux";
import { postClaimDetailsData } from "../store/claimDetailsMiddleWare";
import { mapToApiLob } from "../store/claimDetailsMiddleWare";
import { isFireLob } from "../../../endorsementModule/constants/endorsementCategories";
import DropdownField from "../../../component/DropdownField";
import DatepickerField from "../../../component/datePicker";
import InputNumberField from "../../../component/inputNumberField";
import PhAddressFields from "../../../component/PhAddressFields";

const ClaimDetailsCard = ({
  leadRefId,
  quoteRefId,
  policyRefId,
  initialLob,
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  // Fire incident/cause-of-loss options (translated)
  const FIRE_INCIDENT_TYPES = [
    { label: t("claimDetails.fire"), value: "Fire" },
    { label: t("claimDetails.flood"), value: "Flood" },
    { label: t("claimDetails.typhoon"), value: "Typhoon" },
    { label: t("claimDetails.earthquake"), value: "Earthquake" },
    { label: t("claimDetails.lightning"), value: "Lightning" },
    { label: t("claimDetails.other"), value: "Other" },
  ];
  const MOTOR_INCIDENT_TYPES = [
    { label: "Collision", value: "Collision" },
    { label: "Theft / Carnapping", value: "Theft" },
    { label: "Fire", value: "Fire" },
    { label: "Flood / Typhoon (Acts of Nature)", value: "Acts of Nature" },
    { label: "Third-party liability", value: "Third-party liability" },
    { label: "Glass / windshield damage", value: "Glass damage" },
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
  // "Same as Policy Holder": restored when coming back from the mail step
  const [checked, setChecked] = useState(
    claimThirdParty?.isPolicyHolderTheDriver === true
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
    RoadThanon: claimDetailsViewData?.RoadThanon || "",
    SoiAlley: claimDetailsViewData?.SoiAlley || "",
    MooVillage: claimDetailsViewData?.MooVillage || "",
    // Driver's details - restore from Redux state if available, otherwise start empty
    driverName: claimThirdParty?.driverName || "",
    driverHouseNo: claimThirdParty?.driverHouseNo || "",
    driverBarangay: claimThirdParty?.driverBarangay || "",
    driverCountry: claimThirdParty?.driverCountry || "",
    driverProvince: claimThirdParty?.driverProvince || "",
    driverCity: claimThirdParty?.driverCity || "",
    driverZipCode: claimThirdParty?.driverZipCode || "",
    driverRoadThanon: claimThirdParty?.driverRoadThanon || "",
    driverSoiAlley: claimThirdParty?.driverSoiAlley || "",
    driverMooVillage: claimThirdParty?.driverMooVillage || "",
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

  const dispatch = useDispatch();

  // Policy holder name and address (house/street, barangay, country, province, city, ZIP) copied to the driver
  const holderToDriver = (values) => ({
    driverName: values.PolicyHolderName || "",
    driverHouseNo: values.HouseNo || "",
    driverBarangay: values.Barangay || "",
    driverCountry: values.CountryName || "",
    driverProvince: values.Province || "",
    driverCity: values.CityName || "",
    driverZipCode: values.ZipCode || "",
    driverRoadThanon: values.RoadThanon || "",
    driverSoiAlley: values.SoiAlley || "",
    driverMooVillage: values.MooVillage || "",
  });

  const handleSubmit = async (values) => {
    const lob = mapToApiLob(
      claimDetailsViewData?.lob ||
        claimDetailsViewData?.productType ||
        initialLob
    );
    const holderAsDriver = !isFire && checked;
    const payload = {
      ...values,
      ...(holderAsDriver ? holderToDriver(values) : {}),
      isPolicyHolderTheDriver: holderAsDriver,
      leadRefId,
      quoteRefId,
      policyRefId,
      lob,
    };
    await dispatch(postClaimDetailsData(payload));
    navigate("/agent/claimrequest/sendmail", {
      state: {
        clientId:
          claimDetailsViewData?.clientId || location.state?.clientId,
      },
    });
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
    // date of loss and cause are required for every line; the server checks the policy period
    if (!values.dateOfIncident) {
      errors.dateOfIncident = t("claimDetails.dateOfIncidentRequired", "Date of loss is required");
    } else if (new Date(values.dateOfIncident) > new Date()) {
      errors.dateOfIncident = t("claimDetails.dateOfIncidentFuture", "Date of loss cannot be in the future");
    }
    if (!values.typeOfIncident) {
      errors.typeOfIncident = t("claimDetails.typeOfIncidentRequired", "Select the cause of loss");
    }
    if (values.estimatedClaimAmount != null && Number(values.estimatedClaimAmount) < 0) {
      errors.estimatedClaimAmount = t("claimDetails.estimateNegative", "Estimate cannot be negative");
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
        return;
      }

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

      // Always hydrate the address fields from API snapshot when form is missing them
      const needsAddressHydration =
        (claimDetailsViewData?.CountryName &&
          !formik.values.CountryName) ||
        (claimDetailsViewData?.RoadThanon && !formik.values.RoadThanon) ||
        (claimDetailsViewData?.SoiAlley && !formik.values.SoiAlley) ||
        (claimDetailsViewData?.MooVillage && !formik.values.MooVillage) ||
        (claimDetailsViewData?.driverRoadThanon &&
          !formik.values.driverRoadThanon) ||
        (claimDetailsViewData?.driverSoiAlley &&
          !formik.values.driverSoiAlley) ||
        (claimDetailsViewData?.driverMooVillage &&
          !formik.values.driverMooVillage) ||
        (claimThirdParty?.driverRoadThanon &&
          !formik.values.driverRoadThanon) ||
        (claimThirdParty?.driverSoiAlley && !formik.values.driverSoiAlley) ||
        (claimThirdParty?.driverMooVillage &&
          !formik.values.driverMooVillage);

      // If user has already entered data, don't override it — unless address snapshot still needs hydration
      if (hasUserData && !needsAddressHydration) {
        setLastUpdatedData(dataString);
        return;
      }

      if (hasUserData && needsAddressHydration) {
        formik.setValues({
          ...formik.values,
          CountryName:
            formik.values.CountryName ||
            claimDetailsViewData?.CountryName ||
            "",
          Province:
            formik.values.Province || claimDetailsViewData?.Province || "",
          CityName:
            formik.values.CityName || claimDetailsViewData?.CityName || "",
          ZipCode:
            formik.values.ZipCode || claimDetailsViewData?.ZipCode || "",
          HouseNo:
            formik.values.HouseNo || claimDetailsViewData?.HouseNo || "",
          Barangay:
            formik.values.Barangay || claimDetailsViewData?.Barangay || "",
          RoadThanon:
            formik.values.RoadThanon ||
            claimDetailsViewData?.RoadThanon ||
            "",
          SoiAlley:
            formik.values.SoiAlley || claimDetailsViewData?.SoiAlley || "",
          MooVillage:
            formik.values.MooVillage ||
            claimDetailsViewData?.MooVillage ||
            "",
          driverCountry:
            formik.values.driverCountry ||
            claimThirdParty?.driverCountry ||
            claimDetailsViewData?.driverCountry ||
            "",
          driverProvince:
            formik.values.driverProvince ||
            claimThirdParty?.driverProvince ||
            claimDetailsViewData?.driverProvince ||
            "",
          driverCity:
            formik.values.driverCity ||
            claimThirdParty?.driverCity ||
            claimDetailsViewData?.driverCity ||
            "",
          driverZipCode:
            formik.values.driverZipCode ||
            claimThirdParty?.driverZipCode ||
            claimDetailsViewData?.driverZipCode ||
            "",
          driverHouseNo:
            formik.values.driverHouseNo ||
            claimThirdParty?.driverHouseNo ||
            claimDetailsViewData?.driverHouseNo ||
            "",
          driverBarangay:
            formik.values.driverBarangay ||
            claimThirdParty?.driverBarangay ||
            claimDetailsViewData?.driverBarangay ||
            "",
          driverRoadThanon:
            formik.values.driverRoadThanon ||
            claimThirdParty?.driverRoadThanon ||
            claimDetailsViewData?.driverRoadThanon ||
            "",
          driverSoiAlley:
            formik.values.driverSoiAlley ||
            claimThirdParty?.driverSoiAlley ||
            claimDetailsViewData?.driverSoiAlley ||
            "",
          driverMooVillage:
            formik.values.driverMooVillage ||
            claimThirdParty?.driverMooVillage ||
            claimDetailsViewData?.driverMooVillage ||
            "",
        });
        setLastUpdatedData(dataString);
        return;
      }

      // Only update form with API data if user hasn't entered anything (scenarios 1 & 2: new claim or edit)

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
        RoadThanon: claimDetailsViewData?.RoadThanon || "",
        SoiAlley: claimDetailsViewData?.SoiAlley || "",
        MooVillage: claimDetailsViewData?.MooVillage || "",
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
        driverRoadThanon:
          claimThirdParty?.driverRoadThanon ||
          claimDetailsViewData?.driverRoadThanon ||
          (checked ? claimDetailsViewData?.RoadThanon || "" : ""),
        driverSoiAlley:
          claimThirdParty?.driverSoiAlley ||
          claimDetailsViewData?.driverSoiAlley ||
          (checked ? claimDetailsViewData?.SoiAlley || "" : ""),
        driverMooVillage:
          claimThirdParty?.driverMooVillage ||
          claimDetailsViewData?.driverMooVillage ||
          (checked ? claimDetailsViewData?.MooVillage || "" : ""),
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

      formik.setValues(updatedValues);
      setLastUpdatedData(dataString);
    }
  }, [claimDetailsViewData, claimThirdParty, lastUpdatedData, checked]);

  const handleCheckboxChange = (e) => {
    setChecked(e.checked);

    if (e.checked) {
      // Copy current policyholder name and address to the driver
      formik.setValues({
        ...formik.values,
        ...holderToDriver(formik.values),
      });
    } else {
      formik.setValues({
        ...formik.values,
        driverName: "",
        driverHouseNo: "",
        driverBarangay: "",
        driverCountry: "",
        driverProvince: "",
        driverCity: "",
        driverZipCode: "",
        driverRoadThanon: "",
        driverSoiAlley: "",
        driverMooVillage: "",
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
                formik.handleChange("PolicyHolderName")(e);
              }}
            />
          </div>
        </div>

        {/* Policy holder's Philippine address: Region -> Province -> City / Municipality -> Barangay, House / Unit No., Street, ZIP code */}
        <PhAddressFields formik={formik} names={{ country: "CountryName", region: "Region", province: "Province", city: "CityName", barangay: "Barangay", houseNo: "HouseNo", street: "RoadThanon", zipCode: "ZipCode" }} />

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

        {(
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
                  dateFormat="dd/mm/yy"
                  maxDate={new Date()}
                />
                {formik.touched.dateOfIncident && formik.errors.dateOfIncident && (
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{formik.errors.dateOfIncident}</div>
                )}
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
                  options={isFire ? FIRE_INCIDENT_TYPES : MOTOR_INCIDENT_TYPES}
                  optionLabel="label"
                  optionValue="value"
                  placeholder={t("claimDetails.select")}
                />
                {formik.touched.typeOfIncident && formik.errors.typeOfIncident && (
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{formik.errors.typeOfIncident}</div>
                )}
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
                formik.handleChange("driverName")(e);
              }}
            />
            {formik.touched.driverName && formik.errors.driverName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.driverName}
              </div>
            )}
          </div>
        </div>

        {/* Driver's Philippine address: Region -> Province -> City / Municipality -> Barangay, House / Unit No., Street, ZIP code */}
        <PhAddressFields formik={formik} names={{ country: "driverCountry", region: "driverRegion", province: "driverProvince", city: "driverCity", barangay: "driverBarangay", houseNo: "driverHouseNo", street: "driverRoadThanon", zipCode: "driverZipCode" }} />
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
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
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
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
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
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
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
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
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
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
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
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
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
