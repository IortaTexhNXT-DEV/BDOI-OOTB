import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { Card } from "primereact/card";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Button } from "primereact/button";
import DropdownField from "../../component/DropdwonField";
import InputTextField from "../../component/inputText";
import DatepickerField from "../../component/datePicker";
import { FileUpload } from "primereact/fileupload";
import SvgImageUpload from "../../../assets/icons/SvgImageUpload";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import SvgUploadClose from "../../../assets/agentIcon/SvgUploadClose";
import customHistory from "../../../routes/customHistory";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import {
  postAdjusterSubmission,
  getClaimDetails,
} from "./store/adjusterSubmissionMiddleWare";
import { isFireLob } from "../../endorsementModule/constants/endorsementCategories";
import addressService from "../../../services/addressService";
import {
  addressOptionsWithSaved,
  canonicalAddressValue,
  findAddressItem,
  isPhilippines,
  isValidPhilippineZip,
  normalizeCountryName,
} from "../../../utility/addressHelpers";

const AdjusterSubmission = () => {
  const { t } = useTranslation();
  const Navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const fileUploadRef = useRef(null);
  const [uploadImage, setuploadImage] = useState(null);
  const [formInitialized, setFormInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get claim ID from URL params or navigation state
  const claimId =
    params.id ||
    params.claimId ||
    location.state?.claimId ||
    location.state?.id;

  console.log("=== ADJUSTER SUBMISSION PAGE DATA ===");
  console.log("URL Params:", params);
  console.log("Navigation State:", location.state);
  console.log("Claim ID:", claimId);
  console.log("=== END ADJUSTER SUBMISSION PAGE DATA ===");

  // Redux state - memoized to prevent unnecessary rerenders
  const { claimDetails, claimDetailsLoading, claimDetailsError } = useSelector(
    useMemo(
      () =>
        ({ adjusterSubmissionReducers }) => ({
          claimDetails: adjusterSubmissionReducers?.claimDetails || {},
          claimDetailsLoading:
            adjusterSubmissionReducers?.claimDetailsLoading || false,
          claimDetailsError:
            adjusterSubmissionReducers?.claimDetailsError || "",
        }),
      []
    )
  );

  // Derive LOB from claim details - Fire policies should not show motor-specific fields
  const claimData = claimDetails?.data || claimDetails;
  const lobSource =
    claimData?.lob ||
    claimData?.productType ||
    claimData?.policy?.productType ||
    claimData?.policy?.lob ||
    location.state?.lob ||
    location.state?.productType;
  const isFireClaim = isFireLob(lobSource);
  const isMotorClaim = !isFireClaim;

  const coInsuranceParticipantRows = useMemo(() => {
    const claim = claimDetails?.data || claimDetails || {};
    const participants = claim?.quotation?.participantDetails || [];
    const isCoInsurance = Boolean(
      claim?.isCoInsurancePolicy ||
        claim?.isCoInsurance ||
        claim?.quotation?.isCoInsurance ||
        claim?.policy?.isCoInsurance
    );

    if (!isCoInsurance || participants.length === 0) {
      return [];
    }

    return participants.map((participant, index) => {
      const rawShare = String(participant.sharePercentage ?? "").trim();
      const shareDisplay = rawShare
        ? rawShare.endsWith("%")
          ? rawShare
          : `${rawShare}%`
        : "0%";

      return {
        id: participant.id || `participant-${index}`,
        insurer:
          participant.insuranceCompanyName ||
          participant.participantName ||
          "N/A",
        role:
          index === 0
            ? t("agent.leadInsurer")
            : t("agent.coInsurer"),
        share: shareDisplay,
      };
    });
  }, [claimDetails, t]);

  // Get policy holder data from Redux
  const {
    policyHolderName: reduxPolicyHolderName,
    policyNumber: reduxPolicyNumber,
    claimNumber: reduxClaimNumber,
  } = useSelector(({ claimDetailsMainReducers }) => ({
    policyHolderName: claimDetailsMainReducers?.policyHolderName || "",
    policyNumber: claimDetailsMainReducers?.policyNumber || "",
    claimNumber: claimDetailsMainReducers?.claimNumber || "",
  }));

  // Try to get policy holder name from Redux first, then claim details, then fallback
  const policyHolderName =
    reduxPolicyHolderName ||
    claimDetails?.policyHolderName ||
    claimDetails?.PolicyHolderName ||
    "Loading...";

  const claimNumber =
    reduxClaimNumber ||
    claimDetails?.claimNumber ||
    claimDetails?.claim_number ||
    "Loading...";

  console.log("=== ADJUSTER SUBMISSION REDUX DATA ===");
  console.log("Claim Details:", claimDetails);
  console.log("Claim Details Type:", typeof claimDetails);
  console.log(
    "Claim Details Keys:",
    claimDetails ? Object.keys(claimDetails) : "No claim details"
  );
  console.log("Loading:", claimDetailsLoading);
  console.log("Error:", claimDetailsError);
  console.log("=== REDUX POLICY HOLDER DATA ===");
  console.log("Redux Policy Holder Name:", reduxPolicyHolderName);
  console.log("Redux Policy Number:", reduxPolicyNumber);
  console.log("Redux Claim Number:", reduxClaimNumber);
  console.log("Final Policy Holder Name:", policyHolderName);
  console.log("Final Claim Number:", claimNumber);
  console.log("=== END REDUX POLICY HOLDER DATA ===");
  console.log("=== END ADJUSTER SUBMISSION REDUX DATA ===");

  const dispatch = useDispatch();

  // Fetch claim details on component mount
  useEffect(() => {
    if (claimId) {
      console.log("=== DISPATCHING GET CLAIM DETAILS ===");
      console.log("Dispatching getClaimDetails with ID:", claimId);
      dispatch(getClaimDetails(claimId));
      console.log("=== END DISPATCHING GET CLAIM DETAILS ===");
    }
  }, [dispatch, claimId]);

  // Cleanup object URL on component unmount
  useEffect(() => {
    return () => {
      if (uploadImage?.startsWith("blob:")) {
        URL.revokeObjectURL(uploadImage);
      }
    };
  }, [uploadImage]);

  const handleUppendImg = (name, src) => {
    console.log("=== FILE UPLOAD DEBUG ===");
    console.log("Name:", name);
    console.log("Source:", src);
    console.log("Source objectURL:", src?.objectURL);
    console.log("Source type:", typeof src);
    console.log("Source name:", src?.name);
    console.log("=== END FILE UPLOAD DEBUG ===");

    // Create object URL for file preview
    const fileURL = src?.objectURL || (src ? URL.createObjectURL(src) : null);
    setuploadImage(fileURL);
  };
  const handleCancelUplaoded = () => {
    // Clean up object URL to prevent memory leaks
    if (uploadImage?.startsWith("blob:")) {
      URL.revokeObjectURL(uploadImage);
    }
    setuploadImage(null);
    fileUploadRef.current.clear();
  };
  const handleBackNavigation = () => {
    customHistory.back();
  };
  // Default form values - will be updated when API data is available
  const formInitialValue = {
    adjusterName: "",
    claimNumber: "",
    insuranceCompanyClaimNumber: "",
    dateOfReported: new Date().toISOString().split("T")[0],
    dateOfLoss: new Date().toISOString().split("T")[0],
    placeOfAccident: "",
    driversName: "",
    houseNumber: "",
    barangay: "",
    country: "",
    province: "",
    city: "",
    zipCode: "",
    name: "",
    contactNumber: "",
    plateNumber: "",
    unit: "",
    shop: "",
    insuranceCompanyName: "",
    file: null,
  };

  const customValidation = (values) => {
    console.log("=== VALIDATION CALLED ===");
    console.log("Validation values:", values);
    console.log(
      "Country validation:",
      values.country,
      "Truthy:",
      !!values.country
    );
    console.log(
      "Province validation:",
      values.province,
      "Truthy:",
      !!values.province
    );
    console.log("City validation:", values.city, "Truthy:", !!values.city);
    console.log("=== END VALIDATION CALLED ===");

    const errors = {};
    if (!values.adjusterName) {
      errors.adjusterName = t("validation.fieldRequired");
    }
    if (!values.claimNumber) {
      errors.claimNumber = t("validation.fieldRequired");
    }
    if (!values.dateOfReported) {
      errors.dateOfReported = t("validation.fieldRequired");
    }
    if (!values.dateOfLoss) {
      errors.dateOfLoss = t("validation.fieldRequired");
    }
    if (!values.placeOfAccident) {
      errors.placeOfAccident = t("validation.fieldRequired");
    }
    if (!values.driversName) {
      errors.driversName = t("validation.fieldRequired");
    }
    if (!values.houseNumber) {
      errors.houseNumber = t("validation.fieldRequired");
    }
    if (!values.barangay) {
      errors.barangay = t("validation.fieldRequired");
    }

    if (!values?.country) {
      errors.country = t("validation.fieldRequired");
    }

    if (!values?.province) {
      errors.province = t("validation.fieldRequired");
    }

    if (!values?.city) {
      errors.city = t("validation.fieldRequired");
    }
    if (!values.zipCode) {
      errors.zipCode = t("validation.fieldRequired");
    } else if (
      isPhilippines(values.country) &&
      !isValidPhilippineZip(values.zipCode)
    ) {
      errors.zipCode = t(
        "validation.zipCodePhilippines",
        "ZIP code must be 4 digits"
      );
    }
    return errors;
  };
  const handleSubmit = async (values) => {
    console.log("=== HANDLE SUBMIT CALLED ===");
    console.log("Claim ID:", claimId);
    console.log("Form Values:", values);
    console.log("Country value:", values.country);
    console.log("Province value:", values.province);
    console.log("City value:", values.city);
    console.log("=== END HANDLE SUBMIT CALLED ===");

    if (!claimId) {
      console.error("No claim ID available for adjuster submission");
      return;
    }

    setIsSubmitting(true);
    console.log("=== SUBMITTING ADJUSTER DATA ===");
    console.log("Claim ID:", claimId);
    console.log("Form Values:", values);
    console.log("=== END SUBMITTING ADJUSTER DATA ===");

    try {
      // Prepare adjuster data for API
      const adjusterData = {
        insuranceCompanyClaimNumber: values.insuranceCompanyClaimNumber || "",
        reportedDate: values.dateOfReported
          ? new Date(values.dateOfReported).toISOString()
          : "",
        dateOfIncident: values.dateOfLoss
          ? new Date(values.dateOfLoss).toISOString()
          : "",
        addressOfIncident: values.placeOfAccident || "",
        driverName: values.driversName || "",
        // driver address (country / province / city are address-master names)
        driverDetails: {
          driverName: values.driversName || "",
          driverHouseNo: values.houseNumber || "",
          driverBarangay: values.barangay || "",
          driverCountry: values.country || "",
          driverProvince: values.province || "",
          driverCity: values.city || "",
          driverZipCode: String(values.zipCode || "").trim(),
        },
        adjusterName: values.adjusterName || "",
        adjusterStatus: "Assigned", // Default status
        thirdPartyName: values.name || "",
        thirdPartyContactNumber: values.contactNumber || "",
        file: values.file || null,
      };

      const result = await dispatch(
        postAdjusterSubmission({
          claimId: claimId,
          adjusterData: adjusterData,
        })
      );

      if (result.type.endsWith("/fulfilled")) {
        console.log("Adjuster submission successful:", result.payload);
        console.log("Navigating to settlement approval with claimId:", claimId);
        Navigate(`/agent/claimrequest/settlementapproval/${claimId}`, {
          state: {
            claimId,
            clientId:
              location.state?.clientId ||
              claimDetails?.data?.policy?.clientId ||
              claimDetails?.data?.clientId,
          },
        });
      } else {
        console.error("Adjuster submission failed:", result.payload);
        // You can add error handling here
      }
    } catch (error) {
      console.error("Error submitting adjuster data:", error);
      // You can add error handling here
    } finally {
      setIsSubmitting(false);
    }
  };
  const formik = useFormik({
    initialValues: formInitialValue,
    validate: customValidation,
    onSubmit: handleSubmit,
  });

  // Address master (addresses API): Country -> Province -> City; Province filters City.
  const [countryList, setCountryList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await addressService.getCountries();
      if (!cancelled && res.success && Array.isArray(res.data)) {
        setCountryList(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Parent key for the child list: master id when matched, otherwise the saved name (the API accepts names too)
  const countryKey =
    findAddressItem(countryList, formik.values.country)?.id ??
    (formik.values.country || "");
  const provinceKey =
    findAddressItem(provinceList, formik.values.province)?.id ??
    (formik.values.province || "");

  useEffect(() => {
    if (!countryKey) {
      setProvinceList([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getProvincesByCountry(countryKey);
      if (!cancelled) {
        setProvinceList(res.success && Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryKey]);

  useEffect(() => {
    if (!provinceKey) {
      setCityList([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const res = await addressService.getCitiesByProvince(provinceKey);
      if (!cancelled) {
        setCityList(res.success && Array.isArray(res.data) ? res.data : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provinceKey]);

  // Saved values that match the master by code or a different spelling ("PHILIPPINES", "MAKATI CITY") take the master name
  useEffect(() => {
    [
      ["country", countryList],
      ["province", provinceList],
      ["city", cityList],
    ].forEach(([field, list]) => {
      const current = formik.values[field];
      if (!current || !list.length) return;
      const canonical = canonicalAddressValue(list, current);
      if (canonical !== current) formik.setFieldValue(field, canonical, false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    countryList,
    provinceList,
    cityList,
    formik.values.country,
    formik.values.province,
    formik.values.city,
  ]);

  const countryOptions = useMemo(
    () => addressOptionsWithSaved(countryList, formik.values.country),
    [countryList, formik.values.country]
  );
  const provinceOptions = useMemo(
    () => addressOptionsWithSaved(provinceList, formik.values.province),
    [provinceList, formik.values.province]
  );
  const cityOptions = useMemo(
    () => addressOptionsWithSaved(cityList, formik.values.city),
    [cityList, formik.values.city]
  );

  // Update form values when claim details are loaded (only once)
  useEffect(() => {
    if (
      claimDetails &&
      Object.keys(claimDetails).length > 0 &&
      claimDetails.data &&
      !formInitialized
    ) {
      console.log("=== UPDATING FORM WITH API DATA ===");
      console.log("Claim Details:", claimDetails);

      const claimData = claimDetails?.data || {};
      const leadData = claimData?.lead || {};
      const thirdPartyData = claimData?.thirdPartyWitnessDetails?.[0] || {};

      // Driver address: the one saved on the claim; when none was saved and the policy holder is the driver,
      // the holder address of the claim (client record of the policy), then the lead.
      const text = (v) => String(v ?? "").trim();
      const holderName = text(
        claimData?.policyHolderName || claimData?.policy?.policyHolderName
      ).toLowerCase();
      const driverIsHolder =
        claimData?.isPolicyHolderTheDriver === true ||
        !text(claimData?.driverName) ||
        (holderName && text(claimData?.driverName).toLowerCase() === holderName);
      const driverAddress = {
        houseNo: claimData?.driverHouseNo,
        barangay: claimData?.driverBarangay,
        country: claimData?.driverCountry,
        province: claimData?.driverProvince,
        city: claimData?.driverCity,
        zipCode: claimData?.driverZipCode,
      };
      const hasAddress = (a) =>
        Boolean(a) &&
        ["houseNo", "barangay", "country", "province", "city", "zipCode"].some(
          (k) => text(a[k])
        );
      const holderAddress = [claimData, claimData?.policy, leadData].find(
        hasAddress
      );
      const address = hasAddress(driverAddress)
        ? driverAddress
        : (driverIsHolder && holderAddress) || {};

      const updatedValues = {
        adjusterName: "",
        claimNumber: claimData?.claimNumber || "",
        insuranceCompanyClaimNumber: "",
        dateOfReported: claimData?.reportedDate
          ? new Date(claimData.reportedDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        dateOfLoss: claimData?.dateOfIncident
          ? new Date(claimData.dateOfIncident).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        placeOfAccident: claimData?.addressOfIncident || "",
        driversName:
          claimData?.driverName ||
          (leadData?.firstName && leadData?.lastName
            ? `${leadData.firstName} ${leadData.lastName}`
            : "") ||
          "",
        houseNumber: text(address.houseNo),
        barangay: text(address.barangay),
        country: normalizeCountryName(text(address.country)),
        province: text(address.province),
        city: text(address.city),
        zipCode: text(address.zipCode),
        name: thirdPartyData?.thirdPartyName || "",
        contactNumber: thirdPartyData?.thirdPartyContactNumber || "",
        plateNumber: thirdPartyData?.thirdPartyPlateNumber || "",
        unit: thirdPartyData?.thirdPartyUnit || "",
        shop: thirdPartyData?.thirdPartyShop || "",
        insuranceCompanyName:
          thirdPartyData?.thirdPartyInsuranceCompanyName ||
          claimData?.insuranceCompanyName ||
          claimData?.policy?.insuranceCompanyName ||
          "",
        file: null,
      };

      console.log("Updated Form Values:", updatedValues);

      // Check if form already has the same data to avoid unnecessary updates
      const currentValues = formik.values;
      const hasChanges = Object.keys(updatedValues).some(
        (key) => currentValues[key] !== updatedValues[key]
      );

      if (hasChanges) {
        // Ensure no undefined values are passed to formik
        const safeValues = Object.keys(updatedValues).reduce((acc, key) => {
          acc[key] = updatedValues[key] !== undefined ? updatedValues[key] : "";
          return acc;
        }, {});

        // Update formik values
        formik.setValues(safeValues);
        setFormInitialized(true);
        console.log("Form values updated successfully!");
      } else {
        console.log("Form already has the same data, skipping update");
        setFormInitialized(true);
      }

      console.log("=== END UPDATING FORM WITH API DATA ===");
    }
  }, [claimDetails, formInitialized]);

  // Show loading state
  if (claimDetailsLoading) {
    return (
      <div className="claim__request__upload__container">
      <div className="claim__request__upload__main__title">{t("agent.clients")}</div>
      <div 
        className="claim__request__upload__back__btn mt-3 cursor-pointer"
        onClick={handleBackNavigation}
      >
        <SvgLeftArrow />
        <div className="claim__request__upload__back__btn__title">
          {(() => {
            console.log("=== ADJUSTER SUBMISSION LOADING DISPLAY LOGIC ===");
              console.log("Policy Holder Name:", policyHolderName);
              console.log("Claim Number:", claimNumber);
              console.log(
                "Displaying:",
                `${policyHolderName} / ${
                  claimNumber ? `Claim: ${claimNumber}` : "Loading..."
                }`
              );
              console.log(
                "=== END ADJUSTER SUBMISSION LOADING DISPLAY LOGIC ==="
              );

              return `${policyHolderName} / ${
                claimNumber ? `${t("agent.claimLabel")}: ${claimNumber}` : t("agent.loading")
              }`;
            })()}
          </div>
        </div>
        <Card className="mt-4">
          <div className="claim__request__upload__title">{t("agent.claimRequest")}</div>
          <div className="text-center p-4">
            <div>{t("agent.loadingClaimDetails")}</div>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state
  if (claimDetailsError) {
    return (
      <div className="claim__request__upload__container">
      <div className="claim__request__upload__main__title">{t("agent.clients")}</div>
      <div 
        className="claim__request__upload__back__btn mt-3 cursor-pointer"
        onClick={handleBackNavigation}
      >
        <SvgLeftArrow />
        <div className="claim__request__upload__back__btn__title">
          {(() => {
            console.log("=== ADJUSTER SUBMISSION ERROR DISPLAY LOGIC ===");
              console.log("Policy Holder Name:", policyHolderName);
              console.log("Claim Number:", claimNumber);
              console.log(
                "Displaying:",
                `${policyHolderName} / ${
                  claimNumber ? `Claim: ${claimNumber}` : "Loading..."
                }`
              );
              console.log(
                "=== END ADJUSTER SUBMISSION ERROR DISPLAY LOGIC ==="
              );

              return `${policyHolderName} / ${
                claimNumber ? `${t("agent.claimLabel")}: ${claimNumber}` : t("agent.loading")
              }`;
            })()}
          </div>
        </div>
        <Card className="mt-4">
          <div className="claim__request__upload__title">{t("agent.claimRequest")}</div>
          <div className="text-center p-4" style={{ color: "red" }}>
            <div>{t("agent.errorLoadingClaimDetails")} {claimDetailsError}</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="claim__request__upload__container">
      <div className="claim__request__upload__main__title">{t("agent.clients")}</div>
      <div 
        className="claim__request__upload__back__btn mt-3 cursor-pointer"
        onClick={handleBackNavigation}
      >
        <SvgLeftArrow />
        <div className="claim__request__upload__back__btn__title">
          {(() => {
            console.log("=== ADJUSTER SUBMISSION MAIN DISPLAY LOGIC ===");
            console.log("Policy Holder Name:", policyHolderName);
            console.log("Claim Number:", claimNumber);
            console.log(
              "Displaying:",
              `${policyHolderName} / ${
                claimNumber ? `Claim: ${claimNumber}` : "Loading..."
              }`
            );
            console.log("=== END ADJUSTER SUBMISSION MAIN DISPLAY LOGIC ===");

return `${policyHolderName} / ${
                claimNumber ? `${t("agent.claimLabel")}: ${claimNumber}` : t("agent.loading")
              }`;
            })()}
        </div>
      </div>
      <Card className="mt-4">
        <div className="claim__request__upload__title">{t("agent.claimRequest")}</div>

        <div className="grid mt-2">
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={`${t("agent.adjusterName")}*`}
              value={formik.values.adjusterName}
              onChange={formik.handleChange("adjusterName")}
            />
            {formik.touched.adjusterName && formik.errors.adjusterName && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.adjusterName}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={`${t("agent.claimNumber")}*`}
              value={formik.values.claimNumber}
              onChange={formik.handleChange("claimNumber")}
            />
            {formik.touched.claimNumber && formik.errors.claimNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.claimNumber}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.insuranceCompanyClaimNumber")}
              value={formik.values.insuranceCompanyClaimNumber}
              onChange={formik.handleChange("insuranceCompanyClaimNumber")}
            />
            {formik.touched.insuranceCompanyClaimNumber &&
              formik.errors.insuranceCompanyClaimNumber && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.insuranceCompanyClaimNumber}
                </div>
              )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <DatepickerField
              label={`${t("agent.dateOfReported")}*`}
              // value={
              //   formik.values.dateOfReported
              //     ?
              //      new Date(formik.values.dateOfReported)
              //     : null
              // }
              // onChange={(e) => {
              //   formik.handleChange("dateOfReported")(
              //     e.value.toISOString().split("T")[0]
              //   );
              // }}
              value={new Date(formik?.values?.dateOfReported)}
              onChange={(e) =>
                formik.setFieldValue(
                  "dateOfReported",
                  e.value.toISOString().split("T")
                )
              }
              dateFormat="yy-mm-dd"
            />
            {formik.touched.dateOfReported && formik.errors.dateOfReported && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.dateOfReported}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <DatepickerField
              label={`${t("agent.dateOfLoss")}*`}
              // value={
              //   formik.values.dateOfLoss
              //     ? new Date(formik.values.dateOfLoss)
              //     : null
              // }
              // onChange={(e) => {
              //   formik.handleChange("dateOfLoss")(
              //     e.value.toISOString().split("T")[0]
              //   );
              // }}
              value={new Date(formik?.values?.dateOfLoss)}
              onChange={(e) =>
                formik.setFieldValue(
                  "dateOfLoss",
                  e.value.toISOString().split("T")
                )
              }
              dateFormat="yy-mm-dd"
            />
            {formik.touched.dateOfLoss && formik.errors.dateOfLoss && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.dateOfLoss}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={
                isFireClaim
                  ? `${t("agent.placeOfIncidentLoss")}*`
                  : `${t("agent.placeOfAccident")}*`
              }
              value={formik.values.placeOfAccident}
              onChange={formik.handleChange("placeOfAccident")}
            />
            {formik.touched.placeOfAccident &&
              formik.errors.placeOfAccident && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.placeOfAccident}
                </div>
              )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={
                isFireClaim
                  ? `${t("agent.nameOfInsuredClaimant")}*`
                  : `${t("agent.driversName")}*`
              }
              value={formik.values.driversName}
              onChange={formik.handleChange("driversName")}
            />
            {formik.touched.driversName && formik.errors.driversName && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.driversName}
              </div>
            )}
          </div>

          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={`${t("agent.houseNoUnitStreet")}*`}
              value={formik.values.houseNumber}
              onChange={formik.handleChange("houseNumber")}
            />
            {formik.touched.houseNumber && formik.errors.houseNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.houseNumber}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={`${t("agent.barangaySubd")}*`}
              value={formik.values.barangay}
              onChange={formik.handleChange("barangay")}
            />
            {formik.touched.barangay && formik.errors.barangay && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.barangay}
              </div>
            )}
          </div>

          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label={`${t("agent.country")}*`}
              value={formik.values.country}
              onChange={(e) => {
                formik.setFieldValue("country", e.value || "");
                formik.setFieldValue("province", "");
                formik.setFieldValue("city", "");
              }}
              options={countryOptions}
              optionLabel="label"
              optionValue="value"
            />
            {formik.touched.country && formik.errors.country && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.country}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label={`${t("agent.province")}*`}
              value={formik.values.province}
              onChange={(e) => {
                formik.setFieldValue("province", e.value || "");
                formik.setFieldValue("city", "");
              }}
              options={provinceOptions}
              optionLabel="label"
              optionValue="value"
              disabled={!formik.values.country}
            />
            {formik.touched.province && formik.errors.province && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.province}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label={`${t("agent.city")}*`}
              value={formik.values.city}
              onChange={(e) => formik.setFieldValue("city", e.value || "")}
              options={cityOptions}
              optionLabel="label"
              optionValue="value"
              disabled={!formik.values.province}
            />
            {formik.touched.city && formik.errors.city && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.city}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={`${t("agent.zipCode")}*`}
              value={formik.values.zipCode}
              onChange={formik.handleChange("zipCode")}
              maxLength={isPhilippines(formik.values.country) ? 4 : undefined}
            />
            {formik.touched.zipCode && formik.errors.zipCode && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.zipCode}
              </div>
            )}
          </div>
          {coInsuranceParticipantRows.length > 0 && (
            <div className="col-12 mt-2 mb-3">
              <table className="co-insurance-participants-table">
                <thead>
                  <tr>
                    <th>{t("agent.insurer")}</th>
                    <th>{t("agent.role")}</th>
                    <th className="share">{t("agent.share")}</th>
                  </tr>
                </thead>
                <tbody>
                  {coInsuranceParticipantRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.insurer}</td>
                      <td>{row.role}</td>
                      <td className="share">{row.share}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="col-12 claim__request__upload__subtitle mt-2 mb-2">
            {t("agent.thirdPartyDetails")}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.name")}
              value={formik.values.name}
              onChange={formik.handleChange("name")}
            />
            {formik.touched.name && formik.errors.name && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.name}
              </div>
            )}
          </div>
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.contactNumber")}
              value={formik.values.contactNumber}
              onChange={formik.handleChange("contactNumber")}
            />
            {formik.touched.contactNumber && formik.errors.contactNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.contactNumber}
              </div>
            )}
          </div>
          {isMotorClaim && (
            <>
              <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
                <InputTextField
                  label={t("agent.plateNumber")}
                  value={formik.values.plateNumber}
                  onChange={formik.handleChange("plateNumber")}
                />
                {formik.touched.plateNumber && formik.errors.plateNumber && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.plateNumber}
                  </div>
                )}
              </div>
              <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
                <InputTextField
                  label={t("agent.unit")}
                  value={formik.values.unit}
                  onChange={formik.handleChange("unit")}
                />
                {formik.touched.unit && formik.errors.unit && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.unit}
                  </div>
                )}
              </div>
              <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
                <InputTextField
                  label={t("agent.shop")}
                  value={formik.values.shop}
                  onChange={formik.handleChange("shop")}
                />
                {formik.touched.shop && formik.errors.shop && (
                  <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                    {formik.errors.shop}
                  </div>
                )}
              </div>
            </>
          )}
          <div className="col-6 md:col-6 lg:col-6 xl:col-6 mt-2 ">
            <InputTextField
              label={t("agent.insuranceCompanyName")}
              value={formik.values.insuranceCompanyName}
              onChange={formik.handleChange("insuranceCompanyName")}
            />
            {formik.touched.insuranceCompanyName &&
              formik.errors.insuranceCompanyName && (
                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                  {formik.errors.insuranceCompanyName}
                </div>
              )}
          </div>
          <div className="col-12 claim__request__upload__subtitle mt-2 mb-2">
            {t("agent.proofOfDocuments")}
          </div>
          <div className="col-12">
            <div className="file_icon_selector">
              <FileUpload
                ref={fileUploadRef}
                url="./upload"
                auto
                customUpload
                mode="basic"
                name="demo"
                accept=".png,.jpg,.jpeg,.pdf"
                maxFileSize={2000000}
                // uploadHandler={(e) => {
                //   handleUppendImg(e.options.props.name, e.files[0]);
                // }}
                uploadHandler={(e) => {
                  formik.setFieldValue("file", e.files[0]);
                  handleUppendImg(e.options.props.name, e.files[0]);
                }}
              />

              <div className="icon_click_option">
                <SvgImageUpload />
              </div>
              <div className="upload__caption text-center">{t("common.upload")}</div>
              <div className="upload__caption text-center">
                {t("agent.maxFileSizePdf")}
              </div>
            </div>
          </div>
          {formik.touched.file && formik.errors.file && (
            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
              {formik.errors.file}
            </div>
          )}
          {uploadImage && (
            <div className="col-12 mt-2">
              <span
                onClick={handleCancelUplaoded}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCancelUplaoded();
                  }
                }}
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer" }}
              >
                <SvgUploadClose />
              </span>
            </div>
          )}

          <div className="col-12 mt-2">
            <div className="back__next__btn__container">
              <div className="back__btn__container">
                <Button onClick={handleBackNavigation} className="back__btn">
                  {t("agent.back")}
                </Button>
              </div>
              <div className="next__btn__container">
                <Button
                  className="next__btn"
                  onClick={formik.handleSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? t("agent.submitting") : t("agent.next")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdjusterSubmission;
