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
import { MortgageOptions } from "../../endorsementModule/personalDetails/mock";
import { getQuotationByIdMiddleware } from "../Store/quotationMiddleware";
import quotationService from "../../../services/quotationService";
import { Toast } from "primereact/toast";
import leadService from "../../../services/leadService";

const CustomerInfo = ({ action }) => {
  console.log(action, "find action in customer info");
  const { t } = useTranslation();
  const [imageURL, setimageURL] = useState("");
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
        console.log(
          "CustomerInfo: Loading quotation details for ID:",
          quotationId
        );
        setIsLoadingQuotation(true);
        setQuotationLoadError(null);

        try {
          const result = await dispatch(
            getQuotationByIdMiddleware(quotationId)
          );

          if (result.type.endsWith("/fulfilled")) {
            console.log(
              "CustomerInfo: Quotation loaded successfully:",
              result.payload
            );
            setQuotationDetails(result.payload);
          } else {
            console.error(
              "CustomerInfo: Failed to load quotation:",
              result.payload
            );
            const errorMsg = t("agent.failedToLoadQuotation", { id: quotationId });
            setQuotationLoadError(errorMsg);
            alert(errorMsg);

            // Redirect back to quote listing after 2 seconds
            setTimeout(() => {
              navigate("/agent/quotelisting");
            }, 2000);
          }
        } catch (error) {
          console.error("CustomerInfo: Error loading quotation:", error);
          const errorMsg = t("agent.errorLoadingQuotation");
          setQuotationLoadError(errorMsg);
          alert(errorMsg);
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
        console.log("Fetching lead data for leadRefId:", quotationDetails.leadRefId);
        try {
          const response = await leadService.getLeadById(quotationDetails.leadRefId);
          if (response.success) {
            console.log("Lead data fetched successfully:", response.data);
            setLeadData(response.data);
          } else {
            console.error("Failed to fetch lead data:", response.error);
          }
        } catch (error) {
          console.error("Error fetching lead data:", error);
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
    if (action === "edit") {
      return {
        IdCardNumber: "",
        MotorNumber: "8546791234",
        ChassisNumber: "8529637412",
        Mortgage: "",
        CertNumber: "2583694671",
        PlateNumber: "4568231975",
        MVFileNumber: "1456239857",
        AuthenCode: "3219758642",
        Aluminium: "",
        AirBag: "",
        TNVS: "",
        TruckType: "",
      };
    }

    // Default empty values
    return {
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
    console.log(values, "find full datas");

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
      console.error("Failed to save vehicle information:", error);
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

  console.log("first21", postcustomerinfodata);

  const handleUppendImg = (name, src) => {
    setimageURL(src?.objectURL);
    console.log(name, src?.objectURL, "find handleUppendImg");
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
    //  { label: "duty", value: "AR" },
  ];

  // const customValidation = (values) => {
  //   const errors = {};

  //   if (!values.MotorNumber) {
  //     errors.MotorNumber = "This field Code is required";
  //   }
  //   if (!values.ChassisNumber) {
  //     errors.ChassisNumber = "This field is required";
  //   }
  //   if (!values.TruckType) {
  //     errors.TruckType = "This field is required";
  //   }
  //   if (!values.Mortgage) {
  //     errors.Mortgage = "This field is required";
  //   }
  //   if (!values.CertNumber) {
  //     errors.CertNumber = "This field is required";
  //   }
  //   if (!values.PlateNumber) {
  //     errors.PlateNumber = "This field is required";
  //   }
  //   if (!values.MVFileNumber) {
  //     errors.MVFileNumber = "This field is required";
  //   }
  //   if (!values.AuthenCode) {
  //     errors.AuthenCode = "This field is required";
  //   }
  //   if (!values.Aluminium) {
  //     errors.Aluminium = "This field is required";
  //   }
  //   if (!values.AirBag) {
  //     errors.AirBag = "This field is required";
  //   }
  //   if (!values.TNVS) {
  //     errors.TNVS = "This field is required";
  //   }
  //   if (!values.file) {
  //     errors.file = "This field is required";
  //   }
  //   return errors;
  // };

  //   useEffect(() => {
  //     console.log(action,'find sction call')
  //     if (action === "edit") {
  // console.log(postcustomerinfodata,'find postcustomerinfodata')
  //     setFormikValues(postcustomerinfodata);
  //     }
  //   },[action]);
  useEffect(() => {
    if (action === "edit" && postcustomerinfodata) {
      setFormikValues(postcustomerinfodata);
    }
  }, [action, postcustomerinfodata]);

  const setFormikValues = (data) => {
    console.log(data, "find data");
    // const IsoCode = getExchangeEdit?.ISOcode;
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
    console.log("1211", updatedValues);
  };

  const formik = useFormik({
    initialValues: initialValues,
    enableReinitialize: true, // Allow form to reinitialize when quotation data loads
    // validate: customValidation,
    onSubmit: handleSubmit,
  });

  useEffect(() => {
    // if (action === "edit") {
    // }
    if (action === "edit") {
      if (!formik.values.Mortgage) {
        formik.setFieldValue("Mortgage", MortgageOptions[0].value);
      }
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
              ? `${t("agent.leadIdLabel")} ${quotationDetails.leadRefId}`
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
          <div class="col-12 mt-2">
            <div className="upload__label">ID Card</div>
            {!imageURL ? (
              <div className="upload__card__container mt-2">
                <div className="file_icon_selector">
                  <FileUpload
                    url="./upload"
                    auto
                    customUpload
                    mode="basic"
                    name="demo"
                    accept=".png,.jpg,.jpeg"
                    // maxFileSize={2000000}
                    uploadHandler={(e) => {
                      formik.setFieldValue("file", e.files[0]);
                      handleUppendImg(
                        e.options.props.name,
                        e.files[0],
                        "the data"
                      );
                    }}
                    // uploadHandler={(e) => {
                    //   formik.setFieldValue("file", e.files[0]);
                    //   handleUppendImg(
                    //     e.options.props.name,
                    //     e.files[0],
                    //     "the data"
                    //   );
                    // }}
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
                <img src={imageURL} alt="Image" className="image__view" />
              </div>
            )}
            {formik.touched.file && formik.errors.file && (
              <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                {formik.errors.file}
              </div>
            )}
          </div>
          <div class="col-12 mt-2">
            <InputTextField
              label="ID Card Number"
              value={formik.values.IdCardNumber}
              onChange={formik.handleChange("IdCardNumber")}
            />
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
              label="Motor Number"
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
              label="Chassis Number"
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
              label="Plate Number"
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
              label="MV File Number"
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
                  onClick={() => {
                    formik.handleSubmit();
                  }}
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
