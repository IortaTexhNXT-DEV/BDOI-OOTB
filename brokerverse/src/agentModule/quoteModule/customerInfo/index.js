import React, { useState, useEffect, useMemo } from "react";
import { vehicleColourLabel } from "../../../utility/quoteOptions";
import "./index.scss";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import InputTextField from "../../component/inputText";
import DropdownField from "../../component/DropdwonField";
import { Button } from "primereact/button";
import SvgImageUpload from "../../../assets/icons/SvgImageUpload";
import { FileUpload } from "primereact/fileupload";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import customHistory from "../../../routes/customHistory";
import { useFormik } from "formik";
import {
  postinformationMiddleWare,
  patchinformationMiddleWare,
} from "./store/infoMiddleWare";
import { useDispatch, useSelector } from "react-redux";
import { getQuotationByIdMiddleware } from "../Store/quotationMiddleware";
import quotationService from "../../../services/quotationService";
import { Toast } from "primereact/toast";
import leadService from "../../../services/leadService";
import s3Service from "../../../services/s3Service";
import { ProgressBar } from "primereact/progressbar";
import {
  KYC_DEFAULT_ID_TYPES,
  KYC_DEFAULT_REQUIRED,
  kycErrors,
  loadKycConfig,
  requiredKycFor,
} from "../../../utility/kyc";
import { notifyError } from "../../../utility/dialogs";
import useMasterOptions from "../../../module/GeneralMasters/common/useMasterOptions";
import logger from "../../../utility/logger";

const FieldError = ({ formik, name }) =>
  formik.touched[name] && formik.errors[name] ? (
    <div style={{ fontSize: 12, color: "red" }} className="mt-2">
      {formik.errors[name]}
    </div>
  ) : null;

