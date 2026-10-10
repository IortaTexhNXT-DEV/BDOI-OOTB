import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import InputTextField from "../../../component/inputText";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormik } from "formik";
import { useDispatch, useSelector } from "react-redux";
import { postClaimDetailsData } from "../store/claimDetailsMiddleWare";
import { mapToApiLob } from "../store/claimDetailsMiddleWare";
import DropdownField from "../../../component/DropdownField";
import DatepickerField from "../../../component/datePicker";
import InputNumberField from "../../../component/inputNumberField";
import PhAddressFields from "../../../component/PhAddressFields";
import { FieldsSkeleton } from "../../../../components/Skeletons";
import FieldError from "../../../../components/FieldError";
import { ClaimActions, ClaimSection, FIELD_COL } from "../../shared/ClaimJourneyLayout";
import useClaimsConfig from "../../shared/useClaimsConfig";
import { claimLobOf, lobUses, lossCauseOptions } from "../../shared/claimJourney";

const ClaimDetailsCard = ({
  leadRefId,
  quoteRefId,
  policyRefId,
  initialLob,
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  const config = useClaimsConfig();
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

  // sections and causes of loss of the claim's line of business (claims.lob_fields, claims.loss_causes)
  const lob = claimLobOf(claimDetailsViewData?.lob, claimDetailsViewData?.productType, initialLob);
  const usesDriver = lobUses(config, lob, "driver");
  const usesVehicle = lobUses(config, lob, "vehicle");
  const causeOptions = lossCauseOptions(config, lob);

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
    fnolSource: claimThirdParty?.fnolSource || "",
    lossExtent: claimThirdParty?.lossExtent || "",
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
    const holderAsDriver = usesDriver && checked;
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

  // the driver's name is required where the line of business has a driver section (motor)
  const customValidation = (values) => {
    const errors = {};
    if (
      usesDriver &&
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
        fnolSource: claimThirdParty?.fnolSource || "",
        lossExtent: claimThirdParty?.lossExtent || "",
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

  if (loading) {
    return <FieldsSkeleton rows={3} columns={3} />;
  }

  const showErrors = formik.submitCount > 0;
  const fieldError = (name) => (showErrors || formik.touched[name] ? formik.errors[name] : undefined);
  const text = (name, label, props = {}) => (
    <div className={FIELD_COL}>
      <InputTextField label={label} value={formik.values[name]} onChange={formik.handleChange(name)} {...props} />
      <FieldError error={fieldError(name)} />
    </div>
  );

  return (
    <>
      <ClaimSection title={t("claimFlow.policySection")}>
        <div className="grid">
          {text("InsuranceCompanyName", t("claimDetails.insuranceCompanyName"), { disabled: true })}
          {text("policyNumber", t("claimDetails.policyNumber"), { disabled: true })}
          {text("PolicyHolderName", t("claimDetails.policyHolderName"))}
        </div>
        {claimDetailsViewData?.isCoInsurance && (
          <p className="claim-journey__hint mt-2">
            {t("claimFlow.coInsured", { count: claimDetailsViewData?.participatingInsurersCount ?? 0 })}
          </p>
        )}
      </ClaimSection>

      <ClaimSection title={t("claimFlow.holderAddress")}>
        {/* Policy holder's Philippine address: Region -> Province -> City / Municipality -> Barangay, House / Unit No., Street, ZIP code */}
        <PhAddressFields formik={formik} names={{ country: "CountryName", region: "Region", province: "Province", city: "CityName", barangay: "Barangay", houseNo: "HouseNo", street: "RoadThanon", zipCode: "ZipCode" }} />
      </ClaimSection>

      <ClaimSection title={t("claimDetails.incidentDetails")}>
        <div className="grid">
          <div className={FIELD_COL}>
            <DatepickerField label={t("claimDetails.dateOfIncident")} value={formik.values.dateOfIncident}
              onChange={(e) => formik.setFieldValue("dateOfIncident", e.value)} maxDate={new Date()} />
            <FieldError error={fieldError("dateOfIncident")} />
          </div>
          {text("timeOfIncident", t("claimDetails.timeOfIncident"))}
          <div className={FIELD_COL}>
            <DropdownField label={t("claimDetails.typeOfIncident")} value={formik.values.typeOfIncident}
              onChange={(e) => formik.setFieldValue("typeOfIncident", e.value)} options={causeOptions} optionLabel="label" optionValue="value"
              placeholder={t("claimDetails.select")} />
            <FieldError error={fieldError("typeOfIncident")} />
          </div>
          {text("addressOfIncident", t("claimDetails.addressOfIncident"))}
          {text("cityOfIncident", t("claimDetails.city"))}
          {text("provinceOfIncident", t("claimDetails.province"))}
          <div className={FIELD_COL}>
            <InputNumberField label={t("claimDetails.estimatedClaimAmount")} value={formik.values.estimatedClaimAmount}
              onValueChange={(e) => formik.setFieldValue("estimatedClaimAmount", e.value)} inputId="estimatedClaimAmount" />
            <FieldError error={fieldError("estimatedClaimAmount")} />
          </div>
          {text("insuranceCompanyClaimNumber", t("claimDetails.insuranceCompanyClaimNumber"))}
          <div className={FIELD_COL}>
            <DropdownField label={t("claimHandling.source")} value={formik.values.fnolSource}
              onChange={(e) => formik.setFieldValue("fnolSource", e.value || "")} options={(config.fnolSources || []).map((x) => ({ label: x, value: x }))}
              optionLabel="label" optionValue="value" placeholder={t("claimDetails.select")} />
          </div>
          {usesVehicle ? (
            <div className={FIELD_COL}>
              <DropdownField label={t("claimHandling.lossExtent")} value={formik.values.lossExtent}
                onChange={(e) => formik.setFieldValue("lossExtent", e.value || "")} optionLabel="label" optionValue="value" placeholder={t("claimDetails.select")}
                options={[{ label: t("claimHandling.extent.partial"), value: "partial" }, { label: t("claimHandling.extent.total"), value: "total" }]} />
            </div>
          ) : null}
        </div>
      </ClaimSection>

      {usesDriver && (
        <ClaimSection title={t("claimJourney.driverSection")}>
          <div className="claim-journey__check">
            <Checkbox inputId="holder-driver" onChange={handleCheckboxChange} checked={checked} />
            <label htmlFor="holder-driver">{t("claimDetails.sameAsPolicyHolder")}</label>
          </div>
          <div className="grid">
            {text("driverName", t("claimDetails.driversNameLabel"))}
          </div>
          {/* Driver's Philippine address: Region -> Province -> City / Municipality -> Barangay, House / Unit No., Street, ZIP code */}
          <PhAddressFields formik={formik} names={{ country: "driverCountry", region: "driverRegion", province: "driverProvince", city: "driverCity", barangay: "driverBarangay", houseNo: "driverHouseNo", street: "driverRoadThanon", zipCode: "driverZipCode" }} />
        </ClaimSection>
      )}

      <ClaimSection title={usesDriver ? t("claimJourney.thirdParty") : t("claimJourney.thirdPartyWitness")} hint={t("claimJourney.ifApplicable")}>
        <div className="grid">
          {text("name", t("claimDetails.name"))}
          {text("contactNumber", t("claimDetails.contactNumber"))}
          {usesVehicle && text("plateNumber", t("claimDetails.plateNumber"))}
          {usesVehicle && text("unit", t("claimDetails.unit"))}
          {usesVehicle && text("shop", t("claimDetails.shop"))}
          {text("InsuranceCompanyN", t("claimDetails.insuranceCompanyNameOptional"))}
        </div>
      </ClaimSection>

      <ClaimActions next={t("claimFlow.next.notification")}>
        <Button type="button" label={t("claimJourney.next")} icon="pi pi-arrow-right" iconPos="right" onClick={formik.handleSubmit} />
      </ClaimActions>
    </>
  );
};

ClaimDetailsCard.propTypes = {
  leadRefId: PropTypes.string,
  quoteRefId: PropTypes.string,
  policyRefId: PropTypes.string,
  initialLob: PropTypes.string,
};

export default ClaimDetailsCard;