const CustomerInfo = ({ action }) => {
  const { t } = useTranslation();
  // Mortgagee banks from Master > Finance > Bank
  const MortgageOptions = useMasterOptions("bank");
  const [imageURL, setimageURL] = useState("");
  const [idUploadProgress, setIdUploadProgress] = useState(null);
  const [kycConfig, setKycConfig] = useState({
    required: KYC_DEFAULT_REQUIRED,
    idTypes: KYC_DEFAULT_ID_TYPES,
  });

  useEffect(() => {
    let active = true;
    loadKycConfig().then((cfg) => {
      if (active) setKycConfig(cfg);
    });
    return () => {
      active = false;
    };
  }, []);
  const navigate = useNavigate();
  const { state } = useLocation();
  const { quotationId } = useParams();
  const dispatch = useDispatch();
  const toast = React.useRef(null);

  // State for quotation details and loading
  // Always start with null to force fresh API fetch
  const [quotationDetails, setQuotationDetails] = useState(null);
  const [isLoadingQuotation, setIsLoadingQuotation] = useState(false);
  const [quotationLoadError, setQuotationLoadError] = useState(null);
  const [leadData, setLeadData] = useState(null);

  // Load quotation details if not in state
  useEffect(() => {
    const loadQuotation = async () => {
      if (quotationId) {
        setIsLoadingQuotation(true);
        setQuotationLoadError(null);

        try {
          const result = await dispatch(
            getQuotationByIdMiddleware(quotationId)
          );

          if (result.type.endsWith("/fulfilled")) {
            setQuotationDetails(result.payload);
          } else {
            const errorMsg = t("agent.failedToLoadQuotation", { id: quotationId });
            setQuotationLoadError(errorMsg);
            notifyError(errorMsg);

            // Redirect back to quote listing after 2 seconds
            setTimeout(() => {
              navigate("/agent/quotelisting");
            }, 2000);
          }
        } catch (error) {
          const errorMsg = t("agent.errorLoadingQuotation");
          setQuotationLoadError(errorMsg);
          notifyError(errorMsg);
        } finally {
          setIsLoadingQuotation(false);
        }
      }
    };

    loadQuotation();
  }, [quotationId, dispatch, navigate]);

  // Fetch lead data when quotation details are loaded
  useEffect(() => {
    const fetchLeadData = async () => {
      if (quotationDetails?.leadRefId) {
        try {
          const response = await leadService.getLeadById(quotationDetails.leadRefId);
          if (response.success) {
            setLeadData(response.data);
          } else {
            logger.error("Failed to fetch lead data:", response.error);
          }
        } catch (error) {
          logger.error("Error fetching lead data:", error);
        }
      }
    };

    fetchLeadData();
  }, [quotationDetails?.leadRefId]);

  // Initialize form values based on quotation data
  const getInitialValues = () => {
    // If we have quotation details with vehicle info, use those
    if (quotationDetails) {
      return {
        IdType: quotationDetails.idType || "",
        IdCardImage: quotationDetails.idCardImage || "",
        IdCardNumber: quotationDetails.idCardNumber || "",
        MotorNumber: quotationDetails.motorNumber || "",
        ChassisNumber: quotationDetails.chassisNumber || "",
        Mortgage: quotationDetails.mortgage || "",
        CertNumber: quotationDetails.certNumber || "",
        PlateNumber: quotationDetails.plateNumber || "",
        MVFileNumber: quotationDetails.MvFileNumber || "",
        AuthenCode: quotationDetails.authenCode || "",
        Aluminium: quotationDetails.aluminum || "",
        AirBag: quotationDetails.airBag || "",
        TNVS: quotationDetails.TNVS || "",
        TruckType: quotationDetails.truckType || "",
      };
    }

    // Fallback for edit action (backward compatibility)
    // Default empty values (never pre-filled with sample identifiers)
    return {
      IdType: "",
      IdCardImage: "",
      IdCardNumber: "",
      MotorNumber: "",
      ChassisNumber: "",
      Mortgage: "",
      CertNumber: "",
      PlateNumber: "",
      MVFileNumber: "",
      AuthenCode: "",
      Aluminium: "",
      AirBag: "",
      TNVS: "",
      TruckType: "",
    };
  };

  const initialValues = useMemo(
    () => getInitialValues(),
    [quotationDetails, action]
  );

  const handleSubmit = async (values) => {
    if (!quotationId) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Quotation ID is missing",
        life: 3000,
      });
      return;
    }

    // Prepare customer info data
    const customerInfo = {
      IdType: values.IdType,
      IdCardImage: values.IdCardImage,
      IdCardNumber: values.IdCardNumber,
      MotorNumber: values.MotorNumber,
      ChassisNumber: values.ChassisNumber,
      Mortgage: values.Mortgage,
      CertNumber: values.CertNumber,
      PlateNumber: values.PlateNumber,
      MVFileNumber: values.MVFileNumber,
      AuthenCode: values.AuthenCode,
      Aluminium: values.Aluminium,
      AirBag: values.AirBag,
      TNVS: values.TNVS,
      TruckType: values.TruckType,
    };

    // Prepare vehicle info for API
    const vehicleInfo = {
      idType: values.IdType,
      idCardImage: values.IdCardImage,
      idCardNumber: values.IdCardNumber,
      motorNumber: values.MotorNumber,
      chassisNumber: values.ChassisNumber,
      mortgage: values.Mortgage,
      certNumber: values.CertNumber,
      plateNumber: values.PlateNumber,
      MvFileNumber: values.MVFileNumber,
      authenCode: values.AuthenCode,
      aluminum: values.Aluminium,
      airBag: values.AirBag,
      TNVS: values.TNVS,
      truckType: values.TruckType,
    };

    try {
      // Show loading toast
      toast.current?.show({
        severity: "info",
        summary: "Saving",
        detail: "Saving vehicle information to quotation...",
        life: 2000,
      });

      // Update quotation with vehicle info
      const result = await quotationService.updateQuotationVehicleInfo(
        quotationId,
        vehicleInfo,
        "agent"
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to save vehicle information");
      }

      // Update quotation details with the returned data
      if (result.data?.data) {
        setQuotationDetails(result.data.data);
      }

      toast.current?.show({
        severity: "success",
        summary: "Success",
        detail: "Vehicle information saved successfully",
        life: 2000,
      });

      // Dispatch redux actions for backward compatibility
      if (action === "edit") {
        dispatch(patchinformationMiddleWare(values));
      } else {
        dispatch(postinformationMiddleWare(values));
      }

      // Navigate to next step after a brief delay
      setTimeout(() => {
        navigate(`/agent/convertpolicy/uploadvehiclephotos/${quotationId}`, {
          state: {
            ...state,
            quotation: result.data?.data || quotationDetails,
            customerInfo: customerInfo,
          },
        });
      }, 1000);
    } catch (error) {
      logger.error("Failed to save vehicle information:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: error.message || "Failed to save vehicle information",
        life: 5000,
      });
    }
  };

  const { postcustomerinfodata, loading } = useSelector(
    ({ CustomerInfoReducer }) => {
      return {
        loading: CustomerInfoReducer?.loading,
        postcustomerinfodata: CustomerInfoReducer?.postcustomerinfodata,
      };
    }
  );

  // The ID card photo is uploaded as soon as it is chosen; the stored URL is saved on the quotation (idCardImage).
  const handleIdCardSelected = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.current?.show({ severity: "error", summary: "File too large", detail: "The ID card photo must be 2 MB or smaller", life: 4000 });
      return;
    }
    setimageURL(file.objectURL || URL.createObjectURL(file));
    setIdUploadProgress(0);
    try {
      const result = await s3Service.uploadFile(file, "id-cards", (p) => setIdUploadProgress(p));
      if (!result.success || !result.url) throw new Error(result.error || "Upload failed");
      formik.setFieldValue("IdCardImage", result.url);
    } catch (error) {
      setimageURL("");
      formik.setFieldValue("IdCardImage", "");
      toast.current?.show({ severity: "error", summary: "ID card upload failed", detail: error.message, life: 5000 });
    } finally {
      setIdUploadProgress(null);
    }
  };
  const handleRemoveIdCard = () => {
    setimageURL("");
    formik.setFieldValue("IdCardImage", "");
  };
  const handleBackNavigation = () => {
    customHistory.back();
  };
  const TNVSdata = [
    { label: "Yes", value: "AL" },
    { label: "No", value: "AZ" },
  ];

  const AirBag = [
    { label: "Yes", value: "AL" },
    { label: "No", value: "AZ" },
  ];
  const Aluminium = [
    { label: "Yes", value: "AL" },
    { label: "No", value: "AZ" },
  ];
  const TruckTypes = [
    { label: "Heavy duty", value: "AL" },
    { label: "Heavy Xl", value: "AZ" },
  ];

  // const customValidation = (values) => {
  //   if (!values.MotorNumber) {
  //   }
  //   if (!values.ChassisNumber) {
  //   }
  //   if (!values.TruckType) {
  //   }
  //   if (!values.Mortgage) {
  //   }
  //   if (!values.CertNumber) {
  //   }
  //   if (!values.PlateNumber) {
  //   }
  //   if (!values.MVFileNumber) {
  //   }
  //   if (!values.AuthenCode) {
  //   }
  //   if (!values.Aluminium) {
  //   }
  //   if (!values.AirBag) {
  //   }
  //   if (!values.TNVS) {
  //   }
  //   if (!values.file) {
  //   }
  // };

  useEffect(() => {
    if (action === "edit" && postcustomerinfodata) {
      setFormikValues(postcustomerinfodata);
    }
  }, [action, postcustomerinfodata]);

  const setFormikValues = (data) => {
    const updatedValues = {
      MotorNumber: data?.MotorNumber,
      ChassisNumber: data?.ChassisNumber,
      Mortgage: data?.Mortgage,
      CertNumber: data?.CertNumber,
      PlateNumber: data?.PlateNumber,
      MVFileNumber: data?.MVFileNumber,
      AuthenCode: data?.AuthenCode,
      Aluminium: data?.Aluminium,
      AirBag: data?.AirBag,
      TNVS: data?.TNVS,
      TruckType: data?.TruckType,
    };

    formik.setValues({ ...formik.values, ...updatedValues });
  };

  // KYC and vehicle identifiers required for this line (policy.kyc_required_fields); the server enforces the same rule.
  const requiredKyc = requiredKycFor(kycConfig, quotationDetails?.lob || "MOTOR");
  const isRequired = (item) => requiredKyc.includes(item);
  const plateOrMv = isRequired("plateOrMvFile");

  const formik = useFormik({
    initialValues: initialValues,
    enableReinitialize: true, // Allow form to reinitialize when quotation data loads
    validate: (values) => kycErrors(values, requiredKyc, kycConfig.idTypes),
    onSubmit: handleSubmit,
  });

  const submitWithValidation = async () => {
    const errors = await formik.validateForm();
    formik.setTouched(Object.fromEntries(Object.keys(formik.initialValues).map((k) => [k, true])), false);
    if (Object.keys(errors).length) {
      toast.current?.show({
        severity: "warn",
        summary: "Customer information incomplete",
        detail: [...new Set(Object.values(errors))].join(". "),
        life: 6000,
      });
      return;
    }
    formik.handleSubmit();
  };

  useEffect(() => {
    if (formik.values.IdCardImage && !imageURL) setimageURL(formik.values.IdCardImage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.IdCardImage]);

  useEffect(() => {
    if (action === "edit") {
      if (!formik.values.Aluminium) {
        formik.setFieldValue("Aluminium", Aluminium[0].value);
      }
      if (!formik.values.AirBag) {
        formik.setFieldValue("AirBag", AirBag[0].value);
      }
      if (!formik.values.TNVS) {
        formik.setFieldValue("TNVS", TNVSdata[0].value);
      }
      if (!formik.values.TruckType) {
        formik.setFieldValue("TruckType", TruckTypes[0].value);
      }
    }
  }, []);
  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };

  // Show loading state while fetching quotation
  if (isLoadingQuotation) {
    return (
      <div className="customer__info__container">
        <Toast ref={toast} />
        <div className="customer__info__main__title">{t("agent.leads")}</div>
        <Card className="mt-4">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <i
              className="pi pi-spin pi-spinner"
              style={{ fontSize: "2rem" }}
            ></i>
            <p style={{ marginTop: "1rem" }}>Loading quotation details...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state if quotation failed to load
  if (quotationLoadError) {
    return (
      <div className="customer__info__container">
        <Toast ref={toast} />
        <div className="customer__info__main__title">{t("agent.leads")}</div>
        <Card className="mt-4">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <i
              className="pi pi-times-circle"
              style={{ fontSize: "2rem", color: "#f44336" }}
            ></i>
            <p style={{ marginTop: "1rem", color: "#f44336" }}>
              {quotationLoadError}
            </p>
            <Button
              label="Return to Quote Listing"
              onClick={() => navigate("/agent/quotelisting")}
              className="mt-3"
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="customer__info__container">
      <Toast ref={toast} />
      <div className="customer__info__main__title">{t("agent.leads")}</div>
      <div className="customer__info__back__btn mt-3">
        <div className="customer__info__back__btn__title">
          <div
            onClick={handleLeadNavigation}
            className="cursor-pointer arrow__outer"
          >
            <span className="icon__container">
              <SvgLeftArrow />
            </span>
            {leadData
              ? `${leadData.firstName || ""} ${leadData.lastName || ""} / ${t("agent.leadIdLabel")} ${leadData.generatedLeadId || ""}`
              : quotationDetails?.leadRefId
              ? `${t("agent.leadIdLabel")} ${quotationDetails.lead?.generatedLeadId || ""}`
              : t("agent.loadingLeadData")}
          </div>
        </div>
        <div className="customer__info__quote__title">
          {t("agent.quoteId")} {quotationDetails?.quotationNumber || "N/A"}
        </div>
      </div>
      <Card className="mt-4">
        <div className="customer__info__title">{t("agent.convertPolicy")}</div>
        <div className="customer__info__subtitle mt-2 mb-2">
          {t("agent.customerInformation")}
        </div>
        <div class="grid m-0">
          <div class="col-12 mt-2">
            <InputTextField
              label="Insured Name"
              value={
                quotationDetails?.lead
                  ? `${quotationDetails.lead.firstName || ""} ${
                      quotationDetails.lead.lastName || ""
                    }`.trim()
                  : "Loading..."
              }
              disabled
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label={`ID Type${isRequired("idType") ? " *" : ""}`}
              options={(kycConfig.idTypes || []).map((v) => ({ label: v, value: v }))}
              optionLabel="label"
              value={formik.values.IdType}
              onChange={(e) => formik.setFieldValue("IdType", e.value)}
            />
            <FieldError formik={formik} name="IdType" />
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label={`ID Card Number${isRequired("idNumber") ? " *" : ""}`}
              value={formik.values.IdCardNumber}
              onChange={formik.handleChange("IdCardNumber")}
            />
            <FieldError formik={formik} name="IdCardNumber" />
          </div>
          <div class="col-12 mt-2">
            <div className="upload__label">ID Card{isRequired("idImage") ? " *" : ""}</div>
            {!imageURL ? (
              <div className="upload__card__container mt-2">
                <div className="file_icon_selector">
                  <FileUpload
                    auto
                    customUpload
                    mode="basic"
                    name="idCard"
                    accept=".png,.jpg,.jpeg"
                    uploadHandler={(e) => {
                      handleIdCardSelected(e.files[0]);
                      e.options.clear();
                    }}
                  />
                  <div className="icon_click_option">
                    <SvgImageUpload />
                  </div>
                  <div className="upload__caption text-center">Upload</div>
                  <div className="upload__caption text-center">
                    Maximum 2 MB (PNG or JPEG Files Only)
                  </div>
                </div>
              </div>
            ) : (
              <div className="upload__image__area mt-2">
                <img src={imageURL} alt="ID card" className="image__view" />
                <div className="flex align-items-center gap-2 mt-2">
                  {idUploadProgress !== null ? (
                    <ProgressBar value={idUploadProgress} style={{ height: "0.75rem", flex: 1 }} />
                  ) : (
                    formik.values.IdCardImage && (
                      <span className="text-sm text-green-600">
                        <i className="pi pi-check-circle mr-1" />
                        Uploaded
                      </span>
                    )
                  )}
                  <Button
                    type="button"
                    icon="pi pi-trash"
                    label="Remove"
                    className="p-button-text p-button-danger p-button-sm"
                    disabled={idUploadProgress !== null}
                    onClick={handleRemoveIdCard}
                  />
                </div>
              </div>
            )}
            <FieldError formik={formik} name="IdCardImage" />
          </div>

          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label="Email"
              value={quotationDetails?.lead?.emailId || ""}
              disabled
            />
          </div>

          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label="Contact Number"
              value={quotationDetails?.lead?.contactNumber || ""}
              disabled
            />
          </div>
        </div>
        <div className="customer__info__subtitle mt-2 mb-2">
          Insurance Vehicle Details
        </div>
        <div class="grid m-0">
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label="Vehicle Brand"
              value={
                quotationDetails?.insuranceVehicleDetails?.[0]?.vehicleBrand ||
                "N/A"
              }
              disabled
            />
          </div>

          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label="Vehicle Model"
              value={
                quotationDetails?.insuranceVehicleDetails?.[0]?.vehicleModel ||
                "N/A"
              }
              disabled
            />
          </div>

          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label="Model Year"
              value={
                quotationDetails?.insuranceVehicleDetails?.[0]?.modelYear ||
                "N/A"
              }
              disabled
            />
          </div>

          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label="Vehicle Color"
              value={
                vehicleColourLabel(quotationDetails?.insuranceVehicleDetails?.[0]?.vehicleColor) ||
                "N/A"
              }
              disabled
            />
          </div>
        </div>

        <div className="customer__info__subtitle mt-2 mb-2">
          Additional Vehicle Information
        </div>
        <div class="grid m-0">
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label={`Motor Number${isRequired("motorNumber") ? " *" : ""}`}
              value={formik.values.MotorNumber}
              onChange={formik.handleChange("MotorNumber")}
            />
            {formik.touched.MotorNumber && formik.errors.MotorNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.MotorNumber}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label={`Chassis Number${isRequired("chassisNumber") ? " *" : ""}`}
              value={formik.values.ChassisNumber}
              onChange={formik.handleChange("ChassisNumber")}
            />
            {formik.touched.ChassisNumber && formik.errors.ChassisNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.ChassisNumber}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label="Mortgage"
              options={MortgageOptions}
              optionLabel="label"
              value={formik.values.Mortgage}
              onChange={(e) => formik.setFieldValue("Mortgage", e.value)}
            />
            {formik.touched.Mortgage && formik.errors.Mortgage && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.Mortgage}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label="Cert Number"
              value={formik.values.CertNumber}
              onChange={formik.handleChange("CertNumber")}
            />
            {formik.touched.CertNumber && formik.errors.CertNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.CertNumber}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label={`Plate Number${isRequired("plateNumber") ? " *" : plateOrMv ? " (or MV file no.) *" : ""}`}
              value={formik.values.PlateNumber}
              onChange={formik.handleChange("PlateNumber")}
            />
            {formik.touched.PlateNumber && formik.errors.PlateNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.PlateNumber}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label={`MV File Number${isRequired("mvFileNumber") ? " *" : plateOrMv ? " (if no plate yet)" : ""}`}
              value={formik.values.MVFileNumber}
              onChange={formik.handleChange("MVFileNumber")}
            />
            {formik.touched.MVFileNumber && formik.errors.MVFileNumber && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.MVFileNumber}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <InputTextField
              label="Authen Code"
              value={formik.values.AuthenCode}
              onChange={formik.handleChange("AuthenCode")}
            />
            {formik.touched.AuthenCode && formik.errors.AuthenCode && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.AuthenCode}
              </div>
            )}
          </div>

          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label="Truck Type"
              options={TruckTypes}
              optionLabel="label"
              value={formik.values.TruckType}
              onChange={(e) => formik.setFieldValue("TruckType", e.value)}
            />
            {formik.touched.TruckType && formik.errors.TruckType && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.TruckType}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label="Aluminium"
              options={Aluminium}
              optionLabel="label"
              value={formik.values.Aluminium}
              onChange={(e) => formik.setFieldValue("Aluminium", e.value)}
            />
            {formik.touched.Aluminium && formik.errors.Aluminium && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.Aluminium}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-1">
            <DropdownField
              label="Air Bag"
              options={AirBag}
              optionLabel="label"
              value={formik.values.AirBag}
              onChange={(e) => formik.setFieldValue("AirBag", e.value)}
            />
            {formik.touched.AirBag && formik.errors.AirBag && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.AirBag}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
            <DropdownField
              label="TNVS"
              options={TNVSdata}
              optionLabel="label"
              value={formik.values.TNVS}
              onChange={(e) => formik.setFieldValue("TNVS", e.value)}
              error={formik.touched.TNVS && formik.errors.TNVS}
            />
            {formik.touched.TNVS && formik.errors.TNVS && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.TNVS}
              </div>
            )}
          </div>
          <div className="col-12 mt-2">
            <div className="back__next__btn__container">
              <div className="back__btn__container">
                <Button className="back__btn" onClick={handleBackNavigation}>
                  Back
                </Button>
              </div>
              <div className="next__btn__container">
                <Button
                  className="next__btn"
                  disabled={idUploadProgress !== null}
                  onClick={submitWithValidation}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CustomerInfo;
